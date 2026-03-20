import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

export const apiClient: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear auth and redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }

    if (error.response?.status === 403) {
      // Forbidden - show upgrade message
      console.error('Access forbidden:', error.response.data);
    }

    if (error.response?.status === 429) {
      // Rate limited
      console.error('Rate limit exceeded');
    }

    return Promise.reject(error);
  }
);

// Typed API methods
export const api = {
  // Auth
  auth: {
    login: (email: string, password: string) =>
      apiClient.post('/api/v1/auth/login', { email, password }),
    register: (data: any) => apiClient.post('/api/v1/auth/register', data),
    logout: () => apiClient.post('/api/v1/auth/logout'),
    me: () => apiClient.get('/api/v1/auth/me'),
  },

  // Deals (base)
  deals: {
    list: (params?: any) => apiClient.get('/api/v1/deals', { params }),
    get: (id: string) => apiClient.get(`/api/v1/deals/${id}`),
    create: (data: any) => apiClient.post('/api/v1/deals', data),
    update: (id: string, data: any) => apiClient.patch(`/api/v1/deals/${id}`, data),
    delete: (id: string) => apiClient.delete(`/api/v1/deals/${id}`),
    modules: (id: string) => apiClient.get(`/api/v1/deals/${id}/modules`),
    properties: (id: string, filters?: any) =>
      apiClient.get(`/api/v1/deals/${id}/properties`, { params: filters }),
    pipeline: (id: string) => apiClient.get(`/api/v1/deals/${id}/pipeline`),
    analysis: (id: string) => apiClient.post(`/api/v1/deals/${id}/analysis/trigger`),
    leaseAnalysis: (id: string) => apiClient.get(`/api/v1/deals/${id}/lease-analysis`),
    geographicContext: (id: string) => apiClient.get(`/api/v1/deals/${id}/geographic-context`),
    // Extended endpoints
    getFinancialModels: (dealId: string) =>
      apiClient.get(`/api/v1/deals/${dealId}/financial-models`),
    getCompetition: (dealId: string) => apiClient.get(`/api/v1/deals/${dealId}/competition`),
    getMarketIntelligence: (dealId: string) =>
      apiClient.get(`/api/v1/deals/${dealId}/market-intelligence`),
    getTimeline: (dealId: string) => apiClient.get(`/api/v1/deals/${dealId}/timeline`),
    get3DDesign: (dealId: string) => apiClient.get(`/api/v1/deals/${dealId}/3d-design`),
    save3DDesign: (dealId: string, design: any) =>
      apiClient.post(`/api/v1/deals/${dealId}/3d-design`, design),
  },

  // Properties
  properties: {
    list: (params?: any) => apiClient.get('/api/v1/properties', { params }),
    get: (id: string) => apiClient.get(`/api/v1/properties/${id}`),
    search: (query: any) => apiClient.post('/api/v1/properties/search', query),
  },

  // Analysis
  analysis: {
    trigger: (dealId: string) => apiClient.post(`/api/v1/deals/${dealId}/analysis/trigger`),
    latest: (dealId: string) => apiClient.get(`/api/v1/deals/${dealId}/analysis/latest`),
  },

  // JEDI Score Engine (M01)
  jedi: {
    getScore: (dealId: string) => apiClient.get(`/api/v1/jedi/score/${dealId}`),
    recalculateScore: (dealId: string, options?: any) =>
      apiClient.post(`/api/v1/jedi/score/${dealId}/recalculate`, options),
    getScoreHistory: (dealId: string) => apiClient.get(`/api/v1/jedi/history/${dealId}`),
    getScoreImpact: (dealId: string) => apiClient.get(`/api/v1/jedi/impact/${dealId}`),
    getAlerts: (params?: any) => apiClient.get(`/api/v1/jedi/alerts`, { params }),
    getAlertsByDeal: (dealId: string) => apiClient.get(`/api/v1/jedi/alerts/deal/${dealId}`),
    markAlertRead: (alertId: string) => apiClient.post(`/api/v1/jedi/alerts/${alertId}/read`),
    dismissAlert: (alertId: string) => apiClient.post(`/api/v1/jedi/alerts/${alertId}/dismiss`),
    getAlertSettings: () => apiClient.get(`/api/v1/jedi/alerts/settings`),
    updateAlertSettings: (settings: any) => apiClient.patch(`/api/v1/jedi/alerts/settings`, settings),
    checkAlerts: (dealIds: string[]) =>
      apiClient.post(`/api/v1/jedi/alerts/check`, { deal_ids: dealIds }),
    recalculateAllScores: () => apiClient.post(`/api/v1/jedi/recalculate-all`),
  },

  // ProForma & Capital Structure (M09, M11)
  proforma: {
    getProforma: (dealId: string) => apiClient.get(`/api/v1/proforma/${dealId}`),
    initializeProforma: (dealId: string, inputs: any) =>
      apiClient.post(`/api/v1/proforma/${dealId}/initialize`, inputs),
    recalculateProforma: (dealId: string, inputs: any) =>
      apiClient.post(`/api/v1/proforma/${dealId}/recalculate`, inputs),
    overrideProformaField: (dealId: string, field: string, value: any) =>
      apiClient.patch(`/api/v1/proforma/${dealId}/override`, { field, value }),
    getProformaComparison: (dealId: string) => apiClient.get(`/api/v1/proforma/${dealId}/comparison`),
    getProformaHistory: (dealId: string) => apiClient.get(`/api/v1/proforma/${dealId}/history`),
    getCapitalStructure: (dealId: string) => apiClient.get(`/api/v1/capital-structure/${dealId}`),
    updateCapitalStructure: (dealId: string, data: any) =>
      apiClient.patch(`/api/v1/capital-structure/${dealId}`, data),
    calculateCapitalStack: (data: any) =>
      apiClient.post(`/api/v1/capital-structure/stack`, data),
  },

  // Demand Intelligence (M05, M06)
  demand: {
    getDemandByTradeArea: (tradeAreaId: string) =>
      apiClient.get(`/api/v1/demand/trade-area/${tradeAreaId}`),
    getDemandBySubmarket: (submarketId: string) =>
      apiClient.get(`/api/v1/demand/submarket/${submarketId}`),
    calculateDemand: (params: any) => apiClient.post(`/api/v1/demand/calculate`, params),
    getDemandImpact: (dealId: string) => apiClient.get(`/api/v1/demand/impact/${dealId}`),
    getDemandSignals: (params?: any) => apiClient.get(`/api/v1/demand-intelligence`, { params }),
    getDemandTrends: (marketId: string, period?: string) =>
      apiClient.get(`/api/v1/demand-intelligence/trends/${marketId}`, { params: { period } }),
  },

  // Supply Pipeline (M04)
  supply: {
    getSupplyByTradeArea: (tradeAreaId: string) =>
      apiClient.get(`/api/v1/supply/trade-area/${tradeAreaId}`),
    getSupplyRisk: (tradeAreaId: string) =>
      apiClient.get(`/api/v1/supply/trade-area/${tradeAreaId}/risk`),
    getCompetitiveSupply: (dealId: string) => apiClient.get(`/api/v1/supply/competitive/${dealId}`),
    getSupplyTimeline: (tradeAreaId: string) =>
      apiClient.get(`/api/v1/supply/timeline/${tradeAreaId}`),
    getSupplyPipeline: (params?: any) => apiClient.get(`/api/v1/supply/pipeline`, { params }),
    getSupplyByStatus: (status: string) => apiClient.get(`/api/v1/supply/status/${status}`),
  },

  // Risk Scoring (M14)
  risk: {
    getRiskScore: (dealId: string) => apiClient.get(`/api/v1/risk/score/${dealId}`),
    calculateRisk: (dealId: string, factors?: any) =>
      apiClient.post(`/api/v1/risk/calculate/${dealId}`, factors),
    getRiskBreakdown: (dealId: string) => apiClient.get(`/api/v1/risk/breakdown/${dealId}`),
    getDemandRisk: (dealId: string) => apiClient.get(`/api/v1/risk/demand/${dealId}`),
    getSupplyRisk: (dealId: string) => apiClient.get(`/api/v1/risk/supply/${dealId}`),
    getMarketRisk: (dealId: string) => apiClient.get(`/api/v1/risk/market/${dealId}`),
    getRegulatoryRisk: (dealId: string) => apiClient.get(`/api/v1/risk/regulatory/${dealId}`),
  },

  // Performance Rankings (M15)
  rankings: {
    getRankingsByMarket: (marketId: string) => apiClient.get(`/api/v1/rankings/${marketId}`),
    getPerformanceRankings: (marketId: string) =>
      apiClient.get(`/api/v1/rankings/performance/${marketId}`),
    getPipelineRankings: (marketId: string) => apiClient.get(`/api/v1/rankings/pipeline/${marketId}`),
    compareProperties: (propertyIds: string[]) =>
      apiClient.post(`/api/v1/rankings/compare`, { property_ids: propertyIds }),
    getPropertyRanking: (propertyId: string) => apiClient.get(`/api/v1/rankings/property/${propertyId}`),
  },

  // Traffic Engine (M07)
  traffic: {
    uploadADT: (data: any) => apiClient.post(`/api/v1/traffic-data/adt/upload`, data),
    getADTStations: (params?: any) => apiClient.get(`/api/v1/traffic-data/adt/stations`, { params }),
    getNearestADTStation: (lat: number, lng: number) =>
      apiClient.get(`/api/v1/traffic-data/adt/nearest`, { params: { lat, lng } }),
    getTrafficContext: (propertyId: string) =>
      apiClient.get(`/api/v1/traffic-data/context/${propertyId}`),
    getTrafficData: (dealId: string) => apiClient.get(`/api/v1/traffic-data/${dealId}`),
    getTrafficComps: (dealId: string) => apiClient.get(`/api/v1/traffic-comps/${dealId}`),
    compareTraffic: (dealIds: string[]) =>
      apiClient.post(`/api/v1/traffic-comps/compare`, { deal_ids: dealIds }),
    getTrafficForecast: (dealId: string, months?: number) =>
      apiClient.get(`/api/v1/traffic-comps/${dealId}/forecast`, { params: { months } }),
  },

  // Market Correlations
  correlations: {
    getCorrelationReport: (params?: any) =>
      apiClient.get(`/api/v1/correlations/report`, { params }),
    getPropertyCorrelations: (propertyId: string) =>
      apiClient.get(`/api/v1/correlations/property/${propertyId}`),
    getMarketCorrelations: (marketId: string) =>
      apiClient.get(`/api/v1/correlations/market/${marketId}`),
    getCorrelationSummary: (dealId: string) => apiClient.get(`/api/v1/correlations/summary/${dealId}`),
    analyzeCorrelations: (data: any) => apiClient.post(`/api/v1/correlations/analyze`, data),
  },

  // Opportunity Engine
  opportunityEngine: {
    detectOpportunities: (params: any) =>
      apiClient.post(`/api/v1/opportunity-engine/detect`, params),
    getRankingByScore: (limit?: number) =>
      apiClient.get(`/api/v1/opportunity-engine/rankings`, { params: { limit } }),
    getOpportunitiesForMarket: (marketId: string) =>
      apiClient.get(`/api/v1/opportunity-engine/market/${marketId}`),
  },

  // Strategy Analyses (M08)
  strategyAnalyses: {
    getStrategyAnalysis: (dealId: string) =>
      apiClient.get(`/api/v1/strategy-analyses/${dealId}`),
    calculateStrategies: (dealId: string, options?: any) =>
      apiClient.post(`/api/v1/strategy-analyses/${dealId}/calculate`, options),
    getStrategyComparison: (dealId: string) =>
      apiClient.get(`/api/v1/strategy-analyses/${dealId}/comparison`),
    compareMultipleStrategies: (dealIds: string[]) =>
      apiClient.post(`/api/v1/strategy-analyses/compare`, { deal_ids: dealIds }),
    getArbitrageOpportunities: (dealId: string) =>
      apiClient.get(`/api/v1/strategy-analyses/${dealId}/arbitrage`),
  },

  // Zoning & Entitlements (M02, M03)
  zoning: {
    lookupZoning: (lat: number, lng: number, municipality?: string) =>
      apiClient.get(`/api/v1/zoning/lookup`, { params: { lat, lng, municipality } }),
    getZoningByCode: (code: string, municipality?: string, state?: string) =>
      apiClient.get(`/api/v1/zoning/${code}`, { params: { municipality, state } }),
    getZoningCapacity: (dealId: string) => apiClient.get(`/api/v1/zoning/capacity/${dealId}`),
    getZoningProfile: (dealId: string) => apiClient.get(`/api/v1/zoning/profile/${dealId}`),
    verifyZoning: (dealId: string, expectedCode?: string) =>
      apiClient.post(`/api/v1/zoning-verification/${dealId}`, { expected_code: expectedCode }),
    getZoningHistory: (parcelId: string) => apiClient.get(`/api/v1/zoning/history/${parcelId}`),
    compareZoning: (jurisdictions: any[]) =>
      apiClient.post(`/api/v1/zoning-comparator/compare`, { jurisdictions }),
  },

  // Entitlements & Benchmarking
  entitlements: {
    getEntitlementsByDeal: (dealId: string) =>
      apiClient.get(`/api/v1/entitlements/deal/${dealId}`),
    getBenchmarkTimeline: (county: string, state: string) =>
      apiClient.get(`/api/v1/benchmark-timeline/benchmarks`, { params: { county, state } }),
  },

  // Scenario Generation
  scenarios: {
    generateScenarios: (dealId: string, options?: any) =>
      apiClient.post(`/api/v1/scenarios/generate/${dealId}`, options),
    getScenarios: (dealId: string) => apiClient.get(`/api/v1/scenarios/${dealId}`),
    compareScenarios: (scenarioIds: string[]) =>
      apiClient.post(`/api/v1/scenarios/compare`, { scenario_ids: scenarioIds }),
    getDevelopmentScenarios: (dealId: string) =>
      apiClient.get(`/api/v1/development-scenarios/${dealId}`),
  },

  // News Intelligence
  news: {
    getNewsByMarket: (marketId: string, params?: any) =>
      apiClient.get(`/api/v1/news/market/${marketId}`, { params }),
    getNewsImpact: (dealId: string) => apiClient.get(`/api/v1/news/impact/${dealId}`),
    searchNews: (query: string, filters?: any) =>
      apiClient.get(`/api/v1/news/search`, { params: { query, ...filters } }),
    getNewsTimeline: (marketId: string) => apiClient.get(`/api/v1/news/timeline/${marketId}`),
    analyzeNewsSentiment: (marketId: string) =>
      apiClient.get(`/api/v1/news/sentiment/${marketId}`),
  },

  // Market Intelligence (M05)
  market: {
    getMarketData: (marketId: string) => apiClient.get(`/api/v1/market/${marketId}`),
    getMarketSummary: (marketId: string) => apiClient.get(`/api/v1/market/${marketId}/summary`),
    getMarketTrends: (marketId: string, metric?: string) =>
      apiClient.get(`/api/v1/market/${marketId}/trends`, { params: { metric } }),
    compareMarkets: (marketIds: string[]) =>
      apiClient.post(`/api/v1/market/compare`, { market_ids: marketIds }),
    getSubmarketData: (submarketId: string) =>
      apiClient.get(`/api/v1/market/submarket/${submarketId}`),
  },

  // Trade Areas (Geographic Definition)
  tradeAreas: {
    listTradeAreas: (params?: any) => apiClient.get(`/api/v1/trade-areas`, { params }),
    createTradeArea: (data: any) => apiClient.post(`/api/v1/trade-areas`, data),
    getTradeArea: (id: string) => apiClient.get(`/api/v1/trade-areas/${id}`),
    updateTradeArea: (id: string, data: any) => apiClient.patch(`/api/v1/trade-areas/${id}`, data),
    deleteTradeArea: (id: string) => apiClient.delete(`/api/v1/trade-areas/${id}`),
    getTradeAreaMetrics: (id: string) => apiClient.get(`/api/v1/trade-areas/${id}/metrics`),
  },

  // Comp Discovery & Management (M15)
  compDiscovery: {
    discoverTieredComps: (dealId: string, radiusMiles?: number) =>
      apiClient.get(`/api/v1/deals/${dealId}/comp-set/discover-tiered`, { params: { radiusMiles } }),
    getCompSet: (dealId: string) =>
      apiClient.get(`/api/v1/deals/${dealId}/comp-set`),
    discoverComps: (dealId: string, options?: any) =>
      apiClient.post(`/api/v1/deals/${dealId}/comp-set/discover`, options),
    addCompToSet: (dealId: string, comp: any) =>
      apiClient.post(`/api/v1/deals/${dealId}/comp-set/add-to-set`, comp),
    addCompPropertyToSet: (dealId: string, data: any) =>
      apiClient.post(`/api/v1/deals/${dealId}/comp-set`, data),
    removeCompFromSet: (dealId: string, compAddress: string) =>
      apiClient.post(`/api/v1/deals/${dealId}/comp-set/remove`, { comp_property_address: compAddress }),
  },

  // Module Management
  modules: {
    listModules: (params?: any) => apiClient.get(`/api/v1/modules`, { params }),
    getModule: (id: string) => apiClient.get(`/api/v1/modules/${id}`),
    updateModuleSettings: (id: string, settings: any) =>
      apiClient.patch(`/api/v1/modules/${id}/settings`, settings),
    enableModule: (id: string) => apiClient.post(`/api/v1/modules/${id}/enable`),
    disableModule: (id: string) => apiClient.post(`/api/v1/modules/${id}/disable`),
    getModuleLibraries: (moduleId: string) =>
      apiClient.get(`/api/v1/module-libraries/${moduleId}`),
  },
};

export default apiClient;
