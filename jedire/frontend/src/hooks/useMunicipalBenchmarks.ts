import { useState, useCallback } from 'react';
import axios from 'axios';
import type { MunicipalBenchmark } from '../types/zoning.types';

interface UseMunicipalBenchmarksReturn {
  benchmarks: MunicipalBenchmark[];
  loading: boolean;
  error: string | null;
  fetchBenchmarks: (municipality?: string, state?: string) => Promise<void>;
  clear: () => void;
}

export function useMunicipalBenchmarks(): UseMunicipalBenchmarksReturn {
  const [benchmarks, setBenchmarks] = useState<MunicipalBenchmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBenchmarks = useCallback(async (municipality?: string, state?: string) => {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {};
      if (municipality) params.municipality = municipality;
      if (state) params.state = state;
      const response = await axios.get<MunicipalBenchmark[]>('/api/v1/municipal-benchmarks', { params });
      setBenchmarks(response.data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to fetch municipal benchmarks';
      setError(message);
      setBenchmarks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setBenchmarks([]);
    setError(null);
  }, []);

  return { benchmarks, loading, error, fetchBenchmarks, clear };
}
