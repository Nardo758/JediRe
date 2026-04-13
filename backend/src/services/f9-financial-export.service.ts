/**
 * F9 Financial Export Service
 * Builds per-year projections and XLSX workbook for F9 Financial Engine exports.
 * Sheets: Pro Forma | Traffic Projection | Assumptions
 */

import * as XLSX from 'xlsx';
import type { DealFinancials } from './proforma-adjustment.service';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ProjYearExport {
  year: number;
  gpr: number;
  vacancyLoss: number; lossToLease: number; concessions: number; badDebt: number; nru: number;
  nri: number; otherIncome: number; egi: number;
  payroll: number; repairs: number; turnover: number; contractSvc: number;
  marketing: number; utilities: number; gAndA: number; mgmtFee: number;
  insurance: number; reTaxes: number; reserves: number;
  totalOpex: number; noi: number;
  opMargin: number | null; noiPerUnit: number | null;
  interest: number; principal: number; annualDS: number;
  cfbt: number; netCF: number;
  coc: number | null; dscr: number | null; debtYield: number | null; occupancy: number | null;
  exitNoi: number | null; exitCap: number | null; grossSaleValue: number | null;
  sellingCosts: number | null; loanPayoff: number; netSaleProceeds: number | null;
  outstandingBalance: number;
  cumulativeEM: number | null;
}

// ─── Projection builder ─────────────────────────────────────────────────────

export function buildProjectionsForExport(
  f: DealFinancials,
  holdYears: number,
): ProjYearExport[] {
  const { totalUnits, proforma, capitalStack, trafficProjection, assumptions } = f;

  const y1 = (field: string): number | null => {
    const row = proforma.year1.find(r => r.field === field);
    return row?.resolved ?? row?.platform ?? null;
  };
  const tyr = (yr: number) => trafficProjection?.yearly.find(t => t.year === yr);
  const pyr = (yr: number) => assumptions.perYear.find(p => p.year === yr);

  const loan = capitalStack.loanAmount ?? 0;
  const rate = capitalStack.interestRate ?? 0.07;
  const ioPeriodYrs = Math.max(0, Math.round((capitalStack.ioPeriodMonths ?? 0) / 12));
  const amortYrs = capitalStack.amortizationYears ?? 30;
  const monthlyRate = rate / 12;
  const numPmts = amortYrs * 12;
  const monthlyPayment =
    loan > 0 && monthlyRate > 0
      ? (loan * monthlyRate * Math.pow(1 + monthlyRate, numPmts)) /
        (Math.pow(1 + monthlyRate, numPmts) - 1)
      : loan > 0
        ? loan / numPmts
        : 0;

  // GPR Year 1: use resolvedAnnual from GPR decomposition (highest-fidelity)
  const gprY1 =
    assumptions.gprDecomposition?.resolvedAnnual ?? y1('gpr') ?? 0;
  const lossToLeasePctY1 = y1('loss_to_lease_pct') ?? 0;
  const concPctY1        = y1('concessions_pct') ?? 0;
  const badDebtPctY1     = y1('bad_debt_pct') ?? 0;
  const nruPctY1         = y1('non_revenue_units_pct') ?? 0;
  const otherIncY1       = y1('other_income_per_unit') ?? 0;
  const mgmtFeePctY1     = y1('management_fee_pct') ?? 0.05;
  const payrollY1        = y1('payroll') ?? 0;
  const repairsY1        = y1('repairs_maintenance') ?? 0;
  const turnoverY1       = y1('turnover') ?? 0;
  const contractY1       = y1('contract_services') ?? 0;
  const marketingY1      = y1('marketing') ?? 0;
  const utilitiesY1      = y1('utilities') ?? 0;
  const gAndAY1          = y1('g_and_a') ?? 0;
  const insuranceY1      = y1('insurance') ?? 0;
  const reTaxY1          = y1('real_estate_tax') ?? 0;
  const reservesY1       = y1('replacement_reserves') ?? totalUnits * 350;

  let outstandingBalance = loan;
  let cumulativeCF = 0;
  const equityAtClose = capitalStack.equityAtClose ?? 0;
  const years: ProjYearExport[] = [];

  for (let yr = 1; yr <= holdYears; yr++) {
    const tv = tyr(yr);
    const pv = pyr(yr);

    // Compound rent growth from Year 1 base
    let rentMult = 1;
    for (let y = 1; y < yr; y++) {
      const g = pyr(y)?.rentGrowthPct ?? assumptions.rentGrowthStabilized ?? 0.03;
      rentMult *= 1 + (g ?? 0.03);
    }
    const opexMult = Math.pow(1.03, yr - 1);
    const insMult  = Math.pow(1.035, yr - 1);

    // GPR = resolvedAnnual × compound rent growth (vacancy handled separately)
    const gpr = Math.round(gprY1 * rentMult);

    // Vacancy: per-year traffic data wins when available
    const vacPct      = tv?.vacancyPct ?? pv?.vacancyPct ?? y1('vacancy_pct') ?? 0.05;
    const vacancyLoss = Math.round(gpr * (vacPct ?? 0.05));
    const lossToLease = Math.round(gpr * lossToLeasePctY1);
    const concessions = Math.round(gpr * concPctY1);
    const badDebt     = Math.round(gpr * badDebtPctY1);
    const nru         = Math.round(gpr * nruPctY1);
    const nri         = gpr - vacancyLoss - lossToLease - concessions - badDebt - nru;

    const otherIncome = Math.round(otherIncY1 * rentMult * totalUnits * 12);
    const egi         = nri + otherIncome;

    const payroll    = Math.round(payrollY1    * opexMult);
    const repairs    = Math.round(repairsY1    * opexMult);
    const turnover   = Math.round(turnoverY1   * opexMult);
    const contractSvc = Math.round(contractY1  * opexMult);
    const marketing  = Math.round(marketingY1  * opexMult);
    const utilities  = Math.round(utilitiesY1  * opexMult);
    const gAndA      = Math.round(gAndAY1      * opexMult);
    const mgmtFee    = Math.round(egi          * (mgmtFeePctY1 ?? 0.05));
    const insurance  = Math.round(insuranceY1  * insMult);
    const reTaxes    = Math.round(reTaxY1      * opexMult);
    const reserves   = Math.round(reservesY1   * opexMult);
    const totalOpex  = payroll + repairs + turnover + contractSvc + marketing +
                       utilities + gAndA + mgmtFee + insurance + reTaxes + reserves;
    const noi        = egi - totalOpex;

    let interest = 0, principal = 0, annualDS = 0;
    if (loan > 0) {
      if (yr <= ioPeriodYrs || amortYrs === 0) {
        interest = Math.round(outstandingBalance * rate);
        principal = 0;
        annualDS  = interest;
      } else {
        let yi = 0, yp = 0;
        for (let m = 0; m < 12; m++) {
          const mi = outstandingBalance * monthlyRate;
          const mp = monthlyPayment - mi;
          yi += mi;
          yp += mp;
          outstandingBalance = Math.max(0, outstandingBalance - mp);
        }
        interest  = Math.round(yi);
        principal = Math.round(yp);
        annualDS  = interest + principal;
      }
    }

    const cfbt  = noi - annualDS;
    const netCF = cfbt;
    cumulativeCF += netCF;

    const coc       = equityAtClose > 0 ? cfbt / equityAtClose : null;
    const dscr      = annualDS > 0 ? noi / annualDS : null;
    const debtYield = outstandingBalance > 0 ? noi / outstandingBalance : null;
    const occupancy = tv?.occupancyPct ?? (1 - (vacPct ?? 0.05));

    const exitCap =
      pv?.exitCapIfLastYear ??
      trafficProjection?.calibrated.exitCap ??
      assumptions.exitCap ??
      0.055;
    const exitNoi =
      Math.round(noi * (1 + (pyr(yr)?.rentGrowthPct ?? assumptions.rentGrowthStabilized ?? 0.03)));
    const grossSaleValue =
      exitCap && exitCap > 0 ? Math.round(exitNoi / exitCap) : null;
    const sellingCosts   = grossSaleValue ? Math.round(grossSaleValue * 0.015) : null;
    const loanPayoff     = Math.round(outstandingBalance);
    const netSaleProceeds =
      grossSaleValue != null && sellingCosts != null
        ? grossSaleValue - sellingCosts - loanPayoff
        : null;

    const cumulativeEM =
      equityAtClose > 0 && netSaleProceeds != null
        ? (cumulativeCF + netSaleProceeds) / equityAtClose
        : null;

    years.push({
      year: yr,
      gpr, vacancyLoss, lossToLease, concessions, badDebt, nru,
      nri, otherIncome, egi,
      payroll, repairs, turnover, contractSvc, marketing, utilities,
      gAndA, mgmtFee, insurance, reTaxes, reserves,
      totalOpex, noi,
      opMargin:   egi > 0 ? noi / egi : null,
      noiPerUnit: totalUnits > 0 ? noi / totalUnits : null,
      interest, principal, annualDS,
      cfbt, netCF,
      coc, dscr, debtYield, occupancy,
      exitNoi, exitCap, grossSaleValue, sellingCosts, loanPayoff, netSaleProceeds,
      outstandingBalance,
      cumulativeEM,
    });
  }
  return years;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function colLetter(col: number): string {
  let letter = '';
  let c = col + 1;
  while (c > 0) {
    const mod = (c - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    c = Math.floor((c - 1) / 26);
  }
  return letter;
}

function addr(row: number, col: number): string {
  return `${colLetter(col)}${row + 1}`;
}

function fmtDollar(v: number | null): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}
function fmtPct(v: number | null): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(2)}%`;
}

function setComment(ws: XLSX.WorkSheet, cellAddr: string, text: string): void {
  if (!ws[cellAddr]) return;
  if (!ws[cellAddr].c) ws[cellAddr].c = [];
  (ws[cellAddr].c as Array<{ a: string; t: string }>).push({ a: 'JediRE F9', t: text });
}

// ─── Sheet builders ──────────────────────────────────────────────────────────

// Row index constants (0-based array index → Excel row = idx + 1)
const R = {
  TITLE:    0,
  SUBTITLE: 1,
  HDRS:     3,
  GPR:      4,
  VAC:      5,
  LTL:      6,
  CONC:     7,
  BADDEBT:  8,
  NRU:      9,
  NRI:      10,
  OTH:      11,
  EGI:      12,
  // Row 13: empty
  // Row 14: EXPENSES section header (but we span it)
  PAYROLL:  15,
  REPAIRS:  16,
  TURNOVER: 17,
  CONTRACT: 18,
  MKTG:     19,
  UTIL:     20,
  GANDA:    21,
  MGMT:     22,
  INS:      23,
  RETAX:    24,
  RESV:     25,
  TOPEX:    26,
  // Row 27: empty
  NOI:      28,
  OPMARGIN: 29,
  NOIPU:    30,
  // Row 31: empty
  // Row 32: DEBT SERVICE header
  INTEREST: 33,
  PRINC:    34,
  TOTALDS:  35,
  // Row 36: empty
  CFBT:     37,
  NETCF:    38,
  // Row 39: empty
  // Row 40: METRICS header
  COC:      41,
  DSCR:     42,
  DY:       43,
  OCC:      44,
  CEM:      45,
  // Row 46: empty
  // Row 47: EXIT header
  EXNOI:    48,
  EXCAP:    49,
  GROSSSALE:50,
  SELLING:  51,
  LOANPAY:  52,
  NETSALE:  53,
};

function buildProFormaSheet(
  f: DealFinancials,
  projs: ProjYearExport[],
  holdYears: number,
): XLSX.WorkSheet {
  const N = holdYears;
  const yearCols = Array.from({ length: N }, (_, i) => i + 1);

  // Build AoA — initialize with empty rows
  const totalRows = 55;
  const aoa: (string | number | null)[][] = Array.from({ length: totalRows }, () => []);

  // Title
  aoa[R.TITLE] = [`Pro Forma  |  ${f.dealName}  |  ${f.totalUnits} Units`];
  aoa[R.SUBTITLE] = [`Hold Period: ${holdYears} Years  |  Generated: ${new Date().toLocaleDateString()}`];

  // Headers row
  aoa[R.HDRS] = ['OPERATING STATEMENT', ...yearCols.map(y => `YR ${y}`)];

  // Section label rows
  aoa[13]  = [''];
  aoa[14]  = ['EXPENSES'];
  aoa[27]  = [''];
  aoa[31]  = [''];
  aoa[32]  = ['DEBT SERVICE'];
  aoa[36]  = [''];
  aoa[39]  = [''];
  aoa[40]  = ['METRICS'];
  aoa[46]  = [''];
  aoa[47]  = ['EXIT / REVERSION'];

  type NumRow = [string, ...number[]];

  const mkRow = (
    label: string,
    key: keyof ProjYearExport,
  ): NumRow => [
    label,
    ...projs.map(p => (p[key] as number | null) ?? 0),
  ];

  aoa[R.GPR]     = mkRow('GROSS POTENTIAL RENT', 'gpr');
  aoa[R.VAC]     = mkRow('  Vacancy Loss', 'vacancyLoss');
  aoa[R.LTL]     = mkRow('  Loss to Lease', 'lossToLease');
  aoa[R.CONC]    = mkRow('  Concessions', 'concessions');
  aoa[R.BADDEBT] = mkRow('  Bad Debt / Collection Loss', 'badDebt');
  aoa[R.NRU]     = mkRow('  Non-Revenue Units', 'nru');
  aoa[R.NRI]     = mkRow('NET RENTAL INCOME', 'nri');
  aoa[R.OTH]     = mkRow('  Other Income', 'otherIncome');
  aoa[R.EGI]     = mkRow('EFFECTIVE GROSS INCOME', 'egi');
  aoa[R.PAYROLL] = mkRow('  Payroll / Personnel', 'payroll');
  aoa[R.REPAIRS] = mkRow('  Repairs & Maintenance', 'repairs');
  aoa[R.TURNOVER]= mkRow('  Turnover / Make-Ready', 'turnover');
  aoa[R.CONTRACT]= mkRow('  Contract Services', 'contractSvc');
  aoa[R.MKTG]    = mkRow('  Marketing & Leasing', 'marketing');
  aoa[R.UTIL]    = mkRow('  Utilities', 'utilities');
  aoa[R.GANDA]   = mkRow('  G&A / Administrative', 'gAndA');
  aoa[R.MGMT]    = mkRow('  Management Fee', 'mgmtFee');
  aoa[R.INS]     = mkRow('  Insurance', 'insurance');
  aoa[R.RETAX]   = mkRow('  Real Estate Taxes', 'reTaxes');
  aoa[R.RESV]    = mkRow('  Replacement Reserves', 'reserves');
  aoa[R.TOPEX]   = mkRow('TOTAL OPERATING EXPENSES', 'totalOpex');
  aoa[R.NOI]     = mkRow('NET OPERATING INCOME', 'noi');
  aoa[R.OPMARGIN]= ['  Operating Margin %', ...projs.map(p => p.opMargin ?? 0)];
  aoa[R.NOIPU]   = ['  NOI / Unit', ...projs.map(p => p.noiPerUnit ?? 0)];
  aoa[R.INTEREST]= mkRow('  Interest', 'interest');
  aoa[R.PRINC]   = mkRow('  Principal Paydown', 'principal');
  aoa[R.TOTALDS] = mkRow('TOTAL DEBT SERVICE', 'annualDS');
  aoa[R.CFBT]    = mkRow('CASH FLOW BEFORE TAX', 'cfbt');
  aoa[R.NETCF]   = mkRow('  Net Cash Flow', 'netCF');
  aoa[R.COC]     = ['  Cash-on-Cash Return', ...projs.map(p => p.coc ?? 0)];
  aoa[R.DSCR]    = ['  DSCR', ...projs.map(p => p.dscr ?? 0)];
  aoa[R.DY]      = ['  Debt Yield', ...projs.map(p => p.debtYield ?? 0)];
  aoa[R.OCC]     = ['  Occupancy %', ...projs.map(p => p.occupancy ?? 0)];
  aoa[R.CEM]     = ['  Cumulative Equity Multiple', ...projs.map(p => p.cumulativeEM ?? 0)];
  aoa[R.EXNOI]   = mkRow('  Forward NOI (Exit)', 'exitNoi');
  aoa[R.EXCAP]   = ['  Exit Cap Rate', ...projs.map(p => p.exitCap ?? 0)];
  aoa[R.GROSSSALE]= mkRow('  Gross Sale Value', 'grossSaleValue');
  aoa[R.SELLING] = mkRow('  (–) Selling Costs (1.5%)', 'sellingCosts');
  aoa[R.LOANPAY] = mkRow('  (–) Loan Payoff', 'loanPayoff');
  aoa[R.NETSALE] = mkRow('NET SALE PROCEEDS', 'netSaleProceeds');

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // ── Overlay formula cells ─────────────────────────────────────────────────
  for (let y = 0; y < N; y++) {
    const col = y + 1;         // col 0=A (labels), col 1=B (YR1)...
    const C   = colLetter(col);

    // NRI = GPR - VAC - LTL - CONC - BADDEBT - NRU
    ws[addr(R.NRI, col)] = {
      t: 'n',
      f: `=${C}${R.GPR+1}-${C}${R.VAC+1}-${C}${R.LTL+1}-${C}${R.CONC+1}-${C}${R.BADDEBT+1}-${C}${R.NRU+1}`,
      v: projs[y].nri,
    };
    // EGI = NRI + OtherIncome
    ws[addr(R.EGI, col)] = {
      t: 'n',
      f: `=${C}${R.NRI+1}+${C}${R.OTH+1}`,
      v: projs[y].egi,
    };
    // Total OpEx = SUM(PAYROLL:RESV)
    ws[addr(R.TOPEX, col)] = {
      t: 'n',
      f: `=SUM(${C}${R.PAYROLL+1}:${C}${R.RESV+1})`,
      v: projs[y].totalOpex,
    };
    // NOI = EGI - TOPEX
    ws[addr(R.NOI, col)] = {
      t: 'n',
      f: `=${C}${R.EGI+1}-${C}${R.TOPEX+1}`,
      v: projs[y].noi,
    };
    // Op Margin = NOI / EGI
    ws[addr(R.OPMARGIN, col)] = {
      t: 'n',
      f: `=${C}${R.NOI+1}/${C}${R.EGI+1}`,
      v: projs[y].opMargin ?? 0,
      z: '0.00%',
    };
    // NOI/Unit = NOI / totalUnits
    if (f.totalUnits > 0) {
      ws[addr(R.NOIPU, col)] = {
        t: 'n',
        f: `=${C}${R.NOI+1}/${f.totalUnits}`,
        v: projs[y].noiPerUnit ?? 0,
      };
    }
    // Total DS = INTEREST + PRINC
    ws[addr(R.TOTALDS, col)] = {
      t: 'n',
      f: `=${C}${R.INTEREST+1}+${C}${R.PRINC+1}`,
      v: projs[y].annualDS,
    };
    // CFBT = NOI - DS
    ws[addr(R.CFBT, col)] = {
      t: 'n',
      f: `=${C}${R.NOI+1}-${C}${R.TOTALDS+1}`,
      v: projs[y].cfbt,
    };
    // Net Sale Proceeds = GrossSale - Selling - LoanPayoff
    ws[addr(R.NETSALE, col)] = {
      t: 'n',
      f: `=${C}${R.GROSSSALE+1}-${C}${R.SELLING+1}-${C}${R.LOANPAY+1}`,
      v: projs[y].netSaleProceeds ?? 0,
    };

    // ── Layer metadata cell comments on GPR row ──────────────────────────
    const gpd = f.assumptions.gprDecomposition;
    if (gpd) {
      const gprCell = addr(R.GPR, col);
      const commentLines = [
        `GPR Layer Sources (Annual):`,
        `  Resolved:  ${fmtDollar(gpd.resolvedAnnual)} (${fmtDollar(gpd.resolvedPerUnitMo ? gpd.resolvedPerUnitMo * 12 / 12 : null)}/mo/unit)`,
        gpd.platformAnnual != null ? `  Platform: ${fmtDollar(gpd.platformAnnual)}` : null,
        gpd.brokerAnnual   != null ? `  Broker:   ${fmtDollar(gpd.brokerAnnual)}` : null,
        gpd.t12Annual      != null ? `  T12 Actual: ${fmtDollar(gpd.t12Annual)}` : null,
        gpd.rentRollAnnual != null ? `  Rent Roll: ${fmtDollar(gpd.rentRollAnnual)}` : null,
      ].filter((l): l is string => l !== null).join('\n');
      setComment(ws, gprCell, commentLines);
    }

    // ── Layer metadata comment on Vacancy row ────────────────────────────
    const tv = f.trafficProjection?.yearly.find(t => t.year === y + 1);
    if (tv?.vacancyPct != null) {
      const vacCell = addr(R.VAC, col);
      setComment(ws, vacCell,
        `Vacancy Source: M07 Traffic Engine\n  Year ${y + 1} vacancy: ${fmtPct(tv.vacancyPct)}\n  Occupancy: ${fmtPct(tv.occupancyPct)}`,
      );
    }
  }

  // Set column widths
  ws['!cols'] = [
    { wch: 32 },                                              // Label column
    ...Array.from({ length: N }, () => ({ wch: 14 })),       // Year columns
  ];

  // Set sheet range
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRows - 1, c: N },
  });

  return ws;
}

function buildTrafficSheet(f: DealFinancials, holdYears: number): XLSX.WorkSheet {
  const yearly = f.trafficProjection?.yearly ?? [];
  const aoa: (string | number | null)[][] = [
    ['Traffic Projection — M07 Engine', null, null, null, null, null, null, null],
    [`Deal: ${f.dealName}  |  ${f.totalUnits} Units  |  Hold: ${holdYears} Yrs  |  Generated: ${new Date().toLocaleDateString()}`],
    [],
    ['Year', 'Occupancy %', 'Vacancy %', 'Eff Rent/Mo', 'Rent Growth %',
     'T01 Weekly Tours', 'T05 Closing Ratio', 'T06 Weekly Leases'],
    ...Array.from({ length: holdYears }, (_, i) => {
      const yr = i + 1;
      const tv = yearly.find(t => t.year === yr);
      return [
        yr,
        tv?.occupancyPct ?? null,
        tv?.vacancyPct   ?? null,
        tv?.effRent      ?? null,
        tv?.rentGrowthPct ?? null,
        tv?.t01WeeklyTours ?? null,
        tv?.t05ClosingRatio ?? null,
        tv?.t06WeeklyLeases ?? null,
      ];
    }),
    [],
    ['— Calibrated Signals —'],
    ['Last Calibrated', f.trafficProjection?.calibrated.lastCalibrated ?? '—'],
    ['Platform Vacancy', f.trafficProjection?.calibrated.vacancyPct ?? null],
    ['Platform Rent Growth', f.trafficProjection?.calibrated.rentGrowthPct ?? null],
    ['Platform Exit Cap', f.trafficProjection?.calibrated.exitCap ?? null],
    [],
    ['— Leasing Velocity —'],
    ['T01 Weekly Tours', f.trafficProjection?.leasingSignals?.t01WeeklyTours ?? null],
    ['T05 Closing Ratio', f.trafficProjection?.leasingSignals?.t05ClosingRatio ?? null],
    ['T06 Weekly Leases', f.trafficProjection?.leasingSignals?.t06WeeklyLeases ?? null],
    ['T07 Lease-Up to 95% (wks)', f.trafficProjection?.leasingSignals?.t07LeaseUpWeeksTo95 ?? null],
    ['Stabilized Occupancy', f.trafficProjection?.leasingSignals?.stabilizedOccupancyPct ?? null],
    ['Model Confidence', f.trafficProjection?.leasingSignals?.confidence != null
      ? `${f.trafficProjection.leasingSignals.confidence}%` : '—'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 24 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 18 }, { wch: 18 },
  ];
  return ws;
}

function buildAssumptionsSheet(f: DealFinancials): XLSX.WorkSheet {
  const cs  = f.capitalStack;
  const ass = f.assumptions;
  const gpd = ass.gprDecomposition;

  const aoa: (string | number | null)[][] = [
    [`Assumptions  |  ${f.dealName}  |  ${f.totalUnits} Units  |  ${new Date().toLocaleDateString()}`],
    [],
    ['GPR SOURCE DECOMPOSITION'],
    ['Source', 'Annual ($)', 'Per Unit / Mo ($)'],
    ['RESOLVED', gpd?.resolvedAnnual ?? null, gpd?.resolvedPerUnitMo ?? null],
    ['PLATFORM', gpd?.platformAnnual ?? null, gpd?.platformPerUnitMo ?? null],
    ['BROKER',   gpd?.brokerAnnual   ?? null, gpd?.brokerPerUnitMo   ?? null],
    ['T12 ACTUAL',gpd?.t12Annual     ?? null, gpd?.t12PerUnitMo      ?? null],
    ['RENT ROLL', gpd?.rentRollAnnual ?? null, null],
    [],
    ['CAPITAL STACK'],
    ['Purchase Price',    cs.purchasePrice    ?? null],
    ['Loan Amount',       cs.loanAmount       ?? null],
    ['Equity at Close',   cs.equityAtClose    ?? null],
    ['LTC %',             cs.ltcPct           ?? null],
    ['Interest Rate',     cs.interestRate     ?? null],
    ['IO Period (months)',cs.ioPeriodMonths   ?? null],
    ['Amortization (yrs)',cs.amortizationYears ?? null],
    ['DSCR Min',          cs.dscrMin          ?? null],
    ['Origination Fee %', cs.originationFeePct ?? null],
    ['Price Per Unit',    cs.pricePerUnit      ?? null],
    [],
    ['KEY ASSUMPTIONS'],
    ['Hold Period (yrs)',           ass.holdYears],
    ['Exit Cap Rate',               ass.exitCap         ?? null],
    ['Rent Growth Year 1',          ass.rentGrowthYr1   ?? null],
    ['Rent Growth Stabilized',      ass.rentGrowthStabilized ?? null],
    [],
    ['PER-YEAR ASSUMPTIONS'],
    ['Year', 'Rent Growth %', 'Vacancy %', 'Exit Cap (if last yr)'],
    ...ass.perYear.map(p => [
      p.year,
      p.rentGrowthPct     ?? null,
      p.vacancyPct        ?? null,
      p.exitCapIfLastYear ?? null,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 20 }];
  return ws;
}

// ─── Main workbook builder ────────────────────────────────────────────────────

export function buildF9Workbook(f: DealFinancials, holdYears: number): XLSX.WorkBook {
  const projs = buildProjectionsForExport(f, holdYears);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildProFormaSheet(f, projs, holdYears), 'Pro Forma');
  XLSX.utils.book_append_sheet(wb, buildTrafficSheet(f, holdYears), 'Traffic Projection');
  XLSX.utils.book_append_sheet(wb, buildAssumptionsSheet(f), 'Assumptions');

  return wb;
}
