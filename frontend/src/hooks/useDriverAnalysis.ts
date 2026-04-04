import { useState, useEffect } from 'react';
import { apiClient } from '../services/api.client';

export interface DriverResult {
  driverMetricId: string;
  driverMetricName: string;
  driverCategory: string;
  driverGeographyType: string;
  driverGeographyId: string;
  outcomeMetricId: string;
  optimalLagWeeks: number;
  pearsonR: number;
  pValue: number;
  rSquared: number;
  slope: number;
  intercept: number;
  sampleSize: number;
  direction: string;
}

export interface UseDriverAnalysisResult {
  results: DriverResult[];
  loading: boolean;
  error: string;
}

export function useDriverAnalysis(propertyId: string): UseDriverAnalysisResult {
  const [results, setResults] = useState<DriverResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!propertyId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    apiClient.get(`/api/v1/driver-analysis/results/${propertyId}`, {
      params: { sortBy: 'pearsonR', sortDir: 'desc', limit: 50 },
    })
      .then(res => {
        const data = Array.isArray(res.data?.data) ? res.data.data : [];
        setResults(data);
      })
      .catch(err => {
        setError(err.response?.data?.error || 'No driver analysis data');
      })
      .finally(() => setLoading(false));
  }, [propertyId]);

  return { results, loading, error };
}
