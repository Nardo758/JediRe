import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api.client';

export interface DataSourceEntry {
  sourceType?: string | null;
  sourceRef?: string | null;
  sourceDate?: string | null;
  source_type?: string | null;
  source_ref?: string | null;
  source_date?: string | null;
  source_document_type?: string | null;
  source_period_label?: string | null;
  data_source?: string | null;
  report_month?: string | null;
  lender?: string | null;
  category?: string | null;
}

export interface DataSourcesSummary {
  assumptions: DataSourceEntry | null;
  actuals: DataSourceEntry[];
  leases: DataSourceEntry[];
  balanceSheets: DataSourceEntry[];
  capex: DataSourceEntry[];
  debt: DataSourceEntry[];
}

export function useDataSources(dealId: string | null) {
  const [sources, setSources] = useState<DataSourcesSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!dealId) return;
    try {
      setLoading(true);
      const res = await apiClient.get(`/api/v1/deals/${dealId}/data-sources`);
      setSources(res.data?.data || null);
    } catch {
      setSources(null);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const getSourceForModule = useCallback((module: string): DataSourceEntry | null => {
    if (!sources) return null;
    switch (module) {
      case 'assumptions':
      case 'zoning':
      case 'proforma':
        return sources.assumptions;
      case 'actuals':
      case 'financials':
        return sources.actuals[0] || null;
      case 'leases':
      case 'rent_roll':
        return sources.leases[0] || null;
      case 'balance_sheet':
        return sources.balanceSheets[0] || null;
      case 'capex':
        return sources.capex[0] || null;
      case 'debt':
        return sources.debt[0] || null;
      default:
        return null;
    }
  }, [sources]);

  return { sources, loading, refresh: fetch, getSourceForModule };
}
