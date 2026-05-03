import React, { useState, useEffect, useCallback } from 'react';
import { useDealModule } from '../../../contexts/DealModuleContext';
import { dealAnalysisService, AnalysisStatus, StrategyResults } from '@/services/dealAnalysis.service';
import { apiClient } from '@/services/api.client';
import {
  type JEDIScoreData,
  type SignalScore,
} from '@/data/enhancedOverviewMockData';
import { mono as bMono } from '../bloomberg-tokens';
import {
  Spark, Bd, MetricTag, SectionPanel, DataRow, PanelHeader,
  BT_CSS, AlertBanner, BT as BTV,
} from '../bloomberg-ui';
import { AlertCounter, IdentityGateBanner } from '../AlertCounter';
import { OverviewRouter } from '../OverviewRouter';
import { TradePressWidget } from '../TradePressWidget';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: bMono };

function scoreColor(s: number) {
  return s >= 80 ? BTV.text.green : s >= 65 ? BTV.text.amber : BTV.text.red;
}

function scoreToVerdict(score: number): string {
  if (score >= 85) return 'STRONG BUY';
  if (score >= 70) return 'OPPORTUNITY';
  if (score >= 55) return 'HOLD / MONITOR';
  return 'CAUTION';
}

function buildSignalsFromBreakdown(breakdown: any): SignalScore[] {
  const defs = [
    { id: 'demand',   name: 'DEMAND',   weight: 30, moduleLink: 'demand' },
    { id: 'supply',   name: 'SUPPLY',   weight: 25, moduleLink: 'supply' },
    { id: 'momentum', name: 'MOMENTUM', weight: 20, moduleLink: 'market-intelligence' },
    { id: 'position', name: 'POSITION', weight: 15, moduleLink: 'market-intelligence' },
    { id: 'risk',     name: 'RISK',     weight: 10, moduleLink: 'risk-management' },
  ];
  return defs.map(def => {
    const d = breakdown?.[def.id];
    const score = Math.round(d?.score ?? 50);
    const w = Math.round((d?.weight != null ? d.weight * 100 : def.weight));
    return {
      ...def,
      weight: w || def.weight,
      score,
      weighted: Math.round(score * ((w || def.weight) / 100) * 10) / 10,
      trend: 'flat' as const,
      trendDelta: 0,
      color: '',
      bgColor: '',
      description: d?.note || `${def.name} signal: ${score}/100`,
    };
  });
}

const SIGNAL_SOURCES: Record<string, Array<{ l: string; c: string }>> = {
  DEMAND:   [{ l: 'Jobs Growth', c: BTV.met.economic }, { l: 'Pop Inflow', c: BTV.met.economic }, { l: 'Digital Search', c: BTV.met.digTraffic }],
  SUPPLY:   [{ l: 'Pipeline %', c: BTV.met.supply }, { l: 'Permits', c: BTV.met.supply }, { l: 'Mo Supply', c: BTV.met.occupancy }],
  MOMENTUM: [{ l: 'Rent Growth', c: BTV.met.financial }, { l: 'Absorption', c: BTV.met.occupancy }, { l: 'Traffic Surge', c: BTV.met.physTraffic }],
  POSITION: [{ l: 'TPI Score', c: BTV.met.compTraffic }, { l: 'Dig Share', c: BTV.met.digTraffic }, { l: 'Rent Prem', c: BTV.met.financial }],
  RISK:     [{ l: 'Occupancy', c: BTV.met.occupancy }, { l: 'Concentration', c: BTV.met.financial }, { l: 'Sentiment', c: BTV.met.quality }],
};

function fmtAgo(ts: string | number): string {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return '<1h';
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function dollar(v: number | null | undefined): string {
  if (v == null || isNaN(v as number)) return '$--';
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${v.toLocaleString()}`;
}


// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skel: React.FC<{ w?: number | string; h?: number }> = ({ w = '100%', h = 10 }) => (
  <div style={{
    width: w, height: h,
    background: `${BTV.border.medium}50`,
    borderRadius: 2,
    animation: 'bt-pulse 1.5s infinite',
  }} />
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface BloombergOverviewSectionProps {
  deal: Record<string, unknown>;
  onTabChange?: (tabId: string) => void;
  geographicContext?: Record<string, unknown>;
  onUpdate?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const BloombergOverviewSection: React.FC<BloombergOverviewSectionProps> = ({
  deal,
  onTabChange,
  geographicContext,
  onUpdate,
}) => {
  const {
    capitalStructure, financial, market,
    assumptions, computedReturns,
  } = useDealModule();

  const [jediScoreData, setJediScoreData] = useState<JEDIScoreData | null>(null);
  const [signals, setSignals] = useState<SignalScore[]>([]);
  const [capitalStackData, setCapitalStackData] = useState<any>(null);
  const [strategyResults, setStrategyResults] = useState<StrategyResults | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [scoreLoading, setScoreLoading] = useState(true);
  const [uwEvidenceSummary, setUwEvidenceSummary] = useState<{
    severe_count: number;
    material_count: number;
    minor_count: number;
    field_count: number;
    latest_run_at: string | null;
  } | null>(null);
  const [dismissedCollisionKey, setDismissedCollisionKey] = useState<string | null>(() => {
    try { return localStorage.getItem(`collision_dismissed:${deal?.id ?? ''}`); } catch { return null; }
  });

  useEffect(() => {
    try { setDismissedCollisionKey(localStorage.getItem(`collision_dismissed:${deal?.id ?? ''}`)); } catch { /* ignore */ }
  }, [deal?.id]);

  // Load JEDI Score
  const loadJediScore = useCallback(async () => {
    if (!deal?.id) return;
    setScoreLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/jedi/score/${deal.id}`);
      const s = res.data?.data?.score;
      if (s) {
        const total = s.totalScore ?? s.total_score ?? 0;
        const delta = s.scoreDelta ?? s.score_delta ?? 0;
        setJediScoreData({
          score: Math.round(total),
          delta30d: Math.round(delta),
          verdict: scoreToVerdict(total),
          verdictColor: '',
          confidence: 85,
          confidenceLabel: total >= 70 ? 'High' : 'Medium',
          dataCompleteness: 85,
          lastUpdated: 'Just now',
        });
        if (res.data?.data?.breakdown) {
          setSignals(buildSignalsFromBreakdown(res.data.data.breakdown));
        } else {
          setSignals(buildSignalsFromBreakdown(null));
        }
      } else {
        setJediScoreData(null);
        setSignals(buildSignalsFromBreakdown(null));
      }
    } catch {
      setJediScoreData(null);
      setSignals(buildSignalsFromBreakdown(null));
    } finally {
      setScoreLoading(false);
    }
  }, [deal?.id]);

  // Load Capital Stack
  const loadCapitalStack = useCallback(async () => {
    if (!deal?.id) return;
    const strategy = deal.strategyType || deal.strategy || 'value_add';
    const totalCost = deal.purchasePrice || deal.budget || 0;
    const noi = deal.noi || deal.strategyDefaults?.assumptions?.noi || 0;
    if (!totalCost) return;
    try {
      const res = await apiClient.post('/api/v1/capital-structure/stack', {
        dealId: deal.id, strategy,
        layers: [
          { type: 'senior_debt', amount: totalCost * 0.65 },
          { type: 'equity', amount: totalCost * 0.35 },
        ],
        uses: { acquisition: totalCost }, noi,
      });
      if (res.data?.data || res.data?.stack || res.data?.layers) {
        setCapitalStackData(res.data?.data ?? res.data);
      }
    } catch { /* silent */ }
  }, [deal?.id, deal?.strategyType, deal?.strategy, deal?.purchasePrice, deal?.budget, deal?.noi, deal?.strategyDefaults]);

  // Restore full strategy analysis lifecycle (trigger + poll if no cached result)
  const loadStrategy = useCallback(async (): Promise<(() => void) | undefined> => {
    if (!deal?.id) return;
    try {
      const existing = await dealAnalysisService.getLatestAnalysis(deal.id);
      if (existing) {
        setStrategyResults(existing);
        return;
      }
      // No cached result — trigger analysis then poll
      await dealAnalysisService.triggerAnalysis(deal.id);
      const stopPolling = dealAnalysisService.pollAnalysisStatus(
        deal.id,
        (_status: AnalysisStatus) => { /* status updates not displayed here */ },
        (results: StrategyResults) => setStrategyResults(results),
        3000,
      );
      return stopPolling;
    } catch { /* silent */ }
  }, [deal?.id]);

  // Load Team
  const loadTeam = useCallback(async () => {
    if (!deal?.id) return;
    try {
      const res = await apiClient.get(`/api/v1/deals/${deal.id}/team`);
      const members = res.data?.data || res.data?.members || res.data || [];
      if (Array.isArray(members)) setTeamMembers(members);
    } catch { /* silent */ }
  }, [deal?.id]);

  // Load Activity
  const loadActivity = useCallback(async () => {
    if (!deal?.id) return;
    try {
      const res = await apiClient.get(`/api/v1/deals/${deal.id}/activity`);
      const items = res.data?.data || res.data?.activities || res.data || [];
      if (Array.isArray(items)) setActivity(items.slice(0, 6));
    } catch { /* silent */ }
  }, [deal?.id]);

  // Load underwriting evidence summary for collision banner
  const loadUwEvidenceSummary = useCallback(async () => {
    if (!deal?.id) return;
    try {
      const res = await apiClient.get(`/api/v1/deals/${deal.id}/underwriting/evidence-summary`);
      const d = res.data?.data ?? res.data ?? null;
      if (d) {
        const cs = (d.collision_summary as Record<string, unknown>) ?? {};
        setUwEvidenceSummary({
          severe_count: Number(cs.severe_count ?? 0),
          material_count: Number(cs.material_count ?? 0),
          minor_count: Number(cs.minor_count ?? 0),
          field_count: Number(d.field_count ?? 0),
          latest_run_at: (d.latest_run_at as string | null) ?? null,
        });
      }
    } catch { /* non-blocking — banner is optional */ }
  }, [deal?.id]);

  useEffect(() => {
    if (!deal?.id) return;
    let stopPolling: (() => void) | undefined;
    loadJediScore();
    loadCapitalStack();
    loadTeam();
    loadActivity();
    loadUwEvidenceSummary();
    (async () => { stopPolling = await loadStrategy(); })();
    return () => { stopPolling?.(); };
  }, [deal?.id]);

  // ─── Collision banner dismiss ────────────────────────────────────────────────

  const collisionRunKey = uwEvidenceSummary?.latest_run_at ?? null;
  const isBannerDismissed = collisionRunKey != null && dismissedCollisionKey === collisionRunKey;

  const handleDismissCollisionBanner = useCallback(() => {
    if (!deal?.id || !collisionRunKey) return;
    try { localStorage.setItem(`collision_dismissed:${deal.id}`, collisionRunKey); } catch { /* ignore */ }
    setDismissedCollisionKey(collisionRunKey);
  }, [deal?.id, collisionRunKey]);

  // ─── Derived values ─────────────────────────────────────────────────────────

  const score = jediScoreData?.score ?? 0;
  const sc = jediScoreData ? scoreColor(score) : BTV.text.secondary;

  const price = deal?.purchasePrice ? dollar(deal.purchasePrice)
    : deal?.budget ? dollar(deal.budget) : '$--';

  const extDealData = deal?.deal_data as Record<string, unknown> | null;
  const extRRUnits = (extDealData?.extraction_rent_roll as Record<string, unknown> | undefined)?.totalUnits ?? (extDealData?.extraction_rent_roll as Record<string, unknown> | undefined)?.total_units;
  const units = deal?.units || deal?.targetUnits || (extRRUnits != null ? Number(extRRUnits) : 0);
  const ppuNum = units > 0 && deal?.purchasePrice ? Math.round(deal.purchasePrice / units) : null;
  const ppuStr = ppuNum != null ? `$${ppuNum.toLocaleString()}` : '$--';

  const irrNum: number | null = computedReturns?.irr ?? financial?.irr ?? null;
  const irrStr = irrNum != null ? `${(irrNum * 100).toFixed(1)}%` : '—';

  const emNum: number | null = computedReturns?.equityMultiple ?? financial?.equityMultiple ?? null;
  const emStr = emNum != null ? `${emNum.toFixed(2)}x` : '—';

  const acreage = deal?.acreage || deal?.lotAcres || deal?.siteAcres || null;

  // Arbitrage banner
  const arbitrageGap = (() => {
    if (!strategyResults?.strategies?.length) return 0;
    const recId = strategyResults.recommendedStrategyId;
    const strats = strategyResults.strategies;
    const rec = strats.find((s: any) => s.id === recId) || strats[0];
    const sorted = [...strats].sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0));
    const second = sorted.find((s: any) => s.id !== rec?.id);
    return second ? Math.round((rec?.confidence || 0) - (second?.confidence || 0)) : 0;
  })();
  const recStrategyLabel = (() => {
    if (!strategyResults?.strategies?.length) return null;
    const recId = strategyResults.recommendedStrategyId;
    return strategyResults.strategies.find((s: any) => s.id === recId)?.name || null;
  })();
  const altStrategyLabel = (() => {
    if (!strategyResults?.strategies?.length) return null;
    const recId = strategyResults.recommendedStrategyId;
    const sorted = [...strategyResults.strategies].sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0));
    return sorted.find((s: any) => s.id !== recId)?.name || null;
  })();

  // COLLISION banner: broker vs platform IRR/vacancy divergence
  const brokerIRR: number | null = deal?.deal_data?.broker_irr ?? deal?.brokerIrr ?? null;
  const platformIRR: number | null = irrNum;
  const brokerVacancy: number | null = deal?.strategyDefaults?.assumptions?.vacancy ?? deal?.vacancy ?? null;
  const platformVacancy: number | null = market?.occupancy != null ? 100 - market.occupancy : null;
  const irrDivergence = brokerIRR != null && platformIRR != null
    ? Math.abs(brokerIRR - platformIRR * 100)
    : null;
  const vacancyDivergence = brokerVacancy != null && platformVacancy != null
    ? Math.abs(brokerVacancy - platformVacancy)
    : null;
  const showCollision = (irrDivergence != null && irrDivergence > 3) ||
    (vacancyDivergence != null && vacancyDivergence > 2);
  const collisionMsg = (() => {
    const parts = [];
    if (irrDivergence != null && irrDivergence > 3) {
      parts.push(`Broker IRR ${brokerIRR?.toFixed(1)}% vs platform ${((platformIRR ?? 0) * 100).toFixed(1)}% (${irrDivergence.toFixed(0)}bps gap)`);
    }
    if (vacancyDivergence != null && vacancyDivergence > 2) {
      parts.push(`Vacancy divergence ${vacancyDivergence.toFixed(1)}pp — verify broker underwriting`);
    }
    return parts.join('. ') || 'Broker and platform assumptions diverge materially.';
  })();

  // Row 3 — Assumptions table: Rent/unit, Vacancy, OpEx ratio, Cap Rate, Exit Year, IRR
  // Extract platform data from deal_data extraction capsule (T12, Rent Roll)
  const dData = deal?.deal_data as Record<string, unknown> | null;
  const extT12 = dData?.extraction_t12 as Record<string, unknown> | undefined;
  const extRR = dData?.extraction_rent_roll as Record<string, unknown> | undefined;

  // Rent/unit = $/unit/month (not rent growth %)
  const rentUnitBroker: string = (() => {
    const v = (deal?.strategyDefaults as Record<string, unknown>)?.assumptions
      ? ((deal.strategyDefaults as Record<string, unknown>).assumptions as Record<string, unknown>)?.rentPerUnit
      : null;
    if (v != null) return `$${Number(v).toLocaleString()}`;
    const rentPsf = deal?.rentPerSf as number | null;
    if (rentPsf != null && units > 0) return `$${Math.round(rentPsf * 900)}/mo`;
    return '—';
  })();
  const rentUnitPlatform: string = (() => {
    if (market?.avgRent != null) return `$${Math.round(market.avgRent as number).toLocaleString()}/mo`;
    if (assumptions?.rentPerUnit != null) return `$${Math.round(assumptions.rentPerUnit as number).toLocaleString()}/mo`;
    const rrAvg = extRR?.avg_effective_rent ?? extRR?.avgEffectiveRent ?? extRR?.avg_market_rent ?? extRR?.avgMarketRent;
    if (rrAvg != null) return `$${Math.round(Number(rrAvg)).toLocaleString()}/mo`;
    return '—';
  })();

  const vacancyBroker = brokerVacancy != null ? `${brokerVacancy.toFixed(1)}%` : '—';
  const vacancyPlatform: string = (() => {
    if (platformVacancy != null) return `${platformVacancy.toFixed(1)}%`;
    const rrOcc = extRR?.occupancy_by_unit_pct ?? extRR?.occupancyRate;
    if (rrOcc != null) return `${(100 - Number(rrOcc) * 100).toFixed(1)}%`;
    return '—';
  })();

  const opexBroker = (() => {
    const assumptions_ = (deal?.strategyDefaults as Record<string, unknown>)?.assumptions as Record<string, unknown> | undefined;
    if (assumptions_?.opexRatio != null) return `${assumptions_.opexRatio}%`;
    if (dData?.opex_ratio != null) return `${dData.opex_ratio}%`;
    return '—';
  })();
  const opexPlatform = (() => {
    if (assumptions?.opexRatio != null) return `${assumptions.opexRatio}%`;
    const t12Ratio = extT12?.expenseRatio ?? extT12?.expense_ratio;
    if (t12Ratio != null) return `${(Number(t12Ratio) * 100).toFixed(0)}%`;
    if (financial?.noi != null && deal?.purchasePrice) return '38%';
    return '—';
  })();

  const capRateBroker = deal?.capRate != null ? `${deal.capRate}%` : '—';
  const capRatePlatform = assumptions?.capRate != null ? `${assumptions.capRate}%`
    : (() => {
        const assumptions_ = (deal?.strategyDefaults as Record<string, unknown>)?.assumptions as Record<string, unknown> | undefined;
        return assumptions_?.capRate != null ? `${assumptions_.capRate}%` : '—';
      })();

  const exitYearBroker = (() => {
    const assumptions_ = (deal?.strategyDefaults as Record<string, unknown>)?.assumptions as Record<string, unknown> | undefined;
    return assumptions_?.holdPeriod != null ? `${assumptions_.holdPeriod}yr` : '—';
  })();
  const exitYearPlatform = assumptions?.holdPeriod != null ? `${assumptions.holdPeriod}yr` : '—';

  const irrBroker = brokerIRR != null ? `${brokerIRR.toFixed(1)}%` : '—';
  const irrUser = irrNum != null ? irrStr : '—';

  const rentFlag = rentUnitBroker !== '—' && rentUnitPlatform !== '—' &&
    Math.abs(parseFloat(rentUnitBroker.replace(/[^0-9.]/g, '')) - parseFloat(rentUnitPlatform.replace(/[^0-9.]/g, ''))) > 50;
  const vacFlag = vacancyBroker !== '—' && vacancyPlatform !== '—' &&
    Math.abs(parseFloat(vacancyBroker) - parseFloat(vacancyPlatform)) > 2;
  const opexFlag = opexBroker !== '—' && opexPlatform !== '—' &&
    Math.abs(parseFloat(opexBroker) - parseFloat(opexPlatform)) > 3;
  const capFlag = capRateBroker !== '—' && capRatePlatform !== '—' &&
    Math.abs(parseFloat(capRateBroker) - parseFloat(capRatePlatform)) > 0.3;

  const assumptionRows = [
    { a: 'RENT/UNIT', b: rentUnitBroker, p: rentUnitPlatform, u: '—', flag: rentFlag, mc: BTV.met.financial },
    { a: 'VACANCY', b: vacancyBroker, p: vacancyPlatform, u: '—', flag: vacFlag, mc: BTV.met.occupancy },
    { a: 'OPEX RATIO', b: opexBroker, p: opexPlatform, u: '—', flag: opexFlag, mc: BTV.met.financial },
    { a: 'CAP RATE', b: capRateBroker, p: capRatePlatform, u: '—', flag: capFlag, mc: BTV.met.financial },
    { a: 'EXIT YEAR', b: exitYearBroker, p: exitYearPlatform, u: '—', flag: false },
    { a: 'IRR', b: irrBroker, p: irrStr, u: irrUser, flag: irrDivergence != null && irrDivergence > 3, mc: BTV.met.financial },
  ];

  // Capital / Financials
  const stackLayers = capitalStackData?.stack || capitalStackData?.layers || capitalStackData?.data?.stack || [];
  const seniorLayer = stackLayers.find?.((l: any) => l.type === 'senior_debt' || l.name?.toLowerCase().includes('senior'));
  const equityLayer = stackLayers.find?.((l: any) => l.type === 'equity' || l.name?.toLowerCase().includes('equity'));

  const goingInCap = deal?.capRate ? `${deal.capRate}%`
    : capitalStackData?.goingInCapRate ? `${capitalStackData.goingInCapRate.toFixed(2)}%` : '$--'.replace('$', '') || '—';
  const stabilizedNOI = financial?.noi ? dollar(financial.noi)
    : computedReturns?.noi ? dollar(computedReturns.noi) : '$--';
  const debtServiceNum = capitalStructure?.debtService ?? (seniorLayer?.amount ? seniorLayer.amount * 0.065 : null);
  const debtServiceStr = debtServiceNum != null ? dollar(debtServiceNum) : '$--';
  const dscrVal = capitalStructure?.dscr ? `${capitalStructure.dscr.toFixed(2)}x` : '—';
  const ltcVal = capitalStructure?.ltc ? `${capitalStructure.ltc}%`
    : seniorLayer?.amount && deal?.purchasePrice
    ? `${Math.round((seniorLayer.amount / deal.purchasePrice) * 100)}%` : '—';
  const equityReqNum = equityLayer?.amount ?? capitalStructure?.totalEquity ?? (deal?.purchasePrice ? deal.purchasePrice * 0.35 : null);
  const equityReqStr = equityReqNum != null ? dollar(equityReqNum) : '$--';

  // AI Brief
  const aiBriefs = (() => {
    const rec = strategyResults?.strategies?.find?.((s: any) => s.id === strategyResults?.recommendedStrategyId)
      || strategyResults?.strategies?.[0];
    const demandSig = signals.find(s => s.id === 'demand');
    const supplySig = signals.find(s => s.id === 'supply');
    const riskSig   = signals.find(s => s.id === 'risk');
    return [
      { cat: 'DEMAND', msg: demandSig?.description || 'Run market analysis to generate demand intelligence.', c: BTV.text.green },
      { cat: 'SUPPLY', msg: supplySig?.description || 'Supply pipeline data will appear after market scan.', c: BTV.text.amber },
      { cat: 'RISK',   msg: riskSig ? `${riskSig.name} signal at ${riskSig.score}/100. ${showCollision ? collisionMsg : 'No critical divergence detected.'}` : 'Risk signals will populate after analysis.', c: riskSig && riskSig.score < 50 ? BTV.text.red : BTV.text.orange },
      { cat: 'ACTION', msg: rec ? `${rec.name} strategy scores highest (${Math.round(rec.confidence)}/100). ${rec.description || 'Accelerate diligence.'}` : 'Start analysis for recommended action.', c: BTV.text.amber },
    ];
  })();

  // Team
  const teamToShow: any[] = teamMembers.length > 0
    ? teamMembers
    : (deal?.team || deal?.teamMembers || []);

  // Strategy quick scores
  const strategyQuickScores = strategyResults?.strategies?.length
    ? strategyResults.strategies.slice(0, 4).map((s: any) => ({
        l: (s.name || s.id || '').slice(0, 6).toUpperCase(),
        v: Math.round(s.confidence || 0),
        win: s.id === strategyResults.recommendedStrategyId,
      }))
    : null;

  const trendData = [72, 74, 73, 76, 78, 77, 79, 80, score > 0 ? score : 82];

  return (
    <div style={{
      background: BTV.bg.terminal,
      display: 'flex', flexDirection: 'column',
      animation: 'bt-fade 0.15s',
    }}>
      <style>{BT_CSS}</style>

      <IdentityGateBanner />
      <AlertCounter />

      {/* ── Underwriting collision review banner ── */}
      {uwEvidenceSummary && uwEvidenceSummary.severe_count > 0 && !isBannerDismissed && (
        <AlertBanner
          label="REVIEW REQUIRED"
          text={`CashFlow Agent detected ${uwEvidenceSummary.severe_count} severe collision${uwEvidenceSummary.severe_count !== 1 ? 's' : ''}${uwEvidenceSummary.material_count > 0 ? ` and ${uwEvidenceSummary.material_count} material collision${uwEvidenceSummary.material_count !== 1 ? 's' : ''}` : ''} in the latest underwriting run. Open the ProForma tab and click the SEV counter to filter and review flagged fields.`}
          color={BTV.text.red}
          badge={
            <span style={{
              fontFamily: bMono, fontSize: 9, fontWeight: 700,
              color: BTV.text.red,
              background: `${BTV.text.red}15`,
              border: `1px solid ${BTV.text.red}44`,
              padding: '1px 6px', borderRadius: 2,
              whiteSpace: 'nowrap' as const,
            }}>
              {uwEvidenceSummary.severe_count} SEV
            </span>
          }
          onDismiss={handleDismissCollisionBanner}
        />
      )}

      {/* ── Row 1: JEDI Score | 5 Signals | Deal Details ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr 228px', gap: 1, background: BTV.border.subtle, flexShrink: 0 }}>

        {/* Col A — JEDI Score Gauge */}
        <div style={{ background: BTV.bg.panel, padding: '6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ fontSize: 9, color: BTV.text.muted, letterSpacing: 1.5, ...MONO }}>JEDI SCORE</div>
          {scoreLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 0' }}>
              <Skel w={64} h={64} />
              <Skel w={80} h={10} />
            </div>
          ) : (
            <>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                border: `3px solid ${sc}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                boxShadow: `0 0 16px ${sc}33`,
              }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: sc, ...MONO }}>
                  {jediScoreData ? score : '--'}
                </span>
                {jediScoreData?.delta30d != null && (
                  <span style={{ fontSize: 8, color: jediScoreData.delta30d >= 0 ? BTV.text.green : BTV.text.red, fontWeight: 600, ...MONO }}>
                    {jediScoreData.delta30d >= 0 ? '+' : ''}{jediScoreData.delta30d} 30d
                  </span>
                )}
              </div>
              <div style={{ fontSize: 8, color: BTV.text.muted, ...MONO }}>Confidence: {jediScoreData?.confidence ?? '--'}%</div>
              <Spark data={trendData} color={sc} w={90} h={16} />
              <Bd c={sc}>{jediScoreData ? jediScoreData.verdict : 'PENDING'}</Bd>
            </>
          )}
        </div>

        {/* Col B — 5 Master Signals with Platform Metric Sources */}
        <div style={{ background: BTV.bg.panel, padding: '6px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: BTV.text.white, marginBottom: 4, ...MONO }}>
            5 MASTER SIGNALS — PLATFORM METRIC SOURCES
          </div>
          {scoreLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[0,1,2,3,4].map(i => <Skel key={i} w="100%" h={12} />)}
            </div>
          ) : (
            <>
              {signals.map((s) => {
                const c = s.score >= 80 ? BTV.text.green : s.score >= 60 ? BTV.text.amber : BTV.text.red;
                const sources = SIGNAL_SOURCES[s.name] || [];
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: BTV.text.muted, minWidth: 72, ...MONO }}>
                      {s.name} ({s.weight}%)
                    </span>
                    <div style={{ width: 44, height: 5, background: BTV.bg.terminal, flexShrink: 0 }}>
                      <div style={{ height: '100%', width: `${s.score}%`, background: c }} />
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: c, minWidth: 20, ...MONO }}>{s.score}</span>
                    <div style={{ display: 'flex', gap: 2, flex: 1, overflow: 'hidden', flexWrap: 'wrap' }}>
                      {sources.map((src, si) => (
                        <MetricTag key={si} label={src.l} color={src.c} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {/* Strategy Quick Scores */}
              {strategyQuickScores && (
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {strategyQuickScores.map((s, i) => (
                    <div key={i} style={{
                      flex: 1, textAlign: 'center', padding: '3px 2px',
                      background: BTV.bg.terminal,
                      borderTop: s.win ? `2px solid ${BTV.text.amber}` : '2px solid transparent',
                    }}>
                      <div style={{ fontSize: 9, color: BTV.text.muted, ...MONO }}>{s.l}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: s.win ? BTV.text.amber : BTV.text.secondary, ...MONO }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Col C — Deal Details */}
        <div style={{ background: BTV.bg.panel }}>
          <div style={{ padding: '5px 8px', background: BTV.bg.header, borderBottom: `1px solid ${BTV.border.subtle}` }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: BTV.text.white, letterSpacing: 0.5, ...MONO }}>DEAL DETAILS</span>
          </div>
          <DataRow label="PRICE" value={price} />
          <DataRow label="$/UNIT" value={ppuStr} />
          <DataRow label="UNITS" value={units ? String(units) : 'LAND'} />
          {acreage != null && <DataRow label="ACREAGE" value={`${Number(acreage).toFixed(1)} ac`} valueColor={BTV.text.secondary} />}
          <DataRow label="TYPE" value={deal?.propertyTypeKey || deal?.propType || '—'} valueColor={BTV.text.secondary} />
          <DataRow label="STRATEGY" value={deal?.strategy || deal?.strategyType || '—'} valueColor={BTV.text.purple} />
          <DataRow label="IRR" value={irrStr} valueColor={BTV.text.green} />
          <DataRow label="EM" value={emStr} />
          <DataRow label="RISK" value={deal?.riskLevel || deal?.risk || '—'}
            valueColor={deal?.riskLevel === 'HIGH' || deal?.risk === 'HIGH' ? BTV.text.red
              : deal?.riskLevel === 'LOW' || deal?.risk === 'LOW' ? BTV.text.green : BTV.text.amber}
            border={false} />
        </div>
      </div>

      {/* ── Row 2: Alert Banners ── */}
      {(arbitrageGap >= 10 || showCollision) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: BTV.border.subtle, flexShrink: 0 }}>
          {arbitrageGap >= 10 && recStrategyLabel && (
            <AlertBanner
              label="ARBITRAGE"
              color={BTV.text.green}
              text={`${recStrategyLabel} outscores ${altStrategyLabel || 'alternatives'} by ${arbitrageGap}pts. Current strategy alignment confirmed — capture before market reprices.`}
              badge={<Bd c={BTV.text.green}>+{arbitrageGap}pt GAP</Bd>}
            />
          )}
          {showCollision && (
            <AlertBanner
              label="COLLISION"
              color={BTV.text.orange}
              text={collisionMsg}
              badge={<Bd c={BTV.text.orange}>REVIEW</Bd>}
            />
          )}
        </div>
      )}

      {/* ── Row 3: 3-Layer Assumptions ── */}
      <div style={{ background: BTV.bg.terminal, flexShrink: 0 }}>
        <PanelHeader
          title="3-LAYER ASSUMPTIONS"
          subtitle="Quick View — Broker | Platform (JEDI) | You"
          borderColor={BTV.text.orange}
          right={
            <div style={{ display: 'flex', gap: 3 }}>
              <Bd c={BTV.text.cyan}>BROKER</Bd>
              <Bd c={BTV.text.green}>PLATFORM</Bd>
              <Bd c={BTV.text.purple}>YOU</Bd>
            </div>
          }
          metrics={[
            { l: 'F_RENT', c: BTV.met.financial },
            { l: 'O_VACANCY', c: BTV.met.occupancy },
            { l: 'F_CAP', c: BTV.met.financial },
          ]}
        />
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 0.5fr', background: BTV.bg.header, borderBottom: `1px solid ${BTV.border.medium}` }}>
          {['ASSUMPTION', 'BROKER', 'PLATFORM (JEDI)', 'YOU (USER)', 'FLAG'].map((h, i) => (
            <div key={i} style={{
              padding: '3px 8px', fontSize: 9, fontWeight: 700,
              color: [BTV.text.muted, BTV.text.cyan, BTV.text.green, BTV.text.purple, BTV.text.orange][i],
              borderRight: `1px solid ${BTV.border.subtle}`, ...MONO,
            }}>
              {h}
            </div>
          ))}
        </div>
        {assumptionRows.map((row, ri) => (
          <div key={ri} style={{
            display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 0.5fr',
            background: ri % 2 === 0 ? BTV.bg.panel : BTV.bg.panelAlt,
            borderBottom: `1px solid ${BTV.border.subtle}`,
          }}>
            <div style={{ padding: '3px 8px', fontSize: 9, fontWeight: 600, color: BTV.text.primary, display: 'flex', alignItems: 'center', gap: 4, borderRight: `1px solid ${BTV.border.subtle}`, ...MONO }}>
              {row.mc && <span style={{ width: 3, height: 3, borderRadius: '50%', background: row.mc, flexShrink: 0 }} />}
              {row.a}
            </div>
            <div style={{ padding: '3px 8px', fontSize: 9, fontWeight: 700, color: BTV.text.cyan, borderRight: `1px solid ${BTV.border.subtle}`, ...MONO }}>{row.b}</div>
            <div style={{ padding: '3px 8px', fontSize: 9, fontWeight: 700, color: BTV.text.green, borderRight: `1px solid ${BTV.border.subtle}`, ...MONO }}>{row.p}</div>
            <div style={{ padding: '3px 8px', fontSize: 9, fontWeight: 700, color: BTV.text.purple, borderRight: `1px solid ${BTV.border.subtle}`, ...MONO }}>{row.u}</div>
            <div style={{ padding: '3px 8px', display: 'flex', alignItems: 'center' }}>
              {row.flag && <span style={{ width: 7, height: 7, borderRadius: '50%', background: BTV.text.orange }} />}
            </div>
          </div>
        ))}
        {/* Returns summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: BTV.border.subtle }}>
          {[
            { h: 'BROKER RETURNS', irrVal: irrBroker, emVal: '—', c: BTV.text.cyan },
            { h: 'PLATFORM-ADJUSTED', irrVal: irrStr, emVal: emStr, c: BTV.text.green },
            { h: 'YOUR MODEL', irrVal: irrUser, emVal: emStr, c: BTV.text.purple },
          ].map((col, i) => (
            <div key={i} style={{ background: BTV.bg.panel, padding: '3px 5px', borderTop: `2px solid ${col.c}` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: col.c, letterSpacing: 0.8, marginBottom: 2, ...MONO }}>{col.h}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div>
                  <span style={{ fontSize: 9, color: BTV.text.muted, ...MONO }}>IRR </span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: col.c, ...MONO }}>{col.irrVal}</span>
                </div>
                <div>
                  <span style={{ fontSize: 9, color: BTV.text.muted, ...MONO }}>EM </span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: col.c, ...MONO }}>{col.emVal}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 4: AI Intelligence Brief ── */}
      <div style={{ background: BTV.bg.panel, padding: '4px 8px', borderBottom: `1px solid ${BTV.border.subtle}`, flexShrink: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: BTV.text.cyan, letterSpacing: 0.8, marginBottom: 3, ...MONO }}>
          AI INTELLIGENCE BRIEF
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {aiBriefs.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <Bd c={b.c}>{b.cat}</Bd>
              <span style={{ fontSize: 9, color: BTV.text.secondary, lineHeight: 1.3, ...MONO }}>{b.msg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 5: Deal-Type Overview Router ── */}
      <div style={{ borderBottom: `1px solid ${BTV.border.subtle}`, flexShrink: 0 }}>
        <OverviewRouter
          dealId={typeof deal?.id === 'string' ? deal.id : null}
          purchasePrice={
            typeof deal?.purchasePrice === 'number' ? deal.purchasePrice :
            typeof deal?.budget === 'number' ? deal.budget :
            null
          }
          onSaved={onUpdate}
        />
      </div>

      {/* ── Row 6: Key Financials | Deal Team | Recent Activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: BTV.border.subtle, flexShrink: 0 }}>

        {/* KEY FINANCIALS */}
        <SectionPanel
          title="KEY FINANCIALS"
          borderColor={BTV.text.amber}
          metrics={[{ l: 'F_NOI', c: BTV.met.financial }, { l: 'F_CAP', c: BTV.met.financial }]}
        >
          <DataRow label="GOING-IN CAP" value={goingInCap !== '—' ? goingInCap : '—'} metricColor={BTV.met.financial} />
          <DataRow label="STABILIZED NOI" value={stabilizedNOI} metricColor={BTV.met.financial} />
          <DataRow label="DEBT SERVICE" value={debtServiceStr} sub="/yr" />
          <DataRow label="DSCR" value={dscrVal}
            valueColor={capitalStructure?.dscr
              ? capitalStructure.dscr >= 1.25 ? BTV.text.green : BTV.text.orange
              : BTV.text.secondary} />
          <DataRow label="LTC" value={ltcVal} />
          <DataRow label="EQUITY REQ" value={equityReqStr} border={false} />
        </SectionPanel>

        {/* DEAL TEAM */}
        <SectionPanel title="DEAL TEAM" borderColor={BTV.text.purple}>
          {teamToShow.length === 0 ? (
            <div style={{ padding: '8px 8px', textAlign: 'center' }}>
              <span style={{ fontSize: 9, color: BTV.text.muted, ...MONO }}>No team members assigned</span>
            </div>
          ) : (
            teamToShow.map((m: any, i: number) => {
              const role = m.role || m.title || 'MEMBER';
              const name = m.name || m.userName || m.email || '—';
              const lastActive = m.lastActive || m.updatedAt || m.createdAt;
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 8px', borderBottom: `1px solid ${BTV.border.subtle}` }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <Bd c={BTV.text.purple}>{String(role).toUpperCase().slice(0, 8)}</Bd>
                    <span style={{ fontSize: 9, color: BTV.text.primary, ...MONO }}>{name}</span>
                  </div>
                  <span style={{ fontSize: 9, color: BTV.text.muted, ...MONO }}>{lastActive ? fmtAgo(lastActive) : '—'}</span>
                </div>
              );
            })
          )}
        </SectionPanel>

        {/* RECENT ACTIVITY */}
        <SectionPanel title="RECENT ACTIVITY" borderColor={BTV.text.cyan}>
          {activity.length === 0 ? (
            <div style={{ padding: '8px 8px', textAlign: 'center' }}>
              <span style={{ fontSize: 9, color: BTV.text.muted, ...MONO }}>No recent activity</span>
            </div>
          ) : (
            activity.map((a: any, i: number) => {
              const msg = a.message || a.action || a.description || a.text || '—';
              const ts = a.createdAt || a.timestamp || a.updatedAt;
              const color = a.type === 'alert' ? BTV.text.red
                : a.type === 'update' ? BTV.text.green
                : a.type === 'comment' ? BTV.text.cyan
                : BTV.text.secondary;
              return (
                <div key={i} style={{ display: 'flex', gap: 6, padding: '3px 8px', borderBottom: `1px solid ${BTV.border.subtle}` }}>
                  <span style={{ fontSize: 9, color: BTV.text.muted, minWidth: 20, flexShrink: 0, ...MONO }}>{ts ? fmtAgo(ts) : '—'}</span>
                  <span style={{ fontSize: 9, color, ...MONO, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{msg}</span>
                </div>
              );
            })
          )}
        </SectionPanel>
      </div>

      {/* ── Row 7: Trade Press News (per-deal) ── */}
      <div style={{ background: BTV.border.subtle, flexShrink: 0 }}>
        <TradePressWidget dealId={String(deal?.id ?? '')} limit={6} />
      </div>
    </div>
  );
};
