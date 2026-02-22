import OpenAI from 'openai';

/**
 * Qwen AI Service
 * Multimodal AI service using Qwen via HuggingFace Router
 * Supports text + image inputs for real estate development intelligence
 */

// Type definitions
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Design3D {
  id: string;
  dealId: string;
  totalUnits: number;
  unitMix: {
    studio?: number;
    oneBed?: number;
    twoBed?: number;
    threeBed?: number;
  };
  rentableSF: number;
  grossSF: number;
  efficiency: number;
  parkingSpaces: number;
  parkingType: 'surface' | 'structured' | 'underground';
  amenitySF: number;
  stories: number;
  farUtilized: number;
  farMax: number;
  lastModified: string;
}

export interface Photo {
  id: string;
  url: string;
  uploadedAt: string;
  tags?: string[];
}

export interface Owner {
  id: string;
  name: string;
  properties: number;
  avgHoldPeriod: number;
  lastTransactionDate?: string;
  acquisitionHistory: Array<{
    address: string;
    price: number;
    date: string;
  }>;
}

export interface Neighbor {
  parcelId: string;
  address: string;
  owner: Owner;
  assessedValue: number;
  zoning: string;
  distanceFromSite: number;
}

export interface TerrainData {
  elevationMap: number[][];
  slope: number;
  soilType: string;
  topographyFeatures: string[];
  grading Requirements: {
    cutFill: number;
    estimatedCost: number;
  };
  confidence: number;
}

export interface ComplianceReport {
  violations: Array<{
    type: string;
    description: string;
    severity: 'critical' | 'warning' | 'info';
    recommendation: string;
  }>;
  compliant: boolean;
  confidence: number;
  reasoning: string;
}

export interface SiteContext {
  adjacentParcels: Array<{
    parcelId: string;
    address: string;
    estimatedValue: number;
    acquisitionPotential: number;
  }>;
  infrastructure: {
    utilities: string[];
    access: string[];
  };
  marketContext: {
    submarket: string;
    competitiveProjects: number;
  };
  confidence: number;
}

export interface DispositionScore {
  score: number; // 0-100, higher = more likely to sell
  factors: {
    holdPeriod: number;
    marketTiming: number;
    financialNeed: number;
    portfolio strategy: number;
  };
  estimatedPrice: number;
  timeframe: string;
  negotiationLeverage: string;
  confidence: number;
  reasoning: string;
}

export interface PhotoTag {
  photoId: string;
  tags: string[];
  location3D?: {
    x: number;
    y: number;
    z: number;
    section: string;
  };
  confidence: number;
}

export interface ProgressEstimate {
  section: string;
  percentComplete: number;
  confidence: number;
  itemsCompleted: string[];
  itemsRemaining: string[];
  estimatedDaysToCompletion: number;
  reasoning: string;
}

export interface Strategy {
  approach: 'sequential' | 'parallel' | 'opportunistic';
  prioritizedTargets: Array<{
    parcelId: string;
    priority: number;
    approachStrategy: string;
    offerRange: {
      low: number;
      mid: number;
      high: number;
    };
  }>;
  timeline: string;
  risks: string[];
  successProbability: number;
  reasoning: string;
}

class QwenService {
  private client: OpenAI;
  private model: string;
  private enabled: boolean;

  constructor() {
    this.enabled = !!process.env.HF_TOKEN;
    
    if (this.enabled) {
      this.client = new OpenAI({
        baseURL: process.env.QWEN_BASE_URL || 'https://router.huggingface.co/v1',
        apiKey: process.env.HF_TOKEN,
      });
      this.model = process.env.QWEN_MODEL || 'Qwen/Qwen3.5-397B-A17B:novita';
    } else {
      console.warn('[QwenService] HF_TOKEN not configured - AI features disabled');
    }
  }

  /**
   * Check if AI service is available
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Make a completion request with text and optional images
   */
  private async complete(prompt: string, imageUrls?: string[]): Promise<string> {
    if (!this.enabled) {
      throw new Error('Qwen AI service is not enabled. Please configure HF_TOKEN.');
    }

    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: 'text', text: prompt },
    ];

    if (imageUrls && imageUrls.length > 0) {
      imageUrls.forEach(url => {
        content.push({
          type: 'image_url',
          image_url: { url },
        });
      });
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('[QwenService] API Error:', error);
      throw new Error(`Qwen API request failed: ${error.message}`);
    }
  }

  /**
   * Convert site photo to 3D terrain data
   */
  async imageToTerrain(imageUrl: string): Promise<TerrainData> {
    const prompt = `Analyze this site photo and extract detailed terrain information.
    
Provide a JSON response with:
- elevationMap: A 10x10 grid of relative elevations (0-100)
- slope: Average slope percentage
- soilType: Estimated soil type (clay, sand, rock, mixed)
- topographyFeatures: List of notable features (hill, valley, flat, irregular)
- gradingRequirements: Estimated cut/fill volume and cost
- confidence: Your confidence in this analysis (0-1)

Format your response as valid JSON only.`;

    const response = await this.complete(prompt, [imageUrl]);
    
    try {
      const parsed = JSON.parse(response);
      return {
        elevationMap: parsed.elevationMap || Array(10).fill(Array(10).fill(0)),
        slope: parsed.slope || 0,
        soilType: parsed.soilType || 'unknown',
        topographyFeatures: parsed.topographyFeatures || [],
        gradingRequirements: parsed.gradingRequirements || { cutFill: 0, estimatedCost: 0 },
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      console.error('[QwenService] Failed to parse terrain data:', error);
      throw new Error('Failed to parse AI terrain analysis');
    }
  }

  /**
   * Analyze 3D design for zoning compliance violations
   */
  async analyzeDesignCompliance(design3D: Design3D, renderUrl: string): Promise<ComplianceReport> {
    const prompt = `Analyze this 3D building design for potential zoning violations.

Design Parameters:
- Total Units: ${design3D.totalUnits}
- Stories: ${design3D.stories}
- FAR: ${design3D.farUtilized} / ${design3D.farMax}
- Parking: ${design3D.parkingSpaces} ${design3D.parkingType} spaces (${(design3D.parkingSpaces / design3D.totalUnits).toFixed(2)} per unit)
- Efficiency: ${(design3D.efficiency * 100).toFixed(1)}%
- Amenity SF: ${design3D.amenitySF}

Check for common violations:
- Setback requirements
- Height restrictions
- Parking ratio requirements
- FAR compliance
- Building coverage
- Shadow impact

Provide JSON response with:
- violations: Array of {type, description, severity, recommendation}
- compliant: Overall compliance boolean
- confidence: Confidence score (0-1)
- reasoning: Brief explanation

Format as valid JSON only.`;

    const response = await this.complete(prompt, [renderUrl]);
    
    try {
      const parsed = JSON.parse(response);
      return {
        violations: parsed.violations || [],
        compliant: parsed.compliant ?? true,
        confidence: parsed.confidence || 0.7,
        reasoning: parsed.reasoning || 'No significant violations detected.',
      };
    } catch (error) {
      console.error('[QwenService] Failed to parse compliance report:', error);
      throw new Error('Failed to parse AI compliance analysis');
    }
  }

  /**
   * Analyze satellite imagery to identify adjacent parcels and site context
   */
  async analyzeSiteFromAerial(coords: Coordinates, satelliteUrl: string): Promise<SiteContext> {
    const prompt = `Analyze this aerial/satellite image of a development site.

Location: ${coords.lat}, ${coords.lng}

Identify and provide JSON response with:
- adjacentParcels: Array of nearby parcels with estimated values and acquisition potential (0-100)
- infrastructure: Available utilities (water, sewer, electric, gas) and access points
- marketContext: Submarket name, number of competitive projects visible
- confidence: Analysis confidence (0-1)

Consider:
- Parcel boundaries and sizes
- Existing development patterns
- Street access
- Proximity to amenities
- Development potential

Format as valid JSON only.`;

    const response = await this.complete(prompt, [satelliteUrl]);
    
    try {
      const parsed = JSON.parse(response);
      return {
        adjacentParcels: parsed.adjacentParcels || [],
        infrastructure: parsed.infrastructure || { utilities: [], access: [] },
        marketContext: parsed.marketContext || { submarket: 'Unknown', competitiveProjects: 0 },
        confidence: parsed.confidence || 0.6,
      };
    } catch (error) {
      console.error('[QwenService] Failed to parse site context:', error);
      throw new Error('Failed to parse AI site analysis');
    }
  }

  /**
   * Predict owner disposition to sell
   */
  async predictOwnerDisposition(ownerProfile: Owner): Promise<DispositionScore> {
    const prompt = `Analyze this property owner's profile to predict their likelihood of selling.

Owner Profile:
- Name: ${ownerProfile.name}
- Portfolio Size: ${ownerProfile.properties} properties
- Average Hold Period: ${ownerProfile.avgHoldPeriod} years
- Last Transaction: ${ownerProfile.lastTransactionDate || 'Unknown'}
- Recent Acquisitions: ${ownerProfile.acquisitionHistory.length}

Recent Transaction History:
${ownerProfile.acquisitionHistory.map(t => `- ${t.address}: $${t.price.toLocaleString()} on ${t.date}`).join('\n')}

Provide JSON response with:
- score: 0-100 (higher = more likely to sell)
- factors: Breakdown of holdPeriod, marketTiming, financialNeed, portfolioStrategy (each 0-100)
- estimatedPrice: Estimated asking price
- timeframe: "immediate", "3-6 months", "6-12 months", "not likely"
- negotiationLeverage: "high", "medium", "low"
- confidence: Analysis confidence (0-1)
- reasoning: Brief explanation of the score

Format as valid JSON only.`;

    const response = await this.complete(prompt);
    
    try {
      const parsed = JSON.parse(response);
      return {
        score: parsed.score || 50,
        factors: parsed.factors || { holdPeriod: 50, marketTiming: 50, financialNeed: 50, portfolioStrategy: 50 },
        estimatedPrice: parsed.estimatedPrice || 0,
        timeframe: parsed.timeframe || 'unknown',
        negotiationLeverage: parsed.negotiationLeverage || 'medium',
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || 'Insufficient data for detailed analysis.',
      };
    } catch (error) {
      console.error('[QwenService] Failed to parse disposition score:', error);
      throw new Error('Failed to parse AI disposition analysis');
    }
  }

  /**
   * Auto-tag construction photos to 3D model locations
   */
  async autoTagPhotos(photos: Photo[]): Promise<PhotoTag[]> {
    if (photos.length === 0) {
      return [];
    }

    const photoUrls = photos.slice(0, 5).map(p => p.url); // Limit to 5 photos per request
    
    const prompt = `Analyze these construction progress photos and tag them.

For each photo, identify:
- What construction element is shown (foundation, framing, MEP, finishes, etc.)
- Which building section (lobby, unit 101, corridor 2nd floor, roof, parking, etc.)
- Approximate 3D location if possible (x, y, z coordinates)
- Confidence in the identification (0-1)

Provide JSON array with entries for each photo:
[{
  "photoIndex": 0,
  "tags": ["foundation", "excavation", "south-wing"],
  "location3D": { "x": 0, "y": 0, "z": 0, "section": "south-wing" },
  "confidence": 0.85
}, ...]

Format as valid JSON only.`;

    const response = await this.complete(prompt, photoUrls);
    
    try {
      const parsed = JSON.parse(response);
      return photos.slice(0, 5).map((photo, index) => {
        const analysis = Array.isArray(parsed) ? parsed[index] : parsed;
        return {
          photoId: photo.id,
          tags: analysis?.tags || ['untagged'],
          location3D: analysis?.location3D,
          confidence: analysis?.confidence || 0.5,
        };
      });
    } catch (error) {
      console.error('[QwenService] Failed to parse photo tags:', error);
      // Return basic fallback
      return photos.map(photo => ({
        photoId: photo.id,
        tags: ['construction'],
        confidence: 0.3,
      }));
    }
  }

  /**
   * Estimate construction progress from photos
   */
  async estimateProgress(photos: Photo[], section: string): Promise<ProgressEstimate> {
    const photoUrls = photos.slice(0, 3).map(p => p.url);
    
    const prompt = `Analyze these construction photos for the "${section}" section.

Estimate the construction progress:
- Percent complete (0-100)
- What items are completed
- What items remain
- Estimated days to completion
- Confidence in the estimate (0-1)
- Reasoning for your estimate

Provide JSON response:
{
  "section": "${section}",
  "percentComplete": 65,
  "itemsCompleted": ["foundation", "framing", "rough-in"],
  "itemsRemaining": ["drywall", "finishes", "punch-list"],
  "estimatedDaysToCompletion": 45,
  "confidence": 0.8,
  "reasoning": "Based on visible framing and rough-in completion..."
}

Format as valid JSON only.`;

    const response = await this.complete(prompt, photoUrls);
    
    try {
      const parsed = JSON.parse(response);
      return {
        section: parsed.section || section,
        percentComplete: parsed.percentComplete || 0,
        confidence: parsed.confidence || 0.5,
        itemsCompleted: parsed.itemsCompleted || [],
        itemsRemaining: parsed.itemsRemaining || [],
        estimatedDaysToCompletion: parsed.estimatedDaysToCompletion || 0,
        reasoning: parsed.reasoning || 'Unable to determine progress from photos.',
      };
    } catch (error) {
      console.error('[QwenService] Failed to parse progress estimate:', error);
      throw new Error('Failed to parse AI progress analysis');
    }
  }

  /**
   * Generate negotiation strategy for land assemblage
   */
  async generateNegotiationStrategy(neighbors: Neighbor[]): Promise<Strategy> {
    const prompt = `Develop a land assemblage negotiation strategy for these adjacent properties.

Adjacent Properties:
${neighbors.map((n, i) => `
${i + 1}. ${n.address}
   - Owner: ${n.owner.name} (${n.owner.properties} properties)
   - Assessed Value: $${n.assessedValue.toLocaleString()}
   - Distance: ${n.distanceFromSite} ft
   - Avg Hold Period: ${n.owner.avgHoldPeriod} years
`).join('\n')}

Provide JSON strategy:
{
  "approach": "sequential" | "parallel" | "opportunistic",
  "prioritizedTargets": [{
    "parcelId": "...",
    "priority": 1,
    "approachStrategy": "Direct offer, emphasize portfolio streamlining",
    "offerRange": { "low": 1000000, "mid": 1200000, "high": 1400000 }
  }],
  "timeline": "6-12 months",
  "risks": ["Owner unwilling to sell", "Price escalation"],
  "successProbability": 0.75,
  "reasoning": "Prioritize long-hold owners showing signs of..."
}

Format as valid JSON only.`;

    const response = await this.complete(prompt);
    
    try {
      const parsed = JSON.parse(response);
      return {
        approach: parsed.approach || 'opportunistic',
        prioritizedTargets: parsed.prioritizedTargets || [],
        timeline: parsed.timeline || 'unknown',
        risks: parsed.risks || [],
        successProbability: parsed.successProbability || 0.5,
        reasoning: parsed.reasoning || 'Strategy generated based on available data.',
      };
    } catch (error) {
      console.error('[QwenService] Failed to parse negotiation strategy:', error);
      throw new Error('Failed to parse AI negotiation strategy');
    }
  }
}

// Export singleton instance
export const qwenService = new QwenService();
export default qwenService;
