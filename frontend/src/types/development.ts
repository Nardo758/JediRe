/**
 * Development Flow Types
 * Types for the development-first deal flow modules
 */

export interface UnitMix {
  studio: number;   // Percentage (0-1)
  oneBR: number;
  twoBR: number;
  threeBR: number;
}

export interface DemandPoint {
  lat: number;
  lng: number;
  intensity: number; // 0-1
  type: 'residential' | 'commercial' | 'transit' | 'amenity';
}

export interface DemandDriver {
  id: string;
  type: 'employer' | 'education' | 'transit' | 'entertainment';
  name: string;
  location: [number, number]; // [lat, lng]
  distance: number; // miles from property
  impact: 'high' | 'medium' | 'low';
  details?: string;
  employeeCount?: number;
  enrollment?: number;
  dailyRidership?: number;
}

export interface MarketDemandData {
  location: [number, number];
  recommendedMix: UnitMix;
  currentSupply: UnitMix;
  points: DemandPoint[];
  drivers: DemandDriver[];
  absorptionRates: {
    studio: number;   // units/month
    oneBR: number;
    twoBR: number;
    threeBR: number;
  };
  rentPSF: {
    studio: number;   // $/sqft/month
    oneBR: number;
    twoBR: number;
    threeBR: number;
  };
  vacancy: number; // percentage
}

export interface Amenity {
  id: string;
  name: string;
  category: 'fitness' | 'work' | 'pet' | 'parking' | 'entertainment' | 'service';
  monthlyPremium: number; // $/month per unit
  adoptionRate: number; // 0-1, percentage of residents who use/value it
  sqftRequired: number;
  constructionCostPSF?: number;
  annualOperatingCost?: number;
  roi: number; // Calculated ROI
  marketPenetration: number; // 0-1, percentage of competing properties with this amenity
  trending: 'up' | 'stable' | 'down';
}

export interface AmenityData {
  amenities: Amenity[];
  marketAverages: {
    totalAmenities: number;
    avgMonthlyValue: number;
  };
}

export interface DemographicProfile {
  ageRange: string;
  percentage: number;
}

export interface DemographicData {
  primaryProfile: {
    ageRange: string;
    incomeRange: string;
    remoteWorkPercentage: number;
    petOwnershipPercentage: number;
    vehicleOwnership: number; // cars per household
  };
  ageDistribution: DemographicProfile[];
  growthTrends: {
    techWorkers: number; // YoY percentage growth
    students: number;
    youngProfessionals: number;
  };
  lifestyleIndicators: {
    gymMembership: number;
    publicTransitUsage: number;
    restaurantFrequency: number;
    petOwnership: number;
  };
}

export interface AIInsight {
  id: string;
  type: 'unit-mix' | 'amenity' | 'pricing' | 'timing' | 'general';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number; // 0-1
  recommendation: string;
  dataPoints?: string[];
  estimatedValue?: number; // dollar impact
  timeframe?: string;
}

export interface MarketInsights {
  unitMix: UnitMix;
  amenities: string[]; // amenity IDs
  targetDemographic: string;
  pricingStrategy?: {
    studioRent: number;
    oneBRRent: number;
    twoBRRent: number;
    threeBRRent: number;
  };
}

export interface CompetitorProperty {
  id: string;
  name: string;
  location: [number, number];
  units: number;
  yearBuilt: number;
  avgRent: number;
  occupancy: number;
  amenities: string[];
  waitlistCount?: number;
  vintage: 'new' | 'recent' | 'aging';
  quality: 'A' | 'B' | 'C';
  distance: number; // miles from subject property
}

export interface SupplyPipelineProject {
  id: string;
  name: string;
  location: [number, number];
  units: number;
  unitMix: UnitMix;
  deliveryQuarter: string; // e.g., "2024Q3"
  status: 'planned' | 'approved' | 'under-construction' | 'delayed';
  originalDelivery?: string;
  revisedDelivery?: string;
  delayReason?: string;
}

export interface SupplyWave {
  quarter: string;
  unitsDelivering: number;
  projects: SupplyPipelineProject[];
  marketImpact: 'high' | 'medium' | 'low';
}

export interface DesignRecommendation {
  category: 'unit-mix' | 'amenity' | 'parking' | 'layout';
  action: string;
  reason: string;
  impact: string;
  priority: 'high' | 'medium' | 'low';
}
