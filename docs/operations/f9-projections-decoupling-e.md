# F9 Projections Decoupling — Dispatch E Closing Note

**Date:** 2026-05-20  
**Task:** #950 — F9 Projections decoupling design investigation (reading-only)  
**Type:** Investigation — no code changes  

---

## 1. Verbatim Comment Block (FinancialEnginePage.tsx lines 195–201)

```typescript
  // ── Projections: preserve the composer's ProjYear[] shape ──
  // The composer's buildProjections() produces the full keyed shape that
  // ProjectionsTab expects (vacancyLoss, lossToLease, payroll, repairs, …).
  // model.annualCashFlow uses different key names (vacancy, egr, opex…) so
  // overwriting here broke every revenue-deduction and expense row in the tab.
  // The model's annualCashFlow is already consumed for returns/waterfall/capital
  // below — we don't need it here.
```

*(Lines 202–217 then immediately open the `capital` block, with no continuation of the projections comment.)*

---

## 2. Plain-English Interpretation

`mergeModelIntoFinancials` is called every time the LV build engine returns a result. It takes the Composer's `f9Financials` snapshot (`src`) and a `ModelResults` object from the build engine (`model`), and merges them into a new `F9DealFinancials` state.

For most output sections — returns, waterfall, capital schedule — it reads from `model.annualCashFlow` and `model.summary`. But for **projections** it explicitly does nothing: it just lets `src.projections` (the Composer output) pass through untouched via `cloneFinancialsForSync(src)` at line 76.

The reason, stated in the comment, is a structural schema mismatch between the two data sources:

- The Composer (`getDealFinancials`, `buildProjections`) produces a `ProjYear[]` array with **~35 individually named fields** covering every revenue deduction, expense line, debt component, after-tax calculation, and disposition row.
- The build engine's `model.annualCashFlow` produces an `AnnualCashFlowRow[]` array with only **8 summary fields**.

At some point prior to this comment being written, `mergeModelIntoFinancials` did overwrite `projections` with the build engine output. That caused every revenue deduction row (vacancyLoss, lossToLease, concessions, badDebt, nru) and every individual expense row (payroll, repairs, turnover, etc.) to render blank — because their key names don't exist in `AnnualCashFlowRow`. The fix was to stop overwriting, and the comment documents why.

---

## 3. Schema Mismatch in Detail

**`AnnualCashFlowRow` fields** (build engine output, `types.ts:162`):

| Field | Concept |
|---|---|
| `year` | Year index |
| `gpr` | Gross potential rent |
| `vacancy` | Vacancy (a single number — loss or %) |
| `egr` | Effective gross revenue |
| `otherIncome` | Other income |
| `totalRevenue` | Total revenue |
| `opex` | Total operating expenses (single aggregate) |
| `noi` | Net operating income |
| `debtService` | Total debt service (aggregate) |
| `cashFlow` | Cash flow before tax |
| `lpDistribution` | LP distribution (optional) |
| `gpDistribution` | GP distribution (optional) |
| `cumulativeReturn` | Cumulative return (optional) |
| `runningEM` | Running equity multiple (optional) |

**`ProjYear` fields** (Composer output, `f9Financials.projections`, `ProjectionsTab.tsx:82–158`):

| Section | Keys (30+ fields) |
|---|---|
| Revenue deductions | `gpr`, `vacancyLoss`, `lossToLease`, `concessions`, `badDebt`, `nru`, `nri`, `otherIncome`, `egi` |
| Individual expenses | `payroll`, `repairs`, `turnover`, `contractSvc`, `marketing`, `utilities`, `gAndA`, `mgmtFee`, `insurance`, `reTaxes`, `reserves`, `totalOpex` |
| NOI + ratios | `noi`, `opMargin`, `noiPerUnit` |
| Debt breakdown | `interest`, `principal`, `annualDS` |
| Cash flow | `cfbt`, `cfads` |
| After-tax rows | `depreciation`, `taxableIncome`, `taxPayable`, `afterTaxCfads` |
| Disposition | `exitNoi`, `exitCap`, `grossSaleValue`, `sellingCosts`, `dispositionDocStamps`, `loanPayoff`, `dispositionTaxPayable`, `netSaleProceeds` |
| Metric strip | `occupancy`, `dscr`, `debtYield`, `coc`, `cumulativeEM`, `capRatePct`, `noiMarginPct`, `opexRatioPct`, `rentGrowthPct` |
| Source badges | `reTaxSource`, `debtSource` |

**Cross-walk (annualCashFlow → ProjYear):**

| annualCashFlow field | ProjYear equivalent | Gap |
|---|---|---|
| `gpr` | `gpr` | ✅ match |
| `vacancy` | `vacancyLoss` | Renamed; semantic question ($ loss vs %) |
| `egr` | `egi` | Renamed (gross revenue vs gross income) |
| `otherIncome` | `otherIncome` | ✅ match |
| `opex` | `totalOpex` | Renamed; 11 individual expense lines absent |
| `noi` | `noi` | ✅ match |
| `debtService` | `annualDS` | Renamed; `interest`/`principal` split absent |
| `cashFlow` | `cfbt` | Renamed |
| `runningEM` | `cumulativeEM` | ~match |
| *absent* | `lossToLease`, `concessions`, `badDebt`, `nru`, `nri` | 5 revenue deductions missing |
| *absent* | `payroll`, `repairs`, `turnover`, `contractSvc`, `marketing`, `utilities`, `gAndA`, `mgmtFee`, `insurance`, `reTaxes`, `reserves` | All 11 expense lines missing |
| *absent* | `interest`, `principal` | Debt breakdown missing |
| *absent* | `cfads` | CFADS absent |
| *absent* | All 4 after-tax rows | After-tax section unrepresentable |
| *absent* | All 8 disposition rows | Exit analysis unrepresentable |
| *absent* | `occupancy`, `dscr`, `debtYield`, `coc`, `capRatePct`, `noiMarginPct`, `opexRatioPct`, `rentGrowthPct` | 8 of 9 metric strip fields absent |

**Summary:** 10 out of 14 `annualCashFlow` fields have either a matching or renamed `ProjYear` equivalent. But 22+ `ProjYear` fields have **no** `annualCashFlow` equivalent at all — they are physically absent from the build engine's output. These include every individual expense line, every after-tax row, and every exit/disposition row.

---

## 4. Design Intent Classification

**Permanent intentional design — not a deferred TODO.**

Evidence:
- The comment uses the past tense "overwriting here **broke** every revenue-deduction and expense row" — this is documenting a corrective fix, not acknowledging a limitation to revisit.
- The statement "we don't need it here" is declarative and final. Compare to TODO-style language ("TODO: harmonize key names" or "eventually we should…") which is absent.
- The `model.annualCashFlow` data is explicitly noted as "already consumed for returns/waterfall/capital below" — the build output is fully used where it can be; the projections omission is a scoping decision, not an oversight.
- The `ProjectionsTab` renders 30+ named rows with formula drilldown drawers, source badges (reTaxSource, debtSource), and sub-period views — this depth of detail is structurally incompatible with the 8-field `AnnualCashFlowRow` and was clearly designed to consume the Composer output exclusively.

---

## 5. What a Coupling Would Gain and Risk

### What it gains
After a successful build run, the Projections tab would show updated GPR, NOI, total opex, and CFBT numbers reflecting the build engine's growth and assumption model. For the 4–5 fields that do overlap, values would update without requiring a separate re-fetch of `/financials`.

### What it breaks

If `model.annualCashFlow` were naively written into `f9Financials.projections` (after key-name translation):

1. **5 revenue deduction rows go blank**: lossToLease, concessions, badDebt, nru, nri — all render `—` because `annualCashFlow` has no equivalent fields.
2. **11 individual expense rows go blank**: Every expense line (payroll, repairs, turnover, contractSvc, marketing, utilities, g&a, mgmtFee, insurance, reTaxes, reserves) — `annualCashFlow` only carries the `opex` aggregate.
3. **Debt breakdown goes blank**: `interest` and `principal` rows always render `—`; only the `annualDS` total could be populated.
4. **CFADS goes blank**: No CFADS in `annualCashFlow`.
5. **After-tax section goes blank**: No depreciation, taxableIncome, taxPayable, or afterTaxCfads.
6. **Disposition section goes blank**: No exit analysis rows.
7. **8 of 9 metric strip fields go blank**: occupancy, DSCR, debt yield, CoC, cap rate, NOI margin, OER, rent growth — only EM partially maps.
8. **Formula drilldown drawers break**: `buildDrilldown()` reads individual ProjYear fields (e.g., `proj.egi`, `proj.totalOpex`) that would now be null for all years.
9. **Source badges break**: `reTaxSource` and `debtSource` badge system has no equivalent in `annualCashFlow`.

Net result: coupling produces a tab that shows GPR/NOI/CFBT totals but is 80% blank — worse than the current state (fully blank until Composer runs) because blank-after-coupling implies data is missing rather than "not yet computed."

---

## 6. Recommendation

**Leave decoupled. Do not write `annualCashFlow` into `f9Financials.projections`.**

The Projections tab should remain sourced exclusively from the Composer path (`getDealFinancials → buildProjections → f9Financials.projections`). The schemas are structurally incompatible at the detail level the tab requires.

The correct path to "build-aware Projections" is not coupling but **re-triggering the Composer fetch after a build completes**:

1. Build succeeds → `setModelResults(model)` (current behavior, populates returns/waterfall/capital from build)
2. Additionally: dispatch a re-fetch of `GET /financials` after build success
3. `getDealFinancials` recomputes `buildProjections` using the same LayeredValue state that the build just confirmed — producing a fresh `ProjYear[]` that is authoritative, fully-shaped, and consistent

This approach costs one extra API call per build but requires zero schema translation, preserves every row in the tab, and avoids the drilldown/badge breakage described above.

**If the goal is to reduce the number of API calls**, the alternative is to move `buildProjections` computation into the build engine's response (so the build returns a `ProjYear[]` directly). This is a larger refactor but architecturally clean — the build engine would become the single source of truth for both the summary metrics (returns/waterfall) and the detailed projections grid, and `mergeModelIntoFinancials` could safely write both. This would be Task-grade work, not a merge-path change.

---

## Appendix — `mergeModelIntoFinancials` Scope Summary

For completeness, here is what the function does and does not overwrite:

| F9DealFinancials section | Source after merge | Notes |
|---|---|---|
| `returns` | `model.summary` (LV-guard on `lpNetIrr`/`lpEquityMultiple`/`avgCashOnCash`) | LV engine values preserved when `src.leaseVelocity != null` |
| `waterfall` | `model.waterfallDistributions` | Full overwrite |
| `capitalStack` | `assumptions.acquisition/financing` + `src.capitalStack` fallback | Partial overwrite (purchasePrice, loanAmount, interestRate, equityAtClose, ltc) |
| `capital` | `model.annualCashFlow` (schedule) + `model.summary` (metrics) | Full overwrite |
| **`projections`** | **`src.projections` unchanged** | **Explicitly preserved — see comment block** |
| `proforma` | `src.proforma` unchanged | Not touched by mergeModel |
| `trafficProjection` | `src.trafficProjection` unchanged | Not touched by mergeModel |
| `taxes` | `src.taxes` unchanged | Not touched by mergeModel |
| `debt` | `src.debt` unchanged | Not touched by mergeModel |
| `sourcesUses` | `src.sourcesUses` unchanged | Not touched by mergeModel |
