// ============================================================================
// ValuationGridTab — Multi-Method Price Triangulation
// Task #1370, Dispatch 3
//
// Runs 5 active valuation methods (V0.1) against the subject deal and
// reconciles them into a recommended price range.
//
// Active V0.1 methods:
//   1. Cap Rate × NOI          — bottom-up income capitalisation
//   2. Per-Unit Benchmark      — archive_assumption_benchmarks PPU cohort
//   3. Sales Comp PPU          — CompSetService transaction comps
//   3b. Sales Comp PSF         — conditional on sqft coverage
//   4. Operator Override       — manual, always available
//   5. Replacement Cost        — BLS PPI + permits
//
// Placeholder V1.0: GRM, GIM, DCF
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info, Edit3, RefreshCw, ChevronDown, ChevronRight, X, Filter, EyeOff, Eye, ShieldCheck } from 'lucide-react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { apiClient } from '../../../services/api.client';
import type { FinancialEngineTabProps } from './types';

const MONO = BT.font.mono;

// ── Types ──────────────────────────────────────────────────────────────────────

type MethodId =
  | 'cap_rate_noi' | 'per_unit_benchmark' | 'sales_comp_ppu' | 'sales_comp_psf'
  | 'operator_override' | 'replacement_cost' | 'grm' | 'gim' | 'dcf';

// ── Divergence types (mirrors field-divergences API response) ─────────────────

interface FieldDivergence {
  fieldName: string;
  divergence: {
    alertLevel: 'none' | 'info' | 'warn' | 'block';
    exceeds: boolean;
    maxAbsDelta: number;
    threshold: number;
    unit: string;
    isPct: boolean;
  };
}

/**
 * Fields that drive each income-multiple method.
 * When any mapped field has exceeds=true, the method is CONTESTED.
 *
 * Active methods included here so operators see warnings on the methods they
 * actually use, not just the placeholder GRM/GIM methods.
 */
const CONTESTED_FIELD_MAP: Partial<Record<MethodId, string[]>> = {
  cap_rate_noi: ['noi', 'total_opex'],
  grm: ['gpr'],
  gim: ['egi'],
};

type MethodStatus = 'active' | 'insufficient' | 'placeholder';
type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
type ConvergenceSignal = 'CONVERGENT' | 'MODERATE' | 'DIVERGENT';

interface EvidenceLine { label: string; value: string; source?: string; }
type StalenessLabel = 'fresh' | 'aging' | 'seasoned' | 'stale';

interface ValuationMethod {
  id: MethodId;
  label: string;
  direction: string;
  status: MethodStatus;
  placeholderVersion?: string;
  confidence: ConfidenceLevel;
  indicatedValueP25: number | null;
  indicatedValueP50: number | null;
  indicatedValueP75: number | null;
  indicatedPPU: number | null;
  indicatedPSF: number | null;
  compCount?: number;
  sampleSize?: number;
  staleCompCount?: number;
  capRateSpreadBps?: number;
  relevanceFilteredCount?: number;
  sourceProvenance: string;
  evidenceTrail: EvidenceLine[];
  warningFlags: string[];
}
interface GapAnalysisItem {
  methodA: MethodId; methodB: MethodId;
  labelA: string; labelB: string;
  deltaPct: number; driverText: string;
  severity: 'info' | 'watch' | 'alert';
}
interface SubjectProperty {
  units: number | null; totalSF: number | null; purchasePrice: number | null;
  noi: number | null; noiSource: string;
  assetClass: string | null; city: string; state: string; submarket: string | null;
}
interface SubjectMissingField {
  field: string;
  label: string;
  suggestion: string;
  blocksModules: string[];
}

interface ValuationGridResult {
  dealId: string; computedAt: string; subject: SubjectProperty;
  methods: ValuationMethod[];
  reconciliation: {
    convergenceScore: number; convergenceSignal: ConvergenceSignal;
    convergenceText: string;
    reconciledValue: number | null; reconciledPPU: number | null; reconciledPSF: number | null;
    recommendedPriceLow: number | null; recommendedPriceHigh: number | null;
    gapAnalysis: GapAnalysisItem[]; activeMethodCount: number;
    /** Task #1417 (6.3) */
    valuationConfidence?: ConfidenceLevel;
    valuationConfidenceText?: string;
  };
  subjectCompleteness?: {
    complete: boolean;
    missingFields: SubjectMissingField[];
    availableFields: string[];
  };
}

// ── Task #1417 (6.1): Comp review types ─────────────────────────────────────

interface CompCriteria {
  radiusMiles: number;
  maxAgeMonths: number;
  minUnits: number;
  maxUnits: number;
  minYearBuilt: number;
  maxYearBuilt: number;
  propertyClasses: string[];
  excludedCompIds: string[];
}

interface PsfGateResult {
  passed: boolean;
  failedGate: 'sqft' | 'similarity' | 'stories' | null;
  reason: string | null;
  forced: boolean;
}

interface CompReviewItem {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  units: number | null;
  year_built: number | null;
  asset_class: string | null;
  sale_date: string | null;
  sale_price: number | null;
  price_per_unit: number | null;
  implied_cap_rate: number | null;
  distance_miles: number | null;
  source: string;
  age_months: number;
  staleness_label: StalenessLabel;
  staleness_weight: number;
  excluded: boolean;
  manually_added: boolean;
  relevance_score: number | null;
  relevance_tier: string | null;
  /** PSF gate evaluation for this comp. null when building sqft data is unavailable. */
  psf_gate: PsfGateResult | null;
}

interface CompReviewResult {
  dealId: string;
  criteria: CompCriteria;
  comps: CompReviewItem[];
  /** Comps from a wider radius not in the system-generated comp set — available for manual add. */
  additionalCandidates: CompReviewItem[];
  totalCandidates: number;
  staleCount: number;
  excludedCount: number;
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmt$(v: number | null | undefined, decimals = 0): string {
  if (v == null) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(decimals)}`;
}
function fmtPPU(v: number | null | undefined): string {
  if (v == null) return '—';
  return `$${Math.round(v).toLocaleString('en-US')}/unit`;
}
function fmtPSF(v: number | null | undefined): string {
  if (v == null) return '—';
  return `$${Math.round(v)}/SF`;
}
function fmtPct(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

const CONFIDENCE_COLOR: Record<ConfidenceLevel, string> = {
  HIGH: BT.text.green,
  MEDIUM: BT.text.amber,
  LOW: BT.text.orange ?? BT.text.amber,
  INSUFFICIENT: BT.text.muted,
};

const CONVERGENCE_COLOR: Record<ConvergenceSignal, string> = {
  CONVERGENT: BT.text.green,
  MODERATE: BT.text.amber,
  DIVERGENT: BT.met.risk,
};

const SEVERITY_COLOR: Record<string, string> = {
  info: BT.text.cyan,
  watch: BT.text.amber,
  alert: BT.met.risk,
};

const DIRECTION_LABEL: Record<string, string> = {
  bottom_up: 'BOTTOM-UP',
  top_down: 'TOP-DOWN',
  cost: 'COST',
  income: 'INCOME',
  manual: 'MANUAL',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  if (level === 'INSUFFICIENT') return null;
  return (
    <span style={{
      fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 1,
      color: CONFIDENCE_COLOR[level],
      border: `1px solid ${CONFIDENCE_COLOR[level]}`,
      borderRadius: 2, padding: '1px 4px',
    }}>{level}</span>
  );
}

function DirectionBadge({ dir }: { dir: string }) {
  const label = DIRECTION_LABEL[dir] ?? dir.toUpperCase();
  const color = dir === 'bottom_up' ? BT.text.cyan
    : dir === 'top_down' ? BT.text.green
    : dir === 'cost' ? BT.text.amber
    : BT.text.muted;
  return (
    <span style={{
      fontFamily: MONO, fontSize: 8, letterSpacing: 1, color,
      border: `1px solid ${color}22`, borderRadius: 2, padding: '1px 4px',
    }}>{label}</span>
  );
}

function ValueRange({
  p25, p50, p75, ppu, psf, units, totalSF
}: {
  p25: number | null; p50: number | null; p75: number | null;
  ppu: number | null; psf: number | null;
  units?: number | null; totalSF?: number | null;
}) {
  if (p50 == null) return <span style={{ color: BT.text.muted, fontFamily: MONO, fontSize: 12 }}>—</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: BT.text.primary }}>
          {fmt$(p50)}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>
          {fmt$(p25)} – {fmt$(p75)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {ppu != null && (
          <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary }}>{fmtPPU(ppu)}</span>
        )}
        {psf != null && (
          <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary }}>{fmtPSF(psf)}</span>
        )}
      </div>
    </div>
  );
}

function EvidencePanel({ lines, open }: { lines: EvidenceLine[]; open: boolean }) {
  if (!open || lines.length === 0) return null;
  return (
    <div style={{
      marginTop: 6, padding: '6px 10px', backgroundColor: `${BT.bg.panel}88`,
      borderLeft: `2px solid ${BT.border.dim}`, borderRadius: '0 4px 4px 0',
    }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>{line.label}</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary }}>{line.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── CONTESTED Badge ────────────────────────────────────────────────────────────

function buildContestedTooltip(
  fieldName: string,
  div: FieldDivergence['divergence'],
): string {
  const label = fieldName.toUpperCase();
  const fmt = (v: number) =>
    div.isPct
      ? `${(v * 100).toFixed(2)}%`
      : v >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(2)}M`
      : v >= 1_000
      ? `$${(v / 1_000).toFixed(0)}K`
      : `$${v.toFixed(0)}`;
  return `${label}: divergence Δ${fmt(div.maxAbsDelta)} exceeds threshold ${fmt(div.threshold)} — review inputs before relying on this method.`;
}

function ContestedBadge({
  fieldName,
  divergence,
}: {
  fieldName: string;
  divergence: FieldDivergence['divergence'];
}) {
  const label = fieldName.toUpperCase();
  return (
    <span
      title={buildContestedTooltip(fieldName, divergence)}
      style={{
        fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: 1,
        color: BT.text.amber,
        border: `1px solid ${BT.text.amber}`,
        borderRadius: 2, padding: '1px 4px',
        display: 'inline-flex', alignItems: 'center', gap: 3,
        cursor: 'help',
      }}
    >
      <AlertTriangle size={8} style={{ flexShrink: 0 }} />
      CONTESTED · {label}
    </span>
  );
}

// ── Method Row ─────────────────────────────────────────────────────────────────

function MethodRow({
  method, subject, purchasePrice, contestedDivergences,
}: {
  method: ValuationMethod;
  subject: SubjectProperty;
  purchasePrice: number | null;
  contestedDivergences?: FieldDivergence[];
}) {
  const [showEvidence, setShowEvidence] = useState(false);

  const isPlaceholder = method.status === 'placeholder';
  const isInsufficient = method.status === 'insufficient';
  const isContested = (contestedDivergences?.length ?? 0) > 0;

  // Compute % vs purchase price
  let vsAskPct: number | null = null;
  if (purchasePrice && method.indicatedValueP50) {
    vsAskPct = ((method.indicatedValueP50 - purchasePrice) / purchasePrice) * 100;
  }

  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: `1px solid ${BT.border.dim}`,
      opacity: isPlaceholder ? 0.55 : 1,
      backgroundColor: isContested ? `${BT.text.amber}08` : 'transparent',
      borderLeft: isContested ? `3px solid ${BT.text.amber}` : '3px solid transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Expand evidence */}
        <button
          onClick={() => !isPlaceholder && setShowEvidence(p => !p)}
          style={{
            background: 'none', border: 'none', cursor: isPlaceholder ? 'default' : 'pointer',
            color: BT.text.muted, display: 'flex', alignItems: 'center', padding: 0,
            opacity: isPlaceholder ? 0.4 : 1,
          }}
        >
          {showEvidence
            ? <ChevronDown size={12} />
            : <ChevronRight size={12} />}
        </button>

        {/* Method label + badges */}
        <div style={{ flex: '0 0 200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: MONO, fontSize: 11, fontWeight: 700,
              color: isPlaceholder ? BT.text.muted : BT.text.primary,
            }}>{method.label}</span>
            {isPlaceholder && (
              <span style={{
                fontFamily: MONO, fontSize: 8, letterSpacing: 1,
                color: BT.text.muted, border: `1px solid ${BT.border.dim}`,
                borderRadius: 2, padding: '1px 4px',
              }}>COMING {method.placeholderVersion}</span>
            )}
            {isContested && contestedDivergences!.map(fd => (
              <ContestedBadge key={fd.fieldName} fieldName={fd.fieldName} divergence={fd.divergence} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
            <DirectionBadge dir={method.direction} />
            {!isPlaceholder && !isInsufficient && <ConfidenceBadge level={method.confidence} />}
          </div>
        </div>

        {/* Indicated value */}
        <div style={{ flex: '0 0 200px' }}>
          {isPlaceholder ? (
            <span style={{ fontFamily: MONO, fontSize: 11, color: BT.text.muted }}>—</span>
          ) : isInsufficient ? (
            <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.muted, maxWidth: 180, display: 'block' }}>
              {method.sourceProvenance}
            </span>
          ) : (
            <ValueRange
              p25={method.indicatedValueP25}
              p50={method.indicatedValueP50}
              p75={method.indicatedValueP75}
              ppu={method.indicatedPPU}
              psf={method.indicatedPSF}
              units={subject.units}
              totalSF={subject.totalSF}
            />
          )}
        </div>

        {/* vs Ask */}
        <div style={{ flex: '0 0 80px', textAlign: 'right' }}>
          {vsAskPct != null && (
            <span style={{
              fontFamily: MONO, fontSize: 11, fontWeight: 600,
              color: vsAskPct > 5 ? BT.text.green : vsAskPct < -5 ? BT.met.risk : BT.text.amber,
            }}>
              {fmtPct(vsAskPct)}
            </span>
          )}
        </div>

        {/* Sample / comp count */}
        <div style={{ flex: 1, textAlign: 'right' }}>
          {method.compCount != null && (
            <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>
              {method.relevanceFilteredCount != null && method.relevanceFilteredCount > 0
                ? `${(method.compCount ?? 0) + method.relevanceFilteredCount} comps (${method.compCount} after relevance filter)`
                : `${method.compCount} comps`}
            </span>
          )}
          {method.sampleSize != null && method.compCount == null && (
            <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>
              n={method.sampleSize}
            </span>
          )}
        </div>
      </div>

      {/* Warnings */}
      {method.warningFlags.length > 0 && !isPlaceholder && (
        <div style={{ marginTop: 4, paddingLeft: 22 }}>
          {method.warningFlags.map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginTop: 2 }}>
              <AlertTriangle size={10} style={{ color: BT.text.amber, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Placeholder tooltip */}
      {isPlaceholder && (
        <div style={{ marginTop: 4, paddingLeft: 22 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
            {method.sourceProvenance}
          </span>
        </div>
      )}

      <EvidencePanel lines={method.evidenceTrail} open={showEvidence} />
    </div>
  );
}

// ── Override Editor ────────────────────────────────────────────────────────────

function OverrideEditor({
  dealId, onSaved,
}: { dealId: string; onSaved: () => void }) {
  const [value, setValue] = useState('');
  const [rationale, setRationale] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const num = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (!num || num <= 0) { setError('Enter a valid positive value.'); return; }
    setSaving(true); setError(null);
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/valuation-grid/override`, {
        value: num, rationale: rationale || undefined,
      });
      onSaved();
      setValue(''); setRationale('');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      padding: '10px 14px', borderBottom: `1px solid ${BT.border.dim}`,
      backgroundColor: `${BT.bg.panel}44`,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.muted, width: 200 }}>
          Set Operator Override:
        </span>
        <input
          type="text"
          placeholder="e.g. 12500000"
          value={value}
          onChange={e => setValue(e.target.value)}
          style={{
            fontFamily: MONO, fontSize: 12, width: 140, padding: '4px 8px',
            backgroundColor: BT.bg.input ?? BT.bg.panel, border: `1px solid ${BT.border.normal}`,
            borderRadius: 3, color: BT.text.primary,
          }}
        />
        <input
          type="text"
          placeholder="Rationale (optional)"
          value={rationale}
          onChange={e => setRationale(e.target.value)}
          style={{
            fontFamily: MONO, fontSize: 11, width: 200, padding: '4px 8px',
            backgroundColor: BT.bg.input ?? BT.bg.panel, border: `1px solid ${BT.border.dim}`,
            borderRadius: 3, color: BT.text.secondary,
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving || !value}
          style={{
            fontFamily: MONO, fontSize: 11, padding: '4px 12px',
            backgroundColor: saving ? BT.bg.panel : BT.text.cyan,
            color: BT.bg.base ?? '#000', border: 'none', borderRadius: 3,
            cursor: saving || !value ? 'default' : 'pointer', fontWeight: 700,
          }}
        >{saving ? 'SAVING…' : 'SAVE'}</button>
      </div>
      {error && <div style={{ marginTop: 4, fontFamily: MONO, fontSize: 10, color: BT.met.risk }}>{error}</div>}
    </div>
  );
}

// ── Gap Analysis Panel ─────────────────────────────────────────────────────────

function GapAnalysisPanel({ items }: { items: GapAnalysisItem[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ padding: '12px 14px', borderTop: `1px solid ${BT.border.dim}` }}>
      <div style={{
        fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1,
        color: BT.text.muted, marginBottom: 8,
      }}>GAP ANALYSIS</div>
      {items.map((item, i) => (
        <div key={i} style={{
          padding: '8px 10px', marginBottom: 6,
          backgroundColor: `${BT.bg.panel}66`,
          borderLeft: `3px solid ${SEVERITY_COLOR[item.severity]}`,
          borderRadius: '0 4px 4px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700, color: SEVERITY_COLOR[item.severity],
            }}>{item.labelA} vs {item.labelB}</span>
            <span style={{
              fontFamily: MONO, fontSize: 10,
              color: item.deltaPct > 0 ? BT.text.green : BT.met.risk,
            }}>
              {fmtPct(item.deltaPct)}
            </span>
          </div>
          <p style={{
            fontFamily: MONO, fontSize: 10, color: BT.text.secondary,
            margin: 0, lineHeight: 1.5,
          }}>{item.driverText}</p>
        </div>
      ))}
    </div>
  );
}

// ── Staleness helpers ──────────────────────────────────────────────────────────

const STALENESS_COLOR: Record<StalenessLabel, string> = {
  fresh: BT.text.green,
  aging: BT.text.cyan,
  seasoned: BT.text.amber,
  stale: BT.met.risk,
};

function StalenessChip({ label }: { label: StalenessLabel }) {
  const color = STALENESS_COLOR[label];
  return (
    <span style={{
      fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: 1,
      color, border: `1px solid ${color}55`, borderRadius: 2, padding: '1px 4px',
      textTransform: 'uppercase',
    }}>{label}</span>
  );
}

// ── Convergence Banner ─────────────────────────────────────────────────────────

function ConvergenceBanner({
  signal, score, text, reconciledValue, priceLow, priceHigh, ppu, psf,
  valuationConfidence, valuationConfidenceText,
}: {
  signal: ConvergenceSignal; score: number; text: string;
  reconciledValue: number | null; priceLow: number | null; priceHigh: number | null;
  ppu: number | null; psf: number | null;
  valuationConfidence?: ConfidenceLevel;
  valuationConfidenceText?: string;
}) {
  const color = CONVERGENCE_COLOR[signal];
  const Icon = signal === 'CONVERGENT' ? CheckCircle
    : signal === 'MODERATE' ? AlertTriangle
    : TrendingDown;

  return (
    <div style={{
      padding: '12px 14px',
      borderBottom: `1px solid ${BT.border.dim}`,
      display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap',
      backgroundColor: `${color}0A`,
    }}>
      {/* Signal */}
      <div style={{ flex: '0 0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Icon size={14} style={{ color }} />
          <span style={{
            fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color,
          }}>{signal}</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>
            ({(score * 100).toFixed(0)}% convergence)
          </span>
        </div>
        <p style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary, margin: 0, maxWidth: 360 }}>
          {text}
        </p>
      </div>

      {/* Reconciled value */}
      {reconciledValue != null && (
        <div style={{ borderLeft: `1px solid ${BT.border.dim}`, paddingLeft: 20 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1, color: BT.text.muted, marginBottom: 3 }}>
            RECONCILED VALUE
          </div>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: BT.text.primary }}>
            {fmt$(reconciledValue)}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            {ppu != null && <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>{fmtPPU(ppu)}</span>}
            {psf != null && <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>{fmtPSF(psf)}</span>}
          </div>
        </div>
      )}

      {/* Recommended range */}
      {priceLow != null && priceHigh != null && (
        <div style={{ borderLeft: `1px solid ${BT.border.dim}`, paddingLeft: 20 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1, color: BT.text.muted, marginBottom: 3 }}>
            RECOMMENDED RANGE
          </div>
          <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: BT.text.cyan }}>
            {fmt$(priceLow)} – {fmt$(priceHigh)}
          </div>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
            Confidence-weighted ± ½σ
          </span>
        </div>
      )}

      {/* Task #1417 (6.3): Valuation confidence */}
      {valuationConfidence && valuationConfidence !== 'INSUFFICIENT' && (
        <div style={{ borderLeft: `1px solid ${BT.border.dim}`, paddingLeft: 20 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1, color: BT.text.muted, marginBottom: 3 }}>
            VALUATION CONFIDENCE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <ShieldCheck size={12} style={{ color: CONFIDENCE_COLOR[valuationConfidence] }} />
            <span style={{
              fontFamily: MONO, fontSize: 12, fontWeight: 700,
              color: CONFIDENCE_COLOR[valuationConfidence],
            }}>{valuationConfidence}</span>
          </div>
          {valuationConfidenceText && (
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, maxWidth: 220 }}>
              {valuationConfidenceText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Task #1417 (6.1): Comp Review Panel ───────────────────────────────────────

function CompReviewPanel({ dealId, onClose, onRefreshGrid }: {
  dealId: string;
  onClose: () => void;
  onRefreshGrid: () => void;
}) {
  const [data, setData] = useState<CompReviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editCriteria, setEditCriteria] = useState(false);
  const [criteriaForm, setCriteriaForm] = useState<Partial<CompCriteria>>({});
  const [savingCriteria, setSavingCriteria] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/valuation-grid/comps`);
      if (res.data?.success) {
        setData(res.data.data);
        const c = res.data.data.criteria as CompCriteria;
        setCriteriaForm({
          radiusMiles: c.radiusMiles,
          maxAgeMonths: c.maxAgeMonths,
          minUnits: c.minUnits,
          maxUnits: c.maxUnits,
          minYearBuilt: c.minYearBuilt,
          maxYearBuilt: c.maxYearBuilt,
          propertyClasses: c.propertyClasses,
        });
      } else {
        setErr(res.data?.error ?? 'Failed to load comps');
      }
    } catch (e: any) {
      setErr(e.message ?? 'Network error');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const toggleComp = async (comp: CompReviewItem) => {
    setSavingId(comp.id);
    try {
      if (comp.excluded) {
        await apiClient.post(`/api/v1/deals/${dealId}/valuation-grid/comps/${comp.id}/include`, {});
      } else {
        await apiClient.delete(`/api/v1/deals/${dealId}/valuation-grid/comps/${comp.id}`);
      }
      await load();
      onRefreshGrid();
    } catch {}
    setSavingId(null);
  };

  const addComp = async (comp: CompReviewItem) => {
    setSavingId(comp.id);
    try {
      await apiClient.post(`/api/v1/deals/${dealId}/valuation-grid/comps/${comp.id}/add`, {});
      await load();
      onRefreshGrid();
    } catch {}
    setSavingId(null);
  };

  const saveCriteria = async () => {
    setSavingCriteria(true);
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/valuation-grid/comps/criteria`, criteriaForm);
      setEditCriteria(false);
      await load();
      onRefreshGrid();
    } catch {}
    setSavingCriteria(false);
  };

  const activeComps = data?.comps.filter(c => !c.excluded) ?? [];
  const excludedComps = data?.comps.filter(c => c.excluded) ?? [];
  const candidates = data?.additionalCandidates ?? [];

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: BT.bg.base, zIndex: 50, display: 'flex', flexDirection: 'column',
      border: `1px solid ${BT.border.normal}`,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: `1px solid ${BT.border.normal}`,
        backgroundColor: BT.bg.panel,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={12} style={{ color: BT.text.cyan }} />
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: BT.text.primary }}>
            COMP REVIEW
          </span>
          {data && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
              {activeComps.length} active · {excludedComps.length} excluded · {data.staleCount} stale
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setEditCriteria(v => !v)}
            style={{
              background: editCriteria ? `${BT.text.cyan}22` : 'none',
              border: `1px solid ${editCriteria ? BT.text.cyan : BT.border.dim}`,
              borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              color: editCriteria ? BT.text.cyan : BT.text.muted,
            }}
          >
            <Filter size={9} />
            <span style={{ fontFamily: MONO, fontSize: 9 }}>CRITERIA</span>
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: `1px solid ${BT.border.dim}`,
              borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, color: BT.text.muted,
            }}
          >
            <X size={10} />
          </button>
        </div>
      </div>

      {/* Criteria editor */}
      {editCriteria && data && (
        <div style={{
          padding: '10px 14px', borderBottom: `1px solid ${BT.border.dim}`,
          backgroundColor: `${BT.text.cyan}08`,
          display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          {/* Radius */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: BT.text.muted, marginBottom: 3 }}>RADIUS (mi)</div>
            <input
              type="number" min={0.5} max={50} step={0.5}
              value={criteriaForm.radiusMiles ?? data.criteria.radiusMiles}
              onChange={e => setCriteriaForm(f => ({ ...f, radiusMiles: parseFloat(e.target.value) }))}
              style={{
                fontFamily: MONO, fontSize: 11, width: 70,
                background: BT.bg.input ?? BT.bg.panel, border: `1px solid ${BT.border.normal}`,
                borderRadius: 3, padding: '3px 6px', color: BT.text.primary,
              }}
            />
          </div>
          {/* Max age */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: BT.text.muted, marginBottom: 3 }}>MAX AGE (mo)</div>
            <input
              type="number" min={6} max={120} step={6}
              value={criteriaForm.maxAgeMonths ?? data.criteria.maxAgeMonths}
              onChange={e => setCriteriaForm(f => ({ ...f, maxAgeMonths: parseInt(e.target.value) }))}
              style={{
                fontFamily: MONO, fontSize: 11, width: 70,
                background: BT.bg.input ?? BT.bg.panel, border: `1px solid ${BT.border.normal}`,
                borderRadius: 3, padding: '3px 6px', color: BT.text.primary,
              }}
            />
          </div>
          {/* Min/max units */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: BT.text.muted, marginBottom: 3 }}>MIN UNITS</div>
            <input
              type="number" min={0} max={9999} step={10}
              value={criteriaForm.minUnits ?? data.criteria.minUnits}
              onChange={e => setCriteriaForm(f => ({ ...f, minUnits: parseInt(e.target.value) || 0 }))}
              style={{
                fontFamily: MONO, fontSize: 11, width: 65,
                background: BT.bg.input ?? BT.bg.panel, border: `1px solid ${BT.border.normal}`,
                borderRadius: 3, padding: '3px 6px', color: BT.text.primary,
              }}
            />
          </div>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: BT.text.muted, marginBottom: 3 }}>MAX UNITS</div>
            <input
              type="number" min={1} max={9999} step={50}
              value={criteriaForm.maxUnits ?? data.criteria.maxUnits}
              onChange={e => setCriteriaForm(f => ({ ...f, maxUnits: parseInt(e.target.value) || 9999 }))}
              style={{
                fontFamily: MONO, fontSize: 11, width: 65,
                background: BT.bg.input ?? BT.bg.panel, border: `1px solid ${BT.border.normal}`,
                borderRadius: 3, padding: '3px 6px', color: BT.text.primary,
              }}
            />
          </div>
          {/* Property class toggles */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: BT.text.muted, marginBottom: 3 }}>PROP CLASS</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['A', 'B', 'C', 'D'] as const).map(cls => {
                const currentClasses = criteriaForm.propertyClasses ?? data.criteria.propertyClasses;
                const active = currentClasses.includes(cls);
                return (
                  <button
                    key={cls}
                    onClick={() => {
                      const next = active
                        ? currentClasses.filter(c => c !== cls)
                        : [...currentClasses, cls];
                      setCriteriaForm(f => ({ ...f, propertyClasses: next }));
                    }}
                    style={{
                      fontFamily: MONO, fontSize: 9, padding: '2px 7px',
                      background: active ? `${BT.text.cyan}22` : 'none',
                      border: `1px solid ${active ? BT.text.cyan : BT.border.dim}`,
                      borderRadius: 3, cursor: 'pointer',
                      color: active ? BT.text.cyan : BT.text.muted,
                    }}
                  >
                    {cls}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Vintage band */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: BT.text.muted, marginBottom: 3 }}>MIN YR BUILT</div>
            <input
              type="number" min={1900} max={2100} step={5}
              value={criteriaForm.minYearBuilt ?? data.criteria.minYearBuilt ?? 0}
              onChange={e => setCriteriaForm(f => ({ ...f, minYearBuilt: parseInt(e.target.value) || 0 }))}
              placeholder="0"
              style={{
                fontFamily: MONO, fontSize: 11, width: 70,
                background: BT.bg.input ?? BT.bg.panel, border: `1px solid ${BT.border.normal}`,
                borderRadius: 3, padding: '3px 6px', color: BT.text.primary,
              }}
            />
          </div>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: BT.text.muted, marginBottom: 3 }}>MAX YR BUILT</div>
            <input
              type="number" min={1900} max={2100} step={5}
              value={criteriaForm.maxYearBuilt ?? data.criteria.maxYearBuilt ?? 9999}
              onChange={e => setCriteriaForm(f => ({ ...f, maxYearBuilt: parseInt(e.target.value) || 9999 }))}
              placeholder="9999"
              style={{
                fontFamily: MONO, fontSize: 11, width: 70,
                background: BT.bg.input ?? BT.bg.panel, border: `1px solid ${BT.border.normal}`,
                borderRadius: 3, padding: '3px 6px', color: BT.text.primary,
              }}
            />
          </div>
          <button
            onClick={saveCriteria}
            disabled={savingCriteria}
            style={{
              fontFamily: MONO, fontSize: 9, padding: '4px 12px',
              background: BT.text.cyan, color: BT.bg.base,
              border: 'none', borderRadius: 3, cursor: 'pointer',
            }}
          >
            {savingCriteria ? 'SAVING…' : 'APPLY'}
          </button>
        </div>
      )}

      {/* Body */}
      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>Loading comp pool…</span>
        </div>
      )}
      {err && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: BT.met.risk }}>{err}</span>
        </div>
      )}
      {!loading && !err && data && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Column headers */}
          <div style={{
            display: 'grid', padding: '5px 14px',
            gridTemplateColumns: '2fr 60px 70px 80px 80px 80px 80px 40px 55px',
            gap: 8, borderBottom: `1px solid ${BT.border.normal}`,
            backgroundColor: BT.bg.panel,
          }}>
            {['ADDRESS', 'UNITS', 'YR BUILT', 'SALE DATE', 'SALE PRICE', 'PPU', 'CAP RATE', 'AGE', ''].map(h => (
              <div key={h} style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: BT.text.muted }}>{h}</div>
            ))}
          </div>

          {/* Active comps */}
          {activeComps.length === 0 && excludedComps.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>
                No comps found within {data.criteria.radiusMiles}mi. Try widening the search radius.
              </span>
            </div>
          )}

          {activeComps.map(comp => (
            <CompRow key={comp.id} comp={comp} saving={savingId === comp.id} onToggle={() => toggleComp(comp)} />
          ))}

          {/* Excluded comps */}
          {excludedComps.length > 0 && (
            <>
              <div style={{
                padding: '5px 14px', borderTop: `1px solid ${BT.border.normal}`,
                backgroundColor: BT.bg.panel,
                fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: BT.text.muted,
              }}>
                EXCLUDED BY OPERATOR ({excludedComps.length})
              </div>
              {excludedComps.map(comp => (
                <CompRow key={comp.id} comp={comp} saving={savingId === comp.id} onToggle={() => toggleComp(comp)} />
              ))}
            </>
          )}

          {/* Additional candidates for manual add */}
          {candidates.length > 0 && (
            <>
              <div
                onClick={() => setShowCandidates(v => !v)}
                style={{
                  padding: '6px 14px', borderTop: `1px solid ${BT.border.normal}`,
                  backgroundColor: BT.bg.panel, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: BT.text.secondary }}>
                  ADDITIONAL CANDIDATES ({candidates.length}) — {showCandidates ? 'HIDE ▲' : 'SHOW ▼'}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                  comps within {(data.criteria.radiusMiles * 1.5).toFixed(1)}mi not in scoring set
                </span>
              </div>
              {showCandidates && candidates.map(comp => (
                <CompRow
                  key={comp.id}
                  comp={comp}
                  saving={savingId === comp.id}
                  onToggle={() => {}}
                  onAdd={() => addComp(comp)}
                  isCandidate
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const TIER_COLOR: Record<string, string> = {
  C1: '#06b6d4',  // cyan
  C2: '#22c55e',  // green
  M1: '#f59e0b',  // amber
  M2: '#64748b',  // muted slate
};

// ── Task #1804: PSF Gate Chip ──────────────────────────────────────────────────

const PSF_GATE_LABEL: Record<string, string> = {
  sqft:       'SQFT',
  similarity: 'SIM',
  stories:    'STRY',
};

function PsfGateChip({ gate }: { gate: PsfGateResult | null }) {
  if (!gate) return null;

  if (gate.forced) {
    return (
      <span
        title="Force-included by operator — PSF gates bypassed"
        style={{
          fontFamily: MONO, fontSize: 7, letterSpacing: 1, fontWeight: 700,
          color: BT.text.cyan, border: `1px solid ${BT.text.cyan}55`,
          borderRadius: 2, padding: '0px 3px', cursor: 'help',
          display: 'inline-flex', alignItems: 'center', gap: 2,
        }}
      >
        PSF FORCED
      </span>
    );
  }

  if (gate.passed) {
    return (
      <span
        title="Passes all PSF gate filters (sqft validity, similarity, stories)"
        style={{
          fontFamily: MONO, fontSize: 7, letterSpacing: 1, fontWeight: 700,
          color: BT.text.green, border: `1px solid ${BT.text.green}55`,
          borderRadius: 2, padding: '0px 3px', cursor: 'help',
          display: 'inline-flex', alignItems: 'center', gap: 2,
        }}
      >
        PSF ✓
      </span>
    );
  }

  const gateLabel = gate.failedGate ? (PSF_GATE_LABEL[gate.failedGate] ?? gate.failedGate.toUpperCase()) : '?';
  const tooltip = gate.reason
    ? `PSF gate failed (${gate.failedGate}): ${gate.reason}`
    : `PSF gate failed (${gate.failedGate})`;

  return (
    <span
      title={tooltip}
      style={{
        fontFamily: MONO, fontSize: 7, letterSpacing: 1, fontWeight: 700,
        color: BT.met.risk, border: `1px solid ${BT.met.risk}55`,
        borderRadius: 2, padding: '0px 3px', cursor: 'help',
        display: 'inline-flex', alignItems: 'center', gap: 2,
      }}
    >
      PSF ✗ {gateLabel}
    </span>
  );
}

function CompRow({ comp, saving, onToggle, onAdd, isCandidate }: {
  comp: CompReviewItem;
  saving: boolean;
  onToggle: () => void;
  onAdd?: () => void;
  isCandidate?: boolean;
}) {
  const fmtDate = (d: string | null) => d ? d.slice(0, 7) : '—';
  const fmtCap = (v: number | null) => v == null ? '—' : `${(v * 100).toFixed(2)}%`;
  const tierColor = comp.relevance_tier ? (TIER_COLOR[comp.relevance_tier] ?? BT.text.muted) : null;

  return (
    <div style={{
      display: 'grid', padding: '6px 14px',
      gridTemplateColumns: '2fr 60px 70px 80px 80px 80px 80px 40px 55px',
      gap: 8, alignItems: 'center',
      borderBottom: `1px solid ${BT.border.dim}`,
      backgroundColor: comp.excluded
        ? `${BT.met.risk}08`
        : isCandidate ? `${BT.text.cyan}05` : 'transparent',
      opacity: comp.excluded ? 0.65 : 1,
    }}>
      {/* Address */}
      <div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: comp.excluded ? BT.text.muted : BT.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {comp.address}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <StalenessChip label={comp.staleness_label} />
          {comp.relevance_tier && tierColor && (
            <span style={{
              fontFamily: MONO, fontSize: 7, letterSpacing: 1,
              color: tierColor, border: `1px solid ${tierColor}44`,
              borderRadius: 2, padding: '0px 3px',
            }} title={`Relevance tier: ${comp.relevance_tier}${comp.relevance_score != null ? ` (score: ${comp.relevance_score.toFixed(2)})` : ''}`}>
              {comp.relevance_tier}
            </span>
          )}
          <PsfGateChip gate={comp.psf_gate ?? null} />
          {comp.manually_added && (
            <span style={{
              fontFamily: MONO, fontSize: 7, letterSpacing: 1, color: BT.text.cyan,
              border: `1px solid ${BT.text.cyan}44`, borderRadius: 2, padding: '0px 3px',
            }}>ADDED</span>
          )}
          {comp.distance_miles != null && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{comp.distance_miles.toFixed(1)}mi</span>
          )}
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{comp.source}</span>
        </div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary }}>{comp.units ?? '—'}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary }}>{comp.year_built ?? '—'}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary }}>{fmtDate(comp.sale_date)}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.primary }}>{fmt$(comp.sale_price)}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary }}>{fmtPPU(comp.price_per_unit)}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.secondary }}>{fmtCap(comp.implied_cap_rate)}</div>
      {/* AGE column (months since sale) */}
      <div style={{
        fontFamily: MONO, fontSize: 10,
        color: comp.staleness_label === 'stale' ? BT.met.risk
          : comp.staleness_label === 'seasoned' ? BT.text.amber
          : BT.text.secondary,
      }}>
        {comp.age_months > 900 ? '—' : `${comp.age_months}mo`}
      </div>
      {/* Action column */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {isCandidate ? (
          <button
            onClick={onAdd}
            disabled={saving}
            title="Add this comp to the scoring set"
            style={{
              background: 'none', border: `1px solid ${BT.text.cyan}44`,
              borderRadius: 3, padding: '2px 6px', cursor: 'pointer',
              color: BT.text.cyan, fontFamily: MONO, fontSize: 8,
              display: 'flex', alignItems: 'center', gap: 3,
            }}
          >
            {saving ? '…' : '+ ADD'}
          </button>
        ) : (
          <button
            onClick={onToggle}
            disabled={saving}
            title={comp.excluded ? 'Re-include this comp' : 'Exclude this comp'}
            style={{
              background: 'none', border: `1px solid ${comp.excluded ? BT.text.green : BT.met.risk}44`,
              borderRadius: 3, padding: '2px 6px', cursor: 'pointer',
              color: comp.excluded ? BT.text.green : BT.met.risk,
              display: 'flex', alignItems: 'center', gap: 3,
            }}
          >
            {saving ? '…' : comp.excluded ? <Eye size={9} /> : <EyeOff size={9} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Subject Summary Bar ────────────────────────────────────────────────────────

function SubjectSummary({ subject, purchasePrice }: { subject: SubjectProperty; purchasePrice: number | null }) {
  const fields: [string, string][] = [
    ['LOCATION', subject.submarket ?? `${subject.city}, ${subject.state}`],
    ['UNITS', subject.units ? String(subject.units) : '—'],
    ['TOTAL SF', subject.totalSF ? subject.totalSF.toLocaleString() : '—'],
    ['ASSET CLASS', subject.assetClass ?? '—'],
    ['NOI', subject.noi ? fmt$(subject.noi) : '—'],
    ['NOI SOURCE', subject.noiSource.replace('_', ' ').toUpperCase()],
    ['ASK PRICE', purchasePrice ? fmt$(purchasePrice) : '—'],
  ];
  return (
    <div style={{
      padding: '8px 14px', display: 'flex', gap: 20, flexWrap: 'wrap',
      borderBottom: `1px solid ${BT.border.dim}`, backgroundColor: `${BT.bg.panel}33`,
    }}>
      {fields.map(([label, val]) => (
        <div key={label}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: BT.text.muted }}>{label}</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: BT.text.primary }}>{val}</div>
        </div>
      ))}
    </div>
  );
}

// ── Column Headers ─────────────────────────────────────────────────────────────

function GridHeader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 14px',
      borderBottom: `1px solid ${BT.border.normal}`,
      backgroundColor: BT.bg.panel,
    }}>
      <div style={{ flex: '0 0 22px' }} />
      <div style={{ flex: '0 0 200px', fontFamily: MONO, fontSize: 9, letterSpacing: 1, color: BT.text.muted }}>
        METHOD
      </div>
      <div style={{ flex: '0 0 200px', fontFamily: MONO, fontSize: 9, letterSpacing: 1, color: BT.text.muted }}>
        INDICATED VALUE  P25 – P75
      </div>
      <div style={{ flex: '0 0 80px', fontFamily: MONO, fontSize: 9, letterSpacing: 1, color: BT.text.muted, textAlign: 'right' }}>
        VS ASK
      </div>
      <div style={{ flex: 1, fontFamily: MONO, fontSize: 9, letterSpacing: 1, color: BT.text.muted, textAlign: 'right' }}>
        SAMPLE
      </div>
    </div>
  );
}

// CoStar upload panel moved to Documents Vault (CoStarDataPanel component).

// ── Main Tab ───────────────────────────────────────────────────────────────────

export function ValuationGridTab({ dealId, deal }: FinancialEngineTabProps) {
  const [data, setData] = useState<ValuationGridResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOverrideEditor, setShowOverrideEditor] = useState(false);
  const [showCompReview, setShowCompReview] = useState(false);
  const [costarMissing, setCostarMissing] = useState(false);
  const [divergences, setDivergences] = useState<FieldDivergence[]>([]);
  const [storiesInput, setStoriesInput] = useState('');
  const [storiesSaving, setStoriesSaving] = useState(false);
  const [storiesSavedLocally, setStoriesSavedLocally] = useState<number | null>(null);
  const [storiesSaveError, setStoriesSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    apiClient.get<any>(`/api/v1/deals/${dealId}/completeness`).then(r => {
      const signals: Array<{ id: string; status: string; acknowledged: boolean }> =
        r?.data?.signals ?? [];
      const costar = signals.find(s => s.id === 'costar_upload_missing');
      setCostarMissing(!!costar && costar.status !== 'complete' && !costar.acknowledged);
    }).catch(() => { /* non-critical */ });
  }, [dealId]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    setDivergences([]);
    try {
      const [gridRes, divRes] = await Promise.allSettled([
        apiClient.get(`/api/v1/deals/${dealId}/valuation-grid`),
        apiClient.get(`/api/v1/deals/${dealId}/field-divergences`),
      ]);
      if (gridRes.status === 'fulfilled') {
        setData(gridRes.value.data.data ?? gridRes.value.data);
      } else {
        throw gridRes.reason;
      }
      if (divRes.status === 'fulfilled' && divRes.value.data?.success) {
        setDivergences(divRes.value.data.data ?? []);
      }
      // On divergence fetch failure, divergences stays [] (cleared above) — no stale badges
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to load valuation grid.');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  /**
   * Build a map of methodId → contested FieldDivergence objects.
   * A field is contested when its divergence.exceeds === true.
   */
  const contestedByMethod = React.useMemo<Partial<Record<MethodId, FieldDivergence[]>>>(() => {
    if (!divergences.length) return {};
    const exceededMap = new Map<string, FieldDivergence>(
      divergences.filter(d => d.divergence.exceeds).map(d => [d.fieldName, d]),
    );
    const result: Partial<Record<MethodId, FieldDivergence[]>> = {};
    for (const [methodId, fields] of Object.entries(CONTESTED_FIELD_MAP) as [MethodId, string[]][]) {
      const hit = fields.map(f => exceededMap.get(f)).filter((d): d is FieldDivergence => d != null);
      if (hit.length > 0) result[methodId] = hit;
    }
    return result;
  }, [divergences]);

  useEffect(() => { load(); }, [load]);

  const handleStoriesSave = useCallback(async () => {
    const val = parseInt(storiesInput, 10);
    if (isNaN(val) || val < 1 || val > 200) return;
    setStoriesSaving(true);
    setStoriesSaveError(null);
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/property`, { stories: val });
      setStoriesSavedLocally(val);
      setStoriesInput('');
      // Reload the grid so the PSF similarity filter activates immediately
      load();
    } catch (err: any) {
      setStoriesSaveError(err?.response?.data?.error ?? err?.message ?? 'Save failed');
    } finally {
      setStoriesSaving(false);
    }
  }, [dealId, storiesInput, load]);

  const purchasePrice = data?.subject?.purchasePrice ?? null;

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <RefreshCw size={18} style={{ color: BT.text.muted, animation: 'spin 1s linear infinite' }} />
        <p style={{ fontFamily: MONO, fontSize: 11, color: BT.text.muted, marginTop: 10 }}>
          Computing valuation methods…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <AlertTriangle size={16} style={{ color: BT.met.risk }} />
          <span style={{ fontFamily: MONO, fontSize: 12, color: BT.met.risk }}>
            Valuation Grid Error
          </span>
        </div>
        <p style={{ fontFamily: MONO, fontSize: 11, color: BT.text.muted }}>{error}</p>
        <button onClick={load} style={{
          fontFamily: MONO, fontSize: 11, padding: '6px 14px',
          backgroundColor: BT.bg.panel, border: `1px solid ${BT.border.normal}`,
          color: BT.text.secondary, borderRadius: 3, cursor: 'pointer',
        }}>↻ Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const rec = data.reconciliation;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', position: 'relative' }}>

      {/* Task #1417 (6.1): Comp Review overlay */}
      {showCompReview && (
        <CompReviewPanel
          dealId={dealId}
          onClose={() => setShowCompReview(false)}
          onRefreshGrid={load}
        />
      )}

      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', borderBottom: `1px solid ${BT.border.normal}`,
        backgroundColor: BT.bg.panel,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: BT.text.primary, letterSpacing: 1 }}>
            ⊡ VALUATION GRID
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
            {rec.activeMethodCount} active method{rec.activeMethodCount !== 1 ? 's' : ''}  ·  V0.1
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowCompReview(p => !p)}
            title="Review and manage comp pool"
            style={{
              background: showCompReview ? `${BT.text.cyan}22` : 'none',
              border: `1px solid ${showCompReview ? BT.text.cyan : BT.border.dim}`,
              borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              color: showCompReview ? BT.text.cyan : BT.text.muted,
            }}
          >
            <Filter size={10} />
            <span style={{ fontFamily: MONO, fontSize: 9 }}>COMP REVIEW</span>
          </button>
          <button
            onClick={() => { setShowOverrideEditor(p => !p); }}
            title="Set operator override value"
            style={{
              background: 'none', border: `1px solid ${BT.border.dim}`,
              borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              color: BT.text.muted,
            }}
          >
            <Edit3 size={10} />
            <span style={{ fontFamily: MONO, fontSize: 9 }}>OVERRIDE</span>
          </button>
          <button
            onClick={load}
            title="Refresh"
            style={{
              background: 'none', border: `1px solid ${BT.border.dim}`,
              borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              color: BT.text.muted,
            }}
          >
            <RefreshCw size={10} />
            <span style={{ fontFamily: MONO, fontSize: 9 }}>REFRESH</span>
          </button>
        </div>
      </div>

      {/* ── CoStar gating banner — shown when no CoStar export has been uploaded ── */}
      {costarMissing && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          padding: '5px 12px',
          background: '#F5A62308',
          borderBottom: `1px solid #F5A62333`,
          fontFamily: MONO,
        }}>
          <span style={{ fontSize: 10, color: '#F5A623' }}>△</span>
          <span style={{ fontSize: 8, color: '#F5A623', fontWeight: 700, letterSpacing: 0.5 }}>
            NO COSTAR UPLOAD
          </span>
          <span style={{ fontSize: 8, color: '#94A3B8' }}>
            · Market rent and cap-rate comps are platform estimates only. Upload a CoStar export to populate this view with vendor data.
          </span>
          <a
            href={`?tab=documents`}
            style={{
              marginLeft: 'auto', fontSize: 7.5, fontWeight: 700, color: '#F5A623',
              letterSpacing: 0.5, textDecoration: 'none',
              padding: '1px 6px', border: '1px solid #F5A62344', flexShrink: 0,
            }}
          >
            UPLOAD COSTAR →
          </a>
        </div>
      )}

      {/* Subject summary */}
      <SubjectSummary subject={data.subject} purchasePrice={purchasePrice} />

      {/* ── Missing stories prompt — shown when PSF comps exist but stories is unset ── */}
      {(() => {
        const storiesMissing = data.subjectCompleteness?.missingFields?.some(f => f.field === 'stories');
        if (!storiesMissing || storiesSavedLocally != null) return null;
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            padding: '5px 12px',
            background: '#A78BFA08',
            borderBottom: `1px solid #A78BFA33`,
            fontFamily: MONO,
          }}>
            <span style={{ fontSize: 10, color: '#A78BFA' }}>◈</span>
            <span style={{ fontSize: 8, color: '#A78BFA', fontWeight: 700, letterSpacing: 0.5 }}>
              STORIES NOT SET
            </span>
            <span style={{ fontSize: 8, color: '#94A3B8' }}>
              · Enter building stories to activate the ±3-stories PSF comp similarity filter
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
              <input
                type="number"
                min={1}
                max={200}
                placeholder="# floors"
                value={storiesInput}
                onChange={e => setStoriesInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleStoriesSave(); }}
                style={{
                  width: 68, background: '#0D1117', border: '1px solid #A78BFA44',
                  borderRadius: 2, color: '#E8ECF1', fontFamily: MONO, fontSize: 9,
                  padding: '2px 5px', textAlign: 'right',
                }}
              />
              <button
                onClick={handleStoriesSave}
                disabled={storiesSaving || !storiesInput}
                style={{
                  fontSize: 7.5, fontWeight: 700, color: '#A78BFA',
                  letterSpacing: 0.5, background: 'none',
                  padding: '2px 7px', border: '1px solid #A78BFA44',
                  borderRadius: 2, cursor: storiesSaving ? 'default' : 'pointer',
                  opacity: (!storiesInput || storiesSaving) ? 0.45 : 1,
                  fontFamily: MONO,
                }}
              >
                {storiesSaving ? '…' : 'SAVE →'}
              </button>
            </div>
            {storiesSaveError && (
              <span style={{ fontSize: 7, fontFamily: MONO, color: '#FF4757', marginLeft: 4 }}>
                {storiesSaveError}
              </span>
            )}
          </div>
        );
      })()}

      {/* Convergence / reconciliation banner */}
      {rec.activeMethodCount > 0 && (
        <ConvergenceBanner
          signal={rec.convergenceSignal}
          score={rec.convergenceScore}
          text={rec.convergenceText}
          reconciledValue={rec.reconciledValue}
          priceLow={rec.recommendedPriceLow}
          priceHigh={rec.recommendedPriceHigh}
          ppu={rec.reconciledPPU}
          psf={rec.reconciledPSF}
          valuationConfidence={rec.valuationConfidence}
          valuationConfidenceText={rec.valuationConfidenceText}
        />
      )}


      {/* Override editor (expandable) */}
      {showOverrideEditor && (
        <OverrideEditor dealId={dealId} onSaved={() => { setShowOverrideEditor(false); load(); }} />
      )}

      {/* Grid header */}
      <GridHeader />

      {/* Method rows */}
      {data.methods.map(method => (
        <MethodRow
          key={method.id}
          method={method}
          subject={data.subject}
          purchasePrice={purchasePrice}
          contestedDivergences={contestedByMethod[method.id]}
        />
      ))}

      {/* Gap analysis */}
      {rec.gapAnalysis.length > 0 && <GapAnalysisPanel items={rec.gapAnalysis} />}

      {/* Footer */}
      <div style={{ padding: '8px 14px', borderTop: `1px solid ${BT.border.dim}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
            Computed {new Date(data.computedAt).toLocaleString()}  ·  Results are analytical, not a guarantee of value.
          </span>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { color: BT.text.green, label: 'BOTTOM-UP' },
              { color: BT.text.cyan, label: 'TOP-DOWN' },
              { color: BT.text.amber, label: 'COST' },
            ].map(item => (
              <span key={item.label} style={{ fontFamily: MONO, fontSize: 9, color: item.color }}>
                ● {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ValuationGridTab;
