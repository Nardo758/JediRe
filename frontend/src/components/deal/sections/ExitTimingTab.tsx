import { useState } from 'react';
import {
  ConvergenceChart, RSSBreakdownCards,
  Q_LABELS, RSS_21Y, OPTIMAL_FWD, NOW_IDX as CONV_NOW_IDX,
} from './ConvergenceChart';

const T2 = {
  mono: '"JetBrains Mono",monospace',
  panel: '#0F1319',
  border: 'rgba(255,255,255,0.06)',
  dim: 'rgba(232,230,225,0.35)',
  muted: 'rgba(232,230,225,0.18)',
};

const ExitTimingTab: React.FC<{ dealId: string }> = () => {
  const [selectedFwd, setSelectedFwd] = useState(OPTIMAL_FWD);
  const selAbsIdx = CONV_NOW_IDX + selectedFwd;
  const selRSS = RSS_21Y[selAbsIdx];
  const selLabel = Q_LABELS[selAbsIdx]?.label ?? '';
  const rssColor = (v: number) => v >= 70 ? '#68D391' : v >= 50 ? '#F6E05E' : '#FC8181';
  const fwdYears = (selectedFwd / 4).toFixed(1);

  return (
    <div style={{ padding: 16, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: T2.mono, color: '#E8E6E1', letterSpacing: 1 }}>21-YEAR CONVERGENCE CHART</div>
          <div style={{ fontSize: 9, color: T2.muted, fontFamily: T2.mono, marginTop: 2 }}>Rent growth · Cap rate · RSS · Supply — Q1 2016 → Q4 2036</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: T2.muted, fontFamily: T2.mono }}>SELECTED EXIT</div>
            <div style={{ fontSize: 13, fontWeight: 800, fontFamily: T2.mono, color: '#63B3ED' }}>{selLabel}</div>
            <div style={{ fontSize: 9, color: T2.dim, fontFamily: T2.mono }}>{fwdYears}yr from now</div>
          </div>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            border: `3px solid ${rssColor(selRSS?.rss ?? 0)}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(11,14,19,0.8)',
          }}>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: T2.mono, color: rssColor(selRSS?.rss ?? 0) }}>{selRSS?.rss ?? '--'}</div>
            <div style={{ fontSize: 7, color: T2.muted, fontFamily: T2.mono }}>RSS</div>
          </div>
        </div>
      </div>
      {selRSS && <RSSBreakdownCards rssData={selRSS} />}
      <div style={{ background: T2.panel, border: `1px solid ${T2.border}`, borderRadius: 6, padding: 12 }}>
        <ConvergenceChart selectedFwd={selectedFwd} onSelectFwd={setSelectedFwd} optimalFwd={OPTIMAL_FWD} />
      </div>
      <div style={{ marginTop: 8, fontSize: 9, color: T2.muted, fontFamily: T2.mono, textAlign: 'center' }}>
        Click any projected quarter to inspect exit conditions · RSS = Readiness to Sell Score (market-driven, 0–100)
      </div>
    </div>
  );
};

export default ExitTimingTab;
export { ExitTimingTab };
