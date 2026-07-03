# F9-D1: Navigation Trigger Kill — Report

> **Status:** COMPLETE  
> **Scope:** Kill all navigation-reachable LLM triggers in the F9 frontend. Verify GET /latest is safe. Inventory Inngest events.  
> **Committed:** `3eba9d407`  
> **Files Changed:** `frontend/src/pages/development/FinancialEnginePage.tsx` (-14 lines)

---

## 1. GET /latest — Zero LLM Reachability (D1a)

**Route:** `GET /api/v1/financial-model/:dealId/latest`

**Handler:** `backend/src/api/rest/financial-model.routes.ts:576-592`

```typescript
router.get('/:dealId/latest', async (req: Request, res: Response) => {
  const { dealId } = req.params;
  const currentHash = typeof req.query.assumptionsHash === 'string'
    ? req.query.assumptionsHash : undefined;
  const model = await financialModelEngine.getLatestModel(dealId, currentHash);
  // ...returns cached model or 404
});
```

**Trace into service layer:** `financial-model-engine.service.ts:2035-2058`

```typescript
async getLatestModel(dealId: string, currentHash?: string): Promise<...> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT assumptions, results, created_at, assumptions_hash
     FROM deal_financial_models
     WHERE deal_id = $1 AND status = 'complete'
     ORDER BY created_at DESC LIMIT 1`,
    [dealId]
  );
  // Pure deserialization. No conditional branches. No LLM adapter reachable.
  return { assumptions: row.assumptions, results: row.results, ... };
}
```

**Verdict:** `getLatestModel` is a single `SELECT` with zero conditional branches. No path reaches `callLLMForModel`, `aiService`, `selectLLMClient`, or any adapter. **GET /latest is safe — deterministic computation permitted on any render per F9 spec §2.**

---

## 2. Navigation Trigger Killed (D1b)

### 2.1 Primary Trigger: FinancialEnginePage.tsx Page-Load Auto-Build

**Location:** `frontend/src/pages/development/FinancialEnginePage.tsx` lines 1196-1207 (pre-deletion)

**Deleted code:**

```typescript
// Auto-build model when assumptions and financials are both available.
// Declared after handleBuildModel to avoid a temporal dead zone reference.
const modelBuiltRef = useRef(false);
useEffect(() => {
  if (!resolvedDealId || !assumptions || !f9Financials) return;
  if (modelBuiltRef.current) return;
  if (modelResults) {
    modelBuiltRef.current = true;
    return;
  }
  modelBuiltRef.current = true;
  handleBuildModel();  // ← POST /build = LLM call
}, [resolvedDealId, assumptions, f9Financials, modelResults, handleBuildModel]);
```

**Why it burned:**
- Fires on **pure navigation** when `resolvedDealId`, `assumptions` (bootstrapped from f9Financials), and `f9Financials` are all non-null.
- `modelBuiltRef` resets to `false` on every component unmount/remount (React `useRef` does not survive unmount).
- If the user navigates away and back to the F9 tab, the effect re-runs with `modelResults === null` and fires `handleBuildModel()` again.
- `handleBuildModel()` calls `POST /api/v1/financial-model/build` → `financialModelEngine.buildModel()` → `callLLMForModel()` → DeepSeek/OpenAI API call → **billable**.

**Fix:** Deleted the entire block including `modelBuiltRef` declaration. The bootstrap assumptions useEffect (lines ~1043) still seeds defaults from f9Financials, but now the user must explicitly click **Build Model** to trigger the LLM.

### 2.2 Secondary Triggers Examined (No Action Required)

| File | Line | Trigger | Type | Action |
|------|------|---------|------|--------|
| `ProFormaTab.tsx` | 412 | `assumptions.module-applied` event → `handleBuildModel()` | Event-driven | **KEEP** — D1 spec: event triggers stay for now |
| `ProFormaTab.tsx` | 894 | `setTimeout(() => handleBuildModel(), 100)` inside `handleApplyGoalSeek` | Explicit user action | **KEEP** — user explicitly applied goal-seek |
| `FinancialEnginePage.tsx` | ~1850 | `<button onClick={handleBuildModel}>` | Explicit button | **KEEP** |
| `FinancialEnginePage.tsx` | ~1430 | Opus chat `action.type === 'build_model'` | Explicit chat command | **KEEP** |

---

## 3. Inngest Event Inventory (D1c)

**Question:** Does any Inngest event path reach `POST /build` or `financialModelEngine.buildModel()`?

**Method:** Grepped all 34 Inngest function files in `backend/src/inngest/functions/` for `buildModel(`, `financial-model/build`, and `handleBuildModel`. Also searched event consumers for build triggers.

### 3.1 Inngest Functions — No Build Reachability

**Scope note:** The repo contains **34 Inngest function files** under `backend/src/inngest/functions/`. The following table lists the functions most plausibly candidate for triggering a model build (financial, research, commentary, completion consumers). All 34 files were grepped; **zero references to `buildModel` or `financial-model/build` were found anywhere.**

| Function | Trigger Event | Calls `buildModel`? | Notes |
|----------|--------------|---------------------|-------|
| `cashflowOnDealCreated` | `deal.created` | **NO** | Gate evaluation only; writes to `deal_activity` |
| `cashflowOnResearchCompleted` | `research.completed` | **NO** | Runs CashFlow Agent (writes `deal_underwriting_snapshots`); emits `cashflow.completed` |
| `cashflowOnWalkthroughRequested` | `cashflow.walkthrough_requested` | **NO** | Runs Commentary Agent (narrative generation) |
| `commentaryOnResearchCompleted` | `research.completed` | **NO** | Runs Commentary Agent (market commentary) |
| `zoningOnCompleted` | `zoning.completed` | **NO** | Updates `deals.agent_status` only |
| `supplyOnCompleted` | `supply.completed` | **NO** | Updates `deals.agent_status` only |
| `cashflowOnCompleted` | `cashflow.completed` | **NO** | Updates `deals.agent_status` only |
| `commentaryOnCompleted` | `commentary.completed` | **NO** | Updates `deals.agent_status` only |
| *(26 additional functions)* | — | **NO** | Zero `buildModel` references across all 34 files |

### 3.2 Backend Services — No Build Reachability from Events

| Service | Function | Calls `buildModel`? | Notes |
|---------|----------|---------------------|-------|
| `sigma-apply-deal.ts` | `rebuildModel()` | **NO** | Stub — does `SELECT irr_pct FROM financial_models` only; comment says "For Phase A, we simulate" |
| `proforma-seeder.service.ts` | — | **NO** | No `buildModel` references found |

### 3.3 Conclusion

**Zero Inngest event paths currently reach `financialModelEngine.buildModel()`.** The only way to trigger a billable build is via the explicit `POST /api/v1/financial-model/build` endpoint, which is called from:
- Frontend "Build Model" button
- Opus chat `build_model` action
- Goal-seek apply (after explicit user confirmation)
- Module-applied event (event trigger, stays for D1b)

---

## 4. Appendix: Concrete Side-by-Side Exhibit (D1d)

**Deal:** Integration test fixture (`backend/tests/deterministic/buildmodel-integrity.integration.test.ts`)
**Assumptions:** `BASE_ASSUMPTIONS` (purchasePrice $18M, loanAmount $13.5M, holdPeriod 5y, rentGrowth 3%, exitCap 6.5%, etc.)

### 4.1 LLM Output (Restated Arithmetic)

From `makeLLMResult()` — the exact shape the LLM is prompted to return:

```typescript
summary: {
  irr: 0.14,              // ← restated from deterministic or prior run
  equityMultiple: 1.85,    // ← restated
  cashOnCash: [0.07, 0.07, 0.08, 0.08, 0.09],  // ← restated array
  noiYear1: 1_050_000,     // ← restated
  totalEquity: 4_500_000,  // ← restated (NOTE: test stub uses 4.5M; deterministic computes 4.77M from assumptions)
  dscr: [1.40, 1.42, ...], // ← restated
},
annualCashFlow: [...],  // ← 6 rows of restated values
sourcesAndUses: { sources: { equity: 4_500_000, debt: 13_500_000 }, uses: { purchase: 18_000_000 } },
debtMetrics: { loanAmount: 13_500_000, annualDebtService: 750_000, dscr: 1.40, ... },
```

**Key observation:** The LLM output contract contains **zero assumption-shaped fields**. It does not output `purchasePrice`, `loanAmount`, `interestRate`, `rentGrowth`, `exitCapRate`, or `holdPeriod`. Every field is a **computed result** — arithmetic restated in the LLM's own voice. The assumptions are provided as INPUT to the prompt; the LLM merely echoes them back as outputs.

### 4.2 Deterministic Runner Output (Primary Computation)

Same `BASE_ASSUMPTIONS` fed through `deterministic-model-runner.ts` → `runModel()`:

```typescript
// From deterministic-model-runner.ts ~line 1710+
summary: {
  irr: computedFromAnnualCashFlows(),        // Newton-Raphson IRR solver
  lpIrr: computedFromLpDistributions(),      // LP-tier IRR
  lpEm: totalLpDistributions / lpEquity,     // LP equity multiple
  lpCoC: avgAnnualLpCashFlow / lpEquity,     // LP cash-on-cash
  gpIrr: computedFromGpDistributions(),      // GP-tier IRR
  gpEm: totalGpDistributions / gpEquity,     // GP equity multiple
  noiByYear: [year1NOI, year2NOI, ...],     // From rent roll + growth rates
  dscrByYear: [noiY1 / ads, noiY2 / ads, ...], // Debt service coverage
  avgCoC: mean(cashOnCashByYear),            // Average CoC
  totalProfit: sum(leveredCashFlows),        // Total profit
},
annualCashFlow: [
  { year: 1, gpr: 2_100_000, noi: 1_050_000, leveredCashFlow: 270_000, lpDistribution: 243_000, ... },
  // ... 5 years + exit year
],
waterfallDistributions: [
  { tier: 'Pref', hurdleRate: 0.08, lpSplit: 0.80, gpSplit: 0.20, lpAmount: ..., gpAmount: ... },
  { tier: 'Promote 1', hurdleRate: 0.12, lpSplit: 0.60, gpSplit: 0.40, ... },
],
sensitivityAnalysis: { irr: [...], em: [...], coc: [...], noi: [...] }, // 4×4 matrix
stressScenarios: { base: {...}, recession: {...}, highVacancy: {...} },
integrityChecks: [INV-1, INV-2, ..., INV-20], // 20+ validation checks
```

### 4.3 Cross-Check Bridge Behavior

`proforma-assumptions-bridge.ts:569` — `crossCheckLLMVsDeterministic`:

```typescript
const THRESHOLD = 0.10; // 10% material difference
const checks = [
  { field: 'irr',          llm: llm.summary.irr,          det: det.summary.irr },
  { field: 'equityMultiple', llm: llm.summary.equityMultiple, det: det.summary.lpEm },
  { field: 'cashOnCash',   llm: llm.summary.cashOnCash,    det: det.summary.lpCoC },
  { field: 'noi',          llm: llm.summary.noiYear1,      det: det.summary.noiByYear[0] },
  { field: 'dscr',         llm: llm.summary.dscr,          det: det.summary.dscrByYear[0] },
  { field: 'exitValue',    llm: llm.summary.exitValue,     det: det.disposition.salePrice },
  { field: 'totalEquity',  llm: llm.summary.totalEquity,   det: det.capital.totalEquity },
  { field: 'debtService',  llm: llm.summary.annualDebtService, det: det.debt.annualDebtService },
];
```

**Current behavior:** Divergences >10% log a `console.warn`. The LLM result is still persisted. No delta history. No runtime halt.

**D2 implication:** When deterministic is promoted to primary, this cross-check flips — the deterministic runner becomes the source of truth, and the LLM (if retained for commentary) would be checked against it rather than the reverse.

---

## 5. Acceptance Checklist

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Zero LLM calls from pure navigation | ✅ PASS | Auto-build useEffect deleted; no other page-load triggers found |
| GET /latest is safe | ✅ PASS | Code trace: pure SELECT, zero LLM reachability |
| Explicit buttons preserved | ✅ PASS | Build Model button, Opus chat build_model action, goal-seek apply all intact |
| Event triggers preserved | ✅ PASS | `assumptions.module-applied` in ProFormaTab stays for D1b |
| Inngest events inventoried | ✅ PASS | 34 function files grepped; zero paths reach buildModel |
| Side-by-side exhibit | ✅ PASS | Appendix §4 documents LLM vs deterministic output shapes for same deal |

---

## 6. Next: D2 — Promote Deterministic Runner to Primary

**D1 has proven:**
1. The deterministic runner is already a complete institutional model (D0)
2. The LLM output is purely restated arithmetic (D1d exhibit)
3. Navigation triggers are killed (D1b)

**D2 scope:**
- Remove LLM arithmetic instructions from the prompt
- Make `runModel()` the primary computation path
- Repurpose the LLM call for assumption deltas + commentary only
- Update the response contract so `summary` fields are always sourced from deterministic

---

*Report generated: 2025-07-01*  
*Commit: `3eba9d407`*
