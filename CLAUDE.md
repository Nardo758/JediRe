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

### P8 — Verify Before Queueing

When a dispatch produces a closing note that informs the scope of subsequent work, that closing note must be verified before downstream dispatches fire.

**Verification steps:**
1. Confirm the document exists at the expected path and is complete per its dispatch spec
2. Spot-check 3–5 source citations against the actual codebase
3. Verify cross-fix integration sections are substantive (not placeholder)
4. Classify open questions as BLOCKING / IMPORTANT / INFORMATIONAL
5. Identify gaps — what the investigation should have covered but didn't

**Output:** Append a verification section to the original investigation file. Verdict must be one of: `APPROVED FOR DOWNSTREAM WORK` / `NEEDS AMENDMENT` / `NEEDS REWORK`.

**Corollary — State Verification:** Before drafting any dispatch that builds on prior work, verify the current codebase state. Check:
1. The file the prior dispatch was supposed to create or modify actually exists at the expected path
2. The principle, rule, or section the prior dispatch was supposed to add is present in that file
3. The feature or behavior the prior dispatch was supposed to implement is present in the running code
4. The closing note the prior dispatch was supposed to produce exists and is substantive

All four checks must pass before the dispatch fires. If any check fails, treat it as a `NEEDS REWORK` finding and surface it before proceeding.

**Rationale:** Investigations produce documents that subsequent dispatches treat as authoritative. If an investigation has incomplete citations, missing cross-fix integration, or unaddressed gaps, downstream dispatches inherit those problems. Verification catches issues before propagation. Dispatches drafted on the assumption that prior decisions have already been implemented can queue work that is already done — or worse, build on top of work that was never completed.

A related failure mode: dispatches that were drafted but never fired can be confused with dispatches that landed. "The closing note doesn't exist" is a valid verification finding — it stops downstream work from building on a phantom document.

**DO NOT:**
- Skip verification for "small" investigations — small ones produce small documents but their findings propagate just as much
- Verify your own work as the sole check — the agent verifying its own output is a known confirmation-bias risk; operator review of the verification is required
- Treat parallel firing as acceptable for dependency-linked work — sequential firing is the default for investigation → implementation chains; parallel only when work is genuinely independent
- Skip current-state verification because "we just decided this in the prior session"

### P9 — Phase 2 Batch Integrity

Phase 2 batches produce canonical derivation logic for proforma assumptions. Two requirements apply to every batch:

**A. AGENT PROMPT ALIGNMENT**
Each batch's canonical rules must align with the agent's operational prompts in the same dispatch. If a batch establishes a rule (e.g., reserves are tiered by age), the agent's system prompt or tool descriptions referencing that rule must update in the same dispatch.

Verification step (per P8): when verifying a batch dispatch's closing note, confirm the agent prompt update was included. Flag any batch that lands canonical rules without aligning the agent.

**B. EXISTING MODULE REFERENCING**
Before drafting derivation logic for an assumption, search the codebase for existing platform modules that handle the math (e.g., Tax module, IRR/NPV calculators, OpEx aggregators). Where a module exists:
- The batch document references the module as authoritative for math
- The batch document specifies only trigger conditions, inputs, outputs, and agent reasoning about the module
- The batch document does NOT re-specify the math

Where no module exists:
- The batch document specifies derivation rules in full
- The implementation dispatch builds the rules into agent tooling

**DO NOT:**
- Re-specify math that an existing platform module already handles
- Ship a batch dispatch without aligning related agent prompts

**Rationale:**
Shipping canonical derivation logic without aligning the agent's operational behavior produces apparent inconsistency between documentation and platform output. Operators see one rule in the doc and a different rule in agent output, producing credibility loss.

Re-specifying math that a module already handles creates two sources of math truth (the doc and the module). When they drift, downstream consumers don't know which is authoritative.

### P10 — Data Sourcing Hierarchy

Every data-dependent feature has three source layers with explicit precedence:

**LAYER 1 — PLATFORM-DERIVED**
Source: research agent, municipal APIs, ApartmentIQ, internal data pipelines, materialized views, derived benchmarks.
Confidence: typically HIGH for fully-covered jurisdictions; degrades for sparse coverage.
LayeredValue source tag: `'platform'`

**LAYER 2 — OPERATOR UPLOAD**
Source: operator uploads data files to the data library — CoStar exports, broker packages, GC bids, third-party reports, manual entry forms.
Confidence: HIGH (deal-specific, operator-curated).
LayeredValue source tag: `'operator'` or `'broker'` (depending on upload source)
Layer 2 is NOT an afterthought. It is a first-class source with explicit upload UX and source provenance.

**LAYER 3 — GRACEFUL DEGRADATION**
When neither Layer 1 nor Layer 2 has data:
- Surface INSUFFICIENT badge with explicit reason
- Provide upload CTA pointing at the gap
- Confidence warnings clearly communicate the limitation
- Feature may degrade to placeholder OR fall back to broader cohort statistics with explicit lower confidence

LayeredValue source tag: `'insufficient'`
Method-level fallback patterns are documented per feature.

**DESIGN REQUIREMENT FOR FUTURE WORK**

When scoping any Phase 2 batch or new feature that consumes data:
A. Identify the Layer 1 sources and verify they're populated against actual database state (not just code references)
B. Define the Layer 2 upload path (file format, expected fields, validation rules) before shipping the feature
C. Define the Layer 3 degradation behavior (what operators see when data is absent)
D. All three layers wired in the same dispatch (per P9.A alignment pattern)

**VERIFICATION STEP (extends P8)**
When verifying a feature's data dependencies, confirm against authoritative platform state:
- Run COUNT queries against expected source tables
- Test the empty-state path explicitly
- Test the operator upload path explicitly

Code references to data sources are NOT sufficient evidence the sources exist or are populated.

**DO NOT:**
- Ship a data-dependent feature without defining the operator upload path
- Treat Layer 1 (platform-derived) as the only "real" source; Layer 2 is equally real
- Assume data exists because code references it — verify against database state

**Rationale:**
The Valuation Grid v0.1 implementation surfaced this gap. The engine was structurally complete but every active method returned INSUFFICIENT because:
- `sale_comp_sets` had 0 rows (Layer 1 sparse)
- No operator upload path existed (Layer 2 not specified)
- The degraded state rendered confusingly because UX assumed Layer 1 would be present

Without P10 codified, future features will repeat this pattern: structurally complete, operationally empty, with no clear path for operators to fill the gap.

---

## Org-Isolation Escape Hatches — Governance (B4a/B4b/B5)

These are the ONLY legitimate bypasses of org-isolation in the platform. Every one is explicit,
named, and must be justified. The default is always scoped.

### 1. `isAdmin: true` — deal-scoping bypass
**File:** `backend/src/services/deal-scoping.service.ts`
`buildDealOrgClause(orgId, alias, opts)` and `assertDealOrgAccess(dealId, orgId, opts)` accept
`opts.isAdmin = true` to skip the org-ownership check. **Only admin routes** (`/api/admin/…`)
should pass this. Every non-admin route must pass `isAdmin: false` (or omit it) and let the
org filter run.

Periodic audit: grep for `isAdmin: true` — every hit must be an admin route. A non-admin
route passing `isAdmin: true` is a scope bypass and a data-boundary violation.

### 2. `triggered_by: 'event' | 'cron'` — metering gate bypass
**File:** `backend/src/agents/runtime/MeteringAdapter.ts`
The B2a/B5 pre-flight gate (credit pool check) only fires on `triggered_by: 'user'` calls.
Event- and cron-triggered agent runs are platform-absorbed and bypass the gate by design —
they run on platform credit, not the user's org pool. Any new background job that performs
real AI inference must use `triggered_by: 'event'` or `'cron'` deliberately, not to sidestep
the gate, but because it IS platform cost. Log it accordingly.

### 3. Public properties — no org-isolation by design
**File:** `backend/src/api/rest/property.routes.ts`, `backend/src/services/deal-scoping.service.ts`
The `properties` table is intentionally platform-public (no `org_id`). Any read of market
property rows bypasses org-isolation — this is correct. The private data (actuals, deal
assumptions, rent roll) is what requires org-scoping, not the public property metadata.
**Invariant:** never add financial/private data columns to `properties`. If a field is private,
it belongs in `deal_monthly_actuals`, `deal_assumptions`, or another deal-scoped table.
(B4b: the `is_market_data` / `org_id` migration was retired — properties stay public.)

### 4. `is_portfolio_asset = TRUE` reads — must JOIN via `deal_id`, not `property_id`
**File:** `backend/src/agents/tools/fetch_owned_asset_actuals.ts`, `fetch_owned_asset_opex_ratios.ts`
Portfolio actuals scoping must JOIN `deal_properties dp ON dp.deal_id = dma.deal_id` (not
`dp.property_id = dma.property_id`). Two orgs can share the same public `property_id`; joining
on `property_id` leaks cross-org rows through the shared key. **Any new portfolio read must
use the `deal_id`-based JOIN path.** (B4b-fix, proven live.)

---

## ORB-01 — Orphan-Sweep Rule (2026-07-08)

**Rule:** A deletion path that only cleans what it re-computes cannot clean what it can no longer see. Any schema change that alters a job's read visibility requires a post-deploy orphan sweep of rows the job can no longer reach.

**Why:** The I1-EXTENSION migration marked `metric_time_series` CS_ rows as `redistribution_restricted = TRUE`, which removed them from the GLOBAL sweep's read set. The nightly `sweepAllGeographies` (correlationEngine.service.ts) only deletes pairs it is about to re-compute. After the schema change, those pairs were no longer re-computed, so their old `metric_correlations` output rows (GLOBAL scope, CoStar-derived) survived until the I2 reader census. They had to be purged manually.

**How to apply:** Whenever you change a filter predicate, column visibility, or join condition that narrows a job's input set, ask: "Are there rows in the output table that this job previously wrote but can no longer see?" If yes, write and run a one-time cleanup query immediately after the schema migration, before the next job run.

**Applies to:** Any scheduled sweep, ETL, or background job that both reads from a source table and writes/deletes to an output table. Especially correlation jobs, aggregation jobs, and any job that deletes-before-recompute.

---

## LIC-01 — Restricted Vendor Derivation Chain (2026-07-08)

**Rule:** Any output derived from a restricted-vendor source (CoStar, or any vendor with `redistribution_restricted = TRUE` in the vendor registry) must itself be marked restricted. This applies across all storage tiers: `metric_time_series` → `metric_correlations` → `skill_chat_messages`.

**Why:** Restriction must propagate through derivation. A correlation computed from CoStar data is a CoStar-derived artifact, even if the metric IDs involved look like platform metrics. Without chain enforcement, restricted values leak through aggregation and replay paths silently.

**How to apply:**
- **Write path:** check `deal_id` for restricted lineage before storing any derived output. Canonical check: `SELECT EXISTS(SELECT 1 FROM metric_time_series WHERE deal_id = $1 AND redistribution_restricted = TRUE LIMIT 1)`.
- **Read/replay path:** filter `WHERE contains_restricted = FALSE` (or `WHERE redistribution_restricted = FALSE`) to exclude restricted rows from AI prompt replay, training corpora, and any cross-deal aggregation.
- **Storage shape:** output tables must carry a `redistribution_restricted` or `contains_restricted` column from birth — not added retroactively.
- **Training corpus:** `sanitizeTrainingCharacteristics` in `training.routes.ts` already strips restricted-vendor field names; `broker_rent` fields come from broker pro-forma (not CoStar), so they survive the filter correctly.

---

## I2 — Chat-Content License Firewall (2026-07-08)

### Firewall design: flag-and-exclude

- **scope-don't-strip strategy:** live AI context in the current turn is NOT sanitized. The response is served to the user as normal. The firewall applies only at the persistence boundary.
- **Write path** (`saveConversationMessage` in `skill-chat.service.ts`): for every assistant turn, check whether the deal has any `metric_time_series` rows with `redistribution_restricted = TRUE`. If yes, save the row with `contains_restricted = TRUE`.
- **Replay path** (`loadConversationHistory`): `WHERE contains_restricted = FALSE` — restricted rows are never re-injected into future AI prompts.
- **Frontend display path** (`skill-chat.routes.ts` GET endpoints): reads all rows including restricted — display is safe; only LLM re-ingestion is the risk.
- **Log table** (`ai_usage_log`): stores metadata only (no content column) — confirmed clean.
- **Training corpus** (`training_examples`): `sanitizeTrainingCharacteristics` strips restricted vendor fields — confirmed not a corpus harvest path for chat messages.

### Reader census (all tables that may surface restricted content to AI prompts)

| Table | Reader | Replay-gated? |
|-------|--------|---------------|
| `skill_chat_messages` | `skill-chat.service.ts:loadConversationHistory` | YES — `WHERE contains_restricted = FALSE` |
| `skill_chat_messages` | `skill-chat.routes.ts` GET /conversations | NO (display only) |
| `skill_chat_messages` | `skill-chat.routes.ts` GET /conversations/:id | NO (display only) |
| `agent_conversations` | `agent-orchestrator.ts:loadConversationHistory` | NO restricted data flows through this path |
| `agent_chat_logs` | write-only in `agent-chat.service.ts` | N/A |
| `opus_messages` | `opus.service.ts` — Opus flow, separate surface | separate audit needed |
| `chat_sessions.conversation_history` | `sessionStore.ts` — WhatsApp/Twilio surface | separate audit needed |

### I2-D historical backlog

Bishop deal (`3f32276f-aacd-4da3-b306-317c5109b403`) at time of firewall deployment:
- `agent_chat_logs`: 0 rows
- `opus_messages`: 0 rows
- `skill_chat_messages`: 0 rows (table did not exist before 2026-07-08 migration)

No retroactive purge required. All future Bishop assistant turns will be flagged at write time.

### X2 — sweepAllGeographies gap (proposal, not yet built)

`sweepAllGeographies()` (correlationEngine.service.ts:860) iterates `DISTINCT geography_type, geography_id` from `metric_time_series` with NO `deal_id` filter. This produces GLOBAL-scope correlations only. Deal-scoped correlations (e.g. Bishop's `deal_id`-partitioned rows) are re-computed by deal-scoped callers but are not swept by the nightly job — they go stale silently.

**Proposed minimal fix (gate for next dispatch):**
1. After the GLOBAL sweep loop, add a deal-scoped pass: `SELECT DISTINCT deal_id FROM metric_time_series WHERE deal_id IS NOT NULL AND redistribution_restricted = TRUE`.
2. For each `deal_id`, call `computeTimeSeriesCorrelations(geoType, geoId, dealId)` with `dealId` set.
3. Store resulting correlations with `scope = 'deal'` and `restricted = TRUE`.
4. Apply ORB-01: purge any stale `metric_correlations` rows for those `(geoType, geoId, dealId)` tuples before recomputing.

Do not build this until the sweep change is formally dispatched. The gap is logged here to prevent it from being lost.
