/**
 * JediRe Replacement Cost Estimator
 * 
 * Estimates the cost to rebuild/replace a multifamily property from scratch.
 * Used for:
 * - Insurance coverage validation
 * - Value-add ROI analysis
 * - Development feasibility
 * - Acquisition pricing (replacement cost vs purchase price)
 * - Obsolescence analysis
 * 
 * METHODOLOGY:
 * 1. Base construction cost ($/SF) by building type
 * 2. Quality adjustments (Class A/B/C finishes)
 * 3. Regional cost factors (ATL vs NYC vs Phoenix)
 * 4. Site work & infrastructure
 * 5. Soft costs (design, permits, fees, financing)
 * 6. Land value (separate from improvements)
 * 7. Entrepreneurial profit margin
 * 
 * OUTPUTS:
 * - Total replacement cost
 * - Cost per unit
 * - Cost per SF
 * - Breakdown by component
 * - Comparison to purchase price
 * - Insurance adequacy check
 */

import { Pool } from 'pg';
import { getMarketBasketService } from './market-basket.service';

// ============================================================================
// TYPES
// ============================================================================

export interface PropertyInput {
  // Required
  units: number;
  totalSF: number;
  stories: number;
  yearBuilt: number;
  
  // Location
  city: string;
  state: string;
  county?: string;
  
  // Building type
  constructionType: 'wood_frame' | 'masonry' | 'steel_frame' | 'concrete';
  buildingType: 'garden' | 'lowrise' | 'midrise' | 'highrise' | 'townhome';
  
  // Quality
  assetClass: 'A' | 'B' | 'C' | 'D';
  
  // Amenities (affects cost)
  amenities?: {
    pool?: boolean;
    clubhouse?: boolean;
    fitnessCenter?: boolean;
    garage?: boolean;
    elevators?: number;
    coveredParking?: number; // spaces
    surfaceParking?: number;
  };
  
  // Site
  lotSizeSF?: number;
  lotSizeAcres?: number;
  
  // Optional overrides
  landValuePerAcre?: number;
  softCostPct?: number;
}

export interface ReplacementCostEstimate {
  // Summary
  totalReplacementCost: number;
  costPerUnit: number;
  costPerSF: number;
  
  // Breakdown
  breakdown: {
    hardCosts: {
      buildingShell: number;
      interiorFinishes: number;
      mepSystems: number; // Mechanical, Electrical, Plumbing
      sitework: number;
      amenities: number;
      parking: number;
      totalHardCosts: number;
      hardCostPerSF: number;
    };
    softCosts: {
      architectDesign: number;
      engineeringCivil: number;
      permitsImpactFees: number;
      legalAccounting: number;
      insuranceDuringConstruction: number;
      financingCosts: number;
      marketingLeaseUp: number;
      contingency: number;
      totalSoftCosts: number;
      softCostPct: number;
    };
    landValue: number;
    entrepreneurialProfit: number;
  };
  
  // Factors applied
  factors: {
    baseConstructionCostPerSF: number;
    regionalFactor: number;
    qualityFactor: number;
    heightFactor: number;
    ageFactor: number; // For existing buildings, depreciation
    inflationFactor: number;
  };
  
  // Analysis
  analysis: {
    // vs purchase price
    purchasePrice?: number;
    replacementCostRatio?: number; // <1 = buying below replacement
    discountToReplacement?: number;
    
    // Insurance
    currentInsuredValue?: number;
    insuranceAdequacy?: 'adequate' | 'underinsured' | 'overinsured';
    recommendedCoverage?: number;
    
    // Development feasibility
    impliedLandValue?: number; // If sold at market cap rate
    landValuePerUnit?: number;
    
    // Age/obsolescence
    effectiveAge?: number;
    remainingEconomicLife?: number;
    physicalDepreciation?: number;
    functionalObsolescence?: number;
  };
  
  // Metadata
  estimatedAt: Date;
  methodology: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  assumptions: string[];
}

// ============================================================================
// COST TABLES
// ============================================================================

// Base construction costs per SF (national average, 2026)
const BASE_CONSTRUCTION_COSTS: Record<string, number> = {
  // Building type + construction type
  'garden_wood_frame': 165,
  'garden_masonry': 185,
  'lowrise_wood_frame': 175,
  'lowrise_masonry': 195,
  'lowrise_steel_frame': 210,
  'midrise_steel_frame': 235,
  'midrise_concrete': 255,
  'highrise_steel_frame': 285,
  'highrise_concrete': 310,
  'townhome_wood_frame': 155,
  'townhome_masonry': 175
};

// Regional cost factors (100 = national average)
const REGIONAL_FACTORS: Record<string, number> = {
  // Major metros
  'New York': 145,
  'San Francisco': 140,
  'Los Angeles': 125,
  'Boston': 130,
  'Seattle': 125,
  'Chicago': 115,
  'Washington': 120,
  'Miami': 110,
  'Denver': 108,
  'Austin': 105,
  'Atlanta': 100,
  'Dallas': 98,
  'Houston': 95,
  'Phoenix': 95,
  'Las Vegas': 100,
  'Nashville': 100,
  'Charlotte': 98,
  'Tampa': 100,
  'Orlando': 98,
  'Raleigh': 100,
  'Minneapolis': 105,
  'Portland': 115,
  'San Diego': 120,
  // States (fallback)
  'CA': 125,
  'NY': 135,
  'TX': 95,
  'FL': 100,
  'GA': 100,
  'AZ': 95,
  'CO': 105,
  'WA': 120,
  'NC': 98,
  'TN': 98,
  'SC': 95,
  'NV': 100,
  'national': 100
};

// Quality multipliers by asset class
const QUALITY_FACTORS: Record<string, number> = {
  'A': 1.25,  // Premium finishes, amenities
  'B': 1.00,  // Standard
  'C': 0.85,  // Basic finishes
  'D': 0.75   // Minimal
};

// Height/complexity factors
const HEIGHT_FACTORS: Record<number, number> = {
  1: 1.00,   // 1 story
  2: 1.00,   // 2 stories
  3: 1.02,   // 3 stories
  4: 1.05,   // 4 stories (may require elevator)
  5: 1.10,   // 5 stories
  6: 1.15,   // 6 stories
  7: 1.18,
  8: 1.22,
  9: 1.25,
  10: 1.28,
  // 10+ stories
  15: 1.35,
  20: 1.42,
  25: 1.50
};

// Amenity costs
const AMENITY_COSTS = {
  pool: 150000,           // Per pool
  clubhouse: 85,          // Per SF of clubhouse
  clubhouseTypicalSF: 2500,
  fitnessCenter: 95,      // Per SF
  fitnessCenterTypicalSF: 1500,
  elevator: 125000,       // Per elevator
  garageParking: 25000,   // Per space (structured)
  coveredParking: 8000,   // Per space (carport)
  surfaceParking: 3500    // Per space
};

// Soft cost percentages (of hard costs)
const SOFT_COST_DEFAULTS = {
  architectDesign: 0.04,      // 4%
  engineeringCivil: 0.02,     // 2%
  permitsImpactFees: 0.03,    // 3% (varies widely)
  legalAccounting: 0.01,      // 1%
  insuranceDuringConstruction: 0.01,
  financingCosts: 0.03,       // 3% (interest during construction)
  marketingLeaseUp: 0.02,     // 2%
  contingency: 0.05           // 5%
};

// Depreciation schedule (% depreciated per year of age)
const DEPRECIATION_SCHEDULE = {
  physical: {
    rate: 0.015,    // 1.5% per year
    maxYears: 50,   // 50 years = 75% max depreciation
    maxPct: 0.75
  },
  functional: {
    pre1970: 0.15,  // 15% functional obsolescence
    pre1980: 0.10,
    pre1990: 0.05,
    pre2000: 0.03,
    pre2010: 0.01,
    current: 0.00
  }
};

// ============================================================================
// SERVICE
// ============================================================================

export class ReplacementCostService {
  constructor(private pool: Pool) {}
  
  /**
   * Estimate replacement cost for a property
   */
  async estimateReplacementCost(
    input: PropertyInput,
    options?: {
      includeLand?: boolean;
      includeDepreciation?: boolean;
      purchasePrice?: number;
      currentInsuredValue?: number;
    }
  ): Promise<ReplacementCostEstimate> {
    const opts = {
      includeLand: true,
      includeDepreciation: true,
      ...options
    };
    
    // Get base construction cost
    const buildingKey = `${input.buildingType}_${input.constructionType}`;
    const baseCostPerSF = BASE_CONSTRUCTION_COSTS[buildingKey] || BASE_CONSTRUCTION_COSTS['garden_wood_frame'];
    
    // Get regional factor
    const regionalFactor = this.getRegionalFactor(input.city, input.state);
    
    // Get quality factor
    const qualityFactor = QUALITY_FACTORS[input.assetClass] || 1.0;
    
    // Get height factor
    const heightFactor = this.getHeightFactor(input.stories);
    
    // Get inflation factor from market basket
    const inflationFactor = await this.getInflationFactor(input.city, input.state);
    
    // Calculate adjusted cost per SF
    const adjustedCostPerSF = baseCostPerSF * 
      (regionalFactor / 100) * 
      qualityFactor * 
      heightFactor * 
      inflationFactor;
    
    // Calculate hard costs
    const hardCosts = this.calculateHardCosts(input, adjustedCostPerSF);
    
    // Calculate soft costs
    const softCosts = this.calculateSoftCosts(hardCosts.totalHardCosts, input.softCostPct);
    
    // Calculate land value
    const landValue = opts.includeLand ? await this.estimateLandValue(input) : 0;
    
    // Calculate entrepreneurial profit (developer margin)
    const subtotal = hardCosts.totalHardCosts + softCosts.totalSoftCosts + landValue;
    const entrepreneurialProfit = subtotal * 0.10; // 10% developer profit
    
    // Total replacement cost (new)
    let totalReplacementCost = subtotal + entrepreneurialProfit;
    
    // Apply depreciation if existing building
    let physicalDepreciation = 0;
    let functionalObsolescence = 0;
    
    if (opts.includeDepreciation && input.yearBuilt) {
      const currentYear = new Date().getFullYear();
      const age = currentYear - input.yearBuilt;
      
      // Physical depreciation
      const physicalRate = Math.min(
        age * DEPRECIATION_SCHEDULE.physical.rate,
        DEPRECIATION_SCHEDULE.physical.maxPct
      );
      physicalDepreciation = (hardCosts.totalHardCosts + softCosts.totalSoftCosts) * physicalRate;
      
      // Functional obsolescence
      let funcPct = 0;
      if (input.yearBuilt < 1970) funcPct = DEPRECIATION_SCHEDULE.functional.pre1970;
      else if (input.yearBuilt < 1980) funcPct = DEPRECIATION_SCHEDULE.functional.pre1980;
      else if (input.yearBuilt < 1990) funcPct = DEPRECIATION_SCHEDULE.functional.pre1990;
      else if (input.yearBuilt < 2000) funcPct = DEPRECIATION_SCHEDULE.functional.pre2000;
      else if (input.yearBuilt < 2010) funcPct = DEPRECIATION_SCHEDULE.functional.pre2010;
      
      functionalObsolescence = (hardCosts.totalHardCosts + softCosts.totalSoftCosts) * funcPct;
    }
    
    // Depreciated replacement cost
    const depreciatedCost = totalReplacementCost - physicalDepreciation - functionalObsolescence;
    
    // Build analysis
    const analysis = this.buildAnalysis(
      input,
      totalReplacementCost,
      depreciatedCost,
      landValue,
      physicalDepreciation,
      functionalObsolescence,
      opts.purchasePrice,
      opts.currentInsuredValue
    );
    
    // Build assumptions list
    const assumptions = this.buildAssumptions(input, opts);
    
    return {
      totalReplacementCost: Math.round(totalReplacementCost),
      costPerUnit: Math.round(totalReplacementCost / input.units),
      costPerSF: Math.round(totalReplacementCost / input.totalSF),
      
      breakdown: {
        hardCosts,
        softCosts,
        landValue: Math.round(landValue),
        entrepreneurialProfit: Math.round(entrepreneurialProfit)
      },
      
      factors: {
        baseConstructionCostPerSF: baseCostPerSF,
        regionalFactor: regionalFactor / 100,
        qualityFactor,
        heightFactor,
        ageFactor: opts.includeDepreciation ? 
          1 - ((physicalDepreciation + functionalObsolescence) / totalReplacementCost) : 1,
        inflationFactor
      },
      
      analysis,
      
      estimatedAt: new Date(),
      methodology: 'Marshall & Swift Cost Approach with JediRe Market Basket adjustments',
      confidenceLevel: this.assessConfidence(input),
      assumptions
    };
  }
  
  /**
   * Quick estimate for comparison shopping
   */
  async quickEstimate(
    units: number,
    avgUnitSF: number,
    city: string,
    state: string,
    assetClass: 'A' | 'B' | 'C' = 'B'
  ): Promise<{
    estimatedReplacementCost: number;
    costPerUnit: number;
    costPerSF: number;
    methodology: string;
  }> {
    const totalSF = units * avgUnitSF;
    
    // Determine building type from unit count
    let buildingType: PropertyInput['buildingType'] = 'garden';
    let stories = 2;
    let constructionType: PropertyInput['constructionType'] = 'wood_frame';
    
    if (units > 300) {
      buildingType = 'midrise';
      stories = 5;
      constructionType = 'steel_frame';
    } else if (units > 150) {
      buildingType = 'lowrise';
      stories = 3;
    }
    
    const estimate = await this.estimateReplacementCost({
      units,
      totalSF,
      stories,
      yearBuilt: new Date().getFullYear(), // New construction
      city,
      state,
      constructionType,
      buildingType,
      assetClass
    }, {
      includeLand: true,
      includeDepreciation: false
    });
    
    return {
      estimatedReplacementCost: estimate.totalReplacementCost,
      costPerUnit: estimate.costPerUnit,
      costPerSF: estimate.costPerSF,
      methodology: 'Quick estimate based on unit count and market'
    };
  }
  
  /**
   * Compare purchase price to replacement cost
   */
  async analyzeReplacementVsPurchase(
    input: PropertyInput,
    purchasePrice: number,
    capRate: number
  ): Promise<{
    replacementCost: number;
    purchasePrice: number;
    discountToReplacement: number;
    replacementCostRatio: number;
    impliedLandValue: number;
    developmentYieldOnCost: number;
    recommendation: string;
    details: ReplacementCostEstimate;
  }> {
    const estimate = await this.estimateReplacementCost(input, {
      purchasePrice,
      includeLand: true,
      includeDepreciation: true
    });
    
    const replacementCostRatio = purchasePrice / estimate.totalReplacementCost;
    const discountToReplacement = (1 - replacementCostRatio) * 100;
    
    // Implied land value = Purchase - Depreciated Improvements
    const depreciatedImprovements = estimate.totalReplacementCost - estimate.breakdown.landValue;
    const impliedLandValue = purchasePrice - depreciatedImprovements * (1 - 
      (estimate.analysis.physicalDepreciation || 0) / estimate.totalReplacementCost -
      (estimate.analysis.functionalObsolescence || 0) / estimate.totalReplacementCost);
    
    // Development yield on cost (if you built new at this land value)
    const noi = purchasePrice * capRate;
    const developmentYieldOnCost = noi / estimate.totalReplacementCost * 100;
    
    let recommendation: string;
    if (replacementCostRatio < 0.70) {
      recommendation = `Strong buy signal: Purchasing at ${discountToReplacement.toFixed(0)}% discount to replacement cost. ` +
        `Would cost $${(estimate.totalReplacementCost / 1000000).toFixed(1)}M to build new.`;
    } else if (replacementCostRatio < 0.85) {
      recommendation = `Reasonable value: ${discountToReplacement.toFixed(0)}% below replacement cost. ` +
        `Accounts for age/depreciation.`;
    } else if (replacementCostRatio < 1.0) {
      recommendation = `Near replacement cost: Only ${discountToReplacement.toFixed(0)}% below new construction. ` +
        `Ensure location premium justifies pricing.`;
    } else {
      recommendation = `Premium to replacement: Paying ${Math.abs(discountToReplacement).toFixed(0)}% MORE than new construction cost. ` +
        `Land value or location must justify premium.`;
    }
    
    return {
      replacementCost: estimate.totalReplacementCost,
      purchasePrice,
      discountToReplacement: Math.round(discountToReplacement * 10) / 10,
      replacementCostRatio: Math.round(replacementCostRatio * 100) / 100,
      impliedLandValue: Math.round(Math.max(0, impliedLandValue)),
      developmentYieldOnCost: Math.round(developmentYieldOnCost * 100) / 100,
      recommendation,
      details: estimate
    };
  }
  
  /**
   * Validate insurance coverage
   */
  async validateInsuranceCoverage(
    input: PropertyInput,
    currentCoverage: number
  ): Promise<{
    recommendedCoverage: number;
    currentCoverage: number;
    adequacy: 'adequate' | 'underinsured' | 'overinsured';
    gap: number;
    gapPct: number;
    recommendation: string;
  }> {
    // Insurance should cover replacement of improvements only (not land)
    const estimate = await this.estimateReplacementCost(input, {
      includeLand: false,
      includeDepreciation: false // Insurance is for replacement cost new
    });
    
    const recommendedCoverage = estimate.totalReplacementCost;
    const gap = recommendedCoverage - currentCoverage;
    const gapPct = (gap / recommendedCoverage) * 100;
    
    let adequacy: 'adequate' | 'underinsured' | 'overinsured';
    let recommendation: string;
    
    if (gapPct > 10) {
      adequacy = 'underinsured';
      recommendation = `⚠️ UNDERINSURED by $${(gap / 1000).toFixed(0)}K (${gapPct.toFixed(0)}%). ` +
        `Increase coverage to $${(recommendedCoverage / 1000000).toFixed(2)}M to fully protect against total loss.`;
    } else if (gapPct < -15) {
      adequacy = 'overinsured';
      recommendation = `Potentially overinsured by $${(Math.abs(gap) / 1000).toFixed(0)}K. ` +
        `Consider reducing coverage to save on premiums, but verify with insurance advisor.`;
    } else {
      adequacy = 'adequate';
      recommendation = `Coverage is adequate. Current coverage of $${(currentCoverage / 1000000).toFixed(2)}M ` +
        `aligns with estimated replacement cost of $${(recommendedCoverage / 1000000).toFixed(2)}M.`;
    }
    
    return {
      recommendedCoverage: Math.round(recommendedCoverage),
      currentCoverage,
      adequacy,
      gap: Math.round(gap),
      gapPct: Math.round(gapPct * 10) / 10,
      recommendation
    };
  }
  
  /**
   * Estimate value-add renovation costs
   */
  async estimateRenovationCost(
    input: PropertyInput,
    scope: {
      unitInteriors?: 'light' | 'standard' | 'full';
      unitsToRenovate?: number;
      commonAreas?: boolean;
      amenityUpgrades?: string[];
      exterior?: boolean;
      roofing?: boolean;
      hvac?: boolean;
      plumbing?: boolean;
      electrical?: boolean;
    }
  ): Promise<{
    totalCost: number;
    costPerUnit: number;
    breakdown: Record<string, number>;
    timelineMonths: number;
    recommendation: string;
  }> {
    const basketService = getMarketBasketService(this.pool);
    
    // Get market-specific pricing
    const turnCost = await basketService.getTurnCostEstimate(
      input.city,
      input.state,
      Math.round(input.totalSF / input.units),
      scope.unitInteriors || 'standard'
    );
    
    const breakdown: Record<string, number> = {};
    
    // Unit interiors
    const unitsToReno = scope.unitsToRenovate || input.units;
    if (scope.unitInteriors) {
      breakdown.unitInteriors = turnCost.total * unitsToReno;
    }
    
    // Common areas
    if (scope.commonAreas) {
      const commonAreaSF = input.units * 50; // ~50 SF per unit of common area
      breakdown.commonAreas = commonAreaSF * 35; // $35/SF
    }
    
    // Exterior
    if (scope.exterior) {
      breakdown.exterior = input.totalSF * 8; // $8/SF for paint, siding repairs
    }
    
    // Roofing
    if (scope.roofing) {
      const roofSF = input.totalSF / input.stories;
      breakdown.roofing = roofSF * 12; // $12/SF installed
    }
    
    // HVAC
    if (scope.hvac) {
      breakdown.hvac = input.units * 6500; // Full replacement per unit
    }
    
    // Plumbing
    if (scope.plumbing) {
      breakdown.plumbing = input.units * 3500; // Re-pipe per unit
    }
    
    // Electrical
    if (scope.electrical) {
      breakdown.electrical = input.units * 2500; // Panel + wiring per unit
    }
    
    // Amenity upgrades
    if (scope.amenityUpgrades) {
      let amenityCost = 0;
      for (const upgrade of scope.amenityUpgrades) {
        switch (upgrade) {
          case 'pool': amenityCost += 150000; break;
          case 'fitness': amenityCost += 150000; break;
          case 'clubhouse': amenityCost += 250000; break;
          case 'dog_park': amenityCost += 50000; break;
          case 'package_lockers': amenityCost += 25000; break;
          case 'ev_charging': amenityCost += input.units * 500; break;
        }
      }
      breakdown.amenities = amenityCost;
    }
    
    // Soft costs for renovation (lower than new construction)
    const hardCostTotal = Object.values(breakdown).reduce((a, b) => a + b, 0);
    breakdown.softCosts = hardCostTotal * 0.10; // 10% for renovation
    breakdown.contingency = hardCostTotal * 0.10; // 10% contingency
    
    const totalCost = Object.values(breakdown).reduce((a, b) => a + b, 0);
    
    // Timeline estimate
    let timelineMonths = 6; // Base
    if (scope.roofing || scope.hvac) timelineMonths += 3;
    if (scope.unitInteriors === 'full') timelineMonths += 6;
    if (unitsToReno > 100) timelineMonths += 3;
    
    const recommendation = `Estimated $${(totalCost / 1000000).toFixed(2)}M renovation ` +
      `($${Math.round(totalCost / unitsToReno).toLocaleString()}/unit) over ${timelineMonths} months. ` +
      `At ${input.units} units, budget $${Math.round(totalCost / input.units).toLocaleString()}/unit all-in.`;
    
    return {
      totalCost: Math.round(totalCost),
      costPerUnit: Math.round(totalCost / unitsToReno),
      breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, Math.round(v)])),
      timelineMonths,
      recommendation
    };
  }
  
  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================
  
  private getRegionalFactor(city: string, state: string): number {
    // Try city first
    const cityFactor = REGIONAL_FACTORS[city];
    if (cityFactor) return cityFactor;
    
    // Try state
    const stateFactor = REGIONAL_FACTORS[state];
    if (stateFactor) return stateFactor;
    
    return 100; // National average
  }
  
  private getHeightFactor(stories: number): number {
    if (stories <= 4) return HEIGHT_FACTORS[stories] || 1.0;
    if (stories <= 10) return HEIGHT_FACTORS[stories] || 1.25;
    if (stories <= 15) return HEIGHT_FACTORS[15];
    if (stories <= 20) return HEIGHT_FACTORS[20];
    return HEIGHT_FACTORS[25];
  }
  
  private async getInflationFactor(city: string, state: string): Promise<number> {
    // Get construction cost index from market basket
    try {
      const result = await this.pool.query(`
        SELECT composite_index / 100.0 as factor
        FROM market_basket_snapshots
        WHERE market = $1 AND state = $2
        ORDER BY snapshot_date DESC
        LIMIT 1
      `, [city, state]);
      
      if (result.rows[0]) {
        return parseFloat(result.rows[0].factor) || 1.0;
      }
    } catch {
      // Ignore errors, use default
    }
    
    return 1.0; // No adjustment
  }
  
  private calculateHardCosts(
    input: PropertyInput,
    adjustedCostPerSF: number
  ): ReplacementCostEstimate['breakdown']['hardCosts'] {
    // Building shell (~40% of hard costs)
    const buildingShell = input.totalSF * adjustedCostPerSF * 0.40;
    
    // Interior finishes (~30%)
    const interiorFinishes = input.totalSF * adjustedCostPerSF * 0.30;
    
    // MEP systems (~25%)
    const mepSystems = input.totalSF * adjustedCostPerSF * 0.25;
    
    // Sitework (~5%)
    const sitework = input.totalSF * adjustedCostPerSF * 0.05;
    
    // Amenities
    let amenities = 0;
    if (input.amenities) {
      if (input.amenities.pool) amenities += AMENITY_COSTS.pool;
      if (input.amenities.clubhouse) amenities += AMENITY_COSTS.clubhouse * AMENITY_COSTS.clubhouseTypicalSF;
      if (input.amenities.fitnessCenter) amenities += AMENITY_COSTS.fitnessCenter * AMENITY_COSTS.fitnessCenterTypicalSF;
      if (input.amenities.elevators) amenities += AMENITY_COSTS.elevator * input.amenities.elevators;
    }
    
    // Parking
    let parking = 0;
    if (input.amenities) {
      if (input.amenities.garage) {
        // Assume 1.5 spaces per unit for garage
        parking += input.units * 1.5 * AMENITY_COSTS.garageParking;
      } else {
        if (input.amenities.coveredParking) {
          parking += input.amenities.coveredParking * AMENITY_COSTS.coveredParking;
        }
        if (input.amenities.surfaceParking) {
          parking += input.amenities.surfaceParking * AMENITY_COSTS.surfaceParking;
        }
      }
    } else {
      // Default surface parking
      parking = input.units * 1.5 * AMENITY_COSTS.surfaceParking;
    }
    
    const totalHardCosts = buildingShell + interiorFinishes + mepSystems + sitework + amenities + parking;
    
    return {
      buildingShell: Math.round(buildingShell),
      interiorFinishes: Math.round(interiorFinishes),
      mepSystems: Math.round(mepSystems),
      sitework: Math.round(sitework),
      amenities: Math.round(amenities),
      parking: Math.round(parking),
      totalHardCosts: Math.round(totalHardCosts),
      hardCostPerSF: Math.round(totalHardCosts / input.totalSF)
    };
  }
  
  private calculateSoftCosts(
    hardCosts: number,
    overridePct?: number
  ): ReplacementCostEstimate['breakdown']['softCosts'] {
    const pcts = overridePct ? {
      ...SOFT_COST_DEFAULTS,
      total: overridePct
    } : SOFT_COST_DEFAULTS;
    
    const architectDesign = hardCosts * pcts.architectDesign;
    const engineeringCivil = hardCosts * pcts.engineeringCivil;
    const permitsImpactFees = hardCosts * pcts.permitsImpactFees;
    const legalAccounting = hardCosts * pcts.legalAccounting;
    const insuranceDuringConstruction = hardCosts * pcts.insuranceDuringConstruction;
    const financingCosts = hardCosts * pcts.financingCosts;
    const marketingLeaseUp = hardCosts * pcts.marketingLeaseUp;
    const contingency = hardCosts * pcts.contingency;
    
    const totalSoftCosts = architectDesign + engineeringCivil + permitsImpactFees +
      legalAccounting + insuranceDuringConstruction + financingCosts + marketingLeaseUp + contingency;
    
    return {
      architectDesign: Math.round(architectDesign),
      engineeringCivil: Math.round(engineeringCivil),
      permitsImpactFees: Math.round(permitsImpactFees),
      legalAccounting: Math.round(legalAccounting),
      insuranceDuringConstruction: Math.round(insuranceDuringConstruction),
      financingCosts: Math.round(financingCosts),
      marketingLeaseUp: Math.round(marketingLeaseUp),
      contingency: Math.round(contingency),
      totalSoftCosts: Math.round(totalSoftCosts),
      softCostPct: Math.round((totalSoftCosts / hardCosts) * 100)
    };
  }
  
  private async estimateLandValue(input: PropertyInput): Promise<number> {
    if (input.landValuePerAcre) {
      const acres = input.lotSizeAcres || (input.lotSizeSF ? input.lotSizeSF / 43560 : input.units * 1500 / 43560);
      return input.landValuePerAcre * acres;
    }
    
    // Estimate from regional land values
    const landValuePerUnit: Record<string, number> = {
      'New York': 150000,
      'San Francisco': 180000,
      'Los Angeles': 120000,
      'Boston': 100000,
      'Seattle': 90000,
      'Miami': 60000,
      'Denver': 50000,
      'Austin': 45000,
      'Atlanta': 35000,
      'Dallas': 30000,
      'Phoenix': 25000,
      'national': 35000
    };
    
    const perUnit = landValuePerUnit[input.city] || landValuePerUnit[input.state] || landValuePerUnit.national;
    return perUnit * input.units;
  }
  
  private buildAnalysis(
    input: PropertyInput,
    totalCost: number,
    depreciatedCost: number,
    landValue: number,
    physicalDep: number,
    functionalObs: number,
    purchasePrice?: number,
    insuredValue?: number
  ): ReplacementCostEstimate['analysis'] {
    const analysis: ReplacementCostEstimate['analysis'] = {};
    
    if (purchasePrice) {
      analysis.purchasePrice = purchasePrice;
      analysis.replacementCostRatio = Math.round((purchasePrice / totalCost) * 100) / 100;
      analysis.discountToReplacement = Math.round((1 - purchasePrice / totalCost) * 100 * 10) / 10;
    }
    
    if (insuredValue) {
      analysis.currentInsuredValue = insuredValue;
      const improvementCost = totalCost - landValue;
      if (insuredValue < improvementCost * 0.90) {
        analysis.insuranceAdequacy = 'underinsured';
      } else if (insuredValue > improvementCost * 1.15) {
        analysis.insuranceAdequacy = 'overinsured';
      } else {
        analysis.insuranceAdequacy = 'adequate';
      }
      analysis.recommendedCoverage = Math.round(improvementCost);
    }
    
    // Land value analysis
    analysis.impliedLandValue = Math.round(landValue);
    analysis.landValuePerUnit = Math.round(landValue / input.units);
    
    // Depreciation
    if (input.yearBuilt) {
      const currentYear = new Date().getFullYear();
      const age = currentYear - input.yearBuilt;
      analysis.effectiveAge = age;
      analysis.remainingEconomicLife = Math.max(0, 50 - age);
      analysis.physicalDepreciation = Math.round(physicalDep);
      analysis.functionalObsolescence = Math.round(functionalObs);
    }
    
    return analysis;
  }
  
  private buildAssumptions(input: PropertyInput, opts: any): string[] {
    const assumptions: string[] = [];
    
    assumptions.push(`Construction type: ${input.constructionType.replace('_', ' ')}`);
    assumptions.push(`Building type: ${input.buildingType}`);
    assumptions.push(`Quality level: Class ${input.assetClass}`);
    assumptions.push(`Regional cost factor applied for ${input.city}, ${input.state}`);
    
    if (opts.includeLand) {
      assumptions.push('Land value estimated based on regional comparables');
    }
    
    if (opts.includeDepreciation && input.yearBuilt) {
      assumptions.push(`Physical depreciation based on ${new Date().getFullYear() - input.yearBuilt} year age`);
    }
    
    assumptions.push('Soft costs at industry standard percentages');
    assumptions.push('10% entrepreneurial profit included');
    
    return assumptions;
  }
  
  private assessConfidence(input: PropertyInput): 'high' | 'medium' | 'low' {
    let score = 0;
    
    if (input.units && input.totalSF) score += 2;
    if (input.city && input.state) score += 2;
    if (input.constructionType) score += 1;
    if (input.yearBuilt) score += 1;
    if (input.amenities) score += 1;
    if (input.lotSizeSF || input.lotSizeAcres) score += 1;
    
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }
}

// Singleton factory
let replacementCostInstance: ReplacementCostService | null = null;

export function getReplacementCostService(pool: Pool): ReplacementCostService {
  if (!replacementCostInstance) {
    replacementCostInstance = new ReplacementCostService(pool);
  }
  return replacementCostInstance;
}
