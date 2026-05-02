"use strict";
// =========================================================================
// DETERMINISTIC F9 FINANCIAL MODEL RUNNER
// =========================================================================
// Pure function: takes ModelAssumptions, returns ModelResults.
// No DB, no external APIs, no LLM — all math computed in TypeScript.
//
// Spec: docs/F9 Financial Model - Agent Specification.txt
// Wiring: docs/agent-f9-wiring-spec-v1.0.txt
// =========================================================================
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVacancySchedule = buildVacancySchedule;
exports.cumulativeRentGrowth = cumulativeRentGrowth;
exports.computeFloridaTax = computeFloridaTax;
exports.computeNonFloridaTax = computeNonFloridaTax;
exports.computeAmortization = computeAmortization;
exports.calculateIRR = calculateIRR;
exports.calculateEM = calculateEM;
exports.calculateAvgCoC = calculateAvgCoC;
exports.computeYearOperating = computeYearOperating;
exports.bisectDistribution = bisectDistribution;
exports.computeWaterfall = computeWaterfall;
exports.computeSensitivityMatrix = computeSensitivityMatrix;
exports.runIntegrityChecks = runIntegrityChecks;
exports.runModel = runModel;
// ── Constants ──────────────────────────────────────────────────────────────
var DEF_CLOSING_PCT = 0.01;
var DEF_FL_DOC_PCT = 0.007;
var DEF_FL_MIA_DOC_PCT = 0.006;
var DEF_FL_INTANGIBLE_PCT = 0.002;
var DEF_FL_TITLE_PCT = 0.003;
var DEF_MILLAGE = 0.0218;
var DEF_REASSESS_PCT = 0.85;
var DEF_CAP_INCREASE = 0.10;
var DEF_ORIGINATION_PCT = 0.01;
var DEF_NONFL_TRANSFER_TAX_PCT = 0.005;
// ── Helpers ────────────────────────────────────────────────────────────────
function isMiamiDade(county) {
    if (!county)
        return false;
    var c = county.toLowerCase().replace(/[\s-]/g, '');
    return c === 'miamidade' || c === 'dade' || c === '12086';
}
function buildVacancySchedule(holdYears, vacancyY1, vacancyStab) {
    var s = [];
    for (var y = 1; y <= holdYears + 1; y++) {
        s.push(y === 1 ? Math.max(vacancyY1, vacancyStab) : vacancyStab);
    }
    return s;
}
function cumulativeRentGrowth(rentGrowth, holdYears) {
    var cg = [1.0];
    for (var y = 1; y <= holdYears; y++) {
        var rg = y <= rentGrowth.length ? rentGrowth[y - 1] : 0.03;
        cg.push(cg[y - 1] * (1 + rg));
    }
    return cg;
}
function computeFloridaTax(purchasePrice, holdYears, millageRate, capRate, reassessPct) {
    if (millageRate === void 0) { millageRate = DEF_MILLAGE; }
    if (capRate === void 0) { capRate = DEF_CAP_INCREASE; }
    if (reassessPct === void 0) { reassessPct = DEF_REASSESS_PCT; }
    var base = purchasePrice * reassessPct;
    var perYear = [];
    var assessedValues = [];
    for (var y = 1; y <= holdYears + 1; y++) {
        var av = base * Math.pow(1 + capRate, y - 1);
        assessedValues.push(av);
        perYear.push(av * millageRate);
    }
    return { perYear: perYear, assessedValues: assessedValues };
}
function computeNonFloridaTax(baseTax, expenseGrowth, holdYears) {
    var perYear = [];
    var assessedValues = [];
    for (var y = 1; y <= holdYears + 1; y++) {
        perYear.push(baseTax * Math.pow(1 + expenseGrowth, y - 1));
        assessedValues.push(0);
    }
    return { perYear: perYear, assessedValues: assessedValues };
}
function computeAmortization(loanAmount, annualRate, termMonths, amortMonths, ioMonths, holdYears) {
    var monthlyRate = annualRate / 12;
    var nYears = holdYears + 1;
    var monthlyPMT;
    if (amortMonths <= 0) {
        monthlyPMT = loanAmount * monthlyRate;
    }
    else {
        monthlyPMT = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, amortMonths))
            / (Math.pow(1 + monthlyRate, amortMonths) - 1);
    }
    var balance = loanAmount;
    var interestByYear = [];
    var principalByYear = [];
    var debtServiceByYear = [];
    var balanceByYear = [];
    for (var y = 0; y < nYears; y++) {
        var yrInterest = 0;
        var yrPrincipal = 0;
        var yrDS = 0;
        for (var m = 0; m < 12; m++) {
            var monthIdx = y * 12 + m;
            var isIO = monthIdx < ioMonths;
            var monthInterest = balance * monthlyRate;
            yrInterest += monthInterest;
            if (isIO) {
                // Interest-only: no principal
            }
            else if (amortMonths <= 0) {
                // If amort is 0 and we're past IO, use interest-only forever
            }
            else {
                var monthPrincipal = monthlyPMT - monthInterest;
                if (monthPrincipal > balance) {
                    yrPrincipal += balance;
                    balance = 0;
                }
                else {
                    yrPrincipal += monthPrincipal;
                    balance -= monthPrincipal;
                }
            }
            yrDS += isIO ? monthInterest : monthlyPMT;
        }
        interestByYear.push(yrInterest);
        principalByYear.push(yrPrincipal);
        debtServiceByYear.push(yrDS);
        // Balloon at end of term
        if (y + 1 >= Math.ceil(termMonths / 12) && balance > 0) {
            principalByYear[y] += balance;
            debtServiceByYear[y] += balance;
            balance = 0;
        }
        balanceByYear.push(balance);
    }
    return { interestByYear: interestByYear, principalByYear: principalByYear, debtServiceByYear: debtServiceByYear, balanceByYear: balanceByYear };
}
function calculateIRR(cashFlows, maxIter, guess, tol) {
    if (maxIter === void 0) { maxIter = 30; }
    if (guess === void 0) { guess = 0.12; }
    if (tol === void 0) { tol = 1e-10; }
    var r = guess;
    for (var iter = 0; iter < maxIter; iter++) {
        var f = 0;
        var fPrime = 0;
        for (var i = 0; i < cashFlows.length; i++) {
            var denom = Math.pow(1 + r, i);
            f += cashFlows[i] / denom;
            fPrime += (-i * cashFlows[i]) / Math.pow(1 + r, i + 1);
        }
        if (Math.abs(fPrime) < 1e-15)
            return null;
        var rNext = r - f / fPrime;
        if (Math.abs(rNext - r) < tol)
            return rNext;
        r = rNext;
    }
    return null;
}
function calculateEM(cashFlows) {
    // EM = sum of POSITIVE cash flows / |initial outlay|
    // Per spec: do NOT include the negative initial outlay
    var equity = Math.abs(cashFlows[0]);
    if (equity <= 0)
        return 0;
    var sum = 0;
    for (var i = 1; i < cashFlows.length; i++) {
        sum += Math.max(0, cashFlows[i]);
    }
    return sum / equity;
}
function calculateAvgCoC(equity, operatingCFs) {
    if (equity <= 0 || operatingCFs.length === 0)
        return null;
    var meanCF = operatingCFs.reduce(function (s, v) { return s + v; }, 0) / operatingCFs.length;
    return meanCF / equity;
}
// ── Single-year operating computation ──────────────────────────────────────
function computeYearOperating(y, a, cumGrowthVal, vacancySched, taxYear, expenseGrowthCum) {
    var GPR = a.units * a.marketRent * 12 * cumGrowthVal;
    var loss = GPR * a.lossToLease;
    var vac = GPR * vacancySched[y - 1];
    var conc = GPR * a.concessions;
    var bd = GPR * a.badDebt;
    var baseRev = GPR - loss - vac - conc - bd;
    var othInc = a.otherIncomePerUnit * a.units * expenseGrowthCum;
    var EGR = baseRev + othInc;
    var payroll = a.payrollPerUnit * a.units * expenseGrowthCum;
    var maint = a.maintenancePerUnit * a.units * expenseGrowthCum;
    var contract = a.contractServicesPerUnit * a.units * expenseGrowthCum;
    var mktg = a.marketingPerUnit * a.units * expenseGrowthCum;
    var util = a.utilitiesPerUnit * a.units * expenseGrowthCum;
    var admin = a.adminPerUnit * a.units * expenseGrowthCum;
    var ins = a.insurancePerUnit * a.units * expenseGrowthCum;
    var mgmt = EGR * a.managementFee;
    var reserves = a.replacementReserves * a.units * expenseGrowthCum;
    var totalExp = payroll + maint + contract + mktg + util + admin + ins + taxYear + mgmt + reserves;
    var NOI = EGR - totalExp;
    return {
        grossPotentialRent: GPR,
        lossToLease: loss,
        vacancy: vac,
        concessions: conc,
        badDebt: bd,
        baseRevenue: baseRev,
        otherIncome: othInc,
        effectiveGrossIncome: EGR,
        payroll: payroll,
        maintenance: maint,
        contractServices: contract,
        marketing: mktg,
        utilities: util,
        admin: admin,
        insurance: ins,
        propertyTax: taxYear,
        managementFee: mgmt,
        replacementReserves: reserves,
        totalExpenses: totalExp,
        noi: NOI,
        occupancy: 1 - vacancySched[y - 1],
    };
}
// ── Waterfall (IRR-hurdle-based) — per spec §3.12 ─────────────────────────
/**
 * Binary-search for the LP cash flow increment that brings LP's running IRR
 * to `hurdleRate`.
 *
 * @param hurdleRate  Target LP IRR (0 for ROC, preferredReturn for pref, etc.)
 * @param lpCFBase    LP cash flow history up to (but not including) this year:
 *                    [-lpEquity, dist_Y1, ..., dist_Y{y-1}]
 * @param lpAlreadyThisYear  LP already allocated this year from earlier tiers
 * @param maxLPAmount Maximum LP dollars available from this tier (residual × lpSplit)
 * @param tol         Bisection tolerance (default 1e-4 = 0.01%)
 * @returns           LP allocation from this tier in this year
 */
function bisectDistribution(hurdleRate, lpCFBase, lpAlreadyThisYear, maxLPAmount, tol) {
    if (tol === void 0) { tol = 1e-4; }
    if (!isFinite(hurdleRate))
        return maxLPAmount; // catch-all tier: take everything
    if (maxLPAmount <= 0)
        return 0;
    var cfWith0 = __spreadArray(__spreadArray([], lpCFBase, true), [lpAlreadyThisYear], false);
    var irrWith0 = calculateIRR(cfWith0);
    // If running IRR is already at or above hurdle with 0 additional → this tier is exhausted
    if (irrWith0 !== null && irrWith0 >= hurdleRate - tol * 0.1)
        return 0;
    var cfWithMax = __spreadArray(__spreadArray([], lpCFBase, true), [lpAlreadyThisYear + maxLPAmount], false);
    var irrWithMax = calculateIRR(cfWithMax);
    // If even max LP allocation doesn't bring IRR to hurdle → take everything
    if (irrWithMax === null || irrWithMax < hurdleRate - tol * 0.1)
        return maxLPAmount;
    // Bisect: find X ∈ [0, maxLPAmount] s.t. IRR(lpCFBase + [lpAlreadyThisYear + X]) ≈ hurdleRate
    var lo = 0;
    var hi = maxLPAmount;
    for (var iter = 0; iter < 64; iter++) {
        if (hi - lo < tol)
            break;
        var mid = (lo + hi) / 2;
        var cfMid = __spreadArray(__spreadArray([], lpCFBase, true), [lpAlreadyThisYear + mid], false);
        var irrMid = calculateIRR(cfMid);
        if (irrMid === null || irrMid < hurdleRate) {
            lo = mid;
        }
        else {
            hi = mid;
        }
    }
    return (lo + hi) / 2;
}
/**
 * IRR-hurdle waterfall per spec §3.12.
 *
 * Each year's cfads (and the exit equityProceeds) flows through 5 tiers in order:
 *   T1 ROC           – pro-rata until LP and GP have each received their invested capital back
 *   T2 Pref          – LP gets 100% until LP running IRR reaches preferredReturn (GP gets 0)
 *   T3 Promote 1     – (1-promoteSplits[0])/promoteSplits[0] until LP IRR = promoteTiers[0]
 *   T4 Promote 2     – (1-promoteSplits[1])/promoteSplits[1] until LP IRR = promoteTiers[1]
 *   T5 Final Promote – remainder at (1-promoteSplits[2])/promoteSplits[2] (no upper bound)
 *
 * Returns tier breakdown + aggregate LP/GP CF vectors for summary IRR/EM calculation.
 */
function computeWaterfall(annualRows, lpEquity, gpEquity, totalEquity, preferredReturn, holdYears, promoteTiers, promoteSplits, equityProceeds, opts) {
    var _a, _b;
    var lpPct = totalEquity > 0 ? lpEquity / totalEquity : 0;
    var gpPct = totalEquity > 0 ? gpEquity / totalEquity : 0;
    // Tier definitions per spec §3.12
    var tierDefs = [
        { tierName: 'Return of Capital', hurdleRate: 0, lpSplit: lpPct, gpSplit: gpPct },
        // T2 Preferred Return: LP receives 100% of cash flow until running LP IRR
        // reaches `preferredReturn`.  Pref compounding is represented implicitly:
        // distributions in earlier years reduce LP's running IRR deficit, so later
        // years require correspondingly more cash to push LP IRR to the hurdle.
        // This is economically equivalent to an explicit accruing unpaid-pref ledger
        // for standard (non-PIK) waterfalls.
        { tierName: 'Preferred Return', hurdleRate: preferredReturn, lpSplit: 1.0, gpSplit: 0.0 },
        { tierName: 'Promote Tier 1', hurdleRate: promoteTiers[0], lpSplit: 1 - promoteSplits[0], gpSplit: promoteSplits[0] },
        { tierName: 'Promote Tier 2', hurdleRate: promoteTiers[1], lpSplit: 1 - promoteSplits[1], gpSplit: promoteSplits[1] },
        { tierName: 'Promote Tier 3', hurdleRate: Infinity, lpSplit: 1 - promoteSplits[2], gpSplit: promoteSplits[2] },
    ];
    var N_TIERS = tierDefs.length;
    // Cumulative distributions per tier
    var lpDistByTier = new Array(N_TIERS).fill(0);
    var gpDistByTier = new Array(N_TIERS).fill(0);
    // Per-tier LP/GP CF vectors: [-equity, tier_dist_Y1, tier_dist_Y2, ...]
    var lpCFByTier = tierDefs.map(function () { return [-lpEquity]; });
    var gpCFByTier = tierDefs.map(function () { return [-gpEquity]; });
    // Aggregate LP/GP CF running vectors (used for bisection and summary IRR)
    var lpCFRunning = [-lpEquity];
    var gpCFRunning = [-gpEquity];
    // ── Process each operating year then the exit event ──────────────────────
    for (var pass = 0; pass <= holdYears; pass++) {
        var isExit = pass === holdYears;
        // Operating years use annualRows[pass].cfads; exit uses equityProceeds.
        // Preserve the raw signed value — negative years (operating deficits or
        // underwater exits) must flow into LP/GP aggregate CF history so that
        // running IRR is not overstated and hurdle timing is correct.
        var yearCFADS = isExit
            ? (equityProceeds !== null && equityProceeds !== void 0 ? equityProceeds : 0)
            : ((_b = (_a = annualRows[pass]) === null || _a === void 0 ? void 0 : _a.cfads) !== null && _b !== void 0 ? _b : 0);
        var lpThisYear = new Array(N_TIERS).fill(0);
        var gpThisYear = new Array(N_TIERS).fill(0);
        // When CFADS ≤ 0 there is nothing to distribute through tiers.
        // LP/GP still absorb their pro-rata share of the deficit in the
        // aggregate CF vectors so running IRR reflects the loss correctly.
        if (yearCFADS <= 1e-2) {
            lpCFRunning.push(yearCFADS * lpPct);
            gpCFRunning.push(yearCFADS * gpPct);
            for (var t = 0; t < N_TIERS; t++) {
                lpCFByTier[t].push(0);
                gpCFByTier[t].push(0);
            }
            continue;
        }
        var residual = yearCFADS;
        var lpAlreadyThisYear = 0;
        var gpAlreadyThisYear = 0;
        for (var t = 0; t < N_TIERS; t++) {
            if (residual < 1e-2)
                break;
            var _c = tierDefs[t], hurdleRate = _c.hurdleRate, lpSplit = _c.lpSplit, gpSplit = _c.gpSplit;
            var lpAlloc = void 0;
            if (t === 0) {
                // ── T1 ROC: dollar-based (avoids IRR=0% numerical instability) ──────
                var lpROCOwed = Math.max(0, lpEquity - lpDistByTier[0]);
                var gpROCOwed = Math.max(0, gpEquity - gpDistByTier[0]);
                var rocOwed = lpROCOwed + gpROCOwed;
                if (rocOwed <= 1e-2)
                    continue; // ROC fully returned, skip tier
                var t1Consumed = Math.min(residual, rocOwed);
                // Distribute proportionally to what each class is still owed
                lpAlloc = t1Consumed * (rocOwed > 0 ? lpROCOwed / rocOwed : lpPct);
                var gpAlloc_1 = t1Consumed * (rocOwed > 0 ? gpROCOwed / rocOwed : gpPct);
                lpThisYear[t] = lpAlloc;
                gpThisYear[t] = gpAlloc_1;
                lpDistByTier[t] += lpAlloc;
                gpDistByTier[t] += gpAlloc_1;
                lpAlreadyThisYear += lpAlloc;
                gpAlreadyThisYear += gpAlloc_1;
                residual -= t1Consumed;
                continue;
            }
            // ── T2–T5: IRR-hurdle bisection ──────────────────────────────────────
            if (lpSplit < 1e-10) {
                // LP gets nothing in this tier (degenerate), give all to GP
                lpAlloc = 0;
            }
            else {
                var maxLP = residual * lpSplit;
                lpAlloc = bisectDistribution(hurdleRate, lpCFRunning, lpAlreadyThisYear, maxLP);
            }
            var totalConsumed = lpSplit > 1e-10 ? lpAlloc / lpSplit : residual;
            var gpAlloc = totalConsumed * gpSplit;
            lpThisYear[t] = lpAlloc;
            gpThisYear[t] = gpAlloc;
            lpDistByTier[t] += lpAlloc;
            gpDistByTier[t] += gpAlloc;
            lpAlreadyThisYear += lpAlloc;
            gpAlreadyThisYear += gpAlloc;
            residual -= totalConsumed;
        }
        // Append this year's totals to aggregate running vectors
        lpCFRunning.push(lpAlreadyThisYear);
        gpCFRunning.push(gpAlreadyThisYear);
        // Append per-tier distributions
        for (var t = 0; t < N_TIERS; t++) {
            lpCFByTier[t].push(lpThisYear[t]);
            gpCFByTier[t].push(gpThisYear[t]);
        }
    }
    // ── Build tier result objects ─────────────────────────────────────────────
    var tiers = tierDefs.map(function (td, t) {
        var lpIrr = (opts === null || opts === void 0 ? void 0 : opts.skipPerTierIRR) ? null : calculateIRR(lpCFByTier[t]);
        var gpIrr = (opts === null || opts === void 0 ? void 0 : opts.skipPerTierIRR) ? null : calculateIRR(gpCFByTier[t]);
        var lpEquityMultiple = calculateEM(lpCFByTier[t]);
        var gpEquityMultiple = calculateEM(gpCFByTier[t]);
        return {
            tier: t + 1,
            tierName: td.tierName,
            hurdleRate: isFinite(td.hurdleRate) ? td.hurdleRate : promoteTiers[2],
            lpSplit: td.lpSplit,
            gpSplit: td.gpSplit,
            lpDistribution: lpDistByTier[t],
            gpDistribution: gpDistByTier[t],
            promotePctEarned: Math.max(0, td.gpSplit - gpPct),
            lpIrr: lpIrr,
            gpIrr: gpIrr,
            lpEquityMultiple: lpEquityMultiple,
            gpEquityMultiple: gpEquityMultiple,
        };
    });
    return { tiers: tiers, lpCFAggregate: lpCFRunning, gpCFAggregate: gpCFRunning };
}
// ── Sensitivity Matrix ─────────────────────────────────────────────────────
function computeSensitivityMatrix(base) {
    var exitCapAxis = [
        base.exitCap - 0.01,
        base.exitCap - 0.005,
        base.exitCap,
        base.exitCap + 0.005,
        base.exitCap + 0.01,
    ];
    var rentGrowthAxis = [
        base.rentGrowth[0] - 0.01,
        base.rentGrowth[0] - 0.005,
        base.rentGrowth[0],
        base.rentGrowth[0] + 0.005,
        base.rentGrowth[0] + 0.01,
        base.rentGrowth[0] + 0.015,
    ];
    var irrGrid = [];
    var emGrid = [];
    for (var ei = 0; ei < exitCapAxis.length; ei++) {
        irrGrid[ei] = [];
        emGrid[ei] = [];
        var _loop_1 = function (ri) {
            var rcScale = rentGrowthAxis[ri] / base.rentGrowth[0];
            var adjusted = __assign(__assign({}, base), { exitCap: exitCapAxis[ei], rentGrowth: base.rentGrowth.map(function (r) { return r * (isFinite(rcScale) ? rcScale : 1); }) });
            var result = runModel(adjusted, { skipSensitivity: true });
            irrGrid[ei][ri] = result.summary.irr;
            emGrid[ei][ri] = result.summary.equityMultiple;
        };
        for (var ri = 0; ri < rentGrowthAxis.length; ri++) {
            _loop_1(ri);
        }
    }
    return { exitCapAxis: exitCapAxis, rentGrowthAxis: rentGrowthAxis, irrGrid: irrGrid, emGrid: emGrid };
}
// ── Integrity Checks ──────────────────────────────────────────────────────
function runIntegrityChecks(a, result) {
    var _a;
    var checks = [];
    var cf = result.annualCashFlow;
    var hold = a.holdYears;
    // Operating rows: years 1..hold (index 0..hold-1); forward NOI year at index hold is excluded
    var opRows = cf.slice(0, hold);
    var disp = result.disposition;
    var sum = result.summary;
    // ── Hard Invariants (spec §6.1) ───────────────────────────────────────────
    // INV-1: NOI(y) = EGR(y) − totalOpex(y)  for all operating rows
    for (var _i = 0, opRows_1 = opRows; _i < opRows_1.length; _i++) {
        var row = opRows_1[_i];
        var expected = row.effectiveGrossIncome - row.totalExpenses;
        if (Math.abs(row.noi - expected) > 0.01) {
            checks.push({ id: 'INV-1', status: 'error', message: "INV-1 NOI mismatch Y".concat(row.year, ": got ").concat(row.noi.toFixed(2), ", expected ").concat(expected.toFixed(2)) });
            break; // report first violation only
        }
    }
    // INV-2: CF(y) = NOI(y) − debtService(y)  for all operating rows
    for (var _b = 0, opRows_2 = opRows; _b < opRows_2.length; _b++) {
        var row = opRows_2[_b];
        var expected = row.noi - row.debtService;
        if (Math.abs(row.cfads - expected) > 0.01) {
            checks.push({ id: 'INV-2', status: 'error', message: "INV-2 CF mismatch Y".concat(row.year, ": got ").concat(row.cfads.toFixed(2), ", expected ").concat(expected.toFixed(2)) });
            break;
        }
    }
    // INV-3: DSCR(y) == NOI(y) / debtService(y) for all y where debtService > 0; fail-closed on null/non-finite
    for (var _c = 0, opRows_3 = opRows; _c < opRows_3.length; _c++) {
        var row = opRows_3[_c];
        if (row.debtService > 0.01) {
            if (row.dscr === null || !isFinite(row.dscr)) {
                checks.push({ id: 'INV-3', status: 'error', message: "INV-3 DSCR is null/non-finite Y".concat(row.year, " with debtService ").concat(row.debtService.toFixed(0)) });
                break;
            }
            var expected = row.noi / row.debtService;
            if (Math.abs(row.dscr - expected) > 0.001) {
                checks.push({ id: 'INV-3', status: 'error', message: "INV-3 DSCR mismatch Y".concat(row.year, ": got ").concat(row.dscr.toFixed(4), ", expected ").concat(expected.toFixed(4)) });
                break;
            }
        }
    }
    // INV-4: equityProceeds = netSaleProceeds − loanBalanceAtExit
    {
        var expected = disp.netSaleProceeds - disp.loanBalance;
        if (Math.abs(disp.equityProceeds - expected) > 1) {
            checks.push({ id: 'INV-4', status: 'error', message: "INV-4 equityProceeds ".concat(disp.equityProceeds.toFixed(0), " \u2260 netSaleProceeds \u2212 loanBal (").concat(expected.toFixed(0), ")") });
        }
    }
    // INV-5: grossSalePrice ≈ stabilizedNOI / exitCap  (within 0.1%)
    // Fail-closed: if exitCap or stabilizedNOI are non-positive the formula cannot be
    // evaluated — treat that as a hard failure so no INV is silently skipped.
    if (a.exitCap > 0 && disp.stabilizedNOI > 0) {
        var expected = disp.stabilizedNOI / a.exitCap;
        var relErr = Math.abs(disp.grossSalePrice - expected) / expected;
        if (relErr > 0.001) {
            checks.push({ id: 'INV-5', status: 'error', message: "INV-5 grossSalePrice ".concat(disp.grossSalePrice.toFixed(0), " \u2260 stabilizedNOI/exitCap (").concat(expected.toFixed(0), ", err=").concat((relErr * 100).toFixed(3), "%)") });
        }
    }
    else {
        checks.push({ id: 'INV-5', status: 'error', message: "INV-5 cannot verify grossSalePrice: exitCap (".concat(a.exitCap, ") or stabilizedNOI (").concat((_a = disp.stabilizedNOI) === null || _a === void 0 ? void 0 : _a.toFixed(0), ") is zero/non-positive") });
    }
    // INV-6: totalEquity == totalAcquisitionCost − loanAmount  (strict; $1 rounding tolerance)
    // Equity + debt must equal totalAcqCost exactly.  Loose tolerances mask structural
    // model defects; test fixtures must be set up with correct equity values.
    {
        var totalAcqCost = result.capital.metrics.totalCost;
        var expected = totalAcqCost - a.loanAmount;
        if (Math.abs(sum.totalEquity - expected) > 1) {
            var diff = sum.totalEquity - expected;
            checks.push({ id: 'INV-6', status: 'error', message: "INV-6 totalEquity ".concat(sum.totalEquity.toFixed(0), " \u2260 totalAcqCost (").concat(totalAcqCost.toFixed(0), ") \u2212 loanAmount (").concat(a.loanAmount.toFixed(0), ") = ").concat(expected.toFixed(0), " (diff ").concat(diff.toFixed(0), ")") });
        }
    }
    // INV-7: initial equity outlay must be positive (cashFlows[0] < 0)
    if (sum.totalEquity <= 0) {
        checks.push({ id: 'INV-7', status: 'error', message: "INV-7 Total equity ".concat(sum.totalEquity.toFixed(0), " \u2264 0") });
    }
    // INV-8: waterfall conservation — Σ tier_distributions == Σ max(0,cfads[y]) + max(0,equityProceeds)
    // Waterfall engine skips negative-CFBT periods (line ~661: `if yearCFADS<=1e-2 continue`).
    // Fail-closed: empty pool (availCash≤0) must also have zero distributions.
    {
        var totalTierDist = result.waterfallDistributions.reduce(function (s, t) { return s + t.lpDistribution + t.gpDistribution; }, 0);
        var posOpCFs = opRows.reduce(function (s, r) { return s + Math.max(0, r.cfads); }, 0);
        var availCash = posOpCFs + Math.max(0, disp.equityProceeds);
        if (availCash <= 1) {
            if (totalTierDist > 1) {
                checks.push({ id: 'INV-8', status: 'error', message: "INV-8 Waterfall distributed ".concat(totalTierDist.toFixed(0), " from empty pool (availCash=").concat(availCash.toFixed(0), ")") });
            }
        }
        else {
            var relErr = Math.abs(totalTierDist - availCash) / availCash;
            if (relErr > 0.001) {
                checks.push({ id: 'INV-8', status: 'error', message: "INV-8 Waterfall imbalance: distributed ".concat(totalTierDist.toFixed(0), " \u2260 \u03A3max(0,cfads)+max(0,equityProceeds) ").concat(availCash.toFixed(0), " (").concat((relErr * 100).toFixed(3), "% error)") });
            }
        }
    }
    // INV-9: lossToLease$ + vacancy$ + concessions$ + badDebt$ < GPR every year
    for (var _d = 0, opRows_4 = opRows; _d < opRows_4.length; _d++) {
        var row = opRows_4[_d];
        var losses = row.lossToLease + row.vacancy + row.concessions + row.badDebt;
        if (losses >= row.grossPotentialRent - 0.01) {
            checks.push({ id: 'INV-9', status: 'error', message: "INV-9 Losses Y".concat(row.year, " (").concat(losses.toFixed(0), ") \u2265 GPR (").concat(row.grossPotentialRent.toFixed(0), ")") });
            break;
        }
    }
    // INV-10: occupancy(y) = 1 − vacancySchedule[y]
    // vacancySchedule[y]: Y1 = max(vacancyY1, vacancyStab), Y2+ = vacancyStab
    for (var _e = 0, opRows_5 = opRows; _e < opRows_5.length; _e++) {
        var row = opRows_5[_e];
        var expectedVacRate = row.year === 1 ? Math.max(a.vacancyY1, a.vacancyStab) : a.vacancyStab;
        var expectedOcc = 1 - expectedVacRate;
        if (Math.abs(row.occupancy - expectedOcc) > 0.0001) {
            checks.push({ id: 'INV-10', status: 'error', message: "INV-10 Occupancy Y".concat(row.year, ": got ").concat(row.occupancy.toFixed(4), ", expected ").concat(expectedOcc.toFixed(4)) });
            break;
        }
    }
    // ── Soft Checks (spec §6.2) ───────────────────────────────────────────────
    // SOFT-1: Any year DSCR < 1.20 → TIGHT_DSCR warn
    var tightDscrRow = opRows.find(function (r) { return r.dscr !== null && r.dscr < 1.20; });
    if (tightDscrRow) {
        checks.push({ id: 'TIGHT_DSCR', status: 'warn', message: "Y".concat(tightDscrRow.year, " DSCR ").concat(tightDscrRow.dscr.toFixed(2), " < 1.20") });
    }
    // SOFT-2: Any year DSCR < 1.10 → DSCR_BREACH error
    var breachDscrRow = opRows.find(function (r) { return r.dscr !== null && r.dscr < 1.10; });
    if (breachDscrRow) {
        checks.push({ id: 'DSCR_BREACH', status: 'error', message: "Y".concat(breachDscrRow.year, " DSCR ").concat(breachDscrRow.dscr.toFixed(2), " < 1.10 \u2014 covenant breach threshold") });
    }
    // SOFT-3: stabilized vacancy < 5% structural floor → AGGRESSIVE_VACANCY warn
    if (a.vacancyStab < 0.05) {
        checks.push({ id: 'AGGRESSIVE_VACANCY', status: 'warn', message: "Stabilized vacancy ".concat((a.vacancyStab * 100).toFixed(1), "% below 5% structural floor") });
    }
    // SOFT-4: rentGrowth Y1 > 6% → AGGRESSIVE_RENT_GROWTH warn
    if (a.rentGrowth.length > 0 && a.rentGrowth[0] > 0.06) {
        checks.push({ id: 'AGGRESSIVE_RENT_GROWTH', status: 'warn', message: "Y1 rent growth ".concat((a.rentGrowth[0] * 100).toFixed(1), "% > 6%") });
    }
    // SOFT-5: exitCap < goingInCap by > 50bps → CAP_RATE_COMPRESSION warn
    var goingInCap = sum.goingInCapRate;
    if (goingInCap > 0 && a.exitCap < goingInCap - 0.005) {
        checks.push({ id: 'CAP_RATE_COMPRESSION', status: 'warn', message: "Exit cap ".concat((a.exitCap * 100).toFixed(2), "% is >50bps below going-in cap ").concat((goingInCap * 100).toFixed(2), "%") });
    }
    // SOFT-6: IRR < 12% → LOW_IRR warn
    if (sum.irr !== null && sum.irr < 0.12) {
        checks.push({ id: 'LOW_IRR', status: 'warn', message: "IRR ".concat((sum.irr * 100).toFixed(1), "% < 12% threshold") });
    }
    // SOFT-7: equityMultiple < 1.5 → LOW_EM warn
    if (sum.equityMultiple !== null && sum.equityMultiple < 1.5) {
        checks.push({ id: 'LOW_EM', status: 'warn', message: "Equity multiple ".concat(sum.equityMultiple.toFixed(2), "\u00D7 < 1.5\u00D7 threshold") });
    }
    // SOFT-8: rent-to-wage proxy at Y5 > 35% → AFFORDABILITY_CEILING warn
    // proxy: (GPR_Y5 / units / 12) / $4,500 area median wage
    var y5Row = opRows[4];
    if (y5Row && a.units > 0) {
        var monthlyRentPerUnit = y5Row.grossPotentialRent / a.units / 12;
        var rentToWage = monthlyRentPerUnit / 4500;
        if (rentToWage > 0.35) {
            checks.push({ id: 'AFFORDABILITY_CEILING', status: 'warn', message: "Y5 rent-to-wage proxy ".concat((rentToWage * 100).toFixed(1), "% > 35% (monthly rent $").concat(monthlyRentPerUnit.toFixed(0), ")") });
        }
    }
    // SOFT-9: Y1 vacancy < 5% structural floor → VACANCY_BELOW_STRUCTURAL warn
    if (a.vacancyY1 < 0.05) {
        checks.push({ id: 'VACANCY_BELOW_STRUCTURAL', status: 'warn', message: "Y1 vacancy assumption ".concat((a.vacancyY1 * 100).toFixed(1), "% below 5% structural floor") });
    }
    // SOFT-10: capexBudget == 0 on a non-development deal → NO_CAPEX_BUDGET_FOR_VALUE_ADD
    var isDevelopment = a.dealType === 'development' || a.dealType === 'ground_up';
    if (a.capexBudget === 0 && !isDevelopment) {
        checks.push({ id: 'NO_CAPEX_BUDGET_FOR_VALUE_ADD', status: 'warn', message: 'No capex budget on a non-development deal — consider value-add allocation' });
    }
    // ── ALL_INVARIANTS gate ───────────────────────────────────────────────────
    // Only passes when all 10 hard INV-* checks are clean (SOFT errors do not block)
    var hasHardInvError = checks.some(function (c) { return c.status === 'error' && c.id.startsWith('INV-'); });
    if (!hasHardInvError) {
        checks.unshift({ id: 'ALL_INVARIANTS', status: 'pass', message: 'All 10 hard invariants pass' });
    }
    return checks;
}
function buildCashFlowVector(totalEquity, annualRows, hold, equityProceeds) {
    var _a, _b;
    // Year 0: equity outlay (negative)
    var cf = [-totalEquity];
    // Years 1..hold: levered operating cash flows only (exclude the forward-NOI year at annualRows[hold])
    for (var i = 0; i < hold; i++) {
        cf.push((_b = (_a = annualRows[i]) === null || _a === void 0 ? void 0 : _a.preTaxCashFlow) !== null && _b !== void 0 ? _b : 0);
    }
    // Exit: add equity proceeds to the final operating year (end of hold period)
    cf[cf.length - 1] += equityProceeds;
    return cf;
}
// ── Main runner ────────────────────────────────────────────────────────────
function runModel(a, opts) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5;
    var log = [];
    var hold = a.holdYears;
    var nYears = hold + 1;
    // ── Phase 1: Derived inputs ─────────────────────────────────────────────
    log.push("Phase 1: Deriving inputs for ".concat(a.dealType, " deal, ").concat(hold, "yr hold, ").concat(a.units, " units"));
    var closingCosts = a.closingCostsPct > 0
        ? a.purchasePrice * a.closingCostsPct
        : a.purchasePrice * DEF_CLOSING_PCT;
    var docStamps = 0;
    var intangibleTax = 0;
    var titleInsurance = 0;
    if (a.isFlorida) {
        var docPct = a.docStampsPct > 0 ? a.docStampsPct : (isMiamiDade(a.county) ? DEF_FL_MIA_DOC_PCT : DEF_FL_DOC_PCT);
        docStamps = a.purchasePrice * docPct;
        var intPct = a.intangibleTaxPct > 0 ? a.intangibleTaxPct : DEF_FL_INTANGIBLE_PCT;
        intangibleTax = a.loanAmount * intPct;
        var titlePct = a.titleInsurancePct > 0 ? a.titleInsurancePct : DEF_FL_TITLE_PCT;
        titleInsurance = a.purchasePrice * titlePct;
        log.push("  FL taxes: docStamps ".concat((docPct * 100).toFixed(2), "% (").concat(docStamps, "), intangible ").concat((intPct * 100).toFixed(2), "% (").concat(intangibleTax, "), title ").concat((titlePct * 100).toFixed(2), "% (").concat(titleInsurance, ")"));
    }
    else {
        docStamps = a.purchasePrice * DEF_NONFL_TRANSFER_TAX_PCT;
        log.push("  Non-FL: combined transaction tax ".concat(DEF_NONFL_TRANSFER_TAX_PCT * 100, "% (").concat(docStamps, ")"));
    }
    var totalEquity = a.lpEquity + a.gpEquity;
    var totalAcqCost = a.purchasePrice + closingCosts + docStamps + intangibleTax + titleInsurance + a.capexBudget;
    log.push("  Total equity: ".concat(totalEquity, ", Total acq cost: ").concat(totalAcqCost));
    // ── Phase 2: Vacancy schedule & rent growth ─────────────────────────────
    var vacancySched = buildVacancySchedule(hold, a.vacancyY1, a.vacancyStab);
    var cumGrowth = cumulativeRentGrowth(a.rentGrowth, hold);
    log.push("Phase 2: Vacancy Y1=".concat((a.vacancyY1 * 100).toFixed(1), "%, Stab=").concat((a.vacancyStab * 100).toFixed(1), "%, Rent growth Y1=").concat((a.rentGrowth[0] * 100).toFixed(1), "%"));
    // ── Phase 3: Tax schedule ───────────────────────────────────────────────
    var taxSchedule;
    if (a.isFlorida) {
        taxSchedule = computeFloridaTax(a.purchasePrice, hold);
        log.push("Phase 3: FL tax schedule (FL non-homestead 10% NHCap, assessed base=".concat(a.purchasePrice * DEF_REASSESS_PCT, ")"));
    }
    else {
        var baseTax = (_a = a.basePropertyTax) !== null && _a !== void 0 ? _a : (a.purchasePrice * 0.012); // ~1.2% of purchase as default
        taxSchedule = computeNonFloridaTax(baseTax, a.expenseGrowth, hold);
        log.push("Phase 3: Non-FL tax schedule, base=".concat(baseTax, ", growth=").concat((a.expenseGrowth * 100).toFixed(1), "%"));
    }
    // ── Phase 3b: Income tax block (spec §11) ───────────────────────────────
    var INCOME_TAX_LAND_PCT = 0.20;
    var INCOME_TAX_DEPR_YEARS = 27.5;
    var INCOME_TAX_BONUS_PCT = 0.20;
    var INCOME_TAX_COST_SEG_PCT = 0.30;
    var INCOME_TAX_MARGINAL = 0.37;
    var incomeTaxDepreciableBase = a.purchasePrice * (1 - INCOME_TAX_LAND_PCT);
    var incomeTaxAnnualDepr = incomeTaxDepreciableBase / INCOME_TAX_DEPR_YEARS;
    var incomeTaxBonusDepr = incomeTaxDepreciableBase * INCOME_TAX_BONUS_PCT; // Y1 bonus
    // ── Phase 4: Amortization schedule ──────────────────────────────────────
    var amort = computeAmortization(a.loanAmount, a.rate, a.term, a.amort, a.ioPeriod, hold);
    var origFee = a.originationFeePct > 0 ? a.loanAmount * a.originationFeePct : a.loanAmount * DEF_ORIGINATION_PCT;
    log.push("Phase 4: Loan ".concat(a.loanAmount, " @ ").concat((a.rate * 100).toFixed(2), "%, ").concat(a.amort, "mo amort, ").concat(a.ioPeriod, "mo IO"));
    // ── Phase 5: Annual cash flows ──────────────────────────────────────────
    log.push("Phase 5: Building ".concat(nYears, " years of cash flows"));
    var annualRows = [];
    for (var y = 1; y <= nYears; y++) {
        var expCum = Math.pow(1 + a.expenseGrowth, y - 1);
        var taxYear = y <= taxSchedule.perYear.length ? taxSchedule.perYear[y - 1] : taxSchedule.perYear[taxSchedule.perYear.length - 1];
        var op = computeYearOperating(y, a, cumGrowth[y - 1], vacancySched, taxYear, expCum);
        var interest = (_b = amort.interestByYear[y - 1]) !== null && _b !== void 0 ? _b : (a.loanAmount * a.rate);
        var principal = (_c = amort.principalByYear[y - 1]) !== null && _c !== void 0 ? _c : 0;
        var debtService = (_d = amort.debtServiceByYear[y - 1]) !== null && _d !== void 0 ? _d : interest;
        var cf = op.noi - debtService;
        var dscr = debtService > 0.01 ? op.noi / debtService : null;
        var dyield = a.loanAmount > 0 ? op.noi / a.loanAmount : null;
        var depreciation = y === 1 ? incomeTaxBonusDepr : incomeTaxAnnualDepr;
        var taxableIncome = op.noi - interest - depreciation;
        var taxPayable = Math.max(0, taxableIncome * INCOME_TAX_MARGINAL);
        annualRows.push(__assign(__assign({ year: y }, op), { annualInterest: interest, annualPrincipal: principal, debtService: debtService, preTaxCashFlow: cf, cfads: cf, dscr: dscr, debtYield: dyield, capRateOnCost: null, isExitYear: y === nYears, depreciation: depreciation, taxableIncome: taxableIncome, taxPayable: taxPayable, afterTaxCashFlow: cf - taxPayable }));
    }
    // ── Phase 6: Disposition ────────────────────────────────────────────────
    var exitRow = annualRows[hold]; // forward NOI = NOI at hold+1 (index = hold)
    var stabilizedNOI = (_e = exitRow === null || exitRow === void 0 ? void 0 : exitRow.noi) !== null && _e !== void 0 ? _e : 0;
    var grossSalePrice = a.exitCap > 0 ? stabilizedNOI / a.exitCap : 0;
    var saleCostsValue = grossSalePrice * a.saleCosts;
    var dispositionDocStamps = a.isFlorida ? grossSalePrice * 0.007 : 0;
    var loanBalance = (_f = amort.balanceByYear[hold - 1]) !== null && _f !== void 0 ? _f : 0;
    var netSaleProceeds = grossSalePrice - saleCostsValue - dispositionDocStamps;
    var equityProceeds = netSaleProceeds - loanBalance;
    log.push("Phase 6: Disposition \u2014 stabilized NOI=".concat(stabilizedNOI, ", exit cap=").concat((a.exitCap * 100).toFixed(1), "%, sale price=").concat(grossSalePrice));
    log.push("  Sale costs=".concat(saleCostsValue, ", loan bal=").concat(loanBalance, ", equity proceeds=").concat(equityProceeds));
    // Fill capRateOnCost now that totalAcqCost is known
    for (var _i = 0, annualRows_1 = annualRows; _i < annualRows_1.length; _i++) {
        var row = annualRows_1[_i];
        row.capRateOnCost = totalAcqCost > 0 ? row.noi / totalAcqCost : null;
    }
    // ── Phase 7: Returns ────────────────────────────────────────────────────
    var cashFlows = buildCashFlowVector(totalEquity, annualRows, hold, equityProceeds);
    var irr = calculateIRR(cashFlows);
    var em = calculateEM(cashFlows);
    var avgCoC = calculateAvgCoC(totalEquity, annualRows.slice(0, hold).map(function (r) { return r.preTaxCashFlow; }));
    var noiY1 = (_h = (_g = annualRows[0]) === null || _g === void 0 ? void 0 : _g.noi) !== null && _h !== void 0 ? _h : 0;
    var goingInCap = a.purchasePrice > 0 ? noiY1 / a.purchasePrice : 0;
    // Unlevered IRR: cash flows ignoring debt service
    var unlevCF = [-totalAcqCost];
    for (var y = 0; y < hold; y++) {
        unlevCF.push((_k = (_j = annualRows[y]) === null || _j === void 0 ? void 0 : _j.noi) !== null && _k !== void 0 ? _k : 0);
    }
    // Terminal: add gross sale proceeds (before selling costs and transfer taxes) at exit
    unlevCF[unlevCF.length - 1] += grossSalePrice - saleCostsValue;
    var unleveredIrr = calculateIRR(unlevCF);
    log.push("Phase 7: IRR=".concat(irr !== null ? (irr * 100).toFixed(2) : "null", "%, EM=").concat(em !== null ? em.toFixed(2) : "null", ", UnlevIRR=").concat(unleveredIrr !== null ? (unleveredIrr * 100).toFixed(2) : "null", "%, Avg CoC=").concat(avgCoC !== null ? (avgCoC * 100).toFixed(2) : "null", "%"));
    // Phase 8: Waterfall
    log.push("Phase 8: Computing waterfall");
    var waterfallResult = computeWaterfall(annualRows, a.lpEquity, a.gpEquity, totalEquity, a.preferredReturn, hold, a.promoteTiers, a.promoteSplits, equityProceeds, { skipPerTierIRR: opts === null || opts === void 0 ? void 0 : opts.skipSensitivity });
    var waterfall = waterfallResult.tiers;
    var lpIrrAggregate = calculateIRR(waterfallResult.lpCFAggregate);
    var gpIrrAggregate = calculateIRR(waterfallResult.gpCFAggregate);
    var lpEMAggregate = calculateEM(waterfallResult.lpCFAggregate);
    var gpEMAggregate = calculateEM(waterfallResult.gpCFAggregate);
    // ── Waterfall-derived summary metrics ────────────────────────────────────
    var lpTotalDistributions = waterfall.reduce(function (s, t) { return s + t.lpDistribution; }, 0);
    var gpTotalDistributions = waterfall.reduce(function (s, t) { return s + t.gpDistribution; }, 0);
    var lpProfit = lpTotalDistributions - a.lpEquity;
    var gpProfit = gpTotalDistributions - a.gpEquity;
    // Promote earned = GP distributions from promote tiers (tiers 3-5, indices 2-4)
    var gpPromoteEarned = waterfall.slice(2).reduce(function (s, t) { return s + t.gpDistribution; }, 0);
    var totalProfit = lpProfit + gpProfit;
    // LP/GP cash-on-cash: avg annual operating dist / initial equity
    var lpOpDists = annualRows.slice(0, hold).map(function (r) { return r.preTaxCashFlow * (a.lpEquity / totalEquity); });
    var gpOpDists = annualRows.slice(0, hold).map(function (r) { return r.preTaxCashFlow * (a.gpEquity / totalEquity); });
    var lpCoC = a.lpEquity > 0 && lpOpDists.length > 0
        ? lpOpDists.reduce(function (s, v) { return s + v; }, 0) / lpOpDists.length / a.lpEquity
        : null;
    var gpCoC = a.gpEquity > 0 && gpOpDists.length > 0
        ? gpOpDists.reduce(function (s, v) { return s + v; }, 0) / gpOpDists.length / a.gpEquity
        : null;
    // ── Yield-on-Cost ─────────────────────────────────────────────────────────
    var yieldOnCostUntrended = totalAcqCost > 0 ? noiY1 / totalAcqCost : 0;
    var yieldOnCostTrended = totalAcqCost > 0 ? stabilizedNOI / totalAcqCost : 0;
    // ── Stabilized cap rate ───────────────────────────────────────────────────
    var stabilizedCapRate = a.purchasePrice > 0 ? stabilizedNOI / a.purchasePrice : null;
    // ── Debt metrics block ───────────────────────────────────────────────────
    var opRows = annualRows.slice(0, hold);
    var dscrValues = opRows.map(function (r) { return r.dscr; }).filter(function (d) { return d !== null; });
    var dscrMin = dscrValues.length > 0 ? Math.min.apply(Math, dscrValues) : null;
    var dscrAvg = dscrValues.length > 0 ? dscrValues.reduce(function (s, v) { return s + v; }, 0) / dscrValues.length : null;
    var dscrY1 = (_m = (_l = annualRows[0]) === null || _l === void 0 ? void 0 : _l.dscr) !== null && _m !== void 0 ? _m : null;
    // Stabilization year = first year vacancy reaches vacancyStab (Y2 when Y1 is higher, else Y1)
    var stabRowIdx = a.vacancyY1 > a.vacancyStab ? 1 : 0;
    var dscrAtStabilization = (_p = (_o = annualRows[stabRowIdx]) === null || _o === void 0 ? void 0 : _o.dscr) !== null && _p !== void 0 ? _p : dscrY1;
    var debtYieldValues = opRows.map(function (r) { return r.debtYield; }).filter(function (d) { return d !== null; });
    var debtYieldMin = debtYieldValues.length > 0 ? Math.min.apply(Math, debtYieldValues) : null;
    var debtYieldY1 = (_r = (_q = annualRows[0]) === null || _q === void 0 ? void 0 : _q.debtYield) !== null && _r !== void 0 ? _r : null;
    // Break-even occupancy: occupancy at which NOI covers debt service for Y1
    // NOI = GPR * occ * (1 - mgmtFee) - fixedExp (approx)
    var breakEvenOccupancy = null;
    if (annualRows[0]) {
        var r0 = annualRows[0];
        var gpr = r0.grossPotentialRent;
        var ds0 = r0.debtService;
        // Fixed expenses = total − management fee (which scales with EGI)
        var fixedExp = r0.totalExpenses - r0.managementFee;
        // NOI ≈ GPR * occ * (1 − mgmtFee) − fixedExp = DS  → occ = (DS + fixedExp) / (GPR * (1 − mgmtFee))
        var mgmtFrac = r0.effectiveGrossIncome > 0 ? r0.managementFee / r0.effectiveGrossIncome : a.managementFee;
        var denom = gpr * (1 - mgmtFrac);
        breakEvenOccupancy = denom > 0 ? Math.min(1, (ds0 + fixedExp) / denom) : null;
    }
    // DSCR at −10% NOI stress
    var dscrStressed = dscrY1 !== null && annualRows[0]
        ? (annualRows[0].debtService > 0 ? (annualRows[0].noi * 0.9) / annualRows[0].debtService : null)
        : null;
    var positiveLeverage = goingInCap > a.rate;
    var spreadBps = Math.round((goingInCap - a.rate) * 10000);
    var ltvAtMaturity = grossSalePrice > 0 ? loanBalance / grossSalePrice : a.ltv;
    var debtMetrics = {
        coverage: {
            dscrMin: dscrMin,
            dscrAvg: dscrAvg,
            dscrY1: dscrY1,
            dscrAtStabilization: dscrAtStabilization,
            debtYieldMin: debtYieldMin,
            debtYieldY1: debtYieldY1,
            breakEvenOccupancy: breakEvenOccupancy,
            dscrStressedMinus10PctNOI: dscrStressed,
        },
        structural: {
            loanAmount: a.loanAmount,
            rate: a.rate,
            termMonths: a.term,
            amortMonths: a.amort,
            ioPeriodMonths: a.ioPeriod,
            originationFee: origFee,
            loanType: a.term <= 84 ? 'bridge' : 'perm', // ≤7yr term = bridge
        },
        leverage: {
            ltvAtClose: a.ltv,
            ltvAtMaturity: ltvAtMaturity,
            positiveLeverage: positiveLeverage,
            spreadOverCapRateBps: spreadBps,
        },
        stress: {
            dscrAt10PctNOIDecline: dscrStressed,
            breakEvenOccupancy: breakEvenOccupancy,
        },
    };
    // ── Valuation block ──────────────────────────────────────────────────────
    var gprY1 = (_t = (_s = annualRows[0]) === null || _s === void 0 ? void 0 : _s.grossPotentialRent) !== null && _t !== void 0 ? _t : 0;
    var valuation = {
        perUnit: {
            goingIn: a.units > 0 ? a.purchasePrice / a.units : 0,
            atExit: a.units > 0 ? grossSalePrice / a.units : 0,
        },
        perSF: {
            netRentable: (a.units > 0 && a.avgUnitSf > 0) ? a.purchasePrice / (a.units * a.avgUnitSf) : 0,
        },
        multiples: {
            grm: gprY1 > 0 ? a.purchasePrice / gprY1 : null,
            nim: noiY1 > 0 ? a.purchasePrice / noiY1 : null,
            opexRatio: ((_v = (_u = annualRows[0]) === null || _u === void 0 ? void 0 : _u.effectiveGrossIncome) !== null && _v !== void 0 ? _v : 0) > 0
                ? ((_x = (_w = annualRows[0]) === null || _w === void 0 ? void 0 : _w.totalExpenses) !== null && _x !== void 0 ? _x : 0) / ((_z = (_y = annualRows[0]) === null || _y === void 0 ? void 0 : _y.effectiveGrossIncome) !== null && _z !== void 0 ? _z : 1)
                : null,
            capRate: goingInCap,
            yieldOnCost: totalAcqCost > 0 ? noiY1 / totalAcqCost : null,
        },
    };
    // Phase 9: Sensitivity (skipped in sub-runs to prevent recursion)
    log.push("Phase 9: Computing sensitivity matrix");
    var sensitivity = (opts === null || opts === void 0 ? void 0 : opts.skipSensitivity)
        ? { exitCapAxis: [], rentGrowthAxis: [], irrGrid: [], emGrid: [] }
        : computeSensitivityMatrix(a);
    // Phase 10: Stress scenarios (skipped in sub-runs to prevent recursion)
    log.push("Phase 10: Computing stress scenarios");
    var stressScenarios = [
        { scenario: 'base', irr: irr, equityMultiple: em, cashOnCash: avgCoC },
        { scenario: 'bear', irr: null, equityMultiple: null, cashOnCash: null },
        { scenario: 'bull', irr: null, equityMultiple: null, cashOnCash: null },
        { scenario: 'black_swan', irr: null, equityMultiple: null, cashOnCash: null },
    ];
    if (!(opts === null || opts === void 0 ? void 0 : opts.skipSensitivity)) {
        var stressConfigs = [
            { scenario: 'bear', rgDelta: -0.015, vacDelta: 0.02, ecDelta: 0.0075, egDelta: 0.01 },
            { scenario: 'bull', rgDelta: 0.0075, vacDelta: -0.005, ecDelta: -0.005, egDelta: -0.005 },
            { scenario: 'black_swan', rgDelta: a.rentGrowth[0] > 0.005 ? -(a.rentGrowth[0] - 0.005) : -0.01, vacDelta: 0.05, ecDelta: 0.015, egDelta: 0.025 },
        ];
        var _loop_2 = function (sc) {
            var stressed = __assign(__assign({}, a), { rentGrowth: a.rentGrowth.map(function (r) { return Math.max(0, r + sc.rgDelta); }), vacancyY1: Math.min(1, Math.max(0, a.vacancyY1 + sc.vacDelta)), vacancyStab: Math.min(1, Math.max(0.05, a.vacancyStab + sc.vacDelta)), exitCap: a.exitCap + sc.ecDelta, expenseGrowth: Math.max(0, a.expenseGrowth + sc.egDelta) });
            var sr = runModel(stressed, { skipSensitivity: true });
            var s = stressScenarios.find(function (s) { return s.scenario === sc.scenario; });
            if (s) {
                s.irr = sr.summary.irr;
                s.equityMultiple = sr.summary.equityMultiple;
                s.cashOnCash = sr.summary.avgCoC;
            }
        };
        for (var _6 = 0, stressConfigs_1 = stressConfigs; _6 < stressConfigs_1.length; _6++) {
            var sc = stressConfigs_1[_6];
            _loop_2(sc);
        }
    }
    // ── Phase 11: Assemble result ─────────────────────────────────────────────
    log.push("Phase 11: Running integrity checks");
    var totalSources = a.lpEquity + a.gpEquity + a.loanAmount;
    var totalUses = a.purchasePrice + closingCosts + docStamps + intangibleTax + titleInsurance + origFee + a.capexBudget;
    var debtYieldByYear = annualRows.map(function (r) { return a.loanAmount > 0 ? r.noi / a.loanAmount : 0; });
    var modelResult = {
        summary: {
            purchasePrice: a.purchasePrice,
            loanAmount: a.loanAmount,
            totalEquity: totalEquity,
            noiYear1: noiY1,
            goingInCapRate: goingInCap,
            exitCapRate: a.exitCap,
            irr: irr,
            equityMultiple: em,
            avgCoC: avgCoC,
            lpIrr: lpIrrAggregate,
            gpIrr: gpIrrAggregate,
            lpEquityMultiple: lpEMAggregate,
            gpEquityMultiple: gpEMAggregate,
            loanBalanceAtExit: loanBalance,
            cashOnCashByYear: annualRows.slice(0, hold).map(function (r) { return totalEquity > 0 ? r.preTaxCashFlow / totalEquity : 0; }),
            dscrByYear: annualRows.slice(0, hold).map(function (r) { var _a; return (_a = r.dscr) !== null && _a !== void 0 ? _a : 0; }),
            noiByYear: annualRows.slice(0, hold).map(function (r) { return r.noi; }),
            egiByYear: annualRows.slice(0, hold).map(function (r) { return r.effectiveGrossIncome; }),
            debtServiceCoverageByYear: annualRows.slice(0, hold).map(function (r) { var _a; return (_a = r.dscr) !== null && _a !== void 0 ? _a : 0; }),
            debtYieldByYear: annualRows.slice(0, hold).map(function (r) { var _a; return (_a = r.debtYield) !== null && _a !== void 0 ? _a : 0; }),
            stabilizedCapRate: stabilizedCapRate,
            unleveredIrr: unleveredIrr,
            yieldOnCost: { untrended: yieldOnCostUntrended, trended: yieldOnCostTrended },
            totalProfit: totalProfit,
            lpCoC: lpCoC,
            gpCoC: gpCoC,
            lpTotalDistributions: lpTotalDistributions,
            lpProfit: lpProfit,
            gpTotalDistributions: gpTotalDistributions,
            gpPromoteEarned: gpPromoteEarned,
        },
        annualCashFlow: annualRows,
        sourcesAndUses: {
            sources: [
                { id: 'equity-lp', label: 'Equity (LP)', amount: a.lpEquity, pct: totalSources > 0 ? a.lpEquity / totalSources : 0, source: 'equity' },
                { id: 'equity-gp', label: 'Equity (GP)', amount: a.gpEquity, pct: totalSources > 0 ? a.gpEquity / totalSources : 0, source: 'equity' },
                { id: 'senior-debt', label: 'Senior Debt', amount: a.loanAmount, pct: totalSources > 0 ? a.loanAmount / totalSources : 0, source: 'debt' },
            ],
            uses: [
                { id: 'purchase-price', label: 'Purchase Price', amount: a.purchasePrice, pct: totalUses > 0 ? a.purchasePrice / totalUses : 0, source: 'acquisition' },
                { id: 'closing-costs', label: 'Closing Costs', amount: closingCosts, pct: totalUses > 0 ? closingCosts / totalUses : 0, source: 'acquisition' },
                { id: 'doc-stamps', label: 'Doc Stamps', amount: docStamps, pct: totalUses > 0 ? docStamps / totalUses : 0, source: 'tax' },
                { id: 'intangible-tax', label: 'Intangible Tax', amount: intangibleTax, pct: totalUses > 0 ? intangibleTax / totalUses : 0, source: 'tax' },
                { id: 'title-insurance', label: 'Title Insurance', amount: titleInsurance, pct: totalUses > 0 ? titleInsurance / totalUses : 0, source: 'closing' },
                { id: 'origination-fee', label: 'Origination Fee', amount: origFee, pct: totalUses > 0 ? origFee / totalUses : 0, source: 'financing' },
                { id: 'capex-budget', label: 'Capex Budget', amount: a.capexBudget, pct: totalUses > 0 ? a.capexBudget / totalUses : 0, source: 'capex' },
            ],
            totalSources: totalSources,
            totalUses: totalUses,
            delta: 0,
            balanced: true,
            benchmarks: {
                totalCostPerUnit: a.units > 0 ? totalAcqCost / a.units : 0,
                debtPct: totalSources > 0 ? a.loanAmount / totalSources : 0,
                equityPct: totalSources > 0 ? totalEquity / totalSources : 0,
                capexPerUnit: a.units > 0 ? a.capexBudget / a.units : 0,
            },
        },
        disposition: {
            stabilizedNOI: stabilizedNOI,
            grossSalePrice: grossSalePrice,
            saleCosts: saleCostsValue,
            netSaleProceeds: netSaleProceeds,
            loanBalance: loanBalance,
            equityProceeds: equityProceeds,
            dispositionDocStamps: dispositionDocStamps,
            exitYear: hold,
        },
        debtMetrics: debtMetrics,
        valuation: valuation,
        sensitivityAnalysis: { matrix: sensitivity },
        stressScenarios: stressScenarios,
        waterfallDistributions: waterfall,
        capital: {
            amortizationSchedule: [],
            loanBalanceByYear: amort.balanceByYear,
            debtServiceByYear: amort.debtServiceByYear,
            debtYieldByYear: debtYieldByYear,
            tranches: [
                {
                    id: 'senior-debt',
                    label: 'Senior Debt',
                    amount: a.loanAmount,
                    rate: a.rate,
                    termMonths: a.term,
                    amortMonths: a.amort,
                    ltv: a.ltv,
                },
            ],
            metrics: {
                totalCost: totalAcqCost,
                totalEquity: totalEquity,
                totalDebt: a.loanAmount,
                equityPct: totalAcqCost > 0 ? totalEquity / totalAcqCost : 0,
                debtPct: totalAcqCost > 0 ? a.loanAmount / totalAcqCost : 0,
                capexPerUnit: a.units > 0 ? a.capexBudget / a.units : 0,
            },
        },
        taxes: {
            reTax: (function () {
                var miamiDade = isMiamiDade(a.county);
                var millage = DEF_MILLAGE;
                var baseAV = a.isFlorida ? a.purchasePrice * DEF_REASSESS_PCT : 0;
                return {
                    t12AssessedValue: null,
                    platformAssessedValue: baseAV,
                    platformMillageRate: millage,
                    platformAnnualTax: baseAV > 0 ? baseAV * millage : null,
                    isMiamiDade: miamiDade,
                    sohCapPct: 0.10,
                    perYear: taxSchedule.assessedValues.map(function (av, idx) {
                        var _a;
                        var taxAmt = (_a = taxSchedule.perYear[idx]) !== null && _a !== void 0 ? _a : 0;
                        var capBound = a.isFlorida && idx > 0;
                        return {
                            year: idx + 1,
                            assessedValue: Math.round(av),
                            millageRate: millage,
                            taxAmount: Math.round(taxAmt),
                            capBinding: capBound,
                            sohCapBinding: capBound,
                            reassessmentEvent: idx === 0,
                        };
                    }),
                    deltaVsT12Pct: null,
                };
            })(),
            incomeTax: {
                purchasePrice: a.purchasePrice,
                landValuePct: INCOME_TAX_LAND_PCT,
                depreciableBase: incomeTaxDepreciableBase,
                annualDepreciation: incomeTaxAnnualDepr,
                bonusDepreciationCurrentYearPct: INCOME_TAX_BONUS_PCT,
                costSegAvailablePct: INCOME_TAX_COST_SEG_PCT,
                marginalTaxRate: INCOME_TAX_MARGINAL,
            },
            transferTax: (function () {
                var miamiDade = isMiamiDade(a.county);
                var flatRate = 0.007;
                var miamiRate = 0.0105;
                var appliedRate = miamiDade ? miamiRate : flatRate;
                return {
                    purchasePrice: a.purchasePrice,
                    loanAmount: a.loanAmount,
                    docStampAmount: docStamps,
                    intangibleTaxAmount: intangibleTax,
                    isMiamiDade: miamiDade,
                    miamiDadeRatePct: miamiRate,
                    statewideFlatRatePct: flatRate,
                    appliedRatePct: appliedRate,
                    totalTransferTax: docStamps + intangibleTax,
                    dispositionDocStamps: dispositionDocStamps,
                    refi: null,
                };
            })(),
        },
        projections: [],
        integrityChecks: [],
        reasoning: { derivationLog: log },
        meta: {
            modelVersion: '1.1',
            runner: 'deterministic-model-runner',
            computedAt: new Date().toISOString(),
        },
    };
    modelResult.integrityChecks = runIntegrityChecks(a, modelResult);
    // Fix S&U balanced flag
    modelResult.sourcesAndUses.delta = modelResult.sourcesAndUses.totalSources - modelResult.sourcesAndUses.totalUses;
    modelResult.sourcesAndUses.balanced = Math.abs(modelResult.sourcesAndUses.delta) < 1;
    // Populate amortization schedule
    for (var y = 0; y < hold + 1; y++) {
        modelResult.capital.amortizationSchedule.push({
            year: y + 1,
            beginningBalance: y === 0 ? a.loanAmount : amort.balanceByYear[y - 1],
            interest: (_0 = amort.interestByYear[y]) !== null && _0 !== void 0 ? _0 : 0,
            principal: (_1 = amort.principalByYear[y]) !== null && _1 !== void 0 ? _1 : 0,
            endingBalance: (_2 = amort.balanceByYear[y]) !== null && _2 !== void 0 ? _2 : 0,
        });
    }
    // Populate projections (institutional format rows)
    for (var y = 0; y < annualRows.length; y++) {
        var row = annualRows[y];
        modelResult.projections.push({
            year: row.year,
            institutionalRow: {
                gpr: row.grossPotentialRent,
                ltl: row.lossToLease,
                vacancy: row.vacancy,
                concessions: row.concessions,
                bad_debt: row.badDebt,
                base_revenue: row.baseRevenue,
                other_income: row.otherIncome,
                egi: row.effectiveGrossIncome,
                total_opex: row.totalExpenses,
                noi: row.noi,
                debt_service: row.debtService,
                cash_flow: row.preTaxCashFlow,
                dscr: (_3 = row.dscr) !== null && _3 !== void 0 ? _3 : 0,
                occupancy: row.occupancy,
                debt_yield: (_4 = row.debtYield) !== null && _4 !== void 0 ? _4 : 0,
                cap_rate_on_cost: (_5 = row.capRateOnCost) !== null && _5 !== void 0 ? _5 : 0,
            },
        });
    }
    return modelResult;
}
