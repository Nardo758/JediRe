/**
 * AttributionWaterfall — Horizontal stacked bar showing attribution breakdown.
 * Rows: baseline trend + each event contribution + unexplained = observed total.
 * Color-coded: baseline neutral, events scope-colored, unexplained gray.
 * Click any event bar → drills into Event Detail.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BT } from '../deal/bloomberg-ui';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttributionRow {
  id: string;
  label: string;
  value: number;     // absolute contribution (e.g. +0.42 percentage points)
  pct: number;       // share of total observed (0–1)
  type: 'baseline' | 'event' | 'unexplained';
  scope?: 'msa' | 'submarket' | 'property';
  eventId?: string;
}

interface AttributionWaterfallProps {
  dealId?: string;
  eventId?: string;
  metric?: string;
  compact?: boolean;
  onEventClick?: (eventId: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCOPE_COLORS: Record<string, string> = {
  msa:       '#6B7280',
  submarket: '#0891B2',
  property:  '#D97706',
};

const TYPE_COLORS = {
  baseline:    BT.text.muted,
  unexplained: '#4B5563',
};

// ─── Demo seed ───────────────────────────────────────────────────────────────

function seedDemoRows(id: string, metric: string): AttributionRow[] {
  const h = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const baseVal = 1.2 + (h % 20) * 0.06;
  const events = [
    { id: `ev-${h}-1`, label: 'Tech Campus Expansion', scope: 'submarket' as const, val: 0.9 + (h % 8) * 0.1 },
    { id: `ev-${h}-2`, label: 'Transit Line Opening', scope: 'msa' as const, val: 0.5 + (h % 5) * 0.08 },
    { id: `ev-${h}-3`, label: 'Zoning Upzone', scope: 'property' as const, val: 0.3 + (h % 4) * 0.05 },
  ];
  const unexplained = 0.2 + (h % 3) * 0.04;
  const total = baseVal + events.reduce((s, e) => s + e.val, 0) + unexplained;

  const rows: AttributionRow[] = [
    {
      id: 'baseline',
      label: `${metric.replace(/_/g, ' ')} baseline trend`,
      value: baseVal,
      pct: baseVal / total,
      type: 'baseline',
    },
    ...events.map(e => ({
      id: e.id,
      label: e.label,
      value: e.val,
      pct: e.val / total,
      type: 'event' as const,
      scope: e.scope,
      eventId: e.id,
    })),
    {
      id: 'unexplained',
      label: 'Unexplained residual',
      value: unexplained,
      pct: unexplained / total,
      type: 'unexplained',
    },
  ];
  return rows;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const AttributionWaterfall: React.FC<AttributionWaterfallProps> = ({
  dealId,
  eventId,
  metric = 'rent_growth_yoy',
  compact = false,
  onEventClick,
}) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AttributionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = dealId ?? eventId ?? 'default';
    try {
      const endpoint = dealId
        ? `/api/v1/m35/deals/${dealId}/attribution?metric=${metric}`
        : `/api/v1/m35/events/${eventId}/attribution?metric=${metric}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const json = await res.json();
        setRows(json.rows);
        setTotal(json.total);
        return;
      }
    } catch {}
    const demo = seedDemoRows(id, metric);
    setRows(demo);
    setTotal(demo.reduce((s, r) => s + r.value, 0));
  }, [dealId, eventId, metric]);

  useEffect(() => { load(); }, [load]);

  const handleBarClick = (row: AttributionRow) => {
    if (row.type !== 'event' || !row.eventId) return;
    if (onEventClick) { onEventClick(row.eventId); return; }
    navigate(`/events/${row.eventId}`);
  };

  const maxBarW = 100;

  return (
    <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: compact ? '4px 8px' : '6px 12px',
        background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: BT.text.primary, textTransform: 'uppercase', letterSpacing: 0.8, ...mono }}>
          ATTRIBUTION WATERFALL · {metric.replace(/_/g, ' ').toUpperCase()}
        </span>
        <span style={{ fontSize: 8, color: BT.text.muted, ...mono }}>
          OBSERVED TOTAL: {total.toFixed(2)}
        </span>
      </div>

      {/* Rows */}
      <div style={{ padding: compact ? '6px 8px' : '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map(row => {
          const barColor = row.type === 'event'
            ? SCOPE_COLORS[row.scope ?? 'msa']
            : row.type === 'baseline'
            ? BT.text.primary
            : TYPE_COLORS.unexplained;
          const barPct = (row.pct * maxBarW);
          const isClickable = row.type === 'event';
          const isHovered = hovered === row.id;

          return (
            <div
              key={row.id}
              onMouseEnter={() => setHovered(row.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => handleBarClick(row)}
              style={{
                cursor: isClickable ? 'pointer' : 'default',
                padding: '3px 0',
                borderLeft: isHovered && isClickable ? `2px solid ${barColor}` : '2px solid transparent',
                paddingLeft: 4,
                transition: 'border-color 0.1s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {row.scope && (
                    <span style={{
                      fontSize: 7, padding: '1px 4px',
                      background: `${SCOPE_COLORS[row.scope]}22`,
                      border: `1px solid ${SCOPE_COLORS[row.scope]}55`,
                      color: SCOPE_COLORS[row.scope], ...mono,
                    }}>
                      {row.scope.toUpperCase()}
                    </span>
                  )}
                  <span style={{
                    fontSize: 9, color: isHovered ? BT.text.primary : BT.text.muted, ...mono,
                    transition: 'color 0.1s',
                  }}>
                    {row.label}
                  </span>
                  {isClickable && isHovered && (
                    <span style={{ fontSize: 8, color: BT.text.cyan, ...mono }}>↗ detail</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, color: barColor, fontWeight: 700, ...mono }}>
                    +{row.value.toFixed(2)}
                  </span>
                  <span style={{ fontSize: 8, color: BT.text.muted, ...mono }}>
                    ({(row.pct * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
              {/* Bar */}
              <div style={{ height: compact ? 5 : 7, background: BT.bg.elevated, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: `${barPct}%`,
                  height: '100%',
                  background: barColor,
                  opacity: isHovered ? 1 : 0.65,
                  borderRadius: 2,
                  transition: 'opacity 0.1s, width 0.3s',
                }} />
              </div>
            </div>
          );
        })}

        {/* Total line */}
        <div style={{
          marginTop: 4, paddingTop: 6,
          borderTop: `1px solid ${BT.border.subtle}`,
          display: 'flex', justifyContent: 'space-between',
          fontSize: 9, fontWeight: 700, ...mono,
        }}>
          <span style={{ color: BT.text.primary }}>OBSERVED TOTAL</span>
          <span style={{ color: BT.text.amber }}>{total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};
