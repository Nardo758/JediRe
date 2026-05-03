import { logSwallowedError } from '../../utils/swallowedError';
/**
 * MultiMetricPanel — 2×3 grid (or 2×2) of synchronized mini EventTimelineChart instances.
 * All synchronized on same X-axis. Each panel labeled with metric name + status badge.
 * User scans 6 at once to verify coherent multi-metric event response.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { BT } from '../deal/bloomberg-ui';
import { EventTimelineChart } from './EventTimelineChart';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetricSlot {
  key: string;
  label: string;
  unit: string;
  baseline: number;
  status: 'ELEVATED' | 'NORMAL' | 'DEPRESSED' | 'NEUTRAL';
}

interface MultiMetricPanelProps {
  eventId: string;
  eventName?: string;
  metrics?: MetricSlot[];
  compact?: boolean;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  ELEVATED:  { text: BT.text.green,   bg: `${BT.text.green}18`,   border: `${BT.text.green}44`   },
  NORMAL:    { text: BT.text.cyan,    bg: `${BT.text.cyan}18`,    border: `${BT.text.cyan}44`    },
  DEPRESSED: { text: BT.text.red,   bg: `${BT.text.red}18`,   border: `${BT.text.red}44`   },
  NEUTRAL:   { text: BT.text.muted,   bg: `${BT.text.muted}18`,   border: `${BT.text.muted}44`   },
};

// ─── Default metrics ─────────────────────────────────────────────────────────

const DEFAULT_METRICS: MetricSlot[] = [
  { key: 'rent_growth_yoy',    label: 'Rent Growth',     unit: '%',    baseline: 3.8,  status: 'ELEVATED' },
  { key: 'cap_rate',           label: 'Cap Rate',         unit: '%',    baseline: 5.2,  status: 'DEPRESSED' },
  { key: 'absorption',         label: 'Absorption',       unit: 'u/mo', baseline: 280,  status: 'ELEVATED' },
  { key: 'permits',            label: 'Permit Velocity',  unit: 'u',    baseline: 420,  status: 'NORMAL' },
  { key: 'vacancy_rate',       label: 'Vacancy Rate',     unit: '%',    baseline: 5.1,  status: 'NORMAL' },
  { key: 'transaction_volume', label: 'Txn Volume',       unit: '$M',   baseline: 180,  status: 'NEUTRAL' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export const MultiMetricPanel: React.FC<MultiMetricPanelProps> = ({
  eventId,
  eventName = 'Event',
  metrics: propMetrics,
  compact = false,
}) => {
  const [metrics, setMetrics] = useState<MetricSlot[]>(propMetrics ?? []);

  const load = useCallback(async () => {
    if (propMetrics) { setMetrics(propMetrics); return; }
    try {
      const res = await fetch(`/api/v1/m35/events/${eventId}/watchlist-metrics`);
      if (res.ok) {
        const json = await res.json();
        setMetrics(json.metrics ?? DEFAULT_METRICS);
        return;
      }
    } catch (err) { logSwallowedError('components/m35/MultiMetricPanel', err); }
    setMetrics(DEFAULT_METRICS);
  }, [eventId, propMetrics]);

  useEffect(() => { load(); }, [load]);

  const cols = metrics.length <= 4 ? 2 : 3;
  const rows = Math.ceil(metrics.length / cols);
  const chartH = compact ? 100 : 130;

  return (
    <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: compact ? '4px 8px' : '6px 12px',
        background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: BT.text.primary, textTransform: 'uppercase', letterSpacing: 0.8, ...mono }}>
          MULTI-METRIC PANEL · {eventName}
        </span>
        <span style={{ fontSize: 8, color: BT.text.muted, ...mono }}>
          {metrics.length} metrics · synchronized axis
        </span>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 1,
        background: BT.border.subtle,
      }}>
        {metrics.map(m => {
          const sc = STATUS_COLORS[m.status];
          return (
            <div key={m.key} style={{ background: BT.bg.panel }}>
              {/* Mini header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 8px',
                background: BT.bg.elevated,
              }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: BT.text.primary, ...mono }}>
                  {m.label.toUpperCase()}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 7, color: BT.text.muted, ...mono }}>{m.unit}</span>
                  <span style={{
                    fontSize: 7, fontWeight: 700, padding: '1px 4px',
                    background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, ...mono,
                  }}>
                    {m.status}
                  </span>
                </div>
              </div>

              {/* Chart */}
              <EventTimelineChart
                eventName={eventName}
                eventScope="submarket"
                metric={m.key}
                baselineValue={m.baseline}
                height={chartH}
                compact
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
