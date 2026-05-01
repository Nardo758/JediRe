/**
 * SensitivityBar — Shows anchor override status in the F9SummaryBar
 *
 * Displays how many expense lines have been overridden vs anchored,
 * with a summary pill. Click to reset all overrides.
 */

import React from 'react';
import { BT } from '../deal/bloomberg-ui';

interface SensitivityBarProps {
  /** Number of overridden expense lines */
  overriddenCount: number;
  /** Total number of anchored expense lines */
  totalAnchored: number;
  /** Callback to reset all overrides */
  onResetOverrides?: () => void;
}

export function SensitivityBar({
  overriddenCount,
  totalAnchored,
  onResetOverrides,
}: SensitivityBarProps) {
  if (totalAnchored === 0) return null;

  const mono = BT.font.mono;
  const hasOverrides = overriddenCount > 0;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{
        fontFamily: mono, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5,
      }}>
        SENSITIVITY
      </span>

      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 3,
        background: hasOverrides ? '#2a1a1a' : 'transparent',
        border: `1px solid ${hasOverrides ? '#f77' : BT.border.subtle}`,
        cursor: 'default',
        userSelect: 'none',
      }}>
        <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: hasOverrides ? '#f77' : '#888' }}>
          {overriddenCount}
        </span>
        <span style={{ fontFamily: mono, fontSize: 8, color: hasOverrides ? '#f77' : '#666' }}>
          /
        </span>
        <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: '#aaa' }}>
          {totalAnchored}
        </span>
        <span style={{ fontFamily: mono, fontSize: 7, color: '#666', marginLeft: 2 }}>
          overridden
        </span>
      </span>

      {hasOverrides && onResetOverrides && (
        <button
          onClick={onResetOverrides}
          style={{
            fontFamily: mono, fontSize: 8, letterSpacing: 0.5,
            padding: '2px 6px', borderRadius: 3,
            border: '1px solid #555',
            background: 'transparent',
            color: '#888',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          title="Reset all sensitivity overrides"
        >
          reset
        </button>
      )}
    </span>
  );
}

export default SensitivityBar;
