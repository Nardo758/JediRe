import React from 'react';
import { BT } from '../theme';
import type { CommentarySection } from '../../../stores/commentaryStore';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface SignalCommentaryProps {
  signalKey: string;
  commentary: CommentarySection;
  compact?: boolean;
}

const signalColors: Record<string, string> = {
  demand: BT.text.cyan,
  supply: BT.text.green,
  momentum: BT.text.amber,
  position: BT.text.violet,
  risk: BT.text.red,
};

const sentimentBadge = (s: string) => {
  const color = s === 'bullish' ? BT.text.green : s === 'bearish' ? BT.text.red : BT.text.amber;
  const label = s === 'bullish' ? 'BULLISH' : s === 'bearish' ? 'BEARISH' : 'NEUTRAL';
  return { color, label };
};

export const SignalCommentary: React.FC<SignalCommentaryProps> = ({ signalKey, commentary, compact }) => {
  const accentColor = signalColors[signalKey] || BT.text.cyan;
  const badge = sentimentBadge(commentary.sentiment);

  return (
    <div style={{
      padding: compact ? '6px 8px' : '8px 10px',
      background: BT.bg.elevated,
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: 0,
      marginBottom: compact ? 4 : 8,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: accentColor,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          ...mono,
        }}>
          {commentary.title}
        </span>
        <span style={{
          padding: '1px 4px',
          fontSize: 8,
          fontWeight: 700,
          color: badge.color,
          background: `${badge.color}18`,
          borderRadius: 2,
          ...mono,
        }}>
          {badge.label}
        </span>
      </div>
      <p style={{
        fontSize: 11,
        color: BT.text.secondary,
        lineHeight: 1.5,
        margin: 0,
      }}>
        {commentary.content}
      </p>
    </div>
  );
};
