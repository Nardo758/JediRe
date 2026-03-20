/**
 * Bloomberg Terminal v0.34 — F1 OVERVIEW · GROUND-UP DEVELOPMENT variant
 * Sections: JEDI Gauge · 5 Signals · Site/Entitlements
 *            Development Budget · Capital Structure · Timeline
 *            Returns · AI Brief · Activity
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
let cssMounted = false;
function mountCss() {
  if (cssMounted || typeof document === 'undefined') return;
  cssMounted = true;
  const el = document.createElement('style');
  el.textContent = OVERVIEW_CSS;
  document.head.appendChild(el);
}

function fmt(v: number | null | undefined, prefix = '', suffix = '', dec = 0): string {
  if (v == null || isNaN(v)) return '—';
  if (Math.abs(v) >= 1e9) return `${prefix}${(v / 1e9).toFixed(1)}B${suffix}`;
  if (Math.abs(v) >= 1e6) return `${prefix}${(v / 1e6).toFixed(1)}M${suffix}`;
  if (Math.abs(v) >= 1e3) return `${prefix}${Math.round(v / 1e3)}K${suffix}`;
  return `${prefix}${v.toFixed(dec)}${suffix}`;
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

export const DevelopmentOverview: React.FC<Props> = ({ deal, onTabChange }) => {
  mountCss();
  const { capitalStructure, assumptions, computedReturns, siteData } = useDealModule();

  const [jediScore, setJediScore]         = useState<number>(0);
  const [jediDelta, setJediDelta]         = useState<number>(0);
  const [signals, setSignals]             = useState<any[]>([]);
  const [scoreLoading, setScoreLoading]   = useState(true);
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
  const trend   = [62, 65, 63, 67, 70, 72, 74, 76, jediScore || 74];
  const stageVal = (deal?.stage || deal?.dealStage || 'PROSPECT').toUpperCase();

  const f = (snake: string, camel: string, fallback: any = null) =>
    deal?.[snake] ?? deal?.[camel] ?? fallback;

  const proposedUnits  = f('target_units', 'targetUnits') ?? f('units', 'units');
  const totalSF        = f('total_sf', 'totalSf') ?? f('gross_building_area', 'grossBuildingArea');
  const zoning         = f('zoning_code', 'zoningCode') ?? f('zoning', 'zoning') ?? siteData?.baseDistrictCode;
  const lotSize        = f('lot_size', 'lotSize') ?? f('lot_size_acres', 'lotSizeAcres');
  const buildingType   = f('building_type', 'buildingType') ?? f('property_type', 'propertyType', 'Multifamily');
  const entitled       = f('entitled', 'entitled');
  const maxHeight      = f('max_height', 'maxHeight');
  const parkingSpaces  = f('parking_spaces', 'parkingSpaces');

  const landCost  = f('land_cost', 'landCost') ?? capitalStructure?.landCost;
  const hardCosts = f('hard_costs', 'hardCosts') ?? capitalStructure?.hardCosts;
  const softCosts = f('soft_costs', 'softCosts') ?? capitalStructure?.softCosts;
  const contingency = f('contingency', 'contingency') ?? capitalStructure?.contingency;
  const totalDevCost = f('total_development_cost', 'totalDevelopmentCost') ?? capitalStructure?.totalDevelopmentCost;
  const costPerUnit  = totalDevCost && proposedUnits ? totalDevCost / proposedUnits : null;
  const costPerSF    = totalDevCost && totalSF ? totalDevCost / totalSF : null;

  const totalEquity = capitalStructure?.totalEquity;
  const totalDebt   = capitalStructure?.loanBalance?.[0] ?? capitalStructure?.totalDebt;
  const ltc = totalDevCost && totalDebt ? Math.round((totalDebt / totalDevCost) * 100) : 65;

  const constructionMo = f('construction_months', 'constructionMonths');
  const leaseUpMo      = f('lease_up_months', 'leaseUpMonths');
  const totalMo        = constructionMo && leaseUpMo ? constructionMo + leaseUpMo : null;

  const yoc    = computedReturns?.yieldOnCost ?? (computedReturns?.yoc ? computedReturns.yoc * 100 : null);
  const irr    = computedReturns?.irrLevered ? computedReturns.irrLevered * 100 : (computedReturns?.irr ?? deal?.irr ?? null);
  const em     = computedReturns?.equityMultiple ?? deal?.equityMultiple;
  const margin  = f('profit_margin', 'profitMargin');
  const capRate = deal?.capRate ?? deal?.cap_rate ?? null;

  const rec    = strategyResults?.strategies?.find((s: any) => s.id === strategyResults.recommendedStrategyId) ?? strategyResults?.strategies?.[0];

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
        title="OVERVIEW · GROUND-UP DEVELOPMENT"
        subtitle="M01 · Development Command Center"
        borderColor={BT.text.green}
        metrics={[
          { l: 'JEDI',  c: BT.text.amber },
          { l: 'F_YOC', c: BT.met.financial },
          { l: 'F_IRR', c: BT.met.financial },
          { l: 'S_ENT', c: BT.met.supply },
        ]}
        right={<StageBd stage={stageVal} />}
      />

      {/* ═══ ROW 1: JEDI Gauge · 5 Signals · Site + Entitlements ═══ */}
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
          <div style={{ fontSize: 7, color: BT.text.muted, fontFamily: MONO }}>Ground-Up</div>
          <Spark data={trend} color={sc} w={100} h={18} />
          <Bd c={sc}>{verdict}</Bd>
          <Bd c={BT.text.green}>DEVELOPMENT</Bd>
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
                  <div key={i} style={{ flex: 1, textAlign: 'center', padding: '3px 4px', background: BT.bg.terminal, borderTop: isWin ? `2px solid ${BT.text.green}` : `2px solid ${BT.border.subtle}` }}>
                    <div style={{ fontSize: 7, color: isWin ? BT.text.green : BT.text.muted, fontWeight: 700, fontFamily: MONO }}>{s.name?.toUpperCase().slice(0, 6)}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: isWin ? BT.text.green : BT.text.secondary, fontFamily: MONO }}>{Math.round(s.confidence)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Site + Entitlements */}
        <div style={{ background: BT.bg.panel, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '5px 8px', borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.header }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: BT.text.white, letterSpacing: 0.5, fontFamily: MONO }}>SITE + ENTITLEMENTS</div>
          </div>
          <DataRow label="ADDRESS"    value={deal?.address?.split(',')[0] || deal?.name || '—'} valueColor={BT.text.primary} />
          <DataRow label="MARKET"     value={deal?.market || deal?.city || '—'} valueColor={BT.text.secondary} />
          <DataRow label="ZONING"     value={zoning || '—'} valueColor={BT.text.cyan} />
          <DataRow label="LOT SIZE"   value={lotSize ? `${lotSize} ac` : '—'} />
          <DataRow label="ENTITLED"   value={entitled != null ? (entitled ? 'YES' : 'NO') : '—'} valueColor={entitled ? BT.text.green : BT.text.orange} />
          <DataRow label="MAX HEIGHT" value={maxHeight ? `${maxHeight} stories` : '—'} />
          <DataRow label="TYPE"       value={buildingType || '—'} valueColor={BT.text.purple} />
          <DataRow label="STAGE"      value={<StageBd stage={stageVal} />} />
          <DataRow label="RISK"       value={<RiskDot level={deal?.riskLevel?.toUpperCase() || 'LOW'} />} border={false} />
        </div>
      </div>

      {/* ═══ ROW 2: Development Budget · Capital Structure · Timeline ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: BT.border.subtle, borderTop: `1px solid ${BT.border.subtle}` }}>

        {/* Development Budget */}
        <SectionPanel title="DEVELOPMENT BUDGET" borderColor={BT.text.amber} metrics={[{ l: 'F_COST', c: BT.met.financial }]}>
          <DataRow label="LAND COST"     value={fmt(landCost, '$')} metricColor={BT.met.financial} />
          <DataRow label="HARD COSTS"    value={fmt(hardCosts, '$')} metricColor={BT.met.financial} />
          <DataRow label="SOFT COSTS"    value={fmt(softCosts, '$')} metricColor={BT.met.supply} />
          <DataRow label="CONTINGENCY"   value={fmt(contingency, '$')} valueColor={BT.text.orange} />
          <DataRow label="TOTAL DEV COST" value={fmt(totalDevCost, '$')} metricColor={BT.met.financial} />
          <DataRow label="COST/UNIT"     value={fmt(costPerUnit, '$')} metricColor={BT.met.financial} />
          <DataRow label="COST/SF"       value={costPerSF ? `$${costPerSF.toFixed(0)}/sf` : '—'} border={false} />
        </SectionPanel>

        {/* Capital Structure */}
        <SectionPanel title="CAPITAL STRUCTURE" borderColor={BT.text.cyan} metrics={[{ l: 'F_CAP', c: BT.met.financial }]}>
          <DataRow label="TOTAL COST"     value={fmt(totalDevCost, '$')} metricColor={BT.met.financial} />
          <DataRow label="SENIOR DEBT"    value={fmt(totalDebt, '$')} metricColor={BT.met.financial} />
          <DataRow label="EQUITY"         value={fmt(totalEquity, '$')} metricColor={BT.met.financial} />
          <DataRow label="LTC"            value={`${ltc}%`} valueColor={ltc <= 65 ? BT.text.green : BT.text.orange} />
          <DataRow label="PROPOSED UNITS" value={proposedUnits ? `${proposedUnits} units` : '—'} />
          <DataRow label="TOTAL SF"       value={totalSF ? `${(totalSF / 1000).toFixed(0)}K sf` : '—'} />
          <DataRow label="PARKING"        value={parkingSpaces ? `${parkingSpaces} stalls` : '—'} border={false} />
        </SectionPanel>

        {/* Construction Timeline */}
        <SectionPanel title="CONSTRUCTION TIMELINE" borderColor={BT.text.purple}>
          <DataRow label="CONSTRUCTION"  value={constructionMo ? `${constructionMo} mo` : '—'} valueColor={BT.text.cyan} />
          <DataRow label="LEASE-UP"      value={leaseUpMo ? `${leaseUpMo} mo` : '—'} valueColor={BT.text.cyan} />
          <DataRow label="TOTAL SCHEDULE" value={totalMo ? `${totalMo} mo (${(totalMo / 12).toFixed(1)} yr)` : '—'} valueColor={BT.text.amber} />
          <DataRow label="STAB OCC TARGET" value={assumptions?.stabilizedOccupancy ? `${(assumptions.stabilizedOccupancy * 100).toFixed(0)}%` : '95%'} />
          <DataRow label="CO DATE"       value={f('co_date', 'coDate') || '—'} />
          <DataRow label="STAB DATE"     value={f('stabilization_date', 'stabilizationDate') || '—'} border={false} />
        </SectionPanel>
      </div>

      {/* ═══ ROW 3: Returns · AI Brief · Activity ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: BT.border.subtle, borderTop: `1px solid ${BT.border.subtle}` }}>

        {/* Projected Returns */}
        <SectionPanel title="PROJECTED RETURNS" borderColor={BT.text.green} metrics={[{ l: 'F_IRR', c: BT.met.financial }, { l: 'F_YOC', c: BT.met.financial }]}>
          <DataRow label="YIELD ON COST"  value={yoc ? `${Number(yoc).toFixed(2)}%` : '—'} metricColor={BT.met.financial} />
          <DataRow label="LEVERED IRR"    value={irr ? `${Number(irr).toFixed(1)}%` : '—'} metricColor={BT.met.financial} />
          <DataRow label="EQUITY MULTIPLE" value={em ? `${Number(em).toFixed(2)}x` : '—'} metricColor={BT.met.financial} />
          <DataRow label="PROFIT MARGIN"  value={margin ? `${Number(margin).toFixed(1)}%` : '—'} valueColor={margin && margin >= 20 ? BT.text.green : BT.text.orange} />
          <DataRow label="DEV SPREAD"     value={yoc && capRate ? `${(Number(yoc) - capRate * 100).toFixed(0)}bps` : '—'} valueColor={BT.text.teal} />
          {Boolean(rec) && <DataRow label="STRATEGY" value={rec!.name?.toUpperCase().slice(0, 12) || '—'} valueColor={BT.text.green} border={false} />}
        </SectionPanel>

        {/* AI Intelligence Brief */}
        <SectionPanel title="AI INTELLIGENCE BRIEF" borderColor={BT.text.cyan}>
          {[
            { cat: 'DEMAND',  c: BT.text.green,  msg: sigList[0]?.score ? `Demand signal ${sigList[0].score}/100. ${sigList[0].score >= 70 ? 'Absorption rate supports lease-up thesis.' : 'Monitor demand—below-threshold signal detected.'}` : 'Demand data loading from platform metrics engine.' },
            { cat: 'SUPPLY',  c: BT.text.amber,  msg: sigList[1]?.score ? `Supply pipeline ${sigList[1].score}/100. ${sigList[1].score >= 65 ? 'No material supply overhang in delivery window.' : 'Supply pressure building—review delivery timeline.'}` : 'Supply pipeline data loading.' },
            { cat: 'ENTITLE', c: BT.text.purple, msg: entitled != null ? (entitled ? 'Entitlements confirmed — by-right delivery path reduces execution risk.' : 'Entitlements pending — add timeline buffer to underwriting.') : 'Entitlement status not confirmed. Verify zoning approval path.' },
            { cat: 'ACTION',  c: BT.text.amber,  msg: rec?.name ? `Advance ${rec.name} strategy. Run full analysis for detailed scoring and underwriting review.` : 'Run strategy analysis to generate action recommendation.' },
          ].map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '3px 0', borderBottom: `1px solid ${BT.border.subtle}` }}>
              <Bd c={b.c}>{b.cat}</Bd>
              <span style={{ fontSize: 8, color: BT.text.secondary, lineHeight: 1.5, fontFamily: MONO, flex: 1 }}>{b.msg}</span>
            </div>
          ))}
        </SectionPanel>

        {/* Deal Team */}
        <SectionPanel title="DEAL TEAM + ACTIVITY" borderColor={BT.text.purple}>
          {[
            { role: 'LEAD',  name: deal?.primaryContact || deal?.leadInvestor || 'Unassigned' },
            { role: 'DEV',   name: deal?.developer || deal?.generalContractor || deal?.gc || '—' },
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
            <div style={{ fontSize: 7, color: BT.text.muted, fontFamily: MONO, marginTop: 2 }}>Deal stage: {stageVal}</div>
          </div>
        </SectionPanel>
      </div>

      {/* ─── Secondary nav ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, borderTop: `1px solid ${BT.border.medium}`, background: BT.bg.header, flexShrink: 0 }}>
        {[
          { id: 'zoning',       label: 'ZONING' },
          { id: 'debt',         label: 'CAPITAL' },
          { id: 'proforma',     label: 'PRO FORMA' },
          { id: 'timeline',     label: 'TIMELINE' },
          { id: 'due-diligence', label: 'DILIGENCE' },
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
            onMouseEnter={e => e.currentTarget.style.color = BT.text.green}
            onMouseLeave={e => e.currentTarget.style.color = BT.text.muted}
          >
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DevelopmentOverview;
