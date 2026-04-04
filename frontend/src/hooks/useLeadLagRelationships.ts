import { useState, useEffect } from 'react';
import { apiClient } from '../services/api.client';

export interface LeadLagEntry {
  sourceId: string;
  sourceName: string;
  sourceCategory: string;
  targetId: string;
  targetName: string;
  lagMonths: number;
  typicalR: number;
  confidence: 'empirical' | 'catalog';
  sampleSize?: number;
}

interface LeadLagApiResult {
  metricAId: string;
  metricBId: string;
  optimalLagMonths: number;
  rAtOptimalLag: number;
  rAtZeroLag: number;
  improvementAbs: number;
  improvementPct: number;
  geographyType: string;
  sampleSize: number;
}

interface CatalogMetric {
  id: string;
  name: string;
  category: string;
  leadsMetrics?: Array<{ metricId: string; lagMonths: number; typicalR: number }>;
  laggedBy?: Array<{ metricId: string; leadMonths: number; typicalR: number }>;
}

function buildCatalogEntries(metrics: CatalogMetric[]): LeadLagEntry[] {
  const entries: LeadLagEntry[] = [];
  const seen = new Set<string>();

  const nameMap = new Map<string, string>();
  for (const m of metrics) {
    nameMap.set(m.id, m.name);
  }
  const displayName = (id: string) => nameMap.get(id) ?? id.replace(/_/g, ' ');

  for (const m of metrics) {
    if (m.leadsMetrics) {
      for (const lead of m.leadsMetrics) {
        const key = `${m.id}::${lead.metricId}`;
        if (!seen.has(key)) {
          seen.add(key);
          entries.push({
            sourceId: m.id,
            sourceName: m.name,
            sourceCategory: m.category,
            targetId: lead.metricId,
            targetName: displayName(lead.metricId),
            lagMonths: lead.lagMonths,
            typicalR: lead.typicalR,
            confidence: 'catalog',
          });
        }
      }
    }

    if (m.laggedBy) {
      for (const lag of m.laggedBy) {
        const key = `${lag.metricId}::${m.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          entries.push({
            sourceId: lag.metricId,
            sourceName: displayName(lag.metricId),
            sourceCategory: m.category,
            targetId: m.id,
            targetName: m.name,
            lagMonths: lag.leadMonths,
            typicalR: lag.typicalR,
            confidence: 'catalog',
          });
        }
      }
    }
  }
  return entries.sort((a, b) => Math.abs(b.typicalR) - Math.abs(a.typicalR));
}

export interface UseLeadLagResult {
  data: LeadLagEntry[];
  loading: boolean;
  source: 'catalog' | 'merged';
}

export function useLeadLagRelationships(): UseLeadLagResult {
  const [data, setData] = useState<LeadLagEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'catalog' | 'merged'>('catalog');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let catalogEntries: LeadLagEntry[] = [];

      try {
        const catalogRes = await apiClient.get('/api/v1/metrics/catalog');
        const metrics: CatalogMetric[] = Array.isArray(catalogRes.data?.metrics) ? catalogRes.data.metrics : [];
        const withRelationships = metrics.filter(m =>
          (m.leadsMetrics && m.leadsMetrics.length > 0) || (m.laggedBy && m.laggedBy.length > 0)
        );
        catalogEntries = buildCatalogEntries(withRelationships);
      } catch {
        catalogEntries = [];
      }

      let empiricalEntries: LeadLagEntry[] = [];
      try {
        const llRes = await apiClient.get('/api/v1/lead-lag/results', { params: { limit: 100 } });
        const results: LeadLagApiResult[] = Array.isArray(llRes.data?.data) ? llRes.data.data : [];
        empiricalEntries = results.map(r => ({
          sourceId: r.metricAId,
          sourceName: r.metricAId.replace(/_/g, ' '),
          sourceCategory: r.geographyType,
          targetId: r.metricBId,
          targetName: r.metricBId.replace(/_/g, ' '),
          lagMonths: r.optimalLagMonths,
          typicalR: r.rAtOptimalLag,
          confidence: 'empirical' as const,
          sampleSize: r.sampleSize,
        }));
      } catch {
        empiricalEntries = [];
      }

      if (cancelled) return;

      if (empiricalEntries.length > 0) {
        const empiricalKeys = new Set(empiricalEntries.map(e => `${e.sourceId}::${e.targetId}`));
        const catalogOnly = catalogEntries.filter(
          c => !empiricalKeys.has(`${c.sourceId}::${c.targetId}`)
        );
        const merged = [...empiricalEntries, ...catalogOnly]
          .sort((a, b) => Math.abs(b.typicalR) - Math.abs(a.typicalR));
        setData(merged);
        setSource('merged');
      } else {
        setData(catalogEntries);
        setSource('catalog');
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, source };
}
