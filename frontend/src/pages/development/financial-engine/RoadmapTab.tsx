/**
 * F9 Roadmap Tab — Value Creation Plan
 *
 * Renders the Roadmap Mode output:
 *   - Achievability banner (status + IRR comparison)
 *   - Year-by-year stacked bar trajectory with posture strip
 *   - Ordered action table with evidence side panel
 *   - "Build Roadmap" trigger modal
 *
 * Spec: ROADMAP_MODE_SPEC v1.0 §8 UI Rendering
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';

const MONO = BT.font?.mono ?? 'monospace';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoadmapAction {
  id: string;
  action_name: string;
  category: string;
  timing: {
    start_month: number;
    duration_months: number;
    impact_starts_month: number;
    impact_fully_realized_month: number;
  };
  expected_impact: {
    annualized_dollar_impact_at_full_realization: number;
    affected_line_items: string[];
    confidence: 'high' | 'medium' | 'low';
  };
  evidence: {
    archive_success_rate: number;
    archive_n: number;
    archive_p50_actual_lift: number;
    archive_p25_p75_actual_lift: [number, number];
    cohort_match_criteria: string;
    market_signal_support: string[];
  };
  cost: {
    upfront_capital: number;
    operating_cost_change: number;
    one_time_disruption: number;
  };
  dependencies: string[];
  risks: string[];
}

interface YearlyTrajectory {
  year: number;
  actions_active: string[];
  posture_classification: string;
  noi_baseline: number;
  noi_with_roadmap: number;
  noi_lift_this_year: number;
  noi_lift_cumulative: number;
  primary_lift_drivers: { action_id: string; dollar_contribution: number }[];
}

interface RoadmapOutput {
  meta: {
    deal_id: string;
    target_return: { metric: string; value: number; hold_years: number };
    achievability_status: string;
    achievability_reasoning: string;
    generated_at: string;
    baseline_irr: number;
    target_irr: number;
    roadmap_irr: number;
  };
  baseline_proforma: { description: string; irr: number; equity_multiple: number; noi_path: number[] };
  target_proforma: { description: string; irr: number; equity_multiple: number; noi_path_required: number[] };
  gap_analysis: {
    total_noi_gap: number;
    gap_by_bucket: {
      revenue_lift: number;
      expense_reduction: number;
      other_income_lift: number;
      debt_optimization: number;
      capex_value_add: number;
      exit_timing_lift: number;
    };
  };
  roadmap_actions: RoadmapAction[];
  yearly_trajectory: YearlyTrajectory[];
  plausibility_check: { m36_d_value: number; classification: string; notes: string };
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// ── Achievability Colors ──────────────────────────────────────────────────────

function achievabilityColor(status: string): string {
  switch (status) {
    case 'achievable': return BT.text?.green ?? '#22c55e';
    case 'achievable_with_stretch': return BT.text?.amber ?? '#f59e0b';
    case 'achievable_only_with_overrides': return BT.text?.amber ?? '#f59e0b';
    case 'not_achievable': return BT.text?.red ?? '#ef4444';
    default: return BT.text?.muted ?? '#6b7280';
  }
}

function achievabilityLabel(status: string): string {
  switch (status) {
    case 'achievable': return 'ACHIEVABLE';
    case 'achievable_with_stretch': return 'ACHIEVABLE · STRETCH';
    case 'achievable_only_with_overrides': return 'OVERRIDES REQUIRED';
    case 'not_achievable': return 'NOT ACHIEVABLE';
    default: return status.toUpperCase();
  }
}

function postureColor(posture: string): string {
  switch (posture) {
    case 'offense': return BT.met?.financial ?? '#00d4aa';
    case 'neutral': return BT.text?.amber ?? '#f59e0b';
    case 'defense': return BT.text?.red ?? '#ef4444';
    default: return BT.text?.muted ?? '#6b7280';
  }
}

function categoryColor(cat: string): string {
  switch (cat) {
    case 'revenue': return BT.met?.financial ?? '#00d4aa';
    case 'expense': return BT.text?.cyan ?? '#06b6d4';
    case 'other_income': return BT.text?.amber ?? '#f59e0b';
    case 'debt': return '#8B5CF6';
    case 'capex': return BT.text?.green ?? '#22c55e';
    case 'exit': return BT.text?.muted ?? '#6b7280';
    default: return BT.text?.muted ?? '#6b7280';
  }
}

function confidenceBadge(conf: string): { label: string; color: string } {
  switch (conf) {
    case 'high': return { label: 'HIGH', color: BT.met?.financial ?? '#00d4aa' };
    case 'medium': return { label: 'MED', color: BT.text?.amber ?? '#f59e0b' };
    case 'low': return { label: 'LOW', color: BT.text?.red ?? '#ef4444' };
    default: return { label: conf, color: BT.text?.muted ?? '#6b7280' };
  }
}

// ── Build Roadmap Modal ───────────────────────────────────────────────────────

interface BuildModalProps {
  onClose: () => void;
  onBuild: (params: { metric: string; value: number; holdYears: number }) => void;
  loading: boolean;
  f9HoldYears: number | null;
}

function BuildRoadmapModal({ onClose, onBuild, loading, f9HoldYears }: BuildModalProps) {
  const [metric, setMetric] = useState('irr');
  const [value, setValue] = useState(metric === 'irr' ? '15' : '2.0');
  const [holdYears, setHoldYears] = useState(String(f9HoldYears ?? 5));

  const METRICS = [
    { id: 'irr', label: 'Target IRR (%)', placeholder: '15', hint: 'e.g. 15 for 15%' },
    { id: 'equity_multiple', label: 'Target Equity Multiple (×)', placeholder: '2.0', hint: 'e.g. 2.0 for 2×' },
    { id: 'cash_on_cash_y3', label: 'Cash-on-Cash Y3 (%)', placeholder: '8', hint: 'e.g. 8 for 8%' },
    { id: 'noi_growth_3yr', label: 'NOI Growth 3yr (%)', placeholder: '20', hint: 'e.g. 20 for 20%' },
  ];

  const currentMetricMeta = METRICS.find(m => m.id === metric) ?? METRICS[0];

  function handleSubmit() {
    const numValue = parseFloat(value);
    const numHold = parseInt(holdYears, 10);
    if (!isFinite(numValue) || numValue <= 0) return;
    if (!isFinite(numHold) || numHold < 1) return;
    // IRR and CoC/NOI growth are percentages — convert to decimal
    const rawValue = (metric === 'irr' || metric === 'cash_on_cash_y3' || metric === 'noi_growth_3yr')
      ? numValue / 100
      : numValue;
    onBuild({ metric, value: rawValue, holdYears: numHold });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: BT.bg?.panel ?? '#0d1117',
        border: `1px solid ${BT.met?.financial ?? '#00d4aa'}`,
        borderRadius: 4, padding: 24, width: 380, maxWidth: '90vw',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BT.met?.financial ?? '#00d4aa', letterSpacing: 0.8 }}>
            BUILD VALUE CREATION ROADMAP
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: BT.text?.muted ?? '#6b7280', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontFamily: MONO, fontSize: 9, color: BT.text?.muted ?? '#6b7280', marginBottom: 6, letterSpacing: 0.5 }}>
            TARGET RETURN METRIC
          </label>
          <select
            value={metric}
            onChange={e => { setMetric(e.target.value); setValue(e.target.value === 'equity_multiple' ? '2.0' : '15'); }}
            style={{
              width: '100%', background: BT.bg?.input ?? '#161b22', border: `1px solid ${BT.border?.medium ?? '#30363d'}`,
              color: BT.text?.primary ?? '#e6edf3', fontFamily: MONO, fontSize: 10, padding: '6px 8px', borderRadius: 2,
            }}
          >
            {METRICS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontFamily: MONO, fontSize: 9, color: BT.text?.muted ?? '#6b7280', marginBottom: 6, letterSpacing: 0.5 }}>
            {currentMetricMeta.label.toUpperCase()}
          </label>
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={currentMetricMeta.placeholder}
            style={{
              width: '100%', background: BT.bg?.input ?? '#161b22', border: `1px solid ${BT.border?.medium ?? '#30363d'}`,
              color: BT.text?.primary ?? '#e6edf3', fontFamily: MONO, fontSize: 10, padding: '6px 8px', borderRadius: 2, boxSizing: 'border-box',
            }}
          />
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text?.muted ?? '#6b7280', marginTop: 3 }}>{currentMetricMeta.hint}</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontFamily: MONO, fontSize: 9, color: BT.text?.muted ?? '#6b7280', marginBottom: 6, letterSpacing: 0.5 }}>
            HOLD PERIOD (YEARS)
          </label>
          <input
            type="number"
            value={holdYears}
            onChange={e => setHoldYears(e.target.value)}
            min={1}
            max={30}
            style={{
              width: '100%', background: BT.bg?.input ?? '#161b22', border: `1px solid ${BT.border?.medium ?? '#30363d'}`,
              color: BT.text?.primary ?? '#e6edf3', fontFamily: MONO, fontSize: 10, padding: '6px 8px', borderRadius: 2, boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${BT.border?.medium ?? '#30363d'}`,
            color: BT.text?.secondary ?? '#8b949e', fontFamily: MONO, fontSize: 9, padding: '6px 14px', cursor: 'pointer', borderRadius: 2,
          }}>CANCEL</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              background: loading ? '#00d4aa40' : BT.met?.financial ?? '#00d4aa',
              border: 'none', color: '#000', fontFamily: MONO, fontSize: 9, fontWeight: 700,
              padding: '6px 18px', cursor: loading ? 'default' : 'pointer', borderRadius: 2, letterSpacing: 0.5,
            }}
          >
            {loading ? 'GENERATING...' : 'GENERATE ROADMAP'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Evidence Side Panel ───────────────────────────────────────────────────────

function ActionEvidencePanel({ action, onClose }: { action: RoadmapAction; onClose: () => void }) {
  const bg = BT.bg?.panel ?? '#0d1117';
  const border = BT.border?.medium ?? '#30363d';
  const textPrimary = BT.text?.primary ?? '#e6edf3';
  const textMuted = BT.text?.muted ?? '#6b7280';
  const textSecondary = BT.text?.secondary ?? '#8b949e';
  const catColor = categoryColor(action.category);
  const { label: confLabel, color: confColor } = confidenceBadge(action.expected_impact.confidence);

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 340,
      background: bg, borderLeft: `1px solid ${catColor}`,
      zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${border}`, background: BT.bg?.header ?? '#010409' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: catColor, letterSpacing: 0.5, marginBottom: 3 }}>
              {action.category.toUpperCase()} ACTION
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: textPrimary, fontWeight: 700, lineHeight: 1.3 }}>
              {action.action_name}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: textMuted, cursor: 'pointer', fontSize: 16, paddingLeft: 8 }}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Impact */}
        <section>
          <div style={{ fontFamily: MONO, fontSize: 8, color: textMuted, letterSpacing: 0.5, marginBottom: 6 }}>EXPECTED IMPACT</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div style={{ background: BT.bg?.terminal ?? '#010409', padding: '6px 8px', borderRadius: 2 }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: textMuted }}>P50 LIFT / YR</div>
              <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: catColor }}>
                {fmt$(action.expected_impact.annualized_dollar_impact_at_full_realization)}
              </div>
            </div>
            <div style={{ background: BT.bg?.terminal ?? '#010409', padding: '6px 8px', borderRadius: 2 }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: textMuted }}>CONFIDENCE</div>
              <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: confColor }}>{confLabel}</div>
            </div>
          </div>
          <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 8, color: textSecondary }}>
            Range: {fmt$(action.evidence.archive_p25_p75_actual_lift[0])} – {fmt$(action.evidence.archive_p25_p75_actual_lift[1])} / yr (P25–P75)
          </div>
        </section>

        {/* Timing */}
        <section>
          <div style={{ fontFamily: MONO, fontSize: 8, color: textMuted, letterSpacing: 0.5, marginBottom: 6 }}>TIMING</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[
              { label: 'Start month', value: `M${action.timing.start_month}` },
              { label: 'Duration', value: `${action.timing.duration_months} months` },
              { label: 'Impact starts', value: `M${action.timing.impact_starts_month}` },
              { label: 'Fully realized', value: `M${action.timing.impact_fully_realized_month}` },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: textMuted }}>{r.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: textPrimary }}>{r.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Cost */}
        <section>
          <div style={{ fontFamily: MONO, fontSize: 8, color: textMuted, letterSpacing: 0.5, marginBottom: 6 }}>COST PROFILE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[
              { label: 'Upfront capital', value: fmt$(action.cost.upfront_capital) },
              { label: 'Annual operating Δ', value: fmt$(action.cost.operating_cost_change) },
              { label: 'One-time disruption', value: fmt$(action.cost.one_time_disruption) },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: textMuted }}>{r.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: textPrimary }}>{r.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Affected lines */}
        {action.expected_impact.affected_line_items.length > 0 && (
          <section>
            <div style={{ fontFamily: MONO, fontSize: 8, color: textMuted, letterSpacing: 0.5, marginBottom: 6 }}>AFFECTED LINES</div>
            {action.expected_impact.affected_line_items.map(line => (
              <div key={line} style={{ fontFamily: MONO, fontSize: 9, color: textSecondary, paddingBottom: 2 }}>• {line}</div>
            ))}
          </section>
        )}

        {/* Dependencies */}
        {action.dependencies.length > 0 && (
          <section>
            <div style={{ fontFamily: MONO, fontSize: 8, color: textMuted, letterSpacing: 0.5, marginBottom: 6 }}>DEPENDENCIES</div>
            {action.dependencies.map(dep => (
              <div key={dep} style={{
                fontFamily: MONO, fontSize: 9, color: BT.text?.amber ?? '#f59e0b',
                border: `1px solid ${BT.text?.amber ?? '#f59e0b'}30`, padding: '2px 6px',
                borderRadius: 2, display: 'inline-block', marginRight: 4, marginBottom: 4,
              }}>{dep}</div>
            ))}
          </section>
        )}

        {/* Risks */}
        {action.risks.length > 0 && (
          <section>
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text?.red ?? '#ef4444', letterSpacing: 0.5, marginBottom: 6 }}>RISKS</div>
            {action.risks.map((risk, i) => (
              <div key={i} style={{ fontFamily: MONO, fontSize: 9, color: textSecondary, paddingBottom: 4, lineHeight: 1.4 }}>
                ⚠ {risk}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

// ── Per-action colour palette (deterministic by index) ────────────────────────

const ACTION_COLORS = [
  '#00d4aa', '#06b6d4', '#8B5CF6', '#f59e0b', '#22c55e',
  '#ef4444', '#3b82f6', '#f97316', '#a855f7', '#14b8a6',
  '#eab308', '#6366f1', '#84cc16', '#ec4899', '#64748b',
];

// ── Year-by-Year Chart — per-action stacked contributions ─────────────────────

function TrajectoryChart({ trajectory, actions }: { trajectory: YearlyTrajectory[]; actions: RoadmapAction[] }) {
  if (trajectory.length === 0) return null;

  const CHART_HEIGHT = 140;
  const border = BT.border?.medium ?? '#30363d';
  const textMuted = BT.text?.muted ?? '#6b7280';

  // Assign a stable colour to each action by its index in the actions array
  const actionColorMap = useMemo(() => {
    const map = new Map<string, string>();
    actions.forEach((a, i) => map.set(a.id, ACTION_COLORS[i % ACTION_COLORS.length]));
    return map;
  }, [actions]);

  // For each year, build an ordered list of (action_id, contribution, color) segments
  // from primary_lift_drivers, then add the baseline segment at the bottom.
  const maxNoi = Math.max(
    ...trajectory.map(y => y.noi_with_roadmap),
    ...trajectory.map(y => y.noi_baseline),
    1
  );

  return (
    <div>
      {/* Bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: CHART_HEIGHT, padding: '0 4px' }}>
        {trajectory.map(year => {
          const baselineH = (year.noi_baseline / maxNoi) * CHART_HEIGHT;

          // Build per-action segments for this year (top of bar, stacked)
          // drivers are sorted desc by contribution from the engine
          const segments = year.primary_lift_drivers
            .filter(d => d.dollar_contribution > 0)
            .map(d => ({
              action_id: d.action_id,
              contribution: d.dollar_contribution,
              color: actionColorMap.get(d.action_id) ?? '#6b7280',
              label: actions.find(a => a.id === d.action_id)?.action_name ?? d.action_id,
              h: (d.dollar_contribution / maxNoi) * CHART_HEIGHT,
            }));

          const totalLiftH = segments.reduce((s, seg) => s + seg.h, 0);

          return (
            <div key={year.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: CHART_HEIGHT }}>
                {/* Per-action lift segments (top → bottom order = smallest → largest so tooltip reads naturally) */}
                {[...segments].reverse().map((seg, idx) => (
                  <div
                    key={seg.action_id}
                    title={`${seg.label}: ${fmt$(seg.contribution)}`}
                    style={{
                      height: Math.max(seg.h, 1),
                      background: seg.color,
                      opacity: 0.88,
                      borderRadius: idx === segments.length - 1 ? '2px 2px 0 0' : 0,
                    }}
                  />
                ))}
                {/* Baseline NOI segment */}
                <div
                  title={`Baseline NOI Y${year.year}: ${fmt$(year.noi_baseline)}`}
                  style={{
                    height: Math.max(baselineH, 2),
                    background: BT.bg?.active ?? '#1c2128',
                    border: `1px solid ${border}`,
                    borderTop: totalLiftH > 0 ? 'none' : undefined,
                  }}
                />
              </div>
              {/* Year label */}
              <div style={{ fontFamily: MONO, fontSize: 8, color: textMuted, marginTop: 3, textAlign: 'center' }}>
                Y{year.year}
              </div>
            </div>
          );
        })}
      </div>

      {/* Posture strip */}
      <div style={{ display: 'flex', gap: 4, padding: '3px 4px', marginTop: 2 }}>
        {trajectory.map(year => (
          <div key={year.year} style={{ flex: 1 }}>
            <div style={{
              height: 4, borderRadius: 1,
              background: postureColor(year.posture_classification),
              opacity: 0.85,
            }} title={year.posture_classification} />
          </div>
        ))}
      </div>

      {/* Per-action legend (only actions that appear in at least one year) */}
      {actions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8, padding: '0 4px' }}>
          {/* Baseline entry */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, background: BT.bg?.active ?? '#1c2128', border: `1px solid ${border}`, borderRadius: 1, flexShrink: 0 }} />
            <span style={{ fontFamily: MONO, fontSize: 7, color: textMuted }}>Baseline NOI</span>
          </div>
          {/* One entry per action */}
          {actions.map((a, i) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, background: ACTION_COLORS[i % ACTION_COLORS.length], borderRadius: 1, flexShrink: 0 }} />
              <span style={{ fontFamily: MONO, fontSize: 7, color: textMuted }}>{a.action_name}</span>
            </div>
          ))}
          {/* Posture strip legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 20, height: 4, borderRadius: 1, background: `linear-gradient(to right, ${BT.met?.financial ?? '#00d4aa'}, ${BT.text?.amber ?? '#f59e0b'}, ${BT.text?.red ?? '#ef4444'})`, flexShrink: 0 }} />
            <span style={{ fontFamily: MONO, fontSize: 7, color: textMuted }}>Posture strip: offense/neutral/defense</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Tab Component ────────────────────────────────────────────────────────

export function RoadmapTab({ dealId, f9Financials }: FinancialEngineTabProps) {
  const [roadmap, setRoadmap] = useState<RoadmapOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<RoadmapAction | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const holdYears = f9Financials?.assumptions?.holdYears ?? null;

  // Load latest roadmap on mount
  const loadLatest = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/deals/${dealId}/roadmap/latest`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { success: boolean; output?: RoadmapOutput; roadmap?: RoadmapOutput };
      setRoadmap(json.output ?? json.roadmap ?? null);
    } catch (err) {
      // No existing roadmap — this is fine
      setRoadmap(null);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void loadLatest(); }, [loadLatest]);

  const handleBuild = useCallback(async (params: { metric: string; value: number; holdYears: number }) => {
    if (!dealId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/deals/${dealId}/roadmap`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_return: {
            metric: params.metric,
            value: params.value,
            hold_years: params.holdYears,
          },
        }),
      });
      const json = await res.json() as { success: boolean; output?: RoadmapOutput; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setRoadmap(json.output ?? null);
      setShowBuildModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Roadmap generation failed');
    } finally {
      setGenerating(false);
    }
  }, [dealId]);

  const filteredActions = useMemo(() => {
    if (!roadmap) return [];
    if (!filterCategory) return roadmap.roadmap_actions;
    return roadmap.roadmap_actions.filter(a => a.category === filterCategory);
  }, [roadmap, filterCategory]);

  const CATEGORIES = useMemo(() => {
    if (!roadmap) return [];
    const cats = [...new Set(roadmap.roadmap_actions.map(a => a.category))];
    return cats;
  }, [roadmap]);

  const bg = BT.bg?.terminal ?? '#010409';
  const bgPanel = BT.bg?.panel ?? '#0d1117';
  const bgHeader = BT.bg?.header ?? '#010409';
  const border = BT.border?.subtle ?? '#21262d';
  const borderMed = BT.border?.medium ?? '#30363d';
  const textPrimary = BT.text?.primary ?? '#e6edf3';
  const textMuted = BT.text?.muted ?? '#6b7280';
  const textSecondary = BT.text?.secondary ?? '#8b949e';
  const green = BT.met?.financial ?? '#00d4aa';
  const amber = BT.text?.amber ?? '#f59e0b';
  const red = BT.text?.red ?? '#ef4444';

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: bg }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: textMuted }}>LOADING ROADMAP...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bg, overflow: 'hidden', position: 'relative' }}>

      {/* Header bar */}
      <div style={{
        padding: '5px 10px', background: bgHeader, borderBottom: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: textMuted, letterSpacing: 0.5 }}>VALUE CREATION ROADMAP</span>
          {roadmap && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: textMuted }}>
              Generated {new Date(roadmap.meta.generated_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowBuildModal(true)}
          style={{
            background: green, border: 'none', color: '#000',
            fontFamily: MONO, fontSize: 9, fontWeight: 700, padding: '4px 12px',
            cursor: 'pointer', borderRadius: 2, letterSpacing: 0.5,
          }}
        >
          {roadmap ? '↻ REBUILD ROADMAP' : '+ BUILD ROADMAP'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '6px 10px', background: `${red}15`, borderBottom: `1px solid ${red}40`, fontFamily: MONO, fontSize: 9, color: red }}>
          ⚠ {error}
        </div>
      )}

      {/* Empty state */}
      {!roadmap && !loading && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ fontSize: 32 }}>🗺</div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: textPrimary, fontWeight: 700 }}>NO ROADMAP GENERATED</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: textMuted, textAlign: 'center', maxWidth: 380, lineHeight: 1.6 }}>
            Generate a value creation roadmap to get an ordered, year-by-year operational plan
            with evidence-backed actions to reach your target return.
          </div>
          <button
            onClick={() => setShowBuildModal(true)}
            style={{
              background: green, border: 'none', color: '#000',
              fontFamily: MONO, fontSize: 10, fontWeight: 700, padding: '8px 24px',
              cursor: 'pointer', borderRadius: 2, letterSpacing: 0.5, marginTop: 6,
            }}
          >
            BUILD ROADMAP
          </button>
        </div>
      )}

      {/* Roadmap content */}
      {roadmap && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Achievability Banner */}
          <div style={{
            padding: '10px 14px', background: bgPanel,
            borderBottom: `2px solid ${achievabilityColor(roadmap.meta.achievability_status)}`,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{
                fontFamily: MONO, fontSize: 10, fontWeight: 700,
                color: achievabilityColor(roadmap.meta.achievability_status),
                border: `1px solid ${achievabilityColor(roadmap.meta.achievability_status)}40`,
                padding: '2px 8px', borderRadius: 2, letterSpacing: 0.5,
              }}>
                {achievabilityLabel(roadmap.meta.achievability_status)}
              </span>

              {/* IRR comparison — baseline → roadmap → target */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: textMuted, letterSpacing: 0.4 }}>BASELINE IRR</span>
                  <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: textSecondary }}>
                    {fmtPct(roadmap.meta.baseline_irr)}
                  </span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 10, color: textMuted }}>→</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: green, letterSpacing: 0.4 }}>ROADMAP IRR</span>
                  <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: green }}>
                    {fmtPct(roadmap.meta.roadmap_irr)}
                  </span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 10, color: textMuted }}>→</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: amber, letterSpacing: 0.4 }}>TARGET IRR</span>
                  <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: amber }}>
                    {fmtPct(roadmap.meta.target_irr)}
                  </span>
                </div>
                <div style={{ width: 1, height: 28, background: borderMed, flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: textMuted }}>ACTIONS</span>
                  <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: green }}>
                    {roadmap.roadmap_actions.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: textMuted }}>NOI GAP</span>
                  <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: textPrimary }}>
                    {fmt$(roadmap.gap_analysis.total_noi_gap)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: textMuted }}>M36 d</span>
                  <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color:
                    roadmap.plausibility_check.m36_d_value <= 1.5 ? green
                      : roadmap.plausibility_check.m36_d_value <= 2.5 ? amber : red }}>
                    {roadmap.plausibility_check.m36_d_value.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ fontFamily: MONO, fontSize: 9, color: textSecondary, lineHeight: 1.5 }}>
              {roadmap.meta.achievability_reasoning}
            </div>
          </div>

          {/* Gap Buckets */}
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${border}`, background: bgHeader, flexShrink: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: textMuted, letterSpacing: 0.5, marginBottom: 8 }}>NOI GAP DECOMPOSITION</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(roadmap.gap_analysis.gap_by_bucket).map(([bucket, val]) => (
                <div key={bucket} style={{ background: bgPanel, border: `1px solid ${borderMed}`, padding: '5px 10px', borderRadius: 2 }}>
                  <div style={{ fontFamily: MONO, fontSize: 7, color: textMuted, letterSpacing: 0.4 }}>
                    {bucket.replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: green }}>
                    {fmt$(val)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trajectory Chart */}
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${border}`, background: bgPanel, flexShrink: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: textMuted, letterSpacing: 0.5, marginBottom: 10 }}>
              YEAR-BY-YEAR NOI TRAJECTORY
            </div>
            <TrajectoryChart trajectory={roadmap.yearly_trajectory} actions={roadmap.roadmap_actions} />

            {/* Year details */}
            <div style={{ marginTop: 10, display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {roadmap.yearly_trajectory.map(year => (
                <div key={year.year} style={{
                  flex: '0 0 auto', background: bgHeader, border: `1px solid ${borderMed}`,
                  padding: '5px 8px', borderRadius: 2, minWidth: 90,
                }}>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: textMuted, marginBottom: 4 }}>YEAR {year.year}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: green }}>
                    +{fmt$(year.noi_lift_this_year)}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: textMuted }}>
                    NOI: {fmt$(year.noi_with_roadmap)}
                  </div>
                  <div style={{ marginTop: 3 }}>
                    <span style={{
                      fontFamily: MONO, fontSize: 7, letterSpacing: 0.3,
                      color: postureColor(year.posture_classification),
                      border: `1px solid ${postureColor(year.posture_classification)}40`,
                      padding: '1px 4px', borderRadius: 1,
                    }}>
                      {year.posture_classification.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Table */}
          <div style={{ padding: '10px 14px', flex: 1, position: 'relative' }}>
            {/* Action table header with filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: textMuted, letterSpacing: 0.5 }}>ACTION PLAN</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setFilterCategory(null)}
                  style={{
                    fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
                    background: filterCategory === null ? green : 'transparent',
                    border: `1px solid ${filterCategory === null ? green : borderMed}`,
                    color: filterCategory === null ? '#000' : textMuted,
                  }}
                >ALL</button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat === filterCategory ? null : cat)}
                    style={{
                      fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
                      background: filterCategory === cat ? categoryColor(cat) : 'transparent',
                      border: `1px solid ${filterCategory === cat ? categoryColor(cat) : borderMed}`,
                      color: filterCategory === cat ? '#000' : textMuted,
                    }}
                  >{cat.toUpperCase()}</button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div style={{ border: `1px solid ${borderMed}`, borderRadius: 2, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '24px 1fr 90px 90px 80px 60px',
                background: bgHeader, padding: '5px 10px',
                borderBottom: `1px solid ${border}`,
              }}>
                {['#', 'ACTION', 'TIMING', 'IMPACT/YR', 'CATEGORY', 'CONF'].map(h => (
                  <div key={h} style={{ fontFamily: MONO, fontSize: 7, color: textMuted, letterSpacing: 0.4 }}>{h}</div>
                ))}
              </div>

              {filteredActions.map((action, idx) => {
                const catColor = categoryColor(action.category);
                const { label: confLabel, color: confColor } = confidenceBadge(action.expected_impact.confidence);
                const isSelected = selectedAction?.id === action.id;

                return (
                  <div
                    key={action.id}
                    onClick={() => setSelectedAction(isSelected ? null : action)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '24px 1fr 90px 90px 80px 60px',
                      padding: '7px 10px', cursor: 'pointer',
                      borderBottom: `1px solid ${border}`,
                      background: isSelected ? `${catColor}10` : idx % 2 === 0 ? 'transparent' : `${bgPanel}80`,
                      borderLeft: isSelected ? `2px solid ${catColor}` : '2px solid transparent',
                    }}
                  >
                    <span style={{ fontFamily: MONO, fontSize: 9, color: textMuted }}>{idx + 1}</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {action.action_name}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: textSecondary }}>
                      M{action.timing.start_month} → M{action.timing.impact_fully_realized_month}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: catColor }}>
                      {fmt$(action.expected_impact.annualized_dollar_impact_at_full_realization)}
                    </span>
                    <span style={{
                      fontFamily: MONO, fontSize: 7, letterSpacing: 0.3,
                      color: catColor, border: `1px solid ${catColor}30`,
                      padding: '1px 4px', borderRadius: 1, alignSelf: 'center', display: 'inline-block',
                    }}>
                      {action.category.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: confColor }}>{confLabel}</span>
                  </div>
                );
              })}

              {filteredActions.length === 0 && (
                <div style={{ padding: '20px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 9, color: textMuted }}>
                  No actions in this category
                </div>
              )}
            </div>

            {/* M36 note */}
            <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 8, color: textMuted, lineHeight: 1.5 }}>
              M36 PLAUSIBILITY: {roadmap.plausibility_check.classification.replace(/_/g, ' ').toUpperCase()} — {roadmap.plausibility_check.notes}
            </div>
          </div>
        </div>
      )}

      {/* Evidence Panel overlay */}
      {selectedAction && roadmap && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, pointerEvents: 'all' }}>
            <ActionEvidencePanel action={selectedAction} onClose={() => setSelectedAction(null)} />
          </div>
        </div>
      )}

      {/* Build modal */}
      {showBuildModal && (
        <BuildRoadmapModal
          onClose={() => setShowBuildModal(false)}
          onBuild={handleBuild}
          loading={generating}
          f9HoldYears={holdYears}
        />
      )}
    </div>
  );
}
