# JEDI RE — DEAL LIFECYCLE STATE MACHINE

**Purpose:** Define the four canonical lifecycle profiles that determine how a deal progresses from its starting condition to stabilized operations, and how the platform's math switches formulas at each lifecycle transition.

**Status:** Companion to the Pro Forma Window Surface Map. Architectural foundation for the Math Spec and Data Flow Spec.

**Scope:** Phase 1A annual granularity. Phase 1B refines to monthly granularity using the same lifecycle framework.

---

## §1 — THE CORE MODEL

Every deal moves through three lifecycle states across the hold period:

```
PRE-STABILIZATION ──[trigger: vacancy ≤ 5% sustained]──> AT-STABILIZATION ──[12 months elapse]──> POST-STABILIZATION
```

The math formula applied to a year's projection depends on which state that year belongs to.

**Pre-stabilization (years 1 through N-1, where N is the stabilization year):**
- Lease-up dynamics dominate
- Concession profile is active
- In-place rents are catching up to market
- Vacancy is moving from starting condition toward 5%
- Math reflects the *path*, not the destination

**At-stabilization (year N — the 12-month window beginning when vacancy first hits 5% sustained):**
- Operating at equilibrium
- Concessions burned off (or minimal residual)
- In-place rents at market
- Vacancy at 5%
- Math reflects the stabilized formula — this IS the Pro Forma

**Post-stabilization (years N+1 through hold end):**
- Stabilized operations continuing
- Growth rates apply (rent growth, expense growth)
- Concessions stay minimal
- Vacancy stays at 5% (or operator-overridden target)
- Math reflects growth-on-stabilized formula

The platform's job is to: (a) identify which lifecycle state each year belongs to, and (b) apply the right math formula for that state.

---

## §2 — THE FOUR CANONICAL PROFILES

Each profile defines a starting condition and an expected path shape. Different profiles take different paths to the same destination (Point B = 95% occupied / 5% vacancy sustained).

### Profile 1 — STABILIZED

**Starting condition (Point A):** Deal acquired at or near stabilization. Current occupancy ≥ 92% (≤ 8% vacancy), no significant renovation, no construction.

**Path shape:** Year 1 IS the stabilization year. Vacancy starts at or near 5% and stays there. No meaningful lease-up phase exists.

**Pre-stabilization phase duration:** 0 years (or 1 year if currently slightly above threshold and converging).

**Concession profile:** Minimal at acquisition; remains minimal across hold period.

**Rent profile:** Asking rent at market; in-place rents close to market (modest LTL upside captured naturally as leases roll).

**Typical hold path:**
- Year 1: at stabilization (5% vacancy, market rents, modest concessions)
- Years 2+: post-stabilization (rent growth compounding, stable operations)

**Examples:**
- Acquisition of a 95% occupied Class A property with in-place rents within 2-3% of market
- Acquisition of a recently-stabilized lease-up where occupancy has held above 92% for 6+ months

### Profile 2 — VALUE-ADD

**Starting condition (Point A):** Deal acquired with current occupancy 80-92%, significant renovation planned, mark-to-market opportunity, manageable lease roll.

**Path shape:** Multi-year lease-up driven by renovation pace and lease roll. Vacancy initially rises as units are taken offline for renovation, then compresses as renovated units re-lease at premium.

**Pre-stabilization phase duration:** Typically 1-3 years depending on renovation pace and unit count.

**Concession profile:** Moderate during lease-up phase (to drive velocity on renovated units); reduces as renovation completes and premium captures.

**Rent profile:** Asking rent for renovated units at renovated-market premium; non-renovated units stay at in-place until lease roll. Mark-to-market capture as leases turn over.

**Typical hold path:**
- Year 1: pre-stabilization (renovation underway, vacancy may briefly rise above starting condition, concessions on renovated units)
- Year 2: pre-stabilization (renovation progressing, lease-up accelerating)
- Year 3: at stabilization (5% vacancy reached, renovation premium captured)
- Years 4+: post-stabilization (stable renovated operations, growth compounding)

**Examples:**
- Acquisition of a 1980s-vintage Class B property with $25K/unit interior renovation plan and 70-unit completion over 18 months
- Acquisition of a 90% occupied property with intent to renovate 50% of units over 24 months

### Profile 3 — DISTRESSED

**Starting condition (Point A):** Deal acquired with current occupancy 60-80%, operational challenges (deferred maintenance, prior mismanagement, market dislocation), no significant renovation but operational repositioning needed.

**Path shape:** Lease-up driven by operational improvements rather than renovation — new management, leasing strategy, marketing, possibly minor capital. Vacancy compresses through better tenant acquisition and retention.

**Pre-stabilization phase duration:** Typically 1-2 years.

**Concession profile:** Higher during recovery phase (overcoming reputational drag, signing velocity-critical); reduces as operational stabilization is reached.

**Rent profile:** Asking rent may start below market (to drive velocity) then move toward market as occupancy recovers. Less mark-to-market upside than value-add since renovation isn't driving premium.

**Typical hold path:**
- Year 1: pre-stabilization (heavy concessions, operational improvements driving slow vacancy compression)
- Year 2: at stabilization (5% vacancy reached, asking rent moving toward market)
- Years 3+: post-stabilization (stable operations, rent growth on top of recovered base)

**Examples:**
- Acquisition of a 75% occupied property from a stressed seller, with intent to install new property management
- Acquisition of a property in a temporarily weakened submarket where occupancy is expected to recover with operational changes

### Profile 4 — DEVELOPMENT

**Starting condition (Point A):** Ground-up construction or major redevelopment. Current occupancy 0% at construction start; lease-up begins after certificate of occupancy.

**Path shape:** Multi-phase journey — construction phase (no revenue), lease-up phase (revenue ramping from 0%), stabilization.

**Pre-stabilization phase duration:** Construction (12-24 months) + lease-up (12-18 months typically) = 2-3.5 years total.

**Concession profile:** Heavy during initial lease-up to drive velocity in oversupplied markets or to compete with established comps; tapers as occupancy approaches stabilization.

**Rent profile:** Asking rent at projected-market for the delivered product (new construction typically commands premium); concessions discount the effective rent during lease-up.

**Typical hold path:**
- Year 1: construction (zero revenue) → late-year lease-up may begin
- Year 2: pre-stabilization (lease-up acceleration, heavy concessions, vacancy from 100% to ~30%)
- Year 3: pre-stabilization or at stabilization (vacancy compressing through ~10% range)
- Year 4: at stabilization (5% sustained reached)
- Years 5+: post-stabilization

**Examples:**
- Ground-up 200-unit multifamily development in an established submarket
- Major redevelopment (90%+ unit reconstruction) of an existing property

---

## §3 — PROFILE DETECTION

The platform must classify each deal into one of the four profiles. Classification informs which math formula applies and what the expected lifecycle looks like.

### Detection inputs

The classifier reads the following from the deal record:

| Input | Source | Used for |
|---|---|---|
| Current occupancy | Rent roll snapshot or `deals.current_occupancy` | Distinguishes development (0%), distressed (60-80%), value-add (80-92%), stabilized (≥92%) |
| Renovation budget | `deal_assumptions.renovation_cost_per_unit` × units, or `deal_capex_items` aggregate | Distinguishes value-add (significant renovation) from distressed (operational only) or stabilized (none) |
| Construction status | `deal_assumptions.construction_months` > 0 | Identifies development profile |
| Hold strategy | `deal_assumptions.investment_strategy` | Operator-stated profile (overrides detection if explicit) |
| Deal mode | `deals.deal_mode` (existing field: STABILIZED, LEASE_UP, REDEVELOPMENT) | Coarse-grained existing classification — informative but not authoritative |

### Detection rules (Phase 1A defaults)

```
IF construction_months > 0:
  → DEVELOPMENT

ELSE IF current_occupancy < 80%:
  → DISTRESSED

ELSE IF renovation_budget_per_unit > $10,000 OR renovation_units > 25% of total:
  → VALUE-ADD

ELSE IF current_occupancy ≥ 92%:
  → STABILIZED

ELSE:
  → DISTRESSED (fallback — occupancy 80-92% without renovation signals operational repositioning)
```

These thresholds are Phase 1A defaults. Phase 1B may refine using historical correlation data (e.g., "what occupancy threshold actually predicts which lifecycle path in this submarket").

### §3.5 — Threshold provenance note

> **Correction 2.1 (2026-05-31):** The profile detection thresholds above are **based on industry conventions and professional judgment, not empirical validation from platform-tracked deal outcomes.** Specifically:
>
> - DISTRESSED < 80% — industry convention for "operating distress"; not validated against owned portfolio
> - VALUE-ADD renovation triggers ($10K/unit, >25% units) — judgment-based; not validated
> - STABILIZED ≥ 92% — industry convention (lender definitions vary 85–95%); not validated
> - DEVELOPMENT construction-active — definitional; not requiring validation
>
> All three owned portfolio properties are observed at stabilized occupancy (94.7%, 94.6%, 95.0%). No lease-up trajectory data exists for any owned property — the thresholds cannot be validated against platform-empirical data. These thresholds may be adjusted based on operator feedback and deal-by-deal outcomes as the platform accumulates lease-up history.

### Operator override

The classifier produces a profile; the operator can override. UI affordance in CONSOLE > DEAL TERMS or CONSOLE > INPUTS:

- Field: "Deal Lifecycle Profile (operator override)"
- Options: Development / Distressed / Value-Add / Stabilized
- LayeredValue: Layer 1 = operator override; Layer 2 = classifier output

When override is set, the lifecycle math uses the override; provenance flag indicates "operator-classified."

---

## §4 — LIFECYCLE STATE TRANSITIONS

### Pre-stabilization → At-stabilization

**Trigger:** Vacancy reaches 5% (or operator-set threshold) AND remains at or below threshold for the remainder of the hold period (Phase 1A: subsequent years; Phase 1B: subsequent 12 months).

**Detection:** Agent computes the projection vacancy trajectory year-by-year. Finds the first year where the trigger conditions are met. Writes `deal_assumptions.stabilization_year`.

**Edge cases:**
- No year meets the trigger: `stabilization_year = null`; deal flagged incomplete; operator override required to anchor Pro Forma manually
- Trigger met then violated later: agent searches forward for next sustained year; if none, treats as never-stabilized
- Trigger met in Year 1 (already stabilized): `stabilization_year = 1`; pre-stabilization phase has zero duration

### At-stabilization → Post-stabilization

**Trigger:** 12 months elapse from the start of the stabilization year. In Phase 1A annual granularity: post-stabilization begins in year N+1 where N is the stabilization year.

**Detection:** Deterministic from `stabilization_year`. No additional reasoning required.

**Edge cases:**
- Hold ends within or before stabilization: no post-stabilization phase exists; exit happens during at-stabilization or pre-stabilization
- Stabilization year is the last year of hold: at-stabilization runs from year N until exit; no post-stabilization

---

## §5 — MATH FORMULA SWITCHING

The lifecycle state determines which formula applies for that year's projection.

### Pre-stabilization formula (varies by profile)

The pre-stabilization formula computes Year-N values using profile-specific lease-up dynamics. The Math Spec document (companion) details the formulas. High-level structure:

```
For each pre-stab year:
  vacancy(year)     = profile-specific ramp from starting condition toward 5%
  concession(year)  = profile-specific schedule (heavy → tapering)
  asking_rent(year) = profile-specific (renovation premium if VALUE-ADD, market+growth otherwise)
  in_place_rent(year) = lease-roll-based catch-up to asking
  GPR(year)         = function of unit mix × in-place rent × growth_applied_at_lease_expiration
  EGI(year)         = GPR × (1 - vacancy) - concessions - bad debt
  OpEx(year)        = base OpEx × growth - lease-up marketing/turnover adjustments
  NOI(year)         = EGI - OpEx
```

### At-stabilization formula (uniform across profiles)

The at-stabilization formula is the "Pro Forma formula" — the canonical 12-month stabilized operating statement.

```
For the stabilization year:
  vacancy           = 5% (target threshold)
  concession        = stabilized minimum (typically 0-2% of GPR, profile-dependent residual)
  asking_rent       = market rent at stabilization
  in_place_rent     = converged to asking (LTL ≈ 0)
  GPR               = unit_mix × market_rent × 12
  EGI               = GPR × 0.95 - minimal concessions - bad debt
  OpEx              = stabilized OpEx with no lease-up adjustments
  NOI               = EGI - OpEx
```

**This is the formula that should produce a value aligned with the broker OM's stabilized NOI claim for 464 Bishop (~$2.99M).** If it doesn't, either the formula's inputs are wrong (market rent, OpEx) or the OM's claim is inflated. Either way, the comparison is meaningful.

### Post-stabilization formula (uniform across profiles)

The post-stabilization formula applies growth to the stabilized base.

```
For post-stab years (N+1 through exit):
  vacancy           = 5% (held constant) or operator-set trajectory
  concession        = stabilized minimum
  asking_rent(year) = asking_rent(year-1) × (1 + rent_growth)
  in_place_rent(year) = catches up via lease roll
  GPR(year)         = function of asking_rent and lease-roll dynamics
  EGI(year)         = GPR × 0.95 - minimal concessions
  OpEx(year)        = OpEx(year-1) × (1 + expense_growth)
  NOI(year)         = EGI - OpEx
```

### Formula consistency invariant

The architecture's correctness depends on:

> **At the boundary year (the stabilization year), the pre-stabilization formula's output and the at-stabilization formula's output must converge.**

If the agent identifies Year 3 as the stabilization year, the pre-stab formula applied to Year 3 should produce the same values as the at-stab formula applied to Year 3. The transition isn't a discontinuity; it's a convergence point.

This invariant validates the agent's stabilization-year detection. If the formulas don't converge, the agent picked the wrong year.

---

## §6 — INTEGRATION WITH EXISTING ARCHITECTURE

### Relationship to deal_mode

The existing `deals.deal_mode` field (STABILIZED, LEASE_UP, REDEVELOPMENT) is informative but not authoritative for lifecycle classification. The mapping:

| deal_mode | Likely profile | Notes |
|---|---|---|
| STABILIZED | STABILIZED | Direct mapping |
| LEASE_UP | DEVELOPMENT or DISTRESSED | Depends on construction_months and starting occupancy |
| REDEVELOPMENT | VALUE-ADD | Most common mapping |

When deal_mode and the four-profile classifier disagree, the classifier (with operator override) is authoritative for math purposes. deal_mode remains useful for other surfaces.

> **Correction 2.2 (2026-05-31):** The `deal_mode` field values listed above (STABILIZED, LEASE_UP, REDEVELOPMENT) are **INFERRED-NOT-VERIFIED** from prior session memory, not from a live audit of the `deals` table. Before reconciling the four-profile classifier with `deal_mode` or deciding whether the classifier should write to `deal_mode` or a new field, a grep verification is required:
> - What values currently exist in `deals.deal_mode` across all deal rows
> - Which services read `deal_mode` and which UI surfaces display it
> - Whether the four-profile classifier should reuse `deal_mode` or write to a new `lifecycle_profile` field
>
> This is a small follow-up verification, not a blocker for Phase 1A. The `lifecycle_profile` field in `deal_assumptions` (the new Phase 1A field) is independent of `deal_mode`; reconciliation of the two fields is deferred pending that verification.

### Relationship to OperatorStance

OperatorStance (conservative/balanced/aggressive) modifies *within* a profile. Two value-add deals with different OperatorStance produce different concession profiles, different vacancy trajectories, different stabilization timelines — even though both are value-add. Stance is a within-profile knob; profile is the structural classification.

### Relationship to LayeredValue and Pieces A-D

The lifecycle state machine is consistent with:
- Piece B Commitment B.1 (canonical read path): `stabilization_year` has one source (agent-computed with operator override)
- Piece B Commitment B.2 (trajectory math): the pre-stabilization formula by profile IS the trajectory math
- Piece C deal completeness: "lifecycle profile undetermined" or "stabilization year null" become completeness signals
- The correlation engine (Phase 1B): historical observation data refines profile detection thresholds and pre-stab formula coefficients per submarket

### Relationship to the existing F9 Cashflow Agent

The Cashflow Agent's role expands:
- Today: produces point assumptions per F9 batches (market rent, vacancy %, OpEx ratios)
- Phase 1A: additionally produces `stabilization_year` and the profile classification (or accepts operator override)
- Phase 1B: additionally produces month-by-month trajectory using correlation engine coefficients

The agent's tier authority discipline (Tier 1 actuals → Tier 2 owned-portfolio → Tier 3 platform → conservative default) applies to lifecycle detection: actual rent roll occupancy is highest authority; submarket-comp lease-up data informs profile patterns; platform defaults handle thin-data cases.

---

## §7 — EDGE CASES (LIFECYCLE-LEVEL)

| Edge case | Handling |
|---|---|
| Deal with mixed profile (e.g., partial development + partial existing) | Classify by majority profile; operator override available to handle structurally |
| Deal that changes profile mid-hold (e.g., distressed acquired, then renovation initiated in Year 2) | Phase 1A: classify by initial profile; operator can re-classify if changes are material. Phase 1B may handle dynamically. |
| Deal where operator's stated strategy doesn't match deal characteristics (e.g., operator says "stabilized" but occupancy is 75%) | Surface the mismatch in UI; let operator confirm or correct |
| Deal that never reaches stabilization within hold period | Flagged incomplete via Deal Completeness; operator override anchors Pro Forma manually |
| Deal where lifecycle profile fits but stabilization threshold is wrong (e.g., student housing with 2% target) | Operator overrides threshold in INPUTS; lifecycle classification unaffected |

---

## §8 — VERIFICATION

Per CLAUDE.md P8 and P11: every claim in this document is target-state architecture. State-verification required before treating any specific code/schema claim as canonical.

Specific verifications needed before Phase 1A implementation:
- Existing `deals.deal_mode` field semantics and current values across the deal portfolio
- `deal_assumptions` schema can absorb `lifecycle_profile` field and `stabilization_year` field
- The Cashflow Agent's existing infrastructure can read the inputs needed for classification (current_occupancy, renovation budget, construction status)
- The profile detection rules (§3) match operator intuition across the platform's existing deals — test classification against a sample of known-profile deals before relying on it

---

## §9 — WHAT THIS DOCUMENT IS NOT

To be explicit:

- **Not a complete math spec.** The Math Spec document (companion) details the actual formulas for each lifecycle state. This document defines *which* formula applies *when*.
- **Not a data flow spec.** The Data Flow Spec document (companion) details which surfaces read and write the lifecycle-related fields. This document defines the state machine conceptually.
- **Not a UI spec.** The Surface Map document details where lifecycle profile and stabilization year appear on which surfaces.
- **Not strategy-aware module logic.** Pieces C and the strategy-aware modules doc cover how strategy modules consume lifecycle state. This document defines the state itself.

The four documents together describe the Pro Forma Window Architecture. Each one covers a different layer.
