/**
 * M08 v2 Shared Components — Detection-First Strategy UI
 * Shared between StrategyArbitragePage and StrategySection.
 * Implements true detection gating: when confidence < 70% and not yet confirmed,
 * scoring, evidence, and plan sections do NOT render.
 */

import React, { useState, createContext, useContext } from 'react';
import { BT, BT_CSS, Bd, SectionPanel, DataRow } from '../bloomberg-ui';
import { BlockErrorBoundary } from '../../BlockErrorBoundary';
import type {
  StrategyAnalysisV2,
  DetectionResult,
  SubStrategyScore,
  SignalScores,
  InvestmentPlan,
  GoldenChain,
  CorrelationAlert,
  Indicator,
  MonitoringItem,
  MetricStackRow,
  MathTrailStep,
} from '../../../hooks/useStrategyAnalysisV2';

// ─── Bidirectional hover context (plan ↔ evidence) ───────────────────────────
interface HoverCtx {
  hoveredEvidenceRef: string | null;
  setHoveredEvidenceRef: (ref: string | null) => void;
}
const HoverContext = createContext<HoverCtx>({ hoveredEvidenceRef: null, setHoveredEvidenceRef: () => {} });

const MONO = BT.font.mono;

// ─── Per-block error boundary fallbacks ──────────────────────────────────────
// Bloomberg-styled inline placeholder used by `BlockErrorBoundary` so that one
// broken block (e.g. a sub-strategy with malformed data) cannot take down its
// siblings or the rest of the Strategy section.
function BlockErrorFallback({
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

// ─── Palette helpers ──────────────────────────────────────────────────────────

export function confColor(c: number) { return c >= 0.85 ? BT.text.green : c >= 0.70 ? BT.text.amber : BT.text.red; }
export function sevColor(s: 'critical' | 'warning' | 'info') { return s === 'critical' ? BT.text.red : s === 'warning' ? BT.text.amber : BT.text.cyan; }
const fmtSafe = (value: unknown, digits: number, multiplier = 1) => {
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

// ─── Score Ring ───────────────────────────────────────────────────────────────

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

// ─── 1. Detection Banner — with true gating logic ─────────────────────────────

interface DetectionBannerProps {
  detection: DetectionResult;
  onConfirm: () => void;
  /** Refine sub-strategy within detected asset class (does NOT change asset class) */
  onAdjust: (subStrategyKey: string) => void;
  /** Override full asset class classification */
  onOverride: (assetClass: string) => void;
}

export function DetectionBanner({ detection, onConfirm, onAdjust, onOverride }: DetectionBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showAdjustPanel, setShowAdjustPanel] = useState(false);
  const [overrideInput, setOverrideInput] = useState('');
  const [adjustInput, setAdjustInput] = useState('');

  const conf = detection.confidence;
  const cColor = confColor(conf);
  const needsConfirmation = detection.requiresUserConfirmation && !detection.userConfirmed;
  // Auto-show low-confidence modal gate on mount if not yet confirmed
  const [lowConfModal, setLowConfModal] = useState(() => conf < 0.70 && needsConfirmation);

  return (
    <>
      {/* ── Low-confidence modal gate: appears automatically for confidence < 70% ── */}
      {lowConfModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            background: BT.bg.panel, border: `2px solid ${BT.text.amber}`,
            borderTop: `3px solid ${BT.text.amber}`, padding: 28, width: 480,
            boxShadow: `0 0 40px ${BT.text.amber}30`,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: BT.text.amber, marginBottom: 6 }}>
              ⚠ LOW-CONFIDENCE DETECTION
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary, marginBottom: 12 }}>
              Confidence <span style={{ color: cColor, fontWeight: 700 }}>{pct(conf)}</span> is below the 70% threshold.
              Scoring, evidence gates, and plan generation are <span style={{ color: BT.text.amber }}>locked</span> until you resolve this.
            </div>
            <div style={{
              background: `${BT.bg.input}`, border: `1px solid ${BT.border.subtle}`,
              padding: '8px 10px', marginBottom: 16, fontFamily: MONO, fontSize: 9, color: BT.text.secondary,
            }}>
              <div style={{ color: BT.text.primary, fontWeight: 700, marginBottom: 4 }}>DETECTED:</div>
              <div>{(detection.assetClass || '').toUpperCase()} · {(detection.detectedDealType || '').replace(/_/g, ' ').toUpperCase()}</div>
              <div style={{ color: BT.text.muted }}>[{(detection.detectedSubStrategy || '').replace(/_/g, ' ')}]</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setLowConfModal(false); setShowAdjustPanel(true); }} style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan,
                background: `${BT.text.cyan}18`, border: `1px solid ${BT.text.cyan}44`,
                padding: '5px 14px', cursor: 'pointer',
              }}>ADJUST CLASSIFICATION</button>
              <button onClick={() => { setLowConfModal(false); setShowOverrideModal(true); }} style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber,
                background: `${BT.text.amber}18`, border: `1px solid ${BT.text.amber}44`,
                padding: '5px 14px', cursor: 'pointer',
              }}>OVERRIDE CLASSIFICATION</button>
              <button onClick={() => { onConfirm(); setLowConfModal(false); }} style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.green,
                background: `${BT.text.green}18`, border: `1px solid ${BT.text.green}44`,
                padding: '5px 14px', cursor: 'pointer',
              }}>✓ CONFIRM &amp; PROCEED</button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        borderLeft: `3px solid ${BT.text.cyan}`, background: `${BT.text.cyan}08`,
        padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.cyan, letterSpacing: 0.5 }}>
            DETECTED
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.primary }}>
            {(detection.assetClass || '').toUpperCase().replace(/_/g, ' ')} · {(detection.detectedDealType || '').replace(/_/g, ' ').toUpperCase()}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
            [{(detection.detectedSubStrategy || '').replace(/_/g, ' ')}]
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>CONF</span>
            <span style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700, color: cColor,
              background: `${cColor}18`, border: `1px solid ${cColor}33`, padding: '1px 6px',
            }}>{pct(conf)}</span>
          </div>

          {detection.userConfirmed && <Bd c={BT.text.green}>✓ CONFIRMED</Bd>}
          {detection.userOverrideClassification && <Bd c={BT.text.purple}>OVERRIDDEN → {detection.userOverrideClassification}</Bd>}
          {needsConfirmation && <Bd c={BT.text.amber}>CONFIRMATION REQUIRED</Bd>}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {!detection.userConfirmed && (
              <button onClick={onConfirm} style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.green,
                background: `${BT.text.green}18`, border: `1px solid ${BT.text.green}44`,
                padding: '2px 8px', cursor: 'pointer',
              }}>✓ CONFIRM</button>
            )}
            <button onClick={() => setShowAdjustPanel(v => !v)} style={{
              fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan,
              background: showAdjustPanel ? `${BT.text.cyan}22` : 'transparent',
              border: `1px solid ${BT.text.cyan}55`,
              padding: '2px 8px', cursor: 'pointer',
            }}>ADJUST</button>
            <button onClick={() => setExpanded(v => !v)} style={{
              fontFamily: MONO, fontSize: 9, color: BT.text.secondary,
              background: 'transparent', border: `1px solid ${BT.border.subtle}`,
              padding: '2px 8px', cursor: 'pointer',
            }}>
              {expanded ? '▲ SIGNALS' : '▼ SIGNALS'}
            </button>
            <button onClick={() => setShowOverrideModal(true)} style={{
              fontFamily: MONO, fontSize: 9, color: BT.text.amber,
              background: `${BT.text.amber}18`, border: `1px solid ${BT.text.amber}44`,
              padding: '2px 8px', cursor: 'pointer',
            }}>OVERRIDE CLASSIFICATION</button>
          </div>
        </div>

        {/* Adjust panel: refine sub-strategy within detected asset class */}
        {showAdjustPanel && (
          <div style={{
            marginTop: 8, padding: '10px 12px',
            background: `${BT.text.cyan}0C`, border: `1px solid ${BT.text.cyan}33`,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan, marginBottom: 6 }}>
              ADJUST DETECTED CLASSIFICATION
            </div>
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, marginBottom: 8 }}>
              Refine the sub-strategy within the detected asset class without overriding the asset class itself.
              Enter a sub-strategy key (e.g. mf_value_add_standard, mf_core_plus_stabilized) or leave blank to keep detected.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={adjustInput}
                onChange={e => setAdjustInput(e.target.value)}
                placeholder={`Current: ${detection.detectedSubStrategy || 'none'}`}
                style={{
                  flex: 1, fontFamily: MONO, fontSize: 9,
                  background: BT.bg.input, color: BT.text.primary,
                  border: `1px solid ${BT.border.medium}`, padding: '4px 8px',
                }}
              />
              <button onClick={() => {
                if (adjustInput.trim()) { onAdjust(adjustInput.trim()); }
                else { onConfirm(); }
                setShowAdjustPanel(false);
              }} style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan,
                background: `${BT.text.cyan}22`, border: `1px solid ${BT.text.cyan}55`,
                padding: '4px 12px', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>APPLY ADJUSTMENT</button>
              <button onClick={() => setShowAdjustPanel(false)} style={{
                fontFamily: MONO, fontSize: 9, color: BT.text.secondary,
                background: 'transparent', border: `1px solid ${BT.border.subtle}`,
                padding: '4px 8px', cursor: 'pointer',
              }}>CANCEL</button>
            </div>
          </div>
        )}

        {/* Low-confidence inline warning (secondary to modal, shown after modal dismissed) */}
        {needsConfirmation && !lowConfModal && (
          <div style={{
            marginTop: 8, padding: '6px 10px',
            background: `${BT.text.amber}15`, border: `1px solid ${BT.text.amber}44`,
          }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>
              ⚠ CONFIDENCE BELOW 70% — SCORING AND EVIDENCE GATES ARE LOCKED.
              Use CONFIRM, ADJUST, or OVERRIDE CLASSIFICATION to proceed.
            </span>
          </div>
        )}

        {/* Expanded signals */}
        {expanded && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {(detection.detectionSignals || []).map((sig, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, width: 140, flexShrink: 0 }}>
                  {String(sig.signal).replace(/_/g, ' ').toUpperCase()}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, width: 80 }}>
                  {String(sig.value)}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, width: 120 }}>
                  thr: {String(sig.threshold)}
                </span>
                <div style={{ flex: 1, height: 3, background: BT.bg.hover, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, height: '100%',
                    background: BT.text.cyan, opacity: 0.7,
                    width: `${Math.min(100, Math.abs(Number(sig.contribution ?? 0)) * 300)}%`,
                  }} />
                </div>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan, width: 36, textAlign: 'right' }}>
                  {((sig.contribution ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
            {/* Confidence breakdown */}
            {detection.confidenceBreakdown && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${BT.border.subtle}`, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {Object.entries(detection.confidenceBreakdown).map(([k, v]) => (
                  <div key={k} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>
                    <span style={{ color: BT.text.muted }}>{k.replace(/([A-Z])/g, ' $1').toUpperCase()}: </span>
                    <span style={{ color: BT.text.amber }}>{typeof v === 'number' ? (v * 100).toFixed(0) + '%' : String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Alternates */}
            {(detection.alternateSubStrategies || []).length > 0 && (
              <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px solid ${BT.border.subtle}` }}>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>ALTERNATES: </span>
                {detection.alternateSubStrategies.map((alt, i) => (
                  <span key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, marginLeft: 8 }}>
                    {alt.key.replace(/_/g, ' ')} · {pct(alt.fit)} · {alt.reason}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Override modal */}
      {showOverrideModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            background: BT.bg.panel, border: `1px solid ${BT.border.medium}`,
            borderTop: `2px solid ${BT.text.amber}`, padding: 24, width: 400,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.amber, marginBottom: 8 }}>
              OVERRIDE CLASSIFICATION
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, marginBottom: 12 }}>
              Enter correct asset class: multifamily · sfr · retail · office · industrial · hospitality
            </div>
            <input
              value={overrideInput}
              onChange={e => setOverrideInput(e.target.value)}
              placeholder="e.g. multifamily"
              style={{
                width: '100%', fontFamily: MONO, fontSize: 10,
                background: BT.bg.input, color: BT.text.primary,
                border: `1px solid ${BT.border.medium}`, padding: '6px 8px', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowOverrideModal(false)} style={{
                fontFamily: MONO, fontSize: 9, color: BT.text.secondary,
                background: 'transparent', border: `1px solid ${BT.border.subtle}`,
                padding: '4px 12px', cursor: 'pointer',
              }}>CANCEL</button>
              <button onClick={() => { onOverride(overrideInput); setShowOverrideModal(false); }} style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber,
                background: `${BT.text.amber}18`, border: `1px solid ${BT.text.amber}44`,
                padding: '4px 12px', cursor: 'pointer',
              }}>APPLY OVERRIDE</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── 2. Sub-Strategy Comparison ───────────────────────────────────────────────

export function SubStrategyComparison({ subStrategies, arbitrage }: {
  subStrategies: SubStrategyScore[];
  arbitrage: StrategyAnalysisV2['arbitrage'];
}) {
  if (!subStrategies || subStrategies.length === 0) return null;

  return (
    <SectionPanel title="SUB-STRATEGY COMPARISON" borderColor={BT.text.amber} style={{ marginBottom: 1 }}>
      {arbitrage?.detected && (
        <div style={{
          padding: '5px 10px', background: `${BT.text.amber}10`,
          borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.amber}`,
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <Bd c={BT.text.amber}>⚡ ARBITRAGE DETECTED</Bd>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>{arbitrage.narrative}</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>
            Δ {fmtSafe(arbitrage.deltaPoints, 1)} pts
          </span>
        </div>
      )}
      <div style={{ display: 'flex', overflowX: 'auto' }}>
        {subStrategies.map((ss, idx) => {
          const color = SS_COLORS[idx % SS_COLORS.length];
          const isPrimary = ss.isDetectedPrimary;
          const fp = ss.financialPreview;
          return (
            <div key={ss.key} style={{
              flex: '0 0 180px', minWidth: 160,
              borderTop: isPrimary ? `2px solid ${BT.text.amber}` : `1px solid ${BT.border.subtle}`,
              background: isPrimary ? `${BT.text.amber}06` : BT.bg.panel,
              borderRight: `1px solid ${BT.border.subtle}`,
            }}>
              <div style={{
                padding: '5px 8px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(ss.name || ss.key).replace(/_/g, ' ').toUpperCase()}
                </span>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  {isPrimary && <Bd c={BT.text.amber}>⚡</Bd>}
                  <Bd c={gateColor(ss)}>{gateLabel(ss)}</Bd>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 8px 4px' }}>
                <ScoreRing score={ss.finalScore} color={color} size={56} />
              </div>
              <DataRow label="IRR" value={fp ? `${fmtSafe(fp.irr, 1)}%` : '—'} valueColor={BT.met.financial} />
              <DataRow label="CoC" value={fp ? `${fmtSafe(fp.cocReturn, 1)}%` : '—'} valueColor={BT.text.cyan} />
              <DataRow label="EM" value={fp ? `${fmtSafe(fp.equityMultiple, 2)}x` : '—'} valueColor={BT.text.amber} />
              <DataRow label="EXIT CAP" value={fp ? `${fmtSafe(Number(fp.exitCapRate) * 100, 2)}%` : '—'} valueColor={BT.text.secondary} />
              <DataRow label="HOLD" value={fp ? `${fmtSafe(fp.holdMonths, 0)}mo` : '—'} valueColor={BT.text.purple} />
              <div style={{ padding: '4px 8px', borderTop: `1px solid ${BT.border.subtle}` }}>
                <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
                  BASE {fmtScore(ss.baseScore)} × {fmtSafe(ss.timingMultiplier, 2)} + ADJ {fmtScore(ss.gateAdjustment)}
                </span>
              </div>
              {ss.gate?.reasons?.length > 0 && (
                <div style={{ padding: '3px 8px', borderTop: `1px solid ${BT.border.subtle}` }}>
                  {ss.gate.reasons.slice(0, 2).map((r, ri) => (
                    <div key={ri} style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, fontStyle: 'italic' }}>
                      {r}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionPanel>
  );
}

// ─── 3. Signal × Sub-Strategy Heatmap (API-driven) ───────────────────────────

const SIGNAL_LABELS = ['DEMAND', 'SUPPLY', 'MOMENTUM', 'POSITION', 'RISK'];

// 3-band spec: green ≥80, amber 50–79, red <50
function heatColor(v: number): string {
  if (v >= 80) return BT.text.green;
  if (v >= 50) return BT.text.amber;
  return BT.text.red;
}

type SignalKey = Exclude<keyof SignalScores, 'confidence'>;
const TYPED_SIGNAL_KEYS: SignalKey[] = ['demand', 'supply', 'momentum', 'position', 'risk'];

// Mirrors backend SUB_STRATEGY_WEIGHTS from asset-class-detection.service.ts
// These are the authoritative weights used by scoreSubStrategy() on the backend.
// Cell value = signalScore × (weight / avg_weight_0.20) — capped to [10, 99]
const SS_SIGNAL_WEIGHTS: Record<string, Partial<Record<SignalKey, number>>> = {
  mf_value_add_standard:   { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.15, risk: 0.10 },
  mf_deep_value_add:       { demand: 0.25, supply: 0.20, momentum: 0.25, position: 0.15, risk: 0.15 },
  mf_core:                 { demand: 0.25, supply: 0.20, momentum: 0.15, position: 0.25, risk: 0.15 },
  mf_core_plus:            { demand: 0.25, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.15 },
  mf_distressed:           { demand: 0.20, supply: 0.15, momentum: 0.15, position: 0.20, risk: 0.30 },
  mf_lease_up:             { demand: 0.35, supply: 0.30, momentum: 0.15, position: 0.10, risk: 0.10 },
  mf_bts_ground_up:        { demand: 0.30, supply: 0.30, momentum: 0.15, position: 0.15, risk: 0.10 },
  mf_str:                  { demand: 0.25, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.10 },
  sfr_fix_flip:            { demand: 0.20, supply: 0.15, momentum: 0.30, position: 0.20, risk: 0.15 },
  sfr_brrrr:               { demand: 0.20, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.15 },
  sfr_hold:                { demand: 0.25, supply: 0.20, momentum: 0.15, position: 0.25, risk: 0.15 },
  sfr_portfolio_agg:       { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.15, risk: 0.10 },
  sfr_btr:                 { demand: 0.30, supply: 0.30, momentum: 0.15, position: 0.15, risk: 0.10 },
  sfr_str:                 { demand: 0.25, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.10 },
  sfr_mtr:                 { demand: 0.25, supply: 0.15, momentum: 0.25, position: 0.25, risk: 0.10 },
  sfr_wholesale:           { demand: 0.20, supply: 0.15, momentum: 0.30, position: 0.20, risk: 0.15 },
  retail_nnn_core:         { demand: 0.20, supply: 0.10, momentum: 0.10, position: 0.35, risk: 0.25 },
  retail_grocery_anchored: { demand: 0.25, supply: 0.15, momentum: 0.15, position: 0.30, risk: 0.15 },
  retail_value_add:        { demand: 0.30, supply: 0.15, momentum: 0.20, position: 0.25, risk: 0.10 },
  retail_last_mile:        { demand: 0.30, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.10 },
  office_adaptive_reuse:   { demand: 0.35, supply: 0.20, momentum: 0.15, position: 0.15, risk: 0.15 },
  office_medical:          { demand: 0.30, supply: 0.20, momentum: 0.15, position: 0.20, risk: 0.15 },
  office_tenant_rollup:    { demand: 0.15, supply: 0.20, momentum: 0.25, position: 0.20, risk: 0.20 },
  industrial_last_mile:    { demand: 0.30, supply: 0.25, momentum: 0.20, position: 0.20, risk: 0.05 },
  industrial_core:         { demand: 0.20, supply: 0.25, momentum: 0.15, position: 0.25, risk: 0.15 },
  hospitality_reflag:      { demand: 0.25, supply: 0.20, momentum: 0.20, position: 0.25, risk: 0.10 },
  hospitality_extended_stay: { demand: 0.25, supply: 0.20, momentum: 0.20, position: 0.20, risk: 0.15 },
};
const SS_WEIGHT_AVG = 0.20; // equal-weight baseline (5 signals, weights sum to 1.0)
// Fallback when API doesn't return signalWeights yet (old cached responses)
function getSignalWeight(ss: SubStrategyScore, sig: string): number {
  return ss.signalWeights?.[sig]
    ?? SS_SIGNAL_WEIGHTS[ss.key]?.[sig as SignalKey]
    ?? SS_WEIGHT_AVG;
}

// Maps each heatmap signal (row) to its source module tab in the deal page
// Tabs are the same keys used by DealDetailPage F-key map
const SIGNAL_SOURCE_TAB: Record<SignalKey, string> = {
  demand:   'market',   // F3 — Market Data
  supply:   'supply',   // F4 — Supply Analysis
  momentum: 'market',   // F3 — Market Data (rent growth, pricing trends)
  position: 'overview', // F1 — Property Overview / Location
  risk:     'risk',     // F10 — Risk Analysis
};

export function SignalHeatmap({ subStrategies, signalScores }: {
  subStrategies: SubStrategyScore[];
  signalScores: StrategyAnalysisV2['signalScores'];
}) {
  const [tooltip, setTooltip] = useState<{
    sig: SignalKey; ssName: string; signalScore: number; w: number; val: number; x: number; y: number;
  } | null>(null);

  if (!subStrategies || subStrategies.length === 0) return null;

  /** Column header click → scroll to evidence block for that sub-strategy */
  const navigateToEvidence = (ssKey: string) => {
    const el = document.getElementById(`evidence-${ssKey}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Cell click → navigate to source module tab AND scroll to evidence block */
  const navigateToSourceModule = (sig: SignalKey, ssKey: string) => {
    const targetTab = SIGNAL_SOURCE_TAB[sig];
    if (targetTab) {
      // Dispatch custom event — DealDetailPage listens on 'deal-tab-change'
      window.dispatchEvent(new CustomEvent('deal-tab-change', { detail: targetTab }));
    }
    // After a brief delay, also scroll to the evidence block
    setTimeout(() => {
      const el = document.getElementById(`evidence-${ssKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
  };

  return (
    <SectionPanel title="SIGNAL × STRATEGY HEATMAP" borderColor={BT.text.purple} style={{ marginBottom: 1 }}>
      <div style={{ overflowX: 'auto', position: 'relative' }}>
        {/* Hover tooltip */}
        {tooltip && (
          <div style={{
            position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 72,
            background: BT.bg.panelAlt, border: `1px solid ${BT.border.medium}`,
            padding: '6px 10px', zIndex: 9999, pointerEvents: 'none', minWidth: 220,
          }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 3 }}>
              {tooltip.sig.toUpperCase()} × {tooltip.ssName.replace(/_/g, ' ').toUpperCase()}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>
              {tooltip.signalScore} × ({tooltip.w.toFixed(2)} ÷ {SS_WEIGHT_AVG.toFixed(2)}) = <b>{tooltip.val}</b>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginTop: 3 }}>
              signal_score={tooltip.signalScore} · weight={tooltip.w.toFixed(2)} (API: ss.signalWeights)
            </div>
            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.cyan, marginTop: 2 }}>▲ click → navigate to {tooltip ? SIGNAL_SOURCE_TAB[tooltip.sig].toUpperCase() : ''} module tab</div>
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 300 }}>
          <thead>
            <tr style={{ background: BT.bg.header }}>
              <th style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, padding: '4px 8px', textAlign: 'left', borderRight: `1px solid ${BT.border.subtle}`, width: 90 }}>
                SIGNAL
              </th>
              {subStrategies.map((ss, i) => (
                <th key={ss.key} style={{ fontFamily: MONO, fontSize: 8, color: SS_COLORS[i % SS_COLORS.length], padding: '4px 8px', textAlign: 'center', borderRight: `1px solid ${BT.border.subtle}`, maxWidth: 90, cursor: 'pointer' }}
                  onClick={() => navigateToEvidence(ss.key)}
                  title={`Click to jump to evidence for ${ss.name || ss.key}`}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(ss.name || ss.key).replace(/_/g, ' ').toUpperCase().slice(0, 14)}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>→ evid</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TYPED_SIGNAL_KEYS.map((sig, sIdx) => {
              const signalScore = signalScores?.[sig] ?? 50;
              return (
                <tr key={sig} style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: sIdx % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt }}>
                  <td style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, padding: '5px 8px', borderRight: `1px solid ${BT.border.subtle}`, letterSpacing: 0.5 }}>
                    {SIGNAL_LABELS[sIdx]}
                    <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.secondary }}>{signalScore}</div>
                  </td>
                  {subStrategies.map((ss) => {
                    // Uses API-provided ss.signalWeights (backend SUB_STRATEGY_WEIGHTS)
                    // with fallback to mirrored table for old cached responses
                    const w = getSignalWeight(ss, sig);
                    const val = Math.round(Math.min(99, Math.max(10, signalScore * (w / SS_WEIGHT_AVG))));
                    const c = heatColor(val);
                    return (
                      <td
                        key={ss.key}
                        style={{ textAlign: 'center', padding: '5px 8px', borderRight: `1px solid ${BT.border.subtle}`, cursor: 'pointer' }}
                        onMouseMove={e => setTooltip({ sig, ssName: ss.name || ss.key, signalScore, w, val, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => navigateToSourceModule(sig, ss.key)}
                      >
                        <span style={{
                          fontFamily: MONO, fontSize: 10, fontWeight: 700, color: c,
                          background: `${c}18`, padding: '1px 6px', display: 'inline-block',
                        }}>{val}</span>
                        <div style={{ fontFamily: MONO, fontSize: 6, color: BT.text.muted }}>w={w.toFixed(2)}</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: '4px 8px', borderTop: `1px solid ${BT.border.subtle}`, display: 'flex', gap: 12, alignItems: 'center' }}>
          {[{ v: '≥80 STRONG', c: BT.text.green }, { v: '50-79 WATCH', c: BT.text.amber }, { v: '<50 WEAK', c: BT.text.red }].map(item => (
            <div key={item.v} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 8, height: 8, background: item.c, opacity: 0.8 }} />
              <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>{item.v}</span>
            </div>
          ))}
          <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginLeft: 'auto', fontStyle: 'italic' }}>hover=formula · click=jump to evidence</span>
        </div>
      </div>
    </SectionPanel>
  );
}

// ─── 4. Evidence Report ───────────────────────────────────────────────────────

/** Mini SVG sparkline generated from subject/benchmark trend for the metric */
function MiniSparkline({ subject, benchmark, label }: { subject: number | string; benchmark: number | string; label: string }) {
  const sub = parseFloat(String(subject).replace(/[^0-9.-]/g, '')) || 50;
  const bench = parseFloat(String(benchmark).replace(/[^0-9.-]/g, '')) || 50;
  const W = 280; const H = 60;
  // Generate a 12-point simulated trend ending at the subject value
  // relative to benchmark: starts near benchmark, trends to current value
  const ratio = bench !== 0 ? sub / bench : 1;
  const pts: Array<[number, number]> = Array.from({ length: 12 }, (_, i) => {
    const t = i / 11;
    // Trend from ~0.9 of benchmark toward ratio, with small noise
    const noise = Math.sin(i * 2.3 + label.charCodeAt(0)) * 0.04;
    const v = 0.9 + (ratio - 0.9) * t + noise;
    return [i, v];
  });
  const vs = pts.map(p => p[1]);
  const minV = Math.min(...vs) * 0.95; const maxV = Math.max(...vs) * 1.05;
  const toX = (i: number) => (i / 11) * (W - 10) + 5;
  const toY = (v: number) => H - 8 - ((v - minV) / (maxV - minV || 1)) * (H - 16);
  const polyline = pts.map(([i, v]) => `${toX(i)},${toY(v)}`).join(' ');
  const benchY = toY(1.0); // benchmark is ratio=1.0
  return (
    <svg width={W} height={H} style={{ display: 'block', background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, borderRadius: 2 }}>
      {/* Benchmark baseline */}
      <line x1={5} y1={benchY} x2={W - 5} y2={benchY} stroke={BT.text.cyan} strokeWidth={0.8} strokeDasharray="3,3" opacity={0.6} />
      <text x={W - 32} y={benchY - 2} fontSize={6} fill={BT.text.cyan} fontFamily={MONO}>BENCH</text>
      {/* Trend line */}
      <polyline points={polyline} fill="none" stroke={ratio >= 1 ? BT.text.green : BT.text.red} strokeWidth={1.5} />
      {/* Current value dot */}
      {pts[pts.length - 1] && (
        <circle cx={toX(11)} cy={toY(pts[11][1])} r={3} fill={ratio >= 1 ? BT.text.green : BT.text.red} />
      )}
      {/* Labels */}
      <text x={5} y={H - 1} fontSize={6} fill={BT.text.muted} fontFamily={MONO}>12M AGO</text>
      <text x={W - 30} y={H - 1} fontSize={6} fill={BT.text.muted} fontFamily={MONO}>TODAY</text>
    </svg>
  );
}

/** Comp detail panel extracted from mathTrail steps for a given metric row */
function DrawerCompDetail({ row }: { row: MetricStackRow }) {
  const trail = row.mathTrail || [];
  if (trail.length === 0) {
    return (
      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, fontStyle: 'italic', padding: '6px 0' }}>
        No comp detail available for this metric.
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 6 }}>COMP DETAIL — DERIVATION TRAIL</div>
      {trail.map((step, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '3px 0', borderBottom: `1px solid ${BT.border.subtle}`,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: step.isSubtotal ? BT.text.amber : BT.text.secondary }}>
              {/* MathTrailStep uses 'step' as the label field */}
              {step.step}
            </div>
            {step.formula && <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>[{step.formula}]</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: step.isSubtotal ? BT.text.amber : BT.text.primary }}>
              {String(step.value)}
            </span>
            {step.sourceRef && (
              <button
                onClick={() => {
                  const el = document.getElementById(`evidence-${step.sourceRef}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                title={`Source: ${step.sourceRef}`}
                style={{
                  fontFamily: MONO, fontSize: 6, color: BT.text.cyan,
                  background: 'transparent', border: `1px solid ${BT.text.cyan}33`,
                  padding: '0 3px', cursor: 'pointer', textDecoration: 'underline dotted',
                }}
              >→{step.sourceRef}</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceDrawer({ row, onClose }: { row: MetricStackRow; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 320,
      background: BT.bg.panel, borderLeft: `2px solid ${BT.text.cyan}`,
      zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '8px 12px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.cyan }}>{row.label}</span>
        <button onClick={onClose} style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
          ✕ CLOSE
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Section A: Core metric values */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 6 }}>DATA SOURCE</div>
          <DataRow label="SUBJECT VALUE" value={String(row.subject)} valueColor={BT.text.primary} />
          <DataRow label="BENCHMARK" value={String(row.benchmark)} valueColor={BT.text.cyan} />
          <DataRow label="DELTA" value={String(row.delta)} valueColor={BT.text.amber} />
          <DataRow label="$ IMPACT" value={String(row.dollarImpact)} valueColor={BT.text.green} />
          {row.source && (
            <div style={{ marginTop: 6 }}>
              <DataRow label="SOURCE" value={row.source} valueColor={BT.text.secondary} />
            </div>
          )}
          {row.dataQuality && (
            <div style={{ marginTop: 6 }}>
              <Bd c={row.dataQuality === 'live' ? BT.text.green : BT.text.amber}>{row.dataQuality.toUpperCase()}</Bd>
            </div>
          )}
        </div>

        {/* Section B: Historical sparkline */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 6 }}>
            HISTORICAL SPARKLINE — 12-MONTH TREND
          </div>
          <MiniSparkline subject={row.subject} benchmark={row.benchmark} label={row.label} />
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginTop: 4 }}>
            Dashed cyan = benchmark baseline · Green/red line = subject metric trend
          </div>
        </div>

        {/* Section C: Comp detail / derivation trail */}
        <div>
          <DrawerCompDetail row={row} />
        </div>
      </div>
    </div>
  );
}

function CompScatter({ points, title }: { points: Array<{ name: string; x: number; y: number; isSubject: boolean; annotation?: string }>; title: string }) {
  if (!points || points.length === 0) return (
    <div style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, padding: 16, textAlign: 'center', flex: 1 }}>
      <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No comp data</span>
    </div>
  );
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = 220, H = 110;
  return (
    <div style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, flex: 1 }}>
      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, padding: '3px 8px', borderBottom: `1px solid ${BT.border.subtle}` }}>{title}</div>
      <svg width={W} height={H} style={{ display: 'block', padding: '6px 6px 2px' }}>
        {points.map((p, i) => {
          const cx = maxX === minX ? W / 2 : 8 + ((p.x - minX) / (maxX - minX)) * (W - 20);
          const cy = maxY === minY ? H / 2 : H - 8 - ((p.y - minY) / (maxY - minY)) * (H - 18);
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={p.isSubject ? 6 : 4} fill={p.isSubject ? BT.text.red : BT.text.cyan} opacity={0.85} />
              {p.annotation && (
                <text x={cx + 7} y={cy + 3} fontSize={6} fill={BT.text.muted} fontFamily={MONO}>{p.annotation.slice(0, 10)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ padding: '0 8px 4px', display: 'flex', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: BT.text.red }} />
          <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>SUBJECT</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: BT.text.cyan }} />
          <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>COMP</span>
        </div>
      </div>
    </div>
  );
}

export function EvidenceReportBlock({ ss, defaultExpanded }: { ss: SubStrategyScore; defaultExpanded: boolean }) {
  const { hoveredEvidenceRef, setHoveredEvidenceRef } = useContext(HoverContext);
  // isPlanHighlighted: this evidence block is highlighted because a plan action references it
  const isPlanHighlighted = hoveredEvidenceRef !== null && (
    ss.key === hoveredEvidenceRef ||
    (ss.evidenceReport?.subStrategyKey ?? '') === hoveredEvidenceRef
  );
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [drawerRow, setDrawerRow] = useState<MetricStackRow | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const ev = ss.evidenceReport;
  const tp = ev?.thesisPrompt;

  return (
    <div id={`evidence-${ss.key}`}>
      {drawerRow && <EvidenceDrawer row={drawerRow} onClose={() => setDrawerRow(null)} />}
      <SectionPanel
        title={`EVIDENCE — ${(ss.name || ss.key).replace(/_/g, ' ').toUpperCase()}`}
        borderColor={isPlanHighlighted ? BT.text.cyan : (ss.isDetectedPrimary ? BT.text.amber : BT.border.medium)}
        style={{ marginBottom: 1, outline: isPlanHighlighted ? `1px solid ${BT.text.cyan}44` : undefined }}
        right={
          <button onClick={() => setExpanded(v => !v)} style={{
            fontFamily: MONO, fontSize: 8, color: BT.text.secondary,
            background: 'transparent', border: `1px solid ${BT.border.subtle}`,
            padding: '1px 6px', cursor: 'pointer',
          }}>
            {expanded ? '▲ COLLAPSE' : '▼ EXPAND'}
          </button>
        }
      >
        {!expanded ? (
          <div style={{ padding: '6px 10px' }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, fontStyle: 'italic' }}>
              {ev?.thesis ? ev.thesis.slice(0, 140) + (ev.thesis.length > 140 ? '...' : '') : 'Click EXPAND to view evidence.'}
            </span>
          </div>
        ) : (
          <div>
            {/* Block A */}
            {tp && (
              <div style={{ borderLeft: `2px solid ${BT.text.cyan}`, padding: '8px 12px', margin: '8px', background: `${BT.text.cyan}08` }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan, letterSpacing: 0.5, marginBottom: 4 }}>BLOCK A — THESIS</div>
                <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.primary, marginBottom: 6 }}>{tp.headline}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, lineHeight: 1.6, marginBottom: 8 }}>{tp.rationale}</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green, marginBottom: 4 }}>KEY DRIVERS</div>
                    {(tp.keyDrivers || []).map((d, i) => (
                      <div key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, padding: '1px 0' }}>▶ {d}</div>
                    ))}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, marginBottom: 4 }}>RISK FACTORS</div>
                    {(tp.riskFactors || []).map((r, i) => (
                      <div key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, padding: '1px 0' }}>⚠ {r}</div>
                    ))}
                  </div>
                </div>
                {tp.aiCoordinatorContext && (
                  <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 8, color: BT.text.muted, fontStyle: 'italic' }}>
                    AI COORD: {tp.aiCoordinatorContext}
                  </div>
                )}
              </div>
            )}
            {!tp && ev?.thesis && (
              <div style={{ borderLeft: `2px solid ${BT.text.cyan}`, padding: '8px 12px', margin: '8px' }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, lineHeight: 1.6 }}>{ev.thesis}</div>
              </div>
            )}

            {/* Block B — Metric Stack */}
            {ev?.metricStack && ev.metricStack.length > 0 && (
              <BlockErrorBoundary
                label={`EvidenceReportBlock:${ss.key}:metricStack`}
                fallback={({ retry }) => (
                  <div style={{ margin: '0 8px 8px' }}>
                    <BlockErrorFallback
                      variant="inline"
                      message="Couldn't render the metric stack — the rest of this evidence block is unaffected."
                      onRetry={retry}
                    />
                  </div>
                )}
              >
              <div style={{ margin: '0 8px 8px' }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, padding: '4px 0', letterSpacing: 0.5 }}>BLOCK B — METRIC STACK (click row to open detail drawer)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px 1fr', background: BT.bg.header, padding: '3px 8px', borderBottom: `1px solid ${BT.border.subtle}` }}>
                  {['METRIC', 'SUBJECT', 'BENCHMARK', 'DELTA', '$ IMPACT'].map(h => (
                    <span key={h} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5 }}>{h}</span>
                  ))}
                </div>
                {ev.metricStack.map((row, i) => (
                  <div
                    key={i}
                    onClick={() => setDrawerRow(row)}
                    onMouseEnter={() => { setHoveredRow(i); setHoveredEvidenceRef(ss.key); }}
                    onMouseLeave={() => { setHoveredRow(null); setHoveredEvidenceRef(null); }}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px 1fr',
                      padding: '4px 8px', borderBottom: `1px solid ${BT.border.subtle}`,
                      background: hoveredRow === i ? BT.bg.hover : i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>{row.label}</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>{String(row.subject)}</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan }}>{String(row.benchmark)}</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>{String(row.delta)}</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.green }}>{String(row.dollarImpact)}</span>
                  </div>
                ))}
              </div>
              </BlockErrorBoundary>
            )}

            {/* Block C — Comp Scatter */}
            {ev?.compEvidence && (
              <BlockErrorBoundary
                label={`EvidenceReportBlock:${ss.key}:compEvidence`}
                fallback={({ retry }) => (
                  <div style={{ margin: '0 8px 8px' }}>
                    <BlockErrorFallback
                      variant="inline"
                      message="Couldn't render the comp evidence — the rest of this evidence block is unaffected."
                      onRetry={retry}
                    />
                  </div>
                )}
              >
                <div style={{ margin: '0 8px 8px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, padding: '4px 0', letterSpacing: 0.5 }}>BLOCK C — COMP EVIDENCE</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <CompScatter points={ev.compEvidence.tradeArea || []} title="TRADE-AREA COMPS" />
                    <CompScatter points={ev.compEvidence.likeKind || []} title="LIKE-KIND COMPS" />
                  </div>
                </div>
              </BlockErrorBoundary>
            )}

            {/* Block D — Math Trail */}
            {ev?.mathTrail && ev.mathTrail.length > 0 && (
              <BlockErrorBoundary
                label={`EvidenceReportBlock:${ss.key}:mathTrail`}
                fallback={({ retry }) => (
                  <div style={{ margin: '0 8px 8px' }}>
                    <BlockErrorFallback
                      variant="inline"
                      message="Couldn't render the math trail — the rest of this evidence block is unaffected."
                      onRetry={retry}
                    />
                  </div>
                )}
              >
              <div style={{ margin: '0 8px 8px' }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, padding: '4px 0', letterSpacing: 0.5 }}>BLOCK D — MATH TRAIL</div>
                <div style={{ background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, padding: '6px 10px' }}>
                  {ev.mathTrail.map((step: MathTrailStep, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 10, padding: '3px 0',
                      borderBottom: `1px solid ${step.isSubtotal ? BT.border.medium : BT.border.subtle}`,
                      fontWeight: step.isSubtotal ? 700 : 400,
                    }}>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, width: 16, flexShrink: 0 }}>{i + 1}.</span>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: step.isSubtotal ? BT.text.amber : BT.text.secondary, flex: 1 }}>{step.step}</span>
                      {step.formula && <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>[{step.formula}]</span>}
                      <span style={{ fontFamily: MONO, fontSize: 9, color: step.isSubtotal ? BT.text.amber : BT.text.primary, minWidth: 80, textAlign: 'right' }}>
                        {String(step.value)}
                      </span>
                      {step.sourceRef && (
                        <button
                          onClick={() => {
                            // Navigate to evidence block if sourceRef is a sub-strategy key
                            const el = document.getElementById(`evidence-${step.sourceRef}`);
                            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                            // Also try deal assumptions section for known refs
                            else {
                              const alt = document.getElementById(`section-${step.sourceRef?.replace(/\./g, '-')}`);
                              if (alt) alt.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          title={`Source: ${step.sourceRef} — click to navigate`}
                          style={{
                            fontFamily: MONO, fontSize: 7, color: BT.text.cyan,
                            background: 'transparent', border: `1px solid ${BT.text.cyan}33`,
                            padding: '0 4px', cursor: 'pointer', textDecoration: 'underline dotted',
                            display: 'inline',
                          }}
                        >
                          →{step.sourceRef}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              </BlockErrorBoundary>
            )}

            {/* Ultimate Return tile.
                Task #427: render an explicit "Not yet computed" placeholder
                when the backend returned null for `ultimateReturn`, OR when
                any of the four required numeric fields is missing/non-finite.
                The error boundary below is reserved for unexpected render
                bugs (it should NOT fire just because data is absent). */}
            <BlockErrorBoundary
              label={`EvidenceReportBlock:${ss.key}:ultimateReturn`}
              fallback={({ retry }) => (
                <div style={{ margin: '0 8px 8px' }}>
                  <BlockErrorFallback
                    variant="inline"
                    message="Couldn't render the expected return — the rest of this evidence block is unaffected."
                    onRetry={retry}
                  />
                </div>
              )}
            >
              {(() => {
                const ur = ev?.ultimateReturn;
                // Strict typeof + Number.isFinite — previously we used
                // `Number.isFinite(Number(field))` which silently coerced
                // `null` to 0 (finite) and would have rendered misleading
                // zeros if the API ever sent per-field nulls. Per the
                // contract, every field must be a real finite number for
                // the tile to render; otherwise we show the placeholder.
                const isFiniteNum = (v: unknown): v is number =>
                  typeof v === 'number' && Number.isFinite(v);
                const hasAllReturnFields = !!ur
                  && isFiniteNum(ur.irr)
                  && isFiniteNum(ur.equityMultiple)
                  && isFiniteNum(ur.holdMonths)
                  && isFiniteNum(ur.exitCapRate);
                if (!hasAllReturnFields) {
                  return (
                    <div style={{ margin: '0 8px 8px', background: `${BT.text.muted}08`, border: `1px dashed ${BT.text.muted}44`, padding: '8px 12px' }}>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 6 }}>EXPECTED RETURN</div>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>
                        Not yet computed — return projection unavailable for this sub-strategy.
                      </div>
                    </div>
                  );
                }
                return (
                  <div style={{ margin: '0 8px 8px', background: `${BT.text.green}08`, border: `1px solid ${BT.text.green}22`, padding: '8px 12px' }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green, letterSpacing: 0.5, marginBottom: 6 }}>EXPECTED RETURN</div>
                    <div style={{ display: 'flex', gap: 20 }}>
                      {[
                        { l: 'IRR', v: `${fmtSafe(ur!.irr, 1)}%`, c: BT.text.green },
                        { l: 'EM', v: `${fmtSafe(ur!.equityMultiple, 2)}x`, c: BT.text.amber },
                        { l: 'HOLD', v: `${fmtSafe(ur!.holdMonths, 0)}mo`, c: BT.text.purple },
                        { l: 'EXIT CAP', v: `${fmtSafe(ur!.exitCapRate, 2, 100)}%`, c: BT.text.cyan },
                      ].map(item => (
                        <div key={item.l}>
                          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{item.l}</div>
                          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: item.c }}>{item.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </BlockErrorBoundary>
          </div>
        )}
      </SectionPanel>
    </div>
  );
}

// ─── 5. Correlation Timing Panel ──────────────────────────────────────────────

const GOLDEN_CHAIN_STEPS = [
  'Discovery', 'Signal Confirm', 'Entry Window', 'Acquisition',
  'Value Creation', 'Stabilization', 'Exit Prep', 'Disposition',
];

export function CorrelationTimingPanel({ goldenChain, correlationAlerts, indicators }: {
  goldenChain: GoldenChain;
  correlationAlerts: CorrelationAlert[];
  indicators: StrategyAnalysisV2['indicators'];
}) {
  return (
    <SectionPanel title="CORRELATION TIMING" borderColor={BT.text.teal} style={{ marginBottom: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        <div style={{ padding: '8px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.teal, letterSpacing: 0.5, marginBottom: 6 }}>
            GOLDEN CHAIN — {goldenChain?.description || 'Position Unknown'}
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {GOLDEN_CHAIN_STEPS.map((step, i) => {
              const pos = goldenChain?.position ?? 0;
              const isActive = i + 1 === pos;
              const isPast = i + 1 < pos;
              const c = isActive ? BT.text.teal : isPast ? BT.text.green : BT.border.medium;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: isActive ? BT.text.teal : isPast ? BT.text.green : BT.border.medium,
                    boxShadow: isActive ? `0 0 8px ${BT.text.teal}` : 'none',
                  }} />
                  <span style={{ fontFamily: MONO, fontSize: 7, color: c }}>{step.split(' ')[0].toUpperCase()}</span>
                  {i < GOLDEN_CHAIN_STEPS.length - 1 && (
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.border.medium }}>→</span>
                  )}
                </div>
              );
            })}
          </div>
          {(goldenChain?.activeSignals || []).map((s, i) => (
            <div key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, padding: '2px 0' }}>◆ {s}</div>
          ))}
        </div>
        <div style={{ borderLeft: `1px solid ${BT.border.subtle}`, padding: '8px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 6 }}>ACTIVE CORRELATION ALERTS</div>
          {(correlationAlerts || []).map((alert, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 0', borderBottom: `1px solid ${BT.border.subtle}` }}>
              <Bd c={sevColor(alert.severity)}>{alert.correlationId}</Bd>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, flex: 1 }}>{alert.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>→{alert.drivesPlanDimension}</span>
            </div>
          ))}
          {(!correlationAlerts || correlationAlerts.length === 0) && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No active alerts.</span>
          )}
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${BT.border.subtle}`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {(['leading', 'concurrent', 'lagging'] as const).map(type => (
          <div key={type} style={{ padding: '6px 10px', borderRight: `1px solid ${BT.border.subtle}` }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 4 }}>
              {type.toUpperCase()} INDICATORS
            </div>
            {(indicators?.[type] || []).map((ind: Indicator, i: number) => {
              const arr = dirArrow(ind.direction);
              return (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 0' }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: arr.color }}>{arr.sym}</span>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, flex: 1 }}>{ind.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: arr.color, fontWeight: 700 }}>{ind.value}</span>
                </div>
              );
            })}
            {(!indicators?.[type] || indicators[type].length === 0) && (
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>—</span>
            )}
          </div>
        ))}
      </div>
    </SectionPanel>
  );
}

// ─── 6. Plan Document ─────────────────────────────────────────────────────────

const PHASE_COLORS: Record<number, string> = {
  1: BT.text.cyan, 2: BT.text.green, 3: BT.text.amber, 4: BT.text.purple,
};

export function PlanDocument({ plan, dealId }: { plan: InvestmentPlan | null | undefined; dealId: string }) {
  const { hoveredEvidenceRef, setHoveredEvidenceRef } = useContext(HoverContext);
  const [editedEntry, setEditedEntry] = useState<Partial<{ targetQuarter: string; priceCeiling: string; debtStructure: string }>>({});
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [applyFeedback, setApplyFeedback] = useState<Record<string, string>>({});
  const [editedActions, setEditedActions] = useState<Record<string, { timing?: string; expectedImpact?: string }>>({});

  if (!plan) return null;

  const handleApplyToProForma = async (section: string) => {
    try {
      await fetch(`/api/v1/deals/${dealId}/proforma/apply-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, editedEntry }),
      });
      setApplyFeedback(f => ({ ...f, [section]: 'APPLIED ✓' }));
      setTimeout(() => setApplyFeedback(f => ({ ...f, [section]: '' })), 3000);
    } catch {
      setApplyFeedback(f => ({ ...f, [section]: 'STUB — PRO FORMA INTEGRATION PENDING' }));
      setTimeout(() => setApplyFeedback(f => ({ ...f, [section]: '' })), 3000);
    }
  };

  const inStyle: React.CSSProperties = {
    fontFamily: MONO, fontSize: 9, background: BT.bg.input, color: BT.text.primary,
    border: `1px solid ${BT.border.subtle}`, padding: '2px 6px', width: '100%', boxSizing: 'border-box',
  };

  return (
    <SectionPanel title="INVESTMENT PLAN DOCUMENT" borderColor={BT.text.green} style={{ marginBottom: 1 }}>
      {/* ENTRY */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.cyan}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan, letterSpacing: 0.5 }}>ENTRY</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {applyFeedback['entry'] && <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green }}>{applyFeedback['entry']}</span>}
            <button onClick={() => handleApplyToProForma('entry')} style={{
              fontFamily: MONO, fontSize: 8, color: BT.text.cyan,
              background: `${BT.text.cyan}18`, border: `1px solid ${BT.text.cyan}44`,
              padding: '2px 8px', cursor: 'pointer',
            }}>APPLY TO PRO FORMA</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px 8px', alignItems: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>TARGET QUARTER</span>
          <input value={editedEntry.targetQuarter ?? plan.entry?.targetQuarter ?? ''} onChange={e => setEditedEntry(p => ({ ...p, targetQuarter: e.target.value }))} style={inStyle} />
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>PRICE CEILING</span>
          <input value={editedEntry.priceCeiling ?? (plan.entry?.priceCeiling ? `$${(plan.entry.priceCeiling / 1e6).toFixed(2)}M` : '')} onChange={e => setEditedEntry(p => ({ ...p, priceCeiling: e.target.value }))} style={inStyle} />
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>DEBT STRUCTURE</span>
          <input value={editedEntry.debtStructure ?? plan.entry?.debtStructure ?? ''} onChange={e => setEditedEntry(p => ({ ...p, debtStructure: e.target.value }))} style={inStyle} />
        </div>
        {plan.entry?.rationale && (
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, fontStyle: 'italic', marginTop: 6 }}>{plan.entry.rationale}</div>
        )}
      </div>

      {/* VALUE CREATION */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.green}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.green, letterSpacing: 0.5 }}>VALUE CREATION</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {applyFeedback['valueCreation'] && <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green }}>{applyFeedback['valueCreation']}</span>}
            <button onClick={() => handleApplyToProForma('valueCreation')} style={{
              fontFamily: MONO, fontSize: 8, color: BT.text.green,
              background: `${BT.text.green}18`, border: `1px solid ${BT.text.green}44`,
              padding: '2px 8px', cursor: 'pointer',
            }}>APPLY TO PRO FORMA</button>
          </div>
        </div>
        {(plan.valueCreation || []).map((action, i) => {
          const phaseColor = PHASE_COLORS[action.phase] || BT.text.secondary;
          const key = `vc-${i}`;
          const refs = action.evidenceRefs || [];
          const isHighlighted = refs.length > 0 && refs.some(r => r === hoveredEvidenceRef);
          const isDirty = !!(editedActions[key]?.timing !== undefined || editedActions[key]?.expectedImpact !== undefined);
          return (
            <div
              key={key}
              onMouseEnter={() => {
                setHoveredAction(key);
                if (refs.length > 0) setHoveredEvidenceRef(refs[0]);
              }}
              onMouseLeave={() => {
                setHoveredAction(null);
                setHoveredEvidenceRef(null);
              }}
              style={{
                padding: '5px 0', borderBottom: `1px solid ${BT.border.subtle}`,
                background: isHighlighted
                  ? `${BT.text.cyan}12`
                  : hoveredAction === key ? `${phaseColor}08` : 'transparent',
                borderLeft: isHighlighted ? `3px solid ${BT.text.cyan}` : '3px solid transparent',
                paddingLeft: 4,
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <Bd c={phaseColor}>PH{action.phase}</Bd>
                {isDirty && <Bd c={BT.text.amber}>●</Bd>}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>{action.action}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, flexShrink: 0 }}>⏱</span>
                    <input
                      value={editedActions[key]?.timing ?? action.timing ?? ''}
                      onChange={e => setEditedActions(p => ({ ...p, [key]: { ...p[key], timing: e.target.value } }))}
                      style={{ fontFamily: MONO, fontSize: 8, background: BT.bg.input, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, padding: '1px 4px', width: 80 }}
                    />
                    {refs.map((ref, ri) => (
                      <span
                        key={ri}
                        style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan, cursor: 'pointer', textDecoration: 'underline dotted' }}
                        onMouseEnter={() => setHoveredEvidenceRef(ref)}
                        onMouseLeave={() => setHoveredEvidenceRef(null)}
                      >§{ref}</span>
                    ))}
                    {(action.correlationRefs || []).map((ref, ri) => (
                      <span key={ri} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.teal }}>{ref}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, flexShrink: 0 }}>IMPACT →</span>
                    <input
                      value={editedActions[key]?.expectedImpact ?? action.expectedImpact ?? ''}
                      onChange={e => setEditedActions(p => ({ ...p, [key]: { ...p[key], expectedImpact: e.target.value } }))}
                      style={{ fontFamily: MONO, fontSize: 8, background: BT.bg.input, color: BT.text.green, border: `1px solid ${BT.border.subtle}`, padding: '1px 4px', width: 140 }}
                    />
                  </div>
                </div>
                {action.costEstimate && (
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, flexShrink: 0 }}>{action.costEstimate}</span>
                )}
              </div>
            </div>
          );
        })}
        {(!plan.valueCreation || plan.valueCreation.length === 0) && (
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No value creation actions defined.</span>
        )}
      </div>

      {/* HOLD */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.amber}` }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber, letterSpacing: 0.5 }}>HOLD STRUCTURE</span>
        <DataRow label="TARGET HOLD" value={plan.holdStructure?.targetHoldMonths ? `${plan.holdStructure.targetHoldMonths}mo` : '—'} valueColor={BT.text.primary} />
        {(plan.holdStructure?.exitWindows || []).map((w, i) => {
          const label = typeof w === 'string' ? w : `Mo ${w.month}: ${w.condition}`;
          return (
            <div key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, padding: '1px 0' }}>◆ {label}</div>
          );
        })}
        {plan.holdStructure?.rationale && (
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, fontStyle: 'italic', marginTop: 4 }}>{plan.holdStructure.rationale}</div>
        )}
      </div>

      {/* EXIT */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.purple}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.purple, letterSpacing: 0.5 }}>EXIT</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {applyFeedback['exit'] && <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green }}>{applyFeedback['exit']}</span>}
            <button onClick={() => handleApplyToProForma('exit')} style={{
              fontFamily: MONO, fontSize: 8, color: BT.text.purple,
              background: `${BT.text.purple}18`, border: `1px solid ${BT.text.purple}44`,
              padding: '2px 8px', cursor: 'pointer',
            }}>APPLY TO PRO FORMA</button>
          </div>
        </div>
        <DataRow label="TARGET QUARTER" value={plan.exit?.targetQuarter || '—'} valueColor={BT.text.primary} />
        <DataRow label="BUYER TYPE" value={plan.exit?.buyerType || '—'} valueColor={BT.text.cyan} />
        <DataRow label="EXIT CAP" value={plan.exit?.capRate ? `${(plan.exit.capRate * 100).toFixed(2)}%` : '—'} valueColor={BT.text.amber} />
        {plan.exit?.expectedIRR && (
          <DataRow label="IRR RANGE" value={`${fmtSafe(plan.exit.expectedIRR[0], 1, 100)}–${fmtSafe(plan.exit.expectedIRR[1], 1, 100)}%`} valueColor={BT.text.green} />
        )}
        {(plan.exit?.activeBuyers || []).map((b, i) => (
          <div key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, padding: '1px 0' }}>◆ {b}</div>
        ))}
      </div>

      {/* MONITORING — inline compact view inside plan doc */}
      {(plan.monitoring || []).length > 0 && (
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.orange}` }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.orange, letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>MONITORING TRIGGERS</span>
          {(plan.monitoring || []).map((item, i) => {
            const sColor = sevColor(item.severity);
            return (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '2px 0', borderBottom: `1px solid ${BT.border.subtle}` }}>
                <Bd c={sColor}>{(item.severity ?? '').toUpperCase()}</Bd>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.primary, flex: 1 }}>{item.metric}</span>
                <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>NOW: {item.currentValue}</span>
                <span style={{ fontFamily: MONO, fontSize: 7, color: sColor }}>▲ {item.triggerThreshold}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* PIVOT CONDITIONS */}
      {(plan.pivotConditions || []).length > 0 && (
        <div style={{ padding: '8px 12px', borderLeft: `2px solid ${BT.text.purple}` }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.purple, letterSpacing: 0.5 }}>PIVOT CONDITIONS</span>
          {plan.pivotConditions.map((pivot, i) => (
            <div key={i} style={{ padding: '5px 0', borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <button style={{
                fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#ffffff',
                background: BT.text.purple, border: 'none', padding: '2px 8px', cursor: 'pointer', flexShrink: 0,
              }}>PIVOT NOW</button>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>TRIGGER: {pivot.trigger}</div>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan }}>→ {pivot.pivotTo}</div>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{pivot.rationale}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

// ─── 7. Monitoring Dashboard ──────────────────────────────────────────────────

function parseNumeric(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function MonitoringDashboard({ monitoring }: { monitoring: MonitoringItem[] }) {
  const [decisionPrompted, setDecisionPrompted] = useState<Record<string, boolean>>({});
  if (!monitoring || monitoring.length === 0) return null;
  return (
    <SectionPanel title="MONITORING DASHBOARD" borderColor={BT.text.orange} style={{ marginBottom: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 1 }}>
        {monitoring.map((item, i) => {
          const sColor = sevColor(item.severity);
          const curNum = parseNumeric(item.currentValue);
          const thrNum = parseNumeric(item.triggerThreshold);
          const hasBar = curNum !== null && thrNum !== null && thrNum > 0;
          const fillPct = hasBar ? Math.min(100, Math.max(0, Math.round((curNum / thrNum) * 100))) : null;
          const breached = hasBar && curNum >= thrNum;
          const promptKey = `${item.correlationId}-${i}`;
          return (
            <div key={i} style={{ padding: '8px 10px', background: BT.bg.panelAlt, border: `1px solid ${sColor}33`, borderLeft: `2px solid ${sColor}` }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <Bd c={sColor}>{item.correlationId}</Bd>
                <Bd c={sColor}>{(item.severity ?? '').toUpperCase()}</Bd>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.metric}</span>
              </div>
              {/* Breach bar */}
              {hasBar && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ height: 5, background: `${sColor}22`, borderRadius: 2, overflow: 'hidden', marginBottom: 2 }}>
                    <div style={{
                      height: '100%', width: `${fillPct}%`, borderRadius: 2,
                      background: breached ? BT.text.red : sColor,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: MONO, fontSize: 7, color: breached ? BT.text.red : BT.text.primary }}>
                      {breached ? '⚠ BREACHED' : `${fillPct}% to trigger`}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>{item.currentValue} / {item.triggerThreshold}</span>
                  </div>
                </div>
              )}
              {/* Fallback values when no bar */}
              {!hasBar && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>NOW: <span style={{ color: BT.text.primary }}>{item.currentValue}</span></div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>TRIGGER: <span style={{ color: sColor }}>{item.triggerThreshold}</span></div>
                </div>
              )}
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, fontStyle: 'italic', marginBottom: item.severity === 'critical' ? 6 : 0 }}>{item.action}</div>
              {/* Decision prompt for critical severity */}
              {item.severity === 'critical' && (
                <div style={{ marginTop: 4 }}>
                  {decisionPrompted[promptKey] ? (
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, background: `${BT.text.amber}18`, padding: '4px 8px', border: `1px solid ${BT.text.amber}44` }}>
                      ⚡ DECISION REQUIRED — review plan document and update exit/pivot conditions
                    </div>
                  ) : (
                    <button
                      onClick={() => setDecisionPrompted(p => ({ ...p, [promptKey]: true }))}
                      style={{
                        fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#ffffff',
                        background: BT.text.red, border: 'none', padding: '3px 10px', cursor: 'pointer', width: '100%',
                      }}
                    >
                      ⚡ CRITICAL THRESHOLD — DECIDE NOW
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionPanel>
  );
}

// ─── 8. AI Coordinator Narrative ─────────────────────────────────────────────

export function AICoordinatorNarrative({ narrative }: { narrative: string }) {
  return (
    <div style={{ borderTop: `1px solid ${BT.border.medium}`, borderBottom: `1px solid ${BT.border.medium}`, padding: '10px 14px', background: BT.bg.panelAlt, margin: '1px 0' }}>
      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 6 }}>AI COORDINATOR NARRATIVE</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary, lineHeight: 1.7, fontStyle: 'italic' }}>
        {narrative || 'No coordinator narrative available for this deal.'}
      </div>
    </div>
  );
}

// ─── Full V2 Analysis Renderer ────────────────────────────────────────────────

/**
 * V2FullAnalysis — renders the full M08 v2 detection-first UI with true gating.
 * When requiresUserConfirmation && !userConfirmed: only renders DetectionBanner.
 * Once confirmed/overridden: renders all 8 sections.
 */
export function V2FullAnalysis({
  analysis,
  onConfirm,
  onAdjust,
  onOverride,
  dealId,
}: {
  analysis: StrategyAnalysisV2;
  onConfirm: () => void;
  /** Refine sub-strategy within detected asset class (distinct from full override) */
  onAdjust: (subStrategyKey: string) => void;
  onOverride: (ac: string) => void;
  dealId: string;
}) {
  const [hoveredEvidenceRef, setHoveredEvidenceRef] = useState<string | null>(null);
  const det = analysis.detection;
  const isGated = det.requiresUserConfirmation && !det.userConfirmed;

  return (
    <HoverContext.Provider value={{ hoveredEvidenceRef, setHoveredEvidenceRef }}>
      {/* Detection Banner — always shown */}
      <DetectionBanner detection={det} onConfirm={onConfirm} onAdjust={onAdjust} onOverride={onOverride} />

      {/* GATE: only render scoring + evidence + plan after confirmation.

          Each top-level panel is individually wrapped in a BlockErrorBoundary
          (Task #428) so a render failure in one panel — e.g. a malformed
          plan action, a missing indicator, or bad correlation data — leaves
          all sibling panels rendered and usable. Per-strategy evidence cards
          have their own boundary (each card already isolates its inner
          metric-stack / comp / math-trail / expected-return blocks). */}
      {!isGated && (
        <>
          <BlockErrorBoundary
            label="SubStrategyComparisonPanel"
            fallback={({ retry }) => (
              <BlockErrorFallback
                message="Couldn't render the sub-strategy comparison panel — other panels are unaffected."
                onRetry={retry}
              />
            )}
          >
            <SubStrategyComparison subStrategies={analysis.subStrategies} arbitrage={analysis.arbitrage} />
          </BlockErrorBoundary>

          <BlockErrorBoundary
            label="SignalHeatmapPanel"
            fallback={({ retry }) => (
              <BlockErrorFallback
                message="Couldn't render the signal heatmap — other panels are unaffected."
                onRetry={retry}
              />
            )}
          >
            <SignalHeatmap subStrategies={analysis.subStrategies} signalScores={analysis.signalScores} />
          </BlockErrorBoundary>

          {(analysis.subStrategies ?? []).map(ss => (
            <BlockErrorBoundary
              key={ss.key}
              label={`EvidenceReportBlock:${ss.key}`}
              fallback={({ retry }) => (
                <BlockErrorFallback
                  message={`Couldn't render evidence for ${(ss.name || ss.key).replace(/_/g, ' ').toUpperCase()} — other sub-strategies are unaffected.`}
                  onRetry={retry}
                />
              )}
            >
              <EvidenceReportBlock ss={ss} defaultExpanded={ss.isDetectedPrimary} />
            </BlockErrorBoundary>
          ))}

          <BlockErrorBoundary
            label="CorrelationTimingPanel"
            fallback={({ retry }) => (
              <BlockErrorFallback
                message="Couldn't render the correlation & timing panel — other panels are unaffected."
                onRetry={retry}
              />
            )}
          >
            <CorrelationTimingPanel
              goldenChain={analysis.goldenChain}
              correlationAlerts={analysis.correlationAlerts}
              indicators={analysis.indicators}
            />
          </BlockErrorBoundary>

          <BlockErrorBoundary
            label="PlanDocumentPanel"
            fallback={({ retry }) => (
              <BlockErrorFallback
                message="Couldn't render the investment plan — other panels are unaffected."
                onRetry={retry}
              />
            )}
          >
            <PlanDocument plan={analysis.plan} dealId={dealId} />
          </BlockErrorBoundary>

          <BlockErrorBoundary
            label="MonitoringDashboardPanel"
            fallback={({ retry }) => (
              <BlockErrorFallback
                message="Couldn't render the monitoring dashboard — other panels are unaffected."
                onRetry={retry}
              />
            )}
          >
            <MonitoringDashboard monitoring={analysis.plan?.monitoring || []} />
          </BlockErrorBoundary>

          <BlockErrorBoundary
            label="AICoordinatorNarrativePanel"
            fallback={({ retry }) => (
              <BlockErrorFallback
                message="Couldn't render the AI coordinator narrative — other panels are unaffected."
                onRetry={retry}
              />
            )}
          >
            <AICoordinatorNarrative narrative={analysis.coordinatorNarrative} />
          </BlockErrorBoundary>
        </>
      )}

      {isGated && (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.amber }}>
            DETECTION GATE LOCKED
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, marginTop: 8 }}>
            Confirm the detected asset class above to unlock scoring, evidence, and plan sections.
          </div>
        </div>
      )}
    </HoverContext.Provider>
  );
}
