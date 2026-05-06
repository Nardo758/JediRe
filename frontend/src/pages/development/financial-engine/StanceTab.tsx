// ============================================================================
// StanceTab — OperatorStance panel for Console (Phase 2)
// ============================================================================
//
// Renders 4 posture dropdowns (UNDERWRITING POSTURE, RATE ENVIRONMENT,
// CYCLE POSITION, EXPENSE GROWTH). Changes persist via saveOperatorStance().
// Affected-fields section fetches from GET /:dealId/stance/affected-fields
// and shows yellow ● markers for rules-modulated fields.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { useDealStore } from '../../../stores/dealStore';
import { apiClient } from '../../../services/api.client';
import type {
  OperatorStance,
  OperatorStancePatch,
  UnderwritingPosture,
  RateEnvironment,
  CyclePosition,
  ExpenseGrowthPosture,
  AffectedStanceField,
} from '../../../stores/dealContext.types';
import type { FinancialEngineTabProps } from './types';

const MONO = BT.font.mono;
const AMBER = BT.text.amber;
const AMBER_DIM = `${AMBER}28`;

// ─── Posture config ────────────────────────────────────────────────────────────

const UNDERWRITING_OPTS: { value: UnderwritingPosture; label: string; desc: string }[] = [
  { value: 'CONSERVATIVE', label: 'CONSERVATIVE', desc: 'Tight vacancy floors, wider exit cap, reduced rent growth' },
  { value: 'MARKET',       label: 'MARKET',       desc: 'Platform consensus — no modulation applied' },
  { value: 'AGGRESSIVE',   label: 'AGGRESSIVE',   desc: 'Lower vacancy, compressed exit cap, higher rent growth' },
];

const RATE_ENV_OPTS: { value: RateEnvironment; label: string; desc: string }[] = [
  { value: 'CUTTING',           label: 'CUTTING',           desc: 'Fed in easing cycle — tighter caps, rate-sensitive assumptions' },
  { value: 'NORMALIZING',       label: 'NORMALIZING',       desc: 'Transitional environment — platform defaults' },
  { value: 'HIGHER_FOR_LONGER', label: 'HIGHER FOR LONGER', desc: 'Elevated rates persist — debt service stress, cap expansion' },
];

const CYCLE_OPTS: { value: CyclePosition; label: string; desc: string }[] = [
  { value: 'EARLY', label: 'EARLY CYCLE', desc: 'Recovery phase — favorable rent momentum' },
  { value: 'MID',   label: 'MID CYCLE',   desc: 'Expansion peak — platform consensus' },
  { value: 'LATE',  label: 'LATE CYCLE',  desc: 'Contraction risk — haircuts applied to growth' },
];

const EXPENSE_OPTS: { value: ExpenseGrowthPosture; label: string; desc: string }[] = [
  { value: 'CONTAINED', label: 'CONTAINED', desc: 'Below-inflation opex discipline — tighter expense growth' },
  { value: 'INFLATION',  label: 'INFLATION', desc: 'CPI-tracked expense growth — platform default' },
  { value: 'STRESSED',   label: 'STRESSED',  desc: 'Insurance reset + supply shock — elevated opex trajectory' },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

interface PostureRowProps<T extends string> {
  label: string;
  field: string;
  value: T;
  options: { value: T; label: string; desc: string }[];
  onChange: (v: T) => void;
  saving: boolean;
}

function PostureRow<T extends string>({ label, field, value, options, onChange, saving }: PostureRowProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <div style={{ borderBottom: `1px solid ${BT.border.subtle}`, padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 1, marginBottom: 3 }}>
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
              background: AMBER_DIM,
              border: `1px solid ${AMBER}60`,
              color: AMBER,
              fontFamily: MONO, fontSize: 9, fontWeight: 700,
              padding: '4px 10px', borderRadius: 2, cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.5 : 1, letterSpacing: 0.5,
            }}
          >
            {selected?.label ?? value}
            <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>
          </button>

          {open && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 2, zIndex: 100,
              background: BT.bg.panel, border: `1px solid ${AMBER}60`,
              borderRadius: 2, minWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}>
              {options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: opt.value === value ? AMBER_DIM : 'transparent',
                    border: 'none',
                    borderLeft: opt.value === value ? `2px solid ${AMBER}` : '2px solid transparent',
                    color: opt.value === value ? AMBER : BT.text.secondary,
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

// ─── Affected fields panel ─────────────────────────────────────────────────────

interface AffectedFieldsProps {
  dealId: string;
  stanceUpdatedAt: string | null;
}

function AffectedFieldsPanel({ dealId, stanceUpdatedAt }: AffectedFieldsProps) {
  const [fields, setFields] = useState<AffectedStanceField[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        LOADING AFFECTED FIELDS...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '10px 14px', fontFamily: MONO, fontSize: 9, color: BT.text.red ?? '#FF4757' }}>
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
            border: `1px solid ${AMBER}50`, borderRadius: 2, padding: '0 4px',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  fontFamily: MONO, fontSize: 9, fontWeight: 700,
                  color: f.deltaBps > 0 ? BT.text.green : BT.text.red ?? '#FF4757',
                }}>
                  {f.deltaBps > 0 ? '+' : ''}{f.deltaBps}bps
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {fields.length > 0 && (
        <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
          <span style={{ color: AMBER }}>●</span> rules-modulated field
        </div>
      )}
    </div>
  );
}

// ─── Main StanceTab ────────────────────────────────────────────────────────────

export function StanceTab({ dealId }: Pick<FinancialEngineTabProps, 'dealId'>) {
  const operatorStance   = useDealStore(s => s.operatorStance);
  const fetchStance      = useDealStore(s => s.fetchOperatorStance);
  const saveStance       = useDealStore(s => s.saveOperatorStance);
  const resetStance      = useDealStore(s => s.resetOperatorStance);

  const [saving, setSaving]   = useState(false);
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

  if (!operatorStance) {
    return (
      <div style={{ padding: 24, fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
        LOADING STANCE...
      </div>
    );
  }

  const stance: OperatorStance = operatorStance;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: AMBER, letterSpacing: 1 }}>
            OPERATOR STANCE
          </span>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
            meta-layer · 15 modulation rules
          </span>
          {saving && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: AMBER }}>SAVING...</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {stance.updatedAt && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
              {new Date(stance.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

      {/* ── Market default banner ── */}
      {stance.defaulted && (
        <div style={{
          padding: '6px 14px',
          background: `${AMBER}12`,
          borderBottom: `1px solid ${AMBER}30`,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ color: AMBER, fontSize: 10 }}>◈</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: AMBER }}>
            MARKET DEFAULTS ACTIVE — no manual stance applied
          </span>
        </div>
      )}

      {/* ── Save error ── */}
      {saveError && (
        <div style={{
          padding: '5px 14px',
          background: '#FF475720',
          borderBottom: `1px solid #FF475740`,
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

      {/* ── Posture dials ── */}
      <div style={{ flexShrink: 0 }}>
        <PostureRow<UnderwritingPosture>
          label="UNDERWRITING POSTURE"
          field="underwritingPosture"
          value={stance.underwritingPosture}
          options={UNDERWRITING_OPTS}
          onChange={v => handleChange({ underwritingPosture: v })}
          saving={saving}
        />
        <PostureRow<RateEnvironment>
          label="RATE ENVIRONMENT"
          field="rateEnvironment"
          value={stance.rateEnvironment}
          options={RATE_ENV_OPTS}
          onChange={v => handleChange({ rateEnvironment: v })}
          saving={saving}
        />
        <PostureRow<CyclePosition>
          label="CYCLE POSITION"
          field="cyclePosition"
          value={stance.cyclePosition}
          options={CYCLE_OPTS}
          onChange={v => handleChange({ cyclePosition: v })}
          saving={saving}
        />
        <PostureRow<ExpenseGrowthPosture>
          label="EXPENSE GROWTH"
          field="expenseGrowthPosture"
          value={stance.expenseGrowthPosture}
          options={EXPENSE_OPTS}
          onChange={v => handleChange({ expenseGrowthPosture: v })}
          saving={saving}
        />
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: BT.border.subtle, flexShrink: 0 }} />

      {/* ── Affected fields ── */}
      <AffectedFieldsPanel dealId={dealId} stanceUpdatedAt={stance.updatedAt} />

      {/* ── Footer note ── */}
      <div style={{
        padding: '8px 14px',
        borderTop: `1px solid ${BT.border.subtle}`,
        fontFamily: MONO, fontSize: 8, color: BT.text.muted,
        marginTop: 'auto', flexShrink: 0,
      }}>
        Stance changes trigger a zero-LLM re-blend against the cached underwriting snapshot.
        Re-run BUILD MODEL to apply to projections.
      </div>
    </div>
  );
}
