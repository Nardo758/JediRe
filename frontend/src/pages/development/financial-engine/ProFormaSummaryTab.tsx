import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Pencil, RotateCcw, RefreshCw, Loader2, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { apiClient } from '../../../services/api.client';
import type { FinancialEngineTabProps, EvidenceFieldMeta } from './types';
import { CommentaryPanel } from './CommentaryPanel';

const MONO = BT.font.mono;
const LABEL = BT.font.label;

// ─── API types (mirrors backend DealFinancials contract) ──────────────────────
interface OperatingStatementRow {
  field: string;
  label: string;
  broker: number | null;
  platform: number | null;
  t12: number | null;
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
  }>;
}

// ─── Sections layout ──────────────────────────────────────────────────────────
// Field names mirror Projections REVENUE block (dollar values, not rates).
const REVENUE_FIELDS = new Set([
  'gpr', 'vacancy_loss', 'loss_to_lease', 'concessions',
  'bad_debt', 'non_revenue_units', 'net_rental_income',
  'other_income', 'egi',
]);
const CTRL_OPEX_FIELDS = new Set([
  'payroll', 'repairs_maintenance', 'turnover', 'contract_services',
  'marketing', 'utilities', 'g_and_a',
]);
const NCTRL_OPEX_FIELDS = new Set([
  'management_fee', 'insurance', 'real_estate_taxes', 'replacement_reserves', 'total_opex',
]);
const SUBTOTALS = new Set(['gpr', 'net_rental_income', 'egi', 'total_opex', 'noi']);
const PCT_FIELDS = new Set<string>();
const PER_UNIT_FIELDS = new Set<string>();

// ─── Formatting ───────────────────────────────────────────────────────────────
function fmt$(n: number | null): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${n.toLocaleString()}`;
  return `$${n}`;
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

// ─── Source badge ─────────────────────────────────────────────────────────────
const SOURCE_META: Record<string, { label: string; color: string; bg: string }> = {
  t12:              { label: 'T-12',           color: '#f8fafc', bg: '#334155' },
  rent_roll:        { label: 'Rent Roll',       color: '#f8fafc', bg: '#1e3a5f' },
  extraction_rent_roll: { label: 'Rent Roll', color: '#f8fafc', bg: '#1e3a5f' },
  extraction_om:    { label: 'OM Narrative',    color: '#f59e0b', bg: '#292101' },
  tax_bill:         { label: 'County Assessor', color: '#06b6d4', bg: '#083344' },
  om:               { label: 'OM Narrative',    color: '#f59e0b', bg: '#292101' },
  broker:           { label: 'OM Narrative',    color: '#f59e0b', bg: '#292101' },
  platform:         { label: 'Platform',        color: '#60a5fa', bg: '#1e3a5f' },
  platform_fallback:{ label: 'Platform',        color: '#60a5fa', bg: '#1e3a5f' },
  override:         { label: 'Override',        color: '#c084fc', bg: '#2e1065' },
  box_score:        { label: 'Box Score',       color: '#86efac', bg: '#14532d' },
  computed:         { label: 'Computed',        color: '#94a3b8', bg: '#1e293b' },
  unit_mix:         { label: 'Unit Mix',        color: '#22d3ee', bg: '#083344' },
  capsule:          { label: 'Capsule',         color: '#a78bfa', bg: '#1e1b4b' },
  synthesized:      { label: 'Synthesized',     color: '#94a3b8', bg: '#1e293b' },
};

function SourceBadge({ source }: { source: string | null }) {
  const meta = source ? (SOURCE_META[source] ?? null) : null;
  if (!meta) {
    return (
      <span style={{
        display: 'inline-block', padding: '1px 5px', borderRadius: 2,
        fontFamily: MONO, fontSize: 8, letterSpacing: 0.3,
        color: '#475569', background: '#1e293b',
      }}>Not Provided</span>
    );
  }
  return (
    <span style={{
      display: 'inline-block', padding: '1px 5px', borderRadius: 2,
      fontFamily: MONO, fontSize: 8, letterSpacing: 0.3,
      color: meta.color, background: meta.bg,
    }}>{meta.label}</span>
  );
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
      s === 'calibration' || s === 'estimate' || s === 'user') return 2;
  if (s === 'bls' || s === 'costar'  || s === 'public'  ||
      s === 'research' || s === 'market' ||
      s === 'agent'   || s === 'capsule') return 3;
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

export function ProFormaSummaryTab({ dealId, deal, modelResults, onIntegrityChange, evidenceFilter, evidenceFieldMap, collisionFields, severeCollisionFields, materialCollisionFields, minorCollisionFields, onF9Refresh }: FinancialEngineTabProps) {
  const [data, setData] = useState<DealFinancials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reparsing, setReparsing] = useState(false);
  const [corrections, setCorrections] = useState<CorrectionState>({});
  const [showAncillary, setShowAncillary] = useState(false);

  // Prefer model results from the build pipeline; fall back to composer fetch.
  const modelData = modelResults ?? null;

  const load = useCallback(async () => {
    // Always fetch the composer financials — this populates data.proforma.year1
    // (the T12 operating statement) which is the primary render source for this
    // tab. modelResults is used separately for KPI overlays and must NOT gate
    // this fetch; skipping it left data=null and rendered a blank screen when a
    // saved model was already loaded on mount (from /financial-model/:id/latest).
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: DealFinancials; message?: string }>(`/api/v1/deals/${dealId}/financials`);
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
  }, [dealId, onIntegrityChange, onF9Refresh]);

  useEffect(() => { load(); }, [load]);

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
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, {
        field,
        year: null,
        value,
      });
      setCorrections(prev => ({
        ...prev,
        [field]: { ...prev[field], editing: false, savedAt: new Date().toISOString(), original },
      }));
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

  // Clears a user override on the backend (value: null = revert to ingested)
  const handleResetCorrection = useCallback(async (field: string) => {
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, {
        field,
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

  const rows = data.proforma.year1;
  const checks = data.proforma.integrityChecks;
  const totalUnits = data.totalUnits;

  // Apply evidence summary-bar filter when a pill is active
  const displayRows = evidenceFilter ? applyEvidenceFilter(rows, evidenceFilter, evidenceFieldMap, collisionFields, severeCollisionFields, materialCollisionFields, minorCollisionFields) : rows;

  const byField: Record<string, OperatingStatementRow> = {};
  rows.forEach(r => { byField[r.field] = r; });

  const revRows  = displayRows.filter(r => REVENUE_FIELDS.has(r.field) && !SUBTOTALS.has(r.field));
  const ctrlRows = displayRows.filter(r => CTRL_OPEX_FIELDS.has(r.field));
  const nctrlRows = displayRows.filter(r => NCTRL_OPEX_FIELDS.has(r.field) && !SUBTOTALS.has(r.field));
  const noiRow   = rows.find(r => r.field === 'noi');

  const egiRow       = byField['egi'];
  const totalOpexRow = byField['total_opex'];
  const ctrlSubtotalRow  = { resolved: ctrlRows.reduce((s, r) => s + (r.resolved ?? 0), 0) };
  const nctrlSubtotalRow = { resolved: nctrlRows.filter(r => r.field !== 'total_opex').reduce((s, r) => s + (r.resolved ?? 0), 0) };

  const egiResolved = egiRow?.resolved ?? null;

  const warnChecks = checks.filter(c => c.status !== 'ok');

  // Purchase price from deal prop — use bracket access to avoid any cast
  const purchasePrice: number | null =
    (deal?.['purchase_price'] as number | null) ??
    (deal?.['asking_price'] as number | null) ??
    (deal?.['deal_data'] as Record<string, unknown> | null)?.['purchase_price'] as number | null ??
    null;

  const capRate = data.assumptions.exitCap;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#0a0a0a', color: '#e2e8f0', fontFamily: LABEL }}>

      {/* ── Header bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', height: 40, flexShrink: 0,
        background: '#111111', borderBottom: '1px solid #1e1e1e',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#f8fafc', background: '#27272a', padding: '2px 6px', borderRadius: 2, letterSpacing: 1 }}>
            AS-IS · BROKER LAYER
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: '#f8fafc' }}>{data.dealName}</span>
          {totalUnits > 0 && (
            <span style={{ fontFamily: LABEL, fontSize: 9, color: '#64748b' }}>{totalUnits} Units</span>
          )}
          <span style={{ fontFamily: LABEL, fontSize: 9, color: '#475569' }}>At-Acquisition Snapshot</span>
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
            { l: 'NOI', v: fmt$(noiRow?.resolved ?? null) },
            { l: 'NOI/Unit', v: noiRow?.resolved && totalUnits ? `$${Math.round(noiRow.resolved / totalUnits).toLocaleString()}` : '—' },
          ].map(k => (
            <div key={k.l} style={{ display: 'flex', alignItems: 'baseline', gap: 4, padding: '2px 8px', borderRadius: 2, border: '1px solid #27272a', background: '#111827' }}>
              <span style={{ fontFamily: LABEL, fontSize: 9, color: '#64748b' }}>{k.l}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: '#e2e8f0' }}>{k.v}</span>
            </div>
          ))}
        </div>

        {/* Model-computed KPIs (when available from build pipeline) */}
        {modelData && (() => {
          const s = modelData.summary;
          if (!s) return null;
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 10px',
              borderLeft: '3px solid #0891b2',
              background: '#062a3a',
              borderRadius: 2,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#0891b2', letterSpacing: 0.5 }}>
                MODEL
              </span>
              {[
                { l: 'IRR', v: s.irr != null ? `${(s.irr * 100).toFixed(2)}%` : '—' },
                { l: 'EM', v: s.equityMultiple != null ? s.equityMultiple.toFixed(2) + 'x' : '—' },
                { l: 'Avg CoC', v: s.avgCoC != null ? `${(s.avgCoC * 100).toFixed(2)}%` : '—' },
                { l: 'DSCR Y1', v: s.dscrByYear?.[0] != null ? s.dscrByYear[0].toFixed(2) + 'x' : '—' },
                { l: 'Exit Cap', v: s.exitCapRate != null ? `${(s.exitCapRate * 100).toFixed(2)}%` : '—' },
                { l: 'Going-In Cap', v: s.goingInCapRate != null ? `${(s.goingInCapRate * 100).toFixed(2)}%` : '—' },
                { l: 'NOI Y1', v: s.noiYear1 != null ? fmt$(s.noiYear1) : '—' },
              ].map(k => (
                <div key={k.l} style={{ display: 'flex', alignItems: 'baseline', gap: 4, padding: '2px 6px', borderRadius: 2, border: '1px solid #0e7490', background: '#0c2233' }}>
                  <span style={{ fontFamily: LABEL, fontSize: 8, color: '#5eead4' }}>{k.l}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#e2e8f0' }}>{k.v}</span>
                </div>
              ))}
            </div>
          );
        })()}

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

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>

        {/* ── VALUATION SNAPSHOT STRIP ── */}
        {data.proforma.valuationSnapshot && (
          <ValuationSnapshotStrip vs={data.proforma.valuationSnapshot} />
        )}

        {/* ── SECTION B — T-12 Operating Statement ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 10 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ background: '#111111', borderBottom: '1px solid #2d2d2d' }}>
              <Th label="Line Item" left min={180} sticky />
              <Th label="Broker" color="#f59e0b" />
              <Th label="T-12" color="#e2e8f0" />
              <Th label="Platform" color="#06b6d4" />
              <Th label="Resolved" highlight />
              <Th label="% of EGI" color="#94a3b8" />
              <Th label="Source" />
              <Th label="$/Unit" />
              <Th label="Flag" />
            </tr>
          </thead>
          <tbody>
            {/* ── REVENUE ── */}
            <SectionHeader label="Revenue" accentColor="#06b6d4" bg="#051a24" />
            {revRows.map((r, i) => (
              <React.Fragment key={r.field}>
                <DataRow row={r} isEven={i % 2 === 0} shade="blue"
                  corrections={corrections} setCorrections={setCorrections}
                  totalUnits={totalUnits} egiResolved={egiResolved}
                  onSaveCorrection={handleSaveCorrection}
                  onResetCorrection={handleResetCorrection}
                  onToggleAncillary={r.field === 'other_income' ? () => setShowAncillary(v => !v) : undefined}
                  ancillaryOpen={r.field === 'other_income' ? showAncillary : undefined}
                  evidenceResolved={resolveEvidence(r.field, evidenceFieldMap)}
                />
                {r.field === 'other_income' && showAncillary && (
                  <tr>
                    <td colSpan={9} style={{ background: '#050d12', padding: 0, borderBottom: '1px solid #0e2030' }}>
                      <AncillaryExpansionPanel
                        totalUnits={totalUnits}
                        dealId={dealId}
                        breakdown={data?.otherIncomeBreakdown ?? null}
                        userLines={data?.otherIncomeUserLines ?? []}
                        onChange={load}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}

            {/* ── EGI SUBTOTAL ── */}
            {egiRow && <SubtotalRow label="EGI" row={egiRow} color="#0f172a" textColor="#22c55e" egiResolved={egiResolved} />}

            {/* ── CONTROLLABLE EXPENSES ── */}
            <SectionHeader label="Controllable Expenses" accentColor="#f59e0b" bg="#1a110a" />
            {ctrlRows.map((r, i) => (
              <DataRow key={r.field} row={r} isEven={i % 2 === 0} shade="warm"
                corrections={corrections} setCorrections={setCorrections}
                totalUnits={totalUnits} egiResolved={egiResolved}
                onSaveCorrection={handleSaveCorrection}
                onResetCorrection={handleResetCorrection}
                evidenceResolved={resolveEvidence(r.field, evidenceFieldMap)} />
            ))}
            <tr style={{ background: '#1a110a' }}>
              <td style={{ padding: '4px 8px', color: '#fb923c', fontWeight: 700, fontFamily: LABEL, fontSize: 9, paddingLeft: 12 }}>─── CONTROLLABLE OPEX ───</td>
              <td /><td /><td />
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#fb923c', fontWeight: 700 }}>
                {fmt$(ctrlSubtotalRow.resolved || null)}
              </td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#475569', fontSize: 9 }}>
                {egiResolved && ctrlSubtotalRow.resolved ? `${((ctrlSubtotalRow.resolved / egiResolved) * 100).toFixed(1)}%` : '—'}
              </td>
              <td colSpan={3} />
            </tr>

            {/* ── NON-CONTROLLABLE EXPENSES ── */}
            <SectionHeader label="Non-Controllable Expenses" accentColor="#a855f7" bg="#0d0a14" />
            {nctrlRows.map((r, i) => (
              <DataRow key={r.field} row={r} isEven={i % 2 === 0} shade="purple"
                corrections={corrections} setCorrections={setCorrections}
                totalUnits={totalUnits} egiResolved={egiResolved}
                onSaveCorrection={handleSaveCorrection}
                onResetCorrection={handleResetCorrection}
                evidenceResolved={resolveEvidence(r.field, evidenceFieldMap)} />
            ))}

            {/* ── TOTAL OPEX ── */}
            {totalOpexRow && (
              <tr style={{ background: '#1e1b4b', borderTop: '1px solid #312e81', borderBottom: '1px solid #312e81' }}>
                <td style={{ padding: '5px 8px', fontWeight: 700, color: '#e2e8f0', fontFamily: LABEL, fontSize: 9, position: 'sticky', left: 0, background: '#1e1b4b' }}>═══ TOTAL OPEX ═══</td>
                <td /><td /><td />
                <td style={{ padding: '5px 8px', textAlign: 'right', color: '#ffffff', fontWeight: 700, fontSize: 11 }}>
                  {fmt$(totalOpexRow.resolved)}
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

            {/* ── NOI ── */}
            {noiRow && (
              <tr style={{ background: '#042304', borderTop: '2px solid #166534', borderBottom: '2px solid #166534' }}>
                <td style={{ padding: '7px 8px', fontWeight: 700, color: '#f8fafc', fontFamily: LABEL, letterSpacing: 1, position: 'sticky', left: 0, background: '#042304' }}>
                  ═══ NET OPERATING INCOME ═══
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#86efac' }}>{fmt$(noiRow.broker)}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#86efac' }}>{fmt$(noiRow.t12)}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#86efac' }}>{fmt$(noiRow.platform)}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#4ade80', fontWeight: 700, fontSize: 13 }}>
                  {fmt$(noiRow.resolved)}
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#86efac', fontSize: 9 }}>
                  {egiResolved && noiRow.resolved ? `${((noiRow.resolved / egiResolved) * 100).toFixed(1)}%` : '—'}
                </td>
                <td style={{ padding: '7px 8px' }}><SourceBadge source={noiRow.source} /></td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#86efac', fontSize: 9 }}>
                  {noiRow.perUnit != null ? `$${noiRow.perUnit.toLocaleString()}/unit` : '—'}
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>

        {/* ── SECTION C — NOI Bridge ── */}
        {noiRow?.resolved && (
          <NoisBridge egiRow={egiRow} ctrlOpex={ctrlSubtotalRow.resolved} nctrlOpex={nctrlSubtotalRow.resolved} noi={noiRow.resolved} totalUnits={totalUnits} capRate={capRate} />
        )}

        {/* ── SECTION C — Capital Stack at Close ── */}
        <CapitalStackPanel
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
        padding: '4px 12px', borderTop: '1px solid #1e1e1e', background: '#111111',
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
      background: '#0a0a0a',
    }}>
      <div style={{
        padding: '5px 12px 4px',
        background: '#0a0a0a',
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

function Th({ label, color, highlight, left, min, sticky }: {
  label: string; color?: string; highlight?: boolean; left?: boolean; min?: number; sticky?: boolean;
}) {
  return (
    <th style={{
      padding: '5px 8px', textAlign: left ? 'left' : 'right',
      color: highlight ? '#e2e8f0' : (color ?? '#64748b'),
      fontWeight: 700, fontSize: 9, letterSpacing: 0.5,
      minWidth: min, whiteSpace: 'nowrap',
      position: sticky ? 'sticky' : undefined, left: sticky ? 0 : undefined,
      background: '#111111', borderBottom: '1px solid #2d2d2d',
      fontFamily: 'Inter, sans-serif',
      ...(highlight ? { borderBottom: '2px solid #06b6d4', background: '#0d1f2d' } : {}),
    }}>{label}</th>
  );
}

function SectionHeader({ label, accentColor, bg }: { label: string; accentColor: string; bg: string }) {
  return (
    <tr>
      <td colSpan={9} style={{
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

function SubtotalRow({ label, row, color, textColor, egiResolved }: {
  label: string; row: OperatingStatementRow; color: string; textColor: string; egiResolved: number | null;
}) {
  const egiPct = egiResolved && row.resolved ? (row.resolved / egiResolved) * 100 : null;
  return (
    <tr style={{ background: color }}>
      <td style={{ padding: '4px 8px', fontWeight: 700, color: '#cbd5e1', fontFamily: 'Inter, sans-serif', fontSize: 9, position: 'sticky', left: 0, background: color }}>
        ─── {label} ───
      </td>
      <td style={{ padding: '4px 8px', textAlign: 'right', color: textColor, fontSize: 9 }}>{fmt$(row.broker)}</td>
      <td style={{ padding: '4px 8px', textAlign: 'right', color: textColor, fontSize: 9 }}>{fmt$(row.t12)}</td>
      <td style={{ padding: '4px 8px', textAlign: 'right', color: textColor, fontSize: 9 }}>{fmt$(row.platform)}</td>
      <td style={{ padding: '4px 8px', textAlign: 'right', color: textColor, fontWeight: 700, background: 'rgba(0,0,0,0.3)' }}>
        {fmt$(row.resolved)}
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
  platform_fallback: { label: '—', color: '#475569' },
  unseeded: { label: '—', color: '#475569' },
};

function AncillaryExpansionPanel({ totalUnits, dealId, breakdown, userLines, onChange }: {
  totalUnits: number;
  dealId: string;
  breakdown: DealFinancials['otherIncomeBreakdown'];
  userLines: NonNullable<DealFinancials['otherIncomeUserLines']>;
  onChange: () => Promise<void> | void;
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
    | { mode: 'flat'; label: string; monthly: string }
    | { mode: 'per_unit'; label: string; qty: string; rate: string }
    | null
  >(null);
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

  const addLine = async () => {
    if (!adding || !adding.label.trim()) return;
    let body: Record<string, unknown> | null = null;
    if (adding.mode === 'flat') {
      const monthly = parseFloat(adding.monthly);
      if (!Number.isFinite(monthly) || monthly < 0) {
        setAddError('Monthly must be a non-negative number');
        return;
      }
      body = { label: adding.label.trim(), monthly };
    } else {
      const qty = parseFloat(adding.qty);
      const rate = parseFloat(adding.rate);
      if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(rate) || rate < 0) {
        setAddError('Qty and rate must both be non-negative numbers');
        return;
      }
      // Server derives `monthly = qty * rate` and persists all three fields.
      body = { label: adding.label.trim(), qty, rate, frequency: 'monthly' };
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
    patch: { label?: string; monthly?: number; qty?: number; rate?: number; frequency?: 'monthly' | 'annual' }
  ) => {
    setBusy(true);
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/other-income/user-lines/${id}`, patch);
      await onChange();
    } catch (e) { console.error('Update line failed:', e); }
    finally { setBusy(false); setEditing(null); }
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
          <button onClick={() => setAdding({ mode: 'flat', label: '', monthly: '' })} disabled={busy || !!adding}
            title="Add a line as a single $/month total"
            style={{ fontFamily: LABEL, fontSize: 9, color: '#06b6d4', background: '#062a3a', border: '1px solid #0891b2', padding: '3px 10px', borderRadius: 2, cursor: 'pointer' }}>
            + Flat $/mo
          </button>
          <button onClick={() => setAdding({ mode: 'per_unit', label: '', qty: '', rate: '' })} disabled={busy || !!adding}
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
      {!breakdown && (
        <div style={{ fontFamily: LABEL, fontSize: 9, color: '#475569', padding: '6px 0' }}>
          No ancillary income data extracted yet. Upload an OM, Rent Roll, or T-12 to populate this table.
        </div>
      )}
      {breakdown && (
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
                  </td>
                  <td style={{ padding: '3px 8px' }}>
                    <button onClick={() => deleteLine(l.id)} disabled={busy} title="Delete line"
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>×</button>
                  </td>
                </tr>
              );
            })}
            {/* Add-line input row — two layouts depending on `adding.mode`.
                Flat: single $/mo total. Per-Unit: qty × rate (server derives
                monthly). Save button is gated on the relevant fields being
                non-empty so users can't post a half-filled per-unit line. */}
            {adding && adding.mode === 'flat' && (
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
                <td colSpan={2} style={{ padding: '4px 8px' }}>
                  <button onClick={addLine} disabled={busy || !adding.label.trim() || !adding.monthly} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', fontSize: 11, marginRight: 4 }}>✓ Save</button>
                  <button onClick={() => setAdding(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11 }}>✕</button>
                </td>
              </tr>
            )}
            {adding && adding.mode === 'per_unit' && (() => {
              const qN = parseFloat(adding.qty);
              const rN = parseFloat(adding.rate);
              const preview = Number.isFinite(qN) && Number.isFinite(rN) ? qN * rN : null;
              return (
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
                  <td colSpan={2} style={{ padding: '4px 8px' }}>
                    <button onClick={addLine} disabled={busy || !adding.label.trim() || !adding.qty || !adding.rate} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', fontSize: 11, marginRight: 4 }}>✓ Save</button>
                    <button onClick={() => setAdding(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11 }}>✕</button>
                  </td>
                </tr>
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

function DataRow({ row, isEven, shade, corrections, setCorrections, totalUnits, egiResolved, onSaveCorrection, onResetCorrection, onToggleAncillary, ancillaryOpen, evidenceResolved }: {
  row: OperatingStatementRow;
  isEven: boolean;
  shade?: 'blue' | 'warm' | 'purple';
  corrections: CorrectionState;
  setCorrections: React.Dispatch<React.SetStateAction<CorrectionState>>;
  totalUnits: number;
  egiResolved: number | null;
  onSaveCorrection: (field: string, value: number | null, original: number | null) => Promise<void>;
  onResetCorrection: (field: string) => Promise<void>;
  onToggleAncillary?: () => void;
  ancillaryOpen?: boolean;
  /** Resolved evidence metadata + canonical field_path for this row (null when no underwriting evidence exists) */
  evidenceResolved?: { meta: EvidenceFieldMeta; path: string } | null;
}) {
  const isSubtotal = SUBTOTALS.has(row.field);
  const isDeviant = row.benchmarkPosition === 'above' || row.benchmarkPosition === 'below';
  const isPct = PCT_FIELDS.has(row.field);
  const isPerUnit = PER_UNIT_FIELDS.has(row.field);

  const baseBg = shade === 'warm'
    ? (isEven ? '#0e0a06' : '#0c0907')
    : shade === 'purple'
      ? (isEven ? '#0d0a10' : '#0b0810')
      : (isEven ? '#0c0c0c' : '#0a0a0a');

  const rowBg = isDeviant ? 'rgba(234,179,8,0.07)' : baseBg;
  const corr = corrections[row.field];

  function fmtDisplay(val: number | null): string {
    if (isPct) return fmtPct(val);
    if (isPerUnit) return val != null ? `$${val}/unit` : '—';
    return fmt$(val);
  }

  const egiPct = egiResolved && row.resolved && !isPct && !isPerUnit
    ? (row.resolved / egiResolved) * 100
    : null;

  const resolvedDisplay = fmtDisplay(row.resolved);

  const resolvedColor = isSubtotal
    ? '#22c55e'
    : row.field.includes('pct') || row.field.includes('loss') || row.field.includes('vacancy')
      ? '#fb923c'
      : '#e2e8f0';

  function commitEdit() {
    if (!corr) return;
    const parsed = parseFloat(corr.draft);
    const value = isNaN(parsed) ? null : parsed;
    onSaveCorrection(row.field, value, corr.original);
  }

  return (
    <tr style={{ background: rowBg, borderBottom: `1px solid #161616` }}>
      {/* LINE ITEM — click label to open evidence panel */}
      <td
        title="Click to view evidence for this assumption"
        onClick={() => {
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
          </button>
        ) : row.label}
      </td>

      {/* BROKER */}
      <td style={{ padding: '4px 8px', textAlign: 'right', color: '#f59e0b', fontSize: 9 }}>{fmtDisplay(row.broker)}</td>

      {/* T-12 */}
      <td style={{ padding: '4px 8px', textAlign: 'right', color: '#e2e8f0', fontSize: 9 }}>{fmtDisplay(row.t12)}</td>

      {/* PLATFORM */}
      <td style={{ padding: '4px 8px', textAlign: 'right', color: '#06b6d4', fontSize: 9 }}>{fmtDisplay(row.platform)}</td>

      {/* RESOLVED — clickable to open EvidencePanel when evidence exists */}
      {/* User-input cell: resolved value is editable via pencil icon — teal accent highlights editability */}
      <td
        onClick={evidenceResolved ? () => {
          window.dispatchEvent(new CustomEvent('fe-evidence-click', {
            detail: { path: evidenceResolved.path, label: row.label },
          }));
        } : undefined}
        title={evidenceResolved ? 'Click to view evidence for this value' : 'Editable via pencil icon — overrides write back to server'}
        style={{
          padding: '4px 8px', textAlign: 'right',
          color: resolvedColor, fontWeight: isSubtotal ? 700 : 600,
          background: '#0d1f2d',
          cursor: evidenceResolved ? 'pointer' : undefined,
          borderLeft: '1px solid #0891b2',
          borderRight: '1px solid #0891b2',
        }}
      >
        {corr?.editing ? (
          <input
            autoFocus
            value={corr.draft}
            onChange={e => setCorrections(prev => ({ ...prev, [row.field]: { ...prev[row.field], draft: e.target.value } }))}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setCorrections(prev => ({ ...prev, [row.field]: { ...prev[row.field], editing: false } }));
            }}
            style={{
              width: 80, background: '#0f172a', border: '1px solid #06b6d4', color: '#f8fafc',
              fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, textAlign: 'right',
            }}
          />
        ) : (
          <span
            title={corr?.savedAt ? `Overridden at ${new Date(corr.savedAt).toLocaleTimeString()}` : undefined}
            style={{ borderBottom: corr?.savedAt ? '1px dotted #f59e0b' : undefined }}
          >
            {resolvedDisplay}
            {corr?.savedAt && <span style={{ marginLeft: 4, color: '#f59e0b', fontSize: 8 }}>✎</span>}
          </span>
        )}
      </td>

      {/* % of EGI */}
      <td style={{ padding: '4px 8px', textAlign: 'right', color: '#475569', fontSize: 9 }}>
        {egiPct != null ? `${egiPct.toFixed(1)}%` : '—'}
      </td>

      {/* SOURCE BADGE — shows financials-API source + evidence tier badge when underwriting evidence exists */}
      <td
        onClick={evidenceResolved ? () => {
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
                : { editing: true, original: row.resolved, draft: String(row.resolved ?? '') },
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

function CapitalStackPanel({ capitalStack, purchasePriceFallback, capRate, noi, totalUnits }: {
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
