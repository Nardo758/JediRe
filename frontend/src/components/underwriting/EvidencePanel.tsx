/**
 * EvidencePanel — Bloomberg Terminal-style evidence drawer for underwriting assumptions
 *
 * Opens as a right-side panel when a user clicks any assumption cell in F9 ProForma tab.
 * Shows the full evidence chain: tier-ranked data points, reasoning, alternatives, and
 * any broker OM collision report.
 *
 * Tabs:
 *   Reasoning  — plain-language derivation + primary evidence
 *   Evidence   — weighted data points table (all tiers)
 *   Alternatives — rejected values with reasons
 * Collision section — shown when broker OM diverges (material/severe)
 * Override section — user can accept agent value, accept broker, or set custom
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BT, BT_CSS } from '../deal/bloomberg-ui';
import { SourceBadge, ConfidenceBadge } from '../primitives/SourceBadge';

interface EvidencePoint {
  tier: 1 | 2 | 3 | 4;
  source: string;
  label: string;
  value: number | string | null;
  weight: number;
  notes?: string;
}

interface Alternative {
  source: string;
  label: string;
  value: number | string | null;
  delta_pct?: number | null;
  reason_rejected: string;
}

interface CollisionReport {
  field_path: string;
  agent_value: number | string | null;
  broker_value: number | string | null;
  delta_pct: number | null;
  magnitude: 'minor' | 'material' | 'severe';
  direction: 'agent_higher' | 'agent_lower' | 'equal';
  narrative: string;
}

interface Evidence {
  field_path: string;
  primary_tier: 1 | 2 | 3 | 4;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  data_points: EvidencePoint[];
  alternatives: Alternative[];
  collision?: CollisionReport | null;
}

interface EvidencePanelProps {
  dealId: string;
  fieldPath: string;
  fieldLabel: string;
  onClose: () => void;
  onOverride?: (fieldPath: string, value: unknown, reason?: string) => void;
}

const TIER_LABEL: Record<number, string> = {
  1: 'TIER 1 · DEAL DOCS',
  2: 'TIER 2 · OWNED PORTFOLIO',
  3: 'TIER 3 · MARKET DATA',
  4: 'TIER 4 · BROKER OM',
};

const TIER_COLOR: Record<number, string> = {
  1: BT.accent.doc,
  2: '#60A5FA',
  3: BT.text.purple,
  4: BT.text.orange,
};

const MAGNITUDE_COLOR: Record<string, string> = {
  minor: BT.text.secondary,
  material: BT.text.amber,
  severe: BT.text.red,
};

export function EvidencePanel({ dealId, fieldPath, fieldLabel, onClose, onOverride }: EvidencePanelProps) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reasoning' | 'evidence' | 'alternatives'>('reasoning');
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overriding, setOverriding] = useState(false);
  const [overrideDone, setOverrideDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`/api/v1/deals/${dealId}/assumptions/${encodeURIComponent(fieldPath)}/evidence`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => { if (mounted) { setEvidence(data.evidence ?? null); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [dealId, fieldPath]);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  const handleOverride = async (value: unknown, reason?: string) => {
    setOverriding(true);
    try {
      await fetch(`/api/v1/deals/${dealId}/assumptions/${encodeURIComponent(fieldPath)}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value, reason }),
      });
      setOverrideDone(true);
      onOverride?.(fieldPath, value, reason);
    } finally {
      setOverriding(false);
    }
  };

  const mono = BT.font.mono;

  return (
    <>
      <style>{BT_CSS}</style>
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
          background: BT.bg.panel, borderLeft: `1px solid ${BT.border.medium}`,
          display: 'flex', flexDirection: 'column', zIndex: 1000,
          animation: 'bt-fade 0.15s',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', background: BT.bg.header,
          borderBottom: `1px solid ${BT.border.medium}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: BT.text.white, letterSpacing: 0.8 }}>
              EVIDENCE · {fieldLabel.toUpperCase()}
            </span>
            <span style={{ fontFamily: mono, fontSize: 8, color: BT.text.secondary }}>{fieldPath}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: BT.text.secondary, fontFamily: mono, fontSize: 10,
              padding: '2px 6px',
            }}
          >ESC ×</button>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', background: BT.bg.header,
          borderBottom: `1px solid ${BT.border.subtle}`, flexShrink: 0,
        }}>
          {(['reasoning', 'evidence', 'alternatives'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 4px',
                fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: 0.5,
                color: activeTab === tab ? BT.text.amber : BT.text.secondary,
                borderBottom: activeTab === tab ? `1px solid ${BT.text.amber}` : '1px solid transparent',
              }}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {loading ? (
            <div style={{ fontFamily: mono, fontSize: 9, color: BT.text.muted, padding: 16 }}>
              LOADING EVIDENCE…
            </div>
          ) : !evidence ? (
            <div style={{ fontFamily: mono, fontSize: 9, color: BT.text.muted, padding: 16 }}>
              NO EVIDENCE FOUND FOR THIS FIELD.
              <br /><br />
              Run the CashFlow Agent to generate evidence-backed underwriting.
            </div>
          ) : (
            <>
              {/* Header: tier + confidence */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <span style={{
                  fontFamily: mono, fontSize: 7, fontWeight: 700,
                  color: TIER_COLOR[evidence.primary_tier],
                  background: `${TIER_COLOR[evidence.primary_tier]}18`,
                  border: `1px solid ${TIER_COLOR[evidence.primary_tier]}44`,
                  borderRadius: 2, padding: '0 3px', lineHeight: '14px',
                }}>
                  {TIER_LABEL[evidence.primary_tier]}
                </span>
                <ConfidenceBadge confidence={evidence.confidence} />
              </div>

              {/* ── REASONING TAB ────────────────────────────────── */}
              {activeTab === 'reasoning' && (
                <div>
                  <div style={{
                    fontFamily: mono, fontSize: 9, color: BT.text.secondary,
                    lineHeight: 1.6, marginBottom: 16,
                    borderLeft: `2px solid ${BT.border.medium}`, paddingLeft: 10,
                  }}>
                    {evidence.reasoning}
                  </div>

                  {/* Primary evidence point(s) */}
                  {evidence.data_points.filter(dp => dp.tier === evidence.primary_tier).length > 0 && (
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 6 }}>
                        PRIMARY EVIDENCE
                      </div>
                      {evidence.data_points
                        .filter(dp => dp.tier === evidence.primary_tier)
                        .map((dp, i) => (
                          <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                            padding: '5px 8px',
                            background: BT.bg.header, borderRadius: 3, marginBottom: 4,
                          }}>
                            <div>
                              <SourceBadge source={dp.source} />
                              <span style={{ fontFamily: mono, fontSize: 8, color: BT.text.secondary, marginLeft: 4 }}>
                                {dp.label}
                              </span>
                              {dp.notes && (
                                <div style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted, marginTop: 2 }}>
                                  {dp.notes}
                                </div>
                              )}
                            </div>
                            <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: BT.text.amber }}>
                              {dp.value ?? '—'}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── EVIDENCE TAB ─────────────────────────────────── */}
              {activeTab === 'evidence' && (
                <div>
                  <div style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 8 }}>
                    ALL EVIDENCE SOURCES · {evidence.data_points.length} POINTS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {evidence.data_points.map((dp, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                        padding: '5px 8px', background: BT.bg.header, borderRadius: 3,
                        borderLeft: `2px solid ${TIER_COLOR[dp.tier] ?? BT.border.subtle}`,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                            <SourceBadge source={dp.source} />
                            <span style={{ fontFamily: mono, fontSize: 8, color: BT.text.secondary }}>
                              {dp.label}
                            </span>
                          </div>
                          {dp.notes && (
                            <div style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted }}>
                              {dp.notes}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: BT.text.amber }}>
                            {dp.value ?? '—'}
                          </div>
                          <div style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted }}>
                            wt {Math.round(dp.weight * 100)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── ALTERNATIVES TAB ─────────────────────────────── */}
              {activeTab === 'alternatives' && (
                <div>
                  {evidence.alternatives.length === 0 ? (
                    <div style={{ fontFamily: mono, fontSize: 9, color: BT.text.muted }}>
                      No alternative values were considered.
                    </div>
                  ) : (
                    evidence.alternatives.map((alt, i) => (
                      <div key={i} style={{
                        padding: '7px 10px', background: BT.bg.header,
                        borderRadius: 3, marginBottom: 4,
                        borderLeft: `2px solid ${BT.border.medium}`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <SourceBadge source={alt.source} />
                            <span style={{ fontFamily: mono, fontSize: 8, color: BT.text.secondary }}>{alt.label}</span>
                          </div>
                          <span style={{ fontFamily: mono, fontSize: 9, color: BT.text.muted }}>{alt.value ?? '—'}</span>
                        </div>
                        <div style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted, lineHeight: 1.5 }}>
                          Rejected: {alt.reason_rejected}
                        </div>
                        {alt.delta_pct != null && (
                          <div style={{ fontFamily: mono, fontSize: 7, color: BT.text.secondary, marginTop: 2 }}>
                            Δ {alt.delta_pct >= 0 ? '+' : ''}{(alt.delta_pct * 100).toFixed(1)}% vs agent value
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── COLLISION REPORT ─────────────────────────────── */}
              {evidence.collision && evidence.collision.magnitude !== 'minor' && (
                <div style={{
                  marginTop: 16,
                  padding: '10px 12px',
                  background: `${MAGNITUDE_COLOR[evidence.collision.magnitude]}12`,
                  border: `1px solid ${MAGNITUDE_COLOR[evidence.collision.magnitude]}44`,
                  borderRadius: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{
                      fontFamily: mono, fontSize: 7, fontWeight: 700,
                      color: MAGNITUDE_COLOR[evidence.collision.magnitude],
                      background: `${MAGNITUDE_COLOR[evidence.collision.magnitude]}18`,
                      border: `1px solid ${MAGNITUDE_COLOR[evidence.collision.magnitude]}44`,
                      borderRadius: 2, padding: '0 3px', lineHeight: '14px',
                    }}>
                      {evidence.collision.magnitude.toUpperCase()} COLLISION
                    </span>
                    {evidence.collision.delta_pct != null && (
                      <span style={{ fontFamily: mono, fontSize: 8, color: BT.text.secondary }}>
                        {evidence.collision.delta_pct >= 0 ? '+' : ''}{(evidence.collision.delta_pct * 100).toFixed(1)}% delta
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted, marginBottom: 2 }}>AGENT VALUE</div>
                      <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: BT.accent.agent }}>
                        {evidence.collision.agent_value ?? '—'}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted, marginBottom: 2 }}>BROKER OM</div>
                      <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: BT.text.orange }}>
                        {evidence.collision.broker_value ?? '—'}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontFamily: mono, fontSize: 8, color: BT.text.secondary, lineHeight: 1.6, marginBottom: 10 }}>
                    {evidence.collision.narrative}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleOverride(evidence.collision!.agent_value, 'Accepted agent value over broker OM')}
                      disabled={overriding || overrideDone}
                      style={{
                        flex: 1, background: `${BT.accent.agent}18`,
                        border: `1px solid ${BT.accent.agent}44`,
                        color: BT.accent.agent, fontFamily: mono, fontSize: 8,
                        padding: '4px 6px', borderRadius: 3, cursor: 'pointer',
                      }}
                    >
                      ACCEPT AGENT
                    </button>
                    <button
                      onClick={() => handleOverride(evidence.collision!.broker_value, 'Accepted broker OM value')}
                      disabled={overriding || overrideDone}
                      style={{
                        flex: 1, background: `${BT.text.orange}18`,
                        border: `1px solid ${BT.text.orange}44`,
                        color: BT.text.orange, fontFamily: mono, fontSize: 8,
                        padding: '4px 6px', borderRadius: 3, cursor: 'pointer',
                      }}
                    >
                      ACCEPT BROKER
                    </button>
                  </div>
                </div>
              )}

              {/* ── CUSTOM OVERRIDE ──────────────────────────────── */}
              {!overrideDone && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: BT.bg.header, borderRadius: 4 }}>
                  <div style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 8 }}>
                    CUSTOM OVERRIDE
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input
                      value={overrideValue}
                      onChange={e => setOverrideValue(e.target.value)}
                      placeholder="Custom value"
                      style={{
                        flex: 1, background: BT.bg.input, border: `1px solid ${BT.border.medium}`,
                        color: BT.text.primary, fontFamily: mono, fontSize: 9,
                        padding: '4px 8px', borderRadius: 3, outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => handleOverride(overrideValue, overrideReason || undefined)}
                      disabled={!overrideValue || overriding}
                      style={{
                        background: `${BT.accent.user}18`, border: `1px solid ${BT.accent.user}44`,
                        color: BT.accent.user, fontFamily: mono, fontSize: 8,
                        padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
                      }}
                    >
                      SET
                    </button>
                  </div>
                  <input
                    value={overrideReason}
                    onChange={e => setOverrideReason(e.target.value)}
                    placeholder="Reason (optional)"
                    style={{
                      width: '100%', background: BT.bg.input, border: `1px solid ${BT.border.subtle}`,
                      color: BT.text.secondary, fontFamily: mono, fontSize: 9,
                      padding: '4px 8px', borderRadius: 3, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
              {overrideDone && (
                <div style={{ fontFamily: mono, fontSize: 9, color: BT.text.green, marginTop: 8, padding: '6px 10px' }}>
                  ✓ Override saved. Refresh to see updated values.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 440, bottom: 0,
          background: 'rgba(0,0,0,0.3)', zIndex: 999,
        }}
      />
    </>
  );
}
