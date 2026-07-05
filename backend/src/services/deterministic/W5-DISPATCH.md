# W5 Dispatch — Deterministic Engine Golden Fixture Pinning

**Status:** Highlands + SyntheticDegenerate PINNED. Bishop BLOCKED — requires external-agent engine refactor (Finding M, bundled with Finding O). Not fixed by main agent per operator ruling (M is engine-refactor territory).  
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
| Bishop Build-Path | ⏳ BLOCKED (Finding M, bundled with Finding O) | Finding K confirmed fixed live (`stabilizedNOI`, `exitValue`, `netProceeds` all correctly non-zero on rebuild). Finding L confirmed fixed live (Gate 0 met — see evidence table below). Pinning remains blocked because the test harness cannot exercise the M11/M14 orchestration Finding L's fix lives in (Finding M) — this requires an engine refactor (`runFullModel()` pure-function extraction), which is external-agent territory, not applied here. |
| Highlands Seed-Path | ✅ PASS — PINNED 2026-07-05 | Finding N resolved: `GoldenFixture` refactored to a discriminated union (`fixtureClass: 'build_path' \| 'seed_path' \| 'synthetic'`, typed `BuildExpected \| SeedExpected`). Fixture now pins a raw snapshot of `deal_monthly_actuals` rows and runs the real `aggregateSeedActuals()` aggregator over it (bridge-inclusive philosophy, seed edition). No fabricated acquisition/financing/exit values. |
| Phases 2–3 (Excel parity) | ⏳ PENDING | Oracle-gated; runs after Bishop pinning — blocked on the same Finding M/O engine refactor |

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

### Finding M — Golden Test Harness Cannot Validate M11/M14 Path (NEW, harness-class, not an engine defect)

**File:** `backend/src/services/deterministic/__tests__/golden-deals.test.ts`  
**Discovered:** 2026-07-05, during first pin attempt after Finding L was verified fixed live.

**What happened:** After confirming Finding L's fix live (see evidence table above — `summary`/`debtMetrics`/`reasoning.walkthrough` all agree: $21,024,006 loan, 1.04 DSCR, -10.21% IRR, 0.59x EM), I captured those values and attempted to pin `bishop.golden.ts`. The pin attempt was reverted before merge — do not repeat it without addressing this finding first.

**Root cause:** `runWithBridge()` in `golden-deals.test.ts` does:

```typescript
const modelAssumptions = mapProFormaAssumptionsToModelAssumptions(raw);
return runModel(modelAssumptions, { skipSensitivity: true }); // single pass, no M11/M14
```

This calls `deterministic-model-runner.ts`'s `runModel()` **directly, once**. The M11 debt-optimizer / M14 DSCR-floor two-pass cycle — where Finding L's bug (and fix) lives — only exists inside `financial-model-engine.service.ts`'s build orchestration, which the live `POST /api/v1/financial-model/build` endpoint calls. `runWithBridge()` never reaches that orchestration code at all.

**Consequence:** For any deal where M11/M14 actually adjusts the capital stack (i.e. exactly the deals Finding L was about), the bridge-only harness will **always** produce different numbers than the live `/build` endpoint — using the raw pre-M11 requested loan amount (Bishop: $39,000,000, DSCR ~0.67) instead of the M11/M14-resolved one ($21,024,006, DSCR 1.04). This is structural, not a data or shape bug: no amount of reshaping `rawAssumptions` can make `runWithBridge()`'s output match a live `/build` capture when M11/M14 binds.

**Why this matters for W5 close:** The stated Bishop acceptance criterion (pin `expected` from a live build, verify via `golden-deals.test.ts`) is currently unsatisfiable as designed. Pinning live `/build`-captured values against `runWithBridge()` would either (a) fail every run, or (b) require silently accepting a permanent regression baseline drift between the fixture and the harness that's supposed to validate it — both unacceptable.

**Ruling (operator, 2026-07-05):** NOT approved for main agent to fix. This requires an engine refactor (`runFullModel()` pure-function extraction — see consolidated handoff below), which is explicitly external-agent territory. Bundled with Finding O (below) into a single handoff spec, `HANDOFF-ENGINE-FIX.md`.

**Status:** Bishop fixture reverted to `expected: null` / unpinned. Not blocking Highlands (seed-path, no `runWithBridge()` involvement, now pinned — see Finding N) or SyntheticDegenerate (already validates the correct single-pass path by design, pinned).

---

### Finding O — INV-6 totalEquity vs. Implied-Equity Divergence (NEW, blocker-class, bundled with Finding M)

**File:** `backend/src/services/financial-model-engine.service.ts` (same M11/M14 build orchestration as Finding L/M)  
**Discovered:** 2026-07-05, during Finding L live re-verification on Bishop (flagged in `HANDOFF-ENGINE-FIX.md` as "separate pre-existing anomaly, not caused by L, not fixed").

**What happened:** On the same Bishop build response used to confirm Finding L's fix, the `INV-6` invariant check compares two equity figures that should reconcile and found they diverge by ~46.7%:

| Quantity | Value | Source |
|---|---|---|
| `summary.totalEquity` (post-M11/M14, matches `debtMetrics`/`meta.m11CapitalStructure`/narrative — Gate 0 confirmed) | $21,024,006 loan implies... | `result.summary` |
| `totalAcqCost - loanAmount` (implied equity from acquisition cost minus the same $21,024,006 loan) | ~$39.37M | Computed from `totalAcqCost` and `loanAmount` |

Both loan amount figures agree (Finding L is fixed) — the divergence is specifically between `summary.totalEquity` and what `totalAcqCost - loanAmount` implies equity should be, a ~46.7% gap. This is not a stale-Pass-1-vs-Pass-2 artifact (Finding L pattern) — both quantities are read from the same, already-refreshed post-M11/M14 state. It's a separate reconciliation defect in how `totalEquity` is derived vs. how the acquisition-cost/loan/equity identity is expected to hold.

**Why this is bundled with Finding M, not treated standalone:** Diagnosing Finding O properly requires tracing `totalEquity` and `totalAcqCost` through the same multi-pass M11/M14 pipeline that Finding L lived in and Finding M's harness gap prevents testing. Fixing L and O independently, one call site at a time, is exactly the "patch in place across two passes" pattern that produced Finding L. Both should be fixed as part of the same structural remediation, not two more one-line patches to `financial-model-engine.service.ts`.

**Status:** Documented, not applied. Bundled into the consolidated external-agent handoff below (`HANDOFF-ENGINE-FIX.md`) alongside Finding M's `runFullModel()` extraction requirement — INV-6 reconciliation should be re-checked as part of that refactor's verification steps, not patched ahead of it.

---

## Consolidated External-Agent Handoff — Findings M + O (`runFullModel()` Extraction)

**Not approved for main agent to implement.** Both findings live inside the M11/M14 multi-pass build orchestration in `financial-model-engine.service.ts` and require an engine refactor, not a fixture or harness change. Full spec in `HANDOFF-ENGINE-FIX.md`. Summary:

- **Requirement:** Extract the deal-build pipeline (Pass 1 `runModel()` → M11 debt optimizer / M14 DSCR-floor cycle → Pass 2 `runModel()` on adjusted assumptions → single result assembly) into one pure function, e.g. `runFullModel(assumptions): FinancialModelResult`, with **no DB reads** inside it — all inputs passed in, all outputs returned, assembled exactly once at the end of the cycle.
- **Why this fixes Finding M:** Once `runFullModel()` exists as a pure, DB-free function, `golden-deals.test.ts`'s Bishop harness (`runWithBridge()`) can call it directly instead of the current single-pass `runModel()` — the test would then exercise the actual M11/M14 cycle Finding L's fix (and Bishop's real underwriting behavior) lives in, closing the structural gap that currently makes the fixture unpinnable.
- **Why this fixes Finding O (or at least makes it fixable):** A single assemble-once result, built from one pure function with fully-traced inputs, makes it possible to add an INV-6-style equity-identity check (`totalEquity` == `totalAcqCost - loanAmount`, to reconciliation tolerance) as part of that same assembly step, catching the ~46.7% divergence deterministically rather than needing separate forensic reconstruction from two live-build field readouts.
- **Verification after the refactor:** Re-run `golden-deals.test.ts` and confirm (a) Bishop's `runWithBridge()` output matches a live `/build` capture (Gate 0, already independently confirmed live — $21,024,006 loan, 1.0424 DSCR, -0.1021 IRR, 0.589 EM), and (b) INV-6 no longer flags a divergence between `totalEquity` and `totalAcqCost - loanAmount`. Only then pin Bishop's `expected` — do not pin known-corrupted or reconciliation-broken values as an interim baseline.

---

### Finding N — Seed-Path Fixture Cannot Populate the 12-Field GoldenFixture Shape (RESOLVED, PINNED 2026-07-05)

**File:** `backend/src/services/deterministic/__fixtures__/highlands.golden.ts`, `golden.types.ts`  
**Discovered:** 2026-07-05, attempting to capture Highlands' seed-path `expected` values after the Bishop/Finding M blocker.

**What happened:** Checked Highlands' (`eaabeb9f-830e-44f9-a923-56679ad0329d`) live data to source the 12-field `expected` shape. Highlands *does* have one `deal_assumptions` row (contradicts the impression in the fixture's original docstring that there is none) — but it contains **only revenue/opex platform values auto-seeded from actuals** (`egi`, `gpr`, `noi`, per-line opex, `vacancy_pct`, etc.). It has **no `purchase_price`, `exit_cap_rate`, `hold_period`, or `loan_amount`** anywhere in `year1` or `per_year_overrides`.

**Root cause:** `GoldenFixture.expected` (in `golden.types.ts`) is a single required 12-field shape shared by all fixture classes: `noiYear1, egiYear1, irr, equityMultiple, dscrY1, cashOnCashY1, goingInCapRate, exitCapRate, yieldOnCost, totalEquity, totalDebt, netProceeds`. Eight of those twelve (`irr`, `equityMultiple`, `dscrY1`, `cashOnCashY1`, `goingInCapRate`, `exitCapRate`, `totalEquity`/`totalDebt` as acquisition-financing figures, `netProceeds`) are proforma/return metrics that only exist when a deal has acquisition price, financing terms, and exit assumptions. Highlands is `owned_import` — already-owned, never acquired-and-underwritten on-platform — so those inputs don't exist and (per the operator's standing ruling rejecting Option 1) must not be fabricated.

**Consequence:** The seed-path fixture class, as currently typed, cannot ever be populated for a deal like Highlands without either (a) inventing acquisition/financing/exit assumptions that never happened (rejected), or (b) leaving 8 of 12 required fields as some placeholder value that would be a "known-wrong" pin (also rejected). The fixture's own docstring anticipated a *different*, narrower expected shape for the seed path (NOI margin 57.17%, EGI 2025 $6,315,308, boundary 2026-04-01) — i.e. actuals-derived metrics, not proforma/return metrics — which doesn't match what `golden.types.ts` actually requires today.

**Ruling (operator, 2026-07-05):** Option 1 — give `seed_path` fixtures their own narrower shape. Explicitly REJECTED: making `expected` a `Partial<BuildExpected>` for seed_path so the test "only asserts fields that are present." That is the partial-pin pattern wearing a type signature and was ruled out as a disguised known-wrong pin. Implemented instead as a true discriminated union.

**Resolution:**
1. `GoldenFixture` (`golden.types.ts`) is now a discriminated union on `fixtureClass`: `BuildPathFixture | SyntheticFixture | SeedPathFixture`, with `expected: BuildExpected | null` for the first two and `expected: SeedExpected | null` for the third. `SeedExpected` = `{ targetYear, egiAnnual, noiMargin, opexRatio, boundary }` — only fields that genuinely exist on the actuals surface for an `owned_import` deal.
2. New real (non-test-only) production module `seed-actuals-aggregator.ts` exports `aggregateSeedActuals(rows, targetYear)`, which filters `is_budget`/`is_proforma` rows and computes annual EGI/NOI/opex sums and margins/ratios, plus the actuals→projection boundary date (latest real month). This did not exist before — the closest prior art (`fetch_owned_asset_opex_ratios.ts`, `portfolio.routes.ts`) only did TTM per-unit averages or single-latest-row lookups, not annual aggregation.
3. `highlands.golden.ts` now pins a raw snapshot of all 93 `deal_monthly_actuals` rows for this deal (budget and proforma rows included exactly as stored, copied programmatically from a live query — not hand-typed) alongside `expected` aggregates for calendar year 2025 (EGI $6,315,308.53, NOI margin 57.1674%, opex ratio 42.8326%, boundary 2026-04-01).
4. `golden-deals.test.ts`'s Highlands block now runs the real `aggregateSeedActuals()` over the pinned snapshot and asserts the result matches `expected` — bridge-inclusive philosophy, seed edition: the test exercises real aggregation logic (including its `is_budget`/`is_proforma` exclusion), not a hand-computed constant compared to itself.

**Status:** ✅ PINNED 2026-07-05. `npm test -- deterministic/__tests__/golden-deals.test.ts` → Highlands passing, SyntheticDegenerate passing, Bishop still skipped (`expected: null`, Finding M).

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
| `golden.types.ts` | Refactored to discriminated union: `BuildPathFixture \| SyntheticFixture \| SeedPathFixture`, typed `BuildExpected \| SeedExpected` (Finding N) | ✅ Merged |
| `seed-actuals-aggregator.ts` (new) | Real production aggregator `aggregateSeedActuals()` for seed-path annual EGI/NOI/opex metrics | ✅ Merged |
| `synthetic-degenerate.golden.ts` | Pinned with 12-field expected shape | ✅ Merged |
| `bishop.golden.ts` | Placeholder (fixtureClass='build_path') | ⏳ BLOCKED — Finding M/O, external agent |
| `highlands.golden.ts` | Pinned: raw snapshot of 93 `deal_monthly_actuals` rows + `SeedExpected` aggregates (Finding N) | ✅ PINNED 2026-07-05 |
| `golden-deals.test.ts` | Three-fixture regression harness; Highlands block now runs real `aggregateSeedActuals()` over the pinned snapshot | ✅ Merged |
| `capture-golden-fixtures.sh` | Updated for seed-path architecture, bc→awk, jq fallback paths | ✅ Fixed |
| `identity-invariants.test.ts` | 4 suites × 100 randomized sets | ✅ Merged |

### Files Requiring External Agent Fix

| File | Lines | Finding | Fix | Status |
|------|-------|---------|-----|--------|
| `deterministic-model-runner.ts` | 1892 | K — off-by-one | `annualRows[hold]` → `annualRows[hold - 1]` | ✅ Applied, verified live on Bishop rebuild |
| `deterministic-model-runner.ts` | 1530–1543 | K-2 — INV-5 severity mask | Remove `lease_up` downgrade branch | ✅ Applied |
| `financial-model-engine.service.ts` | 1573–1644 | **L — stale summary/debtMetrics after M11/M14 re-run** | Rebuild `result.summary`/`result.debtMetrics` from `adjustedDet`, same point `evidence`/`reasoning` are refreshed | ✅ Applied — assemble-once rebuild with m11Warnings preservation. Verified live: Gate 0 met. |
| `financial-model-engine.service.ts` + `golden-deals.test.ts` | n/a — cross-cutting | **M + O — bundled: `runFullModel()` extraction** (M: harness can't exercise M11/M14 cycle; O: INV-6 totalEquity/implied-equity ~46.7% divergence) | Extract build pipeline into a pure `runFullModel(assumptions): FinancialModelResult` with no DB reads, assembled once. See consolidated handoff above and `HANDOFF-ENGINE-FIX.md`. | ⏳ NOT approved for main agent — external-agent engine-refactor territory |

---

## Next Steps (Sequence-Locked)

1. ~~External agent fixes engine (K + K-2) → commit~~ ✅ Done, verified live
2. ~~External agent fixes Finding L~~ ✅ Done, verified live (Gate 0 met)
3. ~~Pin Highlands (Finding N resolved via discriminated union + real seed aggregator)~~ ✅ Done 2026-07-05
4. **External agent implements `runFullModel()` extraction** (Findings M + O, consolidated handoff in `HANDOFF-ENGINE-FIX.md`) → commit
5. **Compile guard** — verify no new TypeScript errors
6. **Re-run Bishop's `runWithBridge()` against `runFullModel()`**, confirm it matches a live `/build` capture (Gate 0 values already known: $21,024,006 loan, 1.0424 DSCR, -0.1021 IRR, 0.589 EM)
7. **Confirm INV-6 no longer flags** `totalEquity` vs. `totalAcqCost - loanAmount` divergence
8. **Pin Bishop fixture** — not before now; do not pin known-corrupted or reconciliation-broken values as an interim baseline
9. **Run full golden suite** → expect 3/3 passing
10. **Excel parity (Phases 2–3)** — oracle-gated comparison

---

## Acceptance Criteria (W5 Close)

- [x] Highlands + SyntheticDegenerate pinned and passing (2/3)
- [ ] Bishop pinned and passing — blocked on external-agent `runFullModel()` extraction (Findings M + O)
- [ ] `npm test -- deterministic/__tests__/golden-deals.test.ts` → 3/3 passing
- [ ] `npm test -- deterministic/__tests__/identity-invariants.test.ts` → 4/4 passing
- [ ] `npx tsc --noEmit --skipLibCheck` → 319 errors (no new)
- [ ] Bishop fixture has `expected` + `rawAssumptions` + `provenance` with F-P1-A documented
- [x] Highlands fixture has `expected` (`SeedExpected`) + `snapshotRows` + `provenance` with `originClass: 'owned_import'`
- [ ] Excel parity report generated (Phase 2–3)
