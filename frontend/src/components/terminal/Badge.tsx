import React from 'react';

interface BadgeProps {
  label: string;
  color?: string;
  bg?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({ label, color = '#8892a4', bg = 'transparent', style }) => (
  <span style={{
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: 'monospace',
    color,
    background: bg,
    borderRadius: 3,
    border: `1px solid ${color}44`,
    ...style,
  }}>
    {label}
  </span>
);

export default Badge;
