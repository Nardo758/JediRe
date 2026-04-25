import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  Legend,
  Brush,
} from 'recharts';
import { BT } from '../theme';
import { apiClient } from '../../../services/api.client';

interface SentimentTrendPoint {
  snapshotAt: string;
  agentScore: number | null;
  newsAvg30d: number | null;
  newsCount30d: number | null;
  macroConsumerSentiment: number | null;
  source: 'agent_run' | 'cron_snapshot' | 'backfill';
  topDriverNewsIds: string[];
}

interface SentimentTopNews {
  id: string;
  title: string;
  source: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
  sentimentScore: number | null;
  sentimentLabel: string | null;
}

interface SentimentAnomaly {
  snapshotAt: string;
  blendedFrom: number | null;
  blendedTo: number | null;
  magnitude: number;
  zScore: number | null;
  direction: 'up' | 'down';
  topDriverNewsIds: string[];
}

interface SentimentTrendResponse {
  success: boolean;
  entityType: string;
  entityId: string;
  entityName: string | null;
  window: { months: number };
  trend: {
    points: SentimentTrendPoint[];
    newsAvailable: boolean;
    current: {
      agentScore: number | null;
      newsAvg30d: number | null;
      macroConsumerSentiment: number | null;
      blended: number | null;
    };
    vs30d: {
      agentScoreDelta: number | null;
      newsAvg30dDelta: number | null;
      blendedDelta: number | null;
    };
    vs12mo: {
      agentScoreDelta: number | null;
      newsAvg30dDelta: number | null;
      blendedDelta: number | null;
    };
    topDriverNews: SentimentTopNews[];
    newsLookup: Record<string, SentimentTopNews>;
    anomalies: SentimentAnomaly[];
  };
}

interface MarketSentimentTrendProps {
  entityType: 'msa' | 'submarket';
  entityId: string;
  entityName?: string;
  windowMonths?: 12 | 18 | 24;
}

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

const formatScore = (n: number | null | undefined, digits = 2): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(digits);
};

const formatMacro = (n: number | null): string => (n === null ? '—' : n.toFixed(1));

const colorForScore = (n: number | null | undefined, neutralBand = 0.2): string => {
  if (n === null || n === undefined) return BT.text.muted;
  if (n >= neutralBand) return BT.text.green;
  if (n <= -neutralBand) return BT.text.red;
  return BT.text.amber;
};

const labelForBlended = (n: number | null): string => {
  if (n === null) return 'NO DATA';
  if (n >= 0.2) return 'BULLISH';
  if (n <= -0.2) return 'BEARISH';
  return 'NEUTRAL';
};

const blend = (
  agent: number | null,
  newsAvg: number | null,
  macroNorm: number | null,
): number | null => {
  const parts: { v: number; w: number }[] = [];
  if (agent !== null) parts.push({ v: agent, w: 0.5 });
  if (newsAvg !== null) parts.push({ v: newsAvg, w: 0.3 });
  if (macroNorm !== null) parts.push({ v: macroNorm, w: 0.2 });
  if (parts.length === 0) return null;
  const wTot = parts.reduce((s, p) => s + p.w, 0);
  return parts.reduce((s, p) => s + p.v * p.w, 0) / wTot;
};

export const MarketSentimentTrend: React.FC<MarketSentimentTrendProps> = ({
  entityType,
  entityId,
  entityName,
  windowMonths = 12,
}) => {
  const [data, setData] = useState<SentimentTrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [windowSel, setWindowSel] = useState<12 | 18 | 24>(windowMonths);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    apiClient
      .get(`/api/v1/sentiment/trend/${entityType}/${entityId}?window=${windowSel}`)
      .then(res => {
        if (cancelled) return;
        const body = res.data as SentimentTrendResponse;
        if (!body?.success) {
          setErr('Sentiment trend unavailable');
          setData(null);
        } else {
          setData(body);
        }
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Failed to load sentiment trend';
        setErr(msg);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, windowSel]);

  const chartRows = useMemo(() => {
    if (!data) return [];
    return data.trend.points.map(p => {
      const macroNorm = p.macroConsumerSentiment === null
        ? null
        : Math.max(-1, Math.min(1, (p.macroConsumerSentiment - 50) / 50));
      const blended = blend(p.agentScore, p.newsAvg30d, macroNorm);
      return {
        ts: new Date(p.snapshotAt).getTime(),
        snapshotAt: p.snapshotAt,
        dateLabel: new Date(p.snapshotAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        agent: p.agentScore,
        news: p.newsAvg30d,
        macro: macroNorm,
        macroRaw: p.macroConsumerSentiment,
        blended: blended === null ? null : Number(blended.toFixed(3)),
        newsCount: p.newsCount30d,
        topDriverNewsIds: p.topDriverNewsIds,
      };
    });
  }, [data]);

  // Key on the ISO timestamp (unique) rather than the friendly "MMM D" label,
  // which can collide across years in 18/24mo windows.
  const anomalyByIso = useMemo(() => {
    const map = new Map<string, SentimentAnomaly>();
    if (!data) return map;
    for (const a of data.trend.anomalies) map.set(a.snapshotAt, a);
    return map;
  }, [data]);

  const formatDateTick = (iso: string): string =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (loading) {
    return (
      <Wrapper>
        <Header entityName={entityName ?? entityId} windowSel={windowSel} setWindowSel={setWindowSel} />
        <Hint>Loading sentiment trend…</Hint>
      </Wrapper>
    );
  }

  if (err || !data) {
    return (
      <Wrapper>
        <Header entityName={entityName ?? entityId} windowSel={windowSel} setWindowSel={setWindowSel} />
        <Hint color={BT.text.red}>{err ?? 'Sentiment trend unavailable'}</Hint>
      </Wrapper>
    );
  }

  const t = data.trend;
  const hasAnyPoints = chartRows.length > 0;

  return (
    <Wrapper>
      <Header entityName={data.entityName ?? entityName ?? entityId} windowSel={windowSel} setWindowSel={setWindowSel} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '8px 12px' }}>
        <Kpi
          label="Blended"
          value={formatScore(t.current.blended)}
          sub={labelForBlended(t.current.blended)}
          color={colorForScore(t.current.blended)}
        />
        <Kpi
          label="vs 30d"
          value={formatScore(t.vs30d.blendedDelta)}
          sub={t.vs30d.blendedDelta === null ? 'no 30d ref' : 'blended Δ'}
          color={colorForScore(t.vs30d.blendedDelta, 0.05)}
        />
        <Kpi
          label="vs 12mo"
          value={formatScore(t.vs12mo.blendedDelta)}
          sub={t.vs12mo.blendedDelta === null ? 'no 12mo ref' : 'blended Δ'}
          color={colorForScore(t.vs12mo.blendedDelta, 0.1)}
        />
        <Kpi
          label="Macro UMCSI"
          value={formatMacro(t.current.macroConsumerSentiment)}
          sub={t.newsAvailable ? `news ${formatScore(t.current.newsAvg30d)}` : 'no news data'}
          color={BT.text.cyan}
        />
      </div>

      {!hasAnyPoints && (
        <Hint>
          No sentiment history yet for this {entityType}. Generate a commentary run, or wait for
          the daily snapshot — the chart fills in as data arrives.
        </Hint>
      )}

      {hasAnyPoints && (
        <div style={{ padding: '4px 4px 8px 4px' }}>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartRows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={BT.border.subtle} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="snapshotAt"
                tickFormatter={formatDateTick}
                tick={{ fill: BT.text.muted, fontSize: 9, fontFamily: 'monospace' }}
                stroke={BT.border.subtle}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[-1, 1]}
                ticks={[-1, -0.5, 0, 0.5, 1]}
                tick={{ fill: BT.text.muted, fontSize: 9, fontFamily: 'monospace' }}
                stroke={BT.border.subtle}
                width={28}
              />
              <ReferenceLine y={0} stroke={BT.border.subtle} strokeDasharray="3 3" />
              <Tooltip
                content={
                  <SentimentTooltip
                    newsLookup={t.newsLookup}
                    anomalyByIso={anomalyByIso}
                    formatDateTick={formatDateTick}
                  />
                }
                cursor={{ stroke: BT.text.amber, strokeOpacity: 0.4 }}
              />
              <Legend
                verticalAlign="top"
                iconType="circle"
                iconSize={6}
                wrapperStyle={{ fontSize: 9, fontFamily: 'monospace', color: BT.text.muted, paddingBottom: 4 }}
              />
              <Area
                type="monotone"
                dataKey="macro"
                name="Macro (UMCSI norm)"
                stroke={BT.text.cyan}
                fill={BT.text.cyan}
                fillOpacity={0.08}
                strokeOpacity={0.6}
                strokeWidth={1}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="news"
                name="News 30d avg"
                stroke={BT.text.violet}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="stepAfter"
                dataKey="agent"
                name="Agent sentiment"
                stroke={BT.text.amber}
                strokeWidth={2}
                dot={{ r: 3, fill: BT.text.amber }}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="blended"
                name="Blended"
                stroke={BT.text.primary}
                strokeWidth={1.25}
                strokeDasharray="3 3"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
              {t.anomalies.map((a, i) => {
                const fill = a.direction === 'up' ? BT.text.green : BT.text.red;
                return (
                  <ReferenceDot
                    key={`anomaly-${i}`}
                    x={a.snapshotAt}
                    y={a.blendedTo ?? 0}
                    r={5}
                    fill={fill}
                    stroke={BT.bg.panel}
                    strokeWidth={1.5}
                    ifOverflow="visible"
                  />
                );
              })}
              <Brush
                dataKey="snapshotAt"
                height={18}
                travellerWidth={6}
                stroke={BT.border.muted}
                fill={BT.bg.elevated}
                tickFormatter={() => ''}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {!t.newsAvailable && hasAnyPoints && (
        <Hint>
          News-sentiment series unavailable for this entity (no scored news in the window). Macro +
          agent + blended series shown.
        </Hint>
      )}

      {t.anomalies.length > 0 && (
        <div style={{ padding: '6px 12px 8px', borderTop: `1px solid ${BT.border.subtle}` }}>
          <div style={{
            fontSize: 9,
            color: BT.text.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 4,
            ...mono,
          }}>
            Detected moves ({t.anomalies.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {t.anomalies.slice(-3).reverse().map((a, i) => {
              const dateLbl = new Date(a.snapshotAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const color = a.direction === 'up' ? BT.text.green : BT.text.red;
              const news = a.topDriverNewsIds.slice(0, 2).map(id => t.newsLookup[id]).filter(Boolean);
              return (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 10, ...mono }}>
                  <span style={{ color: BT.text.muted, width: 48, flexShrink: 0 }}>{dateLbl}</span>
                  <span style={{ color, width: 56, flexShrink: 0 }}>
                    {formatScore(a.magnitude)} {a.zScore !== null ? `(${a.zScore.toFixed(1)}σ)` : ''}
                  </span>
                  <span style={{ color: BT.text.primary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {news.length > 0 ? news.map(n => n.title).join(' · ') : 'no driver news linked'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Wrapper>
  );
};

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    background: BT.bg.panel,
    border: `1px solid ${BT.border.subtle}`,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  }}>
    {children}
  </div>
);

const Header: React.FC<{
  entityName: string;
  windowSel: 12 | 18 | 24;
  setWindowSel: (n: 12 | 18 | 24) => void;
}> = ({ entityName, windowSel, setWindowSel }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: BT.bg.header,
    borderBottom: `1px solid ${BT.border.subtle}`,
  }}>
    <span style={{ fontSize: 11, color: BT.text.amber, fontWeight: 700, ...mono }}>
      Sentiment Trend — {entityName}
    </span>
    <div style={{ display: 'flex', gap: 4 }}>
      {([12, 18, 24] as const).map(opt => (
        <button
          key={opt}
          onClick={() => setWindowSel(opt)}
          style={{
            padding: '2px 8px',
            fontSize: 9,
            fontWeight: windowSel === opt ? 700 : 500,
            color: windowSel === opt ? BT.text.amber : BT.text.muted,
            background: windowSel === opt ? `${BT.text.amber}18` : 'transparent',
            border: `1px solid ${windowSel === opt ? `${BT.text.amber}66` : BT.border.subtle}`,
            borderRadius: 2,
            cursor: 'pointer',
            ...mono,
          }}
        >
          {opt}MO
        </button>
      ))}
    </div>
  </div>
);

const Hint: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color }) => (
  <div style={{
    padding: '8px 12px',
    fontSize: 10,
    color: color ?? BT.text.muted,
    fontStyle: 'italic',
    ...mono,
  }}>
    {children}
  </div>
);

const Kpi: React.FC<{ label: string; value: string; sub: string; color: string }> = ({ label, value, sub, color }) => (
  <div style={{
    padding: '6px 8px',
    background: BT.bg.elevated,
    border: `1px solid ${BT.border.subtle}`,
    borderRadius: 3,
  }}>
    <div style={{ fontSize: 9, color: BT.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em', ...mono }}>
      {label}
    </div>
    <div style={{ fontSize: 14, fontWeight: 700, color, marginTop: 2, ...mono }}>{value}</div>
    <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 1, ...mono }}>{sub}</div>
  </div>
);

interface RechartsTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{
    name?: string;
    value?: number | null;
    color?: string;
    payload?: {
      snapshotAt?: string;
      newsCount?: number | null;
      macroRaw?: number | null;
      topDriverNewsIds?: string[];
      blended?: number | null;
    };
  }>;
  newsLookup: Record<string, SentimentTopNews>;
  anomalyByIso: Map<string, SentimentAnomaly>;
  formatDateTick: (iso: string) => string;
}

const SentimentTooltip: React.FC<RechartsTooltipProps> = ({
  active,
  label,
  payload,
  newsLookup,
  anomalyByIso,
  formatDateTick,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const ctx = payload[0]?.payload;
  const iso = ctx?.snapshotAt ?? label;
  const driverIds = ctx?.topDriverNewsIds ?? [];
  const driverNews = driverIds.slice(0, 2).map(id => newsLookup[id]).filter((n): n is SentimentTopNews => !!n);
  const anomaly = iso ? anomalyByIso.get(iso) : undefined;
  const displayLabel = iso ? formatDateTick(iso) : (label ?? '');

  return (
    <div style={{
      background: BT.bg.panel,
      border: `1px solid ${BT.border.muted}`,
      padding: '6px 8px',
      fontSize: 10,
      maxWidth: 280,
      ...mono,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ color: BT.text.amber, fontWeight: 700 }}>{displayLabel}</span>
        {anomaly && (
          <span style={{
            color: anomaly.direction === 'up' ? BT.text.green : BT.text.red,
            fontSize: 9,
            fontWeight: 700,
          }}>
            ANOMALY {formatScore(anomaly.magnitude)}{anomaly.zScore !== null ? ` (${anomaly.zScore.toFixed(1)}σ)` : ''}
          </span>
        )}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: BT.text.secondary }}>
          <span style={{ color: p.color ?? BT.text.muted }}>{p.name}</span>
          <span style={{ color: BT.text.primary }}>
            {p.value === null || p.value === undefined ? '—' : Number(p.value).toFixed(2)}
          </span>
        </div>
      ))}
      {ctx?.macroRaw !== null && ctx?.macroRaw !== undefined && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: BT.text.muted, marginTop: 2 }}>
          <span>UMCSI raw</span>
          <span>{Number(ctx.macroRaw).toFixed(1)}</span>
        </div>
      )}
      {ctx?.newsCount !== null && ctx?.newsCount !== undefined && ctx.newsCount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: BT.text.muted }}>
          <span>News count 30d</span>
          <span>{ctx.newsCount}</span>
        </div>
      )}
      {driverNews.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${BT.border.subtle}` }}>
          <div style={{ color: BT.text.muted, fontSize: 9, textTransform: 'uppercase', marginBottom: 2 }}>
            Top news driving this point
          </div>
          {driverNews.map(n => {
            const c = n.sentimentScore === null
              ? BT.text.muted
              : n.sentimentScore > 0.1
                ? BT.text.green
                : n.sentimentScore < -0.1
                  ? BT.text.red
                  : BT.text.amber;
            return (
              <div key={n.id} style={{ display: 'flex', gap: 4, fontSize: 9, lineHeight: 1.3, marginBottom: 2 }}>
                <span style={{ color: c, width: 30, flexShrink: 0 }}>
                  {n.sentimentScore === null ? '—' : formatScore(n.sentimentScore)}
                </span>
                <span style={{ color: BT.text.primary, flex: 1 }}>{n.title}</span>
              </div>
            );
          })}
        </div>
      )}
      {driverNews.length === 0 && driverIds.length > 0 && (
        <div style={{ marginTop: 4, color: BT.text.muted, fontSize: 9 }}>
          {driverIds.length} driver news ids (titles unavailable)
        </div>
      )}
    </div>
  );
};

export default MarketSentimentTrend;
