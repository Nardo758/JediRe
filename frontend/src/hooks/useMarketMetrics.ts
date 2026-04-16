import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

interface MarketRow {
  id: string;
  rank: number;
  starred: boolean;
  msa: string;
  props: number;
  units: string;
  jedi: number;
  d30: number;
  trend: number[];
  rent: string;
  rentNum: number;
  rentD: string;
  vac: string;
  vacNum: number;
  absorb: string;
  absorbNum: number;
  pipeline: string;
  pipelineNum: number;
  costs: string;
  costsNum: number;
  dApt: string;
  dAptNum: number;
  popD: string;
  popDNum: number;
  medInc: string;
  medIncNum: number;
  cap: string;
  capNum: number;
  cycle: string;
}

interface SubmarketRow {
  name: string;
  msa: string;
  msaId: string;
  jedi: number;
  rent: string;
  rentD: string;
  vac: string;
  props: number;
  units: string;
  opp: number;
  cap: string;
  cycle: string;
}

interface PropertyRow {
  name: string;
  submarket: string;
  msa: string;
  jedi: number;
  units: number;
  rent: string;
  occ: string;
  capRate: string;
  vintage: number;
  owner: string;
}

export function useMarketMetrics() {
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/market-metrics/markets");
      if (res.data.success) {
        setMarkets(res.data.markets || []);
        setLastUpdated(res.data.timestamp);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return { markets, loading, error, lastUpdated, refresh: fetchMarkets };
}

export function useSubmarketMetrics(msaId?: string) {
  const [submarkets, setSubmarkets] = useState<SubmarketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = msaId ? `?msaId=${encodeURIComponent(msaId)}` : "";
      const res = await api.get(`/market-metrics/submarkets${params}`);
      if (res.data.success) {
        setSubmarkets(res.data.submarkets || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load submarkets");
    } finally {
      setLoading(false);
    }
  }, [msaId]);

  useEffect(() => {
    fetchSubmarkets();
  }, [fetchSubmarkets]);

  return { submarkets, loading, error, refresh: fetchSubmarkets };
}

export function usePropertyMetrics(msaId?: string) {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = msaId ? `?msaId=${encodeURIComponent(msaId)}` : "";
      const res = await api.get(`/market-metrics/properties${params}`);
      if (res.data.success) {
        setProperties(res.data.properties || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load properties");
    } finally {
      setLoading(false);
    }
  }, [msaId]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  return { properties, loading, error, refresh: fetchProperties };
}
