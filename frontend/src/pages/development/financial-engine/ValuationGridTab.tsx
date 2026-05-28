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
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info, Edit3, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
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

// CoStar upload panel moved to Documents Vault (CoStarDataPanel component).

// ── Main Tab ───────────────────────────────────────────────────────────────────

export function ValuationGridTab({ dealId, deal }: FinancialEngineTabProps) {
  const [data, setData] = useState<ValuationGridResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOverrideEditor, setShowOverrideEditor] = useState(false);

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
