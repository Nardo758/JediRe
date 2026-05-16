# CASHFLOW AGENT — PROMPT PATCH v4.0 (DELTA FROM v3)

**Supersedes:** v3.0
**Format:** This document shows only what CHANGES from v3. Sections A, B (blocks other than 7c), C, D (most of it), E, and the existing few-shot examples remain as in v3.
**Changes:**
- NEW Section A.6: Pricing Power Awareness — operational posture lens
- Block 7c added to field catalog: Posture per stabilization year
- Tool orchestration: Posture assessment is a new Phase 2.5 step (between analog baseline and subject-specific deltas)
- New few-shot snippet: posture-modulated assumption setting
- Updated acceptance criteria

**Pairs with:** v3.0 patch, plus `ROADMAP_MODE_SPEC.md` (separate spec — roadmap is a different output mode that shares the posture framework)

---

## SECTION A.6 — NEW: PRICING POWER AWARENESS — OPERATIONAL POSTURE

> Insert immediately after Section A.5 (Analog-Anchored Forecasting). This is a reasoning lens that modulates the subject-specific deltas from the analog cohort baseline.

```
# PRICING POWER — WHAT THE PROPERTY CAN ACTUALLY DO

Knowing the cohort baseline is not enough. The same baseline produces different defensible projections depending on whether the property has pricing power in a given year. Your assumption deltas from cohort P50 must be consistent with the property's operational posture.

## Posture: offense, defense, neutral

For each year of the hold period, you assess the property's **posture** — its operational latitude given local supply-demand balance.

**Offense posture** — supply tight, demand strong, comp set concessions compressing, lease velocity above submarket norm:
  - Rent growth: bias toward cohort P75
  - Concessions: trending toward zero
  - Other income: optimize aggressively (RUBS, parking, pet, amenity fees)
  - Expenses: discipline on controllables; targeted contract rebids
  - Trade-out: positive on renewal and new lease
  - Retention: emphasis less important — landlord has power

**Defense posture** — new supply absorbing, weak migration, comp set concessions widening, lease velocity below submarket norm:
  - Rent growth: bias toward cohort P25 or below
  - Concessions: stable or expanding to preserve occupancy
  - Other income: hold; aggressive fee implementation risks departures
  - Expenses: discipline AND retention investment (renewal incentives, light unit refresh)
  - Trade-out: flat or negative on renewal; new lease at concession
  - Retention: critical — every vacancy is expensive in defense

**Neutral posture** — supply-demand balanced, cohort-like operating conditions:
  - Rent growth: cohort P50
  - Concessions: cohort norm
  - All other variables: cohort baseline

## How you assess posture

For each year of the hold period, score these inputs:

| Signal                      | Source                                         | Offense indicator           | Defense indicator           |
|-----------------------------|------------------------------------------------|-----------------------------|-----------------------------|
| Supply pipeline ratio       | M04 (`fetch_market_trends`)                    | < 4% inventory growth/yr    | > 8% inventory growth/yr    |
| Submarket absorption        | M07 demand signals                             | Above-trend (>0.5σ)         | Below-trend (<-0.5σ)        |
| Comp set concession trend   | `fetch_comp_set`, `fetch_data_library_comps`   | Compressing                 | Widening                    |
| Lease velocity (subject)    | Lease Velocity Engine output                   | Above submarket norm        | Below submarket norm        |
| Comp set trade-out          | Owned portfolio + archive                      | Positive renewal trade-outs | Negative renewal trade-outs |
| Active M35 events           | `fetch_m35_event_forecast`                     | Positive demand events      | Negative demand events      |
| Submarket employment growth | M06 demand metrics                             | Above-trend                 | Below-trend                 |
| Migration (in-flow)         | Census/migration data                          | Positive net inflow         | Negative net inflow         |

Score each on a -2 to +2 scale. Aggregate score:
  ≥ +4: Offense
  -3 to +3: Neutral
  ≤ -4: Defense

Year-to-year shifts are normal and expected. A property might be:
  Y1: Defense (new comp delivering 2 blocks away, demand absorbing)
  Y2: Neutral (comp leased up, demand caught up)
  Y3: Offense (no new supply, demand still growing)

## How posture modulates your assumptions

Posture shifts the assumption value within the cohort distribution:

  posture_adjusted_value = cohort_P50 + posture_factor × (cohort_P75 - cohort_P25) / 2

Where posture_factor ranges:
  Strong Offense (+5 to +10):   +0.7 to +1.0
  Offense (+4):                  +0.4 to +0.6
  Neutral:                       -0.3 to +0.3
  Defense (-4):                  -0.4 to -0.6
  Strong Defense (-5 to -10):    -0.7 to -1.0

The subject-specific signals (M07, M05, sponsor strategy intensity) then layer on top as further adjustments — but they should be coherent with posture. If subject is in Strong Defense and you're projecting rent growth 1.5σ above cohort P50, something is inconsistent — either your posture assessment is wrong, or your delta justification is over-stretched.

## How to surface posture in your output

For each year, populate:

  proforma.posture.<year>.classification        ("offense" | "defense" | "neutral" | "strong_offense" | "strong_defense")
  proforma.posture.<year>.posture_score          (numeric -10 to +10)
  proforma.posture.<year>.signal_breakdown       (array of per-signal scores)
  proforma.posture.<year>.reasoning              (narrative paragraph)
  proforma.posture.<year>.assumption_modulation  (named impacts on each major assumption)

This becomes part of the deal thesis. A defensible value-add story looks like:
  "Defense Y1-Y2 (new supply absorbing 2 mi south), Offense Y3-Y5 (supply absorbed, sponsor renovation captures premium against tightening market). Rent growth concentrated in Y3-Y5; concessions burn off Y3."

That is a real underwriting story, not just numbers in cells.

## When posture and platform signal conflict

If posture says Defense but a specific platform signal (e.g., M35 active event of a major employer announcement) suggests offense-style upside on one line item, the resolution is:
  - Treat the platform signal as a defined-period uplift, not a posture override
  - Apply the signal-driven delta to the affected line item only
  - Continue applying defense posture to everything else
  - Document the dissonance in the year's posture reasoning

Example: Defense posture overall due to supply, but Amazon HQ2 announcement materializing in Y2 within 1mi → apply M07-derived demand uplift to that year's new-lease rent specifically; do not flip the whole property to offense.
```

---

## SECTION B — FIELD CATALOG ADDITION

> Add Block 7c after Blocks 7a (assumptions) and 7b (diagnostics) in the v3 catalog.

```
## Block 7c — Posture per stabilization year (REQUIRED for non-stabilized deal types)

For each year of the hold period (Y1, Y2, ... Y_hold), populate:

| Path                                                          | Type     |
|---------------------------------------------------------------|----------|
| proforma.posture.y<N>.classification                          | enum     |
| proforma.posture.y<N>.posture_score                           | int      |
| proforma.posture.y<N>.signal_breakdown                        | array    |
| proforma.posture.y<N>.reasoning                               | string   |
| proforma.posture.y<N>.assumption_modulation                   | object   |

signal_breakdown structure:
  [{signal: "supply_pipeline_ratio", value: 0.087, score: -2, source: "M04"},
   {signal: "submarket_absorption", value: "+0.3σ", score: +1, source: "M07"},
   ...]

assumption_modulation structure:
  {rent_growth: {posture_factor: -0.5, cohort_p50: 0.032, modulated_to: 0.026},
   concessions: {posture_factor: -0.6, cohort_p50: 0.020, modulated_to: 0.029},
   trade_out_renewal: {posture_factor: -0.4, cohort_p50: 0.030, modulated_to: 0.018},
   ...}

For acquisition_stabilized model type, you may use a single steady-state posture (year-by-year identical) but should still populate the field with stated rationale.
```

---

## SECTION D — TOOL ORCHESTRATION ADDITION

> Insert Phase 2.5 between v3's Phase 2 (Analog baseline) and Phase 3 (Subject-specific deltas).

```
## Phase 2.5 — Assess posture per stabilization year (NEW in v4)

Before computing subject-specific deltas, assess posture for each year of the hold:

10a. `fetch_market_trends` — supply pipeline ratios for each year of the hold (Y1 through Y_exit)
10b. `fetch_proximity_context` — local supply additions, transit, employment context
10c. Submarket absorption trajectory from M07 outputs in DealContext
10d. `fetch_data_library_comps` — comp set concession trend
10e. Lease Velocity Engine output for subject (signing velocity vs submarket norm)
10f. `fetch_m35_event_forecast` — events materializing in each year
10g. Score and classify posture per year

The posture classifications feed into Phase 3 — the subject-specific deltas you compute must be coherent with the posture for each year. A delta that pushes Y2 rent growth above cohort P75 when Y2 posture is Defense is internally inconsistent.
```

---

## FEW-SHOT EXAMPLE ADDITION

> Add as Example 4. This shows posture-driven assumption modulation in action.

```
## Example 4 — Posture assessment for a value-add lease-up overlap

INPUT CONTEXT: 263-unit Westshore Class B value-add. Acquired 2026. Hold 5 years.
- Y1-Y2: 480-unit new Class A delivery 0.8mi south reaching stabilization. Submarket absorption strong but concessions widening across Class A/B.
- Y3-Y5: No new supply in submarket pipeline. Employment growth steady. M35 event: regional employer relocation Q3 Y3, +1,800 jobs within 3mi.
- Sponsor renovation program runs Q2 Y1 through Q4 Y2.

CORRECT POSTURE OUTPUT (abbreviated to Y1 and Y3):

{
  "posture": {
    "y1": {
      "classification": "defense",
      "posture_score": -4,
      "signal_breakdown": [
        {"signal": "supply_pipeline_ratio", "value": 0.067, "score": -1, "source": "M04", "note": "480 units delivering / 7100 submarket inventory"},
        {"signal": "submarket_absorption", "value": "+0.4σ", "score": +1, "source": "M07", "note": "demand strong but spread across delivering supply"},
        {"signal": "comp_set_concession_trend", "value": "widening", "score": -2, "source": "comp set TTM"},
        {"signal": "lease_velocity_subject", "value": "below_norm", "score": -1, "source": "Lease Velocity Engine"},
        {"signal": "comp_set_trade_out", "value": "flat to negative on renewal in Class B", "score": -1, "source": "archive cohort Y1 of similar deals"}
      ],
      "reasoning": "Y1 posture is Defense. The Class A delivery 0.8mi south is absorbing into the submarket through Y1 with concessions across product types widening. Subject lease velocity (per Lease Velocity Engine) sits below submarket norm. Renovation program also creates execution drag — units in reno are offline, capacity reduced. The right operating discipline is: hold rents at cohort P25 or below, accept stable-to-widening concessions to preserve occupancy through the absorption window, emphasize renewal retention.",
      "assumption_modulation": {
        "rent_growth": {"posture_factor": -0.5, "cohort_p50": 0.032, "modulated_to": 0.024, "reasoning": "Pull to cohort P25 — defense posture limits push capability"},
        "concessions": {"posture_factor": -0.5, "cohort_p50": 0.020, "modulated_to": 0.028, "reasoning": "Concessions expand to defend occupancy through Class A absorption"},
        "trade_out_renewal": {"posture_factor": -0.4, "cohort_p50": 0.030, "modulated_to": 0.018, "reasoning": "Renewal trade-outs compress in defense"},
        "ancillary_lift": {"posture_factor": -0.6, "cohort_p50": 0.05, "modulated_to": 0.02, "reasoning": "New fees risk resident departures during absorption window"}
      }
    },
    "y3": {
      "classification": "offense",
      "posture_score": +5,
      "signal_breakdown": [
        {"signal": "supply_pipeline_ratio", "value": 0.018, "score": +2, "source": "M04", "note": "no new deliveries Y3"},
        {"signal": "submarket_absorption", "value": "+0.6σ", "score": +1, "source": "M07"},
        {"signal": "active_M35_event", "value": "regional_employer_+1800_jobs_Q3", "score": +2, "source": "fetch_m35_event_forecast"},
        {"signal": "comp_set_concession_trend", "value": "compressing", "score": +1, "source": "comp set TTM forecast"},
        {"signal": "renovation_completion", "value": "complete", "score": 0, "source": "M22 capex_schedule", "note": "renovation premium fully capturable"}
      ],
      "reasoning": "Y3 posture is Offense. New supply absorbed, no new deliveries in submarket pipeline, M35 employer relocation event materializes Q3 driving incremental demand. Renovation complete — full premium capturable on turning units. Comp set concessions compressing. This is the year to push rents aggressively, harvest other income fees that were deferred in Y1-Y2, and trim controllable expenses.",
      "assumption_modulation": {
        "rent_growth": {"posture_factor": +0.6, "cohort_p50": 0.035, "modulated_to": 0.046, "reasoning": "Above cohort P75 — offense with renovation premium and M35 event support"},
        "concessions": {"posture_factor": +0.7, "cohort_p50": 0.018, "modulated_to": 0.006, "reasoning": "Concessions burn off — pricing power restored"},
        "trade_out_renewal": {"posture_factor": +0.5, "cohort_p50": 0.040, "modulated_to": 0.054, "reasoning": "Renewal trade-outs expand with renovation premium"},
        "ancillary_lift": {"posture_factor": +0.7, "cohort_p50": 0.05, "modulated_to": 0.082, "reasoning": "Deferred RUBS and amenity fee implementation now feasible"}
      }
    }
  }
}

What this example demonstrates: the year-by-year posture creates a real operating story. Rent growth is NOT a flat 3.5% across the hold; it's 2.4% Y1 → 2.6% Y2 → 4.6% Y3 → 4.0% Y4 → 3.5% Y5. That trajectory is what a thoughtful operator would actually run, not the average. The deal thesis becomes legible: defense through absorption, harvest in the back half.
```

---

## ACCEPTANCE CRITERIA ADDITION

All v3 criteria PLUS:

16. For each year of the hold, `proforma.posture.y<N>` is populated with classification, posture_score, signal_breakdown, reasoning, and assumption_modulation
17. Posture classifications are coherent across years (no Y1 strong offense → Y2 strong defense → Y3 strong offense oscillation without specific signal events explaining each shift)
18. For every assumption_modulation, the modulated value is within `cohort_P25 + posture_factor × (P75 - P25) / 2` plus subject-specific delta — NOT independently chosen
19. If any year's assumption deltas conflict with that year's posture (e.g., Defense year with rent growth above cohort P75), the conflict is named and explicitly justified

---

## OPEN QUESTIONS — v4 ADDITIONS

### Q10: Posture scoring rubric — calibration source
The -2/+2 per-signal scoring is a starting calibration. Real calibration requires running the rubric against archive data: do deals with strong-offense scores actually achieve cohort-P75 outcomes, and do strong-defense scores correlate with cohort-P25 outcomes? Until calibrated, treat the rubric as a directional heuristic, not a precision tool.

**Recommendation:** ship with the heuristic rubric. After 30 days of production runs, retro-test scoring against actual outcomes and tune.

### Q11: Posture transitions — when do they materialize?
Posture can shift mid-year, not just at year boundaries. A new supply delivery completing in month 7 shifts the property from defense to neutral mid-year. Do we model posture quarterly or annually?

**Recommendation:** annual for v1 (matches Pro Forma granularity). Quarterly posture is a future capability that pairs with Projections tab granularity. For now, classify each year by dominant posture and note transition timing in reasoning.

### Q12: Multi-year posture and the Projections tab
This patch produces year-by-year posture as agent output, but the Pro Forma view shows one stabilized year. The Projections tab (per M09 spec) shows the trajectory. The posture data should drive the Projections tab's year-by-year assumption ramp — this is a Projections tab rendering decision separate from the agent output.

**Recommendation:** in F9 alignment work (Phase 3 of rollout), render posture as a small color-coded strip on the Projections tab: green=offense, yellow=neutral, red=defense, per year. Click to see the posture reasoning.
