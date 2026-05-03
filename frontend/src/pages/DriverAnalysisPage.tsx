import React, { useState, useEffect, useCallback } from 'react';

interface DriverResult {
  id: number;
  runId: number;
  propertyId: string;
  driverMetricId: string;
  driverMetricName: string;
  driverCategory: string;
  driverGeographyType: string;
  driverGeographyId: string;
  outcomeMetricId: string;
  optimalLagWeeks: number;
  pearsonR: number;
  pValue: number;
  rSquared: number;
  slope: number;
  intercept: number;
  sampleSize: number;
  direction: string;
  computedAt: string;
}

interface RunInfo {
  id: number;
  property_id: string;
  property_name: string;
  status: string;
  driver_count: number;
  results_count: number;
  outcome_metrics: string[];
  created_at: string;
  completed_at: string;
}

const T = {
  bg: { main: '#0a0a0f', panel: '#111118', hover: '#1a1a24', selected: '#1e1e2d', header: '#0d0d14', input: '#0e0e16', row: '#13131c', rowAlt: '#111119' },
  border: { subtle: '#1e1e2e', accent: '#2a2a3a', bright: '#3b3b55' },
  text: { primary: '#e8e8f0', secondary: '#888899', muted: '#555566', orange: '#F5A623', green: '#00D26A', red: '#FF4757', cyan: '#00BCD4', amber: '#FFD166', blue: '#4A9EFF', purple: '#A78BFA', white: '#FFFFFF' },
  font: { mono: "'JetBrains Mono','Fira Code','SF Mono',monospace", label: "'IBM Plex Sans',sans-serif" },
};

const OUTCOME_LABELS: Record<string, string> = {
  OP_AVG_MARKET_RENT: 'Avg Market Rent',
  OP_LER: 'Lease Expiration Rate',
  OP_CONCESSION_PCT: 'Concession %',
  OP_EFFECTIVE_RENT: 'Effective Rent',
  OP_OCCUPANCY_PCT: 'Occupancy %',
  OP_TRAFFIC: 'Traffic',
  OP_NET_LEASES: 'Net Leases',
  OP_LEASED_PCT: 'Leased %',
};

const PROPERTIES = [
  { id: 'hsc-duluth', name: 'Highlands at Sugarloaf' },
  { id: 'ssc-suwanee', name: 'Symphony at Suwanee' },
];

type SortField = 'pearsonR' | 'rSquared' | 'pValue' | 'optimalLagWeeks' | 'sampleSize' | 'driverMetricName';
type SortDir = 'asc' | 'desc';

function rColor(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.7) return T.text.green;
  if (abs >= 0.5) return T.text.cyan;
  if (abs >= 0.3) return T.text.amber;
  return T.text.muted;
}

function pColor(p: number): string {
  if (p <= 0.001) return T.text.green;
  if (p <= 0.01) return T.text.cyan;
  if (p <= 0.05) return T.text.amber;
  return T.text.red;
}

function sigLabel(p: number): string {
  if (p <= 0.001) return '***';
  if (p <= 0.01) return '**';
  if (p <= 0.05) return '*';
  return '';
}

function lagDisplay(weeks: number): string {
  if (weeks === 0) return 'SYNC';
  if (weeks < 4) return `${weeks}w`;
  const months = Math.round(weeks / 4.33);
  return `${months}mo (${weeks}w)`;
}

function RBar({ value }: { value: number }) {
  const abs = Math.abs(value);
  const pct = Math.round(abs * 100);
  const color = rColor(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 6, background: T.bg.main, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ color, fontWeight: 700, fontSize: 11, minWidth: 45, textAlign: 'right' }}>
        {value > 0 ? '+' : ''}{value.toFixed(3)}
      </span>
    </div>
  );
}

export default function DriverAnalysisPage() {
  const [selectedProperty, setSelectedProperty] = useState(PROPERTIES[0].id);
  const [results, setResults] = useState<DriverResult[]>([]);
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [runProgress, setRunProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [minR, setMinR] = useState<number>(0.2);
  const [sortField, setSortField] = useState<SortField>('rSquared');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const getHeaders = () => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    const t = localStorage.getItem('auth_token');
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  };

  const loadResults = useCallback(async (propId: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sortBy: 'r_squared', sortDir: 'desc', limit: '2000' });
      const resp = await fetch(`/api/v1/driver-analysis/results/${propId}?${params}`, { headers: getHeaders() });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      if (data.success) {
        setResults(data.data || []);
      } else {
        throw new Error(data.error || 'Failed');
      }
    } catch (e: any) {
      setError(e.message);
      setResults([]);
    }
    setLoading(false);
  }, []);

  const loadRuns = useCallback(async (propId: string) => {
    try {
      const resp = await fetch(`/api/v1/driver-analysis/runs?propertyId=${propId}`, { headers: getHeaders() });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.success) setRuns(data.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadResults(selectedProperty);
    loadRuns(selectedProperty);
  // hook omits loadResults, loadRuns — these are useCallback/useMemo-stabilized values whose identities only change when their own deps change, already captured by the listed primitive deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty]);

  const triggerRun = async () => {
    setRunning(true);
    setRunProgress('Initializing driver analysis engine...');
    setError(null);
    try {
      const resp = await fetch('/api/v1/driver-analysis/run', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ propertyId: selectedProperty, maxLagWeeks: 26, minSampleSize: 12 }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      if (data.success) {
        setRunProgress(`Complete: ${data.data.totalResultsStored} relationships found from ${data.data.totalDriversTested} drivers`);
        await loadResults(selectedProperty);
        await loadRuns(selectedProperty);
      } else {
        throw new Error(data.error || 'Run failed');
      }
    } catch (e: any) {
      setError(e.message);
      setRunProgress('');
    }
    setRunning(false);
  };

  const categories = Array.from(new Set(results.map(r => r.driverCategory))).sort();
  const outcomes = Array.from(new Set(results.map(r => r.outcomeMetricId))).sort();

  const filtered = results.filter(r => {
    if (outcomeFilter !== 'ALL' && r.outcomeMetricId !== outcomeFilter) return false;
    if (categoryFilter !== 'ALL' && r.driverCategory !== categoryFilter) return false;
    if (Math.abs(r.pearsonR) < minR) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let av: number, bv: number;
    switch (sortField) {
      case 'pearsonR': av = Math.abs(a.pearsonR); bv = Math.abs(b.pearsonR); break;
      case 'rSquared': av = a.rSquared; bv = b.rSquared; break;
      case 'pValue': av = a.pValue; bv = b.pValue; break;
      case 'optimalLagWeeks': av = a.optimalLagWeeks; bv = b.optimalLagWeeks; break;
      case 'sampleSize': av = a.sampleSize; bv = b.sampleSize; break;
      case 'driverMetricName': return sortDir === 'asc' ? a.driverMetricName.localeCompare(b.driverMetricName) : b.driverMetricName.localeCompare(a.driverMetricName);
      default: av = a.rSquared; bv = b.rSquared;
    }
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'pValue' || field === 'optimalLagWeeks' ? 'asc' : 'desc');
    }
  };

  const sortArrow = (field: SortField) => sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const lastRun = runs.length > 0 ? runs[0] : null;

  const propName = PROPERTIES.find(p => p.id === selectedProperty)?.name || selectedProperty;

  return (
    <div style={{ minHeight: '100vh', background: T.bg.main, color: T.text.primary, fontFamily: T.font.mono }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <div style={{ borderBottom: `1px solid ${T.border.subtle}`, background: T.bg.header, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: T.text.orange, letterSpacing: 2 }}>DRIVER ANALYSIS</span>
          <span style={{ fontSize: 10, color: T.text.muted }}>|</span>
          <span style={{ fontSize: 10, color: T.text.secondary, letterSpacing: 1 }}>PROPERTY PERFORMANCE DRIVERS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="/terminal/data" style={{ fontSize: 10, color: T.text.cyan, textDecoration: 'none', letterSpacing: 0.5 }}>← DATA EXPLORER</a>
          <span style={{ fontSize: 10, color: T.text.muted }}>|</span>
          <a href="/terminal/strategies" style={{ fontSize: 10, color: T.text.purple, textDecoration: 'none', letterSpacing: 0.5 }}>STRATEGIES →</a>
        </div>
      </div>

      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${T.border.subtle}`, background: T.bg.panel, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 10, color: T.text.muted, letterSpacing: 0.5 }}>PROPERTY</label>
          <select
            value={selectedProperty}
            onChange={e => setSelectedProperty(e.target.value)}
            style={{ fontFamily: T.font.mono, fontSize: 11, background: T.bg.input, color: T.text.primary, border: `1px solid ${T.border.accent}`, padding: '4px 8px', outline: 'none' }}
          >
            {PROPERTIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 10, color: T.text.muted, letterSpacing: 0.5 }}>OUTCOME</label>
          <select
            value={outcomeFilter}
            onChange={e => setOutcomeFilter(e.target.value)}
            style={{ fontFamily: T.font.mono, fontSize: 11, background: T.bg.input, color: T.text.primary, border: `1px solid ${T.border.accent}`, padding: '4px 8px', outline: 'none' }}
          >
            <option value="ALL">ALL OUTCOMES</option>
            {outcomes.map(o => <option key={o} value={o}>{OUTCOME_LABELS[o] || o}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 10, color: T.text.muted, letterSpacing: 0.5 }}>CATEGORY</label>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ fontFamily: T.font.mono, fontSize: 11, background: T.bg.input, color: T.text.primary, border: `1px solid ${T.border.accent}`, padding: '4px 8px', outline: 'none' }}
          >
            <option value="ALL">ALL CATEGORIES</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 10, color: T.text.muted, letterSpacing: 0.5 }}>MIN |R|</label>
          <select
            value={minR}
            onChange={e => setMinR(parseFloat(e.target.value))}
            style={{ fontFamily: T.font.mono, fontSize: 11, background: T.bg.input, color: T.text.primary, border: `1px solid ${T.border.accent}`, padding: '4px 8px', outline: 'none' }}
          >
            <option value={0}>0.00</option>
            <option value={0.2}>0.20</option>
            <option value={0.3}>0.30</option>
            <option value={0.5}>0.50</option>
            <option value={0.7}>0.70</option>
          </select>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={triggerRun}
          disabled={running}
          style={{
            fontFamily: T.font.mono, fontSize: 11, fontWeight: 700,
            background: running ? T.bg.input : T.text.orange,
            color: running ? T.text.muted : '#000',
            border: 'none', padding: '6px 16px', cursor: running ? 'default' : 'pointer',
            letterSpacing: 1, animation: running ? 'pulse 1.5s infinite' : 'none',
          }}
        >
          {running ? '⟳ RUNNING...' : '▶ RUN ANALYSIS'}
        </button>
      </div>

      {(runProgress || error) && (
        <div style={{ padding: '6px 16px', borderBottom: `1px solid ${T.border.subtle}`, background: error ? '#1a0a0a' : '#0a1a0a' }}>
          {error && <span style={{ fontSize: 10, color: T.text.red }}>ERROR: {error}</span>}
          {runProgress && !error && <span style={{ fontSize: 10, color: T.text.green }}>{runProgress}</span>}
        </div>
      )}

      <div style={{ padding: '6px 16px', borderBottom: `1px solid ${T.border.subtle}`, background: T.bg.panel, display: 'flex', gap: 24 }}>
        <Stat label="PROPERTY" value={propName} color={T.text.white} />
        <Stat label="TOTAL RESULTS" value={String(results.length)} color={T.text.cyan} />
        <Stat label="FILTERED" value={String(sorted.length)} color={T.text.amber} />
        <Stat label="OUTCOMES TESTED" value={String(outcomes.length)} color={T.text.green} />
        <Stat label="CATEGORIES" value={String(categories.length)} color={T.text.purple} />
        {lastRun && (
          <>
            <Stat label="LAST RUN" value={new Date(lastRun.completed_at || lastRun.created_at).toLocaleDateString()} color={T.text.secondary} />
            <Stat label="DRIVERS TESTED" value={String(lastRun.driver_count || '—')} color={T.text.secondary} />
            <Stat label="STATUS" value={lastRun.status.toUpperCase()} color={lastRun.status === 'completed' ? T.text.green : T.text.amber} />
          </>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.text.muted, fontSize: 11, letterSpacing: 1, animation: 'pulse 1.5s infinite' }}>
            LOADING DRIVER ANALYSIS RESULTS...
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ color: T.text.muted, fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>NO RESULTS FOUND</div>
            <div style={{ color: T.text.secondary, fontSize: 10 }}>
              {results.length === 0
                ? 'Run a driver analysis to discover which metrics drive property performance.'
                : 'Adjust filters to see results. Try lowering the minimum |R| threshold.'}
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: T.bg.header, borderBottom: `2px solid ${T.border.accent}` }}>
                <TH onClick={() => toggleSort('driverMetricName')} style={{ textAlign: 'left', paddingLeft: 16 }}>
                  DRIVER METRIC{sortArrow('driverMetricName')}
                </TH>
                <TH>CATEGORY</TH>
                <TH>OUTCOME</TH>
                <TH onClick={() => toggleSort('pearsonR')}>
                  PEARSON R{sortArrow('pearsonR')}
                </TH>
                <TH onClick={() => toggleSort('rSquared')}>
                  R²{sortArrow('rSquared')}
                </TH>
                <TH onClick={() => toggleSort('pValue')}>
                  P-VALUE{sortArrow('pValue')}
                </TH>
                <TH onClick={() => toggleSort('optimalLagWeeks')}>
                  OPTIMAL LAG{sortArrow('optimalLagWeeks')}
                </TH>
                <TH>DIR</TH>
                <TH onClick={() => toggleSort('sampleSize')}>
                  N{sortArrow('sampleSize')}
                </TH>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <React.Fragment key={r.id || i}>
                  <tr
                    onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                    style={{
                      background: expandedRow === i ? T.bg.selected : (i % 2 === 0 ? T.bg.row : T.bg.rowAlt),
                      cursor: 'pointer',
                      borderBottom: `1px solid ${T.border.subtle}`,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (expandedRow !== i) (e.currentTarget as HTMLElement).style.background = T.bg.hover; }}
                    onMouseLeave={e => { if (expandedRow !== i) (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? T.bg.row : T.bg.rowAlt; }}
                  >
                    <td style={{ padding: '6px 8px 6px 16px', color: T.text.primary, fontWeight: 500, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.driverMetricName}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: T.text.purple, background: `${T.text.purple}15`, padding: '2px 6px', letterSpacing: 0.5 }}>
                        {r.driverCategory}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: T.text.cyan, letterSpacing: 0.5 }}>
                        {OUTCOME_LABELS[r.outcomeMetricId] || r.outcomeMetricId}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <RBar value={r.pearsonR} />
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', color: rColor(Math.sqrt(r.rSquared)), fontWeight: 700 }}>
                      {r.rSquared.toFixed(3)}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <span style={{ color: pColor(r.pValue), fontWeight: 600 }}>
                        {r.pValue < 0.001 ? r.pValue.toExponential(1) : r.pValue.toFixed(4)}
                      </span>
                      <span style={{ color: T.text.green, fontSize: 10, marginLeft: 2 }}>{sigLabel(r.pValue)}</span>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', color: r.optimalLagWeeks === 0 ? T.text.amber : T.text.secondary }}>
                      {lagDisplay(r.optimalLagWeeks)}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: r.direction === 'positive' ? T.text.green : T.text.red }}>
                        {r.direction === 'positive' ? '↑' : '↓'}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', color: T.text.muted }}>
                      {r.sampleSize}
                    </td>
                  </tr>
                  {expandedRow === i && (
                    <tr style={{ background: T.bg.selected }}>
                      <td colSpan={9} style={{ padding: '8px 16px', borderBottom: `1px solid ${T.border.accent}` }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, animation: 'fadeIn 0.15s' }}>
                          <DetailCard label="METRIC ID" value={r.driverMetricId} />
                          <DetailCard label="GEOGRAPHY" value={`${r.driverGeographyType}: ${r.driverGeographyId}`} />
                          <DetailCard label="SLOPE" value={r.slope.toFixed(6)} />
                          <DetailCard label="INTERCEPT" value={r.intercept.toFixed(4)} />
                          <DetailCard label="SAMPLE SIZE" value={String(r.sampleSize)} />
                          <DetailCard label="OPTIMAL LAG" value={`${r.optimalLagWeeks} weeks`} />
                          <DetailCard label="EXPLANATORY POWER" value={`${(r.rSquared * 100).toFixed(1)}% of variance explained`} />
                          <DetailCard label="SIGNIFICANCE" value={r.pValue <= 0.001 ? 'Highly Significant' : r.pValue <= 0.01 ? 'Very Significant' : r.pValue <= 0.05 ? 'Significant' : 'Not Significant'} color={pColor(r.pValue)} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 9, color: T.text.muted, letterSpacing: 1 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: T.font.mono }}>{value}</span>
    </div>
  );
}

function TH({ children, onClick, style }: { children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: '8px 8px',
        fontSize: 9,
        fontWeight: 700,
        color: T.text.muted,
        letterSpacing: 1,
        textAlign: 'center',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        fontFamily: T.font.mono,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function DetailCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: T.bg.main, padding: '6px 10px', border: `1px solid ${T.border.subtle}` }}>
      <div style={{ fontSize: 9, color: T.text.muted, letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: color || T.text.primary, fontWeight: 600, fontFamily: T.font.mono, wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}
