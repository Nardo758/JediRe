import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  CanonicalDealData,
  CanonicalSiteData,
  CanonicalDealInputs,
  createEmptySiteData,
  createEmptyDealInputs,
  parseDealInputs,
  parseZoningToSiteData,
  computeCanonicalData,
} from './canonicalDealData';
import { useDealAssumptions, DealAssumptions, ComputedReturns, DealFullContext } from '../hooks/useDealAssumptions';

export interface Design3DState {
  totalUnits: number;
  unitMix: { studio: number; oneBed: number; twoBed: number; threeBed: number };
  rentableSF: number;
  parkingSpaces: number;
  amenitySF: number;
  floors: number;
  efficiency: number;
  lastUpdated: number;
}

export interface FinancialState {
  totalDevelopmentCost: number;
  landCost: number;
  hardCosts: number;
  softCosts: number;
  noi: number;
  irr: number;
  equityMultiple: number;
  cashOnCash: number;
  purchasePrice: number;
  totalUnits: number;
  goingInCapRate: number;
  exitCapRate: number;
  stabilizedOccupancy: number;
  dscr: number;
  debtService: number;
  yieldOnCost: number;
  lastUpdated: number;
}

export interface MarketState {
  occupancy: number;
  avgRent: number;
  rentGrowth: number;
  supplyPipeline: number;
  demandScore: number;
  lastUpdated: number;
}

export interface ZoningProfileState {
  baseDistrictCode: string | null;
  municipality: string | null;
  appliedFar: number | null;
  lotAreaSf: number | null;
  buildableAreaSf: number | null;
  constraintSource: string;
  lastUpdated: number;
}

export interface ActiveScenarioState {
  id: string;
  name: string;
  maxGba: number | null;
  maxUnits: number | null;
  netLeasableSf: number | null;
  parkingRequired: number | null;
  maxStories: number | null;
  bindingConstraint: string | null;
  appliedFar: number | null;
  avgUnitSize: number;
  efficiencyFactor: number;
  lastUpdated: number;
}

// M11+ Capital Structure state — pushed to M09, M12, M14, M01
export interface CapitalStructureState {
  annualDebtService: number;
  interestOnlyPeriod: number;
  amortizationSchedule: number[];
  totalEquity: number;
  lpEquity: number;
  gpEquity: number;
  weightedCostOfCapital: number;
  loanMaturityYear: number;
  dscr: number;
  ltv: number;
  ltc: number;
  debtYield: number;
  loanBalance: number[];
  prepaymentPenalty: number;
  capitalRiskScore: number;
  structureSummary: string;
  lastUpdated: number;
}

// M08 Strategy state — pushed to M11+, M09
export type StrategyType = 'build_to_sell' | 'flip' | 'rental_value_add' | 'rental_stabilized' | 'str';

export interface StrategyState {
  selectedStrategy: StrategyType;
  strategyScores: { strategy: StrategyType; score: number }[];
  arbitrageFlag: boolean;
  arbitrageDelta: number;
  lastUpdated: number;
}

export interface DebtTermsState {
  loanAmount: number;
  loanType: string;
  interestRate: number;
  spread: number;
  term: number;
  amortization: number;
  ioPeriod: number;
  originationFee: number;
  rateCapCost: number;
  rateType: string;
  indexRate: string;
  waterfall: any;
  source: string;
  lastUpdated: number;
}

export interface MarketIntelligenceState {
  recommendedMix: { studio: number; oneBR: number; twoBR: number; threeBR: number };
  demandPool: number;
  captureRate: number;
  targetDemographic: string;
  medianIncome: number;
  medianRent: number;
  population: number;
  linkedZoningCode?: string;
  linkedMaxUnits?: number;
  linkedMaxGba?: number;
  linkedFar?: number;
  linkedMaxStories?: number;
  linkedBindingConstraint?: string;
  lastUpdated: number;
}

export type ModuleStatusValue = 'live' | 'none';

export interface ModuleStatus {
  strategy: ModuleStatusValue;
  traffic: ModuleStatusValue;
  proforma: ModuleStatusValue;
  debt: ModuleStatusValue;
  exit: ModuleStatusValue;
  marketIntelligence: ModuleStatusValue;
  zoning: ModuleStatusValue;
  design3d: ModuleStatusValue;
}

export type DealModuleEventType =
  | 'design-updated'
  | 'financial-updated'
  | 'market-updated'
  | 'capacity-updated'
  | 'navigate-to'
  | 'data-request'
  | 'capital-updated'
  | 'capital-stack-updated'
  | 'capital-returns-updated'
  | 'capital-rate-analyzed'
  | 'capital-scenarios-compared'
  | 'strategy-selected'
  | 'risk-updated'
  | 'debt-terms-selected'
  | 'market-intelligence-updated';

export interface DealModuleEvent {
  source: string;
  type: DealModuleEventType;
  payload?: any;
  timestamp: number;
}

interface DealModuleContextValue {
  dealId: string | null;
  deal: any;

  // Canonical data - single source of truth for all modules
  canonicalData: CanonicalDealData | null;
  siteData: CanonicalSiteData | null;      // Shortcut to canonicalData.siteData
  dealInputs: CanonicalDealInputs | null;  // Shortcut to canonicalData.dealInputs
  updateSiteData: (updates: Partial<CanonicalSiteData>) => void;
  refreshCanonicalData: () => void;

  // Deal assumptions from API (underwriting inputs)
  assumptions: DealAssumptions | null;
  computedReturns: ComputedReturns | null;
  fullContext: DealFullContext | null;
  updateAssumptions: (updates: Partial<DealAssumptions>) => Promise<any>;
  computeReturnsFromApi: () => Promise<any>;
  assumptionsLoading: boolean;

  design3D: Design3DState | null;
  updateDesign3D: (updates: Partial<Design3DState>) => void;

  financial: FinancialState | null;
  updateFinancial: (updates: Partial<FinancialState>) => void;

  market: MarketState | null;
  updateMarket: (updates: Partial<MarketState>) => void;

  zoningProfile: ZoningProfileState | null;
  updateZoningProfile: (updates: Partial<ZoningProfileState>) => void;

  activeScenario: ActiveScenarioState | null;
  updateActiveScenario: (updates: Partial<ActiveScenarioState>) => void;

  capitalStructure: CapitalStructureState | null;
  updateCapitalStructure: (updates: Partial<CapitalStructureState>) => void;

  strategy: StrategyState | null;
  updateStrategy: (updates: Partial<StrategyState>) => void;

  debtTerms: DebtTermsState | null;
  updateDebtTerms: (updates: Partial<DebtTermsState>) => void;

  marketIntelligence: MarketIntelligenceState | null;
  updateMarketIntelligence: (updates: Partial<MarketIntelligenceState>) => void;

  emitEvent: (event: Omit<DealModuleEvent, 'timestamp'>) => void;
  lastEvent: DealModuleEvent | null;

  moduleStatus: ModuleStatus;

  navigateToTab: (tabId: string) => void;
  activeTab: string;
}

const DealModuleContext = createContext<DealModuleContextValue | null>(null);

interface DealModuleProviderProps {
  children: React.ReactNode;
  dealId: string | null;
  deal: any;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const DealModuleProvider: React.FC<DealModuleProviderProps> = ({
  children,
  dealId,
  deal,
  activeTab,
  onTabChange,
}) => {
  const [design3D, setDesign3D] = useState<Design3DState | null>(null);
  const [financial, setFinancial] = useState<FinancialState | null>(null);
  const [market, setMarket] = useState<MarketState | null>(null);
  const [zoningProfile, setZoningProfile] = useState<ZoningProfileState | null>(null);
  const [activeScenario, setActiveScenario] = useState<ActiveScenarioState | null>(null);
  const [capitalStructure, setCapitalStructure] = useState<CapitalStructureState | null>(null);
  const [strategy, setStrategy] = useState<StrategyState | null>(null);
  const [debtTerms, setDebtTerms] = useState<DebtTermsState | null>(null);
  const [marketIntelligence, setMarketIntelligence] = useState<MarketIntelligenceState | null>(null);
  const [lastEvent, setLastEvent] = useState<DealModuleEvent | null>(null);

  // Canonical data state
  const [siteData, setSiteData] = useState<CanonicalSiteData | null>(null);
  const [dealInputs, setDealInputs] = useState<CanonicalDealInputs | null>(null);

  // Initialize canonical data from deal and zoning when they change
  useEffect(() => {
    if (deal) {
      // Parse deal creation inputs
      const inputs = parseDealInputs(deal);
      setDealInputs(inputs);
      
      // Parse site data from deal properties and any available zoning
      const propertyFallback = deal.properties?.[0] || { ...deal, ...(deal.property_data || {}) };
      const site = parseZoningToSiteData(
        deal.zoningProfile || deal.zoning,
        propertyFallback
      );
      setSiteData(site);
    }
  }, [deal]);

  // Update site data when zoning profile changes (from zoning module)
  useEffect(() => {
    if (zoningProfile) {
      setSiteData(prev => ({
        ...(prev || createEmptySiteData()),
        ...parseZoningToSiteData(zoningProfile),
        lastUpdated: Date.now(),
      }));
    }
  }, [zoningProfile]);

  // Compute merged canonical data
  const canonicalData = useMemo<CanonicalDealData | null>(() => {
    if (!siteData || !dealInputs) return null;
    return computeCanonicalData(siteData, dealInputs);
  }, [siteData, dealInputs]);

  const updateSiteDataLocal = useCallback((updates: Partial<CanonicalSiteData>) => {
    setSiteData(prev => ({
      ...(prev || createEmptySiteData()),
      ...updates,
      lastUpdated: Date.now(),
    }));
  }, []);

  // Deal assumptions from API
  const {
    assumptions,
    computedReturns,
    fullContext,
    loading: assumptionsLoading,
    updateAssumptions,
    computeReturns: computeReturnsFromApi,
  } = useDealAssumptions(dealId);

  // Sync assumptions to financial state when computed
  useEffect(() => {
    if (computedReturns) {
      setFinancial(prev => ({
        ...(prev || {
          totalDevelopmentCost: 0, landCost: 0, hardCosts: 0, softCosts: 0,
          noi: 0, irr: 0, equityMultiple: 0, cashOnCash: 0,
          purchasePrice: 0, totalUnits: 0, goingInCapRate: 0, exitCapRate: 0,
          stabilizedOccupancy: 0, dscr: 0, debtService: 0, yieldOnCost: 0,
          lastUpdated: 0,
        }),
        totalDevelopmentCost: computedReturns.tdc,
        noi: computedReturns.noiStabilized,
        irr: computedReturns.irrLevered * 100,
        equityMultiple: computedReturns.equityMultiple,
        cashOnCash: computedReturns.cashOnCashYr1 * 100,
        yieldOnCost: computedReturns.yieldOnCost * 100,
        dscr: computedReturns.dscr,
        debtService: computedReturns.annualDebtService,
        lastUpdated: Date.now(),
      }));
    }
  }, [computedReturns]);

  const refreshCanonicalData = useCallback(() => {
    if (deal) {
      setDealInputs(parseDealInputs(deal));
      const propertyFallback = deal.properties?.[0] || { ...deal, ...(deal.property_data || {}) };
      setSiteData(parseZoningToSiteData(
        deal.zoningProfile || deal.zoning,
        propertyFallback
      ));
    }
  }, [deal]);

  const updateDesign3D = useCallback((updates: Partial<Design3DState>) => {
    setDesign3D(prev => ({
      ...(prev || {
        totalUnits: 0, unitMix: { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0 },
        rentableSF: 0, parkingSpaces: 0, amenitySF: 0, floors: 0, efficiency: 0, lastUpdated: 0,
      }),
      ...updates,
      lastUpdated: Date.now(),
    }));
  }, []);

  const updateFinancial = useCallback((updates: Partial<FinancialState>) => {
    setFinancial(prev => ({
      ...(prev || {
        totalDevelopmentCost: 0, landCost: 0, hardCosts: 0, softCosts: 0,
        noi: 0, irr: 0, equityMultiple: 0, cashOnCash: 0,
        purchasePrice: 0, totalUnits: 0, goingInCapRate: 0, exitCapRate: 0,
        stabilizedOccupancy: 0, dscr: 0, debtService: 0, yieldOnCost: 0,
        lastUpdated: 0,
      }),
      ...updates,
      lastUpdated: Date.now(),
    }));
  }, []);

  const updateMarket = useCallback((updates: Partial<MarketState>) => {
    setMarket(prev => ({
      ...(prev || {
        occupancy: 0, avgRent: 0, rentGrowth: 0, supplyPipeline: 0, demandScore: 0, lastUpdated: 0,
      }),
      ...updates,
      lastUpdated: Date.now(),
    }));
  }, []);

  const updateZoningProfile = useCallback((updates: Partial<ZoningProfileState>) => {
    setZoningProfile(prev => ({
      ...(prev || {
        baseDistrictCode: null, municipality: null, appliedFar: null,
        lotAreaSf: null, buildableAreaSf: null, constraintSource: 'auto', lastUpdated: 0,
      }),
      ...updates,
      lastUpdated: Date.now(),
    }));
  }, []);

  const updateActiveScenario = useCallback((updates: Partial<ActiveScenarioState>) => {
    setActiveScenario(prev => {
      const updated = {
        ...(prev || {
          id: '', name: '', maxGba: null, maxUnits: null, netLeasableSf: null,
          parkingRequired: null, maxStories: null, bindingConstraint: null,
          appliedFar: null, avgUnitSize: 900, efficiencyFactor: 0.85, lastUpdated: 0,
        }),
        ...updates,
        lastUpdated: Date.now(),
      };
      return updated;
    });
  }, []);

  const updateCapitalStructure = useCallback((updates: Partial<CapitalStructureState>) => {
    setCapitalStructure(prev => ({
      ...(prev || {
        annualDebtService: 0, interestOnlyPeriod: 0, amortizationSchedule: [],
        totalEquity: 0, lpEquity: 0, gpEquity: 0, weightedCostOfCapital: 0,
        loanMaturityYear: 0, dscr: 0, ltv: 0, ltc: 0, debtYield: 0,
        loanBalance: [], prepaymentPenalty: 0, capitalRiskScore: 0,
        structureSummary: '', lastUpdated: 0,
      }),
      ...updates,
      lastUpdated: Date.now(),
    }));
  }, []);

  const updateStrategy = useCallback((updates: Partial<StrategyState>) => {
    setStrategy(prev => ({
      ...(prev || {
        selectedStrategy: 'rental_value_add' as StrategyType,
        strategyScores: [], arbitrageFlag: false, arbitrageDelta: 0, lastUpdated: 0,
      }),
      ...updates,
      lastUpdated: Date.now(),
    }));
  }, []);

  const updateDebtTerms = useCallback((updates: Partial<DebtTermsState>) => {
    setDebtTerms(prev => ({
      ...(prev || {
        loanAmount: 0, loanType: '', interestRate: 0, spread: 0, term: 0,
        amortization: 0, ioPeriod: 0, originationFee: 0, rateCapCost: 0,
        rateType: 'fixed', indexRate: '', waterfall: null, source: '', lastUpdated: 0,
      }),
      ...updates,
      lastUpdated: Date.now(),
    }));
  }, []);

  const updateMarketIntelligence = useCallback((updates: Partial<MarketIntelligenceState>) => {
    setMarketIntelligence(prev => ({
      ...(prev || {
        recommendedMix: { studio: 0.15, oneBR: 0.45, twoBR: 0.30, threeBR: 0.10 },
        demandPool: 0, captureRate: 0, targetDemographic: '', medianIncome: 0,
        medianRent: 0, population: 0, lastUpdated: 0,
      }),
      ...updates,
      lastUpdated: Date.now(),
    }));
  }, []);

  const emitEvent = useCallback((event: Omit<DealModuleEvent, 'timestamp'>) => {
    const fullEvent: DealModuleEvent = { ...event, timestamp: Date.now() };
    setLastEvent(fullEvent);
    if (event.type === 'navigate-to' && event.payload?.tabId) {
      onTabChange(event.payload.tabId);
    }
  }, [onTabChange]);

  const navigateToTab = useCallback((tabId: string) => {
    onTabChange(tabId);
  }, [onTabChange]);

  const moduleStatus = useMemo<ModuleStatus>(() => ({
    strategy: (strategy?.lastUpdated ?? 0) > 0 ? 'live' : 'none',
    traffic: (market?.lastUpdated ?? 0) > 0 ? 'live' : 'none',
    proforma: (financial?.lastUpdated ?? 0) > 0 ? 'live' : 'none',
    debt: ((capitalStructure?.lastUpdated ?? 0) > 0 || (debtTerms?.lastUpdated ?? 0) > 0) ? 'live' : 'none',
    exit: (capitalStructure?.lastUpdated ?? 0) > 0 ? 'live' : 'none',
    marketIntelligence: (marketIntelligence?.lastUpdated ?? 0) > 0 ? 'live' : 'none',
    zoning: ((zoningProfile?.lastUpdated ?? 0) > 0 || (activeScenario?.lastUpdated ?? 0) > 0) ? 'live' : 'none',
    design3d: (design3D?.lastUpdated ?? 0) > 0 ? 'live' : 'none',
  }), [strategy?.lastUpdated, market?.lastUpdated, financial?.lastUpdated, capitalStructure?.lastUpdated, debtTerms?.lastUpdated, marketIntelligence?.lastUpdated, zoningProfile?.lastUpdated, activeScenario?.lastUpdated, design3D?.lastUpdated]);

  const value = useMemo<DealModuleContextValue>(() => ({
    dealId,
    deal,
    // Canonical data
    canonicalData,
    siteData,
    dealInputs,
    updateSiteData: updateSiteDataLocal,
    refreshCanonicalData,
    // Deal assumptions from API
    assumptions,
    computedReturns,
    fullContext,
    updateAssumptions,
    computeReturnsFromApi,
    assumptionsLoading,
    // Module states
    design3D,
    updateDesign3D,
    financial,
    updateFinancial,
    market,
    updateMarket,
    zoningProfile,
    updateZoningProfile,
    activeScenario,
    updateActiveScenario,
    capitalStructure,
    updateCapitalStructure,
    strategy,
    updateStrategy,
    debtTerms,
    updateDebtTerms,
    marketIntelligence,
    updateMarketIntelligence,
    emitEvent,
    lastEvent,
    moduleStatus,
    navigateToTab,
    activeTab,
  }), [dealId, deal, canonicalData, siteData, dealInputs, updateSiteDataLocal, refreshCanonicalData, assumptions, computedReturns, fullContext, updateAssumptions, computeReturnsFromApi, assumptionsLoading, design3D, updateDesign3D, financial, updateFinancial, market, updateMarket, zoningProfile, updateZoningProfile, activeScenario, updateActiveScenario, capitalStructure, updateCapitalStructure, strategy, updateStrategy, debtTerms, updateDebtTerms, marketIntelligence, updateMarketIntelligence, emitEvent, lastEvent, moduleStatus, navigateToTab, activeTab]);

  return (
    <DealModuleContext.Provider value={value}>
      {children}
    </DealModuleContext.Provider>
  );
};

export const useDealModule = (): DealModuleContextValue => {
  const context = useContext(DealModuleContext);
  if (!context) {
    return {
      dealId: null,
      deal: null,
      // Canonical data
      canonicalData: null,
      siteData: null,
      dealInputs: null,
      updateSiteData: () => {},
      refreshCanonicalData: () => {},
      // Deal assumptions from API
      assumptions: null,
      computedReturns: null,
      fullContext: null,
      updateAssumptions: async () => {},
      computeReturnsFromApi: async () => {},
      assumptionsLoading: false,
      // Module states
      design3D: null,
      updateDesign3D: () => {},
      financial: null,
      updateFinancial: () => {},
      market: null,
      updateMarket: () => {},
      zoningProfile: null,
      updateZoningProfile: () => {},
      activeScenario: null,
      updateActiveScenario: () => {},
      capitalStructure: null,
      updateCapitalStructure: () => {},
      strategy: null,
      updateStrategy: () => {},
      debtTerms: null,
      updateDebtTerms: () => {},
      marketIntelligence: null,
      updateMarketIntelligence: () => {},
      emitEvent: () => {},
      lastEvent: null,
      moduleStatus: { strategy: 'none', traffic: 'none', proforma: 'none', debt: 'none', exit: 'none', marketIntelligence: 'none', zoning: 'none', design3d: 'none' },
      navigateToTab: () => {},
      activeTab: 'overview',
    };
  }
  return context;
};

// Re-export canonical data types for convenience
export type { CanonicalDealData, CanonicalSiteData, CanonicalDealInputs } from './canonicalDealData';

export default DealModuleContext;
