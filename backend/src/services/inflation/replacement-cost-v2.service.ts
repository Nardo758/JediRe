/**
 * JediRe Replacement Cost Estimator V2
 * 
 * Permit-Derived Replacement Cost with LayeredValue provenance tracking.
 * 
 * DATA SOURCES (100% free — no RSMeans or paid feeds):
 * 
 * 1. PERMIT DATA (already ingested via Georgia counties)
 *    - estimated_value from building permits
 *    - Calculate median $/SF by (MSA, submarket, class, vintage)
 *    - Source: DeKalb, Fulton, Cobb, Gwinnett county GIS
 * 
 * 2. BLS PPI ESCALATION
 *    - Producer Price Index for construction materials
 *    - Index today's cost vs permit filing date
 *    - Source: BLS API (free)
 * 
 * 3. BLS REGIONAL PRICE PARITIES (RPP) + PERMIT-DERIVED
 *    - Location cost adjustment (free alternative to RSMeans)
 *    - Tier 1: Our own permit data cross-market comparison
 *    - Tier 2: BLS Regional Price Parities (state level, free)
 * 
 * LAYERED VALUE PATTERN:
 * - Layer 1 (platform): Permit-derived baseline
 * - Layer 2 (enrichment): PPI escalation applied
 * - Layer 3 (adjustment): Regional factor (permit-derived or BLS RPP)
 * - Layer 4 (override): User's construction team estimate
 * 
 * Same pattern as tax_math.service.ts
 */

import { Pool } from 'pg';

// ============================================================================
// LAYERED VALUE TYPE
// ============================================================================

export interface LayeredValue<T> {
  value: T;
  source: 'permit_derived' | 'ppi_escalated' | 'regional_adjusted' | 'market_basket' | 'override' | 'default';
  confidence: 'high' | 'medium' | 'low';
  asOf: Date;
  provenance: Array<{
    layer: string;
    source: string;
    value: T;
    appliedAt: Date;
    notes?: string;
  }>;
}

export interface ReplacementCostInput {
  // Required
  units: number;
  totalSF: number;
  
  // Location
  city: string;
  state: string;
  county?: string;
  submarket?: string;
  
  // Property characteristics
  yearBuilt?: number;
  stories?: number;
  assetClass?: 'A' | 'B' | 'C';
  constructionType?: 'wood_frame' | 'masonry' | 'steel_frame' | 'concrete';
  
  // Optional user override
  userOverride?: {
    costPerSF?: number;
    totalCost?: number;
    source?: string;
    notes?: string;
  };
}

export interface ReplacementCostResult {
  // Final values with provenance
  costPerSF: LayeredValue<number>;
  totalCost: LayeredValue<number>;
  costPerUnit: LayeredValue<number>;
  
  // Breakdown
  components: {
    permitBaseline: {
      medianCostPerSF: number;
      sampleSize: number;
      dateRange: { from: Date; to: Date };
      filters: {
        county?: string;
        assetClass?: string;
        vintageRange?: string;
      };
    };
    ppiEscalation: {
      baselineDate: Date;
      currentDate: Date;
      escalationFactor: number;
      ppiBaseline: number;
      ppiCurrent: number;
    };
    regionalAdjustment: {
      location: string;
      factor: number;
      nationalBaseline: number;
      source: string;
      methodology: string;
    };
  };
  
  // Comparison
  comparison?: {
    purchasePrice?: number;
    discountToReplacement?: number;
    insuranceCoverage?: number;
    insuranceAdequacy?: 'adequate' | 'underinsured' | 'overinsured';
  };
  
  // Metadata
  methodology: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  dataFreshness: Date;
}

// ============================================================================
// BLS REGIONAL PRICE PARITIES (RPP) - FREE
// Source: BLS Regional Price Parities by State
// https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area
// National Average = 100
// ============================================================================

const BLS_RPP_GOODS: Record<string, number> = {
  // States (BLS publishes annually, free)
  'AL': 91.8,
  'AK': 106.1,
  'AZ': 97.2,
  'AR': 90.5,
  'CA': 109.4,
  'CO': 102.1,
  'CT': 105.3,
  'DE': 100.8,
  'FL': 100.9,
  'GA': 96.8,
  'HI': 119.2,
  'ID': 96.9,
  'IL': 99.8,
  'IN': 94.7,
  'IA': 93.2,
  'KS': 93.8,
  'KY': 92.1,
  'LA': 93.9,
  'ME': 99.7,
  'MD': 104.2,
  'MA': 107.5,
  'MI': 96.4,
  'MN': 99.1,
  'MS': 89.6,
  'MO': 92.8,
  'MT': 96.3,
  'NE': 93.5,
  'NV': 100.2,
  'NH': 104.1,
  'NJ': 108.3,
  'NM': 95.4,
  'NY': 112.8,
  'NC': 95.2,
  'ND': 95.1,
  'OH': 94.2,
  'OK': 91.7,
  'OR': 101.8,
  'PA': 99.1,
  'RI': 102.9,
  'SC': 94.1,
  'SD': 94.8,
  'TN': 93.5,
  'TX': 96.2,
  'UT': 98.4,
  'VT': 102.1,
  'VA': 100.4,
  'WA': 105.8,
  'WV': 91.2,
  'WI': 96.2,
  'WY': 96.7,
  'DC': 108.9,
  
  // National baseline
  'national': 100.0
};

// ============================================================================
// BLS PPI SERIES FOR CONSTRUCTION
// ============================================================================

const PPI_SERIES = {
  constructionMaterials: 'WPUIP2311001',
  newResidential: 'PCU236211236211',
  multifamily: 'PCU23622123622101',
  laborCosts: 'CIU2010000000000I'
};

// ============================================================================
// SERVICE
// ============================================================================

export class ReplacementCostServiceV2 {
  constructor(private pool: Pool) {}
  
  /**
   * Estimate replacement cost using permit-derived methodology
   */
  async estimateReplacementCost(
    input: ReplacementCostInput
  ): Promise<ReplacementCostResult> {
    const provenance: LayeredValue<number>['provenance'] = [];
    
    // ========================================================================
    // LAYER 1: Permit-Derived Baseline
    // ========================================================================
    const permitBaseline = await this.getPermitDerivedCostPerSF(input);
    
    let currentCostPerSF = permitBaseline.medianCostPerSF;
    let currentSource: LayeredValue<number>['source'] = 'permit_derived';
    let confidence: LayeredValue<number>['confidence'] = 
      permitBaseline.sampleSize >= 20 ? 'high' : 
      permitBaseline.sampleSize >= 5 ? 'medium' : 'low';
    
    provenance.push({
      layer: 'permit_baseline',
      source: `${permitBaseline.sampleSize} permits from ${input.county || input.state}`,
      value: currentCostPerSF,
      appliedAt: new Date(),
      notes: `Median $/SF from permits filed ${permitBaseline.dateRange.from.toLocaleDateString()} - ${permitBaseline.dateRange.to.toLocaleDateString()}`
    });
    
    // ========================================================================
    // LAYER 2: PPI Escalation (adjust for inflation since permit date)
    // ========================================================================
    const ppiEscalation = await this.getPPIEscalationFactor(permitBaseline.dateRange.to);
    
    const escalatedCostPerSF = currentCostPerSF * ppiEscalation.escalationFactor;
    currentCostPerSF = escalatedCostPerSF;
    currentSource = 'ppi_escalated';
    
    provenance.push({
      layer: 'ppi_escalation',
      source: `BLS PPI ${PPI_SERIES.constructionMaterials}`,
      value: currentCostPerSF,
      appliedAt: new Date(),
      notes: `${((ppiEscalation.escalationFactor - 1) * 100).toFixed(1)}% escalation from ${ppiEscalation.baselineDate.toLocaleDateString()}`
    });
    
    // ========================================================================
    // LAYER 3: Regional Location Adjustment (Permit-Derived or BLS RPP)
    // ========================================================================
    const regionalAdjustment = await this.getRegionalAdjustment(input, permitBaseline);
    
    const adjustedCostPerSF = currentCostPerSF * (regionalAdjustment.factor / 100);
    
    // Only apply if target market differs from permit source market
    const applyingRegional = permitBaseline.filters.county !== input.county;
    
    if (applyingRegional && Math.abs(regionalAdjustment.factor - 100) > 2) {
      currentCostPerSF = adjustedCostPerSF;
      currentSource = 'regional_adjusted';
      
      provenance.push({
        layer: 'regional_adjustment',
        source: regionalAdjustment.source,
        value: currentCostPerSF,
        appliedAt: new Date(),
        notes: `${input.city}, ${input.state}: Factor ${regionalAdjustment.factor} (national = 100) - ${regionalAdjustment.methodology}`
      });
    }
    
    // ========================================================================
    // LAYER 4: User Override (if provided)
    // ========================================================================
    if (input.userOverride?.costPerSF) {
      currentCostPerSF = input.userOverride.costPerSF;
      currentSource = 'override';
      confidence = 'high';
      
      provenance.push({
        layer: 'user_override',
        source: input.userOverride.source || 'User input',
        value: currentCostPerSF,
        appliedAt: new Date(),
        notes: input.userOverride.notes
      });
    }
    
    // ========================================================================
    // CALCULATE FINAL VALUES
    // ========================================================================
    const totalCost = currentCostPerSF * input.totalSF;
    const costPerUnit = totalCost / input.units;
    
    const result: ReplacementCostResult = {
      costPerSF: {
        value: Math.round(currentCostPerSF * 100) / 100,
        source: currentSource,
        confidence,
        asOf: new Date(),
        provenance
      },
      totalCost: {
        value: Math.round(totalCost),
        source: currentSource,
        confidence,
        asOf: new Date(),
        provenance
      },
      costPerUnit: {
        value: Math.round(costPerUnit),
        source: currentSource,
        confidence,
        asOf: new Date(),
        provenance
      },
      components: {
        permitBaseline,
        ppiEscalation,
        regionalAdjustment: {
          location: `${input.city}, ${input.state}`,
          factor: regionalAdjustment.factor,
          nationalBaseline: 100,
          source: regionalAdjustment.source,
          methodology: regionalAdjustment.methodology
        }
      },
      methodology: 'Permit-derived baseline + BLS PPI escalation + Regional adjustment (permit-derived or BLS RPP)',
      confidenceLevel: confidence,
      dataFreshness: permitBaseline.dateRange.to
    };
    
    return result;
  }
  
  /**
   * Get permit-derived cost per SF from our ingested county data
   */
  private async getPermitDerivedCostPerSF(
    input: ReplacementCostInput
  ): Promise<ReplacementCostResult['components']['permitBaseline']> {
    let query = `
      WITH permit_costs AS (
        SELECT 
          permit_value / NULLIF(square_footage, 0) as cost_per_sf,
          permit_date,
          county,
          property_type
        FROM building_permits
        WHERE permit_value > 100000
          AND square_footage > 1000
          AND permit_type IN ('new_construction', 'new_building', 'new')
          AND property_type IN ('multifamily', 'apartment', 'residential_multi')
          AND permit_date > NOW() - INTERVAL '24 months'
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (input.county) {
      query += ` AND county ILIKE $${paramIndex}`;
      params.push(`%${input.county}%`);
      paramIndex++;
    } else if (input.state) {
      query += ` AND state = $${paramIndex}`;
      params.push(input.state);
      paramIndex++;
    }
    
    query += `
      )
      SELECT 
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_per_sf) as median_cost,
        COUNT(*) as sample_size,
        MIN(permit_date) as min_date,
        MAX(permit_date) as max_date
      FROM permit_costs
      WHERE cost_per_sf BETWEEN 50 AND 500
    `;
    
    try {
      const result = await this.pool.query(query, params);
      
      if (result.rows[0] && result.rows[0].sample_size > 0) {
        const row = result.rows[0];
        return {
          medianCostPerSF: parseFloat(row.median_cost) || 185,
          sampleSize: parseInt(row.sample_size),
          dateRange: {
            from: new Date(row.min_date),
            to: new Date(row.max_date)
          },
          filters: {
            county: input.county,
            assetClass: input.assetClass
          }
        };
      }
    } catch (error) {
      console.warn('[ReplacementCostV2] Permit query failed:', error);
    }
    
    return this.getDefaultPermitBaseline(input);
  }
  
  /**
   * Get PPI escalation factor from permit date to today
   */
  private async getPPIEscalationFactor(
    baselineDate: Date
  ): Promise<ReplacementCostResult['components']['ppiEscalation']> {
    const currentDate = new Date();
    
    const cached = await this.pool.query(`
      SELECT data->>'ppi_value' as ppi_value, data->>'as_of_date' as as_of_date
      FROM inflation_cache
      WHERE indicator = 'PPI_CONSTRUCTION'
        AND fetched_at > NOW() - INTERVAL '7 days'
      ORDER BY fetched_at DESC
      LIMIT 1
    `).catch(() => ({ rows: [] }));
    
    let ppiBaseline = 100;
    let ppiCurrent = 100;
    let escalationFactor = 1.0;
    
    if (cached.rows[0]?.ppi_value) {
      ppiCurrent = parseFloat(cached.rows[0].ppi_value);
      ppiBaseline = 100;
      escalationFactor = ppiCurrent / ppiBaseline;
    } else {
      // Estimate based on typical construction inflation
      const monthsElapsed = Math.max(0, 
        (currentDate.getTime() - baselineDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      
      const annualRate = 0.04; // ~4% annual construction inflation
      escalationFactor = Math.pow(1 + annualRate, monthsElapsed / 12);
      
      ppiBaseline = 100;
      ppiCurrent = 100 * escalationFactor;
    }
    
    return {
      baselineDate,
      currentDate,
      escalationFactor: Math.round(escalationFactor * 1000) / 1000,
      ppiBaseline: Math.round(ppiBaseline * 10) / 10,
      ppiCurrent: Math.round(ppiCurrent * 10) / 10
    };
  }
  
  /**
   * Get regional location adjustment factor
   * TIER 1: Permit-derived cross-market factor (our own data)
   * TIER 2: BLS Regional Price Parities (free, state-level)
   */
  private async getRegionalAdjustment(
    input: ReplacementCostInput,
    permitBaseline: ReplacementCostResult['components']['permitBaseline']
  ): Promise<{
    factor: number;
    source: string;
    methodology: string;
  }> {
    // TIER 1: Try permit-derived cross-market factor
    const permitDerivedFactor = await this.getPermitDerivedRegionalFactor(
      input.city,
      input.state,
      input.county
    );
    
    if (permitDerivedFactor.sampleSize >= 10) {
      return {
        factor: permitDerivedFactor.factor,
        source: `JediRe permit data (${permitDerivedFactor.sampleSize} permits)`,
        methodology: 'permit_derived'
      };
    }
    
    // TIER 2: Fall back to BLS Regional Price Parities
    const blsRPP = BLS_RPP_GOODS[input.state] || 100;
    
    return {
      factor: blsRPP,
      source: 'BLS Regional Price Parities',
      methodology: 'bls_rpp'
    };
  }
  
  /**
   * Calculate permit-derived regional factor by comparing markets
   */
  private async getPermitDerivedRegionalFactor(
    city: string,
    state: string,
    county?: string
  ): Promise<{ factor: number; sampleSize: number }> {
    try {
      // Get median cost for target market
      const targetResult = await this.pool.query(`
        WITH permit_costs AS (
          SELECT permit_value / NULLIF(square_footage, 0) as cost_per_sf
          FROM building_permits
          WHERE permit_value > 100000
            AND square_footage > 1000
            AND permit_type IN ('new_construction', 'new_building', 'new')
            AND property_type IN ('multifamily', 'apartment', 'residential_multi')
            AND permit_date > NOW() - INTERVAL '24 months'
            AND (county ILIKE $1 OR city ILIKE $2)
            AND state = $3
        )
        SELECT 
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_per_sf) as median_cost,
          COUNT(*) as sample_size
        FROM permit_costs
        WHERE cost_per_sf BETWEEN 50 AND 500
      `, [county ? `%${county}%` : '%', `%${city}%`, state]);
      
      // Get national median
      const nationalResult = await this.pool.query(`
        WITH permit_costs AS (
          SELECT permit_value / NULLIF(square_footage, 0) as cost_per_sf
          FROM building_permits
          WHERE permit_value > 100000
            AND square_footage > 1000
            AND permit_type IN ('new_construction', 'new_building', 'new')
            AND property_type IN ('multifamily', 'apartment', 'residential_multi')
            AND permit_date > NOW() - INTERVAL '24 months'
        )
        SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cost_per_sf) as median_cost
        FROM permit_costs
        WHERE cost_per_sf BETWEEN 50 AND 500
      `);
      
      if (targetResult.rows[0]?.median_cost && nationalResult.rows[0]?.median_cost) {
        const targetMedian = parseFloat(targetResult.rows[0].median_cost);
        const nationalMedian = parseFloat(nationalResult.rows[0].median_cost);
        const factor = (targetMedian / nationalMedian) * 100;
        
        return {
          factor: Math.round(factor * 10) / 10,
          sampleSize: parseInt(targetResult.rows[0].sample_size) || 0
        };
      }
    } catch (error) {
      console.warn('[ReplacementCostV2] Permit regional factor query failed:', error);
    }
    
    return { factor: 100, sampleSize: 0 };
  }
  
  /**
   * Default baseline when no permit data available
   */
  private getDefaultPermitBaseline(
    input: ReplacementCostInput
  ): ReplacementCostResult['components']['permitBaseline'] {
    const defaultCosts: Record<string, number> = {
      'A': 225,
      'B': 185,
      'C': 155
    };
    
    const baseCost = defaultCosts[input.assetClass || 'B'] || 185;
    
    let heightMultiplier = 1.0;
    if (input.stories) {
      if (input.stories > 4) heightMultiplier = 1.15;
      if (input.stories > 8) heightMultiplier = 1.30;
    }
    
    return {
      medianCostPerSF: baseCost * heightMultiplier,
      sampleSize: 0,
      dateRange: {
        from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        to: new Date()
      },
      filters: {
        assetClass: input.assetClass
      }
    };
  }
  
  /**
   * Compare to purchase price
   */
  async compareToAcquisition(
    input: ReplacementCostInput,
    purchasePrice: number,
    insuranceCoverage?: number
  ): Promise<ReplacementCostResult> {
    const result = await this.estimateReplacementCost(input);
    
    result.comparison = {
      purchasePrice,
      discountToReplacement: Math.round(
        (1 - purchasePrice / result.totalCost.value) * 100 * 10
      ) / 10
    };
    
    if (insuranceCoverage) {
      result.comparison.insuranceCoverage = insuranceCoverage;
      const coverageRatio = insuranceCoverage / result.totalCost.value;
      
      if (coverageRatio < 0.90) {
        result.comparison.insuranceAdequacy = 'underinsured';
      } else if (coverageRatio > 1.15) {
        result.comparison.insuranceAdequacy = 'overinsured';
      } else {
        result.comparison.insuranceAdequacy = 'adequate';
      }
    }
    
    return result;
  }
  
  /**
   * Batch estimate for portfolio
   */
  async batchEstimate(
    properties: ReplacementCostInput[]
  ): Promise<ReplacementCostResult[]> {
    return Promise.all(
      properties.map(p => this.estimateReplacementCost(p))
    );
  }
  
  /**
   * Get regional factor for a location (public method)
   */
  async getRegionalFactorForLocation(city: string, state: string, county?: string): Promise<{
    factor: number;
    source: string;
    methodology: string;
  }> {
    return this.getRegionalAdjustment(
      { units: 0, totalSF: 0, city, state, county },
      { medianCostPerSF: 0, sampleSize: 0, dateRange: { from: new Date(), to: new Date() }, filters: {} }
    );
  }
  
  /**
   * Get BLS RPP for a state (sync, for quick lookups)
   */
  getBLSRPPForState(state: string): number {
    return BLS_RPP_GOODS[state] || 100;
  }
  
  /**
   * Store PPI values from BLS fetch
   */
  async storePPIValue(ppiValue: number, asOfDate: Date): Promise<void> {
    await this.pool.query(`
      INSERT INTO inflation_cache (indicator, geography, data, fetched_at)
      VALUES ('PPI_CONSTRUCTION', 'national', $1, NOW())
      ON CONFLICT (indicator, geography)
      DO UPDATE SET data = $1, fetched_at = NOW()
    `, [{ ppi_value: ppiValue, as_of_date: asOfDate }]);
  }
}

// Singleton factory
let replacementCostV2Instance: ReplacementCostServiceV2 | null = null;

export function getReplacementCostServiceV2(pool: Pool): ReplacementCostServiceV2 {
  if (!replacementCostV2Instance) {
    replacementCostV2Instance = new ReplacementCostServiceV2(pool);
  }
  return replacementCostV2Instance;
}
