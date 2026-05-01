# Cross-Market Analog Engine — Geographic Transfer Learning for Event Impact Forecasting

**Module:** M37 Cross-Market Analog Engine (new module)
**Status:** Implementation-grade spec
**Relationship to existing modules:**
- **M35 Event Impact Engine** owns the event library and per-subtype playbooks. M37 consumes M35's realized-impact records as the analog pool.
- **M36 Joint Distribution Engine** provides factor loadings, spatial kernel parameters, and regime classifications. M37 uses these to compute similarity between markets.
- **M05 Market Analysis** provides market characteristic vectors (rent levels, demographics, supply pressure) that supplement factor-based similarity.
- **Cashflow Agent** is the primary consumer. Calls M37 for assumption priors with CIs on every reasoning step that involves event-driven forecasts.
- **M06 Demand Signals** receives analog-derived demand forecasts for events without sufficient local history.
- **M09 ProForma Engine** receives analog-calibrated assumption priors that flow into LayeredValue platform layer.
- **M14 Risk Module** receives analog-derived risk distributions for tail-risk estimation.

---

## 1. The Gap This Closes

M35 catalogs events and their realized impacts on metrics. M36 provides the similarity primitives — factor distance, spatial decay, regime conditioning. What's missing is the **bridge**: a service that, given a target market and an event (real or hypothetical), aggregates M35's evidence weighted by M36's similarity to produce a calibrated forecast distribution *for the target market*.

The specific problem M37 solves: **geographic transfer learning**. Tampa has limited Tampa-specific event history. But Tampa shares factor exposure profile with Atlanta, Charlotte, Nashville, Phoenix — and those markets have richer event histories. If you can compute a defensible similarity between Tampa and each of them, you can borrow their realized event impacts weighted by similarity.

Three things M37 enables that the platform cannot do today:

**Forward queries (event → forecast).** "Tampa just got a 5,000-job tech relocation. Based on analog events in similar markets, what's the expected impact on rent growth, traffic, cap rates over 24 months?" Returns a weighted forecast distribution with calibrated CIs.

**Backward queries (market → response distribution).** "Given Charlotte's profile and current regime, what's the rent growth distribution under each event subtype that could plausibly affect this market?" Useful for stress testing and scenario generation in M10.

**Counterfactual queries (hypothetical event in target market).** "If a 2,000-job announcement happened in Jacksonville next month, what's the demand curve?" Useful for goal-seeking with event-conditioned assumptions and for "what should I be watching for?" alerts.

The 464 Bishop test surfaced the gap implicitly. The other Claude reasoned by analogy ("compressing exit cap 50bps is realistic in improving markets") without any formal analog set. M37 is the formal version: not "this seems realistic" but "across 12 analog markets that experienced similar events under similar regimes, exit cap compression of 35-65bps was observed at the 30th-70th percentile."

That's the difference between an LLM gesturing at relevance and a system that can defend its priors.

---

## 2. Architectural Position

```
                ┌─────────────────────────────────────────────┐
                │  CASHFLOW AGENT / RESEARCH AGENT            │
                │  (consumer — calls M37 per assumption)      │
                └──────────────────┬──────────────────────────┘
                                   │ Forward / Backward / Counterfactual
                                   │
                ┌──────────────────▼──────────────────────────┐
                │  M37 CROSS-MARKET ANALOG ENGINE             │
                │                                             │
                │  • Similarity computation                   │
                │    sim(target, analog) =                    │
                │      sim_market × sim_regime × sim_event    │
                │  • Analog ranking + weighting               │
                │  • Weighted forecast aggregation            │
                │  • Effective sample size                    │
                │  • Counterfactual mode                      │
                │  • Confidence calibration (via M38)         │
                └──────┬───────────────────┬──────────────────┘
                       │                   │
            ┌──────────▼─────────┐  ┌──────▼────────────────┐
            │  M35 Event Library │  │  M36 Σ Engine         │
            │  realized impacts  │  │  factor loadings,     │
            │  per event subtype │  │  spatial kernel,      │
            │  per market        │  │  regime classifier    │
            └────────────────────┘  └───────────────────────┘
```

**Key principle:** M37 owns no data. It owns *aggregation logic*. M35 owns events and impacts; M36 owns Σ and factors; M37 reads both and produces forecasts. This keeps the responsibilities clean and means M37 is mostly stateless aside from its ranking-and-weighting cache.

---

## 3. The Similarity Construction

### 3.1 Three Similarity Dimensions

For each candidate analog (market_a with event e_a) against the target (market_t with event e_t, possibly hypothetical), compute three similarity components:

```
sim(target, analog) = sim_market(t, a) × sim_regime(regime_t, regime_a) × sim_event(e_t, e_a)
```

Each component is a kernel in [0, 1]. Their product is the total similarity. Below 0.05 → drop the analog from the pool.

**Market similarity (`sim_market`).** Computed in factor-loading space using M36's loading matrix B:

```
d_factor(t, a) = ‖B_t - B_a‖_2                  (Euclidean distance in factor space)
d_geo(t, a) = drive_time_minutes(t, a)          (only if same MSA cluster relevant)
d_chars(t, a) = ‖chars_t - chars_a‖_W           (weighted Euclidean over market chars)

sim_market = exp(-d_factor/λ_f) · exp(-d_geo/λ_g) · exp(-d_chars/λ_c)
```

The factor distance captures structural similarity (do these markets respond similarly to systematic shocks?). The geographic component is gated — for events with regional contagion (migration, regulatory), drive-time matters; for purely economic events (rate moves, employer announcements), it doesn't. The market characteristics distance covers things factors don't (median rent, demographic profile, supply elasticity).

`d_chars` uses a diagonal weighted norm where weights are calibrated per metric being forecast. Forecasting rent growth weights the rent-tier characteristic heavily; forecasting cap rates weights transaction-volume characteristics heavily.

**Regime similarity (`sim_regime`).** Two regimes can match exactly, partially, or not at all. A simple monotone scoring:

```
sim_regime(r_t, r_a) =
  1.0   if r_t == r_a (both expansion, both late_cycle, etc.)
  0.6   if adjacent (expansion ↔ late_cycle, late_cycle ↔ contraction)
  0.2   if opposite (expansion ↔ contraction)
```

These constants are calibrated empirically once M38 has enough backtest data. Regime probabilities (rather than hard classifications) can be used for soft weighting:

```
sim_regime = Σ_r π_t,r · π_a,r
```

Where π are HMM regime probabilities at the times of the target and analog respectively. Recommended formulation; harder than hard match but more honest about regime uncertainty.

**Event similarity (`sim_event`).** Subtype match is necessary but not sufficient — magnitude and timing matter too:

```
subtype_match = 1 if same M35 subtype, else (0.4 if same category, else 0)
d_magnitude = |log(magnitude_t) - log(magnitude_a)|  (log-scale because magnitudes span orders)
d_timing = |months_since_event_t - months_since_event_a|

sim_event = subtype_match × exp(-d_magnitude/λ_m) × exp(-d_timing/λ_t)
```

The log-scale magnitude treatment is important: a 500-job vs 5,000-job employer announcement is a 10× difference and should attenuate similarity meaningfully, not linearly. The timing component handles the fact that "what happened 6 months after the event" is what we're trying to forecast — so analogs at the same months_since stage are more relevant than analogs that completed years ago.

### 3.2 Bandwidth Calibration

The λ parameters (λ_f, λ_g, λ_c, λ_m, λ_t) determine how aggressively similarity decays with distance. Two approaches:

**Initial defaults** (use until calibration data accumulates):
- λ_f = 1.0 (factor distance in standardized loading space)
- λ_g = 30 minutes (drive-time)
- λ_c = 1.0 (weighted characteristic distance)
- λ_m = 1.0 (log-magnitude)
- λ_t = 6 months (timing offset)

**Empirical calibration** (after ~6 months of M37 operation): use M38 calibration data to choose λ values that minimize forecast error on held-out analogs. Cross-validate by leaving out each analog event in turn, forecasting it from the remaining pool, and comparing to its realized impact. Optimal λ minimizes mean squared error or maximizes log-likelihood under a Gaussian model.

Bandwidths likely differ per metric. λ for forecasting rent growth probably tighter than λ for forecasting transaction velocity (rent growth is more locally idiosyncratic).

### 3.3 Asset-Class Constraint

Hard partition: an industrial event in one market does not inform a multifamily forecast in another. Cross-asset transfer is implausibly noisy and breaks the similarity model.

The pool query first filters by `asset_class == target.asset_class` (or compatible asset class — e.g., garden-style multifamily can pool with mid-rise multifamily under the same factor regime, but multifamily ≠ office). Asset class compatibility table is part of the M37 configuration.

### 3.4 Effective Sample Size

A weighted average of analogs with `n` total analogs but most weight concentrated in 2 of them is *not* a 12-analog forecast — it's effectively a 2-analog forecast. The Kish effective sample size captures this:

```
n_effective = (Σ_i sim_i)² / Σ_i sim_i²
```

When `n_effective < 3`: M37 returns a low-confidence forecast and recommends qualitative interpretation. The returned forecast still has a point estimate (the weighted mean) but the CI is wide and the agent should treat it as directional rather than quantitative.

When `n_effective < 1`: M37 declines to forecast and returns a `NoAnalogsFoundError` with the closest non-matching candidates listed for diagnostic purposes.

---

## 4. Forecast Generation

Given a similarity-weighted analog pool, produce point estimates, variance decomposition, and calibrated confidence bands.

### 4.1 Point Estimate

For a target metric `m` and target horizon `h` months post-event:

```
forecast_mean(m, h) = Σ_i sim_i · realized_i(m, h) / Σ_i sim_i
```

Where `realized_i(m, h)` is the realized impact of analog event `i` on metric `m` at horizon `h`, sourced from M35's measured impacts.

### 4.2 Variance Decomposition

The forecast variance has two components:

**Within-analog uncertainty.** Each analog has its own measurement noise — the realized impact is itself an estimate with uncertainty. M35 provides this as `σ²_i` per impact record (from its difference-in-differences confidence interval).

```
σ²_within = Σ_i sim_i² · σ²_i / (Σ_i sim_i)²
```

**Between-analog disagreement.** Even with perfect measurement, analogs disagree because they're not identical to the target. This is the residual variance after weighting:

```
σ²_between = Σ_i sim_i · (realized_i - forecast_mean)² / Σ_i sim_i
```

**Total forecast variance:**

```
σ²_forecast = σ²_within + σ²_between
```

This decomposition matters for diagnostics. High `σ²_between` with low `σ²_within` means analogs were measured well but disagree — the target market is genuinely between regimes or the analog pool is heterogeneous. High `σ²_within` with low `σ²_between` means analogs agree but each is noisy — increasing the analog count would help. Different remediation in each case.

### 4.3 Confidence Bands

80% CI default for agent consumption. Use t-distribution rather than normal because `n_effective` is often small:

```
CI_80 = forecast_mean ± t_(n_eff - 1, 0.10) · √σ²_forecast
```

For `n_eff = 5`, `t = 1.476`. For `n_eff = 10`, `t = 1.372`. For `n_eff → ∞`, `t → 1.282` (normal limit).

When M38 is operating: apply the calibration multiplier to the CI width per metric × asset class × regime. If M38 reports that M37's stated 80% CIs only capture realizations 65% of the time, widen by `z_0.80 / z_0.65 ≈ 1.35`.

### 4.4 Counterfactual Mode

For hypothetical events ("what if this happened in Jacksonville?"), the workflow is identical except:

1. The "target event" is a synthetic event record with user-specified subtype, magnitude, geographic location.
2. `months_since_event` is set to 0 (the hypothetical hasn't happened yet) — but the analog timing match still works because we're querying the *trajectory* across horizons {6, 12, 24, 36 months}.
3. The forecast returns the full impact curve rather than a single horizon: each analog contributes its trajectory, weighted by similarity, and the result is a forecasted curve with CI bands.

This is the mode that powers the "if X happened, here's what to expect" goal-seeking in M10 and the M36 stress testing.

---

## 5. The Bidirectional API

Three query modes, all served by the same underlying engine.

### 5.1 Forward Mode — Event-Driven Forecast

**Use case:** "An event just happened in this market. Forecast the impact."

```typescript
POST /api/analogs/forecast/forward
body: {
  target_market: { msa_id, submarket_id, asset_class, location: {lat, lng} },
  event: { event_id_from_M35 } | { hypothetical: { subtype, magnitude, ... } },
  metrics: ['rent_growth_yoy', 'cap_rate_yoy', 'vacancy_rate', ...],
  horizons_months: [6, 12, 24, 36],
  min_n_effective: 3
}

returns: {
  forecasts: [
    {
      metric: 'rent_growth_yoy',
      horizon: 24,
      point: 0.042,
      ci_80: [0.030, 0.054],
      n_effective: 12,
      analogs: [
        { event_id, market, similarity: 0.87, realized: 0.045, regime: 'expansion' },
        { event_id, market, similarity: 0.82, realized: 0.038, regime: 'expansion' },
        ...
      ],
      variance_decomposition: { within: 0.000045, between: 0.000080 },
      confidence: 'high' | 'medium' | 'low'
    },
    ...
  ]
}
```

**Primary consumer:** Cashflow Agent calls this for every event-driven assumption. Returns synchronously; latency budget < 800ms (95th percentile).

### 5.2 Backward Mode — Market-Profile Response Distribution

**Use case:** "Given this market's profile, what's the response distribution under each event subtype that could affect it?"

```typescript
POST /api/analogs/forecast/backward
body: {
  target_market: { msa_id, submarket_id, asset_class },
  metrics: ['rent_growth_yoy', ...],
  horizons_months: [12, 24],
  event_subtypes: ['hq_announcement', 'major_employer_layoff', ...] | 'all'
}

returns: {
  response_profiles: [
    {
      event_subtype: 'hq_announcement_large',
      typical_impact: { rent_growth_yoy: { 12: { point, ci }, 24: { ... } } },
      historical_frequency_per_year_in_similar_markets: 0.12,
      n_analogs: 18
    },
    ...
  ]
}
```

**Primary consumer:** M10 Scenario Engine calls this to seed scenario generation — what events should the bull/bear scenarios condition on? Also surfaced in market intelligence pages as "what to watch for in this market."

### 5.3 Counterfactual Mode — Hypothetical Event in Target Market

**Use case:** "If event X happened in Jacksonville next month, what's the trajectory?"

```typescript
POST /api/analogs/forecast/counterfactual
body: {
  target_market: { msa_id, submarket_id, asset_class },
  hypothetical_event: {
    subtype, magnitude, location: {lat, lng}, expected_announcement_month
  },
  metrics: [...],
  horizons_months: [3, 6, 12, 24, 36, 60]
}

returns: {
  trajectories: [
    {
      metric: 'rent_growth_yoy',
      curve: [
        { horizon: 3, point, ci_80 },
        { horizon: 6, point, ci_80 },
        ...
      ],
      n_effective_per_horizon: [12, 12, 11, 9, 6, 3]
    }
  ]
}
```

**Primary consumer:** Goal-seeking workflows where the user is exploring "what if" scenarios. Also used by Research Agent when assembling DealContext for deals in markets where users have surfaced hypothetical events.

---

## 6. Cashflow Agent Integration

M37 is the agent's primary tool for assumption priors. The integration changes how the agent reasons.

### 6.1 The Per-Assumption Pattern

Today the agent is asked "build a model" and produces assumptions from training data + heuristics. With M37, every event-influenced assumption follows this pattern:

```
For each assumption_to_set in [rent_growth, vacancy, exit_cap, expense_growth, ...]:
  1. Identify active events relevant to this assumption (via M35)
  2. For each relevant event:
     a. Call M37 forward mode with event_id, target_market, metric, horizons
     b. Receive {point, ci_80, n_effective, analogs}
  3. Aggregate across events (events are typically additive on impact)
  4. Score plausibility of resulting assumption set via M36 (Mahalanobis d)
  5. If d > 1.5, justify each contributing variable with M37 evidence
  6. Emit assumption with prediction interval to the proforma
```

### 6.2 The Output Shape

The agent's output is no longer "rent_growth: 4.0%" but:

```typescript
{
  metric: 'rent_growth_yoy',
  point_estimate: 0.040,
  prediction_interval_80: [0.028, 0.054],
  rationale: {
    base_market_trend: 0.032,           // M05 historical
    event_adjustments: [
      {
        event: 'amazon_hq2_announcement_charlotte',
        source: 'M37 forward query',
        impact_contribution: 0.008,
        confidence: 'high (n_eff=14)'
      }
    ],
    final_estimate: 0.040,
    plausibility_d: 0.6,                // M36 score
    aggressiveness_band: 'realistic'
  }
}
```

This is the underwriter-grade output. Every number has a source. Every CI is calibrated. Every plausibility claim is quantitative.

### 6.3 Agent Prompt Augmentation

The Cashflow Agent prompt augmentation (consolidating M36, M37, M38 service awareness):

```
You are underwriting [deal] in [market], asset class [class], current regime [regime].

For every event-influenced assumption, you must:
1. Query M37 forward mode for the relevant metric × horizon
2. Use the returned point estimate as your base; use the CI as your uncertainty bound
3. If n_effective < 3, treat the M37 forecast as directional only — note in rationale
4. After assembling the full assumption set, call M36 plausibility scoring
5. If d > 1.5, justify each variable's M37 evidence in the rationale field
6. Apply M38 calibration multipliers to widen CIs per your historical reliability on
   this metric × asset class × regime

Do not propose any event-influenced assumption without an M37 query.
Do not propose any assumption set with d > 3.0 without explicit user override.
Always emit prediction intervals, never point estimates alone.
```

### 6.4 When M37 Has Nothing to Say

For assumptions that aren't event-influenced (steady-state expense growth, baseline market trends), the agent uses M05/M06 directly without M37. M37 is invoked only when an active or hypothetical event is in scope.

When M37 reports `NoAnalogsFoundError` (no event subtype matches in any compatible market), the agent falls back to M35's playbook (which gives nationwide-pooled estimates without market-similarity weighting). This fallback is less calibrated but still better than nothing. The agent flags lower confidence in the rationale.

---

## 7. Database Schema

M37 is mostly stateless. It maintains a few caches and a query log for analytics.

```sql
-- Analog query cache (avoids re-running expensive similarity computations)
CREATE TABLE analog_query_cache (
  cache_key            VARCHAR(128) PRIMARY KEY,    -- hash of (target, event, metrics, horizons)
  target_market        JSONB NOT NULL,
  query_event          JSONB NOT NULL,              -- real or hypothetical
  metrics              VARCHAR(50)[],
  horizons             INT[],
  result               JSONB NOT NULL,              -- full forecast response
  n_effective_min      INT,                          -- min across all (metric, horizon)
  computed_at          TIMESTAMPTZ DEFAULT now(),
  expires_at           TIMESTAMPTZ NOT NULL,         -- invalidated on M35/M36 refresh
  hit_count            INT DEFAULT 0
);

CREATE INDEX idx_analog_cache_expiry ON analog_query_cache(expires_at);

-- Computed similarity scores (per target × analog pair, per regime)
CREATE TABLE analog_similarities (
  similarity_id        UUID PRIMARY KEY,
  target_market_id     VARCHAR(64) NOT NULL,
  analog_market_id     VARCHAR(64) NOT NULL,
  analog_event_id      UUID NOT NULL,
  regime_match         FLOAT NOT NULL,
  market_similarity    FLOAT NOT NULL,
  event_similarity     FLOAT,                        -- nullable; set when event_id specified
  total_similarity     FLOAT NOT NULL,
  factor_loadings_used JSONB,                        -- snapshot for audit
  computed_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (target_market_id, analog_event_id)
);

CREATE INDEX idx_sim_target ON analog_similarities(target_market_id, total_similarity DESC);

-- Query log (for analytics, calibration, debugging)
CREATE TABLE analog_query_log (
  query_id             UUID PRIMARY KEY,
  query_mode           VARCHAR(20) NOT NULL,         -- 'forward' | 'backward' | 'counterfactual'
  caller               VARCHAR(50),                  -- 'cashflow_agent' | 'm10_scenario' | 'user_ui'
  target_market        JSONB,
  query_event          JSONB,
  metrics_requested    VARCHAR(50)[],
  horizons_requested   INT[],
  result_summary       JSONB,                        -- {n_effective, point_estimates, ci_widths}
  fallback_used        BOOLEAN DEFAULT false,
  duration_ms          INT,
  queried_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_query_log_caller ON analog_query_log(caller, queried_at DESC);

-- Bandwidth calibration parameters (learned from M38)
CREATE TABLE analog_bandwidths (
  bandwidth_id         UUID PRIMARY KEY,
  metric               VARCHAR(50) NOT NULL,
  asset_class          VARCHAR(20) NOT NULL,
  lambda_factor        FLOAT NOT NULL,
  lambda_geo           FLOAT,                        -- nullable for non-geographic events
  lambda_chars         FLOAT NOT NULL,
  lambda_magnitude     FLOAT NOT NULL,
  lambda_timing        FLOAT NOT NULL,
  calibration_method   VARCHAR(50),                  -- 'default' | 'cv_optimized' | 'm38_derived'
  loss_value           FLOAT,                        -- e.g., MSE on held-out
  is_active            BOOLEAN DEFAULT true,
  effective_from       TIMESTAMPTZ NOT NULL,
  UNIQUE (metric, asset_class, is_active) WHERE is_active = true
);

-- Asset class compatibility matrix (which classes can pool)
CREATE TABLE asset_class_compatibility (
  source_class         VARCHAR(20) NOT NULL,
  target_class         VARCHAR(20) NOT NULL,
  compatibility_weight FLOAT NOT NULL,               -- 1.0 = same; <1.0 = partial pooling; 0 = excluded
  PRIMARY KEY (source_class, target_class)
);

-- Seeded values:
-- multifamily-multifamily = 1.0
-- multifamily_garden-multifamily_midrise = 0.85
-- multifamily-sfr_btr = 0.7
-- multifamily-office = 0
-- ...
```

---

## 8. API Endpoints

```
# Forward / backward / counterfactual queries
POST /api/analogs/forecast/forward
     body: { target_market, event, metrics, horizons, min_n_effective? }
     → ForecastResponse[]

POST /api/analogs/forecast/backward
     body: { target_market, metrics, horizons, event_subtypes? }
     → ResponseProfile[]

POST /api/analogs/forecast/counterfactual
     body: { target_market, hypothetical_event, metrics, horizons }
     → TrajectoryResponse[]

# Diagnostics
POST /api/analogs/similarity
     body: { target_market_id, analog_market_id, regime?, event_id? }
     → { sim_market, sim_regime, sim_event, total, breakdown }

GET  /api/analogs/pool/:target_market_id?event_subtype=&regime=&min_sim=
     → AnalogPool[] (ranked list of analog events, similarity-weighted)

GET  /api/analogs/bandwidths?metric=&asset_class=
     → BandwidthConfig

POST /api/analogs/bandwidths/recalibrate
     body: { metric, asset_class, method? }
     → BandwidthConfig (new, also written to DB)

# Query log access (for admin)
GET  /api/analogs/query-log?caller=&since=
     → QueryLog[]

# Cache control
POST /api/analogs/cache/invalidate
     body: { target_market_id? | all? }
     → { invalidated_count }
```

**Kafka topics:**
- `analog.forecast_emitted` — every forecast emission, for downstream calibration tracking
- `analog.bandwidth_recalibrated` — after recalibration cycle
- `analog.no_analogs_warning` — when a query returns insufficient analogs
- `analog.cache_invalidated` — when M35 or M36 changes invalidate the cache

---

## 9. Integration with Existing Modules

### 9.1 M35 Event Impact Engine

**Today:** M35 owns the event library and produces per-subtype playbooks via direct aggregation across all observed events.

**With M37:**
- M35's playbooks become the un-weighted baseline. M37 produces market-weighted alternatives.
- Cashflow Agent prefers M37 forecasts when n_effective ≥ 3; falls back to M35 playbooks otherwise.
- `event.impact_measured` Kafka events from M35 invalidate the relevant M37 cache entries.

### 9.2 M36 Joint Distribution Engine

**Today:** M36 provides factor loadings, spatial kernels, regime classification.

**With M37:**
- M37 reads M36 loadings on every similarity computation. Cached per (target_market, regime) pair.
- `sigma.recomputed` Kafka invalidates M37's similarity cache.
- M37's variance estimates feed back into M36 as additional information for novel events — when M37 emits a forecast for an event subtype with rich analog support, M36 can use that as a tighter prior than its conditional propagation default.

### 9.3 Cashflow Agent (Primary Consumer)

**Today:** Generates assumption sets via training-data heuristics.

**With M37:** Every event-influenced assumption gets an M37 forward query. The agent's output shape changes from point estimates to (point, CI, rationale) tuples. The agent's prompt mandates M37 invocation; absent M37 evidence, assumptions cannot be event-attributed.

### 9.4 M06 Demand Signals

**Today:** Converts news events into quantified housing demand via fixed conversion rates.

**With M37:**
- For each demand event, M37 provides analog-derived realized housing-unit-equivalent demand.
- M06 blends its own conversion calculation with M37's analog evidence — weighted by which has tighter uncertainty.
- For novel event types where M37 has no analogs, M06 falls back to its own conversion rates with explicitly wider CIs.

### 9.5 M09 ProForma Engine

**Today:** Receives platform-layer assumptions in LayeredValue from various services.

**With M37:**
- The platform layer of LayeredValue carries M37 prediction intervals, not just point estimates.
- F46 CI propagation through proforma uses these intervals to produce IRR distributions.
- When the user overrides a platform-layer assumption, the override is point-valued by default; user can optionally specify a custom CI.

### 9.6 M10 Scenario Engine

**Today:** Generates Bull/Base/Bear scenarios with parameter perturbations.

**With M37:**
- Scenarios become event-conditioned: Bull = "active events fire at 90th percentile of M37 distribution"; Bear = "events at 10th percentile"; Base = median.
- Counterfactual mode generates scenarios for plausible events that haven't fired yet ("what if a major employer announcement?").

### 9.7 M14 Risk Module

**Today:** Composite risk score with hand-tuned correlations.

**With M37:**
- Tail-risk estimation uses M37 forecast distributions to get realistic 5th-percentile outcomes per event-influenced metric.
- Risk variance attribution per event source: "Your IRR variance has 8% contribution from active employer-announcement risk (M37-derived)."

---

## 10. Implementation Sequence

**Phase 1 — Foundations (2 sessions)**

1. Schema + migrations. Tables for similarity cache, query log, bandwidth config, asset class compatibility.
2. Initial similarity computation service. Reads M36 factor loadings + M35 events. Produces ranked analog lists. Default bandwidths.

**Phase 2 — Forward mode (2 sessions)**

3. Forward query API. Implements F43 + F44 with t-distribution CIs and Kish effective sample size.
4. Cache layer. Cache invalidation on M35/M36 Kafka events.

**Phase 3 — Backward + counterfactual modes (2 sessions)**

5. Backward query API. Iterates over event subtypes. Used by M10.
6. Counterfactual query API. Synthetic event handling. Trajectory output.

**Phase 4 — Cashflow Agent integration (3 sessions)**

7. Agent prompt augmentation. Documented in this spec Section 6.3. Test on 464 Bishop equivalent goal-seeking flow.
8. Per-assumption pattern enforcement. Agent rejects own outputs that lack M37 evidence for event-influenced metrics.
9. Output shape migration. Assumption shape changes from point to (point, CI, rationale).

**Phase 5 — M06 / M10 / M14 integration (3 sessions)**

10. M06 demand blending with M37 analogs.
11. M10 event-conditioned scenarios.
12. M14 tail-risk and event-source variance attribution.

**Phase 6 — Calibration loop (2 sessions)**

13. Bandwidth empirical calibration. Cross-validation on held-out analogs. Optimal λ per metric × asset class.
14. M38 integration: drift in M37 forecasts triggers bandwidth recalibration.

**Total: ~14 sessions.**

Phase 4 is the user-visible unlock — it's when the Cashflow Agent's outputs become defensibly calibrated. Phases 1-3 are infrastructure that has no external surface. Phases 5-6 are the long-tail integrations that compound value.

---

## 11. Open Design Questions

Items that need decisions; recommendations included.

**Q1. Hard vs soft regime matching.** Hard match on regime simplifies the math but throws away analogs at regime transitions. Soft match (using HMM probabilities) is more honest but more expensive. Recommendation: soft match using `Σ_r π_t,r · π_a,r`. The compute is cheap once regime probabilities are cached.

**Q2. Cross-asset-class pooling.** Multifamily garden vs midrise probably should pool partially. Multifamily vs SFR-BTR — debatable. Multifamily vs office — never. Recommendation: configurable `asset_class_compatibility` table starting with conservative defaults; loosen as M38 calibration data shows acceptable accuracy.

**Q3. Geographic similarity gating.** When does drive-time matter? Migration events probably depend on regional connectivity; rate-environment events do not. Recommendation: per-event-subtype configuration in M35 with `geo_relevance: high | medium | low | none`. M37 reads this to weight λ_g.

**Q4. Magnitude scaling.** Is 5,000-job announcement → 5× the impact of 1,000-job announcement? Linear scaling is naive; log scaling is what we use in similarity but might not be right for impact extrapolation. Recommendation: per-subtype scaling exponent (initially 1.0, calibrated empirically per subtype).

**Q5. CI level default.** 80% is the default but not principled. Could be 50% (interquartile-style), 80%, 90%, 95%. Recommendation: 80% for agent consumption (good signal-to-noise on aggressiveness), 50% as alternative for compactness in UI displays. Both available in API output; client selects.

**Q6. Counterfactual horizon limits.** Should we cap counterfactual queries at some horizon (e.g., 36 months) where analog data is sparse? Recommendation: no hard cap, but `n_effective` per horizon naturally reflects sparsity; agent treats long-horizon forecasts as directional when n_eff drops below 3.

**Q7. Bandwidth calibration cadence.** Recalibrate monthly, quarterly, annually? Recommendation: quarterly initially; reduce to annual once stable. Recalibrating too often introduces parameter drift that degrades stability without meaningful accuracy gain.

**Q8. Confidence inflation for novel subtypes.** When an event subtype has < 5 analogs platform-wide, we can still produce a forecast but should we widen CIs more aggressively than the t-distribution suggests? Recommendation: yes, multiplicative inflation factor `max(1.0, 1.5 - n_total/10)` applied to CI when n_total < 10 globally.

**Q9. Backwards-mode top-N capping.** When listing "events that could affect this market," how many event subtypes to return? Recommendation: top 10 by historical_frequency × forecast_impact_magnitude. Anything longer becomes noise.

**Q10. Caching duration.** How long to cache forecasts? Recommendation: 24 hours, with explicit invalidation on `event.impact_measured` for analog events in the cached query's similar set. Hit-count tracked for analytics; high-hit forecasts get longer TTL.

---

## 12. Out of Scope

Things related but excluded from M37's launch scope.

**Causal attribution beyond similarity weighting.** M37 weights analogs by similarity but doesn't construct synthetic-control-style causal estimands. That's a separate capability — useful for retrospective attribution rather than forecasting.

**Endogenous event generation.** M37 forecasts what happens given an event. It doesn't predict whether/when events will happen. Event-occurrence forecasting is a different problem (closer to time-series anomaly detection on news pipelines).

**Cross-platform analog learning.** Pooling analogs from external CoStar / Real Capital data with our internal events would expand the pool but introduces data quality variance. Defer until internal pool is operationally validated.

**Real-time event streaming.** M37 operates on M35's verified event records. Live news-driven "ah, this might be an event" forecasting is M19's job, not M37's.

**Multi-event interaction modeling.** Today M37 treats multiple active events as additive on impact. Interactive effects (e.g., simultaneous employer announcement + supply shock) are likely real but require more analog density than we have. Defer.

---

## 13. Why This Matters

The 464 Bishop test exposed the difference between "this number sounds right" and "this number is defensible." M36 gives the platform structural defensibility (Σ-derived plausibility). M37 gives it **empirical** defensibility — the ability to point at specific historical analogs and say "in 12 markets like Tampa that experienced similar events under similar regimes, the realized impact distribution was this."

That's the move from heuristic underwriting to evidence-based underwriting.

The Cashflow Agent without M37 is a sophisticated guess generator. The Cashflow Agent with M37 is a structured analog-search-and-aggregation engine that emits calibrated prediction intervals tied to specific historical evidence. The difference is what an LP will accept versus what they'll fund.

The geographic transfer learning is also what makes the platform scalable beyond Florida. Tampa multifamily has limited history; M37 lets that not matter — Tampa borrows from Atlanta, Charlotte, Phoenix, Nashville. Every new market the platform enters becomes immediately useful from day one because the analog pool isn't local; it's the entire historical event library, weighted by similarity.

This is the capability that turns the JEDI platform's existing event library and Σ engine from internal infrastructure into the user-facing reasoning that produces investor-grade memos. It's the layer that makes "AI-powered real estate underwriting" mean something concrete: not "we use LLMs," but "every assumption traces to a calibrated analog set with defensible weighting."

---
