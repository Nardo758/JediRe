import React from 'react';

interface NonconformingWarningProps {
  nonconformingItems: string[];
  yearBuilt?: number;
}

const T = {
  bgCard: "#0f1729",
  border: "#1e2d4a",
  text: "#e2e8f0",
  textMuted: "#64748b",
  textDim: "#475569",
  red: "#ef4444",
  redDim: "#991b1b",
};

const FONT = {
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  body: "'IBM Plex Sans', -apple-system, sans-serif",
};

export default function NonconformingWarning({
  nonconformingItems,
  yearBuilt,
}: NonconformingWarningProps) {
  if (nonconformingItems.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        background: T.redDim + '30',
        border: `2px solid ${T.red}40`,
        borderRadius: 6,
        padding: 12,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontSize: 16, marginTop: 2, flexShrink: 0 }}>⚠</div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: FONT.mono,
              color: T.red,
              marginBottom: 6,
            }}
          >
            NONCONFORMING ITEMS — GRANDFATHERED STATUS AT RISK
          </div>
          <div style={{ fontSize: 10, color: T.text, fontFamily: FONT.body, marginBottom: 8 }}>
            This building has the following nonconforming items that are currently grandfathered (built under prior
            code):
          </div>

          {/* Items list */}
          <ul style={{ margin: 0, paddingLeft: 16, marginBottom: 8, fontSize: 9, color: T.text, fontFamily: FONT.body }}>
            {nonconformingItems.map((item, idx) => (
              <li key={idx} style={{ marginBottom: 3 }}>
                {item}
              </li>
            ))}
          </ul>

          {/* Critical warning */}
          <div
            style={{
              background: T.bgCard,
              border: `1px solid ${T.red}30`,
              borderRadius: 4,
              padding: 8,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                fontFamily: FONT.mono,
                color: T.red,
                marginBottom: 4,
              }}
            >
              ⚡ CRITICAL:
            </div>
            <div style={{ fontSize: 9, color: T.textMuted, fontFamily: FONT.body }}>
              <strong>Grandfathered status VOIDS if demolition exceeds 50% of structure.</strong> If you demolish more
              than 50% of the existing building, you lose legal nonconforming protection and must rebuild to current
              code compliance — which may prohibit uses or require costly upgrades.
            </div>
          </div>

          {/* Context */}
          {yearBuilt && (
            <div style={{ fontSize: 9, color: T.textMuted, fontFamily: FONT.body }}>
              Built <strong>{yearBuilt}</strong> under prior zoning code. Changes to code in {yearBuilt + 5}-{yearBuilt + 15} window have since restricted these uses/setbacks/parking ratios.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
