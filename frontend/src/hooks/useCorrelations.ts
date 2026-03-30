import { useState, useEffect, useCallback } from "react";
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

export interface ColumnCorrelationInfo {
  metricId: string;
  topCorrelation: MetricCorrelation | null;
  absR: number;
  isStrong: boolean;
}

export function useTopCorrelations(geoType: string, geoId: string, minAbsR: number = 0.7) {
  const [correlations, setCorrelations] = useState<MetricCorrelation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
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
    fetch();
  }, [fetch]);

  return { correlations, loading, refresh: fetch };
}

const COLUMN_TO_METRIC: Record<string, string[]> = {
  rent: ["rent_index", "rent_index_yoy"],
  rentD: ["rent_index_yoy"],
  vac: ["home_value_index_yoy"],
  popD: ["DEMO_POPULATION"],
  medInc: ["DEMO_MED_INCOME"],
  cap: ["home_value_index"],
  pipeline: ["home_value_index_yoy"],
  absorb: ["rent_index"],
};

export function useColumnCorrelations(geoType: string, geoId: string): Record<string, ColumnCorrelationInfo> {
  const { correlations } = useTopCorrelations(geoType, geoId, 0.7);

  const map: Record<string, ColumnCorrelationInfo> = {};

  for (const [colId, metricIds] of Object.entries(COLUMN_TO_METRIC)) {
    let best: MetricCorrelation | null = null;
    let bestAbsR = 0;

    for (const corr of correlations) {
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

    map[colId] = {
      metricId: metricIds[0],
      topCorrelation: best,
      absR: bestAbsR,
      isStrong: bestAbsR >= 0.7,
    };
  }

  return map;
}
