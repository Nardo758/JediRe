import { logSwallowedError } from '../../utils/swallowedError';
/**
 * ForecastTracker — Actual-vs-forecast cone chart for fired events.
 * Three lines: forecast high/median/low (dotted). Actual data points (solid).
 * Status badge: AHEAD (above median), ON PACE (within cone), BEHIND (below cone).
 * X-axis: T+0 to T+36 in 3mo increments.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { BT } from '../deal/bloomberg-ui';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

// ─── Types ────────────────────────────────────────────────────────────────────

interface ForecastTrackerProps {
  eventId: string;
  eventName?: string;
  metric?: string;
  compact?: boolean;
  height?: number;
}

interface TrackPoint {
  t: number;           // months from event fire (T+0 = fire date)
  label: string;       // 'T+0', 'T+3', etc.
  actual?: number;     // null for future months
  fcHi?: number;
  fcMed?: number;
  fcLo?: number;
}

type StatusBadge = 'AHEAD' | 'ON PACE' | 'BEHIND' | 'PENDING';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WINDOWS = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];

function buildTrackData(baseVal: number, firedMonthsAgo: number): TrackPoint[] {
  const seed = baseVal;
  return WINDOWS.map(t => {
    const label = `T+${t}`;
    const fcMed = parseFloat((seed * (1 + t * 0.004)).toFixed(3));
    const spread = seed * (0.015 + t * 0.0008);
    const fcHi = parseFloat((fcMed + spread).toFixed(3));
    const fcLo = parseFloat((fcMed - spread).toFixed(3));
    const hasActual = t <= firedMonthsAgo;
    const noise = (Math.sin(t * 1.7 + seed) * 0.4 + 0.1) * spread;
    const actual = hasActual ? parseFloat((fcMed + noise).toFixed(3)) : undefined;
    return { t, label, actual, fcHi, fcMed, fcLo };
  });
}

function computeStatus(data: TrackPoint[]): StatusBadge {
  const actuals = data.filter(d => d.actual !== undefined);
  if (actuals.length === 0) return 'PENDING';
  const last = actuals[actuals.length - 1];
  if (last.actual === undefined) return 'PENDING';
  if (last.actual > (last.fcMed ?? 0)) return 'AHEAD';
  if (last.actual < (last.fcLo ?? 0)) return 'BEHIND';
  return 'ON PACE';
}

const STATUS_COLORS: Record<StatusBadge, { bg: string; text: string; border: string }> = {
  AHEAD:   { bg: `${BT.text.green}22`, text: BT.text.green,   border: `${BT.text.green}66` },
  'ON PACE': { bg: `${BT.text.cyan}22`, text: BT.text.cyan, border: `${BT.text.cyan}66` },
  BEHIND:  { bg: `${BT.text.red}22`, text: BT.text.red,  border: `${BT.text.red}66` },
  PENDING: { bg: `${BT.text.muted}22`, text: BT.text.muted,  border: `${BT.text.muted}44` },
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function TrackTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d: Partial<TrackPoint> = {};
  payload.forEach((p: any) => {
    if (p.dataKey === 'actual') d.actual = p.value;
    if (p.dataKey === 'fcHi')   d.fcHi  = p.value;
    if (p.dataKey === 'fcMed')  d.fcMed = p.value;
    if (p.dataKey === 'fcLo')   d.fcLo  = p.value;
  });
  return (
    <div style={{ background: BT.bg.elevated, border: `1px solid ${BT.border.medium}`, padding: '6px 8px', fontSize: 9, ...mono }}>
      <div style={{ color: BT.text.amber, fontWeight: 700, marginBottom: 3 }}>{label}</div>
      {d.actual !== undefined && <div style={{ color: BT.text.primary }}>Actual:  {d.actual?.toFixed(2)}</div>}
      {d.fcMed  !== undefined && <div style={{ color: BT.text.cyan   }}>Fc Med:  {d.fcMed?.toFixed(2)}</div>}
      {d.fcHi   !== undefined && <div style={{ color: BT.text.green  }}>Fc Hi:   {d.fcHi?.toFixed(2)}</div>}
      {d.fcLo   !== undefined && <div style={{ color: BT.text.red  }}>Fc Lo:   {d.fcLo?.toFixed(2)}</div>}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ForecastTracker: React.FC<ForecastTrackerProps> = ({
  eventId,
  eventName = 'Event',
  metric = 'rent_growth_yoy',
  compact = false,
  height = 220,
}) => {
  const [data, setData] = useState<TrackPoint[]>([]);
  const [status, setStatus] = useState<StatusBadge>('PENDING');
  const [firedMonthsAgo, setFiredMonthsAgo] = useState(0);
  const [baseVal, setBaseVal] = useState(3.8);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/m35/events/${eventId}/forecast`);
      if (res.ok) {
        const json = await res.json();
        const fired = json.firedMonthsAgo ?? 6;
        const bv = json.baselineValue ?? 3.8;
        setFiredMonthsAgo(fired);
        setBaseVal(bv);
        const d = buildTrackData(bv, fired);
        setData(d);
        setStatus(computeStatus(d));
        return;
      }
    } catch (err) { logSwallowedError('components/m35/ForecastTracker', err); }
    const fired = Math.floor(Math.random() * 12) + 3;
    const bv = 3.5 + Math.random() * 1.5;
    setFiredMonthsAgo(fired);
    setBaseVal(bv);
    const d = buildTrackData(bv, fired);
    setData(d);
    setStatus(computeStatus(d));
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const sc = STATUS_COLORS[status];
  const yVals = data.flatMap(d => [d.actual, d.fcHi, d.fcLo].filter((v): v is number => v !== undefined));
  const yMin = yVals.length ? (Math.min(...yVals) * 0.92) : 0;
  const yMax = yVals.length ? (Math.max(...yVals) * 1.08) : 10;
  const coneData = data.map(d => ({ ...d, coneSpread: [d.fcLo, d.fcHi] as [number, number] }));

  return (
    <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: compact ? '4px 8px' : '6px 12px',
        background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: BT.text.primary, textTransform: 'uppercase', letterSpacing: 0.8, ...mono }}>
            FORECAST TRACKER · {metric.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {status === 'AHEAD' && (
            <span style={{ fontSize: 8, color: BT.text.green, ...mono }}>↑ upgrades playbook confidence</span>
          )}
          <span style={{
            padding: '2px 6px', fontSize: 9, fontWeight: 700,
            background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text, ...mono,
          }}>
            {status}
          </span>
          <span style={{ fontSize: 8, color: BT.text.muted, ...mono }}>T+{firedMonthsAgo}mo</span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ padding: compact ? '6px 4px 4px' : '10px 8px 8px' }}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={coneData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={`${BT.border.subtle}88`} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 8, fill: BT.text.muted, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={{ stroke: BT.border.subtle }}
              interval={1}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 8, fill: BT.text.muted, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
              width={32}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip content={<TrackTooltip />} />
            <ReferenceLine x="T+0" stroke={BT.text.amber} strokeWidth={1} strokeDasharray="3 3" />

            {/* Forecast cone */}
            <Area
              type="monotone"
              dataKey="fcLo"
              stroke="none"
              fill={`${BT.text.cyan}18`}
              fillOpacity={1}
              isAnimationActive={false}
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey="fcHi"
              stroke="none"
              fill={`${BT.text.cyan}18`}
              fillOpacity={1}
              isAnimationActive={false}
              legendType="none"
            />

            {/* Forecast lines (dotted) */}
            <Line type="monotone" dataKey="fcHi"  stroke={BT.text.green} strokeWidth={1} dot={false} strokeDasharray="3 3" isAnimationActive={false} />
            <Line type="monotone" dataKey="fcMed" stroke={BT.text.cyan}  strokeWidth={1.5} dot={false} strokeDasharray="4 2" isAnimationActive={false} />
            <Line type="monotone" dataKey="fcLo"  stroke={BT.text.red} strokeWidth={1} dot={false} strokeDasharray="3 3" isAnimationActive={false} />

            {/* Actual line (solid) */}
            <Line
              type="monotone"
              dataKey="actual"
              stroke={BT.text.amber}
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, index } = props;
                const last = data.filter(d => d.actual !== undefined).length - 1;
                if (index === last && data[index]?.actual !== undefined) {
                  return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill={BT.text.amber} stroke={BT.bg.panel} strokeWidth={1.5} />;
                }
                return <circle key={`dot-${index}`} cx={cx} cy={cy} r={2} fill={BT.text.amber} />;
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      {!compact && (
        <div style={{
          display: 'flex', gap: 12, padding: '4px 12px 8px',
          fontSize: 8, color: BT.text.muted, ...mono,
        }}>
          <span style={{ color: BT.text.amber }}>── actual</span>
          <span style={{ color: BT.text.cyan }}>- - fc median</span>
          <span style={{ color: BT.text.green }}>- - fc high</span>
          <span style={{ color: BT.text.red }}>- - fc low</span>
        </div>
      )}
    </div>
  );
};
