# D3 Phase 1 Audit — Agent Assumption Seam
**Date:** 2026-07-08  
**Arc:** D3 — CashFlow Agent authors assumptions through the consolidated store  
**Phase:** 1 — Read-only audit. No writes, no migrations, no agent-behavior changes.  
**Standing rules:** S1-01 file:line evidence, verify counts, raw findings.

---

## Confidence Window State

**WINDOW IS OPEN.** F-P1 V3 was confirmed 2026-07-08 (today); the 7-day / build-2-through-10 shadow-read window started at that confirmation. Phase 1 is read-only — no risk. Phase 2 **must not** retire, rewrite, or race the overlay write-path (`deal_assumption_overlays`, `sync_scenario_to_overlays()` trigger, `persistDecomposedOverlays`) until the window closes at build 10 / day 7.

---

## A1 · The Seam Today — What Writes Assumptions, and How

### 1a. `resolve()` / `FIELD_PRIORITIES`

**File:** `backend/src/services/proforma-seeder.service.ts`

`resolve()` is a **seeder-time** function (line 444). It runs once per field during the proforma seed pipeline, constructing the initial LayeredValue that lives in `deal_underwriting_scenarios.year1` (and by trigger-sync, `deal_assumptions.year1`).

**`FIELD_PRIORITIES`** (line 365) — explicit source fallback order per field:

```
gpr:               ['t12', 'rent_roll']
loss_to_lease_pct: ['t12', 'rent_roll']
vacancy_pct:       ['rent_roll', 't12']
concessions_pct:   ['t12', 'rent_roll']
bad_debt_pct:      ['t12']
non_revenue_units_pct: ['t12']
other_income_total: ['rent_roll', 't12', 'om']
real_estate_tax:   ['tax_bill', 't12']
management_fee_pct: ['t12']
insurance:         ['t12']
```

Fields not in the table fall through to `platform` value. `SKIP_ZERO_FIELDS` (line 386) lists `gpr, egi, noi, net_rental_income, other_income_*,  total_opex` — zero from any source is treated as "missing" and the walker continues to the next tier.

**DC-31 — the agent layer is NOT resolver-bound** (documented at line 357):
> "Agent values do NOT flow through resolve() or FIELD_PRIORITIES. They are written directly to year1 via writeAgentFieldToActiveScenario() and elevated at read time by resolveLayeredValue(). Do not add 'agent' to FIELD_PRIORITIES — the walker has no agent slot and would silently no-op."

There is no `agent` slot in `FIELD_PRIORITIES` and no agent path in `resolve()`. Agent values bypass seeder-time resolution entirely.

**Read-time resolution** — `resolveLayeredValue()` at `backend/src/services/field-access/get-field-value.service.ts:430`:

```
Priority (lowest → highest):
  storedResolved    — seeder's FIELD_PRIORITIES best value
  agent             — lv.agent slot in year1 JSONB
  computedValue     — Engine A (formula-engine) output
  perYearOverride   — deal_assumptions.per_year_overrides column
  override          — lv.override slot in year1 JSONB (operator, always final)
```

**Critical finding — agent slot is BELOW Engine A computed (line 454–459):**
```typescript
// Engine A computed overrides agent (unless operator override present)
if (computedValue != null && override == null) {
  resolved   = computedValue;
  resolution = 'engine:cashflow';
```
Any Engine A run will silently overwrite an agent-authored value unless the operator override is set. Agent writes today are ephemeral against downstream model builds.

### 1b. Agent Write Paths — Complete Map

| Tool / Path | File:Line | Write Target | What It Writes | Provenance Today |
|---|---|---|---|---|
| `update_assumption` skill | `skills/index.ts:408,440` | `deal_assumptions` (scalar columns) | 9 hardcoded fields: `cap_rate, exit_cap_rate, exit_year, rent_growth, expense_growth, vacancy_rate, management_fee_pct, capex_per_unit, renovation_budget` | `updated_by` (userId) + `updated_at` only. **No overlay row. No trigger. No rationale.** |
| `writeAgentFieldToActiveScenario()` | `underwriting-scenarios.service.ts:431` | `deal_underwriting_scenarios.year1` (active scenario, JSONB) | Sets `year1[key].agent = value`, `year1[key].resolved = value`, `year1[key].resolution = 'agent:cashflow'` | Source tag in JSONB only. No `deal_assumption_overlays` row. |
| CashFlow postprocess — math-correction | `cashflow.postprocess.ts:339–376` | `deal_underwriting_scenarios.year1` → `deal_assumptions.year1` (fallback) | `year1[key].resolved` slot (subtotals: `total_opex`, `egi`, `noi`) via `jsonb_set(..., ARRAY[key,'resolved'], to_jsonb(value))`. Preserves other layers. | `source_tag: 'postprocessor_math_fill'`, `derivation_chain` in output JSON. Not written to overlays. |
| Financial model engine sync | `financial-model-engine.service.ts:1805` | `deal_assumptions` (scalar columns) | Computed outputs synced back to top-level scalar columns for legacy readers | None — system sync, no provenance. |
| Opus chat | `opus.service.ts:594` | `opus_proforma_versions` table | Full pro forma capsules (JSON) | Per-field `source`, `origin`, `confidence`, `rationale` — but lives in `opus_proforma_versions`, never in `deal_assumption_overlays`. |
| Agent orchestrator | `agent-orchestrator.ts:416` | (via `update_assumption` skill) | Inherits skill behavior | Inherits skill provenance defect. |

**The F-P1-flagged defect** is `update_assumption` at `skills/index.ts:440`:
```sql
UPDATE deal_assumptions SET ${field} = $1, updated_at = NOW(), updated_by = $2 WHERE deal_id = $3
```
Raw scalar write. Bypasses `deal_underwriting_scenarios`, bypasses overlays, fires no trigger, attaches no provenance. The 9 fields it writes are NOT LayeredValue fields — they are top-level scalar columns, not part of `year1` JSONB. This means they are outside the decompose/overlay/verify chain entirely.

### 1c. The Overlay Write API (Post-F-P1)

The sanctioned write path post-F-P1 routes through two complementary mechanisms:

**1. `persistDecomposedOverlays()`** — `backend/src/services/deterministic/scenario-decomposition.ts:273`  
Accepts a full `year1` blob, decomposes it into individual `deal_assumption_overlays` rows (one per field), supersedes previous rows, and writes in a transaction. This is the batch/scenario path.

**2. `writeAgentFieldToActiveScenario()`** — `underwriting-scenarios.service.ts:431`  
Per-field write to `deal_underwriting_scenarios.year1` JSONB (active scenario). The `sync_scenario_to_overlays()` trigger then decomposes the year1 blob into overlays on UPDATE. This is the incremental/single-field path.

**The gap:** `update_assumption` uses neither. It writes to `deal_assumptions` scalar columns directly, bypassing both paths. D3 must reroute `update_assumption` to either:
- Call `writeAgentFieldToActiveScenario()` (single-field overlay path, trigger fires), OR
- Expand `persistDecomposedOverlays()` to accept single-field overlay inserts directly.

The trigger (`sync_scenario_to_overlays()`) only fires on `deal_underwriting_scenarios`, not on `deal_assumptions`. A direct `deal_assumptions` write does not produce overlay rows.

---

## A2 · The Provenance Contract — Real State vs. Required

### 2a. Schema Fields Today

**`LayeredValue<T>`** — `backend/src/types/layered-value.ts:56`

Has: `value`, `source`, `agentRunId`, `agentId`, `runAt`, `metadata`, `stanceModulated`, `stanceTrace`.  
**Missing from base type:** `rationale` (free-text), `evidence_refs` (structured refs), `input_snapshot_hash`.

**`UnderwritingValue<T>`** — `layered-value.ts:115`

Extends `LayeredValue<T>` with a full `Evidence` object containing:
- `reasoning` (string) — equivalent to the spec's `rationale`
- `data_points: EvidencePoint[]` — equivalent to `evidence_refs`; each point carries `tier`, `source`, `label`, `value`, `weight`, `notes`, `run_id`
- `alternatives: Alternative[]` — rejected values with reasons
- `collision?: CollisionReport` — agent vs. broker delta with magnitude/narrative

This is the rich provenance contract. However, **`UnderwritingValue` is the CashFlow agent's output type — it is NOT the schema of `deal_assumption_overlays`**.

**`deal_assumption_overlays` columns (19 total, post-F-P1):**
`id, deal_id, field_key, source_tag, value, value_text, confidence, note, snapshot_at, created_at, updated_at, edited_by, edited_at, scenario_id, superseded_by, superseded_at, field_path, value_jsonb`

The `note` column is the only free-text field. `value_jsonb` holds the full LayeredValue blob. **There is no `reasoning` column and no `evidence_refs` column.** The `Evidence` object from `UnderwritingValue` is not persisted to the overlay row — it lives only in the CashFlow agent's `agent_run_steps` output JSON.

**F-P1 attribution** (`edited_by`, `edited_at`) is a subset — it records who wrote the overlay row, not why or with what evidence.

**Provenance gap summary:**

| Required field | Exists in overlay schema? | Where it lives today |
|---|---|---|
| `rationale` | ❌ No | CashFlow agent output JSON only (`reasoning` in `Evidence`) |
| `evidence_refs` | ❌ No | CashFlow agent output JSON only (`data_points` in `Evidence`) |
| `input_snapshot_hash` | ❌ No | `deal_financial_models.assumptions_hash` (build-level, not field-level) |
| `edited_by` / `edited_at` | ✅ Yes (F-P1 B5) | `deal_assumption_overlays` columns |
| `confidence` | ✅ Yes | `deal_assumption_overlays.confidence` column |
| `source_tag` | ✅ Yes | `deal_assumption_overlays.source_tag` column |

### 2b. Evidence Sources — What Refs Could Cite

An `evidence_refs` entry from the agent would point at a real data row. Available evidence sources by table:

| Evidence source | Table | Citeable by? |
|---|---|---|
| T-12 / Rent Roll / Tax Bill extraction | `data_library_files`, `extracted_docs` | `run_id` or `documentId` |
| Historical observations (empirical calibration) | `historical_observations` | `run_id`, `observation_type` |
| Market sale comps | `market_sale_comps` | `id` |
| Market rent comps | `market_rent_comps` | `id` |
| CoStar market metrics | `costar_market_metrics` (via `historical_observations` vendor path) | `vendor_source`, `vendor_data_as_of` |
| Owned portfolio actuals | `deal_monthly_actuals` | `deal_id`, `month` |
| Agent run output | `agent_run_steps` | `run_id` |

**Referential integrity today:** None enforced. `EvidencePoint.run_id` is a free string — no FK to any table. The dispatch's "referential integrity" requirement (refs point at real evidence rows/signals) has no database enforcement mechanism today.

### 2c. `input_snapshot_hash`

`deal_financial_models.assumptions_hash` (column confirmed, used in `financial-model-engine.service.ts`) is a SHA of the full assumptions object at build time. It serves as a build-level cache key and integrity check. It is:
- ✅ Reusable for the "same inputs → same model" guarantee at build level
- ❌ Not a per-field snapshot hash
- ❌ Not stored in `deal_assumption_overlays`

For D3, the per-field `input_snapshot_hash` requirement from the spec would need either: (a) storing the assumptions_hash from the concurrent build into each overlay row written during that run, or (b) a new per-field hash of the field's data_points snapshot at write time.

---

## A3 · Plausibility Gates — Escalate-Don't-Reject

### 3a. Validation That Exists Today

**INV-* checks — model output level** (fire AFTER a build, not at write time):
- `INV-001`: `stabilization_year` not null — `proforma-assumptions-bridge.ts:42`
- `INV-006`: `loan > purchasePrice` (totalEquity mismatch) — bridge.ts
- `INV-007`: zero equity — bridge.ts
- `INV-009`/`INV-010`: development deal construction-row exclusions — bridge.ts

**Confidence bands** — `backend/src/services/proforma/validators/confidence-bands.ts`:
- Soft warning: user override outside P25–P75 but inside P10–P90
- Hard warning: override outside P10–P90 → **requires justification note** (line 118)
- Refusal: `< 5 stabilized comps` or `< 3 years` comp history (lines 137–140)

**`invariant_check` on inline-deal write** — `inline-deals.routes.ts:133–146`: validates pre_stab_noi vs stab_noi delta (`delta_pct` threshold) before writing to `deal_assumptions`. This is the closest to a write-time plausibility gate, but it applies only to the inline-deal route, not to `update_assumption` or `writeAgentFieldToActiveScenario`.

**Write-time validation on `update_assumption`:** None. The confirmation flow (`confirmed: true/false`) is a UX safety gate — it does not check whether the value is plausible, only that the user acknowledged the change.

### 3b. Where the Escalate-Don't-Reject Gate Would Live

The write path for D3 will be: agent calls → overlay insert (via `writeAgentFieldToActiveScenario` or direct overlay insert) → trigger decomposes to `deal_assumption_overlays`.

The natural escalation surface is at the **overlay insert layer** — before the row is committed, a plausibility check compares the agent's proposed value against confidence-band bounds for that field (using the existing `confidence-bands.ts` machinery). If the value falls outside P10–P90:
- The row is **written** (escalate, not reject) with a `plausibility_flag` indicator
- An alert surfaces to the operator (existing alert infrastructure — `deal_events` or a UI-level flag)
- The value remains active (agent has authored it) but flagged for review

The `confidence` column in `deal_assumption_overlays` could carry this signal (`low` = plausibility concern), combined with a `note` entry. This reuses existing schema without a migration in Phase 2.

### 3c. INV-* / Plausibility Interplay

The engine's INV-* checks fire on model build output, not on assumption writes. They currently do not provide a write-time escalation surface. However:
- **LOW_CONFIDENCE** metadata from the CashFlow agent's `Evidence.confidence` field is already computed per field — this IS the per-field plausibility signal. It exists in the agent output but is not persisted to overlays today.
- The `collision` field in `Evidence` (agent vs broker delta with `magnitude: 'severe'`) is the closest to an existing escalation indicator.

**Design surface:** Phase 2 should persist `Evidence.confidence` → `deal_assumption_overlays.confidence`, `Evidence.collision.magnitude` → `note` or a new `flag` column. This makes the escalation surface visible without adding a hard-reject anywhere in the write path.

---

## A4 · Tax Verification Duties

### 4a. County-Bill Data — ATTOM Integration State

**ATTOM adapter** — `backend/src/services/tax/attomAdapter.ts`  
Active. Tier 2 in the `PropertyAppraiserFetcher` stack (Tier 1 = Tax Bill PDF, Tier 3 = County Adapters). Fetches `assessed_value`, `tax_amt`, `millage_rate` from ATTOM Property Detail API v3.

**Current reconciliation** — `backend/src/services/proforma-seeder.service.ts:1420–1480`  
Document-upload–triggered: when a new T12 or Tax Bill is uploaded, the seeder captures variance vs. the projected tax figure and logs material differences (>5%) to `deal_reconciliation_log`. This is the existing layer (a) for uploaded documents — it is NOT triggered by engine acceptance.

**ATTOM integration state:** Functional. County-bill data IS available for deterministic reconciliation. The gap is that reconciliation currently fires on document upload, not on engine tax output.

### 4b. Layer (a) — Deterministic Reconciliation Home

Two candidate locations:

**Option 1 — Inside the tax engine's acceptance (post-F-P1t extract)**  
Natural home once F-P1t lands. The tax schedule extract (`tax-schedule-extract.ts`) produces a deterministic county tax figure; comparing it against ATTOM-sourced actual bill at acceptance time is the tightest possible loop. Requires F-P1t to have landed first.

**Option 2 — Standalone reconciliation job (available now)**  
A cron-driven Inngest function that, for each deal with an active scenario, fetches the engine's `real_estate_tax.resolved` value and compares it against the ATTOM `tax_amt` for the parcel. Flags to `deal_reconciliation_log` if delta > threshold. Independent of F-P1t.

**Ruling needed:** Where layer (a) lives depends on whether F-P1t is a prerequisite. The dispatch pre-authorized Option 2 as viable before F-P1t.

### 4c. Layer (b) — Agent Judgment; `broker_claims` Writability

**OM-tax figure landing:**  
`bpTax = bpNum('realEstateTaxesAnnual')` — `proforma-seeder.service.ts:558`  
Lands in `real_estate_tax.om` layer of `year1` (the `om` slot in the LayeredValue). Visible in the F9 collision view (delta between broker proforma and platform forecast). The agent can READ it via `fetch_assumptions` → `year1.real_estate_tax.om`.

**`broker_claims` writability:**  
`broker_claims` is a top-level key in `deals.deal_data` (JSONB), not in `deal_assumptions` or `deal_assumption_overlays`. The agent can write to `deal_data` via a raw update, but there is no overlay-seam path for `broker_claims` today. If the agent flags `broker_claims.proforma.taxes = 'overstated'`, it writes to `deal_data` directly — bypassing overlays, no provenance chain.

**What the agent needs for layer (b):**
- ✅ `fetch_jurisdiction_tax_forecast` tool exists (cashflow agent tool list)
- ✅ Can read `real_estate_tax.om` (broker OM tax figure) via `fetch_assumptions`
- ✅ Can read ATTOM actual via `fetch_jurisdiction_tax_forecast`
- ❌ No seam-path to write `broker_claims` with provenance
- ❌ No mechanism to "propose ruleset/assumption correction" for `real_estate_tax` via the overlay API with full Evidence chain (the overlay write path exists, but `reasoning` + `evidence_refs` are not persisted)

---

## A5 · Skill / Coordinator Interaction (CU Adjacency)

### 5a. Skill Registry — Write vs. Read Boundary

**Registry:** `backend/src/services/skills/skill-registry.ts`  
**18 registered skills** in `skills/index.ts`. By category:

| Category | Skills | Type for D3 |
|---|---|---|
| `action` | `update_assumption`, `add_note`, `create_task`, `update_deal_status` | **D3 scope** — write skills |
| `data` | `query_deal_data`, `search_market_data` | CU scope — read only |
| `analysis` | `run_return_analysis` | CU scope — compute only |
| `document` | `extract_document` | CU scope — read/analyze |
| `report` | report skills | CU scope |
| `advisor` | 16 `consult_<persona>` skills | CU scope — nested LLM calls, no writes |

**D3's scope is precisely the `action` category.** CU's planned registry merge touches the `data`, `analysis`, `document`, and `advisor` categories — the two scopes do not overlap at the category level.

### 5b. Coordinator Dispatch Architecture

**3-layer dispatch** — `backend/src/coordinator/dispatch.ts`:
- Layer 1 (Full Agents): RESEARCH, ZONING, SUPPLY, CASH → `AgentRuntime.run()`
- Layer 2 (Context Fragments): DEMAND, COMPS, RISK, DEBT, NEWS, STRATEGY → text injection
- Layer 3 (Advisor Personas): 16 personas → registered as skills

D3 reroutes the `update_assumption` skill's `execute` function — this is a localized change inside `skills/index.ts:421–451`. The coordinator dispatch path (Layer 1 routing) is untouched. The `AgentOrchestrator` at `agent-orchestrator.ts:416` calls `skillRegistry.execute('update_assumption', params, context)` — after D3's reroute, it will call through to the overlay API without any coordinator change.

### 5c. CU Collision Risk

CU plans to unify the `cashflow agent tools/` directory and `skill-registry.ts` into one registry (each agent's tools available as registry skills). D3's reroute modifies ONE skill in `action` category. Collision scenarios:

**Scenario 1 (low risk):** CU's merge preserves the `action` category as-is and just adds CashFlow agent's read tools as new skills. D3's rerouted `update_assumption` rides along unchanged.

**Scenario 2 (medium risk):** CU regenerates the skill registry from a unified manifest, overwriting `update_assumption` with the pre-D3 version. Mitigation: D3 should add a `@D3-rerouted` comment marker and document the reroute in the skill definition so CU's merge can detect it.

**Scenario 3 (high risk — sequencing failure):** D3 adds a NEW `write_overlay_assumption` skill alongside the old `update_assumption`. CU sees two write-action entries and must merge them. Mitigation: D3 should **replace `update_assumption` in-place** (not add a sibling), so CU sees exactly one write-action entry before and after.

**Recommended sequencing:** D3 lands before CU's registry merge. If CU lands first, D3 must diff against CU's manifest before rerouting.

---

## F5 Landing State

**F5 scope** (from dispatch): evidence-integrity defects — duplicate/missing `in_place_noi` entries in CashFlow agent evidence rows, plus the effective-assumptions capture.

**Current state:**
- `cashflow.postprocess.ts:1484–1489`: `in_place_noi` was added to the fallback chain (B6/F-P1 fix) — it now appears in the `proforma_fields` key. The underlying duplicate/missing entry defect and the effective-assumptions capture are **not yet fixed**.
- `A5-F5` references in agent inngest files (`cashflow.inngest.ts:107,228`, `research.inngest.ts:73`, etc.) are `automation_level` enforcement annotations — a different F5 context, not evidence integrity.

**F5 has NOT landed.** Evidence refs from D3 Phase 2 that point at `in_place_noi` evidence rows cannot be guaranteed referentially intact until F5 fixes the duplicate/missing defect. D3 Phase 2 build items that depend on evidence integrity for NOI-family fields should be flagged as **F5-sequenced**.

---

## Rulings Required for Phase 2

| # | Decision | Options | Impact |
|---|---|---|---|
| R1 | **Agent-layer authority in resolution stack** | (a) Agent writes go to `override` slot (operator-equivalent, permanent); (b) Engine A taught to skip overwriting when `agent` slot present and no `override`; (c) new `agent_confirmed` flag that promotes agent value above Engine A | If (a): agent-authored values are permanent until operator clears. If (b)/(c): Engine A needs modification. Currently agent is BELOW Engine A — any model build overwrites agent values silently. |
| R2 | **Provenance schema additions to `deal_assumption_overlays`** | (a) Add `reasoning TEXT` + `evidence_refs JSONB` columns (migration required); (b) Use existing `note` column for reasoning, store evidence in `value_jsonb`; (c) Evidence lives only in `agent_run_steps`, overlays get a `run_id` FK pointer | Choice determines migration cost in Phase 2. Option (b) is zero-migration but lossy. Option (a) is the full provenance contract. |
| R3 | **`input_snapshot_hash` granularity** | (a) Per-field hash of data_points snapshot at write time; (b) Reuse `deal_financial_models.assumptions_hash` (build-level) — store it in each overlay row written during that run; (c) Not implemented in Phase 2 | Option (b) is lowest-cost and reusable from existing machinery. |
| R4 | **Escalation surface for implausible agent values** | (a) `deal_assumption_overlays.confidence = 'low'` + `note` entry, surfaced in F9 assumption audit trail; (b) New `plausibility_flag` column + alert in `deal_events`; (c) Inline warning in agent output only, no DB write | Escalate-don't-reject is the ruling — rejection is off the table. R4 determines where the flag lands. Option (a) is zero-migration. |
| R5 | **Tax reconciliation (layer a) home** | (a) Inside F-P1t tax engine acceptance (post-extract); (b) Standalone Inngest cron comparing engine output vs ATTOM `tax_amt` per parcel | F-P1t dependency: option (a) gates on F-P1t landing; option (b) can ship in D3 Phase 2 independently. |
| R6 | **`broker_claims` write path** | (a) Agent writes to `deal_data.broker_claims` directly (bypasses overlays, no provenance); (b) Promote `broker_claims` fields to `deal_assumption_overlays` (migration + schema change); (c) Agent flags the FIELD value in year1 (e.g. `real_estate_tax.broker_flag`) via overlay seam | Option (c) is lowest-friction: the agent writes a flag into the overlay for `real_estate_tax` without touching `deal_data` directly. |
| R7 | **`update_assumption` retirement plan** | (a) Replace in-place with overlay-routing version — all callers (chat, orchestrator, UI) get overlay path; (b) Keep legacy for UI-triggered writes, add new `write_overlay_assumption` for agent-triggered writes | Option (a) is cleaner for CU adjacency (one write-action skill). Option (b) risks two write paths diverging. Dispatch recommendation: option (a), replace in-place. |
| R8 | **F5 sequencing dependency** | Which D3 Phase 2 items depend on F5's effective-assumptions capture / `in_place_noi` integrity? | Phase 2 plan must mark F5-gated items explicitly so they don't ship without F5. |

---

## Operator Rulings — RECEIVED 2026-07-08

| # | Verdict | Operator reasoning |
|---|---|---|
| **R1** | **(c) — `agent_confirmed` flag promotes agent value above Engine A; below explicit user override.** Reject (a) and (b). | (a) making agent writes operator-permanent is too strong — the agent is a considered input, not a locked decision; the user must still override without "clearing" anything. (b) teaching Engine A to skip is a silent-conditional-behavior pattern this program has been burned by. (c) is explicit: a flagged agent value ranks above engine defaults. |
| **R2** | **(a) — real `reasoning TEXT` + `evidence_refs JSONB` columns. Migration required, worth it.** | (b) is lossy; (c)'s FK to `agent_run_steps` makes provenance ephemeral (steps get pruned — the audit trail for a written value can't live in a transient table). The full provenance contract was a founding invariant — pay the migration. |
| **R3** | **(b) — reuse `deal_financial_models.assumptions_hash`, stored per overlay row written during that run.** | Lowest-cost, reuses existing machinery. Build-level granularity is sufficient — the hash answers "what data snapshot did this write see," which is a per-run fact, not per-field. |
| **R4** | **(a) — `confidence='low'` + note, surfaced in the F9 assumption audit trail.** | Zero-migration, reuses the LOW_CONFIDENCE display surface already in the engine, and puts the escalation exactly where a reviewer looks. Escalate-don't-reject, landed. |
| **R5** | **(a) preferred, sequence-aware: reconciliation lives in F-P1t's tax-engine acceptance. If F-P1t hasn't landed when D3 Phase 2 reaches this item, ship (b) the standalone Inngest cron as the interim, migrating into (a) when F-P1t lands.** | (a) is the right home; (b) as a bridge avoids blocking D3 on F-P1t. Not either/or — (a) is the destination, (b) is the on-ramp. |
| **R6** | **(c) — agent flags the field via overlay seam (`real_estate_tax.broker_flag`-style), never touches `deal_data` directly.** | Keeps every agent write inside the provenance'd overlay path — the whole point of D3. (a) bypasses provenance; (b) is a bigger migration than the flag warrants. (c) is lowest-friction and architecturally pure. |
| **R7** | **(a) — replace `update_assumption` in-place with the overlay-routing version.** | Two write paths (b) will diverge (this program has that scar), and CU's registry merge needs exactly one write-action skill. Kill the raw write, keep the name and signature. |
| **R8** | **F5-gated items: any Phase 2 work that writes `evidence_refs` pointing at `inPlaceNOI`-class evidence, OR that reconciles against effective-assumptions. R1, R7, R2/R4 schema migration, and R6 broker-flag are NOT F5-gated — they go first. Sequence evidence-citing items behind F5's Finding-V fix.** | A ref pointing at a duplicated/missing evidence row has no referential integrity. Write the seam before writing the citations. |

### R1 Implementation Note (Phase 2 encoding)

The `agent_confirmed` slot inserts between Engine A and per-year overrides. Complete `resolveLayeredValue()` order after Phase 2:

```
storedResolved  <  Engine A (computed)  <  agent_confirmed  <  perYearOverride  <  override
```

"Below explicit user override" covers both `perYearOverride` (per-year column) and `override` (LV slot) — both are user-originated. `agent_confirmed` must be coded between Engine A and `perYearOverride`, not between `perYearOverride` and `override`.

### Phase 2 Build Sequence (operator-derived)

```
1. R1  — resolution-order fix: add agent_confirmed slot to resolveLayeredValue()
          and LayeredValue<T> type  [live-defect keystone, no F5 gate]
2. R7  — update_assumption in-place reroute to overlay API  [no F5 gate]
3. R2/R4 — schema migration: add reasoning TEXT + evidence_refs JSONB + confidence
             write path to deal_assumption_overlays  [no F5 gate]
4. R6  — broker-flag overlay (real_estate_tax.broker_flag-style)  [no F5 gate]
5. R3  — assumptions_hash stamping per overlay row written during a run  [no F5 gate]
── F5 must land here ──────────────────────────────────────────────────────────────
6. Evidence-citing items: evidence_refs pointing at inPlaceNOI-class rows,
   effective-assumptions reconciliation  [F5-gated]
── F-P1t state check here ─────────────────────────────────────────────────────────
7. R5  — (a) if F-P1t landed; (b) standalone Inngest cron as bridge if not
```

---

## Summary — The Gap at a Glance

```
TODAY                              REQUIRED FOR D3
─────────────────────────────────  ──────────────────────────────────────
update_assumption → raw SQL        update_assumption → overlay API
  no overlay row                     overlay row with source_tag + evidence
  no rationale                       reasoning + evidence_refs persisted
  no plausibility gate               plausibility gate at write time

writeAgentFieldToActiveScenario    same, but adds:
  writes agent+resolved slots          - R1: authority above Engine A
  no Evidence persisted                - R2: reasoning/evidence_refs in overlay
  agent < Engine A (overwritten)       - R3: snapshot_hash in overlay row

Tax reconciliation                 layer (a): ATTOM vs engine tax (R5)
  fires on doc upload only           layer (b): agent proposes correction
  no agent-judgment path               via overlay seam with Evidence chain

broker_claims in deal_data         agent-writable via overlay seam (R6)
  no overlay path                    with collision + reasoning
```

**STOP. No Phase 2 work. Rulings R1–R8 required before build begins.**
