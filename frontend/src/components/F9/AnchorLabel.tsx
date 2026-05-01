/**
 * AnchorLabel — ℹ tooltip for per-line-item anchor data
 *
 * Renders an ℹ icon next to expense field names. On hover,
 * shows: anchor description, macro series, timing, state rule override.
 * If the user's growth rate diverges from the anchor rate, shows
 * a highlighted warning.
 *
 * Phase B3 — see M36_PROFORMA_LINE_ITEM_ANCHORS.md
 */

import React, { useState } from 'react';
import type { AnchorTooltipData } from '../../hooks/useProformaAnchors';

interface AnchorLabelProps {
  expenseKey: string;
  anchorTooltip: AnchorTooltipData | null;
  originalGrowth?: number;
  anchorGrowth?: number;
}

const styles = {
  wrapper: {
    position: 'relative' as const,
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
  },
  icon: (hasAnchor: boolean): React.CSSProperties => ({
    cursor: 'pointer',
    marginLeft: 3,
    fontSize: 9,
    color: hasAnchor ? '#f0c419' : '#555',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 13,
    height: 13,
    borderRadius: '50%',
    border: `1px solid ${hasAnchor ? '#f0c419' : '#444'}`,
    background: 'transparent',
    lineHeight: '13px',
    fontStyle: 'italic',
    fontWeight: 700,
    userSelect: 'none',
  } as React.CSSProperties),
  tooltip: {
    position: 'absolute' as const,
    zIndex: 100,
    top: '100%',
    left: 0,
    marginTop: 6,
    background: '#1a1a1a',
    border: '1px solid #555',
    borderRadius: 6,
    padding: '10px 14px',
    minWidth: 240,
    maxWidth: 320,
    fontSize: 10,
    lineHeight: 1.7,
    color: '#ddd',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    whiteSpace: 'normal' as const,
  },
  label: {
    fontWeight: 700,
    fontSize: 11,
    color: '#fff',
    marginBottom: 6,
  },
  field: {
    color: '#aaa',
    marginBottom: 1,
  },
  key: {
    color: '#f0c419',
  },
  divergence: (userHigher: boolean): React.CSSProperties => ({
    marginTop: 6,
    padding: '6px 8px',
    borderRadius: 4,
    background: userHigher ? '#2a1a1a' : '#1a2a1a',
    color: userHigher ? '#f77' : '#7f7',
    fontSize: 10,
    lineHeight: 1.5,
  } as React.CSSProperties),
  stateRule: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid #333',
    fontSize: 10,
    color: '#aaa',
  },
  timing: {
    display: 'inline-block',
    marginLeft: 6,
    padding: '1px 5px',
    borderRadius: 3,
    fontSize: 8,
    background: '#333',
    color: '#999',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
};

function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export function AnchorLabel({ expenseKey, anchorTooltip, originalGrowth, anchorGrowth }: AnchorLabelProps) {
  const [open, setOpen] = useState(false);

  if (!anchorTooltip?.anchor) return null;

  const { anchor, stateRule } = anchorTooltip;
  const hasAnchor = !!anchor;
  const hasDivergence = originalGrowth != null && anchorGrowth != null &&
    Math.abs(originalGrowth - anchorGrowth) > 0.005;
  const userHigher = hasDivergence && originalGrowth != null && anchorGrowth != null &&
    originalGrowth > anchorGrowth;

  return (
    <span style={styles.wrapper}>
      <span
        style={styles.icon(hasAnchor)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        title={anchor.description}
        role="button"
        tabIndex={0}
      >
        i
      </span>
      {open && (
        <div style={styles.tooltip}>
          <div style={styles.label}>
            {anchor.label || expenseKey}
            <span style={styles.timing}>{anchor.timingChangeType}</span>
          </div>

          <div style={styles.field}>
            <span style={styles.key}>Anchor:</span> {anchor.description}
          </div>

          <div style={styles.field}>
            <span style={styles.key}>Premium:</span> {formatPct(anchor.structuralPremium)}
          </div>

          {anchor.macroSeriesId && (
            <div style={styles.field}>
              <span style={styles.key}>Series:</span> {anchor.macroSeriesId}
            </div>
          )}

          {hasDivergence && originalGrowth != null && anchorGrowth != null && (
            <div style={styles.divergence(userHigher)}>
              <strong>Divergence detected</strong><br />
              You set <span style={{ fontWeight: 700 }}>{formatPct(originalGrowth)}</span>
              {' → '}anchor suggests <span style={{ fontWeight: 700 }}>{formatPct(anchorGrowth)}</span>
              <br />
              {userHigher
                ? 'Your assumption exceeds the anchor baseline. Consider the macro context.'
                : 'Your assumption is below the anchor baseline.'}
            </div>
          )}

          {stateRule && (
            <div style={styles.stateRule}>
              <span style={styles.key}>State Rule:</span>
              <div style={{ marginTop: 2 }}>{stateRule.ruleText}</div>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

export default AnchorLabel;
