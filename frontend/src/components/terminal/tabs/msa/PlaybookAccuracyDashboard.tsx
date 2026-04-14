/**
 * PlaybookAccuracyDashboard — M35 Phase 7 Admin UI
 *
 * Shows per-playbook backtest accuracy stats, confidence scores,
 * regime-shift alerts, and admin actions (run backtest, acknowledge alerts).
 *
 * Used in M35ConnectorAdminPage.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { BT, terminalStyles } from '../../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccuracyStat {
  subtype: string;
  metricKey: string;
  windowMonths: number;
  backtestCount: number;
  rmse: number | null;
  meanPctError: number | null;
  coverageRate: number | null;
  currentConfidence: number | null;
  biasDirection: 'over' | 'under' | 'balanced' | 'insufficient_data';
  hasRegimeAlert: boolean;
}

interface RegimeAlert {
  id: string;
  subtype: string;
  metricKey: string;
  windowMonths: number;
  detectedAt: string;
  biasDirection: string;
  avgPctError: number | null;
  status: string;
}

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code',monospace" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null) return <span style={{ fontSize: 9, color: BT.text.dim }}>—</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 65 ? '#10B981' : pct >= 45 ? BT.accent.amber : '#EF4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 48, height: 4, background: BT.bg.elevated, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color }} />
      </div>
      <span style={{ fontSize: 9, color, fontWeight: 700 }}>{pct}%</span>
    </div>
  );
}

const BIAS_COLORS: Record<string, string> = {
  over:               '#EF4444',
  under:              BT.accent.amber,
  balanced:           '#10B981',
  insufficient_data:  BT.text.dim,
};

const METRIC_LABELS: Record<string, string> = {
  rent_growth_yoy: 'Rent YoY',
  net_absorption:  'Net Abs.',
  occupancy_rate:  'Occupancy',
  vacancy_rate:    'Vacancy',
  cap_rate:        'Cap Rate',
  permits_issued:  'Permits',
  search_growth:   'Search Growth',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function PlaybookAccuracyDashboard() {
  const [stats, setStats] = useState<AccuracyStat[]>([]);
  const [alerts, setAlerts] = useState<RegimeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filterSubtype, setFilterSubtype] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, alertsRes] = await Promise.all([
        fetch('/api/v1/m35/backtest/accuracy'),
        fetch('/api/v1/m35/backtest/regime-alerts'),
      ]);
      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats(d.accuracy ?? []);
      }
      if (alertsRes.ok) {
        const d = await alertsRes.json();
        setAlerts(d.alerts ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const runBacktest = async () => {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch('/api/v1/m35/backtest/run', { method: 'POST' });
      const d = await res.json();
      setMessage(`Backtest complete: ${d.newBacktestRows} new rows, ${d.playbooksRefined} playbooks refined, ${d.regimeAlertsCreated} regime alerts.`);
      await loadData();
    } finally {
      setRunning(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    await fetch(`/api/v1/m35/backtest/regime-alerts/${alertId}/ack`, { method: 'POST' });
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  // Unique subtypes for filter
  const subtypes = [...new Set(stats.map(s => s.subtype))].sort();

  const filtered = filterSubtype
    ? stats.filter(s => s.subtype === filterSubtype)
    : stats;

  // Group by subtype
  const grouped: Record<string, AccuracyStat[]> = {};
  for (const s of filtered) {
    if (!grouped[s.subtype]) grouped[s.subtype] = [];
    grouped[s.subtype].push(s);
  }

  return (
    <div style={{ color: BT.text.primary, ...mono, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: BT.text.secondary, letterSpacing: '0.1em' }}>
            PLAYBOOK ACCURACY DASHBOARD
          </div>
          <div style={{ fontSize: 9, color: BT.text.dim, marginTop: 2 }}>
            Backtest results · confidence calibration · regime shift alerts
          </div>
        </div>
        <button
          onClick={runBacktest}
          disabled={running}
          style={{
            padding: '6px 14px', fontSize: 9, fontWeight: 700, cursor: running ? 'default' : 'pointer',
            background: BT.accent.blue, color: '#0A0F14', border: 'none', ...mono,
            opacity: running ? 0.6 : 1,
          }}
        >
          {running ? '⟳ Running…' : '▶ Run Backtest Job'}
        </button>
      </div>

      {message && (
        <div style={{ ...terminalStyles.card, padding: '10px 14px', borderLeft: `3px solid #10B981`, fontSize: 10, color: '#10B981' }}>
          ✓ {message}
        </div>
      )}

      {/* ── Regime Alerts ────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#EF4444', letterSpacing: '0.08em', marginBottom: 8 }}>
            ⚠ REGIME SHIFT ALERTS ({alerts.length} open)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alerts.map(alert => (
              <div key={alert.id} style={{ ...terminalStyles.card, padding: '10px 14px', borderLeft: `3px solid #EF4444` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#EF4444' }}>
                      {alert.subtype.replace(/_/g, ' ')} — {METRIC_LABELS[alert.metricKey] ?? alert.metricKey}
                      {' '}@T+{alert.windowMonths}mo
                    </div>
                    <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 3 }}>
                      Systematic <span style={{ color: '#EF4444', fontWeight: 700 }}>{alert.biasDirection}-prediction</span>
                      {' '}for last {5} backtests.
                      {alert.avgPctError !== null && ` Avg error: ${(alert.avgPctError * 100).toFixed(1)}%`}
                    </div>
                    <div style={{ fontSize: 9, color: BT.text.dim, marginTop: 2 }}>
                      Detected {new Date(alert.detectedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    style={{
                      padding: '4px 10px', fontSize: 8, background: 'transparent', cursor: 'pointer',
                      color: BT.text.muted, border: `1px dashed ${BT.border.subtle}`, ...mono,
                    }}
                  >
                    ACK
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filter ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterSubtype('')}
          style={{
            padding: '3px 10px', fontSize: 8, cursor: 'pointer', ...mono,
            background: !filterSubtype ? BT.accent.blue : BT.bg.elevated,
            color: !filterSubtype ? '#0A0F14' : BT.text.muted,
            border: `1px solid ${!filterSubtype ? BT.accent.blue : BT.border.subtle}`,
          }}
        >
          ALL
        </button>
        {subtypes.map(s => (
          <button
            key={s}
            onClick={() => setFilterSubtype(s)}
            style={{
              padding: '3px 10px', fontSize: 8, cursor: 'pointer', ...mono,
              background: filterSubtype === s ? BT.accent.blue : BT.bg.elevated,
              color: filterSubtype === s ? '#0A0F14' : BT.text.muted,
              border: `1px solid ${filterSubtype === s ? BT.accent.blue : BT.border.subtle}`,
            }}
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* ── Stats Table ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: BT.text.muted, fontSize: 11 }}>
          Loading backtest data…
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div style={{ ...terminalStyles.card, padding: 24, textAlign: 'center', color: BT.text.dim, fontSize: 10 }}>
          No backtest results yet. Run a backtest job to generate accuracy data.
        </div>
      ) : (
        Object.entries(grouped).map(([subtype, rows]) => (
          <div key={subtype}>
            <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.08em', marginBottom: 8 }}>
              {subtype.replace(/_/g, ' ')}
            </div>
            <div style={{ ...terminalStyles.card, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 60px 80px 80px 80px 80px 60px',
                padding: '8px 14px',
                borderBottom: `1px solid ${BT.border.subtle}`,
                fontSize: 8, fontWeight: 700, color: BT.text.dim, letterSpacing: '0.06em',
              }}>
                <span>METRIC</span>
                <span>WINDOW</span>
                <span>BACKTESTS</span>
                <span>COVERAGE</span>
                <span>AVG ERR</span>
                <span>CONFIDENCE</span>
                <span>BIAS</span>
              </div>

              {rows.map(row => (
                <div
                  key={`${row.metricKey}|${row.windowMonths}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 60px 80px 80px 80px 80px 60px',
                    padding: '8px 14px',
                    borderBottom: `1px solid ${BT.border.subtle}20`,
                    fontSize: 9,
                    background: row.hasRegimeAlert ? '#EF444408' : 'transparent',
                  }}
                >
                  <span style={{ color: BT.text.secondary }}>
                    {row.hasRegimeAlert && <span style={{ color: '#EF4444', marginRight: 4 }}>⚠</span>}
                    {METRIC_LABELS[row.metricKey] ?? row.metricKey}
                  </span>
                  <span style={{ color: BT.text.muted }}>T+{row.windowMonths}mo</span>
                  <span style={{ color: BT.text.secondary }}>{row.backtestCount}</span>
                  <span style={{ color: row.coverageRate !== null && row.coverageRate >= 0.7 ? '#10B981' : BT.accent.amber }}>
                    {row.coverageRate !== null ? `${(row.coverageRate * 100).toFixed(0)}%` : '—'}
                  </span>
                  <span style={{ color: row.meanPctError !== null && Math.abs(row.meanPctError) > 0.1 ? '#EF4444' : BT.text.muted }}>
                    {row.meanPctError !== null ? `${(row.meanPctError >= 0 ? '+' : '')}${(row.meanPctError * 100).toFixed(1)}%` : '—'}
                  </span>
                  <ConfidenceBar value={row.currentConfidence} />
                  <span style={{ color: BIAS_COLORS[row.biasDirection] ?? BT.text.dim, fontWeight: 700, fontSize: 8 }}>
                    {row.biasDirection === 'insufficient_data' ? 'N/A' : row.biasDirection.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
