# Macro-Anchored Mean Specification

**Module:** M36 Joint Distribution Engine
**Spec relationship:** Addendum to `M36_Joint_Distribution_Engine_Spec.md`. Refines Section 3 (Σ Construction) with a macro-anchored construction of the mean vector μ. Σ itself is unchanged.
**Status:** Implementation-grade

---

## 1. The Gap This Closes

M36 as currently specified estimates μ as a rolling-window empirical mean. That works mechanically but has one structural failure mode: μ drifts wherever the rolling window drifts, including in directions that are macro-incoherent.

The 2021–2023 multifamily rent surge illustrates the problem. With a 7-year rolling window, by mid-2024 the empirical μ for rent_growth_yoy had drifted upward to ~5.5% — well above the long-run CPI-OER baseline of ~3.2%. An assumption set proposing 4.0% rent growth in 2026 would score with positive Mahalanobis distance from this elevated μ, when in fact 4.0% is *more* macro-coherent than the empirical mean. Plausibility scoring rewards exactly the wrong direction.

The fix is to anchor μ for select metrics in macro-coherent baselines, blended with empirical signal. Σ stays the same — covariance structure is honestly captured by empirical estimation. Only the center moves.

This is the genuine insight in CPI-anchored thinking: **the long-run mean for macro-linked metrics should be macro-coherent, and the short-run mean can deviate from it by a regime-appropriate amount.** Triangulated underwriting consumes a μ that respects both.

---

## 2. Affected Metrics

Six platform metrics have natural macro anchors. Three demand-side, three supply/cost-side. Other metrics in Σ remain purely empirical.

| Metric | Macro Anchor | Structural Premium | Source |
|--------|--------------|-------------------|--------|
| `rent_growth_yoy` | CPI-OER (Owners' Equivalent Rent) | per asset class × geographic tier | BLS CUSR0000SEHC |
| `wage_growth_yoy` | ECI (Employment Cost Index, wages) | per MSA tier | BLS ECIWAG |
| `expense_growth_yoy` | CPI services (utilities + maintenance) | per asset class | BLS CPI service components |
| `entry_cap_rate` | Real 10Y treasury + asset class risk premium | per asset class × market tier | FRED DGS10 - T10YIE + premium |
| `exit_cap_rate` | Same as entry, plus terminal premium | per hold period | derived |
| `construction_cost_yoy` | PPI residential construction | per geography | FRED WPSFD49207 / PPI |

**Excluded from macro-anchoring** (remain purely empirical because they have no clean macro analog or are determined locally): vacancy_rate, occupancy, lease_up_velocity_units_per_month, concessions, migration_flows, submarket transaction velocity, debt_rate (set by capital markets at deal time, not forecast), refinance_spread.

The exclusion list is the test of whether to add a metric to the anchored set. If you can't write down a macro series whose long-run trend the metric tracks, don't anchor it.

---

## 3. The Construction

### 3.1 Macro Anchor Computation

For each anchored metric, the macro anchor at time t is:

```
μ_macro(metric, t) = macro_series(t) + structural_premium(metric, asset_class, geographic_tier)
```

The macro series is read from the data source (FRED/BLS), refreshed daily where available, monthly otherwise.

### 3.2 Structural Premium

The structural premium captures the long-run difference between the metric and its macro anchor. It's calibrated once per (metric × asset_class × geographic_tier) cell on a long-window dataset:

```
structural_premium(metric, asset_class, tier) = 
    long_window_mean(metric_observed - macro_series)
```

Calibration window: longest available, ideally 20+ years. Use national or regional aggregates if submarket-level data doesn't reach back that far.

Examples (illustrative, real values calibrated from data):
- `rent_growth_yoy` for Sun Belt multifamily Class A: CPI-OER + 0.8% structural premium
- `rent_growth_yoy` for Northeast multifamily Class A: CPI-OER + 0.2% structural premium
- `entry_cap_rate` for multifamily Class A: real 10Y + 3.5% asset class risk premium + 0.5% liquidity premium
- `construction_cost_yoy` for Florida coastal: PPI residential + 1.2% (insurance + permitting overhead)

Premiums are **frozen between recalibrations**. Annual recalibration is sufficient — they shouldn't move with regime. If a premium has shifted materially (>50bps in one year), that's a structural change worth investigating manually rather than auto-absorbing.

### 3.3 Blended Mean

The actual μ M36 uses for plausibility, sampling, and goal-seeking:

```
μ(metric, t) = w_empirical · μ_empirical(metric, t) + (1 - w_empirical) · μ_macro(metric, t)

where:
  w_empirical ∈ [w_min, w_max]
  default w_empirical = 0.70
  w_min = 0.30   (always at least 30% macro discipline)
  w_max = 0.90   (always at least 10% macro discipline)
```

The 70/30 default favors empirical signal — markets do deviate from macro for extended periods, and we don't want to over-correct. But the floor ensures macro never disappears as a force, even in long-running anomalous regimes.

For non-anchored metrics, μ = μ_empirical (i.e., w_empirical = 1.0).

### 3.4 Divergence-Driven Reweighting

The fixed 70/30 blend isn't enough on its own. When empirical and macro diverge sharply, the *direction* of the divergence matters: large empirical deviations from macro often mean-revert eventually. The blend should pull harder toward macro when divergence is large.

Define divergence in σ units:

```
divergence(metric, t) = |μ_empirical - μ_macro| / σ_metric

where σ_metric is the long-run empirical standard deviation of the metric.
```

Reweighting rule:

```
if divergence < 1.0:    w_empirical = 0.70   (default)
if 1.0 ≤ div < 2.0:     w_empirical = 0.55   (macro discipline increases)
if 2.0 ≤ div < 3.0:     w_empirical = 0.40
if divergence ≥ 3.0:    w_empirical = 0.30   (floor — strong macro pull)
```

This is the mean-reversion mechanism. When 2024 multifamily rent growth had run 2.5σ above CPI-OER baseline for 18 months, w_empirical drops to 0.40 — μ for plausibility scoring becomes 60% macro-anchored. An assumption proposing reversion toward CPI-OER baseline scores as plausible rather than aggressive.

### 3.5 Asymmetric Reweighting (Optional Refinement)

Real estate metrics have asymmetric mean-reversion — rent growth surges revert harder than rent growth troughs do. Cap rate compression reverts harder than cap rate expansion. A symmetric divergence rule under-corrects in one direction.

Optional refinement for Phase 2: separate weights for divergence-up vs divergence-down, calibrated empirically per metric. Defer until base implementation is operating; symmetric reweighting captures most of the benefit.

---

## 4. Regime Interaction

Macro-anchored μ interacts with M36's regime classification in a specific way: **structural premiums are regime-invariant; macro anchors are not.**

The macro series itself (CPI-OER, ECI, real 10Y, PPI) carries the regime signal naturally — these are the underlying macro variables whose movements *define* regime. So μ_macro tracks regime via its components without needing separate per-regime calibration.

Empirical μ, by contrast, is computed within the current regime's window. M36's regime-conditional Σ already implies regime-conditional μ_empirical. The blending happens within each regime.

Concretely:

```
μ(metric, t, regime) = w_empirical(t) · μ_empirical(metric, regime) 
                     + (1 - w_empirical(t)) · μ_macro(metric, t)
```

Structural premium is fixed across regimes. The macro series is read at the prediction time t (capturing whatever regime-driven macro state is present). Empirical mean is regime-conditional. Blend weight is divergence-driven.

This composes cleanly. No new regime logic needed — existing M36 regime conditioning applies to the empirical component, and the macro component handles itself via its own time series.

---

## 5. Schema Additions

Three additions to M36's existing schema:

```sql
-- Anchored metric registry
CREATE TABLE macro_anchored_metrics (
  metric                 VARCHAR(50) PRIMARY KEY,
  macro_series_id        VARCHAR(100) NOT NULL,    -- FRED/BLS series ID
  macro_series_source    VARCHAR(50) NOT NULL,
  refresh_cadence        VARCHAR(20) NOT NULL,     -- 'daily' | 'monthly' | 'quarterly'
  is_active              BOOLEAN DEFAULT true,
  notes                  TEXT
);

-- Structural premiums (calibrated annually, frozen between calibrations)
CREATE TABLE structural_premiums (
  premium_id            UUID PRIMARY KEY,
  metric                VARCHAR(50) NOT NULL,
  asset_class           VARCHAR(20) NOT NULL,
  geographic_tier       VARCHAR(50) NOT NULL,      -- 'sun_belt' | 'northeast' | 'florida_coastal' | ...
  premium_value         FLOAT NOT NULL,
  calibration_window_start  DATE NOT NULL,
  calibration_window_end    DATE NOT NULL,
  calibration_method    VARCHAR(50),              -- 'long_window_mean' | 'median_robust' | ...
  next_recalibration_at TIMESTAMPTZ,
  is_active             BOOLEAN DEFAULT true
);

CREATE UNIQUE INDEX idx_premiums_active 
  ON structural_premiums(metric, asset_class, geographic_tier) 
  WHERE is_active = true;

-- Macro anchor cache (avoids hitting FRED/BLS APIs on every request)
CREATE TABLE macro_anchor_cache (
  cache_id           UUID PRIMARY KEY,
  metric             VARCHAR(50) NOT NULL,
  asset_class        VARCHAR(20) NOT NULL,
  geographic_tier    VARCHAR(50) NOT NULL,
  observation_date   DATE NOT NULL,
  macro_series_value FLOAT NOT NULL,
  structural_premium FLOAT NOT NULL,
  mu_macro           FLOAT NOT NULL,              -- macro_series + premium
  computed_at        TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (metric, asset_class, geographic_tier, observation_date)
);

CREATE INDEX idx_macro_cache_lookup 
  ON macro_anchor_cache(metric, asset_class, geographic_tier, observation_date DESC);
```

Existing M36 tables (`covariance_matrices`, `factor_loadings`) extend by adding columns to `covariance_matrices`:

```sql
ALTER TABLE covariance_matrices ADD COLUMN mean_construction_method VARCHAR(30) DEFAULT 'empirical';
-- Values: 'empirical' | 'macro_anchored' | 'mixed'
ALTER TABLE covariance_matrices ADD COLUMN mu_macro_component JSONB;
-- Per-anchored-metric breakdown of macro contribution
ALTER TABLE covariance_matrices ADD COLUMN blend_weights JSONB;
-- Per-metric w_empirical at time of estimation
```

---

## 6. API Additions

Two new endpoints; existing M36 endpoints unchanged:

```
GET /api/sigma/mu/breakdown?metric=&asset_class=&geographic_tier=
    → MeanBreakdown {
        mu_empirical, mu_macro, blend_weight,
        macro_series_value, structural_premium,
        divergence_sigma, final_mu
      }

POST /api/sigma/premiums/recalibrate
     body: { metric?, asset_class?, geographic_tier? }
     → updated structural_premiums records
```

The `/api/sigma/mu/breakdown` endpoint exists primarily for transparency and audit. When a user or admin asks "why is plausibility scoring this assumption as Stretch instead of Realistic?", the breakdown shows the empirical-vs-macro tug-of-war on the relevant metrics. This is what makes the macro-anchored μ defensible: every component is exposed.

---

## 7. Integration Points

### 7.1 With Existing M36 Components

**Plausibility scoring (F37)** uses the blended μ directly. No code change in F37 itself; it just reads μ from the updated source.

**Goal-seeking (F41)** uses blended μ as the center of the Mahalanobis ellipsoid. Goal-seeking results become more conservative on anchored metrics during high-divergence periods — pulling toward macro-coherent values when empirical means are anomalous.

**Conditional sampling (F40)** uses blended μ as the unconditional mean. The conditional mean formula propagates from there.

**Monte Carlo (F46)** draws from the multivariate distribution centered at blended μ. Tail risk on anchored metrics changes meaningfully — distributions in 2024 sampled from purely empirical μ are fat-tailed in the wrong direction; blended μ shifts the center toward sustainable values.

**Factor variance attribution (F39)** is unchanged. Σ is still empirical; only μ shifts.

### 7.2 With M37 Cross-Market Analog Engine

M37's analog forecasts already point at concrete realized values from analog markets. They don't need macro-anchoring at the analog level. But M37's *effective sample size adjustments* should reference the divergence: when a target market has high empirical-vs-macro divergence, M37 increases the analog count requirement (`min_n_effective`) before forecasting, because the analog pool needs to be richer to overcome local anomaly.

### 7.3 With M38 Calibration Ledger

The macro-anchored μ is itself a prediction (about the long-run center of each metric's distribution). M38 can backtest this: compare μ_macro(t) + structural_premium against actual long-run trend, calibrate the structural premium values empirically over time. This closes another loop — the structural premium starts from historical calibration but stays accountable to forward outcomes.

### 7.4 With Cashflow Agent

The agent's prompt (per M37 §6.3) already references regime context and plausibility scoring. Add one line:

```
For metrics with macro anchors (rent_growth, expense_growth, entry/exit cap rate, 
construction cost, wage growth), note that the plausibility center reflects a 
blend of empirical mean and macro-coherent baseline (CPI/PPI/treasury anchored). 
When the empirical mean has diverged > 2σ from macro, your assumptions may score 
more aggressive than they appear locally — this is intentional and reflects 
expected mean reversion.
```

---

## 8. Calibration Cadence

- **Macro series:** refreshed per source cadence (CPI/PPI monthly, treasury daily, ECI quarterly)
- **Structural premiums:** recalibrated annually
- **Blend weights:** divergence-driven, recomputed weekly with Σ refresh
- **Schema review** (which metrics are anchored, anchor source choice): annually

The structural premium is the longest-lived parameter. Annual recalibration is appropriate; structural relationships don't move quickly. If a premium has moved >50bps in a recalibration cycle, surface as a flag for manual review rather than auto-applying — that's potentially evidence of a real structural shift in the asset class or geography that deserves human attention.

---

## 9. Open Questions

**Q1. Floor and ceiling on w_empirical.** The 30/90 bounds are judgment calls. Tighter bounds (e.g., 50/85) discipline harder; looser bounds (20/95) trust empirical more. Recommendation: start with 30/90, calibrate empirically once M38 has 12+ months of data on prediction reliability under different blend weights.

**Q2. Asymmetric divergence.** Section 3.5 flagged this. The single divergence threshold treats up-divergence and down-divergence symmetrically. Real estate metrics often revert harder from highs than from lows. Recommendation: defer asymmetric handling to Phase 2; symmetric is good enough for launch.

**Q3. Geographic tier definition.** Tiers like "sun_belt" or "florida_coastal" are categorical and may not capture the right structure. Possible refinement: continuous tier representation via M36 factor loadings — but this risks circularity (using factor loadings to define structural premiums that feed into μ that feeds into Σ that produces factor loadings). Recommendation: keep categorical tiers, ~6-10 tiers, calibrate annually.

**Q4. Macro series substitution risk.** What if BLS revises CPI methodology, or FRED discontinues a series? Recommendation: explicit fallback chain in the macro_anchored_metrics table — primary series, secondary series, tertiary derivation. Annual review confirms all three are alive.

**Q5. Submarket-level macro anchors.** National CPI is the default; can we use city-level CPI (Phoenix CPI vs Miami CPI)? Recommendation: yes where BLS provides MSA-specific series. Falls back to national otherwise. Submarket-level is rarely available — submarket inherits MSA anchor.

---

## 10. Why This Matters

Without macro anchoring, M36's plausibility scoring is internally consistent but macro-incoherent. It will score 4% rent growth as aggressive in a 5.5% empirical-mean world, even though 4% is closer to the long-run sustainable level. Underwriters using the platform for conservative decisions will be told their conservatism is aggressive. That's a credibility-killer.

Macro anchoring fixes this without giving up empirical signal. Σ still captures co-movement honestly. Plausibility still scores aggressiveness. Goal-seeking still finds the lowest-d path to a target return. But the center of the plausibility ellipsoid is anchored in macro reality, so "reverting toward sustainable" registers as plausible rather than aggressive.

For the Triangulation framework as a whole, this is what makes the **Structural Plausibility** leg defensible to institutional underwriters who think in macro terms. They start from CPI, real rates, PPI — and their first question of any model is "does this respect macro coherence?" Macro-anchored μ lets you say yes, while keeping all the rigor of the joint distribution machinery intact.

The one-liner gets sharper: **"JEDI Triangulated underwriting anchors every assumption to a macro-coherent baseline, then triangulates from three evidence sources to produce calibrated forecasts."** That sentence is now technically accurate, not just narratively appealing. The macro-coherent baseline is M36 with this addendum applied. The triangulation is M36 + M37 + M38. The calibration is empirical reliability tracking.

That's the method. This addendum is the missing connective tissue that makes the macro layer real.

---
