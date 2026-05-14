import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api.client';

export interface LenderRecord {
  id: string;
  name: string;
  type: string;
  typicalSpreadBps?: number;
  dealsYTDEst?: number;
  notes?: string;
  recoursePreference: string;
}

export interface LenderTarget {
  lender: LenderRecord;
  fitScore: number;
  fitReasons: string[];
  contactNote: string;
}

export interface DebtPhase {
  phaseIndex: number;
  phaseLabel: string;
  product: string;
  productLabel: string;
  startMonth: number;
  endMonth: number;
  loanAmountEst: number;
  termYears: number;
  ioMonths: number;
  amortYears: number;
  rateType: 'Fixed' | 'Floating';
  rateEst: number;
  spreadBps?: number;
  ltv: number;
  origFee: number;
  exitFee: number;
  prepayType: string;
  rationale: string;
  lenders: LenderTarget[];
  triggers: MonitoringTrigger[];
  isRefiEvent: boolean;
  refiTriggerOcc?: number;
  refiTriggerDscr?: number;
  dscrAtClose?: number;
  debtYieldAtClose?: number;
}

export interface MonitoringTrigger {
  id: string;
  condition: string;
  currentValue: string;
  threshold: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly';
  action: string;
  severity: 'info' | 'warning' | 'critical';
  phase: number;
}

export interface DebtAlternative {
  label: string;
  product: string;
  productLabel: string;
  rationale: string;
  tradeoff: string;
  deltaAllInBps: number;
  irrImpactBps: number;
}

export interface RateEnvironmentResult {
  classification: 'Dropping' | 'Flat' | 'Rising';
  sofr: number;
  sofrAvg30: number;
  sofrAvg90: number;
  treasury10y: number;
  fedFundsTarget: number;
  sofrForward12moBps: number;
  ratePreference: 'Fixed' | 'Floating' | 'Either';
  termPreference: string;
  ratCapAdvice: string;
  narrative: string;
  pricingWindowScore: number;
  pricingWindowLabel: string;
  computedAt: string;
  /**
   * CE-06: which path produced the SOFR forward curve.
   *   'live'                — built from real NY Fed SOFRAI 30/90/180-day averages
   *   'fallback_heuristic'  — sofrAvg30 / sofrAvg180 missing; used a level-shift
   *                            heuristic. Surfaced so the UI can warn that the
   *                            classification is riding the heuristic.
   */
  curveMode: 'live' | 'fallback_heuristic';
  macroContext?: {
    gdpGrowthPct: number | null;
    cpiYoyPct: number | null;
    unrate: number | null;
    consumerSentiment: number | null;
    m2Yoy: number | null;
    dxy: number | null;
    snapshotDate: string | null;
    narrativeBlock: string;
  };
}

export interface DebtAdvisorResponse {
  dealId: string;
  computedAt: string;
  hasStrategy: boolean;
  strategyInputs: {
    subStrategyKey: string;
    strategySlug: string;
    strategyName: string;
    holdMonths: number;
    hasStrategy: boolean;
    propertyType: string;
    purchasePrice: number;
    city: string;
    state: string;
    units: number;
    riskScore: number;
    m08Source: 'strategy_analyses' | 'none';
  };
  rateEnvironment: RateEnvironmentResult;
  recommendedStack: DebtPhase[];
  alternatives: DebtAlternative[];
  monitoringTriggers: MonitoringTrigger[];
  contextModifications: {
    narrativeNotes: string[];
    geographyWarning: string | null;
    sizeWarning: string | null;
    recourseRequired: boolean;
    addPcaReserveNote: boolean;
    ltvHaircutPct: number;
  };
  correlationContext: {
    slug: string;
    riskScore: number;
    correlationImplication: string;
    rssAdjustmentBps: number;
  } | null;
  summary: {
    primaryProduct: string;
    primaryProductLabel: string;
    totalClosingCosts: number;
    initialLoanAmount: number;
    blendedAllInRate: number;
    headline: string;
    whyStatement: string;
    estimatedIrrImpactBps: number;
    covenantCushionBps: number;
  };
  divergence?: {
    hasDivergence: boolean;
    configuredLoanAmount?: number;
    configuredRate?: number;
    advisorLoanAmount?: number;
    advisorRate?: number;
    irrImpactBps?: number;
    covenantCushionDeltaBps?: number;
  };
  /**
   * CE-09: the recommendation was auto-applied to the Pro Forma's
   * `per_year_overrides` (resolution: 'platform') the moment it was
   * computed — no explicit Accept needed. `skipped` lists fields where
   * the user already has an override that won over the platform default.
   */
  platformDefaultsApplied?: {
    applied: number;
    skipped: string[];
    phaseIndex: number;
    fieldsApplied: string[];
  };
}

interface UseDebtAdvisorState {
  data: DebtAdvisorResponse | null;
  loading: boolean;
  error: string | null;
}

export function useDebtAdvisor(dealId: string) {
  const [state, setState] = useState<UseDebtAdvisorState>({ data: null, loading: true, error: null });

  const fetch = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await apiClient.get<{ success: boolean; data: DebtAdvisorResponse }>(`/api/v1/deals/${dealId}/debt/advisor`);
      setState({ data: res.data.data, loading: false, error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load debt advisor';
      setState(s => ({ ...s, loading: false, error: msg }));
    }
  }, [dealId]);

  useEffect(() => { fetch(); }, [fetch]);

  const recompute = useCallback(async (productHint?: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await apiClient.post<{ success: boolean; data: DebtAdvisorResponse }>(`/api/v1/deals/${dealId}/debt/advisor/recompute`, productHint ? { productHint } : {});
      setState({ data: res.data.data, loading: false, error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Recompute failed';
      setState(s => ({ ...s, loading: false, error: msg }));
    }
  }, [dealId]);

  const accept = useCallback(async (phaseIndex = 0) => {
    try {
      await apiClient.post(`/api/v1/deals/${dealId}/debt/advisor/accept`, { phaseIndex });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Accept failed';
      throw new Error(msg);
    }
  }, [dealId]);

  return { ...state, recompute, accept, refresh: fetch };
}
