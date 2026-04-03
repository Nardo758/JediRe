import { T as BT } from '../../components/deal/bloomberg-tokens';
import { BT as BT2, BT_CSS, PanelHeader, SubTabBar, KpiTile, SectionPanel, DataRow, BtTabWrapper } from '../../components/deal/bloomberg-ui';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  TrendingUp, Users, Newspaper, Building2, MapPin,
  Briefcase, Factory, ChevronDown, ChevronUp,
  AlertTriangle, RefreshCw, Activity, DollarSign, Home, Layers, Link2,
  FileText, Shield, Target, BarChart3, Zap
} from 'lucide-react';
import { apiClient } from '../../services/api.client';
import { useDealModule } from '../../contexts/DealModuleContext';
import UnitMixIntelligence from '../../components/deal/sections/UnitMixIntelligence';
import { TrendsAnalysisSection } from '../../components/deal/sections/TrendsAnalysisSection';
import OpportunityEngineSection from '../../components/deal/sections/OpportunityEngineSection';

interface MarketIntelData {
  economy: any;
  demographics: any;
  news: any[];
  supplyContext: any;
  documentIntelligence: any;
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

export const MarketIntelligencePage: React.FC<MarketIntelPageProps> = (outerProps) => {
  const { dealId: paramDealId } = useParams<{ dealId: string }>();
  const dealId = outerProps.dealId || paramDealId || '';
  const { updateMarketIntelligence, emitEvent, activeScenario, zoningProfile, lastEvent } = useDealModule();
  const [moduleTab, setModuleTab] = useState(0);
  const [data, setData] = useState<MarketIntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const lastProcessedEventRef = useRef<number>(0);

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

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => fetchData()} />;
  if (!data) return <ErrorState message="No data available" onRetry={() => fetchData()} />;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT2.bg.terminal }}>
      <style>{BT_CSS}</style>
      <PanelHeader
        title="MARKET INTELLIGENCE"
        subtitle="M03 · DEMAND + RENT + SUPPLY"
        borderColor={BT2.text.cyan}
        metrics={[
          { l: 'F_RENT', c: BT2.text.cyan },
          { l: 'O_ABSORB', c: BT2.met.occupancy },
          { l: 'E_JOBS', c: BT2.met.economic },
          { l: 'D_SEARCH', c: BT2.met.digTraffic },
        ]}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1, background: BT2.border.subtle, borderBottom: `1px solid ${BT2.border.subtle}`, flexShrink: 0 }}>
        {kpiEconomy.map(k => (
          <KpiTile key={k.label} label={k.label} value={k.value} color={k.color} spark={k.spark} />
        ))}
      </div>

      <SubTabBar
        tabs={['MARKET INTEL', 'UNIT MIX', 'TRENDS', 'OPPORTUNITY']}
        active={moduleTab}
        setActive={setModuleTab}
        color={BT2.text.cyan}
      />

      <BtTabWrapper>
        {moduleTab === 1 && <UnitMixIntelligence />}
        {moduleTab === 2 && <TrendsAnalysisSection deal={outerProps.deal} />}
        {moduleTab === 3 && <OpportunityEngineSection deal={outerProps.deal} />}
        {moduleTab === 0 && (
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, padding: '3px 10px', background: BT2.bg.header, borderBottom: `1px solid ${BT2.border.subtle}`, flexShrink: 0 }}>
              {cached && <span style={{ fontSize: 9, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>CACHED</span>}
              <button onClick={() => fetchData(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 9, color: BT2.text.cyan, background: 'transparent', border: `1px solid ${BT2.text.cyan}30`, cursor: 'pointer', fontFamily: 'var(--bt-mono)' }}>
                <RefreshCw size={10} />
                REFRESH DATA
              </button>
            </div>

            {hasZoningContext ? (
              <div style={{ background: BT2.bg.header, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BT2.border.subtle}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6', animation: 'pulse 2s infinite' }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#8B5CF6', letterSpacing: 1, fontFamily: 'var(--bt-mono)' }}>ZONING LINKED</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {zoningCode && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 3, fontSize: 11, fontFamily: 'var(--bt-mono)', fontWeight: 700, color: '#C4B5FD', background: '#1a1228', border: '1px solid #4C1D95' }}>
                        <Layers size={10} />{zoningCode}
                      </span>
                    )}
                    {activeScenario?.maxUnits && <ZoneBadge>{activeScenario.maxUnits.toLocaleString()} units</ZoneBadge>}
                    {activeScenario?.maxGba && <ZoneBadge>{activeScenario.maxGba.toLocaleString()} SF GBA</ZoneBadge>}
                    {activeScenario?.appliedFar && <ZoneBadge>{activeScenario.appliedFar.toFixed(2)} FAR</ZoneBadge>}
                    {activeScenario?.maxStories && <ZoneBadge>{activeScenario.maxStories} stories</ZoneBadge>}
                    {activeScenario?.bindingConstraint && (
                      <span style={{ padding: '2px 6px', borderRadius: 3, fontSize: 11, fontFamily: 'var(--bt-mono)', color: BT2.text.amber, border: `1px solid ${BT2.text.amber}55` }}>
                        Binding: {activeScenario.bindingConstraint}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#8B5CF6' }}>
                  <Link2 size={12} />
                  <span style={{ fontSize: 9, fontFamily: 'var(--bt-mono)' }}>from Property & Zoning</span>
                </div>
              </div>
            ) : (
              <div style={{ background: BT2.bg.header, padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BT2.border.subtle}` }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: BT2.text.muted }} />
                <span style={{ fontSize: 11, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>Select a development path in Property & Zoning to contextualize market analysis</span>
              </div>
            )}

            <EconomySection data={data.economy} />

            <DemographicsSection data={data.demographics} supply={data.supplyContext} />

            <NewsSection events={data.news} />

          </div>
        )}
      </BtTabWrapper>
    </div>
  );
};

function ZoneBadge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ padding: '2px 6px', borderRadius: 3, fontSize: 11, fontFamily: 'var(--bt-mono)', color: '#9EA8B4', background: '#131920', border: '1px solid #1e2a3d' }}>
      {children}
    </span>
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
    const wageNum = parseFloat(String(wageVal).replace(/[^0-9.\-]/g, ''));
    const rentNum = parseFloat(String(rentVal).replace(/[^0-9.\-]/g, ''));
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
  const severityBg = { high: `${BT2.text.red}15`, medium: `${BT2.text.amber}12`, low: `${BT2.met.occupancy}10` };

  return (
    <div style={{ background: BT2.bg.panel, padding: 0 }}>
      <div style={{ padding: '10px 16px 8px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <FileText size={13} color={BT2.text.cyan} />
        <span style={{ fontSize: 10, fontWeight: 700, color: BT2.text.cyan, letterSpacing: 1, fontFamily: 'var(--bt-mono)' }}>MARKET NARRATIVE</span>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: 1.5, fontFamily: 'var(--bt-mono)',
          padding: '2px 10px', borderRadius: 3,
          color: narrative.verdictColor, background: `${narrative.verdictColor}18`,
          border: `1px solid ${narrative.verdictColor}40`,
        }}>
          {narrative.verdict}
        </span>
      </div>

      <div style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BT2.text.primary, marginBottom: 8, fontFamily: 'var(--bt-mono)', lineHeight: 1.4 }}>
          {narrative.headline}
        </div>
        <div style={{ fontSize: 11, color: BT2.text.secondary, lineHeight: 1.65, fontFamily: 'var(--bt-mono)' }}>
          {narrative.body}
        </div>
      </div>

      {riskSignals.length > 0 && (
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {riskSignals.map((sig, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 4,
              background: severityBg[sig.severity],
              border: `1px solid ${severityColor[sig.severity]}30`,
            }}>
              {sig.severity === 'high' ? <AlertTriangle size={10} color={severityColor[sig.severity]} /> :
               sig.severity === 'medium' ? <Shield size={10} color={severityColor[sig.severity]} /> :
               <Zap size={10} color={severityColor[sig.severity]} />}
              <span style={{ fontSize: 9, fontWeight: 700, color: severityColor[sig.severity], fontFamily: 'var(--bt-mono)', letterSpacing: 0.5 }}>
                {sig.label}
              </span>
              <span style={{ fontSize: 9, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{sig.detail}</span>
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
    return <div style={{ width: 5, height: 5, borderRadius: '50%', background: c, flexShrink: 0 }} />;
  };

  const Column = ({ title, icon: Icon, items, borderColor }: { title: string; icon: any; items: Array<{ metric: string; value: string; signal: string }>; borderColor: string }) => (
    <div style={{ background: BT2.bg.panel, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${BT2.border.subtle}`, borderLeft: `3px solid ${borderColor}` }}>
        <Icon size={12} color={borderColor} />
        <span style={{ fontSize: 10, fontWeight: 700, color: borderColor, letterSpacing: 1, fontFamily: 'var(--bt-mono)' }}>{title}</span>
      </div>
      <div style={{ flex: 1 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '5px 12px',
            borderBottom: i < items.length - 1 ? `1px solid ${BT2.border.subtle}` : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {signalDot(item.signal)}
              <span style={{ fontSize: 9, fontWeight: 600, color: BT2.text.muted, letterSpacing: 0.5, fontFamily: 'var(--bt-mono)' }}>{item.metric}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: BT2.text.primary, fontFamily: 'var(--bt-mono)' }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ background: BT2.bg.panel, padding: 0 }}>
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <BarChart3 size={13} color={BT2.text.amber} />
        <span style={{ fontSize: 10, fontWeight: 700, color: BT2.text.amber, letterSpacing: 1, fontFamily: 'var(--bt-mono)' }}>MARKET IMPACT MATRIX</span>
        <span style={{ fontSize: 9, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>KEY METRICS · ASSET / SUBMARKET / MSA</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: BT2.border.subtle }}>
        <Column title="ASSET IMPACT" icon={Target} items={matrix.asset} borderColor={BT2.text.cyan} />
        <Column title="SUBMARKET" icon={MapPin} items={matrix.submarket} borderColor={BT2.met.occupancy} />
        <Column title="MSA / METRO" icon={Building2} items={matrix.msa} borderColor={BT2.text.purple} />
      </div>
    </div>
  );
}

function EconomySection({ data }: { data: any }) {
  if (!data) return null;

  const healthColor = data.healthScore >= 70 ? BT2.met.occupancy : data.healthScore >= 50 ? BT2.text.amber : BT2.text.red;

  const metrics = [
    { label: 'Economic Health', value: data.healthScore?.toString() || 'N/A', unit: '/100', trend: data.healthTrend, icon: Activity, color: healthColor },
    { label: 'Jobs Added (12mo)', value: data.metrics?.jobsAdded?.value || 'N/A', unit: '', trend: data.metrics?.jobsAdded?.trend, icon: Briefcase, color: BT2.met.occupancy },
    { label: 'Wage Growth', value: data.metrics?.wageGrowth?.value || 'N/A', unit: '', trend: data.metrics?.wageGrowth?.trend, icon: DollarSign, color: BT2.met.occupancy },
    { label: 'Net Migration', value: data.metrics?.netMigration?.value || 'N/A', unit: '', trend: data.metrics?.netMigration?.trend, icon: Users, color: BT2.text.purple },
    { label: 'Affordability', value: data.metrics?.affordabilityRatio?.value || 'N/A', unit: '', trend: data.metrics?.affordabilityRatio?.detail, icon: Home, color: data.metrics?.affordabilityRatio?.status === 'green' ? BT2.met.occupancy : data.metrics?.affordabilityRatio?.status === 'red' ? BT2.text.red : BT2.text.amber },
  ];

  return (
    <div style={{ background: BT2.bg.panel }}>
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <Briefcase size={13} color={BT2.met.economic} />
        <span style={{ fontSize: 10, fontWeight: 700, color: BT2.met.economic, letterSpacing: 1, fontFamily: 'var(--bt-mono)' }}>LOCAL ECONOMY</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BT2.border.subtle }}>
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} style={{ background: BT2.bg.panel, padding: '10px 8px', textAlign: 'center' }}>
              <Icon size={14} color={m.color} style={{ margin: '0 auto 4px' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: m.color, fontFamily: 'var(--bt-mono)' }}>{m.value}{m.unit}</div>
              <div style={{ fontSize: 9, color: BT2.text.muted, fontWeight: 600, letterSpacing: 0.8, marginTop: 2, fontFamily: 'var(--bt-mono)' }}>{m.label.toUpperCase()}</div>
              {m.trend && <div style={{ fontSize: 9, color: BT2.text.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--bt-mono)' }}>{m.trend}</div>}
            </div>
          );
        })}
      </div>

      {data.healthInsight && (
        <div style={{ padding: '8px 16px', borderTop: `1px solid ${BT2.border.subtle}` }}>
          <div style={{ padding: '6px 10px', borderRadius: 4, border: `1px solid ${healthColor}30`, background: `${healthColor}08`, fontSize: 11, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', lineHeight: 1.5 }}>
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
    <SectionPanel title="MAJOR EMPLOYERS" subtitle="No data available" borderColor={BT2.text.purple}>
      <div style={{ padding: '12px 0', fontSize: 10, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>
        Upload an OM or enable news intelligence to populate.
      </div>
    </SectionPanel>
  );

  const statusColors: Record<string, string> = { expanding: BT2.met.occupancy, stable: BT2.text.cyan, watch: BT2.text.amber, contracting: BT2.text.red };
  const statusIcons: Record<string, string> = { expanding: '▲', stable: '●', watch: '◆', contracting: '▼' };

  return (
    <SectionPanel title="MAJOR EMPLOYERS" subtitle={`${employers.length} tracked`} borderColor={BT2.text.purple}>
      {employers.map((emp, i) => (
        <div key={i} style={{ padding: '6px 0', borderBottom: i < employers.length - 1 ? `1px solid ${BT2.border.subtle}` : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: BT2.text.primary, fontFamily: 'var(--bt-mono)' }}>{emp.name}</span>
              <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 2, background: '#1a1228', border: '1px solid #4C1D95', color: '#C4B5FD', fontFamily: 'var(--bt-mono)' }}>{emp.industry}</span>
            </div>
            <span style={{ fontSize: 9, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{emp.sourceType}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 10, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>
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
      <div style={{ padding: '8px 0', fontSize: 10, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>No pipeline data available.</div>
    </SectionPanel>
  );

  return (
    <SectionPanel title="DEV PIPELINE" subtitle={`${pipeline.length} projects`} borderColor={BT2.text.amber}>
      {pipeline.map((proj, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < pipeline.length - 1 ? `1px solid ${BT2.border.subtle}` : 'none' }}>
          <span style={{ fontSize: 14 }}>{proj.type === 'Infrastructure' ? '🚲' : proj.type === 'Corporate' ? '🏢' : proj.type === 'Residential' ? '🏠' : '🏗️'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: BT2.text.primary, fontFamily: 'var(--bt-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.project}</div>
            <div style={{ fontSize: 9, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.impact}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: BT2.text.purple, fontFamily: 'var(--bt-mono)' }}>{proj.timeline}</div>
            <span style={{
              fontSize: 9, fontWeight: 600, padding: '1px 4px', borderRadius: 2, fontFamily: 'var(--bt-mono)',
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
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
          <span style={{ fontSize: 9, color: BT2.text.muted, width: 80, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--bt-mono)' }}>{ind.name}</span>
          <div style={{ flex: 1, height: 10, background: BT2.bg.terminal, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: barColors[i % barColors.length], opacity: 0.65, width: `${ind.pct}%` }} />
          </div>
          <span style={{ fontSize: 9, fontWeight: 600, color: BT2.text.secondary, width: 28, fontFamily: 'var(--bt-mono)' }}>{ind.pct}%</span>
          <span style={{ fontSize: 9, fontWeight: 600, width: 32, fontFamily: 'var(--bt-mono)', color: trendColors[ind.trend] || BT2.text.muted }}>{ind.growth}</span>
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
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <Activity size={12} color={BT2.text.amber} />
        <span style={{ fontSize: 10, fontWeight: 700, color: BT2.text.amber, letterSpacing: 1, fontFamily: 'var(--bt-mono)' }}>WAGE-RENT-TRAFFIC ALIGNMENT</span>
        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 2, background: `${BT2.text.purple}15`, color: BT2.text.purple, fontFamily: 'var(--bt-mono)' }}>CORRELATION ENGINE</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: BT2.border.subtle }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: BT2.bg.panel, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: item.color, fontFamily: 'var(--bt-mono)' }}>{item.value || 'N/A'}</div>
            <div style={{ fontSize: 9, color: BT2.text.muted, fontWeight: 600, marginTop: 2, fontFamily: 'var(--bt-mono)', letterSpacing: 0.5 }}>{item.label}</div>
          </div>
        ))}
      </div>
      {alignment.insight && (
        <div style={{ padding: '8px 16px' }}>
          <div style={{ padding: '6px 10px', borderRadius: 4, border: `1px solid ${BT2.text.purple}30`, background: `${BT2.text.purple}08`, fontSize: 11, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', lineHeight: 1.5 }}>
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
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <Users size={13} color={BT2.text.purple} />
        <span style={{ fontSize: 10, fontWeight: 700, color: BT2.text.purple, letterSpacing: 1, fontFamily: 'var(--bt-mono)' }}>DEMOGRAPHICS & DEMAND</span>
      </div>

      {census && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: BT2.border.subtle, borderBottom: `1px solid ${BT2.border.subtle}` }}>
          {[
            { label: 'POPULATION', value: census.population?.toLocaleString(), icon: Users },
            { label: 'MEDIAN INCOME', value: census.medianIncome ? `$${census.medianIncome.toLocaleString()}` : 'N/A', icon: DollarSign },
            { label: 'HOUSING UNITS', value: census.totalHousingUnits?.toLocaleString(), icon: Home },
            { label: 'MEDIAN RENT', value: census.medianRent ? `$${census.medianRent.toLocaleString()}` : 'N/A', icon: DollarSign },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} style={{ background: BT2.bg.panel, padding: '10px 8px', textAlign: 'center' }}>
                <Icon size={12} color={BT2.text.purple} style={{ margin: '0 auto 3px' }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: BT2.text.primary, fontFamily: 'var(--bt-mono)' }}>{item.value || 'N/A'}</div>
                <div style={{ fontSize: 9, color: BT2.text.muted, fontWeight: 600, letterSpacing: 0.8, marginTop: 2, fontFamily: 'var(--bt-mono)' }}>{item.label}</div>
              </div>
            );
          })}
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
            <SectionPanel title={`MSA: ${data.msa.name}`} subtitle="Metro area" borderColor={BT2.text.purple}>
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
          <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BT2.border.subtle}` }}>
            <Building2 size={12} color={BT2.text.amber} />
            <span style={{ fontSize: 10, fontWeight: 700, color: BT2.text.amber, letterSpacing: 1, fontFamily: 'var(--bt-mono)' }}>COMPETITIVE SUPPLY</span>
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 2, background: `${BT2.text.amber}15`, color: BT2.text.amber, fontFamily: 'var(--bt-mono)' }}>{supply.radiusMiles}mi radius</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BT2.border.subtle }}>
            {[
              { label: 'PROPERTIES', value: supply.competingProperties.count?.toString() },
              { label: 'AVG UNITS', value: supply.competingProperties.avgUnits?.toString() },
              { label: 'AVG OCCUPANCY', value: supply.competingProperties.avgOccupancy ? `${supply.competingProperties.avgOccupancy}%` : 'N/A' },
              { label: 'AVG RENT', value: supply.competingProperties.avgRent ? `$${supply.competingProperties.avgRent.toLocaleString()}` : 'N/A' },
              { label: 'PIPELINE UNITS', value: supply.competingProperties.totalPipelineUnits?.toLocaleString() },
            ].map((item, i) => (
              <div key={i} style={{ background: BT2.bg.panel, padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: BT2.text.primary, fontFamily: 'var(--bt-mono)' }}>{item.value || 'N/A'}</div>
                <div style={{ fontSize: 8, color: BT2.text.muted, fontWeight: 600, letterSpacing: 0.8, marginTop: 2, fontFamily: 'var(--bt-mono)' }}>{item.label}</div>
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
    { label: 'Total Population', value: funnel.totalPopulation, pct: 100, color: BT2.text.muted },
    { label: 'Renters', value: funnel.renters, pct: funnel.renterPct, color: BT2.text.purple },
    { label: 'Income Qualified', value: funnel.incomeQualified, pct: funnel.incomeQualifiedPct, color: BT2.text.cyan },
    { label: 'Age Appropriate', value: funnel.ageAppropriate, pct: funnel.ageAppropriatePct, color: BT2.met.occupancy },
    { label: 'Unit Type Match', value: funnel.unitTypeMatch, pct: funnel.unitTypeMatchPct, color: BT2.met.economic },
  ];

  return (
    <div style={{ borderTop: `1px solid ${BT2.border.subtle}` }}>
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <Users size={12} color={BT2.text.cyan} />
        <span style={{ fontSize: 10, fontWeight: 700, color: BT2.text.cyan, letterSpacing: 1, fontFamily: 'var(--bt-mono)' }}>RENTER DEMAND FUNNEL</span>
      </div>
      <div style={{ padding: '10px 16px' }}>
        {steps.map((step, i) => {
          const width = i === 0 ? 100 : steps.slice(1, i + 1).reduce((acc, s) => acc * (s.pct / 100), 100);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: BT2.text.muted, width: 90, textAlign: 'right', fontFamily: 'var(--bt-mono)', fontWeight: 600 }}>{step.label}</span>
              <div style={{ flex: 1, height: 18, background: BT2.bg.terminal, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', borderRadius: 3, background: step.color, opacity: 0.5, width: `${width}%`, transition: 'width 0.5s' }} />
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: BT2.text.primary, fontFamily: 'var(--bt-mono)' }}>
                  {step.value}
                </span>
              </div>
              {i > 0 && <span style={{ fontSize: 9, color: BT2.text.muted, width: 28, fontFamily: 'var(--bt-mono)' }}>{step.pct}%</span>}
            </div>
          );
        })}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <div style={{ textAlign: 'center', padding: '8px', borderRadius: 4, border: `1px solid ${BT2.met.occupancy}40`, background: `${BT2.met.occupancy}10` }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: BT2.met.occupancy, fontFamily: 'var(--bt-mono)' }}>{funnel.demandPool}</div>
            <div style={{ fontSize: 9, color: BT2.met.occupancy, fontWeight: 600, fontFamily: 'var(--bt-mono)' }}>QUALIFIED DEMAND POOL</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px', borderRadius: 4, border: `1px solid ${BT2.text.purple}40`, background: `${BT2.text.purple}10` }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: BT2.text.purple, fontFamily: 'var(--bt-mono)' }}>{funnel.captureRate}</div>
            <div style={{ fontSize: 9, color: BT2.text.purple, fontWeight: 600, fontFamily: 'var(--bt-mono)' }}>CAPTURE RATE</div>
          </div>
        </div>
        {funnel.captureInsight && (
          <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 4, border: `1px solid ${BT2.text.purple}30`, background: `${BT2.text.purple}08`, fontSize: 11, color: BT2.text.secondary, fontFamily: 'var(--bt-mono)', lineHeight: 1.5 }}>
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
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Newspaper size={13} color={BT2.text.muted} />
        <span style={{ fontSize: 10, fontWeight: 700, color: BT2.text.muted, letterSpacing: 1, fontFamily: 'var(--bt-mono)' }}>NEWS FEED</span>
        <span style={{ fontSize: 9, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>No events tracked</span>
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
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BT2.border.subtle}` }}>
        <Newspaper size={13} color={BT2.text.amber} />
        <span style={{ fontSize: 10, fontWeight: 700, color: BT2.text.amber, letterSpacing: 1, fontFamily: 'var(--bt-mono)' }}>NEWS FEED</span>
        <span style={{ fontSize: 9, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{events.length} events</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
          {Object.entries(typeConfig).map(([type, cfg]) => {
            const count = events.filter(e => e.type === type).length;
            if (count === 0) return null;
            return (
              <span key={type} style={{ fontSize: 9, fontWeight: 600, color: cfg.color, fontFamily: 'var(--bt-mono)' }}>
                {cfg.icon}{count}
              </span>
            );
          })}
        </div>
      </div>

      {shown.map((event, i) => {
        const cfg = typeConfig[event.type] || typeConfig.ECONOMIC;
        return (
          <div key={i} style={{ padding: '8px 16px', borderBottom: `1px solid ${BT2.border.subtle}`, display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: cfg.color, fontFamily: 'var(--bt-mono)' }}>
                  {cfg.icon} {event.type}
                </span>
                <span style={{ fontSize: 9, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{event.category}/{event.eventType?.replace(/_/g, ' ')}</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: BT2.text.primary, fontFamily: 'var(--bt-mono)', marginBottom: 2 }}>{event.headline}</div>
              {event.extractedData && (
                <div style={{ display: 'flex', gap: 10, fontSize: 9, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>
                  {event.extractedData.company_name && <span>Company: {event.extractedData.company_name}</span>}
                  {event.extractedData.employee_count && <span>Employees: {event.extractedData.employee_count.toLocaleString()}</span>}
                  {event.extractedData.unit_count && <span>Units: {event.extractedData.unit_count}</span>}
                  {event.extractedData.total_investment && <span>Investment: ${(event.extractedData.total_investment / 1000000).toFixed(0)}M</span>}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{event.date ? new Date(event.date).toLocaleDateString() : ''}</div>
              <div style={{ fontSize: 9, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{event.city}, {event.state}</div>
              {event.source && <div style={{ fontSize: 9, color: BT2.text.muted, fontFamily: 'var(--bt-mono)', marginTop: 1 }}>via {event.source}</div>}
            </div>
          </div>
        );
      })}

      {events.length > 5 && (
        <div style={{ padding: '6px 16px', textAlign: 'center' }}>
          <button onClick={() => setExpanded(!expanded)} style={{
            background: 'transparent', border: `1px solid ${BT2.border.subtle}`, borderRadius: 3,
            padding: '3px 12px', fontSize: 9, color: BT2.text.cyan, cursor: 'pointer', fontFamily: 'var(--bt-mono)', fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            {expanded ? <><ChevronUp size={10} /> SHOW LESS</> : <><ChevronDown size={10} /> SHOW ALL {events.length} EVENTS</>}
          </button>
        </div>
      )}
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <span style={{ fontSize: 11, color: BT2.text.muted, fontFamily: 'var(--bt-mono)' }}>{message}</span>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <AlertTriangle size={28} color={BT2.text.red} style={{ marginBottom: 10 }} />
      <span style={{ fontSize: 11, color: BT2.text.muted, marginBottom: 10, fontFamily: 'var(--bt-mono)' }}>{message}</span>
      <button onClick={onRetry} style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px',
        fontSize: 10, fontWeight: 600, color: BT2.text.cyan, background: 'transparent',
        border: `1px solid ${BT2.text.cyan}40`, borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--bt-mono)',
      }}>
        <RefreshCw size={10} /> RETRY
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ background: BT2.bg.terminal }}>
      <div style={{ background: BT2.bg.panel, borderLeft: `4px solid ${BT2.text.purple}`, borderRadius: '4px 4px 0 0', padding: '12px 16px' }}>
        <div style={{ height: 16, width: 180, background: BT2.border.subtle, borderRadius: 3 }} />
        <div style={{ height: 10, width: 260, background: BT2.bg.terminal, borderRadius: 3, marginTop: 6 }} />
      </div>
      <div style={{ background: BT2.bg.panel, borderTop: `1px solid ${BT2.border.subtle}`, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 28, width: 100, background: BT2.bg.terminal, borderRadius: 3 }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
          {[1, 2, 3, 4, 5].map(i => <div key={i} style={{ height: 60, background: BT2.bg.terminal, borderRadius: 4 }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ height: 180, background: BT2.bg.terminal, borderRadius: 4 }} />
          <div style={{ height: 180, background: BT2.bg.terminal, borderRadius: 4 }} />
        </div>
      </div>
    </div>
  );
}

export default MarketIntelligencePage;
