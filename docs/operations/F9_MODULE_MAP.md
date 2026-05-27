# F9 Financial Engine — Module Map

> Canonical reference for the F9 tab structure, per-field inventory, property-type coverage,
> strategy template dispatch, source priority, and KPI classification.
> All facts verified from source on 2026-05-26.
>
> **Primary source files:** `FinancialEnginePage.tsx`, `AssumptionsTab.tsx`, `DealTermsTab.tsx`,
> `LeasingAssumptionsTab.tsx`, `RenovationAssumptionsSection.tsx`, `CustomTabRenderer.tsx`,
> `leasing-fields.config.ts`, `proforma-blueprint.ts`, `proforma-seeder.service.ts`
> (at `backend/src/services/`), `layered-growth/rent-growth.ts`,
> `layered-growth/position-adjustment.ts`, `agent-fill-in.ts`.

---

## Section 1 — Executive Summary

F9 is JEDI RE's 9–10 tab Bloomberg-style proforma engine. It is **structurally multifamily-shaped**:
`ModelAssumptions` carries `totalUnits` and `netRentableSF` but no `propertyType` discriminator.
Property-type awareness lives in (a) the `assetClass` string passed to the layered-growth module
(rent-growth anchor spreads, position-adjustment half-lives) and (b) the 7 strategy templates
(STR, Flip, etc.). Commercial asset classes (office, retail, industrial) can be modelled using
`tiPerSF` / `lcPctOfRent` fields, but F9 has no NNN lease structure, no WALT, and no
tenant-by-tenant rent roll.

The engine follows a **two-layer model** (CLAUDE.md P7):

- **Layer 1 (L1)** — LLM reasons about `LayeredValue<T>` assumptions (GPR, vacancy, OPEX, exit
  cap, hold period). Sources: broker → platform → agent fill-in → user override.
- **Layer 2 (L2)** — Deterministic functions (`runModel`, `buildProjections`) compute every KPI:
  NOI, EGI, IRR, EM, CoC, DSCR, exit value, waterfall distributions.

The LLM never produces a KPI number directly; it populates or gap-fills L1 inputs.

---

## Section 2 — Structural Outline

### 2.1 Entry Point

`frontend/src/pages/development/FinancialEnginePage.tsx`

Responsibilities: `dealType` resolution, LP/lender role default-tab, Opus panel, BUILD MODEL
button, auto-build-on-mount guard (`modelBuiltRef`), stale-model badge, leasing cost treatment
event subscriber, custom-tab append logic.

### 2.2 Top-Level Tab Inventory

Defined in `BUILTIN_TAB_LABELS`. `effectiveBuiltinCount = 10` when ROADMAP eligible, `9` otherwise.
Custom tabs start at index `effectiveBuiltinCount`.

| Index | Label | Icon | Component | Type | Gate |
|------:|-------|------|-----------|------|------|
| 0 | OVERVIEW | ⊞ | `OverviewTab` | Leaf | always |
| 1 | CONSOLE | ⊕ | `ConsoleHubTab` | Hub | always |
| 2 | PRO FORMA | ≡ | `ProFormaSummaryTab` | Leaf | always |
| 3 | PROJECTIONS | ⋮≡ | `ProjectionsHubTab` | Hub | always |
| 4 | CAPITAL | ◈ | `CapitalHubTab` | Hub | always |
| 5 | RETURNS | % | `ReturnsHubTab` | Hub | always |
| 6 | SCENARIOS | ◐ | `DecisionTab` | Leaf | always |
| 7 | COMPARE | ⇔ | `CompareHubTab` | Hub | always |
| 8 | GOAL SEEK | ⊙ | `SensitivityTab` | Leaf | always |
| 9 | ROADMAP | ⊛ | `RoadmapTab` | Leaf | `value-add\|rehab\|renovation\|redevelopment` |
| 10+ | ✦ Custom | — | `CustomTabRenderer` | Dynamic | user-created via Opus |

**LP / Lender role:** defaults to tab index 5 (RETURNS) on first load.

**ROADMAP gate** — function `isRoadmapEligibleDealType`:
```ts
if (dt === 'redevelopment') return true;
return /value.?add|rehab|renovation/i.test(dt);
```

### 2.3 Hub-Tab Sub-Tab Map

#### CONSOLE (index 1) — `ConsoleHubTab`
Amber active indicator. Deep-link: `fe-console-subtab` (`{ subTab }`) dispatched by
`DealJourneyOverlay`.

| Sub-Tab ID | Label | Component |
|------------|-------|-----------|
| `stance` | STANCE | `StanceTab` |
| `deal-terms` | DEAL TERMS | `DealTermsTab` |
| `inputs` | INPUTS | `AssumptionsTab` (+ `LeasingAssumptionsTab`, `RenovationAssumptionsSection`) |
| `unitmix` | UNIT MIX | `UnitMixTab` |
| `tax` | TAX | `TaxesTab` |

#### PROJECTIONS (index 3) — `ProjectionsHubTab`
Cyan active indicator. Auto-seeds LVE state when `f9Financials` reference changes.

| Sub-Tab ID | Label | Component |
|------------|-------|-----------|
| `projections` | PROJECTIONS | `ProjectionsTab` |
| `lease-velocity` | LEASE VELOCITY | `LeaseVelocitySection` |

#### CAPITAL (index 4) — `CapitalHubTab`
Cyan active indicator.

| Sub-Tab ID | Label | Component |
|------------|-------|-----------|
| `su` | SRC & USES | `SourcesUsesTab` |
| `debt` | DEBT | `DebtTab` (M11 — 4 sub-tabs: Advisor / Configure / Sensitivity / Exit) |
| `waterfall` | WATERFALL | `WaterfallTab` |
| `costsheet` | COST SHEET | `CostSheetTab` |

#### RETURNS (index 5) — `ReturnsHubTab`
Amber active indicator.

| Sub-Tab ID | Label | Component |
|------------|-------|-----------|
| `returns` | RETURNS | `ReturnsTab` |
| `sensitivity` | SENSITIVITY | `SensitivityTab` |

Note: `SensitivityTab` is also mounted standalone at GOAL SEEK (index 8) where `GoalSeekWidget`
is wired to `/api/v2/sigma/broader-goal-seek`.

#### COMPARE (index 7) — `CompareHubTab`
Financial-green active indicator.

| Sub-Tab ID | Label | Component |
|------------|-------|-----------|
| `compare` | `CompareTab` | |
| `walkthrough` | `UnderwritingWalkthrough` | |

### 2.4 AssumptionsTab (INPUTS sub-tab) — 10-Section Layout

Sections 1–4 rendered as **KeystonePanel** (compact cards above the grid).
Sections 5–10 are the main scrollable grid. Section 9 is a pointer to Debt Tab.

```
Section 1  KEYSTONE           — summary strip: totalUnits, purchasePrice, hold, IRR, EM
Section 2  DEAL INFO          — address, city, dealType
Section 3  ACQUISITION        — purchasePrice, closing costs, going-in / stabilized caps
Section 4  UNIT MIX & RENT ROLL — unitCount, avgRent, weightedOccupancy from rent roll
Section 5  REVENUE            — GPR through EGI + M07 Traffic Intel sub-section
Section 6  OPERATING EXPENSES — payroll through NOI
Section 7  CAPEX & RESERVES   — capex budget, annual draw, reserves, TI, LC
Section 8  DISPOSITION & HOLD — hold period, exit cap, selling costs, gross/net sale
Section 9  FINANCING          — redirect pointer to Debt Tab (M11)
Section 10 FORWARD GROWTH RATES — per-line annual growth % + CPI anchor + concession burn-off
```

---

## Section 3 — Property Type Coverage Matrix

`DealType = 'existing' | 'development' | 'redevelopment'` is the **deal-state** dimension.
`assetClass` (free-form string) is the **property-type** dimension. These are separate axes.
`ModelAssumptions` has no `propertyType` enum field.

| Property Type | Coverage | What Works | What Is Missing |
|---------------|:--------:|------------|-----------------|
| **Multifamily** | Supported | Per-unit economics; M07 traffic engine; LEASING Cat A–J; LVE; renovation tiers; state-adjusted OpEx norms; FIELD_PRIORITIES calibrated for apartments | Nothing — native asset class |
| **SFR / BTR** | Partial | Per-unit model maps cleanly; STR template covers furnished SFR; state OpEx adjustments apply | No HOA cost line; no SFR vacancy model (single-unit turnover vs. portfolio); no SFR property-management rate benchmark |
| **Office** | Partial | `tiPerSF` and `lcPctOfRent` fields present; `ASSET_CLASS_SPREAD_BPS.office = 0`; position half-life 3.5 yr / 8.0 yr | No NNN lease structure; no WALT; no tenant-by-tenant roll; vacancy model assumes % of GPR not lease-expiry schedule |
| **Retail** | Partial | Same field set as Office; `ASSET_CLASS_SPREAD_BPS.retail = 50 bps` | No percentage-rent (overage) clause; no anchor-tenant risk; no co-tenancy modeling |
| **Industrial** | Partial | `ASSET_CLASS_SPREAD_BPS.industrial = 80 bps`; per-SF model applies | No NNN structure; no dock-door / clear-height premium fields; no industrial lease-expiry schedule |
| **Hospitality (STR)** | Partial | Dedicated STR template: ADR, 12-factor seasonal occupancy, RevPAR, OTA fees; `ASSET_CLASS_SPREAD_BPS.str = 100 bps`; half-life 3.0 yr / 4.0 yr | Long-stay hotel not modeled; franchise/flag management fee not modeled |
| **Mixed-Use** | Not at all | Can approximate each component separately | No multi-asset-class NOI stacking; no blended cap rate model; structural results will be misleading |

**Granularity note:** F9 defaults to **per-unit** granularity. `netRentableSF` is in
`ModelAssumptions` for per-SF override, but no auto-switch occurs based on `assetClass`.
Commercial assets require the operator to manually scale costs to a per-unit basis.

---

## Section 4 — Field Inventory

**Layer column key:**
- `L1` — LLM-reasoned `LayeredValue<T>` input (broker / platform / user / agent slots)
- `L2` — Deterministic computation (read-only in UI; produced by `runModel` / `buildProjections`)
- `L1→L2` — LayeredValue input whose resolved value feeds directly into the deterministic runner

### 4.1 OVERVIEW tab (OverviewTab)

Read-only dashboard; no direct user inputs. All values are derived from the last model build.

| Panel | Key Outputs | Layer |
|-------|-------------|-------|
| KPI Strip | IRR, Equity Multiple, Cash-on-Cash, Y1 NOI, DSCR | L2 |
| Sources & Uses summary | Capital Sources, Capital Uses, LTV at Close | L2 |
| Returns Breakdown | Deal-level, LP Returns, GP Returns (IRR, EM, Distributions, Promote) | L2 |
| Returns by Year table | NOI, Debt Service, Cash Flow, LP/GP Dist, Cumulative EM per year | L2 |
| Disposition Summary | Exit Value, Net Proceeds, Exit Strategy | L2 |
| Unit Economics | GPR/unit/mo, EGI/unit/mo, OpEx/unit/mo, NOI/unit/mo, Price/Unit, Exit Cap | L2 |
| Valuation Metrics | Price/SF, GRM, GIM, Going-in Cap, Price-to-Replacement-Cost | L2 |
| Collision Table | Broker vs Platform vs User override comparison per field | L1+L2 |
| JEDI Score (Insights) | Position sub-score, Mode, Confidence, Stabilization month | L2 |

### 4.2 CONSOLE > DEAL TERMS sub-tab (DealTermsTab)

Section A — ACQUISITION / ENTRY

| field_name | display_name | data_type | units | input_mode | required | layer |
|------------|--------------|-----------|-------|------------|---------|-------|
| `purchasePrice` | Purchase Price | number | $ | override (number) | yes | L1→L2 |
| `closingCostsBrokerFee` | Broker Fee | number | $ | override (number) | no | L1 |
| `closingCostsLegalDD` | Legal / DD | number | $ | override (number) | no | L1 |
| `closingCostsLenderOrig` | Lender Origination | number | $ | override (number) | no | L1 |
| `closingCostsReserves` | Reserves at Close | number | $ | override (number) | no | L1 |
| `closingCostsOther` | Other Closing Costs | number | $ | override (number) | no | L1 |
| `totalClosingCosts` | Total Closing Costs | number | $ | read-only | no | L2 |
| `allInBasis` | All-In Basis | number | $ | read-only | no | L2 |
| `pricePerUnit` | Price / Unit | number | $/unit | read-only | no | L2 |
| `goingInCap` | Going-In Cap Rate | number | % | read-only | no | L2 |
| `stabilizedCap` | Stabilized Cap Rate | number | % | read-only | no | L2 |
| `closeDate` | Close Date | date | YYYY-MM-DD | date-picker | no | L1 |

Section B — HOLD & TARGETS

| field_name | display_name | data_type | units | input_mode | required | layer |
|------------|--------------|-----------|-------|------------|---------|-------|
| `holdYears` | Hold Period | number | years | override + chips [3,5,7,10] | yes | L1→L2 |
| `targetIrr` | Target IRR | number | % | override (pct) | no | L1 |
| `targetEm` | Target Equity Multiple | number | × | override (number) | no | L1 |
| `targetCoc` | Target Cash-on-Cash | number | % | override (pct) | no | L1 |

Section C — STRATEGY (intentionally nullable)

| field_name | display_name | data_type | units | input_mode | required | layer |
|------------|--------------|-----------|-------|------------|---------|-------|
| `investmentStrategy` | Investment Strategy | `LayeredValue<string\|null>` | — | dropdown | **no** | L1 |
| `exitStrategy` | Exit Strategy | `LayeredValue<string\|null>` | — | dropdown | **no** | L1 |

Both fields render a visible `NOT SET` amber badge when both `detected` and `override` are null.
No consumer should default to `"Sale"` or `"Rental"` when null. No backfill is ever performed.

Section D — EXIT / DISPOSITION

| field_name | display_name | data_type | units | input_mode | required | layer |
|------------|--------------|-----------|-------|------------|---------|-------|
| `exitCap` | Exit Cap Rate | number | % | override (pct) | yes | L1→L2 |
| `sellingCostsPct` | Selling Costs % | number | % | override (pct) | no | L1→L2 |
| `exitDate` | Exit Date | date | YYYY-MM-DD | read-only (derived) | no | L2 |

Returns KPI strip (read-only, from last build):

| field_name | display_name | layer |
|------------|--------------|-------|
| `irr` | IRR | L2 |
| `equityMultiple` | Equity Multiple | L2 |
| `dscr` | DSCR (Y1) | L2 |

### 4.3 CONSOLE > INPUTS sub-tab — Sections 5 & 6 (AssumptionsTab Grid)

`patchField` is the camelCase key sent to `PATCH /api/v1/proforma/:dealId/assumptions`.

**Revenue (Section 5):**

| field_name | display_name | units | input_mode | patchField | required | layer |
|------------|--------------|-------|------------|------------|---------|-------|
| `gpr` | Gross Potential Rent | $/yr | override | `gpr` | yes | L1→L2 |
| `loss_to_lease` | Loss-to-Lease | $/yr | override | `lossToLeasePct` | no | L1→L2 |
| `vacancy_loss` | Vacancy & Credit Loss | $/yr | override | `vacancyPct` | yes | L1→L2 |
| `concessions` | Concessions | $/yr | override | `concessionsPct` | no | L1→L2 |
| `bad_debt` | Bad Debt | $/yr | override | `badDebtPct` | no | L1→L2 |
| `non_revenue_units` | Non-Revenue Units | $/yr | override | — | no | L1 |
| `other_income` | Other Income | $/yr | override | `otherIncomePerUnit` | no | L1→L2 |
| `net_rental_income` | Net Rental Income | $/yr | read-only | — | — | L2 |
| `egi` | Effective Gross Income | $/yr | read-only | — | — | L2 |

Section 5 — M07 Traffic Intel sub-section (marked with `M07` badge; mostly read-only):

| field_name | display_name | units | patchField | layer |
|------------|--------------|-------|------------|-------|
| `t01WeeklyTours` | T-01 Walk-Ins / Week | /wk | `t01WeeklyTours` | L1 |
| `t05ClosingRatio` | T-05 Capture Rate % | % | `t05ClosingRatio` | L1 |
| `t06WeeklyLeases` | T-06 Net Leases/Wk | /wk | `t06WeeklyLeases` | L1 |
| `derivedVacancy` | Derived Vacancy % (equilibrium) | % | — | L2 |
| `stabilizedOcc` | Stabilized Occupancy Target | % | — | L2 |
| `leaseUpTo95` | Weeks to 95% Stabilization | weeks | — | L2 |
| `renovationLift` | Renovation Traffic Lift % | % | — | L2 |
| `afterRepairRent` | Target After-Repair Rent | $/unit/mo | — | L2 |
| `leaseUpVelocity` | Lease-Up Velocity | /mo | — | L2 |
| `loss_to_lease_pct` | Loss-to-Lease % | % | — | L2 (mirror of LEASING Cat C) |
| `concessions_pct` | Concession % of Rent | % | — | L2 (mirror of LEASING Cat D) |

**Operating Expenses (Section 6):**

| field_name | display_name | units | input_mode | patchField | required | layer |
|------------|--------------|-------|------------|------------|---------|-------|
| `payroll` | Payroll & Benefits | $/yr | override | `payroll` | yes | L1→L2 |
| `repairs_maintenance` | Repairs & Maintenance | $/yr | override | `repairsMaintenance` | yes | L1→L2 |
| `turnover` | Turnover / Make Ready | $/yr | override | `turnover` | no | L1→L2 |
| `contract_services` | Contract Services | $/yr | override | `contractServices` | no | L1→L2 |
| `landscaping` | Landscaping / Grounds | $/yr | override | `landscaping` | no | L1→L2 |
| `marketing` | Marketing | $/yr | override | `marketing` | no | L1→L2 |
| `utilities` | Utilities | $/yr | override | `utilities` | no | L1→L2 |
| `g_and_a` | G&A / Admin | $/yr | override | `gAndA` | no | L1→L2 |
| `management_fee` | Management Fee $ | $/yr | read-only | — | — | L2 |
| `management_fee_pct` | Management Fee % | % | override | `managementFeePct` | no | L1→L2 |
| `insurance` | Insurance | $/yr | override | `insurance` | yes | L1→L2 |
| `real_estate_tax` | Real Estate Taxes | $/yr | override | `realEstateTax` | yes | L1→L2 |
| `replacement_reserves` | Replacement Reserves | $/yr | override | `replacementReserves` | no | L1→L2 |
| `total_opex` | Total Operating Expenses | $/yr | read-only | — | — | L2 |
| `noi` | Net Operating Income | $/yr | read-only | — | — | L2 |

### 4.4 CONSOLE > INPUTS sub-tab — Sections 7, 8, 10

**CapEx & Reserves (Section 7):**

| field_name | display_name | units | patchField | required | layer |
|------------|--------------|-------|------------|---------|-------|
| `capexPerUnit` | CapEx Budget ($/unit total) | $/unit | `capexPerUnit` | no | L1→L2 |
| `capexYearDraw` | CapEx Annual Draw ($/unit) | $/unit/yr | `capexPerYear` | no | L1→L2 |
| `reserves` | Replacement Reserves ($/unit/yr) | $/unit/yr | `replacementReserves` | no | L1→L2 |
| `tiPerSF` | Tenant Improvements ($/SF) | $/SF | `tiPerSF` | no | L1 |
| `lcPctOfRent` | Leasing Commissions (% of rent) | % | `lcPctOfRent` | no | L1 |

**Disposition & Hold (Section 8):**

| field_name | display_name | units | input_mode | patchField | required | layer |
|------------|--------------|-------|------------|------------|---------|-------|
| `saleYear` | Target Sale Year | years | override | `saleYear` | no | L1→L2 |
| `exitCapRate` | Exit Cap Rate | % | read-only (edit in DEAL TERMS) | `exitCapRate` | yes | L1→L2 |
| `sellingCosts` | Selling Costs % | % | override | — | no | L1→L2 |
| `grossSalePrice` | Gross Sale Price (NOI ÷ ExitCap) | $ | read-only | — | — | L2 |
| `netSaleProceeds` | Net Sale Proceeds | $ | read-only | — | — | L2 |

**Forward Growth Rates (Section 10):**

| field_name | display_name | units | patchField | platform default | required | layer |
|------------|--------------|-------|------------|-----------------|---------|-------|
| `growthRentPct` | Rent Growth % / yr | % | `rentGrowthStabilized` | 3% | yes | L1→L2 |
| `growthAncillaryPct` | Ancillary Income Growth % / yr | % | `growthAncillaryPct` | 3% | no | L1 |
| `growthOpexPct` | OpEx Growth % / yr | % | `growthOpexPct` | 2% | yes | L1→L2 |
| `growthUtilitiesPct` | Utilities Growth % / yr | % | `growthUtilitiesPct` | 2% | no | L1 |
| `growthInsurancePct` | Insurance Growth % / yr | % | `growthInsurancePct` | 3.5% | no | L1 |
| `growthTaxPct` | Property Tax Growth % / yr | % | `growthTaxPct` | 2% | no | L1 |
| `growthReservesPct` | Capital Reserves Growth % / yr | % | `growthReservesPct` | 2% | no | L1 |
| `cpiAssumption` | CPI Anchor % / yr | % | `cpiAssumption` | 2.5% | no | L1 |
| `concessionBurnOffPct` | Concession Burn-Off % / yr | % | `concessionBurnOffPct` | 0% | no | L1 |

### 4.5 CONSOLE > INPUTS — LEASING sub-tab (LeasingAssumptionsTab)

Fields defined in `frontend/src/config/leasing-fields.config.ts § LEASING_CATEGORIES`.
Gated by `LeaseMode` and user experience tier. Stored as `leasingPathOverrides[field.path]`.

**LeaseMode values:** `LEASE_UP_NEW_CONSTRUCTION` | `STABILIZED_MAINTENANCE` |
`OCCUPANCY_RECOVERY` | `VALUE_ADD` | `REDEVELOPMENT`

#### Cat A — Occupancy Targets

| field_id | display_name | type | visible_modes | required | layer |
|----------|--------------|------|---------------|---------|-------|
| `a_stabilized_occ` | Target stabilized occupancy | percent | all | yes | L1→L2 |
| `a_stab_definition` | Stabilization definition | enum | all | no | L1 |
| `a_current_occ` | Current occupancy (override) | percent | RECOVERY, STABILIZED | no | L1 |
| `a_target_basis` | Target: paid vs signed | enum | all | no | L1 |

#### Cat B — Renewal & Turnover

| field_id | display_name | type | visible_modes | layer |
|----------|--------------|------|---------------|-------|
| `b_renewal_rate` | Renewal rate | percent | all except LEASE_UP | L1→L2 |
| `b_turnover_rate` | Turnover rate | percent | all except LEASE_UP (read-only) | L2 |
| `b_days_vacant` | Days vacant (median) | days | all except LEASE_UP | L1 |
| `b_avg_lease_term` | Average lease term | months | all | L1 |
| `b_rent_step_renewal` | Rent step on renewal | percent | all except LEASE_UP | L1 |
| `b_trade_out_new` | Trade-out new | percent | all except LEASE_UP | L1 |

#### Cat C — Rent Growth & Loss-to-Lease

| field_id | display_name | type | visible_modes | layer |
|----------|--------------|------|---------------|-------|
| `c_rent_growth` | Blended rent growth | percent | all | L1→L2 |
| `c_loss_to_lease` | Loss-to-lease % (Y1) | percent | STABILIZED, RECOVERY | L1→L2 |
| `c_ltl_decay` | LTL decay rate | percent | STABILIZED, RECOVERY | L1 |
| `c_affordable_growth` | Affordable unit rent growth | percent | all | L1 |

#### Cat D — Concessions

| field_id | display_name | type | visible_modes | layer |
|----------|--------------|------|---------------|-------|
| `d_concession_strategy` | Concession strategy | enum | all | L1 |
| `d_new_lease_onetime` | New lease one-time | $ | all | L1→L2 |
| `d_renewal_onetime` | Renewal one-time | $ | STABILIZED, RECOVERY | L1 |
| `d_new_ongoing` | New lease monthly abatement | $ | LEASE_UP, RECOVERY | L1→L2 |
| `d_renewal_ongoing` | Renewal monthly abatement | $ | RECOVERY | L1 |
| `d_pct_new_receiving` | % of new leases w/ concession | percent | all | L1 |
| `d_pct_renewals_receiving` | % of renewals w/ concession | percent | STABILIZED, RECOVERY | L1 |
| `d_amortization_method` | Concession amortization method | enum | all | L1 |

#### Cat E — Lease-Up Strategy (LEASE_UP_NEW_CONSTRUCTION only)

| field_id | display_name | type | layer |
|----------|--------------|------|-------|
| `e_pre_leased` | Pre-leased count (units) | integer | L1 |
| `e_delivery_month` | Delivery month | month | L1→L2 |
| `e_marketing_intensity` | Marketing intensity | enum | L1 |
| `e_pre_lease_window` | Pre-lease window (months) | months | L1 |
| `e_move_in_lag` | Sign-to-move-in lag (days) | days | L1 |
| `e_stab_target_override` | Stabilization target month override | integer | L1 |
| `e_absorption_type` | Absorption curve type | enum | L1→L2 |

#### Cat F — Recovery Strategy (OCCUPANCY_RECOVERY only)

| field_id | display_name | type | layer |
|----------|--------------|------|-------|
| `f_catchup_period` | Catch-up period (months) | months | L1 |
| `f_locator_usage` | Locator / broker usage % | percent | L1 |

#### Cat G — Marketing & Costs

| field_id | display_name | type | visible_modes | layer |
|----------|--------------|------|---------------|-------|
| `g_marketing_per_lease` | Marketing cost per lease | $ | all | L1 |
| `g_marketing_base` | Marketing base cost | $ | all | L1 |
| `g_locator_fee` | Locator fee (% of rent) | percent | all | L1 |
| `g_locator_pct` | Locator usage % | percent | all | L1 |
| `g_turn_cost` | Make-ready / turn cost | $ | STABILIZED, RECOVERY | L1 |

#### Cat H — Funnel Conversion

| field_id | display_name | type | layer |
|----------|--------------|------|-------|
| `h_prospect_to_tour` | Prospect → tour rate | percent | L1 |
| `h_tour_to_app` | Tour → application rate | percent | L1 |
| `h_app_to_approval` | Application → approval rate | percent | L1 |
| `h_approval_to_lease` | Approval → signed lease rate | percent | L1 |
| `h_overall_conversion` | Overall funnel conversion | percent (read-only) | L2 |

#### Cat I — Bad Debt & Other Income

| field_id | display_name | type | layer |
|----------|--------------|------|-------|
| `i_bad_debt` | Bad debt % of GPR | percent | L1→L2 |
| `i_other_income_per_unit` | Other Income ($/unit/mo) | $ | L1→L2 |
| `i_other_income_growth` | Other income growth % | percent | L1 |

#### Cat J — Renovation Assumptions (VALUE_ADD, REDEVELOPMENT only)

| field_id | display_name | type | layer |
|----------|--------------|------|-------|
| `j_reno_lift_pct` | Rent lift after renovation | percent | L1→L2 |
| `j_after_repair_rent` | After-repair rent target | $/unit/mo | L1→L2 |
| `j_reno_budget_per_unit` | Renovation budget / unit | $ | L1→L2 |
| `j_reno_timeline_months` | Renovation timeline | months | L1 |
| `j_reno_pct_of_units` | Fraction of units to renovate | percent | L1→L2 |
| `j_reno_batches_per_year` | Renovation batches per year | integer | L1 |
| `j_reno_absorption_lag` | Post-renovation absorption lag | days | L1 |

### 4.6 CONSOLE > INPUTS — Renovation section (RenovationAssumptionsSection)

Shown when `dealType !== 'existing'`. Source: `RenovationAssumptionsSection.tsx`.

| field_name | display_name | input_mode | gate | layer |
|------------|--------------|------------|------|-------|
| `selectedTier` | Renovation Scope | tier-picker buttons | value-add / redevelopment | L1→L2 |
| `renovationUnits` | Units Renovated | display-only | all non-existing | L2 |
| `rehabCostPerUnit` | Rehab Cost / Unit | display-only | all non-existing | L2 |
| `premiumRamp[yr]` | Year-N Rent Premium % | read-only bar chart | all non-existing | L2 |
| `capexItems` table | CapEx line items (category / budgeted / actual / remaining) | display-only grid | all non-existing | L2 |

For `development` dealType: Land / Hard Cost / Soft Cost / Contingency table (display-only).

### 4.7 PRO FORMA tab (ProFormaSummaryTab)

Sections/panels:

| Panel | User Inputs | Key Outputs | Layer |
|-------|-------------|-------------|-------|
| Summary Bar | Active Y1 Source toggle (Broker / T12 / T6 / T3 / T1 / Rent Roll) | Conflict count, tier badges | L1 |
| Integrity Check banners | — | INV-* hard invariant alerts | L2 |
| Operating Statement | Cell overrides (pencil icon), cost treatment toggle (Capitalized vs. Expensed) | Year-1 P&L: GPR → EGI → OpEx → NOI; Divergence ratios; Evidence tiers (T1–T4) | L1+L2 |
| Ancillary Income Breakdown | Ancillary line-item overrides | Parking / RUBS / Pet / Storage / Other per-category resolved values | L1 |
| Regime Expand | — | Pre-renovation / post-stabilization sub-rows (Pattern B) — null when Cashflow Agent not run | L2 |
| FloorPlanGrid | GPR per floor plan / unit type edits | GPR disaggregated by bed/bath/SF type; `gpr_grid.positioning_changed` event on edit | L1→L2 |

All ProFormaSummaryTab values are Year-1 only (static snapshot of the seeded proforma).

### 4.8 PROJECTIONS tab (ProjectionsTab)

| Panel | User Inputs | Key Outputs | Layer |
|-------|-------------|-------------|-------|
| GPR Decomposition | — | Source waterfall: Resolved / Platform / Broker / T12 / Rent Roll | L1 |
| Integrity Banner | — | Projection-specific data warnings | L2 |
| AI Findings (M07) | — | Market insights, posture calibration | L1 |
| Projections Table | Timeline selector (3/5/7/10 yr), View Mode (Annual/Quarterly/Monthly), Year 2+ cell overrides, formula drilldown | Revenue / Expenses / NOI / Debt Service / Cash Flow / After-Tax / Disposition rows per year | L1+L2 |
| Metrics Strip (bottom) | — | OCC, DSCR, DY, CoC, EM, Cap Rate, NOI Margin, OER, Rent Growth per year | L2 |

### 4.9 CAPITAL > SRC & USES sub-tab (SourcesUsesTab)

| Panel | User Inputs | Key Outputs | Layer |
|-------|-------------|-------------|-------|
| KPI Strip | — | Total Sources, Total Uses, LTV at Close, Equity Required, Cost/Unit | L2 |
| Sources of Funds | Senior Debt, Mezz, LP/GP Equity, Seller Financing line edits | Balance status (Balanced / Imbalance) | L1→L2 |
| Uses of Funds | Closing Costs, CapEx, Working Capital, Pre-opening, Lease-up Reserve line edits | Effective Total Uses, LTC/LTV | L1→L2 |
| Benchmark Peer Thresholds | — | Peer ranges for closing costs %, debt %, cost per unit | L2 |

### 4.10 CAPITAL > DEBT sub-tab (DebtTab / M11)

M11 is a four-sub-tab module: Advisor / Configure / Sensitivity / Exit.

| Panel | User Inputs | Key Outputs | Layer |
|-------|-------------|-------------|-------|
| KPI Strip | — | Total Debt, Weighted Rate, Y1 DSCR, Y1 Debt Yield, Max LTV | L2 |
| Debt Advisor | — | AI-driven financing suggestions | L1 |
| Loan Stack | Loan Preset selector (Bridge/Agency/HUD/etc.), Rate Type (Fixed/Floating), Loan Amount, Rate, Spread, Term, Amortization, IO period, Fees, Min DSCR/DY/Occ covenants | Amortization schedule; covenant breach alerts | L1→L2 |
| Sensitivity (4-sub-tab) | — | Rate × LTV heat map; DSCR / DY stress scenarios | L2 |
| Exit analysis | — | Refi trigger analysis; exit-year payoff | L2 |

### 4.11 CAPITAL > WATERFALL sub-tab (WaterfallTab)

| Panel | User Inputs | Key Outputs | Layer |
|-------|-------------|-------------|-------|
| KPI Strip | — | LP IRR, LP EM, GP EM, Promote Earned | L2 |
| Capital Stack / Tranches | Waterfall Type (American vs. European), Pref Rate, LP/GP equity %, tier configurations | Tranche definitions | L1 |
| Waterfall Tiers | Tier IRR hurdles, splits, catch-up %, promote % | ROC → Pref → Catch-up → Promote distribution schedule | L1→L2 |
| Fee Structure | Acquisition fee %, Asset management fee %, Disposition fee % | Fee dollar amounts per year | L1→L2 |
| Distribution Schedule | — | Year-by-year LP/GP cash flows and crystallization at exit | L2 |

### 4.12 RETURNS tab (ReturnsTab)

| Panel | User Inputs | Key Outputs | Layer |
|-------|-------------|-------------|-------|
| Hero Tiles | Target IRR / EM / CoC hurdle inputs | LP IRR, LP EM, Pref Rate with hurdle pass/miss status | L1+L2 |
| LP Focus Panel | — | Pref return by year, cumulative distributions, NOI haircut downside analysis | L2 |
| Lender Focus Panel | — | DSCR by year, LTV trend, exit-cap stress scenarios | L2 |
| Sensitivity Sparklines | — | Visual trends for key return metrics | L2 |

### 4.13 SCENARIOS tab (DecisionTab)

| Panel | User Inputs | Key Outputs | Layer |
|-------|-------------|-------------|-------|
| Deal Verdict | — | AI-generated summary (Favorable / Caution / etc.) | L1 |
| Risk Flags | — | High / Medium / Low risk flags from integrity checks and benchmark divergences | L2 |
| Recommended Actions | — | Prioritized next steps | L1 |
| Deal Notes | Concession drilldown modal trigger | Benchmark position flags (GPR/NOI/EGI above/below submarket), leverage risk indicators | L2 |

### 4.14 GOAL SEEK tab (SensitivityTab standalone)

| Panel | User Inputs | Key Outputs | Layer |
|-------|-------------|-------------|-------|
| Two-Way Heat Maps | Table type selection (IRR × Exit Cap/Rent Growth, EM × Exit Cap/Hold, OpEx × Exit Cap/OpEx Growth) | Sensitivity grids with conditional formatting | L2 (currently LLM-generated — see §7.1) |
| Goal Seek Widget | Target Metric, Target Value, Solve For variable | Backwards-solved variable value via `/api/v2/sigma/broader-goal-seek` | L1+L2 |

### 4.15 ROADMAP tab (RoadmapTab)

Gate: `isRoadmapEligibleDealType` (value-add / rehab / renovation / redevelopment only).

| Panel | User Inputs | Key Outputs | Layer |
|-------|-------------|-------------|-------|
| Achievability Banner | — | Target IRR vs. Baseline vs. Roadmap IRR comparison | L2 |
| Yearly Trajectory | — | Stacked bar: NOI lift per year, posture (Offense / Defense) | L2 |
| Action Table | "Build Roadmap" modal (Target Metric, Hold Years, Comp selection) | Roadmap actions: Timing / Impact / Cost / Confidence | L1+L2 |
| Evidence Side Panel | — | Archive success rates, market signal support for selected actions | L1 |
| Comp Comparison | — | Attribution and replicability vs. reference properties; gap analysis by bucket | L2 |

### 4.16 Custom Tabs (CustomTabRenderer)

Custom tabs are created exclusively via Opus chat (no UI button). Opus emits a `customtab` fenced
JSON block; the backend validates it against the `CustomTabPayload` schema and persists it.
Source: `CustomTabRenderer.tsx`, `custom-tab-schema.ts`, `PROFORMA_TAB_EXTENSIBILITY.md`.

**Block types (5):**

| Block type | What it renders |
|------------|-----------------|
| `markdown` | Text with `{{dot.path}}` value placeholders |
| `kpi_tile` | Single large KPI with optional comparison delta |
| `table` | Tabular view (up to 12 columns, 60 rows) |
| `ratio_bar` | Horizontal bar with numerator/denominator + benchmark marker |
| `line_chart` | SVG polyline chart with primary + optional comparison series |

**Field-reference catalog (22 allowed patterns across 5 surfaces):**

| Prefix | References |
|--------|-----------|
| `assumptions.*` | purchasePrice, exitCapRate, holdPeriod, ltv, interestRate, loanType, revenue.rentGrowth, revenue.vacancy, opex.expenseGrowth, units |
| `results.summary.*` | irr, equityMultiple, cashOnCash, noi, dscr |
| `f9.proforma.year1[*].*` | Per P&L line (broker/platform/t12/rentRoll/resolved/perUnit/benchmarkPosition) for 9 fields |
| `projections[*].*` | year, noi, revenue |
| `deal.*` | name, address, city, units |

Any reference outside the catalog is hard-rejected; the validator returns a Levenshtein
"did you mean?" suggestion.

---

## Section 5 — Strategy Variation Within Property Type

### 5.1 Template Dispatch

`M08 → F9` emits a `ProFormaTemplateId`. Source: `proforma-blueprint.ts § PROFORMA_TEMPLATES`.

| Template ID | Strategy Triggers | Hold | Periodicity | Special Tuning |
|-------------|------------------|:----:|:-----------:|----------------|
| `acquisition_stabilized` | rental, core, core_plus | 60 mo | annual | — |
| `acquisition_value_add` | value_add, rental_value_add | 84 mo | annual | Renovation section enabled |
| `development_ground_up` | bts, bts_for_rent, development, ground_up | 120 mo | monthly | `growthTruncationYear: 3` |
| `redevelopment` | redevelopment, reposition, gut_rehab | 96 mo | monthly | Renovation section enabled |
| `flip` | flip | 18 mo | monthly | `growthTruncationYear: 1` |
| `str_shortterm` | str, short_term_rental | 60 mo | monthly | 12-factor seasonal occupancy; spread = 100 bps |
| `land_hold` | land, land_hold | 60 mo | annual | Holding costs only; no revenue model |

### 5.2 Tab / Section Visibility per Template

| Feature | stabilized | value_add | ground_up | redevelopment | flip | str | land |
|---------|:----------:|:---------:|:---------:|:-------------:|:----:|:---:|:----:|
| ROADMAP tab | — | ✓ | — | ✓ | — | — | — |
| LEASING Cat J (Renovation) | — | ✓ | — | ✓ | — | — | — |
| Renovation Assumptions section | — | ✓ | ✓ | ✓ | ✓ | — | — |
| CAPITAL > COST SHEET | — | ✓ | ✓ | ✓ | ✓ | — | — |
| CapEx / Draw (Sec 7) | — | ✓ | ✓ | ✓ | ✓ | — | — |
| LEASING Cat E (Lease-Up) | — | — | ✓ | ✓ | — | — | — |
| STR seasonal occupancy | — | — | — | — | — | ✓ | — |
| Growth truncation Y3 | — | — | ✓ | — | — | — | — |
| Growth truncation Y1 | — | — | — | — | ✓ | — | — |

### 5.3 STR-Specific Fields (str_shortterm template)

All L1 inputs; surface in `ProFormaSummaryTab` seasonal occupancy panel.

| field | display | type |
|-------|---------|------|
| `adr` | Average Daily Rate | $/night |
| `occupancyRate[1..12]` | Monthly occupancy % | % × 12 |
| `revPar` | RevPAR | $ (derived, L2) |
| `cleaningFees` | Cleaning fees per stay | $ |
| `platformFees` | OTA platform fee % | % |
| `effectiveGrossIncome` | Effective Gross Income | $ (derived, L2) |

### 5.4 Growth Truncation Mechanics

`growthTruncationYear` in `STRATEGY_TEMPLATE_TUNING` zero-floors rent and OPEX growth for all
years strictly beyond the truncation year:
- **`development_ground_up` (Y3):** BTS deals exit at stabilization (~Y3); perpetual compounding overstates terminal NOI.
- **`flip` (Y1):** 12–18 month holds; Y2+ growth is a modelling artefact.

---

## Section 6 — Source Priority by Asset State

Source resolution follows the `LayeredValue` waterfall: user override → agent fill-in → T12 →
rent roll → platform → broker. Source: `backend/src/services/proforma-seeder.service.ts`.

### 6.1 FIELD_PRIORITIES (canonical per-field source order)

Defined at `proforma-seeder.service.ts` line 297. Exported as `FIELD_PRIORITIES`.

| Field | Priority Order | Notes |
|-------|---------------|-------|
| `gpr` | t12 → rent_roll | T12 annual figure is authoritative |
| `vacancy_pct` | rent_roll → t12 | Rent roll shows actual leased vs. available |
| `concessions_pct` | t12 → rent_roll | T12 amortizes concessions over period |
| `other_income` | rent_roll → t12 → om | Rent roll itemizes ancillary; T12 is fallback |
| `real_estate_tax` | tax_bill → t12 | Tax bill is ground truth; T12 may lag reassessment |
| `insurance` | t12 | Only T12 has granular insurance line |
| `management_fee` | t12 | Same |

`SKIP_ZERO_FIELDS` prevents the seeder from accepting a `$0` GPR from the rent roll during early
lease-up (when units are not yet occupied), falling through to the next source automatically.

### 6.2 Asset-State Adjustments

| Asset State | Revenue Source | OPEX Source | Notes |
|-------------|---------------|-------------|-------|
| **Stabilized** | T12 (authoritative) → Rent Roll | T12 → Platform benchmark | Trailing actuals dominate |
| **Lease-Up** | SKIP_ZERO_FIELDS: Rent Roll $0 skipped → Platform (M07) → Broker | Platform benchmark (no T12 actuals) | M07 LVE is primary revenue model |
| **New Construction** | Platform (M07 rent projection) → Broker OM | Platform benchmark | No T12 or Rent Roll at construction close |
| **Repositioning / Value-Add** | T12 (pre-reno in-place) + Renovation lift from M07 | T12 (current) + CapEx schedule | Two NOI views: current and stabilized (post-reno) |
| **Distressed** | Rent Roll → T12 (may be unreliable) → Platform | Platform + manual operator review | Confidence bands widen; operator expected to override |

### 6.3 State-Adjusted OpEx Benchmarks

`BASE_OPEX_NORMS_PER_UNIT` is Class-B multifamily calibration. `STATE_ADJUSTMENTS` at
`proforma-seeder.service.ts` line 98 applies per-state multipliers:

| State | Insurance | Payroll | Utilities | Other adjustments |
|-------|:---------:|:-------:|:---------:|-------------------|
| FL | ×1.50 | ×1.0 | ×1.10 | — |
| TX | ×1.20 | ×1.0 | ×1.05 | — |
| CA | ×1.35 | ×1.45 | ×1.15 | — |
| NY | ×1.40 | ×1.50 | ×1.20 | — |
| NJ | ×1.30 | ×1.35 | ×1.0 | — |
| CO | ×1.10 | ×1.0 | ×1.0 | — |
| AZ | ×1.0 | ×1.0 | ×1.10 | — |
| All others | ×1.0 | ×1.0 | ×1.0 | Baseline |

### 6.4 Layered-Growth Asset-Class Anchors

Source: `backend/src/services/proforma/layered-growth/rent-growth.ts § ASSET_CLASS_SPREAD_BPS`.
Added to BLS CPI Shelter sub-index to form the long-run anchor component of the 5-component rent
growth model.

| assetClass | Spread above CPI Shelter | Calibration status |
|------------|:------------------------:|-------------------|
| `multifamily` | +30 bps | TBD seed (BLS 2010–2024 observation) |
| `retail` | +50 bps | TBD seed |
| `office` | 0 bps | TBD (post-2020 secular reset) |
| `industrial` | +80 bps | TBD seed |
| `str` | +100 bps | TBD seed |
| `flip` | 0 bps | — |
| `land` | 0 bps | — |
| `default` | +30 bps | Fallback when assetClass unknown |

### 6.5 Position-Adjustment Half-Lives

Source: `backend/src/services/proforma/layered-growth/position-adjustment.ts §
POSITION_HALF_LIFE_DEFAULTS`.

| assetClass | Premium half-life | Discount half-life |
|------------|:-----------------:|:-----------------:|
| `multifamily` | 4.5 yr | 6.0 yr |
| `office` | 3.5 yr | 8.0 yr |
| `str` | 3.0 yr | 4.0 yr |
| (all others) | 4.5 yr (multifamily default) | 6.0 yr |

---

## Section 7 — KPI / Computed Display Inventory

### 7.1 KPI Classification

| KPI | Location | Computation | Layer | Currently LLM? | Move to det.? |
|-----|----------|-------------|-------|---------------|--------------|
| NOI | AssumptionsTab, ProFormaSummaryTab, Projections | EGI − Total OpEx | **L2** | No | Already det. |
| EGI | AssumptionsTab, ProFormaSummaryTab | NRI + Other Income | **L2** | No | Already det. |
| IRR (LP Net) | ReturnsTab, DealTermsTab strip, Overview | `runModel()` DCF | **L2** | No (LLM may also emit; det. wins per P7) | ✓ Fast endpoint |
| Equity Multiple | ReturnsTab, Overview | `runModel()` | **L2** | No | ✓ Fast endpoint |
| Cash-on-Cash | ReturnsTab | `runModel()` | **L2** | No | ✓ Fast endpoint |
| DSCR | DealTermsTab strip, DebtTab, ReturnsTab | `runModel()` | **L2** | No | ✓ Fast endpoint |
| Exit Value | ProFormaSummaryTab, ReturnsTab | forward NOI ÷ exit cap | **L2** | No | ✓ Fast endpoint |
| Net Sale Proceeds | AssumptionsTab Sec 8, ReturnsTab | Gross × (1 − selling costs) | **L2** | No | ✓ Fast endpoint |
| Waterfall distributions | ReturnsTab, Overview | `runModel()` | **L2** | No | ✓ Fast endpoint |
| Sensitivity tables (5×5) | SensitivityTab | **Currently LLM response schema** | **L1 → should be L2** | **Yes** | **Yes — purely formulaic** |
| AI narrative / commentary | CommentaryPanel, AssumptionsTab narrative | LLM (intentional) | L1 | Yes | No — intentional |
| Gap-fill assumptions | Any seeded row with agent fill | LLM via `agentFillIn` | L1 | Yes | No — intentional |
| Deal Verdict (SCENARIOS) | DecisionTab | LLM synthesis | L1 | Yes | No — intentional |
| Roadmap actions | RoadmapTab | LLM + comp attribution | L1 | Yes | No — intentional |

### 7.2 KPI Protectors (Confidence Bands)

Source: `backend/src/services/proforma/validators/confidence-bands.ts`.

| Classification | Badge | UI behavior |
|----------------|-------|-------------|
| `within` | none | Silent |
| `soft_warning` | amber dot bottom-right of cell | Visible, non-blocking |
| `hard_warning` | red dot + rationale prompt | Blocks save until operator provides justification text |

### 7.3 Fast Deterministic Endpoint (Planned)

Steps 7–12 of the build pipeline (irr, NOI, DSCR, CoC, EM, waterfall) are CPU-only pure functions
completing in **<15 ms** at zero LLM cost. Planned path: `POST /api/v1/financial-model/compute-fast`
(skip hash / fill-in / DB write / LLM). Frontend debounces at 800 ms; live KPIs update on every
assumption change. See `docs/operations/PROFORMA_AUTOCOMPUTE_INVESTIGATION.md §6` for full spec.
**Not yet implemented.**

---

## Section 8 — Statistics & Open Gaps

### 8.1 Summary Statistics

| Dimension | Count |
|-----------|------:|
| Built-in tabs | 10 (9 when ROADMAP ineligible) |
| Hub tabs | 5 |
| Leaf tabs (built-in) | 4 + unlimited custom |
| Sub-tabs across all hubs | 13 |
| AssumptionsTab sections | 10 |
| Revenue fields (Sec 5) | 9 OSRow fields + 11 M07 rows |
| OpEx fields (Sec 6) | 15 fields |
| CapEx fields (Sec 7) | 5 fields |
| Disposition fields (Sec 8) | 5 fields |
| Growth rate fields (Sec 10) | 9 fields |
| DealTerms fields | ~23 fields across 4 sections |
| LEASING category fields (A–J) | 44 fields across 10 categories |
| Renovation section fields | 5 fields |
| ProForma templates | 7 |
| LeaseMode values | 5 |
| OperatorStance modulation rules | 15 |
| Asset classes with spread calibration | 7 |
| Custom tab block types | 5 |
| Custom tab field-reference catalog | 22 allowed patterns |

### 8.2 Open Gaps

Gap sweep performed 2026-05-27. Classifications: **BLOCKER** = must resolve before Phase 1 ships;
**PHASE 2** = intentionally deferred; **RESOLVED** = already addressed by existing task or shipped work.

Cross-reference note: The task spec referenced Tasks #1233–#1238 for cross-checking. Those task
IDs do not exist in the current backlog. Cross-referencing was done against the full backlog by
task name; matches are cited below as "task: [filename]" (all in `.local/tasks/`).

| ID | Location | Description | Priority | Classification |
|----|----------|-------------|---------|---------------|
| KPI-fast | `financial-model-engine.service.ts` | Sensitivity tables still LLM-generated; fast deterministic endpoint not yet built | High | **PHASE 2** — LLM version functional; fast endpoint is an optimization. Full spec already in `docs/operations/PROFORMA_AUTOCOMPUTE_INVESTIGATION.md §6`. No existing Phase 1 task covers this; follow-up task #1276 created. |
| Property types | ProFormaSummaryTab | Mixed-use, office NNN, industrial produce structurally incorrect results; no property-type guard rail or warning banner | Medium | **PHASE 2** — str/flip/land_hold UI routing tracked by task: `proforma-template-ui-routing.md`; unsupported-notice tracked by task: `str-flip-land-hold-unsupported-notice.md`. Guard rail for commercial types (office NNN, industrial, mixed-use) is future scope; follow-up task #1277 created. |
| M36 | SensitivityTab OPEX axis | OPEX growth sensitivity grid wired to Section B trajectory drivers — M36 covariance matrix build pending; cells show base IRR with label only | Medium | **PHASE 2** — tracked by task: `sigma-m36-m39-verification-and-wiring.md`; M36 covariance matrix is a dedicated future module, not a Phase 1 dependency. |
| FIELD_PRIORITIES calibration | `proforma-seeder.service.ts` | `assetClass` passed to `agentFillIn` but `LibraryResolver` returns generic `regional_avg_class_b_2024` for all asset classes; no commercial class benchmarks | Medium | **PHASE 2** — multifamily calibration (`regional_avg_class_b_2024`) is correct for the platform's primary asset class; commercial benchmarks are future scope gated on commercial property type support. No existing task; intentionally deferred. |
| Spread calibration | `layered-growth/rent-growth.ts` | All `ASSET_CLASS_SPREAD_BPS` values are seed-only (status: `tbd`); backtest against BLS CPI shelter sub-index per class pending (spec §14) | Medium | **PHASE 2** — seed values (+30 bps multifamily, +50 retail, +80 industrial, +100 STR) are calibrated placeholders; BLS backtest is future calibration work. No existing task; intentionally deferred. |
| M07 confidence bands | ProjectionsHubTab | Confidence bands not surfaced in LVE results panel (Deal Journey M07 pending) | Medium | **PHASE 2** — explicitly listed as PENDING in `replit.md` Deal Journey Framework section. No Phase 1 action required. |
| T#613 | DealTermsTab | `deal:strategy-changed` dispatched directly from DealTermsTab — not reconciled with the `dealStore` event pattern used by `basis.changed` | Low | **PHASE 2** — low-priority tech debt; event fires correctly and all consumers receive it. The inconsistency is documented in `replit.md` Cross-tab Events table. Pattern reconciliation is future cleanup. |
| M35 | DealJourneyOverlay | Event path visualization pending — lever rows deep-link to INPUTS but do not render a causal chain diagram | Low | **PHASE 2** — explicitly listed as PENDING in `replit.md` Deal Journey Framework section; covered by the m35 task chain (tasks: `m35-event-foundation.md`, `m35-viz-wave1-capsule.md`, etc.). |
| M38 | OperatorStance | Calibration loop pending — stance re-blend uses cached snapshot but no automated calibration cycle | Low | **PHASE 2** — explicitly listed as PENDING in `replit.md` Deal Journey Framework section. OperatorStance calibration loop is future work; no Phase 1 consequence. |
| T#797 | ProFormaSummaryTab | `regimeDataByField` Pattern B sub-rows (pre/post-stabilization) null when Cashflow Agent has not run | Medium | **RESOLVED** — fully tracked by task: `regime-expand-data-population.md`. That task defines the write path (cashflow agent output schema changes, `regimeDataByField` population in `proforma-adjustment.service.ts`) and the explicit fallback state ("Run analysis to populate" instead of blank dashes). |
| T#451 | FinancialEnginePage | Custom tab list must refresh after every Opus reply to detect `customtab` fence-created tabs | Low | **PHASE 2** — UX polish for the custom tab system; not blocking core F9 underwriting functionality. No existing task; intentionally deferred. |

### 8.3 Gap Sweep Closing Note (2026-05-27)

**Sweep result: 0 BLOCKERS · 10 PHASE 2 · 1 RESOLVED**

No Phase 1 blockers were found. Key findings:

- **Tasks #1233–#1238** (referenced in the sweep brief as comparators) do not exist in the task
  backlog. Cross-referencing was done against the full backlog by task name instead.

- **T#797 (RESOLVED):** The only gap with direct Phase 1 relevance — `regimeDataByField`
  permanently null — is fully captured by task `regime-expand-data-population.md`. That task
  defines the write path, the agent output schema change, and the fallback state. No new task
  needed.

- **KPI-fast (PHASE 2):** The sensitivity tab LLM path is slow but produces correct output.
  The fast deterministic spec (`docs/operations/PROFORMA_AUTOCOMPUTE_INVESTIGATION.md §6`)
  is complete and ready for Phase 2 pickup. Follow-up task #1276 created.

- **Property types (PHASE 2):** str/flip/land_hold UI routing is tracked by
  `proforma-template-ui-routing.md` and `str-flip-land-hold-unsupported-notice.md`. Guard
  rails for commercial types (mixed-use, office NNN, industrial) are future scope.
  Follow-up task #1277 created for the commercial guard rail.

- **M36, M35, M38 (PHASE 2):** All three are explicitly PENDING in `replit.md` and each has
  a corresponding task chain. No action needed here.

- **Calibration gaps — FIELD_PRIORITIES and Spread calibration (PHASE 2):** Multifamily
  benchmarks are correctly calibrated. Commercial class calibration is future work gated on
  commercial property type support.

- **T#613, T#451 (PHASE 2):** Low-priority tech debt and UX polish; neither affects
  correctness of Phase 1 underwriting output.

---

## Appendix A — Key File Index

| File | Role |
|------|------|
| `frontend/src/pages/development/FinancialEnginePage.tsx` | F9 entry, tab strip, BUILD MODEL, Opus panel, custom-tab append |
| `frontend/src/pages/development/financial-engine/types.ts` | `DealType`, `ModelAssumptions`, `F9DealFinancials`, `LeaseMode` |
| `frontend/src/pages/development/financial-engine/AssumptionsTab.tsx` | INPUTS grid, FIELD_META, 10-section layout, M07 Intel sub-section |
| `frontend/src/pages/development/financial-engine/DealTermsTab.tsx` | DEAL TERMS — acquisition, hold, strategy, exit |
| `frontend/src/pages/development/financial-engine/LeasingAssumptionsTab.tsx` | LEASING categories A–J, LeaseMode gating, tier prefs |
| `frontend/src/pages/development/financial-engine/RenovationAssumptionsSection.tsx` | Renovation tier picker, cost/premium ramp, CapEx items |
| `frontend/src/pages/development/financial-engine/CustomTabRenderer.tsx` | Custom tab block renderer (read-only) |
| `frontend/src/config/leasing-fields.config.ts` | `LEASING_CATEGORIES`, `LeasingFieldDef`, `LeaseMode` enum |
| `backend/src/services/proforma/blueprint/proforma-blueprint.ts` | `FKEY_MAP`, `M09_INPUTS`, `PROFORMA_TEMPLATES`, `STRATEGY_TEMPLATE_TUNING` |
| `backend/src/services/proforma-seeder.service.ts` | `FIELD_PRIORITIES`, `SKIP_ZERO_FIELDS`, `STATE_ADJUSTMENTS`, `BASE_OPEX_NORMS_PER_UNIT` |
| `backend/src/services/proforma/layered-growth/rent-growth.ts` | `ASSET_CLASS_SPREAD_BPS`, 5-component rent growth model |
| `backend/src/services/proforma/layered-growth/position-adjustment.ts` | `POSITION_HALF_LIFE_DEFAULTS`, position modes |
| `backend/src/services/proforma/agent-fill-in.ts` | `agentFillIn`, `DealContext`, `LibraryResolver` |
| `backend/src/services/proforma/validators/confidence-bands.ts` | Protector confidence bands, `evaluateRefusal` |
| `frontend/src/stores/dealStore.ts` | `useDealStore`, `DealContext`, `OperatorStance`, cross-tab event emitters |
| `docs/operations/PROFORMA_AUTOCOMPUTE_INVESTIGATION.md` | Build pipeline analysis, fast-endpoint recommendation |
| `docs/operations/PROFORMA_TAB_EXTENSIBILITY.md` | Custom tab system audit, block schema, field-ref catalog |

---

## Appendix B — Cross-Tab DOM Events

| Event | Detail | Dispatcher | Consumers |
|-------|--------|-----------|-----------|
| `basis.changed` | `{}` | `dealStore.setPurchasePrice` | S&U tab, debt sizing, going-in cap; DealTermsTab |
| `hold_period.changed` | `{ holdYears: number }` | `dealStore.emitHoldPeriodChanged` | Projections, Returns |
| `exit_cap.changed` | `{}` | `dealStore.emitExitCapChanged` | Returns strip, net-sale-proceeds row |
| `deal:strategy-changed` | `{ dealId, field, value }` | DealTermsTab direct (T#613 drift) | Strategy-aware consumers |
| `fe-console-subtab` | `{ subTab: SubTab }` | `DealJourneyOverlay` | ConsoleHubTab (deep-link) |
| `gpr_grid.positioning_changed` | `{}` | FloorPlanGrid (800 ms debounce) | ProjectionsHubTab → re-runs LVE |
| `lease_velocity.output.updated` | `{}` | LVE runner | `FinancialEnginePage` → `fetchF9Financials` |
| `leasing_cost_treatment.changed` | `{}` | AssumptionsTab PATCH | `FinancialEnginePage` → `fetchF9Financials` |

---

## Appendix C — DealType × Tab Visibility Matrix

`DealType = 'existing' | 'development' | 'redevelopment'`

| Tab | existing | development | redevelopment | value-add / rehab / renovation |
|-----|:--------:|:-----------:|:-------------:|:------------------------------:|
| OVERVIEW | ✓ | ✓ | ✓ | ✓ |
| CONSOLE | ✓ | ✓ | ✓ | ✓ |
| PRO FORMA | ✓ | ✓ | ✓ | ✓ |
| PROJECTIONS | ✓ | ✓ | ✓ | ✓ |
| CAPITAL | ✓ | ✓ | ✓ | ✓ |
| RETURNS | ✓ | ✓ | ✓ | ✓ |
| SCENARIOS | ✓ | ✓ | ✓ | ✓ |
| COMPARE | ✓ | ✓ | ✓ | ✓ |
| GOAL SEEK | ✓ | ✓ | ✓ | ✓ |
| ROADMAP | — | — | ✓ | ✓ |
