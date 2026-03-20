import React from 'react';
import { T } from '../../styles/terminal-tokens';

interface SectionLabelProps {
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}

export const SectionLabel: React.FC<SectionLabelProps> = ({ children, color = T.text.muted, style }) => (
  <div style={{
    fontSize: T.fontSize.md,
    fontFamily: T.font.mono,
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color,
    ...style,
  }}>
    {children}
  </div>
);
