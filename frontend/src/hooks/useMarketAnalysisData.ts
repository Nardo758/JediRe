import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api.client';
import type { 
  MarketDemandData, 
  AmenityData, 
  DemographicData, 
  AIInsight 
} from '@/types/development';

interface MarketAnalysisResponse {
  demandData: MarketDemandData | null;
  amenityData: AmenityData | null;
  demographicData: DemographicData | null;
  aiInsights: AIInsight[];
  isLoading: boolean;
  error: Error | null;
  dataSource: 'live' | 'sample';
  refetch: () => void;
}

export const useMarketAnalysisData = (dealId: string, radius: number = 1): MarketAnalysisResponse => {
  const [demandData, setDemandData] = useState<MarketDemandData | null>(null);
  const [amenityData, setAmenityData] = useState<AmenityData | null>(null);
  const [demographicData, setDemographicData] = useState<DemographicData | null>(null);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [dataSource, setDataSource] = useState<'live' | 'sample'>('sample');

  const fetchData = useCallback(async () => {
    if (!dealId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const [submarketRes, demandSignalsRes, userAnalyticsRes, snapshotRes] = await Promise.allSettled([
        apiClient.get('/api/v1/apartment-sync/submarkets', { params: { city: 'Atlanta' } }),
        apiClient.get('/api/v1/apartment-sync/demand-signals'),
        apiClient.get('/api/v1/apartment-sync/user-analytics'),
        apiClient.get('/api/v1/apartment-sync/market-snapshots', { params: { city: 'Atlanta' } }),
      ]);

      const submarkets = submarketRes.status === 'fulfilled' ? submarketRes.value.data?.data : null;
      const demandSignals = demandSignalsRes.status === 'fulfilled' ? demandSignalsRes.value.data?.data : null;
      const userAnalytics = userAnalyticsRes.status === 'fulfilled' ? userAnalyticsRes.value.data?.data : null;
      const snapshots = snapshotRes.status === 'fulfilled' ? snapshotRes.value.data?.data : null;

      const hasLiveData = !!(submarkets?.length || demandSignals || userAnalytics?.length || snapshots?.length);

      if (hasLiveData) {
        setDataSource('live');

        const mappedDemand = mapDemandData(demandSignals, submarkets, userAnalytics, radius);
        setDemandData(mappedDemand);

        const mappedAmenity = mapAmenityData(demandSignals, userAnalytics);
        setAmenityData(mappedAmenity);

        const mappedDemographic = mapDemographicData(userAnalytics, demandSignals);
        setDemographicData(mappedDemographic);

        const mappedInsights = mapAIInsights(demandSignals, submarkets, snapshots);
        setAiInsights(mappedInsights);
      } else {
        setDataSource('sample');
        const mockData = generateMockData(dealId, radius);
        setDemandData(mockData.demandData);
        setAmenityData(mockData.amenityData);
        setDemographicData(mockData.demographicData);
        setAiInsights(mockData.aiInsights);
      }
    } catch (err) {
      setDataSource('sample');
      const mockData = generateMockData(dealId, radius);
      setDemandData(mockData.demandData);
      setAmenityData(mockData.amenityData);
      setDemographicData(mockData.demographicData);
      setAiInsights(mockData.aiInsights);
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setIsLoading(false);
    }
  }, [dealId, radius]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    demandData,
    amenityData,
    demographicData,
    aiInsights,
    isLoading,
    error,
    dataSource,
    refetch,
  };
};

function findAnalyticsByType(analytics: any[] | null, type: string): any {
  if (!Array.isArray(analytics)) return null;
  const entry = analytics.find((a: any) => a.analytics_type === type);
  return entry?.data ? (typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data) : null;
}

function mapDemandData(
  demandSignals: any,
  submarkets: any[] | null,
  userAnalytics: any[] | null,
  radius: number
): MarketDemandData {
  const signals = demandSignals?.data ? (typeof demandSignals.data === 'string' ? JSON.parse(demandSignals.data) : demandSignals.data) : demandSignals;
  const preferences = findAnalyticsByType(userAnalytics, 'user-preferences');
  const searchTrends = findAnalyticsByType(userAnalytics, 'search-trends');

  const budget = signals?.budgetDistribution || preferences?.budgetDistribution || {};
  const bedrooms = signals?.bedroomPreferences || preferences?.bedroomPreferences || {};

  const studioPref = bedrooms?.studio || bedrooms?.['0'] || 0.15;
  const oneBRPref = bedrooms?.oneBR || bedrooms?.['1'] || 0.45;
  const twoBRPref = bedrooms?.twoBR || bedrooms?.['2'] || 0.30;
  const threeBRPref = bedrooms?.threeBR || bedrooms?.['3'] || 0.10;
  const totalPref = studioPref + oneBRPref + twoBRPref + threeBRPref || 1;

  let avgVacancy = 4.2;
  let avgRent: Record<string, number> = {};
  const points: MarketDemandData['points'] = [];

  if (Array.isArray(submarkets) && submarkets.length > 0) {
    const subData = submarkets.map((s: any) => {
      const d = typeof s.data === 'string' ? JSON.parse(s.data) : (s.data || s);
      return d;
    });

    let totalVacancy = 0;
    let vacancyCount = 0;
    subData.forEach((sd: any, idx: number) => {
      if (sd.vacancy_rate != null) {
        totalVacancy += Number(sd.vacancy_rate);
        vacancyCount++;
      }
      if (sd.avg_rent) {
        avgRent = { ...avgRent, ...sd.avg_rent };
      }
      const lat = sd.lat || sd.latitude || 33.749 + (Math.random() - 0.5) * 0.02 * radius;
      const lng = sd.lng || sd.longitude || -84.388 + (Math.random() - 0.5) * 0.02 * radius;
      const intensity = sd.vacancy_rate != null ? Math.max(0, 1 - sd.vacancy_rate / 10) : Math.random();
      points.push({
        lat,
        lng,
        intensity,
        type: ['residential', 'commercial', 'transit', 'amenity'][idx % 4] as any,
      });
    });
    if (vacancyCount > 0) avgVacancy = totalVacancy / vacancyCount;
  } else {
    for (let i = 0; i < 50; i++) {
      points.push({
        lat: 33.749 + (Math.random() - 0.5) * 0.02 * radius,
        lng: -84.388 + (Math.random() - 0.5) * 0.02 * radius,
        intensity: Math.random(),
        type: ['residential', 'commercial', 'transit', 'amenity'][Math.floor(Math.random() * 4)] as any,
      });
    }
  }

  const budgetKeys = Object.keys(budget);
  const intensityFromBudget = budgetKeys.length > 0;
  if (intensityFromBudget) {
    budgetKeys.forEach((key, idx) => {
      points.push({
        lat: 33.749 + (Math.random() - 0.5) * 0.01 * radius,
        lng: -84.388 + (Math.random() - 0.5) * 0.01 * radius,
        intensity: Number(budget[key]) || 0.5,
        type: 'residential',
      });
    });
  }

  return {
    location: [33.749, -84.388],
    recommendedMix: {
      studio: studioPref / totalPref,
      oneBR: oneBRPref / totalPref,
      twoBR: twoBRPref / totalPref,
      threeBR: threeBRPref / totalPref,
    },
    currentSupply: {
      studio: 0.12,
      oneBR: 0.42,
      twoBR: 0.35,
      threeBR: 0.11,
    },
    points,
    drivers: [
      {
        id: '1',
        type: 'employer',
        name: 'Tech Campus',
        location: [33.752, -84.390],
        distance: 0.8,
        impact: 'high',
        details: 'Major tech employer with 5,000+ employees',
        employeeCount: 5000,
      },
      {
        id: '2',
        type: 'education',
        name: 'State University',
        location: [33.747, -84.385],
        distance: 1.2,
        impact: 'medium',
        details: '25,000 students',
        enrollment: 25000,
      },
      {
        id: '3',
        type: 'transit',
        name: 'MARTA Station',
        location: [33.750, -84.389],
        distance: 0.3,
        impact: 'high',
        details: '12,000 daily riders',
        dailyRidership: 12000,
      },
    ],
    absorptionRates: {
      studio: 2.5,
      oneBR: 5.2,
      twoBR: 3.8,
      threeBR: 1.2,
    },
    rentPSF: {
      studio: avgRent?.studio || 2.85,
      oneBR: avgRent?.oneBR || avgRent?.['1br'] || 2.65,
      twoBR: avgRent?.twoBR || avgRent?.['2br'] || 2.45,
      threeBR: avgRent?.threeBR || avgRent?.['3br'] || 2.25,
    },
    vacancy: avgVacancy,
  };
}

function mapAmenityData(demandSignals: any, userAnalytics: any[] | null): AmenityData {
  const signals = demandSignals?.data ? (typeof demandSignals.data === 'string' ? JSON.parse(demandSignals.data) : demandSignals.data) : demandSignals;
  const preferences = findAnalyticsByType(userAnalytics, 'user-preferences');

  const topAmenities: any[] = signals?.topAmenities || preferences?.topAmenities || [];

  const amenityMap: Record<string, { name: string; category: any; monthlyPremium: number; sqftRequired: number; constructionCostPSF: number; trending: any }> = {
    'coworking': { name: 'Coworking Space', category: 'work', monthlyPremium: 125, sqftRequired: 2000, constructionCostPSF: 150, trending: 'up' },
    'pet-spa': { name: 'Pet Spa', category: 'pet', monthlyPremium: 85, sqftRequired: 500, constructionCostPSF: 120, trending: 'up' },
    'ev-charging': { name: 'EV Charging', category: 'parking', monthlyPremium: 65, sqftRequired: 0, constructionCostPSF: 0, trending: 'up' },
    'rooftop-pool': { name: 'Rooftop Pool', category: 'entertainment', monthlyPremium: 75, sqftRequired: 3000, constructionCostPSF: 200, trending: 'stable' },
    'fitness': { name: 'Fitness Center', category: 'fitness', monthlyPremium: 40, sqftRequired: 1500, constructionCostPSF: 100, trending: 'stable' },
    'package-room': { name: 'Package Room', category: 'service', monthlyPremium: 45, sqftRequired: 400, constructionCostPSF: 80, trending: 'up' },
    'pool': { name: 'Pool', category: 'entertainment', monthlyPremium: 60, sqftRequired: 2500, constructionCostPSF: 180, trending: 'stable' },
    'gym': { name: 'Fitness Center', category: 'fitness', monthlyPremium: 40, sqftRequired: 1500, constructionCostPSF: 100, trending: 'stable' },
    'dog-park': { name: 'Dog Park', category: 'pet', monthlyPremium: 50, sqftRequired: 1000, constructionCostPSF: 30, trending: 'up' },
    'concierge': { name: 'Concierge Service', category: 'service', monthlyPremium: 95, sqftRequired: 200, constructionCostPSF: 60, trending: 'stable' },
  };

  if (topAmenities.length > 0) {
    const amenities = topAmenities.map((item: any, idx: number) => {
      const key = typeof item === 'string' ? item.toLowerCase().replace(/\s+/g, '-') : (item.id || item.name || '').toLowerCase().replace(/\s+/g, '-');
      const name = typeof item === 'string' ? item : (item.name || key);
      const defaults = amenityMap[key] || { name, category: 'service' as const, monthlyPremium: 50, sqftRequired: 300, constructionCostPSF: 80, trending: 'stable' as const };
      const adoptionRate = typeof item === 'object' && item.score ? item.score : (0.8 - idx * 0.1);
      const marketPen = typeof item === 'object' && item.penetration ? item.penetration : (0.7 - idx * 0.08);
      const roi = defaults.monthlyPremium > 0 ? Number(((defaults.monthlyPremium * 12 * adoptionRate) / (defaults.constructionCostPSF * Math.max(defaults.sqftRequired, 1) / 100000)).toFixed(1)) : 2.5;

      return {
        id: key || `amenity-${idx}`,
        name: defaults.name || name,
        category: defaults.category,
        monthlyPremium: defaults.monthlyPremium,
        adoptionRate: Math.max(0.1, Math.min(1, adoptionRate)),
        sqftRequired: defaults.sqftRequired,
        constructionCostPSF: defaults.constructionCostPSF,
        roi: roi || 2.5,
        marketPenetration: Math.max(0.1, Math.min(1, marketPen)),
        trending: defaults.trending,
      };
    });

    return {
      amenities,
      marketAverages: {
        totalAmenities: amenities.length,
        avgMonthlyValue: amenities.reduce((sum, a) => sum + a.monthlyPremium, 0) / Math.max(amenities.length, 1),
      },
    };
  }

  return getDefaultAmenityData();
}

function mapDemographicData(userAnalytics: any[] | null, demandSignals: any): DemographicData {
  const preferences = findAnalyticsByType(userAnalytics, 'user-preferences');
  const searchTrends = findAnalyticsByType(userAnalytics, 'search-trends');
  const signals = demandSignals?.data ? (typeof demandSignals.data === 'string' ? JSON.parse(demandSignals.data) : demandSignals.data) : demandSignals;

  if (preferences || searchTrends || signals) {
    const demo = preferences?.demographics || signals?.demographics || {};
    return {
      primaryProfile: {
        ageRange: demo.primaryAgeRange || '25-34',
        incomeRange: demo.incomeRange || '$75-125k',
        remoteWorkPercentage: demo.remoteWorkPct || 45,
        petOwnershipPercentage: demo.petOwnershipPct || 62,
        vehicleOwnership: demo.vehicleOwnership || 1.2,
      },
      ageDistribution: demo.ageDistribution || [
        { ageRange: '18-24', percentage: 15 },
        { ageRange: '25-34', percentage: 45 },
        { ageRange: '35-44', percentage: 25 },
        { ageRange: '45+', percentage: 15 },
      ],
      growthTrends: {
        techWorkers: demo.techGrowth || 15,
        students: demo.studentGrowth || 8,
        youngProfessionals: demo.ypGrowth || 12,
      },
      lifestyleIndicators: {
        gymMembership: demo.gymPct || 68,
        publicTransitUsage: demo.transitPct || 42,
        restaurantFrequency: demo.restaurantPct || 75,
        petOwnership: demo.petOwnershipPct || 62,
      },
    };
  }

  return getDefaultDemographicData();
}

function mapAIInsights(demandSignals: any, submarkets: any[] | null, snapshots: any[] | null): AIInsight[] {
  const insights: AIInsight[] = [];
  const signals = demandSignals?.data ? (typeof demandSignals.data === 'string' ? JSON.parse(demandSignals.data) : demandSignals.data) : demandSignals;

  const bedrooms = signals?.bedroomPreferences || {};
  const oneBRDemand = bedrooms?.oneBR || bedrooms?.['1'] || 0;
  if (oneBRDemand > 0.35) {
    insights.push({
      id: 'live-1',
      type: 'unit-mix',
      title: 'Increase 1BR Allocation',
      description: `Market demand signals show ${Math.round(oneBRDemand * 100)}% preference for 1BR units`,
      impact: 'high',
      confidence: 0.87,
      recommendation: `Increase 1BR allocation to ${Math.round(oneBRDemand * 100)}%`,
      dataPoints: [
        `1BR demand: ${Math.round(oneBRDemand * 100)}% of searches`,
        'Nearby tech campus drives young professional demand',
        'Strong absorption for smaller units',
      ],
      estimatedValue: 125000,
      timeframe: 'annually',
    });
  }

  const topAmenities = signals?.topAmenities || [];
  if (topAmenities.length > 0) {
    const topAmenity = typeof topAmenities[0] === 'string' ? topAmenities[0] : topAmenities[0]?.name || 'Premium Amenity';
    insights.push({
      id: 'live-2',
      type: 'amenity',
      title: `Add ${topAmenity}`,
      description: `Top-searched amenity in this market with strong adoption potential`,
      impact: 'high',
      confidence: 0.82,
      recommendation: `Include ${topAmenity} in amenity package`,
      dataPoints: [
        `${topAmenity} is #1 searched amenity`,
        `${topAmenities.length} amenities identified from demand signals`,
        'Rent premium potential for differentiation',
      ],
      estimatedValue: 215000,
      timeframe: 'annually',
    });
  }

  if (Array.isArray(snapshots) && snapshots.length > 0) {
    const latest = typeof snapshots[0].data === 'string' ? JSON.parse(snapshots[0].data) : (snapshots[0].data || snapshots[0]);
    const avgRent = latest.avg_rent || latest.averageRent;
    if (avgRent) {
      insights.push({
        id: 'live-3',
        type: 'pricing',
        title: 'Premium Pricing Opportunity',
        description: `Market average rent at $${typeof avgRent === 'number' ? avgRent.toLocaleString() : avgRent}/mo — quality differentiation supports premium`,
        impact: 'medium',
        confidence: 0.75,
        recommendation: 'Target 8-12% premium over market average',
        dataPoints: [
          `Market average rent: $${typeof avgRent === 'number' ? avgRent.toLocaleString() : avgRent}/mo`,
          'New construction commands premium',
          'Aging competition creates opportunity',
        ],
        estimatedValue: 185000,
        timeframe: 'annually',
      });
    }
  }

  if (insights.length === 0) {
    return getDefaultAIInsights();
  }

  return insights;
}

function getDefaultAmenityData(): AmenityData {
  return {
    amenities: [
      { id: 'coworking', name: 'Coworking Space', category: 'work', monthlyPremium: 125, adoptionRate: 0.65, sqftRequired: 2000, constructionCostPSF: 150, roi: 3.5, marketPenetration: 0.35, trending: 'up' },
      { id: 'pet-spa', name: 'Pet Spa', category: 'pet', monthlyPremium: 85, adoptionRate: 0.45, sqftRequired: 500, constructionCostPSF: 120, roi: 3.2, marketPenetration: 0.28, trending: 'up' },
      { id: 'ev-charging', name: 'EV Charging', category: 'parking', monthlyPremium: 65, adoptionRate: 0.38, sqftRequired: 0, constructionCostPSF: 0, roi: 2.8, marketPenetration: 0.22, trending: 'up' },
      { id: 'rooftop-pool', name: 'Rooftop Pool', category: 'entertainment', monthlyPremium: 75, adoptionRate: 0.52, sqftRequired: 3000, constructionCostPSF: 200, roi: 2.1, marketPenetration: 0.45, trending: 'stable' },
      { id: 'fitness', name: 'Fitness Center', category: 'fitness', monthlyPremium: 40, adoptionRate: 0.68, sqftRequired: 1500, constructionCostPSF: 100, roi: 2.5, marketPenetration: 0.85, trending: 'stable' },
      { id: 'package-room', name: 'Package Room', category: 'service', monthlyPremium: 45, adoptionRate: 0.82, sqftRequired: 400, constructionCostPSF: 80, roi: 3.0, marketPenetration: 0.65, trending: 'up' },
    ],
    marketAverages: { totalAmenities: 5.2, avgMonthlyValue: 312 },
  };
}

function getDefaultDemographicData(): DemographicData {
  return {
    primaryProfile: { ageRange: '25-34', incomeRange: '$75-125k', remoteWorkPercentage: 45, petOwnershipPercentage: 62, vehicleOwnership: 1.2 },
    ageDistribution: [
      { ageRange: '18-24', percentage: 15 },
      { ageRange: '25-34', percentage: 45 },
      { ageRange: '35-44', percentage: 25 },
      { ageRange: '45+', percentage: 15 },
    ],
    growthTrends: { techWorkers: 15, students: 8, youngProfessionals: 12 },
    lifestyleIndicators: { gymMembership: 68, publicTransitUsage: 42, restaurantFrequency: 75, petOwnership: 62 },
  };
}

function getDefaultAIInsights(): AIInsight[] {
  return [
    {
      id: '1', type: 'unit-mix', title: 'Increase 1BR Allocation',
      description: 'Market analysis shows 45% demand for 1BR units vs. your current 35%',
      impact: 'high', confidence: 0.87, recommendation: 'Increase 1BR allocation to 45% (+10 units)',
      dataPoints: ['1BR absorption rate: 5.2 units/month (highest)', 'Nearby tech campus drives young professional demand', '68% of recent leases in area were 1BR units'],
      estimatedValue: 125000, timeframe: 'annually',
    },
    {
      id: '2', type: 'amenity', title: 'Add Coworking Space',
      description: '45% remote work rate in target demographic creates strong demand for flex workspaces',
      impact: 'high', confidence: 0.82, recommendation: 'Allocate 2,000 SF for coworking space',
      dataPoints: ['Remote workers: 45% of target demographic', 'Rent premium: +$125/month per unit', 'Only 35% of competing properties have coworking', 'ROI: 3.5x over 10 years'],
      estimatedValue: 215000, timeframe: 'annually',
    },
    {
      id: '3', type: 'pricing', title: 'Premium Pricing Opportunity',
      description: 'Quality differentiation supports 8-12% premium over aging competition',
      impact: 'medium', confidence: 0.75, recommendation: 'Target $1,850/month for 1BR units',
      dataPoints: ['Aging competition (pre-2010) averages $1,625/mo', 'Waitlist properties command $1,850/mo', 'Your quality score: A vs. market average B+'],
      estimatedValue: 185000, timeframe: 'annually',
    },
  ];
}

function generateMockData(dealId: string, radius: number) {
  return {
    demandData: mapDemandData(null, null, null, radius),
    amenityData: getDefaultAmenityData(),
    demographicData: getDefaultDemographicData(),
    aiInsights: getDefaultAIInsights(),
  };
}

export const useMockMarketAnalysisData = (dealId: string, radius: number = 1) => {
  const mock = generateMockData(dealId, radius);
  return {
    ...mock,
    isLoading: false,
    error: null,
    dataSource: 'sample' as const,
    refetch: () => {},
  };
};
