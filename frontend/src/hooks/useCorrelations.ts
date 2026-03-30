import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../services/api";

export interface MetricCorrelation {
  id: number;
  metric_a: string;
  metric_b: string;
  geography_type: string;
  geography_id: string;
  window_months: number;
  correlation_r: number;
  lead_lag_months: number | null;
  p_value: number | null;
  sample_size: number;
  computed_at: string;
}

export interface FreshnessEntry {
  geography_type: string;
  geography_id: string;
  correlation_count: number;
  oldest_computed_at: string;
  newest_computed_at: string;
  avg_abs_r: number;
  stale: boolean;
}

export interface ColumnCorrelationInfo {
  metricId: string;
  topCorrelation: MetricCorrelation | null;
  absR: number;
  isStrong: boolean;
}

export function useTopCorrelations(geoType: string, geoId: string, minAbsR: number = 0.7) {
  const [correlations, setCorrelations] = useState<MetricCorrelation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!geoType || !geoId) return;
    setLoading(true);
    try {
      const res = await api.get("/correlations/top", {
        params: { geoType, geoId, minAbsR, limit: 50 },
      });
      if (res.data?.success) {
        setCorrelations(res.data.data);
      }
    } catch {
      setCorrelations([]);
    } finally {
      setLoading(false);
    }
  }, [geoType, geoId, minAbsR]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { correlations, loading, refresh: fetchData };
}

export function useBatchCorrelations(
  queries: Array<{ geographyType: string; geographyId: string }>
) {
  const [results, setResults] = useState<Record<string, MetricCorrelation[]>>({});
  const [loading, setLoading] = useState(false);

  const queriesKey = useMemo(() => JSON.stringify(queries), [queries]);

  const fetchData = useCallback(async () => {
    if (queries.length === 0) return;
    setLoading(true);
    try {
      const res = await api.post("/correlations/batch", { queries, topN: 10, minAbsR: 0.5 });
      if (res.data?.success) {
        setResults(res.data.data);
      }
    } catch {
      setResults({});
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queriesKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { results, loading, refresh: fetchData };
}

export function useCorrelationFreshness() {
  const [freshness, setFreshness] = useState<FreshnessEntry[]>([]);
  const [summary, setSummary] = useState<{ total_geographies: number; stale: number; fresh: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/correlations/freshness");
      if (res.data?.success) {
        setFreshness(res.data.data);
        setSummary(res.data.summary);
      }
    } catch {
      setFreshness([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { freshness, summary, loading, refresh: fetchData };
}

export interface MetricRecommendation {
  rank: number;
  metricId: string;
  metricLabel: string;
  columnId: string | null;
  score: number;
  reason: string;
  correlationR: number;
  leadLagMonths: number;
  pairedMetric: string;
  pairedMetricLabel: string;
  geographyId: string;
  geoCount: number;
  trendDirection: string;
  trendMagnitude: number;
}

const RECS_POLL_INTERVAL_MS = 10 * 60 * 1000;

export function useMetricRecommendations(
  marketGeoIds: Array<{ geoType: string; geoId: string }>,
  topN: number = 5
) {
  const [recommendations, setRecommendations] = useState<MetricRecommendation[]>([]);
  const [loading, setLoading] = useState(false);

  const geoKey = useMemo(() => JSON.stringify(marketGeoIds), [marketGeoIds]);

  const fetchData = useCallback(async () => {
    if (marketGeoIds.length === 0) {
      setRecommendations([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/correlations/recommendations", {
        marketGeoIds,
        topN,
      });
      if (res.data?.success) {
        const byMarket = res.data.byMarket as Record<string, MetricRecommendation[]> | undefined;
        if (byMarket && Object.keys(byMarket).length > 1) {
          const markets = Object.values(byMarket);
          const interleaved: MetricRecommendation[] = [];
          const maxLen = Math.max(...markets.map(m => m.length));
          for (let i = 0; i < maxLen; i++) {
            for (const recs of markets) {
              if (i < recs.length) interleaved.push(recs[i]);
            }
          }
          setRecommendations(interleaved);
        } else {
          setRecommendations(res.data.data);
        }
      }
    } catch {
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoKey, topN]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (marketGeoIds.length === 0) return;
    const id = setInterval(fetchData, RECS_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchData, marketGeoIds.length]);

  return { recommendations, loading, refresh: fetchData };
}

const COLUMN_TO_METRIC: Record<string, string[]> = {
  rent: ["rent_index"],
  rentD: ["rent_index_yoy"],
  cap: ["home_value_index", "home_value_index_yoy"],
  vac: ["rent_index_yoy", "home_value_index_yoy"],
  absorb: ["rent_index", "rent_index_yoy"],
  pipeline: ["home_value_index_yoy", "rent_index_yoy"],
  popD: ["DEMO_POPULATION"],
  medInc: ["DEMO_MED_INCOME"],
  jedi: ["rent_index_yoy", "home_value_index_yoy"],
};

export function useColumnCorrelations(
  marketGeoIds: Array<{ geoType: string; geoId: string }>
): { correlationMap: Record<string, ColumnCorrelationInfo>; staleCount: number; totalCount: number } {
  const batchQueries = useMemo(
    () => marketGeoIds.map(m => ({ geographyType: m.geoType, geographyId: m.geoId })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(marketGeoIds)]
  );

  const { results } = useBatchCorrelations(batchQueries);
  const { freshness } = useCorrelationFreshness();

  const allCorrelations = useMemo(() => {
    const all: MetricCorrelation[] = [];
    for (const key of Object.keys(results)) {
      all.push(...results[key]);
    }
    return all;
  }, [results]);

  const staleCount = useMemo(() => {
    const geoKeys = new Set(marketGeoIds.map(m => `${m.geoType}:${m.geoId}`));
    return freshness.filter(f => {
      const key = `${f.geography_type}:${f.geography_id}`;
      return geoKeys.has(key) && f.stale;
    }).length;
  }, [freshness, marketGeoIds]);

  const correlationMap: Record<string, ColumnCorrelationInfo> = {};

  for (const [colId, metricIds] of Object.entries(COLUMN_TO_METRIC)) {
    let best: MetricCorrelation | null = null;
    let bestAbsR = 0;

    for (const corr of allCorrelations) {
      for (const mId of metricIds) {
        if (corr.metric_a === mId || corr.metric_b === mId) {
          const absR = Math.abs(corr.correlation_r);
          if (absR > bestAbsR) {
            best = corr;
            bestAbsR = absR;
          }
        }
      }
    }

    correlationMap[colId] = {
      metricId: metricIds[0],
      topCorrelation: best,
      absR: bestAbsR,
      isStrong: bestAbsR >= 0.7,
    };
  }

  return { correlationMap, staleCount, totalCount: marketGeoIds.length };
}
