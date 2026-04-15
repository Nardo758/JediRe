/**
 * M35EventCard — reusable compact event card
 *
 * Cyan 3px left border (standard); amber if diverging > 1 std dev from forecast.
 * Intended for event lists in MSAEventsTab, dashboard widgets, portfolio feeds.
 */

import React from 'react';
import { BT } from '../terminal/theme';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code',monospace" };

const CATEGORY_EMOJI: Record<string, string> = {
  employer_opening:       '🏢',
  employer_closure:       '⚠️',
  disaster:               '🌀',
  infrastructure_pos:     '🚆',
  infrastructure_neg:     '🚧',
  infrastructure:         '🚆',
  demand_gen_open:        '🏟️',
  demand_gen_close:       '📉',
  regulatory:             '📜',
  redevelopment_catalyst: '🏗️',
  employment:             '💼',
  supply:                 '🏗️',
  policy:                 '📋',
  demographic:            '👥',
  macro:                  '📊',
};

const CATEGORY_COLORS: Record<string, string> = {
  employment:    '#10B981',
  infrastructure: BT.accent.cyan,
  supply:        BT.accent.amber,
  policy:        '#8B5CF6',
  regulatory:    '#8B5CF6',
  demographic:   '#EC4899',
  macro:         BT.text.muted,
};

const MAGNITUDE_MAX = 5;

export interface M35EventCardData {
  id: string;
  name: string;
  category: string;
  status: string;
  scope: string;
  magnitudeScore: number;
  confidence: number;
  announcedDate: string | null;
  divergingForecast?: boolean;
  irrDelta?: number;
  rentGrowthDelta?: number;
  submarket?: string;
  msa?: string;
}

interface Props {
  event: M35EventCardData;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

function MagnitudeBars({ value, max = MAGNITUDE_MAX, color }: { value: number; max?: number; color: string }) {
  const filled = Math.round((value / max) * 5);
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          style={{
            width: 3,
            height: 3 + i * 2,
            background: i <= filled ? color : `${color}22`,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:       BT.accent.cyan,
    announced:    '#10B981',
    completed:    BT.text.muted,
    in_progress:  '#10B981',
    monitoring:   BT.accent.amber,
    draft:        BT.text.dim,
    cancelled:    BT.accent.red,
  };
  const color = map[status.toLowerCase()] ?? BT.text.muted;
  return (
    <span style={{
      ...mono, fontSize: 8, fontWeight: 700, padding: '1px 5px',
      color, background: `${color}18`,
      border: `1px solid ${color}44`, letterSpacing: '0.06em',
    }}>
      {status.replace('_', ' ').toUpperCase()}
    </span>
  );
}

export function M35EventCard({ event, selected, onClick, compact }: Props) {
  const isDiverging = event.divergingForecast === true;
  const borderColor = isDiverging ? BT.accent.amber : BT.accent.cyan;
  const catColor = CATEGORY_COLORS[event.category] ?? BT.text.muted;
  const emoji = CATEGORY_EMOJI[event.category] ?? '📌';

  const hasDelta = event.irrDelta !== undefined || event.rentGrowthDelta !== undefined;

  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? BT.bg.active : BT.bg.panel,
        border: `1px solid ${selected ? borderColor : BT.border.subtle}`,
        borderLeft: `3px solid ${borderColor}`,
        padding: compact ? '8px 10px' : '10px 14px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.1s',
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 4 : 6,
      }}
      onMouseEnter={e => { if (onClick && !selected) (e.currentTarget as HTMLDivElement).style.background = BT.bg.hover; }}
      onMouseLeave={e => { if (onClick && !selected) (e.currentTarget as HTMLDivElement).style.background = BT.bg.panel; }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: compact ? 10 : 12, flexShrink: 0 }}>{emoji}</span>
          <span style={{
            fontSize: compact ? 10 : 11,
            fontWeight: 700,
            color: BT.text.primary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {event.name}
          </span>
        </div>
        {isDiverging && (
          <span style={{ ...mono, fontSize: 8, color: BT.accent.amber, fontWeight: 700, flexShrink: 0 }}>
            ⚠ DIVERGING
          </span>
        )}
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          ...mono, fontSize: 8, fontWeight: 700, padding: '1px 5px',
          color: catColor, background: `${catColor}18`,
          border: `1px solid ${catColor}44`,
        }}>
          {event.category.replace('_', ' ').toUpperCase()}
        </span>
        <StatusBadge status={event.status} />
        <span style={{ ...mono, fontSize: 8, color: BT.text.dim, padding: '1px 5px', border: `1px solid ${BT.border.subtle}`, background: BT.bg.elevated }}>
          {event.scope.toUpperCase()}
        </span>
      </div>

      {/* Bottom row: magnitude + confidence + deltas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <MagnitudeBars value={event.magnitudeScore} max={MAGNITUDE_MAX} color={borderColor} />
          <span style={{ ...mono, fontSize: 8, color: BT.text.dim }}>MAG {event.magnitudeScore.toFixed(1)}</span>
        </div>

        <span style={{ ...mono, fontSize: 8, color: BT.text.muted }}>
          CONF {Math.round(event.confidence * 100)}%
        </span>

        {event.announcedDate && (
          <span style={{ ...mono, fontSize: 8, color: BT.text.dim }}>
            {new Date(event.announcedDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
          </span>
        )}

        {!compact && hasDelta && (
          <>
            {event.irrDelta !== undefined && (
              <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: event.irrDelta >= 0 ? '#10B981' : '#EF4444' }}>
                IRR {event.irrDelta >= 0 ? '+' : ''}{event.irrDelta.toFixed(1)}pp
              </span>
            )}
            {event.rentGrowthDelta !== undefined && (
              <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: event.rentGrowthDelta >= 0 ? '#10B981' : '#EF4444' }}>
                Rent {event.rentGrowthDelta >= 0 ? '+' : ''}{event.rentGrowthDelta.toFixed(1)}pp
              </span>
            )}
          </>
        )}
      </div>

      {!compact && (event.msa || event.submarket) && (
        <div style={{ fontSize: 9, color: BT.text.dim, ...mono }}>
          {event.submarket ? `${event.submarket} · ` : ''}{event.msa}
        </div>
      )}
    </div>
  );
}
