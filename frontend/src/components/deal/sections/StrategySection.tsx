/**
 * Strategy Section — M08 v2 Detection-First
 * Replaces the v1 BTS/Flip/Rental/STR mock-data-backed section with
 * the live M08 v2 detection engine. All mock data imports removed.
 */

import React, { useState } from 'react';
import { Deal } from '../../../types/deal';
import { BT, BT_CSS, PanelHeader, Bd, SectionPanel, DataRow } from '../bloomberg-ui';
import { useStrategyAnalysisV2 } from '../../../hooks/useStrategyAnalysisV2';
import type {
  SubStrategyScore, CorrelationAlert, GoldenChain, Indicator,
  InvestmentPlan, MonitoringItem,
} from '../../../hooks/useStrategyAnalysisV2';
import { CustomScreenTab } from './CustomScreenTab';

const MONO = BT.font.mono;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confColor(c: number) { return c >= 0.85 ? BT.text.green : c >= 0.70 ? BT.text.amber : BT.text.red; }
function sevColor(s: 'critical' | 'warning' | 'info') { return s === 'critical' ? BT.text.red : s === 'warning' ? BT.text.amber : BT.text.cyan; }
const SS_COLORS = [BT.text.cyan, BT.text.amber, BT.text.purple, BT.text.green, BT.text.orange];

function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }

function ScoreRing({ score, color, size = 48 }: { score: number; color: string; size?: number }) {
  const s = Math.min(100, Math.max(0, Number(score ?? 0)));
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (s / 100) * circ;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}20`} strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4} strokeLinecap="round" />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={11} fontWeight={700} fontFamily={MONO}>{Math.round(s)}</text>
    </svg>
  );
}

// ─── Detection Summary strip ───────────────────────────────────────────────────

function DetectionStrip({ detection, onConfirm }: { detection: any; onConfirm: () => void }) {
  const c = detection.confidence;
  const cColor = confColor(c);
  return (
    <div style={{
      borderLeft: `3px solid ${BT.text.cyan}`, background: `${BT.text.cyan}08`,
      padding: '6px 10px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      borderBottom: `1px solid ${BT.border.subtle}`,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan }}>DETECTED</span>
      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.primary }}>
        {(detection.assetClass || '').toUpperCase().replace(/_/g, ' ')} · {(detection.detectedDealType || '').replace(/_/g, ' ').toUpperCase()}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
        [{(detection.detectedSubStrategy || '').replace(/_/g, ' ')}]
      </span>
      <span style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 700, color: cColor,
        background: `${cColor}18`, border: `1px solid ${cColor}33`, padding: '1px 6px',
      }}>{pct(c)}</span>
      {detection.requiresUserConfirmation && !detection.userConfirmed && (
        <button onClick={onConfirm} style={{
          fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.green,
          background: `${BT.text.green}18`, border: `1px solid ${BT.text.green}44`,
          padding: '2px 8px', cursor: 'pointer',
        }}>CONFIRM</button>
      )}
      {detection.userConfirmed && <Bd c={BT.text.green}>CONFIRMED</Bd>}
    </div>
  );
}

// ─── Sub-Strategy cards ────────────────────────────────────────────────────────

function SubStrategyCards({ subStrategies }: { subStrategies: SubStrategyScore[] }) {
  if (!subStrategies || subStrategies.length === 0) return null;
  return (
    <div style={{ display: 'flex', overflowX: 'auto', gap: 1 }}>
      {subStrategies.map((ss, idx) => {
        const color = SS_COLORS[idx % SS_COLORS.length];
        const fp = ss.financialPreview;
        const isPrimary = ss.isDetectedPrimary;
        return (
          <div key={ss.key} style={{
            flex: '0 0 160px', borderTop: isPrimary ? `2px solid ${BT.text.amber}` : `1px solid ${BT.border.subtle}`,
            background: isPrimary ? `${BT.text.amber}06` : BT.bg.panel, display: 'flex', flexDirection: 'column',
            borderRight: `1px solid ${BT.border.subtle}`,
          }}>
            <div style={{ padding: '4px 8px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(ss.name || ss.key).replace(/_/g, ' ').toUpperCase()}
              </span>
              {isPrimary && <Bd c={BT.text.amber}>⚡</Bd>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
              <ScoreRing score={ss.finalScore} color={color} size={48} />
            </div>
            <DataRow label="IRR" value={fp ? `${fp.irr.toFixed(1)}%` : '—'} valueColor={BT.met.financial} />
            <DataRow label="EM" value={fp ? `${fp.equityMultiple.toFixed(2)}x` : '—'} valueColor={BT.text.amber} />
            <DataRow label="HOLD" value={fp ? `${fp.holdMonths}mo` : '—'} valueColor={BT.text.purple} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Plan Summary strip ───────────────────────────────────────────────────────

function PlanSummaryStrip({ plan }: { plan: InvestmentPlan }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: BT.border.subtle }}>
      {[
        { l: 'TARGET QUARTER', v: plan.entry?.targetQuarter || '—', c: BT.text.cyan },
        { l: 'HOLD', v: plan.holdStructure?.targetHoldMonths ? `${plan.holdStructure.targetHoldMonths}mo` : '—', c: BT.text.amber },
        { l: 'EXIT CAP', v: plan.exit?.capRate ? `${(plan.exit.capRate * 100).toFixed(2)}%` : '—', c: BT.text.purple },
        { l: 'BUYER TYPE', v: plan.exit?.buyerType || '—', c: BT.text.green },
      ].map(item => (
        <div key={item.l} style={{ background: BT.bg.panel, padding: '6px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5 }}>{item.l}</div>
          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: item.c, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.v}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Monitoring strip ─────────────────────────────────────────────────────────

function MonitoringStrip({ monitoring }: { monitoring: MonitoringItem[] }) {
  if (!monitoring || monitoring.length === 0) return null;
  return (
    <div style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
      {monitoring.slice(0, 3).map((item, i) => (
        <div key={i} style={{
          display: 'flex', gap: 8, alignItems: 'center', padding: '4px 10px',
          borderBottom: `1px solid ${BT.border.subtle}`,
          borderLeft: `2px solid ${sevColor(item.severity)}`,
        }}>
          <Bd c={sevColor(item.severity)}>{item.correlationId}</Bd>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, flex: 1 }}>{item.metric}</span>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
            {item.currentValue} / {item.triggerThreshold}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Coordinator snippet ──────────────────────────────────────────────────────

function CoordinatorSnippet({ narrative }: { narrative: string }) {
  return (
    <div style={{
      borderTop: `1px solid ${BT.border.medium}`, padding: '8px 12px',
      background: BT.bg.panelAlt, fontFamily: MONO, fontSize: 9,
      color: BT.text.secondary, lineHeight: 1.6, fontStyle: 'italic',
    }}>
      {narrative ? narrative.slice(0, 300) + (narrative.length > 300 ? '...' : '') : 'No coordinator narrative.'}
    </div>
  );
}

// ─── Main StrategySection component ──────────────────────────────────────────

export interface StrategySectionProps {
  deal: Deal;
}

type Tab = 'detection' | 'plan' | 'monitoring' | 'custom';

const TABS: { id: Tab; label: string }[] = [
  { id: 'detection', label: 'DETECTION' },
  { id: 'plan', label: 'PLAN' },
  { id: 'monitoring', label: 'MONITORING' },
  { id: 'custom', label: 'CUSTOM SCREEN' },
];

export const StrategySection: React.FC<StrategySectionProps> = ({ deal }) => {
  const [activeTab, setActiveTab] = useState<Tab>('detection');
  const { analysis, loading, error, confirmDetection, refresh } = useStrategyAnalysisV2(deal.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 10px', background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`, borderTop: `2px solid ${BT.text.amber}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.primary, letterSpacing: 0.8 }}>
            STRATEGY ARBITRAGE
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>M08 v2 · DETECTION-FIRST</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {loading && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber, animation: 'bt-pulse 1.2s infinite' }}>
              COMPUTING...
            </span>
          )}
          {!loading && analysis && <Bd c={BT.text.green}>LIVE</Bd>}
          {!loading && error && <Bd c={BT.text.red}>ERROR</Bd>}
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{
        display: 'flex', background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`, flexShrink: 0, height: 26, alignItems: 'stretch',
      }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            fontFamily: MONO, fontSize: 9, fontWeight: activeTab === tab.id ? 700 : 500,
            padding: '0 12px', background: 'transparent', border: 'none',
            borderBottom: activeTab === tab.id ? `2px solid ${BT.text.amber}` : '2px solid transparent',
            color: activeTab === tab.id ? BT.text.amber : BT.text.secondary,
            cursor: 'pointer', whiteSpace: 'nowrap' as const, letterSpacing: 0.5,
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {activeTab === 'custom' && <CustomScreenTab dealId={deal.id} />}

        {activeTab !== 'custom' && loading && (
          <div style={{ padding: 32, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.amber, animation: 'bt-pulse 1.2s infinite' }}>
            RUNNING M08 v2 ANALYSIS...
          </div>
        )}

        {activeTab !== 'custom' && error && !loading && (
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

        {activeTab !== 'custom' && !loading && !error && !analysis && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: BT.text.muted }}>No analysis data available.</div>
            <button onClick={refresh} style={{
              marginTop: 12, fontFamily: MONO, fontSize: 9, color: BT.text.cyan,
              background: `${BT.text.cyan}18`, border: `1px solid ${BT.text.cyan}44`,
              padding: '4px 12px', cursor: 'pointer',
            }}>RUN ANALYSIS</button>
          </div>
        )}

        {activeTab === 'detection' && !loading && analysis && (
          <>
            <DetectionStrip detection={analysis.detection} onConfirm={() => confirmDetection(true)} />

            {analysis.arbitrage?.detected && (
              <div style={{
                padding: '5px 10px', background: `${BT.text.amber}10`,
                borderLeft: `2px solid ${BT.text.amber}`,
                borderBottom: `1px solid ${BT.border.subtle}`,
                display: 'flex', gap: 10, alignItems: 'center',
              }}>
                <Bd c={BT.text.amber}>⚡ ARBITRAGE</Bd>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>
                  {analysis.arbitrage.narrative}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>
                  Δ {analysis.arbitrage.deltaPoints.toFixed(1)} pts
                </span>
              </div>
            )}

            <SubStrategyCards subStrategies={analysis.subStrategies} />

            {analysis.subStrategies[0]?.evidenceReport?.thesisPrompt && (
              <div style={{ borderLeft: `2px solid ${BT.text.cyan}`, padding: '8px 12px', margin: '8px', background: `${BT.text.cyan}08` }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan, marginBottom: 4 }}>PRIMARY THESIS</div>
                <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.primary, marginBottom: 4 }}>
                  {analysis.subStrategies[0].evidenceReport.thesisPrompt.headline}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, lineHeight: 1.6 }}>
                  {analysis.subStrategies[0].evidenceReport.thesisPrompt.rationale}
                </div>
              </div>
            )}

            <CoordinatorSnippet narrative={analysis.coordinatorNarrative} />
          </>
        )}

        {activeTab === 'plan' && !loading && analysis && (
          <>
            <PlanSummaryStrip plan={analysis.plan} />

            <div style={{ padding: '0 0 8px' }}>
              {/* Value Creation Actions */}
              <div style={{ padding: '8px 12px', borderLeft: `2px solid ${BT.text.green}`, margin: '8px' }}>
                <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.green, letterSpacing: 0.5, marginBottom: 6 }}>
                  VALUE CREATION SEQUENCE
                </div>
                {(analysis.plan.valueCreation || []).map((action, i) => (
                  <div key={i} style={{ padding: '4px 0', borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <Bd c={BT.text.cyan}>PH{action.phase}</Bd>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>{action.action}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>⏱ {action.timing}</span>
                          {action.expectedImpact && (
                            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green }}>→ {action.expectedImpact}</span>
                          )}
                        </div>
                      </div>
                      {action.costEstimate && (
                        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber }}>{action.costEstimate}</span>
                      )}
                    </div>
                  </div>
                ))}
                {(!analysis.plan.valueCreation || analysis.plan.valueCreation.length === 0) && (
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No value creation actions defined.</span>
                )}
              </div>

              {/* Pivot Conditions */}
              {(analysis.plan.pivotConditions || []).length > 0 && (
                <div style={{ padding: '8px 12px', borderLeft: `2px solid ${BT.text.purple}`, margin: '0 8px 8px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.purple, letterSpacing: 0.5, marginBottom: 4 }}>
                    PIVOT CONDITIONS
                  </div>
                  {(analysis.plan.pivotConditions || []).map((pivot, i) => (
                    <div key={i} style={{ padding: '4px 0', borderBottom: `1px solid ${BT.border.subtle}` }}>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>⚡ {pivot.trigger}</div>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan }}>→ {pivot.pivotTo}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'monitoring' && !loading && analysis && (
          <>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}` }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
                MONITORING {(analysis.plan?.monitoring || []).length} ACTIVE TRIGGERS
              </div>
            </div>

            <MonitoringStrip monitoring={analysis.plan?.monitoring || []} />

            {analysis.correlationAlerts?.map((alert, i) => (
              <div key={i} style={{
                padding: '6px 10px', borderBottom: `1px solid ${BT.border.subtle}`,
                borderLeft: `2px solid ${alert.severity === 'critical' ? BT.text.red : alert.severity === 'warning' ? BT.text.amber : BT.text.cyan}`,
                display: 'flex', gap: 8, alignItems: 'center',
              }}>
                <Bd c={sevColor(alert.severity)}>{alert.correlationId}</Bd>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, flex: 1 }}>{alert.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>→ {alert.drivesPlanDimension}</span>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber }}>{alert.value}</span>
              </div>
            ))}

            {(!analysis.plan?.monitoring || analysis.plan.monitoring.length === 0) && (!analysis.correlationAlerts || analysis.correlationAlerts.length === 0) && (
              <div style={{ padding: 24, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.muted }}>
                No active monitoring triggers.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default StrategySection;
