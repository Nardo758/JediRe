/**
 * MeteringAdapter — Wraps @anthropic-ai/sdk with attribution metadata
 * and three-bucket cost routing.
 *
 * Three-bucket charging rule:
 *  - triggered_by: 'user'  → user's credit balance is debited
 *  - triggered_by: 'event' → platform absorbs (tier benefit, not metered to user)
 *  - triggered_by: 'cron'  → platform absorbs (tier benefit, not metered to user)
 *
 * Tier gating for event/cron is enforced at the trigger level, not here.
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { MeteringMetadata } from './types';

// ── Cost table (USD per 1M tokens, approximate) ─────────────────

const COST_PER_MTK: Record<string, { input: number; output: number }> = {
  'claude-opus-4-20250514':         { input: 15.00, output: 75.00 },
  'claude-opus-4-7':                 { input: 15.00, output: 75.00 },
  'claude-sonnet-4-20250514':       { input:  3.00, output: 15.00 },
  'claude-sonnet-4-5':              { input:  3.00, output: 15.00 },
  'claude-haiku-4-5-20251001':      { input:  0.80, output:  4.00 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_MTK[model] ?? { input: 3.00, output: 15.00 };
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
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
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Create a metered Claude message.
   * - Records attribution metadata on every call
   * - Routes costs to the right bucket per triggered_by
   * - Returns usage augmented with cost_usd
   */
  async createMessage(params: MessageParams): Promise<MeteredMessage> {
    const { metadata, ...apiParams } = params;

    const response = await this.anthropic.messages.create({
      model: apiParams.model,
      system: apiParams.system,
      messages: apiParams.messages,
      tools: apiParams.tools,
      max_tokens: apiParams.max_tokens,
    });

    const cost = estimateCost(
      apiParams.model,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    // Fire-and-forget: log + charge in background; don't block the loop
    Promise.resolve().then(() =>
      this.recordAndCharge(metadata, response, cost, apiParams.model)
    ).catch(err => logger.error('MeteringAdapter: record/charge failed', { err }));

    return {
      ...response,
      usage: { ...response.usage, cost_usd: cost },
    };
  }

  private async recordAndCharge(
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
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT DO NOTHING`,
        [
          metadata.user_id ?? null,
          metadata.deal_id ?? null,
          metadata.actor_id,
          `agent_run:${metadata.agent_run_id ?? 'unknown'}`,
          'agent',
          model,
          response.usage.input_tokens,
          response.usage.output_tokens,
          cost,
          0,
        ]
      );
    } catch (err) {
      logger.warn('MeteringAdapter: failed to record usage', { err });
    }

    // Three-bucket routing
    if (metadata.triggered_by === 'user' && metadata.user_id) {
      await this.debitUser(metadata.user_id, cost, metadata);
    } else {
      // event or cron → platform absorbs; just log
      logger.debug('MeteringAdapter: platform expense', {
        trigger: metadata.triggered_by,
        cost,
        agentId: metadata.actor_id,
      });
    }
  }

  private async debitUser(
    userId: string,
    cost: number,
    metadata: MeteringMetadata
  ): Promise<void> {
    try {
      await query(
        `UPDATE user_credit_balances
         SET credits_remaining = credits_remaining - $1,
             credits_used_this_period = credits_used_this_period + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [cost, userId]
      );
    } catch (err) {
      logger.error('MeteringAdapter: failed to debit user', {
        userId,
        cost,
        err,
      });
    }
  }
}

export const meteringAdapter = new MeteringAdapter();
