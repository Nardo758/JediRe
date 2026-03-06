/**
 * M28 Cycle Intelligence API Client
 */

import { apiClient } from './api.client';
import type {
  CycleSnapshot,
  RateEnvironment,
  LeadingIndicator,
  DivergenceResult,
  ValueForecast,
  PhaseStrategy,
  PatternMatch,
  MacroRiskScore,
} from '../types/m28.types';

const BASE_PATH = '/api/v1/cycle-intelligence';

export const m28Client = {
  /**
   * Get current cycle phase for a market
   */
  getCyclePhase: async (marketId: string): Promise<CycleSnapshot> => {
    const response = await apiClient.get(`${BASE_PATH}/phase/${marketId}`);
    return response.data;
  },

  /**
   * Get cycle phases for multiple markets
   */
  getCyclePhases: async (marketIds: string[]): Promise<CycleSnapshot[]> => {
    const response = await apiClient.get(`${BASE_PATH}/phases`, {
      params: { marketIds: marketIds.join(',') },
    });
    return response.data;
  },

  /**
   * Get divergence signal for a market
   */
  getDivergence: async (marketId: string): Promise<DivergenceResult> => {
    const response = await apiClient.get(`${BASE_PATH}/divergence/${marketId}`);
    return response.data;
  },

  /**
   * Get current rate environment
   */
  getRateEnvironment: async (): Promise<RateEnvironment> => {
    const response = await apiClient.get(`${BASE_PATH}/test/rate-environment`);
    return response.data.data;
  },

  /**
   * Get leading indicators (optionally filtered by category)
   */
  getLeadingIndicators: async (category?: string): Promise<LeadingIndicator[]> => {
    const response = await apiClient.get(`${BASE_PATH}/test/leading-indicators`, {
      params: category ? { category } : undefined,
    });
    return response.data.data;
  },

  /**
   * Get pattern matches (historical analogs)
   */
  getPatternMatches: async (limit: number = 5): Promise<PatternMatch[]> => {
    const response = await apiClient.get(`${BASE_PATH}/pattern-matches`, {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get value forecast for a market
   */
  getValueForecast: async (marketId: string): Promise<ValueForecast> => {
    const response = await apiClient.get(`${BASE_PATH}/predict/value-change/${marketId}`);
    return response.data;
  },

  /**
   * Get phase-optimal strategy for a market
   */
  getPhaseOptimalStrategy: async (marketId: string): Promise<PhaseStrategy> => {
    const response = await apiClient.get(`${BASE_PATH}/phase-optimal-strategy/${marketId}`);
    return response.data;
  },

  /**
   * Get macro risk score
   */
  getMacroRiskScore: async (): Promise<MacroRiskScore> => {
    const response = await apiClient.get(`${BASE_PATH}/macro-risk`);
    return response.data;
  },
};
