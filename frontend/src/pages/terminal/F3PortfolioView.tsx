/**
 * F3 Portfolio & Reports View
 * 
 * Unified terminal view combining:
 * - Portfolio asset management
 * - Performance analytics
 * - Financial reporting
 * - Agent learning metrics
 * - Archive benchmarking
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, TrendingDown, Building2, DollarSign, 
  FileText, Download, ChevronRight, ChevronDown,
  BarChart3, PieChart, Activity, Target, Brain,
  Calendar, AlertTriangle, CheckCircle, Clock,
  Upload, X, Loader2,
} from 'lucide-react';
import { apiClient } from '../../services/api.client';
import { ContextIndicator } from '../../components/intelligence/ContextIndicator';
import { useAutoContextAnalysis } from '../../hooks/useContextAwareness';

// ─── Theme System ─────────────────────────────────────────────
interface Theme {
  bg: { terminal: string; panel: string; panelAlt: string; hover: string; active: string };
  text: { primary: string; secondary: string; muted: string; amber: string; green: string; red: string; cyan: string };
  border: { subtle: string; medium: string };
  font: { mono: string };
}

const MONO = "'JetBrains Mono','Fira Code','SF Mono',monospace";

// ─── Types ────────────────────────────────────────────────────

interface PortfolioAsset {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  msa: string;
  units: number;
  assetClass: string;
  vintage: number;
  acquisitionDate: string;
  purchasePrice: number;
  currentValue: number;
  noi: number;
  occupancy: number;
  capRate: number;
  irr: number;
  equity: number;
  debt: number;
  status: 'performing' | 'watch' | 'distressed';
}

interface PortfolioMetrics {
  totalAssets: number;
  totalUnits: number;
  totalValue: number;
  totalEquity: number;
  totalDebt: number;
  avgOccupancy: number;
  avgCapRate: number;
  portfolioNoi: number;
  ytdReturn: number;
  ltmCashOnCash: number;
}

interface PerformanceData {
  period: string;
  period_date?: string;
  noi: number;
  occupancy: number;
  collections?: number;
  expenses?: number | null;
  actual_noi?: number | null;
  projected_noi?: number;
  actual_occupancy?: number | null;
  projected_occupancy?: number;
  n_actual_deals?: number;
}

interface PeriodContributor {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  actual_noi: number | null;
  actual_occupancy_pct: number | null;
  actual_rent_per_unit: number | null;
  variance_from_projection_pct: number | null;
}

interface AgentAccuracy {
  assumptionName: string;
  hitRate10Pct: number;
  hitRate20Pct: number;
  meanBias: number;
  nPredictions: number;
  trend: 'improving' | 'stable' | 'worsening';
}

interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  category: 'portfolio' | 'deal' | 'market' | 'agent';
  icon: React.ReactNode;
  lastGenerated?: string;
}

interface PortfolioComp {
  id?: string;
  comp_name?: string;
  comp_property_address?: string;
  avg_rent?: number;
  occupancy?: number;
  distance_miles?: number;
  match_score?: number;
  units?: number;
  year_built?: number;
}

// ─── Component ────────────────────────────────────────────────

interface F3PortfolioViewProps {
  theme: Theme;
}

export default function F3PortfolioView({ theme: T }: F3PortfolioViewProps) {
  const navigate = useNavigate();
  
  // State
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'performance' | 'reports' | 'learning' | 'comps'>('overview');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [performance, setPerformance] = useState<PerformanceData[]>([]);
  const [agentAccuracy, setAgentAccuracy] = useState<AgentAccuracy[]>([]);
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const [selectedTimeframe, setSelectedTimeframe] = useState<'mtd' | 'qtd' | 'ytd' | 'ltm'>('ytd');
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [periodContributors, setPeriodContributors] = useState<PeriodContributor[]>([]);
  const [contributorsLoading, setContributorsLoading] = useState(false);
  // Comp Sets state
  const [comps, setComps] = useState<Record<string, PortfolioComp[]>>({});
  const [compsLoading, setCompsLoading] = useState<Set<string>>(new Set());
  const [compsExpanded, setCompsExpanded] = useState<Set<string>>(new Set());
  const [discovering, setDiscovering] = useState<string | null>(null);

  // Upload Actuals modal
  const [showActualsModal, setShowActualsModal] = useState(false);
  const [actualsMode, setActualsMode] = useState<'manual' | 'file'>('manual');
  const [actualsAssetId, setActualsAssetId] = useState('');
  const [actualsPeriod, setActualsPeriod] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [actualsForm, setActualsForm] = useState({
    net_operating_income: '',
    physical_occupancy_pct: '',
    effective_gross_income: '',
    total_operating_expenses: '',
    units_occupied: '',
    avg_rent_achieved: '',
    collections_rate: '',
  });
  const [actualsFile, setActualsFile] = useState<File | null>(null);
  const [submittingActuals, setSubmittingActuals] = useState(false);
  const [actualsSuccess, setActualsSuccess] = useState(false);
  const [actualsError, setActualsError] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    loadPortfolioData();
  }, []);

  // Reload performance data when timeframe changes
  useEffect(() => {
    apiClient.get(`/api/v1/portfolio/performance?timeframe=${selectedTimeframe}`)
      .then(res => setPerformance(res.data.data || []))
      .catch(() => {});
    setSelectedPeriod(null);
    setPeriodContributors([]);
  }, [selectedTimeframe]);

  // Fetch contributors when a period is selected
  useEffect(() => {
    if (!selectedPeriod) {
      setPeriodContributors([]);
      return;
    }
    const periodEntry = performance.find(p => p.period === selectedPeriod);
    const periodDate = periodEntry?.period_date;
    if (!periodDate) {
      setPeriodContributors([]);
      return;
    }
    setContributorsLoading(true);
    apiClient.get(`/api/v1/portfolio/performance/contributors?period=${periodDate}`)
      .then(res => setPeriodContributors(res.data.contributors || []))
      .catch(() => setPeriodContributors([]))
      .finally(() => setContributorsLoading(false));
  }, [selectedPeriod, performance]);
  
  const loadPortfolioData = async () => {
    setLoading(true);
    try {
      // Load portfolio metrics
      const metricsRes = await apiClient.get('/api/v1/portfolio/metrics').catch(() => ({ data: null }));
      if (metricsRes.data) setMetrics(metricsRes.data);
      
      // Load assets
      const assetsRes = await apiClient.get('/api/v1/portfolio/assets').catch(() => ({ data: { assets: [] } }));
      setAssets(assetsRes.data.assets || []);
      
      // Load performance data
      const perfRes = await apiClient.get(`/api/v1/portfolio/performance?timeframe=${selectedTimeframe}`).catch(() => ({ data: { data: [] } }));
      setPerformance(perfRes.data.data || []);
      
      // Load agent learning metrics
      const learningRes = await apiClient.get('/api/v1/learning/outcomes/summary').catch(() => ({ data: { summary: [] } }));
      setAgentAccuracy((learningRes.data.summary || []).map((r: any) => ({
        assumptionName: r.assumption_name,
        hitRate10Pct: (r.hit_rate_10pct || 0) * 100,
        hitRate20Pct: (r.hit_rate_20pct || 0) * 100,
        meanBias: r.mean_gap_pct || 0,
        nPredictions: r.n_predictions || 0,
        trend: r.mean_gap_pct > 5 ? 'worsening' : r.mean_gap_pct < -5 ? 'worsening' : 'stable',
      })));
      
    } catch (err) {
      console.error('Failed to load portfolio data:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // ─── Upload Actuals Handler ────────────────────────────────────

  const handleActualsSubmit = useCallback(async () => {
    if (!actualsAssetId || !actualsPeriod) return;
    setActualsError(null);
    setSubmittingActuals(true);
    try {
      const periodStart = `${actualsPeriod}-01`;
      if (actualsMode === 'manual') {
        const row: Record<string, any> = {
          period_start: periodStart,
          source: 'manual',
        };
        if (actualsForm.net_operating_income)    row.net_operating_income    = parseFloat(actualsForm.net_operating_income);
        if (actualsForm.physical_occupancy_pct)  row.physical_occupancy_pct  = parseFloat(actualsForm.physical_occupancy_pct);
        if (actualsForm.effective_gross_income)  row.effective_gross_income  = parseFloat(actualsForm.effective_gross_income);
        if (actualsForm.total_operating_expenses)row.total_operating_expenses= parseFloat(actualsForm.total_operating_expenses);
        if (actualsForm.units_occupied)          row.units_occupied          = parseInt(actualsForm.units_occupied);
        if (actualsForm.avg_rent_achieved)       row.avg_rent_achieved       = parseFloat(actualsForm.avg_rent_achieved);
        if (actualsForm.collections_rate)        row.collections_rate        = parseFloat(actualsForm.collections_rate);
        await apiClient.post(`/api/v1/operations/${actualsAssetId}/actuals`, { actuals: [row] });
      } else {
        if (!actualsFile) return;
        const fd = new FormData();
        fd.append('file', actualsFile);
        await apiClient.post(`/api/v1/data-upload/${actualsAssetId}/actuals/upload`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      setActualsSuccess(true);
      setTimeout(() => {
        setShowActualsModal(false);
        setActualsSuccess(false);
        setActualsForm({ net_operating_income: '', physical_occupancy_pct: '', effective_gross_income: '', total_operating_expenses: '', units_occupied: '', avg_rent_achieved: '', collections_rate: '' });
        setActualsFile(null);
        loadPortfolioData();
      }, 1800);
    } catch (err: any) {
      setActualsError(err?.response?.data?.error || 'Upload failed — check your inputs and try again');
    } finally {
      setSubmittingActuals(false);
    }
  }, [actualsAssetId, actualsPeriod, actualsMode, actualsForm, actualsFile]);

  // ─── Comp Set Functions ───────────────────────────────────────

  const loadCompSet = (assetId: string) => {
  // Neural network context awareness
  const { analysis: portfolioContext, loading: contextLoading } = useAutoContextAnalysis(
  { context: 'deal_overview' }  // portfolio-level analysis
  );

    setCompsLoading(prev => new Set(prev).add(assetId));
    apiClient.get(`/api/v1/deals/${assetId}/comp-set`)
      .then(res => setComps(prev => ({ ...prev, [assetId]: res.data?.comps || [] })))
      .catch(() => setComps(prev => ({ ...prev, [assetId]: [] })))
      .finally(() => setCompsLoading(prev => { const s = new Set(prev); s.delete(assetId); return s; }));
  };

  const discoverCompsForAsset = async (assetId: string) => {
    setDiscovering(assetId);
    try {
      await apiClient.post(`/api/v1/deals/${assetId}/comp-set/discover`);
      loadCompSet(assetId);
    } catch (e) { console.error('Discover comps failed:', e); }
    finally { setDiscovering(null); }
  };

  const toggleCompsRow = (assetId: string) => {
    setCompsExpanded(prev => {
      const n = new Set(prev);
      if (n.has(assetId)) { n.delete(assetId); }
      else { n.add(assetId); if (!comps[assetId]) loadCompSet(assetId); }
      return n;
    });
  };

  // Report definitions
  const reports: ReportDefinition[] = [
    { id: 'portfolio-summary', name: 'Portfolio Summary', description: 'Executive overview of all assets, metrics, and performance', category: 'portfolio', icon: <Building2 size={16} /> },
    { id: 'quarterly-report', name: 'Quarterly Report', description: 'Detailed Q/Q performance with variance analysis', category: 'portfolio', icon: <Calendar size={16} /> },
    { id: 'noi-waterfall', name: 'NOI Waterfall', description: 'Revenue and expense breakdown by property', category: 'portfolio', icon: <BarChart3 size={16} /> },
    { id: 'occupancy-trend', name: 'Occupancy Trend', description: 'Historical occupancy with lease expiration schedule', category: 'portfolio', icon: <Activity size={16} /> },
    { id: 'debt-summary', name: 'Debt Summary', description: 'Loan details, maturities, and refinancing timeline', category: 'portfolio', icon: <DollarSign size={16} /> },
    { id: 'deal-performance', name: 'Deal Performance', description: 'IRR, cash-on-cash, and equity multiple by deal', category: 'deal', icon: <Target size={16} /> },
    { id: 'underwriting-accuracy', name: 'Underwriting Accuracy', description: 'Assumed vs actual performance across closed deals', category: 'agent', icon: <Brain size={16} /> },
    { id: 'market-benchmark', name: 'Market Benchmark', description: 'Portfolio performance vs market indices', category: 'market', icon: <TrendingUp size={16} /> },
    { id: 'risk-report', name: 'Risk Report', description: 'Concentration, exposure, and watch list assets', category: 'portfolio', icon: <AlertTriangle size={16} /> },
  ];
  
  // Format helpers
  const fmt = (v: number | null | undefined, prefix = '', suffix = '') => {
    if (v == null) return '—';
    return `${prefix}${v.toLocaleString()}${suffix}`;
  };
  
  const fmtCurrency = (v: number | null | undefined) => {
    if (v == null) return '—';
    if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  };
  
  const fmtPct = (v: number | null | undefined) => {
    if (v == null) return '—';
    return `${v.toFixed(1)}%`;
  };
  
  // ─── Tab Content Renderers ──────────────────────────────────
  
  const renderOverview = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Context Awareness */}
      {portfolioContext && (
        <ContextIndicator analysis={portfolioContext} loading={contextLoading} compact />
      )}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Portfolio KPIs */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text.cyan, letterSpacing: 1, marginBottom: 16, fontFamily: MONO }}>
          PORTFOLIO SUMMARY
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'TOTAL VALUE', value: fmtCurrency(metrics?.totalValue), color: T.text.amber },
            { label: 'TOTAL UNITS', value: fmt(metrics?.totalUnits), color: T.text.primary },
            { label: 'ASSETS', value: fmt(metrics?.totalAssets), color: T.text.primary },
            { label: 'AVG OCCUPANCY', value: fmtPct(metrics?.avgOccupancy), color: (metrics?.avgOccupancy ?? 0) > 93 ? T.text.green : T.text.amber },
            { label: 'PORTFOLIO NOI', value: fmtCurrency(metrics?.portfolioNoi), color: T.text.green },
            { label: 'AVG CAP RATE', value: fmtPct(metrics?.avgCapRate), color: T.text.cyan },
            { label: 'TOTAL EQUITY', value: fmtCurrency(metrics?.totalEquity), color: T.text.primary },
            { label: 'TOTAL DEBT', value: fmtCurrency(metrics?.totalDebt), color: T.text.secondary },
            { label: 'YTD RETURN', value: fmtPct(metrics?.ytdReturn), color: (metrics?.ytdReturn ?? 0) > 0 ? T.text.green : T.text.red },
          ].map((kpi, i) => (
            <div key={i} style={{ padding: 12, background: T.bg.panelAlt, border: `1px solid ${T.border.subtle}` }}>
              <div style={{ fontSize: 9, color: T.text.muted, fontFamily: MONO, marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: kpi.color, fontFamily: MONO }}>{kpi.value}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Asset Allocation */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text.cyan, letterSpacing: 1, marginBottom: 16, fontFamily: MONO }}>
          ASSET ALLOCATION
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Class A', pct: 35, value: '$142M', color: '#00D26A' },
            { label: 'Class B', pct: 45, value: '$183M', color: '#00BCD4' },
            { label: 'Class C', pct: 20, value: '$81M', color: '#F5A623' },
          ].map((alloc, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: T.text.primary, fontFamily: MONO }}>{alloc.label}</span>
                <span style={{ fontSize: 11, color: T.text.secondary, fontFamily: MONO }}>{alloc.value} ({alloc.pct}%)</span>
              </div>
              <div style={{ height: 8, background: T.bg.panelAlt, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${alloc.pct}%`, background: alloc.color, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
        
        {/* Geographic Distribution */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 10, color: T.text.muted, fontFamily: MONO, marginBottom: 8 }}>BY MARKET</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { market: 'Atlanta', units: 1240 },
              { market: 'Tampa', units: 890 },
              { market: 'Charlotte', units: 650 },
              { market: 'Raleigh', units: 420 },
            ].map((m, i) => (
              <div key={i} style={{ padding: '4px 10px', background: T.bg.panelAlt, border: `1px solid ${T.border.subtle}`, borderRadius: 4 }}>
                <span style={{ fontSize: 10, color: T.text.primary, fontFamily: MONO }}>{m.market}</span>
                <span style={{ fontSize: 10, color: T.text.muted, fontFamily: MONO, marginLeft: 6 }}>{m.units} units</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Top Performers */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text.green, letterSpacing: 1, marginBottom: 16, fontFamily: MONO }}>
          TOP PERFORMERS
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
              <th style={{ textAlign: 'left', padding: '6px 0', color: T.text.muted }}>ASSET</th>
              <th style={{ textAlign: 'right', padding: '6px 0', color: T.text.muted }}>NOI</th>
              <th style={{ textAlign: 'right', padding: '6px 0', color: T.text.muted }}>OCC</th>
              <th style={{ textAlign: 'right', padding: '6px 0', color: T.text.muted }}>IRR</th>
            </tr>
          </thead>
          <tbody>
            {assets.slice(0, 5).map((asset, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                <td style={{ padding: '8px 0', color: T.text.primary }}>{asset.name}</td>
                <td style={{ textAlign: 'right', color: T.text.green }}>{fmtCurrency(asset.noi)}</td>
                <td style={{ textAlign: 'right', color: asset.occupancy > 93 ? T.text.green : T.text.amber }}>{fmtPct(asset.occupancy)}</td>
                <td style={{ textAlign: 'right', color: T.text.cyan }}>{fmtPct(asset.irr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Watch List */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text.amber, letterSpacing: 1, marginBottom: 16, fontFamily: MONO }}>
          WATCH LIST
        </div>
        {assets.filter(a => a.status === 'watch').length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: T.text.muted }}>
            <CheckCircle size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div style={{ fontSize: 11, fontFamily: MONO }}>No assets on watch list</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {assets.filter(a => a.status === 'watch').map((asset, i) => (
              <div key={i} style={{ padding: 12, background: T.bg.panelAlt, border: `1px solid ${T.border.subtle}`, borderLeft: `3px solid ${T.text.amber}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.text.primary, fontFamily: MONO }}>{asset.name}</div>
                <div style={{ fontSize: 10, color: T.text.secondary, fontFamily: MONO, marginTop: 4 }}>
                  Occupancy: {fmtPct(asset.occupancy)} • NOI: {fmtCurrency(asset.noi)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
  
  const renderAssets = () => (
    <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}` }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text.cyan, letterSpacing: 1, fontFamily: MONO }}>
          PORTFOLIO ASSETS ({assets.length})
        </div>
        <button 
          onClick={() => navigate('/deals/create', { state: { dealCategory: 'portfolio' } })}
          style={{ padding: '4px 12px', background: T.text.amber, color: T.bg.terminal, border: 'none', fontSize: 10, fontWeight: 700, fontFamily: MONO, cursor: 'pointer' }}
        >
          + ADD ASSET
        </button>
      </div>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 10 }}>
        <thead>
          <tr style={{ background: T.bg.panelAlt }}>
            <th style={{ textAlign: 'left', padding: '10px 16px', color: T.text.muted, fontWeight: 600 }}>PROPERTY</th>
            <th style={{ textAlign: 'left', padding: '10px 8px', color: T.text.muted, fontWeight: 600 }}>MARKET</th>
            <th style={{ textAlign: 'center', padding: '10px 8px', color: T.text.muted, fontWeight: 600 }}>CLASS</th>
            <th style={{ textAlign: 'right', padding: '10px 8px', color: T.text.muted, fontWeight: 600 }}>UNITS</th>
            <th style={{ textAlign: 'right', padding: '10px 8px', color: T.text.muted, fontWeight: 600 }}>VALUE</th>
            <th style={{ textAlign: 'right', padding: '10px 8px', color: T.text.muted, fontWeight: 600 }}>NOI</th>
            <th style={{ textAlign: 'right', padding: '10px 8px', color: T.text.muted, fontWeight: 600 }}>OCC</th>
            <th style={{ textAlign: 'right', padding: '10px 8px', color: T.text.muted, fontWeight: 600 }}>CAP</th>
            <th style={{ textAlign: 'right', padding: '10px 16px', color: T.text.muted, fontWeight: 600 }}>IRR</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset, i) => (
            <tr 
              key={asset.id} 
              style={{ borderBottom: `1px solid ${T.border.subtle}`, cursor: 'pointer' }}
              onClick={() => navigate(`/assets-owned/${asset.id}/property`)}
            >
              <td style={{ padding: '12px 16px' }}>
                <div style={{ color: T.text.primary, fontWeight: 500 }}>{asset.name}</div>
                <div style={{ color: T.text.muted, fontSize: 9 }}>{asset.address}</div>
              </td>
              <td style={{ padding: '12px 8px', color: T.text.secondary }}>{asset.city}, {asset.state}</td>
              <td style={{ textAlign: 'center', padding: '12px 8px' }}>
                <span style={{ 
                  padding: '2px 8px', 
                  background: asset.assetClass === 'A' ? '#00D26A22' : asset.assetClass === 'B' ? '#00BCD422' : '#F5A62322',
                  color: asset.assetClass === 'A' ? '#00D26A' : asset.assetClass === 'B' ? '#00BCD4' : '#F5A623',
                  borderRadius: 4,
                  fontWeight: 600,
                }}>
                  {asset.assetClass}
                </span>
              </td>
              <td style={{ textAlign: 'right', padding: '12px 8px', color: T.text.primary }}>{asset.units}</td>
              <td style={{ textAlign: 'right', padding: '12px 8px', color: T.text.amber }}>{fmtCurrency(asset.currentValue)}</td>
              <td style={{ textAlign: 'right', padding: '12px 8px', color: T.text.green }}>{fmtCurrency(asset.noi)}</td>
              <td style={{ textAlign: 'right', padding: '12px 8px', color: asset.occupancy > 93 ? T.text.green : T.text.amber }}>{fmtPct(asset.occupancy)}</td>
              <td style={{ textAlign: 'right', padding: '12px 8px', color: T.text.cyan }}>{fmtPct(asset.capRate)}</td>
              <td style={{ textAlign: 'right', padding: '12px 16px', color: asset.irr > 15 ? T.text.green : T.text.primary }}>{fmtPct(asset.irr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  
  const renderPerformance = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Timeframe Selector + Upload Button */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['mtd', 'qtd', 'ytd', 'ltm'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              style={{
                padding: '6px 16px',
                background: selectedTimeframe === tf ? T.text.amber : T.bg.panel,
                color: selectedTimeframe === tf ? T.bg.terminal : T.text.secondary,
                border: `1px solid ${selectedTimeframe === tf ? T.text.amber : T.border.subtle}`,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: MONO,
                cursor: 'pointer',
              }}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setActualsAssetId(assets[0]?.id || '');
            setActualsSuccess(false);
            setActualsError(null);
            setShowActualsModal(true);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px',
            background: 'transparent',
            border: `1px solid ${T.text.cyan}55`,
            color: T.text.cyan,
            fontSize: 10, fontWeight: 700,
            fontFamily: MONO, letterSpacing: 0.6,
            cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = T.text.cyan;
            e.currentTarget.style.background = `${T.text.cyan}10`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = `${T.text.cyan}55`;
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Upload size={11} />
          UPLOAD ACTUALS
        </button>
      </div>
      
      {/* Variance Summary Banner — full width */}
      {(() => {
        const slice = performance.slice(-12);
        const actualNoiSlice = slice.filter(p => p.actual_noi != null);
        const totalActualNoi = actualNoiSlice.reduce((s, p) => s + p.actual_noi!, 0);
        const totalProjNoi   = slice.reduce((s, p) => s + (p.projected_noi ?? 0), 0);
        const actualOccSlice = slice.filter(p => p.actual_occupancy != null);
        const avgActualOcc   = actualOccSlice.length ? actualOccSlice.reduce((s, p) => s + p.actual_occupancy!, 0) / actualOccSlice.length : 0;
        const projOccSlice   = slice.filter(p => p.projected_occupancy != null);
        const avgProjOcc     = projOccSlice.length ? projOccSlice.reduce((s, p) => s + p.projected_occupancy!, 0) / projOccSlice.length : 0;
        const noiVar = totalProjNoi > 0 ? ((totalActualNoi - totalProjNoi) / totalProjNoi) * 100 : 0;
        const occVar = avgProjOcc > 0 ? ((avgActualOcc - avgProjOcc) / avgProjOcc) * 100 : 0;
        const fmtBig = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v.toFixed(0)}`;
        const varColor = (v: number) => v >= 0 ? T.text.green : T.text.red;
        const varSign  = (v: number) => v >= 0 ? '+' : '';
        return (
          <div style={{
            gridColumn: '1 / -1',
            background: T.bg.panel,
            border: `1px solid ${T.border.subtle}`,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 32,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: T.text.muted, fontFamily: MONO, letterSpacing: 1, flexShrink: 0 }}>
              {selectedTimeframe.toUpperCase()} VARIANCE
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 9, color: T.text.muted, fontFamily: MONO }}>NOI</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, fontFamily: MONO }}>{fmtBig(totalActualNoi)}</span>
              <span style={{ fontSize: 9, color: T.text.muted, fontFamily: MONO }}>actual vs</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text.amber, fontFamily: MONO }}>{fmtBig(totalProjNoi)}</span>
              <span style={{ fontSize: 9, color: T.text.muted, fontFamily: MONO }}>projected</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: varColor(noiVar), fontFamily: MONO }}>
                ({varSign(noiVar)}{noiVar.toFixed(1)}%)
              </span>
            </div>
            <div style={{ width: 1, height: 24, background: T.border.subtle }} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 9, color: T.text.muted, fontFamily: MONO }}>OCC</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, fontFamily: MONO }}>{avgActualOcc.toFixed(1)}%</span>
              <span style={{ fontSize: 9, color: T.text.muted, fontFamily: MONO }}>actual vs</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.text.amber, fontFamily: MONO }}>{avgProjOcc.toFixed(1)}%</span>
              <span style={{ fontSize: 9, color: T.text.muted, fontFamily: MONO }}>projected</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: varColor(occVar), fontFamily: MONO }}>
                ({varSign(occVar)}{occVar.toFixed(1)}%)
              </span>
            </div>
            {selectedPeriod && (
              <>
                <div style={{ width: 1, height: 24, background: T.border.subtle }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, color: T.text.amber, fontFamily: MONO, letterSpacing: 0.5 }}>
                    SELECTED: {selectedPeriod}
                  </span>
                  <button
                    onClick={() => setSelectedPeriod(null)}
                    style={{ background: 'none', border: 'none', color: T.text.muted, cursor: 'pointer', fontSize: 10, padding: 0, fontFamily: MONO }}
                  >
                    ×
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* NOI Performance */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.text.cyan, letterSpacing: 1, fontFamily: MONO }}>
            NOI PERFORMANCE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 8, background: T.text.green, borderRadius: 1 }} />
              <span style={{ fontSize: 8, color: T.text.muted, fontFamily: MONO }}>ACTUAL</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={T.text.amber} strokeWidth="1.5" strokeDasharray="3,2" /></svg>
              <span style={{ fontSize: 8, color: T.text.muted, fontFamily: MONO }}>PROJECTED</span>
            </div>
          </div>
        </div>
        {(() => {
          const slice = performance.slice(-12);
          const maxNoi = Math.max(
            ...slice.map(x => x.actual_noi != null ? x.actual_noi : 0),
            ...slice.map(x => x.projected_noi ?? 0),
            1,
          );
          const BAR_H = 160;
          const fmt = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v.toFixed(0)}`;
          const n = slice.length || 1;
          const projPoints = slice.map((p, i) => {
            const proj = p.projected_noi ?? 0;
            const x = ((i + 0.5) / n) * 100;
            const y = (1 - Math.min(proj / maxNoi, 1)) * BAR_H;
            return `${x},${y}`;
          }).join(' ');
          return (
            <div style={{ display: 'flex', gap: 6 }}>
              {/* Y-axis */}
              <div style={{ width: 36, position: 'relative', height: BAR_H + 20, flexShrink: 0 }}>
                {[1, 0.5, 0].map((frac) => (
                  <div key={frac} style={{
                    position: 'absolute', right: 0,
                    top: `${(1 - frac) * BAR_H}px`, transform: 'translateY(-50%)',
                    fontSize: 7, color: T.text.muted, fontFamily: MONO, textAlign: 'right', lineHeight: 1,
                  }}>
                    {fmt(maxNoi * frac)}
                  </div>
                ))}
                {[1, 0.5, 0].map((frac) => (
                  <div key={`t${frac}`} style={{
                    position: 'absolute', left: 32, top: `${(1 - frac) * BAR_H}px`,
                    width: 4, height: 1, background: T.border.subtle,
                  }} />
                ))}
              </div>
              {/* Bars + SVG overlay */}
              <div style={{ flex: 1, position: 'relative', height: BAR_H + 20 }}>
                {/* Bars — only render when actuals exist */}
                <div style={{ height: BAR_H, display: 'flex', alignItems: 'flex-end', gap: 4, overflow: 'hidden' }}>
                  {slice.map((p, i) => {
                    const hasActual = p.actual_noi != null;
                    const actual = p.actual_noi ?? 0;
                    const isSelected = selectedPeriod === p.period;
                    return (
                      <div
                        key={i}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => setSelectedPeriod(isSelected ? null : p.period)}
                        title={hasActual ? `${p.period}: ${fmt(actual)} actual` : `${p.period}: no actuals uploaded`}
                      >
                        {hasActual ? (
                          <div style={{
                            width: '100%',
                            background: isSelected ? T.text.cyan : T.text.green,
                            height: `${Math.max((actual / maxNoi) * BAR_H, 4)}px`,
                            borderRadius: '2px 2px 0 0',
                            opacity: selectedPeriod && !isSelected ? 0.45 : 1,
                            transition: 'all 0.15s',
                          }} />
                        ) : (
                          <div style={{
                            width: '100%',
                            height: 4,
                            border: `1px dashed ${T.border.subtle}`,
                            borderRadius: '2px 2px 0 0',
                            opacity: 0.5,
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Projected line SVG overlay — always rendered; circles are clickable */}
                <svg
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${BAR_H}px`, overflow: 'visible' }}
                  viewBox={`0 0 100 ${BAR_H}`}
                  preserveAspectRatio="none"
                >
                  <polyline
                    points={projPoints}
                    fill="none"
                    stroke={T.text.amber}
                    strokeWidth="1.5"
                    strokeDasharray="4,3"
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: 'none' }}
                  />
                  {slice.map((p, i) => {
                    const proj = p.projected_noi ?? 0;
                    const x = ((i + 0.5) / n) * 100;
                    const y = (1 - Math.min(proj / maxNoi, 1)) * BAR_H;
                    const isSelected = selectedPeriod === p.period;
                    return (
                      <circle
                        key={i}
                        cx={x} cy={y} r="4"
                        fill={isSelected ? T.text.cyan : T.text.amber}
                        vectorEffect="non-scaling-stroke"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedPeriod(isSelected ? null : p.period)}
                      >
                        <title>{p.period}: {(p.projected_noi ?? 0) >= 1e6 ? `$${((p.projected_noi ?? 0)/1e6).toFixed(1)}M` : `$${(p.projected_noi ?? 0).toFixed(0)}`} projected</title>
                      </circle>
                    );
                  })}
                </svg>
                {/* Period labels */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {slice.map((p, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 7, color: T.text.muted, marginTop: 3, fontFamily: MONO }}>{p.period}</div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
      
      {/* Occupancy Trend */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.text.cyan, letterSpacing: 1, fontFamily: MONO }}>
            OCCUPANCY TREND
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 8, background: T.text.green, borderRadius: 1 }} />
              <span style={{ fontSize: 8, color: T.text.muted, fontFamily: MONO }}>ACTUAL</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={T.text.amber} strokeWidth="1.5" strokeDasharray="3,2" /></svg>
              <span style={{ fontSize: 8, color: T.text.muted, fontFamily: MONO }}>PROJECTED</span>
            </div>
          </div>
        </div>
        {(() => {
          const slice = performance.slice(-12);
          const allOcc = [
            ...slice.filter(p => p.actual_occupancy != null).map(p => p.actual_occupancy as number),
            ...slice.filter(p => p.projected_occupancy != null).map(p => p.projected_occupancy as number),
          ].filter(v => v > 0);
          const minOcc = allOcc.length ? Math.max(Math.min(...allOcc) - 2, 0) : 85;
          const maxOcc = 100;
          const range = maxOcc - minOcc || 1;
          const BAR_H = 160;
          const toBarH = (occ: number) => Math.max(((Math.max(occ, minOcc) - minOcc) / range) * BAR_H, 4);
          const toY    = (occ: number) => (1 - (Math.max(occ, minOcc) - minOcc) / range) * BAR_H;
          const ticks = [100, 95, 90, 85].filter(t => t >= minOcc);
          const n = slice.length || 1;
          const projPoints = slice
            .filter(p => p.projected_occupancy != null)
            .map((p, _, arr) => {
              const idx = slice.indexOf(p);
              const proj = p.projected_occupancy!;
              const x = ((idx + 0.5) / n) * 100;
              const y = toY(proj);
              return `${x},${y}`;
            }).join(' ');
          return (
            <div style={{ display: 'flex', gap: 6 }}>
              {/* Y-axis */}
              <div style={{ width: 36, position: 'relative', height: BAR_H + 20, flexShrink: 0 }}>
                {ticks.map((t) => (
                  <div key={t} style={{
                    position: 'absolute', right: 0,
                    top: `${((maxOcc - t) / range) * BAR_H}px`, transform: 'translateY(-50%)',
                    fontSize: 7, color: T.text.muted, fontFamily: MONO, textAlign: 'right', lineHeight: 1,
                  }}>
                    {t}%
                  </div>
                ))}
                {ticks.map((t) => (
                  <div key={`t${t}`} style={{
                    position: 'absolute', left: 32, top: `${((maxOcc - t) / range) * BAR_H}px`,
                    width: 4, height: 1, background: T.border.subtle,
                  }} />
                ))}
              </div>
              {/* Bars + SVG overlay */}
              <div style={{ flex: 1, position: 'relative', height: BAR_H + 20 }}>
                <div style={{ height: BAR_H, display: 'flex', alignItems: 'flex-end', gap: 4, overflow: 'hidden' }}>
                  {slice.map((p, i) => {
                    const hasActual = p.actual_occupancy != null;
                    const occ = p.actual_occupancy ?? 0;
                    const isSelected = selectedPeriod === p.period;
                    const barColor = occ > 93 ? T.text.green : occ > 90 ? T.text.amber : T.text.red;
                    return (
                      <div
                        key={i}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => setSelectedPeriod(isSelected ? null : p.period)}
                        title={hasActual ? `${p.period}: ${occ.toFixed(1)}% actual` : `${p.period}: no actuals uploaded`}
                      >
                        {hasActual ? (
                          <div style={{
                            width: '100%',
                            background: isSelected ? T.text.cyan : barColor,
                            height: `${toBarH(occ)}px`,
                            borderRadius: '2px 2px 0 0',
                            opacity: selectedPeriod && !isSelected ? 0.45 : 1,
                            transition: 'all 0.15s',
                          }} />
                        ) : (
                          <div style={{
                            width: '100%',
                            height: 4,
                            border: `1px dashed ${T.border.subtle}`,
                            borderRadius: '2px 2px 0 0',
                            opacity: 0.5,
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Projected line SVG overlay — circles are clickable */}
                <svg
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${BAR_H}px`, overflow: 'visible' }}
                  viewBox={`0 0 100 ${BAR_H}`}
                  preserveAspectRatio="none"
                >
                  <polyline
                    points={projPoints}
                    fill="none"
                    stroke={T.text.amber}
                    strokeWidth="1.5"
                    strokeDasharray="4,3"
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: 'none' }}
                  />
                  {slice.map((p, i) => {
                    const proj = p.projected_occupancy ?? 0;
                    if (!proj) return null;
                    const x = ((i + 0.5) / n) * 100;
                    const y = toY(proj);
                    const isSelected = selectedPeriod === p.period;
                    return (
                      <circle
                        key={i}
                        cx={x} cy={y} r="4"
                        fill={isSelected ? T.text.cyan : T.text.amber}
                        vectorEffect="non-scaling-stroke"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedPeriod(isSelected ? null : p.period)}
                      >
                        <title>{p.period}: {proj.toFixed(1)}% projected</title>
                      </circle>
                    );
                  })}
                </svg>
                {/* Period labels */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {slice.map((p, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 7, color: T.text.muted, marginTop: 3, fontFamily: MONO }}>{p.period}</div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
      
      {/* Period Contributor Table — full width, visible when a period is selected */}
      {selectedPeriod && (
        <div style={{
          gridColumn: '1 / -1',
          background: T.bg.panel,
          border: `1px solid ${T.border.medium}`,
          padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.text.cyan, letterSpacing: 1, fontFamily: MONO }}>
              CONTRIBUTING ASSETS — {selectedPeriod}
            </div>
            {contributorsLoading && (
              <div style={{ fontSize: 9, color: T.text.muted, fontFamily: MONO }}>LOADING...</div>
            )}
          </div>
          {!contributorsLoading && periodContributors.length === 0 && (
            <div style={{ fontSize: 10, color: T.text.muted, fontFamily: MONO, padding: '12px 0' }}>
              No actuals uploaded for this period. Upload actuals via the button above.
            </div>
          )}
          {periodContributors.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: MONO }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                  {['ASSET', 'LOCATION', 'ACTUAL NOI', 'OCCUPANCY', 'AVG RENT/UNIT', 'VS PROJECTION'].map(h => (
                    <th key={h} style={{ textAlign: h === 'ASSET' || h === 'LOCATION' ? 'left' : 'right', padding: '4px 10px', fontSize: 8, color: T.text.muted, fontWeight: 600, letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periodContributors.map((c, i) => {
                  const varPct = c.variance_from_projection_pct;
                  const varColor = varPct == null ? T.text.muted : varPct >= 0 ? T.text.green : T.text.red;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/assets-owned/${c.id}/property`)}
                      style={{
                        borderBottom: `1px solid ${T.border.subtle}`,
                        cursor: 'pointer',
                        background: i % 2 === 0 ? 'transparent' : T.bg.panelAlt,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = T.bg.hover)}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : T.bg.panelAlt)}
                    >
                      <td style={{ padding: '8px 10px', color: T.text.primary, fontWeight: 500 }}>{c.name}</td>
                      <td style={{ padding: '8px 10px', color: T.text.secondary }}>{c.city}, {c.state}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: T.text.green }}>
                        {c.actual_noi != null ? (c.actual_noi >= 1e6 ? `$${(c.actual_noi/1e6).toFixed(2)}M` : `$${c.actual_noi.toLocaleString()}`) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: (c.actual_occupancy_pct ?? 0) > 93 ? T.text.green : T.text.amber }}>
                        {c.actual_occupancy_pct != null ? `${c.actual_occupancy_pct.toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: T.text.secondary }}>
                        {c.actual_rent_per_unit != null ? `$${c.actual_rent_per_unit.toFixed(0)}` : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: varColor, fontWeight: 600 }}>
                        {varPct != null ? `${varPct >= 0 ? '+' : ''}${varPct.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Expense Analysis */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text.cyan, letterSpacing: 1, marginBottom: 16, fontFamily: MONO }}>
          EXPENSE BREAKDOWN
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Payroll', pct: 28, budget: 1.2, actual: 1.15 },
            { label: 'Utilities', pct: 18, budget: 0.75, actual: 0.82 },
            { label: 'R&M', pct: 15, budget: 0.62, actual: 0.58 },
            { label: 'Insurance', pct: 12, budget: 0.50, actual: 0.55 },
            { label: 'Taxes', pct: 22, budget: 0.92, actual: 0.90 },
            { label: 'Other', pct: 5, budget: 0.21, actual: 0.19 },
          ].map((exp, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 80, fontSize: 10, color: T.text.secondary, fontFamily: MONO }}>{exp.label}</div>
              <div style={{ flex: 1, height: 8, background: T.bg.panelAlt, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${exp.pct}%`, background: exp.actual > exp.budget ? T.text.red : T.text.green, borderRadius: 4 }} />
              </div>
              <div style={{ width: 50, textAlign: 'right', fontSize: 10, color: exp.actual > exp.budget ? T.text.red : T.text.green, fontFamily: MONO }}>
                {fmtCurrency(exp.actual * 1e6)}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Collections */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text.cyan, letterSpacing: 1, marginBottom: 16, fontFamily: MONO }}>
          COLLECTIONS RATE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 150 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, fontWeight: 700, color: T.text.green, fontFamily: MONO }}>97.2%</div>
            <div style={{ fontSize: 11, color: T.text.secondary, fontFamily: MONO, marginTop: 8 }}>TTM Collection Rate</div>
            <div style={{ fontSize: 10, color: T.text.muted, fontFamily: MONO, marginTop: 4 }}>+0.8% vs Prior Year</div>
          </div>
        </div>
      </div>
    </div>
  );
  
  const renderComps = () => {
    const totalComps = Object.values(comps).reduce((s, c) => s + c.length, 0);
    return (
      <div>
        {/* Summary strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'OWNED ASSETS', value: String(assets.length), color: T.text.primary },
            { label: 'TOTAL COMPS TRACKED', value: String(totalComps), color: T.text.cyan },
            { label: 'DISCOVERY FACTORS', value: 'Trade area · Proximity · Vintage · Size · Class', color: T.text.secondary, small: true },
          ].map((s, i) => (
            <div key={i} style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 12 }}>
              <div style={{ fontSize: 9, color: T.text.muted, letterSpacing: 1, fontFamily: MONO, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: s.small ? 10 : 20, fontWeight: s.small ? 400 : 800, color: s.color, fontFamily: MONO }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Per-asset table */}
        {assets.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: T.text.muted, fontFamily: MONO, fontSize: 10 }}>No assets to show comp sets for</div>
        ) : (
          <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.bg.active, borderBottom: `1px solid ${T.border.subtle}` }}>
                  {['OWNED ASSET', 'AVG RENT', 'OCCUPANCY', 'COMPS', 'ACTIONS'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, color: T.text.muted, fontFamily: MONO, fontWeight: 700, letterSpacing: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.map((asset, i) => {
                  const assetComps = comps[asset.id] || [];
                  const expanded = compsExpanded.has(asset.id);
                  const isLoadingComp = compsLoading.has(asset.id);
                  const isDiscovering = discovering === asset.id;
                  return (
                    <React.Fragment key={asset.id || i}>
                      <tr
                        onClick={() => toggleCompsRow(asset.id)}
                        style={{ borderBottom: `1px solid ${T.border.subtle}`, background: expanded ? T.bg.active : i % 2 === 0 ? T.bg.panel : T.bg.panelAlt, cursor: 'pointer' }}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: T.text.muted, fontSize: 10, fontFamily: MONO }}>{expanded ? '▼' : '▶'}</span>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: T.text.primary, fontFamily: MONO }}>{asset.name || '—'}</div>
                              <div style={{ fontSize: 9, color: T.text.muted, marginTop: 1 }}>{asset.assetClass || ''} · {asset.units || '—'} units</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 10, fontFamily: MONO, color: T.text.primary }}>
                          {asset.noi != null ? fmtCurrency(asset.noi) : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 10, fontFamily: MONO, color: T.text.green }}>
                          {asset.occupancy != null ? `${Number(asset.occupancy).toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, fontFamily: MONO, color: T.text.cyan }}>
                          {assetComps.length || '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => loadCompSet(asset.id)}
                              style={{ fontFamily: MONO, fontSize: 9, color: '#A78BFA', background: 'transparent', border: '1px solid #A78BFA44', padding: '3px 10px', cursor: 'pointer' }}
                            >
                              {isLoadingComp ? '…' : 'REFRESH'}
                            </button>
                            <button
                              onClick={() => discoverCompsForAsset(asset.id)}
                              disabled={!!isDiscovering}
                              style={{ fontFamily: MONO, fontSize: 9, color: T.text.green, background: 'transparent', border: `1px solid ${T.text.green}44`, padding: '3px 10px', cursor: 'pointer', opacity: isDiscovering ? 0.5 : 1 }}
                            >
                              {isDiscovering ? 'DISCOVERING…' : 'DISCOVER'}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded comps rows */}
                      {expanded && isLoadingComp && (
                        <tr style={{ background: T.bg.hover }}>
                          <td colSpan={5} style={{ padding: '8px 32px', fontSize: 10, color: T.text.muted, fontFamily: MONO }}>Loading comps…</td>
                        </tr>
                      )}
                      {expanded && !isLoadingComp && assetComps.length === 0 && (
                        <tr style={{ background: T.bg.hover }}>
                          <td colSpan={5} style={{ padding: '8px 32px', fontSize: 10, color: T.text.muted, fontFamily: MONO }}>No comps found — click DISCOVER to find competitors</td>
                        </tr>
                      )}
                      {expanded && assetComps.map((comp, j) => (
                        <tr key={comp.id || j} style={{ background: T.bg.hover, borderBottom: `1px solid ${T.border.subtle}` }}>
                          <td style={{ padding: '6px 12px 6px 36px', fontSize: 10, color: T.text.secondary }}>{comp.comp_name || comp.comp_property_address || '—'}</td>
                          <td style={{ padding: '6px 12px', fontSize: 10, fontFamily: MONO, color: T.text.muted }}>{comp.avg_rent != null ? `$${comp.avg_rent}` : '—'}</td>
                          <td style={{ padding: '6px 12px', fontSize: 10, fontFamily: MONO, color: T.text.muted }}>{comp.occupancy != null ? `${comp.occupancy}%` : '—'}</td>
                          <td style={{ padding: '6px 12px', fontSize: 10, color: T.text.muted }}>
                            {comp.distance_miles != null ? `${Number(comp.distance_miles).toFixed(1)}mi` : '—'} · {comp.units || '—'} units · {comp.year_built || '—'}
                          </td>
                          <td style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, fontFamily: MONO, color: (comp.match_score ?? 0) >= 80 ? T.text.green : (comp.match_score ?? 0) >= 60 ? T.text.amber : T.text.muted }}>
                            {comp.match_score != null ? `${comp.match_score}% match` : '—'}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderReports = () => (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {reports.map(report => (
          <div 
            key={report.id}
            style={{ 
              background: T.bg.panel, 
              border: `1px solid ${T.border.subtle}`, 
              padding: 16,
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
            onClick={() => console.log('Generate report:', report.id)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ color: T.text.cyan }}>{report.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text.primary, fontFamily: MONO }}>{report.name}</div>
            </div>
            <div style={{ fontSize: 10, color: T.text.secondary, lineHeight: 1.4, marginBottom: 12 }}>{report.description}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: T.text.muted, fontFamily: MONO, textTransform: 'uppercase' }}>{report.category}</span>
              <button style={{ 
                padding: '4px 10px', 
                background: T.bg.panelAlt, 
                border: `1px solid ${T.border.subtle}`, 
                color: T.text.cyan, 
                fontSize: 9, 
                fontFamily: MONO, 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <Download size={10} /> GENERATE
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  
  const renderLearning = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Overall Accuracy */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text.cyan, letterSpacing: 1, marginBottom: 16, fontFamily: MONO }}>
          AGENT ACCURACY
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {[
            { label: 'HIT RATE (±10%)', value: '72%', color: T.text.green },
            { label: 'HIT RATE (±20%)', value: '89%', color: T.text.green },
            { label: 'MEAN BIAS', value: '+2.3%', color: T.text.amber },
            { label: 'PREDICTIONS', value: '847', color: T.text.primary },
          ].map((m, i) => (
            <div key={i} style={{ padding: 12, background: T.bg.panelAlt, border: `1px solid ${T.border.subtle}`, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: m.color, fontFamily: MONO }}>{m.value}</div>
              <div style={{ fontSize: 9, color: T.text.muted, fontFamily: MONO, marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Accuracy by Assumption */}
      <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text.cyan, letterSpacing: 1, marginBottom: 16, fontFamily: MONO }}>
          BY ASSUMPTION TYPE
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 10 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
              <th style={{ textAlign: 'left', padding: '6px 0', color: T.text.muted }}>ASSUMPTION</th>
              <th style={{ textAlign: 'right', padding: '6px 0', color: T.text.muted }}>±10%</th>
              <th style={{ textAlign: 'right', padding: '6px 0', color: T.text.muted }}>BIAS</th>
              <th style={{ textAlign: 'right', padding: '6px 0', color: T.text.muted }}>N</th>
            </tr>
          </thead>
          <tbody>
            {agentAccuracy.map((a, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                <td style={{ padding: '8px 0', color: T.text.primary }}>{a.assumptionName.replace(/_/g, ' ')}</td>
                <td style={{ textAlign: 'right', color: a.hitRate10Pct > 70 ? T.text.green : T.text.amber }}>{a.hitRate10Pct.toFixed(0)}%</td>
                <td style={{ textAlign: 'right', color: Math.abs(a.meanBias) < 5 ? T.text.green : T.text.amber }}>
                  {a.meanBias > 0 ? '+' : ''}{a.meanBias.toFixed(1)}%
                </td>
                <td style={{ textAlign: 'right', color: T.text.muted }}>{a.nPredictions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Learning Loop Status */}
      <div style={{ gridColumn: '1 / -1', background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text.cyan, letterSpacing: 1, marginBottom: 16, fontFamily: MONO }}>
          LEARNING LOOP STATUS
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: T.text.muted, fontFamily: MONO, marginBottom: 8 }}>FEEDBACK CYCLE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {[
                { step: 'Underwrite', icon: <FileText size={14} />, done: true },
                { step: 'Track Actuals', icon: <Activity size={14} />, done: true },
                { step: 'Compute Outcomes', icon: <BarChart3 size={14} />, done: true },
                { step: 'Update Adjustments', icon: <Brain size={14} />, done: false },
              ].map((s, i) => (
                <React.Fragment key={i}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                      width: 32, height: 32, borderRadius: '50%', 
                      background: s.done ? T.text.green : T.bg.panelAlt,
                      border: `2px solid ${s.done ? T.text.green : T.border.subtle}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: s.done ? T.bg.terminal : T.text.muted,
                      marginBottom: 4,
                    }}>
                      {s.icon}
                    </div>
                    <div style={{ fontSize: 9, color: s.done ? T.text.primary : T.text.muted, fontFamily: MONO }}>{s.step}</div>
                  </div>
                  {i < 3 && <ChevronRight size={16} style={{ color: T.border.medium }} />}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div style={{ borderLeft: `1px solid ${T.border.subtle}`, paddingLeft: 24 }}>
            <div style={{ fontSize: 10, color: T.text.muted, fontFamily: MONO, marginBottom: 8 }}>NEXT REFRESH</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text.primary, fontFamily: MONO }}>2h 34m</div>
            <button
              onClick={() => apiClient.post('/api/v1/learning/run-cycle').then(loadPortfolioData)}
              style={{ marginTop: 8, padding: '4px 12px', background: T.text.amber, color: T.bg.terminal, border: 'none', fontSize: 10, fontWeight: 600, fontFamily: MONO, cursor: 'pointer' }}
            >
              RUN NOW
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  
  // ─── Main Render ────────────────────────────────────────────
  
  const TABS = [
    { id: 'overview', label: 'OVERVIEW', icon: <PieChart size={12} /> },
    { id: 'assets', label: 'ASSETS', icon: <Building2 size={12} /> },
    { id: 'performance', label: 'PERFORMANCE', icon: <Activity size={12} /> },
    { id: 'comps', label: 'COMP SETS', icon: <Target size={12} /> },
    { id: 'reports', label: 'REPORTS', icon: <FileText size={12} /> },
    { id: 'learning', label: 'AI LEARNING', icon: <Brain size={12} /> },
  ] as const;
  
  return (
    <div style={{ padding: 16, background: T.bg.terminal, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: T.text.amber, letterSpacing: 1, margin: 0, fontFamily: MONO }}>
            PORTFOLIO & REPORTS
          </h1>
          <p style={{ fontSize: 11, color: T.text.secondary, margin: '4px 0 0', fontFamily: MONO }}>
            Asset management, performance analytics, and AI insights
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ padding: '6px 12px', background: T.bg.panel, border: `1px solid ${T.border.subtle}`, color: T.text.secondary, fontSize: 10, fontFamily: MONO, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={12} /> EXPORT
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `1px solid ${T.border.subtle}` }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${T.text.amber}` : '2px solid transparent',
              color: activeTab === tab.id ? T.text.amber : T.text.muted,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: MONO,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              letterSpacing: 0.5,
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: T.text.muted }}>
          <Clock size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
          <div style={{ fontSize: 11, fontFamily: MONO }}>Loading portfolio data...</div>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'assets' && renderAssets()}
          {activeTab === 'performance' && renderPerformance()}
          {activeTab === 'comps' && renderComps()}
          {activeTab === 'reports' && renderReports()}
          {activeTab === 'learning' && renderLearning()}
        </>
      )}

      {/* ── Upload Actuals Modal ── */}
      {showActualsModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget && !submittingActuals) setShowActualsModal(false); }}
        >
          <div style={{
            background: '#0F1319',
            border: '1px solid #1e2a3d',
            borderTop: `2px solid ${T.text.cyan}`,
            width: 520, maxWidth: '96vw',
            fontFamily: MONO,
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', borderBottom: '1px solid #1e2a3d',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={12} color={T.text.cyan} />
                <span style={{ fontSize: 11, fontWeight: 800, color: T.text.cyan, letterSpacing: 1.2 }}>
                  UPLOAD ACTUALS — MONTHLY DATA INGESTION
                </span>
              </div>
              {!submittingActuals && (
                <button onClick={() => setShowActualsModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7A8D', padding: 4 }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {actualsSuccess ? (
              <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <CheckCircle size={36} color={T.text.green} />
                <p style={{ color: T.text.green, fontSize: 13, fontWeight: 700, letterSpacing: 0.5, margin: 0 }}>
                  ACTUALS RECORDED
                </p>
                <p style={{ color: '#6B7A8D', fontSize: 10, margin: 0 }}>
                  Variance analysis triggered · Performance charts updating
                </p>
              </div>
            ) : (
              <div style={{ padding: 20 }}>
                {/* Asset + Period selectors */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 8, fontWeight: 700, color: '#9EA8B4', letterSpacing: 0.8, marginBottom: 4 }}>
                      ASSET <span style={{ color: T.text.cyan }}>*</span>
                    </label>
                    <select
                      value={actualsAssetId}
                      onChange={e => setActualsAssetId(e.target.value)}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: '#060A12', border: '1px solid #1e2a3d',
                        color: '#E2E8F0', fontFamily: MONO, fontSize: 11,
                        padding: '6px 10px', outline: 'none', colorScheme: 'dark',
                      }}
                    >
                      <option value="">Select asset…</option>
                      {assets.map(a => (
                        <option key={a.id} value={a.id}>{a.name || a.address}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 8, fontWeight: 700, color: '#9EA8B4', letterSpacing: 0.8, marginBottom: 4 }}>
                      PERIOD (YYYY-MM) <span style={{ color: T.text.cyan }}>*</span>
                    </label>
                    <input
                      type="month"
                      value={actualsPeriod}
                      onChange={e => setActualsPeriod(e.target.value)}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: '#060A12', border: '1px solid #1e2a3d',
                        color: '#E2E8F0', fontFamily: MONO, fontSize: 11,
                        padding: '6px 10px', outline: 'none', colorScheme: 'dark',
                      }}
                    />
                  </div>
                </div>

                {/* Mode tabs */}
                <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #1e2a3d' }}>
                  {(['manual', 'file'] as const).map(m => (
                    <button key={m} onClick={() => setActualsMode(m)} style={{
                      padding: '7px 20px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: actualsMode === m ? `2px solid ${T.text.cyan}` : '2px solid transparent',
                      color: actualsMode === m ? T.text.cyan : '#6B7A8D',
                      fontFamily: MONO, fontSize: 10, fontWeight: 700,
                      letterSpacing: 0.6, cursor: 'pointer',
                    }}>
                      {m === 'manual' ? 'MANUAL ENTRY' : 'FILE UPLOAD (CSV / Excel)'}
                    </button>
                  ))}
                </div>

                {/* Manual entry fields */}
                {actualsMode === 'manual' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    {([
                      { key: 'net_operating_income',     label: 'NOI ($)',              placeholder: 'e.g. 280000' },
                      { key: 'physical_occupancy_pct',   label: 'OCCUPANCY (%)',        placeholder: 'e.g. 94.5' },
                      { key: 'effective_gross_income',   label: 'EFF. GROSS INCOME ($)',placeholder: 'e.g. 410000' },
                      { key: 'total_operating_expenses', label: 'TOTAL EXPENSES ($)',   placeholder: 'e.g. 130000' },
                      { key: 'units_occupied',           label: 'UNITS OCCUPIED',       placeholder: 'e.g. 188' },
                      { key: 'avg_rent_achieved',        label: 'AVG RENT ($)',         placeholder: 'e.g. 1850' },
                      { key: 'collections_rate',         label: 'COLLECTIONS RATE (%)', placeholder: 'e.g. 97.2' },
                    ] as const).map(f => (
                      <div key={f.key}>
                        <label style={{ display: 'block', fontSize: 8, fontWeight: 700, color: '#6B7A8D', letterSpacing: 0.8, marginBottom: 4 }}>
                          {f.label}
                        </label>
                        <input
                          type="text"
                          value={actualsForm[f.key as keyof typeof actualsForm]}
                          onChange={e => setActualsForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            background: '#060A12', border: '1px solid #1e2a3d',
                            color: '#E2E8F0', fontFamily: MONO, fontSize: 11,
                            padding: '6px 10px', outline: 'none',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* File upload */}
                {actualsMode === 'file' && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 8, fontWeight: 700, color: '#6B7A8D', letterSpacing: 0.8, marginBottom: 8 }}>
                      CSV / XLSX / XLS FILE
                    </label>
                    <label style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 8, padding: '28px 16px',
                      border: `1px dashed ${actualsFile ? T.text.cyan : '#1e2a3d'}`,
                      background: actualsFile ? `${T.text.cyan}08` : '#060A12',
                      cursor: 'pointer',
                    }}>
                      <Upload size={20} color={actualsFile ? T.text.cyan : '#6B7A8D'} />
                      <span style={{ fontSize: 10, color: actualsFile ? T.text.cyan : '#6B7A8D', fontFamily: MONO }}>
                        {actualsFile ? actualsFile.name : 'Click or drag to upload operating statement'}
                      </span>
                      <span style={{ fontSize: 8, color: '#6B7A8D', fontFamily: MONO }}>
                        Yardi · Entrata · AppFolio · MRI · Custom CSV
                      </span>
                      <input type="file" accept=".csv,.xlsx,.xls,.tsv" style={{ display: 'none' }}
                        onChange={e => setActualsFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                )}

                {/* Error */}
                {actualsError && (
                  <div style={{ padding: '8px 12px', background: '#1a0a0a', border: '1px solid #EF444433', marginBottom: 12 }}>
                    <span style={{ fontSize: 10, color: '#EF4444', fontFamily: MONO }}>{actualsError}</span>
                  </div>
                )}

                {/* Info note */}
                <div style={{ fontSize: 9, color: '#6B7A8D', fontFamily: MONO, marginBottom: 16, lineHeight: 1.5 }}>
                  Data stored in same file system as deal documents · Variance vs. projection auto-computed on save · Charts refresh immediately
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowActualsModal(false)} disabled={submittingActuals}
                    style={{
                      padding: '7px 18px', background: 'transparent',
                      border: '1px solid #1e2a3d', color: '#6B7A8D',
                      fontFamily: MONO, fontSize: 10, fontWeight: 700,
                      letterSpacing: 0.6, cursor: 'pointer',
                    }}>
                    CANCEL
                  </button>
                  <button
                    onClick={handleActualsSubmit}
                    disabled={submittingActuals || !actualsAssetId || !actualsPeriod || (actualsMode === 'file' && !actualsFile)}
                    style={{
                      padding: '7px 22px',
                      background: submittingActuals ? `${T.text.cyan}22` : T.text.cyan,
                      border: 'none',
                      color: submittingActuals ? T.text.cyan : '#0A0E17',
                      fontFamily: MONO, fontSize: 10, fontWeight: 800,
                      letterSpacing: 0.6,
                      cursor: (submittingActuals || !actualsAssetId || !actualsPeriod) ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      opacity: (!actualsAssetId || !actualsPeriod) ? 0.5 : 1,
                    }}
                  >
                    {submittingActuals
                      ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> SAVING…</>
                      : <><Upload size={11} /> SAVE ACTUALS</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
