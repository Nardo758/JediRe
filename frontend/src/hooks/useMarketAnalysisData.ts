import { useState, useEffect } from 'react';
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
}

/**
 * Hook for fetching market analysis data for a deal
 * Includes demand data, amenity analysis, demographics, and AI insights
 * 
 * TODO: Replace with React Query when @tanstack/react-query is installed
 * For now, uses basic fetch with useState/useEffect
 */
export const useMarketAnalysisData = (dealId: string, radius: number = 1) => {
  const [demandData, setDemandData] = useState<MarketDemandData | null>(null);
  const [amenityData, setAmenityData] = useState<AmenityData | null>(null);
  const [demographicData, setDemographicData] = useState<DemographicData | null>(null);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (!dealId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // For now, use mock data
      // TODO: Replace with actual API calls when endpoints are ready
      const mockData = useMockMarketAnalysisData(dealId, radius);
      
      setDemandData(mockData.demandData);
      setAmenityData(mockData.amenityData);
      setDemographicData(mockData.demographicData);
      setAiInsights(mockData.aiInsights);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dealId, radius]);

  const refetch = () => {
    fetchData();
  };

  return {
    demandData,
    amenityData,
    demographicData,
    aiInsights,
    isLoading,
    error,
    refetch,
  };
};

/**
 * Mock data generator for development/testing
 * Can be removed once backend endpoints are implemented
 */
export const useMockMarketAnalysisData = (dealId: string, radius: number = 1) => {
  const demandData: MarketDemandData = {
    location: [33.749, -84.388],
    recommendedMix: {
      studio: 0.15,
      oneBR: 0.45,
      twoBR: 0.30,
      threeBR: 0.10,
    },
    currentSupply: {
      studio: 0.12,
      oneBR: 0.42,
      twoBR: 0.35,
      threeBR: 0.11,
    },
    points: Array.from({ length: 50 }, (_, i) => ({
      lat: 33.749 + (Math.random() - 0.5) * 0.02,
      lng: -84.388 + (Math.random() - 0.5) * 0.02,
      intensity: Math.random(),
      type: ['residential', 'commercial', 'transit', 'amenity'][Math.floor(Math.random() * 4)] as any,
    })),
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
      studio: 2.85,
      oneBR: 2.65,
      twoBR: 2.45,
      threeBR: 2.25,
    },
    vacancy: 4.2,
  };

  const amenityData: AmenityData = {
    amenities: [
      {
        id: 'coworking',
        name: 'Coworking Space',
        category: 'work',
        monthlyPremium: 125,
        adoptionRate: 0.65,
        sqftRequired: 2000,
        constructionCostPSF: 150,
        roi: 3.5,
        marketPenetration: 0.35,
        trending: 'up',
      },
      {
        id: 'pet-spa',
        name: 'Pet Spa',
        category: 'pet',
        monthlyPremium: 85,
        adoptionRate: 0.45,
        sqftRequired: 500,
        constructionCostPSF: 120,
        roi: 3.2,
        marketPenetration: 0.28,
        trending: 'up',
      },
      {
        id: 'ev-charging',
        name: 'EV Charging',
        category: 'parking',
        monthlyPremium: 65,
        adoptionRate: 0.38,
        sqftRequired: 0,
        constructionCostPSF: 0,
        roi: 2.8,
        marketPenetration: 0.22,
        trending: 'up',
      },
      {
        id: 'rooftop-pool',
        name: 'Rooftop Pool',
        category: 'entertainment',
        monthlyPremium: 75,
        adoptionRate: 0.52,
        sqftRequired: 3000,
        constructionCostPSF: 200,
        roi: 2.1,
        marketPenetration: 0.45,
        trending: 'stable',
      },
      {
        id: 'fitness',
        name: 'Fitness Center',
        category: 'fitness',
        monthlyPremium: 40,
        adoptionRate: 0.68,
        sqftRequired: 1500,
        constructionCostPSF: 100,
        roi: 2.5,
        marketPenetration: 0.85,
        trending: 'stable',
      },
      {
        id: 'package-room',
        name: 'Package Room',
        category: 'service',
        monthlyPremium: 45,
        adoptionRate: 0.82,
        sqftRequired: 400,
        constructionCostPSF: 80,
        roi: 3.0,
        marketPenetration: 0.65,
        trending: 'up',
      },
    ],
    marketAverages: {
      totalAmenities: 5.2,
      avgMonthlyValue: 312,
    },
  };

  const demographicData: DemographicData = {
    primaryProfile: {
      ageRange: '25-34',
      incomeRange: '$75-125k',
      remoteWorkPercentage: 45,
      petOwnershipPercentage: 62,
      vehicleOwnership: 1.2,
    },
    ageDistribution: [
      { ageRange: '18-24', percentage: 15 },
      { ageRange: '25-34', percentage: 45 },
      { ageRange: '35-44', percentage: 25 },
      { ageRange: '45+', percentage: 15 },
    ],
    growthTrends: {
      techWorkers: 15,
      students: 8,
      youngProfessionals: 12,
    },
    lifestyleIndicators: {
      gymMembership: 68,
      publicTransitUsage: 42,
      restaurantFrequency: 75,
      petOwnership: 62,
    },
  };

  const aiInsights: AIInsight[] = [
    {
      id: '1',
      type: 'unit-mix',
      title: 'Increase 1BR Allocation',
      description: 'Market analysis shows 45% demand for 1BR units vs. your current 35%',
      impact: 'high',
      confidence: 0.87,
      recommendation: 'Increase 1BR allocation to 45% (+10 units)',
      dataPoints: [
        '1BR absorption rate: 5.2 units/month (highest)',
        'Nearby tech campus drives young professional demand',
        '68% of recent leases in area were 1BR units',
      ],
      estimatedValue: 125000,
      timeframe: 'annually',
    },
    {
      id: '2',
      type: 'amenity',
      title: 'Add Coworking Space',
      description: '45% remote work rate in target demographic creates strong demand for flex workspaces',
      impact: 'high',
      confidence: 0.82,
      recommendation: 'Allocate 2,000 SF for coworking space',
      dataPoints: [
        'Remote workers: 45% of target demographic',
        'Rent premium: +$125/month per unit',
        'Only 35% of competing properties have coworking',
        'ROI: 3.5x over 10 years',
      ],
      estimatedValue: 215000,
      timeframe: 'annually',
    },
    {
      id: '3',
      type: 'pricing',
      title: 'Premium Pricing Opportunity',
      description: 'Quality differentiation supports 8-12% premium over aging competition',
      impact: 'medium',
      confidence: 0.75,
      recommendation: 'Target $1,850/month for 1BR units',
      dataPoints: [
        'Aging competition (pre-2010) averages $1,625/mo',
        'Waitlist properties command $1,850/mo',
        'Your quality score: A vs. market average B+',
      ],
      estimatedValue: 185000,
      timeframe: 'annually',
    },
  ];

  return {
    demandData,
    amenityData,
    demographicData,
    aiInsights,
    isLoading: false,
    error: null,
    refetch: () => {},
  };
};
