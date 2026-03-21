import { create } from 'zustand';
import { apiClient } from '../services/api.client';

export interface SignalWeights {
  demand: number;
  supply: number;
  momentum: number;
  position: number;
  risk: number;
}

export interface PropertyGate {
  id: string;
  field: string;
  operator: 'gte' | 'lte' | 'eq' | 'in' | 'not_in' | 'between';
  value: string | number | (string | number)[];
  hard: boolean;
  penalty?: number;
}

export interface FinancialCriteria {
  min_irr?: number;
  min_coc?: number;
  min_equity_multiple?: number;
  max_payback_years?: number;
  min_dscr?: number;
  max_ltv?: number;
  min_yoc?: number;
}

export interface LocationWeights {
  transit: number;
  schools: number;
  employment: number;
  retail: number;
  parks: number;
  healthcare: number;
  restaurants: number;
  entertainment: number;
  radius_miles: number;
}

export interface ExecutionProfile {
  hold_period_min: number;
  hold_period_max: number;
  exit_type: 'sale' | 'refinance' | '1031' | 'hold_indefinitely';
  capital_recycling: boolean;
  stabilization_months: number;
}

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  is_active: boolean;
  is_system_template: boolean;
  signal_weights: SignalWeights;
  property_gates: PropertyGate[];
  risk_gates: PropertyGate[];
  financial_criteria?: FinancialCriteria;
  location_weights?: LocationWeights;
  execution_profile?: ExecutionProfile;
  sort_order: number;
  cloned_from?: string;
  version: number;
  created_at?: string;
  updated_at?: string;
}

interface StrategyStoreState {
  strategies: Strategy[];
  systemTemplates: Strategy[];
  loading: boolean;
  error: string | null;

  fetchStrategies: () => Promise<void>;
  fetchSystemTemplates: () => Promise<void>;
  createStrategy: (payload: Partial<Strategy>) => Promise<Strategy | null>;
  updateStrategy: (id: string, payload: Partial<Strategy>) => Promise<Strategy | null>;
  deleteStrategy: (id: string) => Promise<boolean>;
  cloneStrategy: (id: string, newName: string) => Promise<Strategy | null>;
  reorderStrategies: (orderedIds: string[]) => Promise<void>;
  toggleActive: (id: string, active: boolean) => Promise<void>;
}

export const useStrategyStore = create<StrategyStoreState>((set, get) => ({
  strategies: [],
  systemTemplates: [],
  loading: false,
  error: null,

  fetchStrategies: async () => {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get('/api/v1/m08/strategies');
      const all: Strategy[] = Array.isArray(res.data?.strategies) ? res.data.strategies : [];
      set({
        strategies: all.filter(s => !s.is_system_template),
        systemTemplates: all.filter(s => s.is_system_template),
        loading: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch strategies';
      set({ error: msg, loading: false });
    }
  },

  fetchSystemTemplates: async () => {
    try {
      const res = await apiClient.get('/api/v1/m08/strategies/templates');
      const templates: Strategy[] = Array.isArray(res.data?.templates) ? res.data.templates : [];
      set({ systemTemplates: templates });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch templates';
      set({ error: msg });
    }
  },

  createStrategy: async (payload) => {
    try {
      const res = await apiClient.post('/api/v1/m08/strategies', payload);
      const strategy: Strategy = res.data?.strategy;
      if (strategy) {
        set(s => ({ strategies: [...s.strategies, strategy] }));
        return strategy;
      }
      return null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create strategy';
      set({ error: msg });
      return null;
    }
  },

  updateStrategy: async (id, payload) => {
    try {
      const res = await apiClient.put(`/api/v1/m08/strategies/${id}`, payload);
      const strategy: Strategy = res.data?.strategy;
      if (strategy) {
        set(s => ({
          strategies: s.strategies.map(st => st.id === id ? strategy : st),
        }));
        return strategy;
      }
      return null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update strategy';
      set({ error: msg });
      return null;
    }
  },

  deleteStrategy: async (id) => {
    try {
      await apiClient.delete(`/api/v1/m08/strategies/${id}`);
      set(s => ({ strategies: s.strategies.filter(st => st.id !== id) }));
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete strategy';
      set({ error: msg });
      return false;
    }
  },

  cloneStrategy: async (id, newName) => {
    try {
      const res = await apiClient.post(`/api/v1/m08/strategies/${id}/clone`, { name: newName });
      const strategy: Strategy = res.data?.strategy;
      if (strategy) {
        set(s => ({ strategies: [...s.strategies, strategy] }));
        return strategy;
      }
      return null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clone strategy';
      set({ error: msg });
      return null;
    }
  },

  reorderStrategies: async (orderedIds) => {
    try {
      await apiClient.put('/api/v1/m08/strategies/reorder', { order: orderedIds });
      set(s => ({
        strategies: [...s.strategies].sort(
          (a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)
        ),
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reorder strategies';
      set({ error: msg });
    }
  },

  toggleActive: async (id, active) => {
    const { updateStrategy } = get();
    await updateStrategy(id, { is_active: active } as Partial<Strategy>);
  },
}));
