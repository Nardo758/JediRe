import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CheckCircle2, AlertTriangle, Pencil, RotateCcw, RefreshCw, Loader2, XCircle, ChevronDown, ChevronRight, ShieldAlert, ShieldCheck } from 'lucide-react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { apiClient } from '../../../services/api.client';
import type { FinancialEngineTabProps, EvidenceFieldMeta, F9ConcessionMonthlyDetail } from './types';
import { ConcessionDrilldownModal, aggregateConcessionDetail } from './ConcessionDrilldownModal';
import { CommentaryPanel } from './CommentaryPanel';
import { SourceBadge } from './SourceBadge';
import { useDealStore, PlatformColSource } from '../../../stores/dealStore';
import { StabilizedPotentialView } from '../../../components/F9/StabilizedPotentialView';
import { FloorPlanGrid } from '../../../components/f9/FloorPlanGrid';
import type { GprUnitMixEntry } from '../../../components/f9/FloorPlanGrid';
import { RegimeExpand } from '../../../components/f9/RegimeExpand';
import { ReconciliationChip } from '../../../components/f9/ReconciliationChip';
import type { HierarchicalResolution } from '../../../components/f9/ReconciliationChip';
import { SourceDocPill } from '../../../components/f9/SourceDocPill';
import type { SourceDocument } from '../../../hooks/useSourceDocuments';
import { OverrideInputCell } from '../../../components/f9/OverrideInputCell';
import { isPatternB } from '../../../config/m09_line_item_patterns';
import { UnitMixMismatchBannerConnected } from './UnitMixMismatchBanner';
import {
  FLIP_BASIS_ROWS, FLIP_CAPEX_ROWS, FLIP_EXIT_ROWS,
  STR_REVENUE_ROWS,
  LAND_HOLD_EXIT_ROWS,
  type TemplateRowDef,
} from './proforma-template-row-sets';
import { PeriodicTimelineTrigger } from '../../../components/periodic/PeriodicTimelineTrigger';

const MONO = BT.font.mono;
const LABEL = BT.font.label;

// ─── API types (mirrors backend DealFinancials contract) ──────────────────────
interface OperatingStatementRow {
  field: string;
  label: string;
  broker: number | null;
  platform: number | null;
  t12: number | null;
  t6: number | null;
  t3: number | null;
  t1: number | null;
  rentRoll: number | null;
  taxBill: number | null;
  resolved: number | null;
  resolution: string | null;
  perUnit: number | null;
  source: string | null;
  confidence: number | null;
  benchmarkPosition: 'above' | 'below' | 'within' | null;
}

interface IntegrityCheck {
  id: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  detail?: Record<string, unknown>;
}

interface DealCapitalStack {
  purchasePrice: number | null;
  pricePerUnit: number | null;
  loanAmount: number | null;
  equityAtClose: number | null;
  ltcPct: number | null;
  interestRate: number | null;
  ioPeriodMonths: number | null;
  amortizationYears: number | null;
  dscrMin: number | null;
  originationFeePct: number | null;
}

interface ValuationSnapshot {
  pricePerUnit: number | null; pricePerSF: number | null;
  grm: number | null; gim: number | null; goingInCapT12: number | null;
  priceToRC: number | null; rcPerUnit: number | null;
  buildArbitrageFlag: 'buy_existing' | 'neutral' | 'build_new' | null;
  pricePerUnitSubmarketMedian: number | null; pricePerUnitPercentile: number | null;
  pricePerSFSubmarketMedian: number | null; pricePerSFPercentile: number | null;
  grmSubmarketMedian: number | null; grmPercentile: number | null;
  gimSubmarketMedian: number | null; gimPercentile: number | null;
  goingInCapSubmarketMedian: number | null; goingInCapPercentile: number | null;
}

interface DealFinancials {
  dealId: string;
  dealName: string;
  totalUnits: number;
  /**
   * Pro forma template ID derived server-side from investment_strategy_lv
   * (or deal_type fallback). Drives template-aware row rendering in this tab.
   * Null/absent → falls back to deal_type-based rendering (no regression).
   */
  proformaTemplateId?: string | null;
  proforma: {
    year1: OperatingStatementRow[];
    integrityChecks: IntegrityCheck[];
    unitEconomics: Record<string, number | null>;
    valuationSnapshot: ValuationSnapshot | null;
  };
  capitalStack: DealCapitalStack;
  rentRollSummary: {
    unitMix: Array<{
      type: string;
      count: number;
      avgSf: number | null;
      inPlaceRent: number | null;
      marketRent: number | null;
      occupancyPct: number | null;
      concessionPct: number | null;
    }> | null;
    avgInPlaceRent: number | null;
    weightedOccupancyPct: number | null;
    /** GPR computed from unit mix: Σ(count × in_place_rent × 12). */
    gprFromUnitMix: number | null;
    /** Per-deal flag — when true, server resolves Year-1 GPR from the unit mix. */
    useUnitMixForGpr: boolean;
  } | null;
  assumptions: {
    holdYears: number;
    exitCap: number | null;
    rentGrowthYr1: number | null;
    perYear: Array<{ year: number; vacancyPct: number | null; rentGrowthPct: number | null; exitCapIfLastYear: number | null }>;
  };
  meta: { seeded: boolean; updatedAt: string | null };
  /** Phase 1A — Pro Forma stabilization window. */
  adoptionTimeline?: {
    constructionMonths: number|null; leaseUpMonths: number|null;
    absorptionUnitsPerMonth: number|null; stabilizationTargetPct: number|null;
    stabilizationYear: number|null;
    stabilizationYearOverride: number|null;
    effectiveStabilizationYear: number|null;
    submarketVacancyRate: number|null;
    lifecycleProfile?: string | null;
    lifecycleProfileOverride?: string | null;
    effectiveLifecycleProfile?: string | null;
    /** Block 7e — formula consistency invariant check. Null until Cashflow Agent has run. */
    invariantCheck?: {
      status: 'PASSED' | 'FAILED' | 'SKIPPED';
      pre_stab_noi: number | null;
      stab_noi: number | null;
      delta_pct: number | null;
      reason: string;
    } | null;
  } | null;
  /** Per-floor-plan GPR grid from cashflow agent (Task #797 / Pattern A). Null when agent has not run. */
  gprUnitMix?: GprUnitMixEntry[] | null;
  /** Renovation scope descriptor for the GPR grid header (from M22 capex_schedule). */
  renovationScope?: string | null;
  /** Whether the renovation program has a uniform or mixed scope. */
  scopeUniformity?: 'uniform' | 'mixed' | null;
  /**
   * Operator-configured yield-on-cost hurdle rate (decimal, e.g. 0.12 = 12%).
   * Threaded to <FloorPlanGrid> so YoC threshold warnings use the deal-level
   * setting rather than a hardcoded default. Null → grid falls back to 10%.
   */
  targetYieldThreshold?: number | null;
  /** Per-category ancillary income reconciliation (RR / T-12 / OM). Task #519. */
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
  /** User-added ancillary lines (e.g. "Solar revenue"). Task #519. */
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
    /** Adoption / ramp-up timeline. When set, income ramps up instead of flat. Task #1147. */
    adoption?: {
      ramp_start_period: number;
      ramp_duration_months: number;
      steady_state_monthly: number;
      probability_adopted: number;
    } | null;
  }>;
  /** ISO date of deal close — used to map Year 1 → calendar year window. */
  closeDate?: string | null;
  /**
   * Concession amortization recognition schedule (Task #574).
   * Monthly recognized amounts keyed by YYYYMM; calendar year totals keyed by YYYY.
   * §14: distinct from earned (cash_value) concessions — never display in the same row.
   */
  concessionRecognition?: {
    monthly: Record<string, number>;
    by_calendar_year: Record<string, number>;
    by_fiscal_year: Record<string, number>;
    write_offs_year_to_date: number;
    last_recomputed: string | null;
    monthly_detail?: Record<string, F9ConcessionMonthlyDetail>;
  } | null;
  /**
   * Per-field regime data from the cashflow agent (Task #797).
   * Keyed by the Pro Forma row field name (e.g. 'turnover', 'vacancy_loss').
   * Populated when the agent has produced per-regime values for value-add /
   * redevelopment deals. Null/absent when the agent has not yet run.
   * Consumed by <RegimeExpand> (Pattern B) to show pre-renovation and
   * post-stabilization sub-rows with real values instead of T12 fallback.
   */
  regimeDataByField?: Record<string, {
    pre_renovation: { value: number | null; source: string | null; confidence?: 'high' | 'medium' | 'low' | null; note?: string | null };
    post_stabilization: { value: number | null; source: string | null; confidence?: 'high' | 'medium' | 'low' | null; note?: string | null };
    transition_year?: { value: number | null; source: string | null; confidence?: 'high' | 'medium' | 'low' | null; note?: string | null } | null;
    /**
     * Human-readable timing label read from M22 capex_schedule (e.g. "Y3",
     * "Month 28", "Post unit-#-completion"). Describes when the pre-renovation
     * regime ends and post-stabilization begins. Populated by the cashflow agent
     * from capex_schedule.transition_month when available.
     */
    transition_timing_label?: string | null;
  }> | null;
  /**
   * Math engine v1.1 correction report (Task #804 / #805).
   * Populated when a completed cashflow agent run with math_correction_report is available.
   * Null when the agent has not yet run or produced no corrections.
   */
  mathCorrectionReport?: {
    hierarchical_resolutions?: Record<string, HierarchicalResolution>;
  } | null;
  adoptionTimeline?: {
    constructionMonths?: number | null;
    leaseUpMonths?: number | null;
    absorptionUnitsPerMonth?: number | null;
    stabilizationTargetPct?: number | null;
    stabilizationYear?: number | null;
    stabilizationYearOverride?: number | null;
    effectiveStabilizationYear?: number | null;
    submarketVacancyRate?: number | null;
    submarketVacancyAsOf?: string | null;
    lifecycleProfile?: string | null;
    lifecycleProfileOverride?: string | null;
    /** Block 7e — formula consistency invariant check. Null until Cashflow Agent has run. */
    invariantCheck?: {
      status: 'PASSED' | 'FAILED' | 'SKIPPED';
      pre_stab_noi: number | null;
      stab_noi: number | null;
      delta_pct: number | null;
      reason: string;
    } | null;
    effectiveLifecycleProfile?: string | null;
  } | null;
}

// ─── Sections layout ──────────────────────────────────────────────────────────
// Field names mirror Projections REVENUE block (dollar values, not rates).
// Per canonical spec: GPR → Loss-to-Lease → Vacancy → Concessions → Bad Debt → NRU → Base Rental Revenue
const REVENUE_FIELDS = new Set([
  'gpr', 'loss_to_lease', 'vacancy_loss', 'concessions',
  'bad_debt', 'non_revenue_units', 'net_rental_income',
  'other_income', 'egi',
]);
const CTRL_OPEX_FIELDS = new Set([
  'payroll', 'repairs_maintenance', 'turnover', 'contract_services',
  'marketing', 'utilities', 'g_and_a',
]);
const NCTRL_OPEX_FIELDS = new Set([
  'management_fee', 'insurance', 'real_estate_tax', 'real_estate_taxes', 'total_opex',
]);
const SUBTOTALS = new Set(['gpr', 'net_rental_income', 'egi', 'total_opex', 'noi']);
const PCT_FIELDS = new Set<string>();
const PER_UNIT_FIELDS = new Set<string>();

// ─── Ancillary income category labels ─────────────────────────────────────────
const ANCILLARY_CATEGORY_LABELS: Record<string, string> = {
  parking:               'Parking / Garage',
  garage:                'Parking / Garage',
  utility_reimbursement: 'Utility Reimbursements (RUBS)',
  rubs:                  'Utility Reimbursements (RUBS)',
  valet_trash:           'Valet Trash',
  cable_internet:        'Cable / Internet',
  cable:                 'Cable / Internet',
  internet:              'Cable / Internet',
  washer_dryer:          'Washer / Dryer',
  laundry:               'Washer / Dryer',
  renters_insurance:     'Renters Insurance',
  other:                 'Other',
};
function ancillaryLabel(cat: string): string {
  return ANCILLARY_CATEGORY_LABELS[cat.toLowerCase()] ??
    cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Formatting ───────────────────────────────────────────────────────────────
function fmt$(n: number | null): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${Math.round(n)}`;
}
function fmtFull$(n: number | null): string {
  if (n == null) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * Computes the relative gap between a broker (OM) value and an operator
 * override.  Returns null whenever either input is absent or broker is zero
 * (avoids div-by-zero; reserves are never legitimately 0 with a broker layer
 * present).  Exported so it can be tested in isolation without rendering the
 * full component.
 *
 * Phase 2 note: helper is intentionally generic so it can be reused on other
 * LV rows (PW-3 insurance, PW-7 reserves T12 layer, DS-7 management fee).
 */
export function computeDivergenceRatio(
  broker: number | null | undefined,
  override: number | null | undefined,
): number | null {
  if (broker == null || override == null || broker === 0) return null;
  return Math.abs(override - broker) / Math.abs(broker);
}

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtVal(row: OperatingStatementRow, val: number | null): string {
  if (val == null) return '—';
  if (PCT_FIELDS.has(row.field)) return fmtPct(val);
  if (PER_UNIT_FIELDS.has(row.field)) return `$${val}/unit`;
  return fmt$(val);
}

// ─── Correction state ─────────────────────────────────────────────────────────
interface CorrectionState {
  [field: string]: { editing: boolean; original: number | null; draft: string; savedAt?: string };
}

// ─── Main component ────────────────────────────────────────────────────────────
/**
 * Maps a proforma row's `source` / `resolution` string to an evidence tier number.
 * Evidence tier spec (from CASHFLOW_OUTPUT_SCHEMA):
 *   Tier 1 — Uploaded documents: T12, rent roll, tax bill
 *   Tier 2 — Platform-computed: proforma estimates, calibration, user overrides
 *   Tier 3 — Public / research datasets: BLS, CoStar, market research, agent
 *   Tier 4 — Broker OM (self-reported, lowest quality)
 */
function sourceToTier(source: string | null): number {
  const s = (source ?? '').toLowerCase();
  if (s === 't12' || s === 't12_trailing' || s === 'trailing_12' ||
      s === 'rent_roll' || s === 'rentroll' ||
      s === 'tax_bill'  || s === 'taxbill'  ||
      s === 'document'  || s === 'uploaded') return 1;
  if (s === 'platform' || s === 'computed' || s === 'proforma' ||
      s === 'calibration' || s === 'estimate' || s === 'user' ||
      s === 'engine:cashflow' || s.startsWith('engine:')) return 2;
  if (s === 'bls' || s === 'costar'  || s === 'public'  ||
      s === 'research' || s === 'market' ||
      s === 'agent'   || s === 'capsule' || s.startsWith('agent:')) return 3;
  if (s === 'broker' || s === 'om' || s === 'offering_memorandum' ||
      s === 'offering') return 4;
  return 0;
}

/**
 * Resolve evidence metadata AND canonical field_path for a ProForma row field.
 *
 * The underwriting evidence system stores field_paths like 'income.gpr' or 'expense.real_estate_tax'
 * while ProForma rows use short field names like 'gpr' or 'real_estate_tax'.
 * Returns both the metadata and the matched canonical path (used to open EvidencePanel).
 */
function resolveEvidence(
  rowField: string,
  evidenceFieldMap?: Record<string, EvidenceFieldMeta>
): { meta: EvidenceFieldMeta; path: string } | null {
  if (!evidenceFieldMap) return null;
  // 1. Exact match
  if (evidenceFieldMap[rowField]) return { meta: evidenceFieldMap[rowField], path: rowField };
  // 2. Suffix match — e.g. 'income.gpr' → matches 'gpr'
  const suffix = `.${rowField}`;
  for (const key of Object.keys(evidenceFieldMap)) {
    if (key.endsWith(suffix)) return { meta: evidenceFieldMap[key], path: key };
  }
  return null;
}

const TIER_BADGE_COLOR: Record<number, string> = {
  1: BT.accent.doc,    // cyan — deal docs (T12, rent roll, tax bill)
  2: '#60A5FA',        // blue — owned portfolio actuals
  3: BT.text.purple,   // purple — platform market intelligence
  4: BT.text.orange,   // orange — broker OM (low authority)
};
const TIER_LABEL: Record<number, string> = { 1: 'T1', 2: 'T2', 3: 'T3', 4: 'T4' };
const TIER_TOOLTIP: Record<number, string> = {
  1: 'Tier 1 · Deal documents (T12, rent roll, tax bill)',
  2: 'Tier 2 · Owned portfolio actuals',
  3: 'Tier 3 · Platform market intelligence',
  4: 'Tier 4 · Broker OM (unverified)',
};

/** Filter proforma rows by the active evidence summary-bar pill selection.
 *  - confidence: matched against row.confidence (0–1) using high/medium/low buckets.
 *  - tier: F9SummaryBar emits values '1'|'2'|'3'|'4'; mapped via sourceToTier().
 *  - collision: rows filtered to fields with collisions. Uses evidenceFieldMap (has_collision flag)
 *               when available; falls back to collisionFields path list otherwise.
 */
function applyEvidenceFilter(
  rows: OperatingStatementRow[],
  filter: { type: 'collision' | 'confidence' | 'tier'; value: string },
  evidenceFieldMap?: Record<string, EvidenceFieldMeta>,
  collisionFields?: string[] | null,
  severeCollisionFields?: string[] | null,
  materialCollisionFields?: string[] | null,
  minorCollisionFields?: string[] | null
): OperatingStatementRow[] {
  if (filter.type === 'confidence') {
    return rows.filter(r => {
      const c = r.confidence;
      if (c == null) return false;
      if (filter.value === 'high')   return c >= 0.8;
      if (filter.value === 'medium') return c >= 0.4 && c < 0.8;
      if (filter.value === 'low')    return c < 0.4;
      return true;
    });
  }
  if (filter.type === 'tier') {
    // F9SummaryBar emits '1'|'2'|'3'|'4' (not 'tier1'|…)
    const targetTier = parseInt(filter.value, 10);
    return rows.filter(r => {
      // Prefer tier from underwriting evidence when available; fall back to
      // legacy source-string mapping so rows without evidence still filter.
      const evidenceTier = resolveEvidence(r.field, evidenceFieldMap)?.meta.tier;
      const rowTier = evidenceTier ?? sourceToTier(r.source ?? r.resolution);
      return rowTier === targetTier;
    });
  }
  if (filter.type === 'collision') {
    // Severity-specific filtering: 'severe', 'material', and 'minor' use per-severity field lists.
    if (filter.value === 'severe' || filter.value === 'material' || filter.value === 'minor') {
      const severityFields = filter.value === 'severe' ? severeCollisionFields
        : filter.value === 'material' ? materialCollisionFields
        : minorCollisionFields;
      // Prefer per-severity field list from backend when available.
      if (severityFields && severityFields.length > 0) {
        const fieldSet = new Set(severityFields);
        return rows.filter(r => fieldSet.has(r.field));
      }
      // Fall back to evidenceFieldMap magnitude check.
      if (evidenceFieldMap) {
        return rows.filter(r => {
          const resolved = resolveEvidence(r.field, evidenceFieldMap);
          return resolved?.meta.collision_magnitude === filter.value;
        });
      }
      return rows;
    }
    // Generic collision filter — prefer evidenceFieldMap; fall back to collisionFields path list.
    if (evidenceFieldMap) {
      return rows.filter(r => {
        const resolved = resolveEvidence(r.field, evidenceFieldMap);
        return resolved?.meta.has_collision === true;
      });
    }
    if (collisionFields && collisionFields.length > 0) {
      const fieldSet = new Set(collisionFields);
      return rows.filter(r => fieldSet.has(r.field));
    }
    return rows;
  }
  return rows;
}

/** Maps a ProForma row source string to a source_documents document_type key. */
function mapSourceToDocType(source: string | null | undefined): string | null {
  if (!source) return null;
  const s = source.toLowerCase();
  if (s === 't12' || s === 't-12' || s === 't12_actuals') return 't12';
  if (s === 'rent_roll' || s === 'rentroll') return 'rent_roll';
  if (s === 'om' || s === 'offering_memorandum' || s === 'offering') return 'om';
  if (s === 'broker') return 'om';
  if (s === 'tax_bill' || s === 'taxbill') return 'tax_bill';
  return null;
}

export function ProFormaSummaryTab({ dealId, deal, modelResults, onIntegrityChange, evidenceFilter, evidenceFieldMap, collisionFields, severeCollisionFields, materialCollisionFields, minorCollisionFields, onF9Refresh, lvCostTreatmentView, onLvTreatmentViewChange, sourceDocuments, f9Financials, onTabChange }: FinancialEngineTabProps) {
  const viewMode             = useDealStore(s => s.viewMode);
  const setViewMode          = useDealStore(s => s.setViewMode);
  // Number of columns in the table. Expansion/sub-rows use this so they
  // correctly span the table in BROKER_VIEW (7 cols, T-period + Platform hidden)
  // vs BUILD_OWN (9 cols, all data columns visible).
  const tableColCount        = viewMode === 'BROKER_VIEW' ? 7 : 9;
  const y1Source             = useDealStore(s => s.y1Source);
  const setY1Source          = useDealStore(s => s.setY1Source);
  const platformColSource    = useDealStore(s => s.platformColSource);
  const stanceAffectedFields = useDealStore(s => s.stanceAffectedFields);

  // Map stance fieldPath → AffectedStanceField for ProForma row lookup
  const stanceByPath = useMemo(() => {
    const map: Record<string, import('../../../stores/dealContext.types').AffectedStanceField> = {};
    for (const af of (stanceAffectedFields ?? [])) map[af.fieldPath] = af;
    return map;
  }, [stanceAffectedFields]);

  const T_PERIODS = ['T12', 'T6', 'T3', 'T1'] as const;
  type TPeriod = typeof T_PERIODS[number];
  const activePeriod: TPeriod = (T_PERIODS as readonly string[]).includes(y1Source) ? y1Source as TPeriod : 'T12';
  const cycleTPeriod = () => {
    const idx = T_PERIODS.indexOf(activePeriod);
    setY1Source(T_PERIODS[(idx + 1) % T_PERIODS.length]);
  };
  // Whether each column is the "active" Y1 source (drives column header highlight)
  const y1IsBroker   = y1Source === 'BROKER';
  const y1IsTperiod  = (T_PERIODS as readonly string[]).includes(y1Source);

  const [stabRecalculating, setStabRecalculating] = useState(false);

  useEffect(() => {
    if (!dealId) return;
    const getSocket = () => (window as any).__jediSocket as { on?: (e: string, cb: (...a: any[]) => void) => void; off?: (e: string, cb: (...a: any[]) => void) => void } | null;
    const onRecalculating = (data: { dealId: string }) => {
      if (data?.dealId === dealId) setStabRecalculating(true);
    };
    const onUpdated = (data: { dealId: string }) => {
      if (data?.dealId !== dealId) return;
      setStabRecalculating(false);
      onF9Refresh?.();
    };
    const attach = () => {
      const s = getSocket();
      s?.on?.('stabilization_year_recalculating', onRecalculating);
      s?.on?.('stabilization_year_updated', onUpdated);
    };
    const detach = () => {
      const s = getSocket();
      s?.off?.('stabilization_year_recalculating', onRecalculating);
      s?.off?.('stabilization_year_updated', onUpdated);
    };
    attach();
    return detach;
  }, [dealId, onF9Refresh]);

  // Data Quality Alerts (Task #691)
  interface DqaAlert {
    id: string;
    document_type: string;
    proforma_column: string;
    proforma_row: string;
    classification: string;
    severity: 'critical' | 'warning' | 'info';
    agent_finding: {
      reasoning: string;
      extracted_value?: string | number | null;
      expected_value?: string | number | null;
      recommended_action?: string;
      source_evidence?: { page?: number | null; section?: string | null; snippet?: string | null };
    };
    status: string;
    created_at: string;
  }
  const [dqaAlerts, setDqaAlerts]     = useState<DqaAlert[]>([]);
  const [dqaLoading, setDqaLoading]   = useState(false);
  const [dqaDrawer, setDqaDrawer]     = useState<DqaAlert | null>(null);
  // Prevents firing more than one background refresh per page session (Task #707)
  const dqaRefreshedThisSession = useRef(false);
  // "Show absences" toggle — NOT_IN_DOC findings hidden by default (Task #696)
  const [showAbsences, setShowAbsences] = useState(false);

  // NOT_IN_DOC findings are info-severity verified absences; hidden by default.
  const dqaAbsenceCount = useMemo(() => dqaAlerts.filter(a => a.classification === 'NOT_IN_DOC').length, [dqaAlerts]);
  const visibleDqaAlerts = useMemo(
    () => showAbsences ? dqaAlerts : dqaAlerts.filter(a => a.classification !== 'NOT_IN_DOC'),
    [dqaAlerts, showAbsences]
  );

  // Keyed by proforma_row for O(1) DataRow lookup (uses filtered visible set)
  const dqaByRow = useMemo<Record<string, DqaAlert[]>>(() => {
    const m: Record<string, DqaAlert[]> = {};
    for (const a of visibleDqaAlerts) {
      if (!m[a.proforma_row]) m[a.proforma_row] = [];
      m[a.proforma_row].push(a);
    }
    return m;
  }, [visibleDqaAlerts]);

  const byDocType = useMemo<Record<string, SourceDocument>>(() => {
    if (!sourceDocuments) return {};
    return sourceDocuments.reduce<Record<string, SourceDocument>>((acc, doc) => {
      if (!acc[doc.document_type]) acc[doc.document_type] = doc;
      return acc;
    }, {});
  }, [sourceDocuments]);

  const dqaCriticalCount = dqaAlerts.filter(a => a.severity === 'critical').length;
  const dqaWarningCount  = dqaAlerts.filter(a => a.severity === 'warning' && a.classification !== 'NOT_IN_DOC').length;

  const loadDqaAlerts = useCallback(async () => {
    if (!dealId) return;
    setDqaLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; alerts: DqaAlert[] }>(
        `/api/v1/deals/${dealId}/data-quality-alerts`
      );
      setDqaAlerts(res.data?.alerts ?? []);
    } catch {
      // Non-fatal — DQA is a layer on top of the Pro Forma
    } finally {
      setDqaLoading(false);
    }
  }, [dealId]);

  const dismissDqaAlert = useCallback(async (id: string, reason?: string) => {
    try {
      await apiClient.patch(`/api/v1/deals/data-quality-alerts/${id}`, {
        status: 'dismissed',
        dismissalReason: reason,
      });
      setDqaAlerts(prev => prev.filter(a => a.id !== id));
      setDqaDrawer(null);
    } catch {
      // ignore
    }
  }, []);

  const [data, setData] = useState<DealFinancials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStabilized, setShowStabilized] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [corrections, setCorrections] = useState<CorrectionState>({});
  const [reservesPuDraft, setReservesPuDraft] = useState<string | null>(null);
  const [sigmaField, setSigmaField] = useState<{ tier: 'REALISTIC' | 'AGGRESSIVE' | 'HEROIC'; field: string; dScore: number } | null>(null);
  useEffect(() => {
    if (!sigmaField) return;
    const t = setTimeout(() => setSigmaField(null), 4000);
    return () => clearTimeout(t);
  }, [sigmaField]);

  // M36 — persistent aggregate plausibility badge (fires on mount + after each correction load)
  const [sigmaBand, setSigmaBand] = useState<{
    band: string;
    topVariable: string | null;
    topDScore: number | null;
  } | null>(null);

  // Proforma field name → sigma variable name (mirrors backend FIELD_TO_SIGMA_VAR)
  const PROFORMA_TO_SIGMA: Record<string, string> = {
    vacancy_loss:         'vacancyAtStabilization',
    loss_to_lease:        'lossToLeasePct',
    concessions:          'concessionsPct',
    management_fee:       'managementFeePct',
    insurance:            'insurancePerUnit',
    real_estate_taxes:    'propertyTaxPctOfRevenue',
    replacement_reserves: 'replacementReservesPerUnit',
    other_income:         'otherIncomePerUnit',
  };

  const fireFullPlausibility = useCallback(async (year1Rows: OperatingStatementRow[]) => {
    const assumptions: Record<string, number> = {};
    for (const row of year1Rows) {
      const sigmaVar = PROFORMA_TO_SIGMA[row.field];
      if (sigmaVar && row.resolved != null) {
        assumptions[sigmaVar] = row.resolved;
      }
    }
    if (Object.keys(assumptions).length === 0) return;
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: {
          band: string;
          topContributors: Array<{ variable: string; contribution: number }>;
        };
      }>('/api/v1/sigma/plausibility', { assumptions });
      if (res.data?.success && res.data.data?.band) {
        const top = res.data.data.topContributors?.[0] ?? null;
        setSigmaBand({
          band: res.data.data.band,
          topVariable: top?.variable ?? null,
          topDScore: top?.contribution ?? null,
        });
      }
    } catch { /* non-fatal */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data) return;
    fireFullPlausibility(data.proforma.year1);
  }, [data, fireFullPlausibility]);

  const [showAncillary, setShowAncillary] = useState(false);
  const [showUtilitiesBreakdown, setShowUtilitiesBreakdown] = useState(false);
  // Pattern A — GPR floor-plan grid expand
  const [gprExpanded, setGprExpanded] = useState(false);
  const [showPostStabView, setShowPostStabView] = useState(false);
  // Pattern B — per-row regime expand (keyed by field name)
  const [regimeExpandOpen, setRegimeExpandOpen] = useState<Record<string, boolean>>({});
  const toggleRegimeExpand = useCallback((field: string) => {
    setRegimeExpandOpen(prev => ({ ...prev, [field]: !prev[field] }));
  }, []);
  // Lifted from AncillaryExpansionPanel so the inline P&L rows can edit category overrides
  const [ancillaryCatEdit, setAncillaryCatEdit] = useState<{ cat: string; val: string } | null>(null);
  const [ancillaryCatBusy, setAncillaryCatBusy] = useState(false);
  const [conDrill, setConDrill] = useState<{
    open: boolean;
    periodLabel: string;
    recognizedAmount: number | null;
    earnedAmount: number | null;
    detail: ReturnType<typeof aggregateConcessionDetail>;
    source: 'earned' | 'recognized';
    calendarYearTotal: number | null;
    fiscalYearTotal: number | null;
  }>({ open: false, periodLabel: '', recognizedAmount: null, earnedAmount: null, detail: null, source: 'recognized', calendarYearTotal: null, fiscalYearTotal: null });

  const openY1Drill = useCallback(() => {
    const rec = data?.concessionRecognition;
    if (!rec || !data?.closeDate) return;
    const refDate = new Date(data.closeDate);
    const startYear = refDate.getFullYear();
    const startMonth = refDate.getMonth() + 1;
    const yyyymms: string[] = [];
    for (let i = 0; i < 12; i++) {
      const m = ((startMonth - 1 + i) % 12) + 1;
      const y = startYear + Math.floor((startMonth - 1 + i) / 12);
      yyyymms.push(`${y}${String(m).padStart(2, '0')}`);
    }
    const sum = yyyymms.reduce((s, k) => s + (rec.monthly[k] ?? 0), 0);
    // CF-16: was proforma.year1.find(r => r.field === 'concessions')?.resolved — Rule 3 anti-pattern.
    // year1Concessions is the treatment-adjusted earned amount exposed as a direct property.
    const earned = data.year1Concessions ?? null;
    const calYr = rec.by_calendar_year?.[String(startYear)] ?? null;
    const fisYr = rec.by_fiscal_year?.[String(startYear)] ?? null;
    setConDrill({
      open: true,
      periodLabel: `Y1 FROM ${data.closeDate}`,
      recognizedAmount: sum,
      earnedAmount: earned,
      detail: aggregateConcessionDetail(rec.monthly_detail, yyyymms),
      source: 'recognized',
      calendarYearTotal: calYr,
      fiscalYearTotal: fisYr,
    });
  }, [data]);

  // Prefer model results from the build pipeline; fall back to composer fetch.
  const modelData = modelResults ?? null;

  const load = useCallback(async () => {
    // Always fetch the composer financials — this populates data.proforma.year1
    // (the T12 operating statement) which is the primary render source for this
    // tab. modelResults is used separately for KPI overlays and must NOT gate
    // this fetch; skipping it left data=null and rendered a blank screen when a
    // saved model was already loaded on mount (from /financial-model/:id/latest).
    // leasing_cost_treatment is NOT passed as a URL param — the backend reads
    // operator_stance.leasingCostTreatment directly (Task #639). lvCostTreatmentView
    // is kept in the dep array so this tab re-fetches whenever treatment changes.
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: DealFinancials; message?: string }>(
        `/api/v1/deals/${dealId}/financials`,
      );
      const body = res.data;
      if (body?.success === false) throw new Error(body.message ?? 'Unknown error');
      const financials = body?.data ?? (body as unknown as DealFinancials);
      setData(financials);
      // Notify parent whether any integrity check is non-ok (warn or error blocks projections)
      if (onIntegrityChange && financials?.proforma?.integrityChecks) {
        const hasErrors = financials.proforma.integrityChecks.some(c => c.status !== 'ok');
        onIntegrityChange(hasErrors);
      }
      // Also trigger parent refresh so other tabs stay in sync
      if (onF9Refresh) onF9Refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load financials');
    } finally {
      setLoading(false);
    }
  // lvCostTreatmentView in deps: when parent updates treatment, load reference
  // changes → useEffect re-runs → re-fetches (backend reads treatment from stance).
  }, [dealId, onIntegrityChange, onF9Refresh, lvCostTreatmentView]);

  useEffect(() => { load(); }, [load]);

  // Load DQA alerts on mount and refresh after the main data loads
  useEffect(() => { loadDqaAlerts(); }, [loadDqaAlerts]);

  // Staleness check (Task #707): ask the server whether this deal's DQA findings are
  // stale (or have never been run).  Server controls the threshold (DQA_STALENESS_HOURS
  // env var) and handles the zero-alerts case.  Fires once per page session; backend
  // rate-limits the actual re-audit to once per deal per hour.
  // After triggering a refresh, polls the staleness endpoint every 3 s (up to 5 times)
  // and calls loadDqaAlerts() as soon as newestAlertAt changes, giving the user fresh
  // findings as soon as the background agent run completes.
  useEffect(() => {
    if (!dealId || dqaRefreshedThisSession.current) return;
    let cancelled = false;

    const pollForFreshAlerts = (remainingPolls: number, prevNewestAt: string | null) => {
      if (remainingPolls <= 0 || cancelled) {
        if (!cancelled) loadDqaAlerts();
        return;
      }
      setTimeout(async () => {
        if (cancelled) return;
        try {
          const poll = await apiClient.get<{ success: boolean; newestAlertAt: string | null }>(
            `/api/v1/deals/${dealId}/data-quality-alerts/staleness`
          );
          if ((poll.data?.newestAlertAt ?? null) !== prevNewestAt) {
            if (!cancelled) loadDqaAlerts();
            return;
          }
        } catch { /* ignore network errors during poll */ }
        pollForFreshAlerts(remainingPolls - 1, prevNewestAt);
      }, 3000);
    };

    apiClient
      .get<{ success: boolean; isStale: boolean; hasAlerts: boolean; newestAlertAt: string | null }>(
        `/api/v1/deals/${dealId}/data-quality-alerts/staleness`
      )
      .then(res => {
        const { isStale, hasAlerts, newestAlertAt } = res.data ?? {};
        if (isStale || !hasAlerts) {
          dqaRefreshedThisSession.current = true;
          apiClient
            .post(`/api/v1/deals/${dealId}/data-quality-alerts/refresh`)
            .then(() => { pollForFreshAlerts(5, newestAlertAt ?? null); })
            .catch(() => {});
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  // Run once on mount per dealId — loadDqaAlerts is a stable useCallback reference
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  // Reactive wiring: re-fetch when concession recognition is recomputed on the backend.
  // The amortization engine fires 'concession_recognition.updated' on the window event bus
  // after every engine run (treatment toggle, assumption change, write-off trigger).
  // Without this listener, the concessions DataRow could show stale recognized values until
  // the next lvCostTreatmentView change triggers a re-fetch.
  useEffect(() => {
    const handler = () => { load(); };
    window.addEventListener('concession_recognition.updated', handler);
    return () => window.removeEventListener('concession_recognition.updated', handler);
  }, [load]);

  const handleReparse = async () => {
    setReparsing(true);
    try {
      await apiClient.post(`/api/v1/deals/${dealId}/financials/reparse`);
      await load();
    } catch (e: unknown) {
      console.error('Reparse failed:', e instanceof Error ? e.message : e);
    } finally {
      setReparsing(false);
    }
  };

  const handleSaveCorrection = useCallback(async (field: string, value: number | null, original: number | null) => {
    try {
      // Translate to the camelCase field name the override endpoint expects.
      const apiField = field === 'management_fee' ? 'managementFeePct'
        : field === 'replacement_reserves' ? 'replacementReserves'
        : field;
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, {
        field: apiField,
        year: null,
        value,
      });
      setCorrections(prev => ({
        ...prev,
        [field]: { ...prev[field], editing: false, savedAt: new Date().toISOString(), original },
      }));
      // M36 — fire non-blocking plausibility check for the saved field value.
      if (value != null) {
        apiClient.post<{ success: boolean; data: { tier: 'REALISTIC' | 'AGGRESSIVE' | 'HEROIC'; dScore: number; sigmaVar: string | null } }>(
          '/api/v1/sigma/plausibility/field',
          { field, value },
        ).then(r => {
          if (r.data?.success && r.data.data.tier) {
            setSigmaField({ tier: r.data.data.tier, field, dScore: r.data.data.dScore ?? 0 });
          }
        }).catch(() => {});
      }
      load();
    } catch (e: unknown) {
      console.error('Override failed:', e instanceof Error ? e.message : e);
      setCorrections(prev => ({ ...prev, [field]: { ...prev[field], editing: false } }));
    }
  }, [dealId, load]);

  // Toggle the "Use Unit Mix as GPR source" per-deal flag.
  // Server resolves Year-1 GPR to Σ(count × in_place_rent × 12) when enabled.
  const handleToggleUnitMixGpr = useCallback(async (next: boolean) => {
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, {
        field: 'da:use_unit_mix_for_gpr',
        year: null,
        value: next,
      });
      await load();
    } catch (e: unknown) {
      console.error('Toggle use_unit_mix_for_gpr failed:', e instanceof Error ? e.message : e);
    }
  }, [dealId, load]);

  // Saves a per-category ancillary income override (annual $). Lifted from
  // AncillaryExpansionPanel so the inline P&L table rows can call it directly.
  const saveAncillaryCat = useCallback(async (cat: string, raw: string) => {
    setAncillaryCatBusy(true);
    try {
      const num = raw.trim() === '' ? null : parseFloat(raw);
      if (num != null && (!Number.isFinite(num) || num < 0)) { setAncillaryCatEdit(null); return; }
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, {
        field: `other_income_breakdown.${cat}`, year: null, value: num,
      });
      await load();
    } catch (e) { console.error('Ancillary override save failed:', e); }
    finally { setAncillaryCatBusy(false); setAncillaryCatEdit(null); }
  }, [dealId, load]);

  // Clears a user override on the backend (value: null = revert to ingested)
  const handleResetCorrection = useCallback(async (field: string) => {
    try {
      const apiField = field === 'management_fee' ? 'managementFeePct'
        : field === 'replacement_reserves' ? 'replacementReserves'
        : field;
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, {
        field: apiField,
        year: null,
        value: null,
      });
      load();
    } catch (e: unknown) {
      console.error('Reset override failed:', e instanceof Error ? e.message : e);
    } finally {
      setCorrections(prev => { const next = { ...prev }; delete next[field]; return next; });
    }
  }, [dealId, load]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: BT.text.muted, fontFamily: MONO, fontSize: 10 }}>
      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
      Loading AS-IS financials…
    </div>
  );

  if (error) return (
    <div style={{ padding: 24, fontFamily: MONO, fontSize: 10, color: BT.text.red }}>
      <div style={{ marginBottom: 8 }}>Failed: {error}</div>
      <button onClick={load} style={{ color: BT.text.cyan, background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 10 }}>Retry</button>
    </div>
  );

  if (!data) return null;

  // ── Phase 1A: Stabilization Window row derivation ─────────────────────────
  // When effectiveStabilizationYear > 1, overlay the operating statement with
  // the projection-year values for that stabilization year instead of Year 1.
  // Year 1 source values (broker/t12/platform) remain visible for reference;
  // only `resolved` and `resolution` are replaced from the projection.
  const _at = data.adoptionTimeline;
  const _effStabYear = _at?.effectiveStabilizationYear ?? null;
  const _stabYearIsOverride = _at?.stabilizationYearOverride != null;
  // True when adoptionTimeline is present, effectiveStabilizationYear is null, AND
  // no operator override has been set — deal never reaches threshold within hold period.
  const _proformaWindowUndefined = _at != null && _effStabYear == null && (_at.stabilizationYearOverride ?? null) == null;
  const _projRow = (_effStabYear != null && _effStabYear > 1 && Array.isArray((data as any).projections))
    ? (data as any).projections[_effStabYear - 1] as Record<string, number> | undefined
    : undefined;

  const PROJ_FIELD_MAP: Record<string, string> = {
    gpr: 'gpr', vacancy_loss: 'vacancyLoss', loss_to_lease: 'lossToLease',
    concessions: 'concessions', bad_debt: 'badDebt', non_revenue_units: 'nru',
    net_rental_income: 'nri', nri: 'nri', other_income: 'otherIncome', egi: 'egi',
    payroll: 'payroll', repairs_maintenance: 'repairs', turnover: 'turnover',
    contract_services: 'contractSvc', marketing: 'marketing', utilities: 'utilities',
    g_and_a: 'gAndA', management_fee: 'mgmtFee', insurance: 'insurance',
    real_estate_tax: 'reTaxes', replacement_reserves: 'reserves',
    total_opex: 'totalOpex', noi: 'noi', net_operating_income: 'noi',
  };

  const rows: OperatingStatementRow[] = _projRow
    ? data.proforma.year1.map(row => {
        const projKey = PROJ_FIELD_MAP[row.field];
        const projVal = projKey != null ? _projRow[projKey] : undefined;
        if (projVal === undefined || projVal === null) return row;
        const pu = data.totalUnits > 0 ? Math.round(projVal / data.totalUnits) : null;
        return { ...row, resolved: projVal, resolution: 'projected', perUnit: pu };
      })
    : data.proforma.year1;

  const checks = data.proforma.integrityChecks;
  const totalUnits = data.totalUnits;

  // ── Y1 recognized concessions (Task #574 §14) ──────────────────────────────
  // Sum of monthly[] values for the 12-month window starting at closeDate.
  // Year 1 = months [closeYYYYMM .. closeYYYYMM+11] — matches the analysis horizon
  // used in the rent build (first 12 months, not the closeDate's calendar year).
  // Requires closeDate: without it we cannot determine the Year-1 window; return null
  // so the concessions DataRow falls back to the server-provided earned value.
  // §14: recognized dollars — replaces the earned value in the concessions DataRow.
  const y1RecognizedConcessions: number | null = (() => {
    const rec = data.concessionRecognition;
    if (!rec) return null;
    // closeDate is required: without it Year-1 window is indeterminate.
    // Never fall back to current date — that would produce non-deterministic output.
    if (!data.closeDate) return null;
    const refDate = new Date(data.closeDate);
    const startYear  = refDate.getFullYear();
    const startMonth = refDate.getMonth() + 1; // 1-based
    // Build the 12 YYYYMM keys covering Year 1.
    const y1Keys = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const m = ((startMonth - 1 + i) % 12) + 1;
      const y = startYear + Math.floor((startMonth - 1 + i) / 12);
      y1Keys.add(`${y}${String(m).padStart(2, '0')}`);
    }
    const sum = Object.entries(rec.monthly)
      .filter(([k]) => y1Keys.has(k))
      .reduce((s, [, v]) => s + v, 0);
    // Return sum even if 0 — zero recognized concessions is a valid recognized value.
    // Only return null when the data window is not determinable (closeDate missing above).
    return sum;
  })();

  // Apply evidence summary-bar filter when a pill is active
  const displayRows = evidenceFilter ? applyEvidenceFilter(rows, evidenceFilter, evidenceFieldMap, collisionFields, severeCollisionFields, materialCollisionFields, minorCollisionFields) : rows;

  const byField: Record<string, OperatingStatementRow> = {};
  rows.forEach(r => { byField[r.field] = r; });

  const revRows     = displayRows.filter(r => REVENUE_FIELDS.has(r.field) && !SUBTOTALS.has(r.field));
  const preNriRows  = revRows.filter(r => ['vacancy_loss', 'loss_to_lease', 'concessions', 'bad_debt', 'non_revenue_units'].includes(r.field));
  const postNriRows = revRows.filter(r => r.field === 'other_income');
  // Spec order: sort by canonical sequence
  const CTRL_ORDER  = ['payroll','repairs_maintenance','turnover','contract_services','marketing','utilities','g_and_a'];
  const NCTRL_ORDER = ['management_fee','insurance','real_estate_tax'];
  const ctrlRows = displayRows.filter(r => CTRL_OPEX_FIELDS.has(r.field))
    .sort((a, b) => CTRL_ORDER.indexOf(a.field) - CTRL_ORDER.indexOf(b.field));
  const nctrlRows = displayRows.filter(r => NCTRL_OPEX_FIELDS.has(r.field) && !SUBTOTALS.has(r.field))
    .sort((a, b) => NCTRL_ORDER.indexOf(a.field) - NCTRL_ORDER.indexOf(b.field));
  const noiRow   = rows.find(r => r.field === 'noi');

  // Template ID — primary routing signal when present (Task #1355).
  // Computed before dealType so the template can drive pattern routing.
  // Falls back gracefully: null/unrecognized → deal_type-based render (backward compatible).
  const proformaTemplateId: string | null = data?.proformaTemplateId ?? null;
  const isFlipTemplate     = proformaTemplateId === 'flip';
  const isStrTemplate      = proformaTemplateId === 'str_shortterm';
  const isLandHoldTemplate = proformaTemplateId === 'land_hold';
  const isSpecialTemplate  = isFlipTemplate || isStrTemplate || isLandHoldTemplate;

  // Deal type — drives pattern routing (A/B/C per m09_line_item_patterns.ts).
  // Task #1355: when proformaTemplateId is present, derive effective deal type from it
  // so template-aware rendering is the primary signal, not deal.deal_type directly.
  // Null/unrecognised templateId falls through to the raw deal_type column (no regression
  // for pre-Task-#1233 deals that have deal_type but no investmentStrategy).
  const _rawDealType: string = (deal?.['deal_type'] as string | null) ?? (deal?.['dealType'] as string | null) ?? 'existing';
  const dealType: string = (() => {
    switch (proformaTemplateId) {
      case 'acquisition_stabilized':  return 'existing';
      case 'acquisition_value_add':   return 'value_add';
      case 'redevelopment':           return 'redevelopment';
      case 'development_ground_up':   return 'development';
      case 'flip':                    return 'value_add';
      case 'str_shortterm':           return 'existing';
      case 'land_hold':               return 'existing';
      default:                        return _rawDealType;
    }
  })();

  // Template-aware OPEX row filtering — only carry-relevant rows for flip/land_hold (Task #1236)
  const FLIP_CARRY_CTRL   = new Set<string>(['utilities']);
  const FLIP_CARRY_NCTRL  = new Set<string>(['real_estate_tax', 'insurance']);
  const LAND_HOLD_CTRL    = new Set<string>(['repairs_maintenance']);
  const LAND_HOLD_NCTRL   = new Set<string>(['real_estate_tax', 'insurance']);
  const templateCtrlRows  = isFlipTemplate    ? ctrlRows.filter(r => FLIP_CARRY_CTRL.has(r.field))
                          : isLandHoldTemplate ? ctrlRows.filter(r => LAND_HOLD_CTRL.has(r.field))
                          : ctrlRows;
  const templateNctrlRows = isFlipTemplate    ? nctrlRows.filter(r => FLIP_CARRY_NCTRL.has(r.field))
                          : isLandHoldTemplate ? nctrlRows.filter(r => LAND_HOLD_NCTRL.has(r.field))
                          : nctrlRows;

  const egiRow       = byField['egi'];
  const totalOpexRow = byField['total_opex'];
  const aggSlot = (rs: OperatingStatementRow[], key: keyof OperatingStatementRow) =>
    rs.every(r => r[key] == null) ? null : rs.reduce((s, r) => s + ((r[key] as number | null) ?? 0), 0);
  const ctrlSubtotalRow  = {
    resolved: ctrlRows.reduce((s, r) => s + (r.resolved ?? 0), 0),
    broker:   aggSlot(ctrlRows, 'broker'),
    t12:      aggSlot(ctrlRows, 't12'),
    t6:       aggSlot(ctrlRows, 't6'),
    t3:       aggSlot(ctrlRows, 't3'),
    t1:       aggSlot(ctrlRows, 't1'),
    platform: aggSlot(ctrlRows, 'platform'),
  };
  const nctrlSubtotalRow = {
    resolved: nctrlRows.reduce((s, r) => s + (r.resolved ?? 0), 0),
    broker:   aggSlot(nctrlRows, 'broker'),
    t12:      aggSlot(nctrlRows, 't12'),
    t6:       aggSlot(nctrlRows, 't6'),
    t3:       aggSlot(nctrlRows, 't3'),
    t1:       aggSlot(nctrlRows, 't1'),
    platform: aggSlot(nctrlRows, 'platform'),
  };
  // Template-specific subtotals — computed over the filtered carry rows (Task #1236)
  const tplCtrlSubtotal  = isSpecialTemplate ? {
    resolved: templateCtrlRows.reduce((s, r) => s + (r.resolved ?? 0), 0),
    broker:   aggSlot(templateCtrlRows, 'broker'),
    t12:      aggSlot(templateCtrlRows, 't12'),
    t6:       aggSlot(templateCtrlRows, 't6'),
    t3:       aggSlot(templateCtrlRows, 't3'),
    t1:       aggSlot(templateCtrlRows, 't1'),
    platform: aggSlot(templateCtrlRows, 'platform'),
  } : ctrlSubtotalRow;
  const tplNctrlSubtotal = isSpecialTemplate ? {
    resolved: templateNctrlRows.reduce((s, r) => s + (r.resolved ?? 0), 0),
    broker:   aggSlot(templateNctrlRows, 'broker'),
    t12:      aggSlot(templateNctrlRows, 't12'),
    t6:       aggSlot(templateNctrlRows, 't6'),
    t3:       aggSlot(templateNctrlRows, 't3'),
    t1:       aggSlot(templateNctrlRows, 't1'),
    platform: aggSlot(templateNctrlRows, 'platform'),
  } : nctrlSubtotalRow;

  const egiResolved = egiRow?.resolved ?? null;

  const warnChecks = checks.filter(c => c.status !== 'ok');

  // Purchase price from deal prop — use bracket access to avoid any cast
  const purchasePrice: number | null =
    (deal?.['purchase_price'] as number | null) ??
    (deal?.['asking_price'] as number | null) ??
    (deal?.['deal_data'] as Record<string, unknown> | null)?.['purchase_price'] as number | null ??
    null;

  const capRate = data.assumptions.exitCap;

  // ── Below-the-line: Replacement Reserves → NOI After Reserves ──────────────
  const reservesRow      = byField['replacement_reserves'] ?? null;
  const reservesResolved = reservesRow?.resolved ?? null;
  // WBB-1: divergence badge — broker (OM) vs operator override only.
  // The 'override' layer surfaces as resolved when resolution === 'override'.
  const _reservesOverrideVal = reservesRow?.resolution === 'override' ? reservesRow.resolved : null;
  const _reservesDivergence  = computeDivergenceRatio(reservesRow?.broker, _reservesOverrideVal);
  const showReservesDivergenceBadge = _reservesDivergence !== null && _reservesDivergence > 0.5;
  const noiAfterReserves =
    noiRow?.resolved != null && reservesResolved != null
      ? Math.round(noiRow.resolved - Math.abs(reservesResolved))
      : null;
  const noiAfterReservesBroker =
    noiRow?.broker != null && reservesRow?.broker != null
      ? Math.round(noiRow.broker - Math.abs(reservesRow.broker))
      : null;

  // ── Debt Service (computed from capital stack — Year-1 snapshot) ─────────────
  const cs = data.capitalStack;
  const dsInterest: number | null =
    cs.loanAmount != null && cs.loanAmount > 0 && cs.interestRate != null
      ? Math.round(cs.loanAmount * cs.interestRate)
      : null;
  const dsPrincipal: number | null = (() => {
    if (dsInterest == null || cs.loanAmount == null) return null;
    if (cs.ioPeriodMonths != null && cs.ioPeriodMonths > 0) return 0;
    if (!cs.amortizationYears || cs.amortizationYears <= 0 || !cs.interestRate || cs.interestRate <= 0) return null;
    const r = cs.interestRate / 12;
    const n = cs.amortizationYears * 12;
    const monthlyPmt = cs.loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return Math.max(0, Math.round(monthlyPmt * 12 - dsInterest));
  })();
  const dsTotalService: number | null =
    dsInterest != null ? dsInterest + (dsPrincipal ?? 0) : null;
  const isIO = cs.ioPeriodMonths != null && cs.ioPeriodMonths > 0;

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: BT.bg.terminal, color: '#e2e8f0', fontFamily: LABEL }}>

      {/* ── Header bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', height: 40, flexShrink: 0,
        background: BT.bg.header, borderBottom: '1px solid #1e1e1e',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Template badge — only shown for non-standard templates */}
          {isFlipTemplate && (
            <span title="Flip template: acquisition basis + renovation + carrying costs + resale exit" style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#f97316', background: '#1c0a00', border: '1px solid #f9731644', padding: '2px 6px', borderRadius: 2, letterSpacing: '0.06em' }}>
              FLIP
            </span>
          )}
          {isStrTemplate && (
            <span title="Short-Term Rental template: ADR / RevPAR / occupancy revenue model" style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#a78bfa', background: '#0d0a1c', border: '1px solid #a78bfa44', padding: '2px 6px', borderRadius: 2, letterSpacing: '0.06em' }}>
              STR
            </span>
          )}
          {isLandHoldTemplate && (
            <span title="Land Hold template: no rental income — land carry + disposition only" style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#84cc16', background: '#0a1400', border: '1px solid #84cc1644', padding: '2px 6px', borderRadius: 2, letterSpacing: '0.06em' }}>
              LAND HOLD
            </span>
          )}
          {/* ── Phase 1A: Stabilization Year badge ── */}
          {_effStabYear != null && (
            <span
              title={`Pro Forma operating statement uses Year ${_effStabYear} (stabilization window)${_stabYearIsOverride ? ' · operator override' : ' · agent-computed'}`}
              style={{
                fontFamily: MONO, fontSize: 8, fontWeight: 700,
                color: _stabYearIsOverride ? '#a78bfa' : '#34d399',
                background: _stabYearIsOverride ? '#1a1530' : '#0a2015',
                border: `1px solid ${_stabYearIsOverride ? '#4c1d9544' : '#065f4644'}`,
                padding: '2px 6px', borderRadius: 2, letterSpacing: '0.06em', cursor: 'default',
              }}
            >
              PRO FORMA · YR {_effStabYear}{_stabYearIsOverride ? ' · OVR' : ''}
            </span>
          )}
          <PeriodicTimelineTrigger dealId={dealId} preset="full" label="Timeline" />
          {/* ── Phase 1A: Window undefined badge ── */}
          {_proformaWindowUndefined && (
            <span
              title="Pro Forma window undefined — deal does not reach the stabilization threshold within the hold period. Set a Pro Forma Year override in the INPUTS tab."
              style={{
                fontFamily: MONO, fontSize: 8, fontWeight: 700,
                color: '#fbbf24', background: '#1c1200',
                border: '1px solid #f59e0b55',
                padding: '2px 6px', borderRadius: 2, letterSpacing: '0.06em', cursor: 'default',
              }}
            >
              WINDOW UNDEFINED
            </span>
          )}
          {/* DQA aggregate badge — shows when agent has found issues */}
          {(dqaCriticalCount > 0 || dqaWarningCount > 0) && (
            <button
              title={`Data Quality: ${dqaCriticalCount} critical, ${dqaWarningCount} warning`}
              onClick={() => loadDqaAlerts()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: dqaCriticalCount > 0 ? '#1c0a0a' : '#1a1200',
                border: `1px solid ${dqaCriticalCount > 0 ? '#ef4444' : '#f59e0b'}`,
                borderRadius: 2, padding: '1px 6px', cursor: 'pointer',
                fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.05em',
                color: dqaCriticalCount > 0 ? '#f87171' : '#fcd34d',
              }}
            >
              <ShieldAlert size={8} />
              DQA{dqaCriticalCount > 0 ? ` · ${dqaCriticalCount} CRIT` : ''}
              {dqaWarningCount > 0 ? ` · ${dqaWarningCount} WARN` : ''}
            </button>
          )}
          {/* "Show absences" toggle — revealed only when NOT_IN_DOC findings exist */}
          {dqaAbsenceCount > 0 && (
            <button
              title={showAbsences ? 'Hide verified-absence findings' : `Show ${dqaAbsenceCount} verified absence${dqaAbsenceCount !== 1 ? 's' : ''}`}
              onClick={() => setShowAbsences(v => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                background: showAbsences ? '#0c1a2a' : 'transparent',
                border: `1px solid ${showAbsences ? '#3b82f6' : '#334155'}`,
                borderRadius: 2, padding: '1px 6px', cursor: 'pointer',
                fontFamily: MONO, fontSize: 7, fontWeight: 600, letterSpacing: '0.05em',
                color: showAbsences ? '#93c5fd' : '#475569',
              }}
            >
              {showAbsences ? `HIDE ABSENCES` : `${dqaAbsenceCount} ABSENCE${dqaAbsenceCount !== 1 ? 'S' : ''}`}
            </button>
          )}
          {dqaAlerts.length === 0 && !dqaLoading && (
            <span
              title="Data Quality Agent: no issues found"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 8, color: '#22c55e', fontFamily: LABEL }}
            >
              <ShieldCheck size={8} />
            </span>
          )}
          {/* M36 — persistent aggregate plausibility badge */}
          {sigmaBand && (() => {
            const band = sigmaBand.band;
            const isRealistic = band === 'Realistic' || band === 'Stretch';
            const isAggressive = band === 'Aggressive';
            const tc = isRealistic ? '#22c55e' : isAggressive ? '#f59e0b' : '#ef4444';
            const bg = isRealistic ? '#0a1c10' : isAggressive ? '#1a1200' : '#1c0a0a';
            const topTip = sigmaBand.topVariable
              ? `Top contributor: ${sigmaBand.topVariable}${sigmaBand.topDScore != null ? ` (d=${sigmaBand.topDScore.toFixed(2)})` : ''}`
              : '';
            const tooltip = `M36 Σ plausibility: ${band}${topTip ? ' · ' + topTip : ''}`;
            return (
              <span
                title={tooltip}
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '2px 6px', borderRadius: 2,
                  background: bg, border: `1px solid ${tc}33`,
                  fontFamily: MONO, fontSize: 8, color: tc, fontWeight: 700, letterSpacing: 0.4,
                  cursor: 'default',
                }}
              >
                Σ {band.toUpperCase()}
              </span>
            );
          })()}
        </div>

        {/* ── View mode + Y1 source controls ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* BROKER VIEW / BUILD YOUR OWN toggle */}
          <div style={{ display: 'flex', background: '#1a1a1a', padding: 2, borderRadius: 3, border: '1px solid #2a2a2a' }}>
            {(['BROKER_VIEW', 'BUILD_OWN'] as const).map(mode => (
              <button key={mode} onClick={() => { setViewMode(mode); setShowStabilized(false); }} style={{
                padding: '3px 10px', fontSize: 9, fontWeight: 700, borderRadius: 2, border: 'none', cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.06em', transition: 'all 0.15s',
                background: !showStabilized && viewMode === mode ? (mode === 'BROKER_VIEW' ? 'rgba(180,83,9,0.5)' : 'rgba(29,78,216,0.5)') : 'transparent',
                color: !showStabilized && viewMode === mode ? (mode === 'BROKER_VIEW' ? '#fcd34d' : '#bfdbfe') : '#475569',
              }}>
                {mode === 'BROKER_VIEW' ? 'BROKER VIEW' : 'BUILD YOUR OWN'}
              </button>
            ))}
            <button
              onClick={() => !isSpecialTemplate && setShowStabilized(v => !v)}
              disabled={isSpecialTemplate}
              style={{
                padding: '3px 10px', fontSize: 9, fontWeight: 700, borderRadius: 2, border: 'none',
                cursor: isSpecialTemplate ? 'not-allowed' : 'pointer',
                fontFamily: MONO, letterSpacing: '0.06em', transition: 'all 0.15s',
                background: (!isSpecialTemplate && showStabilized) ? 'rgba(99,102,241,0.5)' : 'transparent',
                color: (!isSpecialTemplate && showStabilized) ? '#c7d2fe' : '#3d3d3d',
                opacity: isSpecialTemplate ? 0.4 : 1,
              }}
              title={isSpecialTemplate ? 'Not available for this deal type' : 'M09 — Stabilized Potential: 4-column bridge view'}
            >
              STABILIZED POTENTIAL
            </button>
            <button
              onClick={() => { setShowPostStabView(v => !v); setShowStabilized(false); }}
              style={{
                padding: '3px 10px', fontSize: 9, fontWeight: 700, borderRadius: 2, border: 'none', cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.06em', transition: 'all 0.15s',
                background: showPostStabView ? 'rgba(34,197,94,0.25)' : 'transparent',
                color: showPostStabView ? '#86efac' : '#475569',
              }}
              title="Post-Stabilization view — hides renovation cost + yield columns in GPR grid"
            >
              POST-STAB VIEW
            </button>
          </div>
        </div>

        {/* KPI pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Per-deal toggle: Use Unit Mix as GPR source.
              When ON, server resolves Year-1 GPR to Σ(count × in_place_rent × 12) from the Unit Mix tab. */}
          {(() => {
            const rrs = data?.rentRollSummary ?? null;
            const hasUnitMix = !!(rrs?.unitMix && rrs.unitMix.length > 0);
            const useUM = !!rrs?.useUnitMixForGpr;
            const gprUM = rrs?.gprFromUnitMix ?? null;
            if (!hasUnitMix && !useUM) return null;
            const gprResolved = byField['gpr']?.resolved ?? null;
            const isActive = useUM && gprUM != null && gprUM > 0;
            const titleHint = !hasUnitMix
              ? 'No unit mix on file — add rows in the Unit Mix tab to enable.'
              : useUM
                ? `Year-1 GPR resolved from Unit Mix: ${fmt$(gprUM ?? gprResolved)}`
                : `Would set Year-1 GPR to ${fmt$(gprUM)} (Σ count × in-place rent × 12)`;
            return (
              <button
                type="button"
                title={titleHint}
                onClick={() => handleToggleUnitMixGpr(!useUM)}
                disabled={!hasUnitMix && !useUM}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '2px 8px', borderRadius: 2,
                  border: `1px solid ${isActive ? '#06b6d4' : '#27272a'}`,
                  background: isActive ? '#062a3a' : '#111827',
                  color: isActive ? '#06b6d4' : '#64748b',
                  fontFamily: LABEL, fontSize: 9, fontWeight: 600,
                  cursor: (!hasUnitMix && !useUM) ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.05em',
                }}
              >
                <span style={{
                  display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                  background: isActive ? '#06b6d4' : '#27272a',
                  boxShadow: isActive ? '0 0 6px #06b6d4' : 'none',
                }} />
                GPR FROM UNIT MIX{isActive ? ' · ON' : ''}
              </button>
            );
          })()}
          {[
            { l: 'GPR', v: fmt$(byField['gpr']?.resolved ?? null) },
            { l: 'EGI', v: fmt$(egiResolved) },
            { l: 'NOI/Unit', v: noiRow?.resolved && totalUnits ? `$${Math.round(noiRow.resolved / totalUnits).toLocaleString()}` : '—' },
          ].map(k => (
            <div key={k.l} style={{ display: 'flex', alignItems: 'baseline', gap: 4, padding: '2px 8px', borderRadius: 2, border: '1px solid #27272a', background: '#111827' }}>
              <span style={{ fontFamily: LABEL, fontSize: 9, color: '#64748b' }}>{k.l}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: '#e2e8f0' }}>{k.v}</span>
            </div>
          ))}

          {/* TS-1 T1 — Three-quantity NOI-endpoint pills. Sourced strictly from the
              live model payload (modelData.summary.noiYear1 / .noiStabilized,
              modelData.evidence.fields[].value for the 'inPlaceNOI' entry). Tooltip is
              that evidence entry's `reasoning` string verbatim — no new copy is written
              here. When an entry is absent for the current deal (observed: Highlands'
              latest model has no `inPlaceNOI` evidence entry, unlike Bishop's), the pill
              renders '—' with no tooltip rather than fabricating a value or reasoning. */}
          {(() => {
            const md: any = modelData;
            const summary = md?.summary ?? {};
            const evidenceFields: any[] = md?.evidence?.fields ?? [];
            const inPlaceEntry = evidenceFields.find((e) => e?.field === 'inPlaceNOI');
            const noiEntry = evidenceFields.find((e) => e?.field === 'NOI');
            const y1Val = typeof summary.noiYear1 === 'number' ? summary.noiYear1 : null;
            const stabVal = typeof summary.noiStabilized === 'number' ? summary.noiStabilized : null;
            const inPlaceVal = typeof inPlaceEntry?.value === 'number' ? inPlaceEntry.value : null;
            if (y1Val == null && stabVal == null && inPlaceVal == null) return null;
            const pills: { l: string; v: number | null; tip?: string }[] = [
              { l: 'IN-PLACE NOI', v: inPlaceVal, tip: inPlaceEntry?.reasoning },
              { l: 'Y1 NOI', v: y1Val, tip: noiEntry?.reasoning },
              { l: 'STABILIZED', v: stabVal },
            ];
            return (
              <>
                {pills.map(p => (
                  <div
                    key={p.l}
                    title={p.tip ?? undefined}
                    style={{
                      display: 'flex', alignItems: 'baseline', gap: 4, padding: '2px 8px',
                      borderRadius: 2, border: '1px solid #27272a', background: '#111827',
                      cursor: p.tip ? 'help' : 'default',
                    }}
                  >
                    <span style={{ fontFamily: LABEL, fontSize: 9, color: '#64748b' }}>{p.l}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: '#e2e8f0' }}>
                      {p.v != null ? fmt$(p.v) : '—'}
                    </span>
                  </div>
                ))}
              </>
            );
          })()}
        </div>


        {/* Integrity badges + reparse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {checks.map(c => c.status === 'ok'
            ? <span key={c.id} title={c.message} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#22c55e', fontFamily: LABEL }}>
                <CheckCircle2 size={11} />{c.id}
              </span>
            : <span key={c.id} title={c.message} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#f59e0b', fontFamily: LABEL }}>
                <AlertTriangle size={11} />{c.id}
              </span>
          )}
          <button
            onClick={handleReparse}
            disabled={reparsing}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 2, border: 'none',
              background: '#1e293b', color: '#93c5fd', cursor: reparsing ? 'wait' : 'pointer',
              fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
            }}
          >
            <RefreshCw size={10} style={reparsing ? { animation: 'spin 1s linear infinite' } : undefined} />
            REPARSE
          </button>
        </div>
      </div>

      {/* ── Integrity check detail banners (warn/error only) ── */}
      {warnChecks.length > 0 && (
        <div style={{ flexShrink: 0, borderBottom: '1px solid #1e1e1e' }}>
          {warnChecks.map(c => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 12px',
              background: c.status === 'error' ? '#1c0a0a' : '#1c1200',
              borderLeft: `3px solid ${c.status === 'error' ? '#ef4444' : '#f59e0b'}`,
            }}>
              {c.status === 'error'
                ? <XCircle size={11} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                : <AlertTriangle size={11} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
              }
              <span style={{ fontFamily: LABEL, fontSize: 9, color: c.status === 'error' ? '#fca5a5' : '#fcd34d', lineHeight: 1.4 }}>
                <strong style={{ fontFamily: MONO }}>{c.id}</strong> — {c.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Stance-modulated fields banner ── */}
      {stanceAffectedFields && stanceAffectedFields.length > 0 && (
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 12px', background: '#14100000',
          borderBottom: '1px solid #f59e0b33',
          borderLeft: '3px solid #f59e0b',
        }}>
          <span style={{ color: '#f59e0b', fontSize: 9, fontWeight: 700, fontFamily: MONO, letterSpacing: '0.06em', flexShrink: 0 }}>
            ● STANCE ACTIVE
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {stanceAffectedFields.map(af => (
              <span
                key={af.fieldPath}
                title={af.trace}
                style={{
                  fontFamily: MONO, fontSize: 8, color: '#f59e0b',
                  background: '#1a1200', border: '1px solid #f59e0b33',
                  borderRadius: 2, padding: '1px 5px', cursor: 'help',
                }}
              >
                {af.fieldPath} {af.deltaBps > 0 ? `+${af.deltaBps}` : af.deltaBps}bps
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Not-yet-supported full-page notice (flip / STR / land_hold) ─────────
           Replaces the entire scrollable body regardless of view toggle state.
           showStabilized and showPostStabView are no-ops for special templates —
           the STABILIZED POTENTIAL button is disabled (see header bar above).
           Table rows from Task #1236 remain in DOM below but hidden.         ── */}
      {isSpecialTemplate && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '48px 32px', background: BT.bg.terminal, gap: 20,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: '#1a0f2e', border: '2px solid #7c3aed66',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>⚠</div>
          <div style={{ textAlign: 'center', maxWidth: 440 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.06em', marginBottom: 10 }}>
              {isFlipTemplate && 'FLIP DEALS — NOT YET FULLY SUPPORTED'}
              {isStrTemplate && 'SHORT-TERM RENTAL — NOT YET FULLY SUPPORTED'}
              {isLandHoldTemplate && 'LAND HOLD — NOT YET FULLY SUPPORTED'}
            </div>
            <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>
              {isFlipTemplate && 'The cashflow projection engine does not yet model Flip deals. Acquisition basis, renovation budget, and resale exit inputs are not connected to projections or return calculations.'}
              {isStrTemplate && 'The cashflow projection engine does not yet model Short-Term Rental revenue. ADR, RevPAR, and occupancy-based income are not connected to projections or return calculations.'}
              {isLandHoldTemplate && 'The cashflow projection engine does not yet model Land Hold deals. Carry costs and disposition are not connected to projections or return calculations.'}
            </div>
            <div style={{ fontFamily: 'sans-serif', fontSize: 10, color: '#475569', marginTop: 12, lineHeight: 1.5 }}>
              Full modeling for this deal type is planned for a future release.
              Other deal capsule tabs (zoning, market intelligence, strategy) remain fully functional.
            </div>
          </div>
        </div>
      )}

      {/* ── Stabilized Potential (M09) overlay — suppressed for special templates ── */}
      {!isSpecialTemplate && showStabilized && dealId && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <StabilizedPotentialView dealId={dealId} />
        </div>
      )}

      {/* ── Unit Mix Mismatch Banner (suppressed for special templates) ── */}
      {!showStabilized && !isSpecialTemplate && (
        <UnitMixMismatchBannerConnected
          f9Financials={f9Financials}
          deal={deal}
          dealId={dealId}
          onGoToUnitMix={() => {
            onTabChange?.(1);
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('fe-console-subtab', { detail: { subTab: 'unitmix' } }));
            }, 50);
          }}
        />
      )}

      {/* ── Scrollable body (hidden for special templates or when stabilized view active) ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', display: (isSpecialTemplate || showStabilized) ? 'none' : undefined }}>

        {/* ── VALUATION SNAPSHOT STRIP ── */}
        {data.proforma.valuationSnapshot && (
          <ValuationSnapshotStrip vs={data.proforma.valuationSnapshot} />
        )}

        {/* ── STABILIZATION WINDOW STRIP (Phase 1A) ── */}
        {(() => {
          const at = data.adoptionTimeline;
          if (!at) return null;
          const effYear = at.effectiveStabilizationYear;
          const agentYear = at.stabilizationYear;
          const overrideYear = at.stabilizationYearOverride;
          const targPct = at.stabilizationTargetPct;
          const mktVac = at.submarketVacancyRate;
          const mktAsOf = at.submarketVacancyAsOf;
          const isOverridden = overrideYear != null && overrideYear !== agentYear;

          // Undefined state — agent has run (or timeline exists) but no qualifying year found
          // and no operator override pinned. Show amber warning strip.
          if (_proformaWindowUndefined) {
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '5px 12px',
                background: '#1a0f00', borderBottom: '1px solid #92400e55',
                fontFamily: MONO, fontSize: 9, color: '#fbbf24', flexWrap: 'wrap',
              }}>
                <span style={{ color: '#d97706', fontWeight: 700, letterSpacing: '0.08em', fontSize: 8 }}>
                  PRO FORMA WINDOW UNDEFINED
                </span>
                {targPct != null && (
                  <span style={{ color: '#92400e' }}>
                    TARGET <span style={{ color: '#b45309' }}>{(targPct * 100).toFixed(0)}% OCC</span>
                    <span style={{ color: '#78350f', marginLeft: 4 }}>— no year meets threshold within hold period</span>
                  </span>
                )}
                {mktVac != null && (
                  <span style={{ color: '#44280a' }}>
                    MKT VAC <span style={{ color: '#78350f' }}>{(mktVac * 100).toFixed(1)}%</span>
                    {mktAsOf && <span style={{ color: '#2d1a00', marginLeft: 2 }}>({mktAsOf})</span>}
                  </span>
                )}
              </div>
            );
          }

          const hasData = effYear != null || agentYear != null || targPct != null;
          if (!hasData) return null;
          return (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '5px 12px',
              background: '#0c1a0c',
              borderBottom: '1px solid #14532d44',
              fontFamily: MONO,
              fontSize: 9,
              color: '#86efac',
              flexWrap: 'wrap',
            }}>
              <span style={{ color: '#16a34a', fontWeight: 700, letterSpacing: '0.08em', fontSize: 8 }}>
                PRO FORMA WINDOW
              </span>
              {(() => {
                const profile = at.effectiveLifecycleProfile ?? at.lifecycleProfile ?? null;
                if (!profile) return null;
                const isProfileOverride = at.lifecycleProfileOverride != null;
                return (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      background: '#1e1b4b', border: '1px solid #4c1d9544',
                      borderRadius: 2, padding: '0 4px',
                      color: '#a78bfa', fontSize: 8, fontWeight: 700, letterSpacing: 0.6,
                    }}>
                      {profile.replace('_', '-')}
                    </span>
                    {isProfileOverride && (
                      <span style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', borderRadius: 2, padding: '0 3px', color: '#a78bfa', fontSize: 7 }}>OVERRIDE</span>
                    )}
                  </span>
                );
              })()}
              {effYear != null && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#4ade80' }}>YEAR {effYear}</span>
                  {isOverridden && (
                    <span style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', borderRadius: 2, padding: '0 3px', color: '#a78bfa', fontSize: 8 }}>OVERRIDE</span>
                  )}
                  {!isOverridden && agentYear != null && (
                    <span style={{ color: '#166534', fontSize: 8 }}>agent</span>
                  )}
                </span>
              )}
              {targPct != null && (
                <span style={{ color: '#86efac' }}>
                  TARGET <span style={{ color: '#4ade80' }}>{(targPct * 100).toFixed(0)}% OCC</span>
                </span>
              )}
              {mktVac != null && (
                <span style={{ color: '#6b7280' }}>
                  MKT VAC <span style={{ color: '#9ca3af' }}>{(mktVac * 100).toFixed(1)}%</span>
                  {mktAsOf && <span style={{ color: '#4b5563', marginLeft: 2 }}>({mktAsOf})</span>}
                </span>
              )}
              {/* ── Block 7e invariant check chip ── */}
              {(() => {
                const ic = at.invariantCheck;
                if (!ic || ic.status === 'SKIPPED') return null;
                const passed = ic.status === 'PASSED';
                const deltaPct = ic.delta_pct != null ? (ic.delta_pct * 100).toFixed(1) : null;
                const tooltipLines = [
                  ic.reason,
                  ic.pre_stab_noi != null ? `Pre-stab NOI: $${Math.round(ic.pre_stab_noi).toLocaleString()}` : null,
                  ic.stab_noi     != null ? `At-stab NOI: $${Math.round(ic.stab_noi).toLocaleString()}`     : null,
                  ic.delta_pct    != null ? `Gap: ${(ic.delta_pct * 100).toFixed(1)}%`                       : null,
                ].filter(Boolean).join(' · ');
                return (
                  <span
                    title={tooltipLines}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      background: passed ? '#052e16' : '#1a0a00',
                      border: `1px solid ${passed ? '#16a34a55' : '#d9770655'}`,
                      borderRadius: 3,
                      padding: '1px 6px',
                      color: passed ? '#4ade80' : '#fb923c',
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      cursor: 'help',
                    }}
                  >
                    {passed
                      ? '✓ CONSISTENT'
                      : `⚠ BOUNDARY GAP ${deltaPct != null ? `${deltaPct}%` : ''}`}
                  </span>
                );
              })()}
              {effYear != null && effYear > 1 && (
                <span style={{
                  marginLeft: 'auto',
                  color: '#15803d',
                  background: '#052e16',
                  border: '1px solid #14532d',
                  borderRadius: 3,
                  padding: '1px 6px',
                  fontSize: 8,
                  letterSpacing: '0.06em',
                }}>
                  SHOWING Y{effYear} PROJECTION
                </span>
              )}
              {stabRecalculating && (
                <span
                  className="animate-pulse"
                  style={{
                    marginLeft: effYear == null || effYear <= 1 ? 'auto' : undefined,
                    display: 'flex', alignItems: 'center', gap: 4,
                    color: '#22d3ee',
                    background: '#083344',
                    border: '1px solid #0891b244',
                    borderRadius: 3,
                    padding: '1px 7px',
                    fontSize: 8,
                    letterSpacing: '0.08em',
                    fontWeight: 700,
                  }}
                >
                  AUTO-UPDATING…
                </span>
              )}
            </div>
          );
        })()}

        {/* ── PRO FORMA UNDEFINED banner (Phase 1A undefined-window state) ── */}
        {_proformaWindowUndefined && (
          <div style={{
            padding: '10px 16px',
            background: '#150e00',
            borderBottom: '2px solid #f59e0b44',
            borderLeft: '3px solid #f59e0b',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.06em' }}>
                ⚠ PRO FORMA WINDOW UNDEFINED
              </span>
            </div>
            <div style={{ fontFamily: LABEL, fontSize: 11, color: '#b45309', lineHeight: 1.6, marginBottom: 4 }}>
              This deal does not reach the stabilization threshold within the hold period.
              The operating statement below uses Year-1 values as an unanchored reference only.
            </div>
            <div style={{ fontFamily: LABEL, fontSize: 10, color: '#78350f', lineHeight: 1.5, marginBottom: 6 }}>
              Set a <strong style={{ color: '#d97706' }}>Pro Forma Year override</strong> in the INPUTS panel,
              or re-run the Cashflow Agent after adjusting vacancy trajectory inputs.
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('fe-console-subtab', { detail: { subTab: 'inputs' } }))}
              style={{
                fontFamily: MONO, fontSize: 8,
                color: '#fbbf24', background: '#2d1a00',
                border: '1px solid #f59e0b55', borderRadius: 2,
                padding: '3px 10px', cursor: 'pointer', letterSpacing: '0.04em',
              }}
            >
              GO TO INPUTS → PRO FORMA YEAR OVERRIDE
            </button>
          </div>
        )}

        {/* ── SECTION B — T-12 Operating Statement ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 10, opacity: _proformaWindowUndefined ? 0.5 : undefined }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            {_proformaWindowUndefined && (
              <tr style={{ background: '#1a0f00' }}>
                <td
                  colSpan={9}
                  style={{
                    padding: '2px 12px', fontFamily: MONO, fontSize: 8,
                    color: '#92400e', letterSpacing: '0.10em', textAlign: 'center',
                    borderBottom: '1px solid #92400e33',
                  }}
                >
                  UNANCHORED BASIS — YEAR-1 REFERENCE ONLY
                </td>
              </tr>
            )}
            <tr style={{ background: BT.bg.header, borderBottom: '1px solid #2d2d2d' }}>
              <Th label="Line Item" left min={180} sticky />
              <Th label="Broker" color={viewMode === 'BUILD_OWN' || y1IsBroker ? '#f59e0b' : undefined} brokerActive={viewMode === 'BROKER_VIEW'} />
              <Th label={activePeriod.replace('T', 'T-')} color={y1IsTperiod ? '#34d399' : '#e2e8f0'} hidden={viewMode === 'BROKER_VIEW'} onCycle={cycleTPeriod} />
              <Th label="Platform" color="#06b6d4" hidden={viewMode === 'BROKER_VIEW'} />
              <Th label="Resolved" highlight={viewMode === 'BUILD_OWN'} brokerActive={viewMode === 'BROKER_VIEW'} />
              <Th label="% of EGI" color="#94a3b8" />
              <Th label="Source" />
              <Th label="$/Unit" />
              <Th label="Flag" />
            </tr>
          </thead>
          <tbody>
            {/* ── TEMPLATE NOTICE (flip / land_hold) — replaces Revenue section ── */}
            {isFlipTemplate && (
              <>
                {/* Acquisition Basis — blueprint: flip.sections.basis[purchasePrice, closingCosts] */}
                <SectionHeader label="Acquisition Basis" accentColor="#f97316" bg="#1c0a00" />
                {(FLIP_BASIS_ROWS as TemplateRowDef[]).map(({ field, label, hint }) => {
                  const row = byField[field];
                  if (row) {
                    return (
                      <DataRow key={field} row={row} isEven={false} shade="warm"
                        corrections={corrections} setCorrections={setCorrections}
                        totalUnits={totalUnits} egiResolved={egiResolved}
                        activePeriod={activePeriod}
                        onSaveCorrection={handleSaveCorrection}
                        onResetCorrection={handleResetCorrection}
                        evidenceResolved={resolveEvidence(field, evidenceFieldMap)}
                        sigmaTier={null} dqaAlerts={dqaByRow[field]}
                        onDqaClick={setDqaDrawer}
                        sourceDoc={byDocType[mapSourceToDocType(row.source) ?? ''] ?? null}
                      />
                    );
                  }
                  return (
                    <tr key={field} style={{ background: '#0f0600', borderBottom: '1px solid #1f1200' }}>
                      <td style={{ padding: '3px 8px', fontSize: 9, color: '#5a3a10', fontFamily: MONO, position: 'sticky', left: 0, background: '#0f0600' }}>
                        {label}
                        <span style={{ marginLeft: 6, fontSize: 7, color: '#3d2a00', background: '#1a1000', border: '1px solid #2a1800', borderRadius: 2, padding: '1px 4px', fontFamily: MONO }}>NOT SET · {hint ?? 'Enter in Deal Terms'}</span>
                      </td>
                      {Array.from({ length: tableColCount - 1 }, (_, i) => (
                        <td key={i} style={{ padding: '3px 8px', textAlign: 'right', color: '#1f1200', fontSize: 9 }}>—</td>
                      ))}
                    </tr>
                  );
                })}
                {/* Renovation Budget — blueprint: flip.sections.capex[hardCosts, softCosts, contingency, renovationTimelineMonths] */}
                <SectionHeader label="Renovation Budget" accentColor="#f97316" bg="#1c0a00" />
                <tr style={{ background: '#120800' }}>
                  <td colSpan={tableColCount} style={{ padding: '5px 12px 5px 16px', borderLeft: '3px solid #f97316', borderBottom: '1px solid #1f1200' }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: '#7a4a1a', lineHeight: 1.5 }}>
                      FLIP — no rental income. Cost stack: renovation budget + carrying costs. Returns driven by resale exit — enter budget in Deal Terms.
                    </div>
                  </td>
                </tr>
                {(FLIP_CAPEX_ROWS as TemplateRowDef[]).map(({ field, label, hint }) => {
                  const row = byField[field];
                  if (row) {
                    return (
                      <DataRow key={field} row={row} isEven={false} shade="warm"
                        corrections={corrections} setCorrections={setCorrections}
                        totalUnits={totalUnits} egiResolved={egiResolved}
                        activePeriod={activePeriod}
                        onSaveCorrection={handleSaveCorrection}
                        onResetCorrection={handleResetCorrection}
                        evidenceResolved={resolveEvidence(field, evidenceFieldMap)}
                        sigmaTier={null} dqaAlerts={dqaByRow[field]}
                        onDqaClick={setDqaDrawer}
                        sourceDoc={byDocType[mapSourceToDocType(row.source) ?? ''] ?? null}
                      />
                    );
                  }
                  return (
                    <tr key={field} style={{ background: '#0f0600', borderBottom: '1px solid #1f1200' }}>
                      <td style={{ padding: '3px 8px', fontSize: 9, color: '#5a3a10', fontFamily: MONO, position: 'sticky', left: 0, background: '#0f0600' }}>
                        {label}
                        <span style={{ marginLeft: 6, fontSize: 7, color: '#3d2a00', background: '#1a1000', border: '1px solid #2a1800', borderRadius: 2, padding: '1px 4px', fontFamily: MONO }}>NOT SET · {hint ?? 'Enter in Deal Terms'}</span>
                      </td>
                      {Array.from({ length: tableColCount - 1 }, (_, i) => (
                        <td key={i} style={{ padding: '3px 8px', textAlign: 'right', color: '#1f1200', fontSize: 9 }}>—</td>
                      ))}
                    </tr>
                  );
                })}
              </>
            )}
            {isLandHoldTemplate && (
              <>
                <SectionHeader label="Land Hold — No Rental Income" accentColor="#84cc16" bg="#0a1400" />
                <tr style={{ background: '#070d00' }}>
                  <td colSpan={tableColCount} style={{ padding: '8px 12px 8px 16px', borderLeft: '3px solid #84cc16', borderBottom: '1px solid #0e1f00' }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: '#84cc16', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>
                      LAND HOLD TEMPLATE — NO INCOME SECTION
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: '#3a5a0a', lineHeight: 1.5 }}>
                      Land hold deals generate no rental income. GPR, vacancy, EGI, and income rows are hidden.
                      Expenses below represent annual holding costs (property tax, insurance, debt service).
                      Returns are driven by land appreciation at exit — enter exit price in Deal Terms.
                    </div>
                  </td>
                </tr>
              </>
            )}

            {/* ── STR REVENUE — template-specific rows (ADR / RevPAR / occupancy) ── */}
            {isStrTemplate && (
            <>
              <SectionHeader label="STR Revenue" accentColor="#a78bfa" bg="#0a051c" />
              {/* STR Revenue rows — blueprint: str_shortterm.sections.revenue[adr, occupancyRate, revPar, cleaningFees, platformFees] */}
              {(STR_REVENUE_ROWS as TemplateRowDef[]).map(({ field, label, hint }) => {
                const row = byField[field];
                if (row) {
                  return (
                    <DataRow key={field} row={row} isEven={false} shade="blue"
                      corrections={corrections} setCorrections={setCorrections}
                      totalUnits={totalUnits} egiResolved={egiResolved}
                      activePeriod={activePeriod}
                      onSaveCorrection={handleSaveCorrection}
                      onResetCorrection={handleResetCorrection}
                      evidenceResolved={resolveEvidence(field, evidenceFieldMap)}
                      sigmaTier={null} dqaAlerts={dqaByRow[field]}
                      onDqaClick={setDqaDrawer}
                      sourceDoc={byDocType[mapSourceToDocType(row.source) ?? ''] ?? null}
                    />
                  );
                }
                return (
                  <tr key={field} style={{ background: '#080416', borderBottom: '1px solid #14103a' }}>
                    <td style={{ padding: '3px 8px', fontSize: 9, color: '#4a3a7a', fontFamily: MONO, position: 'sticky', left: 0, background: '#080416' }}>
                      {label}
                      <span style={{ marginLeft: 6, fontSize: 7, color: '#2a1a5a', background: '#0a0520', border: '1px solid #1a1040', borderRadius: 2, padding: '1px 4px', fontFamily: MONO }}>NOT SET · {hint ?? 'Enter in Deal Terms'}</span>
                    </td>
                    {Array.from({ length: tableColCount - 1 }, (_, i) => (
                      <td key={i} style={{ padding: '3px 8px', textAlign: 'right', color: '#14103a', fontSize: 9 }}>—</td>
                    ))}
                  </tr>
                );
              })}
              {egiRow && <SubtotalRow label="EGI" row={egiRow} color="#0f172a" textColor="#22c55e" egiResolved={egiResolved} fullFormat activePeriod={activePeriod} />}
            </>
            )}

            {/* ── REVENUE — standard multifamily layout (hidden for flip / land_hold / str_shortterm) ── */}
            {!isFlipTemplate && !isLandHoldTemplate && !isStrTemplate && (
            <>
            <SectionHeader label="Revenue" accentColor="#06b6d4" bg="#051a24" />

            {/* GPR — Pattern A: floor-plan grid expand */}
            {byField['gpr'] && (
              <React.Fragment>
                <DataRow row={byField['gpr']} isEven={false} shade="blue"
                  corrections={corrections} setCorrections={setCorrections}
                  totalUnits={totalUnits} egiResolved={egiResolved}
                  activePeriod={activePeriod}
                  onSaveCorrection={handleSaveCorrection}
                  onResetCorrection={handleResetCorrection}
                  evidenceResolved={resolveEvidence('gpr', evidenceFieldMap)}
                  sigmaTier={sigmaField?.field === 'gpr' ? sigmaField.tier : null}
                  dqaAlerts={dqaByRow['gpr']}
                  onDqaClick={setDqaDrawer}
                  onToggleAncillary={() => setGprExpanded(v => !v)}
                  ancillaryOpen={gprExpanded}
                  sourceDoc={byDocType[mapSourceToDocType(byField['gpr']?.source) ?? ''] ?? null}
                />
                {gprExpanded && (
                  <tr style={{ background: '#040b12' }}>
                    <td colSpan={tableColCount} style={{ padding: 0, borderBottom: '2px solid #0891b255' }}>
                      <FloorPlanGrid
                        gprUnitMix={data.gprUnitMix ?? null}
                        rentRollMix={data.rentRollSummary?.unitMix ?? null}
                        totalUnits={totalUnits}
                        postStabilizationView={showPostStabView}
                        dealId={dealId ?? null}
                        renovationScope={data.renovationScope ?? null}
                        scopeUniformity={data.scopeUniformity ?? null}
                        targetYieldThreshold={data.targetYieldThreshold ?? null}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )}

            {/* Income deductions (vacancy, LTL, concessions, bad debt, NRU) */}
            {preNriRows.map((r, i) => {
              // Concessions row: override resolved with Y1 recognized sum when available.
              const isConcessionsOverridden = r.field === 'concessions' && y1RecognizedConcessions != null;
              const displayRow = isConcessionsOverridden
                ? {
                    ...r,
                    // Concessions are contra-revenue (negative); recognized sum is positive.
                    resolved: -Math.abs(y1RecognizedConcessions!),
                    // Preserve source label so the source badge still renders correctly.
                    source: r.source ?? 'recognition',
                  }
                : r;
              const showPreNriPatternB = isPatternB(r.field, dealType);
              const preNriBOpen = !!regimeExpandOpen[r.field];
              return (
                <React.Fragment key={r.field}>
                  <DataRow row={displayRow} isEven={i % 2 === 0} shade="blue"
                    corrections={corrections} setCorrections={setCorrections}
                    totalUnits={totalUnits} egiResolved={egiResolved}
                    activePeriod={activePeriod}
                    onSaveCorrection={handleSaveCorrection}
                    onResetCorrection={handleResetCorrection}
                    evidenceResolved={resolveEvidence(r.field, evidenceFieldMap)}
                    onRowClick={r.field === 'concessions' && data?.concessionRecognition != null ? openY1Drill : undefined}
                    sigmaTier={sigmaField?.field === r.field ? sigmaField.tier : null}
                    stanceModulated={r.field === 'vacancy_loss' && !!(stanceByPath['vacancy'])}
                    stanceTrace={r.field === 'vacancy_loss' ? stanceByPath['vacancy']?.trace : undefined}
                    dqaAlerts={dqaByRow[r.field]}
                    onDqaClick={setDqaDrawer}
                    onToggleAncillary={showPreNriPatternB ? () => toggleRegimeExpand(r.field) : undefined}
                    ancillaryOpen={showPreNriPatternB ? preNriBOpen : undefined}
                    sourceDoc={byDocType[mapSourceToDocType(r.source) ?? ''] ?? null}
                    contextOverrideWidget={r.field === 'loss_to_lease' ? (
                      <OverrideInputCell
                        dealId={dealId}
                        fieldPath="loss_to_lease"
                        fieldLabel="Loss to Lease"
                        currentValue={r.resolved}
                        onOverrideApplied={load}
                        onOverrideCleared={load}
                      />
                    ) : undefined}
                  />
                  {showPreNriPatternB && preNriBOpen && (
                    <RegimeExpand
                      field={r.field}
                      label={r.label}
                      resolvedValue={r.resolved}
                      t12Value={r.t12 ?? null}
                      regimeData={data?.regimeDataByField?.[r.field] ?? null}
                      totalUnits={totalUnits}
                      egiResolved={egiResolved}
                      postStabView={showPostStabView}
                      tableColCount={tableColCount}
                    />
                  )}
                  {isConcessionsOverridden && (
                    <tr style={{ background: '#110e00' }}>
                      <td
                        colSpan={tableColCount}
                        onClick={openY1Drill}
                        style={{ padding: '2px 8px 2px 28px', fontSize: 8, color: '#92714a', fontFamily: MONO, borderBottom: '1px solid #1f1a00', cursor: 'pointer' }}
                        title="Click for Y1 concession recognition breakdown by lease cohort"
                      >
                        ↑ Recognized (STRAIGHT_LINE_GAAP) · Y1 from {data.closeDate ?? '?'} · click for breakdown ↗
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {/* NRI — broker vs platform comparison after deductions */}
            {byField['net_rental_income'] && (
              <SubtotalRow label="BASE RENTAL REVENUE" row={byField['net_rental_income']} color="#041a14" textColor="#34d399" egiResolved={egiResolved} activePeriod={activePeriod} />
            )}

            {/* Other Income — inline ancillary breakdown (Task #612) */}
            {postNriRows.map((r, i) => {
              const breakdown  = data?.otherIncomeBreakdown ?? null;
              const hasBreakdown = breakdown != null && breakdown.rows.length > 0;
              const userLines  = data?.otherIncomeUserLines ?? [];
              // Pattern B takes precedence over ancillary breakdown for value_add / redevelopment
              const showOtherIncomePatternB = isPatternB(r.field, dealType);
              const otherIncomeBOpen = !!regimeExpandOpen[r.field];
              // Task #805 — math engine v1.1 reconciliation for Other Income header row
              const otherIncomeResolution = data?.mathCorrectionReport?.hierarchical_resolutions?.['proforma.revenue.other_income'] ?? null;
              return (
                <React.Fragment key={r.field}>
                  <DataRow row={r} isEven={i % 2 === 0} shade="blue"
                    corrections={corrections} setCorrections={setCorrections}
                    totalUnits={totalUnits} egiResolved={egiResolved}
                    activePeriod={activePeriod}
                    onSaveCorrection={handleSaveCorrection}
                    onResetCorrection={handleResetCorrection}
                    onToggleAncillary={showOtherIncomePatternB
                      ? () => toggleRegimeExpand(r.field)
                      : () => setShowAncillary(v => !v)}
                    ancillaryOpen={showOtherIncomePatternB ? otherIncomeBOpen : showAncillary}
                    evidenceResolved={resolveEvidence(r.field, evidenceFieldMap)}
                    sigmaTier={sigmaField?.field === r.field ? sigmaField.tier : null}
                    dqaAlerts={dqaByRow[r.field]}
                    onDqaClick={setDqaDrawer}
                    labelAdornment={<ReconciliationChip resolution={otherIncomeResolution} compact />}
                    overrideResolvedValue={otherIncomeResolution != null ? otherIncomeResolution.resolved_value : undefined}
                    sourceDoc={byDocType[mapSourceToDocType(r.source) ?? ''] ?? null}
                  />

                  {/* Pattern B — regime expand (value_add / redevelopment) */}
                  {showOtherIncomePatternB && otherIncomeBOpen && (
                    <RegimeExpand
                      field={r.field}
                      label={r.label}
                      resolvedValue={r.resolved}
                      t12Value={r.t12 ?? null}
                      regimeData={data?.regimeDataByField?.[r.field] ?? null}
                      totalUnits={totalUnits}
                      egiResolved={egiResolved}
                      postStabView={showPostStabView}
                      tableColCount={tableColCount}
                    />
                  )}

                  {/* ── No breakdown available chip ── */}
                  {/* Pattern B takes full precedence — suppress ancillary render when PatternB is active */}
                  {showAncillary && !hasBreakdown && !showOtherIncomePatternB && (
                    <tr style={{ background: '#050e16' }}>
                      <td colSpan={tableColCount} style={{
                        padding: '5px 8px 5px 28px', fontSize: 8, color: '#1e4a5f',
                        fontFamily: MONO, borderLeft: '3px solid #0e3347',
                        fontStyle: 'italic', borderBottom: '1px solid #071520',
                      }}>
                        No per-category breakdown available — upload a T-12 or rent roll to extract ancillary line items.
                      </td>
                    </tr>
                  )}

                  {/* ── Inline per-category breakdown ── */}
                  {showAncillary && hasBreakdown && !showOtherIncomePatternB && (
                    <>
                      {/* Section header */}
                      <tr style={{ background: '#0a1f2a' }}>
                        <td colSpan={tableColCount} style={{ padding: '3px 8px 3px 20px', borderBottom: '1px solid #0a2030' }}>
                          <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#06b6d4', letterSpacing: '0.08em' }}>
                            ANCILLARY INCOME BREAKDOWN
                          </span>
                          <span style={{ fontFamily: MONO, fontSize: 7, color: '#0e4a5a', marginLeft: 8 }}>
                            Broker=OM · T-12=Trailing · Platform=Rent Roll · Resolved=Layered
                          </span>
                        </td>
                      </tr>

                      {/* Per-category rows — Resolved cell is editable (click to override) */}
                      {breakdown!.rows.map(row => {
                        const isCatEditing = ancillaryCatEdit?.cat === row.category;
                        const pctEgi  = egiResolved != null && row.resolved != null && egiResolved !== 0
                          ? row.resolved / egiResolved : null;
                        const perUnit = totalUnits > 0 && row.resolved != null
                          ? Math.round(row.resolved / totalUnits) : null;
                        return (
                          <tr key={row.category} style={{ background: '#050e16', borderLeft: '3px solid #0e3347' }}>
                            <td style={{ padding: '3px 8px 3px 28px', fontSize: 9, color: '#38bdf8', fontFamily: MONO, position: 'sticky', left: 0, background: '#050e16' }}>
                              <span style={{ color: '#0e4a5a', marginRight: 4 }}>↳</span>
                              {ancillaryLabel(row.category)}
                              {row.conflict && (
                                <span style={{ marginLeft: 5, fontFamily: MONO, fontSize: 7, color: '#ef4444', background: '#2d0000', border: '1px solid #7f1d1d', borderRadius: 2, padding: '0 3px' }}>CONFLICT</span>
                              )}
                            </td>
                            {/* Broker col → OM value */}
                            <td style={{ padding: '3px 8px', textAlign: 'right', color: '#92714a', fontSize: 9, fontFamily: MONO }}>{fmtFull$(row.om)}</td>
                            {/* T-period col → T-12 (hidden in BROKER_VIEW) */}
                            {viewMode !== 'BROKER_VIEW' && (
                              <td style={{ padding: '3px 8px', textAlign: 'right', color: '#64748b', fontSize: 9, fontFamily: MONO }}>{fmtFull$(row.t12)}</td>
                            )}
                            {/* Platform col → Rent Roll (hidden in BROKER_VIEW) */}
                            {viewMode !== 'BROKER_VIEW' && (
                              <td style={{ padding: '3px 8px', textAlign: 'right', color: '#06b6d4', fontSize: 9, fontFamily: MONO }}>{fmtFull$(row.rent_roll)}</td>
                            )}
                            {/* Resolved — clickable to override */}
                            <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: MONO }}>
                              {isCatEditing ? (
                                <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                                  <input
                                    autoFocus type="number" value={ancillaryCatEdit!.val}
                                    onChange={e => setAncillaryCatEdit({ cat: row.category, val: e.target.value })}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveAncillaryCat(row.category, ancillaryCatEdit!.val);
                                      if (e.key === 'Escape') setAncillaryCatEdit(null);
                                    }}
                                    style={{ width: 72, background: '#0f172a', border: '1px solid #06b6d4', color: '#06b6d4', fontFamily: MONO, fontSize: 9, padding: '2px 4px', textAlign: 'right', borderRadius: 2 }}
                                  />
                                  <button onClick={() => saveAncillaryCat(row.category, ancillaryCatEdit!.val)} disabled={ancillaryCatBusy}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', padding: 0, fontSize: 11 }}>✓</button>
                                  <button onClick={() => setAncillaryCatEdit(null)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, fontSize: 11 }}>✕</button>
                                </span>
                              ) : (
                                <span
                                  onClick={() => setAncillaryCatEdit({ cat: row.category, val: row.resolved != null ? String(Math.round(row.resolved)) : '' })}
                                  title="Click to override this category's resolved value"
                                  style={{ color: '#38bdf8', fontWeight: 700, fontSize: 9, borderBottom: '1px dotted #0891b2', cursor: 'pointer', padding: '0 4px' }}
                                >
                                  {fmtFull$(row.resolved)}
                                </span>
                              )}
                            </td>
                            {/* % EGI */}
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: 8, color: '#334155', fontFamily: MONO }}>
                              {pctEgi != null ? (pctEgi * 100).toFixed(1) + '%' : '—'}
                            </td>
                            {/* Source */}
                            <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                              <span style={{ display: 'inline-block', padding: '1px 5px', borderRadius: 2, fontFamily: MONO, fontSize: 7, color: '#22d3ee', background: '#051820' }}>
                                {row.resolution?.split(':')[0] ?? '—'}
                              </span>
                            </td>
                            {/* $/Unit */}
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: 8, color: '#475569', fontFamily: MONO }}>
                              {perUnit != null ? `$${perUnit}` : '—'}
                            </td>
                            <td />
                          </tr>
                        );
                      })}

                      {/* User-added lines — read-only display; full CRUD below via panel */}
                      {userLines.map(ul => {
                        // Ramp-aware Year 1 value — mirrors backend computeUserLineAnnual (proforma-seeder §5B)
                        const a = ul.adoption;
                        const annual = (() => {
                          if (!a) return ul.monthly * 12;
                          const steadyMo  = Number.isFinite(a.steady_state_monthly) ? a.steady_state_monthly : ul.monthly;
                          const rampStart = Number.isFinite(a.ramp_start_period)    ? a.ramp_start_period    : 0;
                          const rampDur   = Number.isFinite(a.ramp_duration_months) ? a.ramp_duration_months : 0;
                          const prob      = Number.isFinite(a.probability_adopted)  ? a.probability_adopted  : 1;
                          const periodMo  = 6; // midpoint of Year 1 (yearIndex=0 → (0)*12+6)
                          if (periodMo < rampStart) return 0;
                          if (rampDur <= 0 || periodMo >= rampStart + rampDur) return steadyMo * 12 * prob;
                          return steadyMo * ((periodMo - rampStart) / rampDur) * 12 * prob;
                        })();
                        const isRamping = a != null && annual < (a.steady_state_monthly * 12 * (a.probability_adopted ?? 1)) - 0.01;
                        const pctEgi  = egiResolved != null && egiResolved !== 0 ? annual / egiResolved : null;
                        const perUnit = totalUnits > 0 ? Math.round(annual / totalUnits) : null;
                        return (
                          <tr key={ul.id} style={{ background: '#050e16', borderLeft: '3px solid #164e2a' }}>
                            <td style={{ padding: '3px 8px 3px 28px', fontSize: 9, color: '#10b981', fontFamily: MONO, position: 'sticky', left: 0, background: '#050e16' }}>
                              <span style={{ color: '#064e24', marginRight: 4 }}>+</span>
                              {ul.label}
                              {ul.qty != null && ul.rate != null && (
                                <span style={{ marginLeft: 5, color: '#064e24', fontSize: 7 }}>{ul.qty} × ${ul.rate}/mo</span>
                              )}
                            </td>
                            <td />
                            {viewMode !== 'BROKER_VIEW' && <td />}
                            {viewMode !== 'BROKER_VIEW' && <td />}
                            <td style={{ padding: '3px 8px', textAlign: 'right', color: isRamping ? '#2dd4bf' : '#10b981', fontWeight: 700, fontSize: 9, fontFamily: MONO }}
                                title={isRamping ? `Ramping — steady state: $${Math.round(a!.steady_state_monthly * 12 * (a!.probability_adopted ?? 1)).toLocaleString()}/yr` : undefined}>
                              {fmtFull$(annual)}
                            </td>
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: 8, color: '#334155', fontFamily: MONO }}>
                              {pctEgi != null ? (pctEgi * 100).toFixed(1) + '%' : '—'}
                            </td>
                            <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                              <span style={{ display: 'inline-block', padding: '1px 5px', borderRadius: 2, fontFamily: MONO, fontSize: 7, color: '#10b981', background: '#0a2016' }}>USER</span>
                              {ul.adoption && (
                                <span style={{ marginLeft: 3, display: 'inline-block', padding: '1px 4px', borderRadius: 2, fontFamily: MONO, fontSize: 7, color: '#2dd4bf', background: '#041818', border: '1px solid #0f4a45' }}
                                      title={`Starts mo ${ul.adoption.ramp_start_period} · ${ul.adoption.ramp_duration_months}mo ramp · $${Math.round(ul.adoption.steady_state_monthly)}/mo steady`}>
                                  RAMP↑
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: 8, color: '#475569', fontFamily: MONO }}>
                              {perUnit != null ? `$${perUnit}` : '—'}
                            </td>
                            <td />
                          </tr>
                        );
                      })}

                      {/* Total Other Income — named categories resolved + user lines annual (ramp-aware Yr1) */}
                      {/* Task #805: uses engine-corrected resolved_value when math_correction_report is available */}
                      {(() => {
                        // Ramp-aware Y1 totals to match what the seeder actually produces in Year 1
                        const userLinesAnnual = userLines.reduce((s, ul) => {
                          const a = ul.adoption;
                          if (!a) return s + ul.monthly * 12;
                          const steadyMo  = Number.isFinite(a.steady_state_monthly) ? a.steady_state_monthly : ul.monthly;
                          const rampStart = Number.isFinite(a.ramp_start_period)    ? a.ramp_start_period    : 0;
                          const rampDur   = Number.isFinite(a.ramp_duration_months) ? a.ramp_duration_months : 0;
                          const prob      = Number.isFinite(a.probability_adopted)  ? a.probability_adopted  : 1;
                          const periodMo  = 6;
                          if (periodMo < rampStart) return s;
                          if (rampDur <= 0 || periodMo >= rampStart + rampDur) return s + steadyMo * 12 * prob;
                          return s + steadyMo * ((periodMo - rampStart) / rampDur) * 12 * prob;
                        }, 0);
                        const engineResolution = data?.mathCorrectionReport?.hierarchical_resolutions?.['proforma.revenue.other_income'] ?? null;
                        const baseResolved = engineResolution != null
                          ? engineResolution.resolved_value
                          : (breakdown!.total.resolved ?? 0);
                        const grandTotal = baseResolved + userLinesAnnual;
                        return (
                          <tr style={{ background: '#041018', borderTop: '1px solid #0e2a3a', borderLeft: '3px solid #06b6d4' }}>
                            <td style={{ padding: '4px 8px 4px 28px', fontSize: 9, fontWeight: 700, color: '#38bdf8', fontFamily: MONO, position: 'sticky', left: 0, background: '#041018' }}>
                              TOTAL OTHER INCOME
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', color: '#92714a', fontWeight: 700, fontSize: 9, fontFamily: MONO }}>
                              {fmtFull$(breakdown!.total.om)}
                            </td>
                            {viewMode !== 'BROKER_VIEW' && (
                              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#64748b', fontWeight: 700, fontSize: 9, fontFamily: MONO }}>
                                {fmtFull$(breakdown!.total.t12)}
                              </td>
                            )}
                            {viewMode !== 'BROKER_VIEW' && (
                              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#06b6d4', fontWeight: 700, fontSize: 9, fontFamily: MONO }}>
                                {fmtFull$(breakdown!.total.rent_roll)}
                              </td>
                            )}
                            <td style={{ padding: '4px 6px', textAlign: 'right', color: '#22d3ee', fontWeight: 700, fontSize: 10, fontFamily: MONO }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {fmtFull$(grandTotal)}
                                <ReconciliationChip resolution={engineResolution} />
                              </span>
                            </td>
                            <td colSpan={4} />
                          </tr>
                        );
                      })()}

                      {/* User-line CRUD — panel with hideCategoryTable so categories aren't duplicated */}
                      <tr style={{ background: '#0a1c2c' }}>
                        <td colSpan={tableColCount} style={{ padding: 0, borderBottom: '1px solid #0e2030' }}>
                          <AncillaryExpansionPanel
                            totalUnits={totalUnits}
                            dealId={dealId}
                            breakdown={breakdown}
                            userLines={userLines}
                            onChange={load}
                            hideCategoryTable
                            isDevelopment={dealType === 'development'}
                          />
                        </td>
                      </tr>
                    </>
                  )}
                </React.Fragment>
              );
            })}

            {/* ── EGI SUBTOTAL ── */}
            {egiRow && <SubtotalRow label="EGI" row={egiRow} color="#0f172a" textColor="#22c55e" egiResolved={egiResolved} fullFormat activePeriod={activePeriod} />}
            </>
            )}
            {/* END Revenue section conditional */}

            {/* ── CONTROLLABLE EXPENSES / HOLDING COSTS ── */}
            <SectionHeader
              label={isFlipTemplate ? 'Holding Costs' : isLandHoldTemplate ? 'Annual Holding Costs' : 'Controllable Expenses'}
              accentColor={isSpecialTemplate ? '#f97316' : '#f59e0b'}
              bg={isSpecialTemplate ? '#1a0c00' : '#1a110a'}
              cols={viewMode === 'BROKER_VIEW' ? 7 : 9}
            />
            {templateCtrlRows.map((r, i) => {
              const showPatternB = isPatternB(r.field, dealType);
              const bOpen = !!regimeExpandOpen[r.field];
              return (
              <React.Fragment key={r.field}>
                <DataRow row={r} isEven={i % 2 === 0} shade="warm"
                  corrections={corrections} setCorrections={setCorrections}
                  totalUnits={totalUnits} egiResolved={egiResolved}
                  activePeriod={activePeriod}
                  onSaveCorrection={handleSaveCorrection}
                  onResetCorrection={handleResetCorrection}
                  evidenceResolved={resolveEvidence(r.field, evidenceFieldMap)}
                  sigmaTier={sigmaField?.field === r.field ? sigmaField.tier : null}
                  stanceModulated={!!(stanceByPath['expenseGrowth'])}
                  stanceTrace={stanceByPath['expenseGrowth']?.trace}
                  dqaAlerts={dqaByRow[r.field]}
                  onDqaClick={setDqaDrawer}
                  onToggleAncillary={showPatternB ? () => toggleRegimeExpand(r.field) : undefined}
                  ancillaryOpen={showPatternB ? bOpen : undefined}
                  sourceDoc={byDocType[mapSourceToDocType(r.source) ?? ''] ?? null}
                />
                {showPatternB && bOpen && (
                  <RegimeExpand
                    field={r.field}
                    label={r.label}
                    resolvedValue={r.resolved}
                    t12Value={r.t12 ?? null}
                    regimeData={data?.regimeDataByField?.[r.field] ?? null}
                    totalUnits={totalUnits}
                    egiResolved={egiResolved}
                    postStabView={showPostStabView}
                    tableColCount={tableColCount}
                  />
                )}
                {r.field === 'utilities' && (() => {
                  const waterSewer = byField['water_sewer'];
                  const electric   = byField['electric'];
                  const gasFuel    = byField['gas_fuel'];
                  const subLines   = [waterSewer, electric, gasFuel].filter(Boolean) as NonNullable<typeof waterSewer>[];
                  return (
                    <>
                      <tr
                        onClick={() => setShowUtilitiesBreakdown(v => !v)}
                        style={{ background: '#100b00', cursor: 'pointer' }}
                      >
                        <td colSpan={tableColCount} style={{ padding: '2px 8px 2px 24px', fontSize: 8, color: '#6b4a1a', fontFamily: MONO, fontStyle: 'italic', userSelect: 'none' }}>
                          {showUtilitiesBreakdown ? '▾' : '▸'}{' '}
                          {subLines.length > 0 ? `${subLines.length} sub-lines available` : 'Consolidated — water/sewer · electric · gas'}{' '}
                          <span style={{ color: '#3d2a00' }}>(click to {showUtilitiesBreakdown ? 'collapse' : 'expand'})</span>
                        </td>
                      </tr>
                      {showUtilitiesBreakdown && (
                        subLines.length > 0 ? subLines.map(sub => (
                          <tr key={sub.field} style={{ background: '#130e00', borderLeft: '2px solid #6b3d00' }}>
                            <td style={{ padding: '3px 8px 3px 28px', fontSize: 8.5, color: '#92714a', fontFamily: MONO, position: 'sticky', left: 0, background: '#130e00' }}>
                              ↳ {sub.label ?? sub.field.replace(/_/g, ' ')}
                            </td>
                            <td style={{ padding: '3px 8px', textAlign: 'right', color: '#6b3d00', fontSize: 8.5 }}>{fmtFull$(sub.broker)}</td>
                            {viewMode !== 'BROKER_VIEW' && <td style={{ padding: '3px 8px', textAlign: 'right', color: '#6b3d00', fontSize: 8.5 }}>{fmtFull$(sub.t12)}</td>}
                            {viewMode !== 'BROKER_VIEW' && <td style={{ padding: '3px 8px', textAlign: 'right', color: '#06b6d4', fontSize: 8.5 }}>{fmtFull$(sub.platform)}</td>}
                            <td style={{ padding: '3px 8px', textAlign: 'right', color: '#92714a', fontWeight: 600, fontSize: 8.5 }}>{fmtFull$(sub.resolved)}</td>
                            <td colSpan={4} />
                          </tr>
                        )) : (
                          <tr style={{ background: '#0d0900' }}>
                            <td colSpan={tableColCount} style={{ padding: '3px 8px 3px 28px', fontSize: 8, color: '#3d2a00', fontFamily: MONO, borderBottom: '1px solid #1a1200', fontStyle: 'italic' }}>
                              Backend maps water/sewer · electric · gas → single utilities bucket (T-12 extraction).
                              Split appears here when sub-line data is available.
                            </td>
                          </tr>
                        )
                      )}
                    </>
                  );
                })()}
              </React.Fragment>
              );
            })}
            <tr style={{ background: '#1a110a' }}>
              <td style={{ padding: '4px 8px', color: '#fb923c', fontWeight: 700, fontFamily: LABEL, fontSize: 9, paddingLeft: 12, position: 'sticky', left: 0, background: '#1a110a' }}>
                {isFlipTemplate ? '─── CARRY COSTS ───' : isLandHoldTemplate ? '─── HOLDING COSTS ───' : '─── CONTROLLABLE OPEX ───'}
              </td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: viewMode === 'BROKER_VIEW' ? '#fcd34d' : '#fb923c', fontSize: 9 }}>{fmtFull$(tplCtrlSubtotal.broker)}</td>
              {viewMode !== 'BROKER_VIEW' && <td style={{ padding: '4px 8px', textAlign: 'right', color: '#e2e8f0', fontSize: 9 }}>{fmtFull$(pickY1ColValue(tplCtrlSubtotal as unknown as OperatingStatementRow, activePeriod))}</td>}
              {viewMode !== 'BROKER_VIEW' && <td style={{ padding: '4px 8px', textAlign: 'right', color: '#06b6d4', fontSize: 9 }}>{fmtFull$(tplCtrlSubtotal.platform)}</td>}
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#fb923c', fontWeight: 700, background: viewMode === 'BROKER_VIEW' ? '#1c0f00' : 'rgba(0,0,0,0.3)' }}>
                {fmtFull$(tplCtrlSubtotal.resolved || null)}
              </td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#475569', fontSize: 9 }}>
                {egiResolved && tplCtrlSubtotal.resolved ? `${((tplCtrlSubtotal.resolved / egiResolved) * 100).toFixed(1)}%` : '—'}
              </td>
              <td colSpan={3} />
            </tr>

            {/* ── NON-CONTROLLABLE EXPENSES / FIXED CARRY COSTS ── */}
            <SectionHeader
              label={isFlipTemplate ? 'Fixed Carry Costs' : isLandHoldTemplate ? 'Fixed Carry Costs' : 'Non-Controllable Expenses'}
              accentColor={isSpecialTemplate ? '#84cc16' : '#a855f7'}
              bg={isSpecialTemplate ? '#0a1400' : '#0d0a14'}
              cols={viewMode === 'BROKER_VIEW' ? 7 : 9}
            />
            {templateNctrlRows.map((r, i) => {
              const NCTRL_OVERRIDE_FIELDS = new Set(['real_estate_tax', 'management_fee', 'insurance']);
              return (
                <DataRow key={r.field} row={r} isEven={i % 2 === 0} shade="purple"
                  corrections={corrections} setCorrections={setCorrections}
                  totalUnits={totalUnits} egiResolved={egiResolved}
                  activePeriod={activePeriod}
                  onSaveCorrection={handleSaveCorrection}
                  onResetCorrection={handleResetCorrection}
                  evidenceResolved={resolveEvidence(r.field, evidenceFieldMap)}
                  sigmaTier={sigmaField?.field === r.field ? sigmaField.tier : null}
                  stanceModulated={!!(stanceByPath['expenseGrowth'])}
                  stanceTrace={stanceByPath['expenseGrowth']?.trace}
                  dqaAlerts={dqaByRow[r.field]}
                  onDqaClick={setDqaDrawer}
                  sourceDoc={byDocType[mapSourceToDocType(r.source) ?? ''] ?? null}
                  contextOverrideWidget={NCTRL_OVERRIDE_FIELDS.has(r.field) ? (
                    <OverrideInputCell
                      dealId={dealId}
                      fieldPath={r.field}
                      fieldLabel={r.label ?? r.field}
                      currentValue={r.resolved}
                      onOverrideApplied={load}
                      onOverrideCleared={load}
                    />
                  ) : undefined}
                />
              );
            })}
            <tr style={{ background: '#0d0a14' }}>
              <td style={{ padding: '4px 8px', color: '#c084fc', fontWeight: 700, fontFamily: LABEL, fontSize: 9, paddingLeft: 12, position: 'sticky', left: 0, background: '#0d0a14' }}>
                {isSpecialTemplate ? '─── FIXED CARRY COSTS ───' : '─── NON-CONTROLLABLE OPEX ───'}
              </td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: viewMode === 'BROKER_VIEW' ? '#fcd34d' : '#c084fc', fontSize: 9 }}>{fmtFull$(tplNctrlSubtotal.broker)}</td>
              {viewMode !== 'BROKER_VIEW' && <td style={{ padding: '4px 8px', textAlign: 'right', color: '#e2e8f0', fontSize: 9 }}>{fmtFull$(pickY1ColValue(tplNctrlSubtotal as unknown as OperatingStatementRow, activePeriod))}</td>}
              {viewMode !== 'BROKER_VIEW' && <td style={{ padding: '4px 8px', textAlign: 'right', color: '#06b6d4', fontSize: 9 }}>{fmtFull$(tplNctrlSubtotal.platform)}</td>}
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#c084fc', fontWeight: 700, background: viewMode === 'BROKER_VIEW' ? '#1c0f00' : 'rgba(0,0,0,0.3)' }}>
                {fmtFull$(tplNctrlSubtotal.resolved || null)}
              </td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#475569', fontSize: 9 }}>
                {egiResolved && tplNctrlSubtotal.resolved ? `${((tplNctrlSubtotal.resolved / egiResolved) * 100).toFixed(1)}%` : '—'}
              </td>
              <td colSpan={3} />
            </tr>

            {/* ── TOTAL OPEX ── */}
            {totalOpexRow && !isSpecialTemplate && (
              <tr style={{ background: '#1e1b4b', borderTop: '1px solid #312e81', borderBottom: '1px solid #312e81' }}>
                <td style={{ padding: '5px 8px', fontWeight: 700, color: '#e2e8f0', fontFamily: LABEL, fontSize: 9, position: 'sticky', left: 0, background: '#1e1b4b' }}>═══ TOTAL OPEX ═══</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: viewMode === 'BROKER_VIEW' ? '#fcd34d' : '#c4b5fd', fontSize: 9, fontWeight: viewMode === 'BROKER_VIEW' ? 700 : 400 }}>
                  {fmtFull$(totalOpexRow.broker)}
                </td>
                {viewMode !== 'BROKER_VIEW' && <td style={{ padding: '5px 8px', textAlign: 'right', color: '#e2e8f0', fontSize: 9 }}>{fmtFull$(pickY1ColValue(totalOpexRow, activePeriod))}</td>}
                {viewMode !== 'BROKER_VIEW' && <td style={{ padding: '5px 8px', textAlign: 'right', color: '#06b6d4', fontSize: 9 }}>{fmtFull$(pickPlatformValue(totalOpexRow, platformColSource))}</td>}
                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, fontSize: 11,
                  background: viewMode === 'BROKER_VIEW' ? '#1c0f00' : undefined,
                  color: viewMode === 'BROKER_VIEW' ? '#fcd34d' : '#ffffff',
                }}>
                  {fmtFull$(viewMode === 'BROKER_VIEW' ? (totalOpexRow.broker ?? totalOpexRow.resolved) : totalOpexRow.resolved)}
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: '#94a3b8', fontSize: 9 }}>
                  {egiResolved && totalOpexRow.resolved ? `${((totalOpexRow.resolved / egiResolved) * 100).toFixed(1)}%` : '—'}
                </td>
                <td />
                <td style={{ padding: '5px 8px', textAlign: 'right', color: '#94a3b8', fontSize: 9 }}>
                  {totalOpexRow.perUnit != null ? `$${totalOpexRow.perUnit.toLocaleString()}/unit` : '—'}
                </td>
                <td />
              </tr>
            )}

            {/* ── FLIP: RESALE EXIT ─────────────────────────────────────── */}
            {isFlipTemplate && (
              <>
                <SectionHeader label="Resale Exit" accentColor="#f97316" bg="#1c0a00" />
                {/* Resale Exit rows — blueprint: flip.sections.exit[exitPrice, sellingCosts, netSaleProceeds, profitMargin, monthsHeld] */}
                {(FLIP_EXIT_ROWS as TemplateRowDef[]).map(({ field, label, hint }) => {
                  const row = byField[field];
                  if (row) {
                    return (
                      <DataRow key={field} row={row} isEven={false} shade="warm"
                        corrections={corrections} setCorrections={setCorrections}
                        totalUnits={totalUnits} egiResolved={egiResolved}
                        activePeriod={activePeriod}
                        onSaveCorrection={handleSaveCorrection}
                        onResetCorrection={handleResetCorrection}
                        evidenceResolved={resolveEvidence(field, evidenceFieldMap)}
                        sigmaTier={null} dqaAlerts={dqaByRow[field]}
                        onDqaClick={setDqaDrawer}
                        sourceDoc={byDocType[mapSourceToDocType(row.source) ?? ''] ?? null}
                      />
                    );
                  }
                  return (
                    <tr key={field} style={{ background: '#0f0600', borderBottom: '1px solid #1f1200' }}>
                      <td style={{ padding: '3px 8px', fontSize: 9, color: '#5a3a10', fontFamily: MONO, position: 'sticky', left: 0, background: '#0f0600' }}>
                        {label}
                        <span style={{ marginLeft: 6, fontSize: 7, color: '#3d2a00', background: '#1a1000', border: '1px solid #2a1800', borderRadius: 2, padding: '1px 4px', fontFamily: MONO }}>NOT SET · {hint ?? 'Enter in Deal Terms'}</span>
                      </td>
                      {Array.from({ length: tableColCount - 1 }, (_, i) => (
                        <td key={i} style={{ padding: '3px 8px', textAlign: 'right', color: '#1f1200', fontSize: 9 }}>—</td>
                      ))}
                    </tr>
                  );
                })}
              </>
            )}

            {/* ── LAND HOLD: DISPOSITION ────────────────────────────────── */}
            {isLandHoldTemplate && (
              <>
                <SectionHeader label="Disposition" accentColor="#84cc16" bg="#0a1400" />
                {/* Disposition rows — blueprint: land_hold.sections.exit[exitPrice, sellingCosts, netSaleProceeds, profitMargin] */}
                {(LAND_HOLD_EXIT_ROWS as TemplateRowDef[]).map(({ field, label, hint }) => {
                  const row = byField[field];
                  if (row) {
                    return (
                      <DataRow key={field} row={row} isEven={false} shade="warm"
                        corrections={corrections} setCorrections={setCorrections}
                        totalUnits={totalUnits} egiResolved={egiResolved}
                        activePeriod={activePeriod}
                        onSaveCorrection={handleSaveCorrection}
                        onResetCorrection={handleResetCorrection}
                        evidenceResolved={resolveEvidence(field, evidenceFieldMap)}
                        sigmaTier={null} dqaAlerts={dqaByRow[field]}
                        onDqaClick={setDqaDrawer}
                        sourceDoc={byDocType[mapSourceToDocType(row.source) ?? ''] ?? null}
                      />
                    );
                  }
                  return (
                    <tr key={field} style={{ background: '#070d00', borderBottom: '1px solid #0e1f00' }}>
                      <td style={{ padding: '3px 8px', fontSize: 9, color: '#3a5a0a', fontFamily: MONO, position: 'sticky', left: 0, background: '#070d00' }}>
                        {label}
                        <span style={{ marginLeft: 6, fontSize: 7, color: '#1e3800', background: '#0a1400', border: '1px solid #1a2800', borderRadius: 2, padding: '1px 4px', fontFamily: MONO }}>NOT SET · {hint ?? 'Enter in Deal Terms'}</span>
                      </td>
                      {Array.from({ length: tableColCount - 1 }, (_, i) => (
                        <td key={i} style={{ padding: '3px 8px', textAlign: 'right', color: '#0e1f00', fontSize: 9 }}>—</td>
                      ))}
                    </tr>
                  );
                })}
              </>
            )}

            {/* ── NOI (rental income templates only — suppressed for flip / land_hold) ── */}
            {noiRow && !isFlipTemplate && !isLandHoldTemplate && (
              <tr style={{ background: '#042304', borderTop: '2px solid #166534', borderBottom: '2px solid #166534' }}>
                <td style={{ padding: '7px 8px', fontWeight: 700, color: '#f8fafc', fontFamily: LABEL, letterSpacing: 1, position: 'sticky', left: 0, background: '#042304' }}>
                  ═══ NET OPERATING INCOME ═══
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: viewMode === 'BROKER_VIEW' ? '#fcd34d' : '#86efac', fontWeight: viewMode === 'BROKER_VIEW' ? 700 : 400 }}>{fmtFull$(noiRow.broker)}</td>
                {viewMode !== 'BROKER_VIEW' && (
                  <>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#86efac' }}>{fmtFull$(pickY1ColValue(noiRow, activePeriod))}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#06b6d4' }}>{fmtFull$(pickPlatformValue(noiRow, platformColSource))}</td>
                  </>
                )}
                <td style={{
                  padding: '7px 8px', textAlign: 'right', fontWeight: 700, fontSize: 13,
                  color: viewMode === 'BROKER_VIEW' ? '#fcd34d' : '#4ade80',
                  background: viewMode === 'BROKER_VIEW' ? '#1c0f00' : undefined,
                }}>
                  {fmtFull$(viewMode === 'BROKER_VIEW' ? (noiRow.broker ?? noiRow.resolved) : noiRow.resolved)}
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#86efac', fontSize: 9 }}>
                  {egiResolved && noiRow.resolved ? `${((noiRow.resolved / egiResolved) * 100).toFixed(1)}%` : '—'}
                </td>
                <td style={{ padding: '7px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <SourceBadge source={noiRow.source} />
                    <SourceDocPill doc={byDocType[mapSourceToDocType(noiRow.source) ?? ''] ?? null} />
                  </div>
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#86efac', fontSize: 9 }}>
                  {noiRow.perUnit != null ? `$${noiRow.perUnit.toLocaleString()}/unit` : '—'}
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <OverrideInputCell
                    dealId={dealId}
                    fieldPath="noi"
                    fieldLabel="Net Operating Income"
                    currentValue={noiRow.resolved}
                    onOverrideApplied={load}
                    onOverrideCleared={load}
                  />
                </td>
              </tr>
            )}

            {/* ── REPLACEMENT RESERVES (below-the-line) ─────────────────────── */}
            {reservesRow && !isFlipTemplate && !isLandHoldTemplate && (
              <tr style={{ background: '#0a0e14', borderTop: '1px solid #1e2a3a' }}>
                <td style={{ padding: '4px 8px 4px 20px', fontSize: 9, color: '#94a3b8', fontFamily: MONO, position: 'sticky', left: 0, background: '#0a0e14' }}>
                  <span style={{ color: '#475569', marginRight: 5 }}>−</span>Replacement Reserves
                  <span style={{ color: '#334155', fontSize: 8, marginLeft: 6 }}>(below-the-line)</span>
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right', color: viewMode === 'BROKER_VIEW' ? '#fcd34d' : '#94a3b8', fontSize: 9 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    {fmtFull$(reservesRow.broker)}
                    {showReservesDivergenceBadge && (
                      <span
                        title={`OM: ${fmtFull$(reservesRow.broker)} | Override: ${fmtFull$(reservesRow.resolved)} | gap: ${Math.round((_reservesDivergence ?? 0) * 100)}%`}
                        style={{
                          background: 'rgba(245,166,35,0.10)',
                          color: BT.text.amber,
                          padding: '1px 3px',
                          borderRadius: 2,
                          fontSize: 8,
                          fontFamily: MONO,
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        DIVERGE
                      </span>
                    )}
                  </span>
                </td>
                {viewMode !== 'BROKER_VIEW' && <td style={{ padding: '4px 8px', textAlign: 'right', color: '#e2e8f0', fontSize: 9 }}>{fmtFull$(reservesRow.t12)}</td>}
                {viewMode !== 'BROKER_VIEW' && <td style={{ padding: '4px 8px', textAlign: 'right', color: '#06b6d4', fontSize: 9 }}>{fmtFull$(reservesRow.platform)}</td>}
                <td style={{ padding: '4px 4px', textAlign: 'right' }}>
                  {corrections['replacement_reserves']?.editing ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <input
                        autoFocus
                        type="number"
                        value={corrections['replacement_reserves'].draft}
                        onChange={e => setCorrections(prev => ({ ...prev, replacement_reserves: { ...prev.replacement_reserves, draft: e.target.value } }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const v = parseFloat(corrections['replacement_reserves'].draft);
                            handleSaveCorrection('replacement_reserves', isNaN(v) ? null : v, corrections['replacement_reserves'].original);
                          }
                          if (e.key === 'Escape') setCorrections(prev => ({ ...prev, replacement_reserves: { ...prev.replacement_reserves, editing: false } }));
                        }}
                        style={{ width: 80, background: '#0f172a', border: '1px solid #06b6d4', color: '#f8fafc', fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, textAlign: 'right' }}
                      />
                      <button
                        onMouseDown={e => {
                          e.preventDefault();
                          const v = parseFloat(corrections['replacement_reserves']?.draft ?? '');
                          handleSaveCorrection('replacement_reserves', isNaN(v) ? null : v, corrections['replacement_reserves']?.original ?? null);
                        }}
                        style={{ background: '#0f2d1a', border: '1px solid #16a34a', borderRadius: 2, color: '#4ade80', fontFamily: MONO, fontSize: 9, padding: '1px 4px', cursor: 'pointer', lineHeight: 1, fontWeight: 700 }}
                      >✓</button>
                      <button
                        onClick={() => setCorrections(prev => ({ ...prev, replacement_reserves: { ...prev.replacement_reserves, editing: false } }))}
                        style={{ background: '#2d0000', border: '1px solid #7f1d1d', borderRadius: 2, color: '#f87171', fontFamily: MONO, fontSize: 9, padding: '1px 4px', cursor: 'pointer', lineHeight: 1 }}
                      >✕</button>
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 9, fontFamily: MONO }}>{fmtFull$(reservesRow.resolved)}</span>
                      <button
                        title="Override replacement reserves"
                        onClick={() => setCorrections(prev => ({
                          ...prev,
                          replacement_reserves: {
                            editing: true,
                            original: reservesRow.resolved,
                            draft: reservesRow.resolved != null ? String(Math.round(reservesRow.resolved)) : '',
                          },
                        }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: '1px 2px' }}
                      >
                        <Pencil size={9} />
                      </button>
                      {corrections['replacement_reserves']?.savedAt && (
                        <button
                          title="Reset to ingested value"
                          onClick={() => handleResetCorrection('replacement_reserves')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: BT.text.amber, padding: '1px 2px' }}
                        >
                          <RotateCcw size={9} />
                        </button>
                      )}
                      <OverrideInputCell
                        dealId={dealId}
                        fieldPath="replacement_reserves"
                        fieldLabel="Replacement Reserves"
                        currentValue={reservesRow.resolved}
                        onOverrideApplied={load}
                        onOverrideCleared={load}
                      />
                    </span>
                  )}
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right', color: '#475569', fontSize: 9 }}>
                  {egiResolved && reservesRow.resolved ? `${((Math.abs(reservesRow.resolved) / egiResolved) * 100).toFixed(1)}%` : '—'}
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <SourceBadge source={reservesRow.source} />
                    <SourceDocPill doc={byDocType[mapSourceToDocType(reservesRow.source) ?? ''] ?? null} />
                  </div>
                </td>
                <td style={{ padding: '4px 4px', textAlign: 'right' }}>
                  {reservesPuDraft !== null ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <input
                        autoFocus
                        type="number"
                        placeholder="$/unit"
                        value={reservesPuDraft}
                        onChange={e => setReservesPuDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const pu = parseFloat(reservesPuDraft);
                            if (!isNaN(pu) && totalUnits > 0) {
                              handleSaveCorrection('replacement_reserves', Math.round(pu * totalUnits), reservesRow.resolved);
                            }
                            setReservesPuDraft(null);
                          }
                          if (e.key === 'Escape') setReservesPuDraft(null);
                        }}
                        style={{ width: 56, background: '#0f172a', border: '1px solid #06b6d4', color: '#f8fafc', fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, textAlign: 'right' }}
                      />
                      <span style={{ color: '#475569', fontSize: 8, fontFamily: MONO }}>/unit</span>
                      <button
                        onMouseDown={e => {
                          e.preventDefault();
                          const pu = parseFloat(reservesPuDraft ?? '');
                          if (!isNaN(pu) && totalUnits > 0) {
                            handleSaveCorrection('replacement_reserves', Math.round(pu * totalUnits), reservesRow.resolved);
                          }
                          setReservesPuDraft(null);
                        }}
                        style={{ background: '#0f2d1a', border: '1px solid #16a34a', borderRadius: 2, color: '#4ade80', fontFamily: MONO, fontSize: 9, padding: '1px 4px', cursor: 'pointer', lineHeight: 1, fontWeight: 700 }}
                      >✓</button>
                      <button
                        onClick={() => setReservesPuDraft(null)}
                        style={{ background: '#2d0000', border: '1px solid #7f1d1d', borderRadius: 2, color: '#f87171', fontFamily: MONO, fontSize: 9, padding: '1px 4px', cursor: 'pointer', lineHeight: 1 }}
                      >✕</button>
                    </span>
                  ) : (
                    <span
                      onClick={() => setReservesPuDraft(reservesRow.perUnit != null ? String(reservesRow.perUnit) : '')}
                      title="Click to set $/unit — saves as total annual reserves ($/unit × units)"
                      style={{ color: '#475569', fontSize: 9, fontFamily: MONO, borderBottom: '1px dotted #334155', cursor: 'pointer', padding: '0 2px' }}
                    >
                      {reservesRow.perUnit != null ? `$${reservesRow.perUnit.toLocaleString()}/unit` : '—'}
                    </span>
                  )}
                </td>
                <td />
              </tr>
            )}

            {/* ── NOI AFTER RESERVES ────────────────────────────────────────── */}
            {noiAfterReserves != null && !isFlipTemplate && !isLandHoldTemplate && (
              <tr style={{ background: '#0a2828', borderTop: '1px solid #0e4040', borderBottom: '2px solid #0e4040' }}>
                <td style={{ padding: '6px 8px', fontWeight: 700, color: '#67e8f9', fontFamily: LABEL, fontSize: 9, letterSpacing: '0.05em', position: 'sticky', left: 0, background: '#0a2828' }}>
                  ═══ NOI AFTER RESERVES ═══
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: viewMode === 'BROKER_VIEW' ? '#fcd34d' : '#67e8f9', fontSize: 9, fontWeight: viewMode === 'BROKER_VIEW' ? 700 : 400 }}>
                  {fmtFull$(noiAfterReservesBroker)}
                </td>
                {viewMode !== 'BROKER_VIEW' && <td colSpan={2} />}
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontSize: 11, color: viewMode === 'BROKER_VIEW' ? '#fcd34d' : '#67e8f9', background: viewMode === 'BROKER_VIEW' ? '#1c0f00' : undefined }}>
                  {fmtFull$(noiAfterReserves)}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#67e8f9', fontSize: 9 }}>
                  {egiResolved && noiAfterReserves ? `${((noiAfterReserves / egiResolved) * 100).toFixed(1)}%` : '—'}
                </td>
                <td colSpan={3} />
              </tr>
            )}

            {/* ── DEBT SERVICE SECTION ──────────────────────────────────────── */}
            {dsInterest != null && (
              <>
                <tr style={{ background: '#0d0d1f', borderTop: '2px solid #1e1b4b' }}>
                  <td colSpan={tableColCount} style={{ padding: '4px 12px', fontSize: 9, fontWeight: 700, color: '#818cf8', fontFamily: MONO, letterSpacing: '0.1em' }}>
                    DEBT SERVICE
                  </td>
                </tr>
                <tr style={{ background: '#0d0d1f' }}>
                  <td style={{ padding: '3px 8px 3px 20px', fontSize: 9, color: '#818cf8', fontFamily: MONO, position: 'sticky', left: 0, background: '#0d0d1f' }}>
                    Interest Expense
                    <span style={{ color: '#475569', fontSize: 8, marginLeft: 6 }}>
                      {cs.interestRate != null ? `${(cs.interestRate * 100).toFixed(2)}% × ${fmtFull$(cs.loanAmount)} loan` : ''}
                    </span>
                  </td>
                  <td colSpan={viewMode === 'BROKER_VIEW' ? 1 : 3} />
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: '#818cf8', fontWeight: 600 }}>{fmtFull$(-dsInterest)}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: '#475569', fontSize: 9 }}>
                    {egiResolved && dsInterest ? `${((dsInterest / egiResolved) * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td colSpan={3} />
                </tr>
                <tr style={{ background: '#0a0a1a' }}>
                  <td style={{ padding: '3px 8px 3px 20px', fontSize: 9, color: '#818cf8', fontFamily: MONO, position: 'sticky', left: 0, background: '#0a0a1a' }}>
                    Principal Amortization
                    <span style={{ color: '#475569', fontSize: 8, marginLeft: 6 }}>
                      {isIO ? `${cs.ioPeriodMonths}mo IO — no principal` : cs.amortizationYears ? `${cs.amortizationYears}yr amort` : ''}
                    </span>
                  </td>
                  <td colSpan={viewMode === 'BROKER_VIEW' ? 1 : 3} />
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: isIO ? '#475569' : '#818cf8', fontWeight: 600 }}>
                    {isIO ? '$0' : dsPrincipal != null ? fmtFull$(-dsPrincipal) : '—'}
                  </td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: '#475569', fontSize: 9 }}>
                    {!isIO && egiResolved && dsPrincipal ? `${((dsPrincipal / egiResolved) * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td colSpan={3} />
                </tr>
                <tr style={{ background: '#0d0d1f', borderTop: '1px solid #312e81', borderBottom: '2px solid #312e81' }}>
                  <td style={{ padding: '5px 8px', fontWeight: 700, color: '#c7d2fe', fontFamily: LABEL, fontSize: 9, letterSpacing: '0.05em', position: 'sticky', left: 0, background: '#0d0d1f' }}>
                    ═══ TOTAL DEBT SERVICE ═══
                  </td>
                  <td colSpan={viewMode === 'BROKER_VIEW' ? 1 : 3} />
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, fontSize: 11, color: '#c7d2fe' }}>
                    {fmtFull$(dsTotalService != null ? -dsTotalService : null)}
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', color: '#818cf8', fontSize: 9 }}>
                    {egiResolved && dsTotalService ? `${((dsTotalService / egiResolved) * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td colSpan={3} />
                </tr>
              </>
            )}
          </tbody>
        </table>

        {/* ── SECTION C — NOI Bridge ── */}
        {noiRow?.resolved && (
          <NoisBridge egiRow={egiRow} ctrlOpex={ctrlSubtotalRow.resolved} nctrlOpex={nctrlSubtotalRow.resolved} noi={noiRow.resolved} totalUnits={totalUnits} capRate={capRate} />
        )}

        {/* ── SECTION C — Capital Stack at Close ── */}
        <CapitalStackPanel
          dealId={dealId}
          capitalStack={data.capitalStack}
          purchasePriceFallback={purchasePrice}
          capRate={capRate}
          noi={noiRow?.resolved ?? null}
          totalUnits={totalUnits}
        />

        {/* ── SECTION D — AI Commentary ── */}
        <CommentaryPanel dealId={dealId} dealName={data.dealName} />
      </div>

      {/* ── Footer legend ── */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 12px', borderTop: '1px solid #1e1e1e', background: BT.bg.header,
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: '#475569', letterSpacing: 0.5 }}>SOURCE LEGEND:</span>
          {[
            { color: '#f59e0b', label: 'OM Narrative' },
            { color: '#f8fafc', label: 'T-12' },
            { color: '#06b6d4', label: 'County Assessor' },
            { color: '#60a5fa', label: 'Platform' },
            { color: '#c084fc', label: 'Override' },
            { color: '#475569', label: 'Not Provided' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: 1, background: color, display: 'inline-block' }} />
              <span style={{ fontFamily: LABEL, fontSize: 8, color: '#475569' }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 8, color: '#334155' }}>
          {data.meta.updatedAt ? `SEEDED ${new Date(data.meta.updatedAt).toISOString().slice(0, 16)} UTC` : 'PENDING SEED'}
        </div>
      </div>
    </div>

    <ConcessionDrilldownModal
      open={conDrill.open}
      onClose={() => setConDrill(p => ({ ...p, open: false }))}
      periodLabel={conDrill.periodLabel}
      recognizedAmount={conDrill.recognizedAmount}
      earnedAmount={conDrill.earnedAmount}
      detail={conDrill.detail}
      source={conDrill.source}
      calendarYearTotal={conDrill.calendarYearTotal}
      fiscalYearTotal={conDrill.fiscalYearTotal}
    />

    {/* ── Data Quality Alert drawer (Task #691) ── */}
    {dqaDrawer && (
      <div
        onClick={() => setDqaDrawer(null)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: 420, height: '100%', background: '#0f1117',
            borderLeft: `3px solid ${dqaDrawer.severity === 'critical' ? '#ef4444' : dqaDrawer.severity === 'warning' ? '#f59e0b' : '#475569'}`,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '10px 14px', background: '#111827', borderBottom: '1px solid #1e293b',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
          }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                color: dqaDrawer.severity === 'critical' ? '#f87171' : dqaDrawer.severity === 'warning' ? '#fcd34d' : '#94a3b8' }}>
                {dqaDrawer.classification.replace(/_/g, ' ')} · {dqaDrawer.severity.toUpperCase()}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#e2e8f0', marginTop: 3 }}>
                {dqaDrawer.proforma_row.replace(/_/g, ' ').toUpperCase()} · {dqaDrawer.proforma_column.toUpperCase()} column
              </div>
              <div style={{ fontFamily: LABEL, fontSize: 8, color: '#475569', marginTop: 2 }}>
                {dqaDrawer.document_type} · {dqaDrawer.status.toUpperCase()}
              </div>
            </div>
            <button onClick={() => setDqaDrawer(null)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>✕</button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Reasoning */}
            <div>
              <div style={{ fontFamily: LABEL, fontSize: 8, color: '#475569', letterSpacing: '0.06em', marginBottom: 4 }}>FINDING</div>
              <p style={{ fontFamily: LABEL, fontSize: 10, color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
                {dqaDrawer.agent_finding.reasoning}
              </p>
            </div>

            {/* Values */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {dqaDrawer.agent_finding.extracted_value != null && (
                <div style={{ background: '#1e293b', borderRadius: 3, padding: '8px 10px' }}>
                  <div style={{ fontFamily: LABEL, fontSize: 7, color: '#475569', letterSpacing: '0.06em', marginBottom: 3 }}>EXTRACTED VALUE</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: '#f87171' }}>{String(dqaDrawer.agent_finding.extracted_value)}</div>
                </div>
              )}
              {dqaDrawer.agent_finding.expected_value != null && (
                <div style={{ background: '#1e293b', borderRadius: 3, padding: '8px 10px' }}>
                  <div style={{ fontFamily: LABEL, fontSize: 7, color: '#475569', letterSpacing: '0.06em', marginBottom: 3 }}>EXPECTED VALUE</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: '#34d399' }}>{String(dqaDrawer.agent_finding.expected_value)}</div>
                </div>
              )}
            </div>

            {/* Source evidence */}
            {dqaDrawer.agent_finding.source_evidence?.snippet && (
              <div>
                <div style={{ fontFamily: LABEL, fontSize: 8, color: '#475569', letterSpacing: '0.06em', marginBottom: 4 }}>
                  SOURCE EVIDENCE
                  {dqaDrawer.agent_finding.source_evidence.page && <span style={{ color: '#334155' }}> · p.{dqaDrawer.agent_finding.source_evidence.page}</span>}
                  {dqaDrawer.agent_finding.source_evidence.section && <span style={{ color: '#334155' }}> · {dqaDrawer.agent_finding.source_evidence.section}</span>}
                </div>
                <div style={{
                  fontFamily: MONO, fontSize: 8.5, color: '#64748b',
                  background: '#0f172a', borderRadius: 3, padding: '8px 10px',
                  borderLeft: '2px solid #1e293b', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {dqaDrawer.agent_finding.source_evidence.snippet}
                </div>
              </div>
            )}

            {/* Recommended action — canonical copy for taxonomy classes; Claude text otherwise */}
            {(() => {
              const canonicalCopy: Record<string, string> = {
                SEED_PLUMBING_WRITE_RACE: 'Pipeline issue — engineering ticket recommended. Back-fill displays correct value temporarily; year1 stays stale until fix.',
                SEED_PLUMBING_STALE_SEED: 'Trigger a reseed to refresh year1 from current source data. Back-fill protects display in the meantime.',
                NOT_IN_DOC:               'Verified — document does not contain this field. No action required.',
              };
              const text = canonicalCopy[dqaDrawer.classification] ?? dqaDrawer.agent_finding.recommended_action;
              if (!text) return null;
              const isAbsence = dqaDrawer.classification === 'NOT_IN_DOC';
              return (
                <div style={{ background: isAbsence ? '#0a1a0a' : '#0c1a2a', borderRadius: 3, padding: '8px 10px', borderLeft: `2px solid ${isAbsence ? '#16a34a' : '#1d4ed8'}` }}>
                  <div style={{ fontFamily: LABEL, fontSize: 7, color: isAbsence ? '#22c55e' : '#3b82f6', letterSpacing: '0.06em', marginBottom: 3 }}>RECOMMENDED ACTION</div>
                  <p style={{ fontFamily: LABEL, fontSize: 9, color: isAbsence ? '#86efac' : '#93c5fd', lineHeight: 1.5, margin: 0 }}>
                    {text}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Footer actions */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid #1e293b', display: 'flex', gap: 8 }}>
            <button
              onClick={() => dismissDqaAlert(dqaDrawer.id, 'Dismissed by operator')}
              style={{
                flex: 1, padding: '6px', background: '#1c1917', border: '1px solid #292524',
                borderRadius: 2, color: '#78716c', cursor: 'pointer',
                fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
              }}
            >
              DISMISS
            </button>
            <button
              onClick={async () => {
                try {
                  await apiClient.patch(`/api/v1/deals/data-quality-alerts/${dqaDrawer.id}`, { status: 'acknowledged' });
                  setDqaAlerts(prev => prev.map(a => a.id === dqaDrawer.id ? { ...a, status: 'acknowledged' } : a));
                  setDqaDrawer(null);
                } catch { /* ignore */ }
              }}
              style={{
                flex: 1, padding: '6px', background: '#1a1200', border: '1px solid #2a1e00',
                borderRadius: 2, color: '#fcd34d', cursor: 'pointer',
                fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
              }}
            >
              ACKNOWLEDGE
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ─── ValuationSnapshotStrip ────────────────────────────────────────────────────

function vsFmtPct(v: number | null, decimals = 2): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(decimals)}%`;
}
function vsFmtX(v: number | null, decimals = 1): string {
  if (v == null) return '—';
  return `${v.toFixed(decimals)}×`;
}
function vsFmtDollarK(v: number | null): string {
  if (v == null) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v.toLocaleString()}`;
}

function PctBadge({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct == null) return <span style={{ fontFamily: MONO, fontSize: 8, color: '#475569' }}>—</span>;
  const isHigh = invert ? pct < 30 : pct > 70;
  const isMid = pct >= 30 && pct <= 70;
  const bg = isHigh ? '#1c0a0a' : isMid ? '#1a1200' : '#0a1c10';
  const color = isHigh ? '#ef4444' : isMid ? '#f59e0b' : '#22c55e';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '1px 5px', borderRadius: 3, background: bg,
      fontFamily: MONO, fontSize: 8, color, fontWeight: 700, letterSpacing: 0.4,
    }}>
      P{Math.round(pct)}
    </span>
  );
}

function VSSnapshotTile({
  label, value, sub, pct, invertBadge, note, flagColor,
}: {
  label: string;
  value: string;
  sub: string | null;
  pct: number | null;
  invertBadge?: boolean;
  note?: string | null;
  flagColor?: string | null;
}) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: 120, maxWidth: 200,
      background: '#0d0d0d', border: '1px solid #1e1e1e',
      borderTop: `2px solid ${flagColor ?? '#06b6d4'}`,
      padding: '8px 10px 7px',
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div style={{ fontFamily: LABEL, fontSize: 8, color: '#475569', letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 16, color: '#e2e8f0', fontWeight: 700, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 8, color: '#475569' }}>
        MED {sub ?? '—'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
        <PctBadge pct={pct} invert={invertBadge} />
        {note && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '1px 5px', borderRadius: 3,
            background: flagColor === '#22c55e' ? '#0a1c10' : flagColor === '#f59e0b' ? '#1a1200' : '#1e1e1e',
            fontFamily: MONO, fontSize: 8,
            color: flagColor === '#22c55e' ? '#22c55e' : flagColor === '#f59e0b' ? '#f59e0b' : '#94a3b8',
            fontWeight: 700, letterSpacing: 0.4,
          }}>{note}</span>
        )}
      </div>
    </div>
  );
}

function ValuationSnapshotStrip({ vs }: { vs: ValuationSnapshot }) {
  const grmFlag = vs.grm != null && vs.grm > 12 && vs.grmSubmarketMedian != null && vs.grmSubmarketMedian < 10
    ? '#ef4444' : null;

  const priceToRCBadgeColor =
    vs.priceToRC != null && vs.priceToRC < 0.80 ? '#22c55e' :
    vs.priceToRC != null && vs.priceToRC > 1.00 ? '#f59e0b' : null;
  const priceToRCNote =
    vs.priceToRC != null && vs.priceToRC < 0.80 ? 'BUY<BUILD' :
    vs.priceToRC != null && vs.priceToRC > 1.00 ? 'BUILD<BUY' : null;

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20,
      flexShrink: 0, borderBottom: '1px solid #1e1e1e',
      background: BT.bg.terminal,
    }}>
      <div style={{
        padding: '5px 12px 4px',
        background: BT.bg.terminal,
        borderBottom: '1px solid #1e1e1e',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontFamily: LABEL, fontSize: 8, color: '#06b6d4', letterSpacing: 1 }}>VALUATION SNAPSHOT</span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: '#334155' }}>6 GATEWAY METRICS · SUBMARKET COMPS PENDING FEED</span>
      </div>
      <div style={{ display: 'flex', gap: 1, background: '#070707', padding: '1px' }}>
        <VSSnapshotTile
          label="Price / Unit"
          value={vsFmtDollarK(vs.pricePerUnit)}
          sub={vs.pricePerUnitSubmarketMedian != null ? vsFmtDollarK(vs.pricePerUnitSubmarketMedian) : null}
          pct={vs.pricePerUnitPercentile}
          invertBadge
        />
        <VSSnapshotTile
          label="Price / SF"
          value={vs.pricePerSF != null ? `$${vs.pricePerSF.toFixed(0)}/SF` : '—'}
          sub={vs.pricePerSFSubmarketMedian != null ? `$${vs.pricePerSFSubmarketMedian.toFixed(0)}/SF` : null}
          pct={vs.pricePerSFPercentile}
          invertBadge
        />
        <VSSnapshotTile
          label="GRM"
          value={vsFmtX(vs.grm)}
          sub={vs.grmSubmarketMedian != null ? vsFmtX(vs.grmSubmarketMedian) : null}
          pct={vs.grmPercentile}
          invertBadge
          flagColor={grmFlag}
        />
        <VSSnapshotTile
          label="GIM"
          value={vsFmtX(vs.gim)}
          sub={vs.gimSubmarketMedian != null ? vsFmtX(vs.gimSubmarketMedian) : null}
          pct={vs.gimPercentile}
          invertBadge
        />
        <VSSnapshotTile
          label="Going-In Cap"
          value={vsFmtPct(vs.goingInCapT12)}
          sub={vs.goingInCapSubmarketMedian != null ? vsFmtPct(vs.goingInCapSubmarketMedian) : null}
          pct={vs.goingInCapPercentile}
        />
        <VSSnapshotTile
          label="Price-to-RC"
          value={vs.priceToRC != null ? `${(vs.priceToRC * 100).toFixed(0)}%` : '—'}
          sub={null}
          pct={null}
          flagColor={priceToRCBadgeColor}
          note={priceToRCNote}
        />
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Th({ label, color, highlight, left, min, sticky, hidden, brokerActive, onCycle }: {
  label: string; color?: string; highlight?: boolean; left?: boolean; min?: number; sticky?: boolean;
  hidden?: boolean; brokerActive?: boolean; onCycle?: () => void;
}) {
  if (hidden) return null;
  return (
    <th
      onClick={onCycle}
      style={{
        padding: '5px 8px', textAlign: left ? 'left' : 'right',
        color: brokerActive ? '#f59e0b' : highlight ? '#e2e8f0' : (color ?? '#64748b'),
        fontWeight: 700, fontSize: 9, letterSpacing: 0.5,
        minWidth: min, whiteSpace: 'nowrap',
        position: sticky ? 'sticky' : undefined, left: sticky ? 0 : undefined,
        background: BT.bg.header, borderBottom: '1px solid #2d2d2d',
        fontFamily: 'Inter, sans-serif',
        ...(onCycle ? { cursor: 'pointer', userSelect: 'none' } : {}),
        ...(brokerActive ? { borderBottom: '2px solid #f59e0b', background: '#1c1000' } : {}),
        ...(highlight ? { borderBottom: '2px solid #06b6d4', background: '#0d1f2d' } : {}),
      }}
    >
      {onCycle ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {label}
          <span style={{ fontSize: 7, color: '#475569', letterSpacing: 0 }}>▲▼</span>
        </span>
      ) : label}
    </th>
  );
}

/** Returns the value to display in the Platform comparison column based on the user-selected source. */
function pickPlatformValue(row: OperatingStatementRow, src: PlatformColSource): number | null {
  switch (src) {
    case 'T12': return row.t12;
    case 'T6':  return row.t6 ?? row.t12;
    case 'T3':  return row.t3 ?? row.t12;
    case 'T1':  return row.t1 ?? row.t12;
    default:    return row.platform;
  }
}

/** Returns the value for the trailing-period Y1 column based on the active period picker. */
function pickY1ColValue(row: OperatingStatementRow, period: 'T12' | 'T6' | 'T3' | 'T1'): number | null {
  switch (period) {
    case 'T6': return row.t6 ?? row.t12;
    case 'T3': return row.t3 ?? row.t12;
    case 'T1': return row.t1 ?? row.t12;
    default:   return row.t12;
  }
}

function SectionHeader({ label, accentColor, bg, cols = 9 }: { label: string; accentColor: string; bg: string; cols?: number }) {
  return (
    <tr>
      <td colSpan={cols} style={{
        padding: '5px 8px 5px 12px',
        background: bg,
        borderTop: '1px solid #1e1e1e',
        borderBottom: '1px solid #1e1e1e',
        borderLeft: `3px solid ${accentColor}`,
        fontFamily: 'Inter, sans-serif',
        fontSize: 9, fontWeight: 700,
        color: '#cbd5e1', letterSpacing: 0.8, textTransform: 'uppercase',
      }}>{label}</td>
    </tr>
  );
}

function SubtotalRow({ label, row, color, textColor, egiResolved, fullFormat, activePeriod }: {
  label: string; row: OperatingStatementRow; color: string; textColor: string; egiResolved: number | null; fullFormat?: boolean; activePeriod?: 'T12' | 'T6' | 'T3' | 'T1';
}) {
  const viewMode          = useDealStore(s => s.viewMode);
  const platformColSource = useDealStore(s => s.platformColSource);
  const isBroker = viewMode === 'BROKER_VIEW';
  const displayResolved = isBroker ? (row.broker ?? row.resolved) : row.resolved;
  const egiPct = egiResolved && displayResolved ? (displayResolved / egiResolved) * 100 : null;
  const f = fullFormat ? fmtFull$ : fmt$;
  const trailingVal = pickY1ColValue(row, activePeriod ?? 'T12');
  return (
    <tr style={{ background: color }}>
      <td style={{ padding: '4px 8px', fontWeight: 700, color: '#cbd5e1', fontFamily: 'Inter, sans-serif', fontSize: 9, position: 'sticky', left: 0, background: color }}>
        ─── {label} ───
      </td>
      <td style={{ padding: '4px 8px', textAlign: 'right', color: isBroker ? '#fcd34d' : textColor, fontSize: 9, fontWeight: isBroker ? 700 : 400 }}>{f(row.broker)}</td>
      {!isBroker && <td style={{ padding: '4px 8px', textAlign: 'right', color: '#e2e8f0', fontSize: 9 }}>{f(trailingVal)}</td>}
      {!isBroker && <td style={{ padding: '4px 8px', textAlign: 'right', color: '#06b6d4', fontSize: 9 }}>{f(pickPlatformValue(row, platformColSource))}</td>}
      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700,
        color: isBroker ? '#fcd34d' : textColor,
        background: isBroker ? '#1c0f00' : 'rgba(0,0,0,0.3)',
      }}>
        {f(displayResolved)}
      </td>
      <td style={{ padding: '4px 8px', textAlign: 'right', color: '#475569', fontSize: 9 }}>
        {egiPct != null ? `${egiPct.toFixed(1)}%` : '—'}
      </td>
      <td style={{ padding: '4px 8px' }}><SourceBadge source={row.source} /></td>
      <td style={{ padding: '4px 8px', textAlign: 'right', color: textColor, fontSize: 9 }}>
        {row.perUnit != null ? `$${row.perUnit.toLocaleString()}` : '—'}
      </td>
      <td />
    </tr>
  );
}

// ─── Ancillary expansion panel ────────────────────────────────────────────────
// Task #519 rewrite: three-source reconciliation (Rent Roll / T-12 / OM) with
// per-row override + user-added custom lines. Reads `otherIncomeBreakdown` and
// `otherIncomeUserLines` straight from the financials response (no extra
// network round-trip). All persistence routes through the existing override
// endpoint and the new user-lines CRUD endpoints; on every successful save we
// call `onChange` to re-pull the resolved values + EGI/NOI.
const CAT_LABELS: Record<string, string> = {
  parking: 'Parking', pet: 'Pet Rent', storage: 'Storage', laundry: 'Laundry',
  rubs: 'RUBS / Utility Reimb', fees: 'Application / Admin / Late Fees',
  insurance_admin: 'Renters Insurance', other: 'Other Ancillary',
};
const SRC_BADGE: Record<string, { label: string; color: string }> = {
  rent_roll: { label: 'RR', color: '#22d3ee' },
  t12: { label: 'T-12', color: '#94a3b8' },
  om: { label: 'OM', color: '#f59e0b' },
  override: { label: 'Override', color: '#c084fc' },
  agent: { label: 'AI', color: '#818cf8' },
  platform_fallback: { label: '—', color: '#475569' },
  unseeded: { label: '—', color: '#475569' },
};

/** Adoption state collected during "add line" flow. Task #1147. */
type AddingAdoption = {
  enabled: boolean;
  ramp_start: string;
  ramp_duration: string;
  steady_monthly: string;
  probability: string;
};

const DEFAULT_ADOPTION: AddingAdoption = {
  enabled: false,
  ramp_start: '6',
  ramp_duration: '12',
  steady_monthly: '',
  probability: '1',
};

function AncillaryExpansionPanel({ totalUnits, dealId, breakdown, userLines, onChange, hideCategoryTable, isDevelopment }: {
  totalUnits: number;
  dealId: string;
  breakdown: DealFinancials['otherIncomeBreakdown'];
  userLines: NonNullable<DealFinancials['otherIncomeUserLines']>;
  onChange: () => Promise<void> | void;
  /** When true, hides the category reconciliation table and only shows user-line management. */
  hideCategoryTable?: boolean;
  /** When true, new lines default to adoption enabled (development deals). Task #1147. */
  isDevelopment?: boolean;
}) {
  const [editing, setEditing] = useState<
    | { kind: 'cat'; cat: string; val: string }
    | { kind: 'user'; id: string; field: 'label' | 'monthly' | 'qty' | 'rate'; val: string }
    | null
  >(null);
  // `mode: 'flat'` collects a single $/mo total (legacy). `mode: 'per_unit'`
  // collects qty + $/unit/mo and the server derives `monthly` (e.g. cable
  // billed to 200 of 232 units @ $30/mo → 6,000/mo).
  const [adding, setAdding] = useState<
    | { mode: 'flat'; label: string; monthly: string; adoption: AddingAdoption }
    | { mode: 'per_unit'; label: string; qty: string; rate: string; adoption: AddingAdoption }
    | null
  >(null);
  // Adoption edit for existing lines: { id, fields }
  const [adoptionEdit, setAdoptionEdit] = useState<{
    id: string;
    ramp_start: string;
    ramp_duration: string;
    steady_monthly: string;
    probability: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = breakdown?.rows ?? [];
  const total = breakdown?.total ?? { rent_roll: null, t12: null, om: null, resolved: 0 };
  const userLinesAnnual = userLines.reduce((s, l) => s + (l.monthly * 12), 0);
  const grandTotal = (total.resolved ?? 0) + userLinesAnnual;

  const cell = (v: number | null, color = '#94a3b8'): React.ReactNode =>
    <span style={{ color: v == null ? '#334155' : color }}>{v == null ? '—' : fmt$(v)}</span>;

  const saveCategoryOverride = async (cat: string, raw: string) => {
    setBusy(true);
    try {
      const num = raw.trim() === '' ? null : parseFloat(raw);
      if (num != null && (!Number.isFinite(num) || num < 0)) { setEditing(null); return; }
      // applyFinancialsOverride already handles dotted layered paths via FIELD_MAP fallthrough.
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, {
        field: `other_income_breakdown.${cat}`, year: null, value: num,
      });
      await onChange();
    } catch (e) { console.error('Override save failed:', e); }
    finally { setBusy(false); setEditing(null); }
  };

  const [addError, setAddError] = useState<string | null>(null);

  /** Build adoption body from AddingAdoption state, or undefined if not enabled. */
  const buildAdoptionBody = (adp: AddingAdoption, fallbackMonthly: number | null): Record<string, number> | null | undefined => {
    if (!adp.enabled) return undefined;
    const rampStart    = parseFloat(adp.ramp_start);
    const rampDuration = parseFloat(adp.ramp_duration);
    const steadyMonthly = adp.steady_monthly !== '' ? parseFloat(adp.steady_monthly) : fallbackMonthly;
    const probability  = adp.probability !== '' ? parseFloat(adp.probability) : 1;
    if (!Number.isFinite(rampStart) || !Number.isFinite(rampDuration) || !Number.isFinite(steadyMonthly) || !Number.isFinite(probability)) return undefined;
    if (steadyMonthly == null || !Number.isFinite(steadyMonthly)) return undefined;
    return {
      ramp_start_period:    Math.max(0, Math.round(rampStart)),
      ramp_duration_months: Math.max(0, Math.round(rampDuration)),
      steady_state_monthly: Math.max(0, steadyMonthly),
      probability_adopted:  Math.min(1, Math.max(0, probability)),
    };
  };

  const addLine = async () => {
    if (!adding || !adding.label.trim()) return;
    let body: Record<string, unknown> | null = null;
    if (adding.mode === 'flat') {
      const monthly = parseFloat(adding.monthly);
      if (!Number.isFinite(monthly) || monthly < 0) {
        setAddError('Monthly must be a non-negative number');
        return;
      }
      const adoption = buildAdoptionBody(adding.adoption, monthly);
      body = { label: adding.label.trim(), monthly, ...(adoption !== undefined ? { adoption } : {}) };
    } else {
      const qty = parseFloat(adding.qty);
      const rate = parseFloat(adding.rate);
      if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(rate) || rate < 0) {
        setAddError('Qty and rate must both be non-negative numbers');
        return;
      }
      const derivedMonthly = qty * rate;
      const adoption = buildAdoptionBody(adding.adoption, derivedMonthly);
      // Server derives `monthly = qty * rate` and persists all three fields.
      body = { label: adding.label.trim(), qty, rate, frequency: 'monthly', ...(adoption !== undefined ? { adoption } : {}) };
    }
    setBusy(true);
    setAddError(null);
    try {
      await apiClient.post(`/api/v1/deals/${dealId}/financials/other-income/user-lines`, body);
      await onChange();
      setAdding(null);
    } catch (e: unknown) {
      // Surface the server's reason instead of silently swallowing — users
      // saw the form go quiet and assumed the page crashed. Server returns
      // { error: "<reason>" } for 400/403/404/422.
      const ax = e as { response?: { status?: number; data?: { error?: string } }; message?: string };
      const status = ax?.response?.status;
      const reason = ax?.response?.data?.error ?? ax?.message ?? 'Unknown error';
      console.error('Add line failed:', status, reason, e);
      setAddError(`Save failed (${status ?? '?'}): ${reason}`);
    }
    finally { setBusy(false); }
  };

  const updateLine = async (
    id: string,
    patch: { label?: string; monthly?: number; qty?: number; rate?: number; frequency?: 'monthly' | 'annual'; adoption?: Record<string, number> | null }
  ) => {
    setBusy(true);
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/other-income/user-lines/${id}`, patch);
      await onChange();
    } catch (e) { console.error('Update line failed:', e); }
    finally { setBusy(false); setEditing(null); }
  };

  /** Save the inline adoption edit for an existing line. */
  const saveAdoptionEdit = async () => {
    if (!adoptionEdit) return;
    const { id, ramp_start, ramp_duration, steady_monthly, probability } = adoptionEdit;
    const rs = parseFloat(ramp_start), rd = parseFloat(ramp_duration), sm = parseFloat(steady_monthly), pb = parseFloat(probability);
    if (!Number.isFinite(rs) || !Number.isFinite(rd) || !Number.isFinite(sm) || !Number.isFinite(pb)) return;
    setBusy(true);
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/other-income/user-lines/${id}`, {
        adoption: { ramp_start_period: Math.max(0, Math.round(rs)), ramp_duration_months: Math.max(0, Math.round(rd)), steady_state_monthly: Math.max(0, sm), probability_adopted: Math.min(1, Math.max(0, pb)) },
      });
      await onChange();
    } catch (e) { console.error('Adoption save failed:', e); }
    finally { setBusy(false); setAdoptionEdit(null); }
  };

  /** Clear the adoption block on an existing line. */
  const clearAdoption = async (id: string) => {
    setBusy(true);
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/other-income/user-lines/${id}`, { adoption: null });
      await onChange();
    } catch (e) { console.error('Clear adoption failed:', e); }
    finally { setBusy(false); }
  };

  const deleteLine = async (id: string) => {
    setBusy(true);
    try {
      await apiClient.delete(`/api/v1/deals/${dealId}/financials/other-income/user-lines/${id}`);
      await onChange();
    } catch (e) { console.error('Delete line failed:', e); }
    finally { setBusy(false); }
  };

  const TH = ({ label, right }: { label: string; right?: boolean }) => (
    <th style={{ padding: '3px 8px', textAlign: right ? 'right' : 'left', color: '#475569', fontWeight: 600, letterSpacing: '0.05em', borderBottom: '1px solid #1e2d3d', fontSize: 9 }}>{label}</th>
  );

  return (
    <div style={{ padding: '10px 16px 14px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: '#06b6d4', letterSpacing: '0.08em' }}>
            ANCILLARY RECONCILIATION · RENT-ROLL · T-12 · OM
          </span>
          <span style={{ fontFamily: LABEL, fontSize: 8, color: '#334155', marginLeft: 8 }}>
            click RESOLVED to override · annual $ figures
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setAdding({ mode: 'flat', label: '', monthly: '', adoption: { ...DEFAULT_ADOPTION, enabled: !!isDevelopment } })} disabled={busy || !!adding}
            title="Add a line as a single $/month total"
            style={{ fontFamily: LABEL, fontSize: 9, color: '#06b6d4', background: '#062a3a', border: '1px solid #0891b2', padding: '3px 10px', borderRadius: 2, cursor: 'pointer' }}>
            + Flat $/mo
          </button>
          <button onClick={() => setAdding({ mode: 'per_unit', label: '', qty: '', rate: '', adoption: { ...DEFAULT_ADOPTION, enabled: !!isDevelopment } })} disabled={busy || !!adding}
            title="Add a line as qty × $/unit/mo (e.g. 200 units billed cable @ $30/mo)"
            style={{ fontFamily: LABEL, fontSize: 9, color: '#22d3ee', background: '#062a3a', border: '1px solid #0891b2', padding: '3px 10px', borderRadius: 2, cursor: 'pointer' }}>
            + Per-Unit Line
          </button>
        </div>
      </div>
      {addError && (
        <div style={{
          fontFamily: LABEL, fontSize: 9, color: '#fecaca', background: '#450a0a',
          border: '1px solid #b91c1c', padding: '4px 8px', borderRadius: 2, margin: '4px 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
        }}>
          <span>{addError}</span>
          <button onClick={() => setAddError(null)} style={{ background: 'none', border: 'none', color: '#fecaca', cursor: 'pointer', fontSize: 11 }}>✕</button>
        </div>
      )}
      {!hideCategoryTable && !breakdown && (
        <div style={{ fontFamily: LABEL, fontSize: 9, color: '#475569', padding: '6px 0' }}>
          No ancillary income data extracted yet. Upload an OM, Rent Roll, or T-12 to populate this table.
        </div>
      )}
      {!hideCategoryTable && breakdown && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
          <thead>
            <tr style={{ background: '#0a1520' }}>
              <TH label="CATEGORY" />
              <TH label="RENT ROLL" right />
              <TH label="T-12" right />
              <TH label="OM" right />
              <TH label="RESOLVED" right />
              <TH label="SOURCE" />
              <TH label="" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const meta = SRC_BADGE[r.resolution] ?? SRC_BADGE.unseeded;
              const isEditing = editing?.kind === 'cat' && editing.cat === r.category;
              return (
                <tr key={r.category} style={{ background: i % 2 === 0 ? '#060e16' : '#080f18' }}>
                  <td style={{ padding: '3px 8px', color: '#94a3b8' }}>{CAT_LABELS[r.category] ?? r.category}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>{cell(r.rent_roll, '#22d3ee')}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>{cell(r.t12)}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>{cell(r.om, '#f59e0b')}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                    {isEditing ? (
                      <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                        <input autoFocus type="number" value={editing.val}
                          onChange={e => setEditing({ ...editing, val: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') saveCategoryOverride(r.category, editing.val); if (e.key === 'Escape') setEditing(null); }}
                          style={{ width: 80, background: '#0f172a', border: '1px solid #06b6d4', color: '#06b6d4', fontFamily: MONO, fontSize: 9, padding: '2px 4px', textAlign: 'right', borderRadius: 2 }}
                        />
                        <button onClick={() => saveCategoryOverride(r.category, editing.val)} disabled={busy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', padding: 0, fontSize: 10 }}>✓</button>
                        <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, fontSize: 10 }}>✕</button>
                      </span>
                    ) : (
                      <span onClick={() => setEditing({ kind: 'cat', cat: r.category, val: r.resolved != null ? String(Math.round(r.resolved)) : '' })}
                        style={{ cursor: 'pointer', color: r.resolved != null ? '#e2e8f0' : '#475569', borderBottom: '1px dotted #0891b2', padding: '0 4px' }}>
                        {r.resolved != null ? fmt$(r.resolved) : '—'}
                      </span>
                    )}
                    {r.conflict && (
                      <span title="Sources disagree by more than 15%" style={{ color: '#ef4444', marginLeft: 4 }}>⚠</span>
                    )}
                  </td>
                  <td style={{ padding: '3px 8px' }}>
                    <span style={{ color: meta.color, fontFamily: LABEL, fontSize: 8, fontWeight: 700 }}>{meta.label}</span>
                  </td>
                  <td />
                </tr>
              );
            })}
            {/* User-added lines */}
            {userLines.map((l, i) => {
              const isEditingLabel = editing?.kind === 'user' && editing.id === l.id && editing.field === 'label';
              const isEditingAmt = editing?.kind === 'user' && editing.id === l.id && editing.field === 'monthly';
              return (
                <tr key={l.id} style={{ background: (rows.length + i) % 2 === 0 ? '#060e16' : '#080f18', borderTop: i === 0 ? '1px solid #1e2d3d' : undefined }}>
                  <td style={{ padding: '3px 8px', color: '#c084fc' }}>
                    {isEditingLabel ? (
                      <input autoFocus value={editing.val}
                        onChange={e => setEditing({ ...editing, val: e.target.value })}
                        onBlur={() => updateLine(l.id, { label: editing.val })}
                        onKeyDown={e => { if (e.key === 'Enter') updateLine(l.id, { label: editing.val }); if (e.key === 'Escape') setEditing(null); }}
                        style={{ background: '#0f172a', border: '1px solid #c084fc', color: '#c084fc', fontFamily: MONO, fontSize: 9, padding: '2px 4px', borderRadius: 2 }}
                      />
                    ) : (
                      <span onClick={() => setEditing({ kind: 'user', id: l.id, field: 'label', val: l.label })}
                        style={{ cursor: 'pointer', borderBottom: '1px dotted #c084fc' }}>{l.label}</span>
                    )}
                  </td>
                  {/* QTY · RATE columns (per-unit pricing model) — clicking
                      either opens an inline edit; saving recomputes monthly
                      server-side. For flat lines (no qty/rate) cells are
                      blank and only the RESOLVED $/mo column is editable. */}
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                    {editing?.kind === 'user' && editing.id === l.id && editing.field === 'qty' ? (
                      <input autoFocus type="number" value={editing.val}
                        onChange={e => setEditing({ ...editing, val: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const q = parseFloat(editing.val);
                            if (Number.isFinite(q) && q >= 0) updateLine(l.id, { qty: q, rate: l.rate ?? 0, frequency: l.frequency ?? 'monthly' });
                          }
                          if (e.key === 'Escape') setEditing(null);
                        }}
                        style={{ width: 60, background: '#0f172a', border: '1px solid #c084fc', color: '#c084fc', fontFamily: MONO, fontSize: 9, padding: '2px 4px', textAlign: 'right', borderRadius: 2 }}
                      />
                    ) : l.qty != null ? (
                      <span onClick={() => setEditing({ kind: 'user', id: l.id, field: 'qty', val: String(l.qty) })}
                        style={{ cursor: 'pointer', color: '#94a3b8', borderBottom: '1px dotted #c084fc' }}>
                        {l.qty.toLocaleString()}
                      </span>
                    ) : <span style={{ color: '#1e293b' }}>—</span>}
                  </td>
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                    {editing?.kind === 'user' && editing.id === l.id && editing.field === 'rate' ? (
                      <input autoFocus type="number" value={editing.val}
                        onChange={e => setEditing({ ...editing, val: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const r = parseFloat(editing.val);
                            if (Number.isFinite(r) && r >= 0) updateLine(l.id, { qty: l.qty ?? 0, rate: r, frequency: l.frequency ?? 'monthly' });
                          }
                          if (e.key === 'Escape') setEditing(null);
                        }}
                        style={{ width: 70, background: '#0f172a', border: '1px solid #c084fc', color: '#c084fc', fontFamily: MONO, fontSize: 9, padding: '2px 4px', textAlign: 'right', borderRadius: 2 }}
                      />
                    ) : l.rate != null ? (
                      <span onClick={() => setEditing({ kind: 'user', id: l.id, field: 'rate', val: String(l.rate) })}
                        style={{ cursor: 'pointer', color: '#94a3b8', borderBottom: '1px dotted #c084fc' }}
                        title={`$${l.rate}/unit/${l.frequency === 'annual' ? 'yr' : 'mo'}`}>
                        ${l.rate}
                      </span>
                    ) : <span style={{ color: '#1e293b' }}>—</span>}
                  </td>
                  <td style={{ padding: '3px 8px', textAlign: 'right', color: '#475569', fontStyle: 'italic', fontSize: 8 }}>
                    {l.qty != null && l.rate != null
                      ? `${l.qty} × $${l.rate}/${l.frequency === 'annual' ? 'yr' : 'mo'}`
                      : 'user-added'}
                  </td>
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                    {isEditingAmt ? (
                      <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                        <input autoFocus type="number" value={editing.val}
                          onChange={e => setEditing({ ...editing, val: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const m = parseFloat(editing.val);
                              if (Number.isFinite(m) && m >= 0) updateLine(l.id, { monthly: m });
                            }
                            if (e.key === 'Escape') setEditing(null);
                          }}
                          style={{ width: 80, background: '#0f172a', border: '1px solid #c084fc', color: '#c084fc', fontFamily: MONO, fontSize: 9, padding: '2px 4px', textAlign: 'right', borderRadius: 2 }}
                        />
                        <span style={{ color: '#475569', fontSize: 8 }}>/mo</span>
                      </span>
                    ) : (
                      // Flat lines: clicking edits monthly directly. Per-unit
                      // lines: monthly is derived (display-only) — direct it
                      // back to qty/rate edits to avoid the three-field
                      // conflict where a manual monthly contradicts qty*rate.
                      l.qty != null && l.rate != null ? (
                        <span style={{ color: '#e2e8f0' }} title="Computed from qty × rate — edit those cells to change">
                          {fmt$(l.monthly * 12)} <span style={{ color: '#475569', fontSize: 8 }}>(${Math.round(l.monthly).toLocaleString()}/mo)</span>
                        </span>
                      ) : (
                        <span onClick={() => setEditing({ kind: 'user', id: l.id, field: 'monthly', val: String(l.monthly) })}
                          style={{ cursor: 'pointer', color: '#e2e8f0', borderBottom: '1px dotted #c084fc' }}>
                          {fmt$(l.monthly * 12)} <span style={{ color: '#475569', fontSize: 8 }}>(${l.monthly}/mo)</span>
                        </span>
                      )
                    )}
                  </td>
                  <td style={{ padding: '3px 8px' }}>
                    <span style={{ color: '#c084fc', fontFamily: LABEL, fontSize: 8, fontWeight: 700 }}>USER</span>
                    {l.adoption && (
                      <span style={{ marginLeft: 4, color: '#f59e0b', fontFamily: LABEL, fontSize: 7, fontWeight: 700, background: '#1c1000', border: '1px solid #78350f', borderRadius: 2, padding: '0 3px' }}>RAMP</span>
                    )}
                  </td>
                  <td style={{ padding: '3px 8px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => deleteLine(l.id)} disabled={busy} title="Delete line"
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11, marginRight: 4 }}>×</button>
                    {l.adoption ? (
                      <button onClick={() => setAdoptionEdit({ id: l.id, ramp_start: String(l.adoption!.ramp_start_period), ramp_duration: String(l.adoption!.ramp_duration_months), steady_monthly: String(l.adoption!.steady_state_monthly), probability: String(l.adoption!.probability_adopted) })}
                        disabled={busy} title="Edit adoption timeline"
                        style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: 9, fontFamily: LABEL }}>RAMP</button>
                    ) : (
                      <button onClick={() => setAdoptionEdit({ id: l.id, ramp_start: '6', ramp_duration: '12', steady_monthly: String(Math.round(l.monthly)), probability: '1' })}
                        disabled={busy} title="Add adoption timeline"
                        style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 9, fontFamily: LABEL }}>+ramp</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Inline adoption edit row for existing user lines. Task #1147. */}
            {adoptionEdit && (() => {
              const isEditingLineAdoption = userLines.some(l => l.id === adoptionEdit.id);
              if (!isEditingLineAdoption) return null;
              return (
                <tr style={{ background: '#0d1c0a' }}>
                  <td colSpan={7} style={{ padding: '4px 12px 6px 20px' }}>
                    <span style={{ fontFamily: LABEL, fontSize: 8, color: '#f59e0b', marginRight: 12, fontWeight: 700 }}>EDIT ADOPTION TIMELINE</span>
                    <label style={{ fontFamily: LABEL, fontSize: 8, color: '#94a3b8', marginRight: 4 }}>Ramp start (mo):</label>
                    <input type="number" value={adoptionEdit.ramp_start} onChange={e => setAdoptionEdit({ ...adoptionEdit, ramp_start: e.target.value })}
                      style={{ width: 44, background: '#0f172a', border: '1px solid #78350f', color: '#fcd34d', fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, marginRight: 10, textAlign: 'right' }} />
                    <label style={{ fontFamily: LABEL, fontSize: 8, color: '#94a3b8', marginRight: 4 }}>Ramp duration (mo):</label>
                    <input type="number" value={adoptionEdit.ramp_duration} onChange={e => setAdoptionEdit({ ...adoptionEdit, ramp_duration: e.target.value })}
                      style={{ width: 44, background: '#0f172a', border: '1px solid #78350f', color: '#fcd34d', fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, marginRight: 10, textAlign: 'right' }} />
                    <label style={{ fontFamily: LABEL, fontSize: 8, color: '#94a3b8', marginRight: 4 }}>Steady-state $/mo:</label>
                    <input type="number" value={adoptionEdit.steady_monthly} onChange={e => setAdoptionEdit({ ...adoptionEdit, steady_monthly: e.target.value })}
                      style={{ width: 60, background: '#0f172a', border: '1px solid #78350f', color: '#fcd34d', fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, marginRight: 10, textAlign: 'right' }} />
                    <label style={{ fontFamily: LABEL, fontSize: 8, color: '#94a3b8', marginRight: 4 }}>Probability (0–1):</label>
                    <input type="number" min={0} max={1} step={0.05} value={adoptionEdit.probability} onChange={e => setAdoptionEdit({ ...adoptionEdit, probability: e.target.value })}
                      style={{ width: 44, background: '#0f172a', border: '1px solid #78350f', color: '#fcd34d', fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, marginRight: 10, textAlign: 'right' }} />
                    <button onClick={saveAdoptionEdit} disabled={busy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', fontSize: 11, marginRight: 6 }}>✓ Save</button>
                    <button onClick={() => clearAdoption(adoptionEdit.id)} disabled={busy} title="Remove ramp" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 9, fontFamily: LABEL, marginRight: 6 }}>✕ Clear</button>
                    <button onClick={() => setAdoptionEdit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 9, fontFamily: LABEL }}>Cancel</button>
                  </td>
                </tr>
              );
            })()}
            {/* Add-line input row — two layouts depending on `adding.mode`.
                Flat: single $/mo total. Per-Unit: qty × rate (server derives
                monthly). Save button is gated on the relevant fields being
                non-empty so users can't post a half-filled per-unit line.
                Adoption timeline (Task #1147) is toggled via the RAMP button. */}
            {adding && adding.mode === 'flat' && (
              <>
                <tr style={{ background: '#0a1a26' }}>
                  <td style={{ padding: '4px 8px' }}>
                    <input autoFocus value={adding.label} placeholder="e.g. Solar revenue"
                      onChange={e => setAdding({ ...adding, label: e.target.value })}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid #06b6d4', color: '#e2e8f0', fontFamily: MONO, fontSize: 9, padding: '2px 4px', borderRadius: 2 }}
                    />
                  </td>
                  <td colSpan={3} style={{ padding: '4px 8px', textAlign: 'right', color: '#475569', fontStyle: 'italic' }}>flat $/mo line</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                    <input type="number" value={adding.monthly} placeholder="$/mo"
                      onChange={e => setAdding({ ...adding, monthly: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') addLine(); if (e.key === 'Escape') setAdding(null); }}
                      style={{ width: 80, background: '#0f172a', border: '1px solid #06b6d4', color: '#06b6d4', fontFamily: MONO, fontSize: 9, padding: '2px 4px', textAlign: 'right', borderRadius: 2 }}
                    />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <button onClick={() => setAdding({ ...adding, adoption: { ...adding.adoption, enabled: !adding.adoption.enabled } })}
                      title="Toggle adoption / ramp-up timeline (Task #1147)"
                      style={{ fontFamily: LABEL, fontSize: 8, padding: '2px 5px', borderRadius: 2, cursor: 'pointer', border: adding.adoption.enabled ? '1px solid #f59e0b' : '1px solid #1e3a5f', background: adding.adoption.enabled ? '#1c1000' : '#0a1520', color: adding.adoption.enabled ? '#f59e0b' : '#475569' }}>
                      RAMP
                    </button>
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <button onClick={addLine} disabled={busy || !adding.label.trim() || !adding.monthly} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', fontSize: 11, marginRight: 4 }}>✓ Save</button>
                    <button onClick={() => setAdding(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11 }}>✕</button>
                  </td>
                </tr>
                {adding.adoption.enabled && (
                  <tr style={{ background: '#0c1c10' }}>
                    <td colSpan={7} style={{ padding: '4px 12px 6px 20px' }}>
                      <span style={{ fontFamily: LABEL, fontSize: 8, color: '#f59e0b', marginRight: 12, fontWeight: 700 }}>ADOPTION TIMELINE</span>
                      <label style={{ fontFamily: LABEL, fontSize: 8, color: '#94a3b8', marginRight: 6 }}>Ramp start (mo from acq):</label>
                      <input type="number" value={adding.adoption.ramp_start} onChange={e => setAdding({ ...adding, adoption: { ...adding.adoption, ramp_start: e.target.value } })}
                        style={{ width: 44, background: '#0f172a', border: '1px solid #78350f', color: '#fcd34d', fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, marginRight: 10, textAlign: 'right' }} />
                      <label style={{ fontFamily: LABEL, fontSize: 8, color: '#94a3b8', marginRight: 6 }}>Ramp duration (mo):</label>
                      <input type="number" value={adding.adoption.ramp_duration} onChange={e => setAdding({ ...adding, adoption: { ...adding.adoption, ramp_duration: e.target.value } })}
                        style={{ width: 44, background: '#0f172a', border: '1px solid #78350f', color: '#fcd34d', fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, marginRight: 10, textAlign: 'right' }} />
                      <label style={{ fontFamily: LABEL, fontSize: 8, color: '#94a3b8', marginRight: 6 }}>Steady-state $/mo <span style={{ color: '#475569' }}>(blank=same as above)</span>:</label>
                      <input type="number" value={adding.adoption.steady_monthly} placeholder={adding.monthly || '$/mo'} onChange={e => setAdding({ ...adding, adoption: { ...adding.adoption, steady_monthly: e.target.value } })}
                        style={{ width: 60, background: '#0f172a', border: '1px solid #78350f', color: '#fcd34d', fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, marginRight: 10, textAlign: 'right' }} />
                      <label style={{ fontFamily: LABEL, fontSize: 8, color: '#94a3b8', marginRight: 6 }}>Probability (0–1):</label>
                      <input type="number" min={0} max={1} step={0.05} value={adding.adoption.probability} onChange={e => setAdding({ ...adding, adoption: { ...adding.adoption, probability: e.target.value } })}
                        style={{ width: 44, background: '#0f172a', border: '1px solid #78350f', color: '#fcd34d', fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, textAlign: 'right' }} />
                    </td>
                  </tr>
                )}
              </>
            )}
            {adding && adding.mode === 'per_unit' && (() => {
              const qN = parseFloat(adding.qty);
              const rN = parseFloat(adding.rate);
              const preview = Number.isFinite(qN) && Number.isFinite(rN) ? qN * rN : null;
              return (
                <>
                  <tr style={{ background: '#0a1a26' }}>
                    <td style={{ padding: '4px 8px' }}>
                      <input autoFocus value={adding.label} placeholder="e.g. Cable (200 units)"
                        onChange={e => setAdding({ ...adding, label: e.target.value })}
                        style={{ width: '100%', background: '#0f172a', border: '1px solid #22d3ee', color: '#e2e8f0', fontFamily: MONO, fontSize: 9, padding: '2px 4px', borderRadius: 2 }}
                      />
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                      <input type="number" value={adding.qty} placeholder="qty"
                        onChange={e => setAdding({ ...adding, qty: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') addLine(); if (e.key === 'Escape') setAdding(null); }}
                        style={{ width: 60, background: '#0f172a', border: '1px solid #22d3ee', color: '#22d3ee', fontFamily: MONO, fontSize: 9, padding: '2px 4px', textAlign: 'right', borderRadius: 2 }}
                      />
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                      <input type="number" value={adding.rate} placeholder="$/unit/mo"
                        onChange={e => setAdding({ ...adding, rate: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') addLine(); if (e.key === 'Escape') setAdding(null); }}
                        style={{ width: 70, background: '#0f172a', border: '1px solid #22d3ee', color: '#22d3ee', fontFamily: MONO, fontSize: 9, padding: '2px 4px', textAlign: 'right', borderRadius: 2 }}
                      />
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: '#475569', fontStyle: 'italic', fontSize: 8 }}>
                      {preview != null ? `= $${preview.toLocaleString()}/mo` : 'qty × rate'}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: '#22c55e', fontWeight: 700 }}>
                      {preview != null ? fmt$(preview * 12) : '—'}
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <button onClick={() => setAdding({ ...adding, adoption: { ...adding.adoption, enabled: !adding.adoption.enabled } })}
                        title="Toggle adoption / ramp-up timeline (Task #1147)"
                        style={{ fontFamily: LABEL, fontSize: 8, padding: '2px 5px', borderRadius: 2, cursor: 'pointer', border: adding.adoption.enabled ? '1px solid #f59e0b' : '1px solid #1e3a5f', background: adding.adoption.enabled ? '#1c1000' : '#0a1520', color: adding.adoption.enabled ? '#f59e0b' : '#475569' }}>
                        RAMP
                      </button>
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <button onClick={addLine} disabled={busy || !adding.label.trim() || !adding.qty || !adding.rate} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', fontSize: 11, marginRight: 4 }}>✓ Save</button>
                      <button onClick={() => setAdding(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11 }}>✕</button>
                    </td>
                  </tr>
                  {adding.adoption.enabled && (
                    <tr style={{ background: '#0c1c10' }}>
                      <td colSpan={7} style={{ padding: '4px 12px 6px 20px' }}>
                        <span style={{ fontFamily: LABEL, fontSize: 8, color: '#f59e0b', marginRight: 12, fontWeight: 700 }}>ADOPTION TIMELINE</span>
                        <label style={{ fontFamily: LABEL, fontSize: 8, color: '#94a3b8', marginRight: 6 }}>Ramp start (mo):</label>
                        <input type="number" value={adding.adoption.ramp_start} onChange={e => setAdding({ ...adding, adoption: { ...adding.adoption, ramp_start: e.target.value } })}
                          style={{ width: 44, background: '#0f172a', border: '1px solid #78350f', color: '#fcd34d', fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, marginRight: 10, textAlign: 'right' }} />
                        <label style={{ fontFamily: LABEL, fontSize: 8, color: '#94a3b8', marginRight: 6 }}>Ramp duration (mo):</label>
                        <input type="number" value={adding.adoption.ramp_duration} onChange={e => setAdding({ ...adding, adoption: { ...adding.adoption, ramp_duration: e.target.value } })}
                          style={{ width: 44, background: '#0f172a', border: '1px solid #78350f', color: '#fcd34d', fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, marginRight: 10, textAlign: 'right' }} />
                        <label style={{ fontFamily: LABEL, fontSize: 8, color: '#94a3b8', marginRight: 6 }}>Steady-state $/mo <span style={{ color: '#475569' }}>(blank=computed)</span>:</label>
                        <input type="number" value={adding.adoption.steady_monthly} placeholder={preview != null ? String(Math.round(preview)) : '$/mo'} onChange={e => setAdding({ ...adding, adoption: { ...adding.adoption, steady_monthly: e.target.value } })}
                          style={{ width: 60, background: '#0f172a', border: '1px solid #78350f', color: '#fcd34d', fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, marginRight: 10, textAlign: 'right' }} />
                        <label style={{ fontFamily: LABEL, fontSize: 8, color: '#94a3b8', marginRight: 6 }}>Probability (0–1):</label>
                        <input type="number" min={0} max={1} step={0.05} value={adding.adoption.probability} onChange={e => setAdding({ ...adding, adoption: { ...adding.adoption, probability: e.target.value } })}
                          style={{ width: 44, background: '#0f172a', border: '1px solid #78350f', color: '#fcd34d', fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, textAlign: 'right' }} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })()}
            {/* Totals row */}
            <tr style={{ background: '#0a1a26', borderTop: '1px solid #1e3a5f' }}>
              <td style={{ padding: '4px 8px', color: '#06b6d4', fontWeight: 700 }}>TOTAL</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#22d3ee', fontWeight: 600 }}>{cell(total.rent_roll, '#22d3ee')}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#94a3b8' }}>{cell(total.t12)}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#f59e0b' }}>{cell(total.om, '#f59e0b')}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#22c55e', fontWeight: 700 }}>{fmt$(grandTotal)}</td>
              <td style={{ padding: '4px 8px', color: '#334155', fontSize: 8 }}>
                {totalUnits > 0 ? `$${(grandTotal / totalUnits).toFixed(0)}/unit/yr` : ''}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      )}
      <div style={{ marginTop: 6, fontFamily: LABEL, fontSize: 8, color: '#334155' }}>
        Resolution priority per category: <span style={{ color: '#22d3ee' }}>Rent Roll</span> →{' '}
        <span style={{ color: '#f59e0b' }}>OM</span>. T-12 only publishes an aggregate (no per-category breakdown).
        Override + custom lines persist to deal_assumptions and flow into EGI / NOI.
      </div>
    </div>
  );
}

const COLLISION_COLOR: Record<string, string> = {
  severe:   '#ef4444',
  material: '#f59e0b',
  minor:    '#94a3b8',
};

interface DqaAlertShape {
  id: string;
  document_type: string;
  proforma_column: string;
  proforma_row: string;
  classification: string;
  severity: 'critical' | 'warning' | 'info';
  agent_finding: {
    reasoning: string;
    extracted_value?: string | number | null;
    expected_value?: string | number | null;
    recommended_action?: string;
    source_evidence?: { page?: number | null; section?: string | null; snippet?: string | null };
  };
  status: string;
}

function DataRow({ row, isEven, shade, corrections, setCorrections, totalUnits, egiResolved, activePeriod, onSaveCorrection, onResetCorrection, onToggleAncillary, ancillaryOpen, evidenceResolved, onRowClick, sigmaTier, stanceModulated, stanceTrace, dqaAlerts, onDqaClick, labelAdornment, overrideResolvedValue, sourceDoc, contextOverrideWidget }: {
  row: OperatingStatementRow;
  isEven: boolean;
  shade?: 'blue' | 'warm' | 'purple';
  corrections: CorrectionState;
  setCorrections: React.Dispatch<React.SetStateAction<CorrectionState>>;
  totalUnits: number;
  egiResolved: number | null;
  activePeriod: 'T12' | 'T6' | 'T3' | 'T1';
  onSaveCorrection: (field: string, value: number | null, original: number | null) => Promise<void>;
  onResetCorrection: (field: string) => Promise<void>;
  onToggleAncillary?: () => void;
  ancillaryOpen?: boolean;
  /** Resolved evidence metadata + canonical field_path for this row (null when no underwriting evidence exists) */
  evidenceResolved?: { meta: EvidenceFieldMeta; path: string } | null;
  /** Optional row-level click handler (e.g. concession drilldown). Label cell click dispatches evidence event instead. */
  onRowClick?: () => void;
  /** M36 Σ plausibility tier for this row — shown inline in the Resolved cell for 4 s after a correction is saved. */
  sigmaTier?: 'REALISTIC' | 'AGGRESSIVE' | 'HEROIC' | null;
  /** True when OperatorStance has modulated the forward assumption driving this row. */
  stanceModulated?: boolean;
  /** Human-readable trace of which stance rules fired. */
  stanceTrace?: string;
  /** Data Quality Agent alerts for this row (Task #691) */
  dqaAlerts?: DqaAlertShape[];
  /** Called when user clicks a DQA icon to open the detail drawer */
  onDqaClick?: (alert: DqaAlertShape) => void;
  /** Optional inline element rendered after the row label (e.g. ReconciliationChip for Other Income) */
  labelAdornment?: React.ReactNode;
  /**
   * When set, overrides the Resolved column display value with the engine-corrected number
   * (e.g. math_correction_report.hierarchical_resolutions resolved_value for Other Income).
   * Does not affect edit/save behaviour — only the display.
   */
  overrideResolvedValue?: number | null;
  /** Matched source document (from source_documents catalogue) for this row — null when none. */
  sourceDoc?: SourceDocument | null;
  /**
   * Optional OverrideInputCell widget for the underwriting assumption override layer.
   * Rendered in the FLAG + ACTIONS cell alongside the existing pencil/reset controls.
   * Calls POST /assumptions/:fieldPath/override (deal_context_fields), distinct from
   * the proforma PATCH /financials/override (per_year_overrides) pipeline.
   */
  contextOverrideWidget?: React.ReactNode;
}) {
  const viewMode          = useDealStore(s => s.viewMode);
  const platformColSource = useDealStore(s => s.platformColSource);
  const isBroker = viewMode === 'BROKER_VIEW';
  const isSubtotal = SUBTOTALS.has(row.field);
  const isDeviant = row.benchmarkPosition === 'above' || row.benchmarkPosition === 'below';
  const isPct = PCT_FIELDS.has(row.field);
  const isPerUnit = PER_UNIT_FIELDS.has(row.field);
  const isMgmtFee = row.field === 'management_fee';

  // Management fee can be edited as $ or % of EGI — default to % since it's conceptually a rate.
  const [mgmtFeeEditMode, setMgmtFeeEditMode] = useState<'$' | '%'>('%');

  // Hover state for clickable T-period cell.
  const [hoverT12, setHoverT12] = useState(false);
  // Optimistic Resolved overlay: set immediately on click so the Resolved column
  // updates without waiting for load() to return. undefined = no overlay (use server value).
  const [optimisticResolved, setOptimisticResolved] = useState<number | null | undefined>(undefined);

  const baseBg = shade === 'warm'
    ? (isEven ? '#1a1208' : '#160f06')
    : shade === 'purple'
      ? (isEven ? '#181328' : '#141021')
      : (isEven ? BT.bg.panelAlt : BT.bg.panel);

  const rowBg = isDeviant ? 'rgba(234,179,8,0.07)' : baseBg;
  const corr = corrections[row.field];

  // Active override: server-side source ('override') covers persisted overrides
  // across reloads; corr?.savedAt covers the optimistic in-session window before
  // the next load() response arrives.
  const hasActiveOverride = row.source === 'override' || corr?.savedAt != null;
  const t12Val = pickY1ColValue(row, activePeriod);
  /** True when the active-period cell's value is the active user override driving Resolved. */
  const isT12ActiveOverride = hasActiveOverride && t12Val != null && Math.abs((row.resolved ?? 0) - t12Val) < 0.01;
  /** True when the broker cell's value is the active user override driving Resolved. */
  const isBrokerActiveOverride = hasActiveOverride && row.broker != null && Math.abs((row.resolved ?? 0) - row.broker) < 0.01;

  function fmtDisplay(val: number | null): string {
    if (isPct) return fmtPct(val);
    if (isPerUnit) return val != null ? `$${val}/unit` : '—';
    return fmt$(val);
  }

  // Task #805: when the math engine has corrected the resolved value, use that as the
  // display baseline. Falls back to row.resolved when no override is supplied.
  const serverResolved = overrideResolvedValue !== undefined ? overrideResolvedValue : row.resolved;
  const resolvedVal = isBroker
    ? (row.broker ?? serverResolved)
    : (optimisticResolved !== undefined ? optimisticResolved : serverResolved);
  const egiPct = egiResolved && resolvedVal && !isPct && !isPerUnit
    ? (resolvedVal / egiResolved) * 100
    : null;

  const resolvedDisplay = fmtDisplay(resolvedVal);

  const resolvedColor = isBroker
    ? '#fcd34d'
    : isSubtotal
      ? '#22c55e'
      : row.field.includes('pct') || row.field.includes('loss') || row.field.includes('vacancy')
        ? '#fb923c'
        : '#e2e8f0';

  function commitEdit() {
    if (!corr) return;
    const parsed = parseFloat(corr.draft);
    if (isNaN(parsed)) { onSaveCorrection(row.field, null, corr.original); return; }
    // Management fee is stored as management_fee_pct (decimal %) not as dollars.
    // The override endpoint expects camelCase 'managementFeePct' with a decimal value (0.025 = 2.5%).
    if (isMgmtFee && egiResolved != null) {
      const pctDecimal = mgmtFeeEditMode === '%'
        ? parsed / 100          // user typed "2.5" → 0.025
        : parsed / egiResolved; // user typed dollar amount → back-calculate %
      // Use row.field ('management_fee') as the corrections state key — handleSaveCorrection
      // translates it to 'managementFeePct' for the API call internally.
      onSaveCorrection(row.field, pctDecimal, corr.original);
      return;
    }
    onSaveCorrection(row.field, parsed, corr.original);
  }

  return (
    <tr
      style={{ background: rowBg, borderBottom: `1px solid #161616`, cursor: onRowClick ? 'pointer' : undefined }}
      onClick={onRowClick}
    >
      {/* LINE ITEM — click label to open evidence panel (stops propagation so tr onClick doesn't fire) */}
      <td
        title="Click to view evidence for this assumption"
        onClick={(e) => {
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent('fe-evidence-click', {
            detail: { path: evidenceResolved?.path ?? row.field, label: row.label },
          }));
        }}
        style={{
          padding: '4px 8px', whiteSpace: 'nowrap',
          color: isSubtotal ? '#e2e8f0' : '#94a3b8',
          fontWeight: isSubtotal ? 700 : 400,
          fontFamily: 'Inter, sans-serif', fontSize: 9,
          position: 'sticky', left: 0, background: rowBg,
          paddingLeft: isSubtotal ? 8 : 16,
          cursor: 'pointer',
        }}
      >
        {onToggleAncillary ? (
          // Brighter chevron + inline hint so users can discover the
          // expansion (where + Add Line / + Per-Unit Line live). Previously
          // the chevron was the same color as the row text and easy to miss.
          <button
            onClick={e => { e.stopPropagation(); onToggleAncillary(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#06b6d4', fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 600 }}
            title="Click to expand — view per-source breakdown and add custom lines (Cable, Solar, etc.)"
          >
            {ancillaryOpen
              ? <ChevronDown size={11} color="#06b6d4" />
              : <ChevronRight size={11} color="#06b6d4" />}
            {row.label}
            {!ancillaryOpen && (
              <span style={{ marginLeft: 4, color: '#475569', fontSize: 8, fontWeight: 400, fontStyle: 'italic' }}>
                · click to add lines
              </span>
            )}
            {labelAdornment}
          </button>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            {row.label}
            {labelAdornment}
          </span>
        )}
      </td>

      {/* BROKER */}
      <td style={{
        padding: '4px 8px', textAlign: 'right', fontSize: 9,
        color: isBroker ? '#fcd34d' : '#f59e0b',
        fontWeight: isBroker ? 700 : 400,
        background: isBroker ? 'rgba(180,83,9,0.08)' : undefined,
      }}>{fmtDisplay(row.broker)}</td>

      {/* T-12 — hidden in BROKER VIEW; clickable to adopt value as Resolved override */}
      {!isBroker && (
        <td
          onMouseEnter={t12Val != null ? () => setHoverT12(true)  : undefined}
          onMouseLeave={t12Val != null ? () => setHoverT12(false) : undefined}
          onClick={t12Val != null ? async (e) => {
            e.stopPropagation();
            if (isT12ActiveOverride) {
              setOptimisticResolved(undefined);
              await onResetCorrection(row.field);
            } else {
              setOptimisticResolved(t12Val);
              const saveVal = isMgmtFee && egiResolved ? t12Val / egiResolved : t12Val;
              await onSaveCorrection(row.field, saveVal, row.resolved);
            }
          } : undefined}
          title={t12Val != null
            ? (isT12ActiveOverride
                ? 'Active — click again to revert to auto-resolution'
                : 'Click to use this T-12 value as the Resolved figure')
            : undefined}
          style={{
            padding: '4px 8px', textAlign: 'right', fontSize: 9,
            color: isT12ActiveOverride ? '#4ade80' : '#e2e8f0',
            cursor: t12Val != null ? 'pointer' : undefined,
            background: isT12ActiveOverride
              ? 'rgba(74,222,128,0.10)'
              : (hoverT12 && t12Val != null ? 'rgba(74,222,128,0.05)' : undefined),
            borderLeft:  isT12ActiveOverride ? '1px solid rgba(74,222,128,0.4)' : undefined,
            borderRight: isT12ActiveOverride ? '1px solid rgba(74,222,128,0.4)' : undefined,
          }}
        >
          {fmtDisplay(t12Val)}
        </td>
      )}

      {/* PLATFORM column — always T12/platform data, no cycling, static color */}
      {!isBroker && (
        <td
          style={{
            padding: '4px 8px', textAlign: 'right', fontSize: 9,
            color: '#06b6d4',
          }}
        >
          {fmtDisplay(pickPlatformValue(row, platformColSource))}
        </td>
      )}

      {/* RESOLVED (BUILD_OWN) / BROKER NOI (BROKER_VIEW) */}
      <td
        onClick={!isBroker && evidenceResolved ? (e) => {
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent('fe-evidence-click', {
            detail: { path: evidenceResolved.path, label: row.label },
          }));
        } : undefined}
        title={isBroker ? 'Broker OM value' : evidenceResolved ? 'Click to view evidence for this value' : 'Editable via pencil icon — overrides write back to server'}
        style={{
          padding: '4px 8px', textAlign: 'right',
          color: resolvedColor, fontWeight: isSubtotal ? 700 : 600,
          background: isBroker ? '#1c0f00' : '#0d1f2d',
          cursor: !isBroker && evidenceResolved ? 'pointer' : undefined,
          borderLeft: isBroker ? '1px solid #b45309' : '1px solid #0891b2',
          borderRight: isBroker ? '1px solid #b45309' : '1px solid #0891b2',
        }}
      >
        {!isBroker && corr?.editing ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            {isMgmtFee && (
              <button
                onMouseDown={e => {
                  e.preventDefault(); // prevent blur before toggle fires
                  const parsed = parseFloat(corr.draft);
                  if (!isNaN(parsed) && egiResolved) {
                    const newDraft = mgmtFeeEditMode === '%'
                      ? String(Math.round((parsed / 100) * egiResolved))
                      : ((parsed / egiResolved) * 100).toFixed(2);
                    setCorrections(prev => ({ ...prev, [row.field]: { ...prev[row.field], draft: newDraft } }));
                  }
                  setMgmtFeeEditMode(m => m === '$' ? '%' : '$');
                }}
                title={mgmtFeeEditMode === '%' ? 'Editing as % of EGI — click to switch to $' : 'Editing as $ amount — click to switch to %'}
                style={{
                  background: '#0f172a', border: '1px solid #0891b2', borderRadius: 2,
                  color: '#06b6d4', fontFamily: MONO, fontSize: 8, padding: '1px 3px',
                  cursor: 'pointer', lineHeight: 1, fontWeight: 700,
                }}
              >
                {mgmtFeeEditMode}
              </button>
            )}
            <input
              autoFocus
              value={corr.draft}
              placeholder="Enter to save"
              onChange={e => setCorrections(prev => ({ ...prev, [row.field]: { ...prev[row.field], draft: e.target.value } }))}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setCorrections(prev => ({ ...prev, [row.field]: { ...prev[row.field], editing: false } }));
              }}
              style={{
                width: isMgmtFee ? 56 : 80, background: '#0f172a', border: '1px solid #06b6d4', color: '#f8fafc',
                fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, textAlign: 'right',
              }}
            />
            <button
              title="Save"
              onMouseDown={e => { e.preventDefault(); commitEdit(); }}
              style={{
                background: '#0f2d1a', border: '1px solid #16a34a', borderRadius: 2,
                color: '#4ade80', fontFamily: MONO, fontSize: 9, padding: '1px 4px',
                cursor: 'pointer', lineHeight: 1, fontWeight: 700,
              }}
            >✓</button>
          </div>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span
              title={corr?.savedAt ? `Overridden at ${new Date(corr.savedAt).toLocaleTimeString()}` : undefined}
              style={{ borderBottom: corr?.savedAt ? '1px dotted #f59e0b' : undefined }}
            >
              {resolvedDisplay}
              {!isBroker && corr?.savedAt && <span style={{ marginLeft: 4, color: '#f59e0b', fontSize: 8 }}>✎</span>}
            </span>
            {sigmaTier && (() => {
              const tc = sigmaTier === 'REALISTIC' ? '#22c55e' : sigmaTier === 'AGGRESSIVE' ? '#f59e0b' : '#ef4444';
              const bg = sigmaTier === 'REALISTIC' ? '#0a1c10' : sigmaTier === 'AGGRESSIVE' ? '#1a1200' : '#1c0a0a';
              return (
                <span title={`M36 Σ plausibility: ${sigmaTier}`} style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '1px 4px', borderRadius: 2,
                  background: bg, border: `1px solid ${tc}33`,
                  fontFamily: 'monospace', fontSize: 7, color: tc, fontWeight: 700, letterSpacing: 0.4,
                }}>Σ {sigmaTier.charAt(0) + sigmaTier.slice(1).toLowerCase()}</span>
              );
            })()}
          </span>
        )}
      </td>

      {/* % of EGI */}
      <td style={{ padding: '4px 8px', textAlign: 'right', color: '#475569', fontSize: 9 }}>
        {egiPct != null ? `${egiPct.toFixed(1)}%` : '—'}
      </td>

      {/* SOURCE BADGE — shows financials-API source + evidence tier badge when underwriting evidence exists */}
      <td
        onClick={evidenceResolved ? (e) => {
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent('fe-evidence-click', {
            detail: { path: evidenceResolved.path, label: row.label },
          }));
        } : undefined}
        title={evidenceResolved
          ? `${TIER_TOOLTIP[evidenceResolved.meta.tier] ?? 'Underwriting evidence'} · Click to open evidence panel`
          : undefined}
        style={{
          padding: '4px 8px',
          cursor: evidenceResolved ? 'pointer' : undefined,
          display: 'table-cell',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <SourceBadge source={row.source} />
          <SourceDocPill doc={sourceDoc ?? null} />
          {evidenceResolved && (
            <span
              title={TIER_TOOLTIP[evidenceResolved.meta.tier]}
              style={{
                display: 'inline-block',
                fontFamily: MONO, fontSize: 7, fontWeight: 700,
                letterSpacing: 0.3,
                color: TIER_BADGE_COLOR[evidenceResolved.meta.tier] ?? '#64748b',
                border: `1px solid ${TIER_BADGE_COLOR[evidenceResolved.meta.tier] ?? '#64748b'}`,
                borderRadius: 2,
                padding: '0px 3px',
                lineHeight: '12px',
              }}
            >
              {TIER_LABEL[evidenceResolved.meta.tier] ?? '?'}
            </span>
          )}
        </div>
      </td>

      {/* $/UNIT */}
      <td style={{ padding: '4px 8px', textAlign: 'right', color: '#475569', fontSize: 9 }}>
        {row.perUnit != null ? `$${row.perUnit.toLocaleString()}` : '—'}
      </td>

      {/* FLAG + ACTIONS */}
      <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* DQA icons — one per finding, most severe first */}
          {dqaAlerts && dqaAlerts.length > 0 && dqaAlerts.slice(0, 2).map(a => (
            <button
              key={a.id}
              title={`${a.classification} · ${a.agent_finding.reasoning?.slice(0, 120) ?? ''}${a.agent_finding.reasoning?.length > 120 ? '…' : ''} · Click for detail`}
              onClick={() => onDqaClick?.(a)}
              style={{
                background: 'none', border: 'none', padding: '1px 2px', cursor: 'pointer',
                color: a.severity === 'critical' ? '#ef4444' : a.severity === 'warning' ? '#f59e0b' : '#64748b',
                display: 'inline-flex', alignItems: 'center',
              }}
            >
              <ShieldAlert size={9} />
            </button>
          ))}
          {evidenceResolved?.meta.has_collision && (
            <span
              title={`Collision · Agent vs Broker OM${evidenceResolved.meta.collision_magnitude ? ` (${evidenceResolved.meta.collision_magnitude})` : ''} · Click badge to see detail`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 8, fontFamily: LABEL, letterSpacing: 0.3,
                color: COLLISION_COLOR[evidenceResolved.meta.collision_magnitude ?? 'minor'] ?? '#94a3b8',
              }}
            >
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: COLLISION_COLOR[evidenceResolved.meta.collision_magnitude ?? 'minor'] ?? '#94a3b8',
                flexShrink: 0,
              }} />
              {(evidenceResolved.meta.collision_magnitude ?? 'minor').toUpperCase()}
            </span>
          )}
          {stanceModulated && (
            <span
              title={stanceTrace ?? 'Forward assumption adjusted by OperatorStance'}
              style={{ color: '#f59e0b', fontSize: 9, lineHeight: 1, cursor: 'help', flexShrink: 0 }}
            >●</span>
          )}
          {isDeviant && (
            <span title={`${row.benchmarkPosition === 'above' ? 'Above' : 'Below'} platform benchmark`}
              style={{ fontSize: 8, color: '#f59e0b', letterSpacing: 0.3, fontFamily: LABEL }}>
              ⚠ {row.benchmarkPosition?.toUpperCase()}
            </span>
          )}
          <button
            title="Override value"
            onClick={() => setCorrections(prev => ({
              ...prev,
              [row.field]: prev[row.field]?.editing
                ? prev[row.field]
                : {
                    editing: true,
                    original: row.resolved,
                    draft: isMgmtFee && mgmtFeeEditMode === '%' && row.resolved != null && egiResolved != null
                      ? ((row.resolved / egiResolved) * 100).toFixed(2)
                      : String(row.resolved ?? ''),
                  },
            }))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: '1px 2px' }}
          >
            <Pencil size={9} />
          </button>
          {corr?.savedAt && (
            <button
              title="Reset to ingested value (clears backend override)"
              onClick={() => onResetCorrection(row.field)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', padding: '1px 2px' }}
            >
              <RotateCcw size={9} />
            </button>
          )}
          {contextOverrideWidget}
        </div>
      </td>
    </tr>
  );
}


function NoisBridge({ egiRow, ctrlOpex, nctrlOpex, noi, totalUnits, capRate }: {
  egiRow: OperatingStatementRow | undefined;
  ctrlOpex: number;
  nctrlOpex: number;
  noi: number;
  totalUnits: number;
  capRate: number | null;
}) {
  const impliedValue = capRate && noi ? noi / capRate : null;
  return (
    <div style={{ padding: '16px 24px', borderTop: '1px solid #1e1e1e', background: '#080808' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', fontFamily: MONO }}>
        <div style={{ fontSize: 8, color: '#334155', textAlign: 'center', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
          At-Acquisition NOI Bridge · Year 1 AS-IS
        </div>
        {[
          { label: 'EFFECTIVE GROSS INCOME', value: fmt$(egiRow?.resolved ?? null), color: '#22c55e', bold: true, border: true },
          { label: '  Less: Controllable OpEx', value: `(${fmt$(ctrlOpex)})`, color: '#fb923c', border: false },
          { label: '  Less: Non-Controllable OpEx', value: `(${fmt$(nctrlOpex)})`, color: '#c084fc', border: false },
          { label: 'NET OPERATING INCOME', value: fmt$(noi), color: '#4ade80', bold: true, border: true, big: true },
        ].map(row => (
          <div key={row.label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: row.big ? '10px 0' : '5px 0',
            borderBottom: row.border ? '1px solid #1e1e1e' : undefined,
          }}>
            <span style={{ fontFamily: 'Inter, sans-serif', color: '#64748b', fontSize: row.bold ? 11 : 10, fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
            <span style={{ color: row.color, fontSize: row.big ? 16 : 11, fontWeight: row.big ? 700 : (row.bold ? 600 : 400) }}>{row.value}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#334155', marginTop: 6 }}>
          <span>NOI per unit: {totalUnits > 0 ? `$${Math.round(noi / totalUnits).toLocaleString()}` : '—'}</span>
          {capRate && <span>@ {(capRate * 100).toFixed(2)}% cap: {impliedValue ? fmt$(Math.round(impliedValue)) : '—'}</span>}
        </div>
      </div>
    </div>
  );
}

function CapitalStackPanel({ dealId, capitalStack, purchasePriceFallback, capRate, noi, totalUnits }: {
  dealId: string;
  capitalStack: DealCapitalStack;
  purchasePriceFallback: number | null;
  capRate: number | null;
  noi: number | null;
  totalUnits: number;
}) {
  const pp = capitalStack.purchasePrice ?? purchasePriceFallback;
  const loan = capitalStack.loanAmount;
  const equity = capitalStack.equityAtClose ?? (pp != null && loan != null ? pp - loan : null);
  const impliedCapRate = pp && noi && pp > 0 ? noi / pp : null;
  const ppPerUnit = capitalStack.pricePerUnit ?? (pp && totalUnits > 0 ? Math.round(pp / totalUnits) : null);
  const ltc = capitalStack.ltcPct;

  return (
    <div style={{ padding: '16px 24px 24px', borderTop: '1px solid #1e1e1e', background: '#08080e' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ fontSize: 8, color: '#334155', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, fontFamily: MONO }}>
          Capital Stack at Close
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          {[
            { l: 'Purchase Price',   v: fmt$(pp),                                              c: '#f8fafc' },
            { l: 'Price / Unit',     v: ppPerUnit ? `$${ppPerUnit.toLocaleString()}` : '—',   c: '#94a3b8' },
            { l: 'Implied Cap',      v: impliedCapRate ? `${(impliedCapRate * 100).toFixed(2)}%` : '—', c: '#06b6d4' },
            { l: 'Broker Cap Rate',  v: capRate ? `${(capRate * 100).toFixed(2)}%` : '—',     c: '#f59e0b' },
            { l: 'Loan Amount',      v: fmt$(loan),                                            c: '#60a5fa' },
            { l: 'Equity at Close',  v: fmt$(equity),                                         c: '#c084fc' },
            { l: 'LTC',              v: ltc != null ? `${(ltc * 100).toFixed(1)}%` : '—',    c: '#94a3b8' },
            { l: 'NOI (AS-IS)',      v: fmt$(noi),                                             c: '#4ade80' },
          ].map(k => (
            <div key={k.l} style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', padding: '8px 10px', borderRadius: 2 }}>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 8, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k.l}</div>
              <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Debt terms row */}
        {(capitalStack.interestRate != null || capitalStack.ioPeriodMonths != null || capitalStack.amortizationYears != null || capitalStack.dscrMin != null || capitalStack.originationFeePct != null) && (
          <div style={{ display: 'flex', gap: 16, padding: '8px 10px', background: '#0d0d17', border: '1px solid #1e2a3a', borderRadius: 2, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: MONO, fontSize: 8, color: '#334155', letterSpacing: 1, textTransform: 'uppercase', alignSelf: 'center' }}>Debt Terms:</span>
            {[
              { l: 'Rate',      v: capitalStack.interestRate != null ? `${(capitalStack.interestRate * 100).toFixed(2)}%` : null },
              { l: 'I/O',       v: capitalStack.ioPeriodMonths != null ? `${capitalStack.ioPeriodMonths}mo` : null },
              { l: 'Amort',     v: capitalStack.amortizationYears != null ? `${capitalStack.amortizationYears}yr` : null },
              { l: 'Min DSCR',  v: capitalStack.dscrMin != null ? capitalStack.dscrMin.toFixed(2) : null },
              { l: 'Orig Fee',  v: capitalStack.originationFeePct != null ? `${(capitalStack.originationFeePct * 100).toFixed(2)}%` : null },
            ].filter(x => x.v != null).map(x => (
              <div key={x.l} style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                <span style={{ fontFamily: LABEL, fontSize: 8, color: '#64748b' }}>{x.l}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: '#93c5fd' }}>{x.v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>

  );
}

export default ProFormaSummaryTab;
