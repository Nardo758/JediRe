/**
 * TerminalChart - Multi-line chart with Bloomberg styling
 * Supports multiple data series, time range toggles, and legend
 */

import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { BT, fmt } from './theme';

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
  data: number[];
  visible?: boolean;
}

export interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

interface TerminalChartProps {
  title?: string;
  data: ChartDataPoint[];
  series: ChartSeries[];
  timeRanges?: string[];
  defaultRange?: string;
  onRangeChange?: (range: string) => void;
  height?: number;
  valueFormatter?: (value: number) => string;
  showGrid?: boolean;
  showLegend?: boolean;
  referenceLines?: { value: number; label: string; color?: string }[];
}

const TIME_RANGES = ['3M', '6M', '1Y', '2Y', '5Y', 'ALL'];

export const TerminalChart: React.FC<TerminalChartProps> = ({
  title,
  data,
  series,
  timeRanges = TIME_RANGES,
  defaultRange = '1Y',
  onRangeChange,
  height = 300,
  valueFormatter = (v) => v.toLocaleString(),
  showGrid = true,
  showLegend = true,
  referenceLines = [],
}) => {
  const [activeRange, setActiveRange] = useState(defaultRange);
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(
    new Set(series.map(s => s.key))
  );

  const handleRangeChange = (range: string) => {
    setActiveRange(range);
    onRangeChange?.(range);
  };

  const toggleSeries = (key: string) => {
    setVisibleSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div style={{
        background: BT.bg.panel,
        border: `1px solid ${BT.border.medium}`,
        borderRadius: 6,
        padding: '10px 14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          fontSize: 11,
          color: BT.text.muted,
          marginBottom: 8,
          fontWeight: 600,
        }}>
          {label}
        </div>
        {payload.map((entry: any) => (
          <div
            key={entry.dataKey}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              fontSize: 12,
              marginBottom: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: entry.color,
              }} />
              <span style={{ color: BT.text.secondary }}>{entry.name}</span>
            </div>
            <span style={{
              color: BT.text.primary,
              fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {valueFormatter(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{
      background: BT.bg.panel,
      border: `1px solid ${BT.border.subtle}`,
      borderRadius: 8,
      padding: 16,
    }}>
      {/* Header with title and time range toggles */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        {title && (
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            color: BT.text.primary,
            letterSpacing: '0.02em',
          }}>
            {title}
          </span>
        )}

        {/* Time range toggles */}
        <div style={{ display: 'flex', gap: 4 }}>
          {timeRanges.map(range => (
            <button
              key={range}
              onClick={() => handleRangeChange(range)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: activeRange === range ? 700 : 500,
                border: `1px solid ${activeRange === range ? BT.border.highlight : BT.border.subtle}`,
                background: activeRange === range ? BT.bg.active : BT.bg.terminal,
                color: activeRange === range ? BT.text.amber : BT.text.muted,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={BT.border.subtle}
              vertical={false}
            />
          )}
          <XAxis
            dataKey="date"
            tick={{ fill: BT.text.dim, fontSize: 10 }}
            tickLine={{ stroke: BT.border.subtle }}
            axisLine={{ stroke: BT.border.subtle }}
          />
          <YAxis
            tick={{ fill: BT.text.dim, fontSize: 10 }}
            tickLine={{ stroke: BT.border.subtle }}
            axisLine={{ stroke: BT.border.subtle }}
            tickFormatter={valueFormatter}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Reference lines */}
          {referenceLines.map((ref, i) => (
            <ReferenceLine
              key={i}
              y={ref.value}
              stroke={ref.color || BT.text.amber}
              strokeDasharray="5 5"
              label={{
                value: ref.label,
                fill: ref.color || BT.text.amber,
                fontSize: 10,
                position: 'right',
              }}
            />
          ))}

          {/* Data lines */}
          {series
            .filter(s => visibleSeries.has(s.key))
            .map(s => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      {showLegend && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${BT.border.subtle}`,
          justifyContent: 'center',
        }}>
          {series.map(s => (
            <button
              key={s.key}
              onClick={() => toggleSeries(s.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                opacity: visibleSeries.has(s.key) ? 1 : 0.4,
                transition: 'opacity 0.15s ease',
              }}
            >
              <div style={{
                width: 12,
                height: 3,
                background: s.color,
                borderRadius: 1,
              }} />
              <span style={{
                fontSize: 10,
                color: BT.text.secondary,
                fontWeight: 500,
              }}>
                {s.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TerminalChart;
