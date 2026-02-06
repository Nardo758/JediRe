/**
 * Deal Analysis Service
 * 
 * Orchestrates Python analysis engines for deal-level analysis
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { Pool } from 'pg';

const execPromise = promisify(exec);

const PYTHON_DIR = path.join(__dirname, '../../python-services');
const PYTHON_CMD = process.env.PYTHON_PATH || 'python3';

export interface DealAnalysisInput {
  dealId: string;
  dealName: string;
  boundary: any; // GeoJSON polygon
  targetUnits?: number;
  budget?: number;
}

export interface DealAnalysisResult {
  dealId: string;
  jediScore: number; // 0-100
  verdict: 'STRONG_OPPORTUNITY' | 'OPPORTUNITY' | 'NEUTRAL' | 'CAUTION' | 'AVOID';
  confidence: number; // 0-1
  analysis: {
    developmentCapacity: {
      maxUnits: number;
      constructionCost: number;
      developmentPotential: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW';
      costPerUnit: number;
    };
    marketSignals: {
      growthRate: number;
      trend: 'STRONG_GROWTH' | 'MODERATE_GROWTH' | 'STABLE' | 'DECLINING';
      signalStrength: number;
    };
    recommendations: string[];
    keyInsights: string[];
  };
  analyzedAt: string;
}

export class DealAnalysisService {
  constructor(private readonly db: Pool) {}

  /**
   * Run complete analysis for a deal
   */
  async analyzeDeal(input: DealAnalysisInput): Promise<DealAnalysisResult> {
    try {
      // Step 1: Get properties within deal boundary
      const properties = await this.getPropertiesInBoundary(input.dealId);
      
      if (properties.length === 0) {
        throw new Error('No properties found in deal boundary');
      }

      // Step 2: Run capacity analysis on properties
      const capacityResult = await this.runCapacityAnalysis(properties, input);

      // Step 3: Calculate JEDI Score
      const jediScore = this.calculateJEDIScore(capacityResult, properties);

      // Step 4: Generate recommendations
      const recommendations = this.generateRecommendations(capacityResult, jediScore);

      // Step 5: Save analysis to database
      const analysisResult: DealAnalysisResult = {
        dealId: input.dealId,
        jediScore: jediScore.score,
        verdict: jediScore.verdict,
        confidence: jediScore.confidence,
        analysis: {
          developmentCapacity: capacityResult.capacity,
          marketSignals: capacityResult.signals,
          recommendations: recommendations.items,
          keyInsights: recommendations.insights,
        },
        analyzedAt: new Date().toISOString(),
      };

      await this.saveAnalysis(analysisResult);

      return analysisResult;
    } catch (error) {
      console.error('Deal analysis failed:', error);
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }

  /**
   * Get properties within deal boundary
   */
  private async getPropertiesInBoundary(dealId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT 
        p.id,
        p.address,
        p.lat,
        p.lng,
        p.rent,
        p.beds,
        p.baths,
        p.sqft,
        p.building_class,
        p.year_built,
        p.lease_expiration_date,
        p.current_lease_amount
      FROM properties p
      JOIN deals d ON d.id = $1
      WHERE ST_Contains(d.boundary, ST_Point(p.lng, p.lat))
      LIMIT 200
    `, [dealId]);

    return result.rows;
  }

  /**
   * Run Python capacity analysis
   */
  private async runCapacityAnalysis(properties: any[], input: DealAnalysisInput): Promise<any> {
    // Calculate total development potential
    const totalAcres = this.estimateTotalAcres(properties);
    const avgZoning = this.estimateAverageZoning(properties);
    
    // Use Python capacity analyzer
    try {
      const analysisData = {
        parcel_id: input.dealId,
        land_area_sqft: totalAcres * 43560, // acres to sqft
        zoning_code: avgZoning,
        current_use: 'mixed',
        location_quality: this.assessLocationQuality(properties),
      };

      const cmd = `cd ${PYTHON_DIR} && ${PYTHON_CMD} -c "
import json
import sys
sys.path.insert(0, '.')
from data_pipeline.capacity_analyzer import CapacityAnalyzer

analyzer = CapacityAnalyzer()
parcel = ${JSON.stringify(analysisData).replace(/"/g, '\\"')}
result = analyzer.analyze_parcel(parcel)
print(json.dumps(result))
"`;

      const { stdout } = await execPromise(cmd);
      const result = JSON.parse(stdout);

      return {
        capacity: {
          maxUnits: result.max_units || Math.floor(totalAcres * 40), // Fallback estimate
          constructionCost: result.total_cost || totalAcres * 15000000, // $15M/acre estimate
          developmentPotential: result.development_potential || 'MODERATE',
          costPerUnit: result.cost_per_unit || 250000,
        },
        signals: {
          growthRate: this.calculateGrowthRate(properties),
          trend: this.assessTrend(properties),
          signalStrength: 0.75,
        },
      };
    } catch (error) {
      console.warn('Python analysis failed, using estimates:', error.message);
      
      // Fallback to basic calculations
      return {
        capacity: {
          maxUnits: Math.floor(totalAcres * 40),
          constructionCost: totalAcres * 15000000,
          developmentPotential: 'MODERATE',
          costPerUnit: 250000,
        },
        signals: {
          growthRate: 0.05,
          trend: 'STABLE',
          signalStrength: 0.5,
        },
      };
    }
  }

  /**
   * Calculate JEDI Score (0-100)
   */
  private calculateJEDIScore(capacityResult: any, properties: any[]): any {
    let score = 50; // baseline

    // Capacity factor (0-30 points)
    const potential = capacityResult.capacity.developmentPotential;
    if (potential === 'VERY_HIGH') score += 30;
    else if (potential === 'HIGH') score += 20;
    else if (potential === 'MODERATE') score += 10;

    // Market signals (0-30 points)
    const growthRate = capacityResult.signals.growthRate;
    if (growthRate > 0.08) score += 30;
    else if (growthRate > 0.05) score += 20;
    else if (growthRate > 0.02) score += 10;

    // Property quality (0-20 points)
    const avgRent = properties.reduce((sum, p) => sum + (p.rent || 0), 0) / properties.length;
    if (avgRent > 2000) score += 20;
    else if (avgRent > 1500) score += 15;
    else if (avgRent > 1000) score += 10;

    // Location factor (0-20 points)
    const locationQuality = this.assessLocationQuality(properties);
    score += locationQuality * 20;

    // Cap at 100
    score = Math.min(Math.round(score), 100);

    // Determine verdict
    let verdict: DealAnalysisResult['verdict'];
    if (score >= 80) verdict = 'STRONG_OPPORTUNITY';
    else if (score >= 65) verdict = 'OPPORTUNITY';
    else if (score >= 45) verdict = 'NEUTRAL';
    else if (score >= 30) verdict = 'CAUTION';
    else verdict = 'AVOID';

    return {
      score,
      verdict,
      confidence: 0.85,
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(capacityResult: any, jediScore: any): any {
    const recommendations: string[] = [];
    const insights: string[] = [];

    if (jediScore.score >= 70) {
      recommendations.push('Strong development opportunity - proceed with detailed due diligence');
      recommendations.push('Target acquisition within 90 days');
      insights.push(`High JEDI Score (${jediScore.score}/100) indicates favorable market conditions`);
    } else if (jediScore.score >= 50) {
      recommendations.push('Moderate opportunity - conduct additional market research');
      recommendations.push('Negotiate for favorable terms');
      insights.push(`Average JEDI Score (${jediScore.score}/100) suggests careful evaluation needed`);
    } else {
      recommendations.push('Proceed with caution - significant risks identified');
      recommendations.push('Consider alternative markets or strategies');
      insights.push(`Low JEDI Score (${jediScore.score}/100) indicates challenging conditions`);
    }

    if (capacityResult.capacity.maxUnits > 100) {
      recommendations.push(`High unit capacity (${capacityResult.capacity.maxUnits} units) - consider phased development`);
    }

    if (capacityResult.signals.growthRate > 0.05) {
      insights.push(`Strong market growth (${(capacityResult.signals.growthRate * 100).toFixed(1)}% annual) supports pricing power`);
    }

    return { items: recommendations, insights };
  }

  /**
   * Save analysis to database
   */
  private async saveAnalysis(result: DealAnalysisResult): Promise<void> {
    await this.db.query(`
      INSERT INTO analysis_results (
        deal_id,
        jedi_score,
        verdict,
        confidence,
        analysis_data,
        analyzed_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (deal_id) 
      DO UPDATE SET
        jedi_score = $2,
        verdict = $3,
        confidence = $4,
        analysis_data = $5,
        analyzed_at = $6
    `, [
      result.dealId,
      result.jediScore,
      result.verdict,
      result.confidence,
      JSON.stringify(result.analysis),
      result.analyzedAt,
    ]);
  }

  // Helper methods
  private estimateTotalAcres(properties: any[]): number {
    // Rough estimate: assume average property is 0.5 acres
    return properties.length * 0.5;
  }

  private estimateAverageZoning(properties: any[]): string {
    return 'R-4'; // Default mixed residential
  }

  private assessLocationQuality(properties: any[]): number {
    // Simple quality score based on rent levels
    const avgRent = properties.reduce((sum, p) => sum + (p.rent || 0), 0) / properties.length;
    if (avgRent > 2000) return 0.9;
    if (avgRent > 1500) return 0.7;
    if (avgRent > 1000) return 0.5;
    return 0.3;
  }

  private calculateGrowthRate(properties: any[]): number {
    // Placeholder - would use historical data in production
    return 0.06; // 6% annual growth estimate
  }

  private assessTrend(properties: any[]): 'STRONG_GROWTH' | 'MODERATE_GROWTH' | 'STABLE' | 'DECLINING' {
    const growthRate = this.calculateGrowthRate(properties);
    if (growthRate > 0.08) return 'STRONG_GROWTH';
    if (growthRate > 0.04) return 'MODERATE_GROWTH';
    if (growthRate > 0) return 'STABLE';
    return 'DECLINING';
  }
}
