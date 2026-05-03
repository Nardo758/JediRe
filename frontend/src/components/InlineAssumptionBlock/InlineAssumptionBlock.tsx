import React, {
  useState, useRef, useCallback, useImperativeHandle, forwardRef,
} from 'react';
import { T } from './tokens';
import { AssumptionRow } from './AssumptionRow';
import { CollisionPanel } from './CollisionPanel';
import { DrilldownModal } from './DrilldownModal';
import { useBlockCollisions } from './useBlockCollisions';
import type {
  InlineAssumptionBlockProps,
  AssumptionBlockRef,
  AssumptionFieldDef,
} from './types';
import type { EditableValueCellRef } from './EditableValueCell';

export const InlineAssumptionBlock = forwardRef<AssumptionBlockRef, InlineAssumptionBlockProps>(
  function InlineAssumptionBlock(
    {
      blockId,
      blockLabel,
      fields,
      hasSubjectHistory,
      subjectTier,
      subjectSnapshotCount,
      collisions: externalCollisions,
      defaultExpanded = true,
      onOverride,
      onRevert,
    },
    ref,
  ) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [drilldownFieldId, setDrilldownFieldId] = useState<string | null>(null);

    // Derived collisions (from field data, unless caller provides them)
    const derivedCollisions = useBlockCollisions(fields);
    const collisions = externalCollisions ?? derivedCollisions;
    const hasCollisions = collisions.length > 0;

    // Edit refs per field — allows F-key / drilldown "Override →" to focus input
    const editRefs = useRef<Map<string, EditableValueCellRef>>(new Map());
    const editRefSetter = useCallback(
      (fieldId: string, r: EditableValueCellRef | null) => {
        if (r) editRefs.current.set(fieldId, r);
        else editRefs.current.delete(fieldId);
      },
      [],
    );

    useImperativeHandle(ref, () => ({
      focusEdit: (fieldId: string) => {
        editRefs.current.get(fieldId)?.focusEdit();
      },
    }), []);

    // Tab/Shift+Tab navigation — moves focus between EFFECTIVE cells only,
    // skipping all read-only columns (PEER SET, SUBJECT, CONF).
    const makeTabHandlers = useCallback(
      (fieldId: string): { onTabNext: () => void; onTabPrev: () => void } => {
        const idx = fields.findIndex(f => f.fieldId === fieldId);
        return {
          onTabNext: () => {
            const next = fields[idx + 1];
            if (next) editRefs.current.get(next.fieldId)?.focusEdit();
          },
          onTabPrev: () => {
            const prev = fields[idx - 1];
            if (prev) editRefs.current.get(prev.fieldId)?.focusEdit();
          },
        };
      },
      [fields],
    );

    const openDrilldown = useCallback((fieldId: string) => {
      setDrilldownFieldId(fieldId);
    }, []);

    const closeDrilldown = useCallback(() => {
      setDrilldownFieldId(null);
    }, []);

    const focusDrilldownEdit = useCallback(() => {
      if (drilldownFieldId) {
        editRefs.current.get(drilldownFieldId)?.focusEdit();
      }
    }, [drilldownFieldId]);

    const drilldownField: AssumptionFieldDef | null = drilldownFieldId
      ? (fields.find(f => f.fieldId === drilldownFieldId) ?? null)
      : null;

    // label + peer + [subject?] + effective + conf
    const colCount = hasSubjectHistory ? 5 : 4;

    return (
      <>
        {/* ── Block container ─────────────────────────────────────────── */}
        <div
          role="group"
          aria-label={`${blockLabel} assumption block`}
          data-block-id={blockId}
          style={{
            borderBottom: `1px solid ${T.border.subtle}`,
            background: `${T.accent.subject}06`,
          }}
        >
          {/* Header bar */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 8px',
              cursor: 'pointer',
              borderBottom: expanded ? `1px solid ${T.border.subtle}30` : 'none',
              background: T.bg.header,
            }}
            onClick={() => setExpanded(v => !v)}
            role="button"
            tabIndex={0}
            aria-expanded={expanded}
            aria-controls={`iab-body-${blockId}`}
            onKeyDown={e => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setExpanded(v => !v);
              }
            }}
          >
            <span style={{
              fontFamily: T.font.mono, fontSize: T.fontSize.detail,
              color: T.text.muted,
            }}>
              {expanded ? '▾' : '▸'}
            </span>

            <span style={{
              fontFamily: T.font.mono, fontSize: T.fontSize.detail,
              color: T.accent.subject, fontWeight: 600, letterSpacing: 0.5,
            }}>
              {blockLabel.toUpperCase()} · ASSUMPTIONS
            </span>

            {subjectTier && (
              <span style={{
                fontFamily: T.font.mono, fontSize: T.fontSize.badge,
                color: T.accent.subject, background: `${T.accent.subject}18`,
                border: `1px solid ${T.accent.subject}40`, borderRadius: 2,
                padding: '0 4px', lineHeight: '12px',
              }}>
                SUBJ·{subjectTier}
              </span>
            )}

            {subjectSnapshotCount != null && (
              <span style={{ fontFamily: T.font.mono, fontSize: T.fontSize.badge, color: T.text.muted }}>
                {subjectSnapshotCount} snapshot{subjectSnapshotCount !== 1 ? 's' : ''}
              </span>
            )}

            {!hasSubjectHistory && (
              <span
                title="Upload a rent roll to enable subject-history calibration"
                style={{ fontFamily: T.font.mono, fontSize: T.fontSize.badge, color: T.text.muted, fontStyle: 'italic' }}
              >
                2-col mode · no rent roll
              </span>
            )}

            {/* Collision badge when collapsed */}
            {!expanded && hasCollisions && (
              <span style={{
                fontFamily: T.font.mono, fontSize: T.fontSize.badge,
                color: T.text.amber, background: `${T.text.amber}15`,
                border: `1px solid ${T.text.amber}40`, borderRadius: 2,
                padding: '0 4px', lineHeight: '12px',
              }}>
                ⚠ {collisions.length}
              </span>
            )}

            <div style={{ flex: 1 }} />

            <span style={{ fontFamily: T.font.mono, fontSize: T.fontSize.badge, color: T.text.muted }}>
              {fields.length} field{fields.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Body */}
          {expanded && (
            <div id={`iab-body-${blockId}`}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                {/* Column headers */}
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                    <th style={{
                      padding: '2px 8px', textAlign: 'left',
                      fontFamily: T.font.mono, fontSize: T.fontSize.badge,
                      color: T.text.muted, fontWeight: 500, minWidth: 140,
                    }}>
                      ASSUMPTION
                    </th>
                    <th style={{
                      padding: '2px 8px', textAlign: 'right',
                      fontFamily: T.font.mono, fontSize: T.fontSize.badge,
                      color: T.text.muted, fontWeight: 500, minWidth: 80,
                    }}>
                      PEER SET
                    </th>
                    {hasSubjectHistory && (
                      <th style={{
                        padding: '2px 8px', textAlign: 'right',
                        fontFamily: T.font.mono, fontSize: T.fontSize.badge,
                        color: T.accent.subject, fontWeight: 600, minWidth: 80,
                      }}>
                        SUBJECT
                      </th>
                    )}
                    <th style={{
                      padding: '2px 8px', textAlign: 'right',
                      fontFamily: T.font.mono, fontSize: T.fontSize.badge,
                      color: T.text.cyan, fontWeight: 600, minWidth: 100,
                    }}>
                      EFFECTIVE
                    </th>
                    <th style={{
                      padding: '2px 8px', textAlign: 'center',
                      fontFamily: T.font.mono, fontSize: T.fontSize.badge,
                      color: T.text.muted, fontWeight: 500, width: 52,
                    }}>
                      CONF
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {fields.map(field => {
                    const { onTabNext, onTabPrev } = makeTabHandlers(field.fieldId);
                    return (
                      <AssumptionRow
                        key={field.fieldId}
                        field={field}
                        hasSubjectHistory={hasSubjectHistory}
                        onOverride={onOverride ?? (() => {})}
                        onRevert={onRevert ?? (() => {})}
                        onOpenDrilldown={openDrilldown}
                        editRefSetter={editRefSetter}
                        onTabNext={onTabNext}
                        onTabPrev={onTabPrev}
                      />
                    );
                  })}
                </tbody>
              </table>

              {/* Collision panel */}
              {hasCollisions && (
                <div style={{ padding: '0 8px 6px' }}>
                  <CollisionPanel
                    collisions={collisions}
                    fields={fields}
                    subjectSnapshotCount={subjectSnapshotCount}
                    onReview={fid => {
                      setDrilldownFieldId(fid);
                    }}
                  />
                </div>
              )}

              {/* No-subject-history note */}
              {!hasSubjectHistory && (
                <div style={{
                  padding: '3px 8px',
                  fontFamily: T.font.mono, fontSize: T.fontSize.badge,
                  color: T.text.muted,
                  borderTop: `1px solid ${T.border.subtle}30`,
                }}>
                  ⓘ Upload a rent roll to enable 3-col subject calibration
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drilldown modal (portal-style, rendered at end of component tree) */}
        {drilldownField && (
          <DrilldownModal
            field={drilldownField}
            onClose={closeDrilldown}
            onOpenEdit={focusDrilldownEdit}
          />
        )}
      </>
    );
  },
);
