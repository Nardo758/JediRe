# Missing Tables Audit

**Task:** #1051 — JEDI Scores migration + missing-tables audit  
**Date:** 2026-05-25  
**Status:** jedi_scores migration APPLIED; 62 remaining tables documented only (no migrations created for them in this task).

---

## Method

1. Extracted all SQL table references (`FROM`, `INTO`, `UPDATE`, `JOIN`) from every `.ts` file in `backend/src/`.
2. Cross-referenced against live `information_schema.tables` (public schema, BASE TABLE + VIEW).
3. Filtered out false positives: SQL keywords, CTE aliases, function names, PostgreSQL system tables.
4. For each missing table, counted code references and identified caller files.
5. Classified risk and derived expected schema from caller SQL.

---

## Result Summary

| Category | Count |
|---|---|
| Tables in backend code | 625 candidates |
| Confirmed in live DB | 558 |
| Missing (not in DB or views) | **63** |
| Fixed in this task | **1** (`jedi_scores`) |
| Remaining missing | **62** |

---

## Fixed in This Task

### `jedi_scores`

**Migration:** `backend/src/database/migrations/20260611_jedi_scores.sql`  
**Applied:** migration_number 1502, applied 2026-05-25

**Caller:** `backend/src/services/agent-chat.service.ts:133`
```sql
LEFT JOIN jedi_scores j ON j.deal_id = d.id
-- reads: total_score, market_score, financial_score, location_score, risk_score
```

**Root cause:** `jedi_score_history` (EXISTS) is the primary JEDI persistence table written by `jedi-score.service.ts`. `jedi_scores` is a companion lookup table for the agent-chat query. Neither the migration for `jedi_score_history` nor the migration for `jedi_scores` was ever created; the service was wired to write to `jedi_score_history` but `jedi_scores` was never bootstrapped.

**Schema created:**

```sql
CREATE TABLE jedi_scores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  -- Service dimensions (demand/supply model)
  total_score, demand_score, supply_score, momentum_score, position_score, risk_score,
  demand_contribution, supply_contribution, momentum_contribution,
  position_contribution, risk_contribution  (all NUMERIC),
  -- Agent-chat dimensions (market/financial/location model)
  market_score, financial_score, location_score  (all NUMERIC),
  -- Metadata
  calculation_method TEXT, trigger_event_id UUID, trigger_type TEXT,
  previous_score NUMERIC, score_delta NUMERIC,
  market_snapshot JSONB, demand_factors JSONB, supply_factors JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Verification:** `agent-chat.service.ts` LEFT JOIN now executes cleanly (returns NULLs for score columns, which is correct since the table is empty until scores are computed).

---

## Remaining 62 Missing Tables

Tables are grouped by risk level. Risk is based on:  
- **CRITICAL:** breaks auth, login, or a query that fires on every page load  
- **HIGH:** entire product feature broken (dedicated routes return 500)  
- **MEDIUM:** specific service operations fail when triggered  
- **LOW:** dead-code or extremely rare path; likely never invoked in current product state

---

### CRITICAL

#### `refresh_tokens`
- **Refs:** 9 (across `auth.routes.ts`, `admin.routes.ts`)
- **Impact:** JWT refresh flow broken — users cannot obtain new access tokens after expiry; logout and token cleanup also fail.
- **Caller schema hint:**
  ```sql
  INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (...)
  SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()
  DELETE FROM refresh_tokens WHERE token = $1
  DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < NOW()
  ```
- **Proposed columns:** `id UUID PK`, `user_id UUID FK→users`, `token TEXT UNIQUE NOT NULL`, `expires_at TIMESTAMPTZ NOT NULL`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** Priority P0 — create migration. Auth token refresh is a core security function.

#### `jedi_alerts`
- **Refs:** 1 (`agent-chat.service.ts:172`)
- **Impact:** Agent chat context fails when fetching recent alerts — the `getRecentAlerts` function throws at runtime.
- **Caller schema hint:**
  ```sql
  SELECT id, alert_type, severity, title, message, created_at
  FROM jedi_alerts
  WHERE dismissed_at IS NULL [AND deal_id = $1]
  ORDER BY created_at DESC LIMIT $n
  ```
- **Proposed columns:** `id UUID PK`, `deal_id UUID FK→deals`, `alert_type TEXT`, `severity TEXT`, `title TEXT`, `message TEXT`, `dismissed_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Note:** There is also `deal_alerts` (EXISTS) — evaluate whether `jedi_alerts` should be a view or alias of `deal_alerts` before creating a new table.
- **Recommended action:** P1 — check `deal_alerts` schema; if compatible, create a view `jedi_alerts AS SELECT * FROM deal_alerts`; otherwise migrate new table.

#### `msa_metrics`
- **Refs:** 1 (`agent-chat.service.ts:153`)
- **Impact:** Agent chat market context returns NULL — MSA-level economic data unavailable to chat completions.
- **Caller schema hint:**
  ```sql
  SELECT msa_code, msa_name, population, employment_rate,
         median_income, vacancy_rate, avg_rent, rent_growth_yoy,
         cap_rate, absorption_rate
  FROM msa_metrics WHERE msa_code = $1 ORDER BY as_of_date DESC LIMIT 1
  ```
- **Proposed columns:** `id UUID PK`, `msa_code TEXT NOT NULL`, `msa_name TEXT`, `population INT`, `employment_rate NUMERIC`, `median_income NUMERIC`, `vacancy_rate NUMERIC`, `avg_rent NUMERIC`, `rent_growth_yoy NUMERIC`, `cap_rate NUMERIC`, `absorption_rate NUMERIC`, `as_of_date DATE`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Note:** `msa_economic_snapshot` (EXISTS) and `msas` (EXISTS) may already hold this data — consider a view.
- **Recommended action:** P1 — create view `msa_metrics` over `msa_economic_snapshot JOIN msas` if columns match; otherwise migrate new table.

---

### HIGH

#### `maps`
- **Refs:** 111 (across `maps.routes.ts`, `layers.routes.ts`, `notifications.routes.ts`, `proposals.routes.ts`, `agent-runs.routes.ts`)
- **Impact:** Entire Maps module returns 500 on every endpoint — create, list, update, delete, and all layer/pin/proposal operations.
- **Caller schema hint:**
  ```sql
  INSERT INTO maps (name, owner_id, map_type, description) VALUES (...)
  UPDATE maps SET name=$1, description=$2 WHERE id=$3 AND owner_id=$4
  DELETE FROM maps WHERE id = $1 AND owner_id = $2
  ```
- **Proposed columns:** `id UUID PK`, `name TEXT NOT NULL`, `owner_id UUID FK→users`, `map_type TEXT DEFAULT 'acquisition'`, `description TEXT`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P1 — Maps is a complete product feature; create migration.

#### `map_collaborators`
- **Refs:** 21 (across `maps.routes.ts`, `layers.routes.ts`, `proposals.routes.ts`)
- **Impact:** Access-control subquery on maps always returns empty → all users see "not authorized" or "not found" for shared maps.
- **Caller schema hint:**
  ```sql
  SELECT 1 FROM map_collaborators WHERE map_id = $1 AND user_id = $2
  INSERT INTO map_collaborators (map_id, user_id, role) VALUES (...)
  ```
- **Proposed columns:** `id UUID PK`, `map_id UUID FK→maps`, `user_id UUID FK→users`, `role TEXT DEFAULT 'viewer'`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P1 — same migration as `maps`.

#### `map_pins`
- **Refs:** 8 (across `maps.routes.ts`, `layers.routes.ts`, `inline-inbox.routes.ts`)
- **Impact:** Map pin CRUD (add, update, delete, list) fails entirely.
- **Caller schema hint:**
  ```sql
  INSERT INTO map_pins (map_id, lat, lng, title, description, pin_type, metadata) VALUES (...)
  ```
- **Proposed columns:** `id UUID PK`, `map_id UUID FK→maps`, `lat NUMERIC`, `lng NUMERIC`, `title TEXT`, `description TEXT`, `pin_type TEXT`, `metadata JSONB`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P1 — same migration as `maps`.

#### `map_change_proposals`
- **Refs:** 16 (across `notifications.routes.ts`, `proposals.routes.ts`)
- **Impact:** Map change proposal workflow broken (create, review, approve proposals).
- **Caller schema hint:**
  ```sql
  INSERT INTO map_change_proposals (map_id, proposed_by, change_type, change_data, status) VALUES (...)
  ```
- **Proposed columns:** `id UUID PK`, `map_id UUID FK→maps`, `proposed_by UUID FK→users`, `change_type TEXT`, `change_data JSONB`, `status TEXT DEFAULT 'pending'`, `reviewed_by UUID`, `reviewed_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P1 — same migration as `maps`.

#### `building_profiles`
- **Refs:** 36 (`building-profile.service.ts` — dedicated service with UPSERT)
- **Impact:** Building profile service (physical specs: stories, units, amenity flags, parking, vintage band) fails on save and read for every deal.
- **Caller schema hint (partial):**
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
  ) ... ON CONFLICT (deal_id) DO UPDATE SET ...
  ```
- **Recommended action:** P1 — building profiles are required for F9 proforma and zoning calculations; create migration with all 34 columns above.

#### `agent_notifications`
- **Refs:** 13 (across `agents.routes.ts`, `morning-brief.routes.ts`)
- **Impact:** Agent notification list and mark-read endpoints fail; morning brief notification badge broken.
- **Caller schema hint:**
  ```sql
  SELECT ... FROM agent_notifications an WHERE an.user_id = $1
  UPDATE agent_notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2
  ```
- **Proposed columns:** `id UUID PK`, `user_id UUID FK→users`, `agent_id UUID`, `type TEXT`, `title TEXT`, `message TEXT`, `read_at TIMESTAMPTZ`, `metadata JSONB`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P1 — part of agent UX.

#### `markets`
- **Refs:** 8 (across `market-intelligence.routes.ts`, `market-metrics.routes.ts`, `preferences.routes.ts`, and 6 others)
- **Impact:** User market preference tracking, market-level intelligence queries, and M28 cycle intelligence fail.
- **Proposed columns:** `id UUID PK`, `msa_code TEXT UNIQUE`, `name TEXT`, `region TEXT`, `state TEXT`, `is_active BOOLEAN DEFAULT TRUE`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Note:** `msas` (EXISTS) likely overlaps — evaluate merging or creating a view.
- **Recommended action:** P1 — if `msas` is a superset, create `markets` as a view; otherwise migrate new table.

#### `event_processing_status`
- **Refs:** 14 (`kafka-events.routes.ts`)
- **Impact:** Kafka event pipeline status tracking and cascade trace visualization fail.
- **Caller schema hint:**
  ```sql
  LEFT JOIN event_processing_status eps ON eps.event_id = ect.event_id
  SELECT ... FROM event_processing_status WHERE ...
  ```
- **Proposed columns:** `id UUID PK`, `event_id UUID`, `status TEXT`, `error_message TEXT`, `processed_at TIMESTAMPTZ`, `retry_count INT DEFAULT 0`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P2 — Kafka observability only; does not affect deal data.

#### `kafka_events_log`
- **Refs:** 9 (`kafka-events.routes.ts`)
- **Impact:** Kafka event log viewer returns 500; event replay and debugging broken.
- **Caller schema hint:**
  ```sql
  SELECT ... FROM kafka_events_log kel WHERE ...
  JOIN kafka_events_log kel ON kel.event_id = ect.event_id
  ```
- **Proposed columns:** `id UUID PK`, `event_id UUID`, `topic TEXT`, `partition INT`, `offset BIGINT`, `key TEXT`, `payload JSONB`, `published_by TEXT`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P2 — observability feature; does not affect deal data.

#### `m35_draft_events`
- **Refs:** 12 (`m35-events.service.ts`, `m35-event-connectors.service.ts`)
- **Impact:** M35 event ingestion and promotion to `key_events` broken. The connector service has an inline `CREATE TABLE IF NOT EXISTS` — it self-creates on first invocation. May not be broken in practice.
- **Note:** `m35-event-connectors.service.ts:111` contains an inline DDL that creates this table on first call. Verify by running the connector endpoint.
- **Recommended action:** P2 — check if inline DDL fires at startup; if so, table exists in practice and this is a false alarm.

---

### MEDIUM

#### `deal_events`
- **Refs:** 5 (`deal-activity.routes.ts`, `morning-brief.routes.ts`, `skills/index.ts`)
- **Impact:** Deal activity timeline and deal event INSERT (from AI skills) fail.
- **Caller schema hint:**
  ```sql
  INSERT INTO deal_events (deal_id, event_type, title, description, event_date, created_by) VALUES (...)
  SELECT * FROM deal_events WHERE deal_id = $1 ORDER BY event_date DESC LIMIT 50
  ```
- **Proposed columns:** `id UUID PK`, `deal_id UUID FK→deals`, `event_type TEXT`, `title TEXT`, `description TEXT`, `event_date DATE`, `created_by UUID FK→users`, `metadata JSONB`, `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P2 — create migration; affects deal timeline feature.

#### `deal_financials`
- **Refs:** 3 (`sigma-apply-deal.ts`)
- **Impact:** Sigma scenario application fails to read/update financial overrides.
- **Caller schema hint:**
  ```sql
  SELECT irr FROM deal_financials WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1
  UPDATE deal_financials df SET ... WHERE deal_id = $1
  ```
- **Proposed columns:** `id UUID PK`, `deal_id UUID FK→deals`, `irr NUMERIC`, `equity_multiple NUMERIC`, `noi NUMERIC`, `cap_rate NUMERIC`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`
- **Recommended action:** P2.

#### `assumption_evidence`
- **Refs:** 6 (multiple services)
- **Impact:** Assumption evidence tracking (LayeredValue provenance trail) fails.
- **Recommended action:** P2 — part of LayeredValue audit trail.

#### `financial_assumptions`
- **Refs:** 5
- **Impact:** Financial assumption tracking for deals fails.
- **Recommended action:** P2.

#### `macro_indicators`
- **Refs:** 6
- **Impact:** Macroeconomic indicator feed fails.
- **Recommended action:** P2.

#### `msa_boundaries`
- **Refs:** 6
- **Impact:** MSA boundary polygon queries (PostGIS) fail.
- **Recommended action:** P2.

#### `agent_conversations`
- **Refs:** 6 (3 files)
- **Impact:** Agent conversation threading or history retrieval fails.
- **Recommended action:** P2.

#### `error_logs`
- **Refs:** 4
- **Impact:** Error logging to database fails; errors still propagate to console.
- **Recommended action:** P3 — observability only.

#### `event_cascade_trace`
- **Refs:** 4
- **Impact:** Kafka cascade trace (news → signal → JEDI) recording fails in the Kafka consumer (`kafkaProducer.createCascadeTrace`).
- **Caller hint:** `INSERT INTO event_cascade_trace (...)` with trigger chain columns.
- **Recommended action:** P2 — affects audit trail for signal propagation.

#### `opus_proforma_rejected_payloads`
- **Refs:** 4
- **Impact:** Opus proforma rejection audit trail fails.
- **Recommended action:** P3 — observability only.

#### `property_data_coverage`
- **Refs:** 4
- **Impact:** Property data coverage dashboard fails.
- **Recommended action:** P3.

#### `building_profile_opex_benchmarks`
- **Refs:** 4
- **Impact:** OpEx benchmark lookup for building profiles fails.
- **Recommended action:** P2 — dependency of `building_profiles` feature.

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

#### `deal_insurance`
- **Refs:** 2
- **Impact:** Deal insurance tracking fails.
- **Recommended action:** P3.

#### `deal_silos`
- **Refs:** 2
- **Impact:** Deal silo grouping fails.
- **Recommended action:** P3.

#### `field_percentiles`
- **Refs:** 2
- **Impact:** Field percentile benchmarking fails.
- **Recommended action:** P3.

#### `property_events`
- **Refs:** 5 (across 3 files)
- **Impact:** Property event tracking and morning brief fail.
- **Recommended action:** P2.

#### `property_pins`
- **Refs:** 2
- **Impact:** Property pin feature fails.
- **Recommended action:** P2.

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
- **Impact:** User preference reads/writes fail. Note: `user_view_preferences`, `user_intelligence_preferences`, etc. exist — evaluate whether a generic `user_preferences` table is needed or this should alias one of the existing tables.
- **Recommended action:** P2 — check if callers can be redirected to existing specialized tables.

#### `property_traffic_intelligence`
- **Refs:** 2
- **Impact:** Property traffic intelligence feature fails.
- **Recommended action:** P2.

---

### LOW (1 reference each — likely dead code or extremely rare paths)

| Table | Likely Caller | Notes |
|---|---|---|
| `archive_line_items` | 1 service | archive-related; likely legacy |
| `census_demographics` | 1 service | may overlap with existing demographic tables |
| `collaboration_sessions` | 1 service | feature not yet launched |
| `deal_insurance` | 1 service | tracked above under MEDIUM |
| `deal_permits` | 1 service | likely overlaps with `entitlement_milestones` |
| `deal_rent_roll_units` | 1 service | may overlap with `rent_roll_units` (EXISTS) |
| `deal_silos` | tracked above | — |
| `deal_t12_rows` | 1 service | trailing-12 row storage; may be replaced by `proforma_projections` |
| `deal_units` | 1 service | may overlap with `unit_mix` (EXISTS) |
| `demand_signals` | 1 service (`catalog-metrics-wiring`) | likely superceded by `oppgrid_demand_signals` (EXISTS) |
| `email_news_items` | 1 service | PST/email import flow |
| `email_property_extractions` | 1 service | PST/email import flow |
| `event_corroboration` | 1 service | — |
| `event_processing_status` | tracked above under HIGH | — |
| `investor_commitments` | 1 service | may overlap with `commitment_tranches` (EXISTS) |
| `lease_up_timelines` | 1 service | — |
| `leasing_traffic_data` | 1 service | may overlap with `leasing_traffic_predictions` (EXISTS) |
| `match_review_queue` | 1 service | property matching workflow |
| `model_performance_timeline` | 1 service | observability |
| `property_comments` | 1 service | — |
| `property_engagement_daily` | 1 service | — |
| `property_validation_summary` | 1 service | — |
| `rent_rolls` | 1 service | `rent_roll` (no s) EXISTS — likely typo/alias needed |
| `research_agents_run` | 1 service | — |
| `supply_signals` | 1 service (`catalog-metrics-wiring`) | likely superceded by `supply_pipeline` (EXISTS) |
| `user_alerts` | 1 service (`alert-consumer.ts:248`) | may overlap with `alerts` (EXISTS) or `deal_alerts` (EXISTS) |
| `zoning_code_cache` | 1 service | may overlap with `zoning_ai_analysis_cache` (EXISTS) |
| `zoning_parcels` | 1 service | may overlap with `county_parcels` (EXISTS) |

---

## Recommended Remediation Priority

| Priority | Tables | Why |
|---|---|---|
| **P0 (immediate)** | `refresh_tokens` | Auth/login broken for all users |
| **P1 (this sprint)** | `maps`, `map_collaborators`, `map_pins`, `map_change_proposals`, `jedi_alerts`, `msa_metrics`, `markets`, `building_profiles`, `agent_notifications` | Complete product features returning 500 |
| **P2 (next sprint)** | `deal_events`, `deal_financials`, `event_cascade_trace`, `m35_draft_events`, `assumption_evidence`, `financial_assumptions`, `macro_indicators`, `msa_boundaries`, `agent_conversations`, `building_permit`, `building_profile_opex_benchmarks`, `skill_chat_messages`, `event_processing_status`, `kafka_events_log`, `deal_variance_items`, `property_events`, `property_traffic_intelligence`, `user_preferences` | Feature-level failures, no data loss risk |
| **P3 (cleanup)** | All LOW tables plus `error_logs`, `audit_chains`, `opus_proforma_rejected_payloads`, `property_data_coverage`, `session_participants`, `similarity_pairs`, `field_percentiles` | Observability / dead code / potential view aliases |

---

## Notes on Potential View/Alias Candidates

Several "missing" tables may not need new migrations — a view aliasing an existing table may suffice:

| Missing Table | Existing Candidate | Recommendation |
|---|---|---|
| `jedi_alerts` | `deal_alerts` | Create view if columns match |
| `msa_metrics` | `msa_economic_snapshot` + `msas` | Create view joining both |
| `markets` | `msas` | Create view or alias |
| `demand_signals` | `oppgrid_demand_signals` | Investigate caller intent |
| `supply_signals` | `supply_pipeline` | Investigate caller intent |
| `rent_rolls` | `rent_roll` (EXISTS) | Typo — add view `rent_rolls AS SELECT * FROM rent_roll` |
| `user_alerts` | `deal_alerts` or `alerts` | Check alert-consumer INSERT columns |
| `deal_rent_roll_units` | `rent_roll_units` (EXISTS) | Check if same schema |
| `deal_units` | `unit_mix` (EXISTS) | Check caller columns |
| `zoning_code_cache` | `zoning_ai_analysis_cache` | Check column overlap |
| `zoning_parcels` | `county_parcels` | Check column overlap |
