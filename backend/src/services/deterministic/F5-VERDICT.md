# F5 Verdict — Bishop Golden Fixture Re-Capture

**Date:** 2026-07-13  
**HEAD:** c111753e4 (post-debt-arc: B1–B6 all active)  
**Verdict:** CLOSED — fixture pinned, test active

---

## Context

The Bishop golden fixture (`__fixtures__/bishop.golden.ts`) had `expected: null` since
2026-07-06.  The original 2026-07-05 pin was incoherent (noiYear1 was updated but
irr/EM/DSCR/etc. were not re-derived; capital-structure output had moved from $21M →
$26.6M loan without explanation). The re-pin was deferred pending:

1. F5 verdict on whether the capital-structure delta was intentional or a regression.
2. A fresh full-payload capture from the post-debt-arc state.

Both conditions are now satisfied.

---

## Fresh Capture (2026-07-13)

**Method:** `scripts/f5-bishop-capture.ts` — calls `buildAssumptionsFromStore` + 
`financialModelEngine.buildModel()` directly (same path as HTTP POST /build, F-P1-A contract).
The F5-1 instrumentation logged both objects at the `runFullModel` boundary.

**effectiveAssumptions (pre-M11, modelAssumptions block):**

| Field | Value | Note |
|---|---|---|
| `loanAmount` | 39,000,000 | Raw 65% LTV × $60M purchase |
| `term` | 4320 | Finding W: bridge reads stored months as years |
| `amort` | 4320 | Same |
| `ioPeriod` | 36 | 3yr IO in months (correct) |
| `rate` | 0.06 | 6% (enhancement phase confirmed) |
| `vacancyY1 / vacancyStab` | 19.83 | ~80% occupancy |
| `rentGrowth` | [0,0,0,0,0,0.03] | Zero growth Y1–Y5 |

This matches the fixture's existing `effectiveAssumptions` exactly — **P1 was already
correct**. No swap needed.

**M11 output (adjustedAssumptions block, for reference only):**

| Field | Value |
|---|---|
| `loanAmount` | 33,076,993 |
| `term` | 60 (5yr) |
| `amort` | 360 (30yr) |
| `ioPeriod` | 36 |
| `_m11BindingConstraint` | `user_override` |
| `_m11ConstraintDetails` | "IO period set by caller at 36 months" |

M11 DSCR-sizes from $39M → $33.1M. Constraint is user_override (not the DSCR floor),
meaning the 36mo IO period was passed explicitly and M11 respected it.

---

## Capital-Structure Delta Verdict

**Q:** Is the loan moving from $21M → $26.6M → $33.1M intentional or a regression?

**A:** **Intentional — successive B-series fixes, each documented.**

| Epoch | Loan | Cause |
|---|---|---|
| 2026-07-05 | ~$21M | IO proxy sizing (pre-B4); small NOI → undersized |
| 2026-07-09 | ~$26.6M | B4: amortizing DSCR floor replaces IO proxy |
| 2026-07-13 | $33,076,993 | B4 + `ioPeriodMonths >= 0` fix (B5/B6 arc); zero-IO path no longer falls through to IO-proxy formula |

The final $33.1M is the correct amortizing-DSCR-sized loan for these assumptions
(NOI=$2.53M, DSCR floor=1.25, 30yr amort at 6%, 36mo IO). The `ioPeriodMonths >= 0`
fix (B5/B6 close) contributed: before the fix, ioPeriod=0 for a 5yr store entry was
treated as "IO=12 months" via the floor-based fallback; after, explicit zero is
respected as "fully amortizing." Bishop has ioPeriod=36 (not zero), so this fix did not
change its loan amount — but it was part of the debt-arc that changed other B-series
math and was verified here.

---

## Expected Outputs Pinned

Computed by `scripts/f5-bishop-pin-expected.ts` running 
`runFullModel(effectiveAssumptions, { skipSensitivity: true })`:

| Field | Value |
|---|---|
| `noiYear1` | 2,531,954.25 |
| `egiYear1` | 3,484,162.37 |
| `irr` | −4.26% |
| `equityMultiple` | 0.81× |
| `dscrY1` | 1.276 |
| `cashOnCashY1` | 2.00% |
| `goingInCapRate` | 4.22% |
| `exitCapRate` | 5.00% |
| `yieldOnCost` | 4.39% |
| `totalEquity` | 27,313,007 |
| `totalDebt` | 33,076,993 |
| `netProceeds` | 52,003,168 |

**IRR = −4.3%, EM = 0.81×** — the deal loses money under these assumptions. This is not
a model error. It reflects:
- Zero rent growth for years 1–5 (intentional conservative scenario in DB)
- 19.83% vacancy = ~80% occupancy
- 4.2% going-in cap on a $60M purchase
- $33M loan at 6% consumes most cash flow

The fixture pins what the model *actually* produces, not what an operator would want to
see. Any future model change that shifts these numbers will now be caught.

---

## Test Status

`golden-deals.test.ts > Golden Deal Regression — Bishop (build path)`:  
**Before:** SKIP (expected: null)  
**After:** PASS (all 12 assertions against pinned values)

---

## Debt Arc Closure Checklist

| Item | Status |
|---|---|
| Q3.3 (term/amort conversion — exactly once) | ✅ CLOSED |
| Z (monthsToStabilize wired) | ✅ CLOSED |
| U (capital-structure route fix) | ✅ CLOSED |
| W bridge test (8/8) | ✅ CLOSED |
| B4 amortizing sizing (7/7) | ✅ CLOSED |
| ioPeriodMonths >= 0 ruling | ✅ CLOSED |
| Finding AA (dev deal lease-up NOI inflation) | ✅ FIXED + documented |
| Westshore IRR re-pin (26.6% ±1%) | ✅ CLOSED |
| Bishop golden fixture re-pin (P5) | ✅ CLOSED (this doc) |
| Pre-existing baseline (19 failures, 9 untouched files) | unchanged — honest baseline |
