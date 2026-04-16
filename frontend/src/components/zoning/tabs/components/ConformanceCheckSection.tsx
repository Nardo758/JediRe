import React from 'react';
import { ConformanceCheckData } from '../../../../utils/conformance.utils';
import UtilizationBar from './UtilizationBar';

interface ConformanceCheckSectionProps {
  conformance: ConformanceCheckData;
}

const T = {
  bg: "#0a0f1a",
  bgCard: "#0f1729",
  bgCardAlt: "#111d33",
  border: "#1e2d4a",
  text: "#e2e8f0",
  textMuted: "#64748b",
  textDim: "#475569",
  accent: "#3b82f6",
  red: "#ef4444",
};

const FONT = {
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
};

export default function ConformanceCheckSection({ conformance }: ConformanceCheckSectionProps) {
  const hasNonconforming = conformance.nonconformingItems.length > 0;

  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 6, padding: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          fontFamily: FONT.mono,
          color: T.accent,
          marginBottom: 16,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        CONFORMANCE CHECK — {conformance.totalConforming}/5 COMPLIANT
      </div>

      <div style={{ fontSize: 11, color: T.textDim, fontFamily: FONT.mono, marginBottom: 20 }}>
        Max units = MIN(density, FAR, height, coverage, parking). Comparing existing building to current
        zoning requirements.
      </div>

      {/* Utilization Bars */}
      <div style={{ marginBottom: 24 }}>
        <UtilizationBar
          label="Density (units/acre)"
          current={conformance.density.current}
          allowed={conformance.density.allowed}
          unit="units"
          passing={conformance.density.passing}
          grandfathered={conformance.density.grandfathered}
        />
        <UtilizationBar
          label="FAR (Floor Area Ratio)"
          current={conformance.far.current}
          allowed={conformance.far.allowed}
          unit="SF"
          passing={conformance.far.passing}
          grandfathered={conformance.far.grandfathered}
        />
        <UtilizationBar
          label="Height (feet / stories)"
          current={conformance.height.current}
          allowed={conformance.height.allowed}
          unit="ft"
          passing={conformance.height.passing}
          grandfathered={conformance.height.grandfathered}
        />
        <UtilizationBar
          label="Lot Coverage (%)"
          current={conformance.coverage.current}
          allowed={conformance.coverage.allowed}
          unit="%"
          passing={conformance.coverage.passing}
          grandfathered={conformance.coverage.grandfathered}
        />
        <UtilizationBar
          label="Parking (spaces)"
          current={conformance.parking.current}
          allowed={conformance.parking.allowed}
          unit="spaces"
          passing={conformance.parking.passing}
          grandfathered={conformance.parking.grandfathered}
        />
      </div>

      {/* Nonconforming Items */}
      {hasNonconforming && (
        <div style={{ background: T.bgCardAlt, border: `1px solid ${T.border}`, borderRadius: 4, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, fontFamily: FONT.mono, color: T.red, marginBottom: 8 }}>
            ⚠ NONCONFORMING ITEMS ({conformance.nonconformingItems.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {conformance.nonconformingItems.map((item, idx) => (
              <div key={idx} style={{ fontSize: 10, color: T.textMuted, fontFamily: FONT.mono }}>
                <div style={{ fontWeight: 600, color: T.text }}>{item.item}</div>
                <div style={{ marginTop: 2 }}>{item.detail}</div>
                {item.grandfatheredUntil && (
                  <div style={{ marginTop: 2, fontStyle: 'italic', color: T.textDim }}>
                    Grandfathered — {item.grandfatheredUntil}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
