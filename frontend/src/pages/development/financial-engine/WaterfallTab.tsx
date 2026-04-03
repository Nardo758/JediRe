import React from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, DataRow, Bd, KpiTile } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps, WaterfallDistribution, WaterfallHurdle } from './types';
import { fmt$, fmtPct, fmtX } from './types';

const MONO = BT.font.mono;

const TIER_COLORS = [BT.text.cyan, BT.text.amber, BT.text.orange, BT.text.red, BT.text.purple];

export function WaterfallTab({ dealId, assumptions, modelResults }: FinancialEngineTabProps) {
  const wf = assumptions?.waterfall;
  const distributions = modelResults?.waterfallDistributions ?? [];
  const summary = modelResults?.summary;

  const totalLP = distributions.reduce((s, d) => s + d.lpAmount, 0);
  const totalGP = distributions.reduce((s, d) => s + d.gpAmount, 0);
  const totalDist = totalLP + totalGP;

  const equityContribution = wf?.equityContribution ?? 0;
  const lpEquity = equityContribution * (wf?.lpShare ?? 0.9);
  const gpEquity = equityContribution * (wf?.gpShare ?? 0.1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>LP / GP EQUITY DISTRIBUTION</span>
        <Bd c={BT.text.purple}>WATERFALL</Bd>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: BT.border.subtle, padding: 1 }}>
        <KpiTile label="TOTAL DISTRIBUTIONS" value={totalDist > 0 ? fmt$(totalDist) : '—'} color={BT.text.white} />
        <KpiTile label="LP DISTRIBUTIONS" value={totalLP > 0 ? fmt$(totalLP) : '—'} color={BT.text.cyan} />
        <KpiTile label="GP DISTRIBUTIONS" value={totalGP > 0 ? fmt$(totalGP) : '—'} color={BT.text.orange} />
        <KpiTile label="GP PROMOTE" value={summary?.gpPromoteEarned != null ? fmt$(summary.gpPromoteEarned) : '—'} color={BT.text.amber} />
      </div>

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
            <div style={{ flex: 1 }} />
            <div style={{ flex: 1 }} />
            <div style={{ flex: 1 }} />
            <div style={{ flex: 1 }} />
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

      <SectionPanel title="WATERFALL VISUALIZATION" subtitle="Distribution flow" borderColor={BT.text.purple}>
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
    </div>
  );
}

export default WaterfallTab;
