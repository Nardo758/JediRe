/**
 * AssetOwnedPage — Simplified 5-Tab Asset Management View
 * 
 * Consolidates 14 tabs into 5 main tabs with sub-tabs:
 * 1. Dashboard — KPIs, trends, alerts, quick actions
 * 2. Financials — P&L, Variance, Cash Flow, Balance Sheet, Actuals Entry
 * 3. Operations — Rent Roll, Leasing, Traffic, Comp Set, Unit Mix
 * 4. Capital — Investors, Debt & Covenants, Exit Planning, Refi Analysis
 * 5. Documents — Upload Package, Report Archive, Activity Log, Team
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';

// Existing components to reuse
import MonthlyActualsSection from '../components/deal/sections/MonthlyActualsSection';
import { OperationsIntelligenceSection } from '../components/deal/sections/OperationsIntelligenceSection';
import { LifecycleSection } from '../components/deal/sections/LifecycleSection';
import { InvestorCapitalModule } from '../components/deal/sections/InvestorCapitalModule';
import { EventTimelineSection } from '../components/deal/sections/EventTimelineSection';
import { DocumentsSection } from '../components/deal/sections/DocumentsSection';
import { TeamSection } from '../components/deal/sections/TeamSection';

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  bg: { 
    terminal: '#0A0E17', 
    panel: '#0F1319', 
    panelAlt: '#131821', 
    header: '#1A1F2E', 
    hover: '#1E2538', 
    active: '#252D40',
    input: '#0D1117',
  },
  text: { 
    primary: '#E8ECF1', 
    secondary: '#8B95A5', 
    muted: '#4A5568', 
    amber: '#F5A623', 
    green: '#00D26A', 
    red: '#FF4757', 
    cyan: '#00BCD4',
    orange: '#FF8C42',
    purple: '#A78BFA',
    blue: '#4A9EFF',
  },
  border: { subtle: '#1E2538', medium: '#2A3348', bright: '#3B4A6B' },
  font: { mono: "'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

// ─── Types ────────────────────────────────────────────────────────────────────
type MainTab = 'dashboard' | 'financials' | 'operations' | 'capital' | 'documents';
type FinancialsSubTab = 'pl' | 'variance' | 'cashflow' | 'balance' | 'actuals';
type OperationsSubTab = 'rentroll' | 'leasing' | 'traffic' | 'compset' | 'unitmix';
type CapitalSubTab = 'investors' | 'debt' | 'exit' | 'refi';
type DocumentsSubTab = 'upload' | 'archive' | 'activity' | 'team';

interface DealData {
  id: string;
  name: string;
  address: string;
  units: number;
  projectType: string;
  status: string;
  state: string;
  category: string;
  vintage: string | null;
  class: string;
  operator: string | null;
}

interface MonthlyFinancial {
  report_month: string;
  occupancy_rate: number;
  avg_effective_rent: number;
  avg_market_rent: number;
  gross_potential_rent: number;
  net_rental_income: number;
  total_opex: number;
  noi: number;
  noi_per_unit: number;
  capex: number;
  cash_flow_before_tax: number;
  debt_service: number;
}

interface Alert {
  type: 'warning' | 'critical' | 'info';
  message: string;
  action?: string;
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (v: number | null | undefined, type: 'currency' | 'percent' | 'number' = 'number', decimals = 0): string => {
  if (v == null || isNaN(v)) return '—';
  if (type === 'currency') {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  }
  if (type === 'percent') return `${v.toFixed(decimals)}%`;
  return v.toLocaleString('en-US', { maximumFractionDigits: decimals });
};

const fmtDelta = (current: number, previous: number): { value: string; color: string; direction: '↑' | '↓' | '→' } => {
  if (!previous || previous === 0) return { value: '—', color: T.text.muted, direction: '→' };
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(delta) < 0.5) return { value: '0%', color: T.text.muted, direction: '→' };
  return {
    value: `${Math.abs(delta).toFixed(1)}%`,
    color: delta > 0 ? T.text.green : T.text.red,
    direction: delta > 0 ? '↑' : '↓',
  };
};

// ─── Sub-Components ───────────────────────────────────────────────────────────

// KPI Card with sparkline
const KPICard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  color?: string;
  delta?: { value: string; color: string; direction: string };
  sparkline?: number[];
}> = ({ label, value, sub, color = T.text.primary, delta, sparkline }) => (
  <div style={{
    background: T.bg.panel,
    border: `1px solid ${T.border.subtle}`,
    borderRadius: 4,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  }}>
    <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      {label}
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 22, fontWeight: 700, color, fontFamily: T.font.mono }}>{value}</span>
      {delta && (
        <span style={{ fontSize: 10, color: delta.color, fontFamily: T.font.mono }}>
          {delta.direction} {delta.value}
        </span>
      )}
    </div>
    {sub && <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>{sub}</div>}
    {sparkline && sparkline.length > 0 && (
      <div style={{ height: 24, marginTop: 4 }}>
        <MiniSparkline data={sparkline} color={color} />
      </div>
    )}
  </div>
);

// Mini sparkline chart
const MiniSparkline: React.FC<{ data: number[]; color: string; height?: number }> = ({ data, color, height = 24 }) => {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * 100;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 100 ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// Alert banner
const AlertBanner: React.FC<{ alerts: Alert[] }> = ({ alerts }) => {
  if (!alerts.length) return null;
  const critical = alerts.filter(a => a.type === 'critical');
  const warnings = alerts.filter(a => a.type === 'warning');
  const display = critical.length ? critical[0] : warnings[0];
  if (!display) return null;
  
  const colors = {
    critical: { bg: '#FF475722', border: T.text.red, text: T.text.red },
    warning: { bg: '#F5A62322', border: T.text.amber, text: T.text.amber },
    info: { bg: '#00BCD422', border: T.text.cyan, text: T.text.cyan },
  };
  const c = colors[display.type];
  
  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 4,
      padding: '8px 12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    }}>
      <span style={{ fontSize: 11, color: c.text, fontFamily: T.font.mono }}>
        {display.type === 'critical' ? '⚠️' : '⚡'} {display.message}
      </span>
      {display.action && (
        <button style={{
          background: 'transparent',
          border: `1px solid ${c.border}`,
          color: c.text,
          fontSize: 9,
          fontFamily: T.font.mono,
          padding: '4px 10px',
          borderRadius: 3,
          cursor: 'pointer',
        }}>
          {display.action}
        </button>
      )}
    </div>
  );
};

// Quick Action Button
const QuickAction: React.FC<{ icon: string; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: T.bg.panel,
      border: `1px solid ${T.border.subtle}`,
      borderRadius: 4,
      padding: '8px 12px',
      cursor: 'pointer',
      transition: 'all 0.15s',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = T.bg.hover;
      e.currentTarget.style.borderColor = T.text.cyan;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = T.bg.panel;
      e.currentTarget.style.borderColor = T.border.subtle;
    }}
  >
    <span style={{ fontSize: 14 }}>{icon}</span>
    <span style={{ fontSize: 10, color: T.text.secondary, fontFamily: T.font.mono }}>{label}</span>
  </button>
);

// Sub-tab navigation
const SubTabs: React.FC<{
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}> = ({ tabs, active, onChange }) => (
  <div style={{
    display: 'flex',
    gap: 0,
    borderBottom: `1px solid ${T.border.subtle}`,
    marginBottom: 12,
  }}>
    {tabs.map(tab => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        style={{
          padding: '8px 16px',
          background: 'transparent',
          border: 'none',
          borderBottom: active === tab.id ? `2px solid ${T.text.cyan}` : '2px solid transparent',
          color: active === tab.id ? T.text.primary : T.text.muted,
          fontSize: 10,
          fontFamily: T.font.mono,
          fontWeight: active === tab.id ? 700 : 400,
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

// Panel wrapper
const Panel: React.FC<{ title?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ title, children, style }) => (
  <div style={{
    background: T.bg.panel,
    border: `1px solid ${T.border.subtle}`,
    borderRadius: 4,
    overflow: 'hidden',
    ...style,
  }}>
    {title && (
      <div style={{
        padding: '8px 12px',
        background: T.bg.header,
        borderBottom: `1px solid ${T.border.subtle}`,
        fontSize: 10,
        fontWeight: 700,
        color: T.text.amber,
        fontFamily: T.font.mono,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        {title}
      </div>
    )}
    <div style={{ padding: 12 }}>{children}</div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AssetOwnedPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();

  // State
  const [deal, setDeal] = useState<DealData | null>(null);
  const [financials, setFinancials] = useState<MonthlyFinancial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [mainTab, setMainTab] = useState<MainTab>('dashboard');
  const [financialsSubTab, setFinancialsSubTab] = useState<FinancialsSubTab>('pl');
  const [operationsSubTab, setOperationsSubTab] = useState<OperationsSubTab>('rentroll');
  const [capitalSubTab, setCapitalSubTab] = useState<CapitalSubTab>('investors');
  const [documentsSubTab, setDocumentsSubTab] = useState<DocumentsSubTab>('upload');

  // Load data
  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    Promise.all([
      apiClient.get(`/api/v1/portfolio/assets/${dealId}/summary`).catch(() => ({ data: null })),
      apiClient.get(`/api/v1/operations/${dealId}/monthly-actuals?limit=24`).catch(() => ({ data: { actuals: [] } })),
    ])
      .then(([summaryRes, financialsRes]) => {
        if (summaryRes.data?.deal) setDeal(summaryRes.data.deal);
        setFinancials(financialsRes.data?.actuals || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [dealId]);

  // Computed values
  const latestFinancial = financials[0];
  const previousFinancial = financials[1];
  const units = deal?.units || 0;

  // Generate alerts
  const alerts = useMemo<Alert[]>(() => {
    const list: Alert[] = [];
    if (latestFinancial) {
      const dscr = latestFinancial.debt_service ? latestFinancial.noi / Math.abs(latestFinancial.debt_service) : null;
      if (dscr && dscr < 1.25) {
        list.push({ type: 'critical', message: `DSCR at ${dscr.toFixed(2)}x — below 1.25x covenant`, action: 'View Debt' });
      }
      if (latestFinancial.occupancy_rate < 0.90) {
        list.push({ type: 'warning', message: `Occupancy at ${(latestFinancial.occupancy_rate * 100).toFixed(1)}% — below 90% target` });
      }
    }
    return list;
  }, [latestFinancial]);

  // Sparkline data helpers
  const getSparkline = (field: keyof MonthlyFinancial): number[] => {
    return financials.slice(0, 12).reverse().map(f => Number(f[field]) || 0);
  };

  // ─── Render Functions ─────────────────────────────────────────────────────────

  const renderMainTabs = () => {
    const tabs: { id: MainTab; label: string; icon: string }[] = [
      { id: 'dashboard', label: 'Dashboard', icon: '📊' },
      { id: 'financials', label: 'Financials', icon: '💰' },
      { id: 'operations', label: 'Operations', icon: '🏢' },
      { id: 'capital', label: 'Capital', icon: '🏦' },
      { id: 'documents', label: 'Documents', icon: '📁' },
    ];

    return (
      <div style={{
        display: 'flex',
        gap: 0,
        background: T.bg.header,
        borderBottom: `1px solid ${T.border.medium}`,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setMainTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px',
              background: mainTab === tab.id ? T.bg.active : 'transparent',
              border: 'none',
              borderBottom: mainTab === tab.id ? `2px solid ${T.text.amber}` : '2px solid transparent',
              color: mainTab === tab.id ? T.text.amber : T.text.secondary,
              fontSize: 11,
              fontFamily: T.font.mono,
              fontWeight: mainTab === tab.id ? 700 : 500,
              cursor: 'pointer',
              letterSpacing: '0.03em',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderDashboard = () => {
    const lf = latestFinancial;
    const pf = previousFinancial;

    return (
      <div style={{ padding: 16 }}>
        <AlertBanner alerts={alerts} />

        {/* KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
          <KPICard
            label="Annual NOI"
            value={fmt(lf ? lf.noi * 12 : null, 'currency')}
            sub={lf ? `${fmt(lf.noi, 'currency')}/mo` : undefined}
            color={T.text.blue}
            delta={lf && pf ? fmtDelta(lf.noi, pf.noi) : undefined}
            sparkline={getSparkline('noi')}
          />
          <KPICard
            label="Occupancy"
            value={fmt(lf ? lf.occupancy_rate * 100 : null, 'percent', 1)}
            sub={`${units} units`}
            color={T.text.green}
            delta={lf && pf ? fmtDelta(lf.occupancy_rate, pf.occupancy_rate) : undefined}
            sparkline={getSparkline('occupancy_rate')}
          />
          <KPICard
            label="Avg Eff. Rent"
            value={fmt(lf?.avg_effective_rent, 'currency')}
            sub={lf ? `${fmt(lf.avg_market_rent, 'currency')} market` : undefined}
            color={T.text.cyan}
            delta={lf && pf ? fmtDelta(lf.avg_effective_rent, pf.avg_effective_rent) : undefined}
            sparkline={getSparkline('avg_effective_rent')}
          />
          <KPICard
            label="Monthly Cash Flow"
            value={fmt(lf?.cash_flow_before_tax, 'currency')}
            sub={lf?.debt_service ? `${fmt(lf.debt_service, 'currency')} debt svc` : undefined}
            color={lf && lf.cash_flow_before_tax < 0 ? T.text.red : T.text.green}
            sparkline={getSparkline('cash_flow_before_tax')}
          />
          <KPICard
            label="DSCR"
            value={lf?.debt_service ? `${(lf.noi / Math.abs(lf.debt_service)).toFixed(2)}x` : '—'}
            sub="debt coverage"
            color={T.text.amber}
          />
          <KPICard
            label="Loss-to-Lease"
            value={lf ? fmt(((lf.avg_market_rent - lf.avg_effective_rent) / lf.avg_market_rent) * 100, 'percent', 1) : '—'}
            sub="vs market"
            color={T.text.orange}
          />
        </div>

        {/* Quick Actions */}
        <Panel title="Quick Actions" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <QuickAction icon="📤" label="Upload Monthly Package" onClick={() => { setMainTab('documents'); setDocumentsSubTab('upload'); }} />
            <QuickAction icon="📝" label="Enter Actuals" onClick={() => { setMainTab('financials'); setFinancialsSubTab('actuals'); }} />
            <QuickAction icon="💵" label="Create Distribution" onClick={() => { setMainTab('capital'); setCapitalSubTab('investors'); }} />
            <QuickAction icon="🔄" label="Run Reforecast" onClick={() => { setMainTab('capital'); setCapitalSubTab('exit'); }} />
            <QuickAction icon="📊" label="View Variance" onClick={() => { setMainTab('financials'); setFinancialsSubTab('variance'); }} />
          </div>
        </Panel>

        {/* Trend Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Panel title="NOI Trend (12 months)">
            <TrendChart data={financials.slice(0, 12).reverse()} dataKey="noi" color={T.text.blue} />
          </Panel>
          <Panel title="Occupancy Trend (12 months)">
            <TrendChart data={financials.slice(0, 12).reverse()} dataKey="occupancy_rate" color={T.text.green} isPercent />
          </Panel>
        </div>
      </div>
    );
  };

  const renderFinancials = () => {
    const subTabs = [
      { id: 'pl', label: 'P&L Summary' },
      { id: 'variance', label: 'Budget vs Actual' },
      { id: 'cashflow', label: 'Cash Flow' },
      { id: 'balance', label: 'Balance Sheet' },
      { id: 'actuals', label: 'Enter Actuals' },
    ];

    return (
      <div style={{ padding: 16 }}>
        <SubTabs tabs={subTabs} active={financialsSubTab} onChange={(id) => setFinancialsSubTab(id as FinancialsSubTab)} />
        
        {financialsSubTab === 'pl' && <PLSummaryTab financials={financials} />}
        {financialsSubTab === 'variance' && <VarianceTab dealId={dealId!} />}
        {financialsSubTab === 'cashflow' && <CashFlowTab financials={financials} />}
        {financialsSubTab === 'balance' && <BalanceSheetTab dealId={dealId!} />}
        {financialsSubTab === 'actuals' && <MonthlyActualsSection dealId={dealId!} />}
      </div>
    );
  };

  const renderOperations = () => {
    const subTabs = [
      { id: 'rentroll', label: 'Rent Roll' },
      { id: 'leasing', label: 'Leasing Activity' },
      { id: 'traffic', label: 'Traffic & Conversion' },
      { id: 'compset', label: 'Comp Set' },
      { id: 'unitmix', label: 'Unit Mix' },
    ];

    return (
      <div style={{ padding: 16 }}>
        <SubTabs tabs={subTabs} active={operationsSubTab} onChange={(id) => setOperationsSubTab(id as OperationsSubTab)} />
        
        {operationsSubTab === 'rentroll' && <RentRollTab dealId={dealId!} />}
        {operationsSubTab === 'leasing' && <LeasingTab dealId={dealId!} />}
        {operationsSubTab === 'traffic' && <TrafficTab dealId={dealId!} />}
        {operationsSubTab === 'compset' && <CompSetTab dealId={dealId!} />}
        {operationsSubTab === 'unitmix' && <UnitMixTab dealId={dealId!} />}
      </div>
    );
  };

  const renderCapital = () => {
    const subTabs = [
      { id: 'investors', label: 'Investors' },
      { id: 'debt', label: 'Debt & Covenants' },
      { id: 'exit', label: 'Exit Planning' },
      { id: 'refi', label: 'Refi Analysis' },
    ];

    return (
      <div style={{ padding: 16 }}>
        <SubTabs tabs={subTabs} active={capitalSubTab} onChange={(id) => setCapitalSubTab(id as CapitalSubTab)} />
        
        {capitalSubTab === 'investors' && <InvestorCapitalModule dealId={dealId!} />}
        {capitalSubTab === 'debt' && <LifecycleSection dealId={dealId!} initialTab="debt" />}
        {capitalSubTab === 'exit' && <ExitPlanningTab dealId={dealId!} />}
        {capitalSubTab === 'refi' && <RefiAnalysisTab dealId={dealId!} />}
      </div>
    );
  };

  const renderDocuments = () => {
    const subTabs = [
      { id: 'upload', label: 'Upload Package' },
      { id: 'archive', label: 'Report Archive' },
      { id: 'activity', label: 'Activity Log' },
      { id: 'team', label: 'Deal Team' },
    ];

    return (
      <div style={{ padding: 16 }}>
        <SubTabs tabs={subTabs} active={documentsSubTab} onChange={(id) => setDocumentsSubTab(id as DocumentsSubTab)} />
        
        {documentsSubTab === 'upload' && <UploadPackageTab dealId={dealId!} />}
        {documentsSubTab === 'archive' && <DocumentsSection dealId={dealId!} />}
        {documentsSubTab === 'activity' && <ActivityTab dealId={dealId!} />}
        {documentsSubTab === 'team' && <TeamSection dealId={dealId!} />}
      </div>
    );
  };

  // ─── Main Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: T.bg.terminal, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: T.text.muted, fontFamily: T.font.mono }}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: T.bg.terminal, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: T.text.red, fontFamily: T.font.mono }}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg.terminal, minHeight: '100vh', color: T.text.primary }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: T.bg.panel,
        borderBottom: `1px solid ${T.border.subtle}`,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: T.font.mono, color: T.text.primary }}>
            {deal?.name || 'Asset'}
          </div>
          <div style={{ fontSize: 11, color: T.text.muted, fontFamily: T.font.mono }}>
            {deal?.address} • {deal?.units} units • {deal?.class} Class • {deal?.operator || 'Self-managed'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/portfolio')}
            style={{
              background: 'transparent',
              border: `1px solid ${T.border.subtle}`,
              color: T.text.secondary,
              fontSize: 10,
              fontFamily: T.font.mono,
              padding: '6px 12px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            ← Back to Portfolio
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      {renderMainTabs()}

      {/* Content */}
      <div style={{ minHeight: 'calc(100vh - 140px)' }}>
        {mainTab === 'dashboard' && renderDashboard()}
        {mainTab === 'financials' && renderFinancials()}
        {mainTab === 'operations' && renderOperations()}
        {mainTab === 'capital' && renderCapital()}
        {mainTab === 'documents' && renderDocuments()}
      </div>
    </div>
  );
}

// ─── Placeholder Sub-Tab Components ───────────────────────────────────────────
// These will be built out or connected to existing components

const TrendChart: React.FC<{ data: MonthlyFinancial[]; dataKey: keyof MonthlyFinancial; color: string; isPercent?: boolean }> = ({ data, dataKey, color, isPercent }) => {
  if (!data.length) return <div style={{ padding: 20, color: T.text.muted, textAlign: 'center', fontFamily: T.font.mono, fontSize: 10 }}>No data</div>;
  
  const values = data.map(d => Number(d[dataKey]) || 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return (
    <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', gap: 4, padding: '0 8px' }}>
      {values.map((v, i) => {
        const height = ((v - min) / range) * 100 + 10;
        const label = data[i]?.report_month?.slice(5, 7) || '';
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                width: '100%',
                height: `${height}px`,
                background: color,
                opacity: 0.8,
                borderRadius: '2px 2px 0 0',
              }}
              title={isPercent ? `${(v * 100).toFixed(1)}%` : fmt(v, 'currency')}
            />
            <span style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
};

const PLSummaryTab: React.FC<{ financials: MonthlyFinancial[] }> = ({ financials }) => (
  <Panel title="Income Statement">
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border.medium}` }}>
            <th style={{ padding: '8px', textAlign: 'left', color: T.text.muted }}>Month</th>
            <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>GPR</th>
            <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>Net Rental</th>
            <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>OpEx</th>
            <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>NOI</th>
            <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>Debt Svc</th>
            <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>Cash Flow</th>
          </tr>
        </thead>
        <tbody>
          {financials.slice(0, 12).map((f, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
              <td style={{ padding: '8px', color: T.text.primary }}>{f.report_month}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: T.text.secondary }}>{fmt(f.gross_potential_rent, 'currency')}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: T.text.secondary }}>{fmt(f.net_rental_income, 'currency')}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: T.text.red }}>{fmt(f.total_opex, 'currency')}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: T.text.blue, fontWeight: 600 }}>{fmt(f.noi, 'currency')}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: T.text.orange }}>{fmt(f.debt_service, 'currency')}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: f.cash_flow_before_tax >= 0 ? T.text.green : T.text.red, fontWeight: 600 }}>
                {fmt(f.cash_flow_before_tax, 'currency')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Panel>
);

interface VarianceItem {
  line_item: string;
  category: string;
  actual: number | null;
  budget: number | null;
  variance: number | null;
  variance_pct: number | null;
  variance_type: 'favorable' | 'unfavorable' | 'neutral';
}

const VarianceTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [data, setData] = useState<Record<string, VarianceItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    apiClient.get(`/api/v1/reporting-package/variance?dealId=${dealId}`)
      .then(res => {
        const variance = res.data?.variance || {};
        setData(variance);
        const months = Object.keys(variance).sort().reverse();
        if (months.length > 0) setSelectedMonth(months[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return <div style={{ padding: 20, color: T.text.muted }}>Loading...</div>;

  const months = Object.keys(data).sort().reverse();
  const items = selectedMonth ? data[selectedMonth] || [] : [];

  // Group by category
  const byCategory: Record<string, VarianceItem[]> = {};
  items.forEach(item => {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  });

  const categoryLabels: Record<string, string> = {
    revenue: 'Revenue',
    other_income: 'Other Income',
    payroll: 'Payroll & Benefits',
    repairs_maintenance: 'Repairs & Maintenance',
    contract_services: 'Contract Services',
    utilities: 'Utilities',
    marketing: 'Marketing',
    admin_general: 'Admin & General',
    management_fee: 'Management Fee',
    property_tax: 'Property Tax',
    insurance: 'Insurance',
    other: 'Other',
  };

  if (months.length === 0) {
    return (
      <Panel title="Budget vs Actual Variance">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 12, color: T.text.primary, fontFamily: T.font.mono, marginBottom: 8 }}>
            No variance data available
          </div>
          <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>
            Upload a BPI Variance Report in the Documents tab to see budget vs actual analysis
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <div>
      {/* Month Selector */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>Report Period:</span>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            background: T.bg.input,
            color: T.text.primary,
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 10,
            fontFamily: T.font.mono,
          }}
        >
          {months.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <span style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>
          {items.length} line items
        </span>
      </div>

      {/* Variance Table by Category */}
      {Object.entries(byCategory).map(([category, catItems]) => (
        <Panel key={category} title={categoryLabels[category] || category} style={{ marginBottom: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border.medium}` }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: T.text.muted, width: '40%' }}>Line Item</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Actual</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Budget</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Variance</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Var %</th>
              </tr>
            </thead>
            <tbody>
              {catItems.map((item, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                  <td style={{ padding: '6px 8px', color: T.text.primary }}>
                    {item.line_item}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.secondary }}>
                    {fmt(item.actual, 'currency')}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>
                    {fmt(item.budget, 'currency')}
                  </td>
                  <td style={{
                    padding: '6px 8px',
                    textAlign: 'right',
                    color: item.variance_type === 'favorable' ? T.text.green : 
                           item.variance_type === 'unfavorable' ? T.text.red : T.text.muted,
                    fontWeight: item.variance_type !== 'neutral' ? 600 : 400,
                  }}>
                    {item.variance !== null ? fmt(item.variance, 'currency') : '—'}
                  </td>
                  <td style={{
                    padding: '6px 8px',
                    textAlign: 'right',
                    color: item.variance_type === 'favorable' ? T.text.green : 
                           item.variance_type === 'unfavorable' ? T.text.red : T.text.muted,
                  }}>
                    {item.variance_pct !== null ? `${item.variance_pct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ))}
    </div>
  );
};

const CashFlowTab: React.FC<{ financials: MonthlyFinancial[] }> = ({ financials }) => {
  if (financials.length === 0) {
    return (
      <Panel title="Cash Flow Statement">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💵</div>
          <div style={{ fontSize: 12, color: T.text.primary, fontFamily: T.font.mono, marginBottom: 8 }}>
            No cash flow data available
          </div>
          <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>
            Upload a monthly reporting package or enter actuals to see cash flow
          </div>
        </div>
      </Panel>
    );
  }

  // Calculate totals
  const totals = financials.reduce((acc, f) => ({
    noi: acc.noi + (Number(f.noi) || 0),
    debtService: acc.debtService + (Number(f.debt_service) || 0),
    capex: acc.capex + (Number(f.capex) || 0),
    cashFlow: acc.cashFlow + (Number(f.cash_flow_before_tax) || 0),
  }), { noi: 0, debtService: 0, capex: 0, cashFlow: 0 });

  return (
    <Panel title="Cash Flow Statement">
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: T.bg.panelAlt, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>TOTAL NOI</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text.blue, fontFamily: T.font.mono }}>{fmt(totals.noi, 'currency')}</div>
        </div>
        <div style={{ background: T.bg.panelAlt, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>TOTAL DEBT SERVICE</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text.orange, fontFamily: T.font.mono }}>{fmt(totals.debtService, 'currency')}</div>
        </div>
        <div style={{ background: T.bg.panelAlt, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>TOTAL CAPEX</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text.purple, fontFamily: T.font.mono }}>{fmt(totals.capex, 'currency')}</div>
        </div>
        <div style={{ background: T.bg.panelAlt, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>NET CASH FLOW</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: totals.cashFlow >= 0 ? T.text.green : T.text.red, fontFamily: T.font.mono }}>
            {fmt(totals.cashFlow, 'currency')}
          </div>
        </div>
      </div>

      {/* Cash Flow Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border.medium}` }}>
              <th style={{ padding: '8px', textAlign: 'left', color: T.text.muted }}>Month</th>
              <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>NOI</th>
              <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>Debt Service</th>
              <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>CapEx</th>
              <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>Net Cash Flow</th>
              <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>DSCR</th>
            </tr>
          </thead>
          <tbody>
            {financials.slice(0, 12).map((f, i) => {
              const dscr = f.debt_service ? Number(f.noi) / Math.abs(Number(f.debt_service)) : null;
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                  <td style={{ padding: '8px', color: T.text.primary }}>{f.report_month}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: T.text.blue }}>{fmt(Number(f.noi), 'currency')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: T.text.orange }}>{fmt(Number(f.debt_service), 'currency')}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: T.text.purple }}>{fmt(Number(f.capex), 'currency')}</td>
                  <td style={{
                    padding: '8px',
                    textAlign: 'right',
                    fontWeight: 600,
                    color: Number(f.cash_flow_before_tax) >= 0 ? T.text.green : T.text.red,
                  }}>
                    {fmt(Number(f.cash_flow_before_tax), 'currency')}
                  </td>
                  <td style={{
                    padding: '8px',
                    textAlign: 'right',
                    color: dscr && dscr < 1.25 ? T.text.red : T.text.amber,
                  }}>
                    {dscr ? `${dscr.toFixed(2)}x` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${T.border.medium}`, background: T.bg.panelAlt }}>
              <td style={{ padding: '8px', color: T.text.primary, fontWeight: 700 }}>TOTAL</td>
              <td style={{ padding: '8px', textAlign: 'right', color: T.text.blue, fontWeight: 700 }}>{fmt(totals.noi, 'currency')}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: T.text.orange, fontWeight: 700 }}>{fmt(totals.debtService, 'currency')}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: T.text.purple, fontWeight: 700 }}>{fmt(totals.capex, 'currency')}</td>
              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: totals.cashFlow >= 0 ? T.text.green : T.text.red }}>
                {fmt(totals.cashFlow, 'currency')}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
};

const BalanceSheetTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/api/v1/operations/${dealId}/balance-sheet`)
      .then(res => setData(res.data?.balanceSheet || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return <div style={{ padding: 20, color: T.text.muted }}>Loading...</div>;

  if (!data) {
    return (
      <Panel title="Balance Sheet">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💰</div>
          <div style={{ fontSize: 12, color: T.text.primary, fontFamily: T.font.mono, marginBottom: 8 }}>
            No balance sheet data available
          </div>
          <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>
            Upload a BPI Balance Sheet to auto-populate
          </div>
        </div>
      </Panel>
    );
  }

  const Section: React.FC<{ title: string; items: { label: string; value: number }[]; total: number; color: string }> = ({ title, items, total, color }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color, fontFamily: T.font.mono, marginBottom: 8, textTransform: 'uppercase' }}>
        {title}
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${T.border.subtle}` }}>
          <span style={{ fontSize: 10, color: T.text.secondary, fontFamily: T.font.mono }}>{item.label}</span>
          <span style={{ fontSize: 10, color: T.text.primary, fontFamily: T.font.mono }}>{fmt(item.value, 'currency')}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: `2px solid ${T.border.medium}`, marginTop: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: T.font.mono }}>TOTAL {title.toUpperCase()}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: T.font.mono }}>{fmt(total, 'currency')}</span>
      </div>
    </div>
  );

  return (
    <Panel title={`Balance Sheet — ${data.report_month || 'Current'}`}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Assets */}
        <div>
          <Section
            title="Assets"
            items={[
              { label: 'Cash & Cash Equivalents', value: data.cash || 0 },
              { label: 'Accounts Receivable', value: data.accounts_receivable || 0 },
              { label: 'Prepaid Expenses', value: data.prepaid_expenses || 0 },
              { label: 'Other Current Assets', value: data.other_current_assets || 0 },
              { label: 'Fixed Assets', value: data.fixed_assets || 0 },
            ]}
            total={data.total_assets || 0}
            color={T.text.cyan}
          />
        </div>

        {/* Liabilities & Equity */}
        <div>
          <Section
            title="Liabilities"
            items={[
              { label: 'Accounts Payable', value: data.accounts_payable || 0 },
              { label: 'Accrued Expenses', value: data.accrued_expenses || 0 },
              { label: 'Security Deposits', value: data.security_deposits || 0 },
              { label: 'Prepaid Rent', value: data.prepaid_rent || 0 },
              { label: 'Other Liabilities', value: data.other_liabilities || 0 },
            ]}
            total={data.total_liabilities || 0}
            color={T.text.orange}
          />

          <Section
            title="Equity"
            items={[
              { label: 'Contributed Capital', value: data.contributed_capital || 0 },
              { label: 'Retained Earnings', value: data.retained_earnings || 0 },
              { label: 'Current Year Earnings', value: data.current_year_earnings || 0 },
            ]}
            total={data.total_equity || 0}
            color={T.text.green}
          />
        </div>
      </div>
    </Panel>
  );
};

const RentRollTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/api/v1/operations/${dealId}/rent-roll`)
      .then(res => setUnits(res.data?.units || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return <div style={{ padding: 20, color: T.text.muted }}>Loading...</div>;

  return (
    <Panel title="Rent Roll">
      <div style={{ overflowX: 'auto', maxHeight: 500 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border.medium}`, position: 'sticky', top: 0, background: T.bg.panel }}>
              <th style={{ padding: '8px', textAlign: 'left', color: T.text.muted }}>Unit</th>
              <th style={{ padding: '8px', textAlign: 'left', color: T.text.muted }}>Type</th>
              <th style={{ padding: '8px', textAlign: 'left', color: T.text.muted }}>Status</th>
              <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>Rent</th>
              <th style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>Market</th>
              <th style={{ padding: '8px', textAlign: 'left', color: T.text.muted }}>Lease End</th>
            </tr>
          </thead>
          <tbody>
            {units.slice(0, 50).map((u, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                <td style={{ padding: '8px', color: T.text.primary }}>{u.unit_number}</td>
                <td style={{ padding: '8px', color: T.text.secondary }}>{u.unit_type}</td>
                <td style={{ padding: '8px' }}>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: 3,
                    fontSize: 9,
                    background: u.status === 'occupied' ? T.text.green + '22' : T.text.amber + '22',
                    color: u.status === 'occupied' ? T.text.green : T.text.amber,
                  }}>
                    {u.status}
                  </span>
                </td>
                <td style={{ padding: '8px', textAlign: 'right', color: T.text.primary }}>{fmt(u.current_rent, 'currency')}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: T.text.muted }}>{fmt(u.market_rent, 'currency')}</td>
                <td style={{ padding: '8px', color: T.text.secondary }}>{u.lease_end || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {units.length > 50 && (
          <div style={{ padding: 8, textAlign: 'center', color: T.text.muted, fontSize: 10 }}>
            Showing 50 of {units.length} units
          </div>
        )}
      </div>
    </Panel>
  );
};

interface LeaseTransaction {
  id: string;
  unit_number: string;
  transaction_type: 'new_lease' | 'renewal' | 'move_out' | 'transfer';
  effective_date: string;
  lease_end_date: string | null;
  rent: number;
  prior_rent: number | null;
  concessions: number | null;
  resident_name: string | null;
}

interface LeaseExpiration {
  month: string;
  count: number;
  total_rent: number;
}

const LeasingTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [transactions, setTransactions] = useState<LeaseTransaction[]>([]);
  const [expirations, setExpirations] = useState<LeaseExpiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new_lease' | 'renewal' | 'move_out'>('all');

  useEffect(() => {
    Promise.all([
      apiClient.get(`/api/v1/operations/${dealId}/lease-transactions?limit=50`).catch(() => ({ data: { transactions: [] } })),
      apiClient.get(`/api/v1/operations/${dealId}/lease-expirations?months=12`).catch(() => ({ data: { expirations: [] } })),
    ]).then(([txRes, expRes]) => {
      setTransactions(txRes.data?.transactions || []);
      setExpirations(expRes.data?.expirations || []);
    }).finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return <div style={{ padding: 20, color: T.text.muted }}>Loading...</div>;

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.transaction_type === filter);

  // Summary stats
  const newLeases = transactions.filter(t => t.transaction_type === 'new_lease').length;
  const renewals = transactions.filter(t => t.transaction_type === 'renewal').length;
  const moveOuts = transactions.filter(t => t.transaction_type === 'move_out').length;
  const avgRentIncrease = transactions.filter(t => t.prior_rent && t.rent).reduce((sum, t) => {
    return sum + ((t.rent - (t.prior_rent || 0)) / (t.prior_rent || 1));
  }, 0) / (renewals || 1) * 100;

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>NEW LEASES</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text.green, fontFamily: T.font.mono }}>{newLeases}</div>
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>RENEWALS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text.cyan, fontFamily: T.font.mono }}>{renewals}</div>
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>MOVE OUTS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text.red, fontFamily: T.font.mono }}>{moveOuts}</div>
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>AVG RENT INCREASE</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text.amber, fontFamily: T.font.mono }}>{avgRentIncrease.toFixed(1)}%</div>
        </div>
      </div>

      {/* Lease Expiration Heatmap */}
      {expirations.length > 0 && (
        <Panel title="Upcoming Lease Expirations" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {expirations.map((exp, i) => (
              <div key={i} style={{
                flex: '1 0 calc(25% - 8px)',
                minWidth: 80,
                padding: '10px 12px',
                background: exp.count > 10 ? T.text.red + '22' : exp.count > 5 ? T.text.amber + '22' : T.bg.panelAlt,
                border: `1px solid ${exp.count > 10 ? T.text.red + '44' : exp.count > 5 ? T.text.amber + '44' : T.border.subtle}`,
                borderRadius: 4,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>{exp.month}</div>
                <div style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: exp.count > 10 ? T.text.red : exp.count > 5 ? T.text.amber : T.text.primary,
                  fontFamily: T.font.mono,
                }}>{exp.count}</div>
                <div style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono }}>{fmt(exp.total_rent, 'currency')}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Transaction Table */}
      <Panel title="Recent Transactions">
        {/* Filter */}
        <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
          {(['all', 'new_lease', 'renewal', 'move_out'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '4px 10px',
                background: filter === f ? T.text.cyan + '22' : 'transparent',
                border: `1px solid ${filter === f ? T.text.cyan : T.border.subtle}`,
                borderRadius: 4,
                color: filter === f ? T.text.cyan : T.text.muted,
                fontSize: 9,
                fontFamily: T.font.mono,
                cursor: 'pointer',
              }}
            >
              {f === 'all' ? 'ALL' : f.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 20, color: T.text.muted, textAlign: 'center', fontSize: 11 }}>
            No transactions found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border.medium}` }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: T.text.muted }}>Unit</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: T.text.muted }}>Type</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: T.text.muted }}>Effective</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Rent</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Change</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: T.text.muted }}>Lease End</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx, i) => {
                  const change = tx.prior_rent ? ((tx.rent - tx.prior_rent) / tx.prior_rent) * 100 : null;
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                      <td style={{ padding: '6px 8px', color: T.text.primary }}>{tx.unit_number}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: 3,
                          fontSize: 8,
                          background: tx.transaction_type === 'new_lease' ? T.text.green + '22' :
                                      tx.transaction_type === 'renewal' ? T.text.cyan + '22' :
                                      T.text.red + '22',
                          color: tx.transaction_type === 'new_lease' ? T.text.green :
                                 tx.transaction_type === 'renewal' ? T.text.cyan :
                                 T.text.red,
                        }}>
                          {tx.transaction_type.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', color: T.text.secondary }}>{tx.effective_date}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.primary }}>{fmt(tx.rent, 'currency')}</td>
                      <td style={{
                        padding: '6px 8px',
                        textAlign: 'right',
                        color: change && change > 0 ? T.text.green : change && change < 0 ? T.text.red : T.text.muted,
                      }}>
                        {change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ padding: '6px 8px', color: T.text.muted }}>{tx.lease_end_date || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};

interface TrafficData {
  week: string;
  weekEnd: string;
  forecast_traffic: number | null;
  actual_traffic: number | null;
  forecast_leases: number | null;
  actual_leases: number | null;
  forecast_conversion: number | null;
  actual_conversion: number | null;
  traffic_variance: number | null;
  traffic_variance_type: string;
  lease_variance: number | null;
  occupancy: number | null;
}

const TrafficTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [data, setData] = useState<TrafficData[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/api/v1/deals/${dealId}/traffic/forecast-vs-actual?weeks=12`)
      .then(res => {
        setData(res.data?.data || []);
        setSummary(res.data?.summary || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return <div style={{ padding: 20, color: T.text.muted }}>Loading...</div>;

  if (data.length === 0) {
    return (
      <Panel title="Traffic Forecast vs Actual">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📈</div>
          <div style={{ fontSize: 12, color: T.text.primary, fontFamily: T.font.mono, marginBottom: 8 }}>
            No traffic data available
          </div>
          <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>
            Traffic predictions and actuals will appear here once data is available
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <div>
      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
            <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>FORECAST ACCURACY</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text.green, fontFamily: T.font.mono }}>
              {summary.forecastAccuracy !== null ? `${summary.forecastAccuracy.toFixed(0)}%` : '—'}
            </div>
          </div>
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
            <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>AVG TRAFFIC VAR</div>
            <div style={{
              fontSize: 20, fontWeight: 700, fontFamily: T.font.mono,
              color: summary.avgTrafficVariance >= 0 ? T.text.green : T.text.red,
            }}>
              {summary.avgTrafficVariance !== null ? `${summary.avgTrafficVariance >= 0 ? '+' : ''}${summary.avgTrafficVariance.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
            <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>WEEKS W/ FORECAST</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text.cyan, fontFamily: T.font.mono }}>
              {summary.weeksWithForecast || 0}
            </div>
          </div>
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
            <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>WEEKS W/ ACTUALS</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text.amber, fontFamily: T.font.mono }}>
              {summary.weeksWithActuals || 0}
            </div>
          </div>
        </div>
      )}

      {/* Forecast vs Actual Chart */}
      <Panel title="Weekly Traffic: Forecast vs Actual" style={{ marginBottom: 16 }}>
        <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '0 8px' }}>
          {data.slice(0, 12).reverse().map((row, i) => {
            const maxVal = Math.max(
              ...data.map(d => Math.max(d.forecast_traffic || 0, d.actual_traffic || 0))
            ) || 100;
            const forecastH = row.forecast_traffic ? (row.forecast_traffic / maxVal) * 160 : 0;
            const actualH = row.actual_traffic ? (row.actual_traffic / maxVal) * 160 : 0;
            const weekLabel = row.week?.slice(5) || '';
            
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 160 }}>
                  <div
                    style={{
                      width: 12,
                      height: forecastH,
                      background: T.text.cyan + '66',
                      borderRadius: '2px 2px 0 0',
                    }}
                    title={`Forecast: ${row.forecast_traffic || 0}`}
                  />
                  <div
                    style={{
                      width: 12,
                      height: actualH,
                      background: row.traffic_variance_type === 'favorable' ? T.text.green : 
                                  row.traffic_variance_type === 'unfavorable' ? T.text.red : T.text.muted,
                      borderRadius: '2px 2px 0 0',
                    }}
                    title={`Actual: ${row.actual_traffic || 0}`}
                  />
                </div>
                <span style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono }}>{weekLabel}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 12, background: T.text.cyan + '66', borderRadius: 2 }} />
            <span style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>Forecast</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 12, background: T.text.green, borderRadius: 2 }} />
            <span style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>Actual (above)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 12, background: T.text.red, borderRadius: 2 }} />
            <span style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>Actual (below)</span>
          </div>
        </div>
      </Panel>

      {/* Data Table */}
      <Panel title="Weekly Detail">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border.medium}` }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: T.text.muted }}>Week</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Forecast</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Actual</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Variance</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Conv %</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Leases</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Occ %</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                  <td style={{ padding: '6px 8px', color: T.text.primary }}>{row.week}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.cyan }}>
                    {row.forecast_traffic ?? '—'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.primary }}>
                    {row.actual_traffic ?? '—'}
                  </td>
                  <td style={{
                    padding: '6px 8px',
                    textAlign: 'right',
                    color: row.traffic_variance_type === 'favorable' ? T.text.green :
                           row.traffic_variance_type === 'unfavorable' ? T.text.red : T.text.muted,
                    fontWeight: 600,
                  }}>
                    {row.traffic_variance !== null ? `${row.traffic_variance >= 0 ? '+' : ''}${row.traffic_variance.toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.secondary }}>
                    {row.actual_conversion !== null ? `${row.actual_conversion.toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.amber }}>
                    {row.actual_leases ?? '—'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.green }}>
                    {row.occupancy !== null ? `${(row.occupancy * 100).toFixed(1)}%` : '—'}
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

interface CompProperty {
  id: string;
  name: string;
  address: string;
  distance_mi: number;
  units: number;
  year_built: number;
  avg_rent: number;
  occupancy: number;
  class: string;
  tier: 'primary' | 'secondary';
}

const CompSetTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [comps, setComps] = useState<CompProperty[]>([]);
  const [subject, setSubject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [newComp, setNewComp] = useState({
    name: '',
    address: '',
    units: '',
    year_built: '',
    avg_rent: '',
    occupancy: '',
    class: 'B',
    tier: 'secondary' as 'primary' | 'secondary',
    distance_mi: '',
  });

  const loadComps = () => {
    Promise.all([
      apiClient.get(`/api/v1/lifecycle/${dealId}/comp-set`).catch(() => ({ data: { comps: [] } })),
      apiClient.get(`/api/v1/portfolio/assets/${dealId}/summary`).catch(() => ({ data: null })),
    ]).then(([compsRes, subjectRes]) => {
      setComps(compsRes.data?.comps || []);
      setSubject(subjectRes.data?.deal || null);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadComps();
  }, [dealId]);

  const addComp = async () => {
    if (!newComp.name || !newComp.address) return;
    try {
      await apiClient.post(`/api/v1/lifecycle/${dealId}/comp-set`, {
        name: newComp.name,
        address: newComp.address,
        units: parseInt(newComp.units, 10) || 0,
        year_built: parseInt(newComp.year_built, 10) || new Date().getFullYear(),
        avg_rent: parseFloat(newComp.avg_rent) || 0,
        occupancy: parseFloat(newComp.occupancy) || 95,
        class: newComp.class,
        tier: newComp.tier,
        distance_mi: parseFloat(newComp.distance_mi) || 1,
      });
      setNewComp({ name: '', address: '', units: '', year_built: '', avg_rent: '', occupancy: '', class: 'B', tier: 'secondary', distance_mi: '' });
      setShowAddForm(false);
      loadComps();
    } catch (err) {
      console.error('Failed to add comp:', err);
    }
  };

  const removeComp = async (compId: string) => {
    if (!window.confirm('Remove this property from comp set?')) return;
    try {
      await apiClient.delete(`/api/v1/lifecycle/comp-set/${compId}`);
      loadComps();
    } catch (err) {
      console.error('Failed to remove comp:', err);
    }
  };

  const autoDiscover = async () => {
    setDiscovering(true);
    try {
      await apiClient.post(`/api/v1/lifecycle/${dealId}/comp-set/auto-discover`);
      loadComps();
    } catch (err) {
      console.error('Auto-discover failed:', err);
    } finally {
      setDiscovering(false);
    }
  };

  if (loading) return <div style={{ padding: 20, color: T.text.muted }}>Loading...</div>;

  const primaryComps = comps.filter(c => c.tier === 'primary');
  const secondaryComps = comps.filter(c => c.tier === 'secondary');

  // Calculate averages
  const avgRent = comps.length > 0 ? comps.reduce((sum, c) => sum + (c.avg_rent || 0), 0) / comps.length : 0;
  const avgOcc = comps.length > 0 ? comps.reduce((sum, c) => sum + (c.occupancy || 0), 0) / comps.length : 0;
  const avgUnits = comps.length > 0 ? comps.reduce((sum, c) => sum + (c.units || 0), 0) / comps.length : 0;

  return (
    <div>
      {/* Market Position Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>COMP SET SIZE</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text.cyan, fontFamily: T.font.mono }}>{comps.length}</div>
          <div style={{ fontSize: 8, color: T.text.muted, fontFamily: T.font.mono }}>{primaryComps.length} primary</div>
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>AVG COMP RENT</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text.green, fontFamily: T.font.mono }}>{fmt(avgRent, 'currency')}</div>
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>AVG COMP OCC</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text.amber, fontFamily: T.font.mono }}>{avgOcc.toFixed(1)}%</div>
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>AVG UNITS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text.purple, fontFamily: T.font.mono }}>{Math.round(avgUnits)}</div>
        </div>
      </div>

      {/* Comp Table */}
      <Panel title="Competitive Properties">
        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '6px 14px',
              background: T.text.cyan + '22',
              border: `1px solid ${T.text.cyan}`,
              borderRadius: 4,
              color: T.text.cyan,
              fontSize: 10,
              fontFamily: T.font.mono,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + Add Property
          </button>
          <button
            onClick={autoDiscover}
            disabled={discovering}
            style={{
              padding: '6px 14px',
              background: T.text.purple + '22',
              border: `1px solid ${T.text.purple}`,
              borderRadius: 4,
              color: T.text.purple,
              fontSize: 10,
              fontFamily: T.font.mono,
              fontWeight: 700,
              cursor: discovering ? 'wait' : 'pointer',
              opacity: discovering ? 0.6 : 1,
            }}
          >
            {discovering ? 'Discovering...' : '🔍 Auto-Discover'}
          </button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div style={{
            marginBottom: 16,
            padding: 16,
            background: T.bg.panelAlt,
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 4,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.text.primary, fontFamily: T.font.mono, marginBottom: 12 }}>
              ADD COMPETITIVE PROPERTY
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 4 }}>PROPERTY NAME *</label>
                <input
                  value={newComp.name}
                  onChange={(e) => setNewComp({ ...newComp, name: e.target.value })}
                  placeholder="The Reserve at..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: T.bg.input,
                    border: `1px solid ${T.border.subtle}`,
                    borderRadius: 4,
                    color: T.text.primary,
                    fontSize: 11,
                    fontFamily: T.font.mono,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 4 }}>ADDRESS *</label>
                <input
                  value={newComp.address}
                  onChange={(e) => setNewComp({ ...newComp, address: e.target.value })}
                  placeholder="123 Main St, City, ST"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: T.bg.input,
                    border: `1px solid ${T.border.subtle}`,
                    borderRadius: 4,
                    color: T.text.primary,
                    fontSize: 11,
                    fontFamily: T.font.mono,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 4 }}>UNITS</label>
                <input
                  type="number"
                  value={newComp.units}
                  onChange={(e) => setNewComp({ ...newComp, units: e.target.value })}
                  placeholder="200"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: T.bg.input,
                    border: `1px solid ${T.border.subtle}`,
                    borderRadius: 4,
                    color: T.text.primary,
                    fontSize: 11,
                    fontFamily: T.font.mono,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 4 }}>YEAR BUILT</label>
                <input
                  type="number"
                  value={newComp.year_built}
                  onChange={(e) => setNewComp({ ...newComp, year_built: e.target.value })}
                  placeholder="2015"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: T.bg.input,
                    border: `1px solid ${T.border.subtle}`,
                    borderRadius: 4,
                    color: T.text.primary,
                    fontSize: 11,
                    fontFamily: T.font.mono,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 4 }}>AVG RENT ($)</label>
                <input
                  type="number"
                  value={newComp.avg_rent}
                  onChange={(e) => setNewComp({ ...newComp, avg_rent: e.target.value })}
                  placeholder="1450"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: T.bg.input,
                    border: `1px solid ${T.border.subtle}`,
                    borderRadius: 4,
                    color: T.text.primary,
                    fontSize: 11,
                    fontFamily: T.font.mono,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 4 }}>OCCUPANCY (%)</label>
                <input
                  type="number"
                  value={newComp.occupancy}
                  onChange={(e) => setNewComp({ ...newComp, occupancy: e.target.value })}
                  placeholder="95"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: T.bg.input,
                    border: `1px solid ${T.border.subtle}`,
                    borderRadius: 4,
                    color: T.text.primary,
                    fontSize: 11,
                    fontFamily: T.font.mono,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 4 }}>DISTANCE (mi)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newComp.distance_mi}
                  onChange={(e) => setNewComp({ ...newComp, distance_mi: e.target.value })}
                  placeholder="0.5"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: T.bg.input,
                    border: `1px solid ${T.border.subtle}`,
                    borderRadius: 4,
                    color: T.text.primary,
                    fontSize: 11,
                    fontFamily: T.font.mono,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 4 }}>CLASS</label>
                <select
                  value={newComp.class}
                  onChange={(e) => setNewComp({ ...newComp, class: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: T.bg.input,
                    border: `1px solid ${T.border.subtle}`,
                    borderRadius: 4,
                    color: T.text.primary,
                    fontSize: 11,
                    fontFamily: T.font.mono,
                  }}
                >
                  <option value="A">Class A</option>
                  <option value="B">Class B</option>
                  <option value="B+">Class B+</option>
                  <option value="C">Class C</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 4 }}>TIER</label>
                <select
                  value={newComp.tier}
                  onChange={(e) => setNewComp({ ...newComp, tier: e.target.value as 'primary' | 'secondary' })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: T.bg.input,
                    border: `1px solid ${T.border.subtle}`,
                    borderRadius: 4,
                    color: T.text.primary,
                    fontSize: 11,
                    fontFamily: T.font.mono,
                  }}
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={addComp}
                style={{
                  padding: '8px 16px',
                  background: T.text.green + '22',
                  border: `1px solid ${T.text.green}`,
                  borderRadius: 4,
                  color: T.text.green,
                  fontSize: 10,
                  fontFamily: T.font.mono,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Add to Comp Set
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: `1px solid ${T.border.subtle}`,
                  borderRadius: 4,
                  color: T.text.muted,
                  fontSize: 10,
                  fontFamily: T.font.mono,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {comps.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
            <div style={{ fontSize: 12, color: T.text.primary, fontFamily: T.font.mono, marginBottom: 8 }}>
              No competitive set defined
            </div>
            <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>
              Add competitors manually or use auto-discover
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border.medium}` }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: T.text.muted }}>Property</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: T.text.muted }}>Tier</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Distance</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Units</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Avg Rent</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Occ %</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: T.text.muted }}>Class</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Built</th>
                  <th style={{ padding: '6px 8px', width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {comps.map((comp, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ color: T.text.primary, fontWeight: 500 }}>{comp.name}</div>
                      <div style={{ fontSize: 8, color: T.text.muted }}>{comp.address}</div>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 3,
                        fontSize: 8,
                        background: comp.tier === 'primary' ? T.text.cyan + '22' : T.text.muted + '22',
                        color: comp.tier === 'primary' ? T.text.cyan : T.text.muted,
                      }}>
                        {(comp.tier || 'secondary').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.secondary }}>{(comp.distance_mi || 0).toFixed(1)} mi</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.primary }}>{comp.units || '—'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.green }}>{comp.avg_rent ? fmt(comp.avg_rent, 'currency') : '—'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.amber }}>{comp.occupancy ? `${comp.occupancy.toFixed(1)}%` : '—'}</td>
                    <td style={{ padding: '6px 8px', color: T.text.purple }}>{comp.class || '—'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>{comp.year_built || '—'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <button
                        onClick={() => removeComp(comp.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: T.text.red,
                          fontSize: 12,
                          cursor: 'pointer',
                          opacity: 0.6,
                        }}
                        title="Remove from comp set"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};

interface UnitType {
  unit_type: string;
  bed_count: number;
  bath_count: number;
  sqft: number;
  count: number;
  occupied: number;
  avg_rent: number;
  market_rent: number;
  total_rent: number;
}

const UnitMixTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/api/v1/operations/${dealId}/unit-mix`)
      .then(res => setUnitTypes(res.data?.unitTypes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return <div style={{ padding: 20, color: T.text.muted }}>Loading...</div>;

  if (unitTypes.length === 0) {
    return (
      <Panel title="Unit Mix">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏠</div>
          <div style={{ fontSize: 12, color: T.text.primary, fontFamily: T.font.mono, marginBottom: 8 }}>
            No unit mix data available
          </div>
          <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>
            Upload a rent roll to populate unit mix
          </div>
        </div>
      </Panel>
    );
  }

  // Calculate totals
  const totalUnits = unitTypes.reduce((sum, ut) => sum + ut.count, 0);
  const totalOccupied = unitTypes.reduce((sum, ut) => sum + ut.occupied, 0);
  const totalRent = unitTypes.reduce((sum, ut) => sum + ut.total_rent, 0);
  const avgRent = totalUnits > 0 ? totalRent / totalOccupied : 0;
  const overallOcc = totalUnits > 0 ? (totalOccupied / totalUnits) * 100 : 0;

  // Colors for different bed counts
  const bedColors: Record<number, string> = {
    0: T.text.purple,
    1: T.text.cyan,
    2: T.text.green,
    3: T.text.amber,
    4: T.text.orange,
  };

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>TOTAL UNITS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text.cyan, fontFamily: T.font.mono }}>{totalUnits}</div>
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>OCCUPANCY</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text.green, fontFamily: T.font.mono }}>{overallOcc.toFixed(1)}%</div>
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>AVG RENT</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text.amber, fontFamily: T.font.mono }}>{fmt(avgRent, 'currency')}</div>
        </div>
        <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>UNIT TYPES</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text.purple, fontFamily: T.font.mono }}>{unitTypes.length}</div>
        </div>
      </div>

      {/* Unit Mix Breakdown */}
      <Panel title="Unit Mix by Bedroom">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          {unitTypes.map((ut, i) => {
            const occ = ut.count > 0 ? (ut.occupied / ut.count) * 100 : 0;
            const color = bedColors[ut.bed_count] || T.text.muted;
            return (
              <div key={i} style={{
                background: T.bg.panelAlt,
                border: `1px solid ${T.border.subtle}`,
                borderLeft: `4px solid ${color}`,
                borderRadius: 4,
                padding: 12,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.text.primary, fontFamily: T.font.mono, marginBottom: 8 }}>
                  {ut.unit_type}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>Units</div>
                  <div style={{ fontSize: 9, color: T.text.primary, fontFamily: T.font.mono, textAlign: 'right' }}>{ut.count}</div>
                  <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>Occ</div>
                  <div style={{ fontSize: 9, color: occ >= 95 ? T.text.green : occ >= 90 ? T.text.amber : T.text.red, fontFamily: T.font.mono, textAlign: 'right' }}>
                    {occ.toFixed(0)}%
                  </div>
                  <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>Avg Rent</div>
                  <div style={{ fontSize: 9, color: T.text.primary, fontFamily: T.font.mono, textAlign: 'right' }}>{fmt(ut.avg_rent, 'currency')}</div>
                  <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>Sqft</div>
                  <div style={{ fontSize: 9, color: T.text.secondary, fontFamily: T.font.mono, textAlign: 'right' }}>{ut.sqft.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border.medium}` }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: T.text.muted }}>Unit Type</th>
                <th style={{ padding: '6px 8px', textAlign: 'center', color: T.text.muted }}>Bed/Bath</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Sqft</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Units</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Occupied</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Occ %</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Avg Rent</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Market</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>$/Sqft</th>
              </tr>
            </thead>
            <tbody>
              {unitTypes.map((ut, i) => {
                const occ = ut.count > 0 ? (ut.occupied / ut.count) * 100 : 0;
                const perSqft = ut.sqft > 0 ? ut.avg_rent / ut.sqft : 0;
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                    <td style={{ padding: '6px 8px', color: T.text.primary, fontWeight: 500 }}>{ut.unit_type}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', color: T.text.secondary }}>{ut.bed_count}b/{ut.bath_count}ba</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.secondary }}>{ut.sqft.toLocaleString()}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.primary }}>{ut.count}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.green }}>{ut.occupied}</td>
                    <td style={{
                      padding: '6px 8px',
                      textAlign: 'right',
                      color: occ >= 95 ? T.text.green : occ >= 90 ? T.text.amber : T.text.red,
                    }}>
                      {occ.toFixed(1)}%
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.primary }}>{fmt(ut.avg_rent, 'currency')}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>{fmt(ut.market_rent, 'currency')}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.amber }}>${perSqft.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${T.border.medium}`, background: T.bg.panelAlt }}>
                <td colSpan={3} style={{ padding: '6px 8px', color: T.text.primary, fontWeight: 700 }}>TOTAL</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.primary, fontWeight: 700 }}>{totalUnits}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.green, fontWeight: 700 }}>{totalOccupied}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.amber, fontWeight: 700 }}>{overallOcc.toFixed(1)}%</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.primary, fontWeight: 700 }}>{fmt(avgRent, 'currency')}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>
    </div>
  );
};

const ExitPlanningTab: React.FC<{ dealId: string }> = ({ dealId }) => (
  <LifecycleSection dealId={dealId} initialTab="disposition" />
);

const RefiAnalysisTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [currentDebt, setCurrentDebt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newRate, setNewRate] = useState<number>(6.5);
  const [newLtv, setNewLtv] = useState<number>(65);

  useEffect(() => {
    Promise.all([
      apiClient.get(`/api/v1/lifecycle/deals/${dealId}/debt/positions`).catch(() => ({ data: { positions: [] } })),
      apiClient.get(`/api/v1/lifecycle/deals/${dealId}/debt/refi-scenarios`).catch(() => ({ data: { scenarios: [] } })),
    ]).then(([debtRes, scenarioRes]) => {
      const positions = debtRes.data?.positions || [];
      setCurrentDebt(positions[0] || null);
      setScenarios(scenarioRes.data?.scenarios || []);
    }).finally(() => setLoading(false));
  }, [dealId]);

  if (loading) return <div style={{ padding: 20, color: T.text.muted }}>Loading...</div>;

  const runScenario = async () => {
    try {
      const res = await apiClient.post(`/api/v1/lifecycle/deals/${dealId}/debt/refi-test`, {
        new_rate: newRate / 100,
        new_ltv: newLtv / 100,
        term_years: 10,
      });
      if (res.data?.result) {
        setScenarios([res.data.result, ...scenarios.slice(0, 4)]);
      }
    } catch (err) {
      console.error('Refi scenario failed:', err);
    }
  };

  return (
    <div>
      {/* Current Debt Summary */}
      {currentDebt && (
        <Panel title="Current Debt" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>BALANCE</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text.primary, fontFamily: T.font.mono }}>
                {fmt(currentDebt.current_balance, 'currency')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>RATE</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text.cyan, fontFamily: T.font.mono }}>
                {(currentDebt.interest_rate * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>MONTHLY P&I</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text.orange, fontFamily: T.font.mono }}>
                {fmt(currentDebt.monthly_payment, 'currency')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>MATURITY</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text.amber, fontFamily: T.font.mono }}>
                {currentDebt.maturity_date?.slice(0, 10) || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>LTV</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text.purple, fontFamily: T.font.mono }}>
                {currentDebt.ltv ? `${(currentDebt.ltv * 100).toFixed(0)}%` : '—'}
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* Scenario Builder */}
      <Panel title="Refinance Scenario" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 4 }}>NEW RATE (%)</label>
            <input
              type="number"
              step="0.125"
              value={newRate}
              onChange={(e) => setNewRate(parseFloat(e.target.value))}
              style={{
                width: 100,
                padding: '8px 10px',
                background: T.bg.input,
                border: `1px solid ${T.border.subtle}`,
                borderRadius: 4,
                color: T.text.primary,
                fontSize: 12,
                fontFamily: T.font.mono,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 9, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 4 }}>NEW LTV (%)</label>
            <input
              type="number"
              step="5"
              value={newLtv}
              onChange={(e) => setNewLtv(parseFloat(e.target.value))}
              style={{
                width: 100,
                padding: '8px 10px',
                background: T.bg.input,
                border: `1px solid ${T.border.subtle}`,
                borderRadius: 4,
                color: T.text.primary,
                fontSize: 12,
                fontFamily: T.font.mono,
              }}
            />
          </div>
          <button
            onClick={runScenario}
            style={{
              padding: '10px 20px',
              background: T.text.cyan + '22',
              border: `1px solid ${T.text.cyan}`,
              borderRadius: 4,
              color: T.text.cyan,
              fontSize: 11,
              fontFamily: T.font.mono,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            RUN SCENARIO
          </button>
        </div>
      </Panel>

      {/* Scenario Results */}
      <Panel title="Scenario Analysis">
        {scenarios.length === 0 ? (
          <div style={{ padding: 20, color: T.text.muted, textAlign: 'center', fontSize: 11 }}>
            Run a refinance scenario to see the analysis
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: T.font.mono }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border.medium}` }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: T.text.muted }}>Scenario</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>New Rate</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>New LTV</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>New Loan</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>New P&I</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Monthly Δ</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>Cash Out</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', color: T.text.muted }}>DSCR</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s, i) => {
                  const monthlySavings = currentDebt ? currentDebt.monthly_payment - s.new_monthly_payment : 0;
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                      <td style={{ padding: '6px 8px', color: T.text.primary }}>Scenario {i + 1}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.cyan }}>{(s.new_rate * 100).toFixed(2)}%</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.purple }}>{(s.new_ltv * 100).toFixed(0)}%</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.primary }}>{fmt(s.new_loan_amount, 'currency')}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: T.text.orange }}>{fmt(s.new_monthly_payment, 'currency')}</td>
                      <td style={{
                        padding: '6px 8px',
                        textAlign: 'right',
                        color: monthlySavings >= 0 ? T.text.green : T.text.red,
                        fontWeight: 600,
                      }}>
                        {monthlySavings >= 0 ? '+' : ''}{fmt(monthlySavings, 'currency')}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: s.cash_out_proceeds > 0 ? T.text.green : T.text.muted }}>
                        {fmt(s.cash_out_proceeds || 0, 'currency')}
                      </td>
                      <td style={{
                        padding: '6px 8px',
                        textAlign: 'right',
                        color: s.new_dscr >= 1.25 ? T.text.green : s.new_dscr >= 1.0 ? T.text.amber : T.text.red,
                      }}>
                        {s.new_dscr?.toFixed(2)}x
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};

// ─── Activity Tab (Emails + Tasks + Events) ─────────────────────────────────────

interface Email {
  id: string;
  subject: string;
  from_address: string;
  snippet: string;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
}

interface Task {
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
  const [emails, setEmails] = useState<Email[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
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

  return (
    <div>
      {/* Sub-tabs */}
      <SubTabs
        tabs={[
          { id: 'unified', label: 'All Activity' },
          { id: 'emails', label: `Emails (${emails.length})` },
          { id: 'tasks', label: `Tasks (${tasks.filter(t => t.status !== 'done').length})` },
        ]}
        active={activeSubTab}
        onChange={(id) => setActiveSubTab(id as any)}
      />

      {/* Unified Activity */}
      {activeSubTab === 'unified' && (
        <Panel title="Recent Activity">
          {unified.length === 0 ? (
            <div style={{ padding: 20, color: T.text.muted, textAlign: 'center', fontSize: 11 }}>
              No activity yet
            </div>
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
        </Panel>
      )}

      {/* Emails */}
      {activeSubTab === 'emails' && (
        <Panel title="Deal Emails">
          {emails.length === 0 ? (
            <div style={{ padding: 20, color: T.text.muted, textAlign: 'center', fontSize: 11 }}>
              No emails linked to this deal yet. Link emails from your inbox.
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
        </Panel>
      )}

      {/* Tasks */}
      {activeSubTab === 'tasks' && (
        <div>
          <Panel title="Deal Tasks">
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

            {/* New Task Form */}
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

            {/* Task List */}
            {tasks.length === 0 ? (
              <div style={{ padding: 20, color: T.text.muted, textAlign: 'center', fontSize: 11 }}>
                No tasks for this deal. Create one to track action items.
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
          </Panel>
        </div>
      )}
    </div>
  );
};

interface UploadResult {
  filename: string;
  documentType: string;
  success: boolean;
  error?: string;
  warnings: string[];
  rowsInserted?: number;
}

const UploadPackageTab: React.FC<{ dealId: string }> = ({ dealId }) => {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [summary, setSummary] = useState<{ total: number; successful: number; failed: number; extractedMonth?: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    
    setUploading(true);
    setResults([]);
    setSummary(null);
    
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      formData.append('dealId', dealId);
      
      const response = await apiClient.post('/api/v1/reporting-package/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      if (response.data.success) {
        setResults(response.data.results || []);
        setSummary(response.data.summary);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setResults([{ filename: 'Upload failed', documentType: 'ERROR', success: false, error: err.message, warnings: [] }]);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      uploadFiles(Array.from(e.target.files));
    }
  };

  return (
    <Panel title="Upload Monthly Reporting Package">
      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? T.text.cyan : uploading ? T.text.amber : T.border.medium}`,
          borderRadius: 8,
          padding: 40,
          textAlign: 'center',
          background: dragging ? T.text.cyan + '11' : uploading ? T.text.amber + '11' : 'transparent',
          transition: 'all 0.2s',
          cursor: uploading ? 'wait' : 'pointer',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.pdf,.zip"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: 32, marginBottom: 12 }}>{uploading ? '⏳' : '📁'}</div>
        <div style={{ fontSize: 12, color: T.text.primary, fontFamily: T.font.mono, marginBottom: 8 }}>
          {uploading ? 'Processing files...' : 'Drag & drop your monthly reporting package'}
        </div>
        <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 16 }}>
          {uploading ? 'AI is extracting data' : 'Supports: Excel (.xlsx), PDF, or ZIP archive'}
        </div>
        {!uploading && (
          <button style={{
            background: T.text.cyan + '22',
            border: `1px solid ${T.text.cyan}`,
            color: T.text.cyan,
            padding: '8px 16px',
            borderRadius: 4,
            fontFamily: T.font.mono,
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
          }}>
            SELECT FILES
          </button>
        )}
      </div>

      {/* Upload Results */}
      {summary && (
        <div style={{
          marginTop: 16,
          padding: 12,
          background: summary.failed === 0 ? T.text.green + '22' : T.text.amber + '22',
          border: `1px solid ${summary.failed === 0 ? T.text.green : T.text.amber}`,
          borderRadius: 4,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: T.font.mono, color: T.text.primary, marginBottom: 4 }}>
            Upload Complete: {summary.successful}/{summary.total} files processed
          </div>
          {summary.extractedMonth && (
            <div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.text.muted }}>
              Extracted data for: {summary.extractedMonth}
            </div>
          )}
        </div>
      )}

      {/* File Results */}
      {results.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Processing Results
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {results.map((r, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                background: T.bg.panelAlt,
                border: `1px solid ${r.success ? T.text.green + '44' : T.text.red + '44'}`,
                borderRadius: 4,
              }}>
                <span style={{ fontSize: 14 }}>{r.success ? '✅' : '❌'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontFamily: T.font.mono, color: T.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.filename}
                  </div>
                  <div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.muted }}>
                    {r.documentType}{r.rowsInserted ? ` • ${r.rowsInserted} rows` : ''}
                  </div>
                </div>
                {r.error && (
                  <div style={{ fontSize: 9, fontFamily: T.font.mono, color: T.text.red, maxWidth: 200 }}>
                    {r.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expected Reports */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Recognized Report Types
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { name: 'BPI Financial Package', icon: '📊' },
            { name: 'BPI Variance Report', icon: '📉' },
            { name: 'Balance Sheet', icon: '💰' },
            { name: 'Cash Flow', icon: '💵' },
            { name: 'Rent Roll', icon: '🏠' },
            { name: 'General Ledger', icon: '📓' },
            { name: 'Trial Balance', icon: '⚖️' },
            { name: 'Bank Reconciliation', icon: '🏦' },
            { name: 'Aged Receivables', icon: '📅' },
          ].map(report => (
            <div key={report.name} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 10px',
              background: T.bg.panelAlt,
              border: `1px solid ${T.border.subtle}`,
              borderRadius: 4,
              fontSize: 9,
              color: T.text.secondary,
              fontFamily: T.font.mono,
            }}>
              <span>{report.icon}</span>
              <span>{report.name}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
};
