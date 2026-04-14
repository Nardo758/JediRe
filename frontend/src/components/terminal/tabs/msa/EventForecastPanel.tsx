/**
 * EventForecastPanel — M35 Phase 7 UI
 *
 * Compact + full-detail forecast view for a single event.
 * Shows playbook-derived forward projections per metric × window,
 * with actuals tracking status and derivation summary.
 *
 * Used in MSAEventsTab right-panel and deal event sidebars.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { BT, terminalStyles } from '../../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ForecastMetric {
  metricKey: string;
  windowMonths: number;
  pointEstimate: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  confidence: number;
  statusLabel: 'ahead' | 'behind' | 'on_pace' | 'no_data';
}

interface ForecastActual {
  metricKey: string;
  windowMonths: number;
  forecastValue: number | null;
  actualValue: number | null;
  divergencePct: number | null;
  statusLabel: string;
  checkedAt: string;
}

interface EventForecast {
  eventId: string;
  eventName: string;
  subtype: string;
  status: string;
  playbookStatus: string;
  overallConfidence: number;
  generatedAt: string | null;
  metrics: ForecastMetric[];
  actuals: ForecastActual[];
  derivationSummary: string;
}

interface Props {
  eventId: string;
  eventName?: string;
  onRegenerateCallback?: () => void;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  rent_growth_yoy: 'Rent Growth (YoY)',
  effective_rent:  'Effective Rent',
  occupancy_rate:  'Occupancy Rate',
  vacancy_rate:    'Vacancy Rate',
  net_absorption:  'Net Absorption',
  absorption_pct:  'Absorption %',
  cap_rate:        'Cap Rate',
  permits_issued:  'Constr. Starts',
  deliveries:      'Deliveries',
  search_growth:   'Search Growth',
  traffic_growth:  'Traffic Growth',
  price_growth:    'Price Growth',
  median_price_unit: 'Median Price/Unit',
};

const METRIC_FORMAT: Record<string, { suffix: string; decimals: number; scale: number }> = {
  rent_growth_yoy: { suffix: '%', decimals: 1, scale: 100 },
  occupancy_rate:  { suffix: '%', decimals: 1, scale: 100 },
  vacancy_rate:    { suffix: '%', decimals: 1, scale: 100 },
  absorption_pct:  { suffix: '%', decimals: 1, scale: 100 },
  cap_rate:        { suffix: 'bps', decimals: 0, scale: 10000 },
  search_growth:   { suffix: '%', decimals: 0, scale: 100 },
  traffic_growth:  { suffix: '%', decimals: 0, scale: 100 },
  price_growth:    { suffix: '%', decimals: 1, scale: 100 },
  net_absorption:  { suffix: ' units', decimals: 0, scale: 1 },
  permits_issued:  { suffix: ' starts', decimals: 0, scale: 1 },
  deliveries:      { suffix: ' units', decimals: 0, scale: 1 },
  median_price_unit: { suffix: '/u', decimals: 0, scale: 1 },
};

function fmt(key: string, val: number | null): string {
  if (val === null) return '—';
  const f = METRIC_FORMAT[key] ?? { suffix: '', decimals: 2, scale: 1 };
  const v = val * f.scale;
  return `${v >= 0 ? '+' : ''}${v.toFixed(f.decimals)}${f.suffix}`;
}

function fmtCi(key: string, lo: number | null, hi: number | null): string {
  if (lo === null || hi === null) return '';
  const f = METRIC_FORMAT[key] ?? { suffix: '', decimals: 2, scale: 1 };
  return `[${(lo * f.scale).toFixed(f.decimals)}, ${(hi * f.scale).toFixed(f.decimals)}${f.suffix}]`;
}

const STATUS_COLORS: Record<string, string> = {
  ahead:    '#10B981',
  behind:   '#EF4444',
  on_pace:  BT.accent.blue,
  no_data:  BT.text.dim,
};

const BULL_KEYS = new Set(['rent_growth_yoy', 'effective_rent', 'occupancy_rate', 'net_absorption', 'search_growth', 'traffic_growth', 'price_growth']);
function isBullish(key: string, val: number): boolean {
  if (BULL_KEYS.has(key)) return val > 0;
  if (key === 'cap_rate' || key === 'vacancy_rate') return val < 0;
  return val > 0;
}

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" };

// ─── Confidence Bar ───────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 65 ? '#10B981' : pct >= 45 ? BT.accent.amber : '#EF4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 4, background: BT.bg.elevated, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color }} />
      </div>
      <span style={{ fontSize: 9, color, fontWeight: 700 }}>{pct}%</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EventForecastPanel({ eventId, eventName, onRegenerateCallback }: Props) {
  const [forecast, setForecast] = useState<EventForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeWindow, setActiveWindow] = useState<12 | 24 | 36>(12);
  const [showDerivation, setShowDerivation] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/m35/events/${eventId}/forecast`);
      if (res.ok) {
        const d = await res.json();
        setForecast(d.forecast ?? null);
      } else if (res.status === 404) {
        setForecast(null);
      } else {
        setError('Failed to load forecast');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const regenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/v1/m35/events/${eventId}/forecast/generate`, { method: 'POST' });
      if (res.ok) {
        await load();
        onRegenerateCallback?.();
      } else {
        const d = await res.json();
        setError(d.error ?? 'Failed to generate forecast');
      }
    } catch {
      setError('Network error');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center', color: BT.text.muted, fontSize: 11 }}>
        Loading forecast…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...terminalStyles.card, padding: 16, borderLeft: `3px solid #EF4444` }}>
        <div style={{ fontSize: 11, color: '#EF4444', marginBottom: 8 }}>⚠ {error}</div>
        <button onClick={load} style={{ fontSize: 9, color: BT.text.muted, background: 'transparent', border: `1px dashed ${BT.border.subtle}`, cursor: 'pointer', padding: '4px 10px', ...mono }}>
          ↺ Retry
        </button>
      </div>
    );
  }

  if (!forecast || forecast.metrics.length === 0) {
    return (
      <div style={{ ...terminalStyles.card, padding: 16, borderLeft: `3px solid ${BT.border.subtle}` }}>
        <div style={{ fontSize: 11, color: BT.text.muted, marginBottom: 8 }}>
          No forecast generated yet for this event.
        </div>
        <div style={{ fontSize: 10, color: BT.text.dim, marginBottom: 12 }}>
          Forecasts are auto-generated when an event transitions to <em>announced</em> or <em>in_progress</em>.
          You can also generate one manually.
        </div>
        <button
          onClick={regenerate}
          disabled={generating}
          style={{ fontSize: 9, color: BT.accent.blue, background: 'transparent', border: `1px solid ${BT.accent.blue}44`, cursor: 'pointer', padding: '6px 14px', ...mono }}
        >
          {generating ? '⟳ Generating…' : '⚡ Generate Forecast'}
        </button>
      </div>
    );
  }

  // Group metrics by key
  const metricKeys = [...new Set(forecast.metrics.map(m => m.metricKey))];
  const windowMetrics = forecast.metrics.filter(m => m.windowMonths === activeWindow);
  const actuals = forecast.actuals;

  const playbookColor = forecast.playbookStatus === 'publishable' ? '#10B981'
    : forecast.playbookStatus === 'preliminary' ? BT.accent.amber
    : BT.text.dim;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, ...mono }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{ ...terminalStyles.card, padding: '12px 16px', borderLeft: `3px solid ${BT.accent.blue}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.secondary, letterSpacing: '0.08em', marginBottom: 4 }}>
              PLAYBOOK FORECAST
            </div>
            <div style={{ fontSize: 11, color: BT.text.primary, fontWeight: 700 }}>
              {eventName ?? forecast.eventName}
            </div>
            <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 4, display: 'flex', gap: 10 }}>
              <span style={{ color: playbookColor, fontWeight: 700 }}>{forecast.playbookStatus.toUpperCase()}</span>
              <span>{forecast.subtype.replace(/_/g, ' ')}</span>
              {forecast.generatedAt && (
                <span>· gen {new Date(forecast.generatedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 4 }}>OVERALL CONF.</div>
            <ConfidenceBar value={forecast.overallConfidence} />
          </div>
        </div>
      </div>

      {/* ── Window selector ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4 }}>
        {([12, 24, 36] as const).map(w => (
          <button
            key={w}
            onClick={() => setActiveWindow(w)}
            style={{
              padding: '4px 12px', fontSize: 9, fontWeight: 700, cursor: 'pointer', ...mono,
              background: activeWindow === w ? BT.accent.blue : BT.bg.elevated,
              color: activeWindow === w ? '#0A0F14' : BT.text.muted,
              border: `1px solid ${activeWindow === w ? BT.accent.blue : BT.border.subtle}`,
            }}
          >
            T+{w}mo
          </button>
        ))}
      </div>

      {/* ── Metric forecasts for active window ───────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {windowMetrics.length === 0 ? (
          <div style={{ fontSize: 10, color: BT.text.dim, padding: '8px 0' }}>
            No forecast data for T+{activeWindow}mo window.
          </div>
        ) : (
          windowMetrics.map(m => {
            const label = METRIC_LABELS[m.metricKey] ?? m.metricKey;
            const isBull = m.pointEstimate !== null && isBullish(m.metricKey, m.pointEstimate);
            const valColor = m.pointEstimate === null ? BT.text.dim
              : isBull ? '#10B981' : '#EF4444';

            const actual = actuals.find(a => a.metricKey === m.metricKey && a.windowMonths === m.windowMonths);

            return (
              <div key={m.metricKey} style={{ ...terminalStyles.card, padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: BT.text.secondary, fontWeight: 700 }}>{label}</span>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: valColor }}>
                      {fmt(m.metricKey, m.pointEstimate)}
                    </span>
                    {m.ciLow !== null && m.ciHigh !== null && (
                      <span style={{ fontSize: 8, color: BT.text.dim }}>
                        {fmtCi(m.metricKey, m.ciLow, m.ciHigh)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Confidence + actuals tracking row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ConfidenceBar value={m.confidence} />
                  {actual && actual.actualValue !== null ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 9, color: BT.text.dim }}>
                        actual: <span style={{ color: BT.text.secondary }}>{fmt(m.metricKey, actual.actualValue)}</span>
                      </span>
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: '2px 6px',
                        color: STATUS_COLORS[actual.statusLabel] ?? BT.text.muted,
                        background: `${STATUS_COLORS[actual.statusLabel] ?? BT.text.muted}18`,
                        border: `1px solid ${STATUS_COLORS[actual.statusLabel] ?? BT.text.muted}33`,
                      }}>
                        {actual.statusLabel.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 8, color: BT.text.dim }}>no actuals yet</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Derivation summary (collapsible) ─────────────────────────────────── */}
      <div style={{ ...terminalStyles.card, padding: '8px 14px' }}>
        <button
          onClick={() => setShowDerivation(v => !v)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: BT.text.muted, fontSize: 9, padding: 0, width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', ...mono }}
        >
          <span>DERIVATION</span>
          <span>{showDerivation ? '▲' : '▼'}</span>
        </button>
        {showDerivation && (
          <div style={{ marginTop: 8, fontSize: 9, color: BT.text.secondary, lineHeight: 1.6 }}>
            {forecast.derivationSummary}
          </div>
        )}
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={regenerate}
          disabled={generating}
          style={{ fontSize: 9, color: BT.text.muted, background: 'transparent', border: `1px dashed ${BT.border.subtle}`, cursor: 'pointer', padding: '4px 10px', ...mono }}
        >
          {generating ? '⟳ Regenerating…' : '↺ Regenerate Forecast'}
        </button>
      </div>
    </div>
  );
}
