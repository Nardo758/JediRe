---
name: D3 agent seam audit findings
description: Key findings from D3 Phase 1 read-only audit of the agent assumption write path, resolution order, and provenance gaps.
---

## Rule
The agent `resolved` slot is below Engine A computed in the read-time resolution stack. Any model build silently overwrites agent-authored values unless an operator `override` is present.

**Why:** `resolveLayeredValue()` at `get-field-value.service.ts:430` applies layers in order: storedResolved < agent < computedValue (Engine A) < perYearOverride < override. This is DC-31 design — agent values are "elevated at read-time" only above seeder-stored values, not above Engine A. D3 must resolve R1 (agent authority) before Phase 2 writes.

**How to apply:** When an agent writes via `writeAgentFieldToActiveScenario()`, assume the value will be overwritten on the next model build unless an operator override is also set. For durable agent-authored assumptions, Phase 2 must either write to the `override` slot or modify Engine A to skip overwriting when the `agent` slot is present.

## Operator Rulings — RECEIVED 2026-07-08

| R | Verdict |
|---|---|
| R1 | **(c)** `agent_confirmed` flag. Order: storedResolved < Engine A < **agent_confirmed** < perYearOverride < override |
| R2 | **(a)** `reasoning TEXT` + `evidence_refs JSONB` columns in overlays. Migration required. |
| R3 | **(b)** Store `deal_financial_models.assumptions_hash` per overlay row at write time. |
| R4 | **(a)** `confidence='low'` + `note` in overlays, surfaced in F9 audit trail. |
| R5 | **(a)** preferred (F-P1t home); **(b)** Inngest cron as bridge if F-P1t not yet landed. |
| R6 | **(c)** Agent flags via overlay seam (`real_estate_tax.broker_flag`-style). Never touches `deal_data`. |
| R7 | **(a)** Replace `update_assumption` in-place. Kill raw SQL write, keep name/signature. |
| R8 | F5-gated = evidence_refs citing `inPlaceNOI`-class rows. R1/R7/R2/R4/R6 NOT F5-gated. |

**Phase 2 sequence:** R1 → R7 → R2/R4 → R6 → R3 → [F5] → evidence-citing → [F-P1t check] → R5.

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
