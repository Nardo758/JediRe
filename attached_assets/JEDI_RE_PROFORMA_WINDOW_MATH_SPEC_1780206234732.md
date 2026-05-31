# JEDI RE — PRO FORMA WINDOW MATH SPEC

**Purpose:** Define the actual math formulas applied to a deal's projection at each lifecycle state. Companion to the Deal Lifecycle State Machine, which defines *when* each formula applies; this document defines *what* each formula computes.

**Status:** Phase 1A annual granularity. Phase 1B refines per-line formulas to monthly granularity using empirical concession-velocity coefficients from the correlation engine.

**Scope:** The math for revenue lines (GPR, vacancy loss, concessions, EGI, other income) and expense lines (OpEx by line item, total OpEx) for each lifecycle state, plus the stabilization-year detection algorithm.

---

## §1 — THE CANONICAL STABILIZED FORMULA (POINT B)

All four lifecycle profiles converge at Point B — the stabilization year. This formula is the destination every profile reaches. It IS the Pro Forma.

### Inputs

| Input | Source | Description |
|---|---|---|
| `units` | Property characteristics | Total unit count |
| `market_rent_per_unit` | CONSOLE > INPUTS (LayeredValue) | Stabilized market rent per unit per month |
| `vacancy_target` | CONSOLE > INPUTS (LayeredValue, default 5%) | Stabilized vacancy threshold |
| `concession_stabilized_pct` | CONSOLE > INPUTS | Residual concession as % of GPR (typically 0-2%) |
| `bad_debt_pct` | CONSOLE > INPUTS | Bad debt as % of GPR |
| `other_income_per_unit_annual` | CONSOLE > INPUTS | Stabilized other income per unit per year |
| `opex_per_line_per_unit_annual` | CONSOLE > INPUTS | Stabilized OpEx by line item, per unit per year |
| `property_tax_annual` | Tax module | Stabilized property tax |
| `insurance_per_unit_annual` | CONSOLE > INPUTS | Stabilized insurance per unit per year |
| `management_fee_pct_of_egr` | CONSOLE > INPUTS | Management fee as % of EGR |

### Formula

```
# Revenue
GPR_stab           = units × market_rent_per_unit × 12
vacancy_loss_stab  = GPR_stab × vacancy_target
concession_stab    = GPR_stab × concession_stabilized_pct
bad_debt_stab      = GPR_stab × bad_debt_pct
loss_to_lease_stab = 0  # At stabilization, in-place = market

base_rental_revenue_stab = GPR_stab - vacancy_loss_stab - concession_stab - bad_debt_stab - loss_to_lease_stab
total_other_income_stab  = other_income_per_unit_annual × units
EGI_stab                 = base_rental_revenue_stab + total_other_income_stab

# Expenses
total_controllable_opex_stab = Σ(opex_per_line_per_unit_annual) × units
property_tax_stab            = property_tax_annual
insurance_stab               = insurance_per_unit_annual × units
management_fee_stab          = EGI_stab × management_fee_pct_of_egr
replacement_reserves_stab    = replacement_reserves_per_unit_annual × units

total_opex_stab = total_controllable_opex_stab + property_tax_stab + insurance_stab + management_fee_stab + replacement_reserves_stab

# NOI
NOI_stab = EGI_stab - total_opex_stab
```

### What the formula represents

This is the asset operating at equilibrium:
- All units leased at market rent (LTL = 0)
- Vacancy at the stabilized target (5%)
- Concessions at residual level (lease-up incentives burned off)
- OpEx normalized (no lease-up marketing premium, no construction-period anomalies)
- No mark-to-market upside remaining (already captured during pre-stab)

For 464 Bishop: this formula's output should be the value that aligns with the broker OM's stabilized NOI claim of $2,999,564. The Phase 1A validation check is whether the agent's reasoning produces inputs that compute to a stabilized NOI within reasonable variance of the OM's claim. Material variance signals either platform input error or OM inflation — both are findings.

---

## §2 — PRE-STABILIZATION FORMULAS BY PROFILE

Pre-stabilization formulas reflect the *path* from each profile's starting condition (Point A) to Point B. The pre-stab formula is profile-dependent because the lease-up dynamics differ structurally.

### Profile 1: STABILIZED — Pre-stabilization formula

**Starting condition:** Current occupancy ≥ 92%.

**Pre-stab phase duration:** 0-1 years. If Year 1 occupancy ≥ 95%, no pre-stab phase. Otherwise, Year 1 is the only pre-stab year and it converges to stabilization by year end.

**Formula adjustments from canonical:**

```
For Year 1 if current vacancy > target:
  vacancy_year1 = (current_vacancy + vacancy_target) / 2  # converges from current toward target
  concession_year1 = concession_stabilized_pct × 1.5  # slightly elevated to drive convergence
  loss_to_lease_year1 = (current_in_place_rent_gap / 2)  # half captures in Year 1
  
  Otherwise all other lines use canonical formula at Year 1 values
```

This profile is essentially the canonical formula with mild lease-up adjustment.

### Profile 2: VALUE-ADD — Pre-stabilization formula

**Starting condition:** Current occupancy 80-92%, significant renovation planned.

**Pre-stab phase duration:** 1-3 years based on renovation pace.

**Inputs unique to this profile:**

| Input | Source |
|---|---|
| `renovation_units_per_year` | CONSOLE > INPUTS |
| `renovation_premium_per_unit_monthly` | CONSOLE > INPUTS |
| `renovation_cost_per_unit` | CONSOLE > INPUTS |
| `renovation_downtime_months_per_unit` | CONSOLE > INPUTS (typically 1-2 months) |

> **Correction 1.4 (2026-05-31):** Renovation premium sourcing — when the operator has not supplied `renovation_premium_per_unit_monthly`, the agent uses an archive P50 fallback (= 0.80 capture rate, derived from the median of broker-OM-claimed capture rates across the 298-row archive). This is NOT grounded in owned-portfolio empirical track record. No owned portfolio property has a tracked value-add program with before/after renovation data. The archive P50 fallback carries low confidence and should be treated as a directional placeholder until operator input is provided.

**Formula adjustments from canonical:**

```
For each pre-stab year:
  # Renovation effects on vacancy
  units_in_renovation = renovation_units_per_year × renovation_downtime_months_per_unit / 12
  effective_vacancy = base_vacancy_trajectory + (units_in_renovation / total_units)
  
  # Rent structure: renovated vs non-renovated
  renovated_units_cumulative = Σ(renovation_units_per_year for years_1_to_current)
  renovated_market_rent = market_rent_per_unit + renovation_premium_per_unit_monthly
  
  GPR_year = (
    renovated_units_cumulative × renovated_market_rent × 12 +
    (units - renovated_units_cumulative) × current_in_place_rent × 12
  )
  
  # In-place rent catching up via lease roll (not just renovation)
  lease_roll_velocity = 1 / avg_lease_term_months  # ~1/12 per month or 1.0 per year
  in_place_rent_gap_closure = (market_rent - current_in_place_rent) × lease_roll_velocity
  
  # Concessions: heavy on renovated units, lighter on non-renovated
  concession_year = (
    renovated_units_per_year × concession_lease_up_renovated +
    (non_renovated_units × turnover_rate) × concession_lease_up_existing
  )
  
  # Other lines computed similarly with profile-specific adjustments
```

### Profile 3: DISTRESSED — Pre-stabilization formula

**Starting condition:** Current occupancy 60-80%, operational repositioning planned.

**Pre-stab phase duration:** 1-2 years.

**Inputs unique to this profile:**

| Input | Source |
|---|---|
| `operational_improvement_velocity` | CONSOLE > INPUTS (units recovered per month) |
| `rent_recovery_path` | CONSOLE > INPUTS (months to bring asking rent to market) |

**Formula adjustments from canonical:**

```
For each pre-stab year:
  # Vacancy compression driven by operations
  vacancy_compression_rate = operational_improvement_velocity / total_units × 12
  vacancy_year = max(vacancy_target, current_vacancy - (vacancy_compression_rate × year_n))
  
  # Asking rent recovers toward market over rent_recovery_path months
  recovery_progress = min(1.0, (year_n × 12) / rent_recovery_path)
  asking_rent_year = current_asking_rent + (market_rent - current_asking_rent) × recovery_progress
  
  # In-place rent catches up via lease roll, anchored to asking rent
  in_place_rent_year = in_place_rent_prior + (asking_rent_year - in_place_rent_prior) × lease_roll_velocity
  
  # Heavy concessions during recovery
  concession_year = concession_distressed_recovery_pct  # typically 4-6% of GPR
  
  # Other lines adjusted for distressed operations
  bad_debt_year = bad_debt_pct × 1.5  # elevated during recovery
  turnover_loss_year = turnover_pct × 1.3  # elevated during recovery
```

### Profile 4: DEVELOPMENT — Pre-stabilization formula

**Starting condition:** 0% occupied, in construction or just-delivered.

**Pre-stab phase duration:** 2-3.5 years (construction + lease-up).

**Inputs unique to this profile:**

| Input | Source |
|---|---|
| `construction_months` | CONSOLE > INPUTS |
| `lease_up_velocity_units_per_month` | CONSOLE > INPUTS (M07 absorption signal) |
| `delivery_month` | Computed from construction_months |
| `concession_lease_up_initial` | CONSOLE > INPUTS (typically 1.5-2.5 months free) |

**Formula adjustments from canonical:**

```
For construction phase years (year_n × 12 ≤ construction_months):
  GPR_year = 0
  EGI_year = 0
  total_opex_year = pre_opening_expenses_year  # security, insurance, taxes, minimal admin
  NOI_year = -pre_opening_expenses_year  # negative (carrying costs)

For lease-up phase years (post-delivery, pre-stabilization):
  months_leasing = max(0, (year_n × 12) - construction_months)
  units_occupied = min(units, lease_up_velocity_units_per_month × months_leasing)
  occupancy_year = units_occupied / units
  vacancy_year = 1 - occupancy_year
  
  # Asking rent at full market for new construction (premium captured)
  asking_rent_year = market_rent_per_unit  # full asking from day one
  
  # Heavy concessions during initial lease-up
  concession_year = concession_lease_up_initial × (1 - occupancy_year)  # tapers as occupancy rises
  
  # GPR scales with units leased
  GPR_year = units_occupied × asking_rent_year × min(12, months_leasing)
  
  # OpEx ramps as occupancy ramps (variable costs scale)
  opex_year = (fixed_opex + variable_opex_per_unit × units_occupied)
```

---

## §3 — POST-STABILIZATION FORMULA (UNIFORM)

After the stabilization year, all profiles converge to the same growth-on-stabilized math.

### Formula

```
For each post-stab year (N+1 through hold end):
  market_rent_year   = market_rent_prior × (1 + rent_growth_pct)
  asking_rent_year   = market_rent_year  # asking tracks market post-stab
  in_place_rent_year = lease-roll-based catch-up to asking
  
  GPR_year            = unit_mix × in_place_rent_year × 12 (with lease-roll math)
  vacancy_loss_year   = GPR_year × vacancy_target  # holds at target
  concession_year     = GPR_year × concession_stabilized_pct  # holds at residual
  bad_debt_year       = GPR_year × bad_debt_pct
  
  EGI_year = GPR_year - vacancy_loss_year - concession_year - bad_debt_year + other_income_year
  
  total_opex_year = sum of OpEx lines × (1 + expense_growth_pct each year, tax-specific where applicable)
  
  NOI_year = EGI_year - total_opex_year
```

### Inputs

| Input | Source |
|---|---|
| `rent_growth_pct` | CONSOLE > INPUTS (LayeredValue, per-year override available) |
| `expense_growth_pct` | CONSOLE > INPUTS (per-line per-year override available) |
| `vacancy_target` | Held constant from stabilization year |
| `concession_stabilized_pct` | Held constant from stabilization year |

---

## §4 — STABILIZATION-YEAR DETECTION ALGORITHM

The agent computes `stabilization_year` from the projected vacancy trajectory across the hold period.

> **Correction 1.5 (2026-05-31):** Provenance — the stabilization-year detection algorithm operates on existing agent infrastructure. The year-by-year vacancy projections come from the existing F9 agent reasoning; the stabilization threshold is the operator's input from CONSOLE > INPUTS; the hold period comes from `deal_assumptions.hold_period_years`. No new agent infrastructure is required for Phase 1A. The algorithm is **wiring on existing infrastructure, not a new analytical capability.** Phase 1A tasks #1640, #1644, #1645 have shipped per audit confirmation.

### Algorithm

```
INPUT:
  - lifecycle_profile (Development | Distressed | Value-Add | Stabilized)
  - hold_period_years
  - vacancy_target (from operator threshold input, default 5%)
  - vacancy_trajectory[1..hold_period_years] (computed by profile-specific pre-stab formula)

ALGORITHM:
  For year_n in 1 to hold_period_years:
    if vacancy_trajectory[year_n] ≤ vacancy_target:
      # Check sustainment: all subsequent hold years must also be at or below target
      sustained = True
      for year_m in (year_n + 1) to hold_period_years:
        if vacancy_trajectory[year_m] > vacancy_target:
          sustained = False
          break
      
      if sustained:
        return year_n  # This is the stabilization year
  
  # No year qualifies
  return null
```

### Edge cases

**Edge case 1 — Year 1 already at target with no subsequent oscillation:**
Algorithm returns `year_n = 1`. STABILIZED profile expected outcome.

**Edge case 2 — Vacancy oscillates:**
A year qualifies only if all *subsequent* hold years stay at or below target. If Year 3 is at target but Year 4 spikes above, Year 3 doesn't qualify; algorithm continues searching.

**Edge case 3 — Vacancy approaches but never reaches target:**
Algorithm returns null. Deal flagged incomplete; operator override required.

**Edge case 4 — Hold period too short for stabilization:**
Same as edge case 3. Hold ends before vacancy converges to target.

### Operator override

The operator can override `stabilization_year` directly via the "Pro Forma Year" input in CONSOLE > DEAL TERMS. Override wins over algorithm output.

---

## §5 — FORMULA CONSISTENCY INVARIANT

The architecture's correctness depends on the formulas converging at the boundary.

### The invariant

> **At the year identified as the stabilization year, the pre-stabilization formula's outputs and the at-stabilization formula's outputs must be approximately equal.**

Specifically, for `year_n = stabilization_year`:

```
abs(NOI_prestab(year_n) - NOI_stab) / NOI_stab < 5%  # tolerance
abs(vacancy_prestab(year_n) - vacancy_target) < 1pp  # tolerance
abs(EGI_prestab(year_n) - EGI_stab) / EGI_stab < 5%
```

If the invariant is violated, the stabilization year is misidentified. The architecture should flag this:

- Tolerance exceeded → "Stabilization year identification inconsistent — pre-stab and at-stab formulas don't converge at year N. Review market rent, vacancy trajectory, or operator threshold."

This is a self-validating architecture: the formulas tell you when the agent's reasoning is internally inconsistent.

---

## §6 — WORKED EXAMPLE: 464 BISHOP

To illustrate the math working end-to-end on a real deal.

### Inputs (from current platform state)

| Input | Value | Source |
|---|---|---|
| units | 232 | Property characteristics |
| current_occupancy | 81% (19% vacancy) | Rent roll / deal_traffic_snapshots |
| market_rent_per_unit | $1,950 estimated | (To be verified — placeholder) |
| in_place_rent | ~$1,690 (13.8% LTL) | deal_traffic_snapshots lease-level |
| vacancy_target | 5% | Default |
| renovation_units_per_year | 50 (placeholder) | (To be verified) |
| renovation_premium | $200/unit/month | (Placeholder) |
| concession_lease_up | 4% of GPR | (Placeholder) |
| hold_period | 5 years | Deal assumptions |
| rent_growth_pct | 3.5% | proforma_assumptions |
| expense_growth_pct | 2.8% | proforma_assumptions |

> **Correction 1.2 (2026-05-31):** Market rent source — `$1,950 estimated` is a placeholder. The platform's current ceiling for Atlanta rent granularity is **city-level only** (`apartment_market_snapshots` has 34 rows for Atlanta, GA at city level; Feb–May 2026). Midtown-specific granularity is not reliably available — only 1 row exists for "Midtown, GA" in `apartment_market_snapshots` (March 2026), which is too sparse to anchor underwriting. Midtown-specific market rent reasoning requires operator input or external comps. The worked example should be understood as using Atlanta city-level data as the rent source, not a Midtown-submarket comparable.

### Lifecycle classification

Current occupancy 81% + renovation planned (>10K/unit, >25% units) → **VALUE-ADD profile**.

### Projected vacancy trajectory (illustrative)

| Year | Vacancy | Notes |
|---|---|---|
| Year 1 | 16% | Renovation downtime adds to existing vacancy; some lease-up offsets |
| Year 2 | 10% | Renovation accelerating, units re-leasing at premium |
| Year 3 | 6% | Most renovation complete, lease-up nearly done |
| Year 4 | 5% | Stabilization reached |
| Year 5 | 5% | Sustained — exit year |

### Algorithm output

Year 4 is the first year vacancy reaches 5% sustained through hold end → `stabilization_year = 4`.

### At-stabilization formula applied to Year 4

```
GPR_stab           = 232 × $1,950 × 12 = $5,428,800
vacancy_loss_stab  = $5,428,800 × 0.05 = $271,440
concession_stab    = $5,428,800 × 0.015 = $81,432
bad_debt_stab      = $5,428,800 × 0.005 = $27,144
LTL_stab           = 0

base_rental_stab   = $5,428,800 - $271,440 - $81,432 - $27,144 - 0 = $5,048,784
other_income_stab  = $777 × 232 = $180,264
EGI_stab           = $5,048,784 + $180,264 = $5,229,048

# OpEx (illustrative)
# Correction 1.1: The $4,200/unit controllable OpEx benchmark is a directional
# cross-check sourced from the Duluth GA owned property (2789 Satellite Blvd,
# suburban Gwinnett County, Yardi data Dec 2021–Dec 2022, 95% occupancy,
# ~$1,055/unit/month NOI at ~$1,740/unit eff rent). This is a suburban Atlanta
# regional cross-check, NOT a same-submarket Midtown comparable.
# Same-submarket Midtown OpEx benchmarking requires external comps or
# operator-supplied data the platform does not currently have.
controllable_opex_stab  = $4,200 × 232 = $974,400
property_tax_stab       = $620,000  # from tax module
insurance_stab          = $450 × 232 = $104,400
management_fee_stab     = $5,229,048 × 0.03 = $156,871
replacement_reserves    = $250 × 232 = $58,000

total_opex_stab    = $974,400 + $620,000 + $104,400 + $156,871 + $58,000 = $1,913,671

NOI_stab           = $5,229,048 - $1,913,671 = $3,315,377
```

> **Correction 1.1 (2026-05-31):** Owned-portfolio comparable reference — the OpEx benchmarking in this example uses the Duluth GA property (2789 Satellite Blvd, suburban Gwinnett County, ~25 miles north of Midtown) as a directional cross-check. The owned portfolio has no Atlanta Midtown asset. The Duluth GA property provides suburban Atlanta Class B OpEx data (Yardi, Dec 2021–Dec 2022) — it is NOT a same-submarket comparable for 464 Bishop. Honest framing: this example uses suburban Atlanta data as a regional cross-check; same-submarket Midtown OpEx benchmarking requires data the platform does not currently have.

### Comparison to OM

OM claim: $2,999,564 stabilized NOI.

Platform-computed: $3,315,377.

Variance: 10.5% above OM. This is meaningful and warrants investigation:
- Are platform market rent inputs ($1,950/unit) too high vs. OM's assumption?
- Are platform OpEx estimates ($4,200/unit controllable) too low vs. OM's?
- Has the operator entered a different renovation premium than the OM assumes?

**The architecture surfaces this variance for operator review.** That's the Bloomberg Terminal positioning — show the operator the platform's reasoning AND the OM's reasoning AND the gap, not just one answer.

(Note: the numerical inputs in this example are illustrative placeholders. Real verification happens when the Phase 1A implementation runs the math against actual 464 Bishop inputs.)

---

## §7 — WHAT'S IN PHASE 1A VS PHASE 1B

### Phase 1A scope

- Lifecycle classification (with profile detection + operator override)
- Profile-specific pre-stabilization formulas at annual granularity
- Canonical at-stabilization formula
- Post-stabilization growth formula
- Stabilization-year detection algorithm
- Formula consistency invariant check
- Operator override paths
- 464 Bishop validation against OM claim

### Phase 1B scope (deferred)

- Monthly granularity for all profile formulas
- Correlation-engine-backed concession-velocity coefficients (replaces Phase 1A's parametric concession assumptions)
- Empirical lease-up velocity from historical_observations (replaces Phase 1A's static velocity inputs)
- Submarket-specific profile detection thresholds (refines the universal thresholds in Phase 1A)
- Month-by-month stabilization detection (replaces annual-granularity algorithm)

> **Correction 1.3 (2026-05-31):** Phase 1B is **data-blocked, not code-blocked**, and introduces a NEW analytical capability for the correlation engine — not a refinement of its existing scope. The current `CorrelationEngineService` (3,488 lines) computes 30 city-level market-intelligence signals (COR-01..30) answering "what is the market doing?" The Phase 1B stabilization queries answer "what will this deal do?" — a different problem. The three functions needed (`computeStabilizationCorrelation`, `computeConcessionVelocityCorrelation`, `computeRentPositioningVelocityCorrelation`) do not exist and must be built. Before they can return useful results, three preconditions must be met:
>
> 1. **Data infrastructure** (weeks to months): populate `historical_observations.property_concession_per_unit` (0/475 rows), `property_asking_rent` (1/475 rows), `property_signing_velocity` (38/475 rows), and `realized_*_t12` outcome columns from vendor feeds at scale
> 2. **Stabilization outcome tracking schema**: new `stabilization_achieved_date` column or `deal_outcomes` table — currently no table tracks actual stabilization timing
> 3. **Code build** (1–2 weeks once data exists): three new functions following `computePairCorrelation` patterns
>
> All three preconditions are independent; all three must complete before Phase 1B's value materializes.

### What stays target-state regardless of phase

The lifecycle state machine (the four profiles, the three states) and the formula consistency invariant are architectural commitments that don't change between Phase 1A and Phase 1B. The implementations grow more sophisticated; the framework persists.

---

## §8 — VERIFICATION

Per CLAUDE.md P8 and P11: every formula here is target-state. State-verification required before treating as canonical.

Specific verifications needed before Phase 1A implementation:

- The Cashflow Agent's existing F9 batch reasoning can produce the per-line inputs each profile formula requires (market rent, vacancy, concession by profile, OpEx by line)
- The platform's projection infrastructure can support profile-specific formulas (today's `buildProjectionsForExport` may need profile-aware branching)
- The formula consistency invariant check is implementable as a verification step in the agent's reasoning
- The illustrative 464 Bishop example uses placeholder inputs; real inputs need to be verified from actual platform state before running the validation

---

## §9 — WHAT THIS DOCUMENT IS NOT

- **Not a UI spec.** The Surface Map captures UI changes.
- **Not a data flow spec.** The Data Flow Spec (companion) captures field-level read/write paths.
- **Not the lifecycle state machine.** The Deal Lifecycle State Machine (companion) defines profiles and transitions; this document defines the math at each state.
- **Not an exhaustive line-item formula reference.** Specific line items (utility sub-lines, replacement reserves variability, etc.) are detailed in proforma calculation specs elsewhere. This document focuses on the lifecycle-state-conditional structure.

The three documents together describe the math architecture. This one is the formulas; the lifecycle doc is the structure; the data flow doc is the wiring.
