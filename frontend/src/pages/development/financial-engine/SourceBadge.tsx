import React, { useState } from 'react';
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

export interface ContestedPoint {
  label: string;
  value: number;
  /** Absolute delta vs. the resolved (winning) value. */
  deltaAbsolute?: number;
  /** Relative delta as fraction of resolved value (signed). */
  deltaRelative?: number | null;
  /** Whether this source is above or below the resolved value. */
  directionVsResolved?: 'above' | 'below' | 'equal';
}

/**
 * ContestedBadge — provenance badge for fields with material source divergence.
 *
 * Renders an amber/red "⚡ N SOURCES · delta" pill when two or more source
 * layers disagree beyond the field's divergence threshold.
 *
 * Click to expand an inline provenance panel showing all diverging source
 * layers with their values and per-source deltas vs. the resolved value.
 *
 * alertLevel:
 *   'warn'  → amber border / background (delta ≥ threshold, < 3×threshold)
 *   'block' → red border / background (extreme divergence, ≥ 3×threshold)
 *
 * interpretationHint (optional): human-readable explanation of why sources
 *   diverge for this field (e.g. T-12 trailing vs. live snapshot difference).
 */
export function ContestedBadge({
  alertLevel,
  deltaLabel,
  points,
  isPct,
  interpretationHint,
}: {
  alertLevel: 'warn' | 'block';
  deltaLabel?: string;
  points?: ContestedPoint[];
  isPct?: boolean;
  interpretationHint?: string;
}) {
  const [open, setOpen] = useState(false);

  const isBlock   = alertLevel === 'block';
  const color     = isBlock ? '#FF5252' : BT.text.amber;
  const bg        = isBlock ? '#FF525210' : `${BT.text.amber}10`;
  const sourceCount = points?.length ?? 0;

  const badgeLabel = [
    sourceCount >= 2 ? `${sourceCount} SOURCES` : null,
    deltaLabel,
  ].filter(Boolean).join(' · ');

  const fmtVal = (v: number) =>
    isPct ? `${(v * 100).toFixed(2)}%` : `$${Math.round(v).toLocaleString()}`;

  const fmtDelta = (pt: ContestedPoint): string | null => {
    if (pt.deltaAbsolute == null || pt.deltaAbsolute === 0) return null;
    const abs = isPct
      ? `${Math.round(pt.deltaAbsolute * 10000)} bps`
      : `$${Math.round(pt.deltaAbsolute).toLocaleString()}`;
    const sign = pt.directionVsResolved === 'above' ? '+' : pt.directionVsResolved === 'below' ? '−' : '';
    return `${sign}${abs} vs resolved`;
  };

  const deltaColor = (pt: ContestedPoint) => {
    if (!pt.directionVsResolved || pt.directionVsResolved === 'equal') return BT.text.muted;
    return pt.directionVsResolved === 'above' ? '#00D26A' : '#FF5252';
  };

  return (
    <div style={{ display: 'inline-block', position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '1px 5px', borderRadius: 2,
          fontFamily: MONO, fontSize: 7, letterSpacing: 0.4, fontWeight: 700,
          color,
          background: bg,
          border: `1px solid ${color}55`,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
        title="Click to see diverging source values"
      >
        <span style={{ fontSize: 7, lineHeight: 1 }}>⚡</span>
        <span>CONTESTED</span>
        {badgeLabel ? (
          <span style={{ fontWeight: 600, opacity: 0.9 }}> · {badgeLabel}</span>
        ) : null}
        <span style={{ fontSize: 6, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 50,
          marginTop: 2,
          background: '#0f172a',
          border: `1px solid ${color}44`,
          borderRadius: 3,
          padding: '6px 8px',
          minWidth: 220,
          maxWidth: 320,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            fontFamily: MONO, fontSize: 6.5, color, fontWeight: 700,
            letterSpacing: 0.5, marginBottom: 5,
          }}>
            DIVERGING SOURCES ({sourceCount})
          </div>

          {points && points.length > 0 && (
            <div style={{ marginBottom: interpretationHint ? 6 : 0 }}>
              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto',
                gap: '0 8px', padding: '1px 0 3px 0',
                borderBottom: '1px solid #1e293b', marginBottom: 3,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 6, color: BT.text.muted, letterSpacing: 0.4 }}>SOURCE</span>
                <span style={{ fontFamily: MONO, fontSize: 6, color: BT.text.muted, letterSpacing: 0.4, textAlign: 'right' }}>VALUE</span>
                <span style={{ fontFamily: MONO, fontSize: 6, color: BT.text.muted, letterSpacing: 0.4, textAlign: 'right' }}>Δ vs RESOLVED</span>
              </div>

              {points.map((pt, i) => {
                const delta = fmtDelta(pt);
                const dColor = deltaColor(pt);
                const isResolved = !pt.directionVsResolved || pt.directionVsResolved === 'equal';
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto',
                    gap: '0 8px',
                    padding: '2px 0',
                    borderTop: i > 0 ? `1px solid #1e293b` : undefined,
                    alignItems: 'start',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
                        {pt.label}
                      </span>
                      {isResolved && (
                        <span style={{
                          fontFamily: MONO, fontSize: 5.5, letterSpacing: 0.3,
                          color: '#00D26A', background: '#00D26A14',
                          border: '1px solid #00D26A33',
                          padding: '0 3px', borderRadius: 1,
                        }}>USED</span>
                      )}
                    </div>
                    <span style={{
                      fontFamily: MONO, fontSize: 7, color: BT.met.financial, fontWeight: 700,
                      textAlign: 'right', whiteSpace: 'nowrap',
                    }}>
                      {fmtVal(pt.value)}
                    </span>
                    <span style={{
                      fontFamily: MONO, fontSize: 6.5, color: dColor, fontWeight: delta ? 600 : 400,
                      textAlign: 'right', whiteSpace: 'nowrap',
                    }}>
                      {delta ?? '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {interpretationHint && (
            <div style={{
              marginTop: 5, paddingTop: 5,
              borderTop: '1px solid #1e293b',
              fontFamily: MONO, fontSize: 6.5, color: '#94a3b8', lineHeight: 1.5,
            }}>
              <span style={{ color: BT.text.amber, fontWeight: 700 }}>WHY: </span>
              {interpretationHint}
            </div>
          )}

          <div style={{
            marginTop: 4, paddingTop: 3,
            borderTop: `1px solid #1e293b`,
            fontFamily: MONO, fontSize: 6, color: BT.text.muted,
          }}>
            click badge to dismiss
          </div>
        </div>
      )}
    </div>
  );
}
