---
name: D3 agent seam audit findings
description: Key findings from D3 Phase 1 read-only audit of the agent assumption write path, resolution order, and provenance gaps.
---

## Rule
The agent `resolved` slot is below Engine A computed in the read-time resolution stack. Any model build silently overwrites agent-authored values unless an operator `override` is present.

**Why:** `resolveLayeredValue()` at `get-field-value.service.ts:430` applies layers in order: storedResolved < agent < computedValue (Engine A) < perYearOverride < override. This is DC-31 design — agent values are "elevated at read-time" only above seeder-stored values, not above Engine A. D3 must resolve R1 (agent authority) before Phase 2 writes.

**How to apply:** When an agent writes via `writeAgentFieldToActiveScenario()`, assume the value will be overwritten on the next model build unless an operator override is also set. For durable agent-authored assumptions, Phase 2 must either write to the `override` slot or modify Engine A to skip overwriting when the `agent` slot is present.

## Key findings (2026-07-08)

- **`update_assumption` skill** (`skills/index.ts:440`): raw `UPDATE deal_assumptions SET field = $1` — bypasses overlays, no trigger, no provenance beyond `updated_by`. F-P1-flagged defect. 9 hardcoded scalar fields (not LayeredValue fields — outside the year1/overlay chain entirely).

- **`writeAgentFieldToActiveScenario()`** (`underwriting-scenarios.service.ts:431`): writes `agent` + `resolved` slots in year1 JSONB; `sync_scenario_to_overlays()` trigger fires → overlay rows produced. This IS the overlay-seam path. But agent slot < Engine A in resolution.

- **Evidence not persisted to overlays**: `UnderwritingValue.Evidence` (`layered-value.ts:115`) has `reasoning` + `data_points` (= rationale + evidence_refs) but `deal_assumption_overlays` has no columns for them. Evidence lives only in `agent_run_steps` output JSON. The `note` column is the only free-text field in overlays today.

- **`input_snapshot_hash`**: `deal_financial_models.assumptions_hash` is build-level (not field-level). Not in overlays.

- **`broker_claims`**: in `deals.deal_data` JSONB, not in overlays. No seam write path with provenance.

- **8 rulings required (R1–R8)**: agent authority, provenance schema additions, snapshot hash granularity, escalation surface, tax reconciliation home, broker_claims write path, update_assumption retirement plan, F5 sequencing. See `docs/audits/D3_PHASE1_AUDIT.md`.

- **F5 NOT landed**: in_place_noi duplicate/missing defect + effective-assumptions capture unresolved. D3 NOI-family evidence items must sequence behind F5.

- **Confidence window OPEN** as of 2026-07-08 (builds 2–10 / 7 days post-V3 confirmation). Phase 2 must not touch overlay write-path until closed.

- **`deal_financial_models` output column** is named `results`, not `output_data`.
