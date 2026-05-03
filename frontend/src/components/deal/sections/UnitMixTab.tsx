import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  RefreshCw, Loader2, Activity, TrendingUp, TrendingDown, Minus,
  Info, Zap, Edit3, Check, X, AlertTriangle, ChevronDown, ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { BT } from '../bloomberg-ui';
import { apiClient } from '../../../services/api.client';
import { useDealType } from '../../../stores/dealStore';
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
function ExpirationBars({
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
      <td colSpan={11} style={{ padding: 0 }}>
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

interface AncillaryLine {
  key: string;
  label: string;
  qty: number;
  price: number;
  occupancy: number;
  note: string;
}

/**
 * Default ancillary template — used as a last-resort fallback ONLY when no
 * rent-roll extraction is available. When `otherIncomeMonthly` is present,
 * `realAncillaryFromExtraction` is preferred so the user sees their actual
 * pet / parking / RUBS / fee dollars instead of synthetic estimates.
 */
function makeDefaultAncillary(u: number): AncillaryLine[] {
  return [
    { key: 'pet',      label: 'Pet Rent',                    qty: u,                       price: 27.50,  occupancy: 0.30, note: 'Est. 30% of units' },
    { key: 'garage',   label: 'Garage / Parking',            qty: Math.round(u * 0.111),   price: 142.50, occupancy: 1.00, note: '~1 garage per 9 units' },
    { key: 'storage',  label: 'Storage',                     qty: Math.round(u * 0.083),   price: 50.00,  occupancy: 1.00, note: '~1 storage per 12 units' },
    { key: 'rubs',     label: 'RUBS / Utilities',            qty: u,                       price: 65.00,  occupancy: 1.00, note: 'All units' },
    { key: 'revshare', label: 'Revenue Sharing (Internet)',  qty: u,                       price: 85.00,  occupancy: 0.95, note: '95% of units' },
    { key: 'valet',    label: 'Valet Trash',                 qty: u,                       price: 30.00,  occupancy: 0.95, note: '95% of units' },
    { key: 'admin',    label: 'Admin / App Fees',            qty: u,                       price: 27.00,  occupancy: 0.65, note: 'Est. 65% of units' },
    { key: 'late',     label: 'Late / NSF / Termination',   qty: u,                       price: 5.00,   occupancy: 1.00, note: 'All units' },
    { key: 'damages',  label: 'Damages',                     qty: u,                       price: 2.44,   occupancy: 1.00, note: 'All units' },
    { key: 'other',    label: 'Other Income',                qty: u,                       price: 7.00,   occupancy: 1.00, note: 'All units' },
  ];
}

/** Pretty labels for the parser's `other_income_monthly` keys. */
const ANCILLARY_LABELS: Record<string, string> = {
  parking: 'Parking',
  pet_rent: 'Pet Rent',
  storage: 'Storage',
  rubs: 'RUBS / Utilities',
  fees: 'Admin / App Fees',
  insurance_admin: 'Insurance Admin',
  concessions_other: 'Concessions / Other',
  other: 'Other Income',
};

/**
 * Convert `extraction_rent_roll.other_income_monthly` (real $/month figures
 * the parser pulled from rent-roll charge codes) into the AncillaryLine row
 * shape. The total-monthly is preserved exactly: qty=1, occ=1, price=monthly.
 * EVERY parser-defined line is emitted — including explicit $0 — so the user
 * can distinguish "the rent roll has a Pet Rent column with zero charges
 * this period" from "Pet Rent was never tracked." Missing fields aren't here
 * to begin with; zero means the data was present and was zero.
 */
function realAncillaryFromExtraction(otherIncomeMonthly: Record<string, number>): AncillaryLine[] {
  return Object.entries(otherIncomeMonthly).map(([key, amt]) => ({
    key,
    label: ANCILLARY_LABELS[key] ?? key.replace(/_/g, ' '),
    qty: 1,
    price: amt,
    occupancy: 1,
    note: amt === 0 ? 'Zero — present in rent roll but no charges' : 'Per rent-roll charge codes',
  }));
}

/**
 * Renders the ancillary income breakdown.
 *
 * Visibility contract: the panel is rendered ONLY when an
 * extraction_rent_roll capsule is available (i.e. the user has uploaded and
 * processed a rent roll). When `otherIncomeMonthly` is null the parent
 * suppresses this component entirely — we never fall back to synthetic
 * estimates, because broker-published OM ancillary is too unreliable to
 * silently feed into EGI.
 */
function AncillaryPanel({
  totalUnits,
  otherIncomeMonthly,
}: {
  totalUnits: number;
  otherIncomeMonthly: Record<string, number>;
}) {
  const [lines, setLines] = useState<AncillaryLine[]>(() => realAncillaryFromExtraction(otherIncomeMonthly));

  // Refresh lines when the underlying data source updates (e.g. user re-uploads
  // a rent roll mid-session). Without this the rows would stay frozen.
  useEffect(() => {
    setLines(realAncillaryFromExtraction(otherIncomeMonthly));
  }, [otherIncomeMonthly]);

  const [editingKey, setEditingKey] = useState<{ key: string; field: 'qty' | 'price' | 'occ'; val: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const totalMonthly = lines.reduce((s, l) => s + l.qty * l.price * l.occupancy, 0);
  const totalAnnual  = totalMonthly * 12;

  const commit = () => {
    if (!editingKey) return;
    const num = parseFloat(editingKey.val);
    if (isNaN(num)) { setEditingKey(null); return; }
    setLines(prev => prev.map(l => {
      if (l.key !== editingKey.key) return l;
      if (editingKey.field === 'qty')   return { ...l, qty: Math.max(0, Math.round(num)) };
      if (editingKey.field === 'price') return { ...l, price: Math.max(0, num) };
      return { ...l, occupancy: Math.min(1, Math.max(0, num / 100)) };
    }));
    setEditingKey(null);
  };

  function EditCell({ lineKey, field, display, color }: { lineKey: string; field: 'qty' | 'price' | 'occ'; display: string; color?: string }) {
    const isEditing = editingKey?.key === lineKey && editingKey.field === field;
    if (isEditing) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <input autoFocus type="number" value={editingKey.val}
            onChange={e => setEditingKey({ ...editingKey, val: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditingKey(null); }}
            style={{ width: field === 'qty' ? 56 : field === 'occ' ? 48 : 64, background: C.panelAlt, border: `1px solid ${C.cyan}`, borderRadius: 3, color: C.cyan, fontFamily: MONO, fontSize: 10, padding: '2px 4px', textAlign: 'right' }}
          />
          <button onClick={commit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, padding: 0 }}><Check size={10} /></button>
          <button onClick={() => setEditingKey(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 0 }}><X size={10} /></button>
        </div>
      );
    }
    const line = lines.find(l => l.key === lineKey)!;
    const rawVal = field === 'qty' ? String(line.qty) : field === 'price' ? String(line.price) : String((line.occupancy * 100).toFixed(0));
    return (
      <div onClick={() => setEditingKey({ key: lineKey, field, val: rawVal })}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, cursor: 'pointer' }}>
        <span style={{ color: color ?? C.text }}>{display}</span>
        <Edit3 size={8} color={C.dim} />
      </div>
    );
  }

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', marginTop: 12 }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ padding: '8px 12px', borderBottom: collapsed ? undefined : `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        {collapsed ? <ChevronRight size={12} color={C.muted} /> : <ChevronDown size={12} color={C.muted} />}
        <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: '0.06em' }}>ANCILLARY INCOME BREAKDOWN</span>
        <span style={{ fontFamily: LABEL, fontSize: 8, color: C.dim, marginLeft: 4 }}>click cells to edit qty · price · occupancy</span>
        <span
          style={{
            fontFamily: LABEL, fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
            padding: '2px 6px', borderRadius: 3,
            background: `${C.green}22`,
            color: C.green,
            border: `1px solid ${C.green}55`,
          }}
          title="Sourced from rent-roll charge codes"
        >
          RENT ROLL
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber, marginLeft: 'auto' }}>{fmt$(totalAnnual)}/yr</span>
      </div>

      {!collapsed && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.panelAlt }}>
                  <th style={th()}>INCOME TYPE</th>
                  <th style={th(true)}>QTY</th>
                  <th style={th(true)}>$/MO</th>
                  <th style={th(true)}>OCC %</th>
                  <th style={th(true)}>TOTAL/MO</th>
                  <th style={th(true)}>TOTAL/YR</th>
                  <th style={th()}>NOTE</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => {
                  const monthlyTotal = l.qty * l.price * l.occupancy;
                  const annualTotal  = monthlyTotal * 12;

                  return (
                    <tr key={l.key} style={{ background: idx % 2 === 0 ? C.panel : C.panelAlt }}>
                      <td style={{ ...td(), color: C.cyan, fontWeight: 700 }}>{l.label}</td>

                      <td style={{ ...td(true), position: 'relative' }}>
                        <EditCell lineKey={l.key} field="qty" display={String(l.qty)} color={C.text} />
                      </td>

                      <td style={{ ...td(true), position: 'relative' }}>
                        <EditCell lineKey={l.key} field="price" display={`$${l.price.toFixed(2)}`} color={C.text} />
                      </td>

                      <td style={{ ...td(true), position: 'relative' }}>
                        <EditCell lineKey={l.key} field="occ" display={`${(l.occupancy * 100).toFixed(0)}%`} color={C.muted} />
                      </td>

                      <td style={td(true, false, C.text)}>{fmt$(monthlyTotal)}</td>
                      <td style={td(true, false, C.amber)}>{fmt$(annualTotal)}</td>
                      <td style={{ ...td(), color: C.dim, fontSize: 8 }}>{l.note}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#050a0f', borderTop: `2px solid ${C.borderHi}` }}>
                  <td style={{ ...td(), fontWeight: 700, color: C.text }}>TOTAL ANCILLARY</td>
                  <td colSpan={3} />
                  <td style={{ ...td(true), fontWeight: 700, color: C.amber }}>{fmt$(totalMonthly)}/mo</td>
                  <td style={{ ...td(true), fontWeight: 700, color: C.amber }}>{fmt$(totalAnnual)}/yr</td>
                  <td style={{ ...td(), color: C.dim, fontSize: 8 }}>{((totalAnnual / Math.max(totalUnits * 12, 1))).toFixed(0)}/unit/yr</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ padding: '8px 12px', background: C.amberDim, borderTop: `1px solid ${C.amber}33`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.amber }} />
              <span style={{ fontFamily: LABEL, fontSize: 9, color: C.amber }}>ANCILLARY INCOME → FINANCIAL ENGINE (F9 EGI)</span>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.amber }}>{fmt$(totalAnnual)}</span>
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
                Re-export the rent roll in the standard Yardi RRwLC layout (the only currently supported export format) or verify the affected columns before relying on these figures for underwriting.
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
          <div style={{ background: C.greenDim, border: `1px solid ${C.green}33`, borderRadius: 6, padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={13} color={C.green} />
            <span style={{ fontFamily: LABEL, fontSize: 9, color: C.green }}>
              THIS TABLE IS THE SINGLE SOURCE OF TRUTH FOR PROFORMA GPR — edits here propagate to the Financial Engine (F9)
            </span>
          </div>

          {unitMix.length === 0 ? (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: 32, textAlign: 'center' }}>
              <div style={{ fontFamily: LABEL, fontSize: 10, color: C.muted, marginBottom: 6 }}>NO UNIT MIX DATA</div>
              <div style={{ fontFamily: LABEL, fontSize: 9, color: C.dim }}>Upload and process a rent roll document to populate unit mix</div>
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
              </div>
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

          {/* ── Ancillary Income Breakdown ──
              Hidden entirely without a rent-roll extraction. We deliberately
              do NOT show synthetic per-unit estimates here; ancillary income
              published by the broker (OM) is too unreliable to silently feed
              into EGI. */}
          {data?.extractionRentRoll?.otherIncomeMonthly && (
            <AncillaryPanel
              totalUnits={totalUnits}
              otherIncomeMonthly={data.extractionRentRoll.otherIncomeMonthly}
            />
          )}

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
                // Ancillary feeds EGI only when sourced from a real rent-roll
                // extraction. We do NOT pad EGI with synthetic per-unit
                // benchmarks — broker/OM-only deals get $0 here so the user
                // sees an honest "ancillary unknown" instead of a fabricated
                // line item. Mirrors AncillaryPanel's visibility contract.
                const realAncMonthly = data?.extractionRentRoll?.otherIncomeMonthly ?? null;
                const ancillaryTotal = realAncMonthly
                  ? Object.values(realAncMonthly).reduce((s, v) => s + (v > 0 ? v : 0), 0) * 12
                  : 0;
                const hasRealAnc = realAncMonthly != null;
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
    </div>
  );
}
