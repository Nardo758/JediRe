import React from 'react';
import { TerminalTheme as T } from './theme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  borderColor?: string;
  action?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ 
  title, 
  subtitle, 
  icon, 
  borderColor = T.text.amber, 
  action 
}) => (
  <div style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 10px",
    background: T.bg.header,
    borderBottom: `1px solid ${T.border.subtle}`,
    borderLeft: `2px solid ${borderColor}`,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {icon && <span style={{ fontSize: 10, color: borderColor }}>{icon}</span>}
      <span style={{ 
        fontSize: 10, 
        fontFamily: T.font.mono, 
        fontWeight: 700, 
        color: T.text.white, 
        letterSpacing: "0.05em" 
      }}>
        {title}
      </span>
      {subtitle && (
        <span style={{ 
          fontSize: 8, 
          fontFamily: T.font.mono, 
          color: T.text.muted 
        }}>
          {subtitle}
        </span>
      )}
    </div>
    {action && action}
  </div>
);
