import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';
import { Deal } from '../types/deal';
import MonthlyActualsSection from '../components/deal/sections/MonthlyActualsSection';
import { OperationsIntelligenceSection } from '../components/deal/sections/OperationsIntelligenceSection';
import { LifecycleSection } from '../components/deal/sections/LifecycleSection';

// Existing components to reuse
import { InvestorCapitalModule } from '../components/deal/sections/InvestorCapitalModule';
import { EventTimelineSection } from '../components/deal/sections/EventTimelineSection';
import { DocumentsSection } from '../components/deal/sections/DocumentsSection';
import { TeamSection } from '../components/deal/sections/TeamSection';
import { ConvergenceChart, RSSBreakdownCards, Q_LABELS, RSS_21Y, OPTIMAL_FWD, NOW_IDX as CONV_NOW_IDX } from '../components/deal/sections/ConvergenceChart';
import { ContextIndicator } from '../components/intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../hooks/useContextAwareness';

// ─── Bloomberg Terminal Theme ─────────────────────────────────
const T = {
  bg: { terminal:'#0A0E17', panel:'#0F1319', panelAlt:'#131821', header:'#1A1F2E', hover:'#1E2538', active:'#252D40', input:'#0D1117' },
  text: { primary:'#E8ECF1', secondary:'#8B95A5', muted:'#4A5568', amber:'#F5A623', green:'#00D26A', red:'#FF4757', cyan:'#00BCD4', orange:'#FF8C42', purple:'#A78BFA', white:'#FFFFFF', blue:'#4A9EFF' },
  border: { subtle:'#1E2538', medium:'#2A3348', bright:'#3B4A6B' },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

type TabType =
  | 'overview' | 'performance' | 'comp-set'
  | 'leasing' | 'traffic'
  | 'revenue'
  | 'investors' | 'lifecycle' | 'exit-timing' | 'refi-monitor'
  | 'ai-learning' | 'events' | 'activity'
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
  const totRev = filtered.reduce((s, f) => s + (toNum(f.net_rental_income) || toNum(f.effective_gross_income) || 0), 0);
  const totOpex = filtered.reduce((s, f) => s + (toNum(f.total_opex) || toNum(f.total_operating_expenses) || 0), 0);
  const avgOcc = filtered.length ? filtered.reduce((s, f) => s + (toNum(f.occupancy_rate) || 0), 0) / filtered.length * 100 : null;

  // Loss-to-Lease calculation
  const latestMonth = filtered.length > 0 ? filtered[filtered.length - 1] : null;
  const avgEffRent = latestMonth ? toNum(latestMonth.avg_effective_rent) : 0;
  const avgMktRent = latestMonth ? toNum(latestMonth.avg_market_rent) : 0;
  const ltlPct = avgMktRent > 0 ? ((avgMktRent - avgEffRent) / avgMktRent) * 100 : null;

  // DSCR calculation
  const latestNOI = latestMonth ? toNum(latestMonth.noi) : 0;
  const latestDebtSvc = latestMonth ? Math.abs(toNum(latestMonth.debt_service)) : 0;
  const dscr = latestDebtSvc > 0 ? latestNOI / latestDebtSvc : null;

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 }}>
        {[
          { label: 'TOTAL NOI', value: fmt$(totNOI), color: T.text.blue },
          { label: 'TOTAL REVENUE', value: fmt$(totRev), color: T.text.primary },
          { label: 'TOTAL OPEX', value: fmt$(totOpex), color: T.text.red },
          { label: 'AVG OCCUPANCY', value: avgOcc != null ? `${avgOcc.toFixed(1)}%` : '—', color: T.text.green },
          { label: 'LOSS-TO-LEASE', value: ltlPct != null ? `${ltlPct.toFixed(1)}%` : '—', color: ltlPct && ltlPct > 3 ? T.text.red : T.text.amber },
          { label: 'DSCR', value: dscr != null ? `${dscr.toFixed(2)}x` : '—', color: dscr && dscr < 1.25 ? T.text.red : T.text.green },
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

// ─── Balance Sheet Sub-Tab ───────────────────────────────────
const BalanceSheetSubTab: React.FC<{ 
  dealId: string; 
  fmt$: (v: any) => string; 
  toN: (v: any) => number;
  emptyState: (icon: string, msg: string, sub?: string) => JSX.Element;
}> = ({ dealId, fmt$, toN, emptyState }) => {
  const [bsData, setBsData] = useState<any>(null);
  const [bsLoading, setBsLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/api/v1/operations/${dealId}/balance-sheet`)
      .then(r => setBsData(r.data?.balanceSheet || null))
      .catch(() => setBsData(null))
      .finally(() => setBsLoading(false));
  }, [dealId]);

  if (bsLoading) return <Spinner />;

  if (!bsData) {
    return emptyState('💰', 'NO BALANCE SHEET DATA', 'Upload a BPI Balance Sheet or enter data manually');
  }

  const Section: React.FC<{ title: string; items: { label: string; value: number }[]; total: number; color: string }> = ({ title, items, total, color }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color, fontFamily: T.font.mono, marginBottom: 8, textTransform: 'uppercase' }}>
        {title}
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${T.border.subtle}` }}>
          <span style={{ fontSize: 10, color: T.text.secondary, fontFamily: T.font.mono }}>{item.label}</span>
          <span style={{ fontSize: 10, color: T.text.primary, fontFamily: T.font.mono }}>{fmt$(item.value)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: `2px solid ${T.border.medium}`, marginTop: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: T.font.mono }}>TOTAL {title.toUpperCase()}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: T.font.mono }}>{fmt$(total)}</span>
      </div>
    </div>
  );

  return (
    <Panel title={`BALANCE SHEET — ${bsData.report_month || 'Current'}`}>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Assets */}
        <div>
          <Section
            title="Assets"
            items={[
              { label: 'Cash & Cash Equivalents', value: toN(bsData.cash) },
              { label: 'Accounts Receivable', value: toN(bsData.accounts_receivable) },
              { label: 'Prepaid Expenses', value: toN(bsData.prepaid_expenses) },
              { label: 'Other Current Assets', value: toN(bsData.other_current_assets) },
              { label: 'Fixed Assets', value: toN(bsData.fixed_assets) },
            ]}
            total={toN(bsData.total_assets)}
            color={T.text.cyan}
          />
        </div>

        {/* Liabilities & Equity */}
        <div>
          <Section
            title="Liabilities"
            items={[
              { label: 'Accounts Payable', value: toN(bsData.accounts_payable) },
              { label: 'Accrued Expenses', value: toN(bsData.accrued_expenses) },
              { label: 'Security Deposits', value: toN(bsData.security_deposits) },
              { label: 'Prepaid Rent', value: toN(bsData.prepaid_rent) },
              { label: 'Other Liabilities', value: toN(bsData.other_liabilities) },
            ]}
            total={toN(bsData.total_liabilities)}
            color={T.text.orange}
          />

          <Section
            title="Equity"
            items={[
              { label: 'Contributed Capital', value: toN(bsData.contributed_capital) },
              { label: 'Retained Earnings', value: toN(bsData.retained_earnings) },
              { label: 'Current Year Earnings', value: toN(bsData.current_year_earnings) },
            ]}
            total={toN(bsData.total_equity)}
            color={T.text.green}
          />
        </div>
      </div>
    </Panel>
  );
};

// ─── Revenue Management Tab ───────────────────────────────────
const RevenueMgmtTab: React.FC<{ dealId: string; deal?: Record<string, unknown> }> = ({ dealId, deal: _deal }) => {
  const [subTab, setSubTab] = useState<'revenue-waterfall' | 'rent-roll' | 'other-income' | 'expenses' | 'variance' | 'recommendations' | 'lease-expirations' | 'balance-sheet'>('revenue-waterfall');
  const [rentRoll, setRentRoll] = useState<{ units: any[]; snapshots: string[] } | null>(null);
  const [otherIncome, setOtherIncome] = useState<any[]>([]);
  const [actuals, setActuals] = useState<any[]>([]);
  const [actualsLoaded, setActualsLoaded] = useState(false);
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
    if (subTab === 'expenses' && !actualsLoaded) {
      setLoading(true);
      apiClient.get(`/api/v1/operations/${dealId}/monthly-actuals?limit=24`)
        .then(r => { setActuals(r.data?.data ?? []); setActualsLoaded(true); })
        .catch(() => { setActuals([]); setActualsLoaded(true); })
        .finally(() => setLoading(false));
    }
  // hook intentionally captures actualsLoaded, otherIncome.length, rentRoll via the closure rather than re-running on each change — re-running on the listed deps is the desired trigger; the omitted values are read from the enclosing scope at the moment of fire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, subTab]);

  const fmt$ = (v: any) => v == null ? '—' : `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const toN = (v: any) => v == null ? 0 : Number(v) || 0;

  const EXPENSE_LINES: { key: string; label: string; color: string }[] = [
    { key: 'payroll',            label: 'Payroll',        color: '#63B3ED' },
    { key: 'repairs_maintenance',label: 'R&M',            color: '#68D391' },
    { key: 'contract_services',  label: 'Contract Svcs',  color: '#E9D8FD' },
    { key: 'utilities',          label: 'Utilities',      color: '#F6AD55' },
    { key: 'real_estate_taxes',  label: 'RE Taxes',       color: '#FC8181' },
    { key: 'management_fee',     label: 'Mgmt Fee',       color: '#B794F4' },
    { key: 'insurance',          label: 'Insurance',      color: '#4FD1C5' },
    { key: 'marketing',          label: 'Marketing',      color: '#F687B3' },
    { key: 'admin_general',      label: 'Admin/G&A',      color: '#FBD38D' },
    { key: 'turnover_costs',     label: 'Turnover',       color: '#9F7AEA' },
    { key: 'capex',              label: 'CapEx',          color: '#76E4F7' },
  ];

  const subTabs = [
    { id: 'revenue-waterfall',  label: 'REVENUE' },
    { id: 'rent-roll',          label: 'RENT ROLL' },
    { id: 'other-income',       label: 'OTHER INCOME' },
    { id: 'expenses',           label: 'EXPENSES' },
    { id: 'variance',           label: 'BUDGET VS ACTUAL' },
    { id: 'recommendations',    label: 'AI RECOMMENDATIONS' },
    { id: 'lease-expirations',  label: 'LEASE EXPIRATIONS' },
    { id: 'balance-sheet',      label: 'BALANCE SHEET' },
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

      {/* ── REVENUE WATERFALL ── */}
      {!loading && subTab === 'revenue-waterfall' && (() => {
        if (!actualsLoaded || actuals.length === 0) {
          // Load actuals if not loaded
          if (!actualsLoaded) {
            apiClient.get(`/api/v1/operations/${dealId}/monthly-actuals?limit=24`)
              .then(r => { setActuals(r.data?.data ?? []); setActualsLoaded(true); })
              .catch(() => { setActuals([]); setActualsLoaded(true); });
            return <Spinner />;
          }
          return emptyState('💰', 'NO REVENUE DATA', 'Import monthly actuals to see revenue waterfall');
        }

        const sorted = [...actuals].sort((a, b) => a.report_month.localeCompare(b.report_month));
        const latest = sorted[sorted.length - 1];
        const trailing12 = sorted.slice(-12);

        // Revenue waterfall values
        const gpr = toN(latest?.gross_potential_rent);
        const ltl = toN(latest?.loss_to_lease);
        const vacancy = toN(latest?.vacancy_loss);
        const concessions = toN(latest?.concessions);
        const badDebt = toN(latest?.bad_debt);
        const otherInc = toN(latest?.other_income);
        const egi = toN(latest?.effective_gross_income);
        const noi = toN(latest?.noi);
        const totalUnits = toN(latest?.total_units) || 1;
        const occupiedUnits = toN(latest?.occupied_units);
        const avgEffRent = toN(latest?.avg_effective_rent);
        const avgMktRent = toN(latest?.avg_market_rent);

        // Calculate derived values if not stored
        const calcLtl = avgMktRent && avgEffRent && occupiedUnits 
          ? (avgMktRent - avgEffRent) * occupiedUnits 
          : ltl;
        const ltlPct = gpr > 0 ? (calcLtl / gpr) * 100 : 0;

        // Rent roll summary from data
        const ltlTotal = rentRoll?.units?.reduce((sum, u) => {
          const diff = Number(u.market_rent || 0) - Number(u.current_rent || 0);
          return sum + (diff > 0 ? diff : 0);
        }, 0) || calcLtl;

        // Trailing trends
        const gprTrend = trailing12.map(r => toN(r.gross_potential_rent));
        const egiTrend = trailing12.map(r => toN(r.effective_gross_income));
        const noiTrend = trailing12.map(r => toN(r.noi));

        return (
          <>
            {/* Key Revenue KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 12 }}>
              {[
                { l: 'GROSS POTENTIAL RENT', v: fmt$(gpr), c: T.text.green },
                { l: 'LOSS-TO-LEASE', v: ltlPct > 0 ? `${ltlPct.toFixed(1)}%` : '—', sub: fmt$(calcLtl), c: T.text.red },
                { l: 'EFFECTIVE GROSS INCOME', v: fmt$(egi), c: T.text.cyan },
                { l: 'NET OPERATING INCOME', v: fmt$(noi), c: T.text.blue },
                { l: 'PERIOD', v: latest?.report_month?.slice(0, 7) ?? '—', c: T.text.muted },
              ].map(k => (
                <div key={k.l} style={{ background: T.bg.panelAlt, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: '10px 14px' }}>
                  <div style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 4 }}>{k.l}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, fontFamily: T.font.mono, color: k.c }}>{k.v}</div>
                  {k.sub && <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>{k.sub}</div>}
                </div>
              ))}
            </div>

            {/* Revenue Waterfall */}
            <Panel title="REVENUE WATERFALL — LATEST MONTH">
              <div style={{ padding: '16px 20px' }}>
                {[
                  { l: 'Gross Potential Rent', v: gpr, c: T.text.green, op: '' },
                  { l: 'Loss-to-Lease', v: calcLtl, c: T.text.red, op: '−' },
                  { l: 'Vacancy Loss', v: vacancy, c: T.text.red, op: '−' },
                  { l: 'Concessions', v: concessions, c: T.text.amber, op: '−' },
                  { l: 'Bad Debt', v: badDebt, c: T.text.red, op: '−' },
                  { l: 'Other Income', v: otherInc, c: T.text.green, op: '+' },
                  { l: 'EFFECTIVE GROSS INCOME', v: egi, c: T.text.cyan, op: '=', bold: true },
                ].map((row, i) => (
                  <div key={i} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '8px 0',
                    borderBottom: row.bold ? 'none' : `1px solid ${T.border.subtle}`,
                    marginTop: row.bold ? 8 : 0,
                    background: row.bold ? T.bg.active : 'transparent',
                    margin: row.bold ? '8px -20px 0' : 0,
                    padding: row.bold ? '12px 20px' : '8px 0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {row.op && <span style={{ width: 16, textAlign: 'center', color: T.text.muted, fontFamily: T.font.mono, fontSize: 12 }}>{row.op}</span>}
                      <span style={{ fontSize: row.bold ? 11 : 10, fontFamily: T.font.mono, color: row.bold ? T.text.primary : T.text.secondary, fontWeight: row.bold ? 700 : 400 }}>{row.l}</span>
                    </div>
                    <span style={{ fontSize: row.bold ? 14 : 11, fontFamily: T.font.mono, fontWeight: row.bold ? 800 : 600, color: row.c }}>
                      {row.v > 0 || row.bold ? fmt$(row.v) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Trend Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Panel title="GPR TREND">
                <div style={{ padding: 12, height: 80 }}>
                  <MiniLineChart data={gprTrend} color={T.text.green} height={60} />
                </div>
              </Panel>
              <Panel title="EGI TREND">
                <div style={{ padding: 12, height: 80 }}>
                  <MiniLineChart data={egiTrend} color={T.text.cyan} height={60} />
                </div>
              </Panel>
              <Panel title="NOI TREND">
                <div style={{ padding: 12, height: 80 }}>
                  <MiniLineChart data={noiTrend} color={T.text.blue} height={60} />
                </div>
              </Panel>
            </div>

            {/* Monthly Revenue Table */}
            <Panel title="MONTHLY REVENUE DETAIL">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, fontFamily: T.font.mono, minWidth: 800 }}>
                  <thead>
                    <tr style={{ background: T.bg.panelAlt }}>
                      <th style={{ textAlign: 'left', padding: '6px 10px', color: T.text.muted, fontWeight: 600 }}>MONTH</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px', color: T.text.green, fontWeight: 600 }}>GPR</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px', color: T.text.red, fontWeight: 600 }}>LTL</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px', color: T.text.red, fontWeight: 600 }}>VACANCY</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px', color: T.text.amber, fontWeight: 600 }}>CONC</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px', color: T.text.green, fontWeight: 600 }}>OTHER</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px', color: T.text.cyan, fontWeight: 600 }}>EGI</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px', color: T.text.muted, fontWeight: 600 }}>OCC %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sorted].reverse().slice(0, 12).map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                        <td style={{ padding: '5px 10px', color: T.text.primary, fontWeight: 600 }}>{row.report_month?.slice(0, 7)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: T.text.green }}>{fmt$(row.gross_potential_rent)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: T.text.red }}>{toN(row.loss_to_lease) > 0 ? fmt$(row.loss_to_lease) : '—'}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: T.text.red }}>{toN(row.vacancy_loss) > 0 ? fmt$(row.vacancy_loss) : '—'}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: T.text.amber }}>{toN(row.concessions) > 0 ? fmt$(row.concessions) : '—'}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: T.text.green }}>{toN(row.other_income) > 0 ? fmt$(row.other_income) : '—'}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: T.text.cyan, fontWeight: 600 }}>{fmt$(row.effective_gross_income)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: T.text.secondary }}>{row.occupancy_rate ? `${(Number(row.occupancy_rate) * 100).toFixed(1)}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        );
      })()}

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

      {/* ── EXPENSES ── */}
      {!loading && subTab === 'expenses' && (() => {
        if (!actualsLoaded || actuals.length === 0) {
          return emptyState('📊', 'NO EXPENSE DATA', 'Enter monthly actuals in the Actuals tab to populate this view');
        }

        const sorted = [...actuals].sort((a, b) => a.report_month.localeCompare(b.report_month));
        const latest = sorted[sorted.length - 1];
        const trailing12 = sorted.slice(-12);

        const rowTotal = (row: any) =>
          EXPENSE_LINES.reduce((s, l) => s + toN(row[l.key]), 0) || toN(row.expenses);

        const latestTotal = rowTotal(latest);
        const latestRevenue = toN(latest?.effective_gross_income);
        const latestUnits = toN(latest?.total_units) || 1;
        const opexRatio = latestRevenue > 0 ? latestTotal / latestRevenue : null;

        // Bar chart — trailing 12 months total opex
        const chartW = 820, chartH = 140;
        const chartPad = { t: 10, r: 20, b: 30, l: 64 };
        const maxOpex = Math.max(...trailing12.map(r => rowTotal(r)), 1);
        const barW = Math.floor(((chartW - chartPad.l - chartPad.r) / trailing12.length) * 0.65);
        const barGap = (chartW - chartPad.l - chartPad.r) / trailing12.length;
        const bH = (v: number) => ((v / maxOpex) * (chartH - chartPad.t - chartPad.b));
        const bX = (i: number) => chartPad.l + i * barGap + (barGap - barW) / 2;
        const bY = (v: number) => chartH - chartPad.b - bH(v);

        return (
          <>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 12 }}>
              {[
                { l: 'TOTAL OPEX (LATEST MO)', v: fmt$(latestTotal), c: '#FC8181' },
                { l: 'OPEX / UNIT / MO', v: latestUnits > 1 ? fmt$(latestTotal / latestUnits) : '—', c: T.text.amber },
                { l: 'OPEX RATIO', v: opexRatio ? `${(opexRatio * 100).toFixed(1)}%` : '—', c: T.text.blue },
                { l: 'PERIOD', v: latest.report_month?.slice(0, 7) ?? '—', c: T.text.muted },
              ].map(k => (
                <div key={k.l} style={{ background: T.bg.panelAlt, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: '10px 14px' }}>
                  <div style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 4 }}>{k.l}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, fontFamily: T.font.mono, color: k.c }}>{k.v}</div>
                </div>
              ))}
            </div>

            {/* Trend bar chart */}
            <Panel title="TOTAL OPEX TREND — TRAILING 12 MONTHS">
              <div style={{ padding: '8px 12px 0' }}>
                <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ display: 'block' }}>
                  {/* Gridlines */}
                  {[0.25, 0.5, 0.75, 1].map(pct => (
                    <g key={pct}>
                      <line x1={chartPad.l} y1={chartH - chartPad.b - (chartH - chartPad.t - chartPad.b) * pct} x2={chartW - chartPad.r} y2={chartH - chartPad.b - (chartH - chartPad.t - chartPad.b) * pct} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
                      <text x={chartPad.l - 4} y={chartH - chartPad.b - (chartH - chartPad.t - chartPad.b) * pct + 3} textAnchor="end" fill="rgba(232,230,225,0.2)" fontSize={7} fontFamily="JetBrains Mono">${((maxOpex * pct) / 1000).toFixed(0)}k</text>
                    </g>
                  ))}
                  {/* Bars */}
                  {trailing12.map((row, i) => {
                    const total = rowTotal(row);
                    const h = bH(total);
                    return (
                      <g key={i}>
                        <rect x={bX(i)} y={bY(total)} width={barW} height={h} fill="#FC8181" opacity={0.65} rx={1} />
                        <text x={bX(i) + barW / 2} y={chartH - chartPad.b + 12} textAnchor="middle" fill="rgba(232,230,225,0.3)" fontSize={7} fontFamily="JetBrains Mono">{row.report_month?.slice(2, 7)}</text>
                      </g>
                    );
                  })}
                  <line x1={chartPad.l} y1={chartH - chartPad.b} x2={chartW - chartPad.r} y2={chartH - chartPad.b} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
                </svg>
              </div>
            </Panel>

            {/* Latest month breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Panel title={`EXPENSE COMPOSITION — ${latest.report_month?.slice(0, 7)}`}>
                <div style={{ padding: '6px 14px 12px' }}>
                  {EXPENSE_LINES.map(line => {
                    const v = toN(latest[line.key]);
                    if (v === 0 && latestTotal === 0) return null;
                    const pct = latestTotal > 0 ? v / latestTotal : 0;
                    return (
                      <div key={line.key} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.secondary }}>{line.label}</span>
                          <span style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.primary, fontWeight: 600 }}>
                            {v > 0 ? fmt$(v) : '—'}
                            {v > 0 && <span style={{ color: T.text.muted, fontWeight: 400, marginLeft: 6 }}>{(pct * 100).toFixed(1)}%</span>}
                          </span>
                        </div>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct * 100}%`, background: line.color, borderRadius: 2, opacity: 0.7 }} />
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.border.subtle}`, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.muted, fontWeight: 700 }}>TOTAL OPEX</span>
                    <span style={{ fontSize: 10, fontFamily: T.font.mono, color: '#FC8181', fontWeight: 800 }}>{fmt$(latestTotal)}</span>
                  </div>
                </div>
              </Panel>

              {/* NOI bridge */}
              <Panel title="NOI BRIDGE — LATEST MONTH">
                <div style={{ padding: '6px 14px 12px' }}>
                  {[
                    { l: 'Gross Potential Rent', v: toN(latest.gross_potential_rent), c: '#68D391', sign: '' },
                    { l: 'Effective Gross Income', v: toN(latest.effective_gross_income), c: '#63B3ED', sign: '' },
                    { l: 'Total Operating Expenses', v: latestTotal, c: '#FC8181', sign: '−' },
                    { l: 'NET OPERATING INCOME', v: toN(latest.noi), c: '#10b981', sign: '=' },
                  ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < 3 ? `1px solid ${T.border.subtle}` : 'none', marginTop: i === 3 ? 4 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {i === 3 && <div style={{ width: 3, height: 14, background: '#10b981', borderRadius: 1 }} />}
                        <span style={{ fontSize: i === 3 ? 10 : 9, fontFamily: T.font.mono, color: i === 3 ? T.text.primary : T.text.secondary, fontWeight: i === 3 ? 700 : 400 }}>{row.l}</span>
                      </div>
                      <span style={{ fontSize: i === 3 ? 12 : 10, fontFamily: T.font.mono, fontWeight: i === 3 ? 800 : 600, color: row.c }}>
                        {row.sign}{fmt$(row.v)}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* Monthly detail table */}
            <Panel title="EXPENSE DETAIL — TRAILING 24 MONTHS">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, fontFamily: T.font.mono, minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: T.bg.panelAlt }}>
                      <th style={{ textAlign: 'left', padding: '6px 10px', color: T.text.muted, fontWeight: 600, position: 'sticky', left: 0, background: T.bg.panelAlt }}>MONTH</th>
                      {EXPENSE_LINES.map(l => (
                        <th key={l.key} style={{ textAlign: 'right', padding: '6px 10px', color: l.color, fontWeight: 600, opacity: 0.8 }}>{l.label.toUpperCase()}</th>
                      ))}
                      <th style={{ textAlign: 'right', padding: '6px 10px', color: '#FC8181', fontWeight: 700 }}>TOTAL</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px', color: T.text.muted, fontWeight: 600 }}>NOI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sorted].reverse().map((row, i) => {
                      const total = rowTotal(row);
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)', borderBottom: `1px solid ${T.border.subtle}` }}>
                          <td style={{ padding: '5px 10px', color: T.text.primary, fontWeight: 600, position: 'sticky', left: 0, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>{row.report_month?.slice(0, 7)}</td>
                          {EXPENSE_LINES.map(l => (
                            <td key={l.key} style={{ padding: '5px 10px', textAlign: 'right', color: toN(row[l.key]) > 0 ? T.text.secondary : T.text.muted }}>
                              {toN(row[l.key]) > 0 ? fmt$(row[l.key]) : '—'}
                            </td>
                          ))}
                          <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: '#FC8181' }}>{total > 0 ? fmt$(total) : '—'}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 600, color: toN(row.noi) >= 0 ? T.text.green : T.text.red }}>{fmt$(row.noi)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        );
      })()}

      {/* ── Ops Intel sub-tabs (compact mode — no double nav) ── */}
      {subTab === 'variance' && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <OperationsIntelligenceSection dealId={dealId} initialPanel="variance" compact />
        </div>
      )}
      {subTab === 'recommendations' && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <OperationsIntelligenceSection dealId={dealId} initialPanel="recommendations" compact />
        </div>
      )}
      {subTab === 'lease-expirations' && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <OperationsIntelligenceSection dealId={dealId} initialPanel="leases" compact />
        </div>
      )}

      {/* ── BALANCE SHEET ── */}
      {!loading && subTab === 'balance-sheet' && (
        <BalanceSheetSubTab dealId={dealId} fmt$={fmt$} toN={toN} emptyState={emptyState} />
      )}

    </div>
  );
};

// ─── Documents Hub (Files + Enter Actuals) ────────────────────
// Documents tab now just shows documents - Enter Actuals moved to Operations > ENTER ACTUALS sub-tab
const DocumentsHub: React.FC<{ dealId: string; deal: Record<string, unknown> }> = ({ dealId }) => {
  return (
    <div style={{ overflowY: 'auto', padding: 16, maxHeight: 'calc(100vh - 280px)' }}>
      <DocumentsSection dealId={dealId} />
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

const RefiMonitorTab: React.FC<{ dealId: string; deal: any }> = ({ dealId, deal }) => {
  const R = {
    amber:  T.text.amber,
    green:  T.text.green,
    red:    T.text.red,
    purple: T.text.purple,
    orange: T.text.orange,
    panel:  T.bg.panel,
    hdr:    T.bg.header,
    input:  T.bg.input,
    bs:     T.border.subtle,
    bm:     T.border.medium,
    pri:    T.text.primary,
    sec:    T.text.secondary,
    mono:   T.font.mono,
  };

  const fm = (n: number | null | undefined, dec = 0) =>
    n == null ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: dec })}`;
  const fp = (n: number | null | undefined, dec = 2) =>
    n == null ? '—' : `${(n * 100).toFixed(dec)}%`;
  const constraintColor = (c: string) =>
    c?.toLowerCase().includes('ltv') ? T.text.red :
    c?.toLowerCase().includes('dscr') ? T.text.orange :
    c?.toLowerCase().includes('yield') ? T.text.purple : T.text.amber;

  /* ── State ── */
  const [liveRates, setLiveRates] = useState<Record<string, number> | null>(null);
  const [actuals, setActuals] = useState<any[]>([]);
  const [history, setHistory] = useState<RefiScenarioRow[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [ratesLoading, setRatesLoading] = useState(true);

  const [noiPeriod, setNoiPeriod] = useState<'T12' | 'T6' | 'T3'>('T12');
  const [benchmark, setBenchmark] = useState<'SOFR' | 'T5Y' | 'T10Y'>('T10Y');
  const [spreadBps, setSpreadBps] = useState(185);
  const [maxLtv, setMaxLtv] = useState(75);
  const [minDscr, setMinDscr] = useState(1.25);
  const [minDebtYield, setMinDebtYield] = useState(8.0);
  const [capRatePct, setCapRatePct] = useState<number>(() => {
    const cr = Number(deal?.capRate ?? 0);
    return cr > 1 ? cr * 100 : cr > 0 ? cr : 5.5;
  });
  const [existingBalance, setExistingBalance] = useState<number>(() => {
    const pp = Number(deal?.purchasePrice ?? 0);
    return pp > 0 ? Math.round(pp * 0.65) : 0;
  });

  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [scenarioName, setScenarioName] = useState('Refi Test');
  const [dealFiles, setDealFiles] = useState<any[]>([]);

  /* ── Fetch ── */
  useEffect(() => {
    apiClient.get('/api/v1/capital-structure/rates/live')
      .then((r: any) => setLiveRates(r.data))
      .catch(() => {})
      .finally(() => setRatesLoading(false));

    apiClient.get(`/api/v1/operations/${dealId}/monthly-actuals?limit=24`)
      .then((r: any) => {
        const rows = r.data?.data ?? [];
        setActuals(rows.slice().sort((a: any, b: any) =>
          new Date(a.period_month).getTime() - new Date(b.period_month).getTime()
        ));
      }).catch(() => {});

    apiClient.get(`/api/v1/lifecycle/${dealId}/refi-test`)
      .then((r: any) => setHistory(r.data?.scenarios ?? []))
      .catch(() => {})
      .finally(() => setHistLoading(false));

    apiClient.get(`/api/v1/deals/${dealId}/files?onlyLatestVersions=true`)
      .then((r: any) => {
        const files: any[] = r.data?.files ?? [];
        const priority = ['financing', 'appraisal', 'legal', 'financial-statements', 'due_diligence', 'lease'];
        const sorted = [...files].sort((a, b) => {
          const ai = priority.indexOf(a.category);
          const bi = priority.indexOf(b.category);
          if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setDealFiles(sorted);
      }).catch(() => {});
  }, [dealId]);

  /* ── Computed ── */
  const benchmarkRate = useMemo(() => {
    if (!liveRates) return null;
    if (benchmark === 'SOFR') return liveRates.sofr ?? null;
    if (benchmark === 'T5Y')  return liveRates.treasury5Y ?? null;
    return liveRates.treasury10Y ?? null;
  }, [liveRates, benchmark]);

  const allInRate = benchmarkRate != null ? (benchmarkRate + spreadBps / 100) / 100 : null;

  const debtConstant = useMemo(() => {
    if (!allInRate || allInRate <= 0) return null;
    const mr = allInRate / 12;
    const n = 360;
    return (mr * Math.pow(1 + mr, n)) / (Math.pow(1 + mr, n) - 1) * 12;
  }, [allInRate]);

  const actualsWithNoi = useMemo(() =>
    actuals.filter(a => Number(a.noi ?? 0) > 0 || Number(a.effective_gross_income ?? 0) > 0),
    [actuals]
  );

  const noiAnnualized = useMemo(() => {
    if (!actualsWithNoi.length) return null;
    const n = noiPeriod === 'T3' ? 3 : noiPeriod === 'T6' ? 6 : 12;
    const slice = actualsWithNoi.slice(-n);
    if (!slice.length) return null;
    const sum = slice.reduce((acc: number, a: any) => acc + Number(a.noi ?? 0), 0);
    return (sum / slice.length) * 12;
  }, [actualsWithNoi, noiPeriod]);

  const propertyValue = noiAnnualized && capRatePct > 0
    ? noiAnnualized / (capRatePct / 100) : null;
  const maxByLtv  = propertyValue ? propertyValue * (maxLtv / 100) : null;
  const maxByDscr = noiAnnualized && debtConstant && debtConstant > 0
    ? noiAnnualized / (minDscr * debtConstant) : null;
  const maxByDy   = noiAnnualized ? noiAnnualized / (minDebtYield / 100) : null;
  const maxProceeds = (maxByLtv != null && maxByDscr != null && maxByDy != null)
    ? Math.min(maxByLtv, maxByDscr, maxByDy) : null;
  const binding = maxProceeds == null ? null
    : maxProceeds === maxByLtv ? 'LTV'
    : maxProceeds === maxByDscr ? 'DSCR'
    : 'DEBT YIELD';
  const cashOut = maxProceeds != null ? maxProceeds - existingBalance : null;
  const annualDebtSvc = maxProceeds != null && debtConstant ? maxProceeds * debtConstant : null;
  const dscrCheck = annualDebtSvc && noiAnnualized ? noiAnnualized / annualDebtSvc : null;
  const isFeasible = maxProceeds != null && maxProceeds > 0;

  /* ── Trend data ── */
  const trendData = useMemo(() => {
    if (!allInRate || !debtConstant || !capRatePct) return [];
    return actualsWithNoi.map((a: any) => {
      const noi = Number(a.noi ?? 0);
      const noiAnn = noi * 12;
      const val = noiAnn / (capRatePct / 100);
      const ltv  = val * (maxLtv / 100);
      const dscr = noiAnn / (minDscr * debtConstant);
      const dy   = noiAnn / (minDebtYield / 100);
      return {
        month: String(a.period_month ?? '').slice(0, 7),
        ltv, dscr, dy,
        binding: Math.min(ltv, dscr, dy),
      };
    });
  }, [actualsWithNoi, allInRate, debtConstant, capRatePct, maxLtv, minDscr, minDebtYield]);

  /* ── Save scenario to history ── */
  const saveScenario = async () => {
    if (!noiAnnualized) return;
    setRunLoading(true);
    setRunError(null);
    try {
      const payload = {
        scenarioName,
        scenarioType: 'operational',
        assumedNoi: noiAnnualized,
        assumedValue: propertyValue,
        assumedCapRate: capRatePct / 100,
        existingBalance,
        assumedSpreadBps: spreadBps,
        maxLtv: maxLtv / 100,
        minDscr,
        minDebtYield: minDebtYield / 100,
      };
      const res: any = await apiClient.post(`/api/v1/lifecycle/${dealId}/refi-test`, payload);
      if (res.data?.success) {
        const hRes: any = await apiClient.get(`/api/v1/lifecycle/${dealId}/refi-test`);
        setHistory(hRes.data?.scenarios ?? []);
      } else {
        setRunError(res.data?.error ?? 'Save failed');
      }
    } catch (e: any) {
      setRunError(e?.response?.data?.error ?? 'Network error');
    } finally {
      setRunLoading(false);
    }
  };

  /* ── Chart helpers ── */
  const W = 520, H = 160, PL = 58, PR = 12, PT = 10, PB = 28;
  const iW = W - PL - PR, iH = H - PT - PB;
  const chartMax = trendData.length
    ? Math.max(...trendData.flatMap(d => [d.ltv, d.dscr, d.dy])) * 1.12 : 1;
  const toX = (i: number) =>
    trendData.length < 2 ? PL + iW / 2
    : PL + (i / (trendData.length - 1)) * iW;
  const toY = (v: number) => H - PB - (v / chartMax) * iH;
  const pts = (key: 'ltv' | 'dscr' | 'dy' | 'binding') =>
    trendData.map((d, i) => `${toX(i)},${toY(d[key])}`).join(' ');

  const fieldStyle: React.CSSProperties = {
    background: R.input, border: `1px solid ${R.bm}`, borderRadius: 3,
    padding: '5px 8px', fontSize: 10, fontFamily: R.mono, color: R.pri,
    width: '100%', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 8, color: R.sec, fontFamily: R.mono, marginBottom: 2,
    display: 'block', letterSpacing: '0.06em', textTransform: 'uppercase' as const,
  };
  const PanelHdr = ({ title, right, sub }: { title: string; right?: React.ReactNode; sub?: string }) => (
    <div style={{ background: R.hdr, borderBottom: `1px solid ${R.bm}`, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <span style={{ fontSize: 9, fontWeight: 700, fontFamily: R.mono, color: R.amber, letterSpacing: '0.08em' }}>{title}</span>
        {sub && <span style={{ fontSize: 8, color: R.sec, fontFamily: R.mono, marginLeft: 8 }}>{sub}</span>}
      </div>
      {right}
    </div>
  );
  const pill = (label: string, active: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick} style={{
      padding: '2px 8px', fontSize: 9, fontFamily: R.mono, fontWeight: active ? 700 : 400,
      background: active ? R.amber + '1A' : 'transparent',
      border: `1px solid ${active ? R.amber + '88' : R.bm}`,
      borderRadius: 2, color: active ? R.amber : R.sec,
      cursor: 'pointer', letterSpacing: '0.04em',
    }}>{label}</button>
  );
  const LiveDot = () => (
    <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: R.green, boxShadow: `0 0 6px ${R.green}`, verticalAlign: 'middle' }} />
  );

  /* ── Loan at close derived values ── */
  const purchasePrice = Number(deal?.purchasePrice ?? 0);
  const origLoan = purchasePrice > 0 ? Math.round(purchasePrice * 0.65) : 0;
  const acqDate = deal?.acquisitionDate ? String(deal.acquisitionDate).slice(0, 10) : '—';
  const acqCapRate = (() => {
    const v = Number(deal?.capRate ?? 0);
    return v > 1 ? v : v * 100;
  })();

  return (
    <div style={{ background: T.bg.terminal, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
      <style>{`
        @keyframes refi-pulse { 0%,100%{opacity:1;box-shadow:0 0 5px ${R.green}} 50%{opacity:.5;box-shadow:0 0 2px ${R.green}} }
        .refi-live-dot { animation: refi-pulse 2.4s ease-in-out infinite; }
      `}</style>

      {/* ══ Top header bar ══ */}
      <div style={{ background: R.hdr, borderBottom: `2px solid ${R.amber}22`, padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: R.mono, color: R.amber, letterSpacing: '0.1em' }}>REFI MONITOR</span>
            <span style={{ fontSize: 8, color: R.sec, fontFamily: R.mono, marginLeft: 10 }}>LTV · DSCR · DEBT YIELD  |  LIVE FRED RATES  |  ACTUALS-DRIVEN</span>
          </div>
          {!ratesLoading && liveRates && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="refi-live-dot" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: R.green }} />
              <span style={{ fontSize: 8, color: R.green, fontFamily: R.mono, fontWeight: 700 }}>RATES LIVE</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 8, color: R.sec, fontFamily: R.mono, letterSpacing: '0.06em' }}>NOI BASIS</span>
          <div style={{ display: 'flex', gap: 3 }}>
            {(['T12', 'T6', 'T3'] as const).map(p => pill(p, noiPeriod === p, () => setNoiPeriod(p)))}
          </div>
        </div>
      </div>

      {/* ══ Rate Strip ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0, borderBottom: `1px solid ${R.bm}` }}>
        {[
          { label: 'SOFR', val: liveRates?.sofr, isLive: true, color: R.pri },
          { label: 'T5Y TREASURY', val: liveRates?.treasury5Y, isLive: true, color: R.pri },
          { label: 'T10Y TREASURY', val: liveRates?.treasury10Y, isLive: true, color: R.pri },
          { label: `SPREAD (${benchmark})`, val: spreadBps / 100, color: R.orange },
          { label: 'ALL-IN RATE', val: allInRate != null ? allInRate * 100 : null, color: R.amber, bold: true },
          { label: 'BENCHMARK INDEX', val: null, isToggle: true },
        ].map((tile, ti) => (
          <div key={tile.label} style={{ background: ti === 4 ? R.amber + '08' : R.panel, borderRight: `1px solid ${R.bm}`, padding: 0, overflow: 'hidden' }}>
            <div style={{ background: R.hdr, borderBottom: `1px solid ${R.bm}`, padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 7, color: ti === 4 ? R.amber : R.sec, fontFamily: R.mono, letterSpacing: '0.05em', fontWeight: ti === 4 ? 700 : 400 }}>{tile.label}</span>
              {tile.isLive && !ratesLoading && liveRates && (
                <span className="refi-live-dot" style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: R.green }} />
              )}
            </div>
            <div style={{ padding: '10px 8px' }}>
              {tile.isToggle ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {(['SOFR', 'T5Y', 'T10Y'] as const).map(b => pill(b, benchmark === b, () => setBenchmark(b)))}
                </div>
              ) : ratesLoading && tile.isLive ? (
                <span style={{ fontSize: 10, color: R.sec, fontFamily: R.mono }}>…</span>
              ) : (
                <div style={{ fontSize: tile.bold ? 16 : 14, fontWeight: 800, fontFamily: R.mono, color: tile.color ?? R.pri }}>
                  {tile.val != null ? `${(tile.val as number).toFixed(2)}%` : '—'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: 12 }}>
        {/* ══ Main 3-column grid ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '236px 1fr 240px', gap: 8, marginBottom: 8 }}>

          {/* ── LEFT ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

            {/* Loan at Close */}
            <div style={{ background: R.panel, border: `1px solid ${R.bm}`, borderRadius: 4, overflow: 'hidden' }}>
              <PanelHdr title="LOAN AT CLOSE" sub="acquisition anchor" />
              <div style={{ padding: '8px 10px' }}>
                {[
                  { label: 'PURCHASE PRICE', val: purchasePrice > 0 ? fm(purchasePrice) : '—' },
                  { label: 'EST. ORIG. LOAN', val: origLoan > 0 ? fm(origLoan) : '—' },
                  { label: 'ACQ. DATE', val: acqDate },
                  { label: 'ACQ. CAP RATE', val: acqCapRate > 0 ? `${acqCapRate.toFixed(2)}%` : '—' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${R.bs}` }}>
                    <span style={{ fontSize: 8, color: R.sec, fontFamily: R.mono }}>{row.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, fontFamily: R.mono, color: R.pri }}>{row.val}</span>
                  </div>
                ))}
                <div style={{ marginTop: 7 }}>
                  <label style={labelStyle}>CURRENT BALANCE ($)</label>
                  <input style={fieldStyle} type="number" value={existingBalance || ''}
                    onChange={e => setExistingBalance(Number(e.target.value))} placeholder="0 if unencumbered" />
                </div>
              </div>
            </div>

            {/* Deal Context */}
            <div style={{ background: R.panel, border: `1px solid ${R.bm}`, borderRadius: 4, overflow: 'hidden' }}>
              <PanelHdr title="DEAL CONTEXT" right={
                dealFiles.length > 0
                  ? <span style={{ fontSize: 7, color: R.sec, fontFamily: R.mono }}>{dealFiles.length} FILE{dealFiles.length !== 1 ? 'S' : ''}</span>
                  : undefined
              } />
              <div style={{ padding: '6px 8px' }}>
                {dealFiles.length === 0 ? (
                  <div style={{ fontSize: 8, color: R.sec, fontFamily: R.mono, padding: '8px 2px', textAlign: 'center' }}>
                    No files — upload docs in <span style={{ color: R.amber }}>Documents</span> tab
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 148, overflowY: 'auto' }}>
                    {dealFiles.map(f => {
                      const ext = (f.file_extension ?? '').replace('.', '').toUpperCase() || 'FILE';
                      const extColor = ext === 'PDF' ? R.red : ext === 'XLSX' || ext === 'XLS' ? R.green : ext === 'DOCX' || ext === 'DOC' ? T.text.cyan : R.amber;
                      return (
                        <a key={f.id} href={`/api/v1/deals/${dealId}/files/${f.id}/download`} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 5px', borderRadius: 3, background: R.hdr, border: `1px solid ${R.bs}`, textDecoration: 'none' }}>
                          <span style={{ fontSize: 6, fontFamily: R.mono, fontWeight: 700, background: extColor + '1A', border: `1px solid ${extColor}55`, borderRadius: 2, padding: '1px 3px', color: extColor, flexShrink: 0, minWidth: 22, textAlign: 'center' }}>{ext.slice(0, 4)}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 8, color: R.pri, fontFamily: R.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.original_filename}</div>
                            <div style={{ fontSize: 7, color: R.sec, fontFamily: R.mono, textTransform: 'uppercase' }}>{(f.category ?? '').replace(/_/g, ' ')}</div>
                          </div>
                          <span style={{ fontSize: 9, color: R.amber, flexShrink: 0 }}>↗</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Constraint Parameters */}
            <div style={{ background: R.panel, border: `1px solid ${R.bm}`, borderRadius: 4, overflow: 'hidden', flex: 1 }}>
              <PanelHdr title="CONSTRAINT PARAMETERS" />
              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>
                  <label style={labelStyle}>SPREAD OVER {benchmark} (bps)</label>
                  <input style={fieldStyle} type="number" value={spreadBps} onChange={e => setSpreadBps(Number(e.target.value))} />
                </div>
                <div>
                  <label style={labelStyle}>CAP RATE (%)</label>
                  <input style={fieldStyle} type="number" step="0.1" value={capRatePct} onChange={e => setCapRatePct(Number(e.target.value))} />
                </div>
                <div>
                  <label style={labelStyle}>MAX LTV (%)</label>
                  <input style={fieldStyle} type="number" step="1" value={maxLtv} onChange={e => setMaxLtv(Number(e.target.value))} />
                </div>
                <div>
                  <label style={labelStyle}>MIN DSCR</label>
                  <input style={fieldStyle} type="number" step="0.05" value={minDscr} onChange={e => setMinDscr(Number(e.target.value))} />
                </div>
                <div>
                  <label style={labelStyle}>MIN DEBT YIELD (%)</label>
                  <input style={fieldStyle} type="number" step="0.1" value={minDebtYield} onChange={e => setMinDebtYield(Number(e.target.value))} />
                </div>
              </div>
            </div>
          </div>

          {/* ── CENTER: Chart ── */}
          <div style={{ background: R.panel, border: `1px solid ${R.bm}`, borderRadius: 4, overflow: 'hidden' }}>
            <PanelHdr title="DEBT PROCEEDS TREND" sub={`${noiPeriod} NOI · ${benchmark}+${spreadBps}bps all-in`} right={
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { color: R.red, label: 'LTV' },
                  { color: R.orange, label: 'DSCR' },
                  { color: R.purple, label: 'DY' },
                  { color: R.amber, label: 'BINDING', dash: true },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <svg width="12" height="8"><line x1="0" y1="4" x2="12" y2="4" stroke={l.color} strokeWidth="1.5" strokeDasharray={l.dash ? '3,2' : undefined} /></svg>
                    <span style={{ fontSize: 7, color: R.sec, fontFamily: R.mono }}>{l.label}</span>
                  </div>
                ))}
              </div>
            } />

            {/* KPI strip */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${R.bm}` }}>
              {[
                { label: `${noiPeriod} NOI (ANN.)`, val: noiAnnualized != null ? fm(noiAnnualized) : actualsWithNoi.length === 0 ? 'NO ACTUALS' : '—', c: R.pri },
                { label: 'PROPERTY VALUE', val: propertyValue ? fm(propertyValue) : '—', c: R.sec },
                { label: 'DATA MONTHS', val: actualsWithNoi.length > 0 ? `${actualsWithNoi.length} MO` : 'NONE', c: actualsWithNoi.length > 0 ? R.green : R.red },
                { label: 'MAX PROCEEDS', val: fm(maxProceeds), c: R.amber },
              ].map((s, si) => (
                <div key={s.label} style={{ flex: 1, padding: '7px 10px', borderRight: si < 3 ? `1px solid ${R.bm}` : undefined }}>
                  <div style={{ fontSize: 7, color: R.sec, fontFamily: R.mono, letterSpacing: '0.04em' }}>{s.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, fontFamily: R.mono, color: s.c, marginTop: 2 }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* SVG */}
            <div style={{ padding: '8px 8px 4px' }}>
              {trendData.length < 2 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, color: R.sec, fontSize: 9, fontFamily: R.mono }}>
                  {actualsWithNoi.length === 0 ? 'Enter actuals to see proceeds trend' : 'Need ≥ 2 months of actuals'}
                </div>
              ) : (
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
                  {/* Grid lines */}
                  {[0.25, 0.5, 0.75, 1].map(f => {
                    const y = toY(chartMax * f);
                    const v = chartMax * f;
                    return (
                      <g key={f}>
                        <line x1={PL} y1={y} x2={W - PR} y2={y} stroke={R.bs} strokeWidth="1" />
                        <text x={PL - 4} y={y + 3} textAnchor="end" fontSize="7" fill={R.sec} fontFamily="JetBrains Mono,monospace">
                          {v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}k`}
                        </text>
                      </g>
                    );
                  })}
                  {/* X axis */}
                  <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke={R.bm} strokeWidth="1" />
                  {trendData.map((d, i) => (
                    (i === 0 || i === trendData.length - 1 || i % Math.ceil(trendData.length / 5) === 0) && (
                      <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize="7" fill={R.sec} fontFamily="JetBrains Mono,monospace">{d.month}</text>
                    )
                  ))}
                  {/* Constraint lines */}
                  <polyline points={pts('ltv')}  fill="none" stroke={R.red}    strokeWidth="1.5" strokeOpacity="0.65" />
                  <polyline points={pts('dscr')} fill="none" stroke={R.orange} strokeWidth="1.5" strokeOpacity="0.65" />
                  <polyline points={pts('dy')}   fill="none" stroke={R.purple} strokeWidth="1.5" strokeOpacity="0.65" />
                  {/* Binding line — amber dashed */}
                  <polyline points={pts('binding')} fill="none" stroke={R.amber} strokeWidth="2" strokeDasharray="5,3" />
                  {/* Area fill under binding */}
                  <polygon points={`${PL},${H - PB} ${pts('binding')} ${toX(trendData.length - 1)},${H - PB}`} fill={R.amber} fillOpacity="0.04" />
                  {/* Last point callout */}
                  {(() => {
                    const last = trendData[trendData.length - 1];
                    const li = trendData.length - 1;
                    const cx = toX(li), cy = toY(last.binding);
                    return (
                      <g>
                        <circle cx={cx} cy={cy} r="4" fill={R.amber} />
                        <circle cx={cx} cy={cy} r="7" fill="none" stroke={R.amber} strokeWidth="1" strokeOpacity="0.4" />
                      </g>
                    );
                  })()}
                </svg>
              )}
            </div>
          </div>

          {/* ── RIGHT: Result ── */}
          <div style={{ background: R.panel, border: `1px solid ${binding ? constraintColor(binding) + '55' : R.bm}`, borderRadius: 4, overflow: 'hidden' }}>
            <PanelHdr title="CURRENT ANALYSIS" sub={`${noiPeriod} actuals`} right={
              noiAnnualized && binding
                ? <span style={{ fontSize: 7, fontWeight: 700, fontFamily: R.mono, color: constraintColor(binding), background: constraintColor(binding) + '18', border: `1px solid ${constraintColor(binding)}44`, borderRadius: 2, padding: '2px 5px' }}>{binding} BINDING</span>
                : undefined
            } />

            <div style={{ padding: '10px' }}>
              {!noiAnnualized ? (
                <div style={{ color: R.sec, fontSize: 9, fontFamily: R.mono, padding: '20px 0', textAlign: 'center', lineHeight: 1.7 }}>
                  {actualsWithNoi.length === 0
                    ? <>No actuals data<br /><span style={{ fontSize: 8, color: R.sec }}>Enter monthly actuals in Documents tab</span></>
                    : 'Computing…'}
                </div>
              ) : (
                <>
                  {/* Feasibility badge */}
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 2, fontWeight: 700, fontSize: 9, fontFamily: R.mono, letterSpacing: '0.06em',
                      background: isFeasible ? R.green + '1A' : R.red + '1A',
                      border: `1px solid ${isFeasible ? R.green + '55' : R.red + '55'}`,
                      color: isFeasible ? R.green : R.red }}>
                      {isFeasible ? '◆ REFINANCEABLE' : '✕ NOT FEASIBLE'}
                    </span>
                  </div>

                  {/* Constraint rows */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 8, color: R.sec, fontFamily: R.mono, marginBottom: 5, letterSpacing: '0.05em' }}>MAX PROCEEDS BY CONSTRAINT</div>
                    {[
                      { label: 'LTV', val: maxByLtv, c: R.red },
                      { label: 'DSCR', val: maxByDscr, c: R.orange },
                      { label: 'DEBT YIELD', val: maxByDy, c: R.purple },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: `1px solid ${R.bs}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 4, height: 4, borderRadius: '50%', background: r.c }} />
                          <span style={{ fontSize: 8, fontFamily: R.mono, color: R.sec }}>{r.label}</span>
                          {binding === r.label && (
                            <span style={{ fontSize: 7, fontWeight: 700, fontFamily: R.mono, color: r.c, background: r.c + '1A', border: `1px solid ${r.c}55`, borderRadius: 2, padding: '0px 4px' }}>▲ BINDING</span>
                          )}
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, fontFamily: R.mono, color: binding === r.label ? r.c : R.pri }}>{fm(r.val)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Metric tiles */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 10 }}>
                    {[
                      { label: 'MAX PROCEEDS', val: fm(maxProceeds), c: R.amber },
                      { label: 'CASH OUT/(PAY)', val: cashOut != null ? cashOut >= 0 ? fm(cashOut) : `(${fm(-cashOut)})` : '—', c: cashOut != null && cashOut >= 0 ? R.green : R.red },
                      { label: 'POST-REFI DSCR', val: dscrCheck ? dscrCheck.toFixed(2) + 'x' : '—', c: (dscrCheck ?? 0) >= minDscr ? R.green : R.red },
                      { label: 'ANNUAL DEBT SVC', val: fm(annualDebtSvc), c: R.sec },
                    ].map(m => (
                      <div key={m.label} style={{ background: R.hdr, border: `1px solid ${R.bm}`, borderRadius: 3, padding: '6px 7px' }}>
                        <div style={{ fontSize: 7, color: R.sec, fontFamily: R.mono, marginBottom: 3, letterSpacing: '0.04em' }}>{m.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, fontFamily: R.mono, color: m.c }}>{m.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Save */}
                  <label style={labelStyle}>SCENARIO NAME</label>
                  <input style={{ ...fieldStyle, marginBottom: 6 }} value={scenarioName} onChange={e => setScenarioName(e.target.value)} />
                  {runError && <div style={{ marginBottom: 5, fontSize: 8, color: R.red, fontFamily: R.mono }}>{runError}</div>}
                  <button onClick={saveScenario} disabled={runLoading || !noiAnnualized}
                    style={{ width: '100%', padding: '7px 0', background: runLoading ? R.hdr : R.amber + '1A', border: `1px solid ${runLoading ? R.bm : R.amber + '77'}`, borderRadius: 3, fontSize: 9, fontWeight: 700, fontFamily: R.mono, color: runLoading ? R.sec : R.amber, cursor: runLoading ? 'not-allowed' : 'pointer', letterSpacing: '0.06em' }}>
                    {runLoading ? 'SAVING...' : '▶ SAVE TO HISTORY'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ══ Scenario History ══ */}
        <div style={{ background: R.panel, border: `1px solid ${R.bm}`, borderRadius: 4, overflow: 'hidden' }}>
          <PanelHdr title="SCENARIO HISTORY" sub="last 20 saved tests" right={
            <span style={{ fontSize: 7, color: R.sec, fontFamily: R.mono }}>{history.length} RECORDS</span>
          } />
          {histLoading && <div style={{ padding: 14, textAlign: 'center', fontSize: 9, color: R.sec, fontFamily: R.mono }}>Loading…</div>}
          {!histLoading && history.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', fontSize: 9, color: R.sec, fontFamily: R.mono }}>
              No scenarios saved yet — fill out the analysis above and click <span style={{ color: R.amber }}>SAVE TO HISTORY</span>
            </div>
          )}
          {!histLoading && history.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8, fontFamily: R.mono }}>
              <thead>
                <tr style={{ background: T.bg.terminal }}>
                  {[
                    { h: 'DATE', r: false }, { h: 'SCENARIO', r: false }, { h: 'NOI', r: true },
                    { h: 'CAP', r: true }, { h: 'BINDING', r: false }, { h: 'MAX PROCEEDS', r: true },
                    { h: 'CASH OUT', r: true }, { h: 'DSCR', r: false }, { h: 'STATUS', r: false },
                  ].map(({ h, r }) => (
                    <th key={h} style={{ padding: '5px 10px', textAlign: r ? 'right' : 'left', color: R.amber, fontWeight: 700, letterSpacing: '0.05em', borderBottom: `1px solid ${R.bm}`, borderRight: `1px solid ${R.bs}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? 'transparent' : R.hdr + '80', borderBottom: `1px solid ${R.bs}` }}>
                    <td style={{ padding: '4px 10px', color: R.sec, borderRight: `1px solid ${R.bs}` }}>{new Date(row.test_date).toLocaleDateString()}</td>
                    <td style={{ padding: '4px 10px', color: R.pri, borderRight: `1px solid ${R.bs}` }}>{row.scenario_name}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right', color: R.sec, borderRight: `1px solid ${R.bs}` }}>{row.assumed_noi ? `$${(row.assumed_noi / 1000).toFixed(0)}k` : '—'}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right', color: R.sec, borderRight: `1px solid ${R.bs}` }}>{row.assumed_cap_rate ? fp(row.assumed_cap_rate, 1) : '—'}</td>
                    <td style={{ padding: '4px 10px', color: constraintColor(row.constrained_by), fontWeight: 700, borderRight: `1px solid ${R.bs}` }}>{row.constrained_by?.toUpperCase() ?? '—'}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right', color: R.amber, fontWeight: 700, borderRight: `1px solid ${R.bs}` }}>{row.max_loan_proceeds ? `$${(row.max_loan_proceeds / 1e6).toFixed(2)}M` : '—'}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right', color: row.cash_out_available >= 0 ? R.green : R.red, borderRight: `1px solid ${R.bs}` }}>
                      {row.cash_out_available != null ? (row.cash_out_available >= 0 ? `$${(row.cash_out_available / 1000).toFixed(0)}k` : `(${((-row.cash_out_available) / 1000).toFixed(0)}k)`) : '—'}
                    </td>
                    <td style={{ padding: '4px 10px', color: (row.dscr_post_refi ?? 0) >= 1.25 ? R.green : R.red, borderRight: `1px solid ${R.bs}` }}>{row.dscr_post_refi ? row.dscr_post_refi.toFixed(2) + 'x' : '—'}</td>
                    <td style={{ padding: '4px 10px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 2, fontSize: 7, fontWeight: 700, background: row.is_feasible ? R.green + '18' : R.red + '18', border: `1px solid ${row.is_feasible ? R.green + '44' : R.red + '44'}`, color: row.is_feasible ? R.green : R.red }}>
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

// ─── Traffic Tab (Forecast vs Actual) ───────────────────────────────────
interface TrafficData {
  week: string;
  weekEnd: string;
  forecast_traffic: number | null;
  actual_traffic: number | null;
  forecast_leases: number | null;
  actual_leases: number | null;
  forecast_conversion: number | null;
  actual_conversion: number | null;
  occupancy_pct: number | null;
}

const TrafficTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [data, setData] = useState<TrafficData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/api/v1/deals/${dealId}/traffic/forecast-vs-actual?weeks=12`)
      .then(res => setData(res.data?.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return <div style={{ padding: 20, color: T.text.muted }}>Loading...</div>;

  const weeksWithActual = data.filter(d => d.actual_traffic != null).length;
  const avgVariance = weeksWithActual > 0 ? data.reduce((sum, d) => {
    if (d.forecast_traffic && d.actual_traffic) {
      return sum + ((d.actual_traffic - d.forecast_traffic) / d.forecast_traffic) * 100;
    }
    return sum;
  }, 0) / weeksWithActual : 0;
  const forecastAccuracy = 100 - Math.abs(avgVariance);
  const maxTraffic = Math.max(...data.map(d => Math.max(d.forecast_traffic || 0, d.actual_traffic || 0)), 1);

  return (
    <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Panel>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>FORECAST ACCURACY</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: forecastAccuracy >= 85 ? T.text.green : T.text.amber, fontFamily: T.font.mono }}>
              {forecastAccuracy.toFixed(0)}%
            </div>
          </div>
        </Panel>
        <Panel>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>AVG VARIANCE</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: avgVariance >= 0 ? T.text.green : T.text.red, fontFamily: T.font.mono }}>
              {avgVariance >= 0 ? '+' : ''}{avgVariance.toFixed(1)}%
            </div>
          </div>
        </Panel>
        <Panel>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>WEEKS WITH DATA</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: T.text.cyan, fontFamily: T.font.mono }}>
              {weeksWithActual}/{data.length}
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="FORECAST VS ACTUAL TRAFFIC">
        <div style={{ padding: 16 }}>
          {data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: T.text.muted, fontFamily: T.font.mono, fontSize: 11 }}>
              No traffic data available. Record actuals to compare against forecasts.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontFamily: T.font.mono }}>
                  <div style={{ width: 12, height: 12, background: T.text.cyan, borderRadius: 2 }} />
                  <span style={{ color: T.text.secondary }}>Forecast</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontFamily: T.font.mono }}>
                  <div style={{ width: 12, height: 12, background: T.text.green, borderRadius: 2 }} />
                  <span style={{ color: T.text.secondary }}>Actual</span>
                </div>
              </div>
              <svg viewBox={`0 0 ${data.length * 50} 120`} style={{ width: '100%', height: 120 }}>
                {data.map((d, i) => {
                  const x = i * 50;
                  const forecastH = d.forecast_traffic ? (d.forecast_traffic / maxTraffic) * 100 : 0;
                  const actualH = d.actual_traffic ? (d.actual_traffic / maxTraffic) * 100 : 0;
                  return (
                    <g key={i}>
                      <rect x={x + 5} y={110 - forecastH} width={18} height={forecastH} fill={T.text.cyan} opacity={0.7} rx={2} />
                      {d.actual_traffic != null && (
                        <rect x={x + 26} y={110 - actualH} width={18} height={actualH} fill={d.actual_traffic >= (d.forecast_traffic || 0) ? T.text.green : T.text.red} opacity={0.85} rx={2} />
                      )}
                    </g>
                  );
                })}
              </svg>
            </>
          )}
        </div>
      </Panel>

      <Panel title="WEEKLY DETAIL">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border.medium}` }}>
                <th style={{ padding: '8px', textAlign: 'left', color: T.text.muted }}>Week</th>
                <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>Forecast</th>
                <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>Actual</th>
                <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>Variance</th>
                <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>Conv %</th>
                <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>Leases</th>
                <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>Occ %</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => {
                const variance = d.forecast_traffic && d.actual_traffic
                  ? ((d.actual_traffic - d.forecast_traffic) / d.forecast_traffic) * 100
                  : null;
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                    <td style={{ padding: '8px', color: T.text.primary }}>{d.week}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: T.text.cyan }}>{d.forecast_traffic ?? '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: d.actual_traffic != null ? T.text.green : T.text.muted }}>
                      {d.actual_traffic ?? '—'}
                    </td>
                    <td style={{
                      padding: '8px',
                      textAlign: 'right',
                      color: variance == null ? T.text.muted : variance >= 0 ? T.text.green : T.text.red,
                    }}>
                      {variance != null ? `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', color: T.text.secondary }}>
                      {d.actual_conversion != null ? `${(d.actual_conversion * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', color: T.text.primary }}>{d.actual_leases ?? '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: T.text.amber }}>
                      {d.occupancy_pct != null ? `${d.occupancy_pct.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};

// ─── Activity Tab (Emails + Tasks) ───────────────────────────────────
interface DealEmail {
  id: string;
  subject: string;
  from_address: string;
  snippet: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
}

interface DealTask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to_name: string | null;
}

interface ActivityItem {
  id: string;
  type: 'email' | 'task' | 'event';
  title: string;
  description: string;
  timestamp: string;
  actor: string;
}

const ActivityTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [activeSubTab, setActiveSubTab] = useState<'unified' | 'emails' | 'tasks'>('unified');
  const [emails, setEmails] = useState<DealEmail[]>([]);
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [unified, setUnified] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium', due_date: '' });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.get(`/api/v1/deals/${dealId}/activity/emails?limit=20`).catch(() => ({ data: { emails: [] } })),
      apiClient.get(`/api/v1/deals/${dealId}/activity/tasks`).catch(() => ({ data: { tasks: [] } })),
      apiClient.get(`/api/v1/deals/${dealId}/activity/unified?limit=30`).catch(() => ({ data: { activity: [] } })),
    ]).then(([emailsRes, tasksRes, unifiedRes]) => {
      setEmails(emailsRes.data?.emails || []);
      setTasks(tasksRes.data?.tasks || []);
      setUnified(unifiedRes.data?.activity || []);
    }).finally(() => setLoading(false));
  }, [dealId]);

  const createTask = async () => {
    if (!newTask.title) return;
    try {
      await apiClient.post(`/api/v1/deals/${dealId}/activity/tasks`, newTask);
      const res = await apiClient.get(`/api/v1/deals/${dealId}/activity/tasks`);
      setTasks(res.data?.tasks || []);
      setNewTask({ title: '', priority: 'medium', due_date: '' });
      setShowNewTask(false);
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/activity/tasks/${taskId}`, { status });
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status } : t));
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  if (loading) return <div style={{ padding: 20, color: T.text.muted }}>Loading...</div>;

  const openTasks = tasks.filter(t => t.status !== 'done').length;

  return (
    <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['unified', 'emails', 'tasks'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            style={{
              padding: '6px 14px',
              background: activeSubTab === tab ? T.bg.active : 'transparent',
              border: `1px solid ${activeSubTab === tab ? T.text.amber : T.border.subtle}`,
              borderRadius: 4,
              color: activeSubTab === tab ? T.text.amber : T.text.secondary,
              fontSize: 10,
              fontFamily: T.font.mono,
              fontWeight: activeSubTab === tab ? 700 : 400,
              cursor: 'pointer',
            }}
          >
            {tab === 'unified' ? 'All Activity' : tab === 'emails' ? `Emails (${emails.length})` : `Tasks (${openTasks})`}
          </button>
        ))}
      </div>

      {activeSubTab === 'unified' && (
        <Panel title="RECENT ACTIVITY">
          <div style={{ padding: 12 }}>
            {unified.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: T.text.muted, fontFamily: T.font.mono, fontSize: 10 }}>NO ACTIVITY YET</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {unified.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    gap: 10,
                    padding: '8px 10px',
                    background: T.bg.panelAlt,
                    borderRadius: 4,
                    borderLeft: `3px solid ${
                      item.type === 'email' ? T.text.cyan :
                      item.type === 'task' ? T.text.amber :
                      T.text.purple
                    }`,
                  }}>
                    <span style={{ fontSize: 14 }}>
                      {item.type === 'email' ? '✉️' : item.type === 'task' ? '✅' : '📅'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: T.text.primary, fontFamily: T.font.mono }}>
                        {item.title}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginTop: 2 }}>
                          {item.description.slice(0, 100)}{item.description.length > 100 ? '...' : ''}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, whiteSpace: 'nowrap' }}>
                      {new Date(item.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}

      {activeSubTab === 'emails' && (
        <Panel title="DEAL EMAILS">
          <div style={{ padding: 12 }}>
            {emails.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: T.text.muted, fontFamily: T.font.mono, fontSize: 10 }}>
                NO EMAILS LINKED TO THIS DEAL
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {emails.map((email) => (
                  <div key={email.id} style={{
                    display: 'flex',
                    gap: 10,
                    padding: '10px 12px',
                    background: email.is_read ? 'transparent' : T.bg.panelAlt,
                    borderRadius: 4,
                    border: `1px solid ${T.border.subtle}`,
                  }}>
                    <span style={{ fontSize: 14 }}>{email.is_starred ? '⭐' : '✉️'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 10,
                        fontWeight: email.is_read ? 400 : 700,
                        color: T.text.primary,
                        fontFamily: T.font.mono,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {email.subject || '(no subject)'}
                      </div>
                      <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>
                        {email.from_address}
                      </div>
                      <div style={{ fontSize: 9, color: T.text.secondary, fontFamily: T.font.mono, marginTop: 2 }}>
                        {email.snippet?.slice(0, 100)}...
                      </div>
                    </div>
                    <div style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, whiteSpace: 'nowrap' }}>
                      {new Date(email.received_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}

      {activeSubTab === 'tasks' && (
        <Panel title="DEAL TASKS">
          <div style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                onClick={() => setShowNewTask(true)}
                style={{
                  background: T.text.cyan + '22',
                  border: `1px solid ${T.text.cyan}`,
                  color: T.text.cyan,
                  padding: '6px 12px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontFamily: T.font.mono,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                + New Task
              </button>
            </div>

            {showNewTask && (
              <div style={{
                marginBottom: 16,
                padding: 12,
                background: T.bg.panelAlt,
                border: `1px solid ${T.border.subtle}`,
                borderRadius: 4,
              }}>
                <input
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Task title..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    marginBottom: 8,
                    background: T.bg.input,
                    border: `1px solid ${T.border.subtle}`,
                    borderRadius: 4,
                    color: T.text.primary,
                    fontSize: 11,
                    fontFamily: T.font.mono,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    style={{
                      padding: '6px 8px',
                      background: T.bg.input,
                      border: `1px solid ${T.border.subtle}`,
                      borderRadius: 4,
                      color: T.text.primary,
                      fontSize: 10,
                      fontFamily: T.font.mono,
                    }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    style={{
                      padding: '6px 8px',
                      background: T.bg.input,
                      border: `1px solid ${T.border.subtle}`,
                      borderRadius: 4,
                      color: T.text.primary,
                      fontSize: 10,
                      fontFamily: T.font.mono,
                    }}
                  />
                  <button onClick={createTask} style={{
                    background: T.text.green + '22',
                    border: `1px solid ${T.text.green}`,
                    color: T.text.green,
                    padding: '6px 12px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontFamily: T.font.mono,
                    cursor: 'pointer',
                  }}>Save</button>
                  <button onClick={() => setShowNewTask(false)} style={{
                    background: 'transparent',
                    border: `1px solid ${T.border.subtle}`,
                    color: T.text.muted,
                    padding: '6px 12px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontFamily: T.font.mono,
                    cursor: 'pointer',
                  }}>Cancel</button>
                </div>
              </div>
            )}

            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: T.text.muted, fontFamily: T.font.mono, fontSize: 10 }}>
                NO TASKS FOR THIS DEAL
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {tasks.map((task) => (
                  <div key={task.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: task.status === 'done' ? 'transparent' : T.bg.panelAlt,
                    borderRadius: 4,
                    border: `1px solid ${T.border.subtle}`,
                    opacity: task.status === 'done' ? 0.5 : 1,
                  }}>
                    <input
                      type="checkbox"
                      checked={task.status === 'done'}
                      onChange={() => updateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
                      style={{ cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: T.text.primary,
                        fontFamily: T.font.mono,
                        textDecoration: task.status === 'done' ? 'line-through' : 'none',
                      }}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>
                          {task.description.slice(0, 80)}...
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 8,
                      padding: '2px 6px',
                      borderRadius: 3,
                      fontFamily: T.font.mono,
                      background: task.priority === 'urgent' ? T.text.red + '22' :
                                  task.priority === 'high' ? T.text.amber + '22' :
                                  T.text.muted + '22',
                      color: task.priority === 'urgent' ? T.text.red :
                             task.priority === 'high' ? T.text.amber :
                             T.text.muted,
                    }}>
                      {task.priority.toUpperCase()}
                    </span>
                    {task.due_date && (
                      <div style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono }}>
                        {new Date(task.due_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
};

// ─── Reports Tab ──────────────────────────────────────────────
interface ReportMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  ts: Date;
  copied?: boolean;
}

interface ReportsTabProps {
  dealId: string;
  financials: MonthlyFinancial[];
  deal: Record<string, unknown>;
}

const REPORT_PROMPTS: { category: string; prompts: string[] }[] = [
  { category: 'NOI & REVENUE', prompts: [
    'Generate an NOI waterfall report',
    'Analyze revenue vs operating expenses',
    'Year-over-year revenue trend summary',
  ]},
  { category: 'PERFORMANCE', prompts: [
    'Deal performance vs underwriting',
    'Occupancy trend and lease-up analysis',
    'Cash-on-cash return summary',
  ]},
  { category: 'DEBT & CAPITAL', prompts: [
    'Debt summary and maturity schedule',
    'Refi readiness assessment',
    'LTV and DSCR covenant analysis',
  ]},
  { category: 'INVESTOR', prompts: [
    'Quarterly investor update memo',
    'Return of capital and distribution timeline',
    'Asset-level investment thesis review',
  ]},
];

const ReportsTab: React.FC<ReportsTabProps> = ({ dealId, financials, deal }) => {
  const propName = (deal.property_name ?? deal.project_name ?? `property-${dealId}`) as string;
  const safeSlug = propName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const [messages, setMessages] = useState<ReportMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId] = useState(() => `report-${dealId}-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  /* Agent fetches its own data from the database via tool calls —
     no manual context injection needed. financials.length is shown in the footer. */

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ReportMessage = { id: Date.now().toString(), role: 'user', content: text.trim(), ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res: any = await apiClient.post(
        `/api/v1/portfolio/${dealId}/agent-report`,
        { prompt: text.trim(), conversationId }
      );
      const agentMsg: ReportMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: res.data?.response ?? res.data?.message ?? 'No response received.',
        ts: new Date(),
      };
      setMessages(prev => [...prev, agentMsg]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'agent', content: 'Error reaching the report agent. Please try again.', ts: new Date() }]);
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const copyMsg = (id: string, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, copied: true } : m));
      setTimeout(() => setMessages(prev => prev.map(m => m.id === id ? { ...m, copied: false } : m)), 1500);
    });
  };

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
    ]), ['Month', 'NOI', 'Occupancy', 'Avg Rent', 'Revenue', 'OpEx']);
  };
  const exportRentRoll = async () => {
    const r = await apiClient.get(`/api/v1/operations/${dealId}/rent-roll`).catch(() => ({ data: { units: [] } }));
    const units = r.data?.units ?? [];
    downloadCSV(`${safeSlug}-rent-roll.csv`, units.map((u: Record<string, unknown>) => [
      String(u.unit_number ?? ''), String(u.unit_type ?? ''), String(u.status ?? ''),
      String(u.current_rent ?? ''), String(u.market_rent ?? ''), String(u.sqft ?? ''),
      ((u.lease_start as string) ?? '').slice(0, 10), ((u.lease_end as string) ?? '').slice(0, 10),
    ]), ['Unit', 'Type', 'Status', 'Rent', 'Market Rent', 'Sqft', 'Lease Start', 'Lease End']);
  };

  const btnStyle: React.CSSProperties = {
    padding: '4px 10px', fontSize: 9, fontWeight: 600, background: T.bg.active,
    color: T.text.secondary, border: `1px solid ${T.border.medium}`,
    borderRadius: 2, cursor: 'pointer', fontFamily: T.font.mono, letterSpacing: '0.04em',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 280px)', background: T.bg.terminal, overflow: 'hidden' }}>

      {/* ══ Top bar ══ */}
      <div style={{ background: T.bg.header, borderBottom: `2px solid ${T.text.amber}22`, padding: '7px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: T.font.mono, color: T.text.amber, letterSpacing: '0.1em' }}>REPORT AGENT</span>
          <span style={{ fontSize: 8, color: T.text.secondary, fontFamily: T.font.mono }}>{propName.toUpperCase()}  ·  ASK FOR ANY REPORT</span>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          <button onClick={exportFinancials} disabled={financials.length === 0} style={{ ...btnStyle, opacity: financials.length === 0 ? 0.4 : 1 }}>⬇ MONTHLY CSV</button>
          <button onClick={exportRentRoll} style={btnStyle}>⬇ RENT ROLL CSV</button>
        </div>
      </div>

      {/* ══ Body: sidebar + chat ══ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Prompt sidebar */}
        <div style={{ width: 198, borderRight: `1px solid ${T.border.medium}`, overflowY: 'auto', flexShrink: 0, background: T.bg.panel }}>
          <div style={{ padding: '8px 10px 4px', fontSize: 8, color: T.text.amber, fontFamily: T.font.mono, fontWeight: 700, letterSpacing: '0.07em', borderBottom: `1px solid ${T.border.subtle}` }}>
            REPORT TEMPLATES
          </div>
          {REPORT_PROMPTS.map(group => (
            <div key={group.category}>
              <div style={{ padding: '7px 10px 3px', fontSize: 7, color: T.text.secondary, fontFamily: T.font.mono, letterSpacing: '0.06em', fontWeight: 700 }}>{group.category}</div>
              {group.prompts.map(p => (
                <button key={p} onClick={() => sendMessage(p)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 10px', fontSize: 9, fontFamily: T.font.mono, color: T.text.secondary, background: 'transparent', border: 'none', borderBottom: `1px solid ${T.border.subtle}`, cursor: 'pointer', lineHeight: 1.35 }}>
                  {p}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', paddingTop: 60 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: T.font.mono, color: T.text.amber, letterSpacing: '0.08em', marginBottom: 6 }}>REPORT AGENT READY</div>
                <div style={{ fontSize: 10, color: T.text.secondary, fontFamily: T.font.mono, maxWidth: 360, lineHeight: 1.6 }}>
                  Ask for any custom report — NOI analysis, investor memo, debt summary, occupancy trend, or anything else. Choose a template on the left or type your own request below.
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'agent' && (
                  <div style={{ fontSize: 7, color: T.text.amber, fontFamily: T.font.mono, fontWeight: 700, letterSpacing: '0.07em', marginBottom: 3 }}>REPORT AGENT · {msg.ts.toLocaleTimeString()}</div>
                )}
                <div style={{
                  background: msg.role === 'user' ? T.bg.active : T.bg.panelAlt,
                  border: `1px solid ${msg.role === 'user' ? T.text.amber + '44' : T.border.medium}`,
                  borderRadius: msg.role === 'user' ? '6px 6px 2px 6px' : '6px 6px 6px 2px',
                  padding: '10px 13px',
                  fontSize: 10,
                  fontFamily: T.font.mono,
                  color: T.text.primary,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.65,
                }}>
                  {msg.content}
                </div>
                {msg.role === 'agent' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button onClick={() => copyMsg(msg.id, msg.content)} style={{ fontSize: 7, fontFamily: T.font.mono, color: msg.copied ? T.text.green : T.text.secondary, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                      {msg.copied ? '✓ COPIED' : 'COPY'}
                    </button>
                    <button onClick={() => {
                      const blob = new Blob([msg.content], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = `${safeSlug}-report-${msg.ts.toISOString().slice(0,10)}.txt`; a.click();
                    }} style={{ fontSize: 7, fontFamily: T.font.mono, color: T.text.secondary, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                      ⬇ EXPORT
                    </button>
                  </div>
                )}
                {msg.role === 'user' && (
                  <div style={{ fontSize: 7, color: T.text.secondary, fontFamily: T.font.mono, marginTop: 3 }}>{msg.ts.toLocaleTimeString()}</div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, maxWidth: '85%' }}>
                <div style={{ background: T.bg.panelAlt, border: `1px solid ${T.border.medium}`, borderRadius: '6px 6px 6px 2px', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0, 0.2, 0.4].map(d => (
                      <div key={d} style={{ width: 5, height: 5, borderRadius: '50%', background: T.text.amber, opacity: 0.7, animation: `raTyping 1.2s ${d}s ease-in-out infinite` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div style={{ borderTop: `1px solid ${T.border.medium}`, background: T.bg.panel, padding: '10px 14px', flexShrink: 0 }}>
            <style>{`
              @keyframes raTyping { 0%,80%,100%{transform:scale(0.7);opacity:0.4} 40%{transform:scale(1);opacity:1} }
              .ra-textarea:focus { outline: none; border-color: ${T.text.amber}66 !important; }
              .ra-prompt-btn:hover { background: ${T.bg.hover} !important; color: ${T.text.primary} !important; }
            `}</style>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                ref={textareaRef}
                className="ra-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder="Describe the report you need… (Enter to send, Shift+Enter for new line)"
                rows={2}
                style={{ flex: 1, background: T.bg.input, border: `1px solid ${T.border.medium}`, borderRadius: 3, padding: '8px 10px', fontSize: 10, fontFamily: T.font.mono, color: T.text.primary, resize: 'none', lineHeight: 1.5 }}
              />
              <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
                style={{ padding: '0 18px', height: 48, background: loading || !input.trim() ? T.bg.active : T.text.amber + '22', border: `1px solid ${loading || !input.trim() ? T.border.medium : T.text.amber + '88'}`, borderRadius: 3, fontSize: 9, fontWeight: 700, fontFamily: T.font.mono, color: loading || !input.trim() ? T.text.secondary : T.text.amber, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', letterSpacing: '0.07em', flexShrink: 0 }}>
                {loading ? '...' : 'SEND →'}
              </button>
            </div>
            <div style={{ marginTop: 5, fontSize: 7, color: T.text.secondary, fontFamily: T.font.mono }}>
              Deal context auto-included  ·  {financials.length} months of actuals available  ·  Shift+Enter for new line
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────
export default function PortfolioPropertyPage() {
  // Neural network context awareness
  const { analysis: ctxAnalysis, loading: ctxLoading } = useAutoContextAnalysis({ context: 'deal_overview' });

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
    if (!leaseData) {
      apiClient.get(`/api/v1/portfolio/${dealId}/leasing?limit=100`).then(r => setLeaseData(r.data));
    }
    if (!trafficData.length) {
      apiClient.get(`/api/v1/portfolio/${dealId}/traffic`).then(r => setTrafficData(r.data?.data || []));
    }
  // hook intentionally captures leaseData, trafficData.length via the closure rather than re-running on each change — re-running on the listed deps is the desired trigger; the omitted values are read from the enclosing scope at the moment of fire.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      { id: 'traffic',   short: 'Traffic' },
      { id: 'revenue',   short: 'Operations' },
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
      { id: 'activity',    short: 'Activity' },
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
    const config = unitProgram?.unit_config || [];
    const totalUnits = config.reduce((s: number, u: any) => s + (u.count || 0), 0);

    // Leasing data (may still be loading)
    const ms = leaseData?.monthlyStats ?? [];
    const retData = leaseData?.retentionByQuarter ?? [];
    const newRentData = ms.map(m => toNum(m.avg_new_rent) || 0);
    const renewalRentData = ms.map(m => toNum(m.avg_renewal_rent) || 0);
    const ltlData = ms.map(m => toNum(m.avg_loss_to_lease_pct) || 0);

    // Traffic data (may still be loading)
    const last52 = trafficData.slice(-52);
    const trafficNums = last52.map(w => toNum(w.traffic) || 0);
    const closingNums = last52.map(w => toNum(w.closing_ratio) || 0);
    const occNums = last52.map(w => toNum(w.occ_pct) || 0);
    const latestOcc = occNums.length ? occNums[occNums.length - 1] : null;
    const avgTraffic = trafficNums.length ? trafficNums.reduce((a, b) => a + b, 0) / trafficNums.length : null;
    const avgClosing = closingNums.length ? closingNums.reduce((a, b) => a + b, 0) / closingNums.length : null;
    const currentNewRent = newRentData.length ? newRentData[newRentData.length - 1] : null;
    const currentLtl = ltlData.length ? ltlData[ltlData.length - 1] : null;
    const latestRetention = retData.length ? parseFloat(retData[retData.length - 1].retention_rate) : null;

    // Bed-type mix tiles
    const bedTypes = ['Studio', '1BR', '2BR', '3BR+'].map(bed => {
      const filtered = config.filter((u: any) => {
        const bc = u.bedroom_count || 0;
        if (bed === 'Studio') return bc === 0;
        if (bed === '1BR') return bc === 1;
        if (bed === '2BR') return bc === 2;
        return bc >= 3;
      });
      const count = filtered.reduce((s: number, u: any) => s + (u.count || 0), 0);
      const avgRent = filtered.length
        ? filtered.reduce((s: number, u: any) => s + (u.avg_rent || 0) * (u.count || 0), 0) / Math.max(count, 1)
        : 0;
      return { bed, count, avgRent, pct: totalUnits > 0 ? (count / totalUnits) * 100 : 0 };
    });

    const kpis = [
      { l: 'OCCUPANCY', v: latestOcc != null ? `${latestOcc.toFixed(1)}%` : '—', c: T.text.purple, sub: 'latest week' },
      { l: 'AVG TRAFFIC / WK', v: avgTraffic != null ? avgTraffic.toFixed(1) : '—', c: T.text.blue, sub: 'trailing 52wk' },
      { l: 'CLOSING RATIO', v: avgClosing != null ? `${avgClosing.toFixed(1)}%` : '—', c: T.text.green, sub: 'avg leads→leases' },
      { l: 'NEW LEASE AVG', v: currentNewRent ? fmt(currentNewRent, 'currency') : '—', c: T.text.primary, sub: 'most recent mo' },
      { l: 'LOSS-TO-LEASE', v: currentLtl != null ? `${currentLtl.toFixed(1)}%` : '—', c: currentLtl != null && currentLtl < -5 ? T.text.red : T.text.amber, sub: 'rent vs. market' },
      { l: 'RETENTION', v: latestRetention != null ? `${latestRetention.toFixed(0)}%` : '—', c: T.text.green, sub: 'latest quarter' },
    ];

    return (
      <div style={{ padding: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── KPI strip ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
          {kpis.map(k => (
            <div key={k.l} style={{ background: T.bg.panelAlt, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 4, letterSpacing: 0.5 }}>{k.l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.c, fontFamily: T.font.mono }}>{k.v}</div>
              <div style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Main body: unit mix left + charts right ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12 }}>

          {/* Left: Unit Mix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.text.muted, fontFamily: T.font.mono, letterSpacing: 1, marginBottom: 2 }}>UNIT MIX — {totalUnits} UNITS</div>
            {/* Bedroom type tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {bedTypes.filter(b => b.count > 0).map(b => (
                <div key={b.bed} style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: '8px 10px' }}>
                  <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>{b.bed}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: T.text.primary, fontFamily: T.font.mono }}>{b.count}</div>
                  <div style={{ fontSize: 9, color: T.text.blue, fontFamily: T.font.mono }}>{b.avgRent > 0 ? fmt(b.avgRent, 'currency') : '—'}</div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${b.pct}%`, background: T.text.blue, opacity: 0.5, borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, marginTop: 2 }}>{b.pct.toFixed(0)}% of mix</div>
                </div>
              ))}
              {bedTypes.every(b => b.count === 0) && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 16, color: T.text.muted, fontSize: 9, fontFamily: T.font.mono }}>NO UNIT MIX DATA</div>
              )}
            </div>

            {/* Compact type table */}
            {config.length > 0 && (
              <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, fontFamily: T.font.mono }}>
                  <thead>
                    <tr style={{ background: T.bg.panelAlt }}>
                      {['TYPE', 'CT', 'SF', 'AVG RENT', '$/SF'].map((h, j) => (
                        <th key={h} style={{ textAlign: j === 0 ? 'left' : 'right', padding: '5px 8px', color: T.text.muted, fontWeight: 600, fontSize: 8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...config].sort((a: any, b: any) => (b.count || 0) - (a.count || 0)).map((u: any, i: number) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                        <td style={{ padding: '4px 8px', color: T.text.primary, fontWeight: 600 }}>{u.type || u.unit_type}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: T.text.secondary }}>{u.count}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: T.text.secondary }}>{u.sqft ? u.sqft.toLocaleString() : '—'}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: T.text.blue }}>{fmt(u.avg_rent, 'currency')}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', color: T.text.secondary }}>{u.sqft && u.avg_rent ? `$${(u.avg_rent / u.sqft).toFixed(2)}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: 2×2 chart grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 10 }}>
            <Panel title="NEW LEASE RENT" titleColor={T.text.blue}>
              <div style={{ padding: '6px 12px 10px' }}>
                {ms.length > 0
                  ? <><MiniLineChart data={newRentData} color={T.text.blue} height={90} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, marginTop: 3 }}>
                        <span>{fmtMonth(ms[0].month)}</span><span>{fmtMonth(ms[ms.length - 1].month)}</span>
                      </div></>
                  : <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text.muted, fontSize: 9, fontFamily: T.font.mono }}>No leasing data</div>
                }
              </div>
            </Panel>

            <Panel title="LOSS-TO-LEASE %" titleColor={T.text.red}>
              <div style={{ padding: '6px 12px 10px' }}>
                {ms.length > 0
                  ? <><MiniLineChart data={ltlData} color={T.text.red} height={90} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, marginTop: 3 }}>
                        <span>{fmtMonth(ms[0].month)}</span><span>{fmtMonth(ms[ms.length - 1].month)}</span>
                      </div></>
                  : <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text.muted, fontSize: 9, fontFamily: T.font.mono }}>No leasing data</div>
                }
              </div>
            </Panel>

            <Panel title="WEEKLY TRAFFIC" titleColor={T.text.blue}>
              <div style={{ padding: '6px 12px 10px' }}>
                {trafficNums.length > 0
                  ? <><MiniBarChart data={trafficNums} color={T.text.blue} height={90} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: T.text.muted, fontFamily: T.font.mono, marginTop: 3 }}>
                        {last52[0] && <span>{new Date(last52[0].week_ending).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>}
                        {last52[last52.length - 1] && <span>{new Date(last52[last52.length - 1].week_ending).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>}
                      </div></>
                  : <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text.muted, fontSize: 9, fontFamily: T.font.mono }}>No traffic data</div>
                }
              </div>
            </Panel>

            <Panel title="CLOSING RATIO & RENEWAL RENT" titleColor={T.text.green}>
              <div style={{ padding: '6px 12px 10px' }}>
                {closingNums.length > 0
                  ? <><MiniLineChart data={closingNums} color={T.text.green} height={44} />
                      <MiniLineChart data={renewalRentData.length ? renewalRentData : closingNums} color={T.text.purple} height={40} /></>
                  : <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text.muted, fontSize: 9, fontFamily: T.font.mono }}>No traffic data</div>
                }
              </div>
            </Panel>
          </div>
        </div>

        {/* ── Recent Transactions ── */}
        <Panel title="RECENT LEASE TRANSACTIONS">
          {!leaseData
            ? <div style={{ padding: 24, textAlign: 'center', color: T.text.muted, fontSize: 9, fontFamily: T.font.mono }}>Loading transactions...</div>
            : leaseData.recentTransactions.length === 0
            ? <div style={{ padding: 24, textAlign: 'center', color: T.text.muted, fontSize: 9, fontFamily: T.font.mono }}>No recent transactions</div>
            : (
              <div style={{ overflowX: 'auto', maxHeight: 320 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
                  <thead style={{ position: 'sticky', top: 0, background: T.bg.panelAlt }}>
                    <tr>
                      {['UNIT', 'TYPE', 'LEASE', 'START', 'SF', 'NEW RENT', 'PRIOR', 'MARKET', 'Δ RENT', 'LTL %'].map((h, j) => (
                        <th key={h} style={{ textAlign: j < 4 ? 'left' : 'right', padding: '6px 10px', color: T.text.muted, fontWeight: 600, fontSize: 9 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leaseData.recentTransactions.map((t: any, i: number) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                        <td style={{ padding: '5px 10px', color: T.text.primary, fontWeight: 600 }}>{t.unit_number}</td>
                        <td style={{ padding: '5px 10px', color: T.text.secondary }}>{t.unit_type}</td>
                        <td style={{ padding: '5px 10px' }}>
                          <span style={{ padding: '2px 5px', background: t.lease_type?.trim().toLowerCase() === 'new' ? '#4A9EFF22' : '#A78BFA22', color: t.lease_type?.trim().toLowerCase() === 'new' ? T.text.blue : T.text.purple, borderRadius: 2, fontSize: 8, fontWeight: 600 }}>
                            {t.lease_type?.trim().toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '5px 10px', color: T.text.secondary }}>{t.lease_start ? new Date(t.lease_start).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: T.text.secondary }}>{fmt(t.sqft)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: T.text.primary, fontWeight: 600 }}>{fmt(parseFloat(t.new_rent), 'currency')}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: T.text.secondary }}>{t.prior_rent ? fmt(parseFloat(t.prior_rent), 'currency') : '—'}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: T.text.secondary }}>{fmt(parseFloat(t.market_rent), 'currency')}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: parseFloat(t.rent_change_dollar) > 0 ? T.text.green : parseFloat(t.rent_change_dollar) < 0 ? T.text.red : T.text.muted }}>
                          {t.rent_change_dollar ? `${parseFloat(t.rent_change_dollar) > 0 ? '+' : ''}${fmt(parseFloat(t.rent_change_dollar), 'currency')}` : '—'}
                        </td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: parseFloat(t.loss_to_lease_pct) < -5 ? T.text.red : T.text.secondary }}>
                          {t.loss_to_lease_pct ? `${parseFloat(t.loss_to_lease_pct).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </Panel>

      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg.terminal }}>
      {ctxAnalysis && <ContextIndicator analysis={ctxAnalysis} loading={ctxLoading} compact />}
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
        {activeTab === 'revenue'      && <RevenueMgmtTab dealId={dealId!} deal={deal as Record<string, unknown>} />}

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
        {activeTab === 'refi-monitor' && <RefiMonitorTab dealId={dealId!} deal={deal} />}
        {activeTab === 'ai-learning'  && <AILearningTab dealId={dealId!} />}
        {activeTab === 'events'       && (
          <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
            <EventTimelineSection dealId={dealId!} deal={deal} />
          </div>
        )}
        {activeTab === 'activity'     && <ActivityTab dealId={dealId!} />}
        {activeTab === 'traffic'      && <TrafficTab dealId={dealId!} />}
        {activeTab === 'documents'    && (
          <DocumentsHub dealId={dealId!} deal={deal as Record<string, unknown>} />
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
