import React from 'react';
import { TerminalTheme as T } from './theme';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  border?: string;
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  color = T.text.amber, 
  bg, 
  border 
}) => (
  <span style={{
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 6px",
    fontSize: 8,
    fontFamily: T.font.mono,
    fontWeight: 700,
    letterSpacing: "0.05em",
    color,
    background: bg || `${color}15`,
    border: `1px solid ${border || `${color}40`}`,
    borderRadius: 2,
    lineHeight: "14px",
    whiteSpace: "nowrap",
  }}>
    {children}
  </span>
);
