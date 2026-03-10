import React from 'react';
import { TerminalTheme as T } from './theme';

interface MiniBarProps {
  value: number;
  max: number;
  color?: string;
  width?: number;
}

export const MiniBar: React.FC<MiniBarProps> = ({ 
  value, 
  max, 
  color = T.text.cyan, 
  width = 60 
}) => (
  <div style={{ 
    width, 
    height: 6, 
    background: `${color}15`, 
    borderRadius: 1 
  }}>
    <div style={{ 
      width: `${(value / max) * 100}%`, 
      height: "100%", 
      background: color, 
      borderRadius: 1,
      transition: "width 0.3s ease",
    }} />
  </div>
);
