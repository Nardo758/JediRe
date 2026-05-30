// ============================================================================
// ValidationGridTab — F9 Console · Assumption Validation Grid
// Task #1274
//
// Shows all key underwriting assumptions alongside:
//   - Confidence level (High / Medium / Low), sourced from evidence metadata
//     where available, otherwise derived from quality band.
//   - Source (who/what produced the value)
//   - Validation method (how it was verified)
//   - Quality badge (STRONG / WATCH / WEAK / UNVALIDATED)
//   - Platform baseline comparison for every operator override
//   - Comp count + median for comp-validated assumptions (exit cap)
//
// Read-only display — edits happen in DEAL TERMS, INPUTS, or DEBT tabs.
//
// Data sources:
//   props.f9Financials        — current resolved values from the F9 engine
//   props.assumptions         — ModelAssumptions (local build state)
//   props.evidenceFieldMap    — per-field confidence/tier from evidence system
//   GET /assumptions          — raw DB row: source_type, per_year_overrides
//   GET /implied-cap-rate     — platform-implied cap + comp set median
// ============================================================================

import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { apiClient } from '../../../services/api.client';
import { ContestedBadge } from './SourceBadge';
import type { FinancialEngineTabProps, EvidenceFieldMeta } from './types';

const MONO = BT.font.mono;

// ── Types ──────────────────────────────────────────────────────────────────────

type QualityBand    = 'STRONG' | 'WATCH' | 'WEAK' | 'UNVALIDATED';
type ConfidenceLevel = 'high' | 'medium' | 'low' | null;

// ── DivergenceSignature — mirrors backend type (field-access/get-field-value.service.ts) ──

interface DivergencePoint {
  layer: string;
  label: string;
  value: number;
}

interface DivergenceSignature {
  points: DivergencePoint[];
  maxAbsDelta: number;
  alertLevel: 'none' | 'info' | 'warn' | 'block';
  exceeds: boolean;
  threshold: number;
  fieldName: string;
  unit: string;
  isPct: boolean;
}

// ── Override impact signal ─────────────────────────────────────────────────────
//
// Shown as a compact inline badge in the CURRENT VALUE cell for any row that has
// both isOverride=true AND a resolvable platform baseline.
//
// Banding (based on |deltaPct| from baseline):
//   ≤ 10%  → INFO  (cyan border)
//   10-25% → INFO  (cyan, slightly bolder)
//   > 25%  → CAUTION (amber border, prominent)
//
// IRR estimates are rule-of-thumb sensitivities for typical 5-7yr levered
// multifamily. Labeled "(est.)" so operators know they are approximations.
// Sensitivity source: standard partial derivative relationships for going-in
// NOI capitalisation with moderate leverage (60-70% LTV).

interface OverrideImpact {
  /** % delta from platform baseline (signed) */
  deltaPct: number;
  /** Delta in basis points for rate/growth fields (signed) */
  deltaBps?: number;
  /** Positive = higher IRR expected; negative = lower IRR expected */
  direction: 'positive' | 'negative';
  /** Estimated IRR delta in basis points (signed) — undefined when not estimable */
  estimatedIrrBps?: number;
  /** Severity drives badge colour */
  severity: 'info' | 'caution';
}

interface ValidationRow {
  key: string;
  assumption: string;
  /** Formatted display value (e.g. "$12.5M", "5.25%", "5 YRS") */
  value: string;
  confidence: ConfidenceLevel;
  source: string;
  method: string;
  quality: QualityBand;
  /** Detail line under value — comp range, per-unit, etc. */
  detail?: string;
  /** For overridden rows: the platform / platform-implied baseline for comparison */
  platformBaseline?: string;
  isOverride?: boolean;
  /** Override impact signal — present only when isOverride and baseline known */
  overrideImpact?: OverrideImpact;
  /**
   * Divergence signature — present when ≥2 source layers disagree beyond threshold.
   * Renders a CONTESTED badge in the assumption cell. Sourced either from the
   * /field-divergences API (for LayeredValue fields) or computed inline from
   * ltlSignals (for the LTL row).
   */
  divergenceSignature?: DivergenceSignature;
}

interface ValidationGroup {
  label: string;
  icon: string;
  rows: ValidationRow[];
}

// ── Color maps ─────────────────────────────────────────────────────────────────

const QUALITY_COLOR: Record<QualityBand, string> = {
  STRONG:      '#00D26A',
  WATCH:       BT.text.amber,
  WEAK:        '#FF5252',
  UNVALIDATED: BT.text.muted,
};
const QUALITY_BG: Record<QualityBand, string> = {
  STRONG:      '#00D26A14',
  WATCH:       `${BT.text.amber}14`,
  WEAK:        '#FF525214',
  UNVALIDATED: `${BT.text.muted}14`,
};
const CONFIDENCE_COLOR: Record<string, string> = {
  high:   '#00D26A',
  medium: BT.text.amber,
  low:    '#FF5252',
};

// ── Format helpers ─────────────────────────────────────────────────────────────

function fmtUsd(v: number | null | undefined): string {
  if (v == null || v === 0) return '—';
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtPct(v: number | null | undefined): string {
  return v != null ? `${(v * 100).toFixed(2)}%` : '—';
}
function fmtYrs(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v} YR${v !== 1 ? 'S' : ''}`;
}
function fmtRent(v: number | null | undefined): string {
  if (v == null || v === 0) return '—';
  return `$${Math.round(v).toLocaleString()}/mo`;
}

// ── Source label map ───────────────────────────────────────────────────────────

const SOURCE_MAP: Record<string, string> = {
  manual:              'Operator Input',
  user:                'Operator Input',
  override:            'Operator Override',
  broker:              'Broker OM',
  agent:               'Agent Derived',
  platform:            'Platform Default',
  computed:            'Platform Computed',
  'tier1:t12':         'T-12 Document',
  'tier1:rent_roll':   'Rent Roll',
  'tier1:tax_bill':    'Tax Bill',
  'tier3:platform':    'Platform Benchmark',
  'tier3:market_comp': 'Market Comps',
  'strategy:entry':    'Strategy Module',
  'strategy:exit':     'Strategy Module',
  goal_seek:           'Goal Seek',
  event_timeline:      'Event Timeline',
};
function srcLabel(s: string | null | undefined): string {
  if (!s) return 'Platform Default';
  return SOURCE_MAP[s] ?? s;
}

// ── per_year_overrides module-source lookup ────────────────────────────────────

function pyoSrc(pyo: Record<string, any> | null, fieldPath: string): string | null {
  if (!pyo) return null;
  const meta = pyo[`module:source:${fieldPath}`];
  if (!meta) return null;
  return meta.source === 'user' ? 'Operator Override' : srcLabel(meta.source);
}

// ── Confidence derivation ──────────────────────────────────────────────────────

/**
 * Derive confidence from the evidence field map (preferred) or fall back to
 * quality band (STRONG → high, WATCH → medium, WEAK | UNVALIDATED → low).
 */
function deriveConfidence(
  quality: QualityBand,
  evidenceKey: string | null,
  evidenceFieldMap?: Record<string, EvidenceFieldMeta>,
): ConfidenceLevel {
  if (evidenceKey && evidenceFieldMap?.[evidenceKey]) {
    const raw = evidenceFieldMap[evidenceKey].confidence;
    if (raw === 'high' || raw === 'medium' || raw === 'low') return raw;
  }
  if (quality === 'STRONG')      return 'high';
  if (quality === 'WATCH')       return 'medium';
  if (quality === 'WEAK')        return 'low';
  return 'low';
}

// ── Override impact computation ────────────────────────────────────────────────
//
// Rule-of-thumb IRR sensitivities for levered multifamily (5-7yr hold, ~65% LTV).
//   exit_cap:       each +1 bps exit cap → approx −2.5 bps levered IRR
//   rent_growth_y1: each +1 bps rent growth → approx +1.8 bps levered IRR
//   stab_occ:       each +1 pp occupancy → approx +12 bps levered IRR
//   interest_rate:  each +1 bps rate → approx −2.0 bps levered IRR
//   selling_costs:  directional only (depends heavily on exit value — no coefficient)
//   hold_period:    directional only (non-linear, IRR shape varies by deal)
//   ltv:            directional only (leverage amplification — no linear coefficient)
//
// All estimated IRR values are labeled "(est.)" in the badge.

type SensitivityKey = 'exit_cap' | 'rent_growth_y1' | 'stab_occ' | 'interest_rate';
const SENSITIVITY_BPS: Record<SensitivityKey, { irrBpsPerInputBps: number; higherIsBetter: boolean }> = {
  exit_cap:        { irrBpsPerInputBps: 2.5,  higherIsBetter: false },
  rent_growth_y1:  { irrBpsPerInputBps: 1.8,  higherIsBetter: true },
  stab_occ:        { irrBpsPerInputBps: 0.12, higherIsBetter: true },  // per-bps (occ in 0–1 scale → ×10000)
  interest_rate:   { irrBpsPerInputBps: 2.0,  higherIsBetter: false },
};

/**
 * Compute the override impact signal for a row that has a platform baseline.
 *
 * @param fieldKey     Key matching SENSITIVITY_BPS for IRR estimation
 * @param operator     Current operator value (decimal, e.g. 0.055 for 5.5%)
 * @param baseline     Platform baseline value (same unit)
 * @param preComputedDeltaBps  Optional pre-computed delta in bps (e.g. from implied-cap endpoint)
 * @param higherIsBetterOverride  Override the direction from SENSITIVITY_BPS
 */
function computeOverrideImpact(
  fieldKey: string,
  operator: number,
  baseline: number,
  preComputedDeltaBps?: number | null,
  higherIsBetterOverride?: boolean,
): OverrideImpact | undefined {
  if (baseline === 0) return undefined;
  const deltaPct = ((operator - baseline) / Math.abs(baseline)) * 100;
  if (Math.abs(deltaPct) < 0.5) return undefined;   // sub-0.5% — too small to surface

  const severity: 'info' | 'caution' = Math.abs(deltaPct) > 25 ? 'caution' : 'info';
  const sens = SENSITIVITY_BPS[fieldKey as SensitivityKey];
  const higherIsBetter = higherIsBetterOverride ?? sens?.higherIsBetter ?? true;
  const direction: 'positive' | 'negative' = (deltaPct > 0) === higherIsBetter ? 'positive' : 'negative';

  let estimatedIrrBps: number | undefined;
  let deltaBps: number | undefined;

  if (sens) {
    // Convert operator delta to basis points (values are in 0-1 decimal scale, so ×10000)
    const rawDeltaBps = preComputedDeltaBps ?? Math.round((operator - baseline) * 10000);
    deltaBps = rawDeltaBps;
    // IRR impact = |deltaBps| × coefficient, sign follows higherIsBetter direction
    const irrMagnitude = Math.round(Math.abs(rawDeltaBps) * sens.irrBpsPerInputBps);
    estimatedIrrBps = direction === 'positive' ? irrMagnitude : -irrMagnitude;
  } else if (preComputedDeltaBps != null) {
    deltaBps = preComputedDeltaBps;
  }

  return { deltaPct, deltaBps, direction, estimatedIrrBps, severity };
}

// ── Override impact badge ──────────────────────────────────────────────────────

function OverrideImpactBadge({ impact }: { impact: OverrideImpact }) {
  const INFO_COLOR    = '#00C8FF';   // cyan — within normal band
  const CAUTION_COLOR = BT.text.amber;

  const isPos     = impact.direction === 'positive';
  const bandColor = impact.severity === 'caution' ? CAUTION_COLOR : INFO_COLOR;
  const arrow     = isPos ? '▲' : '▼';
  const arrowColor = isPos ? BT.met.financial : BT.text.red;

  // Build delta label: prefer bps for rate/growth fields, fall back to %
  const deltaLabel = impact.deltaBps != null
    ? `${impact.deltaBps > 0 ? '+' : ''}${impact.deltaBps} bps vs baseline`
    : `${impact.deltaPct > 0 ? '+' : ''}${Math.abs(impact.deltaPct).toFixed(0)}% vs baseline`;

  const irrLabel = impact.estimatedIrrBps != null
    ? ` · est. ${impact.estimatedIrrBps > 0 ? '+' : ''}${impact.estimatedIrrBps} bps IRR`
    : '';

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 5px', marginTop: 2,
      border: `1px solid ${bandColor}55`,
      borderRadius: 2,
      background: `${bandColor}0a`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontFamily: MONO, fontSize: 6, color: arrowColor, fontWeight: 700, lineHeight: 1 }}>
        {arrow}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 6.5, color: bandColor, fontWeight: impact.severity === 'caution' ? 700 : 600 }}>
        {deltaLabel}{irrLabel} (est.)
      </span>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function QualityIcon({ q }: { q: QualityBand }) {
  const c = QUALITY_COLOR[q];
  const s = { width: 9, height: 9, color: c, flexShrink: 0 as const };
  if (q === 'STRONG')      return <CheckCircle  style={s} />;
  if (q === 'WATCH')       return <AlertTriangle style={s} />;
  if (q === 'WEAK')        return <AlertCircle   style={s} />;
  return <HelpCircle style={s} />;
}

// ── API response shapes ────────────────────────────────────────────────────────

interface RawAssumptions {
  exit_cap:          number | null;
  hold_period_years: number | null;
  avg_rent_per_unit: number | null;
  vacancy_pct:       number | null;
  opex_ratio:        number | null;
  interest_rate:     number | null;
  ltc:               number | null;
  source_type:       string | null;
  per_year_overrides: Record<string, any> | null;
  exists?: boolean;
}

interface ImpliedCapData {
  implied_cap_rate:      number | null;
  operator_going_in_cap: number | null;
  delta_bps:             number | null;
  positioning_label:     string | null;
  computation_method:    string;
  rent_source:           string | null;
  comp_reported_cap_rate: number | null;
  comp_count:            number | null;
  inputs?: {
    market_rent_per_unit_monthly: number | null;
    vacancy_p50: number | null;
    opex_per_unit_annual: number | null;
  };
}

// ── Platform defaults (used for baseline comparisons on overridden rows) ───────
const PLATFORM_DEFAULTS = {
  holdYears:     5,
  sellingCosts:  0.02,
  rentGrowthY1:  0.03,
  expenseGrowth: 0.03,
  collectionLoss: 0.02,
  occupancy:     0.93,
  ltv:           0.65,
  interestRate:  0.065,
  loanTermYrs:   10,
};

// ── Main component ─────────────────────────────────────────────────────────────

export function ValidationGridTab(props: FinancialEngineTabProps) {
  const fin   = props.f9Financials ?? null;
  const assum = props.assumptions;
  const em    = props.evidenceFieldMap;   // per-field evidence metadata

  const [rawA,            setRawA]            = useState<RawAssumptions | null>(null);
  const [impliedCap,      setImpliedCap]      = useState<ImpliedCapData | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [fieldDivergences, setFieldDivergences] = useState<Record<string, DivergenceSignature>>({});
  const [m07Missing,      setM07Missing]      = useState(false);

  useEffect(() => {
    if (!props.dealId) return;
    apiClient.get<any>(`/api/v1/deals/${props.dealId}/completeness`).then(r => {
      const signals: Array<{ id: string; status: string; acknowledged: boolean }> =
        r?.data?.signals ?? [];
      const m07 = signals.find(s => s.id === 'm07_missing');
      setM07Missing(!!m07 && m07.status !== 'complete' && !m07.acknowledged);
    }).catch(() => { /* non-critical — gating message best-effort */ });
  }, [props.dealId]);

  useEffect(() => {
    if (!props.dealId) return;
    setLoading(true);
    setRawA(null);
    setImpliedCap(null);
    setFieldDivergences({});
    Promise.all([
      apiClient.get<any>(`/api/v1/deals/${props.dealId}/assumptions`).catch(() => null),
      apiClient.get<any>(`/api/v1/deals/${props.dealId}/implied-cap-rate`).catch(() => null),
      apiClient.get<any>(`/api/v1/deals/${props.dealId}/field-divergences`).catch(() => null),
    ]).then(([ar, cr, dr]) => {
      const ad = ar?.data?.data ?? ar?.data;
      if (ad && (ad.deal_id || ad.exists !== undefined)) setRawA(ad);
      const cd = cr?.data?.data;
      if (cd) setImpliedCap(cd);
      const divData: Array<{ fieldName: string; divergence: DivergenceSignature }> =
        dr?.data?.data ?? [];
      if (divData.length > 0) {
        const map: Record<string, DivergenceSignature> = {};
        for (const entry of divData) {
          if (entry.divergence?.exceeds) map[entry.fieldName] = entry.divergence;
        }
        setFieldDivergences(map);
      }
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.dealId]);

  const pyo        = rawA?.per_year_overrides ?? null;
  const hasRawRow  = rawA?.exists !== false;   // false = deal has no assumptions row yet

  // ── Build validation groups ────────────────────────────────────────────────

  const groups: ValidationGroup[] = [];

  // ── ACQUISITION ────────────────────────────────────────────────────────────
  {
    const rows: ValidationRow[] = [];

    // Purchase Price
    // Canonical source: f9Financials.capitalStack.purchasePrice (Engine A output).
    // Fallback to ModelAssumptions only when f9Financials is not yet loaded (loading state).
    const pp     = fin != null
      ? (fin.capitalStack?.purchasePrice ?? null)
      : (assum?.acquisition?.purchasePrice ?? null);
    const ppPyo  = pyoSrc(pyo, 'acquisition.purchasePrice');
    const ppQ: QualityBand =
      pp != null && pp > 0
        ? (ppPyo === 'Operator Override' ? 'WATCH' : 'STRONG')
        : 'UNVALIDATED';
    rows.push({
      key:        'purchase_price',
      assumption: 'Purchase Price',
      value:      fmtUsd(pp),
      confidence: deriveConfidence(ppQ, null, em),
      source:     ppPyo ?? (rawA?.source_type ? srcLabel(rawA.source_type) : 'Not Set'),
      method:     ppPyo ? 'Operator Override' : 'Operator Input',
      quality:    ppQ,
      detail:     pp != null && fin?.capitalStack?.pricePerUnit
        ? `${fmtUsd(fin.capitalStack.pricePerUnit)}/unit`
        : undefined,
      isOverride: ppPyo === 'Operator Override',
    });

    // Going-In Cap Rate (computed from model — no evidence key needed)
    const goingInCap = fin?.returns?.valuation?.multiples?.capRate?.goingIn ?? null;
    const goingInQ: QualityBand = goingInCap != null ? 'STRONG' : 'UNVALIDATED';
    rows.push({
      key:        'going_in_cap',
      assumption: 'Going-In Cap Rate',
      value:      fmtPct(goingInCap),
      confidence: deriveConfidence(goingInQ, null, em),
      source:     goingInCap != null ? 'Computed (NOI ÷ Price)' : 'Not Available',
      method:     'Computed from Model',
      quality:    goingInQ,
    });

    groups.push({ label: 'ACQUISITION', icon: '◇', rows });
  }

  // ── DISPOSITION ────────────────────────────────────────────────────────────
  {
    const rows: ValidationRow[] = [];

    // Exit Cap Rate — core comp-validation row
    // CF-02: canonical source is f9Financials.assumptions.exitCap (Engine A).
    // Fall back to ModelAssumptions only when f9Financials hasn't loaded yet.
    const exitCapVal = fin != null
      ? (fin.assumptions?.exitCap ?? null)
      : (assum?.disposition?.exitCapRate ?? null);
    const exitPyo    = pyoSrc(pyo, 'disposition.exitCapRate');

    let exitQ: QualityBand    = exitCapVal == null ? 'UNVALIDATED' : 'WATCH';
    let exitMethod             = exitPyo ?? 'Operator Input';
    let exitDetail: string | undefined;
    let exitPlatform: string | undefined;
    let exitIsOverride         = exitPyo === 'Operator Override';

    if (impliedCap?.implied_cap_rate != null) {
      const absDelta = Math.abs(impliedCap.delta_bps ?? 0);
      exitMethod     = 'Comparable Sale';

      // Quality band based on delta from platform-implied cap
      if (impliedCap.positioning_label === 'ALIGNED' || absDelta <= 25) {
        exitQ = 'STRONG';
      } else if (absDelta <= 100) {
        exitQ = 'WATCH';
        exitIsOverride = true;
      } else {
        exitQ = 'WEAK';
        exitIsOverride = true;
      }

      // Detail: delta + comp median (range proxy)
      const sign = (impliedCap.delta_bps ?? 0) > 0 ? '+' : '';
      const compPart = impliedCap.comp_reported_cap_rate != null
        ? ` · comp median: ${fmtPct(impliedCap.comp_reported_cap_rate)}${impliedCap.comp_count ? ` (${impliedCap.comp_count} comps)` : ''}`
        : (impliedCap.comp_count ? ` · ${impliedCap.comp_count} comps` : '');
      exitDetail  = `${sign}${impliedCap.delta_bps} bps vs ${fmtPct(impliedCap.implied_cap_rate)} implied${compPart}`;

      // Platform baseline for override comparison
      exitPlatform = `Platform implied: ${fmtPct(impliedCap.implied_cap_rate)}${
        impliedCap.comp_reported_cap_rate
          ? ` · Comp median: ${fmtPct(impliedCap.comp_reported_cap_rate)}`
          : ''
      }`;
    } else if (exitCapVal == null) {
      exitQ = 'UNVALIDATED';
    }

    rows.push({
      key:             'exit_cap',
      assumption:      'Exit Cap Rate',
      value:           fmtPct(exitCapVal),
      confidence:      deriveConfidence(exitQ, null, em),
      source:          exitPyo ?? 'Operator Input',
      method:          exitMethod,
      quality:         exitQ,
      detail:          exitDetail,
      platformBaseline: exitPlatform,
      isOverride:      exitIsOverride,
      overrideImpact:  exitIsOverride && exitCapVal != null && impliedCap?.implied_cap_rate != null
        ? computeOverrideImpact('exit_cap', exitCapVal, impliedCap.implied_cap_rate, impliedCap.delta_bps)
        : undefined,
      divergenceSignature: fieldDivergences['exit_cap'],
    });

    // Hold Period
    // CF-03: canonical source is f9Financials.assumptions.holdYears (Engine A).
    // Fall back to ModelAssumptions only when f9Financials hasn't loaded yet.
    const holdYrs   = fin != null
      ? (fin.assumptions?.holdYears ?? null)
      : (assum?.holdPeriod ?? null);
    const holdPyo   = pyoSrc(pyo, 'hold.holdPeriodYears');
    const holdQ: QualityBand =
      holdYrs != null && holdYrs > 0
        ? (holdPyo === 'Strategy Module' ? 'STRONG' : 'WATCH')
        : hasRawRow ? 'WATCH' : 'UNVALIDATED';
    rows.push({
      key:        'hold_period',
      assumption: 'Hold Period',
      value:      fmtYrs(holdYrs),
      confidence: deriveConfidence(holdQ, null, em),
      source:     holdPyo ?? (holdYrs != null ? 'Operator Input' : 'Platform Default'),
      method:     holdPyo === 'Strategy Module' ? 'Strategy Module'
                : holdYrs != null ? 'Operator Input' : 'Platform Default',
      quality:    holdQ,
      isOverride: holdPyo === 'Operator Override',
      platformBaseline: holdPyo === 'Operator Override' && holdYrs !== PLATFORM_DEFAULTS.holdYears
        ? `Platform default: ${fmtYrs(PLATFORM_DEFAULTS.holdYears)}`
        : undefined,
      overrideImpact: holdPyo === 'Operator Override' && holdYrs != null && holdYrs !== PLATFORM_DEFAULTS.holdYears
        ? computeOverrideImpact('hold_period', holdYrs, PLATFORM_DEFAULTS.holdYears, null, true)
        : undefined,
    });

    // Selling Costs
    const sellCosts = assum?.disposition?.sellingCosts ?? null;
    const sellQ: QualityBand =
      sellCosts != null ? 'WATCH' : hasRawRow ? 'WATCH' : 'UNVALIDATED';
    rows.push({
      key:        'selling_costs',
      assumption: 'Selling Costs %',
      value:      sellCosts != null ? `${(sellCosts * 100).toFixed(1)}%` : fmtPct(PLATFORM_DEFAULTS.sellingCosts),
      confidence: deriveConfidence(sellQ, null, em),
      source:     sellCosts != null ? 'Operator Input' : 'Platform Default',
      method:     sellCosts != null ? 'Operator Input' : 'Platform Default',
      quality:    sellQ,
      platformBaseline: sellCosts != null && Math.abs(sellCosts - PLATFORM_DEFAULTS.sellingCosts) > 0.005
        ? `Platform default: ${fmtPct(PLATFORM_DEFAULTS.sellingCosts)}`
        : undefined,
      isOverride: sellCosts != null && Math.abs(sellCosts - PLATFORM_DEFAULTS.sellingCosts) > 0.005,
      overrideImpact: sellCosts != null && Math.abs(sellCosts - PLATFORM_DEFAULTS.sellingCosts) > 0.005
        ? computeOverrideImpact('selling_costs', sellCosts, PLATFORM_DEFAULTS.sellingCosts, null, false)
        : undefined,
    });

    groups.push({ label: 'DISPOSITION', icon: '◈', rows });
  }

  // ── REVENUE ────────────────────────────────────────────────────────────────
  {
    const rows: ValidationRow[] = [];

    // Y1 Market Rent (per unit)
    const gprDecomp  = fin?.assumptions?.gprDecomposition ?? null;
    const rentT12    = gprDecomp?.t12PerUnitMo ?? null;
    const rentRR     = fin?.rentRollSummary?.avgInPlaceRent ?? null;
    const rentPlat   = gprDecomp?.platformPerUnitMo ?? null;
    const rentBroker = gprDecomp?.brokerPerUnitMo ?? null;
    const rentResolved = gprDecomp?.resolvedPerUnitMo ?? rawA?.avg_rent_per_unit ?? null;

    const rentQ: QualityBand =
      rentT12 != null || rentRR != null ? 'STRONG'
      : rentPlat != null                 ? 'WATCH'
      : rentBroker != null               ? 'WEAK'
      : 'UNVALIDATED';

    const rentSrc    = rentT12 != null    ? 'T-12 Document'
      : rentRR != null                   ? 'Rent Roll'
      : rentPlat != null                 ? 'Platform Benchmark'
      : rentBroker != null               ? 'Broker OM'
      : 'Not Set';

    const rentMeth   = rentT12 != null    ? 'Document (T-12)'
      : rentRR != null                   ? 'Document (Rent Roll)'
      : rentPlat != null                 ? 'Market Benchmark'
      : 'Operator Input';

    // Detail line: show available sources for comparison context
    let rentDetail: string | undefined;
    const rentParts: string[] = [];
    if (rentT12 != null)   rentParts.push(`T-12: ${fmtRent(rentT12)}`);
    if (rentBroker != null) rentParts.push(`Broker: ${fmtRent(rentBroker)}`);
    if (rentPlat != null)  rentParts.push(`Platform: ${fmtRent(rentPlat)}`);
    if (rentParts.length > 1) rentDetail = rentParts.join(' · ');

    // Platform baseline for override comparison
    const rentPlatBaseline = gprDecomp != null && rentPlat != null && rentResolved != null
      && Math.abs((rentResolved - rentPlat) / rentPlat) > 0.05
        ? `Platform benchmark: ${fmtRent(rentPlat)}`
        : undefined;

    rows.push({
      key:        'rent_y1',
      assumption: 'Y1 Market Rent (per unit)',
      value:      fmtRent(rentResolved),
      confidence: deriveConfidence(rentQ, 'gpr', em),
      source:     rentSrc,
      method:     rentMeth,
      quality:    rentQ,
      detail:     rentDetail,
      platformBaseline: rentPlatBaseline,
      isOverride: rentPlatBaseline != null,
    });

    // Rent Growth Y1
    // CF-04: canonical source is f9Financials.assumptions.rentGrowthYr1 (Engine A).
    // Fall back to ModelAssumptions only when f9Financials hasn't loaded yet.
    const rentGrowthY1  = fin != null
      ? (fin.assumptions?.rentGrowthYr1 ?? null)
      : (assum?.revenue?.rentGrowth?.[0] ?? null);
    const rentGrPyo     = pyoSrc(pyo, 'revenue.rentGrowth[0]');
    const rentGrQ: QualityBand =
      rentGrowthY1 != null ? 'WATCH'
      : hasRawRow           ? 'WATCH'
      : 'UNVALIDATED';
    rows.push({
      key:        'rent_growth_y1',
      assumption: 'Rent Growth Y1',
      value:      fmtPct(rentGrowthY1),
      confidence: deriveConfidence(rentGrQ, null, em),
      source:     rentGrPyo ?? (rawA?.source_type === 'agent' ? 'Agent Derived' : 'Platform Benchmark'),
      method:     rentGrPyo ? 'Operator Override' : 'Market Benchmark',
      quality:    rentGrQ,
      isOverride: !!rentGrPyo,
      platformBaseline: rentGrPyo && rentGrowthY1 != null && Math.abs(rentGrowthY1 - PLATFORM_DEFAULTS.rentGrowthY1) > 0.005
        ? `Platform benchmark: ${fmtPct(PLATFORM_DEFAULTS.rentGrowthY1)}`
        : undefined,
      overrideImpact: rentGrPyo && rentGrowthY1 != null && Math.abs(rentGrowthY1 - PLATFORM_DEFAULTS.rentGrowthY1) > 0.001
        ? computeOverrideImpact('rent_growth_y1', rentGrowthY1, PLATFORM_DEFAULTS.rentGrowthY1)
        : undefined,
      divergenceSignature: fieldDivergences['rent_growth_yr1'],
    });

    // Stabilized Occupancy
    const occ        = assum?.revenue?.stabilizedOccupancy
      ?? (rawA?.vacancy_pct != null ? 1 - rawA.vacancy_pct : null);
    const hasRROcc   = fin?.rentRollSummary?.weightedOccupancyPct != null;
    const occQ: QualityBand =
      hasRROcc         ? 'STRONG'
      : occ != null    ? 'WATCH'
      : 'UNVALIDATED';
    rows.push({
      key:        'stab_occ',
      assumption: 'Stabilized Occupancy',
      value:      occ != null ? `${(occ * 100).toFixed(1)}%` : '—',
      confidence: deriveConfidence(occQ, 'vacancy_rate', em),
      source:     hasRROcc ? 'Rent Roll' : occ != null ? srcLabel(rawA?.source_type) : 'Not Set',
      method:     hasRROcc ? 'Document (Rent Roll)' : 'Market Benchmark',
      quality:    occQ,
      detail:     hasRROcc
        ? `Rent roll occupancy: ${((fin!.rentRollSummary!.weightedOccupancyPct!) * 100).toFixed(1)}%`
        : undefined,
      platformBaseline: !hasRROcc && occ != null && Math.abs(occ - PLATFORM_DEFAULTS.occupancy) > 0.02
        ? `Platform default: ${(PLATFORM_DEFAULTS.occupancy * 100).toFixed(0)}%`
        : undefined,
      isOverride: !hasRROcc && occ != null && Math.abs(occ - PLATFORM_DEFAULTS.occupancy) > 0.02,
      overrideImpact: !hasRROcc && occ != null && Math.abs(occ - PLATFORM_DEFAULTS.occupancy) > 0.005
        ? computeOverrideImpact('stab_occ', occ, PLATFORM_DEFAULTS.occupancy)
        : undefined,
    });

    // Collection / Bad Debt
    const collLoss = assum?.revenue?.collectionLoss ?? null;
    const collQ: QualityBand =
      collLoss != null  ? 'WATCH'
      : hasRawRow       ? 'WATCH'
      : 'UNVALIDATED';
    rows.push({
      key:        'collection_loss',
      assumption: 'Collection / Bad Debt',
      value:      collLoss != null ? `${(collLoss * 100).toFixed(1)}%` : `${(PLATFORM_DEFAULTS.collectionLoss * 100).toFixed(1)}% (default)`,
      confidence: deriveConfidence(collQ, null, em),
      source:     collLoss != null ? 'Operator Input' : 'Platform Default',
      method:     'Platform Benchmark',
      quality:    collQ,
      platformBaseline: collLoss != null && Math.abs(collLoss - PLATFORM_DEFAULTS.collectionLoss) > 0.005
        ? `Platform default: ${fmtPct(PLATFORM_DEFAULTS.collectionLoss)}`
        : undefined,
      isOverride: collLoss != null && Math.abs(collLoss - PLATFORM_DEFAULTS.collectionLoss) > 0.005,
      overrideImpact: collLoss != null && Math.abs(collLoss - PLATFORM_DEFAULTS.collectionLoss) > 0.001
        ? computeOverrideImpact('collection_loss', collLoss, PLATFORM_DEFAULTS.collectionLoss, null, false)
        : undefined,
    });

    // Loss to Lease — T12 vs live-lease-analytics divergence (Piece B3)
    // Source: fin.ltlSignals from Engine A (Task #1540 Piece B1).
    // The 464 Bishop case: T12=0.35%, live=13.8% (1345 bps delta → WEAK + CONTESTED).
    const ltlSignals = fin?.ltlSignals ?? null;
    const ltlT12     = ltlSignals?.t12Pct  ?? null;
    const ltlLive    = ltlSignals?.livePct ?? null;
    const ltlResolved = ltlSignals
      ? (ltlSignals.trajectorySource === 'live' ? ltlLive : ltlT12)
      : null;
    const ltlDelta = ltlT12 != null && ltlLive != null
      ? Math.abs(ltlLive - ltlT12)
      : null;
    // Use backend-authoritative threshold so frontend stays in sync with the
    // divergence-thresholds.ts registry. Fall back to 0.03 (300 bps) only
    // while the API response is still loading.
    const LTL_THRESHOLD = fieldDivergences['loss_to_lease']?.threshold ?? 0.03;
    const ltlContested = ltlDelta != null && ltlDelta > LTL_THRESHOLD;
    const ltlQ: QualityBand =
      ltlLive != null && ltlContested ? 'WEAK'
      : ltlLive != null               ? 'STRONG'
      : ltlT12 != null                ? 'WATCH'
      : 'UNVALIDATED';

    const ltlDivSig: DivergenceSignature | undefined =
      ltlContested && ltlT12 != null && ltlLive != null
        ? {
            points: [
              { layer: 't12',            label: 'T-12 Document',    value: ltlT12 },
              { layer: 'storedResolved', label: 'Live (Traffic)',   value: ltlLive },
            ],
            maxAbsDelta: ltlDelta!,
            alertLevel:  ltlDelta! >= LTL_THRESHOLD * 3 ? 'block' : 'warn',
            exceeds:     true,
            threshold:   LTL_THRESHOLD,
            fieldName:   'loss_to_lease',
            unit:        'bps',
            isPct:       true,
          }
        : undefined;

    const ltlParts: string[] = [];
    if (ltlT12  != null) ltlParts.push(`T-12: ${fmtPct(ltlT12)}`);
    if (ltlLive != null) ltlParts.push(`Live: ${fmtPct(ltlLive)}`);

    if (ltlSignals != null || fieldDivergences['loss_to_lease']) {
      rows.push({
        key:        'loss_to_lease',
        assumption: 'Loss to Lease',
        value:      fmtPct(ltlResolved),
        confidence: deriveConfidence(ltlQ, null, em),
        source:     ltlSignals?.trajectorySource === 'live'
          ? 'Traffic Data (Live)'
          : ltlT12 != null ? 'T-12 Document' : 'Not Set',
        method:     ltlLive != null
          ? `Live Lease Analytics · ${ltlSignals?.trajectorySource === 'live' ? 'LIVE' : 'T-12'} trajectory`
          : 'Document (T-12)',
        quality:    ltlQ,
        detail:     ltlParts.length > 1 ? ltlParts.join(' · ') : undefined,
        divergenceSignature: ltlDivSig ?? fieldDivergences['loss_to_lease'],
      });
    }

    groups.push({ label: 'REVENUE', icon: '⊕', rows });
  }

  // ── EXPENSES ───────────────────────────────────────────────────────────────
  {
    const rows: ValidationRow[] = [];

    // Operating Expense Ratio
    const opexRatio = rawA?.opex_ratio ?? null;
    const opexQ: QualityBand =
      opexRatio != null ? 'WATCH'
      : hasRawRow       ? 'WATCH'
      : 'UNVALIDATED';
    rows.push({
      key:        'opex_ratio',
      assumption: 'Operating Expense Ratio',
      value:      opexRatio != null ? `${(opexRatio * 100).toFixed(1)}%` : '—',
      confidence: deriveConfidence(opexQ, 'opex_ratio', em),
      source:     opexRatio != null ? srcLabel(rawA?.source_type) : 'Platform Default',
      method:     'Platform Benchmark',
      quality:    opexQ,
      detail:     'opex ÷ EGR',
    });

    // Expense Growth Rate
    const expItems   = assum?.expenses ? Object.values(assum.expenses) : [];
    const expGrowth  = expItems[0]?.growthRate ?? null;
    const expQ: QualityBand =
      expGrowth != null ? 'WATCH'
      : hasRawRow       ? 'WATCH'
      : 'UNVALIDATED';
    rows.push({
      key:        'expense_growth',
      assumption: 'Expense Growth Rate',
      value:      expGrowth != null ? fmtPct(expGrowth) : `${(PLATFORM_DEFAULTS.expenseGrowth * 100).toFixed(1)}% (default)`,
      confidence: deriveConfidence(expQ, null, em),
      source:     expGrowth != null ? 'Operator Input' : 'Platform Default',
      method:     'Platform Benchmark',
      quality:    expQ,
      platformBaseline: expGrowth != null && Math.abs(expGrowth - PLATFORM_DEFAULTS.expenseGrowth) > 0.005
        ? `Platform default: ${fmtPct(PLATFORM_DEFAULTS.expenseGrowth)}`
        : undefined,
      isOverride: expGrowth != null && Math.abs(expGrowth - PLATFORM_DEFAULTS.expenseGrowth) > 0.005,
    });

    groups.push({ label: 'EXPENSES', icon: '$', rows });
  }

  // ── FINANCING ──────────────────────────────────────────────────────────────
  {
    const rows: ValidationRow[] = [];

    // CF-05/CF-06: canonical source is f9Financials.capitalStack (Engine A).
    // Fall back to ModelAssumptions only when f9Financials hasn't loaded yet.
    const loanAmt   = fin != null
      ? (fin.capitalStack?.loanAmount ?? null)
      : (assum?.financing?.loanAmount ?? null);
    const pp2       = fin != null
      ? (fin.capitalStack?.purchasePrice ?? null)
      : (assum?.acquisition?.purchasePrice ?? null);
    const ltvCalc   = loanAmt != null && pp2 != null && pp2 > 0 ? loanAmt / pp2 : null;
    const ltvRaw    = rawA?.ltc ?? null;
    const ltvDisplay = ltvCalc ?? ltvRaw;
    const hasDebt   = fin?.debt != null;

    const ltvQ: QualityBand =
      hasDebt          ? 'STRONG'
      : ltvDisplay != null ? 'WATCH'
      : 'UNVALIDATED';
    rows.push({
      key:        'ltv',
      assumption: 'LTV at Close',
      value:      ltvDisplay != null ? `${(ltvDisplay * 100).toFixed(1)}%` : '—',
      confidence: deriveConfidence(ltvQ, null, em),
      source:     hasDebt ? 'Debt Advisor (M11)' : 'Platform Default',
      method:     hasDebt ? 'Debt Advisor' : 'Platform Benchmark',
      quality:    ltvQ,
      detail:     loanAmt ? `Loan amount: ${fmtUsd(loanAmt)}` : undefined,
      platformBaseline: !hasDebt && ltvDisplay != null && Math.abs(ltvDisplay - PLATFORM_DEFAULTS.ltv) > 0.03
        ? `Platform default: ${(PLATFORM_DEFAULTS.ltv * 100).toFixed(0)}%`
        : undefined,
      isOverride: !hasDebt && ltvDisplay != null && Math.abs(ltvDisplay - PLATFORM_DEFAULTS.ltv) > 0.03,
      overrideImpact: !hasDebt && ltvDisplay != null && Math.abs(ltvDisplay - PLATFORM_DEFAULTS.ltv) > 0.01
        ? computeOverrideImpact('ltv', ltvDisplay, PLATFORM_DEFAULTS.ltv, null, true)
        : undefined,
    });

    const intRate = fin != null
      ? (fin.capitalStack?.interestRate ?? null)
      : (assum?.financing?.interestRate ?? null);
    const intQ: QualityBand =
      hasDebt                            ? 'STRONG'
      : intRate != null && intRate > 0   ? 'WATCH'
      : 'UNVALIDATED';
    rows.push({
      key:        'interest_rate',
      assumption: 'Interest Rate',
      value:      intRate != null && intRate > 0 ? fmtPct(intRate) : '—',
      confidence: deriveConfidence(intQ, null, em),
      source:     hasDebt ? 'Debt Advisor (M11)' : 'Platform Default',
      method:     hasDebt ? 'Debt Advisor' : 'Platform Benchmark',
      quality:    intQ,
      platformBaseline: !hasDebt && intRate != null && intRate > 0 && Math.abs(intRate - PLATFORM_DEFAULTS.interestRate) > 0.005
        ? `Platform default: ${fmtPct(PLATFORM_DEFAULTS.interestRate)}`
        : undefined,
      isOverride: !hasDebt && intRate != null && intRate > 0 && Math.abs(intRate - PLATFORM_DEFAULTS.interestRate) > 0.005,
      overrideImpact: !hasDebt && intRate != null && intRate > 0 && Math.abs(intRate - PLATFORM_DEFAULTS.interestRate) > 0.001
        ? computeOverrideImpact('interest_rate', intRate, PLATFORM_DEFAULTS.interestRate)
        : undefined,
    });

    const termYrs = assum?.financing?.term ?? null;
    const termQ: QualityBand =
      hasDebt          ? 'STRONG'
      : termYrs != null ? 'WATCH'
      : 'UNVALIDATED';
    rows.push({
      key:        'loan_term',
      assumption: 'Loan Term',
      value:      termYrs != null ? fmtYrs(termYrs) : '—',
      confidence: deriveConfidence(termQ, null, em),
      source:     hasDebt ? 'Debt Advisor (M11)' : 'Platform Default',
      method:     hasDebt ? 'Debt Advisor' : 'Platform Default',
      quality:    termQ,
    });

    groups.push({ label: 'FINANCING', icon: '⊞', rows });
  }

  // ── Summary counts ─────────────────────────────────────────────────────────

  const allRows = groups.flatMap(g => g.rows);
  const counts: Record<QualityBand, number> = {
    STRONG:      allRows.filter(r => r.quality === 'STRONG').length,
    WATCH:       allRows.filter(r => r.quality === 'WATCH').length,
    WEAK:        allRows.filter(r => r.quality === 'WEAK').length,
    UNVALIDATED: allRows.filter(r => r.quality === 'UNVALIDATED').length,
  };
  const overrideCount   = allRows.filter(r => r.isOverride).length;
  const contestedCount  = allRows.filter(r => r.divergenceSignature?.exceeds).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  // 6 columns: ASSUMPTION | VALUE | CONFIDENCE | SOURCE | METHOD | QUALITY
  const COL = '1.45fr 0.8fr 0.62fr 1fr 1.05fr 0.72fr';
  const COL_HEADERS = ['ASSUMPTION', 'CURRENT VALUE', 'CONFIDENCE', 'SOURCE', 'VALIDATION METHOD', 'QUALITY'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: BT.bg.terminal }}>

      {/* ── Header strip ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        padding: '5px 12px',
        background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber, letterSpacing: 0.8 }}>
          ASSUMPTION VALIDATION GRID
        </span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
          {allRows.length} FIELDS · READ ONLY
        </span>
        {overrideCount > 0 && (
          <span style={{
            fontFamily: MONO, fontSize: 7, fontWeight: 700,
            color: BT.text.amber, padding: '1px 5px',
            border: `1px solid ${BT.text.amber}44`, borderRadius: 2,
          }}>
            {overrideCount} OVERRIDE{overrideCount > 1 ? 'S' : ''}
          </span>
        )}
        {contestedCount > 0 && (
          <span style={{
            fontFamily: MONO, fontSize: 7, fontWeight: 700,
            color: '#FF5252', padding: '1px 5px',
            border: '1px solid #FF525244', borderRadius: 2,
          }}>
            ⚡ {contestedCount} CONTESTED
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['STRONG', 'WATCH', 'WEAK', 'UNVALIDATED'] as QualityBand[]).map(q =>
            counts[q] > 0 ? (
              <span key={q} style={{
                fontFamily: MONO, fontSize: 7, fontWeight: 700,
                color: QUALITY_COLOR[q], letterSpacing: 0.4,
                padding: '1px 5px',
                border: `1px solid ${QUALITY_COLOR[q]}44`, borderRadius: 2,
              }}>
                {counts[q]} {q}
              </span>
            ) : null
          )}
          {loading && <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>LOADING…</span>}
        </div>
      </div>

      {/* ── M07 gating banner — shown when Traffic Engine hasn't run for this deal ── */}
      {m07Missing && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          padding: '5px 12px',
          background: '#F5A62308',
          borderBottom: `1px solid #F5A62333`,
          fontFamily: MONO,
        }}>
          <span style={{ fontSize: 10, color: '#F5A623' }}>△</span>
          <span style={{ fontSize: 8, color: '#F5A623', fontWeight: 700, letterSpacing: 0.5 }}>
            TRAFFIC ENGINE NOT RUN
          </span>
          <span style={{ fontSize: 8, color: '#94A3B8' }}>
            · Vacancy trajectory uses a flat constant. Occupancy and LTL rows are unvalidated against live leasing data.
          </span>
          <a
            href={`?tab=traffic`}
            style={{
              marginLeft: 'auto', fontSize: 7.5, fontWeight: 700, color: '#F5A623',
              letterSpacing: 0.5, textDecoration: 'none',
              padding: '1px 6px', border: '1px solid #F5A62344', flexShrink: 0,
            }}
          >
            OPEN M07 →
          </a>
        </div>
      )}

      {/* ── Column headers ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: COL, gap: 0,
        padding: '3px 12px',
        background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
        flexShrink: 0,
      }}>
        {COL_HEADERS.map((h, i) => (
          <span key={h} style={{
            fontFamily: MONO, fontSize: 7, color: BT.text.muted, fontWeight: 700,
            letterSpacing: 0.5, paddingRight: 8,
            textAlign: i === 5 ? 'center' : 'left',
          }}>{h}</span>
        ))}
      </div>

      {/* ── Grid body ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {groups.map((group, gi) => (
          <div key={group.label}>

            {/* Group header row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px',
              background: `${BT.text.amber}08`,
              borderBottom: `1px solid ${BT.border.subtle}`,
              borderTop: gi > 0 ? `2px solid ${BT.border.subtle}` : undefined,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 8, opacity: 0.55 }}>{group.icon}</span>
              <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, color: BT.text.amber, letterSpacing: 1 }}>
                {group.label}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginLeft: 4 }}>
                {group.rows.filter(r => r.quality === 'STRONG').length}S ·
                {group.rows.filter(r => r.quality === 'WATCH').length}W ·
                {group.rows.filter(r => r.quality === 'WEAK').length}K ·
                {group.rows.filter(r => r.quality === 'UNVALIDATED').length}U
              </span>
            </div>

            {/* Data rows */}
            {group.rows.map((row, ri) => (
              <div key={row.key} style={{
                display: 'grid', gridTemplateColumns: COL, gap: 0,
                padding: '5px 12px',
                background: ri % 2 === 0 ? BT.bg.panel : BT.bg.terminal,
                borderBottom: `1px solid ${BT.border.subtle}`,
                alignItems: 'start',
                borderLeft: row.quality === 'WEAK'
                  ? `3px solid ${QUALITY_COLOR.WEAK}`
                  : row.isOverride
                  ? `3px solid ${BT.text.amber}55`
                  : '3px solid transparent',
              }}>

                {/* ① ASSUMPTION */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, fontWeight: 600 }}>
                      {row.assumption}
                    </span>
                    {row.isOverride && (
                      <span style={{
                        fontFamily: MONO, fontSize: 6, fontWeight: 700,
                        color: BT.text.amber, padding: '0 3px',
                        border: `1px solid ${BT.text.amber}55`, borderRadius: 2,
                      }}>OVR</span>
                    )}
                  </div>
                  {row.divergenceSignature?.exceeds && (
                    <div style={{ marginTop: 1 }}>
                      <ContestedBadge
                        alertLevel={
                          row.divergenceSignature.alertLevel === 'block' ? 'block' : 'warn'
                        }
                        deltaLabel={
                          row.divergenceSignature.isPct
                            ? `${Math.round(row.divergenceSignature.maxAbsDelta * 10000)} bps`
                            : `$${Math.round(row.divergenceSignature.maxAbsDelta).toLocaleString()}`
                        }
                        points={row.divergenceSignature.points.map(p => ({
                          label: p.label,
                          value: p.value,
                        }))}
                        isPct={row.divergenceSignature.isPct}
                      />
                    </div>
                  )}
                  {row.platformBaseline && (
                    <span style={{ fontFamily: MONO, fontSize: 7, color: '#00D26A', opacity: 0.85 }}>
                      ↳ {row.platformBaseline}
                    </span>
                  )}
                </div>

                {/* ② CURRENT VALUE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.met.financial, fontWeight: 700 }}>
                    {row.value}
                  </span>
                  {row.detail && (
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
                      {row.detail}
                    </span>
                  )}
                  {row.overrideImpact && (
                    <OverrideImpactBadge impact={row.overrideImpact} />
                  )}
                </div>

                {/* ③ CONFIDENCE */}
                <div style={{ paddingTop: 1 }}>
                  {row.confidence != null ? (
                    <span style={{
                      fontFamily: MONO, fontSize: 7, fontWeight: 700, letterSpacing: 0.3,
                      color: CONFIDENCE_COLOR[row.confidence] ?? BT.text.muted,
                      textTransform: 'uppercase',
                    }}>
                      {row.confidence}
                    </span>
                  ) : (
                    <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>—</span>
                  )}
                </div>

                {/* ④ SOURCE */}
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                  {row.source}
                </span>

                {/* ⑤ VALIDATION METHOD */}
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>
                  {row.method}
                </span>

                {/* ⑥ QUALITY */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                  <QualityIcon q={row.quality} />
                  <span style={{
                    fontFamily: MONO, fontSize: 7, fontWeight: 700, letterSpacing: 0.4,
                    color: QUALITY_COLOR[row.quality],
                    background: QUALITY_BG[row.quality],
                    padding: '1px 5px',
                    border: `1px solid ${QUALITY_COLOR[row.quality]}44`,
                    borderRadius: 2, whiteSpace: 'nowrap',
                  }}>
                    {row.quality}
                  </span>
                </div>

              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Footer legend ── */}
      <div style={{
        flexShrink: 0, padding: '4px 12px',
        background: BT.bg.header, borderTop: `1px solid ${BT.border.subtle}`,
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, fontWeight: 700 }}>LEGEND:</span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#00D26A' }}>STRONG — comp or document verified</span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.amber }}>WATCH — platform benchmark or operator input</span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#FF5252' }}>WEAK — outlier vs market</span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>UNVALIDATED — no source data</span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>↳ = platform baseline for overrides</span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#00C8FF', opacity: 0.8 }}>▲/▼ = est. IRR impact of override (info band)</span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.amber, opacity: 0.8 }}>▲/▼ = est. IRR impact, &gt;25% delta (caution band)</span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#FF5252', opacity: 0.9 }}>⚡ CONTESTED = source layers disagree beyond threshold (e.g. T-12 vs live)</span>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
          Edit in: DEAL TERMS · INPUTS · DEBT
        </span>
      </div>
    </div>
  );
}
