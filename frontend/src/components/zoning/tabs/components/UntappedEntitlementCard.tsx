import React from 'react';

interface UntappedEntitlementCardProps {
  existingUnits: number;
  maxAllowedUnits: number;
  existingGFA: number;
  maxAllowedGFA: number;
  existingStories: number;
  maxAllowedStories: number;
  existingCoveragePct?: number;
  maxAllowedCoveragePct?: number;
}

const T = {
  bg: "#0a0f1a",
  bgCard: "#0f1729",
  bgCardAlt: "#111d33",
  border: "#1e2d4a",
  borderLit: "#2a4070",
  text: "#e2e8f0",
  textMuted: "#64748b",
  accent: "#3b82f6",
  green: "#22c55e",
};

const FONT = {
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  body: "'IBM Plex Sans', -apple-system, sans-serif",
};

export default function UntappedEntitlementCard({
  existingUnits,
  maxAllowedUnits,
  existingGFA,
  maxAllowedGFA,
  existingStories,
  maxAllowedStories,
  existingCoveragePct = 0,
  maxAllowedCoveragePct = 100,
}: UntappedEntitlementCardProps) {
  const untappedUnits = Math.max(0, maxAllowedUnits - existingUnits);
  const untappedGFA = Math.max(0, maxAllowedGFA - existingGFA);
  const untappedStories = Math.max(0, maxAllowedStories - existingStories);
  const untappedCoverage = Math.max(0, maxAllowedCoveragePct - existingCoveragePct);

  const hasUntapped = untappedUnits > 0 || untappedGFA > 0 || untappedStories > 0;

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${T.bgCardAlt} 0%, ${T.bgCard} 100%)`,
        border: `2px solid ${T.borderLit}`,
        borderRadius: 8,
        padding: 24,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          fontFamily: FONT.mono,
          color: T.green,
          marginBottom: 16,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        UNTAPPED ENTITLEMENT
      </div>

      {hasUntapped ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Units */}
          <div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                fontFamily: FONT.mono,
                color: T.green,
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              +{untappedUnits.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, fontFamily: FONT.mono }}>
              additional units
            </div>
            <div style={{ fontSize: 9, color: T.text, marginTop: 6, fontFamily: FONT.body }}>
              Current: {existingUnits.toLocaleString()} | Allowed: {maxAllowedUnits.toLocaleString()}
            </div>
          </div>

          {/* GFA */}
          <div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                fontFamily: FONT.mono,
                color: T.green,
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              +{(untappedGFA / 1000).toFixed(0)}K
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, fontFamily: FONT.mono }}>
              additional SF
            </div>
            <div style={{ fontSize: 9, color: T.text, marginTop: 6, fontFamily: FONT.body }}>
              Current: {(existingGFA / 1000).toFixed(0)}K | Allowed: {(maxAllowedGFA / 1000).toFixed(0)}K
            </div>
          </div>

          {/* Stories */}
          <div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                fontFamily: FONT.mono,
                color: T.green,
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              +{untappedStories}
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, fontFamily: FONT.mono }}>
              additional stories
            </div>
            <div style={{ fontSize: 9, color: T.text, marginTop: 6, fontFamily: FONT.body }}>
              Current: {existingStories} | Allowed: {maxAllowedStories}
            </div>
          </div>

          {/* Coverage */}
          <div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                fontFamily: FONT.mono,
                color: T.green,
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              {untappedCoverage.toFixed(0)}%
            </div>
            <div style={{ fontSize: 10, color: T.textMuted, fontFamily: FONT.mono }}>
              coverage available
            </div>
            <div style={{ fontSize: 9, color: T.text, marginTop: 6, fontFamily: FONT.body }}>
              Current: {existingCoveragePct.toFixed(0)}% | Allowed: {maxAllowedCoveragePct.toFixed(0)}%
            </div>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: T.textMuted, fontFamily: FONT.body }}>
          <span style={{ color: T.text, fontWeight: 600 }}>No untapped entitlement.</span> The existing building
          is already utilizing the maximum allowed under current zoning. Further development would require rezoning or
          demolition/rebuild.
        </div>
      )}
    </div>
  );
}
