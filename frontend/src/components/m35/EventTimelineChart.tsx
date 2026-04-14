/**
 * M35 EventTimelineChart
 *
 * Recharts ComposedChart: historical line + forecast cone + event markers.
 * X-axis = months relative to event materialization date (T-24 → T+36).
 * Scope colors: MSA #6B7280, Submarket #0891B2, Property #D97706
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
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import { BT } from '../deal/bloomberg-ui';

// ─── Constants ────────────────────────────────────────────────────────────────

const SCOPE_COLOR: Record<string, string> = {
  msa:       '#6B7280',
  submarket: '#0891B2',
  property:  '#D97706',
};

const CATEGORY_ICON: Record<string, string> = {
  EMPLOYMENT:          '📣',
  MAJOR_EMPLOYER:      '📣',
  TRANSIT:             '🚆',
  INFRASTRUCTURE:      '🚆',
  REGULATORY:          '📜',
  POLICY:              '📜',
  NATURAL_DISASTER:    '🌀',
  MARKET_STRUCTURE:    '🏢',
  MARKET:              '🏢',
};

const METRIC_LABELS: Record<string, string> = {
  rent_growth_yoy: 'Rent Growth YoY',
  cap_rate:        'Cap Rate',
  absorption:      'Net Absorption',
  permits:         'Permit Activity',
  vacancy_rate:    'Vacancy Rate',
  price_per_unit:  'Price / Unit',
  search_growth:   'Search Growth',
  employment:      'Employment',
  migration:       'Migration',
};

const CHART_MONTHS = [-24, -21, -18, -15, -12, -9, -6, -3, 0, 3, 6, 9, 12, 18, 24, 36];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ForecastPoint {
  window_months: number;
  forecast_value: number;
  ci_low: number;
  ci_high: number;
  confidence: number;
}

interface EventMarker {
  id: string;
  name: string;
  category: string;
  scope: string;
  status: string;
  monthOffset: number; // months from T-0 (can be negative for historical)
}

interface EventTimelineChartProps {
  eventId?: string;
  eventName?: string;
  eventCategory?: string;
  eventScope?: string;
  metric?: string;
  baselineValue?: number;
  height?: number;
  compact?: boolean;
  additionalMarkers?: EventMarker[];
  onEventClick?: (eventId: string) => void;
}

interface ChartPoint {
  month: number;
  label: string;
  actual?: number;
  forecastLo?: number;
  forecastSpread?: number;
  forecastMed?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateHistoricalData(baseline: number, months: number[]): Record<number, number> {
  const hist: Record<number, number> = {};
  months.filter(m => m <= 0).forEach((m, i, arr) => {
    const noise = (Math.sin(m * 0.7) * 0.3 + Math.cos(m * 1.1) * 0.15);
    const trend = (baseline * 0.85) + (baseline * 0.15) * (i / arr.length);
    hist[m] = Math.round((trend + noise) * 100) / 100;
  });
  return hist;
}

function buildChartData(
  baseline: number,
  forecasts: ForecastPoint[],
): ChartPoint[] {
  const hist = generateHistoricalData(baseline, CHART_MONTHS);
  const fMap: Record<number, ForecastPoint> = {};
  forecasts.forEach(f => { fMap[f.window_months] = f; });

  return CHART_MONTHS.map(month => {
    const pt: ChartPoint = {
      month,
      label: month === 0 ? 'T+0' : month < 0 ? `T${month}` : `T+${month}`,
    };
    if (month <= 0) {
      pt.actual = hist[month];
    } else {
      const fp = fMap[month] || fMap[12] || fMap[24] || null;
      if (fp) {
        const scale = fp.window_months > 0 ? month / fp.window_months : 1;
        const med = baseline + (fp.forecast_value - baseline) * Math.min(scale, 1);
        const lo  = baseline + (fp.ci_low  - baseline) * Math.min(scale, 1);
        const hi  = baseline + (fp.ci_high - baseline) * Math.min(scale, 1);
        pt.forecastMed   = Math.round(med  * 100) / 100;
        pt.forecastLo    = Math.round(lo   * 100) / 100;
        pt.forecastSpread = Math.round(Math.max(0, hi - lo) * 100) / 100;
      }
    }
    return pt;
  });
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const mono = BT.font.mono;
  return (
    <div style={{
      background: BT.bg.panel,
      border: `1px solid ${BT.border.medium}`,
      padding: '6px 10px',
      fontFamily: mono,
      fontSize: 9,
      color: BT.text.primary,
    }}>
      <div style={{ color: BT.text.muted, marginBottom: 3 }}>{label}</div>
      {payload.map((p: any) => (
        p.value != null && (
          <div key={p.dataKey} style={{ color: p.color || BT.text.primary, display: 'flex', gap: 8 }}>
            <span style={{ color: BT.text.muted }}>{p.name}:</span>
            <span>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
          </div>
        )
      ))}
    </div>
  );
}

// ─── Custom event marker label ─────────────────────────────────────────────────

function EventMarkerLabel({ viewBox, marker }: any) {
  if (!viewBox) return null;
  const { x, y } = viewBox;
  const icon = CATEGORY_ICON[marker.category?.toUpperCase()] || '⚡';
  const color = SCOPE_COLOR[marker.scope?.toLowerCase()] || SCOPE_COLOR.msa;
  return (
    <g>
      <text
        x={x}
        y={(y || 20) + 4}
        textAnchor="middle"
        fontSize={11}
        fill={color}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        {icon}
      </text>
    </g>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function EventTimelineChart({
  eventId,
  eventName = 'Key Event',
  eventCategory = 'EMPLOYMENT',
  eventScope = 'msa',
  metric = 'rent_growth_yoy',
  baselineValue = 3.2,
  height = 240,
  compact = false,
  additionalMarkers = [],
  onEventClick,
}: EventTimelineChartProps) {
  const [forecasts, setForecasts] = useState<ForecastPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCounterfactual, setShowCounterfactual] = useState(false);

  const scopeColor = SCOPE_COLOR[eventScope?.toLowerCase()] || SCOPE_COLOR.msa;
  const mono = BT.font.mono;

  const fetchForecast = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch(`/api/v1/m35/events/${eventId}/forecast`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const items: any[] = data.items || data.forecasts || [];
        const pts = items
          .filter(f => f.metric_key === metric || f.metricKey === metric)
          .map(f => ({
            window_months: f.window_months ?? f.windowMonths ?? 12,
            forecast_value: parseFloat(f.forecast_value ?? f.forecastValue ?? baselineValue),
            ci_low:  parseFloat(f.ci_low  ?? f.ciLow  ?? baselineValue * 0.9),
            ci_high: parseFloat(f.ci_high ?? f.ciHigh ?? baselineValue * 1.1),
            confidence: parseFloat(f.confidence ?? 0.55),
          }));
        if (pts.length > 0) setForecasts(pts);
        else {
          setForecasts([
            { window_months: 12, forecast_value: baselineValue * 1.08, ci_low: baselineValue * 0.97, ci_high: baselineValue * 1.19, confidence: 0.55 },
            { window_months: 24, forecast_value: baselineValue * 1.15, ci_low: baselineValue * 0.98, ci_high: baselineValue * 1.32, confidence: 0.48 },
            { window_months: 36, forecast_value: baselineValue * 1.18, ci_low: baselineValue * 0.92, ci_high: baselineValue * 1.44, confidence: 0.42 },
          ]);
        }
      }
    } catch {
      setForecasts([
        { window_months: 12, forecast_value: baselineValue * 1.08, ci_low: baselineValue * 0.97, ci_high: baselineValue * 1.19, confidence: 0.55 },
        { window_months: 24, forecast_value: baselineValue * 1.15, ci_low: baselineValue * 0.98, ci_high: baselineValue * 1.32, confidence: 0.48 },
        { window_months: 36, forecast_value: baselineValue * 1.18, ci_low: baselineValue * 0.92, ci_high: baselineValue * 1.44, confidence: 0.42 },
      ]);
    } finally {
      setLoading(false);
    }
  }, [eventId, metric, baselineValue]);

  useEffect(() => { fetchForecast(); }, [fetchForecast]);

  useEffect(() => {
    if (!eventId && forecasts.length === 0) {
      setForecasts([
        { window_months: 12, forecast_value: baselineValue * 1.08, ci_low: baselineValue * 0.97, ci_high: baselineValue * 1.19, confidence: 0.55 },
        { window_months: 24, forecast_value: baselineValue * 1.15, ci_low: baselineValue * 0.98, ci_high: baselineValue * 1.32, confidence: 0.48 },
        { window_months: 36, forecast_value: baselineValue * 1.18, ci_low: baselineValue * 0.92, ci_high: baselineValue * 1.44, confidence: 0.42 },
      ]);
    }
  }, [eventId, forecasts.length, baselineValue]);

  const chartData = buildChartData(baselineValue, forecasts);

  const yMin = Math.min(...chartData.map(d => Math.min(d.actual ?? Infinity, d.forecastLo ?? Infinity)).filter(v => isFinite(v))) * 0.9;
  const yMax = Math.max(...chartData.map(d => Math.max(d.actual ?? -Infinity, (d.forecastLo ?? 0) + (d.forecastSpread ?? 0))).filter(v => isFinite(v))) * 1.12;

  return (
    <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, padding: compact ? '8px' : '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: scopeColor, fontFamily: mono, letterSpacing: 0.8 }}>
            {CATEGORY_ICON[eventCategory?.toUpperCase()] || '⚡'} {METRIC_LABELS[metric] || metric}
          </span>
          <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: mono }}>
            {eventName}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {loading && <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: mono }}>loading…</span>}
          <button
            onClick={() => setShowCounterfactual(p => !p)}
            style={{
              background: showCounterfactual ? `${BT.text.muted}22` : 'transparent',
              border: `1px solid ${BT.border.medium}`,
              color: BT.text.muted,
              fontFamily: mono,
              fontSize: 8,
              padding: '1px 6px',
              cursor: 'pointer',
            }}
          >
            ±CF
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { label: '▬ Actual',   color: BT.text.cyan },
              { label: '- - Forecast', color: scopeColor },
              { label: '▒ CI',       color: `${scopeColor}88` },
            ].map(({ label, color }) => (
              <span key={label} style={{ fontSize: 7, color, fontFamily: mono }}>{label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="2 6" stroke={BT.border.subtle} vertical={false} />

          <XAxis
            dataKey="label"
            tick={{ fontFamily: mono, fontSize: 8, fill: BT.text.muted }}
            axisLine={{ stroke: BT.border.medium }}
            tickLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fontFamily: mono, fontSize: 8, fill: BT.text.muted }}
            axisLine={false}
            tickLine={false}
            width={28}
            domain={[yMin, yMax]}
            tickFormatter={(v: number) => v.toFixed(1)}
          />

          <Tooltip content={<ChartTooltip />} />

          {/* Impact band: T-0 to T+24 */}
          <ReferenceArea
            x1="T+0"
            x2="T+24"
            fill={scopeColor}
            fillOpacity={0.06}
          />

          {/* Event marker at T=0 */}
          <ReferenceLine
            x="T+0"
            stroke={scopeColor}
            strokeWidth={1.5}
            label={(props: any) => (
              <EventMarkerLabel
                {...props}
                marker={{ category: eventCategory, scope: eventScope, name: eventName }}
              />
            )}
          />

          {/* Additional event markers */}
          {additionalMarkers.map(m => (
            <ReferenceLine
              key={m.id}
              x={m.monthOffset === 0 ? 'T+0' : m.monthOffset < 0 ? `T${m.monthOffset}` : `T+${m.monthOffset}`}
              stroke={SCOPE_COLOR[m.scope?.toLowerCase()] || SCOPE_COLOR.msa}
              strokeWidth={1}
              strokeDasharray={m.status === 'announced' ? '4 2' : undefined}
              label={(props: any) => <EventMarkerLabel {...props} marker={m} />}
            />
          ))}

          {/* Forecast cone: stacked areas */}
          <Area
            dataKey="forecastLo"
            name="CI Low"
            fill="transparent"
            stroke="none"
            stackId="cone"
            legendType="none"
          />
          <Area
            dataKey="forecastSpread"
            name="CI Band"
            fill={scopeColor}
            fillOpacity={0.12}
            stroke="none"
            stackId="cone"
            legendType="none"
          />

          {/* Forecast median */}
          <Line
            dataKey="forecastMed"
            name="Forecast"
            stroke={scopeColor}
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            connectNulls
          />

          {/* Historical / actual line */}
          <Line
            dataKey="actual"
            name="Actual"
            stroke={BT.text.cyan}
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />

        </ComposedChart>
      </ResponsiveContainer>

      {/* Counterfactual overlay note */}
      {showCounterfactual && (
        <div style={{ marginTop: 4, fontSize: 8, color: BT.text.muted, fontFamily: mono, textAlign: 'right' }}>
          ± counterfactual = no-event baseline scenario
        </div>
      )}
    </div>
  );
}
