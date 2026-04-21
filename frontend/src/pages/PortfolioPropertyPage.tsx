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
import { ConvergenceChart, RSSBreakdownCards, Q_LABELS, RSS_21Y, OPTIMAL_FWD, NOW_IDX as CONV_NOW_IDX } from '../components/deal/sections/ConvergenceChart';

// ─── Bloomberg Terminal Theme ─────────────────────────────────
const T = {
  bg: { terminal:'#0A0E17', panel:'#0F1319', panelAlt:'#131821', header:'#1A1F2E', hover:'#1E2538', active:'#252D40', input:'#0D1117' },
  text: { primary:'#E8ECF1', secondary:'#8B95A5', muted:'#4A5568', amber:'#F5A623', green:'#00D26A', red:'#FF4757', cyan:'#00BCD4', orange:'#FF8C42', purple:'#A78BFA', white:'#FFFFFF', blue:'#4A9EFF' },
  border: { subtle:'#1E2538', medium:'#2A3348', bright:'#3B4A6B' },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

type TabType =
  | 'overview' | 'performance' | 'comp-set'
  | 'leasing' | 'unit-mix' | 'traffic'
  | 'ops-intel' | 'revenue' | 'actuals'
  | 'investors' | 'lifecycle' | 'exit-timing' | 'refi-monitor'
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
  avg_market_rent: number | string;
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
  avg_loss_to_lease_pct: number;
}

interface TrafficWeek {
  week_ending: string;
  traffic: number | string;
  closing_ratio: number | string;
  occ_pct: number | string;
}

const fmt = (v: number | null | undefined, type: 'currency' | 'percent' | 'number' = 'number', decimals = 0): string => {
  if (v == null || isNaN(v)) return '—';
  if (type === 'currency') return `$${v >= 1_000_000 ? (v / 1_000_000).toFixed(2) + 'M' : v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toFixed(0)}`;
  if (type === 'percent') return `${v.toFixed(decimals)}%`;
  return v.toLocaleString('en-US', { maximumFractionDigits: decimals });
};
const fmtMonth = (s: string) => { try { return new Date(s).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); } catch { return s; } };
const fmtP = (v: number | null) => v == null ? '—' : `${(v * 100).toFixed(1)}%`;

// ─── Chart Components ─────────────────────────────────────────
const MiniBarChart = ({ data, color = T.text.blue, height = 80 }: { data: number[]; color?: string; height?: number }) => {
  if (!data.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text.muted, fontSize: 10, fontFamily: T.font.mono }}>NO DATA</div>;
  const max = Math.max(...data, 1);
  return (
    <svg viewBox={`0 0 ${data.length * 6} ${height}`} style={{ width: '100%', height }}>
      {data.map((v, i) => {
        const barH = Math.max(2, (v / max) * (height - 4));
        return <rect key={i} x={i * 6 + 0.5} y={height - barH} width={5} height={barH} fill={color} opacity={0.85} rx={1} />;
      })}
    </svg>
  );
};

const MiniLineChart = ({ data, color = T.text.blue, height = 80 }: { data: number[]; color?: string; height?: number }) => {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * 100},${height - ((v - min) / range) * (height - 10) - 5}`).join(' ');
  return (
    <svg viewBox={`0 0 100 ${height}`} style={{ width: '100%', height }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
};

// ─── Shared panel component ───────────────────────────────────
const Panel: React.FC<{ title?: string; titleColor?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ title, titleColor, children, style }) => (
  <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, overflow: 'hidden', ...style }}>
    {title && (
      <div style={{ padding: '6px 12px', background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, fontSize: 10, fontWeight: 700, color: titleColor || T.text.amber, fontFamily: T.font.mono, letterSpacing: '0.05em' }}>
        {title}
      </div>
    )}
    {children}
  </div>
);

// ─── Spinner ──────────────────────────────────────────────────
const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
    <div style={{ width: 28, height: 28, border: `2px solid ${T.border.medium}`, borderTopColor: T.text.amber, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ─── CompSet Tab ─────────────────────────────────────────────
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

  const inputStyle: React.CSSProperties = { width: '100%', fontSize: 11, padding: '4px 8px', background: T.bg.input, border: `1px solid ${T.border.medium}`, color: T.text.primary, borderRadius: 3, outline: 'none', fontFamily: T.font.mono };

  return (
    <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={discover} disabled={discovering} style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, background: T.text.amber, color: '#000', border: 'none', borderRadius: 3, cursor: 'pointer', fontFamily: T.font.mono, opacity: discovering ? 0.6 : 1 }}>
          {discovering ? '⟳ DISCOVERING...' : '⚡ AUTO-DISCOVER COMPS'}
        </button>
        <button onClick={() => setShowAddForm(f => !f)} style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, background: T.bg.active, color: T.text.cyan, border: `1px solid ${T.border.medium}`, borderRadius: 3, cursor: 'pointer', fontFamily: T.font.mono }}>
          + ADD MANUALLY
        </button>
        {msg && <span style={{ fontSize: 10, color: msg.includes('failed') || msg.includes('Failed') ? T.text.red : T.text.green, fontFamily: T.font.mono }}>{msg}</span>}
      </div>

      {showAddForm && (
        <Panel title="NEW COMPETITIVE PROPERTY" titleColor={T.text.cyan}>
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
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
                <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 3 }}>{f.label}</div>
                <input type="text" placeholder={f.placeholder} value={formData[f.key]} onChange={e => setFormData(d => ({ ...d, [f.key]: e.target.value }))} style={inputStyle} />
              </div>
            ))}
          </div>
          <div style={{ padding: '8px 12px', display: 'flex', gap: 8, borderTop: `1px solid ${T.border.subtle}` }}>
            <button onClick={addComp} disabled={adding} style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, background: T.text.cyan, color: '#000', border: 'none', borderRadius: 3, cursor: 'pointer', fontFamily: T.font.mono, opacity: adding ? 0.6 : 1 }}>
              {adding ? 'SAVING...' : 'ADD TO COMP SET'}
            </button>
            <button onClick={() => setShowAddForm(false)} style={{ padding: '5px 12px', fontSize: 10, color: T.text.secondary, background: 'transparent', border: `1px solid ${T.border.subtle}`, borderRadius: 3, cursor: 'pointer', fontFamily: T.font.mono }}>
              CANCEL
            </button>
          </div>
        </Panel>
      )}

      {loading ? <Spinner /> : comps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.text.muted, fontFamily: T.font.mono, fontSize: 11 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🏙</div>
          <div>NO COMPS TRACKED YET</div>
          <div style={{ fontSize: 10, marginTop: 4, color: T.text.muted }}>Add properties to this asset's competitive set above</div>
        </div>
      ) : (
        <Panel title="COMPETITIVE SET">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
            <thead>
              <tr style={{ background: T.bg.panelAlt }}>
                {['PROPERTY', 'UNITS', 'YR BUILT', 'DISTANCE', 'AVG RENT', 'OCCUPANCY', 'TIER', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: T.text.muted, fontWeight: 600, letterSpacing: '0.04em', fontSize: 9 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comps.map((c: any, i: number) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                  <td style={{ padding: '8px 10px', color: T.text.primary, fontWeight: 500 }}>{c.comp_name || c.property_name || '—'}</td>
                  <td style={{ padding: '8px 10px', color: T.text.secondary }}>{c.units ?? '—'}</td>
                  <td style={{ padding: '8px 10px', color: T.text.secondary }}>{c.year_built ?? '—'}</td>
                  <td style={{ padding: '8px 10px', color: T.text.secondary }}>{c.distance_miles != null ? `${Number(c.distance_miles).toFixed(1)} mi` : '—'}</td>
                  <td style={{ padding: '8px 10px', color: T.text.green }}>{fmt$(c.avg_rent)}</td>
                  <td style={{ padding: '8px 10px', color: T.text.cyan }}>{fmtPct(c.occupancy_rate)}</td>
                  <td style={{ padding: '8px 10px' }}>
                    {c.tier && (
                      <span style={{ padding: '2px 6px', background: c.tier === 1 ? '#4A9EFF22' : c.tier === 2 ? '#F5A62322' : '#4A556822', color: c.tier === 1 ? T.text.blue : c.tier === 2 ? T.text.amber : T.text.secondary, borderRadius: 3, fontWeight: 600, fontSize: 9 }}>
                        T{c.tier}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <button onClick={() => removeComp(c.id)} style={{ color: T.text.red, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
};

// ─── Performance Tab ──────────────────────────────────────────
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
    <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {(['mtd', 'qtd', 'ytd', 'ltm'] as const).map(tf => (
          <button key={tf} onClick={() => setTimeframe(tf)} style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, background: timeframe === tf ? T.text.amber : T.bg.active, color: timeframe === tf ? '#000' : T.text.secondary, border: `1px solid ${timeframe === tf ? T.text.amber : T.border.medium}`, borderRadius: 3, cursor: 'pointer', fontFamily: T.font.mono }}>
            {tf.toUpperCase()}
          </button>
        ))}
        <span style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono, marginLeft: 8 }}>{filtered.length} month{filtered.length !== 1 ? 's' : ''} of data</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[
          { label: 'TOTAL NOI', value: fmt$(totNOI), color: T.text.blue },
          { label: 'TOTAL REVENUE', value: fmt$(totRev), color: T.text.primary },
          { label: 'TOTAL OPEX', value: fmt$(totOpex), color: T.text.red },
          { label: 'AVG OCCUPANCY', value: avgOcc != null ? `${avgOcc.toFixed(1)}%` : '—', color: T.text.green },
        ].map((k, i) => (
          <div key={i} style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
            <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.color, fontFamily: T.font.mono }}>{k.value}</div>
          </div>
        ))}
      </div>

      {pvaLoading ? <Spinner /> : pvaData.length > 0 ? (
        <Panel title="PROJECTED VS ACTUAL — NOI">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
            <thead>
              <tr style={{ background: T.bg.panelAlt }}>
                {['MONTH', 'PROJECTED NOI', 'ACTUAL NOI', 'VARIANCE $', 'VARIANCE %', 'PROJ OCC', 'ACTUAL OCC'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: T.text.muted, fontWeight: 600, fontSize: 9 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pvaData.map((row: any, i: number) => {
                const varD = (row.actual_noi ?? 0) - (row.projected_noi ?? 0);
                const varPct = row.projected_noi ? (varD / row.projected_noi) * 100 : null;
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                    <td style={{ padding: '6px 10px', color: T.text.primary, fontWeight: 600 }}>{row.report_month?.slice(0, 7)}</td>
                    <td style={{ padding: '6px 10px', color: T.text.secondary }}>{fmt$(row.projected_noi)}</td>
                    <td style={{ padding: '6px 10px', color: T.text.primary }}>{fmt$(row.actual_noi)}</td>
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: varD >= 0 ? T.text.green : T.text.red }}>{varD >= 0 ? '+' : ''}{fmt$(varD)}</td>
                    <td style={{ padding: '6px 10px', color: (varPct ?? 0) >= 0 ? T.text.green : T.text.red }}>{varPct != null ? `${varPct >= 0 ? '+' : ''}${varPct.toFixed(1)}%` : '—'}</td>
                    <td style={{ padding: '6px 10px', color: T.text.secondary }}>{row.projected_occupancy != null ? `${(Number(row.projected_occupancy) * 100).toFixed(1)}%` : '—'}</td>
                    <td style={{ padding: '6px 10px', color: T.text.secondary }}>{row.actual_occupancy != null ? `${(Number(row.actual_occupancy) * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      ) : (
        <Panel>
          <div style={{ textAlign: 'center', padding: 32, color: T.text.muted, fontFamily: T.font.mono, fontSize: 10 }}>NO VARIANCE DATA YET — ADD MONTHLY ACTUALS TO ENABLE COMPARISON</div>
        </Panel>
      )}

      {filtered.length > 0 && (
        <Panel title="MONTHLY P&L DETAIL">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
            <thead>
              <tr style={{ background: T.bg.panelAlt }}>
                {['MONTH', 'NOI', 'OCC %', 'AVG RENT', 'OPEX', 'CASH FLOW'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: T.text.muted, fontWeight: 600, fontSize: 9 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                  <td style={{ padding: '6px 10px', color: T.text.primary, fontWeight: 600 }}>{f.report_month?.slice(0, 7)}</td>
                  <td style={{ padding: '6px 10px', color: T.text.blue, fontWeight: 600 }}>{fmt$(toNum(f.noi))}</td>
                  <td style={{ padding: '6px 10px', color: T.text.secondary }}>{f.occupancy_rate != null ? `${(Number(f.occupancy_rate) * 100).toFixed(1)}%` : '—'}</td>
                  <td style={{ padding: '6px 10px', color: T.text.secondary }}>{fmt$(toNum(f.avg_effective_rent))}</td>
                  <td style={{ padding: '6px 10px', color: T.text.red }}>{fmt$(toNum(f.total_opex))}</td>
                  <td style={{ padding: '6px 10px', fontWeight: 600, color: toNum(f.cash_flow_before_tax) < 0 ? T.text.red : T.text.green }}>{fmt$(toNum(f.cash_flow_before_tax))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
};

// ─── Revenue Management Tab ───────────────────────────────────
const RevenueMgmtTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [subTab, setSubTab] = useState<'rent-roll' | 'other-income'>('rent-roll');
  const [rentRoll, setRentRoll] = useState<{ units: any[]; snapshots: string[] } | null>(null);
  const [otherIncome, setOtherIncome] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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

  const subTabs = [
    { id: 'rent-roll', label: 'RENT ROLL' },
    { id: 'other-income', label: 'OTHER INCOME' },
  ] as const;

  const emptyState = (icon: string, msg: string, sub?: string) => (
    <div style={{ textAlign: 'center', padding: '48px 0', color: T.text.muted, fontFamily: T.font.mono, fontSize: 11 }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div>{msg}</div>
      {sub && <div style={{ fontSize: 10, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {subTabs.map(s => (
          <button key={s.id} onClick={() => setSubTab(s.id)} style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, background: subTab === s.id ? T.bg.active : 'transparent', color: subTab === s.id ? T.text.cyan : T.text.muted, border: `1px solid ${subTab === s.id ? T.text.cyan : T.border.subtle}`, borderRadius: 3, cursor: 'pointer', fontFamily: T.font.mono }}>
            {s.label}
          </button>
        ))}
      </div>

      {loading && <Spinner />}

      {!loading && subTab === 'rent-roll' && (
        !rentRoll || rentRoll.units.length === 0 ? emptyState('📋', 'NO RENT ROLL IMPORTED', 'Use the Actuals tab to import rent roll snapshots') : (
          <Panel title="RENT ROLL">
            {rentRoll.snapshots.length > 0 && (
              <div style={{ padding: '6px 12px', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, borderBottom: `1px solid ${T.border.subtle}` }}>Snapshots: {rentRoll.snapshots.join(', ')}</div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
              <thead>
                <tr style={{ background: T.bg.panelAlt }}>
                  {['UNIT', 'TYPE', 'STATUS', 'CURRENT RENT', 'MARKET RENT', 'LTL $', 'LEASE END'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: T.text.muted, fontWeight: 600, fontSize: 9 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rentRoll.units.slice(0, 200).map((u: any, i: number) => {
                  const ltl = u.current_rent && u.market_rent ? Number(u.current_rent) - Number(u.market_rent) : null;
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                      <td style={{ padding: '6px 10px', color: T.text.primary, fontWeight: 600 }}>{u.unit_number}</td>
                      <td style={{ padding: '6px 10px', color: T.text.secondary }}>{u.unit_type}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <span style={{ padding: '2px 6px', background: u.status === 'occupied' ? '#00D26A22' : u.status === 'vacant' ? '#FF475722' : '#F5A62322', color: u.status === 'occupied' ? T.text.green : u.status === 'vacant' ? T.text.red : T.text.amber, borderRadius: 3, fontSize: 9, fontWeight: 600 }}>
                          {u.status?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px', color: T.text.primary }}>{fmt$(u.current_rent)}</td>
                      <td style={{ padding: '6px 10px', color: T.text.secondary }}>{fmt$(u.market_rent)}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 600, color: ltl != null && ltl < 0 ? T.text.red : T.text.green }}>{fmt$(ltl)}</td>
                      <td style={{ padding: '6px 10px', color: T.text.secondary }}>{u.lease_end?.slice(0, 10) ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        )
      )}

      {!loading && subTab === 'other-income' && (
        otherIncome.length === 0 ? emptyState('💰', 'NO OTHER INCOME DATA', 'Import parking, pet fees, storage, and ancillary income') : (
          <Panel title="OTHER INCOME TRACKING">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
              <thead>
                <tr style={{ background: T.bg.panelAlt }}>
                  {['PERIOD', 'PARKING', 'PET FEES', 'PET RENT', 'STORAGE', 'APP FEES', 'LATE FEES', 'UTIL REIMB', 'OTHER', 'TOTAL'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: T.text.muted, fontWeight: 600, fontSize: 9 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {otherIncome.map((row: any, i: number) => {
                  const total = [row.parking, row.pet_fees, row.pet_rent, row.storage, row.application_fees, row.late_fees, row.utility_reimbursement, row.other]
                    .reduce((s, v) => s + (Number(v) || 0), 0);
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                      <td style={{ padding: '6px 10px', color: T.text.primary, fontWeight: 600 }}>{row.period_start?.slice(0, 7)}</td>
                      {[row.parking, row.pet_fees, row.pet_rent, row.storage, row.application_fees, row.late_fees, row.utility_reimbursement, row.other].map((v, j) => (
                        <td key={j} style={{ padding: '6px 10px', color: T.text.secondary }}>{fmt$(v)}</td>
                      ))}
                      <td style={{ padding: '6px 10px', color: T.text.green, fontWeight: 600 }}>{fmt$(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        )
      )}

    </div>
  );
};

// ─── Exit Timing Tab ──────────────────────────────────────────
const ExitTimingTab: React.FC<{ dealId: string }> = () => {
  const [selectedFwd, setSelectedFwd] = useState(OPTIMAL_FWD);
  const selAbsIdx = CONV_NOW_IDX + selectedFwd;
  const selRSS = RSS_21Y[selAbsIdx];
  const selLabel = Q_LABELS[selAbsIdx]?.label ?? '';
  const rssColor = (v: number) => v >= 70 ? '#68D391' : v >= 50 ? '#F6E05E' : '#FC8181';
  const fwdYears = (selectedFwd / 4).toFixed(1);
  const T2 = {
    mono: '"JetBrains Mono",monospace',
    panel: '#0F1319',
    border: 'rgba(255,255,255,0.06)',
    dim: 'rgba(232,230,225,0.35)',
    muted: 'rgba(232,230,225,0.18)',
  };

  return (
    <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: T2.mono, color: '#E8E6E1', letterSpacing: 1 }}>21-YEAR CONVERGENCE CHART</div>
          <div style={{ fontSize: 9, color: T2.muted, fontFamily: T2.mono, marginTop: 2 }}>Rent growth · Cap rate · RSS · Supply — Q1 2016 → Q4 2036</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: T2.muted, fontFamily: T2.mono }}>SELECTED EXIT</div>
            <div style={{ fontSize: 13, fontWeight: 800, fontFamily: T2.mono, color: '#63B3ED' }}>{selLabel}</div>
            <div style={{ fontSize: 9, color: T2.dim, fontFamily: T2.mono }}>{fwdYears}yr from now</div>
          </div>
          <div style={{ width: 64, height: 64, borderRadius: '50%', border: `3px solid ${rssColor(selRSS?.rss ?? 0)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(11,14,19,0.8)' }}>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: T2.mono, color: rssColor(selRSS?.rss ?? 0) }}>{selRSS?.rss ?? '--'}</div>
            <div style={{ fontSize: 7, color: T2.muted, fontFamily: T2.mono }}>RSS</div>
          </div>
        </div>
      </div>

      {/* RSS breakdown cards for selected quarter */}
      {selRSS && <RSSBreakdownCards rssData={selRSS} />}

      {/* Chart */}
      <div style={{ background: T2.panel, border: `1px solid ${T2.border}`, borderRadius: 6, padding: 12 }}>
        <ConvergenceChart selectedFwd={selectedFwd} onSelectFwd={setSelectedFwd} optimalFwd={OPTIMAL_FWD} />
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 8, fontSize: 9, color: T2.muted, fontFamily: T2.mono, textAlign: 'center' }}>
        Click any projected quarter to inspect exit conditions · RSS = Readiness to Sell Score (market-driven, 0–100)
      </div>
    </div>
  );
};

// ─── Refi Monitor Tab ─────────────────────────────────────────
interface RefiForm {
  scenarioName: string;
  assumedNoi: string;
  assumedCapRate: string;
  existingBalance: string;
  assumedSpreadBps: string;
  maxLtv: string;
  minDscr: string;
  minDebtYield: string;
}

interface RefiResult {
  maxLoanByLtv: number;
  maxLoanByDscr: number;
  maxLoanByDy: number;
  constrainedBy: string;
  maxLoanProceeds: number;
  cashOutAvailable: number;
  newDebtService: number;
  dscrPostRefi: number;
  debtYieldPostRefi: number;
  ltvPostRefi: number;
  isFeasible: boolean;
  feasibilityNotes?: string;
}

interface RefiScenarioRow {
  id: string;
  scenario_name: string;
  scenario_type: string;
  test_date: string;
  assumed_noi: number;
  assumed_cap_rate: number;
  constrained_by: string;
  max_loan_proceeds: number;
  cash_out_available: number;
  dscr_post_refi: number;
  is_feasible: boolean;
}

const RefiMonitorTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const T2 = {
    mono: '"JetBrains Mono",monospace',
    panel: '#0F1319',
    panelAlt: '#131821',
    border: 'rgba(255,255,255,0.06)',
    borderActive: 'rgba(99,179,237,0.35)',
    dim: 'rgba(232,230,225,0.55)',
    muted: 'rgba(232,230,225,0.25)',
    input: '#0D1117',
  };

  const [form, setForm] = useState<RefiForm>({
    scenarioName: 'Q2 2026 Refi Test',
    assumedNoi: '',
    assumedCapRate: '5.0',
    existingBalance: '',
    assumedSpreadBps: '185',
    maxLtv: '75',
    minDscr: '1.25',
    minDebtYield: '8.0',
  });
  const [result, setResult] = useState<RefiResult | null>(null);
  const [history, setHistory] = useState<RefiScenarioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [histLoading, setHistLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get(`/api/v1/lifecycle/${dealId}/refi-test`)
      .then((res: any) => setHistory(res.data?.scenarios ?? []))
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, [dealId]);

  const runTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        scenarioName: form.scenarioName,
        scenarioType: 'operational',
        assumedNoi: parseFloat(form.assumedNoi),
        assumedValue: form.assumedNoi && form.assumedCapRate
          ? parseFloat(form.assumedNoi) / (parseFloat(form.assumedCapRate) / 100)
          : undefined,
        assumedCapRate: parseFloat(form.assumedCapRate) / 100,
        existingBalance: form.existingBalance ? parseFloat(form.existingBalance) : undefined,
        assumedSpreadBps: parseFloat(form.assumedSpreadBps),
        maxLtv: parseFloat(form.maxLtv) / 100,
        minDscr: parseFloat(form.minDscr),
        minDebtYield: parseFloat(form.minDebtYield) / 100,
      };
      const res: any = await apiClient.post(`/api/v1/lifecycle/${dealId}/refi-test`, payload);
      if (res.data?.success) {
        setResult(res.data.result);
        // Refresh history
        const hRes: any = await apiClient.get(`/api/v1/lifecycle/${dealId}/refi-test`);
        setHistory(hRes.data?.scenarios ?? []);
      } else {
        setError(res.data?.error ?? 'Test failed');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = {
    background: T2.input,
    border: `1px solid ${T2.border}`,
    borderRadius: 4,
    padding: '6px 10px',
    fontSize: 11,
    fontFamily: T2.mono,
    color: '#E8E6E1',
    width: '100%',
    outline: 'none',
  };
  const labelStyle = { fontSize: 9, color: T2.muted, fontFamily: T2.mono, marginBottom: 3, display: 'block' as const };
  const constraintColor = (c: string) =>
    c?.toLowerCase().includes('ltv') ? '#FC8181' :
    c?.toLowerCase().includes('dscr') ? '#F6AD55' :
    c?.toLowerCase().includes('yield') ? '#B794F4' : '#63B3ED';

  const fm = (n: number | null | undefined, dec = 0) =>
    n == null ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: dec })}`;
  const fp = (n: number | null | undefined, dec = 2) =>
    n == null ? '—' : `${(n * 100).toFixed(dec)}%`;

  return (
    <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, fontFamily: T2.mono, color: '#E8E6E1', letterSpacing: 1, marginBottom: 4 }}>REFI MONITOR — CONSTRAINT ENGINE</div>
      <div style={{ fontSize: 9, color: T2.muted, fontFamily: T2.mono, marginBottom: 16 }}>LTV · DSCR · Debt Yield — binding constraint determines max proceeds</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* ── Left: Form ── */}
        <div style={{ background: T2.panel, border: `1px solid ${T2.border}`, borderRadius: 6, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, fontFamily: T2.mono, color: '#63B3ED', marginBottom: 12, letterSpacing: 0.5 }}>RUN REFI TEST</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>SCENARIO NAME</label>
              <input style={fieldStyle} value={form.scenarioName} onChange={e => setForm(f => ({ ...f, scenarioName: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>ASSUMED NOI ($)</label>
              <input style={fieldStyle} type="number" placeholder="e.g. 850000" value={form.assumedNoi} onChange={e => setForm(f => ({ ...f, assumedNoi: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>ASSUMED CAP RATE (%)</label>
              <input style={fieldStyle} type="number" step="0.1" value={form.assumedCapRate} onChange={e => setForm(f => ({ ...f, assumedCapRate: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>EXISTING BALANCE ($)</label>
              <input style={fieldStyle} type="number" placeholder="0 if unencumbered" value={form.existingBalance} onChange={e => setForm(f => ({ ...f, existingBalance: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>SPREAD (bps)</label>
              <input style={fieldStyle} type="number" value={form.assumedSpreadBps} onChange={e => setForm(f => ({ ...f, assumedSpreadBps: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>MAX LTV (%)</label>
              <input style={fieldStyle} type="number" step="1" value={form.maxLtv} onChange={e => setForm(f => ({ ...f, maxLtv: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>MIN DSCR</label>
              <input style={fieldStyle} type="number" step="0.05" value={form.minDscr} onChange={e => setForm(f => ({ ...f, minDscr: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>MIN DEBT YIELD (%)</label>
              <input style={fieldStyle} type="number" step="0.1" value={form.minDebtYield} onChange={e => setForm(f => ({ ...f, minDebtYield: e.target.value }))} />
            </div>
          </div>
          {error && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.25)', borderRadius: 4, fontSize: 9, color: '#FC8181', fontFamily: T2.mono }}>{error}</div>
          )}
          <button
            onClick={runTest}
            disabled={loading || !form.assumedNoi}
            style={{ marginTop: 12, width: '100%', padding: '10px 0', background: loading ? 'rgba(99,179,237,0.12)' : 'rgba(99,179,237,0.18)', border: '1px solid rgba(99,179,237,0.4)', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: T2.mono, color: loading ? T2.muted : '#63B3ED', cursor: loading || !form.assumedNoi ? 'not-allowed' : 'pointer', letterSpacing: 0.5 }}
          >
            {loading ? 'RUNNING...' : 'RUN CONSTRAINT TEST →'}
          </button>
        </div>

        {/* ── Right: Result ── */}
        <div style={{ background: T2.panel, border: `1px solid ${result ? constraintColor(result.constrainedBy) + '40' : T2.border}`, borderRadius: 6, padding: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, fontFamily: T2.mono, color: result ? constraintColor(result.constrainedBy) : T2.muted, marginBottom: 12, letterSpacing: 0.5 }}>
            {result ? `BINDING CONSTRAINT: ${result.constrainedBy?.toUpperCase()}` : 'RESULTS'}
          </div>
          {!result && !loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: T2.muted, fontSize: 10, fontFamily: T2.mono }}>Run a test to see results</div>
          )}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: T2.dim, fontSize: 10, fontFamily: T2.mono }}>Computing constraints...</div>
          )}
          {result && !loading && (
            <>
              {/* Feasibility badge */}
              <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 3, background: result.isFeasible ? 'rgba(104,211,145,0.12)' : 'rgba(252,129,129,0.12)', border: `1px solid ${result.isFeasible ? '#68D39155' : '#FC818155'}`, fontSize: 9, fontWeight: 700, fontFamily: T2.mono, color: result.isFeasible ? '#68D391' : '#FC8181', marginBottom: 14 }}>
                {result.isFeasible ? 'FEASIBLE' : 'NOT FEASIBLE'}
                {result.feasibilityNotes && <span style={{ fontWeight: 400, color: T2.muted, marginLeft: 8 }}>{result.feasibilityNotes}</span>}
              </div>

              {/* Constraint comparison */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: T2.muted, fontFamily: T2.mono, marginBottom: 6 }}>MAX LOAN BY CONSTRAINT</div>
                {[
                  { label: 'LTV', val: result.maxLoanByLtv, c: '#FC8181' },
                  { label: 'DSCR', val: result.maxLoanByDscr, c: '#F6AD55' },
                  { label: 'DEBT YIELD', val: result.maxLoanByDy, c: '#B794F4' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${T2.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.c }} />
                      <span style={{ fontSize: 9, fontFamily: T2.mono, color: T2.dim }}>{r.label}</span>
                      {result.constrainedBy?.toUpperCase().includes(r.label) && (
                        <span style={{ fontSize: 7, background: r.c + '22', border: `1px solid ${r.c}55`, color: r.c, fontFamily: T2.mono, borderRadius: 2, padding: '1px 4px' }}>BINDING</span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: T2.mono, color: '#E8E6E1' }}>{fm(r.val)}</span>
                  </div>
                ))}
              </div>

              {/* Key metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'MAX PROCEEDS', val: fm(result.maxLoanProceeds), c: '#63B3ED' },
                  { label: 'CASH OUT / (PAYDOWN)', val: result.cashOutAvailable >= 0 ? fm(result.cashOutAvailable) : `(${fm(-result.cashOutAvailable)})`, c: result.cashOutAvailable >= 0 ? '#68D391' : '#FC8181' },
                  { label: 'POST-REFI DSCR', val: result.dscrPostRefi ? result.dscrPostRefi.toFixed(2) + 'x' : '—', c: (result.dscrPostRefi ?? 0) >= 1.25 ? '#68D391' : '#FC8181' },
                  { label: 'ANNUAL DEBT SVC', val: fm(result.newDebtService), c: T2.dim },
                ].map(m => (
                  <div key={m.label} style={{ background: T2.panelAlt, border: `1px solid ${T2.border}`, borderRadius: 4, padding: '8px 10px' }}>
                    <div style={{ fontSize: 8, color: T2.muted, fontFamily: T2.mono, marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, fontFamily: T2.mono, color: m.c }}>{m.val}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── History ── */}
      <div style={{ marginTop: 16, background: T2.panel, border: `1px solid ${T2.border}`, borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T2.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: T2.mono, color: T2.dim, letterSpacing: 0.5 }}>SCENARIO HISTORY</span>
          <span style={{ fontSize: 9, color: T2.muted, fontFamily: T2.mono }}>Last 20 tests</span>
        </div>
        {histLoading && <div style={{ padding: 16, textAlign: 'center', fontSize: 9, color: T2.muted, fontFamily: T2.mono }}>Loading history...</div>}
        {!histLoading && history.length === 0 && <div style={{ padding: 16, textAlign: 'center', fontSize: 9, color: T2.muted, fontFamily: T2.mono }}>No scenarios run yet for this deal</div>}
        {!histLoading && history.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, fontFamily: T2.mono }}>
            <thead>
              <tr style={{ background: '#0A0E17' }}>
                {['DATE', 'NAME', 'TYPE', 'NOI', 'CAP', 'BINDING', 'MAX PROCEEDS', 'CASH OUT', 'DSCR', 'STATUS'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: h === 'MAX PROCEEDS' || h === 'CASH OUT' || h === 'NOI' ? 'right' : 'left', color: T2.muted, fontWeight: 700, borderBottom: `1px solid ${T2.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', borderBottom: `1px solid ${T2.border}` }}>
                  <td style={{ padding: '5px 10px', color: T2.muted }}>{new Date(row.test_date).toLocaleDateString()}</td>
                  <td style={{ padding: '5px 10px', color: '#E8E6E1' }}>{row.scenario_name}</td>
                  <td style={{ padding: '5px 10px', color: T2.muted }}>{row.scenario_type}</td>
                  <td style={{ padding: '5px 10px', textAlign: 'right', color: T2.dim }}>{row.assumed_noi ? `$${(row.assumed_noi / 1000).toFixed(0)}k` : '—'}</td>
                  <td style={{ padding: '5px 10px', textAlign: 'right', color: T2.dim }}>{row.assumed_cap_rate ? fp(row.assumed_cap_rate, 1) : '—'}</td>
                  <td style={{ padding: '5px 10px', color: constraintColor(row.constrained_by) }}>{row.constrained_by?.toUpperCase() ?? '—'}</td>
                  <td style={{ padding: '5px 10px', textAlign: 'right', color: '#E8E6E1' }}>{row.max_loan_proceeds ? `$${(row.max_loan_proceeds / 1000000).toFixed(2)}M` : '—'}</td>
                  <td style={{ padding: '5px 10px', textAlign: 'right', color: row.cash_out_available >= 0 ? '#68D391' : '#FC8181' }}>{row.cash_out_available != null ? (row.cash_out_available >= 0 ? `$${(row.cash_out_available / 1000).toFixed(0)}k` : `(${((-row.cash_out_available) / 1000).toFixed(0)}k)`) : '—'}</td>
                  <td style={{ padding: '5px 10px', color: (row.dscr_post_refi ?? 0) >= 1.25 ? '#68D391' : '#FC8181' }}>{row.dscr_post_refi ? row.dscr_post_refi.toFixed(2) + 'x' : '—'}</td>
                  <td style={{ padding: '5px 10px' }}>
                    <span style={{ padding: '2px 6px', borderRadius: 2, fontSize: 8, fontWeight: 700, background: row.is_feasible ? 'rgba(104,211,145,0.1)' : 'rgba(252,129,129,0.1)', border: `1px solid ${row.is_feasible ? '#68D39140' : '#FC818140'}`, color: row.is_feasible ? '#68D391' : '#FC8181' }}>
                      {row.is_feasible ? 'FEASIBLE' : 'INFEASIBLE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ─── AI Learning Tab ──────────────────────────────────────────
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
        assumptionName: String(row.assumption_name ?? '').replace(/_/g, ' '),
        hitRate10Pct: Number(row.hit_rate_10pct ?? 0) * 100,
        hitRate20Pct: Number(row.hit_rate_20pct ?? 0) * 100,
        meanBias: Number(row.mean_gap_pct ?? 0),
        nPredictions: Number(row.n_predictions ?? 0),
      }))))
      .catch(() => setAccuracy([]))
      .finally(() => setAccuracyLoading(false));
  }, [dealId]);

  const totPredictions = accuracy.reduce((s, a) => s + a.nPredictions, 0);
  const avgHit10 = accuracy.length ? accuracy.reduce((s, a) => s + a.hitRate10Pct, 0) / accuracy.length : null;
  const avgHit20 = accuracy.length ? accuracy.reduce((s, a) => s + a.hitRate20Pct, 0) / accuracy.length : null;
  const avgBias = accuracy.length ? accuracy.reduce((s, a) => s + a.meanBias, 0) / accuracy.length : null;

  return (
    <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {actuals && (
        <Panel title="LEARNING STATUS — THIS ASSET" titleColor={T.text.green}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: actuals.tier === 2 ? T.text.green : actuals.tier === 3 ? T.text.amber : T.text.muted, fontFamily: T.font.mono }}>Tier {actuals.tier}</div>
                <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono, marginTop: 2 }}>Evidence Layer Active</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: actuals.count >= 3 ? T.text.green : T.text.amber, fontFamily: T.font.mono }}>{actuals.count}</div>
                <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono, marginTop: 2 }}>Months Recorded</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: actuals.count >= 3 ? T.text.green : T.text.muted, fontFamily: T.font.mono }}>{actuals.count >= 3 ? '✓' : `${3 - actuals.count} more`}</div>
                <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono, marginTop: 2 }}>{actuals.count >= 3 ? 'Contributing to benchmarks' : 'Until Tier 2 activation'}</div>
              </div>
            </div>
            <p style={{ fontSize: 11, color: T.text.secondary, lineHeight: 1.6, fontFamily: T.font.mono }}>
              Monthly Actuals feed the CashFlow Agent's <span style={{ color: T.text.cyan }}>Tier {actuals.tier} evidence layer</span>.
              {actuals.count >= 3 ? " This asset's performance data is live and contributing to future underwriting benchmarks." : ` Record ${3 - actuals.count} more month${3 - actuals.count !== 1 ? 's' : ''} of actuals to activate Tier 2.`}
            </p>
          </div>
        </Panel>
      )}
      {accuracyLoading ? <Spinner /> : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Panel title="CASHFLOW AGENT ACCURACY — THIS ASSET">
            <div style={{ padding: 12 }}>
              {accuracy.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: T.text.muted, fontFamily: T.font.mono, fontSize: 10 }}>NO PREDICTION OUTCOMES RECORDED YET</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'HIT RATE (±10%)', value: avgHit10 != null ? `${avgHit10.toFixed(0)}%` : '—', color: (avgHit10 ?? 0) >= 70 ? T.text.green : T.text.amber },
                    { label: 'HIT RATE (±20%)', value: avgHit20 != null ? `${avgHit20.toFixed(0)}%` : '—', color: (avgHit20 ?? 0) >= 80 ? T.text.green : T.text.amber },
                    { label: 'MEAN BIAS', value: avgBias != null ? `${avgBias >= 0 ? '+' : ''}${avgBias.toFixed(1)}%` : '—', color: Math.abs(avgBias ?? 0) < 5 ? T.text.green : T.text.amber },
                    { label: 'TOTAL PREDICTIONS', value: totPredictions.toString(), color: T.text.primary },
                  ].map((m, i) => (
                    <div key={i} style={{ background: T.bg.panelAlt, borderRadius: 4, padding: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: m.color, fontFamily: T.font.mono }}>{m.value}</div>
                      <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginTop: 3 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
          <Panel title="BY ASSUMPTION TYPE">
            <div style={{ padding: 12 }}>
              {accuracy.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: T.text.muted, fontFamily: T.font.mono, fontSize: 10 }}>NO ASSUMPTION TRACKING DATA</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {accuracy.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${T.border.subtle}`, fontSize: 10, fontFamily: T.font.mono }}>
                      <span style={{ color: T.text.secondary, textTransform: 'capitalize', width: 112 }}>{r.assumptionName}</span>
                      <span style={{ fontWeight: 600, color: r.hitRate10Pct >= 70 ? T.text.green : T.text.amber }}>{r.hitRate10Pct.toFixed(0)}%</span>
                      <span style={{ color: Math.abs(r.meanBias) < 5 ? T.text.green : T.text.amber }}>{r.meanBias >= 0 ? '+' : ''}{r.meanBias.toFixed(1)}%</span>
                      <span style={{ color: T.text.muted }}>n={r.nPredictions}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
};

// ─── Reports Tab ──────────────────────────────────────────────
interface ReportsTabProps {
  dealId: string;
  financials: MonthlyFinancial[];
  deal: Record<string, unknown>;
}
const ReportsTab: React.FC<ReportsTabProps> = ({ dealId, financials, deal }) => {

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
  const avgOcc = financials.length ? financials.reduce((s, f) => s + (parseFloat(f.occupancy_rate as string) || 0), 0) / financials.length : null;
  const annNoi = lf ? parseFloat(lf.noi as string) * 12 : null;
  const fmtD = (v: number | null) => v == null ? '—' : `$${v >= 1_000_000 ? (v / 1_000_000).toFixed(2) + 'M' : v.toLocaleString()}`;
  const fmtP2 = (v: number | null) => v == null ? '—' : `${(v * 100).toFixed(1)}%`;
  const btnStyle: React.CSSProperties = { padding: '5px 10px', fontSize: 10, fontWeight: 600, background: T.bg.active, color: T.text.secondary, border: `1px solid ${T.border.medium}`, borderRadius: 3, cursor: 'pointer', fontFamily: T.font.mono };

  return (
    <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono, fontWeight: 700, letterSpacing: '0.05em' }}>ASSET REPORTS — {propName.toUpperCase()}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={exportFinancials} disabled={financials.length === 0} style={{ ...btnStyle, opacity: financials.length === 0 ? 0.4 : 1 }}>⬇ MONTHLY CSV</button>
          <button onClick={exportInvestorSummary} disabled={financials.length === 0} style={{ ...btnStyle, opacity: financials.length === 0 ? 0.4 : 1 }}>⬇ INVESTOR CSV</button>
          <button onClick={exportRentRoll} style={btnStyle}>⬇ RENT ROLL CSV</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Panel title="NOI WATERFALL">
          <div style={{ padding: 12 }}>
            {!lf ? <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>NO ACTUALS LOADED YET</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([
                  { label: 'Eff. Gross Income', val: parseFloat(lf.effective_gross_income as string) || null, color: T.text.green, negative: false, bold: false },
                  { label: 'Operating Expenses', val: parseFloat(lf.total_operating_expenses as string) || null, color: T.text.red, negative: true, bold: false },
                  { label: 'Net Operating Income', val: parseFloat(lf.noi as string) || null, color: T.text.blue, negative: false, bold: true },
                ] as { label: string; val: number | null; color: string; negative: boolean; bold: boolean }[]).map(row => {
                  const base = parseFloat(lf.effective_gross_income as string) || 1;
                  const width = row.val ? Math.min(100, Math.abs(row.val) / base * 100) : 0;
                  return (
                    <div key={row.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: T.font.mono, marginBottom: 3 }}>
                        <span style={{ color: row.bold ? T.text.primary : T.text.secondary, fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
                        <span style={{ color: row.negative ? T.text.red : T.text.primary, fontWeight: 600 }}>{fmtD(row.val)}</span>
                      </div>
                      <div style={{ height: 4, background: T.bg.panelAlt, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: row.color, borderRadius: 2, width: `${width}%`, opacity: 0.8 }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ paddingTop: 8, borderTop: `1px solid ${T.border.subtle}`, fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>
                  Annualized NOI: <span style={{ color: T.text.amber, fontWeight: 600 }}>{fmtD(annNoi)}</span>
                </div>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="DEAL PERFORMANCE">
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              { label: 'Underwritten IRR', val: deal.target_irr != null ? fmtP2((deal.target_irr as number) / 100) : deal.irr != null ? fmtP2((deal.irr as number) / 100) : '—' },
              { label: 'Equity Multiple (UW)', val: deal.equity_multiple != null ? `${parseFloat(deal.equity_multiple as string).toFixed(2)}×` : '—' },
              { label: 'Avg Occupancy (Actuals)', val: fmtP2(avgOcc) },
              { label: 'Months of Actuals', val: String(financials.length) },
              { label: 'Latest NOI/mo', val: fmtD(lf ? parseFloat(lf.noi as string) : null) },
              { label: 'Annualized NOI', val: fmtD(annNoi) },
            ] as { label: string; val: string }[]).map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: T.font.mono, borderBottom: `1px solid ${T.border.subtle}`, paddingBottom: 6 }}>
                <span style={{ color: T.text.secondary }}>{row.label}</span>
                <span style={{ color: T.text.primary, fontWeight: 600 }}>{row.val}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="DEBT SUMMARY">
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              { label: 'Loan Amount', val: deal.loan_amount != null ? fmtD(parseFloat(deal.loan_amount as string)) : '—' },
              { label: 'Interest Rate', val: deal.loan_rate != null ? fmtP2(parseFloat(deal.loan_rate as string) / 100) : '—' },
              { label: 'Loan Term', val: deal.loan_term != null ? `${deal.loan_term} yrs` : '—' },
              { label: 'LTV (at close)', val: deal.ltv != null ? fmtP2(parseFloat(deal.ltv as string) / 100) : (deal.loan_amount && deal.purchase_price ? fmtP2(parseFloat(deal.loan_amount as string) / parseFloat(deal.purchase_price as string)) : '—') },
              { label: 'DSCR (UW)', val: deal.dscr != null ? `${parseFloat(deal.dscr as string).toFixed(2)}×` : '—' },
              { label: 'Lender', val: (deal.lender as string) ?? '—' },
            ] as { label: string; val: string }[]).map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: T.font.mono, borderBottom: `1px solid ${T.border.subtle}`, paddingBottom: 6 }}>
                <span style={{ color: T.text.secondary }}>{row.label}</span>
                <span style={{ color: T.text.primary, fontWeight: 600 }}>{row.val}</span>
              </div>
            ))}
          </div>
        </Panel>

      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: T.bg.terminal }}>
        <div style={{ width: 32, height: 32, border: `2px solid ${T.border.medium}`, borderTopColor: T.text.amber, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: T.bg.terminal, gap: 12, fontFamily: T.font.mono }}>
        <div style={{ color: T.text.red, fontSize: 14 }}>{error || 'PROPERTY NOT FOUND'}</div>
        <button onClick={() => navigate('/assets-owned')} style={{ color: T.text.cyan, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}>← Back to Assets Owned</button>
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
      { id: 'exit-timing',  short: 'Exit Timing' },
      { id: 'refi-monitor', short: 'Refi Monitor' },
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
      { label: 'ANNUAL NOI', value: fmt(annualNOI, 'currency'), sub: lf ? `${fmt(parseFloat(lf.noi), 'currency')}/mo` : '', color: T.text.blue },
      { label: 'OCCUPANCY', value: fmt(occ, 'percent', 1), sub: `${units} units`, color: T.text.green },
      { label: 'AVG EFF. RENT', value: fmt(avgRent, 'currency'), sub: lf ? `${fmt(parseFloat(lf.avg_market_rent), 'currency')} market` : '', color: T.text.cyan },
      { label: 'MONTHLY CASH FLOW', value: fmt(cashFlow, 'currency'), sub: debtSvc ? `${fmt(debtSvc, 'currency')} debt svc` : '', color: cashFlow && cashFlow < 0 ? T.text.red : T.text.green },
      { label: 'DSCR', value: debtSvc && debtSvc !== 0 && lf ? (parseFloat(lf.noi) / Math.abs(debtSvc)).toFixed(2) + 'x' : '—', sub: 'debt svc coverage', color: T.text.amber },
      { label: 'LOSS-TO-LEASE', value: fmt(ltl, 'percent', 1), sub: leaseStats ? `${fmt(parseFloat(leaseStats.avg_rent), 'currency')} avg rent` : '', color: ltl && ltl < -5 ? T.text.red : T.text.secondary },
    ];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, padding: '10px 16px', background: T.bg.panelAlt, borderBottom: `1px solid ${T.border.subtle}` }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.color, fontFamily: T.font.mono }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginTop: 2 }}>{k.sub}</div>}
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
      <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Panel title="NOI TREND" titleColor={T.text.blue}>
            <div style={{ padding: 12 }}>
              <MiniBarChart data={noiData} color={T.text.blue} height={120} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginTop: 4 }}>
                {financials.length > 0 && <span>{fmtMonth(financials[0].report_month)}</span>}
                {financials.length > 1 && <span>{fmtMonth(financials[financials.length - 1].report_month)}</span>}
              </div>
            </div>
          </Panel>
          <Panel title="OCCUPANCY TREND" titleColor={T.text.green}>
            <div style={{ padding: 12 }}>
              <MiniLineChart data={occData} color={T.text.green} height={120} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginTop: 4 }}>
                {financials.length > 0 && <span>{fmtMonth(financials[0].report_month)}</span>}
                {financials.length > 1 && <span>{fmtMonth(financials[financials.length - 1].report_month)}</span>}
              </div>
            </div>
          </Panel>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Panel title="REVENUE VS EXPENSES">
            <div style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 120 }}>
                {financials.map((f, i) => {
                  const rev = toNum(f.net_rental_income) || 0;
                  const exp = toNum(f.total_opex) || 0;
                  const max = Math.max(...revenueData, ...opexData, 1);
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ width: '100%', background: T.text.blue, borderRadius: '2px 2px 0 0', height: `${(rev / max) * 100}%`, minHeight: 2, opacity: 0.8 }} />
                      <div style={{ width: '100%', background: T.text.red, borderRadius: '2px 2px 0 0', height: `${(exp / max) * 100}%`, minHeight: 2, opacity: 0.6 }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: T.text.blue, borderRadius: 2, display: 'inline-block', opacity: 0.8 }} /> Revenue</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, background: T.text.red, borderRadius: 2, display: 'inline-block', opacity: 0.6 }} /> Expenses</span>
              </div>
            </div>
          </Panel>
          <Panel title="EXPENSE BREAKDOWN (LATEST MONTH)" titleColor={T.text.amber}>
            <div style={{ padding: 12 }}>
              {lf ? (() => {
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {expenses.map(e => (
                      <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontFamily: T.font.mono }}>
                        <span style={{ color: T.text.muted, width: 64, textAlign: 'right' }}>{e.label}</span>
                        <div style={{ flex: 1, background: T.bg.panelAlt, borderRadius: 2, height: 12, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: T.text.amber, borderRadius: 2, width: `${(e.value / max) * 100}%`, opacity: 0.8 }} />
                        </div>
                        <span style={{ color: T.text.secondary, width: 56, textAlign: 'right' }}>{fmt(e.value, 'currency')}</span>
                      </div>
                    ))}
                  </div>
                );
              })() : <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>NO ACTUALS LOADED</div>}
            </div>
          </Panel>
        </div>

      </div>
    );
  };

  const renderLeasing = () => {
    if (!leaseData) return <Spinner />;

    const ms = leaseData.monthlyStats;
    const newRentData = ms.map(m => toNum(m.avg_new_rent) || 0);
    const renewalRentData = ms.map(m => toNum(m.avg_renewal_rent) || 0);
    const ltlData = ms.map(m => toNum(m.avg_loss_to_lease_pct) || 0);
    const retData = leaseData.retentionByQuarter;

    return (
      <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Panel title="NEW LEASE RENT TREND" titleColor={T.text.blue}>
            <div style={{ padding: 12 }}>
              <MiniLineChart data={newRentData} color={T.text.blue} height={100} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginTop: 4 }}>
                {ms.length > 0 && <span>{fmtMonth(ms[0].month)}</span>}
                {ms.length > 1 && <span>{fmtMonth(ms[ms.length - 1].month)}</span>}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>
                <span>Peak: {fmt(Math.max(...newRentData), 'currency')}</span>
                <span>Current: {fmt(newRentData[newRentData.length - 1], 'currency')}</span>
              </div>
            </div>
          </Panel>
          <Panel title="LOSS-TO-LEASE TREND" titleColor={T.text.red}>
            <div style={{ padding: 12 }}>
              <MiniLineChart data={ltlData} color={T.text.red} height={100} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginTop: 4 }}>
                {ms.length > 0 && <span>{fmtMonth(ms[0].month)}</span>}
                {ms.length > 1 && <span>{fmtMonth(ms[ms.length - 1].month)}</span>}
              </div>
            </div>
          </Panel>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Panel title="RENEWAL RENT TREND" titleColor={T.text.purple}>
            <div style={{ padding: 12 }}>
              <MiniLineChart data={renewalRentData} color={T.text.purple} height={100} />
            </div>
          </Panel>
          <Panel title="RETENTION RATE BY QUARTER" titleColor={T.text.green}>
            <div style={{ padding: 12 }}>
              <MiniBarChart data={retData.map(r => parseFloat(r.retention_rate) || 0)} color={T.text.green} height={100} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginTop: 4 }}>
                {retData.length > 0 && <span>{retData[0].quarter?.substring(0, 7)}</span>}
                {retData.length > 1 && <span>{retData[retData.length - 1].quarter?.substring(0, 7)}</span>}
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="RECENT TRANSACTIONS">
          <div style={{ overflowX: 'auto', maxHeight: 400 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
              <thead style={{ position: 'sticky', top: 0, background: T.bg.panelAlt }}>
                <tr>
                  {['UNIT', 'TYPE', 'LEASE TYPE', 'START', 'SF', 'NEW RENT', 'PRIOR', 'MARKET', 'CHANGE', 'LTL %'].map((h, j) => (
                    <th key={h} style={{ textAlign: j < 4 ? 'left' : 'right', padding: '7px 10px', color: T.text.muted, fontWeight: 600, fontSize: 9 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaseData.recentTransactions.map((t: any, i: number) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                    <td style={{ padding: '6px 10px', color: T.text.primary, fontWeight: 600 }}>{t.unit_number}</td>
                    <td style={{ padding: '6px 10px', color: T.text.secondary }}>{t.unit_type}</td>
                    <td style={{ padding: '6px 10px' }}>
                      <span style={{ padding: '2px 6px', background: t.lease_type?.trim().toLowerCase() === 'new' ? '#4A9EFF22' : '#A78BFA22', color: t.lease_type?.trim().toLowerCase() === 'new' ? T.text.blue : T.text.purple, borderRadius: 3, fontSize: 9, fontWeight: 600 }}>
                        {t.lease_type?.trim().toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', color: T.text.secondary }}>{t.lease_start ? new Date(t.lease_start).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: T.text.secondary }}>{fmt(t.sqft)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: T.text.primary, fontWeight: 600 }}>{fmt(parseFloat(t.new_rent), 'currency')}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: T.text.secondary }}>{t.prior_rent ? fmt(parseFloat(t.prior_rent), 'currency') : '—'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: T.text.secondary }}>{fmt(parseFloat(t.market_rent), 'currency')}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: parseFloat(t.rent_change_dollar) > 0 ? T.text.green : parseFloat(t.rent_change_dollar) < 0 ? T.text.red : T.text.muted }}>
                      {t.rent_change_dollar ? `${parseFloat(t.rent_change_dollar) > 0 ? '+' : ''}${fmt(parseFloat(t.rent_change_dollar), 'currency')}` : '—'}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: parseFloat(t.loss_to_lease_pct) < -5 ? T.text.red : T.text.secondary }}>
                      {t.loss_to_lease_pct ? `${parseFloat(t.loss_to_lease_pct).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    );
  };

  const renderUnitMix = () => {
    const config = unitProgram?.unit_config || [];
    if (!config.length) {
      return (
        <div style={{ textAlign: 'center', padding: 48, color: T.text.muted, fontFamily: T.font.mono, fontSize: 11 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🏠</div>
          <div>NO UNIT MIX DATA AVAILABLE</div>
        </div>
      );
    }

    const totalUnits = config.reduce((s: number, u: any) => s + (u.count || 0), 0);

    return (
      <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
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
              <div key={bed} style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: T.text.primary, fontFamily: T.font.mono }}>{count}</div>
                <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginTop: 2 }}>{bed.toUpperCase()} UNITS</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text.blue, fontFamily: T.font.mono, marginTop: 4 }}>{fmt(avgRent, 'currency')}</div>
                <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>{totalUnits > 0 ? `${((count / totalUnits) * 100).toFixed(0)}% of mix` : ''}</div>
              </div>
            );
          })}
        </div>

        <Panel title={`UNIT TYPES (${config.length} types, ${totalUnits} units)`}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
              <thead>
                <tr style={{ background: T.bg.panelAlt }}>
                  {['TYPE', 'BEDS', 'SF', 'COUNT', '% MIX', 'AVG RENT', 'MIN RENT', 'MAX RENT', '$/SF'].map((h, j) => (
                    <th key={h} style={{ textAlign: j === 0 ? 'left' : 'right', padding: '7px 10px', color: T.text.muted, fontWeight: 600, fontSize: 9 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.sort((a: any, b: any) => (b.count || 0) - (a.count || 0)).map((u: any, i: number) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                    <td style={{ padding: '6px 10px', color: T.text.primary, fontWeight: 600 }}>{u.type || u.unit_type}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: T.text.secondary }}>{u.bedroom_count ?? '—'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: T.text.secondary }}>{fmt(u.sqft)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: T.text.primary }}>{u.count || '—'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: T.text.secondary }}>{totalUnits > 0 ? `${(((u.count || 0) / totalUnits) * 100).toFixed(1)}%` : '—'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: T.text.blue, fontWeight: 600 }}>{fmt(u.avg_rent, 'currency')}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: T.text.secondary }}>{fmt(u.min_rent, 'currency')}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: T.text.secondary }}>{fmt(u.max_rent, 'currency')}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: T.text.secondary }}>{u.sqft && u.avg_rent ? `$${(u.avg_rent / u.sqft).toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    );
  };

  const renderTraffic = () => {
    if (!trafficData.length) return <Spinner />;

    const last52 = trafficData.slice(-52);
    const trafficNums = last52.map(w => toNum(w.traffic) || 0);
    const closingNums = last52.map(w => toNum(w.closing_ratio) || 0);
    const occNums = last52.map(w => toNum(w.occ_pct) || 0);

    return (
      <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'WEEKS OF DATA', value: trafficData.length, color: T.text.primary },
            { label: 'AVG WEEKLY TRAFFIC', value: fmt(trafficNums.reduce((a, b) => a + b, 0) / trafficNums.length, 'number', 1), color: T.text.blue },
            { label: 'AVG CLOSING RATIO', value: fmt(closingNums.reduce((a, b) => a + b, 0) / closingNums.length, 'percent', 1), color: T.text.green },
            { label: 'LATEST OCCUPANCY', value: fmt(occNums[occNums.length - 1], 'percent', 1), color: T.text.purple },
          ].map((k, i) => (
            <div key={i} style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color, fontFamily: T.font.mono }}>{k.value}</div>
              <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Panel title="WEEKLY TRAFFIC (LAST 52 WEEKS)" titleColor={T.text.blue}>
            <div style={{ padding: 12 }}>
              <MiniBarChart data={trafficNums} color={T.text.blue} height={120} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginTop: 4 }}>
                {last52.length > 0 && <span>{new Date(last52[0].week_ending).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>}
                {last52.length > 1 && <span>{new Date(last52[last52.length - 1].week_ending).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>}
              </div>
            </div>
          </Panel>
          <Panel title="CLOSING RATIO TREND" titleColor={T.text.green}>
            <div style={{ padding: 12 }}>
              <MiniLineChart data={closingNums} color={T.text.green} height={120} />
            </div>
          </Panel>
        </div>

        <Panel title="OCCUPANCY TREND" titleColor={T.text.purple}>
          <div style={{ padding: 12 }}>
            <MiniLineChart data={trafficData.map(w => toNum(w.occ_pct) || 0)} color={T.text.purple} height={100} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginTop: 4 }}>
              {trafficData.length > 0 && <span>{new Date(trafficData[0].week_ending).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>}
              {trafficData.length > 1 && <span>{new Date(trafficData[trafficData.length - 1].week_ending).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>}
            </div>
          </div>
        </Panel>
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg.terminal }}>
      {/* Header */}
      <div style={{ background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, padding: '10px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 10, fontFamily: T.font.mono }}>
          <button onClick={() => navigate('/assets-owned')} style={{ color: T.text.muted, background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontFamily: T.font.mono }}>
            ← ASSETS OWNED
          </button>
          <span style={{ color: T.border.medium }}>·</span>
          <button onClick={() => navigate(`/deals/${dealId}/detail`)} style={{ color: T.text.cyan, background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontFamily: T.font.mono }}>
            VIEW UNDERWRITING →
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: T.text.primary, fontFamily: T.font.mono, margin: 0 }}>{deal.name}</h1>
              <span style={{ fontSize: 9, padding: '2px 8px', background: '#00D26A22', color: T.text.green, borderRadius: 3, fontWeight: 700, fontFamily: T.font.mono }}>OWNED</span>
              {deal.class && <span style={{ fontSize: 9, padding: '2px 8px', background: '#4A9EFF22', color: T.text.blue, borderRadius: 3, fontWeight: 700, fontFamily: T.font.mono }}>CLASS {deal.class}</span>}
            </div>
            <div style={{ fontSize: 11, color: T.text.secondary, fontFamily: T.font.mono, marginTop: 3 }}>
              {deal.address}
              {deal.county && ` · ${deal.county} County`}
              {deal.operator && ` · ${deal.operator}`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 11, fontFamily: T.font.mono }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text.primary }}>{units}</div>
              <div style={{ fontSize: 9, color: T.text.muted }}>UNITS</div>
            </div>
            {deal.vintage && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text.primary }}>{deal.vintage}</div>
                <div style={{ fontSize: 9, color: T.text.muted }}>VINTAGE</div>
              </div>
            )}
            {trafficStats && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text.primary }}>{parseFloat(trafficStats.total_weeks)}</div>
                <div style={{ fontSize: 9, color: T.text.muted }}>WEEKS DATA</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {renderKPICards()}

      {/* Tab Bar */}
      <div style={{ background: T.bg.panel, borderBottom: `1px solid ${T.border.subtle}`, flexShrink: 0, overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', padding: '0 8px', minWidth: 'max-content' }}>
          {TAB_GROUPS.map((group, gi) => (
            <React.Fragment key={group.label}>
              {gi > 0 && <div style={{ width: 1, height: 24, background: T.border.subtle, alignSelf: 'center', margin: '0 4px' }} />}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: T.text.muted, padding: '5px 6px 2px', letterSpacing: '0.08em', fontFamily: T.font.mono }}>{group.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, paddingBottom: 4 }}>
                  {group.tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        padding: '3px 8px', borderRadius: 3, fontSize: 10, fontFamily: T.font.mono, cursor: 'pointer', whiteSpace: 'nowrap', border: 'none',
                        background: activeTab === tab.id ? T.bg.active : 'transparent',
                        color: activeTab === tab.id ? T.text.amber : T.text.secondary,
                        borderBottom: activeTab === tab.id ? `2px solid ${T.text.amber}` : '2px solid transparent',
                        fontWeight: activeTab === tab.id ? 700 : 400,
                      }}
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

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'hidden', background: T.bg.terminal }}>
        {activeTab === 'overview'     && renderOverview()}
        {activeTab === 'performance'  && <PerformanceTab dealId={dealId!} financials={financials} />}
        {activeTab === 'comp-set'     && <CompSetTab dealId={dealId!} />}
        {activeTab === 'leasing'      && renderLeasing()}
        {activeTab === 'unit-mix'     && renderUnitMix()}
        {activeTab === 'traffic'      && renderTraffic()}
        {activeTab === 'ops-intel'    && (
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            <OperationsIntelligenceSection dealId={dealId!} deal={deal as Record<string, unknown>} />
          </div>
        )}
        {activeTab === 'revenue'      && <RevenueMgmtTab dealId={dealId!} />}
        {activeTab === 'actuals'      && (
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            <MonthlyActualsSection dealId={dealId!} deal={deal as Record<string, unknown>} />
          </div>
        )}
        {activeTab === 'investors'    && (
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            <InvestorCapitalModule dealId={dealId!} />
          </div>
        )}
        {activeTab === 'lifecycle'    && (
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            <LifecycleSection dealId={dealId!} />
          </div>
        )}
        {activeTab === 'exit-timing'  && <ExitTimingTab dealId={dealId!} />}
        {activeTab === 'refi-monitor' && <RefiMonitorTab dealId={dealId!} />}
        {activeTab === 'ai-learning'  && <AILearningTab dealId={dealId!} />}
        {activeTab === 'events'       && (
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            <EventTimelineSection dealId={dealId!} deal={deal} />
          </div>
        )}
        {activeTab === 'documents'    && (
          <div style={{ overflowY: 'auto', padding: 16, maxHeight: 'calc(100vh - 280px)' }}>
            <DocumentsSection deal={deal as unknown as Deal} />
          </div>
        )}
        {activeTab === 'reports'      && (
          <ReportsTab dealId={dealId!} financials={financials} deal={deal} />
        )}
        {activeTab === 'deal-team'    && (
          <div style={{ overflowY: 'auto', padding: 16, maxHeight: 'calc(100vh - 280px)' }}>
            <TeamSection deal={{ ...deal, status: deal.status || 'owned' } as unknown as Deal} />
          </div>
        )}
      </div>
    </div>
  );
}
