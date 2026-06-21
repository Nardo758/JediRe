# AUDIT DISPATCH — Plumbing Subsystems & Architectural Invariants (Horizontal)

**Mode:** READ-ONLY. Report only. Zero code changes, zero migrations, zero fixes. Findings go in
the report, not in commits.

**Scope:** the shared infrastructure every deal chain rides on, channel-agnostic. This is NOT a
data-chain audit (that's the S1 chat dispatch). This audits the *pipes* and whether they're
*correct*, not just present. Two parts: (1) subsystem health sweep across the §B cross-cutting
subsystems; (2) invariant conformance. Both keyed to `JEDI_RE_MASTER_SPEC_INDEX.md` §B and the
ground rules in `CLAUDE.md`.

**Repo:** `github.com/Nardo758/JediRe.git`. Record the `HEAD` SHA at the top of your report.

**De-dupe with the S1 chat audit:** that audit verified the agent runtime *for the chat slice*.
This one verifies the same subsystems *platform-wide*. Where they overlap (agent runtime, CoStar
scope, FL hardcoding, Tavily), this audit's question is "is the property true everywhere," not "is
the chat path WIRED." Don't re-run the chain trace; check the subsystem as a subsystem.

---

## CARDINAL RULE (same as the chain audit)

Specs describe intent. They are not evidence. Neither is `BUILD_STATUS.md`, registry `buildStatus`,
a green test, or a prior agent's report. Every claim carries **(a) a `file:line` code path traced
caller→callee, or (b) a pasted live-DB query result.** A doc citation as sole evidence is rejected.

Several subsystems below are *known to be partial or absent* per the Master Spec Index §D — e.g.
the third-party licensing `scope_id` lives only in `CORRELATION_TERMINAL_SCOPE_SPEC.md`, which is
"NEW — not yet in repo." For those, the correct finding is **ABSENT**, reported fast. Do not hunt
for plumbing the index already says doesn't exist; confirm it's still missing and move on.

---

## PART 1 — SUBSYSTEM HEALTH SWEEP

For each subsystem: assign a label (WIRED / PARTIAL / STUB / MOCK / ORPHANED / ABSENT, defined
below), cite evidence, and answer the named failure-mode question. Tag each **[LAUNCH]** (a chain
the revenue path rides on) or **[STRUCTURAL]** (debt that doesn't block launch but rots if ignored).

1. **Agent runtime — `agents/runtime/`** **[LAUNCH]**
   Platform-wide, not chat-slice: does `BudgetEnforcer` actually abort runs at the caps, or are the
   caps declared and unenforced? Do agents use service-account credentials with RBAC, or is there a
   god-mode DB path that bypasses the API? Do agent actions land in `audit_log` with
   `actor_type='agent'` and a non-null `agent_run_id`? An agent that writes the DB directly without
   an audit row is the failure.

2. **Event Bus / Kafka — Kafka/Inngest topics** **[LAUNCH]**
   `docs/EVENT_PROPAGATION_AUDIT.md` already flagged orphaned bridges. For every published topic,
   find its consumer. Report: topics published with **no live subscriber** (events fire into void),
   consumers subscribed to topics **nothing publishes** (dead listeners), and any propagation that
   silently drops on error. The `leasing_cost_treatment.changed → F9 re-render` cascade in
   `LEASE_VELOCITY_ENGINE_SPEC.md §5` is a concrete chain to verify end to end.

3. **LayeredValue / provenance — `field-access/get-field-value.service.ts`** **[LAUNCH]**
   Confirm the resolution order is `broker > platform > user` as `CLAUDE.md` states (note: the
   Master Spec Index points at this file but doesn't restate the order — confirm the *code* matches
   the convention). Spot-check 5+ mutable fields across modules: is each actually wrapped in
   `LayeredValue<T>`, or are raw values leaking past the wrapper? Confirm `derived_from_search:true`
   is set on any field sourced from web search.

4. **DealStore message bus — `dealStore.ts`** **[STRUCTURAL]**
   The invariant is: modules subscribe to `dealStore` slices; **no direct cross-module imports.**
   Grep for imports between module components that bypass the store. Every direct import is a
   violation — report `file:line`. This is the single bus rule; a side channel breaks recomputation.

5. **Cache-stamp / freshness — cache layer (ADR-003)** **[LAUNCH]**
   The rule is no silent serve-stale. When a dependency is missing or a cache entry is past its
   stamp, does the code serve stale data quietly, or does it surface the staleness? Find the cache
   read paths and report any that fall through to stale on miss without flagging.

6. **Authoritative-signal fallback — resolution chain (ADR-004)** **[LAUNCH]**
   Trace the fallback ladder. Confirm it degrades *visibly* (badge / flag / provenance), not
   silently. A fallback that substitutes a lower-authority signal with no provenance change is the
   failure mode — it makes a guess look like a fact downstream.

7. **Property plumbing / identity unification — property identity layer** **[STRUCTURAL]**
   `property-plumbing-phase2-write-path-inventory.md` is the anchor. Core question: does one address
   resolve to **one** property identity across both surfaces, or can chat and the web app mint
   divergent identities for the same parcel? Report any write path that creates property identity
   outside the unification layer.

8. **Vendor market data (Pieces A–D) — services/intake-sources, integrations** **[STRUCTURAL]**
   Confirm the vendor abstraction (Piece A) is the only ingress and field reconciliation (Piece B)
   actually runs — or whether a vendor's raw fields reach the DB unreconciled. Confirm
   divergence-as-quality-signal (Piece D) emits something, vs being spec-only.

9. **Third-party licensing scope (`scope_id`, Lane A/B)** **[LAUNCH — licensing]**
   The two-lane model: Lane A = `GLOBAL` (platform-licensed, redistributable), Lane B = `user:<id>`
   (user-licensed, deal-scoped, **never** written to the shared corpus). Check for the `scope_id`
   column on `metric_time_series`, `metric_correlations`, `correlation_history`. Per §D this is
   likely **ABSENT** (spec not yet in repo). If absent: state it plainly and flag that, until it
   exists, there is **no structural barrier** stopping user/Lane-B or CoStar-derived data from
   landing in the shared corpus. That's the licensing exposure in one sentence.

10. **Data Library licensing primitive — `dataLibrary.service.ts`** **[STRUCTURAL]**
    Confirm `redistribution_restricted` is read at the points where data would be redistributed
    (shared corpus writes, capsule sharing, aggregated benchmarks), not just stored on the row.
    A restriction flag nobody checks is decoration.

11. **Correlation Engine — `correlationEngine.service.ts`** **[STRUCTURAL]**
    Confirm the recomputation cascade runs from real `apartment_market_snapshots` /
    `metric_time_series`, not seeded constants. Confirm it does **not** consume its own lagging
    outputs as inputs (the circular-reasoning trap called out in `TRAFFIC_ENGINE_CALIBRATION_SPEC
    §2`: rent growth, occupancy, JEDI score are outputs, never inputs).

12. **Field reconciliation / cross-surface read** **[STRUCTURAL]**
    `cross-surface-read-consistency.md` is the anchor. Does the same field resolve to the same value
    on chat and web, or can the two surfaces disagree on a resolved field for the same deal? Report
    any field whose resolution path forks by surface.

---

## PART 2 — INVARIANT CONFORMANCE

Each invariant is a predicate. Mark **PASS** (cite the code that enforces it), **VIOLATED** (cite
`file:line` of the violation), or **UNVERIFIED** (say why you couldn't reach it). "I read the spec
that says it should hold" is not PASS.

- **I1 — Derive-not-store.** Computed aggregates are derived on read, not persisted as snapshots
  that can drift. Find any aggregate written to a column and re-read as truth.
- **I2 — Version inputs, not outputs.** Versioning keys on (assumption set + data-snapshot hash),
  not on output artifacts. Find any versioning that stamps the output instead.
- **I3 — No silent serve-stale on missing deps.** (Pairs with subsystems 5/6.) A missing dependency
  must fail loud or flag, never quietly serve last-known.
- **I4 — Δ_operator is always an input, never a residual.** In the F9 pro-forma path, confirm
  `Δ_operator` is supplied, not back-solved from a gap. A residual computation is the violation.
- **I5 — Deterministic if-then is not agent work (Ground Rule #8).** Confirm the deterministic
  Underwriting Engine (`engine:cashflow`) owns pro-forma arithmetic / NOI bridge / debt / IRR, and
  the LLM call (`agent:cashflow`) is escalation-only. Any deterministic math inside the LLM call is
  a violation.
- **I6 — No `if (state === 'FL')` outside ruleset files.** Grep platform-wide. Any jurisdiction
  branch outside `src/services/{tax,insurance}/rulesets/` (or equivalent ruleset dirs) is a
  violation. Report every hit.
- **I7 — Web search is Tavily, fallback-only, never primary.** Platform-wide: any agent reaching
  Tavily before exhausting structured tools, or a non-Tavily search path, is a violation.
- **I8 — `dealStore` is the sole message bus.** (Pairs with subsystem 4.) Direct cross-module
  import = violation.
- **I9 — LayeredValue resolution order is uniform.** `broker > platform > user` everywhere. Any
  module resolving in a different order is a violation.
- **I10 — Lane B never reaches the shared corpus.** No `user:<id>`-scoped row is written to a
  `GLOBAL`-scoped table or aggregated into a shared benchmark. (If `scope_id` is ABSENT per
  subsystem 9, this invariant is structurally **unenforceable** today — say so.)
- **I11 — Agent runs are candidates, not versions.** A pro-forma version is cut only when resolved
  year-1 assumptions materially change. Confirm a routine agent re-run does not mint a version.
- **I12 — Tri-tab reconciliation.** Pro Forma (AS-IS + stabilized endpoints) ↔ Projections
  (year-by-year ramp) ↔ Assumptions (ramp curves) all reconcile to the same `ramp(t)`. Confirm one
  `ramp(t)` feeds all three, not three independent computations that happen to agree on the demo.
- **I13 — Stabilization resolved once.** The stabilization period is resolved a single time via the
  LeaseVelocityEngine and consumed by Pro Forma and Projections **without recomputation.** Any
  second computation of stabilization downstream is a violation.

---

## LIVE-DB CHECKS

Paste raw output. If you can't reach the live DB, mark the relevant items UNVERIFIED — do not infer
from schema files (the forceReseed lesson: schema ≠ populated ≠ wired).

1. `scope_id` presence: `\d metric_time_series`, `\d metric_correlations`, `\d correlation_history`
   — does the column exist? If yes, `SELECT scope_id, count(*) ... GROUP BY 1` — is anything
   actually scoped, or is it all NULL/GLOBAL?
2. Event bus liveness: list Kafka topics/consumer groups (or Inngest functions) and their last-seen
   activity. Idle topics = candidate orphans.
3. LayeredValue population: pick one deal, dump a resolved field's layers — confirm broker/platform/
   user layers are stored separately, not flattened.
4. Audit trail: `SELECT actor_type, count(*) FROM audit_log GROUP BY 1` — confirm agent actions are
   actually audited (non-zero `actor_type='agent'`).

---

## LABELS

WIRED / PARTIAL / STUB / MOCK / ORPHANED / ABSENT — same definitions as the S1 chat dispatch.
Subsystems get a label; invariants get PASS / VIOLATED / UNVERIFIED.

---

## DELIVERABLE

`PLUMBING_AND_INVARIANTS_AUDIT.md`:

1. **Header:** SHA, date, "READ-ONLY — no code changed."
2. **One-line verdict:** is the shared plumbing sound enough that chains built on it can be trusted?
   SOUND / FRAGILE-AT (list subsystems) / UNVERIFIED.
3. **Subsystem table:** one row per subsystem (1–12). Columns: Subsystem | Label | [LAUNCH]/
   [STRUCTURAL] | Evidence | Failure-mode answer.
4. **Invariant table:** one row per invariant (I1–I13). Columns: Invariant | PASS/VIOLATED/
   UNVERIFIED | Evidence.
5. **Launch-blocking shortlist:** every **[LAUNCH]** subsystem not WIRED and every VIOLATED
   invariant that sits under the chat chain. This is the list that gates revenue.
6. **Licensing exposure paragraph:** state plainly whether, today, there is a structural barrier
   preventing Lane-B / CoStar-derived data from reaching the shared corpus. One paragraph.
7. **Live-DB section:** the four query outputs, raw.

---

## STOP

Report and stop. No fixes, no fix dispatch. Wait for Leon to triage the launch-blocking shortlist
and pick the first pipe to repair.
