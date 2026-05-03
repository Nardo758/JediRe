import { logSwallowedError } from '../../utils/swallowedError';
/**
 * EventDensityStrip — Horizontal tick-mark strip.
 * Each tick = one event. Height = magnitude category (4 levels).
 * Color = scope. Hover tooltip.
 * Shows event cluster density over T-48 to T+24 month window.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { BT } from '../deal/bloomberg-ui';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

// ─── Types ────────────────────────────────────────────────────────────────────

interface DensityEvent {
  id: string;
  name: string;
  scope: 'msa' | 'submarket' | 'property';
  monthOffset: number; // negative = past, positive = future, 0 = now
  magnitude: 1 | 2 | 3 | 4;
  category: string;
}

interface EventDensityStripProps {
  msaId?: string;
  submarketId?: string;
  propertyId?: string;
  events?: DensityEvent[];
  height?: number;
  compact?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCOPE_COLORS: Record<string, string> = {
  msa:       '#6B7280',
  submarket: '#0891B2',
  property:  '#D97706',
};

const MAGNITUDE_HEIGHTS: Record<number, number> = { 1: 4, 2: 7, 3: 11, 4: 16 };

const WINDOW_MIN = -48;
const WINDOW_MAX = 24;
const WINDOW_RANGE = WINDOW_MAX - WINDOW_MIN;

// ─── Demo seed ───────────────────────────────────────────────────────────────

function seedDemoEvents(id: string): DensityEvent[] {
  const events: DensityEvent[] = [];
  const scopes: DensityEvent['scope'][] = ['msa', 'submarket', 'property'];
  const categories = ['economic', 'infrastructure', 'policy', 'supply', 'demographic'];
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const count = 18 + (hash % 14);
  for (let i = 0; i < count; i++) {
    const offset = WINDOW_MIN + ((hash * (i + 1) * 7919) % WINDOW_RANGE);
    const mag = (1 + ((hash * (i + 3)) % 4)) as 1 | 2 | 3 | 4;
    const scope = scopes[(hash * (i + 2)) % 3];
    const cat = categories[(hash * (i + 5)) % 5];
    events.push({
      id: `demo-${i}`,
      name: `${cat.charAt(0).toUpperCase() + cat.slice(1)} event ${i + 1}`,
      scope,
      monthOffset: offset,
      magnitude: mag,
      category: cat,
    });
  }
  return events.sort((a, b) => a.monthOffset - b.monthOffset);
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipState {
  ev: DensityEvent;
  x: number;
  y: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const EventDensityStrip: React.FC<EventDensityStripProps> = ({
  msaId,
  submarketId,
  events: propEvents,
  height = 28,
  compact = false,
}) => {
  const [events, setEvents] = useState<DensityEvent[]>(propEvents ?? []);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const load = useCallback(async () => {
    if (propEvents) { setEvents(propEvents); return; }
    const scopeId = submarketId ?? msaId ?? 'default';
    try {
      const endpoint = submarketId
        ? `/api/v1/m35/submarkets/${submarketId}/events-density`
        : `/api/v1/m35/msa/${msaId}/events-density`;
      const res = await fetch(endpoint);
      if (res.ok) { setEvents(await res.json()); return; }
    } catch (err) { logSwallowedError('components/m35/EventDensityStrip', err); }
    setEvents(seedDemoEvents(scopeId));
  }, [msaId, submarketId, propEvents]);

  useEffect(() => { load(); }, [load]);

  const stripW = 100; // percentage
  const ticksWithPos = events.map(ev => ({
    ...ev,
    pct: Math.max(0, Math.min(100, ((ev.monthOffset - WINDOW_MIN) / WINDOW_RANGE) * 100)),
  }));

  const nowPct = ((0 - WINDOW_MIN) / WINDOW_RANGE) * 100;

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {/* Label row */}
      {!compact && (
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '2px 0', fontSize: 8, color: BT.text.muted, ...mono,
        }}>
          <span>T-48m</span>
          <span style={{ color: BT.text.amber }}>NOW</span>
          <span>T+24m</span>
        </div>
      )}

      {/* Strip container */}
      <div style={{
        position: 'relative',
        height: height + 4,
        background: BT.bg.elevated,
        border: `1px solid ${BT.border.subtle}`,
        overflow: 'hidden',
      }}>
        {/* Now line */}
        <div style={{
          position: 'absolute',
          left: `${nowPct}%`,
          top: 0,
          bottom: 0,
          width: 1,
          background: `${BT.text.amber}88`,
          zIndex: 1,
        }} />

        {/* Event ticks */}
        {ticksWithPos.map(ev => {
          const tickH = MAGNITUDE_HEIGHTS[ev.magnitude];
          const color = SCOPE_COLORS[ev.scope] ?? BT.text.muted;
          return (
            <div
              key={ev.id}
              title={ev.name}
              onMouseEnter={e => setTooltip({ ev, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTooltip(null)}
              style={{
                position: 'absolute',
                left: `${ev.pct}%`,
                bottom: 2,
                width: 2,
                height: tickH,
                background: color,
                opacity: 0.85,
                borderRadius: 1,
                cursor: 'pointer',
                zIndex: 2,
                transform: 'translateX(-50%)',
              }}
            />
          );
        })}
      </div>

      {/* Scope legend */}
      {!compact && (
        <div style={{ display: 'flex', gap: 10, padding: '2px 0', fontSize: 7, color: BT.text.muted, ...mono }}>
          {Object.entries(SCOPE_COLORS).map(([scope, color]) => (
            <span key={scope} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 6, height: 6, background: color, display: 'inline-block', borderRadius: 1 }} />
              {scope}
            </span>
          ))}
          <span style={{ marginLeft: 'auto' }}>bar height = magnitude tier</span>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 10,
          top: tooltip.y - 40,
          zIndex: 9999,
          background: BT.bg.elevated,
          border: `1px solid ${BT.border.medium}`,
          padding: '5px 8px',
          fontSize: 9,
          pointerEvents: 'none',
          ...mono,
        }}>
          <div style={{ color: BT.text.amber, fontWeight: 700 }}>{tooltip.ev.name}</div>
          <div style={{ color: BT.text.muted }}>
            {tooltip.ev.scope.toUpperCase()} · {tooltip.ev.category} · Mag {tooltip.ev.magnitude}
          </div>
          <div style={{ color: BT.text.primary }}>
            {tooltip.ev.monthOffset > 0
              ? `T+${tooltip.ev.monthOffset}m (future)`
              : tooltip.ev.monthOffset === 0
              ? 'NOW'
              : `T${tooltip.ev.monthOffset}m (past)`}
          </div>
        </div>
      )}
    </div>
  );
};
