/**
 * F9 Financial Engine — F1 OVERVIEW TAB
 *
 * PURPOSE: Broad deal summary — KPIs, sources/uses, returns breakdown, annual
 * cash flow table, disposition summary, F9 unit economics, valuation gateway
 * metrics, and JEDI Position Sub-score (Lease Velocity engine).
 *
 * MARKET CONTEXT ARCHITECTURE NOTE (T-CONF-2 investigation / Task 1609):
 * This tab renders a MARKET SIGNALS panel (in the AI INSIGHTS sub-tab) sourced
 * from `deal_market_intelligence` via GET /api/market-research/intelligence/:dealId.
 * Fields surfaced: submarket_name, avg_rent, avg_occupancy, rent_growth_yoy, median_hhi.
 * Panel shows a placeholder when no intelligence rows exist for the deal.
 *
 * DecisionTab (F8) intentionally does NOT duplicate this — that tab's purpose is
 * risk verdict from underwriting assumptions, not raw market signals. If both tabs
 * ever need to reference the same market data, extract a shared hook.
 */
import React, { useState, useEffect } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, DataRow, Bd, KpiTile, AlertBanner, TableHeader } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps, AnnualCashFlowRow } from './types';
import { fmt$, fmtPct, fmtX } from './types';
import { apiClient } from '../../../services/api.client';

const MONO = BT.font.mono;

interface PlatformData {
  exitCap?: number;
  capRate?: number;
}

interface MarketSignals {
  submarket_name: string | null;
  avg_rent: number | null;
  avg_occupancy: number | null;
  rent_growth_yoy: number | null;
  median_hhi: number | null;
}

function collisionDot(broker: number | null, platform: number | null): React.ReactNode {
  if (broker == null || platform == null || platform === 0) return null;
  const diverge = Math.abs((broker - platform) / platform);
  if (diverge <= 0.10) return null;
  return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%', background: BT.text.amber,
      display: 'inline-block', marginLeft: 4, flexShrink: 0,
      boxShadow: `0 0 4px ${BT.text.amber}88`,
    }} title={`${(diverge * 100).toFixed(0)}% divergence`} />
  );
}

type OverviewSubTab = 'summary' | 'insights';

export function OverviewTab({ dealId, deal, dealType, assumptions, modelResults, f9Financials }: FinancialEngineTabProps) {
  const [subTab, setSubTab] = useState<OverviewSubTab>('summary');
  const summary = modelResults?.summary;
  const su = modelResults?.sourcesAndUses;
  const cf = modelResults?.annualCashFlow ?? [];

  const dealData = deal?.deal_data as Record<string, unknown> | undefined;
  const brokerCapRate = typeof dealData?.broker_cap_rate === 'number' ? dealData.broker_cap_rate / 100
    : typeof deal?.cap_rate === 'number' ? (deal.cap_rate as number) / 100 : null;
  // F9 wiring: prefer f9Financials purchase price over raw deal field
  const brokerPurchasePrice =
    f9Financials?.capitalStack?.purchasePrice ??
    (typeof deal?.purchase_price === 'number' ? deal.purchase_price as number
      : typeof deal?.asking_price === 'number' ? deal.asking_price as number : null);
  // F9 wiring: platform exit cap and NOI from F9 engine.
  // CF-14: was f9Financials?.proforma?.year1?.find(r => r.field === 'noi')?.resolved —
  // the .find() pattern is explicitly flagged as wrong in cross-surface-read-consistency.md
  // (Rule 3). modelResults.summary.noi is the Engine A computed NOI and is the same value.
  const f9ExitCap = f9Financials?.trafficProjection?.calibrated?.exitCap ?? null;
  const f9Yr1Noi  = modelResults?.summary?.noi ?? null;

  const [platformData, setPlatformData] = useState<PlatformData>({});
  const [marketSignals, setMarketSignals] = useState<MarketSignals | null>(null);
  const [marketSignalsFetched, setMarketSignalsFetched] = useState(false);

  useEffect(() => {
    if (!dealId) return;
    setMarketSignals(null);
    setMarketSignalsFetched(false);
    apiClient.get(`/api/market-research/intelligence/${dealId}`).then((res: any) => {
      const intel = res?.data?.intelligence ?? res?.intelligence;
      setMarketSignals(intel ? {
        submarket_name: intel.submarket_name ?? null,
        avg_rent: intel.avg_rent != null ? parseFloat(intel.avg_rent) : null,
        avg_occupancy: intel.avg_occupancy != null ? parseFloat(intel.avg_occupancy) : null,
        rent_growth_yoy: intel.rent_growth_yoy != null ? parseFloat(intel.rent_growth_yoy) : null,
        median_hhi: intel.median_hhi != null ? parseFloat(intel.median_hhi) : null,
      } : null);
    }).catch(() => { setMarketSignals(null); }).finally(() => setMarketSignalsFetched(true));
  }, [dealId]);

  useEffect(() => {
    if (!dealId) return;
    apiClient.get(`/api/v1/strategy-analyses/${dealId}`).then((res: any) => {
      const raw = res?.data;
      const strats = raw?.data ?? raw?.analyses ?? raw;
      if (Array.isArray(strats) && strats.length > 0) {
        const s = strats[0] as any;
        const pd: PlatformData = {};
        if (s?.assumptions?.exitCap) pd.exitCap = s.assumptions.exitCap / 100;
        if (s?.assumptions?.capRate) pd.capRate = s.assumptions.capRate / 100;
        setPlatformData(pd);
      }
    }).catch(() => {});
  }, [dealId]);

  // F9 wiring: use f9ExitCap (M07 calibrated) as authoritative platform exit cap
  const platformExitCap = f9ExitCap ?? platformData.exitCap ?? null;
  const f9VacancyPct = f9Financials?.trafficProjection?.calibrated?.vacancyPct ?? null;
  const f9PurchasePrice = f9Financials?.capitalStack?.purchasePrice ?? null;

  // LP / GP equity dollar split — derived from equityAtClose × lpShare/gpShare
  const equityAtClose = f9Financials?.capitalStack?.equityAtClose
    ?? Math.max(0, (f9PurchasePrice ?? 0) - (f9Financials?.capitalStack?.loanAmount ?? 0));
  const lpShareOv = assumptions?.waterfall?.lpShare ?? 0.90;
  const gpShareOv = assumptions?.waterfall?.gpShare ?? 0.10;
  const lpEquityDollar = equityAtClose > 0 ? equityAtClose * lpShareOv : null;
  const gpEquityDollar = equityAtClose > 0 ? equityAtClose * gpShareOv : null;

  type ProFormaRow = { label: string; brokerFmt: string; platformFmt: string; brokerRaw: number | null; platformRaw: number | null };
  const proFormaRows: ProFormaRow[] = [
    { label: 'EXIT CAP RATE',      brokerFmt: brokerCapRate != null ? fmtPct(brokerCapRate * 100) : '—', platformFmt: platformExitCap != null ? fmtPct(platformExitCap * 100) : '—', brokerRaw: brokerCapRate, platformRaw: platformExitCap },
    { label: 'ACQUISITION CAP RATE', brokerFmt: brokerCapRate != null ? fmtPct(brokerCapRate * 100) : '—', platformFmt: platformData.capRate != null ? fmtPct(platformData.capRate * 100) : '—', brokerRaw: brokerCapRate, platformRaw: platformData.capRate ?? null },
    { label: 'PURCHASE PRICE',    brokerFmt: brokerPurchasePrice != null ? fmt$(brokerPurchasePrice) : '—', platformFmt: f9PurchasePrice != null ? fmt$(f9PurchasePrice) : '—', brokerRaw: brokerPurchasePrice, platformRaw: f9PurchasePrice },
    { label: 'VACANCY RATE',      brokerFmt: '—', platformFmt: f9VacancyPct != null ? fmtPct(f9VacancyPct * 100) : '—', brokerRaw: null, platformRaw: f9VacancyPct },
    { label: 'YR-1 NOI (F9)',     brokerFmt: '—', platformFmt: f9Yr1Noi != null ? fmt$(f9Yr1Noi) : '—', brokerRaw: null, platformRaw: f9Yr1Noi },
  ];
  const anyCollision = proFormaRows.some(r => collisionDot(r.brokerRaw, r.platformRaw) != null);

  const sourcesArr = Array.isArray(su?.sources) ? su!.sources : [];
  const usesArr    = Array.isArray(su?.uses)    ? su!.uses    : [];
  const totalSources = sourcesArr.reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalUses    = usesArr.reduce((s, r) => s + (r.amount ?? 0), 0);

  // F9 returns: prefer F9 projection engine (IRR bisection + EM from hold-period CFs),
  // fallback to legacy modelResults.summary if F9 engine hasn't populated yet.
  //
  // FIELD ALIGNMENT FIX: mergeModelIntoFinancials writes lpNetIrr / lpEquityMultiple /
  // avgCashOnCash onto f9Financials.returns — the legacy irr / equityMultiple / cashOnCash
  // keys were never written, so those reads were dead code paths that always fell through
  // to summary. Use the correct LP-net field names so treatment-aware returns from the
  // LV engine path are surfaced in the top KPI tiles and DEAL LEVEL column.
  const f9Returns = f9Financials?.returns ?? null;
  const displayIrr = f9Returns?.lpNetIrr        ?? summary?.lpIrr  ?? summary?.irr          ?? null;
  const displayEM  = f9Returns?.lpEquityMultiple ?? summary?.lpEm   ?? summary?.equityMultiple ?? null;
  const displayCoC = f9Returns?.avgCashOnCash    ?? summary?.lpCoC  ?? summary?.cashOnCash    ?? null;

  const SUB_TABS: { k: OverviewSubTab; l: string }[] = [
    { k: 'summary', l: 'EXECUTIVE SUMMARY' },
    { k: 'insights', l: 'AI INSIGHTS' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', gap: 2, padding: '4px 8px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}` }}>
        {SUB_TABS.map(t => (
          <button key={t.k} onClick={() => setSubTab(t.k)} style={{
            background: subTab === t.k ? BT.bg.active : 'transparent',
            color: subTab === t.k ? BT.met.financial : BT.text.muted,
            border: 'none', padding: '3px 10px', fontFamily: MONO, fontSize: 9,
            cursor: 'pointer', letterSpacing: 0.5, borderBottom: subTab === t.k ? `1px solid ${BT.met.financial}` : '1px solid transparent',
          }}>{t.l}</button>
        ))}
      </div>

      {subTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BT.border.subtle, padding: 1 }}>
            {[
              { label: 'IRR', value: displayIrr != null ? fmtPct(displayIrr) : '—', color: BT.met.financial },
              { label: 'EQUITY MULT', value: displayEM != null ? fmtX(displayEM) : '—', color: BT.text.amber },
              { label: 'CASH-ON-CASH', value: displayCoC != null ? fmtPct(displayCoC) : '—', color: BT.met.occupancy },
              { label: 'YEAR 1 NOI', value: summary?.noi != null ? fmt$(summary.noi) : '—', color: BT.text.cyan },
              { label: 'DSCR', value: summary?.dscr != null ? `${parseFloat(String(summary.dscr)).toFixed(2)}×` : '—', color: BT.text.green },
            ].map(k => (
              <div key={k.label} style={{ flex: 1 }}><KpiTile label={k.label} value={k.value} color={k.color} /></div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <SectionPanel title="SOURCES" subtitle="Capital Structure" borderColor={BT.met.financial}>
              {(() => {
                // Filter out any combined equity rows to avoid double-counting with LP/GP split below
                const nonEquitySources = lpEquityDollar != null
                  ? sourcesArr.filter(r => !/(equity)/i.test(r.label))
                  : sourcesArr;
                const hasAnySource = nonEquitySources.length > 0 || lpEquityDollar != null;
                return hasAnySource ? (
                  <>
                    {nonEquitySources.map((r, i) => (
                      <DataRow key={i} label={r.label} value={fmt$(r.amount)} valueColor={BT.met.financial} border={true} />
                    ))}
                    {lpEquityDollar != null && (
                      <>
                        <DataRow
                          label={`LP EQUITY · ${fmtPct(lpShareOv * 100)}`}
                          value={fmt$(lpEquityDollar)}
                          valueColor={BT.met.financial}
                          border={true}
                        />
                        <DataRow
                          label={`GP EQUITY · ${fmtPct(gpShareOv * 100)}`}
                          value={fmt$(gpEquityDollar!)}
                          valueColor={BT.text.orange}
                          border={false}
                        />
                      </>
                    )}
                    <DataRow label="TOTAL SOURCES" value={fmt$(totalSources)} valueColor={BT.text.white} border={false} />
                  </>
                ) : (
                  <DataRow label="—" value="Awaiting model build" valueColor={BT.text.muted} border={false} />
                );
              })()}
            </SectionPanel>

            <SectionPanel title="USES" subtitle="Capital Deployment" borderColor={BT.text.cyan}>
              {usesArr.length > 0
                ? usesArr.map((r, i) => (
                    <DataRow key={i} label={r.label} value={fmt$(r.amount)} valueColor={BT.text.cyan} border={i < usesArr.length - 1} />
                  ))
                : <DataRow label="—" value="Awaiting model build" valueColor={BT.text.muted} border={false} />}
              {usesArr.length > 0 && <DataRow label="TOTAL USES" value={fmt$(totalUses)} valueColor={BT.text.white} border={false} />}
            </SectionPanel>
          </div>

          <SectionPanel title="RETURNS BREAKDOWN" subtitle="Full Deal Period" borderColor={BT.text.amber}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
              <div>
                <div style={{ padding: '4px 8px', fontFamily: MONO, fontSize: 9, color: BT.text.muted, borderBottom: `1px solid ${BT.border.subtle}`, letterSpacing: 0.5 }}>DEAL LEVEL {f9Returns ? '· F9 ENGINE' : ''}</div>
                <DataRow label="IRR" value={displayIrr != null ? fmtPct(displayIrr) : '—'} valueColor={BT.met.financial} />
                <DataRow label="EQUITY MULTIPLE" value={displayEM != null ? fmtX(displayEM) : '—'} valueColor={BT.text.amber} />
                <DataRow label="CASH-ON-CASH" value={displayCoC != null ? fmtPct(displayCoC) : '—'} valueColor={BT.met.occupancy} />
                <DataRow label="TOTAL PROFIT" value={summary?.totalProfit != null ? fmt$(summary.totalProfit) : '—'} valueColor={BT.text.white} border={false} />
              </div>
              <div>
                <div style={{ padding: '4px 8px', fontFamily: MONO, fontSize: 9, color: BT.text.cyan, borderBottom: `1px solid ${BT.border.subtle}`, letterSpacing: 0.5 }}>LP RETURNS</div>
                <DataRow label="LP IRR" value={summary?.lpIrr != null ? fmtPct(summary.lpIrr) : '—'} valueColor={BT.met.financial} />
                <DataRow label="LP EM" value={summary?.lpEm != null ? fmtX(summary.lpEm) : '—'} valueColor={BT.text.amber} />
                <DataRow label="LP DISTRIBUTIONS" value={summary?.lpTotalDistributions != null ? fmt$(summary.lpTotalDistributions) : '—'} valueColor={BT.text.cyan} />
                <DataRow label="LP PROFIT" value={summary?.lpProfit != null ? fmt$(summary.lpProfit) : '—'} valueColor={BT.text.white} border={false} />
              </div>
              <div>
                <div style={{ padding: '4px 8px', fontFamily: MONO, fontSize: 9, color: BT.text.orange, borderBottom: `1px solid ${BT.border.subtle}`, letterSpacing: 0.5 }}>GP RETURNS</div>
                <DataRow label="GP IRR" value={summary?.gpIrr != null ? fmtPct(summary.gpIrr) : '—'} valueColor={BT.met.financial} />
                <DataRow label="GP EM" value={summary?.gpEm != null ? fmtX(summary.gpEm) : '—'} valueColor={BT.text.amber} />
                <DataRow label="GP DISTRIBUTIONS" value={summary?.gpTotalDistributions != null ? fmt$(summary.gpTotalDistributions) : '—'} valueColor={BT.text.orange} />
                <DataRow label="PROMOTE EARNED" value={summary?.gpPromoteEarned != null ? fmt$(summary.gpPromoteEarned) : '—'} valueColor={BT.text.white} border={false} />
              </div>
            </div>
          </SectionPanel>

          <SectionPanel title="RETURNS BY YEAR" subtitle="Annual Breakdown — Deal + LP + GP" borderColor={BT.text.purple}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BT.border.medium}` }}>
                    {['YEAR', 'NOI', 'DEBT SVC', 'CASH FLOW', 'LP DIST', 'GP DIST', 'CUM RETURN', 'EM'].map(h => (
                      <th key={h} style={{ padding: '4px 6px', color: BT.text.muted, textAlign: h === 'YEAR' ? 'left' : 'right', fontWeight: 500, letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cf.length > 0 ? cf.map((row: AnnualCashFlowRow, i: number) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                      <td style={{ padding: '3px 6px', color: BT.text.secondary }}>{row.year}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.cyan, textAlign: 'right' }}>{fmt$(row.noi)}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.red, textAlign: 'right' }}>{fmt$(row.debtService)}</td>
                      <td style={{ padding: '3px 6px', color: BT.met.financial, textAlign: 'right' }}>{fmt$(row.cashFlow)}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.cyan, textAlign: 'right' }}>{row.lpDistribution != null ? fmt$(row.lpDistribution) : '—'}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.orange, textAlign: 'right' }}>{row.gpDistribution != null ? fmt$(row.gpDistribution) : '—'}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.amber, textAlign: 'right' }}>{row.cumulativeReturn != null ? fmt$(row.cumulativeReturn) : '—'}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.purple, textAlign: 'right' }}>{row.runningEM != null ? fmtX(row.runningEM) : '—'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={8} style={{ padding: '12px 6px', color: BT.text.muted, textAlign: 'center' }}>Build model to generate annual projections</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionPanel>

          <SectionPanel title="DISPOSITION SUMMARY" subtitle="Exit Strategy Overview" borderColor={BT.text.amber}>
            <DataRow label="EXIT CAP RATE" value={assumptions?.disposition?.exitCapRate != null ? fmtPct(assumptions.disposition.exitCapRate * 100) : '—'} valueColor={BT.text.amber} />
            <DataRow label="HOLD PERIOD" value={assumptions?.holdPeriod != null ? `${assumptions.holdPeriod} years` : '—'} valueColor={BT.text.secondary} />
            <DataRow label="SELLING COSTS" value={assumptions?.disposition?.sellingCosts != null ? fmtPct(assumptions.disposition.sellingCosts * 100) : '—'} valueColor={BT.text.secondary} />
            <DataRow label="EXIT VALUE" value={summary?.exitValue != null ? fmt$(summary.exitValue) : '—'} valueColor={BT.met.financial} />
            <DataRow label="TOTAL PROFIT" value={summary?.totalProfit != null ? fmt$(summary.totalProfit) : '—'} valueColor={BT.text.white} border={false} />
          </SectionPanel>

          {/* F9 Unit Economics — sourced from GET /financials */}
          {f9Financials?.proforma?.unitEconomics && (
            <SectionPanel title="F9 UNIT ECONOMICS" subtitle="M07-calibrated · /financials engine" borderColor={BT.text.cyan}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <div>
                  <DataRow label="GPR / UNIT / MO" value={f9Financials.proforma.unitEconomics.gprPerUnit != null ? fmt$(f9Financials.proforma.unitEconomics.gprPerUnit / 12) : '—'} valueColor={BT.text.cyan} />
                  <DataRow label="EGI / UNIT / MO" value={f9Financials.proforma.unitEconomics.egiPerUnit != null ? fmt$(f9Financials.proforma.unitEconomics.egiPerUnit / 12) : '—'} valueColor={BT.met.financial} />
                  <DataRow label="OPEX / UNIT / MO" value={f9Financials.proforma.unitEconomics.opexPerUnit != null ? fmt$(f9Financials.proforma.unitEconomics.opexPerUnit / 12) : '—'} valueColor={BT.text.red} />
                  <DataRow label="NOI / UNIT / MO" value={f9Financials.proforma.unitEconomics.noiPerUnit != null ? fmt$(f9Financials.proforma.unitEconomics.noiPerUnit / 12) : '—'} valueColor={BT.met.financial} border={false} />
                </div>
                <div>
                  <DataRow label="OPEX RATIO" value={f9Financials.proforma.unitEconomics.opexRatioPct != null ? fmtPct(f9Financials.proforma.unitEconomics.opexRatioPct) : '—'} valueColor={BT.text.amber} />
                  <DataRow label="VACANCY (M07)" value={f9Financials.proforma.unitEconomics.derivedVacancyPct != null ? fmtPct((f9Financials.proforma.unitEconomics.derivedVacancyPct as number) * 100) : '—'} valueColor={BT.text.muted} />
                  <DataRow label="PRICE / UNIT" value={f9Financials.capitalStack?.pricePerUnit != null ? fmt$(f9Financials.capitalStack.pricePerUnit) : '—'} valueColor={BT.text.secondary} />
                  <DataRow label="EXIT CAP (M07)" value={f9ExitCap != null ? fmtPct(f9ExitCap * 100) : '—'} valueColor={BT.text.amber} border={false} />
                </div>
              </div>
            </SectionPanel>
          )}

          {/* Valuation Metrics — sourced from proforma.valuationSnapshot */}
          {f9Financials?.proforma?.valuationSnapshot && (() => {
            const vs = f9Financials.proforma.valuationSnapshot!;
            return (
              <SectionPanel title="VALUATION METRICS" subtitle="Price · Yield · Multiplier gateway metrics" borderColor={BT.text.green}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <div>
                    <DataRow label="PRICE / UNIT" value={vs.pricePerUnit != null ? fmt$(vs.pricePerUnit) : '—'} valueColor={BT.text.cyan} />
                    <DataRow label="GRM" value={vs.grm != null ? fmtX(vs.grm) : '—'} valueColor={BT.text.amber} />
                    <DataRow label="GOING-IN CAP (T-12)" value={vs.goingInCapT12 != null ? fmtPct(vs.goingInCapT12 * 100) : '—'} valueColor={BT.met.financial} border={false} />
                  </div>
                  <div>
                    <DataRow label="PRICE / SF" value={vs.pricePerSF != null ? fmt$(vs.pricePerSF) : '—'} valueColor={BT.text.cyan} />
                    <DataRow label="GIM" value={vs.gim != null ? fmtX(vs.gim) : '—'} valueColor={BT.text.amber} />
                    <DataRow label="PRICE-TO-RC" value={vs.priceToRC != null ? fmtX(vs.priceToRC) : 'PENDING RC FEED'} valueColor={vs.priceToRC != null ? BT.text.secondary : BT.text.muted} border={false} />
                  </div>
                </div>
              </SectionPanel>
            );
          })()}

          <div style={{ flexShrink: 0 }}>
            {anyCollision ? (
              <AlertBanner label="COLLISION DETECTED" text="Broker and platform assumptions diverge >10% on highlighted rows" color={BT.text.amber} badge={<Bd c={BT.text.amber}>REVIEW REQUIRED</Bd>} />
            ) : (
              <AlertBanner label="3-LAYER MODEL" text="BROKER · PLATFORM · YOU — No divergences detected above threshold" color={BT.met.financial} badge={<Bd c={BT.met.financial}>ALIGNED</Bd>} />
            )}
            <TableHeader cols={[
              { label: 'ASSUMPTION', flex: 2, color: BT.text.muted },
              { label: 'BROKER', flex: 1, color: BT.text.cyan },
              { label: 'PLATFORM', flex: 1, color: BT.text.purple },
              { label: 'YOU', flex: 1, color: BT.text.amber },
            ]} />
            {proFormaRows.map((row, i) => (
              <div key={row.label} style={{
                display: 'flex', alignItems: 'center',
                background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                borderBottom: `1px solid ${BT.border.subtle}`,
              }}>
                <div style={{ flex: 2, padding: '4px 8px', fontFamily: MONO, fontSize: 9, color: BT.text.secondary, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {row.label}{collisionDot(row.brokerRaw, row.platformRaw)}
                </div>
                <div style={{ flex: 1, padding: '4px 8px', fontFamily: MONO, fontSize: 9, color: BT.text.cyan, textAlign: 'right' as const }}>{row.brokerFmt}</div>
                <div style={{ flex: 1, padding: '4px 8px', fontFamily: MONO, fontSize: 9, color: BT.text.purple, textAlign: 'right' as const }}>{row.platformFmt}</div>
                <div style={{ flex: 1, padding: '4px 8px', fontFamily: MONO, fontSize: 9, color: BT.text.amber, textAlign: 'right' as const }}>—</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'insights' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* ── Market Signals ─────────────────────────────────────────── */}
          {marketSignalsFetched && (
            <SectionPanel
              title="MARKET SIGNALS"
              subtitle={marketSignals?.submarket_name ? `Submarket · ${marketSignals.submarket_name}` : 'deal_market_intelligence · live data'}
              borderColor={BT.text.purple}
            >
              {marketSignals ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1, background: BT.border.subtle, padding: 1 }}>
                  <div style={{ background: BT.bg.base, padding: '8px 10px' }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 3, letterSpacing: 0.5 }}>AVG SUBMARKET RENT</div>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.cyan }}>
                      {marketSignals.avg_rent != null ? fmt$(marketSignals.avg_rent) : '—'}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>per unit / mo</div>
                  </div>
                  <div style={{ background: BT.bg.base, padding: '8px 10px' }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 3, letterSpacing: 0.5 }}>AVG OCCUPANCY</div>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.met.occupancy }}>
                      {marketSignals.avg_occupancy != null ? fmtPct(marketSignals.avg_occupancy * 100) : '—'}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>submarket avg</div>
                  </div>
                  <div style={{ background: BT.bg.base, padding: '8px 10px' }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 3, letterSpacing: 0.5 }}>RENT GROWTH YoY</div>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: marketSignals.rent_growth_yoy != null && marketSignals.rent_growth_yoy >= 0 ? BT.met.financial : BT.text.red }}>
                      {marketSignals.rent_growth_yoy != null ? fmtPct(marketSignals.rent_growth_yoy * 100) : '—'}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>year over year</div>
                  </div>
                  <div style={{ background: BT.bg.base, padding: '8px 10px' }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 3, letterSpacing: 0.5 }}>MEDIAN HHI</div>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.amber }}>
                      {marketSignals.median_hhi != null && marketSignals.median_hhi > 0 ? fmt$(marketSignals.median_hhi) : '—'}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>household income</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 9, color: BT.text.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: BT.text.amber }}>◌</span>
                  No market intelligence data yet — run the Research Agent to populate submarket signals for this deal.
                </div>
              )}
            </SectionPanel>
          )}

          {/* ── JEDI Score: Position Sub-score ──────────────────────────── */}
          {(() => {
            const lv = f9Financials?.leaseVelocity ?? null;

            // Compute position score: base from NOI clarity, adjusted by confidence + tier
            let posScore: number | null = null;
            if (lv) {
              const clarity = lv.stabilizedNoiClarity ?? 0;
              const confAdj = lv.confidence === 'high' ? 0 : lv.confidence === 'medium' ? -10 : -22;
              const tierAdj = lv.subjectHistoryTier === 'S1' ? -15
                : lv.subjectHistoryTier === 'S2' ? 0
                : lv.subjectHistoryTier === 'S3' ? 8
                : lv.subjectHistoryTier === 'S4' ? 12 : -20;
              posScore = Math.max(0, Math.min(100, Math.round(clarity * 100 + confAdj + tierAdj)));
            }

            const modeLabel: Record<string, string> = {
              LEASE_UP_NEW_CONSTRUCTION: 'LEASE-UP',
              STABILIZED_MAINTENANCE:   'STABILIZED',
              OCCUPANCY_RECOVERY:       'RECOVERY',
              V2_PENDING_VALUE_ADD:     'VALUE-ADD',
            };
            const confColor: Record<string, string> = {
              high:   BT.met.financial,
              medium: BT.text.amber,
              low:    BT.text.red,
            };
            const scoreColor = posScore == null ? BT.text.muted
              : posScore >= 70 ? BT.met.financial
              : posScore >= 45 ? BT.text.amber
              : BT.text.red;

            return (
              <SectionPanel title="JEDI SCORE · POSITION SUB-SCORE" subtitle="Lease Velocity engine — stabilized NOI defensibility" borderColor={BT.text.cyan}>
                {lv ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1, background: BT.border.subtle, padding: 1 }}>
                    {/* Mode */}
                    <div style={{ background: BT.bg.base, padding: '8px 10px' }}>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 3 }}>MODE</div>
                      <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.cyan }}>
                        {modeLabel[lv.resolvedMode] ?? lv.resolvedMode}
                      </div>
                    </div>
                    {/* Confidence — tooltip clarifies score impact */}
                    <div
                      style={{ background: BT.bg.base, padding: '8px 10px', cursor: 'help' }}
                      title={
                        lv.confidence === 'high'
                          ? 'HIGH confidence: rent-roll data is dense and internally consistent. No penalty applied to Position Score.'
                          : lv.confidence === 'medium'
                          ? 'MEDIUM confidence: some rent-roll gaps or comp dispersion. −10 pts applied to Position Score.'
                          : 'LOW confidence: sparse or conflicting data. −22 pts applied to Position Score. Underwrite conservatively.'
                      }
                    >
                      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 3 }}>CONFIDENCE ⓘ</div>
                      <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: confColor[lv.confidence] ?? BT.text.muted }}>
                        {lv.confidence.toUpperCase()}
                      </div>
                      {lv.subjectHistoryTier && (
                        <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                          {lv.subjectHistoryTier} history
                        </div>
                      )}
                    </div>
                    {/* Stab month */}
                    <div style={{ background: BT.bg.base, padding: '8px 10px' }}>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 3 }}>STABILIZATION</div>
                      <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.primary }}>
                        {lv.stabilizationMonth != null ? `Mo ${lv.stabilizationMonth}` : '—'}
                      </div>
                      {lv.stabilizationMonth != null && (
                        <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                          {Math.ceil(lv.stabilizationMonth / 12)} yr lease-up
                        </div>
                      )}
                    </div>
                    {/* Position score */}
                    <div style={{ background: `${scoreColor}10`, padding: '8px 10px', borderLeft: `2px solid ${scoreColor}` }}>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 3 }}>POSITION SCORE</div>
                      <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: scoreColor }}>
                        {posScore != null ? posScore : '—'}
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                        NOI clarity {lv.stabilizedNoiClarity != null ? `${(lv.stabilizedNoiClarity * 100).toFixed(0)}%` : '—'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 9, color: BT.text.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: BT.text.amber }}>◌</span>
                    LV engine not connected — Position sub-score pending M07 schema + backend engine.
                    Score will reflect stabilized NOI clarity once lease velocity data is available.
                  </div>
                )}
                <div style={{ padding: '4px 10px', borderTop: `1px solid ${BT.border.subtle}`, fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                  Reacts to <span style={{ color: BT.text.cyan }}>lease_velocity.output.updated</span> and <span style={{ color: BT.text.cyan }}>leasing_cost_treatment.changed</span> events.
                </div>
              </SectionPanel>
            );
          })()}

          <SectionPanel title="JEDI AI INSIGHTS" subtitle="Opus-powered deal intelligence" borderColor={BT.met.financial}>
            <div style={{ padding: '12px', fontFamily: MONO, fontSize: 10, color: BT.text.secondary, lineHeight: 1.6 }}>
              <div style={{ marginBottom: 8, color: BT.text.muted, fontSize: 9, letterSpacing: 0.5 }}>SOURCE: ENGINE + AI</div>
              <div style={{ color: BT.text.primary }}>
                Build the financial model to generate AI-powered insights. Opus will analyze your assumptions,
                identify risks, and provide data-driven commentary on deal performance.
              </div>
            </div>
          </SectionPanel>
        </div>
      )}
    </div>
  );
}

export default OverviewTab;
