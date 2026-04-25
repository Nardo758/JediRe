/**
 * Sentiment History Service (Task #382)
 *
 * Persists and retrieves the per-entity sentiment time series surfaced on the
 * MSA + Submarket COMMENTARY tabs. Reads from existing data sources only:
 *
 *   - market_commentary       (Commentary Agent marketNarrative.sentiment)
 *   - news_items              (sentiment_score / sentiment_label, when present)
 *   - m28_rate_environment    (consumer_sentiment, UMCSI)
 *
 * No fabrication, no new NLP. If the news_items table has not yet been
 * upgraded with sentiment columns, news_30d_avg comes back NULL and the chart
 * draws only the macro + agent series — surfaced explicitly to the operator.
 */

import { query, getPool } from '../database/connection';
import { logger } from '../utils/logger';
import {
  resolveMsa,
  resolveSubmarket,
  canonicalMsaKey,
  canonicalSubmarketKey,
  type MsaResolution,
  type SubmarketResolution,
} from '../api/rest/_market-resolution';

export type AgentSentimentLabel = 'bullish' | 'neutral' | 'bearish';
export type SentimentSource = 'agent_run' | 'cron_snapshot' | 'backfill';

export interface SentimentSnapshotInput {
  entityType: 'msa' | 'submarket';
  entityId: string;
  agentScore: -1 | 0 | 1 | null;
  source: SentimentSource;
  topDriverNewsIds?: string[];
}

export interface NewsScope {
  primaryTokens: string[];
  geographyTokens: string[];
}

export interface SentimentTrendPoint {
  snapshotAt: string;
  agentScore: number | null;
  newsAvg30d: number | null;
  newsCount30d: number | null;
  macroConsumerSentiment: number | null;
  source: SentimentSource;
  topDriverNewsIds: string[];
}

export interface SentimentTopNews {
  id: string;
  title: string;
  source: string | null;
  publishedAt: string | null;
  sentimentScore: number | null;
  sentimentLabel: string | null;
  sourceUrl: string | null;
}

export interface SentimentAnomaly {
  snapshotAt: string;
  blendedFrom: number | null;
  blendedTo: number | null;
  magnitude: number;
  zScore: number | null;
  direction: 'up' | 'down';
  topDriverNewsIds: string[];
}

export interface SentimentTrendResult {
  entityType: 'msa' | 'submarket';
  entityId: string;
  windowMonths: number;
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
}

export const labelToScore = (label: AgentSentimentLabel): -1 | 0 | 1 =>
  label === 'bullish' ? 1 : label === 'bearish' ? -1 : 0;

let newsSentimentColumnsAvailableCache: boolean | null = null;

/**
 * Probe news_items for sentiment columns once per process. Older deployments
 * lack sentiment_score / sentiment_label; in that case news series stay NULL.
 */
async function newsSentimentColumnsAvailable(): Promise<boolean> {
  if (newsSentimentColumnsAvailableCache !== null) return newsSentimentColumnsAvailableCache;
  try {
    const r = await query(
      `SELECT
         COUNT(*) FILTER (WHERE column_name = 'sentiment_score') AS has_score,
         COUNT(*) FILTER (WHERE column_name = 'sentiment_label') AS has_label
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'news_items'`,
    );
    const row = r.rows[0] as { has_score: string; has_label: string } | undefined;
    const ok = !!row && Number(row.has_score) > 0 && Number(row.has_label) > 0;
    newsSentimentColumnsAvailableCache = ok;
    return ok;
  } catch (err) {
    logger.warn('sentiment-history: failed to probe news_items columns', { err });
    newsSentimentColumnsAvailableCache = false;
    return false;
  }
}

/**
 * Compute a 30-day rolling news-sentiment average for the entity.
 *
 * Scoping requires BOTH a primary token (entity name slug / city tokens)
 * AND a geography disambiguator (state code or parent-MSA city) so that
 * generic submarket names like "midtown" or "downtown" do not pull
 * cross-market articles. If no geography disambiguator is available we
 * refuse to scope and return NULL — better to draw nothing than draw a
 * misleading line.
 */
async function computeNews30dAvg(
  scope: NewsScope,
): Promise<{ avg: number | null; count: number | null; topIds: string[] }> {
  if (scope.primaryTokens.length === 0) return { avg: null, count: null, topIds: [] };
  if (scope.geographyTokens.length === 0) return { avg: null, count: null, topIds: [] };
  if (!(await newsSentimentColumnsAvailable())) return { avg: null, count: null, topIds: [] };

  try {
    const r = await query(
      `SELECT
         AVG(sentiment_score)::numeric(5,3) AS avg_score,
         COUNT(*)::int                       AS cnt,
         ARRAY(
           SELECT id::text FROM news_items
            WHERE published_at >= NOW() - INTERVAL '30 days'
              AND sentiment_score IS NOT NULL
              AND tags ?| $1::text[]
              AND tags ?| $2::text[]
            ORDER BY ABS(sentiment_score) DESC NULLS LAST, published_at DESC
            LIMIT 5
         ) AS top_ids
       FROM news_items
       WHERE published_at >= NOW() - INTERVAL '30 days'
         AND sentiment_score IS NOT NULL
         AND tags ?| $1::text[]
         AND tags ?| $2::text[]`,
      [scope.primaryTokens, scope.geographyTokens],
    );
    const row = r.rows[0] as { avg_score: string | null; cnt: number | null; top_ids: string[] | null } | undefined;
    if (!row || row.cnt === null || row.cnt === 0) return { avg: null, count: 0, topIds: [] };
    return {
      avg: row.avg_score === null ? null : Number(row.avg_score),
      count: Number(row.cnt),
      topIds: row.top_ids ?? [],
    };
  } catch (err) {
    logger.warn('sentiment-history: news 30d average failed', { err });
    return { avg: null, count: null, topIds: [] };
  }
}

/**
 * Build the news-scope token set for a resolved entity. Returns null when we
 * cannot construct a geography disambiguator (which forces NULL news series
 * rather than fabricating cross-market noise).
 */
async function buildNewsScopeForMsa(resolved: MsaResolution): Promise<NewsScope> {
  const slug = resolved.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const tokens = resolved.name.split(/[,\-]/).map(s => s.trim().toLowerCase()).filter(Boolean);
  return {
    primaryTokens: Array.from(new Set([slug, resolved.primaryCity.toLowerCase(), ...tokens])),
    geographyTokens: resolved.stateCodes.map(s => s.toLowerCase()),
  };
}

async function buildNewsScopeForSubmarket(
  resolved: SubmarketResolution,
  parentMsa: MsaResolution | null,
): Promise<NewsScope> {
  const slug = resolved.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const primary = [slug, resolved.name.toLowerCase()];
  const geography: string[] = [];
  if (resolved.state) geography.push(resolved.state.toLowerCase());
  if (resolved.municipality) geography.push(resolved.municipality.toLowerCase());
  if (parentMsa) {
    geography.push(parentMsa.primaryCity.toLowerCase());
    for (const sc of parentMsa.stateCodes) geography.push(sc.toLowerCase());
  }
  return {
    primaryTokens: Array.from(new Set(primary.filter(Boolean))),
    geographyTokens: Array.from(new Set(geography.filter(Boolean))),
  };
}

async function latestMacroConsumerSentiment(): Promise<number | null> {
  try {
    const r = await query(
      `SELECT consumer_sentiment
         FROM m28_rate_environment
        WHERE consumer_sentiment IS NOT NULL
        ORDER BY snapshot_date DESC
        LIMIT 1`,
    );
    const row = r.rows[0] as { consumer_sentiment: string | null } | undefined;
    if (!row || row.consumer_sentiment === null) return null;
    return Number(row.consumer_sentiment);
  } catch (err) {
    logger.warn('sentiment-history: macro consumer sentiment lookup failed', { err });
    return null;
  }
}

/**
 * Resolve the entity once and return both the canonical storage key and the
 * news scope used for that entity. Called by every read/write path so the
 * `(entity_type, entity_id)` row key is consistent regardless of whether the
 * caller passed a numeric PK, a CBSA code, a UUID, or a slug.
 */
async function resolveEntityForStorage(
  entityType: 'msa' | 'submarket',
  rawEntityId: string,
): Promise<{ canonicalId: string; resolvedName: string | null; newsScope: NewsScope | null }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (entityType === 'msa') {
      const msa = await resolveMsa(client, rawEntityId);
      return {
        canonicalId: canonicalMsaKey(msa, rawEntityId),
        resolvedName: msa?.name ?? null,
        newsScope: msa ? await buildNewsScopeForMsa(msa) : null,
      };
    }
    const sub = await resolveSubmarket(client, rawEntityId, null);
    let parentMsa: MsaResolution | null = null;
    if (sub && sub.source === 'submarket') {
      const r = await client.query(
        `SELECT m.id::text AS msa_id_text FROM submarkets s JOIN msas m ON m.id = s.msa_id WHERE s.id = $1 LIMIT 1`,
        [Number(sub.id)],
      );
      if (r.rows.length > 0) {
        parentMsa = await resolveMsa(client, String(r.rows[0].msa_id_text));
      }
    }
    return {
      canonicalId: canonicalSubmarketKey(sub, rawEntityId),
      resolvedName: sub?.name ?? null,
      newsScope: sub ? await buildNewsScopeForSubmarket(sub, parentMsa) : null,
    };
  } finally {
    client.release();
  }
}

/**
 * Persist one sentiment observation. Called from:
 *   - CommentaryAgent.cacheCommentary  (source = 'agent_run', agentScore set)
 *   - daily Inngest cron               (source = 'cron_snapshot', agentScore = null
 *                                        unless we successfully read the latest
 *                                        market_commentary marketNarrative)
 *
 * Returns the outcome so callers (esp. the cron) can report accurate counts
 * instead of treating swallowed errors as successes.
 */
export interface SnapshotOutcome {
  ok: boolean;
  canonicalId: string;
  error?: string;
}

export async function recordSentimentSnapshot(
  input: SentimentSnapshotInput,
): Promise<SnapshotOutcome> {
  let canonicalId = `${input.entityType}:${input.entityId.toLowerCase()}`;
  try {
    const resolved = await resolveEntityForStorage(input.entityType, input.entityId);
    canonicalId = resolved.canonicalId;

    const news = resolved.newsScope
      ? await computeNews30dAvg(resolved.newsScope)
      : { avg: null, count: null, topIds: [] };
    const macro = await latestMacroConsumerSentiment();

    const topIds = (input.topDriverNewsIds && input.topDriverNewsIds.length > 0)
      ? input.topDriverNewsIds
      : news.topIds;

    await query(
      `INSERT INTO market_sentiment_history
         (entity_type, entity_id, agent_score, news_30d_avg, news_count_30d,
          macro_consumer_sentiment, top_driver_news_ids, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        input.entityType,
        canonicalId,
        input.agentScore,
        news.avg,
        news.count,
        macro,
        JSON.stringify(topIds),
        input.source,
      ],
    );
    return { ok: true, canonicalId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('sentiment-history: failed to record snapshot', {
      err: msg,
      entityType: input.entityType,
      entityId: input.entityId,
      canonicalId,
      source: input.source,
    });
    return { ok: false, canonicalId, error: msg };
  }
}

interface SentimentRow {
  snapshot_at: Date;
  agent_score: number | null;
  news_30d_avg: string | null;
  news_count_30d: number | null;
  macro_consumer_sentiment: string | null;
  top_driver_news_ids: string[] | null;
  source: SentimentSource;
}

/**
 * Blend the three sub-series into a single normalized score in [-1, 1].
 * Weights:
 *   agent  — 0.50 (direct expert read on the entity)
 *   news   — 0.30 (broad market chatter, rolling 30d)
 *   macro  — 0.20 (top-down consumer sentiment, normalized 50→0, 100→+1, 0→-1)
 * Components that are NULL are skipped and remaining weights renormalized.
 */
function blendScore(
  agent: number | null,
  newsAvg: number | null,
  macro: number | null,
): number | null {
  const parts: { value: number; weight: number }[] = [];
  if (agent !== null) parts.push({ value: agent, weight: 0.5 });
  if (newsAvg !== null) parts.push({ value: newsAvg, weight: 0.3 });
  if (macro !== null) {
    const normalized = Math.max(-1, Math.min(1, (macro - 50) / 50));
    parts.push({ value: normalized, weight: 0.2 });
  }
  if (parts.length === 0) return null;
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const weighted = parts.reduce((s, p) => s + p.value * p.weight, 0);
  return totalWeight === 0 ? null : Number((weighted / totalWeight).toFixed(3));
}

export async function getSentimentTrend(
  entityType: 'msa' | 'submarket',
  entityId: string,
  windowMonths: number,
): Promise<SentimentTrendResult & { canonicalEntityId: string; resolvedEntityName: string | null }> {
  const resolved = await resolveEntityForStorage(entityType, entityId);
  const canonicalId = resolved.canonicalId;

  const r = await query(
    `SELECT snapshot_at, agent_score, news_30d_avg, news_count_30d,
            macro_consumer_sentiment, top_driver_news_ids, source
       FROM market_sentiment_history
      WHERE entity_type = $1 AND entity_id = $2
        AND snapshot_at >= NOW() - ($3::int * INTERVAL '1 month')
      ORDER BY snapshot_at ASC`,
    [entityType, canonicalId, windowMonths],
  );

  const rows = r.rows as unknown as SentimentRow[];
  const points: SentimentTrendPoint[] = rows.map(row => ({
    snapshotAt: row.snapshot_at instanceof Date ? row.snapshot_at.toISOString() : String(row.snapshot_at),
    agentScore: row.agent_score === null ? null : Number(row.agent_score),
    newsAvg30d: row.news_30d_avg === null ? null : Number(row.news_30d_avg),
    newsCount30d: row.news_count_30d === null ? null : Number(row.news_count_30d),
    macroConsumerSentiment: row.macro_consumer_sentiment === null ? null : Number(row.macro_consumer_sentiment),
    source: row.source,
    topDriverNewsIds: Array.isArray(row.top_driver_news_ids) ? row.top_driver_news_ids : [],
  }));

  const newsAvailable = points.some(p => p.newsAvg30d !== null);

  const last = points[points.length - 1] ?? null;
  const currentBlended = last
    ? blendScore(last.agentScore, last.newsAvg30d, last.macroConsumerSentiment)
    : null;

  const findClosest = (targetMs: number): SentimentTrendPoint | null => {
    if (points.length === 0) return null;
    let best: SentimentTrendPoint | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const p of points) {
      const t = new Date(p.snapshotAt).getTime();
      const diff = Math.abs(t - targetMs);
      if (diff < bestDiff) {
        best = p;
        bestDiff = diff;
      }
    }
    return best;
  };

  const nowMs = Date.now();
  const point30d = findClosest(nowMs - 30 * 24 * 60 * 60 * 1000);
  const point12mo = findClosest(nowMs - 365 * 24 * 60 * 60 * 1000);

  const buildDelta = (
    ref: SentimentTrendPoint | null,
  ): { agentScoreDelta: number | null; newsAvg30dDelta: number | null; blendedDelta: number | null } => {
    if (!last || !ref || ref === last) {
      return { agentScoreDelta: null, newsAvg30dDelta: null, blendedDelta: null };
    }
    const refBlended = blendScore(ref.agentScore, ref.newsAvg30d, ref.macroConsumerSentiment);
    return {
      agentScoreDelta: last.agentScore !== null && ref.agentScore !== null
        ? Number((last.agentScore - ref.agentScore).toFixed(3))
        : null,
      newsAvg30dDelta: last.newsAvg30d !== null && ref.newsAvg30d !== null
        ? Number((last.newsAvg30d - ref.newsAvg30d).toFixed(3))
        : null,
      blendedDelta: currentBlended !== null && refBlended !== null
        ? Number((currentBlended - refBlended).toFixed(3))
        : null,
    };
  };

  // ----- Anomaly detection -----
  // Compute the blended series, then point-to-point deltas, then z-score the
  // deltas. A point is flagged as anomalous when |delta| >= 0.25 OR
  // |z| >= 1.5. The combined rule keeps small markets (low variance ⇒ huge z
  // for small moves) AND large markets (high variance ⇒ small z for big
  // absolute moves) both honest.
  const blendedSeries: Array<{ value: number | null; point: SentimentTrendPoint }> = points.map(p => ({
    value: blendScore(p.agentScore, p.newsAvg30d, p.macroConsumerSentiment),
    point: p,
  }));
  const deltas: Array<{ from: number; to: number; delta: number; idx: number }> = [];
  for (let i = 1; i < blendedSeries.length; i++) {
    const prev = blendedSeries[i - 1].value;
    const curr = blendedSeries[i].value;
    if (prev !== null && curr !== null) {
      deltas.push({ from: prev, to: curr, delta: curr - prev, idx: i });
    }
  }
  const meanDelta = deltas.length > 0 ? deltas.reduce((s, d) => s + d.delta, 0) / deltas.length : 0;
  const variance = deltas.length > 1
    ? deltas.reduce((s, d) => s + (d.delta - meanDelta) ** 2, 0) / (deltas.length - 1)
    : 0;
  const stdDev = Math.sqrt(variance);

  const anomalies: SentimentAnomaly[] = deltas
    .map(d => {
      const z = stdDev > 1e-6 ? (d.delta - meanDelta) / stdDev : null;
      return { d, z };
    })
    .filter(({ d, z }) => Math.abs(d.delta) >= 0.25 || (z !== null && Math.abs(z) >= 1.5))
    .map(({ d, z }) => {
      const point = blendedSeries[d.idx].point;
      return {
        snapshotAt: point.snapshotAt,
        blendedFrom: Number(d.from.toFixed(3)),
        blendedTo: Number(d.to.toFixed(3)),
        magnitude: Number(d.delta.toFixed(3)),
        zScore: z === null ? null : Number(z.toFixed(2)),
        direction: d.delta >= 0 ? 'up' as const : 'down' as const,
        topDriverNewsIds: point.topDriverNewsIds,
      };
    });

  // ----- News lookup map -----
  // Collect every news id referenced anywhere in the window (per-point top
  // drivers) so the frontend tooltip can resolve news for the HOVERED point
  // — not just the latest one.
  const allNewsIds = new Set<string>();
  for (const p of points) {
    for (const id of p.topDriverNewsIds) allNewsIds.add(id);
  }
  const newsList = allNewsIds.size > 0 ? await fetchTopDriverNews(Array.from(allNewsIds)) : [];
  const newsLookup: Record<string, SentimentTopNews> = {};
  for (const n of newsList) newsLookup[n.id] = n;

  const topDriverIds = last?.topDriverNewsIds ?? [];
  const topDriverNews = topDriverIds.map(id => newsLookup[id]).filter((n): n is SentimentTopNews => !!n);

  return {
    entityType,
    entityId,
    windowMonths,
    points,
    newsAvailable,
    current: {
      agentScore: last?.agentScore ?? null,
      newsAvg30d: last?.newsAvg30d ?? null,
      macroConsumerSentiment: last?.macroConsumerSentiment ?? null,
      blended: currentBlended,
    },
    vs30d: buildDelta(point30d),
    vs12mo: buildDelta(point12mo),
    topDriverNews,
    newsLookup,
    anomalies,
    canonicalEntityId: canonicalId,
    resolvedEntityName: resolved.resolvedName,
  };
}

async function fetchTopDriverNews(ids: string[]): Promise<SentimentTopNews[]> {
  if (ids.length === 0) return [];
  try {
    const cols = await query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'news_items'`,
    );
    const colSet = new Set(cols.rows.map(r => String(r.column_name)));
    const scoreSelect = colSet.has('sentiment_score') ? 'sentiment_score' : 'NULL::numeric AS sentiment_score';
    const labelSelect = colSet.has('sentiment_label') ? 'sentiment_label' : 'NULL::text AS sentiment_label';

    const r = await query(
      `SELECT id::text AS id, title, source_name, source_url, published_at,
              ${scoreSelect}, ${labelSelect}
         FROM news_items
        WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    return r.rows.map(row => ({
      id: String(row.id),
      title: String(row.title ?? ''),
      source: row.source_name ? String(row.source_name) : null,
      sourceUrl: row.source_url ? String(row.source_url) : null,
      publishedAt: row.published_at instanceof Date ? row.published_at.toISOString() : (row.published_at ? String(row.published_at) : null),
      sentimentScore: row.sentiment_score === null || row.sentiment_score === undefined ? null : Number(row.sentiment_score),
      sentimentLabel: row.sentiment_label ? String(row.sentiment_label) : null,
    }));
  } catch (err) {
    logger.warn('sentiment-history: failed to fetch top driver news', { err });
    return [];
  }
}

/**
 * Iterate every MSA + submarket that has a *commentary-tab* market_commentary
 * row and write a cron snapshot for each distinct entity. Designed to be
 * called from the daily Inngest cron.
 *
 *   - tab_context filter avoids double-counting entities that appear in
 *     multiple commentary tabs.
 *   - DISTINCT on (entity_type, entity_id) is a final safety net.
 *   - The `written` counter only ticks when recordSentimentSnapshot returns
 *     ok=true, so failures are never silently treated as successes.
 */
export async function snapshotAllActiveEntities(): Promise<{
  written: number;
  failed: number;
  byType: { msa: number; submarket: number };
}> {
  let written = 0;
  let failed = 0;
  const byType = { msa: 0, submarket: 0 };

  try {
    const r = await query(
      `SELECT DISTINCT ON (entity_type, entity_id)
              entity_type, entity_id, commentary
         FROM market_commentary
        WHERE entity_type IN ('msa','submarket')
          AND (tab_context = 'commentary' OR tab_context IS NULL)
        ORDER BY entity_type, entity_id, generated_at DESC`,
    );

    for (const row of r.rows) {
      const entityType = String(row.entity_type) as 'msa' | 'submarket';
      const entityId = String(row.entity_id);

      // Per-row guard: a single malformed commentary blob must NOT abort the
      // whole batch. We isolate parsing + sentiment extraction here and treat
      // failures as "agent score unavailable" rather than fatal.
      let agentScore: -1 | 0 | 1 | null = null;
      try {
        const commentary = typeof row.commentary === 'string'
          ? JSON.parse(row.commentary)
          : row.commentary;
        const narrative = commentary?.marketNarrative as
          | { sentiment?: unknown }
          | undefined;
        const raw = narrative?.sentiment;
        if (raw === 'bullish' || raw === 'neutral' || raw === 'bearish') {
          agentScore = labelToScore(raw);
        }
      } catch (parseErr) {
        logger.warn('sentiment-history: malformed commentary row, snapshotting without agent score', {
          err: parseErr instanceof Error ? parseErr.message : String(parseErr),
          entityType,
          entityId,
        });
      }

      const outcome = await recordSentimentSnapshot({
        entityType,
        entityId,
        agentScore,
        source: 'cron_snapshot',
      });
      if (outcome.ok) {
        written += 1;
        byType[entityType] += 1;
      } else {
        failed += 1;
      }
    }
  } catch (err) {
    logger.error('sentiment-history: cron snapshot iteration failed', { err });
    throw err;
  }

  return { written, failed, byType };
}
