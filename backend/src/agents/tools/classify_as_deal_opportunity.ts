import { z } from 'zod';

/**
 * classify_as_deal_opportunity
 *
 * Single LLM call (claude-haiku-4-5) to classify whether an email is a
 * deal opportunity (OM, teaser, offering, etc.) vs general correspondence.
 *
 * Uses a tightly constrained prompt (<= 1000 tokens) for cost efficiency.
 *
 * Two call paths — same prompt, different metering:
 *  1. tool.execute(input, ctx) — called by AgentRuntime; routes through
 *     MeteringAdapter so the Haiku cost appears in ai_usage_log and
 *     Stripe billing meters alongside the main-loop DeepSeek cost.
 *  2. classifyAsDealOpportunity(subject, body, from) — standalone helper;
 *     called directly by email.routes.ts and inngest email-intake function
 *     (platform-absorbed / event-bucket paths). Uses direct anthropic client.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../utils/logger';
import { meteringAdapter } from '../runtime/MeteringAdapter';
import type { MeteringMetadata, RunContext } from '../runtime/types';

export interface DealClassification {
  is_deal: boolean;
  confidence: number;
  asset_class_hint: string;
  reason: string;
}

const CLASSIFY_MODEL = 'claude-haiku-4-5-20251001';
const MAX_BODY_CHARS = 1500;

const anthropic = new Anthropic({
  apiKey:
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_API_KEY,
});

// ── Shared prompt builders ────────────────────────────────────────

function buildClassifySystemPrompt(): string {
  return 'You are a real estate deal classifier. Return ONLY valid JSON, no other text.';
}

function buildClassifyUserPrompt(
  subject: string,
  truncatedBody: string,
  fromAddress: string
): string {
  return `Classify this email as a commercial real estate deal opportunity or not.

From: ${fromAddress}
Subject: ${subject}
Body (truncated): ${truncatedBody}

Return JSON with this exact shape:
{
  "is_deal": true|false,
  "confidence": 0.0-1.0,
  "asset_class_hint": "multifamily"|"office"|"retail"|"industrial"|"mixed_use"|"land"|"hotel"|"self_storage"|"unknown",
  "reason": "one sentence explanation"
}

A deal email includes: offering memorandums, investment teasers, broker listings, sale opportunities, acquisition opportunities, property marketing packages. NOT a deal: newsletters, general inquiry, utility bills, legal notices, service solicitations.`;
}

function parseClassifyResponse(text: string): DealClassification {
  const parsed = JSON.parse(text) as DealClassification;
  return {
    is_deal: Boolean(parsed.is_deal),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    asset_class_hint: String(parsed.asset_class_hint || 'unknown'),
    reason: String(parsed.reason || ''),
  };
}

const classifyFallback: DealClassification = {
  is_deal: false,
  confidence: 0,
  asset_class_hint: 'unknown',
  reason: 'classification failed',
};

// ── Path 1: Standalone (email.routes.ts, inngest email-intake) ────
//
// PLATFORM-ABSORBED (inngest event bucket) or ATTRIBUTED-NOT-METERED
// (email.routes.ts). Does NOT route through MeteringAdapter because
// these callers have no RunContext and the cost is either absorbed
// by platform (inngest) or billed through a separate route metering
// dispatch (future email-route metering).

/**
 * Classifies an email as a deal opportunity or not.
 * Truncates email body to 1500 chars to keep the prompt under 1000 tokens.
 *
 * Standalone variant — no RunContext, uses direct Anthropic client.
 * Called by email.routes.ts and inngest email-intake function.
 */
export async function classifyAsDealOpportunity(
  subject: string,
  bodyText: string,
  fromAddress: string
): Promise<DealClassification> {
  const truncatedBody = bodyText.slice(0, MAX_BODY_CHARS);

  try {
    const response = await anthropic.messages.create({
      model: CLASSIFY_MODEL,
      max_tokens: 256,
      messages: [{ role: 'user', content: buildClassifyUserPrompt(subject, truncatedBody, fromAddress) }],
      system: buildClassifySystemPrompt(),
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    return parseClassifyResponse(text);
  } catch (err) {
    logger.warn('classify_as_deal_opportunity: LLM call or parse failed', { err });
    return classifyFallback;
  }
}

// ── Path 2: Tool execute (AgentRuntime tool loop) ─────────────────
//
// METERED — routes through MeteringAdapter.createMessage() so the
// Haiku token cost is logged to ai_usage_log and reported to Stripe
// billing meters (jedi_input_tokens, jedi_output_tokens, jedi_ai_cost_usd)
// alongside the main-loop DeepSeek cost. Attribution inherits the parent
// agent run's user_id / deal_id / agent_run_id / triggered_by bucket.
//
// No double-count risk: main loop = DeepSeek via DeepSeekMeteringAdapter;
// this tool call = Anthropic Haiku via MeteringAdapter. Separate API calls
// to separate providers; ON CONFLICT DO NOTHING guards idempotency.

async function classifyViaAgentTool(
  input: { subject: string; body_text: string; from_address?: string },
  ctx: RunContext
): Promise<DealClassification> {
  const truncatedBody = input.body_text.slice(0, MAX_BODY_CHARS);

  const metadata: MeteringMetadata = {
    actor_type: 'agent',
    actor_id: ctx.agentId ?? 'research',
    agent_run_id: ctx.correlationId,
    deal_id: ctx.dealId,
    user_id: ctx.userId,
    triggered_by: ctx.triggeredBy,
  };

  try {
    const response = await meteringAdapter.createMessage({
      model: CLASSIFY_MODEL,
      system: buildClassifySystemPrompt(),
      messages: [{ role: 'user', content: buildClassifyUserPrompt(input.subject, truncatedBody, input.from_address ?? '') }],
      max_tokens: 256,
      metadata,
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    return parseClassifyResponse(text);
  } catch (err) {
    logger.warn('classify_as_deal_opportunity (tool): LLM call or parse failed', { err });
    return classifyFallback;
  }
}

export const classifyAsDealOpportunityTool = {
  name: 'classify_as_deal_opportunity',
  description: `Classify whether an email or text is a deal opportunity (OM, teaser, offering).
Uses claude-haiku for cost-efficient binary classification.
Returns: is_deal (boolean), confidence (0-1), asset_class_hint, reason.`,
  inputSchema: z.object({
    subject: z.string().describe('Email subject line'),
    body_text: z.string().describe('Full email body text (up to 1500 chars)'),
    from_address: z.string().optional().describe('Sender email address'),
  }),
  outputSchema: z.object({
    is_deal: z.boolean(),
    confidence: z.number(),
    asset_class_hint: z.string(),
    reason: z.string(),
  }),
  // Signature matches ToolDefinition.execute: (input: TInput, ctx: RunContext) => Promise<TOutput>
  // Routes through MeteringAdapter — Haiku cost attributed to the parent agent run.
  execute: classifyViaAgentTool,
};
