import React from 'react';

export interface TickerItem {
  raw: string;
  color?: string;
  sub?: string;
  subColor?: string;
}

interface TickerBarProps {
  items: TickerItem[];
  /** Scroll speed in pixels per second (default 60) */
  speed?: number;
  height?: number;
  label?: string;
  labelColor?: string;
  style?: React.CSSProperties;
}

export const TickerBar: React.FC<TickerBarProps> = ({
  items,
  speed = 60,
  height = 20,
  label,
  labelColor = '#F5A623',
  style,
}) => {
  if (!items || items.length === 0) return null;

  const AVG_ITEM_PX = 160;
  const halfWidth = items.length * AVG_ITEM_PX;
  const durationSecs = Math.max(20, halfWidth / speed);

  const doubled = [...items, ...items];

  return (
    <div style={{
      height,
      background: '#0A0E14',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
      ...style,
    }}>
      {label && (
        <div style={{
          padding: '0 8px',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: 9,
          fontWeight: 800,
          color: labelColor,
          letterSpacing: '0.08em',
          borderRight: '1px solid rgba(255,255,255,0.12)',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(245,166,35,0.06)',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
      )}

      <style>{`
        @keyframes jedireTickerScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>

      <div style={{ overflow: 'hidden', flex: 1, height: '100%', display: 'flex', alignItems: 'center' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          animation: `jedireTickerScroll ${durationSecs}s linear infinite`,
          willChange: 'transform',
        }}>
          {doubled.map((item, i) => (
            <span key={i} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '0 14px',
            }}>
              <span style={{
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: 9,
                fontWeight: 600,
                color: item.color ?? 'rgba(255,255,255,0.75)',
                letterSpacing: '0.04em',
              }}>
                {item.raw}
              </span>
              {item.sub && (
                <span style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  fontSize: 9,
                  fontWeight: 500,
                  color: item.subColor ?? 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.03em',
                }}>
                  {item.sub}
                </span>
              )}
              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9, padding: '0 2px' }}>
                ·
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
