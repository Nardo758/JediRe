import { useState, useCallback } from 'react';
import { apiClient } from '../services/api.client';

export interface DealAssumptions {
  avgRentPerUnit: number;
  avgUnitSf: number;
  vacancy: number;
  expenseRatio: number;
  capRate: number;
  exitCapRate: number;
  holdPeriod: number;
  rentGrowth: number;
  expenseGrowth: number;
  managementFee: number;
  capexPerUnit: number;
  loanToValue: number;
  interestRate: number;
  amortization: number;
  acquisitionCosts: number;
  dispositionCosts: number;
  totalUnits?: number;
  totalGFA?: number;
}

export interface ComputedReturns {
  tdc: number;
  noiStabilized: number;
  irrLevered: number;
  irrUnlevered: number;
  equityMultiple: number;
  cashOnCashYr1: number;
  yieldOnCost: number;
  dscr: number;
  annualDebtService: number;
  stabilizedValue: number;
  exitValue: number;
  totalEquityProfit: number;
}

export interface DealFullContext {
  assumptions: DealAssumptions;
  returns: ComputedReturns;
  dealId: string;
  computedAt: string;
}

const DEFAULT_ASSUMPTIONS: DealAssumptions = {
  avgRentPerUnit: 0,
  avgUnitSf: 0,
  vacancy: 0.05,
  expenseRatio: 0.40,
  capRate: 0.055,
  exitCapRate: 0.055,
  holdPeriod: 5,
  rentGrowth: 0.03,
  expenseGrowth: 0.025,
  managementFee: 0.04,
  capexPerUnit: 0,
  loanToValue: 0.65,
  interestRate: 0.065,
  amortization: 30,
  acquisitionCosts: 0.02,
  dispositionCosts: 0.015,
};

export function useDealAssumptions(dealId: string | null) {
  const [assumptions, setAssumptions] = useState<DealAssumptions | null>(null);
  const [computedReturns, setComputedReturns] = useState<ComputedReturns | null>(null);
  const [fullContext, setFullContext] = useState<DealFullContext | null>(null);
  const [loading, setLoading] = useState(false);

  const updateAssumptions = useCallback(async (updates: Partial<DealAssumptions>) => {
    if (!dealId) return null;
    try {
      setLoading(true);
      const response = await apiClient.patch(`/api/v1/deals/${dealId}/assumptions`, updates);
      const data = (response as any)?.data;
      if (data?.assumptions) setAssumptions(data.assumptions);
      return data;
    } catch (err) {
      console.error('[useDealAssumptions] updateAssumptions error:', err);
      setAssumptions(prev => prev ? { ...prev, ...updates } : { ...DEFAULT_ASSUMPTIONS, ...updates });
      return null;
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  const computeReturns = useCallback(async () => {
    if (!dealId) return null;
    try {
      setLoading(true);
      const response = await apiClient.post(`/api/v1/deals/${dealId}/compute-returns`, {});
      const data = (response as any)?.data;
      if (data?.returns) setComputedReturns(data.returns);
      if (data?.fullContext) setFullContext(data.fullContext);
      return data;
    } catch (err) {
      console.error('[useDealAssumptions] computeReturns error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  return {
    assumptions,
    computedReturns,
    fullContext,
    loading,
    updateAssumptions,
    computeReturns,
  };
}

export default useDealAssumptions;
