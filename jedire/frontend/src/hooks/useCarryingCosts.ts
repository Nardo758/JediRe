import { useState, useCallback } from 'react';
import axios from 'axios';
import type { CarryingCosts } from '../types/zoning.types';

interface UseCarryingCostsReturn {
  costs: CarryingCosts | null;
  loading: boolean;
  error: string | null;
  fetchCosts: (dealId: string) => Promise<void>;
  clear: () => void;
}

export function useCarryingCosts(): UseCarryingCostsReturn {
  const [costs, setCosts] = useState<CarryingCosts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCosts = useCallback(async (dealId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get<CarryingCosts>(`/api/v1/deal-timeline/${dealId}/carrying-costs`);
      setCosts(response.data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to fetch carrying costs';
      setError(message);
      setCosts(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setCosts(null);
    setError(null);
  }, []);

  return { costs, loading, error, fetchCosts, clear };
}
