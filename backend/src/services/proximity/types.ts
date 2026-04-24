/**
 * Proximity Service Types
 */

export interface PointOfInterest {
  id: string;
  poiType: POIType;
  poiName: string;
  poiSubtype?: string;
  
  address?: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  
  // Attributes
  sizeMetric?: number;
  sizeMetricType?: string;
  qualityRating?: number;
  
  // Transit specific
  transitLines?: string[];
  transitAgency?: string;
  dailyRidership?: number;
  
  // School specific
  schoolRating?: number;
  schoolDistrict?: string;
  
  // Employer specific
  employerIndustry?: string;
  employeeCount?: number;
  
  status: 'active' | 'planned' | 'under_construction' | 'closed';
  openedDate?: Date;
  closedDate?: Date;
  
  source: string;
  sourceId?: string;
}

export type POIType = 
  | 'transit_station' | 'bus_stop' | 'transit_hub'
  | 'grocery_premium' | 'grocery_standard' | 'grocery_discount'
  | 'employer_major' | 'employer_tech' | 'employer_healthcare' | 'employer_finance'
  | 'hospital' | 'urgent_care' | 'medical_campus'
  | 'school_elementary' | 'school_middle' | 'school_high' | 'university'
  | 'park' | 'trail' | 'beltline' | 'greenspace'
  | 'mall' | 'retail_center' | 'restaurant_cluster'
  | 'airport' | 'highway_access';

export interface ProximityScores {
  propertyId?: string;
  parcelId?: string;
  address: string;
  latitude: number;
  longitude: number;
  
  // Transit
  transit: {
    nearestStationName?: string;
    nearestStationType?: string;
    nearestStationMiles?: number;
    nearestBusStopMiles?: number;
    routesWithinQuarterMile?: number;
    transitScore?: number;
  };
  
  // Grocery
  grocery: {
    nearestName?: string;
    nearestType?: 'premium' | 'standard' | 'discount';
    nearestMiles?: number;
    countWithin1Mile?: number;
    premiumCountWithin2Miles?: number;
  };
  
  // Employers
  employers: {
    majorWithin3Miles?: number;
    majorWithin5Miles?: number;
    nearestMajorName?: string;
    nearestMajorMiles?: number;
    totalJobsWithin5Miles?: number;
  };
  
  // Retail
  retail: {
    restaurantsWithinHalfMile?: number;
    retailSqftWithin1Mile?: number;
    nearestMallMiles?: number;
  };
  
  // Healthcare
  healthcare: {
    nearestHospitalName?: string;
    nearestHospitalMiles?: number;
    urgentCaresWithin3Miles?: number;
  };
  
  // Schools
  schools: {
    elementaryName?: string;
    elementaryRating?: number;
    middleName?: string;
    middleRating?: number;
    highName?: string;
    highRating?: number;
    districtName?: string;
    districtRating?: number;
    universitiesWithin5Miles?: number;
  };
  
  // Parks
  parks: {
    nearestParkMiles?: number;
    parksWithin1Mile?: number;
    greenspaceAcresWithin1Mile?: number;
    beltlineMiles?: number;
  };
  
  // Safety
  safety: {
    crimeIndex?: number;
    violentCrimeIndex?: number;
    propertyCrimeIndex?: number;
    crimeTrend?: 'improving' | 'stable' | 'worsening';
  };
  
  // Aggregate scores
  scores: {
    walkScore?: number;
    transitScore?: number;
    bikeScore?: number;
  };
  
  // Estimated premiums
  estimatedPremiums: {
    transitPremiumPct?: number;
    amenityPremiumPct?: number;
    schoolPremiumPct?: number;
    totalPremiumPct?: number;
  };
  
  computedAt: Date;
  dataSources: string[];
}

export interface NearbyPOI extends PointOfInterest {
  distanceMiles: number;
}

export interface MarketEvent {
  id: string;
  eventType: EventType;
  eventName: string;
  eventDescription?: string;
  
  geographyType: 'msa' | 'county' | 'submarket' | 'zip' | 'point';
  geographyId: string;
  geographyName?: string;
  latitude?: number;
  longitude?: number;
  impactRadiusMiles?: number;
  
  entityName?: string;
  entityType?: string;
  
  jobsAffected?: number;
  unitsAffected?: number;
  sqftAffected?: number;
  investmentAmount?: number;
  
  announcedDate?: Date;
  groundbreakingDate?: Date;
  effectiveDate: Date;
  completionDate?: Date;
  
  expectedImpactDirection: 'positive' | 'negative' | 'neutral' | 'mixed';
  expectedImpactMagnitude: 'minor' | 'moderate' | 'major' | 'transformative';
  expectedImpactDuration?: 'temporary' | 'medium_term' | 'permanent';
  
  affectedMetrics: string[];
  
  sourceUrl?: string;
  sourceType?: string;
  sourceDate?: Date;
  
  status: 'rumored' | 'announced' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  confidenceScore?: number;
  tags?: string[];
}

export type EventType = 
  | 'employer_move' | 'employer_expansion' | 'employer_layoff' | 'employer_closure'
  | 'transit_opening' | 'transit_expansion' | 'transit_planned'
  | 'supply_delivery' | 'supply_announced' | 'supply_groundbreaking'
  | 'grocery_opening' | 'retail_opening' | 'retail_closure'
  | 'infrastructure' | 'rezoning' | 'policy_change'
  | 'economic_shock' | 'natural_disaster'
  | 'acquisition' | 'disposition';

export interface EventOutcome {
  id: string;
  eventId: string;
  
  measurementPeriod: '3mo' | '6mo' | '12mo' | '24mo';
  measurementStartDate: Date;
  measurementEndDate: Date;
  
  geographyType: string;
  geographyId: string;
  distanceFromEventMiles?: number;
  
  rentChangePct?: number;
  occupancyChangePct?: number;
  absorptionUnits?: number;
  capRateChangeBps?: number;
  pricePerUnitChangePct?: number;
  concessionChangePct?: number;
  
  searchVolumeChangePct?: number;
  tourVolumeChangePct?: number;
  applicationVolumeChangePct?: number;
  
  attributionConfidence?: number;
  confoundingFactors?: string[];
  methodologyNotes?: string;
}

export interface MarketSnapshot {
  id: string;
  geographyType: string;
  geographyId: string;
  geographyName?: string;
  
  snapshotDate: Date;
  snapshotType: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  
  // Inventory
  totalProperties?: number;
  totalUnits?: number;
  
  // Rent
  avgAskingRent?: number;
  avgEffectiveRent?: number;
  avgRentPsf?: number;
  rentGrowthMom?: number;
  rentGrowthYoy?: number;
  
  // Occupancy
  avgOccupancyPct?: number;
  availableUnits?: number;
  vacancyRate?: number;
  
  // Absorption
  netAbsorptionUnits?: number;
  avgDaysToLease?: number;
  
  // Concessions
  propertiesOfferingConcessionsPct?: number;
  avgConcessionWeeks?: number;
  avgConcessionValue?: number;
  
  // Supply
  unitsUnderConstruction?: number;
  plannedUnits24mo?: number;
  unitsPermittedTrailing12mo?: number;
  unitsDeliveredTrailing12mo?: number;
  
  // Sales
  transactionCountTrailing12mo?: number;
  avgPricePerUnit?: number;
  avgPricePsf?: number;
  avgCapRate?: number;
  
  // Economic
  unemploymentRate?: number;
  jobGrowthYoy?: number;
  populationGrowthYoy?: number;
  medianHouseholdIncome?: number;
}

export interface BacktestRun {
  id: string;
  backtestName?: string;
  backtestType: 'rent_growth' | 'occupancy' | 'irr' | 'event_impact';
  
  trainingStart: Date;
  trainingEnd: Date;
  validationStart: Date;
  validationEnd: Date;
  
  geographyType?: string;
  geographyIds?: string[];
  propertyFilter?: Record<string, any>;
  
  modelType?: string;
  featuresUsed?: string[];
  hyperparameters?: Record<string, any>;
  
  sampleSize?: number;
  mae?: number;
  rmse?: number;
  mape?: number;
  rSquared?: number;
  
  directionAccuracyPct?: number;
  within1pctAccuracy?: number;
  within5pctAccuracy?: number;
  
  featureImportance?: Record<string, number>;
  
  status: 'running' | 'completed' | 'failed';
  errorMessage?: string;
  
  startedAt: Date;
  completedAt?: Date;
}
