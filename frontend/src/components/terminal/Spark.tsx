import React from 'react';
import { T } from '../../styles/terminal-tokens';

interface SparkProps {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
}

export const Spark: React.FC<SparkProps> = ({ data, color = T.text.amber, w = 60, h = 16 }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};
