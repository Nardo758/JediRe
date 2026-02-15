/**
 * JEDI API Service
 * Client for querying JEDI RE backend endpoints connected to Apartment Locator AI
 */

import api from './api';

// =============================================
// MARKET INTELLIGENCE ENDPOINTS
// =============================================

export interface MarketData {
  city: string;
  state: string;
  totalProperties: number;
  avgRent: number;
  avgOccupancy: number;
  pricingByUnitType: {
    studio?: number;
    '1br'?: number;
    '2br'?: number;
    '3br'?: number;
  };
  concessionRate: number;
  avgConcessionValue?: number;
}

export interface TrendData {
  month: string;
  avgRent: number;
  change: number;
}

export interface Submarket {
  name: string;
  avgRent: number;
  vacancy: number;
  inventory: number;
}

export interface RentComp {
  propertyName: string;
  address: string;
  rent: number;
  sqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  rentPerSqft?: number;
  distance?: number;
}

export interface SupplyPipeline {
  yearBuilt: number;
  units: number;
  properties: number;
}

export interface AbsorptionRate {
  avgDaysToLease: number;
  propertiesTracked: number;
  monthlyAbsorptionRate: number;
}

// =============================================
// USER ANALYTICS ENDPOINTS
// =============================================

export interface UserStats {
  totalUsers: number;
  byType: {
    renter: number;
    landlord: number;
    admin: number;
  };
  subscriptionTiers: {
    free: number;
    premium: number;
  };
  weeklySignupTrends: Array<{ week: string; count: number }>;
  activeUsers30d: number;
}

export interface UserActivity {
  totalSearches: number;
  uniqueUsers: number;
  dailyVolume: Array<{ date: string; searches: number }>;
  topSearchedLocations: Array<{ location: string; count: number }>;
}

export interface DemandSignals {
  budgetDistribution: {
    '<$1000': number;
    '$1000-$1500': number;
    '$1500-$2000': number;
    '$2000-$2500': number;
    '>$2500': number;
  };
  bedroomPreferences: {
    studio: number;
    '1br': number;
    '2br': number;
    '3br+': number;
  };
  commuteModes: {
    driving: number;
    transit: number;
    walking: number;
    biking: number;
  };
  topAmenities: Array<{ amenity: string; count: number }>;
  moveInTimelines: {
    immediate: number;
    '1-2months': number;
    '3-6months': number;
    '6+months': number;
  };
}

export interface SearchTrends {
  recentSearches: Array<{
    location: string;
    priceRange: string;
    bedrooms: number;
    timestamp: string;
  }>;
  dailyVolume: Array<{ date: string; searches: number }>;
  priceRangeDistribution: { [range: string]: number };
  unmetDemand: Array<{ location: string; zeroResultCount: number }>;
}

export interface UserPreferences {
  preferredCities: Array<{ city: string; count: number }>;
  priceCeilings: { avg: number; median: number };
  bedroomNeeds: { [bedrooms: string]: number };
  alertSubscriptions: number;
  poiInterests: Array<{ category: string; count: number }>;
}

// =============================================
// API CLIENT
// =============================================

class JediApi {
  // Market Intelligence
  
  async getMarketData(city: string, state: string): Promise<MarketData> {
    const response = await api.get('/api/jedi/market-data', {
      params: { city, state }
    });
    return response.data;
  }

  async getTrends(city: string): Promise<TrendData[]> {
    const response = await api.get('/api/jedi/trends', {
      params: { city }
    });
    return response.data.trends || [];
  }

  async getSubmarkets(city: string): Promise<Submarket[]> {
    const response = await api.get('/api/jedi/submarkets', {
      params: { city }
    });
    return response.data.submarkets || [];
  }

  async getRentComps(city: string, state: string): Promise<RentComp[]> {
    const response = await api.get('/api/jedi/rent-comps', {
      params: { city, state }
    });
    return response.data.comparables || [];
  }

  async getSupplyPipeline(city: string, state: string): Promise<SupplyPipeline[]> {
    const response = await api.get('/api/jedi/supply-pipeline', {
      params: { city, state }
    });
    return response.data.pipeline || [];
  }

  async getAbsorptionRate(city: string, state: string): Promise<AbsorptionRate> {
    const response = await api.get('/api/jedi/absorption-rate', {
      params: { city, state }
    });
    return response.data;
  }

  // User Analytics
  
  async getUserStats(): Promise<UserStats> {
    const response = await api.get('/api/jedi/user-stats');
    return response.data;
  }

  async getUserActivity(days: number = 30): Promise<UserActivity> {
    const response = await api.get('/api/jedi/user-activity', {
      params: { days }
    });
    return response.data;
  }

  async getDemandSignals(): Promise<DemandSignals> {
    const response = await api.get('/api/jedi/demand-signals');
    return response.data;
  }

  async getSearchTrends(days: number = 30): Promise<SearchTrends> {
    const response = await api.get('/api/jedi/search-trends', {
      params: { days }
    });
    return response.data;
  }

  async getUserPreferences(): Promise<UserPreferences> {
    const response = await api.get('/api/jedi/user-preferences-aggregate');
    return response.data;
  }
}

export const jediApi = new JediApi();
