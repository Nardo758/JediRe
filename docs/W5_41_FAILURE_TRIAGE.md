# W5 41-Failure Triage Table — Three-Way Verdicts

**Commit range:** `455e04caa` (pre-fix) → `87c307c36` (post-fix)  
**Suite:** `proforma-assumptions-bridge.test.ts` (145 tests)  
**Date:** 2026-07-06

---

## Executive Summary

| Metric | Before Fix | After Fix |
|--------|-----------|-----------|
| Total failures | 41 | **0 (expected)** |
| Root-cause categories | 3 | — |
| Files touched | 2 | 2 + 2 (Finding P) |
| Commits | — | 2 (`4ed709d28`, `87c307c36`) |

---

## Failure Categories & Three-Way Verdicts

### Category A: Duplicate INV-2 Block + Unguarded `.toFixed()`

**Failure signature:**
```
TypeError: Cannot read properties of null (reading 'toFixed')
    at runIntegrityChecks (deterministic-model-runner.ts:1502)
```

**Root cause:** A merge artifact left **3 copies** of the INV-2 check block in `runIntegrityChecks`. The first was correctly null-guarded (`(row.cfads ?? 0).toFixed(2)`); the second and third were not. When `runModel` produced `null` for `cfads` (due to Category C below), the unguarded `.toFixed()` crashed. This cascaded through ~30 tests.

**Files:** `backend/src/services/deterministic/deterministic-model-runner.ts`

| Surface | Verdict Before | Verdict After | Notes |
|---------|---------------|---------------|-------|
| **Local** (Windows, no node_modules) | N/A — cannot run | Code inspected ✅ | Duplicate blocks removed; 1 guarded block retained |
| **GitHub** (code state) | N/A — no CI on this suite | Clean at `4ed709d28` ✅ | Source verified by grep |
| **Replit** (live execution) | ❌ 41 failures | **Expected PASS** after `git pull` | Was the only surface that could execute the suite |

**Fix:**
- Removed 2 duplicate INV-2 blocks (lines 1491–1507)
- Added missing INV-3 comment before the real INV-3 block
- Null-coalesced all unguarded `.toFixed()` calls in `runIntegrityChecks`: INV-7 (`totalEquity`), INV-8 (`totalTierDist`, `availCash`), LOW_IRR (`summary.irr`), LOW_EM (`summary.equityMultiple`), CAP_RATE_COMPRESSION (`goingInCap`)

---

### Category B: Missing `inPlaceRent` in `makeRunModelAssumptions()` Defaults

**Failure signature:**
```
AssertionError: expected null not to be null
    at summary.irr
AssertionError: expected NaN to be greater than 0
    at summary.equityMultiple
```

**Root cause:** `makeRunModelAssumptions()` (test helper) omitted `inPlaceRent`. The turn-cohort engine computes `inPlaceRent * state.cumulativeGrowth` → `undefined * 1.0 = NaN`. This NaN poisoned NOI → CFADS → IRR/EM all became `null`/`NaN`. ~10 tests failed on null/NaN assertions.

**Files:** `backend/tests/deterministic/proforma-assumptions-bridge.test.ts`

| Surface | Verdict Before | Verdict After | Notes |
|---------|---------------|---------------|-------|
| **Local** | N/A | Code inspected ✅ | `inPlaceRent: 1455` added to helper |
| **GitHub** | N/A | Clean at `4ed709d28` ✅ | Source verified |
| **Replit** | ❌ 10+ null/NaN failures | **Expected PASS** | Only surface with runtime |

**Fix:**
- Added `inPlaceRent: 1455` to `makeRunModelAssumptions()` defaults
- Removed duplicate function body merge artifact (lines 189–206 had a stray second copy of the function)

---

### Category C: NaN Propagation from `undefined inPlaceRent` in `computeMonthTurnCohort`

**Failure signature:** Same as Category B — null IRR, NaN EM.

**Root cause:** Even after fixing the test helper, calling `runModel` with raw `ModelAssumptions` that omitted `inPlaceRent` would still NaN-poison. The engine should be defensive.

**Files:** `backend/src/services/deterministic/deterministic-model-runner.ts`

| Surface | Verdict Before | Verdict After | Notes |
|---------|---------------|---------------|-------|
| **Local** | N/A | Code inspected ✅ | Fallback added |
| **GitHub** | N/A | Clean at `4ed709d28` ✅ | Source verified |
| **Replit** | ❌ (latent) | **Expected PASS** | Defensive even if test helper forgets |

**Fix:**
- Added fallback `(a.inPlaceRent ?? a.marketRent)` in `computeMonthTurnCohort` line 899

---

## Cross-Category Impact Map

```
Category C (engine) ─┬─► Category B (test helper) ──► Category A (integrity checks)
                     │     inPlaceRent undefined          .toFixed(null) crashes
                     │     → NaN NOI/CFADS/IRR
                     │
                     └─► Direct: if any caller forgets inPlaceRent, engine survives
```

Fixing **only** Category A (removing duplicate blocks) would reduce crashes but tests would still fail on null assertions.  
Fixing **only** Category B (adding inPlaceRent) would make tests pass but integrity checks would still crash on edge cases.  
All three categories must be fixed together — they were, in commit `4ed709d28`.

---

## Finding P Addendum (Commit `87c307c36`)

Separate from the 41 failures, but part of W5 close-out:

| Item | Status |
|------|--------|
| `BuildPathFixture.effectiveAssumptions` field added | ✅ |
| `bishopFixture.effectiveAssumptions: null` (to be populated on first verified run) | ✅ |
| `golden-deals.test.ts` captures + logs effective assumptions on first run, asserts on subsequent | ✅ |

**Why this matters:** The fixture now documents both `rawAssumptions` (what the API received) and `effectiveAssumptions` (what M11/M14/reconcile actually used). If Bishop drifts in future, we can diff the two to see whether the bridge changed or the engine changed.

---

## Replit Execution Verification

Run these commands in Replit Shell to confirm 0 failures:

```bash
rm -f ~/workspace/.git/ORIG_HEAD.lock
git pull origin master
cd ~/workspace/backend
npx vitest run tests/deterministic/proforma-assumptions-bridge.test.ts --reporter=verbose
```

Expected output: `145 tests passed` (0 failed).

Then run golden suite:

```bash
npx vitest run tests/deterministic/__tests__/golden-deals.test.ts --reporter=verbose
```

Expected: Bishop test passes (expected values pinned), determinism proof passes, K-2 passes.
