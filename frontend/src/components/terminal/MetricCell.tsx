import React from 'react';
import { T } from '../../styles/terminal-tokens';
import { Spark } from './Spark';

interface MetricCellProps {
  label: string;
  value: string;
  delta?: string;
  sparkData?: number[];
  context?: string;
  contextColor?: 'green' | 'amber' | 'red' | 'gray';
  style?: React.CSSProperties;
}

const CONTEXT_COLORS: Record<string, string> = {
  green: T.text.green,
  amber: T.text.amber,
  red:   T.text.red,
  gray:  T.text.secondary,
};

function parseDeltaColor(delta?: string): string {
  if (!delta) return T.text.secondary;
  if (delta.startsWith('+')) return T.text.green;
  if (delta.startsWith('-')) return T.text.red;
  return T.text.secondary;
}

export const MetricCell: React.FC<MetricCellProps> = ({ label, value, delta, sparkData, context, contextColor = 'gray', style }) => {
  const deltaColor = parseDeltaColor(delta);
  return (
    <div style={{
      background: T.bg.panel,
      border: `1px solid ${T.border.subtle}`,
      padding: '8px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 100,
      ...style,
    }}>
      <div style={{ fontSize: T.fontSize.xs, color: T.text.muted, letterSpacing: 1, fontWeight: 600, fontFamily: T.font.mono, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: T.fontSize.xxl, fontWeight: 800, color: T.text.amber, fontFamily: T.font.mono }}>{value}</span>
        {delta && (
          <span style={{ fontSize: T.fontSize.sm, color: deltaColor, fontWeight: 600, fontFamily: T.font.mono }}>{delta}</span>
        )}
      </div>
      {context && (
        <div style={{ fontSize: T.fontSize.xs, color: CONTEXT_COLORS[contextColor] ?? T.text.secondary, fontFamily: T.font.mono }}>
          {context}
        </div>
      )}
      {sparkData && <Spark data={sparkData} color={deltaColor} w={80} h={12} />}
    </div>
  );
};
