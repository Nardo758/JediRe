import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';
import type { Deal } from '../types/agent';
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
  period_label?: string;
  occupancy_rate: number | string;
  avg_effective_rent: number | string;
  gross_potential_rent: number | string;
  net_rental_income: number | string;
  total_opex: number | string;
  noi: number | string;
  noi_per_unit: number | string;
  capex: number | string;
  cash_flow_before_tax: number | string;
  debt_service: number | string;
  new_leases: number | string;
  renewals: number | string;
  payroll: number | string;
  repairs_maintenance: number | string;
  turnover_costs: number | string;
  marketing: number | string;
  admin_general: number | string;
  management_fee: number | string;
  utilities: number | string;
  property_tax: number | string;
  insurance: number | string;
  effective_gross_income?: number | string;
  total_operating_expenses?: number | string;
  [key: string]: unknown;
}
const toNum = (v: number | string | unknown): number => Number(v) || 0;

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

type CompFormKey = 'comp_name' | 'address' | 'units' | 'year_built' | 'avg_rent' | 'occupancy_rate' | 'distance_miles' | 'tier';
type CompForm = Record<CompFormKey, string>;

const CompSetTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [comps, setComps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<CompForm>({ comp_name: '', address: '', units: '', year_built: '', avg_rent: '', occupancy_rate: '', distance_miles: '', tier: '2' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/lifecycle/${dealId}/comp-set`);
      setComps(res.data?.comps ?? []);
    } catch { setComps([]); }
    finally { setLoading(false); }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const discover = async () => {
    setDiscovering(true); setMsg(null);
    try {
      const res = await apiClient.post(`/api/v1/deals/${dealId}/comp-set/discover`);
      const count = res.data?.discovered ?? 0;
      setMsg(`Discovered ${count} comp${count !== 1 ? 's' : ''}`);
      await load();
    } catch { setMsg('Discovery failed — deal may need a map boundary'); }
    finally { setDiscovering(false); }
  };

  const addComp = async () => {
    if (!formData.comp_name.trim()) return;
    setAdding(true); setMsg(null);
    try {
      await apiClient.post(`/api/v1/lifecycle/${dealId}/comp-set`, {
        comp_name: formData.comp_name,
        address: formData.address,
        units: formData.units ? parseInt(formData.units) : null,
        year_built: formData.year_built ? parseInt(formData.year_built) : null,
        avg_rent: formData.avg_rent ? parseFloat(formData.avg_rent) : null,
        occupancy_rate: formData.occupancy_rate ? parseFloat(formData.occupancy_rate) / 100 : null,
        distance_miles: formData.distance_miles ? parseFloat(formData.distance_miles) : null,
        tier: parseInt(formData.tier),
      });
      setMsg('Comp added'); setShowAddForm(false);
      setFormData({ comp_name: '', address: '', units: '', year_built: '', avg_rent: '', occupancy_rate: '', distance_miles: '', tier: '2' });
      await load();
    } catch { setMsg('Failed to add comp'); }
    finally { setAdding(false); }
  };

  const removeComp = async (compId: string) => {
    try {
      await apiClient.delete(`/api/v1/lifecycle/comp-set/${compId}`);
      await load();
    } catch { setMsg('Failed to remove comp'); }
  };

  const fmt$ = (v: any) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const fmtPct = (v: any) => v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`;

  return (
    <div className="space-y-4 p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
      <div className="flex items-center gap-3">
        <button
          onClick={discover}
          disabled={discovering}
          className="px-4 py-2 text-xs font-semibold bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-60"
        >
          {discovering ? '⟳ Discovering...' : '⚡ Auto-Discover Comps'}
        </button>
        <button
          onClick={() => setShowAddForm(f => !f)}
          className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Manually
        </button>
        {msg && <span className={`text-xs ${msg.includes('failed') || msg.includes('Failed') ? 'text-red-500' : 'text-emerald-600'}`}>{msg}</span>}
      </div>

      {showAddForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-blue-700 mb-3 uppercase tracking-wide">New Competitive Property</div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { key: 'comp_name' as CompFormKey, label: 'Property Name *', placeholder: 'The Reserve at...' },
              { key: 'address' as CompFormKey, label: 'Address', placeholder: '123 Main St...' },
              { key: 'units' as CompFormKey, label: 'Units', placeholder: '250' },
              { key: 'year_built' as CompFormKey, label: 'Year Built', placeholder: '2018' },
              { key: 'avg_rent' as CompFormKey, label: 'Avg Rent ($)', placeholder: '1850' },
              { key: 'occupancy_rate' as CompFormKey, label: 'Occupancy (%)', placeholder: '94.5' },
              { key: 'distance_miles' as CompFormKey, label: 'Distance (mi)', placeholder: '0.8' },
              { key: 'tier' as CompFormKey, label: 'Tier', placeholder: '2' },
            ].map(f => (
              <div key={f.key}>
                <div className="text-xs text-blue-600 mb-1">{f.label}</div>
                <input
                  type="text"
                  placeholder={f.placeholder}
                  value={formData[f.key]}
                  onChange={e => setFormData(d => ({ ...d, [f.key]: e.target.value }))}
                  className="w-full text-xs px-2 py-1.5 border border-blue-200 rounded bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={addComp} disabled={adding} className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60">
              {adding ? 'Saving...' : 'Add to Comp Set'}
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : comps.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-3xl mb-2">🏙</div>
          <div className="text-sm font-medium">No comps tracked yet</div>
          <div className="text-xs mt-1">Add properties to this asset's competitive set above</div>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-500">
                {['Property', 'Units', 'Year Built', 'Distance', 'Avg Rent', 'Occupancy', 'Tier', ''].map(h => (
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
                  <td className="px-3 py-2">
                    {c.tier && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.tier === 1 ? 'bg-blue-100 text-blue-700' : c.tier === 2 ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600'}`}>
                        T{c.tier}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => removeComp(c.id)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
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

  const totNOI = filtered.reduce((s, f) => s + (toNum(f.noi) || 0), 0);
  const totRev = filtered.reduce((s, f) => s + (toNum(f.net_rental_income) || 0), 0);
  const totOpex = filtered.reduce((s, f) => s + (toNum(f.total_opex) || 0), 0);
  const avgOcc = filtered.length ? filtered.reduce((s, f) => s + (toNum(f.occupancy_rate) || 0), 0) / filtered.length * 100 : null;

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
                  <td className="px-3 py-1.5 text-blue-700 font-semibold">{fmt$(toNum(f.noi))}</td>
                  <td className="px-3 py-1.5">{f.occupancy_rate != null ? `${(Number(f.occupancy_rate) * 100).toFixed(1)}%` : '—'}</td>
                  <td className="px-3 py-1.5">{fmt$(toNum(f.avg_effective_rent))}</td>
                  <td className="px-3 py-1.5 text-red-600">{fmt$(toNum(f.total_opex))}</td>
                  <td className={`px-3 py-1.5 font-medium ${toNum(f.cash_flow_before_tax) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {fmt$(toNum(f.cash_flow_before_tax))}
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
  const [accuracy, setAccuracy] = useState<any[]>([]);
  const [accuracyLoading, setAccuracyLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/api/v1/operations/${dealId}/monthly-actuals?limit=36`)
      .then(r => {
        const data = r.data?.data ?? [];
        const count = data.length;
        const tier = count >= 3 ? 2 : count > 0 ? 3 : 4;
        setActuals({ count, tier });
      }).catch(() => setActuals({ count: 0, tier: 4 }));
    apiClient.get(`/api/v1/learning/outcomes/deal/${dealId}/summary`)
      .then(r => setAccuracy((r.data?.summary ?? []).map((row: Record<string, unknown>) => ({
        assumptionName: ((row.assumption_name as string) ?? '').replace(/_/g, ' '),
        hitRate10Pct: ((row.hit_rate_10pct as number) ?? 0) * 100,
        hitRate20Pct: ((row.hit_rate_20pct as number) ?? 0) * 100,
        meanBias: (row.mean_gap_pct as number) ?? 0,
        nPredictions: (row.n_predictions as number) ?? 0,
      }))))
      .catch(() => setAccuracy([]))
      .finally(() => setAccuracyLoading(false));
  }, [dealId]);

  const totPredictions = accuracy.reduce((s, a) => s + a.nPredictions, 0);
  const avgHit10 = accuracy.length ? accuracy.reduce((s, a) => s + a.hitRate10Pct, 0) / accuracy.length : null;
  const avgHit20 = accuracy.length ? accuracy.reduce((s, a) => s + a.hitRate20Pct, 0) / accuracy.length : null;
  const avgBias = accuracy.length ? accuracy.reduce((s, a) => s + a.meanBias, 0) / accuracy.length : null;

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
      {accuracyLoading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
      ) : (
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-stone-700 mb-4 uppercase tracking-wide">CashFlow Agent Accuracy — This Asset</h3>
          {accuracy.length === 0 ? (
            <div className="text-center py-6 text-stone-400 text-xs">No prediction outcomes recorded yet</div>
          ) : (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Hit Rate (±10%)', value: avgHit10 != null ? `${avgHit10.toFixed(0)}%` : '—', color: (avgHit10 ?? 0) >= 70 ? 'text-emerald-600' : 'text-amber-600' },
              { label: 'Hit Rate (±20%)', value: avgHit20 != null ? `${avgHit20.toFixed(0)}%` : '—', color: (avgHit20 ?? 0) >= 80 ? 'text-emerald-600' : 'text-amber-600' },
              { label: 'Mean Bias', value: avgBias != null ? `${avgBias >= 0 ? '+' : ''}${avgBias.toFixed(1)}%` : '—', color: Math.abs(avgBias ?? 0) < 5 ? 'text-emerald-600' : 'text-amber-600' },
              { label: 'Total Predictions', value: totPredictions.toString(), color: 'text-stone-800' },
            ].map((m, i) => (
              <div key={i} className="bg-stone-50 rounded-lg p-3 text-center">
                <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
                <div className="text-xs text-stone-400 mt-1">{m.label}</div>
              </div>
            ))}
          </div>
          )}
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-stone-700 mb-4 uppercase tracking-wide">By Assumption Type</h3>
          {accuracy.length === 0 ? (
            <div className="text-center py-6 text-stone-400 text-xs">No assumption tracking data available</div>
          ) : (
          <div className="space-y-2">
            {accuracy.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-t border-stone-50 text-xs">
                <span className="text-stone-600 w-28 capitalize">{r.assumptionName}</span>
                <span className={`font-semibold w-10 text-right ${r.hitRate10Pct >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>{r.hitRate10Pct.toFixed(0)}%</span>
                <span className={`w-12 text-right font-medium ${Math.abs(r.meanBias) < 5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {r.meanBias >= 0 ? '+' : ''}{r.meanBias.toFixed(1)}%
                </span>
                <span className="text-stone-400 w-8 text-right">n={r.nPredictions}</span>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

// ─── Reports Tab Component (needs own accuracy state) ─────────────────────────
interface ReportsTabProps {
  dealId: string;
  financials: MonthlyFinancial[];
  deal: Record<string, unknown>;
}
const ReportsTab: React.FC<ReportsTabProps> = ({ dealId, financials, deal }) => {
  type AccRow = { assumptionName: string; hitRate10Pct: number; hitRate20Pct: number; meanBias: number; nPredictions: number };
  const [accuracy, setAccuracy] = useState<AccRow[]>([]);

  useEffect(() => {
    apiClient.get(`/api/v1/learning/outcomes/deal/${dealId}/summary`)
      .then(r => setAccuracy((r.data?.summary ?? []).map((row: Record<string, unknown>) => ({
        assumptionName: ((row.assumption_name as string) ?? '').replace(/_/g, ' '),
        hitRate10Pct: ((row.hit_rate_10pct as number) ?? 0) * 100,
        hitRate20Pct: ((row.hit_rate_20pct as number) ?? 0) * 100,
        meanBias: (row.mean_gap_pct as number) ?? 0,
        nPredictions: (row.n_predictions as number) ?? 0,
      }))))
      .catch(() => setAccuracy([]));
  }, [dealId]);

  const propName = (deal.property_name ?? deal.project_name ?? `property-${dealId}`) as string;
  const safeSlug = propName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const downloadCSV = (filename: string, rows: string[][], headers: string[]) => {
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportFinancials = () => {
    downloadCSV(`${safeSlug}-performance.csv`, financials.map(f => [
      (f.report_month as string)?.slice(0, 7) ?? '', String(f.noi ?? ''), String(f.occupancy_rate ?? ''),
      String(f.avg_effective_rent ?? ''), String(f.net_rental_income ?? ''), String(f.total_opex ?? ''),
      String(f.cash_flow_before_tax ?? ''), String(f.new_leases ?? ''), String(f.renewals ?? ''),
    ]), ['Month', 'NOI', 'Occupancy Rate', 'Avg Rent', 'Revenue', 'Total OpEx', 'Cash Flow', 'New Leases', 'Renewals']);
  };

  const exportRentRoll = async () => {
    const r = await apiClient.get(`/api/v1/operations/${dealId}/rent-roll`).catch(() => ({ data: { units: [] } }));
    const units = r.data?.units ?? [];
    downloadCSV(`${safeSlug}-rent-roll.csv`, units.map((u: Record<string, unknown>) => [
      String(u.unit_number ?? ''), String(u.unit_type ?? ''), String(u.status ?? ''),
      String(u.current_rent ?? ''), String(u.market_rent ?? ''),
      String(u.bedrooms ?? ''), String(u.bathrooms ?? ''), String(u.sqft ?? ''),
      ((u.lease_start as string) ?? '').slice(0, 10), ((u.lease_end as string) ?? '').slice(0, 10),
    ]), ['Unit', 'Type', 'Status', 'Current Rent', 'Market Rent', 'Beds', 'Baths', 'Sqft', 'Lease Start', 'Lease End']);
  };

  const exportInvestorSummary = () => {
    const lf = financials[financials.length - 1];
    downloadCSV(`${safeSlug}-investor-report.csv`, [
      ['Property', propName],
      ['As of Date', new Date().toISOString().slice(0, 10)],
      ['Latest NOI/mo', lf ? String(lf.noi) : 'N/A'],
      ['Annualized NOI', lf ? String(parseFloat(lf.noi as string) * 12) : 'N/A'],
      ['Avg Occupancy (LTM)', financials.length ? String((financials.reduce((s, f) => s + (parseFloat(f.occupancy_rate as string) || 0), 0) / financials.length * 100).toFixed(1)) : 'N/A'],
      ['Avg Effective Rent', lf ? String(lf.avg_effective_rent) : 'N/A'],
      ['Months of Actuals', String(financials.length)],
    ], ['Metric', 'Value']);
  };

  const lf = financials[financials.length - 1];
  const avgOcc = financials.length
    ? financials.reduce((s, f) => s + (parseFloat(f.occupancy_rate as string) || 0), 0) / financials.length
    : null;
  const annNoi = lf ? parseFloat(lf.noi as string) * 12 : null;
  const fmtD = (v: number | null) => v == null ? '—' : `$${v >= 1_000_000 ? (v / 1_000_000).toFixed(2) + 'M' : v.toLocaleString()}`;
  const fmtP = (v: number | null) => v == null ? '—' : `${(v * 100).toFixed(1)}%`;

  return (
    <div className="space-y-6 p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-stone-500 font-medium uppercase tracking-wide">Asset Reports — {propName}</div>
        <div className="flex gap-2">
          <button onClick={exportFinancials} disabled={financials.length === 0} className="text-xs px-3 py-1.5 border border-stone-200 rounded text-stone-600 hover:bg-stone-50 disabled:opacity-40">⬇ Monthly CSV</button>
          <button onClick={exportInvestorSummary} disabled={financials.length === 0} className="text-xs px-3 py-1.5 border border-stone-200 rounded text-stone-600 hover:bg-stone-50 disabled:opacity-40">⬇ Investor CSV</button>
          <button onClick={exportRentRoll} className="text-xs px-3 py-1.5 border border-stone-200 rounded text-stone-600 hover:bg-stone-50">⬇ Rent Roll CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 1. NOI Waterfall */}
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">NOI Waterfall</div>
          {!lf ? (
            <div className="text-xs text-stone-400">No actuals loaded yet</div>
          ) : (
            <div className="space-y-2">
              {([
                { label: 'Eff. Gross Income', val: parseFloat(lf.effective_gross_income as string) || null, color: 'bg-emerald-500', negative: false, bold: false },
                { label: 'Operating Expenses', val: parseFloat(lf.total_operating_expenses as string) || null, color: 'bg-red-400', negative: true, bold: false },
                { label: 'Net Operating Income', val: parseFloat(lf.noi as string) || null, color: 'bg-blue-500', negative: false, bold: true },
              ] as { label: string; val: number | null; color: string; negative: boolean; bold: boolean }[]).map(row => {
                const base = parseFloat(lf.effective_gross_income as string) || 1;
                const width = row.val ? Math.min(100, Math.abs(row.val) / base * 100) : 0;
                return (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className={row.bold ? 'font-semibold text-stone-800' : 'text-stone-500'}>{row.label}</span>
                      <span className={`font-mono ${row.negative ? 'text-red-600' : 'text-stone-800'}`}>{fmtD(row.val)}</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded overflow-hidden">
                      <div className={`h-full ${row.color} rounded`} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-stone-100 text-xs text-stone-400">Annualized NOI: <span className="text-stone-700 font-semibold">{fmtD(annNoi)}</span></div>
            </div>
          )}
        </div>

        {/* 2. Deal Performance */}
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Deal Performance</div>
          <div className="space-y-3">
            {([
              { label: 'Underwritten IRR', val: deal.target_irr != null ? fmtP((deal.target_irr as number) / 100) : deal.irr != null ? fmtP((deal.irr as number) / 100) : '—' },
              { label: 'Equity Multiple (UW)', val: deal.equity_multiple != null ? `${parseFloat(deal.equity_multiple as string).toFixed(2)}×` : '—' },
              { label: 'Avg Occupancy (Actuals)', val: fmtP(avgOcc) },
              { label: 'Months of Actuals', val: String(financials.length) },
              { label: 'Latest NOI/mo', val: fmtD(lf ? parseFloat(lf.noi as string) : null) },
              { label: 'Annualized NOI', val: fmtD(annNoi) },
            ] as { label: string; val: string }[]).map(row => (
              <div key={row.label} className="flex justify-between text-xs">
                <span className="text-stone-500">{row.label}</span>
                <span className="font-semibold text-stone-800">{row.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Debt Summary */}
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Debt Summary</div>
          <div className="space-y-3">
            {([
              { label: 'Loan Amount', val: deal.loan_amount != null ? fmtD(parseFloat(deal.loan_amount as string)) : '—' },
              { label: 'Interest Rate', val: deal.loan_rate != null ? fmtP(parseFloat(deal.loan_rate as string) / 100) : '—' },
              { label: 'Loan Term', val: deal.loan_term != null ? `${deal.loan_term} yrs` : '—' },
              { label: 'LTV (at close)', val: deal.ltv != null ? fmtP(parseFloat(deal.ltv as string) / 100) : (deal.loan_amount && deal.purchase_price ? fmtP(parseFloat(deal.loan_amount as string) / parseFloat(deal.purchase_price as string)) : '—') },
              { label: 'DSCR (UW)', val: deal.dscr != null ? `${parseFloat(deal.dscr as string).toFixed(2)}×` : '—' },
              { label: 'Lender', val: (deal.lender as string) ?? '—' },
            ] as { label: string; val: string }[]).map(row => (
              <div key={row.label} className="flex justify-between text-xs">
                <span className="text-stone-500">{row.label}</span>
                <span className="font-semibold text-stone-800">{row.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Underwriting Accuracy */}
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Underwriting Accuracy</div>
          {accuracy.length === 0 ? (
            <div className="text-xs text-stone-400">{financials.length === 0 ? 'Requires actuals data' : 'No prediction outcomes recorded yet'}</div>
          ) : (
            <div className="space-y-2">
              {accuracy.slice(0, 4).map(a => (
                <div key={a.assumptionName}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="capitalize text-stone-600">{a.assumptionName}</span>
                    <span className={`font-mono font-semibold ${a.hitRate10Pct >= 70 ? 'text-emerald-600' : a.hitRate10Pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{a.hitRate10Pct.toFixed(0)}% within 10%</span>
                  </div>
                  <div className="h-1.5 bg-stone-100 rounded overflow-hidden">
                    <div className={`h-full rounded ${a.hitRate10Pct >= 70 ? 'bg-emerald-500' : a.hitRate10Pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${a.hitRate10Pct}%` }} />
                  </div>
                </div>
              ))}
              <div className="pt-2 text-xs text-stone-400">{accuracy.reduce((s, a) => s + a.nPredictions, 0)} total predictions evaluated</div>
            </div>
          )}
        </div>

        {/* 5. Occupancy Trend */}
        <div className="bg-white border border-stone-200 rounded-lg p-5 col-span-2">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Occupancy Trend</div>
          {financials.length === 0 ? (
            <div className="text-xs text-stone-400">No actuals loaded yet</div>
          ) : (
            <>
              <div className="flex items-end gap-1" style={{ height: 64 }}>
                {financials.slice(-18).map((f, i) => {
                  const occ = Math.min(1, parseFloat(f.occupancy_rate as string) || 0);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${(occ * 100).toFixed(1)}%`}>
                      <div
                        className={`w-full rounded-t ${occ >= 0.93 ? 'bg-emerald-500' : occ >= 0.85 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ height: `${occ * 100}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-stone-400 mt-1">
                <span>{financials.length > 18 ? (financials[financials.length - 18]?.period_label as string | undefined) ?? '18 mo ago' : 'Earliest'}</span>
                <span className="font-semibold text-stone-700">Avg {fmtP(avgOcc)} occupancy over {financials.length} months</span>
                <span>Latest</span>
              </div>
            </>
          )}
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
    const noiData = financials.map(f => toNum(f.noi) || 0);
    const occData = financials.map(f => (toNum(f.occupancy_rate) || 0) * 100);
    const revenueData = financials.map(f => toNum(f.net_rental_income) || 0);
    const opexData = financials.map(f => toNum(f.total_opex) || 0);

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
                const rev = toNum(f.net_rental_income) || 0;
                const exp = toNum(f.total_opex) || 0;
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
                    <td className="px-3 py-1.5 text-right text-stone-600">{fmt(toNum(f.gross_potential_rent), 'currency')}</td>
                    <td className="px-3 py-1.5 text-right text-stone-600">{fmt(toNum(f.net_rental_income), 'currency')}</td>
                    <td className="px-3 py-1.5 text-right text-red-600">{fmt(toNum(f.total_opex), 'currency')}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-blue-700">{fmt(toNum(f.noi), 'currency')}</td>
                    <td className="px-3 py-1.5 text-right text-stone-500">{fmt(toNum(f.noi_per_unit), 'currency')}</td>
                    <td className="px-3 py-1.5 text-right text-stone-500">{fmt(toNum(f.capex), 'currency')}</td>
                    <td className="px-3 py-1.5 text-right text-stone-500">{fmt(toNum(f.debt_service), 'currency')}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold ${toNum(f.cash_flow_before_tax) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {fmt(toNum(f.cash_flow_before_tax), 'currency')}
                    </td>
                    <td className="px-3 py-1.5 text-right text-stone-600">{fmt(toNum(f.occupancy_rate) * 100, 'percent', 1)}</td>
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
    const newRentData = ms.map(m => toNum(m.avg_new_rent) || 0);
    const renewalRentData = ms.map(m => toNum(m.avg_renewal_rent) || 0);
    const ltlData = ms.map(m => toNum(m.avg_loss_to_lease_pct) || 0);
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
    const trafficNums = last52.map(w => toNum(w.traffic) || 0);
    const closingNums = last52.map(w => toNum(w.closing_ratio) || 0);
    const occNums = last52.map(w => toNum(w.occ_pct) || 0);

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
          <MiniLineChart data={trafficData.map(w => toNum(w.occ_pct) || 0)} color="#7c3aed" height={100} />
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
            <EventTimelineSection dealId={dealId!} deal={deal} />
          </div>
        )}
        {activeTab === 'documents'    && (
          <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <DocumentsSection deal={deal as unknown as Deal} />
          </div>
        )}
        {activeTab === 'reports'      && (
          <ReportsTab dealId={dealId!} financials={financials} deal={deal} />
        )}
        {activeTab === 'deal-team'    && (
          <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            <TeamSection deal={{ ...deal, status: deal.status || 'owned' } as unknown as Deal} />
          </div>
        )}
      </div>
    </div>
  );
}
