# Calibration Ledger — Platform-Wide Prediction Backtesting and Drift Detection

**Module ID:** M38 (logical module; functionally an extension of M35)
**Spec relationship:** Addendum to `Event_Impact_Engine_Spec.md`. Extends M35's Phase 5 backtest framework from "event-impact forecasts only" to "every prediction the platform emits."
**Status:** Implementation-grade

**Why an addendum, not a standalone spec.** M35 already specifies a backtest runner, calibration metrics, and confidence refinement (Phases 5–6 of the M35 spec). The data structures it defines for event impacts (forecast + realized + measurement_method + confidence) generalize naturally to *any* prediction with a stated uncertainty bound. Rather than duplicate that infrastructure, this addendum extends it — same tables (with additions), same Kafka patterns, same backtest cadence. The "M38" module ID exists so the wiring blueprint and Module Registry have a coherent referent; mechanically it's M35-extended.

---

## 1. The Gap This Closes

After M36 and M37 ship, the platform emits prediction intervals constantly:

- **Cashflow Agent** emits per-assumption intervals: "rent_growth 4.0%, 80% CI [2.8%, 5.4%]"
- **M37** emits analog forecasts with stated CIs and effective sample sizes
- **M36** emits plausibility scores ("d = 1.4, Stretch")
- **M14** emits IRR distributions from Monte Carlo
- **M07** emits occupancy paths and market rent paths with CIs
- **M25** emits JEDI Score with confidence intervals
- **M35** emits event impact forecasts (already-specced backtest case)

Every one of these claims something measurable about the future. None of them, as currently specced, has a feedback loop that asks: *was the claim accurate?* M35's backtest framework asks this for event impacts. The Calibration Ledger asks it for everything else.

The specific gap is twofold.

**First, calibration is what makes prediction intervals useful.** A claim like "80% CI [2.8%, 5.4%]" is meaningful only if it captures realizations 80% of the time. If the 80% intervals only capture 50% of realizations, the platform is overconfident and every IRR distribution downstream is too narrow. If they capture 95%, it's underconfident and risk-attribution stories are exaggerated. Without measurement, neither failure mode is detectable. The 464 Bishop test exposed this implicitly — when the other Claude said "compressing 100bps is aggressive," there was no historical track record of agent reliability backing that claim.

**Second, drift detection prevents silent degradation.** A platform that was well-calibrated in expansion becomes overconfident in late-cycle as variance regimes shift. Agents trained on 2018-2023 data drift on 2024-2026 reality. Without continuous calibration tracking, this degradation is invisible until users notice their deals don't perform like the platform predicted — at which point trust is already gone.

The Calibration Ledger closes both gaps with one infrastructure: a persistent record of every prediction, paired with realized outcomes as they accumulate, scored continuously, with drift alerts when accuracy degrades.

---

## 2. Architectural Position

```
                ┌──────────────────────────────────────────────┐
                │  PREDICTION-EMITTING MODULES                  │
                │  M35  M36  M37  M14  M25  M07  M09  Agents    │
                │  (every emission writes a Prediction record)  │
                └──────────────────┬───────────────────────────┘
                                   │ predictions.emitted
                                   ▼
                ┌──────────────────────────────────────────────┐
                │  M38 CALIBRATION LEDGER                       │
                │                                              │
                │  • Prediction journal                        │
                │  • Realization pairing engine                │
                │  • Reliability diagram computation           │
                │  • CI multipliers + bias correction factors  │
                │  • Drift detection                           │
                │  • Stratified scoring (agent × class ×       │
                │    regime × metric × source)                 │
                └──────┬─────────────┬────────────┬────────────┘
                       │             │            │
            ┌──────────▼─┐    ┌──────▼─────┐  ┌──▼─────────────┐
            │ M22 Actuals│    │ Ext. data  │  │ User feedback  │
            │ post-close │    │ FRED/RentCast│ │ disagreements  │
            │            │    │ for market │  │                │
            │            │    │ realizations│ │                │
            └────────────┘    └────────────┘  └────────────────┘
                       
                                   │ calibration.* topics
                                   ▼
                ┌──────────────────────────────────────────────┐
                │  CONSUMERS OF CALIBRATION OUTPUT              │
                │                                              │
                │  • Cashflow Agent: CI widening per metric    │
                │  • M14 Risk: CI multipliers on distributions │
                │  • M37: bandwidth recalibration trigger      │
                │  • M36: regime-shift candidate signals       │
                │  • UI: confidence badges, drift dashboard    │
                └──────────────────────────────────────────────┘
```

**Key principle:** Predictions are *immutable* once emitted. A prediction journal entry from January 2026 is never edited. When realizations come in, they create new pairing records. This invariant is what makes the calibration ledger auditable — you can always reconstruct what the platform predicted and when, separately from what actually happened.

---

## 3. The Prediction Ledger Data Model

Every prediction the platform emits is a tuple. The tuple shape is uniform across modules; the source field distinguishes who emitted it.

### 3.1 The Prediction Record

```typescript
type Prediction = {
  prediction_id: UUID,
  emitted_at: timestamp,
  source: {
    module: 'M35' | 'M36' | 'M37' | 'M14' | 'M25' | 'M07' | 'M09' | 'cashflow_agent' | ...,
    version: string,                // module/agent version for tracking changes
    deal_id?: UUID,                  // optional; deal-specific predictions
    submarket_id?: string,           // optional; market-level predictions
  },
  metric: string,                    // canonical metric ID (e.g., 'rent_growth_yoy')
  asset_class: string,
  regime_at_prediction: string,      // captured at emission for stratification
  
  // The prediction itself — supports multiple shapes
  prediction_type: 'point_with_ci' | 'distribution' | 'classification',
  point_estimate?: number,
  ci_levels?: [{ level: number, low: number, high: number }],   // e.g., 80% CI
  distribution_summary?: {            // for full distributions (M14 Monte Carlo)
    p10: number, p50: number, p90: number, p99?: number
  },
  classification?: {                  // for plausibility bands etc.
    band: string, confidence: number
  },
  
  // The horizon at which the prediction can be evaluated
  realization_horizon_months: number,
  realization_target_date: timestamp,    // emitted_at + horizon
  
  // Context for stratification and joining
  context: {
    rationale_summary?: string,         // optional; for audit
    upstream_prediction_ids?: UUID[],   // chain of predictions (e.g., M37 → agent)
    underlying_assumptions?: object,    // for assumption-set predictions
  },
  
  superseded_by?: UUID,                  // if a later prediction replaces this one
  superseded_at?: timestamp,
}
```

**Three prediction shapes** because the platform emits qualitatively different kinds of predictions:

`point_with_ci` — the most common. M37 forecasts, agent assumptions, M07 paths.
`distribution` — M14 Monte Carlo IRR, M09 stress test results. Captured as percentile summaries.
`classification` — M36 plausibility bands, regime classifications. Calibrated as probabilistic claims about category membership.

### 3.2 The Realization Record

```typescript
type Realization = {
  realization_id: UUID,
  recorded_at: timestamp,
  metric: string,                    // matches prediction.metric
  scope: {                           // for joining to predictions
    deal_id?: UUID,
    submarket_id?: string,
    asset_class?: string,
  },
  observation_date: timestamp,       // when the value was observed (not recorded)
  observed_value: number,
  observation_source: 'M22_actuals' | 'rentcast' | 'fred' | 'bls' | 'user_correction' | ...,
  measurement_uncertainty?: number,   // optional; if the observation itself has noise
}
```

Realizations come from three streams:
1. **M22 post-close actuals** — for deal-specific predictions (deal_monthly_actuals table)
2. **External market data** — for market-level predictions (RentCast, FRED, BLS, etc.)
3. **User corrections** — when user flags a prediction as wrong and provides the correct value

### 3.3 The Pairing Record

The pairing is what joins predictions to realizations and produces the calibration data point.

```typescript
type Pairing = {
  pairing_id: UUID,
  prediction_id: UUID,
  realization_id: UUID,
  paired_at: timestamp,
  
  // Computed fields
  point_error: number,               // observed - point_estimate
  ci_captured: { level: number, captured: boolean }[],   // for each stated CI level
  log_likelihood?: number,           // if distribution shape is parametric
  brier_score?: number,              // for classification predictions
  
  pairing_quality: 'high' | 'medium' | 'low',     // matched scope precision
  notes?: string,
}
```

Pairing logic runs nightly. Walks the prediction journal, finds predictions whose `realization_target_date` has passed, queries realizations matching the prediction's metric and scope, computes the pairing fields. Pairing quality reflects how exact the scope match is — a deal-level prediction paired with deal-specific actuals is `high`; paired with submarket averages because deal actuals weren't recorded yet is `low`.

---

## 4. Reliability Diagrams and Calibration Math

For each stratum (specified in §5), compute a reliability diagram and summary calibration scores.

### 4.1 Reliability Diagram for Continuous Predictions

For predictions with stated CI levels, the reliability diagram plots:
- **x-axis:** stated probability level α (e.g., 0.50, 0.80, 0.90, 0.95)
- **y-axis:** empirical capture rate (fraction of pairings where realization fell within CI_α)

Perfect calibration: diagonal line `y = x`.

Above diagonal (capture > stated): underconfident — CIs are wider than they need to be.
Below diagonal (capture < stated): overconfident — CIs too narrow, claiming more precision than warranted.

```
For each stratum S, for each stated level α in {0.50, 0.80, 0.90, 0.95}:
  pairings_S = predictions in S with realizations
  captured_α = count(pairing where realization ∈ CI_α(prediction)) / |pairings_S|
  reliability_score(S, α) = |captured_α - α|   // lower = better calibrated
```

A summary scalar across all α levels:

```
overall_reliability(S) = mean over α of |captured_α - α|
```

Below 0.05 → well-calibrated. 0.05–0.10 → acceptable. > 0.10 → miscalibrated, requires correction.

### 4.2 Sharpness

Calibration alone isn't enough. A 99% CI of [-∞, +∞] is perfectly calibrated but useless. Sharpness measures CI width:

```
sharpness(S) = mean over pairings of (ci_high - ci_low) at α = 0.80
```

Lower sharpness = tighter intervals = more useful predictions. The trade-off: tightening sharpness usually degrades calibration. Track both; the goal is the Pareto frontier.

### 4.3 Bias

Systematic over- or under-prediction in the point estimate:

```
bias(S) = mean over pairings of (point_estimate - observed_value)
```

Positive = over-predicts. Negative = under-predicts. For unbiased predictions, |bias| should be small relative to typical CI width.

### 4.4 Brier Score (for Classification Predictions)

For M36 plausibility classifications and similar discrete predictions:

```
brier(S) = mean over pairings of (predicted_probability - outcome_indicator)²
```

Outcome indicator = 1 if classification was correct, 0 if not. Lower is better; perfect classifier scores 0.

### 4.5 Continuous Ranked Probability Score (for Distributions)

For full distribution predictions (M14 Monte Carlo), CRPS generalizes Brier to continuous outcomes:

```
CRPS(F, y) = ∫ (F(z) - 1{y ≤ z})² dz
```

Where F is the predicted CDF and y is the realized value. Computed via percentile sampling for distributions stored as percentile summaries.

---

## 5. Stratification

Calibration tracking is meaningful only when stratified appropriately. Pooling all predictions across asset classes and regimes washes out the variation that matters.

### 5.1 The Five-Dimensional Tensor

```
Strata = source × metric × asset_class × regime × horizon
```

- **source:** module or agent emitting the prediction (M37, Cashflow_Agent_v2, M14, etc.)
- **metric:** canonical metric (rent_growth_yoy, vacancy_rate, irr, etc.)
- **asset_class:** multifamily, office, industrial, retail, hospitality, mixed
- **regime:** expansion, late_cycle, contraction (or HMM-soft probabilities)
- **horizon:** short (≤12mo), medium (12–36mo), long (>36mo)

### 5.2 Sparsity Handling

The full tensor has thousands of cells. Most will be empty or near-empty. Bayesian hierarchical shrinkage borrows strength across dimensions:

```
reliability(s, m, c, r, h) =
  λ_full · reliability_observed(s, m, c, r, h)
  + λ_marginal_metric · reliability_observed(*, m, *, *, *)
  + λ_marginal_source · reliability_observed(s, *, *, *, *)
  + (1 - λ's) · reliability_global(*, *, *, *, *)

with λ values increasing with sample size in each margin.
```

When a specific cell has < 10 pairings, the estimate is dominated by marginals. Once it accumulates 50+ pairings, the cell-specific data takes over. The Empirical Bayes shrinkage factors are computed monthly during the recalibration cycle.

### 5.3 Reporting Granularity

Different consumers need different stratification:
- **Agent prompt augmentation** (DC-14): per-source × per-metric × per-asset_class × per-regime
- **UI confidence badges**: per-metric only
- **Admin drift dashboard**: full 5D tensor with drill-down
- **M37 bandwidth recalibration**: per-metric × per-asset_class

API endpoints expose each granularity directly without requiring consumers to re-aggregate.

---

## 6. CI Adjustment and Bias Correction

When a stratum is miscalibrated, the Calibration Ledger emits correction factors that downstream modules apply.

### 6.1 CI Widening Factor

For a stratum with reliability_score(S, 0.80) = 0.65 (i.e., 80% CIs only capture 65% of realizations):

```
ci_widening_factor(S) = z_score(0.80) / z_score(0.65)
                     = 1.282 / 0.674
                     = 1.90
```

Downstream modules multiply CI half-widths by this factor:

```
adjusted_ci_low  = point - (point - original_ci_low) × widening_factor
adjusted_ci_high = point + (original_ci_high - point) × widening_factor
```

### 6.2 Bias Correction

For a stratum with persistent positive bias (over-predicts by 0.4 percentage points on rent_growth):

```
adjusted_point = original_point - bias(S)
```

Applied at the agent prompt level — the agent sees "your historical bias on this metric is +0.4pp; reduce your point estimate by that amount before emitting" — rather than at the consumption level. This makes bias correction transparent to downstream consumers and visible in the agent's rationale.

### 6.3 Application Hierarchy

Multiple consumers may apply corrections at different layers. To avoid double-correction:

1. **Source-level correction** (preferred): the emitting module applies its own correction before emission. Cashflow Agent reads its calibration profile via DC-14 and self-corrects.
2. **Pipeline-level correction** (backup): if the source doesn't self-correct, M14 or M9 applies correction before consuming.
3. **Display-level correction** (rare): UI applies correction only for visual display when neither of the above happens.

The Pairing record tracks which level applied corrections so we don't apply them twice. New predictions from a corrected source use `version: 'v2_calibrated'` so the calibration ledger doesn't conflate pre- and post-correction performance.

---

## 7. Drift Detection

Calibration is not stationary. Drift detection identifies when a stratum's calibration is degrading, triggering action.

### 7.1 Three Drift Signals

**Reliability drift.** Rolling 90-day reliability_score increases beyond stratum-specific threshold.

```
drift_signal_reliability(S) = max(0, reliability_90day(S) - reliability_baseline(S) - 0.05)
```

**Bias drift.** Rolling 90-day bias drifts away from zero.

```
drift_signal_bias(S) = max(0, |bias_90day(S)| - bias_baseline_threshold(S))
```

**Sharpness/calibration trade-off shift.** A stratum maintaining calibration but with widening CIs (or vice versa) signals an underlying change worth investigating.

### 7.2 Drift Severity Levels

```
severity = 
  'low'      if any drift signal > 0 but all < 1.5× threshold
  'medium'   if any drift signal in [1.5, 2.5]× threshold
  'high'     if any drift signal > 2.5× threshold
```

### 7.3 Actions Per Severity

**Low:** Logged. No automatic action. Surfaced in admin dashboard.

**Medium:** Kafka topic `calibration.drift_alert(severity=medium)` emitted. Subscribers:
- Cashflow Agent: receives updated `ci_widening_factor` in its next CalibrationProfile
- M14: refreshes its IRR distribution multipliers
- M37: schedules bandwidth recalibration if the affected metric × asset_class match

**High:** All medium actions plus:
- Admin notification (email/Slack)
- Stratum flagged in production: predictions from this stratum carry `confidence: 'low'` flag
- Manual review queue: human-in-the-loop required for any consumer that can't automatically widen CIs

### 7.4 Regime-Change-Triggered Reset

When M36 detects a regime change (Kafka `sigma.regime_change`), the calibration ledger:
1. Snapshots current calibration metrics per stratum (preserves historical record)
2. Resets the rolling 90-day window for affected strata (regime-conditional strata only)
3. Treats predictions in the new regime as initially having marginal-level shrinkage until enough new-regime pairings accumulate

This prevents the calibration ledger from holding agents accountable for predictions made in a different regime than the one currently in force.

---

## 8. Database Schema

```sql
-- Every prediction emitted by any module
CREATE TABLE predictions (
  prediction_id              UUID PRIMARY KEY,
  emitted_at                 TIMESTAMPTZ NOT NULL,
  source_module              VARCHAR(50) NOT NULL,
  source_version             VARCHAR(20) NOT NULL,
  deal_id                    UUID,
  submarket_id               VARCHAR(50),
  metric                     VARCHAR(50) NOT NULL,
  asset_class                VARCHAR(20) NOT NULL,
  regime_at_prediction       VARCHAR(20) NOT NULL,
  prediction_type            VARCHAR(30) NOT NULL,
  point_estimate             FLOAT,
  ci_levels                  JSONB,        -- [{level, low, high}, ...]
  distribution_summary       JSONB,
  classification             JSONB,
  realization_horizon_months INT NOT NULL,
  realization_target_date    TIMESTAMPTZ NOT NULL,
  context                    JSONB,
  superseded_by              UUID REFERENCES predictions(prediction_id),
  superseded_at              TIMESTAMPTZ,
  
  CONSTRAINT prediction_shape_one_of CHECK (
    (point_estimate IS NOT NULL) OR
    (distribution_summary IS NOT NULL) OR
    (classification IS NOT NULL)
  )
);

CREATE INDEX idx_pred_target_date ON predictions(realization_target_date)
  WHERE superseded_by IS NULL;
CREATE INDEX idx_pred_scope ON predictions(metric, asset_class, deal_id, submarket_id);
CREATE INDEX idx_pred_source ON predictions(source_module, source_version, emitted_at);

-- Realized outcomes
CREATE TABLE realizations (
  realization_id           UUID PRIMARY KEY,
  recorded_at              TIMESTAMPTZ NOT NULL,
  metric                   VARCHAR(50) NOT NULL,
  deal_id                  UUID,
  submarket_id             VARCHAR(50),
  asset_class              VARCHAR(20),
  observation_date         TIMESTAMPTZ NOT NULL,
  observed_value           FLOAT NOT NULL,
  observation_source       VARCHAR(50) NOT NULL,
  measurement_uncertainty  FLOAT
);

CREATE INDEX idx_real_obs_date ON realizations(observation_date, metric);
CREATE INDEX idx_real_scope ON realizations(metric, asset_class, deal_id, submarket_id);

-- Joined pairings (one per prediction-realization match)
CREATE TABLE pairings (
  pairing_id        UUID PRIMARY KEY,
  prediction_id     UUID NOT NULL REFERENCES predictions(prediction_id),
  realization_id    UUID NOT NULL REFERENCES realizations(realization_id),
  paired_at         TIMESTAMPTZ DEFAULT now(),
  point_error       FLOAT,
  ci_captured       JSONB,                  -- [{level, captured}, ...]
  log_likelihood    FLOAT,
  brier_score       FLOAT,
  crps              FLOAT,
  pairing_quality   VARCHAR(10),
  notes             TEXT,
  
  UNIQUE (prediction_id, realization_id)
);

CREATE INDEX idx_pair_prediction ON pairings(prediction_id);

-- Computed reliability stats per stratum (refreshed monthly)
CREATE TABLE reliability_stats (
  stat_id           UUID PRIMARY KEY,
  computed_at       TIMESTAMPTZ DEFAULT now(),
  stratum_source    VARCHAR(50),
  stratum_metric    VARCHAR(50),
  stratum_class     VARCHAR(20),
  stratum_regime    VARCHAR(20),
  stratum_horizon   VARCHAR(20),
  n_pairings        INT NOT NULL,
  captured_50       FLOAT,
  captured_80       FLOAT,
  captured_90       FLOAT,
  captured_95       FLOAT,
  reliability_score FLOAT,
  sharpness         FLOAT,
  bias              FLOAT,
  brier_score       FLOAT,
  crps              FLOAT,
  shrinkage_weight  FLOAT,
  is_active         BOOLEAN DEFAULT true,
  
  UNIQUE (stratum_source, stratum_metric, stratum_class, stratum_regime, stratum_horizon, computed_at)
);

CREATE INDEX idx_stats_active ON reliability_stats(stratum_source, stratum_metric, stratum_class, stratum_regime)
  WHERE is_active = true;

-- CI widening + bias correction factors (derived from reliability_stats)
CREATE TABLE calibration_factors (
  factor_id              UUID PRIMARY KEY,
  computed_at            TIMESTAMPTZ DEFAULT now(),
  stratum_source         VARCHAR(50),
  stratum_metric         VARCHAR(50),
  stratum_class          VARCHAR(20),
  stratum_regime         VARCHAR(20),
  ci_widening_factor     FLOAT,             -- multiplier on CI half-width
  bias_correction        FLOAT,             -- subtractive correction on point estimate
  confidence_label       VARCHAR(20),       -- 'high' | 'medium' | 'low' for UI badges
  effective_from         TIMESTAMPTZ NOT NULL,
  effective_until        TIMESTAMPTZ,
  
  UNIQUE (stratum_source, stratum_metric, stratum_class, stratum_regime, effective_from)
);

-- Drift alerts
CREATE TABLE drift_alerts (
  alert_id            UUID PRIMARY KEY,
  detected_at         TIMESTAMPTZ DEFAULT now(),
  stratum_source      VARCHAR(50),
  stratum_metric      VARCHAR(50),
  stratum_class       VARCHAR(20),
  stratum_regime      VARCHAR(20),
  signal_type         VARCHAR(30),         -- 'reliability' | 'bias' | 'sharpness'
  signal_value        FLOAT,
  baseline_value      FLOAT,
  threshold           FLOAT,
  severity            VARCHAR(10),
  status              VARCHAR(20) DEFAULT 'open',  -- 'open' | 'acknowledged' | 'resolved'
  resolution_notes    TEXT
);

-- User feedback signals
CREATE TABLE user_feedback (
  feedback_id           UUID PRIMARY KEY,
  prediction_id         UUID REFERENCES predictions(prediction_id),
  user_id               UUID,
  flagged_at            TIMESTAMPTZ DEFAULT now(),
  feedback_type         VARCHAR(30),       -- 'wrong' | 'too_aggressive' | 'too_conservative' | 'unclear'
  user_provided_value   FLOAT,             -- optional; user's correct value
  rationale             TEXT
);
```

---

## 9. API Endpoints

```
# Prediction emission (called by every module on every emission)
POST /api/calibration/predictions
     body: { source, metric, asset_class, regime, prediction_type, point_estimate?, ci_levels?, ... }
     → { prediction_id }

# Realization ingestion
POST /api/calibration/realizations
     body: { metric, scope, observation_date, observed_value, observation_source }
     → { realization_id }

# Pairing engine
POST /api/calibration/pair
     body: { since? }
     → { pairings_created: int }

# Reliability + calibration retrieval
GET /api/calibration/reliability
    ?source=&metric=&asset_class=&regime=&horizon=
    → ReliabilityStats[]

GET /api/calibration/factors
    ?source=&metric=&asset_class=&regime=
    → CalibrationFactors

# Per-agent calibration profile (consumed by Cashflow Agent — DC-14)
GET /api/calibration/profile
    ?source=cashflow_agent&version=&asset_class=&regime=
    → CalibrationProfile { per_metric_reliability[], drift_alerts[] }

# Drift alerts
GET /api/calibration/drift
    ?since=&severity=&status=
    → DriftAlert[]

POST /api/calibration/drift/:id/acknowledge
     body: { resolution_notes }
     → DriftAlert (updated)

# User feedback
POST /api/calibration/feedback
     body: { prediction_id, feedback_type, user_provided_value?, rationale? }
     → { feedback_id }

# Reliability diagram data (for UI rendering)
GET /api/calibration/diagram
    ?source=&metric=&asset_class=&regime=
    → ReliabilityDiagram { points: [{stated, captured}], n_pairings }
```

**Kafka topics:**
- `predictions.emitted` — every prediction logged (high volume; partition by source)
- `realizations.recorded` — observations ingested
- `pairings.created` — nightly pairing batch results
- `calibration.drift_alert` — drift detected (subscribers: Cashflow Agent, M14, M37, admin)
- `calibration.factors_updated` — new CI multipliers / bias corrections published
- `feedback.disagreement` — user-flagged predictions

---

## 10. Integration with Existing Modules

### 10.1 M35 Event Impact Engine

M35's existing Phase 5 backtest framework is the prototype this addendum generalizes. Concretely:

- M35's `event_impacts` table conceptually merges into the unified `predictions` + `realizations` + `pairings` schema. M35 emits Predictions when it forecasts impacts; M35's measurement of realized impacts becomes Realizations.
- M35's `playbook.updated` Kafka becomes a downstream consumer of `pairings.created` for events.
- M35-specific reliability statistics live in the unified `reliability_stats` table with `stratum_source = 'M35'`.

### 10.2 Cashflow Agent

Per `DC-14` in the wiring update, the agent fetches a `CalibrationProfile` on each invocation. The profile contains:
- Per-metric reliability scores for the agent's version × asset_class × regime
- CI widening factors to apply
- Bias correction values to apply
- Drift alerts that may affect this prediction context

The agent's prompt augmentation reads (consolidating with §6.3 in M37 and §9.7 in M36):

```
CalibrationProfile for [agent_version] × [asset_class] × [regime]:
- rent_growth_yoy: reliability=0.91, ci_widening=1.10, bias=+0.002
- vacancy_rate: reliability=0.83, ci_widening=1.35, bias=-0.005
- exit_cap_rate: reliability=0.78, ci_widening=1.50, bias=+0.0003 [DRIFT_ALERT: medium]

Apply ci_widening to your stated CI half-widths. Apply bias correction to point estimates.
For metrics with drift alerts, mark confidence as 'low' in your output and explicitly note the drift in rationale.
```

### 10.3 M37 Cross-Market Analog Engine

M37's bandwidth recalibration trigger (per M37 §11 Q7) listens to `calibration.drift_alert` for strata matching `(metric, asset_class)`. A medium-or-higher drift alert schedules a bandwidth optimization run.

### 10.4 M36 Joint Distribution Engine

M36 receives drift signals as candidate evidence of regime instability. Specifically:
- High drift across many strata simultaneously → likely regime shift; M36 schedules HMM re-classification with shorter window
- Drift confined to one metric → likely metric-specific issue, not regime; M36 takes no action

### 10.5 M14 Risk Module

M14 multiplies its IRR distribution CIs by the calibration ledger's stratum-appropriate `ci_widening_factor` before emission. This is the "CI propagation through ProForma" gap from earlier — the calibration ledger provides the empirical correction that makes M14's distributions trustworthy.

### 10.6 UI

Confidence badges throughout the platform pull from `confidence_label` in the calibration_factors table. A deal's JEDI Score shows a confidence indicator that reflects the worst-case stratum across the assumptions feeding into it. The admin drift dashboard exposes the full 5D reliability tensor with drill-down.

### 10.7 M22 Post-Close Intelligence

M22 produces deal-level realizations from the `deal_monthly_actuals` table and pushes them via DC-15 to the calibration ledger. This is the pipe that closes the feedback loop on deal-specific predictions (agent assumptions, M14 risk scores, M25 JEDI Scores).

---

## 11. Implementation Sequence

**Phase 1 — Schema and ingestion (2 sessions)**

1. Database migrations: `predictions`, `realizations`, `pairings`, `reliability_stats`, `calibration_factors`, `drift_alerts`, `user_feedback`.
2. Prediction emission API + client SDK. Modules call into the SDK; SDK posts to `/api/calibration/predictions` and emits Kafka.

**Phase 2 — Backfill from M35 (1 session)**

3. Migrate M35's existing event impact records into the unified Predictions/Realizations/Pairings schema. Validates the schema generalizes from M35's existing case.

**Phase 3 — Realization streams (2 sessions)**

4. M22 actuals → Realizations pipeline. Requires `deal_monthly_actuals` table (M22 critical-path unlock).
5. External market data → Realizations pipeline. RentCast, FRED, BLS scrapers writing to Realizations.

**Phase 4 — Pairing engine + reliability (2 sessions)**

6. Nightly pairing batch. Walks predictions with `realization_target_date < now`, finds matching realizations, creates pairings.
7. Reliability statistics computation. Runs monthly. Populates `reliability_stats` with all five-dimensional cells.

**Phase 5 — Calibration factors + drift (2 sessions)**

8. CI widening + bias correction derivation from reliability_stats. Empirical Bayes shrinkage for sparse cells.
9. Drift detection runner. Rolling 90-day windows. Severity classification. Kafka emission of `calibration.drift_alert`.

**Phase 6 — Consumer integration (3 sessions)**

10. Cashflow Agent CalibrationProfile fetch + prompt augmentation (DC-14).
11. M14 CI multiplier application.
12. M37 bandwidth recalibration trigger wiring.

**Phase 7 — UI + feedback (2 sessions)**

13. Confidence badges throughout deal capsule. Admin drift dashboard.
14. User feedback collection UI ("flag this prediction" flow). Aggregation into calibration adjustment.

**Total: ~14 sessions.**

The critical path is Phase 1 + Phase 2 (3 sessions) — once the ledger is collecting predictions, every subsequent enhancement is incremental. Phases 3-4 unblock the calibration outputs. Phases 5-7 are the consumer-side integrations that make calibration actually affect downstream behavior.

---

## 12. Open Design Questions

**Q1. Backfill of pre-ledger predictions.** Should we attempt to retrofit Predictions records for predictions emitted before the ledger existed (e.g., agent outputs from before this addendum ships)? Recommendation: no. Treat the ledger's start date as the calibration epoch. Pre-ledger predictions are unrecoverable without significant reconstruction effort.

**Q2. Prediction immutability vs supersession.** When a module re-emits a prediction (e.g., agent revises an assumption after user pushback), is the original prediction superseded or kept as separate? Recommendation: superseded with explicit linkage. The original counts as a prediction that was *withdrawn*, not evaluated against realization. Only the final prediction in a chain pairs with realization.

**Q3. Granularity of horizon strata.** Three buckets (short/medium/long) or finer? Recommendation: three buckets initially; reconsider once data accumulates and we can see whether finer buckets reveal meaningful variation.

**Q4. User feedback weighting.** Treat user-flagged "this prediction was wrong" with the same weight as a market-data realization? Recommendation: no. User flags carry weight only when accompanied by `user_provided_value`; otherwise treated as a soft signal that informs admin review but doesn't directly enter pairing math. Users may have biases (fight-back on bad news) that we shouldn't automate into calibration.

**Q5. Calibration of classification predictions.** M36 plausibility bands (Realistic/Stretch/Aggressive/Heroic) need a different validation logic than continuous predictions. Recommendation: outcome indicator = 1 if the realization's per-variable Mahalanobis decomposition matches the band, 0 otherwise. Brier score on this.

**Q6. CI level standardization.** Modules currently emit predictions at different CI levels (M37 80%, M14 90/95%, agents flexible). Should we standardize? Recommendation: emit multiple CI levels per prediction (50, 80, 90) and let consumers pick. Calibration ledger evaluates each level independently. Storage cost minimal.

**Q7. Multi-prediction chains.** When Cashflow Agent's prediction is built from M37's prediction (which is built from M35's measurement), how do we attribute credit/blame? Recommendation: track the chain via `upstream_prediction_ids`. Calibration measures end-to-end accuracy at the agent level (what user sees) but admin can drill into per-link performance to identify which step in the chain is the source of any drift.

**Q8. Survivorship bias.** Predictions for deals that never close don't generate post-close realizations, but those are systematically the deals with worse expected performance. Does this bias the calibration? Recommendation: yes, mildly. Mitigation: market-level realizations (FRED/RentCast) cover the full universe and don't suffer this. Use deal-level realizations only as supplementary evidence with explicit caveat.

---

## 13. Out of Scope

**Causal counterfactual evaluation.** "Would this deal have performed differently with different assumptions?" requires a causal model the platform doesn't have. The ledger measures predictive accuracy, not counterfactual what-ifs.

**Agent retraining loop.** When drift is detected, this addendum specifies CI widening and prompt augmentation as automated responses. Actually retraining or revising the agent's underlying logic is a manual process kicked off by drift severity flags. Auto-retraining is out of scope.

**Cross-platform calibration comparison.** Comparing JEDI's calibration to external benchmarks (CoStar forecasts, broker estimates) would be valuable but requires those benchmarks to be ingested as predictions in the same ledger. Defer.

**Adversarial robustness testing.** Whether the platform's predictions are robust to adversarial inputs is a different concern from whether they're calibrated under typical use.

---

## 14. Why This Matters

The platform without a calibration ledger says "rent growth 4.0%, 80% CI [2.8%, 5.4%]" and the user has to trust that the 80% CI means 80%. The platform with a calibration ledger says "rent growth 4.0%, 80% CI [2.8%, 5.4%], based on 247 paired predictions where the platform's 80% CIs captured 79% of realizations on this metric × asset class × regime." That second claim is *defensible*. It's the difference between asserting calibration and demonstrating it.

For the Cashflow Agent specifically, the calibration ledger is what turns "the agent's job is to underwrite" into "the agent has a measurable track record at underwriting, and that track record adjusts its outputs in real time." Drift detection means a degrading agent is detected before users notice — the ledger sees the calibration loss before the user sees the bad deal.

For the platform as a brand, the calibration ledger is what enables claims like "calibrated underwriting" rather than "AI-powered underwriting." The first is verifiable; the second is marketing. Investors who fund deals will eventually demand the first, and the platform that can produce it wins the institutional segment.

The 464 Bishop test, M36's plausibility scoring, M37's analog forecasts, and this calibration ledger together complete the underwriting reasoning loop. M36 says "is this assumption plausible given history?" M37 says "what do analog markets suggest?" M38 says "and how reliable are our claims about all this, on the historical track record?" That's the full stack. Each one without the others is incomplete; together they are the structural backbone of evidence-based underwriting.

---
