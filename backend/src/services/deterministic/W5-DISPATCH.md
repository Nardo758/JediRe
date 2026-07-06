# W5 Dispatch — Deterministic Engine Golden Fixture Pinning

**Status:** Highlands + SyntheticDegenerate PINNED. Bishop UNPINNED (`expected: null`) — reverted 2026-07-06 after forensic review found the prior pin partially reflected stale pre-fix values (see Bishop fixture provenance comment). Still blocked pending external-agent engine refactor (Finding M, bundled with Finding O). Not fixed by main agent per operator ruling (M is engine-refactor territory).
**Date:** 2026-07-05 (original); amended 2026-07-06 (W5 Re-Acceptance Runbook — see "2026-07-06 Amendment" section below)
**Repo:** Nardo758/JediRe · backend port 4000 · master branch
**Baseline:** 319 pre-existing TypeScript errors (unchanged by our changes; scoped separately from the new deterministic-engine type guard — see amendment)
**Compile guard:** `npx tsc --noEmit --skipLibCheck` — no new errors introduced. **NEW (2026-07-06):** `node backend/scripts/check-deterministic-types.js`, wired into `.github/workflows/typecheck.yml`, additionally compiles the test/fixture files under `src/services/deterministic/` and `tests/deterministic/` (previously outside `tsconfig.json`'s `include` — see Finding T).

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
| Bishop Build-Path | ⏳ BLOCKED (Finding M, bundled with Finding O) | Finding K confirmed fixed live (`stabilizedNOI`, `exitValue`, `netProceeds` all correctly non-zero on rebuild). Finding L confirmed fixed live (Gate 0 met — see evidence table below). **⚠️ L Gate 0 values are O-contaminated:** `$21,024,006` loan, `1.0424` DSCR, `-10.21%` IRR, `0.589` EM agree across all three surfaces, proving staleness is resolved, but `totalEquity` vs `totalAcqCost - loanAmount` divergence (~46.7%, Finding O) means equity-derived values (IRR, EM) may still be wrong even though consistent. These values must NOT be used as expected values until O closes. Pinning remains blocked because the test harness cannot exercise the M11/M14 orchestration (Finding M) — requires engine refactor (`runFullModel()` pure-function extraction), external-agent territory. |
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

**Evidence surface:** SyntheticDegenerate engine-level test (`deterministic-model-runner.ts`, `runModel()` direct) — before fix: `stabilizedNOI=0`, `grossSalePrice=0`, `irr=null`, `equityMultiple≈0`. After fix: `stabilizedNOI=$4,297,668`, `grossSalePrice=$66,117,965`, `irr=0.2983`, `equityMultiple=3.238`. Also observed on Bishop live HTTP POST `/api/v1/financial-model/build` (captured 2026-07-05, pre-L-fix): model narrative explicitly stated *"Exit is underwritten at a 5.00% cap rate in Year 5, producing a gross sale price of $0 and equity proceeds of $0. The levered IRR is n/a."*

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

**Evidence tier:** Code-path analysis (the downgrade branch was structurally incorrect — it masked a bug that should have been caught as ERROR) + SyntheticDegenerate test passing post-fix (INV-5 no longer fires WARN for stabilizedNOI=0 in the synthetic degenerate case). No dedicated `lease_up`-mode test case exists; the synthetic fixture covers the `existing` mode path.

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

**Live evidence — Bishop, live HTTP POST `/api/v1/financial-model/build` (captured 2026-07-05, response saved as `/tmp/build_bishop.json`):**

| Field | `summary`/`debtMetrics` (Pass 1, pre-L-fix) | `reasoning.walkthrough` narrative (Pass 2, describes the actual M14-adjusted deal) |
|---|---|---|
| Loan amount | `$39,000,000` (flat 65% LTV) | "$21,024,006" |
| Y1 DSCR | `0.67` (`DSCR_BREACH` error fires) | "1.04" (matches `dscr_floor_binds` warning, which independently reads the Pass-2-derived `dscrActual`) |
| `irr` | `null` (`irr_not_computable` warn — cash flow is monotonic-negative because the stale $39M loan balance exceeds sale proceeds) | "-10.21%" |
| `equityMultiple` | `0` (`LOW_EM` warn, "0.00× < 1.5×") | "0.59x" |

Both sides of this table come from the **same JSON response, same request** — not a caching or stale-process artifact (ruled out: dev token fresh, backend restarted, single request/response pair inspected directly).

**⚠️ O-CONTAMINATION WARNING:** Gate 0 verification showed `$21,024,006` loan, `1.0424` DSCR, `-10.21%` IRR, `0.589` EM across all three surfaces (`summary`, `debtMetrics`, `reasoning.walkthrough`). **Agreement across surfaces proves staleness is fixed — it does NOT prove the values are correct.** Finding O (totalEquity never recomputed after M11/M14 debt resize, ~46.7% divergence from `totalAcqCost - loanAmount`) is still open. If equityMultiple and IRR were computed off stale `totalEquity`, then all three surfaces agree on numbers that embed the O bug. **These four values must NOT be used as expected values in any test or fixture until O closes.** The L verdict is: **staleness resolved; value correctness pending O.**

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

### Finding DQ-1 — Highlands 2023-08 Dirty Actuals Row (data-quality, not an engine defect)

**File:** `backend/src/services/deterministic/__fixtures__/highlands.golden.ts` (snapshot row 56: `report_month: '2023-08-01'`)
**Discovered:** 2026-07-05, during evaluation of pinned Highlands snapshot data.

**What happened:** One month in the 93-row snapshot shows an implausibly low opex figure that survives into the pinned fixture as as-stored source data:

| Field | Value | Plausibility |
|---|---|---|
| `effective_gross_income` | $569,738 | ✓ Normal monthly EGI |
| `total_opex` | $3,958 | ✗ **0.7% opex ratio** — implausibly low for multifamily (typical: 35–50%) |
| `noi` | $565,781 | ✗ Derived from EGI − opex = $569,738 − $3,958 = $565,780; the reported $565,781 is off by $1, suggesting a rounding or data-entry anomaly |

**Impact:** This row is permanently baked into the golden fixture as as-stored source data. The annual aggregator for targetYear=2025 does not include this 2023 row, so the pinned 2025 aggregates (EGI $6,315,308, NOI margin 57.17%) are not directly contaminated. However:
1. If any future targetYear=2023 fixture is created, this row would corrupt the 2023 annual opex ratio.
2. More importantly, **there is no actuals-plausibility validator in the underwriting engine** — a $3,958 opex month on a $570K EGI property should have been flagged during ingestion or by a data-quality gate, but wasn't.

**Status:** Documented, not fixed. The row is preserved as-stored in the snapshot (the fixture faithfully represents the DB state). A separate data-quality validator should be considered for the actuals ingestion pipeline. This finding does not block W5 close.

**Suggested future action:** Add an actuals-plausibility check to the ingestion pipeline: flag any month where `total_opex / EGI < 0.05` or `total_opex / EGI > 0.80` as a data-quality anomaly requiring operator review.

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

**Null-flag check (2026-07-05):** Verified all 93 snapshot rows have explicit `is_budget` and `is_proforma` boolean values (true/false, no NULL or undefined). The aggregator filter `!r.is_budget && !r.is_proforma` correctly excludes only rows where both flags are explicitly false; no silently-included NULL-flag rows.

**Schema confirmation (2026-07-05):** `deal_monthly_actuals` migration (`20260421_deal_monthly_actuals.sql`) declares both `is_budget` and `is_proforma` as `BOOLEAN NOT NULL DEFAULT false` (lines 17–18). The schema guarantees NULL cannot exist in production data. The aggregator's `!r.is_budget && !r.is_proforma` filter is safe for the live table.

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

## 2026-07-06 Amendment — W5 Re-Acceptance Runbook Findings (Q, R, S, T)

Produced during the multi-round W5 Re-Acceptance Runbook (external reviewer "Leon"). Scope was strictly test/fixture/tooling/guard-config authority — no engine code was touched. Three genuine engine-side test failures (Q, R, S) were confirmed via direct probe to be real, current, reproducible behavior — not stale fixtures or test bugs — and were **left failing on purpose** rather than adjusted to pass. A fourth item (T) is a guard-scope closure, not an engine finding.

### Finding Q — `isExitYear` Regression (engine, blocker-class for this flag only)

**File:** `backend/src/services/deterministic/deterministic-model-runner.ts` (annual cash flow row assembly)
**Test:** `backend/tests/deterministic/proforma-assumptions-bridge.test.ts` — `AnnualCashFlowRow.isExitYear is false for operating rows and true for exit row`

**Reproduction:**
```
$ npx vitest run tests/deterministic/proforma-assumptions-bridge.test.ts -t "isExitYear"
 FAIL  ... AnnualCashFlowRow.isExitYear is false for operating rows and true for exit row
AssertionError: expected false to be true
 ❯ tests/deterministic/proforma-assumptions-bridge.test.ts:223:32
    221|       expect(row.isExitYear).toBe(false);
    222|     }
    223|     expect(exitRow.isExitYear).toBe(true);
```

**What this means:** `result.annualCashFlow[last].isExitYear` is `false` for the final (exit) year row on the default test deal — it should be `true`. All prior operating-year rows correctly report `false`. This is a boolean-flag regression on the last row of `annualCashFlow`, not a fixture/expectation problem — the test's own logic (loop over all-but-last = false, last = true) is correct and matches the field's documented contract (task #486). Root cause not diagnosed further here (out of test-fix authority); the flag itself, not the underlying disposition math, appears to be mis-set. Worth checking for an off-by-one similar in shape to Finding K (`annualRows[hold]` vs `annualRows[hold-1]`) at whatever call site sets `isExitYear`, though this was not verified against the source — flagged as a hypothesis for the external agent, not a confirmed root cause.

**Status:** Left failing. Not a test bug — verified via direct probe that current engine output has this flag wrong. Reported to F5/external-agent for engine-side fix.

---

### Finding R — INV-10 Fires on a Valid Development Deal (engine, blocker-class for this invariant)

**File:** `backend/src/services/deterministic/deterministic-model-runner.ts` (`INV-10`, ~line 1607–1619)
**Test:** `backend/tests/deterministic/proforma-assumptions-bridge.test.ts` — `development deal goingInCap (task #491 §10.6) > valid dev deal has no INV-* hard errors (INV-9 and INV-10 skip construction rows)`

**Reproduction:**
```
$ npx vitest run tests/deterministic/proforma-assumptions-bridge.test.ts -t "development deal goingInCap"
 FAIL  ... valid dev deal has no INV-* hard errors (INV-9 and INV-10 skip construction rows)
AssertionError: expected [ { id: 'INV-10', …(2) } ] to have a length of +0 but got 1
 ❯ tests/deterministic/proforma-assumptions-bridge.test.ts:1338:27
    1336|     const checks = runIntegrityChecks(m, r);
    1337|     const hardInvErrors = checks.filter(c => c.status === 'error' && c.id.startsWith('INV-'));
    1338|     expect(hardInvErrors).toHaveLength(0);
```

**What this means:** `INV-10` ("annual occupancy == month-weighted aggregate of monthly series") fires as a hard `error` on a plain, otherwise-valid `dealType: 'development'` deal (12mo construction, 12mo lease-up, no other overrides). The test's own docstring and the invariant's stated design ("INV-9 and INV-10 skip construction rows") indicate construction-year rows should be excluded from this check — either that exclusion isn't implemented for INV-10, or the exclusion has an edge case this deal's month/year boundary hits. Not diagnosed further (engine internals, out of authority). This is the same construction-row-handling surface as Finding K (exit-year off-by-one) and may share a root cause class (year-index boundary handling around construction/lease-up periods), but that is a hypothesis, not confirmed.

**Status:** Left failing. Not a test bug — the test's construction (`makeRunModelAssumptions({ dealType: 'development', constructionMonths: 12, leaseUpMonths: 12 })`) is a plausible, unexceptional dev deal shape; there is no fixture staleness or wrong-assertion issue here. Reported to F5/external-agent — classified as ENGINE GAP (invariant doesn't do what its own docstring says).

---

### Finding S — Westshore Commons IRR Ripple, ~2.27pp Off Spec Tolerance (engine-side, non-blocker for this dispatch but real)

**File:** `backend/src/services/deterministic/deterministic-model-runner.ts` (disposition/IRR calculation)
**Test:** `backend/tests/deterministic/proforma-assumptions-bridge.test.ts` — `Westshore Commons runModel — spec §12 tolerance check`

**Reproduction:**
```
$ npx vitest run tests/deterministic/proforma-assumptions-bridge.test.ts -t "Westshore Commons runModel"
 FAIL  ... summary.irr ≈ 24.3% (within ±1% absolute) and summary.equityMultiple > 3.4
AssertionError: expected 0.022706252480428124 to be less than 0.01
 ❯ tests/deterministic/proforma-assumptions-bridge.test.ts:791:46
    789|     expect(r.summary.equityMultiple).not.toBeNull();
    790|     // IRR within ±1% of spec's 24.3%
    791|     expect(Math.abs(r.summary.irr! - 0.243)).toBeLessThan(0.01);
```

**What this means:** The spec (task §12) expects `summary.irr` within ±1 percentage point of 24.3% for this fixture (rentGrowth tuned to 4.8% specifically to hit that target — see comment at test line 762). Current engine output diverges by ~2.27 percentage points (i.e. ~22.0% or ~26.6% actual, sign not resolved here — only the absolute delta was asserted). This is downstream of the same disposition/IRR code paths Findings K/L/M/O already touch; most likely explanation is ripple from one of those fixes shifting this fixture's IRR without the test's tolerance/tuning comment being re-validated against current engine output. Not diagnosed further — could be a genuine engine regression, or could mean the spec-tuning comment (`rentGrowth=4.8% chosen so the deterministic model hits the spec's IRR≈24.3%`) is now stale and needs re-tuning once M/O closes. Re-tuning the rentGrowth constant to re-hit the target would be in test-fixture authority, but doing so *now*, before Finding M/O closes, risks re-tuning against a still-buggy engine and needing to re-tune again later — so it was left as-is rather than masked.

**Status:** Left failing. Reported as an engine-side ripple, likely tied to the M/O disposition/equity refactor already tracked above. Re-evaluate whether this needs re-tuning (test authority) or is a genuine new regression (engine authority) after Finding M/O closes — not resolved definitively by this dispatch.

---

### Finding T — Guard-Scope Hole: Test/Fixture Files Were Never Type-Checked by CI (tooling, RESOLVED 2026-07-06)

**File:** `.github/workflows/typecheck.yml`, `backend/tsconfig.json`
**Discovered:** 2026-07-06, while auditing why 4 separate instances of merge-corruption (duplicate blocks, wrong imports, wide/narrow type mismatches) reached `master` undetected in `__fixtures__/` and `__tests__/` files.

**Root cause:** CI's typecheck step is `cd backend && npx tsc --noEmit --skipLibCheck` with no `-p` flag, so it uses `backend/tsconfig.json`'s default `include`, which lists only 2 entry files. Every file under `src/services/deterministic/__fixtures__/`, `src/services/deterministic/__tests__/`, and `tests/deterministic/` was structurally outside CI's compiled surface — a broken import, a duplicated block, or a wrong type annotation in any of those files could reach `master` with a green typecheck.

**Fix (in guard-config authority, applied):**
1. New `backend/tsconfig.test.json` — scoped `include` covering the deterministic src + test surface only (`rootDir: "."`).
2. New `backend/scripts/check-deterministic-types.js` — runs `tsc -p tsconfig.test.json --noEmit --skipLibCheck`, diffs errors against a pre-registered baseline (`backend/tsconfig.test.baseline.json`, 7 unique pre-existing production-file errors — see below), and fails only on errors NOT in that baseline. This lets the guard catch new regressions immediately without blocking on unrelated pre-existing bugs that are out of test-guard authority to fix.
3. New CI step in `.github/workflows/typecheck.yml`: "Deterministic engine type guard (test/fixture surface)" — runs the script above, in addition to (not replacing) the existing repo-wide `tsc --noEmit --skipLibCheck` step.
4. Forced-failure proof: a synthetic type error was injected into `tests/deterministic/proforma-assumptions-bridge.test.ts`, the guard correctly failed (exit code 1, named the exact new error), the file was restored, and the guard passed clean again — confirming the guard actually detects regressions rather than always passing.

**Baseline contents (7 unique pre-existing errors, 10 raw error lines, none newly introduced, all in production engine/service files out of test-guard authority):**
- `financial-model-engine.service.ts`: `Cannot find name 'ProvenancedValue'` (×3 sites), `Cannot find name 'totalUnits'`, `MonthlyCashFlowRow[]` not assignable to `Record<string, number>[]`
- `proforma/event-deltas.service.ts`: `classifyMsaTier` not exported from `m35-playbook.service`
- `proforma/opex-anchors.service.ts`: duplicate object-literal property (TS1117)
- `proforma/position-adjustment.service.ts`: `Property 'count'/'sum' does not exist on type 'unknown'` (×2 sites)

**Also fixed while closing this hole (in fixture/test-file authority, not engine):**
- 4th instance of the recurring merge-corruption pattern in `golden.types.ts` (duplicate tail block + duplicate import).
- `highlands.golden.ts` / `synthetic-degenerate.golden.ts`: fixtures were typed as the wide `GoldenFixture` union instead of their specific discriminated-union members (`SeedPathFixture`, `SyntheticFixture` respectively) — narrowed, resolving 11 downstream type errors in `golden-deals.test.ts` that were masking the real production-file errors above.
- `golden-deals.test.ts`: SyntheticDegenerate block was reading `_unmatchedOpexKeys`/`_orphanedOpexKeys` off `ModelResults` (wrong object — those fields live on `ModelAssumptions`/bridge output), so the assertion was a silent no-op (`result._unmatchedOpexKeys ?? []` always resolved to `[]`). Fixed to read from `full.adjustedAssumptions` instead.
- `unmatched-opex-keys.test.ts`: wrong relative import depth.

**Verification after fix:**
```
$ cd backend && node scripts/check-deterministic-types.js
Deterministic engine type guard: PASS (10 error(s), all pre-registered in tsconfig.test.baseline.json).

$ npx vitest run src/services/deterministic/__tests__/golden-deals.test.ts
 ✓ src/services/deterministic/__tests__/golden-deals.test.ts (5 tests | 1 skipped) 59ms

$ npx vitest run tests/deterministic/proforma-assumptions-bridge.test.ts
 Test Files  1 failed | 2 passed (3)
      Tests  3 failed | 148 passed | 1 skipped (152)
```
(The 3 failures are Findings Q, R, S above — real, left failing on purpose, not masked.)

**Status:** RESOLVED. Guard is live in CI as of this commit.

---

### Finding U — Capital-Structure Route: `summary.dscr` Off By ~100x (engine/API, NEW, blocker-class for this field only)

**File:** `backend/src/api/rest/capital-structure.routes.ts`, line ~572
**Discovered:** 2026-07-06, during W5-FINAL Runbook Phase 2-3 consumer-matrix live capture (`GET /api/v1/capital-structure/:dealId`, live Replit backend, both deals).

**What happened:** The route computes `dscr` as:

```ts
dscr: noi > 0 && loanAmount > 0 && interestRate > 0
  ? noi / (loanAmount * (interestRate / 100))
  : null,
```

`fin.interestRate` is already stored as a decimal fraction (e.g. `0.065`), not a whole-number percent — dividing by `100` a second time shrinks the implied annual debt service by ~100x, inflating the reported DSCR by the same factor. Live capture on both deals:

| Deal | `capital-structure` route `summary.dscr` | Correct DSCR (F9 `/financial-model/:dealId/latest` → `results.debtMetrics.dscr`) | Ratio |
|---|---|---|---|
| Bishop (`3f32276f-…`) | `125.00000286212722` | `1.0424476138210286` | 119.91x |
| Highlands (`eaabeb9f-…`) | `188.75517942109437` | `1.8875517942109443` | 100.00x (exact) |

Highlands' ratio is exactly 100x, confirming the `/100` double-division as the mechanism. Bishop's ratio (119.9x) is close but not exact 100x — the residual ~20% gap is unexplained here (not diagnosed further; possibly a second, smaller discrepancy in how `loanAmount`/`interestRate` are sourced for Bishop's M11/M14-resolved state vs. Highlands' simpler capital stack — flagged as a hypothesis only, not confirmed).

**What this means:** Any UI or downstream consumer reading `summary.dscr` from the capital-structure route gets a wildly wrong figure (three-digit DSCR instead of a normal ~1.0–2.0x range) — trivially implausible on inspection, but nothing in the route or its consumers currently guards against it.

**Status:** Reported, not fixed. This is a live API/engine-code defect (`backend/src/api/rest/capital-structure.routes.ts`), outside main-agent's fix authority (test/fixture/tooling/guard-config only) per this dispatch's operating rules. Queued for the same external-agent handoff as Findings Q/R/S — one-line fix candidate (`interestRate` already a decimal, drop the `/100`) but must be verified against how `fin.interestRate` is populated across all deal types before applying, since a wrong assumption here previously caused Findings L/O.

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

## Acceptance Criteria (W5 Close) — ORIGINAL (2026-07-05), superseded by amended gate below

- [x] Highlands + SyntheticDegenerate pinned and passing (2/3)
- [ ] Bishop pinned and passing — blocked on external-agent `runFullModel()` extraction (Findings M + O)
- [ ] `npm test -- deterministic/__tests__/golden-deals.test.ts` → 3/3 passing
- [ ] `npm test -- deterministic/__tests__/identity-invariants.test.ts` → 4/4 passing
- [ ] `npx tsc --noEmit --skipLibCheck` → 319 errors (no new)
- [ ] Bishop fixture has `expected` + `rawAssumptions` + `provenance` with F-P1-A documented
- [x] Highlands fixture has `expected` (`SeedExpected`) + `snapshotRows` + `provenance` with `originClass: 'owned_import'`
- [ ] Excel parity report generated (Phase 2–3)
- [ ] K-2 test gap: dedicated `lease_up`-mode test case (no test currently exercises INV-5 in lease_up mode; SyntheticDegenerate covers `existing` only)

---

## Amended Close-Out Gate (2026-07-06, W5 Re-Acceptance Runbook)

This gate reflects what was actually verified in this round of work (main-agent, test/fixture/tooling authority only) and names every open item explicitly — no criterion is marked closed unless a pasted command output above supports it, and no residual is silently dropped.

### Closed this round (main-agent authority, verified)

- [x] Bishop fixture unpinned to `expected: null` with full provenance/incoherence writeup (U2) — was NOT strike-four fabrication (forensic finding, U1), but was a genuinely incoherent partial-fix state that should not have been pinned.
- [x] `__fixtures__/README.md` rewritten with pin-discipline enforcement language (U2).
- [x] Golden fixture suite green: `npx vitest run src/services/deterministic/__tests__/golden-deals.test.ts` → 4 passed, 1 skipped (Bishop, intentionally unpinned).
- [x] Bridge suite test-bug fixes applied (INV-5 regex, CAP_RATE_COMPRESSION stale hardcode, dscrAtStabilization Y1-vs-Y2): `npx vitest run tests/deterministic/proforma-assumptions-bridge.test.ts` improved from 6 failing → 3 failing (all 3 remaining are real engine findings, not test bugs — see below).
- [x] Guard-scope hole closed (Finding T): test/fixture files under `src/services/deterministic/` and `tests/deterministic/` are now compiled by CI via `backend/scripts/check-deterministic-types.js` + `backend/tsconfig.test.json`, wired into `.github/workflows/typecheck.yml`. Forced-failure proof confirmed the guard actually catches regressions (injected synthetic error → guard failed with exit 1 and named it → reverted → guard passed clean).
- [x] 4th instance of the recurring merge-corruption pattern fixed in `golden.types.ts` (duplicate tail block + duplicate import) — same class as the Bishop/golden-deals.test.ts corruption found in U1/prior rounds.
- [x] `highlands.golden.ts` / `synthetic-degenerate.golden.ts` fixture type-narrowing (`GoldenFixture` union → specific `SeedPathFixture`/`SyntheticFixture` members), resolving 11 tsc errors that were masking real production-file errors.
- [x] `golden-deals.test.ts` SyntheticDegenerate block fixed to read `_unmatchedOpexKeys`/`_orphanedOpexKeys` from the correct object (`full.adjustedAssumptions`, not `result`) — previous assertion was a silent no-op.
- [x] `unmatched-opex-keys.test.ts` import-depth fix.

### Named residuals — explicitly NOT closed, NOT fixed, NOT masked (engine/F5 authority)

These three are the entire remaining gap between "148 passing" and "151 passing" in the bridge suite. Each was verified via direct probe to be genuine current engine behavior, not a stale fixture or wrong test assertion — see Findings Q, R, S above for full repro output.

1. **Finding Q — `isExitYear` regression.** `AnnualCashFlowRow.isExitYear` is `false` on the exit-year row when it should be `true`. Suspected off-by-one in the same family as Finding K, unverified.
2. **Finding R — INV-10 fires on a valid development deal.** The invariant's own docstring says construction rows should be skipped for INV-10; a plain dev-deal fixture (12mo construction, 12mo lease-up) still trips it as a hard error.
3. **Finding S — Westshore Commons IRR off spec tolerance by ~2.27pp.** Likely a ripple from the M/O disposition/equity work already tracked in this doc; could alternatively mean the fixture's `rentGrowth` tuning constant needs re-calibration once M/O closes. Not resolved either way in this round.

**Why these were not "fixed" to pass:** All three are engine-code changes (`deterministic-model-runner.ts` internals) — explicitly outside this runbook's fix authority (F5/external-agent territory only). Adjusting the test tolerance, expected value, or assertion to make them pass would have been a disguised known-wrong pin of exactly the kind Findings M/N already ruled out. They are reported, not silenced.

### Still blocked from the original gate (unchanged)

- [ ] Bishop pinned and passing — blocked on external-agent `runFullModel()` extraction (Findings M + O), tracked in `HANDOFF-M-O-DISPATCH.md`.
- [ ] Excel parity report (Phases 2–3) — oracle-gated, blocked on Bishop pin.
- [ ] K-2 `lease_up`-mode dedicated test case — blocked on the same M+O dispatch (listed as an acceptance criterion there).

### Full acceptance table (amended)

| Criterion | Status | Evidence |
|---|---|---|
| Bishop unpinned with provenance | ✅ Done | U1/U2, this session |
| Golden fixture suite (Highlands + SyntheticDegenerate) | ✅ 4/5 (1 skip = Bishop, intentional) | pasted vitest output above |
| Bridge suite test-bug fixes | ✅ Done (3 fixed, 3 real residuals remain) | 142→148 passing, all deltas explained |
| Guard-scope closure (Finding T) | ✅ Done, forced-failure-proven | pasted guard output above |
| Findings Q/R/S reported, not masked | ✅ Done | this document |
| Bishop pin | ⏳ Blocked — external-agent M+O | `HANDOFF-M-O-DISPATCH.md` |
| Excel parity (Phase 2–3) | ⏳ Blocked on Bishop pin | — |
| K-2 lease_up test | ⏳ Blocked on M+O dispatch | — |
| Findings Q, R, S fixes | ⏳ Not started — engine authority, new since 2026-07-05 | this document |

**W5 is NOT closed by this round.** This round's scope was re-acceptance verification (capture-and-report), not engine remediation. Three new engine findings (Q, R, S) are now queued alongside the pre-existing M+O blocker for the external agent. Recommend bundling Q/R/S into the next `runFullModel()`/disposition-math handoff, since Q and R both touch construction/exit-year boundary handling in the same code region as K, and S is plausibly a ripple of the same M/O work already scheduled.

---

## W5-FINAL Runbook (2026-07-06) — Live Evidence + Closing Declaration

### C1 — Runbook Phases 2–3 Live Evidence

**1. Smoke shapes.** Highlands canary (57.17% NOI margin / $6,315,308.53 EGI / 2026-04-01 boundary) does **not** surface in the live `/financial-model/:dealId/periodic` API — it lives only in the golden fixture (`highlands.golden.ts` + `golden-deals.test.ts`), re-confirmed via `npx vitest run src/services/deterministic/__tests__/golden-deals.test.ts` → **4 passed, 1 skipped** (Bishop, intentional). Bishop's live periodic NOI series (actuals 2017–2018 negative baseline → gap → projection ramping from ~$130K/mo starting 2026-07) was captured but has no independent canary to check against.

**2. Consumer matrix.** All 4 real consumer paths curled live for both deals — `GET /proforma/:dealId`, `GET /financial-model/:dealId/latest`, `GET /financial-model/:dealId/periodic`, `GET /capital-structure/:dealId` — all HTTP 200:

| Quantity | Bishop | Highlands | Agreement |
|---|---|---|---|
| NOI | $1,576,800 | $3,808,324.50 | ✅ Consistent across all paths |
| IRR | −20.95% | 18.19% | ✅ Consistent across all paths |
| Equity Multiple | 0.314× | 2.08× | ✅ Consistent across all paths |
| Loan Amount | $21,024,006 | $31,525,000 | ✅ Consistent across all paths |
| `capital-structure` `summary.dscr` | 125.00 (wrong) | 188.76 (wrong) | ❌ NEW — Finding U, ~100x inflated vs. correct `debtMetrics.dscr` (1.0424 / 1.8876) |

**3. D1 behavioral (ninth session — CLOSED, PASS).** `ai_usage_log` count before = 29,873. Ran navigation-equivalent GETs across deal-detail, F9-latest, periodic, proforma, and capital-structure for both deals. Count after = 29,873. Verified via `WHERE created_at > '2026-07-06T21:42:05Z'` → **0 rows**. Zero LLM provider calls from pure navigation, confirmed live.

**4. T2 forced cache-hit — NAMED BLOCKER (R-4).** Sent an identical large prompt (536 chars) twice through `POST /api/v1/agents/chat` (`agentCode: "CASH"`, Bishop dealId), 2 seconds apart. Both calls returned HTTP 200 with a fallback "limited mode" response — the underlying DeepSeek call failed both times with **`402 Insufficient Balance`** (confirmed in backend logs: `DeepSeek API error … status: 402 … "Insufficient Balance"`, twice, once per call). Zero rows were written to `ai_usage_log` for either call (confirmed: `SELECT COUNT(*) FROM ai_usage_log WHERE created_at > '2026-07-06 21:44:00+00'` → 0). **This is an account-funding/billing blocker, not a code or test defect** — outside main-agent fix authority. T2 cannot be executed live until the DeepSeek account balance is topped up; the cache-hit mechanism and cost formula (`estimateDeepSeekCost()` in `DeepSeekMeteringAdapter.ts`) were traced and confirmed present in code, but could not be exercised end-to-end against a real API response in this session.

### C2 — Excel Parity List

Regenerated `docs/EXCEL_PARITY_ORACLE_REQUEST.md` as **PROVISIONAL**: Highlands seed-path values (pinned, verified) populated in full; Bishop limited to the five 2026-07-05 live-captured values (loan/equity/IRR/EM/DSCR), each marked "subject to F5 re-pin"; every other Bishop field marked PENDING-RE-PIN with no number.

### New Finding This Round

**Finding U** (see above) — `capital-structure.routes.ts` `summary.dscr` inflated ~100x by a double `/100` division on an already-decimal `interestRate`. Reported, not fixed (API/engine-code, outside test/fixture/tooling/guard-config authority). Queued for the same external-agent handoff as Q/R/S.

---

> **W5 CLOSED — 2026-07-06, operator-declared, with named residuals.**
> Closed with evidence: deterministic turn-cohort engine (Findings A–P diagnosed/fixed/doctrine'd); one-NOI-truth across consumer surfaces; loudness system (canonical/alias/orphan, required-only); INV-6 hard invariant + assemble-once + pre-optimization demotion; canonical orchestration (pass-1 → M11 → M14 → equity reconcile → pass-2 → assemble → verdict); golden framework (Highlands seed-path + SyntheticDegenerate pinned/green; K-2; determinism); guard coverage extended to test surfaces with forced-failure proof; fixtures discipline (payload-sourced provenance mandatory).
> **Residuals (owners assigned):** R-1 F5 engine package [external agent] — effective-assumptions hypothesis (lead), Findings Q/R/S, Finding U (new), 10 pre-existing production type errors, Bishop re-pin on verdict. R-2 Excel parity [operator] — final list post-re-pin. R-3 CI-run-history verification [parked — needs gh auth]. R-4 D1/T2 — D1 closed PASS this session; T2 named-blocker: DeepSeek account `402 Insufficient Balance`, not a code defect, requires operator/billing action before it can be executed.
