# External Agent Handoff — Engine Fix (Finding K + K-2 + L, PLUS new: M + O consolidated)

**Agent:** Claude Code (authorized by operator ratification)  
**Task:** Apply K + K-2 fixes to `deterministic-model-runner.ts` (✅ done) and Finding L to `financial-model-engine.service.ts` (✅ done). **NEW, not yet applied:** Findings M + O, consolidated below — requires a `runFullModel()` pure-function extraction.  
**Estimated time:** K + K-2 = 5 minutes (complete). L = 15 minutes (complete). M + O extraction = larger refactor, size not yet estimated by main agent (deliberately — this is engine-refactor scope, not a line-fix).

**Status update (2026-07-05):** K, K-2, and L are all applied and verified live (Bishop rebuild, commit `dad7ff702` + docs `9b799ba07`).
- K/K-2: `stabilizedNOI`, `exitValue`/`grossSalePrice`, and `netSaleProceeds` are correctly non-zero.
- L: `result.summary`/`debtMetrics` now rebuild from `adjustedDet` (assemble-once) after M11/M14 cycle. Live re-verification: `summary.loanAmount` = `debtMetrics.loanAmount` = `meta.m11CapitalStructure` amount = $21,024,006 (was $39M), DSCR 1.0424 (was 0.674), IRR -0.1021 (was null), equity multiple 0.589 (was 0) — all four surfaces now agree with `reasoning.walkthrough`. Gate 0 criterion met.
- **Finding O (INV-6 divergence, not fixed, bundled below):** `totalEquity` ($21M) vs. `totalAcqCost - loanAmount` implied equity ($39.37M) diverge by ~46.7%. Both quantities are read from the same already-refreshed post-M11/M14 state (this is not a Finding-L-pattern stale-pass artifact) — it's a separate reconciliation defect.
- **Finding M (harness-class, not an engine defect, bundled below):** `golden-deals.test.ts`'s Bishop path (`runWithBridge()`) calls `mapProFormaAssumptionsToModelAssumptions()` + a single-pass `runModel()` and never exercises the M11/M14 orchestration that Finding L's fix lives in. This means live `/build`-captured values (post-M11/M14) can never be pinned as `expected` against this harness — it's not fixable by reshaping the fixture's `rawAssumptions`.
- **Operator ruling (2026-07-05):** Both M and O require tracing/fixing inside the same M11/M14 multi-pass pipeline. Rather than two more one-line patches to `financial-model-engine.service.ts` (the same "patch in place across passes" pattern that produced Finding L), the operator has ruled this is external-agent engine-refactor territory: extract the build pipeline into one pure `runFullModel()` function. See "Fix 4" below for the full spec. **Not applied by main agent.** Highlands (seed-path, Finding N) has been independently pinned via a discriminated fixture-type refactor and a new real seed-actuals aggregator — that work is unrelated to this handoff and already merged.

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

---

## Fix 4: Findings M + O (consolidated) — `runFullModel()` Pure-Function Extraction (NEW — NOT APPLIED, engine-refactor scope)

**Status:** Verified live and documented 2026-07-05. **Not approved for the main agent to implement** — this is explicitly external-agent territory per operator ruling. Full finding detail in `W5-DISPATCH.md` ("Finding M", "Finding O", and the "Consolidated External-Agent Handoff" section immediately following Finding O).

### The two findings this fixes

**Finding M (harness-class):** `golden-deals.test.ts`'s Bishop path (`runWithBridge()`) calls:
```typescript
const modelAssumptions = mapProFormaAssumptionsToModelAssumptions(raw);
return runModel(modelAssumptions, { skipSensitivity: true }); // single pass, no M11/M14
```
This never runs the M11 debt-optimizer / M14 DSCR-floor two-pass cycle that lives in `financial-model-engine.service.ts`'s build orchestration (the same code Finding L's fix lives in). Live `/build`-captured values (post-M11/M14 — e.g. Bishop's $21,024,006 loan, 1.0424 DSCR) can never be pinned as `expected` against this harness; it will always compute the pre-M11 raw values ($39,000,000 loan, ~0.67 DSCR) instead. This is structural, not fixable by reshaping `rawAssumptions`.

**Finding O (engine-class, INV-6):** On the same Bishop build response used to confirm Finding L live, `summary.totalEquity` ($21,024,006-loan-implied) and `totalAcqCost - loanAmount` (~$39.37M) diverge by ~46.7%. Both quantities come from the same already-refreshed post-M11/M14 state (Finding L is fixed, this is not a stale-pass artifact) — it is a separate reconciliation defect in how `totalEquity` is derived relative to the acquisition-cost/loan/equity identity.

### Why one extraction fixes both

Both findings trace back to the same root condition: the M11/M14 build pipeline in `financial-model-engine.service.ts` is not a single callable, testable, pure function. It is a sequence of `runModel()` calls interleaved with DB reads (for M11 debt sizing lookups) and in-place mutation of a partially-assembled `result` object across two passes — the same pattern that produced Finding L (a stale-sibling-field bug from patching `result` piecemeal across passes).

### Required extraction

Extract the pipeline into a pure function:

```typescript
function runFullModel(assumptions: ModelAssumptions): FinancialModelResult {
  // Pass 1
  const pass1 = runModel(assumptions, { skipSensitivity: true });

  // M11 debt-optimizer / M14 DSCR-floor cycle
  // — MUST take all required inputs as parameters (no DB reads inside this function)
  const adjustedAssumptions = runM11M14Cycle(assumptions, pass1);

  // Pass 2
  const pass2 = runModel(adjustedAssumptions, { skipSensitivity: true });

  // Assemble once, from final post-cycle state — not patched piecemeal
  return modelResultsToFinancialModelResult(pass2);
}
```

Constraints (all required, not optional):
1. **No DB reads inside `runFullModel()`.** Any data the M11/M14 cycle currently fetches from the DB (debt product terms, rate sheets, etc.) must be resolved by the caller and passed in as part of `assumptions` or a sibling parameter. This is what makes the function callable identically from both the live `/build` route and a test harness.
2. **Single assembly point.** The returned `FinancialModelResult` (`summary`, `debtMetrics`, `evidence`, `reasoning`, `meta`) must all be derived from the same final `pass2` result in one call to `modelResultsToFinancialModelResult()` (or equivalent) — never partially overwritten field-by-field across passes. This closes off the entire class of bug Finding L was an instance of, not just that one call site.
3. **Add an equity-identity check** (Finding O) as part of that single assembly step: verify `totalEquity` reconciles with `totalAcqCost - loanAmount` to a reasonable tolerance, and surface a check (e.g. extend `INV-6`) if it doesn't. Trace where `totalEquity` is currently computed vs. where `totalAcqCost` is currently computed within the M11/M14 cycle — the divergence is very likely a case of one being computed pre-M14-resize and the other post-M14-resize (the same "different check reads different pass" pattern as Finding L), but this needs verification against the actual code, not assumed.
4. **`financial-model-engine.service.ts`'s build orchestration** (the code the live `/build` route calls) should call this same `runFullModel()` — do not create a second, diverging implementation. The live route's behavior post-refactor must be unchanged (same live-verified Bishop values: $21,024,006 loan, 1.0424 DSCR, -0.1021 IRR, 0.589 EM) except for the INV-6 fix.
5. **`golden-deals.test.ts`'s `runWithBridge()`** should be updated to call `runFullModel()` instead of the current single-pass `runModel()`, so the Bishop fixture's harness actually exercises the same pipeline the live endpoint does.

### Verification steps after this refactor

1. Compile guard: `cd backend && npx tsc --noEmit --skipLibCheck` — expect no new errors vs. the 319 baseline.
2. Rebuild Bishop via the live `/build` endpoint — confirm the four previously-verified surfaces still agree ($21,024,006 loan, 1.0424 DSCR, -0.1021 IRR, 0.589 EM) — i.e. this refactor must not regress Finding L's fix.
3. Confirm the `INV-6` check no longer flags a `totalEquity` vs. `totalAcqCost - loanAmount` divergence for Bishop.
4. Run `golden-deals.test.ts` with `runWithBridge()` now calling `runFullModel()` — Bishop's computed output should match the live `/build` capture from step 2 (within existing `TOLERANCE` bands).
5. Run `identity-invariants.test.ts` — expect 4/4 passing, unaffected.
6. **Do not pin Bishop's `expected` yourself.** Once steps 1–5 pass, hand back to the operator to review, capture live values, and pin `bishop.golden.ts` — same discipline as Fixes 1–3 above.
