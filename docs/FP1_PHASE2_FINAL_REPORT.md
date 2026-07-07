# F-P1 Phase 2 — Assumption Store Consolidation: Final Arc Report
**Date:** 2026-07-07  
**Arc:** F-P1 Phase 2 — Operator Rulings R1–R10 per `DISPATCH_FP1_PHASE2_GO_1783393223118.md`

---

## 1. Execution Status

| Step | Ruling | Status | Notes |
|------|--------|--------|-------|
| M-A migration | R10 | ✅ DONE | deal_financial_models.deal_id varchar→uuid; deal_assumption_overlays created; exit_valuation_basis added |
| F-P1-A server-fetch | — | ✅ DONE | buildAssumptionsFromStore() + /build serverFetch flag |
| Equivalence proof | R4 | ✅ DONE | Bishop id=346; same 13,407-char blob; deterministic section provably identical |
| Retire client path | R4 | ⏳ PENDING | Blocked on operator review of checkpoint report |
| R1 tag fix | R1 | ✅ DONE | mapSourceLabel: 'actuals'/'historical_actual' → 't12' |
| R2 honest absence | R2 | ✅ DONE | proforma.routes.ts: reason: 'no_underwriting — owned_import' when no build |
| M-L 7-field monthly slice | R5 | ✅ DONE | monthlyProjection in FinancialModelResult type + bridge |
| R6 tax extract | R6/R6b | ✅ DONE | tax-schedule-extract.ts seam; runner imports; identity checkpoints PASS |
| R9 scalar retirement | R9 | ✅ DONE | Writes to irr_levered, equity_multiple, noi_stabilized, rent_growth_yr1 removed; drop deferred to F-P1t |

---

## 2. Phase-1 Divergence Dispositions (dispatch §4)

The Phase-1 audit identified 6 divergences. Each is disposed below.

| # | Divergence | Disposition |
|---|------------|-------------|
| D1 | `year1.noi.resolution` tagged `platform_fallback` for actuals-derived NOI | **Fixed by R1** — `mapSourceLabel` now maps `actuals`/`historical_actual`/`actual_data` → `t12` |
| D2 | No honest absence signal for `owned_import` deals with no build | **Fixed by R2** — proforma GET returns `modelNotBuilt: true, reason: 'no_underwriting — owned_import'` when deal_archetype = 'owned_import' and no model exists |
| D3 | `deal_financial_models.deal_id` stored as varchar, joins lose uuid semantics | **Fixed by R10/M-A** — column migrated to uuid; 2 orphan rows (id='464') deleted |
| D4 | Output-scalar columns (`irr_levered`, `equity_multiple`, `noi_stabilized`, `rent_growth_yr1`) denormalized into `deal_assumptions` | **Fixed by R9** — compute-returns route and Batch 4/5 sync no longer write these columns; `rent_growth_yr1` lives in `deal_assumptions.year1.rent_growth_yr1` (LayeredValue). DROP migration deferred to F-P1t per operator ruling |
| D5 | Monthly cashflow slice not surfaced in `/latest` response | **Fixed by R5/M-L** — `monthlyProjection` (7 fields: month, year, occupancy, effectiveVacancy, floorBinding, vacancyLoss, noi) added to `FinancialModelResult`. **TS-2 UNBLOCKED** per R5 landing instruction |
| D6 | Tax schedule computed inline in runner with no seam for trigger-model extension | **Fixed by R6** — `computeFloridaTax`/`computeNonFloridaTax` extracted to `tax-schedule-extract.ts`; constants (`FL_REASSESS_PCT=0.85`, `FL_CAP_INCREASE=0.10`, `FL_DEF_MILLAGE=0.0218`) canonical in seam; runner imports via aliases; behavior-identical (identity PASS: FL Y1 tax $1,111,800 on $60M purchase) |

---

## 3. Identity Checkpoints

### Bishop deal (3f32276f) — reference model id=346
```
Pre-arc baseline (stored):
  IRR           : -20.95%
  Equity Multiple: 0.3144×
  NOI Year 1    : $1,576,800
  DSCR Y1       : 1.0424

Post-arc: No model rebuild run (behavioral changes are in write/tag paths, not
the deterministic runner math). Next Bishop build will include R5 monthlyProjection
and will NOT write irr_levered/equity_multiple/noi_stabilized to deal_assumptions.

R6 identity (tax schedule):
  computeFloridaTax($60M, hold=5) → Y1: $1,111,800 ✓ (= 60M × 0.85 × 0.0218)
  Constants behavior-identical: DEF_REASSESS_PCT=FL_REASSESS_PCT=0.85 ✓
```

### Highlands (eaabeb9f) — owned_import
```
R2: GET /api/v1/proforma/eaabeb9f-830e-44f9-a923-56679ad0329d
  → modelNotBuilt: true, reason: 'no_underwriting — owned_import'
    (when no model exists)
  → model returned normally (when user-triggered build exists, e.g. 2026-07-03)
Highlands' 2026-07-03 build is historical artifact — not deleted.
```

---

## 4. New Files and Changes

### New files
| File | Purpose |
|------|---------|
| `backend/src/database/migrations/20260707_fp1_ma_dark_schema.sql` | M-A: uuid cast + dark overlays table + exit_valuation_basis |
| `backend/src/services/tax/tax-schedule-extract.ts` | R6 seam: computeFloridaTax, computeNonFloridaTax, canonical constants |
| `docs/FP1_PHASE2A_CHECKPOINT.md` | Checkpoint gate report (M-A + equivalence proof) |

### Modified files
| File | Change |
|------|--------|
| `backend/src/api/rest/financial-model.routes.ts` | buildAssumptionsFromStore() + serverFetch path in /build |
| `backend/src/services/financial-model-engine.service.ts` | R9: rent_growth_yr1 write removed from Batch 4/5 |
| `backend/src/services/deterministic/deterministic-model-runner.ts` | R6: import computeFloridaTax/computeNonFloridaTax from extract; const aliases |
| `backend/src/services/deterministic/proforma-assumptions-bridge.ts` | M-L: 7-field monthlyProjection slice in modelResultsToFinancialModelResult |
| `backend/src/services/financial-model-engine.service.ts` | M-L: monthlyProjection field in FinancialModelResult type |
| `backend/src/agents/cashflow.postprocess.ts` | R1: mapSourceLabel maps 'actuals' variants → 't12' |
| `backend/src/api/rest/proforma.routes.ts` | R2: owned_import honest absence reason field |
| `backend/src/api/rest/deal-assumptions.routes.ts` | R9: irr_levered, equity_multiple, noi_stabilized writes removed from compute-returns |

---

## 5. Deferred Items (not in this arc scope)

| Item | Deferred to |
|------|------------|
| F-P1-A: retire React local-state write path (T003) | Next session — requires operator checkpoint approval |
| R3: decompose scenarios + shadow-read verification reader | M-F — own gated dispatch |
| R7: W4c blob map (M-I census) | Own gated step |
| R8: trending fields (rent_growth, other_income_growth, expense_growth.*) | D3 step — own dispatch |
| R9: DROP migration for irr_levered, equity_multiple, noi_stabilized, rent_growth_yr1 | F-P1t dispatch |
| F-P1t: trigger model (full four-door trend, trigger-reset basis) | Next dispatch after F-P1 core |
| TS-2: monthlyProjection → grid (now UNBLOCKED by R5 landing) | Small separate dispatch |

---

## 6. Compile / Runtime Verification

```bash
# tax-schedule-extract.ts loads independently:
computeFloridaTax($60M, hold=5).perYear[0] = $1,111,800 ✓

# deterministic-model-runner.ts loads with R6 import:
DEF_UNDERWRITING_VACANCY_FLOOR exported ✓
computeFloridaTax NOT exported (R6 — no external consumers) ✓
Module loaded successfully ✓

# Backend: HTTP 401 (auth working, server responding) ✓
```
