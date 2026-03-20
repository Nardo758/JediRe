import React from 'react';

export const T = {
  cyan: '#00b4d8',
  cyanL: '#48cae4',
  cyanBg: 'rgba(0,180,216,0.10)',

  green: '#38b000',
  greenL: '#70e000',
  greenBg: 'rgba(56,176,0,0.10)',

  amber: '#f4a261',
  amberL: '#f7b731',
  amberBg: 'rgba(244,162,97,0.10)',

  red: '#e63946',
  redL: '#ff6b6b',
  redBg: 'rgba(230,57,70,0.10)',

  orange: '#fb5607',
  orangeL: '#ff7b00',
  orangeBg: 'rgba(251,86,7,0.10)',

  violet: '#9d4edd',
  violL: '#c77dff',
  violBg: 'rgba(157,78,221,0.10)',

  blue: '#4361ee',
  blueL: '#4cc9f0',
  blueBg: 'rgba(67,97,238,0.10)',

  bg: {
    terminal: '#050810',
    panel: '#0d1326',
    cell: '#111827',
    topBar: '#080e1f',
    hover: 'rgba(255,255,255,0.05)',
    panelAlt: '#0a1020',
  },

  bgCard: '#0d1326',
  bgPanel: '#111827',

  text: {
    white: '#e8eaf0',
    amber: '#f7b731',
    red: '#ff6b6b',
    purple: '#c77dff',
    cyan: '#48cae4',
    green: '#70e000',
    dim: '#4a5568',
    primary: '#e8eaf0',
    secondary: '#8892a4',
    muted: '#4a5568',
  },

  ts: '#8892a4',
  td: '#4a5568',
  tm: '#6b7280',

  border: '#1e2a45',
  borderX: '#263555',
  borderSubtle: '#111827',
  borderMedium: '#1e2a45',
  borderStrong: '#263555',

  gradient: {
    tealCyan: 'linear-gradient(135deg, #00b4d8 0%, #48cae4 100%)',
    greenCyan: 'linear-gradient(135deg, #38b000 0%, #00b4d8 100%)',
    violetCyan: 'linear-gradient(135deg, #9d4edd 0%, #48cae4 100%)',
  },

  met: {
    financial: '#f7b731',
    occupancy: '#70e000',
    economic: '#48cae4',
    digTraffic: '#c77dff',
    supply: '#fb5607',
    risk: '#ff6b6b',
  },

  font: {
    mono: "'Courier New', 'Courier', monospace",
    sans: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  },

  fontSize: {
    xs: '10px',
    sm: '11px',
    md: '12px',
    lg: '14px',
    xl: '16px',
  },
};

export const mono: React.CSSProperties = {
  fontFamily: "'Courier New', 'Courier', monospace",
};

export const sans: React.CSSProperties = {
  fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
};

const pageStyle: React.CSSProperties = {
  background: T.bg.terminal,
  minHeight: '100%',
  color: T.text.white,
  padding: '16px',
  boxSizing: 'border-box',
};

const cardStyle: React.CSSProperties = {
  background: T.bgCard,
  border: `1px solid ${T.border}`,
  borderRadius: 4,
  marginBottom: 12,
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 24,
};

const badgeBase: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 3,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: 'uppercase',
  ...mono,
};

export const BloombergPage: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style }) =>
  React.createElement('div', { style: { ...pageStyle, ...style } }, children);

export const BCard: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style }) =>
  React.createElement('div', { style: { ...cardStyle, ...style } }, children);

export const BSection: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style }) =>
  React.createElement('div', { style: { ...sectionStyle, ...style } }, children);

export const BBadge: React.FC<{ label: string; color?: string; bg?: string; style?: React.CSSProperties }> = ({
  label,
  color = T.text.white,
  bg = T.bgPanel,
  style,
}) =>
  React.createElement('span', { style: { ...badgeBase, color, background: bg, border: `1px solid ${T.border}`, ...style } }, label);

export const BLiveBadge: React.FC<{ live?: boolean }> = ({ live }) =>
  React.createElement('span', {
    style: {
      ...badgeBase,
      color: live ? T.greenL : T.td,
      background: live ? T.greenBg : 'transparent',
      border: `1px solid ${live ? T.green : T.border}`,
    },
  }, live ? '● LIVE' : '○ CACHED');

export const BSparkline: React.FC<{ values?: number[]; color?: string; height?: number }> = ({
  values = [],
  color = T.cyanL,
  height = 32,
}) => {
  if (values.length < 2) return React.createElement('div', { style: { height, background: T.bgPanel, borderRadius: 2 } });
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 120;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return React.createElement('svg', { width: w, height, style: { display: 'block' } },
    React.createElement('polyline', { points: pts, fill: 'none', stroke: color, strokeWidth: 1.5 })
  );
};

export const BMiniBar: React.FC<{ value: number; max?: number; color?: string; height?: number }> = ({
  value,
  max = 100,
  color = T.cyanL,
  height = 6,
}) =>
  React.createElement('div', { style: { background: T.border, borderRadius: 3, height, overflow: 'hidden' } },
    React.createElement('div', { style: { background: color, height: '100%', width: `${Math.min(100, (value / max) * 100)}%`, borderRadius: 3, transition: 'width 0.3s' } })
  );

export const UnderwritingComparison: React.FC<{
  rows: Array<{ label: string; broker?: string | null; platform?: string | null; user?: string | null }>;
}> = ({ rows }) =>
  React.createElement('div', { style: { background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 4, overflow: 'hidden', marginBottom: 12 } },
    React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        background: T.bgPanel,
        borderBottom: `1px solid ${T.border}`,
        padding: '6px 12px',
      },
    },
      ['Metric', 'Broker', 'Platform', 'User'].map(h =>
        React.createElement('div', { key: h, style: { fontSize: 9, fontWeight: 700, color: T.td, letterSpacing: 1.5, textTransform: 'uppercase', ...mono } }, h)
      )
    ),
    ...rows.map((r, i) =>
      React.createElement('div', {
        key: i,
        style: {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          padding: '8px 12px',
          borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : 'none',
        },
      },
        React.createElement('div', { style: { fontSize: 11, color: T.ts, ...mono } }, r.label),
        React.createElement('div', { style: { fontSize: 11, color: T.amber, ...mono } }, r.broker || '—'),
        React.createElement('div', { style: { fontSize: 11, color: T.cyanL, ...mono } }, r.platform || '—'),
        React.createElement('div', { style: { fontSize: 11, color: T.greenL, ...mono } }, r.user || '—')
      )
    )
  );
