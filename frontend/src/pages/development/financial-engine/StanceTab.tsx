// ============================================================================
// StanceTab — OperatorStance panel for Console (#607 complete)
// ============================================================================
//
// 10 editable fields across 3 sections:
//   MASTER POSTURE  — underwritingPosture (the "one dial")
//   MACRO VIEW      — rateEnvironment, cyclePosition, recessionProbability
//   PER-DRIVER      — concessionStrategy, marketingIntensity, expenseGrowthPosture
//   STRESS OVERLAYS — stressRentGrowthHaircut, stressExitCapWiden, stressVacancyFloor
//
// Color convention (per spec):
//   CYAN  = operator input controls (dials, steppers)
//   AMBER = stance-flagged / affected-fields indicators
//
// Layout:
//   Top section   flexShrink:0, NO overflow — so position:absolute dropdowns
//                 render freely without ancestor clipping.
//   Bottom section flex:1, overflow:auto — affected fields panel + footer.
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { useDealStore } from '../../../stores/dealStore';
import { apiClient } from '../../../services/api.client';
import type {
  OperatorStance,
  OperatorStancePatch,
  UnderwritingPosture,
  RateEnvironment,
  CyclePosition,
  ConcessionStrategy,
  MarketingIntensity,
  ExpenseGrowthPosture,
  AffectedStanceField,
} from '../../../stores/dealContext.types';
import { LeasingCostTreatmentToggle, type LeasingCostTreatment } from './LeaseVelocitySection';
import type { FinancialEngineTabProps } from './types';

const MONO = BT.font.mono;
const CYAN  = BT.text.cyan;
const CYAN_DIM = `${CYAN}22`;
const AMBER = BT.text.amber;

// ─── Option arrays ─────────────────────────────────────────────────────────────

const UNDERWRITING_OPTS: { value: UnderwritingPosture; label: string; desc: string }[] = [
  { value: 'CONSERVATIVE', label: 'CONSERVATIVE', desc: 'Tight vacancy floors, wider exit cap, reduced rent growth' },
  { value: 'MARKET',       label: 'MARKET',       desc: 'Platform consensus — no modulation applied' },
  { value: 'AGGRESSIVE',   label: 'AGGRESSIVE',   desc: 'Lower vacancy, compressed exit cap, higher rent growth' },
];

const RATE_ENV_OPTS: { value: RateEnvironment; label: string; desc: string }[] = [
  { value: 'CUTTING',           label: 'CUTTING',           desc: 'Fed easing — tighter caps, rate-sensitive assumptions' },
  { value: 'NORMALIZING',       label: 'NORMALIZING',       desc: 'Transitional environment — platform defaults' },
  { value: 'HIGHER_FOR_LONGER', label: 'HIGHER FOR LONGER', desc: 'Elevated rates persist — debt stress, cap expansion' },
];

const CYCLE_OPTS: { value: CyclePosition; label: string; desc: string }[] = [
  { value: 'EARLY', label: 'EARLY CYCLE', desc: 'Recovery phase — favorable rent momentum, +50bps' },
  { value: 'MID',   label: 'MID CYCLE',   desc: 'Expansion peak — platform consensus' },
  { value: 'LATE',  label: 'LATE CYCLE',  desc: 'Contraction risk — haircuts applied to growth' },
];

const CONCESSION_OPTS: { value: ConcessionStrategy; label: string; desc: string }[] = [
  { value: 'CONSERVATIVE', label: 'CONSERVATIVE', desc: 'Slow concession burn-off — conservative lease-up pace' },
  { value: 'MARKET',       label: 'MARKET',       desc: 'Market-rate concession burn-off — platform default' },
  { value: 'AGGRESSIVE',   label: 'AGGRESSIVE',   desc: 'Fast concession burn-off — assume strong absorption' },
];

const MARKETING_OPTS: { value: MarketingIntensity; label: string; desc: string }[] = [
  { value: 'LOW',        label: 'LOW',        desc: 'Minimal marketing spend — organic absorption' },
  { value: 'MARKET',     label: 'MARKET',     desc: 'Standard lease-up marketing — platform default' },
  { value: 'AGGRESSIVE', label: 'AGGRESSIVE', desc: 'Heavy spend — accelerated absorption, higher G&A' },
];

const EXPENSE_OPTS: { value: ExpenseGrowthPosture; label: string; desc: string }[] = [
  { value: 'CONTAINED', label: 'CONTAINED', desc: 'Below-inflation opex discipline — -50bps vs baseline' },
  { value: 'INFLATION',  label: 'INFLATION', desc: 'CPI-tracked expense growth — platform default' },
  { value: 'STRESSED',   label: 'STRESSED',  desc: 'Insurance reset + supply shock — +100bps opex' },
];

// ─── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8,
      padding: '7px 14px 4px',
      background: BT.bg.header,
      borderBottom: `1px solid ${BT.border.subtle}`,
      borderTop: `1px solid ${BT.border.subtle}`,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 8, color: CYAN, letterSpacing: 1, fontWeight: 700 }}>
        {label}
      </span>
      {sub && (
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ─── Posture dropdown row ───────────────────────────────────────────────────────

interface PostureRowProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; desc: string }[];
  onChange: (v: T) => void;
  saving: boolean;
}

function PostureRow<T extends string>({ label, value, options, onChange, saving }: PostureRowProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <div style={{ borderBottom: `1px solid ${BT.border.subtle}`, padding: '9px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 1, marginBottom: 2 }}>
            {label}
          </div>
          {selected && (
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
              {selected.desc}
            </div>
          )}
        </div>

        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setOpen(p => !p)}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: CYAN_DIM,
              border: `1px solid ${CYAN}55`,
              color: CYAN,
              fontFamily: MONO, fontSize: 9, fontWeight: 700,
              padding: '4px 10px', borderRadius: 2,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.5 : 1, letterSpacing: 0.5,
            }}
          >
            {selected?.label ?? value}
            <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>
          </button>

          {open && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 2, zIndex: 200,
              background: BT.bg.panel, border: `1px solid ${CYAN}55`,
              borderRadius: 2, minWidth: 210, boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            }}>
              {options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: opt.value === value ? CYAN_DIM : 'transparent',
                    border: 'none',
                    borderLeft: opt.value === value ? `2px solid ${CYAN}` : '2px solid transparent',
                    color: opt.value === value ? CYAN : BT.text.secondary,
                    fontFamily: MONO, fontSize: 9, padding: '7px 10px', cursor: 'pointer',
                    letterSpacing: 0.3,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{opt.label}</div>
                  <div style={{ fontSize: 8, color: BT.text.muted, marginTop: 2 }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stress numeric row (bps / pp stepper) ────────────────────────────────────

interface StressRowProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  desc: string;
  onChange: (v: number) => void;
  saving: boolean;
}

function StressRow({ label, unit, value, min, max, step, desc, onChange, saving }: StressRowProps) {
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div style={{ borderBottom: `1px solid ${BT.border.subtle}`, padding: '9px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 1, marginBottom: 2 }}>
            {label}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>{desc}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => onChange(Math.max(min, value - step))}
            disabled={saving || atMin}
            style={{
              background: 'transparent', border: `1px solid ${CYAN}44`,
              color: atMin ? BT.text.muted : CYAN,
              fontFamily: MONO, fontSize: 11, width: 22, height: 22,
              cursor: saving || atMin ? 'default' : 'pointer', borderRadius: 2,
              opacity: atMin ? 0.3 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >−</button>

          <div style={{
            fontFamily: MONO, fontSize: 9, fontWeight: 700, color: value > 0 ? CYAN : BT.text.muted,
            minWidth: 52, textAlign: 'center',
            background: CYAN_DIM, border: `1px solid ${CYAN}44`,
            padding: '3px 6px', borderRadius: 2,
          }}>
            {value > 0 ? `+${value}` : value}{unit}
          </div>

          <button
            onClick={() => onChange(Math.min(max, value + step))}
            disabled={saving || atMax}
            style={{
              background: 'transparent', border: `1px solid ${CYAN}44`,
              color: atMax ? BT.text.muted : CYAN,
              fontFamily: MONO, fontSize: 11, width: 22, height: 22,
              cursor: saving || atMax ? 'default' : 'pointer', borderRadius: 2,
              opacity: atMax ? 0.3 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >+</button>
        </div>
      </div>
    </div>
  );
}

// ─── Base value numeric input row ─────────────────────────────────────────────

interface BaseValueRowProps {
  label: string;
  desc: string;
  currentValue: number | null;
  dealId: string;
  field: string;
  saving: boolean;
}

function BaseValueRow({ label, desc, currentValue, dealId, field, saving }: BaseValueRowProps) {
  const [editing, setEditing]     = useState(false);
  const [inputVal, setInputVal]   = useState('');
  const [localSaving, setLocalSaving] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = currentValue != null ? `${(currentValue * 100).toFixed(2)}%` : '—';

  const openEdit = () => {
    setInputVal(currentValue != null ? (currentValue * 100).toFixed(2) : '');
    setEditing(true);
    setError(null);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const save = async (clearOverride = false) => {
    const apiValue = clearOverride ? null : +(parseFloat(inputVal) / 100).toFixed(6);
    if (!clearOverride && (apiValue === null || isNaN(apiValue as number))) {
      setError('Enter a valid number');
      return;
    }
    setLocalSaving(true);
    setError(null);
    try {
      await apiClient.patch(`/api/v1/deals/${dealId}/financials/override`, {
        field, year: null, value: apiValue,
      });
      setEditing(false);
      window.dispatchEvent(new CustomEvent('assumption:changed', {
        detail: { source: 'stance_tab', field, value: apiValue },
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLocalSaving(false);
    }
  };

  return (
    <div style={{ borderBottom: `1px solid ${BT.border.subtle}`, padding: '9px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 1, marginBottom: 2 }}>
            {label}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>{desc}</div>
          {error && (
            <div style={{ fontFamily: MONO, fontSize: 8, color: '#FF4757', marginTop: 2 }}>{error}</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {editing ? (
            <>
              <input
                ref={inputRef}
                type="number"
                step="0.01"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter')  void save();
                  if (e.key === 'Escape') setEditing(false);
                }}
                style={{
                  background: CYAN_DIM, border: `1px solid ${CYAN}55`, color: CYAN,
                  fontFamily: MONO, fontSize: 9, width: 64,
                  padding: '3px 6px', borderRadius: 2, outline: 'none', textAlign: 'right',
                }}
              />
              <span style={{ fontFamily: MONO, fontSize: 9, color: CYAN }}>%</span>
              <button
                onClick={() => void save()}
                disabled={localSaving}
                style={{
                  background: CYAN_DIM, border: `1px solid ${CYAN}55`, color: CYAN,
                  fontFamily: MONO, fontSize: 8, padding: '3px 7px', borderRadius: 2, cursor: 'pointer',
                }}
              >{localSaving ? '…' : '✓'}</button>
              <button
                onClick={() => void save(true)}
                disabled={localSaving}
                title="Clear override — revert to platform default"
                style={{
                  background: 'transparent', border: `1px solid ${BT.border.medium}`,
                  color: BT.text.muted, fontFamily: MONO, fontSize: 8,
                  padding: '3px 5px', borderRadius: 2, cursor: 'pointer',
                }}
              >✕</button>
            </>
          ) : (
            <button
              onClick={openEdit}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: CYAN_DIM, border: `1px solid ${CYAN}55`, color: CYAN,
                fontFamily: MONO, fontSize: 9, fontWeight: 700,
                padding: '4px 10px', borderRadius: 2,
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.5 : 1, letterSpacing: 0.5,
              }}
            >
              {displayValue}
              <span style={{ fontSize: 8, opacity: 0.7 }}>✎</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Affected fields panel ─────────────────────────────────────────────────────

interface AffectedFieldsProps {
  dealId: string;
  stanceUpdatedAt: string | null;
}

function AffectedFieldsPanel({ dealId, stanceUpdatedAt }: AffectedFieldsProps) {
  const [fields, setFields] = useState<AffectedStanceField[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    apiClient.get<{ affectedFields: AffectedStanceField[]; totalModulatedFields: number }>(
      `/api/v1/deals/${dealId}/stance/affected-fields`,
    )
      .then(res => {
        setFields(res.data.affectedFields ?? []);
        setTotal(res.data.totalModulatedFields ?? 0);
      })
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [dealId, stanceUpdatedAt]);

  if (loading) {
    return (
      <div style={{ padding: '10px 14px', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
        COMPUTING AFFECTED FIELDS...
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: '10px 14px', fontFamily: MONO, fontSize: 9, color: '#FF4757' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 1 }}>
          STANCE EFFECT
        </span>
        {total > 0 && (
          <span style={{
            fontFamily: MONO, fontSize: 8, color: AMBER,
            border: `1px solid ${AMBER}50`, borderRadius: 2, padding: '0 5px',
          }}>
            {total} FIELD{total !== 1 ? 'S' : ''} MODULATED
          </span>
        )}
      </div>

      {fields.length === 0 ? (
        <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
          No modulations active — stance is at MARKET defaults
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {fields.map(f => (
            <div
              key={f.fieldPath}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 8px',
                background: BT.bg.panelAlt,
                borderLeft: `2px solid ${AMBER}`,
                borderRadius: '0 2px 2px 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: AMBER, fontSize: 8, lineHeight: 1 }}>●</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
                  {f.fieldPath}
                </span>
              </div>
              <span style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 700,
                color: f.deltaBps > 0 ? '#FF4757' : BT.text.green,
              }}>
                {f.deltaBps > 0 ? '+' : ''}{f.deltaBps}bps
              </span>
            </div>
          ))}
        </div>
      )}

      {fields.length > 0 && (
        <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
          <span style={{ color: AMBER }}>●</span> rules-modulated field · amber = stance-flagged
        </div>
      )}
    </div>
  );
}

// ─── Main StanceTab ────────────────────────────────────────────────────────────

export function StanceTab({ dealId }: Pick<FinancialEngineTabProps, 'dealId'>) {
  const operatorStance = useDealStore(s => s.operatorStance);
  const fetchStance    = useDealStore(s => s.fetchOperatorStance);
  const saveStance     = useDealStore(s => s.saveOperatorStance);
  const resetStance    = useDealStore(s => s.resetOperatorStance);

  const [saving, setSaving]       = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (dealId) fetchStance(dealId);
  }, [dealId, fetchStance]);

  const handleChange = useCallback(async (patch: OperatorStancePatch) => {
    if (!dealId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveStance(dealId, patch);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [dealId, saveStance]);

  const handleReset = useCallback(async () => {
    if (!dealId) return;
    setResetting(true);
    setSaveError(null);
    try {
      await resetStance(dealId);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setResetting(false);
    }
  }, [dealId, resetStance]);

  // ── Live base values from the deal store (LayeredValue<number>) ──────────────
  const exitCapVal    = useDealStore(s => (s.financial?.assumptions?.exitCapRate as any)?.value ?? null) as number | null;
  const rentGrowthVal = useDealStore(s => (s.financial?.assumptions?.rentGrowth  as any)?.value ?? null) as number | null;

  if (!operatorStance) {
    return (
      <div style={{ padding: 24, fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
        LOADING STANCE...
      </div>
    );
  }

  const s: OperatorStance = operatorStance;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Fixed top — header + all controls (no overflow so dropdowns render freely) ── */}
      <div style={{ flexShrink: 0 }}>

        {/* Header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 14px',
          background: BT.bg.header,
          borderBottom: `1px solid ${BT.border.subtle}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: AMBER, letterSpacing: 1 }}>
              OPERATOR STANCE
            </span>
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
              15 modulation rules · 11 fields
            </span>
            {saving && (
              <span style={{ fontFamily: MONO, fontSize: 8, color: CYAN }}>SAVING...</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {s.updatedAt && (
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
                {new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={handleReset}
              disabled={resetting || saving}
              title="Reset all postures to MARKET defaults"
              style={{
                background: 'transparent',
                border: `1px solid ${BT.border.medium}`,
                color: BT.text.muted,
                fontFamily: MONO, fontSize: 8, padding: '3px 8px',
                cursor: resetting || saving ? 'default' : 'pointer',
                borderRadius: 2, letterSpacing: 0.5,
                opacity: resetting || saving ? 0.4 : 1,
              }}
            >
              {resetting ? 'RESETTING...' : 'RESET TO MARKET'}
            </button>
          </div>
        </div>

        {/* Market default banner */}
        {s.defaulted && (
          <div style={{
            padding: '5px 14px',
            background: `${AMBER}10`,
            borderBottom: `1px solid ${AMBER}28`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ color: AMBER, fontSize: 10 }}>◈</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: AMBER }}>
              MARKET DEFAULTS ACTIVE — no manual stance applied
            </span>
          </div>
        )}

        {/* Save error */}
        {saveError && (
          <div style={{
            padding: '5px 14px', background: '#FF475718',
            borderBottom: `1px solid #FF475738`,
            fontFamily: MONO, fontSize: 9, color: '#FF4757',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{saveError}</span>
            <button
              onClick={() => setSaveError(null)}
              style={{ background: 'transparent', border: 'none', color: '#FF4757', cursor: 'pointer', fontSize: 11 }}
            >✕</button>
          </div>
        )}

        {/* ── Section 1: MASTER POSTURE ── */}
        <SectionHeader label="MASTER POSTURE" sub="one-dial control — modulates rent growth, exit cap, vacancy simultaneously" />
        <PostureRow<UnderwritingPosture>
          label="UNDERWRITING POSTURE"
          value={s.underwritingPosture}
          options={UNDERWRITING_OPTS}
          onChange={v => handleChange({ underwritingPosture: v })}
          saving={saving}
        />

        {/* ── Section 2: MACRO VIEW ── */}
        <SectionHeader label="MACRO VIEW" sub="rate, cycle, recession overlay" />
        <PostureRow<RateEnvironment>
          label="RATE ENVIRONMENT"
          value={s.rateEnvironment}
          options={RATE_ENV_OPTS}
          onChange={v => handleChange({ rateEnvironment: v })}
          saving={saving}
        />
        <PostureRow<CyclePosition>
          label="CYCLE POSITION"
          value={s.cyclePosition}
          options={CYCLE_OPTS}
          onChange={v => handleChange({ cyclePosition: v })}
          saving={saving}
        />
        <StressRow
          label="RECESSION PROBABILITY"
          unit="%"
          value={Math.round(s.recessionProbability * 100)}
          min={0}
          max={100}
          step={5}
          desc={
            s.recessionProbability < 0.4
              ? 'Below 40% — no stress overlay active'
              : 'Above 40% — stress overlays engaged across rent & vacancy'
          }
          onChange={v => handleChange({ recessionProbability: v / 100 })}
          saving={saving}
        />

        {/* ── Section 3: PER-DRIVER ── */}
        <SectionHeader label="PER-DRIVER STANCES" sub="concessions, marketing, opex" />
        <PostureRow<ConcessionStrategy>
          label="CONCESSION STRATEGY"
          value={s.concessionStrategy}
          options={CONCESSION_OPTS}
          onChange={v => handleChange({ concessionStrategy: v })}
          saving={saving}
        />
        <PostureRow<MarketingIntensity>
          label="MARKETING INTENSITY"
          value={s.marketingIntensity}
          options={MARKETING_OPTS}
          onChange={v => handleChange({ marketingIntensity: v })}
          saving={saving}
        />
        <PostureRow<ExpenseGrowthPosture>
          label="EXPENSE GROWTH"
          value={s.expenseGrowthPosture}
          options={EXPENSE_OPTS}
          onChange={v => handleChange({ expenseGrowthPosture: v })}
          saving={saving}
        />

        {/* ── Section 4: COST RECOGNITION ── */}
        <SectionHeader label="COST RECOGNITION" sub="how lease-up concessions flow through the financials pipeline" />
        <div style={{ borderBottom: `1px solid ${BT.border.subtle}`, padding: '9px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 1, marginBottom: 2 }}>
                LEASING COST TREATMENT
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
                {s.leasingCostTreatment === 'CAPITALIZED'
                  ? 'All lease-up concessions bypass P&L → equity reserve (S&U)'
                  : s.leasingCostTreatment === 'HYBRID'
                    ? 'One-time lease-up → capital · ongoing rent abatement → P&L'
                    : 'All concessions recognized on P&L — conservative default'}
              </div>
            </div>
            <LeasingCostTreatmentToggle
              value={s.leasingCostTreatment ?? 'OPERATING'}
              onChange={(v: LeasingCostTreatment) => handleChange({ leasingCostTreatment: v })}
            />
          </div>
        </div>

        {/* ── Section 5: STRESS OVERLAYS ── */}
        <SectionHeader label="STRESS OVERLAYS" sub="explicit haircuts stacked on top of posture-derived modulation" />
        <StressRow
          label="RENT GROWTH HAIRCUT"
          unit="bps"
          value={s.stressRentGrowthHaircut}
          min={0}
          max={500}
          step={25}
          desc={
            s.stressRentGrowthHaircut === 0
              ? 'No additional haircut — posture rules only'
              : `−${s.stressRentGrowthHaircut}bps on Y1–Y3 rent growth`
          }
          onChange={v => handleChange({ stressRentGrowthHaircut: v })}
          saving={saving}
        />
        <StressRow
          label="EXIT CAP WIDENING"
          unit="bps"
          value={s.stressExitCapWiden}
          min={0}
          max={300}
          step={25}
          desc={
            s.stressExitCapWiden === 0
              ? 'No additional widening — posture rules only'
              : `+${s.stressExitCapWiden}bps on exit cap rate`
          }
          onChange={v => handleChange({ stressExitCapWiden: v })}
          saving={saving}
        />
        <StressRow
          label="VACANCY FLOOR ADD"
          unit="pp"
          value={s.stressVacancyFloor}
          min={0}
          max={20}
          step={1}
          desc={
            s.stressVacancyFloor === 0
              ? 'No additional vacancy floor — posture rules only'
              : `+${s.stressVacancyFloor}pp added to stabilized vacancy floor`
          }
          onChange={v => handleChange({ stressVacancyFloor: v })}
          saving={saving}
        />

        {/* ── Section 6: BASE VALUES ── */}
        <SectionHeader
          label="BASE VALUES"
          sub="direct inputs for exit cap rate and rent growth — stance modulates on top of these"
        />
        <BaseValueRow
          label="EXIT CAP RATE"
          desc="Terminal cap rate applied to forward NOI at disposition"
          currentValue={exitCapVal}
          dealId={dealId}
          field="exitCapRate"
          saving={saving}
        />
        <BaseValueRow
          label="RENT GROWTH / YR"
          desc="Annual stabilized rent growth rate (applied post-lease-up)"
          currentValue={rentGrowthVal}
          dealId={dealId}
          field="rentGrowthStabilized"
          saving={saving}
        />

        <div style={{ height: 1, background: BT.border.subtle }} />
      </div>

      {/* ── Scrollable bottom — affected fields + footer ── */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <AffectedFieldsPanel dealId={dealId} stanceUpdatedAt={s.updatedAt} />

        <div style={{
          padding: '8px 14px',
          borderTop: `1px solid ${BT.border.subtle}`,
          fontFamily: MONO, fontSize: 8, color: BT.text.muted,
        }}>
          Stance changes trigger a zero-LLM re-blend against the cached underwriting snapshot.
          Re-run BUILD MODEL to push updated projections to F9.
        </div>
      </div>

    </div>
  );
}
