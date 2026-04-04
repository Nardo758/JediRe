import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  BT, BT_CSS,
  PanelHeader, SubTabBar, SectionPanel, DataRow, Bd, Spark, BtTabWrapper,
} from '../../components/deal/bloomberg-ui';
import { useStrategyArbitrage } from '../../hooks/useStrategyArbitrageM08';
import { useDealStore } from '../../stores/dealStore';
import type { M08StrategyScore } from '../../stores/dealStore';
import { CustomScreenTab } from '../../components/deal/sections/CustomScreenTab';
import { apiClient } from '../../services/api.client';

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

interface CorrelationResult {
  id: string;
  name: string;
  tier: number;
  category: string;
  xValue: number | null;
  yValue: number | null;
  correlation: number | null;
  signal: string | null;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  leadTime: string;
  actionable: string | null;
  dataSources: string[];
  missingData: string[];
}

interface CorrelationReport {
  market: string;
  state: string;
  computedAt: string;
  snapshotDate: string | null;
  metricsComputed: number;
  metricsSkipped: number;
  correlations: CorrelationResult[];
  summary: {
    bullishSignals: number;
    bearishSignals: number;
    neutralSignals: number;
    insufficientData: number;
    rentRunway: string | null;
    affordabilityCeiling: string | null;
    supplyPressure: string | null;
    topOpportunity: string | null;
  };
}

interface DriverResult {
  driverMetricId: string;
  driverMetricName: string;
  driverCategory: string;
  driverGeographyType: string;
  driverGeographyId: string;
  outcomeMetricId: string;
  optimalLagWeeks: number;
  pearsonR: number;
  pValue: number;
  rSquared: number;
  slope: number;
  intercept: number;
  sampleSize: number;
  direction: string;
}

interface LeadLagEntry {
  sourceId: string;
  sourceName: string;
  sourceCategory: string;
  targetId: string;
  targetName: string;
  lagMonths: number;
  typicalR: number;
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

function signalColor(signal: string | null): string {
  if (signal === 'bullish') return BT.text.green;
  if (signal === 'bearish') return BT.text.red;
  return BT.text.muted;
}

function confidenceBadge(conf: string): string {
  if (conf === 'high') return BT.text.green;
  if (conf === 'medium') return BT.text.amber;
  if (conf === 'low') return BT.text.orange;
  return BT.text.muted;
}

function SignalMatrixTab({ city, state: st }: { city: string; state: string }) {
  const [report, setReport] = useState<CorrelationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!city) { setLoading(false); return; }
    setLoading(true);
    setError('');
    apiClient.get(`/api/v1/correlations/report`, { params: { city, state: st } })
      .then(res => {
        const raw = res.data?.data ?? res.data;
        if (res.data?.success === false) {
          setError(res.data?.error || 'Failed');
          return;
        }
        if (raw && Array.isArray(raw.correlations) && raw.summary) {
          setReport(raw);
        } else {
          setError('Invalid correlation report format');
        }
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to fetch correlation report'))
      .finally(() => setLoading(false));
  }, [city, st]);

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
  report.correlations.forEach(c => {
    const t = c.tier >= 1 && c.tier <= 4 ? c.tier : 4;
    grouped[t].push(c);
  });

  const sum = report.summary;

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
                display: 'grid', gridTemplateColumns: '60px 1fr 60px 55px 50px 55px',
                gap: 0, padding: '3px 8px',
                background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
              }}>
                {['ID', 'NAME', 'SIGNAL', 'CONF', 'R', 'LEAD'].map(h => (
                  <span key={h} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, fontWeight: 600 }}>{h}</span>
                ))}
              </div>
              {rows.map(c => (
                <div
                  key={c.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '60px 1fr 60px 55px 50px 55px',
                    gap: 0, padding: '3px 8px',
                    borderBottom: `1px solid ${BT.border.subtle}`,
                  }}
                  title={c.actionable ?? ''}
                >
                  <span style={{ fontFamily: MONO, fontSize: 9, color: TIER_COLORS[tier], fontWeight: 700 }}>{c.id}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: signalColor(c.signal), textTransform: 'uppercase' }}>
                    {c.signal ?? '—'}
                  </span>
                  <Bd c={confidenceBadge(c.confidence)}>{c.confidence.toUpperCase().slice(0, 3)}</Bd>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: c.correlation != null ? (c.correlation >= 0 ? BT.text.green : BT.text.red) : BT.text.muted }}>
                    {c.correlation != null ? c.correlation.toFixed(2) : '—'}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>{c.leadTime || '—'}</span>
                </div>
              ))}
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
  const [results, setResults] = useState<DriverResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!dealId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    apiClient.get(`/api/v1/driver-analysis/results/${dealId}`, { params: { sortBy: 'pearsonR', sortDir: 'desc', limit: 50 } })
      .then(res => {
        setResults(res.data?.data ?? []);
      })
      .catch(err => {
        setError(err.response?.data?.error || 'No driver analysis data');
      })
      .finally(() => setLoading(false));
  }, [dealId]);

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
  const topR = sorted[0] ? Math.abs(sorted[0].pearsonR) : 0;
  const avgR2 = sorted.length > 0 ? sorted.reduce((s, r) => s + r.rSquared, 0) / sorted.length : 0;
  const sigCount = sorted.filter(r => r.pValue < 0.05).length;

  return (
    <div style={{ padding: 1 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1, background: BT.border.subtle, marginBottom: 1,
      }}>
        <div style={{ background: BT.bg.panel, padding: '6px 10px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>DRIVERS</div>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.cyan }}>{sorted.length}</div>
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
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.green }}>{sigCount}</div>
        </div>
      </div>

      <SectionPanel title="DRIVER REGRESSION RESULTS" subtitle={`${sorted.length} drivers, sorted by |R|`} borderColor={BT.text.cyan}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 60px 60px 55px 60px 50px',
            gap: 0, padding: '3px 8px',
            background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
          }}>
            {['DRIVER', 'OUTCOME', 'R', 'R-SQ', 'p-VAL', 'LAG WK', 'DIR'].map(h => (
              <span key={h} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, fontWeight: 600 }}>{h}</span>
            ))}
          </div>
          {sorted.map((d, i) => {
            const dirColor = d.direction === 'positive' ? BT.text.green : d.direction === 'negative' ? BT.text.red : BT.text.secondary;
            const rColor = Math.abs(d.pearsonR) >= 0.5 ? BT.text.green : Math.abs(d.pearsonR) >= 0.3 ? BT.text.amber : BT.text.muted;
            return (
              <div
                key={`${d.driverMetricId}-${d.outcomeMetricId}-${i}`}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 60px 60px 55px 60px 50px',
                  gap: 0, padding: '3px 8px',
                  borderBottom: `1px solid ${BT.border.subtle}`,
                  background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.driverMetricName || d.driverMetricId}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.outcomeMetricId}
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
                <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: dirColor, textTransform: 'uppercase' }}>
                  {d.direction === 'positive' ? '+' : d.direction === 'negative' ? '-' : '~'}
                </span>
              </div>
            );
          })}
        </div>
      </SectionPanel>
    </div>
  );
}

interface LeadLagApiResult {
  metricAId: string;
  metricBId: string;
  optimalLagMonths: number;
  rAtOptimalLag: number;
  rAtZeroLag: number;
  improvementAbs: number;
  improvementPct: number;
  geographyType: string;
  sampleSize: number;
}

const CATALOG_FALLBACK: LeadLagEntry[] = (() => {
  const catalog: Array<{
    id: string; name: string; category: string;
    leadsMetrics?: Array<{ metricId: string; lagMonths: number; typicalR: number }>;
  }> = [
    { id: 'C_SURGE_INDEX', name: 'Traffic Surge Index', category: 'traffic_composite',
      leadsMetrics: [
        { metricId: 'F_RENT_GROWTH', lagMonths: 6, typicalR: 0.58 },
        { metricId: 'M_VACANCY', lagMonths: 9, typicalR: -0.50 },
      ] },
    { id: 'S_PIPELINE_UNITS', name: 'Pipeline Units', category: 'supply',
      leadsMetrics: [
        { metricId: 'M_VACANCY', lagMonths: 12, typicalR: 0.48 },
      ] },
    { id: 'E_EMPLOYMENT_GROWTH', name: 'Employment Growth', category: 'demand',
      leadsMetrics: [
        { metricId: 'L_JOBS_PER_UNIT', lagMonths: 0, typicalR: 0.85 },
      ] },
    { id: 'DEM_POP_GROWTH', name: 'Population Growth', category: 'demographic',
      leadsMetrics: [
        { metricId: 'F_RENT_GROWTH', lagMonths: 12, typicalR: 0.55 },
      ] },
    { id: 'C_TRAFFIC_GROWTH_INDEX', name: 'Traffic Growth Index', category: 'traffic_composite',
      leadsMetrics: [
        { metricId: 'F_RENT_GROWTH', lagMonths: 6, typicalR: 0.62 },
        { metricId: 'M_VACANCY', lagMonths: 9, typicalR: -0.54 },
        { metricId: 'M_ABSORPTION', lagMonths: 3, typicalR: 0.47 },
      ] },
    { id: 'D_SEARCH_MOMENTUM', name: 'Search Momentum', category: 'traffic_digital',
      leadsMetrics: [
        { metricId: 'C_TRAFFIC_GROWTH_INDEX', lagMonths: 3, typicalR: 0.58 },
        { metricId: 'F_RENT_GROWTH', lagMonths: 9, typicalR: 0.52 },
        { metricId: 'M_VACANCY', lagMonths: 12, typicalR: -0.45 },
      ] },
    { id: 'MACRO_OIL_PRICE', name: 'Oil Price', category: 'macro',
      leadsMetrics: [
        { metricId: 'F_CAP_RATE', lagMonths: 6, typicalR: 0.35 },
        { metricId: 'E_EMPLOYMENT_GROWTH', lagMonths: 3, typicalR: 0.42 },
      ] },
    { id: 'MACRO_CPI', name: 'CPI Inflation', category: 'macro',
      leadsMetrics: [
        { metricId: 'F_RENT_GROWTH', lagMonths: 0, typicalR: 0.65 },
        { metricId: 'F_CAP_RATE', lagMonths: 6, typicalR: 0.48 },
      ] },
  ];
  const entries: LeadLagEntry[] = [];
  for (const m of catalog) {
    if (m.leadsMetrics) {
      for (const lead of m.leadsMetrics) {
        entries.push({
          sourceId: m.id, sourceName: m.name, sourceCategory: m.category,
          targetId: lead.metricId, targetName: lead.metricId.replace(/_/g, ' '),
          lagMonths: lead.lagMonths, typicalR: lead.typicalR,
        });
      }
    }
  }
  return entries.sort((a, b) => Math.abs(b.typicalR) - Math.abs(a.typicalR));
})();

function LeadLagTab() {
  const [data, setData] = useState<LeadLagEntry[]>(CATALOG_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'catalog'>('catalog');

  useEffect(() => {
    apiClient.get('/api/v1/lead-lag/results', { params: { limit: 100 } })
      .then(res => {
        const results: LeadLagApiResult[] = Array.isArray(res.data?.data) ? res.data.data : [];
        if (results.length > 0) {
          const mapped: LeadLagEntry[] = results.map(r => ({
            sourceId: r.metricAId,
            sourceName: r.metricAId.replace(/_/g, ' '),
            sourceCategory: r.geographyType,
            targetId: r.metricBId,
            targetName: r.metricBId.replace(/_/g, ' '),
            lagMonths: r.optimalLagMonths,
            typicalR: r.rAtOptimalLag,
          })).sort((a, b) => Math.abs(b.typicalR) - Math.abs(a.typicalR));
          setData(mapped);
          setSource('api');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

      <SectionPanel title="LEAD-LAG RELATIONSHIPS" subtitle="metrics catalog empirical chains" borderColor={BT.text.purple}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 65px 55px 70px',
            gap: 0, padding: '3px 8px',
            background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
          }}>
            {['LEADER (SOURCE)', 'LAGGER (TARGET)', 'LAG', 'R', 'CATEGORY'].map(h => (
              <span key={h} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, fontWeight: 600 }}>{h}</span>
            ))}
          </div>
          {data.map((d, i) => {
            const rColor = Math.abs(d.typicalR) >= 0.5 ? BT.text.green : Math.abs(d.typicalR) >= 0.3 ? BT.text.amber : BT.text.muted;
            return (
              <div
                key={`${d.sourceId}-${d.targetId}-${i}`}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 65px 55px 70px',
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
                <Bd c={BT.text.muted}>{d.sourceCategory.replace(/_/g, ' ').toUpperCase().slice(0, 10)}</Bd>
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
