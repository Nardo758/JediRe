# JEDI RE — MASTER RUNBOOK FOR CLAUDE CODE SESSIONS

> **Purpose:** Systematic, session-by-session plan to audit, wire, fix, and enhance every layer of the JEDI RE platform.  
> **How to use:** Drop this file + `CLAUDE.md` + `FEATURE_EXPANSION.md` at repo root. Each Claude Code session picks up the next unchecked block. Mark `[x]` as you go.  
> **Estimated total sessions:** 30–40 scoped sessions across 8 phases.

---

## PHASE 0 — REPO HEALTH SCAN (Sessions 1–3)

> Before writing a single line of new code, audit everything. Every finding becomes a tracked item in later phases.

### Session 1: Seven-Layer Diagnostic Sweep

Run each scan, capture output into `AUDIT_RESULTS.md` at repo root.

#### Layer 1 — Mock Data Import Audit
```
[ ] grep -r "from.*data/" frontend/src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".test."
[ ] List every component still importing from frontend/src/data/*.ts
[ ] Classify each: (a) actively rendered on a live route, (b) demo/example only, (c) dead import
[ ] Cross-reference against CLAUDE.md Mock File table — flag any new mock files not in the table
```
**Expected output:** Updated mock-to-component map with accurate "still used?" status for all 25 files.

#### Layer 2 — Store-as-Message-Bus Violations
```
[ ] grep -r "import.*from.*components/deal/sections" frontend/src/ --include="*.tsx" --include="*.ts"
[ ] grep -r "import.*from.*pages/" frontend/src/components/ --include="*.tsx" --include="*.ts"
[ ] Flag any direct cross-module imports (component A importing component B's internals)
[ ] Verify all inter-module data flows through dealStore or props — no side channels
```
**Expected output:** List of files violating store-as-message-bus pattern, with fix prescriptions.

#### Layer 3 — Route Mounting Audit
```
[ ] Read backend/src/api/rest/index.ts — list every router.use() registration
[ ] Find all *.routes.ts files in backend/src/api/rest/
[ ] Diff: which route files exist but are NOT mounted in index.ts?
[ ] Check M07 Traffic specifically: trafficPrediction.routes.ts + 3 others — are they mounted?
```
**Expected output:** Table of route files with mounted/unmounted status. M07 confirmed blocked or not.

#### Layer 4 — Empty Migration Detection
```
[ ] find . -name "*.sql" -path "*/migrations/*" -empty
[ ] find . -name "*.sql" -path "*/migrations/*" -size 0
[ ] Also check for migrations with only comments / no DDL statements
[ ] Specifically check: traffic_predictions, traffic_calibration_factors, validation_properties table migrations
```
**Expected output:** List of empty/stub migration files with the tables they should create.

#### Layer 5 — API Client Coverage Gap
```
[ ] Read frontend/src/services/api.client.ts — list every typed method namespace
[ ] Read backend/src/api/rest/index.ts — list every mounted route prefix
[ ] Diff: which backend routes have no frontend typed client method?
[ ] For each gap, note the backend service that powers it + line count
```
**Expected output:** Table: Route → Backend Service → api.client.ts method exists? → Priority to add.

#### Layer 6 — Data Chain Trace (5 critical chains)
For each chain, trace actual code execution from trigger to UI render:

```
[ ] P0-1: JEDI Score Engine
    - Does jedi-score.service.ts actually import and call formula-engine.ts F01–F06?
    - Does the Kafka consumer fire on sub-score change?
    - Does any frontend component call GET /jedi/score/:dealId?
    
[ ] P0-3: Zoning → Dev Capacity → Strategy (Keystone Cascade)
    - Does zoning.service.ts output feed development-capacity.service.ts input?
    - Does selectDevelopmentPath() exist as a callable function?
    - Does strategy-arbitrage-engine.ts import zoning/dev-capacity outputs?

[ ] P0-5: Strategy Arbitrage Engine
    - Does strategy-arbitrage-engine.ts call all 5 input modules (M02,M04,M05,M06,M07)?
    - Are the 4-strategy weights matching the Strategy Signal Weights sheet?
    - Where is the arbitrage detection threshold (delta > 15, winning > 70)?

[ ] P0-7: ProForma ↔ Capital Structure
    - Confirm the hardcoded irr=15 bug location (exact file + line)
    - Does capital-structure-adapter.ts actually resolve the circular dependency?
    - Is the event resolution order implemented or just designed?

[ ] Market → Traffic → Dev Capacity chain
    - Is M05→M07 handoff implemented? (submarket demand → traffic input)
    - Is M07→M03 handoff implemented? (traffic → development feasibility)
    - Is M07→M08 handoff implemented? (traffic scores → strategy weights)
```
**Expected output:** Per-chain status: FULLY WIRED / PARTIALLY WIRED / DESIGNED ONLY / BROKEN, with exact breakpoint locations.

#### Layer 7 — Deal Page Variant Divergence
```
[ ] List all 5 deal page variants: DealDetailPage, DealPageEnhanced, CapsuleDetailPage, DealPage, DealView
[ ] For each: count sections/tabs rendered, which mock data used, which API calls made
[ ] Identify which is the "most complete" (most sections, most real data)
[ ] Identify overlap — are any two variants rendering the same content differently?
[ ] Check: does the OverviewRouter dispatch correctly for 3 deal types?
```
**Expected output:** Variant comparison matrix + recommendation for canonical surface.

---

### Session 2: Frontend UI Audit

Open every live route in the app, document what renders vs what's broken.

#### Portfolio Context Screens (F1–F9)
```
[ ] F1 Dashboard — Does DashboardV3/DealGrid render? Map working? Any crashes?
[ ] F2 Pipeline — Does DealsPage render the deal list? Create deal flow work?
[ ] F3 Portfolio — Does AssetsOwnedPage render? Any data?
[ ] F4 Markets — Does MarketIntelligencePage render? All mock data? Any live feeds?
[ ] F5 Compete — Does ViewCompete render? Hardcoded strings only?
[ ] F6 News — Does NewsIntelligencePage render? Hardcoded NEWS array?
[ ] F7 Opps — ViewStub with 5 strings? opportunity-engine wired?
[ ] F8 Reports — ViewStub listing report types? Export working?
[ ] F9 Settings — User settings page working?
```

#### Deal Context Screens (F1–F12)
```
[ ] F1 Overview/M01 — JEDI Score display rendering? Mock or live? Score history?
[ ] F2 Property/M02 — Zoning tab rendering? Municode source links?
[ ] F3 Market/M05 — Market data rendering? Submarket info?
[ ] F4 Supply/M04 — Pipeline data? Supply pressure chart?
[ ] F5 Strategy/M08 — 4-column comparison? All mock?
[ ] F6 ProForma/M09 — ProForma tables rendering? irr=15 visible?
[ ] F7 Capital/M11 — Capital structure rendering? Debt service?
[ ] F8 Risk/M14 — 6 risk sub-scores rendering?
[ ] F9 Comps/M15 — Comp grid rendering?
[ ] F10 Traffic/M07 — What renders? DealStub? Anything?
[ ] F11 Docs/M18 — File upload/list working?
[ ] F12 Exit/M20 — DealStub? Anything?
```

#### Runtime Bug Detection
```
[ ] Open deal from pipeline view → check console for null/undefined crash
[ ] Navigate between deals rapidly → check for stale state / wrong deal data
[ ] Open each deal page variant → compare for missing sections
[ ] Check mobile viewport → responsive? Bloomberg terminal designed for desktop?
[ ] Test command palette (⌘K) → functional?
[ ] Test F-key navigation → keyboard handlers registered?
```

**Expected output:** Page-by-page status report with screenshots/console errors.

---

### Session 3: Backend Service & Formula Audit

#### Formula Engine Verification (formula-engine.ts, 1,681 lines)
```
[ ] F01 JEDI Score Composite — verify weights match spec: Demand 0.30, Supply 0.25, Momentum 0.20, Position 0.15, Risk 0.10
[ ] F02 Demand Sub-Score — verify distance_decay formula: 1/(1 + distance_miles/5)
[ ] F03 Supply Sub-Score — verify: 100 - (pipeline_units / (existing_units × absorption_rate × 12)) × 100
[ ] F04 Momentum Sub-Score — verify 5 equally weighted components
[ ] F05 Position Sub-Score — verify rent percentile + vacancy position + traffic score
[ ] F06 Risk Sub-Score — verify 100 - weighted_risk_sum (supply 25%, regulatory 25%, market 20%, execution 15%, climate 10%, insurance 5%)
[ ] F07–F09 Strategy-specific scores — verify BTS/Flip/Rental/STR weight variations per Strategy Signal Weights sheet
[ ] F10–F12 Demand event quantification — verify housing conversion, phasing, distance decay
[ ] F13–F15 Zoning formulas — verify utilization %, building envelope, supply gap
[ ] F16–F22 Traffic formulas — verify any that exist; flag hardcoded constants
[ ] F23–F24 Strategy scoring + arbitrage detection — verify threshold: delta>15 AND winner>70
[ ] F25–F35 ProForma formulas — verify NOI, IRR, cash-on-cash, equity multiple, DSCR
```

#### Strategy Arbitrage Engine Verification (467 lines)
```
[ ] Verify 4 strategies scored simultaneously (BTS, Flip, Rental, STR)
[ ] Verify each strategy uses correct signal weights from Strategy Signal Weights sheet
[ ] Verify gate logic: gates produce N/A not low scores
[ ] Verify arbitrage flag: delta > 15 AND winning score > 70
[ ] Check: does engine receive REAL inputs from M02/M04/M05/M06/M07, or are inputs hardcoded/null?
```

#### Agent Wiring Check
```
[ ] Research Agent — does it assemble DealContext JSON? What fields? Is it called from any endpoint?
[ ] Zoning Agent (A03) — does zoning-agent.service.ts exist and get called? Does it hit Municode?
[ ] Supply Agent — does supply-signal.service.ts get called on deal intake? From where?
[ ] Cashflow Agent — does proforma-generator.service.ts get invoked? By whom?
[ ] AI Coordinator (Claude) — is there an orchestration endpoint that chains agents?
[ ] Kafka consumers — are alert/demand/jedi-score/proforma consumers actually running?
```

#### Module Wiring Orchestrator Check (644 lines)
```
[ ] Does module-wiring-orchestrator.ts actually orchestrate a full pipeline run?
[ ] Is it called from any route or service? Or is it dead code?
[ ] Does module-registry.ts (791 lines) have all 25 modules registered?
[ ] Does data-flow-router.ts (557 lines) correctly route between modules?
[ ] Does module-event-bus.ts (217 lines) fire events that anything listens to?
```

**Expected output:** Formula verification report + agent status matrix + orchestrator wiring status.

---

## PHASE 1 — CRITICAL BUG FIXES (Sessions 4–6)

> Fix everything that crashes or produces wrong data before wiring new features.

### Session 4: Runtime Crash Fixes

```
[ ] BUG: Deal opens from pipeline view → null/undefined crash at render time
    - Reproduce: navigate to /deals → click any deal → check console
    - Root cause: likely dealStore not populated before component renders
    - Fix: add loading guard / null check in DealDetailPage or whichever variant is canonical
    - Verify: deal opens cleanly with no console errors

[ ] BUG: ProForma hardcodes irr=15
    - Location: proforma-generator.service.ts (find exact line)
    - Root cause: zero debt service input → fallback to constant
    - Fix: wire capital-structure-adapter.ts output → proforma debt service input
    - Fallback: if no capital structure data, show "IRR pending capital structure" not fake 15%

[ ] BUG: Zoning module competing implementations
    - Audit: how many zoning lookup functions exist? (12 zoning-* services mentioned)
    - Check: column naming inconsistencies between them
    - Check: unresolved git merge conflict in schema
    - Fix: pick canonical zoning lookup, deprecate others, resolve merge conflict

[ ] BUG: M07 Traffic Engine disconnected
    - Fix 1: Write the 3 empty migration files (traffic_predictions, traffic_calibration_factors, validation_properties)
    - Fix 2: Mount traffic routes in backend/src/api/rest/index.ts
    - Fix 3: Verify routes respond to basic GET requests after mounting
    - DO NOT wire to other modules yet — just make M07 reachable
```

### Session 5: Data Integrity Fixes

```
[ ] FIX: M07 three Market Adjustment factors returning hardcoded constants
    - Location: trafficPredictionEngine.ts or related services
    - Find the hardcoded values, replace with actual calculation or clear TODO marker
    - If data source not available, return null with confidence=0 not fake number

[ ] FIX: Zoning ST_Area projection issue
    - Verify: is ST_Area using State Plane projection or WGS84?
    - If WGS84, fix to State Plane (required for accurate area in sq ft)
    - Check: gross vs net lot area calculation — which municipality convention?

[ ] FIX: FAR exclusions vary by city
    - Audit: does zoning service account for city-specific FAR exclusion rules?
    - Check: height measurement conventions (different by municipality)
    - Document which cities have custom rules vs default handling

[ ] FIX: BeltLine Overlay handling (Atlanta)
    - Verify: is BeltLine treated as form-based overlay (correct) or standalone zone (wrong)?
    - Verify: February 2024 parking minimum elimination reflected in zoning logic?
    - If not, flag for Zoning Agent update
```

### Session 6: Store & State Management Fixes

```
[ ] FIX: dealStore stale data on deal switch
    - Verify: when user navigates from Deal A to Deal B, does store clear Deal A data first?
    - If not, add store.reset() or store.setDeal(null) before loading new deal
    - Check: DealContext cache (24h TTL) — does it correctly key by dealId?

[ ] FIX: 5 deal page variants — consolidate routing
    - Pick canonical: DealDetailPage (657 lines, most complete) OR CapsuleDetailPage (804 lines)
    - Add redirects from other 3 variants to canonical
    - Verify: OverviewRouter dispatches correctly for Existing Acquisition / Ground-Up / Redevelopment

[ ] FIX: dealStore as message bus enforcement
    - For every cross-module violation found in Session 1 Layer 2:
    - Refactor: remove direct import, replace with dealStore subscription via convenience hook
    - Pattern: const { zoningData } = useDealStoreSlice('zoning') — not import from zoning component
```

---

## PHASE 2 — API CLIENT + TYPED METHODS (Sessions 7–8)

> Before any frontend wiring, every backend route needs a typed client method.

### Session 7: api.client.ts Expansion — Core

Add typed methods for every mounted backend route that has no frontend client:

```
[ ] jedi: {
      getScore: (dealId: string) => GET /api/v1/jedi/score/${dealId}
      recalculate: (dealId: string) => POST /api/v1/jedi/score/${dealId}/recalculate
      getHistory: (dealId: string) => GET /api/v1/jedi/history/${dealId}
      getAlerts: () => GET /api/v1/jedi/alerts
      getDealAlerts: (dealId: string) => GET /api/v1/jedi/alerts/deal/${dealId}
    }

[ ] proforma: {
      get: (dealId: string) => GET /api/v1/proforma/${dealId}
      initialize: (dealId: string) => POST /api/v1/proforma/${dealId}/initialize
      recalculate: (dealId: string) => POST /api/v1/proforma/${dealId}/recalculate
      override: (dealId: string, overrides: ProFormaOverrides) => PATCH /api/v1/proforma/${dealId}/override
      compare: (dealId: string) => GET /api/v1/proforma/${dealId}/comparison
    }

[ ] demand: {
      getTradeArea: (id: string) => GET /api/v1/demand/trade-area/${id}
      getSubmarket: (id: string) => GET /api/v1/demand/submarket/${id}
      calculate: (params: DemandCalcInput) => POST /api/v1/demand/calculate
      getImpact: (dealId: string) => GET /api/v1/demand/impact/${dealId}
    }

[ ] supply: {
      getTradeArea: (id: string) => GET /api/v1/supply/trade-area/${id}
      getTradeAreaRisk: (id: string) => GET /api/v1/supply/trade-area/${id}/risk
      getCompetitive: (dealId: string) => GET /api/v1/supply/competitive/${dealId}
      getTimeline: (tradeAreaId: string) => GET /api/v1/supply/timeline/${tradeAreaId}
    }

[ ] risk: {
      getScore: (dealId: string) => GET /api/v1/risk/${dealId}
      getComponents: (dealId: string) => GET /api/v1/risk/${dealId}/components
    }

[ ] rankings: {
      getMarket: (marketId: string) => GET /api/v1/rankings/${marketId}
      getPerformance: (marketId: string) => GET /api/v1/rankings/performance/${marketId}
      getPipeline: (marketId: string) => GET /api/v1/rankings/pipeline/${marketId}
    }
```

### Session 8: api.client.ts Expansion — Intelligence Layer

```
[ ] traffic: {
      uploadAdt: (data: AdtUpload) => POST /api/v1/traffic-data/adt/upload
      getStations: () => GET /api/v1/traffic-data/adt/stations
      getNearest: (lat: number, lng: number) => GET /api/v1/traffic-data/adt/nearest
      getContext: (propertyId: string) => GET /api/v1/traffic-data/context/${propertyId}
    }

[ ] trafficComps: {
      getForDeal: (dealId: string) => GET /api/v1/traffic-comps/${dealId}
    }

[ ] correlations: {
      getReport: (params: CorrelationParams) => GET /api/v1/correlations/report
      getProperty: (propertyId: string) => GET /api/v1/correlations/property/${propertyId}
      getSummary: () => GET /api/v1/correlations/summary
    }

[ ] opportunityEngine: {
      detect: (params: OpportunityParams) => GET /api/v1/opportunity-engine/detect
      getRankings: () => GET /api/v1/opportunity-engine/rankings
    }

[ ] strategyAnalyses: {
      get: (dealId: string) => GET /api/v1/strategy-analyses/${dealId}
      run: (dealId: string, params: StrategyInput) => POST /api/v1/strategy-analyses/${dealId}
    }

[ ] scenarios: {
      generate: (dealId: string) => POST /api/v1/scenarios/${dealId}
      get: (dealId: string) => GET /api/v1/scenarios/${dealId}
    }

[ ] news: {
      getFeed: (params: NewsFeedParams) => GET /api/v1/news/feed
      getForDeal: (dealId: string) => GET /api/v1/news/deal/${dealId}
    }

[ ] Add TypeScript interfaces for every request/response shape
[ ] Add transformers (snake_case → camelCase) matching the transformDeal() pattern
[ ] Add error handling wrapper consistent with existing api.client.ts patterns
```

---

## PHASE 3 — MOCK-TO-API WIRING (Sessions 9–15)

> The primary unlock. Replace every mock data import with live API calls. Follow CLAUDE.md wiring sequence.

### Session 9: Wire Deal Overview (M01 + M25 JEDI Score)

```
[ ] Target: OverviewSection.tsx (currently imports enhancedOverviewMockData.ts)
[ ] Replace mock import with:
    - api.jedi.getScore(dealId) → JEDI Score, sub-scores, confidence
    - api.jedi.getHistory(dealId) → score sparkline data
    - api.deals.get(dealId) → property basics, owner info
[ ] Write to dealStore: dealStore.setJediScore(response)
[ ] Add loading skeleton matching Bloomberg terminal aesthetic
[ ] Add error state — "Score unavailable" not silent failure
[ ] Handle 3 deal type variants: check OverviewRouter dispatch
[ ] Remove enhancedOverviewMockData.ts import (can keep file for reference)
[ ] Verify: score gauge renders with real data, sparkline shows history trend
```

### Session 10: Wire Strategy Section (M08)

```
[ ] Target: StrategySection.tsx (imports enhancedStrategyMockData.ts + strategyMockData.ts)
[ ] Replace with: api.strategyAnalyses.get(dealId)
[ ] Backend call: strategy-arbitrage-engine.ts → 4-strategy simultaneous scores
[ ] Write to dealStore: dealStore.setStrategyResults(response)
[ ] Verify: 4-column comparison renders with real scores
[ ] Verify: arbitrage flag shows when delta > 15 AND winner > 70
[ ] Verify: gate results show "N/A" not "0" when strategy doesn't fit
[ ] Remove both mock data imports
```

### Session 11: Wire ProForma (M09)

```
[ ] Target: ProFormaIntelligence.tsx (imports enhancedProFormaMockData.ts)
[ ] Replace with: api.proforma.get(dealId)
[ ] If proforma not initialized: show "Initialize ProForma" button → api.proforma.initialize(dealId)
[ ] Wire capital-structure-adapter output → debt service field (fixes irr=15 bug)
[ ] Write to dealStore: dealStore.setProforma(response)
[ ] Verify: NOI, IRR, cash-on-cash, equity multiple, DSCR all render
[ ] Verify: 3-layer assumption model visible (broker/platform/user)
[ ] Add recalculate button → api.proforma.recalculate(dealId)
```

### Session 12: Wire Capital Structure (M11) + Debt

```
[ ] Target: CapitalStructureSection.tsx + DebtTab.tsx (import capitalStructureMockData.ts)
[ ] Replace with: proforma endpoint capital structure fields
[ ] Wire circular dependency: M09↔M11 via capital-structure-adapter.ts event resolution
[ ] Verify: debt service flows into ProForma IRR calculation
[ ] Verify: changing capital structure triggers ProForma recalculation
[ ] Remove capitalStructureMockData.ts import
```

### Session 13: Wire Supply (M04) + Demand (M06)

```
[ ] Target: Supply section components (import supplyMockData.ts)
[ ] Replace with: api.supply.getTradeArea(tradeAreaId) + api.supply.getCompetitive(dealId)
[ ] Wire to dealStore: dealStore.setSupplyData(response)

[ ] Target: Demand section (if exists as component)
[ ] Replace with: api.demand.getTradeArea(tradeAreaId) + api.demand.getImpact(dealId)
[ ] Wire to dealStore: dealStore.setDemandData(response)

[ ] Verify: supply pressure chart renders with real pipeline data
[ ] Verify: demand signals render with real event data
```

### Session 14: Wire Market Data (M05)

```
[ ] Target: MarketDataPageV2.tsx (imports mockSubmarketData.ts)
[ ] Replace with: api.rankings.getMarket(marketId) + market summary endpoints
[ ] Wire MARKET_VITALS to real market data endpoint
[ ] Wire SUBMARKETS table to real submarket data
[ ] Verify: market overview page renders with real data for Tampa/Orlando/Miami/Jacksonville/Atlanta/Dallas
```

### Session 15: Wire Remaining Mock Consumers

```
[ ] filesMockData.ts → api.deals.getFiles(dealId) (documentsFiles.routes.ts exists)
[ ] debtMockData.ts → already handled by Session 12, verify cleanup
[ ] timelineMockData.ts → api endpoint for deal timelines
[ ] Audit remaining 15 mock files from CLAUDE.md list:
    - If file has zero active importers → mark as deprecated, do not delete yet
    - If file has active importers → wire to appropriate API
[ ] After all wiring: run grep -r "from.*data/" to confirm zero mock imports remain in live routes
```

---

## PHASE 4 — AGENT INTEGRATION (Sessions 16–19)

### Session 16: Research Agent → DealContext Assembly

```
[ ] Verify: Research Agent produces typed DealContext JSON
[ ] Verify: DealContext includes all fields needed by downstream agents
[ ] Verify: DealContext cached in dealStore with 24h TTL
[ ] Wire: when user enters address in chat/web → Research Agent fires → DealContext written to store
[ ] Wire: all analytical agents receive DealContext as input (not pulling their own data)
[ ] Test: enter new address → verify DealContext JSON is complete and cached
```

### Session 17: Zoning Agent Full Wiring

```
[ ] Verify: Zoning Agent (A03) calls Municode API with correct city/state
[ ] Verify: Zoning Agent extracts FAR, setbacks, density, height, lot coverage
[ ] Verify: output feeds directly into M03 Development Capacity
[ ] Verify: Municode source links attached to every parameter (90% Municode)
[ ] Wire: Zoning Agent output → dealStore.setZoningData()
[ ] Wire: Zoning change → triggers M03 recalculation → triggers M08 recalculation (keystone cascade)
[ ] Test: enter known Tampa address → verify zoning output matches expected
```

### Session 18: Supply + Cashflow Agent Wiring

```
[ ] Supply Agent:
    - Verify: tracks permits, classifies construction status
    - Verify: calculates pipeline metrics (pipeline_units, absorption_rate)
    - Wire: output → dealStore.setSupplyData()
    - Wire: new supply event → triggers JEDI Score recalculation via Kafka

[ ] Cashflow Agent:
    - Verify: proforma-generator.service.ts produces full ProForma
    - Wire: receives DealContext + zoning + strategy → generates ProForma
    - Wire: output → dealStore.setProforma()
    - Test: verify ProForma numbers match formula engine F25–F35
```

### Session 19: AI Coordinator (Claude Orchestration)

```
[ ] Verify: Claude orchestration endpoint exists that chains all 4 agents
[ ] Wire: user submits deal → Research Agent → Zoning Agent → Supply Agent → Cashflow Agent → JEDI Score
[ ] Verify: DealContext flows correctly through entire chain
[ ] Verify: credit cost tracking via @stripe/token-meter wrapper
[ ] Verify: 24h cache hit on follow-up queries (60–70% cost reduction)
[ ] Wire: orchestration result → WebSocket push to frontend → dealStore update → UI re-render
```

---

## PHASE 5 — UI RECOMMENDATIONS & ENHANCEMENTS (Sessions 20–25)

### Session 20: Bloomberg Terminal Navigation Hardening

```
RECOMMENDATIONS:
[ ] F-key keyboard handler registration — verify F1–F12 actually work as keyboard shortcuts
[ ] Command palette (⌘K or /) — verify it opens, accepts input, navigates to results
[ ] Flat F-key screen transitions — verify fade animation (0.15s) on screen switch
[ ] Active F-key indicator — verify amber highlight on current screen
[ ] Deal Context entry/exit — verify clicking deal in pipeline → Deal Context F1, Back → Portfolio Context
[ ] Breadcrumb trail — show context path: Portfolio > Pipeline > Deal Name > F5 Strategy
[ ] F-key tooltips — on hover, show module name + keyboard shortcut

FIXES:
[ ] If F-key handlers not registered → add document.addEventListener('keydown', ...) in terminal shell
[ ] If command palette dead → wire to a search/navigation service
[ ] If screen transitions janky → check animation: fadeIn 0.15s ease applied consistently
```

### Session 21: Deal Page UI Consolidation

```
[ ] Implement DealScreenWrapper — collapses 30+ sidebar tabs into 12 F-key screens with internal tabs
[ ] Each screen maps to a module: F1→M01/M25, F2→M02, F3→M05, F4→M04, F5→M08, F6→M09, F7→M11, F8→M14, F9→M15, F10→M07, F11→M18, F12→M20
[ ] Internal tabs within each screen (e.g., F5 Strategy has: Scores | Arbitrage | Simulation | History)
[ ] Remove old sidebar accordion navigation
[ ] Preserve direct URL access: /deals/:dealId/strategy still works → opens Deal Context F5
[ ] Loading skeleton for each screen matching Bloomberg dark aesthetic

UI POLISH:
[ ] Score gauge widget — circular gauge with JEDI Score, amber gradient fill
[ ] Mini sparkline component — reusable, 60×20px, for score history / trend
[ ] Strategy comparison grid — 4 columns, color-coded by score tier
[ ] Risk radar — hexagonal radar chart for 6 risk components
[ ] Supply pipeline waterfall — stacked bar showing permits → under construction → delivered
```

### Session 22: Dashboard Intelligence Layer

```
[ ] KPI header bar — computed from dealStore aggregations:
    - Total deals in pipeline
    - Average JEDI Score
    - Deals in DD
    - Total AUM / pipeline value
    - Top arbitrage opportunity

[ ] Map intelligence layers (Mapbox):
    - PCS-colored markers (green/yellow/red by JEDI Score tier)
    - Deal pipeline stage icons
    - Submarket boundary shading by opportunity score
    - Click marker → mini deal card popup

[ ] Alert feed widget — real alerts from api.jedi.getAlerts()
    - Severity color coding (critical=red, high=amber, med=cyan, low=muted)
    - Click alert → navigate to relevant deal + screen

[ ] Live ticker bar — market data feed
    - Sources: FRED (rates), RentCast (avg rents), FDOT (traffic), apartments.com (vacancy)
    - Scroll animation matching Bloomberg terminal ticker
```

### Session 23: Chart & Visualization Components

```
BUILD REUSABLE COMPONENTS (Recharts + Bloomberg dark theme):

[ ] TimeSeriesChart — used by: score history, rent trends, traffic trajectory, supply pipeline
    - Dark background (#0F1319), amber/cyan/green line variants
    - Tooltip with data point details
    - Time range selector (30d / 90d / 1y / 3y / 5y)

[ ] ComparisonBarChart — used by: strategy scores, risk components, market ranking
    - Horizontal bars, color-coded by tier
    - Benchmark line overlay

[ ] ScatterPlot — used by: rent vs vacancy positioning, traffic vs digital correlation
    - Quadrant lines for T-04 classification (Hidden Gem / Winner / Hype / Dead)
    - Property dots with hover cards

[ ] WaterfallChart — used by: ProForma buildup, construction cost, cap rate decomposition
    - Running total with positive (green) / negative (red) segments

[ ] RadarChart — used by: risk assessment, competitive position
    - 6-axis hexagonal, translucent fill

[ ] HeatmapGrid — used by: correlation matrix, market comparison
    - Red-to-green color scale, cell values
```

### Session 24: Mobile & Responsive Considerations

```
RECOMMENDATIONS (Bloomberg terminal is desktop-first, but Surface 1 is mobile chat):

[ ] Bloomberg Terminal web app: desktop-only with minimum 1200px width
    - Add responsive breakpoint: below 1200px show "Desktop recommended" message
    - Or: mobile mode collapses F-keys into drawer/bottom nav

[ ] WhatsApp/Telegram chat surface: fully mobile-optimized
    - Card-based responses (JEDI Score card, Strategy card, ProForma summary card)
    - Address-driven flow: user sends address → gets full analysis as card sequence
    - Quick action buttons: "Run ProForma" / "Check Zoning" / "Compare Strategies"

[ ] Shared component library between surfaces:
    - ScoreCard (renders in both terminal panel and chat card)
    - StrategyComparison (4-column in terminal, stacked cards in chat)
    - AlertItem (row in terminal, notification card in chat)
```

### Session 25: Feature Recommendations (New Capabilities)

```
HIGH-IMPACT FEATURES NOT YET SPECCED:

[ ] RECOMMENDATION 1: Deal Comparison Mode
    - Select 2–3 deals → side-by-side JEDI Score + Strategy + ProForma comparison
    - "Which deal should I pursue?" decision tool
    - Bloomberg terminal layout: deals as columns, modules as rows
    - EFFORT: Medium — dealStore already has multi-deal capability

[ ] RECOMMENDATION 2: What-If Simulator
    - Slider-based: adjust rent growth, cap rate, construction costs, interest rates
    - Real-time ProForma recalculation as sliders move
    - "What if rent growth drops 2%?" → shows IRR impact instantly
    - EFFORT: Medium — proforma.recalculate endpoint exists, add parameter override

[ ] RECOMMENDATION 3: Deal Intake Wizard
    - Guided 4-step flow: Address → Confirm Zoning → Select Strategy → View Score
    - Replaces "blank deal page" experience for new users
    - Maps to DealContext assembly → Agent chain → Score display
    - EFFORT: Large — needs frontend wizard + backend orchestration endpoint

[ ] RECOMMENDATION 4: Portfolio Heat Map
    - Geographic view of all pipeline deals colored by JEDI Score
    - Cluster analysis: "Your Tampa deals average 78, Orlando averages 71"
    - Submarket opportunity overlay
    - EFFORT: Small — Mapbox layers + dealStore aggregation

[ ] RECOMMENDATION 5: Automated Weekly Digest
    - Email/WhatsApp: "Your portfolio this week" summary
    - Score changes, new alerts, market movements, action items
    - Claude-generated natural language summary
    - EFFORT: Medium — needs scheduled job + llm.service.ts template

[ ] RECOMMENDATION 6: Broker CMA Integration
    - Import broker's Comparative Market Analysis PDF → extract comps → feed M15
    - "Upload the broker's package" → auto-populate deal fields
    - EFFORT: Large — needs PDF parsing + field extraction + M15 wiring

[ ] RECOMMENDATION 7: Exit Countdown Timer
    - For each deal: days until target exit, projected value at exit, market conditions forecast
    - Visual countdown with green/amber/red status based on conditions
    - Links to Rate Strategy Score (RSS) once built
    - EFFORT: Medium — needs date calculation + M20 Exit module population
```

---

## PHASE 6 — DATA SOURCE INTEGRATION (Sessions 26–28)

### Session 26: Free Data Source Connections

```
[ ] FRED API — Federal funds rate, treasury yields, mortgage rates
    - Wire to: rate environment tracker, ProForma assumptions, exit timing
    - Endpoint: /api/v1/market-data/rates

[ ] Census / ArcGIS GeoEnrichment — demographics within trade area rings
    - Wire to: demand signals, traffic prediction (generator proximity)
    - Endpoint: /api/v1/demographics/:lat/:lng

[ ] FEMA — flood zone lookup by parcel
    - Wire to: M14 Risk → climate/insurance risk component
    - Endpoint: /api/v1/risk/flood-zone/:lat/:lng

[ ] BLS — employment data by MSA
    - Wire to: M06 Demand → employment growth signal
    - Endpoint: /api/v1/market-data/employment/:msaCode

[ ] IRS SOI Migration — county-to-county migration flows
    - Wire to: M06 Demand → migration trend signal
    - Endpoint: /api/v1/market-data/migration/:countyFips

[ ] FDOT Continuous Count Stations — traffic volumes (FREE)
    - Wire to: M07 Traffic → physical traffic baseline (T-02)
    - Endpoint: /api/v1/traffic-data/adt/stations (already exists, needs data)
```

### Session 27: Paid Data Source Connections (Priority)

```
[ ] RentCast API — rent estimates, comp data, market stats
    - Wire to: M05 Market, M09 ProForma rent assumptions, M15 Comps
    - Priority: HIGH — most immediate revenue-enabling data source

[ ] Apartments.com Scraper — property listings, asking rents, vacancy
    - Wire to: M05 Market, M04 Supply (existing inventory count)
    - Already partially built — verify scraper status

[ ] Stellar MLS via Bridge API — Florida MLS data
    - Wire to: M15 Comps, M05 Market, deal intake
    - Priority: HIGH — required for comp accuracy in Florida markets

[ ] Google Places API — business listings, reviews, foot traffic proxies
    - Wire to: M07 Traffic (generator proximity), M06 Demand (commercial activity)
    - Already identified in data source catalog
```

### Session 28: Placer.ai + SpyFu Integration

```
[ ] Placer.ai — foot traffic analytics
    - Wire to: M07 Traffic → physical traffic calibration (T-01 validation data source)
    - Provides: visitor counts, dwell time, visitor origins, demographics
    - Calibrates the prediction engine against ground truth

[ ] SpyFu — digital traffic / search interest
    - Wire to: M07 Traffic → digital traffic score (T-03)
    - Provides: keyword search volume by zip, competitor domain traffic
    - The "digital demand" signal that completes T-04 quadrant
```

---

## PHASE 7 — WHATSAPP + MESSAGING SURFACE (Sessions 29–31)

### Session 29: Twilio Conversations API Setup

```
[ ] Set up Twilio Conversations API for unified messaging
[ ] Configure WhatsApp Business API channel
[ ] Configure Apple Messages for Business channel (if approved)
[ ] Configure SMS fallback channel
[ ] Wire: incoming message → parse for address/command → route to appropriate handler
[ ] Verify: Telegram bot still works alongside new Twilio channels
```

### Session 30: Chat → Deal Analysis Flow

```
[ ] Address-driven flow:
    - User sends address → Research Agent → DealContext → 4-agent analysis → response cards
    - Response format: JEDI Score card + top strategy + key risk + "Want more details?"
    
[ ] Command parsing:
    - "/analyze [address]" → full analysis
    - "/score [address]" → JEDI Score only
    - "/zoning [address]" → zoning lookup only
    - "/compare [addr1] vs [addr2]" → side-by-side
    
[ ] Credit tracking:
    - Each command mapped to credit cost
    - Show remaining credits in response footer
    - Tier-appropriate access: Scout=chat only, Operator=chat+web
```

### Session 31: Chat Response Cards

```
[ ] Build card templates for WhatsApp/Telegram:
    - JEDI Score Card: Score gauge, trend arrow, confidence, top 3 factors
    - Strategy Card: winning strategy, score, key metrics, arbitrage flag
    - Risk Card: overall risk level, top 2 risk factors, mitigation notes
    - ProForma Summary Card: IRR, cash-on-cash, equity multiple, key assumptions
    - Market Card: submarket vitals, vacancy, rent growth, supply pressure

[ ] Interactive buttons:
    - "Full Report" → generates PDF deal memo
    - "Open in Terminal" → deep link to Bloomberg web app deal page
    - "Compare Strategies" → 4-strategy breakdown
    - "Check Zoning" → zoning detail with Municode link
```

---

## PHASE 8 — STRIPE BILLING + LAUNCH PREP (Sessions 32–35)

### Session 32: Token Billing Integration

```
[ ] Wire @stripe/token-meter wrapping @anthropic-ai/sdk
[ ] Define credit costs per operation:
    - Address lookup: 1 credit
    - Full deal analysis (4-agent): 10 credits
    - ProForma generation: 5 credits
    - Strategy comparison: 3 credits
    - Follow-up question (cached DealContext): 2 credits
    
[ ] Implement tier limits:
    - Scout ($49/mo): 100 credits, chat only
    - Operator ($199/mo): 500 credits, chat + web
    - Principal ($499/mo): 2,000 credits, all surfaces
    - Institutional: custom
    
[ ] Wire: credit check before every Claude API call
[ ] Wire: credit deduction after successful response
[ ] Wire: "Credits low" warning at 20% remaining
[ ] Wire: "Credits exhausted" → graceful degradation (cached results only)
```

### Session 33: Automation Levels (1–4)

```
[ ] Level 1 (Scout): Manual analysis — user asks, system responds
[ ] Level 2 (Operator): Triggered alerts — system monitors, pushes when threshold crossed
[ ] Level 3 (Principal): Automated workflows — auto-run analysis on new listings, auto-compare to portfolio
[ ] Level 4 (Institutional): Full autonomy — system identifies opportunities, generates memos, proposes actions

[ ] Wire: tier check on every automated action
[ ] Wire: automation settings page in F9 Settings
```

### Session 34: Error Handling, Logging, Monitoring

```
[ ] Add structured error handling to every API endpoint:
    - Consistent error response shape: { error: string, code: string, details?: any }
    - HTTP status codes: 400 (bad input), 401 (unauthed), 403 (tier limit), 404 (not found), 500 (server)
    
[ ] Add request logging:
    - Every API call: endpoint, userId, dealId, latency, success/failure
    - Every Claude API call: tokens in, tokens out, cost, credits charged
    
[ ] Add health checks:
    - GET /health — server up, DB connected, Kafka connected, Redis connected
    - GET /health/agents — each agent's last heartbeat + last successful run
    
[ ] Add Sentry or equivalent error tracking
[ ] Add basic analytics: DAU, API calls/day, most-used features, credit consumption
```

### Session 35: Pre-Launch Checklist

```
[ ] All mock data imports removed from live routes
[ ] All 5 critical data chains wired end-to-end
[ ] Deal opens without crash from pipeline view
[ ] JEDI Score renders with real data (not 0 or mock)
[ ] Strategy comparison shows real scores
[ ] ProForma shows real IRR (not hardcoded 15)
[ ] At least one data source connected per module (even if free/limited)
[ ] WhatsApp address → analysis flow working
[ ] Credit billing functional on at least Operator tier
[ ] Error handling on all endpoints
[ ] One test deal fully wired through all 25 modules
[ ] Deal types: Existing Acquisition + Ground-Up + Redevelopment all render correctly
```

---

## APPENDIX A — SESSION SCOPING RULES

Each Claude Code session should follow these rules:

1. **Read CLAUDE.md first** — every session starts by reading repo root context
2. **One wiring task per session** — don't try to wire M08 and M09 in the same session
3. **Session 1: define typed interface + write to store** — Session 2: refactor component to read from store
4. **Verify before and after** — run the app, check console, confirm the specific fix
5. **Update CLAUDE.md** after significant changes — keep the "Known Blockers" section current
6. **Mark checklist items** — come back to this file and check off completed items

---

## APPENDIX B — FILE REFERENCE QUICK INDEX

| What | Where |
|------|-------|
| Architectural context | `CLAUDE.md` (repo root) |
| Feature expansion map | `FEATURE_EXPANSION.md` (repo root) |
| Route registration | `backend/src/api/rest/index.ts` |
| Frontend API client | `frontend/src/services/api.client.ts` |
| Deal store (message bus) | `frontend/src/stores/dealStore.ts` |
| Mock data (THE BLOCKER) | `frontend/src/data/*.ts` (25 files) |
| Formula engine | `backend/src/services/module-wiring/formula-engine.ts` (1,681 lines) |
| Strategy engine | `backend/src/services/module-wiring/strategy-arbitrage-engine.ts` (467 lines) |
| JEDI Score service | `backend/src/services/jedi-score.service.ts` (748 lines) |
| ProForma services | `backend/src/services/proforma-*.service.ts` (1,620 lines across 3 files) |
| Module orchestrator | `backend/src/services/module-wiring/module-wiring-orchestrator.ts` (644 lines) |
| Kafka consumers | `backend/src/services/kafka/consumers/` (4 files) |
| Zoning services | `backend/src/services/zoning*.ts` (12+ files) |
| Traffic services | `backend/src/services/traffic*.ts` + `digital*.ts` + `leasing*.ts` (2,869 lines) |
| Bloomberg JSX prototype | `jedi-bloomberg-integrated.jsx` (667 lines) |
| Module Wiring Blueprint | `jedi_re_module_wiring_blueprint.xlsx` (7 sheets) |
| Strategy Matrix | `re_strategy_matrix.xlsx` (4 sheets) |
| Deal type interfaces | `frontend/src/types/deal.ts` |

---

## APPENDIX C — FORMULA VERIFICATION REFERENCE

From Module Wiring Blueprint → Formula Engine sheet (F01–F35):

| ID | Formula | Expected Calc | Module |
|----|---------|---------------|--------|
| F01 | JEDI Score (Composite) | (D×0.30)+(S×0.25)+(M×0.20)+(P×0.15)+(R×0.10) | M25 |
| F02 | Demand Sub-Score | Σ(impact × confidence × distance_decay) / normalizer | M06,M25 |
| F03 | Supply Sub-Score | 100 - (pipeline / (existing × absorption × 12)) × 100 | M04,M25 |
| F04 | Momentum Sub-Score | 5 equally weighted components | M25 |
| F05 | Position Sub-Score | rent_pctl + vacancy_position + traffic_score | M25 |
| F06 | Risk Sub-Score | 100 - Σ(weight × risk) | M14,M25 |
| F10 | Housing Conversion | event → housing units demand | M06 |
| F11 | Demand Phasing | demand ramp schedule by quarter | M06 |
| F13 | Zoning Utilization | current_density / max_density | M02 |
| F14 | Building Envelope | min(FAR, height, density, lot_coverage) constraints | M03 |
| F15 | Supply Gap | demand_projection - supply_pipeline over 10yr | M03 |
| F23 | Strategy Score | weighted signal composite per strategy type | M08 |
| F24 | Arbitrage Detection | IF delta>15 AND winner>70 THEN flag | M08 |

---

*Last updated: March 19, 2026*  
*Generated from: CLAUDE.md, FEATURE_EXPANSION.md, jedi_re_module_wiring_blueprint.xlsx, re_strategy_matrix.xlsx, jedi-bloomberg-integrated.jsx, jedi_re_audit_vs_progress.jsx*
