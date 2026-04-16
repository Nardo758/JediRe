import React from 'react';
import { getUtilizationColor, getUtilizationLabel } from '../../../../utils/conformance.utils';

interface UtilizationBarProps {
  label: string;
  current: number;
  allowed: number;
  unit: string;
  grandfathered?: string;
  passing: boolean;
}

const T = {
  bg: "#0a0f1a",
  bgCard: "#0f1729",
  border: "#1e2d4a",
  text: "#e2e8f0",
  textMuted: "#64748b",
  textDim: "#475569",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
};

const FONT = {
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
};

export default function UtilizationBar({
  label,
  current,
  allowed,
  unit,
  grandfathered,
  passing,
}: UtilizationBarProps) {
  const utilization = allowed > 0 ? Math.min(100, (current / allowed) * 100) : 0;
  const color = getUtilizationColor(utilization);
  const statusLabel = getUtilizationLabel(utilization);

  const colorMap = {
    green: T.green,
    amber: T.amber,
    red: T.red,
  };

  const barColor = colorMap[color];

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: FONT.mono, color: T.text }}>
            {label}
          </span>
          {!passing && (
            <span
              style={{
                display: 'inline-block',
                marginLeft: 8,
                fontSize: 9,
                fontWeight: 700,
                color: T.red,
                background: '#7f1d1d',
                padding: '2px 6px',
                borderRadius: 3,
                fontFamily: FONT.mono,
              }}
            >
              ✗ NONCONFORMING
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, fontFamily: FONT.mono, color: barColor }}>
          {utilization.toFixed(0)}% · {current.toLocaleString()} of {allowed.toLocaleString()} {unit}
        </div>
      </div>

      {/* Utilization bar */}
      <div
        style={{
          height: 6,
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 4,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${utilization}%`,
            background: barColor,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: T.textDim, fontFamily: FONT.mono }}>
          {statusLabel}
        </span>
        {grandfathered && (
          <span style={{ fontSize: 9, color: T.textMuted, fontFamily: FONT.mono, fontStyle: 'italic' }}>
            Grandfathered — {grandfathered}
          </span>
        )}
      </div>
    </div>
  );
}
