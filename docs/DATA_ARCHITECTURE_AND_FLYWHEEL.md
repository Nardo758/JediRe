# JEDI RE Data Architecture & Learning Flywheel
## Version 2.0 | June 2026
## *Merged with CORRELATION_ENGINE_LOOKBACK_SPEC — corrected for lag-aware minimums, pairing-level windows, and the outcome panel.*

---

## 0. The One Rule That Reframes Everything

**Lookback is a property of the PAIRING, not the series.** A correlation needs both legs to span the same window, and to detect a lag of L months it needs L + enough post-lag samples to fit. Three consequences a flat per-series table silently violates:

1. **Minimum must be lag-aware.** To see an 18–30 mo lag (COR-08 permits→cap rate) a 12-mo series detects *nothing*. Floor = `longest_lag(series) + ~24 samples`. We call this **Calib-Floor**.
2. **Binding constraint = the shorter leg.** A pairing's usable window = `min(window_x, window_y)`. Your shortest series caps every pairing it touches (digital traffic at 12 mo caps the COR-10 chain).
3. **You need an OUTCOME panel, not just leading series.** The engine *learns* r — it requires the realized outcome at `t+lag` paired with the leading metric. Without it, every `expected_r` is a hypothesis, never a measured coefficient. **This is the #1 missing data.** *(see §4)*

---

## 1. Master Lookback Table

`Op-Min` = enough to display a live value. `Rec` = healthy operating depth. **`Calib-Floor`** = the lag-aware minimum to *fit/validate* the correlation. `Status`: ✓ in your table · ➕ MISSING (add).

| Data type | Op-Min | Rec | **Calib-Floor** | Longest-lag pairing | Used for | Source | Status |
|---|---|---|---|---|---|---|---|
| Rent comps (asking) | 12 | 36 | **48** | COR-06 rent decel (6–18mo) | F3 comps, position adj | CoStar/Apartments.com, RentCast | ✓ |
| **Concessions / effective rent** | 6 | 36 | **48** | COR-09 deliveries→concession (1–3mo)* | effective-rent signal, NOI | Apartments.com listings, surveys | ➕ |
| Traffic / walk-ins | 6 | 24 | **36** | COR-01 surge→rent (3–6mo) | M07 prediction, funnel | Google realtime, on-site | ✓ |
| Road / ADT (baseline) | 6 | 36 | **36** | surge baseline | surge denominator | FDOT, county ADT | ✓ |
| Digital traffic (property) | 3 | 12 | **24** | visibility scoring | visibility | SpyFu, GMB | ✓ (raise min) |
| **Search / demand momentum (submarket)** | 6 | 24 | **24** | COR-10 formation→search (3–6mo) | earliest demand | Google Trends, search vol | ➕ |
| **Business formation velocity** | 12 | 48 | **48** | COR-10 (longest-lead chain) | leading demand | Census BFS, county registrations | ➕ |
| Employment / **wages** | 12 | 36 | **48** | COR-04 wage→rent (multi-qtr) | M06 demand | BLS QCEW (wages, not just counts) | ✓ (add wages) |
| Population / migration | 24 | 120 | **60** | migration→absorption (~12mo) | submarket trajectory | Census/ACS, IRS migration | ✓ |
| Building permits | 12 | 60 | **60** | COR-08 permit→cap (18–30mo) | supply pipeline | County records, impact fees | ✓ (raise min) |
| **Deliveries / completions** | 12 | 60 | **60** | COR-08, COR-09 | supply hitting market | CO records, utility connections | ➕ |
| **Net absorption (market)** | 6 | 60 | **60** | COR-06/07 equilibrium | demand realization | market surveys, snapshots | ➕ |
| Occupancy / lease-up (property) | 6 | 36 | **36** | COR-05 surge→vacancy (2–4mo) | starting state, velocity | rent rolls, snapshots | ✓ |
| Transactions / cap rates | 12 | 60 | **60** | COR-08 (18–30mo) | exit pricing | comps, CompStak, deeds | ✓ (raise min) |
| NOI / OPEX actuals | 12 | 36 | **36** | learning anchors | OPEX anchors, learning | owned actuals, Data Library | ✓ |
| **Reviews / NLP sentiment** | 6 | 24 | **24** | sentiment-delta (6mo windows) | ops signal, amenity demand | Google/Yelp reviews | ➕ |
| **Corporate health (M33)** | 12 | 60 | **60** | employer→vacancy (6–18mo) | leading employer signal | public filings, 10-K/earnings | ➕ |
| Macro (CPI, rates, unemp) | 12 | 120 | **60** | rate→cap (18–30mo) | discount, spreads | FRED, BLS | ✓ |
| Market events | 12 | 60 | **60** | event deltas, backtest | M35 causality | curated event log | ✓ |

\*Concessions' own lag is short, but to *learn* it the panel must overlap the delivery series → 48 mo.

**Raise these minimums:** permits 12→**36+**, transactions 12→**36+**, digital traffic 12→**24**. Add **wages** to the employment series (COR-04 keys on wage growth, not headcount).

---

## 2. Pairing-Level Windows (The Binding Constraint)

For each correlation, usable window = `min(leg_x, leg_y)`. The long-lag pairings are the ones that fail silently if either leg is short:

```
COR-08  permits → cap rate          lag 18–30mo   → needs BOTH legs ≥ 60mo   (the demanding one)
COR-06  pipeline → rent growth      lag 6–18mo    → BOTH ≥ 48mo
M33     corporate health → vacancy  lag 6–18mo    → BOTH ≥ 60mo
COR-04  wages → rent                multi-quarter → BOTH ≥ 48mo
COR-10  biz formation → search      lag 3–6mo     → BOTH ≥ 24mo (formation series is the bottleneck)
COR-01  surge → rent                lag 3–6mo     → BOTH ≥ 36mo
COR-05  surge → vacancy             lag 2–4mo     → BOTH ≥ 36mo
COR-09  deliveries → concessions    lag 1–3mo     → BOTH ≥ 48mo (concession series is the bottleneck)
COR-07  absorption / pipeline       concurrent    → BOTH ≥ 36mo (equilibrium, no lag fit)
```

**Rule:** Before computing or trusting a pairing's r, check `min(leg_x, leg_y) ≥ Calib-Floor` of the *longer-lag* leg. If not, mark the r as **hypothesized, not fitted** — never present an unfitted r as measured.

---

## 3. Retention Horizon & Regime Weighting

**Keep 10 years (120 mo) for backfillable series; weight it by recency; tag the regime breaks.** Ten years is a *cap*, not a floor — orthogonal to the per-pairing Calib-Floor in §1 (floor = minimum overlap to fit a lag; cap = how far back you retain).

### 3.1 Why 10 years — regime variance, not data volume

```
2016–2019  late-cycle expansion, cap compression, strong rent growth
2020       COVID demand shock, urban exodus, eviction moratoria
2021–2022  Sun Belt rent surge (Tampa near top), record growth
2022–2024  Fed hiking → cap-rate expansion → transaction freeze + supply wave
2024–2026  supply digestion, normalizing
```

The value is that correlations are **regime-dependent**. A relationship measured only on a falling-rate, one-directional market can't tell you how it behaves in a turn. Ten years contains a boom *and* a rate-shock correction — so it lets you discover *which* correlations are stable vs conditional.

### 3.2 Recency weighting — do NOT equal-weight the decade

Longer ≠ uniformly better; market structure breaks (post-COVID concession behavior, the rate environment, WFH→office). Weight each observation:

```
w(age_months) = 0.5 ^ (age_months / HALF_LIFE)
HALF_LIFE = 42 months  (~3.5yr) — keeps the full decade in view, lets recent regimes dominate

  age 0mo   → weight 1.00
  age 42mo  → weight 0.50
  age 84mo  → weight 0.25
  age 120mo → weight ~0.14   (present but cannot outvote recent structure)
```

Fit weighted correlations, not equal-weight. A 2017 relationship at full weight must not outvote a structurally different 2025 one.

### 3.3 Regime tags — enables conditional correlations

Tag every observation with the regime it falls in (breaks: `2020-03` COVID, `2022-03` rate pivot — extend as needed). Then for each pairing the engine can produce:

```
r_blended            (recency-weighted, all regimes)        ← default display
r_by_regime[regime]  (conditional)                          ← when n per regime is sufficient

  if |r_by_regime| diverge materially across regimes → the pairing is REGIME-CONDITIONAL;
  surface the conditional r matching the CURRENT regime, not the blend.
  M36 covariance consumes regime-conditional inputs where they exist.
```

### 3.4 Native-series exception — heterogeneous history is normal

10yr is achievable only for **backfillable public series** (permits, deliveries, transactions, FRED, Census, QCEW, migration — pull full decade at ingest). **Platform-native series** (traffic surge, submarket search, reviews/sentiment, your own deal outcomes) cannot predate the platform, so they're capped at platform age. The engine handles uneven leg lengths via the common-window rule (§2): a pairing's window = `min(leg_x, leg_y)`, so a 24-mo native series caps any pair it joins regardless of the 120-mo public leg beside it.

```
RETENTION:
  backfillable public series   → 120 mo (backfill now)
  platform-native series       → min(platform_age, 120 mo), accumulate forward
  ALL series                   → recency-weighted (§3.2) + regime-tagged (§3.3)
  per-pairing fit gate         → still governed by Calib-Floor (§1) on the longer-lag leg
```

---

## 4. The Outcome Panel — The #1 Missing Data

A correlation engine needs paired observations: `(leading_metric_at_t, realized_outcome_at_t+lag)`. You have leading series; you do **not** have the realized-outcome panel to fit against. Current state: `historical_observations` stabilization columns = 0 rows; no outcome-tracking schema. Until this exists, the engine can *display* COR hypotheses but cannot *calibrate* them.

### Required Schema (greenfield)

```sql
CREATE TABLE outcome_panel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submarket_id TEXT NOT NULL,
  msa_id TEXT,
  period_date DATE NOT NULL,              -- t (leading metric snapshot date)
  as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,  -- vintage: when was this row created
  regime_tag TEXT,                         -- '2016-2019_expansion', '2020_covid', '2022-2024_rate_hike', etc.

  -- Leading metrics at t
  surge_index NUMERIC,                     -- COR-01, COR-05
  pipeline_pct NUMERIC,                    -- COR-06, COR-07
  permit_count NUMERIC,                    -- COR-08
  formation_count NUMERIC,               -- COR-10
  wage_growth_yoy NUMERIC,               -- COR-04
  corporate_health_index NUMERIC,        -- M33
  search_momentum NUMERIC,             -- COR-10
  sentiment_score NUMERIC,             -- COR-19
  macro_rate NUMERIC,                  -- COR-27
  
  -- Realized outcomes at t+lag (the lag varies by pairing)
  rent_growth_t6 NUMERIC,                -- COR-01, COR-06: rent growth at t+6mo
  rent_growth_t12 NUMERIC,               -- COR-06: rent growth at t+12mo
  rent_growth_t18 NUMERIC,               -- COR-06: rent growth at t+18mo
  vacancy_t4 NUMERIC,                  -- COR-05: vacancy at t+4mo
  cap_rate_t24 NUMERIC,                -- COR-08: cap rate at t+24mo
  cap_rate_t30 NUMERIC,                -- COR-08: cap rate at t+30mo
  concession_t3 NUMERIC,               -- COR-09: concession depth at t+3mo
  absorption_t0 NUMERIC,               -- COR-07: concurrent absorption
  
  -- Metadata
  data_sources TEXT[],                   -- which tables contributed this row
  confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),
  
  UNIQUE (submarket_id, period_date, as_of_date)
);

CREATE INDEX idx_outcome_panel_submarket_period ON outcome_panel(submarket_id, period_date);
CREATE INDEX idx_outcome_panel_regime ON outcome_panel(regime_tag);
```

### Acquisition Strategy (you can't wait 60 months)

- **Backfill** — most series (permits, transactions, FRED macro, Census, QCEW, deliveries) are *historically available now*; pull 60 mo of history at ingest rather than accumulating forward. This buys the calibration window immediately for everything except your own-platform signals (surge, search, sentiment), which must accumulate.
- **Bridge with public panels** — fit initial r on backfilled public series (permits→cap, wages→rent, pipeline→rent), then recalibrate as platform-native series mature.
- **Vintage every row** — store `as_of` so a refit at month N only sees data ≤ N. Without this, backtests leak and r is inflated.

---

## 5. Data Taxonomy (The JEDI RE Data Model)

### Tier 1: Core Underwriting Data (Must Have)

| Category | Tables | Description |
|----------|--------|-------------|
| **Property Identity** | `properties`, `deals` | Address, unit count, year built, class, submarket, MSA |
| **Rent Roll** | `rent_rolls`, `unit_types` | Current leases, rents, concessions, lease terms, expirations |
| **T-12 Financials** | `deal_financials`, `financial_snapshots` | Historical revenue, OPEX, NOI by month |
| **Market Snapshot** | `market_snapshots`, `apartment_market_snapshots` | Submarket rent, vacancy, absorption, concessions |
| **Comps** | `comp_properties`, `comp_transactions` | Rent comps, sale comps, positioning data |

### Tier 2: Market Intelligence (Enrichment)

| Category | Tables | Description |
|----------|--------|-------------|
| **Demand Events** | `market_events` | Employer moves, transit openings, economic shocks |
| **Supply Pipeline** | `apartment_supply_pipeline` | Construction starts, deliveries, permits |
| **Demographics** | `demographic_profiles`, `census_data` | Population, income, age, migration |
| **Employment** | `employment_data`, `lightcast_jobs` | Jobs by sector, employer, wage levels |
| **Traffic / Roads** | `property_traffic_context`, `adt_counts` | ADT, road class, distance, Google Realtime |
| **Digital Presence** | `property_web_traffic`, `visibility_scores` | Web sessions, SEO, domain strength |
| **Concessions** | `concession_data` *(➕ MISSING)* | Effective rent vs asking, concession depth, seasonal patterns |
| **Search Momentum** | `submarket_search_momentum` *(➕ MISSING)* | Google Trends, search volume by submarket |
| **Business Formation** | `business_formations` *(➕ MISSING)* | Census BFS, county registrations |
| **Net Absorption** | `market_absorption` *(➕ MISSING)* | Quarterly absorption by submarket |
| **Deliveries** | `market_deliveries` *(➕ MISSING)* | Completions, lease-up velocity |
| **Sentiment** | `review_sentiment` *(➕ MISSING)* | NLP-scored reviews from Google/Yelp/ApartmentRatings |
| **Corporate Health** | `corporate_health_index` *(➕ MISSING)* | Public filing analysis, earnings, headcount trends |

### Tier 3: Correlation & Learning (Feedback Loop)

| Category | Tables | Description |
|----------|--------|-------------|
| **Time Series** | `metric_time_series` | Monthly metric values per geography (rent, vacancy, etc.) |
| **Correlations** | `metric_correlations`, `correlation_history` | Pairwise metric correlations with lag |
| **Event Outcomes** | `event_outcomes` | What actually happened after each event |
| **Outcome Panel** | `outcome_panel` *(➕ MISSING)* | Paired (leading, realized) observations for fitting r |
| **Causality** | `event_causality_results` | Did event drive market or vice versa |
| **Assumptions** | `assumption_snapshots` | What we assumed at underwriting time |
| **Actuals** | `actual_performance` | What actually happened (PMS import) |
| **Outcomes** | `assumption_outcomes` | Gap analysis: assumed vs actual |
| **Adjustments** | `learning_adjustments` | Systematic corrections for future deals |
| **Backtests** | `backtest_runs` | Prediction accuracy per model/event type |

### Tier 4: Derived / Agent-Generated (Output)

| Category | Tables | Description |
|----------|--------|-------------|
| **Traffic Predictions** | `traffic_predictions` | Weekly walk-in forecasts per property |
| **JEDI Scores** | `jedi_scores` | Composite market attractiveness scores |
| **Correlation Signals** | `portfolio_correlation_signals` | Per-property COR-01–30 signals |
| **Proforma Models** | `deal_financial_models` | Multi-year cash flow projections |
| **Scenario Results** | `scenario_results` | Bull/base/bear/stress case outputs |

---

## 6. The Learning Flywheel

```
┌─────────────────────────────────────────────────────────────────────┐
│                         STAGE 1: UNDERWRITE                          │
│                                                                      │
│  User creates deal → Platform auto-ingests property data           │
│  → Agent queries:                                                    │
│     • Market snapshots (Tier 2)                                      │
│     • Correlation signals (Tier 3) → COR-01–30                     │
│     • Learning adjustments (Tier 3) → past bias corrections        │
│     • Backtest calibration (Tier 3) → event accuracy discounts     │
│  → Agent produces:                                                   │
│     • Assumptions (rent growth, occupancy, OPEX)                     │
│     • Event impact multiplier (blended forward + backward)           │
│     • Confidence score (how much data backed this)                   │
│  → SAVE: assumption_snapshots (Tier 3)                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      STAGE 2: OPERATE / TRACK                        │
│                                                                      │
│  Property under management → Monthly PMS data imported               │
│  → Platform tracks:                                                  │
│     • Actual rent growth vs assumed                                  │
│     • Actual occupancy vs assumed                                    │
│     • Actual NOI vs assumed                                          │
│     • Event outcomes (did predicted events materialize?)             │
│  → SAVE: actual_performance (Tier 3)                                   │
│  → SAVE: event_outcomes (Tier 3) — when events resolve              │
│  → UPDATE: outcome_panel (Tier 3) — new paired observations        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      STAGE 3: CORRELATE & VALIDATE                   │
│                                                                      │
│  Scheduled jobs (nightly/weekly):                                    │
│                                                                      │
│  A. M28 Correlation Cron:                                            │
│     • Recompute metric_time_series → metric_correlations             │
│     • Apply recency weighting (half-life 42mo)                       │
│     • Regime-tag all observations                                    │
│     • Update correlation_history (append-only)                       │
│     • Generate COR-01–30 signals with confidence                     │
│     • Produce regime-conditional r where n sufficient              │
│                                                                      │
│  B. M35 Causality Cron:                                              │
│     • For each unresolved event: event_causality_results             │
│     • Determine direction: event_drives_market?                       │
│                                                                      │
│  C. Backtest Cron:                                                   │
│     • When event_outcomes + outcome_panel both exist:                │
│       → backtest_runs (event_impact type)                            │
│       → per-event-type calibration scores                             │
│                                                                      │
│  D. Learning Cron:                                                   │
│     • When actual_performance + assumption_snapshots both exist:       │
│       → assumption_outcomes (gap analysis)                             │
│       → learning_adjustments (systematic bias per bucket)            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    STAGE 4: FEED BACK TO UNDERWRITE                  │
│                                                                      │
│  Next deal in same geography → Agent queries:                      │
│     • learning_adjustments: "Last 5 deals in Tampa overestimated      │
│       rent growth by 1.2% → apply -1.2% correction"                 │
│     • backtest_runs: "employer_move events in Tampa have 78%         │
│       calibration → apply 0.78 accuracy discount"                    │
│     • event_causality_results: "In Tampa, 80% of employer_moves      │
│       drive market → apply 0.85 causality discount"                 │
│     • outcome_panel: "Permit→cap rate r=0.62 in current regime"    │
│                                                                      │
│  Result: More accurate underwriting, tighter confidence bands        │
│          Regime-conditional signals where data is sufficient         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              └────────────────────────────────────────►
                                              (loop repeats)
```

---

## 7. Data Maturity Score (Per Geography)

Each MSA and submarket gets a `DataMaturityScore` that determines:
1. What confidence the platform can offer
2. What actions the user should take to improve it
3. Whether correlations are **hypothesized** or **fitted**

```typescript
interface DataMaturityScore {
  geographyId: string;          // MSA or submarket ID
  geographyType: 'msa' | 'submarket';
  
  // Tier classification
  tier: 'seed' | 'sprout' | 'sapling' | 'canopy';
  overallScore: number;        // 0–100
  
  // Component scores (0–100 each)
  components: {
    propertyData: number;       // property identity, rent roll, T-12
    marketSnapshot: number;     // rent, vacancy, absorption from Costar
    eventHistory: number;       // event_outcomes count + lookback depth
    actualPerformance: number;  // actual_performance months of history
    correlationHistory: number; // correlation_history data points
    backtestCoverage: number;   // event types with backtest data
    outcomePanel: number;       // outcome_panel rows (paired observations)
    macroIndicators: number;    // FRED/BLS data freshness
  };
  
  // Actionable recommendations
  recommendations: Array<{
    priority: number;
    action: string;
    impact: string;            // e.g., "Improves rent growth accuracy by ~2%"
    dataSource: string;        // e.g., "Upload PMS actuals", "Connect Costar"
    calibFloorUnblocked: string; // e.g., "Unblocks COR-08 (permits→cap rate)"
  }>;
  
  // What the platform can currently do
  capabilities: {
    canPredictTraffic: boolean;
    canPredictRentGrowth: boolean;
    canBacktestEvents: boolean;
    canApplyLearningAdjustments: boolean;
    canGenerateCausalityAnalysis: boolean;
    canFitCorrelations: boolean;  // ← NEW: has outcome_panel + sufficient history
    canProduceRegimeConditionalR: boolean;  // ← NEW: has regime tags + per-regime n≥20
  };
}
```

### Tier Definitions

| Tier | Score | Description | Platform Capability |
|------|-------|-------------|---------------------|
| **Seed** | 0–25 | Property data only. No market data. | Basic proforma with manual assumptions. No AI recommendations. |
| **Sprout** | 26–50 | Market snapshots + some comp data. | Automated market-driven assumptions. No learning loop. |
| **Sapling** | 51–75 | 12+ months actuals + some events tracked. | Learning adjustments active. Backtest for common event types. |
| **Canopy** | 76–100 | 36+ months actuals + deep event history + outcome panel. | Full flywheel active. Self-improving assumptions. Causality analysis. **Fitted correlations** (not just hypothesized). |

### Tier Progression Example: Tampa MSA

| Month | Milestone | Tier | Score | What Changed |
|-------|-----------|------|-------|--------------|
| 0 | First deal created | Seed | 15 | Property data only |
| 1 | Costar connected, market snapshot loaded | Sprout | 42 | Rent, vacancy, absorption data |
| 3 | First 12 months PMS actuals uploaded | Sprout | 58 | Lease velocity, concession depth measurable |
| 6 | 5 events tracked with outcomes | Sapling | 65 | Employer_move, transit_opening backtestable |
| 9 | Outcome panel backfilled (permits, wages, macro) | Sapling | 70 | COR-04, COR-06, COR-08 now **fitted** (not hypothesized) |
| 12 | 24 months actuals + 15 events + regime tags | Sapling | 72 | Learning adjustments per asset class |
| 18 | 36 months actuals + causality analysis + regime-conditional r | Canopy | 85 | Self-improving platform in this MSA |
| 24 | 5+ property portfolio in Tampa | Canopy | 92 | Portfolio correlation coefficients empirically derived |

---

## 8. Implementation Phases

### Phase 1: Foundation (NOW — already done)
- [x] Assumption snapshots auto-save on deal creation
- [x] Forward-looking event deltas (M06 → F9)
- [x] Backward-looking correlation discounts (backtest + causality + learning)
- [x] Event impact modifier in traffic engine
- [x] Graceful degradation with default discounts
- [x] Lag-aware Calib-Floor logic (conceptual — needs data to activate)
- [x] Recency weighting formula (half-life 42mo) — implemented in correlation engine
- [x] Regime tagging (COVID 2020-03, rate pivot 2022-03) — implemented in correlation engine

### Phase 2: Data Ingestion (P0 — next)
- [ ] **P0 Outcome panel schema + as_of vintaging** — unblocks calibration at all
- [ ] **P0 Backfill 120mo (10yr) of public series**: permits, deliveries, transactions/cap, QCEW wages, FRED macro, Census BFS/migration, net absorption from surveys
- [ ] P0 Regime tags on every observation (2020-03 COVID, 2022-03 rate pivot)
- [ ] P0 PMS CSV import API (`POST /api/v1/actuals/import`)
- [ ] P0 Event outcome tracking API (`POST /api/v1/events/:id/outcome`)
- [ ] P0 Data maturity score API (`GET /api/v1/data-maturity/:geographyId`)
- [ ] P0 Costar API connector (market snapshots)
- [ ] P0 BLS/FRED macro indicator auto-fetch (weekly cron)

### Phase 3: Feedback Loop Automation (P1 — after Phase 2)
- [ ] P1 M28 correlation cron (weekly) — now with recency weighting + regime-conditional r
- [ ] P1 M35 causality cron (nightly, event-driven)
- [ ] P1 Backtest re-computation cron (monthly, triggers when new event outcomes + outcome_panel rows)
- [ ] P1 Learning adjustment cron (quarterly, triggers when 5+ new actuals)
- [ ] P1 Data maturity badge in F1 Overview tab
- [ ] P1 F9 confidence badges — surface event_modifier_confidence, dataSources, missingSources

### Phase 4: Advanced Intelligence (P2 — after 12+ months of data)
- [ ] P2 Portfolio correlation coefficients (per owned property)
- [ ] P2 Cross-market pattern detection ("Deals with similar event profiles")
- [ ] P2 Predictive alert: "Based on Tampa patterns, this MSA likely overestimating rent growth"
- [ ] P2 Automated re-underwriting suggestions: "Update Q1 reforecast with actuals"

---

## 9. Key Design Principles

1. **Graceful degradation**: The platform works with ZERO historical data. Every missing table falls back to a conservative default with transparent confidence scoring. **But default ≠ fitted.**

2. **Hypothesized vs fitted**: Never present a correlation as measured when it hasn't been fitted against paired outcomes. The platform must distinguish:
   - `r = 0.62 (fitted, n=144, p<0.05)` — trustworthy
   - `r = 0.45 (hypothesized, backtest not yet available)` — directional only
   - `r = — (insufficient data, need 60mo history)` — unavailable

3. **Progressive enrichment**: As data is uploaded, the platform automatically improves. No manual model retraining. No "data science team" required.

4. **Transparency**: Every assumption shows its data source, confidence tier, and what would improve it. The user always knows whether a signal is fitted, hypothesized, or unavailable.

5. **Privacy-first**: Actual performance data is property-level, never shared across users. Learning adjustments are aggregated at MSA+asset_class level, never property-identifiable.

6. **Actionable, not just analytical**: The platform doesn't just show correlations. It translates them into assumption deltas, confidence bands, and recommended actions.

7. **Regime-conditional**: Correlations are not universal constants. The platform surfaces regime-conditional r where per-regime sample size is sufficient (n≥20), and warns when the current regime has no precedent.

---

## 10. What You're Missing (Summary)

**Series (7):** concessions/effective rent · net absorption · deliveries/completions · business-formation velocity · submarket search momentum · reviews/NLP sentiment · corporate health (M33). Plus wages on the employment series.

**Structural (the real gap):**
- (a) **Outcome panel** — without it no r is ever *fitted*
- (b) **Lag-aware Calib-Floor** — flat 12-mo floors disable every long-lag correlation
- (c) **Common-window checks** per pairing — the shorter leg silently caps the pair
- (d) **Retention = 10yr cap, recency-weighted (half-life 42mo) + regime-tagged** — equal-weighting the decade lets stale regimes bias r
- (e) **Hypothesized vs fitted distinction** — the platform must surface which signals are real vs directional guesses

Backfilling public history closes most of the window problem immediately; the platform-native series and the outcome panel are the parts that require building.

---

*Document: `docs/DATA_ARCHITECTURE_AND_FLYWHEEL.md`*
*Owner: JEDI RE Platform Team*
*Last Updated: 2026-06-18*
*Merged with: CORRELATION_ENGINE_LOOKBACK_SPEC.md v1.0*
