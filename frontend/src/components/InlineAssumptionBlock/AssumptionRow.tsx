import React, { useRef, memo } from 'react';
import { T } from './tokens';
import { DriftIndicator } from './DriftIndicator';
import { ConfidenceBadge } from './ConfidenceBadge';
import { EditableValueCell } from './EditableValueCell';
import { formatValue } from './formatHelpers';
import type { EditableValueCellRef } from './EditableValueCell';
import { useFieldDriftAnalysis } from './useLayeredValue';
import type { AssumptionFieldDef } from './types';

interface AssumptionRowProps {
  field: AssumptionFieldDef;
  hasSubjectHistory: boolean;
  onOverride: (fieldId: string, value: number) => void;
  onRevert: (fieldId: string) => void;
  onOpenDrilldown: (fieldId: string) => void;
  editRefSetter?: (fieldId: string, ref: EditableValueCellRef | null) => void;
  /** Moves focus to the next EFFECTIVE cell in the block (Tab) */
  onTabNext?: () => void;
  /** Moves focus to the previous EFFECTIVE cell in the block (Shift+Tab) */
  onTabPrev?: () => void;
}

function AssumptionRowInner({
  field,
  hasSubjectHistory,
  onOverride,
  onRevert,
  onOpenDrilldown,
  editRefSetter,
  onTabNext,
  onTabPrev,
}: AssumptionRowProps) {
  const cellRef = useRef<EditableValueCellRef>(null);

  const refCallback = (el: EditableValueCellRef | null) => {
    (cellRef as React.MutableRefObject<EditableValueCellRef | null>).current = el;
    editRefSetter?.(field.fieldId, el);
  };

  const drift = useFieldDriftAnalysis(field.subjectValue, field.peerValue);

  const hasOverride = field.overrideValue != null;
  const effectiveDisplay = hasOverride ? field.overrideValue! : (field.effectiveValue ?? null);

  return (
    <tr
      role="row"
      style={{
        borderBottom: `1px solid ${T.border.subtle}50`,
        background: hasOverride ? `${T.accent.user}05` : 'transparent',
      }}
    >
      {/* Label */}
      <td style={{ padding: '3px 8px', minWidth: 140 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => onOpenDrilldown(field.fieldId)}
            onKeyDown={e => { if (e.key === 'Enter') onOpenDrilldown(field.fieldId); }}
            title="Click for source drilldown"
            style={{
              fontFamily: T.font.label,
              fontSize: T.fontSize.label,
              color: hasOverride ? T.accent.user : T.text.secondary,
              fontWeight: hasOverride ? 600 : 400,
              background: 'none', border: 'none',
              cursor: 'pointer', padding: 0,
              textAlign: 'left',
            }}
          >
            {field.label}
          </button>
          {field.stanceModulated && (
            <span
              title={field.stanceTrace ?? 'Adjusted by OperatorStance'}
              style={{ color: '#f59e0b', fontSize: 9, lineHeight: 1, cursor: 'help', flexShrink: 0 }}
            >
              ●
            </span>
          )}
        </div>
      </td>

      {/* PEER SET */}
      <td style={{ padding: '3px 8px', textAlign: 'right' }}>
        <span style={{
          fontFamily: T.font.mono, fontSize: T.fontSize.value,
          fontVariantNumeric: 'tabular-nums',
          color: T.text.muted,
        }}>
          {field.peerValue != null
            ? formatValue(field.peerValue, field.format)
            : <span title="No platform calibration for this scope" style={{ color: T.text.muted, fontStyle: 'italic', fontSize: T.fontSize.detail }}>—</span>
          }
        </span>
      </td>

      {/* SUBJECT (only in 3-col mode) */}
      {hasSubjectHistory && (
        <td style={{ padding: '3px 8px', textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
            {field.subjectValue != null
              ? (
                <>
                  <DriftIndicator direction={drift.direction} sigma={drift.sigma} />
                  <span style={{
                    fontFamily: T.font.mono, fontSize: T.fontSize.value,
                    fontVariantNumeric: 'tabular-nums',
                    color: T.accent.subject,
                    fontWeight: 600,
                  }}>
                    {formatValue(field.subjectValue, field.format)}
                  </span>
                  {field.blendWeight != null && field.blendWeight < 1 && field.blendWeight > 0 && (
                    <span style={{ fontSize: T.fontSize.badge, color: T.text.muted, fontFamily: T.font.mono }}>
                      w={Math.round(field.blendWeight * 100)}%
                    </span>
                  )}
                </>
              )
              : (
                <span
                  title="Only one snapshot — S2 dynamics require ≥2 snapshots (≥60 days)"
                  style={{ color: T.text.muted, fontFamily: T.font.mono, fontSize: T.fontSize.detail, fontStyle: 'italic' }}
                >
                  —
                </span>
              )
            }
          </div>
        </td>
      )}

      {/* EFFECTIVE (editable) */}
      <td style={{ padding: '3px 8px', textAlign: 'right' }}>
        <EditableValueCell
          ref={refCallback}
          value={effectiveDisplay}
          format={field.format}
          precision={field.precision}
          min={field.min}
          max={field.max}
          hasOverride={hasOverride}
          fieldId={field.fieldId}
          fieldLabel={field.label}
          onCommit={val => onOverride(field.fieldId, val)}
          onRevert={() => onRevert(field.fieldId)}
          onTabNext={onTabNext}
          onTabPrev={onTabPrev}
        />
      </td>

      {/* CONFIDENCE */}
      <td style={{ padding: '3px 8px', textAlign: 'center' }}>
        <ConfidenceBadge confidence={field.confidence} />
      </td>
    </tr>
  );
}

// Custom equality: re-render ONLY when layered value/source/drift inputs change.
// Tab navigation callbacks (onTabNext/onTabPrev) are intentionally excluded:
// they are stabilized by the parent's tabHandlerMap (useMemo keyed on field IDs)
// and must NOT drive row re-renders — their identity changes only when the field
// set itself changes, at which point React's key-based reconciliation handles it.
function areEqual(prev: AssumptionRowProps, next: AssumptionRowProps) {
  const pf = prev.field;
  const nf = next.field;
  return (
    pf.effectiveValue  === nf.effectiveValue  &&
    pf.overrideValue   === nf.overrideValue   &&
    pf.source          === nf.source          &&
    pf.subjectValue    === nf.subjectValue    &&
    pf.peerValue       === nf.peerValue       &&
    pf.confidence      === nf.confidence      &&
    pf.stanceModulated === nf.stanceModulated &&
    pf.stanceTrace     === nf.stanceTrace     &&
    prev.hasSubjectHistory === next.hasSubjectHistory
  );
}

export const AssumptionRow = memo(AssumptionRowInner, areEqual);
