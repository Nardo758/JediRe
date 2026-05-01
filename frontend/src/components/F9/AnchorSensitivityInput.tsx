/**
 * AnchorSensitivityInput — Inline override for anchor growth rates
 *
 * Appears next to the anchor ℹ icon in expense rows. Lets the user
 * override the anchor-computed growth rate for "what-if" scenarios.
 *
 * When an override is active, the expense row uses the user's rate
 * instead of the anchor rate. The override is visual-only — the
 * anchor interceptor runs server-side at submission time.
 *
 * Phase B6 — M36_PROFORMA_LINE_ITEM_ANCHORS.md
 */

import React, { useState } from 'react';
import type { AnchorTooltipData } from '../../hooks/useProformaAnchors';

interface AnchorSensitivityInputProps {
  expenseKey: string;
  anchorTooltip: AnchorTooltipData | null;
  /** Current rate from the expense row's own state */
  currentGrowth: number;
  /** Called when user sets an override */
  onOverride: (expenseKey: string, rate: number | null) => void;
  /** Current override value (null = using anchor) */
  override: number | null;
}

const styles = {
  wrapper: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    marginLeft: 2,
  },
  toggleBtn: (active: boolean): React.CSSProperties => ({
    cursor: 'pointer',
    fontSize: 8,
    padding: '1px 5px',
    borderRadius: 3,
    border: `1px solid ${active ? '#3a7' : '#444'}`,
    background: active ? '#1a3a2a' : 'transparent',
    color: active ? '#3a7' : '#666',
    fontFamily: 'monospace',
    lineHeight: '14px',
    userSelect: 'none',
    transition: 'all 0.15s',
  } as React.CSSProperties),
  input: {
    width: 48,
    padding: '1px 4px',
    fontSize: 9,
    fontFamily: 'monospace',
    background: '#1a1a1a',
    border: '1px solid #555',
    borderRadius: 3,
    color: '#ddd',
    textAlign: 'right' as const,
    outline: 'none',
  },
  pct: {
    fontSize: 8,
    color: '#888',
    fontFamily: 'monospace',
  },
  label: (active: boolean): React.CSSProperties => ({
    fontSize: 7,
    color: active ? '#3a7' : '#666',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
    cursor: 'default',
  } as React.CSSProperties),
};

export function AnchorSensitivityInput({
  expenseKey,
  anchorTooltip,
  currentGrowth,
  onOverride,
  override,
}: AnchorSensitivityInputProps) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(
    override != null ? (override * 100).toFixed(1) : ''
  );

  // Only show for line items that have an anchor
  if (!anchorTooltip?.anchor) return null;

  const hasOverride = override != null;
  const isActive = false; // we removed the toggle mode

  const handleBlur = () => {
    setEditing(false);
    const num = parseFloat(inputVal);
    if (isNaN(num) || inputVal.trim() === '') {
      onOverride(expenseKey, null);
      setInputVal('');
    } else {
      onOverride(expenseKey, num / 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur();
    if (e.key === 'Escape') {
      setInputVal(override != null ? (override * 100).toFixed(1) : '');
      setEditing(false);
    }
  };

  return (
    <span style={styles.wrapper}>
      {/* Minimal override: just show a clickable rate that opens an inline input */}
      {!editing ? (
        <span
          onClick={() => { setEditing(true); setInputVal(hasOverride ? (override * 100).toFixed(1) : (currentGrowth * 100).toFixed(1)); }}
          style={{
            ...styles.toggleBtn(hasOverride),
            cursor: 'pointer',
          }}
          title={hasOverride
            ? `Override: ${(override * 100).toFixed(1)}% (anchor: ${anchorTooltip.anchor?.description ?? 'N/A'})`
            : `Click to override anchor rate`}
        >
          {hasOverride ? `${(override * 100).toFixed(1)}%` : '⚡'}
        </span>
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <input
            style={styles.input}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            type="text"
          />
          <span style={styles.pct}>%</span>
        </span>
      )}
    </span>
  );
}

export default AnchorSensitivityInput;
