/**
 * Pattern Extractor Service
 * Analyzes training examples to extract user's underwriting patterns
 */

import { TrainingExample, LearnedPatterns, ModuleType } from '../../models/module-training';

export class PatternExtractor {
  
  /**
   * Extract patterns from training examples for a specific module
   */
  extractPatterns(moduleId: ModuleType, examples: TrainingExample[]): LearnedPatterns {
    if (examples.length === 0) {
      throw new Error('No training examples provided');
    }

    switch (moduleId) {
      case 'financial':
        return this.extractFinancialPatterns(examples);
      case 'development':
        return this.extractDevelopmentPatterns(examples);
      case 'market_research':
        return this.extractMarketResearchPatterns(examples);
      case 'due_diligence':
        return this.extractDueDiligencePatterns(examples);
      case 'traffic':
        // Traffic engine typically uses calibration only, not pattern training
        return {};
      default:
        throw new Error(`Unknown module type: ${moduleId}`);
    }
  }

  /**
   * Extract financial underwriting patterns
   */
  private extractFinancialPatterns(examples: TrainingExample[]): LearnedPatterns {
    const patterns: LearnedPatterns = {};

    // Extract rent growth patterns
    const rentGrowthValues: number[] = [];
    const brokerVsUserRent: Array<{ broker: number; user: number }> = [];
    
    examples.forEach(ex => {
      if (ex.user_output.rent_growth) {
        rentGrowthValues.push(ex.user_output.rent_growth);
      }
      
      if (ex.deal_characteristics.broker_rent && ex.user_output.adjusted_rent) {
        brokerVsUserRent.push({
          broker: ex.deal_characteristics.broker_rent,
          user: ex.user_output.adjusted_rent
        });
      }
    });

    if (rentGrowthValues.length > 0) {
      patterns.rent_growth_avg = this.average(rentGrowthValues);
      
      // Determine behavior
      const marketAvg = 3.8; // Could come from platform data
      if (patterns.rent_growth_avg < marketAvg * 0.9) {
        patterns.rent_growth_behavior = 'conservative';
      } else if (patterns.rent_growth_avg > marketAvg * 1.1) {
        patterns.rent_growth_behavior = 'aggressive';
      } else {
        patterns.rent_growth_behavior = 'moderate';
      }
    }

    // Extract exit cap spread patterns
    const exitCapSpreads: number[] = [];
    examples.forEach(ex => {
      if (ex.deal_characteristics.entry_cap && ex.user_output.exit_cap) {
        const spread = ex.user_output.exit_cap - ex.deal_characteristics.entry_cap;
        exitCapSpreads.push(spread);
      }
    });

    if (exitCapSpreads.length > 0) {
      patterns.exit_cap_spread = this.average(exitCapSpreads);
    }

    // Extract hold period patterns
    const holdPeriods: number[] = [];
    examples.forEach(ex => {
      if (ex.user_output.hold_period) {
        holdPeriods.push(ex.user_output.hold_period);
      }
    });

    if (holdPeriods.length > 0) {
      patterns.hold_period_mode = this.mode(holdPeriods);
    }

    // Extract stress test patterns
    const stressOccupancy: number[] = [];
    const stressRentReduction: number[] = [];
    
    examples.forEach(ex => {
      if (ex.user_output.stress_test_occupancy) {
        stressOccupancy.push(ex.user_output.stress_test_occupancy);
      }
      if (ex.user_output.stress_test_rent_reduction) {
        stressRentReduction.push(ex.user_output.stress_test_rent_reduction);
      }
    });

    if (stressOccupancy.length > 0 || stressRentReduction.length > 0) {
      patterns.stress_test_defaults = {
        occupancy: stressOccupancy.length > 0 ? this.average(stressOccupancy) : 90,
        rent_reduction: stressRentReduction.length > 0 ? this.average(stressRentReduction) : -10
      };
    }

    // Extract expense ratio patterns
    const expenseRatios: number[] = [];
    examples.forEach(ex => {
      if (ex.user_output.expense_ratio) {
        expenseRatios.push(ex.user_output.expense_ratio);
      }
    });

    if (expenseRatios.length > 0) {
      patterns.expense_ratio_avg = this.average(expenseRatios);
    }

    return patterns;
  }

  /**
   * Extract development patterns
   */
  private extractDevelopmentPatterns(examples: TrainingExample[]): LearnedPatterns {
    const patterns: LearnedPatterns = {};

    // Extract unit mix preferences
    const unitMixes: Array<Record<string, number>> = [];
    examples.forEach(ex => {
      if (ex.user_output.unit_mix) {
        unitMixes.push(ex.user_output.unit_mix);
      }
    });

    if (unitMixes.length > 0) {
      patterns.preferred_unit_mix = this.averageUnitMix(unitMixes);
    }

    // Extract amenity preferences
    const mustHaveAmenities = new Map<string, number>();
    const neverAmenities = new Map<string, number>();
    
    examples.forEach(ex => {
      if (ex.user_output.amenities) {
        ex.user_output.amenities.forEach((amenity: string) => {
          mustHaveAmenities.set(amenity, (mustHaveAmenities.get(amenity) || 0) + 1);
        });
      }
      if (ex.user_output.excluded_amenities) {
        ex.user_output.excluded_amenities.forEach((amenity: string) => {
          neverAmenities.set(amenity, (neverAmenities.get(amenity) || 0) + 1);
        });
      }
    });

    // Amenities that appear in >70% of projects = must_have
    const threshold = examples.length * 0.7;
    patterns.amenity_preferences = {
      must_have: Array.from(mustHaveAmenities.entries())
        .filter(([_, count]) => count >= threshold)
        .map(([amenity]) => amenity),
      nice_to_have: Array.from(mustHaveAmenities.entries())
        .filter(([_, count]) => count < threshold && count >= examples.length * 0.3)
        .map(([amenity]) => amenity),
      never: Array.from(neverAmenities.entries())
        .filter(([_, count]) => count >= threshold)
        .map(([amenity]) => amenity)
    };

    // Extract construction quality preference
    const qualities: string[] = [];
    examples.forEach(ex => {
      if (ex.user_output.construction_quality) {
        qualities.push(ex.user_output.construction_quality);
      }
    });

    if (qualities.length > 0) {
      patterns.construction_quality = this.modeString(qualities);
    }

    // Extract cost buffer pattern (how much they overrun)
    const costBuffers: number[] = [];
    examples.forEach(ex => {
      if (ex.user_output.cost_buffer_percentage) {
        costBuffers.push(ex.user_output.cost_buffer_percentage);
      }
    });

    if (costBuffers.length > 0) {
      patterns.cost_buffer_avg = this.average(costBuffers);
    }

    // Extract timeline buffer
    const timelineBuffers: number[] = [];
    examples.forEach(ex => {
      if (ex.user_output.timeline_buffer_months) {
        timelineBuffers.push(ex.user_output.timeline_buffer_months);
      }
    });

    if (timelineBuffers.length > 0) {
      patterns.timeline_buffer_months = Math.round(this.average(timelineBuffers));
    }

    return patterns;
  }

  /**
   * Extract market research patterns
   */
  private extractMarketResearchPatterns(examples: TrainingExample[]): LearnedPatterns {
    const patterns: LearnedPatterns = {};

    // Extract trusted sources
    const sources = new Map<string, number>();
    examples.forEach(ex => {
      if (ex.user_output.data_sources) {
        ex.user_output.data_sources.forEach((source: string) => {
          sources.set(source, (sources.get(source) || 0) + 1);
        });
      }
    });

    if (sources.size > 0) {
      patterns.trusted_sources = Array.from(sources.entries())
        .map(([source, count]) => ({
          source,
          weight: count / examples.length
        }))
        .sort((a, b) => b.weight - a.weight);
    }

    // Extract submarket preferences
    const submarketRatings = new Map<string, string[]>();
    examples.forEach(ex => {
      if (ex.user_output.submarket_rating) {
        const submarket = ex.deal_characteristics.submarket;
        const rating = ex.user_output.submarket_rating;
        if (!submarketRatings.has(submarket)) {
          submarketRatings.set(submarket, []);
        }
        submarketRatings.get(submarket)!.push(rating);
      }
    });

    if (submarketRatings.size > 0) {
      patterns.submarket_preferences = {};
      submarketRatings.forEach((ratings, submarket) => {
        patterns.submarket_preferences![submarket] = {
          rating: this.modeString(ratings),
          notes: '' // Could extract from user notes
        };
      });
    }

    // Extract research depth preference
    const depths: string[] = [];
    examples.forEach(ex => {
      if (ex.user_output.research_depth) {
        depths.push(ex.user_output.research_depth);
      }
    });

    if (depths.length > 0) {
      patterns.research_depth = this.modeString(depths) as any;
    }

    return patterns;
  }

  /**
   * Extract due diligence patterns
   */
  private extractDueDiligencePatterns(examples: TrainingExample[]): LearnedPatterns {
    const patterns: LearnedPatterns = {};

    // Extract checklist template preference
    const templates: string[] = [];
    examples.forEach(ex => {
      if (ex.user_output.checklist_template) {
        templates.push(ex.user_output.checklist_template);
      }
    });

    if (templates.length > 0) {
      patterns.checklist_template = this.modeString(templates);
    }

    // Extract deal breakers
    const dealBreakers = new Map<string, number>();
    examples.forEach(ex => {
      if (ex.user_output.deal_breakers) {
        ex.user_output.deal_breakers.forEach((breaker: string) => {
          dealBreakers.set(breaker, (dealBreakers.get(breaker) || 0) + 1);
        });
      }
    });

    if (dealBreakers.size > 0) {
      const threshold = examples.length * 0.5; // Appears in >50% of deals
      patterns.deal_breakers = Array.from(dealBreakers.entries())
        .filter(([_, count]) => count >= threshold)
        .map(([breaker]) => breaker);
    }

    // Extract inspection depth preference
    const depths: string[] = [];
    examples.forEach(ex => {
      if (ex.user_output.inspection_depth) {
        depths.push(ex.user_output.inspection_depth);
      }
    });

    if (depths.length > 0) {
      patterns.inspection_depth = this.modeString(depths) as any;
    }

    return patterns;
  }

  /**
   * Calculate quality score for a training example
   */
  calculateQualityScore(example: TrainingExample): number {
    let score = 0;

    // Completeness (40 points)
    const requiredFields = ['deal_characteristics', 'user_output'];
    const hasAllRequired = requiredFields.every(field => 
      example[field as keyof TrainingExample] !== undefined && 
      example[field as keyof TrainingExample] !== null
    );
    
    if (hasAllRequired) {
      score += 20;
      
      // Additional completeness based on field count
      const outputFields = Object.keys(example.user_output).length;
      score += Math.min(20, outputFields * 2);
    }

    // Consistency (30 points)
    // Check if numbers are in reasonable ranges
    let consistencyScore = 0;
    
    if (example.user_output.rent_growth) {
      const rentGrowth = example.user_output.rent_growth;
      if (rentGrowth >= 0 && rentGrowth <= 10) {
        consistencyScore += 10;
      }
    }

    if (example.user_output.exit_cap) {
      const exitCap = example.user_output.exit_cap;
      if (exitCap >= 3 && exitCap <= 12) {
        consistencyScore += 10;
      }
    }

    if (example.user_output.hold_period) {
      const holdPeriod = example.user_output.hold_period;
      if (holdPeriod >= 3 && holdPeriod <= 15) {
        consistencyScore += 10;
      }
    }

    score += consistencyScore;

    // Realism (30 points)
    // Check if adjusted values are reasonable vs broker claims
    let realismScore = 0;
    
    if (example.deal_characteristics.broker_rent && example.user_output.adjusted_rent) {
      const broker = example.deal_characteristics.broker_rent;
      const adjusted = example.user_output.adjusted_rent;
      const diff = Math.abs((adjusted - broker) / broker);
      
      if (diff <= 0.20) { // Within 20% is realistic
        realismScore += 15;
      } else if (diff <= 0.40) {
        realismScore += 10;
      }
    }

    if (example.deal_characteristics.broker_occupancy && example.user_output.adjusted_occupancy) {
      const broker = example.deal_characteristics.broker_occupancy;
      const adjusted = example.user_output.adjusted_occupancy;
      const diff = Math.abs(adjusted - broker);
      
      if (diff <= 5) { // Within 5% is realistic
        realismScore += 15;
      } else if (diff <= 10) {
        realismScore += 10;
      }
    }

    score += realismScore;

    return Math.min(100, score);
  }

  // Statistical helper methods
  
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private mode(values: number[]): number {
    if (values.length === 0) return 0;
    
    const frequency = new Map<number, number>();
    values.forEach(val => {
      frequency.set(val, (frequency.get(val) || 0) + 1);
    });

    let maxFreq = 0;
    let mode = values[0];
    frequency.forEach((freq, val) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        mode = val;
      }
    });

    return mode;
  }

  private modeString(values: string[]): string {
    if (values.length === 0) return '';
    
    const frequency = new Map<string, number>();
    values.forEach(val => {
      frequency.set(val, (frequency.get(val) || 0) + 1);
    });

    let maxFreq = 0;
    let mode = values[0];
    frequency.forEach((freq, val) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        mode = val;
      }
    });

    return mode;
  }

  private averageUnitMix(mixes: Array<Record<string, number>>): Record<string, number> {
    if (mixes.length === 0) return {};

    const unitTypes = new Set<string>();
    mixes.forEach(mix => {
      Object.keys(mix).forEach(type => unitTypes.add(type));
    });

    const avgMix: Record<string, number> = {};
    unitTypes.forEach(type => {
      const values = mixes
        .filter(mix => mix[type] !== undefined)
        .map(mix => mix[type]);
      
      if (values.length > 0) {
        avgMix[type] = Math.round(this.average(values));
      }
    });

    return avgMix;
  }
}

export const patternExtractor = new PatternExtractor();
