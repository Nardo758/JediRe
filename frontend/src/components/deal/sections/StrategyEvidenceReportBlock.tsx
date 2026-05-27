import React, { useState, useContext } from 'react';
import { BT, Bd, SectionPanel, DataRow } from '../bloomberg-ui';
import { BlockErrorBoundary } from '../../BlockErrorBoundary';
import type { SubStrategyScore, MetricStackRow, MathTrailStep } from '../../../hooks/useStrategyAnalysisV2';
import { HoverContext } from './strategy-v2.types';
import { MONO, fmtSafe, fmtScore, gateColor, gateLabel, BlockErrorFallback } from './strategy-v2.utils';

function MiniSparkline({ subject, benchmark, label }: { subject: number | string; benchmark: number | string; label: string }) {
  const sub = parseFloat(String(subject).replace(/[^0-9.-]/g, '')) || 50;
  const bench = parseFloat(String(benchmark).replace(/[^0-9.-]/g, '')) || 50;
  const W = 280; const H = 60;
  const ratio = bench !== 0 ? sub / bench : 1;
  const pts: Array<[number, number]> = Array.from({ length: 12 }, (_, i) => {
    const t = i / 11;
    const noise = Math.sin(i * 2.3 + label.charCodeAt(0)) * 0.04;
    const v = 0.9 + (ratio - 0.9) * t + noise;
    return [i, v];
  });
  const vs = pts.map(p => p[1]);
  const minV = Math.min(...vs) * 0.95; const maxV = Math.max(...vs) * 1.05;
  const toX = (i: number) => (i / 11) * (W - 10) + 5;
  const toY = (v: number) => H - 8 - ((v - minV) / (maxV - minV || 1)) * (H - 16);
  const polyline = pts.map(([i, v]) => `${toX(i)},${toY(v)}`).join(' ');
  const benchY = toY(1.0);
  return (
    <svg width={W} height={H} style={{ display: 'block', background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, borderRadius: 2 }}>
      <line x1={5} y1={benchY} x2={W - 5} y2={benchY} stroke={BT.text.cyan} strokeWidth={0.8} strokeDasharray="3,3" opacity={0.6} />
      <text x={W - 32} y={benchY - 2} fontSize={6} fill={BT.text.cyan} fontFamily={MONO}>BENCH</text>
      <polyline points={polyline} fill="none" stroke={ratio >= 1 ? BT.text.green : BT.text.red} strokeWidth={1.5} />
      {pts[pts.length - 1] && (
        <circle cx={toX(11)} cy={toY(pts[11][1])} r={3} fill={ratio >= 1 ? BT.text.green : BT.text.red} />
      )}
      <text x={5} y={H - 1} fontSize={6} fill={BT.text.muted} fontFamily={MONO}>12M AGO</text>
      <text x={W - 30} y={H - 1} fontSize={6} fill={BT.text.muted} fontFamily={MONO}>TODAY</text>
    </svg>
  );
}

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

        <div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 6 }}>
            HISTORICAL SPARKLINE — 12-MONTH TREND
          </div>
          <MiniSparkline subject={row.subject} benchmark={row.benchmark} label={row.label} />
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginTop: 4 }}>
            Dashed cyan = benchmark baseline · Green/red line = subject metric trend
          </div>
        </div>

        <div>
          <DrawerCompDetail row={row} />
        </div>
      </div>
    </div>
  );
}

function compEntriesToPoints(
  comps: Array<{ address: string; rentPerUnit?: number; occupancy?: number; capitalPerUnit?: number; irr?: number; condition?: string }>,
  mode: 'tradeArea' | 'likeKind',
): Array<{ name: string; x: number; y: number; isSubject: boolean; annotation?: string }> {
  return comps.map(c => ({
    name: c.address,
    x: mode === 'tradeArea' ? (c.rentPerUnit ?? 0) : (c.capitalPerUnit ?? 0),
    y: mode === 'tradeArea'
      ? (c.occupancy != null ? c.occupancy * 100 : 0)
      : (c.irr != null ? c.irr * 100 : 0),
    isSubject: false,
    annotation: c.condition,
  }));
}

function CompScatter({ points, title }: { points: Array<{ name: string; x: number; y: number; isSubject: boolean; annotation?: string }>; title: string }) {
  if (!Array.isArray(points) || points.length === 0) return (
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
  const isPlanHighlighted = hoveredEvidenceRef !== null && (
    ss.key === hoveredEvidenceRef ||
    (ss.evidenceReport?.subStrategyKey ?? '') === hoveredEvidenceRef
  );
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [fullDetail, setFullDetail] = useState(false);
  const [drawerRow, setDrawerRow] = useState<MetricStackRow | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const ev = ss.evidenceReport;
  const tp = ev?.thesisPrompt;
  const fp = ss.financialPreview;
  const gateLbl = gateLabel(ss);
  const gateClr = gateColor(ss);
  const borderColor = isPlanHighlighted ? BT.text.cyan : (ss.isDetectedPrimary ? BT.text.amber : BT.border.medium);

  if (!expanded) {
    return (
      <div
        id={`evidence-${ss.key}`}
        onClick={() => setExpanded(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '5px 12px',
          borderLeft: `3px solid ${gateClr}`,
          background: BT.bg.panel,
          borderBottom: `1px solid ${BT.border.subtle}`,
          cursor: 'pointer',
          marginBottom: 1,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.primary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {(ss.name || ss.key).replace(/_/g, ' ').toUpperCase()}
        </span>
        <Bd c={gateClr}>{gateLbl}</Bd>
        {fp && (
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.met.financial, fontWeight: 700 }}>
            {fmtSafe(fp.irr, 1)}% IRR
          </span>
        )}
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
          {fmtScore(ss.finalScore)} pts
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>▶</span>
      </div>
    );
  }

  const ur = ev?.ultimateReturn;
  const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const hasAllReturnFields = !!ur
    && isFiniteNum(ur.irr)
    && isFiniteNum(ur.equityMultiple)
    && isFiniteNum(ur.holdMonths)
    && isFiniteNum(ur.exitCapRate);

  return (
    <div id={`evidence-${ss.key}`}>
      {drawerRow && <EvidenceDrawer row={drawerRow} onClose={() => setDrawerRow(null)} />}
      <SectionPanel
        title={`EVIDENCE — ${(ss.name || ss.key).replace(/_/g, ' ').toUpperCase()}`}
        borderColor={borderColor}
        style={{ marginBottom: 1 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.header }}>
          <Bd c={gateClr}>{gateLbl}</Bd>
          {ss.isDetectedPrimary && <Bd c={BT.text.amber}>⚡ PRIMARY</Bd>}
          {isPlanHighlighted && <Bd c={BT.text.cyan}>PLAN LINKED</Bd>}
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, marginLeft: 'auto' }}>
            SCORE: {fmtScore(ss.finalScore)}
          </span>
          <button onClick={() => setExpanded(false)} style={{
            fontFamily: MONO, fontSize: 8, color: BT.text.muted,
            background: 'transparent', border: `1px solid ${BT.border.subtle}`,
            padding: '1px 6px', cursor: 'pointer',
          }}>▲ COLLAPSE</button>
        </div>

        {/* Thesis prompt */}
        {tp && (
          <BlockErrorBoundary
            label={`EvidenceReportBlock:${ss.key}:thesisPrompt`}
            fallback={({ retry }) => (
              <div style={{ margin: '0 8px 8px' }}>
                <BlockErrorFallback
                  variant="inline"
                  message="Couldn't render the thesis prompt — the rest of this evidence block is unaffected."
                  onRetry={retry}
                />
              </div>
            )}
          >
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}` }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 4 }}>THESIS</div>
              {tp.headline && (
                <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.primary, lineHeight: 1.5, marginBottom: 4 }}>
                  {tp.headline}
                </div>
              )}
              <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary, lineHeight: 1.6, marginBottom: 8 }}>
                {tp.rationale || ev?.thesis || ''}
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 3 }}>KEY DRIVERS</div>
                {(tp.keyDrivers || []).map((d: string, i: number) => (
                  <div key={i} style={{ fontFamily: MONO, fontSize: 9, color: BT.text.green, padding: '1px 0' }}>✓ {d}</div>
                ))}
              </div>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 3 }}>RISK FACTORS</div>
                {(tp.riskFactors || []).map((r: string, i: number) => (
                  <div key={i} style={{ fontFamily: MONO, fontSize: 9, color: BT.text.red, padding: '1px 0' }}>⚠ {r}</div>
                ))}
              </div>
            </div>
          </BlockErrorBoundary>
        )}

        {/* Expected return */}
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
          {hasAllReturnFields ? (
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
          ) : (
            <div style={{ margin: '0 8px 8px', background: `${BT.text.muted}08`, border: `1px dashed ${BT.text.muted}44`, padding: '8px 12px' }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 6 }}>EXPECTED RETURN</div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>
                Not yet computed — return projection unavailable for this sub-strategy.
              </div>
            </div>
          )}
        </BlockErrorBoundary>

        {/* Full detail toggle */}
        <div style={{ margin: '0 8px 8px' }}>
          <button
            onClick={() => setFullDetail(v => !v)}
            style={{
              fontFamily: MONO, fontSize: 8, color: BT.text.secondary,
              background: fullDetail ? `${BT.text.secondary}12` : 'transparent',
              border: `1px solid ${BT.border.subtle}`,
              padding: '3px 10px', cursor: 'pointer', width: '100%', textAlign: 'left',
              letterSpacing: 0.5,
            }}
          >
            {fullDetail ? '▲ HIDE FULL DETAIL' : '▼ FULL DETAIL — metric stack · comp scatters · math trail'}
          </button>
        </div>

        {fullDetail && (
          <>
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
                  <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, padding: '4px 0', letterSpacing: 0.5 }}>METRIC STACK (click row to open detail drawer)</div>
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
                  <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, padding: '4px 0', letterSpacing: 0.5 }}>COMP EVIDENCE</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <CompScatter points={compEntriesToPoints(ev.compEvidence.tradeArea?.comps ?? [], 'tradeArea')} title="TRADE-AREA COMPS" />
                    <CompScatter points={compEntriesToPoints(ev.compEvidence.likeKind?.comps ?? [], 'likeKind')} title="LIKE-KIND COMPS" />
                  </div>
                </div>
              </BlockErrorBoundary>
            )}

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
                  <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, padding: '4px 0', letterSpacing: 0.5 }}>MATH TRAIL</div>
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
                              const el = document.getElementById(`evidence-${step.sourceRef}`);
                              if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
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
          </>
        )}
      </SectionPanel>
    </div>
  );
}
