/**
 * MeteringAdapter — Wraps @anthropic-ai/sdk with attribution metadata
 * and three-bucket cost routing.
 *
 * Three-bucket charging rule:
 *  - triggered_by: 'user'  → pre-flight credit reservation; post-call debit reconciliation
 *  - triggered_by: 'event' → platform absorbs (tier benefit, not metered to user)
 *  - triggered_by: 'cron'  → platform absorbs (tier benefit, not metered to user)
 *
 * Integrates with the existing creditService (reserveCredits / debitActualCost)
 * and reports token usage to the ai_usage_log table matching JediAIService patterns.
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
 * Estimate cost in USD for a given model and token counts.
 * Used for pre-flight reservation — actual cost computed post-call.
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
   * For user-triggered runs:
   *   1. Pre-flight: reserve estimated credits (fail-fast if insufficient)
   *   2. Call Anthropic API
   *   3. Post-call: reconcile actual cost vs reservation
   *
   * For event/cron-triggered runs:
   *   - No reservation; platform absorbs cost via platformExpense logging
   */
  async createMessage(params: MessageParams): Promise<MeteredMessage> {
    const { metadata, ...apiParams } = params;
    const estimate = preflightEstimate(apiParams.model);

    // Pre-flight credit reservation (user-triggered only)
    if (metadata.triggered_by === 'user' && metadata.user_id) {
      await creditService.reserveCredits(metadata.user_id, estimate);
    }

    const response = await this.anthropic.messages.create({
      model: apiParams.model,
      system: apiParams.system,
      messages: apiParams.messages,
      tools: apiParams.tools,
      max_tokens: apiParams.max_tokens,
    });

    const actualCost = estimateCost(
      apiParams.model,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    // Post-call: reconcile reservation vs actual and log usage
    Promise.resolve()
      .then(() =>
        this.postCallSettle(metadata, response, actualCost, estimate, apiParams.model)
      )
      .catch(err =>
        logger.error('MeteringAdapter: post-call settlement failed', { err })
      );

    return {
      ...response,
      usage: { ...response.usage, cost_usd: actualCost },
    };
  }

  // ── Private helpers ────────────────────────────────────────────

  private async postCallSettle(
    metadata: MeteringMetadata,
    response: Anthropic.Message,
    actualCost: number,
    reservedCost: number,
    model: string
  ): Promise<void> {
    await this.logUsage(metadata, response, actualCost, model);

    if (metadata.triggered_by === 'user' && metadata.user_id) {
      // Reconcile reservation with actual cost
      await creditService.debitActualCost(
        metadata.user_id,
        reservedCost,
        actualCost
      );
    } else {
      // event / cron — platform absorbs; log for cost monitoring
      logger.info('MeteringAdapter: platform expense', {
        trigger: metadata.triggered_by,
        cost: actualCost,
        agentId: metadata.actor_id,
        dealId: metadata.deal_id,
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
      logger.warn('MeteringAdapter: failed to log usage to ai_usage_log', { err });
    }
  }
}

export const meteringAdapter = new MeteringAdapter();
