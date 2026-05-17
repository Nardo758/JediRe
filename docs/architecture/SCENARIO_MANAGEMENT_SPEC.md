# Scenario Management System — Technical Specification

**Version:** 1.0  
**Date:** 2026-05-17  
**Status:** Active — Phases 1 (Foundation) and 3-Component-2 (Scenario Generation) shipped

---

## 1. Overview

The Scenario Management System enables analysts to generate, compare, and manage Bull/Base/Bear/Stress scenarios for any deal. Scenarios are derived from market event data, assumption overrides, and agent-computed underwriting baselines. Custom scenarios allow arbitrary event inclusion/exclusion and assumption overrides beyond the four standard types.

**Core tables:** `deal_scenarios`, `scenario_templates`, `custom_scenario_configs`  
**API surface:** `POST /api/v1/scenarios/generate/:dealId`, `GET /api/v1/scenarios/:dealId`, `GET /api/v1/scenarios/templates`  
**Service layer:** `scenario-generation.service.ts`

---

## 2. Data Model

### 2.1 `deal_scenarios`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `deal_id` | UUID | FK → deals |
| `scenario_template_id` | UUID | nullable for custom |
| `scenario_type` | enum | `bull`, `base`, `bear`, `stress`, `custom` |
| `scenario_name` | text | display name |
| `description` | text | narrative |
| `is_custom` | boolean | true for analyst-defined scenarios |
| `generation_trigger` | text | `manual`, `event_update`, `agent_run` |
| `generated_by` | UUID | FK → users |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 2.2 `scenario_templates`

System-level templates defining the default assumption modification rules for each scenario type (Bull/Base/Bear/Stress). Templates are ordered: bull → base → bear → stress.

### 2.3 `custom_scenario_configs`

| Column | Type | Notes |
|--------|------|-------|
| `scenario_id` | UUID | FK → deal_scenarios |
| `selected_event_ids` | JSONB | market events included |
| `excluded_event_ids` | JSONB | market events excluded |
| `assumption_overrides` | JSONB | arbitrary key→value overrides |

---

## 3. Scenario Types

| Type | Description |
|------|-------------|
| **Bull** | Favorable macro assumptions — rent growth at upper cohort percentile, low vacancy, cap rate compression |
| **Base** | Median assumptions derived from archive cohort P50; operator stance applied |
| **Bear** | Conservative assumptions — rent growth at lower cohort percentile, elevated vacancy, cap rate expansion |
| **Stress** | Tail-risk scenario — severe vacancy, no rent growth, forced exit conditions |
| **Custom** | Analyst-defined; any combination of market events and assumption overrides |

---

## 4. Market Event Integration

Scenarios reference `market_events` rows (city-level events: supply deliveries, interest rate changes, employment shocks). The scenario generator:
1. Fetches relevant market events for the deal's MSA/city
2. Filters events by `scenario_type` applicability
3. Translates event magnitudes into assumption delta vectors
4. Applies delta vectors on top of the base underwriting assumptions

Events are linked to scenarios via `custom_scenario_configs.selected_event_ids`.

---

## 5. Agent Runtime Integration

The CashFlow Agent produces the base underwriting assumptions that all scenarios branch from. Scenario generation:
1. Reads the most recent `agent_runs` row with `status = 'succeeded'` for the deal
2. Reads `underwriting_evidence` to extract resolved assumption values
3. Applies scenario-specific deltas to produce scenario-level projections
4. Persists scenario projections to `deal_scenarios`

If no agent run exists for a deal, scenario generation falls back to the proforma's `year1` assumptions.

---

## 6. Comparison Interface (CIE — Comparison Interface Engine)

The CIE provides side-by-side visualization of scenario outputs. Consumers:
- Proforma projections tab (year-by-year GPR, NOI, returns by scenario)
- Financial Engine header — scenario selector
- Deal Capsule Blueprint (M-series module integration)

CIE data flow: `GET /api/v1/scenarios/:dealId` → scenario list → per-scenario projection fetch → UI render.

---

## 7. Archival and Migration

Scenario data is deal-scoped and durable. Migration policy:
- Scenario records created before schema changes are preserved unless explicitly deprecated
- `scenario_templates` changes require a migration script that re-tags existing scenarios
- `custom_scenario_configs.assumption_overrides` is schema-free JSONB — backwards-compatible by default

---

## 8. Phase Roadmap

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation | Shipped — tables, API, template engine, scenario generation service |
| 2 | UI Integration | Pending — scenario selector in Financial Engine; side-by-side comparison table |
| 3 | Agent Runtime | Partially shipped (Phase 3 Component 2: `scenarios.routes.ts`) — full wiring pending |
| 4 | CIE Integration | Pending — Comparison Interface Engine connecting scenarios to proforma projections |
| 5 | Archival | Pending — scenario versioning, archive percentile tagging, lifecycle management |

---

## 9. Dependencies and Constraints

- Scenario generation requires a seeded `scenario_templates` table (at least 4 rows: bull/base/bear/stress)
- Market event data must cover the deal's MSA for event-based scenario differentiation; without market events, scenario types collapse to assumption-delta-only differentiation
- Agent runtime integration requires `agent_runs` + `underwriting_evidence` to exist for the deal; fallback to `deal_assumptions.year1` is available but produces lower-fidelity scenarios
- CIE integration depends on the Financial Engine's projection engine accepting scenario identifiers as parameters

---

## 10. Acceptance Criteria

> **Revision:** This section replaces the original acceptance criteria list with 14 verifiable criteria, each with a concrete verification step and expected output.  
> **Scope:** Covers all 5 phases — criteria are gated by phase but defined upfront.

---

### Category A — Migration Integrity (Criteria 1–3, 13)

**AC-01 — Schema integrity: all scenario tables present with correct columns**

*Verification:*
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('deal_scenarios','scenario_templates','custom_scenario_configs')
ORDER BY table_name, ordinal_position;
```
*Expected output:* All three tables present. `deal_scenarios` has columns: `id`, `deal_id`, `scenario_template_id`, `scenario_type`, `scenario_name`, `description`, `is_custom`, `generation_trigger`, `generated_by`, `created_at`, `updated_at`. `scenario_templates` has at minimum 4 rows (bull/base/bear/stress) after seeding. `custom_scenario_configs` has `scenario_id`, `selected_event_ids`, `excluded_event_ids`, `assumption_overrides`.

---

**AC-02 — Scenario templates seeded: 4 standard templates present**

*Verification:*
```sql
SELECT scenario_type, COUNT(*) AS n
FROM scenario_templates
GROUP BY scenario_type
ORDER BY CASE scenario_type WHEN 'bull' THEN 1 WHEN 'base' THEN 2
                             WHEN 'bear' THEN 3 WHEN 'stress' THEN 4 END;
```
*Expected output:* 4 rows, one per type, each with `n >= 1`. Missing rows indicate seeding was not run; run `npx ts-node --transpile-only backend/src/database/seeds/scenario-templates.seed.ts` to populate.

---

**AC-03 — Custom scenario config referential integrity**

*Verification:*
```sql
SELECT csc.scenario_id, ds.id AS scenario_exists
FROM custom_scenario_configs csc
LEFT JOIN deal_scenarios ds ON ds.id = csc.scenario_id
WHERE ds.id IS NULL;
```
*Expected output:* Zero rows. Any row returned indicates a dangling `custom_scenario_configs` entry — orphaned by a scenario deletion without cascading cleanup.

---

**AC-13 — No stale scenario projections after agent re-run**

*Verification:* For a deal with existing scenarios, trigger a new agent run (`POST /api/v1/agents/cashflow/underwrite`). After run completes, re-fetch scenarios (`GET /api/v1/scenarios/:dealId`) and verify `updated_at` timestamps on scenario projections are >= the agent run's `completed_at`.

*Expected output:* All scenario projection timestamps updated. If any scenario shows a `base_assumptions_run_id` pointing to a superseded run, the scenario is stale and must be regenerated.

---

### Category B — User Workflow (Criteria 4–6)

**AC-04 — Standard scenario generation: all 4 types produced for a deal**

*Verification:*
```bash
TOKEN=$(curl -s http://localhost:4000/api/v1/auth/dev-login | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s -X POST http://localhost:4000/api/v1/scenarios/generate/3f32276f-aacd-4da3-b306-317c5109b403 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" | python3 -m json.tool
```
*Expected output:* `{"success": true, "data": {"count": 4, "scenarios": [...]}}` — 4 scenarios, one per type. Verify `scenario_type` values: bull, base, bear, stress.

---

**AC-05 — Custom scenario creation: event selection and assumption overrides persist**

*Verification:*
```bash
curl -s -X POST http://localhost:4000/api/v1/scenarios/custom \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"dealId":"3f32276f-aacd-4da3-b306-317c5109b403","scenarioName":"Test Custom",
       "selectedEventIds":["evt-1"],"assumptionOverrides":{"vacancy_pct":0.10}}' | python3 -m json.tool
```
Then verify in DB:
```sql
SELECT csc.selected_event_ids, csc.assumption_overrides
FROM custom_scenario_configs csc
JOIN deal_scenarios ds ON ds.id = csc.scenario_id
WHERE ds.deal_id = '3f32276f-aacd-4da3-b306-317c5109b403'
  AND ds.scenario_name = 'Test Custom';
```
*Expected output:* `selected_event_ids = ["evt-1"]`, `assumption_overrides = {"vacancy_pct": 0.10}`.

---

**AC-06 — Scenario list endpoint returns all deal scenarios with correct structure**

*Verification:*
```bash
curl -s http://localhost:4000/api/v1/scenarios/3f32276f-aacd-4da3-b306-317c5109b403 \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```
*Expected output:* `{"success": true, "data": {"scenarios": [...], "count": N}}`. Each scenario object contains `id`, `scenario_type`, `scenario_name`, `is_custom`, `created_at`. `N >= 4` if standard scenarios have been generated.

---

### Category C — Agent Runtime (Criteria 7–8)

**AC-07 — Agent baseline consumption: scenario generation reads from latest succeeded run**

*Verification:* After a successful agent run for 464 Bishop (verify `agent_runs` has `status = 'succeeded'`), generate scenarios and verify the base assumptions derive from the run:
```sql
SELECT ds.scenario_type, ds.id AS scenario_id,
       ds.generation_trigger, ds.created_at
FROM deal_scenarios ds
WHERE ds.deal_id = '3f32276f-aacd-4da3-b306-317c5109b403'
  AND ds.created_at > NOW() - INTERVAL '1 hour'
ORDER BY ds.created_at DESC;
```
*Expected output:* 4 rows created after the agent run, each with `generation_trigger = 'manual'` or `'agent_run'`. If `generation_trigger = 'agent_run'` is absent from the enum, update to add it.

---

**AC-08 — Scenario generation falls back gracefully when no agent run exists**

*Verification:* Create a new test deal with no agent run. Attempt scenario generation:
```bash
curl -s -X POST http://localhost:4000/api/v1/scenarios/generate/<new_deal_id> \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```
*Expected output:* Either `{"success": true, ...}` using `deal_assumptions.year1` as fallback, or `{"success": false, "error": "No agent baseline available — run underwriting first"}`. Silent null-value scenarios are NOT acceptable; the fallback source must be documented in the response or in the scenario's `description` field.

---

### Category D — Comparison and Lifecycle (Criteria 9–11)

**AC-09 — CIE renders all 4 scenario types in side-by-side comparison**

*Verification:* Navigate to the Financial Engine for 464 Bishop. Open the Projections tab. Verify a scenario selector or scenario comparison panel is present. With all 4 standard scenarios generated, the comparison table should show 4 columns (or a toggle between them). Each column shows Year 1–10 GPR, NOI, and returns.

*Expected output:* All 4 scenario columns present. Values diverge across scenarios (bull > base > bear > stress for GPR and NOI). If comparison table is absent, Phase 4 (CIE Integration) has not been deployed.

---

**AC-10 — Scenario deletion removes scenario and its config atomically**

*Verification:*
```bash
# Get a scenario ID to delete
SCENARIO_ID=$(psql $DATABASE_URL -t -c "SELECT id FROM deal_scenarios WHERE deal_id='3f32276f-aacd-4da3-b306-317c5109b403' AND is_custom=true LIMIT 1" | tr -d ' ')
curl -s -X DELETE http://localhost:4000/api/v1/scenarios/$SCENARIO_ID \
  -H "Authorization: Bearer $TOKEN"
```
Then verify:
```sql
SELECT COUNT(*) FROM custom_scenario_configs WHERE scenario_id = '<deleted_id>';
-- Expected: 0
SELECT COUNT(*) FROM deal_scenarios WHERE id = '<deleted_id>';
-- Expected: 0
```
*Expected output:* Both queries return 0. If any row remains, the deletion is partial — add ON DELETE CASCADE to the FK or add explicit cleanup in the route handler.

---

**AC-11 — Re-generation after market event update produces updated scenario values**

*Verification:* Insert a test market event for Atlanta:
```sql
INSERT INTO market_events (city, event_type, magnitude, effective_date, created_at)
VALUES ('Atlanta', 'rent_shock', -0.05, CURRENT_DATE, NOW())
RETURNING id;
```
Then re-generate scenarios for 464 Bishop and verify the bear/stress scenarios reflect the rent shock (GPR base should decrease by approximately 5% relative to prior generation). After test: delete the inserted row.

*Expected output:* Bear and stress scenarios show lower GPR projections than the prior generation. Bull and base may be unchanged or minimally affected depending on template rules.

---

### Category E — Backward Compatibility (Criterion 12)

**AC-12 — Existing deals with no scenarios are unaffected by schema changes**

*Verification:* Query all deals and confirm none have broken scenario-adjacent data due to migrations:
```sql
SELECT COUNT(*) AS deals_total,
       COUNT(ds.deal_id) AS deals_with_scenarios
FROM deals d
LEFT JOIN deal_scenarios ds ON ds.deal_id = d.id
WHERE d.created_at < '2026-02-01';  -- pre-scenario-feature deals
```
*Expected output:* `deals_with_scenarios = 0` for pre-feature deals is acceptable (no auto-backfill). Any error returned from `GET /api/v1/scenarios/:dealId` for a pre-feature deal must be a clean empty-list response, not a 500.

---

### Category F — Production Readiness (Criterion 14)

**AC-14 — Scenario generation completes within SLA under concurrent load**

*Verification:*
```bash
# Fire 4 concurrent generation requests for different deals
for DEAL_ID in deal1 deal2 deal3 deal4; do
  curl -s -X POST http://localhost:4000/api/v1/scenarios/generate/$DEAL_ID \
    -H "Authorization: Bearer $TOKEN" &
done
wait
```
*Expected output:* All 4 requests return `{"success": true}` within 10 seconds. If any request times out or returns 500, investigate whether the scenario generation service serializes or has a queue limit. Log the `duration_ms` for each call and ensure p95 < 5000ms.

---

## 11. Implementation Notes

### 11.1 Template Engine

Scenario templates define `delta_rules` — a JSON array of assumption key → delta-type/magnitude pairs. Delta types: `absolute`, `relative`, `percentile_shift`. The template engine applies rules in declaration order; later rules override earlier for the same key.

### 11.2 Event Translation

Market event `magnitude` fields are dimensionless scalars (e.g., `0.05` = 5% shock). Translation to assumption deltas depends on event type:
- `rent_shock` → delta to `rent_growth_y1` (bear: add, bull: subtract from shock)
- `cap_rate_shift` → delta to `exit_cap_rate`
- `vacancy_shock` → delta to `vacancy_pct`
- `supply_delivery` → delta to both `vacancy_pct` and `rent_growth_y1`

### 11.3 Idempotency

`POST /api/v1/scenarios/generate/:dealId` is idempotent per trigger: generating twice with the same trigger overwrites existing scenarios of each type (upsert on `deal_id + scenario_type`). Custom scenarios are never overwritten by standard generation.

### 11.4 Error States

| Condition | HTTP Response | Recovery |
|-----------|--------------|----------|
| No template for scenario type | 500 | Seed `scenario_templates` |
| No market events for deal's MSA | 200, scenarios generated with zero event deltas | Acceptable; document in scenario `description` |
| Agent baseline absent | 200 or 400 (see AC-08) | Run agent underwriting first |
| DB constraint violation | 500 | Check referential integrity; see AC-03 |

---

## 11.5 Phase Verification Protocol

> **Purpose:** Before deploying each phase, the responsible engineer executes the verification workflow below and signs off in the closing note. A phase is not "done-done" until all pass criteria are met and the documentation deliverable is filed.

---

### Phase 1 — Foundation

**Scope:** Database schema, scenario templates seeding, basic CRUD API (`generate`, `list`, `templates`, `custom`).

**Verification workflow:**

1. Run AC-01 (schema columns check) — confirm all three tables present with correct columns.
2. Run AC-02 (templates seeded) — confirm 4 standard templates present.
3. Run AC-04 (standard generation) — POST to `/generate/:dealId` and verify 4 scenarios returned.
4. Run AC-05 (custom creation) — POST to `/custom` and verify event/override persistence.
5. Run AC-06 (list endpoint) — GET `/scenarios/:dealId` and verify structure.
6. Run AC-12 (backward compatibility) — verify pre-feature deals return clean empty-list response.

**Pass criteria:**
- AC-01, AC-02, AC-03: all pass (zero schema drift, 4 templates, zero orphaned configs)
- AC-04: `count == 4` in response
- AC-05: `selected_event_ids` and `assumption_overrides` persisted correctly in DB
- AC-06: response is `{"success": true, "data": {"scenarios": [...], "count": N}}`
- AC-12: no 500s for pre-feature deals

**Rollback condition:** If AC-01 fails (missing tables/columns), rollback the migration. If AC-02 fails (missing templates), re-run the seed script — this does not require a rollback.

**Documentation deliverable:** Closing note at `docs/operations/scenario-phase1-closing-note.md` with AC-01 through AC-06 outputs and any deviations.

---

### Phase 2 — UI Integration

**Scope:** Scenario selector in Financial Engine; scenario management panel (generate, rename, delete, view); scenario comparison table (side-by-side).

**Verification workflow:**

1. Navigate to Financial Engine for 464 Bishop. Verify scenario selector component is visible in the header.
2. Click "Generate Scenarios" — verify all 4 types appear in the selector within 5 seconds.
3. Click "Bull" scenario — verify projection table updates to reflect bull assumption deltas.
4. Switch to "Bear" — verify values decrease relative to Bull for GPR and NOI.
5. Click "Rename" on a scenario — enter a new name — verify persisted on page refresh.
6. Click "Delete" on a custom scenario — verify the scenario disappears from the selector and AC-10 query returns 0 rows.
7. Run AC-09 (CIE side-by-side comparison) — verify 4 columns present with diverging values.

**Pass criteria:**
- Scenario selector renders without error
- All 4 types selectable and projection table updates on type switch
- Rename persists through page refresh
- Delete removes scenario from UI and DB (AC-10 passes)
- Side-by-side comparison table shows 4 columns with bull > base > bear > stress ordering for GPR

**Rollback condition:** If scenario selector causes the Financial Engine header to fail to render (React error boundary triggered), revert the component to the prior header version. Scenario selector must not be a hard dependency for the Financial Engine to function.

**Documentation deliverable:** Screen recording (or screenshot sequence) of AC-09 side-by-side comparison. Closing note at `docs/operations/scenario-phase2-closing-note.md`.

---

### Phase 3 — Agent Runtime

**Scope:** CashFlow Agent consuming scenarios as context; agent run triggering scenario re-generation; scenario assumptions reflecting agent-derived evidence tiers.

**Verification workflow:**

1. Trigger a fresh agent underwriting run for 464 Bishop.
2. After run completes (`status = 'succeeded'`), verify scenarios are regenerated (AC-07).
3. Inspect `deal_scenarios` — confirm `generation_trigger = 'agent_run'` on the new scenarios.
4. Compare base scenario assumptions to `underwriting_evidence` tier-1 values — verify alignment (GPR in base scenario == agent-computed stabilized GPR).
5. Run AC-08 — verify graceful fallback on a deal with no agent run.
6. Run AC-13 — verify no stale projections after agent re-run.

**Pass criteria:**
- `generation_trigger = 'agent_run'` present on regenerated scenarios
- Base scenario GPR within 1% of agent-computed stabilized GPR from `underwriting_evidence`
- No stale scenarios (AC-13 passes)
- Fallback on missing agent run returns clean error or proforma-based fallback (AC-08 passes)

**Rollback condition:** If agent runtime integration causes `agent_runs` to fail (new code introduced a DB write error in the run completion hook), revert the hook and file a bug. The agent must not be blocked by scenario regeneration failures.

**Documentation deliverable:** SQL query output showing `generation_trigger = 'agent_run'` with timestamps aligned to agent run completion. Closing note at `docs/operations/scenario-phase3-closing-note.md`.

---

### Phase 4 — CIE Integration

**Scope:** Comparison Interface Engine — scenario-parameterized projection API; multi-scenario overlay in Projections tab; scenario delta visualization (waterfall or highlight).

**Verification workflow:**

1. Run AC-09 (CIE side-by-side comparison) — verify full 10-year projection table for each of 4 scenario types.
2. Verify that changing assumptions in the Deal Terms tab (e.g., exit cap rate) triggers scenario re-computation.
3. Verify scenario deltas are visually surfaced — at minimum, bull/bear divergence should be highlighted.
4. Run AC-11 (re-generation after market event update) — verify CIE immediately reflects updated scenario values after `POST /generate`.
5. Run AC-14 (concurrent load) — verify 4 concurrent CIE projection fetches all complete within 10s.

**Pass criteria:**
- Full 10-year projection (Year 1–10) visible for all 4 scenario types
- Re-compute triggered by Deal Terms change within 5 seconds
- AC-11 passes (market event update reflected in projections)
- AC-14 passes (p95 < 5000ms)

**Rollback condition:** If CIE integration causes the Projections tab to fail to render for deals without scenarios, gate the CIE projection component behind a `scenarios.length > 0` check and render the existing single-scenario projection as fallback.

**Documentation deliverable:** Screenshot of 4-column CIE comparison table with Year 1–5 visible. Closing note at `docs/operations/scenario-phase4-closing-note.md`.

---

### Phase 5 — Archival

**Scope:** Scenario versioning (scenario re-generation creates new version, preserves history); archive percentile tagging (scenario assumptions tagged with cohort percentile vs archive distribution); scenario lifecycle management (active/archived/deleted states).

**Verification workflow:**

1. Generate scenarios for 464 Bishop. Record the scenario IDs.
2. Re-generate scenarios. Verify the previous scenarios are preserved as archived versions, not overwritten.
3. Query scenario versions:
   ```sql
   SELECT scenario_type, version, status, created_at
   FROM deal_scenarios
   WHERE deal_id = '3f32276f-aacd-4da3-b306-317c5109b403'
   ORDER BY scenario_type, created_at;
   ```
   Expected: multiple rows per `scenario_type`, with prior versions showing `status = 'archived'`.
4. Verify archive percentile tags: for base scenario, `assumption_overrides` (or a new `archive_percentiles` column) shows the cohort percentile for each assumption (e.g., `{"vacancy_pct_percentile": 0.48, "rent_growth_percentile": 0.52}`).
5. Run AC-03 (referential integrity) — no orphaned `custom_scenario_configs` after archival operations.

**Pass criteria:**
- Prior scenario versions preserved with `status = 'archived'`
- Active scenarios queryable as `WHERE status = 'active'`
- Archive percentile tags present on base scenario assumptions
- AC-03 passes (zero dangling custom configs)

**Rollback condition:** If versioning introduces unbounded row growth (scenario re-generation creates a new row on every agent run), add a retention policy: keep the last 5 versions per deal/type and hard-delete the rest.

**Documentation deliverable:** SQL output showing versioned scenario history for 464 Bishop. Closing note at `docs/operations/scenario-phase5-closing-note.md`.

---

### Cross-Phase Regression Suite

After any phase deployment, the following regression checks must pass before the phase is considered stable:

| Check | Command / Query | Pass Condition |
|-------|----------------|----------------|
| R-01: Schema intact | AC-01 query | All tables + columns present |
| R-02: Templates present | AC-02 query | 4 rows, one per type |
| R-03: No orphaned configs | AC-03 query | 0 rows returned |
| R-04: Generation succeeds | AC-04 HTTP call | `count == 4` |
| R-05: List endpoint healthy | AC-06 HTTP call | `success: true`, no 500 |
| R-06: Pre-feature deals clean | AC-12 query | No 500s on empty-scenario deals |
| R-07: Financial Engine renders | Navigate to Financial Engine for any deal | Page loads without React error boundary |
| R-08: Agent runs unblocked | Trigger agent run + verify `status = succeeded` | Agent run completes within 3 minutes |

The regression suite should be run as a post-deploy check after each phase. Any failure in R-07 or R-08 is a deploy-blocker — roll back immediately.

---

## 12. Open Questions

1. **MSA event coverage:** Market events currently seeded only for Atlanta. Non-Atlanta deals get zero-delta scenarios. Tracked as follow-up task: "Seed market events for cities beyond Atlanta."
2. **msaId missing on deals:** `deals.msaId` is null on most deals, forcing city-name fallback for event matching. Tracked as follow-up task: "Populate the msaId field on deals."
3. **Scenario templates completeness:** It is not confirmed that `scenario_templates` has been seeded with 4 rows in production. AC-02 should be run against the production DB to verify.
4. **CIE phase status:** Phase 4 (CIE Integration) is tracked as pending. The comparison interface referenced in the deal-capsule-blueprint may partially satisfy this phase — audit needed.
