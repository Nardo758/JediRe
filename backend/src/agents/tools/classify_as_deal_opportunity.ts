import { z } from 'zod';

/**
 * classify_as_deal_opportunity
 *
 * Single LLM call (claude-haiku-4-5) to classify whether an email is a
 * deal opportunity (OM, teaser, offering, etc.) vs general correspondence.
 *
 * Uses a tightly constrained prompt (<= 1000 tokens) for cost efficiency.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../utils/logger';

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

/**
 * Classifies an email as a deal opportunity or not.
 * Truncates email body to 1500 chars to keep the prompt under 1000 tokens.
 */
export async function classifyAsDealOpportunity(
  subject: string,
  bodyText: string,
  fromAddress: string
): Promise<DealClassification> {
  const truncatedBody = bodyText.slice(0, MAX_BODY_CHARS);

  const systemPrompt =
    'You are a real estate deal classifier. Return ONLY valid JSON, no other text.';

  const userPrompt = `Classify this email as a commercial real estate deal opportunity or not.

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

  try {
    const response = await anthropic.messages.create({
      model: CLASSIFY_MODEL,
      max_tokens: 256,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    const parsed = JSON.parse(text) as DealClassification;

    return {
      is_deal: Boolean(parsed.is_deal),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      asset_class_hint: String(parsed.asset_class_hint || 'unknown'),
      reason: String(parsed.reason || ''),
    };
  } catch (err) {
    logger.warn('classify_as_deal_opportunity: LLM call or parse failed', { err });
    return {
      is_deal: false,
      confidence: 0,
      asset_class_hint: 'unknown',
      reason: 'classification failed',
    };
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
  execute: classifyAsDealOpportunity,
};
