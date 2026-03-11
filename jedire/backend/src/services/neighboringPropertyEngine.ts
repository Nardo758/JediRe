/**
 * Neighboring Property Recommendation Engine
 * 
 * Identifies adjacent parcels for assemblage opportunities and calculates
 * benefit scores for land acquisition strategy.
 * 
 * Future AI Enhancement: Qwen integration for owner disposition analysis,
 * satellite image context, and negotiation strategy generation.
 */

import { PoolClient } from 'pg';
import { query, transaction } from '../database/connection';
import { logger } from '../utils/logger';
import { 
  findAdjacentParcels, 
  calculateSharedBoundaryLength,
  calculateCombinedParcelGeometry,
  analyzeSpatialBenefits 
} from './spatialAnalysis';
import { qwenService } from './qwen.service';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface PropertyCoordinates {
  parcelId: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export interface NeighborProperty {
  parcelId: string;
  address: string;
  ownerName: string;
  ownerType?: string;
  units?: number;
  landAcres?: number;
  yearBuilt?: string;
  assessedValue?: number;
  appraisedValue?: number;
  landUseCode?: string;
  sharedBoundaryFeet: number;
  distance: number; // Center-to-center distance in meters
}

export interface AssemblageBenefits {
  additionalUnits: number;
  unitCapacityIncrease: number; // Percentage
  constructionCostReduction: number; // Dollars
  sharedWallSavings: number;
  setbackElimination: number;
  sharedInfrastructure: number; // Parking, utilities
  efficiencyGain: number; // Percentage
}

export interface FeasibilityScore {
  acquisitionLikelihood: number; // 0-100%
  ownerDisposition: string; // 'high' | 'medium' | 'low'
  valueCreated: number; // Dollars
  estimatedAskingPrice: number;
  competitiveRisk: string; // 'low' | 'medium' | 'high'
  timingScore: number; // 0-100
  confidenceScore: number; // 0-100%
}

export interface VisualizationData {
  combinedGeometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  beforeMassing: {
    volume: number;
    height: number;
    units: number;
  };
  afterMassing: {
    volume: number;
    height: number;
    units: number;
  };
  renderData: {
    vertices: number[][];
    faces: number[][];
    colors: string[];
  };
}

export interface NeighborRecommendation {
  neighbor: NeighborProperty;
  benefitScore: number; // 0-100, composite score
  benefits: AssemblageBenefits;
  feasibility: FeasibilityScore;
  visualization: VisualizationData;
  aiInsights?: {
    ownerDispositionAnalysis?: string; // Future: AI-generated
    negotiationStrategy?: string; // Future: AI-generated
    siteContext?: string; // Future: Aerial image analysis
  };
}

// ============================================================================
// Core Engine Class
// ============================================================================

export class NeighboringPropertyEngine {
  
  /**
   * Main entry point: Find and rank neighboring property opportunities
   */
  async findNeighbors(parcelId: string): Promise<NeighborRecommendation[]> {
    logger.info('Finding neighboring properties', { parcelId });

    return transaction(async (client: PoolClient) => {
      // 1. Get primary parcel geometry
      const primaryParcel = await this.getParcelGeometry(client, parcelId);
      if (!primaryParcel) {
        throw new Error(`Parcel not found: ${parcelId}`);
      }

      // 2. Find adjacent parcels
      const neighbors = await findAdjacentParcels(client, primaryParcel);
      logger.info(`Found ${neighbors.length} adjacent parcels`, { parcelId });

      // 3. Analyze each neighbor
      const recommendations: NeighborRecommendation[] = [];
      
      for (const neighbor of neighbors) {
        try {
          const recommendation = await this.analyzeNeighbor(
            client,
            primaryParcel,
            neighbor
          );
          recommendations.push(recommendation);
        } catch (error) {
          logger.error('Error analyzing neighbor', { 
            parcelId, 
            neighborId: neighbor.parcelId, 
            error 
          });
        }
      }

      // 4. Rank by benefit score
      recommendations.sort((a, b) => b.benefitScore - a.benefitScore);

      logger.info(`Analyzed ${recommendations.length} neighbors`, {
        parcelId,
        topScore: recommendations[0]?.benefitScore
      });

      return recommendations;
    });
  }

  /**
   * Analyze a single neighboring property
   */
  private async analyzeNeighbor(
    client: PoolClient,
    primaryParcel: PropertyCoordinates,
    neighbor: NeighborProperty
  ): Promise<NeighborRecommendation> {
    
    // Calculate assemblage benefits
    const benefits = await this.calculateAssemblageBenefits(
      client,
      primaryParcel,
      neighbor
    );

    // Score feasibility
    const feasibility = await this.scoreFeasibility(
      client,
      neighbor,
      benefits
    );

    // Generate 3D visualization data
    const visualization = await this.generateVisualizationData(
      client,
      primaryParcel,
      neighbor,
      benefits
    );

    // Calculate composite benefit score
    const benefitScore = this.calculateBenefitScore(benefits, feasibility);

    return {
      neighbor,
      benefitScore,
      benefits,
      feasibility,
      visualization,
      aiInsights: {
        // Placeholder for future AI integration
        // TODO: Call Qwen for owner disposition analysis
        // TODO: Generate negotiation strategy with AI
        // TODO: Analyze satellite imagery for site context
      }
    };
  }

  /**
   * Get parcel geometry from database
   */
  private async getParcelGeometry(
    client: PoolClient,
    parcelId: string
  ): Promise<PropertyCoordinates | null> {
    const result = await client.query(
      `SELECT 
        parcel_id,
        ST_AsGeoJSON(parcel_geometry)::json as geometry
      FROM property_records
      WHERE parcel_id = $1`,
      [parcelId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      parcelId: result.rows[0].parcel_id,
      geometry: result.rows[0].geometry
    };
  }

  /**
   * Calculate assemblage benefits
   */
  private async calculateAssemblageBenefits(
    client: PoolClient,
    primaryParcel: PropertyCoordinates,
    neighbor: NeighborProperty
  ): Promise<AssemblageBenefits> {
    
    // Get zoning and development capacity data for primary parcel
    const primaryData = await this.getParcelDevelopmentData(client, primaryParcel.parcelId);
    const neighborData = await this.getParcelDevelopmentData(client, neighbor.parcelId);

    // Calculate spatial benefits
    const spatialBenefits = await analyzeSpatialBenefits(
      client,
      primaryParcel.geometry,
      neighbor
    );

    // Additional unit capacity from assemblage
    const combinedAcres = (primaryData.landAcres || 0) + (neighbor.landAcres || 0);
    const densityLimit = primaryData.maxDensity || 50; // units per acre (default)
    
    const currentCapacity = (primaryData.landAcres || 0) * densityLimit;
    const assembledCapacity = combinedAcres * densityLimit * 1.15; // 15% bonus from efficiency
    const additionalUnits = Math.round(assembledCapacity - currentCapacity);

    // Construction cost savings
    const sharedWallSavings = spatialBenefits.sharedBoundaryFeet * 180; // $180/linear foot
    const setbackElimination = spatialBenefits.gainedBuildableArea * 25; // $25/sqft construction cost
    const sharedInfrastructure = additionalUnits * 8500; // $8,500 per unit for shared parking/utilities

    const totalCostReduction = sharedWallSavings + setbackElimination + sharedInfrastructure;

    return {
      additionalUnits,
      unitCapacityIncrease: (additionalUnits / (primaryData.units || 1)) * 100,
      constructionCostReduction: totalCostReduction,
      sharedWallSavings,
      setbackElimination,
      sharedInfrastructure,
      efficiencyGain: spatialBenefits.efficiencyGain
    };
  }

  /**
   * Get parcel development data
   */
  private async getParcelDevelopmentData(client: PoolClient, parcelId: string) {
    const result = await client.query(
      `SELECT 
        pr.parcel_id,
        pr.units,
        pr.land_acres,
        pr.building_sqft,
        pr.assessed_value,
        pr.land_use_code
      FROM property_records pr
      WHERE pr.parcel_id = $1`,
      [parcelId]
    );

    if (result.rows.length === 0) {
      return {
        landAcres: 0,
        units: 0,
        maxDensity: 50
      };
    }

    const row = result.rows[0];
    
    // Estimate max density based on land use code
    let maxDensity = 50; // Default
    if (row.land_use_code?.includes('R-5')) maxDensity = 75;
    if (row.land_use_code?.includes('R-4')) maxDensity = 50;
    if (row.land_use_code?.includes('R-3')) maxDensity = 25;

    return {
      ...row,
      maxDensity
    };
  }

  /**
   * Score acquisition feasibility
   */
  private async scoreFeasibility(
    client: PoolClient,
    neighbor: NeighborProperty,
    benefits: AssemblageBenefits
  ): Promise<FeasibilityScore> {
    
    // Owner disposition scoring (rule-based for now, AI-enhanced later)
    let ownerDisposition = 'medium';
    let acquisitionLikelihood = 50;

    if (neighbor.ownerType?.toLowerCase().includes('trust')) {
      ownerDisposition = 'high';
      acquisitionLikelihood = 70;
    } else if (neighbor.ownerType?.toLowerCase().includes('llc')) {
      ownerDisposition = 'medium';
      acquisitionLikelihood = 55;
    } else if (neighbor.ownerType?.toLowerCase().includes('reit')) {
      ownerDisposition = 'low';
      acquisitionLikelihood = 30;
    }

    // Estimate value created
    const valueCreated = benefits.additionalUnits * 200000; // $200k value per unit

    // Estimate asking price (1.2x appraised)
    const estimatedAskingPrice = (neighbor.appraisedValue || neighbor.assessedValue || 0) * 1.2;

    // Competitive risk (placeholder logic)
    const competitiveRisk = estimatedAskingPrice > 5000000 ? 'high' : 'low';

    // Timing score
    const buildingAge = neighbor.yearBuilt ? 2025 - parseInt(neighbor.yearBuilt) : 30;
    const timingScore = Math.min(100, buildingAge * 2); // Older = better timing

    // Confidence score
    const confidenceScore = (acquisitionLikelihood + timingScore) / 2;

    return {
      acquisitionLikelihood,
      ownerDisposition,
      valueCreated,
      estimatedAskingPrice,
      competitiveRisk,
      timingScore,
      confidenceScore
    };
  }

  /**
   * Generate 3D visualization data for Three.js
   */
  private async generateVisualizationData(
    client: PoolClient,
    primaryParcel: PropertyCoordinates,
    neighbor: NeighborProperty,
    benefits: AssemblageBenefits
  ): Promise<VisualizationData> {
    
    // Calculate combined geometry
    const combinedGeometry = await calculateCombinedParcelGeometry(
      client,
      primaryParcel.parcelId,
      neighbor.parcelId
    );

    // Before massing (primary parcel only)
    const primaryData = await this.getParcelDevelopmentData(client, primaryParcel.parcelId);
    const beforeMassing = {
      volume: (primaryData.building_sqft || 0) * 12, // Assume 12ft floor height
      height: (primaryData.units || 0) / 4 * 12, // Rough estimate: 4 units per floor
      units: primaryData.units || 0
    };

    // After massing (combined)
    const afterMassing = {
      volume: beforeMassing.volume + (benefits.additionalUnits * 1000 * 12),
      height: beforeMassing.height + 12, // Add one floor
      units: beforeMassing.units + benefits.additionalUnits
    };

    // Generate render data (simplified for now)
    const renderData = {
      vertices: [], // TODO: Extract from combinedGeometry
      faces: [],
      colors: ['#3498db', '#e74c3c'] // Blue for primary, red for neighbor
    };

    return {
      combinedGeometry,
      beforeMassing,
      afterMassing,
      renderData
    };
  }

  /**
   * Calculate composite benefit score (0-100)
   */
  private calculateBenefitScore(
    benefits: AssemblageBenefits,
    feasibility: FeasibilityScore
  ): number {
    
    // Weighted scoring
    const unitScore = Math.min(100, (benefits.additionalUnits / 50) * 100); // 50 units = max score
    const costScore = Math.min(100, (benefits.constructionCostReduction / 2000000) * 100); // $2M = max
    const feasibilityWeight = feasibility.confidenceScore;

    const compositeScore = (
      unitScore * 0.4 +
      costScore * 0.3 +
      feasibilityWeight * 0.3
    );

    return Math.round(compositeScore);
  }

  /**
   * AI INTEGRATION: Analyze owner disposition using Qwen
   * Uses Qwen to analyze owner background, property holding duration,
   * market signals, and generate disposition score
   */
  async analyzeOwnerDisposition(ownerId: string, model: 'qwen' = 'qwen'): Promise<any> {
    try {
      if (!qwenService.isEnabled()) {
        logger.warn('Qwen AI not configured, using rule-based analysis', { ownerId });
        return this.analyzeOwnerDispositionRuleBased(ownerId);
      }

      // Pull owner history from database
      const ownerProfile = await this.getOwnerProfile(ownerId);
      
      if (!ownerProfile) {
        throw new Error(`Owner not found: ${ownerId}`);
      }

      // Call Qwen AI service
      const dispositionScore = await qwenService.predictOwnerDisposition(ownerProfile);
      
      logger.info('AI owner disposition analysis complete', { 
        ownerId, 
        score: dispositionScore.score 
      });
      
      return dispositionScore;
    } catch (error) {
      logger.error('AI owner disposition analysis failed', { ownerId, error });
      // Fallback to rule-based
      return this.analyzeOwnerDispositionRuleBased(ownerId);
    }
  }

  /**
   * Get owner profile from database
   */
  private async getOwnerProfile(ownerId: string): Promise<any> {
    const result = await query(
      `SELECT 
        o.owner_id as id,
        o.owner_name as name,
        COUNT(pr.parcel_id) as properties,
        AVG(EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM pr.last_sale_date)) as avg_hold_period,
        MAX(pr.last_sale_date) as last_transaction_date
      FROM owners o
      LEFT JOIN property_records pr ON pr.owner_id = o.owner_id
      WHERE o.owner_id = $1
      GROUP BY o.owner_id, o.owner_name`,
      [ownerId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const owner = result.rows[0];

    // Get recent acquisitions
    const acquisitionHistory = await query(
      `SELECT 
        pr.address,
        pr.last_sale_price as price,
        pr.last_sale_date as date
      FROM property_records pr
      WHERE pr.owner_id = $1
      AND pr.last_sale_date IS NOT NULL
      ORDER BY pr.last_sale_date DESC
      LIMIT 10`,
      [ownerId]
    );

    owner.acquisitionHistory = acquisitionHistory.rows;

    return owner;
  }

  /**
   * Fallback: Rule-based owner disposition analysis
   */
  private async analyzeOwnerDispositionRuleBased(ownerId: string): Promise<any> {
    const ownerProfile = await this.getOwnerProfile(ownerId);
    
    if (!ownerProfile) {
      return {
        score: 50,
        factors: { holdPeriod: 50, marketTiming: 50, financialNeed: 50, portfolioStrategy: 50 },
        estimatedPrice: 0,
        timeframe: 'unknown',
        negotiationLeverage: 'medium',
        confidence: 0.3,
        reasoning: 'Owner profile not found - using default estimates'
      };
    }

    // Simple rule-based scoring
    const holdPeriodScore = Math.min(100, ownerProfile.avg_hold_period * 10); // 10 years = 100
    const portfolioScore = Math.min(100, (ownerProfile.properties / 5) * 100); // 5+ properties = active investor
    
    const score = (holdPeriodScore + portfolioScore) / 2;

    return {
      score,
      factors: {
        holdPeriod: holdPeriodScore,
        marketTiming: 50,
        financialNeed: 50,
        portfolioStrategy: portfolioScore
      },
      estimatedPrice: 0,
      timeframe: score > 70 ? '3-6 months' : score > 50 ? '6-12 months' : 'not likely',
      negotiationLeverage: score > 70 ? 'high' : score > 50 ? 'medium' : 'low',
      confidence: 0.5,
      reasoning: 'Rule-based analysis (AI not configured)'
    };
  }

  /**
   * AI INTEGRATION: Generate negotiation strategy using Qwen
   * Uses Qwen to create custom negotiation approach based on
   * owner type, market conditions, and assemblage value
   */
  async generateNegotiationStrategy(
    neighbors: NeighborProperty[], 
    model: 'qwen' = 'qwen'
  ): Promise<any> {
    try {
      if (!qwenService.isEnabled()) {
        logger.warn('Qwen AI not configured, using rule-based strategy', { 
          neighborCount: neighbors.length 
        });
        return this.generateNegotiationStrategyRuleBased(neighbors);
      }

      // Convert to format expected by Qwen service
      const enrichedNeighbors = neighbors.map(n => ({
        parcelId: n.parcelId,
        address: n.address,
        owner: {
          id: `owner-${n.parcelId}`,
          name: n.ownerName,
          properties: 1, // Would need to query
          avgHoldPeriod: 5, // Would need to query
          acquisitionHistory: []
        },
        assessedValue: n.assessedValue || 0,
        zoning: n.landUseCode || 'unknown',
        distanceFromSite: n.distance
      }));

      // Call Qwen AI service
      const strategy = await qwenService.generateNegotiationStrategy(enrichedNeighbors);
      
      logger.info('AI negotiation strategy generated', {
        neighborCount: neighbors.length,
        approach: strategy.approach
      });
      
      return strategy;
    } catch (error) {
      logger.error('AI negotiation strategy generation failed', { error });
      // Fallback to rule-based
      return this.generateNegotiationStrategyRuleBased(neighbors);
    }
  }

  /**
   * Fallback: Rule-based negotiation strategy
   */
  private generateNegotiationStrategyRuleBased(neighbors: NeighborProperty[]): any {
    // Sort by value/potential
    const prioritized = neighbors
      .sort((a, b) => (b.sharedBoundaryFeet || 0) - (a.sharedBoundaryFeet || 0))
      .map((n, index) => ({
        parcelId: n.parcelId,
        priority: index + 1,
        approachStrategy: index === 0 
          ? 'Direct offer - highest priority due to longest shared boundary'
          : 'Secondary target - approach after primary acquisition',
        offerRange: {
          low: (n.assessedValue || 0) * 0.9,
          mid: (n.assessedValue || 0) * 1.1,
          high: (n.assessedValue || 0) * 1.3
        }
      }));

    return {
      approach: 'sequential',
      prioritizedTargets: prioritized,
      timeline: '6-12 months',
      risks: [
        'Competing developers may pursue same targets',
        'Price escalation if sequential approach is detected',
        'Some owners may not be willing sellers'
      ],
      successProbability: 0.6,
      reasoning: 'Rule-based strategy prioritizing shared boundary length (AI not configured)'
    };
  }

  /**
   * AI INTEGRATION: Analyze site from aerial imagery
   * Sends satellite image to Qwen for context analysis
   * (access roads, neighboring uses, environmental factors)
   */
  async analyzeSiteFromAerial(
    coords: { lat: number; lng: number },
    satelliteUrl?: string
  ): Promise<any> {
    try {
      if (!qwenService.isEnabled()) {
        logger.warn('Qwen AI not configured, aerial analysis unavailable', { coords });
        return {
          implemented: false,
          message: 'Qwen AI not configured - configure HF_TOKEN to enable aerial analysis'
        };
      }

      // If no satellite URL provided, generate one from coords
      if (!satelliteUrl) {
        // Use Mapbox Static API or similar
        const mapboxToken = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;
        if (mapboxToken) {
          satelliteUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${coords.lng},${coords.lat},16,0/1280x1280@2x?access_token=${mapboxToken}`;
        } else {
          logger.warn('No Mapbox token available for satellite imagery', { coords });
          return {
            implemented: false,
            message: 'Satellite imagery requires MAPBOX_TOKEN configuration'
          };
        }
      }

      // Call Qwen AI service for aerial analysis
      const siteContext = await qwenService.analyzeSiteFromAerial(coords, satelliteUrl);
      
      logger.info('AI aerial analysis complete', { coords });
      
      return siteContext;
    } catch (error) {
      logger.error('AI aerial analysis failed', { coords, error });
      return {
        implemented: false,
        error: error.message,
        message: 'AI aerial analysis failed - see logs for details'
      };
    }
  }
}

// Singleton instance
export const neighboringPropertyEngine = new NeighboringPropertyEngine();
