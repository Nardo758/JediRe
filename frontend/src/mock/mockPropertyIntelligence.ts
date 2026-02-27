/**
 * Mock Property Intelligence Data
 * Sample data for 100 Summit Ridge Dr property with all 89 outputs
 */

import { PropertyIntelligence, OutputMetadata } from '../types/marketIntelligence.types';

// Helper to create metadata
const createMetadata = (outputId: string, sourceName: string, confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH'): OutputMetadata => ({
  outputId,
  source: {
    id: sourceName.toLowerCase().replace(/\s/g, '_'),
    name: sourceName,
    lastUpdated: '2026-02-20T12:00:00Z',
    confidence,
    cost: sourceName.includes('Municipal') || sourceName.includes('BLS') ? 'FREE' : 'PAID',
  },
  updatedAt: '2026-02-20T12:00:00Z',
});

export const mockPropertyIntelligence: PropertyIntelligence = {
  marketId: 'atlanta-buckhead',
  marketName: 'Atlanta - Buckhead',
  level: 'PROPERTY',
  propertyId: 'prop-summit-ridge-100',
  lastUpdated: '2026-02-21T06:00:00Z',

  // DEMAND SIGNAL
  demand: {
    jobsToApartments: {
      value: 3.9,
      threshold: 4.0,
      assessment: 'MODERATE',
      metadata: createMetadata('D-01', 'BLS API + Municipal Records'),
    },
    newJobsToNewUnits: {
      value: 5.2,
      threshold: 5.0,
      assessment: 'STRONG',
      metadata: createMetadata('D-02', 'BLS API'),
    },
    netMigrationToSupply: {
      inMigration: 15200,
      newUnits: 2400,
      ratio: 6.3,
      assessment: 'STRONG',
      metadata: createMetadata('D-03', 'Census ACS'),
    },
    householdFormationToSupply: {
      newHouseholds: 8400,
      newUnits: 2400,
      ratio: 3.5,
      assessment: 'STRONG',
      metadata: createMetadata('D-04', 'Census ACS'),
    },
    trafficGrowthRate: {
      yoyChange: 4.2,
      trend: 'ACCELERATING',
      metadata: createMetadata('D-05', 'State DOT'),
    },
    trafficAcceleration: {
      secondDerivative: 0.8,
      assessment: 'ACCELERATING',
      metadata: createMetadata('D-06', 'State DOT'),
    },
    digitalPhysicalGap: {
      gap: -42,
      interpretation: 'UNDISCOVERED',
      metadata: createMetadata('D-07', 'Google Trends + State DOT'),
    },
    searchInterest: {
      volume: 34,
      trend: 'STABLE',
      metadata: createMetadata('D-08', 'Google Trends API'),
    },
    demandMomentum: {
      score: 78,
      trend: 'STRENGTHENING',
      metadata: createMetadata('D-09', 'Computed from D-01 through D-08'),
    },
    employmentGravity: {
      score: 82,
      majorEmployers: [
        { name: 'State Farm', employees: 4200, distanceMiles: 1.2 },
        { name: 'Cox Enterprises', employees: 3800, distanceMiles: 2.1 },
        { name: 'Chick-fil-A HQ', employees: 2100, distanceMiles: 1.8 },
      ],
      metadata: createMetadata('D-10', 'BLS LODES + Census'),
    },
    rentToMortgageDiscount: {
      rentCost: 1320,
      mortgageCost: 2180,
      discount: 39.4,
      interpretation: 'Strong rental demand - renting is 39% cheaper than buying',
      metadata: createMetadata('D-11', 'Apartments.com + Freddie Mac'),
    },
    demographics: {
      population: 186400,
      growthRate: 2.8,
      medianHHI: 72400,
      medianAge: 34,
      renterPercentage: 58,
      metadata: createMetadata('D-12', 'Census ACS'),
    },
  },

  // SUPPLY SIGNAL
  supply: {
    inventory: {
      totalProperties: 18,
      totalUnits: 3200,
      properties: [], // Full list would be here
      metadata: createMetadata('S-01', 'Municipal Property Records'),
    },
    underConstruction: {
      projectCount: 2,
      totalUnits: 400,
      projects: [
        { name: 'Lenox Parc Phase 2', units: 250, estimatedDelivery: '2026-Q3', submarket: 'Buckhead' },
        { name: 'Northside Reserve', units: 150, estimatedDelivery: '2026-Q4', submarket: 'Buckhead' },
      ],
      metadata: createMetadata('S-02', 'Municipal Building Permits'),
    },
    permittedNotStarted: {
      projectCount: 1,
      totalUnits: 200,
      projects: [
        { name: 'Peachtree Heights', units: 200, permitDate: '2025-11-15', submarket: 'Buckhead' },
      ],
      metadata: createMetadata('S-03', 'Municipal Building Permits'),
    },
    absorptionRunway: {
      pipelineUnits: 600,
      monthlyAbsorption: 42,
      runwayMonths: 14.3,
      assessment: 'BALANCED',
      metadata: createMetadata('S-04', 'S-02 + S-03 / Historical absorption'),
    },
    deliveryClustering: {
      clusterRisk: 'MEDIUM',
      clusters: [
        { submarket: 'Buckhead', timeframe: '2026-Q3/Q4', units: 400, riskScore: 58 },
      ],
      metadata: createMetadata('S-05', 'S-02 geospatial + temporal analysis'),
    },
    permitMomentum: {
      qoqChange: -8.2,
      trend: 'FALLING',
      metadata: createMetadata('S-06', 'S-03 trend analysis'),
    },
    buildEconomics: {
      constructionCostPerUnit: 285000,
      yieldOnCost: 4.8,
      marketCapRate: 5.2,
      feasible: false,
      metadata: createMetadata('S-07', 'RSMeans + Market Data', 'MEDIUM'),
    },
    saturation: {
      unitsPerCapita: 17.2,
      benchmark: 16.5,
      ratio: 1.04,
      assessment: 'BALANCED',
      metadata: createMetadata('S-08', 'S-01 / D-12'),
    },
    permitConversion: {
      conversionRate: 82,
      historicalAverage: 85,
      assessment: 'Slightly below historical average',
      metadata: createMetadata('S-09', 'Historical S-03 → S-02 tracking'),
    },
    vintageBreakdown: {
      distribution: [
        { decade: '2020+', units: 840, percentage: 26, class: 'A' },
        { decade: '2010-2019', units: 680, percentage: 21, class: 'A-' },
        { decade: '2000-2009', units: 520, percentage: 16, class: 'B+' },
        { decade: '1990-1999', units: 480, percentage: 15, class: 'B' },
        { decade: '1980-1989', units: 440, percentage: 14, class: 'B-' },
        { decade: 'Pre-1980', units: 240, percentage: 8, class: 'C' },
      ],
      metadata: createMetadata('S-10', 'P-01 year_built aggregated'),
    },
  },

  // MOMENTUM SIGNAL
  momentum: {
    rentByVintage: {
      classes: [
        { class: 'A', avgRent: 1680, yoyGrowth: 5.2, trend: [1540, 1580, 1620, 1650, 1680] },
        { class: 'A-', avgRent: 1520, yoyGrowth: 4.8, trend: [1420, 1450, 1480, 1500, 1520] },
        { class: 'B+', avgRent: 1380, yoyGrowth: 4.2, trend: [1290, 1320, 1350, 1365, 1380] },
        { class: 'B', avgRent: 1320, yoyGrowth: 3.8, trend: [1240, 1270, 1295, 1308, 1320] },
        { class: 'B-', avgRent: 1180, yoyGrowth: 3.2, trend: [1110, 1135, 1155, 1168, 1180] },
        { class: 'C', avgRent: 980, yoyGrowth: 2.4, trend: [920, 940, 960, 970, 980] },
      ],
      metadata: createMetadata('M-01', 'Apartments.com Scraper'),
    },
    rentAcceleration: {
      accelerationRate: 0.4,
      assessment: 'ACCELERATING',
      metadata: createMetadata('M-02', 'M-01 second derivative'),
    },
    concessions: {
      avgConcessionValue: 450,
      percentageOffering: 18,
      byProperty: [],
      metadata: createMetadata('M-03', 'Apartments.com Scraper'),
    },
    concessionVelocity: {
      momChange: -2.4,
      trend: 'DECREASING',
      metadata: createMetadata('M-04', 'M-03 trend'),
    },
    rentWageSpread: {
      rentGrowth: 4.2,
      wageGrowth: 3.1,
      spread: 1.1,
      headroom: 'MODERATE',
      metadata: createMetadata('M-05', 'M-01 + BLS wages'),
    },
    occupancyProxy: {
      estimatedOccupancy: 93.2,
      trend: 'STABLE',
      byProperty: [],
      metadata: createMetadata('M-06', 'Apartments.com available units'),
    },
    trafficRentElasticity: {
      elasticity: 0.82,
      interpretation: 'BALANCED',
      metadata: createMetadata('M-07', 'D-05 + M-01 correlation'),
    },
    capRateTrends: {
      currentCapRate: 5.2,
      yoyChange: -0.3,
      trend: 'COMPRESSING',
      timeSeries: [
        { quarter: '2025-Q1', capRate: 5.6 },
        { quarter: '2025-Q2', capRate: 5.4 },
        { quarter: '2025-Q3', capRate: 5.3 },
        { quarter: '2025-Q4', capRate: 5.2 },
      ],
      metadata: createMetadata('M-08', 'Municipal deed records'),
    },
    investorActivity: {
      transactionVolume: 12,
      velocityScore: 68,
      trend: 'STABLE',
      metadata: createMetadata('M-09', 'Municipal deed frequency'),
    },
    reviewSentiment: {
      score: 72,
      trend: 'STABLE',
      byProperty: [],
      metadata: createMetadata('M-10', 'Google Places reviews NLP'),
    },
  },

  // POSITION SIGNAL
  position: {
    propertyCard: {
      parcelId: '12-34-56-789-000-0010',
      address: '100 Summit Ridge Dr',
      city: 'Atlanta',
      state: 'GA',
      zip: '30342',
      coordinates: { lat: 33.8688, lng: -84.3544 },
      units: 200,
      yearBuilt: 1987,
      lotSizeAcres: 8.2,
      buildingSF: 180000,
      stories: 3,
      parkingSpaces: 280,
      parkingType: 'SURFACE',
      metadata: createMetadata('P-01', 'Municipal Property Records'),
    },
    vintageClass: {
      class: 'B-',
      ageYears: 39,
      bracket: '1980-1989',
      metadata: createMetadata('P-02', 'P-01 year_built derived'),
    },
    lossToLease: {
      actualRent: 1180,
      marketRent: 1320,
      lossPerUnit: 140,
      lossPercentage: 10.6,
      totalAnnualLoss: 336000,
      metadata: createMetadata('P-03', 'M-01 comp − actual'),
    },
    ownership: {
      ownerName: 'Greystone Capital Partners LLC',
      ownerEntityType: 'REGIONAL',
      purchaseDate: '2019-03-15',
      purchasePrice: 28500000,
      pricePerUnit: 142500,
      holdPeriodYears: 6.9,
      metadata: createMetadata('P-04', 'Municipal Deed Records'),
    },
    sellerMotivation: {
      score: 72,
      factors: [
        { factor: 'Hold period (6.9 yrs) above market avg (5.2 yrs)', impact: 'HIGH', description: 'Longer hold suggests readiness to exit' },
        { factor: 'Likely debt maturity 2024-2026', impact: 'HIGH', description: 'Typical 5-7 year loan term approaching' },
        { factor: 'Embedded equity 40-58%', impact: 'MEDIUM', description: 'Significant appreciation to harvest' },
      ],
      assessment: 'High probability seller - multiple motivation signals align',
      metadata: createMetadata('P-05', 'P-04 + R-09 + patterns'),
    },
    taxAssessment: {
      currentAssessedValue: 32000000,
      currentAnnualTax: 800000,
      estimatedPostAcquisitionValue: 44000000,
      estimatedPostAcquisitionTax: 1100000,
      stepUpAmount: 300000,
      stepUpPerUnit: 1500,
      metadata: createMetadata('P-06', 'Municipal Tax Records'),
    },
    priceBenchmarks: {
      recentSales: [
        { address: '456 Oak Ave', saleDate: '2024-08-12', pricePerUnit: 215000, pricePerSF: 240 },
        { address: '789 Pine St', saleDate: '2024-05-22', pricePerUnit: 195000, pricePerSF: 218 },
        { address: '123 Elm Dr', saleDate: '2023-11-30', pricePerUnit: 210000, pricePerSF: 235 },
      ],
      submarketAvgPricePerUnit: 207000,
      submarketAvgPricePerSF: 231,
      metadata: createMetadata('P-07', 'Municipal sale records'),
    },
    zoning: {
      zoningCode: 'RM-24',
      allowedDensity: 24,
      maxHeight: 4,
      currentDensity: 24.4,
      unusedCapacity: 0,
      far: 0.50,
      maxFar: 0.65,
      metadata: createMetadata('P-08', 'Municipal Zoning + Municode'),
    },
    amenityDensity: {
      score: 78,
      restaurants: 42,
      transitStops: 3,
      retailStores: 18,
      walkabilityScore: 72,
      metadata: createMetadata('P-09', 'Google Places API'),
    },
    revenueEfficiency: {
      actualGPR: 2832000,
      potentialGPR: 3168000,
      efficiency: 89.4,
      gap: 336000,
      metadata: createMetadata('P-10', 'PMS Integration', 'MEDIUM'),
    },
    expenseGap: {
      actualOpEx: 5800,
      compSetAvgOpEx: 5650,
      gapPerUnit: 150,
      recoverableNOI: 30000,
      metadata: createMetadata('P-11', 'PMS Integration', 'MEDIUM'),
    },
    turnoverCost: {
      annualTurnoverRate: 41,
      avgMakeReadyCost: 1200,
      avgVacancyLoss: 1800,
      avgConcessionCost: 450,
      totalAnnualCost: 282600,
      metadata: createMetadata('P-12', 'PMS Integration', 'MEDIUM'),
    },
  },

  // RISK SIGNAL
  risk: {
    affordabilityThreshold: {
      maxSustainableRent: 1810,
      currentAvgRent: 1320,
      headroom: 37.1,
      assessment: 'AMPLE',
      metadata: createMetadata('R-01', 'Census + M-01'),
    },
    vintageConvergence: {
      aToCASpread: 700,
      spreadTrend: 'WIDENING',
      valueAddOpportunity: 'STRONG',
      metadata: createMetadata('R-02', 'M-01 spread trend'),
    },
    concessionDrag: {
      concessionsAsPercentGPR: 2.7,
      assessment: 'LOW',
      metadata: createMetadata('R-03', 'M-03 / M-01'),
    },
    insuranceTrends: {
      yoyChange: 18.2,
      trend: 'RISING',
      metadata: createMetadata('R-04', 'Industry reports', 'MEDIUM'),
    },
    taxReassessmentRisk: {
      currentAssessment: 32000000,
      likelyPostSaleAssessment: 44000000,
      increaseAmount: 300000,
      increasePercentage: 37.5,
      metadata: createMetadata('R-05', 'P-06 + sale price'),
    },
    deferredMaintenance: {
      estimatedCapexNeeds: 2600000,
      perUnitEstimate: 13000,
      majorItems: [
        { item: 'Roof replacement', estimatedCost: 1600000, urgency: 'NEAR_TERM' },
        { item: 'HVAC systems', estimatedCost: 800000, urgency: 'NEAR_TERM' },
        { item: 'Parking lot resurfacing', estimatedCost: 200000, urgency: 'LONG_TERM' },
      ],
      metadata: createMetadata('R-06', 'P-01 age + P-10/11'),
    },
    ownershipConcentration: {
      top3OwnerMarketShare: 64.2,
      herfindahlIndex: 0.15,
      assessment: 'MODERATE',
      metadata: createMetadata('R-07', 'P-04 aggregated'),
    },
    seasonalSwing: {
      peakMonth: 'June',
      troughMonth: 'December',
      swingPercentage: 62,
      revenueVolatility: 'MODERATE',
      metadata: createMetadata('R-08', 'D-05 seasonal variation'),
    },
    holdPeriodCycle: {
      holdPeriodYears: 6.9,
      marketAvgHoldPeriod: 5.2,
      likelyDebtMaturity: '2024-2026',
      motivation: 'HIGH',
      metadata: createMetadata('R-09', 'P-04 + M-08 trend'),
    },
    newsSentiment: {
      alerts: [
        { date: '2026-02-18', title: 'State Farm expanding Buckhead office', impact: 'POSITIVE', severity: 'MEDIUM', summary: 'Major employer adding 800 jobs within 1 mile' },
        { date: '2026-02-10', title: 'Lenox Mall redevelopment approved', impact: 'POSITIVE', severity: 'HIGH', summary: 'Mixed-use project will bring retail and dining upgrades' },
      ],
      overallSentiment: 68,
      metadata: createMetadata('R-10', 'NewsAPI + Email parsing'),
    },
  },

  // COMPOSITE SIGNAL
  composite: {
    jediScore: {
      overallScore: 78,
      breakdown: {
        demand: 78,
        supply: 72,
        momentum: 74,
        position: 82,
        risk: 68,
      },
      tier: 'STRONG',
      metadata: createMetadata('C-01', 'All 5 master signals'),
    },
    rentForecast: {
      forecasts: [
        { year: 2026, rentGrowth: 4.2, confidence: 'HIGH' },
        { year: 2027, rentGrowth: 3.8, confidence: 'HIGH' },
        { year: 2028, rentGrowth: 3.5, confidence: 'MEDIUM' },
        { year: 2029, rentGrowth: 3.2, confidence: 'MEDIUM' },
        { year: 2030, rentGrowth: 3.0, confidence: 'LOW' },
      ],
      metadata: createMetadata('C-02', 'ML model: demand+supply+momentum'),
    },
    occupancyTrajectory: {
      forecasts: [
        { quarter: '2026-Q2', occupancy: 93.5 },
        { quarter: '2026-Q3', occupancy: 92.8 },
        { quarter: '2026-Q4', occupancy: 93.2 },
        { quarter: '2027-Q1', occupancy: 94.0 },
      ],
      metadata: createMetadata('C-03', 'Supply + demand dynamics'),
    },
    omVariance: {
      variances: [
        { metric: 'Rent Growth', brokerAssumption: 5.0, jediAssumption: 4.2, variance: -0.8, impact: 'Overestimated revenue by $96K Year 1' },
        { metric: 'Property Tax', brokerAssumption: 800000, jediAssumption: 1100000, variance: 300000, impact: 'Underestimated expense by $300K/year' },
      ],
      totalNOIVariance: -396000,
      metadata: createMetadata('C-04', 'OM inputs vs AI outputs'),
    },
    strategyArbitrage: {
      strategies: [
        { name: 'Value-Add Renovation', irr: 13.3, score: 92 },
        { name: 'Buy & Hold', irr: 9.2, score: 78 },
        { name: 'Partial Redevelopment', irr: 8.4, score: 65 },
      ],
      bestStrategy: 'Value-Add Renovation',
      arbitrageSpread: 4.1,
      metadata: createMetadata('C-05', 'All strategy analyses'),
    },
    condoConversion: {
      rentalNOI: 2300000,
      condoSelloutValue: 48000000,
      spread: 5200000,
      feasible: true,
      metadata: createMetadata('C-06', 'M-01 + condo comps'),
    },
    buildVsHold: {
      buildCost: 285000,
      existingAcquisitionCost: 225000,
      breakeven: 'BUY_CHEAPER',
      metadata: createMetadata('C-07', 'S-07 + P-07 + M-01'),
    },
    strHybrid: {
      ltrNOI: 2300000,
      strNOI: 2680000,
      uplift: 16.5,
      feasible: true,
      metadata: createMetadata('C-08', 'LTR NOI vs STR model'),
    },
    scenarios: {
      bull: { irr: 16.2, probability: 0.25 },
      base: { irr: 13.3, probability: 0.50 },
      bear: { irr: 9.8, probability: 0.25 },
      metadata: createMetadata('C-09', 'Monte Carlo on all inputs'),
    },
    submarketRanking: {
      rankings: [
        { submarketName: 'Buckhead', jediScore: 78, rank: 2, narrative: 'Strong demand + falling supply risk' },
        { submarketName: 'Midtown', jediScore: 82, rank: 1, narrative: 'Best overall: high demand + constrained supply' },
        { submarketName: 'Decatur', jediScore: 74, rank: 3, narrative: 'Good fundamentals but high pipeline' },
      ],
      metadata: createMetadata('C-10', 'C-01 per submarket'),
    },
  },

  // TRAFFIC SIGNAL ★ NEW
  traffic: {
    walkInPrediction: {
      weeklyWalkIns: 1840,
      dailyAverage: 263,
      confidence: 'HIGH',
      methodology: 'ADT + Census + Generators + Capture Rate',
      metadata: createMetadata('T-01', 'State DOT + Census + Computed'),
    },
    physicalTrafficScore: {
      score: 78,
      aadt: 24500,
      roadClass: 'Minor Arterial',
      intersectionType: 'Signalized',
      tier: 'STRONG',
      metadata: createMetadata('T-02', 'State DOT + Road classification'),
    },
    digitalTrafficScore: {
      score: 34,
      searchVolume: 120,
      websiteTraffic: 1840,
      socialMentions: 28,
      tier: 'WEAK',
      metadata: createMetadata('T-03', 'Google Trends + Website analytics'),
    },
    trafficCorrelation: {
      physicalScore: 78,
      digitalScore: 34,
      classification: 'HIDDEN_GEM',
      interpretation: 'High physical traffic but low digital presence - under-discovered property with strong fundamentals',
      metadata: createMetadata('T-04', 'T-02 vs T-03 matrix'),
    },
    trafficToLease: {
      estimatedLeasesPerMonth: 18,
      conversionRate: 9.8,
      metadata: createMetadata('T-05', 'T-01 + T-03 → ML model'),
    },
    captureRate: {
      rate: 12.4,
      factors: [
        { factor: 'Signalized intersection access', impact: 'POSITIVE' },
        { factor: 'Corner lot visibility', impact: 'POSITIVE' },
        { factor: 'Setback from road', impact: 'NEUTRAL' },
      ],
      metadata: createMetadata('T-06', 'Frontage + Corner + Setback + Signs'),
    },
    trafficTrajectory: {
      trend: 'STABLE',
      eightWeekTimeSeries: [
        { week: '2026-W01', walkIns: 1820 },
        { week: '2026-W02', walkIns: 1840 },
        { week: '2026-W03', walkIns: 1835 },
        { week: '2026-W04', walkIns: 1850 },
        { week: '2026-W05', walkIns: 1845 },
        { week: '2026-W06', walkIns: 1860 },
        { week: '2026-W07', walkIns: 1855 },
        { week: '2026-W08', walkIns: 1840 },
      ],
      metadata: createMetadata('T-07', 'T-01 time series'),
    },
    generatorProximity: {
      score: 82,
      generators: [
        { name: 'State Farm regional office', type: 'EMPLOYER', distanceMiles: 1.2, trafficContribution: 380 },
        { name: 'MARTA Lenox station', type: 'TRANSIT', distanceMiles: 0.8, trafficContribution: 420 },
        { name: 'Lenox Square Mall', type: 'RETAIL', distanceMiles: 0.9, trafficContribution: 520 },
      ],
      metadata: createMetadata('T-08', 'Census + BLS + Transit + Places'),
    },
    competitiveTrafficShare: {
      propertyWalkIns: 1840,
      tradeAreaTotalWalkIns: 12400,
      sharePercentage: 14.8,
      rank: 3,
      metadata: createMetadata('T-09', 'T-01 subject / T-01 trade area sum'),
    },
    validationConfidence: {
      confidence: 88,
      userActuals: 1920,
      predictedValue: 1840,
      variance: 4.2,
      status: 'VALIDATED',
      metadata: createMetadata('T-10', 'User actuals vs predicted'),
    },
  },

  // DEV CAPACITY SIGNAL ★ NEW
  devCapacity: {
    capacityRatio: {
      remainingCapacity: 720,
      existingStock: 3200,
      ratio: 22.5,
      assessment: 'MODERATELY_CONSTRAINED',
      metadata: createMetadata('DC-01', 'Zoning + Vacant Parcels / S-01'),
    },
    buildoutTimeline: {
      yearsToBuil dout: 12.4,
      practicalBuildout: true,
      metadata: createMetadata('DC-02', 'Capacity / Annual absorption'),
    },
    supplyConstraint: {
      score: 72,
      factors: [
        { factor: 'Limited vacant land', weight: 0.35, score: 78 },
        { factor: 'Zoning restrictions', weight: 0.25, score: 68 },
        { factor: 'Infrastructure capacity', weight: 0.20, score: 75 },
        { factor: 'Entitlement difficulty', weight: 0.20, score: 65 },
      ],
      tier: 'MODERATELY_CONSTRAINED',
      metadata: createMetadata('DC-03', 'Composite: zoning + land + entitlement'),
    },
    overhangRisk: {
      hiddenSupply: 180,
      riskScore: 28,
      assessment: 'LOW_RISK',
      metadata: createMetadata('DC-04', '(Capacity − Pipeline) / Inventory'),
    },
    lastMoverAdvantage: {
      isLastMover: false,
      capacityRemaining: 720,
      activeDevelopment: true,
      premiumExpected: 0,
      metadata: createMetadata('DC-05', 'Capacity < 15% + Active Dev > 0'),
    },
    developmentProbability: {
      parcelId: '12-34-56-789-000-0025',
      probability: 42,
      factors: [
        { factor: 'Owner is developer', score: 75 },
        { factor: 'Zoned appropriately', score: 85 },
        { factor: 'Infrastructure ready', score: 60 },
        { factor: 'Market demand strong', score: 78 },
      ],
      estimatedUnits: 180,
      metadata: createMetadata('DC-06', 'Owner + zoning + infra + market'),
    },
    pricingPower: {
      score: 74,
      components: {
        constraint: 72,
        demandStrength: 78,
        occupancy: 74,
        concessions: 73,
      },
      assessment: 'STRONG',
      metadata: createMetadata('DC-07', 'DC-03 40% + D-01 25% + M-06 20% + M-03 inv 15%'),
    },
    supplyWave: {
      tenYearForecast: [
        { year: 2026, confirmedPipeline: 400, capacityConversion: 45, total: 445, phase: 'CRESTING' },
        { year: 2027, confirmedPipeline: 200, capacityConversion: 52, total: 252, phase: 'TROUGH' },
        { year: 2028, confirmedPipeline: 0, capacityConversion: 48, total: 48, phase: 'TROUGH' },
        { year: 2029, confirmedPipeline: 0, capacityConversion: 55, total: 55, phase: 'TROUGH' },
        { year: 2030, confirmedPipeline: 0, capacityConversion: 62, total: 62, phase: 'BUILDING' },
        { year: 2031, confirmedPipeline: 0, capacityConversion: 68, total: 68, phase: 'BUILDING' },
        { year: 2032, confirmedPipeline: 0, capacityConversion: 72, total: 72, phase: 'BUILDING' },
        { year: 2033, confirmedPipeline: 0, capacityConversion: 78, total: 78, phase: 'BUILDING' },
        { year: 2034, confirmedPipeline: 0, capacityConversion: 85, total: 85, phase: 'BUILDING' },
        { year: 2035, confirmedPipeline: 0, capacityConversion: 92, total: 92, phase: 'BUILDING' },
      ],
      metadata: createMetadata('DC-08', 'Pipeline + DC-06 weighted capacity'),
    },
    developerLandBank: {
      parcels: [
        { parcelId: '12-34-56-789-000-0025', owner: 'Mill Creek Residential', estimatedUnits: 180, developmentProbability: 42, estimatedStart: '2027-Q2' },
        { parcelId: '12-34-56-789-000-0038', owner: 'Wood Partners', estimatedUnits: 220, developmentProbability: 38, estimatedStart: '2028-Q1' },
      ],
      totalPotentialUnits: 400,
      metadata: createMetadata('DC-09', 'Parcel ownership + DC-06 + behavior'),
    },
    assemblageOpportunity: {
      clusterScore: 58,
      parcels: [
        { parcelId: '12-34-56-789-000-0042', owner: 'Estate of John Smith', acres: 2.4 },
        { parcelId: '12-34-56-789-000-0043', owner: 'Local Church', acres: 1.8 },
      ],
      combinedCapacity: 95,
      metadata: createMetadata('DC-10', 'Spatial adjacency + capacity'),
    },
    supplyAdjustedRentForecast: {
      baseForecasts: [
        { year: 2026, rentGrowth: 4.2 },
        { year: 2027, rentGrowth: 3.8 },
        { year: 2028, rentGrowth: 3.5 },
      ],
      adjustedForecasts: [
        { year: 2026, rentGrowth: 3.8, adjustment: -0.4 },
        { year: 2027, rentGrowth: 4.2, adjustment: 0.4 },
        { year: 2028, rentGrowth: 4.0, adjustment: 0.5 },
      ],
      metadata: createMetadata('DC-11', 'C-02 base ± DC-03 factor'),
    },
  },

  // TRADE AREA SIGNAL ★ NEW
  tradeArea: {
    tradeAreaDefinition: {
      type: 'RADIUS',
      radiusMiles: 3.0,
      boundary: [
        { lat: 33.8988, lng: -84.3844 },
        { lat: 33.8988, lng: -84.3244 },
        { lat: 33.8388, lng: -84.3244 },
        { lat: 33.8388, lng: -84.3844 },
        { lat: 33.8988, lng: -84.3844 },
      ],
      metadata: createMetadata('TA-01', 'User-defined or auto-generated'),
    },
    competitiveSet: {
      properties: [
        { propertyId: 'prop-peachtree-commons', name: 'Peachtree Commons', address: '220 Peachtree Rd', units: 220, yearBuilt: 1987, class: 'B', distanceMiles: 1.8, relevanceScore: 95 },
        { propertyId: 'prop-ashford-creek', name: 'Ashford Creek Apartments', address: '450 Ashford Dunwoody', units: 240, yearBuilt: 1985, class: 'B-', distanceMiles: 1.2, relevanceScore: 92 },
        { propertyId: 'prop-riverside-gardens', name: 'Riverside Gardens', address: '680 Riverside Dr', units: 180, yearBuilt: 1989, class: 'B', distanceMiles: 2.1, relevanceScore: 88 },
        { propertyId: 'prop-oakmont-village', name: 'Oakmont Village', address: '310 Oakmont Ave', units: 200, yearBuilt: 1986, class: 'B-', distanceMiles: 2.8, relevanceScore: 85 },
        { propertyId: 'prop-summit-pointe', name: 'Summit Pointe', address: '125 Summit Blvd', units: 190, yearBuilt: 1988, class: 'B-', distanceMiles: 2.3, relevanceScore: 82 },
        { propertyId: 'prop-northridge', name: 'Northridge Apartments', address: '840 Northridge Pkwy', units: 175, yearBuilt: 1990, class: 'B', distanceMiles: 2.9, relevanceScore: 78 },
        { propertyId: 'prop-brookhaven-place', name: 'Brookhaven Place', address: '520 Brookhaven Dr', units: 260, yearBuilt: 1984, class: 'B-', distanceMiles: 1.5, relevanceScore: 90 },
        { propertyId: 'prop-lenox-terrace', name: 'Lenox Terrace', address: '750 Lenox Rd', units: 210, yearBuilt: 1989, class: 'B', distanceMiles: 2.0, relevanceScore: 87 },
      ],
      metadata: createMetadata('TA-02', 'S-01 in TA + P-02 vintage match'),
    },
    tradeAreaBalance: {
      totalUnits: 1675,
      renterHouseholds: 1420,
      jobsToApartments: 4.2,
      saturation: 1.18,
      assessment: 'BALANCED',
      metadata: createMetadata('TA-03', 'D-01 + S-01 within polygon'),
    },
    digitalCompetitiveIntel: {
      properties: [
        { propertyId: 'prop-peachtree-commons', websiteTraffic: 4200, seoScore: 72, adSpend: 2400, competitivePosition: 'LEADER' },
        { propertyId: 'prop-ashford-creek', websiteTraffic: 3100, seoScore: 65, adSpend: 1800, competitivePosition: 'CHALLENGER' },
        { propertyId: 'prop-summit-ridge-100', websiteTraffic: 1840, seoScore: 48, adSpend: 800, competitivePosition: 'FOLLOWER' },
      ],
      metadata: createMetadata('TA-04', 'SpyFu / SimilarWeb', 'MEDIUM'),
    },
  },
};
