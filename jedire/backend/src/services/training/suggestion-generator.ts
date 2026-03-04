/**
 * Suggestion Generator Service
 * Generates Layer 3 suggestions based on trained patterns
 */

import { DealCapsule } from '../../models/deal-capsule-updated';
import { UserModuleTraining, ModuleType } from '../../models/module-training';

export interface Suggestion {
  field: string;
  value: any;
  reason: string;
  confidence: number;
  source: 'pattern_training' | 'calibration' | 'combined';
}

export class SuggestionGenerator {
  
  /**
   * Generate suggestions for a capsule based on trained patterns
   */
  generateSuggestions(
    capsule: DealCapsule,
    training: UserModuleTraining,
    moduleId: ModuleType
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    switch (moduleId) {
      case 'financial':
        return this.generateFinancialSuggestions(capsule, training);
      case 'development':
        return this.generateDevelopmentSuggestions(capsule, training);
      case 'market_research':
        return this.generateMarketResearchSuggestions(capsule, training);
      case 'due_diligence':
        return this.generateDueDiligenceSuggestions(capsule, training);
      default:
        return suggestions;
    }
  }

  /**
   * Generate financial underwriting suggestions
   */
  private generateFinancialSuggestions(
    capsule: DealCapsule,
    training: UserModuleTraining
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const patterns = training.learned_patterns;

    // Rent adjustment suggestion
    if (capsule.deal_data.broker_rent_1br && patterns.rent_growth_avg) {
      const brokerRent = capsule.deal_data.broker_rent_1br;
      
      // Calculate typical adjustment vs broker
      const adjustedRent = brokerRent * 0.97; // User typically 3% below broker
      
      suggestions.push({
        field: 'adjusted_rent_1br',
        value: Math.round(adjustedRent),
        reason: `Your typical adjustment: ${patterns.rent_growth_behavior || 'conservative'} (${((adjustedRent - brokerRent) / brokerRent * 100).toFixed(1)}% vs broker)`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    // Occupancy adjustment
    if (capsule.deal_data.broker_occupancy) {
      const brokerOcc = capsule.deal_data.broker_occupancy;
      const adjustedOcc = patterns.stress_test_defaults?.occupancy || 95;
      
      suggestions.push({
        field: 'adjusted_occupancy',
        value: adjustedOcc,
        reason: `Your typical stabilized occupancy: ${adjustedOcc}% (broker claims ${brokerOcc}%)`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    // Exit cap suggestion
    if (capsule.deal_data.broker_cap_rate && patterns.exit_cap_spread !== undefined) {
      const entryCap = capsule.deal_data.broker_cap_rate;
      const exitCap = entryCap + patterns.exit_cap_spread;
      
      suggestions.push({
        field: 'exit_cap_assumption',
        value: exitCap,
        reason: `Your typical spread: +${(patterns.exit_cap_spread * 100).toFixed(0)}bps (entry ${entryCap}%)`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    // Hold period suggestion
    if (patterns.hold_period_mode) {
      suggestions.push({
        field: 'preferred_hold_period',
        value: patterns.hold_period_mode,
        reason: `Your typical hold period: ${patterns.hold_period_mode} years`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    // Target IRR (if available from patterns)
    if (patterns.target_irr) {
      suggestions.push({
        field: 'target_irr',
        value: patterns.target_irr,
        reason: `Your minimum IRR threshold`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    return suggestions;
  }

  /**
   * Generate development suggestions
   */
  private generateDevelopmentSuggestions(
    capsule: DealCapsule,
    training: UserModuleTraining
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const patterns = training.learned_patterns;

    // Unit mix suggestion
    if (patterns.preferred_unit_mix) {
      suggestions.push({
        field: 'target_unit_mix',
        value: patterns.preferred_unit_mix,
        reason: `Your typical unit mix based on ${training.sample_size} projects`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    // Amenities suggestion
    if (patterns.amenity_preferences) {
      suggestions.push({
        field: 'amenities',
        value: patterns.amenity_preferences.must_have,
        reason: `Your standard amenities (appear in ${Math.round(training.confidence)}% of projects)`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    // Construction quality
    if (patterns.construction_quality) {
      suggestions.push({
        field: 'quality_level',
        value: patterns.construction_quality,
        reason: `Your typical construction quality: ${patterns.construction_quality}`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    // Cost buffer
    if (patterns.cost_buffer_avg) {
      suggestions.push({
        field: 'cost_buffer_percentage',
        value: patterns.cost_buffer_avg,
        reason: `Your typical cost overrun: ${patterns.cost_buffer_avg.toFixed(1)}% (add to base estimate)`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    // Timeline buffer
    if (patterns.timeline_buffer_months) {
      suggestions.push({
        field: 'timeline_buffer_months',
        value: patterns.timeline_buffer_months,
        reason: `Your typical timeline extension: +${patterns.timeline_buffer_months} months`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    return suggestions;
  }

  /**
   * Generate market research suggestions
   */
  private generateMarketResearchSuggestions(
    capsule: DealCapsule,
    training: UserModuleTraining
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const patterns = training.learned_patterns;

    // Research depth
    if (patterns.research_depth) {
      suggestions.push({
        field: 'research_depth',
        value: patterns.research_depth,
        reason: `Your typical research level: ${patterns.research_depth}`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    // Submarket rating (if known)
    const submarket = capsule.deal_data.city || capsule.platform_intel.submarket;
    if (submarket && patterns.submarket_preferences?.[submarket]) {
      const pref = patterns.submarket_preferences[submarket];
      suggestions.push({
        field: 'submarket_rating',
        value: pref.rating,
        reason: `Your ${submarket} rating: ${pref.rating}${pref.notes ? ` (${pref.notes})` : ''}`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    // Trusted sources
    if (patterns.trusted_sources && patterns.trusted_sources.length > 0) {
      suggestions.push({
        field: 'data_sources',
        value: patterns.trusted_sources.map((s: any) => s.source),
        reason: `Your preferred data sources (weighted by usage)`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    return suggestions;
  }

  /**
   * Generate due diligence suggestions
   */
  private generateDueDiligenceSuggestions(
    capsule: DealCapsule,
    training: UserModuleTraining
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const patterns = training.learned_patterns;

    // Checklist template
    if (patterns.checklist_template) {
      suggestions.push({
        field: 'checklist_template',
        value: patterns.checklist_template,
        reason: `Your standard DD checklist`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    // Inspection depth
    if (patterns.inspection_depth) {
      suggestions.push({
        field: 'inspection_depth',
        value: patterns.inspection_depth,
        reason: `Your typical inspection level: ${patterns.inspection_depth}`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    // Deal breakers
    if (patterns.deal_breakers && patterns.deal_breakers.length > 0) {
      suggestions.push({
        field: 'deal_breakers',
        value: patterns.deal_breakers,
        reason: `Your standard deal breakers (${patterns.deal_breakers.length} items)`,
        confidence: training.confidence,
        source: 'pattern_training'
      });
    }

    return suggestions;
  }

  /**
   * Combine pattern-based suggestions with calibration adjustments
   */
  combineSuggestions(
    patternSuggestions: Suggestion[],
    calibrationFactor: number | null
  ): Suggestion[] {
    if (!calibrationFactor) {
      return patternSuggestions;
    }

    // Apply calibration to financial suggestions
    return patternSuggestions.map(suggestion => {
      if (suggestion.field.includes('rent') || suggestion.field.includes('noi')) {
        return {
          ...suggestion,
          value: typeof suggestion.value === 'number' 
            ? Math.round(suggestion.value * calibrationFactor)
            : suggestion.value,
          reason: suggestion.reason + ` (calibrated by ${(calibrationFactor * 100).toFixed(1)}%)`,
          source: 'combined' as const
        };
      }
      return suggestion;
    });
  }

  /**
   * Filter suggestions that user has already set
   */
  filterExistingSuggestions(
    suggestions: Suggestion[],
    existingAdjustments: Record<string, any>
  ): Suggestion[] {
    return suggestions.filter(suggestion => {
      return existingAdjustments[suggestion.field] === undefined;
    });
  }

  /**
   * Sort suggestions by confidence
   */
  sortByConfidence(suggestions: Suggestion[]): Suggestion[] {
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }
}

export const suggestionGenerator = new SuggestionGenerator();
