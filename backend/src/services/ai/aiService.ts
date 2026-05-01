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
import { modelPreferenceService, getModelFamily, getSurfaceDefault } from './modelPreferenceService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Model Routing per Tier ─────────────────────────────────────

type ModelRouting = Record<SubscriptionTier, Record<AgentId, string>>;

const MODEL_ROUTING: ModelRouting = {
  scout: {
    research: 'deepseek-chat',
    zoning: 'deepseek-chat',
    supply: 'deepseek-chat',
    cashflow: 'deepseek-chat',
    coordinator: 'deepseek-chat',
    commentary: 'deepseek-chat',
  },
  operator: {
    research: 'deepseek-chat',
    zoning: 'deepseek-chat',
    supply: 'deepseek-chat',
    cashflow: 'deepseek-chat',
    coordinator: 'deepseek-chat',
    commentary: 'deepseek-chat',
  },
  principal: {
    research: 'deepseek-chat',
    zoning: 'deepseek-chat',
    supply: 'deepseek-chat',
    cashflow: 'deepseek-chat',
    coordinator: 'deepseek-chat',
    commentary: 'deepseek-chat',
  },
  institutional: {
    research: 'deepseek-chat',
    zoning: 'deepseek-chat',
    supply: 'deepseek-chat',
    cashflow: 'deepseek-chat',
    coordinator: 'deepseek-chat',
    commentary: 'deepseek-chat',
  },
};

// Per-surface default models for non-agent surfaces (pipelines + skills).
// Sourced from the SURFACES registry in modelPreferenceService so the
// settings UI and the resolver agree. Adding new non-agent surfaces only
// requires updating SURFACES; this map is kept narrow because aiService
// only routes to non-agent surfaces when the caller passes routingSurface.
const SURFACE_DEFAULTS: Record<string, string> = {
  'pipeline:om_parsing':                  getSurfaceDefault('pipeline', 'om_parsing'),
  'pipeline:email_intake_classification': getSurfaceDefault('pipeline', 'email_intake_classification'),
  'pipeline:document_classification':     getSurfaceDefault('pipeline', 'document_classification'),
  'skill:document_extraction':            getSurfaceDefault('skill', 'document_extraction'),
  'skill:cfo':                            getSurfaceDefault('skill', 'cfo'),
  'skill:debt_advisor':                   getSurfaceDefault('skill', 'debt_advisor'),
  'skill:tax_advisor':                    getSurfaceDefault('skill', 'tax_advisor'),
  'skill:market_expert':                  getSurfaceDefault('skill', 'market_expert'),
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
  commentary_generation: 2,
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
    // Route through the Replit-managed ModelFarm proxy when configured
    // (AI_INTEGRATIONS_*). The Anthropic SDK only auto-reads ANTHROPIC_BASE_URL,
    // so we must pass baseURL explicitly — otherwise every Claude call goes to
    // api.anthropic.com directly with a proxy-issued key and fails auth.
    this.anthropic = new Anthropic({
      apiKey:
        process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.CLAUDE_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || undefined,
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
    // 1. Resolve model from user tier + agent + per-surface override
    const tier = await this.getUserTier(context.userId);
    const model = await this.resolveModel(
      context.userId,
      tier,
      context.agentId,
      context.routingSurface
    );

    // 2. Check + deduct credits
    const creditCost = this.getCreditCost(context.operationType, model);
    await this.checkAndDeductCredits(context.userId, creditCost);

    // 3. Dispatch to provider
    const startTime = Date.now();
    const family = getModelFamily(model);
    // Track the model that actually served the request — may differ from
    // `model` (the resolved preference) if we had to fall back due to a
    // capability mismatch (e.g. DeepSeek + tools).
    let effectiveModel = model;

    let response: Anthropic.Message;
    if (family === 'deepseek') {
      // DeepSeek path: tools not supported here; if caller passed tools we fall
      // back to Sonnet to preserve correctness rather than silently dropping them.
      if (options?.tools && options.tools.length > 0) {
        effectiveModel = 'claude-sonnet-4-5';
        logger.warn('DeepSeek dispatch requested with tools; falling back to Sonnet', {
          userId: context.userId, surface: context.routingSurface, requestedModel: model, effectiveModel,
        });
        response = await this.anthropic.messages.create({
          model: effectiveModel,
          max_tokens: options?.maxTokens ?? 4096,
          system: systemPrompt,
          messages,
          tools: options.tools,
          temperature: options?.temperature ?? 0,
        });
      } else {
        response = await this.callDeepSeek(model, systemPrompt, messages, options);
      }
    } else {
      response = await this.anthropic.messages.create({
        model,
        max_tokens: options?.maxTokens ?? 4096,
        system: systemPrompt,
        messages,
        tools: options?.tools,
        temperature: options?.temperature ?? 0,
      });
    }

    const latencyMs = Date.now() - startTime;

    // 4. Report usage to Stripe meter (uses effective model for accurate attribution)
    await this.reportStripeUsage(context, effectiveModel, response.usage);

    // 5. Log to internal analytics (records the model that actually ran)
    await this.logUsage(context, effectiveModel, response.usage, creditCost, latencyMs);

    return response;
  }

  /**
   * Call DeepSeek's OpenAI-compatible API and shape the response into an
   * Anthropic.Message-shaped object so callers don't need to branch.
   * Supports text-in/text-out only (no tool calls).
   */
  private async callDeepSeek(
    model: string,
    systemPrompt: string,
    messages: Anthropic.MessageParam[],
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<Anthropic.Message> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');

    const oaMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    for (const m of messages) {
      const text = typeof m.content === 'string'
        ? m.content
        : m.content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('\n');
      oaMessages.push({ role: m.role, content: text });
    }

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: oaMessages,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`DeepSeek API error ${res.status}: ${body.slice(0, 500)}`);
    }

    const data = await res.json() as any;
    const text: string = data.choices?.[0]?.message?.content ?? '';
    const usage = data.usage ?? {};

    return {
      id: data.id ?? 'deepseek-' + Date.now(),
      type: 'message',
      role: 'assistant',
      model,
      content: [{ type: 'text', text }],
      stop_reason: data.choices?.[0]?.finish_reason === 'length' ? 'max_tokens' : 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: usage.prompt_tokens ?? 0,
        output_tokens: usage.completion_tokens ?? 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: usage.prompt_cache_hit_tokens ?? 0,
      },
    } as unknown as Anthropic.Message;
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
    // Pass routingSurface so per-surface preferences and SURFACE_DEFAULTS
    // apply to streamed calls too — otherwise streaming silently bypasses
    // any non-agent override the user set in /settings.
    let model = await this.resolveModel(
      context.userId,
      tier,
      context.agentId,
      context.routingSurface
    );

    // The streaming path only supports Anthropic. If the resolved model is
    // a DeepSeek model (now the default for research/supply), fall back to a
    // tier-appropriate Claude model so the stream still works. Non-streaming
    // generate() handles DeepSeek natively.
    if (getModelFamily(model) === 'deepseek') {
      const fallback = MODEL_ROUTING[tier]?.[context.agentId];
      const claudeFallback =
        fallback && getModelFamily(fallback) === 'claude'
          ? fallback
          : 'claude-sonnet-4-5';
      logger.info('JediAIService.stream: DeepSeek not supported in stream path, falling back to Claude', {
        requested: model,
        fallback: claudeFallback,
        agentId: context.agentId,
      });
      model = claudeFallback;
    }

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
    } as any);
    await this.logUsage(
      context,
      model,
      {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      } as any,
      creditCost,
      0
    );
  }

  /**
   * Direct round-trip against a specific model, bypassing preference
   * resolution and credit deduction. Used by the settings UI's
   * "Test with this model" button so the user can validate a choice
   * without persisting it.
   */
  async testModel(
    model: string,
    prompt: string
  ): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number }; latencyMs: number }> {
    const start = Date.now();
    const family = getModelFamily(model);
    if (family === 'deepseek') {
      const msg = await this.callDeepSeek(
        model,
        'You are a model self-check. Reply with one short sentence.',
        [{ role: 'user', content: prompt }],
        { maxTokens: 60, temperature: 0 }
      );
      const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
      return {
        text,
        usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens },
        latencyMs: Date.now() - start,
      };
    }
    const msg = await this.anthropic.messages.create({
      model,
      max_tokens: 60,
      system: 'You are a model self-check. Reply with one short sentence.',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
    return {
      text,
      usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens },
      latencyMs: Date.now() - start,
    };
  }

  /**
   * Get the model that would be used for a given context.
   */
  async getModelForContext(
    userId: string,
    agentId: AgentId
  ): Promise<string> {
    const tier = await this.getUserTier(userId);
    return this.resolveModel(userId, tier, agentId);
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

  private static readonly PREFERENCE_MODEL_MAP: Record<string, string> = {
    cheap: 'deepseek-chat',
    fast: 'claude-haiku-4-5-20251001',
    balanced: 'claude-sonnet-4-5',
    powerful: 'claude-opus-4-5',
  };

  private async resolveModel(
    userId: string,
    tier: SubscriptionTier,
    agentId: AgentId,
    routingSurface?: { type: 'agent' | 'skill' | 'pipeline'; id: string }
  ): Promise<string> {
    const surface = routingSurface ?? { type: 'agent' as const, id: agentId };
    const surfaceKey = `${surface.type}:${surface.id}`;
    const defaultModel =
      surface.type !== 'agent' && SURFACE_DEFAULTS[surfaceKey]
        ? SURFACE_DEFAULTS[surfaceKey]
        : MODEL_ROUTING[tier][agentId];
    return modelPreferenceService.resolveModel({
      userId,
      surfaceType: surface.type,
      surfaceId: surface.id,
      defaultModel,
      tier,
    });
  }

  private async checkAndDeductCredits(
    userId: string,
    cost: number
  ): Promise<void> {
    // Internal/system calls (no end-user) pass empty/null userId. Skip
    // metering for those — they're owned by the platform, not a billable
    // user. This is the documented "legacy path" for parseOM / agent
    // pipelines that run outside a user request.
    if (!userId) {
      logger.debug('checkAndDeductCredits: skipping metering for internal call (no userId)', {
        cost,
      });
      return;
    }

    // Fail fast on non-UUID userIds (e.g. 'pipeline', 'system') — those are
    // programmer mistakes, not legitimate internal calls. Callers get a
    // clear error instead of an opaque Postgres "invalid input syntax for
    // type uuid" 500 that surfaces as a silently-failed extraction.
    if (!UUID_RE.test(userId)) {
      throw new Error(
        `JediAIService.checkAndDeductCredits: userId must be a UUID or empty string, got "${userId}". ` +
        `Pass the real uploadedBy/owner userId from your route, or empty string for internal/system calls.`
      );
    }

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
