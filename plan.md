# Plan: 6 Remaining Timeline/Lifecycle Items

## Architecture Dependency Graph

```
Phase 1 (Boundary facts) ──┐
                            ├──► Phase 2 (Periodic field model) ──► Phase 3 (Gap bridge)
Phase 6 (State machine) ────┘   │                                      │
                                └──► Phase 5 (F9 rendering)            │
                                                                       ▼
                                                                 Phase 4 (Reconciliation)
```

## Stage 1: Foundations (Phase 1 + Phase 6)

### Phase 1 — Boundary Facts
**Goal:** Add `actuals_through_month` and wire `closing_date` as proforma boundary.

**Tasks:**
1. Migration: add `actuals_through_month` (DATE) to `deals` table
2. Migration: add `acquisition_date` (DATE) to `deals` table (needed by Phase 6)
3. Update `proforma-seeder.service.ts` — read `actuals_through_month` as the actuals/projection boundary
4. Update `get-field-value.service.ts` — treat periods ≤ actuals_through_month as actual, periods > as projection
5. Update `buildAssumptionsFromYear1Seed` — pass boundary context to financial model

**Files:**
- `backend/src/database/migrations/2026XXXX_actuals_boundary_fields.sql`
- `backend/src/services/proforma-seeder.service.ts`
- `backend/src/services/get-field-value.service.ts`
- `backend/src/services/financials-composer.service.ts` (boundary-aware composition)

### Phase 6 — Lifecycle State Machine
**Goal:** Constrain `deals.status` to 8-state enum + transition guard service.

**Tasks:**
1. Migration: add `status` CHECK constraint (or enum type) to `deals` table
2. Migration: add `acquisition_date` to `deals` (already in Phase 1 — shared field)
3. Create `backend/src/services/lifecycle/transition-guard.service.ts`
   - `validateTransition(fromStatus, toStatus): { allowed, reason, sideEffects }`
   - Allowed transitions table per spec diagram
   - Side effects: acquisition_date set at CLOSED/OWNED, archived_at at HISTORICAL RECORD
4. Wire transition guard into `lifecycle.routes.ts` — all status changes go through guard
5. Update `deal_lifecycle_events` trigger — log every transition with `from_status`, `to_status`, `transitioned_at`, `reason`

**Files:**
- `backend/src/database/migrations/2026XXXX_deal_status_enum.sql`
- `backend/src/services/lifecycle/transition-guard.service.ts`
- `backend/src/api/rest/lifecycle.routes.ts`
- `backend/src/database/migrations/2026XXXX_lifecycle_events_trigger.sql`

**Parallelism:** Phase 1 and Phase 6 can run in parallel — they share one field (`acquisition_date`) but are otherwise independent.

## Stage 2: Core Rebuild — Phase 2 (Periodic Field Model)

**Goal:** Replace single-value-per-field `year1` with period-indexed series.

**Tasks:**
1. New type: `PeriodLayeredValue` — extends `LayeredValue` with `periodIndex: number` (month 0-N)
2. New type: `PeriodicFieldSeries` — array of `PeriodLayeredValue` per field, plus boundary metadata
3. Update `ProFormaYear1Seed` → `ProFormaPeriodicSeed` — each field is `PeriodicFieldSeries` instead of `LayeredValue<number>`
4. Update `buildSeed` (proforma-seeder.service.ts:512-1112) — produce `PeriodicFieldSeries`:
   - History zone (months ≤ actuals_through_month): read from `extraction_t12.months[]` (Phase 0 data)
   - Gap zone: apply trend derivation (Phase 3 — stub for now)
   - Projection zone: apply versioned assumptions per period
5. Update `resolveLayeredValue` → `resolvePeriodicField` — return full series + single resolved at any period
6. Update `deal_assumptions` schema — `year1` becomes `periodic_seed` (JSONB with new shape)
   - Migration to transform existing `year1` records → periodic format (backward-compat wrapper)
7. Update `applyUserOverride` — period-aware override (override at specific period or all periods)

**Files:**
- `backend/src/services/proforma/periodic-field.types.ts` (new)
- `backend/src/services/proforma/periodic-seeder.service.ts` (new — extracts from buildSeed)
- `backend/src/services/proforma-seeder.service.ts` (major refactor)
- `backend/src/services/get-field-value.service.ts` (period-aware resolution)
- `backend/src/database/migrations/2026XXXX_periodic_seed_schema.sql`

**Stage gate:** Must pass full seeder test suite before proceeding.

## Stage 3: Gap Bridge + F9 Rendering (Phase 3 + Phase 5)

**Phase 3 — Gap Bridge + Derivation Engine**
**Goal:** Fill T12-end → closing_date gap with assumption-driven trends.

**Depends on:** Phase 2 (needs periodic field model to write into).

**Tasks:**
1. Create `backend/src/services/proforma/gap-bridge.service.ts`
   - `deriveGapSeries(fieldName, actualsEndMonth, closingMonth, assumptions): PeriodicFieldSeries`
   - For each month in gap: apply trend (e.g., rent growth %/mo) from assumptions
   - Output: `PeriodLayeredValue[]` with `resolution: 'derived_gap'`, `source: 'assumption_trend'`
2. Wire into `buildSeed` — after actuals zone, before projection zone
3. Create `backend/src/services/proforma/derivation-engine.service.ts`
   - `applyTrend(series, trendRate, startPeriod, endPeriod): series`
   - Supports: linear, compound, step-function trends
   - Reads from `revRentGrowth[]`, `per_year_overrides` as trend inputs

**Files:**
- `backend/src/services/proforma/gap-bridge.service.ts` (new)
- `backend/src/services/proforma/derivation-engine.service.ts` (new)
- `backend/src/services/proforma-seeder.service.ts` (wire gap bridge into buildSeed)

**Phase 5 — F9 Period Rendering**
**Goal:** Both F9 surfaces (module data + tab render) consume full periodic series, not just `[0]`.

**Depends on:** Phase 2 (needs periodic field model to read from).
**Independence:** Can run in parallel with Phase 3.

**Tasks:**
1. `FinancialEnginePage.tsx`:
   - Replace `cashOnCash: summary.cashOnCash[0]` with full array rendering
   - Add period selector / timeline slider
   - `annualCashFlow[]` already exists — extend with monthly granularity option
2. `ProFormaTab.tsx`:
   - Replace `rentGrowth[0]` with full `rentGrowth[]` array
   - Add period-indexed field display (show actuals vs derived vs projected per period)
3. `SensitivityTab.tsx`:
   - Replace `assumptions?.revenue?.rentGrowth?.[0]` with period-aware selection
4. Backend `financial-model.routes.ts`:
   - Return full periodic series instead of single-value summaries
   - Add `?period=` query param for selecting specific period

**Files:**
- `frontend/src/pages/development/financial-engine/FinancialEnginePage.tsx`
- `frontend/src/pages/development/financial-engine/ProFormaTab.tsx`
- `frontend/src/pages/development/financial-engine/SensitivityTab.tsx`
- `backend/src/api/rest/financial-model.routes.ts`

**Parallelism:** Phase 3 and Phase 5 can run in parallel — both consume Phase 2 output, neither depends on the other.

## Stage 4: Reconciliation + Notification (Phase 4)

**Goal:** Overlap variance capture, boundary-advance cutover, user notification.

**Depends on:** Phase 3 (gap bridge must exist to produce overlap).

**Tasks:**
1. Create `backend/src/services/proforma/reconciliation.service.ts`:
   - `computeOverlapVariance(projectedPeriod, actualPeriod): { variancePct, material, fields }`
   - Compares gap-derived value (from Phase 3) with actual value when actuals boundary advances
   - `materialThreshold = 0.05` (5%) configurable
2. Create `backend/src/services/notification/boundary-advance.service.ts`:
   - `notifyBoundaryAdvance(dealId, period, variances): void`
   - Persists notification to `deal_lifecycle_events` (or new `deal_notifications` table)
   - Fires on: actuals boundary advance, material variance detected, re-base required
3. Wire into `operations.routes.ts` — when new monthly actuals arrive, trigger reconciliation
4. Update `dispositions` table writes — populate variance columns (`irr_variance_bps`, etc.) at sale

**Files:**
- `backend/src/services/proforma/reconciliation.service.ts` (new)
- `backend/src/services/notification/boundary-advance.service.ts` (new)
- `backend/src/api/rest/operations.routes.ts` (trigger on actuals ingest)
- `backend/src/api/rest/lifecycle.routes.ts` (populate disposition variance at sale)

## Stage 5: Integration Test + Commit

1. Full test suite: `npm test` — all existing + new tests green
2. Integration test: end-to-end T12 → periodic seed → gap bridge → F9 render → boundary advance → reconciliation
3. Commit per stage (5 commits minimum, incremental)
4. Push to origin

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Phase 2 is large — seeder refactor touches many callers | Keep backward-compat wrapper (`year1` → `periodic_seed` adapter) until all callers migrated |
| Frontend F9 changes may break UI | Phase 5 can be feature-flagged; old `[0]` paths remain as fallback |
| Migration of existing `year1` records | Write idempotent migration: JSONB transform, rollback-safe |
| Transaction guard may reject existing ad-hoc status changes | Soft transition: log violations but allow for 30 days, then enforce |

## Stage Gate Criteria

| Stage | Gate |
|---|---|
| 1 | `npx tsc --noEmit` clean; Phase 1 + Phase 6 unit tests pass |
| 2 | Seeder test suite passes with periodic model; backward-compat wrapper works for all existing callers |
| 3 | Gap bridge produces mathematically correct trend series; F9 renders full periodic array without console errors |
| 4 | Reconciliation variance matches hand-calculated expected values; notification persists to DB |
| 5 | Full `npm test` green; manual end-to-end T12 → render → boundary advance passes |
