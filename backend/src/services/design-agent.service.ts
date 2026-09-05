/**
 * ═══════════════════════════════════════════════════════════════════
 * DESIGN AGENT SERVICE — GPT-6 Astra Integration
 * ═══════════════════════════════════════════════════════════════════
 *
 * Calls OpenAI GPT-6 Astra (Responses API) with parcel context + user prompt
 * to generate optimal building parameters, unit mix, and reasoning.
 */

import type { BuildingParameters } from '../../../frontend/src/lib/building-engine/types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';

export interface ParcelContext {
  lotSizeSqft: number;
  zoningCode?: string;
  maxHeightFt?: number;
  maxFAR?: number;
  setbacks?: { front: number; side: number; rear: number };
  geometry: GeoJSON.Polygon;
  address: string;
  county: string;
  state: string;
}

export interface DesignAgentResult {
  buildingParams: BuildingParameters;
  reasoning: string;
  unitMix: Record<string, number>;
  totalUnits: number;
  estimatedConstructionCost: number;
  estimatedNOI: number;
  confidence: 'low' | 'medium' | 'high';
}

const SYSTEM_PROMPT = `You are an expert multifamily real estate architect and developer with 30 years of experience. You specialize in optimizing building designs for yield, livability, and zoning compliance.

Given a user's design intent and the parcel's zoning context, generate optimal building parameters. You must respect all zoning constraints. If the user's request violates zoning, explain the constraint and generate the closest feasible design.

Respond ONLY with a JSON object in this exact schema:

{
  "buildingParams": {
    "levels": number (1-20),
    "floorHeight": number (8-16),
    "facade": "brick" | "glass" | "concrete" | "wood_panel" | "stucco" | "mixed",
    "roofType": "flat" | "pitched" | "terraced",
    "setbackFront": number (feet),
    "setbackRear": number (feet),
    "setbackSide": number (feet),
    "windowRatio": number (0.0-1.0),
    "balconyDepth": number (0-10),
    "timeOfDay": "golden_hour" | "midday" | "dusk" | "overcast"
  },
  "reasoning": "string explaining your design decisions",
  "unitMix": { "studio": number, "1br": number, "2br": number, "3br": number },
  "totalUnits": number,
  "estimatedConstructionCost": number (USD),
  "estimatedNOI": number (annual USD),
  "confidence": "low" | "medium" | "high"
}

Rules:
- Total building SF must not exceed lotSize × FAR
- Building height must not exceed maxHeight
- Setbacks must respect minimums; you may increase them for better design
- Window ratio should match facade type (glass = higher, brick = lower)
- Unit mix should match typical market demand for the area
- Construction cost: ~$180-250/sf for mid-rise wood, $280-350/sf for concrete
- NOI: assume 60-65% of EGI after stabilization`;

export async function generateDesign(
  prompt: string,
  parcelContext: ParcelContext
): Promise<DesignAgentResult> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const userContent = `Design intent: ${prompt}\n\nParcel context:\n${JSON.stringify(
    parcelContext,
    null,
    2
  )}`;

  const response = await fetch(`${OPENAI_API_URL}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-6-astra',
      instructions: SYSTEM_PROMPT,
      input: userContent,
      reasoning: { effort: 'medium' },
      text: { format: { type: 'json_object' } },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json();

  // Parse the JSON from the response
  let result: DesignAgentResult;
  try {
    const content = data.output?.[0]?.content?.[0]?.text || data.text;
    const parsed = JSON.parse(content);
    result = {
      buildingParams: parsed.buildingParams,
      reasoning: parsed.reasoning,
      unitMix: parsed.unitMix || {},
      totalUnits: parsed.totalUnits || 0,
      estimatedConstructionCost: parsed.estimatedConstructionCost || 0,
      estimatedNOI: parsed.estimatedNOI || 0,
      confidence: parsed.confidence || 'medium',
    };
  } catch (parseErr: any) {
    console.error('[DesignAgent] Failed to parse response:', data);
    throw new Error(`Failed to parse design agent response: ${parseErr.message}`);
  }

  // Validate and clamp parameters
  result.buildingParams.levels = Math.max(1, Math.min(20, result.buildingParams.levels || 4));
  result.buildingParams.floorHeight = Math.max(8, Math.min(16, result.buildingParams.floorHeight || 12));
  result.buildingParams.windowRatio = Math.max(0, Math.min(1, result.buildingParams.windowRatio || 0.35));
  result.buildingParams.balconyDepth = Math.max(0, Math.min(10, result.buildingParams.balconyDepth || 0));
  result.buildingParams.setbackFront = Math.max(0, result.buildingParams.setbackFront || 10);
  result.buildingParams.setbackRear = Math.max(0, result.buildingParams.setbackRear || 10);
  result.buildingParams.setbackSide = Math.max(0, result.buildingParams.setbackSide || 5);

  return result;
}

/**
 * Mock generator for testing without OpenAI API key.
 */
export function generateDesignMock(
  prompt: string,
  parcelContext: ParcelContext
): DesignAgentResult {
  const prompt_lower = prompt.toLowerCase();
  const levels = prompt_lower.includes('5-story') || prompt_lower.includes('5 story') ? 5 :
    prompt_lower.includes('high-rise') ? 12 :
    prompt_lower.includes('mid-rise') ? 6 : 4;

  const facade = prompt_lower.includes('glass') ? 'glass' :
    prompt_lower.includes('brick') ? 'brick' :
    prompt_lower.includes('concrete') ? 'concrete' :
    prompt_lower.includes('wood') ? 'wood_panel' : 'mixed';

  return {
    buildingParams: {
      levels,
      floorHeight: 12,
      facade: facade as any,
      roofType: 'flat',
      setbackFront: 10,
      setbackRear: 10,
      setbackSide: 5,
      windowRatio: facade === 'glass' ? 0.7 : 0.35,
      balconyDepth: prompt_lower.includes('balcony') ? 6 : 0,
      timeOfDay: 'golden_hour',
    },
    reasoning: `MOCK: Generated ${levels}-story ${facade} building based on prompt "${prompt.slice(0, 50)}...". In production, GPT-6 Astra would analyze zoning, market demand, and optimize for yield.`,
    unitMix: { studio: Math.floor(levels * 2), '1br': Math.floor(levels * 3), '2br': Math.floor(levels * 2), '3br': Math.floor(levels) },
    totalUnits: levels * 8,
    estimatedConstructionCost: levels * 8000000,
    estimatedNOI: levels * 600000,
    confidence: 'medium',
  };
}
