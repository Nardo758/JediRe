import React from 'react';
import { T } from '../../styles/terminal-tokens';

interface TickerItem {
  name: string;
  score?: number;
  delta?: string;
  raw?: string;
  color?: string;
  sub?: string;
  subColor?: string;
  onClick?: () => void;
}

interface TickerBarProps {
  items: TickerItem[];
  speed?: number;
  height?: number;
  label?: string;
  labelColor?: string;
  style?: React.CSSProperties;
}

const MONO = T.font.mono;
const BORDER = T.border.subtle;
const TOP_BAR_BG = '#06080E';

export const TickerBar: React.FC<TickerBarProps> = ({
  items,
  speed = 40,
  height = 18,
  label,
  labelColor,
  style,
}) => {
  const doubled = [...items, ...items];
  const durationSecs = Math.max(items.length * speed, 20);
  const labelCol = labelColor ?? T.text.cyan;

  return (
    <div style={{
      height,
      background: TOP_BAR_BG,
      borderBottom: `1px solid ${BORDER}`,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'stretch',
      flexShrink: 0,
      ...style,
    }}>
      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes tickerPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 3px ${labelCol}66; }
          50%       { opacity: 0.5; box-shadow: 0 0 6px ${labelCol}99; }
        }
      `}</style>

      {/* Label tab — v0.34: ultra-dark bg + 2px left accent border + pulsing live dot */}
      {label && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '0 8px 0 6px',
          borderLeft: `2px solid ${labelCol}`,
          borderRight: `1px solid ${labelCol}22`,
          flexShrink: 0,
          background: TOP_BAR_BG,
        }}>
          {/* Live pulsing dot */}
          <span style={{
            display: 'inline-block',
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: labelCol,
            flexShrink: 0,
            animation: 'tickerPulse 2s ease-in-out infinite',
          }} />
          <span style={{
            fontFamily: MONO,
            fontSize: 7,
            fontWeight: 800,
            color: labelCol,
            letterSpacing: '0.15em',
            whiteSpace: 'nowrap',
          }}>
            {label}
          </span>
        </div>
      )}

      {/* Scrolling content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', background: TOP_BAR_BG }}>
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
              <span
                key={i}
                onClick={item.onClick}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0 12px',
                  borderRight: `1px solid ${BORDER}`,
                  fontSize: 8,
                  fontFamily: MONO,
                  cursor: item.onClick ? 'pointer' : 'default',
                }}
              >
                {item.raw != null ? (
                  <span style={{ color: item.color ?? T.text.amber }}>{item.raw}</span>
                ) : (
                  <>
                    <span style={{ color: T.text.secondary, letterSpacing: '0.04em' }}>{item.name}</span>
                    {item.score != null && (
                      <span style={{ color: T.text.amber, fontWeight: 700 }}>{item.score}</span>
                    )}
                    {item.delta && (
                      <span style={{ color: deltaColor, fontWeight: 600 }}>{item.delta}</span>
                    )}
                  </>
                )}
                {item.sub && (
                  <span style={{ color: item.subColor ?? T.text.muted, fontSize: 7, fontWeight: 700 }}>
                    {item.sub}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
