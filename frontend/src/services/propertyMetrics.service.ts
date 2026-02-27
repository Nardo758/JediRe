import { apiClient } from './api.client';

export interface PropertyMetrics {
  assessedPerUnit: number | null;
  appraisedPerUnit: number | null;
  unitsPerAcre: number | null;
  landValueRatio: number | null;
  taxRatePct: number | null;
  buildingSfPerUnit: number | null;
  totalUnits: number;
  landAcres: number | null;
  assessedValue: number | null;
  appraisedValue: number | null;
}

export interface NeighborhoodBenchmark {
  neighborhoodCode: string;
  propertyCount: number;
  totalUnits: number;
  medianPerUnit: number | null;
  avgPerUnit: number | null;
  minPerUnit: number | null;
  maxPerUnit: number | null;
  avgDensity: number | null;
  minDensity: number | null;
  maxDensity: number | null;
  medianDensity: number | null;
  avgTaxRate: number | null;
  avgLandValueRatio: number | null;
  avgBuildingSfPerUnit: number | null;
}

export interface OwnerPortfolio {
  ownerName: string;
  propertyCount: number;
  totalUnits: number;
  totalAssessedValue: number;
  neighborhoods: string[];
}

export interface RentComp {
  buildingName: string;
  address: string;
  units: number;
  yearBuilt: number | null;
  avgSf: number | null;
  rentPerSf: number | null;
  rentPerUnit: number | null;
  occupancyPct: number | null;
  concessionPct: number | null;
  milesAway: number | null;
  overlapPct: number | null;
  studioRent: number | null;
  oneBedRent: number | null;
  twoBedRent: number | null;
  threeBedRent: number | null;
  studioCount: number | null;
  oneBedCount: number | null;
  twoBedCount: number | null;
  threeBedCount: number | null;
  effectiveRentPerSf: number | null;
  neighborhood: string | null;
  adLevel: string | null;
  stories: number | null;
}

export interface MarketSummary {
  avgRentPerSf: number;
  medianRentPerSf: number;
  avgOccupancy: number;
  avgConcession: number;
  totalUnits: number;
  propertyCount: number;
  avgYearBuilt: number;
  avgUnitSize: number;
  rentRange: { min: number; max: number };
  occupancyRange: { min: number; max: number };
}

export interface DensityMetrics {
  propertyDensity: number | null;
  neighborhoodAvg: number | null;
  neighborhoodMax: number | null;
  neighborhoodMin: number | null;
  percentileRank: number | null;
  landUtilization: number | null;
  comparables: Array<{
    address: string;
    units: number;
    acres: number;
    density: number;
  }>;
}

export interface SubmarketComparison {
  neighborhoodCode: string;
  properties: number;
  totalUnits: number;
  avgValuePerUnit: number;
  avgDensity: number;
  avgLandPct: number;
  avgSfPerUnit: number;
}

const BASE = '/api/v1/property-metrics';

export const propertyMetricsService = {
  async getPropertyMetrics(parcelId: string): Promise<PropertyMetrics> {
    const { data } = await apiClient.get(`${BASE}/property/${parcelId}/metrics`);
    return data;
  },

  async getDensityMetrics(parcelId: string): Promise<DensityMetrics> {
    const { data } = await apiClient.get(`${BASE}/property/${parcelId}/density`);
    return data;
  },

  async getNeighborhoodBenchmarks(code?: string): Promise<NeighborhoodBenchmark[]> {
    const params = code ? { code } : {};
    const { data } = await apiClient.get(`${BASE}/neighborhoods/benchmarks`, { params });
    return data;
  },

  async getSubmarketComparison(): Promise<SubmarketComparison[]> {
    const { data } = await apiClient.get(`${BASE}/submarkets/comparison`);
    return data;
  },

  async getTopOwners(limit?: number): Promise<OwnerPortfolio[]> {
    const params = limit ? { limit } : {};
    const { data } = await apiClient.get(`${BASE}/owners/top`, { params });
    return data;
  },

  async searchOwner(name: string): Promise<OwnerPortfolio> {
    const { data } = await apiClient.get(`${BASE}/owners/search`, { params: { name } });
    return data;
  },

  async getRentComps(market?: string): Promise<RentComp[]> {
    const params = market ? { market } : {};
    const { data } = await apiClient.get(`${BASE}/rent-comps`, { params });
    return data;
  },

  async getMarketSummary(market?: string): Promise<MarketSummary> {
    const params = market ? { market } : {};
    const { data } = await apiClient.get(`${BASE}/rent-comps/summary`, { params });
    return data;
  },
};
