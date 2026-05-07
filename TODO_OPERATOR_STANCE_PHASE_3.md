# OperatorStance — Phase 3 Side Debt

Logged during Phase 1B implementation (May 7, 2026). Items below were
surfaced during the Phase 1A audit and must NOT be fixed until Phase 3 is
scoped and approved.

---

## P3-01 — m28_rate_environment bridge

`m28_rate_environment.policy_stance` is a FRED-sourced string (e.g. "Neutral",
"Hawkish") observed from market data. It could pre-populate `rateEnvironment`
as a suggested default when an operator hasn't set a stance — giving the agent
platform signal as a starting point without overriding operator choice.

Current state: no bridge. `m28.policy_stance` and `OperatorStance.rateEnvironment`
are entirely separate paths. The economic-context route exposes `policy_stance`
but nothing reads it into stance.

Fix: in `operatorStance.service.ts → getStance()`, when the persisted stance is
null, check `m28_rate_environment` and map its `policy_stance` and
`forward_direction` to `rateEnvironment` as a `setBy: 'platform_default'`
suggestion (not an operator write).

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

## P3-05 — Coordinator synthesize stance lens depth

Phase 1B injects a one-sentence "OPERATOR THESIS LENS" into the Coordinator's
synthesis and question prompts. This is a framing hint — it doesn't change
numeric outputs. Phase 3 should deepen this: the Coordinator's synthesis prompt
should receive the full computed `affectedFields` list (which fields stance
actually modulated and by how much) so it can comment meaningfully on
"management budgeted for a tighter market than the platform default".

Fix (Phase 3): pass `GET /stance/affected-fields` output alongside the
synthesize inputs. Extend `SYNTHESIS_PROMPT` to include a `{{stanceEffects}}`
slot with the field-level deltas.
