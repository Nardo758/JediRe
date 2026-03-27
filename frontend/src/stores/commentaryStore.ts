import { create } from 'zustand';
import { apiClient } from '../services/api.client';

export interface CommentarySection {
  title: string;
  content: string;
  sentiment: 'bullish' | 'neutral' | 'bearish';
}

export interface StrategyScoreResult {
  strategy: string;
  label: string;
  score: number;
  rank: number;
  signalContributions: Record<string, number>;
}

export interface ThesisPoint {
  icon: string;
  color: 'green' | 'amber' | 'red';
  text: string;
}

export interface RiskItem {
  label: string;
  severity: 'high' | 'medium' | 'low';
  detail: string;
}

export interface OpportunityItem {
  label: string;
  impact: 'high' | 'medium' | 'low';
  detail: string;
}

export interface PeerItem {
  name: string;
  score: number;
}

export interface CommentaryData {
  requestId: string;
  entityType: string;
  entityId: string;
  entityName: string;
  timestamp: string;
  marketNarrative: CommentarySection;
  investmentThesis: {
    recommendation: string;
    points: ThesisPoint[];
  };
  signalCommentary: Record<string, CommentarySection>;
  riskOpportunity: {
    risks: RiskItem[];
    opportunities: OpportunityItem[];
  };
  peerContext: {
    summary: string;
    peerRank: number;
    peerTotal: number;
    topPeers: PeerItem[];
  };
  supplyNarrative: CommentarySection;
  strategyScores: StrategyScoreResult[];
  arbitrageFlag: boolean;
  arbitrageDelta: number;
  recommendedStrategy: string;
  jediScore: number;
  cacheTTLHours: number;
}

interface CacheEntry {
  data: CommentaryData;
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CommentaryStoreState {
  cache: Record<string, CacheEntry>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;

  fetchCommentary: (entityType: string, entityId: string, entityName?: string, forceRefresh?: boolean) => Promise<CommentaryData | null>;
  getCommentary: (entityType: string, entityId: string) => CommentaryData | null;
  isLoading: (entityType: string, entityId: string) => boolean;
  getError: (entityType: string, entityId: string) => string | null;
  clearCache: () => void;
}

function cacheKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export const useCommentaryStore = create<CommentaryStoreState>((set, get) => ({
  cache: {},
  loading: {},
  errors: {},

  fetchCommentary: async (entityType, entityId, entityName, forceRefresh = false) => {
    const key = cacheKey(entityType, entityId);
    const state = get();

    if (!forceRefresh) {
      const cached = state.cache[key];
      if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    if (state.loading[key]) return state.cache[key]?.data || null;

    set(s => ({ loading: { ...s.loading, [key]: true }, errors: { ...s.errors, [key]: null } }));

    try {
      const params = new URLSearchParams();
      if (forceRefresh) params.set('forceRefresh', 'true');
      if (entityName) params.set('entityName', entityName);
      const qs = params.toString();

      const res = await apiClient.get(
        `/api/v1/commentary/${entityType}/${entityId}${qs ? `?${qs}` : ''}`
      );

      const data: CommentaryData = res.data?.commentary;
      if (data) {
        set(s => ({
          cache: { ...s.cache, [key]: { data, fetchedAt: Date.now() } },
          loading: { ...s.loading, [key]: false },
        }));
        return data;
      }

      set(s => ({
        loading: { ...s.loading, [key]: false },
        errors: { ...s.errors, [key]: 'No commentary data returned' },
      }));
      return null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch commentary';
      set(s => ({
        loading: { ...s.loading, [key]: false },
        errors: { ...s.errors, [key]: msg },
      }));
      return null;
    }
  },

  getCommentary: (entityType, entityId) => {
    const key = cacheKey(entityType, entityId);
    const entry = get().cache[key];
    if (entry && (Date.now() - entry.fetchedAt) < CACHE_TTL_MS) {
      return entry.data;
    }
    return null;
  },

  isLoading: (entityType, entityId) => {
    return get().loading[cacheKey(entityType, entityId)] || false;
  },

  getError: (entityType, entityId) => {
    return get().errors[cacheKey(entityType, entityId)] || null;
  },

  clearCache: () => {
    set({ cache: {}, loading: {}, errors: {} });
  },
}));
