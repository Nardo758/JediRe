import React from 'react';
import { BT, Bd, SectionPanel, DataRow } from '../bloomberg-ui';
import type { SubStrategyScore, StrategyAnalysisV2 } from '../../../hooks/useStrategyAnalysisV2';
import { MONO, fmtSafe, fmtScore, gateColor, gateLabel, SS_COLORS, ScoreRing } from './strategy-v2.utils';

export function SubStrategyComparison({ subStrategies, arbitrage }: {
  subStrategies: SubStrategyScore[];
  arbitrage: StrategyAnalysisV2['arbitrage'];
}) {
  if (!subStrategies || subStrategies.length === 0) return null;

  return (
    <SectionPanel title="SUB-STRATEGY COMPARISON" borderColor={BT.text.amber} style={{ marginBottom: 1 }}>
      {arbitrage?.detected && (
        <div style={{
          padding: '5px 10px', background: `${BT.text.amber}10`,
          borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.amber}`,
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <Bd c={BT.text.amber}>⚡ ARBITRAGE DETECTED</Bd>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>{arbitrage.narrative}</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>
            Δ {fmtSafe(arbitrage.deltaPoints, 1)} pts
          </span>
        </div>
      )}
      <div style={{ display: 'flex', overflowX: 'auto' }}>
        {subStrategies.map((ss, idx) => {
          const color = SS_COLORS[idx % SS_COLORS.length];
          const isPrimary = ss.isDetectedPrimary;
          const fp = ss.financialPreview;
          return (
            <div key={ss.key} style={{
              flex: '0 0 180px', minWidth: 160,
              borderTop: isPrimary ? `2px solid ${BT.text.amber}` : `1px solid ${BT.border.subtle}`,
              background: isPrimary ? `${BT.text.amber}06` : BT.bg.panel,
              borderRight: `1px solid ${BT.border.subtle}`,
            }}>
              <div style={{
                padding: '5px 8px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(ss.name || ss.key).replace(/_/g, ' ').toUpperCase()}
                </span>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  {isPrimary && <Bd c={BT.text.amber}>⚡</Bd>}
                  <Bd c={gateColor(ss)}>{gateLabel(ss)}</Bd>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 8px 4px' }}>
                <ScoreRing score={ss.finalScore} color={color} size={56} />
              </div>
              <DataRow label="IRR" value={fp ? `${fmtSafe(fp.irr, 1)}%` : '—'} valueColor={BT.met.financial} />
              <DataRow label="CoC" value={fp ? `${fmtSafe(fp.cocReturn, 1)}%` : '—'} valueColor={BT.text.cyan} />
              <DataRow label="EM" value={fp ? `${fmtSafe(fp.equityMultiple, 2)}x` : '—'} valueColor={BT.text.amber} />
              <DataRow label="EXIT CAP" value={fp ? `${fmtSafe(Number(fp.exitCapRate) * 100, 2)}%` : '—'} valueColor={BT.text.secondary} />
              <DataRow label="HOLD" value={fp ? `${fmtSafe(fp.holdMonths, 0)}mo` : '—'} valueColor={BT.text.purple} />
              <div style={{ padding: '4px 8px', borderTop: `1px solid ${BT.border.subtle}` }}>
                <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
                  BASE {fmtScore(ss.baseScore)} × {fmtSafe(ss.timingMultiplier, 2)} + ADJ {fmtScore(ss.gateAdjustment)}
                </span>
              </div>
              {ss.gate?.reasons?.length > 0 && (
                <div style={{ padding: '3px 8px', borderTop: `1px solid ${BT.border.subtle}` }}>
                  {ss.gate.reasons.slice(0, 2).map((r, ri) => (
                    <div key={ri} style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, fontStyle: 'italic' }}>
                      {r}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionPanel>
  );
}
