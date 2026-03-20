# PHASE 2, SESSION 7: API CLIENT METHODS INVENTORY

**Session:** Phase 2, Session 7: API Client Methods Inventory
**Date:** March 20, 2026
**Status:** AUDIT & PLANNING

---

## Current State: api.client.ts

**Existing Namespaces (4 total):**
- ✅ `api.auth` — 4 methods (login, register, logout, me)
- ✅ `api.deals` — 9 methods
- ✅ `api.properties` — 3 methods
- ✅ `api.analysis` — 2 methods

**Total Current Methods:** 18 typed methods

---

## Missing Namespaces: 50+ Methods Needed

Based on CLAUDE.md and backend route inventory, the following namespaces + methods are missing:

### NAMESPACE 1: api.jedi (JEDI Score Engine)
**Route:** `/api/v1/jedi/*`
**File:** `jedi.routes.ts` (748 lines)

**Methods Needed:**
```typescript
api.jedi = {
  // Score endpoints
  getScore: (dealId: string) => GET /jedi/score/:dealId
  recalculateScore: (dealId: string, options?: any) => POST /jedi/score/:dealId/recalculate
  getScoreHistory: (dealId: string) => GET /jedi/history/:dealId
  getScoreImpact: (dealId: string) => GET /jedi/impact/:dealId

  // Alert endpoints
  getAlerts: (params?: { status?, type?, marketId? }) => GET /jedi/alerts
  getAlertsByDeal: (dealId: string) => GET /jedi/alerts/deal/:dealId
  markAlertRead: (alertId: string) => POST /jedi/alerts/:id/read
  dismissAlert: (alertId: string) => POST /jedi/alerts/:id/dismiss
  getAlertSettings: () => GET /jedi/alerts/settings
  updateAlertSettings: (settings: any) => PATCH /jedi/alerts/settings
  checkAlerts: (dealIds: string[]) => POST /jedi/alerts/check
  recalculateAllScores: () => POST /jedi/recalculate-all
}
```

### NAMESPACE 2: api.proforma (ProForma & Capital Structure)
**Route:** `/api/v1/proforma/*`
**Files:** `proforma.routes.ts` + `capital-structure.routes.ts`

**Methods Needed:**
```typescript
api.proforma = {
  // ProForma endpoints
  getProforma: (dealId: string) => GET /proforma/:dealId
  initializeProforma: (dealId: string, inputs: any) => POST /proforma/:dealId/initialize
  recalculateProforma: (dealId: string, inputs: any) => POST /proforma/:dealId/recalculate
  overrideProformaField: (dealId: string, field: string, value: any) => PATCH /proforma/:dealId/override
  getProformaComparison: (dealId: string) => GET /proforma/:dealId/comparison
  getProformaHistory: (dealId: string) => GET /proforma/:dealId/history

  // Capital structure endpoints (if separate route)
  getCapitalStructure: (dealId: string) => GET /capital-structure/:dealId
  updateCapitalStructure: (dealId: string, data: any) => PATCH /capital-structure/:dealId
}
```

### NAMESPACE 3: api.demand (Demand Signal Engine)
**Route:** `/api/v1/demand/*`
**File:** `demand.routes.ts` + `demand-intelligence.routes.ts`

**Methods Needed:**
```typescript
api.demand = {
  // Trade area demand
  getDemandByTradeArea: (tradeAreaId: string) => GET /demand/trade-area/:id
  getDemandBySubmarket: (submarketId: string) => GET /demand/submarket/:id
  calculateDemand: (params: any) => POST /demand/calculate
  getDemandImpact: (dealId: string) => GET /demand/impact/:dealId
  getDemandSignals: (params?: any) => GET /demand-intelligence
  getDemandTrends: (marketId: string, period?: string) => GET /demand-intelligence/trends/:marketId
}
```

### NAMESPACE 4: api.supply (Supply Pipeline)
**Route:** `/api/v1/supply/*`
**File:** `supply.routes.ts`

**Methods Needed:**
```typescript
api.supply = {
  // Trade area supply
  getSupplyByTradeArea: (tradeAreaId: string) => GET /supply/trade-area/:id
  getSupplyRisk: (tradeAreaId: string) => GET /supply/trade-area/:id/risk
  getCompetitiveSupply: (dealId: string) => GET /supply/competitive/:dealId
  getSupplyTimeline: (tradeAreaId: string) => GET /supply/timeline/:tradeAreaId
  getSupplyPipeline: (params?: any) => GET /supply/pipeline
  getSupplyByStatus: (status: string) => GET /supply/status/:status
}
```

### NAMESPACE 5: api.risk (Risk Scoring)
**Route:** `/api/v1/risk/*`
**File:** `risk.routes.ts`

**Methods Needed:**
```typescript
api.risk = {
  getRiskScore: (dealId: string) => GET /risk/score/:dealId
  calculateRisk: (dealId: string, factors?: any) => POST /risk/calculate
  getRiskBreakdown: (dealId: string) => GET /risk/breakdown/:dealId
  getDemandRisk: (dealId: string) => GET /risk/demand/:dealId
  getSupplyRisk: (dealId: string) => GET /risk/supply/:dealId
  getMarketRisk: (dealId: string) => GET /risk/market/:dealId
  getRegulatoryRisk: (dealId: string) => GET /risk/regulatory/:dealId
}
```

### NAMESPACE 6: api.rankings (Performance Rankings)
**Route:** `/api/v1/rankings/*`
**File:** `rankings.routes.ts`

**Methods Needed:**
```typescript
api.rankings = {
  getRankingsByMarket: (marketId: string) => GET /rankings/:marketId
  getPerformanceRankings: (marketId: string) => GET /rankings/performance/:marketId
  getPipelineRankings: (marketId: string) => GET /rankings/pipeline/:marketId
  compareProperties: (propertyIds: string[]) => POST /rankings/compare
  getPropertyRanking: (propertyId: string) => GET /rankings/property/:propertyId
}
```

### NAMESPACE 7: api.traffic (Traffic Engine)
**Route:** `/api/v1/traffic-data/*` and `/api/v1/traffic-comps/*`
**Files:** `traffic-data.routes.ts` + `traffic-comps.routes.ts`

**Methods Needed:**
```typescript
api.traffic = {
  // Traffic data endpoints
  uploadADT: (data: any) => POST /traffic-data/adt/upload
  getADTStations: (params?: any) => GET /traffic-data/adt/stations
  getNearestADTStation: (lat: number, lng: number) => GET /traffic-data/adt/nearest
  getTrafficContext: (propertyId: string) => GET /traffic-data/context/:propertyId
  getTrafficData: (dealId: string) => GET /traffic-data/:dealId

  // Traffic comps endpoints
  getTrafficComps: (dealId: string) => GET /traffic-comps/:dealId
  compareTraffic: (dealIds: string[]) => POST /traffic-comps/compare
  getTrafficForecast: (dealId: string, months?: number) => GET /traffic-comps/:dealId/forecast
}
```

### NAMESPACE 8: api.correlations (Market Correlations)
**Route:** `/api/v1/correlations/*`
**File:** `correlation.routes.ts`

**Methods Needed:**
```typescript
api.correlations = {
  getCorrelationReport: (params?: any) => GET /correlations/report
  getPropertyCorrelations: (propertyId: string) => GET /correlations/property/:propertyId
  getMarketCorrelations: (marketId: string) => GET /correlations/market/:marketId
  getCorrelationSummary: (dealId: string) => GET /correlations/summary
  analyzeCorrelations: (data: any) => POST /correlations/analyze
}
```

### NAMESPACE 9: api.opportunityEngine (Opportunity Detection)
**Route:** `/api/v1/opportunity-engine/*` (if exists) or via analysis routes

**Methods Needed:**
```typescript
api.opportunityEngine = {
  detectOpportunities: (params: any) => POST /opportunity-engine/detect
  getRankingByScore: (limit?: number) => GET /opportunity-engine/rankings
  getOpportunitiesForMarket: (marketId: string) => GET /opportunity-engine/market/:marketId
}
```

### NAMESPACE 10: api.strategyAnalyses (Strategy Arbitrage)
**Route:** `/api/v1/strategy-analyses/*`
**File:** `strategy-analyses.routes.ts`

**Methods Needed:**
```typescript
api.strategyAnalyses = {
  getStrategyAnalysis: (dealId: string) => GET /strategy-analyses/:dealId
  calculateStrategies: (dealId: string, options?: any) => POST /strategy-analyses/:dealId/calculate
  getStrategyComparison: (dealId: string) => GET /strategy-analyses/:dealId/comparison
  compareMultipleStrategies: (dealIds: string[]) => POST /strategy-analyses/compare
  getArbitrageOpportunities: (dealId: string) => GET /strategy-analyses/:dealId/arbitrage
}
```

### NAMESPACE 11: api.zoning (Zoning & Entitlements)
**Route:** `/api/v1/zoning/*` + related zoning routes
**Files:** `zoning.routes.ts` + `zoning-*.routes.ts`

**Methods Needed:**
```typescript
api.zoning = {
  lookupZoning: (lat: number, lng: number, municipality?: string) => GET /zoning/lookup
  getZoningByCode: (municipality: string, state: string, code: string) => GET /zoning/:code
  getZoningCapacity: (dealId: string) => GET /zoning/capacity/:dealId
  getZoningProfile: (dealId: string) => GET /zoning/profile/:dealId
  verifyZoning: (dealId: string, expectedCode?: string) => POST /zoning-verification/:dealId
  getZoningHistory: (parcelId: string) => GET /zoning/history/:parcelId
  compareZoning: (jurisdictions: any[]) => POST /zoning-comparator/compare
}
```

### NAMESPACE 12: api.scenarios (Scenario Generation)
**Route:** `/api/v1/scenarios/*` + `/api/v1/development-scenarios/*`

**Methods Needed:**
```typescript
api.scenarios = {
  generateScenarios: (dealId: string, options?: any) => POST /scenarios/generate
  getScenarios: (dealId: string) => GET /scenarios/:dealId
  compareScenarios: (scenarioIds: string[]) => POST /scenarios/compare
  getDevelopmentScenarios: (dealId: string) => GET /development-scenarios/:dealId
}
```

### NAMESPACE 13: api.news (News Intelligence)
**Route:** `/api/v1/news/*`
**File:** `news.routes.ts`

**Methods Needed:**
```typescript
api.news = {
  getNewsByMarket: (marketId: string, params?: any) => GET /news/market/:marketId
  getNewsImpact: (dealId: string) => GET /news/impact/:dealId
  searchNews: (query: string, filters?: any) => GET /news/search
  getNewsTimeline: (marketId: string) => GET /news/timeline/:marketId
  analyzeNewsSentiment: (marketId: string) => GET /news/sentiment/:marketId
}
```

### NAMESPACE 14: api.market (Market Intelligence)
**Route:** `/api/v1/market/*`
**File:** `market.routes.ts`

**Methods Needed:**
```typescript
api.market = {
  getMarketData: (marketId: string) => GET /market/:marketId
  getMarketSummary: (marketId: string) => GET /market/:marketId/summary
  getMarketTrends: (marketId: string, metric?: string) => GET /market/:marketId/trends
  compareMarkets: (marketIds: string[]) => POST /market/compare
  getSubmarketData: (submarketId: string) => GET /market/submarket/:submarketId
}
```

### NAMESPACE 15: api.deals (Extended)
**Additions to existing deals namespace:**

**Methods Needed:**
```typescript
api.deals.financialModels = (dealId: string) => GET /deals/:dealId/financial-models
api.deals.getCompetition = (dealId: string) => GET /deals/:dealId/competition
api.deals.getMarketIntelligence = (dealId: string) => GET /deals/:dealId/market-intelligence
api.deals.getTimeline = (dealId: string) => GET /deals/:dealId/timeline
api.deals.get3DDesign = (dealId: string) => GET /deals/:dealId/3d-design
api.deals.save3DDesign = (dealId: string, design: any) => POST /deals/:dealId/3d-design
```

### NAMESPACE 16: api.tradeAreas (Geographic Definition)
**Route:** `/api/v1/trade-areas/*`
**File:** `trade-areas.routes.ts`

**Methods Needed:**
```typescript
api.tradeAreas = {
  listTradeAreas: (params?: any) => GET /trade-areas
  createTradeArea: (data: any) => POST /trade-areas
  getTradeArea: (id: string) => GET /trade-areas/:id
  updateTradeArea: (id: string, data: any) => PATCH /trade-areas/:id
  deleteTradeArea: (id: string) => DELETE /trade-areas/:id
  getTradeAreaMetrics: (id: string) => GET /trade-areas/:id/metrics
}
```

### NAMESPACE 17: api.modules (Module Management)
**Route:** `/api/v1/modules/*`
**File:** `modules.routes.ts`

**Methods Needed:**
```typescript
api.modules = {
  listModules: (params?: any) => GET /modules
  getModule: (id: string) => GET /modules/:id
  updateModuleSettings: (id: string, settings: any) => PATCH /modules/:id/settings
  enableModule: (id: string) => POST /modules/:id/enable
  disableModule: (id: string) => POST /modules/:id/disable
}
```

---

## Summary: API Client Gaps

| Namespace | Methods | Priority | Status |
|-----------|---------|----------|--------|
| auth | 4 | P0 | ✅ Exists |
| deals | 9+6 | P0 | ⚠️ Partial |
| properties | 3+2 | P0 | ⚠️ Partial |
| analysis | 2 | P0 | ⚠️ Partial |
| **jedi** | 12 | P1 | 🔴 Missing |
| **proforma** | 8 | P1 | 🔴 Missing |
| **demand** | 6 | P1 | 🔴 Missing |
| **supply** | 6 | P1 | 🔴 Missing |
| **risk** | 7 | P1 | 🔴 Missing |
| **rankings** | 5 | P1 | 🔴 Missing |
| **traffic** | 7 | P2 | 🔴 Missing |
| **correlations** | 5 | P2 | 🔴 Missing |
| **opportunityEngine** | 3 | P2 | 🔴 Missing |
| **strategyAnalyses** | 5 | P2 | 🔴 Missing |
| **zoning** | 7 | P1 | 🔴 Missing |
| **scenarios** | 4 | P2 | 🔴 Missing |
| **news** | 5 | P2 | 🔴 Missing |
| **market** | 5 | P1 | 🔴 Missing |
| **tradeAreas** | 6 | P1 | 🔴 Missing |
| **modules** | 6 | P1 | 🔴 Missing |
| **TOTAL** | 123 | — | 18 exist, 105 missing |

---

## Implementation Strategy (Session 8)

**Phase 1: Type Definitions** (Session 8a)
1. Create request/response interface files for each namespace
2. Define parameter and return type contracts

**Phase 2: Method Implementation** (Session 8b)
1. Add each typed method to api.client.ts
2. Map to correct backend endpoints
3. Add request transformation (snake_case ← → camelCase)
4. Add error handling

**Phase 3: Integration Testing** (Session 8c)
1. Test sample methods against running backend
2. Verify authentication flow
3. Verify response parsing

---

## Deliverables for Phase 2

**Session 7:** This inventory document (105 missing methods identified)
**Session 8:** Expanded api.client.ts with all 105+ methods fully typed and implemented

---

## Critical Dependencies

- Session 8 **must complete before Phase 3** (Mock-to-API wiring)
- All typed methods required for sections to wire to live endpoints
- Response types must match deal section component expectations

---

*Session 7 complete. API inventory documented. Ready for Session 8 implementation.*
