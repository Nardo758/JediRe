import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp, Upload, ArrowUpRight, ArrowDownRight,
  ChevronDown, ChevronRight, Edit3, Save, X, Building2,
  Users, Target, Activity, BarChart3, Globe, Footprints,
  Minus, Database, AlertCircle, CheckCircle2, Eye, Car,
  Layers, SlidersHorizontal, Gauge,
} from 'lucide-react';
import { apiClient } from '@/services/api.client';
import TrafficDataSourcesTab from './traffic/TrafficDataSourcesTab';
import TrafficCompsTab from './traffic/TrafficCompsTab';
import VisibilityAssessmentTab from './traffic/VisibilityAssessmentTab';

interface TrafficModuleProps {
  deal?: any;
  dealId?: string;
  propertyId?: string;
  embedded?: boolean;
  onUpdate?: () => void;
  onBack?: () => void;
}

interface ProjectionPeriod {
  label: string;
  index: number;
  isActual: boolean;
  baseTraffic: number;
  baseTours: number;
  baseWebsite: number;
  baseWalkIn: number;
  baseApps: number;
  baseCancellations: number;
  baseDenials: number;
  baseNetLeases: number;
  baseClosingRatio: number;
  baseOccPct: number;
  baseLeasedPct: number;
  demandFactor: number;
  supplyFactor: number;
  digitalFactor: number;
  seasonalFactor: number;
  combinedFactor: number;
  adjTraffic: number;
  adjTours: number;
  adjWebsite: number;
  adjWalkIn: number;
  adjApps: number;
  adjNetLeases: number;
  adjClosingRatio: number;
  adjOccPct: number;
  adjLeasedPct: number;
  totalUnits: number;
  vacantTotal: number | null;
  noticeTotal: number | null;
}

interface MarketIntelligence {
  demandSummary: string;
  demandFactor: number;
  demandDirection: 'up' | 'down' | 'neutral';
  supplySummary: string;
  supplyFactor: number;
  supplyDirection: 'up' | 'down' | 'neutral';
  digitalSummary: string;
  digitalFactor: number;
  digitalDirection: 'up' | 'down' | 'neutral';
  seasonalSummary: string;
  seasonalFactor: number;
  seasonalDirection: 'up' | 'down' | 'neutral';
  overallAdjustment: number;
  overallSummary: string;
}

interface ProjectionData {
  periods: ProjectionPeriod[];
  marketIntelligence: MarketIntelligence;
  actualsCount: number;
  projectedCount: number;
  view: 'weekly' | 'monthly' | 'yearly';
  dataSource: 'predicted' | 'uploaded' | 'blended';
  calibrationSource?: string;
}

interface HistorySnapshot {
  week_ending: string;
  traffic: number | null;
  in_person_tours: number | null;
  website_leads: number | null;
  apps: number | null;
  cancellations: number | null;
  net_leases: number | null;
  closing_ratio: number | null;
  occ_pct: number | null;
  leased_pct: number | null;
  vacant_model: number | null;
  vacant_rented: number | null;
  vacant_unrented: number | null;
  vacant_total: number | null;
  notice_rented: number | null;
  notice_unrented: number | null;
  notice_total: number | null;
  avail_1br: number | null;
  avail_2br: number | null;
  avail_3br: number | null;
  avail_pct?: number | null;
  total_units: number | null;
  beg_occ: number | null;
  end_occ: number | null;
  move_ins: number | null;
  move_outs: number | null;
}

interface CalibrationStats {
  calibrated: boolean;
  sampleCount: number;
  lastUpdated: string | null;
  comparisons: Record<string, { calibrated: number; default: number }>;
}

type TabId = 'predictions' | 'data_sources' | 'comps' | 'visibility' | 'adjustments' | 'calibration';

const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: 'predictions', label: 'Predictions', icon: TrendingUp },
  { id: 'data_sources', label: 'Data Sources', icon: Layers },
  { id: 'comps', label: 'Comps', icon: Building2 },
  { id: 'visibility', label: 'Visibility', icon: Eye },
  { id: 'adjustments', label: 'Market Adjustments', icon: SlidersHorizontal },
  { id: 'calibration', label: 'Calibration', icon: Gauge },
];

const API_BASE = '/api/v1/leasing-traffic';

function Sparkline({ data, color = '#d97706', height = 32 }: { data: number[]; color?: string; height?: number }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const barW = Math.max(2, Math.floor(w / data.length) - 1);

  return (
    <svg width={w} height={height} className="flex-shrink-0">
      {data.slice(-12).map((v, i, arr) => {
        const barH = Math.max(2, ((v - min) / range) * (height - 4));
        const isLast = i === arr.length - 1;
        return (
          <rect
            key={i}
            x={i * (barW + 1)}
            y={height - barH - 2}
            width={barW}
            height={barH}
            rx={1}
            fill={isLast ? color : `${color}40`}
          />
        );
      })}
    </svg>
  );
}

function KPICard({ label, value, trend, trendUp, sparkData, icon: Icon }: {
  label: string; value: string; trend: string; trendUp: boolean | null; sparkData: number[]; icon: any;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-stone-400 font-mono text-[10px] uppercase tracking-wider">{label}</span>
        <Icon size={14} className="text-stone-300" />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold text-stone-900">{value}</div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs mt-1 ${trendUp === true ? 'text-emerald-600' : trendUp === false ? 'text-red-500' : 'text-stone-400'}`}>
              {trendUp === true ? <ArrowUpRight size={12} /> : trendUp === false ? <ArrowDownRight size={12} /> : <Minus size={12} />}
              {trend}
            </div>
          )}
        </div>
        <Sparkline data={sparkData} />
      </div>
    </div>
  );
}

function FactorCard({ label, factor, summary, direction }: {
  label: string; factor: number; summary: string; direction: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${direction === 'up' ? 'bg-emerald-50 border-emerald-200' : direction === 'down' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${direction === 'up' ? 'bg-emerald-500' : direction === 'down' ? 'bg-red-500' : 'bg-amber-500'}`} />
        <span className="text-stone-500 font-mono text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-xl font-bold ${direction === 'up' ? 'text-emerald-700' : direction === 'down' ? 'text-red-700' : 'text-amber-700'}`}>
        {factor.toFixed(2)}x
        <span className="ml-1 text-xs">
          {direction === 'up' ? <ArrowUpRight size={12} className="inline" /> : direction === 'down' ? <ArrowDownRight size={12} className="inline" /> : <Minus size={12} className="inline" />}
        </span>
      </div>
      <p className="text-[11px] text-stone-500 leading-tight">{summary}</p>
    </div>
  );
}

function DataSourceBanner({ dataSource, actualsCount, calibrationSource, onUploadClick }: {
  dataSource: 'predicted' | 'uploaded' | 'blended';
  actualsCount: number;
  calibrationSource?: string;
  onUploadClick: () => void;
}) {
  if (dataSource === 'predicted') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-amber-900">
            Projections based on property characteristics and market intelligence
          </div>
          <p className="text-[11px] text-amber-700 mt-1">
            {calibrationSource || 'Using industry-standard baselines for multifamily leasing.'}
            {' '}Upload weekly operator data to refine predictions with actual performance.
          </p>
        </div>
        <button
          onClick={onUploadClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs hover:bg-amber-700 transition-colors flex-shrink-0"
        >
          <Upload size={12} /> Upload Data
        </button>
      </div>
    );
  }

  if (dataSource === 'blended') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <CheckCircle2 size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-blue-900">
            Based on {actualsCount} week{actualsCount !== 1 ? 's' : ''} of actual data + market intelligence
          </div>
          <p className="text-[11px] text-blue-700 mt-1">
            Predictions are calibrated with your uploaded operating data. More data improves accuracy.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export function TrafficModule({ deal, dealId: propDealId, propertyId }: TrafficModuleProps) {
  const resolvedDealId = propDealId || deal?.id || '';
  const [activeTab, setActiveTab] = useState<TabId>('predictions');
  const [view, setView] = useState<'weekly' | 'monthly' | 'yearly'>('yearly');
  const [projection, setProjection] = useState<ProjectionData | null>(null);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [calibration, setCalibration] = useState<CalibrationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, Record<string, number>>>({});
  const [showAdjustments, setShowAdjustments] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    if (!resolvedDealId) return;
    setLoading(true);
    try {
      const [histRes, projRes, calRes] = await Promise.all([
        apiClient.get(`${API_BASE}/weekly-report/${resolvedDealId}/history`),
        apiClient.get(`${API_BASE}/weekly-report/${resolvedDealId}/projection`, { params: { view } }),
        apiClient.get(`${API_BASE}/weekly-report/${resolvedDealId}/calibration`).catch(() => ({ data: { calibrated: false, sampleCount: 0, comparisons: {} } })),
      ]);
      setHistory(histRes.data.snapshots || []);
      setProjection(projRes.data);
      setCalibration(calRes.data);
    } catch (err) {
      console.error('[TrafficModule] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [resolvedDealId, view]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !resolvedDealId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dealId', resolvedDealId);
      await apiClient.post(`${API_BASE}/weekly-report/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadData();
    } catch (err) {
      console.error('[TrafficModule] Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleSaveEdits = async () => {
    try {
      for (const [periodLabel, updates] of Object.entries(editValues)) {
        await apiClient.put(`${API_BASE}/weekly-report/${resolvedDealId}/snapshot`, {
          periodLabel,
          isProjected: true,
          ...updates,
        });
      }
      setEditing(false);
      setEditValues({});
      await loadData();
    } catch (err) {
      console.error('[TrafficModule] Save failed:', err);
    }
  };

  const dataSource = projection?.dataSource || 'predicted';
  const hasHistory = history.length > 0;

  const latest = hasHistory ? history[history.length - 1] : null;
  const prev4 = history.slice(-5, -1);

  const avg4 = (field: keyof HistorySnapshot) => {
    const vals = prev4.map(h => Number(h[field]) || 0).filter(v => v > 0);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const pctChange = (current: number, previous: number) => {
    if (previous === 0) return { text: 'N/A', up: null as boolean | null };
    const change = ((current - previous) / previous) * 100;
    return { text: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`, up: change >= 0 };
  };

  const firstPeriod = projection?.periods?.[0];
  const kpiTraffic = latest?.traffic ?? firstPeriod?.adjTraffic ?? 0;
  const kpiTours = latest?.in_person_tours ?? firstPeriod?.adjTours ?? 0;
  const kpiClosing = latest?.closing_ratio ?? firstPeriod?.adjClosingRatio ?? 0;
  const kpiNetLeases = latest?.net_leases ?? firstPeriod?.adjNetLeases ?? 0;
  const kpiOcc = latest?.occ_pct ?? firstPeriod?.adjOccPct ?? 0;

  const trafficTrend = hasHistory ? pctChange(kpiTraffic, avg4('traffic')) : { text: 'Predicted', up: null as boolean | null };
  const toursTrend = hasHistory ? pctChange(kpiTours, avg4('in_person_tours')) : { text: 'Predicted', up: null as boolean | null };
  const closingTrend = hasHistory ? pctChange(kpiClosing, avg4('closing_ratio')) : { text: 'Predicted', up: null as boolean | null };
  const leasesTrend = hasHistory ? pctChange(kpiNetLeases, avg4('net_leases')) : { text: 'Predicted', up: null as boolean | null };
  const occTrend = hasHistory ? pctChange(kpiOcc, avg4('occ_pct')) : { text: 'Predicted', up: null as boolean | null };

  const sparkTraffic = hasHistory
    ? history.slice(-12).map(h => h.traffic || 0)
    : (projection?.periods?.slice(0, 12).map(p => p.adjTraffic) || []);
  const sparkTours = hasHistory
    ? history.slice(-12).map(h => h.in_person_tours || 0)
    : (projection?.periods?.slice(0, 12).map(p => p.adjTours) || []);
  const sparkClosing = hasHistory
    ? history.slice(-12).map(h => (h.closing_ratio || 0) * 100)
    : (projection?.periods?.slice(0, 12).map(p => p.adjClosingRatio * 100) || []);
  const sparkLeases = hasHistory
    ? history.slice(-12).map(h => h.net_leases || 0)
    : (projection?.periods?.slice(0, 12).map(p => p.adjNetLeases) || []);
  const sparkOcc = hasHistory
    ? history.slice(-12).map(h => (h.occ_pct || 0) * 100)
    : (projection?.periods?.slice(0, 12).map(p => p.adjOccPct * 100) || []);

  const mi = projection?.marketIntelligence;

  const funnelTraffic = latest?.traffic ?? firstPeriod?.adjTraffic ?? 0;
  const funnelTours = latest?.in_person_tours ?? firstPeriod?.adjTours ?? 0;
  const funnelApps = latest?.apps ?? firstPeriod?.adjApps ?? 0;
  const funnelCancelDeny = latest?.cancellations ?? firstPeriod?.baseCancellations ?? 0;
  const funnelNetLeases = latest?.net_leases ?? firstPeriod?.adjNetLeases ?? 0;
  const funnelWebsite = latest?.website_leads ?? firstPeriod?.adjWebsite ?? 0;
  const funnelWalkIn = funnelTraffic - funnelWebsite;

  const rawMetricRows = [
    { key: 'traffic', label: 'Traffic (Total)', field: 'baseTraffic', adjField: 'adjTraffic', format: 'int' },
    { key: 'walkIn', label: 'Walk-In', field: 'baseWalkIn', adjField: 'adjWalkIn', format: 'int' },
    { key: 'website', label: 'Website', field: 'baseWebsite', adjField: 'adjWebsite', format: 'int' },
    { key: 'tours', label: 'Tours', field: 'baseTours', adjField: 'adjTours', format: 'int' },
    { key: 'apps', label: 'Apps', field: 'baseApps', adjField: 'adjApps', format: 'int' },
    { key: 'netLeases', label: 'Net Leases', field: 'baseNetLeases', adjField: 'adjNetLeases', format: 'int' },
    { key: 'closingRatio', label: 'Closing Ratio', field: 'baseClosingRatio', adjField: 'adjClosingRatio', format: 'pct' },
    { key: 'occPct', label: 'Occupancy', field: 'baseOccPct', adjField: 'adjOccPct', format: 'pct' },
    { key: 'leasedPct', label: 'Leased %', field: 'baseLeasedPct', adjField: 'adjLeasedPct', format: 'pct' },
  ];

  const adjustmentRows = [
    { key: 'demand', label: 'Demand Factor', field: 'demandFactor' },
    { key: 'supply', label: 'Supply Factor', field: 'supplyFactor' },
    { key: 'digital', label: 'Digital Factor', field: 'digitalFactor' },
    { key: 'seasonal', label: 'Seasonal Factor', field: 'seasonalFactor' },
    { key: 'combined', label: 'Combined Factor', field: 'combinedFactor' },
  ];

  const adjOutputRows = [
    { key: 'adjTraffic', label: 'Adj. Traffic', field: 'adjTraffic', format: 'int' },
    { key: 'adjTours', label: 'Adj. Tours', field: 'adjTours', format: 'int' },
    { key: 'adjNetLeases', label: 'Adj. Net Leases', field: 'adjNetLeases', format: 'int' },
    { key: 'adjClosing', label: 'Closing Ratio', field: 'adjClosingRatio', format: 'pct' },
    { key: 'adjOcc', label: 'Occupancy', field: 'adjOccPct', format: 'pct' },
    { key: 'adjLeased', label: 'Leased %', field: 'adjLeasedPct', format: 'pct' },
  ];

  const formatVal = (val: number | null | undefined, format: string): string => {
    if (val === null || val === undefined) return '–';
    if (format === 'pct') {
      const pctVal = val * 100;
      if (Math.abs(pctVal) < 0.05) return '–';
      return `${pctVal.toFixed(1)}%`;
    }
    if (format === 'factor') return `${val.toFixed(2)}x`;
    const rounded = Math.round(val);
    if (rounded === 0) return '–';
    if (rounded < 0) return `(${Math.abs(rounded).toLocaleString()})`;
    return rounded.toLocaleString();
  };

  const periods = projection?.periods || [];

  const renderKPIDashboard = () => (
    <div className="grid grid-cols-5 gap-4">
      <KPICard label="Weekly Traffic" value={Math.round(kpiTraffic).toLocaleString()} trend={trafficTrend.text} trendUp={trafficTrend.up} sparkData={sparkTraffic} icon={Users} />
      <KPICard label="In-Person Tours" value={Math.round(kpiTours).toLocaleString()} trend={toursTrend.text} trendUp={toursTrend.up} sparkData={sparkTours} icon={Footprints} />
      <KPICard label="Closing Ratio" value={`${(kpiClosing * 100).toFixed(1)}%`} trend={closingTrend.text} trendUp={closingTrend.up} sparkData={sparkClosing} icon={Target} />
      <KPICard label="Net Leases / Wk" value={Math.round(kpiNetLeases).toLocaleString()} trend={leasesTrend.text} trendUp={leasesTrend.up} sparkData={sparkLeases} icon={Activity} />
      <KPICard label="Occupancy" value={`${(kpiOcc * 100).toFixed(1)}%`} trend={occTrend.text} trendUp={occTrend.up} sparkData={sparkOcc} icon={Building2} />
    </div>
  );

  const renderPredictionsTab = () => (
    <div className="space-y-6">
      <DataSourceBanner dataSource={dataSource} actualsCount={projection?.actualsCount || 0} calibrationSource={projection?.calibrationSource} onUploadClick={triggerUpload} />

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Leasing Funnel</h3>
          {!hasHistory && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-mono">PREDICTED TYPICAL WEEK</span>
          )}
        </div>
        <div className="flex items-center gap-2 mb-4">
          {[
            { label: 'Traffic', value: Math.round(funnelTraffic), color: 'bg-stone-900' },
            { label: 'Tours', value: Math.round(funnelTours), color: 'bg-stone-700' },
            { label: 'Apps', value: Math.round(funnelApps), color: 'bg-stone-500' },
            { label: 'Cancel/Deny', value: Math.round(funnelCancelDeny), color: 'bg-red-400' },
            { label: 'Net Leases', value: Math.round(funnelNetLeases), color: 'bg-emerald-600' },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-2 flex-1">
              <div className="flex-1">
                <div className="text-stone-400 font-mono text-[10px] uppercase mb-1">{step.label}</div>
                <div className="text-lg font-bold text-stone-900">{step.value}</div>
                <div className={`h-2 rounded-full ${step.color} mt-1`}
                  style={{ width: `${funnelTraffic > 0 ? Math.max(10, (step.value / funnelTraffic) * 100) : 10}%` }} />
              </div>
              {i < arr.length - 1 && <ChevronRight size={16} className="text-stone-300 flex-shrink-0" />}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4 pt-4 border-t border-stone-100">
          <div className="flex-1">
            <div className="text-stone-400 font-mono text-[10px] uppercase mb-2">Traffic Source Split</div>
            <div className="flex h-4 rounded-full overflow-hidden bg-stone-100">
              <div className="bg-stone-700 flex items-center justify-center"
                style={{ width: `${funnelTraffic > 0 ? (Math.max(0, funnelWalkIn) / funnelTraffic) * 100 : 50}%` }}>
                <span className="text-[9px] text-white font-mono">{Math.max(0, Math.round(funnelWalkIn))}</span>
              </div>
              <div className="bg-blue-500 flex items-center justify-center"
                style={{ width: `${funnelTraffic > 0 ? (funnelWebsite / funnelTraffic) * 100 : 50}%` }}>
                <span className="text-[9px] text-white font-mono">{Math.round(funnelWebsite)}</span>
              </div>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-stone-500 flex items-center gap-1"><Footprints size={10} /> Walk-In</span>
              <span className="text-[10px] text-stone-500 flex items-center gap-1"><Globe size={10} /> Website</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-stone-400 font-mono text-[10px] uppercase mb-2">
              {hasHistory ? 'This Week vs 4-Wk Avg' : 'Predicted Baseline'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-stone-500">{hasHistory ? 'This Week' : 'Weekly'}</div>
                <div className="text-lg font-bold text-stone-900">{Math.round(kpiTraffic)}</div>
              </div>
              <div>
                <div className="text-xs text-stone-500">{hasHistory ? '4-Wk Avg' : 'Monthly Est.'}</div>
                <div className="text-lg font-bold text-stone-400">
                  {hasHistory ? Math.round(avg4('traffic')) : Math.round(kpiTraffic * 4.33)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Traffic Projection</h3>
          <div className="flex items-center gap-3">
            <div className="flex bg-stone-100 rounded-lg p-0.5">
              {(['weekly', 'monthly', 'yearly'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${view === v ? 'bg-white text-stone-900 shadow-sm font-medium' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            {editing ? (
              <div className="flex gap-2">
                <button onClick={handleSaveEdits} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700">
                  <Save size={12} /> Save
                </button>
                <button onClick={() => { setEditing(false); setEditValues({}); }} className="flex items-center gap-1 px-3 py-1.5 bg-stone-200 text-stone-700 rounded-lg text-xs hover:bg-stone-300">
                  <X size={12} /> Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-3 py-1.5 bg-stone-100 text-stone-700 rounded-lg text-xs hover:bg-stone-200">
                <Edit3 size={12} /> Edit
              </button>
            )}
          </div>
        </div>

        <div ref={tableContainerRef} className="overflow-x-auto rounded-lg border border-stone-200">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ backgroundColor: '#3C4A3B' }}>
                <th className="sticky left-0 z-10 text-left px-4 py-3 min-w-[160px] border-r border-[#4d5a4c]" style={{ backgroundColor: '#3C4A3B' }}>
                  <span className="text-white/60 text-[10px] font-normal uppercase tracking-wider"></span>
                </th>
                {periods.map(p => {
                  const parts = p.label.split('|');
                  const topLine = parts[0] || p.label;
                  const bottomLine = parts[1] || '';
                  return (
                    <th key={p.index} className="px-3 py-2.5 text-right min-w-[88px] border-r border-[#4d5a4c] last:border-r-0">
                      <div className="text-white text-[11px] font-semibold leading-tight">{topLine}</div>
                      {bottomLine && <div className="text-white/50 text-[9px] font-normal mt-0.5">{bottomLine}</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={periods.length + 1} className="px-4 py-2 text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200 bg-stone-50">
                  Raw Traffic Metrics
                </td>
              </tr>
              {rawMetricRows.map(row => (
                <tr key={row.key} className="border-b border-stone-100">
                  <td className="sticky left-0 bg-white z-10 px-4 py-2 text-stone-700 text-[11px] border-r border-stone-100">{row.label}</td>
                  {periods.map(p => {
                    const val = (p as any)[row.field] as number;
                    return (
                      <td key={p.index} className="px-3 py-2 text-right font-mono text-[11px] text-stone-800">
                        {formatVal(val, row.format)}
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr className="h-3"><td colSpan={periods.length + 1}></td></tr>

              <tr className="cursor-pointer" onClick={() => setShowAdjustments(!showAdjustments)}>
                <td colSpan={periods.length + 1} className="px-4 py-2 text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200 border-t border-stone-200 bg-stone-50">
                  <span className="flex items-center gap-1">
                    {showAdjustments ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    Market Adjustments
                  </span>
                </td>
              </tr>
              {showAdjustments && adjustmentRows.map(row => (
                <tr key={row.key} className="border-b border-stone-100">
                  <td className="sticky left-0 bg-white z-10 px-4 py-2 text-stone-600 text-[11px] border-r border-stone-100">{row.label}</td>
                  {periods.map(p => {
                    const val = (p as any)[row.field] as number;
                    return (
                      <td key={p.index} className="px-3 py-2 text-right font-mono text-[11px] text-stone-700">
                        {p.isActual ? '–' : `${val.toFixed(2)}x`}
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr className="h-3"><td colSpan={periods.length + 1}></td></tr>

              <tr>
                <td colSpan={periods.length + 1} className="px-4 py-2 text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200 border-t border-stone-200 bg-stone-50">
                  Adjusted Output
                </td>
              </tr>
              {adjOutputRows.map(row => (
                <tr key={row.key} className="border-b border-stone-100">
                  <td className="sticky left-0 bg-white z-10 px-4 py-2 text-stone-700 font-medium text-[11px] border-r border-stone-100">{row.label}</td>
                  {periods.map(p => {
                    const val = (p as any)[row.field] as number;
                    const isEditable = editing && !p.isActual;

                    if (isEditable) {
                      return (
                        <td key={p.index} className="px-1 py-1">
                          <input
                            type="number"
                            className="w-full text-right text-[11px] font-mono border border-stone-300 rounded px-2 py-1 bg-amber-50/50 focus:outline-none focus:border-stone-400"
                            defaultValue={row.format === 'pct' ? (val * 100).toFixed(1) : Math.round(val)}
                            onChange={(e) => {
                              const newVal = row.format === 'pct' ? parseFloat(e.target.value) / 100 : parseFloat(e.target.value);
                              setEditValues(prev => ({
                                ...prev,
                                [p.label]: { ...prev[p.label], [row.field]: newVal },
                              }));
                            }}
                          />
                        </td>
                      );
                    }

                    return (
                      <td key={p.index} className="px-3 py-2 text-right font-mono text-[11px] text-stone-900 font-medium">
                        {formatVal(val, row.format)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-6 mt-3 text-[10px] text-stone-400">
          <span>Parentheses indicate negative values</span>
          <span>– indicates zero or not applicable</span>
        </div>
      </div>
    </div>
  );

  const renderAdjustmentsTab = () => (
    <div className="space-y-6">
      {mi && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-stone-900">Market Intelligence Adjustments</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
              dataSource === 'uploaded' ? 'bg-emerald-100 text-emerald-700' :
              dataSource === 'blended' ? 'bg-blue-100 text-blue-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {dataSource === 'uploaded' ? 'LIVE DATA' : dataSource === 'blended' ? 'BLENDED' : 'MARKET SIGNALS'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <FactorCard label="Demand" factor={mi.demandFactor} summary={mi.demandSummary} direction={mi.demandDirection} />
            <FactorCard label="Supply" factor={mi.supplyFactor} summary={mi.supplySummary} direction={mi.supplyDirection} />
            <FactorCard label="Digital" factor={mi.digitalFactor} summary={mi.digitalSummary} direction={mi.digitalDirection} />
            <FactorCard label="Seasonal" factor={mi.seasonalFactor} summary={mi.seasonalSummary} direction={mi.seasonalDirection} />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
            <TrendingUp size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-amber-900">{mi.overallSummary}</div>
              <p className="text-[11px] text-amber-700 mt-1">These factors are applied to your base traffic trend to produce the adjusted projections.</p>
            </div>
          </div>
        </div>
      )}

      {latest && (
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <h3 className="text-lg font-bold text-stone-900 mb-4">Vacancy & Availability</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-stone-400 font-mono text-[10px] uppercase mb-3">Vacancy Breakdown</div>
              <div className="space-y-3">
                {[
                  { label: 'Model', value: latest.vacant_model || 0, color: 'bg-stone-400' },
                  { label: 'Rented Vacant', value: latest.vacant_rented || 0, color: 'bg-amber-500' },
                  { label: 'Unrented Vacant', value: latest.vacant_unrented || 0, color: 'bg-red-500' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-xs text-stone-600 w-28">{item.label}</span>
                    <div className="flex-1 bg-stone-100 rounded-full h-3 overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`}
                        style={{ width: `${(latest.total_units || 290) > 0 ? (item.value / (latest.total_units || 290)) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs font-mono text-stone-700 w-8 text-right">{item.value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-2 border-t border-stone-100">
                  <span className="text-xs text-stone-900 font-semibold w-28">Total Vacant</span>
                  <div className="flex-1" />
                  <span className="text-xs font-mono font-bold text-stone-900 w-8 text-right">{latest.vacant_total || 0}</span>
                </div>
              </div>

              <div className="text-stone-400 font-mono text-[10px] uppercase mt-6 mb-3">On-Notice Pipeline</div>
              <div className="space-y-3">
                {[
                  { label: 'Rented Notice', value: latest.notice_rented || 0, color: 'bg-amber-400' },
                  { label: 'Unrented Notice', value: latest.notice_unrented || 0, color: 'bg-red-400' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-xs text-stone-600 w-28">{item.label}</span>
                    <div className="flex-1 bg-stone-100 rounded-full h-3 overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`}
                        style={{ width: `${(latest.total_units || 290) > 0 ? (item.value / (latest.total_units || 290)) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs font-mono text-stone-700 w-8 text-right">{item.value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-2 border-t border-stone-100">
                  <span className="text-xs text-stone-900 font-semibold w-28">Total Notice</span>
                  <div className="flex-1" />
                  <span className="text-xs font-mono font-bold text-stone-900 w-8 text-right">{latest.notice_total || 0}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="text-stone-400 font-mono text-[10px] uppercase mb-3">Unit Availability by Type</div>
              <div className="space-y-4">
                {[
                  { label: '1 BR', value: latest.avail_1br || 0 },
                  { label: '2 BR', value: latest.avail_2br || 0 },
                  { label: '3 BR', value: latest.avail_3br || 0 },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-stone-600">{item.label}</span>
                      <span className="text-xs font-mono font-bold text-stone-900">{item.value} units</span>
                    </div>
                    <div className="bg-stone-100 rounded-full h-3 overflow-hidden">
                      <div className="h-full bg-stone-600 rounded-full"
                        style={{ width: `${Math.min(100, item.value * 5)}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { label: 'Occ %', value: `${((latest.occ_pct || 0) * 100).toFixed(1)}%` },
                  { label: 'Leased %', value: `${((latest.leased_pct || 0) * 100).toFixed(1)}%` },
                  { label: 'Avail %', value: `${((latest.avail_pct || 0) * 100).toFixed(1)}%` },
                ].map(item => (
                  <div key={item.label} className="bg-stone-50 rounded-lg p-3 text-center">
                    <div className="text-stone-400 font-mono text-[10px] uppercase">{item.label}</div>
                    <div className="text-lg font-bold text-stone-900 mt-1">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!mi && !latest && (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <SlidersHorizontal size={32} className="mx-auto text-stone-300 mb-3" />
          <p className="text-sm text-stone-500">Market adjustments will appear once projection data is available.</p>
        </div>
      )}
    </div>
  );

  const renderCalibrationTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database size={18} className="text-stone-400" />
          <div>
            <h3 className="text-lg font-bold text-stone-900">Data Library Calibration</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {calibration?.calibrated
                ? `${calibration.sampleCount} deal${calibration.sampleCount !== 1 ? 's' : ''} in this submarket contributing to calibration`
                : 'No submarket calibration data yet — upload weekly reports to teach the engine'}
            </p>
          </div>
          {calibration?.calibrated && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono ml-auto">CALIBRATED</span>
          )}
        </div>

        {calibration?.calibrated && Object.keys(calibration.comparisons).length > 0 ? (
          <div className="space-y-3">
            <div className="text-stone-400 font-mono text-[10px] uppercase mb-2">Calibrated vs Default Values</div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(calibration.comparisons).map(([metric, vals]) => {
                const isPct = metric.includes('Ratio') || metric.includes('Conversion') || metric.includes('%');
                const formatFn = (v: number) => isPct ? `${(v * 100).toFixed(1)}%` : v.toFixed(4);
                const diff = vals.calibrated - vals.default;
                const diffPct = vals.default !== 0 ? ((diff / vals.default) * 100).toFixed(0) : '0';
                const isUp = diff > 0;

                return (
                  <div key={metric} className="bg-stone-50 rounded-lg p-3">
                    <div className="text-stone-500 font-mono text-[10px] uppercase mb-2">{metric}</div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-lg font-bold text-stone-900">{formatFn(vals.calibrated)}</div>
                        <div className="text-[11px] text-stone-400">Default: {formatFn(vals.default)}</div>
                      </div>
                      <div className={`text-xs font-mono ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isUp ? '+' : ''}{diffPct}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {calibration.lastUpdated && (
              <div className="text-[10px] text-stone-400 mt-2">
                Last updated: {new Date(calibration.lastUpdated).toLocaleDateString()}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <Database size={32} className="mx-auto text-stone-300 mb-3" />
            <p className="text-sm text-stone-500 mb-3">
              Upload weekly operating reports to build submarket-specific calibration data.
              The more deals that contribute data, the better the predictions become.
            </p>
            <button
              onClick={triggerUpload}
              className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg text-sm hover:bg-stone-800 transition-colors"
            >
              <Upload size={14} /> Upload Weekly Report
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleUpload}
        className="hidden"
      />

      <div className="bg-stone-900 rounded-xl p-6 text-white flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Traffic Intelligence</h2>
          <p className="text-stone-300 text-sm mt-1">What is this property's true leasing velocity — and can we improve it?</p>
        </div>
        <div className="flex items-center gap-3">
          {dataSource === 'uploaded' && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-mono">LIVE DATA</span>
          )}
          {dataSource === 'blended' && (
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono">BLENDED</span>
          )}
          {dataSource === 'predicted' && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-mono">PREDICTED</span>
          )}
          <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 text-white rounded-lg cursor-pointer hover:bg-white/20 transition-colors text-sm">
            <Upload size={14} />
            {uploading ? 'Uploading...' : 'Upload Report'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
          <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-stone-500 text-sm">Loading traffic predictions...</p>
        </div>
      ) : (
        <>
          {renderKPIDashboard()}

          <div className="flex border-b border-stone-200 gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-stone-900 text-stone-900'
                      : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-300'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'predictions' && renderPredictionsTab()}
          {activeTab === 'data_sources' && <TrafficDataSourcesTab dealId={resolvedDealId} onNavigateToVisibility={() => setActiveTab('visibility')} />}
          {activeTab === 'comps' && <TrafficCompsTab dealId={resolvedDealId} />}
          {activeTab === 'visibility' && <VisibilityAssessmentTab dealId={resolvedDealId} propertyId={propertyId} />}
          {activeTab === 'adjustments' && renderAdjustmentsTab()}
          {activeTab === 'calibration' && renderCalibrationTab()}
        </>
      )}
    </div>
  );
}

export default TrafficModule;
