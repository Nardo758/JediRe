/**
 * extract_deal_fields
 *
 * Structured field extraction from email body + OCR text.
 * Uses claude-haiku-4-5 with a tight JSON output schema.
 * All fields are optional — partial extraction is better than failure.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../utils/logger';

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

/**
 * Extract structured deal fields from email body and optional OCR text.
 * Returns partial results — missing fields are null.
 */
export async function extractDealFields(
  subject: string,
  bodyText: string,
  ocrText?: string
): Promise<ExtractedDealFields> {
  const combined = [
    `Subject: ${subject}`,
    '',
    'Email Body:',
    bodyText.slice(0, MAX_TEXT_CHARS),
    ocrText ? `\nDocument Text:\n${ocrText.slice(0, MAX_TEXT_CHARS)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const systemPrompt =
    'You are a commercial real estate data extractor. Return ONLY valid JSON, no other text.';

  const userPrompt = `Extract commercial real estate deal fields from this content. Return null for any field not found.

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

  try {
    const response = await anthropic.messages.create({
      model: EXTRACT_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    const parsed = JSON.parse(text) as ExtractedDealFields;

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
  } catch (err) {
    logger.warn('extract_deal_fields: LLM call or parse failed', { err });
    return {
      address: null, city: null, state: null, asking_price: null, units: null,
      asset_class: null, year_built: null, noi: null, cap_rate: null,
      occupancy: null, property_type: null, sqft: null, deal_name: null,
    };
  }
}
