# F9 Data Flow Audit — Phase 1 Report

**Date:** May 2026  
**Deal:** 464 Bishop — `3f32276f-aacd-4da3-b306-317c5109b403` (232 units)  
**Method:** Live DB queries + code trace (file:line evidence throughout)  
**Status:** Phase 1 complete — audit only, no fixes

---

## Flow 1: Unit Mix → Pro Forma

| Step | Source File:Line | Consumer File:Line | Break Class | Notes |
|---|---|---|---|---|
| `unit_mix` storage | `deal_assumptions.unit_mix` (JSONB array) | `deal-assumptions.types.ts:96` `UnitMixItem[]` | — | Confirmed schema; `unit_mix = {}` for 464 Bishop — empty |
| GPR computation switch | `financials-composer.service.ts:286` checks `pyOvs['da:use_unit_mix_for_gpr']?.value === true` | — | `DATA_NOT_FLOWING` | Flag **not set** for 464 Bishop; unit_mix bypassed entirely |
| GPR actual source (464 Bishop) | `proforma-adjustment.service.ts:2134` builds `gprDecomposition` from extraction layers (T12 / OM / rent roll) | `proforma-adjustment.service.ts:3247` `gprY1 = assumptions.gprDecomposition?.resolvedAnnual` | — | Working; GPR sourced from extraction, not unit_mix |
| Year 2–10 GPR | `deal_assumptions.per_year_overrides['gpr:yr2'...'gpr:yr10']` | `proforma-adjustment.service.ts:3295` `gpr = Math.round(gprY1 * rentMult)` — **does not read per-year overrides** | `DATA_NOT_FLOWING` | Covered under Flow 3 below |
| UnitMixTab edit | `UnitMixTab.tsx:976` `PATCH /financials/override` | `proforma-adjustment.service.ts:3888` `applyUnitMixOverride` updates `unit_mix` + `unit_mix_overrides` | — | Write path wired correctly |
| Cross-tab refresh | `UnitMixTab.tsx:987` calls `onF9Refresh()` | Parent triggers full financials re-fetch | — | Working, but only meaningful if flag is set |
| Flag activation UI | No UI control identified for `da:use_unit_mix_for_gpr` flag | `proforma-adjustment.service.ts:4131` handles `da:` prefix overrides via `PATCH /financials/override` | `DATA_NOT_FLOWING` | No user-facing toggle to switch GPR source from extraction to unit_mix |

### Flow 1 Health: 🟡 YELLOW

Unit_mix edits are persisted and the cross-tab refresh fires correctly. However, the GPR derivation from unit_mix is gated behind the `da:use_unit_mix_for_gpr` flag, which is not set for 464 Bishop and has no user-facing activation path. Edits to the Unit Mix tab silently do nothing to the rendered GPR unless this flag is manually set via API. The mechanism is complete on the backend; the gap is the activation switch and a clear user contract for when unit_mix drives GPR vs extraction data.

---

## Flow 2: Other Income → Pro Forma

| Step | Source File:Line | Consumer File:Line | Break Class | Notes |
|---|---|---|---|---|
| `other_income_per_unit` → `other_income` | `proforma-adjustment.service.ts:1918` `_otherIncMul = totalUnits × 12`; `:1928` `toDollarRow('other_income_per_unit', 'other_income', ...)` | `proforma-adjustment.service.ts:3252` `otherIncPU = ry1('other_income_per_unit')`; `:3303` `otherIncome = Math.round(otherIncPU × rentMult × totalUnits × 12)` | — | Working; annual other income compounded by rent growth rate each year |
| Ancillary breakdown consumed | `financials-composer.service.ts:979–1071` `composeOtherIncomeBreakdown` maps parking / RUBS / pet_rent / late_fees | Ancillary Reconciliation panel in UI only | — | By design; breakdown is informational, not used in OSRows Pro Forma calculation |
| Breakdown → `other_income_per_unit` link | Extraction seeder (`proforma-seeder.service.ts`) is responsible for summing individual ancillary fields into `other_income_per_unit` seed | `proforma-adjustment.service.ts:3252` reads aggregate only | Potential `DATA_NOT_FLOWING` | If extraction stores parking / RUBS / pet as breakdown-only and doesn't roll them into `other_income_per_unit`, Pro Forma misses them. Cannot fully verify without accessible `year1` JSONB (table schema differs from expected `proforma_year1`) |
| User override | `PATCH /financials/override` → `applyFinancialsOverride` at `proforma-adjustment.service.ts:4061` | Persisted in `per_year_overrides`; priority over seed on next fetch | — | Working |
| Re-derive on change | `onF9Refresh()` triggers full re-fetch | — | — | Working; no real-time streaming |

### Flow 2 Health: 🟡 YELLOW

The core `other_income_per_unit → other_income` path is clean and wired end-to-end including projection compounding. The yellow flag is on the breakdown-to-aggregate linkage: the ancillary breakdown fields (parking, RUBS, pet_rent) are extracted and displayed in the reconciliation panel, but whether they're reliably rolled into the `other_income_per_unit` seed during ingestion could not be confirmed from live data (the `proforma_year1` table referenced in some code paths does not exist under that name in the live schema — the actual seeded data lives in `deal_assumptions` JSONB columns whose schema differs from expectations in the audit doc). Low risk if extraction is working correctly; P3 if it isn't.

---

## Flow 3: INPUTS + Pro Forma Overrides → Projections

| Step | Source File:Line | Consumer File:Line | Break Class | Notes |
|---|---|---|---|---|
| Projections engine location | `proforma-adjustment.service.ts:3226` inline IIFE loop, not `buildProjectionsForExport` | `proforma-adjustment.service.ts:3847` added to `getDealFinancials` return object | — | Projections **are** on the F9 DealFinancials response; `buildProjectionsForExport` (`f9-financial-export.service.ts:35`) is Excel export only |
| Y1 seed reads | `proforma-adjustment.service.ts:3254–3263` `ry1('payroll')`, `ry1('gpr')`, etc. | `ry1` resolves via LayeredValue with overrides applied | — | Reads resolved Y1 (with any Y1-level overrides applied) ✓ |
| Rent growth | `proforma-adjustment.service.ts:3285` `assumptions.perYear[y].rentGrowthPct ?? assumptions.rentGrowthStabilized ?? 0.03` | `proforma_assumptions.rent_growth_baseline = 3.5%` for 464 Bishop (no override set) | — | Working |
| Vacancy | `proforma-adjustment.service.ts:3296` `tv?.vacancyPct ?? pv?.vacancyPct ?? ry1('vacancy_pct') ?? 0.05` | Traffic projection → assumptions perYear → Y1 seed | — | Working; traffic projection takes priority |
| OpEx growth | `proforma-adjustment.service.ts:3291` `opexMult = Math.pow(1 + opexGrowthRate, yr-1)` | `proforma_assumptions.opex_growth_baseline = 2.8%` for 464 Bishop (no override) | — | Working |
| **Per-year dollar overrides ignored** | `deal_assumptions.per_year_overrides` has `payroll:yr2=334544`, `gpr:yr2=5048442`, `g_and_a:yr2=71688`, etc. (yr2–yr10 for all opex fields) | `proforma-adjustment.service.ts:3307` `payroll = Math.round(payrollY1 × opexMult)` — **no per-year override lookup** | `DATA_NOT_FLOWING` | **P1.** Projections engine derives every year from Y1 × compound growth. Per-year dollar overrides stored in `per_year_overrides` are never read by the inline engine. `buildProjectionsForExport` (Excel) also reads Y1 × growth at `f9-financial-export.service.ts:155`. Both engines ignore `payroll:yr2` etc. |
| Projections tab write → display | Projections tab writes per-year overrides; these survive in the DB | On next F9 fetch, inline engine recomputes from Y1 × growth, ignoring stored values | `DATA_NOT_FLOWING` | **P1.** Operator edits to individual projection years are stored but the F9 render reverts to formula on next load |
| Hold-period change | `holdYears` passed to `getDealFinancials` | `proforma-adjustment.service.ts:3278` `for (let yr = 1; yr <= holdYears; yr++)` | — | Works; requires `onF9Refresh` |
| Payroll override test (if user edits Y1 payroll to $400K) | `per_year_overrides` Y1 override written by `applyFinancialsOverride`; `ry1('payroll')` reads it | `proforma-adjustment.service.ts:3307` `payroll = Math.round(payrollY1 × opexMult)` at yr=2 uses the updated Y1 | — | **Y1 override correctly flows into Year 2+** via `opexMult`; only individual yr2+ overrides are ignored |

### Flow 3 Health: 🔴 RED

The projections engine is on the F9 response (not handler-local as the prior audit suggested — confirmed at line 3847). However, a P1 break exists: per-year operator overrides (`payroll:yr2`, `gpr:yr2`, etc.) are persisted to `per_year_overrides` but never read by the projections loop. The engine re-derives all years from Y1 × compound growth rate on every fetch. Operator edits to individual projection years appear to save but revert on refresh. Note: Y1 overrides flow correctly into Year 2+ via the growth multiplier — the break is specifically per-year (yr2+) dollar overrides.

---

## Flow 4: Deal Cost / Partnership / Closing → Capital + Returns

| Step | Source File:Line | Consumer File:Line | Break Class | Notes |
|---|---|---|---|---|
| Purchase Price → F9 composer | `proforma-adjustment.service.ts:2189` prefers `deal_data.purchase_price` → `deals.budget` | `proforma-adjustment.service.ts:2175` → `capitalStack.purchasePrice` on F9 response | — | F9 path correct; 464 Bishop has `budget=null`, `deal_data.purchase_price=null` |
| Purchase Price → Terminal CapitalTab | `CapitalTab.tsx:84` `deal.budget \|\| model.acquisition.purchasePrice \|\| 45000000` | — | `DATA_NOT_FLOWING` | **P1.** Terminal Capital tab falls through to hardcoded $45M for 464 Bishop (both sources null). Separate from F9 Financial Engine path. |
| Closing Costs → F9 S&U | `proforma-adjustment.service.ts:2832` sums `suCcSubLineTotal` → `suClosingCostsOvr` → 2% estimate | `sourcesUses.uses[]` item `closingCosts` on F9 response | — | Working after today's sub-line fix; operator sub-lines correctly summed |
| Closing Costs → Terminal CapitalTab | `CapitalTab.tsx:85` `const closingCosts = purchasePrice × 0.02` | — | `DATA_NOT_FLOWING` | **P1.** Terminal CapitalTab ignores both `su:closingCosts` aggregate and all 5 sub-line overrides. Hardcoded 2%. |
| LP-GP split persistence | No Deal Terms UI row; `wf:lpShare`/`wf:gpShare` writable via `PATCH /financials/override` only | `proforma-adjustment.service.ts:2943` `wfOvr('lpShare') ?? 0.9` | `PERSISTENCE_GAP` | **P2.** 464 Bishop has no `wf:` overrides → defaults to 90/10. No user-facing control to change the split. |
| LP-GP → Returns (lpNetIrr / lpEquityMultiple) | `proforma-adjustment.service.ts:2864` S&U defaults `suLpShare = 0.90`; `:2943` waterfall reads `wf:` overrides | `proforma-adjustment.service.ts:3158` `lpCFs` → Newton-Raphson IRR; `:3189` lpEquityMultiple = lpDistCumul / schedLpEq | — | Calculation correct given inputs; wf: overrides would be applied if set |
| Dual-source purchase price | Already logged `TODO_DEAL_TERMS_FOLLOWUP.md` item 11 | — | — | Not re-surfacing |

### Flow 4 Health: 🟡 YELLOW

The F9 Financial Engine path (getDealFinancials → ProFormaSummaryTab / DealTermsTab) is correct and reflects operator overrides. The yellow comes from two breaks in the Terminal's CapitalTab (separate component, separate data contract) which are hardcoded and don't pull from the F9 override system. The LP-GP persistence gap is also real — there's nowhere in the UI to set it.

---

## Consolidated Break List

### P1 — Produces wrong numbers

| ID | Flow | Break | File:Line | Class |
|---|---|---|---|---|
| P1-A | Flow 3 | Per-year projections ignore operator overrides (`payroll:yr2`, `gpr:yr2`, etc.) — stored but engine ignores them, reverts to Y1 × growth on fetch | `proforma-adjustment.service.ts:3307` | `DATA_NOT_FLOWING` |
| P1-B | Flow 4 | Terminal `CapitalTab` falls through to hardcoded $45M purchase price | `CapitalTab.tsx:84` | `DATA_NOT_FLOWING` |
| P1-C | Flow 4 | Terminal `CapitalTab` hardcodes 2% closing costs, ignores all overrides | `CapitalTab.tsx:85` | `DATA_NOT_FLOWING` |

### P2 — Stale data / requires manual intervention

| ID | Flow | Break | File:Line | Class |
|---|---|---|---|---|
| P2-A | Flow 1 | `da:use_unit_mix_for_gpr` flag not set for 464 Bishop; unit_mix edits silently do nothing to GPR; no UI to activate the flag | `financials-composer.service.ts:286` | `DATA_NOT_FLOWING` |
| P2-B | Flow 4 | LP-GP split (`wf:lpShare`/`wf:gpShare`) has no user-facing write path; always defaults to 90/10 | `proforma-adjustment.service.ts:2943` | `PERSISTENCE_GAP` |

### P3 — Low risk / needs verification

| ID | Flow | Break | Notes |
|---|---|---|---|
| P3-A | Flow 2 | Ancillary breakdown fields (parking, RUBS, pet) → `other_income_per_unit` rollup not verified on live data; `proforma_year1` table doesn't exist under expected name | Needs seeder-level trace to confirm |

### Already logged — not re-surfaced

| Existing Entry | TODO File | Status |
|---|---|---|
| Purchase price dual-source (`deals.budget` vs `deal_data.purchase_price`) | `TODO_DEAL_TERMS_FOLLOWUP.md` item 11 | ✅ logged |

---

## Phase 2 Fix Candidates (pending Leon's approval)

Suggested commit scope per finding approved:

| Finding | Suggested Commit |
|---|---|
| P1-A | `fix(projections): apply per-year overrides in inline projections loop` — in `proforma-adjustment.service.ts:3278` loop, check `per_year_overrides['payroll:yr{yr}']` etc. before falling back to Y1 × growth. Effort: **M** |
| P1-B + P1-C | `fix(capital-tab): read purchase price and closing costs from F9 financials contract` — replace `deal.budget` and `× 0.02` with `capitalStack.purchasePrice` and `sourcesUses.uses.closingCosts`. Effort: **S** |
| P2-A | `feat(unit-mix): add GPR source toggle row in Unit Mix tab` — UI switch that sets `da:use_unit_mix_for_gpr` via `PATCH /financials/override`. Effort: **M** |
| P2-B | `feat(deal-terms): add LP-GP split row` — Deal Terms Section 4 row wired to `wf:lpShare` / `wf:gpShare` via `PATCH /financials/override`. Effort: **S** |
| P3-A | Investigate only — read actual `other_income_per_unit` vs sum of breakdown fields for 464 Bishop. No fix until discrepancy confirmed. Effort: **S (investigation)** |

---

## Phase 3 Side Debt (new TODO entries — not yet filed)

These require schema changes, new endpoints, or coordinated work beyond a single surgical fix:

- **Flow 3 / P1-A (L):** Per-year projections override system is architectural — the projection engine currently has no per-field-per-year override path. A proper fix involves either (a) a read pass over all `field:yr{n}` keys before the growth formula fallback, or (b) a separate `projections_overrides` table with year-keyed entries. The current `per_year_overrides` JSONB is already used for both year-1 overrides and year 2+ overrides under the same key format, so approach (a) is lower risk.

- **Flow 4 / P2-B (S):** LP-GP split write path — needs a Deal Terms Section 4 row (or a Partnership tab row) wired to `wf:lpShare`/`wf:gpShare`. Write path via `PATCH /financials/override` already exists.
