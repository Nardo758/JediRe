import { useState, useEffect } from 'react';
import { apiClient } from '../services/api.client';

export interface CorrelationResult {
  id: string;
  name: string;
  tier: number;
  category: string;
  xValue: number | null;
  yValue: number | null;
  correlation: number | null;
  signal: string | null;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  leadTime: string;
  actionable: string | null;
  dataSources: string[];
  missingData: string[];
}

export interface CorrelationReport {
  market: string;
  state: string;
  computedAt: string;
  snapshotDate: string | null;
  metricsComputed: number;
  metricsSkipped: number;
  correlations: CorrelationResult[];
  summary: {
    bullishSignals: number;
    bearishSignals: number;
    neutralSignals: number;
    insufficientData: number;
    rentRunway: string | null;
    affordabilityCeiling: string | null;
    supplyPressure: string | null;
    topOpportunity: string | null;
  };
}

export interface UseCorrelationReportResult {
  report: CorrelationReport | null;
  loading: boolean;
  error: string;
}

export function useCorrelationReport(city: string, state: string): UseCorrelationReportResult {
  const [report, setReport] = useState<CorrelationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!city) { setLoading(false); return; }
    setLoading(true);
    setError('');
    apiClient.get('/api/v1/correlations/report', { params: { city, state } })
      .then(res => {
        const raw = res.data?.data ?? res.data;
        if (res.data?.success === false) {
          setError(res.data?.error || 'Failed');
          return;
        }
        if (raw && Array.isArray(raw.correlations) && raw.summary) {
          setReport(raw);
        } else {
          setError('Invalid correlation report format');
        }
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to fetch correlation report'))
      .finally(() => setLoading(false));
  }, [city, state]);

  return { report, loading, error };
}
