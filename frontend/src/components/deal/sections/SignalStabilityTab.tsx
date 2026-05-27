import React, { useState, useEffect } from 'react';
import { BT, PanelHeader } from '../bloomberg-ui';
import { apiClient } from '../../../services/api.client';
import { useCorrelationReport } from '../../../hooks/useCorrelationReport';
import { PinToWorkspaceButton } from '../../workspace/PinToWorkspaceButton';

const MONO = BT.font.mono;

interface StabilityData {
  stability_score: number | null;
  pair_count: number;
  data_points: number;
}

interface PairStability {
  metric_a: string;
  metric_b: string;
  history_points: number;
  latest_r: number;
  latest_date: string;
  stability_score: number | null;
}

function stabilityColor(score: number | null): string {
  if (score === null) return BT.text.muted;
  if (score >= 0.8) return BT.text.green;
  if (score >= 0.5) return BT.text.amber;
  return BT.text.red;
}

function stabilityLabel(score: number | null): string {
  if (score === null) return 'NO HISTORY';
  if (score >= 0.8) return 'STABLE';
  if (score >= 0.5) return 'MODERATE';
  return 'VOLATILE';
}

function StabilitySparkBar({ score }: { score: number | null }) {
  const pct = score !== null ? Math.round(score * 100) : 0;
  const color = stabilityColor(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
      <div style={{ flex: 1, height: 3, background: BT.border.subtle, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: color, transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: 9, color, minWidth: 28, textAlign: 'right' }}>
        {score !== null ? `${pct}%` : '—'}
      </span>
    </div>
  );
}

export function SignalStabilityTab({ city, state: st }: { city: string; state: string }) {
  const { report, loading, error } = useCorrelationReport(city, st);
  const [stability, setStability] = useState<StabilityData | null>(null);
  const [stabilityLoading, setStabilityLoading] = useState(true);
  const [pairs, setPairs] = useState<PairStability[]>([]);
  const [pairsLoading, setPairsLoading] = useState(true);

  useEffect(() => {
    if (!city) { setStabilityLoading(false); setPairsLoading(false); return; }
    setStabilityLoading(true);
    setPairsLoading(true);
    const stLower = st.toLowerCase();
    const geoId = `${city.toLowerCase().replace(/\s+/g, '-')}-${stLower}-${stLower}`;

    apiClient.get('/api/v1/correlations/history', {
      params: { geography_type: 'msa', geography_id: geoId, window_months: 36 },
    })
      .then(res => {
        const d = res.data?.data as StabilityData | undefined;
        if (d && d.data_points > 0) {
          setStability(d);
        } else {
          return apiClient.get('/api/v1/correlations/history', {
            params: { geography_type: 'national', geography_id: 'US', window_months: 36 },
          }).then(r => {
            const nd = r.data?.data as StabilityData | undefined;
            setStability(nd ?? null);
          });
        }
      })
      .catch(() => setStability(null))
      .finally(() => setStabilityLoading(false));

    apiClient.get('/api/v1/correlations/history/pairs', {
      params: { geography_type: 'msa', geography_id: geoId, window_months: 36, limit: 20 },
    })
      .then(res => {
        const rows = (res.data?.data ?? []) as PairStability[];
        if (rows.length > 0) {
          setPairs(rows);
        } else {
          return apiClient.get('/api/v1/correlations/history/pairs', {
            params: { geography_type: 'national', geography_id: 'US', window_months: 36, limit: 20 },
          }).then(r => {
            setPairs((r.data?.data ?? []) as PairStability[]);
          });
        }
      })
      .catch(() => setPairs([]))
      .finally(() => setPairsLoading(false));
  }, [city, st]);

  if (loading) return (
    <div style={{ padding: 24, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>
      Loading signal stability…
    </div>
  );
  if (error) return (
    <div style={{ padding: 12, fontFamily: MONO, fontSize: 10, color: BT.text.red }}>ERROR: {error}</div>
  );
  if (!report) return (
    <div style={{ padding: 24, textAlign: 'center', fontFamily: MONO, fontSize: 11, color: BT.text.secondary }}>
      No correlation data available.
    </div>
  );

  const sum = report.summary ?? { bullishSignals: 0, bearishSignals: 0, neutralSignals: 0, insufficientData: 0 };
  const score = stability?.stability_score ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PanelHeader
        title="SIGNAL STABILITY"
        subtitle={`COR-01–30 · ${report.market}, ${report.state} · 36M ROLLING WINDOW`}
        borderColor={BT.text.teal}
        metrics={[
          { l: `${sum.bullishSignals} BULL`, c: BT.text.green },
          { l: `${sum.bearishSignals} BEAR`, c: BT.text.red },
          { l: `${sum.neutralSignals} NEUT`, c: BT.text.secondary },
          { l: `${sum.insufficientData} INSUFF`, c: BT.text.muted },
        ]}
        right={
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
            {report.metricsComputed}/{report.correlations?.length ?? 30} computed
            {report.computedAt ? ` · ${new Date(report.computedAt).toLocaleString()}` : ''}
          </span>
        }
      />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: 8 }}>
        {/* Signal direction summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: BT.border.subtle, marginBottom: 4 }}>
          {[
            { l: 'BULLISH', v: sum.bullishSignals,   c: BT.text.green },
            { l: 'BEARISH', v: sum.bearishSignals,   c: BT.text.red },
            { l: 'NEUTRAL', v: sum.neutralSignals,   c: BT.text.secondary },
            { l: 'INSUFF',  v: sum.insufficientData, c: BT.text.muted },
          ].map(item => (
            <div key={item.l} style={{ background: BT.bg.panel, padding: '6px 10px' }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{item.l}</div>
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: item.c }}>{item.v}</div>
            </div>
          ))}
        </div>

        {/* Signal stability indicator */}
        <div style={{
          background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`,
          padding: '6px 10px', marginBottom: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>SIGNAL STABILITY · 36M ROLLING</span>
              <PinToWorkspaceButton
                payload={{ panel_type: 'market_chart', entity_id: `${city}, ${st}`, label: `${city} Market Signals` }}
              />
            </div>
            {stabilityLoading
              ? <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>computing…</span>
              : (
                <span style={{
                  fontFamily: MONO, fontSize: 9, fontWeight: 700,
                  color: stabilityColor(score),
                  background: `${stabilityColor(score)}18`,
                  padding: '1px 6px', borderRadius: 2,
                }}>
                  {stabilityLabel(score)}
                </span>
              )
            }
          </div>
          <StabilitySparkBar score={stabilityLoading ? null : score} />
          {!stabilityLoading && stability && (stability.pair_count > 0 || stability.data_points > 0) && (
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginTop: 3 }}>
              {stability.pair_count} pairs · {stability.data_points} observations
            </div>
          )}
          {!stabilityLoading && !stability?.pair_count && (
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginTop: 3 }}>
              Nightly job seeds history · first run pending
            </div>
          )}
        </div>

        {/* Pair-level stability list */}
        <div style={{
          background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`,
          padding: '6px 10px', marginBottom: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
              TRACKED METRIC PAIRS · 36M WINDOW
            </span>
            {pairsLoading
              ? <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>loading…</span>
              : <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{pairs.length} pairs</span>
            }
          </div>
          {pairsLoading && (
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, textAlign: 'center', padding: '6px 0' }}>
              computing…
            </div>
          )}
          {!pairsLoading && pairs.length === 0 && (
            <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, textAlign: 'center', padding: '6px 0', fontStyle: 'italic' }}>
              No pair history yet — nightly job running
            </div>
          )}
          {!pairsLoading && pairs.length > 0 && (
            <div style={{ maxHeight: 160, overflowY: 'auto' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 48px 56px 52px',
                gap: 4, padding: '2px 4px',
                borderBottom: `1px solid ${BT.border.subtle}`, marginBottom: 2,
              }}>
                {['METRIC A', 'METRIC B', 'r', 'STABILITY', 'PTS'].map(h => (
                  <span key={h} style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, textTransform: 'uppercase' }}>{h}</span>
                ))}
              </div>
              {pairs.map((p, idx) => {
                const sc = p.stability_score;
                const col = stabilityColor(sc);
                const lbl = sc !== null ? stabilityLabel(sc) : 'SHALLOW';
                const rAbs = Math.abs(p.latest_r);
                const rColor = rAbs >= 0.5 ? BT.text.green : rAbs >= 0.3 ? BT.text.amber : BT.text.muted;
                return (
                  <div key={idx} style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 48px 56px 52px',
                    gap: 4, padding: '3px 4px',
                    background: idx % 2 === 0 ? 'transparent' : `${BT.border.subtle}40`,
                    alignItems: 'center',
                  }}>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.metric_a}>{p.metric_a}</span>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.metric_b}>{p.metric_b}</span>
                    <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: rColor }}>{p.latest_r.toFixed(2)}</span>
                    <span style={{
                      fontFamily: MONO, fontSize: 8, fontWeight: 700, color: col,
                      background: `${col}18`, padding: '0px 3px', borderRadius: 2,
                    }}>{lbl}</span>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>{p.history_points}pt</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <PinToWorkspaceButton
            payload={{ panel_type: 'module_table', entity_id: `${city}, ${st}`, label: `${city} COR-01–30 Output` }}
          />
        </div>
      </div>
    </div>
  );
}
