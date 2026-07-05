# External Agent Handoff — Engine Fix (Finding K + K-2 + L)

**Agent:** Claude Code (authorized by operator ratification)  
**Task:** Apply K + K-2 fixes to `deterministic-model-runner.ts` (✅ done) and Finding L to `financial-model-engine.service.ts` (✅ done)  
**Estimated time:** K + K-2 = 5 minutes (complete). L = 15 minutes (complete).

**Status update (2026-07-05):** K, K-2, and L are all applied and verified.
- K/K-2: `stabilizedNOI`, `exitValue`/`grossSalePrice`, and `netSaleProceeds` are correctly non-zero.
- L: `result.summary`/`debtMetrics` now rebuild from `adjustedDet` (assemble-once) after M11/M14 cycle.

---

## Fix 1: Finding K — Off-by-One in Exit-Year NOI (LINE 1892)

**File:** `backend/src/services/deterministic/deterministic-model-runner.ts`

**Current (BUG):**
```typescript
const exitRow = annualRows[hold];
```

**Why it's wrong:**
- `aggregateMonthlyToAnnual()` produces `holdYears` rows
- Valid indices: `0` through `hold - 1`
- `annualRows[hold]` accesses one past the end → `undefined`
- `exitRow.noi` → `undefined` → `stabilizedNOI = 0`
- This corrupts the entire disposition: grossSalePrice=0, netSaleProceeds=0, irr=null, equityMultiple≈0

**Fix:**
```typescript
const exitRow = annualRows[hold - 1];
```

**Verification:** After fix, Bishop build should produce:
- `stabilizedNOI > 0` (was 0)
- `grossSalePrice > 0` (was 0)
- `irr` should be a positive number (was null)
- `equityMultiple` should be > 1 (was ≈ 0)

---

## Fix 2: Finding K-2 — INV-5 Severity Mask (LINES 1530–1543)

**File:** `backend/src/services/deterministic/deterministic-model-runner.ts`

**Current (BUG):**
```typescript
if (a.exitCap > 0 && disp.stabilizedNOI > 0) {
  // verify grossSalePrice
} else if (resolvedMode === 'development' || resolvedMode === 'ground_up' || resolvedMode === 'lease_up') {
  checks.push({ id: 'INV-5', status: 'warn', ... });
} else {
  checks.push({ id: 'INV-5', status: 'error', ... });
}
```

**Why it's wrong:**
- The `lease_up` branch downgrades INV-5 (stabilizedNOI ≤ 0) from ERROR to WARN
- When the engine bug (Finding K) causes stabilizedNOI=0, this downgrade lets corrupted output flow silently
- A structurally impossible exit value (stabilizedNOI=0 with exitCap>0) should be ERROR in **every mode**

**Fix:** Remove the mode-specific downgrade. All modes should hit the `else` branch when `stabilizedNOI <= 0`.

**Suggested replacement:**
```typescript
if (a.exitCap > 0 && disp.stabilizedNOI > 0) {
  // verify grossSalePrice
} else {
  checks.push({ id: 'INV-5', status: 'error', message: 'Stabilized NOI must be > 0 for disposition' });
}
```

**Note:** If there are legitimate cases where stabilizedNOI=0 is expected (e.g. true ground-up with zero operations at exit), that should be handled by an explicit `expectedStabilizedNOI` flag, not by blanket mode-based downgrade.

---

## Verification Steps

1. **Apply both fixes**
2. **Compile guard:**
   ```bash
   cd backend && npx tsc --noEmit --skipLibCheck
   # Expected: 319 errors (same as baseline — no new errors)
   ```
3. **Run golden suite:**
   ```bash
   cd backend && npm test -- deterministic/__tests__/golden-deals.test.ts
   # Expected: SyntheticDegenerate 1/1 passing (already green)
   # Bishop/Highlands still skipped (expected=null) — that's fine for this commit
   ```
4. **Run identity invariants:**
   ```bash
   cd backend && npm test -- deterministic/__tests__/identity-invariants.test.ts
   # Expected: 4/4 passing
   ```
5. **Commit:**
   ```bash
   git add backend/src/services/deterministic/deterministic-model-runner.ts
   git commit -m "fix(engine): Finding K — off-by-one in exit-year NOI lookup

   - annualRows[hold] → annualRows[hold-1] (line 1892)
   - Finding K-2: remove lease_up INV-5 downgrade (lines 1530-1543)
   - Fixes stabilizedNOI=0 corruption that nullified disposition math"
   ```

---

## Context (Why This Matters)

W5 close is the **golden fixture pinning ceremony** for the F9 deterministic engine. Three fixtures must pin:

1. **Bishop** (build-path) — 12 fields from live build endpoint
2. **Highlands** (seed-path) — 12 fields from seed/actuals surface  
3. **SyntheticDegenerate** (engine-level) — ✅ already pinned

Finding K blocked Bishop pinning because the captured `irr=null` and `equityMultiple≈0` are obvious garbage values. The fix is surgical and verified.

After your commit, the operator will:
- Re-run the capture script in Replit
- Verify Bishop produces plausible 12-field output
- Pin Bishop + Highlands fixtures
- Close W5

**Do not pin fixtures yourself.** Only apply the fixes, verify, and commit.

---

## Fix 3: Finding L — Stale `summary`/`debtMetrics` After M11/M14 Re-Run (NEW — open)

**File:** `backend/src/services/financial-model-engine.service.ts`
**Lines:** ~1573–1644 (inside the deal build flow)
**Scope:** Build-path only. Confirmed absent on the seed-path (Highlands has zero rows in `deal_debt_schedule`/`debt_positions`/`v_portfolio_debt_summary`, so it never enters M11/M14).

**Current (BUG) — condensed:**
```typescript
const deterministicResult = runModel(modelAssumptions, { skipSensitivity: true });
result = modelResultsToFinancialModelResult(deterministicResult);   // summary/debtMetrics set from PASS 1

// ... M11 debt optimizer + M14 DSCR-floor cycle mutate adjustedAssumptions ...

const adjustedDet = runModel(adjustedAssumptions, { skipSensitivity: true }); // PASS 2, post-adjustment
result.evidence = adjustedDet.evidence;
result.reasoning = { walkthrough: adjustedDet.reasoning.walkthrough, collisionReport: adjustedDet.reasoning.collisionReport };
// BUG: result.summary and result.debtMetrics are never reassigned from adjustedDet.
```

**Why it's wrong:** `evidence`/`reasoning` get refreshed from the post-M11/M14 run (`adjustedDet`), but `summary`/`debtMetrics` are frozen from the pre-adjustment run (`deterministicResult`). One API response ends up describing two different loans/cash-flow series as if they were the same deal.

**Live evidence (Bishop, single response, post K/K-2 fix):**
- `summary.loanAmount` = $39,000,000 (Pass 1, flat 65% LTV) vs. `reasoning.walkthrough` = "$21,024,006" (Pass 2, M14-resized)
- `summary.irr` = `null`, `summary.equityMultiple` = `0` (Pass 1 — cash flow is monotonic-negative under the stale $39M loan) vs. narrative = "-10.21% IRR ... 0.59x equity multiple" (Pass 2)
- `debtMetrics.dscr` = `0.67` (Pass 1, triggers `DSCR_BREACH` error) vs. narrative "Year-1 DSCR is 1.04" (Pass 2, matches the independently-computed `dscr_floor_binds` warning which reads `adjustedDet`'s `dscrActual`)

**Fix:** After the M11/M14 cycle runs and `adjustedDet` is computed, also rebuild `result.summary` and `result.debtMetrics` from `adjustedDet` (e.g. `const refreshed = modelResultsToFinancialModelResult(adjustedDet); result.summary = refreshed.summary; result.debtMetrics = refreshed.debtMetrics;`) at the same point `result.evidence`/`result.reasoning` are overwritten (around line 1640-1644). Preserve `result.meta` (m11/m14 convergence flags) which is assembled separately afterward — do not let the refresh clobber that.

**Suggested guardrail beyond the literal fix:** consider whether `summary`/`debtMetrics`/`evidence`/`reasoning` should always be derived together from one call site (e.g. a single `buildFinancialModelResult(finalDet)` helper invoked exactly once, after all mutation passes complete) rather than assembled once and patched piecemeal — this class of bug (partial refresh across a multi-pass pipeline) is a repeat pattern worth closing off structurally, not just patching at this one call site.

**Verification steps after fix:**
1. Rebuild Bishop via the build endpoint.
2. Confirm `summary.loanAmount`/`debtMetrics.loanAmount` now match the value quoted in `reasoning.walkthrough`.
3. Confirm `summary.irr` and `summary.equityMultiple` are finite/non-null and match (to reasonable rounding) the IRR/EM stated in the narrative.
4. Confirm `debtMetrics.dscr` matches the DSCR stated in the narrative and used by the `dscr_floor_binds` check.
5. Re-run `npm test -- deterministic/__tests__/golden-deals.test.ts` — SyntheticDegenerate should remain green; Bishop/Highlands remain `expected=null` placeholders until the operator captures and pins them in Replit.

**Do not pin fixtures yourself.** Only apply the fix, verify, and commit.
