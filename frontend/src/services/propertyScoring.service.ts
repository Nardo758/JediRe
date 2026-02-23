import { apiClient } from './api.client';

export interface SellerFactor {
  name: string;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface SellerPropensityResult {
  parcelId: string;
  address: string;
  ownerName: string;
  ownerAddress: string | null;
  units: number;
  yearBuilt: string | null;
  neighborhoodCode: string | null;
  assessedValue: number | null;
  appraisedValue: number | null;
  score: number;
  factors: SellerFactor[];
}

export interface ValueAddFactor {
  name: string;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface ValueAddResult {
  parcelId: string;
  address: string;
  ownerName: string;
  units: number;
  yearBuilt: string | null;
  neighborhoodCode: string | null;
  assessedPerUnit: number | null;
  density: number | null;
  neighborhoodAvgDensity: number | null;
  score: number;
  factors: ValueAddFactor[];
  recommendation: 'renovate' | 'redevelop' | 'hold';
}

export interface HiddenGemFactor {
  name: string;
  points: number;
  maxPoints: number;
  reason: string;
}

export interface HiddenGemResult {
  buildingName: string;
  address: string;
  units: number;
  yearBuilt: number | null;
  rentPerSf: number | null;
  occupancyPct: number | null;
  concessionPct: number | null;
  adLevel: string | null;
  commonViews60d: number | null;
  overlapPct: number | null;
  neighborhood: string | null;
  score: number;
  factors: HiddenGemFactor[];
  insight: string;
}

export interface CapRateEstimate {
  neighborhoodCode: string;
  propertyCount: number;
  totalUnits: number;
  avgAssessedPerUnit: number;
  impliedCapRate: number;
  estimatedNOIPerUnit: number;
  avgRentPerSfProxy: number | null;
  tier: 'premium' | 'standard' | 'value';
}

export interface TaxBurdenResult {
  parcelId: string;
  address: string;
  ownerName: string;
  units: number;
  neighborhoodCode: string | null;
  assessedValue: number;
  appraisedValue: number;
  effectiveTaxRate: number;
  neighborhoodMedianRate: number;
  deviationPct: number;
  flag: 'overtaxed' | 'undertaxed' | 'normal';
}

const BASE = '/api/v1/property-scoring';

export const propertyScoringService = {
  async getSellerPropensity(limit = 50): Promise<SellerPropensityResult[]> {
    const { data } = await apiClient.get(`${BASE}/seller-propensity`, { params: { limit } });
    return data;
  },

  async getValueAddScores(limit = 100): Promise<ValueAddResult[]> {
    const { data } = await apiClient.get(`${BASE}/value-add`, { params: { limit } });
    return data;
  },

  async getHiddenGems(): Promise<HiddenGemResult[]> {
    const { data } = await apiClient.get(`${BASE}/hidden-gems`);
    return data;
  },

  async getCapRateEstimates(): Promise<CapRateEstimate[]> {
    const { data } = await apiClient.get(`${BASE}/cap-rates`);
    return data;
  },

  async getTaxBurden(limit = 50): Promise<TaxBurdenResult[]> {
    const { data } = await apiClient.get(`${BASE}/tax-burden`, { params: { limit } });
    return data;
  },
};
