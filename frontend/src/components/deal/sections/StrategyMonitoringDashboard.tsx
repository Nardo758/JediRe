import React, { useState } from 'react';
import { BT, Bd, SectionPanel } from '../bloomberg-ui';
import type { MonitoringItem } from '../../../hooks/useStrategyAnalysisV2';
import { MONO, sevColor } from './strategy-v2.utils';

function parseNumeric(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function MonitoringDashboard({ monitoring }: { monitoring: MonitoringItem[] }) {
  const [decisionPrompted, setDecisionPrompted] = useState<Record<string, boolean>>({});
  if (!monitoring || monitoring.length === 0) return null;
  return (
    <SectionPanel title="MONITORING DASHBOARD" borderColor={BT.text.orange} style={{ marginBottom: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 1 }}>
        {monitoring.map((item, i) => {
          const sColor = sevColor(item.severity);
          const curNum = parseNumeric(item.currentValue);
          const thrNum = parseNumeric(item.triggerThreshold);
          const hasBar = curNum !== null && thrNum !== null && thrNum > 0;
          const fillPct = hasBar ? Math.min(100, Math.max(0, Math.round((curNum / thrNum) * 100))) : null;
          const breached = hasBar && curNum >= thrNum;
          const promptKey = `${item.correlationId}-${i}`;
          return (
            <div key={i} style={{ padding: '8px 10px', background: BT.bg.panelAlt, border: `1px solid ${sColor}33`, borderLeft: `2px solid ${sColor}` }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <Bd c={sColor}>{item.correlationId}</Bd>
                <Bd c={sColor}>{(item.severity ?? '').toUpperCase()}</Bd>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.metric}</span>
              </div>
              {hasBar && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ height: 5, background: `${sColor}22`, borderRadius: 2, overflow: 'hidden', marginBottom: 2 }}>
                    <div style={{
                      height: '100%', width: `${fillPct}%`, borderRadius: 2,
                      background: breached ? BT.text.red : sColor,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: MONO, fontSize: 7, color: breached ? BT.text.red : BT.text.primary }}>
                      {breached ? '⚠ BREACHED' : `${fillPct}% to trigger`}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>{item.currentValue} / {item.triggerThreshold}</span>
                  </div>
                </div>
              )}
              {!hasBar && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>NOW: <span style={{ color: BT.text.primary }}>{item.currentValue}</span></div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>TRIGGER: <span style={{ color: sColor }}>{item.triggerThreshold}</span></div>
                </div>
              )}
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, fontStyle: 'italic', marginBottom: item.severity === 'critical' ? 6 : 0 }}>{item.action}</div>
              {item.severity === 'critical' && (
                <div style={{ marginTop: 4 }}>
                  {decisionPrompted[promptKey] ? (
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, background: `${BT.text.amber}18`, padding: '4px 8px', border: `1px solid ${BT.text.amber}44` }}>
                      ⚡ DECISION REQUIRED — review plan document and update exit/pivot conditions
                    </div>
                  ) : (
                    <button
                      onClick={() => setDecisionPrompted(p => ({ ...p, [promptKey]: true }))}
                      style={{
                        fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#ffffff',
                        background: BT.text.red, border: 'none', padding: '3px 10px', cursor: 'pointer', width: '100%',
                      }}
                    >
                      ⚡ CRITICAL THRESHOLD — DECIDE NOW
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionPanel>
  );
}
