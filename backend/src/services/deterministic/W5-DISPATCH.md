# W5 Dispatch — Deterministic Engine Golden Fixture Pinning

**Status:** BLOCKED on engine defect (Finding K — fixed and verified live; Finding L — newly found, still open)  
**Date:** 2026-07-05  
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
| Bishop Build-Path | ⏳ BLOCKED (new: Finding L) | Finding K confirmed fixed live (`stabilizedNOI`, `exitValue`, `netProceeds` all correctly non-zero on rebuild). `irr`/`equityMultiple` still wrong — traced to a **new, separate** defect (Finding L), not a K regression. |
| Highlands Seed-Path | ⏳ NOT BLOCKED by L | Confirmed out of scope for Finding L (no financing data at all — see Finding L scope note). Still needs seed/actuals capture + 12-field extraction. |
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

### Finding L — Stale summary/debtMetrics After M11/M14 Re-Run (NEW, blocker-class)

**File:** `backend/src/services/financial-model-engine.service.ts`  
**Lines:** 1573–1644  
**Scope:** Build-path only (deals that go through the M11 debt optimizer / M14 risk cycle). Confirmed **not** applicable to Highlands (seed-path) — Highlands has zero rows in `deal_debt_schedule`, `debt_positions`, and `v_portfolio_debt_summary`, so it never enters this code path.

**Root cause:** Two `runModel()` calls happen per build, on two different assumption sets, and only half the result gets refreshed after the second call.

```typescript
// Pass 1 — original (pre-optimization) assumptions
const deterministicResult = runModel(modelAssumptions, { skipSensitivity: true });
result = modelResultsToFinancialModelResult(deterministicResult);
// ^ result.summary and result.debtMetrics are set HERE, from Pass 1

// ... M11 debt optimizer + M14 DSCR-floor risk cycle mutate `adjustedAssumptions` ...

// Pass 2 — adjusted assumptions (e.g. M14 resizes an undersized/oversized loan)
const adjustedDet = runModel(adjustedAssumptions, { skipSensitivity: true });
result.evidence = adjustedDet.evidence;       // ← overwritten from Pass 2
result.reasoning = { walkthrough: adjustedDet.reasoning.walkthrough, ... }; // ← overwritten from Pass 2
// result.summary and result.debtMetrics are NEVER reassigned from adjustedDet.
```

**Impact:** The API response ends up with `summary`/`debtMetrics` from Pass 1 sitting alongside `reasoning`/`evidence` from Pass 2 — two different loan sizes and two different cash-flow series describing themselves as one deal.

**Live evidence — Bishop, single build response (`/tmp/build_bishop.json`), captured post-Finding-K-fix:**

| Field | `summary`/`debtMetrics` (Pass 1, returned) | `reasoning.walkthrough` narrative (Pass 2, describes the actual M14-adjusted deal) |
|---|---|---|
| Loan amount | `$39,000,000` (flat 65% LTV) | "$21,024,006" |
| Y1 DSCR | `0.67` (`DSCR_BREACH` error fires) | "1.04" (matches `dscr_floor_binds` warning, which independently reads the Pass-2-derived `dscrActual`) |
| `irr` | `null` (`irr_not_computable` warn — cash flow is monotonic-negative because the stale $39M loan balance exceeds sale proceeds) | "-10.21%" |
| `equityMultiple` | `0` (`LOW_EM` warn, "0.00× < 1.5×") | "0.59x" |

Both sides of this table come from the **same JSON response, same request** — not a caching or stale-process artifact (ruled out: dev token fresh, backend restarted, single request/response pair inspected directly).

**Why this blocks Bishop pinning:** The operator's plausibility bar (`irr>0`, `EM>1`) can't be evaluated meaningfully — the returned `summary.irr`/`equityMultiple` are not a truthful readout of the M11/M14-adjusted deal that the platform actually decided to underwrite (per its own narrative and per the `dscr_floor_binds` check, which is itself computed from `adjustedDet`). This is not evidence the deal is "actually" bad; it's evidence the response is internally self-contradictory.

**Suggested repair direction (for the external agent to design, not applied here):** `result.summary` and `result.debtMetrics` must be rebuilt from `adjustedDet` (via `modelResultsToFinancialModelResult(adjustedDet)` or equivalent) at the same point `evidence`/`reasoning` are overwritten — i.e. after the M11/M14 cycle, not before. More durable framing: the final API response should be assembled once, from final post-cycle state, rather than partially mutated in place across two passes (same "derive-at-read-time, don't snapshot-then-patch" pattern as other stale-sibling-field defects in this codebase).

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

| File | Lines | Finding | Fix | Status |
|------|-------|---------|-----|--------|
| `deterministic-model-runner.ts` | 1892 | K — off-by-one | `annualRows[hold]` → `annualRows[hold - 1]` | ✅ Applied, verified live on Bishop rebuild |
| `deterministic-model-runner.ts` | 1530–1543 | K-2 — INV-5 severity mask | Remove `lease_up` downgrade branch | ✅ Applied |
| `financial-model-engine.service.ts` | 1573–1644 | **L — stale summary/debtMetrics after M11/M14 re-run (NEW)** | Rebuild `result.summary`/`result.debtMetrics` from `adjustedDet`, same point `evidence`/`reasoning` are refreshed | ✅ Applied — assemble-once rebuild with m11Warnings preservation |

---

## Next Steps (Sequence-Locked)

1. ~~External agent fixes engine (K + K-2) → commit~~ ✅ Done, verified live
2. **External agent fixes Finding L** in `financial-model-engine.service.ts` → commit
3. **Compile guard** — verify no new TypeScript errors
4. **Clean rebuild both deals** in Replit:
   - Bishop: construct-from-DB body → build endpoint → 12-field extraction
   - Highlands: seed/actuals surface → 12-field extraction (unaffected by L — confirmed no financing data in DB for this deal)
5. **Verify all 12 fields are plausible** (noiYear1 > 0, irr > 0, equityMultiple > 1, netProceeds > 0)
6. **Document F-P1-A body diff** in Bishop provenance
7. **Pin Bishop + Highlands fixtures** — not before now; do not pin known-corrupted `irr`/`equityMultiple` values as an interim baseline (would invert the golden suite into a bug-preservation mechanism against L's own future fix)
8. **Run full golden suite** → expect 3/3 passing
9. **Excel parity (Phases 2–3)** — oracle-gated comparison

---

## Acceptance Criteria (W5 Close)

- [ ] `npm test -- deterministic/__tests__/golden-deals.test.ts` → 3/3 passing
- [ ] `npm test -- deterministic/__tests__/identity-invariants.test.ts` → 4/4 passing
- [ ] `npx tsc --noEmit --skipLibCheck` → 319 errors (no new)
- [ ] Bishop fixture has `expected` + `rawAssumptions` + `provenance` with F-P1-A documented
- [ ] Highlands fixture has `expected` + `provenance` with `originClass: 'owned_import'`
- [ ] Excel parity report generated (Phase 2–3)
