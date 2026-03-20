/**
 * Bloomberg Terminal Design Tokens
 * Shared across all Deal Capsule F-key module screens
 */

import React from 'react';

// ─── Core palette ─────────────────────────────────────────────────────────────
export const T = {
  bg:      '#0A0E17',
  bgBase:  '#0A0E17',
  bgCard:  '#0F1319',
  bgPanel: '#131920',
  bgHover: '#1a2233',
  bgMid:   '#161d2e',
  border:  '#1e2a3d',
  borderL: '#253347',
  borderX: '#2d3d52',
  text:    '#E8E6E1',
  tm:      '#9EA8B4',
  ts:      '#B8C0CC',
  td:      '#6B7585',
  // Amber / gold (primary action / key metrics)
  amber:   '#F59E0B',
  amberBg: '#1a1200',
  amberL:  '#FCD34D',
  amberD:  '#B45309',
  // Green (positive values, growth)
  green:   '#10B981',
  greenBg: '#022c22',
  greenL:  '#34D399',
  greenD:  '#059669',
  // Red (risk, negative)
  red:     '#EF4444',
  redBg:   '#1c0a0a',
  redL:    '#F87171',
  redD:    '#DC2626',
  // Blue (platform / neutral info)
  blue:    '#3B82F6',
  blueBg:  '#0d1e3d',
  blueL:   '#60A5FA',
  blueD:   '#2563EB',
  // Violet (user edits)
  violet:  '#8B5CF6',
  violBg:  '#1a0d3d',
  violL:   '#A78BFA',
  // Cyan (market / secondary)
  cyan:    '#06B6D4',
  cyanBg:  '#0a2030',
  cyanL:   '#22D3EE',
  // Orange (warning)
  orange:  '#F97316',
  orangeBg:'#1a0d00',
  orangeL: '#FB923C',
};

// ─── Typography ───────────────────────────────────────────────────────────────
export const mono: React.CSSProperties = {
  fontFamily: "'JetBrains Mono','Fira Code','IBM Plex Mono','SF Mono',monospace",
};
export const sans: React.CSSProperties = {
  fontFamily: "'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
};

// ─── Layout wrapper ───────────────────────────────────────────────────────────
export const bloombergPage: React.CSSProperties = {
  background: T.bg,
  minHeight: '100%',
  padding: 24,
  ...sans,
};

// ─── Reusable formatters ──────────────────────────────────────────────────────
export const fmt = (n: number | null | undefined, pre = '$'): string => {
  if (n == null || isNaN(n as number)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return `${pre}${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${pre}${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${pre}${Math.round(n / 1e3)}K`;
  return `${pre}${n.toLocaleString()}`;
};
export const pct = (n: number | null | undefined, decimals = 1): string =>
  n != null && !isNaN(n as number) ? `${(n * 100).toFixed(decimals)}%` : '—';
export const pctRaw = (n: number | null | undefined, decimals = 1): string =>
  n != null && !isNaN(n as number) ? `${n.toFixed(decimals)}%` : '—';
export const num = (n: number | null | undefined): string =>
  n != null ? n.toLocaleString() : '—';
export const mult = (n: number | null | undefined): string =>
  n != null ? `${n.toFixed(2)}x` : '—';

// ─── Sub-components ───────────────────────────────────────────────────────────

export function BloombergPage({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ ...bloombergPage, ...s }}>
      {children}
    </div>
  );
}

export function BCard({ children, style: s, accent }: { children: React.ReactNode; style?: React.CSSProperties; accent?: string }) {
  return (
    <div style={{
      background: T.bgCard,
      borderRadius: 8,
      border: `1px solid ${T.border}`,
      ...(accent ? { borderLeft: `3px solid ${accent}` } : {}),
      padding: 16,
      ...s,
    }}>
      {children}
    </div>
  );
}

export function BSection({ n, title, subtitle, color, right }: {
  n?: string; title: string; subtitle?: string; color?: string; right?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 2 }}>
          {n && <span style={{ fontSize: 10, fontWeight: 700, color: color || T.amberL, letterSpacing: 2, ...mono }}>§{n}</span>}
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text, ...sans }}>{title}</span>
        </div>
        {subtitle && <p style={{ fontSize: 11, color: T.td, marginLeft: n ? 28 : 0, ...sans }}>{subtitle}</p>}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

export function BMetric({ label, value, sub, color, small, mono: isM }: {
  label: string; value: string; sub?: string; color?: string; small?: boolean; mono?: boolean;
}) {
  return (
    <div style={{ padding: small ? '8px 0' : '10px 0' }}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, color: T.td, marginBottom: 3, textTransform: 'uppercase', ...mono }}>{label}</div>
      <div style={{ fontSize: small ? 15 : 20, fontWeight: 700, color: color || T.text, ...(isM ? mono : sans) }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.td, marginTop: 2, ...sans }}>{sub}</div>}
    </div>
  );
}

export function BDataRow({ label, value, bold, color, indent }: {
  label: string; value: string; bold?: boolean; color?: string; indent?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '6px 0', borderBottom: `1px solid ${T.border}`,
    }}>
      <span style={{ fontSize: 12, color: bold ? T.text : T.tm, fontWeight: bold ? 600 : 400, paddingLeft: indent ? 12 : 0, ...sans }}>{label}</span>
      <span style={{ fontSize: 12, color: color || (bold ? T.amberL : T.text), fontWeight: bold ? 700 : 500, ...mono }}>{value}</span>
    </div>
  );
}

export function BBadge({ label, color, bg, size }: { label: string; color: string; bg: string; size?: 'sm' | 'xs' }) {
  return (
    <span style={{
      fontSize: size === 'xs' ? 8 : 9, fontWeight: 700, letterSpacing: 1.5,
      padding: size === 'xs' ? '2px 7px' : '3px 10px',
      borderRadius: 4, background: bg, color,
      border: `1px solid ${color}40`,
      display: 'inline-flex', alignItems: 'center',
      ...mono,
    }}>
      {label}
    </span>
  );
}

export function BDivider() {
  return <div style={{ height: 1, background: T.border, margin: '16px 0' }} />;
}

export function BLiveBadge({ live }: { live: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
      padding: '3px 10px', borderRadius: 12,
      background: live ? T.greenBg : T.amberBg,
      color: live ? T.greenL : T.amberL,
      border: `1px solid ${live ? T.green : T.amber}40`,
      ...mono,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: live ? T.green : T.amber, display: 'inline-block' }} />
      {live ? 'LIVE' : 'SAMPLE'}
    </span>
  );
}

/** Underwriting comparison panel — Broker vs Platform vs User */
export function UnderwritingComparison({
  rows,
}: {
  rows: Array<{
    label: string;
    broker: string | null;
    platform: string | null;
    user: string | null;
    highlight?: 'broker' | 'platform' | 'user';
  }>;
}) {
  const colW = ['40%', '20%', '20%', '20%'];
  const cols = ['METRIC', 'BROKER', 'PLATFORM', 'USER'];
  const colColors = [T.td, T.amber, T.blue, T.violet];

  return (
    <div style={{ background: T.bgPanel, borderRadius: 8, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: colW.join(' '), background: T.bgMid, padding: '8px 14px', borderBottom: `1px solid ${T.border}` }}>
        {cols.map((c, i) => (
          <div key={c} style={{ fontSize: 9, fontWeight: 700, color: colColors[i], letterSpacing: 1.5, textTransform: 'uppercase', ...mono }}>{c}</div>
        ))}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: colW.join(' '),
          padding: '7px 14px', borderBottom: `1px solid ${T.border}`,
          background: i % 2 === 0 ? 'transparent' : `${T.bgPanel}90`,
        }}>
          <div style={{ fontSize: 12, color: T.tm, ...sans }}>{r.label}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: r.broker ? T.amber : T.td, ...mono }}>{r.broker || '—'}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: r.platform ? T.blue : T.td, ...mono }}>{r.platform || '—'}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: r.user ? T.violet : T.td, ...mono }}>{r.user || '—'}</div>
        </div>
      ))}
    </div>
  );
}

/** Simple sparkline SVG bar chart */
export function BSparkline({ data, color = '#F59E0B', h = 28, w = 80 }: {
  data: number[]; color?: string; h?: number; w?: number;
}) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const bw = Math.max(2, Math.floor(w / data.length) - 1);
  return (
    <svg width={w} height={h} style={{ flexShrink: 0 }}>
      {data.map((v, i) => {
        const bh = Math.max(2, ((v - min) / range) * (h - 3));
        const isLast = i === data.length - 1;
        return (
          <rect key={i} x={i * (bw + 1)} y={h - bh} width={bw} height={bh} rx={1}
            fill={isLast ? color : `${color}50`} />
        );
      })}
    </svg>
  );
}

/** Mini progress bar */
export function BMiniBar({ value, max = 100, color = '#F59E0B', h = 4 }: {
  value: number; max?: number; color?: string; h?: number;
}) {
  const pctVal = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ height: h, background: T.border, borderRadius: h / 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pctVal}%`, background: color, borderRadius: h / 2, transition: 'width 0.5s ease' }} />
    </div>
  );
}

/** Module tab bar */
export function BTabBar({ tabs, active, onChange }: {
  tabs: Array<{ id: string; label: string }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${T.border}`, paddingBottom: 0 }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: '8px 14px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: isActive ? T.amberL : T.td,
              borderBottom: isActive ? `2px solid ${T.amber}` : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s',
              ...mono,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** F-key indicator badge */
export function FKeyBadge({ fkey, code }: { fkey: string; code: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
        background: T.amberBg, color: T.amberL, border: `1px solid ${T.amber}50`,
        letterSpacing: 1, ...mono,
      }}>{fkey}</span>
      <span style={{ fontSize: 9, color: T.td, letterSpacing: 1, ...mono }}>{code}</span>
    </div>
  );
}

/** Grid of metric cards */
export function BMetricGrid({ metrics, cols = 4 }: {
  metrics: Array<{ label: string; value: string; sub?: string; color?: string }>;
  cols?: number;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 1, background: T.border, borderRadius: 8, overflow: 'hidden',
    }}>
      {metrics.map((m, i) => (
        <div key={i} style={{ background: T.bgCard, padding: '14px 16px' }}>
          <div style={{ fontSize: 9, color: T.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4, ...mono }}>{m.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: m.color || T.amberL, ...mono }}>{m.value}</div>
          {m.sub && <div style={{ fontSize: 10, color: T.td, marginTop: 3, ...sans }}>{m.sub}</div>}
        </div>
      ))}
    </div>
  );
}
