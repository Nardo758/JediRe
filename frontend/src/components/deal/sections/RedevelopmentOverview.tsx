/**
 * Bloomberg Terminal v0.34 — F1 OVERVIEW · REDEVELOPMENT variant
 * Sections: JEDI Gauge · 5 Signals · As-Is Acquisition
 *            NOI Transformation · Renovation Budget · Capital Structure
 *            Timeline · Value Bridge · Returns · AI Brief · Activity
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useDealModule } from '../../../contexts/DealModuleContext';
import { dealAnalysisService, type StrategyResults } from '@/services/dealAnalysis.service';
import { apiClient } from '@/services/api.client';
import {
  BT, BT_CSS, Spark, Bd, StageBd, RiskDot, MetricTag,
  PanelHeader, SectionPanel, DataRow,
} from '../bloomberg-ui';

const MONO = BT.font.mono;

const OVERVIEW_CSS = `${BT_CSS} @keyframes ov-fade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`;
let cssMountedR = false;
function mountCss() {
  if (cssMountedR || typeof document === 'undefined') return;
  cssMountedR = true;
  const el = document.createElement('style');
  el.textContent = OVERVIEW_CSS;
  document.head.appendChild(el);
}

function fmt(v: number | null | undefined, prefix = '', suffix = ''): string {
  if (v == null || isNaN(v)) return '—';
  if (Math.abs(v) >= 1e9) return `${prefix}${(v / 1e9).toFixed(1)}B${suffix}`;
  if (Math.abs(v) >= 1e6) return `${prefix}${(v / 1e6).toFixed(1)}M${suffix}`;
  if (Math.abs(v) >= 1e3) return `${prefix}${Math.round(v / 1e3)}K${suffix}`;
  return `${prefix}${v.toFixed(0)}${suffix}`;
}
function pct(v: number | null | undefined): string {
  if (v == null) return '—';
  const n = v > 1 ? v : v * 100;
  return `${n.toFixed(1)}%`;
}

function scoreColor(v: number) {
  return v >= 80 ? BT.text.green : v >= 60 ? BT.text.amber : BT.text.red;
}
function scoreVerdict(v: number) {
  if (v >= 85) return 'STRONG BUY';
  if (v >= 70) return 'OPPORTUNITY';
  if (v >= 55) return 'MONITOR';
  return 'CAUTION';
}

function buildSignals(bd: any) {
  const DEFS = [
    { id: 'demand',   label: 'DEMAND',   weight: '30%', tags: [{l:'Economic',c:BT.met.economic},{l:'Dig Traffic',c:BT.met.digTraffic},{l:'Physical',c:BT.met.physTraffic}] },
    { id: 'supply',   label: 'SUPPLY',   weight: '25%', tags: [{l:'Supply',c:BT.met.supply},{l:'Occupancy',c:BT.met.occupancy}] },
    { id: 'momentum', label: 'MOMENTUM', weight: '20%', tags: [{l:'Financial',c:BT.met.financial},{l:'Comp Traffic',c:BT.met.compTraffic}] },
    { id: 'position', label: 'POSITION', weight: '15%', tags: [{l:'Comp Traffic',c:BT.met.compTraffic},{l:'Dig Traffic',c:BT.met.digTraffic}] },
    { id: 'risk',     label: 'RISK',     weight: '10%', tags: [{l:'Occupancy',c:BT.met.occupancy},{l:'Financial',c:BT.met.financial}] },
  ];
  return DEFS.map(d => ({ ...d, score: Math.round(bd?.[d.id]?.score ?? 0) }));
}

interface Props {
  deal: any;
  dealId?: string;
  onTabChange?: (tab: string) => void;
}

export const RedevelopmentOverview: React.FC<Props> = ({ deal, onTabChange }) => {
  mountCss();
  const { capitalStructure, assumptions, computedReturns } = useDealModule();

  const [jediScore, setJediScore]       = useState<number>(0);
  const [jediDelta, setJediDelta]       = useState<number>(0);
  const [signals, setSignals]           = useState<any[]>([]);
  const [scoreLoading, setScoreLoading] = useState(true);
  const [strategyResults, setStrategyResults] = useState<StrategyResults | null>(null);

  const dealId = deal?.id;

  const loadScore = useCallback(async () => {
    if (!dealId) return;
    setScoreLoading(true);
    try {
      const res = await apiClient.get(`/api/v1/jedi/score/${dealId}`);
      const s = res.data?.data?.score;
      if (s) {
        setJediScore(Math.round(s.totalScore ?? s.total_score ?? 0));
        setJediDelta(Math.round(s.scoreDelta ?? s.score_delta ?? 0));
        if (res.data?.data?.breakdown) setSignals(buildSignals(res.data.data.breakdown));
      }
    } catch {}
    finally { setScoreLoading(false); }
  }, [dealId]);

  const loadAnalysis = useCallback(async () => {
    if (!dealId) return;
    try {
      const a = await dealAnalysisService.getLatestAnalysis(dealId);
      if (a) setStrategyResults(a);
    } catch {}
  }, [dealId]);

  useEffect(() => { loadScore(); loadAnalysis(); }, [dealId]);

  const sc      = scoreLoading ? BT.text.secondary : scoreColor(jediScore);
  const verdict = scoreLoading ? 'LOADING...' : scoreVerdict(jediScore);
  const trend   = [68, 71, 70, 73, 75, 74, 77, 79, jediScore || 77];
  const stageVal = (deal?.stage || deal?.dealStage || 'PROSPECT').toUpperCase();

  const f = (snake: string, camel: string, fallback: any = null) =>
    deal?.[snake] ?? deal?.[camel] ?? fallback;

  const purchasePrice  = f('purchase_price', 'purchasePrice') ?? deal?.budget;
  const units          = f('units', 'units') ?? f('total_units', 'totalUnits');
  const ppu            = purchasePrice && units ? purchasePrice / units : null;
  const goingInCapRate = f('cap_rate', 'capRate') ?? f('going_in_cap_rate', 'goingInCapRate');
  const currentNOI     = f('current_noi', 'currentNoi') ?? f('noi', 'noi') ?? computedReturns?.noi;
  const projectedNOI   = f('projected_noi', 'projectedNoi') ?? f('stabilized_noi', 'stabilizedNoi');
  const noiUpside      = currentNOI && projectedNOI ? projectedNOI - currentNOI : null;
  const currentOcc     = f('current_occupancy', 'currentOccupancy') ?? f('occupancy', 'occupancy');
  const targetOcc      = f('target_occupancy', 'targetOccupancy') ?? assumptions?.stabilizedOccupancy;

  const renovCostPerUnit = f('renovation_cost_per_unit', 'renovationCostPerUnit');
  const totalRenovCost   = f('renovation_budget', 'renovationBudget') ?? f('hard_costs', 'hardCosts') ?? capitalStructure?.hardCosts;
  const softCosts        = f('soft_costs', 'softCosts') ?? capitalStructure?.softCosts;
  const totalCapex       = totalRenovCost && softCosts ? totalRenovCost + softCosts : totalRenovCost;
  const acquisitionCost  = purchasePrice;
  const totalInvestment  = acquisitionCost && totalCapex ? acquisitionCost + totalCapex : null;

  const totalDebt   = capitalStructure?.loanBalance?.[0] ?? capitalStructure?.totalDebt;
  const totalEquity = capitalStructure?.totalEquity;
  const ltv = purchasePrice && totalDebt ? Math.round((totalDebt / purchasePrice) * 100) : null;

  const constructionMo = f('construction_months', 'constructionMonths') ?? f('renovation_months', 'renovationMonths');
  const leaseUpMo      = f('lease_up_months', 'leaseUpMonths');
  const totalMo        = constructionMo && leaseUpMo ? constructionMo + leaseUpMo : constructionMo;

  const irr    = computedReturns?.irrLevered ? computedReturns.irrLevered * 100 : (computedReturns?.irr ?? deal?.irr ?? null);
  const em     = computedReturns?.equityMultiple ?? deal?.equityMultiple;
  const coc    = computedReturns?.cashOnCash ?? deal?.cashOnCash;
  const yoc    = computedReturns?.yieldOnCost ?? (computedReturns?.yoc ? computedReturns.yoc * 100 : null);

  const valueAdd   = purchasePrice && projectedNOI && goingInCapRate ? (projectedNOI / goingInCapRate) - purchasePrice : null;
  const rentUpside = f('rent_upside', 'rentUpside') ?? f('target_rent', 'targetRent');
  const currentRent = f('current_rent', 'currentRent') ?? f('in_place_rent', 'inPlaceRent');

  const rec = strategyResults?.strategies?.find((s: any) => s.id === strategyResults.recommendedStrategyId) ?? strategyResults?.strategies?.[0];

  const sigList = signals.length ? signals : [
    { label: 'DEMAND',   weight: '30%', score: 0, tags: [{l:'Economic',c:BT.met.economic},{l:'Dig Traffic',c:BT.met.digTraffic}] },
    { label: 'SUPPLY',   weight: '25%', score: 0, tags: [{l:'Supply',c:BT.met.supply},{l:'Occupancy',c:BT.met.occupancy}] },
    { label: 'MOMENTUM', weight: '20%', score: 0, tags: [{l:'Financial',c:BT.met.financial}] },
    { label: 'POSITION', weight: '15%', score: 0, tags: [{l:'Comp Traffic',c:BT.met.compTraffic}] },
    { label: 'RISK',     weight: '10%', score: 0, tags: [{l:'Financial',c:BT.met.financial}] },
  ];

  return (
    <div style={{ flex: 1, overflow: 'auto', animation: 'ov-fade 0.15s', background: BT.bg.terminal }}>

      <PanelHeader
        title="OVERVIEW · REDEVELOPMENT"
        subtitle="M01 · Renovation Command Center"
        borderColor={BT.text.purple}
        metrics={[
          { l: 'JEDI',  c: BT.text.amber },
          { l: 'F_NOI', c: BT.met.financial },
          { l: 'F_IRR', c: BT.met.financial },
          { l: 'F_VAL', c: BT.met.financial },
        ]}
        right={<StageBd stage={stageVal} />}
      />

      {/* ═══ ROW 1: JEDI Gauge · 5 Signals · As-Is Acquisition ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr 195px', gap: 1, background: BT.border.subtle }}>

        {/* JEDI Gauge */}
        <div style={{ background: BT.bg.panel, padding: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 7, color: BT.text.muted, letterSpacing: 1.5, fontFamily: MONO }}>JEDI SCORE</div>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            border: `3px solid ${sc}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
            boxShadow: `0 0 20px ${sc}33`,
          }}>
            <span style={{ fontSize: scoreLoading ? 14 : 28, fontWeight: 800, color: sc, fontFamily: MONO }}>
              {scoreLoading ? '…' : jediScore || '—'}
            </span>
            {!scoreLoading && jediDelta !== 0 && (
              <span style={{ fontSize: 8, color: jediDelta > 0 ? BT.text.green : BT.text.red, fontWeight: 600, fontFamily: MONO }}>
                {jediDelta > 0 ? '+' : ''}{jediDelta} 30d
              </span>
            )}
          </div>
          <div style={{ fontSize: 7, color: BT.text.muted, fontFamily: MONO }}>Redevelopment</div>
          <Spark data={trend} color={sc} w={100} h={18} />
          <Bd c={sc}>{verdict}</Bd>
          <Bd c={BT.text.purple}>REDEVELOPMENT</Bd>
        </div>

        {/* 5 Master Signals */}
        <div style={{ background: BT.bg.panel, padding: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.white, marginBottom: 6, fontFamily: MONO, letterSpacing: 0.5 }}>
            5 MASTER SIGNALS — PLATFORM METRIC SOURCES
          </div>
          {sigList.map((sig: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 7, color: BT.text.muted, minWidth: 76, fontFamily: MONO }}>{sig.label} ({sig.weight})</span>
              <div style={{ width: 48, height: 5, background: BT.bg.terminal, borderRadius: 1, flexShrink: 0 }}>
                <div style={{ height: '100%', width: `${sig.score}%`, background: scoreColor(sig.score), borderRadius: 1 }} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: scoreColor(sig.score), minWidth: 22, fontFamily: MONO }}>
                {scoreLoading ? '—' : sig.score || '—'}
              </span>
              <div style={{ display: 'flex', gap: 2, flex: 1, overflow: 'hidden', flexWrap: 'wrap' }}>
                {sig.tags.map((tag: any, ti: number) => <MetricTag key={ti} label={tag.l} color={tag.c} />)}
              </div>
            </div>
          ))}
          {strategyResults?.strategies && (
            <div style={{ display: 'flex', gap: 3, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${BT.border.subtle}` }}>
              {strategyResults.strategies.slice(0, 4).map((s: any, i: number) => {
                const isWin = s.id === strategyResults.recommendedStrategyId;
                return (
                  <div key={i} style={{ flex: 1, textAlign: 'center', padding: '3px 4px', background: BT.bg.terminal, borderTop: isWin ? `2px solid ${BT.text.purple}` : `2px solid ${BT.border.subtle}` }}>
                    <div style={{ fontSize: 7, color: isWin ? BT.text.purple : BT.text.muted, fontWeight: 700, fontFamily: MONO }}>{s.name?.toUpperCase().slice(0, 6)}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: isWin ? BT.text.purple : BT.text.secondary, fontFamily: MONO }}>{Math.round(s.confidence)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* As-Is Acquisition Details */}
        <div style={{ background: BT.bg.panel, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '5px 8px', borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.header }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: BT.text.white, letterSpacing: 0.5, fontFamily: MONO }}>AS-IS ACQUISITION</div>
          </div>
          <DataRow label="ADDRESS"       value={deal?.address?.split(',')[0] || deal?.name || '—'} valueColor={BT.text.primary} />
          <DataRow label="MARKET"        value={deal?.market || deal?.city || '—'} valueColor={BT.text.secondary} />
          <DataRow label="PURCHASE PRICE" value={fmt(purchasePrice, '$')} metricColor={BT.met.financial} />
          <DataRow label="PRICE/UNIT"    value={fmt(ppu, '$')} metricColor={BT.met.financial} />
          <DataRow label="UNITS"         value={units ? `${units} units` : '—'} />
          <DataRow label="CURRENT OCC"   value={pct(currentOcc)} valueColor={currentOcc && (currentOcc > 1 ? currentOcc : currentOcc * 100) >= 90 ? BT.text.green : BT.text.orange} />
          <DataRow label="GOING-IN CAP"  value={goingInCapRate ? `${(goingInCapRate * 100 > 1 ? goingInCapRate : goingInCapRate * 100).toFixed(2)}%` : '—'} metricColor={BT.met.financial} />
          <DataRow label="STAGE"         value={<StageBd stage={stageVal} />} />
          <DataRow label="RISK"          value={<RiskDot level={deal?.riskLevel?.toUpperCase() || 'LOW'} />} border={false} />
        </div>
      </div>

      {/* ═══ ROW 2: NOI Transformation · Renovation Budget · Capital Structure ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: BT.border.subtle, borderTop: `1px solid ${BT.border.subtle}` }}>

        {/* NOI Transformation */}
        <SectionPanel title="NOI TRANSFORMATION" borderColor={BT.text.amber} metrics={[{ l: 'F_NOI', c: BT.met.financial }]}>
          <DataRow label="CURRENT NOI"   value={fmt(currentNOI, '$')} metricColor={BT.met.financial} />
          <DataRow label="PROJECTED NOI" value={fmt(projectedNOI, '$')} metricColor={BT.met.financial} />
          <DataRow label="NOI UPSIDE"    value={fmt(noiUpside, '$')} valueColor={noiUpside && noiUpside > 0 ? BT.text.green : BT.text.red} />
          <DataRow label="CURRENT RENT"  value={currentRent ? `$${currentRent}/mo` : '—'} />
          <DataRow label="TARGET RENT"   value={rentUpside ? `$${rentUpside}/mo` : '—'} valueColor={BT.text.green} />
          <DataRow label="CURRENT OCC"   value={pct(currentOcc)} />
          <DataRow label="TARGET OCC"    value={pct(targetOcc)} valueColor={BT.text.green} border={false} />
        </SectionPanel>

        {/* Renovation Budget */}
        <SectionPanel title="RENOVATION BUDGET" borderColor={BT.text.purple} metrics={[{ l: 'F_CAPEX', c: BT.met.supply }]}>
          <DataRow label="ACQUISITION"   value={fmt(acquisitionCost, '$')} metricColor={BT.met.financial} />
          <DataRow label="RENOVATION"    value={fmt(totalRenovCost, '$')} metricColor={BT.met.supply} />
          <DataRow label="SOFT COSTS"    value={fmt(softCosts, '$')} valueColor={BT.text.orange} />
          <DataRow label="TOTAL CAPEX"   value={fmt(totalCapex, '$')} metricColor={BT.met.financial} />
          <DataRow label="TOTAL INVEST"  value={fmt(totalInvestment, '$')} metricColor={BT.met.financial} />
          <DataRow label="RENO/UNIT"     value={renovCostPerUnit ? `$${Math.round(renovCostPerUnit).toLocaleString()}/unit` : '—'} border={false} />
        </SectionPanel>

        {/* Capital Structure */}
        <SectionPanel title="CAPITAL STRUCTURE" borderColor={BT.text.cyan}>
          <DataRow label="TOTAL INVEST"  value={fmt(totalInvestment, '$')} metricColor={BT.met.financial} />
          <DataRow label="SENIOR DEBT"   value={fmt(totalDebt, '$')} metricColor={BT.met.financial} />
          <DataRow label="EQUITY"        value={fmt(totalEquity, '$')} metricColor={BT.met.financial} />
          <DataRow label="LTV (ACQN)"    value={ltv ? `${ltv}%` : '—'} valueColor={ltv && ltv <= 70 ? BT.text.green : BT.text.orange} />
          <DataRow label="DSCR"          value={computedReturns?.dscr ? `${Number(computedReturns.dscr).toFixed(2)}x` : '—'} valueColor={computedReturns?.dscr && computedReturns.dscr >= 1.25 ? BT.text.green : BT.text.orange} />
          <DataRow label="EQUITY REQ"    value={fmt(totalEquity, '$')} border={false} />
        </SectionPanel>
      </div>

      {/* ═══ ROW 3: Returns · AI Brief · Activity ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: BT.border.subtle, borderTop: `1px solid ${BT.border.subtle}` }}>

        {/* Value Bridge + Returns */}
        <SectionPanel title="VALUE BRIDGE + RETURNS" borderColor={BT.text.green} metrics={[{ l: 'F_IRR', c: BT.met.financial }, { l: 'F_COC', c: BT.met.financial }]}>
          <DataRow label="VALUE CREATED" value={fmt(valueAdd, '$')} valueColor={valueAdd && valueAdd > 0 ? BT.text.green : BT.text.red} />
          <DataRow label="LEVERED IRR"   value={irr ? `${Number(irr).toFixed(1)}%` : '—'} metricColor={BT.met.financial} />
          <DataRow label="EQUITY MULT"   value={em ? `${Number(em).toFixed(2)}x` : '—'} metricColor={BT.met.financial} />
          <DataRow label="CASH-ON-CASH"  value={coc ? `${Number(coc).toFixed(1)}%` : '—'} metricColor={BT.met.financial} />
          <DataRow label="YIELD ON COST" value={yoc ? `${Number(yoc).toFixed(2)}%` : '—'} metricColor={BT.met.financial} />
          <DataRow label="RENO TIMELINE" value={totalMo ? `${totalMo} mo` : constructionMo ? `${constructionMo} mo reno` : '—'} valueColor={BT.text.cyan} border={false} />
        </SectionPanel>

        {/* AI Intelligence Brief */}
        <SectionPanel title="AI INTELLIGENCE BRIEF" borderColor={BT.text.cyan}>
          {[
            { cat: 'DEMAND',  c: BT.text.green,  msg: sigList[0]?.score ? `Demand ${sigList[0].score}/100. ${sigList[0].score >= 70 ? 'Repositioned asset should capture rent growth from tenant demand.' : 'Demand signals weak — review rent upside assumptions.'}` : 'Demand data loading from platform metrics engine.' },
            { cat: 'NOI',     c: BT.text.amber,  msg: noiUpside ? `NOI upside of ${fmt(noiUpside, '$')} available through renovation and lease-up to ${pct(targetOcc)} occupancy.` : 'Enter current and projected NOI to calculate transformation opportunity.' },
            { cat: 'CAPEX',   c: BT.text.purple, msg: totalCapex ? `Total capex of ${fmt(totalCapex, '$')} budgeted. ${renovCostPerUnit ? `$${Math.round(renovCostPerUnit).toLocaleString()}/unit renovation cost.` : 'Enter renovation budget for per-unit cost analysis.'}` : 'Enter renovation budget to calculate per-unit capex.' },
            { cat: 'ACTION',  c: BT.text.amber,  msg: rec?.name ? `Advance ${rec.name} strategy. NOI transformation of ${fmt(noiUpside ?? 0, '$')} supports repositioning thesis.` : 'Run strategy analysis to generate action recommendation.' },
          ].map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '3px 0', borderBottom: `1px solid ${BT.border.subtle}` }}>
              <Bd c={b.c}>{b.cat}</Bd>
              <span style={{ fontSize: 8, color: BT.text.secondary, lineHeight: 1.5, fontFamily: MONO, flex: 1 }}>{b.msg}</span>
            </div>
          ))}
        </SectionPanel>

        {/* Deal Team + Activity */}
        <SectionPanel title="DEAL TEAM + ACTIVITY" borderColor={BT.text.purple}>
          {[
            { role: 'LEAD',  name: deal?.primaryContact || deal?.leadInvestor || 'Unassigned' },
            { role: 'GC',    name: deal?.generalContractor || deal?.gc || '—' },
            { role: 'ARCH',  name: deal?.architect || '—' },
            { role: 'LEGAL', name: deal?.attorney || deal?.legalCounsel || '—' },
            { role: 'LENDER', name: deal?.lender || deal?.seniorLender || '—' },
          ].map((m, i, arr) => (
            <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 8px', borderBottom: i < arr.length - 1 ? `1px solid ${BT.border.subtle}` : 'none' }}>
              <Bd c={BT.text.purple}>{m.role}</Bd>
              <span style={{ fontSize: 8, color: m.name === '—' ? BT.text.muted : BT.text.primary, fontFamily: MONO }}>{m.name}</span>
            </div>
          ))}
          <div style={{ padding: '5px 8px', borderTop: `1px solid ${BT.border.subtle}` }}>
            <div style={{ fontSize: 7, color: BT.text.muted, fontFamily: MONO }}>JEDI Score updated — {jediScore || '—'}{jediDelta > 0 ? ` (+${jediDelta})` : ''}</div>
            <div style={{ fontSize: 7, color: BT.text.muted, fontFamily: MONO, marginTop: 2 }}>NOI transformation: {fmt(currentNOI, '$')} → {fmt(projectedNOI, '$')}</div>
          </div>
        </SectionPanel>
      </div>

      {/* ─── Secondary nav ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, borderTop: `1px solid ${BT.border.medium}`, background: BT.bg.header, flexShrink: 0 }}>
        {[
          { id: 'zoning',         label: 'ZONING' },
          { id: 'debt',           label: 'CAPITAL' },
          { id: 'proforma',       label: 'PRO FORMA' },
          { id: 'strategy',       label: 'STRATEGY' },
          { id: 'due-diligence',  label: 'DILIGENCE' },
          { id: 'market-intelligence', label: 'MARKET' },
        ].map((link, i) => (
          <button
            key={i}
            onClick={() => onTabChange?.(link.id)}
            style={{
              fontFamily: MONO, fontSize: 7, fontWeight: 600,
              color: BT.text.muted, background: 'none',
              border: 'none', borderRight: `1px solid ${BT.border.subtle}`,
              padding: '5px 10px', cursor: 'pointer', letterSpacing: 0.5,
            }}
            onMouseEnter={e => e.currentTarget.style.color = BT.text.purple}
            onMouseLeave={e => e.currentTarget.style.color = BT.text.muted}
          >
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default RedevelopmentOverview;
