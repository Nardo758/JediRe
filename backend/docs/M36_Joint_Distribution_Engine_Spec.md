# Joint Distribution Engine — Σ Backbone for Risk, Scenario, and Underwriting

**Module:** M36 Joint Distribution Engine (new module)
**Status:** Implementation-grade spec
**Relationship to existing modules:**
- **Correlation Engine** owns curated, named, hypothesis-driven pairwise relationships (Golden Chain, COR-01 through COR-21+). Stays as user-facing layer. Σ sits beneath it.
- **M35 Event Impact Engine** owns event taxonomy and playbooks. Uses Σ as the prior distribution for novel events that have no playbook match.
- **M14 Risk Module** consumes Σ for Monte Carlo sampling and variance decomposition. Replaces hand-tuned correlation assumptions.
- **M10 Scenario Engine** samples Bull / Base / Bear / Stress paths from Σ-consistent distributions.
- **M09 ProForma Engine + Cashflow Agent** consume plausibility scores for assumption sets and call the goal-seeking solver. **Primary new consumer.**
- **M08 Strategy Arbitrage** uses Σ for variance of strategy scores → probabilistic strategy ranking.
- **M25 JEDI Score** gets confidence intervals derived from Σ rather than post-hoc heuristics.

---

## 1. The Gap This Closes

The platform today encodes relationships in three places:

1. **Correlation Engine** — pairwise expected r values, lead/lag, qualitative hypotheses
2. **Strategy Signal Weights** — additive weighted sums (Demand 0.30, Supply 0.25, …)
3. **M35 Event Impact Engine** — historical playbooks for known event types

None of these is a **joint distribution**. Pairwise correlations don't compose: knowing COR-01 (Surge → Rent, r ≈ 0.65) and COR-04 (Wages → Rent, r ≈ 0.72) does not yield the joint Surge+Wages → Rent relationship without the full covariance structure. Strategy weights are deterministic — they produce a point score with no notion of variance. M35 forecasts are conditional on having seen the event type before.

Three things the platform cannot do today, all of which Σ unlocks:

**It cannot propagate shocks.** Given a 50bp rate move, the platform cannot compute the *conditional distribution* of rent growth, cap rates, traffic, and absorption simultaneously. Each metric is forecast in isolation or via narrow pairwise links. The joint propagation that an institutional risk engine does — given x_observed, sample x_unobserved from N(μ_uo, Σ_uo) — is absent.

**It cannot score the aggressiveness of an assumption set.** When a user (or the Cashflow Agent) proposes (rent_growth=4%, exit_cap=5.25%, occupancy=94%, expense_growth=2.5%), there is no formal way to ask "how heroic is this jointly, given the historical Σ?" The 464 Bishop test surfaced this directly: the agent could list realistic-sounding adjustments but had no quantitative aggressiveness measure. Mahalanobis distance from the historical center, ‖x − μ‖_Σ, is that measure.

**It cannot solve the inverse problem.** "Find me the lowest-aggressiveness assumption set that achieves 15% IRR" is constrained optimization on the Σ-defined ellipsoid. Without Σ, the agent can either heuristically tweak knobs (current state) or hallucinate any combination of assumptions to hit the target (worse state). With Σ, it returns a Pareto frontier of (IRR, aggressiveness) trade-offs that an underwriter can defend.

That's the gap. M36 closes it.

---

## 2. Architectural Position

```
                    ┌────────────────────────────────────────────────┐
                    │           USER-FACING LAYER                    │
                    │                                                │
                    │   Correlation Engine     Strategy Weights      │
                    │   (curated pairwise)     (additive scoring)    │
                    │   Golden Chain, COR-XX                         │
                    └──────────────────┬─────────────────────────────┘
                                       │
                                       │  derives, calibrates, weights
                                       │
                    ┌──────────────────▼─────────────────────────────┐
                    │           M36 JOINT DISTRIBUTION ENGINE        │
                    │                                                │
                    │   • Σ estimation (rolling-window + LW shrink)  │
                    │   • Factor model (Y = α + Bf + ε)              │
                    │   • Regime classifier (HMM)                    │
                    │   • Spatial kernel (drive-time decay)          │
                    │   • Plausibility scoring (Mahalanobis)         │
                    │   • Goal-seeking solver (constrained min)      │
                    │   • Conditional sampler                        │
                    └─────────┬────────────────────────────┬─────────┘
                              │                            │
                ┌─────────────▼──────────┐    ┌────────────▼─────────┐
                │   ANALYSIS CONSUMERS   │    │   AGENT CONSUMERS    │
                │                        │    │                      │
                │  • M14 Risk MC         │    │  • Cashflow Agent    │
                │  • M10 Scenario        │    │  • Research Agent    │
                │  • M35 Event prop.     │    │  • UI Intel Agent    │
                │  • M08 Strategy var.   │    │                      │
                │  • M25 Score CI        │    │                      │
                │  • M09 plausibility    │    │                      │
                └────────────────────────┘    └──────────────────────┘
```

**Key principle:** Σ is a derived structural object, not a user-visible concept. Users continue to interact with named correlations, strategy weights, and risk categories. M36 makes those things *coherent* and *probabilistic* without changing the surface.

---

## 3. Σ Construction

### 3.1 Variables in Σ

The covariance matrix spans three blocks of variables, organized by stationarity and use case.

**Block A — Market signals (~35 variables).** From the Correlation Engine inventory:
- Demand: D_SEARCH_MOMENTUM, D_OUT_OF_STATE, D_TRENDS_INDEX, employment growth, wage growth, migration net flow
- Supply: pipeline_units, months_to_absorb, permit_velocity, completions_yoy, supply_pressure_ratio
- Traffic: T_AADT_YOY, C_SURGE_INDEX, C_DIGITAL_PHYSICAL_GAP, C_TPI, C_TVS
- Momentum: cap_rate_yoy, rent_growth_yoy, transaction_velocity, days_on_market, sentiment_score
- Position: submarket_rank, amenity_score, comp_set_position
- Risk: regulatory_risk, climate_risk, insurance_cost_yoy

**Block B — Underwriting assumptions (~12 variables).** Variables that ProForma and Cashflow Agent edit:
- rent_growth_yoy, vacancy_rate, expense_growth_yoy, exit_cap_rate
- entry_cap_rate, debt_rate, ltv, dscr, refinance_spread
- construction_cost_yoy, lease_up_period_months, capex_per_unit

**Block C — Macro factors (~8 variables).** Systematic drivers:
- 10Y_treasury, sofr, cap_rate_spread, unemployment_rate, gdp_growth_yoy
- inflation_yoy, vix, transaction_volume_index

Σ is the (~55 × 55) joint covariance over all three blocks. Block-wise structure is exploited: Block C drives Blocks A and B through the factor loadings; A and B are conditionally correlated given C.

### 3.2 Factor Model

A flat 55×55 Σ has 1,540 unique parameters. With ~84 monthly observations per variable in a rolling 7-year window, this is statistically unstable. The factor model reduces effective parameters and produces interpretable structure.

```
Y_it = α_i + B_i · F_t + ε_it

where:
  Y_it     = value of variable i at time t (centered, scaled)
  F_t      = vector of K systematic factors at time t
  B_i      = K-vector of factor loadings for variable i
  α_i      = mean of variable i
  ε_it     = idiosyncratic residual, ε_it ~ N(0, σ²_i)

Implied covariance:
  Σ = B · Σ_F · Bᵀ + Ψ
  
  where Ψ = diag(σ²_1, ..., σ²_n) is the residual covariance
```

**Initial factor specification (K = 6):**

| Factor | Definition | Primary loadings |
|--------|------------|------------------|
| F1: Rate environment | 10Y treasury + cap rate spread | exit_cap, debt_rate, transaction_velocity |
| F2: National employment | Unemployment + wage growth | rent_growth, occupancy, demand metrics |
| F3: Regional migration | Net domestic + international migration | rent_growth, demand metrics, traffic |
| F4: Asset-class beta | Sector-specific transaction volume | cap rates, rent growth in that sector |
| F5: Supply pressure | Permit velocity + completions | vacancy, rent_growth (negative loading) |
| F6: Sentiment / liquidity | VIX + transaction volume + DOM | momentum metrics, exit_cap |

**Why six.** Empirical PCA on real estate metric time series typically shows 5–8 components capturing >85% of variance. Six is a defensible starting point. Factor count gets refined in Phase 2 via cross-validation on out-of-sample variance prediction.

**Loadings B_i are interpretable.** "exit_cap loads 0.71 on F1 (rates), 0.18 on F4 (asset beta), -0.04 on F5 (supply)" — that's the kind of decomposition that explains *why* a deal is risky, not just that it is.

### 3.3 Regime Conditioning

Σ is not stationary. The 2008–2010, 2014–2019, 2022–2024 covariance structures are materially different. Three approaches; recommended is the third:

1. **Single rolling Σ (5–7 yr window).** Simple but lags regime changes by months.
2. **Hard regime switch.** Pre-classify each month into Expansion / Late-Cycle / Contraction; estimate Σ_r per regime. Brittle at transitions.
3. **HMM with regime probabilities.** Soft assignment. Σ_current = Σ_r π_r · Σ_r where π_r are posterior regime probabilities.

**HMM specification.**

States: {Expansion, Late-Cycle, Contraction}
Observable indicators (for regime classification, not part of Σ itself):
- Yield curve slope (10Y − 3M)
- Employment momentum (3-month change in unemployment rate)
- Transaction volume YoY
- Cap rate YoY direction
- Credit spread index

Transition matrix initialized from historical NBER cycle dating, refined via Baum-Welch on observed indicator sequences.

**Refresh cadence:** Weekly indicator update, monthly Σ_r refresh, regime probabilities recomputed weekly. Major macro events (Fed meetings, employment surprises) trigger ad-hoc reclassification.

### 3.4 Spatial Structure

Real estate has geographic structure that factor models alone don't capture. Atlanta submarkets co-move more with each other than with Tampa, even after controlling for national factors.

**Spatial kernel on residual covariance** (after factors are removed):

```
Cov(ε_i, ε_j) = σ_i · σ_j · ρ_spatial(i, j)

where:
  ρ_spatial(i, j) = exp(-d_ij / λ)
  d_ij = drive-time minutes between submarket i and submarket j
  λ = decay parameter, ~30 minutes for MSA-level coherence
```

**Why drive-time, not euclidean.** Two submarkets 5 miles apart but separated by a river with no bridge are not 5 miles apart functionally. Drive-time captures the lived reality of submarket connectivity.

**λ calibration.** Estimated by maximum likelihood on historical residuals. Likely range: 20–45 min depending on metric. Some metrics (cap rates) have longer spatial reach than others (occupancy).

### 3.5 Estimation Method

**Window:** Rolling 7-year monthly = 84 observations per variable. Trade-off: shorter windows (3–5 yr) catch regime changes faster but inflate noise; longer windows (10+ yr) span multiple regimes and average them inappropriately.

**Shrinkage:** Ledoit-Wolf shrinkage of sample covariance toward a structured target (typically diagonal of variances or single-factor model). Shrinkage intensity δ chosen analytically per the Ledoit-Wolf formula. This is non-negotiable for production estimates with n_obs ~ 84 and dimension ~55.

```
Σ_shrunk = (1 - δ) · Σ_sample + δ · Σ_target
```

**Factor model fitting:** Two passes. First pass: PCA on standardized residuals from a univariate de-trending to extract factor structure. Second pass: regression of each variable on identified factors to estimate B_i and σ²_i. Refit monthly.

**Distribution choice:** Multivariate Student-t with df=5 for sampling, not multivariate normal. Real estate metrics have fat tails; t with df=5 captures this without overcomplication. Σ is the same; only sampling/likelihood changes.

**Refresh cadence:**
- Weekly: regime probabilities, plausibility-scoring service (using current Σ)
- Monthly: factor loadings B, residual variances σ², spatial λ
- Quarterly: factor count K validation, target Σ_target structure review

---

## 4. Use Cases

### 4.1 Risk Decomposition (→ M14)

Variance attribution per factor. Given a deal's IRR sensitivity vector ∂IRR/∂x, the variance of IRR decomposes:

```
Var(IRR) = (∂IRR/∂x)ᵀ · Σ · (∂IRR/∂x)
        = (∂IRR/∂x)ᵀ · B · Σ_F · Bᵀ · (∂IRR/∂x) + (∂IRR/∂x)ᵀ · Ψ · (∂IRR/∂x)
        = systematic_variance + idiosyncratic_variance
```

Per-factor contribution: ((∂IRR/∂x)ᵀ B)² · σ²_F per factor. Output to user:

> "Your IRR variance is 38% rate exposure (F1), 27% regional employment (F3), 19% local supply (F5), 11% asset-class beta (F4), 5% idiosyncratic."

**This is the institutional-grade attribution that no other RE platform offers.** Replaces M14's current six-category weighted composite with a quantitative variance decomposition.

### 4.2 Monte Carlo Sampling (→ M14, M10)

Replaces M14's hand-tuned correlation Monte Carlo with Σ-consistent sampling.

```python
def sample_paths(n_samples=1000, horizon_months=60, regime=None):
    Σ = get_current_sigma(regime=regime)
    μ = get_current_means()
    samples = scipy.stats.multivariate_t.rvs(
        loc=μ, shape=Σ, df=5, size=n_samples
    )
    # samples shape: (n_samples, n_variables)
    return samples
```

Apply to underwriting variables (Block B) for IRR distribution; apply to market variables (Block A) for scenario generation. M10 Bull/Base/Bear becomes the (10, 50, 90) percentile paths through the joint distribution.

### 4.3 Conditional Forecasting (→ M35 + novel events)

For events without playbooks: the event provides shock magnitudes on contact variables; Σ propagates to everything else.

Standard conditional Gaussian formula:

```
Given x_observed (e.g., rate +50bps, employment -20bps):

x_unobserved | x_observed ~ N(μ_cond, Σ_cond)

where:
  μ_cond = μ_u + Σ_uo · Σ_oo⁻¹ · (x_observed - μ_o)
  Σ_cond = Σ_uu - Σ_uo · Σ_oo⁻¹ · Σ_ou
```

For a t-distribution, similar but with degrees-of-freedom adjustment.

**M35 integration.** When M35 has a playbook match, use the playbook's empirical impact distribution. When it doesn't (novel event, e.g., new regulatory regime), use the conditional Σ propagation as a fallback. Bayesian update: playbook = strong likelihood (narrow posterior); Σ propagation = weak likelihood (wide posterior, but still calibrated).

### 4.4 Plausibility Scoring (→ M09, M08, Cashflow Agent)

Given a proposed assumption set x = (rent_growth, exit_cap, vacancy, expense_growth, debt_rate, ltv, …), compute Mahalanobis distance from historical center under the current regime:

```
d²(x) = (x - μ)ᵀ · Σ⁻¹ · (x - μ)

Aggressiveness band:
  d ≤ 1.0       Realistic        (within 1σ ellipsoid; typical-year assumptions)
  1.0 < d ≤ 2.0 Stretch          (above-average market required)
  2.0 < d ≤ 3.0 Aggressive       (favorable regime + execution required)
  d > 3.0       Heroic           (atypical; require explicit defense)
```

**Per-variable decomposition.** Beyond the scalar d, decompose which variables push aggressiveness:

```
contribution_i = (x_i - μ_i) · [Σ⁻¹(x - μ)]_i
```

Sums to d². Output: "Your assumption set scores d=1.4 (Stretch). Drivers: rent_growth contributes 0.8, exit_cap contributes 0.4, occupancy contributes 0.2."

**Where it shows up.**
- M09 ProForma assumption sidebar: aggressiveness badge next to each user-edited cell
- Cashflow Agent: surfaces aggressiveness when proposing a model
- Investment Memo / DealContext: aggressiveness summary in the JEDI Score panel

### 4.5 Goal-Seeking Optimization (→ Cashflow Agent + M09)

The inverse problem from the 464 Bishop test:

> Given target IRR I*, find assumption set x such that proforma(x) = I*, ranked by aggressiveness.

Formulation:

```
minimize:    d²(x) = (x - μ)ᵀ · Σ⁻¹ · (x - μ)
subject to:  proforma(x) = I*                     (target hit)
             x ∈ feasible_region                  (market floors/ceilings)
             |x_i - x_0,i| ≤ Δ_i                  (per-variable max move)
```

**Solution method:** Sequential quadratic programming (SLSQP) initialized at x_0. The nonlinear constraint proforma(x) = I* is handled via Lagrangian; the feasibility box constraints are linear.

**Pareto frontier output.** Don't return a single point. Sweep target IRR across {I* - 100bps, I*, I* + 100bps} and aggressiveness budget across {1.0, 1.5, 2.0, 2.5}. Return the frontier of (IRR, d, x*) tuples.

**Capital stack co-movement** (per the 464 Bishop transcript). Treat debt structure as a categorical input that selects between candidate (debt_rate, ltv, io_period, refinance_spread) bundles. Each bundle has its own (μ_bundle, Σ_bundle) — HUD fixed has different Σ than bridge floating. Run goal-seek per bundle, compare across bundles. Output:

```
Pareto frontier for 464 Bishop, target = 15% IRR over 5 years:

  Bundle: Agency Fixed (75% LTV, 5.75%, 5yr IO)
    Realistic (d=0.9):  rent_growth 3.5%, exit_cap 5.5%, occ 93%   →  IRR 13.1%
    Stretch (d=1.4):    rent_growth 4.2%, exit_cap 5.4%, occ 94%   →  IRR 15.0%  ← target hit
    Aggressive (d=2.1): rent_growth 4.8%, exit_cap 5.25%, occ 95%  →  IRR 17.2%

  Bundle: HUD 221(d)(4) (83% LTV, 5.0%, 35yr amort)
    Realistic (d=0.7):  rent_growth 3.2%, exit_cap 5.5%, occ 93%   →  IRR 14.4%
    Stretch (d=1.1):    rent_growth 3.8%, exit_cap 5.4%, occ 94%   →  IRR 15.0%  ← target hit, lower d
    Aggressive (d=1.9): rent_growth 4.5%, exit_cap 5.25%, occ 95%  →  IRR 17.8%
    
  Bundle: Bridge Floating (70% LTV, SOFR+375, 3yr IO + ext)
    Note: Σ_bundle has high (debt_rate, cap_rate) covariance →
    higher Var(IRR). Same point estimate, wider distribution.
```

**Recommendation logic.** "HUD bundle hits 15% target at d=1.1 vs Agency Fixed at d=1.4. HUD is the lower-aggressiveness path. Trade-off: HUD adds 6–9 month closing window. Bridge floating reaches the target at similar d but with substantially higher IRR variance — exposed to joint rate-cap shock."

**This is exactly the underwriter-grade output the 464 Bishop test demanded.**

### 4.6 Stress Testing

Apply directional shocks to understand systemic exposures.

```
Stress scenario v_k (k-σ shock along eigenvector v):
  x_stress = μ + k · √(λ_v) · v
  
  where (λ_v, v) is an eigenvalue/eigenvector pair of Σ.
```

The first eigenvector (largest λ) is the principal systemic move — typically a "rates up + cap rates expand + rent growth slows + transaction volume drops" combo. Last eigenvectors are idiosyncratic. Stress tests apply k ∈ {2, 3} along principal components.

User output: "Under a 2σ rate-environment shock (the F1 factor at -2σ), your IRR distribution shifts from 13% median to 7% median, with 5th percentile at -2%."

### 4.7 Anomaly / Regime-Change Detection

Realized monthly observations deviate from Σ predictions. Track:

```
M_t = (x_t - μ_pred,t)ᵀ · Σ_pred,t⁻¹ · (x_t - μ_pred,t)
```

M_t follows a chi-squared distribution under the null. Sustained M_t > 95th percentile across multiple months → regime shift signal. Output as Kafka topic `sigma.anomaly_detected` for downstream consumers.

This complements M35: M35 catches *named* events (employer announcements, supply shocks); the anomaly detector catches *structural* shifts even when no named event triggered them.

---

## 5. Goal-Seeking Underwriting Flow (Cashflow Agent + M09)

End-to-end flow for a "solve for X% IRR" request.

**Trigger.** User says (in chat or web app): "Solve 464 Bishop for 15% IRR over 5 years."

**Step 1 — Resolve deal context.**
Cashflow Agent retrieves DealContext for 464 Bishop (cached or freshly assembled by Research Agent). Extracts current assumption set x_0 = (rent_growth=3%, exit_cap=5.75%, occupancy=92%, expense_growth=3.5%, debt_rate=7%, ltv=65%, …).

**Step 2 — Compute baseline.**
ProForma engine evaluates IRR(x_0) → 11.2%. Gap to target = 15.0% − 11.2% = 3.8%.

**Step 3 — Identify candidate capital stacks.**
Cashflow Agent queries `/api/debt-products?asset_class=multifamily&loan_size=12M&location=atlanta` → returns Agency Fixed, HUD 221(d)(4), Bridge Floating, CMBS, Agency Floating bundles with current pricing. Each bundle has its own (debt_rate, ltv, io_period) and a Σ_bundle attachment indicating its rate-cap covariance.

**Step 4 — Goal-seek per bundle.**
For each bundle:
```
POST /api/sigma/goal-seek
  body: {
    deal_id: "464-bishop",
    target: { metric: "irr", value: 0.15, horizon_months: 60 },
    base_assumptions: x_0,
    bundle_id: "agency-fixed-75ltv",
    constraints: { ltv_max: 0.83, exit_cap_min: 0.045, ... },
    aggressiveness_budgets: [1.0, 1.5, 2.0, 2.5]
  }
```
Returns Pareto frontier for that bundle.

**Step 5 — Cross-bundle ranking.**
For each aggressiveness budget level, find the bundle that hits the target at lowest d. Compute IRR variance per bundle (uses Σ_bundle). Rank by (target_hit, lowest_d, lowest_variance).

**Step 6 — Synthesis.**
Cashflow Agent generates:

```
Recommendation: HUD 221(d)(4)

The 15% IRR target is achievable through capital stack optimization combined 
with modest assumption changes. HUD 221(d)(4) at 83% LTV / 5.0% / 35-yr amort 
hits the target at aggressiveness d=1.1 (Stretch), the lowest of any bundle 
considered.

Required assumption changes from current:
  rent_growth     3.0% → 3.8%  YoY    (+80bps; stretch but supported by 
                                        regional migration trend)
  exit_cap        5.75% → 5.4%        (-35bps; consistent with current 
                                        cap rate compression in submarket)
  occupancy       92% → 94%             (+200bps; achievable with operational 
                                          improvements)
  expense_growth  3.5% → 3.0%           (-50bps; below market trend, but 
                                          executable with property mgmt change)

Capital stack:
  Switch from current 65% LTV bridge at 7% to HUD at 83% LTV / 5.0%.
  Reduces equity check by ~$2.1M, lowers debt service by ~$220k/yr in years 1-5.
  Trade-off: HUD closing timeline 6-9 months. Bridge → HUD refinance 
  feasible if entitled to use bridge first.

Alternative: Agency Fixed (75% LTV, 5.75%) hits target at d=1.4 with no 
closing-timeline risk. Lower aggressiveness on the assumption side, higher on 
the financing side.

Variance check: IRR distribution under HUD bundle is 15.0% median, 12.1% / 18.3% 
p10/p90. Under Bridge Floating bundle, same point estimate, wider distribution: 
10.4% / 19.8% p10/p90 — the joint rate-cap shock is the dominant tail risk.
```

**Step 7 — User actions.**
- Accept recommendation → ProForma updates with new assumptions, plausibility badge shows d=1.1
- Drill into per-variable: "why exit_cap 5.4%?" → shows COR pairings, current submarket trend, factor decomposition
- Sensitivity: "what if HUD doesn't approve?" → re-runs with Agency Fixed
- Save to deal as scenario

**Step 8 — Logging.**
Each goal-seek run is logged in `goal_seeking_runs` table. Used for:
- Backtesting the solver (did targets hit within stated d?)
- Training data for Cashflow Agent prompt refinement
- Auditability ("here's why we underwrote at these numbers")

---

## 6. Capital Stack Co-Movement

The 464 Bishop transcript surfaced a structural truth that needs explicit treatment in M36: **capital stack choices have correlated risks that pairwise correlations don't capture.**

### 6.1 The Problem

Floating-rate debt rate moves with SOFR. Cap rates move with treasury rates. Both load on factor F1 (rate environment). If you finance with bridge floating AND assume cap rate compression, you're betting against F1 in both your debt and your exit. A 100bp upward rate move hits both channels simultaneously.

HUD fixed insulates one channel. Bridge floating doubles up exposure. Today's platform doesn't show this co-movement; it treats debt structure as an exogenous input.

### 6.2 The Treatment

Each debt bundle is associated with a Σ_bundle that includes the bundle's specific (debt_rate, refinance_spread, io_remaining_at_exit) variables. These variables have factor loadings that reflect the bundle's nature:

| Bundle | F1 (rate) loading on debt_rate | Refinance risk | Implied joint shock exposure |
|--------|-------------------------------|----------------|------------------------------|
| Agency Fixed (5yr IO) | 0.0 (locked) | Year 5+ | Single-channel (cap only) |
| Agency Floating | 0.95 | Continuous | Joint (debt + cap) |
| HUD 221(d)(4) | 0.0 (35yr fixed) | Year 35+ | Single-channel |
| Bridge Floating (3yr) | 0.95 | Year 2-3 (acute) | Joint + window |
| CMBS (5yr) | 0.0 (locked) | Year 5 | Single-channel + window |

### 6.3 IRR Variance Per Bundle

Var(IRR) computed per bundle, conditioning on the bundle's loadings:

```
Var(IRR | bundle b) = (∂IRR/∂x)ᵀ · Σ_b · (∂IRR/∂x)

Σ_b reflects the bundle's debt-rate stickiness.
```

Bundles with floating debt exposed to F1 produce higher Var(IRR). Even when point estimates are equal, the distributions differ. M14 surfaces this.

### 6.4 "Natural Hedges" in the Stack

When the deal's IRR has positive loading on F1 (e.g., low cap rate at exit benefits from low rates), pairing with floating debt cancels exposure (loss on debt offsets gain on cap). When IRR has negative F1 loading, pairing with fixed debt minimizes joint risk.

The Cashflow Agent uses this to recommend stack structure:
- If exit horizon is 5+ years and rates expected to fall: floating debt natural hedge
- If exit horizon is <5 years and rates expected to rise: fixed debt insulates
- If uncertain: fixed debt minimizes Σ-implied IRR variance

### 6.5 "Double-Up" Detection

Flag when assumption changes and capital stack are both betting the same direction on a factor:

> "Warning: rent_growth assumption (4.5%) and bridge floating debt both assume favorable rate environment (F1 negative). If F1 reverses, both legs lose. Consider HUD fixed to insulate debt channel."

This is the kind of underwriter-grade insight that the 464 Bishop test agent was *almost* providing intuitively. M36 makes it formal.

---

## 7. Database Schema

```sql
-- Stored covariance matrices (one per regime + asset class + scope)
CREATE TABLE covariance_matrices (
  matrix_id          UUID PRIMARY KEY,
  estimation_date    TIMESTAMPTZ NOT NULL,
  regime             VARCHAR(20) NOT NULL,        -- 'expansion' | 'late_cycle' | 'contraction' | 'blended'
  asset_class        VARCHAR(20) NOT NULL,        -- 'multifamily' | 'office' | 'industrial' | ...
  geographic_scope   VARCHAR(50) NOT NULL,        -- 'national' | msa_id | submarket_id
  n_variables        INT NOT NULL,
  variable_list      JSONB NOT NULL,              -- ordered list of variable IDs
  cov_matrix         JSONB NOT NULL,              -- packed flat array, n×n
  mean_vector        JSONB NOT NULL,              -- length-n
  estimation_method  VARCHAR(50) NOT NULL,        -- 'rolling_window_lw' | 'factor_model'
  shrinkage_intensity FLOAT,
  factor_count       INT,
  window_months      INT NOT NULL,
  is_active          BOOLEAN DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cov_active ON covariance_matrices(asset_class, geographic_scope, regime) 
  WHERE is_active = true;

-- Factor loadings (B matrix, sparse representation)
CREATE TABLE factor_loadings (
  loading_id    UUID PRIMARY KEY,
  matrix_id     UUID REFERENCES covariance_matrices(matrix_id) ON DELETE CASCADE,
  variable_id   VARCHAR(50) NOT NULL,
  factor_id     VARCHAR(50) NOT NULL,             -- 'F1_rate' | 'F2_employment' | ...
  loading_value FLOAT NOT NULL,
  std_error     FLOAT,
  t_stat        FLOAT,
  UNIQUE (matrix_id, variable_id, factor_id)
);

CREATE INDEX idx_loadings_matrix ON factor_loadings(matrix_id);

-- Factor definitions (descriptive metadata)
CREATE TABLE factors (
  factor_id     VARCHAR(50) PRIMARY KEY,
  factor_name   VARCHAR(100) NOT NULL,
  description   TEXT,
  primary_indicator VARCHAR(100),                 -- the macro variable that anchors the factor
  is_active     BOOLEAN DEFAULT true
);

-- Regime classifications over time
CREATE TABLE regime_classifications (
  classification_id   UUID PRIMARY KEY,
  classification_date DATE NOT NULL,
  regime              VARCHAR(20) NOT NULL,
  probability         FLOAT NOT NULL,             -- HMM posterior
  hmm_state           INT,
  macro_indicators    JSONB,                      -- inputs at time of classification
  classifier_version  VARCHAR(20),
  UNIQUE (classification_date)
);

-- Spatial structure parameters
CREATE TABLE spatial_kernels (
  kernel_id        UUID PRIMARY KEY,
  matrix_id        UUID REFERENCES covariance_matrices(matrix_id),
  variable_id      VARCHAR(50) NOT NULL,
  kernel_type      VARCHAR(20) NOT NULL,          -- 'exponential' | 'matern'
  decay_lambda     FLOAT NOT NULL,                -- λ in minutes (drive-time)
  variance_scale   FLOAT NOT NULL                 -- σ² for residual
);

-- Per-deal plausibility scores (cached for performance)
CREATE TABLE plausibility_scores (
  score_id              UUID PRIMARY KEY,
  deal_id               UUID NOT NULL,
  matrix_id             UUID REFERENCES covariance_matrices(matrix_id),
  assumption_set        JSONB NOT NULL,           -- the x evaluated
  mahalanobis_distance  FLOAT NOT NULL,
  aggressiveness_band   VARCHAR(20) NOT NULL,     -- 'realistic' | 'stretch' | 'aggressive' | 'heroic'
  factor_decomposition  JSONB,                    -- per-variable contribution
  computed_at           TIMESTAMPTZ DEFAULT now(),
  expires_at            TIMESTAMPTZ                -- invalidated on Σ refresh
);

CREATE INDEX idx_plaus_deal ON plausibility_scores(deal_id, computed_at DESC);

-- Goal-seeking solver runs
CREATE TABLE goal_seeking_runs (
  run_id              UUID PRIMARY KEY,
  deal_id             UUID NOT NULL,
  user_id             UUID,
  target_metric       VARCHAR(50) NOT NULL,       -- 'irr' | 'coc' | 'em'
  target_value        FLOAT NOT NULL,
  base_assumptions    JSONB NOT NULL,
  constraints         JSONB,                      -- box constraints, feasibility
  bundles_evaluated   JSONB,                      -- list of bundle_ids
  pareto_frontier     JSONB,                      -- list of {bundle, x, irr, d, var_irr}
  recommended_bundle  VARCHAR(50),
  recommended_x       JSONB,
  computed_at         TIMESTAMPTZ DEFAULT now(),
  duration_ms         INT
);

CREATE INDEX idx_goalseek_deal ON goal_seeking_runs(deal_id, computed_at DESC);

-- Anomaly events (regime shift or unexplained variance)
CREATE TABLE sigma_anomalies (
  anomaly_id         UUID PRIMARY KEY,
  detected_at        TIMESTAMPTZ DEFAULT now(),
  matrix_id          UUID REFERENCES covariance_matrices(matrix_id),
  observation_date   DATE NOT NULL,
  mahalanobis_score  FLOAT NOT NULL,              -- M_t
  chi2_pvalue        FLOAT NOT NULL,              -- under null
  driving_variables  JSONB,                       -- which vars contributed most
  status             VARCHAR(20) DEFAULT 'open',  -- 'open' | 'investigating' | 'attributed_to_event' | 'regime_shift'
  attributed_event_id UUID                        -- if M35 attributes it later
);
```

---

## 8. API Endpoints

```
# Σ retrieval
GET  /api/sigma/current?regime=&asset_class=&scope=
     → CovarianceMatrix (with mean vector, factor loadings, metadata)

GET  /api/sigma/history?from=&to=&regime=
     → CovarianceMatrix[] (for backtesting, trend analysis)

GET  /api/sigma/factors
     → Factor[] with current loadings summary

GET  /api/sigma/regime/current
     → { regime, probabilities: {expansion, late_cycle, contraction}, indicators, last_change }

GET  /api/sigma/regime/history?from=&to=
     → RegimeClassification[]

# Plausibility scoring
POST /api/sigma/plausibility
     body: { deal_id, assumption_set, regime?, asset_class? }
     → { mahalanobis_d, band, factor_decomposition, per_variable_contributions }

GET  /api/sigma/plausibility/:deal_id/latest
     → cached score

# Goal-seeking
POST /api/sigma/goal-seek
     body: {
       deal_id,
       target: { metric, value, horizon_months },
       base_assumptions,
       bundle_id?,        # if specified, single-bundle; else cross-bundle
       constraints,
       aggressiveness_budgets: [1.0, 1.5, 2.0, 2.5]
     }
     → ParetoFrontier { per_bundle: [{ bundle, points: [{x, irr, d, var_irr}] }], recommendation }

GET  /api/sigma/goal-seek/:run_id
     → past run with full output

# Sampling and conditional forecasting
POST /api/sigma/sample
     body: { n_samples, regime?, asset_class?, scope?, variable_subset? }
     → { samples: [[float]], variable_order: [string] }

POST /api/sigma/condition
     body: { observed: { var_id: value, ... }, target_variables: [var_id] }
     → { conditional_mean: {var_id: value}, conditional_cov: [[float]] }

# Stress testing
POST /api/sigma/stress
     body: { deal_id, factor_shocks: { F1: -2.0, F3: -1.5, ... } }
     → { irr_distribution: { p10, p50, p90 }, factor_attribution }

# Anomaly detection
GET  /api/sigma/anomalies?since=&status=
     → SigmaAnomaly[]

POST /api/sigma/anomalies/:id/attribute
     body: { event_id }
     → updates anomaly with M35 event attribution

# Capital stack co-movement
GET  /api/sigma/bundles?asset_class=&loan_size=&location=
     → DebtBundle[] with Σ_bundle metadata
```

**Kafka topics:**
- `sigma.recomputed` — Σ refreshed (consumers re-cache)
- `sigma.regime_change` — regime probability shift > threshold
- `sigma.anomaly_detected` — high Mahalanobis observation
- `plausibility.scored` — assumption set evaluated (for audit log)
- `goalseek.completed` — solver finished (for usage analytics)

---

## 9. Integration with Existing Modules

### 9.1 M14 Risk Module

**Today:** Six-category weighted composite risk score. Monte Carlo specced but using hand-tuned correlations.

**With M36:**
- Risk decomposition replaces six-category composite as the primary risk view. Categories remain as explanatory groupings of factor loadings.
- Monte Carlo draws from Σ. IRR distribution becomes calibrated rather than approximate.
- Risk score = f(systematic_variance, idiosyncratic_variance, tail_risk_metric). Tail risk uses 5th percentile of IRR distribution, not point variance.
- New panel: "Variance attribution" showing factor-level contributions.

**Wire-up:**
```
M14.compute_risk(deal_id):
  Σ = M36.get_current_sigma(deal.asset_class, deal.scope)
  sensitivities = compute_irr_sensitivities(deal.proforma)
  total_var = sensitivities.T @ Σ @ sensitivities
  factor_contribs = compute_factor_attribution(sensitivities, B, Σ_F)
  irr_distribution = M36.sample_irr(deal_id, n=1000)
  return RiskOutput(
    composite_score=...,
    factor_attribution=factor_contribs,
    irr_distribution=irr_distribution,
    tail_risk_5p=...
  )
```

### 9.2 M10 Scenario Engine

**Today:** Bull / Base / Bear / Stress with parameter perturbations of the base case.

**With M36:**
- Scenarios become percentile paths through the Σ-consistent distribution.
- Base = median path; Bull = 90th percentile; Bear = 10th percentile; Stress = 2σ shock along principal eigenvector.
- Each scenario carries factor decomposition: "Bull case is driven by F3 (regional migration) at 90th percentile."
- Probability-weighted return calculation becomes rigorous (probability comes from Σ percentile, not analyst guess).

### 9.3 M35 Event Impact Engine

**Today:** Playbook library for known event types. Forecast-and-backtest framework.

**With M36:**
- Σ provides prior for novel events (no playbook match). Event provides shock on contact variables; Σ propagates to all others.
- Bayesian update structure: prior = Σ propagation; likelihood = playbook (if exists); posterior = combined. Playbook narrows the posterior; Σ gives the baseline.
- Anomaly detector (`sigma.anomaly_detected`) feeds M35 as candidate "unidentified events" — high-Mahalanobis observations that weren't caught by news feeds. Triggers manual review or M35 backfill ingestion.

### 9.4 M09 ProForma Engine

**Today:** Three-layer LayeredValue model (broker / platform / user). User overrides displayed but not scored.

**With M36:**
- Plausibility badge next to each user-edited cell. Real-time scoring as the user types (debounced).
- Aggressiveness summary at the top of the assumption sidebar: "Current model is at d=1.6 (Stretch). Drivers: rent_growth (+0.8 to d), exit_cap (+0.5 to d)."
- "Solve for IRR" button → triggers Cashflow Agent goal-seek flow.
- Compare-to-platform-baseline view shows d for each layer.

### 9.5 M08 Strategy Arbitrage

**Today:** Deterministic 4-strategy scoring with weighted signals. Arbitrage flag when score gap > threshold.

**With M36:**
- Strategy scores get variance from Σ. Score becomes (mean, variance) instead of point estimate.
- Probabilistic ranking: P(BTS > Rental) computed from joint score distribution.
- Arbitrage flag becomes statistically defensible: "BTS dominates Rental with 72% probability."
- Sensitivity analysis: "Which factor must shift for Rental to overtake BTS? F5 (supply pressure) +1.2σ."

### 9.6 M25 JEDI Score

**Today:** Composite score 0-100 from five sub-scores.

**With M36:**
- JEDI Score becomes (mean, confidence_interval). Display: "JEDI Score 78 ± 6 (90% CI)."
- CI computed from Σ via the same sensitivity formula as M14.
- Score history tracking: when CI widens, regime is becoming more uncertain; flag.

### 9.7 Cashflow Agent

**Today:** Generates pre-computed financial model snapshots via structured JSON.

**With M36:**
- Goal-seeking flow becomes a primary capability (the 464 Bishop test).
- Plausibility-aware reasoning: agent must justify any d > 1.5 assumption set with explicit market evidence.
- Capital stack reasoning uses Σ-bundle metadata to flag double-up exposures and recommend natural hedges.
- Pre-prompt context includes: current Σ summary, regime probabilities, top factor exposures for the deal.

**Cashflow Agent prompt augmentation:**
```
You are underwriting [deal]. Current regime: [regime] (probability X%).
Key factor exposures: F1 (rate) loading 0.7 on cap rate, F3 (migration) 
loading 0.4 on rent growth.

When proposing assumptions, you must:
1. Score plausibility (call sigma/plausibility API)
2. If d > 1.5, justify each contributing variable with market evidence
3. For capital stack choices, check Σ_bundle for double-up exposures
4. If solving for a target metric, return Pareto frontier across bundles

Do not propose assumption sets with d > 3.0 without explicit user override.
```

---

## 10. Implementation Sequence

**Phase 1 — Data foundation (3 sessions)**

1. Metric time-series consolidation. Σ requires aligned monthly time series across all ~55 variables. Audit existing M05 / M06 / M04 / M07 data for gaps and alignment. Build extraction service that produces a unified panel.
2. Variable inventory + alignment infrastructure. Define canonical variable IDs, units, transformations (log differences for stationarity, etc.). Versioned variable registry.
3. Initial factor specification. Six factors per the spec above. Macro indicator data sources confirmed (FRED for treasury, BLS for employment, etc.).

**Phase 2 — Σ estimation (3 sessions)**

4. Rolling-window estimation pipeline. 7-year window, monthly refresh. Output: sample Σ, sample μ.
5. Ledoit-Wolf shrinkage implementation. Apply to sample Σ. Validate on known test cases.
6. Factor model fitting. PCA-based factor extraction; OLS regression for loadings; F-stat / t-stat per loading. Output: B, Σ_F, Ψ.

**Phase 3 — Regime detection (2 sessions)**

7. HMM regime classifier. Three states. Indicators wired (yield curve, employment, transaction volume, cap rate direction). Baum-Welch initialization from NBER cycle dating.
8. Regime-conditional Σ assembly. Per-regime Σ_r estimated. Blended Σ_current as posterior-weighted combo.

**Phase 4 — Plausibility & goal-seeking (3 sessions)**

9. Plausibility scoring API. Mahalanobis distance, aggressiveness banding, per-variable decomposition. Cached per deal.
10. Goal-seeking optimization. SLSQP solver. ProForma function as constraint. Pareto frontier sweep.
11. Capital stack bundle integration. Bundle catalog, per-bundle Σ_bundle, cross-bundle ranking logic.

**Phase 5 — Integration (4 sessions)**

12. M14 Monte Carlo wired to Σ. Variance attribution panel built.
13. M10 Scenario sampler wired. Bull/Base/Bear from Σ percentiles.
14. M09 plausibility display + Cashflow Agent goal-seek flow. UI badges, "Solve for IRR" button, agent prompt augmentation.
15. M35 event-Σ propagation. Conditional forecast for novel events. Anomaly detector → M35 candidate event pipeline.

**Phase 6 — Anomaly + maintenance (2 sessions)**

16. Anomaly detection on residuals. M_t computation, chi-squared significance, Kafka event emission.
17. Σ refresh scheduler + Kafka topics. Weekly / monthly cadences. Cache invalidation on refresh.

**Total: ~17 sessions.**

Phase 4 is the critical-path unlock for the underwriting use case — completing it gives the platform the goal-seeking capability the 464 Bishop test demanded. Phase 5 is high-leverage integration. Phases 1-3 are foundation that enables everything else.

---

## 11. Open Design Questions

Items that need decisions before implementation begins. None block the spec; all benefit from explicit choice rather than implicit default.

**Q1. Factor count K.** Start with 6 as specified, or learn K from data via cross-validated PCA? Recommendation: start with 6, validate with held-out variance prediction in Phase 2, allow K to drift to 5-8 based on out-of-sample fit.

**Q2. Spatial kernel form.** Exponential decay vs Matern vs Gaussian? Recommendation: Exponential. Simplest, defensible, adequate for the geographic scales in play.

**Q3. Distance metric.** Drive-time vs euclidean vs commute-flow? Recommendation: drive-time, queried from existing geographic services. Calibrate λ per asset class (industrial has different connectivity than multifamily).

**Q4. Regime classification cadence.** Weekly HMM updates with smoothing, or monthly with stability? Recommendation: weekly indicator update, monthly Σ_r refresh, weekly regime probability recomputation. Major macro events trigger ad-hoc reclassification.

**Q5. Σ for sparse-history asset classes.** Data centers, life sciences, niche product types lack sufficient history for Σ estimation. Use Bayesian shrinkage toward asset-class prior, or hierarchical Bayesian model with cross-asset borrowing? Recommendation: defer until Phase 5; for launch, use multifamily / office / industrial / retail Σ; flag others as "insufficient data."

**Q6. User-facing Σ exposure.** How much of Σ is visible to the user — raw matrix, factor decomposition, just plausibility scores? Recommendation: 
- Default: aggressiveness badges and factor attribution only
- Power-user mode (Principal/Institutional tier): factor decomposition expandable per metric
- Internal/admin: raw Σ with eigenvalue spectrum and stability diagnostics

**Q7. Distribution: Gaussian vs t.** Real estate has fat tails. Recommendation: t with df=5 for sampling. Σ itself unchanged; only the sampling distribution and likelihood differ. Validate df via tail backtesting.

**Q8. Backtesting framework.** How to validate Σ produces calibrated forecasts? Recommendation: monthly out-of-sample variance prediction. Track reliability diagrams on percentile predictions (does the 90th percentile actually exceed reality 90% of the time?). Surface in admin dashboard.

**Q9. Aggressiveness band thresholds.** d ∈ {1, 2, 3} for {Realistic, Stretch, Aggressive, Heroic} is round-number convenience. Should thresholds be calibrated to historical distributions of underwriter-proposed assumptions? Recommendation: start with round numbers, calibrate empirically once 6+ months of plausibility-scoring data accumulates.

**Q10. Goal-seek under infeasibility.** What if no x achieves target IRR within feasibility region? Recommendation: solver returns the Pareto-optimal x at maximum-feasible IRR plus an explanation: "Target 15% IRR is infeasible under current Σ and constraints. Closest reachable: 13.4% at d=2.8."

---

## 12. Out of Scope (For This Spec)

Things that are *related* to Σ but not part of M36's launch scope. Listed to clarify boundaries.

- **Causal structure learning.** Σ captures co-movement, not causation. Causal DAG learning (Granger, IV, structural VAR) is a separate problem, deferred to a future "Causal Engine."
- **Real-time Σ estimation.** Σ refreshes monthly. Intra-month, the cached Σ is used. Real-time would require streaming covariance estimation; not needed for launch.
- **Cross-deal portfolio optimization.** M36 produces per-deal IRR variance and goal-seeking. Portfolio-level optimization (which deals to buy together to minimize joint variance) is a Portfolio module concern (M22), not M36.
- **Σ as a tradeable factor exposure.** Σ tells you exposure; it doesn't recommend hedging instruments. Hedging product recommendations (e.g., interest rate swaps, REIT shorts) are a future capability.
- **Synthetic event generation.** Generating realistic synthetic event sequences for stress testing is interesting but not Phase 1 scope.

---

## 13. Why This Matters

The 464 Bishop test exposed the difference between an LLM that can list relevant levers and an LLM that can underwrite. The first is impressive but un-defensible. The second requires two things the platform doesn't yet have:

1. **A formal notion of plausibility** — not "this sounds reasonable" but "this assumption set is at d=1.4 in the historical distribution, with 65% of the aggressiveness coming from rent growth and 25% from exit cap compression."
2. **A formal notion of joint risk** — not "rates could rise" but "your debt rate, exit cap, and rent growth jointly load on F1, so a 2σ rate shock moves your IRR from 15% to 7%."

Σ is the mathematical object that makes both formal. M36 is the module that owns Σ.

The platform's existing modules — Correlation Engine, Strategy Weights, M14 Risk, M10 Scenarios, M35 Events — all *implicitly* depend on a covariance structure. Today they each carry their own approximation of it (pairwise, weighted, hand-tuned, playbook-conditional). M36 makes the covariance explicit, shared, and rigorous. Once it exists, the existing modules become coherent — they're no longer four different fuzzy approximations of the same underlying thing.

This is what moves the platform from "AI-powered analysis tool" to "operating system for real estate." Operating systems own the structural primitives. Σ is one of those primitives.

---
