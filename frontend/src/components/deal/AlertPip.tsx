import React from 'react';
import { BT } from './bloomberg-ui';
import type { AlertLevel } from '../../stores/dealContext.types';

const MONO = BT.font.mono;

const PIP_CONFIG: Record<AlertLevel, { char: string; color: string; bg: string; title: string } | null> = {
  block: { char: '!', color: BT.text.red, bg: `${BT.text.red}22`, title: 'Required — blocks agent execution' },
  warn:  { char: '▲', color: BT.text.amber, bg: `${BT.text.amber}18`, title: 'Low confidence or source divergence' },
  info:  { char: '·', color: BT.text.cyan, bg: 'transparent', title: 'Unreviewed value' },
  none:  null,
};

interface AlertPipProps {
  level: AlertLevel;
  onDismiss?: () => void;
  style?: React.CSSProperties;
}

export function AlertPip({ level, onDismiss, style }: AlertPipProps) {
  const cfg = PIP_CONFIG[level];
  if (!cfg) return null;

  return (
    <span
      title={cfg.title}
      onClick={onDismiss}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: level === 'info' ? 8 : 12,
        height: level === 'info' ? 8 : 12,
        fontFamily: MONO,
        fontSize: level === 'info' ? 10 : 8,
        fontWeight: 700,
        color: cfg.color,
        background: cfg.bg,
        border: level !== 'info' ? `1px solid ${cfg.color}44` : 'none',
        cursor: onDismiss ? 'pointer' : 'default',
        lineHeight: 1,
        flexShrink: 0,
        ...style,
      }}
    >
      {cfg.char}
    </span>
  );
}

export function AlertPipInline({ level, label, onDismiss }: {
  level: AlertLevel;
  label?: string;
  onDismiss?: () => void;
}) {
  const cfg = PIP_CONFIG[level];
  if (!cfg) return null;

  return (
    <span
      title={cfg.title}
      onClick={onDismiss}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        cursor: onDismiss ? 'pointer' : 'default',
      }}
    >
      <AlertPip level={level} />
      {label && (
        <span style={{ fontFamily: MONO, fontSize: 8, color: cfg.color, letterSpacing: 0.3 }}>
          {label}
        </span>
      )}
    </span>
  );
}
