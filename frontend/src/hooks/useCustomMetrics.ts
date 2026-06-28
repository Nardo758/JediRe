import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api.client';

export interface CustomMetricDefinition {
  id: string;
  scope: 'user' | 'deal';
  name: string;
  metric_key: string;
  metric_type: 'derived' | 'input';
  rollup: 'sum' | 'avg' | 'end_of_period' | 'rederive';
  format: 'pct' | 'currency' | 'ratio' | 'per_unit';
}

export interface CustomMetricPeriod {
  month: string;
  resolved: number | null;
  zone: string;
}

export interface CustomMetricAnnualPoint {
  year: string;
  value: number | null;
  zone: string;
  actualMonths: number;
  projectionMonths: number;
}

export interface CustomMetricSeriesEntry {
  metricKey: string;
  name: string;
  metricType: 'derived' | 'input';
  periods: CustomMetricPeriod[];
}

export interface CustomMetricsData {
  metrics: CustomMetricDefinition[];
  series: Record<string, CustomMetricSeriesEntry>;
  annualSeries: Record<string, CustomMetricAnnualPoint[]>;
}

interface UseCustomMetricsReturn {
  data: CustomMetricsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCustomMetrics(dealId: string | null | undefined): UseCustomMetricsReturn {
  const [data, setData] = useState<CustomMetricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!dealId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; metrics: CustomMetricDefinition[]; series?: Record<string, CustomMetricSeriesEntry>; annualSeries?: Record<string, CustomMetricAnnualPoint[]> }>(
        `/api/v1/custom-metrics/${dealId}?includeSeries=true`
      );
      if (res.data?.success) {
        setData({
          metrics: res.data.metrics || [],
          series: res.data.series || {},
          annualSeries: res.data.annualSeries || {},
        });
      }
    } catch (err: any) {
      if (err.response?.status !== 404) {
        setError(err?.response?.data?.error || err.message || 'Custom metrics error');
      }
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
