/**
 * JediRe Replacement Cost Estimator V2
 * 
 * Permit-Derived Replacement Cost with LayeredValue provenance tracking.
 * 
 * DATA SOURCES (all free/one-time cost):
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
 * 3. RSMeans CITY COST INDEX (CCI)
 *    - One-time purchase (~$400 for annual book)
 *    - Hardcoded location adjustment factors
 *    - Updated annually
 * 
 * LAYERED VALUE PATTERN:
 * - Layer 1 (platform): Permit-derived baseline
 * - Layer 2 (enrichment): PPI escalation applied
 * - Layer 3 (adjustment): CCI location factor
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
  source: 'permit_derived' | 'ppi_escalated' | 'cci_adjusted' | 'market_basket' | 'override' | 'default';
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
    cciAdjustment: {
      location: string;
      cciFactor: number;
      nationalBaseline: number;
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
// RSMeans CITY COST INDEX (2026 Edition - Hardcoded)
// Source: RSMeans Building Construction Cost Data 2026
// National Average = 100
// One-time cost: ~$400 for annual book
// ============================================================================

const RSMEANS_CCI_2026: Record<string, number> = {
  // Major Metros
  'New York, NY': 143.2,
  'San Francisco, CA': 139.8,
  'Los Angeles, CA': 123.4,
  'Boston, MA': 128.7,
  'Seattle, WA': 124.1,
  'Chicago, IL': 116.3,
  'Washington, DC': 118.9,
  'Miami, FL': 108.4,
  'Denver, CO': 106.2,
  'Austin, TX': 103.8,
  'Atlanta, GA': 99.6,
  'Dallas, TX': 97.4,
  'Houston, TX': 96.8,
  'Phoenix, AZ': 95.2,
  'Las Vegas, NV': 101.3,
  'Nashville, TN': 98.7,
  'Charlotte, NC': 96.9,
  'Tampa, FL': 99.1,
  'Orlando, FL': 97.8,
  'Raleigh, NC': 98.2,
  'Minneapolis, MN': 105.4,
  'Portland, OR': 114.2,
  'San Diego, CA': 118.6,
  'San Antonio, TX': 94.6,
  'Indianapolis, IN': 97.1,
  'Columbus, OH': 98.4,
  'Jacksonville, FL': 96.5,
  'Fort Worth, TX': 96.2,
  'Memphis, TN': 93.8,
  'Baltimore, MD': 102.3,
  'Louisville, KY': 95.7,
  'Milwaukee, WI': 103.1,
  'Albuquerque, NM': 94.2,
  'Tucson, AZ': 93.1,
  'Kansas City, MO': 99.4,
  'Sacramento, CA': 115.8,
  'Oklahoma City, OK': 91.6,
  'Richmond, VA': 97.5,
  'New Orleans, LA': 96.3,
  'Salt Lake City, UT': 98.9,
  
  // Georgia Metros (for our county data)
  'Marietta, GA': 99.2,
  'Decatur, GA': 99.8,
  'Sandy Springs, GA': 100.1,
  'Alpharetta, GA': 100.4,
  'Roswell, GA': 99.9,
  'Duluth, GA': 98.7,
  'Lawrenceville, GA': 97.8,
  'Savannah, GA': 94.6,
  'Augusta, GA': 92.3,
  'Macon, GA': 91.8,
  
  // Florida Markets
  'Fort Lauderdale, FL': 107.2,
  'West Palm Beach, FL': 106.8,
  'Naples, FL': 105.4,
  'Sarasota, FL': 100.6,
  'Fort Myers, FL': 99.3,
  
  // State-level fallbacks
  'GA': 97.5,
  'FL': 100.2,
  'TX': 96.5,
  'CA': 120.5,
  'NY': 135.2,
  'NC': 97.2,
  'TN': 96.8,
  'AZ': 94.5,
  'CO': 105.8,
  'WA': 118.5,
  'OR': 112.8,
  'NV': 100.5,
  'SC': 94.8,
  'VA': 99.2,
  'MD': 103.5,
  'PA': 105.2,
  'OH': 98.6,
  'MI': 101.3,
  'IL': 108.5,
  'MA': 125.4,
  
  // National baseline
  'national': 100.0
};

// ============================================================================
// BLS PPI SERIES FOR CONSTRUCTION
// ============================================================================

const PPI_SERIES = {
  // Producer Price Index for Construction Materials
  constructionMaterials: 'WPUIP2311001',  // Materials for construction
  newResidential: 'PCU236211236211',       // New residential construction
  multifamily: 'PCU23622123622101',        // New multifamily
  laborCosts: 'CIU2010000000000I'          // Employment Cost Index - Construction
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
    // LAYER 3: CCI Location Adjustment
    // ========================================================================
    const cciAdjustment = this.getCCIAdjustment(input.city, input.state);
    
    const cciAdjustedCostPerSF = currentCostPerSF * (cciAdjustment.cciFactor / 100);
    
    // Only apply CCI if permits aren't from same market (avoid double-counting location)
    const permitMarket = `${input.city}, ${input.state}`;
    const applyingCCI = permitBaseline.filters.county !== input.county;
    
    if (applyingCCI) {
      currentCostPerSF = cciAdjustedCostPerSF;
      currentSource = 'cci_adjusted';
      
      provenance.push({
        layer: 'cci_adjustment',
        source: 'RSMeans CCI 2026',
        value: currentCostPerSF,
        appliedAt: new Date(),
        notes: `${input.city}, ${input.state}: CCI ${cciAdjustment.cciFactor} (national = 100)`
      });
    }
    
    // ========================================================================
    // LAYER 4: User Override (if provided)
    // ========================================================================
    if (input.userOverride?.costPerSF) {
      currentCostPerSF = input.userOverride.costPerSF;
      currentSource = 'override';
      confidence = 'high'; // User-provided is authoritative
      
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
    
    // Build result
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
        cciAdjustment
      },
      methodology: 'Permit-derived baseline + BLS PPI escalation + RSMeans CCI adjustment',
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
    // Query permits from our Georgia county data
    // building_permits table has: permit_value, square_footage, permit_date
    
    let query = `
      WITH permit_costs AS (
        SELECT 
          permit_value / NULLIF(square_footage, 0) as cost_per_sf,
          permit_date,
          county,
          property_type
        FROM building_permits
        WHERE permit_value > 100000  -- Filter out small permits
          AND square_footage > 1000  -- Minimum size
          AND permit_type IN ('new_construction', 'new_building', 'new')
          AND property_type IN ('multifamily', 'apartment', 'residential_multi')
          AND permit_date > NOW() - INTERVAL '24 months'
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    // Add county filter if specified
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
        MAX(permit_date) as max_date,
        AVG(cost_per_sf) as avg_cost,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY cost_per_sf) as p25_cost,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cost_per_sf) as p75_cost
      FROM permit_costs
      WHERE cost_per_sf BETWEEN 50 AND 500  -- Reasonable range filter
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
            assetClass: input.assetClass,
            vintageRange: undefined
          }
        };
      }
    } catch (error) {
      console.warn('[ReplacementCostV2] Permit query failed:', error);
    }
    
    // Fallback to default values if no permit data
    return this.getDefaultPermitBaseline(input);
  }
  
  /**
   * Get PPI escalation factor from permit date to today
   */
  private async getPPIEscalationFactor(
    baselineDate: Date
  ): Promise<ReplacementCostResult['components']['ppiEscalation']> {
    const currentDate = new Date();
    
    // Try to get from cache first
    const cached = await this.pool.query(`
      SELECT ppi_value, as_of_date
      FROM inflation_cache
      WHERE indicator = 'PPI_CONSTRUCTION'
        AND fetched_at > NOW() - INTERVAL '7 days'
      ORDER BY as_of_date DESC
      LIMIT 2
    `).catch(() => ({ rows: [] }));
    
    let ppiBaseline = 100;
    let ppiCurrent = 100;
    let escalationFactor = 1.0;
    
    if (cached.rows.length >= 2) {
      // Use cached values
      ppiCurrent = parseFloat(cached.rows[0].ppi_value);
      ppiBaseline = parseFloat(cached.rows[1].ppi_value);
      escalationFactor = ppiCurrent / ppiBaseline;
    } else {
      // Estimate based on typical construction inflation
      const monthsElapsed = Math.max(0, 
        (currentDate.getTime() - baselineDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      
      // Assume ~4% annual construction inflation
      const annualRate = 0.04;
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
   * Get CCI location adjustment factor
   */
  private getCCIAdjustment(
    city: string,
    state: string
  ): ReplacementCostResult['components']['cciAdjustment'] {
    // Try city, state format first
    const cityKey = `${city}, ${state}`;
    let cciFactor = RSMEANS_CCI_2026[cityKey];
    let location = cityKey;
    
    // Fall back to state
    if (!cciFactor) {
      cciFactor = RSMEANS_CCI_2026[state];
      location = state;
    }
    
    // Fall back to national
    if (!cciFactor) {
      cciFactor = RSMEANS_CCI_2026.national;
      location = 'national';
    }
    
    return {
      location,
      cciFactor,
      nationalBaseline: 100
    };
  }
  
  /**
   * Default baseline when no permit data available
   */
  private getDefaultPermitBaseline(
    input: ReplacementCostInput
  ): ReplacementCostResult['components']['permitBaseline'] {
    // Default costs by asset class
    const defaultCosts: Record<string, number> = {
      'A': 225,
      'B': 185,
      'C': 155
    };
    
    const baseCost = defaultCosts[input.assetClass || 'B'] || 185;
    
    // Adjust for stories (taller = more expensive)
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
   * Get CCI for a location (public method for other services)
   */
  getCCIForLocation(city: string, state: string): number {
    return this.getCCIAdjustment(city, state).cciFactor;
  }
  
  /**
   * Store PPI values from BLS fetch (called by inflation engine)
   */
  async storePPIValue(
    ppiValue: number,
    asOfDate: Date
  ): Promise<void> {
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
