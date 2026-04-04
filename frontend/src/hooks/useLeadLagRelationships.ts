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

interface CatalogRelationship {
  metricId: string;
  lagMonths: number;
  typicalR: number;
}

interface CatalogMetricEntry {
  id: string;
  name: string;
  category: string;
  leadsMetrics?: CatalogRelationship[];
  laggedBy?: Array<{ metricId: string; leadMonths: number; typicalR: number }>;
}

const CATALOG_ENTRIES: CatalogMetricEntry[] = [
  { id: 'C_SURGE_INDEX', name: 'Traffic Surge Index', category: 'traffic_composite',
    leadsMetrics: [
      { metricId: 'F_RENT_GROWTH', lagMonths: 6, typicalR: 0.58 },
      { metricId: 'M_VACANCY', lagMonths: 9, typicalR: -0.50 },
    ] },
  { id: 'S_PIPELINE_UNITS', name: 'Pipeline Units', category: 'supply',
    leadsMetrics: [
      { metricId: 'M_VACANCY', lagMonths: 12, typicalR: 0.48 },
    ] },
  { id: 'E_EMPLOYMENT_GROWTH', name: 'Employment Growth', category: 'demand',
    leadsMetrics: [
      { metricId: 'L_JOBS_PER_UNIT', lagMonths: 0, typicalR: 0.85 },
    ] },
  { id: 'DEMO_POPULATION_TREND_3Y', name: 'Population Trend 3Y', category: 'demographic',
    leadsMetrics: [
      { metricId: 'F_RENT_GROWTH', lagMonths: 12, typicalR: 0.55 },
    ] },
  { id: 'C_TRAFFIC_GROWTH_INDEX', name: 'Traffic Growth Index', category: 'traffic_composite',
    leadsMetrics: [
      { metricId: 'F_RENT_GROWTH', lagMonths: 6, typicalR: 0.62 },
      { metricId: 'M_VACANCY', lagMonths: 9, typicalR: -0.54 },
      { metricId: 'M_ABSORPTION', lagMonths: 3, typicalR: 0.47 },
    ] },
  { id: 'D_SEARCH_MOMENTUM', name: 'Search Momentum', category: 'traffic_digital',
    leadsMetrics: [
      { metricId: 'C_TRAFFIC_GROWTH_INDEX', lagMonths: 3, typicalR: 0.58 },
      { metricId: 'F_RENT_GROWTH', lagMonths: 9, typicalR: 0.52 },
      { metricId: 'M_VACANCY', lagMonths: 12, typicalR: -0.45 },
    ] },
  { id: 'MACRO_OIL_PRICE', name: 'Oil Price (WTI)', category: 'macro',
    leadsMetrics: [
      { metricId: 'F_CAP_RATE', lagMonths: 6, typicalR: 0.35 },
      { metricId: 'E_EMPLOYMENT_GROWTH', lagMonths: 3, typicalR: 0.42 },
    ] },
  { id: 'MACRO_CPI_OFFICIAL', name: 'CPI Official', category: 'macro',
    leadsMetrics: [
      { metricId: 'F_RENT_GROWTH', lagMonths: 0, typicalR: 0.65 },
      { metricId: 'F_CAP_RATE', lagMonths: 6, typicalR: 0.48 },
    ] },
  { id: 'F_RENT_GROWTH', name: 'Rent Growth', category: 'financial',
    laggedBy: [
      { metricId: 'C_TRAFFIC_GROWTH_INDEX', leadMonths: 6, typicalR: 0.62 },
      { metricId: 'DEMO_POPULATION_TREND_3Y', leadMonths: 12, typicalR: 0.55 },
    ] },
  { id: 'L_JOBS_PER_UNIT', name: 'Jobs Per Unit', category: 'demand',
    laggedBy: [
      { metricId: 'E_EMPLOYMENT_GROWTH', leadMonths: 0, typicalR: 0.85 },
    ] },
  { id: 'MACRO_CPI_SHADOWSTATS', name: 'CPI ShadowStats', category: 'macro',
    laggedBy: [
      { metricId: 'MACRO_CPI_OFFICIAL', leadMonths: 0, typicalR: 0.95 },
    ] },
];

function metricDisplayName(id: string): string {
  const entry = CATALOG_ENTRIES.find(e => e.id === id);
  return entry ? entry.name : id.replace(/_/g, ' ');
}

function buildCatalogFallback(): LeadLagEntry[] {
  const entries: LeadLagEntry[] = [];
  const seen = new Set<string>();

  for (const m of CATALOG_ENTRIES) {
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
            targetName: metricDisplayName(lead.metricId),
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
            sourceName: metricDisplayName(lag.metricId),
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
  const catalogEntries = buildCatalogFallback();
  const [data, setData] = useState<LeadLagEntry[]>(catalogEntries);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'catalog' | 'merged'>('catalog');

  useEffect(() => {
    apiClient.get('/api/v1/lead-lag/results', { params: { limit: 100 } })
      .then(res => {
        const results: LeadLagApiResult[] = Array.isArray(res.data?.data) ? res.data.data : [];
        if (results.length > 0) {
          const empirical: LeadLagEntry[] = results.map(r => ({
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

          const empiricalKeys = new Set(empirical.map(e => `${e.sourceId}::${e.targetId}`));
          const catalogOnly = catalogEntries.filter(
            c => !empiricalKeys.has(`${c.sourceId}::${c.targetId}`)
          );
          const merged = [...empirical, ...catalogOnly]
            .sort((a, b) => Math.abs(b.typicalR) - Math.abs(a.typicalR));
          setData(merged);
          setSource('merged');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, source };
}
