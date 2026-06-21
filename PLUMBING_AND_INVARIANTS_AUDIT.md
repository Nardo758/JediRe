# Plumbing & Invariants Audit — Platform-Wide Horizontal

**HEAD SHA:** `a351f874f3168396fb8b85f142ae67d0cbc4514b`
**Date:** 2026-06-21
**READ-ONLY — no code changed.**

---

## One-Line Verdict

**FRAGILE-AT: S2 (Event Bus), S5 (Cache freshness), S7 (Property identity), S9 (Licensing scope)**

The shared infrastructure carries revenue traffic but four pipes are structurally unsound.
S9 is the most consequential: without `scope_id` on the corpus tables there is no mechanical
barrier preventing user-licensed or CoStar-derived data from flowing into the shared corpus.
S2 has four analytical completion events firing into void — their intended downstream
cascades never fire. S5 silently serves stale tax millage data. S7 allows three unguarded
write paths to mint divergent property identities for the same address.

---

## Part 1 — Subsystem Health

| # | Subsystem | Label | Tag | Failure-mode answer |
|---|-----------|-------|-----|---------------------|
| S1 | Agent runtime — `agents/runtime/` | PARTIAL | [LAUNCH] | `BudgetEnforcer` throws at caps (`AgentRuntime.ts:316,476,636`) — WIRED. But 1272 of 1273 `audit_log` agent rows have `agent_run_id IS NULL` (see Live DB §4). `AgentRuntime.ts:655` correctly writes `agent_run_id: run.id`, but the walkthrough path (`request_walkthrough_narrative.ts:53-54`) inserts its own audit row without `agent_run_id` and accounts for 707+565 = 1272 rows. Only 1 row (cashflow.completed) carries a non-null run_id. Agent attribution is effectively absent for the dominant audit path. |
| S2 | Inngest event bus | PARTIAL | [LAUNCH] | `deal.created` → research + cashflow ✓. `research.completed` → commentary + cashflow ✓. `cashflow.walkthrough_requested` → cashflow:734 ✓. `TAX_BILL_UPLOADED_EVENT` → `taxBillUploaded.handler.ts` ✓. **ORPHANED:** `zoning.completed` (published at `zoning.inngest.ts:208`), `supply.completed` (supply.inngest.ts:207), `cashflow.completed` (cashflow.inngest.ts:665), `commentary.completed` (commentary.inngest.ts:254) — all four have zero Inngest consumers. Each writes to `audit_log` but no downstream cascade fires. |
| S3 | LayeredValue / provenance | PARTIAL | [LAUNCH] | Resolution order in code (`get-field-value.service.ts:45-54`): `override > computedValue > agent > storedResolved` (which bakes in `t12 > om > broker`). Internally consistent — user pin is highest, seeder market data lowest. CLAUDE.md states "broker > platform > user" — terminology gap (see §Doc-vs-Code); the code order is correct. DB: `year1` fields are NULL for all 3 sampled deals — most deals haven't been seeded. `derived_from_search:true` population not confirmed. |
| S4 | DealStore message bus | PARTIAL | [STRUCTURAL] | Hub tabs import their own inner tabs (`AssumptionsHubTab → AssumptionsTab`, `CapitalHubTab → DebtTab`, etc.) — these are parent→child compositions within the same domain, not cross-domain violations. 172 files import `useDealStore` — the bus IS used widely. `AssumptionsTab → LeasingAssumptionsTab` is a direct same-domain import (F9 leasing sub-tab). No verified cross-domain module import found (e.g., Projections importing from Returns directly). |
| S5 | Cache-stamp / freshness | PARTIAL | [LAUNCH] | **VIOLATION at `liveMlillageService.ts:190`:** comment reads "Leave stale cache in place if available, else return null" — silent serve-stale, no flag propagated. `federal.ruleset.ts:97` explicitly throws on missing rate sheet — WIRED for that path. `conflict-resolution.service.ts:133,140`: `logger.warn` on missing authority but no flag returned to caller. |
| S6 | Authoritative-signal fallback | PARTIAL | [LAUNCH] | `conflict-resolution.service.ts:134`: falls back to first available input when the authoritative module has no value — `logger.warn` is emitted but no `alertLevel` or provenance change is propagated. A downstream consumer sees the fallback value as if it were authoritative. `m07-projections-adapter.ts:54`: "Rows are still produced — no silent fallback to STABILIZED behavior" — correct for that path. |
| S7 | Property identity | PARTIAL | [STRUCTURAL] | Three independent `INSERT INTO properties` paths without cross-path deduplication: `deal-property-linker.service.ts:277` (`createPropertyFromDeal`), `email-property-automation.service.ts:189` (`createPropertyPin`), `document-extraction/data-router.ts:108`. The linker deduplicates `deal_properties` (ON CONFLICT), not `properties` itself. Chat and web-app paths can mint separate property rows for the same address. |
| S8 | Vendor market data | PARTIAL | [STRUCTURAL] | `historical_observations` carries `vendor_source`, `vendor_license_posture`, `redistribution_restricted` columns (migration confirmed). `document-to-corpus.ts:442` sets `redistribution_restricted: true` on corpus writes. `dataLibrary.service.ts:623,652,667,696` filters `redistribution_restricted = FALSE` at read points — WIRED for data library. Piece D (divergence-as-quality-signal): no code found emitting a quality signal from vendor divergence — ABSENT from this batch. |
| S9 | Third-party licensing scope (`scope_id`) | ABSENT | [LAUNCH] | `scope_id` column is absent from `metric_time_series`, `metric_correlations`, and `correlation_history` (confirmed by `information_schema.columns` query — see Live DB §1). No structural barrier exists between Lane-B / user-scoped data and the shared corpus. CoStar columns (`costar_submarket_rent`, `costar_submarket_vacancy`, etc.) land in `historical_observations` which has `redistribution_restricted` but no `scope_id`. |
| S10 | Data Library licensing | WIRED | [STRUCTURAL] | `redistribution_restricted` is read at every data-library query point (`dataLibrary.service.ts:623,652,667,696`). Flag is set on insert (`document-to-corpus.ts:442`). The restriction primitive is active for data-library reads. Its enforcement on shared-corpus aggregation (metric_time_series writes) is not verified because scope_id is absent (S9). |
| S11 | Correlation Engine | PARTIAL | [STRUCTURAL] | Reads from `metric_time_series` via real DB queries (`correlationEngine.service.ts:414-523`) — not seeded constants. Occupancy and rent-growth inputs come from `msas` and `historical_observations` tables, not from the correlation engine's own output tables. However, `market-metrics-aggregator.service.ts:258-281` reads `jedi_score` FROM `market_vitals` (its own persistent output) to compute historical trends and then re-persists — a soft circular path (stale stored score feeds trend that feeds next stored score). |
| S12 | Cross-surface field read | UNVERIFIED | [STRUCTURAL] | `get-field-value.service.ts` is the canonical resolver for the web app. The chat path (`unified-orchestrator.ts`, `agent-delegator.ts`, `buildRuntimeInput()`) does not import or call `getFieldValue` — agents read their own tool outputs. The same deal field can therefore resolve differently on chat vs. web depending on agent-layer vs. stored-resolved priority. No explicit evidence of divergence but also no shared resolver wiring. |

---

## Part 2 — Invariant Conformance

| Invariant | Status | Evidence |
|-----------|--------|----------|
| **I1** Derive-not-store | **VIOLATED** | `market-metrics-aggregator.service.ts:604`: `INSERT INTO market_vitals (jedi_score, ...)`. `jedi-score.service.ts:699`: `INSERT INTO jedi_score_history`. `market-intelligence.routes.ts:366,422,459`: `SELECT * FROM market_vitals` returns stored `jedi_score` as truth to clients. `market-metrics-aggregator.service.ts:258-273`: reads prior `jedi_score` from `market_vitals` to build trend arrays, then re-persists — stored output feeds next computation. |
| **I2** Version inputs not outputs | **UNVERIFIED** | `cashflow.postprocess.ts:1358-1369`: saves a version snapshot keyed to the agent run, gated on `agentWriteCount > 0`. The snapshot is the post-write `year1` state (the output), not a hash of the assumption inputs. `financial-models.routes.ts:416`: stores `results` and `claude_output` (outputs). No input-set hash found in the version key. Cannot confirm the versioning scheme keys on assumption inputs rather than stamping the output artifact. |
| **I3** No silent serve-stale | **VIOLATED** | `liveMlillageService.ts:190`: "Leave stale cache in place if available, else return null" — no flag or alert propagated. `conflict-resolution.service.ts:133-140`: `logger.warn` on missing authoritative value but no provenance change returned — caller receives fallback as if authoritative. |
| **I4** Δ_operator is input not residual | **UNVERIFIED** | `operatorStance.service.ts` uses 15 modulation rules applied to a baseline snapshot — the stance itself is user-supplied (operator sets `underwritingPosture`, `rateEnvironment`, etc.). No "Δ_operator" identifier found in the codebase. The F9 pro-forma Δ_operator concept from the spec does not appear to have a named implementation token — cannot confirm or deny from file:line evidence alone. |
| **I5** Deterministic math is not agent work | **PASS** | `compute_proforma.ts:65-129`: `execute()` runs real Newton's method IRR, NOI, debt service, exit proceeds — zero LLM calls. `cashflow.config.ts:34`: imports `computeProformaTool`. The LLM's role is to call the tool and interpret results; it does not perform arithmetic inline. |
| **I6** No `if (state === 'FL')` outside ruleset files | **VIOLATED** | Four violations outside `src/services/{tax,insurance}/rulesets/`: (1) `backend/src/services/proforma/layered-growth/opex-growth.ts:20` — "Florida structural overrides gated by `deal.state === 'FL'`"; (2) `backend/src/services/deterministic/proforma-assumptions-bridge.ts:221` — `const isFlorida = a.dealInfo.state?.toUpperCase() === 'FL'`; (3) `backend/src/services/valuation/valuation-grid.service.ts:2838,2850` — FL city/cap-rate branch; (4) `backend/src/services/lius/source-resolver.ts:413-414` — `condition.includes('FL') && ctx.state === 'FL'`. Two additional: `zoning-triangulation.routes.ts:338` (state normalization, likely acceptable); `zillow-zhvi-ingest.service.ts:62` / `zillow-zori-ingest.service.ts:62` (data filtering, arguable). |
| **I7** Web search is Tavily, fallback-only | **PASS** | `web_search.ts:5`: "Always use structured data tools first — web_search is a fallback." `web_search.ts:111`: tool description: "Use ONLY when structured data tools cannot answer." No non-Tavily web-search path found. |
| **I8** `dealStore` is sole message bus | **UNVERIFIED** | Hub→sub-tab imports are parent→child compositions (acceptable). 172 files use `useDealStore`/`dealStore`. No cross-domain lateral imports confirmed in this search pass. A full graph traversal (all F9 tab files checking for any import from a peer tab in a different domain) was not completed — cannot mark PASS with file:line evidence. |
| **I9** LayeredValue resolution order is uniform | **PARTIAL** | `get-field-value.service.ts:45-54`: resolution chain is `override > computedValue > agent > storedResolved (t12>om>broker)` — documented in-file and confirmed in code. CLAUDE.md states "broker > platform > user" — appears to describe the seeder's internal fallback direction, not the full resolution chain (terminology gap, not a logic inversion). `document-extraction/types.ts:578`: `resolvedFrom` type includes `'broker' | 'platform' | 'user' | 't12' | ...` — consistent across the codebase. Uniformity across all modules unverified at file:line level. |
| **I10** Lane B never reaches shared corpus | **UNENFORCEABLE** | `scope_id` is ABSENT from `metric_time_series`, `metric_correlations`, `correlation_history` (Live DB §1). The predicate cannot be mechanically checked or enforced until the column exists. Any Lane-B or CoStar-derived row written to these tables reaches the shared corpus unchecked. |
| **I11** Agent runs are candidates, not versions | **VIOLATED** | `cashflow.postprocess.ts:1363-1365`: version snapshot fires when `agentWriteCount > 0`. Gate is "at least one field was actually written" — not "resolved year-1 assumptions materially changed." Any routine cashflow agent re-run that writes at least one field mints a version. No material-change delta check found in this block. |
| **I12** Tri-tab reconciliation | **UNVERIFIED** | `m07-projections-adapter.ts:537`: linear ramp logic exists for occupancy (pre-CO → lease-up → stabilized). `proforma-assumptions-bridge.ts:237-239`: reads `stabilizedOccupancy` directly. No evidence of a single shared `ramp(t)` function imported by ProForma, Projections, and Assumptions tabs — the ramp logic appears locally implemented in each service. Cannot confirm single-source-of-truth ramp without a full call-graph trace. |
| **I13** Stabilization resolved once | **UNVERIFIED** | `p2-service-adapters.ts:202`: `executeFormula('F29', {...})` computes lease velocity. No evidence this result is cached and shared to both ProForma and Projections without recomputation — `proforma-assumptions-bridge.ts` does its own stabilization math independently. A second independent computation downstream would be a violation but is unconfirmed without a complete call trace. |

---

## Launch-Blocking Shortlist

These are every **[LAUNCH]** subsystem that is not WIRED, and every VIOLATED invariant under the
revenue chain. **Fix or accept before declaring the platform revenue-ready.**

| Priority | Item | Where | Impact |
|----------|------|--------|--------|
| P0 | **S9 ABSENT — no scope_id gate** | `metric_time_series`, `metric_correlations`, `correlation_history` schema | Every user-licensed or CoStar row that reaches these tables silently enters the shared corpus. Licensing exposure is structural, not operational. |
| P1 | **I10 UNENFORCEABLE** | Downstream of S9 | Lane-B → GLOBAL leak cannot be checked until scope_id exists. The invariant has no floor. |
| P1 | **S2 PARTIAL — four completed events fire into void** | `zoning.inngest.ts:208`, `supply.inngest.ts:207`, `cashflow.inngest.ts:665`, `commentary.inngest.ts:254` | Whatever downstream cascade was intended (e.g., UI readiness signals, secondary triggers, cross-agent handoffs) never fires after these four agents complete via the Inngest path. |
| P1 | **S1 PARTIAL — agent_run_id null for 1272/1273 audit rows** | `request_walkthrough_narrative.ts:53-54` | The walkthrough audit path (`cashflow.walkthrough_requested`, `cashflow.walkthrough_completed`) owns 99.9% of agent audit volume and writes no run_id. Agent attribution is effectively absent for those rows — if a walkthrough agent damages data, there is no audit linkage. |
| P2 | **I3 VIOLATED — silent stale tax millage** | `liveMlillageService.ts:190` | A deal's tax liability can be silently computed on stale millage data with no badge or alert to the user. |
| P2 | **I11 VIOLATED — agent re-run mints version** | `cashflow.postprocess.ts:1363-1365` | Routine cashflow agent re-runs inflate the version history for every field write. The version panel becomes noise; the "material change" semantics of versioning are broken. |
| P3 | **I1 VIOLATED — jedi_score persisted and re-read as truth** | `market-metrics-aggregator.service.ts:604`, `market-intelligence.routes.ts:366` | The stored score can drift from the live-derived score between aggregation runs. Clients reading `market_vitals.jedi_score` see a snapshot, not a derived value. |
| P3 | **I6 VIOLATED — FL hardcoding in 4 non-ruleset files** | `opex-growth.ts:20`, `proforma-assumptions-bridge.ts:221`, `valuation-grid.service.ts:2838,2850`, `source-resolver.ts:413-414` | Adding a second jurisdiction with similar rules requires hunting 4+ non-ruleset files. Each is a fork that won't pick up ruleset updates. |
| P3 | **S5 PARTIAL — silent stale fallback in cache layer** | `liveMlillageService.ts:190`; `conflict-resolution.service.ts:134` | Two separate serve-stale paths with no provenance flag. |

---

## Licensing Exposure Paragraph

Today there is **no structural barrier** preventing Lane-B (user-licensed, deal-scoped) data or
CoStar-derived rows from reaching the shared corpus. The `scope_id` column that would enforce the
two-lane model does not exist on `metric_time_series`, `metric_correlations`, or
`correlation_history` — confirmed by a live schema query. `historical_observations` carries
`redistribution_restricted` and `vendor_license_posture` at the row level, and `dataLibrary.service.ts`
correctly filters on `redistribution_restricted = FALSE` at read time. That is the only active
gate. But the correlation and metric-time-series tables — the shared analytical corpus — have
no equivalent gate. Any pipeline or agent that writes user-sourced or CoStar-sourced observations
into `metric_time_series` bypasses all licensing controls. Until `scope_id` is added to those
tables and all writers set it, every shared-corpus computation (correlations, benchmarks, market
vitals) is potentially contaminated with data that may not be redistributable.

---

## Live-DB Section

### Query 1 — `scope_id` presence on corpus tables

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name IN ('metric_time_series','metric_correlations','correlation_history')
ORDER BY table_name, ordinal_position;
```

**Result:**

`metric_time_series` columns: `id, metric_id, geography_type, geography_id, geography_name, period_date, period_type, value, source, confidence, created_at`

`metric_correlations` columns: `id, metric_a, metric_b, geography_type, geography_id, window_months, correlation_r, lead_lag_months, p_value, sample_size, computed_at, observation_start, observation_end`

`correlation_history` columns: `id, metric_a, metric_b, geography_type, geography_id, window_months, computed_at, computed_date, correlation_r, p_value, sample_size, observation_start, observation_end, created_at`

**`scope_id` is ABSENT from all three tables.** No column by that name on any corpus table.

---

### Query 2 — Inngest function registration and event liveness

Registered Inngest functions (from `index.replit.ts:237-254`, all 14 confirmed):

| Function | Trigger event |
|----------|---------------|
| `researchOnDealCreated` | `deal.created` |
| `zoningOnDealCreated` | `deal.created` |
| `supplyOnDealCreated` | `deal.created` |
| Cashflow on deal | `deal.created` |
| Cashflow on research | `research.completed` |
| Cashflow walkthrough | `cashflow.walkthrough_requested` |
| `commentaryOnResearchCompleted` | `research.completed` |
| `archiveAggregationFunction` | (cron) |
| `emailIntakeFunction` | (email/gmail trigger) |
| `captureMonthlySnapshotsFunction` | (cron) |
| `syncMartaGtfsFunction` | (cron) |
| `syncOsmPoisFunction` | (cron) |
| `syncAtlantaPdCrimeFunction` | (cron) |
| `snapshotSentimentDaily` | (cron) |
| `rateSheetStalenessCron` | (cron) |
| `taxBillUploadedHandler` | `TAX_BILL_UPLOADED_EVENT` |

**Events published with no registered consumer:**

| Published event | Publisher | Consumer | Status |
|-----------------|-----------|----------|--------|
| `zoning.completed` | `zoning.inngest.ts:208` | none | ORPHANED |
| `supply.completed` | `supply.inngest.ts:207` | none | ORPHANED |
| `cashflow.completed` | `cashflow.inngest.ts:665` | none | ORPHANED |
| `commentary.completed` | `commentary.inngest.ts:254` | none | ORPHANED |

---

### Query 3 — LayeredValue field population (sampled deals)

```sql
SELECT deal_id,
  year1->'vacancy_rate' as vac,
  year1->'gpr_per_unit' as gpr,
  year1->'opex_per_unit' as opex
FROM deal_assumptions WHERE year1 IS NOT NULL LIMIT 3;
```

```
deal_id                               | vac  | gpr  | opex
--------------------------------------+------+------+------
1daab29b-e586-41bc-9338-eba72f202abd  | null | null | null
6d047c45-6851-4fbf-8369-e378de6c0f1d  | null | null | null
f1c6909a-a133-4ddf-8c11-d0069e187034  | null | null | null
```

`year1` JSON is present but individual field keys are null for all sampled rows — the seeder
has not populated the LayeredValue wrapper fields for these deals. The resolution chain exists
in code but its inputs are absent from the DB for most deals.

---

### Query 4 — `audit_log` actor_type and agent_run_id distribution

```sql
SELECT actor_type, action, agent_run_id IS NOT NULL as has_run_id, count(*)
FROM audit_log WHERE actor_type = 'agent'
GROUP BY 1, 2, 3 ORDER BY 4 DESC;
```

```
actor_type | action                       | has_run_id | count
-----------+------------------------------+------------+-------
agent      | cashflow.walkthrough_requested| false      |   707
agent      | cashflow.walkthrough_completed| false      |   565
agent      | cashflow.completed           | true       |     1
```

1272 of 1273 agent audit rows have `agent_run_id = NULL`. Only 1 row (a single
`cashflow.completed` action) carries a non-null run_id. The `request_walkthrough_narrative.ts`
tool writes its own audit rows (`INSERT INTO audit_log ... actor_type, action, resource_type,
resource_id, metadata` at line 54) — it does not include the `agent_run_id` column in that
INSERT. `AgentRuntime.ts:655` correctly sets `agent_run_id: run.id` in the runtime path but
that path accounts for only 1 audit row total.

---

## Doc-vs-Code Gaps

| Gap | Spec / doc claim | Code reality |
|-----|------------------|--------------|
| LayeredValue resolution order | CLAUDE.md: "broker > platform > user" | `get-field-value.service.ts:45`: `override (user) > computedValue > agent > storedResolved (t12>om>broker)`. User pin is highest, broker lowest — correct semantics, wrong/inverted notation in doc. |
| Δ_operator identifier | F9 proforma spec mentions Δ_operator as a named concept | No `delta_operator`, `deltaOperator`, or `Δ_operator` token found anywhere in the backend codebase. Possibly a spec concept not yet implemented. |
| `scope_id` two-lane model | `CORRELATION_TERMINAL_SCOPE_SPEC.md` (referenced in §D as "NEW — not yet in repo") | Confirmed absent from all three corpus table schemas. |
| `leasing_cost_treatment.changed → F9 re-render` | `LEASE_VELOCITY_ENGINE_SPEC.md §5` describes this cascade | No `leasing_cost_treatment.changed` event found in any Inngest function trigger or `inngest.send()` call. The cascade appears spec-only. |
