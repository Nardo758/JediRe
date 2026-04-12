import { AnalysisInput, AnalysisResponse } from '@/types/analysis';

export const analysisAPI = {
  analyze: async (_input: AnalysisInput): Promise<AnalysisResponse> => {
    return { result: null } as unknown as AnalysisResponse;
  },

  getHistory: async (_limit: number = 10): Promise<any[]> => {
    return [];
  },

  getById: async (_id: string): Promise<any> => {
    return null;
  },
};

export default analysisAPI;
