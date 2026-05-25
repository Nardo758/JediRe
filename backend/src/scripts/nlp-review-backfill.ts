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
 * Flags:
 *   --dry-run         Print what would be sent; no API calls, no DB writes
 *   --limit=N         Process at most N reviews total (default: all)
 *   --concurrency=N   Parallel DeepSeek calls (default: 5)
 *
 * Cost: ~$0.17 for all 1,350 reviews using deepseek-chat at $0.27/M input + $1.10/M output.
 * All calls use triggered_by: 'cron' — cost is platform-absorbed, not charged to any user.
 */

import { Pool } from 'pg';
import { deepseekAdapter } from '../agents/runtime/DeepSeekMeteringAdapter';

// ── CLI flags ─────────────────────────────────────────────────────────────────

function parseFlag(flag: string, defaultVal: string | null = null): string | null {
  const arg = process.argv.find(a => a.startsWith(`--${flag}=`));
  return arg ? (arg.split('=')[1] ?? defaultVal) : defaultVal;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(`--${flag}`);
}

const DRY_RUN = hasFlag('dry-run');
const LIMIT = parseInt(parseFlag('limit', '0') ?? '0', 10);
const CONCURRENCY = parseInt(parseFlag('concurrency', '5') ?? '5', 10);

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

interface PropertyDescriptionRow {
  parcel_id: string;
  pending_web: PendingWebLayer;
}

interface NlpResult {
  named_entities: string[];
  hazard_mentions: string[];
  amenity_mentions: string[];
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
   Example: "pool", "dog park", "gym", "business center", "lash lift" (only if it is a property amenity).
   Do NOT include: general praise words like "amenities are great" with no specifics.

CRITICAL: If something is not literally written in the review text, do not include it.
No inference. No synthesis. Empty arrays are correct when nothing qualifies.

Respond with JSON only:
{"named_entities": [], "hazard_mentions": [], "amenity_mentions": []}`;

// ── DeepSeek call ─────────────────────────────────────────────────────────────

async function extractNlp(reviewText: string, parcelId: string): Promise<NlpResult> {
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
      agent_run_id: `nlp-backfill-${Date.now()}`,
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
    console.warn(`  [nlp] JSON parse failed for ${parcelId} — defaulting to empty arrays`);
    return { named_entities: [], hazard_mentions: [], amenity_mentions: [] };
  }
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
  console.log(`  dry-run: ${DRY_RUN}, limit: ${LIMIT || 'all'}, concurrency: ${CONCURRENCY}`);

  // Fetch all rows with reviews in pending_web
  const { rows } = await pool.query<{ parcel_id: string; reviews_json: string }>(`
    SELECT parcel_id, (reviews->'layers'->'pending_web')::text AS reviews_json
    FROM property_descriptions
    WHERE reviews->'layers'->'pending_web'->'value' IS NOT NULL
    ORDER BY parcel_id
  `);

  console.log(`\n[nlp-review-backfill] Found ${rows.length} properties with pending_web reviews`);

  // Flatten into individual (parcel_id, reviewIndex, reviewText) tuples
  // keeping only reviews that still need NLP (all 3 arrays empty)
  type ReviewTask = {
    parcel_id: string;
    reviewIdx: number;
    text: string;
    pendingWeb: PendingWebLayer;
    allReviews: ReviewObject[];
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
      // Only process reviews that still need NLP
      const needsNlp =
        review.named_entities.length === 0 &&
        review.hazard_mentions.length === 0 &&
        review.amenity_mentions.length === 0;
      if (!needsNlp) continue;

      allTasks.push({
        parcel_id: row.parcel_id,
        reviewIdx: i,
        text: review.text,
        pendingWeb,
        allReviews: reviewList,
      });
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
    console.log('\n[nlp-review-backfill] DRY RUN — sample prompts:');
    const sample = tasksToRun.slice(0, 3);
    for (const task of sample) {
      console.log(`\n  parcel_id: ${task.parcel_id} [review ${task.reviewIdx}]`);
      console.log(`  text (${task.text.length} chars): "${task.text.slice(0, 120)}..."`);
      console.log(`  system prompt: ${SYSTEM_PROMPT.slice(0, 80)}...`);
    }
    console.log(`\n[nlp-review-backfill] Would send ${tasksToRun.length} DeepSeek calls.`);
    console.log(`  Estimated cost: ~$${(tasksToRun.length * 0.000126).toFixed(4)} USD`);
    await pool.end();
    return;
  }

  // Group tasks by parcel_id so we can do one DB write per property
  // after all its reviews have been processed.
  const byParcel = new Map<
    string,
    { pendingWeb: PendingWebLayer; allReviews: ReviewObject[]; tasks: ReviewTask[] }
  >();

  for (const task of tasksToRun) {
    if (!byParcel.has(task.parcel_id)) {
      byParcel.set(task.parcel_id, {
        pendingWeb: task.pendingWeb,
        allReviews: task.allReviews,
        tasks: [],
      });
    }
    byParcel.get(task.parcel_id)!.tasks.push(task);
  }

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  const startTime = Date.now();

  // Build flat task list for p-limit execution
  const execTasks = tasksToRun.map(task => async () => {
    try {
      const nlp = await extractNlp(task.text, task.parcel_id);
      // Mutate in place — allReviews is shared reference per parcel
      task.allReviews[task.reviewIdx].named_entities = nlp.named_entities;
      task.allReviews[task.reviewIdx].hazard_mentions = nlp.hazard_mentions;
      task.allReviews[task.reviewIdx].amenity_mentions = nlp.amenity_mentions;
      totalUpdated++;
    } catch (err) {
      console.error(`  [nlp] FAILED parcel=${task.parcel_id} review=${task.reviewIdx}: ${(err as Error).message}`);
      totalFailed++;
    } finally {
      totalProcessed++;
      if (totalProcessed % 100 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  [checkpoint] ${totalProcessed}/${tasksToRun.length} reviews — ${elapsed}s elapsed, ${totalFailed} failed`);
      }
    }
  });

  console.log(`\n[nlp-review-backfill] Running ${execTasks.length} DeepSeek calls (concurrency=${CONCURRENCY})...`);
  await pLimit(execTasks, CONCURRENCY);

  // Write updated review arrays back to DB, one UPDATE per parcel
  console.log(`\n[nlp-review-backfill] Writing ${byParcel.size} properties back to DB...`);
  let dbSuccess = 0;
  let dbFailed = 0;

  for (const [parcelId, entry] of byParcel) {
    if (entry.tasks.length === 0) continue;
    try {
      const updatedPendingWeb: PendingWebLayer = {
        ...entry.pendingWeb,
        value: entry.allReviews,
      };
      await pool.query(
        `UPDATE property_descriptions
         SET reviews = reviews ||
           jsonb_build_object('layers',
             COALESCE(reviews->'layers', '{}') ||
             jsonb_build_object('pending_web', $2::jsonb)
           ),
           updated_at = NOW()
         WHERE parcel_id = $1`,
        [parcelId, JSON.stringify(updatedPendingWeb)],
      );
      dbSuccess++;
    } catch (err) {
      console.error(`  [nlp] DB write failed for parcel_id=${parcelId}: ${(err as Error).message}`);
      dbFailed++;
    }
  }

  await pool.end();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[nlp-review-backfill] Complete in ${elapsed}s`);
  console.log(`  ✓ NLP extracted: ${totalUpdated}`);
  console.log(`  ✗ NLP failed:    ${totalFailed}`);
  console.log(`  ✓ DB updated:    ${dbSuccess} properties`);
  console.log(`  ✗ DB failed:     ${dbFailed} properties`);
  console.log(`\n  Estimated cost: ~$${(totalUpdated * 0.000126).toFixed(4)} USD`);
  console.log(`  Check ai_usage_log for actual cost: SELECT SUM(credits_consumed) FROM ai_usage_log WHERE agent_id = 'nlp-review-backfill';`);
}

main().catch(err => {
  console.error('[nlp-review-backfill] Fatal:', err.message);
  process.exit(1);
});
