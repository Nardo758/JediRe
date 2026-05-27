import React, { useState } from 'react';
import { BT, Bd, SectionPanel } from '../bloomberg-ui';
import type { GoldenChain, CorrelationAlert, Indicator, StrategyAnalysisV2 } from '../../../hooks/useStrategyAnalysisV2';
import { MONO, sevColor, dirArrow } from './strategy-v2.utils';

const GOLDEN_CHAIN_STEPS = [
  'Discovery', 'Signal Confirm', 'Entry Window', 'Acquisition',
  'Value Creation', 'Stabilization', 'Exit Prep', 'Disposition',
];

export function CorrelationTimingPanel({ goldenChain, correlationAlerts, indicators }: {
  goldenChain: GoldenChain;
  correlationAlerts: CorrelationAlert[];
  indicators: StrategyAnalysisV2['indicators'];
}) {
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  return (
    <SectionPanel title="CORRELATION TIMING" borderColor={BT.text.teal} style={{ marginBottom: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        <div style={{ padding: '8px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.teal, letterSpacing: 0.5, marginBottom: 6 }}>
            GOLDEN CHAIN — {goldenChain?.description || 'Position Unknown'}
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {GOLDEN_CHAIN_STEPS.map((step, i) => {
              const pos = goldenChain?.position ?? 0;
              const isActive = i + 1 === pos;
              const isPast = i + 1 < pos;
              const c = isActive ? BT.text.teal : isPast ? BT.text.green : BT.border.medium;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: isActive ? BT.text.teal : isPast ? BT.text.green : BT.border.medium,
                    boxShadow: isActive ? `0 0 8px ${BT.text.teal}` : 'none',
                  }} />
                  <span style={{ fontFamily: MONO, fontSize: 7, color: c }}>{step.split(' ')[0].toUpperCase()}</span>
                  {i < GOLDEN_CHAIN_STEPS.length - 1 && (
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.border.medium }}>→</span>
                  )}
                </div>
              );
            })}
          </div>
          {(goldenChain?.activeSignals || []).map((s, i) => (
            <div key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, padding: '2px 0' }}>◆ {s}</div>
          ))}
        </div>
        <div style={{ borderLeft: `1px solid ${BT.border.subtle}`, padding: '8px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 6 }}>ACTIVE CORRELATION ALERTS</div>
          {(correlationAlerts || []).map((alert, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 0', borderBottom: `1px solid ${BT.border.subtle}` }}>
              <Bd c={sevColor(alert.severity)}>{alert.correlationId}</Bd>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, flex: 1 }}>{alert.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>→{alert.drivesPlanDimension}</span>
            </div>
          ))}
          {(!correlationAlerts || correlationAlerts.length === 0) && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No active alerts.</span>
          )}
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
        <button
          onClick={() => setIndicatorsOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', background: 'none', border: 'none', cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5 }}>
            {indicatorsOpen ? '▲' : '▼'} INDICATORS
          </span>
        </button>
        {indicatorsOpen && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: `1px solid ${BT.border.subtle}` }}>
            {(['leading', 'concurrent', 'lagging'] as const).map(type => (
              <div key={type} style={{ padding: '6px 10px', borderRight: `1px solid ${BT.border.subtle}` }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 4 }}>
                  {type.toUpperCase()} INDICATORS
                </div>
                {(indicators?.[type] || []).map((ind: Indicator, i: number) => {
                  const arr = dirArrow(ind.direction);
                  return (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 0' }}>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: arr.color }}>{arr.sym}</span>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, flex: 1 }}>{ind.label}</span>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: arr.color, fontWeight: 700 }}>{ind.value}</span>
                    </div>
                  );
                })}
                {(!indicators?.[type] || indicators[type].length === 0) && (
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>—</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionPanel>
  );
}
