## Agent Platform Architecture

> Full spec: `attached_assets/Pasted--JEDI-RE-Agent-Platform-Specification-In-platform-agent_1776612030506.txt`
> Taxonomy: `attached_assets/Pasted--JEDI-RE-Agent-Taxonomy-Layers-Addendum-to-AGENT-PLATFO_1776612009027.txt`

### Three-Layer System

The platform has three distinct layers. Only Layer 1 is an "agent" in the runtime sense.

```
User message
     ↓
COORDINATOR (runs in user session, no service account)
  1. Intent classifier  → one of 10 Routing Specialists (Layer 2)
  2. Persona selector   → one of 16 Analyst Personas (Layer 3)
  3. Dispatch decision  → Agent (Layer 1)? General LLM? Both?
     ↓                           ↓
LAYER 1 — AGENTS          GENERAL LLM HANDLER
(AgentRuntime)             (persona-flavored reply)
Research, Zoning,          Used when no dedicated agent
Supply, CashFlow,          handles that routing specialist
Commentary
     ↓
Platform API (RBAC + audit)
     ↓
Postgres (domain tables, agent writes wrapped in LayeredValue<T>)
```

**Corrected count: 5 agents, 10 intent categories, 16 personas — composed at runtime.**
The composition gives expressive range of many response shapes without 20+ agent maintenance cost.

### Layer 1 — Agents (5 total)

Each has: service account, capability list, versioned prompt in `prompt_versions`, typed tool registry, `BudgetEnforcer`, and run tracking in `agent_runs` + `agent_run_steps`.

| Agent ID | Primary Output | Service Account ID |
|----------|---------------|-------------------|
| `research` | `deal_context` | `00000000-0000-0000-0000-000000000001` |
| `zoning` | `zoning_analysis` | `00000000-0000-0000-0000-000000000002` |
| `supply` | `supply_analysis` | `00000000-0000-0000-0000-000000000003` |
| `cashflow` | `cashflow_projection` | `00000000-0000-0000-0000-000000000004` |
| `commentary` | `market_commentary` | `00000000-0000-0000-0000-000000000005` |

### Layer 2 — Routing Specialists (10 intent labels)

Not agents. The Coordinator's intent classifier maps each message to one of these:

- `SUPPLY`, `CASH`, `ZONING`, `RESEARCH` → dispatch to Layer 1 agent
- `DEMAND`, `COMPS`, `RISK`, `DEBT`, `NEWS`, `STRATEGY` → general LLM handler with context fragment

**Do not preemptively build agents for DEMAND, COMPS, RISK, DEBT, NEWS, STRATEGY.**
Graduation criteria (all three must hold): ≥5% of dispatches over 30 days, structured output needed, tool use would materially improve answers.

### Layer 3 — Analyst Personas (16 prompt variants)

System prompt variants on the Coordinator. Change voice/emphasis, not what data is fetched.
CFO, ACCOUNTANT, MARKETING, DEVELOPER, LEGAL, LENDER, ACQUISITIONS, ASSET_MANAGER, PROPERTY_MANAGER, LEASING, FACILITIES, INVESTMENT_ANALYST, ESG, COMPLIANCE, TAX, RESEARCHER.

### Reclassified (NOT agents)

| Name | Where it lives | Why not an agent |
|------|---------------|-----------------|
| `MetricRecommendation` | `src/services/metricRecommendation.service.ts` | No tool loop, no multi-step reasoning — pure retrieval + ranking |
| `AgentOrchestrator` | `src/inngest/` + `src/coordinator/dispatch.ts` | This is the runtime layer itself, not an agent |

### Key Architectural Constraints

1. **Dogfooding.** Agents call the platform API (same API humans use). No private DB backdoor.
2. **One exception:** `write_dealcontext` may write directly to the DealContext service for cache efficiency. This is the ONLY documented exception. Do not expand it.
3. **No parallel storage.** Agent outputs land in existing domain tables via `LayeredValue<T>` with `source: 'agent:*'` tags.
4. **Budget caps are non-optional.** Every agent run enforces per-run, per-deal-per-day caps via `BudgetEnforcer`.
5. **Prompts must be versioned.** No inline prompt strings in agent code. Load from `prompt_versions` table at runtime.
6. **Output schema validation is non-optional.** Unvalidated agent output poisons the DealContext cache.
7. **No agent-to-agent direct calls.** Agents hand off via Inngest events, never via function calls.

### LayeredValue Merge Order

```
platform < agent:* < t12/rent_roll/tax_bill < override (user edit)
```
User edits always win. Agent-written values remain in history and can be recalled.

---

## Scheduled Inngest Jobs

All Inngest functions are registered in `backend/src/index.replit.ts` inside the `serve()` call.
Function files live in `backend/src/inngest/functions/`.

| Function ID | File | Schedule | Purpose |
|-------------|------|----------|---------|
| `traffic-calibration-weekly` | `trafficCalibrationCron.ts` | Monday 02:00 UTC (`0 2 * * 1`) | M07 Bayesian calibration — updates `traffic_calibration_factors` platform posteriors. lookbackHours=168. Resolves TE-02, TE-08 (TRAFFIC_ENGINE_STATE_AUDIT.md §11 Fix #1). |
| `rate-sheet-staleness-check` | `rateSheetStaleness.cron.ts` | Sunday 03:00 UTC (`0 3 * * 0`) | Tax Service Phase 4 — flags expiring `rate_sheet_versions` rows for Research Agent re-verification. |
| `data-corpus-reminder` | `dataCorpusReminderCron.ts` | 1st/2nd/3rd of month 12:00 UTC | Historical Observations Phase 3 — first-business-day guard; emits `deal_notifications` for missing monthly uploads, T+12 realization windows, and gap comparisons. |
| `historical-observations-backfill` | `historicalObservationsBackfill.ts` | On-demand / one-shot | Backfills `historical_observations` from existing rent roll snapshots. |
| `snapshot-sentiment-daily` | `snapshot-sentiment.function.ts` | Daily | Captures daily market sentiment snapshots. |
| `capture-monthly-snapshots` | `capture-monthly-snapshots.ts` | Monthly | Market data monthly snapshot capture. |
| `sync-marta-gtfs` | `sync-marta-gtfs.ts` | Scheduled | MARTA GTFS transit data sync. |
| `sync-osm-pois` | `sync-osm-pois.ts` | Scheduled | OSM points-of-interest sync. |
| `sync-atlanta-pd-crime` | `sync-atlanta-pd-crime.ts` | Scheduled | Atlanta PD crime data sync. |

---

## M07 Traffic Engine — Current State (F6 Traffic Module)

### Shipped

F6 Traffic Module is live with the following surfaces. Reference spec: `TRAFFIC_ENGINE_CALIBRATION_SPEC.md`.

- **Tab order:** PREDICTIONS | COEFFICIENTS | COMP GRID | DATA SOURCES | VISIBILITY | CALIBRATION | ABSORPTION
- **Predictions tab.** Mode-aware panels:
  - STABILIZED: expiration waterfall + delta-to-94% KPI
  - LEASE-UP: P25/median/P75 absorption curve + seasonality note
  - REDEVELOPMENT: phased occupancy curve + premium capture rate KPI
  - All panels use shared Bloomberg tokens from `bloomberg-ui`
- **Coefficients tab.** Three-column BASELINE / PLATFORM / THIS DEAL table per `LayeredValue<T>` pattern. >1.5σ collision warnings surface divergence.
- **Comp Grid.** Bloomberg dark table — sortable columns, subject row highlighting, source badges, averages footer, filter bar, CSV export.
- **Calibration tab.** Match tier / window / peer count info strip, per-coefficient 95% confidence band sliders, rent-roll upload drop-zone with last-upload timestamp and extraction confidence display.

### Open items (carry into next sprint)

**1. Predictions confidence bands are heuristic.** Currently using symmetric ±8/15/25%. Spec (Section 1.5) calls for full distribution output `{p10, p25, median, p75, p90}` — asymmetric bands because right-tail uncertainty on lease-up absorption is wider than left-tail. When the backend endpoint ships percentile payload, switch frontend from `± multiplier` to true percentile rendering. Not just a number-confirmation task.

**2. `sampleCount` vs `nPeerProperties` — both must exist.** These are different dimensions of calibration confidence:
   - `nPeerProperties` = distinct properties in peer bucket (`calibration_source` per spec Section 4.2)
   - `sampleCount` = total lease observations across those properties (drives Bayesian α_platform per spec Section 3.2)

   A 12-property × 200-unit submarket ≠ 12-property × 30-unit submarket for confidence purposes. Do not let the backend collapse these into one field. If current contract returns only one, push back.

**3. Comp filter input types — audit field-by-field.**
   - **Categorical** (submarket, class, vintage band, unit type) → should be dropdowns. Closed set of valid values; text input allows typos that return no matches.
   - **Range** (rent, SF, occupancy, year built) → numeric min/max inputs are correct.
   - Current state: all numeric. Switch the categorical ones.

**4. Collision warning σ source — verify, not assumed.** The >1.5σ flag on Coefficients tab must compute σ from the platform peer distribution passed in the payload, not from a backend-provided static threshold. Users will ask "why is this flagged?" — the answer needs to be "your walk-in conversion is 2.1σ above the 47-property peer median," not "the number was high." Confirm peer distribution ships in the Coefficients payload, not just a precomputed threshold.

### Next workstream — M35 Event Impact Engine integration

Traffic Engine needs to consume from M35 Event Impact Engine to avoid three failure modes:

- **Event-adjusted baselines.** Hurricane/disaster/rent-cap-legislation periods must be excluded or attributed before the nightly calibration job writes to `traffic_calibration_factors`. Without this, one-time events permanently poison seasonality curves.
- **Anomaly attribution in calibration.** Signing velocity spikes need event-cross-reference to distinguish genuine coefficient updates from temporary event-driven surges.
- **Forward trajectory signal (T-07).** Announced-but-not-yet-opened events (new employer, hospital, transit) are 6–18 month lead signals. Add `event_pipeline` to T-07 weighted sum alongside search momentum and business formation velocity.
- **Lease-Up playbook application.** M35's predictive playbook library and proximity decay apply directly to absorption curve adjustment for Development deals in an event's cascade radius.

**Integration pattern:**
- `trafficCalibrationJob.ts` subscribes to M35 Kafka event stream
- `trafficPredictionEngine.ts` calls `m35.getActiveEvents(submarket, radius, window)` during prediction
- Do not duplicate event attribution logic in M07 — M35 owns attribution; traffic consumes results

**Spec addition needed:** `TRAFFIC_ENGINE_CALIBRATION_SPEC.md` Section 2.3 "Event-aware calibration" — to be drafted before M35 integration session is scoped.

### M07 Subject-First Calibration Rule

**Every deal's own rent roll history is promoted above the peer set in the coefficient resolution hierarchy.**  The four-layer stack in `CoefficientResolverService.resolveForDeal()` is now:

```
SUBJECT (subject_traffic_history ≥S1)
  → DEAL (derived_metrics on latest rent_roll_snapshots row)
    → PLATFORM (traffic_calibration_factors submarket/class/vintage bucket)
      → BASELINE (hard-coded constants in trafficCalibrationJob.ts)
```

**Bayesian blend formula (SUBJECT layer):**

```
w_subject = min(1.0,  n_observations / n_required)
effective  = w_subject × subject_value + (1 − w_subject) × peer_value
```

`n_required` thresholds are defined in `SUBJECT_N_REQUIRED` in `traffic-calibration.types.ts`.  A coefficient starts at weight 0.0 (peer-only) and asymptotically reaches 1.0 (full subject authority) as observations accumulate.  The blend is linear between those extremes.

**Tier promotion rules:**

| Tier | Trigger | Data available |
|------|---------|---------------|
| S1 | First rent roll uploaded | current_state (occ, L2L, signing velocity, expiration waterfall) |
| S2 | ≥2 snapshots ≥60 days apart | S1 + observed_dynamics (renewal rate, turnover, trade-outs, days vacant, concession trend) |
| S3/S4 | Future (data model in place; aggregation logic deferred) | — |

**Peer collision detection:**  When `|subject_value − peer_value| > 1.5σ` (using σ ≈ 15 % of peer value as a conservative prior), the pair is logged in `subject_traffic_history.peer_collisions` and surfaced on the Coefficients tab.  Do not suppress collisions — they are signals, not errors.

**Implementation files:**
- DB: `20260503_018_m07_subject_history.sql` — `rent_roll_snapshots` extension + `rent_roll_diffs` + `subject_traffic_history`
- Types: `traffic-calibration.types.ts` — `MatchTier` 'SUBJECT', `SubjectTrafficHistory`, `SUBJECT_N_REQUIRED`
- S1 aggregator: `services/rent-roll/subject-history-s1.service.ts`
- Diff extractor + S2: `services/rent-roll/rent-roll-diff.service.ts`
- Resolver: `services/coefficient-resolver.service.ts` — Bayesian blend loop
- Routes: `api/rest/m07-calibration.routes.ts` — wires S1/S2 after every upload
- Frontend: `SourceBadge` (`subject_history:s1/s2/s3/s4` entries), `ProjectionsTab` (`SubjectHistoryPanel`)

**Rule:** Never merge a change that moves subject coefficients below the peer set in the resolver loop, degrades tier (S2 → S1), or removes peer collision logging.  The subject layer is the highest-fidelity signal available; silencing it defeats the M07 calibration contract.

---

## Pro Forma Schema-Change Rule (7-Ring Checklist)

Any add/delete of a Pro Forma or Projections line item is a cross-cutting change. It must update: (1) F9 tabs, (2) backend types + DealContext + dealStore, (3) parsers if document-sourced, (4) downstream module consumers via dealStore, (5) agent logic, (6) Excel export, (7) archive backfill plan. Never ship a partial propagation.

A new field that appears in the UI but is absent from the projection engine, Excel export, AI commentary, or M36 covariance matrix is a silent correctness bug. The checklist exists to eliminate that class of error at the point of authorship, not post-review.

### 7-Ring Table

| Ring | Surface | What must be checked / updated |
|------|---------|-------------------------------|
| 0 | **Database schema** | Add/remove column or JSONB key. Write migration. Update seed data if field has a known default. |
| 1 | **F9 Tabs (frontend)** | AssumptionsTab STATIC_ROWS (new row def, patchField, getBroker/getPlatform). SensitivityTab axis candidates. CompareTab COMPARE_FIELDS. ProjectionsTab display columns. |
| 2 | **Backend types + DealContext + dealStore** | `DealFinancials` type, `DealContext` shape, `dealStore` selectors/transformers. All TS interfaces that carry the field across the wire. |
| 3 | **Document parsers** *(Section A only)* | T12 parser, rent-roll parser, tax-bill parser, cross-validation service, ProForma seeder. Only required when the new field is document-sourced (Section A). Section B additions skip Ring 3 entirely. |
| 4 | **Downstream module consumers** | Any module that reads the field from dealStore: underwriting engine, DSCR calculator, returns engine, sensitivity engine, risk-flag evaluators. Update each consumer or explicitly document the dependency as out-of-scope. |
| 5 | **Agent logic** | CashFlow Agent prompt + tool schema. Commentary Agent context fragment. Any agent that references Pro Forma rows by name or field key must be updated so it neither hallucinates absent fields nor ignores newly added ones. |
| 6 | **Excel export** | `buildProjectionsSheet` row map, Pro Forma sheet row index constants, CFBT formula, Assumptions sheet Section A/B blocks. Every field visible in the UI must appear in the exported workbook with matching formula references. |
| 7 | **Archive backfill plan** | Determine whether historical deal records need a migration or default value for the new field. Document the decision (backfill / default-null / not-applicable) in the PR. M36 covariance matrix must be re-seeded if the field is a covariance driver. |

### Three Change Shapes

Different change shapes have different blast radii. Identify the shape before beginning work.

| Shape | Description | Blast radius |
|-------|-------------|--------------|
| **Row add / delete** | A new line item appears in (or is removed from) the Pro Forma / Projections operating statement. | Largest. All 7 rings must be evaluated. A deleted row must be tombstoned in parsers, removed from agent prompts, and its Excel column zeroed or removed. |
| **Column add / delete** | A new projection year is added or a hold-period column is removed (e.g., extending from 10yr to 12yr hold). | Medium. Primarily timeline plumbing: projection engine loop bounds, Excel column range formulas, frontend year-column rendering, and archive year-index assumptions. Rings 3 and 5 are usually unaffected. |
| **Tier reclassification** | An existing field moves between Section A and Section B (or between operating / below-the-line). | Behavioral, not schema. The field's recalculation path changes — Y1 may start or stop being affected. Rings 0 and 3 are usually unaffected, but Rings 1, 2, 4, and 6 all need the new propagation path. |

### Section A vs Section B Decision Point

Every Pro Forma field must be explicitly assigned to Section A or Section B at the time it is added. The assignment determines which rings must be updated.

**Section A — Base Year (document-sourced)**
- Source: T12, rent roll, tax bill, OM, broker data.
- Flows through: Pro Forma Y1 → Projections Y2+.
- Editing a Section A field recomputes Pro Forma Y1 AND cascades through all projection years.
- Requires Ring 3 (parser) updates.
- UI placement: Section A block in AssumptionsTab.

**Section B — Trajectory (platform / agent / user-entered)**
- Source: JEDI platform model, CashFlow Agent output, analyst override.
- Affects: Projections Y2+ only. Pro Forma (Year 1) is never modified by a Section B edit.
- Editing a Section B field leaves Pro Forma Y1 unchanged; only Y2+ projections move.
- Ring 3 (parser) updates are **not required** — these inputs are never parsed from documents.
- UI placement: Section B block in AssumptionsTab, with "Y2+ ONLY" badge.

**When in doubt:** if the value can appear on a T12, rent roll, or tax bill, it belongs in Section A. If it is a growth rate, a trajectory assumption, or an exit parameter, it belongs in Section B.

---

## M07 Subject-First Calibration

> Full implementation: `backend/src/services/rent-roll/`, `backend/src/services/coefficient-resolver.service.ts`
> Types: `backend/src/types/traffic-calibration.types.ts`
> DB: `subject_traffic_history`, `rent_roll_diffs`, `rent_roll_snapshots` (extended)

### SUBJECT-FIRST Rule

The M07 coefficient resolver uses a **subject-first** Bayesian hierarchy for all traffic conversion coefficients:

```
SUBJECT (w >= 0.5) → tier SUBJECT (subject dominates)
SUBJECT (0 < w < 0.5) → tier PLATFORM (peer dominates; blend still applied)
w = 0 or no subject → PLATFORM → BASELINE
```

**The DEAL proxy layer is intentionally excluded.** The pre-M07 binary deal-first lookup is replaced by Bayesian subject-vs-peer blending against the platform posterior.

### Evidence Tiers

| Tier | Trigger | Data Available |
|------|---------|----------------|
| S1 | First rent roll upload | `current_state`: occupancy, LTL, concessions, signing velocity |
| S2 | ≥2 snapshots ≥60 days apart | + `observed_dynamics`: renewal_rate, turnover, trade-outs, vacancy days, concession_trend |
| S3 | Future: ≥6-month span | Extended longitudinal |
| S4 | Future: ≥12-month span | Full longitudinal |

### Bayesian Blend Formula

```
w_subject = min(1, n_obs / n_required)
resolved  = w × subject_value + (1 − w) × platform_peer_posterior
```

`n_required` thresholds are defined in `SUBJECT_N_REQUIRED` in `traffic-calibration.types.ts`.
Tier SUBJECT is reported only when `w >= 0.5` (subject dominates); below that, PLATFORM is reported.

### N_REQUIRED Thresholds (key coefficients)

| Metric | n_required | Source tier |
|--------|-----------|-------------|
| `loss_to_lease` | 4 | S1 (single snapshot) |
| `signing_velocity` | 8 | S1 |
| `renewal_rate` | 12 | S2 |
| `days_vacant_median` | 8 | S2 |
| `concession_trend` | 3 | S2 diff periods |

### Coefficient → Metric Mapping

| Traffic Coefficient | Subject History Metric |
|--------------------|----------------------|
| `walkin_to_tour` | `signing_velocity` |
| `stop_probability` | `days_vacant_median` |
| `app_to_signed` | `renewal_rate` |
| `apartment_seeker_pct` | `concession_trend` → `loss_to_lease` (S1 fallback) |

### Pipeline Trigger (rent roll upload)

Every `POST /api/v1/calibration/rent-roll/upload` runs:
1. Parse + store (`parsed_payload`, `unit_count`, `occupied_count`, `parser_source` on snapshot)
2. Run derivations (`derived_metrics` JSONB)
3. **S1 aggregation** — always (non-fatal if fails)
4. **S2 diff extraction** — only when a prior snapshot exists AND `period_days >= 60`

### Key Files

- `rent-roll-parser.service.ts` — Step 1: parse → `parsed_payload` + columns
- `rent-roll-derivations.service.ts` — Step 2: derive → `derived_metrics`
- `subject-history-s1.service.ts` — Step 3: S1 current-state → `subject_traffic_history`
- `rent-roll-diff.service.ts` — Step 4: S2 dynamics → `rent_roll_diffs` + promote to S2
- `coefficient-resolver.service.ts` — Bayesian subject-vs-peer blend at resolution time

### Collision Detection

Peer collision: when `|subject_value − peer_posterior| / (peer_posterior × 0.15) > 1.5σ`.
Stored in `subject_traffic_history.peer_collisions[]` at S2 promotion.
Exposed in `/api/v1/calibration/coefficients/:dealId` response via `meta.subject_history.peer_collisions`.

### Frontend Integration (F9 ProjectionsTab)

`SubjectHistoryPanel` renders when `f9Financials.subjectHistory != null`.
Toggle button: `SUBJ·{tier}` in teal — uses `SUBJ_TEAL = '#2DD4BF'` color.
`F9SubjectHistory` type is in `frontend/src/pages/development/financial-engine/types.ts`.
`SourceBadge` supports `subject_history:s1|s2|s3|s4` via `LayeredValueSource` union.

---

## Standing Principles (Phase 8, Task #1041)

These apply to all future agents working on this codebase.

### P1 — Single Canonical DQ Formula
The server is the ONLY place DQ is computed. `recalculateDQScore()` runs after every write that could affect DQ fields. Clients never compute DQ and never include `data_quality_score` in PATCH payloads. The client-side `calculateDQScore()` function in the modal is a display-only preview; it does NOT write to the DB.

### P2 — Threshold Recalibration Is a Separate Explicit Change
Any change to DQ gate thresholds (`>= 50`, `>= 40`, etc.) requires: (a) document the before-state with exact counts, (b) propose specific new values with rationale, (c) get explicit approval before applying. Never silently slide a threshold.

### P3 — Apply/Discard Is the Default for Enrichment
All automated enrichment writes go to `layers.pending_web` first. The `resolved` field is only updated when the operator explicitly clicks APPLY. The `PHASE8_COLS` constant in `archive-properties.routes.ts` must be kept in sync with any new enrichment fields added to `property_descriptions`.

### P4 — Schema Errors Must Surface
Never swallow DB errors with `.catch(logger.warn)` or silent fallbacks in enrichment/recalculation paths. If a column doesn't exist, the error should propagate and fail loudly. Silent swallowing hides schema drift (e.g., `deal_type` vs `data_type` bug found in Phase 8).

### P5 — Stale-Reference Sweep Before Changing Field Semantics
Before changing the name, type, or meaning of any field used by a data pipeline, grep every reader across backend + frontend. Document the full reader list in the PR or dispatch. Phase 8 example: `data_quality_score` readers audited in the closing doc before removing the client write path.

### P6 — Paired-Read Verification Before Marking Complete
After any data pipeline change, explicitly verify that (a) the writer produces the correct value, (b) every downstream reader receives and interprets the new value correctly, and (c) no reader has a stale cached copy. Record the verification in the closing doc.

### P7 — Two-Layer Model: LLM Reasons, Deterministic Functions Calculate
All proforma and financial engine work is split into exactly two layers:

- **Layer 1 — Calculations:** Deterministic math only. NOI, EGI, IRR, DSCR, equity multiple, exit value, sensitivity grids, cash flows. No LLM involvement. Given the same inputs, always produces the same outputs. Implemented as pure TypeScript functions.
- **Layer 2 — Assumptions:** Values the LLM reasons about and operators can override. Rent per unit type, vacancy %, OpEx line items, growth rates, exit cap rate, debt terms, hold period. Stored as `LayeredValue<T>` with provenance. The LLM proposes; the operator confirms; Layer 1 then calculates.

**Standing rule:** never put arithmetic inside an LLM prompt, and never let an LLM output a value that should be the result of a formula. Phase 2 derivation logic (generating / refining assumption values) applies only to `layer: 'assumption'` entries. `layer: 'calculated_output'` entries are never sent to the LLM for derivation — they are always computed from their upstream assumptions.
