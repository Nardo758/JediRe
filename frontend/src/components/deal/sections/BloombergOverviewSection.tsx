/**
 * Bloomberg Terminal v0.34 — F1 OVERVIEW (M01)
 * 5-row rich layout: JEDI gauge · 5 Signals · Deal Details
 *                    Alerts · 3-Layer Assumptions · AI Brief
 *                    Key Financials · Deal Team · Activity
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useDealModule } from '../../../contexts/DealModuleContext';
import {
  dealAnalysisService,
  type AnalysisStatus,
  type StrategyResults,
} from '@/services/dealAnalysis.service';
import { apiClient } from '@/services/api.client';
import type { JEDIScoreData, SignalScore, StrategyVerdictData, RiskAlertData } from '@/data/enhancedOverviewMockData';
import {
  BT, BT_CSS, Spark, Bd, StageBd, RiskDot, MetricTag,
  PanelHeader, SectionPanel, DataRow, MiniBar,
} from '../bloomberg-ui';

// ─── CSS injection ───────────────────────────────────────────
const OVERVIEW_CSS = `
  ${BT_CSS}
  @keyframes ov-fade { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
`;
let cssMounted = false;
function mountCss() {
  if (cssMounted || typeof document === 'undefined') return;
  cssMounted = true;
  const el = document.createElement('style');
  el.textContent = OVERVIEW_CSS;
  document.head.appendChild(el);
}

// ─── Helpers ─────────────────────────────────────────────────
const MONO = BT.font.mono;

function fmt(v: number | null | undefined, prefix = '', suffix = '', decimals = 0): string {
  if (v == null || isNaN(v)) return '—';
  return `${prefix}${v.toFixed(decimals)}${suffix}`;
}

function scoreColor(v: number) {
  return v >= 80 ? BT.text.green : v >= 60 ? BT.text.amber : BT.text.red;
}

function scoreVerdict(v: number) {
  if (v >= 85) return 'STRONG OPPORTUNITY';
  if (v >= 70) return 'OPPORTUNITY';
  if (v >= 55) return 'MONITOR';
  return 'CAUTION';
}

function buildSignals(breakdown: any): Array<{ id: string; label: string; weight: string; score: number; tags: Array<{l:string;c:string}> }> {
  const DEFS = [
    { id: 'demand',   label: 'DEMAND',   weight: '30%', tags: [{l:'Economic',c:BT.met.economic},{l:'Dig Traffic',c:BT.met.digTraffic},{l:'Physical',c:BT.met.physTraffic},{l:'Comp Traffic',c:BT.met.compTraffic}] },
    { id: 'supply',   label: 'SUPPLY',   weight: '25%', tags: [{l:'Supply',c:BT.met.supply},{l:'Occupancy',c:BT.met.occupancy},{l:'Financial',c:BT.met.financial}] },
    { id: 'momentum', label: 'MOMENTUM', weight: '20%', tags: [{l:'Financial',c:BT.met.financial},{l:'Comp Traffic',c:BT.met.compTraffic},{l:'Occupancy',c:BT.met.occupancy},{l:'Physical',c:BT.met.physTraffic}] },
    { id: 'position', label: 'POSITION', weight: '15%', tags: [{l:'Comp Traffic',c:BT.met.compTraffic},{l:'Dig Traffic',c:BT.met.digTraffic},{l:'Financial',c:BT.met.financial},{l:'Physical',c:BT.met.physTraffic}] },
    { id: 'risk',     label: 'RISK',     weight: '10%', tags: [{l:'Occupancy',c:BT.met.occupancy},{l:'Financial',c:BT.met.financial},{l:'Quality',c:BT.met.quality},{l:'Economic',c:BT.met.economic}] },
  ];
  return DEFS.map(d => ({
    ...d,
    score: Math.round(breakdown?.[d.id]?.score ?? 50),
  }));
}

// ─── Props ───────────────────────────────────────────────────
interface Props {
  deal: any;
  dealId?: string;
  onTabChange?: (tab: string) => void;
  geographicContext?: any;
}

// ─── Main Component ──────────────────────────────────────────
const BloombergOverviewSection: React.FC<Props> = ({ deal, onTabChange, geographicContext }) => {
  mountCss();

  const { capitalStructure, assumptions, computedReturns } = useDealModule();

  const [jediScore, setJediScore]           = useState<JEDIScoreData | null>(null);
  const [signals, setSignals]               = useState<ReturnType<typeof buildSignals>>([]);
  const [strategyResults, setStrategyResults] = useState<StrategyResults | null>(null);
  const [strategyVerdict, setStrategyVerdict] = useState<StrategyVerdictData | null>(null);
  const [riskAlert, setRiskAlert]           = useState<RiskAlertData | null>(null);
  const [capitalStack, setCapitalStack]     = useState<any>(null);
  const [scoreLoading, setScoreLoading]     = useState(true);

  // ─── Load JEDI score ──────────────────────────────────────
  const loadJediScore = useCallback(async () => {
    if (!deal?.id) return;
    setScoreLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/jedi/score/${deal.id}`);
      const s = res.data?.data?.score;
      if (s) {
        const total = Math.round(s.totalScore ?? s.total_score ?? 0);
        const delta = Math.round(s.scoreDelta ?? s.score_delta ?? 0);
        setJediScore({ score: total, delta30d: delta, confidence: 85, verdict: scoreVerdict(total), verdictColor: '' } as any);
        if (res.data?.data?.breakdown) {
          setSignals(buildSignals(res.data.data.breakdown));
        }
      }
    } catch (e) {
      console.warn('JEDI score load failed', e);
    } finally {
      setScoreLoading(false);
    }
  }, [deal?.id]);

  // ─── Load capital stack ───────────────────────────────────
  const loadCapitalStack = useCallback(async () => {
    if (!deal?.id) return;
    const totalCost = deal.purchasePrice || deal.budget || 0;
    if (!totalCost) return;
    try {
      const res = await apiClient.post('/api/v1/capital-structure/stack', {
        dealId: deal.id,
        strategy: deal.strategyType || deal.strategy || 'value_add',
        layers: [
          { type: 'senior_debt', amount: totalCost * 0.65 },
          { type: 'equity',      amount: totalCost * 0.35 },
        ],
        uses: { acquisition: totalCost },
        noi: deal.noi || 0,
      });
      setCapitalStack(res.data?.data || res.data?.stack ? (res.data.data || res.data) : null);
    } catch (e) {
      console.warn('Capital stack load failed', e);
    }
  }, [deal?.id]);

  // ─── Load strategy analysis ───────────────────────────────
  const loadAnalysis = useCallback(async () => {
    if (!deal?.id) return;
    try {
      const existing = await dealAnalysisService.getLatestAnalysis(deal.id);
      if (existing) setStrategyResults(existing);
    } catch (e) {
      console.warn('Strategy analysis load failed', e);
    }
  }, [deal?.id]);

  useEffect(() => {
    loadJediScore();
    loadCapitalStack();
    loadAnalysis();
  }, [deal?.id]);

  // ─── Derive strategy verdict ──────────────────────────────
  useEffect(() => {
    if (!strategyResults?.strategies?.length) return;
    const strategies = strategyResults.strategies;
    const recId = strategyResults.recommendedStrategyId;
    const rec = strategies.find(s => s.id === recId) || strategies[0];
    const sorted = [...strategies].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    const second = sorted.find(s => s.id !== rec.id);
    const gap = second ? Math.round(rec.confidence - second.confidence) : 0;
    setStrategyVerdict({
      recommended: rec.id,
      recommendedLabel: rec.name,
      score: Math.round(rec.confidence),
      secondBest: second?.id || '',
      secondBestLabel: second?.name || '',
      secondBestScore: second ? Math.round(second.confidence) : 0,
      arbitrageGap: gap,
      isArbitrage: gap >= 10,
      roiEstimate: rec.projectedROI ? `${rec.projectedROI.toFixed(1)}%` : '—',
      roiLabel: 'Projected ROI',
      insight: rec.description || `${rec.name} scores highest at ${Math.round(rec.confidence)}/100.`,
    } as any);
  }, [strategyResults]);

  // ─── Derive risk alert ────────────────────────────────────
  useEffect(() => {
    if (!signals.length) return;
    const worst = [...signals].sort((a, b) => a.score - b.score)[0];
    if (worst.score < 70) {
      setRiskAlert({
        show: true,
        category: worst.label,
        score: worst.score,
        maxScore: 100,
        severity: worst.score < 40 ? 'high' : 'medium',
        detail: `${worst.label} signal at ${worst.score}/100`,
        mitigationAvailable: worst.score >= 40,
        mitigationText: `${worst.label} signal requires monitoring.`,
      } as any);
    }
  }, [signals]);

  // ─── Derived values ───────────────────────────────────────
  const score     = jediScore?.score ?? 0;
  const delta     = jediScore?.delta30d ?? 0;
  const sc        = scoreLoading ? BT.text.secondary : scoreColor(score);
  const verdict   = scoreLoading ? 'LOADING...' : scoreVerdict(score);
  const ppu       = deal?.purchasePrice && deal?.units
    ? `$${Math.round(deal.purchasePrice / deal.units / 1000)}K`
    : deal?.pricePerUnit ? `$${Math.round(deal.pricePerUnit / 1000)}K` : '—';
  const stageVal  = (deal?.stage || deal?.dealStage || '').toUpperCase() || 'PROSPECT';
  const riskLevel = (deal?.riskLevel || deal?.risk || 'LOW').toUpperCase();
  const strategyLabel = deal?.strategyType || deal?.strategy || deal?.investmentStrategy || '—';

  // Key financial values
  const totalCost = deal?.purchasePrice || deal?.budget || 0;
  const noi       = deal?.noi || computedReturns?.noi || 0;
  const ltc       = 75;
  const debtAmt   = totalCost * (ltc / 100);
  const dscr      = capitalStack?.dscr ?? (noi > 0 ? (noi / (debtAmt * 0.07)).toFixed(2) : null);
  const equityReq = totalCost * 0.35;
  const irr       = computedReturns?.irr ?? deal?.irr ?? null;
  const capRate   = deal?.capRate ?? geographicContext?.submarket?.avgCapRate ?? null;

  // 3-Layer assumption rows
  const assumpRows = [
    { label: 'RENT/UNIT/MO',  broker: deal?.assumptions?.brokerRent     ?? '—', platform: assumptions?.rentPerUnit ? `$${assumptions.rentPerUnit}` : '—', you: deal?.targetRent ? `$${deal.targetRent}` : '—' },
    { label: 'VACANCY',       broker: deal?.assumptions?.brokerVacancy   ?? '—', platform: assumptions?.vacancyRate ? `${(assumptions.vacancyRate*100).toFixed(1)}%` : '—', you: '—' },
    { label: 'OPEX RATIO',    broker: deal?.assumptions?.brokerOpex      ?? '—', platform: assumptions?.opexRatio   ? `${(assumptions.opexRatio*100).toFixed(0)}%` : '—', you: '—' },
    { label: 'CAP RATE',      broker: deal?.assumptions?.brokerCapRate   ?? '—', platform: capRate ? `${(capRate*100).toFixed(2)}%` : '—', you: '—' },
    { label: 'IRR TARGET',    broker: deal?.assumptions?.brokerIRR       ?? '—', platform: irr ? `${Number(irr).toFixed(1)}%` : '—', you: deal?.targetIRR ? `${deal.targetIRR}%` : '—' },
  ];

  const trendData: number[] = [72, 74, 73, 76, 78, 77, 79, 80, score || 82];

  return (
    <div style={{ flex: 1, overflow: 'auto', animation: 'ov-fade 0.15s', background: BT.bg.terminal }}>

      {/* Module header */}
      <PanelHeader
        title="OVERVIEW"
        subtitle="M01 · Deal Command Center"
        borderColor={BT.text.amber}
        metrics={[
          { l: 'JEDI', c: BT.text.amber },
          { l: 'F_IRR', c: BT.met.financial },
          { l: 'F_NOI', c: BT.met.financial },
          { l: 'S_PIPE', c: BT.met.supply },
        ]}
        right={<StageBd stage={stageVal} />}
      />

      {/* ═══ ROW 1: JEDI Score · Signals · Deal Details ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr 195px', gap: 1, background: BT.border.subtle }}>

        {/* JEDI Score Gauge */}
        <div style={{ background: BT.bg.panel, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 7, color: BT.text.muted, letterSpacing: 1.5, fontFamily: MONO }}>JEDI SCORE</div>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            border: `3px solid ${sc}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
            boxShadow: `0 0 20px ${sc}33`,
          }}>
            <span style={{ fontSize: scoreLoading ? 14 : 28, fontWeight: 800, color: sc, fontFamily: MONO }}>
              {scoreLoading ? '…' : score || '—'}
            </span>
            {!scoreLoading && delta !== 0 && (
              <span style={{ fontSize: 8, color: delta > 0 ? BT.text.green : BT.text.red, fontWeight: 600, fontFamily: MONO }}>
                {delta > 0 ? '+' : ''}{delta} 30d
              </span>
            )}
          </div>
          <div style={{ fontSize: 7, color: BT.text.muted, fontFamily: MONO }}>Confidence: 85%</div>
          <Spark data={trendData} color={sc} w={100} h={18} />
          <Bd c={sc}>{verdict}</Bd>
        </div>

        {/* 5 Master Signals */}
        <div style={{ background: BT.bg.panel, padding: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.white, marginBottom: 6, fontFamily: MONO, letterSpacing: 0.5 }}>
            5 MASTER SIGNALS — PLATFORM METRIC SOURCES
          </div>
          {(signals.length ? signals : [
            { id: 'demand', label: 'DEMAND', weight: '30%', score: 0, tags: [{l:'Economic',c:BT.met.economic},{l:'Dig Traffic',c:BT.met.digTraffic}] },
            { id: 'supply', label: 'SUPPLY', weight: '25%', score: 0, tags: [{l:'Supply',c:BT.met.supply},{l:'Occupancy',c:BT.met.occupancy}] },
            { id: 'momentum', label: 'MOMENTUM', weight: '20%', score: 0, tags: [{l:'Financial',c:BT.met.financial},{l:'Comp Traffic',c:BT.met.compTraffic}] },
            { id: 'position', label: 'POSITION', weight: '15%', score: 0, tags: [{l:'Comp Traffic',c:BT.met.compTraffic},{l:'Dig Traffic',c:BT.met.digTraffic}] },
            { id: 'risk',   label: 'RISK', weight: '10%', score: 0, tags: [{l:'Occupancy',c:BT.met.occupancy},{l:'Financial',c:BT.met.financial}] },
          ]).map((sig, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 7, color: BT.text.muted, minWidth: 72, fontFamily: MONO }}>{sig.label} ({sig.weight})</span>
              <div style={{ width: 48, height: 5, background: BT.bg.terminal, borderRadius: 1, flexShrink: 0 }}>
                <div style={{ height: '100%', width: `${sig.score}%`, background: scoreColor(sig.score), borderRadius: 1 }} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: scoreColor(sig.score), minWidth: 22, fontFamily: MONO }}>
                {scoreLoading ? '—' : sig.score || '—'}
              </span>
              <div style={{ display: 'flex', gap: 2, flex: 1, overflow: 'hidden', flexWrap: 'wrap' }}>
                {sig.tags.map((tag, ti) => <MetricTag key={ti} label={tag.l} color={tag.c} />)}
              </div>
            </div>
          ))}

          {/* Strategy Quick Scores */}
          {strategyResults?.strategies && (
            <div style={{ display: 'flex', gap: 3, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${BT.border.subtle}` }}>
              {strategyResults.strategies.slice(0, 4).map((s: any, i: number) => {
                const isWin = s.id === strategyResults.recommendedStrategyId;
                return (
                  <div key={i} style={{
                    flex: 1, textAlign: 'center', padding: '3px 4px',
                    background: BT.bg.terminal,
                    borderTop: isWin ? `2px solid ${BT.text.amber}` : `2px solid ${BT.border.subtle}`,
                  }}>
                    <div style={{ fontSize: 7, color: isWin ? BT.text.amber : BT.text.muted, fontWeight: 700, fontFamily: MONO }}>{s.name?.toUpperCase().slice(0, 6)}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: isWin ? BT.text.amber : BT.text.secondary, fontFamily: MONO }}>
                      {Math.round(s.confidence)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Deal Details */}
        <div style={{ background: BT.bg.panel }}>
          <div style={{ padding: '5px 8px', borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.header }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: BT.text.white, letterSpacing: 0.5, fontFamily: MONO }}>DEAL DETAILS</div>
          </div>
          <DataRow label="ADDRESS"   value={deal?.address?.split(',')[0] || deal?.name || '—'} valueColor={BT.text.primary} />
          <DataRow label="MARKET"    value={deal?.market || deal?.city || '—'} valueColor={BT.text.secondary} />
          <DataRow label="PRICE"     value={deal?.purchasePrice ? `$${(deal.purchasePrice/1e6).toFixed(1)}M` : '—'} metricColor={BT.met.financial} />
          <DataRow label="PPU"       value={ppu} metricColor={BT.met.financial} />
          <DataRow label="UNITS"     value={deal?.units || deal?.totalUnits || '—'} />
          <DataRow label="ACREAGE"   value={deal?.acreage ? `${deal.acreage} ac` : '—'} />
          <DataRow label="STRATEGY"  value={strategyLabel.toString().toUpperCase().slice(0, 10)} valueColor={BT.text.purple} />
          <DataRow label="STAGE"     value={<StageBd stage={stageVal} />} />
          <DataRow label="RISK"      value={<RiskDot level={riskLevel} />} border={false} />
        </div>
      </div>

      {/* ═══ ROW 2: Alert Banners ═══ */}
      {(strategyVerdict?.isArbitrage || riskAlert?.show) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: BT.border.subtle }}>
          {strategyVerdict?.isArbitrage && (
            <div style={{ padding: '6px 10px', background: BT.text.green + '08', borderLeft: `3px solid ${BT.text.green}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bd c={BT.text.green}>ARBITRAGE</Bd>
              <span style={{ fontSize: 8, color: BT.text.secondary, fontFamily: MONO }}>
                {strategyVerdict.recommendedLabel} outscores {strategyVerdict.secondBestLabel} by {strategyVerdict.arbitrageGap}pts.{' '}
                {strategyVerdict.insight}
              </span>
            </div>
          )}
          {riskAlert?.show && (
            <div style={{ padding: '6px 10px', background: BT.text.orange + '08', borderLeft: `3px solid ${BT.text.orange}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bd c={BT.text.orange}>COLLISION</Bd>
              <span style={{ fontSize: 8, color: BT.text.secondary, fontFamily: MONO }}>
                {riskAlert.detail} — {riskAlert.mitigationText}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ═══ ROW 3: 3-Layer Assumptions ═══ */}
      <div style={{ background: BT.bg.panel, borderTop: `1px solid ${BT.border.subtle}` }}>
        <div style={{ padding: '5px 10px', borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.header, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: BT.text.white, letterSpacing: 0.5, fontFamily: MONO }}>3-LAYER ASSUMPTIONS</span>
          <MetricTag label="Broker" color={BT.text.orange} />
          <MetricTag label="Platform" color={BT.text.cyan} />
          <MetricTag label="You" color={BT.text.purple} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 8 }}>
            <thead>
              <tr style={{ background: BT.bg.panelAlt }}>
                {['ASSUMPTION', 'BROKER', 'PLATFORM', 'YOU', 'DIVERGENCE'].map((h, i) => (
                  <th key={i} style={{ padding: '3px 8px', textAlign: i === 0 ? 'left' : 'right', color: BT.text.muted, fontWeight: 600, borderBottom: `1px solid ${BT.border.subtle}`, whiteSpace: 'nowrap', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assumpRows.map((row, i) => {
                const hasDiff = row.broker !== '—' && row.platform !== '—' && row.broker !== row.platform;
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <td style={{ padding: '4px 8px', color: BT.text.muted, letterSpacing: 0.5 }}>{row.label}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: BT.text.orange, fontWeight: 700 }}>{row.broker}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: BT.text.cyan, fontWeight: 700 }}>{row.platform}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: BT.text.purple, fontWeight: 700 }}>{row.you}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                      {hasDiff ? <Bd c={BT.text.red}>DIVERGE</Bd> : <span style={{ color: BT.text.muted }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ ROW 4: AI Intelligence Brief ═══ */}
      <div style={{ background: BT.bg.panel, borderTop: `1px solid ${BT.border.subtle}`, padding: 10 }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: BT.text.cyan, letterSpacing: 0.8, marginBottom: 6, fontFamily: MONO }}>
          AI INTELLIGENCE BRIEF
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { cat: 'DEMAND',  c: BT.text.green,  msg: signals[0]?.score ? `Demand signal ${signals[0].score}/100. ${signals[0].score >= 80 ? 'Strong inbound demand indicators across economic and digital channels.' : 'Monitor demand drivers — below-threshold signals detected.'}` : 'Demand data loading from platform metrics engine.' },
            { cat: 'SUPPLY',  c: BT.text.amber,  msg: signals[1]?.score ? `Supply signal ${signals[1].score}/100. ${signals[1].score <= 70 ? 'Supply pressure building — monitor pipeline delivery schedule.' : 'Pipeline within acceptable range for deal thesis.'}` : 'Supply pipeline data loading.' },
            { cat: 'RISK',    c: BT.text.orange, msg: riskAlert?.show ? `${riskAlert.category} signal at ${riskAlert.score}/100 — ${riskAlert.mitigationText}` : 'Risk signals within acceptable bounds. Continue monitoring.' },
            { cat: 'ACTION',  c: BT.text.amber,  msg: strategyVerdict?.isArbitrage ? `Advance ${strategyVerdict.recommendedLabel}. Gap of ${strategyVerdict.arbitrageGap}pts over alternatives creates clear conviction.` : strategyVerdict?.recommendedLabel ? `Proceed with ${strategyVerdict.recommendedLabel} strategy. Run full analysis for detailed scoring.` : 'Run strategy analysis to generate action recommendation.' },
          ].map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <Bd c={b.c}>{b.cat}</Bd>
              <span style={{ fontSize: 8, color: BT.text.secondary, lineHeight: 1.5, fontFamily: MONO, flex: 1 }}>{b.msg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ ROW 5: Key Financials · Deal Team · Activity ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: BT.border.subtle }}>

        {/* Key Financials */}
        <SectionPanel
          title="KEY FINANCIALS"
          borderColor={BT.text.amber}
          metrics={[{ l: 'F_NOI', c: BT.met.financial }, { l: 'F_CAP', c: BT.met.financial }]}
        >
          <DataRow label="PURCHASE PRICE" value={deal?.purchasePrice ? `$${(deal.purchasePrice/1e6).toFixed(1)}M` : '—'} metricColor={BT.met.financial} />
          <DataRow label="NOI (YR 1)"     value={noi ? `$${(noi/1000).toFixed(0)}K` : '—'} metricColor={BT.met.financial} />
          <DataRow label="GOING-IN CAP"   value={capRate ? `${(capRate * 100).toFixed(2)}%` : '—'} metricColor={BT.met.financial} />
          <DataRow label="DSCR"           value={dscr ? `${Number(dscr).toFixed(2)}x` : '—'} valueColor={dscr && Number(dscr) >= 1.25 ? BT.text.green : BT.text.red} />
          <DataRow label="LTC"            value={`${ltc}%`} />
          <DataRow label="EQUITY REQ"     value={equityReq ? `$${(equityReq/1e6).toFixed(1)}M` : '—'} border={false} />
        </SectionPanel>

        {/* Deal Team */}
        <SectionPanel title="DEAL TEAM" borderColor={BT.text.purple}>
          {[
            { role: 'LEAD',     name: deal?.primaryContact || deal?.leadInvestor || 'Unassigned' },
            { role: 'ANALYST',  name: deal?.analyst || '—' },
            { role: 'LEGAL',    name: deal?.attorney || deal?.legalCounsel || '—' },
            { role: 'LENDER',   name: deal?.lender || deal?.seniorLender || '—' },
            { role: 'GC',       name: deal?.generalContractor || deal?.gc || '—' },
          ].map((m, i, arr) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '4px 8px',
              borderBottom: i < arr.length - 1 ? `1px solid ${BT.border.subtle}` : 'none',
            }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <Bd c={BT.text.purple}>{m.role}</Bd>
                <span style={{ fontSize: 8, color: m.name === '—' ? BT.text.muted : BT.text.primary, fontFamily: MONO }}>{m.name}</span>
              </div>
            </div>
          ))}
        </SectionPanel>

        {/* Recent Activity */}
        <SectionPanel title="RECENT ACTIVITY" borderColor={BT.text.cyan}>
          {[
            { act: `JEDI Score updated${score ? ` — ${score}${delta > 0 ? ` (+${delta})` : ''}` : ''}`, t: 'now', c: BT.text.green },
            { act: `Deal stage: ${stageVal}`, t: '—', c: BT.text.cyan },
            { act: strategyVerdict?.isArbitrage ? `Arbitrage detected: ${strategyVerdict.recommendedLabel}` : 'Strategy analysis available', t: '—', c: BT.text.amber },
            { act: riskAlert?.show ? `Risk alert: ${riskAlert.category} signal` : 'Risk signals within bounds', t: '—', c: riskAlert?.show ? BT.text.orange : BT.text.secondary },
            { act: 'Capital structure loaded', t: '—', c: BT.text.secondary },
          ].map((a, i, arr) => (
            <div key={i} style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              padding: '4px 8px',
              borderBottom: i < arr.length - 1 ? `1px solid ${BT.border.subtle}` : 'none',
            }}>
              <span style={{ fontSize: 7, color: BT.text.muted, minWidth: 24, fontFamily: MONO, flexShrink: 0 }}>{a.t}</span>
              <span style={{ fontSize: 8, color: a.c, fontFamily: MONO, lineHeight: 1.4 }}>{a.act}</span>
            </div>
          ))}
        </SectionPanel>
      </div>

      {/* ─── Secondary nav links ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, borderTop: `1px solid ${BT.border.medium}`, background: BT.bg.header, flexShrink: 0 }}>
        {[
          { id: 'context',     label: 'CONTEXT TRACKER' },
          { id: 'team',        label: 'TEAM MGMT' },
          { id: 'collaborate', label: 'COLLABORATE' },
          { id: 'deal-status', label: 'DEAL STATUS' },
        ].map((tab, i) => (
          <button
            key={i}
            onClick={() => onTabChange?.(tab.id)}
            style={{
              fontFamily: MONO, fontSize: 7, fontWeight: 600, letterSpacing: 0.5,
              padding: '5px 12px', background: 'transparent', color: BT.text.muted,
              border: 'none', borderRight: `1px solid ${BT.border.subtle}`,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BloombergOverviewSection;
