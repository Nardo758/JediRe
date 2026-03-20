import React from 'react';
import { T, mono } from './bloomberg-tokens';

export { T as BT } from './bloomberg-tokens';

export const BT_CSS = `
  @keyframes bt-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
  @keyframes bt-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: ${T.bg.terminal}; }
  ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: ${T.borderX}; }
`;

export const PanelHeader: React.FC<{
  title: string;
  subtitle?: string;
  accent?: string;
  right?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ title, subtitle, accent = T.cyanL, right, style }) =>
  React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px',
      borderBottom: `2px solid ${accent}`,
      background: T.bgPanel,
      ...style,
    },
  },
    React.createElement('div', null,
      React.createElement('div', {
        style: { fontSize: 11, fontWeight: 700, color: accent, letterSpacing: 2, textTransform: 'uppercase', ...mono },
      }, title),
      subtitle && React.createElement('div', { style: { fontSize: 10, color: T.td, marginTop: 2, ...mono } }, subtitle)
    ),
    right && React.createElement('div', { style: { fontSize: 10, color: T.ts } }, right)
  );
