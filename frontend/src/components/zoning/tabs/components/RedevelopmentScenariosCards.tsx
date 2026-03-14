import React from 'react';
import { ExpansionScenario } from '../../../../utils/scenarios.utils';

interface RedevelopmentScenariosCardsProps {
  scenarios: ExpansionScenario[];
  onSelectScenario?: (scenario: ExpansionScenario) => void;
}

const T = {
  bg: "#0a0f1a",
  bgCard: "#0f1729",
  bgCardAlt: "#111d33",
  bgHover: "#162040",
  border: "#1e2d4a",
  borderLit: "#2a4070",
  text: "#e2e8f0",
  textMuted: "#64748b",
  textDim: "#475569",
  accent: "#3b82f6",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  cyan: "#06b6d4",
};

const FONT = {
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  body: "'IBM Plex Sans', -apple-system, sans-serif",
};

function getRiskColor(riskLevel: 'low' | 'medium' | 'high'): string {
  switch (riskLevel) {
    case 'low':
      return T.green;
    case 'medium':
      return T.amber;
    case 'high':
      return T.red;
  }
}

export default function RedevelopmentScenariosCards({
  scenarios,
  onSelectScenario,
}: RedevelopmentScenariosCardsProps) {
  return (
    <div
      style={{
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          fontFamily: FONT.mono,
          color: T.accent,
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        REDEVELOPMENT SCENARIOS
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {scenarios.map((scenario) => {
          const riskColor = getRiskColor(scenario.riskLevel);
          const isStructuralFlag = scenario.notes?.includes('structural');

          return (
            <div
              key={scenario.id}
              onClick={() => onSelectScenario?.(scenario)}
              style={{
                background: T.bgCardAlt,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                padding: 12,
                cursor: onSelectScenario ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (onSelectScenario) {
                  (e.currentTarget as HTMLDivElement).style.background = T.bgHover;
                  (e.currentTarget as HTMLDivElement).style.borderColor = T.borderLit;
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = T.bgCardAlt;
                (e.currentTarget as HTMLDivElement).style.borderColor = T.border;
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, fontFamily: FONT.mono, color: T.text }}>
                    {scenario.name}
                  </div>
                  <div style={{ fontSize: 9, color: T.textMuted, fontFamily: FONT.mono, marginTop: 2 }}>
                    {scenario.description}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 7,
                    fontWeight: 700,
                    color: riskColor,
                    background: riskColor + '20',
                    padding: '3px 6px',
                    borderRadius: 3,
                    fontFamily: FONT.mono,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {scenario.riskLevel.toUpperCase()}
                </span>
              </div>

              {/* Structural flag */}
              {isStructuralFlag && (
                <div
                  style={{
                    background: T.bgCard,
                    border: `1px solid ${T.amber}20`,
                    borderRadius: 4,
                    padding: 6,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontSize: 8, fontWeight: 700, color: T.amber, fontFamily: FONT.mono }}>
                    ⚠ REQUIRES STRUCTURAL ANALYSIS
                  </div>
                </div>
              )}

              {/* Units metric */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 900, fontFamily: FONT.mono, color: T.accent }}>
                  {scenario.maxUnits.toLocaleString()}
                </div>
                <div style={{ fontSize: 9, color: T.textMuted, fontFamily: FONT.mono }}>
                  total units
                  {scenario.unitAdditions !== undefined && scenario.unitAdditions > 0 && (
                    <span style={{ color: T.green }}> (+{scenario.unitAdditions})</span>
                  )}
                </div>
              </div>

              {/* Key details - 2x2 grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 8, color: T.textDim, fontFamily: FONT.mono }}>APPROVAL PATH</div>
                  <div style={{ fontSize: 10, fontFamily: FONT.mono, color: T.text }}>
                    {scenario.approvalPath === 'by-right' ? 'By-Right' : scenario.approvalPath.toUpperCase()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: T.textDim, fontFamily: FONT.mono }}>TIMELINE</div>
                  <div style={{ fontSize: 10, fontFamily: FONT.mono, color: T.text }}>
                    {scenario.timelineMonths.min}-{scenario.timelineMonths.max} mo
                  </div>
                </div>
                {scenario.storiesAdditions !== undefined && (
                  <div>
                    <div style={{ fontSize: 8, color: T.textDim, fontFamily: FONT.mono }}>NEW STORIES</div>
                    <div style={{ fontSize: 10, fontFamily: FONT.mono, color: T.text }}>
                      {scenario.storiesAdditions > 0 ? `+${scenario.storiesAdditions}` : '—'}
                    </div>
                  </div>
                )}
                {scenario.sfAdditions !== undefined && (
                  <div>
                    <div style={{ fontSize: 8, color: T.textDim, fontFamily: FONT.mono }}>NEW SF</div>
                    <div style={{ fontSize: 10, fontFamily: FONT.mono, color: T.text }}>
                      {scenario.sfAdditions > 0 ? `+${(scenario.sfAdditions / 1000).toFixed(0)}K` : '—'}
                    </div>
                  </div>
                )}
              </div>

              {/* Compliance cost */}
              {scenario.complianceCost !== undefined && scenario.complianceCost > 0 && (
                <div
                  style={{
                    background: T.bgCard,
                    border: `1px solid ${T.border}`,
                    borderRadius: 4,
                    padding: 8,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontSize: 8, color: T.textDim, fontFamily: FONT.mono, marginBottom: 2 }}>
                    ESTIMATED COST
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, fontFamily: FONT.mono, color: T.amber }}>
                    ${(scenario.complianceCost / 1e6).toFixed(1)}M
                  </div>
                </div>
              )}

              {/* Notes */}
              {scenario.notes && (
                <div style={{ fontSize: 9, color: T.textMuted, fontFamily: FONT.body, lineHeight: 1.4 }}>
                  {scenario.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
