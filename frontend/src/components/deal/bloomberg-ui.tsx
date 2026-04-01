/**
 * Bloomberg Terminal v0.34 — Shared UI Component Library
 * Compact, dense terminal-style components used across all Deal Capsule modules.
 * All colors/tokens sourced from attached_assets Bloomberg v0.34 spec.
 */

import React from 'react';

// ─── Core v0.34 color tokens ──────────────────────────────────────────────────
export const BT = {
  bg: {
    terminal: '#0A0E17',
    panel:    '#0F1319',
    panelAlt: '#131821',
    header:   '#1A1F2E',
    hover:    '#1E2538',
    active:   '#252D40',
    input:    '#0D1117',
    topBar:   '#050810',
  },
  text: {
    primary:   '#E8ECF1',
    secondary: '#A0ABBE',
    muted:     '#6B7A8D',
    white:     '#FFFFFF',
    amber:     '#F5A623',
    amberBright: '#FFD166',
    green:     '#00D26A',
    red:       '#FF4757',
    cyan:      '#00BCD4',
    orange:    '#FF8C42',
    purple:    '#A78BFA',
    violet:    '#8B5CF6',
    teal:      '#00E5A0',
  },
  border: {
    subtle: '#1E2538',
    medium: '#2A3348',
    bright: '#3B4A6B',
  },
  // Platform Metric category colors
  met: {
    physTraffic:  '#60a5fa',
    digTraffic:   '#f59e0b',
    compTraffic:  '#a855f7',
    financial:    '#22c55e',
    occupancy:    '#14b8a6',
    economic:     '#ec4899',
    supply:       '#f97316',
    quality:      '#8b5cf6',
  },
  font: {
    mono:    "'JetBrains Mono','Fira Code','SF Mono',monospace",
    display: "'IBM Plex Mono',monospace",
    label:   "'IBM Plex Sans',sans-serif",
  },
  fontSize: {
    xs:   '9px',
    sm:   '9px',
    md:   '10px',
    base: '11px',
    lg:   '12px',
    xl:   '14px',
    xxl:  '20px',
    hero: '32px',
  },
  // No gradients — terminal aesthetic uses solid colors only
} as const;

const MONO = BT.font.mono;

// ─── CSS animations injected once ─────────────────────────────────────────────
export const BT_CSS = `
  @keyframes bt-glow  { 0%,100%{box-shadow:0 0 4px #00D26A44}50%{box-shadow:0 0 10px #00D26A66} }
  @keyframes bt-glowR { 0%,100%{box-shadow:0 0 4px #FF475744}50%{box-shadow:0 0 10px #FF475766} }
  @keyframes bt-pulse { 0%,100%{opacity:1}50%{opacity:0.6} }
  @keyframes bt-fade  { from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)} }
  @keyframes bt-blink { 0%,49%{opacity:1}50%,100%{opacity:0} }
`;

// ─── Bloomberg dark-theme CSS overrides for light-mode Tailwind tab components ─
export const BT_TAB_CSS = `
.bt-tab-wrap{color-scheme:dark}
.bt-tab-wrap .bg-white{background-color:#0F1319!important}
.bt-tab-wrap .bg-gray-50{background-color:#131821!important}
.bt-tab-wrap .bg-gray-100{background-color:#1A1F2E!important}
.bt-tab-wrap .bg-blue-50{background-color:#00BCD408!important}
.bt-tab-wrap .bg-blue-100{background-color:#00BCD418!important}
.bt-tab-wrap .bg-green-50{background-color:#00D26A08!important}
.bt-tab-wrap .bg-green-100{background-color:#00D26A18!important}
.bt-tab-wrap .bg-yellow-50{background-color:#F5A62308!important}
.bt-tab-wrap .bg-yellow-100{background-color:#F5A62318!important}
.bt-tab-wrap .bg-red-50{background-color:#FF475708!important}
.bt-tab-wrap .bg-red-100{background-color:#FF475718!important}
.bt-tab-wrap .bg-amber-50{background-color:#F5A62308!important}
.bt-tab-wrap .bg-amber-100{background-color:#F5A62318!important}
.bt-tab-wrap .bg-orange-50{background-color:#FF8C4208!important}
.bt-tab-wrap .bg-orange-100{background-color:#FF8C4218!important}
.bt-tab-wrap .bg-purple-50{background-color:#A78BFA08!important}
.bt-tab-wrap .bg-purple-100{background-color:#A78BFA18!important}
.bt-tab-wrap .bg-violet-50{background-color:#A78BFA06!important}
.bt-tab-wrap .bg-indigo-50{background-color:#818CF808!important}
.bt-tab-wrap .from-violet-50{--tw-gradient-from:#A78BFA06!important}
.bt-tab-wrap .to-indigo-50{--tw-gradient-to:#818CF808!important}
.bt-tab-wrap .bg-gradient-to-r{background-image:none!important;background-color:#0F1319!important}
.bt-tab-wrap .border,.bt-tab-wrap .border-t,.bt-tab-wrap .border-b,.bt-tab-wrap .border-l,.bt-tab-wrap .border-r{border-color:#1E2538!important}
.bt-tab-wrap .border-gray-100,.bt-tab-wrap .border-gray-200,.bt-tab-wrap .border-gray-300{border-color:#1E2538!important}
.bt-tab-wrap .border-blue-200,.bt-tab-wrap .border-blue-300{border-color:#00BCD433!important}
.bt-tab-wrap .border-green-200,.bt-tab-wrap .border-green-300{border-color:#00D26A44!important}
.bt-tab-wrap .border-yellow-200,.bt-tab-wrap .border-yellow-300{border-color:#F5A62344!important}
.bt-tab-wrap .border-amber-200,.bt-tab-wrap .border-amber-300{border-color:#F5A62344!important}
.bt-tab-wrap .border-red-200,.bt-tab-wrap .border-red-300{border-color:#FF475744!important}
.bt-tab-wrap .border-orange-200{border-color:#FF8C4244!important}
.bt-tab-wrap .border-violet-200{border-color:#A78BFA44!important}
.bt-tab-wrap .border-purple-200{border-color:#A78BFA44!important}
.bt-tab-wrap .text-gray-900{color:#E8ECF1!important}
.bt-tab-wrap .text-gray-800{color:#C8D0DC!important}
.bt-tab-wrap .text-gray-700{color:#8B95A5!important}
.bt-tab-wrap .text-gray-600{color:#8B95A5!important}
.bt-tab-wrap .text-gray-500{color:#4A5568!important}
.bt-tab-wrap .text-gray-400{color:#4A5568!important}
.bt-tab-wrap .text-blue-500,.bt-tab-wrap .text-blue-600,.bt-tab-wrap .text-blue-700{color:#00BCD4!important}
.bt-tab-wrap .text-green-500,.bt-tab-wrap .text-green-600,.bt-tab-wrap .text-green-700,.bt-tab-wrap .text-green-800,.bt-tab-wrap .text-green-900{color:#00D26A!important}
.bt-tab-wrap .text-yellow-500,.bt-tab-wrap .text-yellow-600,.bt-tab-wrap .text-yellow-700,.bt-tab-wrap .text-yellow-800{color:#F5A623!important}
.bt-tab-wrap .text-orange-500,.bt-tab-wrap .text-orange-600,.bt-tab-wrap .text-orange-700,.bt-tab-wrap .text-orange-800{color:#FF8C42!important}
.bt-tab-wrap .text-red-500,.bt-tab-wrap .text-red-600,.bt-tab-wrap .text-red-700,.bt-tab-wrap .text-red-800{color:#FF4757!important}
.bt-tab-wrap .text-amber-500,.bt-tab-wrap .text-amber-600,.bt-tab-wrap .text-amber-700,.bt-tab-wrap .text-amber-800,.bt-tab-wrap .text-amber-900{color:#F5A623!important}
.bt-tab-wrap .text-purple-600,.bt-tab-wrap .text-purple-700{color:#A78BFA!important}
.bt-tab-wrap .text-violet-600,.bt-tab-wrap .text-violet-700,.bt-tab-wrap .text-violet-800,.bt-tab-wrap .text-violet-900{color:#A78BFA!important}
.bt-tab-wrap .text-violet-400{color:#7C6FCD!important}
.bt-tab-wrap .text-indigo-600{color:#818CF8!important}
.bt-tab-wrap .bg-blue-600{background-color:#00BCD4!important}
.bt-tab-wrap .bg-blue-600,.bt-tab-wrap .bg-blue-600 *{color:#0A0E17!important}
.bt-tab-wrap .bg-blue-700:hover,.bt-tab-wrap .hover\\:bg-blue-700:hover{background-color:#00BCD4CC!important}
.bt-tab-wrap .bg-violet-200{background-color:#A78BFA22!important}
.bt-tab-wrap .text-violet-800{color:#A78BFA!important}
.bt-tab-wrap table{background-color:#0F1319!important;width:100%}
.bt-tab-wrap thead tr,.bt-tab-wrap .bg-gray-50 thead tr{background-color:#1A1F2E!important}
.bt-tab-wrap th{color:#4A5568!important;border-bottom-color:#2A3348!important}
.bt-tab-wrap td{border-bottom-color:#1E2538!important}
.bt-tab-wrap tr:hover:not(thead tr){background-color:#1E2538!important}
.bt-tab-wrap .hover\\:bg-gray-50:hover{background-color:#1E2538!important}
.bt-tab-wrap .hover\\:bg-green-50:hover{background-color:#00D26A08!important}
.bt-tab-wrap .hover\\:bg-amber-50:hover{background-color:#F5A62308!important}
.bt-tab-wrap .divide-y>*+*{border-top-color:#1E2538!important}
.bt-tab-wrap .divide-gray-100>*+*{border-top-color:#1E2538!important}
.bt-tab-wrap input,.bt-tab-wrap select,.bt-tab-wrap textarea{background-color:#0D1117!important;color:#E8ECF1!important;border-color:#1E2538!important}
.bt-tab-wrap input::placeholder,.bt-tab-wrap textarea::placeholder{color:#4A5568!important}
.bt-tab-wrap .rounded-lg{border-radius:0!important}
.bt-tab-wrap .rounded{border-radius:0!important}
.bt-tab-wrap .rounded-full{border-radius:9999px!important}
.bt-tab-wrap h3,.bt-tab-wrap h4,.bt-tab-wrap h2{font-family:'JetBrains Mono','Fira Code','SF Mono',monospace!important}
.bt-tab-wrap .animate-spin{border-color:#1E2538!important;border-bottom-color:#00BCD4!important}
.bt-tab-wrap .border-b-2.border-blue-600{border-bottom-color:#00BCD4!important}
.bt-tab-wrap .focus\\:ring-blue-500:focus{--tw-ring-color:#00BCD4!important}
.bt-tab-wrap .focus\\:border-blue-500:focus{border-color:#00BCD4!important}
.bt-tab-wrap .bg-neutral-950{background-color:#0A0E17!important}
.bt-tab-wrap .bg-neutral-900{background-color:#0F1319!important}
.bt-tab-wrap .bg-neutral-800{background-color:#131821!important}
.bt-tab-wrap .bg-neutral-700{background-color:#1A1F2E!important}
.bt-tab-wrap .bg-neutral-600{background-color:#1E2538!important}
.bt-tab-wrap .text-neutral-100{color:#E8ECF1!important}
.bt-tab-wrap .text-neutral-200{color:#C8D0DC!important}
.bt-tab-wrap .text-neutral-300{color:#8B95A5!important}
.bt-tab-wrap .text-neutral-400{color:#4A5568!important}
.bt-tab-wrap .text-neutral-500{color:#2A3348!important}
.bt-tab-wrap .border-neutral-700{border-color:#1E2538!important}
.bt-tab-wrap .border-neutral-600{border-color:#2A3348!important}
.bt-tab-wrap .hover\\:bg-neutral-700:hover{background-color:#1E2538!important}
.bt-tab-wrap .hover\\:bg-neutral-800:hover{background-color:#131821!important}
.bt-tab-wrap .hover\\:border-neutral-600:hover{border-color:#2A3348!important}
.bt-tab-wrap .disabled\\:bg-neutral-700:disabled{background-color:#1A1F2E!important}
.bt-tab-wrap .disabled\\:text-neutral-500:disabled{color:#2A3348!important}
.bt-tab-wrap .text-blue-300{color:#00BCD4!important}
.bt-tab-wrap .text-blue-400{color:#00BCD4CC!important}
.bt-tab-wrap .text-green-400{color:#00D26A!important}
.bt-tab-wrap .text-emerald-400{color:#00D26A!important}
.bt-tab-wrap .text-teal-400{color:#00E5A0!important}
.bt-tab-wrap .text-amber-400{color:#F5A623!important}
.bt-tab-wrap .text-yellow-300{color:#FFD166!important}
.bt-tab-wrap .text-yellow-400{color:#F5A623!important}
.bt-tab-wrap .text-red-400{color:#FF4757!important}
.bt-tab-wrap .text-rose-400{color:#FF4757!important}
.bt-tab-wrap .text-orange-400{color:#FF8C42!important}
.bt-tab-wrap .text-purple-300{color:#A78BFA!important}
.bt-tab-wrap .text-indigo-300{color:#818CF8!important}
.bt-tab-wrap .text-sky-400{color:#00BCD4!important}
.bt-tab-wrap .text-cyan-400{color:#00BCD4!important}
.bt-tab-wrap .border-blue-700{border-color:#00BCD433!important}
.bt-tab-wrap .border-green-700{border-color:#00D26A44!important}
.bt-tab-wrap .border-amber-700{border-color:#F5A62344!important}
.bt-tab-wrap .border-red-700{border-color:#FF475744!important}
.bt-tab-wrap .border-purple-700{border-color:#A78BFA44!important}
.bt-tab-wrap .border-indigo-700{border-color:#818CF844!important}
.bt-tab-wrap .bg-gradient-to-br{background-image:none!important;background-color:#131821!important}
.bt-tab-wrap .bg-gradient-to-b{background-image:none!important;background-color:#131821!important}
.bt-tab-wrap .from-neutral-800{--tw-gradient-from:#131821!important}
.bt-tab-wrap .to-neutral-950{--tw-gradient-to:#0A0E17!important}
.bt-tab-wrap .to-neutral-900{--tw-gradient-to:#0F1319!important}
`;

// ─── BtTabWrapper — applies Bloomberg dark theme to light-mode tab components ──
export function BtTabWrapper({
  children, style,
}: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="bt-tab-wrap" style={{
      flex: 1,
      overflow: 'auto',
      background: BT.bg.terminal,
      padding: '12px 16px',
      animation: 'bt-fade 0.15s',
      ...style,
    }}>
      <style>{BT_CSS + BT_TAB_CSS}</style>
      {children}
    </div>
  );
}

// ─── BtSection — injects BT CSS overrides into any section component ──────────
export function BtSection({ children, className = '', style }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div className={`bt-tab-wrap ${className}`} style={{ background: BT.bg.terminal, color: BT.text.primary, ...style }}>
      <style>{BT_CSS + BT_TAB_CSS}</style>
      {children}
    </div>
  );
}

// ─── Spark — SVG polyline sparkline ───────────────────────────────────────────
export function Spark({ data, color = BT.text.green, w = 56, h = 16 }: {
  data: number[]; color?: string; w?: number; h?: number;
}) {
  if (!data || data.length < 2) return null;
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * w},${h - ((v - mn) / r) * (h - 2) + 1}`
  ).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Bd — compact badge ───────────────────────────────────────────────────────
export function Bd({ children, c, onClick }: {
  children: React.ReactNode; c: string; onClick?: () => void;
}) {
  return (
    <span
      onClick={onClick}
      style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 700, color: c,
        background: `${c}18`, border: `1px solid ${c}33`,
        padding: '1px 5px', letterSpacing: 0.5, textTransform: 'uppercase' as const,
        whiteSpace: 'nowrap' as const, cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </span>
  );
}

// ─── StageBd — deal stage badge ───────────────────────────────────────────────
export function StageBd({ stage }: { stage: string }) {
  const m: Record<string, string> = {
    DD: BT.text.cyan, LOI: BT.text.amber,
    PROSPECT: BT.text.secondary, LEAD: BT.text.muted,
    ACTIVE: BT.text.green, CLOSED: BT.text.purple,
  };
  return <Bd c={m[stage] ?? BT.text.muted}>{stage}</Bd>;
}

// ─── RiskDot — colored dot with optional glow ─────────────────────────────────
export function RiskDot({ level }: { level: 'HIGH' | 'MED' | 'LOW' | string }) {
  const c = level === 'HIGH' ? BT.text.red : level === 'MED' ? BT.text.orange : BT.text.green;
  const anim = level === 'HIGH' ? 'bt-glowR 2s infinite' : level === 'LOW' ? 'bt-glow 2s infinite' : 'none';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontFamily: MONO, fontWeight: 600, color: c }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c, animation: anim }} />
      {level}
    </span>
  );
}

// ─── MetricTag — platform metric source label ──────────────────────────────────
export function MetricTag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 9, color, background: `${color}12`, padding: '0 3px',
      borderRadius: 2, whiteSpace: 'nowrap' as const, fontFamily: MONO, fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

// ─── PanelHeader ──────────────────────────────────────────────────────────────
export function PanelHeader({
  title, subtitle, right, borderColor, metrics,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  borderColor?: string;
  metrics?: Array<{ l: string; c: string }>;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '4px 10px',
      background: BT.bg.header,
      borderBottom: `1px solid ${BT.border.subtle}`,
      borderTop: borderColor ? `2px solid ${borderColor}` : 'none',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: BT.text.white, letterSpacing: 0.8, fontFamily: MONO }}>{title}</span>
        {subtitle && <span style={{ fontSize: 9, color: BT.text.secondary, fontFamily: MONO }}>{subtitle}</span>}
        {metrics && (
          <div style={{ display: 'flex', gap: 2 }}>
            {metrics.map((m, i) => <MetricTag key={i} label={m.l} color={m.c} />)}
          </div>
        )}
      </div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{right}</div>}
    </div>
  );
}

// ─── SectionPanel ─────────────────────────────────────────────────────────────
export function SectionPanel({
  title, subtitle, borderColor, metrics, right, children, style: s,
}: {
  title?: string;
  subtitle?: string;
  borderColor?: string;
  metrics?: Array<{ l: string; c: string }>;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: BT.bg.panel,
      border: `1px solid ${BT.border.subtle}`,
      display: 'flex',
      flexDirection: 'column' as const,
      ...s,
    }}>
      {title && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '3px 8px',
          background: BT.bg.header,
          borderBottom: `1px solid ${BT.border.subtle}`,
          borderTop: borderColor ? `2px solid ${borderColor}` : 'none',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: BT.text.white, letterSpacing: 0.5, fontFamily: MONO }}>{title}</span>
            {subtitle && <span style={{ fontSize: 9, color: BT.text.secondary, fontFamily: MONO }}>{subtitle}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {metrics && metrics.map((m, i) => <MetricTag key={i} label={m.l} color={m.c} />)}
            {right}
          </div>
        </div>
      )}
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ─── DataRow ──────────────────────────────────────────────────────────────────
export function DataRow({
  label, value, valueColor, sub, border = true, metricColor,
}: {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  sub?: string;
  border?: boolean;
  metricColor?: string;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '3px 8px',
      borderBottom: border ? `1px solid ${BT.border.subtle}` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {metricColor && <span style={{ width: 3, height: 3, borderRadius: '50%', background: metricColor }} />}
        <span style={{ fontSize: 9, color: BT.text.muted, letterSpacing: 0.5, fontFamily: MONO }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: valueColor ?? BT.text.amber, fontFamily: MONO }}>{value}</span>
        {sub && <span style={{ fontSize: 9, color: BT.text.secondary, fontFamily: MONO }}>{sub}</span>}
      </div>
    </div>
  );
}

// ─── MiniBar ──────────────────────────────────────────────────────────────────
export function MiniBar({
  value, max = 100, color, label, showVal = true,
}: {
  value: number; max?: number; color?: string; label?: string; showVal?: boolean;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const bc = color ?? (pct >= 75 ? BT.text.green : pct >= 50 ? BT.text.amber : BT.text.red);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
      {label && (
        <span style={{ fontSize: 9, color: BT.text.muted, minWidth: 60, letterSpacing: 0.5, fontFamily: MONO }}>{label}</span>
      )}
      <div style={{ flex: 1, height: 4, background: BT.bg.terminal, borderRadius: 1 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: bc, borderRadius: 1 }} />
      </div>
      {showVal && (
        <span style={{ fontSize: 9, fontWeight: 700, color: bc, minWidth: 20, textAlign: 'right' as const, fontFamily: MONO }}>{value}</span>
      )}
    </div>
  );
}

// ─── SubTabBar ────────────────────────────────────────────────────────────────
export function SubTabBar({
  tabs, active, setActive, color,
}: {
  tabs: string[];
  active: number;
  setActive: (i: number) => void;
  color?: string;
}) {
  const ac = color ?? BT.text.amber;
  return (
    <div style={{
      display: 'flex',
      background: BT.bg.header,
      borderBottom: `1px solid ${BT.border.medium}`,
      flexShrink: 0,
      overflowX: 'auto' as const,
    }}>
      {tabs.map((tab, i) => (
        <button
          key={i}
          onClick={() => setActive(i)}
          style={{
            fontFamily: MONO, fontSize: 9, fontWeight: active === i ? 700 : 500,
            padding: '5px 12px',
            background: 'transparent',
            border: 'none',
            borderBottom: active === i ? `2px solid ${ac}` : '2px solid transparent',
            color: active === i ? ac : BT.text.secondary,
            cursor: 'pointer',
            whiteSpace: 'nowrap' as const,
            letterSpacing: 0.5,
            transition: 'color 0.1s',
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ─── VerifiedLink ─────────────────────────────────────────────────────────────
export function VerifiedLink({ source }: { source: string }) {
  return (
    <span style={{
      fontSize: 9, color: BT.text.teal, cursor: 'pointer',
      textDecoration: 'underline', textDecorationStyle: 'dotted' as const,
      fontFamily: MONO,
    }}>
      {source} ✓
    </span>
  );
}

// ─── AlertBanner — colored left-border alert strip ────────────────────────────
export function AlertBanner({
  label, text, color, badge,
}: {
  label: string; text: string; color: string; badge?: React.ReactNode;
}) {
  return (
    <div style={{
      padding: '5px 10px',
      background: `${color}08`,
      borderLeft: `3px solid ${color}`,
      display: 'flex', alignItems: 'center', gap: 8,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 9, color, fontWeight: 700, fontFamily: MONO, whiteSpace: 'nowrap' as const }}>
        {label}:
      </span>
      <span style={{ fontSize: 9, color: BT.text.secondary, fontFamily: MONO, flex: 1 }}>{text}</span>
      {badge}
    </div>
  );
}

// ─── ModuleShell — full module wrapper with PanelHeader ───────────────────────
export function ModuleShell({
  title, subtitle, borderColor, metrics, right, children,
}: {
  title: string;
  subtitle?: string;
  borderColor?: string;
  metrics?: Array<{ l: string; c: string }>;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column' as const,
      height: '100%', background: BT.bg.terminal, overflow: 'hidden',
      animation: 'bt-fade 0.15s',
    }}>
      <style>{BT_CSS}</style>
      <PanelHeader title={title} subtitle={subtitle} borderColor={borderColor} metrics={metrics} right={right} />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

// ─── KpiTile — metric tile with category top border and sparkline ─────────────
export function KpiTile({
  label, value, sub, color, spark,
}: {
  label: string; value: string; sub?: string; color?: string; spark?: number[];
}) {
  const c = color ?? BT.text.amber;
  return (
    <div style={{
      background: BT.bg.panel,
      borderTop: `2px solid ${c}`,
      padding: '6px 8px',
      display: 'flex', flexDirection: 'column' as const, gap: 2,
    }}>
      <div style={{ fontSize: 9, color: BT.text.muted, letterSpacing: 0.8, fontFamily: MONO }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: c, fontFamily: MONO }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: BT.text.secondary, fontFamily: MONO }}>{sub}</div>}
      {spark && <Spark data={spark} color={c} w={80} h={12} />}
    </div>
  );
}

// ─── TableHeader — compact table column headers ───────────────────────────────
export function TableHeader({ cols }: { cols: Array<{ label: string; color?: string; flex?: number | string }> }) {
  return (
    <div style={{ display: 'flex', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}` }}>
      {cols.map((c, i) => (
        <div key={i} style={{
          padding: '4px 8px',
          fontSize: 9, fontWeight: 700,
          color: c.color ?? BT.text.muted,
          letterSpacing: 0.8, fontFamily: MONO,
          flex: c.flex ?? 1,
          borderRight: `1px solid ${BT.border.subtle}`,
        }}>
          {c.label}
        </div>
      ))}
    </div>
  );
}

// ─── TableRow — alternating-bg table row ──────────────────────────────────────
export function TableRow({
  cells, index, onClick,
}: {
  cells: Array<{ value: React.ReactNode; color?: string; flex?: number | string; weight?: number }>;
  index: number;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        background: index % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
        borderBottom: `1px solid ${BT.border.subtle}`,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {cells.map((c, i) => (
        <div key={i} style={{
          padding: '4px 8px',
          fontSize: 9, fontWeight: c.weight ?? 500,
          color: c.color ?? BT.text.secondary,
          fontFamily: MONO, flex: c.flex ?? 1,
          borderRight: `1px solid ${BT.border.subtle}`,
          display: 'flex', alignItems: 'center',
        }}>
          {c.value}
        </div>
      ))}
    </div>
  );
}

export function BloombergPage({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: BT.bg.terminal, color: BT.text.primary, fontFamily: MONO, minHeight: '100%', padding: 16, ...s }}>
      {children}
    </div>
  );
}

export function BCard({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 6, padding: '12px 16px', ...s }}>
      {children}
    </div>
  );
}

export function BLiveBadge({ live }: { live: boolean }) {
  return live ? (
    <span style={{ fontSize: 9, fontWeight: 700, color: BT.text.green, background: `${BT.text.green}18`, border: `1px solid ${BT.text.green}40`, borderRadius: 2, padding: '1px 4px', letterSpacing: 0.5, fontFamily: MONO }}>LIVE</span>
  ) : (
    <span style={{ fontSize: 9, fontWeight: 700, color: BT.text.muted, background: `${BT.text.muted}18`, border: `1px solid ${BT.text.muted}40`, borderRadius: 2, padding: '1px 4px', letterSpacing: 0.5, fontFamily: MONO }}>EST</span>
  );
}
