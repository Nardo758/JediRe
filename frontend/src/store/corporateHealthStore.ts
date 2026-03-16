import { create } from 'zustand';
import { apiClient } from '../services/api.client';

export interface CorporateEmployerSummary {
  company: string;
  ticker: string | null;
  isPublic: boolean;
  employees: number | null;
  share: number;
  chs: number | null;
  tier: 'healthy' | 'watch' | 'stress' | null;
  delta: number | null;
}

export interface SCHITrend {
  quarter: string;
  schi: number;
  divergence: number;
  signal: string;
}

interface CorporateHealthState {
  submarketSCHI: number | null;
  divergenceScore: number | null;
  divergenceSignal: 'bullish_divergence' | 'bearish_divergence' | 'aligned' | null;
  reHealthScore: number | null;
  topEmployers: CorporateEmployerSummary[];
  corporateRiskExposure: number | null;
  sectorBreakdown: Record<string, number>;
  herfindahl: number | null;
  trend: SCHITrend[];
  quarter: string | null;
  loading: boolean;
  error: string | null;

  fetchCorporateHealth: (dealId: string) => Promise<void>;
  fetchSubmarketHealth: (submarketId: number) => Promise<void>;
  reset: () => void;
}

export const useCorporateHealthStore = create<CorporateHealthState>((set) => ({
  submarketSCHI: null,
  divergenceScore: null,
  divergenceSignal: null,
  reHealthScore: null,
  topEmployers: [],
  corporateRiskExposure: null,
  sectorBreakdown: {},
  herfindahl: null,
  trend: [],
  quarter: null,
  loading: false,
  error: null,

  fetchCorporateHealth: async (dealId: string) => {
    set({ loading: true, error: null });
    try {
      const resp = await apiClient.get(`/api/v1/corporate-health/deal/${dealId}`);
      const d = resp.data?.data;
      if (d) {
        set({
          submarketSCHI: d.weightedSCHI,
          divergenceScore: d.divergence,
          divergenceSignal: d.submarkets?.[0]?.signal || null,
          topEmployers: d.topEmployers || [],
          trend: d.trend || [],
          quarter: d.submarkets?.[0]?.quarter || null,
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false });
    }
  },

  fetchSubmarketHealth: async (submarketId: number) => {
    set({ loading: true, error: null });
    try {
      const resp = await apiClient.get(`/api/v1/corporate-health/submarket/${submarketId}`);
      const d = resp.data?.data;
      if (d) {
        set({
          submarketSCHI: d.schi,
          divergenceScore: d.divergence,
          divergenceSignal: d.signal,
          reHealthScore: d.reHealth,
          topEmployers: d.employers || [],
          herfindahl: d.herfindahl,
          sectorBreakdown: d.sectorBreakdown || {},
          trend: d.trend || [],
          quarter: d.quarter,
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false });
    }
  },

  reset: () => set({
    submarketSCHI: null,
    divergenceScore: null,
    divergenceSignal: null,
    reHealthScore: null,
    topEmployers: [],
    corporateRiskExposure: null,
    sectorBreakdown: {},
    herfindahl: null,
    trend: [],
    quarter: null,
    loading: false,
    error: null,
  }),
}));

export const useCorporateHealth = () =>
  useCorporateHealthStore((s) => ({
    schi: s.submarketSCHI,
    divergence: s.divergenceScore,
    signal: s.divergenceSignal,
    reHealth: s.reHealthScore,
    employers: s.topEmployers,
    riskExposure: s.corporateRiskExposure,
    herfindahl: s.herfindahl,
    trend: s.trend,
    loading: s.loading,
    error: s.error,
  }));
