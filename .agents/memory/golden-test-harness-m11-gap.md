---
name: Golden fixture harness gap — M11/M14 orchestration not exercised
description: Why the Bishop build-path golden test cannot validate anything that lives in the multi-pass debt-optimizer cycle
---

The Bishop golden fixture's test path (`golden-deals.test.ts`'s `runWithBridge()`) calls
`mapProFormaAssumptionsToModelAssumptions()` followed by a **single-pass**
`runModel()` from `deterministic-model-runner.ts`. It never invokes the M11
debt-optimizer / M14 DSCR-floor two-pass cycle — that orchestration only exists
inside `financial-model-engine.service.ts`'s build-endpoint code path.

**Why:** Any live `/build`-endpoint capture for a deal where M11/M14 actually
resizes the capital stack (i.e. most real deals) will permanently disagree with
what `runWithBridge()` produces, because the bridge harness always uses the raw
pre-M11 requested loan amount/terms. This is not a `rawAssumptions` shape bug —
reshaping the fixture input cannot make the two paths converge.

**How to apply:** Before pinning any build-path golden fixture (or adding a new
one) from a live `/build` capture, confirm the test harness that will replay it
actually calls the same orchestration function the live endpoint uses. If it
only calls `runModel()` directly, either fix the harness to call the real build
orchestration, or explicitly scope the fixture to pre-M11/M14 output only (and
capture `expected` by running the harness locally, not from `/build`). Do not
force a pin across a path mismatch — treat it as a blocker, not a shape problem
to patch around. Only an engine-level extraction (a pure, DB-free
`runFullModel()` combining pass1 → M11/M14 → pass2 → single assembly) actually
closes this gap; a bundled reconciliation defect (`totalEquity` vs.
`totalAcqCost - loanAmount` diverging ~47%) was found in the same pipeline and
should be fixed as part of the same refactor rather than patched separately —
piecemeal patches to a multi-pass pipeline are what created this class of bug
in the first place.

## Seed-path fixtures (owned_import deals) — no proforma/return shape

Deals with origin class `owned_import` (already-owned, never underwritten
on-platform) have no acquisition/financing/exit assumptions, so a shared
12-field "proforma/return" expected shape (irr, equityMultiple, dscr, cap
rates, etc.) cannot be honestly populated — most of those fields simply don't
exist as real data for such a deal.

**Rejected approach:** making the fixture's `expected` a `Partial<>` of the
existing 12-field type so the test "only asserts fields that are present."
That is a known-wrong/degrading pin wearing a type signature — fields can
silently disappear from what's asserted over time without the test suite
saying so.

**Resolution used:** turned the fixture type into a true discriminated union
keyed on a `fixtureClass` field, giving the seed-path variant its own narrower
expected shape (annual EGI/NOI-margin/opex-ratio/boundary) built from a pinned
raw snapshot of the underlying monthly actuals table, verified by running a
real (non-test-only) production aggregator over that snapshot — not comparing
two hand-computed constants to each other.

**How to apply:** When a new fixture doesn't fit an existing fixture class's
data surface, extend the discriminated union with a properly-typed variant
backed by real aggregation/computation code, rather than making the shared
type `Partial<>` to force-fit it.

**Watch out:** when pinning a fixture from a raw DB snapshot, generate the row
literals programmatically (script writes the fixture file) rather than
hand-typing them from viewing query output in chat — hand-transcription
silently drifted from the real values on the first attempt here (off by
$150k on annual EGI), caught only because the test then failed.
