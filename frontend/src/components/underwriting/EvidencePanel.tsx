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
import { useSourceDocuments } from '../../hooks/useSourceDocuments';

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

interface ArchiveContext {
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  n_samples: number;
  as_of: string;
  archive_percentile: number | null;
  range_label: string | null;
}

interface DeltaReason {
  signal: string;
  direction: '+' | '-' | string;
  contribution_bps?: number;
  [key: string]: unknown;
}

interface CohortContext {
  cohort_baseline_p25: number | null;
  cohort_baseline_p50: number | null;
  cohort_baseline_p75: number | null;
  cohort_n: number | null;
  value_numeric: number | null;
  delta_from_cohort_p50: number | null;
  delta_reasons: DeltaReason[] | null;
  cohort_comparison_status: 'within_p25_p75' | 'above_p75' | 'below_p25' | null;
  analog_cohort_status: 'sufficient' | 'broadened' | 'insufficient' | null;
  outlier_justification: string | null;
}

interface ActiveOverride {
  value: unknown;
  overridden_at: string;
  reason: string | null;
}

export function EvidencePanel({ dealId, fieldPath, fieldLabel, onClose, onOverride }: EvidencePanelProps) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reasoning' | 'evidence' | 'alternatives'>('reasoning');
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overriding, setOverriding] = useState(false);
  const [overrideDone, setOverrideDone] = useState(false);
  const [activeOverride, setActiveOverride] = useState<ActiveOverride | null>(null);
  const [reverting, setReverting] = useState(false);
  const [archiveContext, setArchiveContext] = useState<ArchiveContext | null>(null);
  const [archiveEnabled, setArchiveEnabled] = useState(false);
  const [cohortContext, setCohortContext] = useState<CohortContext | null>(null);
  const [showOutlierJustification, setShowOutlierJustification] = useState(false);
  const { documents: sourceDocs } = useSourceDocuments(dealId);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setCohortContext(null);
    setShowOutlierJustification(false);
    fetch(`/api/v1/deals/${dealId}/assumptions/${encodeURIComponent(fieldPath)}/evidence`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => {
        if (mounted) {
          setEvidence(data.evidence ?? null);
          setActiveOverride(data.active_override ?? null);
          setArchiveContext(data.archive_context ?? null);
          setArchiveEnabled(data.archive_enabled === true);
          setCohortContext(data.cohort_context ?? null);
          setLoading(false);
        }
      })
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
      setActiveOverride({ value, overridden_at: new Date().toISOString(), reason: reason ?? null });
      onOverride?.(fieldPath, value, reason);
    } finally {
      setOverriding(false);
    }
  };

  const handleRevert = async () => {
    setReverting(true);
    try {
      await fetch(`/api/v1/deals/${dealId}/assumptions/${encodeURIComponent(fieldPath)}/override`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setActiveOverride(null);
      setOverrideDone(false);
      setOverrideValue('');
      setOverrideReason('');
    } finally {
      setReverting(false);
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

                  {/* ── SOURCE DOCUMENTS ── */}
                  {sourceDocs.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{
                        fontFamily: mono, fontSize: 7, color: BT.text.muted,
                        letterSpacing: 0.5, marginBottom: 6,
                      }}>
                        SOURCE DOCUMENTS
                      </div>
                      {sourceDocs.slice(0, 4).map(doc => (
                        <div key={doc.file_id} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '4px 8px',
                          background: BT.bg.header, borderRadius: 3, marginBottom: 3,
                        }}>
                          {/* Doc type badge */}
                          <span style={{
                            fontFamily: mono, fontSize: 6, fontWeight: 700,
                            color: BT.accent.doc,
                            background: `${BT.accent.doc}18`,
                            border: `1px solid ${BT.accent.doc}44`,
                            borderRadius: 2, padding: '0 3px', lineHeight: '14px',
                            flexShrink: 0,
                          }}>
                            {doc.document_type}
                          </span>
                          {/* Filename */}
                          <span style={{
                            fontFamily: mono, fontSize: 7, color: BT.text.secondary,
                            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {doc.filename}
                          </span>
                          {/* Extraction date */}
                          <span style={{
                            fontFamily: mono, fontSize: 6, color: BT.text.muted,
                            flexShrink: 0,
                          }}>
                            {doc.extracted_at?.slice(0, 10)}
                          </span>
                          {/* View link */}
                          <a
                            href={`/api/v1/deals/${dealId}/documents/${doc.file_id}/download`}
                            download
                            style={{
                              fontFamily: mono, fontSize: 6, fontWeight: 700,
                              color: BT.text.amber, textDecoration: 'none',
                              cursor: 'pointer', flexShrink: 0,
                              border: `1px solid ${BT.text.amber}44`,
                              borderRadius: 2, padding: '0 4px', lineHeight: '14px',
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            ↓ VIEW
                          </a>
                        </div>
                      ))}
                      {sourceDocs.length > 4 && (
                        <div style={{
                          fontFamily: mono, fontSize: 7, color: BT.text.muted,
                          textAlign: 'center', padding: '3px 0',
                        }}>
                          +{sourceDocs.length - 4} more documents
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── COHORT BASELINE — shown when v3.0 agent provided analog cohort data ── */}
                  {cohortContext && cohortContext.cohort_baseline_p50 !== null && (
                    <div style={{
                      marginTop: 16,
                      padding: '10px 12px',
                      background: `${BT.text.purple}10`,
                      border: `1px solid ${BT.text.purple}33`,
                      borderRadius: 4,
                    }}>
                      {/* Section header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.purple, letterSpacing: 0.5 }}>
                          ANALOG COHORT BASELINE
                        </span>
                        {cohortContext.cohort_n !== null && (
                          <span style={{
                            fontFamily: mono, fontSize: 7,
                            color: BT.text.purple,
                            background: `${BT.text.purple}22`,
                            border: `1px solid ${BT.text.purple}44`,
                            borderRadius: 2, padding: '0 4px', lineHeight: '14px',
                          }}>
                            n={cohortContext.cohort_n}
                          </span>
                        )}
                        {/* Outlier badge */}
                        {(cohortContext.cohort_comparison_status === 'above_p75' ||
                          cohortContext.cohort_comparison_status === 'below_p25') && (
                          <button
                            onClick={() => setShowOutlierJustification(v => !v)}
                            style={{
                              fontFamily: mono, fontSize: 7, fontWeight: 700,
                              color: BT.text.amber,
                              background: `${BT.text.amber}18`,
                              border: `1px solid ${BT.text.amber}55`,
                              borderRadius: 2, padding: '0 5px', lineHeight: '14px',
                              cursor: cohortContext.outlier_justification ? 'pointer' : 'default',
                            }}
                          >
                            {cohortContext.cohort_comparison_status === 'above_p75' ? '▲ ABOVE P75' : '▼ BELOW P25'}
                            {cohortContext.outlier_justification && (
                              <span style={{ marginLeft: 3 }}>{showOutlierJustification ? '▲' : '▼'}</span>
                            )}
                          </button>
                        )}
                        {/* Broadened cohort indicator */}
                        {cohortContext.analog_cohort_status === 'broadened' && (
                          <span style={{
                            fontFamily: mono, fontSize: 7,
                            color: BT.text.secondary,
                            border: `1px solid ${BT.border.medium}`,
                            borderRadius: 2, padding: '0 4px', lineHeight: '14px',
                          }}>
                            BROADENED
                          </span>
                        )}
                      </div>

                      {/* Sparse cohort warning */}
                      {cohortContext.analog_cohort_status === 'insufficient' && (
                        <div style={{
                          marginBottom: 8, padding: '5px 8px',
                          background: `${BT.text.amber}10`,
                          border: `1px solid ${BT.text.amber}33`,
                          borderRadius: 3,
                          fontFamily: mono, fontSize: 8, color: BT.text.amber,
                        }}>
                          SPARSE COHORT DATA — insufficient analog deals found; baseline is indicative only
                        </div>
                      )}

                      {/* Outlier justification expandable */}
                      {showOutlierJustification && cohortContext.outlier_justification && (
                        <div style={{
                          marginBottom: 8, padding: '6px 8px',
                          background: `${BT.text.amber}08`,
                          border: `1px solid ${BT.text.amber}33`,
                          borderRadius: 3,
                          fontFamily: mono, fontSize: 8, color: BT.text.secondary,
                          lineHeight: 1.6,
                        }}>
                          {cohortContext.outlier_justification}
                        </div>
                      )}

                      {/* P25–P50–P75 distribution bar */}
                      {cohortContext.cohort_baseline_p25 !== null && cohortContext.cohort_baseline_p75 !== null && (
                        (() => {
                          const p25 = cohortContext.cohort_baseline_p25!;
                          const p50 = cohortContext.cohort_baseline_p50!;
                          const p75 = cohortContext.cohort_baseline_p75!;
                          const range = p75 - p25;
                          const fmtPct = (v: number) => (v * 100).toFixed(2) + '%';
                          // P50 position within bar (0–100% of P25–P75 range)
                          const p50Pct = range > 0 ? Math.round(((p50 - p25) / range) * 100) : 50;
                          // Subject value marker (clamped -12% to 112% to stay on-bar with slight bleed)
                          const subjectVal = cohortContext.value_numeric;
                          const subjectPct = (subjectVal !== null && range > 0)
                            ? Math.max(-12, Math.min(112, ((subjectVal - p25) / range) * 100))
                            : null;
                          const isOutside = subjectPct !== null && (subjectPct < 0 || subjectPct > 100);
                          return (
                            <div style={{ marginBottom: 10 }}>
                              {/* Label row */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted }}>P25</span>
                                <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted }}>P50</span>
                                <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted }}>P75</span>
                              </div>
                              {/* Bar track */}
                              <div style={{
                                position: 'relative', height: 6,
                                background: BT.bg.header, borderRadius: 3,
                                overflow: 'visible',
                              }}>
                                {/* Filled band (P25 to P75 = full width of bar) */}
                                <div style={{
                                  position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                                  background: `${BT.text.purple}33`, borderRadius: 3,
                                }} />
                                {/* P50 spine */}
                                <div style={{
                                  position: 'absolute',
                                  left: `${p50Pct}%`,
                                  top: -2, width: 2, bottom: -2,
                                  background: BT.text.purple,
                                  transform: 'translateX(-50%)',
                                }} />
                                {/* Subject value marker */}
                                {subjectPct !== null && (
                                  <div
                                    title={`Projection: ${fmtPct(subjectVal!)}${isOutside ? ' (outside P25–P75)' : ''}`}
                                    style={{
                                      position: 'absolute',
                                      left: `${subjectPct}%`,
                                      top: -4, width: 3, height: 14,
                                      background: isOutside ? BT.text.amber : '#10b981',
                                      borderRadius: 1,
                                      transform: 'translateX(-50%)',
                                    }}
                                  />
                                )}
                              </div>
                              {/* Value labels */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                <span style={{ fontFamily: mono, fontSize: 8, color: BT.text.secondary }}>{fmtPct(p25)}</span>
                                <span style={{ fontFamily: mono, fontSize: 8, color: BT.text.purple }}>{fmtPct(p50)}</span>
                                <span style={{ fontFamily: mono, fontSize: 8, color: BT.text.secondary }}>{fmtPct(p75)}</span>
                              </div>
                              {/* Subject value annotation */}
                              {subjectVal !== null && (
                                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{
                                    width: 3, height: 8,
                                    background: isOutside ? BT.text.amber : '#10b981',
                                    borderRadius: 1, flexShrink: 0,
                                  }} />
                                  <span style={{ fontFamily: mono, fontSize: 8, color: isOutside ? BT.text.amber : '#10b981' }}>
                                    PROJECTION: {fmtPct(subjectVal)}
                                    {cohortContext.delta_from_cohort_p50 !== null && (
                                      <span style={{ color: BT.text.muted, fontWeight: 400, marginLeft: 4 }}>
                                        ({cohortContext.delta_from_cohort_p50 >= 0 ? '+' : ''}{(cohortContext.delta_from_cohort_p50 * 10000).toFixed(0)} bps vs P50)
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()
                      )}

                      {/* Delta reasons */}
                      {cohortContext.delta_reasons && cohortContext.delta_reasons.length > 0 && (
                        <div>
                          <div style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 4 }}>
                            SIGNAL-DRIVEN DELTAS
                          </div>
                          {cohortContext.delta_reasons.map((dr, i) => (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '3px 6px',
                              background: BT.bg.header, borderRadius: 2, marginBottom: 2,
                            }}>
                              <span style={{
                                fontFamily: mono, fontSize: 7, fontWeight: 700,
                                color: dr.direction === '+' ? '#10b981' : BT.text.red,
                                flexShrink: 0,
                              }}>
                                {dr.direction === '+' ? '▲' : '▼'}
                              </span>
                              <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.secondary, flex: 1 }}>
                                {dr.signal}
                              </span>
                              {dr.contribution_bps !== undefined && (
                                <span style={{
                                  fontFamily: mono, fontSize: 7,
                                  color: dr.contribution_bps > 0 ? '#10b981' : BT.text.red,
                                  flexShrink: 0,
                                }}>
                                  {dr.contribution_bps > 0 ? '+' : ''}{dr.contribution_bps} bps
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
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

                  {/* ── ARCHIVE CONTEXT — only shown for Operator+ tier ──────── */}
                  {archiveEnabled && archiveContext && (
                    <div style={{
                      marginTop: 16, padding: '10px 12px',
                      background: `${BT.text.purple}10`,
                      border: `1px solid ${BT.text.purple}33`, borderRadius: 4,
                    }}>
                      <div style={{ fontFamily: mono, fontSize: 7, color: BT.text.purple, letterSpacing: 0.5, marginBottom: 8 }}>
                        ARCHIVE CONTEXT · {archiveContext.n_samples} DEALS · as of {String(archiveContext.as_of).slice(0, 10)}
                      </div>

                      {/* P10–P90 range bar */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted }}>P10</span>
                          <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted }}>P50</span>
                          <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted }}>P90</span>
                        </div>
                        <div style={{
                          position: 'relative', height: 6, background: BT.bg.header, borderRadius: 3, overflow: 'visible',
                        }}>
                          {/* Filled bar from P25 to P75 */}
                          <div style={{
                            position: 'absolute', left: '25%', width: '50%', top: 0, bottom: 0,
                            background: `${BT.text.purple}44`, borderRadius: 2,
                          }} />
                          {/* P50 marker */}
                          <div style={{
                            position: 'absolute', left: '50%', top: -2, width: 2, bottom: -2,
                            background: BT.text.purple, transform: 'translateX(-50%)',
                          }} />
                          {/* Current value marker */}
                          {archiveContext.archive_percentile !== null && (
                            <div style={{
                              position: 'absolute',
                              left: `${archiveContext.archive_percentile}%`,
                              top: -4, width: 3, height: 14,
                              background: BT.text.amber,
                              borderRadius: 1,
                              transform: 'translateX(-50%)',
                            }}
                              title={`This assumption: ${archiveContext.archive_percentile}th percentile`}
                            />
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          {[
                            { label: 'P10', v: archiveContext.p10 },
                            { label: 'P50', v: archiveContext.p50 },
                            { label: 'P90', v: archiveContext.p90 },
                          ].map(({ label, v }) => (
                            <span key={label} style={{ fontFamily: mono, fontSize: 8, color: BT.text.secondary }}>
                              {v !== null ? v.toFixed(3) : '—'}
                            </span>
                          ))}
                        </div>
                      </div>

                      {archiveContext.archive_percentile !== null && (
                        <div style={{
                          fontFamily: mono, fontSize: 8, color: BT.text.amber, fontWeight: 700,
                        }}>
                          {archiveContext.archive_percentile}th percentile
                          {archiveContext.range_label && (
                            <span style={{ color: BT.text.muted, fontWeight: 400, marginLeft: 4 }}>
                              — {archiveContext.range_label}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Accumulating message — only for Operator+ tier without enough data */}
                  {archiveEnabled && !archiveContext && (
                    <div style={{
                      marginTop: 16, padding: '8px 10px',
                      background: BT.bg.header, borderRadius: 3,
                      fontFamily: mono, fontSize: 8, color: BT.text.muted,
                    }}>
                      ARCHIVE CONTEXT: Accumulating — will appear after 5+ comparable deals have been underwritten.
                    </div>
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

              {/* ── ACTIVE OVERRIDE BANNER + REVERT ─────────────── */}
              {activeOverride && (
                <div style={{
                  marginTop: 12, padding: '10px 12px',
                  background: `${BT.text.amber}12`,
                  border: `1px solid ${BT.text.amber}44`, borderRadius: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.amber, letterSpacing: 0.5 }}>
                      ACTIVE OVERRIDE
                    </span>
                    <button
                      onClick={handleRevert}
                      disabled={reverting}
                      style={{
                        background: 'none', border: `1px solid ${BT.border.medium}`,
                        color: BT.text.secondary, fontFamily: mono, fontSize: 7,
                        padding: '2px 8px', borderRadius: 3, cursor: reverting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {reverting ? 'REVERTING…' : 'REVERT TO AGENT'}
                    </button>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: BT.text.primary }}>
                    Value: <strong>{String(activeOverride.value)}</strong>
                    {activeOverride.reason && (
                      <span style={{ color: BT.text.muted, marginLeft: 6 }}>— {activeOverride.reason}</span>
                    )}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted, marginTop: 2 }}>
                    Set {new Date(activeOverride.overridden_at).toLocaleString()}
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
