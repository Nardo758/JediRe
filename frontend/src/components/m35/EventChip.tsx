/**
 * M35 EventChip — compact inline attribution pill
 * Placed beside assumption values in Financial, Market, and other Capsule sections.
 * Shows metric attribution delta with hover tooltip for full decomposition.
 */

import React, { useState } from 'react';
import { BT } from '../deal/bloomberg-ui';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventAttribution {
  eventId: string;
  eventName: string;
  metricKey: string;
  delta: number;
  unit: string;
  baseline: number;
  total: number;
  confidence: number;
}

interface EventChipProps {
  attribution: EventAttribution;
  scope?: 'msa' | 'submarket' | 'property';
  onClick?: (eventId: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCOPE_COLOR: Record<string, string> = {
  msa:       '#6B7280',
  submarket: '#0891B2',
  property:  '#D97706',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function EventChip({ attribution, scope = 'msa', onClick }: EventChipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const mono = BT.font.mono;
  const color = SCOPE_COLOR[scope] || SCOPE_COLOR.msa;
  const isPositive = attribution.delta >= 0;
  const sign = isPositive ? '+' : '';
  const deltaStr = `${sign}${attribution.delta.toFixed(2)}${attribution.unit}`;

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        onClick={() => onClick?.(attribution.eventId)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          fontSize: 8,
          fontFamily: mono,
          fontWeight: 700,
          color: isPositive ? BT.text.green : BT.text.red,
          background: `${color}11`,
          borderLeft: `2px solid ${color}`,
          padding: '1px 5px',
          cursor: onClick ? 'pointer' : 'default',
          letterSpacing: 0.2,
          userSelect: 'none',
        }}
      >
        {deltaStr} <span style={{ color: BT.text.muted, fontWeight: 400 }}>from {attribution.eventName}</span>
      </span>

      {showTooltip && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          marginBottom: 4,
          background: BT.bg.panel,
          border: `1px solid ${BT.border.medium}`,
          padding: '6px 10px',
          zIndex: 9999,
          minWidth: 200,
          boxShadow: '0 4px 12px #00000088',
          fontFamily: mono,
        }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: BT.text.primary, marginBottom: 4 }}>
            Event Attribution
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: BT.text.muted }}>Baseline</span>
              <span style={{ color: BT.text.secondary }}>
                {attribution.baseline.toFixed(2)}{attribution.unit}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: color }}>+ {attribution.eventName}</span>
              <span style={{ color: isPositive ? BT.text.green : BT.text.red, fontWeight: 700 }}>
                {deltaStr}
              </span>
            </div>
            <div style={{ borderTop: `1px solid ${BT.border.subtle}`, paddingTop: 2, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: BT.text.muted }}>Total (observed)</span>
              <span style={{ color: BT.text.primary, fontWeight: 700 }}>
                {attribution.total.toFixed(2)}{attribution.unit}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: BT.text.muted }}>Confidence</span>
              <span style={{ color: BT.text.secondary }}>{Math.round(attribution.confidence * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
