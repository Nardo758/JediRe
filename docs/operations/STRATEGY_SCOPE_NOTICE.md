# Strategy Scope Notice — STR / Flip / Land Hold

**Status:** Active  
**Created:** 2026-05-27  
**Task:** #1237 — STR/Flip/Land Hold 'Not Yet Supported' notice  
**Updated:** 2026-05-27 — Task #1243 release note (strategy selector functional as of Task #1233)

---

## Release note — Strategy selector is now functional (Task #1233)

**Shipped:** 2026-05-27

The Investment Strategy dropdown in DEAL TERMS is now wired end-to-end. Saving a strategy now drives:

- **Pattern B routing** — the financial engine selects the correct deal-type template
- **RegimeExpand visibility** — renovation and improvement sections appear only for strategies that require them
- **Renovation section display** — Value-Add and Redevelopment show the rehab budget rows; Rental and Build-to-Sell do not
- **Tab availability** — future tabs gated on deal type now resolve correctly

**Operators who previously set a strategy saw no effect.** All prior saves were recorded correctly, but routing was not applied. Those deals now route on the next page load — no re-save is required. Operators should open each active deal and verify the strategy shown in DEAL TERMS reflects their intent.

### Action required

Open each active deal → DEAL TERMS tab → confirm the **Investment Strategy** row reflects the correct strategy. Deals with no strategy set show a teal banner at the top of the tab.

---

## Summary

Three investment strategies available in the DEAL TERMS strategy selector currently have **zero dedicated F9 UI**. Operators who select them receive the standard multifamily-existing layout, which is structurally wrong for these deal types. Full UI support is deferred to a future release.

The three affected strategies are:

| Strategy | Display label | Backend key | Gap severity |
|---|---|---|---|
| Short-Term Rental | `Short-Term Rental ★` | `Short-Term Rental` | **Critical** — STR revenue model (ADR × occupancy) is fundamentally different from contracted rent |
| Flip | `Flip ★` | `Flip` | **Critical** — flip exit is resale price, not cap-rate-based; hold period carry costs are absent |
| Land Hold | `Land Hold ★` | `Land Hold` | **Critical** — land hold has NO income section; showing GPR/OPEX rows is actively misleading |

The `★` suffix in the dropdown labels signals to operators that these options are limited.

The four **fully supported** strategies — Rental, Value-Add, Build-to-Sell, Redevelopment — are wired end-to-end as of Task #1233.

---

## What operators see today when one of these is selected

All three strategies resolve to the same rendering path: the standard multifamily acquisition layout with GPR, OPEX, NOI, and a cap-rate-based exit. This layout was designed for stabilized or value-add acquisitions.

**Short-Term Rental:** The standard layout shows per-unit contracted rent (GPR) and expense ratios derived from multifamily benchmarks. STR revenue is occupancy rate × Average Daily Rate (ADR), with cleaning fees, platform fees, and furnishing costs that have no input rows anywhere in F9. An operator underwriting a Smoky Mountain cabin or urban STR would be entering incorrect assumptions into structurally wrong cells.

**Flip:** The standard layout shows a cap-rate-based exit (Exit Cap Rate × stabilized NOI = exit value). A flip exits at a resale price, not a cap rate. The platform has no carry cost section (holding costs: property tax, insurance, utilities, debt service during the renovation period), no profitMargin return metric, and no monthsHeld metric. The 18-month hold period typical of a flip is modeled the same as a 5-year stabilized hold.

**Land Hold:** The standard layout unconditionally renders GPR rows (Gross Potential Rent), Effective Gross Income, and all operating expense rows. A land hold generates no income — showing income rows is not just incomplete but actively misleading. The correct layout would show only: land cost basis, annual holding costs (property tax, insurance, maintenance, debt service), exit at a land sale price, and profitMargin/levered IRR as return metrics.

---

## Operator-visible signals

### As of Task #1237

1. **Dropdown badge:** Options for Flip, Short-Term Rental, and Land Hold are annotated with a `★` suffix in the strategy selector dropdown (`★ = Coming soon` convention).

2. **One-time confirmation modal:** When an operator selects one of the three unsupported strategies for the first time on a given deal, a modal appears explaining that full UI is not built and the platform will render a standard layout. The operator must actively confirm to proceed. This modal does not re-appear on subsequent saves to the same deal (confirmed state is persisted in localStorage per deal per strategy).

3. **Flag cell badge:** When an unsupported strategy is the resolved value for a deal, the FLAG column in the Investment Strategy row shows a `LIMITED` badge (amber-tone), identical in styling to the `NOT SET` badge used for unset fields.

4. **Strategy still saves:** Selecting and confirming an unsupported strategy persists it normally to `deal_assumptions.investment_strategy_lv`. The selection is not blocked. Operators can use these tags for deal categorization even without full UI support.

### As of Task #1243 (this release note)

5. **Release notice banner:** Deals where `investment_strategy_lv` is null (no strategy ever set) show a teal dismissible banner at the top of the DEAL TERMS tab. The banner explains:
   - The strategy selector is now functional
   - Fully supported strategies: Rental, Value-Add, Build-to-Sell, Redevelopment
   - Limited support strategies: Short-Term Rental, Flip, Land Hold
   - Operators should open each active deal and confirm or set the strategy

   The banner is dismissed per-deal via a DISMISS button. Dismiss state is stored in localStorage (`jedi:strategy_release_notice_dismissed:<dealId>`). Once the strategy is set, `resolved` becomes non-null and the banner auto-hides regardless of dismiss state.

---

## What full support would require

### Short-Term Rental (str_shortterm template)

**New revenue section** (no existing row handles these):
- ADR (Average Daily Rate) input — per night, not per unit per month
- Occupancy rate input — expressed as percentage of available nights
- RevPAR (Revenue Per Available Room) = ADR × occupancy — computed display row
- Cleaning fees — per-stay fee, separate from management
- Platform fees — OTA commission (Airbnb/VRBO %) deducted from gross revenue
- Effective Gross Income = (ADR × occupancy × 365) − platform fees − concessions

**New basis field:** Furnishing budget (capital cost at acquisition, not ongoing OPEX)

**New OPEX line:** Cleaning payroll (if self-managed STR)

**Return metrics:** RevPAR as a display KPI; standard IRR/EM/CoC remain but are less meaningful than RevPAR for STR operators

**StabilizedPotentialView:** Does not handle `str_shortterm` model type — needs extension

**Horizon:** 60 months, monthly periodicity per the proforma blueprint

---

### Flip (flip template)

**New carry section** (completely absent today):
- Holding period input in months (not years)
- Monthly holding cost rows: property tax, insurance, utilities, debt service during hold
- Total carry cost = sum over hold period

**Exit change:** Today's exit is Exit Cap Rate × stabilized NOI. Flip exit is `exitPrice` (resale dollar amount, operator-entered or appraised). No cap rate is involved.

**Return metrics to add:** profitMargin (= exitPrice − totalBasis − carry costs), monthsHeld display

**Return metrics to remove or suppress:** Cash-on-Cash yield (not meaningful for a flip), DSCR (hold period debt is carry cost, not amortizing)

**Template horizon:** 18 months, monthly periodicity

**Deal type routing:** Flip currently maps to `value_add` deal_type for Pattern B routing. This is an approximation — the renovation logic is correct but the exit math is wrong.

---

### Land Hold (land_hold template)

**Income section must be removed entirely.** The current layout renders GPR, vacancy loss, concessions, bad debt, other income, and EGI. None of these apply to a land hold. Showing them is misleading.

**New carry section:**
- Annual property tax (land assessment based)
- Annual insurance
- Annual maintenance / security
- Debt service (if land is financed)
- Total annual carry cost

**Basis:** Land cost only — no building value, no renovation budget

**Exit:** Land sale price (dollar amount, not cap-rate-based)

**Return metrics:** Levered IRR and profit margin only. Cash-on-Cash, equity multiple, DSCR do not apply.

**Pattern B routing:** `land_hold` has no `DealTypeKey` equivalent. It would need a new value added to the `DealTypeKey` enum and all routing matrices.

---

## Deferred work classification

| Item | Complexity | Blocker? |
|---|---|---|
| STR revenue section UI | High — entirely new component | No — parallel to other work |
| Flip carry section UI | Medium — new section, reuses some OPEX pattern | No |
| Land hold — remove income rows | Medium — conditional rendering gate | No |
| Land hold carry section UI | Medium | No |
| DealTypeKey extension for land_hold | Medium — touches 8+ frontend consumers | Prerequisite for Land Hold routing |
| StabilizedPotentialView — STR model type | Medium | No |
| Template-driven rendering (ProFormaSummaryTab reads templateId) | High — architectural change | Prerequisite for correct per-strategy layout |

---

## Related documents

- `docs/operations/STRATEGY_AND_BEFORE_AFTER_INVESTIGATION.md` — §Finding 3 (templates don't drive UI; missing UI for str/flip/land_hold)
- `docs/operations/STRATEGY_CANONICAL_DECISION.md` — investmentStrategy ↔ deal_type canonical field analysis
- `backend/src/services/proforma/blueprint/proforma-blueprint.ts` — seven ProFormaTemplateId definitions including str_shortterm, flip, land_hold
