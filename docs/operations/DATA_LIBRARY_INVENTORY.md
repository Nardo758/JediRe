# Data Library & CashFlow Agent Inventory
**Task #1047 — Read-only investigation**
**Date:** 2026-05-25

---

## 1. Executive Summary

This document maps every ingestion path, parser, storage table, and downstream consumer
involved in the JEDI RE Data Library and CashFlow Agent. Originally a read-only audit
(Task #1047); updated with corrections and fixes from Task #1048.

**Key findings:**
- `data_library_files` tracks raw file uploads (22 columns, 6 distinct insert paths)
- `data_library_assets` is the deal-capsule table holding extracted summary stats + `extraction_data` JSONB
- 13 parsers exist covering T12, Rent Roll, OM, Tax Bill, CoStar, BoxScore, leasing stats, and ancillary documents
- `historical_observations` has 82 columns, **403 rows live** (as of 2026-05-25), 298 distinct parcels, 2 distinct `deal_id` populated — corpus is archive/comp data, parcel_ids are competitor properties not linked to active deals
- The CashFlow Agent is **fully implemented** (Phase 4/5 AgentRuntime, 35+ tools, Inngest trigger), not a stub
- OpEx line items live in `deal_monthly_actuals` (71 columns), **not** `historical_observations`
- `CorpusQueryService` is the sole read path into `historical_observations`; M35, M07, M36, M37, M38 all consume it
- Traffic Engine reads `deal_lease_transactions` (per-unit rent roll data) via CorpusQueryService, not historical_observations directly

**Task #1048 corrections (2026-05-25):**
- `data_library_files.asset_id`: only **1 file** has NULL (not 266 as originally estimated) — the bulk-upload backfill at processUploadJob lines 466-475 was already working
- `data_library_assets.deal_id`: **0 rows** set — all 299 assets are archive/comp properties with no active-deal linkage
- `historical_observations.deal_id`: **401 NULLs** are expected — these are archive/comp parcels not resolvable to active deals via `deal_properties`
- `deals.deal_data->'source_documents'` JSONB: populated for **5/29 deals** — `fetch_source_documents` now falls back to `deal_files` for the other 24

---

## 2. data_library_files Table

**Purpose:** One row per uploaded raw file. Tracks storage location, parser status, document classification, and provenance.

**Schema (22 columns):**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `parcel_id` | text | nullable; links to properties |
| `deal_id` | uuid | nullable |
| `original_filename` | text | |
| `sha256` | text | dedup key — `ON CONFLICT (sha256)` pattern used |
| `mime_type` | text | |
| `size_bytes` | bigint | |
| `storage_provider` | text | |
| `storage_bucket` | text | |
| `storage_key` | text | |
| `cdn_url` | text | |
| `document_type` | text | T12, RENT_ROLL, OM, TAX_BILL, etc. |
| `parser_used` | text | which parser processed the file |
| `parser_version` | text | |
| `parser_status` | text | `unparsed` → `parsing` → `completed` / `failed` |
| `parser_run_id` | uuid | |
| `parser_error` | text | |
| `uploaded_at` | timestamptz | |
| `uploaded_by` | text | userId |
| `source_signal` | text | |
| `license_restricted` | boolean | |
| `license_source` | text | |
| `asset_id` | uuid | FK → data_library_assets — 1 file has NULL as of 2026-05-25 (1694 linked) |

**Asset-id linkage (updated 2026-05-25):** Originally reported as 266 NULLs; actual live count is 1 NULL. The `processUploadJob` backfill (bulk-upload.routes.ts:466-475) correctly sets `asset_id` for new uploads. The 1 remaining NULL has no resolvable join key (neither `file_id` reverse pointer nor `deal_id` on the asset row). Note: `data_library_assets.file_id` is an **integer** (legacy column), not a UUID FK to `data_library_files`.

### 2.1 Insert Paths (6 distinct callers)

| # | File | Route / Function | Trigger |
|---|------|-----------------|---------|
| 1 | `api/rest/archive.routes.ts:1455` | `POST /api/v1/archive/ingest` (individual deal ingestion) | Analyst uploads single deal |
| 2 | `api/rest/bulk-upload.routes.ts:176` | `POST /api/v1/bulk-upload` — persists metadata before parse | Multi-file upload; `asset_id` from body or null |
| 3 | `api/rest/bulk-upload.routes.ts:258` | `POST /api/v1/bulk-upload/zip` — ZIP file metadata | ZIP archive upload |
| 4 | `services/document-extraction/data-router.ts:1191` | Inside per-document parse pipeline | After parse, records final parser outcome |
| 5 | `intake-sources/data-library-upload/index.ts:69` | Standalone intake source | External / programmatic ingest path |
| 6 | `services/dataLibrary.service.ts:116` | Service-layer helper | Called by various routes for ad-hoc file registration |

---

## 3. data_library_assets Table

**Purpose:** One row per deal/asset. Stores enriched property profile, summary financial metrics extracted from documents, and the full `extraction_data` JSONB capsule.

**Key columns (~75 total):**

| Group | Columns |
|-------|---------|
| Identity | `id`, `deal_id`, `source_deal_id`, `source_type`, `created_by` |
| Location | `property_name`, `address`, `city`, `state`, `zip_code`, `county`, `msa_id`, `msa_name`, `submarket_id`, `submarket_name`, `latitude`, `longitude` |
| Physical | `property_type`, `property_subtype`, `year_built`, `year_renovated`, `vintage_tier`, `unit_count`, `net_rentable_sqft`, `avg_unit_sqft`, `lot_size_acres`, `stories`, `height_class`, `density_units_per_acre`, `construction_type`, `parking_type`, `parking_ratio` |
| Unit mix | `unit_mix` (jsonb), `avg_bedrooms` |
| Quality | `asset_class`, `finish_level`, `amenities` (jsonb), `amenity_score` |
| Ownership | `management_company`, `owner_operator`, `ownership_type` |
| Financials | `avg_rent`, `avg_rent_psf`, `rent_by_unit_type`, `rent_as_of_date`, `occupancy_rate`, `occupancy_as_of_date`, `noi`, `noi_per_unit`, `expense_ratio`, `noi_as_of_date`, `asking_price`, `asking_price_per_unit`, `gross_potential_rent`, `vacancy_rate`, `operating_expense_ratio`, `management_fee_pct`, `property_tax_per_unit`, `insurance_per_unit`, `repairs_maintenance_per_unit` |
| Transaction | `sale_price`, `sale_date`, `price_per_unit`, `price_per_sqft`, `cap_rate`, `buyer`, `seller` |
| Data quality | `data_quality_score`, `last_verified_date`, `notes`, `tags` |
| **Capsule** | **`extraction_data` (jsonb)** — full structured extraction from parsers |
| Meta | `data_type`, `file_id`, `created_at`, `updated_at` |

**`extraction_data` JSONB structure** (as written by parsers and the archive ingestion pipeline):
```
{
  "T12": { "summary": { totalUnits, occupancyRate, noi, gpr, ... }, "months": [...] },
  "RENT_ROLL": { "summary": { ... }, "units": [...], "capsuleExtras": { ... } },
  "OM": { ... },
  "TAX_BILL": { ... }
}
```

**Readers of `extraction_data`:**
- `costar-parser.ts:521` — reads existing capsule before merging CoStar data
- `agents/tools/fetch_data_matrix.ts:152` — `SELECT * FROM data_library_assets WHERE id = $1`
- `agents/tools/fetch_data_library_comps.ts:123` — `FROM data_library_assets a` comp-set lookup
- Archive benchmark aggregator (prior dispatch): reads `extraction_data->'T12'->'summary'`

---

## 4. Parser Inventory (13 parsers)

All parsers live in `backend/src/services/document-extraction/parsers/`.

| Parser | Document Type | Output Table / Target |
|--------|--------------|----------------------|
| `t12-parser.ts` | T12 (trailing-12-month P&L) | `deal_monthly_actuals` (per-month row); `extraction_data` in capsule; `historical_observations` via `writeT12ToCorpus` |
| `rent-roll-parser.ts` | Rent Roll (Yardi RRwLC + generic flat) | `deal_lease_transactions` (per-unit row); `extraction_data`; `historical_observations` via `writeRentRollToCorpus` |
| `om-parser.ts` | Offering Memorandum | `data_library_assets` property fields; `extraction_data`; `historical_observations` via `writeOMToCorpus` |
| `tax-bill-parser.ts` | Tax Bill | `extraction_data`; `historical_observations` capital_event_* columns via `writeTaxBillToCorpus` |
| `costar-parser.ts` | CoStar export | `extraction_data` (merged overlay); `historical_observations` costar_submarket_* columns |
| `leasing-stats-parser.ts` | BoxScore / Leasing Statistics | `deal_monthly_actuals`; `historical_observations` via `leasingStatsToCorpusRow` |
| `box-score-parser.ts` | Yardi BoxScore format | `deal_monthly_actuals` |
| `aged-receivables-parser.ts` | Aged Receivables | `extraction_data` |
| `bpi-financial-parser.ts` | BPI Financial | `extraction_data` |
| `bpi-variance-parser.ts` | BPI Variance | `extraction_data` |
| `concession-burnoff-parser.ts` | Concession Burnoff | `extraction_data` |
| `lto-parser.ts` | Loss-to-Lease / LTO | `extraction_data` |
| `other-income-parser.ts` | Other Income | `extraction_data` |

**Rent roll parser detail:**
The Yardi RRwLC layout parser extracts per-unit: `unitNumber`, `unitType`, `sqft`, `resident`, `marketRent`, `securityDeposit`, `otherDeposit`, `moveInDate`, `leaseExpiration`, `moveOutDate`, `balance`, per-unit `charges` (charge-code keyed), `totalCharges`, `isVacant`, `isFuture`, `isNonRevenue`. Summary output includes `gpr_monthly`, `in_place_rent_monthly`, `loss_to_lease_monthly`, `charge_codes` aggregate, `floor_plan_mix`, `bedroom_mix`, `expiration_curve`, and `other_income_monthly`.

---

## 5. historical_observations Schema & Live State

**Purpose:** Empirical calibration substrate — longitudinal property performance observations for corpus-driven analytics. Feeds M35, M07, M36, M37, M38.

**Live state (as of 2026-05-25):**
- **Total rows:** 402
- **Distinct parcels:** 298
- **Distinct deal_ids populated:** 1 (most rows have `deal_id = NULL` — pre-backfill state)
- **Date range:** 2020-03-20 → 2026-05-23
- **Rows per parcel:** min 1, max 3, avg 1.3

**Schema (82 columns — actual DB columns):**

| Group | DB Column Names |
|-------|----------------|
| PK | `id` (uuid) |
| Geography | `msa_id`, `submarket_id`, `parcel_id`, `latitude`, `longitude`, `geography_level` |
| Time | `observation_date`, `observation_window` |
| Mobility | `commute_shed_workers`, `commute_shed_wage_pct`, `mobility_visits_monthly`, `mobility_unique_visitors`, `mobility_visits_psf` |
| Events | `active_event_count`, `event_employer_jobs_added`, `event_employer_jobs_lost`, `event_supply_units_delivered`, `event_supply_units_announced`, `event_subtypes` |
| MSA Macro | `msa_employment_total`, `msa_employment_growth_yoy`, `msa_avg_wage`, `msa_wage_growth_yoy`, `msa_unemployment_rate`, `msa_population`, `msa_household_growth_yoy`, `msa_in_migration_net`, `msa_treasury_10y`, `msa_fed_funds_rate` |
| Submarket | `submarket_avg_asking_rent`, `submarket_avg_effective_rent`, `submarket_vacancy_rate`, `submarket_concession_pct`, `submarket_under_construction`, `submarket_pipeline_units_24mo`, `submarket_class_a_share` |
| Property State | `property_occupancy`, `property_avg_rent`, `property_concession_per_unit`, `property_unit_count`, `property_year_built`, `property_class`, `property_asking_rent`, `property_signing_velocity` |
| Realized Outputs | `realized_rent_change_t3`, `realized_rent_change_t12`, `realized_rent_change_t24`, `realized_occupancy_change_t3`, `realized_occupancy_change_t12`, `realized_concession_change_t12`, `realized_signing_velocity_t3`, `realized_signing_velocity_t12`, `realized_cap_rate_change_t12_bps`, `realized_cap_rate_change_t24_bps`, `realized_walkins_psf_t12` |
| Capital Events | `capital_event_type`, `capital_event_amount`, `capital_event_metadata` |
| CoStar Overlay (Phase 4) | `costar_submarket_rent`, `costar_submarket_vacancy`, `costar_submarket_absorption`, `costar_submarket_concession_pct`, `costar_submarket_new_supply` |
| Market Survey (Phase 4) | `market_survey_source`, `market_survey_snapshot` |
| Rezone | `rezone_upzoning_event_count`, `rezone_approval_event_count`, `rezone_moratorium_active`, `rezone_outcome`, `rezone_window_months` |
| Metadata | `source_signals` (array), `source_file_ids` (array), `signal_freshness_days` (jsonb), `is_subject_property`, `realization_complete`, `realization_complete_date`, `data_quality_flags`, `data_quality_tier`, `redistribution_restricted`, `deal_id`, `created_at`, `updated_at` |

**Critical note — what is NOT in historical_observations:**
OpEx line items (insurance, payroll, R&M, management fee, etc.) are stored in `deal_monthly_actuals`, not here. `historical_observations` only captures property-level metrics (occupancy, avg rent, signing velocity, concession) at the monthly grain.

**Data quality tiers:**
- `S1` — T12 + Rent Roll both present for same observation month
- `S2` — T12 only, or Rent Roll only
- `S3` — OM or Tax Bill only
- `S4` — other/unknown

### 5.1 Corpus Write Paths (document-to-corpus.ts)

All writes go through `upsertCorpusRow()` in `document-to-corpus.ts`, which merges signals when a row already exists at `(parcel_id × observation_date)`.

| Trigger | Function | Corpus Fields Written |
|---------|----------|-----------------------|
| T12 parse | `writeT12ToCorpus(pool, dealId, parsedT12, reportPeriod)` | `property_occupancy`, `property_avg_rent`, `property_unit_count`; signal: `t12` |
| Rent Roll parse | `writeRentRollToCorpus(pool, dealId, parsedRentRoll, reportPeriod)` | `property_occupancy`, `property_avg_rent`, `property_concession_per_unit`, `property_signing_velocity`, `property_unit_count`; signal: `rent_roll` |
| OM parse | `writeOMToCorpus(pool, dealId, omExtraction, reportPeriod)` | `property_unit_count`, `property_year_built`, `property_class`; signal: `om` |
| Tax Bill parse | `writeTaxBillToCorpus(pool, dealId, taxBillData, reportPeriod)` | `capital_event_type`, `capital_event_amount`, `capital_event_metadata`; signal: `tax_bill` |

**Orchestrator (deprecated):** `ingestPropertyPerformance()` in `property-performance-ingestor.ts` is the old path. Still works but callers now use `document-to-corpus.ts` directly.

**Idempotency:** `ON CONFLICT` check at `(parcel_id × observation_date × geography_level='parcel')`. Existing row gets a signal-merged `UPDATE`; new rows get `INSERT`.

**is_subject_property logic:**
- TRUE only when deal status IN (`owned`, `closed`, `portfolio`)
- Phase 4 comp parcels will explicitly pass FALSE

### 5.2 Corpus Consumers

All consumers query through `CorpusQueryService` (`services/historical-observations/query.service.ts`):

| Module | Use |
|--------|-----|
| M35 (Event Path / LIUS Bridge) | `lius/m35-bridge.ts` — event timelines and realized output correlations |
| M07 (Traffic Engine) | Reads submarket vacancy/rent via CorpusQueryService for calibration |
| M36 (Aggressiveness — PENDING) | Listed in service comment as consumer; not yet active |
| M37 (unknown / scheduled) | Listed in service comment |
| M38 (Calibration) | Listed in service comment |
| `historical-observations.routes.ts` | REST API — GET /api/v1/historical-observations |
| `archive.routes.ts` | Bulk-write path + year_built reads |
| `archive-properties.routes.ts` | Property profile reads |
| `realized-outputs.service.ts` | Backfills realized_* columns after new observations land |
| `rezone-trend.service.ts` | Reads rezone_* columns |
| `portfolio/lifecycle-transition.service.ts` | Transition signal reads |

**CorpusQueryService.query() filter dimensions:**
- Geography: `msa_id`, `submarket_id`, `parcel_id`, or lat/lng radius
- Time range: `observation_date >= start AND <= end`
- Observation window: `monthly | quarterly | annual`
- `requireFields`: only return rows where specified columns are non-null
- `requireRealization`: only rows old enough that T+N window has closed
- `isSubjectOnly`: only `is_subject_property = TRUE` + deal in owned/closed/portfolio
- `isUnlabeledOnly`: only `is_subject_property = FALSE`

---

## 6. CashFlow Agent

**State: FULLY IMPLEMENTED (Phase 4/5 AgentRuntime adapter)**

### 6.1 File Map

| File | Role |
|------|------|
| `agents/cashflow.agent.ts` | Public API class — routes to runtime or `generateRoadmap()` |
| `agents/cashflow.config.ts` | AgentRuntime config — registers 35+ tools; defines output schema |
| `agents/cashflow.postprocess.ts` | Post-processing after runtime completes |
| `agents/cashflow.inngest.ts` | Inngest durable functions — event-driven trigger |
| `api/rest/cashflow-underwriting.routes.ts` | REST API — POST /api/v1/cashflow-underwriting |
| `agents/seeds/cashflow.seed.ts` | Prompt seeding at startup |

### 6.2 Execution Modes

| Mode | Description |
|------|-------------|
| `underwrite` (default) | Full evidence-backed cashflow analysis via `cashflowRuntime.run()` |
| `roadmap` | Value-creation roadmap via `generateRoadmap()` — reads `deal_underwriting_snapshots` written by underwrite mode |

### 6.3 Trigger Paths

| Path | Mechanism |
|------|-----------|
| Manual (any tier) | `POST /api/v1/cashflow-underwriting` → `cashflowRuntime.startAsync()` |
| Event-driven (operator+) | `cashflowOnResearchCompleted` Inngest function triggers on `research.completed` |
| Weekly refresh (principal+) | Inngest scheduled trigger |
| Portfolio batch (institutional) | Inngest batch trigger |
| Inline (from deal creation) | `inline-deals.routes.ts:1422` — `cashflowRuntime.run()` |
| Coordinator | `services/ai/coordinator.ts` — `CashFlowAgent.execute()` |
| Dispatcher | `coordinator/dispatch.ts` — runtime keyed as `cashflow_analysis` |

### 6.4 Runtime Tool Inventory (35+ tools, Phase 5 Evidence System)

**Tier 1 — Subject deal actuals:**

| Tool | Table(s) Read |
|------|--------------|
| `fetch_t12` | `deal_monthly_actuals` (aggregates 12mo NOI/OpEx); fallback: `data_library_assets.extraction_data->'T12'` |
| `fetch_rent_roll` | `deal_lease_transactions` (per-unit); fallback: `data_library_assets.extraction_data->'RENT_ROLL'` |
| `fetch_assumptions` | `deal_assumptions`, `deals` |

**Tier 2 — Owned portfolio actuals:**

| Tool | Table(s) Read |
|------|--------------|
| `fetch_owned_asset_actuals` | `deal_monthly_actuals` (TTM per-unit metrics for comparable owned assets) |
| `fetch_owned_asset_opex_ratios` | `deal_monthly_actuals` (TTM OpEx ratio averages by asset class / vintage) |

**Tier 3 — Market / external intelligence:**

| Tool | Table(s) Read |
|------|--------------|
| `fetch_peer_comp_noi_metrics` | `data_library_assets`, `archive_assumption_benchmarks` |
| `fetch_jurisdiction_tax_forecast` | Tax rules + county data |
| `fetch_jurisdiction_insurance_forecast` | Insurance benchmark data |
| `fetch_m35_event_forecast` | M35 event pipeline |
| `fetch_rate_environment` (M11) | Fed/FRED macro data |
| `fetch_cycle_intelligence` (M14/M28) | Cycle position signals |
| `fetch_source_documents` | `data_library_files` (Gap 1 — evidence provenance) |
| `fetch_archive_assumption_distribution` | `archive_assumption_benchmarks` |
| `fetch_archive_achievement_vs_assumption` | `archive_assumption_benchmarks` |
| `fetch_line_item_benchmarks` | `line_item_benchmarks` |
| `fetch_market_trends` | CorrelationEngine / market trends |
| `fetch_learning_adjustments` | Historical adjustments |
| `fetch_debt_assumptions` | Debt terms |
| `fetch_comp_set` | `data_library_assets` comp set |
| `fetch_disposition_learnings` | Closed deal data |
| `fetch_data_matrix` | `data_library_assets`, proximity, events, benchmarks (multi-layer) |
| `fetch_proximity_context` | Proximity scores (transit, grocery, etc.) |
| `fetch_market_events` | M35 event pipeline |
| `fetch_backtest_context` | Historical validation |
| `fetch_data_library_comps` | `data_library_assets` |
| `fetch_tax_intel` | Tax intelligence |
| `fetch_anchor_growth_rates` | Growth rate anchors |
| `fetch_county_tax_rules` | County tax rules |
| `fetch_operator_stance` | `deals.operator_stance` JSONB |
| `fetch_unit_mix` | `deal_lease_transactions` unit mix |

**Analysis:**

| Tool | Purpose |
|------|---------|
| `detect_collision` | Flags material discrepancies between agent estimates and broker OM values |
| `evaluate_plausibility` | Sigma-engine plausibility scoring |
| `get_plausibility_score` | Reads cached plausibility |

**Compute / Optimization:**

| Tool | Purpose |
|------|---------|
| `compute_proforma` | Builds full 9-tab proforma from assembled evidence |
| `goal_seek_target_irr` | Goal-seek for target IRR |
| `run_joint_goal_seek` | Multi-variable goal seek |
| `optimize_capital_structure` | Capital structure optimization |
| `run_refi_test` | Refi scenario testing |
| `query_capital_stack_bundles` | Capital stack bundles |

**Write:**

| Tool | Table(s) Written |
|------|-----------------|
| `write_projection` | `deal_projections` or `deal_underwriting_snapshots` |
| `write_underwriting` | `deal_underwriting_snapshots` |
| `write_evidence_rows` | Evidence audit table |
| `request_walkthrough_narrative` | Triggers `cashflow.walkthrough_requested` Inngest event → `deal_walkthrough_narratives` |
| `generate_roadmap` | Calls `generateRoadmap()` → `deal_underwriting_snapshots` |

### 6.5 Budget Caps (Phase 5)

- `maxTokensPerRun`: 800,000
- `maxCostUsdPerRun`: $8.00
- `maxStepsPerRun`: 35

---

## 7. Benchmark Tables

### archive_assumption_benchmarks

**Purpose:** Distribution of assumptions (P10/P25/P50/P75/P90) used in closed deals vs. what was actually achieved. Powers `fetch_archive_assumption_distribution` and `fetch_archive_achievement_vs_assumption` tools.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `asset_class`, `deal_type`, `submarket_id`, `vintage_band`, `strategy` | text | Filter dimensions |
| `assumption_name` | text | e.g., `vacancy_pct`, `concessions_pct` |
| `p10`…`p90` | numeric | Distribution |
| `assumed_median`, `achieved_median` | numeric | Underwriting vs. actuals gap |
| `gap_bps` | numeric | |
| `n_samples`, `n_closed_deals` | integer | |
| `as_of` | date | |

### line_item_benchmarks

**Purpose:** Per-unit OpEx benchmarks by geography, asset class, vintage, and unit count. Powers `fetch_line_item_benchmarks` tool used by CashFlow Agent for every OpEx line item.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `state`, `msa`, `submarket` | text | Geography hierarchy |
| `asset_class`, `deal_type`, `vintage_band`, `unit_count_band`, `stories_band` | text | Property filters |
| `category`, `line_item` | text | e.g., category=`opex`, line_item=`payroll` |
| `line_item_aliases` | text[] | Alternate names matched against extracted data |
| `per_unit_p10`…`per_unit_p90`, `per_unit_mean`, `per_unit_stddev` | numeric | $/unit/yr distributions |
| `pct_egi_p10`…`pct_egi_p90` | numeric | % of EGI distributions |
| `yoy_growth_p10`, `yoy_growth_p50`, `yoy_growth_p90` | numeric | Growth rate distributions |
| `n_samples`, `n_deals` | integer | |
| `sample_years` | text[] | |
| `as_of` | date | |

**Coverage by prompt:** The `line-item-matrix.ts` prompt spec calls `fetch_line_item_benchmarks` for: `bad_debt`, `other_income`, `management_fee`, `insurance`, `utilities`, `repairs_maintenance`, `payroll`, `marketing`, `concessions_pct`, `vacancy_pct` (via archive distribution).

---

## 8. deal_monthly_actuals Table (OpEx storage)

**Purpose:** Per-month operating actuals for all T12-linked properties. This is where T12 parser output lands. 71 columns — the full P&L for each month.

**Key OpEx columns:** `payroll`, `repairs_maintenance`, `turnover_costs`, `marketing`, `admin_general`, `management_fee`, `management_fee_pct`, `utilities`, `contract_services`, `property_tax`, `insurance`, `hoa_condo_fees`, `total_opex`, `opex_per_unit`, `opex_ratio`, `noi`, `noi_per_unit`

**Leasing columns:** `new_leases`, `renewals`, `move_outs`, `lease_trade_out`, `renewal_rate`, `avg_days_to_lease`

**Revenue columns:** `gross_potential_rent`, `loss_to_lease`, `vacancy_loss`, `concessions`, `bad_debt`, `net_rental_income`, `other_income`, `utility_reimbursement`, `late_fees`, `misc_income`, `effective_gross_income`

**Key readers:**
- `fetch_t12` agent tool — aggregates TTM NOI/EGI/OpEx for subject deal
- `fetch_owned_asset_actuals` — peer portfolio comps
- `fetch_owned_asset_opex_ratios` — TTM ratio averages for comparable assets
- `cashflow.inngest.ts:104` — T12 availability gate-check

---

## 9. property_descriptions Table

**Purpose:** Rich property profile (43 columns) — physical attributes, amenities, regulatory constraints, owner reviews, photos, sentiment. Keyed by `parcel_id`.

**Key columns:** `property_name`, `address`, `msa`, `county`, `year_built`, `year_renovated`, `unit_count`, `stories`, `total_sqft`, `rentable_sqft`, `lot_size_acres`, `construction_type`, `parking_type`, `asset_class`, `property_type`, `amenities`, `zoning_code`, `flood_zone`, `in_opportunity_zone`, `narrative`, `submarket`, `has_pool`, `has_fitness`, `has_clubhouse`, `has_concierge`, `has_business_center`, `has_dog_park`, `is_master_metered`, `is_individual_metered`, `assessed_value`, `appraised_value`, `owner`, `regulatory_constraints`, `photos`, `reviews`, `sentiment_summary`, `recent_events`, `asset_id`

All columns are `jsonb` (LayeredValue wrappers) except `parcel_id` (text) and timestamps.

**Readers:**
- `archive-properties.routes.ts` — `GET /api/v1/archive-properties/:parcelId`
- `archive.routes.ts` — bulk upsert during ingestion
- `dq-recalculator.service.ts` — data quality scoring
- `nlp-review-backfill.ts` — DeepSeek NLP pass over reviews

---

## 10. Traffic Engine (M07) Data Flow

**Primary service:** `services/traffic-analytics.service.ts` + `trafficPredictionEngine.ts` + `traffic-calibration.service.ts`

**Data sources consumed:**

| Source | Table | Content |
|--------|-------|---------|
| Rent Roll per-unit | `deal_lease_transactions` | Unit-level lease start/end, rent, sqft — signing velocity and absorption inputs |
| Corpus (submarket) | `historical_observations` via CorpusQueryService | Submarket vacancy, avg rent, concessions, construction pipeline |
| Proximity | `properties` + proximity enrichment | Transit score, crime index |

**Calibration loop:** `traffic-calibration.service.ts` runs nightly Inngest jobs comparing Traffic Engine predictions against realized `historical_observations` realized_* outputs, updating Bayesian coefficients.

---

## 11. Input-to-Consumer Data-Flow Table

The table below resolves every major document/signal input to exactly where it is stored, which system component reads it today, and what analytical purpose it serves. Rows marked **"no consumer"** are stored but not reachable by any active tool or analytics module.

| # | Input Type | Parser | Stored In | Current Consumer(s) | Used For | Status |
|---|-----------|--------|-----------|---------------------|----------|--------|
| 1 | **T12 P&L** (monthly actuals) | `t12-parser.ts` | `deal_monthly_actuals` (71 cols, per-month row); `data_library_assets.extraction_data['T12']`; `historical_observations` (occupancy, avg_rent, unit_count) | `fetch_t12` (CashFlow Agent); `fetch_owned_asset_actuals`; `cashflow.inngest.ts` T12 gate-check | NOI, EGI, OpEx line items for proforma underwriting | **Active — returns data** |
| 2 | **Rent Roll** (per-unit) | `rent-roll-parser.ts` (Yardi RRwLC + flat) | `deal_lease_transactions` (per-unit: unit#, type, sqft, rent, dates); `data_library_assets.extraction_data['RENT_ROLL']`; `historical_observations` (occupancy, avg_rent, concession, signing_velocity) | `fetch_rent_roll` (CashFlow Agent); `fetch_unit_mix`; M07 Traffic Engine via CorpusQueryService | In-place occupancy, rent by unit type, absorption/signing velocity, loss-to-lease | **Active — returns data** |
| 3 | **Offering Memorandum** (OM) | `om-parser.ts` | `data_library_assets` (property profile columns); `data_library_assets.extraction_data['OM']`; `historical_observations` (unit_count, year_built, property_class) | `fetch_data_library_comps`; `fetch_data_matrix`; `detect_collision` (for OM vs. agent estimate) | Sponsor asking price, stated NOI/occupancy for collision detection; comp set physical attributes | **Active — but G1: asset_id null blocks `fetch_source_documents`** |
| 4 | **Tax Bill** | `tax-bill-parser.ts` | `data_library_assets.extraction_data['TAX_BILL']`; `historical_observations` (capital_event_type, capital_event_amount) | `fetch_tax_intel`; `fetch_jurisdiction_tax_forecast` | Millage rate, assessed value, transfer tax for post-acquisition reassessment model | **Active — returns data** |
| 5 | **CoStar Export** | `costar-parser.ts` | `data_library_assets.extraction_data` (merged overlay); `historical_observations` costar_submarket_* columns | `fetch_peer_comp_noi_metrics`; M07 Traffic Engine via CorpusQueryService | Submarket avg rent, vacancy, concession, absorption, new supply for comp benchmarking | **Active — if ingested; Wesley Chapel has no CoStar data loaded** |
| 6 | **BoxScore / Leasing Stats** | `box-score-parser.ts`, `leasing-stats-parser.ts` | `deal_monthly_actuals`; `historical_observations` via `leasingStatsToCorpusRow` | `fetch_t12`; `fetch_owned_asset_actuals` | New leases, renewals, move-outs, renewal rate, avg days-to-lease | **Active — if ingested** |
| 7 | **Property reviews / sentiment** | None (NLP backfill via `nlp-review-backfill.ts`) | `property_descriptions.reviews` (jsonb LV), `property_descriptions.sentiment_summary` (jsonb LV) | `archive-properties.routes.ts` REST API only; `dq-recalculator.service.ts` DQ score | Resident satisfaction signals, review-based demand proxy | **No analytical consumer — not read by any CashFlow Agent tool or corpus query** |
| 8 | **Photos / amenities** | None (uploaded directly) | `property_descriptions.photos` (jsonb LV), `property_descriptions.amenities` (jsonb LV), amenity flags (`has_pool`, `has_fitness`, etc.) | `archive-properties.routes.ts` REST API only | Physical quality / amenity score for comp filtering | **No analytical consumer — `amenity_score` in `data_library_assets` exists but no agent tool reads `property_descriptions` amenities** |
| 9 | **Regulatory constraints** | None (manual entry / OM extraction) | `property_descriptions.regulatory_constraints` (jsonb LV) | `archive-properties.routes.ts` REST API only | Rent control, flood zone restrictions, opportunity zone status | **No analytical consumer — CashFlow Agent has no tool that reads `property_descriptions`** |
| 10 | **Line-item benchmarks / archive distributions** | `seed-opex-benchmarks.ts` (seeded 2025-12-31) | `line_item_benchmarks` (207 rows — national + top-10 MSAs, Class A/B/C, 14 line items); `archive_assumption_benchmarks` (209 rows — Class B/A/C, canonical assumption names) | `fetch_line_item_benchmarks`, `fetch_archive_assumption_distribution`, `fetch_archive_achievement_vs_assumption` — all three tools exist and call these tables | Per-unit OpEx P10/P50/P90 ranges; assumption vs. achievement gap for closed deals | **Seeded — G7 closed. National Class B benchmarks match at `national_class` bucket. Top-10 MSA Class B benchmarks match at `msa_class_vintage` bucket.** |

---

## 12. Inputs with No Analytical Consumer

The following stored inputs are **reachable only via the REST API**, not by the CashFlow Agent or any corpus analytics module:

### property_descriptions columns (no agent tool reads this table)
| Column(s) | Content | Where stored | Gap |
|-----------|---------|-------------|-----|
| `reviews`, `sentiment_summary` | Resident reviews (scraped/ingested) + NLP sentiment score | `property_descriptions` | No CashFlow Agent tool reads reviews. Sentiment data that could anchor demand-side risk is completely dark to the underwriting agent. |
| `photos` | Exterior/interior photos | `property_descriptions` | No tool. Physical quality signals not reachable. |
| `amenities`, `has_pool`, `has_fitness`, `has_concierge`, `has_dog_park`, `has_business_center`, `is_master_metered`, `is_individual_metered` | Amenity flags | `property_descriptions` | `amenity_score` is computed in `data_library_assets`, but the agent only gets this score if `fetch_data_matrix` triggers an asset lookup. The raw flags are not passed. |
| `regulatory_constraints` | Rent control ordinances, flood zone, opportunity zone | `property_descriptions` | Agent has no visibility into regulatory encumbrances. Zoning agent consumes this separately, but CashFlow Agent does not. |
| `flood_zone`, `in_opportunity_zone` | Risk / tax-advantage flags | `property_descriptions` | No tool. Opportunity Zone accelerated depreciation is never captured in proforma. |

### Benchmark / archive tables
| Table | Schema | Row Count | Gap |
|-------|--------|-----------|-----|
| `line_item_benchmarks` | Correct (30+ columns, P10–P90 distributions, per_unit/pct_egi/yoy) | **207 rows** (seeded 2025-12-31 via `seed-opex-benchmarks.ts`) | **G7 CLOSED.** Covers 14 line items × 3 classes (A/B/C) at national level + Class B at top-10 MSAs. `fetch_line_item_benchmarks` now returns non-empty results for Class A/B/C garden deals. |
| `archive_assumption_benchmarks` | Correct (assumed_median, achieved_median, gap_bps) | **209 rows** (190 pre-existing + 19 seeded) | **G7 CLOSED (partial).** Canonical `vacancy_pct`, `concessions_pct`, `bad_debt_pct`, `management_fee_pct`, `exit_cap_rate_pct`, `expense_ratio_pct`, `rent_growth_pct` added at broadest null-vintage/null-submarket bucket for Class A/B/C with n_samples ≥ 300. `fetch_archive_assumption_distribution` now returns results at broadest bucket. |

### External signal columns (MSA macro — all null)
| Column Group | Table | Status |
|-------------|-------|--------|
| `msa_employment_total`, `msa_employment_growth_yoy`, `msa_avg_wage`, `msa_wage_growth_yoy`, `msa_unemployment_rate`, `msa_population`, `msa_household_growth_yoy`, `msa_in_migration_net` | `historical_observations` | All NULL — LODES/QCEW ingestion is pending (G6) |
| `commute_shed_workers`, `commute_shed_wage_pct`, `mobility_visits_monthly`, `mobility_unique_visitors` | `historical_observations` | All NULL — Veraset mobility feed pending (G6) |
| `msa_treasury_10y`, `msa_fed_funds_rate` | `historical_observations` | All NULL — FRED ingestion pending (G6); `fetch_rate_environment` reads FRED directly at runtime instead |

---

## 13. Complete Data Flow Map (Narrative)

```
FILE UPLOAD
    │
    ├─→ data_library_files (5 insert paths)
    │     parser_status: unparsed → parsing → completed/failed
    │
    ↓
PARSER DISPATCH (data-router.ts)
    │
    ├─→ T12 Parser
    │     ├─→ deal_monthly_actuals (per-month P&L rows, 71 cols)
    │     ├─→ data_library_assets.extraction_data['T12'] (capsule JSONB)
    │     └─→ historical_observations via writeT12ToCorpus
    │           (property_occupancy, property_avg_rent, property_unit_count)
    │           signal: 't12', tier: S2 (or S1 if rent_roll already present)
    │
    ├─→ Rent Roll Parser (Yardi RRwLC or flat layout)
    │     ├─→ deal_lease_transactions (per-unit: unit#, type, sqft, rent, dates)
    │     ├─→ data_library_assets.extraction_data['RENT_ROLL'] (capsule)
    │     └─→ historical_observations via writeRentRollToCorpus
    │           (property_occupancy, property_avg_rent, property_concession_per_unit,
    │            property_signing_velocity, property_unit_count)
    │           signal: 'rent_roll', tier: S2 (or S1 if t12 already present)
    │
    ├─→ OM Parser
    │     ├─→ data_library_assets (property profile columns)
    │     ├─→ data_library_assets.extraction_data['OM']
    │     └─→ historical_observations via writeOMToCorpus
    │           (property_unit_count, property_year_built, property_class)
    │           signal: 'om', tier: S3
    │
    ├─→ Tax Bill Parser
    │     ├─→ data_library_assets.extraction_data['TAX_BILL']
    │     └─→ historical_observations via writeTaxBillToCorpus
    │           (capital_event_type, capital_event_amount, capital_event_metadata)
    │           signal: 'tax_bill', tier: S3
    │
    ├─→ CoStar Parser
    │     ├─→ data_library_assets.extraction_data (merged overlay)
    │     └─→ historical_observations costar_submarket_* columns
    │
    └─→ BoxScore / Leasing Stats / BPI / Other parsers
          └─→ deal_monthly_actuals or extraction_data

CASHFLOW AGENT (35+ tools, Phase 5 Evidence System)
    │
    ├─ TRIGGER: POST /api/v1/cashflow-underwriting  [manual, any tier]
    ├─ TRIGGER: research.completed Inngest event    [event-driven, operator+]
    ├─ TRIGGER: weekly Inngest schedule             [principal+]
    │
    ├─→ fetch_t12               ← deal_monthly_actuals
    ├─→ fetch_rent_roll         ← deal_lease_transactions
    ├─→ fetch_assumptions       ← deal_assumptions, deals
    ├─→ fetch_owned_asset_actuals   ← deal_monthly_actuals (portfolio comps)
    ├─→ fetch_owned_asset_opex_ratios ← deal_monthly_actuals (ratio benchmarks)
    ├─→ fetch_data_matrix       ← data_library_assets + multi-layer enrichment
    ├─→ fetch_data_library_comps ← data_library_assets
    ├─→ fetch_line_item_benchmarks ← line_item_benchmarks
    ├─→ fetch_archive_assumption_distribution ← archive_assumption_benchmarks
    ├─→ fetch_archive_achievement_vs_assumption ← archive_assumption_benchmarks
    ├─→ fetch_operator_stance   ← deals.operator_stance
    ├─→ compute_proforma        [in-memory computation]
    ├─→ detect_collision        [in-memory comparison]
    │
    └─→ write_underwriting      → deal_underwriting_snapshots
        write_projection        → deal_projections
        write_evidence_rows     → evidence audit table
        request_walkthrough     → deal_walkthrough_narratives (via Inngest)

CORPUS QUERY SERVICE (CorpusQueryService)
    │
    └─→ historical_observations
          │
          ├─→ M35 (Event Path / LIUS Bridge) — event timelines + realized correlations
          ├─→ M07 (Traffic Engine) — submarket metrics for calibration
          ├─→ M36 (Aggressiveness, PENDING)
          ├─→ M37 (PENDING)
          ├─→ M38 (Calibration, PENDING)
          └─→ realized-outputs.service.ts — backfills realized_* columns nightly

REALIZED OUTPUTS BACKFILL
    │
    └─→ After each new historical_observations INSERT:
          realizedOutputsService.backfillForParcel(parcelId)
          Fills realized_rent_change_t3/t12/t24, realized_occupancy_change_*, etc.
          for all prior rows at same parcel where the window has now closed
```

---

## 14. Known Gaps & Issues

| # | Issue | Impact |
|---|-------|--------|
| G1 | `data_library_files.asset_id = NULL` for all 266+ T12 files from bulk/ZIP upload | `fetch_source_documents` cannot trace T12 evidence back to source file |
| G2 | `historical_observations.deal_id = NULL` for ~98% of rows (only 1 distinct deal linked) | `isSubjectOnly` corpus queries return almost nothing; M07/M35 calibration against subject properties is blind |
| G3 | `CorpusQueryService.coverage()` returns stub data until corpus has populated rows | Coverage report always shows "low" confidence |
| G4 | `ingestPropertyPerformance()` (old path) marked `@deprecated`; some callers may still use it with `parcelId=''` | Corpus rows with empty parcel_id are unreachable |
| G5 | M36, M37, M38 listed as corpus consumers but not yet active | Listed in comment only; no actual SQL queries dispatched |
| G6 | External signal ingestion (LODES, QCEW, FRED, Veraset) all show `status: 'pending'` in coverage report | MSA-level corpus columns (`msa_employment_total`, `commute_shed_workers`, etc.) are all NULL |
| G7 | **CLOSED (2026-05-25)** — `line_item_benchmarks` seeded: 207 rows (14 line items × 3 classes, national + top-10 MSAs). `archive_assumption_benchmarks`: 209 rows including canonical `vacancy_pct`, `concessions_pct`, `bad_debt_pct`, `management_fee_pct`. `fetch_line_item_benchmarks` returns non-empty for Class B garden deals. Seed script: `backend/src/scripts/seed-opex-benchmarks.ts` | |

---

## 15. Document-to-Corpus Trigger Chain

```
data-router.ts (parse pipeline)
  → calls writeT12ToCorpus / writeRentRollToCorpus / writeOMToCorpus / writeTaxBillToCorpus
    → upsertCorpusRow (document-to-corpus.ts)
      → resolveParcelId: deal_properties JOIN deals JOIN properties → parcel_id
      → INSERT or UPDATE historical_observations
        → realizedOutputsService.backfillForParcel (post-insert)
```

The write happens **inside the surrounding parse transaction** — if corpus write fails, the entire upload rolls back.

---

## 16. Pre-Dispatch Readiness Assessment

This section states the minimum conditions that must be true before the CashFlow Agent can be trusted to deliver high-confidence underwriting output. "Dispatch" means triggering the agent on a subject deal (manual, event-driven, or scheduled).

### Current state (2026-05-25): NOT READY for high-confidence output

The agent runs and produces output today. However, the output quality is materially limited by the conditions below.

### Must-pass conditions before high-confidence dispatch

| Condition | Current State | Must-pass Test |
|-----------|--------------|---------------|
| **T12 actuals present** | Required. Gate-check in `cashflow.inngest.ts` enforces at least 3 months | Pass if `deal_monthly_actuals` has ≥ 3 months with non-null NOI for the subject deal |
| **Rent roll linked** | Strongly preferred. Without it, unit-level data is absent | Pass if `deal_lease_transactions` has ≥ 1 row for the subject deal |
| **`data_library_files.asset_id` backfilled (G1)** | FAILING — all 266 T12 files have asset_id = NULL | Pass if `SELECT COUNT(*) FROM data_library_files WHERE document_type = 'T12' AND asset_id IS NULL` = 0 |
| **`historical_observations.deal_id` linked (G2)** | FAILING — only 1 of 402 rows has a deal_id | Pass if subject deal's parcel_id appears in historical_observations with `deal_id` populated |
| **`line_item_benchmarks` seeded (G7)** | **PASSING** — 207 rows (national Class A/B/C + top-10 MSAs Class B). For FL deals: use national_class bucket (no FL-specific rows yet). | Pass if `SELECT COUNT(*) FROM line_item_benchmarks WHERE asset_class = 'B' AND state IS NULL` > 0 |
| **`archive_assumption_benchmarks` seeded (G7)** | **PASSING** — 209 rows; `vacancy_pct`, `concessions_pct`, `bad_debt_pct` all present for Class B existing with n_samples ≥ 300 | Pass if table has rows for the relevant asset_class + deal_type cohort |
| **`deal_evidence_rows` table created** | FAILING — table does not exist | Pass if `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_evidence_rows')` = true |
| **`fetch_rate_environment` schema fix (B1)** | FAILING — macro_context fields return strings, Zod rejects | Pass if `gdp_growth_pct`, `cpi_yoy_pct`, `unrate`, `consumer_sentiment`, `m2_yoy`, `dxy` all pass `typeof === 'number'` |
| **`fetch_cycle_intelligence` schema fix (B2)** | FAILING — cap_rate_forecast fields return strings | Pass if `current_cap` and `predicted_cap` pass `typeof === 'number'` |
| **Budget headroom** | Near limit — reference run used 772k / 800k tokens (96.6%) | Pass if deal's daily cost total < $20 and 800k token cap not within 50k of being hit |

### Conditions that are optional but materially improve output

| Condition | Current State | Impact if met |
|-----------|--------------|---------------|
| CoStar submarket data ingested | Not loaded for Wesley Chapel | `fetch_peer_comp_noi_metrics` returns data; submarket rent/vacancy anchored |
| Subject deal has OM uploaded | None attached for Sentosa Epperson | `detect_collision` gets sponsor-stated figures; evidence tier improves |
| `historical_observations` populated for submarket | 0 rows for Wesley Chapel | M35, M07, M36 become active; data completeness score rises from 20 → ~40 |
| External macro signals ingested (LODES/QCEW/Veraset) | All pending (G6) | MSA macro columns become non-null; corpus query quality improves |

### Minimum viable dispatch checklist

Before triggering a production run on any deal, confirm:

1. [ ] T12 actuals: ≥ 6 months present in `deal_monthly_actuals`
2. [ ] Rent roll: at least one row in `deal_lease_transactions`
3. [ ] `deal_evidence_rows` table exists (schema migration applied)
4. [ ] `line_item_benchmarks` has rows for the deal's state (or at minimum national rows)
5. [ ] `fetch_rate_environment` B1 fix applied (macro fields cast to number)
6. [ ] `fetch_cycle_intelligence` B2 fix applied (cap_rate_forecast fields cast to number)
7. [ ] Deal's budget headroom: < $20/day per-deal cap consumed

Steps 1–2 are the only conditions met today for Sentosa Epperson. Steps 3–7 require code or data fixes (tracked as G7, G1/G2, B1, B2 in this document). G7 (line_item_benchmarks, archive_assumption_benchmarks) was seeded 2026-05-25 — step 4 is now **PASSING**.

---

*End of inventory — Task #1047*
