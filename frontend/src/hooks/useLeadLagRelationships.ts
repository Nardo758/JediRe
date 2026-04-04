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

const CATALOG_ENTRIES: Array<{
  id: string; name: string; category: string;
  leadsMetrics: Array<{ metricId: string; lagMonths: number; typicalR: number }>;
}> = [
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
  { id: 'DEM_POP_GROWTH', name: 'Population Growth', category: 'demographic',
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
  { id: 'MACRO_OIL_PRICE', name: 'Oil Price', category: 'macro',
    leadsMetrics: [
      { metricId: 'F_CAP_RATE', lagMonths: 6, typicalR: 0.35 },
      { metricId: 'E_EMPLOYMENT_GROWTH', lagMonths: 3, typicalR: 0.42 },
    ] },
  { id: 'MACRO_CPI', name: 'CPI Inflation', category: 'macro',
    leadsMetrics: [
      { metricId: 'F_RENT_GROWTH', lagMonths: 0, typicalR: 0.65 },
      { metricId: 'F_CAP_RATE', lagMonths: 6, typicalR: 0.48 },
    ] },
];

function buildCatalogFallback(): LeadLagEntry[] {
  const entries: LeadLagEntry[] = [];
  for (const m of CATALOG_ENTRIES) {
    for (const lead of m.leadsMetrics) {
      entries.push({
        sourceId: m.id,
        sourceName: m.name,
        sourceCategory: m.category,
        targetId: lead.metricId,
        targetName: lead.metricId.replace(/_/g, ' '),
        lagMonths: lead.lagMonths,
        typicalR: lead.typicalR,
        confidence: 'catalog',
      });
    }
  }
  return entries.sort((a, b) => Math.abs(b.typicalR) - Math.abs(a.typicalR));
}

export interface UseLeadLagResult {
  data: LeadLagEntry[];
  loading: boolean;
  source: 'api' | 'catalog';
}

export function useLeadLagRelationships(): UseLeadLagResult {
  const [data, setData] = useState<LeadLagEntry[]>(() => buildCatalogFallback());
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'catalog'>('catalog');

  useEffect(() => {
    apiClient.get('/api/v1/lead-lag/results', { params: { limit: 100 } })
      .then(res => {
        const results: LeadLagApiResult[] = Array.isArray(res.data?.data) ? res.data.data : [];
        if (results.length > 0) {
          const mapped: LeadLagEntry[] = results.map(r => ({
            sourceId: r.metricAId,
            sourceName: r.metricAId.replace(/_/g, ' '),
            sourceCategory: r.geographyType,
            targetId: r.metricBId,
            targetName: r.metricBId.replace(/_/g, ' '),
            lagMonths: r.optimalLagMonths,
            typicalR: r.rAtOptimalLag,
            confidence: 'empirical' as const,
            sampleSize: r.sampleSize,
          })).sort((a, b) => Math.abs(b.typicalR) - Math.abs(a.typicalR));
          setData(mapped);
          setSource('api');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, source };
}
