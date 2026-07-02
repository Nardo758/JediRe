import React, { useMemo } from 'react';
import { usePeriodicData } from '../../hooks/usePeriodicData';
import { BT } from '../deal/bloomberg-ui';
import { fmtPeriodicValue, ZONE_COLORS } from './fieldLabels';
import type { PeriodicPeriod } from './PeriodicGrid.types';

export interface M35Event {
  id: string;
  date: string | null;
  label: string;
  subtype: string;
  magnitude?: string;
}

interface PeriodicChartProps {
  dealId: string;
  events?: M35Event[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function minMax(values: number[]): { min: number; max: number } {
  const valid = values.filter(v => v != null && Number.isFinite(v));
  if (valid.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...valid), max: Math.max(...valid) };
}

function padRange(min: number, max: number, pad = 0.1): { min: number; max: number } {
  const range = max - min;
  if (range === 0) return { min: min - 1, max: max + 1 };
  return { min: min - range * pad, max: max + range * pad };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer Badge (for NOT-YET layers)
// ─────────────────────────────────────────────────────────────────────────────

const LayerBadge: React.FC<{ label: string; status: 'real' | 'not-yet' }> = ({ label, status }) => {
  const color = status === 'real' ? BT.text.green : BT.text.muted;
  const bg = status === 'real' ? '#00D26A11' : '#3B3B3B11';
  return (
    <span
      style={{
        fontSize: BT.fontSize.xs,
        fontFamily: BT.font.mono,
        color,
        backgroundColor: bg,
        padding: '2px 6px',
        borderRadius: '2px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: status === 'real' ? BT.text.green : '#3B3B3B',
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Chart Component
// ─────────────────────────────────────────────────────────────────────────────

export const PeriodicChart: React.FC<PeriodicChartProps> = ({ dealId, events = [] }) => {
  const { data, loading, error } = usePeriodicData({ dealId });

  // Chart dimensions (responsive)
  const width = 1100;
  const height = 420;
  const margin = { top: 40, right: 80, bottom: 50, left: 80 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  const noiSeries = data?.fields?.noi ?? [];
  const boundary = data?.boundary;

  // Filter to resolved values only
  const resolvedPoints = useMemo(() => {
    return noiSeries
      .filter((p): p is PeriodicPeriod & { resolved: number } => p.resolved != null && Number.isFinite(p.resolved))
      .map((p, i) => ({
        ...p,
        index: i,
      }));
  }, [noiSeries]);

  const { min, max } = useMemo(() => {
    const vals = resolvedPoints.map(p => p.resolved);
    return padRange(...Object.values(minMax(vals)) as [number, number]);
  }, [resolvedPoints]);

  // Scale functions
  const xScale = (index: number): number => {
    if (resolvedPoints.length <= 1) return margin.left + chartW / 2;
    return margin.left + (index / (resolvedPoints.length - 1)) * chartW;
  };

  // Date-based x-scale for M35 event pins (handles gaps in periodic data)
  const dateXScale = useMemo((): ((dateStr: string) => number | null) => {
    if (resolvedPoints.length === 0) return () => null;
    const toMs = (m: string) => new Date(m + '-01').getTime();
    const minMs = toMs(resolvedPoints[0].month);
    const maxMs = toMs(resolvedPoints[resolvedPoints.length - 1].month);
    const span = maxMs - minMs;
    if (span === 0) return () => margin.left + chartW / 2;
    return (dateStr: string) => {
      const ms = new Date(dateStr).getTime();
      if (ms < minMs || ms > maxMs) return null;
      return margin.left + ((ms - minMs) / span) * chartW;
    };
  }, [resolvedPoints, margin.left, chartW]);

  const yScale = (value: number): number => {
    if (max === min) return margin.top + chartH / 2;
    return margin.top + chartH - ((value - min) / (max - min)) * chartH;
  };

  // Boundary line position
  const boundaryIndex = useMemo(() => {
    if (!boundary?.actuals_through_month || resolvedPoints.length === 0) return null;
    const boundaryMonth = boundary.actuals_through_month.slice(0, 7); // YYYY-MM
    const idx = resolvedPoints.findIndex(p => p.month === boundaryMonth);
    return idx >= 0 ? idx : null;
  }, [boundary, resolvedPoints]);

  // Zone segments for background coloring
  const zoneSegments = useMemo(() => {
    const segments: { start: number; end: number; zone: string }[] = [];
    if (resolvedPoints.length === 0) return segments;

    let currentZone = resolvedPoints[0].zone;
    let start = 0;

    for (let i = 1; i < resolvedPoints.length; i++) {
      if (resolvedPoints[i].zone !== currentZone) {
        segments.push({ start, end: i - 1, zone: currentZone });
        currentZone = resolvedPoints[i].zone;
        start = i;
      }
    }
    segments.push({ start, end: resolvedPoints.length - 1, zone: currentZone });
    return segments;
  }, [resolvedPoints]);

  // Build path for NOI line (per zone color)
  const linePaths = useMemo(() => {
    const paths: { d: string; color: string; zone: string }[] = [];
    if (resolvedPoints.length === 0) return paths;

    for (const seg of zoneSegments) {
      const points = resolvedPoints.slice(seg.start, seg.end + 1);
      if (points.length === 0) continue;

      let d = `M ${xScale(points[0].index)} ${yScale(points[0].resolved)}`;
      for (let i = 1; i < points.length; i++) {
        d += ` L ${xScale(points[i].index)} ${yScale(points[i].resolved)}`;
      }

      const color = ZONE_COLORS[seg.zone] ?? ZONE_COLORS.projection;
      paths.push({ d, color, zone: seg.zone });
    }
    return paths;
  }, [resolvedPoints, zoneSegments, xScale, yScale]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: BT.text.muted, fontFamily: BT.font.mono, fontSize: BT.fontSize.md }}>
        Loading chart data…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: BT.text.red, fontFamily: BT.font.mono, fontSize: BT.fontSize.md }}>
        {error}
      </div>
    );
  }

  if (!data || resolvedPoints.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: BT.text.muted, fontFamily: BT.font.mono, fontSize: BT.fontSize.md }}>
        No periodic data available for chart.
      </div>
    );
  }

  // Y-axis ticks (5 ticks)
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    min + ((max - min) / yTicks) * i
  );

  // X-axis labels (year labels, one per year)
  const yearLabels = useMemo(() => {
    const labels: { x: number; label: string }[] = [];
    const seenYears = new Set<string>();
    for (const p of resolvedPoints) {
      const year = p.month.slice(0, 4);
      if (!seenYears.has(year)) {
        seenYears.add(year);
        labels.push({ x: xScale(p.index), label: year });
      }
    }
    return labels;
  }, [resolvedPoints, xScale]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Layer legend */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '4px 8px' }}>
        <LayerBadge label="Deal NOI" status="real" />
        <LayerBadge label="Submarket reference" status="not-yet" />
        <LayerBadge label="M35 events" status={events.length > 0 ? 'real' : 'not-yet'} />
        <LayerBadge label="Interventions" status="not-yet" />
      </div>

      {/* Chart */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: '100%', minWidth: 600 }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background */}
          <rect x={0} y={0} width={width} height={height} fill={BT.bg.terminal} />

          {/* Zone background bands */}
          {zoneSegments.map((seg, i) => {
            const x1 = xScale(resolvedPoints[seg.start].index);
            const x2 = xScale(resolvedPoints[seg.end].index);
            const zoneColor = ZONE_COLORS[seg.zone] ?? ZONE_COLORS.projection;
            return (
              <rect
                key={i}
                x={x1}
                y={margin.top}
                width={x2 - x1}
                height={chartH}
                fill={zoneColor}
                opacity={0.03}
              />
            );
          })}

          {/* Grid lines (horizontal) */}
          {yTickValues.map((v, i) => {
            const y = yScale(v);
            return (
              <line
                key={i}
                x1={margin.left}
                x2={margin.left + chartW}
                y1={y}
                y2={y}
                stroke={BT.border.subtle}
                strokeWidth={0.5}
                strokeDasharray={i === 0 || i === yTicks ? '' : '2,4'}
              />
            );
          })}

          {/* Y-axis */}
          <line
            x1={margin.left}
            x2={margin.left}
            y1={margin.top}
            y2={margin.top + chartH}
            stroke={BT.border.medium}
            strokeWidth={1}
          />

          {/* X-axis */}
          <line
            x1={margin.left}
            x2={margin.left + chartW}
            y1={margin.top + chartH}
            y2={margin.top + chartH}
            stroke={BT.border.medium}
            strokeWidth={1}
          />

          {/* Y-axis labels */}
          {yTickValues.map((v, i) => {
            const y = yScale(v);
            return (
              <text
                key={i}
                x={margin.left - 8}
                y={y + 4}
                textAnchor="end"
                fill={BT.text.muted}
                fontSize={BT.fontSize.xs}
                fontFamily={BT.font.mono}
              >
                {fmtPeriodicValue(v, 'noi')}
              </text>
            );
          })}

          {/* X-axis labels (years) */}
          {yearLabels.map((yl, i) => (
            <text
              key={i}
              x={yl.x}
              y={margin.top + chartH + 18}
              textAnchor="middle"
              fill={BT.text.muted}
              fontSize={BT.fontSize.xs}
              fontFamily={BT.font.mono}
            >
              {yl.label}
            </text>
          ))}

          {/* Axis titles */}
          <text
            x={margin.left - 50}
            y={margin.top + chartH / 2}
            textAnchor="middle"
            fill={BT.text.secondary}
            fontSize={BT.fontSize.xs}
            fontFamily={BT.font.mono}
            transform={`rotate(-90, ${margin.left - 50}, ${margin.top + chartH / 2})`}
          >
            NOI
          </text>

          <text
            x={margin.left + chartW / 2}
            y={height - 8}
            textAnchor="middle"
            fill={BT.text.secondary}
            fontSize={BT.fontSize.xs}
            fontFamily={BT.font.mono}
          >
            Month
          </text>

          {/* Boundary now-line */}
          {boundaryIndex != null && (
            <>
              <line
                x1={xScale(boundaryIndex)}
                x2={xScale(boundaryIndex)}
                y1={margin.top}
                y2={margin.top + chartH}
                stroke={BT.text.amber}
                strokeWidth={1.5}
                strokeDasharray="4,4"
              />
              <text
                x={xScale(boundaryIndex) + 4}
                y={margin.top + 12}
                fill={BT.text.amber}
                fontSize={BT.fontSize.xs}
                fontFamily={BT.font.mono}
                fontWeight={600}
              >
                {boundary?.actuals_through_month ?? ''}
              </text>
            </>
          )}

          {/* NOI line (per zone segment) */}
          {linePaths.map((lp, i) => (
            <path
              key={i}
              d={lp.d}
              fill="none"
              stroke={lp.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Data points */}
          {resolvedPoints.map((p, i) => (
            <circle
              key={i}
              cx={xScale(p.index)}
              cy={yScale(p.resolved)}
              r={2.5}
              fill={ZONE_COLORS[p.zone] ?? ZONE_COLORS.projection}
              stroke={BT.bg.terminal}
              strokeWidth={1}
            />
          ))}

          {/* M35 event annotation pins */}
          {events.map((evt, i) => {
            if (!evt.date) return null;
            const x = dateXScale(evt.date);
            if (x === null) return null;
            const pinColor = '#A78BFA';
            return (
              <g key={`m35-pin-${evt.id ?? i}`}>
                <line
                  x1={x} x2={x}
                  y1={margin.top} y2={margin.top + chartH}
                  stroke={pinColor}
                  strokeWidth={1}
                  strokeDasharray="3,3"
                  opacity={0.8}
                />
                <circle cx={x} cy={margin.top} r={2} fill={pinColor} />
                <text
                  x={x + 4}
                  y={margin.top + 22 + (i % 3) * 11}
                  fill={pinColor}
                  fontSize={9}
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={500}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {evt.label.length > 28 ? evt.label.slice(0, 26) + '…' : evt.label}
                </text>
              </g>
            );
          })}

          {/* Zone labels */}
          {zoneSegments.map((seg, i) => {
            const midIdx = Math.floor((seg.start + seg.end) / 2);
            const midPoint = resolvedPoints[midIdx];
            if (!midPoint) return null;
            return (
              <text
                key={`zone-label-${i}`}
                x={xScale(midIdx)}
                y={margin.top + 12}
                textAnchor="middle"
                fill={ZONE_COLORS[seg.zone] ?? ZONE_COLORS.projection}
                fontSize={BT.fontSize.xs}
                fontFamily={BT.font.mono}
                opacity={0.7}
              >
                {seg.zone}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default PeriodicChart;
