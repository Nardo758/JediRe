import React from 'react';
import { BT } from '../bloomberg-ui';
import type { SubStrategyScore } from '../../../hooks/useStrategyAnalysisV2';

export const MONO = BT.font.mono;

export function BlockErrorFallback({
  message,
  onRetry,
  variant = 'block',
}: {
  message: string;
  onRetry: () => void;
  variant?: 'block' | 'inline';
}) {
  const isInline = variant === 'inline';
  return (
    <div
      role="alert"
      style={{
        margin: isInline ? '0 0 8px' : '0 0 1px',
        padding: isInline ? '6px 10px' : '8px 12px',
        borderLeft: `2px solid ${BT.text.red}`,
        background: `${BT.text.red}0d`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: isInline ? 8 : 9, color: BT.text.red, letterSpacing: 0.5 }}>
          BLOCK FAILED TO RENDER
        </span>
        <span style={{ fontFamily: MONO, fontSize: isInline ? 8 : 9, color: BT.text.secondary }}>
          {message}
        </span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        style={{
          fontFamily: MONO,
          fontSize: 9,
          color: BT.text.amber,
          background: `${BT.text.amber}18`,
          border: `1px solid ${BT.text.amber}44`,
          padding: '3px 10px',
          cursor: 'pointer',
          letterSpacing: 0.5,
        }}
      >
        RETRY
      </button>
    </div>
  );
}

export function confColor(c: number) {
  return c >= 0.85 ? BT.text.green : c >= 0.70 ? BT.text.amber : BT.text.red;
}

export function sevColor(s: 'critical' | 'warning' | 'info') {
  return s === 'critical' ? BT.text.red : s === 'warning' ? BT.text.amber : BT.text.cyan;
}

export const fmtSafe = (value: unknown, digits: number, multiplier = 1) => {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value) * multiplier;
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
};

export function gateColor(ss: SubStrategyScore): string {
  if (ss.gate?.disqualified) return BT.text.red;
  if (ss.gate?.marginal) return BT.text.amber;
  return BT.text.green;
}

export function gateLabel(ss: SubStrategyScore): string {
  if (ss.gate?.disqualified) return 'DISQUAL';
  if (ss.gate?.marginal) return 'MARGINAL';
  return 'QUALIFIED';
}

export function dirArrow(dir: 'up' | 'down' | 'flat'): { sym: string; color: string } {
  if (dir === 'up') return { sym: '▲', color: BT.text.green };
  if (dir === 'down') return { sym: '▼', color: BT.text.red };
  return { sym: '◆', color: BT.text.secondary };
}

export function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }
export function fmtScore(v: number) { return (v ?? 0).toFixed(1); }
export const SS_COLORS = [BT.text.cyan, BT.text.amber, BT.text.purple, BT.text.green, BT.text.orange];

export function ScoreRing({ score: rawScore, color, size = 56 }: { score: number; color: string; size?: number }) {
  const score = Math.min(100, Math.max(0, Number(rawScore ?? 0)));
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}20`} strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4} strokeLinecap="round" />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={Math.max(9, size * 0.22)} fontWeight={700} fontFamily={MONO}>
        {Math.round(score)}
      </text>
    </svg>
  );
}
