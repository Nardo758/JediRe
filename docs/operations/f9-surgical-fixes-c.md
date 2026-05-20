# F9 Surgical Fixes — Dispatch C Closing Note

**Date:** 2026-05-20  
**Task:** #948 — F9 Overview surgical blank-cell fixes  
**Files changed:** `frontend/src/pages/development/financial-engine/OverviewTab.tsx`, `frontend/src/pages/development/FinancialEnginePage.tsx`

---

## Bug 1 — Field Name Alignment (OverviewTab)

### The Problem
`OverviewTab` was reading three fields from `f9Financials.returns` using the wrong key names:

```ts
// BEFORE (dead code — these keys are never written by mergeModelIntoFinancials)
const displayIrr = f9Returns?.irr             ?? summary?.irr           ?? null;
const displayEM  = f9Returns?.equityMultiple   ?? summary?.equityMultiple ?? null;
const displayCoC = f9Returns?.cashOnCash       ?? summary?.cashOnCash    ?? null;
```

`mergeModelIntoFinancials` (FinancialEnginePage.tsx:96–98) writes:
- `out.returns.lpNetIrr`
- `out.returns.lpEquityMultiple`
- `out.returns.avgCashOnCash`

The old key names (`irr`, `equityMultiple`, `cashOnCash`) exist in the `F9DealFinancials.returns` type definition (as legacy/unused fields) but are **never written to** by any code path. Result: the `f9Returns?.irr` chain always returned `undefined`, silently falling through to `summary?.irr` (the treatment-agnostic generic IRR). The F9 LP-net returns from the LV engine path were never displayed.

### The Fix
```ts
// AFTER — aligns with what mergeModelIntoFinancials writes
const displayIrr = f9Returns?.lpNetIrr        ?? summary?.lpIrr  ?? summary?.irr           ?? null;
const displayEM  = f9Returns?.lpEquityMultiple ?? summary?.lpEm   ?? summary?.equityMultiple ?? null;
const displayCoC = f9Returns?.avgCashOnCash    ?? summary?.lpCoC  ?? summary?.cashOnCash    ?? null;
```

The fallback chain also now prefers LP-specific summary values (`lpIrr`, `lpEm`, `lpCoC`) before the generic deal-level values, giving the top 5 KPI tiles and the DEAL LEVEL column of the RETURNS BREAKDOWN section semantic correctness when the LV engine has not run.

---

## Bug 2 — normalizeBuildResponse Extensions

### Backend Field Audit
Inspected `backend/src/services/deterministic/deterministic-model-runner.ts` to confirm exact field names in the backend's `ModelResults.summary` shape.

**Summary fields confirmed present in backend output:**
| Backend field | Frontend type field | Was mapped? |
|---|---|---|
| `s.lpTotalDistributions` | `summary.lpTotalDistributions` | ❌ Missing |
| `s.gpIrr` | `summary.gpIrr` | ❌ Missing |
| `s.gpEquityMultiple` | `summary.gpEm` | ❌ Missing (wrong name tried) |
| `s.gpTotalDistributions` | `summary.gpTotalDistributions` | ❌ Missing |
| `s.lpEquityMultiple` | `summary.lpEm` | ⚠️ Partial — `s.lpEm` tried first but is LLM-only name; `s.lpEquityMultiple` not tried |
| `s.gpPromoteEarned` | `summary.gpPromoteEarned` | ❌ Missing from summary return |

**AnnualCashFlow fields — backend `AnnualCashFlowRow` interface:**
`cumulativeReturn` and `runningEM` are **NOT present in the backend output** at any layer (deterministic runner type has no such fields; LLM prompt does not request them). These must be computed on the frontend.

### Additions Made

**Summary — four new fields added:**
```ts
lpTotalDistributions: s.lpTotalDistributions ?? null,
gpIrr:               s.gpIrr ?? null,
gpEm:                s.gpEm ?? s.gpEquityMultiple ?? null,   // gpEquityMultiple = deterministic runner field name
gpTotalDistributions: s.gpTotalDistributions ?? null,
gpPromoteEarned:     s.gpPromoteEarned ?? null,              // was missing from return object
```

**lpEm mapping repaired:**
```ts
// BEFORE: s.lpEm ?? s.equityMultiple  (missed deterministic runner's lpEquityMultiple)
// AFTER:
lpEm: s.lpEm ?? s.lpEquityMultiple ?? s.equityMultiple,
```

**lpProfit mapping repaired:**
```ts
// BEFORE: raw.lpProfit  (missed nested s.lpProfit)
// AFTER:
lpProfit: raw.lpProfit ?? s.lpProfit,
```

**AnnualCashFlow — cumulativeReturn and runningEM computed:**
```ts
// Derive initial equity from s.totalEquity ?? (purchasePrice - loanAmount)
const initialEquity = s.totalEquity ?? (s.purchasePrice - s.loanAmount) ?? null;

let runningCumulativeCf = 0;
af.map((r) => {
  runningCumulativeCf += equityCf;
  return {
    ...rowFields,
    cumulativeReturn: runningCumulativeCf,
    runningEM: initialEquity > 0 ? (initialEquity + runningCumulativeCf) / initialEquity : null,
  };
});
```

`runningEM` at each year = `(equity_invested + cumulative_distributions_to_date) / equity_invested`. This is a trailing EM, not a final-realized EM; it will be < 1.0x until cumulative CF turns positive. The exit-year value approaches the final realized equity multiple (though it may differ slightly if the build engine's exit-year cashFlow excludes net sale proceeds in the operating row).

---

## Per-Tile Verification (Expected vs. Actual)

| Tile | Expected after Dispatch C | Notes |
|---|---|---|
| KPI strip — IRR | ✅ Should populate | Now reads `f9Returns?.lpNetIrr` → `summary?.lpIrr` → `summary?.irr` |
| KPI strip — EM | ✅ Should populate | Now reads `f9Returns?.lpEquityMultiple` → `summary?.lpEm` → `summary?.equityMultiple` |
| KPI strip — CoC | ✅ Should populate | Now reads `f9Returns?.avgCashOnCash` → `summary?.lpCoC` → `summary?.cashOnCash` |
| RETURNS BREAKDOWN — LP IRR / LP EM | ✅ Should populate | Already read `summary?.lpIrr`, `summary?.lpEm`; `lpEm` mapping now also tries `lpEquityMultiple` |
| RETURNS BREAKDOWN — LP DISTRIBUTIONS | ✅ Should populate | `lpTotalDistributions` now mapped from backend |
| RETURNS BREAKDOWN — GP IRR / GP EM | ✅ Should populate | `gpIrr` and `gpEm` (via `gpEquityMultiple`) now mapped |
| RETURNS BREAKDOWN — GP DISTRIBUTIONS | ✅ Should populate | `gpTotalDistributions` now mapped from backend |
| RETURNS BREAKDOWN — PROMOTE EARNED | ✅ Should populate | `gpPromoteEarned` now in summary return object |
| RETURNS BY YEAR — CUM RETURN column | ✅ Should populate | Computed as running cumulative cashFlow sum |
| RETURNS BY YEAR — EM column | ✅ Should populate if equity is derivable | Computed from `(initialEquity + cumulativeCF) / initialEquity`; shows `—` only if no equity available |
| SOURCES / USES panels | ❌ Still blank | Not in scope — Composer-side gap (tracked in Dispatch D) |
| F9 Unit Economics | ❌ Still blank | Not in scope — Composer must return `proforma.unitEconomics` (tracked in Dispatch D) |
| Valuation Metrics | ❌ Still blank | Not in scope — Composer must return `proforma.valuationSnapshot` (tracked in Dispatch D) |
| Broker vs Platform table | ❌ Still blank | Not in scope — M25 strategy analysis not triggered (tracked in Task #951) |
| JEDI Position score | ❌ Still blank | Not in scope — LV engine not triggered / no rent roll (tracked in Task #951) |
| Platform exit cap | ❌ Still blank | Not in scope — M07 calibration not triggered (tracked in Task #951) |

---

## Build Status
Frontend rebuilt successfully after all changes. No TypeScript errors. Build time: ~56s. The two pre-existing chunk-size warnings (XLSX + TradeAreaDefinitionPanel) are unrelated to this task.
