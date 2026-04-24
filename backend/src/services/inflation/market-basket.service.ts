/**
 * JediRe Market Basket Tracker
 * 
 * Tracks actual prices of specific items/goods in each market that directly
 * impact multifamily operations and resident affordability.
 * 
 * CATEGORIES:
 * 
 * 1. RESIDENT AFFORDABILITY BASKET
 *    - Gasoline (commute costs → location desirability)
 *    - Groceries (Kroger, Publix, Walmart basket)
 *    - Utilities (electricity, gas, water rates)
 *    - Childcare (daycare costs)
 *    - Healthcare (urgent care visit, prescriptions)
 *    - Auto insurance
 *    - Cell phone plans
 * 
 * 2. PROPERTY OPERATIONS BASKET
 *    - HVAC units (Carrier, Trane)
 *    - Appliances (refrigerators, washers, stoves)
 *    - Flooring (carpet, LVP per SF)
 *    - Paint (5-gal buckets)
 *    - Roofing (per square)
 *    - Landscaping (hourly labor)
 *    - Pest control (monthly contract)
 *    - Pool chemicals
 *    - Dumpster service
 * 
 * 3. LABOR COST BASKET
 *    - Maintenance tech hourly wage
 *    - Leasing agent salary
 *    - Property manager salary
 *    - HVAC contractor rate
 *    - Plumber contractor rate
 *    - Electrician contractor rate
 *    - Painter contractor rate
 * 
 * 4. CONSTRUCTION BASKET
 *    - Lumber (2x4, plywood)
 *    - Concrete (per yard)
 *    - Steel (rebar, studs)
 *    - Drywall (per sheet)
 *    - Windows (standard sizes)
 *    - Doors (interior, exterior)
 *    - Electrical wire
 *    - PVC pipe
 * 
 * SOURCES:
 * - Manual entry by property managers
 * - Scraped from Home Depot, Lowe's, Grainger
 * - BLS regional price data
 * - Utility company rate schedules
 * - Job posting salary data
 */

import { Pool } from 'pg';

// ============================================================================
// TYPES
// ============================================================================

export interface BasketItem {
  id: string;
  category: BasketCategory;
  name: string;
  description: string;
  unit: string; // 'gallon', 'each', 'sqft', 'hour', 'month', etc.
  
  // For scraping
  sources: Array<{
    name: string; // 'home_depot', 'lowes', 'bls', 'manual'
    url?: string;
    selector?: string; // CSS selector for scraping
  }>;
}

export type BasketCategory = 
  | 'resident_affordability'
  | 'property_operations'
  | 'labor_costs'
  | 'construction_materials';

export interface PriceObservation {
  itemId: string;
  market: string; // MSA or county
  state: string;
  price: number;
  unit: string;
  source: string;
  observedAt: Date;
  
  // For comparison
  priorPrice?: number;
  priorDate?: Date;
  changePct?: number;
}

export interface MarketBasketIndex {
  market: string;
  state: string;
  asOf: Date;
  
  // Category indices (100 = national baseline)
  residentAffordabilityIndex: number;
  propertyOperationsIndex: number;
  laborCostIndex: number;
  constructionIndex: number;
  
  // Composite
  compositeIndex: number;
  
  // YoY changes
  residentAffordabilityYoY: number;
  propertyOperationsYoY: number;
  laborCostYoY: number;
  constructionYoY: number;
  compositeYoY: number;
  
  // Trend
  trend: 'accelerating' | 'stable' | 'decelerating';
  
  // Notable items
  hottestItems: Array<{ name: string; changePct: number }>;
  coolestItems: Array<{ name: string; changePct: number }>;
}

export interface AffordabilityImpact {
  market: string;
  
  // Monthly costs for typical resident
  typicalMonthlyBudget: {
    rent: number;
    utilities: number;
    groceries: number;
    transportation: number;
    healthcare: number;
    childcare: number;
    other: number;
    total: number;
  };
  
  // Required income for 30% rent-to-income
  requiredIncomeForRent: number;
  
  // Actual median income
  medianHouseholdIncome: number;
  
  // Affordability ratio
  affordabilityRatio: number; // <1 = affordable, >1 = stretched
  
  // YoY change in total cost of living
  costOfLivingChangeYoY: number;
  
  // Rent headroom (how much rent can increase before hitting affordability ceiling)
  rentHeadroomPct: number;
}

// ============================================================================
// BASKET DEFINITIONS
// ============================================================================

export const RESIDENT_AFFORDABILITY_ITEMS: BasketItem[] = [
  {
    id: 'gas_regular',
    category: 'resident_affordability',
    name: 'Regular Gasoline',
    description: 'Regular unleaded gasoline per gallon',
    unit: 'gallon',
    sources: [
      { name: 'gasbuddy', url: 'https://www.gasbuddy.com/gasprices/{state}' },
      { name: 'aaa', url: 'https://gasprices.aaa.com/state-gas-price-averages/' }
    ]
  },
  {
    id: 'electricity_kwh',
    category: 'resident_affordability',
    name: 'Electricity',
    description: 'Residential electricity rate per kWh',
    unit: 'kWh',
    sources: [
      { name: 'eia', url: 'https://www.eia.gov/electricity/monthly/' }
    ]
  },
  {
    id: 'natural_gas_therm',
    category: 'resident_affordability',
    name: 'Natural Gas',
    description: 'Residential natural gas per therm',
    unit: 'therm',
    sources: [
      { name: 'eia', url: 'https://www.eia.gov/naturalgas/' }
    ]
  },
  {
    id: 'water_1000gal',
    category: 'resident_affordability',
    name: 'Water',
    description: 'Municipal water per 1000 gallons',
    unit: '1000gal',
    sources: [
      { name: 'manual', url: '' }
    ]
  },
  {
    id: 'groceries_basket',
    category: 'resident_affordability',
    name: 'Grocery Basket',
    description: 'Weekly grocery basket (milk, bread, eggs, chicken, produce)',
    unit: 'basket',
    sources: [
      { name: 'bls', url: '' },
      { name: 'numbeo', url: 'https://www.numbeo.com/cost-of-living/' }
    ]
  },
  {
    id: 'auto_insurance_6mo',
    category: 'resident_affordability',
    name: 'Auto Insurance',
    description: '6-month auto insurance premium (average driver)',
    unit: '6mo_premium',
    sources: [
      { name: 'insurance_com', url: '' }
    ]
  },
  {
    id: 'childcare_monthly',
    category: 'resident_affordability',
    name: 'Childcare',
    description: 'Monthly childcare/daycare cost',
    unit: 'month',
    sources: [
      { name: 'care_com', url: '' },
      { name: 'childcare_aware', url: '' }
    ]
  },
  {
    id: 'health_urgent_care',
    category: 'resident_affordability',
    name: 'Urgent Care Visit',
    description: 'Average urgent care visit cost',
    unit: 'visit',
    sources: [
      { name: 'fair_health', url: '' }
    ]
  },
  {
    id: 'cell_phone_plan',
    category: 'resident_affordability',
    name: 'Cell Phone Plan',
    description: 'Unlimited talk/text/data plan',
    unit: 'month',
    sources: [
      { name: 'manual', url: '' }
    ]
  }
];

export const PROPERTY_OPERATIONS_ITEMS: BasketItem[] = [
  {
    id: 'hvac_unit_3ton',
    category: 'property_operations',
    name: 'HVAC Unit (3-ton)',
    description: 'Complete 3-ton HVAC system installed',
    unit: 'each',
    sources: [
      { name: 'hvac_direct', url: '' },
      { name: 'manual', url: '' }
    ]
  },
  {
    id: 'refrigerator_standard',
    category: 'property_operations',
    name: 'Refrigerator',
    description: 'Standard 18 cu ft refrigerator',
    unit: 'each',
    sources: [
      { name: 'home_depot', url: 'https://www.homedepot.com/b/Appliances-Refrigerators/N-5yc1vZc3pi' },
      { name: 'lowes', url: '' }
    ]
  },
  {
    id: 'washer_standard',
    category: 'property_operations',
    name: 'Washer',
    description: 'Top-load washer',
    unit: 'each',
    sources: [
      { name: 'home_depot', url: '' },
      { name: 'lowes', url: '' }
    ]
  },
  {
    id: 'stove_electric',
    category: 'property_operations',
    name: 'Electric Range',
    description: 'Standard electric range/stove',
    unit: 'each',
    sources: [
      { name: 'home_depot', url: '' },
      { name: 'lowes', url: '' }
    ]
  },
  {
    id: 'carpet_sqft',
    category: 'property_operations',
    name: 'Carpet',
    description: 'Apartment-grade carpet installed per sqft',
    unit: 'sqft',
    sources: [
      { name: 'home_depot', url: '' },
      { name: 'empire_today', url: '' }
    ]
  },
  {
    id: 'lvp_sqft',
    category: 'property_operations',
    name: 'Luxury Vinyl Plank',
    description: 'LVP flooring installed per sqft',
    unit: 'sqft',
    sources: [
      { name: 'home_depot', url: '' },
      { name: 'lowes', url: '' }
    ]
  },
  {
    id: 'paint_5gal',
    category: 'property_operations',
    name: 'Interior Paint',
    description: '5-gallon bucket interior paint',
    unit: '5gal',
    sources: [
      { name: 'home_depot', url: '' },
      { name: 'sherwin_williams', url: '' }
    ]
  },
  {
    id: 'water_heater_50gal',
    category: 'property_operations',
    name: 'Water Heater (50 gal)',
    description: '50-gallon electric water heater',
    unit: 'each',
    sources: [
      { name: 'home_depot', url: '' },
      { name: 'lowes', url: '' }
    ]
  },
  {
    id: 'pest_control_monthly',
    category: 'property_operations',
    name: 'Pest Control',
    description: 'Monthly pest control per unit',
    unit: 'unit/month',
    sources: [
      { name: 'manual', url: '' }
    ]
  },
  {
    id: 'dumpster_service',
    category: 'property_operations',
    name: 'Dumpster Service',
    description: 'Monthly dumpster/trash service per unit',
    unit: 'unit/month',
    sources: [
      { name: 'manual', url: '' }
    ]
  },
  {
    id: 'landscaping_monthly',
    category: 'property_operations',
    name: 'Landscaping',
    description: 'Monthly landscaping per unit',
    unit: 'unit/month',
    sources: [
      { name: 'manual', url: '' }
    ]
  },
  {
    id: 'pool_chemicals_month',
    category: 'property_operations',
    name: 'Pool Chemicals',
    description: 'Monthly pool chemical cost (per pool)',
    unit: 'pool/month',
    sources: [
      { name: 'manual', url: '' }
    ]
  }
];

export const LABOR_COST_ITEMS: BasketItem[] = [
  {
    id: 'maintenance_tech_hr',
    category: 'labor_costs',
    name: 'Maintenance Tech',
    description: 'Maintenance technician hourly wage',
    unit: 'hour',
    sources: [
      { name: 'indeed', url: '' },
      { name: 'bls', url: '' }
    ]
  },
  {
    id: 'leasing_agent_annual',
    category: 'labor_costs',
    name: 'Leasing Agent',
    description: 'Leasing agent annual salary',
    unit: 'year',
    sources: [
      { name: 'indeed', url: '' },
      { name: 'glassdoor', url: '' }
    ]
  },
  {
    id: 'property_manager_annual',
    category: 'labor_costs',
    name: 'Property Manager',
    description: 'Property manager annual salary',
    unit: 'year',
    sources: [
      { name: 'indeed', url: '' },
      { name: 'glassdoor', url: '' }
    ]
  },
  {
    id: 'hvac_contractor_hr',
    category: 'labor_costs',
    name: 'HVAC Contractor',
    description: 'HVAC contractor hourly rate',
    unit: 'hour',
    sources: [
      { name: 'manual', url: '' }
    ]
  },
  {
    id: 'plumber_hr',
    category: 'labor_costs',
    name: 'Plumber',
    description: 'Licensed plumber hourly rate',
    unit: 'hour',
    sources: [
      { name: 'manual', url: '' }
    ]
  },
  {
    id: 'electrician_hr',
    category: 'labor_costs',
    name: 'Electrician',
    description: 'Licensed electrician hourly rate',
    unit: 'hour',
    sources: [
      { name: 'manual', url: '' }
    ]
  },
  {
    id: 'painter_hr',
    category: 'labor_costs',
    name: 'Painter',
    description: 'Professional painter hourly rate',
    unit: 'hour',
    sources: [
      { name: 'manual', url: '' }
    ]
  },
  {
    id: 'general_labor_hr',
    category: 'labor_costs',
    name: 'General Labor',
    description: 'General laborer hourly rate',
    unit: 'hour',
    sources: [
      { name: 'manual', url: '' }
    ]
  }
];

export const CONSTRUCTION_ITEMS: BasketItem[] = [
  {
    id: 'lumber_2x4_8ft',
    category: 'construction_materials',
    name: 'Lumber 2x4x8',
    description: '2x4 lumber, 8 foot',
    unit: 'each',
    sources: [
      { name: 'home_depot', url: '' },
      { name: 'lowes', url: '' }
    ]
  },
  {
    id: 'plywood_4x8_half',
    category: 'construction_materials',
    name: 'Plywood 1/2"',
    description: '4x8 plywood sheet, 1/2 inch',
    unit: 'sheet',
    sources: [
      { name: 'home_depot', url: '' },
      { name: 'lowes', url: '' }
    ]
  },
  {
    id: 'concrete_yard',
    category: 'construction_materials',
    name: 'Ready-Mix Concrete',
    description: 'Ready-mix concrete per cubic yard',
    unit: 'yard',
    sources: [
      { name: 'manual', url: '' }
    ]
  },
  {
    id: 'rebar_20ft',
    category: 'construction_materials',
    name: 'Rebar #4',
    description: '#4 rebar, 20 foot',
    unit: 'each',
    sources: [
      { name: 'home_depot', url: '' }
    ]
  },
  {
    id: 'drywall_4x8_half',
    category: 'construction_materials',
    name: 'Drywall',
    description: '4x8 drywall sheet, 1/2 inch',
    unit: 'sheet',
    sources: [
      { name: 'home_depot', url: '' },
      { name: 'lowes', url: '' }
    ]
  },
  {
    id: 'window_standard',
    category: 'construction_materials',
    name: 'Window (Standard)',
    description: 'Standard vinyl window 36x48',
    unit: 'each',
    sources: [
      { name: 'home_depot', url: '' },
      { name: 'lowes', url: '' }
    ]
  },
  {
    id: 'exterior_door',
    category: 'construction_materials',
    name: 'Exterior Door',
    description: 'Steel exterior door with frame',
    unit: 'each',
    sources: [
      { name: 'home_depot', url: '' },
      { name: 'lowes', url: '' }
    ]
  },
  {
    id: 'roofing_square',
    category: 'construction_materials',
    name: 'Roofing Shingles',
    description: 'Architectural shingles per square (100 sqft)',
    unit: 'square',
    sources: [
      { name: 'home_depot', url: '' },
      { name: 'lowes', url: '' }
    ]
  },
  {
    id: 'copper_wire_12g_250',
    category: 'construction_materials',
    name: 'Electrical Wire',
    description: '12-gauge Romex, 250 ft roll',
    unit: 'roll',
    sources: [
      { name: 'home_depot', url: '' },
      { name: 'lowes', url: '' }
    ]
  },
  {
    id: 'pvc_pipe_10ft',
    category: 'construction_materials',
    name: 'PVC Pipe',
    description: '4-inch PVC pipe, 10 ft',
    unit: 'each',
    sources: [
      { name: 'home_depot', url: '' },
      { name: 'lowes', url: '' }
    ]
  }
];

export const ALL_BASKET_ITEMS = [
  ...RESIDENT_AFFORDABILITY_ITEMS,
  ...PROPERTY_OPERATIONS_ITEMS,
  ...LABOR_COST_ITEMS,
  ...CONSTRUCTION_ITEMS
];

// ============================================================================
// SERVICE
// ============================================================================

export class MarketBasketService {
  constructor(private pool: Pool) {}
  
  /**
   * Get market basket index for a geography
   */
  async getMarketBasketIndex(market: string, state: string): Promise<MarketBasketIndex> {
    // Get latest prices for this market
    const currentPrices = await this.pool.query(`
      SELECT 
        item_id,
        category,
        price,
        observed_at
      FROM market_basket_prices
      WHERE market = $1 AND state = $2
        AND observed_at > NOW() - INTERVAL '30 days'
      ORDER BY observed_at DESC
    `, [market, state]);
    
    // Get prior year prices for YoY
    const priorPrices = await this.pool.query(`
      SELECT 
        item_id,
        category,
        price,
        observed_at
      FROM market_basket_prices
      WHERE market = $1 AND state = $2
        AND observed_at BETWEEN NOW() - INTERVAL '14 months' AND NOW() - INTERVAL '10 months'
      ORDER BY observed_at DESC
    `, [market, state]);
    
    // Get national baseline
    const nationalPrices = await this.pool.query(`
      SELECT 
        item_id,
        category,
        AVG(price) as avg_price
      FROM market_basket_prices
      WHERE observed_at > NOW() - INTERVAL '30 days'
      GROUP BY item_id, category
    `);
    
    // Calculate indices
    const indices = this.calculateIndices(
      currentPrices.rows,
      priorPrices.rows,
      nationalPrices.rows
    );
    
    // Find hottest and coolest items
    const itemChanges = this.calculateItemChanges(currentPrices.rows, priorPrices.rows);
    
    return {
      market,
      state,
      asOf: new Date(),
      ...indices,
      hottestItems: itemChanges.slice(0, 5),
      coolestItems: itemChanges.slice(-5).reverse()
    };
  }
  
  /**
   * Calculate affordability impact for a market
   */
  async getAffordabilityImpact(
    market: string, 
    state: string,
    avgRent: number
  ): Promise<AffordabilityImpact> {
    // Get resident affordability basket prices
    const prices = await this.pool.query(`
      SELECT item_id, price, unit
      FROM market_basket_prices
      WHERE market = $1 AND state = $2
        AND category = 'resident_affordability'
        AND observed_at > NOW() - INTERVAL '30 days'
    `, [market, state]);
    
    // Calculate monthly costs
    const priceMap: Record<string, number> = {};
    for (const row of prices.rows) {
      priceMap[row.item_id] = parseFloat(row.price);
    }
    
    // Estimate monthly costs
    const utilities = (priceMap['electricity_kwh'] || 0.12) * 900 + // ~900 kWh/month
                      (priceMap['natural_gas_therm'] || 1.50) * 30 + // ~30 therms
                      (priceMap['water_1000gal'] || 8) * 4; // ~4000 gal
    
    const groceries = (priceMap['groceries_basket'] || 150) * 4; // Weekly basket
    
    const transportation = (priceMap['gas_regular'] || 3.50) * 50 + // ~50 gal/month
                           (priceMap['auto_insurance_6mo'] || 800) / 6; // Monthly insurance
    
    const healthcare = (priceMap['health_urgent_care'] || 200) / 12 + // Amortized visits
                       50; // Prescriptions estimate
    
    const childcare = priceMap['childcare_monthly'] || 0; // 0 if no kids
    
    const cellPhone = priceMap['cell_phone_plan'] || 80;
    
    const other = 200; // Miscellaneous
    
    const totalNonRent = utilities + groceries + transportation + healthcare + childcare + cellPhone + other;
    const totalWithRent = avgRent + totalNonRent;
    
    // Required income for 30% rent-to-income
    const requiredIncome = avgRent * 12 / 0.30;
    
    // Get median income (from census or cache)
    const incomeResult = await this.pool.query(`
      SELECT median_household_income
      FROM census_demographics
      WHERE geography_name ILIKE $1
      ORDER BY year DESC
      LIMIT 1
    `, [`%${market}%`]);
    
    const medianIncome = incomeResult.rows[0]?.median_household_income || 65000;
    
    // Affordability ratio
    const affordabilityRatio = requiredIncome / medianIncome;
    
    // Get YoY change
    const priorPrices = await this.pool.query(`
      SELECT SUM(price) as total
      FROM market_basket_prices
      WHERE market = $1 AND state = $2
        AND category = 'resident_affordability'
        AND observed_at BETWEEN NOW() - INTERVAL '14 months' AND NOW() - INTERVAL '10 months'
    `, [market, state]);
    
    const currentTotal = prices.rows.reduce((sum, r) => sum + parseFloat(r.price), 0);
    const priorTotal = priorPrices.rows[0]?.total || currentTotal;
    const costOfLivingChangeYoY = ((currentTotal - priorTotal) / priorTotal) * 100;
    
    // Rent headroom (assuming 35% max rent burden)
    const maxAffordableRent = medianIncome * 0.35 / 12;
    const rentHeadroomPct = ((maxAffordableRent - avgRent) / avgRent) * 100;
    
    return {
      market,
      typicalMonthlyBudget: {
        rent: avgRent,
        utilities: Math.round(utilities),
        groceries: Math.round(groceries),
        transportation: Math.round(transportation),
        healthcare: Math.round(healthcare),
        childcare: Math.round(childcare),
        other: Math.round(other) + Math.round(cellPhone),
        total: Math.round(totalWithRent)
      },
      requiredIncomeForRent: Math.round(requiredIncome),
      medianHouseholdIncome: Math.round(medianIncome),
      affordabilityRatio: Math.round(affordabilityRatio * 100) / 100,
      costOfLivingChangeYoY: Math.round(costOfLivingChangeYoY * 10) / 10,
      rentHeadroomPct: Math.round(rentHeadroomPct * 10) / 10
    };
  }
  
  /**
   * Record a price observation
   */
  async recordPrice(observation: {
    itemId: string;
    market: string;
    state: string;
    price: number;
    source: string;
  }): Promise<void> {
    const item = ALL_BASKET_ITEMS.find(i => i.id === observation.itemId);
    if (!item) {
      throw new Error(`Unknown basket item: ${observation.itemId}`);
    }
    
    await this.pool.query(`
      INSERT INTO market_basket_prices (
        item_id, category, item_name, market, state, price, unit, source, observed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      observation.itemId,
      item.category,
      item.name,
      observation.market,
      observation.state,
      observation.price,
      item.unit,
      observation.source
    ]);
  }
  
  /**
   * Get price history for an item
   */
  async getPriceHistory(
    itemId: string,
    market: string,
    state: string,
    months: number = 24
  ): Promise<PriceObservation[]> {
    const result = await this.pool.query(`
      SELECT 
        item_id,
        market,
        state,
        price,
        unit,
        source,
        observed_at
      FROM market_basket_prices
      WHERE item_id = $1 AND market = $2 AND state = $3
        AND observed_at > NOW() - INTERVAL '${months} months'
      ORDER BY observed_at ASC
    `, [itemId, market, state]);
    
    return result.rows.map((row, i, arr) => ({
      itemId: row.item_id,
      market: row.market,
      state: row.state,
      price: parseFloat(row.price),
      unit: row.unit,
      source: row.source,
      observedAt: new Date(row.observed_at),
      priorPrice: i > 0 ? parseFloat(arr[i-1].price) : undefined,
      priorDate: i > 0 ? new Date(arr[i-1].observed_at) : undefined,
      changePct: i > 0 ? ((parseFloat(row.price) - parseFloat(arr[i-1].price)) / parseFloat(arr[i-1].price)) * 100 : undefined
    }));
  }
  
  /**
   * Get all items in a category
   */
  getItemsInCategory(category: BasketCategory): BasketItem[] {
    return ALL_BASKET_ITEMS.filter(i => i.category === category);
  }
  
  /**
   * Get turn cost estimate for a unit
   */
  async getTurnCostEstimate(
    market: string,
    state: string,
    sqft: number,
    condition: 'light' | 'standard' | 'heavy'
  ): Promise<{
    total: number;
    breakdown: Record<string, number>;
    vsLastYear: number;
  }> {
    const prices = await this.pool.query(`
      SELECT item_id, price
      FROM market_basket_prices
      WHERE market = $1 AND state = $2
        AND category IN ('property_operations', 'labor_costs')
        AND observed_at > NOW() - INTERVAL '30 days'
    `, [market, state]);
    
    const priceMap: Record<string, number> = {};
    for (const row of prices.rows) {
      priceMap[row.item_id] = parseFloat(row.price);
    }
    
    // Calculate turn costs based on condition
    let paintSqFt = sqft * 2.5; // Walls are ~2.5x floor area
    let paintGallons = paintSqFt / 350; // ~350 sqft per gallon
    let paintBuckets = Math.ceil(paintGallons / 5);
    
    const paint5Gal = priceMap['paint_5gal'] || 150;
    const painterHr = priceMap['painter_hr'] || 45;
    const carpetSqFt = priceMap['carpet_sqft'] || 3.50;
    const lvpSqFt = priceMap['lvp_sqft'] || 5.50;
    const cleaningHr = priceMap['general_labor_hr'] || 18;
    const maintenanceHr = priceMap['maintenance_tech_hr'] || 25;
    
    let breakdown: Record<string, number> = {};
    
    if (condition === 'light') {
      // Light turn: paint touch-up, clean, minor repairs
      breakdown = {
        paint: paintBuckets * paint5Gal * 0.3,
        labor_paint: (sqft / 200) * painterHr * 0.3,
        cleaning: 4 * cleaningHr,
        repairs: 2 * maintenanceHr,
        supplies: 75
      };
    } else if (condition === 'standard') {
      // Standard: full paint, some flooring, appliance check
      breakdown = {
        paint: paintBuckets * paint5Gal,
        labor_paint: (sqft / 200) * painterHr,
        flooring: sqft * 0.3 * carpetSqFt, // 30% of flooring
        cleaning: 6 * cleaningHr,
        repairs: 4 * maintenanceHr,
        supplies: 150
      };
    } else {
      // Heavy: full paint, flooring, appliances
      breakdown = {
        paint: paintBuckets * paint5Gal,
        labor_paint: (sqft / 150) * painterHr,
        flooring: sqft * lvpSqFt,
        appliances: (priceMap['refrigerator_standard'] || 800) * 0.5, // 50% chance of replacement
        cleaning: 8 * cleaningHr,
        repairs: 8 * maintenanceHr,
        supplies: 250
      };
    }
    
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
    
    // Get YoY change
    const priorResult = await this.pool.query(`
      SELECT item_id, price
      FROM market_basket_prices
      WHERE market = $1 AND state = $2
        AND category IN ('property_operations', 'labor_costs')
        AND observed_at BETWEEN NOW() - INTERVAL '14 months' AND NOW() - INTERVAL '10 months'
    `, [market, state]);
    
    let priorTotal = total; // Default
    if (priorResult.rows.length > 0) {
      // Recalculate with prior prices
      const priorPriceMap: Record<string, number> = {};
      for (const row of priorResult.rows) {
        priorPriceMap[row.item_id] = parseFloat(row.price);
      }
      // Simplified: assume same proportional change
      const avgChange = prices.rows.reduce((sum, r) => {
        const prior = priorPriceMap[r.item_id] || parseFloat(r.price);
        return sum + (parseFloat(r.price) / prior);
      }, 0) / Math.max(prices.rows.length, 1);
      
      priorTotal = total / avgChange;
    }
    
    const vsLastYear = ((total - priorTotal) / priorTotal) * 100;
    
    return {
      total: Math.round(total),
      breakdown: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, Math.round(v)])),
      vsLastYear: Math.round(vsLastYear * 10) / 10
    };
  }
  
  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================
  
  private calculateIndices(
    current: any[],
    prior: any[],
    national: any[]
  ): Omit<MarketBasketIndex, 'market' | 'state' | 'asOf' | 'hottestItems' | 'coolestItems'> {
    const nationalMap: Record<string, number> = {};
    for (const row of national) {
      nationalMap[row.item_id] = parseFloat(row.avg_price);
    }
    
    const currentByCategory: Record<string, number[]> = {
      resident_affordability: [],
      property_operations: [],
      labor_costs: [],
      construction_materials: []
    };
    
    const priorMap: Record<string, number> = {};
    for (const row of prior) {
      priorMap[row.item_id] = parseFloat(row.price);
    }
    
    for (const row of current) {
      const natPrice = nationalMap[row.item_id] || parseFloat(row.price);
      const index = (parseFloat(row.price) / natPrice) * 100;
      if (currentByCategory[row.category]) {
        currentByCategory[row.category].push(index);
      }
    }
    
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 100;
    
    const residentAffordabilityIndex = avg(currentByCategory.resident_affordability);
    const propertyOperationsIndex = avg(currentByCategory.property_operations);
    const laborCostIndex = avg(currentByCategory.labor_costs);
    const constructionIndex = avg(currentByCategory.construction_materials);
    
    const compositeIndex = (
      residentAffordabilityIndex * 0.3 +
      propertyOperationsIndex * 0.3 +
      laborCostIndex * 0.25 +
      constructionIndex * 0.15
    );
    
    // Calculate YoY (simplified)
    const residentAffordabilityYoY = 3.5; // Placeholder
    const propertyOperationsYoY = 4.2;
    const laborCostYoY = 4.8;
    const constructionYoY = 3.0;
    const compositeYoY = (residentAffordabilityYoY + propertyOperationsYoY + laborCostYoY + constructionYoY) / 4;
    
    const trend = compositeYoY > 5 ? 'accelerating' : compositeYoY < 3 ? 'decelerating' : 'stable';
    
    return {
      residentAffordabilityIndex: Math.round(residentAffordabilityIndex * 10) / 10,
      propertyOperationsIndex: Math.round(propertyOperationsIndex * 10) / 10,
      laborCostIndex: Math.round(laborCostIndex * 10) / 10,
      constructionIndex: Math.round(constructionIndex * 10) / 10,
      compositeIndex: Math.round(compositeIndex * 10) / 10,
      residentAffordabilityYoY,
      propertyOperationsYoY,
      laborCostYoY,
      constructionYoY,
      compositeYoY,
      trend
    };
  }
  
  private calculateItemChanges(current: any[], prior: any[]): Array<{ name: string; changePct: number }> {
    const priorMap: Record<string, number> = {};
    for (const row of prior) {
      priorMap[row.item_id] = parseFloat(row.price);
    }
    
    const changes: Array<{ name: string; changePct: number }> = [];
    
    for (const row of current) {
      const priorPrice = priorMap[row.item_id];
      if (priorPrice) {
        const changePct = ((parseFloat(row.price) - priorPrice) / priorPrice) * 100;
        const item = ALL_BASKET_ITEMS.find(i => i.id === row.item_id);
        if (item) {
          changes.push({ name: item.name, changePct: Math.round(changePct * 10) / 10 });
        }
      }
    }
    
    return changes.sort((a, b) => b.changePct - a.changePct);
  }
}

// Singleton factory
let marketBasketInstance: MarketBasketService | null = null;

export function getMarketBasketService(pool: Pool): MarketBasketService {
  if (!marketBasketInstance) {
    marketBasketInstance = new MarketBasketService(pool);
  }
  return marketBasketInstance;
}
