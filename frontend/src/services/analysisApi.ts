import api from './api';
import { AnalysisInput, AnalysisResponse } from '@/types/analysis';

export const analysisAPI = {
  analyze: async (input: AnalysisInput): Promise<AnalysisResponse> => {
    const { data } = await api.post<AnalysisResponse>('/api/v1/analysis/imbalance', input);
    return data;
  },

  getHistory: async (limit: number = 10): Promise<any[]> => {
    return [];
  },

  getById: async (id: string): Promise<any> => {
    return null;
  },
};

export default analysisAPI;
