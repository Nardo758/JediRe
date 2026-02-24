import Anthropic from '@anthropic-ai/sdk';
import { Pool } from 'pg';
import { ZoningKnowledgeService, ZoningDistrictProfile } from './zoning-knowledge.service';

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export interface ReasoningRequest {
  question: string;
  districtCode?: string;
  municipality?: string;
  state?: string;
  parcelContext?: {
    landAreaSf?: number;
    lat?: number;
    lng?: number;
    address?: string;
  };
  dealId?: string;
}

export interface ReasoningResponse {
  answer: string;
  confidence: number;
  reasoning: string;
  citations: string[];
  dataUsed: {
    structuredRules: boolean;
    aiReasoning: boolean;
    precedents: boolean;
  };
  followUpQuestions?: string[];
}

export interface StructuredExtractionResult {
  profile: ZoningDistrictProfile;
  confidence: number;
  extractionNotes: string;
}

const REASONING_SYSTEM_PROMPT = `You are a senior zoning attorney AI specializing in US municipal zoning codes. You have deep knowledge of zoning regulations, entitlement processes, and development feasibility across major US cities.

When answering questions:
1. Always cite specific code sections when possible (e.g., §16-18A.007)
2. Distinguish between BY-RIGHT uses (no approval needed), CONDITIONAL uses (CUP/SAP required), and PROHIBITED uses
3. Identify cross-references and overlay district interactions that could affect the answer
4. Flag potential pitfalls, edge cases, and commonly misinterpreted provisions
5. When discussing variances or rezones, provide realistic approval probability estimates based on typical municipal patterns
6. Always note your confidence level and what would increase it

You will receive structured zoning data as context. Use it as your primary source and supplement with your training knowledge. If the structured data conflicts with your knowledge, note the discrepancy.

Respond in JSON format:
{
  "answer": "Clear, actionable response to the question",
  "confidence": 85,
  "reasoning": "Explanation of your analytical process",
  "citations": ["§16-18A.007", "§16-28.024"],
  "caveats": ["Any important limitations or assumptions"],
  "followUpQuestions": ["Questions that would help refine the analysis"]
}`;

const EXTRACTION_SYSTEM_PROMPT = `You are a zoning code extraction specialist. Given a zoning district code and jurisdiction, extract ALL regulatory parameters into a structured format.

CRITICAL RULES:
- Only provide values you are confident about from your training data
- Use null for any value you cannot verify
- For use permissions, be comprehensive — list ALL by-right, conditional, and prohibited uses
- Include parking reductions for transit proximity, shared parking, and affordable housing
- Identify cross-references to other code sections
- List applicable incentive programs (density bonuses, height bonuses, TDR)
- Note any overlay districts that commonly apply

Respond in valid JSON with this exact structure:
{
  "code": "MRC-3",
  "fullName": "Mixed Residential Commercial - 3",
  "jurisdiction": "City of Atlanta",
  "state": "GA",
  "codeSection": "§16-18A.007",
  "lastAmended": "2023-08-14",
  
  "dimensional": {
    "maxDensityUnitsPerAcre": 109,
    "maxHeightFt": 225,
    "maxFAR": 3.2,
    "maxLotCoveragePct": 85,
    "minOpenSpacePct": 15,
    "minLotSizeSf": null,
    "minLotWidthFt": null,
    "maxStories": null,
    "setbacks": { "front": 0, "side": 10, "rear": 20 },
    "setbackConditions": [
      { "condition": "adjacent_to_R_district", "side": 25, "rear": 30 }
    ]
  },
  
  "uses": {
    "byRight": [
      { "use": "multi_family_residential", "conditions": null },
      { "use": "retail", "conditions": "ground floor only in mixed-use" }
    ],
    "conditional": [
      { "use": "drive_through", "approval": "CUP", "conditions": "additional screening", "typicalTimelineMo": 3.5 }
    ],
    "prohibited": ["self_storage", "auto_repair"]
  },
  
  "parking": {
    "residential": { "perUnit": 1.0, "guestPerUnit": 0.25 },
    "commercial": { "per1000sf": 3.0 },
    "restaurant": { "per1000sf": 5.0 },
    "hotel": { "perRoom": 0.75 },
    "reductions": [
      { "trigger": "within_0.5mi_transit", "reductionPct": 20, "codeRef": "§16-18A.024" }
    ]
  },
  
  "crossReferences": [
    { "ref": "§16-28.007", "topic": "General parking provisions", "note": "Overrides district parking when more restrictive" }
  ],
  
  "incentives": [
    { "program": "density_bonus", "trigger": "10% units at 80% AMI", "benefit": "+15% density", "codeRef": "§16-18A.039" }
  ],
  
  "applicableOverlays": [
    { "overlay": "SPI-16", "name": "Midtown Special Public Interest", "overrides": ["min_retail_frontage"], "additionalRequirements": ["design_review_committee"] }
  ],
  
  "confidence": "high",
  "extractionNotes": "Notes about data quality or assumptions"
}`;

export class ZoningReasoningService {
  private pool: Pool;
  private knowledgeService: ZoningKnowledgeService;

  constructor(pool: Pool, knowledgeService: ZoningKnowledgeService) {
    this.pool = pool;
    this.knowledgeService = knowledgeService;
  }

  async reason(request: ReasoningRequest): Promise<ReasoningResponse> {
    let structuredContext = '';
    let profile: ZoningDistrictProfile | null = null;

    if (request.districtCode && request.municipality) {
      const lookup = await this.knowledgeService.lookupDistrict(request.districtCode, request.municipality);
      if (lookup.found && lookup.profile) {
        profile = lookup.profile;
        structuredContext = `\n\nSTRUCTURED ZONING DATA (from database):\n${JSON.stringify(profile, null, 2)}`;
      }
    }

    let precedentContext = '';
    if (request.municipality) {
      const precedents = await this.pool.query(
        `SELECT * FROM zoning_precedents 
         WHERE UPPER(municipality) = UPPER($1) 
         ${request.districtCode ? "AND UPPER(district_code) = UPPER($2)" : ""}
         ORDER BY created_at DESC LIMIT 10`,
        request.districtCode ? [request.municipality, request.districtCode] : [request.municipality]
      );
      if (precedents.rows.length > 0) {
        precedentContext = `\n\nPRECEDENT DATA (${precedents.rows.length} cases):\n${JSON.stringify(precedents.rows, null, 2)}`;
      }
    }

    let parcelContext = '';
    if (request.parcelContext) {
      const pc = request.parcelContext;
      parcelContext = `\n\nPARCEL CONTEXT:\n- Land area: ${pc.landAreaSf ? `${pc.landAreaSf} sq ft (${(pc.landAreaSf / 43560).toFixed(2)} acres)` : 'unknown'}\n- Address: ${pc.address || 'unknown'}\n- Coordinates: ${pc.lat && pc.lng ? `${pc.lat}, ${pc.lng}` : 'unknown'}`;
    }

    const userMessage = `${request.question}${structuredContext}${precedentContext}${parcelContext}`;

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: REASONING_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          answer: parsed.answer || responseText,
          confidence: parsed.confidence || 70,
          reasoning: parsed.reasoning || '',
          citations: parsed.citations || [],
          dataUsed: {
            structuredRules: !!profile,
            aiReasoning: true,
            precedents: precedentContext.length > 0,
          },
          followUpQuestions: parsed.followUpQuestions || [],
        };
      }

      return {
        answer: responseText,
        confidence: 65,
        reasoning: 'AI reasoning without structured JSON response',
        citations: [],
        dataUsed: { structuredRules: !!profile, aiReasoning: true, precedents: precedentContext.length > 0 },
      };
    } catch (error: any) {
      console.error('Zoning reasoning error:', error);
      throw new Error(`Reasoning failed: ${error.message}`);
    }
  }

  async extractStructuredProfile(districtCode: string, municipality: string, state: string): Promise<StructuredExtractionResult> {
    const userMessage = `Extract the full zoning district profile for district code "${districtCode}" in ${municipality}, ${state}. Provide ALL dimensional standards, use permissions, parking rules, cross-references, incentive programs, and applicable overlay districts.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Failed to extract structured profile — invalid AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const profile: ZoningDistrictProfile = {
      code: parsed.code || districtCode,
      fullName: parsed.fullName || districtCode,
      jurisdiction: parsed.jurisdiction || municipality,
      state: parsed.state || state,
      codeSection: parsed.codeSection || null,
      lastAmended: parsed.lastAmended || null,
      dimensional: {
        maxDensityUnitsPerAcre: parsed.dimensional?.maxDensityUnitsPerAcre ?? null,
        maxHeightFt: parsed.dimensional?.maxHeightFt ?? null,
        maxFAR: parsed.dimensional?.maxFAR ?? null,
        maxLotCoveragePct: parsed.dimensional?.maxLotCoveragePct ?? null,
        minOpenSpacePct: parsed.dimensional?.minOpenSpacePct ?? null,
        minLotSizeSf: parsed.dimensional?.minLotSizeSf ?? null,
        minLotWidthFt: parsed.dimensional?.minLotWidthFt ?? null,
        maxStories: parsed.dimensional?.maxStories ?? null,
        setbacks: parsed.dimensional?.setbacks || { front: 0, side: 0, rear: 0 },
        setbackConditions: parsed.dimensional?.setbackConditions || [],
      },
      uses: {
        byRight: parsed.uses?.byRight || [],
        conditional: parsed.uses?.conditional || [],
        prohibited: parsed.uses?.prohibited || [],
      },
      parking: {
        residential: parsed.parking?.residential || null,
        commercial: parsed.parking?.commercial || null,
        restaurant: parsed.parking?.restaurant || null,
        hotel: parsed.parking?.hotel || null,
        reductions: parsed.parking?.reductions || [],
      },
      crossReferences: parsed.crossReferences || [],
      incentives: parsed.incentives || [],
      applicableOverlays: parsed.applicableOverlays || [],
    };

    const confidenceMap: Record<string, number> = { high: 90, medium: 75, low: 55 };
    const confidence = confidenceMap[parsed.confidence] || 70;

    return {
      profile,
      confidence,
      extractionNotes: parsed.extractionNotes || 'Extracted via AI',
    };
  }
}
