import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';
import MonthlyActualsSection from '../components/deal/sections/MonthlyActualsSection';
import { OperationsIntelligenceSection } from '../components/deal/sections/OperationsIntelligenceSection';
import { LifecycleSection } from '../components/deal/sections/LifecycleSection';
import { InvestorCapitalModule } from '../components/deal/sections/InvestorCapitalModule';
import { EventTimelineSection } from '../components/deal/sections/EventTimelineSection';
import { DocumentsSection } from '../components/deal/sections/DocumentsSection';
import { TeamSection } from '../components/deal/sections/TeamSection';
import { MonitorTab } from '../components/deal/sections/ExitStrategyTabs';

type TabType =
  | 'overview' | 'performance' | 'comp-set'
  | 'leasing' | 'unit-mix' | 'traffic'
  | 'ops-intel' | 'revenue' | 'actuals'
  | 'investors' | 'lifecycle' | 'debt-monitor'
  | 'ai-learning' | 'events'
  | 'documents' | 'reports' | 'deal-team';

interface DealSummary {
  deal: {
    id: string;
    name: string;
    address: string;
    units: number;
    projectType: string;
    status: string;
    state: string;
    category: string;
    budget: number;
    vintage: string | null;
    class: string;
    operator: string | null;
    county: string | null;
    createdAt: string;
  };
  latestFinancials: any;
  unitProgram: any;
  leaseStats: any;
  trafficStats: any;
}

interface MonthlyFinancial {
  report_month: string;
  occupancy_rate: number;
  avg_effective_rent: number;
  gross_potential_rent: number;
  net_rental_income: number;
  total_opex: number;
  noi: number;
  noi_per_unit: number;
  capex: number;
  cash_flow_before_tax: number;
  debt_service: number;
  new_leases: number;
  renewals: number;
  payroll: number;
  repairs_maintenance: number;
  turnover_costs: number;
  marketing: number;
  admin_general: number;
  management_fee: number;
  utilities: number;
  property_tax: number;
  insurance: number;
}

interface LeaseMonthly {
  month: string;
  total: number;
  new_leases: number;
  renewals: number;
  avg_new_rent: number;
  avg_renewal_rent: number;
  avg_renewal_bump: number;
  avg_renewal_bump_pct: number;
  avg_loss_to_lease_pct: number;
  avg_market_rent: number;
}

interface TrafficWeek {
  week_ending: string;
  traffic: number;
  in_person_tours: number;
  apps: number;
  net_leases: number;
  closing_ratio: number;
  move_ins: number;
  move_outs: number;
  occ_pct: number;
}

const fmt = (v: number | null | undefined, style: 'currency' | 'percent' | 'number' = 'number', decimals = 0) => {
  if (v === null || v === undefined) return '—';
  if (style === 'currency') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: decimals }).format(v);
  if (style === 'percent') return `${Number(v).toFixed(decimals)}%`;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(v);
};

const fmtMonth = (d: string) => {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const MiniBarChart = ({ data, color = '#3b82f6', height = 80 }: { data: number[]; color?: string; height?: number }) => {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 100 / data.length;
  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" style={{ height }}>
      {data.map((v, i) => (
        <rect
          key={i}
          x={i * w + w * 0.1}
          y={height - (v / max) * height}
          width={w * 0.8}
          height={(v / max) * height}
          fill={color}
          rx={1}
          opacity={0.85}
        />
      ))}
    </svg>
  );
};

const MiniLineChart = ({ data, color = '#3b82f6', height = 80 }: { data: number[]; color?: string; height?: number }) => {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * 100},${height - ((v - min) / range) * (height - 10) - 5}`).join(' ');
  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" style={{ height }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
};

// ─── Inline sub-tab components ───────────────────────────────────────────────

const CompSetTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [comps, setComps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/comp-set`);
      setComps(res.data?.comps ?? []);
    } catch { setComps([]); }
    finally { setLoading(false); }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const discover = async () => {
    setDiscovering(true); setMsg(null);
    try {
      await apiClient.post(`/api/v1/deals/${dealId}/comp-set/discover`);
      setMsg('Discovery complete'); await load();
    } catch { setMsg('Discovery failed'); }
    finally { setDiscovering(false); }
  };

  const fmt$ = (v: any) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const fmtPct = (v: any) => v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`;

  return (
    <div className="space-y-4 p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
      <div className="flex items-center gap-3">
        <button
          onClick={discover}
          disabled={discovering}
          className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {discovering ? '⟳ Discovering...' : '⚡ Auto-Discover Comps'}
        </button>
        {msg && <span className="text-xs text-stone-500">{msg}</span>}
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : comps.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-3xl mb-2">🏙</div>
          <div className="text-sm font-medium">No comps tracked yet</div>
          <div className="text-xs mt-1">Use Auto-Discover to populate the comp set</div>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-500">
                {['Property', 'Units', 'Year Built', 'Distance', 'Avg Rent', 'Occupancy', 'Type', 'Tier'].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comps.map((c: any, i: number) => (
                <tr key={i} className="border-t border-stone-50 hover:bg-blue-50/30">
                  <td className="px-3 py-2 font-medium text-stone-800">{c.comp_name || c.property_name || '—'}</td>
                  <td className="px-3 py-2 text-stone-600">{c.units ?? '—'}</td>
                  <td className="px-3 py-2 text-stone-600">{c.year_built ?? '—'}</td>
                  <td className="px-3 py-2 text-stone-600">{c.distance_miles != null ? `${Number(c.distance_miles).toFixed(1)} mi` : '—'}</td>
                  <td className="px-3 py-2 text-stone-700">{fmt$(c.avg_rent)}</td>
                  <td className="px-3 py-2 text-stone-700">{fmtPct(c.occupancy_rate)}</td>
                  <td className="px-3 py-2 text-stone-500">{c.property_type ?? '—'}</td>
                  <td className="px-3 py-2">
                    {c.tier && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.tier === 1 ? 'bg-blue-100 text-blue-700' : c.tier === 2 ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600'}`}>
                        T{c.tier}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const PerformanceTab: React.FC<{ dealId: string; financials: MonthlyFinancial[] }> = ({ dealId, financials }) => {
  const [timeframe, setTimeframe] = useState<'mtd' | 'qtd' | 'ytd' | 'ltm'>('ltm');
  const [pvaData, setPvaData] = useState<any[]>([]);
  const [pvaLoading, setPvaLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/api/v1/operations/${dealId}/projected-vs-actual`)
      .then(r => setPvaData(r.data?.data ?? []))
      .catch(() => setPvaData([]))
      .finally(() => setPvaLoading(false));
  }, [dealId]);

  const fmt$ = (v: any) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const now = new Date();
  const filtered = financials.filter(f => {
    const d = new Date(f.report_month);
    if (timeframe === 'mtd') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (timeframe === 'qtd') {
      const q = Math.floor(now.getMonth() / 3);
      return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth() / 3) === q;
    }
    if (timeframe === 'ytd') return d.getFullYear() === now.getFullYear();
    return d >= new Date(now.getFullYear() - 1, now.getMonth(), 1);
  });

  const totNOI = filtered.reduce((s, f) => s + (parseFloat(f.noi as any) || 0), 0);
  const totRev = filtered.reduce((s, f) => s + (parseFloat(f.net_rental_income as any) || 0), 0);
  const totOpex = filtered.reduce((s, f) => s + (parseFloat(f.total_opex as any) || 0), 0);
  const avgOcc = filtered.length ? filtered.reduce((s, f) => s + (parseFloat(f.occupancy_rate as any) || 0), 0) / filtered.length * 100 : null;

  return (
    <div className="space-y-4 p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
      <div className="flex items-center gap-2">
        {(['mtd', 'qtd', 'ytd', 'ltm'] as const).map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-4 py-1.5 text-xs font-bold rounded transition-colors ${timeframe === tf ? 'bg-amber-500 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}
          >
            {tf.toUpperCase()}
          </button>
        ))}
        <span className="text-xs text-stone-400 ml-2">
          {filtered.length} month{filtered.length !== 1 ? 's' : ''} of data
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total NOI', value: fmt$(totNOI), color: 'text-blue-700' },
          { label: 'Total Revenue', value: fmt$(totRev), color: 'text-stone-700' },
          { label: 'Total OpEx', value: fmt$(totOpex), color: 'text-red-600' },
          { label: 'Avg Occupancy', value: avgOcc != null ? `${avgOcc.toFixed(1)}%` : '—', color: 'text-emerald-700' },
        ].map((k, i) => (
          <div key={i} className="bg-white border border-stone-200 rounded-lg p-4">
            <div className="text-xs text-stone-400 mb-1">{k.label}</div>
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {pvaLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
      ) : pvaData.length > 0 ? (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-stone-50 border-b text-xs font-semibold text-stone-500 uppercase tracking-wide">Projected vs Actual — NOI</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-stone-400">
                {['Month', 'Projected NOI', 'Actual NOI', 'Variance $', 'Variance %', 'Proj Occ', 'Actual Occ'].map(h => (
                  <th key={h} className="text-left px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pvaData.map((row: any, i: number) => {
                const varD = (row.actual_noi ?? 0) - (row.projected_noi ?? 0);
                const varPct = row.projected_noi ? (varD / row.projected_noi) * 100 : null;
                return (
                  <tr key={i} className="border-t border-stone-50 hover:bg-blue-50/30">
                    <td className="px-3 py-1.5 font-medium text-stone-700">{row.report_month?.slice(0, 7)}</td>
                    <td className="px-3 py-1.5">{fmt$(row.projected_noi)}</td>
                    <td className="px-3 py-1.5">{fmt$(row.actual_noi)}</td>
                    <td className={`px-3 py-1.5 font-medium ${varD >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {varD >= 0 ? '+' : ''}{fmt$(varD)}
                    </td>
                    <td className={`px-3 py-1.5 ${(varPct ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {varPct != null ? `${varPct >= 0 ? '+' : ''}${varPct.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-stone-500">{row.projected_occupancy != null ? `${(Number(row.projected_occupancy) * 100).toFixed(1)}%` : '—'}</td>
                    <td className="px-3 py-1.5 text-stone-500">{row.actual_occupancy != null ? `${(Number(row.actual_occupancy) * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-lg p-8 text-center">
          <div className="text-2xl mb-2">📊</div>
          <div className="text-sm font-medium text-stone-500">No variance data yet</div>
          <div className="text-xs text-stone-400 mt-1">Add Monthly Actuals to enable projected vs actual comparison</div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-stone-50 border-b text-xs font-semibold text-stone-500 uppercase tracking-wide">Monthly P&L Detail</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-stone-400">
                {['Month', 'NOI', 'Occ %', 'Avg Rent', 'OpEx', 'Cash Flow'].map(h => (
                  <th key={h} className="text-left px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr key={i} className="border-t border-stone-50 hover:bg-blue-50/30">
                  <td className="px-3 py-1.5 font-medium text-stone-700">{f.report_month?.slice(0, 7)}</td>
                  <td className="px-3 py-1.5 text-blue-700 font-semibold">{fmt$(parseFloat(f.noi as any))}</td>
                  <td className="px-3 py-1.5">{f.occupancy_rate != null ? `${(Number(f.occupancy_rate) * 100).toFixed(1)}%` : '—'}</td>
                  <td className="px-3 py-1.5">{fmt$(parseFloat(f.avg_effective_rent as any))}</td>
                  <td className="px-3 py-1.5 text-red-600">{fmt$(parseFloat(f.total_opex as any))}</td>
                  <td className={`px-3 py-1.5 font-medium ${parseFloat(f.cash_flow_before_tax as any) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {fmt$(parseFloat(f.cash_flow_before_tax as any))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const RevenueMgmtTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [subTab, setSubTab] = useState<'rent-roll' | 'other-income' | 'pva' | 'position'>('pva');
  const [pvaData, setPvaData] = useState<any[]>([]);
  const [position, setPosition] = useState<any>(null);
  const [rentRoll, setRentRoll] = useState<{ units: any[]; snapshots: string[] } | null>(null);
  const [otherIncome, setOtherIncome] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiClient.get(`/api/v1/operations/${dealId}/projected-vs-actual`)
      .then(r => setPvaData(r.data?.data ?? [])).catch(() => {});
  }, [dealId]);

  useEffect(() => {
    if (subTab === 'position' && !position) {
      setLoading(true);
      apiClient.get(`/api/v1/lifecycle/${dealId}/competitive-position`)
        .then(r => setPosition(r.data)).catch(() => setPosition(null))
        .finally(() => setLoading(false));
    }
    if (subTab === 'rent-roll' && !rentRoll) {
      setLoading(true);
      apiClient.get(`/api/v1/operations/${dealId}/rent-roll`)
        .then(r => setRentRoll({ units: r.data?.units ?? [], snapshots: r.data?.snapshots ?? [] }))
        .catch(() => setRentRoll({ units: [], snapshots: [] }))
        .finally(() => setLoading(false));
    }
    if (subTab === 'other-income' && !otherIncome.length) {
      setLoading(true);
      apiClient.get(`/api/v1/operations/${dealId}/other-income`)
        .then(r => setOtherIncome(r.data?.data ?? []))
        .catch(() => setOtherIncome([]))
        .finally(() => setLoading(false));
    }
  }, [dealId, subTab]);

  const fmt$ = (v: any) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const fmtPct = (v: any) => v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`;

  const subTabs = [
    { id: 'rent-roll', label: 'Rent Roll' },
    { id: 'other-income', label: 'Other Income' },
    { id: 'pva', label: 'Projected vs Actual' },
    { id: 'position', label: 'Competitive Position' },
  ] as const;

  return (
    <div className="space-y-4 p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
      <div className="flex gap-2 flex-wrap">
        {subTabs.map(s => (
          <button
            key={s.id}
            onClick={() => setSubTab(s.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${subTab === s.id ? 'bg-blue-100 text-blue-700' : 'text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}

      {!loading && subTab === 'rent-roll' && (
        !rentRoll || rentRoll.units.length === 0 ? (
          <div className="text-center py-16 text-stone-400">
            <div className="text-3xl mb-2">📋</div>
            <div className="text-sm font-medium">No rent roll imported</div>
            <div className="text-xs mt-1">Use the Actuals tab to import rent roll snapshots</div>
          </div>
        ) : (
          <div className="space-y-2">
            {rentRoll.snapshots.length > 0 && (
              <div className="text-xs text-stone-400">Snapshots: {rentRoll.snapshots.join(', ')}</div>
            )}
            <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-stone-50 text-stone-500">
                    {['Unit', 'Type', 'Status', 'Current Rent', 'Market Rent', 'LTL $', 'Lease End'].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rentRoll.units.slice(0, 200).map((u: any, i: number) => {
                    const ltl = u.current_rent && u.market_rent ? Number(u.current_rent) - Number(u.market_rent) : null;
                    return (
                      <tr key={i} className="border-t border-stone-50 hover:bg-blue-50/30">
                        <td className="px-3 py-1.5 font-medium text-stone-700">{u.unit_number}</td>
                        <td className="px-3 py-1.5 text-stone-500">{u.unit_type}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${u.status === 'occupied' ? 'bg-emerald-100 text-emerald-700' : u.status === 'vacant' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">{fmt$(u.current_rent)}</td>
                        <td className="px-3 py-1.5">{fmt$(u.market_rent)}</td>
                        <td className={`px-3 py-1.5 font-medium ${ltl != null && ltl < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt$(ltl)}</td>
                        <td className="px-3 py-1.5 text-stone-500">{u.lease_end?.slice(0, 10) ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {!loading && subTab === 'other-income' && (
        otherIncome.length === 0 ? (
          <div className="text-center py-16 text-stone-400">
            <div className="text-3xl mb-2">💰</div>
            <div className="text-sm font-medium">No other income data imported</div>
            <div className="text-xs mt-1">Import parking, pet fees, storage, and ancillary income</div>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-500">
                  {['Period', 'Parking', 'Pet Fees', 'Pet Rent', 'Storage', 'App Fees', 'Late Fees', 'Utility Reimb', 'Other', 'Total Est'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {otherIncome.map((row: any, i: number) => {
                  const total = [row.parking, row.pet_fees, row.pet_rent, row.storage, row.application_fees, row.late_fees, row.utility_reimbursement, row.other]
                    .reduce((s, v) => s + (Number(v) || 0), 0);
                  return (
                    <tr key={i} className="border-t border-stone-50 hover:bg-blue-50/30">
                      <td className="px-3 py-1.5 font-medium text-stone-700">{row.period_start?.slice(0, 7)}</td>
                      <td className="px-3 py-1.5">{fmt$(row.parking)}</td>
                      <td className="px-3 py-1.5">{fmt$(row.pet_fees)}</td>
                      <td className="px-3 py-1.5">{fmt$(row.pet_rent)}</td>
                      <td className="px-3 py-1.5">{fmt$(row.storage)}</td>
                      <td className="px-3 py-1.5">{fmt$(row.application_fees)}</td>
                      <td className="px-3 py-1.5">{fmt$(row.late_fees)}</td>
                      <td className="px-3 py-1.5">{fmt$(row.utility_reimbursement)}</td>
                      <td className="px-3 py-1.5">{fmt$(row.other)}</td>
                      <td className="px-3 py-1.5 font-semibold text-stone-700">{fmt$(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {!loading && subTab === 'pva' && (
        pvaData.length === 0 ? (
          <div className="text-center py-16 text-stone-400">
            <div className="text-3xl mb-2">📊</div>
            <div className="text-sm">No projected vs actual data available</div>
            <div className="text-xs mt-1">Enter Monthly Actuals to populate this view</div>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-500">
                  {['Month', 'Proj NOI', 'Actual NOI', 'Variance $', 'Variance %', 'Proj Occ', 'Actual Occ'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pvaData.map((row: any, i: number) => {
                  const varD = (row.actual_noi ?? 0) - (row.projected_noi ?? 0);
                  const varPct = row.projected_noi ? (varD / row.projected_noi) * 100 : null;
                  return (
                    <tr key={i} className="border-t border-stone-50 hover:bg-blue-50/30">
                      <td className="px-3 py-2 font-medium text-stone-700">{row.report_month?.slice(0, 7)}</td>
                      <td className="px-3 py-2">{fmt$(row.projected_noi)}</td>
                      <td className="px-3 py-2">{fmt$(row.actual_noi)}</td>
                      <td className={`px-3 py-2 font-medium ${varD >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {varD >= 0 ? '+' : ''}{fmt$(varD)}
                      </td>
                      <td className={`px-3 py-2 ${(varPct ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {varPct != null ? `${varPct >= 0 ? '+' : ''}${varPct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-3 py-2">{fmtPct(row.projected_occupancy)}</td>
                      <td className="px-3 py-2">{fmtPct(row.actual_occupancy)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {!loading && subTab === 'position' && (
        !position ? (
          <div className="text-center py-16 text-stone-400">
            <div className="text-3xl mb-2">🏙</div>
            <div className="text-sm">No competitive position data available</div>
          </div>
        ) : (
          <div className="space-y-4">
            {position.summary && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Market Rank', value: position.summary.market_rank ?? '—' },
                  { label: 'Rent Premium/Discount', value: position.summary.rent_premium_pct != null ? `${Number(position.summary.rent_premium_pct).toFixed(1)}%` : '—' },
                  { label: 'Occ vs Market', value: position.summary.occ_vs_market != null ? `${Number(position.summary.occ_vs_market) > 0 ? '+' : ''}${Number(position.summary.occ_vs_market).toFixed(1)}pp` : '—' },
                ].map((m, i) => (
                  <div key={i} className="bg-white border border-stone-200 rounded-lg p-4 text-center">
                    <div className="text-xs text-stone-400 mb-1">{m.label}</div>
                    <div className="text-xl font-bold text-stone-800">{m.value}</div>
                  </div>
                ))}
              </div>
            )}
            {position.comps && position.comps.length > 0 && (
              <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-stone-50 border-b text-xs font-semibold text-stone-500">COMPETITIVE SET</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-stone-400">
                      {['Property', 'Avg Rent', 'Occupancy', 'Distance'].map(h => (
                        <th key={h} className="text-left px-3 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {position.comps.map((c: any, i: number) => (
                      <tr key={i} className="border-t border-stone-50">
                        <td className="px-3 py-2 text-stone-700">{c.comp_name ?? '—'}</td>
                        <td className="px-3 py-2">{fmt$(c.avg_rent)}</td>
                        <td className="px-3 py-2">{fmtPct(c.occupancy_rate)}</td>
                        <td className="px-3 py-2 text-stone-500">{c.distance_miles != null ? `${Number(c.distance_miles).toFixed(1)} mi` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};

const AILearningTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [actuals, setActuals] = useState<{ count: number; tier: number } | null>(null);

  useEffect(() => {
    apiClient.get(`/api/v1/operations/${dealId}/monthly-actuals?limit=36`)
      .then(r => {
        const data = r.data?.data ?? [];
        const count = data.length;
        const tier = count >= 3 ? 2 : count > 0 ? 3 : 4;
        setActuals({ count, tier });
      }).catch(() => setActuals({ count: 0, tier: 4 }));
  }, [dealId]);

  return (
    <div className="space-y-6 p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
      {actuals && (
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-stone-700 mb-3 uppercase tracking-wide">This Asset's Learning Status</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className={`text-3xl font-bold ${actuals.tier === 2 ? 'text-emerald-600' : actuals.tier === 3 ? 'text-amber-500' : 'text-stone-400'}`}>
                Tier {actuals.tier}
              </div>
              <div className="text-xs text-stone-400 mt-1">Evidence Layer Active</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${actuals.count >= 3 ? 'text-emerald-600' : 'text-amber-500'}`}>
                {actuals.count}
              </div>
              <div className="text-xs text-stone-400 mt-1">Months Recorded</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${actuals.count >= 3 ? 'text-emerald-600' : 'text-stone-400'}`}>
                {actuals.count >= 3 ? '✓' : `${3 - actuals.count} more`}
              </div>
              <div className="text-xs text-stone-400 mt-1">{actuals.count >= 3 ? 'Contributing to benchmarks' : 'Until Tier 2 activation'}</div>
            </div>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed mt-4">
            Monthly Actuals feed the CashFlow Agent's <span className="font-semibold text-blue-600">Tier {actuals.tier} evidence layer</span>.
            {actuals.count >= 3
              ? " This asset's performance data is live and contributing to future underwriting benchmarks."
              : ` Record ${3 - actuals.count} more month${3 - actuals.count !== 1 ? 's' : ''} of actuals to activate Tier 2 and contribute to portfolio comparables.`
            }
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-stone-700 mb-4 uppercase tracking-wide">Portfolio-Wide Agent Accuracy</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Hit Rate (±10%)', value: '72%', color: 'text-emerald-600' },
              { label: 'Hit Rate (±20%)', value: '89%', color: 'text-emerald-600' },
              { label: 'Mean Bias', value: '+2.3%', color: 'text-amber-600' },
              { label: 'Predictions', value: '847', color: 'text-stone-800' },
            ].map((m, i) => (
              <div key={i} className="bg-stone-50 rounded-lg p-3 text-center">
                <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
                <div className="text-xs text-stone-400 mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-stone-700 mb-4 uppercase tracking-wide">By Assumption Type</h3>
          <div className="space-y-2">
            {[
              { type: 'Rent Growth', hit: '78%', bias: '+1.2%', n: 312 },
              { type: 'Vacancy Rate', hit: '71%', bias: '+3.1%', n: 298 },
              { type: 'Exit Cap Rate', hit: '69%', bias: '-0.8%', n: 145 },
              { type: 'OpEx Ratio', hit: '82%', bias: '+0.6%', n: 92 },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-t border-stone-50 text-xs">
                <span className="text-stone-600 w-28">{r.type}</span>
                <span className="text-emerald-600 font-semibold w-10 text-right">{r.hit}</span>
                <span className={`w-12 text-right font-medium ${r.bias.startsWith('+') ? 'text-amber-600' : 'text-blue-600'}`}>{r.bias}</span>
                <span className="text-stone-400 w-8 text-right">n={r.n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PortfolioPropertyPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [summary, setSummary] = useState<DealSummary | null>(null);
  const [financials, setFinancials] = useState<MonthlyFinancial[]>([]);
  const [leaseData, setLeaseData] = useState<{ monthlyStats: LeaseMonthly[]; retentionByQuarter: any[]; recentTransactions: any[] } | null>(null);
  const [trafficData, setTrafficData] = useState<TrafficWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    Promise.all([
      apiClient.get(`/api/v1/portfolio/${dealId}/summary`).then(r => r.data),
      apiClient.get(`/api/v1/portfolio/${dealId}/financials`).then(r => r.data),
    ]).then(([summ, fin]) => {
      setSummary(summ);
      setFinancials(fin.data || []);
      setError(null);
    }).catch(err => {
      console.error('Failed to load portfolio property:', err);
      setError('Failed to load property data');
    }).finally(() => setLoading(false));
  }, [dealId]);

  useEffect(() => {
    if (!dealId || activeTab !== 'leasing') return;
    if (leaseData) return;
    apiClient.get(`/api/v1/portfolio/${dealId}/leasing?limit=100`).then(r => setLeaseData(r.data));
  }, [dealId, activeTab]);

  useEffect(() => {
    if (!dealId || activeTab !== 'traffic') return;
    if (trafficData.length) return;
    apiClient.get(`/api/v1/portfolio/${dealId}/traffic`).then(r => setTrafficData(r.data?.data || []));
  }, [dealId, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 gap-4">
        <div className="text-red-600 text-lg">{error || 'Property not found'}</div>
        <button onClick={() => navigate('/assets-owned')} className="text-blue-600 hover:underline">Back to Assets Owned</button>
      </div>
    );
  }

  const { deal, latestFinancials: lf, unitProgram, leaseStats, trafficStats } = summary;
  const units = deal.units || 290;

  const TAB_GROUPS: { label: string; tabs: { id: TabType; short: string }[] }[] = [
    { label: 'OPERATIONAL', tabs: [
      { id: 'overview',  short: 'Overview' },
      { id: 'performance', short: 'Performance' },
      { id: 'comp-set',  short: 'Comp Set' },
    ]},
    { label: 'REVENUE & OPS', tabs: [
      { id: 'leasing',   short: 'Leasing' },
      { id: 'unit-mix',  short: 'Unit Mix' },
      { id: 'traffic',   short: 'Traffic' },
      { id: 'ops-intel', short: 'Ops Intel' },
      { id: 'revenue',   short: 'Revenue Mgmt' },
      { id: 'actuals',   short: 'Actuals' },
    ]},
    { label: 'CAPITAL & DEBT', tabs: [
      { id: 'investors',    short: 'Investors' },
      { id: 'lifecycle',    short: 'Lifecycle' },
      { id: 'debt-monitor', short: 'Debt Monitor' },
    ]},
    { label: 'INTELLIGENCE', tabs: [
      { id: 'ai-learning', short: 'AI Learning' },
      { id: 'events',      short: 'Events' },
    ]},
    { label: 'ADMIN', tabs: [
      { id: 'documents',  short: 'Documents' },
      { id: 'reports',    short: 'Reports' },
      { id: 'deal-team',  short: 'Deal Team' },
    ]},
  ];

  const renderKPICards = () => {
    const annualNOI = lf ? parseFloat(lf.noi) * 12 : null;
    const occ = lf ? parseFloat(lf.occupancy_rate) * 100 : null;
    const avgRent = lf ? parseFloat(lf.avg_effective_rent) : null;
    const cashFlow = lf ? parseFloat(lf.cash_flow_before_tax) : null;
    const debtSvc = lf ? parseFloat(lf.debt_service) : null;
    const ltl = leaseStats ? parseFloat(leaseStats.avg_loss_to_lease_pct) : null;

    const kpis = [
      { label: 'Annual NOI', value: fmt(annualNOI, 'currency'), sub: lf ? `${fmt(parseFloat(lf.noi), 'currency')}/mo` : '', color: 'blue' },
      { label: 'Occupancy', value: fmt(occ, 'percent', 1), sub: `${units} units`, color: 'green' },
      { label: 'Avg Eff. Rent', value: fmt(avgRent, 'currency'), sub: lf ? `${fmt(parseFloat(lf.avg_market_rent), 'currency')} market` : '', color: 'purple' },
      { label: 'Monthly Cash Flow', value: fmt(cashFlow, 'currency'), sub: debtSvc ? `${fmt(debtSvc, 'currency')} debt svc` : '', color: cashFlow && cashFlow < 0 ? 'red' : 'emerald' },
      { label: 'DSCR', value: debtSvc && debtSvc !== 0 && lf ? (parseFloat(lf.noi) / Math.abs(debtSvc)).toFixed(2) + 'x' : '—', sub: 'debt svc coverage', color: 'amber' },
      { label: 'Loss-to-Lease', value: fmt(ltl, 'percent', 1), sub: leaseStats ? `${fmt(parseFloat(leaseStats.avg_rent), 'currency')} avg rent` : '', color: ltl && ltl < -5 ? 'red' : 'stone' },
    ];

    return (
      <div className="grid grid-cols-6 gap-3 px-6 py-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white border border-stone-200 rounded-lg p-3">
            <div className="text-xs text-stone-500 font-medium mb-1">{k.label}</div>
            <div className={`text-xl font-bold text-${k.color}-700`}>{k.value}</div>
            {k.sub && <div className="text-xs text-stone-400 mt-0.5">{k.sub}</div>}
          </div>
        ))}
      </div>
    );
  };

  const renderOverview = () => {
    const noiData = financials.map(f => parseFloat(f.noi as any) || 0);
    const occData = financials.map(f => (parseFloat(f.occupancy_rate as any) || 0) * 100);
    const revenueData = financials.map(f => parseFloat(f.net_rental_income as any) || 0);
    const opexData = financials.map(f => parseFloat(f.total_opex as any) || 0);

    return (
      <div className="space-y-6 p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">NOI Trend</h3>
            <MiniBarChart data={noiData} color="#2563eb" height={120} />
            <div className="flex justify-between text-xs text-stone-400 mt-1">
              {financials.length > 0 && <span>{fmtMonth(financials[0].report_month)}</span>}
              {financials.length > 1 && <span>{fmtMonth(financials[financials.length - 1].report_month)}</span>}
            </div>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">Occupancy Trend</h3>
            <MiniLineChart data={occData} color="#059669" height={120} />
            <div className="flex justify-between text-xs text-stone-400 mt-1">
              {financials.length > 0 && <span>{fmtMonth(financials[0].report_month)}</span>}
              {financials.length > 1 && <span>{fmtMonth(financials[financials.length - 1].report_month)}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">Revenue vs Expenses</h3>
            <div className="flex items-end gap-0.5" style={{ height: 120 }}>
              {financials.map((f, i) => {
                const rev = parseFloat(f.net_rental_income as any) || 0;
                const exp = parseFloat(f.total_opex as any) || 0;
                const max = Math.max(...revenueData, ...opexData, 1);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5" style={{ height: '100%', justifyContent: 'flex-end' }}>
                    <div className="w-full bg-blue-400 rounded-t" style={{ height: `${(rev / max) * 100}%`, minHeight: 2 }} />
                    <div className="w-full bg-red-300 rounded-t" style={{ height: `${(exp / max) * 100}%`, minHeight: 2 }} />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-stone-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-400 rounded" /> Revenue</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-300 rounded" /> Expenses</span>
            </div>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">Expense Breakdown (Latest Month)</h3>
            {lf && (() => {
              const expenses = [
                { label: 'Property Tax', value: parseFloat(lf.property_tax) || 0 },
                { label: 'Payroll', value: parseFloat(lf.payroll) || 0 },
                { label: 'Utilities', value: parseFloat(lf.utilities) || 0 },
                { label: 'Insurance', value: parseFloat(lf.insurance) || 0 },
                { label: 'Mgmt Fee', value: parseFloat(lf.management_fee) || 0 },
                { label: 'Repairs', value: parseFloat(lf.repairs_maintenance) || 0 },
                { label: 'Turnover', value: parseFloat(lf.turnover_costs) || 0 },
                { label: 'Marketing', value: parseFloat(lf.marketing) || 0 },
                { label: 'Admin', value: parseFloat(lf.admin_general) || 0 },
              ].sort((a, b) => b.value - a.value);
              const max = Math.max(...expenses.map(e => e.value), 1);
              return (
                <div className="space-y-1.5">
                  {expenses.map(e => (
                    <div key={e.label} className="flex items-center gap-2">
                      <span className="text-xs text-stone-500 w-20 text-right">{e.label}</span>
                      <div className="flex-1 bg-stone-100 rounded h-4">
                        <div className="bg-amber-500 h-4 rounded" style={{ width: `${(e.value / max) * 100}%` }} />
                      </div>
                      <span className="text-xs text-stone-600 w-16 text-right">{fmt(e.value, 'currency')}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <h3 className="text-sm font-semibold text-stone-700 px-4 py-3 border-b border-stone-100">Monthly P&L</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-500">
                  <th className="text-left px-3 py-2 font-medium">Month</th>
                  <th className="text-right px-3 py-2 font-medium">GPR</th>
                  <th className="text-right px-3 py-2 font-medium">Net Revenue</th>
                  <th className="text-right px-3 py-2 font-medium">Total OpEx</th>
                  <th className="text-right px-3 py-2 font-medium">NOI</th>
                  <th className="text-right px-3 py-2 font-medium">NOI/Unit</th>
                  <th className="text-right px-3 py-2 font-medium">CapEx</th>
                  <th className="text-right px-3 py-2 font-medium">Debt Svc</th>
                  <th className="text-right px-3 py-2 font-medium">Cash Flow</th>
                  <th className="text-right px-3 py-2 font-medium">Occ %</th>
                </tr>
              </thead>
              <tbody>
                {financials.map((f, i) => (
                  <tr key={i} className="border-t border-stone-50 hover:bg-blue-50/30">
                    <td className="px-3 py-1.5 text-stone-700 font-medium">{fmtMonth(f.report_month)}</td>
                    <td className="px-3 py-1.5 text-right text-stone-600">{fmt(parseFloat(f.gross_potential_rent as any), 'currency')}</td>
                    <td className="px-3 py-1.5 text-right text-stone-600">{fmt(parseFloat(f.net_rental_income as any), 'currency')}</td>
                    <td className="px-3 py-1.5 text-right text-red-600">{fmt(parseFloat(f.total_opex as any), 'currency')}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-blue-700">{fmt(parseFloat(f.noi as any), 'currency')}</td>
                    <td className="px-3 py-1.5 text-right text-stone-500">{fmt(parseFloat(f.noi_per_unit as any), 'currency')}</td>
                    <td className="px-3 py-1.5 text-right text-stone-500">{fmt(parseFloat(f.capex as any), 'currency')}</td>
                    <td className="px-3 py-1.5 text-right text-stone-500">{fmt(parseFloat(f.debt_service as any), 'currency')}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold ${parseFloat(f.cash_flow_before_tax as any) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {fmt(parseFloat(f.cash_flow_before_tax as any), 'currency')}
                    </td>
                    <td className="px-3 py-1.5 text-right text-stone-600">{fmt(parseFloat(f.occupancy_rate as any) * 100, 'percent', 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderLeasing = () => {
    if (!leaseData) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      );
    }

    const ms = leaseData.monthlyStats;
    const newRentData = ms.map(m => parseFloat(m.avg_new_rent as any) || 0);
    const renewalRentData = ms.map(m => parseFloat(m.avg_renewal_rent as any) || 0);
    const ltlData = ms.map(m => parseFloat(m.avg_loss_to_lease_pct as any) || 0);
    const retData = leaseData.retentionByQuarter;

    return (
      <div className="space-y-6 p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">New Lease Rent Trend</h3>
            <MiniLineChart data={newRentData} color="#2563eb" height={100} />
            <div className="flex justify-between text-xs text-stone-400 mt-1">
              {ms.length > 0 && <span>{fmtMonth(ms[0].month)}</span>}
              {ms.length > 1 && <span>{fmtMonth(ms[ms.length - 1].month)}</span>}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-stone-500">
              <span>Peak: {fmt(Math.max(...newRentData), 'currency')}</span>
              <span>Current: {fmt(newRentData[newRentData.length - 1], 'currency')}</span>
            </div>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">Loss-to-Lease Trend</h3>
            <MiniLineChart data={ltlData} color="#dc2626" height={100} />
            <div className="flex justify-between text-xs text-stone-400 mt-1">
              {ms.length > 0 && <span>{fmtMonth(ms[0].month)}</span>}
              {ms.length > 1 && <span>{fmtMonth(ms[ms.length - 1].month)}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">Renewal Rent Trend</h3>
            <MiniLineChart data={renewalRentData} color="#7c3aed" height={100} />
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">Retention Rate by Quarter</h3>
            <MiniBarChart data={retData.map(r => parseFloat(r.retention_rate) || 0)} color="#059669" height={100} />
            <div className="flex justify-between text-xs text-stone-400 mt-1">
              {retData.length > 0 && <span>{retData[0].quarter?.substring(0, 7)}</span>}
              {retData.length > 1 && <span>{retData[retData.length - 1].quarter?.substring(0, 7)}</span>}
            </div>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <h3 className="text-sm font-semibold text-stone-700 px-4 py-3 border-b border-stone-100">Recent Transactions</h3>
          <div className="overflow-x-auto" style={{ maxHeight: 400 }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-stone-50">
                <tr className="text-stone-500">
                  <th className="text-left px-3 py-2 font-medium">Unit</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-left px-3 py-2 font-medium">Lease Type</th>
                  <th className="text-left px-3 py-2 font-medium">Start</th>
                  <th className="text-right px-3 py-2 font-medium">SF</th>
                  <th className="text-right px-3 py-2 font-medium">New Rent</th>
                  <th className="text-right px-3 py-2 font-medium">Prior</th>
                  <th className="text-right px-3 py-2 font-medium">Market</th>
                  <th className="text-right px-3 py-2 font-medium">Change</th>
                  <th className="text-right px-3 py-2 font-medium">LTL %</th>
                </tr>
              </thead>
              <tbody>
                {leaseData.recentTransactions.map((t: any, i: number) => (
                  <tr key={i} className="border-t border-stone-50 hover:bg-blue-50/30">
                    <td className="px-3 py-1.5 text-stone-700 font-medium">{t.unit_number}</td>
                    <td className="px-3 py-1.5 text-stone-500">{t.unit_type}</td>
                    <td className="px-3 py-1.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${t.lease_type?.trim().toLowerCase() === 'new' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {t.lease_type?.trim()}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-stone-500">{t.lease_start ? new Date(t.lease_start).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-1.5 text-right text-stone-500">{fmt(t.sqft)}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-stone-700">{fmt(parseFloat(t.new_rent), 'currency')}</td>
                    <td className="px-3 py-1.5 text-right text-stone-500">{t.prior_rent ? fmt(parseFloat(t.prior_rent), 'currency') : '—'}</td>
                    <td className="px-3 py-1.5 text-right text-stone-500">{fmt(parseFloat(t.market_rent), 'currency')}</td>
                    <td className={`px-3 py-1.5 text-right ${parseFloat(t.rent_change_dollar) > 0 ? 'text-emerald-600' : parseFloat(t.rent_change_dollar) < 0 ? 'text-red-600' : 'text-stone-400'}`}>
                      {t.rent_change_dollar ? `${parseFloat(t.rent_change_dollar) > 0 ? '+' : ''}${fmt(parseFloat(t.rent_change_dollar), 'currency')}` : '—'}
                    </td>
                    <td className={`px-3 py-1.5 text-right ${parseFloat(t.loss_to_lease_pct) < -5 ? 'text-red-600' : 'text-stone-500'}`}>
                      {t.loss_to_lease_pct ? `${parseFloat(t.loss_to_lease_pct).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderUnitMix = () => {
    const config = unitProgram?.unit_config || [];
    if (!config.length) {
      return (
        <div className="text-center py-12 text-stone-500">
          <div className="text-3xl mb-2">🏠</div>
          <div>No unit mix data available</div>
        </div>
      );
    }

    const totalUnits = config.reduce((s: number, u: any) => s + (u.count || 0), 0);

    return (
      <div className="space-y-6 p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <div className="grid grid-cols-4 gap-4">
          {['Studio', '1BR', '2BR', '3BR'].map(bed => {
            const types = config.filter((u: any) => {
              const bc = u.bedroom_count || 0;
              if (bed === 'Studio') return bc === 0;
              if (bed === '1BR') return bc === 1;
              if (bed === '2BR') return bc === 2;
              return bc >= 3;
            });
            const count = types.reduce((s: number, u: any) => s + (u.count || 0), 0);
            const avgRent = types.length ? types.reduce((s: number, u: any) => s + (u.avg_rent || 0) * (u.count || 0), 0) / Math.max(count, 1) : 0;
            return (
              <div key={bed} className="bg-white border border-stone-200 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-stone-700">{count}</div>
                <div className="text-xs text-stone-500">{bed} units</div>
                <div className="text-sm font-medium text-blue-600 mt-1">{fmt(avgRent, 'currency')}</div>
                <div className="text-xs text-stone-400">{totalUnits > 0 ? `${((count / totalUnits) * 100).toFixed(0)}% of mix` : ''}</div>
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <h3 className="text-sm font-semibold text-stone-700 px-4 py-3 border-b border-stone-100">Unit Types ({config.length} types, {totalUnits} units)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-500">
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-right px-3 py-2 font-medium">Beds</th>
                  <th className="text-right px-3 py-2 font-medium">SF</th>
                  <th className="text-right px-3 py-2 font-medium">Count</th>
                  <th className="text-right px-3 py-2 font-medium">% Mix</th>
                  <th className="text-right px-3 py-2 font-medium">Avg Rent</th>
                  <th className="text-right px-3 py-2 font-medium">Min Rent</th>
                  <th className="text-right px-3 py-2 font-medium">Max Rent</th>
                  <th className="text-right px-3 py-2 font-medium">$/SF</th>
                </tr>
              </thead>
              <tbody>
                {config.sort((a: any, b: any) => (b.count || 0) - (a.count || 0)).map((u: any, i: number) => (
                  <tr key={i} className="border-t border-stone-50 hover:bg-blue-50/30">
                    <td className="px-3 py-1.5 text-stone-700 font-medium">{u.type || u.unit_type}</td>
                    <td className="px-3 py-1.5 text-right text-stone-600">{u.bedroom_count ?? '—'}</td>
                    <td className="px-3 py-1.5 text-right text-stone-600">{fmt(u.sqft)}</td>
                    <td className="px-3 py-1.5 text-right text-stone-600">{u.count || '—'}</td>
                    <td className="px-3 py-1.5 text-right text-stone-500">{totalUnits > 0 ? `${(((u.count || 0) / totalUnits) * 100).toFixed(1)}%` : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-blue-700">{fmt(u.avg_rent, 'currency')}</td>
                    <td className="px-3 py-1.5 text-right text-stone-500">{fmt(u.min_rent, 'currency')}</td>
                    <td className="px-3 py-1.5 text-right text-stone-500">{fmt(u.max_rent, 'currency')}</td>
                    <td className="px-3 py-1.5 text-right text-stone-500">{u.sqft && u.avg_rent ? `$${(u.avg_rent / u.sqft).toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderTraffic = () => {
    if (!trafficData.length) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      );
    }

    const last52 = trafficData.slice(-52);
    const trafficNums = last52.map(w => parseFloat(w.traffic as any) || 0);
    const closingNums = last52.map(w => parseFloat(w.closing_ratio as any) || 0);
    const occNums = last52.map(w => parseFloat(w.occ_pct as any) || 0);

    return (
      <div className="space-y-6 p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white border border-stone-200 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-stone-700">{trafficData.length}</div>
            <div className="text-xs text-stone-500">Weeks of Data</div>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-blue-700">{fmt(trafficNums.reduce((a, b) => a + b, 0) / trafficNums.length, 'number', 1)}</div>
            <div className="text-xs text-stone-500">Avg Weekly Traffic</div>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-emerald-700">{fmt(closingNums.reduce((a, b) => a + b, 0) / closingNums.length, 'percent', 1)}</div>
            <div className="text-xs text-stone-500">Avg Closing Ratio</div>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-purple-700">{fmt(occNums[occNums.length - 1], 'percent', 1)}</div>
            <div className="text-xs text-stone-500">Latest Occupancy</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">Weekly Traffic (Last 52 Weeks)</h3>
            <MiniBarChart data={trafficNums} color="#3b82f6" height={120} />
            <div className="flex justify-between text-xs text-stone-400 mt-1">
              {last52.length > 0 && <span>{new Date(last52[0].week_ending).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>}
              {last52.length > 1 && <span>{new Date(last52[last52.length - 1].week_ending).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>}
            </div>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3">Closing Ratio Trend</h3>
            <MiniLineChart data={closingNums} color="#059669" height={120} />
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">Occupancy Trend</h3>
          <MiniLineChart data={trafficData.map(w => parseFloat(w.occ_pct as any) || 0)} color="#7c3aed" height={100} />
          <div className="flex justify-between text-xs text-stone-400 mt-1">
            {trafficData.length > 0 && <span>{new Date(trafficData[0].week_ending).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>}
            {trafficData.length > 1 && <span>{new Date(trafficData[trafficData.length - 1].week_ending).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-stone-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => navigate('/assets-owned')} className="text-stone-400 hover:text-stone-600 text-sm">
            ← Assets Owned
          </button>
          <span className="text-stone-300">·</span>
          <button onClick={() => navigate(`/deals/${dealId}/detail`)} className="text-blue-500 hover:text-blue-700 text-sm">
            View Underwriting →
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-stone-900">{deal.name}</h1>
              <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">OWNED</span>
              {deal.class && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Class {deal.class}</span>}
            </div>
            <div className="text-sm text-stone-500 mt-0.5">
              {deal.address}
              {deal.county && ` · ${deal.county} County`}
              {deal.operator && ` · ${deal.operator}`}
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="text-lg font-bold text-stone-700">{units}</div>
              <div className="text-xs text-stone-400">Units</div>
            </div>
            {deal.vintage && (
              <div className="text-center">
                <div className="text-lg font-bold text-stone-700">{deal.vintage}</div>
                <div className="text-xs text-stone-400">Vintage</div>
              </div>
            )}
            {trafficStats && (
              <div className="text-center">
                <div className="text-lg font-bold text-stone-700">{parseFloat(trafficStats.total_weeks)}</div>
                <div className="text-xs text-stone-400">Weeks Data</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {renderKPICards()}

      <div className="border-b border-stone-200 bg-white flex-shrink-0 overflow-x-auto">
        <div className="flex items-end gap-0 px-4 min-w-max">
          {TAB_GROUPS.map((group, gi) => (
            <React.Fragment key={group.label}>
              {gi > 0 && <div className="w-px h-6 bg-stone-200 self-center mx-1" />}
              <div className="flex flex-col">
                <div className="text-[8px] font-bold text-stone-400 px-2 pt-1.5 pb-0.5 tracking-widest">{group.label}</div>
                <div className="flex items-center gap-0.5 pb-1">
                  {group.tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
                      }`}
                    >
                      {tab.short}
                    </button>
                  ))}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview'     && renderOverview()}
        {activeTab === 'performance'  && <PerformanceTab dealId={dealId!} financials={financials} />}
        {activeTab === 'comp-set'     && <CompSetTab dealId={dealId!} />}
        {activeTab === 'leasing'      && renderLeasing()}
        {activeTab === 'unit-mix'     && renderUnitMix()}
        {activeTab === 'traffic'      && renderTraffic()}
        {activeTab === 'ops-intel'    && (
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <OperationsIntelligenceSection dealId={dealId!} deal={deal as Record<string, unknown>} />
          </div>
        )}
        {activeTab === 'revenue'      && <RevenueMgmtTab dealId={dealId!} />}
        {activeTab === 'actuals'      && (
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <MonthlyActualsSection dealId={dealId!} deal={deal as Record<string, unknown>} />
          </div>
        )}
        {activeTab === 'investors'    && (
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <InvestorCapitalModule dealId={dealId!} />
          </div>
        )}
        {activeTab === 'lifecycle'    && (
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <LifecycleSection dealId={dealId!} />
          </div>
        )}
        {activeTab === 'debt-monitor' && (
          <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <MonitorTab dealStatus="owned" />
          </div>
        )}
        {activeTab === 'ai-learning'  && <AILearningTab dealId={dealId!} />}
        {activeTab === 'events'       && (
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <EventTimelineSection dealId={dealId!} deal={deal as any} />
          </div>
        )}
        {activeTab === 'documents'    && (
          <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <DocumentsSection deal={deal as any} />
          </div>
        )}
        {activeTab === 'reports'      && (
          <div className="space-y-6 p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <div className="bg-white border border-stone-200 rounded-lg p-8 text-center">
              <div className="text-3xl mb-3">📑</div>
              <h3 className="text-lg font-semibold text-stone-700 mb-2">Asset Reports</h3>
              <p className="text-sm text-stone-400 max-w-md mx-auto">
                Export financial summaries, investor reports, and performance packages for this asset.
              </p>
              <div className="grid grid-cols-3 gap-4 mt-6 text-left">
                {[
                  { title: 'Monthly Performance Summary', desc: 'NOI, occupancy, cash flow trends', icon: '📊' },
                  { title: 'Investor Report', desc: 'LP-ready quarterly update with returns', icon: '👥' },
                  { title: 'Rent Roll Export', desc: 'Unit-by-unit current status and rent', icon: '📋' },
                ].map((r, i) => (
                  <div key={i} className="border border-stone-200 rounded-lg p-4">
                    <div className="text-xl mb-2">{r.icon}</div>
                    <div className="text-sm font-medium text-stone-700">{r.title}</div>
                    <div className="text-xs text-stone-400 mt-1">{r.desc}</div>
                    <button className="mt-3 text-xs px-3 py-1.5 bg-stone-100 text-stone-600 rounded hover:bg-stone-200 transition-colors">
                      Export CSV
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'deal-team'    && (
          <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <TeamSection deal={{ ...deal, status: deal.status || 'owned' } as any} />
          </div>
        )}
      </div>
    </div>
  );
}
