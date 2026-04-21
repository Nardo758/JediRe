import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Pencil, RotateCcw, RefreshCw, Loader2, XCircle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { apiClient } from '../../../services/api.client';
import type { FinancialEngineTabProps, EvidenceFieldMeta } from './types';

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

interface RentRollUnitType {
  type: string;
  count: number;
  avgSf: number | null;
  inPlaceRent: number | null;
  marketRent: number | null;
  occupancyPct: number | null;
  concessionPct: number | null;
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
    unitMix: RentRollUnitType[] | null;
    avgInPlaceRent: number | null;
    weightedOccupancyPct: number | null;
  } | null;
  assumptions: {
    holdYears: number;
    exitCap: number | null;
    rentGrowthYr1: number | null;
    perYear: Array<{ year: number; vacancyPct: number | null; rentGrowthPct: number | null; exitCapIfLastYear: number | null }>;
  };
  meta: { seeded: boolean; updatedAt: string | null };
}

// ─── Sections layout ──────────────────────────────────────────────────────────
const REVENUE_FIELDS = new Set([
  'gpr', 'loss_to_lease_pct', 'vacancy_pct', 'concessions_pct',
  'bad_debt_pct', 'non_revenue_units_pct', 'other_income_per_unit',
  'net_rental_income', 'egi',
]);
const CTRL_OPEX_FIELDS = new Set([
  'payroll', 'repairs_maintenance', 'turnover', 'contract_services',
  'marketing', 'utilities', 'g_and_a',
]);
const NCTRL_OPEX_FIELDS = new Set([
  'management_fee_pct', 'insurance', 'real_estate_tax', 'replacement_reserves', 'total_opex',
]);
const SUBTOTALS = new Set(['egi', 'total_opex', 'noi']);
const PCT_FIELDS = new Set([
  'loss_to_lease_pct', 'vacancy_pct', 'concessions_pct',
  'bad_debt_pct', 'non_revenue_units_pct', 'management_fee_pct',
]);
const PER_UNIT_FIELDS = new Set(['other_income_per_unit']);

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
  tax_bill:         { label: 'County Assessor', color: '#06b6d4', bg: '#083344' },
  om:               { label: 'OM Narrative',    color: '#f59e0b', bg: '#292101' },
  broker:           { label: 'OM Narrative',    color: '#f59e0b', bg: '#292101' },
  platform:         { label: 'Platform',        color: '#60a5fa', bg: '#1e3a5f' },
  platform_fallback:{ label: 'Platform',        color: '#60a5fa', bg: '#1e3a5f' },
  override:         { label: 'Override',        color: '#c084fc', bg: '#2e1065' },
  box_score:        { label: 'Box Score',       color: '#86efac', bg: '#14532d' },
  computed:         { label: 'Computed',        color: '#94a3b8', bg: '#1e293b' },
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

// ─── Ancillary income breakdown (mirrors F13 UnitMixTab model) ───────────────
interface AncillaryLine { key: string; label: string; qty: number; price: number; occupancy: number; note: string }
function makeDefaultAncillary(u: number): AncillaryLine[] {
  return [
    { key: 'pet',      label: 'Pet Rent',                   qty: u,                     price: 27.50,  occupancy: 0.30, note: 'Est. 30% of units' },
    { key: 'garage',   label: 'Garage / Parking',           qty: Math.round(u * 0.111), price: 142.50, occupancy: 1.00, note: '~1 garage per 9 units' },
    { key: 'storage',  label: 'Storage',                    qty: Math.round(u * 0.083), price: 50.00,  occupancy: 1.00, note: '~1 storage per 12 units' },
    { key: 'rubs',     label: 'RUBS / Utilities',           qty: u,                     price: 65.00,  occupancy: 1.00, note: 'All units' },
    { key: 'revshare', label: 'Revenue Sharing (Internet)', qty: u,                     price: 85.00,  occupancy: 0.95, note: '95% of units' },
    { key: 'valet',    label: 'Valet Trash',                qty: u,                     price: 30.00,  occupancy: 0.95, note: '95% of units' },
    { key: 'admin',    label: 'Admin / App Fees',           qty: u,                     price: 27.00,  occupancy: 0.65, note: 'Est. 65% of units' },
    { key: 'late',     label: 'Late / NSF / Termination',  qty: u,                     price: 5.00,   occupancy: 1.00, note: 'All units' },
    { key: 'damages',  label: 'Damages',                    qty: u,                     price: 2.44,   occupancy: 1.00, note: 'All units' },
    { key: 'other',    label: 'Other Income',               qty: u,                     price: 7.00,   occupancy: 1.00, note: 'All units' },
  ];
}

// ─── Correction state ─────────────────────────────────────────────────────────
interface CorrectionState {
  [field: string]: { editing: boolean; original: number | null; draft: string; savedAt?: string };
}

// ─── Unit mix local edits (keyed by `${index}:${field}`) ──────────────────────
interface UnitMixEdit {
  [cellKey: string]: { editing: boolean; draft: string; savedAt?: string };
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
  materialCollisionFields?: string[] | null
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
    // Severity-specific filtering: 'severe' and 'material' use per-severity field lists.
    if (filter.value === 'severe' || filter.value === 'material') {
      const severityFields = filter.value === 'severe' ? severeCollisionFields : materialCollisionFields;
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

export function ProFormaSummaryTab({ dealId, deal, onIntegrityChange, evidenceFilter, evidenceFieldMap, collisionFields, severeCollisionFields, materialCollisionFields }: FinancialEngineTabProps) {
  const [data, setData] = useState<DealFinancials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reparsing, setReparsing] = useState(false);
  const [corrections, setCorrections] = useState<CorrectionState>({});
  const [unitMixEdits, setUnitMixEdits] = useState<UnitMixEdit>({});
  const [showAncillary, setShowAncillary] = useState(false);

  const load = useCallback(async () => {
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load financials');
    } finally {
      setLoading(false);
    }
  }, [dealId, onIntegrityChange]);

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

  // Unit mix cell: save
  const handleUnitMixSave = useCallback(async (index: number, field: string, rawDraft: string) => {
    const cellKey = `${index}:${field}`;
    const parsed = parseFloat(rawDraft);
    const value = isNaN(parsed) ? null : parsed;
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, {
        field: `unit_mix:${index}:${field}`,
        year: null,
        value,
      });
      setUnitMixEdits(prev => ({
        ...prev,
        [cellKey]: { editing: false, draft: rawDraft, savedAt: new Date().toISOString() },
      }));
      load();
    } catch (e: unknown) {
      console.error('Unit mix override failed:', e instanceof Error ? e.message : e);
      setUnitMixEdits(prev => ({ ...prev, [cellKey]: { ...prev[cellKey], editing: false } }));
    }
  }, [dealId, load]);

  // Unit mix cell: reset
  const handleUnitMixReset = useCallback(async (index: number, field: string) => {
    const cellKey = `${index}:${field}`;
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, {
        field: `unit_mix:${index}:${field}`,
        year: null,
        value: null,
      });
      load();
    } catch (e: unknown) {
      console.error('Unit mix reset failed:', e instanceof Error ? e.message : e);
    } finally {
      setUnitMixEdits(prev => { const next = { ...prev }; delete next[cellKey]; return next; });
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
  const displayRows = evidenceFilter ? applyEvidenceFilter(rows, evidenceFilter, evidenceFieldMap, collisionFields, severeCollisionFields, materialCollisionFields) : rows;

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
        <div style={{ display: 'flex', gap: 6 }}>
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

        {/* ── SECTION A — In-Place Rent Roll Unit Mix ── */}
        {data.rentRollSummary && (
          <RentRollSection
            summary={data.rentRollSummary}
            totalUnits={totalUnits}
            edits={unitMixEdits}
            setEdits={setUnitMixEdits}
            onSave={handleUnitMixSave}
            onReset={handleUnitMixReset}
          />
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
                  onToggleAncillary={r.field === 'other_income_per_unit' ? () => setShowAncillary(v => !v) : undefined}
                  ancillaryOpen={r.field === 'other_income_per_unit' ? showAncillary : undefined}
                  evidenceResolved={resolveEvidence(r.field, evidenceFieldMap)}
                />
                {r.field === 'other_income_per_unit' && showAncillary && (
                  <tr>
                    <td colSpan={9} style={{ background: '#050d12', padding: 0, borderBottom: '1px solid #0e2030' }}>
                      <AncillaryExpansionPanel totalUnits={totalUnits} dealId={dealId} />
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

// ─── Ancillary expansion panel (self-contained, editable) ────────────────────
function AncillaryExpansionPanel({ totalUnits, dealId }: { totalUnits: number; dealId: string }) {
  const [lines, setLines] = useState<AncillaryLine[]>(() => makeDefaultAncillary(totalUnits));
  const [editingKey, setEditingKey] = useState<{ key: string; field: 'qty' | 'price' | 'occ'; val: string } | null>(null);

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
            style={{ width: field === 'qty' ? 56 : field === 'occ' ? 48 : 64, background: '#0f172a', border: '1px solid #06b6d4', color: '#06b6d4', fontFamily: MONO, fontSize: 9, padding: '2px 4px', textAlign: 'right', borderRadius: 2 }}
          />
          <button onClick={commit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', padding: 0, fontSize: 9 }}>✓</button>
          <button onClick={() => setEditingKey(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, fontSize: 9 }}>✕</button>
        </div>
      );
    }
    const line = lines.find(l => l.key === lineKey)!;
    const rawVal = field === 'qty' ? String(line.qty) : field === 'price' ? String(line.price) : String((line.occupancy * 100).toFixed(0));
    return (
      <div onClick={() => setEditingKey({ key: lineKey, field, val: rawVal })}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ color: color ?? '#e2e8f0' }}>{display}</span>
        <span style={{ color: '#334155', fontSize: 8 }}>✎</span>
      </div>
    );
  }

  const TH = ({ label, right }: { label: string; right?: boolean }) => (
    <th style={{ padding: '3px 8px', textAlign: right ? 'right' : 'left', color: '#475569', fontWeight: 600, letterSpacing: '0.05em', borderBottom: '1px solid #1e2d3d', fontSize: 9 }}>{label}</th>
  );

  return (
    <div style={{ padding: '10px 16px 14px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: '#06b6d4', letterSpacing: '0.08em' }}>
            ANCILLARY INCOME BREAKDOWN · 10 LINE ITEMS
          </span>
          <span style={{ fontFamily: LABEL, fontSize: 8, color: '#334155', marginLeft: 8 }}>click QTY · $/MO · OCC% to edit</span>
        </div>
        <a href={`/deals/${dealId}/detail?tab=unit-mix`}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: LABEL, fontSize: 8, color: '#475569', textDecoration: 'none' }}>
          <ExternalLink size={9} />Edit in F13 Unit Mix
        </a>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
        <thead>
          <tr style={{ background: '#0a1520' }}>
            <TH label="INCOME TYPE" />
            <TH label="QTY" right />
            <TH label="$/MO" right />
            <TH label="OCC %" right />
            <TH label="TOTAL/MO" right />
            <TH label="TOTAL/YR" right />
            <TH label="NOTE" />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, li) => {
            const mo = l.qty * l.price * l.occupancy;
            const yr = mo * 12;
            return (
              <tr key={l.key} style={{ background: li % 2 === 0 ? '#060e16' : '#080f18' }}>
                <td style={{ padding: '3px 8px', color: '#94a3b8' }}>{l.label}</td>
                <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                  <EditCell lineKey={l.key} field="qty" display={String(l.qty)} color="#e2e8f0" />
                </td>
                <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                  <EditCell lineKey={l.key} field="price" display={`$${l.price.toFixed(2)}`} color="#e2e8f0" />
                </td>
                <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                  <EditCell lineKey={l.key} field="occ" display={`${(l.occupancy * 100).toFixed(0)}%`} color="#64748b" />
                </td>
                <td style={{ padding: '3px 8px', textAlign: 'right', color: '#e2e8f0' }}>{fmt$(mo)}</td>
                <td style={{ padding: '3px 8px', textAlign: 'right', color: '#f59e0b', fontWeight: 600 }}>{fmt$(yr)}</td>
                <td style={{ padding: '3px 8px', color: '#334155', fontSize: 8 }}>{l.note}</td>
              </tr>
            );
          })}
          <tr style={{ background: '#0a1a26', borderTop: '1px solid #1e3a5f' }}>
            <td style={{ padding: '4px 8px', color: '#06b6d4', fontWeight: 700 }}>TOTAL</td>
            <td /><td /><td />
            <td style={{ padding: '4px 8px', textAlign: 'right', color: '#06b6d4', fontWeight: 700 }}>{fmt$(totalMonthly)}/mo</td>
            <td style={{ padding: '4px 8px', textAlign: 'right', color: '#22c55e', fontWeight: 700 }}>{fmt$(totalAnnual)}/yr</td>
            <td style={{ padding: '4px 8px', color: '#334155', fontSize: 8 }}>
              {totalUnits > 0 ? `$${(totalAnnual / totalUnits).toFixed(0)}/unit/yr` : ''}
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 6, fontFamily: LABEL, fontSize: 8, color: '#334155' }}>
        * Defaults seeded from unit count. Navigate to F13 Unit Mix to persist edits across sessions.
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
          <button
            onClick={e => { e.stopPropagation(); onToggleAncillary(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#94a3b8', fontFamily: 'Inter, sans-serif', fontSize: 9 }}
            title="Expand ancillary income breakdown"
          >
            {ancillaryOpen
              ? <ChevronDown size={10} color="#06b6d4" />
              : <ChevronRight size={10} color="#475569" />}
            {row.label}
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
      <td
        onClick={evidenceResolved ? () => {
          window.dispatchEvent(new CustomEvent('fe-evidence-click', {
            detail: { path: evidenceResolved.path, label: row.label },
          }));
        } : undefined}
        title={evidenceResolved ? 'Click to view evidence for this value' : undefined}
        style={{
          padding: '4px 8px', textAlign: 'right',
          color: resolvedColor, fontWeight: isSubtotal ? 700 : 600,
          background: '#0d1f2d',
          cursor: evidenceResolved ? 'pointer' : undefined,
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

// ─── Section A: In-Place Rent Roll Unit Mix (editable) ────────────────────────
function UMCell({ value, cellKey, edits, setEdits, onSave, onReset, color, fmt }: {
  value: number | null;
  cellKey: string;
  edits: UnitMixEdit;
  setEdits: React.Dispatch<React.SetStateAction<UnitMixEdit>>;
  onSave: (draft: string) => void;
  onReset: () => void;
  color: string;
  fmt: (v: number | null) => string;
}) {
  const edit = edits[cellKey];
  function commit() {
    if (!edit) return;
    onSave(edit.draft);
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
      {edit?.editing ? (
        <input
          autoFocus
          value={edit.draft}
          onChange={e => setEdits(prev => ({ ...prev, [cellKey]: { ...prev[cellKey], draft: e.target.value } }))}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEdits(prev => ({ ...prev, [cellKey]: { ...prev[cellKey], editing: false } }));
          }}
          style={{
            width: 70, background: '#0f172a', border: '1px solid #06b6d4', color: '#f8fafc',
            fontFamily: MONO, fontSize: 9, padding: '1px 4px', borderRadius: 2, textAlign: 'right',
          }}
        />
      ) : (
        <span
          title={edit?.savedAt ? `Overridden` : undefined}
          style={{ color: edit?.savedAt ? '#f59e0b' : color, borderBottom: edit?.savedAt ? '1px dotted #f59e0b' : undefined, cursor: 'default' }}
        >
          {fmt(value)}
        </span>
      )}
      <button
        title={edit?.savedAt ? 'Reset to ingested' : 'Edit value'}
        onClick={() => {
          if (edit?.savedAt) { onReset(); return; }
          setEdits(prev => ({ ...prev, [cellKey]: { editing: true, draft: String(value ?? '') } }));
        }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: edit?.savedAt ? '#f59e0b' : '#334155', padding: '0 1px', lineHeight: 1 }}
      >
        {edit?.savedAt
          ? <RotateCcw style={{ width: 8, height: 8, display: 'block' }} />
          : <Pencil style={{ width: 8, height: 8, display: 'block' }} />
        }
      </button>
    </div>
  );
}

function RentRollSection({ summary, totalUnits, edits, setEdits, onSave, onReset }: {
  summary: NonNullable<DealFinancials['rentRollSummary']>;
  totalUnits: number;
  edits: UnitMixEdit;
  setEdits: React.Dispatch<React.SetStateAction<UnitMixEdit>>;
  onSave: (index: number, field: string, draft: string) => Promise<void>;
  onReset: (index: number, field: string) => Promise<void>;
}) {
  const { unitMix, avgInPlaceRent, weightedOccupancyPct } = summary;
  const hasUnitMix = unitMix && unitMix.length > 0;

  // Derived totals
  const totalCount = unitMix ? unitMix.reduce((s, u) => s + u.count, 0) : 0;
  const gprAnnual = unitMix
    ? unitMix.reduce((s, u) => s + u.count * (u.inPlaceRent ?? 0) * 12, 0)
    : 0;
  const wtdAvgRent = totalCount > 0
    ? unitMix!.reduce((s, u) => s + u.count * (u.inPlaceRent ?? 0), 0) / totalCount
    : null;
  const wtdAvgOcc = totalCount > 0
    ? unitMix!.reduce((s, u) => s + u.count * (u.occupancyPct ?? 0), 0) / totalCount
    : null;

  return (
    <div style={{ borderBottom: '2px solid #1e1e1e', background: '#050d14', padding: '12px 12px 8px' }}>
      {/* Sub-header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#94a3b8',
            letterSpacing: 1, textTransform: 'uppercase',
            borderLeft: '3px solid #0ea5e9', paddingLeft: 6,
          }}>
            In-Place Unit Economics · Rent Roll
          </span>
          <span style={{ fontFamily: LABEL, fontSize: 8, color: '#334155' }}>at acquisition · pencil icon to correct parser errors</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {gprAnnual > 0 && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
              <span style={{ fontFamily: LABEL, fontSize: 8, color: '#64748b' }}>GPR (RR)</span>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: '#22c55e' }}>{fmt$(gprAnnual)}</span>
            </div>
          )}
          {(wtdAvgRent ?? avgInPlaceRent) != null && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
              <span style={{ fontFamily: LABEL, fontSize: 8, color: '#64748b' }}>AVG RENT</span>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: '#06b6d4' }}>${Math.round(wtdAvgRent ?? avgInPlaceRent!).toLocaleString()}</span>
            </div>
          )}
          {(wtdAvgOcc ?? weightedOccupancyPct) != null && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
              <span style={{ fontFamily: LABEL, fontSize: 8, color: '#64748b' }}>OCC</span>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: '#22c55e' }}>{((wtdAvgOcc ?? weightedOccupancyPct!) * 100).toFixed(1)}%</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
            <span style={{ fontFamily: LABEL, fontSize: 8, color: '#64748b' }}>UNITS</span>
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: '#e2e8f0' }}>{totalUnits}</span>
          </div>
        </div>
      </div>

      {hasUnitMix ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Type', 'Units', '% Mix', 'Avg SF', 'In-Place Rent', 'Market Rent', 'Loss-to-Lease', 'Occupancy', 'On Concession', 'GPR (Ann.)'].map(h => (
                <th key={h} style={{
                  padding: '3px 8px', textAlign: h === 'Type' ? 'left' : 'right',
                  fontFamily: LABEL, fontSize: 8, color: '#475569', fontWeight: 700,
                  letterSpacing: 0.5, textTransform: 'uppercase',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {unitMix!.map((ut, i) => {
              const ltlPct = ut.inPlaceRent && ut.marketRent && ut.marketRent > 0
                ? ((ut.marketRent - ut.inPlaceRent) / ut.marketRent) * 100
                : null;
              const mixPct = totalUnits > 0 ? (ut.count / totalUnits) * 100 : null;
              const lineGpr = ut.count * (ut.inPlaceRent ?? 0) * 12;

              function ck(field: string) { return `${i}:${field}`; }

              return (
                <tr key={ut.type} style={{ background: i % 2 === 0 ? '#060e18' : '#040b14', borderBottom: '1px solid #0f172a' }}>
                  <td style={{ padding: '3px 8px', color: '#94a3b8', fontFamily: LABEL, fontSize: 9, fontWeight: 600 }}>{ut.type}</td>

                  {/* Units (editable) */}
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                    <UMCell value={ut.count} cellKey={ck('count')} edits={edits} setEdits={setEdits}
                      onSave={d => onSave(i, 'count', d)} onReset={() => onReset(i, 'count')}
                      color="#e2e8f0" fmt={v => v != null ? String(Math.round(v)) : '—'} />
                  </td>

                  <td style={{ padding: '3px 8px', textAlign: 'right', color: '#64748b' }}>
                    {mixPct != null ? `${mixPct.toFixed(1)}%` : '—'}
                  </td>

                  {/* Avg SF (editable) */}
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                    <UMCell value={ut.avgSf} cellKey={ck('avg_sf')} edits={edits} setEdits={setEdits}
                      onSave={d => onSave(i, 'avg_sf', d)} onReset={() => onReset(i, 'avg_sf')}
                      color="#64748b" fmt={v => v != null ? `${v.toLocaleString()} sf` : '—'} />
                  </td>

                  {/* In-Place Rent (editable) */}
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                    <UMCell value={ut.inPlaceRent} cellKey={ck('in_place_rent')} edits={edits} setEdits={setEdits}
                      onSave={d => onSave(i, 'in_place_rent', d)} onReset={() => onReset(i, 'in_place_rent')}
                      color="#f59e0b" fmt={v => v != null ? `$${v.toLocaleString()}` : '—'} />
                  </td>

                  <td style={{ padding: '3px 8px', textAlign: 'right', color: '#06b6d4' }}>
                    {ut.marketRent != null ? `$${ut.marketRent.toLocaleString()}` : '—'}
                  </td>

                  <td style={{ padding: '3px 8px', textAlign: 'right', color: ltlPct != null && ltlPct > 5 ? '#fb923c' : '#475569' }}>
                    {ltlPct != null ? `${ltlPct.toFixed(1)}%` : '—'}
                  </td>

                  {/* Occupancy (editable — pct input 0-100) */}
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                    <UMCell value={ut.occupancyPct != null ? ut.occupancyPct * 100 : null} cellKey={ck('occupancy_pct')} edits={edits} setEdits={setEdits}
                      onSave={d => onSave(i, 'occupancy_pct', d)} onReset={() => onReset(i, 'occupancy_pct')}
                      color={ut.occupancyPct != null && ut.occupancyPct < 0.9 ? '#fb923c' : '#22c55e'}
                      fmt={v => v != null ? `${v.toFixed(1)}%` : '—'} />
                  </td>

                  {/* Concession pct (editable — pct input 0-100) */}
                  <td style={{ padding: '3px 8px', textAlign: 'right' }}>
                    <UMCell value={ut.concessionPct != null ? ut.concessionPct * 100 : null} cellKey={ck('concession_pct')} edits={edits} setEdits={setEdits}
                      onSave={d => onSave(i, 'concession_pct', d)} onReset={() => onReset(i, 'concession_pct')}
                      color="#475569"
                      fmt={v => v != null ? `${v.toFixed(1)}%` : '—'} />
                  </td>

                  <td style={{ padding: '3px 8px', textAlign: 'right', color: '#64748b' }}>
                    {lineGpr > 0 ? fmt$(lineGpr) : '—'}
                  </td>
                </tr>
              );
            })}

            {/* ── Totals / weighted-average row ── */}
            <tr style={{ background: '#0a1220', borderTop: '1px solid #1e3a5f' }}>
              <td style={{ padding: '4px 8px', fontFamily: LABEL, fontSize: 8, color: '#64748b', fontWeight: 700 }}>TOTALS / WTD AVG</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#e2e8f0', fontWeight: 700 }}>{totalCount}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#64748b' }}>100%</td>
              <td />
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#f59e0b', fontWeight: 700 }}>
                {wtdAvgRent != null ? `$${Math.round(wtdAvgRent).toLocaleString()}` : '—'}
              </td>
              <td />
              <td />
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#22c55e', fontWeight: 700 }}>
                {wtdAvgOcc != null ? `${(wtdAvgOcc * 100).toFixed(1)}%` : '—'}
              </td>
              <td />
              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#22c55e', fontWeight: 700, borderLeft: '1px solid #1e3a5f' }}>
                {fmt$(gprAnnual)}
              </td>
            </tr>

            {/* ── GPR Rollup row ── */}
            <tr style={{ background: '#040e18', borderTop: '1px solid #0c2a3f' }}>
              <td colSpan={9} style={{ padding: '4px 8px 4px 12px', fontFamily: LABEL, fontSize: 8, color: '#334155' }}>
                GPR = Σ (Units × In-Place Rent × 12 months) · matches T-12 GPR if rent roll ties
              </td>
              <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: MONO, fontWeight: 700, fontSize: 10, color: '#22c55e' }}>
                {fmt$(gprAnnual)}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div style={{ fontFamily: LABEL, fontSize: 9, color: '#334155', padding: '8px 8px', textAlign: 'center' }}>
          No unit mix data · Add rent roll to unlock
        </div>
      )}
    </div>
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
