# External Agent Handoff — Engine Fix (Finding K + K-2)

**Agent:** Claude Code (authorized by operator ratification)  
**Task:** Apply two one-line fixes to `deterministic-model-runner.ts`, verify, commit  
**Estimated time:** 5 minutes  

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

**Do not pin fixtures yourself.** Only apply the two fixes, verify, and commit.
