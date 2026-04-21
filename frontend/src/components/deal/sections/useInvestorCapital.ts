import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/services/api.client';

// ─── domain types ─────────────────────────────────────────────────────────────

export interface Investment {
  id: string;
  investor_id: string;
  investor_name: string;
  investor_type: string;
  investor_email: string;
  kyc_status: string;
  commitment_amount: number | string;
  funded_amount: number | string;
  unfunded_amount: number | string;
  ownership_pct: number | string | null;
  status: string;
  class: string;
}

export interface CallItem {
  id: string;
  investor_id: string;
  investor_name: string;
  investor_email: string;
  allocated_amount: number | string;
  paid_amount: number | string;
  outstanding: number | string;
  days_overdue: number | string;
  status: string;
}

export interface CapitalCall {
  id: string;
  call_number: number;
  call_date: string;
  due_date: string;
  total_amount: number | string;
  collected_amount: number | string;
  investor_count: number | string;
  status: string;
  purpose: string | null;
  allocation_method: string;
}

export interface DistItem {
  id: string;
  investor_id: string;
  investor_name: string;
  investor_email: string;
  gross_amount: number | string;
  return_of_capital: number | string;
  preferred_return: number | string;
  profit_share: number | string;
  promote: number | string;
  federal_withholding: number | string;
  state_withholding: number | string;
  foreign_withholding: number | string;
  net_amount: number | string | null;
  k1_included: boolean;
}

export interface Distribution {
  id: string;
  distribution_number: number;
  distribution_date: string;
  total_amount: number | string;
  allocated_amount: number | string;
  investor_count: number | string;
  distribution_type: string;
  status: string;
  tax_year: number;
}

export interface WaterfallTier {
  tier_order: number;
  irr_hurdle_low: number | null;
  irr_hurdle_high: number | null;
  lp_pct: number | string;
  gp_pct: number | string;
}

export interface Waterfall {
  id: string;
  pref_rate: number | string;
  catchup_pct: number | string;
  clawback: boolean;
  lp_gp_split_base: number | string;
  tiers: WaterfallTier[];
}

export interface LedgerEntry {
  id: string;
  entry_type: string;
  amount: number | string;
  running_balance: number | string | null;
  investor_name: string;
  entry_date: string;
  description: string | null;
  reference_type: string | null;
}

export interface CapSummary {
  investor_count: string | number;
  total_committed: string | number;
  total_funded: string | number;
  pending_calls: string | number;
  total_called: string | number;
  total_collected: string | number;
  total_distributions: string | number;
  total_distributed: string | number;
}

interface LoadingState {
  summary: boolean;
  investments: boolean;
  calls: boolean;
  dists: boolean;
  waterfall: boolean;
  entries: boolean;
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useInvestorCapital(dealId: string) {
  const [summary, setSummary]             = useState<CapSummary | null>(null);
  const [summaryErr, setSummaryErr]       = useState<string | null>(null);
  const [investments, setInvestments]     = useState<Investment[]>([]);
  const [allInvestors, setAllInvestors]   = useState<Array<{ id: string; name: string; type: string; kycStatus: string }>>([]);
  const [calls, setCalls]                 = useState<CapitalCall[]>([]);
  const [dists, setDists]                 = useState<Distribution[]>([]);
  const [waterfall, setWaterfall]         = useState<Waterfall | null>(null);
  const [defaultTiers, setDefaultTiers]   = useState<WaterfallTier[]>([]);
  const [entries, setEntries]             = useState<LedgerEntry[]>([]);
  const [totalEntries, setTotalEntries]   = useState<number>(0);

  const [loading, setLoading] = useState<LoadingState>({
    summary: true, investments: true, calls: true,
    dists: true, waterfall: true, entries: true,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LoadingState, string | null>>>({});

  const setLoad = (key: keyof LoadingState, val: boolean) =>
    setLoading(prev => ({ ...prev, [key]: val }));
  const setErr = (key: keyof LoadingState, val: string | null) =>
    setErrors(prev => ({ ...prev, [key]: val }));

  // ─── loaders ──────────────────────────────────────────────────────────────

  const loadSummary = useCallback(async () => {
    setLoad('summary', true);
    try {
      const r = await apiClient.get(`/api/v1/capital/deals/${dealId}/summary`);
      setSummary(r.data?.summary ?? null);
      setSummaryErr(null);
    } catch { setSummaryErr('Failed to load summary.'); }
    setLoad('summary', false);
  }, [dealId]);

  const loadInvestments = useCallback(async () => {
    setLoad('investments', true);
    setErr('investments', null);
    try {
      const [invRes, allRes] = await Promise.all([
        apiClient.get(`/api/v1/capital/deals/${dealId}/investments`),
        apiClient.get('/api/v1/capital/investors'),
      ]);
      setInvestments(invRes.data?.investments ?? []);
      setAllInvestors(allRes.data?.investors ?? []);
    } catch { setErr('investments', 'Failed to load investor data.'); }
    setLoad('investments', false);
  }, [dealId]);

  const loadCalls = useCallback(async () => {
    setLoad('calls', true);
    setErr('calls', null);
    try {
      const r = await apiClient.get(`/api/v1/capital/deals/${dealId}/capital-calls`);
      setCalls(r.data?.capitalCalls ?? []);
    } catch { setErr('calls', 'Failed to load capital calls.'); }
    setLoad('calls', false);
  }, [dealId]);

  const loadDists = useCallback(async () => {
    setLoad('dists', true);
    setErr('dists', null);
    try {
      const r = await apiClient.get(`/api/v1/capital/deals/${dealId}/distributions`);
      setDists(r.data?.distributions ?? []);
    } catch { setErr('dists', 'Failed to load distributions.'); }
    setLoad('dists', false);
  }, [dealId]);

  const loadWaterfall = useCallback(async () => {
    setLoad('waterfall', true);
    setErr('waterfall', null);
    try {
      const r = await apiClient.get(`/api/v1/capital/deals/${dealId}/waterfall`);
      setWaterfall(r.data?.waterfall ?? null);
      setDefaultTiers(r.data?.defaultTiers ?? []);
    } catch { setErr('waterfall', 'Failed to load waterfall config.'); }
    setLoad('waterfall', false);
  }, [dealId]);

  const loadEntries = useCallback(async (params?: { date_from?: string; date_to?: string; limit?: number; offset?: number }) => {
    setLoad('entries', true);
    setErr('entries', null);
    try {
      const qs = new URLSearchParams();
      if (params?.date_from) qs.set('date_from', params.date_from);
      if (params?.date_to)   qs.set('date_to',   params.date_to);
      if (params?.limit)     qs.set('limit',      String(params.limit));
      if (params?.offset)    qs.set('offset',     String(params.offset));
      const url = `/api/v1/capital/deals/${dealId}/ledger` + (qs.toString() ? `?${qs.toString()}` : '');
      const r = await apiClient.get(url);
      setEntries(r.data?.entries ?? []);
      setTotalEntries(Number(r.data?.total ?? r.data?.entries?.length ?? 0));
    } catch { setErr('entries', 'Failed to load ledger.'); }
    setLoad('entries', false);
  }, [dealId]);

  useEffect(() => {
    loadSummary();
    loadInvestments();
    loadCalls();
    loadDists();
    loadWaterfall();
    loadEntries();
  }, [loadSummary, loadInvestments, loadCalls, loadDists, loadWaterfall, loadEntries]);

  // ─── mutations ────────────────────────────────────────────────────────────

  const createInvestor = async (data: { name: string; type?: string; email?: string }) => {
    const r = await apiClient.post('/api/v1/capital/investors', data);
    return r.data?.investor as { id: string };
  };

  const linkInvestment = async (data: { investor_id: string; commitment_amount: number; ownership_pct?: number }) => {
    await apiClient.post(`/api/v1/capital/deals/${dealId}/investments`, data);
    await Promise.all([loadInvestments(), loadSummary()]);
  };

  const createAndLink = async (data: {
    name: string; type: string; email?: string;
    commitment_amount: number; ownership_pct?: number;
  }) => {
    const inv = await createInvestor({ name: data.name, type: data.type, email: data.email });
    await linkInvestment({ investor_id: inv.id, commitment_amount: data.commitment_amount, ownership_pct: data.ownership_pct });
  };

  const createCall = async (data: { call_date: string; due_date: string; total_amount: number; purpose?: string }) => {
    await apiClient.post(`/api/v1/capital/deals/${dealId}/capital-calls`, data);
    await Promise.all([loadCalls(), loadSummary()]);
  };

  const sendCall = async (callId: string) => {
    await apiClient.post(`/api/v1/capital/deals/${dealId}/capital-calls/${callId}/send`);
    await Promise.all([loadCalls(), loadSummary()]);
  };

  const createDistribution = async (data: {
    distribution_date: string; total_amount: number;
    distribution_type: string; tax_year: number;
  }) => {
    await apiClient.post(`/api/v1/capital/deals/${dealId}/distributions`, { ...data, allocation_method: 'pro_rata' });
    await Promise.all([loadDists(), loadSummary()]);
  };

  const approveDistribution = async (distId: string) => {
    await apiClient.post(`/api/v1/capital/deals/${dealId}/distributions/${distId}/approve`);
    await Promise.all([loadDists(), loadSummary()]);
  };

  const processDistribution = async (distId: string) => {
    await apiClient.post(`/api/v1/capital/deals/${dealId}/distributions/${distId}/process`);
    await Promise.all([loadDists(), loadSummary(), loadEntries()]);
  };

  const updateWaterfall = async (data: {
    pref_rate: number; catchup_pct: number; clawback: boolean;
    lp_gp_split_base: number; tiers: WaterfallTier[];
  }) => {
    await apiClient.put(`/api/v1/capital/deals/${dealId}/waterfall`, data);
    await loadWaterfall();
  };

  // ─── detail loaders (call items / dist items) ─────────────────────────────

  const loadCallItems = useCallback(async (callId: string): Promise<CallItem[]> => {
    const r = await apiClient.get(`/api/v1/capital/deals/${dealId}/capital-calls/${callId}`);
    return r.data?.capitalCall?.items ?? [];
  }, [dealId]);

  const loadDistItems = useCallback(async (distId: string): Promise<DistItem[]> => {
    const r = await apiClient.get(`/api/v1/capital/deals/${dealId}/distributions/${distId}`);
    return r.data?.distribution?.items ?? [];
  }, [dealId]);

  return {
    summary, summaryErr, investments, allInvestors, calls, dists,
    waterfall, defaultTiers, entries, totalEntries,
    loading, errors,
    reload: {
      summary: loadSummary, investments: loadInvestments,
      calls: loadCalls, dists: loadDists,
      waterfall: loadWaterfall, entries: loadEntries,
    },
    loaders: { loadCallItems, loadDistItems },
    mutations: {
      createAndLink, linkInvestment,
      createCall, sendCall,
      createDistribution, approveDistribution, processDistribution,
      updateWaterfall,
    },
  };
}
