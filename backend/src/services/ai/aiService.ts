/**
 * JediAIService — Single chokepoint for ALL Claude calls
 *
 * Routes through @stripe/token-meter for automatic usage reporting.
 * Handles model routing per subscription tier, credit deduction,
 * and usage logging.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../utils/logger';
import { query } from '../../database/connection';
import type {
  AICallContext,
  AgentId,
  SubscriptionTier,
} from '../../types/dealContext';

// ── Model Routing per Tier ─────────────────────────────────────

type ModelRouting = Record<SubscriptionTier, Record<AgentId, string>>;

const MODEL_ROUTING: ModelRouting = {
  scout: {
    research: 'claude-haiku-4-5-20251001',
    zoning: 'claude-sonnet-4-20250514',
    supply: 'claude-sonnet-4-20250514',
    cashflow: 'claude-sonnet-4-20250514',
    coordinator: 'claude-haiku-4-5-20251001',
  },
  operator: {
    research: 'claude-haiku-4-5-20251001',
    zoning: 'claude-sonnet-4-20250514',
    supply: 'claude-sonnet-4-20250514',
    cashflow: 'claude-sonnet-4-20250514',
    coordinator: 'claude-sonnet-4-20250514',
  },
  principal: {
    research: 'claude-haiku-4-5-20251001',
    zoning: 'claude-sonnet-4-20250514',
    supply: 'claude-sonnet-4-20250514',
    cashflow: 'claude-opus-4-20250514',
    coordinator: 'claude-sonnet-4-20250514',
  },
  institutional: {
    research: 'claude-sonnet-4-20250514',
    zoning: 'claude-sonnet-4-20250514',
    supply: 'claude-sonnet-4-20250514',
    cashflow: 'claude-opus-4-20250514',
    coordinator: 'claude-opus-4-20250514',
  },
};

// ── Credit Costs per Operation ─────────────────────────────────

const CREDIT_COSTS: Record<string, number> = {
  research_full_assembly: 3,
  research_single_source: 1,
  research_monitoring_check: 2,
  research_market_scan: 5,
  zoning_analysis: 3,
  supply_analysis: 3,
  supply_pipeline_check: 2,
  cashflow_analysis: 5,
  cashflow_price_rerun: 3,
  cashflow_sensitivity_cell: 3,
  coordinator_synthesis: 4,
  coordinator_comparison: 6,
  coordinator_report_lite: 10,
  coordinator_deal_bible: 40,
  coordinator_chat_response: 2,
};

// ── Error Classes ──────────────────────────────────────────────

export class CreditExhaustedError extends Error {
  constructor(
    public readonly userId: string,
    public readonly creditsRemaining: number,
    public readonly creditCost: number
  ) {
    super(
      `Insufficient credits: ${creditsRemaining} remaining, ${creditCost} required`
    );
    this.name = 'CreditExhaustedError';
  }
}

// ── Main Service ───────────────────────────────────────────────

export class JediAIService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Generate a Claude completion with metering and credit tracking.
   * All agent calls flow through this method.
   */
  async generate(
    context: AICallContext,
    systemPrompt: string,
    messages: Anthropic.MessageParam[],
    options?: {
      maxTokens?: number;
      temperature?: number;
      tools?: Anthropic.Tool[];
    }
  ): Promise<Anthropic.Message> {
    // 1. Resolve model from user tier + agent
    const tier = await this.getUserTier(context.userId);
    const model = MODEL_ROUTING[tier][context.agentId];

    // 2. Check + deduct credits
    const creditCost = this.getCreditCost(context.operationType, model);
    await this.checkAndDeductCredits(context.userId, creditCost);

    // 3. Call Anthropic API
    const startTime = Date.now();

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      system: systemPrompt,
      messages,
      tools: options?.tools,
      temperature: options?.temperature ?? 0,
    });

    const latencyMs = Date.now() - startTime;

    // 4. Report usage to Stripe meter
    await this.reportStripeUsage(context, model, response.usage);

    // 5. Log to internal analytics
    await this.logUsage(context, model, response.usage, creditCost, latencyMs);

    return response;
  }

  /**
   * Streaming variant for real-time chat responses.
   */
  async *stream(
    context: AICallContext,
    systemPrompt: string,
    messages: Anthropic.MessageParam[]
  ): AsyncGenerator<string> {
    const tier = await this.getUserTier(context.userId);
    const model = MODEL_ROUTING[tier][context.agentId];
    const creditCost = this.getCreditCost(context.operationType, model);
    await this.checkAndDeductCredits(context.userId, creditCost);

    const stream = this.anthropic.messages.stream({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
      if (event.type === 'message_delta' && event.usage) {
        outputTokens = event.usage.output_tokens;
      }
      if (event.type === 'message_start' && event.message?.usage) {
        inputTokens = event.message.usage.input_tokens;
      }
    }

    // Report after stream completes
    await this.reportStripeUsage(context, model, {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    });
    await this.logUsage(
      context,
      model,
      {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      creditCost,
      0
    );
  }

  /**
   * Get the model that would be used for a given context.
   */
  async getModelForContext(
    userId: string,
    agentId: AgentId
  ): Promise<string> {
    const tier = await this.getUserTier(userId);
    return MODEL_ROUTING[tier][agentId];
  }

  /**
   * Get credit cost for an operation (for pre-execution estimates).
   */
  getCreditCost(operationType: string, model?: string): number {
    const base = CREDIT_COSTS[operationType] ?? 5;
    return model?.includes('opus') ? base * 2 : base;
  }

  /**
   * Get all available operation types and their credit costs.
   */
  getCreditCostTable(): Record<string, number> {
    return { ...CREDIT_COSTS };
  }

  // ── Private Methods ────────────────────────────────────────────

  private async checkAndDeductCredits(
    userId: string,
    cost: number
  ): Promise<void> {
    const result = await query(
      `SELECT credits_remaining, subscription_tier, monthly_credit_cap
       FROM user_credit_balances
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // No credit record — allow through (new user or pre-billing setup)
      logger.warn('No credit balance found for user, allowing through', {
        userId,
      });
      return;
    }

    const balance = result.rows[0];

    if (balance.credits_remaining < cost) {
      // Check if overage is allowed (has a credit cap set)
      if (balance.monthly_credit_cap === null) {
        // Overage allowed — Stripe meters will capture it
        logger.info('User in overage, Stripe metering active', {
          userId,
          remaining: balance.credits_remaining,
          cost,
        });
      } else if (balance.credits_remaining <= 0) {
        throw new CreditExhaustedError(
          userId,
          balance.credits_remaining,
          cost
        );
      }
    }

    // Deduct credits
    await query(
      `UPDATE user_credit_balances
       SET credits_remaining = credits_remaining - $1,
           credits_used_this_period = credits_used_this_period + $1,
           updated_at = NOW()
       WHERE user_id = $2`,
      [cost, userId]
    );
  }

  private async getUserTier(userId: string): Promise<SubscriptionTier> {
    try {
      const result = await query(
        `SELECT subscription_tier FROM user_credit_balances WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length > 0) {
        return result.rows[0].subscription_tier as SubscriptionTier;
      }
    } catch (error) {
      logger.warn('Failed to get user tier, defaulting to scout', {
        userId,
        error,
      });
    }

    return 'scout';
  }

  private async reportStripeUsage(
    context: AICallContext,
    model: string,
    usage: { input_tokens: number; output_tokens: number }
  ): Promise<void> {
    if (!context.stripeCustomerId || !process.env.STRIPE_SECRET_KEY) {
      return;
    }

    try {
      // Lazy-import Stripe to avoid startup cost if not configured
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      // Report input tokens
      await stripe.billing.meterEvents.create({
        event_name: 'jedi_input_tokens',
        payload: {
          stripe_customer_id: context.stripeCustomerId,
          value: String(usage.input_tokens),
        },
      });

      // Report output tokens
      await stripe.billing.meterEvents.create({
        event_name: 'jedi_output_tokens',
        payload: {
          stripe_customer_id: context.stripeCustomerId,
          value: String(usage.output_tokens),
        },
      });
    } catch (error) {
      logger.error('Failed to report Stripe usage', { error, context });
    }
  }

  private async logUsage(
    context: AICallContext,
    model: string,
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
    },
    creditCost: number,
    latencyMs: number
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO ai_usage_log (
          user_id, stripe_customer_id, deal_id,
          agent_id, operation_type, surface, platform,
          model, input_tokens, output_tokens, cache_read_tokens,
          credits_consumed, latency_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          context.userId,
          context.stripeCustomerId,
          context.dealId || null,
          context.agentId,
          context.operationType,
          context.surface,
          context.platform || null,
          model,
          usage.input_tokens,
          usage.output_tokens,
          usage.cache_read_input_tokens || 0,
          creditCost,
          latencyMs,
        ]
      );
    } catch (error) {
      logger.error('Failed to log AI usage', { error, context });
    }
  }
}

// Singleton export
export const jediAI = new JediAIService();
