# Strategy Engine Implementation — Claude Code Session Plan

## Dependency Chain

```
Session 1: Database tables (metric_time_series + strategy_definitions)
    ↓
Session 2: Metrics catalog API + seeded catalog
    ↓
Session 3: Zillow + FRED data ingestion (populate metric_time_series)
    ↓
Session 4: Strategy execution engine (backend — run conditions against data)
    ↓
Session 5: M08 Strategy tab — wire score matrix to real data
    ↓
Session 6: Strategy Builder page (/strategies)
    ↓
Session 7: Side panel strategy command
    ↓
Session 8: BLS + Census ingestion (more metrics for richer strategies)
    ↓
Session 9: Correlation engine enhancement (use metric_time_series)
    ↓
Session 10: Market Intel Correlations sub-tab
```

Sessions 1-5 give you a working deal-level strategy module with real data.
Sessions 6-7 give you the custom builder and platform scanning.
Sessions 8-10 deepen the data and add correlation intelligence.

---

## SESSION 1: Database Foundation

**Goal:** Create the three core tables that everything depends on.

**Prompt for Claude Code:**

"Read the existing migration files in /migrations/ to understand the naming pattern. Create a new migration file (use the next number after the highest existing migration). The migration should create these tables:

1. `metric_time_series` — the backbone for all historical data:
```sql
CREATE TABLE IF NOT EXISTS metric_time_series (
  id BIGSERIAL PRIMARY KEY,
  metric_id VARCHAR(50) NOT NULL,
  geography_type VARCHAR(20) NOT NULL,
  geography_id VARCHAR(50) NOT NULL,
  geography_name VARCHAR(255),
  period_date DATE NOT NULL,
  period_type VARCHAR(10) NOT NULL DEFAULT 'monthly',
  value DOUBLE PRECISION NOT NULL,
  source VARCHAR(50) NOT NULL,
  confidence REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_id, geography_type, geography_id, period_date)
);
CREATE INDEX idx_mts_metric_geo ON metric_time_series(metric_id, geography_type);
CREATE INDEX idx_mts_geo_period ON metric_time_series(geography_id, period_date);
CREATE INDEX idx_mts_latest ON metric_time_series(metric_id, geography_type, period_date DESC);
```

2. `strategy_definitions` — the new conditions-based strategy schema:
```sql
CREATE TABLE IF NOT EXISTS strategy_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'custom',
  scope VARCHAR(20) DEFAULT 'submarket',
  conditions JSONB NOT NULL DEFAULT '[]',
  combinator VARCHAR(5) DEFAULT 'AND',
  signal_weights JSONB,
  sort_by VARCHAR(50),
  sort_direction VARCHAR(4) DEFAULT 'desc',
  max_results INTEGER DEFAULT 50,
  asset_classes TEXT[] DEFAULT '{}',
  deal_types TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  run_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

3. `metric_correlations` — pre-computed relationships:
```sql
CREATE TABLE IF NOT EXISTS metric_correlations (
  id BIGSERIAL PRIMARY KEY,
  metric_a VARCHAR(50) NOT NULL,
  metric_b VARCHAR(50) NOT NULL,
  geography_type VARCHAR(20) NOT NULL,
  geography_id VARCHAR(50) NOT NULL,
  window_months INTEGER NOT NULL,
  correlation_r REAL NOT NULL,
  lead_lag_months INTEGER,
  p_value REAL,
  sample_size INTEGER,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_a, metric_b, geography_type, geography_id, window_months)
);
```

4. `geographies` — reference table for geographic entities:
```sql
CREATE TABLE IF NOT EXISTS geographies (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  parent_id VARCHAR(50),
  state VARCHAR(2),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
);
```

Also seed the `strategy_definitions` table with 5 preset strategies (set type='preset', user_id=NULL):
- 'Demand Surge Detector' — C_SURGE_INDEX > 0.15 AND F_RENT_GROWTH < 2.5 AND D_SEARCH_MOMENTUM > 10
- 'Rent Runway Detector' — E_WAGE_GROWTH > 3.0 AND F_RENT_GROWTH < 2.5 AND M_VACANCY < 6.0
- 'Supply Cliff Opportunity' — S_PERMIT_VELOCITY decreasing AND S_PIPELINE_TO_STOCK top 30% AND M_ABSORPTION > 150
- 'Hidden Gem Finder' — T_PHYSICAL_SCORE >= 70 AND D_DIGITAL_SCORE < 40
- 'Distress Signal Scanner' — O_DEBT_MATURITY_MO < 18 AND K_GOOGLE_RATING < 3.5

Store conditions as JSONB arrays matching the StrategyCondition interface from the architecture spec.

Run the migration. Build."

**Done when:** Tables exist, 5 preset strategies are in strategy_definitions.

---

## SESSION 2: Metrics Catalog API

**Goal:** Backend endpoint serving the full metrics catalog. Frontend can fetch it.

**Prompt:**

"Create `backend/src/services/metricsCatalog.service.ts`. This is a static catalog of all 35+ platform metrics. Each metric has: id, name, category, formula, unit, granularity (array of 'property'|'submarket'|'zip'|'county'|'msa'), source, updateFrequency, higherIsBetter, description, exampleValue.

Use the metric IDs from the correlation engine (correlationEngine.service.ts already references some). The full list is in the strategy-engine-architecture.md file in the repo root — read it for the complete catalog.

Categories: traffic_physical, traffic_digital, traffic_composite, financial, supply, demand, market, competition, risk, ownership, sfr (single-family).

Then create `backend/src/api/rest/metrics-catalog.routes.ts` with:
- GET /api/v1/metrics/catalog — returns full catalog (cacheable, rarely changes)
- GET /api/v1/metrics/catalog/:category — filter by category
- GET /api/v1/metrics/:metricId/values — returns latest values from metric_time_series for a given metric + geography_type, with optional geography_id filter. Joins with geographies table for names.
- GET /api/v1/metrics/:metricId/history — returns time series for a metric + geography_id

Mount the routes in index.ts. Build."

**Done when:** GET /api/v1/metrics/catalog returns 35+ metrics.

---

## SESSION 3: Zillow + FRED Data Ingestion

**Goal:** Populate metric_time_series with real historical data.

**Prompt:**

"Create `backend/src/services/ingestion/zillow-ingest.service.ts`. This service:
1. Downloads Zillow ZHVI (Home Value Index) CSV from a configured URL or local file
2. Parses the CSV — Zillow format has geography columns then monthly date columns
3. For each zip/county/metro row, inserts into metric_time_series with metric_id='SFR_HOME_VALUE', geography_type, geography_id (zip code or FIPS), geography_name, each month as a separate row
4. Also computes SFR_HOME_VALUE_GROWTH as YoY percent change and inserts those rows

Create `backend/src/services/ingestion/zillow-rent-ingest.service.ts`. Same pattern for Zillow ZORI (Rent Index). Metric IDs: F_RENT_INDEX, F_RENT_GROWTH.

Create `backend/src/services/ingestion/fred-ingest.service.ts`. This service:
1. Calls the FRED API (https://api.stlouisfed.org/fred/series/observations) for series: SOFR, DGS10 (10Y Treasury), MORTGAGE30US
2. Parses JSON response, inserts into metric_time_series with metric_id='RATE_SOFR', 'RATE_TREASURY_10Y', 'RATE_MORTGAGE_30Y', geography_type='national', geography_id='US'
3. Requires a FRED API key in environment variables

Create `backend/src/api/rest/ingestion.routes.ts` with admin-only endpoints:
- POST /api/v1/admin/ingest/zillow-zhvi — trigger Zillow ZHVI ingestion from uploaded CSV or URL
- POST /api/v1/admin/ingest/zillow-zori — trigger Zillow ZORI ingestion
- POST /api/v1/admin/ingest/fred — trigger FRED ingestion
- GET /api/v1/admin/ingest/status — show last ingestion timestamps per source

Also seed the geographies table with Florida zip codes, counties, and MSAs. You can get this from Census FIPS reference or hardcode the ~900 FL zip codes + 67 counties + relevant MSAs.

Mount routes. Build."

**Done when:** After running the Zillow ingest with a downloaded CSV, metric_time_series has 100K+ rows of historical home value data at zip level.

---

## SESSION 4: Strategy Execution Engine

**Goal:** Backend can run a strategy definition against metric_time_series and return ranked results.

**Prompt:**

"Create `backend/src/services/strategyExecution.service.ts`. This service takes a StrategyDefinition (from strategy_definitions table) and executes it:

1. Parse the conditions JSONB array
2. For each condition, build a SQL subquery against metric_time_series:
   - 'gt'/'lt'/'gte'/'lte'/'eq': simple WHERE value > threshold on latest period_date
   - 'between': WHERE value BETWEEN min AND max
   - 'top_pct'/'bottom_pct': use PERCENT_RANK() window function
   - 'increasing'/'decreasing': compare latest value to value from lookback_months ago
3. Join all conditions by the combinator (AND/OR) on geography_id
4. For each matching geography, compute a weighted score: sum of (condition_weight × normalized_condition_value) / sum(weights)
5. Return results sorted by sort_by metric, limited to max_results

The key SQL pattern:
```sql
WITH latest_values AS (
  SELECT DISTINCT ON (metric_id, geography_id)
    metric_id, geography_id, geography_name, value, period_date
  FROM metric_time_series
  WHERE geography_type = $scope AND metric_id = ANY($metric_ids)
  ORDER BY metric_id, geography_id, period_date DESC
),
condition_results AS (
  -- one CTE per condition, joined by geography_id
)
SELECT geography_id, geography_name, 
  -- weighted score calculation
FROM condition_results
WHERE -- required conditions pass
ORDER BY score DESC
LIMIT $max_results;
```

Then update `backend/src/api/rest/custom-strategies.routes.ts`:
- Add POST /api/v1/strategies/:id/run — execute strategy, return results, cache in strategy_runs
- Add POST /api/v1/strategies/preview — execute without saving (for live preview in builder)
- Add POST /api/v1/strategies/score-deal/:dealId — run all user's strategies against one deal

Keep the existing CRUD routes working — they use the old custom_strategies table. The new routes use strategy_definitions table. Both can coexist.

Build and test: create a strategy definition via the API, run it, verify results come back."

**Done when:** POST /strategies/:id/run returns ranked geographies matching conditions.

---

## SESSION 5: M08 Strategy Tab — Wire to Real Data

**Goal:** The Deal Capsule strategy tab shows real scored strategies, not mock data.

**Prompt:**

"Read `frontend/src/components/deal/sections/StrategySection.tsx` (1,273 lines). It already has:
- 4-column score matrix UI
- Signal heatmap UI
- ROI head-to-head UI
- Arbitrage alert banner
All using mock data from enhancedStrategyMockData.ts.

Also read `frontend/src/data/enhancedStrategyMockData.ts` to understand the data shapes.

Make these changes:

1. In the useEffect that fetches data (around line 122), replace the mock data fallback with a real API call to GET /api/v1/strategy-analyses/:dealId. If the backend returns data, use it. If it fails or returns empty, keep the mock data as fallback.

2. Add a third sub-tab: 'Custom Screen'. This sub-tab calls POST /api/v1/strategies/score-deal/:dealId and shows which of the user's saved strategies match this deal. Display as a list with: strategy name, pass/fail badge, score, and the reason (which conditions matched/failed).

3. The deal-type-visibility.ts config already gates which strategies show per deal type (getAvailableStrategies). Wire this: if the deal is 'existing', hide the BTS column from the score matrix. If 'development', hide the Flip column.

4. The arbitrage detection formula (F24): max_score - second_max_score > 15 AND max_score > 70. Compute this from the actual scores and show/hide the arbitrage banner conditionally.

Build."

**Done when:** Strategy tab shows score matrix (with real or mock data), arbitrage banner triggers correctly, Custom Screen sub-tab shows saved strategy matches.

---

## SESSION 6: Strategy Builder Page

**Goal:** /strategies page with the custom builder UI.

**Prompt:**

"Create `frontend/src/pages/StrategyBuilderPage.tsx`. This is a new top-level page at route /strategies. Use the strategy-engine-preview.html file in the repo root as the VISUAL REFERENCE — don't copy paste, rebuild in our patterns.

Read the existing StrategySection.tsx for styling patterns and the deal module context pattern.

The page has three tabs:

Tab 1: Strategy Library
- Fetches GET /api/v1/strategies (user's strategies) + the preset strategies
- Shows cards for each strategy: name, description, condition chips, match count, Run/Edit buttons
- 'Create Custom Strategy' card links to Tab 2

Tab 2: Custom Builder (two-column layout)
- Left: Strategy editor
  - Name input, scope selector (property/submarket/zip/county/msa)
  - Conditions list — each condition shows: metric name, operator dropdown, value input, weight slider, required toggle, delete button
  - '+ Add Condition' button opens the metrics catalog panel (fetches from GET /api/v1/metrics/catalog)
  - Metrics catalog panel: category filter buttons, metric cards with id/name/description/formula, click to add as condition
- Right: Live preview (sticky sidebar)
  - Calls POST /api/v1/strategies/preview with current conditions (debounced 500ms)
  - Shows match count and top 10 results with scores and metric values

Tab 3: Disabled placeholder labeled 'Deal Scoring' that links to the Deal Capsule M08 tab

Save/Delete buttons call the strategies CRUD API.

Add the route to App.tsx and add a 'Strategies' link to the main navigation sidebar.

Build."

**Done when:** /strategies page renders, user can add conditions from the catalog, live preview shows results, save creates a strategy_definitions record.

---

## SESSION 7: Side Panel Strategy Command

**Goal:** ⌘K or the side panel can run strategies.

**Prompt:**

"Read the existing side panel / command palette component (likely in the shell or layout area — search for 'CommandPalette' or 'SidePanel' or 'cmdK' in the frontend).

Add a 'Run Strategy' command group. When the user types 'strategy' or 'run strategy':
1. Fetch GET /api/v1/strategies to list user's saved strategies
2. Show each strategy as a command option with name and last match count
3. On click: call POST /api/v1/strategies/:id/run
4. Show top 5 results inline in the panel with: geography name, score, and the key metric values
5. 'View All Results' button navigates to /strategies/:id with results expanded
6. '+ Create New' button navigates to /strategies?tab=builder

If no command palette exists yet, create a simple slide-out panel triggered by a button in the top nav bar. Show it as a right-side drawer with strategy list and quick-run capability.

Build."

**Done when:** User can trigger strategy scan from the side panel and see results without leaving the current page.

---

## SESSION 8: BLS + Census Ingestion

**Goal:** Add employment, wages, population, income, migration data.

**Prompt:**

"Create `backend/src/services/ingestion/bls-ingest.service.ts`:
1. Calls BLS QCEW API for Florida counties (67 FIPS codes)
2. Fetches quarterly employment count and avg weekly wages
3. Inserts into metric_time_series as E_EMPLOYMENT (value = total employment), E_EMPLOYMENT_GROWTH (YoY %), E_WAGE (value = avg weekly wage), E_WAGE_GROWTH (YoY %)
4. Geography type: 'county', geography_id: FIPS code

Create `backend/src/services/ingestion/census-ingest.service.ts`:
1. Calls Census ACS 5-Year API for Florida zip codes
2. Fetches: B19013_001E (median household income), B01003_001E (total population), B25003_003E (renter occupied units), B25003_001E (total occupied units)
3. Inserts as: DEMO_MED_INCOME, DEMO_POPULATION, DEMO_RENTER_PCT
4. Geography type: 'zip', geography_id: zip code

Create `backend/src/services/ingestion/irs-ingest.service.ts`:
1. Parses IRS SOI county-to-county migration CSV
2. For each Florida county: sum inflows - outflows = net migration, compute by AGI bracket
3. Inserts as: DEMO_NET_MIGRATION (households/year), DEMO_MIGRATION_INCOME (median AGI of movers)
4. Geography type: 'county'

Add admin trigger endpoints for each. Build."

**Done when:** metric_time_series has employment, wage, population, income, and migration data for Florida.

---

## SESSION 9: Correlation Engine Enhancement

**Goal:** The correlation engine uses metric_time_series instead of just market snapshots.

**Prompt:**

"Read `backend/src/services/correlationEngine.service.ts` (951 lines). Currently it computes correlations from market snapshot data.

Enhance it to ALSO compute correlations from the metric_time_series table:
1. Add a method `computeTimeSeriesCorrelations(geographyType, geographyId, windowMonths)`:
   - For all metric pairs where both have 24+ data points in metric_time_series for this geography
   - Compute Pearson correlation on aligned time series
   - Compute cross-correlation with lags -12 to +12 months to find lead-lag
   - Store results in metric_correlations table
2. Add a cron job entry (or admin endpoint) to trigger weekly recomputation
3. Add GET /api/v1/correlations/:geographyId — returns all pre-computed correlations for a geography from the metric_correlations table

Keep the existing computeCorrelations() method working — it uses different data sources. The new method supplements it with time-series-based correlations.

Build."

**Done when:** metric_correlations table has computed correlations for Florida counties with 24+ months of data.

---

## SESSION 10: Market Intel Correlations Sub-Tab

**Goal:** Users can explore correlations visually.

**Prompt:**

"Read the Market Intelligence page (`frontend/src/pages/development/MarketIntelligencePage.tsx`). Add a new sub-tab: 'Correlations'.

This tab shows:
1. A correlation matrix heatmap — rows and columns are metrics, cells are color-coded by correlation strength (green = strong positive, red = strong negative, gray = weak/insignificant). Data from GET /api/v1/correlations/:geographyId
2. Click any cell → shows the lead-lag relationship, scatter plot concept, and the actionable insight
3. A 'Signal Chain' visualization: the sequence from leading indicators to lagging outcomes. Show as a horizontal flow: Business Formations → Search Momentum → Traffic Surge → Vacancy Drop → Rent Growth → Cap Rate Compression. Each node shows the current value and whether it's bullish/bearish.
4. Geography selector at the top — pick MSA or county to see that market's correlations

Use the correlation-metrics-engine.jsx in the repo as visual reference for the signal chain layout.

Build."

**Done when:** Market Intelligence page has a working Correlations tab with heatmap and signal chain for Florida markets.

---

## PARALLEL TRACK: Exit & Capital Module

These can run alongside the strategy sessions:

**Session A (anytime after Session 1):**
"Read exit-capital-integration-spec.md and exit-capital-v3-preview.html. Replace DebtTab.tsx with ExitCapitalModule. Follow the spec's section 4 for component architecture. Wire push-to-proforma using the field mapping in section 3."

**Session B (anytime after Session A):**
"Add the 21-year convergence chart and rate history chart to the Exit Strategy and Debt Market tabs. Use the data generation functions from the HTML preview as reference. Add FOMC meeting markers and dot plot path."

---

## FILES TO PLACE IN REPO BEFORE STARTING

Copy these from /mnt/user-data/outputs/ to the repo root:
1. strategy-engine-architecture.md — Claude Code reads this for types and data model
2. historical-data-requirements.md — Claude Code reads this for ingestion specs  
3. exit-capital-integration-spec.md — Claude Code reads this for Exit module
4. exit-capital-v3-preview.html — visual reference
5. strategy-engine-preview.html — visual reference

---

## IMPLEMENTATION ORDER (recommended)

Week 1: Sessions 1-3 (database + catalog + first data ingestion)
Week 2: Sessions 4-5 (execution engine + M08 wiring)
Week 3: Sessions 6-7 (Strategy Builder page + side panel)
Week 4: Sessions 8-10 (more data + correlations)
Parallel: Sessions A-B (Exit & Capital module)

Each session is 1 Claude Code sitting (~15-20 turns max).
Start a new session after each. Carry the one-line status summary forward.
