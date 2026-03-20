# PEER COMPARISON DATAGRID — Real Estate Metrics Spec

> **Companion to:** `NAVIGATION_REFRAME_SPEC.md` + `BLOOMBERG_UI_SPEC.md`
> **Purpose:** Define the exact columns, data sources, formulas, sort behavior, and drill-down behavior for the peer comparison grid at three zoom levels: MSA → Submarket → Property.
>
> **Core principle:** One component (`DataGrid`), three configurations. Same interaction pattern at every level. Click a row → drill into the next level. The address is the ticker.

---

## THE UNIVERSAL GRID PATTERN

Every level shares these behaviors:

1. **Default sort:** JEDI Score descending (best first)
2. **Click column header:** Sort by that column (toggle asc/desc)
3. **Click row:** Select (amber left border, row highlights)
4. **Double-click row:** Drill into next zoom level
5. **Right-click row:** Context menu (Show on Map, Compare, Create Deal)
6. **Color coding:** All score/delta columns auto-color (green ≥80, amber 65-79, red <65)
7. **Delta format:** Always show direction (+3.2%, -1.8%, ▲+4). Green = positive, red = negative.
8. **Sparkline column:** 9-point mini chart, trailing 9 periods (months or quarters depending on metric)
9. **Median row:** Pinned at top, amber text, shows median of all visible rows (like Bloomberg's Peer Comparison median row)

---

## LEVEL 1: MSA PEER COMPARISON

**Route:** `/market-intelligence` (F4 MARKETS)
**What it replaces:** The white "My Markets" cards (Image 1)
**Drill target:** Double-click MSA → `/market-intelligence/markets/:marketId` (submarket grid)
**Row count:** 4-12 tracked markets

### Columns (18 columns)

| # | Column | Width | Key | Formula / Source | Unit | Sort | Color Rule |
|---|--------|-------|-----|------------------|------|------|------------|
| 1 | # | 32px | — | Row index | — | — | — |
| 2 | MSA | 160px | `name` | MSA display name | text | alpha | — |
| 3 | Props | 56px | `properties` | COUNT properties tracked | # | desc | — |
| 4 | Units | 64px | `units` | SUM total_units across properties | # | desc | — |
| 5 | **JEDI** | 48px | `jedi_score` | F01: weighted composite of 5 signals | 0-100 | desc | score-tier |
| 6 | Δ30 | 40px | `delta_30d` | `jedi_score_current - jedi_score_30d_ago` | ±pts | desc | delta |
| 7 | Trend | 60px | `trend` | Sparkline of last 9 monthly JEDI scores | spark | — | — |
| 8 | Rent | 72px | `avg_rent` | F_EFF_RENT: weighted avg effective rent across properties | $/mo | desc | — |
| 9 | Rent Δ | 56px | `rent_growth` | F_RENT_GROWTH: `(rent_now - rent_12mo) / rent_12mo` | % YoY | desc | delta |
| 10 | Vacancy | 56px | `vacancy` | O_VACANCY_RATE: `1 - physical_occupancy` (MSA weighted avg) | % | asc | inverted* |
| 11 | Absorb | 64px | `absorption` | O_ABSORPTION: `units_occupied_end - units_occupied_start` | units/qtr | desc | — |
| 12 | Pipeline | 64px | `pipeline_pct` | S_PIPELINE_PCT: `pipeline_units / existing_inventory` | % | asc | threshold** |
| 13 | Constraint | 48px | `constraint_score` | Composite: pipeline pressure + months of supply | 0-100 | desc | score-tier |
| 14 | Jobs/Apt | 48px | `jobs_apt_ratio` | `total_employment / total_apt_units` | ratio | desc | — |
| 15 | Pop Δ | 48px | `pop_growth` | E_POP_GROWTH: Census `(pop_now / pop_prior) - 1` | % YoY | desc | delta |
| 16 | Med Inc | 64px | `median_income` | E_MEDIAN_HH_INCOME: Census ACS 5yr | $/yr | desc | — |
| 17 | Cap Rate | 56px | `avg_cap_rate` | F_CAP_RATE: avg from recent MSA transactions | % | desc | — |
| 18 | Cycle | 56px | `cycle_position` | M28: expansion/peak/contraction/trough badge | badge | — | cycle-color*** |

**Color rules:**
- `*` Vacancy inverted: <5% = green (tight), 5-8% = amber, >8% = red (oversupplied)
- `**` Pipeline threshold: <8% = green, 8-12% = amber, >12% = red (supply pressure)
- `***` Cycle: expansion = green, peak = amber, contraction = red, trough = cyan

### Data Sources

| Column | API Endpoint | Service |
|--------|-------------|---------|
| JEDI Score | `GET /api/v1/jedi/score/market/:msaId` | jedi-score.service.ts |
| Rent, Vacancy, Absorption | `GET /api/v1/market/:msaId/summary` | apartmentMarketService.ts |
| Pipeline | `GET /api/v1/supply/msa/:msaId/summary` | supply-signal.service.ts |
| Jobs, Pop, Income | `GET /api/v1/demand/msa/:msaId/economic` | demand-signal.service.ts (BLS/Census) |
| Cap Rate | `GET /api/v1/rankings/:msaId` | rankings via comp transactions |
| Cycle Position | `GET /api/v1/macro/cycle/:msaId` | M28 cycle engine (future) |
| Coverage | `GET /api/v1/market/:msaId/coverage` | apartmentDataSync.ts |

---

## LEVEL 2: SUBMARKET PEER COMPARISON

**Route:** `/market-intelligence/markets/:marketId` → Submarkets tab
**What it replaces:** The white KPI cards in "Submarkets" tab (Image 2)
**Drill target:** Double-click submarket → property-level grid for that submarket
**Row count:** 8-50+ submarkets per MSA

### Columns (20 columns)

| # | Column | Width | Key | Formula / Source | Unit | Sort | Color Rule |
|---|--------|-------|-----|------------------|------|------|------------|
| 1 | # | 32px | — | Row index | — | — | — |
| 2 | Submarket | 140px | `name` | Submarket display name | text | alpha | — |
| 3 | Props | 48px | `properties` | COUNT properties in submarket | # | desc | — |
| 4 | Units | 56px | `units` | SUM total_units | # | desc | — |
| 5 | **JEDI** | 48px | `jedi_score` | F01: submarket-level weighted composite | 0-100 | desc | score-tier |
| 6 | Δ30 | 40px | `delta_30d` | Score delta 30 days | ±pts | desc | delta |
| 7 | Trend | 60px | `trend` | Sparkline of last 9 monthly scores | spark | — | — |
| 8 | Rent | 72px | `avg_rent` | F_EFF_RENT: submarket weighted avg | $/mo | desc | — |
| 9 | Rent Δ | 56px | `rent_growth` | F_RENT_GROWTH: YoY change | % | desc | delta |
| 10 | Rent/SF | 56px | `rent_psf` | F_RENT_PSF: `monthly_rent / unit_sqft` | $/SF | desc | — |
| 11 | Vacancy | 56px | `vacancy` | O_VACANCY_RATE | % | asc | inverted |
| 12 | Absorb | 56px | `absorption_rate` | O_ABSORPTION_RATE: `net_absorption / total_inventory` | %/qtr | desc | — |
| 13 | Pipeline | 56px | `pipeline_pct` | S_PIPELINE_PCT | % | asc | threshold |
| 14 | Mo Supply | 56px | `months_supply` | O_MONTHS_SUPPLY: `pipeline_units / monthly_absorption` | months | asc | supply-tier**** |
| 15 | Opp Score | 48px | `opp_score` | F26: `rent_growth×0.3 + absorption×0.25 + vacancy_inv×0.25 + pop_growth×0.2` percentile | 0-100 | desc | score-tier |
| 16 | Pressure | 56px | `pressure` | Transaction velocity + buyer count / seller count | badge | — | pressure-color***** |
| 17 | Cap Rate | 56px | `avg_cap_rate` | F_CAP_RATE: submarket transaction avg | % | desc | — |
| 18 | $/Unit | 64px | `price_per_unit` | F_PRICE_PER_UNIT: from deed recordings | $/unit | desc | — |
| 19 | Afford | 48px | `rent_to_income` | E_RENT_TO_INCOME: `(avg_rent × 12) / median_hh_income` | % | asc | afford-tier****** |
| 20 | Review | 48px | `avg_review` | Google Places avg review score across properties | x/5 | desc | — |

**Color rules:**
- `****` Months supply: <12 = green (healthy), 12-18 = amber (watch), 18-24 = orange (caution), >24 = red (oversupply)
- `*****` Pressure: BUYER = green, BALANCED = amber, SELLER = cyan (seller's market = good for exits)
- `******` Affordability: <30% = green (runway), 30-35% = amber (burdened), >35% = red (ceiling)

### Data Sources

| Column | API Endpoint | Service |
|--------|-------------|---------|
| JEDI Score | `GET /api/v1/jedi/score/submarket/:id` | jedi-score.service.ts |
| Rent, Vacancy, Absorption | `GET /api/v1/market/submarket/:id/summary` | apartmentMarketService.ts |
| Pipeline, Mo Supply | `GET /api/v1/supply/trade-area/:id` | supply-signal.service.ts |
| Opp Score | `GET /api/v1/rankings/:marketId` | rankings.service.ts |
| Cap Rate, $/Unit | `GET /api/v1/comps/submarket/:id/summary` | comp-query.service.ts |
| Affordability | `GET /api/v1/demand/submarket/:id/economic` | demand-signal.service.ts |
| Reviews | `GET /api/v1/reviews/submarket/:id/aggregate` | google-places.service.ts |

---

## LEVEL 3: PROPERTY PEER COMPARISON

**Route:** Inside a deal (F9 COMPS) or submarket drill-down
**What it replaces:** Competition Analysis cards / Sale Comps list
**Drill target:** Double-click property → Deal Capsule (`/deals/:id/detail`)
**Row count:** 5-50+ properties per submarket or comp set

### Columns (24 columns)

| # | Column | Width | Key | Formula / Source | Unit | Sort | Color Rule |
|---|--------|-------|-----|------------------|------|------|------------|
| 1 | # | 32px | — | Row index | — | — | — |
| 2 | Property | 180px | `name` | Property name + address (2-line) | text | alpha | — |
| 3 | Submarket | 100px | `submarket` | Submarket name | text | alpha | — |
| 4 | **JEDI** | 48px | `jedi_score` | F01: property-level composite | 0-100 | desc | score-tier |
| 5 | Δ30 | 40px | `delta_30d` | Score delta 30 days | ±pts | desc | delta |
| 6 | Trend | 60px | `trend` | Sparkline of last 9 monthly scores | spark | — | — |
| 7 | Strategy | 48px | `strategy` | F23: argmax(BTS, Flip, Rental, STR) | badge | — | strat-color |
| 8 | Strat Δ | 40px | `arbitrage_gap` | F24: max_score - second_score | ±pts | desc | arb-flag******* |
| 9 | Units | 48px | `units` | Total units | # | desc | — |
| 10 | Year | 40px | `year_built` | Year built | year | desc | — |
| 11 | Rent | 72px | `avg_rent` | F_EFF_RENT: effective rent per unit | $/mo | desc | — |
| 12 | Rent Δ | 48px | `rent_growth` | F_RENT_GROWTH: YoY | % | desc | delta |
| 13 | vs Mkt | 48px | `rent_premium` | F_RENT_PREMIUM: `(prop_rent - sub_avg) / sub_avg` | % | desc | delta |
| 14 | RevPAU | 64px | `revpau` | F_REVPAU: `total_revenue / total_units` | $/unit | desc | — |
| 15 | Occupancy | 56px | `occupancy` | O_PHYSICAL_OCC | % | desc | occ-tier |
| 16 | NOI | 64px | `noi` | F_NOI: `EGI - OpEx` | $/yr | desc | — |
| 17 | Cap Rate | 48px | `cap_rate` | F_CAP_RATE: `NOI / value` | % | desc | — |
| 18 | $/Unit | 64px | `price_per_unit` | F_PRICE_PER_UNIT | $/unit | desc | — |
| 19 | $/SF | 48px | `price_per_sf` | `price / total_sf` | $/SF | desc | — |
| 20 | IRR | 48px | `projected_irr` | F19: from ProForma | % | desc | return-tier |
| 21 | Traffic | 48px | `traffic_score` | T-04: physical × digital quadrant | 0-100 | desc | score-tier |
| 22 | Review | 40px | `review_score` | Google Places avg | x/5 | desc | — |
| 23 | Risk | 40px | `risk_level` | M14: HIGH/MED/LOW | badge | — | risk-color |
| 24 | Stage | 48px | `stage` | Pipeline stage (Lead/LOI/DD/Closed) | badge | — | stage-color |

**Color rules:**
- `*******` Arbitrage: gap ≥15 = pulsing amber ⚡ icon. This is the killer signal — strategy divergence.
- Strategy colors: BTS = purple, FLIP = cyan, RENTAL = green, STR = orange
- Occupancy: >95% = green, 90-95% = amber, <90% = red
- Return tier: IRR >20% = green, 15-20% = amber, <15% = red

### Data Sources

| Column | API Endpoint | Service |
|--------|-------------|---------|
| JEDI Score + Signals | `GET /api/v1/jedi/score/:dealId` | jedi-score.service.ts |
| Strategy + Arbitrage | `GET /api/v1/strategy-analyses/:dealId` | strategy-arbitrage-engine.ts |
| Rent, Occupancy, RevPAU | `GET /api/v1/market/property/:id/metrics` | apartmentMarketService.ts |
| NOI, Cap Rate, $/Unit | `GET /api/v1/proforma/:dealId` or comp transactions | proforma-generator.service.ts |
| IRR | `GET /api/v1/proforma/:dealId` | proforma-generator.service.ts |
| Traffic | `GET /api/v1/traffic-data/context/:propertyId` | trafficPredictionEngine.ts |
| Reviews | `GET /api/v1/reviews/property/:id` | google-places.service.ts |
| Risk | `GET /api/v1/risk/:dealId` | risk-scoring.service.ts |

---

## RELATIVE VALUE OVERLAY (All Levels)

Below or alongside the peer comparison table, each level gets a **Relative Value** chart — the Bloomberg REL VALUE screen equivalent.

### Implementation

1. **Normalize:** Pick a metric (rent, JEDI score, absorption). Index all peers to 100 at the start date.
2. **Overlay:** Plot all peers on one time-series chart. Each line color-coded by entity.
3. **Divergence:** Highlight where lines diverge — that's where the opportunity is.
4. **Toggle:** User selects which metric to normalize (default: Rent Growth).

**MSA level:** Atlanta rent growth indexed to 100 vs Tampa, Miami, Raleigh, Jacksonville — who's outperforming?
**Submarket level:** Midtown indexed to 100 vs Buckhead, West End, Downtown — which sector is rotating?
**Property level:** Subject property indexed to 100 vs 8 comps — are you gaining or losing position?

### Chart component: `RelativeValueOverlay.tsx`

```tsx
interface RelativeValueOverlayProps {
  entities: { id: string; name: string; color: string; dataPoints: { date: string; value: number }[] }[];
  metric: string; // 'rent_growth' | 'jedi_score' | 'absorption' | 'vacancy'
  baselineDate: string; // index = 100 at this date
}
```

---

## REGRESSION / BETA ANALYSIS (Levels 2 & 3)

The Bloomberg REL INDEX scatter plot equivalent. Shows how an entity moves relative to its benchmark.

### Submarket Level
- **X axis:** MSA avg rent growth (the "index")
- **Y axis:** Submarket rent growth
- **Each dot:** One month of data
- **Regression line:** slope = beta. >1.0 = more volatile than MSA. <1.0 = defensive.
- **Alpha (intercept):** Positive = outperforming MSA. Negative = underperforming.
- **R²:** How correlated the submarket is to the MSA. Low R² = independent dynamics.

### Property Level
- **X axis:** Submarket avg rent growth (the "index")
- **Y axis:** Property rent growth
- **Beta interpretation:** High-beta property = amplifies submarket trends. Low-beta = stable regardless.
- **Alpha interpretation:** Positive alpha = this property outperforms its submarket — management premium or location premium.

### Stats panel (right side of scatter):
| Stat | Calculation |
|------|-------------|
| Linear Beta | Slope of regression line |
| Raw Beta | Covariance(entity, benchmark) / Variance(benchmark) |
| Adjusted Beta | (Raw × 0.67) + (1.0 × 0.33) — Bloomberg formula |
| Alpha (Intercept) | Y-intercept of regression |
| R² (Correlation²) | Coefficient of determination |
| R (Correlation) | Pearson correlation coefficient |
| Std Dev of Error | Volatility around regression line |
| Significance | P-value of regression |
| Number of Points | Months of data |

---

## IMPLEMENTATION NOTES

### Shared `DataGrid` component configuration

The `DataGrid` accepts a `config` object per zoom level:

```tsx
interface GridConfig {
  level: 'msa' | 'submarket' | 'property';
  columns: ColumnDef[];
  defaultSort: { key: string; dir: 'asc' | 'desc' };
  drillRoute: (row: any) => string; // URL to navigate on double-click
  medianRow: boolean; // show pinned median row
  contextMenu: ContextMenuItem[];
}
```

### Column width budget

Total viewport at 1440px minus sidebar (0px in terminal mode) = 1440px.
- MSA: 18 columns × avg 68px = 1,224px. Fits with scroll margin.
- Submarket: 20 columns × avg 64px = 1,280px. Fits.
- Property: 24 columns × avg 62px = 1,488px. Needs horizontal scroll or collapsible columns.

For Property level: show 16 core columns by default, remaining 8 via column picker (gear icon). User can toggle which columns are visible. Persist preference in localStorage.

### Subject row highlight

At property level, when viewing from within a deal (F9 COMPS), the subject property row is highlighted with a distinct amber left border and slightly brighter background. All other rows are comp properties.

---

## FILES TO CREATE

| File | Purpose |
|---|---|
| `frontend/src/components/terminal/DataGrid.tsx` | Universal peer comparison grid |
| `frontend/src/components/terminal/RelativeValueOverlay.tsx` | Normalized overlay chart |
| `frontend/src/components/terminal/RegressionScatter.tsx` | Beta/alpha scatter plot |
| `frontend/src/config/grid-configs/msa-grid.config.ts` | MSA column definitions |
| `frontend/src/config/grid-configs/submarket-grid.config.ts` | Submarket column definitions |
| `frontend/src/config/grid-configs/property-grid.config.ts` | Property column definitions |
