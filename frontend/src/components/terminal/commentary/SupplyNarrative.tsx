import React from 'react';
import { BT } from '../theme';
import type { CommentarySection } from '../../../stores/commentaryStore';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface SupplyNarrativeProps {
  narrative: CommentarySection;
  compact?: boolean;
}

const sentimentColor = (s: string) =>
  s === 'bullish' ? BT.text.green : s === 'bearish' ? BT.text.red : BT.text.amber;

export const SupplyNarrative: React.FC<SupplyNarrativeProps> = ({ narrative, compact }) => {
  const color = sentimentColor(narrative.sentiment);

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
        Supply Narrative
      </div>
      <div style={{
        padding: '8px 10px',
        background: `${color}08`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 0,
      }}>
        <p style={{
          fontSize: 11,
          color: BT.text.secondary,
          lineHeight: 1.6,
          margin: 0,
        }}>
          {narrative.content}
        </p>
      </div>
    </div>
  );
};
