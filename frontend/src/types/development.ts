export interface UnitMix {
  studio: number;
  oneBed?: number;
  twoBed?: number;
  threeBed?: number;
  oneBR?: number;
  twoBR?: number;
  threeBR?: number;
  fourBedPlus?: number;
  [key: string]: number | undefined;
}

export interface MarketInsights {
  unitMix: UnitMix;
  amenities: string[];
  targetDemographic: string;
}

export interface DemandData {
  heatmapData: HeatmapPoint[];
  recommendedMix: UnitMix;
  demandScore: number;
  location: [number, number];
  points: DemandPoint[];
  drivers: DemandDriver[];
}

export interface DemandPoint {
  lat: number;
  lng: number;
  intensity: number;
  type: string;
  label?: string;
}

export interface DemandDriver {
  id: string;
  name: string;
  type: string;
  impact: number;
  trend: 'up' | 'down' | 'stable';
  description?: string;
  distance: number;
  location: [number, number];
  details?: string;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
  label?: string;
}

export interface DemographicProfile {
  ageRange: string;
  incomeRange: string;
  remoteWorkPercentage: number;
  petOwnershipPercentage: number;
  vehicleOwnership: number;
}

export interface DemographicData {
  primaryProfile: DemographicProfile;
  medianIncome: number;
  medianAge: number;
  populationGrowth: number;
  employmentRate: number;
  topEmployers: string[];
  ageDistribution: Record<string, number>;
  growthTrends: Record<string, number>;
  lifestyleIndicators: Record<string, number>;
}

export interface Amenity {
  id: string;
  name: string;
  category: 'fitness' | 'work' | 'pet' | 'parking' | 'entertainment' | 'service';
  monthlyPremium: number;
  roi: number;
  marketPenetration: number;
  adoptionRate: number;
  sqftRequired: number;
  trending: 'up' | 'stable' | 'down';
}

export interface AmenityData {
  id: string;
  name: string;
  category: string;
  impactScore: number;
  monthlyRevenue: number;
  installCost: number;
}

export interface AIInsight {
  id: string;
  type: 'recommendation' | 'warning' | 'opportunity';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
}
