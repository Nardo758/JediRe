import React from 'react';
import { T } from '../../styles/terminal-tokens';

interface PanelHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  borderColor?: string;
  style?: React.CSSProperties;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({ title, subtitle, right, borderColor, style }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 10px',
    background: T.bg.header,
    borderBottom: `1px solid ${T.border.subtle}`,
    borderTop: borderColor ? `2px solid ${borderColor}` : 'none',
    flexShrink: 0,
    ...style,
  }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: T.fontSize.md, fontWeight: 700, color: T.text.white, fontFamily: T.font.mono, letterSpacing: 0.8 }}>
        {title}
      </span>
      {subtitle && (
        <span style={{ fontSize: T.fontSize.xs, color: T.text.secondary, fontFamily: T.font.mono }}>
          {subtitle}
        </span>
      )}
    </div>
    {right && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{right}</div>}
  </div>
);
