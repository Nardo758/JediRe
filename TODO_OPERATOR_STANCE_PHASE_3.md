# OperatorStance — Phase 3 Side Debt

Logged during Phase 1B implementation (May 7, 2026). Items below were
surfaced during the Phase 1A audit and must NOT be fixed until Phase 3 is
scoped and approved.

---

## P3-01 — m28_rate_environment bridge ✅ FIXED (May 2026)

`m28_rate_environment.policy_stance` is a FRED-sourced string (e.g. "Neutral",
"Hawkish") observed from market data. It could pre-populate `rateEnvironment`
as a suggested default when an operator hasn't set a stance — giving the agent
platform signal as a starting point without overriding operator choice.

Fix shipped: `operatorStance.service.ts → getStanceForDeal()` now checks
`m28_rate_environment` when the deal has no persisted stance, maps
`policy_stance + forward_direction` to `RateEnvironment` via
`mapM28ToRateEnvironment()` (easing/emergency → CUTTING, tightening →
HIGHER_FOR_LONGER, neutral uses forward_direction as tiebreaker). Falls through
to full platform defaults gracefully if m28 table is not yet seeded.

---

## P3-02 — Vacancy projection hardcodes

Service-layer math functions that hardcode a vacancy assumption bypass
`stressVacancyFloor` modulation. These need to be audited and refactored to
consult stance before Phase 3 math hooks are wired.

Files to audit:
- `backend/src/services/proforma/` — check for hardcoded vacancy percentages
- `backend/src/agents/cashflow.postprocess.ts` — `stressVacancyFloor` is checked
  post-process but only for validation; actual projection math may not use it
- Any function that returns a fixed `0.05` or `0.07` vacancy default

Fix (Phase 3): refactor projection functions to accept `OperatorStance` and
call `computeStanceDelta(stance, 'vacancy')` to derive the floor.

---

## P3-03 — Agent-inferred stance write-back

The spec mentions `setBy: 'agent_inferred'` as a valid provenance value. The
live schema uses `defaulted: boolean` (operator-set vs platform-default, no
agent-inferred state). There is no path for the Cashflow Agent to write back a
stance suggestion after observing the deal's data patterns.

Fix (Phase 3): add `setBy: 'operator' | 'platform_default' | 'agent_inferred'`
to `OperatorStance`. Wire `cashflow.postprocess.ts` to optionally write an
`agent_inferred` stance when it detects signals (late-cycle submarket, rising
vacancy trend, etc.) that justify a non-MARKET default.

---

## P3-04 — Frontend types mirror gap

`frontend/src/stores/dealContext.types.ts` (line 751+) carries the frontend
mirror of `OperatorStance`. A comment at line 5 says a separate
`frontend/src/types/operator-stance.ts` file should exist and be kept in sync,
but it doesn't exist. The import source for `StanceTab.tsx` is
`dealContext.types.ts`, so the missing file is low-risk today.

Fix (Phase 3): create `frontend/src/types/operator-stance.ts` as the canonical
frontend type file and update `dealContext.types.ts` to re-export from it
(single source of truth).

---

## P3-05 — Coordinator synthesize stance lens depth ✅ FIXED (May 2026)

Phase 1B injects a one-sentence "OPERATOR THESIS LENS" into the Coordinator's
synthesis and question prompts. This is a framing hint — it doesn't change
numeric outputs. Phase 3 should deepen this: the Coordinator's synthesis prompt
should receive the full computed `affectedFields` list (which fields stance
actually modulated and by how much) so it can comment meaningfully on
"management budgeted for a tighter market than the platform default".

Fix shipped:
- `SYNTHESIS_PROMPT` now has a `{{stanceEffects}}` slot after the cashflow block.
- `synthesize()` accepts optional `affectedFields: AffectedField[]`; renders a
  "STANCE MODULATION ACTIVE" bullet list with fieldPath + deltaBps + trace.
- `handleFullAnalysis` calls `computeAffectedFields(dealId, stance)` before
  synthesis (non-fatal try/catch); passes result to `synthesize()`.
- `handleQuestion` injects a compact `Stance-modulated fields: …` line into the
  system context when the operator has a non-default stance.
