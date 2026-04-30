/**
 * useKGContext — React hook for fetching KG context data.
 *
 * Lightweight alternative to KGContextPanel for pages that want
 * to integrate KG data into their own UI layout.
 *
 * Usage:
 *   const { context, loading, error } = useKGContext({ dealId: 'abc' });
 *   const { insight } = useKGContext({ msa: 'Atlanta' });
 */

import { useState, useEffect } from 'react';

// ─── Types (mirrors backend response shapes) ────────────────────────────────

export interface DealContext {
  dealId: string;
  name: string;
  jurisdiction: string;
  zoneCode: string;
  envelope?: Record<string, any>;
  similarDeals: Array<{
    dealId: string;
    name: string;
    zoningCode: string;
    envelope: Record<string, any> | null;
    market: string;
    similarity: string;
  }>;
  zoningPrecedents: Array<{
    zoneCode: string;
    jurisdiction: string;
    dimensional: Record<string, any>;
    parking: Record<string, any>;
    count: number;
  }>;
  marketInsights: {
    msa: string;
    name: string;
    region: string;
    dealCount: number;
    avgEnvelope: {
      avgUnits: number;
      avgGfaSf: number;
      avgFloors: number;
      avgFAR: number | null;
    } | null;
  } | null;
}

export interface MarketInsight {
  msa: string;
  name: string;
  region: string;
  dealCount: number;
  activeDeals: Array<{ dealId: string; name: string; zoneCode: string; units: number | null }>;
  avgEnvelope: {
    avgUnits: number;
    avgGfaSf: number;
    avgFloors: number;
    avgFAR: number | null;
  } | null;
}

export interface ZoningPrecedentResult {
  precedents: Array<{
    zoneCode: string;
    jurisdiction: string;
    dimensional: Record<string, any>;
    parking: Record<string, any>;
    dealCount: number;
    dealIds: string[];
    avgEnvelope: {
      avgUnits: number;
      avgGfaSf: number;
      avgHeightFt: number;
    } | null;
  }>;
  count: number;
}

interface KGContextHookOpts {
  dealId?: string;
  msa?: string;
  jurisdiction?: string;
  zoneCode?: string;
}

interface KGContextHookResult {
  context: DealContext | null;
  insight: MarketInsight | null;
  zoningPrecedents: ZoningPrecedentResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useKGContext(opts: KGContextHookOpts): KGContextHookResult {
  const [context, setContext] = useState<DealContext | null>(null);
  const [insight, setInsight] = useState<MarketInsight | null>(null);
  const [zp, setZp] = useState<ZoningPrecedentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  const { dealId, msa, jurisdiction, zoneCode } = opts;

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
        if (dealId) {
          const res = await fetch(`/api/v1/knowledge-graph/context/deals/${dealId}`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) setContext(data);
          } else if (res.status !== 404) {
            const err = await res.json().catch(() => ({ error: 'Request failed' }));
            if (!cancelled) setError(err.error);
          }
        }

        if (msa) {
          const res = await fetch(`/api/v1/knowledge-graph/context/markets/${encodeURIComponent(msa)}`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) setInsight(data);
          }
        }

        if (jurisdiction && zoneCode) {
          const res = await fetch(
            `/api/v1/knowledge-graph/context/zoning/${encodeURIComponent(jurisdiction)}/${encodeURIComponent(zoneCode)}`,
            { headers },
          );
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) setZp(data);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [dealId, msa, jurisdiction, zoneCode, refetchKey]);

  return {
    context,
    insight,
    zoningPrecedents: zp,
    loading,
    error,
    refetch: () => setRefetchKey((k) => k + 1),
  };
}
