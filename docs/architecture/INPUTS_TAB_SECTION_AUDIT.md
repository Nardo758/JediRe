# INPUTS Tab Section Audit

**Scope:** F9 Console → INPUTS sub-tab (GENERAL + LEASING).
**Source files:**
- `frontend/src/pages/development/financial-engine/AssumptionsTab.tsx` (GENERAL sub-tab + KeystonePanel)
- `frontend/src/pages/development/financial-engine/LeasingAssumptionsTab.tsx` (LEASING sub-tab renderer)
- `frontend/src/config/leasing-fields.config.ts` (`LEASING_CATEGORIES` — single source of truth for Leasing fields)

**Status:** Read-only inventory. No source changes proposed in this document. Suspected misplacements are flagged for follow-up.

The GENERAL sub-tab actually has six table sections (5A, 5B, 6, 7, 8, 10) plus a read-only `KeystonePanel` (sections 1–4) above the table. LEASING is a separate component with ten categories (A–J), most mode-gated.

---

## GENERAL sub-tab → KeystonePanel (read-only display)

Sections 1–4 are non-editable summary tiles. All edits happen elsewhere (DEAL TERMS, DEBT, deal record, rent roll).

| Section | Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|---|
| 1 KEYSTONE | Hold Period | `assumptions.holdYears` | Years from close to disposition | N (display) | Edited in DEAL TERMS |
| 1 KEYSTONE | Total Units | `financials.totalUnits` | Unit count from rent roll | N | From rent roll |
| 1 KEYSTONE | Hold Scenario | derived from `holdYears` | "5YR/7YR/10YR" tag | N | Mirrors hold tab |
| 1 KEYSTONE | M07 Confidence | `trafficProjection.leasingSignals.confidence` | Traffic engine confidence % | N | M07 signal |
| 1 KEYSTONE | Exit Cap Rate | `assumptions.exitCap` | Terminal cap | N (display) | Editable in DEAL TERMS + Sec 8 |
| 1 KEYSTONE | Rent Growth Y1 | `assumptions.rentGrowthYr1` | First-year rent growth | N (display) | Editable in Sec 10 |
| 2 DEAL INFO | Deal Name / Location / Asset Class / Year Built / Net Rentable SF / SF per Unit | various | Property identity facts | N | Edited in deal record |
| 3 ACQUISITION | Purchase Price / $/Unit / Loan Amount / Equity at Close / LTV/LTC / DSCR Min | `capitalStack.*` | Cap-stack snapshot | N (display) | Edited in DEAL TERMS / DEBT |
| 4 UNIT MIX & RENT ROLL | Total Units / Avg In-Place Rent / Weighted Occupancy / Rent Roll Status / Orig Fee / Amort. (years) | `rentRollSummary.*`, `capitalStack.*` | Rent-roll snapshot + amort terms | N (display) | From rent roll & debt |

---

## GENERAL sub-tab → Section 5A: Revenue › M07 Traffic Intel · Lease Velocity · Concessions

Source: `STATIC_ROWS` filtered by `section === 5`.

| Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|
| T-01 Walk-Ins / Week | `t01WeeklyTours` | Inbound tour volume / week | LV (broker / platform / override) | M07 signal |
| T-05 Trade-Area Capture Rate % | `t05ClosingRatio` | Tour→lease closing ratio | LV | M07 signal |
| T-06 Velocity Signal — Net Leases/Wk | `t06WeeklyLeases` | Net new leases / week | LV | M07 signal |
| Derived Vacancy % (M07 equilibrium) | `derivedVacancy` | Equilibrium vacancy from T-01 × T-05 | **N (readonly)** | Falls back to broker `vacancy_pct` |
| Stabilized Occupancy Target | `stabilizedOcc` *(patches `vacancyPct`)* | Long-run occupancy goal | LV | **DUPLICATE** — also Leasing Cat A `traffic.stabilization.ceiling_occupancy` |
| Weeks to 95% Stabilization | `leaseUpTo95` | Weeks from CO to 95% occ | **N (readonly)** | Computed from M07 |
| Renovation Traffic Lift % | `renovationLift` | Rent lift from value-add scope | LV | Value-add only |
| Target After-Repair Rent | `afterRepairRent` | Post-reno rent target | LV | Value-add only |
| Lease-Up Velocity (leases/mo) | `leaseUpVelocity` | Monthly leasing velocity | LV (display) | T-06 × 4.33 |
| Loss-to-Lease % | `loss_to_lease_pct` | Market−in-place rent gap % | LV | **DUPLICATE** — also Sec 5B `loss_to_lease` (dollars) AND Leasing Cat C `traffic.loss_to_lease_pct` |
| Concession % of Rent | `concessions_pct` | Concession as % of GPR | LV | **DUPLICATE** — also Sec 5B `concessions` (dollars); related to Leasing Cat D `concession_strategy` |

---

## GENERAL sub-tab → Section 5B: Revenue (proforma year 1)

Source: `REVENUE_ORDER` mapped from `financials.proforma.year1`.

| Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|
| Gross Potential Rent | `gpr` | Sum of unit-level market rents × 12 | LV | From rent roll |
| Loss-to-Lease | `loss_to_lease` | Dollar loss vs market | LV | **DUPLICATE** — see 5A `loss_to_lease_pct` |
| Vacancy Loss | `vacancy_loss` | Vacancy in dollars | LV | Driver in 5A `derivedVacancy` |
| Concessions | `concessions` | Concession dollars | LV | **DUPLICATE** — see 5A `concessions_pct` |
| Bad Debt | `bad_debt` | Uncollectible rent $ | LV | **DUPLICATE** — Leasing Cat I `proforma.bad_debt_pct` is the % driver |
| Non-Revenue Units | `non_revenue_units` | Model/employee/down units $ | LV | |
| Other Income | `other_income` | Parking/RUBS/pet/laundry $ | LV | Related to Leasing Cat I `other_income_growth_pct` |
| Net Rental Income | `net_rental_income` | GPR − LTL − Vac − Conc − BD | LV (derived) | |
| EGI | `egi` | Effective Gross Income | LV (derived) | |

---

## GENERAL sub-tab → Section 6: Operating Expenses

Source: `OPEX_ORDER` mapped from `financials.proforma.year1`.

| Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|
| Payroll | `payroll` | On-site staff comp & benefits | LV | |
| Repairs & Maintenance | `repairs_maintenance` | R&M opex | LV | |
| Turnover | `turnover` | Make-ready cost | LV | Related to Leasing Cat G `turn_cost_per_unit` |
| Contract Services | `contract_services` | Outsourced services | LV | |
| Landscaping | `landscaping` | Grounds | LV | |
| Marketing | `marketing` | Advertising spend | LV | Related to Leasing Cat G `marketing_*` |
| Utilities | `utilities` | Owner-paid utilities | LV | |
| G&A | `g_and_a` | Admin overhead | LV | |
| Management Fee | `management_fee` | PM fee (typically % of EGI) | LV | `mgmt_fee_pct` lives here as a $ line; no separate % driver row |
| Insurance | `insurance` | Property insurance | LV | |
| Real Estate Taxes | `real_estate_taxes` | Property tax | LV | |
| Replacement Reserves | `replacement_reserves` | Reserve contributions $ | LV | **DUPLICATE** — Sec 7 `reserves` ($/unit/yr) is the per-unit driver |
| Total OpEx | `total_opex` | Sum of expenses | LV (derived) | |
| NOI | `noi` | EGI − Total OpEx | LV (derived) | |

---

## GENERAL sub-tab → Section 7: CapEx & Reserves

| Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|
| CapEx Budget ($/unit total) | `capexPerUnit` | Total capex per unit over hold | LV | |
| CapEx Annual Draw ($/unit) | `capexYearDraw` | Per-year draw schedule | LV | Front-loaded model |
| Replacement Reserves ($/unit/yr) | `reserves` | Annual reserve per unit | LV | **DUPLICATE** of Sec 6 `replacement_reserves`, different unit |
| Tenant Improvements ($/SF) | `tiPerSF` | TI allowance per SF | LV | Commercial/retail |
| Leasing Commissions (% of rent) | `lcPctOfRent` | LC as % of rent | LV | |

---

## GENERAL sub-tab → Section 8: Disposition & Hold

| Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|
| Target Sale Year | `saleYear` | Hold period for exit | LV | Mirrors `holdYears` |
| Exit Cap Rate | `exitCapRate` | Terminal cap | **N (readonly)** | Editable in DEAL TERMS |
| Selling Costs % | `sellingCosts` | Brokerage/legal at exit | LV | |
| Gross Sale Price (NOI ÷ ExitCap) | `grossSalePrice` | NOI[exit yr] ÷ exitCap | **N (readonly)** | Computed |
| Net Sale Proceeds (after costs) | `netSaleProceeds` | gross × (1 − costs) | **N (readonly)** | Computed |

---

## GENERAL sub-tab → Section 10: Forward Growth Rates

| Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|
| Rent Growth % / yr | `growthRentPct` | Annual GPR growth | **N (readonly)** | Driven by M07 / `assumptions.rentGrowthStabilized`. **DUPLICATE driver of Leasing Cat C `traffic.coefficients.blended_rent_growth`** |
| Ancillary Income Growth % / yr | `growthAncillaryPct` | Other-income growth | LV | Related to Leasing Cat I `other_income_growth_pct` |
| Operating Expense Growth % / yr | `growthOpexPct` | Variable opex growth | LV | |
| Utilities Growth % / yr | `growthUtilitiesPct` | Owner-paid utilities | LV | |
| Insurance Growth % / yr | `growthInsurancePct` | Insurance growth | LV | |
| Property Tax Growth % / yr | `growthTaxPct` | RE tax growth | LV | |
| Capital Reserves Growth % / yr | `growthReservesPct` | Reserve escalation | LV | |
| Concession Burn-Off % / yr | `concessionBurnOffPct` | Y2+ concession ramp-to-zero | LV | Affects Y2+ only |

---

## LEASING sub-tab — `LEASING_CATEGORIES` from `leasing-fields.config.ts`

All fields are LV (broker / platform / override) unless marked `readonly`. Visibility gates by `LeaseMode` (LEASE_UP_NEW_CONSTRUCTION, STABILIZED_MAINTENANCE, OCCUPANCY_RECOVERY, VALUE_ADD, REDEVELOPMENT).

### Category A — Occupancy Targets (visible: all modes)

| Row Label | Field Key (path) | What it represents | Editable? | Notes |
|---|---|---|---|---|
| Target stabilized occupancy | `traffic.stabilization.ceiling_occupancy` | Long-run occupancy ceiling | Y (beginner) | **DUPLICATE** — General Sec 5A `stabilizedOcc` |
| Stabilization definition | `traffic.stabilization.definition` (enum) | PHYSICAL_95 / ECONOMIC_95 / AGENCY | Y | |
| Current occupancy (override) | `traffic.subject_history.current_state.occupancy_pct` | Override stale rent-roll occ | Y (RECOVERY/STAB only) | |
| Target: paid vs signed | `lease_velocity.target_basis` (enum) | SIGNED / PAID | Y (advanced) | |

### Category B — Renewal & Turnover (hidden in LEASE_UP)

| Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|
| Renewal rate | `traffic.renewal_rate` | % of expirations that renew | Y | "renewal_probability" lives here |
| Turnover rate | `traffic.turnover_rate` | 1 − renewal_rate | **N (readonly)** | |
| Days vacant (median) | `traffic.days_vacant_median` | Days between move-out and move-in | Y | |
| Average lease term (months) | `traffic.avg_lease_term_months` | Weighted lease term | Y (advanced) | "lease_term" lives here |
| Rent step on renewal | `traffic.rent_step_renewal_pct` | Rent change at renewal | Y (advanced) | |
| Trade-out new (vs prior tenant) | `traffic.trade_out_new` | Rent change for new lease vs prior | Y (advanced) | |

### Category C — Rent Growth & Loss-to-Lease (visible: all)

| Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|
| Blended rent growth | `traffic.coefficients.blended_rent_growth` | YoY blended rent growth | Y (beginner) | **DUPLICATE** — General Sec 10 `growthRentPct` |
| Loss-to-lease % (Y1) | `traffic.loss_to_lease_pct` | Year-1 LTL gap | Y (STAB/RECOVERY) | **DUPLICATE** — General Sec 5A `loss_to_lease_pct` & Sec 5B `loss_to_lease` |
| LTL decay rate | `proforma.ltl_decay_rate` | Annual LTL burn-off | Y (advanced) | |
| Affordable unit rent growth | `proforma.affordable_rent_growth` | LIHTC/HUD growth | Y (expert) | |

### Category D — Concessions (visible: all)

| Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|
| Concession strategy | `lease_velocity.inputs.concession_strategy` (enum) | CONSERVATIVE/MARKET/AGGRESSIVE | Y | Drives Sec 5A `concessions_pct` |
| New lease — one-time concession ($/unit) | `traffic.concession_environment.new_lease_onetime_per_unit` | Upfront concession | Y | |
| Renewal — one-time concession ($/unit) | `traffic.concession_environment.renewal_onetime_per_unit` | Renewal incentive | Y (STAB/REC) | |
| New lease — monthly abatement ($/unit/mo) | `traffic.concession_environment.new_lease_ongoing_monthly` | Recurring abatement | Y (LEASE_UP/REC) | |
| Renewal — monthly abatement ($/unit/mo) | `traffic.concession_environment.renewal_ongoing_monthly` | Recurring renewal abatement | Y (REC) | |
| % of new leases with concession | `traffic.concession_environment.pct_of_new_leases_receiving` | Concession penetration (new) | Y (advanced) | |
| % of renewals with concession | `traffic.concession_environment.pct_of_renewals_receiving` | Concession penetration (renewals) | Y (advanced) | |

### Category E — Lease-Up Strategy (visible: LEASE_UP_NEW_CONSTRUCTION)

| Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|
| Pre-leased count (units) | `lease_velocity.inputs.pre_leased_count` | Signed leases at delivery | Y | |
| Delivery month | `lease_velocity.inputs.delivery_month` | CO date | Y | |
| Marketing intensity | `lease_velocity.inputs.marketing_intensity` (enum) | LOW/MARKET/AGGRESSIVE | Y | |
| Pre-lease window (months) | `lease_velocity.inputs.pre_lease_window_months` | Pre-leasing duration | Y (advanced) | |
| Sign-to-move-in lag (median days) | `traffic.move_in_lag.median_lag_days` | Sign→move-in median | Y (advanced) | |
| Stabilization target month override | `lease_velocity.inputs.stabilization_target_month_override` | Override engine stab month | Y (expert) | Closest analogue to "absorption_curve" override |

### Category F — Recovery Strategy (visible: OCCUPANCY_RECOVERY)

| Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|
| Catch-up period (months) | `lease_velocity.inputs.catch_up_period_months` | Months to recover occupancy | Y | |
| Locator / broker usage % | `lease_velocity.inputs.locator_usage_pct` | % of new leases via locator | Y (advanced) | Possible duplicate of Cat G `locator_usage_pct` (different path) |

### Category G — Marketing & Leasing Cost (visible: all)

| Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|
| Marketing cost per lease ($) | `lease_velocity.cost_stack.marketing_per_lease` | Variable mktg per lease | Y (advanced) | Feeds Sec 6 `marketing` |
| Marketing base cost ($/month) | `lease_velocity.cost_stack.marketing_base_monthly` | Fixed monthly mktg | Y (advanced) | Feeds Sec 6 `marketing` |
| Locator / broker fee (% of monthly rent) | `lease_velocity.cost_stack.locator_fee_pct_of_rent` | Locator fee size | Y (advanced) | |
| Locator usage % of new leases | `lease_velocity.cost_stack.locator_usage_pct` | Locator penetration | Y (advanced) | Possible duplicate of Cat F `locator_usage_pct` |
| Make-ready / turn cost per unit ($) | `lease_velocity.cost_stack.turn_cost_per_unit` | Per-unit turn cost | Y (advanced) | Feeds Sec 6 `turnover` |

### Category H — Funnel Conversion (visible: all)

| Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|
| Prospect → tour rate | `traffic.funnel_conversion.active.prospect_to_tour` | Funnel stage 1 | Y (expert) | |
| Tour → application rate | `traffic.funnel_conversion.active.tour_to_application` | Funnel stage 2 | Y (expert) | |
| Application → approval rate | `traffic.funnel_conversion.active.application_to_approval` | Funnel stage 3 | Y (expert) | |
| Approval → signed lease rate | `traffic.funnel_conversion.active.approval_to_lease` | Funnel stage 4 | Y (expert) | |
| Overall funnel conversion | `traffic.funnel_conversion.active.overall` | Product of above | **N (readonly)** | |

### Category I — Bad Debt & Other Income (visible: all)

| Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|
| Bad debt % of GPR | `proforma.bad_debt_pct` | Uncollectible rent driver | Y (advanced) | **DUPLICATE** — General Sec 5B `bad_debt` ($ line) |
| Other income growth % | `proforma.other_income_growth_pct` | YoY ancillary growth | Y (advanced) | **DUPLICATE** — General Sec 10 `growthAncillaryPct` |

### Category J — Renovation Assumptions (visible: VALUE_ADD / REDEVELOPMENT)

| Row Label | Field Key | What it represents | Editable? | Notes |
|---|---|---|---|---|
| Rent lift after renovation (%) | `reno.assumptions.rent_lift_pct` | % rent uplift post-reno | Y | Related — General Sec 5A `renovationLift` |
| After-repair rent target ($/unit/mo) | `reno.assumptions.after_repair_rent_per_unit` | ARV rent | Y | **DUPLICATE** — General Sec 5A `afterRepairRent` |
| Renovation budget per unit ($) | `reno.assumptions.budget_per_unit` | Per-unit reno cost | Y | |
| Renovation timeline (months/unit) | `reno.assumptions.timeline_months_per_unit` | Per-unit duration | Y | |
| Fraction of units to renovate (%) | `reno.assumptions.pct_of_units_to_renovate` | Scope of program | Y (advanced) | |
| Renovation batches per year | `reno.assumptions.batches_per_year` | Tranche cadence | Y (advanced) | |
| Post-reno absorption lag (days) | `reno.assumptions.absorption_lag_days` | Days to re-occupy | Y (expert) | |

---

## Suspected Misplacements & Duplicates

### Cross-tab duplicates (same concept exists in both tabs)

| Concept | General location | Leasing location | Recommendation |
|---|---|---|---|
| Stabilized occupancy | Sec 5A `stabilizedOcc` (patches `vacancyPct`) | Cat A `traffic.stabilization.ceiling_occupancy` | **Belongs in Leasing** — definitionally a leasing-velocity outcome. General row should display read-only and link to Leasing. |
| Loss-to-lease % (driver) | Sec 5A `loss_to_lease_pct` | Cat C `traffic.loss_to_lease_pct` | **Belongs in Leasing** — depends on lease roll cadence and renewal trade-out. |
| Rent growth (driver) | Sec 10 `growthRentPct` (readonly) | Cat C `traffic.coefficients.blended_rent_growth` | Already readonly in General — confirm General actually mirrors Leasing edits. |
| Bad debt | Sec 5B `bad_debt` ($ line) | Cat I `proforma.bad_debt_pct` (% driver) | OK pattern — % driver in Leasing, $ in General is the resolved line. |
| Concessions | Sec 5A `concessions_pct` + Sec 5B `concessions` ($) | Cat D `concession_strategy` enum + 6 dollar/% fields | **Risk** — Sec 5A `concessions_pct` is editable AND Cat D fields are editable. Pick one source of truth. |
| Other income growth | Sec 10 `growthAncillaryPct` | Cat I `proforma.other_income_growth_pct` | **Belongs in Leasing** (revenue-side). |
| Renovation rent lift | Sec 5A `renovationLift` | Cat J `reno.assumptions.rent_lift_pct` | **Belongs in Leasing/Renovation Cat J** — General row is a stale display. |
| After-repair rent | Sec 5A `afterRepairRent` | Cat J `reno.assumptions.after_repair_rent_per_unit` | Same — belongs in Cat J. |

### Within-General duplicates

- `Sec 6 replacement_reserves` ($ line) **vs** `Sec 7 reserves` ($/unit/yr driver) — keep both but make Sec 6 readonly and computed from Sec 7 × units.
- `Sec 5A loss_to_lease_pct` (% driver) **vs** `Sec 5B loss_to_lease` ($ line) — same pattern; resolved $ should be readonly downstream of % driver.
- `Sec 5A concessions_pct` (% driver) **vs** `Sec 5B concessions` ($ line) — same.

### Within-Leasing duplicates

- Cat F `lease_velocity.inputs.locator_usage_pct` **vs** Cat G `lease_velocity.cost_stack.locator_usage_pct` — two different paths for what reads like the same concept ("% of new leases via locator"). Confirm whether these are intentionally distinct or accidentally split.

### General-tab rows whose value depends on lease characteristics → candidate moves to Leasing

- `Sec 5A stabilizedOcc` — depends on lease velocity & turnover.
- `Sec 5A loss_to_lease_pct` — depends on lease term & roll cadence.
- `Sec 5A concessions_pct` — depends on concession strategy.
- `Sec 5A renovationLift` / `afterRepairRent` — depends on renovation program.
- `Sec 5A leaseUpVelocity` (display only, M07) — keep as readonly mirror.
- `Sec 10 growthAncillaryPct` — revenue-side, candidate for Leasing Cat I.

### Leasing-tab rows that look property-uniform → candidate moves to General

None obvious. Cat I (`bad_debt`, `other_income_growth`) is borderline — both could live in General, but the spec comment in `leasing-fields.config.ts:18` ("Bad debt is Leasing — revenue-side, M22 pipeline same as renewal rate") explicitly chose Leasing.

### Same label, different definition vs F9 Pro Forma surface

- "Exit Cap Rate" appears in Keystone (display), Sec 8 (`exitCapRate` readonly), AND DEAL TERMS (editable). All three pull from `assumptions.exitCap` so definitions match — three surfaces for one value.
- "NOI" — Sec 6 `noi` is the Year-1 NOI from `proforma.year1`; Pro Forma Summary's NOI may be the projected/exit NOI. Confirm both pull from the same `noi` field.
- "Replacement Reserves" — Sec 6 vs Sec 7 use different units ($ total vs $/unit/yr) — definitions diverge.

### User check-list status

| User-listed key | Found at | Status |
|---|---|---|
| `rent_growth` | General Sec 10 `growthRentPct` (readonly) + Leasing Cat C `traffic.coefficients.blended_rent_growth` | **Duplicate** — General should mirror Leasing |
| `stabilized_occupancy` | General Sec 5A `stabilizedOcc` + Leasing Cat A `traffic.stabilization.ceiling_occupancy` | **Duplicate** |
| `other_income_per_unit` | Not found by that key. `other_income` is a $ line in Sec 5B; no per-unit driver exists. | **Missing** |
| `vacancy_pct` | General Sec 5A `derivedVacancy` (readonly, M07-derived) + Sec 5B `vacancy_loss` ($) | OK — single driver, derived from Stabilized Occ |
| `bad_debt_pct` | Leasing Cat I `proforma.bad_debt_pct` + General Sec 5B `bad_debt` ($) | OK pattern (driver in Leasing, $ in General) |
| `concessions_pct` | General Sec 5A `concessions_pct` + Sec 5B `concessions` ($) + Leasing Cat D enum & 6 fields | **Triple-home — needs rationalization** |
| `loss_to_lease_pct` | General Sec 5A `loss_to_lease_pct` + Sec 5B `loss_to_lease` ($) + Leasing Cat C `traffic.loss_to_lease_pct` | **Triple-home — needs rationalization** |
| `mgmt_fee_pct` | General Sec 6 `management_fee` ($ line only) | **No % driver row exists** — only resolved $ |
| `expense_growth` | General Sec 10 (`growthOpexPct` + 4 sibling growth rows) | OK |
| `cpi_assumption` | Not found in either tab | **Missing** |
| `replacement_reserves` | General Sec 6 `replacement_reserves` ($ total) + Sec 7 `reserves` ($/unit/yr) | **Duplicate within General**, two units |
| `lease_term` | Leasing Cat B `traffic.avg_lease_term_months` | OK |
| `renewal_probability` | Leasing Cat B `traffic.renewal_rate` | OK |
| `concession_amortization_method` | Not found in either tab | **Missing** |
| `absorption_curve` | Closest: Leasing Cat E (`pre_leased`, `delivery_month`, `marketing_intensity`, `stab_target_override`) + General Sec 5A `leaseUpTo95`/`leaseUpVelocity`. No single curve config. | **Implicit / missing as a single field** |
