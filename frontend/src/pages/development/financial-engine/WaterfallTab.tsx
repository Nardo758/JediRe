import React, { useState } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, DataRow, Bd, KpiTile } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps, WaterfallDistribution, WaterfallHurdle } from './types';
import { fmt$, fmtPct, fmtX } from './types';

const MONO = BT.font.mono;

const TIER_COLORS = [BT.text.cyan, BT.text.amber, BT.text.orange, BT.text.red, BT.text.purple];

export function WaterfallTab({ dealId, assumptions, modelResults, f9Financials }: FinancialEngineTabProps) {
  const [view, setView] = useState<'waterfall' | 'capital'>('capital');

  const wf           = assumptions?.waterfall;
  const distributions = modelResults?.waterfallDistributions ?? [];
  const summary       = modelResults?.summary;

  const totalLP   = distributions.reduce((s, d) => s + d.lpAmount, 0);
  const totalGP   = distributions.reduce((s, d) => s + d.gpAmount, 0);
  const totalDist = totalLP + totalGP;

  const equityContribution = wf?.equityContribution ?? f9Financials?.capitalStack?.equityAtClose ?? 0;
  const lpEquity = equityContribution * (wf?.lpShare ?? 0.9);
  const gpEquity = equityContribution * (wf?.gpShare ?? 0.1);

  const purchasePrice = f9Financials?.capitalStack?.purchasePrice ?? 0;
  const loanAmount    = f9Financials?.capitalStack?.loanAmount ?? 0;
  const ltcPct        = f9Financials?.capitalStack?.ltcPct ?? (purchasePrice > 0 ? loanAmount / purchasePrice : 0);
  const interestRate  = f9Financials?.capitalStack?.interestRate ?? assumptions?.financing?.interestRate ?? 0.07;
  const totalUnits    = f9Financials?.totalUnits ?? 0;
  const pricePerUnit  = f9Financials?.capitalStack?.pricePerUnit ?? (totalUnits > 0 ? purchasePrice / totalUnits : 0);

  const f9Noi = f9Financials?.proforma?.year1?.find(r => r.field === 'noi')?.resolved ?? null;
  const noi_y1 = f9Noi ?? modelResults?.summary?.noi ?? 0;
  const capRate = (noi_y1 > 0 && purchasePrice > 0) ? noi_y1 / purchasePrice : null;
  const debtYield = (noi_y1 > 0 && loanAmount > 0) ? noi_y1 / loanAmount : null;
  const annualDS = loanAmount * interestRate;
  const dscr = annualDS > 0 ? noi_y1 / annualDS : null;

  const holdYears = f9Financials?.assumptions?.holdYears ?? assumptions?.holdPeriod ?? 5;
  const rentGrowth = f9Financials?.assumptions?.rentGrowthStabilized ?? 0.03;
  const exitCap = f9Financials?.assumptions?.exitCap ?? assumptions?.disposition?.exitCapRate ?? 0.055;
  const exitNOI = noi_y1 * Math.pow(1 + rentGrowth, holdYears);
  const exitSalePrice = exitCap > 0 ? exitNOI / exitCap : 0;
  const sellingCostsPct = assumptions?.disposition?.sellingCosts ?? 0.03;
  const netProceeds = exitSalePrice > 0 ? exitSalePrice * (1 - sellingCostsPct) - loanAmount : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>CAPITAL STACK · LP/GP WATERFALL · DISTRIBUTIONS</span>
        <Bd c={BT.text.purple}>CAPITAL & WATERFALL</Bd>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['capital', 'waterfall'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? `${BT.text.purple}20` : 'transparent',
              border: `1px solid ${view === v ? BT.text.purple : BT.border.medium}`,
              color: view === v ? BT.text.purple : BT.text.muted,
              fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer', borderRadius: 2, textTransform: 'uppercase',
            }}>{v}</button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BT.border.subtle, padding: 1 }}>
        <KpiTile label="TOTAL DISTRIBUTIONS" value={totalDist > 0 ? fmt$(totalDist) : '—'} color={BT.text.white} />
        <KpiTile label="LP DISTRIBUTIONS" value={totalLP > 0 ? fmt$(totalLP) : '—'} color={BT.text.cyan} />
        <KpiTile label="GP DISTRIBUTIONS" value={totalGP > 0 ? fmt$(totalGP) : '—'} color={BT.text.orange} />
        <KpiTile label="GP PROMOTE" value={summary?.gpPromoteEarned != null ? fmt$(summary.gpPromoteEarned) : '—'} color={BT.text.amber} />
        <KpiTile label="NET PROCEEDS" value={netProceeds > 0 ? fmt$(netProceeds) : '—'} color={BT.met.financial} />
      </div>

      {view === 'capital' ? (
        <>
          {/* Capital stack visual */}
          <SectionPanel title="CAPITAL STACK" subtitle="Day-one close structure" borderColor={BT.text.cyan}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <div>
                {[
                  { label: 'SENIOR DEBT',    amount: loanAmount,    pct: purchasePrice > 0 ? loanAmount / purchasePrice : 0,    color: BT.text.cyan,     sub: `${fmtPct(ltcPct * 100)} LTC · ${fmtPct(interestRate * 100)} rate` },
                  { label: 'LP EQUITY',       amount: lpEquity,      pct: purchasePrice > 0 ? lpEquity / purchasePrice : 0,      color: BT.met.financial, sub: `${fmtPct((wf?.lpShare ?? 0.9) * 100)} of equity` },
                  { label: 'GP EQUITY',       amount: gpEquity,      pct: purchasePrice > 0 ? gpEquity / purchasePrice : 0,      color: BT.text.orange,   sub: `${fmtPct((wf?.gpShare ?? 0.1) * 100)} of equity` },
                ].map((row, i, arr) => (
                  <DataRow key={row.label} label={row.label} value={row.amount > 0 ? fmt$(row.amount) : '—'}
                    valueColor={row.color} sub={`${fmtPct(row.pct * 100)} of TEC · ${row.sub}`}
                    border={i < arr.length - 1} />
                ))}
                <div style={{ padding: '4px 8px', display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${BT.border.medium}` }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, fontWeight: 700 }}>TOTAL ENTERPRISE COST</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.white, fontWeight: 700 }}>{purchasePrice > 0 ? fmt$(purchasePrice) : '—'}</span>
                </div>
              </div>
              {/* Visual stack */}
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {purchasePrice > 0 && [
                  { label: 'SENIOR DEBT', pct: loanAmount / purchasePrice, color: BT.text.cyan },
                  { label: 'LP EQUITY',   pct: lpEquity / purchasePrice,   color: BT.met.financial },
                  { label: 'GP EQUITY',   pct: gpEquity / purchasePrice,   color: BT.text.orange },
                ].map(bar => (
                  <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: Math.max(4, bar.pct * 200), height: 20, background: bar.color, opacity: 0.8, borderRadius: 2 }} />
                    <span style={{ fontFamily: MONO, fontSize: 8, color: bar.color }}>{bar.label} {fmtPct(bar.pct * 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionPanel>

          {/* Debt metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <SectionPanel title="DEBT METRICS" subtitle="Lender underwriting signals" borderColor={BT.text.cyan}>
              <DataRow label="LOAN AMOUNT" value={loanAmount > 0 ? fmt$(loanAmount) : '—'} valueColor={BT.text.cyan} />
              <DataRow label="LTC" value={ltcPct > 0 ? fmtPct(ltcPct * 100) : '—'} valueColor={BT.text.cyan} />
              <DataRow label="INTEREST RATE" value={fmtPct(interestRate * 100)} valueColor={BT.text.amber} />
              <DataRow label="ANNUAL DEBT SERVICE" value={annualDS > 0 ? fmt$(annualDS) : '—'} valueColor={BT.text.red} />
              <DataRow label="DSCR (Y1 DERIVED)" value={dscr != null ? `${dscr.toFixed(2)}×` : '—'} valueColor={dscr != null ? (dscr >= 1.25 ? BT.met.financial : BT.text.red) : BT.text.muted} />
              <DataRow label="DEBT YIELD" value={debtYield != null ? fmtPct(debtYield * 100) : '—'} valueColor={BT.text.amber} border={false} />
            </SectionPanel>

            <SectionPanel title="EQUITY RETURNS" subtitle="LP / GP by investor type" borderColor={BT.met.financial}>
              <DataRow label="TOTAL EQUITY" value={fmt$(equityContribution)} valueColor={BT.text.white} />
              <DataRow label="LP EQUITY" value={lpEquity > 0 ? fmt$(lpEquity) : '—'} valueColor={BT.text.cyan} />
              <DataRow label="GP EQUITY" value={gpEquity > 0 ? fmt$(gpEquity) : '—'} valueColor={BT.text.orange} />
              <DataRow label="LP IRR" value={summary?.lpIrr != null ? fmtPct(summary.lpIrr) : '—'} valueColor={BT.met.financial} />
              <DataRow label="LP EQUITY MULTIPLE" value={summary?.lpEm != null ? fmtX(summary.lpEm) : '—'} valueColor={BT.text.amber} />
              <DataRow label="GP PROMOTE" value={summary?.gpPromoteEarned != null ? fmt$(summary.gpPromoteEarned) : '—'} valueColor={BT.text.orange} border={false} />
            </SectionPanel>
          </div>

          {/* Exit / disposition */}
          <SectionPanel title="EXIT ANALYSIS" subtitle={`Year ${holdYears} disposition`} borderColor={BT.text.amber}>
            <DataRow label="EXIT CAP RATE" value={exitCap > 0 ? fmtPct(exitCap * 100) : '—'} valueColor={BT.text.amber} />
            <DataRow label="TERMINAL NOI" value={exitNOI > 0 ? fmt$(exitNOI) : '—'} valueColor={BT.met.financial} />
            <DataRow label="GROSS SALE PRICE" value={exitSalePrice > 0 ? fmt$(exitSalePrice) : '—'} valueColor={BT.text.white} />
            <DataRow label="SELLING COSTS" value={exitSalePrice > 0 ? fmt$(exitSalePrice * sellingCostsPct) : '—'} valueColor={BT.text.red} sub={fmtPct(sellingCostsPct * 100)} />
            <DataRow label="LOAN PAYOFF" value={loanAmount > 0 ? fmt$(loanAmount) : '—'} valueColor={BT.text.red} />
            <DataRow label="NET PROCEEDS TO EQUITY" value={netProceeds > 0 ? fmt$(netProceeds) : '—'} valueColor={BT.text.cyan} border={false} />
          </SectionPanel>
        </>
      ) : (
        <>
          {/* Waterfall view */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <SectionPanel title="EQUITY STRUCTURE" subtitle="Capital Contributions" borderColor={BT.text.cyan}>
              <DataRow label="TOTAL EQUITY" value={fmt$(equityContribution)} valueColor={BT.text.white} />
              <DataRow label="LP SHARE" value={wf ? `${fmtPct(wf.lpShare * 100)} — ${fmt$(lpEquity)}` : '—'} valueColor={BT.text.cyan} />
              <DataRow label="GP SHARE" value={wf ? `${fmtPct(wf.gpShare * 100)} — ${fmt$(gpEquity)}` : '—'} valueColor={BT.text.orange} border={false} />
            </SectionPanel>

            <SectionPanel title="RETURN METRICS" subtitle="By Investor Type" borderColor={BT.met.financial}>
              <DataRow label="LP IRR" value={summary?.lpIrr != null ? fmtPct(summary.lpIrr) : '—'} valueColor={BT.met.financial} />
              <DataRow label="LP EQUITY MULTIPLE" value={summary?.lpEm != null ? fmtX(summary.lpEm) : '—'} valueColor={BT.text.amber} />
              <DataRow label="GP IRR" value={summary?.gpIrr != null ? fmtPct(summary.gpIrr) : '—'} valueColor={BT.met.financial} />
              <DataRow label="GP EQUITY MULTIPLE" value={summary?.gpEm != null ? fmtX(summary.gpEm) : '—'} valueColor={BT.text.amber} border={false} />
            </SectionPanel>
          </div>

          <SectionPanel title="PREF RETURN & RETURN OF CAPITAL" subtitle="Priority distributions before promote" borderColor={BT.text.cyan}>
            <DataRow label="PREFERRED RETURN RATE" value={wf?.hurdles?.[0] ? fmtPct(wf.hurdles[0].hurdleRate * 100) : '—'} valueColor={BT.text.amber} />
            <DataRow label="LP PREF RETURN" value={lpEquity > 0 && wf?.hurdles?.[0] ? fmt$(lpEquity * wf.hurdles[0].hurdleRate) + '/yr' : '—'} valueColor={BT.text.cyan} />
            <DataRow label="RETURN OF CAPITAL" value={fmt$(lpEquity)} valueColor={BT.text.white} sub="Full return before profit split" border={false} />
          </SectionPanel>

          <SectionPanel title="PROMOTE TIERS" subtitle="Profit split by hurdle rate" borderColor={BT.text.purple}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${BT.border.medium}` }}>
                    {['TIER', 'HURDLE', 'LP SPLIT', 'GP PROMOTE', 'LP AMOUNT', 'GP AMOUNT'].map(h => (
                      <th key={h} style={{ padding: '4px 6px', color: BT.text.muted, textAlign: h === 'TIER' ? 'left' : 'right', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {distributions.length > 0 ? distributions.map((d, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                      <td style={{ padding: '3px 6px', color: TIER_COLORS[i % TIER_COLORS.length], fontWeight: 700 }}>{d.tier}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.amber, textAlign: 'right' }}>{fmtPct(d.hurdleRate * 100)}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.cyan, textAlign: 'right' }}>{fmtPct(d.lpSplit * 100)}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.orange, textAlign: 'right' }}>{fmtPct(d.gpSplit * 100)}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.cyan, textAlign: 'right' }}>{fmt$(d.lpAmount)}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.orange, textAlign: 'right' }}>{fmt$(d.gpAmount)}</td>
                    </tr>
                  )) : (wf?.hurdles ?? []).map((h: WaterfallHurdle, i: number) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                      <td style={{ padding: '3px 6px', color: TIER_COLORS[i % TIER_COLORS.length], fontWeight: 700 }}>TIER {i + 1}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.amber, textAlign: 'right' }}>{fmtPct(h.hurdleRate * 100)}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.cyan, textAlign: 'right' }}>{fmtPct(h.lpSplit * 100)}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.orange, textAlign: 'right' }}>{fmtPct(h.promoteToGP * 100)}</td>
                      <td style={{ padding: '3px 6px', color: BT.text.muted, textAlign: 'right' }}>—</td>
                      <td style={{ padding: '3px 6px', color: BT.text.muted, textAlign: 'right' }}>—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {distributions.length > 0 && (
              <div style={{ display: 'flex', borderTop: `2px solid ${BT.border.medium}` }}>
                <div style={{ flex: 1 }} /><div style={{ flex: 1 }} /><div style={{ flex: 1 }} /><div style={{ flex: 1 }} />
                <div style={{ padding: '4px 6px', fontFamily: MONO, fontSize: 9, color: BT.text.cyan, fontWeight: 700, textAlign: 'right', flex: 1 }}>{fmt$(totalLP)}</div>
                <div style={{ padding: '4px 6px', fontFamily: MONO, fontSize: 9, color: BT.text.orange, fontWeight: 700, textAlign: 'right', flex: 1 }}>{fmt$(totalGP)}</div>
              </div>
            )}
          </SectionPanel>

          {distributions.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>
              Build model to calculate waterfall distributions by hurdle tier
            </div>
          )}

          {/* Waterfall visualization */}
          <SectionPanel title="WATERFALL VISUALIZATION" subtitle="Distribution flow by tier" borderColor={BT.text.purple}>
            <div style={{ padding: '12px', display: 'flex', alignItems: 'flex-end', gap: 12, minHeight: 80 }}>
              {(distributions.length > 0 ? distributions : (wf?.hurdles ?? []).map((h, i) => ({
                tier: `TIER ${i + 1}`, hurdleRate: h.hurdleRate, lpAmount: 0, gpAmount: 0, lpSplit: h.lpSplit, gpSplit: h.promoteToGP, promotePct: h.promoteToGP,
              }))).map((d, i) => {
                const total = d.lpAmount + d.gpAmount;
                const maxTotal = Math.max(...(distributions.length > 0 ? distributions : [d]).map(dd => dd.lpAmount + dd.gpAmount), 1);
                const barH = Math.max(20, (total / maxTotal) * 60);
                const lpH = total > 0 ? (d.lpAmount / total) * barH : barH * 0.7;
                const gpH = total > 0 ? (d.gpAmount / total) * barH : barH * 0.3;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{fmtPct(d.hurdleRate * 100)}</span>
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: lpH, background: BT.text.cyan, opacity: 0.8 }} />
                      <div style={{ height: gpH, background: BT.text.orange, opacity: 0.8 }} />
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: TIER_COLORS[i % TIER_COLORS.length], fontWeight: 700 }}>{d.tier}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, padding: '4px 12px', justifyContent: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: 8 }}><span style={{ color: BT.text.cyan }}>■</span> LP</span>
              <span style={{ fontFamily: MONO, fontSize: 8 }}><span style={{ color: BT.text.orange }}>■</span> GP</span>
            </div>
          </SectionPanel>
        </>
      )}
    </div>
  );
}

export default WaterfallTab;
