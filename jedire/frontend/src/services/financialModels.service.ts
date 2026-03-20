/**
 * Financial Models Service
 * Frontend client for financial model persistence
 */

import { apiClient } from './api.client';

export interface FinancialModel {
  id: string;
  dealId: string;
  userId: string;
  name: string;
  version: number;
  components: Record<string, any>;
  assumptions: Record<string, any>;
  results: {
    noi?: number;
    irr?: number;
    equity_multiple?: number;
    cash_on_cash?: number;
    dscr?: number;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface SaveFinancialModelData {
  dealId: string;
  name?: string;
  version?: number;
  components?: Record<string, any>;
  assumptions?: Record<string, any>;
  results?: Record<string, any>;
}

export const financialModelsService = {
  /**
   * Save a new financial model
   */
  async saveFinancialModel(data: SaveFinancialModelData): Promise<{ success: boolean; data: FinancialModel }> {
    try {
      const response = await apiClient.post('/api/v1/financial-models', data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to save financial model:', error);
      throw new Error(error.response?.data?.error || 'Failed to save financial model');
    }
  },

  /**
   * Get financial model for a deal
   */
  async getFinancialModel(dealId: string): Promise<{ success: boolean; data: FinancialModel }> {
    try {
      const response = await apiClient.get(`/api/v1/financial-models/${dealId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch financial model:', error);
      throw new Error(error.response?.data?.error || 'Failed to fetch financial model');
    }
  },

  /**
   * Update an existing financial model
   */
  async updateFinancialModel(
    modelId: string,
    data: {
      name?: string;
      version?: number;
      components?: Record<string, any>;
      assumptions?: Record<string, any>;
      results?: Record<string, any>;
    }
  ): Promise<{ success: boolean; data: FinancialModel }> {
    try {
      const response = await apiClient.patch(`/api/v1/financial-models/${modelId}`, data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to update financial model:', error);
      throw new Error(error.response?.data?.error || 'Failed to update financial model');
    }
  },

  /**
   * Delete a financial model
   */
  async deleteFinancialModel(modelId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.delete(`/api/v1/financial-models/${modelId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to delete financial model:', error);
      throw new Error(error.response?.data?.error || 'Failed to delete financial model');
    }
  },

  /**
   * Auto-save financial model with debouncing
   * Use this for blur events to avoid excessive saves
   */
  async autoSave(dealId: string, modelData: Partial<SaveFinancialModelData>): Promise<void> {
    try {
      // Try to get existing model first
      const existing = await this.getFinancialModel(dealId).catch(() => null);

      if (existing?.data?.id) {
        // Update existing model
        await this.updateFinancialModel(existing.data.id, modelData);
      } else {
        // Create new model
        await this.saveFinancialModel({
          dealId,
          ...modelData
        });
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      // Don't throw - auto-save failures should be silent
    }
  }
};
