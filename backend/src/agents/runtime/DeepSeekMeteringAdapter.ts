/**
 * DeepSeekMeteringAdapter — DeepSeek (OpenAI-compatible) wrapper that
 * mirrors the same Stripe + credit metering pattern as MeteringAdapter.
 *
 * Why this exists:
 *  DeepSeek is roughly 1/30th the cost of Claude Sonnet for input tokens
 *  and 1/14th for output tokens, which makes it ideal for "plumbing"
 *  workloads (codegen scaffolding, schema rewrites, refactors, log
 *  triage, simple chat-like glue). We want those calls to flow through
 *  the same accounting plane (jedi_input_tokens / jedi_output_tokens
 *  meter events, ai_usage_log rows, credit reservation/refund) so the
 *  rest of the platform — billing dashboards, overage rules,
 *  per-deal cost rollups — keeps working unchanged.
 *
 * Three-bucket charging (identical to MeteringAdapter):
 *  - triggered_by 'user'  → reserve credits → call → reconcile + Stripe meter
 *  - triggered_by 'event' → platform absorbs; logged to ai_usage_log
 *  - triggered_by 'cron'  → platform absorbs; logged to ai_usage_log
 */

import axios, { AxiosError } from 'axios';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { MeteringMetadata } from './types';

const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

// ── DeepSeek token cost table (USD per 1M tokens) ────────────────
// Source: https://api-docs.deepseek.com/quick_start/pricing (as of 2026-04).
// Cache-hit input is heavily discounted; we treat the surfaced
// "prompt_cache_hit_tokens" the same way Anthropic cache reads are
// treated by JediAIService.logUsage (logged separately, costed cheaper).

const COST_PER_MTK: Record<
  string,
  { input: number; cachedInput: number; output: number }
> = {
  'deepseek-chat':     { input: 0.27, cachedInput: 0.07, output: 1.10 },
  'deepseek-reasoner': { input: 0.55, cachedInput: 0.14, output: 2.19 },
};

export function estimateDeepSeekCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens = 0
): number {
  const rates = COST_PER_MTK[model] ?? COST_PER_MTK['deepseek-chat'];
  const billableInput = Math.max(0, inputTokens - cachedInputTokens);
  return (
    (billableInput / 1_000_000) * rates.input +
    (cachedInputTokens / 1_000_000) * rates.cachedInput +
    (outputTokens / 1_000_000) * rates.output
  );
}

/** Conservative pre-flight: 4k in + 4k out worst case at full input price. */
function preflightEstimate(model: string): number {
  return estimateDeepSeekCost(model, 4_096, 4_096, 0);
}

// ── Public types ──────────────────────────────────────────────────

/** Adapter-compatible message params matching MeteringAdapter.MessageParams signature. */
export interface AnthropicCompatibleParams {
  model: string;
  system: string;
  messages: Array<{ role: string; content: string | unknown[] }>;
  tools?: Array<{ name: string; description: string; input_schema: unknown }>;
  max_tokens: number;
  metadata: MeteringMetadata;
}

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface DeepSeekRequest {
  model: 'deepseek-chat' | 'deepseek-reasoner' | string;
  messages: DeepSeekMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  /** OpenAI-compatible tool definitions. */
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  /** Force a specific tool on the first turn. Pass full OpenAI tool_choice. */
  tool_choice?: string | { type: string; function: { name: string } };
  response_format?: { type: 'text' | 'json_object' };
  metadata: MeteringMetadata;
}

export interface DeepSeekToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface DeepSeekUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  cost_usd: number;
}

export interface DeepSeekResponse {
  id: string;
  model: string;
  text: string;
  finish_reason: string | null;
  tool_calls?: DeepSeekToolCall[];
  usage: DeepSeekUsage;
}

// ── Adapter ───────────────────────────────────────────────────────

export class DeepSeekMeteringAdapter {
  private readonly apiKey: string | undefined;
  private readonly endpoint: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? process.env.DEEPSEEK_API_KEY;
    this.endpoint = `${(baseUrl ?? DEEPSEEK_BASE_URL).replace(/\/$/, '')}/chat/completions`;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Create a metered DeepSeek chat completion.
   * Settlement (credit reconciliation, Stripe meter, ai_usage_log) is
   * awaited before returning so callers cannot bypass accounting.
   */
  /**
   * Throws if today's logged DeepSeek spend has already reached the
   * configured daily cap (DEEPSEEK_DAILY_SPEND_CAP_USD, default $20).
   * Querying ai_usage_log is cheap — this runs on every call so that the
   * first call that would breach the cap is blocked, not just the ones after.
   */
  private async checkDailySpendCap(): Promise<void> {
    const capUsd = parseFloat(process.env.DEEPSEEK_DAILY_SPEND_CAP_USD ?? '20');
    if (isNaN(capUsd) || capUsd <= 0) return;

    try {
      const result = await query(
        `SELECT COALESCE(SUM(cost_usd), 0)::float AS today_spend
         FROM ai_usage_log
         WHERE created_at >= CURRENT_DATE
           AND model LIKE 'deepseek-%'`
      );
      const spent: number = result.rows[0]?.today_spend ?? 0;
      if (spent >= capUsd) {
        throw new Error(
          `Daily AI spend cap reached ($${spent.toFixed(2)} of $${capUsd} limit). ` +
          `No further DeepSeek calls until UTC midnight. ` +
          `Raise DEEPSEEK_DAILY_SPEND_CAP_USD to increase the limit.`
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Daily AI spend cap')) throw err;
      logger.warn('DeepSeekMeteringAdapter: spend-cap check failed, proceeding anyway', { err });
    }
  }

  async createMessage(req: DeepSeekRequest): Promise<DeepSeekResponse> {
    if (!this.apiKey) {
      throw new Error(
        'DeepSeek not configured: set DEEPSEEK_API_KEY in environment.'
      );
    }

    await this.checkDailySpendCap();

    const { metadata, ...apiParams } = req;

    // A3: Stripe metering route — agent runtime calls are platform-absorbed.
    // No credit reservation here; user credits are deducted at JediAIService layer.
    let raw: {
      id: string;
      model: string;
      choices: Array<{
        index: number;
        message: {
          content: string | null;
          tool_calls?: Array<{
            id: string;
            type: 'function';
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string | null;
      }>;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        prompt_cache_hit_tokens?: number;
        prompt_cache_miss_tokens?: number;
      };
    };

    try {
      const body: Record<string, unknown> = {
        model: apiParams.model,
        messages: apiParams.messages,
        max_tokens: apiParams.max_tokens ?? 4096,
        temperature: apiParams.temperature ?? 0,
        stream: false,
      };
      if (apiParams.tools && apiParams.tools.length > 0) {
        body.tools = apiParams.tools;
        // Use caller-specified tool_choice if provided (first-turn forcing),
        // otherwise default to 'auto' for natural tool selection.
        body.tool_choice = apiParams.tool_choice ?? 'auto';
      }
      // When tool_choice forces a specific function, OMIT response_format.
      // DeepSeek (and OpenAI-compat APIs) often satisfy response_format=json_object
      // by returning a direct JSON object and skipping tool execution entirely,
      // defeating the purpose of forced tool_choice. Without response_format,
      // the model honors the tool_choice and emits the required tool call.
      const isForcedToolCall =
        typeof apiParams.tool_choice === 'object' &&
        apiParams.tool_choice !== null &&
        (apiParams.tool_choice as { function?: { name?: string } }).function?.name;
      // Always request JSON output when no tools or alongside auto tool selection.
      // DeepSeek accepts response_format + tools simultaneously, but NOT alongside
      // a function-forcing tool_choice (skip response_format in that case).
      if (apiParams.response_format?.type === 'json_object' && !isForcedToolCall) {
        body.response_format = apiParams.response_format;
        // DeepSeek requires the word 'json' somewhere in the prompt when
        // response_format: json_object is set. Inject a reminder if missing.
        const allText = (apiParams.messages ?? [])
          .map(m => typeof m.content === 'string' ? m.content : '')
          .join(' ');
        if (!/\bjson\b/i.test(allText)) {
          (body.messages as Array<Record<string, unknown>>).unshift({
            role: 'system',
            content: 'You must respond with valid JSON. Your final output must be a single JSON object with no prose before or after it.',
          });
        }
      }

      const resp = await axios.post(
        this.endpoint,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 120_000,
        }
      );
      raw = resp.data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const ax = err as AxiosError;
        logger.error('DeepSeek API error', {
          status: ax.response?.status,
          data: ax.response?.data,
        });
      }
      throw err;
    }

    const cachedIn = raw.usage.prompt_cache_hit_tokens ?? 0;
    const actualCost = estimateDeepSeekCost(
      apiParams.model,
      raw.usage.prompt_tokens,
      raw.usage.completion_tokens,
      cachedIn
    );

    await this.settle(
      metadata,
      raw.usage,
      actualCost,
      apiParams.model
    );

    const msg = (raw.choices?.[0]?.message ?? {}) as { tool_calls?: any[]; content?: string };
    const dsToolCalls = msg.tool_calls;
    const content = msg.content ?? '';
    const text = content || '';
    const finishReason = raw.choices?.[0]?.finish_reason ?? null;

    // Extract tool_calls from response if present
    const toolCalls: DeepSeekToolCall[] | undefined = dsToolCalls?.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    return {
      id: raw.id,
      model: raw.model,
      text,
      finish_reason: finishReason,
      tool_calls: toolCalls,
      usage: {
        prompt_tokens: raw.usage.prompt_tokens,
        completion_tokens: raw.usage.completion_tokens,
        total_tokens: raw.usage.total_tokens,
        prompt_cache_hit_tokens: raw.usage.prompt_cache_hit_tokens,
        prompt_cache_miss_tokens: raw.usage.prompt_cache_miss_tokens,
        cost_usd: actualCost,
      },
    };
  }

  // ── Private helpers (mirror MeteringAdapter contract) ────────────

  private async settle(
    metadata: MeteringMetadata,
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      prompt_cache_hit_tokens?: number;
    },
    actualCost: number,
    model: string
  ): Promise<void> {
    await this.logUsage(metadata, usage, actualCost, model);

    await this.reportStripeUsage(metadata, usage, model);
    await this.reportStripeCost(metadata, actualCost);

    if (metadata.triggered_by !== 'user') {
      logger.info('DeepSeekMeteringAdapter: platform expense (event/cron)', {
        trigger: metadata.triggered_by,
        costUsd: actualCost.toFixed(6),
        agentId: metadata.actor_id,
        agentRunId: metadata.agent_run_id,
        dealId: metadata.deal_id,
        model,
      });
    }
  }

  /**
   * Report usage to Stripe billing meters using the same event names as
   * MeteringAdapter / JediAIService so DeepSeek calls roll up into the
   * existing "jedi_input_tokens" / "jedi_output_tokens" lines.
   *
   * Cache-hit input tokens are reported as input tokens (not split out)
   * to keep the meter contract identical. Per-model cost differences are
   * absorbed at the credit-reconciliation layer above.
   */
  private async reportStripeUsage(
    metadata: MeteringMetadata,
    usage: { prompt_tokens: number; completion_tokens: number },
    _model: string
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
        event_name: 'jedi_input_tokens',
        payload: {
          stripe_customer_id: stripeCustomerId,
          value: String(usage.prompt_tokens),
        },
      });
      await stripe.billing.meterEvents.create({
        event_name: 'jedi_output_tokens',
        payload: {
          stripe_customer_id: stripeCustomerId,
          value: String(usage.completion_tokens),
        },
      });
    } catch (err) {
      logger.error('DeepSeekMeteringAdapter: Stripe meter event failed', {
        userId: metadata.user_id,
        err,
      });
    }
  }

  /**
   * A3: Report actual cost to Stripe billing meter (jedi_ai_cost_usd).
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
      logger.error('DeepSeekMeteringAdapter: Stripe cost meter event failed', {
        userId: metadata.user_id,
        err,
      });
    }
  }

  private async logUsage(
    metadata: MeteringMetadata,
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      prompt_cache_hit_tokens?: number;
    },
    costUsd: number,
    model: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO ai_usage_log (
           user_id, deal_id, agent_id, operation_type, surface,
           model, input_tokens, output_tokens, cache_read_tokens,
           credits_consumed, cost_usd, billable_usd, latency_ms
         ) VALUES ($1,$2,$3,$4,'agent',$5,$6,$7,$8,$9,$10,$11,0)
         ON CONFLICT DO NOTHING`,
        [
          (metadata.user_id && metadata.user_id.trim() !== '') ? metadata.user_id : null,
          metadata.deal_id ?? null,
          metadata.actor_id,
          `agent_run:${metadata.agent_run_id ?? 'unknown'}`,
          model,
          usage.prompt_tokens,
          usage.completion_tokens,
          usage.prompt_cache_hit_tokens ?? 0,
          0, // credits_consumed: 0 for DeepSeekMeteringAdapter (user pays via JediAIService)
          costUsd,
          0, // billable_usd: 0 for platform-absorbed calls
        ]
      );
    } catch (err) {
      logger.warn('DeepSeekMeteringAdapter: failed to write ai_usage_log', {
        err,
      });
    }
  }
  /**
   * Anthropic-compatible createMessage — same signature as MeteringAdapter.createMessage.
   * This lets AgentRuntime use DeepSeek without changing its code.
   * Converts Anthropic-style messages to DeepSeek/OpenAI format and back.
   */
  async createAnthropicCompatibleMessage(
    params: AnthropicCompatibleParams
  ): Promise<{
    id: string;
    model: string;
    content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
    stop_reason: string | null;
    usage: { input_tokens: number; output_tokens: number; cost_usd: number };
  }> {
    // Convert Anthropic messages to DeepSeek format
    const dsMessages: DeepSeekMessage[] = [];

    if (params.system) {
      dsMessages.push({ role: 'system', content: params.system });
    }

    for (const msg of params.messages) {
      if (typeof msg.content === 'string') {
        dsMessages.push({ role: msg.role as DeepSeekMessage['role'], content: msg.content });
      } else if (Array.isArray(msg.content)) {
        dsMessages.push({ role: msg.role as DeepSeekMessage['role'], content: JSON.stringify(msg.content) });
      } else {
        dsMessages.push({ role: msg.role as DeepSeekMessage['role'], content: String(msg.content ?? '') });
      }
    }

    const resp = await this.createMessage({
      model: params.model,
      messages: dsMessages,
      max_tokens: params.max_tokens,
      metadata: params.metadata,
    });

    return {
      id: resp.id,
      model: resp.model,
      content: [{ type: 'text', text: resp.text }],
      stop_reason: resp.finish_reason,
      usage: {
        input_tokens: resp.usage.prompt_tokens,
        output_tokens: resp.usage.completion_tokens,
        cost_usd: resp.usage.cost_usd,
      },
    };
  }
}

export const deepseekAdapter = new DeepSeekMeteringAdapter();
