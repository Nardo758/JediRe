import React from 'react';
import { ComplianceTrigger } from '../../../../utils/scenarios.utils';

interface ComplianceTriggerAnalysisCardProps {
  triggers: ComplianceTrigger[];
  totalCost: number;
  expansionThreshold?: number;  // 50% threshold
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
  amber: "#f59e0b",
  amberDim: "#92400e",
};

const FONT = {
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  body: "'IBM Plex Sans', -apple-system, sans-serif",
};

export default function ComplianceTriggerAnalysisCard({
  triggers,
  totalCost,
  expansionThreshold = 50,
}: ComplianceTriggerAnalysisCardProps) {
  return (
    <div
      style={{
        background: T.bgCardAlt,
        border: `2px solid ${T.amber}40`,
        borderRadius: 6,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 20, marginTop: 2 }}>⚠</div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: FONT.mono,
              color: T.amber,
              marginBottom: 4,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            COMPLIANCE TRIGGER ANALYSIS
          </div>
          <div style={{ fontSize: 10, color: T.textDim, fontFamily: FONT.body }}>
            Any expansion exceeding <strong>{expansionThreshold}%</strong> of existing building value triggers full code
            compliance upgrade for entire property
          </div>
        </div>
      </div>

      {/* Cost breakdown */}
      {triggers.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT.mono, color: T.text, marginBottom: 8 }}>
            COMPLIANCE ITEMS:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {triggers.map((trigger, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: T.text, fontFamily: FONT.body }}>
                  • {trigger.item}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, fontFamily: FONT.mono, color: T.amber }}>
                  ${(trigger.estimatedCost / 1e6).toFixed(2)}M
                </span>
              </div>
            ))}
          </div>

          {/* Total line */}
          <div
            style={{
              borderTop: `1px solid ${T.border}`,
              marginTop: 12,
              paddingTop: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: FONT.mono, color: T.text }}>
              TOTAL COMPLIANCE COST
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: FONT.mono, color: T.amber }}>
              ${(totalCost / 1e6).toFixed(1)}M
            </span>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 10, color: T.textMuted, fontFamily: FONT.body, marginBottom: 12 }}>
          No compliance triggers identified for this scenario.
        </div>
      )}

      {/* Key implications */}
      <div
        style={{
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 4,
          padding: 10,
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 600, fontFamily: FONT.mono, color: T.text, marginBottom: 6 }}>
          KEY IMPLICATIONS:
        </div>
        <ul style={{ margin: 0, paddingLeft: 16, color: T.textMuted, fontFamily: FONT.body, fontSize: 9 }}>
          <li style={{ marginBottom: 4 }}>
            Compliance costs are NOT optional — exceeding the {expansionThreshold}% threshold triggers mandatory
            full code upgrade
          </li>
          <li style={{ marginBottom: 4 }}>
            These costs should be factored into your ProForma underwriting before committing to an expansion plan
          </li>
          <li>
            If compliance costs exceed the value created by the expansion, the project may not be economically feasible
          </li>
        </ul>
      </div>
    </div>
  );
}
