import React from 'react';
import { T } from './tokens';
import { formatValue } from './formatHelpers';
import type { CollisionEntry, AssumptionFieldDef } from './types';

interface CollisionPanelProps {
  collisions: CollisionEntry[];
  fields: AssumptionFieldDef[];
  subjectSnapshotCount?: number;
  onReview?: (fieldId: string) => void;
}

export function CollisionPanel({
  collisions,
  fields,
  subjectSnapshotCount,
  onReview,
}: CollisionPanelProps) {
  if (collisions.length === 0) return null;

  const hasSevere   = collisions.some(c => c.severity === 'severe');
  const hasMaterial = collisions.some(c => c.severity === 'material');

  const borderColor  = hasSevere ? T.border.severe : T.border.warn;
  const bgColor      = hasSevere ? T.bg.severeSubtle : T.bg.warnSubtle;
  const headerColor  = hasSevere ? T.text.red : T.text.amber;
  const borderWidth  = hasSevere ? 3 : 1;

  const labelFor = (fieldId: string) =>
    fields.find(f => f.fieldId === fieldId)?.label ?? fieldId;

  const narrativeCollisions = collisions.filter(c => c.narrative).slice(0, 3);

  return (
    <div
      role="alert"
      aria-label={`${collisions.length} peer collision${collisions.length > 1 ? 's' : ''} detected`}
      style={{
        border: `${borderWidth}px solid ${borderColor}`,
        background: bgColor,
        borderRadius: 2,
        margin: '4px 0 0 0',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 10px',
        borderBottom: `1px solid ${borderColor}50`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: T.font.mono, fontSize: T.fontSize.detail,
            color: headerColor, fontWeight: hasSevere ? 700 : 600,
            letterSpacing: 0.5,
          }}>
            ⚠ {hasSevere ? 'SEVERE' : 'MATERIAL'} PEER COLLISION{collisions.length > 1 ? 'S' : ''}
          </span>
          <span style={{
            fontFamily: T.font.mono, fontSize: T.fontSize.badge,
            color: headerColor, background: `${headerColor}18`,
            border: `1px solid ${headerColor}40`, borderRadius: 2,
            padding: '0 4px', lineHeight: '12px',
          }}>
            {collisions.length}
          </span>
        </div>
        {onReview && (
          <button
            onClick={() => onReview(collisions[0].fieldId)}
            style={{
              fontFamily: T.font.mono, fontSize: T.fontSize.badge,
              color: headerColor, background: 'none',
              border: `1px solid ${headerColor}50`, borderRadius: 2,
              padding: '1px 6px', cursor: 'pointer',
            }}
          >
            REVIEW →
          </button>
        )}
      </div>

      {/* Collision chips */}
      <div style={{ padding: '4px 10px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {collisions.map(c => {
          const field = fields.find(f => f.fieldId === c.fieldId);
          const fmt   = field?.format ?? 'num';
          return (
            <span
              key={c.fieldId}
              onClick={() => onReview?.(c.fieldId)}
              style={{
                fontFamily: T.font.mono, fontSize: T.fontSize.badge,
                color: c.severity === 'severe' ? T.text.red : T.text.amber,
                background: c.severity === 'severe' ? `${T.text.red}10` : `${T.text.amber}10`,
                border: `1px solid ${c.severity === 'severe' ? T.text.red : T.text.amber}30`,
                padding: '2px 6px', borderRadius: 2,
                cursor: onReview ? 'pointer' : 'default',
              }}
            >
              {labelFor(c.fieldId).toUpperCase()}:&nbsp;
              {formatValue(c.subjectValue, fmt)} vs {formatValue(c.peerValue, fmt)}&nbsp;
              ({c.deltaSigma.toFixed(1)}σ)
            </span>
          );
        })}
      </div>

      {/* Narrative bullets (max 3) */}
      {narrativeCollisions.length > 0 && (
        <div style={{ padding: '2px 10px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {narrativeCollisions.map(c => (
            <div key={c.fieldId} style={{
              fontFamily: T.font.mono, fontSize: T.fontSize.badge,
              color: T.text.secondary, lineHeight: 1.5,
            }}>
              · {c.narrative}
            </div>
          ))}
        </div>
      )}

      {/* Footer: subject sample size */}
      {subjectSnapshotCount != null && (
        <div style={{
          padding: '2px 10px 4px',
          fontFamily: T.font.mono, fontSize: T.fontSize.badge,
          color: T.text.muted,
        }}>
          Subject: {subjectSnapshotCount} snapshot{subjectSnapshotCount !== 1 ? 's' : ''} · σ prior = 15% of peer value
        </div>
      )}
    </div>
  );
}
