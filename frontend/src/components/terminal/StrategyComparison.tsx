import React from 'react';
import { T } from '../../styles/terminal-tokens';
import { Badge } from './Badge';

interface StrategyColumn {
  label: string;
  code: string;
  score: number;
  irr?: string;
  yoc?: string;
  timeline?: string;
  signals?: { label: string; value: number; color: string }[];
  winner?: boolean;
  arbitrage?: string;
}

interface StrategyComparisonProps {
  strategies?: StrategyColumn[];
  style?: React.CSSProperties;
}

const DEFAULT_STRATEGIES: StrategyColumn[] = [
  { label: 'Build to Sell', code: 'BTS', score: 0, irr: '—', yoc: '—', timeline: '—' },
  { label: 'Flip',          code: 'FLIP', score: 0, irr: '—', yoc: '—', timeline: '—' },
  { label: 'Rental',        code: 'RNTAL', score: 0, irr: '—', yoc: '—', timeline: '—' },
  { label: 'STR',           code: 'STR', score: 0, irr: '—', yoc: '—', timeline: '—' },
];

const STRATEGY_COLORS: Record<string, string> = {
  BTS:   T.text.cyan,
  FLIP:  T.text.orange,
  RNTAL: T.text.green,
  STR:   T.text.purple,
};

export const StrategyComparison: React.FC<StrategyComparisonProps> = ({ strategies = DEFAULT_STRATEGIES, style }) => {
  const best = strategies.reduce((a, b) => a.score > b.score ? a : b, strategies[0]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${strategies.length}, 1fr)`, gap: 1, background: T.border.subtle, ...style }}>
      {strategies.map(strat => {
        const color = STRATEGY_COLORS[strat.code] ?? T.text.amber;
        const isWinner = strat === best && strat.score > 0;
        return (
          <div key={strat.code} style={{
            background: T.bg.panel,
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            borderTop: `2px solid ${isWinner ? color : T.border.subtle}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Badge label={strat.code} color={color} />
              {isWinner && <Badge label="WINNER" color={T.text.green} />}
            </div>
            <div style={{ fontSize: T.fontSize.xxl, fontWeight: 800, fontFamily: T.font.mono, color }}>
              {strat.score || '—'}
            </div>
            <div style={{ fontSize: T.fontSize.xs, fontFamily: T.font.mono, color: T.text.secondary, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {strat.label}
            </div>
            <div style={{ borderTop: `1px solid ${T.border.subtle}`, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[['IRR', strat.irr], ['YoC', strat.yoc], ['Timeline', strat.timeline]].map(([k, v]) => (
                <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: T.fontSize.xs, color: T.text.muted, fontFamily: T.font.mono }}>{k}</span>
                  <span style={{ fontSize: T.fontSize.xs, color: T.text.primary, fontFamily: T.font.mono, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            {strat.arbitrage && (
              <div style={{ fontSize: T.fontSize.xs, color: T.text.amber, fontFamily: T.font.mono, fontStyle: 'italic' }}>
                ⚡ {strat.arbitrage}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
