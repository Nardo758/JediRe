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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info, Edit3, RefreshCw, ChevronDown, ChevronRight, Upload, X } from 'lucide-react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { apiClient } from '../../../services/api.client';
import type { FinancialEngineTabProps } from './types';

const MONO = BT.font.mono;

// ── Types ──────────────────────────────────────────────────────────────────────

type MethodId =
  | 'cap_rate_noi' | 'per_unit_benchmark' | 'sales_comp_ppu' | 'sales_comp_psf'
  | 'operator_override' | 'replacement_cost' | 'grm' | 'gim' | 'dcf';

type MethodStatus = 'active' | 'insufficient' | 'placeholder';
type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
type ConvergenceSignal = 'CONVERGENT' | 'MODERATE' | 'DIVERGENT';

interface EvidenceLine { label: string; value: string; source?: string; }
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
interface ValuationGridResult {
  dealId: string; computedAt: string; subject: SubjectProperty;
  methods: ValuationMethod[];
  reconciliation: {
    convergenceScore: number; convergenceSignal: ConvergenceSignal;
    convergenceText: string;
    reconciledValue: number | null; reconciledPPU: number | null; reconciledPSF: number | null;
    recommendedPriceLow: number | null; recommendedPriceHigh: number | null;
    gapAnalysis: GapAnalysisItem[]; activeMethodCount: number;
  };
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

// ── Method Row ─────────────────────────────────────────────────────────────────

function MethodRow({
  method, subject, purchasePrice,
}: {
  method: ValuationMethod;
  subject: SubjectProperty;
  purchasePrice: number | null;
}) {
  const [showEvidence, setShowEvidence] = useState(false);

  const isPlaceholder = method.status === 'placeholder';
  const isInsufficient = method.status === 'insufficient';

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
              {method.compCount} comps
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

// ── Convergence Banner ─────────────────────────────────────────────────────────

function ConvergenceBanner({
  signal, score, text, reconciledValue, priceLow, priceHigh, ppu, psf,
}: {
  signal: ConvergenceSignal; score: number; text: string;
  reconciledValue: number | null; priceLow: number | null; priceHigh: number | null;
  ppu: number | null; psf: number | null;
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

// ── CoStar Upload Panel (Task #1392 — preview → review → commit) ──────────────

interface CommitResult {
  compType: 'sale' | 'rent';
  totalRows: number;
  inserted: number;
  skippedDup: number;
  skippedInvalid: number;
  errors: Array<{ row: number; address: string; reason: string }>;
  rejected: boolean;
  rejectReason?: string;
}

interface PreviewRow {
  rowIndex: number;
  propertyName: string | null;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  submarket: string | null;
  units: number | null;
  yearBuilt: number | null;
  assetClass: string | null;
  saleDate: string | null;
  salePrice: number | null;
  pricePerUnit: number | null;
  capRate: number | null;
  snapshotDate: string | null;
  avgAskingRent: number | null;
  avgEffectiveRent: number | null;
  occupancyPct: number | null;
  isValid: boolean;
  validationError: string | null;
  isDuplicate: boolean;
}

interface PreviewResult {
  compType: 'sale' | 'rent';
  detectedCompType: 'sale' | 'rent' | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: PreviewRow[];
  rejected: boolean;
  rejectReason?: string;
}

interface RowState {
  assetClass: string | null;
  excluded: boolean;
  overwriteDuplicate: boolean;
}

// ── Review Table ───────────────────────────────────────────────────────────────

function ReviewTable({
  preview,
  rowStates,
  onRowChange,
}: {
  preview: PreviewResult;
  rowStates: Map<number, RowState>;
  onRowChange: (rowIndex: number, patch: Partial<RowState>) => void;
}) {
  const isSale = preview.compType === 'sale';

  return (
    <div style={{ marginTop: 10 }}>
      {/* Scrollable wrapper — sticky header + scrollable body */}
      <div style={{ maxHeight: 340, overflowY: 'auto', overflowX: 'auto', border: `1px solid ${BT.border.dim}`, borderRadius: 3 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: MONO, minWidth: 640 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ backgroundColor: BT.bg.panel }}>
              <th style={TH}>INCL.</th>
              <th style={TH}>ADDRESS</th>
              <th style={TH}>CITY / ST</th>
              {isSale ? (
                <>
                  <th style={TH}>SALE DATE</th>
                  <th style={TH}>SALE PRICE</th>
                  <th style={TH}>PPU</th>
                  <th style={TH}>CAP%</th>
                </>
              ) : (
                <>
                  <th style={TH}>AVG ASK RENT</th>
                  <th style={TH}>AVG EFF RENT</th>
                  <th style={TH}>OCC%</th>
                </>
              )}
              <th style={TH}>CLASS</th>
              <th style={TH}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map(row => {
              const rs = rowStates.get(row.rowIndex) ?? {
                assetClass: row.assetClass,
                excluded: !row.isValid,
                overwriteDuplicate: false,
              };
              const isExcluded = rs.excluded;
              const rowBg = !row.isValid
                ? `${BT.met.risk}11`
                : row.isDuplicate
                ? `${BT.text.amber}11`
                : 'transparent';

              return (
                <tr key={row.rowIndex} style={{ backgroundColor: rowBg, opacity: isExcluded ? 0.45 : 1 }}>
                  {/* Include checkbox */}
                  <td style={TD}>
                    <input
                      type="checkbox"
                      checked={!isExcluded}
                      disabled={!row.isValid}
                      onChange={e => onRowChange(row.rowIndex, { excluded: !e.target.checked })}
                      style={{ cursor: row.isValid ? 'pointer' : 'not-allowed', accentColor: BT.text.cyan }}
                    />
                  </td>

                  {/* Address */}
                  <td style={{ ...TD, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span title={row.address}>{row.address}</span>
                  </td>

                  {/* City / State */}
                  <td style={TD}>{row.city}, {row.state}</td>

                  {/* Type-specific columns */}
                  {isSale ? (
                    <>
                      <td style={TD}>{row.saleDate ?? '—'}</td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {row.salePrice != null ? `$${row.salePrice.toLocaleString()}` : '—'}
                      </td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {row.pricePerUnit != null ? `$${Math.round(row.pricePerUnit).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {row.capRate != null ? `${row.capRate.toFixed(2)}%` : '—'}
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {row.avgAskingRent != null ? `$${Math.round(row.avgAskingRent).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {row.avgEffectiveRent != null ? `$${Math.round(row.avgEffectiveRent).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {row.occupancyPct != null ? `${row.occupancyPct.toFixed(1)}%` : '—'}
                      </td>
                    </>
                  )}

                  {/* Asset class dropdown */}
                  <td style={TD}>
                    <select
                      value={rs.assetClass ?? ''}
                      onChange={e => onRowChange(row.rowIndex, { assetClass: e.target.value || null })}
                      disabled={isExcluded}
                      style={{
                        fontFamily: MONO, fontSize: 10, padding: '2px 4px',
                        backgroundColor: rs.assetClass == null ? `${BT.text.amber}22` : BT.bg.panel,
                        border: `1px solid ${rs.assetClass == null ? BT.text.amber : BT.border.dim}`,
                        color: BT.text.secondary, borderRadius: 2,
                        cursor: isExcluded ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <option value="">—</option>
                      {['A', 'B', 'C', 'D'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>

                  {/* Status badge */}
                  <td style={TD}>
                    {!row.isValid ? (
                      <span style={{ color: BT.met.risk, fontSize: 9 }} title={row.validationError ?? ''}>
                        INVALID
                      </span>
                    ) : row.isDuplicate ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: BT.text.amber, fontSize: 9 }}>DUP</span>
                        {!isExcluded && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={rs.overwriteDuplicate}
                              onChange={e => onRowChange(row.rowIndex, { overwriteDuplicate: e.target.checked })}
                              style={{ accentColor: BT.text.amber }}
                            />
                            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber }}>OVR</span>
                          </label>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: BT.text.green, fontSize: 9 }}>OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 4, fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
        {preview.totalRows} row{preview.totalRows !== 1 ? 's' : ''} total
        {preview.duplicateRows > 0 && ` · ${preview.duplicateRows} duplicate${preview.duplicateRows !== 1 ? 's' : ''} detected`}
        {preview.invalidRows > 0 && ` · ${preview.invalidRows} invalid (auto-excluded)`}
      </div>
    </div>
  );
}

const TH: React.CSSProperties = {
  padding: '4px 8px', textAlign: 'left', fontFamily: MONO, fontSize: 8,
  letterSpacing: 1, color: BT.text.muted, fontWeight: 700,
  borderBottom: `1px solid ${BT.border.normal}`, whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = {
  padding: '4px 8px', fontFamily: MONO, fontSize: 10, color: BT.text.secondary,
  borderBottom: `1px solid ${BT.border.dim}`, whiteSpace: 'nowrap',
};

// ── Main Upload Panel ──────────────────────────────────────────────────────────

type UploadStep = 'select' | 'previewing' | 'review' | 'committing' | 'done';

function CoStarUploadPanel({
  dealId,
  onUploaded,
  onClose,
}: {
  dealId: string;
  onUploaded: () => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<UploadStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [compType, setCompType] = useState<'auto' | 'sale' | 'rent'>('auto');
  const [snapshotDate, setSnapshotDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [panelError, setPanelError] = useState<string | null>(null);

  // Preview state
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [rowStates, setRowStates] = useState<Map<number, RowState>>(new Map());

  // Commit result
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);

  function handleRowChange(rowIndex: number, patch: Partial<RowState>) {
    setRowStates(prev => {
      const next = new Map(prev);
      const existing = next.get(rowIndex);
      const base: RowState = existing ?? {
        assetClass: preview?.rows.find(r => r.rowIndex === rowIndex)?.assetClass ?? null,
        excluded: false,
        overwriteDuplicate: false,
      };
      next.set(rowIndex, { ...base, ...patch });
      return next;
    });
  }

  async function handlePreview() {
    if (!file) return;
    setStep('previewing');
    setPanelError(null);

    const fd = new FormData();
    fd.append('file', file);
    if (compType !== 'auto') fd.append('comp_type', compType);
    fd.append('snapshot_date', snapshotDate);

    try {
      const res = await apiClient.post(
        `/api/v1/deals/${dealId}/valuation-grid/comps/preview`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const p: PreviewResult = res.data.data ?? res.data;
      if (p.rejected) {
        setPanelError(p.rejectReason ?? 'Preview failed.');
        setStep('select');
        return;
      }
      // Initialise rowStates for invalid rows (auto-exclude them)
      const initial = new Map<number, RowState>();
      for (const row of p.rows) {
        if (!row.isValid) {
          initial.set(row.rowIndex, {
            assetClass: null,
            excluded: true,
            overwriteDuplicate: false,
          });
        }
      }
      setPreview(p);
      setRowStates(initial);
      setStep('review');
    } catch (e: any) {
      const serverData = e?.response?.data;
      if (serverData?.data?.rejected) {
        setPanelError(serverData.data.rejectReason ?? 'Preview failed.');
      } else {
        setPanelError(serverData?.error ?? e?.message ?? 'Preview failed.');
      }
      setStep('select');
    }
  }

  async function handleCommit() {
    if (!file || !preview) return;
    setStep('committing');
    setPanelError(null);

    // Build overrides array from rowStates
    const overrides: Array<{
      rowIndex: number;
      assetClass?: string | null;
      excluded: boolean;
      overwriteDuplicate: boolean;
    }> = [];

    for (const [rowIndex, rs] of rowStates.entries()) {
      overrides.push({ rowIndex, assetClass: rs.assetClass, excluded: rs.excluded, overwriteDuplicate: rs.overwriteDuplicate });
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('comp_type', preview.compType);
    fd.append('snapshot_date', snapshotDate);
    fd.append('overrides', JSON.stringify(overrides));

    try {
      const res = await apiClient.post(
        `/api/v1/deals/${dealId}/valuation-grid/comps/commit`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const r: CommitResult = res.data.data ?? res.data;
      setCommitResult(r);
      setStep('done');
      if (!r.rejected && r.inserted > 0) onUploaded();
    } catch (e: any) {
      const serverData = e?.response?.data?.data;
      if (serverData) {
        setCommitResult(serverData as CommitResult);
        setStep('done');
      } else {
        setPanelError(e?.response?.data?.error ?? e?.message ?? 'Commit failed.');
        setStep('review');
      }
    }
  }

  function reset() {
    setStep('select');
    setFile(null);
    setPreview(null);
    setRowStates(new Map());
    setCommitResult(null);
    setPanelError(null);
    setCompType('auto');
    if (fileRef.current) fileRef.current.value = '';
  }

  const isPreviewing = step === 'previewing';
  const isCommitting = step === 'committing';

  return (
    <div style={{
      padding: '12px 14px',
      borderBottom: `1px solid ${BT.border.dim}`,
      backgroundColor: `${BT.bg.panel}55`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: BT.text.cyan, letterSpacing: 1 }}>
            UPLOAD COSTAR COMPS
          </span>
          {(step === 'review' || step === 'committing') && preview && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
              {preview.totalRows} rows · {preview.validRows} valid · {preview.duplicateRows} dup
            </span>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BT.text.muted, display: 'flex', alignItems: 'center' }}>
          <X size={12} />
        </button>
      </div>

      {/* Error banner */}
      {panelError && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <AlertTriangle size={12} style={{ color: BT.met.risk, flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontFamily: MONO, fontSize: 10, color: BT.met.risk }}>{panelError}</span>
        </div>
      )}

      {/* ── Step 1: Select file ── */}
      {(step === 'select' || step === 'previewing') && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* File picker */}
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginBottom: 3 }}>FILE (CSV / XLSX)</div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: 'none' }}
                onChange={e => { setFile(e.target.files?.[0] ?? null); setPanelError(null); }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  fontFamily: MONO, fontSize: 10, padding: '4px 10px',
                  backgroundColor: BT.bg.panel, border: `1px solid ${BT.border.normal}`,
                  color: file ? BT.text.primary : BT.text.muted,
                  borderRadius: 3, cursor: 'pointer',
                }}
              >
                {file ? file.name : 'Choose file…'}
              </button>
            </div>

            {/* Comp type */}
            <div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginBottom: 3 }}>COMP TYPE</div>
              <select
                value={compType}
                onChange={e => setCompType(e.target.value as 'auto' | 'sale' | 'rent')}
                style={{
                  fontFamily: MONO, fontSize: 10, padding: '4px 8px',
                  backgroundColor: BT.bg.panel, border: `1px solid ${BT.border.normal}`,
                  color: BT.text.secondary, borderRadius: 3, cursor: 'pointer',
                }}
              >
                <option value="auto">Auto-detect</option>
                <option value="sale">Sale Comps</option>
                <option value="rent">Rent Comps</option>
              </select>
            </div>

            {/* Snapshot date — rent only */}
            {compType === 'rent' && (
              <div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginBottom: 3 }}>
                  AS-OF DATE <span style={{ color: BT.met.risk }}>*</span>
                </div>
                <input
                  type="date"
                  value={snapshotDate}
                  onChange={e => setSnapshotDate(e.target.value)}
                  style={{
                    fontFamily: MONO, fontSize: 10, padding: '4px 8px',
                    backgroundColor: BT.bg.panel, border: `1px solid ${BT.border.normal}`,
                    color: BT.text.secondary, borderRadius: 3,
                  }}
                />
              </div>
            )}

            <button
              onClick={handlePreview}
              disabled={isPreviewing || !file}
              style={{
                fontFamily: MONO, fontSize: 10, padding: '5px 14px', fontWeight: 700,
                backgroundColor: isPreviewing || !file ? BT.bg.panel : BT.text.cyan,
                color: isPreviewing || !file ? BT.text.muted : '#000',
                border: 'none', borderRadius: 3,
                cursor: isPreviewing || !file ? 'default' : 'pointer',
              }}
            >
              {isPreviewing ? 'PARSING…' : 'PREVIEW'}
            </button>
          </div>

          <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
            CoStar CSV/XLSX — Sale: requires Address, City, State, Sale Date, Sale Price.
            Rent: requires Address, City, State + As-of date.
          </div>
        </>
      )}

      {/* ── Step 2: Review table ── */}
      {(step === 'review' || step === 'committing') && preview && (
        <>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.green }}>● OK</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>
              ● DUP — existing comp with same address + date; check OVR to overwrite
            </span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.met.risk }}>
              ● INVALID — missing required fields; auto-excluded
            </span>
          </div>

          <ReviewTable
            preview={preview}
            rowStates={rowStates}
            onRowChange={handleRowChange}
          />

          {/* Action bar */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <button
              onClick={handleCommit}
              disabled={isCommitting}
              style={{
                fontFamily: MONO, fontSize: 10, padding: '5px 16px', fontWeight: 700,
                backgroundColor: isCommitting ? BT.bg.panel : BT.text.green,
                color: isCommitting ? BT.text.muted : '#000',
                border: 'none', borderRadius: 3,
                cursor: isCommitting ? 'default' : 'pointer',
              }}
            >
              {isCommitting ? 'COMMITTING…' : 'COMMIT'}
            </button>
            <button
              onClick={reset}
              disabled={isCommitting}
              style={{
                fontFamily: MONO, fontSize: 10, padding: '5px 12px',
                backgroundColor: BT.bg.panel, border: `1px solid ${BT.border.dim}`,
                color: BT.text.muted, borderRadius: 3,
                cursor: isCommitting ? 'default' : 'pointer',
              }}
            >
              BACK
            </button>
          </div>
        </>
      )}

      {/* ── Step 3: Done ── */}
      {step === 'done' && commitResult && (
        <div>
          {commitResult.rejected ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={12} style={{ color: BT.met.risk, flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: BT.met.risk, fontWeight: 700 }}>COMMIT REJECTED</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: BT.text.muted, marginTop: 2 }}>{commitResult.rejectReason}</div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
                {[
                  ['TYPE', commitResult.compType.toUpperCase()],
                  ['TOTAL ROWS', String(commitResult.totalRows)],
                  ['INSERTED', String(commitResult.inserted)],
                  ['SKIPPED (DUP)', String(commitResult.skippedDup)],
                  ['SKIPPED (INVALID)', String(commitResult.skippedInvalid)],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: BT.text.muted }}>{label}</div>
                    <div style={{
                      fontFamily: MONO, fontSize: 13, fontWeight: 700,
                      color: label === 'INSERTED' && Number(val) > 0 ? BT.text.green
                        : label === 'SKIPPED (INVALID)' && Number(val) > 0 ? BT.met.risk
                        : BT.text.primary,
                    }}>{val}</div>
                  </div>
                ))}
              </div>

              {commitResult.errors.length > 0 && (
                <div style={{
                  maxHeight: 100, overflowY: 'auto', padding: '6px 8px', marginBottom: 8,
                  backgroundColor: `${BT.bg.base}88`,
                  border: `1px solid ${BT.border.dim}`, borderRadius: 3,
                }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, marginBottom: 3 }}>
                    ROW ERRORS ({commitResult.errors.length})
                  </div>
                  {commitResult.errors.slice(0, 20).map((e, i) => (
                    <div key={i} style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, padding: '1px 0' }}>
                      Row {e.row} — {e.address}: {e.reason}
                    </div>
                  ))}
                  {commitResult.errors.length > 20 && (
                    <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
                      … and {commitResult.errors.length - 20} more
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={reset}
              style={{
                fontFamily: MONO, fontSize: 9, padding: '3px 10px',
                backgroundColor: BT.bg.panel, border: `1px solid ${BT.border.dim}`,
                color: BT.text.muted, borderRadius: 3, cursor: 'pointer',
              }}
            >
              UPLOAD ANOTHER
            </button>
            <button
              onClick={onClose}
              style={{
                fontFamily: MONO, fontSize: 9, padding: '3px 10px',
                backgroundColor: BT.bg.panel, border: `1px solid ${BT.border.dim}`,
                color: BT.text.muted, borderRadius: 3, cursor: 'pointer',
              }}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────────

export function ValuationGridTab({ dealId, deal }: FinancialEngineTabProps) {
  const [data, setData] = useState<ValuationGridResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOverrideEditor, setShowOverrideEditor] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/valuation-grid`);
      setData(res.data.data ?? res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to load valuation grid.');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
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
            onClick={() => { setShowUploadPanel(p => !p); setShowOverrideEditor(false); }}
            title="Upload CoStar comp export"
            style={{
              background: 'none', border: `1px solid ${showUploadPanel ? BT.text.cyan : BT.border.dim}`,
              borderRadius: 3, padding: '3px 8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              color: showUploadPanel ? BT.text.cyan : BT.text.muted,
            }}
          >
            <Upload size={10} />
            <span style={{ fontFamily: MONO, fontSize: 9 }}>UPLOAD COMPS</span>
          </button>
          <button
            onClick={() => { setShowOverrideEditor(p => !p); setShowUploadPanel(false); }}
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

      {/* Subject summary */}
      <SubjectSummary subject={data.subject} purchasePrice={purchasePrice} />

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
        />
      )}

      {/* CoStar upload panel (expandable) */}
      {showUploadPanel && (
        <CoStarUploadPanel
          dealId={dealId}
          onUploaded={() => { load(); }}
          onClose={() => setShowUploadPanel(false)}
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
