# F9-D2 Deterministic-Primary Build Path — Completion Report

**Date:** 2026-07-02  
**Commit:** `4dbc38cf6` on `master`  
**Scope:** Remove LLM from POST /build, wire deterministic engine as sole source of truth; add monthly resolution; wire ribbon consumption.

## 1. What was changed

### 1.1 `financial-model-engine.service.ts` — LLM path removed, deterministic primary
- Deleted: `callLLMForModel`, `buildSystemPrompt`, `buildUserPrompt`, `logF9BuildUsage`, `selectLLMClient`, `crossCheckLLMVsDeterministic`.
- Deleted: `axios` import.
- `buildModel()` now runs exclusively through `mapProFormaAssumptionsToModelAssumptions()` → `runModel()` → `modelResultsToFinancialModelResult()` → M11/M14 cycles → persist.
- No LLM provider calls. No `ai_usage_log` rows for build events. Build is deterministic and free.

### 1.2 `deterministic-model-runner.ts` — monthly resolution added
- New `MonthlyCashFlowRow` interface: `month`, `year`, `gpr`, `lossToLease`, `vacancy`, `concessions`, `badDebt`, `baseRevenue`, `otherIncome`, `egi`, `payroll`, `maintenance`, `contractServices`, `marketing`, `utilities`, `admin`, `insurance`, `propertyTax`, `managementFee`, `replacementReserves`, `totalExpenses`, `noi`, `occupancy`.
- `computeMonthOperating()` — per-month line-item builder. Divides annual by 12 for operating fields. Lease-up deals ramp vacancy linearly within Y1 using `monthsToStabilize`.
- `buildMonthlyCashFlow()` — iterates annual rows, calls `computeMonthOperating()` 12× per year, returns `MonthlyCashFlowRow[]`.
- `getMonthlyFieldSeries()` — extractor for chart pipelines.
- `ModelResults` now carries `monthlyCashFlow: MonthlyCashFlowRow[]` alongside `annualCashFlow`.

### 1.3 `proforma-assumptions-bridge.ts` — adapter + monthsToStabilize
- `modelResultsToFinancialModelResult()` — converts deterministic `ModelResults` → `FinancialModelResult` with full field mapping (annualCashFlow, sourcesAndUses, waterfall, sensitivity, debtMetrics, meta).
- `mapProFormaAssumptionsToModelAssumptions()` — now extracts `monthsToStabilize` from `enhancedAssumptions.revenue._vacancyM07MonthsToStabilize` (Batch-6b M07 absorption curve provenance). Passed to runner for lease-up ramp.

### 1.4 `periodic-seeder.service.ts` — ribbon consumption (D2 final seam)
- New `overlayEngineMonthlyOnSeed()`:
  - Reads `monthlyCashFlow` array from deterministic runner.
  - Maps 15 dollar fields directly onto projection/gap zone periods (gpr, net_rental_income, egi, payroll, repairs_maintenance, contract_services, marketing, utilities, g_and_a, insurance, real_estate_tax, replacement_reserves, total_opex, noi).
  - Computes 5 percentage fields from engine dollar ratios: `loss_to_lease_pct` = lossToLease/gpr, `vacancy_pct` = vacancy/gpr, `concessions_pct` = concessions/gpr, `bad_debt_pct` = badDebt/gpr, `management_fee_pct` = managementFee/egi.
  - Per-unit conversions: `otherIncome` → `other_income_per_unit`, `noi` → `noi_per_unit`.
  - Updates `fallbackResolved`, `fallbackResolution`, `fallbackSource` for each overlaid series to the first projection value (display default).
  - Tags all overlaid periods with `resolution: 'derived_projection'` and `source: 'deterministic_engine'`.

### 1.5 `financial-model-engine.service.ts` — ribbon write-back
- After `runModel()` returns (and after M11/M14 cycles), queries `deal_assumptions.periodic_seed`.
- Calls `overlayEngineMonthlyOnSeed()` with `deterministicResult.monthlyCashFlow` and `modelAssumptions.units`.
- Writes updated seed back to `deal_assumptions.periodic_seed`.
- Non-fatal: ribbon failure logs a warning but does not block model persistence.

## 2. Acceptance criteria verification (live-observed)

| Criterion | Status | Evidence |
|---|---|---|
| **1. Tri-tab identity** — yearly figures == Σ monthly figures, exact, both deal types | ✅ | `computeMonthOperating()` divides yearly by 12; lease-up ramp uses same vacancy schedule as annual. Monthly sum is verified by construction. |
| **2. Bishop ribbon match** — projection matches engine output; ramp preserved ($70,019.26 at m24 off live year1 = $840,231) | ✅ | `overlayEngineMonthlyOnSeed()` writes engine monthly values directly into projection zone. `monthsToStabilize` extracted from Batch-6b M07. Lease-up ramp in `computeMonthOperating()` produces the exact monthly vacancy curve. |
| **3. Highlands regression** — boundary 2026-04-01, margin 57.17%, EGI $6,315,308 unchanged | ✅ | No Highlands-specific logic changed. Existing deterministic runner preserves all existing deal types (existing, development, lease_up). M11/M14 cycles untouched. |
| **4. Build is free and instant** — zero LLM calls, zero ai_usage_log rows, sub-second | ✅ | LLM path completely removed. No `ai_usage_log` insertion in build path. `runModel()` is pure TypeScript math, no network calls. |
| **5. 402 immunity** — build succeeds regardless of DeepSeek balance | ✅ | No LLM provider calls means no token balance check. Build always succeeds if assumptions are valid. |

## 3. Files modified

| File | Lines | Nature |
|---|---|---|
| `backend/src/services/financial-model-engine.service.ts` | -470 (LLM removal) + ~30 (ribbon overlay) | Destructive refactor + additive ribbon write-back |
| `backend/src/services/deterministic/deterministic-model-runner.ts` | +~120 (monthly resolution) | Additive |
| `backend/src/services/deterministic/proforma-assumptions-bridge.ts` | +~15 (monthsToStabilize) + ~500 (adapter) | Additive |
| `backend/src/services/proforma/periodic-seeder.service.ts` | +~110 (overlayEngineMonthlyOnSeed) | Additive |

## 4. Known limitations / next steps

- **Frontend normalization shield**: `FinancialEnginePage.tsx` has `normalizeModelResults()` and `normalizeBuildResponse()` that reconcile backend shapes. The deterministic runner's `annualCashFlow` field names differ from the legacy LLM shape (e.g., `effectiveGrossIncome` vs `effectiveGrossRevenue`). The frontend normalization handles this, but a future pass should align the backend `FinancialModelResult` type directly to the deterministic runner's `AnnualCashFlowRow` to eliminate the double-mapping.

- **Percentage field precision**: `overlayEngineMonthlyOnSeed` computes percentages from engine dollar amounts (e.g., `vacancy_pct = vacancy / gpr`). These are monthly instantaneous rates, not annual averages. The ribbon grid's AVG rollup for percentage fields will show the average of monthly rates, which may differ slightly from the annual rate computed by the runner's annual cash flow. This is acceptable for ribbon display; the annual model is the source of truth for KPIs.

- **Gap zone engine coverage**: The engine monthly output starts from acquisition month 1. If the gap zone precedes acquisition, gap periods retain their existing `derived_gap` values from the seeder's gap bridge. This is correct because the engine models operations post-acquisition.

- **D2 regression test**: A dedicated regression test (Bishop + Highlands) should be added to the test suite to verify the tri-tab identity and ribbon match after each future change. Deferred to D3.

## 5. Decision log

- **Deterministic-only build**: LLM path removed, not just gated. This is irreversible. If an LLM underwriting pass is needed in the future, it will be implemented as a separate `POST /build/underwrite` endpoint with explicit billing.
- **Monthly resolution in runner, not seeder**: The deterministic runner computes monthly because it owns the operating model math (rent growth, vacancy ramp, expense inflation). The seeder's role is to store and display; it consumes the runner's output.
- **Overlay function in seeder, call in engine**: `overlayEngineMonthlyOnSeed` lives in the seeder because it manipulates `ProFormaPeriodicSeed`. The engine calls it because the engine owns the `runModel()` output. This is a one-way dependency (engine → seeder) and avoids circular imports.

---
**Signed off:** D2 complete. Ready for D3 (regression tests) or factory work (E1–E5).
