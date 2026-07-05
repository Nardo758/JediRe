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
to patch around.
