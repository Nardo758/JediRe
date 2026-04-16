/**
 * M35 EventCard — compact Bloomberg dark event card
 * Shows event title + T+N counter, playbook forecast summary,
 * ahead/on-pace/behind badge, proximity score, and a "View Details" link.
 */

import React from 'react';
import { BT } from '../deal/bloomberg-ui';
import { Clock, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventCardEvent {
  id: string;
  name: string;
  category: string;
  subtype?: string;
  scope: string;
  status: string;
  magnitudeScore: number;
  confidence: number;
  announcedDate?: string;
  materializationDate?: string;
  forecastSummary?: {
    metric: string;
    direction: 'bull' | 'bear' | 'neutral';
    delta: string;
    tracking?: 'ahead' | 'on_pace' | 'behind';
  }[];
  proximityScore?: number;
}

interface EventCardProps {
  event: EventCardEvent;
  onViewDetails?: (id: string) => void;
  compact?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCOPE_COLOR: Record<string, string> = {
  msa:       '#6B7280',
  submarket: '#0891B2',
  property:  '#D97706',
};

const MAGNITUDE_LABEL: Record<number, string> = {
  4: 'TRANSFORMATIVE',
  3: 'MAJOR',
  2: 'MODERATE',
  1: 'MINOR',
};

function magnitudeLabel(score: number): string {
  if (score >= 4) return 'TRANSFORMATIVE';
  if (score >= 3) return 'MAJOR';
  if (score >= 2) return 'MODERATE';
  return 'MINOR';
}

function magnitudeColor(score: number): string {
  if (score >= 4) return BT.text.red;
  if (score >= 3) return BT.text.amber;
  if (score >= 2) return BT.text.cyan;
  return BT.text.muted;
}

function tPlusN(event: EventCardEvent): string {
  const mat = event.materializationDate || event.announcedDate;
  if (!mat) return '';
  const matDate = new Date(mat);
  const now = new Date();
  const diffMonths = Math.round((now.getTime() - matDate.getTime()) / (1000 * 60 * 60 * 24 * 30.4));
  if (diffMonths === 0) return 'T+0';
  if (diffMonths < 0) return `T${diffMonths}`;
  return `T+${diffMonths}`;
}

function TrackingBadge({ tracking }: { tracking?: string }) {
  if (!tracking) return null;
  const cfg: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    ahead:    { label: 'AHEAD',    color: BT.text.green,  icon: <TrendingUp  size={8} /> },
    on_pace:  { label: 'ON PACE', color: BT.text.cyan,   icon: <Minus       size={8} /> },
    behind:   { label: 'BEHIND',  color: BT.text.amber,  icon: <TrendingDown size={8} /> },
  };
  const c = cfg[tracking] || cfg.on_pace;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 7, fontWeight: 700, fontFamily: BT.font.mono,
      color: c.color, border: `1px solid ${c.color}44`, padding: '1px 4px',
    }}>
      {c.icon} {c.label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EventCard({ event, onViewDetails, compact = false }: EventCardProps) {
  const mono = BT.font.mono;
  const scopeColor = SCOPE_COLOR[event.scope?.toLowerCase()] || SCOPE_COLOR.msa;
  const tN = tPlusN(event);

  return (
    <div
      style={{
        background: BT.bg.panel,
        border: `1px solid ${BT.border.subtle}`,
        borderLeft: `3px solid ${scopeColor}`,
        padding: compact ? '6px 8px' : '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: compact ? 9 : 10,
            fontWeight: 700,
            color: BT.text.primary,
            fontFamily: mono,
            letterSpacing: 0.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {event.name}
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 7, color: scopeColor, fontFamily: mono, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {event.scope}
            </span>
            <span style={{ fontSize: 7, color: magnitudeColor(event.magnitudeScore), fontFamily: mono, fontWeight: 700 }}>
              {magnitudeLabel(event.magnitudeScore)}
            </span>
            {event.status && (
              <span style={{
                fontSize: 7, fontFamily: mono, fontWeight: 700,
                color: event.status === 'materialized' ? BT.text.green
                  : event.status === 'in_progress'    ? BT.text.cyan
                  : event.status === 'announced'       ? BT.text.amber
                  : BT.text.muted,
                textTransform: 'uppercase', letterSpacing: 0.4,
              }}>
                {event.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>

        {/* T+N counter */}
        {tN && (
          <div style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            fontSize: 8,
            color: BT.text.muted,
            fontFamily: mono,
          }}>
            <Clock size={8} style={{ color: BT.text.muted }} />
            {tN}
          </div>
        )}
      </div>

      {/* Forecast summary rows */}
      {!compact && event.forecastSummary && event.forecastSummary.length > 0 && (
        <div style={{
          borderTop: `1px solid ${BT.border.subtle}`,
          paddingTop: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {event.forecastSummary.slice(0, 3).map((fs, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 8, color: BT.text.secondary, fontFamily: mono }}>{fs.metric}</span>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: fs.direction === 'bull' ? BT.text.green : fs.direction === 'bear' ? BT.text.red : BT.text.muted,
                  fontFamily: mono,
                }}>
                  {fs.direction === 'bull' ? '▲' : fs.direction === 'bear' ? '▼' : '–'} {fs.delta}
                </span>
                <TrackingBadge tracking={fs.tracking} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer: proximity + view link */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 1 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {event.proximityScore != null && (
            <span style={{ fontSize: 7, color: BT.text.muted, fontFamily: mono }}>
              PROXIMITY <span style={{ color: BT.text.secondary, fontWeight: 700 }}>{Math.round(event.proximityScore * 100)}</span>
            </span>
          )}
          <span style={{ fontSize: 7, color: BT.text.muted, fontFamily: mono }}>
            CONF <span style={{ color: BT.text.secondary, fontWeight: 700 }}>{Math.round(event.confidence * 100)}%</span>
          </span>
        </div>
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(event.id)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 7,
              color: BT.text.cyan,
              fontFamily: mono,
              fontWeight: 700,
              padding: 0,
            }}
          >
            VIEW DETAILS <ExternalLink size={8} />
          </button>
        )}
      </div>
    </div>
  );
}
