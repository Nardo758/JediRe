import { create } from 'zustand';
import { api } from '../services/api.client';

export interface OpportunitySignal {
  type: 'supply' | 'demand' | 'pricing' | 'vintage' | 'occupancy';
  label: string;
  value: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  weight: number;
}

export interface OpportunityScore {
  submarketName: string;
  city: string;
  marketScore: number;
  propertyScore: number;
  opportunityScore: number;
  estimatedUpsidePercent: number;
  estimatedUpsideDollar: number;
  strategy: 'renovate' | 'rebrand' | 'reposition' | 'acquire';
  strategyRationale: string;
  signals: OpportunitySignal[];
  rank: number;
  quartile: number;
}

export interface MarketSummary {
  city: string;
  avgMarketScore: number;
  totalSubmarkets: number;
  topOpportunitySubmarket: string;
  avgUpsidePercent: number;
}

export interface OpportunityResult {
  opportunities: OpportunityScore[];
  marketSummary: MarketSummary;
  calculatedAt: string;
}

interface OpportunityCacheEntry {
  data: OpportunityResult;
  fetchedAt: number;
}

interface OpportunityState {
  cache: Record<string, OpportunityCacheEntry>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  fetched: Record<string, boolean>;

  fetchOpportunities: (city: string) => Promise<void>;
  getOpportunities: (city: string) => OpportunityResult | null;
  isLoading: (city: string) => boolean;
  getError: (city: string) => string | null;
  hasFetched: (city: string) => boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

export const useOpportunityStore = create<OpportunityState>((set, get) => ({
  cache: {},
  loading: {},
  errors: {},
  fetched: {},

  fetchOpportunities: async (city: string) => {
    const key = city.toLowerCase();
    const existing = get().cache[key];
    if (existing && Date.now() - existing.fetchedAt < CACHE_TTL_MS) {
      return;
    }

    if (get().loading[key]) return;

    set(state => ({
      loading: { ...state.loading, [key]: true },
      errors: { ...state.errors, [key]: null },
    }));

    try {
      const response = await api.opportunityEngine.detectOpportunities(city);
      const result: OpportunityResult = response.data?.data || response.data;

      set(state => ({
        cache: {
          ...state.cache,
          [key]: { data: result, fetchedAt: Date.now() },
        },
        loading: { ...state.loading, [key]: false },
        fetched: { ...state.fetched, [key]: true },
      }));
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Failed to fetch opportunities';
      set(state => ({
        loading: { ...state.loading, [key]: false },
        errors: { ...state.errors, [key]: message },
        fetched: { ...state.fetched, [key]: true },
      }));
    }
  },

  getOpportunities: (city: string) => {
    const key = city.toLowerCase();
    return get().cache[key]?.data || null;
  },

  isLoading: (city: string) => {
    return get().loading[city.toLowerCase()] || false;
  },

  getError: (city: string) => {
    return get().errors[city.toLowerCase()] || null;
  },

  hasFetched: (city: string) => {
    return get().fetched[city.toLowerCase()] || false;
  },
}));
