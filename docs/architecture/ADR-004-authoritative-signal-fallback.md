# ADR-004: Authoritative-Signal Fallback Pattern

**Status:** Accepted · In production  
**Date:** May 2026  
**Deciders:** Platform architecture review  
**Supersedes:** —  
**Related:** ADR-001 (LayeredValue), ADR-002 (dealStore event bus), ADR-003 (cache-stamp pattern)

---

## Context

Several surfaces in the platform display a synthesized "verdict" or "score" that
can be produced by two qualitatively different mechanisms:

1. **An authoritative computed signal** — a comprehensive multi-dimensional
   composite stored in the database, computed by a dedicated engine or agent run
   (e.g. `jedi_scores.total_score`). High analytical value, but may be absent or
   stale for a given deal.

2. **A live-derived fallback** — a narrower signal computed in real time from
   whatever data the current view already has (e.g. `deriveRiskFlags()` in F8,
   `defaultRiskCategories` in F10). Always available, but limited in scope and
   not interchangeable with the authoritative signal.

**The conflation problem:** when both mechanisms exist and their labels imply the
same concept, they appear to measure the same thing but often disagree silently.
Users have no way to know which path produced the value they see, or whether the
two constructs would agree if both were present.

**The silent fallback problem:** when the authoritative signal is absent, surfaces
that use it silently fall back to scaffolded defaults or live-derived values
without surfacing the substitution. Downstream users interpret the fallback as if
it were the authoritative value, producing incorrect conclusions.

**The conflation incident (T-CONF-1):** F8 Decision ("DEAL VERDICT") and F1
Overview ("JEDI SCORE") both appeared to measure overall deal quality. In
practice:

- F1 `jedi_scores.total_score` is a broad market-plus-financial composite
  computed by the JEDI Score engine (demand, supply, momentum, position, risk
  dimensions).
- F8's live verdict (CAUTION / PROCEED WITH REVIEW / FAVORABLE) was derived
  purely from IRR, DSCR, occupancy, exit cap, and equity multiple — a narrow
  financial-risk signal with no market dimension.

When `jedi_scores` was populated, the two surfaces would disagree without
explanation. When `jedi_scores` was absent, F8's verdict continued as if
it were the authoritative signal, with no indication of the substitution.

---

## Decision

**Consume the authoritative computed signal as the primary input. Fall back to
live derivation when the signal is absent or stale. Always surface which path
produced the current value. Never silently substitute one for the other.**

### Rules

1. **Primary path first:** When an authoritative signal is present and within its
   defined freshness window, it drives the output. The fallback is not consulted
   (except for conflict detection — see Rule 4).

2. **Explicit staleness threshold:** Each surface that applies this pattern must
   define a staleness constant. The threshold is configurable per surface; it is
   not hardcoded inline. Example: `JEDI_SCORE_STALE_DAYS = 30`.

3. **Mandatory provenance line:** Every surface applying this pattern must
   display a provenance line that tells the viewer which path produced the
   current value. The line must be visible without interaction — not behind a
   tooltip or collapsed panel. Approved formats:
   - `DERIVED FROM JEDI SCORE · {date}` — primary path
   - `DERIVED FROM INTEGRITY CHECKS · LIVE` — fallback path
   - `JEDI SCORE + INTEGRITY FLAGS · CONFLICT · {date}` — conflict path

4. **Conflict detection:** When the primary signal says the deal is in a
   favorable state but the fallback produces high-severity flags (e.g. IRR below
   threshold, DSCR below minimum), both inputs are surfaced simultaneously.
   The verdict renders as CONFLICT rather than letting either silently win. The
   conflict state is informational — it does not override the user's judgment.

5. **Never silently default to scaffolded values:** A surface that lacks both
   primary and fallback inputs must render an explicit "no signal" state (e.g.
   dashes, a disabled badge) rather than showing a stale cached value or a
   default string. Scaffolded defaults (e.g. hardcoded "CAUTION" when no data
   exists) are forbidden.

6. **Labels must be unambiguous across surfaces:** When two surfaces on the same
   screen can display verdicts, their labels must be distinct enough that a user
   cannot confuse which signal drives which display. Naming overlap that implies
   the same construct is a conflation bug.

### Score band thresholds (F8 DEAL SIGNAL application)

The following thresholds drive the F8 DEAL SIGNAL when the JEDI Score primary
path is active. All three constants live in `DecisionTab.tsx` and must not be
inlined:

| Constant | Value | Verdict |
|---|---|---|
| `JEDI_SCORE_FAVORABLE_THRESHOLD` | 80 | Score > 80 → FAVORABLE |
| `JEDI_SCORE_NEUTRAL_THRESHOLD` | 60 | Score 60–80 → PROCEED WITH REVIEW |
| — | below neutral | Score < 60 → CAUTION |
| `JEDI_SCORE_STALE_DAYS` | 30 | Score age > 30 days → use fallback |

---

## F8 DEAL SIGNAL — worked example

### Before (conflated)

- F8 section title: **"DEAL VERDICT"** — implied same construct as JEDI Score
- Verdict logic: `deriveRiskFlags()` only — no JEDI Score input
- Provenance: none visible
- On 464 Bishop (no `jedi_scores` row): operated identically to a deal with a
  populated score; substitution was invisible

### After (ADR-004 applied)

- F8 section title: **"DEAL SIGNAL"** — clearly describes a financial
  risk and operational feasibility signal, not the comprehensive JEDI Score
- Verdict logic: JEDI Score primary → fallback → conflict detection (see above)
- Provenance line: always visible in the F8 header strip
- On 464 Bishop (no `jedi_scores` row): fallback path fires;
  provenance reads `DERIVED FROM INTEGRITY CHECKS · LIVE`
- On a deal with a fresh `jedi_scores` row: primary path fires;
  provenance reads `DERIVED FROM JEDI SCORE · {date}`

### Label consistency

| Surface | Label | Signal source |
|---|---|---|
| F1 Overview | **JEDI SCORE** | `jedi_scores.total_score` — multi-dimensional market composite |
| F8 Decision | **DEAL SIGNAL** | JEDI Score (primary) or integrity flag derivation (fallback) |

These labels are now unambiguous and non-overlapping. A user reading both panels
will not conflate the two constructs.

---

## Consequences

**Positive:**
- Users always know which path produced a verdict — no hidden substitutions.
- JEDI Score and live integrity checks are no longer conflated — disagreements
  surface explicitly as CONFLICT rather than silently overriding each other.
- The pattern is composable: any future surface with a primary/fallback structure
  can follow the same rules without designing a new pattern.
- Fallback path produces the same outputs as before — no regression for deals
  without `jedi_scores` rows.

**Negative / constraints:**
- Every surface applying this pattern adds a data fetch for the authoritative
  signal (e.g. `GET /api/v1/jedi/score/:dealId`). This adds one network call per
  surface load. Acceptable for read-heavy verdict surfaces; would not be
  appropriate for high-frequency polling.
- The provenance line occupies header real estate. The F8 header strip is narrow;
  the provenance string is kept to one line with abbreviated formatting.
- Conflict state is informational only — it requires the user to interpret two
  signals simultaneously. On surfaces where a single actionable verdict is
  critical, an explicit "resolve conflict" workflow may be needed in the future.
- Score band thresholds are configurable constants, not user-editable. Changing
  thresholds requires a code change and deploy. A future enhancement could make
  them organization-configurable.

---

## Candidate Surfaces (not yet implemented)

The following surfaces have the same primary/fallback conflation risk and should
apply this pattern in a follow-up workstream:

| Surface | Authoritative signal | Current fallback | Risk |
|---|---|---|---|
| F10 Risk | `jedi_scores.risk_score` | `defaultRiskCategories` (scaffolded defaults) | Silent scaffolded defaults presented as computed values |
| F1 JEDI gauge (when `jedi_scores` absent) | `jedi_scores.total_score` | Score renders as 0 or —  | Currently correct (renders dashes); provenance line not present |
| Deal list JEDI column | `jedi_scores.total_score` | `deal_data.jedi_score` (legacy field) | Legacy field may be stale; substitution not surfaced |

---

## Implementation Locations

| Role | File |
|---|---|
| F8 DEAL SIGNAL (primary application) | `frontend/src/pages/development/financial-engine/DecisionTab.tsx` |
| JEDI Score API | `backend/src/api/rest/jedi.routes.ts` |
| JEDI Score service | `backend/src/services/jedi-score.service.ts` |
| F1 JEDI Score tile | `frontend/src/components/deal/sections/OverviewSection.tsx` |

---

## Related

- ADR-001 — LayeredValue (provenance model for persisted deal assumptions)
- ADR-002 — dealStore event bus (cross-tab event propagation)
- ADR-003 — cache-stamp pattern (inline-recompute fallback for stance-derived cached values)
- `docs/architecture/OPERATOR_STANCE_PHASE1_SPEC.md` — stance modulation (parallel provenance problem)
