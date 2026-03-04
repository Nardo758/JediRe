/**
 * Design Assistant Service - LLM-powered conversational design modifications
 * Uses Claude to interpret user requests and generate design parameter changes
 */

import Anthropic from '@anthropic-ai/sdk';

interface BuildingSection {
  id: string;
  name: string;
  geometry: {
    footprint: { points: Array<{ x: number; y: number; z: number }> };
    height: number;
    floors: number;
  };
  position: { x: number; y: number; z: number };
  visible: boolean;
}

interface DesignState {
  buildingSections: BuildingSection[];
  parcelBoundary?: {
    area: number;
    areaSF: number;
  };
  metrics?: {
    unitCount: number;
    totalSF: number;
    parkingSpaces: number;
    height: { feet: number; stories: number };
    coverage: { percentage: number; usedArea: number };
    far: number;
  };
}

interface DesignModification {
  action: 'update_section' | 'add_section' | 'remove_section' | 'regenerate';
  sectionId?: string;
  changes?: {
    geometry?: {
      height?: number;
      floors?: number;
      footprintScale?: number;
    };
    position?: { x?: number; y?: number; z?: number };
    visible?: boolean;
  };
  newSection?: BuildingSection;
  explanation: string;
  alternatives?: Array<{
    description: string;
    modifications: any;
  }>;
}

interface AssistantResponse {
  modifications: DesignModification[];
  message: string;
  requiresConfirmation: boolean;
}

export class DesignAssistantService {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Process a user design request and return suggested modifications
   */
  async processDesignRequest(
    userPrompt: string,
    currentDesign: DesignState,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<AssistantResponse> {
    const systemPrompt = this.buildSystemPrompt();
    const designContext = this.buildDesignContext(currentDesign);

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...conversationHistory,
      {
        role: 'user',
        content: `${designContext}\n\nUser request: ${userPrompt}`,
      },
    ];

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const parsed = this.parseAssistantResponse(content.text);
      return parsed;
    } catch (error) {
      console.error('[Design Assistant] Error:', error);
      throw error;
    }
  }

  /**
   * Build system prompt with design rules and capabilities
   */
  private buildSystemPrompt(): string {
    return `You are an expert architectural design assistant helping users modify 3D building designs in real-time.

Your role:
- Interpret user requests for design changes (height, floors, footprint, parking, units, etc.)
- Suggest practical modifications that respect architectural constraints
- Explain trade-offs clearly
- Offer alternatives when appropriate

Design constraints:
- Floor height: typically 10 ft/floor (9-12 ft range)
- Parking: typically 350 SF/space (includes circulation)
- Residential units: typically 750-1000 SF average
- Setbacks: must be respected (front/side/rear)
- FAR limits: check against zoning envelope
- Lot coverage: typically 40-65% max

Output format (JSON):
{
  "modifications": [
    {
      "action": "update_section",
      "sectionId": "section-id",
      "changes": {
        "geometry": {
          "height": 120,
          "floors": 12
        }
      },
      "explanation": "Increased building height by 2 floors to accommodate 50 additional units"
    }
  ],
  "message": "I've increased the residential tower from 10 to 12 floors (+20 ft). This adds approximately 50 units while maintaining the same footprint.",
  "requiresConfirmation": true
}

Actions available:
- "update_section": Modify existing building section (height, floors, position, visibility)
- "add_section": Add a new building section (parking, tower, amenity, etc.)
- "remove_section": Delete a section
- "regenerate": Suggest starting over with new template

When the request is ambiguous, offer alternatives with pros/cons.
When the request violates constraints, explain why and suggest workarounds.
Always explain the impact on metrics (units, GFA, FAR, parking, etc.).`;
  }

  /**
   * Build design context string for Claude
   */
  private buildDesignContext(design: DesignState): string {
    const { buildingSections, parcelBoundary, metrics } = design;

    let context = `Current design state:\n\n`;

    // Parcel info
    if (parcelBoundary) {
      context += `Parcel: ${parcelBoundary.area.toFixed(2)} acres (${parcelBoundary.areaSF.toLocaleString()} SF)\n\n`;
    }

    // Building sections
    context += `Building sections (${buildingSections.length}):\n`;
    buildingSections.forEach((section, i) => {
      const footprintArea = this.calculateFootprintArea(section.geometry.footprint.points);
      context += `${i + 1}. ${section.name} (ID: ${section.id})\n`;
      context += `   - Height: ${section.geometry.height} ft (${section.geometry.floors} floors)\n`;
      context += `   - Footprint: ${footprintArea.toLocaleString()} SF\n`;
      context += `   - Position: Y=${section.position.y} ft (vertical offset)\n`;
      context += `   - Visible: ${section.visible}\n`;
    });

    // Metrics
    if (metrics) {
      context += `\nCurrent metrics:\n`;
      context += `- Units: ${metrics.unitCount}\n`;
      context += `- Total GFA: ${metrics.totalSF.toLocaleString()} SF\n`;
      context += `- Parking: ${metrics.parkingSpaces} spaces\n`;
      context += `- Building height: ${metrics.height.feet} ft (${metrics.height.stories} stories)\n`;
      context += `- Lot coverage: ${metrics.coverage.percentage.toFixed(1)}%\n`;
      context += `- FAR: ${metrics.far.toFixed(2)}\n`;
    }

    return context;
  }

  /**
   * Parse Claude's JSON response into structured modifications
   */
  private parseAssistantResponse(text: string): AssistantResponse {
    try {
      // Extract JSON from markdown code blocks if present
      let jsonText = text;
      const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonText);

      return {
        modifications: parsed.modifications || [],
        message: parsed.message || 'Design updated.',
        requiresConfirmation: parsed.requiresConfirmation ?? true,
      };
    } catch (error) {
      console.error('[Design Assistant] Failed to parse response:', text);
      
      // Fallback: treat as plain text response
      return {
        modifications: [],
        message: text,
        requiresConfirmation: false,
      };
    }
  }

  /**
   * Calculate footprint area using Shoelace formula
   */
  private calculateFootprintArea(points: Array<{ x: number; y: number; z: number }>): number {
    if (points.length < 3) return 0;

    let area = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].z;
      area -= points[j].x * points[i].z;
    }

    return Math.abs(area / 2);
  }

  /**
   * Estimate impact of modifications on metrics
   */
  estimateMetricsImpact(
    currentMetrics: DesignState['metrics'],
    modifications: DesignModification[]
  ): Partial<DesignState['metrics']> {
    if (!currentMetrics) return {};

    const impacts: Partial<DesignState['metrics']> = {};

    for (const mod of modifications) {
      if (mod.action === 'update_section' && mod.changes?.geometry) {
        const { floors, height } = mod.changes.geometry;

        // Rough estimate: each floor adds ~750 SF/unit at 85% efficiency
        if (floors) {
          const floorDelta = floors - (currentMetrics.height.stories || 0);
          const unitsDelta = Math.floor(floorDelta * 15); // ~15 units/floor estimate
          impacts.unitCount = (impacts.unitCount || currentMetrics.unitCount) + unitsDelta;
        }

        if (height) {
          impacts.height = {
            feet: height,
            stories: Math.round(height / 10),
          };
        }
      }
    }

    return impacts;
  }
}

export const designAssistantService = new DesignAssistantService();
