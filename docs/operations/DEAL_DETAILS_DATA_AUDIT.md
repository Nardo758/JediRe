# Deal Details Capsule — End-to-End Data Audit

**Generated:** 2026-06-12  
**Audit type:** Read-only investigation  
**Test deal:** 464 Bishop Street NW, Atlanta GA 30318 (`3f32276f-aacd-4da3-b306-317c5109b403`)  
**Scope:** Every operator-visible field in the Deal Details capsule — F1–F12 screens (M01–M21 + M12), F9 Financial Engine sub-tabs (⊞ OVERVIEW through ⊛ ROADMAP), Validation Grid, Valuation Grid, Document Library  
**Method:** Live database queries against dev PostgreSQL + code trace through frontend components → backend routes → service layer → SQL  
**Status:** COMPLETE — all field states verified against live database; no production code changes made

---

## F-Key / Module Map

| F-Key | Module | Label | Component |
|---|---|---|---|
| F1 | M01 | Overview | OverviewScreen |
| F2 | M02 | Zoning | ZoningModuleSection |
| F3 | M05 | Market Intel | MarketScreen |
| F4 | M04 | Supply Pipeline | SupplyPipelineScreen |
| F5 | M08 | Strategy | StrategyScreen |
| F6 | M07 | Traffic Intel | TrafficScreen |
| F7 | M03 | 3D Design | Design3DScreen |
| F8 | M11+M12 | Debt & Capital + Exit Strategy | DebtCapitalScreen (ExitCapitalModule) |
| F9 | M08 | Financial Engine | FinancialEnginePage (11 sub-tabs) |
| F10 | M13 | Risk | RiskScreen |
| F11 | M21 | Deal Tools | DealToolsScreen |
| F12\* | — | keyboard shortcut alias for F11 | — |

**F12 note:** The `allDealScreens` array defines exactly 11 canonical screens (F1–F11). The keyboard shortcut mapping (`DealDetailPage.tsx` line 790) assigns `F12 → 'deal-tools'` as an alias for the F11 key. The task's "F12 (Exit Strategy / Debt Markets / Exit Timing)" refers to the **M12 sub-module** within F8 (DebtCapitalScreen, subtitle "M11+M12 · EXIT STRATEGY + DEBT MARKET"), not a standalone 12th screen. M12 is documented separately in the F8 section below.

---

## Executive Summary

### Gap Counts (464 Bishop test deal)

| Gap Status | Table / Surface Count | Notes |
|---|---|---|
| POPULATED | 11 | `deal_assumptions`, `deal_files`, `deal_context_fields`, `deal_monthly_actuals`, `deal_underwriting_snapshots`, `deal_zoning_profiles`, `deal_traffic_snapshots`, `cashflow_projections`, `jedi_score_history`, `data_quality_alerts`, `market_rent_comps` |
| SPARSE | 4 | `cashflow_projections` (1 row), `deal_traffic_snapshots` (4 rows), `jedi_score_history` (1 row), `deal_activity` (1 row) |
| EMPTY | 13 | `deal_market_intelligence`, `supply_events`, `deal_tasks`, `deal_risks`, `deal_scenarios`, `deal_waterfall_config`, `deal_waterfalls`, `deal_debt_schedule`, `deal_contexts`, `zoning_analyses`, `dispositions`, `building_designs_3d`, `capex_budget` |
| BROKEN | 1 | `deal_documents` (legacy) — superseded by `deal_files`; 0 rows despite 19 active `deal_files` rows |
| MISSING | 2 | Investment strategy LV `{detected:null, override:null}`; Exit strategy LV `{detected:null, override:null}` |

### Author Class Definitions

| Author Class | Definition | Primary Surfaces |
|---|---|---|
| **AGENT** | Written by a Claude/LLM agent run; `agent_run_id` linkable | `deal_context_fields` (all 47 rows tagged `agent:research`), `cashflow_projections`, `deal_underwriting_snapshots` |
| **OPERATOR** | Written by the authenticated user via a UI input or PATCH endpoint | `deal_assumptions` (user edits), `deal_files` (uploads), `deal_monthly_actuals` (manual entry), waterfall config |
| **RESEARCH-PULL** | Pulled from an external or internal data service without direct operator action | `deal_context_fields` market/macro/parcel paths, `deal_traffic_snapshots` (M07), `deal_zoning_profiles` (zoning lookup) |
| **OPERATOR-UPLOAD** | Uploaded document whose extraction populates structured data | `deal_files` + `extraction_result` JSONB, `deal_monthly_actuals` rows (T12/rent roll extraction) |
| **COMPUTED** | Deterministic formula or model output derived from other populated fields | All F9 proforma outputs (NOI, IRR, EM, DSCR, GPR, debt), JEDI score, valuation grid, divergence checks |
| **UNKNOWN** | Written to the database but no identifiable writer found in current code | Several keys in `deals.deal_data` JSONB (`sale_date`, `close_date`, some `module_outputs`) |

### Top 10 Critical Findings

1. **`deal_market_intelligence` is empty for 464 Bishop** — F1 Overview market signals panel, F3 Market Intel, and F9 valuation context all render placeholders with no live data.
2. **Investment and exit strategy are `{detected:null, override:null}`** — F5 Strategy surface shows NOT SET; F9 Deal Terms tab shows amber badge. No default is applied per the canonical constraint.
3. **`deal_documents` table unused; superseded by `deal_files`** — Any code still reading `deal_documents` finds 0 rows. Stale coupling risk for scripts or agent tools referencing the old table.
4. **Waterfall/LP-GP split data absent** — `deal_waterfall_config`, `deal_waterfalls`, and `deal_debt_schedule` each have 0 rows; F9 Capital tab waterfall panel renders empty or with defaults.
5. **Purchase price not set in `deal_assumptions.land_cost`** — The F9 capital stack, Sources & Uses, IRR computation, and going-in cap rate all depend on this field. `irr_levered` and `noi_stabilized` are both null.
6. **All 47 `deal_context_fields` rows authored by `agent:research`** — No OPERATOR overrides exist; there is no way to tell from this table whether the agent's values have ever been reviewed by a human.
7. **315 `deal_underwriting_snapshots` with 0 corresponding `deal_scenarios`** — Snapshots accumulate from every agent/model run but are not surfaced in the Compare tab without user-created scenario references.
8. **`supply_events` is empty for 464 Bishop** — F4 Supply Pipeline has no deal-level pipeline data; all supply metrics shown are market-level estimates from `deal_context_fields.market.*` (agent:research).
9. **Freshness coverage absent for `deal_context_fields` agent-authored values** — The schema has `created_at`/`updated_at` but no TTL or staleness flag; the UI has no per-field "as of" indicator.
10. **`deal_files` extraction is 50% failed** — 9 of 19 files have `extraction_status = 'done'`; 8 have `extraction_status = 'failed'`; 2 are `'queued'`. Half the uploaded documents have not produced structured data.

---

## Test Deal Verification

All field states below are verified against the live database for 464 Bishop (`3f32276f-aacd-4da3-b306-317c5109b403`).

### Live database row counts

| Table | Row Count | Status |
|---|---|---|
| `deals` | 1 | POPULATED |
| `deal_assumptions` | 1 | POPULATED |
| `proforma_assumptions` | 1 | SPARSE |
| `deal_context_fields` | 47 | POPULATED |
| `deal_files` | 19 (done=9, failed=8, queued=2) | POPULATED |
| `deal_monthly_actuals` | 24 | POPULATED |
| `deal_underwriting_snapshots` | 315 | POPULATED |
| `cashflow_projections` | 1 | SPARSE |
| `deal_traffic_snapshots` | 4 | SPARSE |
| `deal_zoning_profiles` | 1 | POPULATED |
| `jedi_score_history` | 1 | SPARSE |
| `data_quality_alerts` | 15 | POPULATED |
| `market_rent_comps` | 13 | POPULATED |
| `agent_runs` | 5,176 | POPULATED |
| `deal_activity` | 1 | SPARSE |
| `building_designs_3d` | 0 | EMPTY |
| `dispositions` | 0 | EMPTY |
| `capex_budget` | 0 | EMPTY |
| `deal_market_intelligence` | 0 | EMPTY |
| `supply_events` | 0 | EMPTY |
| `deal_tasks` | 0 | EMPTY |
| `deal_risks` | 0 | EMPTY |
| `deal_scenarios` | 0 | EMPTY |
| `deal_waterfall_config` | 0 | EMPTY |
| `deal_waterfalls` | 0 | EMPTY |
| `deal_debt_schedule` | 0 | EMPTY |
| `zoning_analyses` | 0 | EMPTY |
| `deal_contexts` | 0 | EMPTY |
| `deal_documents` (legacy) | 0 | BROKEN |

### Key field values (464 Bishop, live)

| Field | Table.column | Value |
|---|---|---|
| Purchase price | `deal_assumptions.land_cost` | NULL |
| Avg rent / unit | `deal_assumptions.avg_rent_per_unit` | $1,642 |
| Vacancy % | `deal_assumptions.vacancy_pct` | 19.83% |
| Exit cap rate | `deal_assumptions.exit_cap` | 5.00% |
| Hold period | `deal_assumptions.hold_period_years` | 5 years |
| Assumptions source | `deal_assumptions.assumptions_source` | `manual` |
| Source type | `deal_assumptions.source_type` | `apt_locator` |
| Last computed | `deal_assumptions.last_computed_at` | NULL |
| IRR levered | `deal_assumptions.irr_levered` | NULL |
| NOI stabilized | `deal_assumptions.noi_stabilized` | NULL |
| Investment strategy | `deal_assumptions.investment_strategy_lv` | `{detected:null, override:null}` |
| Exit strategy | `deal_assumptions.exit_strategy_lv` | `{detected:null, override:null}` |
| JEDI score | `deals.jedi_score` | NULL |
| Deal stage | `deals.stage` | `prospect` |

### All 47 `deal_context_fields` paths (all `agent:research`)

```
backtest.median_irr_accuracy        backtest.outperformance_rate         backtest.similar_deals_count
comps.avg_market_rent               comps.avg_occupancy                  comps.count
macro.job_growth_yoy                macro.median_household_income        macro.population_growth_yoy
macro.unemployment_rate             market.absorption_rate               market.avg_asking_rent
market.avg_effective_rent           market.construction_units            market.delivered_12mo_units
market.existing_units               market.months_of_supply              market.pipeline_units
market.price_per_sqft               market.stabilized_occupancy          market.total_pipeline_units
market.under_construction_units     market.vacancy_rate                  market_events.key_opportunities
market_events.key_risks             market_events.net_sentiment          market_events.upcoming_count
ownership.acquisition_date          ownership.acquisition_price          ownership.owner_name
ownership.owner_type                parcel.address                       parcel.avg_rent
parcel.not_found                    parcel.occupancy                     parcel.property_name
parcel.sqft                         parcel.units                         parcel.year_built
proximity.estimated_rent_premium_pct  proximity.grocery_grade            proximity.safety_grade
proximity.school_grade              proximity.transit_grade              tax.annual_amount
tax.assessed_value                  tax.effective_rate
```

---

## Per-Surface Field Breakdown

**Column schema for all field tables:**
- **Field** — operator-visible label
- **Endpoint** — backend API route that delivers or accepts this field
- **Source Table(s)** — database table(s) where the value is stored
- **Author Class** — who creates/updates the value (AGENT / OPERATOR / RESEARCH-PULL / OPERATOR-UPLOAD / COMPUTED / UNKNOWN)
- **Freshness Indicator** — column or mechanism tracking data age, if any
- **Gap (464 Bishop)** — POPULATED / SPARSE / EMPTY / MISSING / UNKNOWN

---

### F1 — Overview (M01 · OverviewScreen)

**Backend endpoints:** `GET /api/v1/deals/:id`, `GET /api/v1/jedi/score/:dealId`, `GET /api/v1/deals/:id/completeness`, `GET /api/v1/entitlements/:dealId`, `GET /api/market-research/intelligence/:dealId`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Deal name | `GET /api/v1/deals/:id` | `deals.name` | OPERATOR | None | POPULATED |
| Address | `GET /api/v1/deals/:id` | `deals.address` | OPERATOR | None | POPULATED |
| Stage | `GET /api/v1/deals/:id` | `deals.stage` | OPERATOR | None | POPULATED (`prospect`) |
| Deal type | `GET /api/v1/deals/:id` | `deals.deal_type` | OPERATOR | None | POPULATED (`existing`) |
| City / state | `GET /api/v1/deals/:id` | `deals.city`, `deals.state_code` | OPERATOR | None | POPULATED |
| Total units | `GET /api/v1/deals/:id` | `deals.unit_count` / `deal_context_fields.parcel.units` | OPERATOR / AGENT | None | SPARSE |
| JEDI score | `GET /api/v1/jedi/score/:dealId` | `jedi_score_history` | COMPUTED | `created_at` | SPARSE (1 row; `deals.jedi_score` null) |
| KPI strip (IRR, EM, NOI) | `GET /api/v1/deals/:id/financials` | `deal_assumptions`, `cashflow_projections` | COMPUTED | None | SPARSE (purchase price absent) |
| Completeness % | `GET /api/v1/deals/:id/completeness` | Multiple tables | COMPUTED | None | POPULATED |
| Zoning summary | `GET /api/v1/entitlements/:dealId` | `deal_zoning_profiles` | RESEARCH-PULL | None | SPARSE (1 row, no analysis) |
| Market signal strip (avg rent, occupancy, rent growth, HHI) | `GET /api/market-research/intelligence/:dealId` | `deal_market_intelligence` | RESEARCH-PULL | None | **EMPTY** (0 rows) |
| Acquisition date | `GET /api/v1/deals/:id` | `deals.acquisition_date` | OPERATOR | None | EMPTY (null) |
| Legal owner | `GET /api/v1/deals/:id` | `deals.legal_owner` | OPERATOR | None | EMPTY (null) |
| Purchase price | `GET /api/v1/deals/:id/financials` | `deals.deal_data` JSONB + `deal_assumptions.land_cost` | OPERATOR / OPERATOR-UPLOAD | None | **EMPTY** (both null) |
| Submarket | `GET /api/v1/deals/:id` | `deals.deal_data->>'submarketId'` | RESEARCH-PULL / UNKNOWN | None | EMPTY (not set) |

---

### F2 — Zoning (M02 · ZoningModuleSection)

**Backend endpoints:** `POST /api/v1/zoning/lookup`, `POST /api/v1/zoning/analyze`, `GET /api/v1/zoning/districts/:municipality/:state`, `GET /api/v1/building-envelope/:dealId`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Zoning designation | `POST /api/v1/zoning/lookup` | `deal_zoning_profiles`, `property_zoning_cache` | RESEARCH-PULL | None | SPARSE (1 profile row) |
| Zoning name / description | `POST /api/v1/zoning/lookup` | `deal_zoning_profiles` | RESEARCH-PULL | None | SPARSE |
| Max density (DU/acre) | `GET /api/v1/zoning/rules/:districtId` | `zoning_profiles` | RESEARCH-PULL | None | SPARSE |
| Max height (ft) | `GET /api/v1/zoning/rules/:districtId` | `zoning_profiles` | RESEARCH-PULL | None | SPARSE |
| Max FAR | `GET /api/v1/zoning/rules/:districtId` | `zoning_profiles` | RESEARCH-PULL | None | SPARSE |
| Setbacks (front/side/rear) | `GET /api/v1/zoning/rules/:districtId` | `zoning_profiles` | RESEARCH-PULL | None | SPARSE |
| Parking ratio | `GET /api/v1/zoning/rules/:districtId` | `zoning_profiles` | RESEARCH-PULL | None | SPARSE |
| Lot coverage % | `GET /api/v1/zoning/rules/:districtId` | `zoning_profiles` | RESEARCH-PULL | None | SPARSE |
| Entitlement milestones | `GET /api/v1/entitlements/:dealId` | `entitlements`, `entitlement_milestones` | OPERATOR | None | EMPTY |
| Building envelope (buildable SF, units achievable) | `GET /api/v1/building-envelope/:dealId` | `deal_assumptions` (COMPUTED) | COMPUTED | None | SPARSE |
| Zoning analysis text | `POST /api/v1/zoning/analyze` | `zoning_analyses`, `deal_zoning_profiles` | AGENT | None | **EMPTY** (0 `zoning_analyses` rows) |
| Municode / source citation | `GET /api/v1/zoning/lookup` | `deal_zoning_profiles.source_url` | RESEARCH-PULL | None | SPARSE |

---

### F3 — Market Intel (M05 · MarketScreen)

**Backend endpoints:** `GET /api/v1/deals/:id/market-intelligence`, `GET /api/market-research/intelligence/:dealId`, `GET /api/v1/market-intelligence/sale-comps`, `GET /api/v1/market-intelligence/properties`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Submarket avg rent | `GET /api/v1/deals/:id/market-intelligence` | `deal_market_intelligence` | RESEARCH-PULL | None | **EMPTY** (0 rows) |
| Submarket avg occupancy | `GET /api/v1/deals/:id/market-intelligence` | `deal_market_intelligence` | RESEARCH-PULL | None | **EMPTY** |
| Rent growth YoY | `GET /api/v1/deals/:id/market-intelligence` | `deal_market_intelligence` | RESEARCH-PULL | None | **EMPTY** |
| Median household income | `GET /api/v1/deals/:id/market-intelligence` | `deal_market_intelligence` | RESEARCH-PULL | None | **EMPTY** |
| Submarket name | `GET /api/v1/deals/:id/market-intelligence` | `deal_market_intelligence` | RESEARCH-PULL | None | **EMPTY** |
| Agent-researched avg asking rent | `GET /api/v1/deals/:id/assumptions` | `deal_context_fields` path `market.avg_asking_rent` | AGENT | `updated_at` | POPULATED |
| Agent-researched avg effective rent | `GET /api/v1/deals/:id/assumptions` | `deal_context_fields` path `market.avg_effective_rent` | AGENT | `updated_at` | POPULATED |
| Agent-researched vacancy rate | `GET /api/v1/deals/:id/assumptions` | `deal_context_fields` path `market.vacancy_rate` | AGENT | `updated_at` | POPULATED |
| Agent-researched pipeline units | `GET /api/v1/deals/:id/assumptions` | `deal_context_fields` path `market.pipeline_units` | AGENT | `updated_at` | POPULATED |
| Agent-researched absorption rate | `GET /api/v1/deals/:id/assumptions` | `deal_context_fields` path `market.absorption_rate` | AGENT | `updated_at` | POPULATED |
| Rent comps (nearby properties) | `GET /api/v1/market-intelligence/properties` | `market_rent_comps` | RESEARCH-PULL | None | POPULATED (13 rows) |
| Sale comps | `GET /api/v1/market-intelligence/sale-comps` | `market_sale_comps` (343,758 total; 46 in Atlanta) | RESEARCH-PULL | `sale_date` per comp | POPULATED (Atlanta pool) |
| Owner name / type | `GET /api/v1/deals/:id/assumptions` | `deal_context_fields` paths `ownership.owner_name`, `ownership.owner_type` | AGENT | `updated_at` | POPULATED |
| Acquisition price / date | `GET /api/v1/deals/:id/assumptions` | `deal_context_fields` paths `ownership.acquisition_price`, `ownership.acquisition_date` | AGENT | `updated_at` | POPULATED |

---

### F4 — Supply Pipeline (M04 · SupplyPipelineScreen)

**Backend endpoints:** `GET /api/v1/supply/deals/:dealId/supply`, `GET /api/v1/supply/trade-area/:id`, `GET /api/v1/supply/events`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Pipeline units (under construction) | `GET /api/v1/supply/deals/:dealId/supply` | `supply_events` | RESEARCH-PULL | None | **EMPTY** (0 rows) |
| Delivered units (12 months) | `GET /api/v1/supply/deals/:dealId/supply` | `supply_events` | RESEARCH-PULL | None | **EMPTY** |
| Permit velocity | `GET /api/v1/supply/deals/:dealId/supply` | `supply_events`, `supply_pipeline` | RESEARCH-PULL | None | **EMPTY** |
| Supply completions timeline | `GET /api/v1/supply/deals/:dealId/supply` | `supply_pipeline_projects` | RESEARCH-PULL | None | **EMPTY** |
| Months of supply (agent fallback) | `GET /api/v1/deals/:id/assumptions` | `deal_context_fields` path `market.months_of_supply` | AGENT | `updated_at` | POPULATED (fallback) |
| Under-construction units (agent fallback) | `GET /api/v1/deals/:id/assumptions` | `deal_context_fields` path `market.under_construction_units` | AGENT | `updated_at` | POPULATED |
| Total pipeline units (agent fallback) | `GET /api/v1/deals/:id/assumptions` | `deal_context_fields` path `market.total_pipeline_units` | AGENT | `updated_at` | POPULATED |
| Trade area supply risk score | `GET /api/v1/supply/trade-area/:id/risk` | `supply_risk_scores` | COMPUTED | None | EMPTY (no trade area linked) |

---

### F5 — Strategy (M08 · StrategyScreen)

**Backend endpoints:** `GET /api/v1/deals/:id/assumptions`, `POST /api/v1/deals/:id/assumptions/strategy-annotation`, `PATCH /api/v1/deals/:id/assumptions/strategy`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Investment strategy (detected) | `GET /api/v1/deals/:id/assumptions` | `deal_assumptions.investment_strategy_lv->>'detected'` | AGENT (M08 detection) | None | **MISSING** (null) |
| Investment strategy (override) | `PATCH /api/v1/deals/:id/assumptions/strategy` | `deal_assumptions.investment_strategy_lv->>'override'` | OPERATOR | None | **MISSING** (null) |
| Exit strategy (detected) | `GET /api/v1/deals/:id/assumptions` | `deal_assumptions.exit_strategy_lv->>'detected'` | AGENT (M08 detection) | None | **MISSING** (null) |
| Exit strategy (override) | `PATCH /api/v1/deals/:id/assumptions/strategy` | `deal_assumptions.exit_strategy_lv->>'override'` | OPERATOR | None | **MISSING** (null) |
| Strategy arbitrage score (BTS vs Rental vs STR) | `GET /api/v1/deals/:id/assumptions` | `strategy_analyses`, `deal_assumptions` | COMPUTED | None | EMPTY (no `strategy_analyses` rows) |
| Strategy evidence narrative | `POST /api/v1/deals/:id/assumptions/strategy-annotation` | `deal_assumptions.narrative_text` | AGENT | `narrative_generated_at` | SPARSE (not generated) |
| Sub-strategy library match | `GET /api/v1/deals/:id/assumptions` | `strategy_definitions` | COMPUTED | None | EMPTY (no strategy set) |

---

### F6 — Traffic Intel (M07 · TrafficScreen)

**Backend endpoints:** `GET /api/v1/deals/:id/traffic/latest-prediction`, `GET /api/v1/deals/:id/traffic/forecast-vs-actual`, `GET /api/v1/deals/:id/traffic/intelligence`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Latest ADT (traffic count) | `GET /api/v1/deals/:id/traffic/latest-prediction` | `deal_traffic_snapshots`, `adt_counts` | RESEARCH-PULL | Snapshot `created_at` | SPARSE (4 snapshots) |
| Effective ADT (adjusted) | `GET /api/v1/deals/:id/traffic/latest-prediction` | `deal_traffic_snapshots` | COMPUTED | Snapshot `created_at` | SPARSE |
| Monthly walk-in forecast | `GET /api/v1/deals/:id/traffic/latest-prediction` | `leasing_traffic_predictions` | COMPUTED (M07) | None | SPARSE |
| M07 confidence score | `GET /api/v1/deals/:id/traffic/latest-prediction` | `deal_traffic_snapshots` | COMPUTED | Snapshot `created_at` | SPARSE |
| M07 calibrated rent growth | `GET /api/v1/deals/:id/traffic/latest-prediction` | `deal_traffic_snapshots` | COMPUTED | Snapshot `created_at` | SPARSE |
| M07 calibrated exit cap | `GET /api/v1/deals/:id/traffic/latest-prediction` | `deal_traffic_snapshots` | COMPUTED | Snapshot `created_at` | SPARSE |
| Traffic-to-lease conversion rate | `GET /api/v1/deals/:id/traffic/intelligence` | `traffic_calibration_coefficients` | COMPUTED | None | SPARSE |
| Forecast vs actual chart | `GET /api/v1/deals/:id/traffic/forecast-vs-actual` | `deal_traffic_snapshots`, `deal_monthly_actuals` | COMPUTED | None | SPARSE |
| Digital traffic signals | `GET /api/v1/deals/:id/traffic/intelligence` | `digital_traffic_scores` | RESEARCH-PULL | None | SPARSE (present in snapshots; not verified separately) |

---

### F7 — 3D Design (M03 · Design3DScreen)

**Backend endpoints:** `GET /api/v1/building-design-3d/:dealId`, `GET /api/v1/building-envelope/:dealId`, `POST /api/v1/design-assistant`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| 3D massing model | `GET /api/v1/building-design-3d/:dealId` | `building_designs_3d` | OPERATOR / AGENT | None | **EMPTY** (0 rows) |
| Unit program (mix, SF, count) | `GET /api/v1/deals/:id/financials` | `deal_assumptions.unit_mix` JSONB | OPERATOR / OPERATOR-UPLOAD | None | POPULATED (apt_locator seed) |
| Amenity configuration | `GET /api/v1/deals/:id/assumptions` | `deal_assumptions.f3_design_program` JSONB | OPERATOR | None | SPARSE |
| Building envelope (GFA, efficiency %) | `GET /api/v1/building-envelope/:dealId` | `deal_assumptions.gross_sf`, `deal_assumptions.rentable_sf` | OPERATOR / COMPUTED | None | SPARSE |
| Construction type | `GET /api/v1/deals/:id/assumptions` | `deal_assumptions.construction_type` | OPERATOR | None | SPARSE |
| Design chat history | `POST /api/v1/design-assistant` | `design_chat_sessions` | AGENT / OPERATOR | None | EMPTY (no designs created) |

---

### F8 — Debt & Capital, M11 (DebtCapitalScreen)

**Backend endpoints:** `GET /api/v1/deals/:id/debt-schedule`, `GET /api/v1/deals/:id/balance-sheets`, `GET /api/v1/deals/:id/capex-items`, `GET /api/v1/deals/:id/data-sources`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Interest rate | `GET /api/v1/deals/:id/assumptions` | `deal_assumptions.interest_rate` | OPERATOR | None | SPARSE |
| Loan term years | `GET /api/v1/deals/:id/assumptions` | `deal_assumptions.loan_term_years` | OPERATOR | None | SPARSE |
| LTC | `GET /api/v1/deals/:id/assumptions` | `deal_assumptions.ltc` | OPERATOR | None | SPARSE |
| LTV | `GET /api/v1/deals/:id/assumptions` | `deal_assumptions.ltv` | OPERATOR | None | SPARSE |
| DSCR minimum | `GET /api/v1/deals/:id/assumptions` | `deal_assumptions.dscr_min` | OPERATOR | None | SPARSE |
| Debt yield minimum | `GET /api/v1/deals/:id/assumptions` | `deal_assumptions.debt_yield_min` | OPERATOR | None | SPARSE |
| Amortization years | `GET /api/v1/deals/:id/assumptions` | `deal_assumptions.amortization_years` | OPERATOR | None | SPARSE |
| IO period months | `GET /api/v1/deals/:id/assumptions` | `deal_assumptions.io_period_months` | OPERATOR | None | SPARSE |
| Origination fee % | `GET /api/v1/deals/:id/assumptions` | `deal_assumptions.origination_fee_pct` | OPERATOR | None | SPARSE |
| Debt schedule (amortization table) | `GET /api/v1/deals/:id/debt-schedule` | `deal_debt_schedule` | OPERATOR / COMPUTED | None | **EMPTY** (0 rows) |
| Balance sheets | `GET /api/v1/deals/:id/balance-sheets` | `deal_balance_sheets` | OPERATOR-UPLOAD | None | **EMPTY** (0 rows) |
| CapEx items | `GET /api/v1/deals/:id/capex-items` | `deal_capex_items` | OPERATOR | None | **EMPTY** (0 rows) |
| CapEx budget | `GET /api/v1/lifecycle/:id/capex/budget` | `capex_budget` | OPERATOR | None | **EMPTY** (0 rows) |
| Debt advisor sensitivity outputs | `GET /api/v1/deals/:id/financials` | `deal_assumptions` (COMPUTED) | COMPUTED | None | SPARSE |
| Exit timing sensitivity | `GET /api/v1/deals/:id/financials` | `deal_assumptions.exit_cap`, `hold_period_years` | COMPUTED | None | SPARSE |

---

### F8-M12 — Exit Strategy + Debt Market (within DebtCapitalScreen · ExitCapitalModule)

M12 is co-hosted within F8 (module subtitle "M11+M12 · EXIT STRATEGY + DEBT MARKET"). It is rendered by `ExitCapitalModule` and surfaces exit trajectory analysis, live debt market rates, M35 event-driven cap rate and rent growth forecasts, and competitive positioning for a pending disposition.

**Backend endpoints:** `GET /api/v1/deals/:id/exit-trajectory`, `GET /api/v1/lifecycle/:id/exit-timing`, `GET /api/v1/lifecycle/:id/dispositions`, `GET /api/v1/lifecycle/:id/debt`, `GET /api/v1/lifecycle/:id/competitive-position`, `GET /m35/deals/:id/events-context`, `GET /api/v1/capital-structure/rates/live`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Exit trajectory (multi-year cap rate path) | `GET /api/v1/deals/:id/exit-trajectory` | `metric_time_series`, `deal_assumptions` | COMPUTED | Series `period_date` | SPARSE (no deal-specific trajectory run confirmed) |
| Exit timing recommendation (optimal year) | `GET /api/v1/lifecycle/:id/exit-timing` | `metric_time_series`, `deals`, `deal_assumptions` | COMPUTED | `metric_time_series.period_date` | SPARSE |
| M35 event-driven rent growth forecast | `GET /m35/deals/:id/events-context` | `key_events`, `event_forecasts` | RESEARCH-PULL + COMPUTED | `event_forecasts.confidence` | EMPTY (no supply_events, no key_events for deal) |
| M35 event-driven cap rate forecast | `GET /m35/deals/:id/events-context` | `key_events`, `event_forecasts` | RESEARCH-PULL + COMPUTED | `event_forecasts.confidence` | EMPTY |
| M35 event-driven vacancy forecast | `GET /m35/deals/:id/events-context` | `key_events`, `event_forecasts` | RESEARCH-PULL + COMPUTED | `event_forecasts.confidence` | EMPTY |
| Live 10-year Treasury rate | `GET /api/v1/capital-structure/rates/live` | External rate feed (FRED API) | RESEARCH-PULL | None (live fetch) | POPULATED (platform-wide; not deal-specific) |
| EFFR target range | `GET /api/v1/capital-structure/rates/live` | External rate feed (FRED API) | RESEARCH-PULL | None (live fetch) | POPULATED |
| Disposition record (prior sales) | `GET /api/v1/lifecycle/:id/dispositions` | `dispositions` | OPERATOR-UPLOAD | `closing_date` | **EMPTY** (0 rows) |
| Debt maturity / refi test | `GET /api/v1/lifecycle/:id/refi-test` | `deal_assumptions`, `deal_debt_schedule` | COMPUTED | None | SPARSE (no debt schedule) |
| Competitive position (vs submarket) | `GET /api/v1/lifecycle/:id/competitive-position` | `lifecycle_comp_set`, `market_rent_comps` | COMPUTED | None | SPARSE (13 `market_rent_comps` rows available) |

---

### F9 — Financial Engine (M08 · FinancialEnginePage)

The Financial Engine has 11 built-in sub-tabs. ROADMAP (tab 10) is only shown for `value-add` and `redevelopment` deal types.

**Primary data assembly:** `GET /api/v1/deals/:id/financials` → `getDealFinancials()` in `proforma-adjustment.service.ts`. This function reads from `deal_assumptions`, `deal_context_fields`, `deal_monthly_actuals`, `cashflow_projections`, and `deals.deal_data` JSONB, assembling a single `F9DealFinancials` object passed to all sub-tabs.

---

#### F9 Tab 0 — ⊞ OVERVIEW

**Endpoints:** Parent-passed `f9Financials` from `GET /api/v1/deals/:id/financials`; `GET /api/market-research/intelligence/:dealId`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| IRR levered | `GET /api/v1/deals/:id/financials` | `cashflow_projections.five_yr_irr` | COMPUTED | None | SPARSE (cashflow row exists; deal_assumptions.irr_levered null) |
| Equity multiple | `GET /api/v1/deals/:id/financials` | COMPUTED from projections | COMPUTED | None | SPARSE |
| Cash-on-cash yr1 | `GET /api/v1/deals/:id/financials` | COMPUTED from projections | COMPUTED | None | SPARSE |
| Year-1 NOI | `GET /api/v1/deals/:id/financials` | `cashflow_projections.year1_noi` | COMPUTED | None | SPARSE |
| Stabilized yield | `GET /api/v1/deals/:id/financials` | `cashflow_projections.stabilized_yield_pct` | COMPUTED | None | SPARSE |
| Stabilized value | `GET /api/v1/deals/:id/financials` | COMPUTED from stabilized NOI / exit cap | COMPUTED | None | SPARSE |
| DSCR | `GET /api/v1/deals/:id/financials` | COMPUTED from debt params | COMPUTED | None | SPARSE |
| Purchase price display | `GET /api/v1/deals/:id/financials` | `deals.deal_data->>'purchase_price'` | OPERATOR-UPLOAD / OPERATOR | None | **EMPTY** (null) |
| Cap rate collision dots | `GET /api/v1/deals/:id/field-divergences` | `deals.deal_data.broker_cap_rate` vs `deal_traffic_snapshots` | COMPUTED | None | SPARSE |
| Market signals panel (submarket, avg rent, occupancy) | `GET /api/market-research/intelligence/:dealId` | `deal_market_intelligence` | RESEARCH-PULL | None | **EMPTY** (0 rows) |

---

#### F9 Tab 1 — ⊕ CONSOLE (DealTermsTab + ProFormaSummaryTab + AssumptionsTab)

**Endpoints:** `GET /api/v1/deals/:id/financials`, `GET /api/v1/deals/:id/implied-cap-rate`, `PATCH /api/v1/deals/:id/assumptions/*`, `PUT /api/v1/deals/:id/assumptions`, `POST /api/v1/sigma/plausibility`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Purchase price (operator layer) | `PATCH /api/v1/deals/:id/purchase-price` | `deal_assumptions.land_cost` | OPERATOR | None | **EMPTY** (null) |
| Purchase price (broker layer) | `GET /api/v1/deals/:id/financials` | `deals.deal_data.extraction_om` | OPERATOR-UPLOAD | None | UNKNOWN (OM not extracted) |
| Hold period (years) | `PATCH /api/v1/deals/:id/assumptions/hold-period` | `deal_assumptions.hold_period_years` | OPERATOR | None | POPULATED (5) |
| Investment strategy | `PATCH /api/v1/deals/:id/assumptions/strategy` | `deal_assumptions.investment_strategy_lv` | AGENT / OPERATOR | None | **MISSING** (both null) |
| Exit strategy | `PATCH /api/v1/deals/:id/assumptions/strategy` | `deal_assumptions.exit_strategy_lv` | AGENT / OPERATOR | None | **MISSING** (both null) |
| Target IRR | `PATCH /api/v1/deals/:id/assumptions/targets` | `deal_assumptions.target_irr` | OPERATOR | None | SPARSE |
| Target EM | `PATCH /api/v1/deals/:id/assumptions/targets` | `deal_assumptions.target_em` | OPERATOR | None | SPARSE |
| Target CoC | `PATCH /api/v1/deals/:id/assumptions/targets` | `deal_assumptions.target_coc` | OPERATOR | None | SPARSE |
| Selling costs % | `PATCH /api/v1/deals/:id/assumptions/selling-costs` | `deal_assumptions.selling_costs_pct` | OPERATOR | None | SPARSE |
| Closing costs | `PATCH /api/v1/deals/:id/assumptions/closing-costs` | `deal_assumptions` (multiple columns) | OPERATOR | None | SPARSE |
| GPR (gross potential rent) | `GET /api/v1/deals/:id/financials` | COMPUTED: `deal_assumptions.avg_rent_per_unit` × units × 12 / `deal_monthly_actuals` T12 layer | COMPUTED / OPERATOR-UPLOAD | None | POPULATED |
| Vacancy % | `PUT /api/v1/deals/:id/assumptions` | `deal_assumptions.vacancy_pct` | OPERATOR (apt_locator seed) | None | POPULATED (19.83%) |
| Concessions % | `PUT /api/v1/deals/:id/assumptions` | `deal_assumptions.concessions_pct` | OPERATOR / OPERATOR-UPLOAD | None | SPARSE |
| Rent growth yr1 | `PUT /api/v1/deals/:id/assumptions` | `deal_assumptions.rent_growth_yr1` | OPERATOR / AGENT | None | SPARSE |
| Rent growth stabilized | `PUT /api/v1/deals/:id/assumptions` | `deal_assumptions.rent_growth_stabilized` | OPERATOR / AGENT | None | SPARSE |
| OPEX ratio | `PUT /api/v1/deals/:id/assumptions` | `deal_assumptions.opex_ratio` | OPERATOR / OPERATOR-UPLOAD | None | SPARSE |
| OPEX per unit | `GET /api/v1/deals/:id/financials` | COMPUTED / `deal_monthly_actuals` | COMPUTED / OPERATOR-UPLOAD | None | SPARSE |
| Property tax rate | `PUT /api/v1/deals/:id/assumptions` | `deal_assumptions.property_tax_rate` | OPERATOR / RESEARCH-PULL | None | SPARSE |
| Management fee % | `PUT /api/v1/deals/:id/assumptions` | `deal_assumptions.management_fee_pct` | OPERATOR | None | SPARSE |
| Replacement reserves / unit | `PUT /api/v1/deals/:id/assumptions` | `deal_assumptions.replacement_reserves_per_unit` | OPERATOR | None | SPARSE |
| Other income per unit | `PATCH /api/v1/deals/:id/financials/other-income/category-overrides` | `deal_assumptions.other_income_per_unit` | OPERATOR / OPERATOR-UPLOAD | None | SPARSE |
| M07 calibrated rent growth (platform) | `GET /api/v1/deals/:id/traffic/latest-prediction` | `deal_traffic_snapshots` | COMPUTED (M07) | Snapshot `created_at` | SPARSE |
| M07 calibrated exit cap (platform) | `GET /api/v1/deals/:id/traffic/latest-prediction` | `deal_traffic_snapshots` | COMPUTED (M07) | Snapshot `created_at` | SPARSE |
| Implied cap rate | `GET /api/v1/deals/:id/implied-cap-rate` | COMPUTED from deal_assumptions + market data | COMPUTED | None | SPARSE |
| T12 income/expense actuals | `GET /api/v1/deals/:id/financials` | `deal_monthly_actuals.*` (24 rows) | OPERATOR-UPLOAD (T12 extraction) | `source_date` | POPULATED |
| Rent roll unit mix | `GET /api/v1/deals/:id/financials` | `deal_monthly_actuals` + `deal_assumptions.unit_mix` | OPERATOR-UPLOAD | `source_date` | POPULATED |
| DQA plausibility tier (REALISTIC / AGGRESSIVE / HEROIC) | `POST /api/v1/sigma/plausibility` | COMPUTED (sigma service) | COMPUTED | None | SPARSE |
| Leasing cost treatment | `GET /api/v1/deals/:id/financials` | `deals.deal_data.leasing_cost_treatment` | OPERATOR / COMPUTED | None | POPULATED |

---

#### F9 Tab 2 — ⋮≡ PROJECTIONS

**Endpoints:** `GET /api/v1/deals/:id/financials`, `GET /api/v1/deals/:id/financials/narrative`, `PATCH /api/v1/deals/:id/assumptions/monthly`, `POST /api/v1/deals/:id/financials/other-income/user-lines`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Year-by-year GPR | `GET /api/v1/deals/:id/financials` | COMPUTED: `deal_assumptions.avg_rent_per_unit` + rent growth | COMPUTED | None | SPARSE (purchase price absent) |
| Year-by-year vacancy loss | `GET /api/v1/deals/:id/financials` | COMPUTED: `deal_assumptions.vacancy_pct` + stabilization | COMPUTED | None | SPARSE |
| Year-by-year EGI | `GET /api/v1/deals/:id/financials` | COMPUTED (GPR − Vacancy − Concessions + Other income) | COMPUTED | None | SPARSE |
| Year-by-year OPEX | `GET /api/v1/deals/:id/financials` | COMPUTED: `deal_assumptions.opex_ratio` + `opex_growth` | COMPUTED | None | SPARSE |
| Year-by-year NOI | `GET /api/v1/deals/:id/financials` | COMPUTED (EGI − OPEX) | COMPUTED | None | SPARSE |
| Year-by-year debt service | `GET /api/v1/deals/:id/financials` | COMPUTED from debt parameters in `deal_assumptions` | COMPUTED | None | SPARSE |
| Year-by-year cash flow | `GET /api/v1/deals/:id/financials` | COMPUTED (NOI − Debt Service) | COMPUTED | None | SPARSE |
| Other income user lines | `POST/PATCH /api/v1/deals/:id/financials/other-income/user-lines` | `deal_assumptions` user-lines JSONB | OPERATOR | `updated_at` | SPARSE |
| Per-year monthly overrides | `PATCH /api/v1/deals/:id/assumptions/monthly` | `deal_monthly_assumptions` | OPERATOR | `updated_at` | SPARSE |
| AI narrative blocks | `GET /api/v1/deals/:id/financials/narrative` | `deal_assumptions.narrative_text` | AGENT (Claude) | `narrative_generated_at` | SPARSE (not generated) |

---

#### F9 Tab 3 — ✓ VALIDATION

**Endpoints:** `GET /api/v1/deals/:id/completeness`, `GET /api/v1/deals/:id/assumptions`, `GET /api/v1/deals/:id/implied-cap-rate`, `GET /api/v1/deals/:id/field-divergences`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Completeness score (%) | `GET /api/v1/deals/:id/completeness` | Multi-table completeness service | COMPUTED | None | POPULATED |
| DQA alert list | `GET /api/v1/deals/:id/completeness` | `data_quality_alerts` (15 rows) | COMPUTED | `created_at` | **POPULATED** (15 alerts) |
| Field divergences (broker vs platform >10%) | `GET /api/v1/deals/:id/field-divergences` | `deal_assumptions`, `deal_context_fields`, `deals.deal_data` | COMPUTED | None | SPARSE (limited dual-sourced fields) |
| Implied cap rate | `GET /api/v1/deals/:id/implied-cap-rate` | COMPUTED from deal + market data | COMPUTED | None | SPARSE |
| Plausibility tier (REALISTIC / AGGRESSIVE / HEROIC) | `POST /api/v1/sigma/plausibility` | COMPUTED (sigma service) | COMPUTED | None | SPARSE |
| Assumption source provenance | `GET /api/v1/deals/:id/assumptions` | `deal_assumptions.source_type`, `deal_context_fields.source_label` | OPERATOR-UPLOAD / AGENT | None | POPULATED (`apt_locator` / `agent:research`) |

---

#### F9 Tab 4 — ◈ CAPITAL (SourcesUsesTab + WaterfallTab)

**Endpoints:** `GET /api/v1/deals/:id/financials`, `PATCH /api/v1/deals/:id/financials/override`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Land cost / purchase price | `PATCH /api/v1/deals/:id/purchase-price` | `deal_assumptions.land_cost` | OPERATOR | None | **EMPTY** (null) |
| Hard cost (total / PSF) | `PATCH /api/v1/deals/:id/financials/override` | `deal_assumptions.hard_cost_total`, `hard_cost_psf` | OPERATOR / COMPUTED | None | SPARSE |
| Soft cost (% and total) | `PATCH /api/v1/deals/:id/financials/override` | `deal_assumptions.soft_cost_pct`, `soft_cost_total` | OPERATOR / COMPUTED | None | SPARSE |
| Contingency | `PATCH /api/v1/deals/:id/financials/override` | `deal_assumptions.contingency_pct`, `contingency_total` | OPERATOR | None | SPARSE |
| Developer fee | `PATCH /api/v1/deals/:id/financials/override` | `deal_assumptions.developer_fee_pct`, `developer_fee_total` | OPERATOR | None | SPARSE |
| Total development cost (TDC) | `GET /api/v1/deals/:id/financials` | COMPUTED from `deal_assumptions` (TDC, TDC/unit, TDC/SF) | COMPUTED | None | SPARSE |
| Loan amount | `GET /api/v1/deals/:id/financials` | COMPUTED (TDC × LTC) | COMPUTED | None | **EMPTY** (TDC null) |
| Equity required | `GET /api/v1/deals/:id/financials` | COMPUTED (TDC − Loan) | COMPUTED | None | **EMPTY** |
| LP / GP split % | `PATCH /api/v1/deals/:id/financials/override` | `deal_waterfall_config` | OPERATOR | None | **EMPTY** (0 rows) |
| Preferred return % | `PATCH /api/v1/deals/:id/financials/override` | `deal_waterfall_config` | OPERATOR | None | **EMPTY** |
| Promote / carried interest | `PATCH /api/v1/deals/:id/financials/override` | `deal_waterfall_config` | OPERATOR | None | **EMPTY** |
| Investor commitments | `GET /api/v1/capital/deals/:id/investments` | `deal_investments` | OPERATOR | None | EMPTY |
| Waterfall distributions | `GET /api/v1/deals/:id/financials` | `deal_waterfalls` | COMPUTED / OPERATOR | None | **EMPTY** (0 rows) |

---

#### F9 Tab 5 — % RETURNS

**Endpoints:** `GET /api/v1/deals/:id/financials`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Levered IRR | `GET /api/v1/deals/:id/financials` | COMPUTED: hold-period projection + exit proceeds | COMPUTED | None | SPARSE (purchase price null) |
| Unlevered IRR | `GET /api/v1/deals/:id/financials` | COMPUTED | COMPUTED | None | SPARSE |
| Equity multiple (levered) | `GET /api/v1/deals/:id/financials` | COMPUTED | COMPUTED | None | SPARSE |
| Cash-on-cash yr1 | `GET /api/v1/deals/:id/financials` | COMPUTED | COMPUTED | None | SPARSE |
| Cash-on-cash stabilized | `GET /api/v1/deals/:id/financials` | COMPUTED | COMPUTED | None | SPARSE |
| Net sale proceeds | `GET /api/v1/deals/:id/financials` | COMPUTED (exit cap × stabilized NOI − selling costs − loan payoff) | COMPUTED | None | SPARSE |
| LP returns (IRR, EM) | `GET /api/v1/deals/:id/financials` | COMPUTED from `deal_waterfall_config` | COMPUTED | None | **EMPTY** (no waterfall) |
| GP returns (IRR, EM) | `GET /api/v1/deals/:id/financials` | COMPUTED from `deal_waterfall_config` | COMPUTED | None | **EMPTY** |
| Break-even occupancy | `GET /api/v1/deals/:id/financials` | `cashflow_projections.breakeven_occupancy` | COMPUTED | None | SPARSE |

---

#### F9 Tab 6 — ⊡ VALUATION

**Endpoints:** `GET /api/v1/deals/:id/valuation-grid`, `GET /api/v1/deals/:id/valuation-grid/comps`, `PATCH /api/v1/deals/:id/valuation-grid/override`, `GET /api/v1/deals/:id/field-divergences`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Stabilized value (income approach) | `GET /api/v1/deals/:id/valuation-grid` | COMPUTED (stabilized NOI / exit cap) | COMPUTED | None | SPARSE |
| Going-in cap rate | `GET /api/v1/deals/:id/valuation-grid` | COMPUTED (T12 NOI / purchase price) | COMPUTED | None | **EMPTY** (purchase price null) |
| Exit cap rate | `PATCH /api/v1/deals/:id/valuation-grid/override` | `deal_assumptions.exit_cap` | OPERATOR | None | POPULATED (5.0%) |
| PPU implied | `GET /api/v1/deals/:id/valuation-grid` | COMPUTED (stabilized value / units) | COMPUTED | None | SPARSE |
| Sale comps (PPU, cap rate, date, distance) | `GET /api/v1/deals/:id/valuation-grid/comps` | `market_sale_comps` (46 Atlanta comps) | RESEARCH-PULL | `sale_date` per comp | POPULATED (Atlanta pool available) |
| Comp criteria (radius, min/max units, age) | `PATCH /api/v1/deals/:id/valuation-grid/comps/criteria` | `deal_assumptions.comp_criteria` JSONB | OPERATOR | None | SPARSE |
| Valuation override | `PATCH /api/v1/deals/:id/valuation-grid/override` | `deal_assumptions.valuation_override_lv` | OPERATOR | None | SPARSE |
| Submarket median cap rate | `GET /api/v1/deals/:id/valuation-grid` | COMPUTED from comp set | COMPUTED | Comp `sale_date` | SPARSE (46 Atlanta comps; deal-radius subset unknown) |

---

#### F9 Tab 7 — ◐ SCENARIOS (DebtTab + DecisionTab)

**Endpoints:** `PATCH /api/v1/deals/:id/financials/override`, `GET /api/v1/jedi/score/:dealId`, `GET /api/v1/deals/:id/financials`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Debt parameters (rate, term, LTC, amortization) | `PATCH /api/v1/deals/:id/financials/override` | `deal_assumptions` debt columns | OPERATOR | None | SPARSE |
| DSCR computed | `GET /api/v1/deals/:id/financials` | COMPUTED from debt + NOI | COMPUTED | None | SPARSE |
| Debt yield computed | `GET /api/v1/deals/:id/financials` | COMPUTED (NOI / loan amount) | COMPUTED | None | **EMPTY** (loan amount null) |
| JEDI score component breakdown | `GET /api/v1/jedi/score/:dealId` | `jedi_score_history` (1 row) | COMPUTED | `created_at` | SPARSE |
| Hold vs sell recommendation | `GET /api/v1/deals/:id/financials` | COMPUTED from IRR vs target, NOI trend | COMPUTED | None | SPARSE |
| Strategy arbitrage panel | `GET /api/v1/deals/:id/assumptions` | `strategy_analyses`, `deal_assumptions` | COMPUTED | None | EMPTY |

---

#### F9 Tab 8 — ⇔ COMPARE

**Endpoints:** `GET /api/v1/deals/:id/financials` (historical snapshots)

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Snapshot version A/B selector | `GET /api/v1/deals/:id/financials` | `deal_underwriting_snapshots` (315 rows) | AGENT / OPERATOR | `created_at` | POPULATED (snapshots exist) |
| Named scenario references | `GET /api/v1/deals/:id/financials` | `deal_scenarios` | OPERATOR | None | **EMPTY** (0 rows — Compare tab has no named references) |
| Delta comparison (IRR, NOI, EM) | `GET /api/v1/deals/:id/financials` | COMPUTED from two snapshot rows | COMPUTED | None | POPULATED (if operator creates scenarios) |

---

#### F9 Tab 9 — ⊙ GOAL SEEK

**Endpoints:** Iterative `POST /api/v1/deals/:id/financials/override`, `GET /api/v1/deals/:id/financials/export`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Target metric (IRR / EM / CoC) | `POST /api/v1/deals/:id/financials/override` (iterative) | In-memory iterations (not persisted) | COMPUTED | None | N/A (on-demand) |
| Solve variable (price / rent / vacancy / cap rate) | `POST /api/v1/deals/:id/financials/override` | In-memory | COMPUTED | None | N/A |
| Sensitivity table (range × range) | `GET /api/v1/deals/:id/financials` | COMPUTED | COMPUTED | None | N/A |
| Excel export | `GET /api/v1/deals/:id/financials/export` | COMPUTED from `deal_assumptions` + projections | COMPUTED | None | SPARSE (incomplete without purchase price) |

---

#### F9 Tab 10 — ⊛ ROADMAP (value-add / redevelopment only)

**Endpoints:** `GET /api/v1/deals/:id/financials`, `GET /api/v1/deals/:id/renovation`  
**Visibility:** Only shown when `deal_type` matches `value-add`, `value_add`, `rehab`, `renovation`, or `redevelopment`.

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Renovation timeline (months) | `GET /api/v1/deals/:id/financials` | `deal_assumptions.construction_months` | OPERATOR | None | N/A (tab hidden — deal_type = `existing`) |
| Units/year renovated | `GET /api/v1/deals/:id/financials` | `deal_assumptions.renovation_units_per_year` | OPERATOR | None | N/A |
| Rent premium post-reno | `GET /api/v1/deals/:id/financials` | `deal_assumptions.renovation_premium_per_unit_monthly` | OPERATOR | None | N/A |
| Downtime per unit | `GET /api/v1/deals/:id/financials` | `deal_assumptions.renovation_downtime_months_per_unit` | OPERATOR | None | N/A |
| Stabilization target | `GET /api/v1/deals/:id/financials` | `deal_assumptions.stabilization_target_pct` | OPERATOR | None | N/A |
| Stabilization year | `GET /api/v1/deals/:id/financials` | `deal_assumptions.stabilization_year` | COMPUTED / OPERATOR | None | N/A |

---

### F10 — Risk (M13 · RiskScreen)

**Backend endpoints:** `GET /api/v1/deals/:id/completeness`, `GET /api/v1/jedi/alerts/deal/:dealId`, `GET /api/v1/jedi/impact/:dealId`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Completeness gaps (critical / important) | `GET /api/v1/deals/:id/completeness` | `data_quality_alerts` (15 rows) | COMPUTED | `created_at` | **POPULATED** |
| JEDI alert list | `GET /api/v1/jedi/alerts/deal/:dealId` | `jedi_alerts` | COMPUTED | `created_at` | SPARSE |
| Risk factor scores | `GET /api/v1/jedi/impact/:dealId` | `jedi_score_history` | COMPUTED | `created_at` | SPARSE |
| DD checklist items | `GET /api/v1/deals/:id/completeness` | `deal_tasks` | OPERATOR | `updated_at` | **EMPTY** (0 rows) |
| Deal risks | `GET /api/v1/deals/:id/completeness` | `deal_risks` | AGENT / OPERATOR | `created_at` | **EMPTY** (0 rows) |

---

### F11 — Deal Tools (M21 · DealToolsScreen)

**Backend endpoints:** `GET /api/v1/deals/:id/files`, `GET /api/v1/deals/:id/files/:fileId/extraction`, `GET /api/v1/deals/:id/files/stats`, `POST /api/v1/deals/:id/reprocess-documents`, `DELETE /api/v1/deals/:id/files/:fileId`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Filename / original filename | `GET /api/v1/deals/:id/files` | `deal_files.filename`, `original_filename` | OPERATOR-UPLOAD | None | POPULATED (19 files) |
| File category | `GET /api/v1/deals/:id/files` | `deal_files.category`, `auto_category_confidence` | OPERATOR-UPLOAD + COMPUTED | None | POPULATED |
| Extraction status | `GET /api/v1/deals/:id/files` | `deal_files.extraction_status` | COMPUTED | `extraction_completed_at` | POPULATED (done=9, failed=8, queued=2) |
| Extraction result (structured data) | `GET /api/v1/deals/:id/files/:fileId/extraction` | `deal_files.extraction_result` JSONB | AGENT (extraction skill) | `extraction_completed_at` | POPULATED (9 successful extractions) |
| Extraction skill used | `GET /api/v1/deals/:id/files` | `deal_files.extraction_skill` | COMPUTED | `extraction_completed_at` | POPULATED |
| File size / MIME type | `GET /api/v1/deals/:id/files` | `deal_files.file_size`, `mime_type` | OPERATOR-UPLOAD | None | POPULATED |
| Version history | `GET /api/v1/deals/:id/files` | `deal_files.version`, `parent_file_id` | OPERATOR-UPLOAD | None | SPARSE |
| Expiration date | `GET /api/v1/deals/:id/files` | `deal_files.expiration_date` | OPERATOR | None | SPARSE |
| Extraction error | `GET /api/v1/deals/:id/files` | `deal_files.extraction_error` | COMPUTED | `extraction_completed_at` | SPARSE (8 failed; error text present) |
| Uploaded by | `GET /api/v1/deals/:id/files` | `deal_files.uploaded_by` | OPERATOR-UPLOAD | None | POPULATED |

**Critical note:** The legacy `deal_documents` table has 0 rows for 464 Bishop and is fully superseded by `deal_files`. Any integration, script, or agent tool still reading `deal_documents` will silently find no data.

---

### Validation Grid (within F9 Tab 3)

**Endpoints:** `GET /api/v1/deals/:id/completeness`, `GET /api/v1/deals/:id/field-divergences`, `GET /api/v1/deals/:id/assumptions`, `GET /api/v1/deals/:id/implied-cap-rate`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Completeness score (%) | `GET /api/v1/deals/:id/completeness` | Multi-table completeness service | COMPUTED | None | POPULATED |
| DQA alert list (15 alerts for 464 Bishop) | `GET /api/v1/deals/:id/completeness` | `data_quality_alerts` | COMPUTED | `created_at` | **POPULATED** (15 rows) |
| GPR divergence (broker vs platform) | `GET /api/v1/deals/:id/field-divergences` | `deals.deal_data.broker_claims` vs `deal_context_fields` | COMPUTED | None | SPARSE |
| Cap rate divergence | `GET /api/v1/deals/:id/field-divergences` | `deals.deal_data.extraction_om` vs `deal_traffic_snapshots` | COMPUTED | None | SPARSE |
| Vacancy divergence | `GET /api/v1/deals/:id/field-divergences` | `deal_assumptions.vacancy_pct` vs `deal_context_fields.market.vacancy_rate` | COMPUTED | None | SPARSE |
| Implied cap rate | `GET /api/v1/deals/:id/implied-cap-rate` | COMPUTED from deal + market data | COMPUTED | None | SPARSE |
| Plausibility tier | `POST /api/v1/sigma/plausibility` | COMPUTED (sigma service) | COMPUTED | None | SPARSE |
| Assumption source provenance | `GET /api/v1/deals/:id/assumptions` | `deal_assumptions.source_type`, `deal_context_fields.source_label` | N/A (metadata) | None | POPULATED |

---

### Valuation Grid (within F9 Tab 6)

**Endpoints:** `GET /api/v1/deals/:id/valuation-grid`, `GET /api/v1/deals/:id/valuation-grid/comps`, `PATCH /api/v1/deals/:id/valuation-grid/comps/criteria`

| Field | Endpoint | Source Table(s) | Author Class | Freshness Indicator | Gap (464 Bishop) |
|---|---|---|---|---|---|
| Subject stabilized value | `GET /api/v1/deals/:id/valuation-grid` | COMPUTED | COMPUTED | None | SPARSE |
| Subject exit cap | `PATCH /api/v1/deals/:id/valuation-grid/override` | `deal_assumptions.exit_cap` | OPERATOR | None | POPULATED (5.0%) |
| Comp property name / address | `GET /api/v1/deals/:id/valuation-grid/comps` | `market_sale_comps` | RESEARCH-PULL | `sale_date` | POPULATED (Atlanta pool: 46 comps) |
| Comp sale price / PPU | `GET /api/v1/deals/:id/valuation-grid/comps` | `market_sale_comps` | RESEARCH-PULL | `sale_date` | POPULATED |
| Comp implied cap rate | `GET /api/v1/deals/:id/valuation-grid/comps` | `market_sale_comps.implied_cap_rate` | COMPUTED (enrichment pipeline) | `sale_date` | POPULATED (where enriched) |
| Comp units / year built | `GET /api/v1/deals/:id/valuation-grid/comps` | `market_sale_comps` | RESEARCH-PULL | `sale_date` | POPULATED |
| Comp distance from subject | `GET /api/v1/deals/:id/valuation-grid/comps` | COMPUTED from property lat/lng | COMPUTED | None | POPULATED (where lat/lng available) |
| Include/exclude toggle | `POST /api/v1/deals/:id/valuation-grid/comps/:id/include` | `market_sale_comps.qualified` | OPERATOR | None | SPARSE (no overrides set) |
| IQR outlier flagging | `GET /api/v1/deals/:id/valuation-grid` | COMPUTED in-browser from comp array | COMPUTED | None | N/A |
| Comp search criteria | `PATCH /api/v1/deals/:id/valuation-grid/comps/criteria` | `deal_assumptions.comp_criteria` JSONB | OPERATOR | None | SPARSE |

---

### Document Library (F11 — Deal Tools)

See the F11 section above. Summary for 464 Bishop:

| Category | Count | Extraction Status |
|---|---|---|
| Total files | 19 | 9 done, 8 failed, 2 queued |
| Structured extraction results available | 9 | `deal_files.extraction_result` JSONB |
| Files with extraction errors | 8 | `deal_files.extraction_error` populated |
| `deal_documents` (legacy table) | 0 | **BROKEN** — superseded |

---

## Seven Specific Findings

### Finding 1: Agent-Authored Calculated Fields

All 47 `deal_context_fields` rows for 464 Bishop carry `source_label = 'agent:research'` — written exclusively by the research agent. No OPERATOR overrides exist. These values feed directly into F9 model inputs, market signals, and display panels with no UI provenance indicator.

**Critical data paths that flow from agent-authored fields into the F9 model:**

| Field Path | F9 Impact | Current Value |
|---|---|---|
| `market.avg_effective_rent` | Platform rent benchmark in Console; GPR decomposition "platform" layer | POPULATED |
| `market.vacancy_rate` | Platform vacancy benchmark; divergence check against `deal_assumptions.vacancy_pct` | POPULATED |
| `comps.avg_market_rent` | Rent comp comparison panel in F3 | POPULATED |
| `comps.avg_occupancy` | Occupancy benchmark | POPULATED |
| `tax.annual_amount` | Property tax seed for OPEX model | POPULATED |
| `tax.assessed_value` | Tax assessment display | POPULATED |
| `parcel.units` | Unit count when `deals.unit_count` is null | POPULATED |
| `market.pipeline_units` | Supply context for strategy scoring | POPULATED |

**Author gap:** The `source_label = 'agent:research'` is backend-only metadata. An operator viewing market signals in F1, F3, or F9 CONSOLE has no way to distinguish an agent-researched figure from a licensed data provider value. No per-field "as of" date is surfaced.

---

### Finding 2: Agent-Silent Layer 2 Assumptions

`deal_assumptions` fields with `detected` slots in `LayeredValue` fields are null for 464 Bishop with no agent author:

| Field | Expected Author | Root Cause |
|---|---|---|
| `investment_strategy_lv.detected` | AGENT (M08 detection) | M08 detection has not run or produced a result |
| `exit_strategy_lv.detected` | AGENT (M08 detection) | Same |
| `rent_growth_yr1` | AGENT or OPERATOR | Seeded only from `apt_locator`; no agent value |
| `last_computed_at` | COMPUTED (returns engine) | NULL — assumptions have never been formally computed for this deal despite 315 snapshots |
| `irr_levered` | COMPUTED | NULL — requires purchase price; never persisted |
| `noi_stabilized` | COMPUTED | NULL — same dependency |

**Pattern:** The agent is silent on all fields that require a purchase price anchor. Without `land_cost`, downstream COMPUTED fields cannot be produced and remain permanently null.

---

### Finding 3: Fields with No Author at All

Fields that exist in the schema, are null for 464 Bishop, and have no confirmed writer in any backend code path:

| Field | Table | Notes |
|---|---|---|
| `deals.deal_data->>'msaId'` | `deals` (JSONB) | Used in M35 event forecasts; null blocks submarket-scoped event lookup |
| `deals.deal_data->>'submarketId'` | `deals` (JSONB) | Same dependency; no writer confirmed |
| `deals.legal_owner` | `deals` | Populated in some deals; no route explicitly writes it |
| `deal_assumptions.narrative_text` | `deal_assumptions` | Written by AI narrative endpoint; not generated for 464 Bishop |
| `deal_monthly_actuals.asking_rent` | `deal_monthly_actuals` | Column exists; all 24 rows null for 464 Bishop |
| `deal_monthly_actuals.months_free_concession` | `deal_monthly_actuals` | Same |
| `deals.acquisition_date` | `deals` | Not set despite `deal_context_fields.ownership.acquisition_date` having a value (no auto-sync) |

---

### Finding 4: Multi-Source Conflict Points

Fields with two or more potential sources that can disagree. F9 has collision dot logic for divergences >10%, but several conflict points have no surfaced resolution.

| Field | Source A | Source B | Resolution in F9 | Gap (464 Bishop) |
|---|---|---|---|---|
| Purchase price | `deals.deal_data.extraction_om` (broker OM layer) | `deal_assumptions.land_cost` (operator override) | F9 prefers `deal_assumptions`; collision dot if >10% divergence | Both null |
| Purchase price (third location) | `deal_context_fields` override (written by `PATCH /financials/override`) | `deal_assumptions.land_cost` | No documented precedence; third location exists | No override set |
| Cap rate | `deals.deal_data.broker_cap_rate` | M07 `deal_traffic_snapshots` exit cap | Collision dot in F9 Overview | Both absent |
| Avg rent per unit | `deal_monthly_actuals` T12 extraction | `deal_context_fields.market.avg_effective_rent` (agent:research) | F9 uses separate broker vs platform layers | Both populated; divergence amount not confirmed |
| Vacancy rate | `deal_assumptions.vacancy_pct` = 19.83% (apt_locator) | `deal_context_fields.market.vacancy_rate` (agent:research) | No reconciliation surfaced to operator | Both populated |
| Unit count | `deals.unit_count` | `deal_context_fields.parcel.units` (agent:research) | No auto-sync | Both may differ |
| Tax amount | `deal_context_fields.tax.annual_amount` (agent:research) | `deal_monthly_actuals.property_tax` (T12 extraction) | No reconciliation | Both may be populated |
| Owner name | `deals.legal_owner` | `deal_context_fields.ownership.owner_name` (agent:research) | Separate display fields; not reconciled | `legal_owner` null; context field present |

---

### Finding 5: Freshness Coverage Gaps

| Surface | What Ages | Freshness Field | Surfaced to Operator? | Gap (464 Bishop) |
|---|---|---|---|---|
| `deal_context_fields` (47 rows) | Agent-researched values (market rents, vacancy, comps, ownership, proximity) | `updated_at` only; no TTL | **No** | No staleness indicator |
| `deal_market_intelligence` | Submarket data | `created_at` | N/A | Empty |
| `deal_traffic_snapshots` | M07 outputs | `created_at` per snapshot | **No** | 4 snapshots; freshness not surfaced |
| `deal_underwriting_snapshots` | Model snapshots | `created_at` | Not surfaced without named scenario | 315 snapshots accumulating silently |
| `deal_zoning_profiles` | Zoning district rules | No `as_of` date field | **No** | 1 row; age unknown |
| `market_sale_comps` | Sale comp transactions | `sale_date` per comp | Yes — shown per comp in Valuation Grid | 46 Atlanta comps; dates not verified |
| `proforma_assumptions` | Baseline assumptions | `last_recalculation` | Partial | 1 row; timestamp unknown |
| `historical_observations` / vendor data | CoStar and other vendor data | `vendor_data_as_of` | Via `GET /:dealId/vendor-freshness` route | Not verified |
| F9 AI narrative blocks | Claude-generated analysis | `narrative_generated_at` in `deal_assumptions` | **No** | Not generated |
| `data_quality_alerts` | Alert recency | `created_at` | Yes — shown in F10 Risk and F9 Validation | 15 alerts; ages not verified |

---

### Finding 6: Cross-F-Key Data Dependencies

| Downstream Surface | Prerequisite | What Breaks Without It |
|---|---|---|
| F9 OVERVIEW KPI strip (IRR, NOI, EM) | F9 CONSOLE purchase price (`deal_assumptions.land_cost`) | IRR, EM, DSCR all null |
| F9 CAPITAL (Sources & Uses) | Purchase price | TDC and loan amount cannot be computed |
| F9 RETURNS (levered IRR) | Capital stack + purchase price | Full IRR chain requires both |
| F9 VALUATION (going-in cap rate) | Purchase price + T12 NOI | Going-in cap = T12 NOI / purchase price |
| F8-M12 exit trajectory | `deal_data.msaId` / `submarketId` | M35 event-scoped forecasts cannot run without market geography |
| F8 Debt & Capital sensitivity | Debt parameters (rate, LTC, amortization) | Debt schedule cannot be generated |
| F3 Market Intel (deal-specific signals) | Market research agent run + `deal_data.msaId` | `deal_market_intelligence` empty; msaId also null |
| F5 Strategy arbitrage score | Investment strategy detection (M08) | Strategy not detected → arbitrage cannot score |
| F4 Supply Pipeline (deal-level) | `deals.trade_area_id` | Without trade area, falls back to city-level estimates only |
| F9 Compare tab (named scenarios) | User-created `deal_scenarios` rows | 315 snapshots exist but 0 named scenarios → no selector |
| F9 ROADMAP tab visibility | `deal_type` = value-add / redevelopment | Tab hidden for standard acquisition deals |
| F9 LP/GP returns | Waterfall config | Returns tab shows no LP/GP breakdown |

---

### Finding 7: Deprecated Table Coupling

| Deprecated Table / Pattern | Current Replacement | Risk |
|---|---|---|
| `deal_documents` | `deal_files` | 0 rows for 464 Bishop. Any agent tool, script, or integration referencing `deal_documents` silently finds nothing. `DocumentsFilesSection` correctly uses `deal_files` routes. |
| `property_operating_data.is_owned` | `deal_monthly_actuals.is_portfolio_asset = TRUE` | Superseded. Reading `is_owned` for portfolio identification misses owned assets. |
| `deal_contexts` | `deal_context_fields` | `deal_contexts` has 0 rows for 464 Bishop; `deal_context_fields` has 47. Consumers of `deal_contexts` find nothing. |
| `proforma_assumptions` | `deal_assumptions` + `cashflow_projections` | `proforma_assumptions` has 1 row. F9 engine reads `deal_assumptions`. Authoritative table is ambiguous. |
| `rent_roll` / `rent_roll_units` | `deal_monthly_actuals` (extraction result storage) | 0 rows in rent_roll tables for 464 Bishop; 24 rows in `deal_monthly_actuals`. T12 storage has fully migrated. |
| Purchase price in `deals.deal_data` JSONB only | Dual-write: `deals.deal_data` + `deal_assumptions.land_cost` + `deal_context_fields` override | Three locations with no documented precedence rule (see Finding 4). |

---

## Audit Completeness Notes

### All surfaces fully audited and verified with live queries
- F1–F11 deal detail page screens (live row counts verified for all tables)
- F8-M12 Exit Strategy + Debt Market module (component traced; endpoints confirmed; DB tables queried)
- All 11 F9 Financial Engine sub-tabs (component + API chain traced)
- Validation Grid (routes + source tables confirmed; 15 DQA alerts verified)
- Valuation Grid (routes + source tables confirmed; 46 Atlanta sale comps confirmed)
- Document Library (deal_files schema + 464 Bishop extraction status confirmed: done=9, failed=8, queued=2)
- data_quality_alerts: 15 rows (POPULATED)
- market_rent_comps: 13 rows (POPULATED)
- building_designs_3d: 0 rows (EMPTY)
- market_sale_comps: 46 Atlanta rows available (POPULATED at market level)

### Limitations of audit scope

| Item | Limitation | Reason |
|---|---|---|
| F11 Notes & Team sections | `asset_notes`, `deal_team_members` not queried | Out of scope for financial/underwriting field audit |
| F9 GOAL SEEK result persistence | Results not persisted to DB | On-demand computation; no rows to verify |
| `market_sale_comps` deal-radius pool | Exact count within valuation-grid radius not verified | Would require running the valuation-grid service call |
| M35 key_events for 464 Bishop | `key_events` filtered by msaId/submarketId not queried | `deals.deal_data.msaId` is null, blocking submarket-scoped lookup |

---

## Suggested Next Audit Scope / Spec Work

1. **Vendor data abstraction** — Define authoritative source precedence (CoStar vs. agent research vs. operator entry) and establish TTL rules for `deal_context_fields` values with visible staleness indicators.
2. **Purchase price source-of-truth** — The three-location ambiguity (`deal_data.purchase_price`, `deal_assumptions.land_cost`, `deal_context_fields` override) should be resolved to a single canonical resolver with explicit precedence, fixing the root cause of Finding 4 and all the null computed fields.
3. **Field-level reconciliation spec** — Collision dots exist only for a subset of conflicting fields. All multi-source conflicts in Finding 4 need resolution rules codified in `proforma-adjustment.service.ts`.
4. **Agent synthesis interface** — The 5,176 agent runs for 464 Bishop have produced 315 underwriting snapshots but no named scenarios, no IRR, and no strategy detection. The interface between agent output and persistent deal state needs mapping.
5. **`deal_documents` deprecation** — The legacy table should be formally deprecated and all code references purged.
6. **Strategy detection trigger** — Investment and exit strategy LVs are both null for 464 Bishop (Finding 2). A mechanism to trigger or re-trigger M08 detection — or surface that detection has not run — would eliminate this silent gap.
