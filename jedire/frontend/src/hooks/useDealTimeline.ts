import { useState, useCallback } from 'react';
import axios from 'axios';
import type { DealTimeline, TimelineScenario } from '../types/zoning.types';

interface UseDealTimelineReturn {
  timeline: DealTimeline | null;
  loading: boolean;
  error: string | null;
  fetchTimeline: (dealId: string, scenario?: TimelineScenario) => Promise<void>;
  clear: () => void;
}

export function useDealTimeline(): UseDealTimelineReturn {
  const [timeline, setTimeline] = useState<DealTimeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(async (dealId: string, scenario?: TimelineScenario) => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {};
      if (scenario) params.scenario = scenario;
      const response = await axios.get<DealTimeline>(`/api/v1/deal-timeline/${dealId}`, { params });
      setTimeline(response.data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to fetch deal timeline';
      setError(message);
      setTimeline(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setTimeline(null);
    setError(null);
  }, []);

  return { timeline, loading, error, fetchTimeline, clear };
}
