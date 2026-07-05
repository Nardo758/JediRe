# W5 Dispatch — Deterministic Engine Golden Fixture Pinning

**Status:** BLOCKED on engine defect (Finding K)  
**Date:** 2026-07-04  
**Repo:** Nardo758/JediRe · backend port 4000 · master branch  
**Baseline:** 319 pre-existing TypeScript errors (unchanged by our changes)  
**Compile guard:** `npx tsc --noEmit --skipLibCheck` — no new errors introduced  

---

## W5 Close Criterion (Amended)

8/8 green = 6 identity suites + Bishop build-path + Highlands seed-path + synthetic degenerate + Phases 2–3

| Gate | Status | Notes |
|------|--------|-------|
| Identity Suite 1 (randomized) | ✅ PASS | 100 sets |
| Identity Suite 2 (randomized) | ✅ PASS | 100 sets |
| Identity Suite 3 (randomized) | ✅ PASS | 100 sets |
| Identity Suite 4 (randomized) | ✅ PASS | 100 sets |
| SyntheticDegenerate | ✅ PASS | 1/1 — engine-level guard pinned |
| Bishop Build-Path | ⏳ BLOCKED | Finding K — `stabilizedNOI=0` corrupts disposition |
| Highlands Seed-Path | ⏳ BLOCKED | Same root cause; also needs seed/actuals capture |
| Phases 2–3 (Excel parity) | ⏳ PENDING | Oracle-gated; runs after fixture pinning |

---

## Findings

### Finding K — ENGINE (blocker-class)

**File:** `backend/src/services/deterministic/deterministic-model-runner.ts`  
**Line:** 1892  
**Root cause:** Off-by-one in exit-year NOI lookup

```typescript
// BUG (current)
const exitRow = annualRows[hold];
// annualRows has indices 0..(hold-1) — hold rows total
// annualRows[hold] is one past the end → undefined → stabilizedNOI = 0

// FIX
const exitRow = annualRows[hold - 1];
// exit-year NOI = last operating year (index hold-1)
```

**Impact chain:**
1. `exitRow = undefined`
2. `forwardNOI = exitRow.noi = 0`
3. `stabilizedNOI = 0`
4. `grossSalePrice = stabilizedNOI / exitCap = 0`
5. `netSaleProceeds = grossSalePrice * (1 - saleCosts) = 0`
6. `equityProceeds = netSaleProceeds - loanBalance = -loanBalance` (negative)
7. `irr = null` (negative terminal equity → no positive-root IRR)
8. `equityMultiple ≈ 0`

**Evidence:** Both Bishop and SyntheticDegenerate hit this. Bishop's model narrative explicitly states: *"Exit is underwritten at a 5.00% cap rate in Year 5, producing a gross sale price of $0 and equity proceeds of $0. The levered IRR is n/a."*

**Fix complexity:** One line. `annualRows[hold]` → `annualRows[hold - 1]`.

**Ruled by:** Operator ratification — external agent (Claude Code) authorized to apply fix.

---

### Finding K-2 — INV-5 Severity Mask (structural)

**File:** `backend/src/services/deterministic/deterministic-model-runner.ts`  
**Lines:** 1530–1543  
**Root cause:** `lease_up` mode downgrades INV-5 (stabilizedNOI ≤ 0) from ERROR to WARN

```typescript
// CURRENT (K-2 BUG)
if (a.exitCap > 0 && disp.stabilizedNOI > 0) {
  // verify grossSalePrice
} else if (resolvedMode === 'development' || resolvedMode === 'ground_up' || resolvedMode === 'lease_up') {
  checks.push({ id: 'INV-5', status: 'warn', ... }); // ← K-2: should be ERROR
} else {
  checks.push({ id: 'INV-5', status: 'error', ... });
}
```

**Ruling:** Zero/absent stabilized NOI that **corrupts disposition math** is **ERROR in every mode**. A mode-specific WARN is only valid when stabilizedNOI is plausibly zero by design (e.g. ground-up with no operations at exit), NOT when it results from an engine bug that nullifies the exit value.

**Fix:** Remove the `lease_up` branch from the INV-5 downgrade. All modes should route to the `else` branch (ERROR) when `stabilizedNOI <= 0` and the exit value is structurally invalid.

**Note:** This finding was exposed by Finding K. Under normal operation, INV-5 would have fired as ERROR and the acceptance suite would have halted before any values were considered pin-worthy. The downgrade allowed corrupted output to flow silently through the narrative.

---

### Finding F-P1-A — Body Diff (noiYear1 delta)

**Context:** F-P1 (Build Boundary Provenance) finding cluster  
**Delta:** Bishop `noiYear1` differs between two surfaces:

| Surface | noiYear1 | Source |
|---------|----------|--------|
| Frontend-shipped body (earlier) | $1,357,881 | Client assumption copy |
| Store-sourced body (now, via construct-from-DB) | $1,576,800 | `deal_assumptions` row |

**This delta IS F-P1-A in the flesh.** The two bodies contain different assumptions. Before any Bishop field is pinned, we must:

1. Diff the two bodies (assumption-by-assumption)
2. Identify which assumptions differ
3. Document the diff in the fixture's `provenance.bodySource` field
4. Decide which body is authoritative for the golden fixture

**Current position:** The store-sourced body (`deal_assumptions` row) is the more authoritative source because it represents the actual persisted underwriting record. The frontend-shipped body may contain stale or client-local edits that were never persisted.

**Resolution path:** After engine fix + clean rebuild, capture the 12-field shape from the store-sourced body. Document F-P1-A in provenance so future maintainers understand the delta.

---

### Finding F-P1-B — noi.resolved Provenance Lie

**Context:** The `noi.resolved` field in some outputs was found to be inconsistent with its documented provenance chain. This is logged but not blocking W5. Documented for Phase 2 review.

---

### Finding F-P1-C — Absent deal_assumptions Must Return `modelNotBuilt: true`

**Context:** When a deal has no `deal_assumptions` row (e.g. `owned_import` like Highlands), the build endpoint should return `modelNotBuilt: true` with a clear reason, rather than silently default-building or failing opaquely.

**Status:** Logged for P1 remediation. Not blocking W5 (Highlands is seed-path, not build-path).

---

## Code State

### Files Modified by This Work

| File | Change | Status |
|------|--------|--------|
| `golden.types.ts` | Added `fixtureClass`, `pathBoundRule`, `originClass`, `bodySource` | ✅ Merged |
| `synthetic-degenerate.golden.ts` | Pinned with 12-field expected shape | ✅ Merged |
| `bishop.golden.ts` | Placeholder (fixtureClass='build_path') | ⏳ Pending capture |
| `highlands.golden.ts` | Placeholder (fixtureClass='seed_path') | ⏳ Pending capture |
| `golden-deals.test.ts` | Three-fixture regression harness | ✅ Merged |
| `capture-golden-fixtures.sh` | Updated for seed-path architecture, bc→awk, jq fallback paths | ✅ Fixed |
| `identity-invariants.test.ts` | 4 suites × 100 randomized sets | ✅ Merged |

### Files Requiring External Agent Fix

| File | Lines | Finding | Fix |
|------|-------|---------|-----|
| `deterministic-model-runner.ts` | 1892 | K — off-by-one | `annualRows[hold]` → `annualRows[hold - 1]` |
| `deterministic-model-runner.ts` | 1530–1543 | K-2 — INV-5 severity mask | Remove `lease_up` downgrade branch |

---

## Next Steps (Sequence-Locked)

1. **External agent fixes engine** (K + K-2) → commit
2. **Compile guard** — verify no new TypeScript errors
3. **Clean rebuild both deals** in Replit:
   - Bishop: construct-from-DB body → build endpoint → 12-field extraction
   - Highlands: seed/actuals surface → 12-field extraction
4. **Verify all 12 fields are plausible** (noiYear1 > 0, irr > 0, equityMultiple > 1, netProceeds > 0)
5. **Document F-P1-A body diff** in Bishop provenance
6. **Pin Bishop + Highlands fixtures**
7. **Run full golden suite** → expect 3/3 passing
8. **Excel parity (Phases 2–3)** — oracle-gated comparison

---

## Acceptance Criteria (W5 Close)

- [ ] `npm test -- deterministic/__tests__/golden-deals.test.ts` → 3/3 passing
- [ ] `npm test -- deterministic/__tests__/identity-invariants.test.ts` → 4/4 passing
- [ ] `npx tsc --noEmit --skipLibCheck` → 319 errors (no new)
- [ ] Bishop fixture has `expected` + `rawAssumptions` + `provenance` with F-P1-A documented
- [ ] Highlands fixture has `expected` + `provenance` with `originClass: 'owned_import'`
- [ ] Excel parity report generated (Phase 2–3)
