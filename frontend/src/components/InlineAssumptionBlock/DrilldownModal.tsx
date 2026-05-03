import React, { useEffect, useRef } from 'react';
import { T } from './tokens';
import { formatValue } from './EditableValueCell';
import type { AssumptionFieldDef, DrilldownLayer } from './types';

interface DrilldownModalProps {
  field: AssumptionFieldDef;
  onClose: () => void;
  onOpenEdit: () => void;
}

export function DrilldownModal({ field, onClose, onOpenEdit }: DrilldownModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  // Build layer table rows (Platform → Peer Set → Subject → Override → EFFECTIVE)
  const layers: DrilldownLayer[] = [
    {
      label: 'Platform Baseline',
      value: null,
      active: false,
      note: 'Hard-coded prior — lowest authority',
    },
    {
      label: 'Peer Set Posterior',
      value: field.peerValue,
      active: field.subjectValue == null,
      note: field.peerValue != null
        ? 'Submarket / class / vintage bucket'
        : 'No platform calibration for this scope',
    },
    {
      label: 'Subject History',
      value: field.subjectValue,
      active: field.subjectValue != null && field.overrideValue == null,
      note: field.subjectValue != null
        ? field.blendWeight != null && field.blendWeight < 1 && field.peerValue != null
          ? `w=${(field.blendWeight * 100).toFixed(0)}% blend — effective = ${(field.blendWeight * 100).toFixed(0)}% subject + ${((1 - field.blendWeight) * 100).toFixed(0)}% peer`
          : 'Full-confidence subject observation'
        : 'No rent roll uploaded for this deal',
    },
    {
      label: 'User Override',
      value: field.overrideValue ?? null,
      active: field.overrideValue != null,
      note: field.overrideValue != null
        ? 'User-set value — highest authority'
        : 'No override active',
    },
    {
      label: 'EFFECTIVE',
      value: field.overrideValue ?? field.effectiveValue,
      active: true,
      note: 'Value used in projections',
    },
  ];

  const activeLayerIdx = (() => {
    if (field.overrideValue != null) return 3;
    if (field.subjectValue != null) return 2;
    if (field.peerValue != null) return 1;
    return 0;
  })();

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Drilldown: ${field.label}`}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(5, 8, 16, 0.80)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 640, maxWidth: '90vw',
          background: T.bg.panel,
          border: `1px solid ${T.border.medium}`,
          borderRadius: 2,
          display: 'flex', flexDirection: 'column',
          maxHeight: '80vh',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 12px',
          background: T.bg.header,
          borderBottom: `1px solid ${T.border.medium}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: T.font.mono, fontSize: T.fontSize.section, fontWeight: 700,
              color: T.text.primary, letterSpacing: 0.5,
            }}>
              {field.label.toUpperCase()} · DRILLDOWN
            </span>
            <span style={{
              fontFamily: T.font.mono, fontSize: T.fontSize.badge,
              color: T.text.muted, background: `${T.text.muted}18`,
              border: `1px solid ${T.text.muted}30`, borderRadius: 2,
              padding: '0 4px', lineHeight: '12px',
            }}>
              {field.fieldId}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: T.text.muted, fontSize: 14, cursor: 'pointer',
              padding: 4, lineHeight: 1,
            }}
            aria-label="Close drilldown"
          >✕</button>
        </div>

        {/* Source breakdown table */}
        <div style={{ overflowY: 'auto', padding: '12px 0 0 0' }}>
          <div style={{ padding: '0 12px 8px', fontFamily: T.font.mono, fontSize: T.fontSize.badge, color: T.text.muted, letterSpacing: 0.5 }}>
            SOURCE LAYER BREAKDOWN
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: T.font.mono, fontSize: T.fontSize.detail }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                <th style={{ padding: '3px 12px', textAlign: 'left', color: T.text.muted, fontWeight: 500 }}>LAYER</th>
                <th style={{ padding: '3px 12px', textAlign: 'right', color: T.text.muted, fontWeight: 500 }}>VALUE</th>
                <th style={{ padding: '3px 12px', textAlign: 'left', color: T.text.muted, fontWeight: 500, minWidth: 220 }}>NOTE</th>
              </tr>
            </thead>
            <tbody>
              {layers.map((layer, idx) => {
                const isEffective = idx === layers.length - 1;
                const isActive = idx === activeLayerIdx || isEffective;
                const isCurrent = idx === activeLayerIdx;
                return (
                  <tr
                    key={layer.label}
                    style={{
                      borderBottom: `1px solid ${T.border.subtle}${isEffective ? '' : '50'}`,
                      background: isEffective
                        ? `${T.text.cyan}06`
                        : isCurrent ? `${T.text.secondary}05` : 'transparent',
                    }}
                  >
                    <td style={{
                      padding: '5px 12px',
                      color: isEffective ? T.text.cyan : isCurrent ? T.text.primary : T.text.muted,
                      fontWeight: isEffective ? 700 : isCurrent ? 600 : 400,
                    }}>
                      {isCurrent && !isEffective && (
                        <span style={{ marginRight: 4, color: T.text.cyan, fontSize: T.fontSize.badge }}>▶</span>
                      )}
                      {layer.label}
                    </td>
                    <td style={{
                      padding: '5px 12px', textAlign: 'right',
                      color: isEffective ? T.text.primary
                           : layer.value != null ? (isCurrent ? T.text.primary : T.text.secondary)
                           : T.text.muted,
                      fontWeight: isEffective ? 700 : 400,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {layer.value != null ? formatValue(layer.value, field.format) : '—'}
                    </td>
                    <td style={{ padding: '5px 12px', color: T.text.muted, fontSize: T.fontSize.badge }}>
                      {layer.note}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Trajectory note */}
          <div style={{
            margin: '10px 12px',
            padding: '6px 10px',
            background: T.bg.panelAlt,
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 2,
          }}>
            <div style={{ fontFamily: T.font.mono, fontSize: T.fontSize.badge, color: T.text.muted, marginBottom: 4, letterSpacing: 0.5 }}>
              TRAJECTORY TREATMENT
            </div>
            <div style={{ fontFamily: T.font.mono, fontSize: T.fontSize.detail, color: T.text.secondary, lineHeight: 1.5 }}>
              {field.blendWeight != null && field.blendWeight > 0 && field.blendWeight < 1 && field.peerValue != null && field.subjectValue != null
                ? `Bayesian blend: w=${(field.blendWeight * 100).toFixed(0)}% × subject (${formatValue(field.subjectValue, field.format)}) + ${((1 - field.blendWeight) * 100).toFixed(0)}% × peer (${formatValue(field.peerValue, field.format)}) = ${formatValue(field.effectiveValue, field.format)}`
                : field.subjectValue != null
                  ? `Subject-first: full-confidence observation used directly (w=100%)`
                  : field.peerValue != null
                    ? `Peer-set posterior: no subject history — platform calibration used`
                    : `Baseline: no platform or subject data available for this scope`
              }
            </div>
            {field.narrative && (
              <div style={{ fontFamily: T.font.mono, fontSize: T.fontSize.detail, color: T.text.muted, marginTop: 4, lineHeight: 1.5 }}>
                {field.narrative}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          padding: '8px 12px',
          borderTop: `1px solid ${T.border.subtle}`,
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              fontFamily: T.font.mono, fontSize: T.fontSize.section,
              color: T.text.muted, background: T.bg.header,
              border: `1px solid ${T.border.medium}`, borderRadius: 2,
              padding: '4px 12px', cursor: 'pointer',
            }}
          >CLOSE</button>
          <button
            onClick={() => { onClose(); onOpenEdit(); }}
            style={{
              fontFamily: T.font.mono, fontSize: T.fontSize.section,
              color: T.bg.panel, background: T.accent.user,
              border: 'none', borderRadius: 2,
              padding: '4px 12px', cursor: 'pointer', fontWeight: 700,
            }}
          >OVERRIDE →</button>
        </div>
      </div>
    </div>
  );
}
