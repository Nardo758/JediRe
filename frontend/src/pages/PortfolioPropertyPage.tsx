import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';

type TabType = 'overview' | 'leasing' | 'unit-mix' | 'traffic';

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

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: 'Financial Overview', icon: '📊' },
    { id: 'leasing', label: 'Leasing', icon: '📋' },
    { id: 'unit-mix', label: 'Unit Mix', icon: '🏠' },
    { id: 'traffic', label: 'Traffic', icon: '🚶' },
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

      <div className="flex items-center gap-1 px-6 pb-2 flex-shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'leasing' && renderLeasing()}
        {activeTab === 'unit-mix' && renderUnitMix()}
        {activeTab === 'traffic' && renderTraffic()}
      </div>
    </div>
  );
}
