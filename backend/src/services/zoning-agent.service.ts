import Anthropic from '@anthropic-ai/sdk';
import { Pool } from 'pg';

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export interface ZoningAgentRequest {
  districtCode: string;
  districtName?: string;
  municipality: string;
  state: string;
  municipalityId?: string;
  districtId?: string;
}

export interface ZoningAgentResult {
  success: boolean;
  source: 'ai_retrieved' | 'database' | 'error';
  district: {
    permitted_uses: string[];
    conditional_uses: string[];
    prohibited_uses: string[];
    max_density_per_acre: number | null;
    max_far: number | null;
    max_building_height_ft: number | null;
    max_stories: number | null;
    min_front_setback_ft: number | null;
    min_side_setback_ft: number | null;
    min_rear_setback_ft: number | null;
    max_lot_coverage: number | null;
    min_lot_size_sqft: number | null;
    parking_per_unit: number | null;
    parking_per_1000_sqft: number | null;
    description: string;
    category: string;
  } | null;
  confidence: string;
  reasoning: string;
  error?: string;
}

const ZONING_AGENT_PROMPT = `You are a zoning code research specialist for US municipalities. Given a zoning district code and municipality, provide the zoning regulations for that district.

IMPORTANT: Only provide data you are confident about based on your training data about US zoning codes. If you're unsure about specific values, use null instead of guessing.

Respond in valid JSON with this exact structure:
{
  "permitted_uses": ["use1", "use2"],
  "conditional_uses": ["use1", "use2"],
  "prohibited_uses": ["use1", "use2"],
  "max_density_per_acre": <number or null>,
  "max_far": <number or null>,
  "max_building_height_ft": <number or null>,
  "max_stories": <number or null>,
  "min_front_setback_ft": <number or null>,
  "min_side_setback_ft": <number or null>,
  "min_rear_setback_ft": <number or null>,
  "max_lot_coverage": <number or null>,
  "min_lot_size_sqft": <number or null>,
  "parking_per_unit": <number or null>,
  "parking_per_1000_sqft": <number or null>,
  "description": "Brief description of this zoning district's purpose",
  "category": "residential|commercial|industrial|mixed_use|special|overlay",
  "confidence": "high|medium|low",
  "reasoning": "Brief explanation of your confidence level and data sources"
}

For permitted_uses: list common land uses allowed by right (e.g., "retail", "restaurant", "office", "single_family", "multifamily", "hotel")
For conditional_uses: list uses requiring special permit or conditional use approval
For prohibited_uses: list explicitly prohibited uses
For category: classify as residential, commercial, industrial, mixed_use, special, or overlay

Keep use names lowercase with underscores. Be specific but concise.`;

export class ZoningAgentService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async retrieveZoningData(request: ZoningAgentRequest): Promise<ZoningAgentResult> {
    try {
      const existingResult = await this.pool.query(
        `SELECT * FROM zoning_districts 
         WHERE (UPPER(COALESCE(zoning_code, district_code)) = UPPER($1))
           AND (UPPER(COALESCE(municipality, '')) = UPPER($2) OR municipality_id::text = $3)
         LIMIT 1`,
        [request.districtCode, request.municipality, request.municipalityId || '']
      );

      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        const hasDetailData = existing.permitted_uses?.length > 0 || 
                              existing.max_density_per_acre != null ||
                              existing.max_far != null ||
                              existing.max_building_height_ft != null;

        if (hasDetailData) {
          return {
            success: true,
            source: 'database',
            district: {
              permitted_uses: existing.permitted_uses || [],
              conditional_uses: existing.conditional_uses || [],
              prohibited_uses: existing.prohibited_uses || [],
              max_density_per_acre: existing.max_density_per_acre ?? existing.max_units_per_acre,
              max_far: existing.max_far ? parseFloat(existing.max_far) : null,
              max_building_height_ft: existing.max_building_height_ft ?? existing.max_height_feet,
              max_stories: existing.max_stories,
              min_front_setback_ft: existing.min_front_setback_ft ?? existing.setback_front_ft,
              min_side_setback_ft: existing.min_side_setback_ft ?? existing.setback_side_ft,
              min_rear_setback_ft: existing.min_rear_setback_ft ?? existing.setback_rear_ft,
              max_lot_coverage: existing.max_lot_coverage ? parseFloat(existing.max_lot_coverage) : null,
              min_lot_size_sqft: existing.min_lot_size_sqft,
              parking_per_unit: existing.parking_per_unit ? parseFloat(existing.parking_per_unit) : null,
              parking_per_1000_sqft: existing.parking_per_1000_sqft ? parseFloat(existing.parking_per_1000_sqft) : null,
              description: existing.description || existing.district_name || '',
              category: existing.category || 'unknown',
            },
            confidence: 'high',
            reasoning: 'Data retrieved from municipal zoning database',
          };
        }
      }

      const userPrompt = `Research the zoning regulations for district code "${request.districtCode}"${request.districtName ? ` (${request.districtName})` : ''} in ${request.municipality}, ${request.state}.

Provide the development standards, permitted uses, conditional uses, and setback requirements for this zoning district based on the municipal zoning code.`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        system: ZONING_AGENT_PROMPT,
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          success: false,
          source: 'error',
          district: null,
          confidence: 'low',
          reasoning: 'Failed to parse AI response',
          error: 'Invalid JSON response from AI',
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (existingResult.rows.length > 0) {
        const districtId = existingResult.rows[0].id;
        await this.pool.query(
          `UPDATE zoning_districts SET
            permitted_uses = COALESCE($2, permitted_uses),
            conditional_uses = COALESCE($3, conditional_uses),
            prohibited_uses = COALESCE($4, prohibited_uses),
            max_density_per_acre = COALESCE($5, max_density_per_acre),
            max_far = COALESCE($6, max_far),
            max_building_height_ft = COALESCE($7, max_building_height_ft),
            max_stories = COALESCE($8, max_stories),
            min_front_setback_ft = COALESCE($9, min_front_setback_ft),
            min_side_setback_ft = COALESCE($10, min_side_setback_ft),
            min_rear_setback_ft = COALESCE($11, min_rear_setback_ft),
            max_lot_coverage = COALESCE($12, max_lot_coverage),
            min_lot_size_sqft = COALESCE($13, min_lot_size_sqft),
            description = COALESCE($14, description),
            category = COALESCE($15, category),
            parking_per_unit = COALESCE($16, parking_per_unit),
            parking_per_1000_sqft = COALESCE($17, parking_per_1000_sqft),
            source = 'ai_retrieved',
            updated_at = NOW()
           WHERE id = $1`,
          [
            districtId,
            parsed.permitted_uses?.length > 0 ? parsed.permitted_uses : null,
            parsed.conditional_uses?.length > 0 ? parsed.conditional_uses : null,
            parsed.prohibited_uses?.length > 0 ? parsed.prohibited_uses : null,
            parsed.max_density_per_acre,
            parsed.max_far,
            parsed.max_building_height_ft,
            parsed.max_stories,
            parsed.min_front_setback_ft,
            parsed.min_side_setback_ft,
            parsed.min_rear_setback_ft,
            parsed.max_lot_coverage,
            parsed.min_lot_size_sqft,
            parsed.description || null,
            parsed.category || null,
            parsed.parking_per_unit,
            parsed.parking_per_1000_sqft,
          ]
        );
      } else {
        await this.pool.query(
          `INSERT INTO zoning_districts (
            municipality_id, municipality, state, district_code, district_name,
            permitted_uses, conditional_uses, prohibited_uses,
            max_density_per_acre, max_far, max_building_height_ft, max_stories,
            min_front_setback_ft, min_side_setback_ft, min_rear_setback_ft,
            max_lot_coverage, min_lot_size_sqft, parking_per_unit, parking_per_1000_sqft,
            description, category, source
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'ai_retrieved')`,
          [
            request.municipalityId || null,
            request.municipality,
            request.state,
            request.districtCode,
            request.districtName || parsed.description || request.districtCode,
            parsed.permitted_uses || [],
            parsed.conditional_uses || [],
            parsed.prohibited_uses || [],
            parsed.max_density_per_acre,
            parsed.max_far,
            parsed.max_building_height_ft,
            parsed.max_stories,
            parsed.min_front_setback_ft,
            parsed.min_side_setback_ft,
            parsed.min_rear_setback_ft,
            parsed.max_lot_coverage,
            parsed.min_lot_size_sqft,
            parsed.parking_per_unit,
            parsed.parking_per_1000_sqft,
            parsed.description || '',
            parsed.category || 'unknown',
          ]
        );
      }

      return {
        success: true,
        source: 'ai_retrieved',
        district: {
          permitted_uses: parsed.permitted_uses || [],
          conditional_uses: parsed.conditional_uses || [],
          prohibited_uses: parsed.prohibited_uses || [],
          max_density_per_acre: parsed.max_density_per_acre,
          max_far: parsed.max_far,
          max_building_height_ft: parsed.max_building_height_ft,
          max_stories: parsed.max_stories,
          min_front_setback_ft: parsed.min_front_setback_ft,
          min_side_setback_ft: parsed.min_side_setback_ft,
          min_rear_setback_ft: parsed.min_rear_setback_ft,
          max_lot_coverage: parsed.max_lot_coverage,
          min_lot_size_sqft: parsed.min_lot_size_sqft,
          parking_per_unit: parsed.parking_per_unit,
          parking_per_1000_sqft: parsed.parking_per_1000_sqft,
          description: parsed.description || '',
          category: parsed.category || 'unknown',
        },
        confidence: parsed.confidence || 'medium',
        reasoning: parsed.reasoning || 'Data retrieved via AI analysis of municipal zoning codes',
      };
    } catch (error: any) {
      console.error('Zoning agent error:', error);
      return {
        success: false,
        source: 'error',
        district: null,
        confidence: 'low',
        reasoning: 'AI retrieval failed',
        error: error.message || 'Unknown error',
      };
    }
  }
}
