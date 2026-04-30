import { T as BT } from '../../components/deal/bloomberg-tokens';
import { BT as BT2, BT_CSS, PanelHeader, SubTabBar, KpiTile, SectionPanel, DataRow, BtTabWrapper, TableHeader, TableRow } from '../../components/deal/bloomberg-ui';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  TrendingUp, Users, Newspaper, Building2, MapPin,
  Briefcase, Factory, ChevronDown, ChevronUp,
  AlertTriangle, RefreshCw, Activity, DollarSign, Home, Layers, Link2,
  FileText, Shield, Target, BarChart3, Zap, Crosshair, ArrowRightLeft, Eye, Trash2, CheckCircle
} from 'lucide-react';
import { apiClient } from '../../services/api.client';
import ProgrammingTab from '../../components/design/ProgrammingTab';
import KGContextPanel from '../../components/knowledge-graph/KGContextPanel';
import { useDealModule } from '../../contexts/DealModuleContext';
import UnitMixIntelligence, {
  DemandMatrix, GapAnalysis, ProgramEditor, ZoningPanel, InventorySnapshot,
  PropertyDrillDown, TrendDetail, MixMatrix, RentSFScatter, CompTable,
  computeOptimalProgram, computeProgram, computeInventory, computeGaps,
  compAvg, demandLabel, COMPS, TREND_DATA, PROGRAM_SEED, ZONING_SEED,
  UT_META, UMC,
  type Program, type UnitKey, type CompData, type ZoningData, type GapItem,
} from '../../components/deal/sections/UnitMixIntelligence';
import { useUnitMixIntelligence } from '../../hooks/useUnitMixIntelligence';
import { useTradeAreaStore } from '../../stores/tradeAreaStore';
import { useDealStore } from '../../stores/dealStore';
import { TrendsAnalysisSection } from '../../components/deal/sections/TrendsAnalysisSection';
import { EventTimelineSection } from '../../components/deal/sections/EventTimelineSection';
import OpportunityEngineSection from '../../components/deal/sections/OpportunityEngineSection';
import DealCompAnalysisTab from '../../components/deal/sections/DealCompAnalysisTab';

interface MetricCorrelation {
  id: number;
  metric_a: string;
  metric_b: string;
  geography_type: string;
  geography_id: string;
  window_months: number;
  correlation_r: number;
  lead_lag_months: number | null;
  p_value: number | null;
  sample_size: number;
  computed_at: string;
}

interface MarketIntelData {
  economy: any;
  demographics: any;
  news: any[];
  supplyContext: any;
  documentIntelligence: any;
}

interface SaleComp {
  id: string;
  recording_date: string;
  property_address: string;
  units: number;
  year_built: number;
  derived_sale_price: number;
  price_per_unit: number;
  implied_cap_rate: number | null;
  buyer_type: string;
  distance_miles: number;
}

interface SaleCompSet {
  comp_count: number;
  avg_price_per_unit: number;
  avg_implied_cap_rate: number | null;
  median_price_per_unit: number;
  median_implied_cap_rate: number | null;
  comps: SaleComp[];
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtCapRate(v: number | null): string {
  return v != null ? `${(v * 100).toFixed(2)}%` : '—';
}

function fmtSaleDate(s: string): string {
  return s ? s.slice(0, 10) : '—';
}

function fmtMi(v: number): string {
  return `${v.toFixed(2)} mi`;
}

function n(v: any): number | null {
  if (v == null) return null;
  const num = Number(v);
  return isNaN(num) ? null : num;
}

function smRent(sub: any): number | null {
  return n(sub?.avgRent) ?? n(sub?.avg_rent) ?? null;
}

function smOcc(sub: any): number | null {
  return n(sub?.avg_occupancy) ?? n(sub?.occupancy) ?? null;
}

function fmt$(val: number | null): string {
  return val != null ? `$${val.toLocaleString()}` : 'N/A';
}

function fmtPct(val: number | null): string {
  return val != null ? `${val}%` : 'N/A';
}

interface MarketIntelPageProps {
  dealId?: string;
  deal?: any;
  dealType?: string;
}

type DealMode = 'development' | 'redevelopment' | 'existing';

function resolveDealMode(dealType?: string): DealMode {
  if (!dealType) return 'development';
  const dt = dealType.toLowerCase();
  if (dt.includes('redev') || dt.includes('rehab') || dt.includes('value-add') || dt.includes('renovation')) return 'redevelopment';
  if (dt.includes('exist') || dt.includes('acquisition') || dt.includes('stabilized')) return 'existing';
  return 'development';
}

function getTabsForMode(mode: DealMode): Array<{ id: string; label: string }> {
  switch (mode) {
    case 'development':
      return [
        { id: 'overview', label: 'OVERVIEW' },
        { id: 'discovery', label: 'DISCOVERY' },
        { id: 'demand', label: 'DEMAND' },
        { id: 'comps', label: 'COMPS' },
        { id: 'trends', label: 'TRENDS' },
        { id: 'program', label: 'PROGRAM' },
        { id: 'events', label: 'EVENTS' },
      ];
    case 'redevelopment':
      return [
        { id: 'overview', label: 'OVERVIEW' },
        { id: 'discovery', label: 'DISCOVERY' },
        { id: 'positioning', label: 'POSITIONING' },
        { id: 'comps', label: 'COMPS' },
        { id: 'trends', label: 'TRENDS' },
        { id: 'repositioning', label: 'REPOSITIONING' },
        { id: 'events', label: 'EVENTS' },
      ];
    case 'existing':
      return [
        { id: 'overview', label: 'OVERVIEW' },
        { id: 'discovery', label: 'DISCOVERY' },
        { id: 'positioning', label: 'POSITIONING' },
        { id: 'comps', label: 'COMPS' },
        { id: 'trends', label: 'TRENDS' },
        { id: 'program', label: 'PROGRAM' },
        { id: 'events', label: 'EVENTS' },
      ];
  }
}

export const MarketIntelligencePage: React.FC<MarketIntelPageProps> = (outerProps) => {
  const { dealId: paramDealId } = useParams<{ dealId: string }>();
  const dealId = outerProps.dealId || paramDealId || '';
  const { updateMarketIntelligence, emitEvent, activeScenario, zoningProfile, lastEvent } = useDealModule();
  const dealMode = resolveDealMode(outerProps.dealType);
  const tabs = useMemo(() => getTabsForMode(dealMode), [dealMode]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const activeTabIndex = tabs.findIndex(t => t.id === activeTabId);
  const [data, setData] = useState<MarketIntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const lastProcessedEventRef = useRef<number>(0);

  const { activeTradeArea } = useTradeAreaStore();
  const tradeAreaId = activeTradeArea?.id;
  const developmentEnvelope = useDealStore(s => s.developmentEnvelope);
  const {
    comps: apiComps, demandScores: apiDemandScores, trends: apiTrends,
    zoning: apiZoning, program: apiProgram, loading: umLoading,
    handleProgramChange: saveProgram,
  } = useUnitMixIntelligence(dealId, tradeAreaId);

  const hasApiComps = apiComps && apiComps.length > 0;
  const hasApiTrends = apiTrends && Object.keys(apiTrends).some(k => (apiTrends as any)[k]?.length > 0);
  const umComps: CompData[] = hasApiComps ? (apiComps as CompData[]) : COMPS;
  const umTrendData = hasApiTrends ? apiTrends : TREND_DATA;

  const [umZoning, setUmZoning] = useState<ZoningData>(ZONING_SEED);
  const [umProgram, setUmProgram] = useState<Program>(PROGRAM_SEED);
  const [umDrillType, setUmDrillType] = useState<UnitKey>('twoBR');
  const [umTrendType, setUmTrendType] = useState<UnitKey>('twoBR');
  const [umFilterUT, setUmFilterUT] = useState('all');
  const [umTableUT, setUmTableUT] = useState<UnitKey>('twoBR');
  const umInitRef = useRef(false);
  const umHasDbRef = useRef(false);

  const [saleCompSet, setSaleCompSet] = useState<SaleCompSet | null>(null);
  const [saleCompsLoading, setSaleCompsLoading] = useState(false);
  const [saleCompDeletingId, setSaleCompDeletingId] = useState<string | null>(null);

  const loadSaleComps = useCallback(() => {
    if (!dealId) return;
    setSaleCompsLoading(true);
    apiClient
      .get<{ data?: SaleCompSet }>(`/api/v1/deals/${dealId}/comps`)
      .then((res) => {
        const payload = res.data?.data ?? (res.data as unknown as SaleCompSet);
        setSaleCompSet(payload ?? null);
      })
      .catch(() => setSaleCompSet(null))
      .finally(() => setSaleCompsLoading(false));
  }, [dealId]);

  useEffect(() => { loadSaleComps(); }, [loadSaleComps]);

  const handleDeleteSaleComp = useCallback(async (compId: string, address: string) => {
    if (!dealId || saleCompDeletingId) return;
    if (!window.confirm(`Remove comp "${address}" from this set?`)) return;
    setSaleCompDeletingId(compId);
    try {
      const res = await apiClient.delete<{ data?: SaleCompSet }>(`/api/v1/deals/${dealId}/comps/${compId}`);
      const payload = res.data?.data ?? (res.data as unknown as SaleCompSet);
      if (payload) setSaleCompSet(payload);
      else loadSaleComps();
    } catch { loadSaleComps(); }
    finally { setSaleCompDeletingId(null); }
  }, [dealId, saleCompDeletingId, loadSaleComps]);

  useEffect(() => {
    if (umLoading || umInitRef.current) return;
    umInitRef.current = true;
    if (apiZoning) setUmZoning(apiZoning as ZoningData);
    const hasSaved = apiProgram && typeof apiProgram === 'object' && 'totalUnits' in apiProgram && (apiProgram as Program).totalUnits > 0;
    if (hasSaved) {
      umHasDbRef.current = true;
      setUmProgram(apiProgram as Program);
    } else {
      const seedUnits = developmentEnvelope?.max_units || PROGRAM_SEED.totalUnits;
      const optimal = computeOptimalProgram(seedUnits, umComps, {
        zoning: apiZoning as ZoningData || umZoning,
        demandScores: apiDemandScores as Record<string, number> | undefined,
      });
      setUmProgram(optimal);
    }
  }, [umLoading, apiZoning, apiProgram]);

  useEffect(() => {
    if (!developmentEnvelope?.max_units || !umInitRef.current || umHasDbRef.current) return;
    const newUnits = developmentEnvelope.max_units;
    setUmProgram(prev => prev.totalUnits === newUnits ? prev : { ...prev, totalUnits: newUnits });
  }, [developmentEnvelope?.max_units]);

  const handleProgramChange = (p: Program) => {
    setUmProgram(p);
    umHasDbRef.current = true;
    saveProgram(p);
  };

  const umComputed = computeProgram(umProgram);
  const umInventory = computeInventory(umComps);
  const umGaps = computeGaps(umInventory);

  useEffect(() => {
    if (tabs.findIndex(t => t.id === activeTabId) === -1) setActiveTabId(tabs[0].id);
  }, [dealMode]);

  const hasZoningContext = !!(activeScenario && (activeScenario.maxUnits || activeScenario.maxGba));
  const zoningCode = zoningProfile?.baseDistrictCode || activeScenario?.name || null;

  useEffect(() => {
    if (!lastEvent || lastEvent.type !== 'capacity-updated') return;
    if (lastEvent.timestamp <= lastProcessedEventRef.current) return;
    lastProcessedEventRef.current = lastEvent.timestamp;
    if (data) {
      pushToContext(data);
    }
  }, [lastEvent]);

  const pushToContext = (intelData: MarketIntelData) => {
    const demographics = intelData.demographics;
    const funnel = demographics?.renterDemandFunnel;
    const census = demographics?.census;

    const recommendedMix = funnel?.recommendedMix || { studio: 0.15, oneBR: 0.45, twoBR: 0.30, threeBR: 0.10 };
    const demandPool = typeof funnel?.demandPool === 'string'
      ? parseInt(funnel.demandPool.replace(/[^0-9]/g, ''), 10) || 0
      : (funnel?.demandPool || 0);
    const captureRateRaw = typeof funnel?.captureRate === 'string'
      ? parseFloat(funnel.captureRate.replace(/[^0-9.]/g, '')) || 0
      : (funnel?.captureRate || 0);

    updateMarketIntelligence({
      recommendedMix,
      demandPool,
      captureRate: captureRateRaw,
      targetDemographic: demographics?.submarket?.name || demographics?.msa?.name || '',
      medianIncome: census?.medianIncome || 0,
      medianRent: census?.medianRent || 0,
      population: census?.population || 0,
      linkedZoningCode: zoningProfile?.baseDistrictCode || undefined,
      linkedMaxUnits: activeScenario?.maxUnits || undefined,
      linkedMaxGba: activeScenario?.maxGba || undefined,
      linkedFar: activeScenario?.appliedFar || undefined,
      linkedMaxStories: activeScenario?.maxStories || undefined,
      linkedBindingConstraint: activeScenario?.bindingConstraint || undefined,
    });

    emitEvent({
      source: 'MarketIntelligencePage',
      type: 'market-intelligence-updated',
      payload: {
        dealId,
        zoningLinked: hasZoningContext,
        zoningCode: zoningProfile?.baseDistrictCode || null,
      },
    });
  };

  const fetchData = async (refresh = false) => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/v1/deals/${dealId}/market-intelligence${refresh ? '?refresh=true' : ''}`;
      const response = await apiClient.get(url, { timeout: 60000 }) as { data?: { data?: MarketIntelData; cached?: boolean } };
      const intelData = response?.data?.data || null;
      setData(intelData);
      setCached(response?.data?.cached || false);
      if (intelData) {
        pushToContext(intelData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load market intelligence');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [dealId]);

  const narrative = useMemo(() => data ? generateNarrative(data) : null, [data]);
  const riskSignals = useMemo(() => data ? detectRiskSignals(data) : [], [data]);
  const impactMatrix = useMemo(() => data ? buildImpactMatrix(data) : null, [data]);
  const programRationale = useMemo(() => data ? buildProgramRationale(data, umGaps, umComps, dealMode, hasZoningContext, activeScenario) : null, [data, umGaps, umComps, dealMode, hasZoningContext, activeScenario]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => fetchData()} />;
  if (!data) return <ErrorState message="No data available" onRetry={() => fetchData()} />;

  const modeLabel = dealMode === 'development' ? 'DEVELOPMENT' : dealMode === 'redevelopment' ? 'REDEVELOPMENT' : 'EXISTING';
  const modeColor = dealMode === 'development' ? BT2.text.cyan : dealMode === 'redevelopment' ? BT2.text.amber : BT2.met.occupancy;

  const kpiEconomy = [
    {
      label: 'AVG RENT',
      value: smRent(data.demographics?.submarket) != null
        ? fmt$(smRent(data.demographics?.submarket))
        : data.demographics?.census?.medianRent != null
          ? `$${Number(data.demographics.census.medianRent).toLocaleString()}`
          : (data.economy?.metrics?.avgRent?.value ?? '—'),
      color: BT2.text.cyan,
      spark: (data.demographics?.submarket?.rentSeries as number[] | undefined)
          ?? (data.economy?.metrics?.avgRent?.sparkline as number[] | undefined) ?? [],
    },
    {
      label: 'OCCUPANCY',
      value: data.demographics?.submarket?.avg_occupancy != null
        ? `${data.demographics.submarket.avg_occupancy}%`
        : data.supplyContext?.marketOccupancy != null
          ? `${(data.supplyContext.marketOccupancy * 100).toFixed(1)}%`
          : '—',
      color: BT2.met.occupancy,
      spark: (data.supplyContext?.occupancySeries as number[] | undefined) ?? [],
    },
    {
      label: 'ABSORPTION',
      value: data.supplyContext?.absorption?.value ?? data.economy?.metrics?.absorption?.value ?? '—',
      color: BT2.met.economic,
      spark: (data.supplyContext?.absorptionSeries as number[] | undefined) ?? [],
    },
    {
      label: 'JOB GROWTH',
      value: data.economy?.metrics?.jobsAdded?.value ?? data.economy?.metrics?.jobGrowth?.value ?? '—',
      color: BT2.met.economic,
      spark: (data.economy?.metrics?.jobsAdded?.sparkline as number[] | undefined)
          ?? (data.economy?.metrics?.jobGrowth?.sparkline as number[] | undefined) ?? [],
    },
    {
      label: 'POPULATION GROWTH',
      value: data.economy?.metrics?.populationGrowth?.value
          ?? (data.demographics?.census as Record<string, unknown> | undefined)?.populationGrowth as string | undefined
          ?? data.economy?.metrics?.netMigration?.value
          ?? '—',
      color: BT2.text.purple,
      spark: (data.economy?.metrics?.populationGrowth?.sparkline as number[] | undefined)
          ?? (data.economy?.metrics?.netMigration?.sparkline as number[] | undefined) ?? [],
    },
  ];

  const renderOverviewTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: BT2.border.subtle }}>
      {narrative && <NarrativeSection narrative={narrative} riskSignals={riskSignals} />}
      {impactMatrix && <ImpactMatrixSection matrix={impactMatrix} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: BT2.border.subtle }}>
        <SectionPanel title="DEMAND DRIVERS" subtitle="Labour + population signals" borderColor={BT2.text.cyan}>
          <DataRow label="JOBS ADDED (12M)" value={data.economy?.metrics?.jobsAdded?.value ?? '—'} valueColor={BT2.met.economic} />
          <DataRow label="WAGE GROWTH" value={data.economy?.metrics?.wageGrowth?.value ?? '—'} valueColor={BT2.met.economic} />
          <DataRow label="NET MIGRATION" value={data.economy?.metrics?.netMigration?.value ?? '—'} valueColor={BT2.text.purple} />
          <DataRow label="ECONOMIC HEALTH" value={data.economy?.healthScore != null ? `${data.economy.healthScore}/100` : '—'} valueColor={data.economy?.healthScore >= 70 ? BT2.met.occupancy : data.economy?.healthScore >= 50 ? BT2.text.amber : BT2.text.red} />
          <DataRow label="POPULATION" value={data.demographics?.census?.population != null ? Number(data.demographics.census.population).toLocaleString() : '—'} valueColor={BT2.text.secondary} />
        </SectionPanel>
        <SectionPanel title="RENT COMP MATRIX" subtitle="Submarket benchmarks" borderColor={BT2.met.economic}>
          <DataRow label="MEDIAN RENT" value={data.demographics?.census?.medianRent != null ? `$${Number(data.demographics.census.medianRent).toLocaleString()}` : '—'} valueColor={BT2.text.cyan} />
          <DataRow label="SUBMARKET AVG RENT" value={smRent(data.demographics?.submarket) != null ? fmt$(smRent(data.demographics?.submarket)) : '—'} valueColor={BT2.text.cyan} />
          <DataRow label="RENT GROWTH" value={data.demographics?.submarket?.rentGrowth ?? data.economy?.metrics?.rentGrowth?.value ?? '—'} valueColor={BT2.met.occupancy} />
          <DataRow label="AFFORDABILITY" value={data.economy?.metrics?.affordabilityRatio?.value ?? '—'} valueColor={data.economy?.metrics?.affordabilityRatio?.status === 'green' ? BT2.met.occupancy : BT2.text.amber} />
          <DataRow label="MEDIAN INCOME" value={data.demographics?.census?.medianIncome != null ? `$${Number(data.demographics.census.medianIncome).toLocaleString()}` : '—'} valueColor={BT2.text.secondary} />
        </SectionPanel>
      </div>

      <RentCompUnitMixTable unitMix={data.demographics?.unitMixBreakdown || []} />

      <ZoningContextBar hasZoningContext={hasZoningContext} zoningCode={zoningCode} activeScenario={activeScenario} />

      {/* KG Context Panel — similar deals, market insights, zoning precedents */}
      {dealId && (
        <div style={{ background: BT2.bg.panel, borderBottom: `1px solid ${BT2.border.subtle}` }}>
          <KGContextPanel dealId={dealId} />
        </div>
      )}

      <EconomySection data={data.economy} />
      <DemographicsSection data={data.demographics} supply={data.supplyContext} />
      <NewsSection events={data.news} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, padding: '2px 10px', background: BT2.bg.header, flexShrink: 0 }}>
        {cached && <span style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>CACHED</span>}
        <button onClick={() => fetchData(true)} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 6px', fontSize: 7, color: BT2.text.cyan, background: 'transparent', border: `1px solid ${BT2.text.cyan}25`, cursor: 'pointer', fontFamily: 'var(--bt-mono)', fontWeight: 700 }}>
          <RefreshCw size={8} />REFRESH
        </button>
      </div>
    </div>
  );

  const renderDiscoveryTab = () => (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, background: BT2.bg.terminal }}>
      <DealCompAnalysisTab dealId={dealId} />
    </div>
  );

  const renderDemandTab = () => (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, background: BT2.bg.terminal }}>
      <DemandMatrix inventory={umInventory} trendData={umTrendData} />
      <GapAnalysis gaps={umGaps} />
      <InventorySnapshot inventory={umInventory} comps={umComps} />
    </div>
  );

  const renderPositioningTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: BT2.border.subtle }}>
      <PositioningScorecard data={data} umComps={umComps} umInventory={umInventory} umGaps={umGaps} dealMode={dealMode} />
      <RentCompUnitMixTable unitMix={data.demographics?.unitMixBreakdown || []} />
      <DemographicsSection data={data.demographics} supply={data.supplyContext} />
    </div>
  );

  const saleComps = saleCompSet?.comps ?? [];
  const saleCompCount = saleCompSet?.comp_count ?? saleComps.length;

  const SALE_COMP_COLS = [
    { label: 'PROPERTY',  flex: 3, color: BT2.text.secondary },
    { label: 'DATE',      flex: 1, color: BT2.text.muted },
    { label: 'PRICE',     flex: 1, color: BT2.met.financial },
    { label: '$/UNIT',    flex: 1, color: BT2.text.cyan },
    { label: 'CAP RATE',  flex: 1, color: BT2.text.amber },
    { label: 'DIST',      flex: 1, color: BT2.text.muted },
    { label: '',          flex: 0.4, color: BT2.text.muted },
  ];

  const renderCompsTab = () => (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, background: BT2.bg.terminal }}>
      <MixMatrix program={umProgram} comps={umComps} />
      <RentSFScatter program={umProgram} filterUT={umFilterUT} setFilterUT={setUmFilterUT} comps={umComps} />
      <CompTable program={umProgram} utKey={umTableUT} setUtKey={setUmTableUT} comps={umComps} />

      <SectionPanel
        title="SALE COMP TRANSACTIONS"
        subtitle={`${saleCompCount} RECORDS · PROPERTY / DATE / PRICE / $/UNIT / CAP RATE / DIST`}
        borderColor={BT2.text.amber}
      >
        {saleCompsLoading && (
          <div style={{ padding: 12, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', fontSize: 9 }}>LOADING SALE COMPS…</div>
        )}
        {!saleCompsLoading && saleComps.length === 0 && (
          <div style={{ padding: 12, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', fontSize: 9 }}>NO SALE COMP DATA</div>
        )}
        {!saleCompsLoading && saleComps.length > 0 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: BT2.border.subtle, marginBottom: 1 }}>
              <div style={{ background: BT2.bg.panel, padding: '4px 8px' }}>
                <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', letterSpacing: 0.5 }}>COMP COUNT</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: BT2.text.amber, fontFamily: 'var(--bt-mono)' }}>{saleCompCount}</div>
              </div>
              <div style={{ background: BT2.bg.panel, padding: '4px 8px' }}>
                <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', letterSpacing: 0.5 }}>AVG $/UNIT</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: BT2.met.financial, fontFamily: 'var(--bt-mono)' }}>{saleCompSet?.avg_price_per_unit ? fmtUsd(saleCompSet.avg_price_per_unit) : '—'}</div>
              </div>
              <div style={{ background: BT2.bg.panel, padding: '4px 8px' }}>
                <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', letterSpacing: 0.5 }}>MEDIAN $/UNIT</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: BT2.text.cyan, fontFamily: 'var(--bt-mono)' }}>{saleCompSet?.median_price_per_unit ? fmtUsd(saleCompSet.median_price_per_unit) : '—'}</div>
              </div>
              <div style={{ background: BT2.bg.panel, padding: '4px 8px' }}>
                <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', letterSpacing: 0.5 }}>AVG CAP RATE</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: BT2.text.amber, fontFamily: 'var(--bt-mono)' }}>{fmtCapRate(saleCompSet?.avg_implied_cap_rate ?? null)}</div>
              </div>
            </div>
            <TableHeader cols={SALE_COMP_COLS} />
            {saleComps.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <TableRow
                    index={i}
                    cells={[
                      { value: c.property_address || '—',    flex: 3, color: BT2.text.secondary, weight: 600 },
                      { value: fmtSaleDate(c.recording_date), flex: 1, color: BT2.text.muted },
                      { value: fmtUsd(c.derived_sale_price),  flex: 1, color: BT2.met.financial },
                      { value: fmtUsd(c.price_per_unit),      flex: 1, color: BT2.text.cyan },
                      { value: fmtCapRate(c.implied_cap_rate), flex: 1, color: BT2.text.amber },
                      { value: fmtMi(c.distance_miles),       flex: 1, color: BT2.text.muted },
                      { value: '', flex: 0.4 },
                    ]}
                  />
                </div>
                <button
                  onClick={() => handleDeleteSaleComp(c.id, c.property_address || 'this comp')}
                  disabled={saleCompDeletingId === c.id}
                  title="Remove comp"
                  style={{
                    position: 'absolute', right: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 20, height: 20,
                    background: 'transparent', border: 'none',
                    cursor: saleCompDeletingId === c.id ? 'wait' : 'pointer',
                    color: saleCompDeletingId === c.id ? BT2.text.muted : BT2.text.red,
                    opacity: saleCompDeletingId === c.id ? 0.4 : 0.6,
                    padding: 0, transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => { if (saleCompDeletingId !== c.id) (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                  onMouseLeave={(e) => { if (saleCompDeletingId !== c.id) (e.currentTarget as HTMLButtonElement).style.opacity = '0.6'; }}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionPanel>
    </div>
  );

  const renderProgramTab = () => (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <ProgrammingTab />
      </div>
      <div style={{ width: 420, overflowY: 'auto', borderLeft: '1px solid #1e2a3d' }}>
        <ProgramDevPanel program={umProgram} computed={umComputed} zoning={umZoning} comps={umComps} gaps={umGaps} onProgramChange={handleProgramChange} onZoningChange={setUmZoning} />
      </div>
    </div>
  );

  const renderRepositioningTab = () => (
    <ProgramRedevPanel rationale={programRationale} umComps={umComps} umGaps={umGaps} umProgram={umProgram} onProgramChange={handleProgramChange} />
  );

  const renderExistingProgramTab = () => (
    <ProgramExistingPanel umComps={umComps} />
  );

  const renderTrendsTab = () => (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, background: BT2.bg.terminal }}>
      <TrendDetail selectedType={umTrendType} onSelect={setUmTrendType} trendData={umTrendData} />
      <PropertyDrillDown selectedType={umDrillType} onSelect={setUmDrillType} comps={umComps} />
    </div>
  );

  const renderEventsTab = () => (
    <div style={{ padding: 12, overflowY: 'auto', height: '100%' }}>
      <EventTimelineSection dealId={dealId} deal={outerProps.deal} dealType={outerProps.dealType} />
    </div>
  );

  const renderTabContent = () => {
    switch (activeTabId) {
      case 'discovery': return renderDiscoveryTab();
      case 'overview': return renderOverviewTab();
      case 'demand': return renderDemandTab();
      case 'positioning': return renderPositioningTab();
      case 'comps': return renderCompsTab();
      case 'program':
        if (dealMode === 'development') return renderProgramTab();
        return renderExistingProgramTab();
      case 'repositioning': return renderRepositioningTab();
      case 'trends': return renderTrendsTab();
      case 'events': return renderEventsTab();
      default: return renderDiscoveryTab();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT2.bg.terminal }}>
      <style>{BT_CSS}</style>
      <PanelHeader
        title="MARKET INTELLIGENCE"
        subtitle={`M03 · ${modeLabel} · DEMAND + RENT + SUPPLY`}
        borderColor={modeColor}
        metrics={[
          { l: modeLabel, c: modeColor },
          { l: 'F_RENT', c: BT2.text.cyan },
          { l: 'O_ABSORB', c: BT2.met.occupancy },
          { l: 'E_JOBS', c: BT2.met.economic },
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1, background: BT2.border.subtle, borderBottom: `1px solid ${BT2.border.subtle}`, flexShrink: 0 }}>
        {kpiEconomy.map(k => (
          <KpiTile key={k.label} label={k.label} value={k.value} color={k.color} spark={k.spark} />
        ))}
      </div>

      <SubTabBar
        tabs={tabs.map(t => t.label)}
        active={activeTabIndex >= 0 ? activeTabIndex : 0}
        setActive={(i: number) => setActiveTabId(tabs[i].id)}
        color={modeColor}
      />

      <BtTabWrapper>
        {renderTabContent()}
      </BtTabWrapper>
    </div>
  );
};

function ZoneBadge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ padding: '1px 4px', fontSize: 8, fontFamily: 'var(--bt-mono)', fontWeight: 600, color: BT2.text.secondary, background: BT2.bg.panelAlt, border: `1px solid ${BT2.border.subtle}` }}>
      {children}
    </span>
  );
}

function ZoningContextBar({ hasZoningContext, zoningCode, activeScenario }: { hasZoningContext: boolean; zoningCode: string | null; activeScenario: any }) {
  if (hasZoningContext) {
    return (
      <div style={{ background: BT2.bg.header, padding: '3px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: BT2.text.violet, animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 7, fontWeight: 700, color: BT2.text.violet, letterSpacing: 0.8, fontFamily: 'var(--bt-mono)' }}>ZONING LINKED</span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {zoningCode && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '1px 4px', fontSize: 9, fontFamily: 'var(--bt-mono)', fontWeight: 700, color: BT2.text.purple, background: `${BT2.text.violet}12`, border: `1px solid ${BT2.text.violet}40` }}>
                <Layers size={8} />{zoningCode}
              </span>
            )}
            {activeScenario?.maxUnits && <ZoneBadge>{activeScenario.maxUnits.toLocaleString()} units</ZoneBadge>}
            {activeScenario?.maxGba && <ZoneBadge>{activeScenario.maxGba.toLocaleString()} SF</ZoneBadge>}
            {activeScenario?.appliedFar && <ZoneBadge>{activeScenario.appliedFar.toFixed(2)} FAR</ZoneBadge>}
            {activeScenario?.maxStories && <ZoneBadge>{activeScenario.maxStories} stories</ZoneBadge>}
            {activeScenario?.bindingConstraint && (
              <span style={{ padding: '1px 4px', fontSize: 8, fontFamily: 'var(--bt-mono)', color: BT2.text.amber, border: `1px solid ${BT2.text.amber}40` }}>
                Binding: {activeScenario.bindingConstraint}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: BT2.text.violet }}>
          <Link2 size={9} />
          <span style={{ fontSize: 7, fontFamily: 'var(--bt-mono)' }}>Property & Zoning</span>
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: BT2.bg.header, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${BT2.border.subtle}` }}>
      <div style={{ width: 4, height: 4, borderRadius: '50%', background: BT2.text.muted }} />
      <span style={{ fontSize: 8, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>Select a development path in Property & Zoning to contextualize market analysis</span>
    </div>
  );
}

function ZoningCompactPanel({ zoning, program, computed, onZoningChange }: { zoning: ZoningData; program: Program; computed: { totalSF: number; mixTotal: number; grossRevPA: number; wtdPSF: number }; onZoningChange: (z: ZoningData) => void }) {
  const mono = 'var(--bt-mono)';
  const unitUtil = zoning.maxUnits > 0 ? (program.totalUnits / zoning.maxUnits) * 100 : 0;
  const sfUtil = zoning.maxNetSF > 0 ? (computed.totalSF / zoning.maxNetSF) * 100 : 0;
  const unitOver = unitUtil > 100;
  const sfOver = sfUtil > 100;

  const utilColor = (pct: number) => pct > 100 ? BT2.text.red : pct > 88 ? BT2.text.amber : BT2.met.occupancy;

  const editableRows: Array<{ label: string; key: 'maxUnits' | 'maxNetSF' | 'maxHeight' | 'maxLotCoverage'; allowed: number; yours: number | null; util: number | null; suffix: string }> = [
    { label: 'MAX UNITS', key: 'maxUnits', allowed: zoning.maxUnits, yours: program.totalUnits, util: unitUtil, suffix: 'units' },
    { label: 'MAX NET SF', key: 'maxNetSF', allowed: zoning.maxNetSF, yours: computed.totalSF, util: sfUtil, suffix: 'SF' },
    { label: 'MAX HEIGHT', key: 'maxHeight', allowed: zoning.maxHeight, yours: null, util: null, suffix: 'fl' },
    { label: 'LOT COV', key: 'maxLotCoverage', allowed: zoning.maxLotCoverage, yours: null, util: null, suffix: '%' },
  ];

  return (
    <div style={{ background: BT2.bg.panel, borderRadius: 8, border: `1px solid ${(sfOver || unitOver) ? BT2.text.red + '60' : BT2.border.subtle}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT2.border.subtle}`, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Layers size={12} color={BT2.text.cyan} />
        <span style={{ fontSize: 9, fontWeight: 700, color: BT2.text.cyan, letterSpacing: 1, fontFamily: mono }}>M02 · ZONING</span>
        <span style={{ fontSize: 9, color: BT2.text.muted, fontFamily: mono, padding: '0 4px', background: `${BT2.text.cyan}12`, borderRadius: 3 }}>{zoning.zoningCode}</span>
        {(sfOver || unitOver) && <span style={{ fontSize: 9, fontWeight: 700, color: BT2.text.red, fontFamily: mono, marginLeft: 'auto' }}>EXCEEDED</span>}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {editableRows.map((r, i) => (
          <div key={i} style={{ padding: '7px 12px', borderBottom: i < editableRows.length - 1 ? `1px solid ${BT2.border.subtle}` : 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: BT2.text.muted, fontFamily: mono, width: 72, flexShrink: 0 }}>{r.label}</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: `${BT2.text.cyan}08`, border: `1px solid ${BT2.text.cyan}30`, borderRadius: 4, padding: '2px 6px' }}>
              <input type="number" value={r.allowed} min={1} max={9999999}
                onChange={e => onZoningChange({ ...zoning, [r.key]: Number(e.target.value) })}
                style={{ width: r.key === 'maxNetSF' ? 64 : 40, background: 'none', border: 'none', outline: 'none', color: BT2.text.primary, fontFamily: mono, fontSize: 12, fontWeight: 700, textAlign: 'right' }} />
              <span style={{ fontSize: 9, color: BT2.text.muted }}>{r.suffix}</span>
            </div>
            {r.yours !== null && r.util !== null && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 4, background: BT2.border.medium, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, r.util)}%`, height: '100%', background: utilColor(r.util), borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: utilColor(r.util), fontFamily: mono, minWidth: 36, textAlign: 'right' }}>{r.util.toFixed(0)}%</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {!sfOver && !unitOver && (
        <div style={{ padding: '6px 12px', background: BT2.bg.header, borderTop: `1px solid ${BT2.border.subtle}`, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: BT2.text.muted, fontFamily: mono }}>HEADROOM:</span>
          <span style={{ fontSize: 10, color: BT2.met.occupancy, fontFamily: mono, fontWeight: 700 }}>
            {zoning.maxUnits - program.totalUnits} units
          </span>
          <span style={{ fontSize: 10, color: BT2.met.occupancy, fontFamily: mono, fontWeight: 700 }}>
            {(zoning.maxNetSF - computed.totalSF).toLocaleString()} SF
          </span>
        </div>
      )}
    </div>
  );
}

interface ProgramRationaleData {
  headline: string;
  signals: Array<{ label: string; detail: string; impact: 'positive' | 'neutral' | 'caution' }>;
  recommendation: string;
}

function buildProgramRationale(
  data: MarketIntelData, gaps: GapItem[], comps: CompData[],
  dealMode: DealMode, hasZoning: boolean, activeScenario: any
): ProgramRationaleData {
  const eco = data.economy;
  const demo = data.demographics;
  const supply = data.supplyContext;
  const submarket = demo?.submarket;
  const signals: ProgramRationaleData['signals'] = [];

  const undersupplied = gaps.filter(g => g.gap > 2).map(g => g.label);
  const oversupplied = gaps.filter(g => g.gap < -2).map(g => g.label);
  const highDemand = gaps.filter(g => g.demandScore >= 78).map(g => g.label);

  if (undersupplied.length > 0) {
    signals.push({ label: 'SUPPLY GAP', detail: `${undersupplied.join(', ')} undersupplied in trade area — opportunity to over-index`, impact: 'positive' });
  }
  if (oversupplied.length > 0) {
    signals.push({ label: 'OVERSUPPLY RISK', detail: `${oversupplied.join(', ')} oversupplied — minimize allocation or differentiate`, impact: 'caution' });
  }
  if (highDemand.length > 0) {
    signals.push({ label: 'STRONG DEMAND', detail: `${highDemand.join(', ')} showing high demand scores (low vacancy, fast lease-up)`, impact: 'positive' });
  }

  const occ = smOcc(submarket) ?? (supply?.marketOccupancy ? supply.marketOccupancy * 100 : null);
  if (occ != null) {
    signals.push({
      label: 'OCCUPANCY',
      detail: `Submarket at ${typeof occ === 'number' ? occ.toFixed(1) : occ}% — ${(occ as number) >= 95 ? 'very tight, pricing power exists' : (occ as number) >= 92 ? 'healthy fundamentals support rent targets' : 'softening may require concession budget'}`,
      impact: (occ as number) >= 93 ? 'positive' : (occ as number) >= 90 ? 'neutral' : 'caution',
    });
  }

  const healthScore = eco?.healthScore ?? 0;
  if (healthScore > 0) {
    signals.push({
      label: 'ECONOMY',
      detail: `Health score ${healthScore}/100 — ${healthScore >= 70 ? 'strong job/wage growth supports premium rents' : healthScore >= 50 ? 'moderate growth supports market-rate rents' : 'weak economy suggests conservative rent assumptions'}`,
      impact: healthScore >= 70 ? 'positive' : healthScore >= 50 ? 'neutral' : 'caution',
    });
  }

  if (hasZoning && activeScenario?.maxUnits) {
    signals.push({
      label: 'ZONING ENVELOPE',
      detail: `${activeScenario.maxUnits} max units allowed${activeScenario.maxGba ? `, ${activeScenario.maxGba.toLocaleString()} SF GBA` : ''}${activeScenario.bindingConstraint ? ` (binding: ${activeScenario.bindingConstraint})` : ''}`,
      impact: 'neutral',
    });
  }

  if (supply?.competingProperties?.totalPipelineUnits > 500) {
    signals.push({
      label: 'PIPELINE',
      detail: `${Number(supply.competingProperties.totalPipelineUnits).toLocaleString()} units in pipeline — may pressure rents at delivery`,
      impact: supply.competingProperties.totalPipelineUnits > 1500 ? 'caution' : 'neutral',
    });
  }

  let headline = '';
  let recommendation = '';

  if (dealMode === 'development') {
    const bestType = gaps.reduce((a, b) => (a.demandScore * (1 + Math.max(0, a.gap) / 10)) > (b.demandScore * (1 + Math.max(0, b.gap) / 10)) ? a : b);
    headline = `Market signals favor ${bestType.label}-weighted program with ${healthScore >= 70 ? 'premium' : 'market-rate'} rent positioning`;
    const topPsf = comps.length > 0 ? UT_META.map(ut => { const avg = compAvg(ut.key as UnitKey, comps); return avg.sf > 0 ? avg.rent / avg.sf : 0; }) : [];
    const bestPsfIdx = topPsf.indexOf(Math.max(...topPsf));
    const bestPsfType = UT_META[bestPsfIdx >= 0 ? bestPsfIdx : 1];
    recommendation = `Optimize for ${bestType.label} allocation (highest demand + gap score). ${bestPsfType.label} delivers best rent/SF ($${topPsf[bestPsfIdx >= 0 ? bestPsfIdx : 1]?.toFixed(2) || '—'}/SF). ${undersupplied.length > 0 ? `Lean into ${undersupplied.join(' and ')} to capture unmet demand.` : 'Current comp averages suggest balanced allocation.'} ${hasZoning ? `Constrained to ${activeScenario?.maxUnits || '—'} max units by zoning.` : 'No zoning constraints linked — connect M02 for envelope-aware recommendations.'}`;
  } else if (dealMode === 'redevelopment') {
    headline = `Repositioning opportunity identified: ${undersupplied.length > 0 ? `${undersupplied.join(', ')} undersupplied` : 'market gaps available'}`;
    recommendation = `Consider converting oversupplied types (${oversupplied.length > 0 ? oversupplied.join(', ') : 'none identified'}) to capture demand in ${undersupplied.length > 0 ? undersupplied.join(', ') : 'high-demand segments'}. Target rent premium of 10–15% over current position to justify renovation costs. Focus on unit size optimization for best rent/SF.`;
  } else {
    headline = `Current positioning ${(occ as number) >= 93 ? 'strong' : (occ as number) >= 90 ? 'adequate' : 'requires attention'} relative to submarket`;
    recommendation = `${highDemand.length > 0 ? `${highDemand.join(', ')} types show strongest leasing velocity.` : 'No standout demand signals.'} ${oversupplied.length > 0 ? `Watch ${oversupplied.join(', ')} — softening demand may require adjusted pricing or concessions.` : 'Unit mix appears well-balanced against market.'} Focus on competitive rent positioning and concession management.`;
  }

  return { headline, signals, recommendation };
}

function ProgramRationale({ rationale, dealMode }: { rationale: ProgramRationaleData; dealMode: DealMode }) {
  const impactColor = { positive: BT2.met.occupancy, neutral: BT2.text.cyan, caution: BT2.text.amber };
  const impactIcon = { positive: '▲', neutral: '●', caution: '◆' };
  const modeIcon = dealMode === 'development' ? Crosshair : dealMode === 'redevelopment' ? ArrowRightLeft : Eye;
  const ModeIcon = modeIcon;
  const modeLabel = dealMode === 'development' ? 'DESIGN RATIONALE' : dealMode === 'redevelopment' ? 'REPOSITIONING RATIONALE' : 'POSITIONING ANALYSIS';

  return (
    <div style={{ background: BT2.bg.panel, borderRadius: 8, border: `1px solid ${BT2.border.subtle}`, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <ModeIcon size={13} color={BT2.text.amber} />
        <span style={{ fontSize: 10, fontWeight: 700, color: BT2.text.amber, letterSpacing: 1, fontFamily: 'var(--bt-mono)' }}>{modeLabel}</span>
        <span style={{ fontSize: 9, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>AI SYNTHESIS · MARKET + DEMAND + ZONING</span>
      </div>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BT2.text.primary, marginBottom: 10, fontFamily: 'var(--bt-mono)', lineHeight: 1.4 }}>
          {rationale.headline}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {rationale.signals.map((sig, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 10px', borderRadius: 4, background: `${impactColor[sig.impact]}08`, border: `1px solid ${impactColor[sig.impact]}20` }}>
              <span style={{ fontSize: 10, color: impactColor[sig.impact], fontFamily: 'var(--bt-mono)', flexShrink: 0, marginTop: 1 }}>{impactIcon[sig.impact]}</span>
              <div>
                <span style={{ fontSize: 9, fontWeight: 700, color: impactColor[sig.impact], fontFamily: 'var(--bt-mono)', letterSpacing: 0.5 }}>{sig.label}</span>
                <span style={{ fontSize: 10, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', marginLeft: 8 }}>{sig.detail}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 12px', borderRadius: 4, border: `1px solid ${BT2.text.cyan}25`, background: `${BT2.text.cyan}06`, fontSize: 11, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', lineHeight: 1.6 }}>
          <span style={{ color: BT2.text.cyan, fontWeight: 700, fontSize: 9, letterSpacing: 1 }}>RECOMMENDATION </span>
          {rationale.recommendation}
        </div>
      </div>
    </div>
  );
}

function PositioningScorecard({ data, umComps, umInventory, umGaps, dealMode }: { data: MarketIntelData; umComps: CompData[]; umInventory: any[]; umGaps: GapItem[]; dealMode: DealMode }) {
  const mono = 'var(--bt-mono)';
  const submarket = data.demographics?.submarket;
  const occ = smOcc(submarket);
  const rent = smRent(submarket);

  const scorecardItems = UT_META.map((ut, i) => {
    const avg = compAvg(ut.key as UnitKey, umComps);
    const gap = umGaps[i];
    const dl = demandLabel(gap?.demandScore || 0);
    return {
      type: ut.label,
      color: ut.color,
      avgRent: avg.rent,
      avgSf: avg.sf,
      psf: avg.sf > 0 ? (avg.rent / avg.sf).toFixed(2) : '—',
      vacancy: avg.vac.toFixed(1),
      dom: Math.round(avg.dom),
      demandScore: gap?.demandScore || 0,
      demandLabel: dl.label,
      demandColor: dl.color,
      gap: gap?.gap || 0,
      supplyShare: gap?.supplyShare?.toFixed(1) || '—',
    };
  });

  const title = dealMode === 'existing' ? 'COMPETITIVE POSITIONING' : 'CURRENT MARKET POSITION';
  const subtitle = dealMode === 'existing' ? 'Your rents vs market · pricing power analysis' : 'Pre-repositioning baseline · identify conversion targets';

  return (
    <div style={{ background: BT2.bg.panel }}>
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <Eye size={13} color={BT2.met.occupancy} />
        <span style={{ fontSize: 10, fontWeight: 700, color: BT2.met.occupancy, letterSpacing: 1, fontFamily: mono }}>{title}</span>
        <span style={{ fontSize: 9, color: BT2.text.muted, fontFamily: mono }}>{subtitle}</span>
      </div>

      {occ != null && rent != null && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: BT2.border.subtle, borderBottom: `1px solid ${BT2.border.subtle}` }}>
          <div style={{ background: BT2.bg.panel, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: BT2.met.occupancy, fontFamily: mono }}>{typeof occ === 'number' ? occ.toFixed(1) : occ}%</div>
            <div style={{ fontSize: 9, color: BT2.text.muted, fontFamily: mono }}>SUBMARKET OCC</div>
          </div>
          <div style={{ background: BT2.bg.panel, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: BT2.text.cyan, fontFamily: mono }}>${rent?.toLocaleString()}</div>
            <div style={{ fontSize: 9, color: BT2.text.muted, fontFamily: mono }}>AVG RENT</div>
          </div>
          <div style={{ background: BT2.bg.panel, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: BT2.text.amber, fontFamily: mono }}>{umComps.length}</div>
            <div style={{ fontSize: 9, color: BT2.text.muted, fontFamily: mono }}>COMPS TRACKED</div>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono }}>
          <thead>
            <tr style={{ background: BT2.bg.header }}>
              {['TYPE', 'AVG RENT', 'AVG SF', '$/SF', 'VAC %', 'DOM', 'SUPPLY %', 'DEMAND', 'GAP'].map(h => (
                <th key={h} style={{ fontSize: 9, fontWeight: 700, color: BT2.text.muted, letterSpacing: 0.8, padding: '6px 8px', textAlign: h === 'TYPE' ? 'left' : 'right', borderBottom: `1px solid ${BT2.border.subtle}`, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scorecardItems.map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? BT2.bg.panel : BT2.bg.header }}>
                <td style={{ padding: '6px 8px', fontWeight: 700, color: item.color, fontSize: 11 }}>{item.type}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: BT2.text.cyan, fontWeight: 700, fontSize: 11 }}>{item.avgRent > 0 ? `$${item.avgRent.toLocaleString()}` : '—'}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: BT2.text.primary, fontSize: 11 }}>{item.avgSf > 0 ? item.avgSf.toLocaleString() : '—'}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: BT2.met.occupancy, fontSize: 11 }}>${item.psf}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: parseFloat(item.vacancy) > 8 ? BT2.text.red : parseFloat(item.vacancy) > 5 ? BT2.text.amber : BT2.met.occupancy, fontSize: 11 }}>{item.vacancy}%</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: item.dom > 25 ? BT2.text.red : item.dom > 15 ? BT2.text.amber : BT2.met.occupancy, fontSize: 11 }}>{item.dom}d</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: BT2.text.secondary, fontSize: 11 }}>{item.supplyShare}%</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, color: item.demandColor, background: `${item.demandColor}18`, border: `1px solid ${item.demandColor}30` }}>{item.demandLabel.slice(0, 5)}</span>
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: item.gap > 2 ? BT2.met.occupancy : item.gap < -2 ? BT2.text.red : BT2.text.muted, fontWeight: 700, fontSize: 11 }}>{item.gap > 0 ? '+' : ''}{item.gap.toFixed(1)}pp</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RepositioningPanel({ umComps, umGaps, umProgram, data, onProgramChange }: { umComps: CompData[]; umGaps: GapItem[]; umProgram: Program; data: MarketIntelData; onProgramChange: (p: Program) => void }) {
  const mono = 'var(--bt-mono)';

  const conversions = umGaps.map((gap, i) => {
    const ut = UT_META[i];
    const avg = compAvg(ut.key as UnitKey, umComps);
    const currentMix = umProgram.units[ut.key as UnitKey].mix;
    const optimalMix = Math.max(5, Math.min(60, Math.round(
      currentMix + (gap.gap > 3 ? gap.gap * 1.5 : gap.gap < -3 ? gap.gap * 0.8 : 0)
    )));
    const currentRent = umProgram.units[ut.key as UnitKey].rent;
    const targetRent = avg.rent > 0 ? Math.round(avg.rent * 1.12) : currentRent;
    const uplift = currentRent > 0 ? ((targetRent - currentRent) / currentRent * 100).toFixed(1) : '—';
    return {
      type: ut.label,
      color: ut.color,
      key: ut.key,
      currentMix,
      optimalMix,
      mixDelta: optimalMix - currentMix,
      currentRent,
      targetRent,
      uplift,
      gap: gap.gap,
      demandScore: gap.demandScore,
      action: gap.gap > 3 ? 'EXPAND' : gap.gap < -3 ? 'REDUCE' : 'HOLD',
      actionColor: gap.gap > 3 ? BT2.met.occupancy : gap.gap < -3 ? BT2.text.red : BT2.text.muted,
    };
  });

  const applyRepositioning = () => {
    const newUnits = { ...umProgram.units };
    conversions.forEach(c => {
      (newUnits as any)[c.key] = { ...(newUnits as any)[c.key], mix: c.optimalMix, rent: c.targetRent };
    });
    const mixSum = Object.values(newUnits).reduce((s: number, u: any) => s + u.mix, 0);
    if (mixSum !== 100) {
      const maxKey = conversions.reduce((a, b) => a.optimalMix > b.optimalMix ? a : b).key;
      (newUnits as any)[maxKey].mix += 100 - mixSum;
    }
    onProgramChange({ ...umProgram, units: newUnits as any });
  };

  return (
    <div style={{ background: BT2.bg.panel, borderRadius: 8, border: `1px solid ${BT2.border.subtle}`, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ArrowRightLeft size={13} color={BT2.text.amber} />
          <span style={{ fontSize: 10, fontWeight: 700, color: BT2.text.amber, letterSpacing: 1, fontFamily: mono }}>REPOSITIONING MATRIX</span>
          <span style={{ fontSize: 9, color: BT2.text.muted, fontFamily: mono }}>CURRENT → TARGET · RENT UPLIFT</span>
        </div>
        <button onClick={applyRepositioning} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', fontSize: 9, fontWeight: 700, color: BT2.text.amber, background: `${BT2.text.amber}12`, border: `1px solid ${BT2.text.amber}40`, borderRadius: 4, cursor: 'pointer', fontFamily: mono }}>
          APPLY REPOSITIONING
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono }}>
          <thead>
            <tr style={{ background: BT2.bg.header }}>
              {['TYPE', 'ACTION', 'CURRENT MIX', 'TARGET MIX', 'Δ MIX', 'CURRENT RENT', 'TARGET RENT', 'UPLIFT'].map(h => (
                <th key={h} style={{ fontSize: 9, fontWeight: 700, color: BT2.text.muted, letterSpacing: 0.8, padding: '6px 8px', textAlign: h === 'TYPE' || h === 'ACTION' ? 'left' : 'right', borderBottom: `1px solid ${BT2.border.subtle}`, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {conversions.map((c, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? BT2.bg.panel : BT2.bg.header }}>
                <td style={{ padding: '6px 8px', fontWeight: 700, color: c.color, fontSize: 11 }}>{c.type}</td>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3, color: c.actionColor, background: `${c.actionColor}15`, border: `1px solid ${c.actionColor}30` }}>{c.action}</span>
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: BT2.text.secondary, fontSize: 11 }}>{c.currentMix}%</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: BT2.text.cyan, fontWeight: 700, fontSize: 11 }}>{c.optimalMix}%</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: c.mixDelta > 0 ? BT2.met.occupancy : c.mixDelta < 0 ? BT2.text.red : BT2.text.muted, fontWeight: 700, fontSize: 11 }}>{c.mixDelta > 0 ? '+' : ''}{c.mixDelta}pp</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: BT2.text.secondary, fontSize: 11 }}>${c.currentRent.toLocaleString()}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: BT2.text.cyan, fontWeight: 700, fontSize: 11 }}>${c.targetRent.toLocaleString()}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: BT2.met.occupancy, fontWeight: 700, fontSize: 11 }}>+{c.uplift}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const PC = {
  bg: '#0a0a0c', surface: '#111114', card: '#13131a', elevated: '#1a1a22',
  border: '#1e1e24', borderSub: '#13131a', muted: '#2a2a35',
  text: '#e2e8f0', dim: '#64748b', faint: '#64748b', accent: '#e2e8f0',
  studio: '#a855f7', oneBR: '#00e5a0', twoBR: '#22c55e', threeBR: '#f59e0b',
  subject: '#f97316', green: '#22c55e', red: '#ef4444', yellow: '#f59e0b', blue: '#00e5a0',
  purple: '#a855f7',
};
const pmono = "'JetBrains Mono','Fira Code','SF Mono',monospace";

const AMENITIES_DEV = [
  { tier: 'BASE', color: PC.green, items: [
    { name: 'Package Lockers', cost: '$45K', lift: '+$18/u', roi: '2.1yr' },
    { name: 'Fitness Center', cost: '$120K', lift: '+$25/u', roi: '1.7yr' },
    { name: 'Dog Park/Wash', cost: '$35K', lift: '+$12/u', roi: '1.0yr' },
  ]},
  { tier: 'COMPETITIVE', color: PC.yellow, items: [
    { name: 'Rooftop Lounge', cost: '$280K', lift: '+$45/u', roi: '2.2yr' },
    { name: 'Coworking Space', cost: '$180K', lift: '+$35/u', roi: '1.8yr' },
    { name: 'EV Charging (8)', cost: '$64K', lift: '+$15/u', roi: '1.4yr' },
  ]},
  { tier: 'PREMIUM', color: PC.purple, items: [
    { name: 'Pool + Cabanas', cost: '$450K', lift: '+$65/u', roi: '2.5yr' },
    { name: 'Sky Deck w/ Grills', cost: '$320K', lift: '+$50/u', roi: '2.3yr' },
  ]},
];

const AMENITY_GAP_REDEV = [
  { name: 'Package Lockers', has: false, comps: '85%', cost: '$45K', lift: '+$18/u', priority: 'HIGH' as const },
  { name: 'EV Charging', has: false, comps: '62%', cost: '$64K', lift: '+$15/u', priority: 'MED' as const },
  { name: 'Coworking Space', has: false, comps: '54%', cost: '$180K', lift: '+$35/u', priority: 'HIGH' as const },
  { name: 'Fitness Center', has: true, comps: '95%', cost: '—', lift: '—', priority: '—' as const },
  { name: 'Dog Park', has: true, comps: '78%', cost: '—', lift: '—', priority: '—' as const },
  { name: 'Rooftop Lounge', has: false, comps: '42%', cost: '$280K', lift: '+$45/u', priority: 'MED' as const },
];

const EXISTING_UNIT_MIX: Record<UnitKey, { mix: number; rent: number; vac: number }> = {
  studio:  { mix: 18, rent: 1340, vac: 6.2 },
  oneBR:   { mix: 40, rent: 1620, vac: 7.1 },
  twoBR:   { mix: 33, rent: 1890, vac: 9.8 },
  threeBR: { mix:  9, rent: 2280, vac: 13.5 },
};

const EXISTING_UNIT_TRENDS: Record<UnitKey, { direction: 'up' | 'flat' | 'down'; delta: string }> = {
  studio:  { direction: 'up',   delta: '+2.1%' },
  oneBR:   { direction: 'up',   delta: '+3.2%' },
  twoBR:   { direction: 'flat', delta: '+0.9%' },
  threeBR: { direction: 'down', delta: '-0.3%' },
};

const REDEV_SF_SEED = {
  currentSF: 289_000,
  additions: [
    { use: 'Residential',        sfAdd: 12_800, rentPSF: 1.92, capEx: 2_176_000 },
    { use: 'Amenity / Common',   sfAdd:  3_200, rentPSF: 0.00, capEx:   520_000 },
    { use: 'Structured Parking', sfAdd: 18_600, rentPSF: 0.42, capEx: 1_240_000 },
  ],
} as const;

const EXISTING_AMENITIES = [
  { key: 'pkg', name: 'Package Lockers', category: 'convenience' },
  { key: 'fitness', name: 'Fitness Center', category: 'lifestyle' },
  { key: 'dog', name: 'Dog Park/Wash', category: 'lifestyle' },
  { key: 'pool', name: 'Pool', category: 'lifestyle' },
  { key: 'cowork', name: 'Coworking Space', category: 'convenience' },
  { key: 'ev', name: 'EV Charging', category: 'infrastructure' },
  { key: 'rooftop', name: 'Rooftop Lounge', category: 'lifestyle' },
  { key: 'concierge', name: 'Concierge/Valet', category: 'service' },
];

const EXISTING_SUBJECT = {
  name: 'Subject Property', units: 320, cls: 'B+', built: 2016,
  amenities: { pkg: false, fitness: true, dog: true, pool: true, cowork: false, ev: false, rooftop: false, concierge: false } as Record<string, boolean>,
  avgRent: 1735,
};

const EXISTING_COMPS_AMENITIES = [
  { id: 'sandpiper', name: 'Sandpiper Cove', cls: 'A', units: 248, built: 2021, dist: 0.8,
    amenities: { pkg: true, fitness: true, dog: true, pool: true, cowork: true, ev: true, rooftop: true, concierge: false } as Record<string, boolean>,
    avgRent: 1892 },
  { id: 'avana', name: 'Avana Crossings', cls: 'A', units: 312, built: 2019, dist: 1.2,
    amenities: { pkg: true, fitness: true, dog: false, pool: true, cowork: true, ev: true, rooftop: false, concierge: true } as Record<string, boolean>,
    avgRent: 1830 },
  { id: 'harbour', name: 'Harbour Pointe', cls: 'B+', units: 400, built: 2017, dist: 1.5,
    amenities: { pkg: true, fitness: true, dog: true, pool: true, cowork: false, ev: false, rooftop: false, concierge: false } as Record<string, boolean>,
    avgRent: 1720 },
  { id: 'enclave', name: 'The Enclave PSL', cls: 'B', units: 180, built: 2014, dist: 2.1,
    amenities: { pkg: false, fitness: true, dog: false, pool: true, cowork: false, ev: false, rooftop: false, concierge: false } as Record<string, boolean>,
    avgRent: 1580 },
  { id: 'riverview', name: 'Riverview Apts', cls: 'A-', units: 290, built: 2020, dist: 1.8,
    amenities: { pkg: true, fitness: true, dog: true, pool: true, cowork: true, ev: true, rooftop: true, concierge: false } as Record<string, boolean>,
    avgRent: 1870 },
];

const EXISTING_SUBMARKET = {
  name: 'Port St. Lucie · West', properties: 47,
  penetration: { pkg: 72, fitness: 91, dog: 64, pool: 78, cowork: 38, ev: 42, rooftop: 22, concierge: 14 } as Record<string, number>,
};

const EXISTING_LIFT: Record<string, { cost: number; liftPerUnit: number; roi: string; tier: string }> = {
  pkg: { cost: 45000, liftPerUnit: 50, roi: '0.9yr', tier: 'BASE' },
  fitness: { cost: 120000, liftPerUnit: 25, roi: '1.7yr', tier: 'BASE' },
  dog: { cost: 35000, liftPerUnit: 12, roi: '1.0yr', tier: 'BASE' },
  pool: { cost: 450000, liftPerUnit: 65, roi: '2.5yr', tier: 'PREMIUM' },
  cowork: { cost: 180000, liftPerUnit: 35, roi: '1.8yr', tier: 'COMPETITIVE' },
  ev: { cost: 64000, liftPerUnit: 15, roi: '1.4yr', tier: 'COMPETITIVE' },
  rooftop: { cost: 280000, liftPerUnit: 45, roi: '2.2yr', tier: 'PREMIUM' },
  concierge: { cost: 95000, liftPerUnit: 30, roi: '1.1yr', tier: 'COMPETITIVE' },
};

function PDeltaBadge({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0) return <span style={{ color: PC.dim, fontSize: 9, fontFamily: pmono }}>—</span>;
  const pos = value > 0;
  const color = pos ? PC.green : PC.red;
  return (
    <span style={{ color, fontSize: 9, fontFamily: pmono, letterSpacing: -0.3 }}>
      {pos ? "▲" : "▼"} {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

function PMixBar({ proposed, market, color }: { proposed: number; market: number; color: string }) {
  const maxVal = Math.max(proposed, market, 50);
  const pW = (proposed / maxVal) * 100;
  const mW = (market / maxVal) * 100;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ position: "relative", height: 6, width: "100%", background: PC.bg, borderRadius: 1 }}>
        <div style={{ position: "absolute", left: `${mW}%`, top: -2, bottom: -2, width: 1, background: PC.dim, zIndex: 2, opacity: 0.6 }} />
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pW}%`, background: color, borderRadius: 1, opacity: 0.8, transition: "width 0.3s ease" }} />
      </div>
      <div style={{ fontSize: 7, fontFamily: pmono, color: PC.faint, marginTop: 2, letterSpacing: 0.3 }}>MKT {market.toFixed(0)}%</div>
    </div>
  );
}

function PEnvelopeGauge({ used, total, label }: { used: number; total: number; label: string }) {
  const u = used ?? 0;
  const t = total ?? 0;
  const pct = t > 0 ? (u / t) * 100 : 0;
  const remaining = t - u;
  const isOver = t > 0 && u > t;
  const barColor = t === 0 ? PC.dim : isOver ? PC.red : pct > 90 ? PC.yellow : PC.green;
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: 8, fontFamily: pmono, color: PC.faint, textTransform: "uppercase" as const, letterSpacing: 0.8 }}>{label}</span>
        <span style={{ fontSize: 9, fontFamily: pmono, color: isOver ? PC.red : PC.dim }}>
          {remaining > 0 ? `${remaining.toLocaleString()} remaining` : `${Math.abs(remaining).toLocaleString()} over`}
        </span>
      </div>
      <div style={{ height: 4, background: PC.bg, borderRadius: 1, position: "relative" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: 1, transition: "width 0.3s ease" }} />
        <div style={{ position: "absolute", right: 0, top: -2, bottom: -2, width: 1, background: PC.faint, opacity: 0.4 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 9, fontFamily: pmono, color: PC.text }}>{u.toLocaleString()}</span>
        <span style={{ fontSize: 9, fontFamily: pmono, color: PC.faint }}>/ {t.toLocaleString()}</span>
      </div>
    </div>
  );
}

function PKPICell({ label, value, sub, accent, last }: { label: string; value: string | number; sub?: string; accent?: string; last?: boolean }) {
  return (
    <div style={{ flex: 1, borderRight: last ? "none" : `1px solid ${PC.border}`, padding: "6px 12px" }}>
      <div style={{ fontSize: 8, fontFamily: pmono, color: PC.faint, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontFamily: pmono, color: accent || PC.text, fontWeight: 600, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9, fontFamily: pmono, color: PC.dim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function PenBar({ pct, color, width = 40 }: { pct: number; color: string; width?: number }) {
  return (
    <div style={{ width, height: 4, background: PC.muted, borderRadius: 1, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 1, opacity: 0.8 }} />
    </div>
  );
}

function Pill({ children, color = PC.blue }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontFamily: pmono, backgroundColor: `${color}18`, color, border: `1px solid ${color}40`, borderRadius: 2, padding: '1px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', display: 'inline-block' }}>
      {children}
    </span>
  );
}

function SectionLabel({ label, accent = PC.blue }: { label: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{ width: 3, height: 14, backgroundColor: accent, borderRadius: 1, flexShrink: 0 }} />
      <span style={{ fontFamily: pmono, color: PC.dim, fontSize: 9, letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase' as const }}>{label}</span>
    </div>
  );
}

type ComputedProgram = { totalSF: number; mixTotal: number; grossRevPA: number; wtdPSF: number };

function ProgramDevPanel({ program, computed, zoning, comps, gaps, onProgramChange, onZoningChange: _onZoningChange }: {
  program: Program; computed: ComputedProgram; zoning: ZoningData; comps: CompData[]; gaps: GapItem[];
  onProgramChange: (p: Program) => void; onZoningChange: (z: ZoningData) => void;
}) {
  const [optimizing, setOptimizing] = useState(false);
  const [showRationale, setShowRationale] = useState(false);

  const totalUnits = program.totalUnits;
  const maxUnits = zoning.maxUnits;
  const totalSF = computed.totalSF;
  const maxSF = zoning.maxNetSF;
  const grossRev = UT_META.reduce((s: number, ut: any) => {
    const u = program.units[ut.key as UnitKey];
    if (!u) return s;
    return s + Math.round(totalUnits * u.mix / 100) * u.rent * 12;
  }, 0);
  const avgRent = grossRev / 12 / (totalUnits || 1);
  const avgPSF = totalSF > 0 ? grossRev / 12 / totalSF : 0;

  const unitRows = UT_META.map(ut => {
    const u = program.units[ut.key as UnitKey] ?? { mix: 0, sf: 0, rent: 0 };
    const avg = compAvg(ut.key as UnitKey, comps);
    const count = Math.round(totalUnits * u.mix / 100);
    const annualRev = u.rent * count * 12;
    const psfRent = u.sf > 0 ? u.rent / u.sf : 0;
    const mixDelta = avg.mix > 0 ? u.mix - avg.mix : 0;
    const rentDelta = avg.rent > 0 ? u.rent - avg.rent : 0;
    const sfDelta = avg.sf > 0 ? u.sf - avg.sf : 0;
    return { ...ut, u, avg, count, annualRev, psfRent, mixDelta, rentDelta, sfDelta };
  });

  function applyOptimalMix() {
    const demandScores: Record<string, number> = {};
    gaps.forEach(g => { demandScores[g.key] = g.demandScore; });
    const optimal = computeOptimalProgram(totalUnits, comps, { zoning: { maxUnits: zoning.maxUnits, maxNetSF: zoning.maxNetSF }, demandScores });
    onProgramChange(optimal);
    setShowRationale(true);
  }

  function resetProgram() {
    const base = computeOptimalProgram(zoning.maxUnits > 0 ? Math.min(PROGRAM_SEED.totalUnits, zoning.maxUnits) : PROGRAM_SEED.totalUnits, comps, { zoning: { maxUnits: zoning.maxUnits, maxNetSF: zoning.maxNetSF } });
    onProgramChange(base);
    setShowRationale(false);
  }

  const rationaleSignals: Array<{ label: string; color: string; text: string }> = showRationale ? (() => {
    const sorted = [...gaps].sort((a, b) => b.demandScore - a.demandScore);
    const topDemand = sorted.slice(0, 2);
    const undersupplied = gaps.filter(g => g.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 2);
    const maxU = maxUnits ?? 0;
    const signals: Array<{ label: string; color: string; text: string }> = [];
    if (topDemand.length > 0) {
      const labels = topDemand.map(g => UT_META.find(u => u.key === g.key)?.label ?? g.key);
      signals.push({ label: 'DEMAND', color: PC.blue, text: `${labels.join(' + ')} lead on demand (${topDemand.map(g => g.demandScore).join(', ')} pts). Mix weighted toward these types to maximize lease-up velocity.` });
    }
    if (undersupplied.length > 0) {
      const labels = undersupplied.map(g => UT_META.find(u => u.key === g.key)?.label ?? g.key);
      signals.push({ label: 'SUPPLY GAP', color: PC.green, text: `${labels.join(' + ')} are undersupplied vs. market demand (${undersupplied.map(g => `+${g.gap.toFixed(1)}pp gap`).join(', ')}). Overweighting these types captures near-term absorption.` });
    }
    if (comps.length > 0 && topDemand.length > 0) {
      const topKey = topDemand[0].key as UnitKey;
      const topAvg = compAvg(topKey, comps);
      const progRent = program.units[topKey].rent;
      if (topAvg.rent > 0) {
        const rentDelta = topAvg.rent - progRent;
        const pct = Math.abs(Math.round((rentDelta / topAvg.rent) * 100));
        const topLabel = UT_META.find(u => u.key === topKey)?.label ?? topKey;
        const direction = rentDelta > 0 ? 'above' : 'below';
        signals.push({ label: 'COMPS', color: PC.blue, text: `${topLabel} comp avg is $${topAvg.rent.toLocaleString()}/mo — program rent of $${progRent.toLocaleString()}/mo is ${pct}% ${direction} market. ${rentDelta > 50 ? 'Consider increasing ask to capture achievable rents.' : rentDelta < -50 ? 'Comp benchmark suggests current ask may be aggressive.' : 'Program is well-aligned with submarket comps.'}` });
      }
    }
    if (maxU > 0) {
      const withinEnv = totalUnits <= maxU;
      signals.push({ label: 'ZONING', color: withinEnv ? PC.yellow : PC.red, text: withinEnv ? `${totalUnits}u fits within ${zoning.zoningCode ?? 'zoning'} envelope at ${Math.round((totalUnits / maxU) * 100)}% utilization (${maxU - totalUnits} units of headroom remaining).` : `Program exceeds ${zoning.zoningCode ?? 'zoning'} by ${totalUnits - maxU}u — consider reducing total count or seeking a variance.` });
    }
    return signals;
  })() : [];

  const demandSignals = UT_META.map(ut => {
    const g = gaps.find(x => x.key === ut.key);
    const gapVal = g?.gap ?? 0;
    const signal = gapVal > 3 ? 'UNDERSUPPLIED' : gapVal > 0.5 ? 'GAP PLAY' : gapVal > -2 ? 'COMPETITIVE' : 'OVERSUPPLIED';
    const signalColor = gapVal > 3 ? PC.green : gapVal > 0.5 ? PC.blue : gapVal > -2 ? PC.yellow : PC.dim;
    const avg = compAvg(ut.key as UnitKey, comps);
    const proposed = program.units[ut.key as UnitKey]?.mix ?? 0;
    const note = avg.mix > 0 ? `Comp avg ${avg.mix.toFixed(1)}% · Proposed ${proposed}%` : `Proposed ${proposed}%`;
    const delta = gapVal > 0 ? `+${gapVal.toFixed(1)}pp demand gap` : gapVal < 0 ? `${gapVal.toFixed(1)}pp gap` : 'At parity';
    return { abbr: ut.abbr, signal, note, delta, color: signalColor, key: ut.key };
  });

  const withinEnvelope = totalUnits <= (maxUnits || Infinity) && (maxSF === 0 || totalSF <= maxSF);

  const leaseUpRows = totalUnits > 0 ? [
    { month: 'Mo 1–3',  absorption: 18, cumulative: 54,  pct: Math.round(54 / totalUnits * 100) },
    { month: 'Mo 4–6',  absorption: 22, cumulative: 120, pct: Math.round(120 / totalUnits * 100) },
    { month: 'Mo 7–9',  absorption: 20, cumulative: 180, pct: Math.round(180 / totalUnits * 100) },
    { month: 'Mo 10–12', absorption: 16, cumulative: 228, pct: Math.round(228 / totalUnits * 100) },
  ] : [
    { month: 'Mo 1–3',  absorption: 0, cumulative: 0,  pct: 0 },
    { month: 'Mo 4–6',  absorption: 0, cumulative: 0, pct: 0 },
    { month: 'Mo 7–9',  absorption: 0, cumulative: 0, pct: 0 },
    { month: 'Mo 10–12', absorption: 0, cumulative: 0, pct: 0 },
  ];

  return (
    <div style={{ backgroundColor: PC.bg, color: PC.text, fontFamily: '"IBM Plex Sans", system-ui, sans-serif', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
      <div style={{ padding: '7px 14px', borderBottom: `1px solid ${PC.border}`, backgroundColor: PC.surface, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: pmono, fontSize: 9, color: PC.blue, letterSpacing: '0.12em', fontWeight: 700 }}>F3</span>
        <span style={{ color: PC.border }}>|</span>
        <span style={{ fontFamily: pmono, fontSize: 10, fontWeight: 700, color: PC.text, letterSpacing: '0.06em' }}>MARKET INTELLIGENCE</span>
        <Pill color={PC.blue}>DEVELOPMENT</Pill>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: pmono, color: PC.dim, fontSize: 9 }}>{zoning.zoningCode || '—'}</span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 20px' }}>
          <div style={{ backgroundColor: `${PC.blue}08`, border: `1px solid ${PC.blue}30`, borderRadius: 2, padding: '8px 12px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={12} color={PC.blue} />
              <span style={{ fontFamily: pmono, color: PC.dim, fontSize: 9, letterSpacing: '0.08em' }}>PROGRAM DRIVEN BY F3 DEMAND + F2 ZONING ENVELOPE</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center', marginTop: 5 }}>
              {([
                ['DEVELOPMENT', PC.blue],
                ['→', PC.dim],
                [`${maxUnits > 0 ? maxUnits : totalUnits}u max · ${maxSF > 0 ? (maxSF / 1000).toFixed(0) + 'K' : '—'} SF`, PC.dim],
                ['·', PC.faint],
                ['2BR/3BR undersupplied vs comps', PC.green],
                ['·', PC.faint],
                [`Gross rev $${(grossRev / 1e6).toFixed(2)}M/yr`, PC.dim],
              ] as [string, string][]).map(([t, col], i) => (
                <span key={i} style={{ fontFamily: pmono, color: col, fontSize: 10, fontWeight: t === 'DEVELOPMENT' ? 700 : 400 }}>{t}</span>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, padding: '10px 12px', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <PEnvelopeGauge used={totalUnits} total={maxUnits} label="Unit envelope" />
              <div style={{ width: 1, background: PC.border }} />
              <PEnvelopeGauge used={totalSF} total={maxSF} label="SF envelope" />
            </div>
          </div>

          <div style={{ display: 'flex', borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden', marginBottom: 14 }}>
            <PKPICell label="Total units" value={totalUnits} sub={`of ${maxUnits} max`} />
            <PKPICell label="Net SF" value={totalSF.toLocaleString()} sub={`${Math.round(totalSF / (totalUnits || 1))} avg/unit`} />
            <PKPICell label="Gross rev" value={`$${(grossRev / 1e6).toFixed(2)}M`} sub="annual" accent={PC.green} />
            <PKPICell label="Avg rent" value={`$${avgRent.toFixed(0)}`} sub="/unit/mo" />
            <PKPICell label="Avg $/SF" value={`$${avgPSF.toFixed(2)}`} sub="/mo" last />
          </div>

          <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '6px 12px', borderBottom: `1px solid ${PC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel label="Unit Program — M03" accent={PC.blue} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <button onClick={() => { setOptimizing(true); applyOptimalMix(); setTimeout(() => setOptimizing(false), 1500); }}
                  style={{ padding: '3px 8px', border: `1px solid ${PC.blue}33`, borderRadius: 2, cursor: 'pointer', fontSize: 8, fontFamily: pmono, letterSpacing: 0.5, fontWeight: 700, background: optimizing ? `${PC.blue}15` : 'transparent', color: PC.blue }}>
                  {optimizing ? 'OPTIMIZING...' : 'AI OPTIMIZE'}
                </button>
                <button onClick={resetProgram} style={{ padding: '3px 8px', border: `1px solid ${PC.border}`, borderRadius: 2, cursor: 'pointer', background: 'transparent', fontSize: 8, fontFamily: pmono, color: PC.faint, fontWeight: 700 }}>RESET</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '72px 120px 1fr 1fr 70px 80px 20px', padding: '4px 12px', borderBottom: `1px solid ${PC.border}`, backgroundColor: PC.bg }}>
              {['Type', 'Mix %', 'Avg SF', 'Rent', '$/SF', 'Rev', ''].map((h, i) => (
                <span key={i} style={{ fontSize: 8, fontFamily: pmono, color: PC.faint, textTransform: 'uppercase' as const, letterSpacing: 0.8 }}>{h}</span>
              ))}
            </div>
            {unitRows.map((row, ri) => (
              <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '72px 120px 1fr 1fr 70px 80px 20px', alignItems: 'center', padding: '9px 12px', borderBottom: ri < unitRows.length - 1 ? `1px solid ${PC.borderSub}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 3, height: 24, background: row.color, borderRadius: 1 }} />
                  <div>
                    <div style={{ fontSize: 11, fontFamily: pmono, color: PC.text, fontWeight: 600 }}>{row.label}</div>
                    <div style={{ fontSize: 9, fontFamily: pmono, color: PC.faint }}>{row.count}u</div>
                  </div>
                </div>
                <div style={{ paddingRight: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 1 }}>
                    <span style={{ fontSize: 12, fontFamily: pmono, color: PC.text, fontWeight: 600 }}>{row.u.mix}%</span>
                    <PDeltaBadge value={row.mixDelta} suffix="pp" />
                  </div>
                  <PMixBar proposed={row.u.mix} market={row.avg.mix} color={row.color} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: PC.bg, border: `1px solid ${PC.border}`, borderRadius: 2, padding: '2px 6px' }}>
                    <span style={{ fontSize: 8, fontFamily: pmono, color: PC.faint }}>SF</span>
                    <span style={{ fontSize: 11, fontFamily: pmono, color: PC.text, fontWeight: 600 }}>{row.u.sf.toLocaleString()}</span>
                  </div>
                  <PDeltaBadge value={row.sfDelta} suffix=" sf" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: PC.bg, border: `1px solid ${PC.border}`, borderRadius: 2, padding: '2px 6px' }}>
                    <span style={{ fontSize: 8, fontFamily: pmono, color: PC.faint }}>$</span>
                    <span style={{ fontSize: 11, fontFamily: pmono, color: PC.text, fontWeight: 600 }}>{row.u.rent.toLocaleString()}</span>
                  </div>
                  <PDeltaBadge value={row.rentDelta} />
                </div>
                <div>
                  <span style={{ fontSize: 12, fontFamily: pmono, color: PC.accent, fontWeight: 600 }}>${row.psfRent.toFixed(2)}</span>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <span style={{ fontSize: 11, fontFamily: pmono, color: row.color, fontWeight: 600 }}>${(row.annualRev / 1e3).toFixed(0)}K</span>
                </div>
                <div>
                  <div style={{ height: 20, width: 4, background: PC.bg, borderRadius: 1, position: 'relative' as const, display: 'inline-block' }}>
                    <div style={{ position: 'absolute' as const, bottom: 0, width: '100%', borderRadius: 1, height: `${Math.min(100, (row.annualRev / 2800000) * 100)}%`, background: row.color, opacity: 0.7 }} />
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '72px 120px 1fr 1fr 70px 80px 20px', padding: '7px 12px', borderTop: `2px solid ${PC.border}`, backgroundColor: PC.bg }}>
              <span style={{ fontSize: 8, fontFamily: pmono, color: PC.faint, letterSpacing: 0.5 }}>TOTAL</span>
              <span style={{ fontSize: 11, fontFamily: pmono, color: PC.text, fontWeight: 600 }}>100%</span>
              <span style={{ fontSize: 11, fontFamily: pmono, color: PC.text }}>{Math.round(totalSF / (totalUnits || 1))} avg</span>
              <span style={{ fontSize: 11, fontFamily: pmono, color: PC.text }}>${avgRent.toFixed(0)} avg</span>
              <span style={{ fontSize: 11, fontFamily: pmono, color: PC.accent, fontWeight: 600 }}>${avgPSF.toFixed(2)}</span>
              <span style={{ fontSize: 11, fontFamily: pmono, color: PC.green, fontWeight: 700, textAlign: 'right' as const }}>${(grossRev / 1e6).toFixed(2)}M</span>
              <div />
            </div>
            <div style={{ padding: '8px 12px', borderTop: `1px solid ${PC.border}`, backgroundColor: PC.card }}>
              <div style={{ fontSize: 8, fontFamily: pmono, color: PC.faint, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 5 }}>Revenue composition</div>
              <div style={{ display: 'flex', height: 5, borderRadius: 1, overflow: 'hidden', gap: 1 }}>
                {unitRows.map(r => {
                  const pct = grossRev > 0 ? (r.annualRev / grossRev) * 100 : 0;
                  return <div key={r.key} style={{ width: `${pct}%`, background: r.color, opacity: 0.75 }} />;
                })}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                {unitRows.map(r => {
                  const pct = grossRev > 0 ? (r.annualRev / grossRev) * 100 : 0;
                  return (
                    <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: 5, height: 5, background: r.color, borderRadius: 1, opacity: 0.75 }} />
                      <span style={{ fontSize: 8, fontFamily: pmono, color: PC.dim }}>{r.label} {pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {showRationale && rationaleSignals.length > 0 && (
            <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, padding: '10px 12px', marginBottom: 14, borderLeft: `3px solid ${PC.blue}50` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <SectionLabel label="AI — Why this mix" accent={PC.blue} />
                <button onClick={() => setShowRationale(false)} style={{ fontSize: 8, fontFamily: pmono, color: PC.faint, background: 'transparent', border: 'none', cursor: 'pointer' }}>DISMISS ×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                {rationaleSignals.map(sig => (
                  <div key={sig.label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 7, fontFamily: pmono, color: sig.color, fontWeight: 700, flexShrink: 0, letterSpacing: '0.06em', minWidth: 70, paddingTop: 1 }}>{sig.label}</span>
                    <span style={{ fontSize: 8, fontFamily: pmono, color: PC.dim, lineHeight: 1.5 }}>{sig.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${PC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel label="Amenity Package Builder — New Construction" accent={PC.blue} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <span style={{ color: PC.faint, fontSize: 8, fontFamily: pmono }}>TOTAL COST</span>
                <span style={{ color: PC.yellow, fontFamily: pmono, fontSize: 10, fontWeight: 700 }}>$1.49M</span>
                <span style={{ color: PC.faint, fontSize: 8, fontFamily: pmono }}>EST LIFT</span>
                <span style={{ color: PC.green, fontFamily: pmono, fontSize: 10, fontWeight: 700 }}>+$265/u</span>
              </div>
            </div>
            {AMENITIES_DEV.map((tier, ti) => (
              <div key={tier.tier}>
                <div style={{ padding: '3px 12px', backgroundColor: PC.bg, borderBottom: `1px solid ${PC.border}`, borderTop: ti > 0 ? `1px solid ${PC.border}` : 'none' }}>
                  <Pill color={tier.color}>{tier.tier}</Pill>
                </div>
                {tier.items.map((item, ii) => (
                  <div key={ii} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 50px 24px', padding: '5px 12px', borderBottom: `1px solid ${PC.border}22`, alignItems: 'center' }}>
                    <span style={{ color: PC.text, fontSize: 10 }}>{item.name}</span>
                    <span style={{ color: PC.dim, fontFamily: pmono, fontSize: 8, textAlign: 'right' as const }}>{item.cost}</span>
                    <span style={{ color: PC.green, fontFamily: pmono, fontSize: 8, fontWeight: 700, textAlign: 'right' as const }}>{item.lift}</span>
                    <span style={{ color: PC.faint, fontFamily: pmono, fontSize: 7, textAlign: 'right' as const }}>{item.roi}</span>
                    <div style={{ textAlign: 'center' as const }}>
                      <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 3px', borderRadius: 2, backgroundColor: PC.green + '18', color: PC.green, border: `1px solid ${PC.green}40` }}>✓</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: 240, borderLeft: `1px solid ${PC.border}`, flexShrink: 0, backgroundColor: PC.bg, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
          <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '7px 10px', borderBottom: `1px solid ${PC.border}` }}>
              <SectionLabel label="Demand Signals" accent={PC.blue} />
            </div>
            <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {demandSignals.map(ds => (
                <div key={ds.key} style={{ paddingBottom: 6, borderBottom: `1px solid ${PC.border}22` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontFamily: pmono, fontSize: 10, fontWeight: 700, color: ds.color }}>{ds.abbr}</span>
                    <Pill color={ds.color}>{ds.signal}</Pill>
                  </div>
                  <div style={{ fontFamily: pmono, fontSize: 8, color: PC.dim, marginBottom: 1 }}>{ds.note}</div>
                  <div style={{ fontFamily: pmono, fontSize: 8, color: ds.color, fontWeight: 700 }}>{ds.delta}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '7px 10px', borderBottom: `1px solid ${PC.border}` }}>
              <SectionLabel label="Zoning Envelope" accent={PC.yellow} />
            </div>
            <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
              {[
                ['Zone', zoning.zoningCode || '—'],
                ['Max Units', maxUnits > 0 ? maxUnits.toLocaleString() : '—'],
                ['Max Net SF', maxSF > 0 ? maxSF.toLocaleString() + ' SF' : '—'],
                ['Proposed', `${totalUnits}u · ${totalSF.toLocaleString()} SF`],
              ].map(([label, val]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: pmono, fontSize: 8, color: PC.dim }}>{label}</span>
                  <span style={{ fontFamily: pmono, fontSize: 9, color: PC.text, fontWeight: 600 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '7px 10px', borderBottom: `1px solid ${PC.border}` }}>
              <SectionLabel label="Lease-Up Forecast" accent={PC.purple} />
            </div>
            <div style={{ padding: '6px 10px' }}>
              {leaseUpRows.map(row => (
                <div key={row.month} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontFamily: pmono, fontSize: 8, color: PC.dim }}>{row.month}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 50, height: 4, backgroundColor: PC.muted, borderRadius: 1, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(row.pct, 100)}%`, height: '100%', backgroundColor: PC.purple, opacity: 0.8, borderRadius: 1 }} />
                    </div>
                    <span style={{ fontFamily: pmono, fontSize: 8, color: PC.text, fontWeight: 700, minWidth: 28, textAlign: 'right' as const }}>{row.pct}%</span>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${PC.border}` }}>
                <div style={{ fontFamily: pmono, fontSize: 8, color: PC.dim }}>Avg absorption</div>
                <div style={{ fontFamily: pmono, fontSize: 11, color: PC.text, fontWeight: 700 }}>19 units/mo</div>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: withinEnvelope ? `${PC.green}10` : `${PC.red}10`, borderRadius: 2, border: `1px solid ${withinEnvelope ? PC.green : PC.red}30`, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <CheckCircle size={12} color={withinEnvelope ? PC.green : PC.red} />
              <span style={{ fontFamily: pmono, fontSize: 9, fontWeight: 700, color: withinEnvelope ? PC.green : PC.red }}>
                {withinEnvelope ? 'WITHIN ENVELOPE' : 'EXCEEDS ENVELOPE'}
              </span>
            </div>
            <div style={{ fontFamily: pmono, fontSize: 8, color: PC.dim }}>
              {withinEnvelope
                ? `${maxUnits - totalUnits > 0 ? maxUnits - totalUnits : 0}u headroom · ${maxSF > 0 ? (maxSF - totalSF).toLocaleString() : '—'} SF remaining`
                : [
                    totalUnits > maxUnits ? `${totalUnits - maxUnits}u over limit` : null,
                    maxSF > 0 && totalSF > maxSF ? `${(totalSF - maxSF).toLocaleString()} SF over limit` : null,
                  ].filter(Boolean).join(' · ') || `Exceeds envelope`}
            </div>
          </div>

          <button style={{ width: '100%', padding: '8px 0', border: 'none', borderRadius: 2, cursor: 'pointer', fontSize: 9, fontFamily: pmono, backgroundColor: PC.green, color: PC.bg, fontWeight: 700, letterSpacing: 0.5 }}>
            PUSH TO PROFORMA →
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgramRedevPanel({ rationale, umComps, umGaps, umProgram, onProgramChange }: {
  rationale: ProgramRationaleData | null; umComps: CompData[]; umGaps: GapItem[]; umProgram: Program; onProgramChange: (p: Program) => void;
}) {
  const [redevMode, setRedevMode] = useState<'units' | 'sf' | 'both'>('units');

  const conversions = umGaps.map((gap, i) => {
    const ut = UT_META[i];
    const avg = compAvg(ut.key as UnitKey, umComps);
    const currentMix = umProgram.units[ut.key as UnitKey].mix;
    const optimalMix = Math.max(5, Math.min(60, Math.round(
      currentMix + (gap.gap > 3 ? gap.gap * 1.5 : gap.gap < -3 ? gap.gap * 0.8 : 0)
    )));
    const currentRent = umProgram.units[ut.key as UnitKey].rent;
    const targetRent = avg.rent > 0 ? Math.round(avg.rent * 1.12) : currentRent;
    const currentSf = umProgram.units[ut.key as UnitKey].sf;
    const delta = optimalMix - currentMix;
    const convCost = Math.abs(delta) > 2 ? `$${Math.round(Math.abs(delta) * 4.2)}K` : '$0';
    const absRunway = gap.demandScore > 0 ? Math.max(1, Math.round(18 / gap.demandScore)) : 24;
    return { abbr: ut.abbr, color: ut.color, key: ut.key, current: currentMix, target: optimalMix, delta, sf: currentSf, rent: currentRent, targetRent, convCost, absRunway };
  });

  const applyRepositioning = () => {
    const newUnits = { ...umProgram.units };
    conversions.forEach(c => {
      (newUnits as any)[c.key] = { ...(newUnits as any)[c.key], mix: c.target, rent: c.targetRent };
    });
    const mixSum = Object.values(newUnits).reduce((s: number, u: any) => s + u.mix, 0);
    if (mixSum !== 100) {
      const maxKey = conversions.reduce((a, b) => a.target > b.target ? a : b).key;
      (newUnits as any)[maxKey].mix += 100 - mixSum;
    }
    onProgramChange({ ...umProgram, units: newUnits as any });
  };

  const missingAmenities = AMENITY_GAP_REDEV.filter(a => !a.has);
  const amenityLift = missingAmenities.reduce((s, a) => s + (a.lift !== '—' ? parseInt(a.lift.replace('+$', '').replace('/u', ''), 10) : 0), 0);
  const totalConvCost = conversions.reduce((s, c) => s + (c.convCost !== '$0' ? parseInt(c.convCost.replace('$', '').replace('K', ''), 10) * 1000 : 0), 0);
  const avgRentLift = conversions.length > 0 ? Math.round(conversions.reduce((s, c) => s + (c.targetRent - c.rent), 0) / conversions.length) : 0;

  const demandSignals = UT_META.map(ut => {
    const g = umGaps.find(x => x.key === ut.key);
    const gapVal = g?.gap ?? 0;
    const signal = gapVal > 3 ? 'UNDERSUPPLIED' : gapVal > 0.5 ? 'GAP PLAY' : gapVal > -2 ? 'AT PARITY' : 'OVERSUPPLIED';
    const signalColor = gapVal > 3 ? PC.green : gapVal > 0.5 ? PC.blue : gapVal > -2 ? PC.yellow : PC.red;
    const delta = gapVal > 0 ? `+${gapVal.toFixed(1)}pp vs comp avg` : gapVal < 0 ? `${gapVal.toFixed(1)}pp gap` : 'At parity';
    return { abbr: ut.abbr, signal, delta, color: signalColor, key: ut.key };
  });

  return (
    <div style={{ backgroundColor: PC.bg, color: PC.text, fontFamily: '"IBM Plex Sans", system-ui, sans-serif', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
      <div style={{ padding: '7px 14px', borderBottom: `1px solid ${PC.border}`, backgroundColor: PC.surface, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: pmono, fontSize: 9, color: PC.yellow, letterSpacing: '0.12em', fontWeight: 700 }}>F3</span>
        <span style={{ color: PC.border }}>|</span>
        <span style={{ fontFamily: pmono, fontSize: 10, fontWeight: 700, color: PC.text, letterSpacing: '0.06em' }}>MARKET INTELLIGENCE</span>
        <Pill color={PC.yellow}>REDEVELOPMENT</Pill>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: pmono, color: PC.dim, fontSize: 9 }}>M03 DEMAND + F6 AMENITY GAP</span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 20px' }}>
          <div style={{ backgroundColor: `${PC.yellow}08`, border: `1px solid ${PC.yellow}30`, borderRadius: 2, padding: '8px 12px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={12} color={PC.yellow} />
              <span style={{ fontFamily: pmono, color: PC.dim, fontSize: 9, letterSpacing: '0.08em' }}>REPOSITIONING RATIONALE — M03 DEMAND + F6 AMENITY GAP MATRIX</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center', marginTop: 5 }}>
              {([
                ['REDEVELOPMENT', PC.yellow],
                ['→', PC.dim],
                ['Studio overweight vs comp avg', PC.red],
                ['·', PC.faint],
                ['2BR undersupplied — convert to absorb demand', PC.green],
              ] as [string, string][]).map(([t, col], i) => (
                <span key={i} style={{ fontFamily: pmono, color: col, fontSize: 10, fontWeight: t === 'REDEVELOPMENT' ? 700 : 400 }}>{t}</span>
              ))}
            </div>
          </div>

          {rationale && (
            <div style={{ backgroundColor: PC.card, border: `1px solid ${PC.yellow}30`, padding: '10px 12px', marginBottom: 14, borderRadius: 2 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <Pill color={PC.yellow}>AI SYNTHESIS</Pill>
                <span style={{ color: PC.text, fontSize: 10, fontWeight: 700 }}>Repositioning Rationale</span>
              </div>
              <p style={{ color: PC.dim, fontSize: 9, lineHeight: 1.6, margin: 0 }}>{rationale.recommendation}</p>
            </div>
          )}

          <div style={{ display: 'flex', borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden', marginBottom: 14 }}>
            <PKPICell label="Conv. Budget" value="$1.2M" sub={`${(totalConvCost / 1000).toFixed(0)}K computed`} accent={PC.yellow} />
            <PKPICell label="Avg Rent Lift" value={`+$${avgRentLift}/u`} sub="avg across types" accent={PC.green} />
            <PKPICell label="Est Payback" value="2.4yr" sub="blended units + amenity" />
            <PKPICell label="Amenity Lift" value={`+$${amenityLift}/u`} sub="if all gaps closed" accent={PC.green} last />
          </div>

          <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, padding: '7px 12px', marginBottom: 14, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: PC.dim, fontFamily: pmono, fontSize: 8, marginRight: 4 }}>MODE</span>
            {([{ id: 'units', label: 'ADD UNITS' }, { id: 'sf', label: 'ADD SF' }, { id: 'both', label: 'BOTH' }] as const).map(m => (
              <span key={m.id} onClick={() => setRedevMode(m.id)} style={{ padding: '3px 10px', fontSize: 8, fontWeight: 700, fontFamily: pmono, borderRadius: 2, backgroundColor: redevMode === m.id ? PC.yellow + '18' : 'transparent', color: redevMode === m.id ? PC.yellow : PC.dim, border: `1px solid ${redevMode === m.id ? PC.yellow + '50' : PC.border}`, cursor: 'pointer' }}>{m.label}</span>
            ))}
          </div>

          {(redevMode === 'units' || redevMode === 'both') && (
            <div style={{ backgroundColor: PC.card, border: `1px solid ${PC.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ padding: '7px 12px', borderBottom: `1px solid ${PC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SectionLabel label="Existing → Target Mix — M03" accent={PC.blue} />
                <button onClick={applyRepositioning} style={{ padding: '3px 10px', fontSize: 8, fontWeight: 700, color: PC.yellow, backgroundColor: `${PC.yellow}12`, border: `1px solid ${PC.yellow}40`, borderRadius: 2, cursor: 'pointer', fontFamily: pmono, marginBottom: 10 }}>APPLY REPOSITIONING</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '48px 72px 72px 52px 80px 80px 70px', padding: '3px 12px', backgroundColor: PC.bg, borderBottom: `1px solid ${PC.border}` }}>
                {['TYPE', 'CURRENT', 'TARGET', 'Δ MIX', 'RENT NOW', 'RENT TGT', 'CONV $'].map((h, i) => (
                  <div key={i} style={{ color: PC.dim, fontSize: 7, fontFamily: pmono, fontWeight: 700, textAlign: i > 0 ? 'right' as const : 'left' as const }}>{h}</div>
                ))}
              </div>
              {conversions.map(u => (
                <div key={u.abbr} style={{ display: 'grid', gridTemplateColumns: '48px 72px 72px 52px 80px 80px 70px', padding: '7px 12px', borderBottom: `1px solid ${PC.border}30`, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 4, height: 14, background: u.color, borderRadius: 1 }} />
                    <span style={{ color: u.color, fontFamily: pmono, fontSize: 9, fontWeight: 700 }}>{u.abbr}</span>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <span style={{ color: PC.dim, fontFamily: pmono, fontSize: 10 }}>{u.current}%</span>
                    <div style={{ width: '100%', height: 3, background: PC.muted, borderRadius: 1, overflow: 'hidden', marginTop: 2 }}>
                      <div style={{ width: `${u.current}%`, height: '100%', background: u.color + '40' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <span style={{ color: PC.subject, fontFamily: pmono, fontSize: 10, fontWeight: 700 }}>{u.target}%</span>
                    <div style={{ width: '100%', height: 3, background: PC.muted, borderRadius: 1, overflow: 'hidden', marginTop: 2 }}>
                      <div style={{ width: `${u.target}%`, height: '100%', background: u.color }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <span style={{ color: u.delta > 0 ? PC.green : u.delta < 0 ? PC.red : PC.dim, fontFamily: pmono, fontSize: 10, fontWeight: 700 }}>
                      {u.delta > 0 ? '+' : ''}{u.delta}pp
                    </span>
                  </div>
                  <span style={{ textAlign: 'right' as const, color: PC.dim, fontFamily: pmono, fontSize: 10 }}>${u.rent.toLocaleString()}</span>
                  <span style={{ textAlign: 'right' as const, color: PC.green, fontFamily: pmono, fontSize: 10, fontWeight: 700 }}>${u.targetRent.toLocaleString()}</span>
                  <div style={{ textAlign: 'right' as const }}>
                    {u.convCost !== '$0' ? <Pill color={PC.yellow}>{u.convCost}</Pill> : <span style={{ fontFamily: pmono, fontSize: 9, color: PC.dim }}>—</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(redevMode === 'sf' || redevMode === 'both') && (() => {
            const totalSFAdd = REDEV_SF_SEED.additions.reduce((s, a) => s + a.sfAdd, 0);
            const annualIncomeDelta = REDEV_SF_SEED.additions.reduce((s, a) => s + a.sfAdd * a.rentPSF * 12, 0);
            const totalCapEx = REDEV_SF_SEED.additions.reduce((s, a) => s + a.capEx, 0);
            const payback = annualIncomeDelta > 0 ? totalCapEx / annualIncomeDelta : 0;
            return (
              <div style={{ backgroundColor: PC.card, border: `1px solid ${PC.border}`, borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{ padding: '7px 12px', borderBottom: `1px solid ${PC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <SectionLabel label="SF Expansion — M04" accent={PC.yellow} />
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ color: PC.faint, fontSize: 8, fontFamily: pmono }}>TOTAL ADD</span>
                    <span style={{ color: PC.yellow, fontFamily: pmono, fontSize: 10, fontWeight: 700 }}>{totalSFAdd.toLocaleString()} SF</span>
                    <span style={{ color: PC.faint, fontSize: 8, fontFamily: pmono }}>PAYBACK</span>
                    <span style={{ color: PC.text, fontFamily: pmono, fontSize: 10, fontWeight: 700 }}>{payback.toFixed(1)}yr</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 70px 100px 90px', padding: '3px 12px', backgroundColor: PC.bg, borderBottom: `1px solid ${PC.border}` }}>
                  {['USE TYPE', 'CURRENT SF', '+ ADD SF', 'RENT/SF', 'ANNUAL DELTA', 'CAPEX'].map((h, i) => (
                    <div key={i} style={{ color: PC.dim, fontSize: 7, fontFamily: pmono, fontWeight: 700, textAlign: i > 0 ? 'right' as const : 'left' as const }}>{h}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 70px 100px 90px', padding: '3px 12px', backgroundColor: PC.surface, borderBottom: `1px solid ${PC.border}` }}>
                  <span style={{ color: PC.faint, fontSize: 9, fontFamily: pmono }}>Existing footprint</span>
                  <span style={{ color: PC.dim, fontFamily: pmono, fontSize: 9, textAlign: 'right' as const }}>{REDEV_SF_SEED.currentSF.toLocaleString()} SF</span>
                  {['—', '—', '—', '—'].map((v, i) => <span key={i} style={{ color: PC.faint, fontFamily: pmono, fontSize: 9, textAlign: 'right' as const }}>{v}</span>)}
                </div>
                {REDEV_SF_SEED.additions.map((row, i) => {
                  const annDelta = row.sfAdd * row.rentPSF * 12;
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 70px 100px 90px', padding: '7px 12px', borderBottom: `1px solid ${PC.border}22`, alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 3, height: 14, background: row.rentPSF > 0 ? PC.green : PC.blue, borderRadius: 1 }} />
                        <span style={{ fontSize: 10, color: PC.text }}>{row.use}</span>
                      </div>
                      <span style={{ textAlign: 'right' as const, color: PC.faint, fontFamily: pmono, fontSize: 9 }}>—</span>
                      <span style={{ textAlign: 'right' as const, color: PC.yellow, fontFamily: pmono, fontSize: 10, fontWeight: 700 }}>+{row.sfAdd.toLocaleString()}</span>
                      <span style={{ textAlign: 'right' as const, color: row.rentPSF > 0 ? PC.text : PC.faint, fontFamily: pmono, fontSize: 10 }}>{row.rentPSF > 0 ? `$${row.rentPSF.toFixed(2)}` : '—'}</span>
                      <span style={{ textAlign: 'right' as const, color: annDelta > 0 ? PC.green : PC.faint, fontFamily: pmono, fontSize: 10, fontWeight: annDelta > 0 ? 700 : 400 }}>{annDelta > 0 ? `+$${(annDelta / 1000).toFixed(0)}K` : '—'}</span>
                      <span style={{ textAlign: 'right' as const, color: PC.yellow, fontFamily: pmono, fontSize: 9 }}>${(row.capEx / 1000).toFixed(0)}K</span>
                    </div>
                  );
                })}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 70px 100px 90px', padding: '7px 12px', borderTop: `2px solid ${PC.border}`, backgroundColor: PC.card }}>
                  <span style={{ fontSize: 8, fontFamily: pmono, color: PC.faint, letterSpacing: 0.5 }}>TOTAL PROPOSED</span>
                  <span style={{ textAlign: 'right' as const, color: PC.dim, fontFamily: pmono, fontSize: 9 }}>{REDEV_SF_SEED.currentSF.toLocaleString()}</span>
                  <span style={{ textAlign: 'right' as const, color: PC.yellow, fontFamily: pmono, fontSize: 10, fontWeight: 700 }}>+{totalSFAdd.toLocaleString()}</span>
                  <span style={{ textAlign: 'right' as const, color: PC.faint, fontFamily: pmono, fontSize: 9 }}>—</span>
                  <span style={{ textAlign: 'right' as const, color: PC.green, fontFamily: pmono, fontSize: 11, fontWeight: 700 }}>+${(annualIncomeDelta / 1000).toFixed(0)}K</span>
                  <span style={{ textAlign: 'right' as const, color: PC.yellow, fontFamily: pmono, fontSize: 10, fontWeight: 700 }}>${(totalCapEx / 1e6).toFixed(2)}M</span>
                </div>
              </div>
            );
          })()}

          <div style={{ backgroundColor: PC.card, border: `1px solid ${PC.border}`, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ padding: '7px 12px', borderBottom: `1px solid ${PC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel label="Amenity Gap Analysis — F6" accent={PC.blue} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <span style={{ color: PC.faint, fontSize: 8, fontFamily: pmono }}>UPGRADE COST</span>
                <span style={{ color: PC.yellow, fontFamily: pmono, fontSize: 10, fontWeight: 700 }}>$569K</span>
                <span style={{ color: PC.faint, fontSize: 8, fontFamily: pmono }}>LIFT</span>
                <span style={{ color: PC.green, fontFamily: pmono, fontSize: 10, fontWeight: 700 }}>+$113/u</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 48px 52px 62px 62px 48px', padding: '3px 12px', backgroundColor: PC.bg, borderBottom: `1px solid ${PC.border}` }}>
              {['AMENITY', 'HAS', 'COMPS', 'COST', 'LIFT', 'PRI'].map((h, i) => (
                <div key={i} style={{ color: PC.dim, fontSize: 7, fontFamily: pmono, fontWeight: 700, textAlign: i > 0 ? 'center' as const : 'left' as const }}>{h}</div>
              ))}
            </div>
            {AMENITY_GAP_REDEV.map((a, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 48px 52px 62px 62px 48px', padding: '5px 12px', borderBottom: `1px solid ${PC.border}22`, alignItems: 'center' }}>
                <span style={{ color: PC.text, fontSize: 10 }}>{a.name}</span>
                <div style={{ textAlign: 'center' as const }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: a.has ? PC.green : PC.red }}>{a.has ? '✓' : '✗'}</span>
                </div>
                <span style={{ textAlign: 'center' as const, color: PC.dim, fontFamily: pmono, fontSize: 9 }}>{a.comps}</span>
                <span style={{ textAlign: 'center' as const, color: a.cost !== '—' ? PC.yellow : PC.dim, fontFamily: pmono, fontSize: 9 }}>{a.cost}</span>
                <span style={{ textAlign: 'center' as const, color: a.lift !== '—' ? PC.green : PC.dim, fontFamily: pmono, fontSize: 9, fontWeight: 700 }}>{a.lift}</span>
                <div style={{ textAlign: 'center' as const }}>
                  {a.priority !== '—' && (
                    <Pill color={a.priority === 'HIGH' ? PC.red : PC.yellow}>{a.priority}</Pill>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ width: 240, borderLeft: `1px solid ${PC.border}`, flexShrink: 0, backgroundColor: PC.bg, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
          <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '7px 10px', borderBottom: `1px solid ${PC.border}` }}>
              <SectionLabel label="Unit Delta Summary" accent={PC.yellow} />
            </div>
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {conversions.map(c => (
                <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 3, height: 12, background: c.color, borderRadius: 1 }} />
                    <span style={{ fontFamily: pmono, fontSize: 9, color: PC.text, fontWeight: 700 }}>{c.abbr}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: pmono, fontSize: 9, color: PC.dim }}>{c.current}%</span>
                    <span style={{ fontFamily: pmono, fontSize: 8, color: PC.dim }}>→</span>
                    <span style={{ fontFamily: pmono, fontSize: 9, color: PC.subject, fontWeight: 700 }}>{c.target}%</span>
                    <span style={{ fontFamily: pmono, fontSize: 8, fontWeight: 700, color: c.delta > 0 ? PC.green : c.delta < 0 ? PC.red : PC.dim }}>
                      {c.delta > 0 ? `+${c.delta}` : c.delta}pp
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '7px 10px', borderBottom: `1px solid ${PC.border}` }}>
              <SectionLabel label="Conversion Context" accent={PC.yellow} />
            </div>
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
              {conversions.filter(c => c.convCost !== '$0').length === 0 ? (
                <span style={{ fontFamily: pmono, fontSize: 9, color: PC.dim }}>No conversions needed</span>
              ) : conversions.filter(c => c.convCost !== '$0').map(c => (
                <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 3, height: 10, background: c.color, borderRadius: 1 }} />
                    <span style={{ fontFamily: pmono, fontSize: 9, color: PC.text, fontWeight: 700 }}>{c.abbr}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ fontFamily: pmono, fontSize: 8, color: PC.dim }}>{c.delta > 0 ? '+' : ''}{c.delta}pp</span>
                    <span style={{ fontFamily: pmono, fontSize: 9, color: PC.yellow, fontWeight: 700 }}>{c.convCost}</span>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${PC.border}`, marginTop: 3, paddingTop: 5, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: pmono, fontSize: 8, color: PC.dim }}>Total</span>
                <span style={{ fontFamily: pmono, fontSize: 9, color: PC.yellow, fontWeight: 700 }}>${(totalConvCost / 1000).toFixed(0)}K</span>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '7px 10px', borderBottom: `1px solid ${PC.border}` }}>
              <SectionLabel label="ROI Summary" accent={PC.green} />
            </div>
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
              {[
                ['Conv. Budget', '$1.2M', PC.yellow],
                ['Amenity Cost', '$569K', PC.yellow],
                ['Total CapEx', '$1.77M', PC.yellow],
                ['Rent Lift', `+$${avgRentLift}/u avg`, PC.green],
                ['Amenity Lift', `+$${amenityLift}/u`, PC.green],
                ['Blended Payback', '2.4yr', PC.text],
              ].map(([lbl, val, col]) => (
                <div key={lbl as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: pmono, fontSize: 8, color: PC.dim }}>{lbl}</span>
                  <span style={{ fontFamily: pmono, fontSize: 9, color: col as string, fontWeight: 700 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '7px 10px', borderBottom: `1px solid ${PC.border}` }}>
              <SectionLabel label="Demand Signals" accent={PC.blue} />
            </div>
            <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {demandSignals.map(ds => (
                <div key={ds.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 5, borderBottom: `1px solid ${PC.border}22` }}>
                  <span style={{ fontFamily: pmono, fontSize: 9, color: PC.text, fontWeight: 700 }}>{ds.abbr}</span>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 2 }}>
                    <Pill color={ds.color}>{ds.signal}</Pill>
                    <span style={{ fontFamily: pmono, fontSize: 7, color: PC.dim }}>{ds.delta}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: `${PC.green}10`, borderRadius: 2, border: `1px solid ${PC.green}30`, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <CheckCircle size={12} color={PC.green} />
              <span style={{ fontFamily: pmono, fontSize: 9, fontWeight: 700, color: PC.green }}>REFI ELIGIBLE AT STAB</span>
            </div>
            <div style={{ fontFamily: pmono, fontSize: 8, color: PC.dim }}>Post-reposition stabilized NOI qualifies for agency refi at ~65% LTV. Est. rate: 6.4% · 7yr term.</div>
          </div>

          <button onClick={applyRepositioning} style={{ width: '100%', padding: '8px 0', border: 'none', borderRadius: 2, cursor: 'pointer', fontSize: 9, fontFamily: pmono, backgroundColor: PC.green, color: PC.bg, fontWeight: 700, letterSpacing: 0.5 }}>
            PUSH TO PROFORMA →
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgramExistingPanel({ umComps }: { umComps: CompData[] }) {
  const [view, setView] = useState<'matrix' | 'impact'>('matrix');

  const effectiveComps = umComps.length > 0 ? umComps : COMPS;
  const unitMixRows = UT_META.map(ut => {
    const avg = compAvg(ut.key as UnitKey, effectiveComps);
    const subj = EXISTING_UNIT_MIX[ut.key as UnitKey];
    const trend = EXISTING_UNIT_TRENDS[ut.key as UnitKey];
    const rentGap = avg.rent > 0 ? avg.rent - subj.rent : 0;
    return { ...ut, avg, subj, trend, rentGap };
  });
  const topOpportunity = [...unitMixRows].sort((a, b) => b.rentGap - a.rentGap)[0];

  const compCount = EXISTING_COMPS_AMENITIES.length;
  const missingAmenities = EXISTING_AMENITIES.filter(a => !EXISTING_SUBJECT.amenities[a.key]);
  const totalMissingCost = missingAmenities.reduce((s, a) => s + EXISTING_LIFT[a.key].cost, 0);
  const totalLiftPerUnit = missingAmenities.reduce((s, a) => s + EXISTING_LIFT[a.key].liftPerUnit, 0);
  const annualLift = totalLiftPerUnit * EXISTING_SUBJECT.units * 12;
  const compPenetration = (key: string) => {
    const has = EXISTING_COMPS_AMENITIES.filter(c => c.amenities[key]).length;
    return Math.round((has / compCount) * 100);
  };

  const trendIcon = (d: 'up' | 'flat' | 'down') => d === 'up' ? '▲' : d === 'down' ? '▼' : '—';
  const trendColor = (d: 'up' | 'flat' | 'down') => d === 'up' ? PC.green : d === 'down' ? PC.red : PC.dim;

  const actionItems = missingAmenities.map(a => {
    const lift = EXISTING_LIFT[a.key];
    const cp = compPenetration(a.key);
    const urgency = cp >= 70 ? 'CRITICAL' : cp >= 50 ? 'HIGH' : cp >= 40 ? 'MEDIUM' : 'LOW';
    const urgencyColor = urgency === 'CRITICAL' ? PC.red : urgency === 'HIGH' ? PC.yellow : urgency === 'MEDIUM' ? PC.blue : PC.dim;
    return { ...a, lift, cp, urgency, urgencyColor };
  }).sort((a, b) => b.cp - a.cp);

  return (
    <div style={{ backgroundColor: PC.bg, color: PC.text, fontFamily: '"IBM Plex Sans", system-ui, sans-serif', fontSize: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>

      <div style={{ padding: '7px 14px', borderBottom: `1px solid ${PC.border}`, backgroundColor: PC.surface, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: pmono, fontSize: 9, color: PC.yellow, letterSpacing: '0.12em', fontWeight: 700 }}>F3</span>
        <span style={{ color: PC.border }}>|</span>
        <span style={{ fontFamily: pmono, fontSize: 10, fontWeight: 700, color: PC.text, letterSpacing: '0.06em' }}>MARKET INTELLIGENCE</span>
        <Pill color={PC.yellow}>EXISTING</Pill>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: pmono, color: PC.dim, fontSize: 9 }}>{EXISTING_SUBJECT.units}u · {EXISTING_SUBJECT.cls} · {EXISTING_SUBJECT.built}</span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 20px' }}>
          <div style={{ backgroundColor: `${PC.yellow}08`, border: `1px solid ${PC.yellow}30`, borderRadius: 2, padding: '8px 12px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={12} color={PC.yellow} />
              <span style={{ fontFamily: pmono, color: PC.dim, fontSize: 9, letterSpacing: '0.08em' }}>GAP ANALYSIS DRIVEN BY COMP PARITY + SUBMARKET PENETRATION</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center', marginTop: 5 }}>
              {([
                ['EXISTING', PC.blue],
                ['→', PC.dim],
                [`${missingAmenities.length} amenity gaps vs comps`, PC.yellow],
                ['·', PC.faint],
                [`Close all → +$${totalLiftPerUnit}/u/mo · $${(annualLift / 1e6).toFixed(2)}M/yr`, PC.dim],
              ] as [string, string][]).map(([t, col], i) => (
                <span key={i} style={{ fontFamily: pmono, color: col, fontSize: 10, fontWeight: t === 'EXISTING' ? 700 : 400 }}>{t}</span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden', marginBottom: 14 }}>
            <PKPICell label="Amenity Gaps" value={`${missingAmenities.length}`} sub={`of ${EXISTING_AMENITIES.length} tracked`} accent={PC.red} />
            <PKPICell label="Close Cost" value={`$${(totalMissingCost / 1000).toFixed(0)}K`} sub="all missing" accent={PC.yellow} />
            <PKPICell label="Est Lift" value={`+$${totalLiftPerUnit}/u`} sub="/mo if all closed" accent={PC.green} />
            <PKPICell label="Annual Impact" value={`$${(annualLift / 1e6).toFixed(2)}M`} sub={`across ${EXISTING_SUBJECT.units}u`} accent={PC.green} last />
          </div>

          <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ padding: '7px 12px', borderBottom: `1px solid ${PC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel label="Unit Mix — Current + Market Trends" accent={PC.blue} />
              <span style={{ fontFamily: pmono, color: PC.faint, fontSize: 8, marginBottom: 10 }}>read-only</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 60px 80px 80px 70px 60px 60px', padding: '3px 12px', backgroundColor: PC.bg, borderBottom: `1px solid ${PC.border}` }}>
              {['TYPE', 'MIX', 'YOUR RENT', 'MKT AVG', 'GAP', 'VAC', 'TREND'].map((h, i) => (
                <div key={i} style={{ color: PC.dim, fontSize: 7, fontFamily: pmono, fontWeight: 700, textAlign: i > 0 ? 'right' as const : 'left' as const }}>{h}</div>
              ))}
            </div>
            {unitMixRows.map(row => (
              <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '80px 60px 80px 80px 70px 60px 60px', padding: '7px 12px', borderBottom: `1px solid ${PC.border}22`, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 3, height: 14, background: row.color, borderRadius: 1 }} />
                  <span style={{ fontSize: 10, color: PC.text, fontWeight: 600 }}>{row.label}</span>
                </div>
                <span style={{ textAlign: 'right' as const, fontFamily: pmono, fontSize: 10, color: PC.dim }}>{row.subj.mix}%</span>
                <span style={{ textAlign: 'right' as const, fontFamily: pmono, fontSize: 10, color: PC.subject, fontWeight: 700 }}>${row.subj.rent.toLocaleString()}</span>
                <span style={{ textAlign: 'right' as const, fontFamily: pmono, fontSize: 10, color: PC.text }}>{row.avg.rent > 0 ? `$${row.avg.rent.toLocaleString()}` : '—'}</span>
                <span style={{ textAlign: 'right' as const, fontFamily: pmono, fontSize: 10, fontWeight: 700, color: row.rentGap > 0 ? PC.green : row.rentGap < 0 ? PC.red : PC.dim }}>
                  {row.rentGap > 0 ? `+$${row.rentGap.toFixed(0)}` : row.rentGap < 0 ? `-$${Math.abs(row.rentGap).toFixed(0)}` : '—'}
                </span>
                <span style={{ textAlign: 'right' as const, fontFamily: pmono, fontSize: 10, color: row.subj.vac > 10 ? PC.red : row.subj.vac > 7 ? PC.yellow : PC.green }}>{row.subj.vac}%</span>
                <div style={{ textAlign: 'right' as const }}>
                  <span style={{ fontFamily: pmono, fontSize: 9, fontWeight: 700, color: trendColor(row.trend.direction) }}>{trendIcon(row.trend.direction)}</span>
                  <span style={{ fontFamily: pmono, fontSize: 8, color: trendColor(row.trend.direction), marginLeft: 2 }}>{row.trend.delta}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '7px 12px', borderBottom: `1px solid ${PC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel label="Amenity Gap Analysis — Comp Parity + Submarket" accent={PC.blue} />
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {(['matrix', 'impact'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)} style={{
                    padding: '2px 8px', border: `1px solid ${view === v ? PC.blue + '50' : PC.border}`,
                    borderRadius: 2, cursor: 'pointer', fontSize: 7, fontFamily: pmono, fontWeight: 700,
                    backgroundColor: view === v ? PC.blue + '14' : 'transparent', color: view === v ? PC.blue : PC.faint,
                  }}>{v === 'matrix' ? 'COMP MATRIX' : 'IMPACT ANALYSIS'}</button>
                ))}
              </div>
            </div>

            {view === 'matrix' && (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 600 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: `140px 52px repeat(${compCount}, 1fr) 56px`, padding: '4px 12px', backgroundColor: PC.bg, borderBottom: `1px solid ${PC.border}` }}>
                    <span style={{ fontSize: 7, fontFamily: pmono, color: PC.faint, fontWeight: 700 }}>AMENITY</span>
                    <span style={{ fontSize: 7, fontFamily: pmono, color: PC.subject, fontWeight: 700, textAlign: 'center' as const }}>YOU</span>
                    {EXISTING_COMPS_AMENITIES.map(c => (
                      <div key={c.id} style={{ textAlign: 'center' as const, overflow: 'hidden' }}>
                        <div style={{ fontSize: 7, fontFamily: pmono, color: PC.dim, fontWeight: 700, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name.split(' ')[0]}</div>
                        <div style={{ fontSize: 6, fontFamily: pmono, color: PC.faint }}>{c.cls}</div>
                      </div>
                    ))}
                    <span style={{ fontSize: 7, fontFamily: pmono, color: PC.dim, fontWeight: 700, textAlign: 'center' as const }}>COMP %</span>
                  </div>
                  {EXISTING_AMENITIES.map((a, ri) => {
                    const subjectHas = EXISTING_SUBJECT.amenities[a.key];
                    const cp = compPenetration(a.key);
                    const isMissing = !subjectHas;
                    const isHighGap = isMissing && cp >= 60;
                    return (
                      <div key={a.key} style={{
                        display: 'grid',
                        gridTemplateColumns: `140px 52px repeat(${compCount}, 1fr) 56px`,
                        padding: '6px 12px',
                        alignItems: 'center',
                        borderBottom: `1px solid ${PC.border}22`,
                        backgroundColor: isHighGap ? PC.red + '08' : ri % 2 === 0 ? 'transparent' : PC.surface + '30',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 3, height: 14, background: isMissing ? (isHighGap ? PC.red : PC.yellow) : PC.green, borderRadius: 1, opacity: isMissing ? 1 : 0.45 }} />
                          <div>
                            <div style={{ fontSize: 9, color: isMissing ? PC.text : PC.dim }}>{a.name}</div>
                            <div style={{ fontSize: 7, fontFamily: pmono, color: PC.faint }}>{a.category.toUpperCase()}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' as const }}>
                          <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 2, backgroundColor: subjectHas ? PC.green + '18' : PC.red + '18', color: subjectHas ? PC.green : PC.red }}>{subjectHas ? '✓' : '✗'}</span>
                        </div>
                        {EXISTING_COMPS_AMENITIES.map(c => (
                          <div key={c.id} style={{ textAlign: 'center' as const }}>
                            <span style={{ fontSize: 8, fontWeight: 700, color: c.amenities[a.key] ? PC.green : PC.faint, opacity: c.amenities[a.key] ? 0.8 : 0.35 }}>{c.amenities[a.key] ? '●' : '○'}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <span style={{ fontSize: 9, fontFamily: pmono, fontWeight: 700, color: cp >= 60 ? (isMissing ? PC.red : PC.dim) : PC.dim }}>{cp}%</span>
                          <PenBar pct={cp} color={cp >= 60 && isMissing ? PC.red : PC.dim} width={34} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {view === 'impact' && (
              <>
                {missingAmenities.map(a => {
                  const lift = EXISTING_LIFT[a.key];
                  const cp = compPenetration(a.key);
                  const sp = EXISTING_SUBMARKET.penetration[a.key];
                  const annImpact = lift.liftPerUnit * EXISTING_SUBJECT.units * 12;
                  const compsWithIt = EXISTING_COMPS_AMENITIES.filter(c => c.amenities[a.key]);
                  const urgency = cp >= 70 ? 'CRITICAL' : cp >= 50 ? 'HIGH' : sp >= 40 ? 'MEDIUM' : 'LOW';
                  const urgencyColor = urgency === 'CRITICAL' ? PC.red : urgency === 'HIGH' ? PC.yellow : urgency === 'MEDIUM' ? PC.blue : PC.dim;
                  return (
                    <div key={a.key} style={{ borderBottom: `1px solid ${PC.border}`, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 3, height: 18, background: urgencyColor, borderRadius: 1 }} />
                          <span style={{ fontSize: 11, fontWeight: 700 }}>{a.name}</span>
                          <Pill color={urgencyColor}>{urgency}</Pill>
                          <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 2, backgroundColor: PC.muted, color: PC.dim }}>{lift.tier}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontSize: 8, fontFamily: pmono, color: PC.faint }}>COST</span>
                          <span style={{ fontSize: 11, fontFamily: pmono, color: PC.yellow, fontWeight: 700 }}>${(lift.cost / 1000).toFixed(0)}K</span>
                          <span style={{ fontSize: 8, fontFamily: pmono, color: PC.faint }}>LIFT</span>
                          <span style={{ fontSize: 11, fontFamily: pmono, color: PC.green, fontWeight: 700 }}>+${lift.liftPerUnit}/u</span>
                          <span style={{ fontSize: 8, fontFamily: pmono, color: PC.faint }}>ROI</span>
                          <span style={{ fontSize: 11, fontFamily: pmono, color: PC.text, fontWeight: 700 }}>{lift.roi}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginLeft: 9 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 7, fontFamily: pmono, color: PC.faint, letterSpacing: 0.8, marginBottom: 4 }}>COMP PARITY — {cp}% HAVE IT</div>
                          <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                            {EXISTING_COMPS_AMENITIES.map(c => (
                              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 5px', borderRadius: 2, backgroundColor: c.amenities[a.key] ? PC.green + '10' : PC.bg, border: `1px solid ${c.amenities[a.key] ? PC.green + '30' : PC.border}` }}>
                                <span style={{ fontSize: 7, color: c.amenities[a.key] ? PC.green : PC.faint, fontWeight: 700 }}>{c.amenities[a.key] ? '✓' : '✗'}</span>
                                <span style={{ fontSize: 7, fontFamily: pmono, color: c.amenities[a.key] ? PC.dim : PC.faint }}>{c.name.split(' ')[0]}</span>
                              </div>
                            ))}
                          </div>
                          {compsWithIt.length > 0 && (
                            <div style={{ fontSize: 8, color: PC.dim }}>
                              Avg rent w/: <span style={{ color: PC.green, fontWeight: 700 }}>${Math.round(compsWithIt.reduce((s, c) => s + c.avgRent, 0) / compsWithIt.length)}/mo</span>
                              {' '}vs without: <span style={{ color: PC.red, fontWeight: 700 }}>${EXISTING_COMPS_AMENITIES.filter(c => !c.amenities[a.key]).length > 0 ? Math.round(EXISTING_COMPS_AMENITIES.filter(c => !c.amenities[a.key]).reduce((s, c) => s + c.avgRent, 0) / EXISTING_COMPS_AMENITIES.filter(c => !c.amenities[a.key]).length) : '—'}/mo</span>
                            </div>
                          )}
                        </div>
                        <div style={{ width: 1, background: PC.border }} />
                        <div style={{ minWidth: 130 }}>
                          <div style={{ fontSize: 7, fontFamily: pmono, color: PC.faint, letterSpacing: 0.8, marginBottom: 3 }}>SUBMARKET — {sp}% PENETRATION</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <PenBar pct={sp} color={sp >= 50 ? PC.yellow : PC.dim} width={70} />
                            <span style={{ fontSize: 9, fontFamily: pmono, color: sp >= 50 ? PC.yellow : PC.dim, fontWeight: 700 }}>{sp}%</span>
                          </div>
                          <span style={{ fontSize: 8, color: PC.dim }}>{EXISTING_SUBMARKET.properties} properties</span>
                        </div>
                        <div style={{ width: 1, background: PC.border }} />
                        <div style={{ minWidth: 90, textAlign: 'right' as const }}>
                          <div style={{ fontSize: 7, fontFamily: pmono, color: PC.faint, letterSpacing: 0.8, marginBottom: 3 }}>ANNUAL IMPACT</div>
                          <div style={{ fontSize: 13, fontFamily: pmono, color: PC.green, fontWeight: 700 }}>${(annImpact / 1000).toFixed(0)}K</div>
                          <div style={{ fontSize: 8, fontFamily: pmono, color: PC.dim }}>{EXISTING_SUBJECT.units}u × ${lift.liftPerUnit}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ padding: '7px 12px', backgroundColor: PC.card, borderTop: `2px solid ${PC.border}`, display: 'flex', gap: 16, alignItems: 'center' }}>
                  <span style={{ fontSize: 8, fontFamily: pmono, color: PC.faint, fontWeight: 700 }}>TOTAL CLOSE COST</span>
                  <span style={{ fontSize: 12, fontFamily: pmono, color: PC.yellow, fontWeight: 700 }}>${(totalMissingCost / 1000).toFixed(0)}K</span>
                  <span style={{ color: PC.border }}>|</span>
                  <span style={{ fontSize: 8, fontFamily: pmono, color: PC.faint, fontWeight: 700 }}>TOTAL LIFT</span>
                  <span style={{ fontSize: 12, fontFamily: pmono, color: PC.green, fontWeight: 700 }}>+${totalLiftPerUnit}/u/mo</span>
                  <span style={{ color: PC.border }}>|</span>
                  <span style={{ fontSize: 8, fontFamily: pmono, color: PC.faint, fontWeight: 700 }}>ANNUAL</span>
                  <span style={{ fontSize: 12, fontFamily: pmono, color: PC.green, fontWeight: 700 }}>${(annualLift / 1e6).toFixed(2)}M</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ width: 240, borderLeft: `1px solid ${PC.border}`, flexShrink: 0, backgroundColor: PC.bg, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
          <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '7px 10px', borderBottom: `1px solid ${PC.border}` }}>
              <SectionLabel label="Action Summary" accent={PC.red} />
            </div>
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {actionItems.length === 0 ? (
                <div style={{ fontSize: 9, fontFamily: pmono, color: PC.green }}>✓ All amenities covered</div>
              ) : actionItems.map((a, idx) => (
                <div key={a.key} style={{ padding: '7px 8px', border: `1px solid ${idx === 0 ? a.urgencyColor + '60' : a.urgencyColor + '22'}`, borderRadius: 2, backgroundColor: idx === 0 ? a.urgencyColor + '14' : a.urgencyColor + '08', outline: idx === 0 ? `1px solid ${a.urgencyColor}30` : 'none', outlineOffset: -1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {idx === 0 && <span style={{ fontFamily: pmono, fontSize: 7, color: a.urgencyColor, fontWeight: 700 }}>TOP</span>}
                      <span style={{ fontSize: 10, fontWeight: 700, color: idx === 0 ? PC.text : PC.dim }}>{a.name}</span>
                    </div>
                    <Pill color={a.urgencyColor}>{a.urgency}</Pill>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontFamily: pmono, fontSize: 8, color: PC.dim, flexWrap: 'wrap' as const }}>
                    <span>${Math.round(a.lift.cost / 1000)}K</span>
                    <span>+${a.lift.liftPerUnit}/u</span>
                    <span>{a.lift.roi}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: PC.card, borderRadius: 2, border: `1px solid ${PC.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '7px 10px', borderBottom: `1px solid ${PC.border}` }}>
              <SectionLabel label="Comp Rent Context" accent={PC.green} />
            </div>
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column' as const, gap: 5 }}>
              {topOpportunity && topOpportunity.rentGap > 0 && (
                <div style={{ padding: '5px 8px', backgroundColor: `${PC.green}10`, borderRadius: 2, border: `1px solid ${PC.green}30`, marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: pmono, fontSize: 8, color: PC.dim }}>TOP UPSIDE</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontFamily: pmono, fontSize: 9, color: PC.text, fontWeight: 700 }}>{topOpportunity.abbr}</span>
                    <Pill color={PC.green}>+${topOpportunity.rentGap.toFixed(0)}/u</Pill>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                {unitMixRows.map(row => (
                  <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 7px', borderRadius: 2, backgroundColor: PC.bg, border: `1px solid ${PC.border}` }}>
                    <div style={{ width: 3, height: 10, background: row.color, borderRadius: 1 }} />
                    <span style={{ fontFamily: pmono, fontSize: 8, color: PC.text, fontWeight: 700 }}>{row.abbr}</span>
                    <span style={{ fontFamily: pmono, fontSize: 8, color: PC.subject }}>${row.subj.rent.toLocaleString()}</span>
                    {row.rentGap !== 0 && (
                      <span style={{ fontFamily: pmono, fontSize: 7, color: row.rentGap > 0 ? PC.green : PC.red, fontWeight: 700 }}>
                        {row.rentGap > 0 ? `+$${row.rentGap.toFixed(0)}` : `-$${Math.abs(row.rentGap).toFixed(0)}`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button style={{ width: '100%', padding: '8px 0', border: 'none', borderRadius: 2, cursor: 'pointer', fontSize: 9, fontFamily: pmono, backgroundColor: PC.green, color: PC.bg, fontWeight: 700, letterSpacing: 0.5 }}>
            PUSH TO PROFORMA →
          </button>
        </div>
      </div>
    </div>
  );
}

function generateNarrative(data: MarketIntelData): { headline: string; body: string; verdict: string; verdictColor: string } {
  const eco = data.economy;
  const demo = data.demographics;
  const supply = data.supplyContext;
  const census = demo?.census;
  const submarket = demo?.submarket;
  const msa = demo?.msa;

  const healthScore = eco?.healthScore ?? 0;
  const healthLabel = healthScore >= 70 ? 'strong' : healthScore >= 50 ? 'moderate' : 'weak';

  const jobsValue = eco?.metrics?.jobsAdded?.value || eco?.metrics?.jobGrowth?.value || 'N/A';
  const wageGrowth = eco?.metrics?.wageGrowth?.value || 'N/A';
  const rentGrowth = submarket?.rentGrowth || eco?.metrics?.rentGrowth?.value || 'N/A';
  const occVal = smOcc(submarket) ?? (supply?.marketOccupancy ? Number((supply.marketOccupancy * 100).toFixed(1)) : null);
  const occupancy = occVal != null ? String(occVal) : null;
  const population = census?.population ? Number(census.population).toLocaleString() : 'N/A';
  const medianIncome = census?.medianIncome ? `$${Number(census.medianIncome).toLocaleString()}` : 'N/A';
  const rentVal = smRent(submarket);
  const avgRent = rentVal != null ? `$${rentVal.toLocaleString()}` : (census?.medianRent ? `$${Number(census.medianRent).toLocaleString()}` : 'N/A');
  const submarketName = submarket?.name || 'the submarket';
  const msaName = msa?.name || 'the MSA';

  const sentences: string[] = [];

  sentences.push(`The local economy scores ${healthScore}/100 (${healthLabel}), with ${jobsValue} jobs added over the trailing twelve months and wage growth at ${wageGrowth}.`);

  if (occupancy) {
    const occNum = parseFloat(String(occupancy));
    const occLabel = occNum >= 95 ? 'tight' : occNum >= 90 ? 'healthy' : occNum >= 85 ? 'softening' : 'elevated vacancy';
    sentences.push(`${submarketName} shows ${occLabel} fundamentals at ${occupancy}% occupancy with average rents of ${avgRent} and rent growth of ${rentGrowth}.`);
  } else {
    sentences.push(`Average rents in ${submarketName} are ${avgRent} with rent growth tracking at ${rentGrowth}.`);
  }

  sentences.push(`The trade area serves a population of ${population} with median household income of ${medianIncome}.`);

  if (supply?.competingProperties?.count) {
    const pipelineUnits = supply.competingProperties.totalPipelineUnits;
    sentences.push(`The competitive landscape includes ${supply.competingProperties.count} properties within a ${supply.radiusMiles || 3}-mile radius${pipelineUnits ? `, with ${Number(pipelineUnits).toLocaleString()} units in the pipeline` : ''}.`);
  }

  const funnel = demo?.renterDemandFunnel;
  if (funnel?.demandPool) {
    sentences.push(`The qualified renter demand pool is estimated at ${funnel.demandPool} with a capture rate of ${funnel.captureRate || 'N/A'}.`);
  }

  let verdict = 'NEUTRAL';
  let verdictColor = BT2.text.amber;
  if (healthScore >= 70 && occupancy && parseFloat(String(occupancy)) >= 93) {
    verdict = 'FAVORABLE';
    verdictColor = BT2.met.occupancy;
  } else if (healthScore >= 50 && occupancy && parseFloat(String(occupancy)) >= 90) {
    verdict = 'MODERATE';
    verdictColor = BT2.text.amber;
  } else if (healthScore < 50 || (occupancy && parseFloat(String(occupancy)) < 88)) {
    verdict = 'CAUTION';
    verdictColor = BT2.text.red;
  }

  return {
    headline: `Market conditions are ${healthLabel} for ${submarketName} within ${msaName}`,
    body: sentences.join(' '),
    verdict,
    verdictColor,
  };
}

function detectRiskSignals(data: MarketIntelData): Array<{ label: string; detail: string; severity: 'high' | 'medium' | 'low' }> {
  const signals: Array<{ label: string; detail: string; severity: 'high' | 'medium' | 'low' }> = [];
  const eco = data.economy;
  const demo = data.demographics;
  const supply = data.supplyContext;

  if (eco?.healthScore != null && eco.healthScore < 50) {
    signals.push({ label: 'WEAK ECONOMY', detail: `Economic health ${eco.healthScore}/100 — below threshold`, severity: 'high' });
  }

  const occ = smOcc(demo?.submarket) ?? (supply?.marketOccupancy ? supply.marketOccupancy * 100 : null);
  if (occ != null && occ < 90) {
    signals.push({ label: 'LOW OCCUPANCY', detail: `${typeof occ === 'number' ? occ.toFixed(1) : occ}% submarket occupancy — elevated vacancy risk`, severity: 'high' });
  }

  if (supply?.competingProperties?.totalPipelineUnits > 1000) {
    signals.push({ label: 'HEAVY PIPELINE', detail: `${Number(supply.competingProperties.totalPipelineUnits).toLocaleString()} units in pipeline may pressure rents`, severity: 'medium' });
  }

  const affordability = eco?.metrics?.affordabilityRatio;
  if (affordability?.status === 'red') {
    signals.push({ label: 'AFFORDABILITY STRAIN', detail: affordability.value || 'Rent-to-income exceeds sustainable levels', severity: 'medium' });
  }

  const wageVal = eco?.metrics?.wageGrowth?.value;
  const rentVal = demo?.submarket?.rentGrowth || eco?.metrics?.rentGrowth?.value;
  if (wageVal && rentVal) {
    const wageNum = parseFloat(String(wageVal).replace(/[^0-9.-]/g, ''));
    const rentNum = parseFloat(String(rentVal).replace(/[^0-9.-]/g, ''));
    if (!isNaN(wageNum) && !isNaN(rentNum) && rentNum > wageNum + 2) {
      signals.push({ label: 'RENT-WAGE GAP', detail: `Rent growth (${rentVal}) outpacing wages (${wageVal}) — sustainability concern`, severity: 'medium' });
    }
  }

  if (signals.length === 0) {
    signals.push({ label: 'NO MAJOR RISKS', detail: 'No significant risk signals detected in current market data', severity: 'low' });
  }

  return signals;
}

function buildImpactMatrix(data: MarketIntelData) {
  const eco = data.economy;
  const demo = data.demographics;
  const supply = data.supplyContext;
  const submarket = demo?.submarket;
  const msa = demo?.msa;
  const census = demo?.census;

  return {
    asset: [
      { metric: 'ACHIEVABLE RENT', value: smRent(submarket) != null ? fmt$(smRent(submarket)) : (census?.medianRent != null ? `$${Number(census.medianRent).toLocaleString()}` : '—'), signal: submarket?.rentGrowth ? 'positive' : 'neutral' },
      { metric: 'DEMAND POOL', value: demo?.renterDemandFunnel?.demandPool || '—', signal: 'positive' },
      { metric: 'CAPTURE RATE', value: demo?.renterDemandFunnel?.captureRate || '—', signal: 'neutral' },
      { metric: 'COMPETING SUPPLY', value: supply?.competingProperties?.count != null ? `${supply.competingProperties.count} props` : '—', signal: supply?.competingProperties?.count > 20 ? 'negative' : 'neutral' },
      { metric: 'PIPELINE EXPOSURE', value: supply?.competingProperties?.totalPipelineUnits != null ? `${Number(supply.competingProperties.totalPipelineUnits).toLocaleString()} units` : '—', signal: supply?.competingProperties?.totalPipelineUnits > 1000 ? 'negative' : 'neutral' },
    ],
    submarket: [
      { metric: 'OCCUPANCY', value: smOcc(submarket) != null ? fmtPct(smOcc(submarket)) : '—', signal: (smOcc(submarket) ?? 0) >= 93 ? 'positive' : (smOcc(submarket) ?? 0) >= 90 ? 'neutral' : 'negative' },
      { metric: 'AVG RENT', value: smRent(submarket) != null ? fmt$(smRent(submarket)) : '—', signal: 'neutral' },
      { metric: 'RENT GROWTH', value: submarket?.rentGrowth ?? eco?.metrics?.rentGrowth?.value ?? '—', signal: 'positive' },
      { metric: 'PROPERTIES', value: submarket?.properties_count != null ? String(submarket.properties_count) : '—', signal: 'neutral' },
      { metric: 'TOTAL UNITS', value: submarket?.total_units != null ? Number(submarket.total_units).toLocaleString() : '—', signal: 'neutral' },
    ],
    msa: [
      { metric: 'JOB GROWTH', value: eco?.metrics?.jobsAdded?.value ?? eco?.metrics?.jobGrowth?.value ?? '—', signal: 'positive' },
      { metric: 'WAGE GROWTH', value: eco?.metrics?.wageGrowth?.value ?? '—', signal: 'positive' },
      { metric: 'NET MIGRATION', value: eco?.metrics?.netMigration?.value ?? '—', signal: 'positive' },
      { metric: 'POPULATION', value: census?.population != null ? Number(census.population).toLocaleString() : (msa?.population != null ? Number(msa.population).toLocaleString() : '—'), signal: 'neutral' },
      { metric: 'ECON HEALTH', value: eco?.healthScore != null ? `${eco.healthScore}/100` : '—', signal: eco?.healthScore >= 70 ? 'positive' : eco?.healthScore >= 50 ? 'neutral' : 'negative' },
    ],
  };
}

function NarrativeSection({ narrative, riskSignals }: { narrative: { headline: string; body: string; verdict: string; verdictColor: string }; riskSignals: Array<{ label: string; detail: string; severity: 'high' | 'medium' | 'low' }> }) {
  const severityColor = { high: BT2.text.red, medium: BT2.text.amber, low: BT2.met.occupancy };

  return (
    <div style={{ background: BT2.bg.panel }}>
      <div style={{ padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <FileText size={10} color={BT2.text.cyan} />
        <span style={{ fontSize: 8, fontWeight: 700, color: BT2.text.cyan, letterSpacing: 0.8, fontFamily: 'var(--bt-mono)' }}>MARKET NARRATIVE</span>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: 8, fontWeight: 800, letterSpacing: 1, fontFamily: 'var(--bt-mono)',
          padding: '1px 6px',
          color: narrative.verdictColor, background: `${narrative.verdictColor}18`,
          border: `1px solid ${narrative.verdictColor}40`,
        }}>
          {narrative.verdict}
        </span>
      </div>
      <div style={{ padding: '5px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: BT2.text.primary, marginBottom: 3, fontFamily: 'var(--bt-mono)', lineHeight: 1.3 }}>
          {narrative.headline}
        </div>
        <div style={{ fontSize: 9, color: BT2.text.secondary, lineHeight: 1.55, fontFamily: 'var(--bt-mono)' }}>
          {narrative.body}
        </div>
      </div>
      {riskSignals.length > 0 && (
        <div style={{ padding: '0 10px 4px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {riskSignals.map((sig, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 6px',
              background: `${severityColor[sig.severity]}10`,
              border: `1px solid ${severityColor[sig.severity]}25`,
            }}>
              {sig.severity === 'high' ? <AlertTriangle size={8} color={severityColor[sig.severity]} /> :
               sig.severity === 'medium' ? <Shield size={8} color={severityColor[sig.severity]} /> :
               <Zap size={8} color={severityColor[sig.severity]} />}
              <span style={{ fontSize: 8, fontWeight: 700, color: severityColor[sig.severity], fontFamily: 'var(--bt-mono)', letterSpacing: 0.3 }}>
                {sig.label}
              </span>
              <span style={{ fontSize: 8, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{sig.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImpactMatrixSection({ matrix }: { matrix: ReturnType<typeof buildImpactMatrix> }) {
  const signalDot = (signal: string) => {
    const c = signal === 'positive' ? BT2.met.occupancy : signal === 'negative' ? BT2.text.red : BT2.text.muted;
    return <div style={{ width: 4, height: 4, borderRadius: '50%', background: c, flexShrink: 0 }} />;
  };

  const Column = ({ title, icon: Icon, items, borderColor }: { title: string; icon: any; items: Array<{ metric: string; value: string; signal: string }>; borderColor: string }) => (
    <div style={{ background: BT2.bg.panel, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4, borderBottom: `1px solid ${BT2.border.subtle}`, borderLeft: `2px solid ${borderColor}` }}>
        <Icon size={9} color={borderColor} />
        <span style={{ fontSize: 8, fontWeight: 700, color: borderColor, letterSpacing: 0.8, fontFamily: 'var(--bt-mono)' }}>{title}</span>
      </div>
      <div style={{ flex: 1 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '3px 8px',
            borderBottom: i < items.length - 1 ? `1px solid ${BT2.border.subtle}` : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {signalDot(item.signal)}
              <span style={{ fontSize: 8, fontWeight: 600, color: BT2.text.muted, letterSpacing: 0.3, fontFamily: 'var(--bt-mono)' }}>{item.metric}</span>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: BT2.text.primary, fontFamily: 'var(--bt-mono)' }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ background: BT2.bg.panel }}>
      <div style={{ padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <BarChart3 size={10} color={BT2.text.amber} />
        <span style={{ fontSize: 8, fontWeight: 700, color: BT2.text.amber, letterSpacing: 0.8, fontFamily: 'var(--bt-mono)' }}>MARKET IMPACT MATRIX</span>
        <span style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>KEY METRICS · ASSET / SUBMARKET / MSA</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: BT2.border.subtle }}>
        <Column title="ASSET IMPACT" icon={Target} items={matrix.asset} borderColor={BT2.text.cyan} />
        <Column title="SUBMARKET" icon={MapPin} items={matrix.submarket} borderColor={BT2.met.occupancy} />
        <Column title="MSA / METRO" icon={Building2} items={matrix.msa} borderColor={BT2.text.purple} />
      </div>
    </div>
  );
}

interface UnitMixRow {
  unitType: string;
  propertyCount: number;
  avgRent: number;
  avgSf: number;
  rentPerSf: number;
  mixPct: number;
  vacancy: number;
}

function RentCompUnitMixTable({ unitMix }: { unitMix: UnitMixRow[] }) {
  if (!unitMix || unitMix.length === 0) return null;

  const mono = 'var(--bt-mono)';
  const hdr: React.CSSProperties = { fontSize: 7, fontWeight: 700, color: BT2.text.muted, letterSpacing: 0.6, fontFamily: mono, padding: '3px 6px', textAlign: 'right', borderBottom: `1px solid ${BT2.border.subtle}`, whiteSpace: 'nowrap' };
  const cell: React.CSSProperties = { fontSize: 9, fontWeight: 600, color: BT2.text.primary, fontFamily: mono, padding: '3px 6px', textAlign: 'right', borderBottom: `1px solid ${BT2.border.subtle}` };
  const labelCell: React.CSSProperties = { ...cell, textAlign: 'left', fontWeight: 700, color: BT2.text.cyan };

  const totals = unitMix.reduce((acc, r) => ({
    avgRent: acc.avgRent + r.avgRent * (r.propertyCount || 1),
    avgSf: acc.avgSf + r.avgSf * (r.propertyCount || 1),
    rentPerSf: 0,
    weight: acc.weight + (r.propertyCount || 1),
    mixPct: acc.mixPct + r.mixPct,
  }), { avgRent: 0, avgSf: 0, rentPerSf: 0, weight: 0, mixPct: 0 });
  const wAvgRent = totals.weight > 0 ? Math.round(totals.avgRent / totals.weight) : 0;
  const wAvgSf = totals.weight > 0 ? Math.round(totals.avgSf / totals.weight) : 0;
  const wRentPerSf = wAvgSf > 0 ? (wAvgRent / wAvgSf).toFixed(2) : '—';

  return (
    <div style={{ background: BT2.bg.panel }}>
      <div style={{ padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <Home size={9} color={BT2.met.economic} />
        <span style={{ fontSize: 8, fontWeight: 700, color: BT2.met.economic, letterSpacing: 0.8, fontFamily: mono }}>UNIT MIX BREAKDOWN</span>
        <span style={{ fontSize: 7, color: BT2.text.muted, fontFamily: mono }}>BY BEDROOM TYPE · COMP AVERAGES</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono }}>
          <thead>
            <tr style={{ background: BT2.bg.header }}>
              <th style={{ ...hdr, textAlign: 'left', minWidth: 80 }}>UNIT TYPE</th>
              <th style={{ ...hdr, minWidth: 50 }}>MIX %</th>
              <th style={{ ...hdr, minWidth: 65 }}>AVG RENT</th>
              <th style={{ ...hdr, minWidth: 55 }}>AVG SF</th>
              <th style={{ ...hdr, minWidth: 55 }}>RENT/SF</th>
              <th style={{ ...hdr, minWidth: 45 }}>COMPS</th>
            </tr>
          </thead>
          <tbody>
            {unitMix.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? BT2.bg.panel : BT2.bg.header }}>
                <td style={labelCell}>{row.unitType}</td>
                <td style={cell}>{row.mixPct > 0 ? `${row.mixPct}%` : '—'}</td>
                <td style={{ ...cell, color: BT2.text.cyan, fontWeight: 700 }}>{row.avgRent > 0 ? `$${row.avgRent.toLocaleString()}` : '—'}</td>
                <td style={cell}>{row.avgSf > 0 ? row.avgSf.toLocaleString() : '—'}</td>
                <td style={{ ...cell, color: BT2.met.occupancy }}>{row.rentPerSf > 0 ? `$${row.rentPerSf}` : '—'}</td>
                <td style={{ ...cell, color: BT2.text.muted }}>{row.propertyCount || '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: `${BT2.text.amber}08`, borderTop: `2px solid ${BT2.text.amber}40` }}>
              <td style={{ ...labelCell, color: BT2.text.amber, fontWeight: 800 }}>WTD AVG</td>
              <td style={{ ...cell, color: BT2.text.amber, fontWeight: 700 }}>{totals.mixPct > 0 ? `${totals.mixPct.toFixed(0)}%` : '—'}</td>
              <td style={{ ...cell, color: BT2.text.amber, fontWeight: 800 }}>{wAvgRent > 0 ? `$${wAvgRent.toLocaleString()}` : '—'}</td>
              <td style={{ ...cell, color: BT2.text.amber, fontWeight: 700 }}>{wAvgSf > 0 ? wAvgSf.toLocaleString() : '—'}</td>
              <td style={{ ...cell, color: BT2.text.amber, fontWeight: 700 }}>{wRentPerSf !== '—' ? `$${wRentPerSf}` : '—'}</td>
              <td style={{ ...cell, color: BT2.text.muted }}>{unitMix.length}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function EconomySection({ data }: { data: any }) {
  if (!data) return null;

  const healthColor = data.healthScore >= 70 ? BT2.met.occupancy : data.healthScore >= 50 ? BT2.text.amber : BT2.text.red;

  const metrics = [
    { label: 'ECON HEALTH', value: data.healthScore?.toString() || 'N/A', unit: '/100', trend: data.healthTrend, color: healthColor },
    { label: 'JOBS ADDED', value: data.metrics?.jobsAdded?.value || 'N/A', unit: '', trend: data.metrics?.jobsAdded?.trend, color: BT2.met.occupancy },
    { label: 'WAGE GROWTH', value: data.metrics?.wageGrowth?.value || 'N/A', unit: '', trend: data.metrics?.wageGrowth?.trend, color: BT2.met.occupancy },
    { label: 'NET MIGRATION', value: data.metrics?.netMigration?.value || 'N/A', unit: '', trend: data.metrics?.netMigration?.trend, color: BT2.text.purple },
    { label: 'AFFORDABILITY', value: data.metrics?.affordabilityRatio?.value || 'N/A', unit: '', trend: data.metrics?.affordabilityRatio?.detail, color: data.metrics?.affordabilityRatio?.status === 'green' ? BT2.met.occupancy : data.metrics?.affordabilityRatio?.status === 'red' ? BT2.text.red : BT2.text.amber },
  ];

  return (
    <div style={{ background: BT2.bg.panel }}>
      <div style={{ padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <Briefcase size={9} color={BT2.met.economic} />
        <span style={{ fontSize: 8, fontWeight: 700, color: BT2.met.economic, letterSpacing: 0.8, fontFamily: 'var(--bt-mono)' }}>LOCAL ECONOMY</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BT2.border.subtle }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ background: BT2.bg.panel, padding: '4px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: m.color, fontFamily: 'var(--bt-mono)', lineHeight: 1 }}>{m.value}{m.unit}</div>
            <div style={{ fontSize: 7, color: BT2.text.muted, fontWeight: 700, letterSpacing: 0.6, marginTop: 2, fontFamily: 'var(--bt-mono)' }}>{m.label}</div>
            {m.trend && <div style={{ fontSize: 7, color: BT2.text.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--bt-mono)' }}>{m.trend}</div>}
          </div>
        ))}
      </div>
      {data.healthInsight && (
        <div style={{ padding: '3px 10px', borderTop: `1px solid ${BT2.border.subtle}` }}>
          <div style={{ padding: '3px 8px', border: `1px solid ${healthColor}25`, background: `${healthColor}08`, fontSize: 8, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', lineHeight: 1.45 }}>
            {data.healthInsight}
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: BT2.border.subtle }}>
        <EmployersPanel employers={data.employers} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: BT2.border.subtle }}>
          <PipelinePanel pipeline={data.developmentPipeline} />
          <IndustryPanel industries={data.industryComposition} />
        </div>
      </div>
      <WageRentPanel alignment={data.wageRentAlignment} />
    </div>
  );
}

function EmployersPanel({ employers }: { employers: any[] }) {
  if (!employers?.length) return (
    <SectionPanel title="MAJOR EMPLOYERS" subtitle="No data" borderColor={BT2.text.purple}>
      <div style={{ padding: '4px 8px', fontSize: 8, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>Upload OM or enable news intelligence.</div>
    </SectionPanel>
  );

  const statusColors: Record<string, string> = { expanding: BT2.met.occupancy, stable: BT2.text.cyan, watch: BT2.text.amber, contracting: BT2.text.red };
  const statusIcons: Record<string, string> = { expanding: '▲', stable: '●', watch: '◆', contracting: '▼' };

  return (
    <SectionPanel title="MAJOR EMPLOYERS" subtitle={`${employers.length} tracked`} borderColor={BT2.text.purple}>
      {employers.map((emp, i) => (
        <div key={i} style={{ padding: '3px 8px', borderBottom: i < employers.length - 1 ? `1px solid ${BT2.border.subtle}` : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: BT2.text.primary, fontFamily: 'var(--bt-mono)' }}>{emp.name}</span>
              <span style={{ fontSize: 7, padding: '0px 3px', background: `${BT2.text.violet}12`, border: `1px solid ${BT2.text.violet}40`, color: BT2.text.purple, fontFamily: 'var(--bt-mono)' }}>{emp.industry}</span>
            </div>
            <span style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{emp.sourceType}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: 8, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>
            <span>{emp.employees}</span>
            {emp.distance && <span>{emp.distance}</span>}
            <span style={{ color: statusColors[emp.status] || BT2.text.muted }}>{statusIcons[emp.status] || '●'} {emp.statusText}</span>
            <span style={{ color: BT2.met.occupancy, fontWeight: 600 }}>{emp.demandImpact}</span>
          </div>
        </div>
      ))}
    </SectionPanel>
  );
}

function PipelinePanel({ pipeline }: { pipeline: any[] }) {
  if (!pipeline?.length) return (
    <SectionPanel title="DEV PIPELINE" subtitle="No data" borderColor={BT2.text.amber}>
      <div style={{ padding: '4px 8px', fontSize: 8, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>No pipeline data available.</div>
    </SectionPanel>
  );

  return (
    <SectionPanel title="DEV PIPELINE" subtitle={`${pipeline.length} proj`} borderColor={BT2.text.amber}>
      {pipeline.map((proj, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderBottom: i < pipeline.length - 1 ? `1px solid ${BT2.border.subtle}` : 'none' }}>
          <span style={{ fontSize: 10 }}>{proj.type === 'Infrastructure' ? '🚲' : proj.type === 'Corporate' ? '🏢' : proj.type === 'Residential' ? '🏠' : '🏗️'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: BT2.text.primary, fontFamily: 'var(--bt-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.project}</div>
            <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.impact}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 8, fontWeight: 600, color: BT2.text.purple, fontFamily: 'var(--bt-mono)' }}>{proj.timeline}</div>
            <span style={{
              fontSize: 7, fontWeight: 700, padding: '0px 3px', fontFamily: 'var(--bt-mono)',
              color: proj.confidence === 'HIGH' ? BT2.met.occupancy : proj.confidence === 'LOW' ? BT2.text.red : BT2.text.amber,
              background: proj.confidence === 'HIGH' ? `${BT2.met.occupancy}18` : proj.confidence === 'LOW' ? `${BT2.text.red}18` : `${BT2.text.amber}18`,
            }}>{proj.confidence}</span>
          </div>
        </div>
      ))}
    </SectionPanel>
  );
}

function IndustryPanel({ industries }: { industries: any[] }) {
  if (!industries?.length) return null;

  const barColors = [BT2.text.purple, BT2.text.cyan, BT2.met.occupancy, BT2.text.amber, BT2.text.red, BT2.text.muted];
  const trendColors: Record<string, string> = { up: BT2.met.occupancy, down: BT2.text.red, flat: BT2.text.muted };

  return (
    <SectionPanel title="INDUSTRY MIX" subtitle="Composition" borderColor={BT2.text.cyan}>
      {industries.map((ind, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px' }}>
          <span style={{ fontSize: 7, color: BT2.text.muted, width: 65, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--bt-mono)' }}>{ind.name}</span>
          <div style={{ flex: 1, height: 7, background: BT2.bg.terminal, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: barColors[i % barColors.length], opacity: 0.65, width: `${ind.pct}%` }} />
          </div>
          <span style={{ fontSize: 8, fontWeight: 600, color: BT2.text.secondary, width: 24, fontFamily: 'var(--bt-mono)' }}>{ind.pct}%</span>
          <span style={{ fontSize: 8, fontWeight: 600, width: 28, fontFamily: 'var(--bt-mono)', color: trendColors[ind.trend] || BT2.text.muted }}>{ind.growth}</span>
        </div>
      ))}
    </SectionPanel>
  );
}

function WageRentPanel({ alignment }: { alignment: any }) {
  if (!alignment) return null;

  const items = [
    { label: 'WAGE GROWTH', value: alignment.wageGrowth, color: BT2.met.occupancy },
    { label: 'RENT GROWTH', value: alignment.rentGrowth, color: BT2.text.purple },
    { label: 'TRAFFIC SURGE', value: alignment.trafficSurge, color: BT2.text.amber },
    { label: 'SEARCH MOMENTUM', value: alignment.searchMomentum, color: BT2.text.cyan },
  ];

  return (
    <div style={{ borderTop: `1px solid ${BT2.border.subtle}` }}>
      <div style={{ padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <Activity size={9} color={BT2.text.amber} />
        <span style={{ fontSize: 8, fontWeight: 700, color: BT2.text.amber, letterSpacing: 0.8, fontFamily: 'var(--bt-mono)' }}>WAGE-RENT-TRAFFIC ALIGNMENT</span>
        <span style={{ fontSize: 7, padding: '0px 4px', background: `${BT2.text.purple}15`, color: BT2.text.purple, fontFamily: 'var(--bt-mono)' }}>CORRELATION ENGINE</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: BT2.border.subtle }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: BT2.bg.panel, padding: '4px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: item.color, fontFamily: 'var(--bt-mono)', lineHeight: 1 }}>{item.value || 'N/A'}</div>
            <div style={{ fontSize: 7, color: BT2.text.muted, fontWeight: 700, marginTop: 2, fontFamily: 'var(--bt-mono)', letterSpacing: 0.4 }}>{item.label}</div>
          </div>
        ))}
      </div>
      {alignment.insight && (
        <div style={{ padding: '3px 10px' }}>
          <div style={{ padding: '3px 8px', border: `1px solid ${BT2.text.purple}25`, background: `${BT2.text.purple}08`, fontSize: 8, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', lineHeight: 1.45 }}>
            {alignment.insight}
          </div>
        </div>
      )}
    </div>
  );
}

function DemographicsSection({ data, supply }: { data: any; supply: any }) {
  if (!data) return null;

  const funnel = data.renterDemandFunnel;
  const census = data.census;

  return (
    <div style={{ background: BT2.bg.panel }}>
      <div style={{ padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <Users size={9} color={BT2.text.purple} />
        <span style={{ fontSize: 8, fontWeight: 700, color: BT2.text.purple, letterSpacing: 0.8, fontFamily: 'var(--bt-mono)' }}>DEMOGRAPHICS & DEMAND</span>
      </div>
      {census && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: BT2.border.subtle, borderBottom: `1px solid ${BT2.border.subtle}` }}>
          {[
            { label: 'POPULATION', value: census.population?.toLocaleString() },
            { label: 'MED INCOME', value: census.medianIncome ? `$${census.medianIncome.toLocaleString()}` : 'N/A' },
            { label: 'HOUSING UNITS', value: census.totalHousingUnits?.toLocaleString() },
            { label: 'MED RENT', value: census.medianRent ? `$${census.medianRent.toLocaleString()}` : 'N/A' },
          ].map((item, i) => (
            <div key={i} style={{ background: BT2.bg.panel, padding: '4px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BT2.text.primary, fontFamily: 'var(--bt-mono)', lineHeight: 1 }}>{item.value || 'N/A'}</div>
              <div style={{ fontSize: 7, color: BT2.text.muted, fontWeight: 700, letterSpacing: 0.6, marginTop: 2, fontFamily: 'var(--bt-mono)' }}>{item.label}</div>
            </div>
          ))}
        </div>
      )}
      {(data.submarket || data.msa) && (
        <div style={{ display: 'grid', gridTemplateColumns: data.submarket && data.msa ? '1fr 1fr' : '1fr', gap: 1, background: BT2.border.subtle }}>
          {data.submarket && (
            <SectionPanel title={`SUBMARKET: ${data.submarket.name}`} subtitle="Performance" borderColor={BT2.met.occupancy}>
              <DataRow label="OCCUPANCY" value={fmtPct(smOcc(data.submarket))} valueColor={BT2.met.occupancy} />
              <DataRow label="AVG RENT" value={fmt$(smRent(data.submarket))} valueColor={BT2.text.cyan} />
              <DataRow label="PROPERTIES" value={data.submarket.properties_count?.toString() || 'N/A'} valueColor={BT2.text.secondary} />
              <DataRow label="TOTAL UNITS" value={data.submarket.total_units?.toLocaleString() || 'N/A'} valueColor={BT2.text.secondary} />
            </SectionPanel>
          )}
          {data.msa && (
            <SectionPanel title={`MSA: ${data.msa.name}`} subtitle="Metro" borderColor={BT2.text.purple}>
              <DataRow label="OCCUPANCY" value={fmtPct(smOcc(data.msa))} valueColor={BT2.met.occupancy} />
              <DataRow label="AVG RENT" value={fmt$(smRent(data.msa))} valueColor={BT2.text.cyan} />
              <DataRow label="PROPERTIES" value={data.msa.total_properties?.toString() || 'N/A'} valueColor={BT2.text.secondary} />
              <DataRow label="POPULATION" value={data.msa.population?.toLocaleString() || 'N/A'} valueColor={BT2.text.secondary} />
            </SectionPanel>
          )}
        </div>
      )}
      {funnel && <DemandFunnelPanel funnel={funnel} />}
      {supply?.competingProperties && (
        <div style={{ borderTop: `1px solid ${BT2.border.subtle}` }}>
          <div style={{ padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${BT2.border.subtle}` }}>
            <Building2 size={9} color={BT2.text.amber} />
            <span style={{ fontSize: 8, fontWeight: 700, color: BT2.text.amber, letterSpacing: 0.8, fontFamily: 'var(--bt-mono)' }}>COMPETITIVE SUPPLY</span>
            <span style={{ fontSize: 7, padding: '0px 4px', background: `${BT2.text.amber}15`, color: BT2.text.amber, fontFamily: 'var(--bt-mono)' }}>{supply.radiusMiles}mi</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BT2.border.subtle }}>
            {[
              { label: 'PROPERTIES', value: supply.competingProperties.count?.toString() },
              { label: 'AVG UNITS', value: supply.competingProperties.avgUnits?.toString() },
              { label: 'AVG OCC', value: supply.competingProperties.avgOccupancy ? `${supply.competingProperties.avgOccupancy}%` : 'N/A' },
              { label: 'AVG RENT', value: supply.competingProperties.avgRent ? `$${supply.competingProperties.avgRent.toLocaleString()}` : 'N/A' },
              { label: 'PIPELINE', value: supply.competingProperties.totalPipelineUnits?.toLocaleString() },
            ].map((item, i) => (
              <div key={i} style={{ background: BT2.bg.panel, padding: '4px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: BT2.text.primary, fontFamily: 'var(--bt-mono)', lineHeight: 1 }}>{item.value || 'N/A'}</div>
                <div style={{ fontSize: 7, color: BT2.text.muted, fontWeight: 700, letterSpacing: 0.5, marginTop: 2, fontFamily: 'var(--bt-mono)' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DemandFunnelPanel({ funnel }: { funnel: any }) {
  const steps = [
    { label: 'Total Pop', value: funnel.totalPopulation, pct: 100, color: BT2.text.muted },
    { label: 'Renters', value: funnel.renters, pct: funnel.renterPct, color: BT2.text.purple },
    { label: 'Income Qual', value: funnel.incomeQualified, pct: funnel.incomeQualifiedPct, color: BT2.text.cyan },
    { label: 'Age Match', value: funnel.ageAppropriate, pct: funnel.ageAppropriatePct, color: BT2.met.occupancy },
    { label: 'Unit Match', value: funnel.unitTypeMatch, pct: funnel.unitTypeMatchPct, color: BT2.met.economic },
  ];

  return (
    <div style={{ borderTop: `1px solid ${BT2.border.subtle}` }}>
      <div style={{ padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <Users size={9} color={BT2.text.cyan} />
        <span style={{ fontSize: 8, fontWeight: 700, color: BT2.text.cyan, letterSpacing: 0.8, fontFamily: 'var(--bt-mono)' }}>RENTER DEMAND FUNNEL</span>
      </div>
      <div style={{ padding: '4px 10px' }}>
        {steps.map((step, i) => {
          const width = i === 0 ? 100 : steps.slice(1, i + 1).reduce((acc, s) => acc * (s.pct / 100), 100);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 7, color: BT2.text.muted, width: 60, textAlign: 'right', fontFamily: 'var(--bt-mono)', fontWeight: 600 }}>{step.label}</span>
              <div style={{ flex: 1, height: 12, background: BT2.bg.terminal, overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', background: step.color, opacity: 0.5, width: `${width}%`, transition: 'width 0.5s' }} />
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: BT2.text.primary, fontFamily: 'var(--bt-mono)' }}>
                  {step.value}
                </span>
              </div>
              {i > 0 && <span style={{ fontSize: 7, color: BT2.text.muted, width: 24, fontFamily: 'var(--bt-mono)' }}>{step.pct}%</span>}
            </div>
          );
        })}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
          <div style={{ textAlign: 'center', padding: '4px', border: `1px solid ${BT2.met.occupancy}30`, background: `${BT2.met.occupancy}08` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BT2.met.occupancy, fontFamily: 'var(--bt-mono)', lineHeight: 1 }}>{funnel.demandPool}</div>
            <div style={{ fontSize: 7, color: BT2.met.occupancy, fontWeight: 700, fontFamily: 'var(--bt-mono)', marginTop: 1 }}>DEMAND POOL</div>
          </div>
          <div style={{ textAlign: 'center', padding: '4px', border: `1px solid ${BT2.text.purple}30`, background: `${BT2.text.purple}08` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BT2.text.purple, fontFamily: 'var(--bt-mono)', lineHeight: 1 }}>{funnel.captureRate}</div>
            <div style={{ fontSize: 7, color: BT2.text.purple, fontWeight: 700, fontFamily: 'var(--bt-mono)', marginTop: 1 }}>CAPTURE RATE</div>
          </div>
        </div>
        {funnel.captureInsight && (
          <div style={{ marginTop: 4, padding: '3px 8px', border: `1px solid ${BT2.text.purple}25`, background: `${BT2.text.purple}08`, fontSize: 8, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', lineHeight: 1.45 }}>
            {funnel.captureInsight}
          </div>
        )}
      </div>
    </div>
  );
}

function NewsSection({ events }: { events: any[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!events?.length) return (
    <div style={{ background: BT2.bg.panel }}>
      <div style={{ padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Newspaper size={9} color={BT2.text.muted} />
        <span style={{ fontSize: 8, fontWeight: 700, color: BT2.text.muted, letterSpacing: 0.8, fontFamily: 'var(--bt-mono)' }}>NEWS FEED</span>
        <span style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>No events tracked</span>
      </div>
    </div>
  );

  const typeConfig: Record<string, { color: string; icon: string }> = {
    DEMAND: { color: BT2.met.occupancy, icon: '📈' },
    SUPPLY: { color: BT2.text.amber, icon: '🏗️' },
    INFRASTRUCTURE: { color: BT2.text.cyan, icon: '🚇' },
    ECONOMIC: { color: BT2.text.purple, icon: '💼' },
    RISK: { color: BT2.text.red, icon: '⚠️' },
    REGULATORY: { color: BT2.text.muted, icon: '⚖️' },
  };

  const shown = expanded ? events : events.slice(0, 5);

  return (
    <div style={{ background: BT2.bg.panel }}>
      <div style={{ padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <Newspaper size={9} color={BT2.text.amber} />
        <span style={{ fontSize: 8, fontWeight: 700, color: BT2.text.amber, letterSpacing: 0.8, fontFamily: 'var(--bt-mono)' }}>NEWS FEED</span>
        <span style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{events.length} events</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
          {Object.entries(typeConfig).map(([type, cfg]) => {
            const count = events.filter(e => e.type === type).length;
            if (count === 0) return null;
            return (
              <span key={type} style={{ fontSize: 7, fontWeight: 600, color: cfg.color, fontFamily: 'var(--bt-mono)' }}>
                {cfg.icon}{count}
              </span>
            );
          })}
        </div>
      </div>
      {shown.map((event, i) => {
        const cfg = typeConfig[event.type] || typeConfig.ECONOMIC;
        return (
          <div key={i} style={{ padding: '3px 10px', borderBottom: `1px solid ${BT2.border.subtle}`, display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: cfg.color, fontFamily: 'var(--bt-mono)' }}>
                  {cfg.icon} {event.type}
                </span>
                <span style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{event.category}/{event.eventType?.replace(/_/g, ' ')}</span>
              </div>
              <div style={{ fontSize: 9, fontWeight: 600, color: BT2.text.primary, fontFamily: 'var(--bt-mono)', marginBottom: 1 }}>{event.headline}</div>
              {event.extractedData && (
                <div style={{ display: 'flex', gap: 8, fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>
                  {event.extractedData.company_name && <span>Co: {event.extractedData.company_name}</span>}
                  {event.extractedData.employee_count && <span>Emp: {event.extractedData.employee_count.toLocaleString()}</span>}
                  {event.extractedData.unit_count && <span>Units: {event.extractedData.unit_count}</span>}
                  {event.extractedData.total_investment && <span>${(event.extractedData.total_investment / 1000000).toFixed(0)}M</span>}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{event.date ? new Date(event.date).toLocaleDateString() : ''}</div>
              <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{event.city}, {event.state}</div>
              {event.source && <div style={{ fontSize: 7, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>via {event.source}</div>}
            </div>
          </div>
        );
      })}
      {events.length > 5 && (
        <div style={{ padding: '3px 10px', textAlign: 'center' }}>
          <button onClick={() => setExpanded(!expanded)} style={{
            background: 'transparent', border: `1px solid ${BT2.border.subtle}`,
            padding: '2px 8px', fontSize: 7, color: BT2.text.cyan, cursor: 'pointer', fontFamily: 'var(--bt-mono)', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            {expanded ? <><ChevronUp size={8} /> LESS</> : <><ChevronDown size={8} /> ALL {events.length}</>}
          </button>
        </div>
      )}
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 10px' }}>
      <span style={{ fontSize: 8, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{message}</span>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 10px' }}>
      <AlertTriangle size={16} color={BT2.text.red} style={{ marginBottom: 6 }} />
      <span style={{ fontSize: 8, color: BT2.text.muted, marginBottom: 6, fontFamily: 'var(--bt-mono)' }}>{message}</span>
      <button onClick={onRetry} style={{
        display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px',
        fontSize: 8, fontWeight: 700, color: BT2.text.cyan, background: 'transparent',
        border: `1px solid ${BT2.text.cyan}40`, cursor: 'pointer', fontFamily: 'var(--bt-mono)',
      }}>
        <RefreshCw size={8} /> RETRY
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ background: BT2.bg.terminal }}>
      <div style={{ background: BT2.bg.panel, borderLeft: `2px solid ${BT2.text.purple}`, padding: '6px 10px' }}>
        <div style={{ height: 10, width: 140, background: BT2.border.subtle }} />
        <div style={{ height: 8, width: 200, background: BT2.bg.terminal, marginTop: 4 }} />
      </div>
      <div style={{ background: BT2.bg.panel, borderTop: `1px solid ${BT2.border.subtle}`, padding: 8 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 18, width: 80, background: BT2.bg.terminal }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 8 }}>
          {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ height: 32, background: BT2.bg.terminal }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          <div style={{ height: 100, background: BT2.bg.terminal }} />
          <div style={{ height: 100, background: BT2.bg.terminal }} />
        </div>
      </div>
    </div>
  );
}

export default MarketIntelligencePage;
