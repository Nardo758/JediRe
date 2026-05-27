import React, { useState, useContext } from 'react';
import { BT, Bd, SectionPanel, DataRow } from '../bloomberg-ui';
import type { InvestmentPlan } from '../../../hooks/useStrategyAnalysisV2';
import { HoverContext } from './strategy-v2.types';
import { MONO, fmtSafe, sevColor } from './strategy-v2.utils';

const PHASE_COLORS: Record<number, string> = {
  1: BT.text.cyan, 2: BT.text.green, 3: BT.text.amber, 4: BT.text.purple,
};

export function PlanDocument({ plan, dealId }: { plan: InvestmentPlan | null | undefined; dealId: string }) {
  const { hoveredEvidenceRef, setHoveredEvidenceRef } = useContext(HoverContext);
  const [editedEntry, setEditedEntry] = useState<Partial<{ targetQuarter: string; priceCeiling: string; debtStructure: string }>>({});
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [applyFeedback, setApplyFeedback] = useState<Record<string, string>>({});
  const [editedActions, setEditedActions] = useState<Record<string, { timing?: string; expectedImpact?: string }>>({});

  if (!plan) return null;

  const handleApplyToProForma = async (section: string) => {
    try {
      await fetch(`/api/v1/deals/${dealId}/proforma/apply-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, editedEntry }),
      });
      setApplyFeedback(f => ({ ...f, [section]: 'APPLIED ✓' }));
      setTimeout(() => setApplyFeedback(f => ({ ...f, [section]: '' })), 3000);
    } catch {
      setApplyFeedback(f => ({ ...f, [section]: 'STUB — PRO FORMA INTEGRATION PENDING' }));
      setTimeout(() => setApplyFeedback(f => ({ ...f, [section]: '' })), 3000);
    }
  };

  const inStyle: React.CSSProperties = {
    fontFamily: MONO, fontSize: 9, background: BT.bg.input, color: BT.text.primary,
    border: `1px solid ${BT.border.subtle}`, padding: '2px 6px', width: '100%', boxSizing: 'border-box',
  };

  return (
    <SectionPanel title="INVESTMENT PLAN DOCUMENT" borderColor={BT.text.green} style={{ marginBottom: 1 }}>
      {/* ENTRY */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.cyan}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.cyan, letterSpacing: 0.5 }}>ENTRY</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {applyFeedback['entry'] && <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green }}>{applyFeedback['entry']}</span>}
            <button onClick={() => handleApplyToProForma('entry')} style={{
              fontFamily: MONO, fontSize: 8, color: BT.text.cyan,
              background: `${BT.text.cyan}18`, border: `1px solid ${BT.text.cyan}44`,
              padding: '2px 8px', cursor: 'pointer',
            }}>APPLY TO PRO FORMA</button>
          </div>
        </div>
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

      {/* VALUE CREATION */}
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${BT.border.subtle}`, borderLeft: `2px solid ${BT.text.green}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.green, letterSpacing: 0.5 }}>VALUE CREATION</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {applyFeedback['valueCreation'] && <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green }}>{applyFeedback['valueCreation']}</span>}
            <button onClick={() => handleApplyToProForma('valueCreation')} style={{
              fontFamily: MONO, fontSize: 8, color: BT.text.green,
              background: `${BT.text.green}18`, border: `1px solid ${BT.text.green}44`,
              padding: '2px 8px', cursor: 'pointer',
            }}>APPLY TO PRO FORMA</button>
          </div>
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {applyFeedback['exit'] && <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green }}>{applyFeedback['exit']}</span>}
            <button onClick={() => handleApplyToProForma('exit')} style={{
              fontFamily: MONO, fontSize: 8, color: BT.text.purple,
              background: `${BT.text.purple}18`, border: `1px solid ${BT.text.purple}44`,
              padding: '2px 8px', cursor: 'pointer',
            }}>APPLY TO PRO FORMA</button>
          </div>
        </div>
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
  );
}
