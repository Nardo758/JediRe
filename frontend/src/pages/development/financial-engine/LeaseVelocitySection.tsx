import React, { useState, useCallback } from 'react';
import { BT, MONO } from '../../../components/deal/bloomberg-ui';
import type { F9DealFinancials } from './types';
import { apiClient } from '../../../services/api.client';

// ─── Local type mirrors (matching backend lease-velocity-types.ts) ────────────

type LeaseMode =
  | 'LEASE_UP_NEW_CONSTRUCTION'
  | 'STABILIZED_MAINTENANCE'
  | 'OCCUPANCY_RECOVERY'
  | 'V2_PENDING_VALUE_ADD';

type LeasingCostTreatment = 'OPERATING' | 'CAPITALIZED' | 'HYBRID';
type ConcessionStrategy   = 'CONSERVATIVE' | 'MARKET' | 'AGGRESSIVE';
type MarketingIntensity   = 'LOW' | 'MARKET' | 'AGGRESSIVE';

interface MonthOutput {
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

interface LeaseVelocityResult {
  success: boolean;
  mode: LeaseMode;
  inputs: Record<string, unknown>;
  months: MonthOutput[];
  narrative: string;
  stabilization_month: number | null;
  cumulative_reserve_required: number;
  warnings: string[];
}

interface LVInputs {
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

// ─── Formatting helpers ───────────────────────────────────────────────────────

const fmtPctLocal = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtDollarLocal = (v: number) => {
  if (v === 0) return '—';
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v).toLocaleString()}`;
};

// ─── LeasingCostTreatmentToggle ───────────────────────────────────────────────

export function LeasingCostTreatmentToggle({
  value,
  onChange,
}: {
  value: LeasingCostTreatment;
  onChange: (v: LeasingCostTreatment) => void;
}) {
  const options: LeasingCostTreatment[] = ['OPERATING', 'CAPITALIZED', 'HYBRID'];
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            background: value === opt ? `${BT.met.occupancy}25` : 'transparent',
            color:      value === opt ? BT.met.occupancy : BT.text.muted,
            border:     `1px solid ${value === opt ? BT.met.occupancy : BT.border.subtle}`,
            padding: '2px 8px', fontFamily: MONO, fontSize: 9,
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

function WarningFlagsPanel({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <div style={{
      background: `${BT.text.amber}10`,
      border: `1px solid ${BT.text.amber}40`,
      borderLeft: `3px solid ${BT.text.amber}`,
      borderRadius: 3, padding: '6px 10px', marginBottom: 8,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, fontWeight: 700, marginBottom: 4, letterSpacing: 0.6 }}>
        ENGINE WARNINGS ({warnings.length})
      </div>
      {warnings.map((w, i) => (
        <div key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, marginBottom: 2 }}>
          ⚠ {w}
        </div>
      ))}
    </div>
  );
}

// ─── RampChartArtifact ────────────────────────────────────────────────────────

function RampChartArtifact({
  months,
}: {
  months: MonthOutput[];
  stabilizationMonth: number | null;
}) {
  const W = 840;
  const H = 180;
  const PAD = { top: 20, right: 56, bottom: 28, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const n = months.length;
  if (n === 0) return null;

  const xOf = (i: number) =>
    PAD.left + (n > 1 ? (i / (n - 1)) * chartW : chartW / 2);

  const yOcc = (v: number) => PAD.top + (1 - Math.min(Math.max(v, 0), 1)) * chartH;

  const noiValues = months.map(m => m.noi);
  const noiMin = Math.min(0, ...noiValues);
  const noiMax = Math.max(...noiValues, 1);
  const noiRange = noiMax - noiMin || 1;
  const yNoi = (v: number) => PAD.top + (1 - (v - noiMin) / noiRange) * chartH;

  const occPath = months
    .map((m, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOcc(m.physical_occupancy_pct).toFixed(1)}`)
    .join(' ');

  const noiPath = months
    .map((m, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yNoi(m.noi).toFixed(1)}`)
    .join(' ');

  const occTicks = [0, 0.25, 0.5, 0.75, 0.95, 1.0];
  const xTickIdxs = months
    .map((_, i) => i)
    .filter(i => i % 6 === 0 || i === n - 1);

  const stabIdx = months.findIndex(m => m.stabilization_marker);

  return (
    <div style={{ overflowX: 'auto', marginBottom: 8 }}>
      <svg
        width={W}
        height={H}
        style={{ display: 'block', background: BT.bg.panel, borderRadius: 3, border: `1px solid ${BT.border.subtle}` }}
      >
        {/* Grid */}
        {occTicks.map(t => {
          const y = yOcc(t);
          const is95 = Math.abs(t - 0.95) < 0.001;
          return (
            <g key={t}>
              <line
                x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
                stroke={is95 ? `${BT.met.occupancy}50` : BT.border.subtle}
                strokeDasharray={is95 ? '5 3' : undefined}
                strokeWidth={is95 ? 1 : 0.5}
              />
              <text
                x={PAD.left - 4} y={y + 3.5}
                textAnchor="end" fontSize={6.5} fill={is95 ? BT.met.occupancy : BT.text.muted}
                fontFamily={MONO}
              >
                {(t * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}

        {/* NOI axis labels (right) */}
        <text x={PAD.left + chartW + 3} y={PAD.top + 5} fontSize={6.5} fill={`${BT.text.amber}99`} fontFamily={MONO}>
          {fmtDollarLocal(noiMax)}
        </text>
        <text x={PAD.left + chartW + 3} y={PAD.top + chartH} fontSize={6.5} fill={`${BT.text.amber}99`} fontFamily={MONO}>
          {fmtDollarLocal(noiMin)}
        </text>

        {/* Stabilization vertical */}
        {stabIdx >= 0 && (
          <g>
            <line
              x1={xOf(stabIdx)} y1={PAD.top}
              x2={xOf(stabIdx)} y2={PAD.top + chartH}
              stroke={BT.met.financial} strokeDasharray="4 3" strokeWidth={1.5}
            />
            <text
              x={xOf(stabIdx) + 3} y={PAD.top + 9}
              fontSize={6.5} fill={BT.met.financial} fontFamily={MONO}
            >
              STAB
            </text>
          </g>
        )}

        {/* NOI line */}
        <path d={noiPath} stroke={BT.text.amber} strokeWidth={1.5} fill="none" strokeOpacity={0.75} />

        {/* Occ area fill */}
        <path
          d={`${occPath} L${xOf(n - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`}
          fill={BT.met.occupancy} fillOpacity={0.07}
        />
        {/* Occ line */}
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
        <g transform={`translate(${PAD.left + 6},${PAD.top + 5})`}>
          <line x1={0} y1={5} x2={14} y2={5} stroke={BT.met.occupancy} strokeWidth={2} />
          <text x={17} y={8.5} fontSize={6.5} fill={BT.text.secondary} fontFamily={MONO}>PHY OCC%</text>
          <line x1={80} y1={5} x2={94} y2={5} stroke={BT.text.amber} strokeWidth={1.5} strokeOpacity={0.75} />
          <text x={97} y={8.5} fontSize={6.5} fill={BT.text.secondary} fontFamily={MONO}>NOI/MO</text>
        </g>
      </svg>
    </div>
  );
}

// ─── MonthlyForwardTable ──────────────────────────────────────────────────────

interface ColDef {
  key: keyof MonthOutput;
  label: string;
  width: number;
  align?: 'left' | 'right';
  fmt?: (v: number | string | boolean | LeaseMode) => React.ReactNode;
}

const TABLE_COLS: ColDef[] = [
  { key: 'month_index',              label: 'MO',        width: 34,  align: 'right' },
  { key: 'calendar_month',           label: 'DATE',      width: 68,  align: 'left' },
  {
    key: 'mode_for_month', label: 'MODE', width: 76, align: 'left',
    fmt: (v) => {
      const m = v as LeaseMode;
      return <span style={{ color: MODE_COLORS[m] ?? BT.text.muted, fontSize: 7 }}>{MODE_LABELS[m] ?? m}</span>;
    },
  },
  { key: 'physical_occupancy_pct',   label: 'PHY OCC%',  width: 70,  align: 'right', fmt: (v) => fmtPctLocal(v as number) },
  { key: 'economic_occupancy_pct',   label: 'ECON OCC%', width: 74,  align: 'right', fmt: (v) => fmtPctLocal(v as number) },
  { key: 'total_signings',           label: 'SIGNINGS',  width: 68,  align: 'right', fmt: (v) => (v as number).toFixed(1) },
  { key: 'concessions_new_lease',    label: 'CONCESSIONS', width: 88, align: 'right', fmt: (v) => fmtDollarLocal(v as number) },
  { key: 'marketing_spend',          label: 'MKTG SPEND', width: 86, align: 'right', fmt: (v) => fmtDollarLocal(v as number) },
  { key: 'locator_fees',             label: 'LOCATOR',   width: 78,  align: 'right', fmt: (v) => fmtDollarLocal(v as number) },
  { key: 'make_ready',               label: 'MAKE-READY', width: 78, align: 'right', fmt: (v) => fmtDollarLocal(v as number) },
  { key: 'noi',                      label: 'NOI/MO',    width: 84,  align: 'right', fmt: (v) => fmtDollarLocal(v as number) },
  { key: 'lease_up_reserve_burn',    label: 'LU RESERVE', width: 86, align: 'right', fmt: (v) => fmtDollarLocal(v as number) },
  { key: 'cumulative_lease_up_reserve', label: 'CUM RESERVE', width: 92, align: 'right', fmt: (v) => fmtDollarLocal(v as number) },
  { key: 'implied_prospect_volume',  label: 'PROSPECTS', width: 76,  align: 'right', fmt: (v) => (v as number).toFixed(0) },
];

function MonthlyForwardTable({ months }: { months: MonthOutput[] }) {
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${BT.border.subtle}`, borderRadius: 3 }}>
      <table style={{ width: 'max-content', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 8 }}>
        <thead>
          <tr style={{ background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}`, position: 'sticky', top: 0, zIndex: 2 }}>
            {TABLE_COLS.map(c => (
              <th
                key={c.key}
                style={{
                  padding: '4px 8px', textAlign: c.align ?? 'right',
                  color: BT.text.muted, fontWeight: 600, minWidth: c.width,
                  whiteSpace: 'nowrap', letterSpacing: 0.5,
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((m, ri) => {
            const isStab = m.stabilization_marker;
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
                    : `1px solid ${BT.border.subtle}`,
                }}
              >
                {TABLE_COLS.map(c => {
                  const raw = m[c.key];
                  let display: React.ReactNode;

                  if (c.fmt) {
                    display = c.fmt(raw as number | string | boolean | LeaseMode);
                  } else {
                    display = String(raw);
                  }

                  if (c.key === 'calendar_month' && isStab) {
                    display = (
                      <>
                        {String(raw)}
                        <span style={{ marginLeft: 4, color: BT.met.financial, fontSize: 6 }}>●STAB</span>
                      </>
                    );
                  }

                  const textColor = c.key === 'noi'
                    ? (m.noi >= 0 ? BT.text.green : BT.text.red)
                    : c.key === 'physical_occupancy_pct'
                    ? (m.physical_occupancy_pct >= 0.95 ? BT.met.financial : BT.text.primary)
                    : BT.text.primary;

                  return (
                    <td
                      key={c.key}
                      style={{
                        padding: '2px 8px',
                        textAlign: c.align ?? 'right',
                        color: textColor,
                        whiteSpace: 'nowrap',
                      }}
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
  );
}

// ─── LeaseVelocitySection (main export) ──────────────────────────────────────

export function LeaseVelocitySection({
  f9Financials,
}: {
  f9Financials: F9DealFinancials | null | undefined;
}) {
  const totalUnits  = f9Financials?.totalUnits ?? 100;
  const avgInPlace  = f9Financials?.rentRollSummary?.avgInPlaceRent ?? 1_500;
  const gprRow      = f9Financials?.proforma?.year1?.find(r => r.field === 'gpr');
  const avgMktRent  = gprRow?.resolved != null
    ? Math.round(gprRow.resolved / totalUnits / 12)
    : avgInPlace;

  const [inputs, setInputs] = useState<LVInputs>({
    total_units:            totalUnits,
    target_occupancy:       0.95,
    current_occupancy:      0,
    mode:                   'LEASE_UP_NEW_CONSTRUCTION',
    avg_market_rent:        Math.round(avgMktRent),
    avg_in_place_rent:      Math.round(avgInPlace),
    property_class:         'B',
    time_horizon_months:    36,
    concession_strategy:    'MARKET',
    marketing_intensity:    'MARKET',
    pre_leased_count:       0,
    leasing_cost_treatment: 'OPERATING',
  });

  const [result,    setResult]    = useState<LeaseVelocityResult | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [apiError,  setApiError]  = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const setField = <K extends keyof LVInputs>(k: K, v: LVInputs[K]) =>
    setInputs(prev => ({ ...prev, [k]: v }));

  const runEngine = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const payload: Record<string, unknown> = {
        total_units:            inputs.total_units,
        target_occupancy:       inputs.target_occupancy,
        current_occupancy:      inputs.current_occupancy,
        mode:                   inputs.mode,
        avg_market_rent:        inputs.avg_market_rent,
        avg_in_place_rent:      inputs.avg_in_place_rent,
        property_class:         inputs.property_class,
        time_horizon_months:    inputs.time_horizon_months,
        concession_strategy:    inputs.concession_strategy,
        leasing_cost_treatment: inputs.leasing_cost_treatment,
      };
      if (inputs.mode === 'LEASE_UP_NEW_CONSTRUCTION') {
        payload.marketing_intensity = inputs.marketing_intensity;
        payload.pre_leased_count    = inputs.pre_leased_count;
      }

      const resp = await apiClient.post<{ success: boolean; data: LeaseVelocityResult; error?: string }>(
        '/api/v1/lease-velocity/run',
        { inputs: payload },
      );

      if (resp.data?.success) {
        setResult(resp.data.data);
        setShowTable(false);
      } else {
        setApiError(resp.data?.error ?? 'Engine returned no result');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setApiError(e?.response?.data?.error ?? e?.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [inputs]);

  const mode = inputs.mode;

  return (
    <div style={{ background: BT.bg.panel, borderBottom: `2px solid ${BT.border.medium}`, flexShrink: 0 }}>

      {/* ── Section header ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '5px 10px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan, fontWeight: 700, letterSpacing: 0.8 }}>
          LEASE VELOCITY ENGINE
        </span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
          §12 — Monthly Forward Ramp Model
        </span>
        {result && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 7, color: BT.met.financial }}>
              {result.stabilization_month !== null
                ? `STAB MO ${result.stabilization_month}`
                : 'NO STABILIZATION'}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
              {result.months.length} MO HORIZON
            </span>
            <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.amber }}>
              CUM RESERVE {fmtDollarLocal(result.cumulative_reserve_required)}
            </span>
          </div>
        )}
      </div>

      {/* ── Input panel ────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 10px',
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end',
        borderBottom: `1px solid ${BT.border.subtle}`,
      }}>

        {/* Mode selector */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 3, letterSpacing: 0.5 }}>
            LEASE MODE
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {(['LEASE_UP_NEW_CONSTRUCTION', 'STABILIZED_MAINTENANCE', 'OCCUPANCY_RECOVERY'] as LeaseMode[]).map(m => (
              <button
                key={m}
                onClick={() => setField('mode', m)}
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

        {/* Leasing cost treatment */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 3, letterSpacing: 0.5 }}>
            COST TREATMENT
          </div>
          <LeasingCostTreatmentToggle
            value={inputs.leasing_cost_treatment}
            onChange={v => setField('leasing_cost_treatment', v)}
          />
        </div>

        <div style={{ width: 1, height: 32, background: BT.border.subtle, alignSelf: 'center' }} />

        {/* Total units */}
        <NumericField
          label="TOTAL UNITS"
          value={inputs.total_units}
          step={1} min={1} max={9999} width={68}
          onChange={v => setField('total_units', v)}
        />

        {/* Target occ */}
        <NumericField
          label="TARGET OCC"
          value={inputs.target_occupancy}
          step={0.01} min={0.5} max={1.0} width={64}
          onChange={v => setField('target_occupancy', v)}
          fmt={fmtPctLocal}
        />

        {/* Current occ — hidden for pure lease-up */}
        {mode !== 'LEASE_UP_NEW_CONSTRUCTION' && (
          <NumericField
            label="CURRENT OCC"
            value={inputs.current_occupancy}
            step={0.01} min={0} max={1.0} width={64}
            onChange={v => setField('current_occupancy', v)}
            fmt={fmtPctLocal}
          />
        )}

        {/* Avg market rent */}
        <NumericField
          label="AVG MKT RENT"
          value={inputs.avg_market_rent}
          step={25} min={0} width={72}
          onChange={v => setField('avg_market_rent', v)}
        />

        {/* Pre-leased — lease-up only */}
        {mode === 'LEASE_UP_NEW_CONSTRUCTION' && (
          <NumericField
            label="PRE-LEASED"
            value={inputs.pre_leased_count}
            step={1} min={0} width={60}
            onChange={v => setField('pre_leased_count', v)}
          />
        )}

        {/* Horizon */}
        <NumericField
          label="HORIZON (MO)"
          value={inputs.time_horizon_months}
          step={6} min={6} max={120} width={58}
          onChange={v => setField('time_horizon_months', v)}
        />

        {/* Property class */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 3, letterSpacing: 0.5 }}>CLASS</div>
          <div style={{ display: 'flex', gap: 2 }}>
            {(['A', 'B', 'C'] as const).map(cls => (
              <button
                key={cls}
                onClick={() => setField('property_class', cls)}
                style={{
                  background: inputs.property_class === cls ? `${BT.text.amber}22` : 'transparent',
                  color:      inputs.property_class === cls ? BT.text.amber : BT.text.muted,
                  border:     `1px solid ${inputs.property_class === cls ? BT.text.amber : BT.border.subtle}`,
                  padding: '2px 7px', fontFamily: MONO, fontSize: 8,
                  cursor: 'pointer', borderRadius: 2,
                }}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>

        {/* Concession strategy */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 3, letterSpacing: 0.5 }}>CONCESSIONS</div>
          <div style={{ display: 'flex', gap: 2 }}>
            {(['CONSERVATIVE', 'MARKET', 'AGGRESSIVE'] as ConcessionStrategy[]).map(s => (
              <button
                key={s}
                onClick={() => setField('concession_strategy', s)}
                style={{
                  background: inputs.concession_strategy === s ? `${BT.text.red}22` : 'transparent',
                  color:      inputs.concession_strategy === s ? BT.text.red : BT.text.muted,
                  border:     `1px solid ${inputs.concession_strategy === s ? BT.text.red : BT.border.subtle}`,
                  padding: '2px 6px', fontFamily: MONO, fontSize: 7,
                  cursor: 'pointer', borderRadius: 2,
                }}
              >
                {s === 'CONSERVATIVE' ? 'CONSRV' : s === 'AGGRESSIVE' ? 'AGGR' : 'MKT'}
              </button>
            ))}
          </div>
        </div>

        {/* Marketing intensity (lease-up only) */}
        {mode === 'LEASE_UP_NEW_CONSTRUCTION' && (
          <div>
            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 3, letterSpacing: 0.5 }}>MARKETING</div>
            <div style={{ display: 'flex', gap: 2 }}>
              {(['LOW', 'MARKET', 'AGGRESSIVE'] as MarketingIntensity[]).map(s => (
                <button
                  key={s}
                  onClick={() => setField('marketing_intensity', s)}
                  style={{
                    background: inputs.marketing_intensity === s ? `${BT.text.cyan}22` : 'transparent',
                    color:      inputs.marketing_intensity === s ? BT.text.cyan : BT.text.muted,
                    border:     `1px solid ${inputs.marketing_intensity === s ? BT.text.cyan : BT.border.subtle}`,
                    padding: '2px 6px', fontFamily: MONO, fontSize: 7,
                    cursor: 'pointer', borderRadius: 2,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Run button */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={() => { void runEngine(); }}
            disabled={loading}
            style={{
              background:  loading ? BT.bg.active : BT.text.cyan,
              color:       loading ? BT.text.muted : '#000',
              border:      'none',
              padding:     '5px 18px',
              fontFamily:  MONO, fontSize: 9, fontWeight: 700,
              cursor:      loading ? 'default' : 'pointer',
              borderRadius: 2, letterSpacing: 0.6,
              opacity:     loading ? 0.7 : 1,
            }}
          >
            {loading ? 'RUNNING…' : 'RUN ENGINE ▶'}
          </button>
        </div>
      </div>

      {/* ── API Error ───────────────────────────────────────────────────── */}
      {apiError && (
        <div style={{
          padding: '5px 10px',
          background: `${BT.text.red}12`,
          fontFamily: MONO, fontSize: 8, color: BT.text.red,
          borderBottom: `1px solid ${BT.text.red}30`,
        }}>
          ENGINE ERROR: {apiError}
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {result && (
        <div style={{ padding: '8px 10px' }}>

          {/* Warnings */}
          <WarningFlagsPanel warnings={result.warnings} />

          {/* KPI strip + narrative */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>

            {/* KPIs */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                {
                  label: 'STAB MONTH',
                  value: result.stabilization_month !== null ? `MO ${result.stabilization_month}` : '—',
                  color: BT.met.financial,
                },
                {
                  label: 'CUM RESERVE',
                  value: fmtDollarLocal(result.cumulative_reserve_required),
                  color: BT.text.amber,
                },
                {
                  label: 'HORIZON',
                  value: `${result.months.length} MO`,
                  color: BT.text.cyan,
                },
                {
                  label: 'MODE',
                  value: MODE_LABELS[result.mode] ?? result.mode,
                  color: MODE_COLORS[result.mode] ?? BT.text.primary,
                },
                {
                  label: 'PEAK OCC',
                  value: fmtPctLocal(Math.max(...result.months.map(m => m.physical_occupancy_pct))),
                  color: BT.met.occupancy,
                },
                {
                  label: 'PEAK NOI/MO',
                  value: fmtDollarLocal(Math.max(...result.months.map(m => m.noi))),
                  color: BT.met.financial,
                },
              ].map(kpi => (
                <div
                  key={kpi.label}
                  style={{
                    background: BT.bg.header, borderRadius: 3,
                    padding: '5px 10px',
                    border: `1px solid ${BT.border.subtle}`,
                  }}
                >
                  <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 2 }}>
                    {kpi.label}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: kpi.color, fontWeight: 700 }}>
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Narrative */}
            <div style={{
              flex: 1, minWidth: 260,
              background: BT.bg.terminal,
              border: `1px solid ${BT.border.subtle}`,
              borderRadius: 3, padding: '6px 10px',
            }}>
              <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginBottom: 3, letterSpacing: 0.5 }}>
                ENGINE NARRATIVE
              </div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, lineHeight: 1.6 }}>
                {result.narrative}
              </div>
            </div>
          </div>

          {/* Ramp chart */}
          <RampChartArtifact months={result.months} stabilizationMonth={result.stabilization_month} />

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
            <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
              Scroll horizontally · Highlighted row = stabilization month
            </span>
          </div>

          {showTable && (
            <div style={{ marginTop: 8 }}>
              <MonthlyForwardTable months={result.months} />
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!result && !loading && !apiError && (
        <div style={{
          padding: '14px 10px',
          fontFamily: MONO, fontSize: 8, color: BT.text.muted, textAlign: 'center',
        }}>
          Configure inputs above and press <strong style={{ color: BT.text.cyan }}>RUN ENGINE</strong> to generate the monthly forward ramp model.
        </div>
      )}
    </div>
  );
}

// ─── NumericField helper ─────────────────────────────────────────────────────

function NumericField({
  label, value, step = 1, min, max, width = 72,
  onChange, fmt,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  width?: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [raw, setRaw] = React.useState('');

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
          step={step}
          min={min}
          max={max}
          onChange={e => setRaw(e.target.value)}
          onBlur={() => {
            const v = parseFloat(raw);
            if (!isNaN(v)) onChange(v);
            setEditing(false);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              const v = parseFloat(raw);
              if (!isNaN(v) && e.key === 'Enter') onChange(v);
              setEditing(false);
            }
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
            padding: '3px 5px', borderRadius: 2, cursor: 'text',
            userSelect: 'none',
          }}
        >
          {fmt ? fmt(value) : value}
        </div>
      )}
    </div>
  );
}
