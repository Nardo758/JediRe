# DISPATCH — Findings M + O Consolidated: `runFullModel()` Pure-Function Extraction

**Agent:** External (engine-refactor scope, not main agent)  
**Status:** NOT YET APPLIED. This is the single remaining blocker for W5 Bishop pinning.  
**Date:** 2026-07-05  
**Repo:** `Nardo758/JediRe` · `backend/src/services/deterministic/`, `backend/src/services/financial-model-engine.service.ts`  
**Operator ruling:** Main agent explicitly stopped at this boundary (2026-07-05). Do not apply one-line patches to `financial-model-engine.service.ts` — this requires a structural extraction, not a local fix.

---

## What This Dispatch Fixes

Two findings, one root cause: the M11/M14 build pipeline is not a single callable, testable, pure function.

| Finding | Class | Symptom | Root Cause |
|---------|-------|---------|------------|
| **M** | Harness | `golden-deals.test.ts` can't pin Bishop because `runWithBridge()` calls single-pass `runModel()`, never the M11/M14 cycle | Pipeline is inline in `financial-model-engine.service.ts`, not extractable |
| **O** | Engine | `totalEquity` vs `totalAcqCost - loanAmount` diverges ~46.7% post-M11/M14 | Same multi-pass pipeline — likely one quantity computed from pre-resize state, one from post-resize |

**Why bundle them:** Diagnosing O properly requires tracing `totalEquity` and `totalAcqCost` through the same multi-pass pipeline that produced L. Fixing M and O independently, one call site at a time, is exactly the "patch in place across two passes" pattern that produced L. Both need the same structural remediation.

---

## The Quarantined L Values (Post-O Verification Target)

These are the live-verified Bishop values from Gate 0 (2026-07-05), captured from `POST /api/v1/financial-model/build`, saved as `/tmp/build_bishop.json`. **They are NOT pinned yet — they are quarantined pending O close.**

| Field | Value | Surface | O-sensitivity |
|-------|-------|---------|---------------|
| Loan amount | $21,024,006 | `summary` / `debtMetrics` / `meta.m11CapitalStructure` / `reasoning.walkthrough` | Low — debt-side, not equity-derived |
| DSCR Y1 | 1.0424 | `debtMetrics` / `reasoning.walkthrough` | Low — coverage ratio, not equity-derived |
| IRR | -10.21% | `summary` / `reasoning.walkthrough` | **High** — equity-derived, may embed O bug |
| Equity multiple | 0.589x | `summary` / `reasoning.walkthrough` | **High** — equity-derived, may embed O bug |

**Post-O verification procedure:** After you apply this refactor, re-run the same Bishop `/build` capture and diff against these four values. If equity-side values (IRR, EM) move and NOI-side values (loan amount, DSCR) don't, that's direct behavioral proof O was real and is now fixed. Free S1-01 evidence — the baseline is already captured.

**Do not use these values as a Bishop pin until O is verified closed.** They are a verification target, not a fixture.

---

## Required Deliverable: `runFullModel()`

Extract the deal-build pipeline from `financial-model-engine.service.ts` (~lines 1573–1708) into a pure, DB-free, single-assembly function:

```typescript
// signature sketch — adapt to actual types
function runFullModel(
  assumptions: ModelAssumptions,
  debtContext: DebtContext, // M11 inputs that currently come from DB queries
): FinancialModelResult {
  // Pass 1: baseline
  const pass1 = runModel(assumptions, { skipSensitivity: true });

  // M11/M14 cycle: adjust assumptions based on debt optimization + DSCR floor
  const adjustedAssumptions = runM11M14Cycle(assumptions, pass1, debtContext);

  // Pass 2: final
  const pass2 = runModel(adjustedAssumptions, { skipSensitivity: true });

  // Single assembly point — all fields derived from pass2, never patched piecemeal
  const result = modelResultsToFinancialModelResult(pass2);

  // O: equity-identity check as part of assembly
  verifyEquityIdentity(result, adjustedAssumptions); // or equivalent

  return result;
}
```

### Constraints (all required, not optional)

1. **No DB reads inside `runFullModel()`.** Any data the M11/M14 cycle currently fetches from the DB (debt product terms, rate sheets, `deal_debt_schedule`, `v_portfolio_debt_summary`) must be resolved by the caller and passed in as `debtContext` or a sibling parameter. This is what makes the function callable identically from both the live `/build` route and a test harness.

2. **Single assembly point.** `summary`, `debtMetrics`, `evidence`, `reasoning`, `meta` must all derive from the same final `pass2` result in one call to `modelResultsToFinancialModelResult()` (or equivalent). Never partially overwrite field-by-field across passes. This closes the entire stale-sibling-field class of bug that produced L.

3. **INV-6 reconciliation (Finding O)** as part of assembly. Verify `totalEquity` reconciles with `totalAcqCost - loanAmount` to a reasonable tolerance. If they diverge, surface it as an `integrityChecks` entry (extend existing `INV-6`). Trace where `totalEquity` and `totalAcqCost` are computed within the M11/M14 cycle — the divergence is likely pre-resize vs post-resize state mixing, but verify against the code.

4. **Live route uses the same function.** `financial-model-engine.service.ts`'s build orchestration must call `runFullModel()` — do not create a second, diverging implementation. Live behavior must match the quarantined L values (within rounding) except for the INV-6 fix.

5. **Test harness uses the same function.** `golden-deals.test.ts`'s `runWithBridge()` must call `runFullModel()` (passing a `debtContext` with the same debt terms the live route would resolve) instead of the current single-pass `runModel()`.

---

## Acceptance Criteria (Must All Pass)

These are the gates this dispatch owns. Do not report "done" until all are green.

### Core Refactor
- [ ] `runFullModel()` extracted as pure, DB-free function in `deterministic/` directory
- [ ] `financial-model-engine.service.ts` build orchestration calls `runFullModel()` — no duplicate inline pipeline
- [ ] `golden-deals.test.ts` `runWithBridge()` calls `runFullModel()` with appropriate `debtContext`
- [ ] Compile guard: `node node_modules/typescript/bin/tsc --noEmit --skipLibCheck` — no new errors in deterministic or financial-model-engine directories

### Live Verification (Bishop, same capture procedure as Gate 0)
- [ ] Re-run `POST /api/v1/financial-model/build` for Bishop
- [ ] Loan amount ≈ $21,024,006 and DSCR ≈ 1.04 — must match quarantined L values (no regression)
- [ ] IRR and EM are finite, non-null — may differ from quarantined values if O is fixed; document the delta
- [ ] `reasoning.walkthrough`, `summary`, `debtMetrics`, `meta.m11CapitalStructure` all internally consistent

### Finding O Verification
- [ ] INV-6 check does NOT flag a `totalEquity` vs `totalAcqCost - loanAmount` divergence for Bishop
- [ ] If the check was previously firing, document the before/after values as evidence

### Test Suite
- [ ] `golden-deals.test.ts` — Bishop now passes (expected values match harness output), Highlands and SyntheticDegenerate remain green
- [ ] `identity-invariants.test.ts` — 4/4 passing, unaffected
- [ ] Full suite: 3/3 golden + 4/4 identity = 7/7 passing

### K-2 Lease_Up Test (dependent on this dispatch, not orphaned)
- [ ] Add a dedicated `lease_up`-mode test case that exercises INV-5 with `stabilizedNOI <= 0` and confirms it fires `status: 'error'` (not `'warn'`). The SyntheticDegenerate fixture covers `existing` mode only; `lease_up` mode has no test coverage today. This is the acceptance criterion that closes the K-2 test gap.

### Bishop Pin (dependent on this dispatch, not orphaned)
- [ ] Populate `bishop.golden.ts` `expected` from a fresh live `/build` capture (post-M+O), `rawAssumptions` from the store-sourced construct-from-DB body, `provenance` with F-P1-A body-diff context
- [ ] Run `golden-deals.test.ts` — expect 3/3 passing
- [ ] Commit: "Pin Bishop golden fixture — build-path, post-M+O refactor, live-verified"

---

## What NOT To Do

- **Do not apply one-line patches to `financial-model-engine.service.ts`.** The operator explicitly rejected this (2026-07-05). The pattern that produced L is "patch result piecemeal across passes"; doing more of the same produces more L-class bugs.
- **Do not pin Bishop before O is verified.** The quarantined L values are a verification target, not a fixture. Pinning them now would embed a potentially O-contaminated baseline.
- **Do not create a second `runFullModel()` for tests.** The whole point is one pipeline, one behavior, testable. A test-only copy would re-create the harness gap (Finding M) in a different form.
- **Do not touch the Highlands or SyntheticDegenerate fixtures.** They are already pinned and passing independently. This dispatch only touches Bishop and the engine pipeline.

---

## Context (Where This Sits in W5)

W5 close criterion: 8/8 green = 6 identity suites + Bishop + Highlands + SyntheticDegenerate + Phases 2–3

| Gate | Status | Owner |
|------|--------|-------|
| Identity 1–4 | ✅ PASS | Main agent |
| SyntheticDegenerate | ✅ PASS | Main agent |
| Highlands | ✅ PINNED | Main agent (Finding N) |
| **Bishop** | ⏳ **BLOCKED on this dispatch** | **External agent (this handoff)** |
| Phases 2–3 | ⏳ BLOCKED on Bishop pin | External agent (after this dispatch) |
| K-2 lease_up test | ⏳ BLOCKED on this dispatch | External agent (acceptance criterion) |

**After this dispatch closes:** Bishop pins → full suite 3/3 → Phases 2–3 → W5 closes → TS-1 unlocks → F-P1 queues (A: build-boundary, B: noi.resolved, C: owned_import absence).
