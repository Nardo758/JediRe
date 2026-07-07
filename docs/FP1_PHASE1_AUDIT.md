# F-P1 Phase 1 Audit — Read-Only Census + Divergence Report

**Status:** STOP — awaiting operator rulings before Phase 2 begins.
**Date:** 2026-07-06
**Reference deals:** Bishop (`3f32276f-aacd-4da3-b306-317c5109b403`) · Highlands (`eaabeb9f-830e-44f9-a923-56679ad0329d`)

---

## 1. Store Census

### 1.1 `deal_assumptions` — 98 columns

**Purpose:** Originally a development-calculator input table; progressively extended to be the canonical LayeredValue assumption store via the `year1` JSONB blob. Two design eras coexist: scalar columns (original, mostly defaults) and JSONB blobs (`year1`, `per_year_overrides`, `periodic_seed`) that carry the real underwriting state.

**Schema by group:**

| Group | Columns | Authoritative? |
|---|---|---|
| Identity | `id (uuid), deal_id (uuid)` | — |
| Dev cost scalars | `land_cost, land_cost_per_acre, acquisition_costs, hard_cost_psf, hard_cost_total, soft_cost_pct, soft_cost_total, contingency_pct, contingency_total, developer_fee_pct, developer_fee_total, tdc, tdc_per_unit, tdc_per_sf` | Dev deals only; not used for existing |
| Physical | `total_units (int), avg_unit_sf default 900, gross_sf, rentable_sf, efficiency default 0.85, stories (int), construction_type, parking_type` | Scalar — sometimes diverges from year1 |
| Unit mix | `unit_mix (jsonb) default '{}', unit_mix_overrides (jsonb) default '{}'` | yes |
| Revenue scalars | `avg_rent_per_unit, avg_rent_psf, other_income_per_unit default 50, vacancy_pct default 5.00, concessions_pct default 0.00, rent_growth_yr1 default 3.00, rent_growth_stabilized default 2.50` | Stale shadow; real values in year1 |
| Expense scalars | `opex_ratio default 35.00, opex_per_unit, property_tax_rate, insurance_per_unit, management_fee_pct default 3.00, replacement_reserves_per_unit default 250` | Stale shadow; real values in year1 |
| Debt scalars | `interest_rate, loan_term_years default 3, ltc default 0.65, ltv, debt_yield_min, dscr_min default 1.25, amortization_years default 30, io_period_months default 36, origination_fee_pct default 1.00` | Stale shadow; real values in year1 |
| Disposition scalars | `exit_cap default 0.05, hold_period_years default 5, disposition_cost_pct default 2.00, selling_costs_pct` | Partially live; engine syncs back here |
| Computed returns | `noi_stabilized, yield_on_cost, cash_on_cash_yr1, irr_levered, irr_unlevered, equity_multiple, profit_margin, stabilized_value` | Not populated for either ref deal (all NULL) |
| Target returns | `target_irr, target_em, target_coc` | yes (Bishop only has values) |
| Source metadata | `assumptions_source, source_type, source_ref, source_date` | yes |
| Strategy LVs | `investment_strategy_lv (jsonb), exit_strategy_lv (jsonb), valuation_override_lv (jsonb)` | yes |
| Design program | `f3_design_program (jsonb), construction_months, lease_up_months, absorption_units_per_month, stabilization_target_pct` | yes |
| Operational | `avg_lease_term_months default 12, comp_criteria (jsonb), lease_roll_velocity_per_year (jsonb), mark_to_market_capture_rate, ltl_baseline_source` | yes |
| Renovation | `renovation_units_per_year, renovation_premium_per_unit_monthly, renovation_downtime_months_per_unit, operational_improvement_velocity, rent_recovery_path_months, lease_up_velocity_units_per_month, concession_lease_up_initial_months` | yes |
| Lifecycle | `lifecycle_profile, lifecycle_profile_override, stabilization_year, stabilization_year_override` | yes |
| Validation | `invariant_check_result (jsonb), narrative_text, narrative_generated_at` | yes |
| **JSONB blobs** | **`year1 (jsonb)` — 140 keys (Bishop); `per_year_overrides (jsonb) default '{}'`; `periodic_seed (jsonb)`** | **Primary — these are canonical** |
| Timestamps | `last_computed_at, created_at, updated_at` | — |
| Scope | `scope_id default 'GLOBAL', asset_use_type default 'multifamily', deal_archetype default 'stabilized'` | yes |
| Other | `concession_amortization_schedule` | yes |

**Writers — 18 sites:**

| File | Line(s) | Operation | Fields Written |
|---|---|---|---|
| `deal-assumptions.routes.ts` | 185 | INSERT … ON CONFLICT DO UPDATE | `land_cost, hard_cost_psf, soft_cost_pct, contingency_pct, developer_fee_pct, total_units, avg_unit_sf, efficiency, stories, construction_type, parking_type, unit_mix, avg_rent_per_unit, vacancy_pct, opex_ratio, interest_rate, ltc, exit_cap, hold_period_years, source_type, source_ref, source_date` |
| `deal-assumptions.routes.ts` | 335 | UPDATE | `tdc, tdc_per_unit, noi_stabilized, yield_on_cost, irr_levered, equity_multiple, stabilized_value, profit_margin, last_computed_at` |
| `deal-assumptions.routes.ts` | 586 | PATCH | `hold_period_years` |
| `deal-assumptions.routes.ts` | 625 | PATCH | `target_irr, target_em, target_coc` |
| `deal-assumptions.routes.ts` | 1699 | UPDATE | `year1` (direct REST write) |
| `proforma-seeder.service.ts` | 2287 | INSERT/UPDATE | seed `year1` |
| `proforma-seeder.service.ts` | 2581, 2601 | UPDATE (jsonb_set / merge_patch) | `year1` sub-keys |
| `cashflow.postprocess.ts` | 340, 367 | UPDATE via active scenario → trigger | `year1` subtotals (indirect) |
| `financial-model-engine.service.ts` | 1718 | UPDATE | `periodic_seed` (D2-Ribbon overlay) |
| `financial-model-engine.service.ts` | 1788 | UPDATE | `exit_cap, hold_period_years, rent_growth_yr1` (Batch 4/5 sync) |
| `proforma-adjustment.service.ts` | 5790–6399 | UPDATE | `per_year_overrides, year1, ltl_baseline_source, concession_amortization_schedule` |
| `valuation-grid.service.ts` | 2877, 2970 | UPDATE | `comp_criteria, exit_cap` |
| `document-extraction/data-router.ts` | 775, 856, 942, 1052 | UPDATE | `vacancy_pct, total_units, concessions_pct, property_tax_rate, other_income_per_unit` |
| `stabilization-recheck.service.ts` | 190 | UPDATE | `stabilization_year` |
| `comp-set-discovery.service.ts` | 773, 1127 | UPDATE | `avg_rent_per_unit` |
| `scripts/run-backtest.ts` | 234 | INSERT batch | `year1` |
| `scripts/repair-proforma-subtotals.ts` | 125 | UPDATE | subtotals in `year1` |
| `scripts/verify-shipped-work.ts` | 135 | INSERT (test seeding) | various |

**Readers — 25+ sites (key):**

| File | Line(s) | Fields Read |
|---|---|---|
| `deal-assumptions.routes.ts` | 148, 274 | `*` (primary GET) |
| `deal-assumptions.routes.ts` | 777, 1260 | `per_year_overrides, construction_months, total_units` |
| `deal-assumptions.routes.ts` | 1672, 1976 | `year1` |
| `financial-model.routes.ts` | 644 | `periodic_seed` |
| `financial-model-engine.service.ts` | 1560 | `year1` (LV hints) |
| `financial-model-engine.service.ts` | 1708 | `periodic_seed` |
| `proforma-seeder.service.ts` | 1376 | `year1, periodic_seed` |
| `proforma-seeder.service.ts` | 2436 | `year1` |
| `proforma-adjustment.service.ts` | 2240–2251 | `*` (primary proforma engine load) |
| `proforma-adjustment.service.ts` | 3927 | `year1->'real_estate_tax'->>'platform'` |
| `proforma-adjustment.service.ts` | 5745, 5771 | `unit_mix, unit_mix_overrides` |
| `proforma-adjustment.service.ts` | 6263 | `year1, per_year_overrides, total_units, avg_lease_term_months` |
| `deal-financial-context.service.ts` | 169 | `*` |
| `skills/skills/index.ts` | 68, 606, 663 | `*` (agent skills) |
| `debt-plan-formulator.service.ts` | 770 | `per_year_overrides` |
| `data-quality-agent.service.ts` | 520, 659, 752 | `year1, updated_at` |
| `roadmap-engine.ts` | 246 | `exit_cap, rent_growth` |
| `valuation-grid.service.ts` | 601, 715, 2009, 2901 | `deal_id, comp_criteria, various scalars` |
| `comp-set-discovery.service.ts` | 1115 | `avg_rent_per_unit` |
| `field-access/get-field-value.service.ts` | 517, 659 | `*` (dynamic column access) |
| `inline-deals.routes.ts` | 159, 662, 2012 | `*, year1 existence check` |
| `financial-documents.routes.ts` | 261 | `source_type, source_ref, source_date` |
| `custom-metrics.routes.ts` | 316 | `periodic_seed` |
| `unit-mix-propagation.routes.ts` | 335 | `f3_design_program` |
| `deal-completeness/signal-registry.ts` | 390 | `invariant_check_result` |

---

### 1.2 `deal_financial_models` — 11 columns

**Purpose:** Build-output cache. Stores the `ModelAssumptions` blob that was sent to `/build` + the `FinancialModelResult` blob produced by the deterministic runner. Not intended as an assumption authority — F-P1 retires it as one.

**Schema:**

| Column | Type | Notes |
|---|---|---|
| `id` | integer (PK) | auto-increment |
| `deal_id` | **character varying** | ⚠ NOT uuid — requires explicit cast to join other tables |
| `model_type` | character varying | |
| `assumptions` | jsonb | `ModelAssumptions` shape (frontend format, normalized by `normalizeToEngineFormat()`) |
| `results` | jsonb | `FinancialModelResult` — **does NOT contain `monthlyCashFlow`** (confirmed: `results ? 'monthlyCashFlow' = false` across 100+ Bishop builds) |
| `excel_path` | character varying | |
| `status` | character varying | `'building' | 'complete' | 'error'` |
| `error_message` | text | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |
| `assumptions_hash` | text | SHA of normalized assumptions |

**Writers — 3 sites:**

| File | Line(s) | Operation | Fields |
|---|---|---|---|
| `financial-model-engine.service.ts` | 1470 | INSERT on build start | `deal_id, model_type, assumptions, status='building', assumptions_hash` |
| `financial-model-engine.service.ts` | 1743, 1750, 1854 | UPDATE | `status, error_message` or `results, status='complete'` |
| `financial-model.routes.ts` | 615 | UPDATE | `excel_path, updated_at` |

**Readers — 6 sites:**

| File | Line(s) | Fields Read |
|---|---|---|
| `financial-model-engine.service.ts` | 1868 | `assumptions, results, created_at, assumptions_hash` (getLatestModel) |
| `financial-model.routes.ts` | 616 | `id` subquery for Excel update |
| `clawdbot-webhooks.routes.ts` | 244, 721, 1507, 1562 | `id, model_type, status, created_at, assumptions, results` |
| `financial-dashboard.routes.ts` | 55, 217, 398 | `assumptions, results` |
| `admin.routes.ts` | 531 | `count(*)` |
| `scenario-generation.service.ts` | 798 | `assumptions, results` (baseline for scenario generation) |

---

### 1.3 `deal_underwriting_scenarios` — 19 columns

**Purpose:** Scenario management layer. Each row carries a full `year1` JSONB blob (same LayeredValue schema as `deal_assumptions.year1`). The active scenario's `year1` is mirrored to `deal_assumptions.year1` via database trigger `trg_sync_underwriting_scenario`. This is the PRIMARY write target for the Cashflow Agent and seeder — they write here, the trigger propagates to `deal_assumptions`.

**Schema:**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `deal_id` | uuid | consistent type |
| `name` | text | |
| `description` | text | |
| `created_by` | text | `'user' | 'agent'` |
| `created_by_user_id` | uuid | |
| `created_by_agent_run_id` | uuid | |
| `created_at` | timestamp with tz | |
| `updated_at` | timestamp with tz | |
| `archived_at` | timestamp with tz | |
| `deleted_at` | timestamp with tz | soft delete |
| `is_active` | boolean | exactly one active per deal |
| `parent_id` | uuid | scenario tree |
| `primary_snapshot_id` | uuid | |
| `year1` | jsonb | **140 keys — same shape as `deal_assumptions.year1`** |
| `tags` | ARRAY | |
| `notes` | text | |
| `ci_findings` | jsonb | |

Missing from schema: `deal_financial_models.id`-equivalent for referencing a build. No `assumptions_hash`, no link to the build that produced the `year1` content.

**Writers — 6 sites:**

| File | Line(s) | Operation | Fields |
|---|---|---|---|
| `underwriting-scenarios.service.ts` | 183 | INSERT (createScenario) | `deal_id, name, description, created_by, is_active=FALSE, parent_id, year1, tags` |
| `underwriting-scenarios.service.ts` | 224, 232 | UPDATE (activateScenario) | `is_active, updated_at` |
| `underwriting-scenarios.service.ts` | 279 | UPDATE (updateMeta) | `name, description, tags, notes, updated_at` |
| `underwriting-scenarios.service.ts` | 291, 303, 340, 360, 438, 478 | UPDATE (various) | `archived_at, deleted_at, ci_findings, year1->[key], updated_at` |
| `cashflow.postprocess.ts` | 341, 351, 685, 699, 1197, 1295 | UPDATE via jsonb_set | `year1->[key].{agent,resolved,resolution,confidence}` |
| `proforma-seeder.service.ts` | 1878, 2303, 2582 | UPDATE (delta merge) | `year1` (extraction delta, capital structure defaults, CIE state) |
| `financial-model-engine.service.ts` | 1834 | UPDATE | `year1, updated_at` (Batch 4/5 writeback) |
| `scenario-archival.service.ts` | 75, 166, 186 | UPDATE / DELETE | `archived_at` or hard delete |
| `deal-assumptions.routes.ts` | 1699 | UPDATE | `year1` (direct REST) |

**Readers — 14 sites:**

| File | Line(s) | Fields Read |
|---|---|---|
| `underwriting-scenarios.service.ts` | 127, 137, 146, 328 | `*` or `id, year1` |
| `proforma-seeder.service.ts` | 1363, 2425 | `id, year1` |
| `financial-model-engine.service.ts` | 1802 | `id, year1` |
| `cashflow.postprocess.ts` | 1368 | `year1` (post-run snapshot) |
| `scenario-archival.service.ts` | 83, 87, 124 | `parent_id, id, deal_id, created_at` |
| `admin.routes.ts` | 1928–1932 | `count(*)` by status |
| `scripts/live-agent-subfield-run.ts` | 177 | `id, year1` |
| `scripts/verify-subfield-writeback.ts` | 193 | `year1` |

---

### 1.4 `FinancialEnginePage.tsx:579` local state — `ModelAssumptions | null`

**Type:** `ModelAssumptions` (frontend, `financial-engine/types.ts`)

**Shape:**
```typescript
{
  dealInfo: { dealName, totalUnits, netRentableSF, vintage, address, city, state }
  modelType: 'existing' | 'development'
  holdPeriod: number
  unitMix: UnitMixRow[]   // floorPlan, unitSize, beds, units, occupied, vacant, marketRent, inPlaceRent
  acquisition: { purchasePrice, capRate, closingCosts }
  disposition: { exitCapRate, sellingCosts, saleNOIMethod }
  revenue: { rentGrowth: number[], lossToLease, stabilizedOccupancy, collectionLoss, otherIncome }
  expenses: Record<string, { amount, type, growthRate }>
  financing: { loanAmount, loanType, interestRate, spread, term, amortization, ioPeriod, originationFee, rateCapCost, prepayPenalty }
  capex: { lineItems, contingencyPct, reservesPerUnit }
  waterfall: { lpShare, gpShare, hurdles, equityContribution }
  development?: { ... }  // optional
}
```

**Init paths (3):**
1. `GET /api/v1/financial-model/:id/latest` → `model.assumptions` (line 734) — primary: loads the last built model's assumption snapshot from `deal_financial_models`
2. Bootstrap from `f9Financials` (lines 1043–1192) — if no model exists: derives defaults from `deal_assumptions`-sourced `f9Financials`, computes unit mix, expenses from resolved categories, financing from capitalStack
3. `handleLoadVersion` (line 1237) — loads from a selected `ModelVersion.assumptions`

**Writers (4):**
- `handleAssumptionsChange` (line 1318) — merges partial updates from any child tab
- `handleApplyGoalSeekSolved` (lines 1323–1349) — writes purchasePrice, exitCap, rentGrowth, holdPeriod, ltv, interestRate from goal-seek results
- Opus chat `update_assumptions` action (line 1413)
- Build success (line 1025) — state confirmed in sync; `lastBuiltHash` updated

**Readers:**
- `handleBuildModel` (line 1013) — sends full `assumptions` to `POST /api/v1/financial-model/build`
- `mergedFinancials` memo (lines 910–990) — real-time projection recompute before build
- Opus context (lines 1387–1395), child tabs via SubTabContext

**This is the write path F-P1-A targets:** line 1013 sends the client-held `assumptions` object to the server as the build payload. The server (line 513) requires `assumptions` to be present in the request body — no server-side fetch fallback exists today.

**Secondary local state duplicating `deal_assumptions` fields:**
- `f9Financials` (line 610) — parallel read-only copy: `holdYears, exitCap, rentGrowthYr1, rentGrowthStabilized, capitalStack.{purchasePrice, loanAmount, interestRate}`, full `proforma.year1` array
- `lvCostTreatmentView` (line 626) — duplicates `deal_data.leasing_cost_treatment`
- `localTargetUnits` (line 614) — duplicates `propDeal.target_units`

---

## 2. Divergence Audit — Bishop and Highlands

### 2.1 Bishop (`3f32276f`) — live values across all stores

| Field | `deal_assumptions` scalar | `deal_assumptions.year1` resolved | `deal_underwriting_scenarios.year1` resolved | `deal_financial_models.assumptions` (latest build) | `deal_financial_models.results` (latest build) |
|---|---|---|---|---|---|
| **NOI** | `noi_stabilized = NULL` | `$840,231` · `platform_fallback` ← **F-P1-B** | `$840,231` · `platform_fallback` (trigger-synced) | — | `summary.noi = $1,576,800` (TS-1 confirmed) |
| **GPR** | — | `$4,901,400` | `$4,901,400` | — | — |
| **Vacancy** | `vacancy_pct = 19.83%` | `19.83%` | `19.83%` | `stabilizedOccupancy = ~80.17%` | — |
| **Exit cap** | `exit_cap = 0.05` | `0.05` (via year1.exit_cap.resolved) | `0.05` | `exitCapRate = 0.05` | — |
| **Hold period** | `hold_period_years = 5` | — | `5` | `holdPeriod = 5` | — |
| **IRR** | `irr_levered = NULL` | — | — | — | `−20.95%` |
| **EM** | `equity_multiple = NULL` | — | — | — | `0.3144` |
| **Rent growth yr1** | `rent_growth_yr1 = 0.00` | — | — | (engine-computed; not 0.00 at build time) | — |
| **Tax** | — | `$696,000` | `$696,000` | — | — |
| **monthlyCashFlow** | N/A | N/A | N/A | NOT in results JSON | ← **serialization gap** |

**Divergences flagged:**
1. **F-P1-B confirmed:** `deal_assumptions.year1.noi.resolved = $840,231` tagged `platform_fallback`. The build produces `$1,576,800`. The `year1.noi` slot holds an actuals-derived (or platform-estimated) in-place NOI, but is labeled as if it were a platform fallback. This is the provenance lie.
2. **Scalar computed returns are all NULL** for Bishop: `irr_levered, equity_multiple, noi_stabilized` never written to the scalar columns (only in `deal_financial_models.results`).
3. **`rent_growth_yr1 = 0.00`** in `deal_assumptions` scalar. The build uses engine-computed rent growth from M26 enhancement. The scalar shadow is stale.
4. **`deal_financial_models.results` does NOT contain `monthlyCashFlow`** — the runner computes it but it is stripped before/during storage. Confirmed across 100+ builds.
5. **One active scenario** exists for Bishop. `deal_underwriting_scenarios.year1` and `deal_assumptions.year1` are in sync (trigger working). Both carry the `platform_fallback` NOI.

### 2.2 Highlands (`eaabeb9f`) — live values across all stores

| Field | `deal_assumptions` scalar | `deal_assumptions.year1` resolved | `deal_underwriting_scenarios` | `deal_financial_models` (1 complete build, 2026-07-03) | Notes |
|---|---|---|---|---|---|
| **NOI** | `noi_stabilized = NULL` | `$2,899,082` · `computed` | N/A — no active scenario | — | TS-1 live payload showed `$3,808,324` — **divergence** |
| **GPR** | — | `$5,317,612` | N/A | — | |
| **Vacancy** | `vacancy_pct = 7.00%` | `7.00%` | N/A | — | |
| **Exit cap** | `exit_cap = 0.0625` | — | N/A | — | |
| **Avg rent** | `avg_rent_per_unit = NULL` | — | N/A | — | |
| **Tax** | — | `NULL` (no year1 tax entry) | N/A | — | |
| **Rent growth** | `rent_growth_yr1 = 0.00` | — | N/A | — | Stale |

**Divergences flagged:**
1. **No active scenario** for Highlands — `deal_underwriting_scenarios` has zero non-deleted, non-archived rows. `deal_assumptions.year1` is the only scenario-class store, and it is NOT synced via the trigger (nothing to sync from).
2. **F-P1-C candidate:** Highlands is an owned-import deal. `deal_assumptions.year1.noi.resolved = $2,899,082` with resolution `computed`. The TS-1 live build payload showed `summary.noiYear1 = $3,808,324`. The stored `year1` NOI diverges from the build result by ~$909K. This is the expected consequence of the owned-import path having no underwriting row — the actuals-aggregated NOI diverges from a full proforma build.
3. **`avg_rent_per_unit = NULL`** — no scalar rent value. Year1 GPR resolves to $5,317,612 via computed resolution.
4. **Only 1 complete build** ever (2026-07-03). Highlands is not being actively re-modeled.

---

## 3. Overlay Schema Proposal

This is a design proposal for operator ruling. No code changes made.

### Canonical store: `deal_assumptions` (retained, extended)

The `year1` JSONB remains the canonical LayeredValue blob. The schema proposal adds:
1. **Overlay table** (new): `deal_assumption_overlays`
2. **Attribution columns** (on every user-layer write)
3. **Trending schema** (four-door LayeredValue per growth-rate field)
4. **Exit-basis field** (`exit_valuation_basis`)
5. **Monthly projection** (separate thin blob or appended to `deal_financial_models.results`)

### Proposed `deal_assumption_overlays` table

```sql
CREATE TABLE deal_assumption_overlays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      uuid NOT NULL REFERENCES deals(id),
  scenario_id  uuid REFERENCES deal_underwriting_scenarios(id),  -- NULL = base overlay
  field_path   text NOT NULL,        -- e.g. 'noi', 'real_estate_tax', 'rent_growth.yr1'
  layer        text NOT NULL,        -- 'user' | 'agent' | 'operator'
  value        jsonb NOT NULL,       -- LayeredValue-compatible: { override, override_source, note }
  edited_by    uuid REFERENCES users(id),
  edited_at    timestamptz NOT NULL DEFAULT now(),
  session_id   text,
  -- append-only history
  superseded_at timestamptz,
  superseded_by uuid REFERENCES deal_assumption_overlays(id)
);
CREATE INDEX ON deal_assumption_overlays(deal_id, scenario_id, field_path) WHERE superseded_at IS NULL;
```

This replaces the inline `override` / `override_source` slots within `year1` JSONB keys. The active overlay for any field-path is the most recent non-superseded row.

### `deal_underwriting_scenarios` migration INTO overlays

Each scenario maps to `scenario_id` in the overlays table. The scenario's `year1` JSONB is decomposed into individual `deal_assumption_overlays` rows (one per field-path that has a non-null `override` layer). The scenario `name`, `description`, `tags`, `notes`, `is_active` remain on the scenario row. The `year1` JSONB on the scenario row retires as the write target; it becomes a denormalized cache updated by trigger.

### Trending fields (operator ruling 2026-07-04)

Growth rates become four-door LayeredValues. Proposed field_path keys in overlays:
- `rent_growth.yr1`, `rent_growth.stabilized` (market rent — already done as scalar)
- `other_income_growth`
- `expense_growth.insurance`, `expense_growth.payroll`, `expense_growth.utilities`, `expense_growth.other`

Each door: `{ cpi_fred, ce, source_material, owned_asset }` — user wins, resolved per composition spec.

### Exit-basis field (operator ruling 2026-07-06)

```sql
-- Add to deal_assumptions:
exit_valuation_basis  text  DEFAULT 'forward_12'  -- 'forward_12' | 'trailing_12'
```

As a four-door LayeredValue in overlays: `field_path = 'exit_valuation_basis'`. The disposition calculator reads this and computes BOTH T12 (sum m-11..m) and forward-12 (sum m+1..m+12) from the monthly series; evidence states which was chosen and shows both values.

### Attribution columns

On every user-layer write to `deal_assumption_overlays`: `edited_by (uuid)`, `edited_at (timestamptz)`, `session_id`. Last-write-wins with visible attribution. Per-field append-only history: filter `deal_assumption_overlays WHERE deal_id = $1 AND field_path = $2 ORDER BY edited_at DESC`.

---

## 4. Migration Map

Ordered steps — each with value-identity checkpoint and rollback note. **Requires operator ruling to confirm sequence and winners.**

| Step | Description | Identity Checkpoint | Live Consumer Touched | Rollback |
|---|---|---|---|---|
| **M-A** | Add `deal_assumption_overlays` table (dark — no readers yet) | n/a | None | `DROP TABLE` |
| **M-B** | Add `exit_valuation_basis` column to `deal_assumptions` (nullable, no default yet — don't set default before ruling) | n/a | None | `DROP COLUMN` |
| **M-C** | Add attribution columns to `deal_assumption_overlays` writer path (dark) | n/a | None | revert |
| **M-D** | F-P1-A: Add server-side assumptions fetch to build endpoint BESIDE client path. Prove equivalent: same deal, both paths, paste identical output. Client path still active. | Bishop: loan $21,024,006 / equity $39,365,994 / IRR −20.95% / EM 0.3144 / DSCR 1.0424 | `financial-model.routes.ts:510-515` | remove server-fetch branch |
| **M-E** | Retire client path + delete React local state copy (`FinancialEnginePage.tsx:579 assumptions` → read-only display only; writes route to server-fetch on next build) | Same as M-D | `FinancialEnginePage.tsx`, `handleBuildModel` | revert |
| **M-F** | Migrate `deal_underwriting_scenarios.year1` → decompose into `deal_assumption_overlays` rows. Trigger updated to read from overlays instead of syncing JSON blobs. | Highlands seed canary: 57.17% / $6,315,308.53 / 2026-04-01. Bishop: same five. | Seeder, postprocess, engine | restore old scenario year1 path |
| **M-G** | F-P1-B: Fix provenance — `deal_assumptions.year1.noi.resolution = 'platform_fallback'` on actuals-derived rows. Repair resolution tag to `'actuals'` or `'owned_import'` as appropriate. No value change. | Bishop NOI = $840,231 before/after (value-identical; tag only changes) | Cashflow Agent prompt builder, JEDI Score | revert tag update SQL |
| **M-H** | F-P1-C: Honest absence — owned-import deals (no underwriting scenario) return `modelNotBuilt: true, reason: 'no_underwriting — owned_import'` instead of default-build | Highlands build returns honest absence signal | Build route | revert branch |
| **M-I** | year1 blob semantics — migrate in-place-class vs stabilized-class slots per W4c addendum map. Rename ambiguous keys. | Bishop/Highlands year1 value-identical after rename (no numeric change) | All 25+ readers of `year1` — must audit each | rollback rename migration |
| **M-J** | Read-site repairs: 4 flagged live issues (roadmap-engine `baseNoi`, Excel "Year 1 Stabilized" label, dashboard label, `cashflow.postprocess` fallback chain) + any new from audit | Bishop/Highlands build output byte-identical | Various | revert each fix |
| **M-K** | Trending + exit-basis + attribution schema live — populate overlay rows for new four-door LV fields | n/a (new fields) | Composition layer | revert rows |
| **M-L** | Serialization gap closed — emit thin monthly projection from `/latest` endpoint | TS-2 gate: `floorBinding` and `occupancy` reachable by frontend | `financial-model.routes.ts getLatestModel` | strip from response |

**Steps that touch live consumers** (flag for coordination): M-D/M-E (build route + React), M-F (seeder + postprocess + engine), M-I (all 25+ year1 readers), M-J (4+ specific sites), M-L (build route response shape).

---

## 5. Serialization Design

### The gap

`MonthlyCashFlowRow` is generated by the deterministic runner and used internally to aggregate annual rows. It is present in the `ModelResult` type definition but is **stripped before or during storage** — `deal_financial_models.results` does not contain a `monthlyCashFlow` key (confirmed across 100+ builds via `results ? 'monthlyCashFlow' = false`). The `/latest` endpoint returns `results` verbatim from the DB (`getLatestModel` at line 1868), so the frontend never sees it.

### Monthly projection shape

The thin slice needed to unlock TS-2 (T2 floor badge + T3 occupancy row):

```typescript
interface MonthlyProjectionRow {
  month: number;         // 1-based
  year: number;          // operating year
  occupancy: number;     // fraction (= 1 - effectiveVacancy)
  effectiveVacancy: number;  // after floor applied
  floorBinding: boolean; // true when underwriting floor overrides physical
  noi: number;           // dollar
}
```

This is a subset of `MonthlyCashFlowRow` (fields: `month, year, occupancy, effectiveVacancy, floorBinding, noi`).

### Carrier endpoint

**Extend `/latest` response** — do not add a new endpoint. The `getLatestModel` return type gains `monthlyProjection: MonthlyProjectionRow[]`. Storage: the runner includes the slice in `results.monthlyProjection` when writing to `deal_financial_models.results` (not the full `MonthlyCashFlowRow` — just the 6 fields above, reducing payload size from ~60 fields × N months to 6 fields × N months).

Approximate payload size at 60 months: 6 fields × 60 rows × ~30 bytes/field = ~10KB — acceptable for inclusion in the model payload.

**Justification for not adding a new endpoint:** The dispatch instructs "no new endpoint unless impossible; justify if so." The 6-field monthly slice is small enough for the existing payload. Adding an endpoint would require a new auth guard, new route registration, and new client fetch — cost disproportionate to benefit.

---

## 6. Tax Machinery Inventory

### In deterministic runner (`deterministic-model-runner.ts`)

| Mechanism | File:Line | Description |
|---|---|---|
| `isMiamiDade(county)` helper | :476–480 | Sets FL millage default + doc stamp rate for Miami-Dade |
| `computeFloridaTax` | :507–523 | Year-1 reassessment: `base = purchasePrice * reassessPct (0.85)`. Annual growth: `av = base * (1 + capRate)^(y-1)`. capRate defaults to `DEF_CAP_INCREASE = 0.10` |
| `DEF_CAP_INCREASE` constant | :449 | `0.10` — the 10% SOH cap default |
| `computeNonFloridaTax` | :1762–1769 | Branched for non-FL states |
| `isFlorida` flag | :1738–1745 | Used for transfer tax path (doc stamps, intangible tax, title insurance) |

### In tax service (`backend/src/services/tax/`)

| Mechanism | File:Line | Description |
|---|---|---|
| FL SOH cap | `rulesets/fl.ruleset.ts:35, 150–153` | `const FL_SOH_CAP = 0.10`. Applied in `annualPropertyTax`. |
| Reassessment-on-sale | `fl.ruleset.ts:140, 147, 192` | Year 1 triggers full reassessment to `baseAssessed = purchasePrice`. Returns `'full'`. |
| FL millage defaults | `fl.ruleset.ts:37–38` | Miami-Dade: 23.09; Statewide: 20.00 |
| Miami-Dade doc stamp | `fl.ruleset.ts:162–166` | 1.05% for Miami-Dade vs 0.70% statewide |
| Miami-Dade resolver | `fl.ruleset.ts:67–75` | Checks county + 28 city names |
| Cap trajectory | `taxProjection.service.ts:104–113` | `calculateCapTrajectory` with hardcoded `non_homestead_cap: 0.10` |
| Cap clamping | `taxProjection.service.ts:211–214` | `Math.min(marketValue, assessedValue * (1 + non_homestead_cap))` |
| Millage calc | `taxProjection.service.ts:93` | `adValoremTax = taxableValue * (totalMillage / 1000)` |
| County overlay factory | `rulesets/county-overlay.factory.ts:40–47` | Wraps state ruleset to inject county millage, preserves state cap/reassessment |
| Miami-Dade 2026 rate sheet | `rateSheets/fl-miami-dade-2026.json:23, 36` | `aggregate: 19.8344`, `county_surtax: 0.45` |

### What the restructure moves

The dispatch calls for: (1) inventory existing FL machinery — done above; (2) restructure into jurisdiction ruleset files — `if (state === 'FL')` blocks outside `rulesets/` to be moved in; (3) implement trigger model (sale/CO/cycle steps + four-door trend clamped by cap between events).

**`if (state === 'FL')` / `isFlorida` references outside rulesets/ that need migration:**
- `deterministic-model-runner.ts:1738–1769` — the entire `computeFloridaTax` / `computeNonFloridaTax` branch lives directly in the runner. This is the primary target: extract into a jurisdiction dispatch call `taxService.computeYearTax(jurisdiction, params)`.
- `deterministic-model-runner.ts:476–480` — `isMiamiDade` used to set millage defaults inline. Migrate to county overlay factory call.

**Already in rulesets/:** `fl.ruleset.ts` and `taxProjection.service.ts` are properly structured. The tax service itself is clean. The runner is the offender.

**Trigger model** (sale/CO/cycle steps): not yet implemented in either the runner or the tax service. The `computeFloridaTax` in the runner uses a simple `(1 + capRate)^y` growth with a year-1 reassessment. There is no cycle-step logic, no CO trigger, no event path. The `taxProjection.service.ts` is closer — it has a cap trajectory and separate reassessment logic — but it is not called from the deterministic runner. The runner uses its own inline implementation.

**Clarification needed for scope:** the dispatch says "trigger model (sale/CO/cycle steps + four-door trend clamped by cap between events)" — is the cycle-step logic new code or is `taxProjection.service.ts`'s `calculateCapTrajectory` the foundation to build on? This is a ruling question.

---

## 7. STOP — Operator Rulings Required

Phase 1 complete. The following questions require rulings before Phase 2 begins:

### R1 — F-P1-B divergence winner (Bishop NOI)
`deal_assumptions.year1.noi.resolved = $840,231` tagged `platform_fallback`. The correct provenance tag for an actuals-derived value is not `platform_fallback`. What should the correct resolution tag be? Options: `'actuals'`, `'owned_import'`, `'t12'`, or something else. (Value-only ruling — no numeric change, tag fix only.)

### R2 — Highlands active scenario
Highlands has no active `deal_underwriting_scenarios` row. For F-P1-C, does Highlands qualify as `no_underwriting — owned_import` and should return `modelNotBuilt: true`? Or should Phase 2 create a baseline scenario for Highlands?

### R3 — Overlay schema: decompose or dual-write?
The overlay proposal decomposes `deal_underwriting_scenarios.year1` into `deal_assumption_overlays` rows. Alternative: dual-write (keep the JSONB blob as authoritative, write overlays in parallel for future use). Which path? Decompose is cleaner but higher migration risk.

### R4 — Migration order
Steps M-D through M-L are ordered but several can be parallelized or reordered. Key question: does M-F (scenario decomposition) happen before or after M-D/M-E (client payload retirement)? The dispatch says "schema + overlays land dark → F-P1-A server-fetch path → client path retired → store migrations." This implies M-A → M-D → M-E → M-F. Confirm?

### R5 — Serialization shape
Proposed thin monthly slice: `{ month, year, occupancy, effectiveVacancy, floorBinding, noi }`. Is this the correct 6-field subset, or does TS-2 need additional fields (e.g., `gpr`, `concessions`)?

### R6 — Tax restructure scope
The runner's inline `computeFloridaTax` / `computeNonFloridaTax` branch is the primary extraction target. The trigger model (cycle/CO steps) does not exist yet. Is Phase 2 limited to: (a) extract inline branches → ruleset dispatch calls, and (b) wire `taxProjection.service.ts`'s existing cap trajectory as the foundation? Or is new trigger-model logic in scope for this arc?

### R7 — year1 blob semantics
The W4c addendum documents in-place-class vs stabilized-class slot ambiguity. Before M-I can proceed, the rename map needs operator sign-off. Which keys are in-place-class and which are stabilized-class? The audit confirms the ambiguity exists (`year1.noi.resolved` on Bishop holds an in-place value labeled `platform_fallback` while the build produces a stabilized-class NOI) but the full rename map requires the addendum ruling.

### R8 — Trending schema growth rate fields
Which expense categories get separate four-door LV growth rates? The dispatch says `insurance/payroll/utilities separate; no flat default`. Confirm the complete list: `insurance_growth, payroll_growth, utilities_growth, other_expense_growth, other_income_growth, rent_growth` — or is the list different?

---

*Phase 1 complete. STOP. No writes made. Awaiting rulings on R1–R8.*
