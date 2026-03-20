import React from 'react';
import { T } from '../../styles/terminal-tokens';

interface TickerItem {
  name: string;
  score?: number;
  delta?: string;
}

interface TickerBarProps {
  items: TickerItem[];
  speed?: number;
  height?: number;
  style?: React.CSSProperties;
}

export const TickerBar: React.FC<TickerBarProps> = ({ items, speed = 40, height = 27, style }) => {
  const doubled = [...items, ...items];
  const durationSecs = (items.length * speed);

  return (
    <div style={{
      height,
      background: T.bg.topBar,
      borderBottom: `1px solid ${T.border.subtle}`,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      ...style,
    }}>
      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        whiteSpace: 'nowrap',
        animation: `tickerScroll ${durationSecs}s linear infinite`,
        willChange: 'transform',
      }}>
        {doubled.map((item, i) => {
          const deltaColor = !item.delta
            ? T.text.secondary
            : item.delta.startsWith('+') ? T.text.green : T.text.red;
          return (
            <span key={i} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 16px',
              borderRight: `1px solid ${T.border.subtle}`,
              fontSize: T.fontSize.sm,
              fontFamily: T.font.mono,
            }}>
              <span style={{ color: T.text.secondary }}>{item.name}</span>
              {item.score != null && (
                <span style={{ color: T.text.amber, fontWeight: 700 }}>{item.score}</span>
              )}
              {item.delta && (
                <span style={{ color: deltaColor, fontWeight: 600 }}>{item.delta}</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};
