import { useState, useCallback } from 'react';
import axios from 'axios';
import type { ZoningLookupResult } from '../types/zoning.types';

interface UseZoningLookupReturn {
  result: ZoningLookupResult | null;
  loading: boolean;
  error: string | null;
  lookup: (address: string) => Promise<void>;
  clear: () => void;
}

export function useZoningLookup(): UseZoningLookupReturn {
  const [result, setResult] = useState<ZoningLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (address: string) => {
    if (!address.trim()) {
      setError('Please enter an address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post<ZoningLookupResult>('/api/v1/zoning/lookup', { address });
      setResult(response.data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to lookup zoning data';
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, lookup, clear };
}
