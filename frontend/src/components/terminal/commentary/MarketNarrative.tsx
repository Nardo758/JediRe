import React from 'react';
import { BT } from '../theme';
import type { CommentarySection } from '../../../stores/commentaryStore';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface MarketNarrativeProps {
  narrative: CommentarySection;
  entityName?: string;
  compact?: boolean;
}

const sentimentColor = (s: string) =>
  s === 'bullish' ? BT.text.green : s === 'bearish' ? BT.text.red : BT.text.amber;

const sentimentLabel = (s: string) =>
  s === 'bullish' ? 'BULLISH' : s === 'bearish' ? 'BEARISH' : 'NEUTRAL';

export const MarketNarrative: React.FC<MarketNarrativeProps> = ({ narrative, entityName, compact }) => {
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
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...mono,
      }}>
        <span>Market Narrative</span>
        <span style={{
          padding: '1px 6px',
          fontSize: 9,
          fontWeight: 700,
          color,
          background: `${color}18`,
          borderRadius: 2,
        }}>
          {sentimentLabel(narrative.sentiment)}
        </span>
      </div>
      <p style={{
        fontSize: 11,
        color: BT.text.secondary,
        lineHeight: 1.6,
        margin: 0,
      }}>
        {narrative.content}
      </p>
    </div>
  );
};
