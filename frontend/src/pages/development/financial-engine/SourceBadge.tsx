import React from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';

const MONO = BT.font.mono;

export const SOURCE_META: Record<string, { label: string; color: string; bg: string }> = {
  t12:                  { label: 'T-12',           color: '#f8fafc', bg: '#334155' },
  rent_roll:            { label: 'Rent Roll',      color: '#f8fafc', bg: '#1e3a5f' },
  extraction_rent_roll: { label: 'Rent Roll',      color: '#f8fafc', bg: '#1e3a5f' },
  extraction_om:        { label: 'OM Narrative',   color: '#f59e0b', bg: '#292101' },
  tax_bill:             { label: 'County Assessor', color: '#06b6d4', bg: '#083344' },
  om:                   { label: 'OM Narrative',   color: '#f59e0b', bg: '#292101' },
  broker:               { label: 'OM Narrative',   color: '#f59e0b', bg: '#292101' },
  platform:             { label: 'Platform',       color: '#60a5fa', bg: '#1e3a5f' },
  platform_fallback:    { label: 'Platform',       color: '#60a5fa', bg: '#1e3a5f' },
  override:             { label: 'Override',       color: '#c084fc', bg: '#2e1065' },
  box_score:            { label: 'Box Score',      color: '#86efac', bg: '#14532d' },
  computed:             { label: 'Computed',       color: '#94a3b8', bg: '#1e293b' },
  unit_mix:             { label: 'Unit Mix',       color: '#22d3ee', bg: '#083344' },
  capsule:              { label: 'Capsule',        color: '#a78bfa', bg: '#1e1b4b' },
  synthesized:          { label: 'Synthesized',    color: '#94a3b8', bg: '#1e293b' },
  agent:                { label: 'AI',             color: '#818cf8', bg: '#1e1b4b' },
};

export function SourceBadge({ source }: { source: string | null }) {
  const meta = source ? (SOURCE_META[source] ?? null) : null;
  if (!meta) {
    return (
      <span style={{
        display: 'inline-block', padding: '1px 5px', borderRadius: 2,
        fontFamily: MONO, fontSize: 8, letterSpacing: 0.3,
        color: '#475569', background: '#1e293b',
      }}>Not Provided</span>
    );
  }
  return (
    <span style={{
      display: 'inline-block', padding: '1px 5px', borderRadius: 2,
      fontFamily: MONO, fontSize: 8, letterSpacing: 0.3,
      color: meta.color, background: meta.bg,
    }}>{meta.label}</span>
  );
}

/**
 * ContestedBadge — provenance badge for fields with material source divergence.
 *
 * Renders an amber "CONTESTED" pill when two or more source layers disagree
 * beyond the field's divergence threshold. Accepts an optional delta string
 * for display (e.g. "1345 bps").
 *
 * alertLevel:
 *   'warn'  → amber border / background
 *   'block' → red border / background (extreme divergence)
 */
export function ContestedBadge({
  alertLevel,
  deltaLabel,
}: {
  alertLevel: 'warn' | 'block';
  deltaLabel?: string;
}) {
  const isBlock   = alertLevel === 'block';
  const color     = isBlock ? '#FF5252' : BT.text.amber;
  const bg        = isBlock ? '#FF525210' : `${BT.text.amber}10`;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 5px', borderRadius: 2,
      fontFamily: MONO, fontSize: 7, letterSpacing: 0.4, fontWeight: 700,
      color,
      background: bg,
      border: `1px solid ${color}55`,
      whiteSpace: 'nowrap',
    }}>
      ⚡ CONTESTED{deltaLabel ? ` · ${deltaLabel}` : ''}
    </span>
  );
}
