import React from 'react';
import { T } from '../../styles/terminal-tokens';

interface Signal {
  label: string;
  score: number;
  weight: number;
  color: string;
}

interface SignalBarProps {
  signals?: Signal[];
  scores?: { demand?: number; supply?: number; momentum?: number; position?: number; risk?: number };
  height?: number;
}

const DEFAULT_SIGNALS: Signal[] = [
  { label: 'Demand',   score: 0, weight: 30, color: T.text.green  },
  { label: 'Supply',   score: 0, weight: 25, color: T.text.cyan   },
  { label: 'Momentum', score: 0, weight: 20, color: T.text.amber  },
  { label: 'Position', score: 0, weight: 15, color: T.text.purple },
  { label: 'Risk',     score: 0, weight: 10, color: T.text.red    },
];

export const SignalBar: React.FC<SignalBarProps> = ({ signals, scores, height = 10 }) => {
  const bars: Signal[] = signals ?? DEFAULT_SIGNALS.map(s => ({
    ...s,
    score: scores?.[s.label.toLowerCase() as keyof typeof scores] ?? 0,
  }));

  const totalWeight = bars.reduce((a, b) => a + b.weight, 0);

  return (
    <div>
      <div style={{ display: 'flex', width: '100%', height, borderRadius: 2, overflow: 'hidden', gap: 1 }}>
        {bars.map(s => (
          <div
            key={s.label}
            title={`${s.label}: ${s.score}`}
            style={{
              flex: s.weight / totalWeight,
              background: `${s.color}${Math.round((s.score / 100) * 255).toString(16).padStart(2, '0')}`,
              minWidth: 2,
              borderRadius: 1,
              position: 'relative',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 1, marginTop: 3 }}>
        {bars.map(s => (
          <div key={s.label} style={{ flex: s.weight / totalWeight, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '7px', fontFamily: T.font.mono, color: s.color, fontWeight: 700 }}>{s.score}</span>
            <span style={{ fontSize: '6px', fontFamily: T.font.mono, color: T.text.muted, letterSpacing: 0.3 }}>{s.label.slice(0,3).toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
