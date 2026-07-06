# Excel Parity Oracle Request — PROVISIONAL

**PROVISIONAL — final list issues after Bishop re-pin (F5 verdict).**

**Engine:** JediRe F9 Underwriter Model
**Deals:** Highlands at Satellite (`eaabeb9f-830e-44f9-a923-56679ad0329d`, seed-path, PINNED) + 464 Bishop (`3f32276f-aacd-4da3-b306-317c5109b403`, build-path, UNPINNED — Finding M/O, blocked on external-agent `runFullModel()` extraction)
**Regenerated:** 2026-07-06, W5-FINAL Runbook (C2)
**Fixtures:** `backend/src/services/deterministic/__fixtures__/highlands.golden.ts` (pinned 2026-07-05), `backend/src/services/deterministic/__fixtures__/bishop.golden.ts` (`expected: null`, unpinned per Finding M)

---

## Purpose

This is a **fill-in-the-blanks request** for operator/Leon validation, regenerated from only currently defensible values:

- **Highlands** rows are the pinned, verified seed-path fixture values (`aggregateSeedActuals()` over a raw 93-row `deal_monthly_actuals` snapshot — no fabricated acquisition/financing/exit values; this deal has no acquisition-side underwriting, only owned-asset performance aggregates).
- **Bishop** rows are limited to the five values live-captured and payload-sourced on 2026-07-05 (loan, equity, IRR, EM, DSCR) — each marked **"subject to F5 re-pin."** These values proved staleness is resolved (Finding L fixed) but Finding O (totalEquity reconciliation, ~46.7% divergence) means the equity-derived figures (IRR, EM) may still shift once the external-agent fix lands. Do not treat them as final.
- Every other Bishop field that was never payload-extracted and verified live in this round is listed as **PENDING-RE-PIN** with no number — populating a plausible-looking value here would be exactly the kind of undocumented pin Findings M/N already ruled out.

---

## Highlands at Satellite — Seed-Path (PINNED, verified 2026-07-05)

| Field | Pinned Value | Workbook Value | Match? | Notes |
|---|---|---|---|---|
| **Target Year** | 2025 | | | Aggregation year for the seed-actuals fixture |
| **EGI (Annual)** | $6,315,308.53 | | | `aggregateSeedActuals()` over 93 raw `deal_monthly_actuals` rows |
| **NOI Margin** | 57.1674% | | | = NOI / EGI, annual aggregate |
| **OpEx Ratio** | 42.8326% | | | = 1 − NOI Margin |
| **Boundary Date** | 2026-04-01 | | | Actuals→projection boundary used by the aggregator |

**Provenance:** `source: seed_actuals`, `buildEndpoint: deal_monthly_actuals (direct query) → aggregateSeedActuals()`, `inputSnapshot: highlands-snapshot-2026-07-05 (93 rows)`, `originClass: owned_import`. This is an owned-portfolio asset — there is no acquisition price, loan, IRR, or equity multiple to request; it has no "deal" underwriting, only realized operating performance. Do not ask the workbook for those fields on this row.

---

## 464 Bishop — Build-Path (UNPINNED — Finding M/O, subject to F5 re-pin)

| Field | Live-Captured Value (2026-07-05) | Workbook Value | Match? | Notes |
|---|---|---|---|---|
| **Loan Amount (post-M11)** | $21,024,006 *(subject to F5 re-pin)* | | | Agrees across `summary`/`debtMetrics`/`reasoning.walkthrough` — staleness (Finding L) confirmed fixed |
| **DSCR Year 1** | 1.0424 *(subject to F5 re-pin)* | | | Same three-surface agreement; M14 floor-bound value |
| **IRR (levered)** | −20.95% *(subject to F5 re-pin)* | | | ⚠️ Derived from `totalEquity`, which Finding O shows diverges ~46.7% from `totalAcqCost − loanAmount` — may shift when O is fixed |
| **Equity Multiple** | 0.314× *(subject to F5 re-pin)* | | | ⚠️ Same Finding O caveat as IRR above |
| **Total Equity** | $39,365,994 *(subject to F5 re-pin)* | | | ⚠️ This is the figure Finding O flags as internally inconsistent with `totalAcqCost − loanAmount`; do not treat as reconciled |

**Everything else on Bishop — PENDING-RE-PIN:**

| Field | Status |
|---|---|
| Purchase Price | PENDING-RE-PIN |
| Total Acquisition Cost | PENDING-RE-PIN |
| LTV / LTC (at close) | PENDING-RE-PIN |
| NOI Year 1 | PENDING-RE-PIN |
| EGI Year 1 | PENDING-RE-PIN |
| Going-In Cap Rate | PENDING-RE-PIN |
| Exit Cap Rate | PENDING-RE-PIN |
| Yield on Cost | PENDING-RE-PIN |
| DSCR (min, full hold) | PENDING-RE-PIN |
| Debt Yield | PENDING-RE-PIN |
| Cash-on-Cash Y1 | PENDING-RE-PIN |
| Exit Value | PENDING-RE-PIN |
| Net Sale Proceeds | PENDING-RE-PIN |
| Total Profit | PENDING-RE-PIN |
| LP/GP IRR, LP/GP Equity Multiple | PENDING-RE-PIN |
| Monthly Cash Flow (any month) | PENDING-RE-PIN |
| Annual Debt Service | PENDING-RE-PIN |
| Interest-Only Period / Loan Term / Rate | PENDING-RE-PIN |
| Sensitivity table (exit cap × hold period grid) | PENDING-RE-PIN |

**Why these are not populated:** The prior version of this document (pinned 2026-07-05, pre-W5-FINAL) carried plausible-looking numbers for all of these fields. That pin was reverted (see `W5-DISPATCH.md`, Bishop fixture status) after forensic review found it partially reflected stale pre-fix values. Only the five rows above were independently re-verified live in this round via direct payload capture across three consumer surfaces. The rest genuinely require Bishop's `runFullModel()` re-pin (Finding M/O) before they can be asserted again.

---

## Also Reported This Round (not parity-list items, but relevant to interpreting the numbers above)

**Finding U (new, 2026-07-06):** The `GET /api/v1/capital-structure/:dealId` route computes `summary.dscr` with a `interestRate / 100` double-division bug, inflating DSCR by ~100x on both deals (Bishop: 125.0 vs. correct 1.0424; Highlands: 188.76 vs. correct 1.8876 — Highlands' ratio is exactly 100x, confirming the mechanism). If Leon's workbook is ever compared against this specific route's `summary.dscr` field (rather than the F9/`debtMetrics.dscr` value used above), expect a false mismatch. See `W5-DISPATCH.md` Finding U for full repro.

---

## Verification Steps

1. Open the Bishop and Highlands underwriting workbooks.
2. For Highlands, populate the Workbook Value column for the five seed-path aggregate fields only (this asset has no acquisition underwriting).
3. For Bishop, populate the Workbook Value column for the five "subject to F5 re-pin" rows only. Do not attempt to fill in PENDING-RE-PIN rows — they will be regenerated once the external-agent `runFullModel()` fix (Findings M/O) lands and Bishop is re-pinned.
4. Flag any divergence >1% or >$10K in the "Match?" column.
5. Return this document with populated values; a follow-up final version will be issued after Bishop's re-pin.

---

*Regenerated: 2026-07-06*
*Engine Arc: W5-FINAL Re-Acceptance Runbook (C2)*
*Supersedes: prior 2026-07-06 "Bishop v4 (Post-Fix-4b)" version — that version's Bishop pin was reverted; do not use its PENDING/full-field values.*
*Next: full re-issue after Bishop re-pin (external agent, F5), owner: operator (R-2)*
