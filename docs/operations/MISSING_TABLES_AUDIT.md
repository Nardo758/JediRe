# Missing Tables Audit

**Task:** #1051 — JEDI Scores migration + missing-tables audit  
**Date:** 2026-05-25  
**Status:** `jedi_scores` migration APPLIED (migration_number 1502); 57 remaining tables documented only (no additional migrations created in this task).

---

## Method

1. Extracted all SQL table references (`FROM`, `INTO`, `UPDATE`, `JOIN`) from every `.ts` file in `backend/src/` using targeted regex.
2. Cross-referenced against live `information_schema.tables` (public schema, both BASE TABLE and VIEW).
3. Filtered out false positives: SQL keywords, CTE aliases, function names, PostgreSQL system tables, variable names.
4. For each genuinely missing table, counted code references and identified caller files.
5. Classified risk and derived expected schema from caller SQL patterns.

---

## Result Summary

| Category | Count |
|---|---|
| Unique candidate names from SQL in code | 625 |
| Confirmed in live DB (base tables) | 423 |
| Confirmed as views | 30 |
| False positives (keywords / aliases) | 109 |
| Missing (not a table or view in live DB) | **63 at audit time** |
| Fixed in this task (`jedi_scores`) | **1** |
| Corrected false positives (views/tables found on recheck) | **5** |
| Remaining genuinely missing | **57** |

---

## Fixed in This Task

### `jedi_scores`

**Migration:** `backend/src/database/migrations/20260611_jedi_scores.sql`  
**Applied:** migration_number 1502, 2026-05-25  
**Rollback:** `DROP INDEX idx_jedi_scores_deal_created; DROP INDEX idx_jedi_scores_deal_id; DROP TABLE jedi_scores;`

**Caller:** `backend/src/services/agent-chat.service.ts:133`
```sql
LEFT JOIN jedi_scores j ON j.deal_id = d.id
-- reads: total_score, market_score, financial_score, location_score, risk_score
```

**Root cause:** `jedi_score_history` (EXISTS — migration_number unknown, already in DB) is the primary JEDI persistence table written by `jedi-score.service.ts` (`saveScore` / `calculateAndSave`). `jedi_scores` is a companion "current score" lookup table for the agent-chat join that was never migrated. The three "error paths" cited in prior audit documentation (module-wiring endpoint, deal-context loader, Kafka consumer) all use `jedi_score_history` and were NOT erroring; the actual broken path was the `agent-chat.service.ts:133` LEFT JOIN.

**Schema created:** 25 columns covering both scoring dimensions used by the service (demand/supply/momentum/position/risk scores + contributions) and the agent-chat join dimensions (market/financial/location scores), plus calculation metadata and JSONB payloads. See migration file for full DDL.

**Verification:** `agent-chat.service.ts` LEFT JOIN executes cleanly — returns NULLs for score columns (correct, table is empty until scores are computed via `jedi-score.service.ts`).

---

## Cross-Reference: All Tables Found in Code vs. Live DB

### Tables Confirmed in Live DB

See [Appendix A](#appendix-a-confirmed-tables-in-live-db) for the full enumerated list (423 base tables + 30 views = 453 objects confirmed).

### Initial False Positives (Not Actually Missing)

Five tables appeared in the initial missing list but are confirmed to exist upon recheck:

| Table | Type | Note |
|---|---|---|
| `deal_waterfall_config` | BASE TABLE | Exists — was erroneously excluded by grep false-positive |
| `match_review_queue` | VIEW | Exists as a view |
| `model_performance_timeline` | VIEW | Exists as a view |
| `property_traffic_intelligence` | VIEW | Exists as a view |
| `property_validation_summary` | VIEW | Exists as a view |

---

## Remaining Missing Tables (57)

Grouped by risk. Risk is based on:
- **CRITICAL:** breaks auth or fires on every page load
- **HIGH:** entire product feature returns 500
- **MEDIUM:** specific service operations fail when triggered
- **LOW:** dead code or extremely rare path; likely never invoked in current product state

---

### CRITICAL

#### `refresh_tokens`
- **Refs:** 9 (across `auth.routes.ts`, `admin.routes.ts`)
- **Impact:** JWT refresh flow broken — users cannot renew access tokens after expiry; logout and token cleanup also fail.
- **Caller schema:**
  ```sql
  INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (...)
  SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()
  DELETE FROM refresh_tokens WHERE token = $1
  DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < NOW()
  ```
- **Proposed columns:** `id UUID PK`, `user_id UUID FK→users`, `token TEXT UNIQUE NOT NULL`, `expires_at TIMESTAMPTZ NOT NULL`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P0 — create migration immediately. Auth token refresh is a core security function. See follow-up task #1058.

#### `jedi_alerts`
- **Refs:** 1 (`agent-chat.service.ts:172`)
- **Impact:** `getRecentAlerts()` in agent-chat throws at runtime.
- **Caller schema:**
  ```sql
  SELECT id, alert_type, severity, title, message, created_at
  FROM jedi_alerts WHERE dismissed_at IS NULL [AND deal_id = $1]
  ORDER BY created_at DESC LIMIT $n
  ```
- **Proposed columns:** `id UUID PK`, `deal_id UUID FK→deals`, `alert_type TEXT`, `severity TEXT`, `title TEXT`, `message TEXT`, `dismissed_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Note:** `deal_alerts` (BASE TABLE, EXISTS) has overlapping semantics — evaluate whether `jedi_alerts` should be a view: `CREATE VIEW jedi_alerts AS SELECT * FROM deal_alerts`. Also see `active_deal_alerts` view (EXISTS).
- **Recommended action:** P1 — check `deal_alerts` columns; create view alias if compatible.

#### `msa_metrics`
- **Refs:** 1 (`agent-chat.service.ts:153`)
- **Impact:** Agent chat market context returns NULL — MSA-level economic data unavailable to chat completions.
- **Caller schema:**
  ```sql
  SELECT msa_code, msa_name, population, employment_rate,
         median_income, vacancy_rate, avg_rent, rent_growth_yoy,
         cap_rate, absorption_rate
  FROM msa_metrics WHERE msa_code = $1 ORDER BY as_of_date DESC LIMIT 1
  ```
- **Proposed columns:** `id UUID PK`, `msa_code TEXT NOT NULL`, `msa_name TEXT`, `population INT`, `employment_rate NUMERIC`, `median_income NUMERIC`, `vacancy_rate NUMERIC`, `avg_rent NUMERIC`, `rent_growth_yoy NUMERIC`, `cap_rate NUMERIC`, `absorption_rate NUMERIC`, `as_of_date DATE`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Note:** `msa_economic_snapshot` (BASE TABLE, EXISTS) and `msas` (BASE TABLE, EXISTS) likely contain this data — consider `CREATE VIEW msa_metrics AS SELECT ... FROM msa_economic_snapshot JOIN msas ...`.
- **Recommended action:** P1 — view alias preferred over new table to avoid data duplication.

---

### HIGH

#### `maps`
- **Refs:** 111 (across `maps.routes.ts`, `layers.routes.ts`, `notifications.routes.ts`, `proposals.routes.ts`, `agent-runs.routes.ts`, `inline-inbox.routes.ts`)
- **Impact:** Entire Maps module returns 500 on every endpoint — create, list, update, delete maps, and all layer/pin/proposal operations.
- **Caller schema:**
  ```sql
  INSERT INTO maps (name, owner_id, map_type, description) VALUES (...)
  UPDATE maps SET name=$1, description=$2 WHERE id=$3 AND owner_id=$4
  DELETE FROM maps WHERE id = $1 AND owner_id = $2
  ```
- **Proposed columns:** `id UUID PK`, `name TEXT NOT NULL`, `owner_id UUID FK→users`, `map_type TEXT DEFAULT 'acquisition'`, `description TEXT`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`
- **Note:** `map_configurations` (BASE TABLE, EXISTS) and `map_layers` (BASE TABLE, EXISTS) exist but serve different purposes (configuration/layer data, not the map entity itself).
- **Recommended action:** P1 — create migration with all four Maps-module tables together. See follow-up task #1059.

#### `map_collaborators`
- **Refs:** 21 (across `maps.routes.ts`, `layers.routes.ts`, `proposals.routes.ts`)
- **Impact:** Access-control check on shared maps always fails → unauthorized or not-found errors for all collaborative map access.
- **Caller schema:**
  ```sql
  SELECT 1 FROM map_collaborators WHERE map_id = $1 AND user_id = $2
  INSERT INTO map_collaborators (map_id, user_id, role) VALUES (...)
  ```
- **Proposed columns:** `id UUID PK`, `map_id UUID FK→maps`, `user_id UUID FK→users`, `role TEXT DEFAULT 'viewer'`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P1 — same migration as `maps`.

#### `map_pins`
- **Refs:** 8 (across `maps.routes.ts`, `layers.routes.ts`, `inline-inbox.routes.ts`)
- **Impact:** Map pin CRUD (add, update, delete, list) fails entirely.
- **Caller schema:**
  ```sql
  INSERT INTO map_pins (map_id, lat, lng, title, description, pin_type, metadata) VALUES (...)
  ```
- **Proposed columns:** `id UUID PK`, `map_id UUID FK→maps`, `lat NUMERIC`, `lng NUMERIC`, `title TEXT`, `description TEXT`, `pin_type TEXT`, `metadata JSONB`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P1 — same migration as `maps`.

#### `map_change_proposals`
- **Refs:** 16 (across `notifications.routes.ts`, `proposals.routes.ts`)
- **Impact:** Map change proposal workflow broken — create, review, approve map change proposals all fail.
- **Caller schema:**
  ```sql
  INSERT INTO map_change_proposals (map_id, proposed_by, change_type, change_data, status) VALUES (...)
  UPDATE map_change_proposals SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3
  ```
- **Proposed columns:** `id UUID PK`, `map_id UUID FK→maps`, `proposed_by UUID FK→users`, `change_type TEXT`, `change_data JSONB`, `status TEXT DEFAULT 'pending'`, `reviewed_by UUID`, `reviewed_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P1 — same migration as `maps`.

#### `building_profiles`
- **Refs:** 36 (`building-profile.service.ts` — dedicated service with ON CONFLICT upsert)
- **Impact:** Building profile service (physical specs: stories, units, amenity flags, parking, vintage band) fails on every save and read for every deal.
- **Caller schema (from INSERT at `building-profile.service.ts:211`):**
  ```sql
  INSERT INTO building_profiles (
    deal_id, year_built, total_stories, total_units,
    building_type, construction_type, site_acres, building_sqft, unit_sqft_avg,
    parking_spaces, parking_type, parking_ratio, vintage_band, size_band,
    has_elevator, has_pool, has_clubhouse, has_fitness, has_concierge,
    has_dog_park, has_rooftop, has_coworking, has_package_concierge,
    has_valet_trash, has_doorman, has_garage, has_tennis, has_basketball,
    has_business_center, has_playground, has_grill,
    raw_amenities, extraction_source, extraction_confidence
  ) ON CONFLICT (deal_id) DO UPDATE SET ...
  ```
- **Recommended action:** P1 — create migration with all 34 columns; add UNIQUE(deal_id). See follow-up task #1060.

#### `agent_notifications`
- **Refs:** 13 (across `agents.routes.ts`, `morning-brief.routes.ts`)
- **Impact:** Agent notification list and mark-read endpoints fail; morning brief notification badge broken.
- **Caller schema:**
  ```sql
  SELECT ... FROM agent_notifications an WHERE an.user_id = $1
  UPDATE agent_notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2
  ```
- **Proposed columns:** `id UUID PK`, `user_id UUID FK→users`, `agent_id UUID`, `type TEXT`, `title TEXT`, `message TEXT`, `read_at TIMESTAMPTZ`, `metadata JSONB`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P1 — part of agent UX; create migration.

#### `markets`
- **Refs:** 8 (across `market-intelligence.routes.ts`, `market-metrics.routes.ts`, `preferences.routes.ts`, and 5 others)
- **Impact:** User market preference tracking and market-level intelligence queries fail.
- **Note:** `msas` (BASE TABLE, EXISTS) and `available_markets` (BASE TABLE, EXISTS) likely overlap — evaluate view alias before creating a new table.
- **Recommended action:** P1 — check if `msas` superset; create `markets` view if so.

#### `event_processing_status`
- **Refs:** 14 (`kafka-events.routes.ts`)
- **Impact:** Kafka event pipeline status tracking and cascade trace visualization fail.
- **Caller schema:**
  ```sql
  LEFT JOIN event_processing_status eps ON eps.event_id = ect.event_id
  SELECT ... FROM event_processing_status WHERE ...
  ```
- **Proposed columns:** `id UUID PK`, `event_id UUID`, `status TEXT`, `error_message TEXT`, `processed_at TIMESTAMPTZ`, `retry_count INT DEFAULT 0`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P2 — Kafka observability feature; does not affect deal data.

#### `kafka_events_log`
- **Refs:** 9 (`kafka-events.routes.ts`)
- **Impact:** Kafka event log viewer returns 500; event replay and debugging broken.
- **Caller schema:**
  ```sql
  SELECT ... FROM kafka_events_log kel WHERE ...
  JOIN kafka_events_log kel ON kel.event_id = ect.event_id
  ```
- **Proposed columns:** `id UUID PK`, `event_id UUID`, `topic TEXT`, `partition INT`, `offset BIGINT`, `key TEXT`, `payload JSONB`, `published_by TEXT`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P2 — observability feature; does not affect deal data.

#### `m35_draft_events`
- **Refs:** 12 (`m35-events.service.ts`, `m35-event-connectors.service.ts`, `m35-connectors.routes.ts`)
- **Impact:** M35 event ingestion and promotion to `key_events` broken.
- **Note:** `m35-event-connectors.service.ts:111` contains an inline `CREATE TABLE IF NOT EXISTS m35_draft_events` that runs on first call to the connector service — this table may self-create at runtime and may not be broken in practice. Verify by calling `GET /api/v1/m35-connectors` once.
- **Recommended action:** P2 — verify self-creation; if not working, extract the inline DDL into a migration.

---

### MEDIUM

#### `deal_events`
- **Refs:** 5 (across `deal-activity.routes.ts`, `morning-brief.routes.ts`, `skills/index.ts`)
- **Impact:** Deal activity timeline read and deal event INSERT (from AI skills) fail.
- **Caller schema:**
  ```sql
  INSERT INTO deal_events (deal_id, event_type, title, description, event_date, created_by) VALUES (...)
  SELECT * FROM deal_events WHERE deal_id = $1 ORDER BY event_date DESC LIMIT 50
  ```
- **Proposed columns:** `id UUID PK`, `deal_id UUID FK→deals`, `event_type TEXT`, `title TEXT`, `description TEXT`, `event_date DATE`, `created_by UUID FK→users`, `metadata JSONB`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Note:** `deal_lifecycle_events` (BASE TABLE, EXISTS) may overlap — check columns before creating new table.
- **Recommended action:** P2.

#### `deal_financials`
- **Refs:** 3 (`sigma/sigma-apply-deal.ts`)
- **Impact:** Sigma scenario application fails to read/write financial overrides.
- **Caller schema:**
  ```sql
  SELECT irr FROM deal_financials WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1
  UPDATE deal_financials df SET ... WHERE deal_id = $1
  ```
- **Proposed columns:** `id UUID PK`, `deal_id UUID FK→deals`, `irr NUMERIC`, `equity_multiple NUMERIC`, `noi NUMERIC`, `cap_rate NUMERIC`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`
- **Note:** `deal_financial_models` and `deal_financial_model_analyses` (both BASE TABLE, EXISTS) may overlap.
- **Recommended action:** P2.

#### `assumption_evidence`
- **Refs:** 6 (multiple services)
- **Impact:** Assumption evidence tracking (LayeredValue provenance trail) fails.
- **Recommended action:** P2 — part of LayeredValue audit trail.

#### `financial_assumptions`
- **Refs:** 5
- **Impact:** Financial assumption tracking for deals fails.
- **Note:** `deal_assumptions` (BASE TABLE, EXISTS) and `scenario_assumptions` (BASE TABLE, EXISTS) may overlap.
- **Recommended action:** P2 — check existing assumption tables first.

#### `macro_indicators`
- **Refs:** 6
- **Impact:** Macroeconomic indicator feed fails.
- **Note:** `macro_anchor_observations` (BASE TABLE, EXISTS) may overlap.
- **Recommended action:** P2.

#### `msa_boundaries`
- **Refs:** 6
- **Impact:** MSA boundary polygon queries (PostGIS) fail.
- **Recommended action:** P2.

#### `agent_conversations`
- **Refs:** 6 (3 files)
- **Impact:** Agent conversation threading or history retrieval fails.
- **Note:** `agent_chat_logs` (BASE TABLE, EXISTS) and `chat_sessions` (BASE TABLE, EXISTS) may overlap.
- **Recommended action:** P2.

#### `event_cascade_trace`
- **Refs:** 4
- **Impact:** Kafka cascade trace (news → signal → JEDI) recording fails in the Kafka consumer (`kafkaProducer.createCascadeTrace`).
- **Caller hint:** referenced in `jedi-score-consumer.ts` call to `kafkaProducer.createCascadeTrace`.
- **Recommended action:** P2 — affects signal propagation audit trail.

#### `opus_proforma_rejected_payloads`
- **Refs:** 4
- **Impact:** Opus proforma rejection audit trail fails.
- **Note:** `opus_proforma_versions` (BASE TABLE, EXISTS) may be able to record rejections via a status column instead.
- **Recommended action:** P3 — observability only.

#### `property_data_coverage`
- **Refs:** 4
- **Impact:** Property data coverage dashboard fails.
- **Recommended action:** P3.

#### `building_profile_opex_benchmarks`
- **Refs:** 4
- **Impact:** OpEx benchmark lookup for building profiles fails.
- **Recommended action:** P2 — dependency of `building_profiles` feature; create in same migration.

#### `skill_chat_messages`
- **Refs:** 4
- **Impact:** Skill chat message persistence fails.
- **Recommended action:** P2.

#### `audit_chains`
- **Refs:** 3
- **Impact:** Audit chain integrity tracking fails.
- **Recommended action:** P3.

#### `building_permits`
- **Refs:** 3
- **Impact:** Building permit data ingestion/lookup fails.
- **Recommended action:** P2.

#### `deal_variance_items`
- **Refs:** 3
- **Impact:** Deal variance analysis fails.
- **Recommended action:** P2.

#### `deal_line_items`
- **Refs:** 2 (2 files)
- **Impact:** Deal line item budget tracking fails.
- **Recommended action:** P2.

#### `error_logs`
- **Refs:** 4
- **Impact:** Error logging to database fails; errors still propagate to console.
- **Recommended action:** P3 — observability only.

#### `property_events`
- **Refs:** 5 (3 files, including `morning-brief.routes.ts`)
- **Impact:** Property event tracking and morning brief entries fail.
- **Recommended action:** P2.

#### `property_pins`
- **Refs:** 2
- **Impact:** Property pin feature fails.
- **Recommended action:** P2.

#### `property_engagement_daily`
- **Refs:** 1
- **Impact:** Daily property engagement metrics fail.
- **Recommended action:** P3.

#### `session_participants`
- **Refs:** 2
- **Impact:** Collaboration session tracking fails.
- **Recommended action:** P3.

#### `similarity_pairs`
- **Refs:** 2
- **Impact:** Property similarity computation fails.
- **Recommended action:** P3.

#### `user_preferences`
- **Refs:** 3
- **Impact:** Generic user preference reads/writes fail.
- **Note:** `user_view_preferences`, `user_intelligence_preferences`, `user_market_preferences`, `user_model_preferences`, `user_screening_params` (all BASE TABLE, EXISTS) are specialized preference tables. Callers of `user_preferences` may be targeting a simpler generic store — check before creating new table.
- **Recommended action:** P2 — investigate if callers can be redirected to existing specialized tables.

#### `property_comments`
- **Refs:** 1
- **Impact:** Property comment feature fails.
- **Recommended action:** P3.

---

### LOW (1–2 references, likely dead code or potential view-alias)

| Table | Refs | Existing Candidate | Notes |
|---|---|---|---|
| `archive_line_items` | 1 | — | likely legacy code path |
| `census_demographics` | 1 | `property_demographics` (EXISTS) | may be column alias |
| `collaboration_sessions` | 1 | `chat_sessions` (EXISTS) | likely unused feature |
| `deal_insurance` | 2 | — | — |
| `deal_permits` | 1 | `entitlement_milestones` (EXISTS) | check overlap |
| `deal_rent_roll_units` | 1 | `rent_roll_units` (EXISTS) | likely same schema |
| `deal_silos` | 2 | — | — |
| `deal_t12_rows` | 1 | `proforma_projections` (EXISTS) | check overlap |
| `deal_units` | 1 | `unit_mix` (EXISTS) | check overlap |
| `demand_signals` | 1 | `oppgrid_demand_signals` (EXISTS) | `catalog-metrics-wiring.service.ts` |
| `email_news_items` | 1 | — | PST import flow |
| `email_property_extractions` | 1 | `email_extractions` (EXISTS) | check column overlap |
| `event_corroboration` | 1 | `news_event_corroboration` (EXISTS) | likely same thing |
| `field_percentiles` | 2 | — | — |
| `investor_commitments` | 1 | `commitment_tranches` (EXISTS) | check overlap |
| `lease_up_timelines` | 1 | — | — |
| `leasing_traffic_data` | 1 | `leasing_traffic_predictions` (EXISTS) | check overlap |
| `millage_rates` | 2 | `jurisdiction_tax_cache` (EXISTS) | check overlap |
| `property_data_coverage` | 4 | `property_coverage_usage` (EXISTS) | check overlap |
| `rent_rolls` | 1 | `rent_roll` (EXISTS) | **typo** — add view `CREATE VIEW rent_rolls AS SELECT * FROM rent_roll` |
| `research_agents_run` | 1 | `agent_runs` (EXISTS) | check overlap |
| `supply_signals` | 1 | `supply_pipeline` (EXISTS) | `catalog-metrics-wiring.service.ts` |
| `user_alerts` | 1 | `alerts` (EXISTS), `deal_alerts` (EXISTS) | `alert-consumer.ts:248` INSERT — check columns |
| `zoning_code_cache` | 1 | `zoning_ai_analysis_cache` (EXISTS) | likely same thing |
| `zoning_parcels` | 1 | `county_parcels` (EXISTS) | check overlap |

---

## Recommended Remediation Priority

| Priority | Tables | Why |
|---|---|---|
| **P0 (immediate)** | `refresh_tokens` | Auth/login broken for all users |
| **P1 (this sprint)** | `maps`, `map_collaborators`, `map_pins`, `map_change_proposals`, `jedi_alerts`, `msa_metrics`, `markets`, `building_profiles`, `building_profile_opex_benchmarks`, `agent_notifications` | Complete product features returning 500 on every request |
| **P2 (next sprint)** | `deal_events`, `deal_financials`, `event_cascade_trace`, `m35_draft_events`, `assumption_evidence`, `financial_assumptions`, `macro_indicators`, `msa_boundaries`, `agent_conversations`, `building_permits`, `skill_chat_messages`, `event_processing_status`, `kafka_events_log`, `deal_variance_items`, `property_events`, `property_pins`, `property_traffic_intelligence` (view? — recheck), `user_preferences`, `deal_line_items`, `error_logs` | Feature-level failures, no data loss risk |
| **P3 (cleanup)** | All LOW tables plus `audit_chains`, `opus_proforma_rejected_payloads`, `property_data_coverage`, `session_participants`, `similarity_pairs`, `field_percentiles`, `property_comments`, `property_engagement_daily` | Observability / dead code / confirmed view-alias candidates |

---

## View/Alias Candidates (no migration needed, just DDL)

These missing table names are likely mismatches against existing objects. A `CREATE VIEW` may be sufficient:

| Missing | Existing Candidate | Suggested DDL |
|---|---|---|
| `jedi_alerts` | `deal_alerts` | `CREATE VIEW jedi_alerts AS SELECT * FROM deal_alerts` (verify columns) |
| `msa_metrics` | `msa_economic_snapshot` + `msas` | `CREATE VIEW msa_metrics AS SELECT ...` |
| `markets` | `msas` or `available_markets` | `CREATE VIEW markets AS SELECT * FROM msas` |
| `rent_rolls` | `rent_roll` | `CREATE VIEW rent_rolls AS SELECT * FROM rent_roll` |
| `demand_signals` | `oppgrid_demand_signals` | Verify caller column names |
| `supply_signals` | `supply_pipeline` | Verify caller column names |
| `user_alerts` | `deal_alerts` or `alerts` | Check `alert-consumer.ts:248` INSERT columns |
| `deal_rent_roll_units` | `rent_roll_units` | Check column overlap |
| `deal_units` | `unit_mix` | Check column overlap |
| `zoning_code_cache` | `zoning_ai_analysis_cache` | Check column overlap |
| `zoning_parcels` | `county_parcels` | Check column overlap |
| `email_property_extractions` | `email_extractions` | Check column overlap |
| `event_corroboration` | `news_event_corroboration` | Check column overlap |

---

## Appendix A: Confirmed Tables in Live DB

The following 423 base tables and 30 views were confirmed in `information_schema` at audit time (2026-05-25). Any table in code that appears in this list is **not missing**.

### Base Tables (423)

```
activity_log, actual_performance, address_geocode_cache, adjustment_formulas,
admin_comp_set_properties, admin_pricing_alert_rules, adt_counts,
agent_activity_log, agent_chat_logs, agent_collaboration_after_tax_returns,
agent_collaboration_debt_recommendations, agent_collaboration_legal_protections,
agent_collaboration_pricing_recommendations, agent_collaboration_screening_adjustments,
agent_collaboration_variance_impacts, agent_events, agent_patterns, agent_run_steps,
agent_runs, agent_task_learnings, agent_tasks, agent_workflow_runs, ai_usage_log,
alert_configurations, alerts, analysis_results, apartment_api_sync_log,
apartment_class_rent_snapshots, apartment_locator_properties, apartment_market_snapshots,
apartment_properties, apartment_rent_comps, apartment_submarkets,
apartment_supply_pipeline, apartment_trends, apartment_user_analytics,
archive_assumption_benchmarks, archive_deals, archive_statistics, archived_deals,
asset_news_links, asset_note_permissions, asset_notes, assumption_adjustments,
assumption_history, assumption_outcomes, assumption_snapshots, audit_log,
available_markets, backtest_accuracy, backtest_forecasts, backtest_results,
backtest_runs, balance_sheets, benchmark_projects, broker_narratives,
building_3d_models, building_designs_3d, calendar_events, calibration_factors,
capex_actuals, capex_budget, capital_account_entries, capital_call_items,
capital_calls, capsule_activity, capsule_documents, capsule_external_shares,
capsule_fork_log, capsule_shares, cashflow_projections, chat_sessions,
climate_risk_assessments, cloud_storage_connections, cloud_sync_jobs,
cohort_membership, cohorts, commitment_tranches, comp_pricing_alerts,
comp_pricing_snapshots, comp_properties, comp_unit_types, competitive_sets,
composite_risk_profiles, confirmation_chain_results, construction_cost_tracking,
corporate_facility_events, corporate_financials, corporate_health_scores,
corporate_stock_prices, correlation_history, corroboration_matches,
costar_market_metrics, county_parcels, county_zoning_categories, crime_statistics,
custom_scenario_configs, custom_strategies, custom_strategy_exports,
custom_strategy_usage, data_library_assets, data_library_cost_data,
data_library_enrichment_log, data_library_files, data_library_files_legacy,
data_quality_alerts, data_uploads, dd_checklists, dd_tasks, deal_activity,
deal_agent_tasks, deal_alerts, deal_annotations, deal_assumptions, deal_balance_sheets,
deal_capex_items, deal_capsules, deal_collaborators, deal_comments, deal_comp_sets,
deal_comparable_properties, deal_compliance_issues, deal_contacts,
deal_context_email_links, deal_context_fields, deal_context_items, deal_contexts,
deal_contract_clauses, deal_custom_tabs, deal_debt_schedule, deal_decisions,
deal_designs, deal_document_files, deal_documents, deal_emails, deal_file_access_log,
deal_files, deal_financial_model_analyses, deal_financial_models, deal_handoffs,
deal_historical_outcomes, deal_investments, deal_key_dates, deal_lease_transactions,
deal_leasing_metrics, deal_lifecycle_events, deal_market_data,
deal_market_intelligence, deal_modules, deal_monthly_actuals, deal_monthly_assumptions,
deal_notes, deal_notifications, deal_pipeline, deal_properties, deal_rate_sheets,
deal_receivables_aging, deal_risks, deal_roadmaps, deal_role_templates,
deal_scenarios, deal_shares, deal_state_tracking, deal_structuring_recommendations,
deal_task_comments, deal_tasks, deal_team_activity, deal_team_assignments,
deal_team_comments, deal_team_members, deal_team_notifications, deal_team_tasks,
deal_templates, deal_timelines, deal_traffic_comp_selections, deal_traffic_snapshots,
deal_underwriting_scenarios, deal_underwriting_snapshots, deal_unit_programs,
deal_versions, deal_waterfall_config, deal_waterfalls, deal_zoning_confirmations,
deal_zoning_profiles, deals, debt_positions, decision_log, deferred_maintenance,
demand_driver_events, demand_event_types, demand_events, demand_phasing_templates,
demand_projections, demand_signal_weights, design_references, developers,
development_projects, development_scenarios, digital_traffic_events,
digital_traffic_scores, discovered_properties, discovery_cache, discovery_jobs,
discovery_runs, disposition_cash_flows, dispositions, distribution_items,
distributions, doc_relationships, document_access_log, document_categories,
dot_temporal_profiles, driver_analysis_results, driver_analysis_runs, email_accounts,
email_attachments, email_extractions, email_label_assignments, email_labels,
email_sync_logs, emails, employer_concentration, entitlement_milestones, entitlements,
event_causality_results, event_control_groups, event_forecasts,
event_geographic_impacts, event_impacts, event_ingestion_log, event_outcomes,
event_playbooks, event_status_history, event_taxonomy, event_type_treatments,
execution_risk_factors, expense_inflation_observations, extraction_events,
field_mappings, financial_models, forecast_actuals_tracking, forecast_regen_queue,
forecast_validations, fulton_parcels, fulton_structures, geographic_relationships,
geographies, georgia_ingestion_jobs, georgia_property_sales, grid_templates,
historical_observations, identity_verifications, inflation_alerts, inflation_cache,
inflation_snapshots, insurance_cost_observations, intake_jobs, integration_events,
interest_rate_scenarios, investor_communications, investors, jedi_score_history,
jedi_scores, jurisdiction_calibration, jurisdiction_source_map,
jurisdiction_tax_cache, key_events, knowledge_graph_communities,
knowledge_graph_edges, knowledge_graph_embedding_cache,
knowledge_graph_embedding_sweeps, knowledge_graph_nodes, learning_adjustments,
lease_events, lease_expiration_schedule, lease_transactions, leasing_events,
leasing_traffic_predictions, line_item_benchmarks, m28_cycle_snapshots,
m28_deal_performance_by_phase, m28_historical_events, m28_leading_indicators,
m28_market_metrics_history, m28_pattern_matches, m28_rate_environment,
m35_metric_watchlist_config, macro_anchor_observations, map_annotation_comments,
map_configurations, map_layers, market_basket_prices, market_basket_snapshots,
market_commentary, market_coverage_status, market_data_connections,
market_data_snapshots, market_data_sync_jobs, market_events, market_inventory,
market_rent_comps, market_research_cache, market_research_metrics,
market_research_reports, market_research_source_log, market_research_triggers,
market_research_usage, market_risk_indicators, market_sale_comps,
market_sentiment_history, market_snapshots, market_trends, market_vitals,
metric_correlations, metric_lead_lag_results, metric_projections,
metric_recommendations, metric_time_series, microsoft_accounts,
model_performance_metrics, module_data_requirements, module_definitions,
module_library_files, module_suggestions, monte_carlo_simulations, morning_briefs,
msa_economic_snapshot, msas, municipal_benchmarks, municipalities,
municipality_fee_schedules, municode_section_map, natural_disaster_events,
news_alerts, news_api_usage, news_article_cache, news_contact_credibility,
news_discoveries, news_event_corroboration, news_event_geo_impacts, news_events,
news_items, news_sources, notarize_sessions, notarize_signers, notarize_webhooks,
note_categories, note_replies, notification_preferences, notifications,
om_replacement_cost_data, operations_actuals, operations_recommendations,
oppgrid_demand_signals, oppgrid_growth_trajectories, oppgrid_location_scores,
oppgrid_market_economics, oppgrid_opportunity_signals, opus_conversations,
opus_learned_patterns, opus_messages, opus_proforma_versions,
opus_template_structures, orchestrator_logs, org_integrations, org_invitations,
org_members, organization_members, organizations, other_income_tracking,
parcel_tax_cache, platform_intel, playbook_backtest_results, playbook_instances,
points_of_interest, proactive_alerts_log, proforma_adjustment_history,
proforma_assumptions, proforma_line_item_anchors, proforma_projections,
proforma_snapshots, proforma_state_rules, proforma_templates, prompt_versions,
properties, property_actuals, property_analyses, property_boundaries,
property_competition, property_coverage_usage, property_data_providers,
property_demographics, property_descriptions, property_digital_competitors,
property_email_links, property_enrichment_jobs, property_extraction_queue,
property_ga_connections, property_info_cache, property_matches, property_proximity,
property_records, property_rent_data, property_sales, property_tax_records,
property_traffic_actual, property_traffic_context, property_transit_access,
property_type_strategies, property_types, property_visibility,
property_website_analytics, property_zoning_cache, pst_email_imports,
pst_extracted_entities, rate_sheet_versions, recipient_api_connections,
recipient_query_log, recipient_session_overlays, recorded_transactions,
refi_test_scenarios, refinance_events, reforecasts, regime_shift_alerts,
regulatory_alerts, regulatory_risk_events, rent_comps, rent_inflation_observations,
rent_roll, rent_roll_diffs, rent_roll_snapshots, rent_roll_units, rent_scrape_jobs,
rent_scrape_targets, revenue_management_snapshots, risk_alert_thresholds,
risk_categories, risk_escalations, risk_events, risk_score_history, risk_scores,
role_capabilities, sale_comp_set_members, sale_comp_sets, scenario_assumptions,
scenario_events, scenario_results, scenario_templates, schema_migrations,
scraped_rents, seasonality_factors, signing_envelopes, signing_recipients,
site_intelligence, source_credibility, source_specialties, spatial_correlations,
spatial_ref_sys, stage_task_templates, standard_line_items, state_machine_config,
state_transitions, strategies, strategy_analyses, strategy_arbitrage,
strategy_backtest_results, strategy_backtest_summary, strategy_definitions,
strategy_runs, strategy_scores, structural_premiums, subject_traffic_history,
submarket_characters, submarket_corporate_health, submarket_employers, submarkets,
subscriptions, supply_absorption_tracking, supply_analyses, supply_delivery_timeline,
supply_event_types, supply_events, supply_metrics, supply_pipeline,
supply_pipeline_aggregates, supply_pipeline_projects, supply_risk_scores, tasks,
tax_assessment_observations, tax_comp_analyses, tax_policy_changes, tax_projections,
team_members, team_role_templates, trade_area_demand_forecast,
trade_area_event_impacts, trade_areas, traffic_calibration_coefficients,
traffic_calibration_factors, traffic_calibration_history,
traffic_calibration_legacy_factors, traffic_comp_snapshots,
traffic_competitive_share, traffic_correlation_signals, traffic_counts,
traffic_data_sources, traffic_error_patterns, traffic_funnel, traffic_learned_rates,
traffic_model_versions, traffic_prediction_history, traffic_predictions,
traffic_projection_overrides, traffic_projections, traffic_submarket_calibration,
traffic_upload_history, traffic_validation, traffic_weight_config,
training_examples, triangulation_outcomes, underwriting_evidence, unified_documents,
unit_mix, unit_type_trends, upload_templates, user_acquisition_preferences,
user_agent_settings, user_branding_settings, user_capabilities,
user_column_preferences, user_credibility, user_credit_balances,
user_email_accounts, user_intelligence_preferences, user_map_annotations,
user_market_preferences, user_model_preferences, user_module_settings,
user_module_training, user_news_connections, user_news_items, user_news_preferences,
user_newsletter_articles, user_newsletter_parses, user_newsletter_sources,
user_notifications, user_property_type_strategies, user_push_tokens,
user_risk_preferences, user_saved_articles, user_screening_params,
user_view_preferences, user_workspaces, users, validation_properties,
validation_results, variance_analysis, waterfall_tiers, weekly_traffic_snapshots,
zoning_agent_analyses, zoning_ai_analysis_cache, zoning_analyses, zoning_capacity,
zoning_changes, zoning_code_interpretations, zoning_corrections,
zoning_correction_requests, zoning_district_boundaries, zoning_districts,
zoning_learning_precedents, zoning_outcomes, zoning_overlays, zoning_precedents,
zoning_predictions, zoning_profiles, zoning_recommendations, zoning_source_citation,
zoning_triangulations, zoning_verification, zoning_verification_cases
```

### Views (30)

```
active_calibration_factors, active_deal_alerts, capsule_summary, deal_summary,
deal_team_roster, enrichment_opportunities, event_impact_summary,
geography_columns, geometry_columns, latest_calibration_coefficients,
latest_calibration_factors, latest_traffic_predictions, match_review_queue,
model_performance_timeline, pending_action_items, property_metrics,
property_profiles, property_proximity_scorecard, property_traffic_intelligence,
property_type_strategy_summary, property_validation_summary,
spatial_ref_sys (PostGIS), v_comp_search, v_deal_audit_summary, v_deal_summary,
v_event_impact_summary, v_expiring_leases_90d, v_recent_prediction_accuracy,
v_scenario_comparison, v_unified_properties
```
