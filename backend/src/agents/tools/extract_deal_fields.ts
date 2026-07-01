import { z } from 'zod';

/**
 * extract_deal_fields
 *
 * Structured field extraction from email body + OCR text.
 * Uses claude-haiku-4-5 with a tight JSON output schema.
 * All fields are optional — partial extraction is better than failure.
 *
 * Two call paths — same prompt, different metering:
 *  1. tool.execute(input, ctx) — called by AgentRuntime; routes through
 *     MeteringAdapter so the Haiku cost appears in ai_usage_log and
 *     Stripe billing meters alongside the main-loop DeepSeek cost.
 *  2. extractDealFields(subject, body, ocr) — standalone helper;
 *     called directly by email.routes.ts and inngest email-intake function
 *     (platform-absorbed / event-bucket paths). Uses direct anthropic client.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../utils/logger';
import { meteringAdapter } from '../runtime/MeteringAdapter';
import type { MeteringMetadata, RunContext } from '../runtime/types';

export interface ExtractedDealFields {
  address: string | null;
  city: string | null;
  state: string | null;
  asking_price: number | null;
  units: number | null;
  asset_class: string | null;
  year_built: number | null;
  noi: number | null;
  cap_rate: number | null;
  occupancy: number | null;
  property_type: string | null;
  sqft: number | null;
  deal_name: string | null;
}

const EXTRACT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TEXT_CHARS = 3000;

const anthropic = new Anthropic({
  apiKey:
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_API_KEY,
});

// ── Shared prompt builders ────────────────────────────────────────

function buildExtractSystemPrompt(): string {
  return 'You are a commercial real estate data extractor. Return ONLY valid JSON, no other text.';
}

function buildExtractUserPrompt(
  subject: string,
  bodyText: string,
  ocrText?: string
): string {
  const combined = [
    `Subject: ${subject}`,
    '',
    'Email Body:',
    bodyText.slice(0, MAX_TEXT_CHARS),
    ocrText ? `\nDocument Text:\n${ocrText.slice(0, MAX_TEXT_CHARS)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `Extract commercial real estate deal fields from this content. Return null for any field not found.

${combined}

Return JSON with this exact shape (all fields optional, use null if not found):
{
  "address": "full street address or null",
  "city": "city name or null",
  "state": "2-letter state code or null",
  "asking_price": number in dollars or null,
  "units": integer unit count or null,
  "asset_class": "multifamily"|"office"|"retail"|"industrial"|"mixed_use"|"land"|"hotel"|"self_storage"|null,
  "year_built": 4-digit year integer or null,
  "noi": annual net operating income in dollars or null,
  "cap_rate": cap rate as decimal 0-1 (e.g. 0.055 for 5.5%) or null,
  "occupancy": occupancy rate as decimal 0-1 or null,
  "property_type": short descriptor or null,
  "sqft": total square footage integer or null,
  "deal_name": short deal name (address or property name) or null
}`;
}

function parseExtractResponse(parsed: ExtractedDealFields): ExtractedDealFields {
  return {
    address: parsed.address ?? null,
    city: parsed.city ?? null,
    state: parsed.state ?? null,
    asking_price: typeof parsed.asking_price === 'number' ? parsed.asking_price : null,
    units: typeof parsed.units === 'number' ? Math.round(parsed.units) : null,
    asset_class: parsed.asset_class ?? null,
    year_built: typeof parsed.year_built === 'number' ? parsed.year_built : null,
    noi: typeof parsed.noi === 'number' ? parsed.noi : null,
    cap_rate: typeof parsed.cap_rate === 'number' ? parsed.cap_rate : null,
    occupancy: typeof parsed.occupancy === 'number' ? parsed.occupancy : null,
    property_type: parsed.property_type ?? null,
    sqft: typeof parsed.sqft === 'number' ? Math.round(parsed.sqft) : null,
    deal_name: parsed.deal_name ?? null,
  };
}

const extractFallback: ExtractedDealFields = {
  address: null, city: null, state: null, asking_price: null, units: null,
  asset_class: null, year_built: null, noi: null, cap_rate: null,
  occupancy: null, property_type: null, sqft: null, deal_name: null,
};

// ── Path 1: Standalone (email.routes.ts, inngest email-intake) ────
//
// PLATFORM-ABSORBED (inngest event bucket) or ATTRIBUTED-NOT-METERED
// (email.routes.ts). Does NOT route through MeteringAdapter because
// these callers have no RunContext and the cost is either absorbed
// by platform (inngest) or billed through a separate route metering
// dispatch (future email-route metering).

/**
 * Extract structured deal fields from email body and optional OCR text.
 * Returns partial results — missing fields are null.
 *
 * Standalone variant — no RunContext, uses direct Anthropic client.
 * Called by email.routes.ts and inngest email-intake function.
 */
export async function extractDealFields(
  subject: string,
  bodyText: string,
  ocrText?: string
): Promise<ExtractedDealFields> {
  try {
    const response = await anthropic.messages.create({
      model: EXTRACT_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: buildExtractUserPrompt(subject, bodyText, ocrText) }],
      system: buildExtractSystemPrompt(),
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    return parseExtractResponse(JSON.parse(text) as ExtractedDealFields);
  } catch (err) {
    logger.warn('extract_deal_fields: LLM call or parse failed', { err });
    return extractFallback;
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

async function extractViaAgentTool(
  input: { body_text: string; source_type?: 'email' | 'ocr' | 'pdf_text' },
  ctx: RunContext
): Promise<ExtractedDealFields> {
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
      model: EXTRACT_MODEL,
      system: buildExtractSystemPrompt(),
      messages: [{ role: 'user', content: buildExtractUserPrompt('', input.body_text) }],
      max_tokens: 512,
      metadata,
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    return parseExtractResponse(JSON.parse(text) as ExtractedDealFields);
  } catch (err) {
    logger.warn('extract_deal_fields (tool): LLM call or parse failed', { err });
    return extractFallback;
  }
}

export const extractDealFieldsTool = {
  name: 'extract_deal_fields',
  description: `Extract structured deal fields from email body or OCR text.
Uses claude-haiku with a tight JSON output schema.
All fields optional — partial extraction is better than failure.
Returns: address, city, state, asking_price, units, asset_class, year_built, noi, cap_rate, occupancy, etc.`,
  inputSchema: z.object({
    body_text: z.string().describe('Email body or OCR-extracted text'),
    source_type: z.enum(['email', 'ocr', 'pdf_text']).optional().default('email'),
  }),
  outputSchema: z.object({
    address: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    asking_price: z.number().nullable(),
    units: z.number().nullable(),
    asset_class: z.string().nullable(),
    year_built: z.number().nullable(),
    noi: z.number().nullable(),
    cap_rate: z.number().nullable(),
    occupancy: z.number().nullable(),
    property_type: z.string().nullable(),
    sqft: z.number().nullable(),
    deal_name: z.string().nullable(),
  }),
  // Signature matches ToolDefinition.execute: (input: TInput, ctx: RunContext) => Promise<TOutput>
  // Routes through MeteringAdapter — Haiku cost attributed to the parent agent run.
  execute: extractViaAgentTool,
};
