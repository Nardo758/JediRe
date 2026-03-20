/**
 * Strategy Analysis Service
 * Frontend client for strategy analysis persistence
 */

import { apiClient } from './api.client';

export interface StrategyAnalysis {
  id: string;
  dealId: string;
  strategySlug: string;
  assumptions: Record<string, any>;
  roi_metrics: {
    irr: number;
    risk_score: number;
    timeline_months: number;
    capex: number;
    [key: string]: any;
  };
  risk_score: number;
  recommended: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaveStrategyData {
  dealId: string;
  strategySlug: string;
  assumptions?: Record<string, any>;
  roiMetrics?: {
    irr: number;
    risk_score: number;
    timeline_months: number;
    capex: number;
    [key: string]: any;
  };
  riskScore?: number;
  recommended?: boolean;
}

export interface CompareStrategiesResponse {
  success: boolean;
  data: {
    strategies: StrategyAnalysis[];
    insights: {
      bestIRR: string;
      lowestRisk: string;
      totalCompared: number;
    };
  };
}

export const strategyAnalysisService = {
  /**
   * Save a strategy selection
   */
  async saveStrategySelection(data: SaveStrategyData): Promise<{ success: boolean; data: StrategyAnalysis }> {
    try {
      const response = await apiClient.post('/api/v1/strategy-analyses', data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to save strategy selection:', error);
      throw new Error(error.response?.data?.error || 'Failed to save strategy selection');
    }
  },

  /**
   * Get all strategy analyses for a deal
   */
  async getStrategyAnalysis(dealId: string): Promise<{ success: boolean; data: StrategyAnalysis[]; count: number }> {
    try {
      const response = await apiClient.get(`/api/v1/strategy-analyses/${dealId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch strategy analyses:', error);
      throw new Error(error.response?.data?.error || 'Failed to fetch strategy analyses');
    }
  },

  /**
   * Compare multiple strategies for a deal
   */
  async compareStrategies(dealId: string, strategySlugs: string[]): Promise<CompareStrategiesResponse> {
    try {
      const response = await apiClient.post('/api/v1/strategy-analyses/compare', {
        dealId,
        strategySlugs
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to compare strategies:', error);
      throw new Error(error.response?.data?.error || 'Failed to compare strategies');
    }
  },

  /**
   * Update a strategy analysis
   */
  async updateStrategyAnalysis(
    analysisId: string,
    data: {
      assumptions?: Record<string, any>;
      roiMetrics?: Record<string, any>;
      riskScore?: number;
      recommended?: boolean;
    }
  ): Promise<{ success: boolean; data: StrategyAnalysis }> {
    try {
      const response = await apiClient.patch(`/api/v1/strategy-analyses/${analysisId}`, data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to update strategy analysis:', error);
      throw new Error(error.response?.data?.error || 'Failed to update strategy analysis');
    }
  },

  /**
   * Delete a strategy analysis
   */
  async deleteStrategyAnalysis(analysisId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.delete(`/api/v1/strategy-analyses/${analysisId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to delete strategy analysis:', error);
      throw new Error(error.response?.data?.error || 'Failed to delete strategy analysis');
    }
  },

  /**
   * Save strategy comparison result
   * Useful for persisting user's selected strategies for comparison
   */
  async saveComparison(dealId: string, strategies: Array<{ slug: string; data: any }>): Promise<void> {
    try {
      // Save each strategy analysis
      const promises = strategies.map(strategy => 
        this.saveStrategySelection({
          dealId,
          strategySlug: strategy.slug,
          assumptions: strategy.data.assumptions || {},
          roiMetrics: {
            irr: strategy.data.irr || 0,
            risk_score: strategy.data.risk || 0,
            timeline_months: strategy.data.timeline || 0,
            capex: strategy.data.capex || 0
          },
          riskScore: strategy.data.risk || 0,
          recommended: strategy.data.recommended || false
        })
      );
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to save comparison:', error);
      throw error;
    }
  }
};
