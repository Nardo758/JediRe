/**
 * Data Aggregator Service
 * 
 * Aggregates property-level data into submarket-level market snapshots.
 * Handles multiple data sources (ApartmentIQ, CoStar) and merges them intelligently.
 * 
 * @version 1.0.0
 * @date 2026-02-05
 */

import { ApartmentIQProperty, JEDIMarketSnapshot } from './apartmentiq-client';

// ============================================================================
// Types
// ============================================================================

export interface PropertyData {
  id: string;
  submarket: string;
  
  // Supply
  total_units: number;
  available_units?: number;
  vacancy_rate?: number;
  
  // Pricing
  rent_studio?: number;
  rent_1bed?: number;
  rent_2bed?: number;
  rent_3bed?: number;
  rent_avg: number;
  
  // Building
  building_class: 'A' | 'B' | 'C';
  year_built?: number;
  
  // Unit Mix (percentages)
  unit_mix?: {
    studio_pct: number;
    one_bed_pct: number;
    two_bed_pct: number;
    three_bed_pct: number;
  };
  
  // Intelligence (optional)
  opportunity_score?: number;
  negotiation_success_rate?: number;
  concessions_current?: string;
  
  // Metadata
  confidence_score?: number;
  data_source: string;
}

export interface SubmarketSnapshot {
  submarket_id: string;
  submarket_name: string;
  city: string;
  state: string;
  snapshot_date: string;
  
  // Supply Metrics
  properties_count: number;
  existing_units: number;
  total_supply: number;
  available_units: number;
  vacancy_rate: number;
  
  // Demand Metrics
  avg_days_on_market?: number;
  concessions_pct: number;
  
  // Pricing Metrics
  avg_rent: {
    studio?: number;
    one_bed?: number;
    two_bed?: number;
    three_bed?: number;
    average: number;
  };
  
  // Market Intelligence
  opportunity_score?: number;
  negotiation_success_rate?: number;
  market_pressure_index?: number;
  
  // Building Quality
  building_class_mix: {
    A: number;
    B: number;
    C: number;
  };
  avg_building_age?: number;
  
  // Unit Mix
  unit_mix?: {
    studio_pct: number;
    one_bed_pct: number;
    two_bed_pct: number;
    three_bed_pct: number;
  };
  
  // Data Quality
  data_sources: Array<{
    name: string;
    type: string;
    last_updated: string;
    confidence: number;
    coverage_pct: number;
  }>;
  confidence: number;
}

export interface MergeOptions {
  /**
   * How to handle conflicts between data sources
   * - 'newest': Use most recent data
   * - 'highest_confidence': Use source with highest confidence
   * - 'weighted': Weighted average based on confidence
   */
  conflictResolution: 'newest' | 'highest_confidence' | 'weighted';
  
  /**
   * Minimum confidence threshold (0-1)
   * Properties below this are excluded
   */
  minConfidence?: number;
  
  /**
   * Include intelligence metrics (opportunity scores, etc.)
   */
  includeIntelligence?: boolean;
}

// ============================================================================
// Data Aggregator Class
// ============================================================================

export class DataAggregator {
  /**
   * Aggregate array of properties into submarket-level snapshot
   * 
   * @param properties - Array of property-level data
   * @param submarketName - Name of the submarket
   * @param city - City name
   * @param state - State abbreviation
   * @param options - Aggregation options
   * @returns Submarket snapshot with aggregated metrics
   */
  aggregateToSubmarket(
    properties: PropertyData[],
    submarketName: string,
    city: string,
    state: string,
    options: Partial<MergeOptions> = {}
  ): SubmarketSnapshot {
    // Filter by confidence if specified
    const minConfidence = options.minConfidence || 0;
    const validProperties = properties.filter(
      (p) => (p.confidence_score || 1) >= minConfidence
    );

    if (validProperties.length === 0) {
      throw new Error('No valid properties after confidence filtering');
    }

    // Calculate supply metrics
    const totalUnits = this.sum(validProperties, 'total_units');
    const availableUnits = this.sum(validProperties, 'available_units', 0);
    const vacancyRate = availableUnits / totalUnits;

    // Calculate weighted average rents
    const avgRent = this.calculateWeightedRents(validProperties);

    // Calculate building class mix
    const classMix = this.calculateClassMix(validProperties);

    // Calculate unit mix
    const unitMix = this.calculateUnitMix(validProperties);

    // Calculate average building age
    const avgAge = this.calculateAverageBuildingAge(validProperties);

    // Calculate intelligence metrics
    const intelligence = this.calculateIntelligenceMetrics(validProperties);

    // Determine data sources
    const dataSources = this.aggregateDataSources(validProperties);

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(validProperties, dataSources);

    return {
      submarket_id: this.generateSubmarketId(submarketName, city, state),
      submarket_name: submarketName,
      city,
      state,
      snapshot_date: new Date().toISOString(),

      // Supply
      properties_count: validProperties.length,
      existing_units: totalUnits,
      total_supply: totalUnits,
      available_units: availableUnits,
      vacancy_rate: vacancyRate,

      // Demand
      concessions_pct: intelligence.concessions_pct,

      // Pricing
      avg_rent: avgRent,

      // Intelligence
      ...(options.includeIntelligence !== false && intelligence),

      // Quality
      building_class_mix: classMix,
      avg_building_age: avgAge,

      // Unit Mix
      unit_mix: unitMix,

      // Metadata
      data_sources: dataSources,
      confidence,
    };
  }

  /**
   * Merge snapshots from multiple data sources (e.g., ApartmentIQ + CoStar)
   * 
   * @param snapshots - Array of snapshots to merge
   * @param options - Merge options
   * @returns Single merged snapshot
   */
  mergeSnapshots(
    snapshots: SubmarketSnapshot[],
    options: MergeOptions = { conflictResolution: 'weighted' }
  ): SubmarketSnapshot {
    if (snapshots.length === 0) {
      throw new Error('No snapshots to merge');
    }

    if (snapshots.length === 1) {
      return snapshots[0];
    }

    // Verify all snapshots are for the same submarket
    const submarketId = snapshots[0].submarket_id;
    if (!snapshots.every((s) => s.submarket_id === submarketId)) {
      throw new Error('Cannot merge snapshots from different submarkets');
    }

    const base = snapshots[0];

    switch (options.conflictResolution) {
      case 'newest':
        return this.mergeNewest(snapshots);
      
      case 'highest_confidence':
        return this.mergeHighestConfidence(snapshots);
      
      case 'weighted':
      default:
        return this.mergeWeighted(snapshots);
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private sum(
    properties: PropertyData[],
    field: keyof PropertyData,
    defaultValue: number = 0
  ): number {
    return properties.reduce((sum, p) => {
      const value = p[field];
      return sum + (typeof value === 'number' ? value : defaultValue);
    }, 0);
  }

  private calculateWeightedRents(properties: PropertyData[]): {
    studio?: number;
    one_bed?: number;
    two_bed?: number;
    three_bed?: number;
    average: number;
  } {
    const totalUnits = this.sum(properties, 'total_units');

    const weightedAvg = (rentField: keyof PropertyData) => {
      let totalWeightedRent = 0;
      let totalUnitsWithData = 0;

      properties.forEach((p) => {
        const rent = p[rentField];
        if (typeof rent === 'number' && rent > 0) {
          totalWeightedRent += rent * p.total_units;
          totalUnitsWithData += p.total_units;
        }
      });

      return totalUnitsWithData > 0
        ? totalWeightedRent / totalUnitsWithData
        : undefined;
    };

    return {
      studio: weightedAvg('rent_studio'),
      one_bed: weightedAvg('rent_1bed'),
      two_bed: weightedAvg('rent_2bed'),
      three_bed: weightedAvg('rent_3bed'),
      average: weightedAvg('rent_avg') || 0,
    };
  }

  private calculateClassMix(properties: PropertyData[]): {
    A: number;
    B: number;
    C: number;
  } {
    const totalUnits = this.sum(properties, 'total_units');
    const classCounts = { A: 0, B: 0, C: 0 };

    properties.forEach((p) => {
      classCounts[p.building_class] += p.total_units;
    });

    return {
      A: totalUnits > 0 ? classCounts.A / totalUnits : 0,
      B: totalUnits > 0 ? classCounts.B / totalUnits : 0,
      C: totalUnits > 0 ? classCounts.C / totalUnits : 0,
    };
  }

  private calculateUnitMix(properties: PropertyData[]): {
    studio_pct: number;
    one_bed_pct: number;
    two_bed_pct: number;
    three_bed_pct: number;
  } | undefined {
    const propertiesWithMix = properties.filter((p) => p.unit_mix);
    if (propertiesWithMix.length === 0) return undefined;

    const totalUnits = this.sum(propertiesWithMix, 'total_units');
    const weightedMix = { studio_pct: 0, one_bed_pct: 0, two_bed_pct: 0, three_bed_pct: 0 };

    propertiesWithMix.forEach((p) => {
      if (p.unit_mix) {
        const weight = p.total_units / totalUnits;
        weightedMix.studio_pct += p.unit_mix.studio_pct * weight;
        weightedMix.one_bed_pct += p.unit_mix.one_bed_pct * weight;
        weightedMix.two_bed_pct += p.unit_mix.two_bed_pct * weight;
        weightedMix.three_bed_pct += p.unit_mix.three_bed_pct * weight;
      }
    });

    return weightedMix;
  }

  private calculateAverageBuildingAge(properties: PropertyData[]): number | undefined {
    const propertiesWithAge = properties.filter((p) => p.year_built);
    if (propertiesWithAge.length === 0) return undefined;

    const currentYear = new Date().getFullYear();
    const totalUnits = this.sum(propertiesWithAge, 'total_units');
    let weightedAge = 0;

    propertiesWithAge.forEach((p) => {
      if (p.year_built) {
        const age = currentYear - p.year_built;
        weightedAge += age * (p.total_units / totalUnits);
      }
    });

    return weightedAge;
  }

  private calculateIntelligenceMetrics(properties: PropertyData[]): {
    opportunity_score?: number;
    negotiation_success_rate?: number;
    market_pressure_index?: number;
    concessions_pct: number;
  } {
    const propertiesWithIntel = properties.filter((p) => p.opportunity_score);
    
    const avgOpportunityScore =
      propertiesWithIntel.length > 0
        ? propertiesWithIntel.reduce((sum, p) => sum + (p.opportunity_score || 0), 0) /
          propertiesWithIntel.length
        : undefined;

    const avgNegotiationRate =
      propertiesWithIntel.length > 0
        ? propertiesWithIntel.reduce((sum, p) => sum + (p.negotiation_success_rate || 0), 0) /
          propertiesWithIntel.length
        : undefined;

    // Count properties with concessions
    const propertiesWithConcessions = properties.filter((p) => p.concessions_current);
    const concessionsPct = propertiesWithConcessions.length / properties.length;

    // Market pressure index (0-10)
    let marketPressure: number | undefined;
    if (avgOpportunityScore && avgNegotiationRate) {
      marketPressure = (avgOpportunityScore + avgNegotiationRate * 10 + concessionsPct * 10) / 3;
    }

    return {
      opportunity_score: avgOpportunityScore,
      negotiation_success_rate: avgNegotiationRate,
      market_pressure_index: marketPressure,
      concessions_pct: concessionsPct,
    };
  }

  private aggregateDataSources(properties: PropertyData[]): Array<{
    name: string;
    type: string;
    last_updated: string;
    confidence: number;
    coverage_pct: number;
  }> {
    const sourceMap = new Map<string, {
      count: number;
      totalConfidence: number;
    }>();

    properties.forEach((p) => {
      const source = p.data_source;
      const existing = sourceMap.get(source) || { count: 0, totalConfidence: 0 };
      sourceMap.set(source, {
        count: existing.count + 1,
        totalConfidence: existing.totalConfidence + (p.confidence_score || 1),
      });
    });

    const totalProps = properties.length;
    const sources: Array<any> = [];

    sourceMap.forEach((data, sourceName) => {
      sources.push({
        name: sourceName,
        type: sourceName === 'apartmentiq' ? 'api' : sourceName === 'costar' ? 'api' : 'manual',
        last_updated: new Date().toISOString(),
        confidence: data.totalConfidence / data.count,
        coverage_pct: data.count / totalProps,
      });
    });

    return sources;
  }

  private calculateOverallConfidence(
    properties: PropertyData[],
    dataSources: Array<{ confidence: number; coverage_pct: number }>
  ): number {
    // Base confidence on sample size
    const sampleScore = Math.min(properties.length / 20, 1) * 0.5 + 0.5;

    // Weighted average of source confidences
    const sourceScore = dataSources.reduce(
      (sum, s) => sum + s.confidence * s.coverage_pct,
      0
    );

    // Combined score
    return sampleScore * 0.3 + sourceScore * 0.7;
  }

  private generateSubmarketId(name: string, city: string, state: string): string {
    const normalized = `${city}-${state}-${name}`
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return normalized;
  }

  // ==========================================================================
  // Merge Strategies
  // ==========================================================================

  private mergeNewest(snapshots: SubmarketSnapshot[]): SubmarketSnapshot {
    // Sort by snapshot date, return newest
    return snapshots.sort(
      (a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
    )[0];
  }

  private mergeHighestConfidence(snapshots: SubmarketSnapshot[]): SubmarketSnapshot {
    // Return snapshot with highest confidence
    return snapshots.sort((a, b) => b.confidence - a.confidence)[0];
  }

  private mergeWeighted(snapshots: SubmarketSnapshot[]): SubmarketSnapshot {
    // Weighted average based on confidence scores
    const totalConfidence = snapshots.reduce((sum, s) => sum + s.confidence, 0);
    
    if (totalConfidence === 0) {
      throw new Error('Cannot merge snapshots with zero total confidence');
    }

    const base = snapshots[0];
    
    // Merge numeric fields with weighted average
    const mergeNumeric = (field: keyof SubmarketSnapshot): number => {
      return snapshots.reduce((sum, s) => {
        const value = s[field];
        const weight = s.confidence / totalConfidence;
        return sum + (typeof value === 'number' ? value * weight : 0);
      }, 0);
    };

    // Combine data sources
    const allSources = snapshots.flatMap((s) => s.data_sources);

    return {
      ...base,
      snapshot_date: new Date().toISOString(),
      
      // Weighted averages
      existing_units: Math.round(mergeNumeric('existing_units')),
      total_supply: Math.round(mergeNumeric('total_supply')),
      available_units: Math.round(mergeNumeric('available_units')),
      vacancy_rate: mergeNumeric('vacancy_rate'),
      
      avg_rent: {
        studio: mergeNumeric('avg_rent') > 0 ? mergeNumeric('avg_rent') : undefined,
        one_bed: base.avg_rent.one_bed,
        two_bed: base.avg_rent.two_bed,
        three_bed: base.avg_rent.three_bed,
        average: mergeNumeric('avg_rent'),
      },
      
      // Combined sources
      data_sources: allSources,
      confidence: mergeNumeric('confidence'),
    };
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const dataAggregator = new DataAggregator();
