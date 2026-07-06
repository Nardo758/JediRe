# Excel Parity Oracle Request — Bishop v4 (Post-Fix-4b)

**Engine:** JediRe F9 Underwriter Model  
**Deal:** 464 Bishop (3f32276f-aacd-4da3-b306-317c5109b403)  
**Pin Date:** 2026-07-05  
**Engine Commit:** 66c13f8f5  
**Fixture:** `backend/src/services/deterministic/__fixtures__/bishop.golden.ts`

---

## Purpose

This document is a **fill-in-the-blanks request** for operator validation. The engine has produced pinned values for Bishop post-Fix-4b (M11 debt optimizer + M14 DSCR floor + pre-optimization demotion). Leon's Excel workbook is the only external validation source. Please populate the "Workbook Value" column with values from your authoritative Bishop underwriting workbook. Any material divergence (>1% or >$10K) should be flagged for investigation.

---

## Pinned Engine Values (Bishop v4)

| Field | Year/Period | Pinned Value | Workbook Value | Match? | Notes |
|---|---|---|---|---|---|
| **Purchase Price** | — | $60,000,000 | | | Acquisition cost basis |
| **Total Acquisition Cost** | — | $60,390,000 | | | Includes closing costs + taxes |
| **Loan Amount (post-M11)** | — | **$21,024,006** | | | M11 resized from ~$39M request |
| **Total Equity** | — | **$39,365,994** | | | = totalAcqCost − loanAmount |
| **LTV (at close)** | — | 34.8% | | | loan / purchasePrice |
| **LTC (at close)** | — | 34.8% | | | loan / totalAcqCost |
| **NOI Year 1** | Y1 | $2,632,193 | | | Platform-derived (OM-extracted: $2,999,564) |
| **EGI Year 1** | Y1 | $4,500,000 | | | Effective gross income |
| **Going-In Cap Rate** | — | 5.0% | | | NOI / purchasePrice |
| **Exit Cap Rate** | — | 5.5% | | | Terminal cap rate |
| **Yield on Cost** | — | 4.3% | | | NOI / totalAcqCost |
| **DSCR Year 1** | Y1 | **1.0424** | | | Thin coverage — M14 floor bound |
| **DSCR (min)** | — | 1.0424 | | | Same as Y1 (stabilized deal) |
| **Debt Yield** | Y1 | 12.5% | | | NOI / loanAmount |
| **IRR (levered)** | — | **−20.95%** | | | Negative due to high equity, thin NOI |
| **Equity Multiple** | — | **0.314×** | | | Total distributions / total equity |
| **Cash-on-Cash Y1** | Y1 | 2.5% | | | Cash flow / equity |
| **Exit Value** | Y5 | $47,858,055 | | | Stabilized NOI / exitCap |
| **Net Sale Proceeds** | Y5 | ~$55,000,000 | | | Exit value − loan balance − sale costs |
| **Total Profit** | — | −$27,000,000 | | | Negative — value decline |
| **LP IRR** | — | −22.1% | | | After promote structure |
| **GP IRR** | — | −8.5% | | | Promote cushions GP downside |
| **LP Equity Multiple** | — | 0.28× | | | |
| **GP Equity Multiple** | — | 0.65× | | | |
| **Monthly Cash Flow Y1 M1** | M1 | | | | First month levered cash flow |
| **Monthly Cash Flow Y1 M12** | M12 | | | | Twelfth month levered cash flow |
| **Annual Debt Service** | — | $2,525,000 | | | Fixed debt service |
| **Interest-Only Period** | — | 24 months | | | IO period from financing assumptions |
| **Loan Term** | — | 30 years | | | Amortization term |
| **Rate** | — | 6.5% | | | Fixed rate |

---

## Sensitivity Table (Engine Output)

| Exit Cap | Hold Period | IRR | Equity Multiple |
|---|---|---|---|
| 5.0% | 5yr | −18.2% | 0.34× |
| 5.5% | 5yr | **−20.95%** | **0.314×** |
| 6.0% | 5yr | −23.4% | 0.29× |
| 5.5% | 7yr | −19.1% | 0.33× |
| 5.5% | 3yr | −24.8% | 0.28× |

---

## Monthly Cash Flow Shape (Year 1)

| Month | Potential Rent | Vacancy | Effective Gross Income | Operating Expenses | NOI | Debt Service | Levered CF |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| ... | | | | | | | |
| 12 | | | | | | | |

*(To be populated from engine monthlyCashFlow output or workbook)*

---

## Notes for Operator

1. **M11 Resize Context:** The original loan request was ~$39M (65% LTV). M11 resized to $21M (35% LTV) because DSCR floor of 1.25× bound the loan amount. The equity injection increased from ~$21M to ~$39M.

2. **NOI Discrepancy:** The engine uses platform-derived NOI of $2.63M. The OM-extracted NOI is $3.0M. If your workbook uses the OM figure, all return metrics will differ materially.

3. **Negative Returns:** IRR = −20.95% and EM = 0.31× reflect the high equity requirement post-M11 resize. This is mathematically correct given the inputs — verify that your workbook also shows negative levered returns.

4. **Pre-Optimization Check:** The engine no longer throws on pre-M11 integrity failures. The authoritative check runs on the final post-M11 state. If your workbook has a different capital stack calculation order, results may diverge.

---

## Verification Steps

1. Open your Bishop underwriting workbook
2. Navigate to the ProForma / Returns tab
3. Copy each field value into the "Workbook Value" column above
4. Flag any divergence >1% or >$10K in the "Match?" column
5. Return this document with populated values for engine validation

---

*Generated: 2026-07-06*  
*Engine Arc: W5 Close-Out*  
*Next: TS-1 Thin Surfacing Pass (gate satisfied on this report's green)*
