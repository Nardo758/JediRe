# JEDI RE — Claude Code Playbook
## UI Fine-Tuning, Feature Gap Analysis, & Prompt Library

---

## 1. USING OPUS IN CLAUDE CODE

### Setup (Pick One Method)

**Option A — Per-session (recommended for focused work):**
```bash
claude --model opus
```

**Option B — Mid-session switch:**
Type `/model` inside Claude Code, then select `claude-opus-4-6` from the list.

**Option C — Permanent default (if you want Opus always):**
```bash
# Add to ~/.zshrc or ~/.bashrc
export ANTHROPIC_MODEL=opus
```
Then restart your terminal and run `claude`.

**Option D — Hybrid mode (best cost/quality tradeoff):**
```bash
claude --model opusplan
```
This uses Opus for planning/architecture decisions, then Sonnet for code generation. Best of both worlds.

### Important Notes
- **Max plan required** for full Opus access in Claude Code. On Pro, you need to enable and purchase extra usage first.
- **Effort levels:** Once on Opus 4.6, use `/effort high` for complex architecture tasks, `/effort low` for simple fixes.
- **1M context window** is available on Max, Team, and Enterprise plans — critical for your large codebase.
- **Cost awareness:** Opus burns ~3x the tokens of Sonnet due to adaptive thinking. Use `opusplan` for routine sessions, full `opus` for architecture/debugging sessions.

### Recommended Session Strategy for JEDI RE
```
# Architecture sessions (store wiring, data chain design):
claude --model opus

# Routine bug fixes, component wiring:
claude --model opusplan

# Bulk file edits, simple refactors:
claude --model sonnet
```

---

## 2. HISTORICAL + PREDICTIVE DATA ALIGNMENT PATTERN

Your UI needs to show two data regimes on every metric: **what happened** (historical) and **where it's heading** (predictive). Here's the pattern that fits your Bloomberg Terminal aesthetic.

### The Data Shape Every Metric Should Follow

```typescript
interface TimeSeriesMetric {
  // Identity
  metricId: string;           // e.g., "rent_growth", "vacancy_rate"
  label: string;
  unit: string;               // "%", "$", "units", "score"
  
  // Historical (actuals)
  historical: {
    values: { date: string; value: number }[];  // monthly/quarterly
    source: string;                              // "RentCast" | "BLS" | "FRED"
    lastUpdated: string;
  };
  
  // Predictive (model output)  
  predicted: {
    values: { date: string; value: number; confidence: number }[];
    model: string;              // "linear_regression" | "arima" | "claude_forecast"
    confidenceBand: { upper: number[]; lower: number[] };
  };
  
  // Leading indicators that drive the prediction
  leadingIndicators: {
    metricId: string;
    label: string;
    correlation: number;       // r-value
    leadMonths: number;        // how far ahead it signals
    currentSignal: "bullish" | "bearish" | "neutral";
    value: number;
  }[];
  
  // Trend summary
  trend: {
    direction: "up" | "down" | "flat";
    momentum: "accelerating" | "decelerating" | "steady";
    signal: "GO" | "WATCH" | "CONCERN";
  };
}
```

### How This Maps to the Bloomberg UI

**Sparkline pattern** (already in your JSX):
```
Historical (solid line) ──── │ ---- Predicted (dashed line)
                            NOW
```

**MetricBox pattern** (already in `ViewMarkets`):
```
┌──────────────────────────┐
│ RENT GROWTH         ▲ GO │  ← trend.signal badge
│ 4.2%                     │  ← current value (last historical point)
│ ▲ +0.8% YoY             │  ← change from historical
│ ━━━━━━━━│╌╌╌╌           │  ← sparkline: solid=historical, dashed=predicted
│ Forecast: 4.6% → 5.1%   │  ← predicted range
│ Lead: Jobs +2.3% (6mo)   │  ← top leading indicator
└──────────────────────────┘
```

**MARKET_VITALS should become:**
```typescript
const MARKET_VITALS = [
  {
    label: "RENT GROWTH",
    value: "4.2%",           // current actual
    change: "+0.8%",
    trend: "up",
    signal: "GO",
    sparkData: [3.1, 3.4, 3.6, 3.8, 4.0, 4.2],  // historical
    forecast: [4.3, 4.5, 4.6],                     // predicted  
    leadIndicator: { label: "Jobs", value: "+2.3%", leadMonths: 6 },
  },
  // ... same shape for vacancy, absorption, supply pipeline, cap rate
];
```

### The 5 Key Metrics That Need This Treatment

| Metric | Historical Source | Prediction Model | Leading Indicators |
|--------|-----------------|-------------------|-------------------|
| Rent Growth | RentCast, Apartments.com | ARIMA + jobs correlation | Job growth (6mo), wage growth (3mo), migration (9mo) |
| Vacancy Rate | Apartments.com, CoStar | Supply pipeline model | Permits filed (12mo), completions (6mo), absorption (3mo) |
| Absorption | Market surveys | Demand model | Population growth (12mo), job postings (6mo), corporate HQ moves (18mo) |
| Supply Pipeline | Permit databases | Construction timeline | Permits filed (18mo), starts (12mo), financing activity (9mo) |
| Cap Rate | Transaction data, FRED | Rate environment model | 10Y Treasury (3mo), SOFR (1mo), transaction velocity (6mo) |

### M33 Corporate Health as Leading Indicator Chain

This is your unique edge — corporate health metrics predict RE outcomes 6-18 months ahead:

```
Corporate Earnings ─(6mo)──→ Hiring/Layoffs ─(3mo)──→ Office Demand
                                    │
                                    └─(6mo)──→ Housing Demand ──→ Rent Growth
                                    
Stock Price ─(3mo)──→ Wealth Effect ─(6mo)──→ Luxury Rental Demand
                                    
Headcount ─(12mo)──→ Submarket Population ─(6mo)──→ Retail/Service Growth
```

---

## 3. COMPLETE UNIMPLEMENTED FEATURE LIST

Compiled from all conversations, FEATURE_EXPANSION.md, CLAUDE.md, and session history.

### WAVE 0 — Critical Blockers (Fix First)

| # | Feature | Status | Blocker |
|---|---------|--------|---------|
| 1 | **Markets section (F4) not rendering data** | BROKEN | Mock MARKET_VITALS + SUBMARKETS arrays are hardcoded; no API connection |
| 2 | **Ticker not working** | BROKEN | Hardcoded ticker strings in JSX; no live data feed connected |
| 3 | **Deal page crash on pipeline click** | BROKEN | Null/undefined access at render time (build passes) |
| 4 | **25 mock data files blocking all data chains** | BLOCKED | `frontend/src/data/*.ts` imported instead of API calls |
| 5 | **`api.client.ts` missing typed methods** | BLOCKED | Only has auth, deals, properties, analysis — missing 10+ endpoints |
| 6 | **M09 ProForma hardcodes IRR=15** | BUG | No debt service input from M11 |
| 7 | **M07 Traffic: 3 hardcoded constants, 3 empty migrations, routes unmounted** | BUG | Market adjustment factors returning constants |

### WAVE 1 — Wire What Exists (P0)

| # | Feature | F-Key Home | Backend Status |
|---|---------|-----------|----------------|
| 8 | JEDI Score live from API | Deal F1 | `jedi-score.service.ts` (748 lines), routes mounted |
| 9 | Score history sparkline | Deal F1 | `GET /jedi/history/:dealId` exists |
| 10 | Strategy Arbitrage live scoring (4 strategies) | Deal F5 | `strategy-arbitrage-engine.ts` (467 lines) |
| 11 | Arbitrage alert banner (delta >15pts) | Deal F5 | F24 formula in `formula-engine.ts` |
| 12 | ProForma 3-layer model (Broker/Platform/User) | Deal F6 | `proforma-adjustment.service.ts` (1,110 lines) |
| 13 | M09↔M11 circular dependency resolution | Deal F6↔F7 | `capital-structure-adapter.ts` (476 lines) |
| 14 | KPI bar live aggregations | Portfolio F1 | `dealStore.ts` exists, needs computed selectors |
| 15 | Confidence indicator on JEDI Score | Deal F1 | In jedi-score service response shape |

### WAVE 2 — First Feature Expansion (P1)

| # | Feature | F-Key Home | Backend Status |
|---|---------|-----------|----------------|
| 16 | Power Rankings (PCS-ranked properties) | Portfolio F4/F5 | `rankings.routes.ts` mounted, `f40-performance-score.service.ts` exists |
| 17 | Vantage Group Rankings | Portfolio F5 | Needs classification logic |
| 18 | Performance Trajectory (12mo PCS trend) | Portfolio F5 | `rankings.routes.ts` has history |
| 19 | Rent-Traffic-Wage correlation charts | Portfolio F4 | `correlation.routes.ts` mounted |
| 20 | News event taxonomy (JOBS/SUPPLY/REG/DEMAND/INFRA) | Portfolio F6 | `news.routes.ts` mounted, Kafka schema defined |
| 21 | NewsAPI.org ingestion pipeline | Portfolio F6 | Needs `newsApiIngestion.service.ts` |
| 22 | Geographic tagging to submarkets | Portfolio F6 | `geographic-assignment.service.ts` exists |
| 23 | Physical Traffic Score (T-02) from FDOT | Deal F10 | `traffic-data.routes.ts` mounted |
| 24 | Digital Traffic Score (T-03) from SpyFu | Deal F10 | `digitalTrafficService.ts` exists |
| 25 | T-04 Quadrant classification | Deal F10 | Needs composite calc |
| 26 | 6-component Risk scoring | Deal F8 | `risk-scoring.service.ts` exists |
| 27 | Monte Carlo simulation | Deal F8 | `monte-carlo-timeline.service.ts` exists |
| 28 | Signal heatmap (5 signals × 4 strategies) | Deal F5 | F23/F24 in formula engine |
| 29 | Traffic qualification gates per strategy | Deal F5 | M07 thresholds needed |
| 30 | Excel/PDF export for any module | Portfolio F8 | `excel-export.service.ts` exists |
| 31 | Ticker — live market data feed | Global | FRED API, Apartment Locator AI, FDOT identified |
| 32 | PCS-colored map markers | Portfolio F1 | `rankings.routes.ts` exists |
| 33 | Deal pipeline stage tracker (6 stations) | Deal F1 | Deal state machine in `dealStore.ts` |
| 34 | Collision detection banner | Deal F1 | Needs collision engine |
| 35 | Stack Designer (visual capital stack) | Deal F7 | `capital-structure.service.ts` (742 lines) |
| 36 | Strategy-Aware Debt Selector | Deal F7 | `capital-structure-adapter.ts` (476 lines) |
| 37 | Three-layer traffic fusion | Deal F10 | Migration 076, `traffic-data-sources.service.ts` |
| 38 | Sensitivity analysis (IRR range) | Deal F6 | `scenario-generation.service.ts` exists |

### WAVE 3 — Intelligence Layer (P2)

| # | Feature | F-Key Home | Backend Status |
|---|---------|-----------|----------------|
| 39 | Opportunity detection engine | Portfolio F7 | `opportunity-engine.service.ts` + routes mounted |
| 40 | Triple Trigger flagging | Portfolio F7 | Needs composite logic |
| 41 | Acquisition target pins + owner intel | Portfolio F1/F4 | Needs `acquisitionIntelligence.service.ts` |
| 42 | Ownership & Debt Intelligence | Portfolio F5 | Needs county records API + UCC filing |
| 43 | Management Company Rankings | Portfolio F5 | Needs management company tagging |
| 44 | Pattern Detection Engine | Portfolio F5 | `trend-pattern-detector.ts` exists |
| 45 | Trade Area Opportunity Score (TOS) | Portfolio F4/F7 | Needs TOS service |
| 46 | Score impact calculation (news → JEDI delta) | Portfolio F6 | `jedi-score-consumer.ts` exists |
| 47 | Deal linking (news ↔ deals) | Portfolio F6 | Needs linker service |
| 48 | Digital-Physical Divergence indicator | Portfolio F4 | Traffic services exist |
| 49 | Correlation Pairing Dashboard (20+ pairings) | Portfolio F4 | `correlation.routes.ts` exists |
| 50 | Active Owners intelligence tab | Portfolio F4 | Needs county records + SOS scraper |
| 51 | Rate Environment tracker | Deal F7 | `rate-index.service.ts` exists |
| 52 | Equity Waterfall calculator | Deal F7 | Needs waterfall logic |
| 53 | Rate Strategy Score (RSS) | Deal F12 | Needs `rateStrategyScore.service.ts` |
| 54 | Exit timing metrics | Deal F12 | Market services exist |
| 55 | Hold period optimization | Deal F12 | Needs optimization engine |
| 56 | Disposition strategy comparison | Deal F12 | Needs comparison engine |
| 57 | Correlation-driven exit signals | Deal F12 | `correlationEngine.service.ts` exists |
| 58 | Deal memo auto-generation | Portfolio F8 | `llm.service.ts` exists |
| 59 | User override persistence (LayeredValue) | Deal F6 | Needs user override storage |
| 60 | Insurance risk model (FL wind zone) | Deal F8 | Needs insurance risk calc |
| 61 | Walk-in prediction (hourly/daily) | Deal F10 | `trafficPredictionEngine.ts` exists |
| 62 | M33 Corporate Health Intelligence | Portfolio F5 | Specced (F65-F72), not built |
| 63 | Rank-Me Positioning Tool | Portfolio F5 / Deal | Specced, not built |

### WAVE 4 — Platform Expansion (P3+, New Systems)

| # | Feature | Status |
|---|---------|--------|
| 64 | WhatsApp Business API (Twilio) | Specced, Twilio selected |
| 65 | Apple Messages for Business | Specced via Twilio MSP |
| 66 | MLS data access (Stellar MLS / Bridge API) | Path identified, needs broker relationship |
| 67 | Team Collaboration / RBAC (M29-M32) | 8-sprint plan specced |
| 68 | QuickBooks Online integration | OAuth 2.0 flow specced |
| 69 | Remote Online Notarization (RON) | Provider-abstracted service layer specced |
| 70 | AI Architectural Rendering (Replicate API) | Specced for M03 massing pipeline |
| 71 | Document generation (Claude-powered) | Template library specced |
| 72 | Post-Close Intelligence (M22) | Needs `deal_monthly_actuals` table |
| 73 | Strategy Builder (DB-driven strategies) | Moving from 4 hardcoded to configurable |
| 74 | Business formation cluster heatmap | Needs Census BFS API + sunbiz scraper |
| 75 | Submarket lifecycle classification | Needs classification model |
| 76 | Deal Archive + Data Flywheel | Every underwritten deal saved for benchmarks |
| 77 | AI Chat Surface (command bar → conversational) | Claude as coordinator, NLU pipeline |
| 78 | Peer Comparison Grid (102 columns) | 3 zoom levels specced |

**Total: 78 designed-but-not-built features across 4 waves.**

---

## 4. MARKETS SECTION & TICKER DIAGNOSIS

### Why F4 Markets Isn't Working

The `ViewMarkets` component renders from two hardcoded arrays:

```javascript
// These are inline constants in the Bloomberg JSX — NOT from any API
const MARKET_VITALS = [
  { label: "EFFECTIVE RENT", value: "$1,847", ... },
  { label: "VACANCY", value: "5.2%", ... },
  // etc.
];

const SUBMARKETS = [
  { name: "Midtown", units: "12,400", ... },
  // etc.
];
```

**The problem chain:**
1. `ViewMarkets` reads from hardcoded `MARKET_VITALS` and `SUBMARKETS` arrays
2. There IS a backend route at `/api/v1/market/:marketId/summary` — but no frontend calls it
3. `api.client.ts` has no typed method for market data
4. The `mockSubmarketData.ts` file exists in `frontend/src/data/` but may not even be the one being used — the Bloomberg JSX has its own inline mocks

### Why the Ticker Isn't Working

The ticker uses a hardcoded array of strings with a CSS animation:

```javascript
const tickers = [
  "^10Y 4.32% +0.03", "^SOFR 5.33%", "^CPI 3.1% ▼",
  "TAMPA VAC 5.2%", "ATL RENT $1,847 +2.1%", ...
];
```

**The problem:**
1. These are static strings baked into the JSX
2. No API call fetches live data from FRED (10Y, SOFR, CPI), RentCast (rents, vacancy), or any market source
3. The CSS `animation: ticker 45s linear infinite` works fine — it's the data that's dead
4. The ticker needs a polling service or WebSocket that feeds real numbers

### What Data Should Be Showing

**Ticker feed sources (all identified, none connected):**
- **FRED API** → 10Y Treasury, SOFR, CPI, unemployment rate
- **RentCast API** → effective rent, vacancy by submarket
- **FDOT** → traffic counts (free continuous count stations)
- **Apartments.com scraper** → listing data, rent trends
- **Permit databases** → new supply pipeline counts

**Markets page data sources:**
- `GET /api/v1/market/:marketId/summary` → market vitals
- `GET /api/v1/rankings/:marketId` → power rankings per submarket
- `GET /api/v1/correlations/report` → correlation data
- `GET /api/v1/supply/trade-area/:id` → supply pipeline

---

## 5. CLAUDE CODE PROMPT LIBRARY

### Session 0: Bootstrap (Run First Every Time)

Make sure `CLAUDE.md` is at your repo root. If it's there, Claude Code reads it automatically.

```
claude --model opus
```

Then your first message:

```
Read CLAUDE.md and FEATURE_EXPANSION.md at the repo root. 
Confirm you understand the architecture: 
- dealStore.ts is the single source of truth
- store-as-message-bus pattern (no direct inter-module imports)
- Three-layer assumption model (broker > platform > user)
- All mock data in frontend/src/data/ must be replaced with API calls
List the 5 critical data chains and their current wiring status.
```

---

### Session 1: Fix Markets Section (F4)

```
TASK: Wire the ViewMarkets component to live API data.

CURRENT STATE: ViewMarkets in the Bloomberg terminal UI reads from hardcoded 
MARKET_VITALS and SUBMARKETS arrays inline in the JSX. The backend route 
GET /api/v1/market/:marketId/summary exists but nothing calls it.

STEPS:
1. Add a typed method to api.client.ts:
   market: {
     getSummary: (marketId: string) => apiClient.get(`/api/v1/market/${marketId}/summary`),
     getSubmarkets: (marketId: string) => apiClient.get(`/api/v1/market/${marketId}/submarkets`),
   }

2. Create a useMarketData hook that calls these endpoints and returns 
   the same shape as the current MARKET_VITALS array.

3. Replace the hardcoded MARKET_VITALS in ViewMarkets with the hook output.
   Keep the exact same UI rendering — just swap the data source.

4. Add loading and error states that match the Bloomberg terminal aesthetic:
   - Loading: pulsing amber skeleton boxes
   - Error: red border with retry button

5. The data shape should include BOTH historical and predicted values:
   {
     label: string,
     value: string,        // current actual
     change: string,       // YoY or QoQ change
     trend: "up" | "down" | "flat",
     signal: "GO" | "WATCH" | "CONCERN",
     sparkData: number[],  // last 6-12 months actuals
     forecast: number[],   // next 3-6 months predicted
     leadIndicator: { label: string, value: string, leadMonths: number }
   }

Do NOT change the visual design. Only change where the data comes from.
```

---

### Session 2: Fix the Ticker

```
TASK: Wire the ticker bar to live data feeds.

CURRENT STATE: The ticker in the Bloomberg terminal UI shows hardcoded strings 
like "^10Y 4.32% +0.03". These are static — no API fetches real data.

APPROACH:
1. Create a TickerService in the backend:
   - Endpoint: GET /api/v1/ticker/feed
   - Polls FRED API every 15 minutes for: 10Y Treasury, SOFR, CPI, unemployment
   - Polls RentCast for market-level rent and vacancy (hourly)
   - Caches results in Redis or in-memory with TTL
   - Returns array of: { symbol: string, value: string, change: string, direction: "up"|"down"|"flat" }

2. Add typed method to api.client.ts:
   ticker: {
     getFeed: () => apiClient.get('/api/v1/ticker/feed'),
   }

3. In the Bloomberg terminal component, replace the hardcoded tickers array 
   with a useEffect that polls the ticker endpoint every 60 seconds.
   
4. Keep the exact same CSS animation (ticker 45s linear infinite).
   Just swap the data array.

5. Color logic stays the same:
   - Green for positive change (^)
   - Red for negative (v)  
   - Amber for neutral

Start with FRED API integration since it's free and gives you the macro indicators.
The FRED API key should come from process.env.FRED_API_KEY.
Series IDs: DGS10 (10Y), SOFR (SOFR rate), CPIAUCSL (CPI), UNRATE (unemployment).
```

---

### Session 3: Fix Deal Page Crash

```
TASK: Debug and fix the runtime crash when opening a deal from the pipeline view.

SYMPTOMS:
- Clicking a deal row in the pipeline grid crashes the app
- Build compiles cleanly — this is a runtime null/undefined access
- The error happens at render time, not during data fetch

DIAGNOSTIC STEPS:
1. Find the click handler in the deal grid that navigates to a deal
2. Trace what component renders on deal open (likely DealOverview or OverviewSection)
3. Check every property access chain for optional chaining (?.)
4. The most likely culprit: a component tries to read deal.something.nested 
   before the deal data loads, OR the dealStore hasn't been populated yet

COMMON PATTERNS THAT CAUSE THIS:
- deal.zoning.code when deal.zoning is undefined
- deal.strategy.scores[0] when scores is null
- deal.jediScore.components.demand when jediScore hasn't loaded
- Accessing mock data that was deleted but the import remains

Fix with defensive access (optional chaining) and proper loading states.
Do NOT add try/catch around render — fix the actual null access.
```

---

### Session 4: Mock-to-API Replacement (Systematic)

```
TASK: Replace mock data imports with live API calls. Do ONE file at a time.

START WITH: enhancedOverviewMockData.ts (imported by OverviewSection.tsx)

PATTERN FOR EACH REPLACEMENT:
1. Open the mock file, note its export shape (TypeScript interface)
2. Find the backend endpoint that returns this data
3. Add typed method to api.client.ts if missing
4. Create a custom hook: useM01Data(dealId) that fetches from the API
5. Update the component to use the hook instead of the mock import
6. Add loading skeleton + error state
7. Delete or comment out the mock import
8. Test that the component renders with real data shape

REPLACEMENT ORDER (by data chain priority):
1. enhancedOverviewMockData.ts → /api/v1/jedi/score/:dealId + /api/v1/deals/:id
2. enhancedStrategyMockData.ts + strategyMockData.ts → /api/v1/strategy-analyses
3. enhancedProFormaMockData.ts → /api/v1/proforma/:dealId
4. capitalStructureMockData.ts → /api/v1/proforma/:dealId + capital structure fields
5. supplyMockData.ts → /api/v1/supply/trade-area/:id
6. mockSubmarketData.ts → /api/v1/market/:marketId/summary

RULES:
- Never change the visual design
- Match the exact TypeScript interface the component expects
- If the API returns a different shape, create a transformer in the hook
- Every hook writes to dealStore after fetch (store-as-message-bus)
```

---

### Session 5: Historical + Predictive Data Layer

```
TASK: Add the historical + predictive data pattern to all market metrics.

The platform needs every metric to show:
1. Historical values (actuals from data sources)
2. Predicted values (model output with confidence bands)
3. Leading indicators (what's driving the prediction)
4. Trend signal (GO/WATCH/CONCERN)

CREATE:
1. A TimeSeriesMetric TypeScript interface (see below)
2. A forecasting service that takes historical data and produces predictions
3. A leading indicator mapping service

INTERFACE:
interface TimeSeriesMetric {
  metricId: string;
  label: string;
  unit: string;
  historical: { values: { date: string; value: number }[]; source: string };
  predicted: { 
    values: { date: string; value: number; confidence: number }[];
    confidenceBand: { upper: number[]; lower: number[] };
  };
  leadingIndicators: {
    metricId: string;
    label: string;
    correlation: number;
    leadMonths: number;
    currentSignal: "bullish" | "bearish" | "neutral";
  }[];
  trend: { direction: "up"|"down"|"flat"; momentum: string; signal: string };
}

For the forecasting service, use Claude as the compute engine:
- Feed it the last 12-24 months of actual data
- Ask it to produce a 6-month forecast with confidence intervals
- This matches your "Claude as compute engine" pattern from M03 massing

Wire the output into:
- ViewMarkets sparklines (historical=solid, predicted=dashed)
- MetricBox components (current value + trend + lead indicator)
- Ticker feed (current values with direction)
```

---

### Session 6: Data Chain Wiring Audit

```
TASK: Run the seven-layer health scan on the current codebase.

CHECK EACH LAYER:
1. MOCK DATA AUDIT: grep -r "import.*from.*data/" frontend/src/ --include="*.tsx" --include="*.ts"
   → List every file still importing from frontend/src/data/

2. STORE-AS-MESSAGE-BUS: grep -r "import.*from.*components/" frontend/src/components/ --include="*.tsx"  
   → Find any direct inter-module imports (violation of store pattern)

3. ROUTE MOUNTING: Check backend/src/routes/index.ts
   → List every route file that exists but isn't mounted

4. EMPTY MIGRATIONS: find . -name "*.sql" -empty -o -name "*.ts" -size 0 | grep migration
   → Find the 3 empty M07 migration files + any others

5. API CLIENT COVERAGE: Compare api.client.ts methods vs mounted backend routes
   → List every endpoint with no typed frontend client

6. DATA CHAIN TRACE: For each of the 5 critical chains, trace:
   Agent → Service → Route → api.client → Hook → Component → dealStore
   Mark where each chain breaks

7. DEAL PAGE VARIANTS: Find all files matching *Deal*.tsx or *Overview*.tsx
   → Identify which variant is the canonical one

Output a markdown table for each layer showing: File, Status, Action Needed.
```

---

## 6. QUICK REFERENCE: WHAT'S BROKEN RIGHT NOW

| Component | Problem | Root Cause | Fix Session |
|-----------|---------|-----------|-------------|
| F4 Markets | Shows hardcoded data | Inline MARKET_VITALS array, no API call | Session 1 |
| Ticker | Static strings, not updating | Hardcoded tickers array, no live feed | Session 2 |
| Deal open from pipeline | Runtime crash | Null access in render (likely missing deal data) | Session 3 |
| All deal sections | Mock data | 10 active mock imports in components | Session 4 |
| M07 Traffic | 3 constants, 3 empty migrations | Routes not mounted in index.ts | Session 6 audit |
| M09 ProForma | IRR hardcoded to 15 | No debt service input from M11 | Session 4 (wave 3) |
| JEDI Score display | Shows mock value | `jedi-score.service.ts` exists but no frontend connection | Session 4 (wave 1) |

---

## 7. CLAUDE.md ADDITIONS

Add this block to your existing CLAUDE.md to give Claude Code context about the data pattern:

```markdown
## Data Pattern: Historical + Predictive

Every metric in the platform follows the TimeSeriesMetric pattern:
- historical: actual values from data sources (solid line in sparklines)
- predicted: model output with confidence bands (dashed line)
- leadingIndicators: what drives the prediction (shown as badges)
- trend: GO/WATCH/CONCERN signal

Leading indicator chains (M33 Corporate Health thesis):
- Corporate Earnings →(6mo)→ Hiring →(3mo)→ Office Demand
- Stock Price →(3mo)→ Wealth Effect →(6mo)→ Luxury Rental
- Headcount →(12mo)→ Submarket Population →(6mo)→ Retail Growth

## Current Broken Components
- ViewMarkets: hardcoded MARKET_VITALS, needs /api/v1/market/:marketId/summary
- Ticker: hardcoded strings, needs /api/v1/ticker/feed (FRED + RentCast)
- Deal pipeline click: runtime null access crash
- 10 active mock data imports in deal section components
```
