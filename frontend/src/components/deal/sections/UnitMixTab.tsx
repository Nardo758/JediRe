import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  RefreshCw, Loader2, Activity, TrendingUp, TrendingDown, Minus,
  Info, Zap, Edit3, Check, X, AlertTriangle, ChevronDown, ChevronRight,
  RotateCcw, Plus, Trash2, Save,
} from 'lucide-react';
import { BT } from '../bloomberg-ui';
import { apiClient } from '../../../services/api.client';
import { useDealType } from '../../../stores/dealStore';
import { useDesignProgramStore } from '../../../stores/designProgram.store';
import type { UnitMixTarget } from '../../../types/designTargets.types';
import type { FinancialEngineTabProps } from '../../../pages/development/financial-engine/types';

const MONO = BT.font.mono;
const LABEL = BT.font.label;
const C = {
  bg:       '#080c12',
  panel:    '#0d1520',
  panelAlt: '#0a1018',
  border:   '#1a2535',
  borderHi: '#1e3a5f',
  cyan:     '#00d4ff',
  cyanDim:  '#0a3040',
  amber:    '#f59e0b',
  amberDim: '#2a1a00',
  green:    '#22c55e',
  greenDim: '#0a2010',
  red:      '#ef4444',
  redDim:   '#2a0808',
  purple:   '#a78bfa',
  text:     '#e2e8f0',
  muted:    '#64748b',
  dim:      '#334155',
};

interface ExpirationCurve {
  months_0_3: number;
  months_3_6: number;
  months_6_12: number;
  months_12_plus: number;
  mtm: number;
  /** Task #514 — units whose lease_expiration could not be parsed. Optional
   *  for backward compat with legacy capsules; treat missing as 0. */
  unknown?: number;
}

/** Task #514 — tri-state extraction quality for the lease-expiration column. */
type ExpirationExtractionStatus = 'ok' | 'partial' | 'failed';

interface RentRollUnitType {
  type: string;
  count: number;
  avgSf: number | null;
  inPlaceRent: number | null;
  marketRent: number | null;
  occupancyPct: number | null;
  concessionPct: number | null;
  /** Pre-override values from the backend; present only when overridden */
  inPlaceRentOriginal?: number | null;
  marketRentOriginal?: number | null;
  inPlaceRentOverridden?: boolean;
  marketRentOverridden?: boolean;
  /** Per-floor-plan expiration roll-up (only present when source = extraction_rent_roll) */
  expirationCurve?: ExpirationCurve | null;
  /** Per-floor-plan extraction quality flag — drives ExpirationBars tri-state. */
  expirationExtractionStatus?: ExpirationExtractionStatus | null;
  source?: string;
}

interface ExtractionRentRollPayload {
  totalUnits: number | null;
  occupiedUnits: number | null;
  vacantUnits: number | null;
  asOfDate: string | null;
  sourceRef: string | null;
  otherIncomeMonthly: Record<string, number> | null;
  expirationCurve: ExpirationCurve | null;
  floorPlanMix: Record<string, unknown> | null;
  units: Array<{
    unitNumber: string;
    unitType: string;
    sqft: number | null;
    status: string;
    tenantName: string | null;
    marketRent: number | null;
    leaseRent: number | null;
    effectiveRent: number | null;
    leaseStart: string | null;
    leaseEnd: string | null;
    moveInDate: string | null;
    moveOutDate: string | null;
    isFutureResident: boolean;
    balance: number | null;
  }> | null;
}

interface LeasingSignals {
  t01WeeklyTours: number | null;
  t05ClosingRatio: number | null;
  t06WeeklyLeases: number | null;
  t07LeaseUpWeeksTo95: number | null;
}

interface TrafficProjection {
  leasingSignals: LeasingSignals | null;
  leasingVelocity?: { weeklyLeases: number; annualized: number; confidence: number } | null;
  calibrated?: { vacancyPct: number | null; exitCap: number | null } | null;
  avgLeaseTermYears?: number | null;
}

interface DealFinancials {
  totalUnits: number;
  rentRollSummary: {
    unitMix: RentRollUnitType[] | null;
    avgInPlaceRent: number | null;
    weightedOccupancyPct: number | null;
    gprFromUnitMix: number | null;
    useUnitMixForGpr: boolean;
    expirationCurve?: ExpirationCurve | null;
    /** Task #514 — deal-wide tri-state for TOTALS row. */
    expirationExtractionStatus?: ExpirationExtractionStatus | null;
    /** Task #514 — per-critical-column scorecard for the review banner. */
    columnCoverage?: Record<string, string> | null;
    /** Task #514 — gates the tab-level review banner. */
    humanReviewNeeded?: boolean;
    source?: string;
  } | null;
  trafficProjection: TrafficProjection | null;
  extractionRentRoll: ExtractionRentRollPayload | null;
  /**
   * Per-category ancillary income reconciliation (RR / T-12 / OM) produced by
   * the financials composer (Task #519). The Ancillary panel below renders
   * this multi-source view directly so the Unit Mix tab and the Pro Forma tab
   * agree on every category, the resolved value, and conflict flags. Without
   * this the panel was rent-roll-only and silently dropped OM/T-12 figures.
   */
  otherIncomeBreakdown?: {
    rows: Array<{
      category: string;
      rent_roll: number | null;
      t12: number | null;
      om: number | null;
      resolved: number | null;
      resolution: string;
      conflict: boolean;
    }>;
    total: { rent_roll: number | null; t12: number | null; om: number | null; resolved: number };
  } | null;
  /** User-added custom ancillary lines persisted in deal_assumptions (Task #519). */
  otherIncomeUserLines?: Array<{
    id: string;
    label: string;
    /** Authoritative $/month (server-derived from qty*rate when present). */
    monthly: number;
    /** Optional per-unit billing model: e.g. 200 units @ $30/mo cable. */
    qty?: number;
    rate?: number;
    frequency?: 'monthly' | 'annual';
    note?: string;
    created_at: string;
    /** Adoption / ramp-up timeline. When set, income ramps instead of flat. Task #1147. */
    adoption?: {
      ramp_start_period: number;
      ramp_duration_months: number;
      steady_state_monthly: number;
      probability_adopted: number;
    } | null;
  }>;
}

const fmt$ = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString()}`;
const fmtPct = (v: number | null | undefined, decimals = 1) =>
  v == null ? '—' : `${(v * 100).toFixed(decimals)}%`;
const fmtNum = (v: number | null | undefined) =>
  v == null ? '—' : Math.round(v).toLocaleString();

function th(right = false): React.CSSProperties {
  return {
    padding: '5px 8px',
    fontFamily: LABEL,
    fontSize: 8,
    fontWeight: 700,
    color: C.muted,
    textAlign: right ? 'right' : 'left',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
    letterSpacing: '0.06em',
  };
}

function td(right = false, bold = false, color?: string): React.CSSProperties {
  return {
    padding: '4px 8px',
    fontFamily: MONO,
    fontSize: 10,
    color: color ?? C.text,
    fontWeight: bold ? 700 : 400,
    textAlign: right ? 'right' : 'left',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
  };
}

function MetricPill({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', minWidth: 110 }}>
      <div style={{ fontFamily: LABEL, fontSize: 8, color: C.muted, letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: color ?? C.cyan }}>{value}</div>
      {sub && <div style={{ fontFamily: LABEL, fontSize: 8, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function TrafficSignal({ label, value, unit, linked }: { label: string; value: string; unit: string; linked: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {linked
          ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.cyan, boxShadow: `0 0 6px ${C.cyan}` }} />
          : <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.muted }} />
        }
        <span style={{ fontFamily: LABEL, fontSize: 9, color: C.muted }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: linked ? C.cyan : C.dim }}>{value}</span>
        <span style={{ fontFamily: LABEL, fontSize: 8, color: C.muted }}>{unit}</span>
      </div>
    </div>
  );
}

/**
 * Compact horizontal stacked-bar viz of a per-floorplan expiration curve.
 * Renders 5 segments: 0-3mo / 3-6mo / 6-12mo / 12+mo / MTM, each colored by
 * urgency (MTM red, near-term amber, mid-term cyan, long-term green). Hover
 * reveals exact unit counts. Falls back to "—" when no curve is available
 * (OM-only deals, or capsule rows that pre-date this field).
 */
/**
 * Tri-state lease-expiration column (Task #514).
 *
 *   - status `'failed'` (or curve omitted but status flagged failed): the
 *     parser couldn't read the lease-expiration column at all. Render an
 *     em-dash + warning glyph, NOT a bar full of zeros.
 *   - status `'partial'`: 5 colored buckets render normally PLUS a sixth
 *     hatched/striped grey segment at the right showing how many units are
 *     missing a date. Callout appends "· N ?".
 *   - status `'ok'` (or omitted, treated as ok for legacy capsules): the
 *     existing 5-segment bar.
 *   - curve null + no status: "no rent roll" empty placeholder (unchanged).
 *
 * The hatched UNKNOWN segment uses a CSS repeating-linear-gradient — distinct
 * from both the colored buckets AND the dashed-border OM-only state.
 */
export function ExpirationBars({
  curve,
  totalUnits,
  status,
}: {
  curve: ExpirationCurve | null;
  totalUnits: number;
  status?: ExpirationExtractionStatus | null;
}) {
  // FAILED state — the parser couldn't read the column. Suppresses the count
  // callout entirely; we'd rather show nothing than fake confidence.
  if (status === 'failed') {
    return (
      <div
        title="Expiration column not mapped from rent roll — re-upload recommended"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 4px' }}
      >
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.dim, lineHeight: 1 }}>—</span>
        <AlertTriangle size={11} color={C.amber} />
      </div>
    );
  }

  if (!curve || totalUnits <= 0) {
    // Empty/dimmed state: NO expiration data is available — typically OM-only
    // deals or floor plans without leases. Distinct from FAILED because here
    // we never had a curve (vs FAILED = we had data but parser dropped it).
    return (
      <div
        title="No lease expiration data available (no rent roll uploaded)"
        style={{ display: 'inline-block', height: 10, width: 110, background: '#0a0e15', borderRadius: 2, border: `1px dashed ${C.border}`, opacity: 0.4 }}
      />
    );
  }

  // Status-driven branching (Task #514): the parser computes `status`
  // authoritatively from the curve + occupied count, so when present we honor
  // it as the source of truth for partial vs ok presentation rather than
  // re-deriving from `unknown > 0`. Keeps the renderer aligned with the spec
  // ("state driven by status flag") and avoids divergence if the bucketing
  // rules change. Falls back to curve-derived inference for legacy capsules
  // that pre-date the status field.
  const isPartial = status === 'partial' || (status == null && (curve.unknown ?? 0) > 0);
  const unknown = isPartial ? (curve.unknown ?? 0) : 0;
  const segments: Array<{ key: string; label: string; count: number; color: string }> = [
    { key: 'mtm',     label: 'MTM',       count: curve.mtm,           color: C.red },
    { key: '0_3',     label: '0-3 mo',    count: curve.months_0_3,    color: C.amber },
    { key: '3_6',     label: '3-6 mo',    count: curve.months_3_6,    color: '#d97706' },
    { key: '6_12',    label: '6-12 mo',   count: curve.months_6_12,   color: C.cyan },
    { key: '12_plus', label: '12+ mo',    count: curve.months_12_plus, color: C.green },
  ];
  const coloredSum = segments.reduce((s, x) => s + x.count, 0);
  const totalSum = coloredSum + unknown;

  if (totalSum === 0) {
    // Explicit zero state — curve extracted but all buckets zero (fully vacant
    // floor plan). Distinct from "no data" via the readout.
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}>
        <div
          title="Curve extracted; all buckets are zero (no scheduled lease ends — likely fully vacant)"
          style={{ display: 'flex', height: 10, width: 110, background: '#0a0e15', borderRadius: 2, overflow: 'hidden', border: `1px dashed ${C.border}` }}
        />
        <span style={{ fontFamily: MONO, fontSize: 9, color: C.dim, whiteSpace: 'nowrap' }}>
          0/0/0/0/0
        </span>
      </div>
    );
  }

  // Hatched fill for the UNKNOWN segment — diagonal grey stripes, visually
  // unmistakable from any of the 5 bucket colors and from the dashed-border
  // empty state.
  const hatchBg = `repeating-linear-gradient(45deg, ${C.dim} 0px, ${C.dim} 2px, ${C.muted}33 2px, ${C.muted}33 5px)`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}>
      <div style={{ display: 'flex', height: 10, width: 110, background: '#0a0e15', borderRadius: 2, overflow: 'hidden', border: `1px solid ${C.border}` }}>
        {segments.map(s => {
          if (s.count === 0) return null;
          const pct = (s.count / totalSum) * 100;
          return (
            <div
              key={s.key}
              title={`${s.label}: ${s.count} unit${s.count === 1 ? '' : 's'}`}
              style={{ width: `${Math.max(pct, 3)}%`, background: s.color, minWidth: 3 }}
            />
          );
        })}
        {unknown > 0 && (
          <div
            title={`${unknown} unit${unknown === 1 ? '' : 's'} missing expiration date — column partially extracted`}
            style={{
              width: `${Math.max((unknown / totalSum) * 100, 3)}%`,
              minWidth: 3,
              background: hatchBg,
              borderLeft: coloredSum > 0 ? `1px solid ${C.bg}` : 'none',
            }}
          />
        )}
      </div>
      <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted, whiteSpace: 'nowrap' }}>
        {curve.mtm > 0 && <span style={{ color: C.red }}>{curve.mtm} MTM</span>}
        {curve.mtm > 0 && curve.months_0_3 > 0 && <span style={{ color: C.dim }}> · </span>}
        {curve.months_0_3 > 0 && <span style={{ color: C.amber }}>{curve.months_0_3} ≤3mo</span>}
        {unknown > 0 && (curve.mtm > 0 || curve.months_0_3 > 0) && <span style={{ color: C.dim }}> · </span>}
        {unknown > 0 && <span style={{ color: C.dim }}>{unknown} ?</span>}
      </span>
    </div>
  );
}

/**
 * Task #516 — Inline per-column extraction scorecard.
 *
 * Surfaces the rent-roll parser's `column_coverage` map at the top of the
 * Unit Mix tab as 7 small pills (one per critical column). Renders whenever
 * a coverage map is present — NOT gated on `human_review_needed` — so even
 * healthy extractions show analysts which columns the parser actually
 * mapped, catching silent fallbacks (header text drifted; column resolved
 * by hardcoded position) before they affect underwriting.
 *
 * Visual encoding (5 statuses, 3 visual buckets per the task spec — ok /
 * missing / all_null share a "data-quality dot" treatment, while fallback
 * and not_supported use distinct visuals so they're not mistaken for
 * either a clean extraction or a hard failure):
 *
 *   ok            → solid green dot               ("column resolved + populated")
 *   missing       → solid red dot                 ("no header AND no data")
 *   all_null      → hollow red ring               ("header found but every row empty")
 *   fallback      → solid amber dot               ("DISTINCT — resolved by hardcoded
 *                                                   position, not header text")
 *   not_supported → dim grey, dashed pill border  ("DISTINCT — layout structurally
 *                                                   cannot supply this column")
 *
 * Hovering each pill shows a plain-language tooltip explaining the status
 * and (for non-ok statuses) what the operator should do.
 */
const SCORECARD_COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'unit_no',          label: 'UNIT #'    },
  { key: 'unit_type',        label: 'UNIT TYPE' },
  { key: 'sqft',             label: 'SQ FT'     },
  { key: 'market_rent',      label: 'MKT RENT'  },
  { key: 'charge_code',      label: 'CHG CODE'  },
  { key: 'amount',           label: 'AMOUNT'    },
  { key: 'lease_expiration', label: 'LEASE END' },
];

type ColumnCoverageStatus = 'ok' | 'fallback' | 'all_null' | 'missing' | 'not_supported';

function statusTooltip(label: string, status: ColumnCoverageStatus | string): string {
  switch (status) {
    case 'ok':
      return `${label}: column mapped from header and populated for ≥1 row.`;
    case 'fallback':
      return `${label}: header text didn't match — parser resolved this column by its hardcoded Yardi position. Values may be present but provenance is weak; verify before relying on these figures.`;
    case 'all_null':
      return `${label}: header found, but every occupied row was null/empty. Check the source export.`;
    case 'missing':
      return `${label}: parser could not locate this column AND no data was extracted. Re-export in the standard Yardi RRwLC layout.`;
    case 'not_supported':
      return `${label}: this layout structurally cannot supply per-row values for this column (e.g. generic flat exports omit lease dates and charge codes).`;
    default:
      return `${label}: status "${status}".`;
  }
}

export function ColumnScorecard({ coverage }: { coverage: Record<string, string> }) {
  return (
    <div
      style={{
        background: C.panelAlt,
        borderBottom: `1px solid ${C.border}`,
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontFamily: LABEL,
          fontSize: 9,
          fontWeight: 700,
          color: C.dim,
          letterSpacing: '0.08em',
          marginRight: 4,
        }}
        title="Per-column extraction status from the rent-roll parser. Hover each pill for details."
      >
        EXTRACTION SCORECARD
      </span>
      {SCORECARD_COLUMNS.map(({ key, label }) => {
        const status = (coverage[key] ?? 'missing') as ColumnCoverageStatus;
        // Visual tokens per status. Three distinct families so 'fallback'
        // and 'not_supported' read differently from the ok/missing/all_null
        // dot trio, per the Task #516 spec.
        let dotColor = C.green;
        let dotFill: string | undefined;
        let pillBorder = `1px solid ${C.border}`;
        let pillBg = '#0a1018';
        let labelColor = C.muted;
        if (status === 'ok') {
          dotColor = C.green;
          dotFill = C.green;
        } else if (status === 'missing') {
          dotColor = C.red;
          dotFill = C.red;
          pillBorder = `1px solid ${C.red}55`;
          labelColor = C.red;
        } else if (status === 'all_null') {
          // Hollow red ring — distinct from solid 'missing' so analysts can
          // tell "we found the column but it's empty" apart from "we never
          // found the column".
          dotColor = C.red;
          dotFill = 'transparent';
          pillBorder = `1px solid ${C.red}44`;
          labelColor = C.red;
        } else if (status === 'fallback') {
          // Distinct amber treatment — values present but low-confidence.
          dotColor = C.amber;
          dotFill = C.amber;
          pillBorder = `1px solid ${C.amber}66`;
          pillBg = '#1a0d00';
          labelColor = C.amber;
        } else if (status === 'not_supported') {
          // Distinct dimmed/dashed treatment — neither healthy nor a problem,
          // it's a structural limit of the source layout.
          dotColor = C.dim;
          dotFill = C.dim;
          pillBorder = `1px dashed ${C.dim}`;
          labelColor = C.dim;
        }
        return (
          <div
            key={key}
            title={statusTooltip(label, status)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              borderRadius: 10,
              background: pillBg,
              border: pillBorder,
              fontFamily: LABEL,
              fontSize: 9,
              letterSpacing: '0.06em',
              color: labelColor,
            }}
          >
            <span
              aria-label={`${label} status ${status}`}
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: dotFill ?? 'transparent',
                border: `1.5px solid ${dotColor}`,
                flexShrink: 0,
              }}
            />
            {label}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Per-unit detail panel scoped to one floor plan — rendered inline as an
 * expander row beneath the floor plan that the user clicked. Fields shown
 * include the full lease lifecycle (move-in / lease-start / lease-end /
 * move-out) so renewal-risk and turnover-risk diligence can be done at a
 * glance. Sorts MTM / soon-to-expire leases first.
 */
function FloorPlanUnitDetail({ floorplan, units }: {
  floorplan: string;
  units: NonNullable<ExtractionRentRollPayload['units']>;
}) {
  const slug = floorplan.toLowerCase().replace(/\s+/g, '');
  // Filter the rent-roll units array to only this floor plan. The parser may
  // emit `unit_type` in mixed case ('BS-A1', 'bs-a1', 'A1'), so normalize on
  // both sides.
  const filtered = useMemo(() => {
    const matched = units.filter(u => (u.unitType ?? '').toLowerCase().replace(/\s+/g, '') === slug);
    const score = (u: typeof units[0]) => {
      if (u.status?.toLowerCase().includes('vacant')) return Number.MAX_SAFE_INTEGER - 1;
      if (!u.leaseEnd) return Number.MAX_SAFE_INTEGER;
      const t = Date.parse(u.leaseEnd);
      return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
    };
    return matched.sort((a, b) => score(a) - score(b));
  }, [units, slug]);

  return (
    <tr style={{ background: '#050a0f' }}>
      <td colSpan={12} style={{ padding: 0 }}>
        <div style={{ borderTop: `1px solid ${C.cyan}33`, borderBottom: `1px solid ${C.cyan}33` }}>
          <div style={{ padding: '6px 12px', background: '#0a0e15', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: LABEL, fontSize: 8, fontWeight: 700, color: C.cyan, letterSpacing: '0.08em' }}>
              PER-UNIT DETAIL · {floorplan.toUpperCase()}
            </span>
            <span style={{ fontFamily: LABEL, fontSize: 8, color: C.dim }}>
              {filtered.length} unit{filtered.length === 1 ? '' : 's'} · sorted by lease end (soonest first)
            </span>
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: '14px 12px', fontFamily: LABEL, fontSize: 9, color: C.dim, textAlign: 'center' }}>
              No per-unit rows extracted for this floor plan.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: C.panelAlt }}>
                    <th style={th()}>UNIT</th>
                    <th style={th(true)}>SF</th>
                    <th style={th()}>STATUS</th>
                    <th style={th()}>TENANT</th>
                    <th style={th(true)}>LEASE RENT</th>
                    <th style={th(true)}>EFF RENT</th>
                    <th style={th(true)}>MARKET</th>
                    <th style={th()}>MOVE-IN</th>
                    <th style={th()}>LEASE START</th>
                    <th style={th()}>LEASE END</th>
                    <th style={th()}>MOVE-OUT</th>
                    <th style={th(true)}>BAL</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, idx) => {
                    const isVacant = u.status?.toLowerCase().includes('vacant');
                    const ltl = u.marketRent != null && u.leaseRent != null ? u.marketRent - u.leaseRent : null;
                    const endDate = u.leaseEnd ? new Date(u.leaseEnd) : null;
                    const monthsToEnd = endDate ? (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44) : null;
                    const endColor = isVacant ? C.dim
                      : monthsToEnd == null ? C.muted
                      : monthsToEnd < 0 ? C.red
                      : monthsToEnd < 3 ? C.amber
                      : monthsToEnd < 12 ? C.cyan
                      : C.green;
                    return (
                      <tr key={`${u.unitNumber}-${idx}`} style={{ background: idx % 2 === 0 ? C.panel : C.panelAlt }}>
                        <td style={{ ...td(), fontWeight: 700, color: C.cyan }}>{u.unitNumber}</td>
                        <td style={td(true, false, C.muted)}>{u.sqft != null ? u.sqft.toLocaleString() : '—'}</td>
                        <td style={td(false, false, isVacant ? C.red : u.isFutureResident ? C.amber : C.green)}>
                          {u.status || '—'}
                        </td>
                        <td style={td(false, false, C.muted)}>
                          <span style={{ display: 'inline-block', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.tenantName || (isVacant ? '(vacant)' : '—')}
                          </span>
                        </td>
                        <td style={td(true, false, isVacant ? C.dim : C.text)}>{fmt$(u.leaseRent)}</td>
                        <td style={td(true, false, isVacant ? C.dim : C.cyan)}>{fmt$(u.effectiveRent)}</td>
                        <td style={td(true, false, ltl != null && ltl > 0 ? C.amber : C.muted)}>{fmt$(u.marketRent)}</td>
                        <td style={td(false, false, C.muted)}>{u.moveInDate || '—'}</td>
                        <td style={td(false, false, C.muted)}>{u.leaseStart || '—'}</td>
                        <td style={td(false, false, endColor)}>
                          {u.leaseEnd ? u.leaseEnd : (isVacant ? '—' : 'MTM')}
                        </td>
                        <td style={td(false, false, u.moveOutDate ? C.amber : C.dim)}>{u.moveOutDate || '—'}</td>
                        <td style={td(true, false, u.balance != null && u.balance > 0 ? C.red : C.dim)}>
                          {u.balance != null && u.balance !== 0 ? fmt$(u.balance) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

/** Pretty labels for the seeder's per-category ancillary keys (Task #519). */
const ANCILLARY_LABELS: Record<string, string> = {
  parking: 'Parking',
  pet: 'Pet Rent',
  storage: 'Storage',
  laundry: 'Laundry',
  rubs: 'RUBS / Utility Reimb',
  fees: 'Admin / App / Late Fees',
  insurance_admin: 'Renters Insurance',
  other: 'Other Ancillary',
};

/** Source-badge colors mirroring ProFormaSummaryTab so the two views agree. */
const SRC_BADGE: Record<string, { label: string; color: string }> = {
  rent_roll: { label: 'RR',       color: C.cyan },
  t12:       { label: 'T-12',     color: C.muted },
  om:        { label: 'OM',       color: C.amber },
  override:  { label: 'OVR',      color: C.purple },
  platform_fallback: { label: '—', color: C.dim },
  unseeded:  { label: '—',        color: C.dim },
};

type OtherIncomeBreakdown = NonNullable<DealFinancials['otherIncomeBreakdown']>;
type OtherIncomeUserLine  = NonNullable<DealFinancials['otherIncomeUserLines']>[number];

/**
 * Renders the multi-source ancillary income breakdown (Task #519).
 *
 * Reads the seeder-reconciled `otherIncomeBreakdown` payload from the
 * financials endpoint instead of the raw rent-roll charge codes. This is
 * what powers the same panel in the Pro Forma tab; previously the Unit Mix
 * tab read `extraction_rent_roll.other_income_monthly` directly, which:
 *   - silently dropped OM-only deals (panel hidden entirely),
 *   - silently dropped categories the rent roll didn't break out (showed $0
 *     even when the OM/T-12 had real numbers),
 *   - never showed conflict warnings or user-added custom lines,
 *   - drove a different EGI ancillary number than the Pro Forma tab.
 *
 * Visibility contract: render whenever ANY source has data (RR, OM, T-12,
 * or user-added). Hidden only when all four are empty.
 */
function AncillaryPanel({
  totalUnits,
  breakdown,
  userLines,
}: {
  totalUnits: number;
  breakdown: OtherIncomeBreakdown;
  userLines: OtherIncomeUserLine[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  const rows = breakdown.rows;
  const total = breakdown.total;
  const userLinesAnnual = userLines.reduce((s, l) => s + l.monthly * 12, 0);
  const grandTotal = (total.resolved ?? 0) + userLinesAnnual;

  // Pick the dominant source for the header pill — purely cosmetic.
  const headerSource = (total.rent_roll ?? 0) > 0
    ? 'RENT ROLL'
    : (total.t12 ?? 0) > 0
      ? 'T-12'
      : (total.om ?? 0) > 0
        ? 'OM'
        : userLinesAnnual > 0 ? 'USER' : 'RECONCILED';
  const headerColor = headerSource === 'RENT ROLL' ? C.cyan
    : headerSource === 'OM' ? C.amber
    : headerSource === 'USER' ? C.purple
    : C.muted;

  const cell = (v: number | null, color = C.muted): React.ReactNode =>
    <span style={{ color: v == null ? C.dim : color }}>{v == null ? '—' : fmt$(v)}</span>;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', marginTop: 12 }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ padding: '8px 12px', borderBottom: collapsed ? undefined : `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        {collapsed ? <ChevronRight size={12} color={C.muted} /> : <ChevronDown size={12} color={C.muted} />}
        <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: '0.06em' }}>
          ANCILLARY INCOME · RENT-ROLL · T-12 · OM
        </span>
        <span style={{ fontFamily: LABEL, fontSize: 8, color: C.dim, marginLeft: 4 }}>
          edits available in Pro Forma tab · resolved values flow into F9 EGI
        </span>
        <span
          style={{
            fontFamily: LABEL, fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
            padding: '2px 6px', borderRadius: 3,
            background: `${headerColor}22`,
            color: headerColor,
            border: `1px solid ${headerColor}55`,
          }}
          title={`Dominant source for resolved totals: ${headerSource}`}
        >
          {headerSource}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber, marginLeft: 'auto' }}>{fmt$(grandTotal)}/yr</span>
      </div>

      {!collapsed && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.panelAlt }}>
                  <th style={th()}>CATEGORY</th>
                  <th style={th(true)}>RENT ROLL</th>
                  <th style={th(true)}>T-12</th>
                  <th style={th(true)}>OM</th>
                  <th style={th(true)}>RESOLVED</th>
                  <th style={th()}>SOURCE</th>
                  <th style={th(true)}>$/UNIT/YR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const meta = SRC_BADGE[r.resolution] ?? SRC_BADGE.unseeded;
                  const perUnit = totalUnits > 0 && r.resolved != null
                    ? Math.round(r.resolved / totalUnits)
                    : null;
                  return (
                    <tr key={r.category} style={{ background: idx % 2 === 0 ? C.panel : C.panelAlt }}>
                      <td style={{ ...td(), color: C.cyan, fontWeight: 700 }}>
                        {ANCILLARY_LABELS[r.category] ?? r.category}
                      </td>
                      <td style={td(true)}>{cell(r.rent_roll, C.cyan)}</td>
                      <td style={td(true)}>{cell(r.t12, C.muted)}</td>
                      <td style={td(true)}>{cell(r.om, C.amber)}</td>
                      <td style={td(true, true, r.resolved != null ? C.text : C.dim)}>
                        {r.resolved != null ? fmt$(r.resolved) : '—'}
                        {r.conflict && (
                          <span title="Sources disagree by more than 15%" style={{ color: C.red, marginLeft: 4 }}>⚠</span>
                        )}
                      </td>
                      <td style={{ ...td() }}>
                        <span style={{ fontFamily: LABEL, fontSize: 8, fontWeight: 700, color: meta.color, letterSpacing: '0.06em' }}>
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ ...td(true), color: C.dim, fontSize: 9 }}>
                        {perUnit != null ? `$${perUnit.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  );
                })}
                {userLines.map((l, i) => {
                  const annual = l.monthly * 12;
                  const perUnit = totalUnits > 0 ? Math.round(annual / totalUnits) : null;
                  return (
                    <tr key={l.id} style={{
                      background: (rows.length + i) % 2 === 0 ? C.panel : C.panelAlt,
                      borderTop: i === 0 ? `1px solid ${C.border}` : undefined,
                    }}>
                      <td style={{ ...td(), color: C.purple, fontWeight: 700 }}>{l.label}</td>
                      <td colSpan={3} style={{ ...td(true), color: C.dim, fontStyle: 'italic', fontSize: 9 }}>
                        {l.qty != null && l.rate != null
                          ? `${l.qty.toLocaleString()} × $${l.rate}/${l.frequency === 'annual' ? 'yr' : 'mo'}`
                          : 'user-added'}
                      </td>
                      <td style={td(true, true, C.text)}>
                        {fmt$(annual)} <span style={{ color: C.dim, fontSize: 8 }}>(${Math.round(l.monthly).toLocaleString()}/mo)</span>
                      </td>
                      <td style={{ ...td() }}>
                        <span style={{ fontFamily: LABEL, fontSize: 8, fontWeight: 700, color: C.purple, letterSpacing: '0.06em' }}>USER</span>
                      </td>
                      <td style={{ ...td(true), color: C.dim, fontSize: 9 }}>
                        {perUnit != null ? `$${perUnit.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#050a0f', borderTop: `2px solid ${C.borderHi}` }}>
                  <td style={{ ...td(), fontWeight: 700, color: C.text }}>TOTAL ANCILLARY</td>
                  <td style={td(true, true, C.cyan)}>{cell(total.rent_roll, C.cyan)}</td>
                  <td style={td(true, true, C.muted)}>{cell(total.t12, C.muted)}</td>
                  <td style={td(true, true, C.amber)}>{cell(total.om, C.amber)}</td>
                  <td style={td(true, true, C.green)}>{fmt$(grandTotal)}</td>
                  <td style={{ ...td(), color: C.dim, fontSize: 8 }}>resolved + user</td>
                  <td style={{ ...td(true), color: C.dim, fontSize: 8 }}>
                    {totalUnits > 0 ? `$${Math.round(grandTotal / totalUnits).toLocaleString()}/yr` : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ padding: '8px 12px', background: C.amberDim, borderTop: `1px solid ${C.amber}33`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber }} />
              <span style={{ fontFamily: LABEL, fontSize: 9, color: C.amber }}>ANCILLARY INCOME → FINANCIAL ENGINE (F9 EGI)</span>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.amber }}>{fmt$(grandTotal)}</span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Read-mode cell renderer for in-place / market rent. Shows the value, an Edit
 * affordance, an "OVR" badge with a tooltip showing the captured original when the
 * cell has been user-overridden (with a one-click reset), a small spinner while
 * a PATCH is in flight, and a brief "SAVED" indicator after a successful write.
 *
 * This mirrors the Pro Forma corrections-cell pattern so the user always sees:
 *   • whether a value is the original or has been overridden,
 *   • what the original was (tooltip on the badge),
 *   • a clear path back to the original (the reset button).
 */
function CellOverrideDisplay({
  value, overridden, originalValue, saving, justSaved,
  onEdit, onReset, tone, placeholderHint,
}: {
  value: number | null | undefined;
  overridden: boolean;
  originalValue: number | null;
  saving: boolean;
  justSaved: boolean;
  onEdit: () => void;
  onReset: () => void;
  tone: 'cyan' | 'amber';
  placeholderHint?: string | null;
}) {
  const accent = tone === 'cyan' ? C.cyan : C.amber;
  const valueColor = overridden ? C.amber : (value != null ? C.text : C.dim);
  const origLabel = originalValue != null ? `was ${fmt$(originalValue)}` : 'original unknown';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
      {justSaved && (
        <span style={{ fontFamily: LABEL, fontSize: 7, color: C.green, letterSpacing: '0.06em' }}>SAVED</span>
      )}
      {overridden && (
        <span
          title={`Override · ${origLabel}`}
          style={{
            fontFamily: LABEL, fontSize: 7, fontWeight: 700, color: accent,
            background: tone === 'cyan' ? C.cyanDim : C.amberDim,
            border: `1px solid ${accent}66`, borderRadius: 2, padding: '1px 3px',
            letterSpacing: '0.06em', cursor: 'help',
          }}
        >OVR</span>
      )}
      <span
        onClick={saving ? undefined : onEdit}
        style={{ color: valueColor, cursor: saving ? 'wait' : 'pointer' }}
      >{fmt$(value)}</span>
      {placeholderHint && value == null && (
        <span style={{ fontFamily: LABEL, fontSize: 7, color: C.dim }}>{placeholderHint}</span>
      )}
      {saving ? (
        <Loader2 size={9} color={C.muted} style={{ animation: 'spin 1s linear infinite' }} />
      ) : overridden ? (
        <button
          title={`Reset to original (${origLabel})`}
          onClick={onReset}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.muted, lineHeight: 0 }}
        ><RotateCcw size={9} /></button>
      ) : (
        <Edit3 size={9} color={C.dim} />
      )}
    </div>
  );
}

// ─── Derive bed/bath count from a floor-plan label ───────────────────────────
/**
 * Parse the bedroom count out of a type label so server-sourced rows carry
 * accurate bedroom metadata when re-saved via the manual builder.
 * Matches common formats: "Studio", "1BR/1BA", "2 Bedroom", "3BR+Den", etc.
 */
function bedsFromLabel(label: string): number {
  const t = (label ?? '').trim().toLowerCase();
  if (t.includes('studio') || t.startsWith('stu')) return 0;
  const m = t.match(/^(\d)/);
  if (m) return Math.min(parseInt(m[1], 10), 4);
  return 1; // safe default
}

function bathsFromLabel(label: string): number {
  const t = (label ?? '').trim().toLowerCase();
  // Match "2BA", "2 bath", "/2", or single "1BA" patterns
  const baM = t.match(/[\/\s](\d)\s*ba/);
  if (baM) return parseInt(baM[1], 10);
  const beds = bedsFromLabel(label);
  return beds === 0 ? 1 : beds >= 3 ? 2 : beds;
}

// ─── Platform defaults by bedroom type (spec §4A) ────────────────────────────
const PLATFORM_DEFAULTS_MANUAL: Record<number, { avg_sqft: number; in_place_rent: number; label: string }> = {
  0: { avg_sqft: 550,  in_place_rent: 1200, label: 'Studio' },
  1: { avg_sqft: 750,  in_place_rent: 1500, label: '1BR' },
  2: { avg_sqft: 1050, in_place_rent: 2000, label: '2BR' },
  3: { avg_sqft: 1400, in_place_rent: 2600, label: '3BR' },
  4: { avg_sqft: 1800, in_place_rent: 3200, label: '4BR+' },
};

// ─── Build ManualUnitType rows from F3 % splits + total unit count ──────────
/**
 * Converts F3 Programming tab unit-mix % splits (studio/1BR/2BR/3BR) and an
 * M03/deal target unit count into ManualUnitType rows seeded with platform
 * default sqft and rent for each bedroom tier. Rows with 0 computed units are
 * omitted so the mix stays clean for small unit counts.
 */
function buildF3PrefillTypes(
  mix: { studio: number; oneBed: number; twoBed: number; threeBed: number },
  totalUnits: number,
): ManualUnitType[] {
  const tiers: Array<{ label: string; bedrooms: number; pct: number }> = [
    { label: 'Studio',  bedrooms: 0, pct: mix.studio },
    { label: '1BR/1BA', bedrooms: 1, pct: mix.oneBed },
    { label: '2BR/2BA', bedrooms: 2, pct: mix.twoBed },
    { label: '3BR/2BA', bedrooms: 3, pct: mix.threeBed },
  ];
  const rows: ManualUnitType[] = [];
  let remaining = totalUnits;
  tiers.forEach((t, i) => {
    const isLast = i === tiers.length - 1;
    // Last row absorbs rounding remainder so sum == totalUnits exactly
    const raw = (t.pct / 100) * totalUnits;
    const count = isLast ? remaining : Math.round(raw);
    if (count <= 0) return;
    remaining -= count;
    const def = PLATFORM_DEFAULTS_MANUAL[t.bedrooms];
    rows.push({
      _id: Math.random().toString(36).slice(2),
      type: t.label,
      bedrooms: t.bedrooms,
      bathrooms: t.bedrooms === 0 ? 1 : t.bedrooms >= 3 ? 2 : t.bedrooms,
      count,
      avg_sqft: def.avg_sqft,
      in_place_rent: def.in_place_rent,
      market_rent: null,
      notes: 'Prefilled from F3 program',
    });
  });
  return rows;
}

// ─── Manual unit type shape ───────────────────────────────────────────────────
export interface ManualUnitType {
  _id: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  count: number;
  avg_sqft: number | null;
  in_place_rent: number | null;
  market_rent: number | null;
  notes: string;
}

function emptyType(): ManualUnitType {
  return {
    _id: Math.random().toString(36).slice(2),
    type: '',
    bedrooms: 1,
    bathrooms: 1,
    count: 0,
    avg_sqft: PLATFORM_DEFAULTS_MANUAL[1].avg_sqft,
    in_place_rent: PLATFORM_DEFAULTS_MANUAL[1].in_place_rent,
    market_rent: null,
    notes: '',
  };
}

// ─── Add / Edit Unit Type Modal ───────────────────────────────────────────────
function AddEditUnitTypeModal({
  initial,
  allTypes,
  targetUnits,
  onSave,
  onClose,
}: {
  initial: ManualUnitType | null;
  allTypes: ManualUnitType[];
  targetUnits: number | null;
  onSave: (t: ManualUnitType) => void;
  onClose: () => void;
}) {
  const isEdit = initial !== null;
  const [form, setForm] = useState<ManualUnitType>(initial ?? emptyType());

  const set = (k: keyof ManualUnitType, v: unknown) =>
    setForm(f => ({ ...f, [k]: v }));

  // When bedrooms changes, pre-fill platform defaults if the fields are
  // still at their prior default values (non-destructive prefill).
  const handleBedsChange = (beds: number) => {
    const def = PLATFORM_DEFAULTS_MANUAL[beds] ?? PLATFORM_DEFAULTS_MANUAL[4];
    setForm(f => ({
      ...f,
      bedrooms: beds,
      avg_sqft: f.avg_sqft === (PLATFORM_DEFAULTS_MANUAL[f.bedrooms] ?? PLATFORM_DEFAULTS_MANUAL[4]).avg_sqft
        ? def.avg_sqft
        : f.avg_sqft,
      in_place_rent: f.in_place_rent === (PLATFORM_DEFAULTS_MANUAL[f.bedrooms] ?? PLATFORM_DEFAULTS_MANUAL[4]).in_place_rent
        ? def.in_place_rent
        : f.in_place_rent,
    }));
  };

  // Running total of all types (excluding the one being edited)
  const othersSum = allTypes
    .filter(t => t._id !== form._id)
    .reduce((s, t) => s + (t.count || 0), 0);
  const runningTotal = othersSum + (form.count || 0);
  const delta = targetUnits != null ? runningTotal - targetUnits : null;

  const labelConflict = allTypes.some(
    t => t._id !== form._id && t.type.trim().toLowerCase() === form.type.trim().toLowerCase(),
  );
  const valid =
    form.type.trim() !== '' &&
    !labelConflict &&
    form.count > 0 &&
    (form.in_place_rent ?? 0) > 0 &&
    (form.avg_sqft ?? 0) > 0;

  const sfWarn = form.avg_sqft != null && (form.avg_sqft < 200 || form.avg_sqft > 4000);

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const panel: React.CSSProperties = {
    background: C.panel, border: `1px solid ${C.borderHi}`, borderRadius: 8,
    width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
  };
  const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4,
    padding: '6px 8px', fontFamily: MONO, fontSize: 11, color: C.text,
    outline: 'none', boxSizing: 'border-box', ...extra,
  });
  const lbl: React.CSSProperties = {
    fontFamily: LABEL, fontSize: 9, color: C.muted, letterSpacing: '0.06em',
    marginBottom: 4, display: 'block',
  };
  const row: React.CSSProperties = { display: 'flex', gap: 10, marginBottom: 12 };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={panel}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: LABEL, fontSize: 11, fontWeight: 700, color: C.cyan, letterSpacing: '0.08em' }}>
            {isEdit ? 'EDIT UNIT TYPE' : 'ADD UNIT TYPE'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 2 }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '16px 18px' }}>
          {/* Label */}
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>LABEL <span style={{ color: C.red }}>*</span></label>
            <input
              style={{ ...inp(), borderColor: labelConflict ? C.red : C.border }}
              placeholder="e.g. 1BR/1BA, Studio+Den, 2BR/2BA-A"
              value={form.type}
              onChange={e => set('type', e.target.value)}
            />
            {labelConflict && (
              <span style={{ fontFamily: LABEL, fontSize: 8, color: C.red, marginTop: 3, display: 'block' }}>
                Label already exists in this deal
              </span>
            )}
          </div>

          {/* Bedrooms / Bathrooms */}
          <div style={row}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>BEDROOMS <span style={{ color: C.red }}>*</span></label>
              <select
                style={{ ...inp(), cursor: 'pointer' }}
                value={form.bedrooms}
                onChange={e => handleBedsChange(Number(e.target.value))}
              >
                <option value={0}>Studio (0)</option>
                <option value={1}>1 Bedroom</option>
                <option value={2}>2 Bedrooms</option>
                <option value={3}>3 Bedrooms</option>
                <option value={4}>4+ Bedrooms</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>BATHROOMS <span style={{ color: C.red }}>*</span></label>
              <select
                style={{ ...inp(), cursor: 'pointer' }}
                value={form.bathrooms}
                onChange={e => set('bathrooms', Number(e.target.value))}
              >
                {[1, 1.5, 2, 2.5, 3].map(v => (
                  <option key={v} value={v}>{v} Bath{v !== 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Unit count / avg sqft */}
          <div style={row}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>UNIT COUNT <span style={{ color: C.red }}>*</span></label>
              <input
                type="number" min={1} step={1}
                style={{ ...inp(), borderColor: form.count <= 0 ? C.red : C.border }}
                value={form.count || ''}
                onChange={e => set('count', Math.max(0, Math.round(Number(e.target.value))))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>AVG SQ FT <span style={{ color: C.red }}>*</span></label>
              <input
                type="number" min={1} step={1}
                style={{ ...inp(), borderColor: sfWarn ? C.amber : C.border }}
                value={form.avg_sqft ?? ''}
                onChange={e => set('avg_sqft', e.target.value === '' ? null : +e.target.value)}
              />
              {sfWarn && (
                <span style={{ fontFamily: LABEL, fontSize: 8, color: C.amber, marginTop: 3, display: 'block' }}>
                  Unusual size — verify before saving
                </span>
              )}
            </div>
          </div>

          {/* Projected rent / Market rent */}
          <div style={row}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>PROJECTED RENT $/MO <span style={{ color: C.red }}>*</span></label>
              <input
                type="number" min={0} step={1}
                style={{ ...inp(), borderColor: (form.in_place_rent ?? 0) <= 0 ? C.red : C.border }}
                value={form.in_place_rent ?? ''}
                onChange={e => set('in_place_rent', e.target.value === '' ? null : +e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>MARKET RENT $/MO <span style={{ color: C.muted }}>optional</span></label>
              <input
                type="number" min={0} step={1}
                style={inp()}
                placeholder={form.in_place_rent != null ? String(form.in_place_rent) : '—'}
                value={form.market_rent ?? ''}
                onChange={e => set('market_rent', e.target.value === '' ? null : +e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>NOTES <span style={{ color: C.muted }}>optional</span></label>
            <input
              style={inp()}
              placeholder="Penthouse tier, corner unit, accessible, etc."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {/* Live unit count validator */}
          <div style={{
            background: C.panelAlt, border: `1px solid ${delta != null && delta !== 0 ? C.amber : C.green}44`,
            borderRadius: 5, padding: '8px 12px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: LABEL, fontSize: 9, color: C.muted }}>RUNNING TOTAL</span>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: delta != null && delta !== 0 ? C.amber : C.green }}>
                {runningTotal} units
              </span>
            </div>
            {targetUnits != null && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontFamily: LABEL, fontSize: 8, color: C.muted }}>vs target ({targetUnits})</span>
                <span style={{ fontFamily: LABEL, fontSize: 8, color: delta === 0 ? C.green : C.amber, fontWeight: 700 }}>
                  {delta === 0 ? '✓ matches target' : delta! > 0 ? `+${delta} over` : `${delta} under`}
                </span>
              </div>
            )}
            {targetUnits == null && (
              <div style={{ fontFamily: LABEL, fontSize: 8, color: C.dim, marginTop: 4 }}>
                No target set — sum will become the deal unit count on save
              </div>
            )}
          </div>

          {/* Platform defaults note */}
          <div style={{ fontFamily: LABEL, fontSize: 8, color: C.dim, marginBottom: 16 }}>
            PLATFORM DEFAULTS · {form.bedrooms === 0 ? 'Studio' : `${form.bedrooms}BR`}: {(PLATFORM_DEFAULTS_MANUAL[form.bedrooms] ?? PLATFORM_DEFAULTS_MANUAL[4]).avg_sqft} sf / ${(PLATFORM_DEFAULTS_MANUAL[form.bedrooms] ?? PLATFORM_DEFAULTS_MANUAL[4]).in_place_rent.toLocaleString()}/mo projected — labeled as starting points only
          </div>
        </div>

        <div style={{ padding: '12px 18px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ fontFamily: LABEL, fontSize: 9, padding: '6px 14px', borderRadius: 4, background: 'none', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', letterSpacing: '0.05em' }}
          >
            CANCEL
          </button>
          <button
            onClick={() => valid && onSave({ ...form, market_rent: form.market_rent ?? form.in_place_rent })}
            disabled={!valid}
            style={{
              fontFamily: LABEL, fontSize: 9, padding: '6px 14px', borderRadius: 4,
              background: valid ? C.cyan : C.dim, color: valid ? C.bg : C.muted,
              border: 'none', cursor: valid ? 'pointer' : 'not-allowed',
              fontWeight: 700, letterSpacing: '0.05em',
            }}
          >
            {isEdit ? 'SAVE CHANGES' : 'ADD TYPE'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete Dialog ────────────────────────────────────────────────────
function ConfirmDeleteDialog({
  label,
  onConfirm,
  onCancel,
}: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: C.panel, border: `1px solid ${C.red}66`, borderRadius: 8, padding: '20px 24px', width: 360 }}>
        <div style={{ fontFamily: LABEL, fontSize: 11, fontWeight: 700, color: C.red, marginBottom: 10 }}>DELETE UNIT TYPE</div>
        <div style={{ fontFamily: LABEL, fontSize: 10, color: C.text, marginBottom: 18 }}>
          Remove <strong style={{ color: C.cyan }}>{label}</strong> from the unit mix?
          <br /><span style={{ color: C.muted, fontSize: 9 }}>This cannot be undone. Save to persist.</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} style={{ fontFamily: LABEL, fontSize: 9, padding: '5px 12px', borderRadius: 4, background: 'none', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer' }}>CANCEL</button>
          <button onClick={onConfirm} style={{ fontFamily: LABEL, fontSize: 9, padding: '5px 12px', borderRadius: 4, background: C.red, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>DELETE</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Unit Mix tab inside the F9 Financial Engine. Accepts the standard
 * `FinancialEngineTabProps` shape so it composes cleanly with the other F9 tabs;
 * only `dealId` and `deal` are read here today, but the rest of the prop bag is
 * accepted for future enhancements (collision filters, evidence map, etc.) and to
 * keep the parent page's tab dispatcher uniform.
 */
export function UnitMixTab(props: FinancialEngineTabProps) {
  const { dealId, deal, onF9Refresh } = props;
  const dealType = useDealType();
  const [data, setData] = useState<DealFinancials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Task #514 — session-scoped dismiss state for the rent-roll review banner.
  // Resets on tab unmount AND whenever a fresh extraction payload arrives
  // (detected via signature change on column_coverage + status fields), so a
  // re-upload that surfaces new review-worthy issues re-shows the banner even
  // if the user had dismissed the previous one within the same mount.
  const [reviewBannerDismissed, setReviewBannerDismissed] = useState(false);
  const lastBannerSigRef = useRef<string | null>(null);
  // Watch the extraction signature; on change, clear the dismiss flag so a
  // fresh re-upload re-shows the banner if the new payload still warrants
  // review. Signature includes the fields that drive banner content.
  useEffect(() => {
    const sig = JSON.stringify({
      c: data?.rentRollSummary?.columnCoverage ?? null,
      s: data?.rentRollSummary?.expirationExtractionStatus ?? null,
      h: data?.rentRollSummary?.humanReviewNeeded ?? null,
    });
    if (lastBannerSigRef.current !== null && lastBannerSigRef.current !== sig) {
      setReviewBannerDismissed(false);
    }
    lastBannerSigRef.current = sig;
  }, [
    data?.rentRollSummary?.columnCoverage,
    data?.rentRollSummary?.expirationExtractionStatus,
    data?.rentRollSummary?.humanReviewNeeded,
  ]);
  const [editingRent, setEditingRent] = useState<{ idx: number; field: 'inPlace' | 'market'; val: string } | null>(null);
  const [rentOverrides, setRentOverrides] = useState<Record<string, { inPlace?: number; market?: number }>>({});
  const [savingCell, setSavingCell] = useState<{ idx: number; field: 'inPlace' | 'market' } | null>(null);
  const [justSaved, setJustSaved] = useState<{ idx: number; field: 'inPlace' | 'market' } | null>(null);
  // Which floor plan rows are expanded into per-unit drilldowns. Keyed by
  // floor-plan slug so multiple can be open at once and survive re-sorts.
  const [expandedFloorPlans, setExpandedFloorPlans] = useState<Set<string>>(new Set());
  const [useUnitMixForGpr, setUseUnitMixForGpr] = useState<boolean>(false);
  const [togglingUnitMixGpr, setTogglingUnitMixGpr] = useState(false);

  // ── Manual unit type builder (Task #1146) ─────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingType, setEditingType] = useState<ManualUnitType | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ManualUnitType | null>(null);
  const [localTypes, setLocalTypes] = useState<ManualUnitType[]>([]);
  const [savingTypes, setSavingTypes] = useState(false);
  const [typesSaveError, setTypesSaveError] = useState<string | null>(null);
  const [typesSaved, setTypesSaved] = useState(false);
  const [unitMixError, setUnitMixError] = useState<string | null>(null);

  // F3 Programming tab unit mix percentages (studio/oneBed/twoBed/threeBed)
  const f3UnitMix = useDesignProgramStore(s => s.program.unitMix ?? null);
  const f3IsDirty = useDesignProgramStore(s => s.isDirty);

  const dealRaw = deal as Record<string, any> | undefined;
  const targetUnits: number | null = dealRaw?.target_units ?? null;
  const m03TargetUnits: number | null = (() => {
    const mo = dealRaw?.module_outputs;
    return mo?.developmentCapacity?.total ?? mo?.developmentCapacity?.targetUnits ?? null;
  })();
  const zoningMaxGfa: number | null = dealRaw?.module_outputs?.developmentCapacity?.maxGfa ?? null;

  // When server data loads, initialise localTypes from the server unit mix.
  // This keeps edit-in-progress state stable across refreshes.
  const lastLoadSigRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data) return;
    const sig = JSON.stringify(data.rentRollSummary?.unitMix ?? []);
    if (lastLoadSigRef.current === sig) return;
    lastLoadSigRef.current = sig;
    const serverMix = data.rentRollSummary?.unitMix ?? [];
    setLocalTypes(serverMix.map((u, i) => ({
      _id: `srv-${i}-${u.type}`,
      type: u.type,
      bedrooms: bedsFromLabel(u.type),
      bathrooms: bathsFromLabel(u.type),
      count: u.count,
      avg_sqft: u.avgSf,
      in_place_rent: u.inPlaceRent,
      market_rent: u.marketRent,
      notes: '',
    })));
  }, [data?.rentRollSummary?.unitMix]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<{ success: boolean; data: DealFinancials }>(`/api/v1/deals/${dealId}/financials`);
      if (res.data.success) {
        setData(res.data.data);
        // Clear local optimistic overlay — server is now SOT
        setRentOverrides({});
      } else {
        setError('Failed to load unit mix data');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  // Primary save: PUT /unit-mix/types (Task #1146 — new endpoint, supports manual builder)
  const saveTypes = useCallback(async (types: ManualUnitType[]) => {
    setSavingTypes(true);
    setTypesSaveError(null);
    setTypesSaved(false);
    try {
      await apiClient.put(`/api/v1/deals/${dealId}/unit-mix/types`, {
        types: types.map(t => ({
          type: t.type,
          bedrooms: t.bedrooms,
          bathrooms: t.bathrooms,
          count: t.count,
          avg_sqft: t.avg_sqft,
          in_place_rent: t.in_place_rent,
          market_rent: t.market_rent ?? t.in_place_rent,
          notes: t.notes || null,
        })),
      });
      setTypesSaved(true);
      setTimeout(() => setTypesSaved(false), 2500);
      onF9Refresh?.();
      await load();
    } catch (e: any) {
      setTypesSaveError(e?.response?.data?.error ?? e?.message ?? 'Save failed');
    } finally {
      setSavingTypes(false);
    }
  }, [dealId, load, onF9Refresh]);

  // One-click prefill: create unit types from F3 % splits × M03/target count.
  // Delegates to buildF3PrefillTypes (same logic, explicit labels, last-row
  // rounding correction) so both paths stay consistent.
  const handlePrefillFromM03F3 = useCallback(async () => {
    if (!f3UnitMix) return;
    const total = targetUnits ?? m03TargetUnits;
    if (!total || total <= 0) return;
    const rows = buildF3PrefillTypes(f3UnitMix, total);
    if (rows.length === 0) return;
    await saveTypes(rows);
  }, [m03TargetUnits, targetUnits, f3UnitMix, saveTypes]);


  // Persist a rent edit to the backend (unit_mix:{idx}:in_place_rent or :market_rent),
  // then refetch /financials so the Pro Forma GPR view stays in sync. Pass `value: null`
  // to clear an override and restore the original (pre-edit) rent.
  const commitRentEdit = useCallback(async (rowIdx: number, kind: 'inPlace' | 'market', val: number | null, unitType: string) => {
    if (val !== null && (!Number.isFinite(val) || val < 0)) return;
    const cellField = kind === 'inPlace' ? 'in_place_rent' : 'market_rent';
    // Optimistic local overlay (only when setting a value — clears wait for the refetch)
    if (val !== null) {
      setRentOverrides(prev => ({ ...prev, [unitType]: { ...(prev[unitType] ?? {}), [kind]: val } }));
    }
    setSavingCell({ idx: rowIdx, field: kind });
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, {
        field: `unit_mix:${rowIdx}:${cellField}`,
        value: val,
      });
      await load();
      // Briefly flash a "saved" indicator on the cell
      setJustSaved({ idx: rowIdx, field: kind });
      setTimeout(() => {
        setJustSaved(curr => (curr && curr.idx === rowIdx && curr.field === kind ? null : curr));
      }, 1800);
      // Tell the parent page to refresh its shared F9 financials view (so Pro Forma KPIs pick up the new GPR)
      try { onF9Refresh?.(); } catch { /* noop */ }
    } catch (e) {
      // On failure, drop the optimistic value so the UI reflects server truth on next load
      setRentOverrides(prev => {
        const next = { ...prev };
        if (next[unitType]) {
          const { [kind]: _drop, ...rest } = next[unitType];
          next[unitType] = rest;
        }
        return next;
      });
      console.error(`Failed to save unit_mix rent edit (${cellField} row ${rowIdx}):`, e);
    } finally {
      setSavingCell(null);
    }
  }, [dealId, load, onF9Refresh]);

  /** Reset a previously-overridden cell back to its captured original value. */
  const resetRentEdit = useCallback((rowIdx: number, kind: 'inPlace' | 'market', unitType: string) => {
    void commitRentEdit(rowIdx, kind, null, unitType);
  }, [commitRentEdit]);

  useEffect(() => {
    setUseUnitMixForGpr(data?.rentRollSummary?.useUnitMixForGpr ?? false);
  }, [data?.rentRollSummary?.useUnitMixForGpr]);

  const handleToggleUnitMixForGpr = useCallback(async () => {
    const next = !useUnitMixForGpr;
    setUseUnitMixForGpr(next);
    setTogglingUnitMixGpr(true);
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, {
        field: 'da:use_unit_mix_for_gpr',
        value: next,
      });
      onF9Refresh?.();
      await load();
    } catch {
      setUseUnitMixForGpr(!next);
    } finally {
      setTogglingUnitMixGpr(false);
    }
  }, [dealId, useUnitMixForGpr, onF9Refresh, load]);

  const unitMix = data?.rentRollSummary?.unitMix ?? [];
  const totalUnits = data?.totalUnits ?? 0;
  const ls = data?.trafficProjection?.leasingSignals;
  const hasTraffic = ls != null && (ls.t06WeeklyLeases != null || ls.t07LeaseUpWeeksTo95 != null);
  const lv = data?.trafficProjection?.leasingVelocity;

  const getEffectiveRent = (u: RentRollUnitType) =>
    rentOverrides[u.type]?.inPlace ?? u.inPlaceRent;
  const getMarketRent = (u: RentRollUnitType) =>
    rentOverrides[u.type]?.market ?? u.marketRent;

  const totalGprAnnual = unitMix.reduce((s, u) => {
    const r = getEffectiveRent(u) ?? 0;
    return s + u.count * r * 12;
  }, 0);

  const totalMarketGprAnnual = unitMix.reduce((s, u) => {
    const r = getMarketRent(u) ?? 0;
    return s + u.count * r * 12;
  }, 0);

  const totalLtl = totalMarketGprAnnual - totalGprAnnual;

  // Null-aware weighted occupancy. When NO row carries an occupancy figure
  // (e.g. OM-only mixes that publish counts/rents but no occupancy %),
  // surface `null` instead of falsely reporting 0% — the KPI card and
  // physical-vacancy derivative both special-case null and render "—".
  const weightedOcc = (() => {
    if (unitMix.length === 0) return data?.rentRollSummary?.weightedOccupancyPct ?? null;
    let weightedSum = 0;
    let weightTotal = 0;
    for (const u of unitMix) {
      if (u.occupancyPct == null) continue;
      weightedSum += u.occupancyPct * u.count;
      weightTotal += u.count;
    }
    if (weightTotal === 0) return null;
    return weightedSum / weightTotal;
  })();

  const physicalVacancy = weightedOcc != null ? 1 - weightedOcc : null;

  const leaseUpWeeks = ls?.t07LeaseUpWeeksTo95;
  const weeklyLeases = ls?.t06WeeklyLeases ?? lv?.weeklyLeases;

  const currentOcc = weightedOcc ?? 0;
  const vacantUnits = Math.round((1 - currentOcc) * totalUnits);
  const leaseUpMonths = leaseUpWeeks != null ? +(leaseUpWeeks / 4.33).toFixed(1) : null;

  const stabilizedVac = data?.trafficProjection?.calibrated?.vacancyPct ?? 0.05;

  const isExisting    = dealType === 'existing';
  const isValueAdd    = dealType === 'redevelopment' || dealType === 'value-add';
  const isDevelopment = dealType === 'development';

  const weightedAvgSf = totalUnits > 0 && unitMix.some(u => u.avgSf != null)
    ? Math.round(unitMix.reduce((s, u) => s + (u.avgSf ?? 0) * u.count, 0) / totalUnits)
    : null;

  const totalNrsf = unitMix.reduce((s, u) => s + (u.avgSf ?? 0) * u.count, 0);

  // `deal` is loosely typed at this layer; reach in defensively for legacy nested fields.
  const dealData = (deal as { deal_data?: { deal_assumptions?: { total_units?: number }; extraction_rent_roll?: { total_units?: number } } } | undefined)?.deal_data;
  const assumedTotalUnits = dealData?.deal_assumptions?.total_units
    ?? dealData?.extraction_rent_roll?.total_units
    ?? null;
  const unitCountMismatch = assumedTotalUnits != null && totalUnits > 0 && Math.abs(assumedTotalUnits - totalUnits) > 2;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, background: C.bg }}>
        <Loader2 size={20} color={C.cyan} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontFamily: LABEL, fontSize: 11, color: C.muted, marginLeft: 10 }}>Loading unit mix...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: C.red, fontFamily: LABEL, fontSize: 11 }}>{error}</div>
    );
  }

  return (
    <>
    <div style={{ background: C.bg, minHeight: '100%', overflowY: 'auto' }}>

      {/* ── Header bar ── */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontFamily: LABEL, fontSize: 10, fontWeight: 700, color: C.cyan, letterSpacing: '0.1em' }}>F13 · UNIT MIX</span>
          <span style={{ fontFamily: LABEL, fontSize: 9, color: C.muted, marginLeft: 12 }}>
            {isDevelopment ? 'Target program · absorption model' : isValueAdd ? 'In-place · renovation upside · absorption' : 'In-place rents · floor plan economics · absorption link'}
          </span>
        </div>
        <button
          onClick={load}
          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: C.muted, fontFamily: LABEL, fontSize: 9 }}
        >
          <RefreshCw size={11} /> REFRESH
        </button>
      </div>

      {/* ── Per-column extraction scorecard (Task #516) ──
          Renders whenever the parser produced a column_coverage map — NOT
          gated on humanReviewNeeded — so analysts see at a glance which of
          the 7 critical columns the parser mapped (and which fell back to
          hardcoded positions, came back empty, or are unsupported by this
          layout). Catches silent extraction fallbacks before they affect
          underwriting. */}
      {data?.rentRollSummary?.columnCoverage && Object.keys(data.rentRollSummary.columnCoverage).length > 0 && (
        <ColumnScorecard coverage={data.rentRollSummary.columnCoverage} />
      )}

      {/* ── No-rent-roll banner ──
          Gated on FEATURE AVAILABILITY, not just presence of an extraction
          payload. Even when extraction_rent_roll exists, advanced features
          (per-unit drill-down, ancillary, expiration analysis) require
          usable floor-plan + units data. So we show this banner whenever
          the source label isn't one of the rent-roll-grade tiers AND there
          are no per-unit rows. Differentiated copy attributes provenance
          to OM, capsule, or pure synthesis. */}
      {(() => {
        const rrSource = (data?.rentRollSummary as { source?: string } | null)?.source ?? null;
        const hasUsefulRentRoll = rrSource === 'rent_roll' || rrSource === 'extraction_rent_roll';
        const hasPerUnitRows = (data?.extractionRentRoll?.units?.length ?? 0) > 0;
        if (hasUsefulRentRoll && hasPerUnitRows) return null;
        if (hasUsefulRentRoll && !hasPerUnitRows) {
          // Rent-roll mix exists but no per-unit rows — tell the user the
          // mix is good but per-unit features are unavailable.
          return (
            <div style={{ background: '#0a0d18', borderBottom: `1px solid ${C.amber}44`, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={13} color={C.amber} />
              <span style={{ fontFamily: LABEL, fontSize: 9, color: C.amber }}>
                RENT ROLL (UNSTRUCTURED) — Floor plan totals were extracted but per-unit rows are unavailable. Re-extract with the latest parser to unlock per-unit drill-down and lease expiration analysis.
              </span>
            </div>
          );
        }
        if (unitMix.length === 0) return null;
        const isOM = rrSource === 'extraction_om';
        const isSynth = (unitMix.length === 1 && unitMix[0].type === 'Default') || rrSource === 'synthesized' || rrSource === 'capsule';
        const headline = isOM
          ? 'OM-PUBLISHED UNIT MIX'
          : isSynth
            ? 'SYNTHESIZED DEFAULT ROW'
            : 'NO RENT ROLL';
        const detail = isOM
          ? 'Floor plan counts and rents come from the offering memorandum (broker-published).'
          : isSynth
            ? 'A single Default row was synthesized from capsule aggregates because no per-floorplan data was found.'
            : 'No rent-roll extraction is available for this deal.';
        return (
          <div style={{ background: '#0a0d18', borderBottom: `1px solid ${C.purple}44`, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={13} color={C.purple} />
            <span style={{ fontFamily: LABEL, fontSize: 9, color: C.purple }}>
              {headline} — {detail} Upload a rent roll to unlock per-unit drill-down, lease expiration analysis, and rent-roll-sourced ancillary income.
            </span>
          </div>
        );
      })()}

      {/* ── Extraction-quality review banner (Task #514) ──
          Surfaces when the rent-roll parser flagged the extraction as needing
          human review (≥1 critical column missing OR ≥50% rows missing lease
          expiration / effective rent). Lists the offending columns by name
          so the user can decide whether to re-export and re-upload. */}
      {data?.rentRollSummary?.humanReviewNeeded && !reviewBannerDismissed && (() => {
        const cov = data?.rentRollSummary?.columnCoverage ?? {};
        // 'missing' / 'all_null' = parser couldn't read the column at all.
        // 'fallback' = parser had to use hardcoded column indices (header
        // text didn't match), so values may be present but provenance is
        // weak — surface these too as a low-confidence signal so operators
        // can decide whether to re-export with the canonical headers.
        const failed = Object.entries(cov)
          .filter(([, s]) => s === 'missing' || s === 'all_null')
          .map(([k]) => k.replace(/_/g, ' '));
        const fallback = Object.entries(cov)
          .filter(([, s]) => s === 'fallback')
          .map(([k]) => k.replace(/_/g, ' '));
        const flagged = failed;
        return (
          <div style={{ background: '#1a0d00', borderBottom: `1px solid ${C.amber}66`, padding: '10px 20px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertTriangle size={14} color={C.amber} style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
              <span style={{ fontFamily: LABEL, fontSize: 10, fontWeight: 700, color: C.amber, letterSpacing: '0.06em' }}>
                RENT ROLL REVIEW RECOMMENDED
              </span>
              <span style={{ fontFamily: LABEL, fontSize: 9, color: C.amber }}>
                {flagged.length > 0
                  ? <>The parser could not reliably extract: <strong>{flagged.join(', ')}</strong>. </>
                  : <>The parser flagged ≥50% of occupied units missing lease expiration or effective rent. </>}
                {fallback.length > 0 && (
                  <>Low-confidence columns (resolved by position rather than header match): <strong>{fallback.join(', ')}</strong>. </>
                )}
                Re-export the rent roll in the standard Yardi RRwLC layout (the recommended format for highest-confidence extraction; a generic flat layout is also accepted but with reduced fidelity), or verify the affected columns before relying on these figures for underwriting.
              </span>
            </div>
            {/* Task #514 — banner is session-dismissable. Re-renders on the next
                successful re-extraction (humanReviewNeeded toggles back true). */}
            <button
              onClick={() => setReviewBannerDismissed(true)}
              title="Dismiss this warning for the current session"
              style={{
                background: 'transparent',
                border: 'none',
                color: C.amber,
                cursor: 'pointer',
                padding: 2,
                marginTop: 1,
                flexShrink: 0,
                opacity: 0.7,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })()}

      {/* ── Unit count reconciliation banner ── */}
      {unitCountMismatch && (
        <div style={{ background: '#1a0d00', borderBottom: `1px solid ${C.amber}44`, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={13} color={C.amber} />
          <span style={{ fontFamily: LABEL, fontSize: 9, color: C.amber }}>
            UNIT COUNT MISMATCH — Assumptions show <strong>{assumedTotalUnits}</strong> units, rent roll extraction yields <strong>{totalUnits}</strong>.
            Verify against the offering memorandum or update deal assumptions.
          </span>
        </div>
      )}

      {/* ── KPI row ── */}
      <div style={{ display: 'flex', gap: 10, padding: '14px 20px', flexWrap: 'wrap' }}>
        <MetricPill label="TOTAL UNITS" value={totalUnits > 0 ? totalUnits.toLocaleString() : '—'} color={C.cyan} sub={`${unitMix.length} floor plan types`} />
        <MetricPill label="IN-PLACE GPR" value={totalGprAnnual > 0 ? fmt$(totalGprAnnual) : '—'} color={C.green} sub="annualized · feeds ProForma" />
        {totalMarketGprAnnual > 0 && <MetricPill label="MARKET GPR" value={fmt$(totalMarketGprAnnual)} color={C.amber} sub="at full market rents" />}
        {totalLtl > 0 && (
          <MetricPill
            label="LOSS-TO-LEASE"
            value={fmt$(totalLtl)}
            color={C.red}
            sub={fmtPct(totalMarketGprAnnual > 0 ? totalLtl / totalMarketGprAnnual : null) + ' of mkt GPR'}
          />
        )}
        <MetricPill
          label="OCCUPANCY"
          value={fmtPct(weightedOcc)}
          color={weightedOcc != null && weightedOcc >= 0.90 ? C.green : weightedOcc != null && weightedOcc >= 0.80 ? C.amber : C.red}
          sub={vacantUnits > 0 ? `${vacantUnits} vacant units` : undefined}
        />
        <MetricPill
          label="LEASING VELOCITY"
          value={weeklyLeases != null ? `${weeklyLeases.toFixed(1)}/wk` : '—'}
          color={hasTraffic ? C.cyan : C.dim}
          sub={hasTraffic ? 'M07 TRAFFIC ENGINE' : 'no traffic data'}
        />
        {weightedAvgSf != null && (
          <MetricPill label="AVG UNIT SIZE" value={`${weightedAvgSf.toLocaleString()} SF`} color={C.muted} sub={totalNrsf > 0 ? `${Math.round(totalNrsf).toLocaleString()} NRSF total` : undefined} />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 1, padding: '0 20px 20px' }}>

        {/* ── LEFT: floor plan table + ancillary panel ── */}
        <div>
          {/* GPR Feed Banner */}
          <div style={{ background: C.greenDim, border: `1px solid ${C.green}33`, borderRadius: 6, padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={13} color={C.green} />
              <span style={{ fontFamily: LABEL, fontSize: 9, color: C.green }}>
                THIS TABLE IS THE SINGLE SOURCE OF TRUTH FOR PROFORMA GPR — edits here propagate to the Financial Engine (F9)
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{
                fontFamily: LABEL, fontSize: 8, letterSpacing: '0.05em',
                padding: '2px 6px', borderRadius: 3,
                background: useUnitMixForGpr ? C.cyanDim : `${C.green}22`,
                color: useUnitMixForGpr ? C.cyan : C.green,
                border: `1px solid ${useUnitMixForGpr ? C.cyan : C.green}44`,
              }}>
                GPR: {useUnitMixForGpr ? 'UNIT MIX' : 'EXTRACTION'}
              </span>
              <button
                onClick={handleToggleUnitMixForGpr}
                disabled={togglingUnitMixGpr || unitMix.length === 0}
                title={unitMix.length === 0 ? 'No unit mix data to derive GPR from' : (useUnitMixForGpr ? 'Switch GPR source back to extraction data' : 'Derive GPR from this unit mix table')}
                style={{
                  fontFamily: LABEL, fontSize: 8,
                  cursor: (togglingUnitMixGpr || unitMix.length === 0) ? 'not-allowed' : 'pointer',
                  padding: '2px 8px', borderRadius: 3,
                  background: useUnitMixForGpr ? C.dim : C.cyan,
                  color: useUnitMixForGpr ? C.text : C.bg,
                  border: 'none', opacity: togglingUnitMixGpr ? 0.6 : 1,
                  letterSpacing: '0.04em', fontWeight: 700,
                }}
              >
                {togglingUnitMixGpr ? '…' : useUnitMixForGpr ? 'USE EXTRACTION' : 'USE UNIT MIX'}
              </button>
            </div>
          </div>

          {/* ── M03 advisory banner (shown when live unit count diverges >5%) ── */}
          {(() => {
            if (!isDevelopment) return null;
            const localSum = localTypes.reduce((s, t) => s + (t.count || 0), 0);
            if (m03TargetUnits == null || localSum === 0) return null;
            const pctDiff = Math.abs(localSum - m03TargetUnits) / m03TargetUnits;
            if (pctDiff <= 0.05) return null;
            return (
              <div style={{ background: C.amberDim, border: `1px solid ${C.amber}44`, borderRadius: 6, padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={12} color={C.amber} />
                <span style={{ fontFamily: LABEL, fontSize: 9, color: C.amber }}>
                  M03 ADVISORY — Your unit count ({localSum}) differs from M03 dev capacity output ({m03TargetUnits}) by {(pctDiff * 100).toFixed(1)}%. Confirm this is intentional.
                </span>
              </div>
            );
          })()}

          {unitMixError && (
            <div style={{
              marginBottom: 8, padding: '8px 12px', borderRadius: 4,
              background: '#2a1010', border: `1px solid ${C.red}55`,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <AlertTriangle size={12} style={{ color: C.red, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontFamily: LABEL, fontSize: 9, color: C.red, flex: 1 }}>{unitMixError}</span>
              <button onClick={() => setUnitMixError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 0, lineHeight: 1 }}>✕</button>
            </div>
          )}
          {unitMix.length === 0 ? (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: 32, textAlign: 'center' }}>
              {isDevelopment ? (
                <>
                  <div style={{ fontFamily: LABEL, fontSize: 10, color: C.muted, marginBottom: 6 }}>NO UNITS DEFINED</div>
                  <div style={{ fontFamily: LABEL, fontSize: 9, color: C.dim, marginBottom: 16 }}>
                    This development deal has no rent roll. Build the unit mix manually.
                  </div>
                  {m03TargetUnits != null && m03TargetUnits > 0 && (
                    <div style={{ background: C.cyanDim, border: `1px solid ${C.cyan}44`, borderRadius: 4, padding: '8px 12px', marginBottom: 14, fontFamily: LABEL, fontSize: 9, color: C.cyan }}>
                      M03 capacity suggests <strong>{m03TargetUnits}</strong> total units — add floor plan types below that sum to this target.
                      {f3UnitMix && (
                        <div style={{ marginTop: 6, fontFamily: LABEL, fontSize: 8, color: C.cyan }}>
                          F3 program: Studio {f3UnitMix.studio}% · 1BR {f3UnitMix.oneBed}% · 2BR {f3UnitMix.twoBed}% · 3BR {f3UnitMix.threeBed}%
                          {' '}({m03TargetUnits} units from M03)
                        </div>
                      )}
                    </div>
                  )}
                  {targetUnits != null && targetUnits > 0 && (
                    <div style={{ fontFamily: LABEL, fontSize: 8, color: C.dim, marginBottom: 14 }}>
                      Deal target: <strong style={{ color: C.amber }}>{targetUnits}</strong> units
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => { setEditingType(null); setShowAddModal(true); }}
                      style={{
                        fontFamily: LABEL, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                        background: C.cyan, border: 'none', color: C.bg, borderRadius: 4,
                        padding: '8px 18px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <Plus size={12} /> ADD FIRST UNIT TYPE
                    </button>
                    {f3UnitMix && (targetUnits ?? m03TargetUnits) != null && (targetUnits ?? m03TargetUnits)! > 0 && (
                      <button
                        onClick={() => { void handlePrefillFromM03F3(); }}
                        disabled={savingTypes}
                        title={`Seed ${targetUnits ?? m03TargetUnits} units from F3 Programming % splits`}
                        style={{
                          fontFamily: LABEL, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                          padding: '8px 16px', borderRadius: 4, border: `1px solid ${C.purple}66`,
                          background: '#1a0a2a', color: C.purple, cursor: savingTypes ? 'not-allowed' : 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 6, opacity: savingTypes ? 0.6 : 1,
                        }}
                      >
                        {savingTypes ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
                        IMPORT FROM F3 PROGRAM
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: LABEL, fontSize: 10, color: C.muted, marginBottom: 6 }}>NO UNIT MIX DATA</div>
                  <div style={{ fontFamily: LABEL, fontSize: 9, color: C.dim }}>Upload and process a rent roll document to populate unit mix</div>
                </>
              
              )}
            </div>
          ) : (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: '0.06em' }}>FLOOR PLAN BREAKDOWN</span>
                {isValueAdd && (
                  <span style={{ fontFamily: LABEL, fontSize: 8, color: C.purple, background: '#2a1a3a', border: `1px solid ${C.purple}44`, borderRadius: 3, padding: '2px 6px' }}>
                    VALUE-ADD · EDIT STABILIZED RENTS
                  </span>
                )}
                {/* Add / Save / Error controls — merged from HEAD (M03 badge) + task (save status) */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isDevelopment && m03TargetUnits != null && m03TargetUnits > 0 && (
                    <span style={{ fontFamily: LABEL, fontSize: 8, color: Math.abs(totalUnits - m03TargetUnits) / m03TargetUnits > 0.05 ? C.amber : C.green }}>
                      M03: {m03TargetUnits}u
                    </span>
                  )}
                  {isDevelopment && targetUnits != null && targetUnits > 0 && (
                    <span style={{
                      fontFamily: LABEL, fontSize: 8, fontWeight: 700,
                      color: totalUnits === targetUnits ? C.green : C.amber,
                      background: totalUnits === targetUnits ? `${C.green}18` : `${C.amber}18`,
                      border: `1px solid ${totalUnits === targetUnits ? C.green : C.amber}44`,
                      borderRadius: 3, padding: '2px 6px',
                    }}>
                      {totalUnits}/{targetUnits}
                      {totalUnits !== targetUnits && ` (${totalUnits < targetUnits ? '-' : '+'}${Math.abs(totalUnits - targetUnits)})`}
                    </span>
                  )}
                  {typesSaveError && (
                    <span style={{ fontFamily: LABEL, fontSize: 8, color: C.red }}>{typesSaveError}</span>
                  )}
                  {typesSaved && (
                    <span style={{ fontFamily: LABEL, fontSize: 8, color: C.green, letterSpacing: '0.05em' }}>SAVED</span>
                  )}
                  {savingTypes && (
                    <Loader2 size={11} color={C.muted} style={{ animation: 'spin 1s linear infinite' }} />
                  )}
                  {/* F3 + M03 prefill button — also available when mix has rows (replace / merge) */}
                  {f3UnitMix != null && (targetUnits ?? m03TargetUnits) != null && (targetUnits ?? m03TargetUnits)! > 0 && (
                    <button
                      disabled={savingTypes}
                      onClick={() => {
                        const total = (targetUnits ?? m03TargetUnits)!;
                        const rows = buildF3PrefillTypes(f3UnitMix, total);
                        if (rows.length === 0) return;
                        void saveTypes(rows);
                      }}
                      title={`Replace mix with F3 program ${f3UnitMix.studio}/${f3UnitMix.oneBed}/${f3UnitMix.twoBed}/${f3UnitMix.threeBed}% across ${(targetUnits ?? m03TargetUnits)} units`}
                      style={{
                        fontFamily: LABEL, fontSize: 8, fontWeight: 700, letterSpacing: '0.05em',
                        padding: '3px 10px', borderRadius: 3, border: `1px solid ${C.purple}55`,
                        background: '#1a0a2a', color: C.purple, cursor: savingTypes ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4, opacity: savingTypes ? 0.6 : 1,
                      }}
                    >
                      <Save size={9} /> F3 PROGRAM
                    </button>
                  )}
                  <button
                    onClick={() => { setEditingType(null); setShowAddModal(true); }}
                    title="Add a new unit type"
                    style={{
                      fontFamily: LABEL, fontSize: 8, fontWeight: 700, letterSpacing: '0.05em',
                      padding: '3px 10px', borderRadius: 3, border: 'none',
                      background: C.cyan, color: C.bg, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Plus size={10} /> ADD TYPE
                  </button>
                </div>
              </div>
              {unitMixError && (
                <div style={{
                  margin: '8px 12px', padding: '8px 12px', borderRadius: 4,
                  background: '#2a1010', border: `1px solid ${C.red}55`,
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <AlertTriangle size={12} style={{ color: C.red, flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontFamily: LABEL, fontSize: 9, color: C.red, flex: 1 }}>{unitMixError}</span>
                  <button onClick={() => setUnitMixError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 0, lineHeight: 1 }}>✕</button>
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.panelAlt }}>
                      <th style={th()}>TYPE</th>
                      <th style={th(true)}>UNITS</th>
                      <th style={th(true)}>MIX %</th>
                      <th style={th(true)}>AVG SF</th>
                      <th style={th(true)}>IN-PLACE RENT</th>
                      <th style={th(true)}>$/SF/MO</th>
                      <th style={th(true)}>MARKET RENT</th>
                      <th style={th(true)}>L-T-L</th>
                      <th style={th(true)}>OCC %</th>
                      <th style={th()}>LEASE EXP</th>
                      <th style={th(true)}>ANNUAL GPR</th>
                      <th style={th()}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitMix.map((u, idx) => {
                      const effRent   = getEffectiveRent(u);
                      const mktRent   = getMarketRent(u);
                      const ltlAmt    = mktRent != null && effRent != null ? mktRent - effRent : null;
                      const ltlPct    = mktRent != null && ltlAmt != null && mktRent > 0 ? ltlAmt / mktRent : null;
                      const gpr       = effRent != null ? u.count * effRent * 12 : null;
                      const mixPct    = totalUnits > 0 ? u.count / totalUnits : 0;
                      const occ       = u.occupancyPct;
                      const rentPerSf = effRent != null && u.avgSf != null && u.avgSf > 0 ? effRent / u.avgSf : null;
                      const isEditing = editingRent?.idx === idx;
                      const slug = u.type.toLowerCase().replace(/\s+/g, '');
                      const isExpanded = expandedFloorPlans.has(slug);
                      const rentRollUnits = data?.extractionRentRoll?.units ?? null;
                      // Clickable only when there are per-unit rows we can
                      // actually filter to this floor plan. OM-only deals
                      // (no rent roll) get a static row — no chevron, no
                      // hover affordance.
                      const hasUnits = rentRollUnits != null && rentRollUnits.some(
                        ru => (ru.unitType ?? '').toLowerCase().replace(/\s+/g, '') === slug,
                      );
                      const toggle = () => {
                        if (!hasUnits) return;
                        setExpandedFloorPlans(prev => {
                          const next = new Set(prev);
                          if (next.has(slug)) next.delete(slug); else next.add(slug);
                          return next;
                        });
                      };

                      return (
                        <React.Fragment key={u.type}>
                        <tr
                          style={{
                            background: idx % 2 === 0 ? C.panel : C.panelAlt,
                            cursor: hasUnits ? 'pointer' : 'default',
                          }}
                          onClick={hasUnits ? (e) => {
                            // Don't toggle when the click came from an editable
                            // cell (input, button, the ✎/↺ controls).
                            const tag = (e.target as HTMLElement).tagName.toLowerCase();
                            if (tag === 'input' || tag === 'button' || tag === 'svg' || tag === 'path') return;
                            toggle();
                          } : undefined}
                          title={hasUnits ? (isExpanded ? 'Click to collapse per-unit detail' : 'Click to view per-unit detail') : undefined}
                        >
                          <td style={{ ...td(), fontWeight: 700, color: C.cyan }}>
                            {hasUnits && (
                              <span style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}>
                                {isExpanded ? <ChevronDown size={10} color={C.muted} /> : <ChevronRight size={10} color={C.muted} />}
                              </span>
                            )}
                            {u.type}
                            {/* Provenance hint when the floor plan name itself
                                is unknown/blank — clarifies that the mix came
                                from an unstructured rent-roll extract that
                                couldn't classify the floorplan. */}
                            {(() => {
                              const t = (u.type ?? '').trim().toLowerCase();
                              const unknown = t === '' || t === 'unknown' || t === 'n/a';
                              const fromRR = (data?.rentRollSummary as { source?: string } | null)?.source === 'extraction_rent_roll';
                              if (!unknown || !fromRR) return null;
                              return (
                                <span style={{ marginLeft: 6, fontFamily: LABEL, fontSize: 7, fontWeight: 600, color: C.amber, letterSpacing: '0.06em' }}>
                                  · RENT ROLL (UNSTRUCTURED)
                                </span>
                              );
                            })()}
                          </td>
                          <td style={td(true)}>{u.count}</td>
                          <td style={td(true, false, C.muted)}>{(mixPct * 100).toFixed(1)}%</td>
                          <td style={td(true, false, C.muted)}>{u.avgSf != null ? `${u.avgSf.toLocaleString()}` : '—'}</td>

                          {/* In-place rent — editable */}
                          <td style={{ ...td(true), position: 'relative' }}>
                            {isEditing && editingRent!.field === 'inPlace' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input
                                  autoFocus type="number" value={editingRent!.val}
                                  onChange={e => setEditingRent({ ...editingRent!, val: e.target.value })}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      const v = +editingRent!.val;
                                      void commitRentEdit(idx, 'inPlace', v, u.type);
                                      setEditingRent(null);
                                    } else if (e.key === 'Escape') setEditingRent(null);
                                  }}
                                  style={{ width: 72, background: C.panelAlt, border: `1px solid ${C.cyan}`, borderRadius: 3, color: C.cyan, fontFamily: MONO, fontSize: 10, padding: '2px 4px', textAlign: 'right' }}
                                />
                                <button onClick={() => { const v = +editingRent!.val; void commitRentEdit(idx, 'inPlace', v, u.type); setEditingRent(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.green }}><Check size={11} /></button>
                                <button onClick={() => setEditingRent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.red }}><X size={11} /></button>
                              </div>
                            ) : (
                              <CellOverrideDisplay
                                value={effRent}
                                overridden={!!u.inPlaceRentOverridden || rentOverrides[u.type]?.inPlace != null}
                                originalValue={u.inPlaceRentOriginal ?? null}
                                saving={savingCell?.idx === idx && savingCell?.field === 'inPlace'}
                                justSaved={justSaved?.idx === idx && justSaved?.field === 'inPlace'}
                                onEdit={() => setEditingRent({ idx, field: 'inPlace', val: String(effRent ?? '') })}
                                onReset={() => resetRentEdit(idx, 'inPlace', u.type)}
                                tone="cyan"
                              />
                            )}
                          </td>

                          {/* $/SF/mo — computed, not editable */}
                          <td style={td(true, false, C.dim)}>
                            {rentPerSf != null ? `$${rentPerSf.toFixed(2)}` : '—'}
                          </td>

                          {/* Market rent — editable */}
                          <td style={{ ...td(true), position: 'relative' }}>
                            {isEditing && editingRent!.field === 'market' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input
                                  autoFocus type="number" value={editingRent!.val}
                                  onChange={e => setEditingRent({ ...editingRent!, val: e.target.value })}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      const v = +editingRent!.val;
                                      void commitRentEdit(idx, 'market', v, u.type);
                                      setEditingRent(null);
                                    } else if (e.key === 'Escape') setEditingRent(null);
                                  }}
                                  style={{ width: 72, background: C.panelAlt, border: `1px solid ${C.amber}`, borderRadius: 3, color: C.amber, fontFamily: MONO, fontSize: 10, padding: '2px 4px', textAlign: 'right' }}
                                />
                                <button onClick={() => { const v = +editingRent!.val; void commitRentEdit(idx, 'market', v, u.type); setEditingRent(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.green }}><Check size={11} /></button>
                                <button onClick={() => setEditingRent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.red }}><X size={11} /></button>
                              </div>
                            ) : (
                              <CellOverrideDisplay
                                value={mktRent}
                                overridden={!!u.marketRentOverridden || rentOverrides[u.type]?.market != null}
                                originalValue={u.marketRentOriginal ?? null}
                                saving={savingCell?.idx === idx && savingCell?.field === 'market'}
                                justSaved={justSaved?.idx === idx && justSaved?.field === 'market'}
                                onEdit={() => setEditingRent({ idx, field: 'market', val: String(mktRent ?? '') })}
                                onReset={() => resetRentEdit(idx, 'market', u.type)}
                                tone="amber"
                                placeholderHint={mktRent == null ? 'ENTER' : null}
                              />
                            )}
                          </td>

                          <td style={td(true, false, ltlAmt != null && ltlAmt > 0 ? C.red : C.muted)}>
                            {ltlAmt != null && ltlAmt > 0 ? `(${fmt$(ltlAmt)})` : '—'}
                            {ltlPct != null && ltlPct > 0 && (
                              <span style={{ fontFamily: LABEL, fontSize: 7, color: C.dim, marginLeft: 3 }}>{fmtPct(ltlPct)}</span>
                            )}
                          </td>
                          <td style={td(true, false, occ == null ? C.dim : occ >= 0.90 ? C.green : occ >= 0.80 ? C.amber : C.red)}>
                            {fmtPct(occ)}
                          </td>
                          <td style={td(false)}>
                            <ExpirationBars
                              curve={u.expirationCurve ?? null}
                              totalUnits={u.count}
                              status={u.expirationExtractionStatus ?? null}
                            />
                          </td>
                          <td style={td(true, false, C.green)}>{fmt$(gpr)}</td>
                          {/* Edit / delete affordances */}
                          <td style={{ ...td(), width: 60 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <button
                                title="Edit unit type"
                                onClick={e => {
                                  e.stopPropagation();
                                  const lt = localTypes.find(t => t.type === u.type);
                                  if (lt) {
                                    setEditingType(lt);
                                    setShowAddModal(true);
                                  } else {
                                    // Build a ManualUnitType from the server row, deriving bed/bath from label
                                    const newLt: ManualUnitType = {
                                      _id: `srv-${idx}-${u.type}`,
                                      type: u.type,
                                      bedrooms: bedsFromLabel(u.type),
                                      bathrooms: bathsFromLabel(u.type),
                                      count: u.count,
                                      avg_sqft: u.avgSf,
                                      in_place_rent: u.inPlaceRent,
                                      market_rent: u.marketRent,
                                      notes: '',
                                    };
                                    setEditingType(newLt);
                                    setShowAddModal(true);
                                  }
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: C.dim, lineHeight: 0 }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.cyan; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.dim; }}
                              >
                                <Edit3 size={10} />
                              </button>
                              <button
                                title="Delete unit type"
                                onClick={e => {
                                  e.stopPropagation();
                                  const lt = localTypes.find(t => t.type === u.type) ?? {
                                    _id: `srv-${idx}-${u.type}`,
                                    type: u.type,
                                    bedrooms: bedsFromLabel(u.type),
                                    bathrooms: bathsFromLabel(u.type),
                                    count: u.count, avg_sqft: u.avgSf,
                                    in_place_rent: u.inPlaceRent, market_rent: u.marketRent, notes: '',
                                  };
                                  setPendingDelete(lt);
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: C.dim, lineHeight: 0 }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.red; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.dim; }}
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && rentRollUnits && (
                          <FloorPlanUnitDetail floorplan={u.type} units={rentRollUnits} />
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#050a0f', borderTop: `2px solid ${C.borderHi}` }}>
                      <td style={{ ...td(), fontWeight: 700, color: C.text }}>TOTALS / WTD AVG</td>
                      <td style={{ ...td(true), fontWeight: 700 }}>{totalUnits}</td>
                      <td style={{ ...td(true), color: C.muted }}>100%</td>
                      <td style={{ ...td(true), color: C.muted }}>
                        {weightedAvgSf != null ? weightedAvgSf.toLocaleString() : '—'}
                      </td>
                      <td style={{ ...td(true), fontWeight: 700, color: C.text }}>
                        {totalUnits > 0 && totalGprAnnual > 0 ? fmt$(Math.round(totalGprAnnual / totalUnits / 12)) : '—'}/mo
                      </td>
                      <td style={{ ...td(true), color: C.dim }}>
                        {weightedAvgSf != null && totalUnits > 0 && totalGprAnnual > 0
                          ? `$${(totalGprAnnual / totalUnits / 12 / weightedAvgSf).toFixed(2)}`
                          : '—'}
                      </td>
                      <td style={{ ...td(true), color: C.muted }}>
                        {totalMarketGprAnnual > 0 && totalUnits > 0 ? fmt$(Math.round(totalMarketGprAnnual / totalUnits / 12)) : '—'}/mo
                      </td>
                      <td style={{ ...td(true), fontWeight: 700, color: totalLtl > 0 ? C.red : C.muted }}>
                        {totalLtl > 0 ? `(${fmt$(totalLtl)})` : '—'}
                      </td>
                      <td style={{ ...td(true), fontWeight: 700, color: weightedOcc != null && weightedOcc >= 0.90 ? C.green : weightedOcc != null && weightedOcc >= 0.80 ? C.amber : C.red }}>
                        {fmtPct(weightedOcc)}
                      </td>
                      <td style={td(false)}>
                        <ExpirationBars
                          curve={data?.rentRollSummary?.expirationCurve ?? null}
                          totalUnits={totalUnits}
                          status={data?.rentRollSummary?.expirationExtractionStatus ?? null}
                        />
                      </td>
                      <td style={{ ...td(true), fontWeight: 700, color: C.green }}>{fmt$(totalGprAnnual)}</td>
                      <td style={td()} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* GPR → ProForma link */}
              <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}`, background: C.greenDim, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
                  <span style={{ fontFamily: LABEL, fontSize: 9, color: C.green }}>ANNUAL GPR → FINANCIAL ENGINE (F9 PRO FORMA)</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: C.green }}>{fmt$(totalGprAnnual)}</span>
              </div>
            </div>
          )}

          {/* ── Other Income summary link (Task #1145) ──
              AncillaryPanel moved to its own OTHER INCOME sub-tab.
              Show a compact one-liner that deep-links there. */}
          {(() => {
            const breakdown      = data?.otherIncomeBreakdown ?? null;
            const userLines      = data?.otherIncomeUserLines ?? [];
            const userLinesAnnual= userLines.reduce((s, l) => s + l.monthly * 12, 0);
            const grandTotal     = (breakdown?.total.resolved ?? 0) + userLinesAnnual;
            const hasAnySource   = !!breakdown && (
              breakdown.total.rent_roll != null ||
              breakdown.total.t12 != null ||
              breakdown.total.om != null ||
              breakdown.rows.some(r =>
                r.rent_roll != null || r.t12 != null || r.om != null || r.resolved != null
              )
            );
            if (!hasAnySource && userLines.length === 0) return null;
            return (
              <div
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('fe-console-subtab', { detail: { subTab: 'otherincome' } })
                  )
                }
                style={{
                  marginTop: 12,
                  background: C.amberDim,
                  border: `1px solid ${C.amber}44`,
                  borderRadius: 6,
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.amber; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${C.amber}44`; }}
                title="Open OTHER INCOME sub-tab"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber }} />
                  <span style={{ fontFamily: LABEL, fontSize: 9, color: C.amber, fontWeight: 700 }}>
                    OTHER INCOME
                  </span>
                  <span style={{ fontFamily: LABEL, fontSize: 8, color: C.dim }}>
                    {userLines.length > 0 ? `${breakdown?.rows.length ?? 0} categories + ${userLines.length} custom line${userLines.length !== 1 ? 's' : ''}` : `${breakdown?.rows.length ?? 0} categories`}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.amber }}>
                    {fmt$(grandTotal)}/yr
                  </span>
                  <span style={{ fontFamily: LABEL, fontSize: 9, color: C.amber, opacity: 0.7 }}>→</span>
                </div>
              </div>
            );
          })()}

          {/* ── Value-Add Renovation Upside ── */}
          {isValueAdd && unitMix.length > 0 && (
            <div style={{ background: C.panel, border: `1px solid ${C.purple}44`, borderRadius: 6, overflow: 'hidden', marginTop: 12 }}>
              <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, background: '#1a0a2a' }}>
                <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.purple, letterSpacing: '0.06em' }}>RENOVATION UPSIDE — FLOOR PLAN PRIORITY RANKING</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.panelAlt }}>
                    <th style={th()}>FLOOR PLAN</th>
                    <th style={th(true)}>UNITS</th>
                    <th style={th(true)}>IN-PLACE</th>
                    <th style={th(true)}>MARKET</th>
                    <th style={th(true)}>PREMIUM/UNIT</th>
                    <th style={th(true)}>ANNUAL UPSIDE</th>
                    <th style={th(true)}>PRIORITY</th>
                  </tr>
                </thead>
                <tbody>
                  {[...unitMix]
                    .map(u => ({
                      ...u,
                      premium: (getMarketRent(u) ?? 0) - (getEffectiveRent(u) ?? 0),
                      annualUpside: u.count * ((getMarketRent(u) ?? 0) - (getEffectiveRent(u) ?? 0)) * 12,
                    }))
                    .filter(u => u.premium > 0)
                    .sort((a, b) => b.premium - a.premium)
                    .map((u, idx) => (
                      <tr key={u.type} style={{ background: idx % 2 === 0 ? C.panel : C.panelAlt }}>
                        <td style={{ ...td(), fontWeight: 700, color: C.purple }}>{u.type}</td>
                        <td style={td(true)}>{u.count}</td>
                        <td style={td(true)}>{fmt$(getEffectiveRent(u))}</td>
                        <td style={td(true, false, C.amber)}>{fmt$(getMarketRent(u))}</td>
                        <td style={td(true, true, C.green)}>+{fmt$(u.premium)}/mo</td>
                        <td style={td(true, false, C.green)}>{fmt$(u.annualUpside)}</td>
                        <td style={{ ...td(true) }}>
                          <span style={{ fontFamily: LABEL, fontSize: 7, fontWeight: 700, color: idx === 0 ? C.cyan : idx <= 2 ? C.green : C.amber, background: idx === 0 ? C.cyanDim : idx <= 2 ? C.greenDim : C.amberDim, border: `1px solid ${idx === 0 ? C.cyan : idx <= 2 ? C.green : C.amber}44`, borderRadius: 3, padding: '2px 6px' }}>
                            {idx === 0 ? '★ TOP' : idx <= 2 ? 'HIGH' : 'MED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── RIGHT: Traffic Absorption Engine panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* M07 Absorption Engine */}
          <div style={{ background: C.panel, border: hasTraffic ? `1px solid ${C.cyan}44` : `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, background: hasTraffic ? C.cyanDim : C.panelAlt, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={12} color={hasTraffic ? C.cyan : C.muted} />
              <div>
                <div style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: hasTraffic ? C.cyan : C.muted, letterSpacing: '0.06em' }}>M07 TRAFFIC ENGINE · ABSORPTION</div>
                <div style={{ fontFamily: LABEL, fontSize: 7, color: C.dim }}>linked from F6 Traffic module</div>
              </div>
              {hasTraffic && <Zap size={10} color={C.cyan} style={{ marginLeft: 'auto' }} />}
            </div>
            <div style={{ padding: '10px 12px' }}>
              <TrafficSignal label="T01 WEEKLY TOURS" value={ls?.t01WeeklyTours != null ? ls.t01WeeklyTours.toFixed(1) : '—'} unit="/wk" linked={ls?.t01WeeklyTours != null} />
              <TrafficSignal label="T05 CAPTURE RATE" value={ls?.t05ClosingRatio != null ? `${(ls.t05ClosingRatio * 100).toFixed(1)}` : '—'} unit="%" linked={ls?.t05ClosingRatio != null} />
              <TrafficSignal label="T06 NET LEASES" value={weeklyLeases != null ? weeklyLeases.toFixed(1) : '—'} unit="/wk" linked={weeklyLeases != null} />
              <TrafficSignal label="T07 LEASE-UP TO 95%" value={leaseUpWeeks != null ? leaseUpWeeks.toFixed(0) : '—'} unit="wks" linked={leaseUpWeeks != null} />
            </div>
            {!hasTraffic && (
              <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}`, background: '#0a0a10' }}>
                <div style={{ fontFamily: LABEL, fontSize: 8, color: C.dim, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Info size={10} />
                  Configure traffic data in F6 to activate absorption signals
                </div>
              </div>
            )}
          </div>

          {/* 5-Step EGI Waterfall */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: '0.06em' }}>EGI WATERFALL</span>
            </div>
            <div style={{ padding: 12 }}>
              {(() => {
                const vacancyLoss    = physicalVacancy != null && totalMarketGprAnnual > 0 ? physicalVacancy * totalMarketGprAnnual : null;
                const badDebtPct     = 0.01;
                const gri            = totalMarketGprAnnual > 0 && vacancyLoss != null ? totalMarketGprAnnual - totalLtl - vacancyLoss : null;
                const badDebtLoss    = gri != null ? gri * badDebtPct : null;
                const concessionPct  = unitMix.reduce((s, u) => s + (u.concessionPct ?? 0) * u.count, 0) / Math.max(totalUnits, 1);
                const concessionLoss = totalMarketGprAnnual > 0 ? concessionPct * totalMarketGprAnnual : null;
                // Ancillary feeds EGI from the multi-source seeder
                // reconciliation (Task #519): RESOLVED per-category totals
                // (RR-preferred, OM-fallback, T-12 aggregate when both
                // empty) plus any user-added custom lines. This matches the
                // Pro Forma tab's EGI exactly; the previous rent-roll-only
                // read undercounted EGI on OM- or T-12-backed deals.
                const breakdown = data?.otherIncomeBreakdown ?? null;
                const userLinesAnnual = (data?.otherIncomeUserLines ?? [])
                  .reduce((s, l) => s + l.monthly * 12, 0);
                const ancillaryTotal = (breakdown?.total.resolved ?? 0) + userLinesAnnual;
                // Presence-based: a source is "real" when the seeder
                // returned a non-null figure for it, even if that figure is
                // $0. Mirrors the panel's visibility gate so the EGI label
                // ("no rent roll") stays consistent with what the user sees.
                const hasRealAnc = breakdown != null && (
                  breakdown.total.rent_roll != null ||
                  breakdown.total.t12 != null ||
                  breakdown.total.om != null ||
                  breakdown.rows.some(r =>
                    r.rent_roll != null || r.t12 != null || r.om != null || r.resolved != null
                  ) ||
                  (data?.otherIncomeUserLines ?? []).length > 0
                );
                const egi = gri != null && badDebtLoss != null
                  ? gri - (concessionLoss ?? 0) - badDebtLoss + ancillaryTotal
                  : null;

                const rows = [
                  { label: 'MARKET GPR',        value: fmt$(totalMarketGprAnnual > 0 ? totalMarketGprAnnual : null), color: C.amber,  sign: '' },
                  { label: '– LOSS-TO-LEASE',   value: totalLtl > 0 ? `(${fmt$(totalLtl)})` : '—', color: C.red, sign: `${fmtPct(totalMarketGprAnnual > 0 ? totalLtl / totalMarketGprAnnual : null)}` },
                  { label: '– PHYSICAL VACANCY',value: vacancyLoss != null ? `(${fmt$(vacancyLoss)})` : '—', color: C.red, sign: physicalVacancy != null ? fmtPct(physicalVacancy) : '' },
                  { label: '– BAD DEBT (1%)',   value: badDebtLoss != null ? `(${fmt$(badDebtLoss)})` : '—', color: C.red, sign: '1.0%' },
                  { label: '– CONCESSIONS',     value: concessionLoss != null && concessionLoss > 0 ? `(${fmt$(concessionLoss)})` : '—', color: C.red, sign: concessionPct > 0 ? fmtPct(concessionPct) : '' },
                  { label: '+ ANCILLARY INCOME',value: hasRealAnc ? fmt$(ancillaryTotal) : '—', color: hasRealAnc ? C.amber : C.dim, sign: hasRealAnc ? '' : 'no rent roll' },
                  { label: '= EGI',             value: fmt$(egi), color: C.green, sign: '', bold: true },
                ];

                return rows.map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : undefined }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontFamily: LABEL, fontSize: 9, color: i === rows.length - 1 ? C.text : C.muted, fontWeight: i === rows.length - 1 ? 700 : 400 }}>{row.label}</span>
                      {row.sign && <span style={{ fontFamily: LABEL, fontSize: 7, color: C.dim }}>{row.sign}</span>}
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: (row as any).bold ? 700 : 400, color: row.color }}>{row.value}</span>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Lease-Up Timeline */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: '0.06em' }}>LEASE-UP TIMELINE</span>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'CURRENT OCC.', value: fmtPct(currentOcc), color: currentOcc >= 0.90 ? C.green : currentOcc >= 0.80 ? C.amber : C.red },
                { label: 'VACANT UNITS', value: vacantUnits > 0 ? String(vacantUnits) : '0', color: C.muted },
                { label: 'STABILIZED TARGET', value: fmtPct(1 - stabilizedVac), color: C.green },
                { label: 'UNITS TO STABILIZE', value: fmtNum(Math.max(0, Math.round((1 - stabilizedVac - currentOcc) * totalUnits))), color: C.amber },
                { label: 'VELOCITY', value: weeklyLeases != null ? `${weeklyLeases.toFixed(1)}/wk` : '—', color: hasTraffic ? C.cyan : C.dim },
                { label: 'EXP. LEASE-UP', value: leaseUpMonths != null ? `${leaseUpMonths} months` : '—', color: hasTraffic ? C.purple : C.dim },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: LABEL, fontSize: 9, color: C.muted }}>{row.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: row.color }}>{row.value}</span>
                </div>
              ))}
              {totalUnits > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: LABEL, fontSize: 7, color: C.dim }}>NOW {fmtPct(currentOcc)}</span>
                    <span style={{ fontFamily: LABEL, fontSize: 7, color: C.dim }}>TARGET {fmtPct(1 - stabilizedVac)}</span>
                  </div>
                  <div style={{ height: 6, background: C.panelAlt, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(currentOcc * 100, 100)}%`, background: currentOcc >= 0.90 ? C.green : currentOcc >= 0.80 ? C.amber : C.red, borderRadius: 3, transition: 'width 0.4s ease' }} />
                    <div style={{ position: 'absolute', left: `${(1 - stabilizedVac) * 100}%`, top: 0, height: '100%', width: 1, background: C.green, opacity: 0.5 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: hasTraffic ? C.cyan : C.dim }} />
                    <span style={{ fontFamily: LABEL, fontSize: 7, color: C.dim }}>
                      {hasTraffic ? 'Velocity sourced from M07 traffic engine (F6)' : 'Link M07 traffic data to get velocity projections'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Deal type badge */}
          <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px' }}>
            <div style={{ fontFamily: LABEL, fontSize: 8, color: C.dim, marginBottom: 6 }}>DEAL TYPE MODE</div>
            {[
              { id: 'existing',      label: 'EXISTING · STABILIZED',   desc: 'Rent roll extracted, in-place analytics active' },
              { id: 'redevelopment', label: 'VALUE-ADD · RENOVATION',  desc: 'Upside ranking + renovation tracker active' },
              { id: 'development',   label: 'GROUND-UP · DEVELOPMENT', desc: 'Target program + absorption ramp active' },
            ].map(dt => {
              const active = (dt.id === 'existing' && isExisting) || (dt.id === 'redevelopment' && isValueAdd) || (dt.id === 'development' && isDevelopment);
              return (
                <div key={dt.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: active ? C.cyan : C.dim, marginTop: 3, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontFamily: LABEL, fontSize: 8, fontWeight: 700, color: active ? C.cyan : C.dim }}>{dt.label}</div>
                    <div style={{ fontFamily: LABEL, fontSize: 7, color: C.dim }}>{dt.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Add / Edit Unit Type Modal ── */}
      {showAddModal && (
        <AddEditUnitTypeModal
          initial={editingType}
          allTypes={localTypes}
          targetUnits={targetUnits ?? m03TargetUnits}
          onClose={() => { setShowAddModal(false); setEditingType(null); }}
          onSave={(updated: ManualUnitType) => {
            const next = localTypes.some(t => t._id === updated._id)
              ? localTypes.map(t => t._id === updated._id ? updated : t)
              : [...localTypes, updated];
            setLocalTypes(next);
            setShowAddModal(false);
            setEditingType(null);
            void saveTypes(next);
          }}
        />
      )}

      {/* ── Confirm Delete Dialog ── */}
      {pendingDelete && (
        <ConfirmDeleteDialog
          label={pendingDelete.type}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const next = localTypes.filter(t => t._id !== pendingDelete!._id && t.type !== pendingDelete!.type);
            setPendingDelete(null);
            void saveTypes(next);
          }}
        />
      )}
    </div>
    </>
  );
}
