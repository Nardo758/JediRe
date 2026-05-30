import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { BT, Bd } from '../../../components/deal/bloomberg-ui';
import type {
  FinancialEngineTabProps, F9NarrativeBlock,
  F9DealFinancials, F9TrafficYear, F9GprDecomposition, F9ProFormaRow, F9IntegrityCheck,
  F9SubjectHistory,
} from './types';
import { fmt$, fmtPct } from './types';
import { ConcessionDrilldownModal, aggregateConcessionDetail } from './ConcessionDrilldownModal';
import type { AggregatedConcessionDetail } from './ConcessionDrilldownModal';
import { apiClient } from '../../../services/api.client';
import { InlineAssumptionBlock } from '../../../components/InlineAssumptionBlock';
import type { AssumptionFieldDef, CollisionEntry } from '../../../components/InlineAssumptionBlock';

const MONO = BT.font.mono;
type TimelineOption = 3 | 5 | 7 | 10;
type ViewMode = 'annual' | 'quarterly' | 'monthly';

// Type aliases — use shared types from types.ts (single source of truth)
type DealFinancials     = F9DealFinancials;
type TrafficYear        = F9TrafficYear;
type GprDecomposition   = F9GprDecomposition;
type OSRow              = F9ProFormaRow;
type IntegrityCheckItem = F9IntegrityCheck;

// ─── Projection row type — matches backend DealFinancials['projections'][number] ──────────────────
export type ProjYear = NonNullable<F9DealFinancials['projections']>[number];

// ─── Per-year override field map: frontend row.key → backend field name ───
// Only the lines whose values can be directly operator-set (not derived totals
// or %-of-GPR lines).  Year-1 overrides go through the Assumptions tab; this
// map is used exclusively for year 2+ cell edits in the DrilldownDrawer.
const OVERRIDE_FIELD_MAP: Partial<Record<keyof ProjYear, string>> = {
  gpr:         'gpr',
  otherIncome: 'other_income',
  payroll:     'payroll',
  repairs:     'repairs_maintenance',
  turnover:    'turnover',
  contractSvc: 'contract_services',
  marketing:   'marketing',
  utilities:   'utilities',
  gAndA:       'g_and_a',
  insurance:   'insurance',
  reTaxes:     'real_estate_tax',
  reserves:    'replacement_reserves',
};

// ─── Drilldown formula path entry ─────────────────────────────────────────
interface DrilldownEntry {
  label: string;
  value: string;
  sourceTab: string;
  tabIndex: number;
  formula?: string;
}

interface RampChartBar {
  year: number;
  fraction: number; // 0–1, relative to steady-state annual max
  phase: 'pre-ramp' | 'ramping' | 'steady-state';
  annualVal: number;
}

interface DrilldownInfo {
  rowLabel: string;
  rowKey: keyof ProjYear;
  year: number;
  /** Optional override for the "YR {year}" suffix in the drawer header. */
  yearLabel?: string;
  value: string;
  entries: DrilldownEntry[];
  /** Present only for RAMP user lines — drives the mini bar chart. */
  rampChart?: {
    bars: RampChartBar[];
    steadyStateAnnual: number;
  };
}

// ─── Row / section definitions ────────────────────────────────────────────
interface RowDef {
  label: string;
  key: keyof ProjYear;
  isTotal?: boolean;
  indent?: boolean;
  sign?: -1;
  fmt?: 'dollar' | 'pct' | 'x' | 'raw';
  afterTaxOnly?: boolean;
  sourceKey?: 'reTaxSource' | 'debtSource';
  tabLink?: number;
  /** If true, sub-period view shows the annual value unchanged (not prorated). Use for ratios, %s, balances, and exit/disposition rows */
  noSubPeriod?: boolean;
}
interface SectionDef {
  label: string;
  key: string;
  color: string;
  rows: RowDef[];
}

// ── Ramp formula — mirrors backend computeUserLineAnnual (proforma-seeder.service.ts §5B / Task #1160) ──
// yearIndex: 0-based (0 = Year 1)
function computeRampAwareAnnual(
  monthly: number,
  adoption: { ramp_start_period: number; ramp_duration_months: number; steady_state_monthly: number; probability_adopted: number } | null | undefined,
  yearIndex: number,
): number {
  if (!adoption) return monthly * 12;
  const steadyMo  = Number.isFinite(adoption.steady_state_monthly)  ? adoption.steady_state_monthly  : monthly;
  const rampStart = Number.isFinite(adoption.ramp_start_period)     ? adoption.ramp_start_period     : 0;
  const rampDur   = Number.isFinite(adoption.ramp_duration_months)  ? adoption.ramp_duration_months  : 0;
  const prob      = Number.isFinite(adoption.probability_adopted)   ? adoption.probability_adopted   : 1;
  const Y = yearIndex + 1;
  const periodMonth = (Y - 1) * 12 + 6; // midpoint of year Y
  if (periodMonth < rampStart) return 0;
  if (rampDur <= 0 || periodMonth >= rampStart + rampDur) return steadyMo * 12 * prob;
  const rampFraction = (periodMonth - rampStart) / rampDur;
  return steadyMo * rampFraction * 12 * prob;
}

// ── Ramp formula for a single month (0-indexed monthOffset from hold start) ──
// Used by quarterly/monthly projection sub-rows.
function computeRampAwareMonthly(
  monthly: number,
  adoption: { ramp_start_period: number; ramp_duration_months: number; steady_state_monthly: number; probability_adopted: number } | null | undefined,
  monthOffset: number,
): number {
  if (!adoption) return monthly;
  const steadyMo  = Number.isFinite(adoption.steady_state_monthly)  ? adoption.steady_state_monthly  : monthly;
  const rampStart = Number.isFinite(adoption.ramp_start_period)     ? adoption.ramp_start_period     : 0;
  const rampDur   = Number.isFinite(adoption.ramp_duration_months)  ? adoption.ramp_duration_months  : 0;
  const prob      = Number.isFinite(adoption.probability_adopted)   ? adoption.probability_adopted   : 1;
  const m = monthOffset + 1; // convert to 1-indexed period month
  if (m < rampStart) return 0;
  if (rampDur <= 0 || m >= rampStart + rampDur) return steadyMo * prob;
  const rampFraction = (m - rampStart) / rampDur;
  return steadyMo * rampFraction * prob;
}

// ── Ramp formula for a quarter (3-month sum, yearIndex + quarterIndex both 0-based) ──
function computeRampAwareQuarterly(
  monthly: number,
  adoption: { ramp_start_period: number; ramp_duration_months: number; steady_state_monthly: number; probability_adopted: number } | null | undefined,
  yearIndex: number,
  quarterIndex: number,
): number {
  const baseOffset = yearIndex * 12 + quarterIndex * 3;
  return [0, 1, 2].reduce((sum, i) => sum + computeRampAwareMonthly(monthly, adoption, baseOffset + i), 0);
}

// ── Compute ramp fraction (0..1) for a given year cell ───────────────────────
// Returns 0 for pre-ramp, 1 for fully-ramped, linear fraction in between.
function computeRampFraction(
  adoption: { ramp_start_period: number; ramp_duration_months: number } | null | undefined,
  yearIndex: number,
): number {
  if (!adoption) return 1;
  const rampStart = Number.isFinite(adoption.ramp_start_period) ? adoption.ramp_start_period : 0;
  const rampDur   = Number.isFinite(adoption.ramp_duration_months) ? adoption.ramp_duration_months : 0;
  const periodMonth = yearIndex * 12 + 6; // midpoint of year (yearIndex+1)
  if (periodMonth < rampStart) return 0;
  if (rampDur <= 0 || periodMonth >= rampStart + rampDur) return 1;
  return (periodMonth - rampStart) / rampDur;
}

// ── Build ramp tooltip string for a given year cell ──────────────────────────
function buildRampTooltip(
  adoption: { ramp_start_period: number; ramp_duration_months: number; steady_state_monthly: number; probability_adopted: number },
  yearIndex: number,
): string {
  const rampStart = adoption.ramp_start_period;
  const rampDur   = adoption.ramp_duration_months;
  const prob      = adoption.probability_adopted;
  const periodMonth = (yearIndex) * 12 + 6; // midpoint of year (yearIndex+1)
  if (periodMonth < rampStart) {
    return `Pre-ramp · starts month ${rampStart} · prob ${(prob * 100).toFixed(0)}%`;
  }
  if (rampDur <= 0 || periodMonth >= rampStart + rampDur) {
    return `Fully ramped · 100% steady state · prob ${(prob * 100).toFixed(0)}%`;
  }
  const rampMonthsIn = periodMonth - rampStart;
  const pct = Math.round((rampMonthsIn / rampDur) * 100);
  return `Ramp month ${Math.round(rampMonthsIn)} of ${rampDur} · ${pct}% steady state · prob ${(prob * 100).toFixed(0)}%`;
}

// ── Build ramp tooltip string for a quarterly cell ────────────────────────────
// yearIndex and quarterIndex are both 0-based.
function buildRampTooltipQuarterly(
  adoption: { ramp_start_period: number; ramp_duration_months: number; steady_state_monthly: number; probability_adopted: number },
  yearIndex: number,
  quarterIndex: number,
): string {
  const rampStart = adoption.ramp_start_period;
  const rampDur   = adoption.ramp_duration_months;
  const prob      = adoption.probability_adopted;
  const baseOffset = yearIndex * 12 + quarterIndex * 3;
  const firstM = baseOffset + 1; // 1-indexed hold month
  const lastM  = baseOffset + 3;
  const midM   = baseOffset + 2;
  const yr = yearIndex + 1;
  const q  = quarterIndex + 1;
  const probStr = `${(prob * 100).toFixed(0)}%`;

  if (midM < rampStart) {
    return `Q${q} YR${yr} · months ${firstM}–${lastM} · pre-ramp · prob ${probStr}`;
  }
  if (rampDur <= 0 || midM >= rampStart + rampDur) {
    return `Q${q} YR${yr} · months ${firstM}–${lastM} · fully ramped · 100% steady state · prob ${probStr}`;
  }
  // Average ramp fraction across the 3 months of the quarter
  const fracs = [firstM, firstM + 1, lastM].map(m => {
    if (m < rampStart) return 0;
    if (m >= rampStart + rampDur) return 1;
    return (m - rampStart) / rampDur;
  });
  const avgFrac = fracs.reduce((s, f) => s + f, 0) / fracs.length;
  const avgPct = Math.round(avgFrac * 100);
  return `Q${q} YR${yr} · months ${firstM}–${lastM} · avg ${avgPct}% steady state · prob ${probStr}`;
}

// ── Build ramp tooltip string for a monthly cell ──────────────────────────────
// monthOffset is 0-based (0 = hold month 1).
function buildRampTooltipMonthly(
  adoption: { ramp_start_period: number; ramp_duration_months: number; steady_state_monthly: number; probability_adopted: number },
  yearIndex: number,
  periodIdx: number,  // 1-based month within year
  monthOffset: number,
): string {
  const rampStart = adoption.ramp_start_period;
  const rampDur   = adoption.ramp_duration_months;
  const prob      = adoption.probability_adopted;
  const m = monthOffset + 1; // 1-indexed hold month
  const yr = yearIndex + 1;
  const probStr = `${(prob * 100).toFixed(0)}%`;

  if (m < rampStart) {
    return `M${periodIdx} YR${yr} · pre-ramp · starts month ${rampStart} · prob ${probStr}`;
  }
  if (rampDur <= 0 || m >= rampStart + rampDur) {
    return `M${periodIdx} YR${yr} · fully ramped · 100% steady state · prob ${probStr}`;
  }
  const rampMonthsIn = m - rampStart;
  const pct = Math.round((rampMonthsIn / rampDur) * 100);
  return `M${periodIdx} YR${yr} · ramp month ${rampMonthsIn} of ${rampDur} · ${pct}% steady state · prob ${probStr}`;
}

const fmtCell = (
  val: number | null | undefined,
  fmt: RowDef['fmt'] = 'dollar',
  sign?: -1,
): string => {
  if (val == null || isNaN(val as number)) return '—';
  const v = sign === -1 ? -Math.abs(val) : val;
  switch (fmt) {
    case 'pct': return `${(val * 100).toFixed(2)}%`;
    case 'x':   return `${val.toFixed(2)}×`;
    case 'raw': return val.toFixed(0);
    default:    return fmt$(v);
  }
};

const SECTIONS: SectionDef[] = [
  {
    label: 'REVENUE', key: 'revenue', color: BT.met.financial,
    rows: [
      { label: 'Gross Potential Rent',       key: 'gpr',           isTotal: true },
      { label: 'Vacancy Loss',               key: 'vacancyLoss',   indent: true, sign: -1 },
      { label: 'Loss to Lease',              key: 'lossToLease',   indent: true, sign: -1 },
      { label: 'Concessions',                key: 'concessions',   indent: true, sign: -1 },
      { label: 'Bad Debt / Collection Loss', key: 'badDebt',       indent: true, sign: -1 },
      { label: 'Non-Revenue Units',          key: 'nru',           indent: true, sign: -1 },
      { label: 'Net Rental Income',          key: 'nri',           isTotal: true },
      { label: 'Other Income',               key: 'otherIncome',   indent: true },
      { label: 'Effective Gross Income',     key: 'egi',           isTotal: true },
    ],
  },
  {
    label: 'EXPENSES', key: 'expense', color: BT.text.red,
    rows: [
      { label: 'Payroll / Personnel',        key: 'payroll',       indent: true, sign: -1 },
      { label: 'Repairs & Maintenance',      key: 'repairs',       indent: true, sign: -1 },
      { label: 'Turnover / Make-Ready',      key: 'turnover',      indent: true, sign: -1 },
      { label: 'Contract Services',          key: 'contractSvc',   indent: true, sign: -1 },
      { label: 'Marketing & Leasing',        key: 'marketing',     indent: true, sign: -1 },
      { label: 'Utilities',                  key: 'utilities',     indent: true, sign: -1 },
      { label: 'G&A / Administrative',       key: 'gAndA',         indent: true, sign: -1 },
      { label: 'Management Fee',             key: 'mgmtFee',       indent: true, sign: -1 },
      { label: 'Insurance',                  key: 'insurance',     indent: true, sign: -1 },
      { label: 'Real Estate Taxes',          key: 'reTaxes',       indent: true, sign: -1, sourceKey: 'reTaxSource', tabLink: 4 },
      { label: 'Replacement Reserves',       key: 'reserves',      indent: true, sign: -1 },
      { label: 'Total Operating Expenses',   key: 'totalOpex',     isTotal: true, sign: -1 },
    ],
  },
  {
    label: 'NOI', key: 'noi', color: BT.text.cyan,
    rows: [
      { label: 'Net Operating Income',       key: 'noi',           isTotal: true },
      { label: 'Operating Margin',           key: 'opMargin',      fmt: 'pct', noSubPeriod: true },
      { label: 'NOI / Unit',                 key: 'noiPerUnit',                noSubPeriod: true },
    ],
  },
  {
    label: 'DEBT SERVICE', key: 'debt', color: BT.text.orange,
    rows: [
      { label: 'Interest',                   key: 'interest',      indent: true, sign: -1, sourceKey: 'debtSource', tabLink: 6 },
      { label: 'Principal Paydown',          key: 'principal',     indent: true, sign: -1, sourceKey: 'debtSource', tabLink: 6 },
      { label: 'Total Debt Service',         key: 'annualDS',      isTotal: true, sign: -1, sourceKey: 'debtSource', tabLink: 6 },
    ],
  },
  {
    label: 'CASH FLOW', key: 'cashflow', color: BT.met.financial,
    rows: [
      { label: 'Cash Flow Before Tax',       key: 'cfbt',          isTotal: true },
      { label: 'CFADS (After Distributions)', key: 'cfads',        isTotal: true },
    ],
  },
  {
    label: 'AFTER-TAX', key: 'aftertax', color: BT.text.purple,
    rows: [
      { label: 'Depreciation',               key: 'depreciation',  indent: true, sign: -1, afterTaxOnly: true, tabLink: 4 },
      { label: 'Taxable Income',             key: 'taxableIncome', indent: true, afterTaxOnly: true },
      { label: 'Tax Payable',               key: 'taxPayable',    indent: true, sign: -1, afterTaxOnly: true },
      { label: 'After-Tax CFADS',            key: 'afterTaxCfads', isTotal: true, afterTaxOnly: true },
    ],
  },
  {
    label: 'SALE-YEAR DISPOSITION', key: 'exit', color: BT.text.amber,
    rows: [
      { label: 'Forward NOI (Exit)',              key: 'exitNoi',                                          noSubPeriod: true },
      { label: 'Exit Cap Rate',                   key: 'exitCap',                fmt: 'pct',               noSubPeriod: true },
      { label: 'Gross Sale Value',                key: 'grossSaleValue',                                   noSubPeriod: true },
      { label: '(–) Selling Costs (1.5%)',        key: 'sellingCosts',            indent: true, sign: -1,   noSubPeriod: true },
      { label: '(–) Doc Stamps / Transfer Tax',  key: 'dispositionDocStamps',    indent: true, sign: -1, tabLink: 4, noSubPeriod: true },
      { label: '(–) Loan Payoff',                key: 'loanPayoff',              indent: true, sign: -1,   noSubPeriod: true },
      { label: '(–) Disposition Tax (Est.)',      key: 'dispositionTaxPayable',   indent: true, sign: -1, afterTaxOnly: true, tabLink: 4, noSubPeriod: true },
      { label: 'Net Sale Proceeds',               key: 'netSaleProceeds',         isTotal: true,            noSubPeriod: true },
    ],
  },
];

// Key metrics strip — fixed bottom row (not a collapsible section)
interface MetricDef { label: string; key: keyof ProjYear; fmt: 'pct' | 'x' | 'dollar'; }
const METRICS_STRIP: MetricDef[] = [
  { label: 'OCC',      key: 'occupancy',     fmt: 'pct' },
  { label: 'DSCR',     key: 'dscr',          fmt: 'x'   },
  { label: 'DY',       key: 'debtYield',     fmt: 'pct' },
  { label: 'CoC',      key: 'coc',           fmt: 'pct' },
  { label: 'EM',       key: 'cumulativeEM',  fmt: 'x'   },
  { label: 'Cap',      key: 'capRatePct',    fmt: 'pct' },
  { label: 'NOI Margin', key: 'noiMarginPct',fmt: 'pct' },
  { label: 'OER',      key: 'opexRatioPct',  fmt: 'pct' },
  { label: 'RG',       key: 'rentGrowthPct', fmt: 'pct' },
];

// Source badge label
const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  taxes_tab: { label: 'TAX', color: BT.text.purple },
  proforma:  { label: 'PF',  color: BT.met.financial },
  estimate:  { label: 'EST', color: BT.text.muted },
  debt_tab:  { label: 'DEBT', color: BT.text.orange },
  capital_stack: { label: 'CS', color: BT.text.cyan },
};

// ─── GPR Decomposition Panel ──────────────────────────────────────────────
function GprDecompPanel({ decomp, totalUnits }: { decomp: GprDecomposition; totalUnits: number }) {
  const rows = [
    { label: 'RESOLVED', annual: decomp.resolvedAnnual, perUnit: decomp.resolvedPerUnitMo, color: BT.text.cyan, bold: true },
    { label: 'PLATFORM', annual: decomp.platformAnnual, perUnit: decomp.platformPerUnitMo, color: '#22D3EE' },
    { label: 'BROKER',   annual: decomp.brokerAnnual,   perUnit: decomp.brokerPerUnitMo,   color: BT.text.amber },
    { label: 'T12 ACTUAL', annual: decomp.t12Annual,    perUnit: decomp.t12PerUnitMo,      color: BT.met.physTraffic },
    { label: 'RENT ROLL', annual: decomp.rentRollAnnual, perUnit: null,                    color: BT.text.secondary },
  ];
  return (
    <div style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.panel, padding: '6px 10px', flexShrink: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.white, letterSpacing: 1, fontFamily: MONO, marginBottom: 4 }}>
        GPR SOURCE DECOMPOSITION
        <span style={{ marginLeft: 8, fontWeight: 400, color: BT.text.muted }}>({totalUnits} units)</span>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', flexDirection: 'column', minWidth: 100 }}>
            <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5 }}>{r.label}</span>
            <span style={{ fontSize: 11, fontWeight: r.bold ? 700 : 500, color: r.annual != null ? r.color : BT.text.muted, fontFamily: MONO }}>
              {r.annual != null ? fmt$(r.annual) : '—'}
            </span>
            {r.perUnit != null && (
              <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO }}>
                ${Math.round(r.perUnit).toLocaleString()}/unit/mo
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LTL Trajectory Panel — Task #1540 (Piece B1) ─────────────────────────
// Shows both LTL source signals (T12 trailing avg vs live lease-level) and an
// inline sparkline of the per-year decay trajectory used by Engine A.
function LTLTrajectoryPanel({ ltlSignals }: { ltlSignals: NonNullable<DealFinancials['ltlSignals']> }) {
  const [expanded, setExpanded] = useState(false);
  const { t12Pct, livePct, trajectorySource, byYear, captureRate } = ltlSignals;

  const hasLive = livePct != null;
  const startPct = (hasLive ? livePct! : t12Pct ?? 0) * 100;
  const endPct   = (byYear[byYear.length - 1] ?? 0) * 100;

  // Inline SVG sparkline — no external deps
  const W = 120; const H = 24; const PAD = 2;
  const maxV = Math.max(...byYear) || 0.001;
  const points = byYear.map((v, i) => {
    const x = PAD + (i / Math.max(1, byYear.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v / maxV) * (H - PAD * 2));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const TEAL = '#00B4D8';

  return (
    <div style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.panel, flexShrink: 0 }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 9, fontWeight: 700, color: TEAL, fontFamily: MONO, letterSpacing: 1 }}>
          LTL TRAJECTORY
        </span>
        <Bd c={TEAL}>B1</Bd>

        {/* Source pills */}
        <span style={{ fontSize: 8, fontFamily: MONO, color: hasLive ? '#4ADE80' : BT.text.amber, fontWeight: 700 }}>
          {hasLive ? `LIVE ${(livePct! * 100).toFixed(1)}%` : `T12 ${((t12Pct ?? 0) * 100).toFixed(2)}%`}
        </span>
        {hasLive && t12Pct != null && (
          <span style={{ fontSize: 8, fontFamily: MONO, color: BT.text.muted }}>
            T12 {(t12Pct * 100).toFixed(2)}%
          </span>
        )}
        <span style={{ fontSize: 8, fontFamily: MONO, color: BT.text.muted }}>→</span>
        <span style={{ fontSize: 8, fontFamily: MONO, color: TEAL }}>
          YR{byYear.length} {endPct.toFixed(2)}%
        </span>

        {/* Miniature sparkline */}
        <svg width={W} height={H} style={{ flexShrink: 0 }}>
          <polyline points={points} fill="none" stroke={TEAL} strokeWidth={1.5} opacity={0.7} />
        </svg>

        <span style={{ marginLeft: 'auto', fontSize: 9, color: BT.text.muted, fontFamily: MONO }}>{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '6px 10px', display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: `1px solid ${BT.border.subtle}` }}>
          {/* Signal source cards */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 90 }}>
            <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5, marginBottom: 2 }}>LIVE (M07)</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: hasLive ? '#4ADE80' : BT.text.muted, fontFamily: MONO }}>
              {livePct != null ? `${(livePct * 100).toFixed(1)}%` : '—'}
            </span>
            <span style={{ fontSize: 7, color: BT.text.muted, fontFamily: MONO }}>lease-level gap</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 90 }}>
            <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5, marginBottom: 2 }}>T12 TRAILING</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: BT.text.amber, fontFamily: MONO }}>
              {t12Pct != null ? `${(t12Pct * 100).toFixed(2)}%` : '—'}
            </span>
            <span style={{ fontSize: 7, color: BT.text.muted, fontFamily: MONO }}>12-mo average</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 90 }}>
            <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5, marginBottom: 2 }}>ENGINE ANCHORED AT</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: TEAL, fontFamily: MONO }}>
              {startPct.toFixed(trajectorySource === 't12' ? 2 : 1)}%
            </span>
            <span style={{ fontSize: 7, color: BT.text.muted, fontFamily: MONO }}>
              source: {trajectorySource === 'live' ? 'live M07' : 'T12 avg'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 90 }}>
            <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5, marginBottom: 2 }}>CAPTURE RATE</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: BT.text.secondary, fontFamily: MONO }}>
              {(captureRate * 100).toFixed(0)}%
            </span>
            <span style={{ fontSize: 7, color: BT.text.muted, fontFamily: MONO }}>per roll event</span>
          </div>

          {/* Full year-by-year table */}
          <div style={{ width: '100%', display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {byYear.map((v, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }}>
                <span style={{ fontSize: 7, color: BT.text.muted, fontFamily: MONO }}>YR{i + 1}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: v < 0.02 ? '#4ADE80' : v < 0.08 ? BT.text.amber : BT.text.red, fontFamily: MONO }}>
                  {(v * 100).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Integrity Banner ─────────────────────────────────────────────────────
function IntegrityBanner({ checks }: { checks: IntegrityCheckItem[] }) {
  const errors = checks.filter(c => c.status === 'error');
  const warns  = checks.filter(c => c.status === 'warn');
  if (errors.length === 0 && warns.length === 0) return null;
  const color   = errors.length > 0 ? BT.text.red : BT.text.amber;
  const bgColor = errors.length > 0 ? `${BT.text.red}12` : `${BT.text.amber}12`;
  const label   = errors.length > 0
    ? `${errors.length} INTEGRITY ERROR${errors.length > 1 ? 'S' : ''}`
    : `${warns.length} WARNING${warns.length > 1 ? 'S' : ''}`;
  const items = [...errors, ...warns].slice(0, 5);
  return (
    <div style={{ background: bgColor, border: `1px solid ${color}40`, borderLeft: `3px solid ${color}`, padding: '6px 10px', flexShrink: 0, fontFamily: MONO }}>
      <div style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: 0.8, marginBottom: 4 }}>
        ⚠ PRO FORMA {label} — review before relying on projections
      </div>
      {items.map(c => (
        <div key={c.id} style={{ fontSize: 8, color: BT.text.secondary, marginBottom: 1 }}>[{c.id}] {c.message}</div>
      ))}
    </div>
  );
}

// ─── AI Findings Panel ────────────────────────────────────────────────────
const STATUS_COLORS: Record<F9NarrativeBlock['status'], string> = {
  ok:   BT.text.green ?? '#00B050',
  warn: BT.text.amber ?? '#F5A623',
  info: BT.text.cyan  ?? '#00BCD4',
};

function FindingsPanel({ narrative, blocks, loading }: { narrative: string | null; blocks: F9NarrativeBlock[]; loading: boolean }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div style={{ borderTop: `1px solid ${BT.border.subtle}`, background: `${BT.text.purple}0A`, flexShrink: 0 }}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', cursor: 'pointer', borderBottom: expanded ? `1px solid ${BT.border.subtle}` : 'none' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: BT.text.purple, fontFamily: MONO, letterSpacing: 1 }}>AI MARKET FINDINGS</span>
        <Bd c={BT.text.purple}>M07</Bd>
        {loading && <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO }}>analyzing…</span>}
        <span style={{ marginLeft: 'auto', fontSize: 9, color: BT.text.muted, fontFamily: MONO }}>{expanded ? '▾' : '▸'}</span>
      </div>
      {expanded && (
        <div style={{ padding: '6px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {loading && blocks.length === 0 && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>…loading</span>}
          {blocks.map(b => (
            <div key={b.id} style={{ background: BT.bg.panel, border: `1px solid ${STATUS_COLORS[b.status]}33`, borderLeft: `2px solid ${STATUS_COLORS[b.status]}`, borderRadius: 2, padding: '4px 8px', minWidth: 140 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5, marginBottom: 2 }}>{b.label.toUpperCase()}</div>
              <div style={{ fontSize: 9, color: STATUS_COLORS[b.status], fontFamily: MONO }}>{b.summary}</div>
              {b.detail && <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO, marginTop: 2 }}>{b.detail}</div>}
            </div>
          ))}
          {!loading && blocks.length === 0 && narrative && (
            <p style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{narrative}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Drilldown Drawer ─────────────────────────────────────────────────────
function DrilldownDrawer({
  info,
  onClose,
  onTabChange,
  dealId,
  onSave,
}: {
  info: DrilldownInfo;
  onClose: () => void;
  onTabChange?: (i: number) => void;
  dealId?: string;
  onSave?: () => void;
}) {
  const backendField = OVERRIDE_FIELD_MAP[info.rowKey];
  const canOverride  = info.year > 1 && backendField != null && dealId != null;

  const [overrideInput, setOverrideInput] = React.useState('');
  const [saving,        setSaving]        = React.useState(false);
  const [saveError,     setSaveError]     = React.useState<string | null>(null);
  const [savedMsg,      setSavedMsg]      = React.useState<string | null>(null);

  const commit = async (val: number | null) => {
    if (!canOverride || !dealId || !backendField) return;
    setSaving(true); setSaveError(null); setSavedMsg(null);
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, {
        field: backendField, year: info.year, value: val,
      });
      setSavedMsg(val == null ? 'Cleared — formula restored' : 'Saved');
      onSave?.();
    } catch {
      setSaveError('Save failed — please retry');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    const raw = parseFloat(overrideInput.replace(/[$,]/g, ''));
    if (isNaN(raw)) { setSaveError('Enter a valid number (e.g. 245000)'); return; }
    commit(raw);
  };

  const handleClear = () => { setOverrideInput(''); commit(null); };

  return (
    <div style={{
      width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: BT.bg.panel, borderLeft: `2px solid ${BT.met.financial}`,
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{ padding: '8px 10px', borderBottom: `1px solid ${BT.border.medium}`, display: 'flex', alignItems: 'center', gap: 6, background: BT.bg.header }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.white, flex: 1 }}>
          FORMULA DRILLDOWN
        </span>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: BT.text.muted, cursor: 'pointer', fontFamily: MONO, fontSize: 11 }}>✕</button>
      </div>
      {/* Row label + value */}
      <div style={{ padding: '8px 10px', borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 2 }}>
          {info.rowLabel}{info.yearLabel != null ? ` · ${info.yearLabel}` : ` · YR ${info.year}`}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: BT.met.financial }}>{info.value}</div>
      </div>

      {/* ── Ramp timeline bar chart (RAMP user lines only) ───────────────── */}
      {info.rampChart && (
        <div style={{
          padding: '10px 10px 8px',
          borderBottom: `1px solid ${BT.border.medium}`,
          background: `${BT.bg.terminal}`,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.text.muted, letterSpacing: 0.8, marginBottom: 8 }}>
            RAMP TIMELINE · {info.rampChart.bars.length}Y HOLD
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 48 }}>
            {info.rampChart.bars.map(bar => {
              const barH = Math.max(2, Math.round(bar.fraction * 44));
              let barColor: string;
              let barBg: string;
              if (bar.phase === 'pre-ramp') {
                barColor = BT.text.muted;
                barBg = `${BT.text.muted}40`;
              } else if (bar.phase === 'steady-state') {
                barColor = BT.met.financial;
                barBg = BT.met.financial;
              } else {
                // ramping — interpolate amber → financial green
                const t = bar.fraction;
                barColor = `color-mix(in srgb, ${BT.met.financial} ${Math.round(t * 100)}%, #F59E0B)`;
                barBg = barColor;
              }
              return (
                <div
                  key={bar.year}
                  title={`YR ${bar.year}: ${fmt$(bar.annualVal)} · ${bar.phase}`}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                >
                  <div style={{
                    width: '100%',
                    height: barH,
                    background: barBg,
                    borderRadius: '2px 2px 0 0',
                    opacity: bar.phase === 'pre-ramp' ? 0.45 : 1,
                    transition: 'height 0.15s ease',
                  }} />
                  <span style={{ fontFamily: MONO, fontSize: 7, color: barColor, lineHeight: 1 }}>
                    {bar.year}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            {[
              { phase: 'pre-ramp', label: 'Pre-ramp', color: `${BT.text.muted}` },
              { phase: 'ramping', label: 'Ramping', color: '#F59E0B' },
              { phase: 'steady-state', label: 'Steady-state', color: BT.met.financial },
            ].map(leg => (
              <div key={leg.phase} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 8, height: 8, background: leg.color, borderRadius: 1, opacity: leg.phase === 'pre-ramp' ? 0.45 : 1 }} />
                <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>{leg.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Per-year override input (year 2+ editable lines only) ─────────── */}
      {canOverride && (
        <div style={{
          padding: '10px 10px 8px',
          borderBottom: `1px solid ${BT.border.medium}`,
          background: `${BT.met.financial}08`,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.met.financial, letterSpacing: 0.8, marginBottom: 6 }}>
            OVERRIDE YR {info.year} VALUE
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              value={overrideInput}
              onChange={e => { setOverrideInput(e.target.value); setSaveError(null); setSavedMsg(null); }}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
              placeholder="e.g. 245000"
              style={{
                flex: 1, background: BT.bg.terminal, border: `1px solid ${BT.border.medium}`,
                color: BT.text.primary, fontFamily: MONO, fontSize: 11, padding: '4px 8px',
                borderRadius: 2, outline: 'none',
              }}
            />
            <button
              onClick={handleSave}
              disabled={saving || overrideInput.trim() === ''}
              style={{
                background: saving ? BT.bg.header : BT.met.financial,
                color: saving ? BT.text.muted : '#000',
                border: 'none', fontFamily: MONO, fontSize: 9, fontWeight: 700,
                padding: '4px 10px', cursor: saving ? 'not-allowed' : 'pointer', borderRadius: 2,
              }}
            >{saving ? '…' : 'SET'}</button>
            <button
              onClick={handleClear}
              disabled={saving}
              title="Clear override — restore formula"
              style={{
                background: 'transparent', border: `1px solid ${BT.border.medium}`,
                color: BT.text.muted, fontFamily: MONO, fontSize: 9,
                padding: '4px 8px', cursor: saving ? 'not-allowed' : 'pointer', borderRadius: 2,
              }}
            >CLR</button>
          </div>
          {saveError && (
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.red, marginTop: 4 }}>{saveError}</div>
          )}
          {savedMsg && (
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green ?? '#00B050', marginTop: 4 }}>{savedMsg}</div>
          )}
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginTop: 4, lineHeight: 1.4 }}>
            Enter annual total ($). CLR restores formula growth. Change persists on refresh.
          </div>
        </div>
      )}

      {/* Formula path entries */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {info.entries.map((e, i) => (
          <div key={i} style={{ padding: '6px 10px', borderBottom: `1px solid ${BT.border.subtle}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, flex: 1 }}>{e.label}</span>
              {onTabChange && e.tabIndex >= 0 && (
                <button
                  onClick={() => onTabChange(e.tabIndex)}
                  style={{
                    background: 'transparent', border: `1px solid ${BT.met.financial}40`,
                    color: BT.met.financial, fontFamily: MONO, fontSize: 7, padding: '1px 5px',
                    cursor: 'pointer', borderRadius: 2,
                  }}
                >
                  {e.sourceTab} ↗
                </button>
              )}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: BT.text.white }}>{e.value}</div>
            {e.formula && (
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginTop: 2, fontStyle: 'italic' }}>
                {e.formula}
              </div>
            )}
          </div>
        ))}
        {info.entries.length === 0 && (
          <div style={{ padding: '20px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
            No formula path available for this cell.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Build drilldown info for a row+year ──────────────────────────────────
function buildDrilldown(
  row: RowDef,
  proj: ProjYear,
  f: DealFinancials | null,
): DrilldownInfo {
  const rawVal = proj[row.key] as number | null;
  const display = fmtCell(rawVal, row.fmt, row.sign);

  const entries: DrilldownEntry[] = [];

  switch (row.key) {
    case 'gpr': {
      const gprDecomp = f?.assumptions?.gprDecomposition;
      if (gprDecomp?.resolvedAnnual != null) {
        entries.push({ label: 'Y1 Resolved GPR (M07)', value: fmt$(gprDecomp.resolvedAnnual), sourceTab: 'PRO FORMA', tabIndex: 2, formula: 'Max(broker, platform, t12, rentRoll)' });
      }
      entries.push({ label: `Rent Growth Multiplier (YR ${proj.year})`, value: `×${(rawVal != null && gprDecomp?.resolvedAnnual ? rawVal / gprDecomp.resolvedAnnual : 1).toFixed(4)}`, sourceTab: 'ASSUMPTIONS', tabIndex: 1, formula: 'Compound(rentGrowthPct per year)' });
      break;
    }
    case 'reTaxes': {
      const src = proj.reTaxSource;
      const taxYr = f?.taxes?.reTax?.perYear?.find(t => t.year === proj.year);
      if (src === 'taxes_tab' && taxYr) {
        entries.push({ label: 'Taxes Tab · Per-Year RE Tax', value: fmt$(taxYr.taxAmount), sourceTab: 'TAXES', tabIndex: 1, formula: `assessedValue × millageRate (${(taxYr.millageRate * 100).toFixed(2)}%)` });
        entries.push({ label: 'Assessed Value', value: fmt$(taxYr.assessedValue), sourceTab: 'TAXES', tabIndex: 1 });
        entries.push({ label: 'SOH Cap Binding?', value: taxYr.sohCapBinding ? 'YES — growth capped' : 'NO', sourceTab: 'TAXES', tabIndex: 1 });
      } else if (src === 'proforma') {
        entries.push({ label: 'Pro Forma Y1 RE Tax', value: fmt$(rawVal ?? 0), sourceTab: 'PRO FORMA', tabIndex: 2, formula: 'Y1 RE Tax × opexGrowthMultiplier' });
      } else {
        entries.push({ label: 'Estimate (no tax data)', value: '—', sourceTab: 'TAXES', tabIndex: 1, formula: 'Seed deal data to compute' });
      }
      break;
    }
    case 'annualDS':
    case 'interest':
    case 'principal': {
      const src = proj.debtSource;
      if (src === 'debt_tab') {
        const aggDS = f?.debt?.aggregate?.totalAnnualDS;
        entries.push({ label: 'Debt Tab · Aggregate Annual DS', value: aggDS != null ? fmt$(aggDS) : '—', sourceTab: 'DEBT', tabIndex: 4, formula: 'Sum(allLoans.derivedAnnualDS)' });
        const sen = f?.debt?.loans?.find(l => l.id === 'senior');
        if (sen) {
          entries.push({ label: 'Senior Loan Amount', value: fmt$(sen.loanAmount?.platform ?? 0), sourceTab: 'DEBT', tabIndex: 4 });
          entries.push({ label: 'Interest Rate', value: `${((sen.interestRate?.platform ?? 0) * 100).toFixed(2)}%`, sourceTab: 'DEBT', tabIndex: 4 });
          entries.push({ label: 'IO Period', value: `${sen.ioMonths?.platform ?? 0} mo`, sourceTab: 'DEBT', tabIndex: 4 });
        }
      } else {
        entries.push({ label: 'Capital Stack · Loan Amount', value: fmt$(f?.capitalStack?.loanAmount ?? 0), sourceTab: 'DEBT', tabIndex: 4, formula: 'Standard amortizing schedule' });
        entries.push({ label: 'Interest Rate', value: `${((f?.capitalStack?.interestRate ?? 0) * 100).toFixed(2)}%`, sourceTab: 'DEBT', tabIndex: 4 });
      }
      break;
    }
    case 'cfads': {
      const capRow = f?.capital?.schedule?.find(r => r.year === proj.year);
      if (capRow) {
        entries.push({ label: 'Capital Schedule CFADS', value: fmt$(capRow.cfads), sourceTab: 'CAP & WFALL', tabIndex: 4, formula: 'NOI - DebtService - Distributions' });
        entries.push({ label: 'LP Distributions', value: fmt$(capRow.lpDist), sourceTab: 'CAP & WFALL', tabIndex: 4 });
        entries.push({ label: 'GP Distributions', value: fmt$(capRow.gpDist), sourceTab: 'CAP & WFALL', tabIndex: 4 });
      } else {
        entries.push({ label: 'Cash Flow Before Tax (fallback)', value: fmt$(proj.cfbt), sourceTab: 'CASH FLOW', tabIndex: -1, formula: 'NOI - Annual Debt Service' });
      }
      break;
    }
    case 'taxableIncome':
    case 'taxPayable':
    case 'afterTaxCfads':
    case 'depreciation': {
      const depr = f?.taxes?.incomeTax?.annualDepreciation;
      const base = f?.taxes?.incomeTax?.depreciableBase;
      entries.push({ label: 'Depreciable Base', value: base != null ? fmt$(base) : '—', sourceTab: 'TAXES', tabIndex: 1, formula: 'purchasePrice × (1 − landValuePct)' });
      entries.push({ label: 'Annual Depreciation (39yr)', value: depr != null ? fmt$(depr) : '—', sourceTab: 'TAXES', tabIndex: 1 });
      const mtr = f?.taxes?.incomeTax?.marginalTaxRate;
      entries.push({ label: 'Effective Tax Rate', value: mtr != null ? `${(mtr * 100).toFixed(2)}%` : '37.00%', sourceTab: 'TAXES', tabIndex: 1, formula: 'Sourced from taxes.incomeTax.marginalTaxRate' });
      break;
    }
    case 'noi': {
      entries.push({ label: 'EGI', value: fmt$(proj.egi), sourceTab: 'PROJECTIONS', tabIndex: 3, formula: 'NRI + OtherIncome' });
      entries.push({ label: 'Total OpEx', value: fmt$(proj.totalOpex), sourceTab: 'PROJECTIONS', tabIndex: 3, formula: 'Sum(all expense lines)' });
      entries.push({ label: 'NOI Formula', value: fmt$(proj.noi), sourceTab: 'PROJECTIONS', tabIndex: 3, formula: 'EGI − TotalOpEx' });
      break;
    }
    case 'grossSaleValue': {
      entries.push({ label: 'Exit NOI', value: fmt$(proj.exitNoi ?? 0), sourceTab: 'ASSUMPTIONS', tabIndex: 1, formula: `NOI × (1 + rentGrowth)` });
      entries.push({ label: 'Exit Cap Rate', value: fmtCell(proj.exitCap, 'pct'), sourceTab: 'ASSUMPTIONS', tabIndex: 1 });
      entries.push({ label: 'Gross Sale Value', value: fmt$(proj.grossSaleValue ?? 0), sourceTab: 'EXIT', tabIndex: -1, formula: 'ExitNOI ÷ ExitCap' });
      break;
    }
    default: {
      entries.push({ label: row.label, value: display, sourceTab: 'PROJECTIONS', tabIndex: 2 });
    }
  }

  return { rowLabel: row.label, rowKey: row.key, year: proj.year, value: display, entries };
}

// ─── Build drilldown info for a custom user-defined income line ────────────
// Opens when the analyst clicks a FLAT/RAMP sub-row label in the Projections
// tab.  Shows the line's full assumption detail (monthly rate, note, ramp
// schedule) and links back to the Assumptions tab where the line was defined.
function buildUserLineDrilldown(
  line: {
    id: string;
    label: string;
    monthly: number;
    note?: string;
    adoption?: {
      ramp_start_period: number;
      ramp_duration_months: number;
      steady_state_monthly: number;
      probability_adopted: number;
    } | null;
  },
  annualYears: number[],
): DrilldownInfo {
  const isRamping = line.adoption != null && line.adoption.ramp_duration_months > 0;
  const entries: DrilldownEntry[] = [];

  entries.push({
    label: 'Monthly Base Rate',
    value: `${fmt$(line.monthly)}/mo`,
    sourceTab: 'ASSUMPTIONS',
    tabIndex: 1,
  });

  if (!isRamping) {
    entries.push({
      label: 'Annual Total (flat)',
      value: fmt$(line.monthly * 12),
      sourceTab: 'ASSUMPTIONS',
      tabIndex: 1,
      formula: 'monthly × 12',
    });
  }

  if (line.note) {
    entries.push({
      label: 'Note',
      value: line.note,
      sourceTab: 'ASSUMPTIONS',
      tabIndex: 1,
    });
  }

  if (isRamping && line.adoption) {
    const a = line.adoption;
    entries.push({
      label: 'Ramp Start (month)',
      value: `Month ${a.ramp_start_period}`,
      sourceTab: 'ASSUMPTIONS',
      tabIndex: 1,
    });
    entries.push({
      label: 'Ramp Duration',
      value: `${a.ramp_duration_months} months`,
      sourceTab: 'ASSUMPTIONS',
      tabIndex: 1,
    });
    entries.push({
      label: 'Steady-State Monthly',
      value: `${fmt$(a.steady_state_monthly)}/mo`,
      sourceTab: 'ASSUMPTIONS',
      tabIndex: 1,
      formula: 'Full revenue once fully ramped',
    });
    entries.push({
      label: 'Probability Adopted',
      value: `${(a.probability_adopted * 100).toFixed(0)}%`,
      sourceTab: 'ASSUMPTIONS',
      tabIndex: 1,
      formula: 'Applied to steady-state value',
    });
    entries.push({
      label: 'Steady-State Annual (at full prob.)',
      value: fmt$(a.steady_state_monthly * 12 * a.probability_adopted),
      sourceTab: 'ASSUMPTIONS',
      tabIndex: 1,
      formula: 'steady_state_monthly × 12 × probability_adopted',
    });
  }

  // ── Year-by-year calculated outputs ──────────────────────────────────────
  annualYears.forEach(yr => {
    const yearIndex = yr - 1;
    let annualVal: number;
    let formula: string;

    if (isRamping && line.adoption) {
      annualVal = computeRampAwareAnnual(line.monthly, line.adoption, yearIndex);
      const midpoint = yearIndex * 12 + 6;
      const rampStart = line.adoption.ramp_start_period;
      const rampEnd   = rampStart + line.adoption.ramp_duration_months;
      const phase = midpoint < rampStart ? 'pre-ramp' : midpoint >= rampEnd ? 'steady-state' : 'ramping';
      const rampFrac = phase === 'ramping'
        ? Math.round(((midpoint - rampStart) / line.adoption.ramp_duration_months) * 100)
        : null;
      formula = phase === 'pre-ramp'
        ? `Pre-ramp (starts month ${rampStart})`
        : phase === 'steady-state'
          ? `Fully ramped · steady_state × 12 × ${(line.adoption.probability_adopted * 100).toFixed(0)}%`
          : `Ramping ${rampFrac}% of steady-state · × prob`;
    } else {
      annualVal = line.monthly * 12;
      formula = 'monthly × 12';
    }

    entries.push({
      label: `YR ${yr} Annual Total`,
      value: fmt$(annualVal),
      sourceTab: 'PROJECTIONS',
      tabIndex: 3,
      formula,
    });
  });

  // ── Build ramp chart bars for RAMP lines ─────────────────────────────────
  let rampChart: DrilldownInfo['rampChart'] | undefined;
  if (isRamping && line.adoption) {
    const a = line.adoption;
    const steadyStateAnnual = a.steady_state_monthly * 12 * a.probability_adopted;
    const bars: RampChartBar[] = annualYears.map(yr => {
      const yearIndex = yr - 1;
      const midpoint = yearIndex * 12 + 6;
      const rampEnd = a.ramp_start_period + a.ramp_duration_months;
      let phase: RampChartBar['phase'];
      if (midpoint < a.ramp_start_period) {
        phase = 'pre-ramp';
      } else if (midpoint >= rampEnd) {
        phase = 'steady-state';
      } else {
        phase = 'ramping';
      }
      const annualVal = computeRampAwareAnnual(line.monthly, a, yearIndex);
      const fraction = steadyStateAnnual > 0 ? annualVal / steadyStateAnnual : 0;
      return { year: yr, fraction, phase, annualVal };
    });
    rampChart = { bars, steadyStateAnnual };
  }

  return {
    rowLabel: line.label,
    rowKey: 'otherIncome' as keyof ProjYear,
    year: 0,
    yearLabel: isRamping ? 'RAMP LINE' : 'FLAT LINE',
    value: isRamping
      ? `${fmt$(line.adoption!.steady_state_monthly)}/mo steady`
      : `${fmt$(line.monthly)}/mo`,
    entries,
    rampChart,
  };
}

// ─── Year-specific drilldown for a single cell on a custom user-line sub-row ──
// Opened when an analyst clicks a year-value cell (not the row label).
// Shows: year index, ramp phase, ramp months elapsed at mid-year, % of
// steady-state applied, effective monthly rate, and the resulting annual total.
function buildUserLineYearDrilldown(
  line: {
    id: string;
    label: string;
    monthly: number;
    note?: string;
    adoption?: {
      ramp_start_period: number;
      ramp_duration_months: number;
      steady_state_monthly: number;
      probability_adopted: number;
    } | null;
  },
  yr: number, // 1-indexed year
): DrilldownInfo {
  const yearIndex = yr - 1;
  const isRamping = line.adoption != null && line.adoption.ramp_duration_months > 0;
  const entries: DrilldownEntry[] = [];

  const annualTotal = isRamping && line.adoption
    ? computeRampAwareAnnual(line.monthly, line.adoption, yearIndex)
    : line.monthly * 12;

  type Phase = 'pre-ramp' | 'ramping' | 'steady-state';
  let phase: Phase = 'steady-state';
  let effectiveMonthly: number;
  let rampMonthsElapsed: number | null = null;
  let steadyStatePct: number | null = null;

  if (isRamping && line.adoption) {
    const a = line.adoption;
    const midpoint = yearIndex * 12 + 6; // mid-year period month (1-indexed equivalent)
    const rampEnd = a.ramp_start_period + a.ramp_duration_months;
    if (midpoint < a.ramp_start_period) {
      phase = 'pre-ramp';
      effectiveMonthly = 0;
    } else if (midpoint >= rampEnd) {
      phase = 'steady-state';
      effectiveMonthly = a.steady_state_monthly * a.probability_adopted;
    } else {
      phase = 'ramping';
      rampMonthsElapsed = midpoint - a.ramp_start_period;
      steadyStatePct = Math.round((rampMonthsElapsed / a.ramp_duration_months) * 100);
      effectiveMonthly = a.steady_state_monthly * (rampMonthsElapsed / a.ramp_duration_months) * a.probability_adopted;
    }
  } else {
    phase = 'steady-state';
    effectiveMonthly = line.monthly;
  }

  const phaseLabel: Record<Phase, string> = {
    'pre-ramp': 'PRE-RAMP',
    'ramping': 'RAMPING',
    'steady-state': 'STEADY-STATE',
  };

  entries.push({
    label: 'Year Index',
    value: `YR ${yr} of hold`,
    sourceTab: 'PROJECTIONS',
    tabIndex: 3,
  });

  entries.push({
    label: 'Ramp Phase',
    value: phaseLabel[phase],
    sourceTab: 'ASSUMPTIONS',
    tabIndex: 1,
    formula: phase === 'pre-ramp'
      ? `Revenue not yet active — ramp starts month ${line.adoption?.ramp_start_period}`
      : phase === 'steady-state'
        ? isRamping
          ? `Fully ramped — 100% of steady-state × ${(line.adoption!.probability_adopted * 100).toFixed(0)}% prob`
          : 'Flat line — full rate every year'
        : `${rampMonthsElapsed} of ${line.adoption?.ramp_duration_months} ramp months elapsed at mid-year`,
  });

  if (phase === 'ramping' && rampMonthsElapsed != null && steadyStatePct != null && line.adoption) {
    entries.push({
      label: 'Ramp Months Elapsed (mid-yr)',
      value: `${rampMonthsElapsed} mo of ${line.adoption.ramp_duration_months}`,
      sourceTab: 'ASSUMPTIONS',
      tabIndex: 1,
      formula: 'Sampled at month 6 of the year (mid-year)',
    });
    entries.push({
      label: '% of Steady-State Applied',
      value: `${steadyStatePct}%`,
      sourceTab: 'ASSUMPTIONS',
      tabIndex: 1,
      formula: 'ramp_months_elapsed ÷ ramp_duration_months',
    });
  }

  entries.push({
    label: 'Effective Monthly (mid-yr)',
    value: `${fmt$(effectiveMonthly)}/mo`,
    sourceTab: 'PROJECTIONS',
    tabIndex: 3,
    formula: phase === 'pre-ramp'
      ? '$0 — not yet active'
      : phase === 'steady-state'
        ? isRamping
          ? `${fmt$(line.adoption!.steady_state_monthly)}/mo × ${(line.adoption!.probability_adopted * 100).toFixed(0)}% prob`
          : `${fmt$(line.monthly)}/mo (flat)`
        : `${fmt$(line.adoption!.steady_state_monthly)}/mo × ${steadyStatePct}% ramp × ${(line.adoption!.probability_adopted * 100).toFixed(0)}% prob`,
  });

  entries.push({
    label: 'Annual Total',
    value: fmt$(annualTotal),
    sourceTab: 'PROJECTIONS',
    tabIndex: 3,
    formula: isRamping
      ? 'steady_state × ramp_fraction × prob × 12 (mid-year sampling)'
      : `${fmt$(line.monthly)}/mo × 12`,
  });

  if (line.note) {
    entries.push({
      label: 'Note',
      value: line.note,
      sourceTab: 'ASSUMPTIONS',
      tabIndex: 1,
    });
  }

  return {
    rowLabel: line.label,
    rowKey: 'otherIncome' as keyof ProjYear,
    year: yr,
    yearLabel: `YR ${yr} · ${phaseLabel[phase]}`,
    value: fmt$(annualTotal),
    entries,
  };
}

// ─── Sub-period columns for monthly/quarterly views ───────────────────────
interface SubColHeader {
  label: string;
  periodKey: string; // 'Q1Y1', 'M01Y1', etc.
  projYear: number;
  fraction: number; // 0.25 for quarterly, 1/12 for monthly
}

function buildSubCols(holdYears: number, mode: 'quarterly' | 'monthly'): SubColHeader[] {
  const cols: SubColHeader[] = [];
  const count = mode === 'quarterly' ? 4 : 12;
  const frac  = mode === 'quarterly' ? 0.25 : 1 / 12;
  const prefix = mode === 'quarterly' ? 'Q' : 'M';
  for (let yr = 1; yr <= holdYears; yr++) {
    for (let p = 1; p <= count; p++) {
      cols.push({
        label:     `${prefix}${p}Y${yr}`,
        periodKey: `${prefix}${p.toString().padStart(2, '0')}Y${yr}`,
        projYear:  yr,
        fraction:  frac,
      });
    }
  }
  return cols;
}

function yyyymmFromClose(closeDate: string | null | undefined, offsetMonths: number): string | null {
  if (!closeDate) return null;
  const d = new Date(closeDate + 'T00:00:00');
  d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Subject History Inline Assumption Block ──────────────────────────────
// Renders when f9Financials.subjectHistory is present (≥S1 tier).
// Shows a four-column comparison: Peer Set | Subject | Effective | Confidence.

const SUBJ_TEAL  = '#2DD4BF';
const SUBJ_TEAL2 = '#14B8A6';

interface SubjRow {
  label: string;
  key: string;
  peer: number | null;
  subject: number | null;
  effective: number | null;
  weight: number | null;
  fmt: 'pct' | 'dollar' | 'num';
}

function fmtSubj(val: number | null, fmt: SubjRow['fmt']): string {
  if (val == null || isNaN(val)) return '—';
  switch (fmt) {
    case 'pct':    return `${(val * 100).toFixed(1)}%`;
    case 'dollar': return fmt$(val);
    case 'num':    return val.toFixed(1);
  }
}

function SubjectHistoryPanel({ history }: { history: F9SubjectHistory }) {
  const [expanded, setExpanded] = useState(false);
  const [drillKey, setDrillKey] = useState<string | null>(null);

  const cs  = history.current_state;
  const dyn = history.observed_dynamics;
  const cw  = history.confidence_weights;
  const collisions = history.peer_collisions ?? [];

  // Build collision lookup — peer_value from collision data is the platform posterior.
  // This is the only source of peer-set values available to the frontend.
  const collisionByKey = new Map(collisions.map(c => [c.coefficient, c]));

  // Helper: compute blended effective value from subject + peer + weight.
  // Peer resolution order:
  //   1. peer_set_values[key]  — platform posterior for this coefficient (always available
  //      after M07 wiring when traffic_calibration_factors is populated)
  //   2. collision.peer_value  — set only for coefficients that exceeded σ threshold
  // When peer is resolved, effective = w * subject + (1-w) * peer.
  // When peer is unknown, effective falls back to subject.
  const peerSetValues = history.peer_set_values ?? {};

  const blendedEffective = (subject: number, key: string): { peer: number | null; effective: number } => {
    const col  = collisionByKey.get(key);
    const w    = cw[key]?.weight ?? null;
    // Prefer platform peer-set posterior; fall back to collision.peer_value if absent
    const peer: number | null = peerSetValues[key] ?? col?.peer_value ?? null;
    if (peer != null && w != null) {
      if (w === 0) {
        // Insufficient subject evidence — effective is peer-only (matches resolver w=0 path)
        return { peer, effective: peer };
      }
      if (w < 1) {
        return { peer, effective: w * subject + (1 - w) * peer };
      }
    }
    // w===1 (full confidence) or no peer available — effective equals subject
    return { peer, effective: subject };
  };

  // Direction indicator: ▲ subject > peer, ▼ subject < peer, = within ±0.5σ
  // σ ≈ 15% of the peer value (conservative prior consistent with resolver).
  // ±0.5σ threshold means "not meaningfully different from platform posterior".
  const direction = (subject: number | null, peer: number | null): string => {
    if (subject == null || peer == null || peer === 0) return '';
    const peerSigma = Math.abs(peer) * 0.15;
    const halfSigma = peerSigma * 0.5;
    const diff = subject - peer;
    if (Math.abs(diff) < halfSigma) return '=';
    return diff > 0 ? '▲' : '▼';
  };
  const dirColor = (dir: string): string =>
    dir === '▲' ? SUBJ_TEAL : dir === '▼' ? '#f87171' : BT.text.muted;

  // Build rows from available data — populate peer + effective from collision map
  const rows: SubjRow[] = [];

  if (cs) {
    rows.push({
      label: 'Occupancy Rate', key: 'occupancy_rate',
      peer: null, subject: cs.occupancy_rate,
      effective: cs.occupancy_rate,
      weight: 1, fmt: 'pct',
    });
    if (cs.loss_to_lease != null) {
      const w = cw['loss_to_lease']?.weight ?? null;
      const be = blendedEffective(cs.loss_to_lease, 'loss_to_lease');
      rows.push({
        label: 'Loss-to-Lease', key: 'loss_to_lease',
        peer: be.peer, subject: cs.loss_to_lease,
        effective: be.effective,
        weight: w, fmt: 'pct',
      });
    }
    if (cs.avg_contract_rent != null) {
      rows.push({
        label: 'Avg Contract Rent', key: 'avg_contract_rent',
        peer: null, subject: cs.avg_contract_rent,
        effective: cs.avg_contract_rent,
        weight: 1, fmt: 'dollar',
      });
    }
    if (cs.avg_market_rent != null) {
      rows.push({
        label: 'Avg Market Rent', key: 'avg_market_rent',
        peer: null, subject: cs.avg_market_rent,
        effective: cs.avg_market_rent,
        weight: 1, fmt: 'dollar',
      });
    }
    if (cs.signing_velocity != null) {
      const w = cw['signing_velocity']?.weight ?? null;
      const be = blendedEffective(cs.signing_velocity, 'signing_velocity');
      rows.push({
        label: 'Signing Velocity (mo)', key: 'signing_velocity',
        peer: be.peer, subject: cs.signing_velocity,
        effective: be.effective,
        weight: w, fmt: 'num',
      });
    }
  }

  if (dyn) {
    if (dyn.renewal_rate != null) {
      const w = cw['renewal_rate']?.weight ?? null;
      const be = blendedEffective(dyn.renewal_rate, 'renewal_rate');
      rows.push({
        label: 'Renewal Rate', key: 'renewal_rate',
        peer: be.peer, subject: dyn.renewal_rate,
        effective: be.effective,
        weight: w, fmt: 'pct',
      });
    }
    if (dyn.turnover_rate != null) {
      const w = cw['turnover_rate']?.weight ?? null;
      const be = blendedEffective(dyn.turnover_rate, 'turnover_rate');
      rows.push({
        label: 'Turnover Rate', key: 'turnover_rate',
        peer: be.peer, subject: dyn.turnover_rate,
        effective: be.effective,
        weight: w, fmt: 'pct',
      });
    }
    if (dyn.new_lease_trade_out_pct != null) {
      const w = cw['new_lease_trade_out_pct']?.weight ?? null;
      const be = blendedEffective(dyn.new_lease_trade_out_pct, 'new_lease_trade_out_pct');
      rows.push({
        label: 'New Lease Trade-Out', key: 'new_lease_trade_out_pct',
        peer: be.peer, subject: dyn.new_lease_trade_out_pct,
        effective: be.effective,
        weight: w, fmt: 'pct',
      });
    }
    if (dyn.renewal_trade_out_pct != null) {
      const w = cw['renewal_trade_out_pct']?.weight ?? null;
      const be = blendedEffective(dyn.renewal_trade_out_pct, 'renewal_trade_out_pct');
      rows.push({
        label: 'Renewal Trade-Out', key: 'renewal_trade_out_pct',
        peer: be.peer, subject: dyn.renewal_trade_out_pct,
        effective: be.effective,
        weight: w, fmt: 'pct',
      });
    }
    if (dyn.days_vacant_median != null) {
      const w = cw['days_vacant_median']?.weight ?? null;
      const be = blendedEffective(dyn.days_vacant_median, 'days_vacant_median');
      rows.push({
        label: 'Days Vacant (median)', key: 'days_vacant_median',
        peer: be.peer, subject: dyn.days_vacant_median,
        effective: be.effective,
        weight: w, fmt: 'num',
      });
    }
  }

  const tierColor = history.tier === 'S2' ? SUBJ_TEAL2 : SUBJ_TEAL;

  return (
    <div style={{
      flexShrink: 0,
      borderBottom: `1px solid ${SUBJ_TEAL}30`,
      background: `${SUBJ_TEAL}08`,
    }}>
      {/* Header row */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 10px', cursor: 'pointer',
          borderBottom: expanded ? `1px solid ${SUBJ_TEAL}20` : 'none',
        }}
      >
        <span style={{
          fontFamily: MONO, fontSize: 8, fontWeight: 700,
          color: tierColor, letterSpacing: 1,
          background: `${tierColor}18`, border: `1px solid ${tierColor}40`,
          padding: '1px 5px', borderRadius: 2,
        }}>
          SUBJ·{history.tier}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: SUBJ_TEAL, fontWeight: 600 }}>
          SUBJECT HISTORY
        </span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
          {history.snapshot_count} snapshot{history.snapshot_count !== 1 ? 's' : ''}
          {history.coverage_months != null ? ` · ${history.coverage_months.toFixed(1)} mo coverage` : ''}
        </span>
        {cs && (
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>
            {cs.unit_count}u · {(cs.occupancy_rate * 100).toFixed(1)}% occ
          </span>
        )}
        {collisions.length > 0 && (
          <span style={{
            fontFamily: MONO, fontSize: 8, color: BT.text.amber,
            background: `${BT.text.amber}15`, border: `1px solid ${BT.text.amber}40`,
            padding: '1px 5px', borderRadius: 2, marginLeft: 4,
          }}>
            {collisions.length} PEER COLLISION{collisions.length > 1 ? 'S' : ''}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {dyn && (
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
            {dyn.diff_period_count} diff period{dyn.diff_period_count !== 1 ? 's' : ''}
          </span>
        )}
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded: comparison table */}
      {expanded && (
        <div style={{ padding: '0 0 6px 0' }}>
          {rows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 8 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <th style={{ padding: '3px 10px', textAlign: 'left',  color: BT.text.muted, fontWeight: 500, minWidth: 200 }}>COEFFICIENT</th>
                  <th style={{ padding: '3px 10px', textAlign: 'right', color: BT.text.muted, fontWeight: 500 }}>PEER SET</th>
                  <th style={{ padding: '3px 10px', textAlign: 'right', color: SUBJ_TEAL,     fontWeight: 600 }}>SUBJECT</th>
                  <th style={{ padding: '3px 10px', textAlign: 'right', color: BT.text.secondary, fontWeight: 500 }}>EFFECTIVE</th>
                  <th style={{ padding: '3px 10px', textAlign: 'right', color: BT.text.muted, fontWeight: 500, minWidth: 80 }}>CONF</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const collision = collisionByKey.get(row.key);
                  const dir = direction(row.subject, row.peer);
                  const isBlended = row.peer != null && row.weight != null && row.weight < 1 && row.weight > 0;
                  const isDrilled = drillKey === row.key;
                  const weightEntry = cw[row.key];
                  return (
                    <React.Fragment key={row.key}>
                      <tr
                        onClick={() => setDrillKey(isDrilled ? null : row.key)}
                        style={{
                          borderBottom: isDrilled ? 'none' : `1px solid ${BT.border.subtle}20`,
                          cursor: 'pointer',
                          background: isDrilled ? `${SUBJ_TEAL}08` : 'transparent',
                        }}
                      >
                        <td style={{ padding: '3px 10px', color: collision ? BT.text.amber : BT.text.secondary }}>
                          {row.label}
                          {collision && (
                            <span style={{ marginLeft: 6, color: BT.text.amber, fontSize: 7 }}>
                              {collision.sigma_deviation.toFixed(1)}σ
                            </span>
                          )}
                          <span style={{ marginLeft: 5, color: BT.text.muted, fontSize: 7 }}>{isDrilled ? '▴' : '▾'}</span>
                        </td>
                        <td style={{ padding: '3px 10px', textAlign: 'right', color: BT.text.muted }}>
                          {fmtSubj(row.peer, row.fmt)}
                        </td>
                        <td style={{ padding: '3px 10px', textAlign: 'right', color: SUBJ_TEAL, fontWeight: 600 }}>
                          {dir && (
                            <span style={{ marginRight: 4, color: dirColor(dir), fontSize: 7 }}>{dir}</span>
                          )}
                          {fmtSubj(row.subject, row.fmt)}
                        </td>
                        <td style={{ padding: '3px 10px', textAlign: 'right', color: isBlended ? BT.text.secondary : BT.text.muted, fontStyle: isBlended ? 'normal' : 'italic' }}>
                          {fmtSubj(row.effective, row.fmt)}
                          {isBlended && (
                            <span style={{ marginLeft: 4, fontSize: 7, color: BT.text.muted }}>blended</span>
                          )}
                        </td>
                        <td style={{ padding: '3px 10px', textAlign: 'right' }}>
                          {row.weight != null ? (
                            <span style={{
                              color: row.weight >= 0.8 ? SUBJ_TEAL : row.weight >= 0.5 ? BT.text.amber : BT.text.muted,
                              fontWeight: row.weight >= 0.8 ? 600 : 400,
                            }}>
                              {(row.weight * 100).toFixed(0)}%
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                      {isDrilled && (
                        <tr style={{ borderBottom: `1px solid ${BT.border.subtle}20` }}>
                          <td colSpan={5} style={{ padding: '4px 14px 8px', background: `${SUBJ_TEAL}06` }}>
                            {/* Blend formula detail */}
                            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, lineHeight: 1.6 }}>
                              {isBlended && row.subject != null && row.peer != null && row.weight != null ? (
                                <>
                                  <span style={{ color: BT.text.secondary }}>BLEND FORMULA</span>
                                  {'  '}
                                  <span style={{ color: SUBJ_TEAL }}>w={( row.weight * 100).toFixed(0)}%</span>
                                  {' × '}
                                  <span style={{ color: SUBJ_TEAL }}>subj={fmtSubj(row.subject, row.fmt)}</span>
                                  {' + (1−w) × '}
                                  <span style={{ color: BT.text.muted }}>peer={fmtSubj(row.peer, row.fmt)}</span>
                                  {' = '}
                                  <span style={{ color: BT.text.secondary, fontWeight: 600 }}>{fmtSubj(row.effective, row.fmt)}</span>
                                  {weightEntry && (
                                    <>
                                      {'  ·  '}
                                      <span style={{ color: BT.text.muted }}>n={weightEntry.n_obs}/{weightEntry.n_required} obs</span>
                                    </>
                                  )}
                                </>
                              ) : row.subject != null ? (
                                <>
                                  <span style={{ color: BT.text.secondary }}>SUBJECT</span>
                                  {' = '}
                                  <span style={{ color: SUBJ_TEAL }}>{fmtSubj(row.subject, row.fmt)}</span>
                                  {row.peer == null && '  ·  no peer SET value available (platform not calibrated)'}
                                  {row.weight === 1 && '  ·  w=100% (full confidence)'}
                                  {row.weight === 0 && '  ·  w=0% (insufficient sample — subject bypassed)'}
                                  {weightEntry && (
                                    <>
                                      {'  ·  '}
                                      <span>n={weightEntry.n_obs}/{weightEntry.n_required} obs</span>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span>No subject observation available — using {row.peer != null ? 'platform peer SET' : 'baseline'}.</span>
                              )}
                              {collision && (
                                <span style={{ marginLeft: 8, color: BT.text.amber }}>
                                  ⚠ PEER COLLISION: {collision.sigma_deviation.toFixed(1)}σ from platform posterior
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Peer collision detail */}
          {collisions.length > 0 && (
            <div style={{ padding: '6px 10px 2px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {collisions.map(c => (
                <span key={c.coefficient} style={{
                  fontFamily: MONO, fontSize: 7,
                  color: BT.text.amber,
                  background: `${BT.text.amber}10`,
                  border: `1px solid ${BT.text.amber}30`,
                  padding: '2px 6px', borderRadius: 2,
                }}>
                  {c.coefficient.toUpperCase()}: subject {fmtSubj(c.subject_value, 'pct')} vs peer {fmtSubj(c.peer_value, 'pct')} ({c.sigma_deviation.toFixed(1)}σ)
                </span>
              ))}
            </div>
          )}

          {/* S2 concession trend */}
          {dyn?.concession_trend && (
            <div style={{ padding: '4px 10px', fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
              CONCESSION TREND:&nbsp;
              <span style={{ color: dyn.concession_trend === 'increasing' ? BT.text.red : dyn.concession_trend === 'decreasing' ? SUBJ_TEAL : BT.text.secondary, fontWeight: 600 }}>
                {dyn.concession_trend.toUpperCase()}
              </span>
            </div>
          )}

          <div style={{ padding: '2px 10px', fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
            Updated {new Date(history.updated_at).toLocaleDateString()} · M07 §6 subject-first calibration
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Traffic Funnel Panel ─────────────────────────────────────────────────

type FunnelCadence = 'W' | 'M' | 'Y';

const FUNNEL_ROWS: { key: keyof F9TrafficYear; label: string; unit: string }[] = [
  { key: 'walkInsPerWeek', label: 'Walk-Ins',    unit: 'visits' },
  { key: 'toursPerWeek',   label: 'Tours',       unit: 'tours'  },
  { key: 'appsPerWeek',    label: 'Applications',unit: 'apps'   },
  { key: 'leasesPerWeek',  label: 'Leases',      unit: 'leases' },
];

const CADENCE_MULTIPLIER: Record<FunnelCadence, number> = { W: 1, M: 4.33, Y: 52 };
const CADENCE_SUFFIX:     Record<FunnelCadence, string> = { W: '/wk', M: '/mo', Y: '/yr' };

function fmtFunnel(v: number | null, cadence: FunnelCadence): string {
  if (v == null) return '—';
  const scaled = v * CADENCE_MULTIPLIER[cadence];
  return scaled >= 10
    ? Math.round(scaled).toLocaleString() + CADENCE_SUFFIX[cadence]
    : scaled.toFixed(1) + CADENCE_SUFFIX[cadence];
}

function relativeCalibrationDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 1)  return 'today';
  if (days === 1) return '1d ago';
  if (days < 30)  return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}yr ago`;
}

interface TrafficFunnelPanelProps {
  yearly: F9TrafficYear[];
  holdYears: number;
  isOffline?: boolean;
  expanded: boolean;
  onToggle: () => void;
  leasingSignals?: { confidence: number|null; t01WeeklyTours: number|null; t05ClosingRatio: number|null; t06WeeklyLeases: number|null; t07LeaseUpWeeksTo95: number|null; stabilizedOccupancyPct: number|null } | null;
  calibrated?: { vacancyPct: number|null; rentGrowthPct: number|null; exitCap: number|null; lastCalibrated: string|null } | null;
}

function TrafficFunnelPanel({ yearly, holdYears, isOffline, expanded, onToggle, leasingSignals, calibrated }: TrafficFunnelPanelProps) {
  const [cadence, setCadence] = useState<FunnelCadence>('W');

  const years = Array.from({ length: holdYears }, (_, i) => i + 1);
  const hasAnyData = !isOffline && yearly.some(y => y.walkInsPerWeek != null);

  return (
    <div style={{ borderBottom: `1px solid ${BT.border.medium}` }}>
      {/* Header bar */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 8px', cursor: 'pointer',
          background: BT.bg.header,
          borderTop: `1px solid ${BT.border.medium}`,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: BT.met.physTraffic, letterSpacing: 0.8 }}>
          {expanded ? '▾' : '▸'} TRAFFIC FUNNEL — M07 PROJECTIONS
        </span>
        {/* W/M/Y toggle — kept left so it doesn't obscure year columns */}
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 2 }}>
          {(['W', 'M', 'Y'] as FunnelCadence[]).map(c => (
            <button
              key={c}
              onClick={() => setCadence(c)}
              style={{
                fontFamily: MONO, fontSize: 7, padding: '1px 5px',
                background: cadence === c ? BT.met.physTraffic : 'transparent',
                color: cadence === c ? BT.bg.terminal : BT.text.muted,
                border: `1px solid ${cadence === c ? BT.met.physTraffic : BT.border.medium}`,
                borderRadius: 2, cursor: 'pointer',
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
          walk-ins → tours → apps → leases
        </span>
      </div>

      {expanded && (
        <>
        {/* ── Confidence header strip ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '3px 8px',
          background: BT.bg.panel,
          borderBottom: `1px solid ${BT.border.subtle}`,
        }}>
          {leasingSignals?.confidence != null ? (
            <>
              <span style={{ fontFamily: MONO, fontSize: 7, color: BT.met.physTraffic, fontWeight: 700, letterSpacing: 0.5 }}>
                M07 CALIBRATION
              </span>
              <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.primary }}>
                {(leasingSignals.confidence * 100).toFixed(0)}% confidence
              </span>
              {calibrated?.lastCalibrated && (
                <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
                  · calibrated {relativeCalibrationDate(calibrated.lastCalibrated)}
                </span>
              )}
            </>
          ) : (
            <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, fontStyle: 'italic' }}>
              M07: Not yet calibrated
            </span>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 140 }} />
              {years.map(yr => <col key={yr} style={{ width: 80 }} />)}
            </colgroup>
            <thead>
              <tr style={{ background: BT.bg.panel }}>
                <th style={{ padding: '3px 8px', textAlign: 'left', fontFamily: MONO, fontSize: 7, color: BT.text.muted, fontWeight: 500 }}>
                  METRIC
                </th>
                {years.map(yr => (
                  <th key={yr} style={{ padding: '3px 6px', textAlign: 'right', fontFamily: MONO, fontSize: 7, color: BT.text.muted, fontWeight: 500 }}>
                    YR {yr}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!hasAnyData ? (
                <tr>
                  <td colSpan={years.length + 1} style={{ padding: '10px 8px', textAlign: 'center', fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                    {isOffline
                      ? '⚠ M07 Traffic Engine not yet run for this deal — trigger a traffic prediction to see walk-ins, tours, apps & leases over time'
                      : 'Traffic funnel counts unavailable — weekly walk-in baseline not yet computed'}
                  </td>
                </tr>
              ) : (
                FUNNEL_ROWS.map((row, ri) => {
                  const isLast = ri === FUNNEL_ROWS.length - 1;
                  const rowBg  = ri % 2 === 0 ? BT.bg.panel : BT.bg.terminal;
                  return (
                    <tr key={row.key} style={{ background: rowBg, borderBottom: isLast ? `1px solid ${BT.border.medium}` : `1px solid ${BT.border.subtle}` }}>
                      <td style={{ padding: '3px 8px', fontFamily: MONO, fontSize: 8, color: isLast ? BT.met.physTraffic : BT.text.secondary, fontWeight: isLast ? 600 : 400, position: 'sticky', left: 0, background: rowBg, zIndex: 1 }}>
                        {row.label}
                        {ri < FUNNEL_ROWS.length - 1 && (
                          <span style={{ color: BT.text.muted, marginLeft: 4 }}>↓</span>
                        )}
                      </td>
                      {years.map(yr => {
                        const tv = yearly.find(y => y.year === yr);
                        const raw = tv ? (tv[row.key] as number | null) : null;
                        return (
                          <td key={yr} style={{ padding: '3px 6px', textAlign: 'right', fontFamily: MONO, fontSize: 8, color: raw != null ? (isLast ? BT.met.physTraffic : BT.text.primary) : BT.text.muted }}>
                            {fmtFunnel(raw, cadence)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
              {/* ── Projection output rows: vacancy, rent, rent growth ── */}
              {hasAnyData && (() => {
                const PROJ_ROWS: { key: keyof F9TrafficYear; label: string; fmt: (v: number) => string }[] = [
                  { key: 'vacancyPct',   label: 'Vacancy %',    fmt: v => (v * 100).toFixed(1) + '%' },
                  { key: 'effRent',      label: 'Eff. Rent',    fmt: v => '$' + Math.round(v).toLocaleString() },
                  { key: 'rentGrowthPct',label: 'Rent Growth',  fmt: v => (v * 100).toFixed(1) + '% /yr' },
                ];
                return (
                  <>
                    <tr>
                      <td colSpan={years.length + 1} style={{ padding: 0, borderTop: `1px solid ${BT.border.medium}` }} />
                    </tr>
                    {PROJ_ROWS.map((row, ri) => {
                      const rowBg = ri % 2 === 0 ? BT.bg.panel : BT.bg.terminal;
                      return (
                        <tr key={row.key} style={{ background: rowBg, borderBottom: `1px solid ${BT.border.subtle}` }}>
                          <td style={{ padding: '3px 8px', fontFamily: MONO, fontSize: 8, color: BT.text.secondary, position: 'sticky', left: 0, background: rowBg, zIndex: 1 }}>
                            {row.label}
                            <span style={{ marginLeft: 4, fontFamily: MONO, fontSize: 6, color: BT.text.muted, letterSpacing: 0.3 }}>M07</span>
                          </td>
                          {years.map(yr => {
                            const tv = yearly.find(y => y.year === yr);
                            const val = tv ? (tv[row.key] as number | null) : null;
                            return (
                              <td key={yr} style={{ padding: '3px 6px', textAlign: 'right', fontFamily: MONO, fontSize: 8, color: val != null ? BT.text.primary : BT.text.muted }}>
                                {val != null ? row.fmt(val) : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </>
                );
              })()}
              {/* Conversion efficiency footnote row */}
              {hasAnyData && (() => {
                const yr1 = yearly.find(y => y.year === 1);
                const convPct = yr1?.walkInsPerWeek != null && yr1.walkInsPerWeek > 0 && yr1.leasesPerWeek != null
                  ? (yr1.leasesPerWeek / yr1.walkInsPerWeek * 100).toFixed(1)
                  : null;
                return (
                  <tr style={{ background: BT.bg.header }}>
                    <td colSpan={years.length + 1} style={{ padding: '3px 8px', fontFamily: MONO, fontSize: 7, color: BT.text.muted, fontStyle: 'italic' }}>
                      Overall conversion (walk-in → lease): {convPct != null ? `${convPct}%` : '—'} · 3% annual walk-in decay applied · Powered by M07 Engine
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
        {/* ── Calibration Confidence Bands placeholder ── */}
        <div style={{
          borderTop: `1px solid ${BT.border.subtle}`,
          padding: '6px 8px',
          background: BT.bg.header,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.met.physTraffic, fontWeight: 700, letterSpacing: 0.8, marginBottom: 3 }}>
            CALIBRATION CONFIDENCE BANDS
          </div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, fontStyle: 'italic' }}>
            Pending M07 backend wiring — asymmetric percentile bands (P10/P25/P75/P90) not yet surfaced on response.
            See <span style={{ color: BT.text.secondary }}>TODO_F9_DATA_FLOW.md</span> for backend scope.
          </div>
        </div>
        </>
      )}
    </div>
  );
}

// ─── InlineAssumptionBlock helpers ────────────────────────────────────────

function confidenceFromWeight(w: number | null): 'HIGH' | 'MED' | 'LOW' {
  if (w == null) return 'LOW';
  if (w >= 0.8) return 'HIGH';
  if (w >= 0.5) return 'MED';
  return 'LOW';
}

function sourceTag(subject: number | null, w: number | null): string {
  if (subject == null) return 'PEER';
  if (w == null || w >= 1) return 'SUBJECT';
  return 'SUBJECT+PEER';
}

function blendedEffective(
  subject: number | null,
  key: string,
  psv: Record<string, number>,
  cw: Record<string, { n_obs: number; n_required: number; weight: number }>,
): number | null {
  const peer = psv[key] ?? null;
  const w = cw[key]?.weight ?? null;
  if (subject == null) return peer;
  if (peer != null && w != null && w < 1 && w > 0) {
    return w * subject + (1 - w) * peer;
  }
  return subject;
}

function buildLeasingAssumptionFields(financials: DealFinancials): AssumptionFieldDef[] {
  const sh         = financials.subjectHistory ?? null;
  // When no subject history, all subjectValues are null and subject-aware logic is suppressed.
  const hasHistory = sh != null;
  const dyn = sh?.observed_dynamics ?? null;
  const cw  = sh?.confidence_weights ?? {};
  const psv = sh?.peer_set_values ?? {};

  // proforma.year1 rows — canonical resolver outputs that feed the projection engine.
  // Primary source for effectiveValue; platform column used as peer fallback when no history.
  const pf1 = financials.proforma?.year1 ?? [];
  const pfRow = (key: string) => pf1.find(r => r.field === key) ?? null;

  // Confidence from proforma scalar › weight bucket; LOW when no history
  const conf = (key: string, w: number | null): 'HIGH' | 'MED' | 'LOW' =>
    hasHistory ? confidenceFromWeight(pfRow(key)?.confidence ?? w) : 'LOW';

  const fields: AssumptionFieldDef[] = [];

  // 1. Renewal Rate
  {
    const pf      = pfRow('renewal_rate');
    // subjectValue: observed only when subject history is present
    const subject = hasHistory ? (dyn?.renewal_rate ?? null) : null;
    const peer    = psv['renewal_rate'] ?? pf?.platform ?? null;
    const w       = hasHistory ? (cw['renewal_rate']?.weight ?? null) : null;
    const effective = pf?.resolved ?? blendedEffective(subject, 'renewal_rate', psv, cw);
    fields.push({
      fieldId: 'renewal_rate', label: 'Renewal Rate',
      format: 'pct', precision: 0.01, min: 0, max: 1,
      peerValue: peer, subjectValue: subject,
      effectiveValue: effective,
      source: pf?.source ?? sourceTag(subject, w),
      confidence: conf('renewal_rate', w),
      blendWeight: w,
    });
  }

  // 2. Expected Turnover Rate
  {
    const pf      = pfRow('turnover_rate');
    const subject = hasHistory ? (dyn?.turnover_rate ?? null) : null;
    const peer    = psv['turnover_rate'] ?? pf?.platform ?? null;
    const w       = hasHistory ? (cw['turnover_rate']?.weight ?? null) : null;
    const effective = pf?.resolved ?? blendedEffective(subject, 'turnover_rate', psv, cw);
    fields.push({
      fieldId: 'turnover_rate', label: 'Expected Turnover Rate',
      format: 'pct', precision: 0.01, min: 0, max: 1,
      peerValue: peer, subjectValue: subject,
      effectiveValue: effective,
      source: pf?.source ?? sourceTag(subject, w),
      confidence: conf('turnover_rate', w),
      blendWeight: w,
    });
  }

  // 3. Days Vacant (median)
  {
    const pf      = pfRow('days_vacant_median');
    const subject = hasHistory ? (dyn?.days_vacant_median ?? null) : null;
    const peer    = psv['days_vacant_median'] ?? pf?.platform ?? null;
    const w       = hasHistory ? (cw['days_vacant_median']?.weight ?? null) : null;
    const effective = pf?.resolved ?? blendedEffective(subject, 'days_vacant_median', psv, cw);
    fields.push({
      fieldId: 'days_vacant_median', label: 'Days Vacant (median)',
      format: 'days', precision: 1, min: 0,
      peerValue: peer, subjectValue: subject,
      effectiveValue: effective,
      source: pf?.source ?? sourceTag(subject, w),
      confidence: conf('days_vacant_median', w),
      blendWeight: w,
    });
  }

  // 4. Blended Rent Growth
  // subjectValue sourced from traffic calibration ONLY when subject history exists
  // (trafficProjection.calibrated is the M07 calibration output, populated with rent rolls).
  // When hasHistory=false, subjectValue is null — no subject column, no collision panel.
  {
    const pf         = pfRow('rent_growth_yr1');
    const calibrated = hasHistory
      ? (financials.trafficProjection?.calibrated?.rentGrowthPct ?? null)
      : null;
    const yr1Assump  = financials.assumptions?.rentGrowthYr1 ?? null;
    const peer       = psv['rent_growth_yr1'] ?? psv['rentGrowthYr1'] ?? pf?.platform ?? null;
    const w          = hasHistory
      ? (cw['rent_growth_yr1']?.weight ?? (calibrated != null ? 1 : null))
      : null;
    const effective  = pf?.resolved ?? (() => {
      if (calibrated != null && peer != null && w != null && w < 1 && w > 0) {
        return w * calibrated + (1 - w) * peer;
      }
      return calibrated ?? peer ?? yr1Assump;
    })();
    fields.push({
      fieldId: 'rent_growth_yr1', label: 'Blended Rent Growth',
      format: 'pct', precision: 0.001, min: -0.2, max: 0.2,
      peerValue: peer ?? yr1Assump,
      subjectValue: calibrated,
      effectiveValue: effective,
      source: pf?.source ?? sourceTag(calibrated, w),
      confidence: conf('rent_growth_yr1', w),
      blendWeight: w,
    });
  }

  return fields;
}

function mapPeerCollisionsToEntries(
  peerCollisions: NonNullable<F9SubjectHistory['peer_collisions']>,
): CollisionEntry[] {
  return peerCollisions.map(c => ({
    fieldId:      c.coefficient,
    deltaSigma:   Math.abs(c.sigma_deviation),
    subjectValue: c.subject_value,
    peerValue:    c.peer_value,
    severity:     Math.abs(c.sigma_deviation) >= 2.5 ? 'severe' : 'material',
  }));
}

// ─── Main component ───────────────────────────────────────────────────────
export function ProjectionsTab({
  dealId,
  deal,
  integrityWarning,
  f9Financials,
  onTabChange,
  onHoldChange,
  onF9Refresh,
  lvCostTreatmentView,
  onLvTreatmentViewChange,
}: FinancialEngineTabProps) {
  const [timeline, setTimeline] = useState<TimelineOption>(5);

  const handleTimeline = useCallback((yr: TimelineOption) => {
    setTimeline(yr);
    onHoldChange?.(yr);
  }, [onHoldChange]);
  const [viewMode, setViewMode] = useState<ViewMode>('annual');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['traffic-funnel', ...SECTIONS.map(s => s.key)]),
  );
  const [showAfterTax, setShowAfterTax] = useState(false);
  const [showGprDecomp,        setShowGprDecomp]        = useState(true);
  const [showFindings,         setShowFindings]          = useState(true);
  const [showSubjectHistory,   setShowSubjectHistory]    = useState(true);

  const [narrative,        setNarrative]       = useState<string | null>(null);
  const [narrativeBlocks,  setNarrativeBlocks] = useState<F9NarrativeBlock[]>([]);
  const [narrativeLoading, setNarrativeLoading]= useState(false);
  const [exporting,        setExporting]       = useState(false);
  const [error,            setError]           = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownInfo | null>(null);
  const [concessionDrill, setConcessionDrill] = useState<{
    open: boolean;
    periodLabel: string;
    recognizedAmount: number | null;
    earnedAmount: number | null;
    detail: AggregatedConcessionDetail | null;
    source: 'earned' | 'recognized';
    calendarYearTotal: number | null;
    fiscalYearTotal: number | null;
  }>({ open: false, periodLabel: '', recognizedAmount: null, earnedAmount: null, detail: null, source: 'recognized', calendarYearTotal: null, fiscalYearTotal: null });

  // Narrative load — non-critical, fires once
  const loadNarrative = useCallback(async () => {
    if (!dealId) return;
    setNarrativeLoading(true);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: { narrative: string | null; blocks: F9NarrativeBlock[]; cachedAt: string; source: string; fresh: boolean };
      }>(`/api/v1/deals/${dealId}/financials/narrative`);
      const d = res.data?.data;
      if (d) { setNarrative(d.narrative ?? null); setNarrativeBlocks(d.blocks ?? []); }
    } catch {
      // Non-fatal
    } finally {
      setNarrativeLoading(false);
    }
  }, [dealId]);

  React.useEffect(() => { loadNarrative(); }, [loadNarrative]);

  // Use f9Financials from parent (no separate fetch needed — avoids dual fetching)
  const financials = f9Financials ?? null;

  const holdYears  = timeline;
  // Consume backend-resolved projections; the server is the single source of truth
  const projections: ProjYear[] = useMemo(
    () => (financials?.projections ?? []).slice(0, holdYears),
    [financials, holdYears],
  );

  // Current calendar year for recognized-concessions row (§14 earned-vs-recognized)
  const currentCalendarYear = new Date().getFullYear();
  const closeYear = financials?.closeDate
    ? new Date(financials.closeDate).getFullYear()
    : currentCalendarYear;

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Export
  const handleExport = useCallback(async () => {
    if (!financials || !dealId) return;
    setExporting(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const url   = `/api/v1/deals/${dealId}/financials/export?hold=${timeline}`;
      const resp  = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!resp.ok) throw new Error(`Export failed: ${resp.status}`);
      const blob    = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a       = document.createElement('a');
      const safeName = financials.dealName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
      a.href         = blobUrl;
      a.download     = `${safeName}_ProForma_${holdYears}yr.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [financials, dealId, timeline, holdYears]);

  const hasGprDecomp   = financials?.assumptions.gprDecomposition != null;
  const hasNarrative   = narrative != null && narrative.length > 0;
  const integrityChecks = financials?.proforma.integrityChecks ?? [];
  const hasAfterTaxData = projections.some(p => p.depreciation != null);

  // InlineAssumptionBlock — leasing coefficient fields + pre-computed peer collisions
  const leasingAssumptionFields = useMemo<AssumptionFieldDef[]>(
    () => financials ? buildLeasingAssumptionFields(financials) : [],
    [financials],
  );
  const leasingCollisionEntries = useMemo<CollisionEntry[]>(
    () => financials?.subjectHistory?.peer_collisions
      ? mapPeerCollisionsToEntries(financials.subjectHistory.peer_collisions)
      : [],
    [financials],
  );

  // Sub-period columns for monthly/quarterly
  const subCols = useMemo(
    () => viewMode !== 'annual' ? buildSubCols(Math.min(holdYears, viewMode === 'monthly' ? 2 : holdYears), viewMode) : [],
    [viewMode, holdYears],
  );

  // Annual column headers
  const annualYears = Array.from({ length: holdYears }, (_, i) => i + 1);

  // Active columns
  const isAnnual = viewMode === 'annual';
  const colCount  = isAnnual ? holdYears : subCols.length;

  return (
    <>
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Main panel ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Header controls ────────────────────────────────────────────── */}
        <div style={{
          padding: '4px 10px', background: BT.bg.header,
          borderBottom: `1px solid ${BT.border.subtle}`,
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap',
        }}>
          {/* Timeline */}
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>HOLD:</span>
          {([3, 5, 7, 10] as TimelineOption[]).map(t => (
            <button key={t} onClick={() => handleTimeline(t)} style={{
              background: timeline === t ? BT.bg.active : 'transparent',
              color:      timeline === t ? BT.met.financial : BT.text.muted,
              border:     timeline === t ? `1px solid ${BT.met.financial}40` : '1px solid transparent',
              padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
            }}>{t}YR</button>
          ))}

          <div style={{ width: 1, height: 14, background: BT.border.medium }} />

          {/* View mode */}
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>VIEW:</span>
          {(['annual', 'quarterly', 'monthly'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              background: viewMode === v ? BT.bg.active : 'transparent',
              color:      viewMode === v ? BT.text.cyan : BT.text.muted,
              border:     viewMode === v ? `1px solid ${BT.text.cyan}40` : '1px solid transparent',
              padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
            }}>{v.toUpperCase()}</button>
          ))}

          <div style={{ width: 1, height: 14, background: BT.border.medium }} />

          {/* After-tax toggle */}
          {hasAfterTaxData && (
            <button onClick={() => setShowAfterTax(v => !v)} style={{
              background: showAfterTax ? `${BT.text.purple}20` : 'transparent',
              color:      showAfterTax ? BT.text.purple : BT.text.muted,
              border: `1px solid ${showAfterTax ? BT.text.purple : BT.border.subtle}`,
              padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
            }}>AFTER-TAX</button>
          )}

          {hasGprDecomp && (
            <button onClick={() => setShowGprDecomp(v => !v)} style={{
              background: showGprDecomp ? `${BT.met.financial}15` : 'transparent',
              color:      showGprDecomp ? BT.met.financial : BT.text.muted,
              border: `1px solid ${showGprDecomp ? BT.met.financial : BT.border.subtle}`,
              padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
            }}>GPR DECOMP</button>
          )}

          {hasNarrative && (
            <button onClick={() => setShowFindings(v => !v)} style={{
              background: showFindings ? `${BT.text.purple}15` : 'transparent',
              color:      showFindings ? BT.text.purple : BT.text.muted,
              border: `1px solid ${showFindings ? BT.text.purple : BT.border.subtle}`,
              padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
            }}>FINDINGS</button>
          )}
          {financials?.subjectHistory && (
            <button onClick={() => setShowSubjectHistory(v => !v)} style={{
              background: showSubjectHistory ? `${SUBJ_TEAL}18` : 'transparent',
              color:      showSubjectHistory ? SUBJ_TEAL : BT.text.muted,
              border: `1px solid ${showSubjectHistory ? SUBJ_TEAL : BT.border.subtle}`,
              padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
            }}>SUBJ·{financials.subjectHistory.tier}</button>
          )}

          <div style={{ width: 1, height: 14, background: BT.border.medium }} />

          {/* LEASING COST — read-only badge; canonical write is STANCE tab (index 1) */}
          <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#475569', letterSpacing: '0.07em' }}>LEASING COST:</span>
          <button
            onClick={() => onTabChange?.(1)}
            title="Set in STANCE tab"
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', padding: 0, cursor: onTabChange ? 'pointer' : 'default' }}
          >
            <span style={{
              fontFamily: MONO, fontSize: 8,
              background: `${BT.met.occupancy}20`,
              color: BT.met.occupancy,
              border: `1px solid ${BT.met.occupancy}55`,
              padding: '2px 7px', borderRadius: 2,
            }}>
              {lvCostTreatmentView ?? 'OPERATING'}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, letterSpacing: '0.05em' }}>
              Previewing — set in STANCE
            </span>
          </button>

          <div style={{ flex: 1 }} />

          {financials && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
              {financials.totalUnits} UNITS · {financials.dealName}
            </span>
          )}

          <button
            onClick={() => { void handleExport(); }}
            disabled={!financials || projections.length === 0 || exporting}
            style={{
              background: 'transparent', border: `1px solid ${BT.border.medium}`,
              color:    financials && !exporting ? BT.text.secondary : BT.text.muted,
              fontFamily: MONO, fontSize: 9, padding: '2px 8px',
              cursor:   financials && !exporting ? 'pointer' : 'default',
              borderRadius: 2, opacity: financials && !exporting ? 1 : 0.4,
            }}
          >
            {exporting ? 'EXPORTING...' : 'EXPORT XLSX'}
          </button>
        </div>

        {/* ── Integrity banners ──────────────────────────────────────────── */}
        {integrityWarning && (
          <div style={{ background: '#1c0a0a', borderBottom: '1px solid #ef4444', borderLeft: '4px solid #ef4444', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: '#ef4444', fontWeight: 700 }}>PRO FORMA INTEGRITY ERRORS DETECTED</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: '#fca5a5' }}>Projections may reflect unresolved field conflicts. Review Pro Forma tab for details.</span>
          </div>
        )}
        {integrityChecks.length > 0 && <IntegrityBanner checks={integrityChecks} />}

        {/* ── AI Findings ────────────────────────────────────────────────── */}
        {showFindings && (narrativeLoading || hasNarrative) && (
          <FindingsPanel narrative={narrative} blocks={narrativeBlocks} loading={narrativeLoading} />
        )}

        {/* ── Subject History (M07 §6) ────────────────────────────────────── */}
        {showSubjectHistory && financials?.subjectHistory && (
          <SubjectHistoryPanel history={financials.subjectHistory} />
        )}

        {/* ── Export error ───────────────────────────────────────────────── */}
        {error && (
          <div style={{ padding: '4px 10px', background: `${BT.text.red}12`, fontFamily: MONO, fontSize: 8, color: BT.text.red, flexShrink: 0 }}>
            {error}
          </div>
        )}

        {/* ── Operating Statement Table ──────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${BT.border.medium}`, position: 'sticky', top: 0, background: BT.bg.header, zIndex: 2 }}>
                <th style={{ padding: '5px 8px', textAlign: 'left', color: BT.text.muted, fontWeight: 500, minWidth: 220, position: 'sticky', left: 0, background: BT.bg.header, zIndex: 3 }}>
                  OPERATING STATEMENT
                  {financials && <span style={{ marginLeft: 8, fontWeight: 400, color: BT.text.muted, fontSize: 8 }}>· {financials.totalUnits} units · M07</span>}
                </th>
                {isAnnual
                  ? annualYears.map(yr => (
                      <th key={yr} style={{ padding: '5px 8px', textAlign: 'right', color: yr === holdYears ? BT.text.amber : BT.text.muted, fontWeight: yr === holdYears ? 700 : 500, minWidth: 90, borderLeft: yr === holdYears ? `2px solid ${BT.text.amber}40` : undefined }}>
                        {yr === holdYears ? `YR ${yr} ★` : `YR ${yr}`}
                      </th>
                    ))
                  : subCols.map(c => (
                      <th key={c.periodKey} style={{ padding: '5px 6px', textAlign: 'right', color: BT.text.muted, fontWeight: 500, minWidth: 80, fontSize: 8 }}>
                        {c.label}
                      </th>
                    ))
                }
              </tr>
            </thead>

            <tbody>
              {/* ── Traffic Funnel Panel ── walk-ins → tours → apps → leases over hold period ─── */}
              {isAnnual && financials && (
                <tr>
                  <td colSpan={colCount + 1} style={{ padding: 0 }}>
                    <TrafficFunnelPanel
                      yearly={financials.trafficProjection?.yearly ?? []}
                      holdYears={holdYears}
                      isOffline={!financials.trafficProjection}
                      expanded={expandedSections.has('traffic-funnel')}
                      onToggle={() => toggleSection('traffic-funnel')}
                      leasingSignals={financials.trafficProjection?.leasingSignals}
                      calibrated={financials.trafficProjection?.calibrated}
                    />
                  </td>
                </tr>
              )}

              {/* ── Occupancy & Leasing Assumptions ── below Traffic Funnel, above REVENUE rows ─── */}
              {financials && (
                <tr>
                  <td colSpan={colCount + 1} style={{ padding: 0 }}>
                    <InlineAssumptionBlock
                      blockId="occupancy-leasing"
                      blockLabel="OCCUPANCY & LEASING — MARKET RATE UNITS"
                      dealId={dealId}
                      fields={leasingAssumptionFields}
                      hasSubjectHistory={financials.subjectHistory != null}
                      subjectTier={financials.subjectHistory?.tier}
                      subjectSnapshotCount={financials.subjectHistory?.snapshot_count}
                      collisions={leasingCollisionEntries.length > 0 ? leasingCollisionEntries : undefined}
                      defaultExpanded={true}
                    />
                  </td>
                </tr>
              )}

              {/* ── LTL Trajectory ── Task #1540 B1: source signals + per-year decay ─── */}
              {financials?.ltlSignals && isAnnual && (
                <tr>
                  <td colSpan={colCount + 1} style={{ padding: 0 }}>
                    <LTLTrajectoryPanel ltlSignals={financials.ltlSignals} />
                  </td>
                </tr>
              )}

              {SECTIONS.map(section => {
                const isExpanded = expandedSections.has(section.key);
                // Hide after-tax section unless toggle active
                if (section.key === 'aftertax' && !showAfterTax) return null;

                return (
                  <React.Fragment key={section.key}>
                    <tr onClick={() => toggleSection(section.key)} style={{ cursor: 'pointer', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}` }}>
                      <td colSpan={colCount + 1} style={{ padding: '5px 8px', color: section.color, fontWeight: 700, letterSpacing: 0.8, position: 'sticky', left: 0, background: BT.bg.header, zIndex: 1 }}>
                        {isExpanded ? '▾' : '▸'} {section.label}
                      </td>
                    </tr>

                    {isExpanded && section.rows.map((row, ri) => {
                      // Hide after-tax rows unless toggle active
                      if (row.afterTaxOnly && !showAfterTax) return null;

                      const isEven = ri % 2 === 0;
                      const rowBg  = row.isTotal ? `${section.color}08` : isEven ? BT.bg.panel : BT.bg.terminal;

                      const rowEl = (
                        <tr key={row.key} style={{ background: rowBg, borderBottom: row.isTotal ? `2px solid ${BT.border.medium}` : `1px solid ${BT.border.subtle}` }}>
                          <td style={{ padding: `3px 8px 3px ${row.indent ? 20 : 8}px`, color: row.isTotal ? BT.text.white : BT.text.secondary, fontWeight: row.isTotal ? 700 : 400, position: 'sticky', left: 0, background: rowBg, zIndex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>{row.label}</span>
                              {row.tabLink != null && (
                                <button
                                  onClick={e => { e.stopPropagation(); onTabChange?.(row.tabLink!); }}
                                  style={{ background: 'transparent', border: `1px solid ${BT.border.subtle}`, color: BT.text.muted, fontFamily: MONO, fontSize: 7, padding: '0 4px', cursor: 'pointer', borderRadius: 2 }}
                                >
                                  ↗
                                </button>
                              )}
                            </div>
                          </td>

                          {isAnnual
                            ? annualYears.map(yr => {
                                const isSaleYear = section.key === 'exit' && yr === holdYears;
                                const proj    = projections[yr - 1];
                                const rawVal  = proj ? (proj[row.key] as number | null) : null;
                                const display = fmtCell(rawVal, row.fmt, row.sign);
                                const isNeg   = rawVal != null && rawVal < 0;
                                const textColor = isSaleYear && row.isTotal
                                  ? BT.text.amber
                                  : row.isTotal ? section.color
                                  : isNeg ? BT.text.red
                                  : row.sign === -1 && rawVal != null && rawVal > 0 ? BT.text.red
                                  : BT.text.primary;
                                // Source badge
                                const srcKey  = row.sourceKey ? (proj?.[row.sourceKey] as string | undefined) : undefined;
                                const srcBadge = srcKey ? SOURCE_LABELS[srcKey] : null;
                                return (
                                  <td
                                    key={yr}
                                    onClick={() => {
                                      if (!proj) return;
                                      const recog = financials?.concessionRecognition;
                                      if (row.key === 'concessions' && recog?.monthly_detail) {
                                        const calYr = closeYear + (yr - 1);
                                        const yyyymms = Array.from({ length: 12 }, (_, i) => `${calYr}${String(i + 1).padStart(2, '0')}`);
                                        setConcessionDrill({
                                          open: true,
                                          periodLabel: `YR ${calYr}`,
                                          recognizedAmount: recog.by_calendar_year[String(calYr)] ?? null,
                                          earnedAmount: (proj.concessions as number | null | undefined) ?? null,
                                          detail: aggregateConcessionDetail(recog.monthly_detail, yyyymms),
                                          source: 'earned',
                                          calendarYearTotal: recog.by_calendar_year[String(calYr)] ?? null,
                                          fiscalYearTotal: recog.by_fiscal_year?.[String(calYr)] ?? null,
                                        });
                                      } else {
                                        setDrilldown(buildDrilldown(row, proj, financials));
                                      }
                                    }}
                                    style={{ padding: '3px 8px', textAlign: 'right', color: textColor, fontWeight: row.isTotal ? 700 : 400, cursor: proj ? 'pointer' : 'default', borderLeft: isSaleYear ? `2px solid ${BT.text.amber}40` : undefined, background: isSaleYear ? `${BT.text.amber}06` : undefined }}
                                    title={proj ? (isSaleYear ? `SALE YEAR — Click for formula drilldown` : row.key === 'concessions' ? 'Click for concession breakdown' : `Click for formula drilldown`) : undefined}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                                      {srcBadge && (
                                        <span style={{ fontSize: 7, color: srcBadge.color, fontFamily: MONO, padding: '0 2px', border: `1px solid ${srcBadge.color}40`, borderRadius: 2 }}>
                                          {srcBadge.label}
                                        </span>
                                      )}
                                      <span>{display}</span>
                                    </div>
                                  </td>
                                );
                              })
                            : subCols.map(c => {
                                const proj    = projections[c.projYear - 1];
                                const rawVal  = proj ? (proj[row.key] as number | null) : null;
                                // noSubPeriod rows (ratios, %, balances, exit/disposition) show annual value unchanged
                                // flow rows get divided by period count
                                const subVal  = rawVal != null
                                  ? (row.noSubPeriod ? rawVal : rawVal * c.fraction)
                                  : null;
                                const display = fmtCell(subVal, row.fmt, row.sign);
                                const isNeg   = subVal != null && subVal < 0;
                                const textColor = row.isTotal ? section.color : isNeg ? BT.text.red : row.sign === -1 && subVal != null && subVal > 0 ? BT.text.red : BT.text.primary;
                                const periodLabel = row.noSubPeriod ? `YR ${c.projYear} (annual, not prorated)` : `YR ${c.projYear} ÷ ${viewMode === 'quarterly' ? 4 : 12}`;
                                return (
                                  <td
                                    key={c.periodKey}
                                    onClick={() => {
                                      if (!proj) return;
                                      const recog = financials?.concessionRecognition;
                                      if (row.key === 'concessions' && recog?.monthly_detail && viewMode === 'monthly') {
                                        const monthNum = parseInt(c.periodKey.slice(1, 3), 10);
                                        const yearNum  = parseInt(c.periodKey.slice(4), 10);
                                        const offset   = (yearNum - 1) * 12 + (monthNum - 1);
                                        const yyyymm   = yyyymmFromClose(financials?.closeDate, offset);
                                        if (yyyymm) {
                                          const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                          const mLabel = `${MONTHS[parseInt(yyyymm.slice(4), 10) - 1]} ${yyyymm.slice(0, 4)}`;
                                          const mYr = yyyymm.slice(0, 4);
                                          setConcessionDrill({
                                            open: true,
                                            periodLabel: mLabel,
                                            recognizedAmount: recog.monthly[yyyymm] ?? null,
                                            earnedAmount: subVal,
                                            detail: aggregateConcessionDetail(recog.monthly_detail, [yyyymm]),
                                            source: 'earned',
                                            calendarYearTotal: recog.by_calendar_year?.[mYr] ?? null,
                                            fiscalYearTotal: recog.by_fiscal_year?.[mYr] ?? null,
                                          });
                                          return;
                                        }
                                      }
                                      if (row.key === 'concessions' && recog?.monthly_detail && viewMode === 'quarterly') {
                                        const qNum    = parseInt(c.periodKey.slice(1, 3), 10);
                                        const yearNum = parseInt(c.periodKey.slice(4), 10);
                                        const baseOffset = (yearNum - 1) * 12 + (qNum - 1) * 3;
                                        const yyyymms = ([0, 1, 2]
                                          .map(i => yyyymmFromClose(financials?.closeDate, baseOffset + i))
                                          .filter(Boolean)) as string[];
                                        if (yyyymms.length > 0) {
                                          const qLabel = `Q${qNum} YR${yearNum}`;
                                          const qYr = yyyymms[0].slice(0, 4);
                                          const hasQRecog = yyyymms.some(k => k in recog.monthly);
                                          const recognizedQ = hasQRecog ? yyyymms.reduce((s, k) => s + (recog.monthly[k] ?? 0), 0) : null;
                                          setConcessionDrill({
                                            open: true,
                                            periodLabel: qLabel,
                                            recognizedAmount: recognizedQ,
                                            earnedAmount: subVal,
                                            detail: aggregateConcessionDetail(recog.monthly_detail, yyyymms),
                                            source: 'earned',
                                            calendarYearTotal: recog.by_calendar_year?.[qYr] ?? null,
                                            fiscalYearTotal: recog.by_fiscal_year?.[qYr] ?? null,
                                          });
                                          return;
                                        }
                                      }
                                      setDrilldown(buildDrilldown(row, proj, financials));
                                    }}
                                    style={{ padding: '3px 6px', textAlign: 'right', color: textColor, fontWeight: row.isTotal ? 700 : 400, cursor: proj ? 'pointer' : 'default', fontSize: 8 }}
                                    title={proj ? (row.key === 'concessions' && viewMode === 'monthly' ? 'Click for concession breakdown' : periodLabel) : undefined}
                                  >
                                    {display}
                                  </td>
                                );
                              })
                          }
                        </tr>
                      );

                      // "Current Year (YYYY) Concessions" — recognized (amortized) row,
                      // injected after the earned concessions row in REVENUE section.
                      if (
                        section.key === 'revenue' &&
                        row.key === 'concessions' &&
                        financials?.concessionRecognition != null
                      ) {
                        const recog = financials.concessionRecognition;
                        const recognizedAmt = recog.by_calendar_year[String(currentCalendarYear)] ?? null;
                        const horizonYears = annualYears.map(yr => closeYear + (yr - 1));
                        const currentYearInHorizon = horizonYears.includes(currentCalendarYear);
                        if (!currentYearInHorizon) return rowEl;

                        const recBg = `${BT.text.amber}07`;
                        const recognizedRowEl = (
                          <tr
                            key="__recognized_concessions__"
                            style={{ background: recBg, borderBottom: `1px solid ${BT.border.subtle}` }}
                          >
                            <td
                              style={{ padding: '3px 8px 3px 20px', color: BT.text.amber, fontWeight: 400, position: 'sticky', left: 0, background: recBg, zIndex: 1 }}
                              title={`Recognized (straight-line amortized) concessions for calendar year ${currentCalendarYear}. Distinct from earned (cash) concessions above — §14 EARNED-VS-RECOGNIZED-DISTINCTION.`}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ color: BT.text.amber }}>
                                  Current Year ({currentCalendarYear}) Concessions
                                </span>
                                <span style={{ fontSize: 7, color: BT.text.amber, fontFamily: MONO, padding: '0 2px', border: `1px solid ${BT.text.amber}40`, borderRadius: 2 }}>
                                  AMORT
                                </span>
                              </div>
                            </td>
                            {isAnnual
                              ? annualYears.map(yr => {
                                  const calYear = closeYear + (yr - 1);
                                  const val = recog.by_calendar_year[String(calYear)] ?? null;
                                  const display = val != null ? fmt$(-Math.abs(val)) : '—';
                                  return (
                                    <td
                                      key={yr}
                                      onClick={() => {
                                        if (val == null || !financials?.concessionRecognition?.monthly_detail) return;
                                        const recogInner = financials.concessionRecognition;
                                        const yyyymms = Array.from({ length: 12 }, (_, i) => `${calYear}${String(i + 1).padStart(2, '0')}`);
                                        setConcessionDrill({
                                          open: true,
                                          periodLabel: `YR ${calYear} RECOGNIZED`,
                                          recognizedAmount: val,
                                          earnedAmount: null,
                                          detail: aggregateConcessionDetail(recogInner.monthly_detail, yyyymms),
                                          source: 'recognized',
                                          calendarYearTotal: recogInner.by_calendar_year?.[String(calYear)] ?? null,
                                          fiscalYearTotal: recogInner.by_fiscal_year?.[String(calYear)] ?? null,
                                        });
                                      }}
                                      style={{ padding: '3px 8px', textAlign: 'right', color: val != null ? BT.text.amber : BT.text.muted, fontWeight: 400, cursor: val != null ? 'pointer' : 'default' }}
                                      title={val != null
                                        ? `Click for concession recognition breakdown — ${calYear}`
                                        : `No recognition data for ${calYear}`}
                                    >
                                      {display}
                                    </td>
                                  );
                                })
                              : subCols.map(c => {
                                  const prefix = c.periodKey[0]; // 'M' or 'Q'
                                  const periodNum = parseInt(c.periodKey.slice(1, 3), 10);
                                  const yearNum   = parseInt(c.periodKey.slice(4), 10);
                                  if (prefix === 'M') {
                                    const offset = (yearNum - 1) * 12 + (periodNum - 1);
                                    const yyyymm = yyyymmFromClose(financials?.closeDate, offset);
                                    const mVal   = yyyymm ? (recog.monthly[yyyymm] ?? null) : null;
                                    const mYr    = yyyymm ? yyyymm.slice(0, 4) : null;
                                    return (
                                      <td
                                        key={c.periodKey}
                                        onClick={() => {
                                          if (mVal == null || !yyyymm || !recog.monthly_detail) return;
                                          const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                          const mLabel = `${MONTHS[parseInt(yyyymm.slice(4), 10) - 1]} ${yyyymm.slice(0, 4)}`;
                                          setConcessionDrill({
                                            open: true,
                                            periodLabel: `${mLabel} RECOGNIZED`,
                                            recognizedAmount: mVal,
                                            earnedAmount: null,
                                            detail: aggregateConcessionDetail(recog.monthly_detail, [yyyymm]),
                                            source: 'recognized',
                                            calendarYearTotal: null,
                                            fiscalYearTotal: null,
                                          });
                                        }}
                                        style={{ padding: '3px 6px', textAlign: 'right', color: mVal != null ? BT.text.amber : BT.text.muted, fontSize: 8, cursor: mVal != null ? 'pointer' : 'default' }}
                                        title={mVal != null ? 'Click for recognized concession breakdown' : undefined}
                                      >
                                        {mVal != null ? fmt$(-Math.abs(mVal)) : '—'}
                                      </td>
                                    );
                                  }
                                  // quarterly
                                  const baseOffset = (yearNum - 1) * 12 + (periodNum - 1) * 3;
                                  const qMms = ([0, 1, 2].map(i => yyyymmFromClose(financials?.closeDate, baseOffset + i)).filter(Boolean)) as string[];
                                  const hasQData = qMms.some(k => k in recog.monthly);
                                  const qVal  = hasQData ? qMms.reduce((s, k) => s + (recog.monthly[k] ?? 0), 0) : null;
                                  return (
                                    <td
                                      key={c.periodKey}
                                      onClick={() => {
                                        if (qVal == null || qMms.length === 0 || !recog.monthly_detail) return;
                                        setConcessionDrill({
                                          open: true,
                                          periodLabel: `Q${periodNum} YR${yearNum} RECOGNIZED`,
                                          recognizedAmount: qVal,
                                          earnedAmount: null,
                                          detail: aggregateConcessionDetail(recog.monthly_detail, qMms),
                                          source: 'recognized',
                                          calendarYearTotal: null,
                                          fiscalYearTotal: null,
                                        });
                                      }}
                                      style={{ padding: '3px 6px', textAlign: 'right', color: qVal != null ? BT.text.amber : BT.text.muted, fontSize: 8, cursor: qVal != null ? 'pointer' : 'default' }}
                                      title={qVal != null ? 'Click for recognized concession breakdown' : undefined}
                                    >
                                      {qVal != null ? fmt$(-Math.abs(qVal)) : '—'}
                                    </td>
                                  );
                                })
                            }
                          </tr>
                        );
                        return (
                          <React.Fragment key={`${row.key}_frag`}>
                            {rowEl}
                            {recognizedRowEl}
                          </React.Fragment>
                        );
                      }

                      // ── Custom user-line sub-rows (Task #1160 + Task #1170) ──────────────
                      // Injected after the "Other Income" rollup row in the REVENUE section.
                      // Ramping lines (adoption.ramp_duration_months > 0) show a RAMP badge
                      // and use the ramp-aware annual formula with per-year color coding.
                      // Flat lines (no adoption or ramp_duration_months === 0) show a FLAT
                      // badge and display monthly × 12 in every year column.
                      if (
                        section.key === 'revenue' &&
                        row.key === 'otherIncome'
                      ) {
                        const allUserLines = financials?.otherIncomeUserLines ?? [];

                        if (allUserLines.length > 0) {
                          const subRowBg = `${BT.text.cyan}06`;
                          const subRows = allUserLines.map(line => {
                            const isRamping = line.adoption != null && line.adoption.ramp_duration_months > 0;

                            const labelCell = (
                              <td
                                style={{ padding: '3px 8px 3px 28px', color: BT.text.secondary, fontWeight: 400, position: 'sticky', left: 0, background: subRowBg, zIndex: 1 }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontFamily: MONO, fontSize: 9 }}>{line.label}</span>
                                  {isRamping ? (
                                    <span style={{
                                      fontSize: 7, fontWeight: 700, color: BT.text.cyan,
                                      background: `${BT.text.cyan}18`,
                                      border: `1px solid ${BT.text.cyan}40`,
                                      borderRadius: 2, padding: '0 4px', letterSpacing: '0.05em',
                                    }}>
                                      RAMP
                                    </span>
                                  ) : (
                                    <span style={{
                                      fontSize: 7, fontWeight: 700, color: BT.text.muted,
                                      background: `${BT.text.muted}18`,
                                      border: `1px solid ${BT.text.muted}40`,
                                      borderRadius: 2, padding: '0 4px', letterSpacing: '0.05em',
                                    }}>
                                      FLAT
                                    </span>
                                  )}
                                </div>
                              </td>
                            );

                            let dataCells: React.ReactNode;

                            if (isAnnual) {
                              dataCells = annualYears.map(yr => {
                                const yearIndex = yr - 1;
                                let val: number;
                                let tooltip: string | undefined;
                                let cellColor: string;

                                if (isRamping) {
                                  val = computeRampAwareAnnual(line.monthly, line.adoption!, yearIndex);
                                  tooltip = buildRampTooltip(line.adoption!, yearIndex);
                                  const midpoint = yearIndex * 12 + 6;
                                  const isAtSteadyState = midpoint >= line.adoption!.ramp_start_period + line.adoption!.ramp_duration_months;
                                  const isPreRamp = midpoint < line.adoption!.ramp_start_period;
                                  cellColor = isPreRamp ? BT.text.muted : isAtSteadyState ? BT.text.cyan : BT.text.primary;
                                } else {
                                  val = line.monthly * 12;
                                  tooltip = `${line.label}: $${line.monthly.toLocaleString()}/mo × 12`;
                                  cellColor = BT.text.secondary;
                                }

                                const display = val > 0 ? fmt$(val) : '$0';
                                return (
                                  <td
                                    key={yr}
                                    style={{ padding: '3px 8px', textAlign: 'right', color: cellColor, fontWeight: 400, cursor: 'default', fontFamily: MONO, fontSize: 9 }}
                                    title={tooltip}
                                  >
                                    {display}
                                  </td>
                                );
                              });
                            } else {
                              dataCells = subCols.map(c => {
                                const periodMatch = /^[QM](\d+)Y(\d+)$/.exec(c.periodKey);
                                const periodIdx = periodMatch ? parseInt(periodMatch[1], 10) : 1;
                                const yr        = periodMatch ? parseInt(periodMatch[2], 10) : 1;
                                const yearIndex = yr - 1;

                                let val: number;
                                let tooltip: string | undefined;
                                let cellColor: string;

                                if (viewMode === 'quarterly') {
                                  const quarterIndex = periodIdx - 1;
                                  if (isRamping) {
                                    val = computeRampAwareQuarterly(line.monthly, line.adoption!, yearIndex, quarterIndex);
                                    const midMonthOffset = yearIndex * 12 + quarterIndex * 3 + 1;
                                    const isAtSteadyState = (midMonthOffset + 1) >= line.adoption!.ramp_start_period + line.adoption!.ramp_duration_months;
                                    const isPreRamp = (midMonthOffset + 1) < line.adoption!.ramp_start_period;
                                    cellColor = isPreRamp ? BT.text.muted : isAtSteadyState ? BT.text.cyan : BT.text.primary;
                                    tooltip = buildRampTooltipQuarterly(line.adoption!, yearIndex, quarterIndex);
                                  } else {
                                    val = line.monthly * 3;
                                    tooltip = `${line.label}: $${line.monthly.toLocaleString()}/mo × 3`;
                                    cellColor = BT.text.secondary;
                                  }
                                } else {
                                  const monthOffset = yearIndex * 12 + (periodIdx - 1);
                                  if (isRamping) {
                                    val = computeRampAwareMonthly(line.monthly, line.adoption!, monthOffset);
                                    const m = monthOffset + 1;
                                    const isAtSteadyState = m >= line.adoption!.ramp_start_period + line.adoption!.ramp_duration_months;
                                    const isPreRamp = m < line.adoption!.ramp_start_period;
                                    cellColor = isPreRamp ? BT.text.muted : isAtSteadyState ? BT.text.cyan : BT.text.primary;
                                    tooltip = buildRampTooltipMonthly(line.adoption!, yearIndex, periodIdx, monthOffset);
                                  } else {
                                    val = line.monthly;
                                    tooltip = `${line.label}: $${line.monthly.toLocaleString()}/mo`;
                                    cellColor = BT.text.secondary;
                                  }
                                }

                                const display = val > 0 ? fmt$(val) : '$0';
                                return (
                                  <td
                                    key={c.periodKey}
                                    style={{ padding: '3px 6px', textAlign: 'right', color: cellColor, fontWeight: 400, cursor: 'default', fontFamily: MONO, fontSize: 8 }}
                                    title={tooltip}
                                  >
                                    {display}
                                  </td>
                                );
                              });
                            }

                            return (
                              <tr
                                key={`__userline_${line.id}__`}
                                style={{ background: subRowBg, borderBottom: `1px solid ${BT.border.subtle}`, cursor: 'pointer' }}
                                title="Click for assumption detail"
                                onClick={() => setDrilldown(buildUserLineDrilldown(line, annualYears))}
                              >
                                {labelCell}
                                {isAnnual ? (
                                  annualYears.map(yr => {
                                    const yearIndex = yr - 1;
                                    let val: number;
                                    let tooltip: string | undefined;
                                    let cellColor: string;

                                    if (isRamping) {
                                      val = computeRampAwareAnnual(line.monthly, line.adoption!, yearIndex);
                                      tooltip = buildRampTooltip(line.adoption!, yearIndex);
                                      const fraction = computeRampFraction(line.adoption, yearIndex);
                                      const isPreRamp = fraction === 0;
                                      const isAtSteadyState = fraction === 1;
                                      cellColor = isPreRamp ? BT.text.muted : isAtSteadyState ? BT.text.cyan : BT.text.primary;
                                      const showBar = !isPreRamp && !isAtSteadyState;
                                      const barOpacity = 0.35 + fraction * 0.65;
                                      const display = val > 0 ? fmt$(val) : '$0';
                                      return (
                                        <td
                                          key={yr}
                                          onClick={(e) => { e.stopPropagation(); setDrilldown(buildUserLineYearDrilldown(line, yr)); }}
                                          style={{ padding: '3px 8px 1px 8px', textAlign: 'right', color: cellColor, fontWeight: 400, cursor: 'pointer', fontFamily: MONO, fontSize: 9, position: 'relative' }}
                                          title="Click for year detail"
                                        >
                                          {display}
                                          {showBar && (
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, height: 2, width: '100%', background: `${BT.text.muted}30`, borderRadius: 1 }}>
                                              <div style={{ height: '100%', width: `${fraction * 100}%`, background: BT.text.cyan, opacity: barOpacity, borderRadius: 1, transition: 'width 0.2s ease' }} />
                                            </div>
                                          )}
                                          {isPreRamp && (
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, height: 2, width: '100%', background: `${BT.text.muted}20`, borderRadius: 1 }} />
                                          )}
                                          {isAtSteadyState && (
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, height: 2, width: '100%', background: BT.text.cyan, opacity: 0.5, borderRadius: 1 }} />
                                          )}
                                        </td>
                                      );
                                    } else {
                                      val = line.monthly * 12;
                                      tooltip = `${line.label}: $${line.monthly.toLocaleString()}/mo × 12`;
                                      cellColor = BT.text.secondary;
                                      const display = val > 0 ? fmt$(val) : '$0';
                                      return (
                                        <td
                                          key={yr}
                                          onClick={(e) => { e.stopPropagation(); setDrilldown(buildUserLineYearDrilldown(line, yr)); }}
                                          style={{ padding: '3px 8px', textAlign: 'right', color: cellColor, fontWeight: 400, cursor: 'pointer', fontFamily: MONO, fontSize: 9 }}
                                          title="Click for year detail"
                                        >
                                          {display}
                                        </td>
                                      );
                                    }
                                  })
                                ) : (
                                  dataCells
                                )}
                              </tr>
                            );
                          });

                          return (
                            <React.Fragment key={`${row.key}_frag`}>
                              {rowEl}
                              {subRows}
                            </React.Fragment>
                          );
                        }
                      }

                      return rowEl;
                    })}
                  </React.Fragment>
                );
              })}

              {/* ── Traffic signal footnote ──────────────────────────────── */}
              {isAnnual && financials?.trafficProjection?.yearly && financials.trafficProjection.yearly.length > 0 && (
                <tr style={{ background: BT.bg.header, borderTop: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ padding: '4px 8px', color: BT.text.muted, fontSize: 8, fontStyle: 'italic', position: 'sticky', left: 0, background: BT.bg.header }}>
                    Traffic signals: T01/T05/T06 integrated via M07 Engine
                  </td>
                  {annualYears.map(yr => {
                    const tv = financials.trafficProjection?.yearly.find(t => t.year === yr);
                    return (
                      <td key={yr} style={{ padding: '4px 8px', textAlign: 'right', fontSize: 8 }}>
                        {tv?.occupancyPct != null
                          ? <span style={{ color: BT.text.cyan }}>{(tv.occupancyPct * 100).toFixed(1)}% occ</span>
                          : <span style={{ color: BT.text.muted }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              )}

              {/* ── Data source legend ───────────────────────────────────── */}
              {projections.length > 0 && (
                <tr style={{ background: BT.bg.header, borderTop: `1px solid ${BT.border.subtle}` }}>
                  <td colSpan={colCount + 1} style={{ padding: '4px 10px', position: 'sticky', left: 0, background: BT.bg.header }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5 }}>DATA SOURCES:</span>
                      {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                        <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 7, color: v.color, fontFamily: MONO, padding: '0 2px', border: `1px solid ${v.color}40`, borderRadius: 2 }}>{v.label}</span>
                          <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>{k.replace('_', ' ')}</span>
                        </span>
                      ))}
                      <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginLeft: 'auto' }}>Click any cell for formula drilldown</span>
                    </div>
                  </td>
                </tr>
              )}

              {/* ── Key metrics strip (pinned bottom row) ─────────────────── */}
              {isAnnual && projections.length > 0 && METRICS_STRIP.map((m, mi) => (
                <tr key={m.key} style={{ background: mi % 2 === 0 ? `${BT.text.amber}08` : BT.bg.panel, borderBottom: mi === METRICS_STRIP.length - 1 ? `2px solid ${BT.text.amber}40` : `1px solid ${BT.border.subtle}` }}>
                  <td style={{ padding: '3px 8px', color: BT.text.amber, fontWeight: 500, fontSize: 8, position: 'sticky', left: 0, background: mi % 2 === 0 ? `${BT.text.amber}08` : BT.bg.panel, zIndex: 1, fontFamily: MONO, letterSpacing: 0.5 }}>
                    {m.label}
                  </td>
                  {annualYears.map(yr => {
                    const proj = projections[yr - 1];
                    const rawVal = proj ? (proj[m.key] as number | null) : null;
                    const display = fmtCell(rawVal, m.fmt);
                    return (
                      <td key={yr} style={{ padding: '3px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 8, color: rawVal != null ? BT.text.amber : BT.text.muted, fontWeight: 500 }}>
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Empty state */}
          {projections.length === 0 && (
            <div style={{ padding: '40px 24px', textAlign: 'center', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
              <div style={{ marginBottom: 8 }}>No projection data available for this deal.</div>
              <div>Run <strong style={{ color: BT.text.secondary }}>REPARSE</strong> from the Pro Forma tab to seed Year 1 data.</div>
            </div>
          )}

          {/* ── GPR Decomposition ────────────────────────────────────────────── */}
          {showGprDecomp && hasGprDecomp && (
            <GprDecompPanel decomp={financials!.assumptions.gprDecomposition!} totalUnits={financials!.totalUnits} />
          )}

        </div>

      </div>

      {/* ── Drilldown Drawer (right side) ──────────────────────────────────── */}
      {drilldown && (
        <DrilldownDrawer
          info={drilldown}
          onClose={() => setDrilldown(null)}
          onTabChange={onTabChange}
          dealId={dealId}
          onSave={() => { setDrilldown(null); onF9Refresh?.(); }}
        />
      )}

    </div>

    <ConcessionDrilldownModal
      open={concessionDrill.open}
      onClose={() => setConcessionDrill(p => ({ ...p, open: false }))}
      periodLabel={concessionDrill.periodLabel}
      recognizedAmount={concessionDrill.recognizedAmount}
      earnedAmount={concessionDrill.earnedAmount}
      detail={concessionDrill.detail}
      source={concessionDrill.source}
      calendarYearTotal={concessionDrill.calendarYearTotal}
      fiscalYearTotal={concessionDrill.fiscalYearTotal}
    />
    </>
  );
}

export default ProjectionsTab;
