import React from 'react';
import { T } from './tokens';

interface ConfidenceBadgeProps {
  confidence: 'HIGH' | 'MED' | 'LOW';
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const color =
    confidence === 'HIGH' ? T.text.green :
    confidence === 'MED'  ? T.text.amber :
    T.text.red;

  return (
    <span
      title={`Evidence confidence: ${confidence}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 3px',
        fontFamily: T.font.mono,
        fontSize: T.fontSize.badge,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color,
        background: `${color}18`,
        border: `1px solid ${color}44`,
        borderRadius: 2,
        lineHeight: '12px',
        height: 12,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {confidence}
    </span>
  );
}
