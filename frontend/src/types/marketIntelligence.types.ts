/**
 * JEDI RE - Market Intelligence Types
 * 89 Research Outputs across 8 Signal Groups
 * Version 2.0 - Enhanced with Traffic, Dev Capacity, and Trade Area
 */

// ============================================================================
// DATA SOURCE METADATA
// ============================================================================

export interface DataSource {
  id: string;
  name: string;
  lastUpdated: string; // ISO date
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  cost: 'FREE' | 'PAID';
}

export interface OutputMetadata {
  outputId: string;
  source: DataSource;
  computedFrom?: string[]; // IDs of other outputs used in calculation
  updatedAt: string;
}

// ============================================================================
// DEMAND SIGNAL (D-01 to D-12)
// ============================================================================

export interface DemandSignal {
  // D-01: Jobs-to-Apartments Ratio
  jobsToApartments: {
    value: number; // e.g., 4.2
    threshold: number; // e.g., 4.0 (undersupplied)
    assessment: 'STRONG' | 'MODERATE' | 'WEAK';
    metadata: OutputMetadata;
  };

  // D-02: New Jobs to New Units Ratio
  newJobsToNewUnits: {
    value: number;
    threshold: number;
    assessment: 'STRONG' | 'MODERATE' | 'WEAK';
    metadata: OutputMetadata;
  };

  // D-03: Net Migration to New Supply
  netMigrationToSupply: {
    inMigration: number; // net new residents per year
    newUnits: number;
    ratio: number;
    assessment: 'STRONG' | 'MODERATE' | 'WEAK';
    metadata: OutputMetadata;
  };

  // D-04: Household Formation to Supply
  householdFormationToSupply: {
    newHouseholds: number;
    newUnits: number;
    ratio: number;
    assessment: 'STRONG' | 'MODERATE' | 'WEAK';
    metadata: OutputMetadata;
  };

  // D-05: Traffic Count Growth Rate
  trafficGrowthRate: {
    yoyChange: number; // percentage
    trend: 'ACCELERATING' | 'STABLE' | 'DECLINING';
    metadata: OutputMetadata;
  };

  // D-06: Traffic Acceleration
  trafficAcceleration: {
    secondDerivative: number;
    assessment: 'ACCELERATING' | 'STABLE' | 'DECELERATING';
    metadata: OutputMetadata;
  };

  // D-07: Digital-Physical Traffic Gap
  digitalPhysicalGap: {
    gap: number; // percentage difference
    interpretation: 'UNDISCOVERED' | 'BALANCED' | 'OVERHYPED';
    metadata: OutputMetadata;
  };

  // D-08: Search Interest Volume
  searchInterest: {
    volume: number; // indexed 0-100
    trend: 'RISING' | 'STABLE' | 'FALLING';
    metadata: OutputMetadata;
  };

  // D-09: Demand Momentum Score
  demandMomentum: {
    score: number; // 0-100
    trend: 'STRENGTHENING' | 'STABLE' | 'WEAKENING';
    metadata: OutputMetadata;
  };

  // D-10: Employment Gravity Score
  employmentGravity: {
    score: number; // 0-100
    majorEmployers: Array<{
      name: string;
      employees: number;
      distanceMiles: number;
    }>;
    metadata: OutputMetadata;
  };

  // D-11: Rent-to-Mortgage Discount
  rentToMortgageDiscount: {
    rentCost: number; // monthly
    mortgageCost: number; // monthly
    discount: number; // percentage
    interpretation: string;
    metadata: OutputMetadata;
  };

  // D-12: Population & Demographics
  demographics: {
    population: number;
    growthRate: number; // percentage YoY
    medianHHI: number;
    medianAge: number;
    renterPercentage: number;
    metadata: OutputMetadata;
  };
}

// ============================================================================
// SUPPLY SIGNAL (S-01 to S-10)
// ============================================================================

export interface SupplySignal {
  // S-01: Existing Inventory Map
  inventory: {
    totalProperties: number;
    totalUnits: number;
    properties: Array<{
      id: string;
      address: string;
      units: number;
      yearBuilt: number;
      class: 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C';
    }>;
    metadata: OutputMetadata;
  };

  // S-02: Pipeline: Under Construction
  underConstruction: {
    projectCount: number;
    totalUnits: number;
    projects: Array<{
      name: string;
      units: number;
      estimatedDelivery: string; // YYYY-QQ
      submarket: string;
    }>;
    metadata: OutputMetadata;
  };

  // S-03: Pipeline: Permitted Not Started
  permittedNotStarted: {
    projectCount: number;
    totalUnits: number;
    projects: Array<{
      name: string;
      units: number;
      permitDate: string;
      submarket: string;
    }>;
    metadata: OutputMetadata;
  };

  // S-04: Absorption Runway
  absorptionRunway: {
    pipelineUnits: number;
    monthlyAbsorption: number;
    runwayMonths: number;
    assessment: 'OVERSUPPLIED' | 'BALANCED' | 'UNDERSUPPLIED';
    metadata: OutputMetadata;
  };

  // S-05: Delivery Clustering
  deliveryClustering: {
    clusterRisk: 'HIGH' | 'MEDIUM' | 'LOW';
    clusters: Array<{
      submarket: string;
      timeframe: string;
      units: number;
      riskScore: number;
    }>;
    metadata: OutputMetadata;
  };

  // S-06: Permit Momentum
  permitMomentum: {
    qoqChange: number; // percentage
    trend: 'RISING' | 'STABLE' | 'FALLING';
    metadata: OutputMetadata;
  };

  // S-07: Construction Cost vs Rent Yield
  buildEconomics: {
    constructionCostPerUnit: number;
    yieldOnCost: number; // percentage
    marketCapRate: number; // percentage
    feasible: boolean;
    metadata: OutputMetadata;
  };

  // S-08: Saturation Index
  saturation: {
    unitsPerCapita: number;
    benchmark: number;
    ratio: number;
    assessment: 'OVERSATURATED' | 'BALANCED' | 'UNDERSATURATED';
    metadata: OutputMetadata;
  };

  // S-09: Permit-to-Delivery Conversion
  permitConversion: {
    conversionRate: number; // percentage
    historicalAverage: number;
    assessment: string;
    metadata: OutputMetadata;
  };

  // S-10: Vintage Breakdown
  vintageBreakdown: {
    distribution: Array<{
      decade: string; // "2020+", "2010-2019", etc.
      units: number;
      percentage: number;
      class: string;
    }>;
    metadata: OutputMetadata;
  };
}

// ============================================================================
// MOMENTUM SIGNAL (M-01 to M-10)
// ============================================================================

export interface MomentumSignal {
  // M-01: Rent Trends by Vintage Class
  rentByVintage: {
    classes: Array<{
      class: 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C';
      avgRent: number;
      yoyGrowth: number;
      trend: number[]; // time series
    }>;
    metadata: OutputMetadata;
  };

  // M-02: Rent Acceleration Rate
  rentAcceleration: {
    accelerationRate: number; // second derivative
    assessment: 'ACCELERATING' | 'STABLE' | 'DECELERATING';
    metadata: OutputMetadata;
  };

  // M-03: Concession Tracking
  concessions: {
    avgConcessionValue: number;
    percentageOffering: number;
    byProperty: Array<{
      propertyId: string;
      concessionValue: number;
      type: string;
    }>;
    metadata: OutputMetadata;
  };

  // M-04: Concession Velocity
  concessionVelocity: {
    momChange: number; // percentage MoM
    trend: 'INCREASING' | 'STABLE' | 'DECREASING';
    metadata: OutputMetadata;
  };

  // M-05: Rent vs Wage Growth Spread
  rentWageSpread: {
    rentGrowth: number; // percentage
    wageGrowth: number; // percentage
    spread: number; // percentage points
    headroom: 'AMPLE' | 'MODERATE' | 'CONSTRAINED';
    metadata: OutputMetadata;
  };

  // M-06: Occupancy Proxy
  occupancyProxy: {
    estimatedOccupancy: number; // percentage
    trend: 'RISING' | 'STABLE' | 'FALLING';
    byProperty: Array<{
      propertyId: string;
      occupancy: number;
    }>;
    metadata: OutputMetadata;
  };

  // M-07: Traffic-to-Rent Elasticity
  trafficRentElasticity: {
    elasticity: number;
    interpretation: 'RENT_LAGGING' | 'BALANCED' | 'RENT_LEADING';
    metadata: OutputMetadata;
  };

  // M-08: Cap Rate Trends
  capRateTrends: {
    currentCapRate: number;
    yoyChange: number;
    trend: 'COMPRESSING' | 'STABLE' | 'EXPANDING';
    timeSeries: Array<{
      quarter: string;
      capRate: number;
    }>;
    metadata: OutputMetadata;
  };

  // M-09: Investor Activity Index
  investorActivity: {
    transactionVolume: number; // number of sales
    velocityScore: number; // 0-100
    trend: 'RISING' | 'STABLE' | 'FALLING';
    metadata: OutputMetadata;
  };

  // M-10: Review Sentiment Score
  reviewSentiment: {
    score: number; // 0-100
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    byProperty: Array<{
      propertyId: string;
      score: number;
      reviewCount: number;
    }>;
    metadata: OutputMetadata;
  };
}

// ============================================================================
// POSITION SIGNAL (P-01 to P-12)
// ============================================================================

export interface PositionSignal {
  // P-01: Property Card (Municipal)
  propertyCard: {
    parcelId: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    coordinates: { lat: number; lng: number };
    units: number;
    yearBuilt: number;
    lotSizeAcres: number;
    buildingSF: number;
    stories: number;
    parkingSpaces: number;
    parkingType: 'SURFACE' | 'STRUCTURED' | 'UNDERGROUND' | 'MIXED';
    metadata: OutputMetadata;
  };

  // P-02: Vintage Classification
  vintageClass: {
    class: 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C';
    ageYears: number;
    bracket: string; // "1980-1989"
    metadata: OutputMetadata;
  };

  // P-03: Loss-to-Lease Estimate
  lossToLease: {
    actualRent: number;
    marketRent: number;
    lossPerUnit: number;
    lossPercentage: number;
    totalAnnualLoss: number;
    metadata: OutputMetadata;
  };

  // P-04: Ownership Profile & Hold Period
  ownership: {
    ownerName: string;
    ownerEntityType: 'REIT' | 'PE' | 'REGIONAL' | 'LOCAL' | 'INDIVIDUAL';
    purchaseDate: string;
    purchasePrice: number;
    pricePerUnit: number;
    holdPeriodYears: number;
    metadata: OutputMetadata;
  };

  // P-05: Seller Motivation Score
  sellerMotivation: {
    score: number; // 0-100
    factors: Array<{
      factor: string;
      impact: 'HIGH' | 'MEDIUM' | 'LOW';
      description: string;
    }>;
    assessment: string;
    metadata: OutputMetadata;
  };

  // P-06: Tax Assessment & Step-Up Risk
  taxAssessment: {
    currentAssessedValue: number;
    currentAnnualTax: number;
    estimatedPostAcquisitionValue: number;
    estimatedPostAcquisitionTax: number;
    stepUpAmount: number;
    stepUpPerUnit: number;
    metadata: OutputMetadata;
  };

  // P-07: Price/Unit Benchmarks
  priceBenchmarks: {
    recentSales: Array<{
      address: string;
      saleDate: string;
      pricePerUnit: number;
      pricePerSF: number;
    }>;
    submarketAvgPricePerUnit: number;
    submarketAvgPricePerSF: number;
    metadata: OutputMetadata;
  };

  // P-08: Zoning & Development Capacity
  zoning: {
    zoningCode: string;
    allowedDensity: number; // units per acre
    maxHeight: number; // stories
    currentDensity: number;
    unusedCapacity: number; // additional units possible
    far: number; // floor area ratio
    maxFar: number;
    metadata: OutputMetadata;
  };

  // P-09: Amenity Density Score
  amenityDensity: {
    score: number; // 0-100
    restaurants: number;
    transitStops: number;
    retailStores: number;
    walkabilityScore: number;
    metadata: OutputMetadata;
  };

  // P-10: Revenue Conversion Efficiency
  revenueEfficiency: {
    actualGPR: number;
    potentialGPR: number;
    efficiency: number; // percentage
    gap: number;
    metadata: OutputMetadata;
  };

  // P-11: Expense Efficiency Gap
  expenseGap: {
    actualOpEx: number;
    compSetAvgOpEx: number;
    gapPerUnit: number;
    recoverableNOI: number;
    metadata: OutputMetadata;
  };

  // P-12: Turnover Cost Impact
  turnoverCost: {
    annualTurnoverRate: number; // percentage
    avgMakeReadyCost: number;
    avgVacancyLoss: number;
    avgConcessionCost: number;
    totalAnnualCost: number;
    metadata: OutputMetadata;
  };
}

// ============================================================================
// RISK SIGNAL (R-01 to R-10)
// ============================================================================

export interface RiskSignal {
  // R-01: Affordability Absorption Threshold
  affordabilityThreshold: {
    maxSustainableRent: number;
    currentAvgRent: number;
    headroom: number; // percentage
    assessment: 'AMPLE' | 'MODERATE' | 'CONSTRAINED';
    metadata: OutputMetadata;
  };

  // R-02: Vintage Convergence Rate
  vintageConvergence: {
    aToCASpread: number; // rent difference
    spreadTrend: 'WIDENING' | 'STABLE' | 'COMPRESSING';
    valueAddOpportunity: 'STRONG' | 'MODERATE' | 'WEAK';
    metadata: OutputMetadata;
  };

  // R-03: Concession Drag Rate
  concessionDrag: {
    concessionsAsPercentGPR: number;
    assessment: 'HIGH' | 'MODERATE' | 'LOW';
    metadata: OutputMetadata;
  };

  // R-04: Insurance Cost Trends
  insuranceTrends: {
    yoyChange: number; // percentage
    trend: 'RISING' | 'STABLE' | 'FALLING';
    metadata: OutputMetadata;
  };

  // R-05: Tax Reassessment Risk
  taxReassessmentRisk: {
    currentAssessment: number;
    likelyPostSaleAssessment: number;
    increaseAmount: number;
    increasePercentage: number;
    metadata: OutputMetadata;
  };

  // R-06: Deferred Maintenance Estimate
  deferredMaintenance: {
    estimatedCapexNeeds: number;
    perUnitEstimate: number;
    majorItems: Array<{
      item: string;
      estimatedCost: number;
      urgency: 'IMMEDIATE' | 'NEAR_TERM' | 'LONG_TERM';
    }>;
    metadata: OutputMetadata;
  };

  // R-07: Ownership Concentration Risk
  ownershipConcentration: {
    top3OwnerMarketShare: number; // percentage
    herfindahlIndex: number;
    assessment: 'HIGH' | 'MODERATE' | 'LOW';
    metadata: OutputMetadata;
  };

  // R-08: Seasonal Traffic Swing
  seasonalSwing: {
    peakMonth: string;
    troughMonth: string;
    swingPercentage: number;
    revenueVolatility: 'HIGH' | 'MODERATE' | 'LOW';
    metadata: OutputMetadata;
  };

  // R-09: Owner Hold Period vs Market Cycle
  holdPeriodCycle: {
    holdPeriodYears: number;
    marketAvgHoldPeriod: number;
    likelyDebtMaturity: string; // "2024-2027"
    motivation: 'HIGH' | 'MODERATE' | 'LOW';
    metadata: OutputMetadata;
  };

  // R-10: News Sentiment & Alerts
  newsSentiment: {
    alerts: Array<{
      date: string;
      title: string;
      impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      summary: string;
    }>;
    overallSentiment: number; // -100 to +100
    metadata: OutputMetadata;
  };
}

// ============================================================================
// COMPOSITE / AI PREDICTION (C-01 to C-10)
// ============================================================================

export interface CompositeSignal {
  // C-01: JEDI Score (0-100)
  jediScore: {
    overallScore: number;
    breakdown: {
      demand: number;
      supply: number;
      momentum: number;
      position: number;
      risk: number;
    };
    tier: 'EXCEPTIONAL' | 'STRONG' | 'GOOD' | 'FAIR' | 'POOR';
    metadata: OutputMetadata;
  };

  // C-02: Rent Growth Forecast (AI)
  rentForecast: {
    forecasts: Array<{
      year: number;
      rentGrowth: number; // percentage
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    }>;
    metadata: OutputMetadata;
  };

  // C-03: Occupancy Trajectory Model
  occupancyTrajectory: {
    forecasts: Array<{
      quarter: string;
      occupancy: number; // percentage
    }>;
    metadata: OutputMetadata;
  };

  // C-04: Broker OM Variance Report
  omVariance: {
    variances: Array<{
      metric: string;
      brokerAssumption: number;
      jediAssumption: number;
      variance: number;
      impact: string;
    }>;
    totalNOIVariance: number;
    metadata: OutputMetadata;
  };

  // C-05: Strategy Arbitrage Score
  strategyArbitrage: {
    strategies: Array<{
      name: string;
      irr: number;
      score: number;
    }>;
    bestStrategy: string;
    arbitrageSpread: number; // IRR difference between best and second-best
    metadata: OutputMetadata;
  };

  // C-06: Apt-to-Condo Conversion Spread
  condoConversion: {
    rentalNOI: number;
    condoSelloutValue: number;
    spread: number;
    feasible: boolean;
    metadata: OutputMetadata;
  };

  // C-07: Build-to-Rent vs Hold Breakeven
  buildVsHold: {
    buildCost: number;
    existingAcquisitionCost: number;
    breakeven: 'BUILD_CHEAPER' | 'BUY_CHEAPER' | 'NEUTRAL';
    metadata: OutputMetadata;
  };

  // C-08: STR Hybrid Revenue Uplift
  strHybrid: {
    ltrNOI: number;
    strNOI: number;
    uplift: number; // percentage
    feasible: boolean;
    metadata: OutputMetadata;
  };

  // C-09: Sensitivity Scenario Generator
  scenarios: {
    bull: { irr: number; probability: number };
    base: { irr: number; probability: number };
    bear: { irr: number; probability: number };
    metadata: OutputMetadata;
  };

  // C-10: Submarket Ranking Report
  submarketRanking: {
    rankings: Array<{
      submarketName: string;
      jediScore: number;
      rank: number;
      narrative: string;
    }>;
    metadata: OutputMetadata;
  };
}

// ============================================================================
// TRAFFIC ENGINE ★ NEW (T-01 to T-10)
// ============================================================================

export interface TrafficSignal {
  // T-01: Weekly Walk-In Prediction
  walkInPrediction: {
    weeklyWalkIns: number;
    dailyAverage: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    methodology: string;
    metadata: OutputMetadata;
  };

  // T-02: Physical Traffic Score (0-100)
  physicalTrafficScore: {
    score: number;
    aadt: number; // average annual daily traffic
    roadClass: string;
    intersectionType: string;
    tier: 'EXCEPTIONAL' | 'STRONG' | 'MODERATE' | 'WEAK';
    metadata: OutputMetadata;
  };

  // T-03: Digital Traffic Score (0-100)
  digitalTrafficScore: {
    score: number;
    searchVolume: number;
    websiteTraffic: number;
    socialMentions: number;
    tier: 'EXCEPTIONAL' | 'STRONG' | 'MODERATE' | 'WEAK';
    metadata: OutputMetadata;
  };

  // T-04: Traffic Correlation Signal
  trafficCorrelation: {
    physicalScore: number;
    digitalScore: number;
    classification: 'HIDDEN_GEM' | 'VALIDATED' | 'HYPE_CHECK' | 'DEAD_ZONE';
    interpretation: string;
    metadata: OutputMetadata;
  };

  // T-05: Traffic-to-Lease Prediction
  trafficToLease: {
    estimatedLeasesPerMonth: number;
    conversionRate: number; // percentage
    metadata: OutputMetadata;
  };

  // T-06: Capture Rate
  captureRate: {
    rate: number; // percentage
    factors: Array<{
      factor: string;
      impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    }>;
    metadata: OutputMetadata;
  };

  // T-07: Property Traffic Trajectory
  trafficTrajectory: {
    trend: 'ACCELERATING' | 'STABLE' | 'DECLINING';
    eightWeekTimeSeries: Array<{
      week: string;
      walkIns: number;
    }>;
    metadata: OutputMetadata;
  };

  // T-08: Generator Proximity Score
  generatorProximity: {
    score: number; // 0-100
    generators: Array<{
      name: string;
      type: 'EMPLOYER' | 'TRANSIT' | 'RETAIL' | 'ENTERTAINMENT';
      distanceMiles: number;
      trafficContribution: number;
    }>;
    metadata: OutputMetadata;
  };

  // T-09: Competitive Traffic Share
  competitiveTrafficShare: {
    propertyWalkIns: number;
    tradeAreaTotalWalkIns: number;
    sharePercentage: number;
    rank: number;
    metadata: OutputMetadata;
  };

  // T-10: Traffic Validation Confidence
  validationConfidence: {
    confidence: number; // 0-100
    userActuals: number | null;
    predictedValue: number;
    variance: number | null;
    status: 'VALIDATED' | 'PENDING' | 'UNVALIDATED';
    metadata: OutputMetadata;
  };
}

// ============================================================================
// DEVELOPMENT CAPACITY INTELLIGENCE ★ NEW (DC-01 to DC-11)
// ============================================================================

export interface DevCapacitySignal {
  // DC-01: Capacity Ratio
  capacityRatio: {
    remainingCapacity: number; // units
    existingStock: number; // units
    ratio: number; // percentage
    assessment: 'HIGHLY_CONSTRAINED' | 'MODERATELY_CONSTRAINED' | 'UNCONSTRAINED';
    metadata: OutputMetadata;
  };

  // DC-02: Buildout Timeline
  buildoutTimeline: {
    yearsToBuil dout: number;
    practicalBuildout: boolean;
    metadata: OutputMetadata;
  };

  // DC-03: Supply Constraint Score (0-100)
  supplyConstraint: {
    score: number;
    factors: Array<{
      factor: string;
      weight: number;
      score: number;
    }>;
    tier: 'HIGHLY_CONSTRAINED' | 'MODERATELY_CONSTRAINED' | 'UNCONSTRAINED';
    metadata: OutputMetadata;
  };

  // DC-04: Supply Overhang Risk
  overhangRisk: {
    hiddenSupply: number; // units
    riskScore: number; // 0-100
    assessment: 'HIGH_RISK' | 'MODERATE_RISK' | 'LOW_RISK';
    metadata: OutputMetadata;
  };

  // DC-05: Last Mover Advantage Flag
  lastMoverAdvantage: {
    isLastMover: boolean;
    capacityRemaining: number;
    activeDevelopment: boolean;
    premiumExpected: number; // percentage
    metadata: OutputMetadata;
  };

  // DC-06: Development Probability
  developmentProbability: {
    parcelId: string;
    probability: number; // 0-100
    factors: Array<{
      factor: string;
      score: number;
    }>;
    estimatedUnits: number;
    metadata: OutputMetadata;
  };

  // DC-07: Pricing Power Index (0-100)
  pricingPower: {
    score: number;
    components: {
      constraint: number;
      demandStrength: number;
      occupancy: number;
      concessions: number;
    };
    assessment: 'STRONG' | 'MODERATE' | 'WEAK';
    metadata: OutputMetadata;
  };

  // DC-08: Supply Wave Forecast (10yr)
  supplyWave: {
    tenYearForecast: Array<{
      year: number;
      confirmedPipeline: number;
      capacityConversion: number;
      total: number;
      phase: 'PEAKING' | 'CRESTING' | 'TROUGH' | 'BUILDING';
    }>;
    metadata: OutputMetadata;
  };

  // DC-09: Developer Land Bank Index
  developerLandBank: {
    parcels: Array<{
      parcelId: string;
      owner: string;
      estimatedUnits: number;
      developmentProbability: number;
      estimatedStart: string; // "2026-Q3"
    }>;
    totalPotentialUnits: number;
    metadata: OutputMetadata;
  };

  // DC-10: Assemblage Opportunity Score
  assemblageOpportunity: {
    clusterScore: number; // 0-100
    parcels: Array<{
      parcelId: string;
      owner: string;
      acres: number;
    }>;
    combinedCapacity: number; // units
    metadata: OutputMetadata;
  };

  // DC-11: Supply-Adjusted Rent Forecast
  supplyAdjustedRentForecast: {
    baseForecasts: Array<{
      year: number;
      rentGrowth: number;
    }>;
    adjustedForecasts: Array<{
      year: number;
      rentGrowth: number;
      adjustment: number;
    }>;
    metadata: OutputMetadata;
  };
}

// ============================================================================
// TRADE AREA INTELLIGENCE ★ NEW (TA-01 to TA-04)
// ============================================================================

export interface TradeAreaSignal {
  // TA-01: Trade Area Definition
  tradeAreaDefinition: {
    type: 'RADIUS' | 'DRIVE_TIME' | 'TRAFFIC_SHED' | 'CUSTOM';
    radiusMiles?: number;
    driveTimeMinutes?: number;
    boundary: Array<{ lat: number; lng: number }>; // GeoJSON polygon
    metadata: OutputMetadata;
  };

  // TA-02: Competitive Set
  competitiveSet: {
    properties: Array<{
      propertyId: string;
      name: string;
      address: string;
      units: number;
      yearBuilt: number;
      class: string;
      distanceMiles: number;
      relevanceScore: number; // 0-100
    }>;
    metadata: OutputMetadata;
  };

  // TA-03: Trade Area Supply-Demand Balance
  tradeAreaBalance: {
    totalUnits: number;
    renterHouseholds: number;
    jobsToApartments: number;
    saturation: number;
    assessment: 'OVERSUPPLIED' | 'BALANCED' | 'UNDERSUPPLIED';
    metadata: OutputMetadata;
  };

  // TA-04: Digital Competitive Intel
  digitalCompetitiveIntel: {
    properties: Array<{
      propertyId: string;
      websiteTraffic: number;
      seoScore: number;
      adSpend: number;
      competitivePosition: 'LEADER' | 'CHALLENGER' | 'FOLLOWER';
    }>;
    metadata: OutputMetadata;
  };
}

// ============================================================================
// COMPLETE MARKET INTELLIGENCE PROFILE
// ============================================================================

export interface MarketIntelligenceProfile {
  marketId: string;
  marketName: string;
  level: 'MSA' | 'SUBMARKET' | 'PROPERTY';
  lastUpdated: string;

  demand: DemandSignal;
  supply: SupplySignal;
  momentum: MomentumSignal;
  position?: PositionSignal; // Only for property-level
  risk: RiskSignal;
  composite: CompositeSignal;
  traffic?: TrafficSignal; // Only for property-level
  devCapacity: DevCapacitySignal;
  tradeArea?: TradeAreaSignal; // Only for property-level
}

// ============================================================================
// PROPERTY INTELLIGENCE (Complete property profile with all outputs)
// ============================================================================

export interface PropertyIntelligence extends MarketIntelligenceProfile {
  level: 'PROPERTY';
  propertyId: string;
  position: PositionSignal;
  traffic: TrafficSignal;
  tradeArea: TradeAreaSignal;
}

// ============================================================================
// UI-SPECIFIC TYPES
// ============================================================================

export interface SignalGroup {
  id: string;
  name: string;
  color: string; // For color-coding
  icon: string;
  outputCount: number;
}

export const SIGNAL_GROUPS: SignalGroup[] = [
  { id: 'demand', name: 'Demand', color: '#10b981', icon: '📈', outputCount: 12 },
  { id: 'supply', name: 'Supply', color: '#ef4444', icon: '🏗️', outputCount: 10 },
  { id: 'momentum', name: 'Momentum', color: '#f59e0b', icon: '🚀', outputCount: 10 },
  { id: 'position', name: 'Position', color: '#8b5cf6', icon: '📍', outputCount: 12 },
  { id: 'risk', name: 'Risk', color: '#6b7280', icon: '⚠️', outputCount: 10 },
  { id: 'composite', name: 'Composite', color: '#14b8a6', icon: '🤖', outputCount: 10 },
  { id: 'traffic', name: 'Traffic', color: '#3b82f6', icon: '🚶', outputCount: 10 },
  { id: 'devCapacity', name: 'Dev Capacity', color: '#7c3aed', icon: '🏗️', outputCount: 11 },
  { id: 'tradeArea', name: 'Trade Area', color: '#ec4899', icon: '🎯', outputCount: 4 },
];
