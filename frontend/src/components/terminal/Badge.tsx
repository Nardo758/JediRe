import React from 'react';
import { T } from '../../styles/terminal-tokens';

interface BadgeProps {
  label: string;
  color?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({ label, color = T.text.amber, style }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: T.fontSize.xs,
    fontFamily: T.font.mono,
    fontWeight: 700,
    letterSpacing: 0.8,
    padding: '2px 6px',
    border: `1px solid ${color}`,
    borderRadius: 3,
    background: `${color}30`,
    color,
    whiteSpace: 'nowrap',
    ...style,
  }}>
    {label}
  </span>
);
