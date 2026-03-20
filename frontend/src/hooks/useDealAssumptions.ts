/**
 * useDealAssumptions Hook
 * 
 * Fetches and manages deal assumptions from the API.
 * Provides single source of truth for all modules.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api.client';

// ============================================
// Types
// ============================================

export interface UnitMixItem {
  type: string;
  count: number;
  sf: number;
  rent: number;
  pct?: number;
}

export interface DealAssumptions {
  // Land & Acquisition
  landCost: number | null;
  landCostPerAcre: number | null;
  
  // Construction Costs
  hardCostPsf: number | null;
  softCostPct: number;
  contingencyPct: number;
  developerFeePct: number;
  
  // Building Design
  totalUnits: number | null;
  avgUnitSf: number;
  grossSf: number | null;
  rentableSf: number | null;
  efficiency: number;
  stories: number | null;
  constructionType: string | null;
  parkingType: string | null;
  
  // Unit Mix
  unitMix: UnitMixItem[];
  
  // Revenue
  avgRentPerUnit: number | null;
  avgRentPsf: number | null;
  vacancyPct: number;
  opexRatio: number;
  
  // Financing
  interestRate: number | null;
  ltc: number;
  exitCap: number;
  holdPeriodYears: number;
  
  // Computed Returns
  tdc: number | null;
  tdcPerUnit: number | null;
  noiStabilized: number | null;
  yieldOnCost: number | null;
  irrLevered: number | null;
  equityMultiple: number | null;
  stabilizedValue: number | null;
  
  // Meta
  exists: boolean;
  lastComputedAt: string | null;
}

export interface SiteData {
  lotSizeAcres: number | null;
  lotSizeSqft: number | null;
  parcelId: string | null;
  zoningCode: string | null;
  maxFar: number | null;
  maxStories: number | null;
  maxUnits: number | null;
  parkingRequired: number | null;
  municipality: string | null;
  zoningSource: string;
  zoningConfidence: number;
}

export interface ComputedReturns {
  tdc: number;
  tdcPerUnit: number;
  tdcPerSf: number;
  grossPotentialRent: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  noiStabilized: number;
  loanAmount: number;
  equityRequired: number;
  annualDebtService: number;
  yieldOnCost: number;
  stabilizedValue: number;
  profit: number;
  profitMargin: number;
  cashOnCashYr1: number;
  irrLevered: number;
  irrUnlevered: number;
  equityMultiple: number;
  dscr: number;
  debtYield: number;
  ltv: number;
}

export interface DealFullContext {
  id: string;
  name: string;
  developmentType: string | null;
  targetUnits: number | null;
  budget: number | null;
  lotSizeAcres: number | null;
  zoningCode: string | null;
  zoningMaxUnits: number | null;
  landCost: number | null;
  tdc: number | null;
  tdcPerUnit: number | null;
  avgRentPerUnit: number | null;
  exitCap: number | null;
  yieldOnCost: number | null;
  irrLevered: number | null;
  equityMultiple: number | null;
  submarketName: string | null;
  compAvgRent: number | null;
  submarketOccupancy: number | null;
}

// ============================================
// Default Values
// ============================================

const DEFAULT_ASSUMPTIONS: Partial<DealAssumptions> = {
  softCostPct: 25,
  contingencyPct: 5,
  developerFeePct: 4,
  avgUnitSf: 900,
  efficiency: 0.85,
  vacancyPct: 5,
  opexRatio: 35,
  ltc: 0.65,
  exitCap: 0.05,
  holdPeriodYears: 3,
  unitMix: [],
  exists: false,
};

// ============================================
// Hook
// ============================================

export function useDealAssumptions(dealId: string | null) {
  const [assumptions, setAssumptions] = useState<DealAssumptions | null>(null);
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [computedReturns, setComputedReturns] = useState<ComputedReturns | null>(null);
  const [fullContext, setFullContext] = useState<DealFullContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch assumptions
  const fetchAssumptions = useCallback(async () => {
    if (!dealId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get(`/api/v1/deals/${dealId}/assumptions`);
      const data = response.data?.data || response.data;
      
      setAssumptions({
        ...DEFAULT_ASSUMPTIONS,
        ...data,
        unitMix: data.unit_mix ? JSON.parse(data.unit_mix) : [],
      } as DealAssumptions);
    } catch (err: any) {
      console.error('Error fetching assumptions:', err);
      setError(err.message);
      // Use defaults on error
      setAssumptions(DEFAULT_ASSUMPTIONS as DealAssumptions);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  // Fetch full context (combined view)
  const fetchFullContext = useCallback(async () => {
    if (!dealId) return;
    
    try {
      const response = await apiClient.get(`/api/v1/deals/${dealId}/full-context`);
      setFullContext(response.data?.data || response.data);
    } catch (err: any) {
      console.error('Error fetching full context:', err);
    }
  }, [dealId]);

  // Update assumptions
  const updateAssumptions = useCallback(async (updates: Partial<DealAssumptions>) => {
    if (!dealId) return;
    
    try {
      setLoading(true);
      
      // Convert camelCase to snake_case for API
      const payload: Record<string, any> = {};
      if (updates.landCost !== undefined) payload.landCost = updates.landCost;
      if (updates.hardCostPsf !== undefined) payload.hardCostPsf = updates.hardCostPsf;
      if (updates.softCostPct !== undefined) payload.softCostPct = updates.softCostPct;
      if (updates.contingencyPct !== undefined) payload.contingencyPct = updates.contingencyPct;
      if (updates.developerFeePct !== undefined) payload.developerFeePct = updates.developerFeePct;
      if (updates.totalUnits !== undefined) payload.totalUnits = updates.totalUnits;
      if (updates.avgUnitSf !== undefined) payload.avgUnitSf = updates.avgUnitSf;
      if (updates.efficiency !== undefined) payload.efficiency = updates.efficiency;
      if (updates.stories !== undefined) payload.stories = updates.stories;
      if (updates.constructionType !== undefined) payload.constructionType = updates.constructionType;
      if (updates.parkingType !== undefined) payload.parkingType = updates.parkingType;
      if (updates.unitMix !== undefined) payload.unitMix = updates.unitMix;
      if (updates.avgRentPerUnit !== undefined) payload.avgRentPerUnit = updates.avgRentPerUnit;
      if (updates.vacancyPct !== undefined) payload.vacancyPct = updates.vacancyPct;
      if (updates.opexRatio !== undefined) payload.opexRatio = updates.opexRatio;
      if (updates.interestRate !== undefined) payload.interestRate = updates.interestRate;
      if (updates.ltc !== undefined) payload.ltc = updates.ltc;
      if (updates.exitCap !== undefined) payload.exitCap = updates.exitCap;
      if (updates.holdPeriodYears !== undefined) payload.holdPeriodYears = updates.holdPeriodYears;
      
      const response = await apiClient.put(`/api/v1/deals/${dealId}/assumptions`, payload);
      
      // Update local state
      setAssumptions(prev => ({
        ...prev,
        ...updates,
        exists: true,
      } as DealAssumptions));
      
      return response.data;
    } catch (err: any) {
      console.error('Error updating assumptions:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  // Update site data
  const updateSiteData = useCallback(async (updates: Partial<SiteData>) => {
    if (!dealId) return;
    
    try {
      const response = await apiClient.put(`/api/v1/deals/${dealId}/site-data`, updates);
      setSiteData(prev => ({ ...prev, ...updates } as SiteData));
      return response.data;
    } catch (err: any) {
      console.error('Error updating site data:', err);
      throw err;
    }
  }, [dealId]);

  // Compute returns
  const computeReturns = useCallback(async (overrides?: Partial<DealAssumptions>) => {
    if (!dealId) return null;
    
    try {
      setLoading(true);
      
      const response = await apiClient.post(`/api/v1/deals/${dealId}/compute-returns`, overrides || {});
      const data = response.data?.data || response.data;
      
      setComputedReturns(data.returns);
      
      // Also update assumptions with computed values
      if (data.returns) {
        setAssumptions(prev => ({
          ...prev,
          tdc: data.returns.tdc,
          tdcPerUnit: data.returns.tdcPerUnit,
          noiStabilized: data.returns.noiStabilized,
          yieldOnCost: data.returns.yieldOnCost,
          irrLevered: data.returns.irrLevered,
          equityMultiple: data.returns.equityMultiple,
          stabilizedValue: data.returns.stabilizedValue,
        } as DealAssumptions));
      }
      
      return data;
    } catch (err: any) {
      console.error('Error computing returns:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  // Initial fetch
  useEffect(() => {
    if (dealId) {
      fetchAssumptions();
      fetchFullContext();
    }
  }, [dealId, fetchAssumptions, fetchFullContext]);

  return {
    // Data
    assumptions,
    siteData,
    computedReturns,
    fullContext,
    
    // State
    loading,
    error,
    
    // Actions
    updateAssumptions,
    updateSiteData,
    computeReturns,
    refresh: fetchAssumptions,
    refreshFullContext: fetchFullContext,
  };
}

export default useDealAssumptions;
