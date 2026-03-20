import React, { useEffect, useRef, useState } from 'react';

interface TickerItem {
  raw: string;
  color: string;
  sub?: string;
  subColor?: string;
}

interface TickerBarProps {
  items?: TickerItem[];
  speed?: number;
}

export const TickerBar: React.FC<TickerBarProps> = ({ items = [], speed = 40 }) => {
  const [offset, setOffset] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!items.length) return;
    const animate = (ts: number) => {
      if (!lastRef.current) lastRef.current = ts;
      const dt = ts - lastRef.current;
      lastRef.current = ts;
      setOffset(prev => {
        const contentWidth = contentRef.current?.offsetWidth || 1000;
        return (prev + (speed * dt) / 1000) % contentWidth;
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [items, speed]);

  if (!items.length) return null;

  const doubled = [...items, ...items];

  return (
    <div ref={containerRef} style={{ overflow: 'hidden', width: '100%', background: '#050810' }}>
      <div ref={contentRef} style={{ display: 'flex', transform: `translateX(-${offset}px)`, whiteSpace: 'nowrap' }}>
        {doubled.map((item, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 12px', color: item.color, fontFamily: 'monospace', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>
            <span>{item.raw}</span>
            {item.sub && <span style={{ color: item.subColor || item.color, fontWeight: 400, opacity: 0.7 }}>{item.sub}</span>}
            <span style={{ color: '#1e2a45', marginLeft: 4 }}>|</span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default TickerBar;
