import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

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

export interface DealModuleEvent {
  source: string;
  type: 'design-updated' | 'financial-updated' | 'market-updated' | 'navigate-to' | 'data-request';
  payload?: any;
  timestamp: number;
}

interface DealModuleContextValue {
  dealId: string | null;
  deal: any;

  design3D: Design3DState | null;
  updateDesign3D: (updates: Partial<Design3DState>) => void;

  financial: FinancialState | null;
  updateFinancial: (updates: Partial<FinancialState>) => void;

  market: MarketState | null;
  updateMarket: (updates: Partial<MarketState>) => void;

  emitEvent: (event: Omit<DealModuleEvent, 'timestamp'>) => void;
  lastEvent: DealModuleEvent | null;

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
  const [lastEvent, setLastEvent] = useState<DealModuleEvent | null>(null);

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
        noi: 0, irr: 0, equityMultiple: 0, cashOnCash: 0, lastUpdated: 0,
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

  const value = useMemo<DealModuleContextValue>(() => ({
    dealId,
    deal,
    design3D,
    updateDesign3D,
    financial,
    updateFinancial,
    market,
    updateMarket,
    emitEvent,
    lastEvent,
    navigateToTab,
    activeTab,
  }), [dealId, deal, design3D, updateDesign3D, financial, updateFinancial, market, updateMarket, emitEvent, lastEvent, navigateToTab, activeTab]);

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
      design3D: null,
      updateDesign3D: () => {},
      financial: null,
      updateFinancial: () => {},
      market: null,
      updateMarket: () => {},
      emitEvent: () => {},
      lastEvent: null,
      navigateToTab: () => {},
      activeTab: 'overview',
    };
  }
  return context;
};

export default DealModuleContext;
