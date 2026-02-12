import api from './api';
import { AnalysisInput, AnalysisResponse } from '@/types/analysis';

export const analysisAPI = {
  // Run market imbalance analysis for a submarket
  analyze: async (input: AnalysisInput): Promise<AnalysisResponse> => {
    const { data } = await api.post<AnalysisResponse>('/api/v1/analysis/imbalance', input);
    return data;
  },

  // Get historical analyses (placeholder for future implementation)
  getHistory: async (limit: number = 10): Promise<any[]> => {
    // TODO: Implement when backend has history endpoint
    return [];
  },

  // Get analysis by ID (placeholder for future implementation)
  getById: async (id: string): Promise<any> => {
    // TODO: Implement when backend has get-by-id endpoint
    return null;
  },
};

export default analysisAPI;
