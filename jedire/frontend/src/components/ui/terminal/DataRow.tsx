import React from 'react';
import { TerminalTheme as T } from './theme';

interface DataRowProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  mono?: boolean;
}

export const DataRow: React.FC<DataRowProps> = ({ 
  label, 
  value, 
  sub, 
  color, 
  mono = true 
}) => (
  <div style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 10px",
    borderBottom: `1px solid ${T.border.subtle}08`,
  }}>
    <span style={{ 
      fontSize: 9, 
      fontFamily: T.font.label, 
      color: T.text.secondary 
    }}>
      {label}
    </span>
    <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
      <span style={{ 
        fontSize: 10, 
        fontFamily: mono ? T.font.mono : T.font.label, 
        fontWeight: 600, 
        color: color || T.text.primary 
      }}>
        {value}
      </span>
      {sub && (
        <span style={{ 
          fontSize: 8, 
          fontFamily: T.font.mono, 
          color: T.text.muted 
        }}>
          {sub}
        </span>
      )}
    </div>
  </div>
);
