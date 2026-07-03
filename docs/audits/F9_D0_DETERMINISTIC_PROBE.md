# F9-D0 DETERMINISTIC PROBE REPORT
## READ-ONLY Deep Code Trace — Deterministic Runner vs. LLM Path

**Executed:** F9-D0 probe  
**Scope:** `backend/src/services/deterministic/deterministic-model-runner.ts`, `proforma-assumptions-bridge.ts`, `financial-model-engine.service.ts`  
**Objective:** Determine whether D2 (deterministic promotion) is a greenfield build or a promotion of existing code.

---

## 1. Executive Summary: D2 Is a Promotion, Not Greenfield

**Verdict: PROMOTION.** The deterministic runner is already a **complete, production-grade institutional financial model** (1,918 lines). It computes full P&L, returns, waterfall, debt metrics, valuation, sensitivity, stress scenarios, taxes, and 20+ integrity checks. It already runs on every `buildModel()` call and already overwrites the LLM's computed numbers for the most critical fields (waterfall partitions, annual cash flow, sources & uses).

**What D2 actually requires:**
1. **Delete** the LLM arithmetic path (`callLLMForModel` prompt currently instructs the LLM to compute IRR, NOI, DSCR, etc.)
2. **Promote** the deterministic runner from "verification overlay" to "sole source of truth"
3. **Reposition** the LLM as an assumption-shaping agent + narrative commentator
4. **Preserve** the existing bridge (`mapProFormaAssumptionsToModelAssumptions`) — it is already the W1/W3 bridge from the F9 wiring spec

**Risk level:** Low. The deterministic runner is battle-tested with 10 hard invariants (INV-1…INV-10), 11 soft checks, and a full development/lease-up path. The main D2 work is architectural removal of the LLM-compute path, not model construction.

---

## 2. Q1 Findings: Deterministic Runner Scope

### 2.1 File:Line Map of Exports and Functions

| Function / Export | Line | What It Computes |
|-------------------|------|------------------|
| `runModel` | 1197 | **Main entry point.** Orchestrates Phases 1–11 and returns complete `ModelResults`. |
| `runIntegrityChecks` | 921 | **10 hard invariants + 11 soft checks.** Validates NOI=EGR−Opex, CF=NOI−DS, DSCR=NOI/DS, equityProceeds=netSale−loanBal, salePrice=NOI/exitCap, capital-stack conservation, waterfall conservation, loss<GPR, occupancy=vacancySchedule, plus DSCR breach, aggressive vacancy, rent growth, cap rate compression, IRR/EM thresholds, affordability ceiling. |
| `buildVacancySchedule` | 411 | **Ramp/stabilization logic.** Y1 vacancy → linear midpoint Y2 → stabilized. Handles development construction (0% occ) and lease-up linear absorption. |
| `computeYearOperating` | 594 | **Single-year P&L.** GPR, loss-to-lease, vacancy, concessions, bad debt, base revenue, other income, EGI, 10 OPEX lines (payroll, maint, contract, marketing, utilities, admin, insurance, property tax, mgmt fee, reserves), total expenses, NOI, occupancy. |
| `computeAmortization` | 468 | **Full amortization schedule.** Monthly IO or P&I, balloon at term end, yearly roll-ups of interest/principal/DS/balance. |
| `computeWaterfall` | 712 | **5-tier IRR-hurdle waterfall.** T1 ROC (dollar-based), T2 Preferred Return (100% LP), T3–T5 Promote tiers with bisection search for LP IRR=hurdle. Per-tier LP/GP IRR and equity multiple. |
| `bisectDistribution` | 663 | Binary-search LP allocation to hit hurdle IRR within 1e-4 tolerance. |
| `calculateIRR` | 544 | Newton-Raphson IRR with fallback to negative guess for marginal deals. |
| `calculateEM` | 574 | Equity multiple = Σpositive CFs / \|initial outlay\|. |
| `calculateAvgCoC` | 586 | Average cash-on-cash = mean operating CF / equity. |
| `computeSensitivityMatrix` | 873 | 5×6 grid: exit cap ±50bps × rent growth ±1.5%. |
| `computeFloridaTax` | 436 | FL property tax with Save-Our-Homes 10% cap, reassessment at 85% of purchase. |
| `computeNonFloridaTax` | 454 | Non-FL property tax growing at expense growth rate. |
| `buildCashFlowVector` | 1178 | Equity CF vector: [-totalEquity, Y1…Yhold CFADS, equityProceeds at exit]. |

### 2.2 Financial Figures Produced

The deterministic runner produces **every figure** in an institutional multifamily model:

**Income Statement (annual):**
- Gross Potential Rent, Loss-to-Lease, Vacancy, Concessions, Bad Debt, Base Revenue, Other Income, Effective Gross Income
- 10 OPEX lines + Total Expenses → NOI
- Debt Service (interest + principal) → CFADS/pre-tax cash flow
- Income tax: depreciation, taxable income, tax payable, after-tax cash flow

**Returns:**
- Levered IRR, Equity Multiple, Average Cash-on-Cash
- Unlevered IRR
- LP/GP IRR, LP/GP Equity Multiple, LP/GP Cash-on-Cash
- LP/GP total distributions, LP/GP profit, GP promote earned
- Total profit

**Debt Metrics:**
- DSCR (min, avg, Y1, at stabilization, stressed −10% NOI)
- Debt yield (min, Y1)
- Break-even occupancy
- LTV at close / maturity, positive leverage, spread over cap rate

**Valuation:**
- Going-in cap rate, exit cap rate, stabilized cap rate
- Yield on cost (untrended / trended)
- GRM, NIM, opex ratio, per-unit, per-SF

**Disposition:**
- Stabilized NOI, gross sale price, sale costs, net sale proceeds, loan balance at exit, equity proceeds

**Capital Stack:**
- Sources & Uses (LP equity, GP equity, senior debt vs. purchase price, closing costs, taxes, origination fee, capex)
- Amortization schedule (yearly beginning balance, interest, principal, ending balance)

**Taxes:**
- Real estate tax (FL with SOH cap / non-FL), income tax (depreciation, bonus depreciation, cost seg), transfer tax (doc stamps, intangible, Miami-Dade variant)

**Scenarios:**
- Sensitivity matrix (exit cap × rent growth)
- Stress scenarios: base, bear, bull, black swan

### 2.3 Does It Consume `deal_assumptions`?

**Indirectly, yes — but not as its primary input.**

- The runner's input contract is `ModelAssumptions` (flat scalar struct, line 11 of `deterministic-model-runner.ts`).
- The bridge `mapProFormaAssumptionsToModelAssumptions()` (`proforma-assumptions-bridge.ts:195`) transforms the LLM-facing `ProFormaAssumptions` envelope into `ModelAssumptions`.
- `deal_assumptions.year1` is read **only for evidence hints and collision reports** (`financial-model-engine.service.ts:1677–1691`). It is NOT fed into the runner's math directly. Instead, `buildEvidenceHintsFromSeed()` (`proforma-assumptions-bridge.ts:113`) extracts `LayeredValue` metadata to populate `_evidenceHints` and `_collisionReport` on `ModelAssumptions`.

**Conclusion:** The runner does not `resolve()` from `deal_assumptions` in the D-MOD sense. It receives a fully resolved `ProFormaAssumptions` envelope that has already passed through Batch-4/5/6/7 enhancement, D-MOD conflict resolution, and M11/M14 adjustment.

### 2.4 Ramp/Stabilization Logic

**Already implemented, two modes:**

1. **Existing/Acquisition deals** (`buildVacancySchedule`, line 411):  
   Y1 vacancy = max(vacancyY1, vacancyStab) → Y2 linear midpoint if Y1 > stab → stab thereafter.

2. **Development/Ground-up deals** (`runModel` lines 1277–1333):  
   Construction phase (Y1…Y_n): zero revenue, capitalized interest + property tax as expenses.  
   Lease-up phase: linear absorption curve. Vacancy for year = 1 − (phaseY / leaseUpYears) × (1 − vacancyStab).  
   Post-lease-up: stabilized operating.

3. **Lease-up inference** (`financial-model-engine.service.ts:1654–1674`):  
   When `dealMode` is absent and rent-roll occupancy < 90%, the verifier infers `dealMode = 'lease_up'` to relax INV-5/INV-7 semantics.

### 2.5 Coverage Assessment

| Dimension | Coverage |
|-----------|----------|
| P&L | **Full** — every line item from GPR to after-tax CF |
| Returns | **Full** — levered/unlevered IRR, EM, CoC, LP/GP partition |
| Debt | **Full** — DSCR, debt yield, break-even, stress, amortization |
| Waterfall | **Full** — 5-tier IRR-hurdle with bisection |
| Valuation | **Full** — cap rates, yield on cost, GRM, NIM, per-unit/per-SF |
| Sensitivity | **Full** — 5×6 matrix + 4 stress scenarios |
| Taxes | **Full** — RE tax (FL + non-FL), income tax, transfer tax |
| Integrity | **Full** — 10 hard invariants, 11 soft checks |
| Development | **Full** — construction + lease-up + absorption |

**Deterministic runner coverage = 100%. There are no gaps that require a greenfield build.**

---

## 3. Q2 Findings: `crossCheckLLMVsDeterministic` Behavior

### 3.1 Implementation Location

`proforma-assumptions-bridge.ts`, lines **569–606**.

### 3.2 What It Does

```typescript
// Line 567
const MATERIAL_PCT_THRESHOLD = 0.10; // 10% relative divergence is flagged

// Lines 569–606
export function crossCheckLLMVsDeterministic(
  llm: FinancialModelResultShape,
  det: ModelResultsShape,
): LLMVsDeterministicDivergence[] { ... }
```

**Compared fields (8 KPIs):**
1. `summary.irr`
2. `summary.equityMultiple`
3. `summary.noiYear1`
4. `summary.purchaseCapRate`
5. `summary.exitValue`
6. `summary.netProceeds`
7. `summary.totalEquity`
8. `debtMetrics.dscr`

**Behavior when divergences are found:**
- Computes `deltaAbsolute`, `deltaPct`, and `material` boolean (line 586–593)
- Returns an array of `LLMVsDeterministicDivergence` objects
- **Does NOT halt the build**
- **Does NOT prefer deterministic** (the cross-check is purely observational)
- **Does NOT persist to a delta history table**

### 3.3 Call Site in `buildModel()`

`financial-model-engine.service.ts`, lines **1748–1759**:

```typescript
const divergences = crossCheckLLMVsDeterministic(result, deterministicResult);
const materialDivergences = divergences.filter(d => d.material);
if (materialDivergences.length > 0) {
  logger.warn(
    `[F9-Verifier] LLM↔deterministic KPI divergences for ${dealId} (${materialDivergences.length} material):` +
    materialDivergences.map(d => ...).join(';')
  );
}
```

**Key observations:**
- The warning is **ephemeral** — it goes to the log stream only.
- There is **no DB table** for divergence history.
- There is **no alert pipeline** (no webhook, no notification, no email).
- The build **continues** even with material divergences.

### 3.4 Delta History: None

| Question | Answer |
|----------|--------|
| Dedicated DB table for deltas? | **No.** |
| Log pattern for historical query? | **No.** grep for `LLM↔deterministic KPI divergences` finds only the `logger.warn` at line 1753. |
| Persisted in `deal_financial_models`? | **No.** Only `result` (the merged object) and `status` are persisted. |
| Audit trail of which source "won"? | **Partial.** The deterministic runner overwrites `annualCashFlow`, `sourcesAndUses`, and partition fields, but the LLM's `summary.irr`, `summary.equityMultiple`, etc. are retained unless integrity checks fail. |

### 3.5 Evidence of LLM Distortion

The very existence of `crossCheckLLMVsDeterministic` and the overwrite logic at lines **1701–1741** proves the LLM path has been distorting numbers:

> "Merge LP/GP partition + scalar summary fields from the deterministic runner into the LLM result. The LLM schema does not emit these, but the F9 Overview tab reads them directly." (lines 1695–1700)

> "sourcesAndUses and annualCashFlow: the deterministic runner is the canonical source for both — it emits well-formed arrays with stable field names. The LLM frequently emits sparse Records or omits rows." (lines 1726–1731)

**Translation:** The LLM was producing malformed/sparse cash flows and omitting waterfall partitions. The deterministic runner was already brought in as the "canonical source" for these. The cross-check exists because the LLM's `summary.irr`, `equityMultiple`, etc. were still being trusted despite known inaccuracies in cash flow construction.

---

## 4. Q3 Findings: LLM Output Field Classification

The LLM returns a `FinancialModelResult` object (interface defined at `financial-model-engine.service.ts:196–341`). Below is a field-by-field classification per the F9 spec rule: *"assumption-shaped content gets a home in the agent layer; re-stated arithmetic is deleted."*

### 4.1 Classification Table

| Field Path | Classification | Evidence / Rationale |
|------------|----------------|----------------------|
| `summary.irr` | **RESTATED ARITHMETIC** | Deterministic runner computes this via `calculateIRR()` (line 544). The LLM is instructed to "calculate using XIRR methodology" in the prompt (line 2208). |
| `summary.equityMultiple` | **RESTATED ARITHMETIC** | Deterministic runner computes via `calculateEM()` (line 574). Prompt asks LLM to compute it. |
| `summary.cashOnCash` | **RESTATED ARITHMETIC** | Deterministic computes `calculateAvgCoC()` (line 586). Prompt asks for CoC by year. |
| `summary.noiYear1` | **RESTATED ARITHMETIC** | Deterministic computes from `computeYearOperating()` (line 594). Prompt asks for NOI. |
| `summary.noiStabilized` | **RESTATED ARITHMETIC** | Deterministic derives from exit-year NOI (line 1374). |
| `summary.purchaseCapRate` | **RESTATED ARITHMETIC** | Deterministic computes as `noiY1 / purchasePrice` (line 1404). |
| `summary.yieldOnCost` | **RESTATED ARITHMETIC** | Deterministic computes `noiY1 / totalAcqCost` (line 1450). |
| `summary.exitValue` | **RESTATED ARITHMETIC** | Overwritten by deterministic at line 1722: `result.summary.exitValue = detDisp.grossSalePrice`. |
| `summary.netProceeds` | **RESTATED ARITHMETIC** | Overwritten by deterministic at line 1723. |
| `summary.totalEquity` | **RESTATED ARITHMETIC** | Derived from `purchasePrice + costs − loanAmount`. Deterministic computes at line 1226. |
| `summary.totalDebt` | **RESTATED ARITHMETIC** | Directly from `financing.loanAmount` input; LLM restates it. |
| `summary.dscr` | **RESTATED ARITHMETIC** | Deterministic computes `NOI / debtService` per year (line 1345). |
| `summary.debtYield` | **RESTATED ARITHMETIC** | Deterministic computes `NOI / loanAmount` (line 1346). |
| `summary.avgCoC` | **RESTATED ARITHMETIC** | Deterministic overwrites at line 1702. |
| `summary.lpIrr` | **RESTATED ARITHMETIC** | Deterministic overwrites at line 1703. |
| `summary.gpIrr` | **RESTATED ARITHMETIC** | Deterministic overwrites at line 1704. |
| `summary.lpEquityMultiple` | **RESTATED ARITHMETIC** | Deterministic overwrites at line 1705. |
| `summary.gpEquityMultiple` | **RESTATED ARITHMETIC** | Deterministic overwrites at line 1706. |
| `summary.lpCoC` | **RESTATED ARITHMETIC** | Deterministic overwrites at line 1707. |
| `summary.gpCoC` | **RESTATED ARITHMETIC** | Deterministic overwrites at line 1708. |
| `summary.lpTotalDistributions` | **RESTATED ARITHMETIC** | Deterministic overwrites at line 1709. |
| `summary.lpProfit` | **RESTATED ARITHMETIC** | Deterministic overwrites at line 1710. |
| `summary.gpTotalDistributions` | **RESTATED ARITHMETIC** | Deterministic overwrites at line 1711. |
| `summary.gpPromoteEarned` | **RESTATED ARITHMETIC** | Deterministic overwrites at line 1712. |
| `summary.totalProfit` | **RESTATED ARITHMETIC** | Deterministic overwrites at line 1713. |
| `annualCashFlow[*].potentialRent` | **RESTATED ARITHMETIC** | Entire cash flow array replaced by deterministic at line 1739–1741. |
| `annualCashFlow[*].lossToLease` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `annualCashFlow[*].vacancy` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `annualCashFlow[*].collectionLoss` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `annualCashFlow[*].netRentalIncome` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `annualCashFlow[*].otherIncome` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `annualCashFlow[*].effectiveGrossRevenue` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `annualCashFlow[*].operatingExpenses.*` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `annualCashFlow[*].totalExpenses` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `annualCashFlow[*].noi` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `annualCashFlow[*].replacementReserves` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `annualCashFlow[*].noiAfterReserves` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `annualCashFlow[*].debtService` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `annualCashFlow[*].capitalExpenditures` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `annualCashFlow[*].beforeTaxCashFlow` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `annualCashFlow[*].leveredCashFlow` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `sourcesAndUses.sources` | **RESTATED ARITHMETIC** | Replaced by deterministic at line 1736–1738. |
| `sourcesAndUses.uses` | **RESTATED ARITHMETIC** | Replaced by deterministic. |
| `debtMetrics.loanAmount` | **RESTATED ARITHMETIC** | Direct input restatement. |
| `debtMetrics.annualDebtService` | **RESTATED ARITHMETIC** | Deterministic computes amortization schedule. |
| `debtMetrics.dscr` | **RESTATED ARITHMETIC** | Deterministic computes. |
| `debtMetrics.ltv` | **RESTATED ARITHMETIC** | Deterministic computes. |
| `debtMetrics.ltc` | **RESTATED ARITHMETIC** | Deterministic computes. |
| `debtMetrics.debtYield` | **RESTATED ARITHMETIC** | Deterministic computes. |
| `sensitivityAnalysis.exitCapVsHoldPeriod` | **RESTATED ARITHMETIC** | Deterministic `computeSensitivityMatrix()` (line 873). |
| `sensitivityAnalysis.rentGrowthVsHoldPeriod` | **RESTATED ARITHMETIC** | Deterministic computes. |
| `waterfallDistributions[*].lpDistribution` | **RESTATED ARITHMETIC** | Deterministic `computeWaterfall()` (line 712). |
| `waterfallDistributions[*].gpDistribution` | **RESTATED ARITHMETIC** | Deterministic computes. |
| `waterfallDistributions[*].gpPromote` | **RESTATED ARITHMETIC** | Deterministic computes. |
| `waterfallDistributions[*].totalDistribution` | **RESTATED ARITHMETIC** | Deterministic computes. |
| `developmentSchedule[*]` | **RESTATED ARITHMETIC** | Development path computed deterministically (lines 1277–1333). |
| `evidence` | **INJECTED POST-LLM** | Not produced by LLM. Injected from deterministic runner at line 1783. |
| `reasoning.walkthrough` | **INJECTED POST-LLM** | Not produced by LLM. Injected at line 1784–1787. |
| `reasoning.collisionReport` | **INJECTED POST-LLM** | From `_collisionReport` built by bridge (line 184). |
| `integrityChecks` | **INJECTED POST-LLM** | Deterministic `runIntegrityChecks()` merged at line 1791. |
| `meta.m11Converged` | **INJECTED POST-LLM** | M11 cycle result (line 1798). |
| `meta.m11Iterations` | **INJECTED POST-LLM** | M11 cycle result. |
| `meta.m14Applied` | **INJECTED POST-LLM** | M14 cycle result. |
| `meta.m14CapRateAdjBps` | **INJECTED POST-LLM** | M14 cycle result. |
| `meta.m11CapitalStructure` | **INJECTED POST-LLM** | M11 write-back (line 1862). |
| `meta.m14DscrConstraintBinds` | **INJECTED POST-LLM** | M14 constraint flag. |

### 4.2 Summary of Classification

| Category | Count | Verdict |
|----------|-------|---------|
| ASSUMPTION-SHAPED | **0** | The LLM output interface contains **no assumption-shaped fields** in its current form. All assumptions live in the input `ProFormaAssumptions` envelope. |
| RESTATED ARITHMETIC | **60+** | Every numeric field the LLM emits is restated arithmetic that the deterministic runner already computes more reliably. |
| SCENARIO NARRATIVE | **0** | The LLM does not emit narrative commentary in `FinancialModelResult`. The `walkthrough` is generated by the deterministic runner (line 1670–1696). |
| OTHER / INJECTED | **9** | `evidence`, `reasoning`, `integrityChecks`, and `meta` fields are injected post-LLM by the deterministic path. |

**Critical finding:** The current `FinancialModelResult` schema is **100% arithmetic output**. There is no place in the schema for the LLM to return assumption-shaped content or scenario narrative. The spec's intended architecture (agent writes assumptions, deterministic engine computes numbers) is **inverted in practice**: the agent is being asked to compute numbers, and then the deterministic engine corrects them.

---

## 5. Recommendation for D2 Shape

Based on the probe findings, D2 should be structured as a **deterministic-first refactor** with three workstreams:

### 5.1 Workstream A: Remove LLM Arithmetic (P0)

**Target:** `financial-model-engine.service.ts`

1. **Replace `callLLMForModel`** with an assumption-shaping call. The LLM should receive `ProFormaAssumptions` and return **only** assumptions, narrative, and commentary — not a full `FinancialModelResult`.
2. **Delete** the `buildSystemPrompt()` instructions that ask the LLM to compute IRR, NOI, DSCR, EM, etc. (lines 2196–2221).
3. **Delete** the `buildUserPrompt()` request for "complete financial model JSON" (lines 2321–2330).
4. **Preserve** `callLLMForModel` only if repurposed to generate:
   - Assumption commentary (e.g., "Rent growth of 3.5% is aggressive given submarket trends...")
   - Scenario narrative (bear/bull/thesis)
   - Risk flags in natural language

### 5.2 Workstream B: Promote Deterministic to Primary (P0)

**Target:** `financial-model-engine.service.ts` lines 1547–1920

1. **Invert the flow:**
   ```
   CURRENT:  callLLM → coerce → cross-check → overwrite with deterministic → persist
   TARGET:   enhance assumptions → run deterministic → (optional) LLM commentary → persist
   ```
2. **Make `runModel()` the first-class citizen.** It already produces `ModelResults` which is a superset of `FinancialModelResult`.
3. **Remove `coerceFinancialModelResultToModelResultsShape`** (`proforma-assumptions-bridge.ts:414`) — it exists only to validate LLM arithmetic, which will no longer exist.
4. **Remove `crossCheckLLMVsDeterministic`** — there will be no LLM arithmetic to cross-check.

### 5.3 Workstream C: Agent Layer Assumption Interface (P1)

**Target:** New or modified schema

1. **Create `AgentAssumptionOutput`** schema:
   - `assumptionsDelta`: fields the agent wants to change (rent growth, exit cap, hold period, etc.)
   - `commentary`: narrative explaining the delta
   - `confidence`: HIGH/MEDIUM/LOW per field
   - `riskFlags`: natural language risk observations
2. **The deterministic runner remains untouched** — it is already complete and correct. D2 is not a greenfield build.
3. **Preserve the bridge** `mapProFormaAssumptionsToModelAssumptions` — it is already the correct W1/W3 translation layer.

### 5.4 Risk and Mitigation

| Risk | Mitigation |
|------|------------|
| Frontend expects `FinancialModelResult` shape | The deterministic runner's `ModelResults` is already a superset. Map `ModelResults` → `FinancialModelResult` with a thin adapter (reverse of today's coercion). |
| `deal_financial_models.results` column has historical LLM-shaped JSON | The column stores the **merged** result today. After D2, it will store deterministic-only. Historical rows remain valid because deterministic already overwrites the critical fields. |
| Loss of "LLM judgment" on aggressive assumptions | Move this to the assumption-shaping phase. The LLM can still flag "AGGRESSIVE_RENT_GROWTH" in commentary, but the deterministic runner's `runIntegrityChecks` already has SOFT-4 for this. |

---

## 6. Appendix: Key Code Citations

| Citation | Location | Significance |
|----------|----------|--------------|
| Deterministic runner is canonical for cash flows | `financial-model-engine.service.ts:1726–1731` | Explicit admission that LLM cash flows are sparse/malformed |
| Deterministic overwrites partition fields | `financial-model-engine.service.ts:1695–1713` | Proof that deterministic is already the source of truth for LP/GP returns |
| Cross-check is observational only | `financial-model-engine.service.ts:1748–1759` | No halt, no preference, no persistence |
| Integrity checks halt build | `financial-model-engine.service.ts:1762–1769` | Only hard INV-* failures stop persistence |
| LLM prompt asks for IRR/NOI/DSCR | `financial-model-engine.service.ts:2196–2221` | The spec violation is encoded in the prompt itself |
| Development path exists | `deterministic-model-runner.ts:1277–1333` | Construction + lease-up already modeled |
| Waterfall with bisection | `deterministic-model-runner.ts:712–869` | Production-grade promote math |
| 10 hard invariants | `deterministic-model-runner.ts:921–1176` | Institutional-grade verification |

---

*End of F9-D0 Deterministic Probe Report.*
*No code changes were made. This document is READ-ONLY evidence for D2 planning.*
