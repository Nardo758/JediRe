#!/usr/bin/env ts-node
/**
 * Phase 8 NLP Review Backfill Script
 *
 * Runs a DeepSeek NLP pass over every review staged in property_descriptions.reviews
 * pending_web layer that still has empty named_entities / hazard_mentions / amenity_mentions.
 *
 * Extraction rules (strict):
 *   - named_entities  : proper nouns literally mentioned (people, places, products, brands)
 *   - hazard_mentions : negative physical/safety issues literally described (noise, pests, etc.)
 *   - amenity_mentions: specific amenity features literally mentioned (pool, gym, dog park, etc.)
 *
 * ONLY extract what is literally written. No synthesis, no inference.
 *
 * Usage:
 *   cd backend && npx ts-node --transpile-only src/scripts/nlp-review-backfill.ts
 *
 * Flags (both space-separated and = are accepted):
 *   --dry-run           Print what would be sent; no API calls, no DB writes
 *   --limit N           Process at most N reviews total (default: all)
 *   --concurrency N     Parallel DeepSeek calls (default: 5)
 *
 * Rate: capped at 10 reviews/second (sliding-window limiter), independent of concurrency.
 * Cost: ~$0.17 for all 1,350 reviews using deepseek-chat.
 * All calls use triggered_by: 'cron' — cost is platform-absorbed, not charged to any user.
 */

import { Pool } from 'pg';
import { deepseekAdapter } from '../agents/runtime/DeepSeekMeteringAdapter';

// ── CLI flags ─────────────────────────────────────────────────────────────────

/**
 * Parses a named flag that carries a value.
 * Accepts both:
 *   --flag=value   (equals-separated)
 *   --flag value   (space-separated — looks at the element immediately after the flag)
 */
function parseFlag(flag: string, defaultVal: string | null = null): string | null {
  const args = process.argv;
  for (let i = 0; i < args.length; i++) {
    // --flag=value form
    if (args[i].startsWith(`--${flag}=`)) {
      return args[i].split('=')[1] ?? defaultVal;
    }
    // --flag value form (space-separated)
    if (args[i] === `--${flag}` && i + 1 < args.length && !args[i + 1].startsWith('--')) {
      return args[i + 1];
    }
  }
  return defaultVal;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(`--${flag}`);
}

const DRY_RUN = hasFlag('dry-run');
const LIMIT = parseInt(parseFlag('limit', '0') ?? '0', 10);
const CONCURRENCY = parseInt(parseFlag('concurrency', '5') ?? '5', 10);
const MAX_RPS = 10; // hard cap: 10 reviews/second regardless of concurrency

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReviewObject {
  text: string;
  author: string;
  rating: number;
  publishTime: string;
  named_entities: string[];
  hazard_mentions: string[];
  sentiment_score: number;
  amenity_mentions: string[];
}

interface PendingWebLayer {
  ts: string;
  value: ReviewObject[];
  source: string;
}

interface NlpResult {
  named_entities: string[];
  hazard_mentions: string[];
  amenity_mentions: string[];
}

// ── Rate limiter — sliding-window 10 RPS ─────────────────────────────────────
// Tracks timestamps of the last MAX_RPS calls within a 1-second window.
// If the window is full, waits until the oldest timestamp is > 1000ms ago.

const callTimestamps: number[] = [];

async function rateLimitAcquire(): Promise<void> {
  while (true) {
    const now = Date.now();
    // Evict timestamps older than 1 second
    while (callTimestamps.length > 0 && callTimestamps[0] < now - 1000) {
      callTimestamps.shift();
    }
    if (callTimestamps.length < MAX_RPS) {
      callTimestamps.push(now);
      return;
    }
    // Window full — wait until the oldest slot expires
    const waitMs = 1000 - (now - callTimestamps[0]);
    await new Promise(res => setTimeout(res, Math.max(1, waitMs)));
  }
}

// ── NLP prompt ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a literal extraction tool for apartment review text.

Your job: extract three lists from a resident review.

Rules (STRICT):
1. named_entities: Proper nouns literally mentioned — staff names, specific place names, brand names. 
   Example: "Erin" from "Erin was helpful", "Braves" from "Braves game traffic".
   Do NOT include: the property name itself, generic words, anything not explicitly named.

2. hazard_mentions: Negative physical or safety issues explicitly described.
   Example: "loud parking lot at night", "dog poop in dog park", "spider webs in trash area".
   Do NOT include: management complaints, price complaints, vague dissatisfaction.
   Only include if a specific physical hazard or safety condition is literally described.

3. amenity_mentions: Specific amenity features explicitly mentioned.
   Example: "pool", "dog park", "gym", "business center".
   Do NOT include: general praise words like "amenities are great" with no specifics.

CRITICAL: If something is not literally written in the review text, do not include it.
No inference. No synthesis. Empty arrays are correct when nothing qualifies.

Respond with JSON only:
{"named_entities": [], "hazard_mentions": [], "amenity_mentions": []}`;

// ── DeepSeek call ─────────────────────────────────────────────────────────────

async function extractNlp(reviewText: string, runId: string): Promise<NlpResult> {
  await rateLimitAcquire();

  const resp = await deepseekAdapter.createMessage({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Extract from this review:\n\n${reviewText}` },
    ],
    max_tokens: 256,
    temperature: 0,
    response_format: { type: 'json_object' },
    metadata: {
      triggered_by: 'cron',
      actor_id: 'nlp-review-backfill',
      agent_run_id: runId,
    },
  });

  try {
    const parsed = JSON.parse(resp.text) as Partial<NlpResult>;
    return {
      named_entities: Array.isArray(parsed.named_entities) ? parsed.named_entities.map(String) : [],
      hazard_mentions: Array.isArray(parsed.hazard_mentions) ? parsed.hazard_mentions.map(String) : [],
      amenity_mentions: Array.isArray(parsed.amenity_mentions) ? parsed.amenity_mentions.map(String) : [],
    };
  } catch {
    console.warn(`  [nlp] JSON parse failed (runId=${runId}) — defaulting to empty arrays`);
    return { named_entities: [], hazard_mentions: [], amenity_mentions: [] };
  }
}

// ── Per-review indexed DB write using jsonb_set ───────────────────────────────
// Uses jsonb_set with the literal array index baked into the path so only
// the three NLP fields at position <reviewIdx> are touched — no other reviews
// or other fields (ts, source, rating, etc.) are overwritten.
// reviewIdx is a TypeScript integer (not user input) — safe to interpolate.

async function writeNlpToReview(
  pool: Pool,
  parcelId: string,
  reviewIdx: number,
  nlp: NlpResult,
): Promise<void> {
  const idx = String(reviewIdx); // numeric string for jsonb_set path
  await pool.query(
    `UPDATE property_descriptions
     SET reviews = jsonb_set(
       jsonb_set(
         jsonb_set(
           reviews,
           '{layers,pending_web,value,${idx},named_entities}',
           $2::jsonb,
           true
         ),
         '{layers,pending_web,value,${idx},hazard_mentions}',
         $3::jsonb,
         true
       ),
       '{layers,pending_web,value,${idx},amenity_mentions}',
       $4::jsonb,
       true
     ),
     updated_at = NOW()
     WHERE parcel_id = $1`,
    [
      parcelId,
      JSON.stringify(nlp.named_entities),
      JSON.stringify(nlp.hazard_mentions),
      JSON.stringify(nlp.amenity_mentions),
    ],
  );
}

// ── p-limit helper ────────────────────────────────────────────────────────────

async function pLimit<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  console.log(`\n[nlp-review-backfill] Starting NLP review backfill`);
  console.log(`  dry-run: ${DRY_RUN}, limit: ${LIMIT || 'all'}, concurrency: ${CONCURRENCY}, max-rps: ${MAX_RPS}`);

  // Fetch all rows with reviews in pending_web
  const { rows } = await pool.query<{ parcel_id: string; reviews_json: string }>(`
    SELECT parcel_id, (reviews->'layers'->'pending_web')::text AS reviews_json
    FROM property_descriptions
    WHERE reviews->'layers'->'pending_web'->'value' IS NOT NULL
    ORDER BY parcel_id
  `);

  console.log(`\n[nlp-review-backfill] Found ${rows.length} properties with pending_web reviews`);

  // Flatten into (parcel_id, reviewIdx) tuples — only reviews needing NLP
  type ReviewTask = {
    parcel_id: string;
    reviewIdx: number;
    text: string;
  };

  const allTasks: ReviewTask[] = [];

  for (const row of rows) {
    let pendingWeb: PendingWebLayer;
    try {
      pendingWeb = JSON.parse(row.reviews_json) as PendingWebLayer;
    } catch {
      console.warn(`  [nlp] JSON parse error for parcel_id=${row.parcel_id} — skipping`);
      continue;
    }

    const reviewList = pendingWeb.value;
    if (!Array.isArray(reviewList)) continue;

    for (let i = 0; i < reviewList.length; i++) {
      const review = reviewList[i];
      if (!review?.text) continue;
      const needsNlp =
        review.named_entities.length === 0 &&
        review.hazard_mentions.length === 0 &&
        review.amenity_mentions.length === 0;
      if (!needsNlp) continue;

      allTasks.push({ parcel_id: row.parcel_id, reviewIdx: i, text: review.text });
    }
  }

  const tasksToRun = LIMIT > 0 ? allTasks.slice(0, LIMIT) : allTasks;
  console.log(`  ${allTasks.length} reviews need NLP — will process ${tasksToRun.length}`);

  if (tasksToRun.length === 0) {
    console.log('[nlp-review-backfill] Nothing to do.');
    await pool.end();
    return;
  }

  if (DRY_RUN) {
    console.log('\n[nlp-review-backfill] DRY RUN — sample prompts (no API calls, no DB writes):');
    const sample = tasksToRun.slice(0, 3);
    for (const task of sample) {
      console.log(`\n  parcel_id=${task.parcel_id} [review index ${task.reviewIdx}]`);
      console.log(`  text (${task.text.length} chars): "${task.text.slice(0, 120)}..."`);
      console.log(`  DB write path: {layers,pending_web,value,${task.reviewIdx},named_entities} etc.`);
    }
    console.log(`\n[nlp-review-backfill] Would send ${tasksToRun.length} DeepSeek calls.`);
    console.log(`  Rate: max ${MAX_RPS} RPS (sliding window), concurrency ${CONCURRENCY}.`);
    console.log(`  Estimated cost: ~$${(tasksToRun.length * 0.000126).toFixed(4)} USD`);
    await pool.end();
    return;
  }

  let totalProcessed = 0;
  let totalNlpOk = 0;
  let totalNlpFailed = 0;
  let totalDbFailed = 0;
  const runId = `nlp-backfill-${Date.now()}`;
  const startTime = Date.now();

  const execTasks = tasksToRun.map(task => async () => {
    let nlp: NlpResult;
    try {
      nlp = await extractNlp(task.text, runId);
      totalNlpOk++;
    } catch (err) {
      console.error(`  [nlp] DeepSeek FAILED parcel=${task.parcel_id} review=${task.reviewIdx}: ${(err as Error).message}`);
      totalNlpFailed++;
      totalProcessed++;
      return;
    }

    // Immediately write back to the specific indexed fields via jsonb_set
    try {
      await writeNlpToReview(pool, task.parcel_id, task.reviewIdx, nlp);
    } catch (err) {
      console.error(`  [nlp] DB write FAILED parcel=${task.parcel_id} review=${task.reviewIdx}: ${(err as Error).message}`);
      totalDbFailed++;
    }

    totalProcessed++;
    if (totalProcessed % 100 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rps = (totalProcessed / ((Date.now() - startTime) / 1000)).toFixed(1);
      console.log(`  [checkpoint] ${totalProcessed}/${tasksToRun.length} reviews — ${elapsed}s elapsed, ${rps} rps, ${totalNlpFailed} nlp-failed, ${totalDbFailed} db-failed`);
    }
  });

  console.log(`\n[nlp-review-backfill] Running ${execTasks.length} DeepSeek calls (concurrency=${CONCURRENCY}, max ${MAX_RPS} RPS)...`);
  await pLimit(execTasks, CONCURRENCY);

  await pool.end();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const rps = (totalProcessed / ((Date.now() - startTime) / 1000)).toFixed(1);
  console.log(`\n[nlp-review-backfill] Complete in ${elapsed}s (avg ${rps} rps)`);
  console.log(`  ✓ NLP extracted: ${totalNlpOk}`);
  console.log(`  ✗ NLP failed:    ${totalNlpFailed}`);
  console.log(`  ✗ DB failed:     ${totalDbFailed}`);
  console.log(`\n  Check actual cost:`);
  console.log(`  SELECT SUM(credits_consumed) FROM ai_usage_log WHERE agent_id = 'nlp-review-backfill';`);
}

main().catch(err => {
  console.error('[nlp-review-backfill] Fatal:', err.message);
  process.exit(1);
});
