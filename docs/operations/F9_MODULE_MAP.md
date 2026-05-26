# F9 Financial Engine — Module Map

> Canonical reference for the F9 tab structure, per-field inventory, property-type coverage,
> strategy template dispatch, source priority, and KPI classification.
> All facts verified from source on 2026-05-26.

---

## Section 1 — Executive Summary

F9 is JEDI RE's 9–10 tab Bloomberg-style proforma engine. It is **structurally multifamily-shaped**:
`ModelAssumptions` carries `totalUnits` and `netRentableSF` but no `propertyType` discriminator.
Property-type awareness lives exclusively in the `assetClass` string passed to the layered-growth
module (rent-growth anchor spreads, position-adjustment half-lives) and in the 7 strategy templates
(STR, Flip, etc.). For commercial asset classes (office, retail, industrial), F9 can model them at
the per-SF granularity using the `tiPerSF` / `lcPctOfRent` fields, but has no NNN lease structure,
no tenant-by-tenant rent roll, and no WALT calculation.

The engine follows a **two-layer model** (CLAUDE.md P7):
- **Layer 1** — LLM reasons about `LayeredValue<T>` assumptions (GPR, vacancy, OPEX, exit cap, hold period)
- **Layer 2** — Deterministic functions (`runModel`, `buildProjections`) compute all KPIs: NOI, EGI, IRR, EM, CoC, DSCR, exit value, waterfall distributions

The LLM never produces a KPI number. All KPI rows in the UI are Layer 2 outputs.

---

## Section 2 — Structural Outline

### 2.1 Entry Point

`frontend/src/pages/development/FinancialEnginePage.tsx`

State orchestration: `dealType` resolution, LP/lender role default-tab logic, Opus panel,
BUILD MODEL button, auto-build-on-mount guard (`modelBuiltRef`), stale-model badge,
leasing cost treatment event subscriber.

### 2.2 Top-Level Tab Inventory

Defined in `BUILTIN_TAB_LABELS`. `effectiveBuiltinCount = 10` when ROADMAP eligible, `9` otherwise.
Custom tabs start at index `effectiveBuiltinCount`.

| Index | Label | Icon | Component | Type |
|------:|-------|------|-----------|------|
| 0 | OVERVIEW | ⊞ | `OverviewTab` | Leaf |
| 1 | CONSOLE | ⊕ | `ConsoleHubTab` | Hub |
| 2 | PRO FORMA | ≡ | `ProFormaSummaryTab` | Leaf (3 519 lines) |
| 3 | PROJECTIONS | ⋮≡ | `ProjectionsHubTab` | Hub |
| 4 | CAPITAL | ◈ | `CapitalHubTab` | Hub |
| 5 | RETURNS | % | `ReturnsHubTab` | Hub |
| 6 | SCENARIOS | ◐ | `DecisionTab` | Leaf |
| 7 | COMPARE | ⇔ | `CompareHubTab` | Hub |
| 8 | GOAL SEEK | ⊙ | `SensitivityTab` | Leaf |
| 9 | ROADMAP | ⊛ | `RoadmapTab` | Leaf (gated) |
| 10+ | ✦ Custom | — | `CustomTabRenderer` | Dynamic |

**LP / Lender role:** defaults to tab index 5 (RETURNS) on first load.

**ROADMAP gate** — function `isRoadmapEligibleDealType`:
```ts
if (dt === 'redevelopment') return true;
return /value.?add|rehab|renovation/i.test(dt);
```

### 2.3 Hub-Tab Sub-Tab Map

#### CONSOLE (index 1) — `ConsoleHubTab`
Amber active indicator. Deep-link event: `fe-console-subtab` (`{ subTab }`) dispatched by DealJourneyOverlay.

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
| `compare` | COMPARE | `CompareTab` |
| `walkthrough` | WALKTHROUGH | `UnderwritingWalkthrough` |

### 2.4 AssumptionsTab (INPUTS sub-tab) — 10-Section Layout

Sections 1–4 are rendered as the **KeystonePanel** (compact cards above the main grid).
Sections 5–10 are the main scrollable grid. Section 9 redirects to the Debt Tab.

```
Section 1  KEYSTONE           — summary KPI strip (totalUnits, purchasePrice, hold, IRR, EM)
Section 2  DEAL INFO          — deal metadata (address, city, type)
Section 3  ACQUISITION        — purchase price, closing costs, going-in / stabilized caps
Section 4  UNIT MIX & RENT ROLL — unit count, avg rent, occupancy from rent roll
Section 5  REVENUE            — GPR through EGI + M07 Traffic Intel sub-section
Section 6  OPERATING EXPENSES — payroll through NOI
Section 7  CAPEX & RESERVES   — capex budget, annual draw, reserves, TI, LC
Section 8  DISPOSITION & HOLD — hold period, exit cap, selling costs, gross / net sale
Section 9  FINANCING          — pointer to Debt Tab (M11)
Section 10 FORWARD GROWTH RATES — per-line annual growth % + CPI anchor + concession burn-off
```

---

## Section 3 — Property Type Coverage Matrix

`DealType = 'existing' | 'development' | 'redevelopment'` is the **deal-state** dimension.
`assetClass` (string, not a discriminated enum) is the **property-type** dimension. These are
separate. `ModelAssumptions` has no `propertyType` field.

The table below covers the 7 canonical property types. "Supported" means F9 has dedicated fields,
template sections, and calibrated defaults. "Partial" means F9 can model the asset class using
generic fields but lacks property-type-specific sections. "Not at all" means the model will
produce structurally incorrect results for that asset class.

| Property Type | Coverage | What Works | What Is Missing |
|---------------|:--------:|------------|-----------------|
| **Multifamily** | Supported | Per-unit economics; M07 traffic engine; LEASING categories A–J; LVE; renovation tiers; state-adjusted OpEx benchmarks (CA payroll ×1.45, FL insurance ×1.5); FIELD_PRIORITIES fully calibrated | Nothing — this is the native asset class |
| **SFR / BTR** | Partial | Per-unit model maps cleanly; STR template handles furnished SFR; state opex adjustments apply | No HOA cost line; no SFR property-management rate benchmark; no vacancy model calibrated for single-unit turnover |
| **Office** | Partial | TI/SF and LC% fields present; `ASSET_CLASS_SPREAD_BPS.office = 0`; position half-life 3.5yr premium / 8.0yr discount | No NNN lease structure; no WALT; no tenant-by-tenant rent roll; EGI model assumes % of GPR vacancy rather than lease expiration schedule |
| **Retail** | Partial | Same as Office; `ASSET_CLASS_SPREAD_BPS.retail = 50 bps`; TI/LC fields usable | No percentage-rent (overage) clause; no anchor-tenant risk weighting; no co-tenancy clause modeling |
| **Industrial** | Partial | `ASSET_CLASS_SPREAD_BPS.industrial = 80 bps`; per-SF model applies | No NNN structure; no dock-door / clear-height premium fields; no industrial lease-expiration schedule |
| **Hospitality (STR)** | Partial | Dedicated STR template: ADR, occupancy × 12-factor seasonal, RevPAR, platform fees; `ASSET_CLASS_SPREAD_BPS.str = 100 bps`; STR half-life 3.0yr/4.0yr | Long-stay hotel (ADR × 365-night model) partially covered; branded franchise cost not modeled; no flag management fee structure |
| **Mixed-Use** | Not at all | Can approximate by running separate models per component | No multi-asset-class NOI stacking; no retail/residential apportionment; no commercial/residential blended cap rate; structural results will be misleading |

**Granularity note:** F9 uses **per-unit** granularity by default. `netRentableSF` is present in
`ModelAssumptions` for per-SF override, but no fields auto-switch between per-unit and per-SF
granularity based on asset class. Commercial assets modeled in F9 require the operator to manually
enter per-SF costs scaled to the same per-unit basis as the underlying template.

---

## Section 4 — Field Inventory

All fields carry a **layer** column (P7):
- **L1** — LLM-reasoned input; `LayeredValue<T>` with broker / platform / user / agent slots
- **L2** — Deterministic computation; read-only in the UI; value produced by `runModel` / `buildProjections`
- **L1→L2** — Field is a LayeredValue assumption whose resolved value feeds directly into the deterministic runner

Column guide: `input_mode` = how operator changes the value (override = editable cell in the UI, read-only = computed, dropdown = selection, date-picker, chips = quick-select buttons). `required` = whether the proforma template marks the field as required.

### 4.1 DEAL TERMS sub-tab (DealTermsTab)

Section A — ACQUISITION / ENTRY

| field_name | display_name | data_type | units | granularity | input_mode | required | layer |
|------------|--------------|-----------|-------|-------------|------------|---------|-------|
| `purchasePrice` | Purchase Price | number | $ | deal | override (number) | yes | L1→L2 |
| `closingCostsBrokerFee` | Broker Fee | number | $ | deal | override (number) | no | L1 |
| `closingCostsLegalDD` | Legal / DD | number | $ | deal | override (number) | no | L1 |
| `closingCostsLenderOrig` | Lender Origination | number | $ | deal | override (number) | no | L1 |
| `closingCostsReserves` | Reserves at Close | number | $ | deal | override (number) | no | L1 |
| `closingCostsOther` | Other Closing Costs | number | $ | deal | override (number) | no | L1 |
| `totalClosingCosts` | Total Closing Costs | number | $ | deal | read-only | no | L2 |
| `allInBasis` | All-In Basis | number | $ | deal | read-only | no | L2 |
| `pricePerUnit` | Price / Unit | number | $/unit | per-unit | read-only | no | L2 |
| `goingInCap` | Going-In Cap Rate | number | % | deal | read-only | no | L2 |
| `stabilizedCap` | Stabilized Cap Rate | number | % | deal | read-only | no | L2 |
| `closeDate` | Close Date | date | YYYY-MM-DD | deal | date-picker | no | L1 |

Section B — HOLD & TARGETS

| field_name | display_name | data_type | units | granularity | input_mode | required | layer |
|------------|--------------|-----------|-------|-------------|------------|---------|-------|
| `holdYears` | Hold Period | number | years | deal | override + chips [3,5,7,10] | yes | L1→L2 |
| `targetIrr` | Target IRR | number | % | deal | override (pct) | no | L1 |
| `targetEm` | Target Equity Multiple | number | ×  | deal | override (number) | no | L1 |
| `targetCoc` | Target Cash-on-Cash | number | % | deal | override (pct) | no | L1 |

Section C — STRATEGY

| field_name | display_name | data_type | units | granularity | input_mode | required | layer |
|------------|--------------|-----------|-------|-------------|------------|---------|-------|
| `investmentStrategy` | Investment Strategy | `LayeredValue<string\|null>` | — | deal | dropdown | **no (nullable)** | L1 |
| `exitStrategy` | Exit Strategy | `LayeredValue<string\|null>` | — | deal | dropdown | **no (nullable)** | L1 |

Both fields are intentionally nullable. `NOT SET` badge renders when both `detected` and `override`
slots are null. No backfill ever. See §4.2 for consumer audit.

Section D — EXIT / DISPOSITION

| field_name | display_name | data_type | units | granularity | input_mode | required | layer |
|------------|--------------|-----------|-------|-------------|------------|---------|-------|
| `exitCap` | Exit Cap Rate | number | % | deal | override (pct) | yes | L1→L2 |
| `sellingCostsPct` | Selling Costs % | number | % | deal | override (pct) | no | L1→L2 |
| `exitDate` | Exit Date | date | YYYY-MM-DD | deal | read-only (derived) | no | L2 |

Returns KPI strip (read-only, derived from last model build):

| field_name | display_name | layer |
|------------|--------------|-------|
| `irr` | IRR | L2 |
| `equityMultiple` | Equity Multiple | L2 |
| `dscr` | DSCR (Y1) | L2 |

### 4.2 INPUTS sub-tab — Sections 5 & 6 (AssumptionsTab — Revenue and OpEx Grid)

All revenue and OpEx rows carry broker / platform / user / resolved columns. `patchField` is the
camelCase key sent to `PATCH /api/v1/proforma/:dealId/assumptions`.

**Revenue (Section 5):**

| field_name | display_name | data_type | units | granularity | input_mode | patchField | required | layer |
|------------|--------------|-----------|-------|-------------|------------|------------|---------|-------|
| `gpr` | Gross Potential Rent | number | $/yr | deal | override | `gpr` | yes | L1→L2 |
| `loss_to_lease` | Loss-to-Lease | number | $/yr | deal | override | `lossToLeasePct` | no | L1→L2 |
| `vacancy_loss` | Vacancy & Credit Loss | number | $/yr | deal | override | `vacancyPct` | yes | L1→L2 |
| `concessions` | Concessions | number | $/yr | deal | override | `concessionsPct` | no | L1→L2 |
| `bad_debt` | Bad Debt | number | $/yr | deal | override | `badDebtPct` | no | L1→L2 |
| `non_revenue_units` | Non-Revenue Units | number | $/yr | deal | override | — | no | L1 |
| `other_income` | Other Income | number | $/yr | deal | override | `otherIncomePerUnit` | no | L1→L2 |
| `net_rental_income` | Net Rental Income | number | $/yr | deal | read-only | — | — | L2 |
| `egi` | Effective Gross Income | number | $/yr | deal | read-only | — | — | L2 |

**Section 5 — M07 Traffic Intel sub-section (read-only; isM07 badge):**

| field_name | display_name | data_type | units | patchField | layer |
|------------|--------------|-----------|-------|------------|-------|
| `t01WeeklyTours` | T-01 Walk-Ins / Week | number | /wk | `t01WeeklyTours` | L1 |
| `t05ClosingRatio` | T-05 Capture Rate % | number | % | `t05ClosingRatio` | L1 |
| `t06WeeklyLeases` | T-06 Velocity — Net Leases/Wk | number | /wk | `t06WeeklyLeases` | L1 |
| `derivedVacancy` | Derived Vacancy % (M07 equilibrium) | number | % | — | L2 |
| `stabilizedOcc` | Stabilized Occupancy Target | number | % | — | L2 |
| `leaseUpTo95` | Weeks to 95% Stabilization | number | weeks | — | L2 |
| `renovationLift` | Renovation Traffic Lift % | number | % | — | L2 |
| `afterRepairRent` | Target After-Repair Rent | number | $/unit/mo | — | L2 |
| `leaseUpVelocity` | Lease-Up Velocity (leases/mo) | number | /mo | — | L2 |
| `loss_to_lease_pct` | Loss-to-Lease % | number | % | — | L2 (mirror of LEASING Cat C) |
| `concessions_pct` | Concession % of Rent | number | % | — | L2 (mirror of LEASING Cat D) |

**Operating Expenses (Section 6):**

| field_name | display_name | data_type | units | granularity | input_mode | patchField | required | layer |
|------------|--------------|-----------|-------|-------------|------------|------------|---------|-------|
| `payroll` | Payroll & Benefits | number | $/yr | deal | override | `payroll` | yes | L1→L2 |
| `repairs_maintenance` | Repairs & Maintenance | number | $/yr | deal | override | `repairsMaintenance` | yes | L1→L2 |
| `turnover` | Turnover / Make Ready | number | $/yr | deal | override | `turnover` | no | L1→L2 |
| `contract_services` | Contract Services | number | $/yr | deal | override | `contractServices` | no | L1→L2 |
| `landscaping` | Landscaping / Grounds | number | $/yr | deal | override | `landscaping` | no | L1→L2 |
| `marketing` | Marketing | number | $/yr | deal | override | `marketing` | no | L1→L2 |
| `utilities` | Utilities | number | $/yr | deal | override | `utilities` | no | L1→L2 |
| `g_and_a` | G&A / Admin | number | $/yr | deal | override | `gAndA` | no | L1→L2 |
| `management_fee` | Management Fee $ | number | $/yr | deal | read-only | — | — | L2 |
| `management_fee_pct` | Management Fee % | number | % | deal | override | `managementFeePct` | no | L1→L2 |
| `insurance` | Insurance | number | $/yr | deal | override | `insurance` | yes | L1→L2 |
| `real_estate_tax` | Real Estate Taxes | number | $/yr | deal | override | `realEstateTax` | yes | L1→L2 |
| `replacement_reserves` | Replacement Reserves | number | $/yr | deal | override | `replacementReserves` | no | L1→L2 |
| `total_opex` | Total Operating Expenses | number | $/yr | deal | read-only | — | — | L2 |
| `noi` | Net Operating Income | number | $/yr | deal | read-only | — | — | L2 |

### 4.3 INPUTS sub-tab — Section 7 (CapEx & Reserves)

| field_name | display_name | data_type | units | granularity | input_mode | patchField | required | layer |
|------------|--------------|-----------|-------|-------------|------------|------------|---------|-------|
| `capexPerUnit` | CapEx Budget ($/unit total) | number | $/unit | per-unit | override | `capexPerUnit` | no | L1→L2 |
| `capexYearDraw` | CapEx Annual Draw ($/unit) | number | $/unit/yr | per-unit | override | `capexPerYear` | no | L1→L2 |
| `reserves` | Replacement Reserves ($/unit/yr) | number | $/unit/yr | per-unit | override | `replacementReserves` | no | L1→L2 |
| `tiPerSF` | Tenant Improvements ($/SF) | number | $/SF | per-SF | override | `tiPerSF` | no | L1 |
| `lcPctOfRent` | Leasing Commissions (% of rent) | number | % | deal | override | `lcPctOfRent` | no | L1 |

### 4.4 INPUTS sub-tab — Section 8 (Disposition & Hold)

| field_name | display_name | data_type | units | granularity | input_mode | patchField | required | layer |
|------------|--------------|-----------|-------|-------------|------------|------------|---------|-------|
| `saleYear` | Target Sale Year | number | years | deal | override | `saleYear` | no | L1→L2 |
| `exitCapRate` | Exit Cap Rate | number | % | deal | read-only (edit in DEAL TERMS) | `exitCapRate` | yes | L1→L2 |
| `sellingCosts` | Selling Costs % | number | % | deal | override | — | no | L1→L2 |
| `grossSalePrice` | Gross Sale Price | number | $ | deal | read-only | — | — | L2 |
| `netSaleProceeds` | Net Sale Proceeds | number | $ | deal | read-only | — | — | L2 |

### 4.5 INPUTS sub-tab — Section 10 (Forward Growth Rates)

| field_name | display_name | data_type | units | patchField | default (platform) | required | layer |
|------------|--------------|-----------|-------|------------|-------------------|---------|-------|
| `growthRentPct` | Rent Growth % / yr | number | % | `rentGrowthStabilized` | 3 % | yes | L1→L2 |
| `growthAncillaryPct` | Ancillary Income Growth % / yr | number | % | `growthAncillaryPct` | 3 % | no | L1 |
| `growthOpexPct` | OpEx Growth % / yr | number | % | `growthOpexPct` | 2 % | yes | L1→L2 |
| `growthUtilitiesPct` | Utilities Growth % / yr | number | % | `growthUtilitiesPct` | 2 % | no | L1 |
| `growthInsurancePct` | Insurance Growth % / yr | number | % | `growthInsurancePct` | 3.5 % | no | L1 |
| `growthTaxPct` | Property Tax Growth % / yr | number | % | `growthTaxPct` | 2 % | no | L1 |
| `growthReservesPct` | Capital Reserves Growth % / yr | number | % | `growthReservesPct` | 2 % | no | L1 |
| `cpiAssumption` | CPI Anchor % / yr | number | % | `cpiAssumption` | 2.5 % | no | L1 |
| `concessionBurnOffPct` | Concession Burn-Off % / yr | number | % | `concessionBurnOffPct` | 0 % | no | L1 |

### 4.6 LEASING sub-tab (LeasingAssumptionsTab — via `leasing-fields.config.ts`)

Fields are gated by `LeaseMode` (from M07 or LVE) and by user experience tier (Beginner ≤ 12 fields / Advanced / Expert). Stored as `leasingPathOverrides` keyed by `field.path`.

#### Category A — Occupancy Targets

| field_id | display_name | type | visible LeaseMode | required | layer |
|----------|--------------|------|-------------------|---------|-------|
| `a_stabilized_occ` | Target stabilized occupancy | percent | all | yes | L1→L2 |
| `a_stab_definition` | Stabilization definition | enum | all | no | L1 |
| `a_current_occ` | Current occupancy (override) | percent | RECOVERY, STABILIZED | no | L1 |
| `a_target_basis` | Target: paid vs signed | enum | all | no | L1 |

#### Category B — Renewal & Turnover

| field_id | display_name | type | visible LeaseMode | layer |
|----------|--------------|------|-------------------|-------|
| `b_renewal_rate` | Renewal rate | percent | all except LEASE_UP | L1→L2 |
| `b_turnover_rate` | Turnover rate | percent | all except LEASE_UP (read-only) | L2 |
| `b_days_vacant` | Days vacant (median) | days | all except LEASE_UP | L1 |
| `b_avg_lease_term` | Average lease term | months | all | L1 |
| `b_rent_step_renewal` | Rent step on renewal | percent | all except LEASE_UP | L1 |
| `b_trade_out_new` | Trade-out new | percent | all except LEASE_UP | L1 |

#### Category C — Rent Growth & Loss-to-Lease

| field_id | display_name | type | visible LeaseMode | layer |
|----------|--------------|------|-------------------|-------|
| `c_rent_growth` | Blended rent growth | percent | all | L1→L2 |
| `c_loss_to_lease` | Loss-to-lease % (Y1) | percent | STABILIZED, RECOVERY | L1→L2 |
| `c_ltl_decay` | LTL decay rate | percent | STABILIZED, RECOVERY | L1 |
| `c_affordable_growth` | Affordable unit rent growth | percent | all | L1 |

#### Category D — Concessions

| field_id | display_name | type | visible LeaseMode | layer |
|----------|--------------|------|-------------------|-------|
| `d_concession_strategy` | Concession strategy | enum | all | L1 |
| `d_new_lease_onetime` | New lease one-time | $ | all | L1→L2 |
| `d_renewal_onetime` | Renewal one-time | $ | STABILIZED, RECOVERY | L1 |
| `d_new_ongoing` | New lease monthly abatement | $ | LEASE_UP, RECOVERY | L1→L2 |
| `d_renewal_ongoing` | Renewal monthly abatement | $ | RECOVERY | L1 |
| `d_pct_new_receiving` | % of new leases with concession | percent | all | L1 |
| `d_pct_renewals_receiving` | % of renewals with concession | percent | STABILIZED, RECOVERY | L1 |
| `d_amortization_method` | Concession amortization method | enum | all | L1 |

#### Category E — Lease-Up Strategy (LEASE_UP_NEW_CONSTRUCTION only)

| field_id | display_name | type | layer |
|----------|--------------|------|-------|
| `e_pre_leased` | Pre-leased count (units) | integer | L1 |
| `e_delivery_month` | Delivery month | month | L1→L2 |
| `e_marketing_intensity` | Marketing intensity | enum | L1 |
| `e_pre_lease_window` | Pre-lease window (months) | months | L1 |
| `e_move_in_lag` | Sign-to-move-in lag (days) | days | L1 |
| `e_stab_target_override` | Stabilization target month override | integer | L1 |
| `e_absorption_type` | Absorption curve type | enum | L1→L2 |

#### Category F — Recovery Strategy (OCCUPANCY_RECOVERY only)

| field_id | display_name | type | layer |
|----------|--------------|------|-------|
| `f_catchup_period` | Catch-up period (months) | months | L1 |
| `f_locator_usage` | Locator / broker usage % | percent | L1 |

#### Category G — Marketing & Costs

| field_id | display_name | type | visible LeaseMode | layer |
|----------|--------------|------|-------------------|-------|
| `g_marketing_per_lease` | Marketing cost per lease | $ | all | L1 |
| `g_marketing_base` | Marketing base cost | $ | all | L1 |
| `g_locator_fee` | Locator fee (% of rent) | percent | all | L1 |
| `g_locator_pct` | Locator usage % | percent | all | L1 |
| `g_turn_cost` | Make-ready / turn cost | $ | STABILIZED, RECOVERY | L1 |

#### Category H — Funnel Conversion

| field_id | display_name | type | visible LeaseMode | layer |
|----------|--------------|------|-------------------|-------|
| `h_prospect_to_tour` | Prospect → tour rate | percent | all | L1 |
| `h_tour_to_app` | Tour → application rate | percent | all | L1 |
| `h_app_to_approval` | Application → approval rate | percent | all | L1 |
| `h_approval_to_lease` | Approval → signed lease rate | percent | all | L1 |
| `h_overall_conversion` | Overall funnel conversion | percent | all (read-only) | L2 |

#### Category I — Bad Debt & Other Income

| field_id | display_name | type | visible LeaseMode | layer |
|----------|--------------|------|-------------------|-------|
| `i_bad_debt` | Bad debt % of GPR | percent | all | L1→L2 |
| `i_other_income_per_unit` | Other Income ($/unit/mo) | $ | all | L1→L2 |
| `i_other_income_growth` | Other income growth % | percent | all | L1 |

#### Category J — Renovation Assumptions (VALUE_ADD, REDEVELOPMENT only)

| field_id | display_name | type | layer |
|----------|--------------|------|-------|
| `j_reno_lift_pct` | Rent lift after renovation | percent | L1→L2 |
| `j_after_repair_rent` | After-repair rent target | $/unit/mo | L1→L2 |
| `j_reno_budget_per_unit` | Renovation budget / unit | $ | L1→L2 |
| `j_reno_timeline_months` | Renovation timeline | months | L1 |
| `j_reno_pct_of_units` | Fraction of units to renovate | percent | L1→L2 |
| `j_reno_batches_per_year` | Renovation batches per year | integer | L1 |
| `j_reno_absorption_lag` | Post-renovation absorption lag | days | L1 |

### 4.7 RENOVATION section (RenovationAssumptionsSection — non-existing dealTypes)

Rendered inside INPUTS when `dealType !== 'existing'`.

| field_name | display_name | data_type | input_mode | Condition | layer |
|------------|--------------|-----------|------------|-----------|-------|
| `selectedTier` | Renovation Scope | enum (tiered buttons) | tier-picker | value-add / redevelopment | L1→L2 |
| `renovationUnits` | Units Renovated | integer | display | all non-existing | L2 |
| `rehabCostPerUnit` | Rehab Cost / Unit | $/unit | display | all non-existing | L2 |
| `premiumRamp[yr].premiumPct` | Year-N Rent Premium | % per year | read-only chart | all non-existing | L2 |

For `development` dealType: Land / Hard Cost / Soft Cost / Contingency table (display-only).

---

## Section 5 — Strategy Variation Within Property Type

### 5.1 Template Dispatch

`M08 → F9` emits a `ProFormaTemplateId`. Source: `proforma-blueprint.ts § PROFORMA_TEMPLATES`.

| Template ID | Triggers | Hold | Periodicity | Special Tuning |
|-------------|----------|:----:|:-----------:|----------------|
| `acquisition_stabilized` | rental, core, core_plus | 60 mo | annual | — |
| `acquisition_value_add` | value_add, rental_value_add | 84 mo | annual | Renovation Assumptions section enabled |
| `development_ground_up` | bts, bts_for_rent, development, ground_up | 120 mo | monthly | `growthTruncationYear: 3` |
| `redevelopment` | redevelopment, reposition, gut_rehab | 96 mo | monthly | Renovation Assumptions section enabled |
| `flip` | flip | 18 mo | monthly | `growthTruncationYear: 1` |
| `str_shortterm` | str, short_term_rental | 60 mo | monthly | Seasonal occupancy (12-factor); `ASSET_CLASS_SPREAD_BPS.str = 100` |
| `land_hold` | land, land_hold | 60 mo | annual | Holding costs only; no revenue model |

### 5.2 Tab / Section Visibility per Template

| Tab / Section | stabilized | value_add | ground_up | redevelopment | flip | str | land |
|---------------|:----------:|:---------:|:---------:|:-------------:|:----:|:---:|:----:|
| ROADMAP | — | ✓ | — | ✓ | — | — | — |
| LEASING Cat J (Renovation) | — | ✓ | — | ✓ | — | — | — |
| Renovation Assumptions section | — | ✓ | ✓ | ✓ | ✓ | — | — |
| CAPITAL > COST SHEET | — | ✓ | ✓ | ✓ | ✓ | — | — |
| CapEx / Draw (Sec 7) | — | ✓ | ✓ | ✓ | ✓ | — | — |
| LEASING Cat E (Lease-Up) | — | — | ✓ | ✓ | — | — | — |
| STR seasonal occupancy | — | — | — | — | — | ✓ | — |
| Growth truncation Y3 | — | — | ✓ | — | — | — | — |
| Growth truncation Y1 | — | — | — | — | ✓ | — | — |

### 5.3 STR-Specific Fields

The `str_shortterm` template activates a 12-factor seasonal occupancy grid in the
`ProFormaSummaryTab`. These are all Layer 1 inputs:

| field | display | type |
|-------|---------|------|
| `adr` | Average Daily Rate | $/night |
| `occupancyRate[1..12]` | Monthly occupancy % | % per month |
| `revPar` | RevPAR | $ (derived) |
| `cleaningFees` | Cleaning fees per stay | $ |
| `platformFees` | OTA platform fee % | % |
| `effectiveGrossIncome` | Effective Gross Income | $ (derived) |

### 5.4 Growth Truncation Mechanics

`growthTruncationYear` in `STRATEGY_TEMPLATE_TUNING` zero-floors rent growth and OPEX growth
for all years strictly beyond the truncation year. Purpose:
- **Ground-up (Y3):** BTS deals exit at stabilization (~Y3); compounding beyond that
  overstates terminal NOI for a deal not held through full rent-growth cycle.
- **Flip (Y1):** 12–18 mo hold; Y2+ growth is a modelling artefact, not a real holding period.

---

## Section 6 — Source Priority by Asset State

Source resolution follows the **LayeredValue waterfall**: user override → agent fill-in → T12 →
rent roll → platform → broker. The table below shows how FIELD_PRIORITIES and SKIP_ZERO_FIELDS
change this waterfall by asset state. Source: `proforma-seeder.service.ts`.

### 6.1 FIELD_PRIORITIES (canonical source order from seeder)

| Field | Priority Order | Notes |
|-------|---------------|-------|
| GPR | t12 → rent_roll | T12 is authoritative annual figure |
| Vacancy % | rent_roll → t12 | Rent roll shows actual leased vs available |
| Concessions % | t12 → rent_roll | T12 amortizes concessions over period |
| Other Income | rent_roll → t12 → om | Rent roll itemizes ancillary; T12 is fallback |
| Real Estate Tax | tax_bill → t12 | Tax bill is ground truth; T12 may lag reassessment |
| Insurance | t12 | Only T12 has granular insurance line |
| Management Fee | t12 | Same |

### 6.2 Asset-State Adjustments

| Asset State | GPR / Revenue Source | OPEX Source | Notes |
|-------------|---------------------|-------------|-------|
| **Stabilized** | T12 (authoritative) → Rent Roll | T12 → Platform benchmark | Lease-up is over; trailing actuals dominate |
| **Lease-Up** | SKIP_ZERO_FIELDS: Rent Roll $0 ignored → Platform → Broker | Platform benchmark (no T12 actuals) | Rent Roll shows $0 GPR early in lease-up — seeder skips zero-value source; M07 LVE is primary |
| **New Construction** | Platform (M07 rent projection) → Broker OM | Platform benchmark | No T12 or Rent Roll exists at construction close |
| **Repositioning / Value-Add** | T12 (pre-reno in-place) → Rent Roll; M07 supplies renovation lift | T12 for current + renovation CapEx schedule | Two NOI views: current (T12-seeded) and stabilized (post-reno M07) |
| **Distressed** | Rent Roll → T12 (may be unreliable) → Platform | Platform + manual flag | Operator expected to review and override; Protector confidence bands widen |

### 6.3 State-Adjusted OpEx Benchmarks

The proforma seeder applies state multipliers to `BASE_OPEX_NORMS_PER_UNIT` (Class-B multifamily calibration):

| State | Payroll multiplier | Insurance multiplier | Notes |
|-------|--------------------|---------------------|-------|
| CA | ×1.45 | ×1.0 | High labor market |
| FL | ×1.0 | ×1.5 | Hurricane/flood exposure |
| TX | ×1.0 | ×1.0 | Baseline |
| NY | ×1.6 | ×1.2 | Union labor + coastal |

### 6.4 Layered-Growth Asset-Class Anchors

Source: `layered-growth/rent-growth.ts § ASSET_CLASS_SPREAD_BPS`.
Applied in the 5-component rent growth model as the long-run CPI anchor spread.

| assetClass | Spread above CPI Shelter | Calibration status |
|------------|:------------------------:|-------------------|
| `multifamily` | +30 bps | TBD (seed value; anchored to BLS 2010–2024) |
| `retail` | +50 bps | TBD (seed value) |
| `office` | 0 bps | TBD (post-2020 secular reset) |
| `industrial` | +80 bps | TBD (seed value) |
| `str` | +100 bps | TBD (seed value) |
| `flip` | 0 bps | — |
| `land` | 0 bps | — |
| `default` | +30 bps | Fallback if assetClass unknown |

### 6.5 Position-Adjustment Half-Lives

Source: `layered-growth/position-adjustment.ts § POSITION_HALF_LIFE_DEFAULTS`.
How fast a property's premium / discount vs its comp-set mean-reverts to zero.

| assetClass | Premium half-life | Discount half-life |
|------------|:-----------------:|:-----------------:|
| `multifamily` | 4.5 yr | 6.0 yr |
| `office` | 3.5 yr | 8.0 yr |
| `str` | 3.0 yr | 4.0 yr |
| others | fallback to `multifamily` defaults | |

---

## Section 7 — KPI / Computed Display Inventory

### 7.1 KPI Classification

| KPI | Display Location | Computation | Layer | Currently LLM? | Should move to det.? |
|-----|-----------------|-------------|-------|---------------|---------------------|
| NOI | AssumptionsTab grid, ProFormaSummaryTab, Projections | EGI − Total OpEx | **L2** | No | Already deterministic |
| EGI | AssumptionsTab grid, ProFormaSummaryTab | NRI + Other Income | **L2** | No | Already deterministic |
| IRR (LP Net) | ReturnsTab, DealTermsTab strip | `runModel()` DCF | **L2** | No (LLM may also compute; deterministic wins per P7) | ✓ Fast endpoint possible |
| Equity Multiple | ReturnsTab | `runModel()` | **L2** | No | ✓ Fast endpoint possible |
| Cash-on-Cash | ReturnsTab | `runModel()` | **L2** | No | ✓ Fast endpoint possible |
| DSCR | DealTermsTab strip, DebtTab | `runModel()` | **L2** | No | ✓ Fast endpoint possible |
| Exit Value | ProFormaSummaryTab, ReturnsTab | forward NOI ÷ exit cap | **L2** | No | ✓ Fast endpoint possible |
| Net Sale Proceeds | AssumptionsTab Sec 8, ReturnsTab | Gross × (1 − selling costs) | **L2** | No | ✓ Fast endpoint possible |
| Waterfall distributions | ReturnsTab | `runModel()` | **L2** | No | ✓ Fast endpoint possible |
| Sensitivity tables (5×5) | SensitivityTab (heat maps) | **Currently LLM response schema** | **L1 (should be L2)** | **Yes** | **Yes — purely formulaic** |
| AI narrative / commentary | CommentaryPanel, AssumptionsTab narrative strip | LLM (intentional) | L1 | Yes | No — narrative is intentional LLM output |
| Gap-fill assumptions (missing fields) | Any seeded row where agent filled | LLM via `agentFillIn` | L1 | Yes | No — agent fill-in is intentional |

### 7.2 KPI Protectors (Confidence Bands)

Implemented in `backend/src/services/proforma/validators/confidence-bands.ts`.
Each user override is classified against the platform P25–P75 (soft warning) and P10–P90 (hard warning) bands:

| Classification | Badge color | UI behavior |
|----------------|-------------|-------------|
| `within` | none | Silent |
| `soft_warning` | amber dot (bottom-right of cell) | Visible but non-blocking |
| `hard_warning` | red dot + rationale prompt | Blocks save until operator provides justification text |

### 7.3 Fast Deterministic Endpoint (Planned — PROFORMA_AUTOCOMPUTE_INVESTIGATION §6)

Steps 7–12 of the build pipeline (irr, NOI, DSCR, CoC, EM, waterfall) run in **<15 ms** with
zero LLM cost. Recommended path: `POST /api/v1/financial-model/compute-fast` skipping
hash / fill-in / DB write / LLM. Live KPIs update at 800 ms debounce on any assumption change.
**Not yet implemented.**

---

## Section 8 — Statistics & Open Gaps

### 8.1 Summary Statistics

| Dimension | Count |
|-----------|------:|
| Built-in tabs | 10 (9 when ROADMAP ineligible) |
| Hub tabs | 5 |
| Leaf tabs | 4 built-in + unlimited custom |
| Sub-tabs (total across all hubs) | 13 |
| AssumptionsTab sections | 10 |
| Revenue fields (Section 5) | 9 OSRow fields + 11 M07 computed rows |
| OpEx fields (Section 6) | 15 fields |
| CapEx fields (Section 7) | 5 fields |
| Disposition fields (Section 8) | 5 fields |
| Growth rate fields (Section 10) | 9 fields |
| DealTerms fields | ~23 fields across 4 sections |
| LEASING category fields (A–J) | 44 fields across 10 categories |
| ProForma templates | 7 |
| LeaseMode values | 5 |
| OperatorStance modulation rules | 15 |
| Asset classes with spread calibration | 7 |
| Custom tab block types | 5 |
| Custom tab field-reference catalog size | 22 allowed patterns |

### 8.2 Open Gaps

| ID | Location | Description | Priority |
|----|----------|-------------|---------|
| M36 | SensitivityTab OPEX axis | OPEX growth sensitivity grid wired to Section B trajectory drivers — covariance matrix pending. Cells show base IRR with OPEX axis label only. | Medium |
| M07 | ProjectionsHubTab | Confidence bands not surfaced in LVE results panel (Deal Journey M07 pending). | Medium |
| M35 | DealJourneyOverlay | Event path visualization (M35) pending — lever rows link to INPUTS sub-tab but do not render a causal chain diagram. | Low |
| M38 | OperatorStance | Calibration loop (M38) pending — stance re-blend uses cached snapshot; no automated calibration cycle. | Low |
| T#613 | DealTermsTab | `deal:strategy-changed` dispatched directly from DealTermsTab — not reconciled with the `dealStore` event pattern used by `basis.changed`. | Low |
| T#797 | ProFormaSummaryTab | `regimeDataByField` Pattern B sub-rows (pre/post-stabilization) — null when Cashflow Agent has not run. | Medium |
| T#451 | CustomTabRenderer | Custom tabs created via Opus inline fence — refresh tab list after every Opus reply to detect fence-created tabs. | Low |
| KPI-fast | FinancialModelEngineService | Fast deterministic compute endpoint not yet built. Sensitivity tables still LLM-generated (should be L2). | High |
| Property types | ProFormaSummaryTab | Mixed-use, office NNN, and industrial assets produce structurally incorrect results in F9. No property-type guard rails or warning banner. | Medium |
| FIELD_PRIORITIES | proforma-seeder | `assetClass` passed to `agentFillIn` but `LibraryResolver` does not yet differentiate multifamily vs commercial benchmark lookups. Resolver uses generic `regional_avg_class_b_2024` for all asset classes. | Medium |
| Calibration | layered-growth | All `ASSET_CLASS_SPREAD_BPS` and `POSITION_HALF_LIFE_DEFAULTS` are seed values pending backtest calibration against BLS CPI shelter sub-index per asset class (spec §14). | Medium |

---

## Appendix A — Key File Index

| File | Role |
|------|------|
| `frontend/src/pages/development/FinancialEnginePage.tsx` | F9 entry, tab strip, BUILD MODEL, Opus panel |
| `frontend/src/pages/development/financial-engine/types.ts` | `DealType`, `ModelAssumptions`, `F9DealFinancials`, `LeaseMode` |
| `frontend/src/pages/development/financial-engine/AssumptionsTab.tsx` | INPUTS grid, FIELD_META, 10-section layout |
| `frontend/src/pages/development/financial-engine/DealTermsTab.tsx` | DEAL TERMS — acquisition, hold, strategy, exit |
| `frontend/src/pages/development/financial-engine/LeasingAssumptionsTab.tsx` | LEASING categories A–J |
| `frontend/src/pages/development/financial-engine/RenovationAssumptionsSection.tsx` | Renovation tier picker + cost/premium ramp |
| `frontend/src/pages/development/financial-engine/CustomTabRenderer.tsx` | Custom tab block renderer |
| `frontend/src/config/leasing-fields.config.ts` | `LEASING_CATEGORIES`, `LeasingFieldDef`, `LeaseMode` |
| `backend/src/services/proforma/blueprint/proforma-blueprint.ts` | `FKEY_MAP`, `M09_INPUTS`, `PROFORMA_TEMPLATES`, `STRATEGY_TEMPLATE_TUNING` |
| `backend/src/services/proforma/layered-growth/rent-growth.ts` | 5-component rent growth, `ASSET_CLASS_SPREAD_BPS` |
| `backend/src/services/proforma/layered-growth/position-adjustment.ts` | Position mode, `POSITION_HALF_LIFE_DEFAULTS` |
| `backend/src/services/proforma/agent-fill-in.ts` | `agentFillIn`, `DealContext`, `LibraryResolver` |
| `backend/src/services/proforma/validators/confidence-bands.ts` | Protector confidence bands, `evaluateRefusal` |
| `frontend/src/stores/dealStore.ts` | `useDealStore`, `DealContext`, `OperatorStance`, cross-tab event emitters |

---

## Appendix B — Cross-Tab DOM Events

| Event | Detail | Dispatcher | Consumers |
|-------|--------|-----------|-----------|
| `basis.changed` | `{}` | `dealStore.setPurchasePrice` | S&U tab, debt sizing, going-in cap; DealTermsTab |
| `hold_period.changed` | `{ holdYears: number }` | `dealStore.emitHoldPeriodChanged` | Projections, Returns |
| `exit_cap.changed` | `{}` | `dealStore.emitExitCapChanged` | Returns strip, net-sale-proceeds row |
| `deal:strategy-changed` | `{ dealId, field, value }` | DealTermsTab (direct — T#613 drift) | Strategy-aware consumers |
| `fe-console-subtab` | `{ subTab: SubTab }` | `DealJourneyOverlay` | ConsoleHubTab (deep-link) |
| `gpr_grid.positioning_changed` | `{}` | FloorPlanGrid (800 ms debounce) | ProjectionsHubTab → re-runs LVE |
| `lease_velocity.output.updated` | `{}` | LVE runner | `FinancialEnginePage` → `fetchF9Financials` |
| `leasing_cost_treatment.changed` | `{}` | AssumptionsTab PATCH | `FinancialEnginePage` → `fetchF9Financials` |
