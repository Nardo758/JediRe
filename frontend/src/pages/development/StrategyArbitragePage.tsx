import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, SubTabBar, SectionPanel, DataRow, Bd, Spark, BtTabWrapper,
} from '../../components/deal/bloomberg-ui';
import { useStrategyArbitrage } from '../../hooks/useStrategyArbitrageM08';
import { useDealStore } from '../../stores/dealStore';
import type { M08StrategyScore } from '../../stores/dealStore';
import { CustomScreenTab } from '../../components/deal/sections/CustomScreenTab';
import { useCorrelationReport } from '../../hooks/useCorrelationReport';
import type { CorrelationResult } from '../../hooks/useCorrelationReport';
import { useDriverAnalysis } from '../../hooks/useDriverAnalysis';
import type { DriverResult } from '../../hooks/useDriverAnalysis';
import { useLeadLagRelationships } from '../../hooks/useLeadLagRelationships';

interface StrategyArbitragePageProps {
  dealId: string;
  deal?: Record<string, unknown>;
  dealType?: string;
}

const MONO = BT.font.mono;

type StrategyColDef = { id: string; label: string; color: string; aliases: string[] };
const STRATEGY_COLS: StrategyColDef[] = [
  { id: 'bts',    label: 'BTS',    color: BT.text.purple, aliases: ['bts', 'build_to_suit', 'build-to-suit', 'build to suit'] },
  { id: 'flip',   label: 'FLIP',   color: BT.text.amber,  aliases: ['flip', 'fix_and_flip', 'fix-and-flip', 'wholesale'] },
  { id: 'rental', label: 'RENTAL', color: BT.met.occupancy, aliases: ['rental', 'long_term_rental', 'ltr', 'buy_and_hold', 'buy and hold'] },
  { id: 'str',    label: 'STR',    color: BT.text.cyan,   aliases: ['str', 'short_term_rental', 'vacation_rental', 'airbnb'] },
];

function matchStrategyCol(score: M08StrategyScore, col: StrategyColDef): boolean {
  const raw = ((score.strategy_type ?? score.strategy_id) as string || '').toLowerCase().trim();
  return col.aliases.some(a => raw === a);
}

const SIGNAL_KEYS   = ['demand', 'supply', 'market', 'policy', 'risk'] as const;
const SIGNAL_LABELS = ['D', 'S', 'M', 'P', 'R'];

const TAB_LABELS = ['ARBITRAGE', 'SIGNAL MATRIX', 'DRIVERS', 'LEAD-LAG', 'CUSTOM SCREENS'];

function ScoreRing({ score: rawScore, color, size = 60 }: { score: number; color: string; size?: number }) {
  const score = Number(rawScore ?? 0);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, score)) / 100) * circ;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}20`} strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
        strokeLinecap="round"
      />
      <text
        x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={14} fontWeight={700} fontFamily={MONO}
      >
        {Math.round(score)}
      </text>
    </svg>
  );
}

interface StrategyColProps {
  score: M08StrategyScore;
  isWinner: boolean;
  col: { id: string; label: string; color: string };
}

function StrategyCol({ score, isWinner, col }: StrategyColProps) {
  const irr = score.roi_estimate?.irr;
  const yoc = score.roi_estimate?.yoc;
  const em  = score.roi_estimate?.profit_margin;
  const timeline = typeof score.sub_scores?.['timeline'] === 'number'
    ? (score.sub_scores['timeline'] as number)
    : null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderTop: isWinner ? `2px solid ${BT.text.amber}` : `1px solid ${BT.border.subtle}`,
      background: isWinner ? `${BT.text.amber}06` : BT.bg.panel,
      minWidth: 0, flex: 1,
    }}>
      <div style={{
        padding: '5px 8px', background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: col.color, letterSpacing: 0.5 }}>
          {col.label}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {isWinner && <Bd c={BT.text.amber}>WINNER</Bd>}
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: isWinner ? BT.text.amber : BT.text.primary }}>
            {Number(score.overall_score ?? 0).toFixed(0)}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 8px 6px' }}>
        <ScoreRing score={score.overall_score} color={col.color} size={60} />
      </div>

      <DataRow label="IRR"      value={irr != null ? `${(Number(irr) * 100).toFixed(1)}%`  : '—'} valueColor={BT.met.financial} />
      <DataRow label="EM"       value={em  != null ? `${Number(em).toFixed(2)}x`            : '—'} valueColor={BT.text.amber} />
      <DataRow label="YOC"      value={yoc != null ? `${(Number(yoc) * 100).toFixed(1)}%`  : '—'} valueColor={BT.met.occupancy} />
      <DataRow label="TIMELINE" value={timeline != null ? `${timeline}M`            : '—'} valueColor={BT.text.secondary} />

      <div style={{ borderTop: `1px solid ${BT.border.subtle}`, paddingTop: 2, paddingBottom: 2 }}>
        {SIGNAL_KEYS.map((key, i) => {
          const v = Number((score.sub_scores?.[key] as number | undefined) ?? 0);
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px' }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, width: 8, flexShrink: 0 }}>
                {SIGNAL_LABELS[i]}
              </span>
              <div style={{ flex: 1, height: 3, background: BT.bg.hover, position: 'relative' as const }}>
                <div style={{
                  position: 'absolute' as const, left: 0, top: 0,
                  height: '100%', width: `${Math.min(100, v)}%`,
                  background: col.color, opacity: 0.75,
                }} />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, width: 20, textAlign: 'right' as const }}>
                {v.toFixed(0)}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '5px 8px', borderTop: `1px solid ${BT.border.subtle}` }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, fontStyle: 'italic' }}>
          {score.gate_result === 'FAIL'
            ? (score.gate_failures?.[0] ?? 'Gates not met')
            : score.gate_result === 'PASS'
              ? 'Meets all investment gates'
              : 'Evaluation pending'}
        </span>
      </div>
    </div>
  );
}

const TIER_NAMES: Record<number, string> = {
  1: 'MONEY CORRELATIONS',
  2: 'SUPPLY-DEMAND EQUILIBRIUM',
  3: 'PREDICTIVE & ECONOMIC',
  4: 'COMPETITIVE',
};

const TIER_COLORS: Record<number, string> = {
  1: BT.met.financial,
  2: BT.text.cyan,
  3: BT.text.purple,
  4: BT.text.orange,
};

function signalDot(signal: string | null): { color: string; label: string } {
  if (signal === 'bullish') return { color: BT.text.green, label: 'BULL' };
  if (signal === 'bearish') return { color: BT.text.red, label: 'BEAR' };
  if (signal === 'neutral') return { color: BT.text.secondary, label: 'NEUT' };
  return { color: BT.text.muted, label: '---' };
}

function confidenceBadgeColor(conf: string): string {
  if (conf === 'high') return BT.text.green;
  if (conf === 'medium') return BT.text.amber;
  if (conf === 'low') return BT.text.orange;
  return BT.text.muted;
}

function SignalMatrixTab({ city, state: st }: { city: string; state: string }) {
  const { report, loading, error } = useCorrelationReport(city, st);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>
        Loading signal matrix for {city}, {st}...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 12, fontFamily: MONO, fontSize: 10, color: BT.text.red }}>
        ERROR: {error}
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>
        No correlation data available for this market.
      </div>
    );
  }

  const tiers = [1, 2, 3, 4];
  const grouped: Record<number, CorrelationResult[]> = {};
  tiers.forEach(t => { grouped[t] = []; });
  (report.correlations ?? []).forEach(c => {
    const t = c.tier >= 1 && c.tier <= 4 ? c.tier : 4;
    grouped[t].push(c);
  });

  const sum = report.summary ?? { bullishSignals: 0, bearishSignals: 0, neutralSignals: 0, insufficientData: 0, rentRunway: null, affordabilityCeiling: null, supplyPressure: null, topOpportunity: null };

  return (
    <div style={{ padding: 1 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1, background: BT.border.subtle, marginBottom: 1,
      }}>
        <div style={{ background: BT.bg.panel, padding: '6px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>BULLISH</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.green }}>{sum.bullishSignals}</div>
        </div>
        <div style={{ background: BT.bg.panel, padding: '6px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>BEARISH</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.red }}>{sum.bearishSignals}</div>
        </div>
        <div style={{ background: BT.bg.panel, padding: '6px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>NEUTRAL</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.secondary }}>{sum.neutralSignals}</div>
        </div>
        <div style={{ background: BT.bg.panel, padding: '6px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>INSUFFICIENT</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.muted }}>{sum.insufficientData}</div>
        </div>
      </div>

      {[sum.rentRunway, sum.affordabilityCeiling, sum.supplyPressure, sum.topOpportunity].some(Boolean) && (
        <div style={{
          background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`,
          padding: '5px 10px', marginBottom: 1,
        }}>
          {sum.rentRunway && (
            <div style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, width: 120, flexShrink: 0 }}>RENT RUNWAY</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>{sum.rentRunway}</span>
            </div>
          )}
          {sum.affordabilityCeiling && (
            <div style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, width: 120, flexShrink: 0 }}>AFFORD CEILING</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>{sum.affordabilityCeiling}</span>
            </div>
          )}
          {sum.supplyPressure && (
            <div style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, width: 120, flexShrink: 0 }}>SUPPLY PRESSURE</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>{sum.supplyPressure}</span>
            </div>
          )}
          {sum.topOpportunity && (
            <div style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, width: 120, flexShrink: 0 }}>TOP OPPORTUNITY</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>{sum.topOpportunity}</span>
            </div>
          )}
        </div>
      )}

      {tiers.map(tier => {
        const rows = grouped[tier];
        if (!rows || rows.length === 0) return null;
        return (
          <SectionPanel
            key={tier}
            title={`TIER ${tier} — ${TIER_NAMES[tier]}`}
            borderColor={TIER_COLORS[tier]}
            style={{ marginBottom: 1 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '56px 1fr 16px 42px 50px 50px 50px',
                gap: 0, padding: '3px 8px',
                background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
              }}>
                {['ID', 'NAME', '', 'SIGNAL', 'CONF', 'R', 'LEAD'].map(h => (
                  <span key={h} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, fontWeight: 600 }}>{h}</span>
                ))}
              </div>
              {rows.map(c => {
                const sig = signalDot(c.signal);
                return (
                  <div key={c.id}>
                    <div
                      style={{
                        display: 'grid', gridTemplateColumns: '56px 1fr 16px 42px 50px 50px 50px',
                        gap: 0, padding: '3px 8px',
                        borderBottom: c.actionable ? 'none' : `1px solid ${BT.border.subtle}`,
                      }}
                    >
                      <span style={{ fontFamily: MONO, fontSize: 9, color: TIER_COLORS[tier], fontWeight: 700 }}>{c.id}</span>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', background: sig.color,
                        display: 'inline-block', marginTop: 2,
                        boxShadow: c.signal === 'bullish' ? `0 0 4px ${BT.text.green}66` : c.signal === 'bearish' ? `0 0 4px ${BT.text.red}66` : 'none',
                      }} />
                      <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: sig.color }}>
                        {sig.label}
                      </span>
                      <Bd c={confidenceBadgeColor(c.confidence)}>{(c.confidence ?? 'N/A').toUpperCase().slice(0, 3)}</Bd>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: c.correlation != null ? (c.correlation >= 0 ? BT.text.green : BT.text.red) : BT.text.muted }}>
                        {c.correlation != null ? c.correlation.toFixed(2) : '—'}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>{c.leadTime || '—'}</span>
                    </div>
                    {c.actionable && (
                      <div style={{
                        padding: '2px 8px 4px 64px',
                        borderBottom: `1px solid ${BT.border.subtle}`,
                      }}>
                        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, fontStyle: 'italic' }}>
                          {c.actionable}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionPanel>
        );
      })}

      <div style={{ padding: '4px 10px', fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
        {report.market}, {report.state} | {report.metricsComputed} computed, {report.metricsSkipped} skipped | {report.computedAt ? new Date(report.computedAt).toLocaleString() : ''}
      </div>
    </div>
  );
}

function DriversTab({ dealId }: { dealId: string }) {
  const { results, loading, error } = useDriverAnalysis(dealId);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>
        Loading driver analysis...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 12 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary, marginBottom: 8 }}>
          {error}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
          Run driver analysis from the platform to populate this view.
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>
        No driver analysis results for this property. Run analysis to populate.
      </div>
    );
  }

  const sorted = [...results].sort((a, b) => Math.abs(b.pearsonR) - Math.abs(a.pearsonR));
  const topDriver = sorted[0];
  const topR = topDriver ? Math.abs(topDriver.pearsonR) : 0;
  const avgR2 = sorted.length > 0 ? sorted.reduce((s, r) => s + r.rSquared, 0) / sorted.length : 0;
  const sigCount = sorted.filter(r => r.pValue < 0.05).length;

  const outcomeGroups: Record<string, DriverResult[]> = {};
  for (const d of sorted) {
    const key = d.outcomeMetricId || 'UNKNOWN';
    if (!outcomeGroups[key]) outcomeGroups[key] = [];
    outcomeGroups[key].push(d);
  }

  return (
    <div style={{ padding: 1 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1, background: BT.border.subtle, marginBottom: 1,
      }}>
        <div style={{ background: BT.bg.panel, padding: '6px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>TOP DRIVER</div>
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.text.cyan, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {topDriver?.driverMetricName || topDriver?.driverMetricId || '—'}
          </div>
        </div>
        <div style={{ background: BT.bg.panel, padding: '6px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>TOP |R|</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.amber }}>{topR.toFixed(2)}</div>
        </div>
        <div style={{ background: BT.bg.panel, padding: '6px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>AVG R-SQ</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.purple }}>{avgR2.toFixed(3)}</div>
        </div>
        <div style={{ background: BT.bg.panel, padding: '6px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>SIG (p&lt;.05)</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.green }}>{sigCount}/{sorted.length}</div>
        </div>
      </div>

      {Object.entries(outcomeGroups).map(([outcome, drivers]) => (
        <SectionPanel
          key={outcome}
          title={outcome.replace(/_/g, ' ')}
          subtitle={`${drivers.length} drivers`}
          borderColor={BT.text.cyan}
          style={{ marginBottom: 1 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 60px 60px 55px 55px 45px 45px',
              gap: 0, padding: '3px 8px',
              background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
            }}>
              {['DRIVER', 'R', 'R-SQ', 'p-VAL', 'LAG WK', 'N', 'DIR'].map(h => (
                <span key={h} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, fontWeight: 600 }}>{h}</span>
              ))}
            </div>
            {drivers.map((d, i) => {
              const dirColor = d.direction === 'positive' ? BT.text.green : d.direction === 'negative' ? BT.text.red : BT.text.secondary;
              const rColor = Math.abs(d.pearsonR) >= 0.5 ? BT.text.green : Math.abs(d.pearsonR) >= 0.3 ? BT.text.amber : BT.text.muted;
              return (
                <div
                  key={`${d.driverMetricId}-${i}`}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 60px 60px 55px 55px 45px 45px',
                    gap: 0, padding: '3px 8px',
                    borderBottom: `1px solid ${BT.border.subtle}`,
                    background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.driverMetricName || d.driverMetricId}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: rColor }}>
                    {d.pearsonR.toFixed(3)}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
                    {d.rSquared.toFixed(3)}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: d.pValue < 0.05 ? BT.text.green : BT.text.muted }}>
                    {d.pValue < 0.001 ? '<.001' : d.pValue.toFixed(3)}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>
                    {d.optimalLagWeeks}w
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
                    {d.sampleSize ?? '—'}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: dirColor, textTransform: 'uppercase' }}>
                    {d.direction === 'positive' ? '+' : d.direction === 'negative' ? '-' : '~'}
                  </span>
                </div>
              );
            })}
          </div>
        </SectionPanel>
      ))}
    </div>
  );
}

function LeadLagTab() {
  const { data, loading, source } = useLeadLagRelationships();

  const uniqueSources = new Set(data.map(d => d.sourceId)).size;
  const uniqueTargets = new Set(data.map(d => d.targetId)).size;
  const avgR = data.length > 0 ? data.reduce((s, d) => s + Math.abs(d.typicalR), 0) / data.length : 0;

  return (
    <div style={{ padding: 1 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1, background: BT.border.subtle, marginBottom: 1,
      }}>
        <div style={{ background: BT.bg.panel, padding: '6px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>CHAINS</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.purple }}>{data.length}</div>
        </div>
        <div style={{ background: BT.bg.panel, padding: '6px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>LEADERS</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.cyan }}>{uniqueSources}</div>
        </div>
        <div style={{ background: BT.bg.panel, padding: '6px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>LAGGERS</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.amber }}>{uniqueTargets}</div>
        </div>
        <div style={{ background: BT.bg.panel, padding: '6px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>AVG |R|</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.green }}>{avgR.toFixed(2)}</div>
        </div>
      </div>

      <SectionPanel title="LEAD-LAG RELATIONSHIPS" subtitle={`${source === 'api' ? 'empirical discovery' : 'metrics catalog'} chains`} borderColor={BT.text.purple}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 55px 55px 65px 55px',
            gap: 0, padding: '3px 8px',
            background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
          }}>
            {['LEADER (SOURCE)', 'LAGGER (TARGET)', 'LAG', 'R', 'CONF', 'N'].map(h => (
              <span key={h} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, fontWeight: 600 }}>{h}</span>
            ))}
          </div>
          {data.map((d, i) => {
            const rColor = Math.abs(d.typicalR) >= 0.5 ? BT.text.green : Math.abs(d.typicalR) >= 0.3 ? BT.text.amber : BT.text.muted;
            return (
              <div
                key={`${d.sourceId}-${d.targetId}-${i}`}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 55px 55px 65px 55px',
                  gap: 0, padding: '3px 8px',
                  borderBottom: `1px solid ${BT.border.subtle}`,
                  background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.sourceName}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.targetName}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
                  {d.lagMonths === 0 ? 'SYNC' : `${d.lagMonths}mo`}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: rColor }}>
                  {d.typicalR.toFixed(2)}
                </span>
                <Bd c={d.confidence === 'empirical' ? BT.text.green : BT.text.muted}>
                  {d.confidence === 'empirical' ? 'EMPRCL' : 'CATLOG'}
                </Bd>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
                  {d.sampleSize ?? '—'}
                </span>
              </div>
            );
          })}
        </div>
      </SectionPanel>

      <div style={{ padding: '6px 10px', fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
        {source === 'api' ? 'Sourced from lead-lag discovery API' : 'Sourced from JEDI RE Metrics Catalog (fallback)'} | {loading ? 'Loading...' : `${data.length} relationships`}
      </div>
    </div>
  );
}

export function StrategyArbitragePage({ dealId, deal: _deal, dealType: _dealType }: StrategyArbitragePageProps) {
  const params = useParams<{ id?: string; dealId?: string }>();
  const resolvedDealId = dealId || params.dealId || params.id || '';
  const [activeTab, setActiveTab] = useState(0);
  const { scores, arbitrage, loading } = useStrategyArbitrage(resolvedDealId);

  const city = useDealStore(s => s.identity.city) || 'Atlanta';
  const stateName = useDealStore(s => s.identity.state) || 'GA';

  const orderedCols = STRATEGY_COLS.map(col => ({
    col,
    score: scores.find(s => matchStrategyCol(s, col)) ?? null,
  }));

  const winnerIRR = arbitrage?.winning_strategy_id != null
    ? scores.find(s => s.strategy_id === arbitrage.winning_strategy_id)?.roi_estimate?.irr
    : null;
  const runnerIRR = arbitrage?.runner_up_strategy_id != null
    ? scores.find(s => s.strategy_id === arbitrage.runner_up_strategy_id)?.roi_estimate?.irr
    : null;
  const irrDelta = winnerIRR != null && runnerIRR != null ? winnerIRR - runnerIRR : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title="STRATEGY ARBITRAGE"
        subtitle="M06 · BEST-USE MATRIX + IRR OPTIMIZER"
        borderColor={BT.text.amber}
        metrics={[
          { l: 'IRR', c: BT.met.financial },
          { l: 'EM', c: BT.text.amber },
          { l: 'YOC', c: BT.met.occupancy },
          { l: 'TIMELINE', c: BT.text.secondary },
        ]}
        right={
          loading
            ? <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>COMPUTING...</span>
            : arbitrage?.arbitrage_detected
              ? <Bd c={BT.text.amber}>ARBITRAGE DETECTED</Bd>
              : scores.length > 0
                ? <Bd c={BT.text.green}>SCORED</Bd>
                : <Bd c={BT.text.secondary}>NO SCORES</Bd>
        }
      />

      {arbitrage && (arbitrage.winning_strategy_name || arbitrage.arbitrage_detected) && (
        <div style={{
          padding: '5px 10px', background: `${BT.text.amber}10`,
          borderLeft: `2px solid ${BT.text.amber}`,
          borderBottom: `1px solid ${BT.border.subtle}`,
          display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber, letterSpacing: 1 }}>
            ARBITRAGE ALERT
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>
            {(arbitrage.winning_strategy_name ?? 'Winner').toUpperCase()} wins by {Number(arbitrage.delta ?? 0).toFixed(1)} pts over {(arbitrage.runner_up_strategy_name ?? 'Runner-up').toUpperCase()}
          </span>
          {irrDelta != null && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.green }}>
              +{(Number(irrDelta) * 100).toFixed(1)}% IRR advantage
            </span>
          )}
        </div>
      )}

      <SubTabBar
        tabs={TAB_LABELS}
        active={activeTab}
        setActive={setActiveTab}
        color={BT.text.amber}
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeTab === 0 && (
          <div style={{ padding: 1 }}>
            {loading && (
              <div style={{ padding: 24, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>
                Computing strategy scores...
              </div>
            )}
            {!loading && scores.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>
                No strategy scores available. Scores compute automatically on deal save.
              </div>
            )}
            {!loading && scores.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 1, background: BT.border.subtle,
              }}>
                {orderedCols.map(({ col, score }) => {
                  if (!score) {
                    return (
                      <div key={col.id} style={{
                        background: BT.bg.panel, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', padding: 24,
                        borderTop: `1px solid ${BT.border.subtle}`,
                      }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{col.label} · N/A</span>
                      </div>
                    );
                  }
                  const isWinner = arbitrage?.winning_strategy_id === score.strategy_id;
                  return (
                    <StrategyCol key={col.id} score={score} isWinner={isWinner} col={col} />
                  );
                })}
              </div>
            )}
            {!loading && scores.length > 0 && (
              <div style={{ marginTop: 1, background: BT.border.subtle }}>
                <SectionPanel
                  title="COMPOSITE SCORE TREND"
                  subtitle="30-day strategy arbitrage trajectory"
                  borderColor={BT.text.amber}
                >
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.min(4, scores.length)}, 1fr)`,
                    gap: 1, background: BT.border.subtle,
                  }}>
                    {scores.slice(0, 4).map(s => {
                      const sType = ((s.strategy_type ?? s.strategy_id) as string || '').toLowerCase();
                      const sId = (s.strategy_id || '').toLowerCase();
                      const col = STRATEGY_COLS.find(c =>
                        sType.includes(c.id) || sId.includes(c.id)
                      ) ?? STRATEGY_COLS[0];
                      const spark = Object.values(s.sub_scores ?? {}).map(v => Number(v)).filter(n => !isNaN(n));
                      return (
                        <div key={s.strategy_id} style={{ background: BT.bg.panel, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: MONO, fontSize: 9, color: col.color, width: 40, flexShrink: 0 }}>
                            {col.label}
                          </span>
                          <Spark data={spark.length >= 2 ? spark : [s.overall_score, s.overall_score]} color={col.color} w={80} h={14} />
                          <span style={{ fontFamily: MONO, fontSize: 9, color: col.color, fontWeight: 700, marginLeft: 'auto' }}>
                            {Number(s.overall_score ?? 0).toFixed(0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </SectionPanel>
              </div>
            )}
          </div>
        )}

        {activeTab === 1 && (
          <SignalMatrixTab city={city} state={stateName} />
        )}

        {activeTab === 2 && (
          <DriversTab dealId={resolvedDealId} />
        )}

        {activeTab === 3 && (
          <LeadLagTab />
        )}

        {activeTab === 4 && (
          <BtTabWrapper>
            <CustomScreenTab dealId={resolvedDealId} />
          </BtTabWrapper>
        )}
      </div>
    </div>
  );
}

export default StrategyArbitragePage;
