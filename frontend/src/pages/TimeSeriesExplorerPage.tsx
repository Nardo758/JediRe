import React, { useState, useEffect, useCallback } from 'react';


interface MetricSummary {
  metric_id: string;
  geography_type: string;
  geography_id: string;
  geography_name: string;
  source: string;
  period_type: string;
  data_points: number;
  earliest_date: string;
  latest_date: string;
  min_value: number;
  max_value: number;
  avg_value: number;
}

interface DataPoint {
  metric_id: string;
  geography_id: string;
  geography_name: string;
  period_date: string;
  value: number;
  source: string;
}

interface SourceSummary {
  source: string;
  metric_count: number;
  geo_count: number;
  total_points: number;
  earliest: string;
  latest: string;
  last_ingested: string;
}

const T = {
  bg: { main: '#0a0a0f', panel: '#111118', hover: '#1a1a24', selected: '#1e1e2d' },
  border: { subtle: '#1e1e2e', accent: '#2a2a3a' },
  text: { primary: '#e8e8f0', secondary: '#888899', muted: '#555566', orange: '#F5A623', green: '#00D26A', red: '#FF4757', cyan: '#00BCD4', amber: '#FFD166', blue: '#4A9EFF' },
};

function formatNum(v: number): string {
  if (Math.abs(v) >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + 'B';
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(v) >= 10_000) return (v / 1_000).toFixed(1) + 'K';
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toFixed(2);
}

function MiniChart({ data, width = 200, height = 40 }: { data: DataPoint[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const lastVal = values[values.length - 1];
  const firstVal = values[0];
  const color = lastVal >= firstVal ? T.text.green : T.text.red;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export function TimeSeriesExplorerPage() {
  const [metrics, setMetrics] = useState<MetricSummary[]>([]);
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<MetricSummary | null>(null);
  const [detailData, setDetailData] = useState<DataPoint[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [geoFilter, setGeoFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [ingesting, setIngesting] = useState<string | null>(null);
  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [metricsResp, summaryResp] = await Promise.all([
        fetch('/api/v1/time-series/metrics'),
        fetch('/api/v1/time-series/summary'),
      ]);
      if (!metricsResp.ok) throw new Error(`Metrics API returned ${metricsResp.status}`);
      if (!summaryResp.ok) throw new Error(`Summary API returned ${summaryResp.status}`);
      const metricsRes = await metricsResp.json();
      const summaryRes = await summaryResp.json();
      if (!metricsRes.success) throw new Error(metricsRes.error || 'Metrics request failed');
      if (!summaryRes.success) throw new Error(summaryRes.error || 'Summary request failed');
      setMetrics(metricsRes.metrics || []);
      setSources(summaryRes.sources || []);
      setTotals(summaryRes.totals || null);
    } catch (e: any) {
      console.error('Failed to load time series data:', e);
      setLoadError(e.message || String(e));
      setMetrics([]);
      setSources([]);
      setTotals(null);
    }
    setLoading(false);
  };

  const loadDetail = useCallback(async (m: MetricSummary) => {
    setSelectedMetric(m);
    setDetailLoading(true);
    setDetailData([]);
    try {
      const params = new URLSearchParams({ metric_id: m.metric_id, geography_id: m.geography_id });
      const resp = await fetch(`/api/v1/time-series/data?${params}`);
      if (!resp.ok) throw new Error(`Data API returned ${resp.status}`);
      const res = await resp.json();
      if (!res.success) throw new Error(res.error || 'Data request failed');
      setDetailData(res.data || []);
    } catch (e) {
      console.error('Failed to load detail:', e);
      setDetailData([]);
    }
    setDetailLoading(false);
  }, []);

  const triggerIngest = async (source: string) => {
    setIngesting(source);
    setIngestResult(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/v1/admin/ingest/${source}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: '{}',
      });
      if (!res.ok) throw new Error(`Ingest API returned ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setIngestResult(`${source}: ${data.message || 'Done'} — ${data.result?.rowsInserted || data.result?.variablesProcessed || 0} rows`);
        await loadData();
      } else {
        setIngestResult(`${source}: ${data.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setIngestResult(`${source} error: ${e.message}`);
    }
    setIngesting(null);
  };

  const geoNameMap = new Map<string, string>();
  for (const m of metrics) {
    if (m.geography_name && !geoNameMap.has(m.geography_id)) {
      geoNameMap.set(m.geography_id, m.geography_name);
    }
  }
  const uniqueGeos = [...new Set(metrics.map(m => m.geography_id))].sort((a, b) => {
    const nameA = geoNameMap.get(a) || a;
    const nameB = geoNameMap.get(b) || b;
    return nameA.localeCompare(nameB);
  });
  const uniqueSources = [...new Set(metrics.map(m => m.source))].sort();
  const filteredMetrics = metrics.filter(m => {
    if (searchFilter && !m.metric_id.toLowerCase().includes(searchFilter.toLowerCase()) && !m.geography_name.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    if (geoFilter && m.geography_id !== geoFilter) return false;
    if (sourceFilter && m.source !== sourceFilter) return false;
    return true;
  });

  return (
    <div style={{ background: T.bg.main, minHeight: '100vh', color: T.text.primary, fontFamily: "'JetBrains Mono', 'SF Mono', monospace" }}>
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.border.subtle}`, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text.orange, letterSpacing: 1 }}>TIME SERIES EXPLORER</div>
        <div style={{ flex: 1 }} />
        {totals && (
          <div style={{ display: 'flex', gap: 20 }}>
            <div><span style={{ fontSize: 10, color: T.text.muted }}>METRICS </span><span style={{ fontSize: 12, fontWeight: 700, color: T.text.cyan }}>{totals.total_metrics}</span></div>
            <div><span style={{ fontSize: 10, color: T.text.muted }}>GEOS </span><span style={{ fontSize: 12, fontWeight: 700, color: T.text.cyan }}>{totals.total_geos}</span></div>
            <div><span style={{ fontSize: 10, color: T.text.muted }}>DATA PTS </span><span style={{ fontSize: 12, fontWeight: 700, color: T.text.green }}>{Number(totals.total_points).toLocaleString()}</span></div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 53px)' }}>
        <div style={{ width: 280, borderRight: `1px solid ${T.border.subtle}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border.subtle}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.text.muted, marginBottom: 8, letterSpacing: 1 }}>DATA SOURCES</div>
            {sources.map(s => (
              <div key={s.source} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 10 }}>
                <span style={{ color: T.text.secondary, textTransform: 'uppercase' }}>{s.source}</span>
                <span style={{ color: T.text.cyan }}>{Number(s.total_points).toLocaleString()} pts</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border.subtle}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.text.muted, marginBottom: 8, letterSpacing: 1 }}>INGEST DATA</div>
            {['fred', 'census-acs'].map(src => (
              <button
                key={src}
                onClick={() => triggerIngest(src)}
                disabled={!!ingesting}
                style={{
                  display: 'block', width: '100%', padding: '6px 8px', marginBottom: 4,
                  background: ingesting === src ? T.text.orange + '22' : T.bg.hover,
                  border: `1px solid ${T.border.accent}`,
                  color: ingesting === src ? T.text.orange : T.text.primary,
                  fontSize: 10, fontWeight: 600, cursor: ingesting ? 'wait' : 'pointer',
                  fontFamily: 'inherit', letterSpacing: 0.5, textAlign: 'left',
                }}
              >
                {ingesting === src ? `INGESTING ${src.toUpperCase()}...` : `INGEST ${src.toUpperCase()}`}
              </button>
            ))}
            {ingestResult && (
              <div style={{ fontSize: 9, color: T.text.green, marginTop: 4, lineHeight: 1.4, wordBreak: 'break-all' }}>
                {ingestResult}
              </div>
            )}
          </div>

          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border.subtle}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.text.muted, marginBottom: 6, letterSpacing: 1 }}>FILTER</div>
            <input
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Search metrics..."
              style={{
                width: '100%', padding: '5px 8px', background: T.bg.panel, border: `1px solid ${T.border.accent}`,
                color: T.text.primary, fontSize: 10, fontFamily: 'inherit', marginBottom: 6, boxSizing: 'border-box',
              }}
            />
            <select
              value={geoFilter}
              onChange={e => setGeoFilter(e.target.value)}
              style={{
                width: '100%', padding: '5px 8px', background: T.bg.panel, border: `1px solid ${T.border.accent}`,
                color: T.text.primary, fontSize: 10, fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            >
              <option value="">All Geographies ({uniqueGeos.length})</option>
              {uniqueGeos.map(g => <option key={g} value={g}>{geoNameMap.get(g) || g}</option>)}
            </select>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              style={{
                width: '100%', padding: '5px 8px', background: T.bg.panel, border: `1px solid ${T.border.accent}`,
                color: T.text.primary, fontSize: 10, fontFamily: 'inherit', boxSizing: 'border-box', marginTop: 6,
              }}
            >
              <option value="">All Sources ({uniqueSources.length})</option>
              {uniqueSources.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ padding: '6px 12px', fontSize: 10, color: T.text.muted, borderBottom: `1px solid ${T.border.subtle}` }}>
              {filteredMetrics.length} series{filteredMetrics.length > 200 ? ' (showing first 200)' : ''}
            </div>
            {filteredMetrics.slice(0, 200).map(m => {
              const isSelected = selectedMetric?.metric_id === m.metric_id && selectedMetric?.geography_id === m.geography_id;
              return (
                <div
                  key={`${m.metric_id}-${m.geography_id}`}
                  onClick={() => loadDetail(m)}
                  style={{
                    padding: '8px 12px', cursor: 'pointer',
                    background: isSelected ? T.bg.selected : 'transparent',
                    borderBottom: `1px solid ${T.border.subtle}`,
                    borderLeft: isSelected ? `2px solid ${T.text.orange}` : '2px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.text.primary, flex: 1 }}>{m.metric_id}</div>
                    <span style={{ fontSize: 8, color: T.text.orange, background: 'rgba(255,170,0,0.1)', padding: '1px 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>{m.source}</span>
                  </div>
                  <div style={{ fontSize: 9, color: T.text.secondary, marginTop: 2 }}>{m.geography_name || m.geography_id}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 9, color: T.text.cyan }}>{m.data_points} pts</span>
                    <span style={{ fontSize: 9, color: T.text.muted }}>{m.earliest_date?.substring(0, 7)} → {m.latest_date?.substring(0, 7)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedMetric ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 14, color: T.text.muted }}>Select a metric from the sidebar</div>
              <div style={{ fontSize: 11, color: T.text.secondary }}>Browse {metrics.length} time series across {uniqueGeos.length} geographies</div>
              {loading && <div style={{ fontSize: 11, color: T.text.orange, marginTop: 8 }}>Loading data inventory...</div>}
              {loadError && <div style={{ fontSize: 11, color: T.text.red, marginTop: 8 }}>Error: {loadError}</div>}
            </div>
          ) : (
            <>
              <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.border.subtle}`, background: T.bg.panel }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.text.orange }}>{selectedMetric.metric_id}</div>
                  <div style={{ fontSize: 11, color: T.text.secondary }}>{selectedMetric.geography_name}</div>
                  <div style={{ flex: 1 }} />
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div><span style={{ fontSize: 9, color: T.text.muted }}>SOURCE </span><span style={{ fontSize: 11, color: T.text.cyan }}>{selectedMetric.source}</span></div>
                    <div><span style={{ fontSize: 9, color: T.text.muted }}>FREQ </span><span style={{ fontSize: 11, color: T.text.cyan }}>{selectedMetric.period_type}</span></div>
                    <div><span style={{ fontSize: 9, color: T.text.muted }}>PTS </span><span style={{ fontSize: 11, color: T.text.green }}>{selectedMetric.data_points}</span></div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
                  <div><span style={{ fontSize: 9, color: T.text.muted }}>MIN </span><span style={{ fontSize: 12, fontWeight: 700 }}>{formatNum(selectedMetric.min_value)}</span></div>
                  <div><span style={{ fontSize: 9, color: T.text.muted }}>MAX </span><span style={{ fontSize: 12, fontWeight: 700 }}>{formatNum(selectedMetric.max_value)}</span></div>
                  <div><span style={{ fontSize: 9, color: T.text.muted }}>AVG </span><span style={{ fontSize: 12, fontWeight: 700 }}>{formatNum(selectedMetric.avg_value)}</span></div>
                  <div><span style={{ fontSize: 9, color: T.text.muted }}>RANGE </span><span style={{ fontSize: 11, color: T.text.secondary }}>{selectedMetric.earliest_date} → {selectedMetric.latest_date}</span></div>
                </div>
              </div>

              {detailLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 12, color: T.text.orange }}>Loading time series...</div>
                </div>
              ) : (
                <>
                  <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.border.subtle}` }}>
                    <MiniChart data={detailData} width={800} height={120} />
                  </div>

                  <div style={{ flex: 1, overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ position: 'sticky', top: 0, background: T.bg.panel, zIndex: 1 }}>
                          {['DATE', 'VALUE', 'SOURCE', 'GEO'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: T.text.muted, borderBottom: `1px solid ${T.border.accent}`, letterSpacing: 1 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.map((d, i) => {
                          const prev = i > 0 ? detailData[i - 1].value : null;
                          const change = prev !== null ? d.value - prev : null;
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${T.border.subtle}` }}>
                              <td style={{ padding: '6px 12px', fontWeight: 600, color: T.text.primary }}>{d.period_date}</td>
                              <td style={{ padding: '6px 12px' }}>
                                <span style={{ fontWeight: 700, color: T.text.primary }}>{formatNum(d.value)}</span>
                                {change !== null && (
                                  <span style={{ marginLeft: 8, fontSize: 9, color: change >= 0 ? T.text.green : T.text.red }}>
                                    {change >= 0 ? '+' : ''}{formatNum(change)}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '6px 12px', color: T.text.secondary, fontSize: 10 }}>{d.source}</td>
                              <td style={{ padding: '6px 12px', color: T.text.secondary, fontSize: 10 }}>{d.geography_id}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default TimeSeriesExplorerPage;
