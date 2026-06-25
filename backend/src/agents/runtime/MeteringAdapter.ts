/**
 * MeteringAdapter — Wraps @anthropic-ai/sdk with attribution metadata
 * and three-bucket cost routing.
 *
 * Three-bucket charging rule (deterministic, synchronous before returning):
 *  - triggered_by: 'user'  → pre-flight reservation; post-call debit reconciliation
 *                            + Stripe billing meter events
 *  - triggered_by: 'event' → platform absorbs; logged to ai_usage_log only
 *  - triggered_by: 'cron'  → platform absorbs; logged to ai_usage_log only
 *
 * Mirrors the Stripe metering pattern in JediAIService.reportStripeUsage():
 *  jedi_input_tokens + jedi_output_tokens meter events per call.
 *
 * Tier gating for event/cron is enforced at the trigger level, not here.
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { MeteringMetadata } from './types';

// ── Token cost table (USD per 1M tokens, approximate) ────────────

const COST_PER_MTK: Record<string, { input: number; output: number }> = {
  'claude-opus-4-5':           { input: 15.00, output: 75.00 },
  'claude-sonnet-4-5':         { input:  3.00, output: 15.00 },
  'claude-haiku-4-5-20251001': { input:  0.80, output:  4.00 },
  'claude-haiku-4-5':          { input:  0.80, output:  4.00 },
  // DeepSeek (OpenAI-compatible). Routed via DeepSeekMeteringAdapter for
  // actual calls, but kept here so estimateCost() returns sane numbers if a
  // DeepSeek model name flows through generic cost-rollup paths.
  'deepseek-chat':             { input:  0.27, output:  1.10 },
  'deepseek-reasoner':         { input:  0.55, output:  2.19 },
};

/**
 * Calculate cost in USD for a given model and token counts.
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = COST_PER_MTK[model] ?? { input: 3.00, output: 15.00 };
  return (inputTokens / 1_000_000) * rates.input +
         (outputTokens / 1_000_000) * rates.output;
}

/** Conservative pre-flight estimate: assume 4k input + 4k output worst-case */
function preflightEstimate(model: string): number {
  return estimateCost(model, 4_096, 4_096);
}

export interface MessageParams {
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  max_tokens: number;
  metadata: MeteringMetadata;
  tool_choice?: { type: 'function'; function: { name: string } };
}

export interface MeteredMessage extends Anthropic.Message {
  usage: Anthropic.Message['usage'] & { cost_usd: number };
}

// ── Per-deal burst guards (process-local) ─────────────────────────────────
// 1. DealRunStartLimiter — sliding-window cap on run starts per deal (60 s).
// 2. acquireDealSlot     — concurrency cap on simultaneous model calls per deal.
// Both queue (never reject) excess callers and emit warnings.

const MAX_RUN_STARTS_PER_DEAL    = 3;    // max run starts per deal within WINDOW_MS
const RUN_START_WINDOW_MS        = 60_000; // 60-second sliding window for run starts
const MAX_CONCURRENT_MODEL_CALLS = 3;    // max simultaneous model calls per deal
const QUEUE_WARN_INTERVAL_MS     = 30_000; // periodic warn interval while a call is queued

// ── 1. Run-start window limiter ──────────────────────────────────

interface StartWindow {
  starts: number[];                // timestamps of recent run starts
  queue: Array<() => void>;        // callers waiting for a slot in the window
}

const runStartWindows = new Map<string, StartWindow>();

class DealRunStartLimiter {
  private getWindow(dealId: string): StartWindow {
    if (!runStartWindows.has(dealId)) {
      runStartWindows.set(dealId, { starts: [], queue: [] });
    }
    return runStartWindows.get(dealId)!;
  }

  private prune(w: StartWindow): void {
    const cutoff = Date.now() - RUN_START_WINDOW_MS;
    w.starts = w.starts.filter(ts => ts > cutoff);
  }

  private msUntilNextSlot(w: StartWindow): number {
    if (w.starts.length < MAX_RUN_STARTS_PER_DEAL) return 0;
    const oldest = Math.min(...w.starts);
    return Math.max(0, oldest + RUN_START_WINDOW_MS - Date.now());
  }

  /** Queue (never reject) until a run-start slot is available for this deal. */
  async acquire(dealId: string): Promise<void> {
    const w = this.getWindow(dealId);
    this.prune(w);

    if (w.starts.length < MAX_RUN_STARTS_PER_DEAL) {
      const ts = Date.now();
      w.starts.push(ts);
      setTimeout(() => this.drainQueue(dealId), RUN_START_WINDOW_MS + 1);
      return;
    }

    const waitMs = this.msUntilNextSlot(w);
    logger.warn('MeteringAdapter: deal run-start window full, queuing run', {
      dealId,
      startsInWindow: w.starts.length,
      cap: MAX_RUN_STARTS_PER_DEAL,
      windowMs: RUN_START_WINDOW_MS,
      estimatedWaitMs: waitMs,
    });

    return new Promise<void>((resolve) => {
      let warnTimer: ReturnType<typeof setInterval>;

      const proceed = () => {
        clearInterval(warnTimer);
        const ts = Date.now();
        w.starts.push(ts);
        logger.info('MeteringAdapter: queued run acquired run-start slot', { dealId });
        setTimeout(() => this.drainQueue(dealId), RUN_START_WINDOW_MS + 1);
        resolve();
      };

      warnTimer = setInterval(() => {
        logger.warn('MeteringAdapter: run still queued (waiting for run-start window slot)', { dealId });
      }, QUEUE_WARN_INTERVAL_MS);

      w.queue.push(proceed);
      setTimeout(() => this.drainQueue(dealId), Math.max(waitMs, 1));
    });
  }

  private drainQueue(dealId: string): void {
    const w = runStartWindows.get(dealId);
    if (!w) return;
    this.prune(w);
    while (w.queue.length > 0 && w.starts.length < MAX_RUN_STARTS_PER_DEAL) {
      const next = w.queue.shift()!;
      next();
    }
    if (w.starts.length === 0 && w.queue.length === 0) {
      runStartWindows.delete(dealId);
    }
  }
}

/** Singleton — import and call `dealRunStartLimiter.acquire(dealId)` in AgentRuntime. */
export const dealRunStartLimiter = new DealRunStartLimiter();

// ── 2. Model-call concurrency slot limiter ──────────────────────

interface DealSlot {
  active: number;
  queue: Array<() => void>;
}

const dealSlots = new Map<string, DealSlot>();

function getDealSlot(dealId: string): DealSlot {
  if (!dealSlots.has(dealId)) {
    dealSlots.set(dealId, { active: 0, queue: [] });
  }
  return dealSlots.get(dealId)!;
}

/**
 * Acquire a model-call concurrency slot for a deal.
 * Returns a release function — MUST be called exactly once when the
 * model call (and post-call settlement) completes.
 * Never rejects — queued callers wait indefinitely until a slot opens.
 */
async function acquireDealSlot(dealId: string): Promise<() => void> {
  const slot = getDealSlot(dealId);

  if (slot.active < MAX_CONCURRENT_MODEL_CALLS) {
    slot.active++;
    return () => releaseDealSlot(dealId);
  }

  // Slot full — queue and warn periodically while waiting.
  const queuedAt = Date.now();
  logger.warn('MeteringAdapter: deal model-call concurrency cap reached, queuing', {
    dealId,
    active: slot.active,
    queued: slot.queue.length + 1,
    cap: MAX_CONCURRENT_MODEL_CALLS,
  });

  return new Promise<() => void>((resolve) => {
    let warnTimer: ReturnType<typeof setInterval>;

    function proceed() {
      clearInterval(warnTimer);
      slot.active++;
      logger.info('MeteringAdapter: queued model call acquired slot', {
        dealId,
        waitedMs: Date.now() - queuedAt,
      });
      resolve(() => releaseDealSlot(dealId));
    }

    warnTimer = setInterval(() => {
      logger.warn('MeteringAdapter: model call still queued (waiting for concurrency slot)', {
        dealId,
        waitedMs: Date.now() - queuedAt,
      });
    }, QUEUE_WARN_INTERVAL_MS);

    slot.queue.push(proceed);
  });
}

function releaseDealSlot(dealId: string): void {
  const slot = dealSlots.get(dealId);
  if (!slot) return;
  slot.active = Math.max(0, slot.active - 1);
  if (slot.queue.length > 0) {
    const next = slot.queue.shift()!;
    next();
  } else if (slot.active === 0) {
    dealSlots.delete(dealId);
  }
}

export class MeteringAdapter {
  private anthropic: Anthropic;

  /**
   * @param anthropicClient Optional pre-built Anthropic client.
   *   Pass one in test/stub contexts to avoid SDK-level API key validation.
   *   When omitted, the production client is constructed from environment variables.
   */
  constructor(anthropicClient?: Anthropic) {
    // Same baseURL handling as JediAIService — pass the ModelFarm proxy URL
    // explicitly because the SDK only auto-reads ANTHROPIC_BASE_URL.
    this.anthropic = anthropicClient ?? new Anthropic({
      apiKey:
        process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.CLAUDE_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || undefined,
    });
  }

  /**
   * Create a metered Claude message.
   *
   * Settlement is synchronous (awaited) before returning — accounting is
   * guaranteed complete regardless of caller error handling.
   *
   * Rate limiting: if a deal_id is present in metadata and more than
   * MAX_CONCURRENT_MODEL_CALLS (3) model calls are already in-flight for
   * the same deal, this call is queued (not rejected) until a slot opens.
   * Queued calls wait indefinitely — a warning is logged every
   * QUEUE_WARN_INTERVAL_MS (30 s) to surface stale queues in logs.
   */
  async createMessage(params: MessageParams): Promise<MeteredMessage> {
    const { metadata, ...apiParams } = params;

    // Acquire deal concurrency slot (queues if over limit, no-ops if no deal_id).
    // The slot is released in a finally block that wraps the entire call chain,
    // guaranteeing release regardless of where an error occurs.
    let releaseSlot: (() => void) | null = null;
    if (metadata.deal_id) {
      releaseSlot = await acquireDealSlot(metadata.deal_id);
    }

    try {
      // A3: Stripe metering route — agent runtime calls are platform-absorbed.
      // User credits are deducted at the JediAIService layer (flat credits per
      // operation). The MeteringAdapter only tracks actual cost for analytics
      // and Stripe meter reporting. No credit reservation here.
      let response: Anthropic.Message;

      try {
        response = await this.anthropic.messages.create({
          model: apiParams.model,
          system: apiParams.system,
          messages: apiParams.messages,
          tools: apiParams.tools,
          max_tokens: apiParams.max_tokens,
        });
      } catch (err) {
        throw err;
      }

      const actualCost = estimateCost(
        apiParams.model,
        response.usage.input_tokens,
        response.usage.output_tokens
      );

      await this.settle(metadata, response, actualCost, apiParams.model);

      return {
        ...response,
        usage: { ...response.usage, cost_usd: actualCost },
      };
    } finally {
      // Always release the concurrency slot — covers success, model errors,
      // reservation failures, and settlement errors.
      releaseSlot?.();
    }
  }

  // ── Private helpers ────────────────────────────────────────────

  private async settle(
    metadata: MeteringMetadata,
    response: Anthropic.Message,
    actualCost: number,
    model: string
  ): Promise<void> {
    // 1. Log to internal ai_usage_log (now with cost_usd for platform economics)
    await this.logUsage(metadata, response, actualCost, model);

    // 2. Report to Stripe billing meters (cost + raw tokens for analytics)
    await this.reportStripeUsage(metadata, response.usage, model);
    await this.reportStripeCost(metadata, actualCost);

    // 3. Log platform expense for event/cron attribution
    if (metadata.triggered_by !== 'user') {
      logger.info('MeteringAdapter: platform expense (event/cron)', {
        trigger: metadata.triggered_by,
        costUsd: actualCost.toFixed(4),
        agentId: metadata.actor_id,
        agentRunId: metadata.agent_run_id,
        dealId: metadata.deal_id,
        model,
      });
    }
  }

  /**
   * Report token usage to Stripe billing meters.
   * Mirrors JediAIService.reportStripeUsage() — same meter names.
   */
  private async reportStripeUsage(
    metadata: MeteringMetadata,
    usage: { input_tokens: number; output_tokens: number },
    _model: string
  ): Promise<void> {
    if (!process.env.STRIPE_SECRET_KEY || !metadata.user_id) return;

    try {
      // Resolve stripe customer id from user record
      const userRow = await query(
        `SELECT stripe_customer_id FROM user_credit_balances WHERE user_id = $1`,
        [metadata.user_id]
      );

      const stripeCustomerId: string | undefined =
        userRow.rows[0]?.stripe_customer_id;

      if (!stripeCustomerId) return;

      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      await stripe.billing.meterEvents.create({
        event_name: 'jedi_input_tokens',
        payload: {
          stripe_customer_id: stripeCustomerId,
          value: String(usage.input_tokens),
        },
      });

      await stripe.billing.meterEvents.create({
        event_name: 'jedi_output_tokens',
        payload: {
          stripe_customer_id: stripeCustomerId,
          value: String(usage.output_tokens),
        },
      });

    } catch (err) {
      // Non-fatal: Stripe reporting failures should not fail the agent run
      logger.error('MeteringAdapter: Stripe meter event failed', {
        userId: metadata.user_id,
        err,
      });
    }
  }

  /**
   * A3: Report actual cost to Stripe billing meter (jedi_ai_cost_usd).
   * This enables usage-based billing at the platform's actual cost.
   */
  private async reportStripeCost(
    metadata: MeteringMetadata,
    costUsd: number
  ): Promise<void> {
    if (!process.env.STRIPE_SECRET_KEY || !metadata.user_id) return;
    try {
      const userRow = await query(
        `SELECT stripe_customer_id FROM user_credit_balances WHERE user_id = $1`,
        [metadata.user_id]
      );
      const stripeCustomerId: string | undefined =
        userRow.rows[0]?.stripe_customer_id;
      if (!stripeCustomerId) return;

      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      await stripe.billing.meterEvents.create({
        event_name: 'jedi_ai_cost_usd',
        payload: {
          stripe_customer_id: stripeCustomerId,
          value: String(Math.round(costUsd * 1_000_000)), // micro-dollars
        },
      });
    } catch (err) {
      logger.error('MeteringAdapter: Stripe cost meter event failed', {
        userId: metadata.user_id,
        err,
      });
    }
  }

  private async logUsage(
    metadata: MeteringMetadata,
    response: Anthropic.Message,
    costUsd: number,
    model: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO ai_usage_log (
           user_id, deal_id, agent_id, operation_type, surface,
           model, input_tokens, output_tokens, credits_consumed, cost_usd, latency_ms
         ) VALUES ($1,$2,$3,$4,'agent',$5,$6,$7,$8,$9,0)
         ON CONFLICT DO NOTHING`,
        [
          (metadata.user_id && metadata.user_id.trim() !== '' ? metadata.user_id : null) ?? '00000000-0000-0000-0000-000000000000',
          metadata.deal_id ?? null,
          metadata.actor_id,
          `agent_run:${metadata.agent_run_id ?? 'unknown'}`,
          model,
          response.usage.input_tokens,
          response.usage.output_tokens,
          0, // credits_consumed: 0 for MeteringAdapter (user pays via JediAIService)
          costUsd,
        ]
      );
    } catch (err) {
      logger.warn('MeteringAdapter: failed to write ai_usage_log', { err });
    }
  }
}

export const meteringAdapter = new MeteringAdapter();
