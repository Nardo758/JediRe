/**
 * M35 EventHeroBanner
 *
 * Full-width persistent banner rendered at the top of Deal Capsule hero.
 * Shows event count, counts by magnitude, up to 3 named events,
 * Event Sensitivity badge, and Concentration risk badge.
 * Only renders when active events exist.
 */

import React, { useState } from 'react';
import { BT } from '../deal/bloomberg-ui';
import { Zap, ChevronRight, AlertTriangle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HeroBannerEvent {
  id: string;
  name: string;
  category: string;
  scope: 'msa' | 'submarket' | 'property';
  magnitudeScore: number;
  status: string;
}

export type EventSensitivity = 'LOW' | 'MEDIUM' | 'HIGH';

interface EventHeroBannerProps {
  events: HeroBannerEvent[];
  sensitivity?: EventSensitivity;
  sensitivityScore?: number;
  concentration?: {
    topEventName: string;
    irrShare: number;     // 0-1
    isConcentrated: boolean;
  } | null;
  onViewTimeline?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCOPE_COLOR: Record<string, string> = {
  msa:       '#6B7280',
  submarket: '#0891B2',
  property:  '#D97706',
};

const SENSITIVITY_CFG: Record<EventSensitivity, { color: string; bg: string; label: string }> = {
  LOW:    { color: BT.text.green,  bg: `${BT.text.green}18`,  label: 'LOW' },
  MEDIUM: { color: BT.text.amber,  bg: `${BT.text.amber}18`,  label: 'MEDIUM' },
  HIGH:   { color: BT.text.red,    bg: `${BT.text.red}18`,    label: 'HIGH' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function magnitudeCount(events: HeroBannerEvent[], minScore: number, maxScore: number) {
  return events.filter(e => e.magnitudeScore >= minScore && e.magnitudeScore < maxScore).length;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EventHeroBanner({
  events,
  sensitivity = 'LOW',
  sensitivityScore = 0,
  concentration = null,
  onViewTimeline,
}: EventHeroBannerProps) {
  const mono = BT.font.mono;

  if (!events || events.length === 0) return null;

  const sens = SENSITIVITY_CFG[sensitivity];

  const topScope = events[0]?.scope || 'msa';
  const accentColor = SCOPE_COLOR[topScope] || SCOPE_COLOR.msa;

  const transformCount = magnitudeCount(events, 4, 99);
  const majorCount     = magnitudeCount(events, 3, 4);
  const moderateCount  = magnitudeCount(events, 2, 3);
  const minorCount     = magnitudeCount(events, 0, 2);

  const topEvents = events.slice(0, 3);

  return (
    <div style={{
      height: 48,
      background: BT.bg.panelAlt,
      borderBottom: `1px solid ${accentColor}44`,
      borderLeft: `3px solid ${accentColor}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 12,
      flexShrink: 0,
      fontFamily: mono,
      overflow: 'hidden',
    }}>
      {/* Icon + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <Zap size={12} style={{ color: accentColor }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: BT.text.primary }}>
          {events.length} ACTIVE EVENT{events.length !== 1 ? 'S' : ''}
        </span>
      </div>

      {/* Magnitude chips */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {transformCount > 0 && (
          <span style={{ fontSize: 7, fontWeight: 700, color: BT.text.red, border: `1px solid ${BT.text.red}44`, padding: '1px 5px' }}>
            {transformCount} TRANSFORMATIVE
          </span>
        )}
        {majorCount > 0 && (
          <span style={{ fontSize: 7, fontWeight: 700, color: BT.text.amber, border: `1px solid ${BT.text.amber}44`, padding: '1px 5px' }}>
            {majorCount} MAJOR
          </span>
        )}
        {moderateCount > 0 && (
          <span style={{ fontSize: 7, fontWeight: 700, color: BT.text.cyan, border: `1px solid ${BT.text.cyan}44`, padding: '1px 5px' }}>
            {moderateCount} MOD
          </span>
        )}
        {minorCount > 0 && (
          <span style={{ fontSize: 7, color: BT.text.muted, border: `1px solid ${BT.border.medium}`, padding: '1px 5px' }}>
            {minorCount} MINOR
          </span>
        )}
      </div>

      {/* Separator */}
      <span style={{ color: BT.border.medium, flexShrink: 0 }}>│</span>

      {/* Named events */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, flex: 1, overflow: 'hidden' }}>
        {topEvents.map((ev, i) => (
          <React.Fragment key={ev.id}>
            {i > 0 && <span style={{ color: BT.border.medium, flexShrink: 0 }}>·</span>}
            <span style={{
              fontSize: 8,
              color: SCOPE_COLOR[ev.scope] || BT.text.secondary,
              fontWeight: ev.magnitudeScore >= 3 ? 700 : 400,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 180,
            }}>
              {ev.name}
            </span>
          </React.Fragment>
        ))}
        {events.length > 3 && (
          <span style={{ fontSize: 8, color: BT.text.muted, flexShrink: 0 }}>
            +{events.length - 3} more
          </span>
        )}
      </div>

      {/* Sensitivity badge */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: sens.bg,
        border: `1px solid ${sens.color}44`,
        padding: '2px 8px',
      }}>
        <span style={{ fontSize: 7, color: BT.text.muted, fontWeight: 400 }}>SENSITIVITY</span>
        <span style={{ fontSize: 8, fontWeight: 700, color: sens.color }}>{sens.label}</span>
      </div>

      {/* Concentration risk badge */}
      {concentration?.isConcentrated && (
        <div style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: `${BT.text.amber}18`,
          border: `1px solid ${BT.text.amber}44`,
          padding: '2px 8px',
        }}>
          <AlertTriangle size={8} style={{ color: BT.text.amber }} />
          <span style={{ fontSize: 7, color: BT.text.amber, fontWeight: 700 }}>
            CONC RISK · {Math.round(concentration.irrShare * 100)}% FROM {concentration.topEventName}
          </span>
        </div>
      )}

      {/* View timeline link */}
      {onViewTimeline && (
        <button
          onClick={onViewTimeline}
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: `1px solid ${accentColor}66`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 8,
            fontWeight: 700,
            color: accentColor,
            fontFamily: mono,
            padding: '2px 8px',
          }}
        >
          VIEW EVENT TIMELINE <ChevronRight size={9} />
        </button>
      )}
    </div>
  );
}
