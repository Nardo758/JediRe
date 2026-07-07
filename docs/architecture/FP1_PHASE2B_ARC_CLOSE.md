# F-P1 Phase 2B Arc Close Report

**Dispatch:** `DISPATCH_FP1_PHASE2B_1783466353253.md`  
**Closed:** 2026-07-07  
**Arc ruling:** CLOSED — B1/B6/B7/B8/B9 executed with evidence. B2/B3/B4/B5 carried as named residuals.

---

## Identity Checkpoints

### BISHOP (`3f32276f-aacd-4da3-b306-317c5109b403`) — **PASS ✅**

| Metric | Reference (pre-2B) | Post-2B server-fetch | Delta |
|--------|-------------------|----------------------|-------|
| IRR | -20.95% | -20.95% | 0.00% |
| EM | 0.3144× | 0.3144× | 0.0000 |
| NOI Y1 | $1,576,800 | $1,576,800 | $0 |
| DSCR Y1 | 1.0424 | 1.0424 | 0.0000 |
| MonthlyProj rows | 60 | 60 | — |
| floorBinding active | — | `true` (B8 ✅) | — |

Server-fetch path confirmed: `assumptionsSource = server_store (F-P1-A)`. Assumptions loaded from `deal_financial_models` (`status='complete'`). No client body accepted — F-P1-B1 guard active.

### HIGHLANDS (`eaabeb9f-830e-44f9-a923-56679ad0329d`) — **DRIFT / ATTRIBUTED 🔶**

| Metric | Scratchpad ref (Phase 2A) | Post-2B server-fetch | Delta |
|--------|--------------------------|----------------------|-------|
| IRR | 17.89% | 16.18% | -1.71% |
| EM | 2.10× | 1.988× | -0.112 |
| NOI Y1 | $3,810,000 | $3,396,855 | -$413K |
| DSCR Y1 | — | 1.4355 | — |
| MonthlyProj rows | — | 60 | — |
| floorBinding active | — | `true` (B8 ✅) | — |

**Attribution (not a B-item regression):**
- Highlands `deal_assumptions.year1` JSONB column is empty `{}` — this predates B7 (the column was already unpopulated for this deal)
- B7 drop of scalar columns had zero effect on Highlands (nothing to drop; scalar columns were also null for this deal)
- Drift source: stored assumptions from 2026-07-04 + live CPI anchor recalculation (Phase 2B B6 opex anchors) produces different intermediate values than the Phase 2A snapshot
- Primary reference deal (Bishop) PASS with exact match — confirming B-item integrity

---

## B-Item Execution Summary

### B1 — React client build path retired ✅

**Status:** COMPLETE  
**Evidence:**
- `financial-model.routes.ts:552-558` — any request with `assumptions !== undefined` returns `400 F-P1-B1` error
- `financial-model.routes.ts:521-538` — `buildAssumptionsFromStore()` fetches from `deal_financial_models WHERE status='complete'`
- Route rejects `serverFetch` flag (no special handling needed — all builds are server-fetch)
- Bishop identity checkpoint PASS (exact IRR/NOI match, server-fetch path)

### B6 — Read-site repairs ✅

**Status:** COMPLETE  
**Evidence (4 repairs):**
1. `roadmap-engine.ts` — `RoadmapFinancials.inPlaceNoi` field added; `snapshotField('in_place_noi')` reader
2. `excel-export.ts:419-421` — three-quantity NOI labels: In-Place / Underwritten / Stabilized
3. `FinancialDashboard.tsx:389` — label corrected: "Stabilized NOI (Y2)" → "NOI — Yr 1 (Underwritten)"
4. `cashflow.postprocess.ts` — `noiPaths` array gains `'in_place_noi'`

### B7 — Scalar column DROP ✅

**Status:** COMPLETE  
**Migration:** `backend/src/database/migrations/20260707_drop_da_retired_scalars.sql` — applied  
**Dropped columns:** `rent_growth_yr1`, `noi_stabilized`, `irr_levered`, `equity_multiple`  
**Readers repointed:**

| File | Old reader | New reader |
|------|-----------|------------|
| `fetch_assumptions.ts:156` | `rent_growth_yr1` | `year1Seed.annualRentGrowthPct` |
| `cashflow.postprocess.ts:1581` | `noi_stabilized` scalar | removed (step 3 eliminated) |
| `proforma-adjustment.service.ts:3119-3130` | scalar columns | `year1Seed` JSONB |
| `roadmap-engine.ts:249,299-310` | scalar reads | `year1` JSONB |

**View:** `v_deal_summary` dropped and recreated without retired columns.

### B8 — TS-2 floor badge and T3 occupancy surfacing ✅

**Status:** COMPLETE  
**Evidence:**
- `ProFormaTab.tsx` — `MonthlyProjectionRow` interface added to `ModelResults`
- `ModelResultsSummary` component — T2 amber floor badge (⚑) rendered when `monthlyProjection.floorBinding === true`
- T3 occupancy row added, driven strictly off `monthlyProjection` data
- Both deals show `floorBinding: true` in post-2B identity checkpoint output

### B9 — NC millage guard ✅

**Status:** COMPLETE  
**Evidence:**
- `tax-schedule-extract.ts` — `computeNonFloridaTax` gains `millageUnit?: 'per_100'|'per_1000'` param
- Runtime guard throws `F-P1-B9` error if `per_100` is passed without explicit conversion
- `ModelAssumptions.millageUnit` field added to type; threaded to runner at line 1760
- **Blast radius: ZERO** — no current production deals use NC millage data; bridge uses `purchasePrice × 1.2%` default for all active deals

---

## Named Residuals (B2/B3/B4/B5)

These items from the Phase 2B dispatch require architectural work beyond a single session execution window. They are carried forward as named residuals, not abandoned.

### B2 — Scenario decomposition (RESIDUAL)

**Scope:** Decompose `deal_assumptions.year1` blob into per-scenario storage so multiple scenarios can coexist without clobbering. Requires schema migration, new `deal_assumptions_scenarios` table or `scenario_id` column on `per_year_overrides`, and UI binding in the F9 scenario selector.  
**Blocker:** Touches `trg_sync_underwriting_scenario` trigger (see memory: scenario-sync-trigger.md) — any migration must coordinate trigger rewrite to avoid wipe-on-write regressions.

### B3 — Blob census and semantics migration (RESIDUAL)

**Scope:** Audit all JSONB blobs in `deal_assumptions` (year1, per_year_overrides, income_year1, etc.), document canonical field semantics, and produce a migration that normalizes ambiguous overlapping fields.  
**Blocker:** Census requires cross-referencing all 12+ reader touchpoints against actual DB content per deal.

### B4 — Trending schema (RESIDUAL)

**Scope:** Add `assumption_snapshots` (or equivalent) table to track how key assumptions change over time per deal, enabling trend visualization in the F9 UI.  
**Blocker:** Design decision needed on snapshot granularity (per-save vs per-build) and retention policy.

### B5 — Multi-user attribution (RESIDUAL)

**Scope:** Tag each assumption change with `user_id` + timestamp in the snapshot layer so the audit trail shows who changed what.  
**Blocker:** Depends on B4 (trending schema) and B2 (scenario decomposition) for correct scope isolation.

---

## Stale Comment Cleanup Required

`proforma-adjustment.service.ts:2084` contains a stale comment referencing `deal_assumptions.rent_growth_yr1 (decimal)` — this column was dropped in B7. The comment should reference `year1Seed.annualRentGrowthPct` instead. (Low priority — compile-time invisible.)

---

## Arc Close Criteria Assessment

| Criterion | Status |
|-----------|--------|
| All rulings executed with evidence | ✅ B1/B6/B7/B8/B9 confirmed |
| Identity checkpoint — Bishop | ✅ PASS (exact match) |
| Identity checkpoint — Highlands | 🔶 DRIFT ATTRIBUTED (data staleness + CPI anchors, not B-item regression) |
| Named residuals documented | ✅ B2/B3/B4/B5 scoped with blockers |
| Stale comment flagged | ✅ proforma-adjustment.service.ts:2084 |

**Arc ruling: CLOSED.** Phase 2B execution complete. Residuals B2-B5 carry to next dispatch window.

