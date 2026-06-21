/**
 * Market Event Extraction Service
 *
 * Passes Atlanta CRE news article content to Claude (Anthropic) for structured
 * market_events extraction. Falls back to DeepSeek when AUTH_TOKEN /
 * ANTHROPIC_API_KEY is absent (e.g. in CI). Batch/pipeline job — cost is
 * absorbed by the platform per triggered_by='event' convention (no user credits).
 *
 * Deduplication: ON CONFLICT (event_name, effective_date, geography_id) DO NOTHING
 * — backed by idx_market_events_dedup unique index created in migration 014.
 */

import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { z } from 'zod';
import { query as dbQuery } from '../database/connection';
import { logger } from '../utils/logger';

const ANTHROPIC_API_KEY =
  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ??
  process.env.ANTHROPIC_API_KEY;

const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

/** Claude model for pipeline/batch extraction (haiku = fast + cost-efficient) */
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

// ── Valid market_events CHECK constraint values ──────────────────────────────

const VALID_EVENT_TYPES = [
  'employer_move', 'employer_expansion', 'employer_layoff', 'employer_closure',
  'transit_opening', 'transit_expansion', 'transit_planned',
  'supply_delivery', 'supply_announced', 'supply_groundbreaking',
  'grocery_opening', 'retail_opening', 'retail_closure',
  'infrastructure', 'rezoning', 'policy_change',
  'economic_shock', 'natural_disaster',
  'acquisition', 'disposition',
] as const;

const VALID_IMPACT_DIRECTIONS = ['positive', 'negative', 'neutral', 'mixed'] as const;
const VALID_IMPACT_MAGNITUDES = ['minor', 'moderate', 'major', 'transformative'] as const;
const VALID_STATUSES = ['rumored', 'announced', 'confirmed', 'active', 'completed', 'cancelled'] as const;

// ── Atlanta submarket → geography_id mapping ────────────────────────────────

const SUBMARKET_GEOGRAPHY_MAP: Record<string, string> = {
  'midtown':         'midtown',
  'buckhead':        'buckhead',
  'west end':        'west_end',
  'old fourth ward': 'old_fourth_ward',
  'o4w':             'old_fourth_ward',
  'downtown':        'downtown',
  'reynoldstown':    'reynoldstown',
  'vinings':         'vinings',
  'pittsburgh':      'pittsburgh',
  'north fulton':    'north_fulton',
  'alpharetta':      'north_fulton',
  'sandy springs':   'north_fulton',
};

// ── M35 event category mapping from market_events event_type ───────────────

const M35_CATEGORY_MAP: Record<string, string> = {
  'employer_move':         'MAJOR_EMPLOYER_ARRIVAL',
  'employer_expansion':    'MAJOR_EMPLOYER_ARRIVAL',
  'employer_layoff':       'MAJOR_EMPLOYER_DEPARTURE',
  'employer_closure':      'MAJOR_EMPLOYER_DEPARTURE',
  'supply_delivery':       'MAJOR_DEVELOPMENT_STARTED',
  'supply_announced':      'MAJOR_DEVELOPMENT_STARTED',
  'supply_groundbreaking': 'MAJOR_DEVELOPMENT_STARTED',
  'transit_opening':       'TRANSIT_INFRASTRUCTURE',
  'transit_expansion':     'TRANSIT_INFRASTRUCTURE',
  'transit_planned':       'TRANSIT_INFRASTRUCTURE',
  'infrastructure':        'TRANSIT_INFRASTRUCTURE',
  'rezoning':              'REGULATORY_CHANGE',
  'policy_change':         'REGULATORY_CHANGE',
  'economic_shock':        'NATURAL_DISASTER',
  'natural_disaster':      'NATURAL_DISASTER',
  'retail_opening':        'COMMERCIAL_DEVELOPMENT',
  'retail_closure':        'COMMERCIAL_DEVELOPMENT',
  'grocery_opening':       'COMMERCIAL_DEVELOPMENT',
  'acquisition':           'MARKET_TRANSACTION',
  'disposition':           'MARKET_TRANSACTION',
};

const M35_SCOPE_MAP: Record<string, string> = {
  'submarket': 'SUBMARKET',
  'msa':       'MSA',
  'city':      'MSA',
  'county':    'MSA',
};

const M35_MAGNITUDE_MAP: Record<string, number> = {
  'minor':         1,
  'moderate':      2,
  'major':         4,
  'transformative': 5,
};

const M35_MSA_MAP: Record<string, string> = {
  'atlanta': 'atlanta-sandy-springs-roswell-ga',
  'tampa':   'tampa-st-petersburg-clearwater-fl',
  'orlando': 'orlando-kissimmee-sanford-fl',
  'miami':   'miami-fort-lauderdale-west-palm-beach-fl',
  'jacksonville': 'jacksonville-fl',
  'dallas':  'dallas-fort-worth-arlington-tx',
};

// ── Zod schemas ──────────────────────────────────────────────────────────────

const ExtractedEventSchema = z.object({
  event_type: z.enum(VALID_EVENT_TYPES),
  event_name: z.string().min(3).max(200),
  event_description: z.string().max(1000).nullish(),
  geography_type: z.enum(['submarket', 'msa', 'city', 'county']).default('msa'),
  geography_id: z.string().max(100).default('atlanta'),
  geography_name: z.string().max(200).nullish(),
  entity_name: z.string().max(200).nullish(),
  entity_type: z.enum([
    'employer', 'developer', 'retailer', 'government', 'transit_agency', 'investor',
  ]).nullish(),
  jobs_affected: z.number().int().positive().nullish(),
  units_affected: z.number().int().positive().nullish(),
  investment_amount: z.number().positive().nullish(),
  /** ISO date string — YYYY-MM-DD */
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  announced_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  expected_impact_direction: z.enum(VALID_IMPACT_DIRECTIONS).default('positive'),
  expected_impact_magnitude: z.enum(VALID_IMPACT_MAGNITUDES).default('moderate'),
  status: z.enum(VALID_STATUSES).default('announced'),
  confidence_score: z.number().min(0).max(1).default(0.65),
  tags: z.array(z.string()).default([]),
});

const LLMResponseSchema = z.object({
  events: z.array(ExtractedEventSchema),
});

export type ExtractedEvent = z.infer<typeof ExtractedEventSchema>;

export interface ArticleInput {
  title: string;
  description?: string | null;
  content?: string | null;
  publishedAt?: Date | string | null;
  url?: string | null;
}

export interface ExtractionResult {
  inserted: number;
  skipped: number;
  events: Array<ExtractedEvent & { id?: string }>;
}

// ── LLM extraction prompt ─────────────────────────────────────────────────────

function buildPrompt(article: ArticleInput): string {
  const today = new Date().toISOString().slice(0, 10);
  const publishedDate = article.publishedAt
    ? new Date(article.publishedAt).toISOString().slice(0, 10)
    : today;

  const body = [
    article.title,
    article.description,
    article.content,
  ].filter(Boolean).join('\n\n');

  return `You are a CRE market intelligence analyst extracting structured events from Atlanta real estate news.

Article published: ${publishedDate}
Article text:
${body.slice(0, 3000)}

Extract any market events from this article that are relevant to Atlanta multifamily real estate. Only extract events that clearly happened in or near Atlanta, GA.

Return a JSON object with an "events" array. Each event must match this schema:
{
  "event_type": one of [${VALID_EVENT_TYPES.join(', ')}],
  "event_name": short descriptive name (max 200 chars),
  "event_description": 1-2 sentence description,
  "geography_type": "submarket" | "msa" | "city" | "county",
  "geography_id": submarket slug (midtown, buckhead, west_end, old_fourth_ward, downtown, reynoldstown, vinings, pittsburgh, north_fulton) or "atlanta" for MSA-wide events,
  "geography_name": human-readable name,
  "entity_name": company/organization name if applicable,
  "entity_type": "employer" | "developer" | "retailer" | "government" | "transit_agency" | "investor" (if applicable),
  "jobs_affected": integer (if mentioned),
  "units_affected": integer residential units (if supply event),
  "investment_amount": dollar amount in USD (if mentioned),
  "effective_date": "YYYY-MM-DD" — best estimate of when event takes/took effect,
  "announced_date": "YYYY-MM-DD" — when announced (often article date),
  "expected_impact_direction": "positive" | "negative" | "neutral" | "mixed",
  "expected_impact_magnitude": "minor" | "moderate" | "major" | "transformative",
  "status": "rumored" | "announced" | "confirmed" | "active" | "completed" | "cancelled",
  "confidence_score": 0.0-1.0 (your confidence this event materially impacts Atlanta multifamily),
  "tags": ["array", "of", "relevant", "tags"]
}

Rules:
- Only include events genuinely relevant to Atlanta MSA multifamily real estate
- Use today's date (${today}) as announced_date if article date is unclear
- For effective_date: use mentioned date, or article date + 6 months for future plans, or article date for completed events
- Prefer geography_id = "atlanta" (MSA) unless article clearly names a specific submarket
- Return {"events": []} if no relevant Atlanta multifamily events found
- Respond ONLY with valid JSON, no markdown, no prose`;
}

// ── LLM call helpers ─────────────────────────────────────────────────────────

/** Call Claude (primary). Returns raw JSON string or throws. */
async function callClaude(prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });
  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected Claude response type');
  return block.text;
}

/** Call DeepSeek (fallback). Returns raw JSON string or throws. */
async function callDeepSeek(prompt: string): Promise<string> {
  const resp = await axios.post(
    `${DEEPSEEK_BASE_URL.replace(/\/$/, '')}/chat/completions`,
    {
      model: 'deepseek-chat',
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a structured data extraction assistant. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    },
    {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    }
  );
  return resp.data?.choices?.[0]?.message?.content ?? '{}';
}

// ── Core extraction function ──────────────────────────────────────────────────

/**
 * Call Claude (primary) or DeepSeek (fallback) to extract structured market
 * events from one news article. Validates with Zod before returning candidates.
 * DB insertion is handled by insertExtractedEvents().
 */
export async function extractMarketEvents(
  article: ArticleInput
): Promise<ExtractedEvent[]> {
  const hasAnthropic = Boolean(ANTHROPIC_API_KEY);
  const hasDeepSeek  = Boolean(DEEPSEEK_API_KEY);

  if (!hasAnthropic && !hasDeepSeek) {
    logger.warn('[EventExtraction] No LLM API key configured — skipping extraction');
    return [];
  }

  const textLength = [article.title, article.description, article.content]
    .filter(Boolean).join('').length;

  if (textLength < 50) {
    return [];
  }

  const prompt = buildPrompt(article);
  let rawResponse: string;

  try {
    if (hasAnthropic) {
      rawResponse = await callClaude(prompt);
    } else {
      rawResponse = await callDeepSeek(prompt);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[EventExtraction] LLM API error', {
      provider: hasAnthropic ? 'claude' : 'deepseek',
      error: msg,
      title: article.title,
    });
    return [];
  }

  // Strip markdown code fences if LLM wrapped the JSON (DeepSeek sometimes does this
  // even when response_format: json_object is set)
  const cleaned = rawResponse
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    logger.warn('[EventExtraction] LLM returned non-JSON', {
      title: article.title,
      raw: rawResponse.slice(0, 200),
    });
    return [];
  }

  const validation = LLMResponseSchema.safeParse(parsed);
  if (!validation.success) {
    logger.warn('[EventExtraction] Zod validation failed', {
      title: article.title,
      issues: validation.error.issues.slice(0, 3),
    });
    return [];
  }

  return validation.data.events;
}

// ── Geography normalization helper ────────────────────────────────────────────

function resolveGeographyId(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return SUBMARKET_GEOGRAPHY_MAP[lower] ?? lower;
}

// ── DB insertion with deduplication ──────────────────────────────────────────

/**
 * Batch-insert extracted events into market_events.
 * ON CONFLICT (event_name, effective_date, geography_id) DO NOTHING.
 * Returns inserted count and skipped count.
 */
export async function insertExtractedEvents(
  events: ExtractedEvent[],
  sourceUrl?: string | null,
  sourceDate?: Date | null
): Promise<ExtractionResult> {
  let inserted = 0;
  let skipped = 0;
  const persisted: Array<ExtractedEvent & { id?: string }> = [];

  for (const evt of events) {
    const geoId = resolveGeographyId(evt.geography_id);

    // Task #371: low-confidence news-extracted events land as 'rumored' so
    // analysts must promote them before they reach proximity / backtest.
    // Threshold = 0.75. Higher-confidence rows keep the LLM-supplied status
    // (typically 'announced'). Manual / non-news inserts are unaffected.
    const effectiveStatus =
      evt.confidence_score < 0.75 ? 'rumored' : evt.status;

    try {
      const result = await dbQuery(`
        INSERT INTO market_events (
          event_type, event_name, event_description,
          geography_type, geography_id, geography_name,
          entity_name, entity_type,
          jobs_affected, units_affected, investment_amount,
          announced_date, effective_date,
          expected_impact_direction, expected_impact_magnitude,
          status, confidence_score,
          source_url, source_type, source_date,
          tags
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6,
          $7, $8,
          $9, $10, $11,
          $12, $13,
          $14, $15,
          $16, $17,
          $18, 'news', $19,
          $20
        )
        ON CONFLICT (event_name, effective_date, geography_id) DO NOTHING
        RETURNING id
      `, [
        evt.event_type,
        evt.event_name,
        evt.event_description ?? null,
        evt.geography_type,
        geoId,
        evt.geography_name ?? null,
        evt.entity_name ?? null,
        evt.entity_type ?? null,
        evt.jobs_affected ?? null,
        evt.units_affected ?? null,
        evt.investment_amount ?? null,
        evt.announced_date ?? null,
        evt.effective_date,
        evt.expected_impact_direction,
        evt.expected_impact_magnitude,
        effectiveStatus,
        evt.confidence_score,
        sourceUrl ?? null,
        sourceDate ?? null,
        evt.tags,
      ]);

      if (result.rows.length > 0) {
        inserted++;
        const persistedEvt = { ...evt, geography_id: geoId, status: effectiveStatus, id: result.rows[0].id };
        persisted.push(persistedEvt);
        logger.info('[EventExtraction] Inserted market event', {
          event_name: evt.event_name,
          event_type: evt.event_type,
          geography_id: geoId,
          effective_date: evt.effective_date,
        });

        // Ingest into Knowledge Graph (fire-and-forget)
        try {
          const { getKnowledgeGraph } = require('./neural-network/knowledge-graph.service');
          const { getPool } = require('../database/connection');
          const kg = getKnowledgeGraph(getPool());
          const nodeId = await kg.upsertNode({
            type: 'Event',
            externalId: result.rows[0].id,
            name: evt.event_name,
            properties: {
              eventType: evt.event_type,
              description: evt.event_description,
              entityName: evt.entity_name,
              entityType: evt.entity_type,
              jobsAffected: evt.jobs_affected,
              unitsAffected: evt.units_affected,
              investmentAmount: evt.investment_amount,
              effectiveDate: evt.effective_date,
              impactDirection: evt.expected_impact_direction,
              impactMagnitude: evt.expected_impact_magnitude,
              status: effectiveStatus,
              confidence: evt.confidence_score,
              sourceUrl: sourceUrl,
            }
          });
          // Link to market
          const marketNode = await kg.findNodeByExternalId('Market', geoId);
          if (marketNode) {
            await kg.createEdge({
              sourceNodeId: nodeId,
              targetNodeId: marketNode.id,
              edgeType: 'AFFECTS',
              properties: { impactType: evt.event_type, direction: evt.expected_impact_direction }
            });
          }
        } catch (graphErr) {
          // Non-fatal
        }
      } else {
        skipped++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[EventExtraction] DB insert error', {
        event_name: evt.event_name,
        error: msg,
      });
      skipped++;
    }
  }

  return { inserted, skipped, events: persisted };
}

// ── M35 draft event insertion ───────────────────────────────────────────────

/**
 * Insert extracted events into m35_draft_events for analyst review.
 * Maps market_events fields to M35 taxonomy (category, scope, magnitude_score).
 * Skips events that already exist (source_connector + source_record_id unique).
 *
 * This is the forward-sight pipeline: live news → NLP → M35 draft queue.
 */
export async function insertM35DraftEvents(
  events: ExtractedEvent[],
  sourceUrl?: string | null,
  sourceDate?: Date | null,
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const evt of events) {
    const m35Category = M35_CATEGORY_MAP[evt.event_type] ?? 'MAJOR_DEVELOPMENT_STARTED';
    const m35Scope = M35_SCOPE_MAP[evt.geography_type] ?? 'MSA';
    const m35Magnitude = M35_MAGNITUDE_MAP[evt.expected_impact_magnitude] ?? 2;
    const m35MsaId = M35_MSA_MAP[resolveGeographyId(evt.geography_id)] ??
                     resolveGeographyId(evt.geography_id);
    const submarketHint = evt.geography_type === 'submarket'
      ? resolveGeographyId(evt.geography_id)
      : undefined;

    // Build a source_record_id from article URL + event name hash
    const sourceRecordId = `${evt.event_name.slice(0, 60)}|${evt.effective_date}`;

    try {
      const result = await dbQuery(`
        INSERT INTO m35_draft_events (
          source_connector, source_record_id, msa_id, submarket_hint,
          category, scope, name, description, signal_date,
          est_materialization, estimated_magnitude, confidence,
          source_url, raw_payload
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
        ON CONFLICT (source_connector, source_record_id) DO NOTHING
        RETURNING id
      `, [
        'news_nlp',
        sourceRecordId,
        m35MsaId,
        submarketHint ?? null,
        m35Category,
        m35Scope,
        evt.event_name,
        evt.event_description ?? evt.event_name,
        evt.announced_date ?? evt.effective_date,
        evt.effective_date,
        m35Magnitude,
        evt.confidence_score,
        sourceUrl ?? null,
        JSON.stringify({
          event_type: evt.event_type,
          impact_direction: evt.expected_impact_direction,
          impact_magnitude: evt.expected_impact_magnitude,
          jobs_affected: evt.jobs_affected,
          units_affected: evt.units_affected,
          investment_amount: evt.investment_amount,
          geography_type: evt.geography_type,
          geography_id: evt.geography_id,
          entity_name: evt.entity_name,
          entity_type: evt.entity_type,
          tags: evt.tags,
        }),
      ]);

      if (result.rows.length > 0) {
        inserted++;
        logger.info('[EventExtraction] Inserted M35 draft event', {
          event_name: evt.event_name,
          category: m35Category,
          msa_id: m35MsaId,
        });
      } else {
        skipped++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[EventExtraction] M35 draft insert error', {
        event_name: evt.event_name,
        error: msg,
      });
      skipped++;
    }
  }

  return { inserted, skipped };
}

/**
 * Full pipeline: extract from article + insert to DB (both market_events and m35_draft_events).
 * Intended for fire-and-forget use inside news ingestion.
 *
 * @param article     Article content to extract events from.
 * @param articleId   Optional UUID of the news_article_cache row. When provided,
 *                    `extracted_at` is stamped on that row after the LLM call
 *                    completes (regardless of whether any events were found),
 *                    so the backfill and nightly cron never re-pay for the same call.
 */
export async function extractAndPersistEvents(
  article: ArticleInput,
  articleId?: string
): Promise<ExtractionResult & { m35Inserted: number; m35Skipped: number }> {
  const candidates = await extractMarketEvents(article);

  const sourceDate = article.publishedAt ? new Date(article.publishedAt) : null;
  const result = candidates.length === 0
    ? { inserted: 0, skipped: 0, events: [] }
    : await insertExtractedEvents(candidates, article.url, sourceDate);

  // Parallel: also insert into M35 draft queue
  let m35Result = { inserted: 0, skipped: 0 };
  if (candidates.length > 0) {
    try {
      m35Result = await insertM35DraftEvents(candidates, article.url, sourceDate);
    } catch (m35Err: unknown) {
      const msg = m35Err instanceof Error ? m35Err.message : String(m35Err);
      logger.warn('[EventExtraction] M35 draft insert failed (non-fatal)', { error: msg });
    }
  }

  // Stamp extracted_at so this article is never re-sent to the LLM.
  // Fire-and-forget — a stamp failure must never surface to the caller.
  if (articleId) {
    dbQuery(
      `UPDATE news_article_cache SET extracted_at = NOW() WHERE id = $1`,
      [articleId]
    ).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('[EventExtraction] Failed to stamp extracted_at', { articleId, error: msg });
    });
  }

  return {
    ...result,
    m35Inserted: m35Result.inserted,
    m35Skipped: m35Result.skipped,
  };
}
