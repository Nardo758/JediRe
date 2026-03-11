import { api } from './api.client';

export interface AnalysisStatus {
  phase: 'initializing' | 'analyzing' | 'generating' | 'complete' | 'error';
  progress: number;
  message: string;
  currentAction?: string;
  error?: string;
}

export interface StrategyResults {
  strategies: Array<{
    id: string;
    name: string;
    type: string;
    confidence: number;
    projectedROI?: number;
    timelineMonths?: number;
    description?: string;
    risks?: string[];
    opportunities?: string[];
  }>;
  recommendedStrategyId?: string;
  analysisCompletedAt: string;
}

export const dealAnalysisService = {
  triggerAnalysis: async (dealId: string): Promise<void> => {
    await api.analysis.trigger(dealId);
  },

  getLatestAnalysis: async (dealId: string): Promise<StrategyResults | null> => {
    try {
      const response = await api.analysis.latest(dealId);
      return response.data?.data || null;
    } catch (error) {
      console.error('Failed to fetch analysis:', error);
      return null;
    }
  },

  pollAnalysisStatus: (
    dealId: string,
    onStatusUpdate: (status: AnalysisStatus) => void,
    onComplete: (results: StrategyResults) => void,
    intervalMs: number = 2000
  ): (() => void) => {
    let stopped = false;
    let pollCount = 0;

    const poll = async () => {
      if (stopped) return;

      try {
        const results = await dealAnalysisService.getLatestAnalysis(dealId);

        if (results) {
          onStatusUpdate({
            phase: 'complete',
            progress: 100,
            message: 'Analysis complete',
          });
          onComplete(results);
          stopped = true;
          return;
        }

        pollCount++;
        const progress = Math.min(pollCount * 10, 90);
        const messages = [
          'Analyzing property characteristics...',
          'Evaluating market conditions...',
          'Calculating financial projections...',
          'Identifying optimal strategies...',
          'Generating recommendations...',
        ];

        onStatusUpdate({
          phase: 'analyzing',
          progress,
          message: messages[Math.floor(pollCount / 3) % messages.length],
          currentAction: `Step ${Math.min(pollCount, 5)} of 5`,
        });

        if (!stopped) {
          setTimeout(poll, intervalMs);
        }
      } catch (error) {
        console.error('Error polling analysis:', error);
        onStatusUpdate({
          phase: 'error',
          progress: 0,
          message: 'Failed to fetch analysis status',
          error: (error as Error).message,
        });
        stopped = true;
      }
    };

    poll();

    return () => {
      stopped = true;
    };
  },
};

export default dealAnalysisService;
