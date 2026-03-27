import React from 'react';
import { BT } from '../theme';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface StrategyScoreBadgeProps {
  score: number;
  label?: string;
  delta?: number;
  size?: 'sm' | 'md' | 'lg';
}

function scoreColor(score: number): string {
  if (score >= 75) return BT.text.green;
  if (score >= 55) return BT.text.amber;
  return BT.text.red;
}

export const StrategyScoreBadge: React.FC<StrategyScoreBadgeProps> = ({
  score, label, delta, size = 'md',
}) => {
  const color = scoreColor(score);
  const fontSize = size === 'lg' ? 24 : size === 'md' ? 16 : 12;
  const subSize = size === 'lg' ? 11 : size === 'md' ? 9 : 8;

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize, fontWeight: 800, color, ...mono }}>{Math.round(score)}</span>
      <span style={{ fontSize: subSize, color: BT.text.muted, ...mono }}>/100</span>
      {delta !== undefined && delta !== 0 && (
        <span style={{
          marginLeft: 2,
          padding: '1px 4px',
          background: `${color}18`,
          border: `1px solid ${color}33`,
          borderRadius: 2,
          fontSize: size === 'lg' ? 9 : 8,
          fontWeight: 700,
          color,
          ...mono,
        }}>
          {delta > 0 ? '+' : ''}{delta.toFixed(0)}
        </span>
      )}
      {label && (
        <span style={{ fontSize: subSize, color: BT.text.muted, ...mono, marginLeft: 4 }}>
          {label}
        </span>
      )}
    </div>
  );
};
