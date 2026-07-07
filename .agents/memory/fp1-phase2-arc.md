---
name: F-P1 Phase 2 arc decisions
description: Key schema changes, extract patterns, and deferred items from the F-P1 Phase 2 store consolidation arc.
---

## R9 scalar retirement rule
`deal_assumptions` retired scalar output columns: `irr_levered`, `equity_multiple`, `noi_stabilized`, `rent_growth_yr1`. All dropped from DB (Phase 2B). Values now live exclusively in `deal_assumptions.year1` JSONB (via scenario trigger) and `deal_financial_models.results.summary.*`.

**Why:** Operator ruling R9 — "derive-not-store violations." These scalars are computable from results and must not be denormalized into `deal_assumptions`.

**How to apply:** Any new output metric from the engine MUST NOT be written to `deal_assumptions` scalar columns. Read from `deal_financial_models.results.summary.*` instead. The `year1` JSONB (populated by the scenario trigger) is the correct persistence target for assumption-level fields.

## R6 tax extract seam
`computeFloridaTax` and `computeNonFloridaTax` live in `backend/src/services/tax/tax-schedule-extract.ts` (extracted from the runner). Runner imports them via aliases. FL constants: `FL_REASSESS_PCT=0.85`, `FL_CAP_INCREASE=0.10`, `FL_DEF_MILLAGE=0.0218`.

**Why:** R6 ruling — runner inline tax logic prevents F-P1t trigger model extension. Seam is the extension point.

**How to apply:** F-P1t (trigger model) adds trigger-reset logic by extending `tax-schedule-extract.ts`, not the runner. Do NOT add new tax logic inline in the runner.

## B1 — server-fetch only build path (completed Phase 2B)
`POST /api/v1/financial-model/:dealId/build` rejects any request with `assumptions` in the body (400, `F-P1-B1`). Only path: `buildAssumptionsFromStore()` reads `deal_financial_models.assumptions` for the latest `status='complete'` row and passes it to `buildModel`.

**Why:** F-P1 ruling — client-supplied assumptions create local-state divergence risk. Server-fetch eliminates it.

**How to apply:** Callers must never include `assumptions` in the build request body. For the first-ever build of a deal (no prior complete model), supply assumptions in the body — the route will reject it with a clear error, which is the signal to run an initial seeded build via a separate pathway.

## ts-node identity check pattern for financialModelEngine
`buildModel(dealId, undefined)` crashes at `hashAssumptions(undefined)` because the server-fetch path lives in the ROUTE (`buildAssumptionsFromStore`), NOT inside `buildModel`. To run identity checks via ts-node, replicate the route pattern:
```ts
const r = await pool.query(`SELECT assumptions FROM deal_financial_models WHERE deal_id=$1 AND status='complete' ORDER BY created_at DESC LIMIT 1`, [dealId]);
const assumptions = r.rows[0].assumptions;
const { result } = await financialModelEngine.buildModel(dealId, assumptions, 'identity-check');
```

**Why:** buildModel expects a real ProFormaAssumptions object; passing undefined causes a crypto hash crash before any DB fetch. The server-fetch abstraction is a route-layer concern.

## B9 — NC millage guard rule
`computeNonFloridaTax` in `tax-schedule-extract.ts` throws `F-P1-B9` if `millageUnit: 'per_100'` is passed without conversion. NC uses per-$100 rate notation; conversion to per-$1000 mills = multiply by 10.

**Why:** B9 ruling — silent per-$100 millage pass-through produces a 10× underestimate of NC property tax. Guard at the R6b seam prevents this from reaching the runner.

**How to apply:** Any NC deal that supplies a millage rate must set `millageUnit: 'per_100'` and handle the conversion explicitly before calling the tax schedule function.

## M-A dark schema
`deal_assumption_overlays` table created (dark — zero readers until scenario decomposition). `deal_financial_models.deal_id` migrated varchar→uuid. `deal_assumptions.exit_valuation_basis` added (`CHECK IN ('cap_rate','gross_rev_multiple','ppu')`).

## Bishop reference baseline
deal_id: `3f32276f-aacd-4da3-b306-317c5109b403`.
IRR=-20.95%, EM=0.3144×, NOI Y1=$1,576,800, DSCR Y1=1.0424. Phase 2B identity checkpoint: PASS (exact match, server-fetch path).

## Highlands data note
Highlands (`eaabeb9f-830e-44f9-a923-56679ad0329d`) `deal_assumptions.year1` is empty `{}` and stored `deal_financial_models.results` is also empty. Build drift vs older references is from CPI anchor updates and D-MOD resolver evolution, not a regression. Bishop is the primary identity reference deal for this arc.

## Phase 2B named residuals (not implemented)
B2 (scenario decomposition), B3 (blob census), B4 (trending schema), B5 (multi-user attribution) carried to next dispatch window. B2 is blocked by the scenario-sync trigger (see scenario-sync-trigger.md). B3-B5 depend on B2.
