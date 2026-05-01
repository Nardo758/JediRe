/**
 * PlausibilityBadge — colored badge showing d-value and plausibility band
 *
 * Displayed next to the Assumptions heading. Shows d = X.XX with
 * a colored background based on the band (green → yellow → orange → red).
 * Clicking opens a detailed breakdown panel.
 *
 * Phase B (M36-B) — Plausibility UI
 */

import React, { useState } from 'react';
import type { PlausibilityResult } from '../../api/sigmaApi';
import { bandColor } from '../../api/sigmaApi';
import PlausibilityPanel from './PlausibilityPanel';

interface PlausibilityBadgeProps {
  result: PlausibilityResult | null;
  loading: boolean;
  onReScore: () => void;
}

const styles = {
  wrapper: {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: 6,
    position: 'relative' as const,
  },
  badge: (colors: ReturnType<typeof bandColor>): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    background: colors.bg,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    transition: 'opacity 0.15s',
    userSelect: 'none',
  }),
  dValue: {
    fontSize: 10,
    opacity: 0.7,
  },
  refreshBtn: {
    background: 'transparent',
    border: '1px solid #444',
    color: '#888',
    borderRadius: 4,
    padding: '1px 6px',
    fontSize: 11,
    cursor: 'pointer',
  },
  loading: {
    color: '#888',
    fontSize: 11,
    fontStyle: 'italic' as const,
  },
  error: {
    color: '#f87171',
    fontSize: 11,
  },
};

export default function PlausibilityBadge({ result, loading, onReScore }: PlausibilityBadgeProps) {
  const [showPanel, setShowPanel] = useState(false);

  if (loading) {
    return (
      <span style={styles.wrapper}>
        <span style={styles.loading}>⏳ scoring...</span>
      </span>
    );
  }

  if (!result) {
    return (
      <span style={styles.wrapper}>
        <span style={styles.error}>⚠ plausibility unavailable</span>
        <button style={styles.refreshBtn} onClick={onReScore} title="Retry plausibility scoring">
          ⟳
        </button>
      </span>
    );
  }

  const { mahalanobisD, band } = result;
  const colors = bandColor(band);

  return (
    <span style={styles.wrapper}>
      <span
        style={styles.badge(colors)}
        onClick={() => setShowPanel(!showPanel)}
        title={`d = ${mahalanobisD.toFixed(2)} — click for details`}
      >
        <span>d = {mahalanobisD.toFixed(2)}</span>
        <span style={styles.dValue}>{band}</span>
      </span>
      <button style={styles.refreshBtn} onClick={onReScore} title="Re-score plausibility">
        ⟳
      </button>

      {showPanel && (
        <PlausibilityPanel result={result} onClose={() => setShowPanel(false)} />
      )}
    </span>
  );
}
