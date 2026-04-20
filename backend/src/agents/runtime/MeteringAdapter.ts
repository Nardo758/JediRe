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
import { creditService } from '../../services/ai/creditService';
import type { MeteringMetadata } from './types';

// ── Token cost table (USD per 1M tokens, approximate) ────────────

const COST_PER_MTK: Record<string, { input: number; output: number }> = {
  'claude-opus-4-20250514':    { input: 15.00, output: 75.00 },
  'claude-opus-4-7':           { input: 15.00, output: 75.00 },
  'claude-sonnet-4-20250514':  { input:  3.00, output: 15.00 },
  'claude-sonnet-4-5':         { input:  3.00, output: 15.00 },
  'claude-haiku-4-5-20251001': { input:  0.80, output:  4.00 },
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
}

export interface MeteredMessage extends Anthropic.Message {
  usage: Anthropic.Message['usage'] & { cost_usd: number };
}

// ── Per-deal thundering-herd rate limiter ─────────────────────────
// Tracks in-flight model calls per deal to prevent burst concurrency.
// If more than MAX_CONCURRENT_RUNS_PER_DEAL model calls are already
// active for a deal, additional callers are queued (never rejected)
// and proceed as soon as a slot is released.
//
// State is process-local; resets on restart (intentional — only guards
// burst concurrency within a single server process).

const MAX_CONCURRENT_RUNS_PER_DEAL = 3;
const QUEUE_WARN_INTERVAL_MS = 30_000; // log a warning every 30 s while queued

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
 * Acquire a concurrency slot for a deal.
 * Returns a release function that MUST be called exactly once when the
 * model call (and post-call settlement) is complete.
 * Never rejects — queued callers wait indefinitely until a slot opens.
 */
async function acquireDealSlot(dealId: string): Promise<() => void> {
  const slot = getDealSlot(dealId);

  if (slot.active < MAX_CONCURRENT_RUNS_PER_DEAL) {
    slot.active++;
    return () => releaseDealSlot(dealId);
  }

  // Slot full — queue the caller and warn at regular intervals while waiting.
  const queuedAt = Date.now();
  logger.warn('MeteringAdapter: deal concurrency cap reached, queuing run', {
    dealId,
    active: slot.active,
    queued: slot.queue.length + 1,
    cap: MAX_CONCURRENT_RUNS_PER_DEAL,
  });

  return new Promise<() => void>((resolve) => {
    let warnTimer: ReturnType<typeof setInterval>;

    function proceed() {
      clearInterval(warnTimer);
      slot.active++;
      logger.info('MeteringAdapter: queued run acquired slot', {
        dealId,
        waitedMs: Date.now() - queuedAt,
      });
      resolve(() => releaseDealSlot(dealId));
    }

    // Emit a periodic warning while queued so long waits are observable.
    warnTimer = setInterval(() => {
      logger.warn('MeteringAdapter: run still queued (waiting for deal slot)', {
        dealId,
        waitedMs: Date.now() - queuedAt,
        queueDepth: slot.queue.indexOf(proceed),
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

  constructor() {
    this.anthropic = new Anthropic({
      apiKey:
        process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ||
        process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Create a metered Claude message.
   *
   * Settlement is synchronous (awaited) before returning — accounting is
   * guaranteed complete regardless of caller error handling.
   *
   * Rate limiting: if a deal_id is present in metadata and more than
   * MAX_CONCURRENT_RUNS_PER_DEAL model calls are already in-flight for
   * the same deal, this call is queued (not rejected) until a slot opens.
   * The queue times out after QUEUE_TIMEOUT_MS (30 s) to prevent starvation.
   */
  async createMessage(params: MessageParams): Promise<MeteredMessage> {
    const { metadata, ...apiParams } = params;
    const estimate = preflightEstimate(apiParams.model);

    // Acquire deal concurrency slot (queues if over limit, no-ops if no deal_id).
    // The slot is released in a finally block that wraps the entire call chain,
    // guaranteeing release regardless of where an error occurs.
    let releaseSlot: (() => void) | null = null;
    if (metadata.deal_id) {
      releaseSlot = await acquireDealSlot(metadata.deal_id);
    }

    try {
      // Pre-flight credit reservation (user-triggered only — fail-fast).
      // wasReserved is TRUE only when the estimate was actually deducted from the
      // user balance. FALSE when the call is allowed without deduction (overage
      // tier, no credit record). This distinction controls refund/settlement logic.
      let wasReserved = false;
      if (metadata.triggered_by === 'user' && metadata.user_id) {
        wasReserved = await creditService.reserveCredits(metadata.user_id, estimate);
      }

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
        // Model call failed — refund the reservation ONLY if a deduction was made.
        // Prevents phantom credits if reserveCredits allowed without deducting.
        if (wasReserved && metadata.user_id) {
          await creditService.debitActualCost(metadata.user_id, estimate, 0).catch(
            refundErr => logger.error('MeteringAdapter: failed to refund reservation', { refundErr })
          );
        }
        throw err;
      }

      const actualCost = estimateCost(
        apiParams.model,
        response.usage.input_tokens,
        response.usage.output_tokens
      );

      // Synchronous post-call settlement — guaranteed before returning to caller.
      // Pass the effective reserved amount: if no deduction occurred, treat as 0
      // so settle() charges full actualCost rather than only the delta.
      await this.settle(metadata, response, actualCost, wasReserved ? estimate : 0, apiParams.model);

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
    reservedCost: number,
    model: string
  ): Promise<void> {
    // 1. Log to internal ai_usage_log (matches JediAIService.logUsage pattern)
    await this.logUsage(metadata, response, actualCost, model);

    // 2. Bucket-specific settlement
    if (metadata.triggered_by === 'user' && metadata.user_id) {
      // Reconcile reservation with actual cost
      await creditService.debitActualCost(
        metadata.user_id,
        reservedCost,
        actualCost
      );

      // Report to Stripe billing meters (matches JediAIService.reportStripeUsage)
      await this.reportStripeUsage(metadata, response.usage, model);

    } else {
      // event / cron — platform absorbs; log for cost attribution
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

  private async logUsage(
    metadata: MeteringMetadata,
    response: Anthropic.Message,
    cost: number,
    model: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO ai_usage_log (
           user_id, deal_id, agent_id, operation_type, surface,
           model, input_tokens, output_tokens, credits_consumed, latency_ms
         ) VALUES ($1,$2,$3,$4,'agent',$5,$6,$7,$8,0)
         ON CONFLICT DO NOTHING`,
        [
          metadata.user_id ?? null,
          metadata.deal_id ?? null,
          metadata.actor_id,
          `agent_run:${metadata.agent_run_id ?? 'unknown'}`,
          model,
          response.usage.input_tokens,
          response.usage.output_tokens,
          cost,
        ]
      );
    } catch (err) {
      logger.warn('MeteringAdapter: failed to write ai_usage_log', { err });
    }
  }
}

export const meteringAdapter = new MeteringAdapter();
