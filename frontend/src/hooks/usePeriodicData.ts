import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api.client';
import type { PeriodicResponse, PeriodicSingleFieldResponse } from '../components/periodic/PeriodicGrid.types';

interface UsePeriodicDataOptions {
  dealId: string | null | undefined;
  field?: string; // if set, fetch single field only
}

interface UsePeriodicDataReturn {
  data: PeriodicResponse | null;
  singleField: PeriodicSingleFieldResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetch period-indexed field data from the Phase 5 periodic API.
 *
 * @example
 *   const { data, loading, error } = usePeriodicData({ dealId: 'abc-123' });
 *   // data.fields['noi'] -> Array<{ month, resolved, zone }>
 *
 * @example single field
 *   const { singleField } = usePeriodicData({ dealId: 'abc-123', field: 'noi' });
 */
export function usePeriodicData(options: UsePeriodicDataOptions): UsePeriodicDataReturn {
  const { dealId, field } = options;
  const [data, setData] = useState<PeriodicResponse | null>(null);
  const [singleField, setSingleField] = useState<PeriodicSingleFieldResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!dealId) {
      setData(null);
      setSingleField(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = `/api/v1/financial-model/${dealId}/periodic${field ? `?field=${encodeURIComponent(field)}` : ''}`;
      const res = await apiClient.get<PeriodicResponse | PeriodicSingleFieldResponse>(url);
      if (res.data && 'success' in res.data && res.data.success) {
        if (field && 'series' in res.data) {
          setSingleField(res.data as PeriodicSingleFieldResponse);
        } else {
          setData(res.data as PeriodicResponse);
        }
      } else {
        setError('Unexpected response from periodic API');
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Pre-Phase-2 deal — no periodic seed yet. Not an error, just no data.
        setData(null);
        setSingleField(null);
      } else {
        setError(err?.response?.data?.error || err.message || 'Periodic API error');
      }
    } finally {
      setLoading(false);
    }
  }, [dealId, field]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    singleField,
    loading,
    error,
    refetch: fetchData,
  };
}
