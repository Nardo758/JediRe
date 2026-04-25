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
  Legend,
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
  };
}

interface MarketSentimentTrendProps {
  entityType: 'msa' | 'submarket';
  entityId: string;
  entityName?: string;
  windowMonths?: 12 | 18 | 24;
}

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

const formatScore = (n: number | null, digits = 2): string =>
  n === null ? '—' : (n >= 0 ? '+' : '') + n.toFixed(digits);

const formatMacro = (n: number | null): string =>
  n === null ? '—' : n.toFixed(1);

const colorForBlended = (n: number | null): string => {
  if (n === null) return BT.text.muted;
  if (n >= 0.2) return BT.text.green;
  if (n <= -0.2) return BT.text.red;
  return BT.text.amber;
};

const labelForBlended = (n: number | null): string => {
  if (n === null) return 'NO DATA';
  if (n >= 0.2) return 'BULLISH';
  if (n <= -0.2) return 'BEARISH';
  return 'NEUTRAL';
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
      return {
        ts: new Date(p.snapshotAt).getTime(),
        dateLabel: new Date(p.snapshotAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        agent: p.agentScore,
        news: p.newsAvg30d,
        macro: macroNorm,
        macroRaw: p.macroConsumerSentiment,
        newsCount: p.newsCount30d,
      };
    });
  }, [data]);

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
  const blendedColor = colorForBlended(t.current.blended);

  return (
    <Wrapper>
      <Header entityName={data.entityName ?? entityName ?? entityId} windowSel={windowSel} setWindowSel={setWindowSel} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '8px 12px' }}>
        <Kpi
          label="Blended"
          value={formatScore(t.current.blended)}
          sub={labelForBlended(t.current.blended)}
          color={blendedColor}
        />
        <Kpi
          label="Agent"
          value={formatScore(t.current.agentScore, 0)}
          sub={
            t.vs30d.agentScoreDelta === null
              ? 'no 30d ref'
              : `${formatScore(t.vs30d.agentScoreDelta, 0)} vs 30d`
          }
          color={
            t.current.agentScore === null
              ? BT.text.muted
              : t.current.agentScore > 0
                ? BT.text.green
                : t.current.agentScore < 0
                  ? BT.text.red
                  : BT.text.amber
          }
        />
        <Kpi
          label="News 30d"
          value={t.newsAvailable ? formatScore(t.current.newsAvg30d) : '—'}
          sub={
            !t.newsAvailable
              ? 'no news data'
              : t.vs30d.newsAvg30dDelta === null
                ? 'no 30d ref'
                : `${formatScore(t.vs30d.newsAvg30dDelta)} vs 30d`
          }
          color={
            !t.newsAvailable || t.current.newsAvg30d === null
              ? BT.text.muted
              : t.current.newsAvg30d > 0
                ? BT.text.green
                : t.current.newsAvg30d < 0
                  ? BT.text.red
                  : BT.text.amber
          }
        />
        <Kpi
          label="Macro UMCSI"
          value={formatMacro(t.current.macroConsumerSentiment)}
          sub={
            t.vs12mo.blendedDelta === null
              ? 'no 12mo ref'
              : `blend ${formatScore(t.vs12mo.blendedDelta)} vs 12mo`
          }
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
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={chartRows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={BT.border.subtle} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="dateLabel"
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
                content={<SentimentTooltip topNews={t.topDriverNews} />}
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
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {!t.newsAvailable && hasAnyPoints && (
        <Hint>
          News-sentiment series unavailable for this entity (no scored news in the window). Macro +
          agent series shown.
        </Hint>
      )}

      {t.topDriverNews.length > 0 && (
        <div style={{ padding: '6px 12px 8px', borderTop: `1px solid ${BT.border.subtle}` }}>
          <div style={{
            fontSize: 9,
            color: BT.text.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 4,
            ...mono,
          }}>
            Top Driving News (last snapshot)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {t.topDriverNews.slice(0, 3).map(n => {
              const scoreColor = n.sentimentScore === null
                ? BT.text.muted
                : n.sentimentScore > 0.1
                  ? BT.text.green
                  : n.sentimentScore < -0.1
                    ? BT.text.red
                    : BT.text.amber;
              const inner = (
                <span style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 10, ...mono }}>
                  <span style={{ color: scoreColor, width: 32, flexShrink: 0 }}>
                    {n.sentimentScore === null ? '—' : formatScore(n.sentimentScore)}
                  </span>
                  <span style={{ color: BT.text.primary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.title}
                  </span>
                  <span style={{ color: BT.text.muted, fontSize: 9 }}>{n.source ?? ''}</span>
                </span>
              );
              return n.sourceUrl ? (
                <a key={n.id} href={n.sourceUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  {inner}
                </a>
              ) : (
                <div key={n.id}>{inner}</div>
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
  payload?: Array<{ name?: string; value?: number | null; color?: string; payload?: { newsCount?: number | null; macroRaw?: number | null } }>;
  topNews: SentimentTopNews[];
}

const SentimentTooltip: React.FC<RechartsTooltipProps> = ({ active, label, payload, topNews }) => {
  if (!active || !payload || payload.length === 0) return null;
  const ctx = payload[0]?.payload;

  return (
    <div style={{
      background: BT.bg.panel,
      border: `1px solid ${BT.border.muted}`,
      padding: '6px 8px',
      fontSize: 10,
      maxWidth: 260,
      ...mono,
    }}>
      <div style={{ color: BT.text.amber, fontWeight: 700, marginBottom: 4 }}>{label}</div>
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
      {topNews.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 4, borderTop: `1px solid ${BT.border.subtle}` }}>
          <div style={{ color: BT.text.muted, fontSize: 9, textTransform: 'uppercase', marginBottom: 2 }}>
            Top driver
          </div>
          <div style={{ color: BT.text.primary, fontSize: 9, lineHeight: 1.3 }}>
            {topNews[0].title}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketSentimentTrend;
