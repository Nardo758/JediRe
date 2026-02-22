import { useState, useEffect } from 'react';
import type { DemandData, DemographicData, AmenityData, AIInsight } from '@/types/development';

export function useMarketAnalysisData(dealId: string, radius: number) {
  const [demandData, setDemandData] = useState<DemandData | null>(null);
  const [amenityData, setAmenityData] = useState<AmenityData[] | null>(null);
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
          { name: 'Employment Growth', impact: 0.85, trend: 'up', description: 'Tech sector expansion' },
          { name: 'Transit Access', impact: 0.72, trend: 'stable', description: 'MARTA BeltLine proximity' },
          { name: 'Walkability', impact: 0.68, trend: 'up', description: 'Walk Score 82' },
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
        { id: 'pool', name: 'Pool', category: 'outdoor', impactScore: 8.5, monthlyRevenue: 2500, installCost: 150000 },
        { id: 'gym', name: 'Fitness Center', category: 'health', impactScore: 9.2, monthlyRevenue: 3000, installCost: 80000 },
        { id: 'cowork', name: 'Co-working Space', category: 'work', impactScore: 8.8, monthlyRevenue: 2000, installCost: 60000 },
        { id: 'dogpark', name: 'Dog Park', category: 'outdoor', impactScore: 7.5, monthlyRevenue: 500, installCost: 45000 },
        { id: 'rooftop', name: 'Rooftop Lounge', category: 'social', impactScore: 8.0, monthlyRevenue: 1800, installCost: 120000 },
      ]);
      setDemographicData({
        primaryProfile: 'young-professionals',
        medianIncome: 75000,
        medianAge: 32,
        populationGrowth: 2.4,
        employmentRate: 96.1,
        topEmployers: ['Google', 'NCR', 'Home Depot', 'Delta', 'Coca-Cola'],
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
