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
IRR=-20.95%, EM=0.3144×, NOI Y1=$1,576,800, DSCR Y1=1.0424.
assumptions blob 13,407 chars. Phase 2B identity checkpoint PASS (exact match, server-fetch path).

## Phase 2B arc close (2026-07-07)
B1/B6/B7/B8/B9 all executed and verified. B2/B3/B4/B5 carried as named residuals.
Close report: `docs/architecture/FP1_PHASE2B_ARC_CLOSE.md`.
- B7: DROP migration applied (`20260707_drop_da_retired_scalars.sql`). Scalar columns gone.
- B1: `/build` now rejects any `assumptions` body (F-P1-B1 error). Server-fetch only.
- B8: ProFormaTab MonthlyProjectionRow + ⚑ FLOOR badge + T3 occupancy row rendered.
- B9: `computeNonFloridaTax` gains `millageUnit` guard; F-P1-B9 thrown on per_100 without conversion.

## ts-node identity check pattern for financialModelEngine (2026-07-07)
`buildModel(dealId, undefined)` crashes at `hashAssumptions(undefined)` because the server-fetch path
lives in the ROUTE (`buildAssumptionsFromStore`), NOT inside `buildModel`. To run identity checks via
ts-node, replicate the route pattern: load assumptions from DB first, then pass to `buildModel`.
```ts
const r = await pool.query(`SELECT assumptions FROM deal_financial_models WHERE deal_id=$1 AND status='complete' ORDER BY created_at DESC LIMIT 1`, [dealId]);
const assumptions = r.rows[0].assumptions;
const { result } = await financialModelEngine.buildModel(dealId, assumptions, 'identity-check');
```

**Why:** buildModel expects a real ProFormaAssumptions object; passing undefined causes a crypto hash crash
before any DB fetch. The server-fetch abstraction is a route-layer concern.

## Highlands baseline note (2026-07-07)
Highlands (`eaabeb9f`) `deal_assumptions.year1` is empty `{}` and stored `deal_financial_models.results`
is also empty `{}`. Post-2B build shows IRR=16.18%/NOI=$3.40M — drift from Phase 2A scratchpad ref
(17.89%/$3.81M) is from CPI anchor updates + D-MOD resolver evolution, not a B-item regression.
Bishop is the primary identity reference deal.
