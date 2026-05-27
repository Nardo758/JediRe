import React, { useState, useContext, useEffect } from 'react';
import { BT, Bd, SectionPanel, DataRow } from '../bloomberg-ui';
import type { InvestmentPlan } from '../../../hooks/useStrategyAnalysisV2';
import { HoverContext } from './strategy-v2.types';
import { MONO, fmtSafe, sevColor } from './strategy-v2.utils';
import { apiClient } from '@/services/api.client';
import { dispatchModuleApplied } from '../../../utils/moduleEvents';

const PHASE_COLORS: Record<number, string> = {
  1: BT.text.cyan, 2: BT.text.green, 3: BT.text.amber, 4: BT.text.purple,
};

type ConflictItem = { fieldPath: string; reason: string; existingValue: unknown };
type SectionKey = 'entry' | 'exit';

type ToastState = {
  visible: boolean;
  type: 'success' | 'error' | 'warning';
  message: string;
  section: SectionKey;
};

function parseCurrencyInput(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (/[Mm]$/.test(cleaned)) {
    const n = parseFloat(cleaned.slice(0, -1)) * 1e6;
    return Number.isFinite(n) ? n : null;
  }
  if (/[Kk]$/.test(cleaned)) {
    const n = parseFloat(cleaned.slice(0, -1)) * 1e3;
    return Number.isFinite(n) ? n : null;
  }
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Bloomberg-style floating push notification.
// "VIEW IN F9 →" dispatches `strategy:view-in-f9` so parent pages can switch tabs.
function PushToast({
  toast,
  onClose,
}: {
  toast: ToastState;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(onClose, toast.type === 'success' ? 5000 : 7000);
    return () => clearTimeout(timer);
  }, [toast.visible, toast.type, onClose]);

  if (!toast.visible) return null;

  const borderColor = toast.type === 'success' ? BT.text.green
    : toast.type === 'error' ? BT.text.red
    : BT.text.amber;

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9998,
      minWidth: 280,
      maxWidth: 400,
      background: BT.bg.panel,
      border: `1px solid ${borderColor}`,
      borderLeft: `3px solid ${borderColor}`,
      borderTop: `1px solid ${borderColor}`,
      boxShadow: `0 4px 24px ${borderColor}28`,
      padding: '10px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: borderColor, letterSpacing: 0.4 }}>
          {toast.type === 'success' ? '✓ PUSHED TO F9' : toast.type === 'error' ? '✕ PUSH FAILED' : '⚠ PUSH WARNING'}
        </span>
        <button
          onClick={onClose}
          style={{
            fontFamily: MONO, fontSize: 8, color: BT.text.muted,
            background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0,
            lineHeight: 1, padding: '0 2px',
          }}
        >✕</button>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
        {toast.message}
      </span>
      {toast.type === 'success' && (
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('strategy:view-in-f9', { detail: { section: toast.section } }));
            onClose();
          }}
          style={{
            alignSelf: 'flex-start',
            fontFamily: MONO, fontSize: 8, fontWeight: 700,
            color: BT.text.cyan,
            background: `${BT.text.cyan}14`, border: `1px solid ${BT.text.cyan}44`,
            padding: '2px 10px', cursor: 'pointer', letterSpacing: 0.3,
          }}
        >
          VIEW IN F9 →
        </button>
      )}
    </div>
  );
}

function ConflictPanel({
  section,
  conflicts,
  onForce,
  onKeep,
  pushing,
}: {
  section: SectionKey;
  conflicts: ConflictItem[];
  onForce: () => void;
  onKeep: () => void;
  pushing: boolean;
}) {
  return (
    <div style={{
      margin: '6px 0',
      padding: '8px 10px',
      background: `${BT.text.amber}10`,
      border: `1px solid ${BT.text.amber}44`,
      borderLeft: `3px solid ${BT.text.amber}`,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber, marginBottom: 4 }}>
        ⚠ FIELD CONFLICT — {conflicts.length} USER-LOCKED VALUE{conflicts.length > 1 ? 'S' : ''}
      </div>
      {conflicts.map((c, i) => (
        <div key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, padding: '1px 0' }}>
          <span style={{ color: BT.text.muted }}>FIELD: </span>
          <span style={{ color: BT.text.primary }}>{c.fieldPath}</span>
          {c.existingValue != null && (
            <span style={{ color: BT.text.muted }}> · existing: {String(c.existingValue)}</span>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button
          onClick={onForce}
          disabled={pushing}
          style={{
            fontFamily: MONO, fontSize: 8, fontWeight: 700,
            color: BT.text.amber,
            background: `${BT.text.amber}22`, border: `1px solid ${BT.text.amber}55`,
            padding: '3px 10px', cursor: pushing ? 'not-allowed' : 'pointer', opacity: pushing ? 0.6 : 1,
          }}
        >
          {pushing ? '…' : 'FORCE OVERWRITE'}
        </button>
        <button
          onClick={onKeep}
          disabled={pushing}
          style={{
            fontFamily: MONO, fontSize: 8, color: BT.text.secondary,
            background: 'transparent', border: `1px solid ${BT.border.subtle}`,
            padding: '3px 10px', cursor: pushing ? 'not-allowed' : 'pointer', opacity: pushing ? 0.6 : 1,
          }}
        >
          KEEP USER VALUE
        </button>
      </div>
    </div>
  );
}

export function PlanDocument({ plan, dealId }: { plan: InvestmentPlan | null | undefined; dealId: string }) {
  const { hoveredEvidenceRef, setHoveredEvidenceRef } = useContext(HoverContext);
  const [editedEntry, setEditedEntry] = useState<Partial<{ targetQuarter: string; priceCeiling: string; debtStructure: string }>>({});
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [editedActions, setEditedActions] = useState<Record<string, { timing?: string; expectedImpact?: string }>>({});

  const [pushing, setPushing] = useState<Record<SectionKey, boolean>>({ entry: false, exit: false });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingConflicts, setPendingConflicts] = useState<Partial<Record<SectionKey, ConflictItem[]>>>({});

  if (!plan) return null;

  const showToast = (section: SectionKey, type: ToastState['type'], message: string) => {
    setToast({ visible: true, type, message, section });
  };
  const hideToast = () => setToast(null);

  const callApplyModule = async (
    source: string,
    fields: Array<{ fieldPath: string; value: unknown; force?: boolean }>,
  ) => {
    const res: any = await apiClient.post(
      `/api/v1/deals/${dealId}/assumptions/apply-from-module`,
      { source, appliedAt: new Date().toISOString(), fields },
    );
    return res.data as { applied: Array<{ fieldPath: string; value: unknown }>; conflicts: ConflictItem[] };
  };

  const handlePushEntry = async () => {
    if (pushing.entry) return;

    const rawPriceCeiling = editedEntry.priceCeiling;
    let priceCeiling: number | null = null;
    if (rawPriceCeiling !== undefined && rawPriceCeiling.trim() !== '') {
      priceCeiling = parseCurrencyInput(rawPriceCeiling);
    } else if (plan.entry?.priceCeiling) {
      priceCeiling = plan.entry.priceCeiling;
    }

    const targetHoldMonths = plan.holdStructure?.targetHoldMonths;
    const holdPeriodYears = targetHoldMonths ? Math.max(1, Math.round(targetHoldMonths / 12)) : null;

    const fields: Array<{ fieldPath: string; value: unknown }> = [];
    if (priceCeiling !== null && priceCeiling > 0) {
      fields.push({ fieldPath: 'acquisition.purchasePrice', value: priceCeiling });
    }
    if (holdPeriodYears !== null && holdPeriodYears >= 1 && holdPeriodYears <= 36) {
      fields.push({ fieldPath: 'hold.holdPeriodYears', value: holdPeriodYears });
    }

    if (fields.length === 0) {
      showToast('entry', 'warning', 'No valid numeric values to push — edit Price Ceiling or Hold Months first.');
      return;
    }

    setPushing(p => ({ ...p, entry: true }));
    try {
      const { applied, conflicts } = await callApplyModule('strategy:entry', fields);
      const userConflicts = conflicts.filter(c => c.reason === 'user_locked');

      if (userConflicts.length > 0) {
        setPendingConflicts(p => ({ ...p, entry: userConflicts }));
      }

      if (applied.length > 0) {
        dispatchModuleApplied('strategy:entry', applied.map(a => a.fieldPath));
        const msg = userConflicts.length > 0
          ? `Strategy Entry applied ${applied.length} field(s) to F9 · ${userConflicts.length} conflict(s) — resolve below`
          : `Strategy Entry applied to F9 · ${applied.map(a => a.fieldPath.split('.').pop()).join(', ')}`;
        showToast('entry', 'success', msg);
      } else if (userConflicts.length > 0) {
        showToast('entry', 'warning', `${userConflicts.length} field(s) locked by user — resolve conflict below.`);
      }

      const annotatedQuarter = editedEntry.targetQuarter ?? plan.entry?.targetQuarter ?? '';
      const annotatedDebt = editedEntry.debtStructure ?? plan.entry?.debtStructure ?? '';
      const annotations: Record<string, string> = {};
      if (annotatedQuarter) annotations.targetQuarter = annotatedQuarter;
      if (annotatedDebt) annotations.debtStructure = annotatedDebt;
      if (Object.keys(annotations).length > 0) {
        apiClient.post(`/api/v1/deals/${dealId}/assumptions/strategy-annotation`, {
          section: 'entry', annotations,
        }).catch(() => {});
      }
    } catch (err: any) {
      showToast('entry', 'error', err?.response?.data?.error || err?.message || 'Push to F9 failed.');
    } finally {
      setPushing(p => ({ ...p, entry: false }));
    }
  };

  const handlePushExit = async () => {
    if (pushing.exit) return;

    const exitCapRate = plan.exit?.capRate;
    const targetIrr = plan.exit?.expectedIRR?.[0];

    const fields: Array<{ fieldPath: string; value: unknown }> = [];
    if (exitCapRate != null && exitCapRate > 0) {
      fields.push({ fieldPath: 'disposition.exitCapRate', value: exitCapRate });
    }
    if (targetIrr != null && targetIrr > 0) {
      fields.push({ fieldPath: 'targets.targetIrr', value: targetIrr });
    }

    if (fields.length === 0) {
      showToast('exit', 'warning', 'No exit cap or IRR values available — analysis may be incomplete.');
      return;
    }

    setPushing(p => ({ ...p, exit: true }));
    try {
      const { applied, conflicts } = await callApplyModule('strategy:exit', fields);
      const userConflicts = conflicts.filter(c => c.reason === 'user_locked');

      if (userConflicts.length > 0) {
        setPendingConflicts(p => ({ ...p, exit: userConflicts }));
      }

      if (applied.length > 0) {
        dispatchModuleApplied('strategy:exit', applied.map(a => a.fieldPath));
        const msg = userConflicts.length > 0
          ? `Strategy Exit applied ${applied.length} field(s) to F9 · ${userConflicts.length} conflict(s) — resolve below`
          : `Strategy Exit Cap applied to F9 · ${applied.map(a => a.fieldPath.split('.').pop()).join(', ')}`;
        showToast('exit', 'success', msg);
      } else if (userConflicts.length > 0) {
        showToast('exit', 'warning', `${userConflicts.length} field(s) locked by user — resolve conflict below.`);
      }
    } catch (err: any) {
      showToast('exit', 'error', err?.response?.data?.error || err?.message || 'Push to F9 failed.');
    } finally {
      setPushing(p => ({ ...p, exit: false }));
    }
  };

  const handleForceOverwrite = async (section: SectionKey) => {
    const conflicts = pendingConflicts[section];
    if (!conflicts || conflicts.length === 0) return;
    const source = section === 'entry' ? 'strategy:entry' : 'strategy:exit';

    const forceFields = conflicts.map(c => {
      let value: number | null = null;
      if (c.fieldPath === 'acquisition.purchasePrice') {
        const raw = editedEntry.priceCeiling;
        value = raw ? parseCurrencyInput(raw) : (plan.entry?.priceCeiling ?? null);
      } else if (c.fieldPath === 'hold.holdPeriodYears') {
        const months = plan.holdStructure?.targetHoldMonths;
        value = months ? Math.max(1, Math.round(months / 12)) : null;
      } else if (c.fieldPath === 'disposition.exitCapRate') {
        value = plan.exit?.capRate ?? null;
      } else if (c.fieldPath === 'targets.targetIrr') {
        value = plan.exit?.expectedIRR?.[0] ?? null;
      }
      return { fieldPath: c.fieldPath, value, force: true };
    }).filter(f => f.value !== null);

    if (forceFields.length === 0) return;

    setPushing(p => ({ ...p, [section]: true }));
    setPendingConflicts(p => ({ ...p, [section]: [] }));
    try {
      const { applied } = await callApplyModule(source, forceFields);
      if (applied.length > 0) {
        dispatchModuleApplied(source, applied.map(a => a.fieldPath));
        const sectionLabel = section === 'entry' ? 'Entry' : 'Exit';
        showToast(section, 'success', `Strategy ${sectionLabel} applied to F9 · ${applied.map(a => a.fieldPath.split('.').pop()).join(', ')} (overwrite)`);
      }
    } catch (err: any) {
      showToast(section, 'error', err?.response?.data?.error || 'Force-overwrite failed.');
    } finally {
      setPushing(p => ({ ...p, [section]: false }));
    }
  };

  const handleKeepUserValue = (section: SectionKey) => {
    setPendingConflicts(p => ({ ...p, [section]: [] }));
  };

  const inStyle: React.CSSProperties = {
    fontFamily: MONO, fontSize: 9, background: BT.bg.input, color: BT.text.primary,
    border: `1px solid ${BT.border.subtle}`, padding: '2px 6px', width: '100%', boxSizing: 'border-box',
  };

  const entryConflicts = pendingConflicts.entry ?? [];
  const exitConflicts = pendingConflicts.exit ?? [];

  return (
    <>
      {toast && <PushToast toast={toast} onClose={hideToast} />}

      <SectionPanel title="INVESTMENT PLAN DOCUMENT" borderColor={BT.text.green} style={{ marginBottom: 1 }}>

        {/* ENTRY */}
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.cyan}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan, letterSpacing: 0.5 }}>ENTRY</span>
            <button
              onClick={handlePushEntry}
              disabled={pushing.entry}
              style={{
                fontFamily: MONO, fontSize: 8, fontWeight: 700,
                color: BT.text.amber,
                background: `${BT.text.amber}1a`, border: `1px solid ${BT.text.amber}55`,
                padding: '2px 10px', cursor: pushing.entry ? 'not-allowed' : 'pointer',
                opacity: pushing.entry ? 0.6 : 1,
                letterSpacing: 0.3,
              }}
            >
              {pushing.entry ? '…' : 'PUSH TO F9 →'}
            </button>
          </div>

          {entryConflicts.length > 0 && (
            <ConflictPanel
              section="entry"
              conflicts={entryConflicts}
              onForce={() => handleForceOverwrite('entry')}
              onKeep={() => handleKeepUserValue('entry')}
              pushing={pushing.entry}
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px 8px', alignItems: 'center' }}>
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>TARGET QUARTER</span>
            <input value={editedEntry.targetQuarter ?? plan.entry?.targetQuarter ?? ''} onChange={e => setEditedEntry(p => ({ ...p, targetQuarter: e.target.value }))} style={inStyle} />
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>PRICE CEILING</span>
            <input value={editedEntry.priceCeiling ?? (plan.entry?.priceCeiling ? `$${(plan.entry.priceCeiling / 1e6).toFixed(2)}M` : '')} onChange={e => setEditedEntry(p => ({ ...p, priceCeiling: e.target.value }))} style={inStyle} />
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>DEBT STRUCTURE</span>
            <input value={editedEntry.debtStructure ?? plan.entry?.debtStructure ?? ''} onChange={e => setEditedEntry(p => ({ ...p, debtStructure: e.target.value }))} style={inStyle} />
          </div>
          {plan.entry?.rationale && (
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, fontStyle: 'italic', marginTop: 6 }}>{plan.entry.rationale}</div>
          )}
        </div>

        {/* VALUE CREATION — button intentionally removed (no numeric F9 destination) */}
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.green}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.green, letterSpacing: 0.5 }}>VALUE CREATION</span>
          </div>
          {(plan.valueCreation || []).map((action, i) => {
            const phaseColor = PHASE_COLORS[action.phase] || BT.text.secondary;
            const key = `vc-${i}`;
            const refs = action.evidenceRefs || [];
            const isHighlighted = refs.length > 0 && refs.some(r => r === hoveredEvidenceRef);
            const isDirty = !!(editedActions[key]?.timing !== undefined || editedActions[key]?.expectedImpact !== undefined);
            return (
              <div
                key={key}
                onMouseEnter={() => {
                  setHoveredAction(key);
                  if (refs.length > 0) setHoveredEvidenceRef(refs[0]);
                }}
                onMouseLeave={() => {
                  setHoveredAction(null);
                  setHoveredEvidenceRef(null);
                }}
                style={{
                  padding: '5px 0', borderBottom: `1px solid ${BT.border.subtle}`,
                  background: isHighlighted
                    ? `${BT.text.cyan}12`
                    : hoveredAction === key ? `${phaseColor}08` : 'transparent',
                  borderLeft: isHighlighted ? `3px solid ${BT.text.cyan}` : '3px solid transparent',
                  paddingLeft: 4,
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <Bd c={phaseColor}>PH{action.phase}</Bd>
                  {isDirty && <Bd c={BT.text.amber}>●</Bd>}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.primary }}>{action.action}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, flexShrink: 0 }}>⏱</span>
                      <input
                        value={editedActions[key]?.timing ?? action.timing ?? ''}
                        onChange={e => setEditedActions(p => ({ ...p, [key]: { ...p[key], timing: e.target.value } }))}
                        style={{ fontFamily: MONO, fontSize: 8, background: BT.bg.input, color: BT.text.primary, border: `1px solid ${BT.border.subtle}`, padding: '1px 4px', width: 80 }}
                      />
                      {refs.map((ref, ri) => (
                        <span
                          key={ri}
                          style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan, cursor: 'pointer', textDecoration: 'underline dotted' }}
                          onMouseEnter={() => setHoveredEvidenceRef(ref)}
                          onMouseLeave={() => setHoveredEvidenceRef(null)}
                        >§{ref}</span>
                      ))}
                      {(action.correlationRefs || []).map((ref, ri) => (
                        <span key={ri} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.teal }}>{ref}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                      <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, flexShrink: 0 }}>IMPACT →</span>
                      <input
                        value={editedActions[key]?.expectedImpact ?? action.expectedImpact ?? ''}
                        onChange={e => setEditedActions(p => ({ ...p, [key]: { ...p[key], expectedImpact: e.target.value } }))}
                        style={{ fontFamily: MONO, fontSize: 8, background: BT.bg.input, color: BT.text.green, border: `1px solid ${BT.border.subtle}`, padding: '1px 4px', width: 140 }}
                      />
                    </div>
                  </div>
                  {action.costEstimate && (
                    <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber, flexShrink: 0 }}>{action.costEstimate}</span>
                  )}
                </div>
              </div>
            );
          })}
          {(!plan.valueCreation || plan.valueCreation.length === 0) && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No value creation actions defined.</span>
          )}
        </div>

        {/* HOLD */}
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.amber}` }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.amber, letterSpacing: 0.5 }}>HOLD STRUCTURE</span>
          <DataRow label="TARGET HOLD" value={plan.holdStructure?.targetHoldMonths ? `${plan.holdStructure.targetHoldMonths}mo` : '—'} valueColor={BT.text.primary} />
          {(plan.holdStructure?.exitWindows || []).map((w, i) => {
            const label = typeof w === 'string' ? w : `Mo ${w.month}: ${w.condition}`;
            return (
              <div key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, padding: '1px 0' }}>◆ {label}</div>
            );
          })}
          {plan.holdStructure?.rationale && (
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, fontStyle: 'italic', marginTop: 4 }}>{plan.holdStructure.rationale}</div>
          )}
        </div>

        {/* EXIT */}
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.purple}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.purple, letterSpacing: 0.5 }}>EXIT</span>
            <button
              onClick={handlePushExit}
              disabled={pushing.exit}
              style={{
                fontFamily: MONO, fontSize: 8, fontWeight: 700,
                color: BT.text.purple,
                background: `${BT.text.purple}1a`, border: `1px solid ${BT.text.purple}55`,
                padding: '2px 10px', cursor: pushing.exit ? 'not-allowed' : 'pointer',
                opacity: pushing.exit ? 0.6 : 1,
                letterSpacing: 0.3,
              }}
            >
              {pushing.exit ? '…' : 'PUSH TO F9 →'}
            </button>
          </div>

          {exitConflicts.length > 0 && (
            <ConflictPanel
              section="exit"
              conflicts={exitConflicts}
              onForce={() => handleForceOverwrite('exit')}
              onKeep={() => handleKeepUserValue('exit')}
              pushing={pushing.exit}
            />
          )}

          <DataRow label="TARGET QUARTER" value={plan.exit?.targetQuarter || '—'} valueColor={BT.text.primary} />
          <DataRow label="BUYER TYPE" value={plan.exit?.buyerType || '—'} valueColor={BT.text.cyan} />
          <DataRow label="EXIT CAP" value={plan.exit?.capRate ? `${(plan.exit.capRate * 100).toFixed(2)}%` : '—'} valueColor={BT.text.amber} />
          {plan.exit?.expectedIRR && (
            <DataRow label="IRR RANGE" value={`${fmtSafe(plan.exit.expectedIRR[0], 1, 100)}–${fmtSafe(plan.exit.expectedIRR[1], 1, 100)}%`} valueColor={BT.text.green} />
          )}
          {(plan.exit?.activeBuyers || []).map((b, i) => (
            <div key={i} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, padding: '1px 0' }}>◆ {b}</div>
          ))}
        </div>

        {/* MONITORING — inline compact view */}
        {(plan.monitoring || []).length > 0 && (
          <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.orange}` }}>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.orange, letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>MONITORING TRIGGERS</span>
            {(plan.monitoring || []).map((item, i) => {
              const sColor = sevColor(item.severity);
              return (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '2px 0', borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <Bd c={sColor}>{(item.severity ?? '').toUpperCase()}</Bd>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.primary, flex: 1 }}>{item.metric}</span>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>NOW: {item.currentValue}</span>
                  <span style={{ fontFamily: MONO, fontSize: 7, color: sColor }}>▲ {item.triggerThreshold}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* PIVOT CONDITIONS */}
        {(plan.pivotConditions || []).length > 0 && (
          <div style={{ padding: '8px 12px', borderLeft: `2px solid ${BT.text.purple}` }}>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.purple, letterSpacing: 0.5 }}>PIVOT CONDITIONS</span>
            {plan.pivotConditions.map((pivot, i) => (
              <div key={i} style={{ padding: '5px 0', borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <button style={{
                  fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#ffffff',
                  background: BT.text.purple, border: 'none', padding: '2px 8px', cursor: 'pointer', flexShrink: 0,
                }}>PIVOT NOW</button>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>TRIGGER: {pivot.trigger}</div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan }}>→ {pivot.pivotTo}</div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{pivot.rationale}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionPanel>
    </>
  );
}
