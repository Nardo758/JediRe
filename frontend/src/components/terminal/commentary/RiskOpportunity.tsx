import React from 'react';
import { BT } from '../theme';
import type { RiskItem, OpportunityItem } from '../../../stores/commentaryStore';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface RiskOpportunityProps {
  risks: RiskItem[];
  opportunities: OpportunityItem[];
  compact?: boolean;
}

const severityColors: Record<string, string> = {
  high: BT.text.red,
  medium: BT.text.amber,
  low: BT.text.green,
};

const impactColors: Record<string, string> = {
  high: BT.text.green,
  medium: BT.text.cyan,
  low: BT.text.muted,
};

export const RiskOpportunity: React.FC<RiskOpportunityProps> = ({ risks, opportunities, compact }) => {
  return (
    <div style={{ marginBottom: compact ? 8 : 16 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: BT.text.amber,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        borderBottom: `1px solid ${BT.text.amber}44`,
        paddingBottom: 4,
        marginBottom: 8,
        ...mono,
      }}>
        Risk & Opportunity
      </div>

      {risks.map((r, i) => (
        <div key={`r-${i}`} style={{
          display: 'flex',
          gap: 8,
          fontSize: 11,
          marginBottom: 4,
          padding: '4px 6px',
          background: `${severityColors[r.severity]}08`,
          borderLeft: `2px solid ${severityColors[r.severity]}`,
        }}>
          <span style={{ color: severityColors[r.severity], flexShrink: 0, fontWeight: 700, fontSize: 10, ...mono }}>
            {r.severity === 'high' ? '✗' : '⚠'}
          </span>
          <div>
            <span style={{ color: BT.text.primary, fontWeight: 600 }}>{r.label}</span>
            {!compact && (
              <span style={{ color: BT.text.muted, marginLeft: 4 }}>— {r.detail}</span>
            )}
          </div>
        </div>
      ))}

      <div style={{ height: 8 }} />

      {opportunities.map((o, i) => (
        <div key={`o-${i}`} style={{
          display: 'flex',
          gap: 8,
          fontSize: 11,
          marginBottom: 4,
          padding: '4px 6px',
          background: `${impactColors[o.impact]}08`,
          borderLeft: `2px solid ${impactColors[o.impact]}`,
        }}>
          <span style={{ color: impactColors[o.impact], flexShrink: 0, fontWeight: 700, fontSize: 10, ...mono }}>
            ▲
          </span>
          <div>
            <span style={{ color: BT.text.primary, fontWeight: 600 }}>{o.label}</span>
            {!compact && (
              <span style={{ color: BT.text.muted, marginLeft: 4 }}>— {o.detail}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
