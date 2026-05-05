/**
 * LeaseVelocitySection — §12 Frontend UI
 *
 * Architecture: pure presentational/input components.
 * All API calls and state management live in ProjectionsTab (the parent).
 * This file exports:
 *   - LeasingCostTreatmentToggle  (used in two locations per spec)
 *   - LeaseVelocitySection        (main container, accepts result + callbacks as props)
 *   - LVInputs / LeaseVelocityResult types
 */

import React, { useState, useMemo } from 'react';
import { BT, MONO } from '../../../components/deal/bloomberg-ui';

// ─── Types (mirrors backend lease-velocity-types.ts) ─────────────────────────

export type LeaseMode =
  | 'LEASE_UP_NEW_CONSTRUCTION'
  | 'STABILIZED_MAINTENANCE'
  | 'OCCUPANCY_RECOVERY'
  | 'V2_PENDING_VALUE_ADD';

export type LeasingCostTreatment = 'OPERATING' | 'CAPITALIZED' | 'HYBRID';
export type ConcessionStrategy   = 'CONSERVATIVE' | 'MARKET' | 'AGGRESSIVE';
export type MarketingIntensity   = 'LOW' | 'MARKET' | 'AGGRESSIVE';

export interface MonthOutput {
  month_index: number;
  calendar_month: string;
  mode_for_month: LeaseMode;
  expirations: number;
  renewals: number;
  replacement_leases: number;
  gap_close_leases: number;
  pre_lease_signings: number;
  lease_up_signings: number;
  total_signings: number;
  move_ins: number;
  move_outs: number;
  cumulative_occupied: number;
  physical_occupancy_pct: number;
  economic_occupancy_pct: number;
  gpr: number;
  vacancy_loss: number;
  concessions_new_lease: number;
  concessions_renewal: number;
  loss_to_lease_dollars: number;
  effective_rent: number;
  marketing_spend: number;
  locator_fees: number;
  make_ready: number;
  bad_debt: number;
  opex: number;
  noi: number;
  debt_service: number;
  cash_flow: number;
  lease_up_reserve_burn: number;
  cumulative_lease_up_reserve: number;
  implied_prospect_volume: number;
  stabilization_marker: boolean;
}

export interface WarningFlag {
  type: string;
  message: string;
}

export interface LeaseVelocityResult {
  success: boolean;
  mode: LeaseMode;
  inputs: Record<string, unknown>;
  months: MonthOutput[];
  narrative: string;
  stabilization_month: number | null;
  cumulative_reserve_required: number;
  /** Structured warning flags from backend engine (type + message) */
  warningFlags: WarningFlag[];
  /** Legacy string warnings — mapped to warningFlags if present */
  warnings?: string[];
}

export interface LVInputs {
  total_units: number;
  target_occupancy: number;
  current_occupancy: number;
  mode: LeaseMode;
  avg_market_rent: number;
  avg_in_place_rent: number;
  property_class: 'A' | 'B' | 'C';
  time_horizon_months: number;
  concession_strategy: ConcessionStrategy;
  marketing_intensity: MarketingIntensity;
  pre_leased_count: number;
  leasing_cost_treatment: LeasingCostTreatment;
}

// ─── Display maps ─────────────────────────────────────────────────────────────

const MODE_LABELS: Record<LeaseMode, string> = {
  LEASE_UP_NEW_CONSTRUCTION: 'LEASE-UP',
  STABILIZED_MAINTENANCE:    'STABLE',
  OCCUPANCY_RECOVERY:        'RECOVERY',
  V2_PENDING_VALUE_ADD:      'VALUE-ADD',
};

const MODE_COLORS: Record<LeaseMode, string> = {
  LEASE_UP_NEW_CONSTRUCTION: BT.text.teal,
  STABILIZED_MAINTENANCE:    BT.met.financial,
  OCCUPANCY_RECOVERY:        BT.text.amber,
  V2_PENDING_VALUE_ADD:      BT.text.purple,
};

// ─── Formatters ───────────────────────────────────────────────────────────────

export const lvFmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;
export const lvFmt$ = (v: number) => {
  if (v === 0) return '—';
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v).toLocaleString()}`;
};

// ─── LeasingCostTreatmentToggle ───────────────────────────────────────────────
// Exported — used in two locations:
//   Location A (Projections header): writes deal.leasing_cost_treatment via PATCH
//   Location B (ProForma header):    local view-state only

export function LeasingCostTreatmentToggle({
  value,
  onChange,
  dealDefault,
}: {
  value: LeasingCostTreatment;
  onChange: (v: LeasingCostTreatment) => void;
  /** When set, shows a subtle indicator that this is a view-override vs deal default */
  dealDefault?: LeasingCostTreatment;
}) {
  const opts: LeasingCostTreatment[] = ['OPERATING', 'CAPITALIZED', 'HYBRID'];
  const isOverride = dealDefault != null && value !== dealDefault;
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {isOverride && (
        <span style={{ fontFamily: MONO, fontSize: 6, color: BT.text.amber, letterSpacing: 0.5 }}>
          VIEW↑
        </span>
      )}
      {opts.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            background: value === opt ? `${BT.met.occupancy}25` : 'transparent',
            color:      value === opt ? BT.met.occupancy : BT.text.muted,
            border:     `1px solid ${value === opt ? BT.met.occupancy : BT.border.subtle}`,
            padding: '2px 7px', fontFamily: MONO, fontSize: 8,
            cursor: 'pointer', borderRadius: 2,
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── WarningFlagsPanel ────────────────────────────────────────────────────────

function WarningFlagsPanel({ warningFlags }: { warningFlags: WarningFlag[] }) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const visible = warningFlags.filter((_, i) => !dismissed.has(i));
  if (!visible.length) return null;

  const dismiss = (origIdx: number) =>
    setDismissed(prev => new Set([...prev, origIdx]));

  return (
    <div style={{
      background: `${BT.text.amber}0c`,
      border: `1px solid ${BT.text.amber}40`,
      borderLeft: `3px solid ${BT.text.amber}`,
      borderRadius: 3, padding: '6px 10px', marginBottom: 8,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, fontWeight: 700, marginBottom: 4, letterSpacing: 0.6 }}>
        ENGINE WARNINGS ({visible.length})
      </div>
      {warningFlags.map((flag, origIdx) => {
        if (dismissed.has(origIdx)) return null;
        const isCatchup = flag.type === 'INFEASIBLE_CATCHUP_PACE';
        const minMatch = flag.message.match(/minimum[:\s]+(\d+)\s*months?/i);
        const recMonths = minMatch ? minMatch[1] : null;
        return (
          <div key={origIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, flex: 1, lineHeight: 1.5 }}>
              ⚠ {isCatchup ? (
                <>
                  <strong>INFEASIBLE CATCHUP PACE</strong>
                  {recMonths ? ` — recommended minimum: ${recMonths} months` : `: ${flag.message}`}
                </>
              ) : (
                <>
                  <strong style={{ letterSpacing: 0.4 }}>{flag.type.replace(/_/g, ' ')}</strong>
                  {flag.message ? ` — ${flag.message}` : ''}
                </>
              )}
            </span>
            <button
              onClick={() => dismiss(origIdx)}
              title="Dismiss this session"
              style={{
                background: 'transparent', border: 'none', color: BT.text.muted,
                cursor: 'pointer', fontFamily: MONO, fontSize: 10, padding: '0 2px', flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── RampChartArtifact ────────────────────────────────────────────────────────
// Bloomberg dark chart:
//   Left Y  = physical occupancy % (line)
//   Right Y = signed leases/month (bars, stacked: pre-lease purple + regular amber)
//   95% target shaded band; delivery + stabilization vertical markers

function RampChartArtifact({ months }: { months: MonthOutput[] }) {
  const W = 840, H = 200;
  const PAD = { top: 24, right: 64, bottom: 30, left: 50 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const n = months.length;
  if (n === 0) return null;

  const xOf = (i: number) =>
    PAD.left + (n > 1 ? (i / (n - 1)) * chartW : chartW / 2);

  const barW = Math.max(2, Math.min(14, (chartW / n) * 0.65));

  // Left Y: occupancy (0..1)
  const yOcc = (v: number) =>
    PAD.top + (1 - Math.min(Math.max(v, 0), 1)) * chartH;

  // Right Y: signings
  const maxSig = Math.max(...months.map(m => m.total_signings), 1);
  const ySign  = (v: number) => PAD.top + (1 - v / maxSig) * chartH;
  const barH   = (v: number) => Math.max(0, (v / maxSig) * chartH);

  // Occupancy line path
  const occPath = months
    .map((m, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOcc(m.physical_occupancy_pct).toFixed(1)}`)
    .join(' ');

  // Stabilization index
  const stabIdx = months.findIndex(m => m.stabilization_marker);

  // Delivery index: first month where pre-lease signings drop to 0 after having been > 0
  const deliveryIdx = months.findIndex(
    (m, i) => i > 0 && m.pre_lease_signings === 0 && months[i - 1].pre_lease_signings > 0,
  );

  // X tick indices (every 6 months)
  const xTickIdxs = months.map((_, i) => i).filter(i => i % 6 === 0 || i === n - 1);

  const occTicks = [0.25, 0.5, 0.75, 0.95];

  return (
    <div style={{ overflowX: 'auto', marginBottom: 8 }}>
      <svg
        width={W} height={H}
        style={{ display: 'block', background: BT.bg.panel, borderRadius: 3, border: `1px solid ${BT.border.subtle}` }}
      >
        {/* 95% target band (92%–95%) */}
        <rect
          x={PAD.left} y={yOcc(0.95)}
          width={chartW} height={Math.max(0, yOcc(0.92) - yOcc(0.95))}
          fill={BT.met.occupancy} fillOpacity={0.1}
        />

        {/* Horizontal grid */}
        {occTicks.map(t => {
          const y = yOcc(t);
          const is95 = Math.abs(t - 0.95) < 0.001;
          return (
            <g key={t}>
              <line
                x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
                stroke={is95 ? `${BT.met.occupancy}70` : BT.border.subtle}
                strokeDasharray={is95 ? '6 3' : undefined}
                strokeWidth={is95 ? 1 : 0.5}
              />
              <text
                x={PAD.left - 4} y={y + 3.5}
                textAnchor="end" fontSize={6.5}
                fill={is95 ? BT.met.occupancy : BT.text.muted}
                fontFamily={MONO}
              >
                {is95 ? '95%' : `${(t * 100).toFixed(0)}%`}
              </text>
            </g>
          );
        })}

        {/* Right Y axis labels (signings) */}
        <text x={PAD.left + chartW + 3} y={PAD.top + 5}   fontSize={6.5} fill={`${BT.text.amber}aa`} fontFamily={MONO}>{maxSig.toFixed(0)}</text>
        <text x={PAD.left + chartW + 3} y={PAD.top + chartH} fontSize={6.5} fill={`${BT.text.amber}aa`} fontFamily={MONO}>0</text>
        <text x={PAD.left + chartW + 3} y={PAD.top + chartH / 2 + 4} fontSize={6} fill={`${BT.text.amber}88`} fontFamily={MONO}>SGN</text>

        {/* Delivery vertical */}
        {deliveryIdx >= 0 && (
          <g>
            <line
              x1={xOf(deliveryIdx)} y1={PAD.top}
              x2={xOf(deliveryIdx)} y2={PAD.top + chartH}
              stroke={BT.text.cyan} strokeDasharray="4 3" strokeWidth={1.5} strokeOpacity={0.7}
            />
            <text x={xOf(deliveryIdx) + 3} y={PAD.top + 10} fontSize={6.5} fill={BT.text.cyan} fontFamily={MONO}>
              CO
            </text>
          </g>
        )}

        {/* Stabilization vertical */}
        {stabIdx >= 0 && (
          <g>
            <line
              x1={xOf(stabIdx)} y1={PAD.top}
              x2={xOf(stabIdx)} y2={PAD.top + chartH}
              stroke={BT.met.financial} strokeDasharray="4 3" strokeWidth={1.5}
            />
            <text x={xOf(stabIdx) + 3} y={PAD.top + 20} fontSize={6.5} fill={BT.met.financial} fontFamily={MONO}>
              STAB
            </text>
          </g>
        )}

        {/* Signing bars (stacked: pre-lease purple at base, regular amber on top) */}
        {months.map((m, i) => {
          const totalH = barH(m.total_signings);
          const preH   = barH(m.pre_lease_signings);
          const regH   = Math.max(0, totalH - preH);
          const cx     = xOf(i);
          const bx     = cx - barW / 2;
          const baseY  = PAD.top + chartH;

          return (
            <g key={i}>
              {/* Regular leases (top portion) */}
              {regH > 0 && (
                <rect
                  x={bx} y={baseY - totalH}
                  width={barW} height={regH}
                  fill={BT.text.amber} fillOpacity={0.75}
                />
              )}
              {/* Pre-lease portion (bottom) */}
              {preH > 0 && (
                <rect
                  x={bx} y={baseY - preH}
                  width={barW} height={preH}
                  fill={BT.text.purple} fillOpacity={0.85}
                />
              )}
            </g>
          );
        })}

        {/* Occupancy area fill */}
        <path
          d={`${occPath} L${xOf(n - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`}
          fill={BT.met.occupancy} fillOpacity={0.06}
        />
        {/* Occupancy line */}
        <path d={occPath} stroke={BT.met.occupancy} strokeWidth={2} fill="none" />

        {/* X ticks */}
        {xTickIdxs.map(i => (
          <text
            key={i}
            x={xOf(i)} y={H - 5}
            textAnchor="middle" fontSize={6.5} fill={BT.text.muted} fontFamily={MONO}
          >
            {months[i].calendar_month}
          </text>
        ))}

        {/* Legend */}
        <g transform={`translate(${PAD.left + 6},${PAD.top + 4})`}>
          <line x1={0} y1={5} x2={14} y2={5} stroke={BT.met.occupancy} strokeWidth={2} />
          <text x={17} y={8.5} fontSize={6.5} fill={BT.text.secondary} fontFamily={MONO}>OCC%</text>
          <rect x={80} y={1} width={8} height={8} fill={BT.text.amber} fillOpacity={0.75} />
          <text x={91} y={8.5} fontSize={6.5} fill={BT.text.secondary} fontFamily={MONO}>SIGNINGS</text>
          <rect x={158} y={1} width={8} height={8} fill={BT.text.purple} fillOpacity={0.85} />
          <text x={169} y={8.5} fontSize={6.5} fill={BT.text.secondary} fontFamily={MONO}>PRE-LEASE</text>
          {deliveryIdx >= 0 && (
            <>
              <line x1={246} y1={5} x2={256} y2={5} stroke={BT.text.cyan} strokeDasharray="3 2" strokeWidth={1.5} />
              <text x={259} y={8.5} fontSize={6.5} fill={BT.text.secondary} fontFamily={MONO}>C/O</text>
            </>
          )}
          {stabIdx >= 0 && (
            <>
              <line x1={290} y1={5} x2={300} y2={5} stroke={BT.met.financial} strokeDasharray="3 2" strokeWidth={1.5} />
              <text x={303} y={8.5} fontSize={6.5} fill={BT.text.secondary} fontFamily={MONO}>STAB</text>
            </>
          )}
        </g>
      </svg>
    </div>
  );
}

// ─── MonthlyForwardTable ──────────────────────────────────────────────────────
// Columns: MO | DATE | MODE | PHY OCC% | SIGNINGS | MOVE-INS | CONCESSIONS | MKTG | NOI | LU RESERVE | CUM RESERVE
// + collapsible funnel detail (implied_prospect_volume)

function MonthlyForwardTable({ months }: { months: MonthOutput[] }) {
  const [showFunnel, setShowFunnel] = useState(false);

  // Detect mode transitions
  const modeTransitions = useMemo(() => {
    const s = new Set<number>();
    for (let i = 1; i < months.length; i++) {
      if (months[i].mode_for_month !== months[i - 1].mode_for_month) s.add(i);
    }
    return s;
  }, [months]);

  type ColKey = keyof MonthOutput;

  interface ColDef {
    key: ColKey;
    label: string;
    width: number;
    align?: 'left' | 'right';
    fmt?: (m: MonthOutput) => React.ReactNode;
  }

  const cols: ColDef[] = [
    { key: 'month_index',           label: 'MO',        width: 34,  align: 'right', fmt: m => String(m.month_index) },
    { key: 'calendar_month',        label: 'DATE',      width: 68,  align: 'left' },
    {
      key: 'mode_for_month', label: 'MODE', width: 78, align: 'left',
      fmt: m => (
        <span style={{ color: MODE_COLORS[m.mode_for_month] ?? BT.text.muted, fontSize: 7 }}>
          {MODE_LABELS[m.mode_for_month] ?? m.mode_for_month}
        </span>
      ),
    },
    { key: 'physical_occupancy_pct', label: 'PHY OCC%',  width: 68, align: 'right', fmt: m => lvFmtPct(m.physical_occupancy_pct) },
    { key: 'economic_occupancy_pct', label: 'ECON OCC%', width: 72, align: 'right', fmt: m => lvFmtPct(m.economic_occupancy_pct) },
    { key: 'total_signings',         label: 'SIGNINGS',  width: 68, align: 'right', fmt: m => m.total_signings.toFixed(1) },
    { key: 'move_ins',               label: 'MOVE-INS',  width: 68, align: 'right', fmt: m => m.move_ins.toFixed(1) },
    { key: 'concessions_new_lease',  label: 'CONCESSIONS', width: 88, align: 'right', fmt: m => lvFmt$(m.concessions_new_lease) },
    { key: 'marketing_spend',        label: 'MKTG SPEND', width: 84, align: 'right', fmt: m => lvFmt$(m.marketing_spend) },
    { key: 'noi',                    label: 'NOI/MO',    width: 82, align: 'right',
      fmt: m => <span style={{ color: m.noi >= 0 ? BT.text.green : BT.text.red }}>{lvFmt$(m.noi)}</span>,
    },
    { key: 'lease_up_reserve_burn',     label: 'LU RES BURN', width: 86, align: 'right', fmt: m => lvFmt$(m.lease_up_reserve_burn) },
    { key: 'cumulative_lease_up_reserve', label: 'CUM RESERVE', width: 90, align: 'right', fmt: m => lvFmt$(m.cumulative_lease_up_reserve) },
  ];

  const funnelCols: ColDef[] = [
    { key: 'implied_prospect_volume', label: 'PROSPECTS', width: 76, align: 'right', fmt: m => m.implied_prospect_volume.toFixed(0) },
    { key: 'move_outs',               label: 'MOVE-OUTS', width: 68, align: 'right', fmt: m => m.move_outs.toFixed(1) },
    { key: 'expirations',             label: 'EXPIRATIONS', width: 80, align: 'right', fmt: m => m.expirations.toFixed(1) },
    { key: 'renewals',                label: 'RENEWALS',  width: 72, align: 'right', fmt: m => m.renewals.toFixed(1) },
  ];

  const activeCols = showFunnel ? [...cols, ...funnelCols] : cols;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <button
          onClick={() => setShowFunnel(v => !v)}
          style={{
            background: showFunnel ? `${BT.text.purple}18` : 'transparent',
            color:      showFunnel ? BT.text.purple : BT.text.muted,
            border:     `1px solid ${showFunnel ? BT.text.purple : BT.border.subtle}`,
            padding: '2px 7px', fontFamily: MONO, fontSize: 7,
            cursor: 'pointer', borderRadius: 2,
          }}
        >
          {showFunnel ? '▾ HIDE FUNNEL DETAIL' : '▸ SHOW FUNNEL DETAIL'} (prospects · renewals · move-outs)
        </button>
        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
          Scroll horizontally · {months.length} months · mode-transition rows bordered
        </span>
      </div>

      <div style={{ overflowX: 'auto', border: `1px solid ${BT.border.subtle}`, borderRadius: 3 }}>
        <table style={{ width: 'max-content', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 8 }}>
          <thead>
            <tr style={{ background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}` }}>
              {activeCols.map(c => (
                <th
                  key={c.key}
                  style={{
                    padding: '4px 8px', textAlign: c.align ?? 'right',
                    color: BT.text.muted, fontWeight: 600,
                    minWidth: c.width, whiteSpace: 'nowrap', letterSpacing: 0.5,
                  }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m, ri) => {
              const isStab       = m.stabilization_marker;
              const isTransition = modeTransitions.has(ri);
              const bg = isStab
                ? `${BT.met.financial}10`
                : ri % 2 === 0 ? BT.bg.panel : BT.bg.terminal;

              return (
                <tr
                  key={m.month_index}
                  style={{
                    background: bg,
                    borderBottom: isStab
                      ? `1px solid ${BT.met.financial}50`
                      : isTransition
                      ? `1px solid ${BT.border.bright}`
                      : `1px solid ${BT.border.subtle}`,
                    borderTop: isTransition ? `1px solid ${BT.border.bright}` : undefined,
                  }}
                >
                  {activeCols.map(c => {
                    let display: React.ReactNode;
                    if (c.fmt) {
                      display = c.fmt(m);
                    } else {
                      display = String(m[c.key]);
                    }

                    if (c.key === 'calendar_month' && isStab) {
                      display = (
                        <>
                          {String(m.calendar_month)}
                          <span style={{ marginLeft: 4, color: BT.met.financial, fontSize: 6 }}>●STAB</span>
                        </>
                      );
                    }
                    if (c.key === 'calendar_month' && isTransition && !isStab) {
                      display = (
                        <>
                          {String(m.calendar_month)}
                          <span style={{ marginLeft: 4, color: BT.border.bright, fontSize: 6 }}>→{MODE_LABELS[m.mode_for_month]}</span>
                        </>
                      );
                    }

                    const textColor = c.key === 'physical_occupancy_pct'
                      ? (m.physical_occupancy_pct >= 0.95 ? BT.met.financial : BT.text.primary)
                      : BT.text.primary;

                    return (
                      <td
                        key={c.key}
                        style={{ padding: '2px 8px', textAlign: c.align ?? 'right', color: textColor, whiteSpace: 'nowrap' }}
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── LeaseVelocityInputPanel ──────────────────────────────────────────────────

function LeaseVelocityInputPanel({
  inputs,
  onInputsChange,
  onRun,
  loading,
  resolvedMode,
  leaseOverride,
  onModeOverride,
  onClearOverride,
}: {
  inputs: LVInputs;
  onInputsChange: (v: LVInputs) => void;
  onRun: () => void;
  loading: boolean;
  resolvedMode?: LeaseMode;
  /** Stored deal.lease_mode_override — truthy means user has explicitly set a mode override */
  leaseOverride?: LeaseMode | null;
  /** Called when user changes the mode — caller PATCHes deal.lease_mode_override */
  onModeOverride?: (mode: LeaseMode) => void;
  /** Clear the persisted lease_mode_override and return engine to auto-detected mode */
  onClearOverride?: () => void;
}) {
  const set = <K extends keyof LVInputs>(k: K, v: LVInputs[K]) =>
    onInputsChange({ ...inputs, [k]: v });

  const mode = inputs.mode;
  /**
   * True whenever deal.lease_mode_override is set — i.e., the user has explicitly
   * chosen a mode rather than accepting the auto-detected one.
   * We do NOT require leaseOverride !== resolvedMode; the badge fires on any
   * persisted override because the intent is to show "user has taken control".
   */
  const isOverridden = leaseOverride != null;

  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div style={{
      borderBottom: `1px solid ${BT.border.subtle}`,
      background: BT.bg.panel,
    }}>
      {/* Primary row */}
      <div style={{ padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        {/* Mode selector with resolved-mode annotation */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5 }}>LEASE MODE</span>
            {resolvedMode != null && (
              <span style={{ fontFamily: MONO, fontSize: 6, color: BT.text.teal, letterSpacing: 0.3 }}>
                AUTO:{MODE_LABELS[resolvedMode]}
              </span>
            )}
            {isOverridden && (
              <>
                <span style={{
                  fontFamily: MONO, fontSize: 6, letterSpacing: 0.5, fontWeight: 700,
                  color: BT.text.amber, background: `${BT.text.amber}18`,
                  border: `1px solid ${BT.text.amber}`, borderRadius: 2,
                  padding: '0px 4px',
                }}>
                  MODE OVERRIDDEN
                </span>
                {onClearOverride && (
                  <button
                    onClick={onClearOverride}
                    title="Clear override — return to auto-detected mode"
                    style={{
                      background: 'transparent',
                      border: `1px solid ${BT.border.subtle}`,
                      color: BT.text.muted,
                      fontFamily: MONO, fontSize: 6,
                      padding: '0px 4px', borderRadius: 2,
                      cursor: 'pointer',
                    }}
                  >
                    ↺ AUTO
                  </button>
                )}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {(['LEASE_UP_NEW_CONSTRUCTION', 'STABILIZED_MAINTENANCE', 'OCCUPANCY_RECOVERY'] as LeaseMode[]).map(m => (
              <button
                key={m}
                onClick={() => { set('mode', m); onModeOverride?.(m); }}
                style={{
                  background: mode === m ? `${MODE_COLORS[m]}22` : 'transparent',
                  color:      mode === m ? MODE_COLORS[m] : BT.text.muted,
                  border:     `1px solid ${mode === m ? MODE_COLORS[m] : BT.border.subtle}`,
                  padding: '2px 8px', fontFamily: MONO, fontSize: 8,
                  cursor: 'pointer', borderRadius: 2,
                }}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: 1, height: 30, background: BT.border.subtle, alignSelf: 'center' }} />

        <InlineNum label="TOTAL UNITS"    value={inputs.total_units}         onChange={v => set('total_units', v)}         step={1}    min={1}   max={9999} width={68} />
        <InlineNum label="TARGET OCC"     value={inputs.target_occupancy}    onChange={v => set('target_occupancy', v)}    step={0.01} min={0.5} max={1.0}  width={60} fmt={lvFmtPct} />
        {mode !== 'LEASE_UP_NEW_CONSTRUCTION' && (
          <InlineNum label="CURRENT OCC"  value={inputs.current_occupancy}   onChange={v => set('current_occupancy', v)}   step={0.01} min={0}   max={1.0}  width={60} fmt={lvFmtPct} />
        )}
        <InlineNum label="MKT RENT"       value={inputs.avg_market_rent}     onChange={v => set('avg_market_rent', v)}     step={25}   min={0}               width={72} />
        {mode === 'LEASE_UP_NEW_CONSTRUCTION' && (
          <InlineNum label="PRE-LEASED"   value={inputs.pre_leased_count}    onChange={v => set('pre_leased_count', v)}    step={1}    min={0}               width={58} />
        )}
        <InlineNum label="HORIZON (MO)"   value={inputs.time_horizon_months} onChange={v => set('time_horizon_months', v)} step={6}    min={6}   max={120}  width={56} />

        {/* Class */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 3, letterSpacing: 0.5 }}>CLASS</div>
          <div style={{ display: 'flex', gap: 2 }}>
            {(['A', 'B', 'C'] as const).map(cls => (
              <button key={cls} onClick={() => set('property_class', cls)} style={{
                background: inputs.property_class === cls ? `${BT.text.amber}22` : 'transparent',
                color:      inputs.property_class === cls ? BT.text.amber : BT.text.muted,
                border:     `1px solid ${inputs.property_class === cls ? BT.text.amber : BT.border.subtle}`,
                padding: '2px 6px', fontFamily: MONO, fontSize: 8, cursor: 'pointer', borderRadius: 2,
              }}>{cls}</button>
            ))}
          </div>
        </div>

        {/* ADVANCED toggle + RUN button */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            style={{
              background: showAdvanced ? `${BT.text.purple}18` : 'transparent',
              color:      showAdvanced ? BT.text.purple : BT.text.muted,
              border:     `1px solid ${showAdvanced ? BT.text.purple : BT.border.subtle}`,
              padding: '2px 8px', fontFamily: MONO, fontSize: 7,
              cursor: 'pointer', borderRadius: 2, letterSpacing: 0.4,
            }}
          >
            {showAdvanced ? '▾ ADVANCED' : '▸ ADVANCED'}
          </button>
          <button
            onClick={onRun}
            disabled={loading}
            style={{
              background: loading ? BT.bg.active : BT.text.cyan,
              color:      loading ? BT.text.muted : '#000',
              border: 'none', padding: '5px 18px',
              fontFamily: MONO, fontSize: 9, fontWeight: 700,
              cursor: loading ? 'default' : 'pointer', borderRadius: 2, letterSpacing: 0.6,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'RUNNING…' : 'RUN ENGINE ▶'}
          </button>
        </div>
      </div>

      {/* Advanced / optional fields disclosure */}
      {showAdvanced && (
        <div style={{
          padding: '6px 10px 8px',
          display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end',
          borderTop: `1px solid ${BT.border.subtle}`,
          background: `${BT.bg.header}`,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.purple, letterSpacing: 0.5, alignSelf: 'center' }}>
            ADVANCED INPUTS
          </span>
          <div style={{ width: 1, height: 24, background: BT.border.subtle, alignSelf: 'center' }} />

          {/* Concession strategy */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 3, letterSpacing: 0.5 }}>CONCESSIONS</div>
            <div style={{ display: 'flex', gap: 2 }}>
              {(['CONSERVATIVE', 'MARKET', 'AGGRESSIVE'] as ConcessionStrategy[]).map(s => (
                <button key={s} onClick={() => set('concession_strategy', s)} style={{
                  background: inputs.concession_strategy === s ? `${BT.text.red}22` : 'transparent',
                  color:      inputs.concession_strategy === s ? BT.text.red : BT.text.muted,
                  border:     `1px solid ${inputs.concession_strategy === s ? BT.text.red : BT.border.subtle}`,
                  padding: '2px 5px', fontFamily: MONO, fontSize: 7, cursor: 'pointer', borderRadius: 2,
                }}>{s === 'CONSERVATIVE' ? 'CONSRV' : s === 'AGGRESSIVE' ? 'AGGR' : 'MKT'}</button>
              ))}
            </div>
          </div>

          {/* Marketing intensity (lease-up only) */}
          {mode === 'LEASE_UP_NEW_CONSTRUCTION' && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 3, letterSpacing: 0.5 }}>MARKETING</div>
              <div style={{ display: 'flex', gap: 2 }}>
                {(['LOW', 'MARKET', 'AGGRESSIVE'] as MarketingIntensity[]).map(s => (
                  <button key={s} onClick={() => set('marketing_intensity', s)} style={{
                    background: inputs.marketing_intensity === s ? `${BT.text.cyan}22` : 'transparent',
                    color:      inputs.marketing_intensity === s ? BT.text.cyan : BT.text.muted,
                    border:     `1px solid ${inputs.marketing_intensity === s ? BT.text.cyan : BT.border.subtle}`,
                    padding: '2px 5px', fontFamily: MONO, fontSize: 7, cursor: 'pointer', borderRadius: 2,
                  }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* Avg in-place rent (optional override) */}
          <InlineNum label="IN-PLACE RENT"  value={inputs.avg_in_place_rent}  onChange={v => set('avg_in_place_rent', v)}  step={25} min={0} width={76} />
        </div>
      )}
    </div>
  );
}

// Tiny inline numeric input with click-to-edit
function InlineNum({
  label, value, step = 1, min, max, width = 72, onChange, fmt,
}: {
  label: string; value: number; step?: number; min?: number; max?: number;
  width?: number; onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw]         = useState('');

  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 3, letterSpacing: 0.5 }}>
        {label}
      </div>
      {editing ? (
        <input
          autoFocus
          type="number"
          value={raw}
          step={step} min={min} max={max}
          onChange={e => setRaw(e.target.value)}
          onBlur={() => { const v = parseFloat(raw); if (!isNaN(v)) onChange(v); setEditing(false); }}
          onKeyDown={e => {
            if (e.key === 'Enter') { const v = parseFloat(raw); if (!isNaN(v)) onChange(v); setEditing(false); }
            if (e.key === 'Escape') setEditing(false);
          }}
          style={{
            width, background: BT.bg.input,
            border: `1px solid ${BT.text.cyan}`,
            color: BT.text.primary, fontFamily: MONO, fontSize: 9,
            padding: '3px 5px', borderRadius: 2, outline: 'none',
          }}
        />
      ) : (
        <div
          onClick={() => { setRaw(String(value)); setEditing(true); }}
          style={{
            width, background: BT.bg.input,
            border: `1px solid ${BT.border.medium}`,
            color: BT.text.primary, fontFamily: MONO, fontSize: 9,
            padding: '3px 5px', borderRadius: 2, cursor: 'text', userSelect: 'none',
          }}
        >
          {fmt ? fmt(value) : value}
        </div>
      )}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LvSkeleton() {
  return (
    <div style={{ padding: '12px 10px' }}>
      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginBottom: 8 }}>
        Running lease velocity engine…
      </div>
      {[180, 140, 100].map((w, i) => (
        <div key={i} style={{ height: 8, width: w, background: BT.border.subtle, borderRadius: 2, marginBottom: 6, opacity: 0.5 }} />
      ))}
    </div>
  );
}

// ─── LeaseVelocitySection (main export) ──────────────────────────────────────

export interface LeaseVelocitySectionProps {
  result:          LeaseVelocityResult | null;
  loading:         boolean;
  inputs:          LVInputs;
  onInputsChange:  (v: LVInputs) => void;
  onRun:           () => void;
  showConfig:      boolean;
  onToggleConfig:  () => void;
  runError:        string | null;
  /** Auto-detected mode from deal occupancy data (for "AUTO:" label) */
  resolvedMode?:   LeaseMode;
  /**
   * The value stored in deal.lease_mode_override (the real override field).
   * When set and different from resolvedMode, MODE OVERRIDDEN badge is shown.
   * When the user changes mode in the panel, this callback writes the new
   * value to deal.lease_mode_override via PATCH.
   */
  leaseOverride?:  LeaseMode | null;
  onModeOverride?: (mode: LeaseMode) => void;
  /** Clear the persisted lease_mode_override and return engine to auto-detected mode */
  onClearOverride?: () => void;
}

export function LeaseVelocitySection({
  result, loading, inputs, onInputsChange, onRun, showConfig, onToggleConfig, runError,
  resolvedMode, leaseOverride, onModeOverride, onClearOverride,
}: LeaseVelocitySectionProps) {
  const [showTable, setShowTable] = useState(false);

  return (
    <div style={{ background: BT.bg.panel, borderBottom: `2px solid ${BT.border.medium}`, flexShrink: 0 }}>

      {/* ─ Section header ─ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '5px 10px',
        background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan, fontWeight: 700, letterSpacing: 0.8 }}>
          LEASE VELOCITY ENGINE
        </span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
          §12 — Monthly Forward Ramp Model
        </span>

        {result && !loading && (
          <div style={{ display: 'flex', gap: 12, marginLeft: 12 }}>
            <span style={{ fontFamily: MONO, fontSize: 7, color: BT.met.financial }}>
              {result.stabilization_month !== null ? `STAB MO ${result.stabilization_month}` : 'NO STABILIZATION'}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.amber }}>
              CUM RESERVE {lvFmt$(result.cumulative_reserve_required)}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
              {result.months.length} MO
            </span>
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            onClick={onToggleConfig}
            style={{
              background: showConfig ? `${BT.text.amber}18` : 'transparent',
              color:      showConfig ? BT.text.amber : BT.text.muted,
              border:     `1px solid ${showConfig ? BT.text.amber : BT.border.subtle}`,
              padding: '2px 8px', fontFamily: MONO, fontSize: 8,
              cursor: 'pointer', borderRadius: 2,
            }}
          >
            {showConfig ? '▾ CONFIGURE' : '▸ CONFIGURE'}
          </button>
        </div>
      </div>

      {/* ─ Config input panel ─ */}
      {showConfig && (
        <LeaseVelocityInputPanel
          inputs={inputs}
          onInputsChange={onInputsChange}
          onRun={onRun}
          loading={loading}
          resolvedMode={resolvedMode}
          leaseOverride={leaseOverride}
          onModeOverride={onModeOverride}
          onClearOverride={onClearOverride}
        />
      )}

      {/* ─ API Error ─ */}
      {runError && (
        <div style={{
          padding: '5px 10px', borderBottom: `1px solid ${BT.text.red}30`,
          background: `${BT.text.red}12`, fontFamily: MONO, fontSize: 8, color: BT.text.red,
        }}>
          ENGINE ERROR: {runError}
        </div>
      )}

      {/* ─ Loading skeleton ─ */}
      {loading && <LvSkeleton />}

      {/* ─ Results ─ */}
      {result && !loading && (
        <div style={{ padding: '8px 10px' }}>

          {/* Warnings — uses warningFlags[] (structured); falls back to legacy string warnings */}
          {(() => {
            const flags: WarningFlag[] = result.warningFlags?.length
              ? result.warningFlags
              : (result.warnings ?? []).map(w => ({ type: 'ENGINE_WARNING', message: w }));
            return flags.length > 0 ? <WarningFlagsPanel warningFlags={flags} /> : null;
          })()}

          {/* KPI strip + narrative */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: 'STAB MONTH', value: result.stabilization_month !== null ? `MO ${result.stabilization_month}` : '—', color: BT.met.financial },
                { label: 'CUM RESERVE', value: lvFmt$(result.cumulative_reserve_required), color: BT.text.amber },
                { label: 'HORIZON',    value: `${result.months.length} MO`, color: BT.text.cyan },
                { label: 'MODE',       value: MODE_LABELS[result.mode] ?? result.mode, color: MODE_COLORS[result.mode] ?? BT.text.primary },
                { label: 'PEAK OCC',   value: lvFmtPct(Math.max(...result.months.map(m => m.physical_occupancy_pct))), color: BT.met.occupancy },
                { label: 'PEAK NOI/MO', value: lvFmt$(Math.max(...result.months.map(m => m.noi))), color: BT.met.financial },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: BT.bg.header, borderRadius: 3, padding: '5px 10px', border: `1px solid ${BT.border.subtle}` }}>
                  <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 2 }}>{kpi.label}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: kpi.color, fontWeight: 700 }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            {/* Narrative */}
            <div style={{ flex: 1, minWidth: 260, background: BT.bg.terminal, border: `1px solid ${BT.border.subtle}`, borderRadius: 3, padding: '6px 10px' }}>
              <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 3, letterSpacing: 0.5 }}>ENGINE NARRATIVE</div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, lineHeight: 1.6 }}>{result.narrative}</div>
            </div>
          </div>

          {/* Ramp chart */}
          <RampChartArtifact months={result.months} />

          {/* Monthly table toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <button
              onClick={() => setShowTable(v => !v)}
              style={{
                background: showTable ? `${BT.text.cyan}18` : 'transparent',
                color:      showTable ? BT.text.cyan : BT.text.muted,
                border:     `1px solid ${showTable ? BT.text.cyan : BT.border.subtle}`,
                padding: '2px 8px', fontFamily: MONO, fontSize: 8,
                cursor: 'pointer', borderRadius: 2,
              }}
            >
              {showTable ? '▾ HIDE MONTHLY TABLE' : '▸ SHOW MONTHLY TABLE'} ({result.months.length} mo)
            </button>
          </div>

          {showTable && <div style={{ marginTop: 8 }}><MonthlyForwardTable months={result.months} /></div>}
        </div>
      )}

      {/* ─ Empty state ─ */}
      {!result && !loading && !runError && (
        <div style={{ padding: '12px 10px', fontFamily: MONO, fontSize: 8, color: BT.text.muted, textAlign: 'center' }}>
          Use <strong style={{ color: BT.text.amber }}>▸ CONFIGURE</strong> above to adjust inputs, then press{' '}
          <strong style={{ color: BT.text.cyan }}>RUN ENGINE ▶</strong> to generate the monthly forward ramp model.
        </div>
      )}
    </div>
  );
}
