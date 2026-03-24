import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {
  TrendingUp, Upload, ArrowUpRight, ArrowDownRight,
  ChevronDown, ChevronRight, Edit3, Save, X, Building2,
  Users, Target, Activity, BarChart3, Globe, Footprints,
  Minus, Database, AlertCircle, CheckCircle2, Eye, Car,
  Layers, SlidersHorizontal, Gauge, ExternalLink,
} from 'lucide-react';
import { apiClient } from '@/services/api.client';
import { useDealModule } from '@/contexts/DealModuleContext';
import { T as BT, mono as bMono, sans as bSans } from '../bloomberg-tokens';
import { BT as BT2, PanelHeader, SubTabBar, KpiTile, SectionPanel, DataRow, BtTabWrapper, BT_CSS } from '../bloomberg-ui';
import TrafficDataSourcesTab from './traffic/TrafficDataSourcesTab';
import TrafficCompsTab from './traffic/TrafficCompsTab';
import VisibilityAssessmentTab from './traffic/VisibilityAssessmentTab';
import TrafficPredictionsTab from './traffic/TrafficPredictionsTab';
import AbsorptionScheduleTab from './traffic/AbsorptionScheduleTab';

const TradeAreaDefinitionPanel = lazy(() =>
  import('../../trade-area/TradeAreaDefinitionPanel').then(m => ({ default: m.TradeAreaDefinitionPanel }))
);

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
  baseline_source?: 'comp_pattern' | 'submarket_calibration' | 'property_estimate';
  baseline_comps?: string[];
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
  dataLibraryFileCount: number;
}

type TabId = 'predictions' | 'data_sources' | 'comps' | 'visibility' | 'adjustments' | 'calibration' | 'absorption';

const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: 'predictions', label: 'Predictions', icon: TrendingUp },
  { id: 'data_sources', label: 'Data Sources', icon: Layers },
  { id: 'comps', label: 'Comps', icon: Building2 },
  { id: 'visibility', label: 'Visibility', icon: Eye },
  { id: 'adjustments', label: 'Market Adjustments', icon: SlidersHorizontal },
  { id: 'calibration', label: 'Calibration', icon: Gauge },
  { id: 'absorption', label: 'Absorption Schedule', icon: BarChart3 },
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
  const trendColor = trendUp === true ? BT2.text.green : trendUp === false ? BT2.text.red : BT2.text.muted;
  return (
    <div style={{ background: BT2.bg.panel, borderRadius: 8, border: `1px solid ${BT2.border.subtle}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, color: BT2.text.muted, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: bMono }}>{label}</span>
        <Icon size={13} style={{ color: BT2.text.muted }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: BT2.text.amber, fontFamily: bMono }}>{value}</div>
          {trend && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: trendColor, marginTop: 3 }}>
              {trendUp === true ? <ArrowUpRight size={11} /> : trendUp === false ? <ArrowDownRight size={11} /> : <Minus size={11} />}
              <span style={{ fontFamily: bMono }}>{trend}</span>
            </div>
          )}
        </div>
        <Sparkline data={sparkData} color={BT2.text.amber} />
      </div>
    </div>
  );
}

function FactorCard({ label, factor, summary, direction }: {
  label: string; factor: number; summary: string; direction: 'up' | 'down' | 'neutral';
}) {
  const dc = direction === 'up' ? BT2.text.green : direction === 'down' ? BT2.text.red : BT2.text.amber;
  const db = direction === 'up' ? `${BT2.text.green}18` : direction === 'down' ? `${BT2.text.red}18` : `${BT2.text.amber}18`;
  return (
    <div style={{ background: db, borderRadius: 8, border: `1px solid ${dc}30`, padding: '14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dc }} />
        <span style={{ fontSize: 9, color: BT2.text.muted, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: bMono }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: dc, display: 'flex', alignItems: 'center', gap: 4, fontFamily: bMono }}>
        {factor.toFixed(2)}x
        {direction === 'up' ? <ArrowUpRight size={12} /> : direction === 'down' ? <ArrowDownRight size={12} /> : <Minus size={12} />}
      </div>
      <p style={{ fontSize: 10, color: BT2.text.secondary, lineHeight: 1.4, margin: 0, fontFamily: bSans }}>{summary}</p>
    </div>
  );
}

function DataSourceBanner({ dataSource, actualsCount, calibrationSource, baselineSource, baselineComps, onUploadClick }: {
  dataSource: 'predicted' | 'uploaded' | 'blended';
  actualsCount: number;
  calibrationSource?: string;
  baselineSource?: string;
  baselineComps?: string[];
  onUploadClick: () => void;
}) {
  if (dataSource === 'predicted') {
    const isCompPattern = baselineSource === 'comp_pattern' && baselineComps && baselineComps.length > 0;
    return (
      <div className={`border rounded-xl p-4 flex items-start gap-3 ${isCompPattern ? 'bg-emerald-900/10 border-emerald-800' : 'bg-amber-900/10 border-amber-800'}`}>
        {isCompPattern
          ? <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
          : <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
        }
        <div className="flex-1">
          <div className={`text-sm font-semibold ${isCompPattern ? 'text-emerald-300' : 'text-amber-300'}`}>
            {isCompPattern
              ? `Baseline calibrated from ${baselineComps!.length} comp deal${baselineComps!.length !== 1 ? 's' : ''}`
              : 'Projections based on property characteristics and market intelligence'
            }
          </div>
          <p className={`text-[11px] mt-1 ${isCompPattern ? 'text-emerald-300' : 'text-amber-300'}`}>
            {isCompPattern
              ? `Traffic, seasonal patterns, and trend rates derived from: ${baselineComps!.join(', ')}. Metrics are scaled to this deal's unit count.`
              : (calibrationSource || 'Using industry-standard baselines for multifamily leasing.')
            }
            {!isCompPattern && ' Upload weekly operator data to refine predictions with actual performance.'}
          </p>
        </div>
        {!isCompPattern && (
          <button
            onClick={onUploadClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-700 text-neutral-100 rounded-lg text-xs hover:bg-neutral-600 transition-colors flex-shrink-0"
          >
            <Upload size={12} /> Upload Data
          </button>
        )}
      </div>
    );
  }

  if (dataSource === 'blended') {
    return (
      <div className="rounded-xl p-4 flex items-start gap-3 border border-blue-800/50" style={{ background: "rgba(59,130,246,0.06)" }}>
        <CheckCircle2 size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-blue-900">
            Based on {actualsCount} week{actualsCount !== 1 ? 's' : ''} of actual data + market intelligence
          </div>
          <p className="text-[11px] text-blue-300 mt-1">
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
  const { updateMarket, emitEvent, lastEvent, strategy } = useDealModule();
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
  const [showTradeAreaPanel, setShowTradeAreaPanel] = useState(false);
  const [dataSourcesKey, setDataSourcesKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const dealLatLng = (() => {
    const boundary = deal?.boundary;
    if (!boundary?.coordinates) return { lat: 33.749, lng: -84.388 };
    try {
      const coords = boundary.type === 'Polygon'
        ? boundary.coordinates[0]
        : boundary.type === 'Point'
        ? [boundary.coordinates]
        : boundary.coordinates[0]?.[0] ? boundary.coordinates[0] : [boundary.coordinates];
      if (!coords?.length) return { lat: 33.749, lng: -84.388 };
      const lngSum = coords.reduce((s: number, c: number[]) => s + c[0], 0);
      const latSum = coords.reduce((s: number, c: number[]) => s + c[1], 0);
      return { lat: latSum / coords.length, lng: lngSum / coords.length };
    } catch {
      return { lat: 33.749, lng: -84.388 };
    }
  })();

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

  useEffect(() => {
    if (!projection) return;
    const mi = projection.marketIntelligence;
    const firstPeriod = projection.periods?.[0];
    const latestSnap = history.length > 0 ? history[history.length - 1] : null;

    const occupancy = latestSnap?.occ_pct ?? firstPeriod?.adjOccPct ?? 0;
    const rentGrowth = mi ? (mi.demandFactor - 1) * 100 : 0;
    const supplyPipeline = mi ? Math.round(mi.supplyFactor * 10) : 0;
    const demandScore = mi ? Math.round(mi.demandFactor * 50) : 0;

    updateMarket({
      occupancy,
      avgRent: 0,
      rentGrowth,
      supplyPipeline,
      demandScore,
    });
    emitEvent({ source: 'TrafficModule', type: 'market-updated', payload: { occupancy, rentGrowth, supplyPipeline, demandScore } });
  }, [projection, history, updateMarket, emitEvent]);

  const prevStrategyRef = useRef(strategy?.selectedStrategy);
  useEffect(() => {
    if (!strategy) return;
    if (prevStrategyRef.current !== undefined && prevStrategyRef.current !== strategy.selectedStrategy) {
      loadData();
    }
    prevStrategyRef.current = strategy.selectedStrategy;
  }, [strategy?.selectedStrategy, loadData]);

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

  const handleTradeAreaSave = async (tradeAreaId: string) => {
    try {
      await apiClient.patch(`/api/v1/leasing-traffic/deal-trade-area/${resolvedDealId}`, { trade_area_id: tradeAreaId });
    } catch (err) {
      console.error('[TrafficModule] Failed to link trade area to deal:', err);
    } finally {
      setShowTradeAreaPanel(false);
      setDataSourcesKey(k => k + 1);
    }
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
  const sparkWebsite = hasHistory
    ? history.slice(-12).map(h => h.website_leads || 0)
    : (projection?.periods?.slice(0, 12).map(p => p.adjWebsite) || []);

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
      <DataSourceBanner dataSource={dataSource} actualsCount={projection?.actualsCount || 0} calibrationSource={projection?.calibrationSource} baselineSource={projection?.baseline_source} baselineComps={projection?.baseline_comps} onUploadClick={triggerUpload} />

      <div style={{ background: "#0F1319", border: "1px solid #1e2a3d", borderRadius: 4, padding: 20 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#E8E6E1]">Leasing Funnel</h3>
          {!hasHistory && (
            <span className="text-[10px] bg-amber-900/20 text-amber-300 px-2 py-0.5 rounded-full font-mono">PREDICTED TYPICAL WEEK</span>
          )}
        </div>
        <div className="flex items-center gap-2 mb-4">
          {[
            { label: 'Traffic', value: Math.round(funnelTraffic), color: 'bg-[#4B5563]' },
            { label: 'Tours', value: Math.round(funnelTours), color: 'bg-neutral-800' },
            { label: 'Apps', value: Math.round(funnelApps), color: 'bg-neutral-800' },
            { label: 'Cancel/Deny', value: Math.round(funnelCancelDeny), color: 'bg-red-400' },
            { label: 'Net Leases', value: Math.round(funnelNetLeases), color: 'bg-neutral-700' },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-2 flex-1">
              <div className="flex-1">
                <div className="text-neutral-400 font-mono text-[10px] uppercase mb-1">{step.label}</div>
                <div className="text-lg font-bold text-[#E8E6E1]">{step.value}</div>
                <div className={`h-2 rounded-full ${step.color} mt-1`}
                  style={{ width: `${funnelTraffic > 0 ? Math.max(10, (step.value / funnelTraffic) * 100) : 10}%` }} />
              </div>
              {i < arr.length - 1 && <ChevronRight size={16} className="text-neutral-400 flex-shrink-0" />}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4 pt-4 border-t border-stone-100">
          <div className="flex-1">
            <div className="text-neutral-400 font-mono text-[10px] uppercase mb-2">Traffic Source Split</div>
            <div className="flex h-4 rounded-full overflow-hidden bg-[#131920]">
              <div className="bg-neutral-800 flex items-center justify-center"
                style={{ width: `${funnelTraffic > 0 ? (Math.max(0, funnelWalkIn) / funnelTraffic) * 100 : 50}%` }}>
                <span className="text-[9px] text-neutral-100 font-mono">{Math.max(0, Math.round(funnelWalkIn))}</span>
              </div>
              <div className="bg-blue-500 flex items-center justify-center"
                style={{ width: `${funnelTraffic > 0 ? (funnelWebsite / funnelTraffic) * 100 : 50}%` }}>
                <span className="text-[9px] text-neutral-100 font-mono">{Math.round(funnelWebsite)}</span>
              </div>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[#6B7585] flex items-center gap-1"><Footprints size={10} /> Walk-In</span>
              <span className="text-[10px] text-[#6B7585] flex items-center gap-1"><Globe size={10} /> Website</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-neutral-400 font-mono text-[10px] uppercase mb-2">
              {hasHistory ? 'This Week vs 4-Wk Avg' : 'Predicted Baseline'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-[#6B7585]">{hasHistory ? 'This Week' : 'Weekly'}</div>
                <div className="text-lg font-bold text-[#E8E6E1]">{Math.round(kpiTraffic)}</div>
              </div>
              <div>
                <div className="text-xs text-[#6B7585]">{hasHistory ? '4-Wk Avg' : 'Monthly Est.'}</div>
                <div className="text-lg font-bold text-neutral-400">
                  {hasHistory ? Math.round(avg4('traffic')) : Math.round(kpiTraffic * 4.33)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: "#0F1319", border: "1px solid #1e2a3d", borderRadius: 4, padding: 20 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#E8E6E1]">Traffic Projection</h3>
          <div className="flex items-center gap-3">
            <div className="flex bg-[#131920] rounded-lg p-0.5">
              {(['weekly', 'monthly', 'yearly'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${view === v ? 'font-medium' : ''}`}
                  style={view === v ? { background: '#131920', color: '#E8E6E1' } : { color: '#6B7585' }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            {editing ? (
              <div className="flex gap-2">
                <button onClick={handleSaveEdits} className="flex items-center gap-1 px-3 py-1.5 bg-neutral-700 text-neutral-100 rounded-lg text-xs hover:bg-neutral-600">
                  <Save size={12} /> Save
                </button>
                <button onClick={() => { setEditing(false); setEditValues({}); }} className="flex items-center gap-1 px-3 py-1.5 bg-[#1e2a3d] text-[#9EA8B4] rounded-lg text-xs hover:bg-[#1e2a3d]">
                  <X size={12} /> Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-3 py-1.5 bg-[#131920] text-[#9EA8B4] rounded-lg text-xs hover:bg-[#1e2a3d]">
                <Edit3 size={12} /> Edit
              </button>
            )}
          </div>
        </div>

        <div ref={tableContainerRef} className="overflow-x-auto rounded-lg border border-[#1e2a3d]">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ backgroundColor: '#3C4A3B' }}>
                <th className="sticky left-0 z-10 text-left px-4 py-3 min-w-[160px] border-r border-[#4d5a4c]" style={{ backgroundColor: '#3C4A3B' }}>
                  <span className="text-neutral-400 text-[10px] font-normal uppercase tracking-wider"></span>
                </th>
                {periods.map(p => {
                  const parts = p.label.split('|');
                  const topLine = parts[0] || p.label;
                  const bottomLine = parts[1] || '';
                  return (
                    <th key={p.index} className="px-3 py-2.5 text-right min-w-[88px] border-r border-[#4d5a4c] last:border-r-0">
                      <div className="text-neutral-100 text-[11px] font-semibold leading-tight">{topLine}</div>
                      {bottomLine && <div className="text-neutral-400 text-[9px] font-normal mt-0.5">{bottomLine}</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={periods.length + 1} className="px-4 py-2 text-[10px] font-bold text-[#6B7585] uppercase tracking-wider border-b border-[#1e2a3d] bg-[#0F1319]">
                  Raw Traffic Metrics
                </td>
              </tr>
              {rawMetricRows.map(row => (
                <tr key={row.key} className="border-b border-stone-100">
                  <td className="sticky left-0 z-10 px-4 py-2 text-[11px] border-r" style={{ background: "#0F1319", color: "#9EA8B4", borderColor: "#1e2a3d" }}>{row.label}</td>
                  {periods.map(p => {
                    const val = (p as Record<string, unknown>)[row.field] as number;
                    return (
                      <td key={p.index} className="px-3 py-2 text-right font-mono text-[11px] text-neutral-400">
                        {formatVal(val, row.format)}
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr className="h-3"><td colSpan={periods.length + 1}></td></tr>

              <tr className="cursor-pointer" onClick={() => setShowAdjustments(!showAdjustments)}>
                <td colSpan={periods.length + 1} className="px-4 py-2 text-[10px] font-bold text-[#6B7585] uppercase tracking-wider border-b border-[#1e2a3d] border-t border-[#1e2a3d] bg-[#0F1319]">
                  <span className="flex items-center gap-1">
                    {showAdjustments ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    Market Adjustments
                  </span>
                </td>
              </tr>
              {showAdjustments && adjustmentRows.map(row => (
                <tr key={row.key} className="border-b border-stone-100">
                  <td className="sticky left-0 z-10 px-4 py-2 text-[11px] border-r" style={{ background: "#0F1319", color: "#6B7585", borderColor: "#1e2a3d" }}>{row.label}</td>
                  {periods.map(p => {
                    const val = (p as Record<string, unknown>)[row.field] as number;
                    return (
                      <td key={p.index} className="px-3 py-2 text-right font-mono text-[11px] text-[#9EA8B4]">
                        {p.isActual ? '–' : `${val.toFixed(2)}x`}
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr className="h-3"><td colSpan={periods.length + 1}></td></tr>

              <tr>
                <td colSpan={periods.length + 1} className="px-4 py-2 text-[10px] font-bold text-[#6B7585] uppercase tracking-wider border-b border-[#1e2a3d] border-t border-[#1e2a3d] bg-[#0F1319]">
                  Adjusted Output
                </td>
              </tr>
              {adjOutputRows.map(row => (
                <tr key={row.key} className="border-b border-stone-100">
                  <td className="sticky left-0 z-10 px-4 py-2 font-medium text-[11px] border-r" style={{ background: "#0F1319", color: "#9EA8B4", borderColor: "#1e2a3d" }}>{row.label}</td>
                  {periods.map(p => {
                    const val = (p as Record<string, unknown>)[row.field] as number;
                    const isEditable = editing && !p.isActual;

                    if (isEditable) {
                      return (
                        <td key={p.index} className="px-1 py-1">
                          <input
                            type="number"
                            className="w-full text-right text-[11px] font-mono rounded px-2 py-1 focus:outline-none" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid #1e2a3d", color: "#C8C4BE" }}
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
                      <td key={p.index} className="px-3 py-2 text-right font-mono text-[11px] text-[#E8E6E1] font-medium">
                        {formatVal(val, row.format)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-6 mt-3 text-[10px] text-neutral-400">
          <span>Parentheses indicate negative values</span>
          <span>– indicates zero or not applicable</span>
        </div>
      </div>
    </div>
  );

  const renderAdjustmentsTab = () => (
    <div className="space-y-6">
      {mi && (
        <div style={{ background: "#0F1319", border: "1px solid #1e2a3d", borderRadius: 4, padding: 20 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#E8E6E1]">Market Intelligence Adjustments</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
              dataSource === 'uploaded' ? 'bg-emerald-900/20 text-emerald-300' :
              dataSource === 'blended' ? 'bg-blue-900/20 text-blue-300' :
              'bg-amber-900/20 text-amber-300'
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
          <div className="rounded-lg p-3 flex items-start gap-3 border border-amber-800" style={{ background: "rgba(245,158,11,0.08)" }}>
            <TrendingUp size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-amber-300">{mi.overallSummary}</div>
              <p className="text-[11px] text-amber-300 mt-1">These factors are applied to your base traffic trend to produce the adjusted projections.</p>
            </div>
          </div>
        </div>
      )}

      {latest && (
        <div style={{ background: "#0F1319", border: "1px solid #1e2a3d", borderRadius: 4, padding: 20 }}>
          <h3 className="text-lg font-bold text-[#E8E6E1] mb-4">Vacancy & Availability</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-neutral-400 font-mono text-[10px] uppercase mb-3">Vacancy Breakdown</div>
              <div className="space-y-3">
                {[
                  { label: 'Model', value: latest.vacant_model || 0, color: 'bg-neutral-800' },
                  { label: 'Rented Vacant', value: latest.vacant_rented || 0, color: 'bg-amber-500' },
                  { label: 'Unrented Vacant', value: latest.vacant_unrented || 0, color: 'bg-red-500' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-xs text-[#6B7585] w-28">{item.label}</span>
                    <div className="flex-1 bg-[#131920] rounded-full h-3 overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`}
                        style={{ width: `${(latest.total_units || 290) > 0 ? (item.value / (latest.total_units || 290)) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs font-mono text-[#9EA8B4] w-8 text-right">{item.value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-2 border-t border-stone-100">
                  <span className="text-xs text-[#E8E6E1] font-semibold w-28">Total Vacant</span>
                  <div className="flex-1" />
                  <span className="text-xs font-mono font-bold text-[#E8E6E1] w-8 text-right">{latest.vacant_total || 0}</span>
                </div>
              </div>

              <div className="text-neutral-400 font-mono text-[10px] uppercase mt-6 mb-3">On-Notice Pipeline</div>
              <div className="space-y-3">
                {[
                  { label: 'Rented Notice', value: latest.notice_rented || 0, color: 'bg-amber-400' },
                  { label: 'Unrented Notice', value: latest.notice_unrented || 0, color: 'bg-red-400' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="text-xs text-[#6B7585] w-28">{item.label}</span>
                    <div className="flex-1 bg-[#131920] rounded-full h-3 overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`}
                        style={{ width: `${(latest.total_units || 290) > 0 ? (item.value / (latest.total_units || 290)) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs font-mono text-[#9EA8B4] w-8 text-right">{item.value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-2 border-t border-stone-100">
                  <span className="text-xs text-[#E8E6E1] font-semibold w-28">Total Notice</span>
                  <div className="flex-1" />
                  <span className="text-xs font-mono font-bold text-[#E8E6E1] w-8 text-right">{latest.notice_total || 0}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="text-neutral-400 font-mono text-[10px] uppercase mb-3">Unit Availability by Type</div>
              <div className="space-y-4">
                {[
                  { label: '1 BR', value: latest.avail_1br || 0 },
                  { label: '2 BR', value: latest.avail_2br || 0 },
                  { label: '3 BR', value: latest.avail_3br || 0 },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-[#6B7585]">{item.label}</span>
                      <span className="text-xs font-mono font-bold text-[#E8E6E1]">{item.value} units</span>
                    </div>
                    <div className="bg-[#131920] rounded-full h-3 overflow-hidden">
                      <div className="h-full bg-neutral-800 rounded-full"
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
                  <div key={item.label} className="bg-[#0F1319] rounded-lg p-3 text-center">
                    <div className="text-neutral-400 font-mono text-[10px] uppercase">{item.label}</div>
                    <div className="text-lg font-bold text-[#E8E6E1] mt-1">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!mi && !latest && (
        <div style={{ background: "#0F1319", border: "1px solid #1e2a3d", borderRadius: 4, padding: "48px", textAlign: "center" }}>
          <SlidersHorizontal size={32} className="mx-auto text-neutral-400 mb-3" />
          <p className="text-sm text-[#6B7585]">Market adjustments will appear once projection data is available.</p>
        </div>
      )}
    </div>
  );

  const renderCalibrationTab = () => (
    <div className="space-y-6">
      <div style={{ background: "#0F1319", border: "1px solid #1e2a3d", borderRadius: 4, padding: 20 }}>
        <div className="flex items-center gap-3 mb-4">
          <Database size={18} className="text-neutral-400" />
          <div>
            <h3 className="text-lg font-bold text-[#E8E6E1]">Data Library Calibration</h3>
            <p className="text-xs text-[#6B7585] mt-0.5">
              {calibration?.calibrated
                ? `${calibration.sampleCount} deal${calibration.sampleCount !== 1 ? 's' : ''} in this submarket contributing to calibration${calibration.dataLibraryFileCount > 0 ? ` | ${calibration.dataLibraryFileCount} Data Library file${calibration.dataLibraryFileCount !== 1 ? 's' : ''}` : ''}`
                : 'No submarket calibration data yet — upload weekly reports to teach the engine'}
            </p>
          </div>
          {calibration?.calibrated && (
            <span className="text-[10px] bg-emerald-900/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono ml-auto">CALIBRATED</span>
          )}
        </div>

        {calibration?.calibrated && Object.keys(calibration.comparisons).length > 0 ? (
          <div className="space-y-3">
            <div className="text-neutral-400 font-mono text-[10px] uppercase mb-2">Calibrated vs Default Values</div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(calibration.comparisons).map(([metric, vals]) => {
                const isPct = metric.includes('Ratio') || metric.includes('Conversion') || metric.includes('%');
                const formatFn = (v: number) => isPct ? `${(v * 100).toFixed(1)}%` : v.toFixed(4);
                const diff = vals.calibrated - vals.default;
                const diffPct = vals.default !== 0 ? ((diff / vals.default) * 100).toFixed(0) : '0';
                const isUp = diff > 0;

                return (
                  <div key={metric} className="bg-[#0F1319] rounded-lg p-3">
                    <div className="text-[#6B7585] font-mono text-[10px] uppercase mb-2">{metric}</div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-lg font-bold text-[#E8E6E1]">{formatFn(vals.calibrated)}</div>
                        <div className="text-[11px] text-neutral-400">Default: {formatFn(vals.default)}</div>
                      </div>
                      <div className={`text-xs font-mono ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isUp ? '+' : ''}{diffPct}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3">
              {calibration.lastUpdated && (
                <div className="text-[10px] text-neutral-400">
                  Last updated: {new Date(calibration.lastUpdated).toLocaleDateString()}
                </div>
              )}
              <a
                href="/data-library"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#1e2a3d] text-[#6B7585] rounded-lg text-xs hover:bg-[#0F1319] transition-colors"
              >
                <Database size={12} /> Data Library <ExternalLink size={10} />
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Database size={32} className="mx-auto text-neutral-400 mb-3" />
            <p className="text-sm text-[#6B7585] mb-3">
              Upload weekly operating reports to build submarket-specific calibration data.
              The more deals that contribute data, the better the predictions become.
            </p>
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={triggerUpload}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-[#E8E6E1] hover:bg-[#131920] transition-colors" style={{ background: "#0F1319", border: "1px solid #1e2a3d" }}
              >
                <Upload size={14} /> Upload Weekly Report
              </button>
              <a
                href="/data-library"
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#1e2a3d] text-[#9EA8B4] rounded-lg text-sm hover:bg-[#0F1319] transition-colors"
              >
                <Database size={14} /> Open Data Library <ExternalLink size={11} />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ background: BT2.bg.terminal, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{BT_CSS}</style>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleUpload}
        style={{ display: 'none' }}
      />

      <PanelHeader
        title="TRAFFIC INTELLIGENCE"
        subtitle="M07 · LEASING VELOCITY + DEMAND SIGNALS"
        borderColor={BT2.met.physTraffic}
        metrics={[
          { l: 'P_TRAFFIC', c: BT2.met.physTraffic },
          { l: 'D_TRAFFIC', c: BT2.met.digTraffic },
          { l: 'C_TRAFFIC', c: BT2.met.compTraffic },
        ]}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {projection?.marketIntelligence && (
              <span style={{ fontSize: 8, fontWeight: 700, color: BT2.text.green, fontFamily: 'var(--bt-mono)' }}>
                OCC {((projection.periods[0]?.adjOccPct ?? 0) * 100).toFixed(0)}%
              </span>
            )}
            {dataSource === 'uploaded' && (
              <span style={{ fontSize: 8, fontWeight: 700, color: BT2.text.green, background: `${BT2.text.green}12`, border: `1px solid ${BT2.text.green}40`, padding: '1px 6px', fontFamily: 'var(--bt-mono)' }}>LIVE</span>
            )}
            {dataSource === 'blended' && (
              <span style={{ fontSize: 8, fontWeight: 700, color: BT2.met.physTraffic, background: `${BT2.met.physTraffic}12`, border: `1px solid ${BT2.met.physTraffic}40`, padding: '1px 6px', fontFamily: 'var(--bt-mono)' }}>BLENDED</span>
            )}
            {dataSource === 'predicted' && (
              <span style={{ fontSize: 8, fontWeight: 700, color: BT2.text.amber, background: `${BT2.text.amber}12`, border: `1px solid ${BT2.text.amber}40`, padding: '1px 6px', fontFamily: 'var(--bt-mono)' }}>PREDICTED</span>
            )}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'transparent', color: BT2.text.secondary, border: `1px solid ${BT2.border.subtle}`, cursor: 'pointer', fontSize: 8, fontFamily: 'var(--bt-mono)' }}>
              <Upload size={10} />
              {uploading ? 'UPLOADING...' : 'UPLOAD'}
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} style={{ display: 'none' }} />
            </label>
          </div>
        }
      />

      {loading ? (
        <div style={{ background: BT2.bg.panel, borderRadius: 8, border: `1px solid ${BT2.border.subtle}`, padding: 48, textAlign: 'center' }}>
          <div style={{ width: 28, height: 28, border: `2px solid ${BT2.text.amber}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 12, color: BT2.text.muted, fontFamily: bSans }}>Loading traffic predictions...</p>
        </div>
      ) : (
        <>
          {/* KpiTile strip — Physical / Digital / Quadrant / Trajectory */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: BT2.border.subtle, borderBottom: `1px solid ${BT2.border.subtle}`, flexShrink: 0 }}>
            <KpiTile label="PHYSICAL TRAFFIC" value={Math.round(kpiTraffic).toLocaleString()} sub={trafficTrend.text} color={BT2.met.physTraffic} spark={sparkTraffic} />
            <KpiTile label="DIGITAL TRAFFIC" value={Math.round(funnelWebsite).toLocaleString()} sub={hasHistory ? `vs ${Math.round(avg4('website_leads'))} avg` : 'Predicted'} color={BT2.met.digTraffic} spark={sparkWebsite} />
            <KpiTile label="QUADRANT SCORE" value={`${(kpiClosing * 100).toFixed(0)}pts`} sub={closingTrend.text} color={BT2.met.compTraffic} spark={sparkClosing} />
            <KpiTile label="TRAJECTORY" value={`${(kpiOcc * 100).toFixed(1)}%`} sub={occTrend.text} color={BT2.met.occupancy} spark={sparkOcc} />
          </div>

          {/* Digital-Physical Gap alert banner */}
          {mi && Math.abs((mi.digitalFactor ?? 1) - (mi.demandFactor ?? 1)) >= 0.15 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: `${BT2.text.amber}0d`, borderBottom: `1px solid ${BT2.text.amber}30`, flexShrink: 0 }}>
              <AlertCircle size={10} color={BT2.text.amber} />
              <span style={{ fontSize: 9, color: BT2.text.amber, fontFamily: 'var(--bt-mono)', fontWeight: 700 }}>DIGITAL-PHYSICAL GAP</span>
              <span style={{ fontSize: 9, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)' }}>
                Digital demand {mi.digitalFactor > mi.demandFactor ? 'outpacing' : 'lagging'} physical leasing by {Math.abs(((mi.digitalFactor ?? 1) - (mi.demandFactor ?? 1)) * 100).toFixed(0)}% — {mi.digitalSummary ?? mi.demandSummary ?? ''}
              </span>
            </div>
          )}

          <SubTabBar
            tabs={TABS.map(t => t.label.toUpperCase())}
            active={TABS.findIndex(t => t.id === activeTab)}
            setActive={(i) => setActiveTab(TABS[i].id)}
            color={BT2.met.physTraffic}
          />

          <BtTabWrapper>
            {activeTab === 'predictions' && (
              <>
                {renderPredictionsTab()}
                <TrafficPredictionsTab dealId={resolvedDealId} propertyId={propertyId} />
                {/* Traffic Intelligence Signals + Leasing Velocity panels */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: BT2.border.subtle, marginTop: 1 }}>
                  <SectionPanel title="FDOT TRAFFIC COUNTS" subtitle="State DOT ADT by period · year / count / source" borderColor={BT2.met.physTraffic}>
                    {(projection?.periods ?? []).filter(p => p.isActual).slice(0, 5).map((p, i) => {
                      const yearMatch = p.label.match(/20\d{2}/);
                      const year = yearMatch ? yearMatch[0] : `Y${i + 1}`;
                      const src = projection?.baseline_source === 'submarket_calibration' ? 'Submarket' : projection?.baseline_source === 'comp_pattern' ? 'Comp Pattern' : 'DOT/Actual';
                      return (
                        <DataRow key={i} label={year} value={Math.round(p.adjTraffic).toLocaleString()} sub={src} valueColor={BT2.met.occupancy} />
                      );
                    })}
                    {(projection?.periods ?? []).filter(p => !p.isActual).slice(0, 3).map((p, i) => {
                      const yearMatch = p.label.match(/20\d{2}/);
                      const year = yearMatch ? yearMatch[0] : `Proj ${i + 1}`;
                      return (
                        <DataRow key={`proj-${i}`} label={year} value={Math.round(p.adjTraffic).toLocaleString()} sub="Predicted" valueColor={BT2.text.amber} />
                      );
                    })}
                    {!(projection?.periods?.length) && (
                      <DataRow label="NO DATA" value="—" valueColor={BT2.text.secondary} />
                    )}
                  </SectionPanel>
                  <SectionPanel title="REVIEW SENTIMENT" subtitle="PR-01 · Overall / Maintenance / Management / Location" borderColor={BT2.met.digTraffic}>
                    <DataRow label="OVERALL SENTIMENT" value="—" valueColor={BT2.text.secondary} />
                    <DataRow label="MAINTENANCE SENTIMENT" value="—" valueColor={BT2.text.secondary} />
                    <DataRow label="MANAGEMENT SENTIMENT" value="—" valueColor={BT2.text.secondary} />
                    <DataRow label="LOCATION SENTIMENT" value="—" valueColor={BT2.text.secondary} />
                  </SectionPanel>
                </div>
              </>
            )}
            {activeTab === 'data_sources' && (
              <TrafficDataSourcesTab
                key={dataSourcesKey}
                dealId={resolvedDealId}
                onNavigateToVisibility={() => setActiveTab('visibility')}
                onDefineTradeArea={() => setShowTradeAreaPanel(true)}
              />
            )}
            {activeTab === 'comps' && <TrafficCompsTab dealId={resolvedDealId} onSelectionChange={loadData} />}
            {activeTab === 'visibility' && <VisibilityAssessmentTab dealId={resolvedDealId} propertyId={propertyId} />}
            {activeTab === 'adjustments' && renderAdjustmentsTab()}
            {activeTab === 'calibration' && renderCalibrationTab()}
            {activeTab === 'absorption' && (
              <AbsorptionScheduleTab
                dealId={resolvedDealId}
                deal={deal}
                totalUnits={projection?.periods?.[0]?.totalUnits}
                currentOccupancy={projection?.periods?.[0]?.baseOccPct}
              />
            )}
          </BtTabWrapper>
        </>
      )}

      {showTradeAreaPanel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 16 }}>
          <div style={{ background: BT2.bg.panel, borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,0.5)', width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', position: 'relative', border: `1px solid ${BT2.border.subtle}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: `1px solid ${BT2.border.subtle}` }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: BT2.text.primary, fontFamily: bSans }}>Define Trade Area</h2>
              <button
                onClick={() => setShowTradeAreaPanel(false)}
                style={{ background: BT2.bg.panelAlt, border: `1px solid ${BT2.border.subtle}`, borderRadius: 6, padding: '4px 8px', color: BT2.text.muted, cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: BT2.text.muted, fontSize: 12, fontFamily: bSans }}>Loading map...</div>}>
                <TradeAreaDefinitionPanel
                  propertyLat={dealLatLng.lat}
                  propertyLng={dealLatLng.lng}
                  onSave={handleTradeAreaSave}
                  onSkip={() => setShowTradeAreaPanel(false)}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrafficModule;
