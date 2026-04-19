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
