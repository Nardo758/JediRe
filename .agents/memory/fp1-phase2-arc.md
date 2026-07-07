---
name: F-P1 Phase 2 arc decisions
description: Key schema changes, extract patterns, and deferred items from the F-P1 Phase 2 store consolidation arc.
---

## R9 scalar retirement (2026-07-07)
Writes to `deal_assumptions.irr_levered`, `equity_multiple`, `noi_stabilized`, `rent_growth_yr1` removed. Columns still exist in DB — DROP migration deferred to F-P1t dispatch. `rent_growth_yr1` value now lives exclusively in `deal_assumptions.year1.rent_growth_yr1` (LayeredValue via scenario trigger). Reader at `proforma-adjustment.service.ts:3116` still reads the scalar (will get stale value) — repoint is T003 in #1873.

**Why:** Operator ruling R9 — "derive-not-store violations." These scalars are computable from `deal_financial_models.results` and should not be denormalized into `deal_assumptions`.

**How to apply:** Any new output metric from the engine MUST NOT be written to `deal_assumptions` scalar columns. Read from `deal_financial_models.results.summary.*` instead.

## R6 tax extract seam (2026-07-07)
`computeFloridaTax` and `computeNonFloridaTax` extracted from `deterministic-model-runner.ts` to `backend/src/services/tax/tax-schedule-extract.ts`. Runner imports them with `const DEF_* = FL_*` aliases — zero diff in runner body. No re-export from runner (no external consumers found). Constants: `FL_REASSESS_PCT=0.85`, `FL_CAP_INCREASE=0.10`, `FL_DEF_MILLAGE=0.0218`. Identity checkpoint passed: FL Y1 tax $1,111,800 on $60M purchase.

**Why:** R6 ruling — runner inline tax logic prevents F-P1t trigger model extension. Seam is the extension point.

**How to apply:** F-P1t (trigger model) adds trigger-reset logic by extending `tax-schedule-extract.ts`, not the runner. Do NOT add new tax logic inline in the runner.

## F-P1-A server-fetch path (2026-07-07)
`buildAssumptionsFromStore(dealId, pool)` in `financial-model.routes.ts` reads `deal_financial_models.assumptions` for the latest complete build. `/build` endpoint: `serverFetch: true` or absent `assumptions` body → server-fetch path. Response includes `assumptionsSource: 'server_store' | 'client'`. T003 (retire React client path) is blocked on operator review of equivalence proof at `docs/FP1_PHASE2A_CHECKPOINT.md`.

**Why:** F-P1 ruling — client-supplied assumptions create local-state divergence risk. Server-fetch eliminates it.

## M-A dark schema (2026-07-07)
`deal_assumption_overlays` table created (dark — zero readers until M-F scenario decomposition). `deal_financial_models.deal_id` migrated varchar→uuid. `deal_assumptions.exit_valuation_basis` added (`CHECK IN ('cap_rate','gross_rev_multiple','ppu')`). 2 orphan rows (deal_id='464', error status) deleted before uuid cast.

## Bishop reference baseline (epoch 2026-07-06)
deal_id: `3f32276f-aacd-4da3-b306-317c5109b403`, model id=346.
IRR=-20.95%, EM=0.3144×, NOI Y1=$1,576,800, DSCR=[1.0424, 1.1217, 1.1137, 1.0891, 0.0758].
assumptions blob 13,407 chars. Next rebuild adds monthlyProjection (R5).
