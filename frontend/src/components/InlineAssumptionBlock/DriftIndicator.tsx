import React from 'react';
import { T } from './tokens';

interface DriftIndicatorProps {
  direction: 'up' | 'down' | 'neutral';
  sigma?: number;
}

export function DriftIndicator({ direction, sigma }: DriftIndicatorProps) {
  if (direction === 'neutral') {
    return (
      <span
        title={sigma != null ? `Drift: ${sigma.toFixed(2)}σ (within ±0.5σ — neutral)` : 'Neutral drift'}
        style={{ color: T.text.muted, fontSize: T.fontSize.badge, fontFamily: T.font.mono }}
      >
        –
      </span>
    );
  }
  const isUp = direction === 'up';
  return (
    <span
      title={
        sigma != null
          ? `Drift: ${sigma.toFixed(2)}σ (${isUp ? 'above' : 'below'} peer set)`
          : `Subject is ${isUp ? 'above' : 'below'} peer set`
      }
      style={{
        color: isUp ? T.accent.positive : T.accent.negative,
        fontSize: T.fontSize.badge,
        fontFamily: T.font.mono,
        fontWeight: 700,
      }}
    >
      {isUp ? '▲' : '▼'}
    </span>
  );
}
