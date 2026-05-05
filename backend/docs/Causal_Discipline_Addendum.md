# Causal Discipline — Channel Routing and Cause/Symptom Separation

**Module(s) affected:** M07, M08, M35, M36, M37, plus wiring spec
**Spec relationship:** Cross-cutting addendum to all of the above. Pins two architectural invariants.
**Status:** Implementation-grade

**Why this addendum exists.** The five existing specs (M36, M36 macro-anchored mean, M37, M35 calibration ledger, wiring update) are individually correct but collectively underspecified on one critical dimension: they don't pin down *how an event or a signal flows through the system without being counted twice*. Without explicit invariants, the implementation will produce double-counted scores in two specific ways — events fanning out to multiple destinations, and causes plus symptoms summing additively — and these failure modes are subtle enough that they'll survive code review. This document closes both gaps with two formal rules and a worked example showing them in operation.

---

## 1. The Two Invariants

### Invariant A — Channel Routing

> Every event has a single primary channel of impact. Events flow through their primary channel only. Downstream effects appear naturally through cross-module integration; they are never separately injected at downstream consumers.

This is the discipline that prevents the same event from being applied multiple times along its causal pathway. Amazon's 3,000 jobs does not get applied to occupancy *and* to rent growth *and* to JEDI Score independently. It gets applied at one place — the Traffic Engine — and the downstream price/occupancy split, factor variance, score CIs, and revenue projections all derive from that single application.

### Invariant B — Cause/Symptom Separation

> Strategy scores compose multiplicatively from a *projected* component (built from causal inputs) and a *validation* component (built from symptom observations). Causes and symptoms are never additively combined as if they were independent evidence.

This is the discipline that prevents observable market activity from being counted twice — once as a cause input and once as a symptom that confirms the cause input. The Amazon announcement and the search-volume surge it produces are not two independent demand signals; they are one signal observed through two channels, and the strategy score must reflect that.

Together these two invariants are the architectural backbone that makes JEDI Triangulated coherent under integration. M36, M37, and M38 each work in isolation, but their integration is meaningful only if the upstream event flow and downstream signal aggregation respect these two rules.

---

## 2. Why Each Invariant Matters

### Why Channel Routing Matters

Without it, the same event drives downstream effects through multiple paths and the system over-states impact.

**Concrete failure mode.** Amazon announces 3,000 jobs in Tampa. Without channel routing:
- M06 routes a demand-pool adjustment to M09, increasing rent_growth assumption by +0.6%
- M07 separately adjusts occupancy_path upward, which M09 reads and uses
- M35 emits an event-driven assumption delta to M09, adding another +0.4% to rent_growth
- M14 separately adjusts demand-side risk attribution

Net effect: M09's rent_growth assumption is pumped up by both M06's direct edge and M35's direct edge, on top of the rent path improvement that M07 already delivered. The deal models with a 1.0% rent growth bonus when the actual analog evidence supports 0.6%. Over a 60-month hold, this is a multi-percent IRR error per deal, systematically biased optimistic.

The same failure mode exists for supply events in reverse — a 300-unit delivery gets applied as concession pressure, occupancy headwind, and direct rent reduction independently, over-stating the bearish impact.

**Channel routing fixes this** by declaring per event subtype which module is the single point of injection. Other modules consume the *resulting* state, not the event itself.

### Why Cause/Symptom Separation Matters

Without it, the Strategy Builder over-weights events whose effects have already been observed in market activity.

**Concrete failure mode.** Amazon announces 3,000 jobs. Three weeks later, search volume for Tampa rentals is up 25% and surge index is 1.5σ above baseline. In an additive-composite Demand sub-score:
- employer_concentration signal scores high (Amazon event)
- C_SURGE_INDEX scores high (search surge)
- search momentum scores high (search surge again, slightly different metric)
- migration trend scores moderate (some early migration uptick)

These four metrics are all reflecting the same Amazon event from different vantage points. Adding them weighted produces a Demand score 30-40% higher than the underlying signal warrants. The strategy builder ranks the deal as a top candidate; the JEDI score amplifies; the Cashflow Agent underwrites aggressive. Six months later when the surge fades to its sustainable level, the projection looks wildly off.

This is the canonical "obvious in hindsight" failure mode of mixed cause-symptom scoring. It's what happens when the same signal is fed in through multiple channels because the architecture doesn't distinguish between the underlying cause and the market's response to it.

**Cause/symptom separation fixes this** by structuring the score as `Score = Expected × Validation`, where Expected is built from causes and Validation is the agreement between Expected and observed Symptoms. Confirmation bumps the score modestly (validation_factor up to ~1.3); contradiction discounts it (down to ~0.7); but the Expected component dominates and the Validation component bounded.

---

## 3. Channel Routing — The Formal Specification

### 3.1 Primary Channel Declarations

Every event subtype in M35's taxonomy carries a `primary_channel` field declaring which module owns the injection point. Other modules read downstream effects but do not separately inject.

```sql
ALTER TABLE event_subtypes ADD COLUMN primary_channel VARCHAR(20) NOT NULL;
-- Values: 'M07_traffic' | 'M09_proforma_direct' | 'M03_devcap' | 'M14_macro' | 'multi_channel'
```

**Channel assignments** for the launch event taxonomy:

| Event subtype | Primary channel | Rationale |
|---|---|---|
| `employer_expansion` | M07_traffic | Creates demand; price/occupancy split is endogenous to M07 market-clearing |
| `employer_contraction` | M07_traffic | Removes demand; same logic in reverse |
| `major_relocation_announcement` | multi_channel | Headcount via M07; sentiment via direct cap rate channel |
| `in_migration_driver` | M07_traffic | Demand pool input |
| `demographic_shift` | M07_traffic | Demand composition input |
| `multifamily_delivery` | M07_traffic | Competition for the same demand pool |
| `multifamily_permit` | M07_traffic | Future competition; M03 also reads for development feasibility |
| `demolition` | M07_traffic | Removes competition |
| `conversion` | M07_traffic | Net effect on stock |
| `rent_control_passage` | M09_proforma_direct | Discontinuous policy ceiling; not market-clearing-mediated |
| `tax_abatement` | M09_proforma_direct | Direct expense path change |
| `entitlement_approval` | M03_devcap | Permits developable supply; not present-period market |
| `zoning_upzoning` | M03_devcap | Future supply potential |
| `rate_move` | M14_macro | Macro factor; flows to cap rates and debt directly |
| `recession_indicator` | M14_macro | Macro regime signal |
| `regional_shock` | multi_channel | Both M07 (demand) and M14 (risk) — distinct causal pathways |

The list is not closed; new subtypes are added as M35's taxonomy grows. The principle for assigning a channel: **what is the most upstream module that the event causally affects?** The primary channel is that module. Everything else is downstream.

### 3.2 The Multi-Channel Exception

Some events have genuinely independent causal pathways. The test for whether something is multi-channel rather than double-counting:

> *Can you write down a causal story for each pathway that doesn't pass through the other?*

For `major_relocation_announcement`:
- **Pathway 1 (headcount):** Amazon hires 3,000 → demand pool grows over 6-18 months → traffic, occupancy, rent shift. Causally mediated by households moving.
- **Pathway 2 (sentiment):** Amazon announces → asset class repricing as institutional capital reassesses Tampa → cap rate compression in weeks. Causally mediated by capital markets, not households.

These are temporally distinct (months vs weeks), causally distinct (housing demand vs capital allocation), and observably distinct (occupancy and rent vs cap rate spreads). Multi-channel is correct, not double-counting. The two channels run in parallel and produce independent contributions.

For `regional_shock` (e.g., hurricane):
- **Pathway 1 (demand disruption):** Damaged inventory removed from market → supply contracts → traffic dynamics shift → flows through M07.
- **Pathway 2 (risk repricing):** Insurance costs spike, climate risk premium expands → flows through M14.

Both real, both independent. Multi-channel.

For `employer_expansion` — only one pathway. The "sentiment effect" of a 200-job expansion is too small to register independently; the path is just demand. Single-channel.

### 3.3 Downstream Consumption Rules

Once an event is routed through its primary channel, downstream modules consume the *resulting state*, not the event itself.

**M09 ProForma:**
- ✅ Reads occupancy_path and market_rent_path from M07 (which already include traffic-channel events)
- ✅ Reads parsed values from M18 (T12, rent roll, tax bill)
- ✅ Reads direct-channel events for subtypes routed there (rent control, tax abatement)
- ❌ Does NOT receive event-driven assumption deltas from M35 or M06 for traffic-channel events

**M14 Risk:**
- ✅ Reads Σ from M36 for factor variance attribution
- ✅ Reads M14-channel events directly (rate moves, recession indicators)
- ❌ Does NOT separately receive demand- or supply-event-driven risk adjustments — these are reflected in the Σ-derived attribution naturally

**M08 Strategy Builder:**
- ✅ Reads expected_demand_strength and expected_supply_pressure from M07 (Section 4)
- ✅ Reads symptom observations from M05 / M15 / behavioral metrics
- ❌ Does NOT separately weight raw event variables (employer_concentration, etc.) as additive signals — these are absorbed in M07's projections

**M25 JEDI Score:**
- ✅ Reads sub-scores from M08, M14, etc.
- ❌ Does NOT separately apply event-driven score adjustments

The rule generalizes: **read state from upstream, don't re-inject events.**

### 3.4 Audit Mechanism

Channel routing is enforced at the wiring layer via Kafka subscription policy, not at runtime per-call. The policy:

```
For every event subtype with primary_channel = 'M07_traffic':
  Allowed subscribers of `event.classified` Kafka topic for that subtype:
    - M07 (primary)
    - M37 (analog library updates)
    - M36 (anomaly attribution if applicable)
    - M38 (prediction logging if M35 emitted a forecast)
  
  Forbidden subscribers:
    - M09 (must read M07 outputs instead)
    - M14 (must read M36 Σ instead)
    - M08 (must read M07 expected values instead)
```

A deployment-time policy check validates that no module is subscribed to event topics it shouldn't be. Violations block deployment. This is how the discipline survives implementation drift — the architectural rule is enforced by infrastructure, not by code review vigilance.

---

## 4. Cause/Symptom Separation — The Formal Specification

### 4.1 The Two Categories

**Cause inputs (leading indicators).** Exogenous shocks to the supply/demand equation. They happen, then the market responds.

| Category | Cause inputs |
|---|---|
| Demand causes | employer events, in-migration events, demographic shifts, wage policy changes, transportation infrastructure |
| Supply causes | multifamily deliveries, permits, demolitions, conversions, regulatory supply effects |
| Macro causes | rate moves, recession indicators, capital-flow shifts |

**Symptom observations (coincident or lagging).** Measurements of the market's actual response to the underlying drivers.

| Category | Symptom observations |
|---|---|
| Demand symptoms | C_SURGE_INDEX, C_TPI, C_TVS, search_volume_momentum, lead_volume, application_volume, days_to_lease, social_sentiment |
| Supply symptoms | concession_trends, days_on_market, comp_set_absorption_rate, lease_up_velocity_differential |
| Macro symptoms | transaction_volume, cap_rate_movements, sentiment_score |

The line between them is causal direction. If the metric *generates* market activity, it's a cause. If the metric *reflects* market activity, it's a symptom. Some metrics are borderline — *occupancy* itself is technically a symptom but it's also a state variable that affects future market clearing. Default rule for borderline cases: classify as symptom, since causes should be reserved for clearly exogenous inputs.

### 4.2 Two-Track Score Construction

For each Strategy Builder sub-score (Demand, Supply, Momentum, Position, Risk), the construction has two tracks:

**Track 1 — Expected (from causes).** Build from causal inputs routed through M07 and M36. Produces a forward-looking projection of what the metric *should* be.

```
expected_demand_strength = M07.project_demand_pressure(
  employer_events, migration_data, demographic_inputs,
  macro_demand_factors, regime
)
```

This is the "given everything we know about the underlying drivers, here's what demand pressure should be" measure. Output range standardized to [0, 1] or [-1, +1] depending on metric.

**Track 2 — Observed (from symptoms).** Build from current symptom observations. Produces a real-time measurement of what the market *is actually doing*.

```
observed_demand_intensity = aggregate(
  C_SURGE_INDEX, C_TPI, C_TVS, search_momentum, lead_volume, ...
)
```

Standardized to the same range. The aggregation can be a simple weighted average; the weights matter less here than they do in the additive-composite scheme because the result is used as a validation signal, not as a primary score.

### 4.3 Multiplicative Composition

The sub-score composes multiplicatively:

```
DemandScore = expected_demand_strength × validation_factor

where validation_factor = f(observed_intensity / expected_strength)
                       ∈ [v_floor, v_ceiling]
```

Recommended bounds: `v_floor = 0.7`, `v_ceiling = 1.3`. The validation factor is bounded because pure-symptom signals are too noisy to dominate, but agreement or disagreement should meaningfully shift the score.

The functional form of f:

```
ratio = observed_intensity / expected_strength

if ratio ≥ 1.5:        validation_factor = 1.3   (strong confirmation, uplift capped)
if 1.2 ≤ ratio < 1.5:  validation_factor = 1.15
if 0.85 ≤ ratio < 1.2: validation_factor = 1.0   (normal confirmation)
if 0.5 ≤ ratio < 0.85: validation_factor = 0.85
if ratio < 0.5:        validation_factor = 0.7   (strong contradiction)
```

When expected_strength is near zero, ratio becomes unstable. Special-case: if expected < threshold and observed > threshold, treat as a "Hidden Surge" state (Section 4.5). If both are near zero, validation_factor = 1.0.

### 4.4 The Same Logic Applies to Supply

Mirror structure for supply scoring:

```
expected_supply_pressure = M07.project_supply_pressure(
  delivery_pipeline, permit_data, demolition_data, regime
)

observed_supply_pressure = aggregate(
  concession_trends, days_on_market_competitors, 
  absorption_lag, lease_up_differential, ...
)

SupplyScore = (1 - expected_supply_pressure) × validation_factor
            (higher score = less supply pressure = better for current owner)
```

Hidden Frothy and Hidden Distress states (Section 4.5) apply analogously.

### 4.5 Quadrant States — Hidden Gem, Frothy, Confirmed, Contested

The cause/symptom split formalizes the Correlation Engine's quadrant intuition into discrete states.

For **Demand**:

| Expected | Observed | State | Strategy Builder treatment |
|---|---|---|---|
| High | High | Confirmed Strong | Full score, high confidence |
| High | Low | **Hidden Gem** | Modest discount (validation_factor 0.7-0.85). Flag for investigation: why isn't the announced demand showing up? |
| Low | High | **Frothy** | Modest premium (validation_factor 1.15-1.3) but with explicit warning: market activity exceeds underlying drivers; sustainability questionable |
| Low | Low | Confirmed Weak | Low score, high confidence |

For **Supply**:

| Expected | Observed | State | Treatment |
|---|---|---|---|
| Low pressure | Low pressure | Confirmed Tight | High score |
| Low pressure | High pressure | **Hidden Distress** | Concessions rising despite limited new supply. Existing supply may be over-rented or demand softening from unmeasured cause |
| High pressure | Low pressure | **Resilient Absorption** | Demand absorbing pipeline better than expected |
| High pressure | High pressure | Confirmed Loose | Low score |

The labeled states drive UI rendering directly. Deal Capsule shows a state badge per dimension. Strategy Builder explanations reference the state. Investment Memo includes the state in the executive summary.

### 4.6 Discrepancy as Tradeable Signal

The discrepancy between expected and observed is itself a signal worth surfacing.

**Persistent Hidden Gem in a market** = evidence of a cause we haven't captured. Either a new event we haven't classified, or an existing event whose magnitude we underestimated, or a structural factor that our M36 mean is mispricing. M36's anomaly detector catches large persistent discrepancies and flags them as candidate "missing-event" signals. This feeds back to the news extraction system: if Tampa shows persistent hidden surge, look harder for what's causing it.

**Persistent Frothy in a market** = evidence that current activity will mean-revert. The strategy builder's warning becomes a leading indicator: holds in Frothy markets are exposed to reversion risk that doesn't show in current metrics.

This is what makes the cause/symptom split actively useful, not just defensively correct. The system isn't just avoiding double-counting; it's surfacing the structural information that double-counting destroys.

---

## 5. End-to-End Worked Example: Amazon Adds 3,000 Jobs in Tampa

To make the two invariants concrete, trace one event through the entire system. This is the canonical scenario both invariants must handle correctly.

### 5.1 Event Ingestion (T+0)

News article appears: "Amazon to add 3,000 fulfillment-center jobs in Tampa, ramping over 18 months."

- L1 ingestion: RawArticle record created with source, content hash
- L2 classification: Claude (or fine-tuned classifier) extracts:
  ```json
  {
    "is_event": true,
    "event_subtype": "employer_expansion",
    "subject_employer": "Amazon",
    "magnitude": {"value": 3000, "unit": "jobs", "confidence": "high"},
    "location": {"msa": "Tampa", "lat": 27.95, "lng": -82.46},
    "timeline": {
      "announcement_date": "2026-04-15",
      "expected_ramp": [
        {"quarter": "2026Q3", "count": 500},
        {"quarter": "2026Q4", "count": 1000},
        {"quarter": "2027Q1", "count": 1500}
      ]
    },
    "signal_quality": "official_announcement"
  }
  ```
- Verification gates: source credibility (high — official Amazon press release), cross-source confirmation (Tampa Bay Times + Bloomberg corroborate), magnitude sanity check (passes M36 outlier check at 3000 jobs for an MSA-tier-1 employer)
- Verified Event committed. Kafka emits `event.classified` with `event_subtype = 'employer_expansion'` and `primary_channel = 'M07_traffic'`.

### 5.2 Channel Routing — Single Point of Injection (T+1 minute)

Per Invariant A and the channel assignment table:

**Allowed subscribers** of this `event.classified`:
- M07 (primary): receives the event for traffic projection update
- M37: adds to analog library for future cross-market reference
- M36: anomaly detector verifies whether observed market state matches projected response (used later for validation)
- M38: logs that M35 emitted a forecast about this event for future calibration

**Forbidden subscribers** (deployment policy enforced):
- M09: will NOT receive this event directly. Must read updated M07 outputs.
- M14: will NOT receive a direct risk adjustment. Reads updated Σ from M36.
- M08: will NOT receive a direct strategy weight adjustment. Reads updated expected_demand_strength from M07.
- M06: receives the event for *demand-pool computation*, but as upstream input to M07, not as a parallel injection to M09. M06's role here is computational support, not endpoint.

### 5.3 M07 Processes the Event (T+5 seconds)

M07 receives the event with its ramp schedule. M06 has computed the demand-pool conversion: 3,000 jobs × 0.7 households/job = 2,100 housing-unit-equivalent demand, ramped over 18 months.

M07 has:
- Current Tampa multifamily occupancy: 93.5%
- Current pipeline (M04): 1,800 units delivering over 24 months
- Current rent growth trajectory: 3.2% YoY
- Σ overlay (M36): factor loadings, regime = late_cycle
- M37 analog query: "Amazon-class events in similar markets show occupancy uplift +0.8 to +2.0pp and rent growth uplift +0.4 to +1.2% over 18 months, depending on supply elasticity."

**Market-clearing logic in M07.** Given current occupancy at 93.5% (slack), early demand absorbs into occupancy. As occupancy approaches 95% (market-clearing), additional demand pressure flows to rent.

M07 produces:
- `occupancy_path`: rises from 93.5% to 94.8% over 12 months, plateaus near 95%
- `market_rent_path`: rent growth lifts from 3.2% to 3.7% in months 6-18, then sustains
- `expected_demand_strength`: rises from 0.55 (baseline) to 0.72 (post-event projection)
- `lease_up_velocity_units_per_month`: lifts modestly across submarket
- `confidence_score`: 0.81 (good analog support, n_effective = 14)
- `plausibility_d` (from M36): 0.7 (Realistic — demand within plausible range for the region)

Kafka emits `traffic.projection_updated`.

### 5.4 Downstream Consumption — No Re-Injection (T+10 seconds)

Each downstream module reads the *resulting state*, not the event:

**M09 ProForma:**
- Reads `occupancy_path` and `market_rent_path` from M07
- Computes effective revenue per F49 (burn-off-aware)
- GPR rises slightly, vacancy_loss decreases, EGI gains ~$X per month
- **Does NOT** add a separate "+0.5% rent growth from Amazon event" delta
- The Amazon impact is fully captured in the path values

**M14 Risk:**
- Reads updated Σ from M36 (the sigma matrix has shifted slightly because Tampa's regime probabilities updated)
- Re-runs factor variance attribution
- Demand-side variance contribution shifts because expected_demand_strength is higher
- **Does NOT** apply a separate "demand event risk adjustment"

**M08 Strategy Builder:**
- Reads `expected_demand_strength = 0.72` from M07
- Reads observed_demand_intensity from current symptoms: C_SURGE_INDEX shows search volume only modestly elevated (announcement was 1 minute ago; symptom hasn't materialized yet); observed_demand_intensity = 0.58
- Computes ratio = 0.58 / 0.72 = 0.81 → validation_factor = 0.85
- DemandScore = 0.72 × 0.85 = 0.61
- State: **Hidden Gem** (high expected, observed not yet materialized)
- Strategy Builder flags: "Demand expectation rises post-Amazon-announcement. Observed activity has not yet caught up; expect symptom confirmation over next 4-12 weeks. Score will likely climb if validation materializes."

**M25 JEDI Score:**
- Reads M08's updated DemandScore
- Recomputes composite. JEDI Score for Tampa multifamily deals lifts modestly.
- **Does NOT** apply a separate Amazon adjustment.

**M37:**
- Adds the Amazon event to analog library for future cross-market queries
- A future deal in Charlotte asking "how would a 2,500-job tech announcement affect us?" can now use Tampa-Amazon as one of its analogs

**M38:**
- Logs M35's forecast about the Amazon event ("expected occupancy uplift +0.8 to +2.0pp by month 18")
- Schedules realization pairing for month 18 against actual Tampa occupancy
- This becomes a Prediction record that will be validated against future Realizations

### 5.5 Symptom Materialization (T+4 weeks)

Four weeks pass. Search volume for Tampa rentals has surged. C_SURGE_INDEX rises to 1.4σ above baseline. Lead volume at Tampa multifamily comp set is up 32%.

**M07 reprocesses:** observed_demand_intensity rises to 0.78. expected_demand_strength is still ~0.72. Ratio = 0.78 / 0.72 = 1.08 → validation_factor = 1.0 (normal confirmation).

**M08 updates:** DemandScore = 0.72 × 1.0 = 0.72. State transitions from **Hidden Gem** to **Confirmed Strong**.

Note that the surge index didn't *add* to the demand score — it *validated* it. The score moved from 0.61 (Hidden Gem with discount) to 0.72 (Confirmed at expected strength). The gain came from removing the validation discount, not from adding the surge as independent evidence.

This is exactly the right behavior. The Amazon event is the cause; the surge is the symptom. Treating them additively would have produced a DemandScore inflated to 0.85+ (combining 0.72 from the event plus extra weight from the surge) — over-counting the same underlying signal.

### 5.6 Regime / Counterfactual Variations

The same event in a *tight-supply* Tampa would produce different paths from M07: occupancy is already near 95%, so demand flows almost entirely to rent. market_rent_path lifts more sharply; occupancy_path barely moves. expected_demand_strength rises higher because the same demand has nowhere to absorb except prices. DemandScore is higher.

The same event in a *late-cycle contraction* regime: M37 analog matches restrict to late-cycle analogs only. Historical impacts in late-cycle are smaller and slower (capital is more cautious about responding to good news). M07 produces a more muted projection. expected_demand_strength rises only modestly. DemandScore reflects the regime-conditional reality.

Both variants flow through the *same architecture*. The behavior changes; the wiring doesn't.

### 5.7 Validation Against Realization (T+18 months)

Eighteen months later, M22 records actual Tampa multifamily metrics:
- Realized occupancy: 94.6% (M35 had forecast 94.8% with 80% CI [93.9, 95.7])
- Realized rent growth: 3.55% (forecast 3.7% with 80% CI [3.0, 4.4])

Both within the 80% CI. M38 logs a Pairing record. Cashflow Agent's calibration metrics update modestly (slight overprediction on occupancy, slight overprediction on rent — both within calibrated bounds).

Over many such pairings, M38's reliability diagrams stabilize. M37's bandwidths get refined. Structural premiums in M36 macro anchors get recalibrated. The system's reliability is *measured*, not assumed.

---

## 6. Spec Updates Required

The two invariants pin down behavior that's underspecified in the existing spec library. Concrete updates:

### 6.1 M35 Event Impact Engine Spec Updates

Add Section 4.X — *Primary Channel Declaration*:
- Every event subtype must declare a `primary_channel` value
- Channel values are from a fixed enum: `M07_traffic | M09_proforma_direct | M03_devcap | M14_macro | multi_channel`
- For `multi_channel`, list the specific channels and the causal pathway each represents

Add Section X.Y — *Subscriber Policy Enforcement*:
- Kafka subscription policy validates allowed/forbidden subscribers per event subtype
- Deployment-time policy check blocks deployments that violate channel routing
- Reference table of allowed subscribers per primary_channel value

### 6.2 M07 Traffic Engine Spec Updates

Add Section 3.X — *Expected State Outputs*:
- M07 emits `expected_demand_strength` and `expected_supply_pressure` scalars in the [0, 1] range
- These are forward-looking projections built from cause inputs only
- Used by M08 Strategy Builder as the Expected component of multiplicative scoring

Add Section 4.Y — *Market-Clearing Logic*:
- Pin the explicit logic that splits demand response between occupancy and rent
- Below ~94% occupancy: demand absorbs primarily into occupancy gains
- Above ~94% occupancy: demand flows primarily to rent
- Smooth transition curve, not a hard threshold
- Document the regime-dependence: tight-supply regimes shift threshold lower; loose-supply regimes shift it higher

### 6.3 M08 Strategy Builder Spec Updates

Replace Section X — *Sub-Score Composition*:
- Each sub-score (Demand, Supply, Momentum, Position, Risk) has Expected and Observed tracks
- Expected built from causes routed through M07/M36
- Observed built from symptom aggregation
- Composition is multiplicative: `Score = Expected × validation_factor`
- validation_factor bounded [0.7, 1.3] per the function in Section 4.3
- Quadrant states (Hidden Gem, Frothy, etc.) emitted as discrete classifications

Add Section Y — *Cause/Symptom Classification Table*:
- Definitive registry of which metrics are causes vs symptoms
- Each platform metric carries a `category: 'cause' | 'symptom' | 'state'` field
- Causes route through M07; symptoms flow to M08 via observation aggregation

### 6.4 M36 Joint Distribution Engine Spec Updates

Add Section X — *Discrepancy Anomaly Detection*:
- M36's anomaly detector extends to flag persistent expected-vs-observed discrepancies
- A market with sustained Hidden Gem state (4+ weeks) emits `sigma.discrepancy_detected` Kafka
- M35 receives this as candidate "unidentified event" — feeds back into news extraction system

### 6.5 Wiring Update Spec Updates

Add to the Recomputation Cascade sheet:
- New trigger: `traffic.expected_state_updated` (M07 → M08)
- Modified subscribers per event topic to reflect channel-routing forbidden lists

Add new sheet — *Channel Routing Policy*:
- Per-event-subtype primary_channel declarations
- Allowed/forbidden subscribers per channel
- Validation rules for deployment policy

Update Data Contracts:
- DC-07 ProFormaHandoff adds `expected_demand_strength` and `expected_supply_pressure` fields
- New DC-XX: M07 → M08 expected state contract
- New DC-XX: M36 → M35 discrepancy anomaly contract

### 6.6 Cashflow Agent Prompt Updates

Add to the agent's prompt:

```
Channel routing: When proposing assumptions affected by demand or supply events,
read the impact through the M07 occupancy_path and market_rent_path outputs.
DO NOT separately reference event impacts when justifying rent growth or 
vacancy assumptions — those impacts are already in the path. Reference the path,
the underlying event(s), and the analog evidence (via M37). Reference the 
event directly only when the channel is M09_proforma_direct (rent control, 
tax abatement) or M14_macro (rate moves).

Cause/symptom: When discussing market state, distinguish between projected 
demand/supply strength (Expected, from causes) and observed market activity 
(symptoms). When these agree, state confidence. When they diverge, name the 
quadrant state explicitly (Hidden Gem, Frothy, Hidden Distress, Resilient 
Absorption) and what the implication is for underwriting.
```

---

## 7. The Discrepancy Feedback Loop

The cause/symptom split creates a powerful feedback loop that closes back to the news extraction system in Section 1.

When a market shows persistent Hidden Gem state (high expected demand from observable causes, but observed symptom activity doesn't match), there are three possibilities:

1. **Lag effect.** Symptoms haven't materialized yet. Resolves over weeks.
2. **Demand leak.** Demand exists but is flowing to a different market or asset class than expected. Diagnosable by checking adjacent markets.
3. **Missing cause.** A real driver is suppressing what would otherwise be observable demand. The model doesn't know about it because the news extraction system didn't capture it.

Persistent Frothy state has a mirror set:

1. **Anticipatory.** Symptoms reflect anticipated demand from causes the market knows about but the model hasn't captured. Causes will surface in news soon.
2. **Speculative.** Symptoms reflect activity that won't be sustained. Diagnosable by checking whether sentiment is broad-based or narrow.
3. **Missing cause.** A real positive driver exists that the model doesn't know about.

In all three cases of Hidden/Frothy with "missing cause" suspected, the system should be *actively looking* for the cause. M36's discrepancy anomaly detector emits `sigma.discrepancy_detected` Kafka. The news extraction system subscribes — this is its prompt to look harder at sources covering that market for events the standard pipeline missed.

This is the feedback loop that makes the news extraction system *get better* over time. It's not just classifying news; it's getting tasked with specific markets where the model believes events are happening that it hasn't yet identified. Editorial guidance from the structural model.

---

## 8. Why These Invariants Together Are Sufficient

The two invariants jointly close the loop on double-counting. Each addresses a distinct failure mode:

**Channel routing** prevents the *same event* from being injected at multiple downstream consumers. Without it, an event flows through M07 *and* directly to M09 *and* directly to M14, and the deal model triple-counts.

**Cause/symptom separation** prevents *the same effect of an event* from being counted as multiple independent signals. Without it, the Strategy Builder weights the Amazon announcement and the Amazon-induced search surge as if they were independent demand evidence.

Either invariant alone is insufficient. Channel routing without cause/symptom separation: events flow correctly through M07, but M08 still sums cause variables and symptom variables additively, double-counting at the score level. Cause/symptom separation without channel routing: M08 composes correctly, but M09 still receives separate event-driven assumption deltas, double-counting at the proforma level.

Together they make the system coherent. Every event has a single point of injection (channel routing). The downstream effects propagate through state, not through duplicate event flows. Strategy scores integrate causes and symptoms multiplicatively, treating them as different views of the same underlying signal rather than independent evidence.

After applying both invariants, the deal-level math has the property: **for any event, the total impact on JEDI Score, IRR distribution, and strategy classification is what the analog evidence supports — no more, no less.** That property is what makes the system trustworthy at the institutional level, where systematic optimistic bias of even 50bps per deal is fatal to track record over a portfolio.

---

## 9. What Could Still Go Wrong

Two failure modes survive even with both invariants applied. Worth flagging so they're handled explicitly.

**Indirect double-counting through correlated metrics.** Two metrics that are heavily correlated but classified separately can still inflate scores. If C_SURGE_INDEX and search_volume_momentum both load on the same underlying observed-demand factor (which they do), summing them in the symptom aggregation double-counts the same signal. The fix: factor-aggregate symptoms via M36's factor model rather than weight-and-sum. Aggregate at the factor level, not the metric level. This is a Phase 2 refinement; the metric-level aggregation is acceptable for launch.

**Channel-rule bypass via "stale" reads.** A module that *reads* state-after-event but caches it staleness-permissive could mix old state (pre-event) with new event injections elsewhere. The fix: cache invalidation on Kafka triggers. Already specified in the wiring update's Recomputation Cascade. Worth re-emphasizing: stale reads break channel routing.

Both failure modes are addressable with discipline on the existing infrastructure; neither requires architectural revision.

---

## 10. Summary

Two invariants. Stated formally:

> **Invariant A (Channel Routing):** Every event has a single primary channel of impact. Events flow through their primary channel only. Downstream effects appear via cross-module integration; never via parallel event injection.

> **Invariant B (Cause/Symptom Separation):** Strategy scores compose multiplicatively from a projected component (built from causal inputs) and a validation component (built from symptom observations). Causes and symptoms are never additively combined as independent evidence.

Enforced at the wiring layer via Kafka subscription policy. Surfaced in the user experience via quadrant state badges (Hidden Gem, Frothy, Confirmed Strong, etc.). Calibrated empirically via M38. Audited end-to-end via the Amazon-3000-jobs example in Section 5.

These two invariants are what make the previously-specced JEDI Triangulation framework operationally correct under integration. M36, M37, M38, M07, and M08 each work in isolation. Channel routing and cause/symptom separation are what makes them work *together*.

---
