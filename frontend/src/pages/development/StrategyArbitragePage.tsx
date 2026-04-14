/**
 * M08 v2 — Detection-First Strategy UI
 * Replaces the v1 BTS/Flip/Rental/STR score matrix with:
 *   Detection Banner → Sub-Strategy Comparison → Signal Heatmap →
 *   Evidence Report → Correlation Timing Panel → Plan Document →
 *   Monitoring Dashboard → AI Coordinator Narrative
 */

import React, { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, SubTabBar, SectionPanel, DataRow, Bd, BtTabWrapper,
} from '../../components/deal/bloomberg-ui';
import { useStrategyAnalysisV2 } from '../../hooks/useStrategyAnalysisV2';
import type {
  DetectionResult, SubStrategyScore, EvidenceReport,
  InvestmentPlan, CorrelationAlert, GoldenChain, Indicator,
  MonitoringItem, MetricStackRow, MathTrailStep, ThesisPrompt,
} from '../../hooks/useStrategyAnalysisV2';
import { useCorrelationReport } from '../../hooks/useCorrelationReport';
import { useDriverAnalysis } from '../../hooks/useDriverAnalysis';
import { useLeadLagRelationships } from '../../hooks/useLeadLagRelationships';
import { CustomScreenTab } from '../../components/deal/sections/CustomScreenTab';
import { useDealStore } from '../../stores/dealStore';

const MONO = BT.font.mono;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }
function fmtScore(v: number) { return v.toFixed(1); }

function confColor(conf: number): string {
  if (conf >= 0.85) return BT.text.green;
  if (conf >= 0.70) return BT.text.amber;
  return BT.text.red;
}

function sevColor(sev: 'critical' | 'warning' | 'info'): string {
  if (sev === 'critical') return BT.text.red;
  if (sev === 'warning') return BT.text.amber;
  return BT.text.cyan;
}

function gateColor(ss: SubStrategyScore): string {
  if (ss.gate?.disqualified) return BT.text.red;
  if (ss.gate?.marginal) return BT.text.amber;
  return BT.text.green;
}

function gateLabel(ss: SubStrategyScore): string {
  if (ss.gate?.disqualified) return 'DISQUAL';
  if (ss.gate?.marginal) return 'MARGINAL';
  return 'QUALIFIED';
}

function dirArrow(dir: 'up' | 'down' | 'flat'): { sym: string; color: string } {
  if (dir === 'up') return { sym: '▲', color: BT.text.green };
  if (dir === 'down') return { sym: '▼', color: BT.text.red };
  return { sym: '◆', color: BT.text.secondary };
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score: rawScore, color, size = 56 }: { score: number; color: string; size?: number }) {
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
        fill={color} fontSize={13} fontWeight={700} fontFamily={MONO}>
        {Math.round(score)}
      </text>
    </svg>
  );
}

// ─── 1. Detection Banner ───────────────────────────────────────────────────────

interface DetectionBannerProps {
  detection: DetectionResult;
  onConfirm: () => void;
  onOverride: (ac: string) => void;
  showModal: boolean;
  setShowModal: (v: boolean) => void;
}

function DetectionBanner({ detection, onConfirm, onOverride, showModal, setShowModal }: DetectionBannerProps) {
  const [overrideInput, setOverrideInput] = useState('');
  const [expanded, setExpanded] = useState(false);

  const conf = detection.confidence;
  const cColor = confColor(conf);

  return (
    <>
      <div style={{
        borderLeft: `3px solid ${BT.text.cyan}`,
        background: `${BT.text.cyan}08`,
        borderBottom: `1px solid ${BT.border.subtle}`,
        padding: '8px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.cyan, letterSpacing: 0.5 }}>
              DETECTED
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.primary }}>
              {(detection.assetClass || '').toUpperCase().replace(/_/g, ' ')} ·{' '}
              {(detection.detectedDealType || '').replace(/_/g, ' ').toUpperCase()}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
              [{(detection.detectedSubStrategy || '').replace(/_/g, ' ')}]
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>CONF</span>
            <span style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700, color: cColor,
              background: `${cColor}18`, border: `1px solid ${cColor}33`, padding: '1px 6px',
            }}>
              {pct(conf)}
            </span>
          </div>

          {detection.requiresUserConfirmation && !detection.userConfirmed && (
            <Bd c={BT.text.amber}>CONFIRMATION REQUIRED</Bd>
          )}
          {detection.userConfirmed && (
            <Bd c={BT.text.green}>CONFIRMED</Bd>
          )}
          {detection.userOverrideClassification && (
            <Bd c={BT.text.purple}>OVERRIDDEN</Bd>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {!detection.userConfirmed && (
              <button onClick={onConfirm} style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.green,
                background: `${BT.text.green}18`, border: `1px solid ${BT.text.green}44`,
                padding: '2px 8px', cursor: 'pointer',
              }}>CONFIRM</button>
            )}
            <button onClick={() => setExpanded(v => !v)} style={{
              fontFamily: MONO, fontSize: 9, color: BT.text.secondary,
              background: 'transparent', border: `1px solid ${BT.border.subtle}`,
              padding: '2px 8px', cursor: 'pointer',
            }}>
              {expanded ? '▲ SIGNALS' : '▼ SIGNALS'}
            </button>
            <button onClick={() => setShowModal(true)} style={{
              fontFamily: MONO, fontSize: 9, color: BT.text.amber,
              background: `${BT.text.amber}18`, border: `1px solid ${BT.text.amber}44`,
              padding: '2px 8px', cursor: 'pointer',
            }}>OVERRIDE</button>
          </div>
        </div>

        {expanded && detection.detectionSignals && detection.detectionSignals.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {detection.detectionSignals.map((sig, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, width: 140, flexShrink: 0 }}>
                  {String(sig.signal).replace(/_/g, ' ').toUpperCase()}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, width: 80 }}>
                  {String(sig.value)}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, width: 120 }}>
                  threshold: {String(sig.threshold)}
                </span>
                <div style={{ flex: 1, height: 3, background: BT.bg.hover }}>
                  <div style={{
                    height: '100%', background: BT.text.cyan, opacity: 0.7,
                    width: `${Math.min(100, Math.abs(Number(sig.contribution ?? 0)) * 300)}%`,
                  }} />
                </div>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan, width: 40, textAlign: 'right' }}>
                  {((sig.contribution ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
            ))}

            {detection.alternateSubStrategies && detection.alternateSubStrategies.length > 0 && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${BT.border.subtle}` }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>
                  ALTERNATES:
                </span>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {detection.alternateSubStrategies.map((alt, i) => (
                    <div key={i} style={{
                      fontFamily: MONO, fontSize: 9, color: BT.text.secondary,
                      background: BT.bg.header, border: `1px solid ${BT.border.subtle}`,
                      padding: '2px 8px',
                    }}>
                      {alt.key.replace(/_/g, ' ')} · {pct(alt.fit)} fit · {alt.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            background: BT.bg.panel, border: `1px solid ${BT.border.medium}`,
            borderTop: `2px solid ${BT.text.amber}`, padding: 24, width: 400, maxWidth: '90vw',
          }}>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.amber, marginBottom: 8 }}>
              OVERRIDE CLASSIFICATION
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, marginBottom: 12 }}>
              Enter the correct asset class (multifamily, sfr, retail, office, industrial, hospitality):
            </div>
            <input
              value={overrideInput}
              onChange={e => setOverrideInput(e.target.value)}
              placeholder="e.g. multifamily"
              style={{
                width: '100%', fontFamily: MONO, fontSize: 10,
                background: BT.bg.input, color: BT.text.primary,
                border: `1px solid ${BT.border.medium}`, padding: '6px 8px',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{
                fontFamily: MONO, fontSize: 9, color: BT.text.secondary,
                background: 'transparent', border: `1px solid ${BT.border.subtle}`,
                padding: '4px 12px', cursor: 'pointer',
              }}>CANCEL</button>
              <button onClick={() => { onOverride(overrideInput); setShowModal(false); }} style={{
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

const SS_COLORS = [BT.text.cyan, BT.text.amber, BT.text.purple, BT.text.green, BT.text.orange];

function SubStrategyComparison({ subStrategies, arbitrage }: {
  subStrategies: SubStrategyScore[];
  arbitrage: { detected: boolean; winner: string; deltaPoints: number; narrative: string };
}) {
  if (!subStrategies || subStrategies.length === 0) return null;

  return (
    <SectionPanel title="SUB-STRATEGY COMPARISON" borderColor={BT.text.amber} style={{ marginBottom: 1 }}>
      {arbitrage?.detected && (
        <div style={{
          padding: '5px 10px', background: `${BT.text.amber}10`,
          borderBottom: `1px solid ${BT.border.subtle}`,
          borderLeft: `2px solid ${BT.text.amber}`,
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber, letterSpacing: 1 }}>
            ⚡ ARBITRAGE
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>
            {arbitrage.narrative}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>
            Δ {arbitrage.deltaPoints.toFixed(1)} pts
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
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                padding: '5px 8px', background: BT.bg.header,
                borderBottom: `1px solid ${BT.border.subtle}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color, letterSpacing: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {ss.name || ss.key.replace(/_/g, ' ').toUpperCase()}
                </span>
                <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0, marginLeft: 4 }}>
                  {isPrimary && <Bd c={BT.text.amber}>DETECTED ⚡</Bd>}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 8px 4px' }}>
                <ScoreRing score={ss.finalScore} color={color} size={56} />
              </div>

              <div style={{ padding: '2px 4px', borderBottom: `1px solid ${BT.border.subtle}` }}>
                <Bd c={gateColor(ss)}>{gateLabel(ss)}</Bd>
              </div>

              <DataRow label="IRR" value={fp ? `${fp.irr.toFixed(1)}%` : '—'} valueColor={BT.met.financial} />
              <DataRow label="CoC" value={fp ? `${fp.cocReturn.toFixed(1)}%` : '—'} valueColor={BT.text.cyan} />
              <DataRow label="EM" value={fp ? `${fp.equityMultiple.toFixed(2)}x` : '—'} valueColor={BT.text.amber} />
              <DataRow label="CAP" value={fp ? `${(fp.exitCapRate * 100).toFixed(2)}%` : '—'} valueColor={BT.text.secondary} />
              <DataRow label="HOLD" value={fp ? `${fp.holdMonths}mo` : '—'} valueColor={BT.text.purple} />

              <div style={{ padding: '4px 8px', borderTop: `1px solid ${BT.border.subtle}` }}>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, letterSpacing: 0.3 }}>
                  SCORE: BASE {fmtScore(ss.baseScore)} × {ss.timingMultiplier.toFixed(2)} + ADJ {fmtScore(ss.gateAdjustment)}
                </span>
              </div>

              {ss.gate?.reasons && ss.gate.reasons.length > 0 && (
                <div style={{ padding: '4px 8px', borderTop: `1px solid ${BT.border.subtle}` }}>
                  {ss.gate.reasons.slice(0, 2).map((r, ri) => (
                    <div key={ri} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, fontStyle: 'italic' }}>
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

// ─── 3. Signal × Sub-Strategy Heatmap ────────────────────────────────────────

const SIGNAL_LABELS = ['DEMAND', 'SUPPLY', 'MOMENTUM', 'POSITION', 'RISK'];
const SIGNAL_WEIGHTS: Record<string, number[]> = {
  demand: [0.30, 0.25, 0.20, 0.15, 0.10],
  supply: [0.25, 0.20, 0.25, 0.15, 0.15],
  momentum: [0.20, 0.25, 0.20, 0.25, 0.10],
  position: [0.15, 0.20, 0.20, 0.25, 0.20],
  risk: [0.10, 0.10, 0.15, 0.20, 0.45],
};

function heatColor(v: number): string {
  if (v >= 80) return BT.text.green;
  if (v >= 60) return BT.text.cyan;
  if (v >= 40) return BT.text.amber;
  return BT.text.red;
}

function SignalHeatmap({ subStrategies, signalScores }: {
  subStrategies: SubStrategyScore[];
  signalScores: { demand: number; supply: number; momentum: number; position: number; risk: number };
}) {
  if (!subStrategies || subStrategies.length === 0) return null;
  const signals = ['demand', 'supply', 'momentum', 'position', 'risk'] as const;

  return (
    <SectionPanel title="SIGNAL × STRATEGY HEATMAP" borderColor={BT.text.purple} style={{ marginBottom: 1 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: BT.bg.header }}>
              <th style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, padding: '4px 8px', textAlign: 'left', width: 90, borderRight: `1px solid ${BT.border.subtle}` }}>
                SIGNAL
              </th>
              {subStrategies.map((ss, i) => (
                <th key={ss.key} style={{ fontFamily: MONO, fontSize: 8, color: SS_COLORS[i % SS_COLORS.length], padding: '4px 8px', textAlign: 'center', borderRight: `1px solid ${BT.border.subtle}`, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ss.key.replace(/_/g, ' ').toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signals.map((sig, sIdx) => {
              const baseVal = (signalScores as any)[sig] ?? 50;
              return (
                <tr key={sig} style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: sIdx % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt }}>
                  <td style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, padding: '5px 8px', borderRight: `1px solid ${BT.border.subtle}`, letterSpacing: 0.5 }}>
                    {SIGNAL_LABELS[sIdx]}
                  </td>
                  {subStrategies.map((ss, ssIdx) => {
                    const weights = SIGNAL_WEIGHTS[sig] || [0.2, 0.2, 0.2, 0.2, 0.2];
                    const w = weights[Math.min(ssIdx, weights.length - 1)];
                    const val = Math.round(baseVal * (1 + (w - 0.2) * 0.5));
                    const c = heatColor(val);
                    return (
                      <td key={ss.key} style={{ textAlign: 'center', padding: '5px 8px', borderRight: `1px solid ${BT.border.subtle}` }}>
                        <span style={{
                          fontFamily: MONO, fontSize: 10, fontWeight: 700, color: c,
                          background: `${c}18`, padding: '2px 8px', display: 'inline-block',
                        }}>
                          {val}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: '4px 8px', borderTop: `1px solid ${BT.border.subtle}`, display: 'flex', gap: 12 }}>
          {[{ v: '≥80', c: BT.text.green }, { v: '60-79', c: BT.text.cyan }, { v: '40-59', c: BT.text.amber }, { v: '<40', c: BT.text.red }].map(item => (
            <div key={item.v} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, background: item.c, opacity: 0.8 }} />
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{item.v}</span>
            </div>
          ))}
        </div>
      </div>
    </SectionPanel>
  );
}

// ─── 4. Evidence Report ───────────────────────────────────────────────────────

interface EvidenceDrawerProps {
  row: MetricStackRow;
  onClose: () => void;
}

function EvidenceDrawer({ row, onClose }: EvidenceDrawerProps) {
  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 320,
      background: BT.bg.panel, borderLeft: `2px solid ${BT.text.cyan}`,
      zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 12px', background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.cyan }}>{row.label}</span>
        <button onClick={onClose} style={{
          fontFamily: MONO, fontSize: 9, color: BT.text.secondary,
          background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px',
        }}>✕ CLOSE</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        <DataRow label="SUBJECT" value={String(row.subject)} valueColor={BT.text.primary} />
        <DataRow label="BENCHMARK" value={String(row.benchmark)} valueColor={BT.text.cyan} />
        <DataRow label="DELTA" value={String(row.delta)} valueColor={BT.text.amber} />
        <DataRow label="$ IMPACT" value={String(row.dollarImpact)} valueColor={BT.text.green} />
        {row.source && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 4 }}>DATA SOURCE</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>{row.source}</div>
          </div>
        )}
        {row.dataQuality && (
          <div style={{ marginTop: 8 }}>
            <Bd c={row.dataQuality === 'live' ? BT.text.green : BT.text.amber}>
              {row.dataQuality.toUpperCase()}
            </Bd>
          </div>
        )}
      </div>
    </div>
  );
}

interface CompScatterProps {
  points: Array<{ name: string; x: number; y: number; isSubject: boolean; annotation?: string }>;
  title: string;
}

function CompScatter({ points, title }: CompScatterProps) {
  if (!points || points.length === 0) return (
    <div style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, padding: 16, textAlign: 'center' }}>
      <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No comp data</span>
    </div>
  );

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = 240, H = 120;

  return (
    <div style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}` }}>
      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, padding: '3px 8px', borderBottom: `1px solid ${BT.border.subtle}` }}>
        {title}
      </div>
      <svg width={W} height={H} style={{ display: 'block', padding: '8px 8px 4px' }}>
        {points.map((p, i) => {
          const cx = maxX === minX ? W / 2 : 10 + ((p.x - minX) / (maxX - minX)) * (W - 24);
          const cy = maxY === minY ? H / 2 : H - 10 - ((p.y - minY) / (maxY - minY)) * (H - 20);
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={p.isSubject ? 6 : 4}
                fill={p.isSubject ? BT.text.red : BT.text.cyan} opacity={0.85} />
              {p.annotation && (
                <text x={cx + 7} y={cy + 3} fontSize={7} fill={BT.text.muted} fontFamily={MONO}>
                  {p.annotation.slice(0, 12)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ padding: '0 8px 4px', display: 'flex', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: BT.text.red }} />
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>SUBJECT</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: BT.text.cyan }} />
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>COMP</span>
        </div>
      </div>
    </div>
  );
}

interface EvidenceReportProps {
  ss: SubStrategyScore;
  defaultExpanded: boolean;
}

function EvidenceReportBlock({ ss, defaultExpanded }: EvidenceReportProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [drawerRow, setDrawerRow] = useState<MetricStackRow | null>(null);
  const ev = ss.evidenceReport;
  const tp: ThesisPrompt | undefined = ev?.thesisPrompt;

  return (
    <>
      {drawerRow && <EvidenceDrawer row={drawerRow} onClose={() => setDrawerRow(null)} />}
      <SectionPanel
        title={`EVIDENCE — ${ss.name || ss.key.replace(/_/g, ' ').toUpperCase()}`}
        borderColor={ss.isDetectedPrimary ? BT.text.amber : BT.border.medium}
        style={{ marginBottom: 1 }}
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
              {ev?.thesis ? ev.thesis.slice(0, 120) + '...' : 'Click EXPAND to view evidence.'}
            </span>
          </div>
        ) : (
          <div>
            {/* Block A — Thesis */}
            {tp && (
              <div style={{ borderLeft: `2px solid ${BT.text.cyan}`, padding: '8px 12px', margin: '8px', background: `${BT.text.cyan}08` }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan, letterSpacing: 0.5, marginBottom: 4 }}>
                  BLOCK A — THESIS
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.primary, marginBottom: 6 }}>
                  {tp.headline}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, lineHeight: 1.6, marginBottom: 8 }}>
                  {tp.rationale}
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green, marginBottom: 4 }}>KEY DRIVERS</div>
                    {(tp.keyDrivers || []).map((d, i) => (
                      <div key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, padding: '1px 0' }}>
                        ▶ {d}
                      </div>
                    ))}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, marginBottom: 4 }}>RISK FACTORS</div>
                    {(tp.riskFactors || []).map((r, i) => (
                      <div key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, padding: '1px 0' }}>
                        ⚠ {r}
                      </div>
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
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, lineHeight: 1.6 }}>
                  {ev.thesis}
                </div>
              </div>
            )}

            {/* Block B — Metric Stack */}
            {ev?.metricStack && ev.metricStack.length > 0 && (
              <div style={{ margin: '0 8px 8px' }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, padding: '4px 0', letterSpacing: 0.5 }}>
                  BLOCK B — METRIC STACK
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px 1fr',
                  background: BT.bg.header, padding: '3px 8px',
                  borderBottom: `1px solid ${BT.border.subtle}`,
                }}>
                  {['METRIC', 'SUBJECT', 'BENCHMARK', 'DELTA', '$ IMPACT'].map(h => (
                    <span key={h} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5 }}>{h}</span>
                  ))}
                </div>
                {ev.metricStack.map((row, i) => (
                  <div
                    key={i}
                    onClick={() => setDrawerRow(row)}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 90px 90px 80px 1fr',
                      padding: '4px 8px', borderBottom: `1px solid ${BT.border.subtle}`,
                      background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
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
            )}

            {/* Block C — Comp Scatter */}
            {ev?.compEvidence && (
              <div style={{ margin: '0 8px 8px' }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, padding: '4px 0', letterSpacing: 0.5 }}>
                  BLOCK C — COMP EVIDENCE
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <CompScatter points={ev.compEvidence.tradeArea || []} title="TRADE-AREA COMPS" />
                  <CompScatter points={ev.compEvidence.likeKind || []} title="LIKE-KIND COMPS" />
                </div>
              </div>
            )}

            {/* Block D — Math Trail */}
            {ev?.mathTrail && ev.mathTrail.length > 0 && (
              <div style={{ margin: '0 8px 8px' }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, padding: '4px 0', letterSpacing: 0.5 }}>
                  BLOCK D — MATH TRAIL
                </div>
                <div style={{ background: BT.bg.input, border: `1px solid ${BT.border.subtle}`, padding: '8px 10px' }}>
                  {ev.mathTrail.map((step: MathTrailStep, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 12, padding: '3px 0',
                      borderBottom: step.isSubtotal ? `1px solid ${BT.border.medium}` : `1px solid ${BT.border.subtle}`,
                      fontWeight: step.isSubtotal ? 700 : 400,
                    }}>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, width: 20 }}>{i + 1}.</span>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: step.isSubtotal ? BT.text.amber : BT.text.secondary, flex: 1 }}>
                        {step.step}
                      </span>
                      {step.formula && (
                        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                          [{step.formula}]
                        </span>
                      )}
                      <span style={{ fontFamily: MONO, fontSize: 9, color: step.isSubtotal ? BT.text.amber : BT.text.primary, minWidth: 80, textAlign: 'right' }}>
                        {String(step.value)}
                      </span>
                      {step.sourceRef && (
                        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan }}>→ {step.sourceRef}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ultimate Return */}
            {ev?.ultimateReturn && (
              <div style={{ margin: '0 8px 8px', background: `${BT.text.green}08`, border: `1px solid ${BT.text.green}22`, padding: '8px 10px' }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green, letterSpacing: 0.5, marginBottom: 4 }}>
                  EXPECTED RETURN
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>IRR</div>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.green }}>
                      {ev.ultimateReturn.irr.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>EM</div>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.amber }}>
                      {ev.ultimateReturn.equityMultiple.toFixed(2)}x
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>HOLD</div>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.purple }}>
                      {ev.ultimateReturn.holdMonths}mo
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>EXIT CAP</div>
                    <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.cyan }}>
                      {(ev.ultimateReturn.exitCapRate * 100).toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </SectionPanel>
    </>
  );
}

// ─── 5. Correlation Timing Panel ──────────────────────────────────────────────

const GOLDEN_CHAIN_STEPS = [
  'Discovery', 'Signal Confirm', 'Entry Window', 'Acquisition',
  'Value Creation', 'Stabilization', 'Exit Prep', 'Disposition',
];

function CorrelationTimingPanel({ goldenChain, correlationAlerts, indicators }: {
  goldenChain: GoldenChain;
  correlationAlerts: CorrelationAlert[];
  indicators: { leading: Indicator[]; concurrent: Indicator[]; lagging: Indicator[] };
}) {
  return (
    <SectionPanel title="CORRELATION TIMING" borderColor={BT.text.teal} style={{ marginBottom: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {/* Golden Chain */}
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
                    width: 6, height: 6, borderRadius: '50%',
                    background: isActive ? BT.text.teal : isPast ? BT.text.green : BT.border.medium,
                    boxShadow: isActive ? `0 0 6px ${BT.text.teal}` : 'none',
                  }} />
                  <span style={{ fontFamily: MONO, fontSize: 7, color: c }}>{step.split(' ')[0].toUpperCase()}</span>
                  {i < GOLDEN_CHAIN_STEPS.length - 1 && (
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.border.medium }}>→</span>
                  )}
                </div>
              );
            })}
          </div>
          {goldenChain?.activeSignals && goldenChain.activeSignals.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {goldenChain.activeSignals.map((s, i) => (
                <div key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, padding: '1px 0' }}>
                  ◆ {s}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Correlation Alerts */}
        <div style={{ borderLeft: `1px solid ${BT.border.subtle}`, padding: '8px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 6 }}>
            ACTIVE CORRELATION ALERTS
          </div>
          {(correlationAlerts || []).map((alert, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 0', borderBottom: `1px solid ${BT.border.subtle}` }}>
              <Bd c={sevColor(alert.severity)}>{alert.correlationId}</Bd>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, flex: 1 }}>{alert.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>→ {alert.drivesPlanDimension}</span>
            </div>
          ))}
          {(!correlationAlerts || correlationAlerts.length === 0) && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No active correlation alerts.</span>
          )}
        </div>
      </div>

      {/* Indicators */}
      <div style={{ borderTop: `1px solid ${BT.border.subtle}`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
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
  1: BT.text.cyan,
  2: BT.text.green,
  3: BT.text.amber,
  4: BT.text.purple,
};

function PlanDocument({ plan, dealId }: { plan: InvestmentPlan; dealId: string }) {
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const handleApplyToProForma = async (section: string) => {
    try {
      await fetch(`/api/v1/deals/${dealId}/proforma/apply-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section }),
      });
    } catch {
      /* stub — returns button feedback */
    }
  };

  return (
    <SectionPanel title="INVESTMENT PLAN DOCUMENT" borderColor={BT.text.green} style={{ marginBottom: 1 }}>
      {/* ENTRY */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.cyan}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan, letterSpacing: 0.5 }}>
            ENTRY
          </span>
          <button onClick={() => handleApplyToProForma('entry')} style={{
            fontFamily: MONO, fontSize: 8, color: BT.text.cyan,
            background: `${BT.text.cyan}18`, border: `1px solid ${BT.text.cyan}44`,
            padding: '2px 8px', cursor: 'pointer',
          }}>APPLY TO PRO FORMA</button>
        </div>
        <DataRow label="TARGET QUARTER" value={plan.entry?.targetQuarter || '—'} valueColor={BT.text.primary} />
        <DataRow label="PRICE CEILING" value={plan.entry?.priceCeiling ? `$${(plan.entry.priceCeiling / 1e6).toFixed(1)}M` : '—'} valueColor={BT.text.amber} />
        <DataRow label="DEBT STRUCTURE" value={plan.entry?.debtStructure || '—'} valueColor={BT.text.secondary} />
        {plan.entry?.rationale && (
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, fontStyle: 'italic', marginTop: 4 }}>
            {plan.entry.rationale}
          </div>
        )}
      </div>

      {/* VALUE CREATION */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.green}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.green, letterSpacing: 0.5 }}>
            VALUE CREATION
          </span>
          <button onClick={() => handleApplyToProForma('valueCreation')} style={{
            fontFamily: MONO, fontSize: 8, color: BT.text.green,
            background: `${BT.text.green}18`, border: `1px solid ${BT.text.green}44`,
            padding: '2px 8px', cursor: 'pointer',
          }}>APPLY TO PRO FORMA</button>
        </div>
        {(plan.valueCreation || []).map((action, i) => {
          const phaseColor = PHASE_COLORS[action.phase] || BT.text.secondary;
          const key = `vc-${i}`;
          const isHovered = hoveredAction === key;
          return (
            <div
              key={i}
              onMouseEnter={() => setHoveredAction(key)}
              onMouseLeave={() => setHoveredAction(null)}
              style={{
                padding: '4px 0', borderBottom: `1px solid ${BT.border.subtle}`,
                background: isHovered ? `${phaseColor}08` : 'transparent',
              }}
            >
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <Bd c={phaseColor}>PH{action.phase}</Bd>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>{action.action}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>⏱ {action.timing}</span>
                    {action.evidenceRefs?.map((ref, ri) => (
                      <span key={ri} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan }}>§{ref}</span>
                    ))}
                    {action.correlationRefs?.map((ref, ri) => (
                      <span key={ri} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.teal }}>{ref}</span>
                    ))}
                    {action.expectedImpact && (
                      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green }}>→ {action.expectedImpact}</span>
                    )}
                  </div>
                </div>
                {action.costEstimate && (
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, flexShrink: 0 }}>
                    {action.costEstimate}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {(!plan.valueCreation || plan.valueCreation.length === 0) && (
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No value creation actions defined.</span>
        )}
      </div>

      {/* HOLD STRUCTURE */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.amber}` }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber, letterSpacing: 0.5 }}>
          HOLD STRUCTURE
        </span>
        <DataRow label="TARGET HOLD" value={plan.holdStructure?.targetHoldMonths ? `${plan.holdStructure.targetHoldMonths}mo` : '—'} valueColor={BT.text.primary} />
        {plan.holdStructure?.exitWindows && plan.holdStructure.exitWindows.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>EXIT WINDOWS</div>
            {plan.holdStructure.exitWindows.map((w, i) => (
              <div key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, padding: '1px 0' }}>◆ {w}</div>
            ))}
          </div>
        )}
        {plan.holdStructure?.rationale && (
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, fontStyle: 'italic', marginTop: 4 }}>
            {plan.holdStructure.rationale}
          </div>
        )}
      </div>

      {/* EXIT */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.purple}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.purple, letterSpacing: 0.5 }}>
            EXIT
          </span>
          <button onClick={() => handleApplyToProForma('exit')} style={{
            fontFamily: MONO, fontSize: 8, color: BT.text.purple,
            background: `${BT.text.purple}18`, border: `1px solid ${BT.text.purple}44`,
            padding: '2px 8px', cursor: 'pointer',
          }}>APPLY TO PRO FORMA</button>
        </div>
        <DataRow label="TARGET QUARTER" value={plan.exit?.targetQuarter || '—'} valueColor={BT.text.primary} />
        <DataRow label="BUYER TYPE" value={plan.exit?.buyerType || '—'} valueColor={BT.text.cyan} />
        <DataRow label="EXIT CAP" value={plan.exit?.capRate ? `${(plan.exit.capRate * 100).toFixed(2)}%` : '—'} valueColor={BT.text.amber} />
        {plan.exit?.expectedIRR && (
          <DataRow label="EXPECTED IRR" value={`${(plan.exit.expectedIRR[0] * 100).toFixed(1)}–${(plan.exit.expectedIRR[1] * 100).toFixed(1)}%`} valueColor={BT.text.green} />
        )}
        {plan.exit?.activeBuyers && plan.exit.activeBuyers.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>ACTIVE BUYERS</div>
            {plan.exit.activeBuyers.map((b, i) => (
              <div key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, padding: '1px 0' }}>◆ {b}</div>
            ))}
          </div>
        )}
      </div>

      {/* PIVOT CONDITIONS */}
      {plan.pivotConditions && plan.pivotConditions.length > 0 && (
        <div style={{ padding: '8px 12px', borderLeft: `2px solid ${BT.text.purple}` }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.purple, letterSpacing: 0.5 }}>
            PIVOT CONDITIONS
          </span>
          {plan.pivotConditions.map((pivot, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
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

function MonitoringDashboard({ monitoring }: { monitoring: MonitoringItem[] }) {
  if (!monitoring || monitoring.length === 0) return null;

  return (
    <SectionPanel title="MONITORING DASHBOARD" borderColor={BT.text.orange} style={{ marginBottom: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1 }}>
        {monitoring.map((item, i) => {
          const sColor = sevColor(item.severity);
          return (
            <div key={i} style={{
              padding: '8px 10px', background: BT.bg.panelAlt,
              border: `1px solid ${sColor}33`, borderLeft: `2px solid ${sColor}`,
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <Bd c={sColor}>{item.correlationId}</Bd>
                <Bd c={sColor}>{item.severity.toUpperCase()}</Bd>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.metric}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                  NOW: <span style={{ color: BT.text.primary }}>{item.currentValue}</span>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                  TRIGGER: <span style={{ color: sColor }}>{item.triggerThreshold}</span>
                </div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, fontStyle: 'italic' }}>
                {item.action}
              </div>
            </div>
          );
        })}
      </div>
    </SectionPanel>
  );
}

// ─── 8. AI Coordinator Narrative ─────────────────────────────────────────────

function AICoordinatorNarrative({ narrative }: { narrative: string }) {
  return (
    <div style={{
      borderTop: `1px solid ${BT.border.medium}`,
      borderBottom: `1px solid ${BT.border.medium}`,
      padding: '10px 14px',
      background: BT.bg.panelAlt,
      margin: '1px 0',
    }}>
      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 6 }}>
        AI COORDINATOR NARRATIVE
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary, lineHeight: 1.7, fontStyle: 'italic' }}>
        {narrative || 'No coordinator narrative available for this deal.'}
      </div>
    </div>
  );
}

// ─── Legacy tabs for non-v2 content ──────────────────────────────────────────

function LegacySignalMatrixTab({ city, state: st }: { city: string; state: string }) {
  const { report, loading, error } = useCorrelationReport(city, st);
  if (loading) return <div style={{ padding: 24, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>Loading signal matrix...</div>;
  if (error) return <div style={{ padding: 12, fontFamily: MONO, fontSize: 10, color: BT.text.red }}>ERROR: {error}</div>;
  if (!report) return <div style={{ padding: 24, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>No correlation data available.</div>;
  const sum = report.summary ?? { bullishSignals: 0, bearishSignals: 0, neutralSignals: 0, insufficientData: 0 };
  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: BT.border.subtle, marginBottom: 4 }}>
        {[{ l: 'BULLISH', v: sum.bullishSignals, c: BT.text.green }, { l: 'BEARISH', v: sum.bearishSignals, c: BT.text.red }, { l: 'NEUTRAL', v: sum.neutralSignals, c: BT.text.secondary }, { l: 'INSUFF', v: sum.insufficientData, c: BT.text.muted }].map(item => (
          <div key={item.l} style={{ background: BT.bg.panel, padding: '6px 10px' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{item.l}</div>
            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: item.c }}>{item.v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
        {report.market}, {report.state} · {report.metricsComputed} computed · {report.computedAt ? new Date(report.computedAt).toLocaleString() : ''}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface StrategyArbitragePageProps {
  dealId: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

const TAB_LABELS = ['M08 v2 ANALYSIS', 'SIGNAL MATRIX', 'CUSTOM SCREENS'];

export function StrategyArbitragePage({ dealId, deal: _deal, dealType: _dealType }: StrategyArbitragePageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = dealId || params.dealId || params.id || '';

  const { analysis, loading, error, confirmDetection, overrideClassification, refresh } = useStrategyAnalysisV2(resolvedDealId);
  const [activeTab, setActiveTab] = useState(0);
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  const city = useDealStore(s => s.identity.city) || 'Atlanta';
  const stateName = useDealStore(s => s.identity.state) || 'GA';

  const handleConfirm = useCallback(() => confirmDetection(true), [confirmDetection]);
  const handleOverride = useCallback((ac: string) => overrideClassification(ac), [overrideClassification]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="STRATEGY INTELLIGENCE"
        subtitle="M08 v2 · DETECTION-FIRST ARCHITECTURE"
        borderColor={BT.text.amber}
        metrics={[
          { l: 'DETECT', c: BT.text.cyan },
          { l: 'SCORE', c: BT.text.amber },
          { l: 'EVIDENCE', c: BT.text.green },
          { l: 'PLAN', c: BT.text.purple },
        ]}
        right={
          loading
            ? <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber, animation: 'bt-pulse 1.2s infinite' }}>COMPUTING M08 v2...</span>
            : analysis
              ? <Bd c={BT.text.green}>ANALYZED</Bd>
              : error
                ? <Bd c={BT.text.red}>ERROR</Bd>
                : <Bd c={BT.text.muted}>NOT LOADED</Bd>
        }
      />

      <SubTabBar tabs={TAB_LABELS} active={activeTab} setActive={setActiveTab} color={BT.text.amber} />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeTab === 0 && (
          <>
            {loading && (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ fontFamily: MONO, fontSize: 11, color: BT.text.amber, animation: 'bt-pulse 1.2s infinite' }}>
                  RUNNING M08 v2 ANALYSIS...
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginTop: 8 }}>
                  Detecting asset class · Scoring sub-strategies · Building evidence · Formulating plan
                </div>
              </div>
            )}

            {error && !loading && (
              <div style={{ margin: 12, padding: 12, borderLeft: `2px solid ${BT.text.red}`, background: `${BT.text.red}08` }}>
                <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.red, marginBottom: 4 }}>ANALYSIS ERROR</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>{error}</div>
                <button onClick={refresh} style={{
                  marginTop: 8, fontFamily: MONO, fontSize: 9, color: BT.text.amber,
                  background: `${BT.text.amber}18`, border: `1px solid ${BT.text.amber}44`,
                  padding: '3px 10px', cursor: 'pointer',
                }}>RETRY</button>
              </div>
            )}

            {!loading && !error && !analysis && (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ fontFamily: MONO, fontSize: 11, color: BT.text.muted }}>No analysis available.</div>
                <button onClick={refresh} style={{
                  marginTop: 12, fontFamily: MONO, fontSize: 9, color: BT.text.cyan,
                  background: `${BT.text.cyan}18`, border: `1px solid ${BT.text.cyan}44`,
                  padding: '4px 12px', cursor: 'pointer',
                }}>RUN ANALYSIS</button>
              </div>
            )}

            {!loading && analysis && (
              <>
                {/* Detection Banner */}
                <DetectionBanner
                  detection={analysis.detection}
                  onConfirm={handleConfirm}
                  onOverride={handleOverride}
                  showModal={showOverrideModal}
                  setShowModal={setShowOverrideModal}
                />

                {/* Confirmation Modal for low-confidence */}
                {analysis.detection.requiresUserConfirmation && !analysis.detection.userConfirmed && (
                  <div style={{
                    padding: '6px 12px', background: `${BT.text.amber}10`,
                    borderLeft: `2px solid ${BT.text.amber}`,
                    borderBottom: `1px solid ${BT.border.subtle}`,
                    display: 'flex', gap: 10, alignItems: 'center',
                  }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>
                      ⚠ CONFIDENCE BELOW 70% — CONFIRM DETECTION BEFORE SCORING PROCEEDS
                    </span>
                    <button onClick={handleConfirm} style={{
                      fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.green,
                      background: `${BT.text.green}18`, border: `1px solid ${BT.text.green}44`,
                      padding: '2px 10px', cursor: 'pointer',
                    }}>CONFIRM DETECTION</button>
                  </div>
                )}

                {/* Sub-Strategy Comparison */}
                <SubStrategyComparison
                  subStrategies={analysis.subStrategies}
                  arbitrage={analysis.arbitrage}
                />

                {/* Signal Heatmap */}
                <SignalHeatmap
                  subStrategies={analysis.subStrategies}
                  signalScores={analysis.signalScores}
                />

                {/* Evidence Reports */}
                {analysis.subStrategies.map((ss, i) => (
                  <EvidenceReportBlock key={ss.key} ss={ss} defaultExpanded={ss.isDetectedPrimary} />
                ))}

                {/* Correlation Timing Panel */}
                <CorrelationTimingPanel
                  goldenChain={analysis.goldenChain}
                  correlationAlerts={analysis.correlationAlerts}
                  indicators={analysis.indicators}
                />

                {/* Plan Document */}
                <PlanDocument plan={analysis.plan} dealId={resolvedDealId} />

                {/* Monitoring Dashboard */}
                <MonitoringDashboard monitoring={analysis.plan?.monitoring || []} />

                {/* AI Coordinator Narrative */}
                <AICoordinatorNarrative narrative={analysis.coordinatorNarrative} />

                <div style={{ height: 24 }} />
              </>
            )}
          </>
        )}

        {activeTab === 1 && (
          <LegacySignalMatrixTab city={city} state={stateName} />
        )}

        {activeTab === 2 && (
          <CustomScreenTab dealId={resolvedDealId} />
        )}
      </div>
    </div>
  );
}

export default StrategyArbitragePage;
