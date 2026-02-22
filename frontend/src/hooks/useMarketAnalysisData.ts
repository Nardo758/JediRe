import { useState, useEffect } from 'react';
import type { DemandData, DemographicData, Amenity, AIInsight } from '@/types/development';

export function useMarketAnalysisData(dealId: string, radius: number) {
  const [demandData, setDemandData] = useState<DemandData | null>(null);
  const [amenityData, setAmenityData] = useState<Amenity[] | null>(null);
  const [demographicData, setDemographicData] = useState<DemographicData | null>(null);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      setDemandData({
        heatmapData: [
          { lat: 33.749, lng: -84.388, intensity: 0.9, label: 'Midtown' },
          { lat: 33.759, lng: -84.385, intensity: 0.7, label: 'Buckhead' },
          { lat: 33.753, lng: -84.392, intensity: 0.8, label: 'West Midtown' },
        ],
        location: [33.749, -84.388],
        points: [
          { lat: 33.749, lng: -84.388, intensity: 0.9, type: 'employment', label: 'Tech Hub' },
          { lat: 33.759, lng: -84.385, intensity: 0.7, type: 'transit', label: 'MARTA Station' },
          { lat: 33.753, lng: -84.392, intensity: 0.8, type: 'retail', label: 'Retail Center' },
        ],
        drivers: [
          { id: 'd1', name: 'Georgia Tech', type: 'education', impact: 0.85, trend: 'up', description: 'Tech sector expansion', distance: 0.8, location: [33.776, -84.399], details: '44,000 students' },
          { id: 'd2', name: 'Midtown MARTA', type: 'transit', impact: 0.72, trend: 'stable', description: 'MARTA BeltLine proximity', distance: 0.3, location: [33.752, -84.386], details: 'Heavy rail station' },
          { id: 'd3', name: 'Atlantic Station', type: 'entertainment', impact: 0.68, trend: 'up', description: 'Walk Score 82', distance: 1.2, location: [33.791, -84.395], details: 'Mixed-use retail' },
        ],
        recommendedMix: {
          studio: 15,
          oneBR: 40,
          twoBR: 35,
          threeBR: 10,
        },
        demandScore: 82,
      });
      setAmenityData([
        { id: 'pool', name: 'Resort Pool', category: 'entertainment', monthlyPremium: 75, roi: 3.2, marketPenetration: 0.65, adoptionRate: 0.82, sqftRequired: 3500, trending: 'stable' },
        { id: 'gym', name: 'Fitness Center', category: 'fitness', monthlyPremium: 50, roi: 4.1, marketPenetration: 0.90, adoptionRate: 0.95, sqftRequired: 2000, trending: 'up' },
        { id: 'cowork', name: 'Co-working Space', category: 'work', monthlyPremium: 100, roi: 3.8, marketPenetration: 0.45, adoptionRate: 0.70, sqftRequired: 1500, trending: 'up' },
        { id: 'dogpark', name: 'Dog Park', category: 'pet', monthlyPremium: 35, roi: 2.5, marketPenetration: 0.55, adoptionRate: 0.60, sqftRequired: 5000, trending: 'up' },
        { id: 'rooftop', name: 'Rooftop Lounge', category: 'entertainment', monthlyPremium: 85, roi: 2.8, marketPenetration: 0.40, adoptionRate: 0.75, sqftRequired: 4000, trending: 'up' },
        { id: 'parking', name: 'EV Charging', category: 'parking', monthlyPremium: 40, roi: 2.1, marketPenetration: 0.30, adoptionRate: 0.45, sqftRequired: 200, trending: 'up' },
        { id: 'concierge', name: 'Package Concierge', category: 'service', monthlyPremium: 25, roi: 5.2, marketPenetration: 0.72, adoptionRate: 0.88, sqftRequired: 300, trending: 'stable' },
      ]);
      setDemographicData({
        primaryProfile: {
          ageRange: '25-34',
          incomeRange: '$65K-$95K',
          remoteWorkPercentage: 48,
          petOwnershipPercentage: 62,
          vehicleOwnership: 1.3,
        },
        medianIncome: 75000,
        medianAge: 32,
        populationGrowth: 2.4,
        employmentRate: 96.1,
        topEmployers: ['Google', 'NCR', 'Home Depot', 'Delta', 'Coca-Cola'],
        ageDistribution: {
          '18-24': 18,
          '25-34': 35,
          '35-44': 22,
          '45-54': 15,
          '55+': 10,
        },
        growthTrends: {
          populationGrowth: 8.2,
          incomeGrowth: 5.4,
          employmentGrowth: 3.1,
          rentGrowth: 6.8,
        },
        lifestyleIndicators: {
          walkability: 82,
          bikeability: 65,
          transitAccess: 72,
          nightlife: 78,
          diningOptions: 85,
        },
      });
      setAiInsights([
        {
          id: '1',
          type: 'recommendation',
          title: 'Increase Studio Count',
          description: 'Market demand shows high absorption for studios under 500 SF at $1,400+/mo.',
          confidence: 0.87,
          impact: 'high',
        },
        {
          id: '2',
          type: 'opportunity',
          title: 'Pet-Friendly Premium',
          description: 'Competitors without pet amenities lose 12% of prospects. Add dog park for $45K.',
          confidence: 0.91,
          impact: 'medium',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (dealId) {
      fetchData();
    }
  }, [dealId, radius]);

  return {
    demandData,
    amenityData,
    demographicData,
    aiInsights,
    isLoading,
    refetch: fetchData,
  };
}
