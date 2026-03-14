/**
 * Metrics Catalog Service
 * Defines all 35+ metrics available for strategy building and market analysis
 */

export type MetricCategory =
  | 'traffic_physical'
  | 'traffic_digital'
  | 'traffic_composite'
  | 'financial'
  | 'supply'
  | 'demand'
  | 'market'
  | 'competition'
  | 'risk'
  | 'ownership'
  | 'sfr'
  | 'demographic';

export type MetricGranularity = 'property' | 'submarket' | 'zip' | 'county' | 'msa';

export interface MetricDefinition {
  id: string;
  name: string;
  category: MetricCategory;
  formula: string;
  unit: string;
  granularity: MetricGranularity[];
  source: string;
  updateFrequency: string;
  higherIsBetter: boolean;
  description: string;
  exampleValue: string;
  investmentSignal: string;
}

/**
 * Complete metrics catalog — 40 metrics across 12 categories
 * Covers all signals needed for deal-level and market-level strategy building
 */
export const METRICS_CATALOG: MetricDefinition[] = [
  // ════════════════════════════════════════════════════════════════
  // TRAFFIC — PHYSICAL (5 metrics)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'T_AADT',
    name: 'AADT (Annual Average Daily Traffic)',
    category: 'traffic_physical',
    formula: 'Daily vehicle count (from DOT sensors)',
    unit: 'vehicles/day',
    granularity: ['property', 'submarket', 'zip', 'county', 'msa'],
    source: 'FDOT / State DOTs',
    updateFrequency: 'annual',
    higherIsBetter: true,
    description: 'The count of vehicles passing a location daily. Baseline traffic volume for the location.',
    exampleValue: '45,000 vehicles/day',
    investmentSignal: 'Higher AADT = more customer flow. Stability across years = proven traffic corridor.',
  },
  {
    id: 'T_AADT_YOY',
    name: 'AADT Growth YoY',
    category: 'traffic_physical',
    formula: '(Current Year AADT - Prior Year AADT) / Prior Year AADT × 100',
    unit: '%',
    granularity: ['property', 'submarket', 'zip', 'county', 'msa'],
    source: 'FDOT / State DOTs',
    updateFrequency: 'annual',
    higherIsBetter: true,
    description: 'Year-over-year change in daily traffic volume. Captures traffic growth trends.',
    exampleValue: '+3.5%',
    investmentSignal: 'Positive growth = market demand expanding. Sustained growth = location becoming more valuable.',
  },
  {
    id: 'T_EFFECTIVE_ADT',
    name: 'Effective ADT (Adjusted for Signal Patterns)',
    category: 'traffic_physical',
    formula: 'AADT × Conversion Factor (based on signal type and patterns)',
    unit: 'vehicles/day',
    granularity: ['property', 'submarket'],
    source: 'M07 Fusion Engine',
    updateFrequency: 'monthly',
    higherIsBetter: true,
    description: 'AADT adjusted for signal patterns and market conditions. Reflects "usable" traffic for the property.',
    exampleValue: '42,000 vehicles/day (adjusted)',
    investmentSignal: 'True customer flow accounting for signal timing and route patterns.',
  },
  {
    id: 'T_WALKINS',
    name: 'Predicted Walk-Ins',
    category: 'traffic_physical',
    formula: 'AADT × Walk-In Conversion Rate (property type specific)',
    unit: 'pedestrians/day',
    granularity: ['property'],
    source: 'M07 Fusion Engine',
    updateFrequency: 'monthly',
    higherIsBetter: true,
    description: 'Estimated foot traffic (walk-in customers) derived from AADT and property characteristics.',
    exampleValue: '250-500 walk-ins/day',
    investmentSignal: 'Higher walk-ins = customer accessibility. Retail/F&B critical driver.',
  },
  {
    id: 'T_PHYSICAL_SCORE',
    name: 'Physical Traffic Score',
    category: 'traffic_physical',
    formula: 'Composite of AADT, growth, signal patterns, and visibility',
    unit: 'score 0-100',
    granularity: ['property', 'submarket'],
    source: 'M07 Fusion Engine',
    updateFrequency: 'monthly',
    higherIsBetter: true,
    description: 'Aggregate score (0-100) representing physical traffic desirability of the location.',
    exampleValue: '78',
    investmentSignal: '70+ = strong physical location. Sustained high score = location immunity to downturns.',
  },

  // ════════════════════════════════════════════════════════════════
  // TRAFFIC — DIGITAL (5 metrics)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'D_SEARCH_VOL',
    name: 'Search Volume (Branded + Category)',
    category: 'traffic_digital',
    formula: 'Total monthly Google searches for brand and product category',
    unit: 'searches/month',
    granularity: ['property', 'submarket', 'zip', 'msa'],
    source: 'Google Trends / SpyFu',
    updateFrequency: 'weekly',
    higherIsBetter: true,
    description: 'Monthly search demand for the property or category in that market. Measure of digital awareness.',
    exampleValue: '1,250 searches/month',
    investmentSignal: 'Higher volume = customer awareness. Growth = demand building.',
  },
  {
    id: 'D_SEARCH_MOMENTUM',
    name: 'Search Momentum (QoQ %)',
    category: 'traffic_digital',
    formula: '(Current Quarter Search Vol - Prior Quarter Search Vol) / Prior Quarter × 100',
    unit: '%',
    granularity: ['property', 'submarket', 'zip', 'msa'],
    source: 'Google Trends / SpyFu',
    updateFrequency: 'weekly',
    higherIsBetter: true,
    description: 'Quarter-over-quarter change in search volume. Leading indicator of demand.',
    exampleValue: '+18%',
    investmentSignal: 'THE leading indicator. Positive momentum = demand building before physical manifests.',
  },
  {
    id: 'D_DIGITAL_SHARE',
    name: 'Digital Traffic Share (%)',
    category: 'traffic_digital',
    formula: 'Digital Searches / (Digital Searches + AADT foot traffic) × 100',
    unit: '%',
    granularity: ['property', 'submarket'],
    source: 'M07 Fusion Engine',
    updateFrequency: 'monthly',
    higherIsBetter: false,
    description: 'What % of total demand comes from digital (web/app) vs physical foot traffic.',
    exampleValue: '35%',
    investmentSignal: 'Low % = strong physical location. High % = digital-dependent (e-commerce, delivery).',
  },
  {
    id: 'D_DIGITAL_SCORE',
    name: 'Digital Traffic Score',
    category: 'traffic_digital',
    formula: 'Composite of search volume, momentum, and digital presence',
    unit: 'score 0-100',
    granularity: ['property', 'submarket', 'zip'],
    source: 'M07 Fusion Engine',
    updateFrequency: 'weekly',
    higherIsBetter: true,
    description: 'Aggregate score (0-100) for digital demand and online visibility.',
    exampleValue: '62',
    investmentSignal: '50+ = visible online. <40 = institutional buyers may not have found it yet (value-add signal).',
  },
  {
    id: 'D_OUT_OF_STATE',
    name: 'Out-of-State Search %',
    category: 'traffic_digital',
    formula: '(Out-of-State Searches / Total Searches) × 100',
    unit: '%',
    granularity: ['county', 'msa'],
    source: 'Google Trends',
    updateFrequency: 'weekly',
    higherIsBetter: true,
    description: 'What % of search demand comes from outside-state. Indicator of regional/national recognition.',
    exampleValue: '22%',
    investmentSignal: 'High % = destination status. Low % = local market only.',
  },

  // ════════════════════════════════════════════════════════════════
  // TRAFFIC — COMPOSITE (4 metrics)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'C_SURGE_INDEX',
    name: 'Traffic Surge Index',
    category: 'traffic_composite',
    formula: '(Google Realtime - DOT Baseline) / DOT Baseline × 100',
    unit: '%',
    granularity: ['property', 'submarket', 'zip'],
    source: 'M07 Fusion Engine',
    updateFrequency: 'daily',
    higherIsBetter: true,
    description: 'Real-time traffic vs historical baseline. Positive = market overperforming expectations. The demand pulse.',
    exampleValue: '+0.35 (35% above baseline)',
    investmentSignal: 'THE key metric. Sustained +20% = demand building before rents catch up. Buy window signal.',
  },
  {
    id: 'C_DIGITAL_PHYSICAL_GAP',
    name: 'Digital-Physical Divergence (Gap)',
    category: 'traffic_composite',
    formula: 'D_SEARCH_MOMENTUM - T_AADT_YOY',
    unit: '%',
    granularity: ['property', 'submarket', 'zip', 'msa'],
    source: 'M07 Fusion Engine',
    updateFrequency: 'monthly',
    higherIsBetter: true,
    description: 'When digital demand is surging but physical traffic is flat. Signal of demand building but not manifested.',
    exampleValue: '+12% (digital up 15%, physical up 3%)',
    investmentSignal: 'Positive gap = buy window. Digital leads physical by 6-12 months. Investors should position before physical catches up.',
  },
  {
    id: 'C_TPI',
    name: 'Traffic Position Index',
    category: 'traffic_composite',
    formula: 'Percentile rank of property traffic vs submarket average',
    unit: 'percentile 0-100',
    granularity: ['property', 'submarket'],
    source: 'M07 Fusion Engine',
    updateFrequency: 'monthly',
    higherIsBetter: true,
    description: 'Where this property ranks in traffic relative to others in the submarket (0-100 scale).',
    exampleValue: '78th percentile',
    investmentSignal: '70+ = top tier location. <30 = challenged location.',
  },
  {
    id: 'C_TVS',
    name: 'Traffic Velocity Score',
    category: 'traffic_composite',
    formula: 'Acceleration of traffic growth (change in growth rate)',
    unit: 'score 0-100',
    granularity: ['property', 'submarket', 'msa'],
    source: 'M07 Fusion Engine',
    updateFrequency: 'monthly',
    higherIsBetter: true,
    description: 'Momentum of traffic acceleration. Not just growing, but accelerating?',
    exampleValue: '65',
    investmentSignal: 'High score = traffic expanding. Low score = flat or decelerating (red flag).',
  },

  // ════════════════════════════════════════════════════════════════
  // FINANCIAL (5 metrics)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'F_RENT_GROWTH',
    name: 'Rent Growth YoY',
    category: 'financial',
    formula: '(Current Year Rent - Prior Year Rent) / Prior Year Rent × 100',
    unit: '%',
    granularity: ['property', 'submarket', 'zip', 'county', 'msa'],
    source: 'Zillow ZORI / Apartments.com / CoStar',
    updateFrequency: 'monthly',
    higherIsBetter: true,
    description: 'Year-over-year change in rental rates. Fundamental income growth for rental properties.',
    exampleValue: '+3.2%',
    investmentSignal: '+2-4% = healthy. +5%+ = hot market. -1%+ = cooling/concern.',
  },
  {
    id: 'F_RENT_INDEX',
    name: 'Rent Index (Base = 100)',
    category: 'financial',
    formula: 'Current Rent / Historical Baseline × 100',
    unit: 'index',
    granularity: ['submarket', 'zip', 'county', 'msa'],
    source: 'Zillow ZORI',
    updateFrequency: 'monthly',
    higherIsBetter: true,
    description: 'Rent level indexed to a baseline year. Tracks absolute rental value trend.',
    exampleValue: '118 (18% above baseline)',
    investmentSignal: 'Higher index = rents repriced higher. Compare to wage growth to find affordability gaps.',
  },
  {
    id: 'F_CAP_RATE',
    name: 'Cap Rate',
    category: 'financial',
    formula: 'NOI / Property Value × 100',
    unit: '%',
    granularity: ['property', 'submarket', 'msa'],
    source: 'NCREIF / CoStar / Market comps',
    updateFrequency: 'quarterly',
    higherIsBetter: false,
    description: 'Net operating income as % of property value. Inverse of valuation.',
    exampleValue: '5.2%',
    investmentSignal: 'Higher cap rate = cheaper valuation (more distressed or lower demand). Lower cap rate = premium market.',
  },
  {
    id: 'F_PRICE_PER_UNIT',
    name: 'Price per Unit',
    category: 'financial',
    formula: 'Total Purchase Price / Number of Units',
    unit: '$/unit',
    granularity: ['submarket', 'zip', 'msa'],
    source: 'CoStar / Market data',
    updateFrequency: 'quarterly',
    higherIsBetter: false,
    description: 'Cost per unit for multifamily. Valuation metric.',
    exampleValue: '$185,000/unit',
    investmentSignal: 'Lower $/unit = value opportunity. Higher $/unit = premium location.',
  },
  {
    id: 'F_RENT_TO_INCOME',
    name: 'Rent-to-Income Ratio',
    category: 'financial',
    formula: 'Average Rent / Median Household Income × 100',
    unit: 'ratio',
    granularity: ['submarket', 'zip', 'county', 'msa'],
    source: 'Zillow / Census ACS',
    updateFrequency: 'monthly',
    higherIsBetter: false,
    description: 'What % of income goes to rent. Affordability metric.',
    exampleValue: '28%',
    investmentSignal: '25-30% = healthy affordability. 30%+ = renters stretched. Room to raise rents if below 28%.',
  },

  // ════════════════════════════════════════════════════════════════
  // SUPPLY (4 metrics)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'S_PIPELINE_UNITS',
    name: 'Pipeline Units (Under Construction)',
    category: 'supply',
    formula: 'Total units with building permit or under active construction',
    unit: 'units',
    granularity: ['submarket', 'zip', 'county', 'msa'],
    source: 'CoStar / Census Building Permits / RealPage',
    updateFrequency: 'quarterly',
    higherIsBetter: false,
    description: 'New supply coming to market. High pipeline = future supply pressure.',
    exampleValue: '2,450 units',
    investmentSignal: 'High pipeline = rents under pressure soon. Low pipeline = supply constrained.',
  },
  {
    id: 'S_PIPELINE_TO_STOCK',
    name: 'Pipeline-to-Stock Ratio',
    category: 'supply',
    formula: 'Pipeline Units / Existing Stock × 100',
    unit: '%',
    granularity: ['submarket', 'county', 'msa'],
    source: 'CoStar / Census',
    updateFrequency: 'quarterly',
    higherIsBetter: false,
    description: 'New supply as % of existing stock. Shows relative supply pressure.',
    exampleValue: '8.5%',
    investmentSignal: '<5% = limited supply. 5-10% = normal. >10% = oversupply coming.',
  },
  {
    id: 'S_PERMIT_VELOCITY',
    name: 'Permit Filing Velocity (YoY Change)',
    category: 'supply',
    formula: '(Current Year Permits - Prior Year Permits) / Prior Year × 100',
    unit: '%',
    granularity: ['submarket', 'county', 'msa'],
    source: 'Census Building Permits / County Records',
    updateFrequency: 'monthly',
    higherIsBetter: false,
    description: 'Speed at which new construction is being filed for. Trend of supply activity.',
    exampleValue: '-12% YoY',
    investmentSignal: 'Decreasing permits = supply cliff coming. Increasing permits = construction acceleration.',
  },
  {
    id: 'S_MONTHS_OF_SUPPLY',
    name: 'Months of Supply',
    category: 'supply',
    formula: 'Available Inventory / Monthly Absorption Rate',
    unit: 'months',
    granularity: ['submarket', 'zip', 'county', 'msa'],
    source: 'CoStar / ATTOM / Zillow',
    updateFrequency: 'monthly',
    higherIsBetter: false,
    description: 'How many months of sales/leases the current inventory would supply. Tightness metric.',
    exampleValue: '4.2 months',
    investmentSignal: '<3 months = tight. 3-6 months = balanced. >6 months = oversupplied.',
  },

  // ════════════════════════════════════════════════════════════════
  // DEMAND (4 metrics)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'E_EMPLOYMENT_GROWTH',
    name: 'Employment Growth YoY',
    category: 'demand',
    formula: '(Current Year Jobs - Prior Year Jobs) / Prior Year × 100',
    unit: '%',
    granularity: ['county', 'msa'],
    source: 'BLS QCEW (Quarterly Census of Employment and Wages)',
    updateFrequency: 'quarterly',
    higherIsBetter: true,
    description: 'Year-over-year change in total employment. Jobs = demand.',
    exampleValue: '+2.1%',
    investmentSignal: '+2-3% = healthy. +4%+ = booming. -1%+ = concern.',
  },
  {
    id: 'E_WAGE_GROWTH',
    name: 'Wage Growth YoY',
    category: 'demand',
    formula: '(Current Year Avg Wage - Prior Year Avg Wage) / Prior Year × 100',
    unit: '%',
    granularity: ['county', 'msa'],
    source: 'BLS QCEW',
    updateFrequency: 'quarterly',
    higherIsBetter: true,
    description: 'Year-over-year change in average wage per worker. Purchasing power growth.',
    exampleValue: '+3.4%',
    investmentSignal: 'Higher wage growth = room to raise rents. Compare to rent growth for runway.',
  },
  {
    id: 'E_POPULATION_GROWTH',
    name: 'Population Growth YoY',
    category: 'demand',
    formula: '(Current Year Population - Prior Year Population) / Prior Year × 100',
    unit: '%',
    granularity: ['zip', 'county', 'msa'],
    source: 'Census ACS (American Community Survey)',
    updateFrequency: 'annual',
    higherIsBetter: true,
    description: 'Year-over-year change in total population. New residents = new demand.',
    exampleValue: '+1.8%',
    investmentSignal: '+1-2% = healthy. +3%+ = rapid growth. -0.5%+ = decline.',
  },
  {
    id: 'E_BIZ_FORMATIONS',
    name: 'Business Formations (New Applications)',
    category: 'demand',
    formula: 'New business applications filed in the period',
    unit: 'applications',
    granularity: ['county', 'msa', 'state'],
    source: 'Census BFS (Business Formation Statistics)',
    updateFrequency: 'weekly',
    higherIsBetter: true,
    description: 'New business creation. Early signal of economic optimism and hiring.',
    exampleValue: '245 applications/week',
    investmentSignal: 'Rising formations = economic optimism. Declining = hesitation.',
  },

  // ════════════════════════════════════════════════════════════════
  // MARKET (4 metrics)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'M_VACANCY',
    name: 'Vacancy Rate',
    category: 'market',
    formula: 'Vacant Units / Total Units × 100',
    unit: '%',
    granularity: ['property', 'submarket', 'county', 'msa'],
    source: 'CoStar / Apartments.com',
    updateFrequency: 'quarterly',
    higherIsBetter: false,
    description: 'Percentage of units that are unoccupied. Market tightness metric.',
    exampleValue: '5.2%',
    investmentSignal: '<4% = tight. 4-6% = normal. >7% = soft.',
  },
  {
    id: 'M_ABSORPTION',
    name: 'Net Absorption (Units/Month)',
    category: 'market',
    formula: 'Change in occupied units over the period',
    unit: 'units/month',
    granularity: ['submarket', 'county', 'msa'],
    source: 'CoStar / RealPage',
    updateFrequency: 'quarterly',
    higherIsBetter: true,
    description: 'Net change in leased units. Positive = market filling; negative = market softening.',
    exampleValue: '+125 units/month',
    investmentSignal: 'Positive absorption = strong demand. Sustained positive = pricing power.',
  },
  {
    id: 'M_SUBMARKET_RANK',
    name: 'Submarket Rank Percentile',
    category: 'market',
    formula: 'Rank of this submarket vs all submarkets in MSA by performance',
    unit: 'percentile 0-100',
    granularity: ['submarket'],
    source: 'CoStar',
    updateFrequency: 'quarterly',
    higherIsBetter: true,
    description: 'Where this submarket ranks among peers. Top performer indicator.',
    exampleValue: '72nd percentile',
    investmentSignal: '70+ = top performer. <30 = laggard submarket.',
  },
  {
    id: 'M_LEASE_VELOCITY',
    name: 'Lease Velocity (Days to Lease)',
    category: 'market',
    formula: 'Average days from listing to lease signed',
    unit: 'days',
    granularity: ['submarket', 'zip'],
    source: 'Apartments.com / CoStar',
    updateFrequency: 'monthly',
    higherIsBetter: false,
    description: 'How quickly units lease. Lower = tight market; higher = soft market.',
    exampleValue: '24 days',
    investmentSignal: '<20 days = very tight. 20-30 days = normal. >40 days = soft market.',
  },

  // ════════════════════════════════════════════════════════════════
  // COMPETITION & REPUTATION (2 metrics)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'K_GOOGLE_RATING',
    name: 'Google Rating / Review Score',
    category: 'competition',
    formula: 'Average rating from Google reviews (1-5 stars)',
    unit: 'score 1-5',
    granularity: ['property'],
    source: 'Google Places API',
    updateFrequency: 'daily',
    higherIsBetter: true,
    description: 'Guest/customer satisfaction score from reviews. Operational quality signal.',
    exampleValue: '4.2/5.0 (256 reviews)',
    investmentSignal: '4.5+/5 = excellent ops. <3.5/5 = operational issues (value-add opportunity).',
  },
  {
    id: 'K_REVIEW_SENTIMENT',
    name: 'Review Sentiment Score',
    category: 'competition',
    formula: 'NLP sentiment analysis of review text (positive vs negative)',
    unit: 'score -100 to +100',
    granularity: ['property'],
    source: 'NLP analysis of review text',
    updateFrequency: 'weekly',
    higherIsBetter: true,
    description: 'Sentiment of reviews (positive/negative themes). Operational health signal.',
    exampleValue: '+34 (moderately positive)',
    investmentSignal: '+50+ = strong operations. 0 to -50 = mixed or problematic.',
  },

  // ════════════════════════════════════════════════════════════════
  // RISK (2 metrics)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'R_SUPPLY_RISK',
    name: 'Supply Risk Score',
    category: 'risk',
    formula: 'Composite of pipeline, permit velocity, and months of supply',
    unit: 'score 0-100',
    granularity: ['submarket', 'county', 'msa'],
    source: 'M07 Fusion Engine',
    updateFrequency: 'monthly',
    higherIsBetter: false,
    description: 'Risk that new supply will pressure rents. Higher = more risk.',
    exampleValue: '42',
    investmentSignal: '0-30 = low risk. 30-70 = moderate. 70+ = high supply risk.',
  },
  {
    id: 'R_CLIMATE_RISK',
    name: 'Climate Risk Score',
    category: 'risk',
    formula: 'Composite of flood, hurricane, wildfire, heat risk by location',
    unit: 'score 0-100',
    granularity: ['property', 'zip', 'county'],
    source: 'FEMA / Local climate data',
    updateFrequency: 'quarterly',
    higherIsBetter: false,
    description: 'Environmental hazard risk for the property. Insurance and hold period impact.',
    exampleValue: '28',
    investmentSignal: '0-20 = low risk. 20-50 = moderate. 50+ = high environmental risk.',
  },

  // ════════════════════════════════════════════════════════════════
  // OWNERSHIP & FINANCING (2 metrics)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'O_DEBT_MATURITY_MO',
    name: 'Months to Debt Maturity',
    category: 'ownership',
    formula: 'Time until loan matures or call date',
    unit: 'months',
    granularity: ['property'],
    source: 'Loan servicer data / Property records',
    updateFrequency: 'quarterly',
    higherIsBetter: true,
    description: 'How long until the owner must refinance or pay off. Refinance risk timing.',
    exampleValue: '14 months',
    investmentSignal: '<12 months = refinance risk (distress opportunity). >36 months = runway.',
  },
  {
    id: 'O_HOLD_DURATION',
    name: 'Current Hold Duration',
    category: 'ownership',
    formula: 'Time since current ownership took title',
    unit: 'years',
    granularity: ['property'],
    source: 'Property records / County assessor',
    updateFrequency: 'quarterly',
    higherIsBetter: false,
    description: 'How long current owner has held the asset. Exit motivation indicator.',
    exampleValue: '7 years',
    investmentSignal: '5-7 years = typical hold. >10 years = likely wants exit.',
  },

  // ════════════════════════════════════════════════════════════════
  // SINGLE FAMILY (6 metrics)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'SFR_HOME_VALUE',
    name: 'Median Home Value',
    category: 'sfr',
    formula: 'Zillow ZHVI or property-level ATTOM median',
    unit: '$/home',
    granularity: ['property', 'zip', 'county', 'msa'],
    source: 'Zillow ZHVI / ATTOM',
    updateFrequency: 'monthly',
    higherIsBetter: false,
    description: 'Current market value of homes. Valuation benchmark.',
    exampleValue: '$385,000',
    investmentSignal: 'Lower values = higher cap rates and cash-on-cash returns. Check affordability vs income.',
  },
  {
    id: 'SFR_HOME_VALUE_GROWTH',
    name: 'Home Value Growth YoY',
    category: 'sfr',
    formula: '(Current Year Value - Prior Year Value) / Prior Year × 100',
    unit: '%',
    granularity: ['zip', 'county', 'msa'],
    source: 'Zillow ZHVI / ATTOM',
    updateFrequency: 'monthly',
    higherIsBetter: true,
    description: 'Year-over-year appreciation rate. Wealth effect and exit value.',
    exampleValue: '+5.8%',
    investmentSignal: '+2-5% = healthy. +8%+ = speculative. -2%+ = concern.',
  },
  {
    id: 'SFR_DOM',
    name: 'Days on Market (DOM)',
    category: 'sfr',
    formula: 'Average days from listing to sale',
    unit: 'days',
    granularity: ['zip', 'county', 'msa'],
    source: 'Redfin / Zillow / MLS',
    updateFrequency: 'monthly',
    higherIsBetter: false,
    description: 'How quickly homes sell. Speed of liquidity.',
    exampleValue: '32 days',
    investmentSignal: '<15 days = very hot. 15-30 days = normal. >60 days = soft.',
  },
  {
    id: 'SFR_INVENTORY',
    name: 'Active Listings (Months of Inventory)',
    category: 'sfr',
    formula: 'Active for-sale listings / Avg monthly sales rate',
    unit: 'months',
    granularity: ['zip', 'county', 'msa'],
    source: 'Redfin / Zillow / MLS',
    updateFrequency: 'monthly',
    higherIsBetter: false,
    description: 'How many months of sales current inventory represents. Market balance.',
    exampleValue: '3.2 months',
    investmentSignal: '<2 months = seller market. 2-5 months = balanced. >5 months = buyer market.',
  },
  {
    id: 'SFR_PRICE_TO_RENT',
    name: 'Price-to-Rent Ratio',
    category: 'sfr',
    formula: 'Median Home Value / Annual Rent × 100',
    unit: 'ratio',
    granularity: ['zip', 'county', 'msa'],
    source: 'Zillow ZHVI / ZORI',
    updateFrequency: 'monthly',
    higherIsBetter: false,
    description: 'Years of rent needed to equal home price. Buy vs rent indicator.',
    exampleValue: '16.5x',
    investmentSignal: '<15x = rent competitive. 15-20x = buy competitive. >20x = rent wins.',
  },
  {
    id: 'SFR_CASH_BUYER_PCT',
    name: 'Cash Buyer Percentage',
    category: 'sfr',
    formula: '(Cash Sales / Total Sales) × 100',
    unit: '%',
    granularity: ['zip', 'county', 'msa'],
    source: 'ATTOM / MLS / County records',
    updateFrequency: 'monthly',
    higherIsBetter: false,
    description: 'What % of sales are cash purchases. Investor activity indicator.',
    exampleValue: '18%',
    investmentSignal: '<15% = primary residence market. 15-25% = mixed. >25% = investor-heavy market.',
  },

  // ════════════════════════════════════════════════════════════════
  // DEMOGRAPHIC (7 metrics)
  // ════════════════════════════════════════════════════════════════
  {
    id: 'DEMO_NET_MIGRATION',
    name: 'Net Migration (Households/Year)',
    category: 'demographic',
    formula: 'IRS SOI county inflow - outflow (weighted to zip)',
    unit: 'households/year',
    granularity: ['county', 'msa'],
    source: 'IRS SOI (Statistics of Income)',
    updateFrequency: 'annual',
    higherIsBetter: true,
    description: 'Net household inflow from other counties. Population growth from migration.',
    exampleValue: '+2,350 households/year',
    investmentSignal: 'Positive = destination. High % = rapid population influx = demand spike.',
  },
  {
    id: 'DEMO_MED_INCOME',
    name: 'Median Household Income',
    category: 'demographic',
    formula: 'Census ACS median household income',
    unit: '$/year',
    granularity: ['zip', 'county', 'msa'],
    source: 'Census ACS (American Community Survey)',
    updateFrequency: 'annual',
    higherIsBetter: true,
    description: 'Middle income in the area. Purchasing power and affordability baseline.',
    exampleValue: '$62,500',
    investmentSignal: 'Higher income = stronger renters. Compare to rent-to-income ratio for upside.',
  },
  {
    id: 'DEMO_POPULATION',
    name: 'Total Population',
    category: 'demographic',
    formula: 'Census ACS population count',
    unit: 'people',
    granularity: ['zip', 'county', 'msa'],
    source: 'Census ACS',
    updateFrequency: 'annual',
    higherIsBetter: true,
    description: 'Total population. Absolute market size.',
    exampleValue: '245,000',
    investmentSignal: 'Growing populations = growing demand.',
  },
  {
    id: 'DEMO_RENTER_PCT',
    name: 'Renter Household %',
    category: 'demographic',
    formula: '(Renter-Occupied Units / Total Units) × 100',
    unit: '%',
    granularity: ['zip', 'county', 'msa'],
    source: 'Census ACS',
    updateFrequency: 'annual',
    higherIsBetter: true,
    description: 'What % of households are renters. Multifamily market demand.',
    exampleValue: '42%',
    investmentSignal: '40-50% = rental market. <30% = owner-dominant market.',
  },
  {
    id: 'DEMO_FOREIGN_BORN_PCT',
    name: 'Foreign-Born Population %',
    category: 'demographic',
    formula: '(Foreign-Born Residents / Total Population) × 100',
    unit: '%',
    granularity: ['zip', 'tract', 'county'],
    source: 'Census ACS',
    updateFrequency: 'annual',
    higherIsBetter: true,
    description: 'Immigration rate. Measure of population inflow and diversity.',
    exampleValue: '18%',
    investmentSignal: 'Rising % = immigration inflow. Cultural diversity = value add.',
  },
  {
    id: 'DEMO_MED_AGE',
    name: 'Median Age',
    category: 'demographic',
    formula: 'Census ACS median age of population',
    unit: 'years',
    granularity: ['zip', 'county', 'msa'],
    source: 'Census ACS',
    updateFrequency: 'annual',
    higherIsBetter: false,
    description: 'Middle-point age of population. Lifecycle and housing type indicator.',
    exampleValue: '36 years',
    investmentSignal: '<30 = young market (renters). 30-40 = mixed. >40 = older (owner-occupied).',
  },
  {
    id: 'DEMO_HH_GROWTH',
    name: 'Household Growth Rate YoY',
    category: 'demographic',
    formula: '(Current Year Households - Prior Year) / Prior Year × 100',
    unit: '%',
    granularity: ['zip', 'county', 'msa'],
    source: 'Census ACS',
    updateFrequency: 'annual',
    higherIsBetter: true,
    description: 'Year-over-year growth in total households. Core demand metric.',
    exampleValue: '+2.1%',
    investmentSignal: '+1-2% = healthy. +3%+ = rapid growth.',
  },
];

/**
 * Helper function: Get metric by ID
 */
export function getMetricById(metricId: string): MetricDefinition | undefined {
  return METRICS_CATALOG.find((m) => m.id === metricId);
}

/**
 * Helper function: Get all metrics in a category
 */
export function getMetricsByCategory(
  category: MetricCategory
): MetricDefinition[] {
  return METRICS_CATALOG.filter((m) => m.category === category);
}

/**
 * Helper function: Get available granularities for a metric
 */
export function getAvailableGranularities(metricId: string): MetricGranularity[] {
  const metric = getMetricById(metricId);
  return metric?.granularity ?? [];
}

/**
 * Get list of all unique categories with metric counts
 */
export function getCategoriesWithCounts(): Array<{
  category: MetricCategory;
  name: string;
  count: number;
}> {
  const categories: MetricCategory[] = [
    'traffic_physical',
    'traffic_digital',
    'traffic_composite',
    'financial',
    'supply',
    'demand',
    'market',
    'competition',
    'risk',
    'ownership',
    'sfr',
    'demographic',
  ];

  const categoryLabels: Record<MetricCategory, string> = {
    traffic_physical: 'Physical Traffic',
    traffic_digital: 'Digital Traffic',
    traffic_composite: 'Traffic Composite',
    financial: 'Financial',
    supply: 'Supply',
    demand: 'Demand',
    market: 'Market',
    competition: 'Competition & Reputation',
    risk: 'Risk',
    ownership: 'Ownership & Financing',
    sfr: 'Single-Family Residential',
    demographic: 'Demographics',
  };

  return categories.map((cat) => ({
    category: cat,
    name: categoryLabels[cat],
    count: METRICS_CATALOG.filter((m) => m.category === cat).length,
  }));
}
