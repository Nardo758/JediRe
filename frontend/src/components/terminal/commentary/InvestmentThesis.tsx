import React from 'react';
import { BT } from '../theme';
import type { ThesisPoint } from '../../../stores/commentaryStore';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface InvestmentThesisProps {
  recommendation: string;
  points: ThesisPoint[];
  compact?: boolean;
}

const colorMap: Record<string, string> = {
  green: BT.text.green,
  amber: BT.text.amber,
  red: BT.text.red,
};

export const InvestmentThesis: React.FC<InvestmentThesisProps> = ({ recommendation, points, compact }) => {
  const recColor = recommendation.includes('STRONG BUY') || recommendation.includes('BUY')
    ? BT.text.green
    : recommendation.includes('HOLD')
    ? BT.text.amber
    : BT.text.red;

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
        Investment Thesis
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: compact ? 8 : 12 }}>
        {points.map((pt, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11 }}>
            <span style={{ color: colorMap[pt.color] || BT.text.muted, flexShrink: 0 }}>{pt.icon}</span>
            <span style={{ color: BT.text.secondary }}>{pt.text}</span>
          </div>
        ))}
      </div>
      <div style={{
        padding: '6px 8px',
        background: `${recColor}14`,
        border: `1px solid ${recColor}44`,
        borderRadius: 3,
        textAlign: 'center',
        fontSize: 11,
        fontWeight: 700,
        color: recColor,
        ...mono,
      }}>
        {recommendation}
      </div>
    </div>
  );
};
