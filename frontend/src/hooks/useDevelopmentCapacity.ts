import { useState, useCallback } from 'react';
import axios from 'axios';
import type { CapacityScenario, StrategyArbitrageImpact } from '../types/zoning.types';

interface AiRecommendation {
  reasoning: string;
  evidenceCount: number;
  recommendedPath: string;
}

interface DevelopmentCapacityData {
  scenarios: CapacityScenario[];
  aiRecommendation: AiRecommendation | null;
  strategyImpacts: StrategyArbitrageImpact[];
}

interface UseDevelopmentCapacityReturn {
  data: DevelopmentCapacityData | null;
  loading: boolean;
  error: string | null;
  analyze: (parcelId: string) => Promise<void>;
  analyzeByAddress: (address: string) => Promise<void>;
  clear: () => void;
}

export function useDevelopmentCapacity(): UseDevelopmentCapacityReturn {
  const [data, setData] = useState<DevelopmentCapacityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (parcelId: string) => {
    if (!parcelId) {
      setError('Please select a parcel');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<DevelopmentCapacityData>(
        `/api/v1/development-capacity/${parcelId}`
      );
      setData(response.data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to analyze development capacity';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeByAddress = useCallback(async (address: string) => {
    if (!address.trim()) {
      setError('Please enter an address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post<DevelopmentCapacityData>(
        '/api/v1/development-capacity/analyze',
        { address }
      );
      setData(response.data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to analyze development capacity';
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, loading, error, analyze, analyzeByAddress, clear };
}
