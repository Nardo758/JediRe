import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Settings, RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { DemandHeatMap } from '@/components/development/market-analysis/DemandHeatMap';
import { UnitMixOptimizer } from '@/components/development/market-analysis/UnitMixOptimizer';
import { DemographicInsights } from '@/components/development/market-analysis/DemographicInsights';
import { AmenityAnalysisTable } from '@/components/development/market-analysis/AmenityAnalysisTable';
import { AIInsightsPanel } from '@/components/development/market-analysis/AIInsightsPanel';
import { useMarketAnalysisData } from '@/hooks/useMarketAnalysisData';
import type { MarketInsights, UnitMix } from '@/types/development';

export const MarketAnalysisPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  
  const [selectedRadius, setSelectedRadius] = useState<number>(1); // miles
  const [currentUnitMix, setCurrentUnitMix] = useState<UnitMix>({
    studio: 0.05,
    oneBR: 0.35,
    twoBR: 0.40,
    threeBR: 0.20,
  });
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  
  // Fetch market data
  const {
    demandData,
    amenityData,
    demographicData,
    aiInsights,
    isLoading,
    refetch
  } = useMarketAnalysisData(dealId || '', selectedRadius);
  
  const handleExport = () => {
    // Export functionality
    console.log('Exporting market analysis data...');
  };
  
  const handleApplyToDesign = async () => {
    // Send recommendations to 3D Design page
    const insights: MarketInsights = {
      unitMix: currentUnitMix,
      amenities: selectedAmenities,
      targetDemographic: demographicData?.primaryProfile || 'young-professionals',
    };
    
    console.log('Applying insights to 3D design:', insights);
    // Navigate to 3D design page with pre-filled data
    navigate(`/deals/${dealId}/design?insights=${encodeURIComponent(JSON.stringify(insights))}`);
  };
  
  const handleOptimizeUnitMix = () => {
    // Optimize based on market data
    if (demandData?.recommendedMix) {
      setCurrentUnitMix(demandData.recommendedMix);
    }
  };
  
  const handleToggleAmenity = (amenityId: string) => {
    setSelectedAmenities(prev =>
      prev.includes(amenityId)
        ? prev.filter(id => id !== amenityId)
        : [...prev, amenityId]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading market analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/deals/${dealId}`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Market Analysis
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Development Intelligence • Atlanta Market
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={refetch}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Data
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Top Row: Demand Map, Unit Mix, Demographics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-1">
            <DemandHeatMap
              dealLocation={demandData?.location || [33.749, -84.388]}
              radius={selectedRadius}
              demandPoints={demandData?.points || []}
              demandDrivers={demandData?.drivers || []}
              onRadiusChange={setSelectedRadius}
            />
          </div>
          
          <div className="lg:col-span-1">
            <UnitMixOptimizer
              currentMix={currentUnitMix}
              marketMix={demandData?.recommendedMix}
              onMixChange={setCurrentUnitMix}
              onOptimize={handleOptimizeUnitMix}
            />
          </div>
          
          <div className="lg:col-span-1">
            <DemographicInsights
              demographics={demographicData}
            />
          </div>
        </div>

        {/* Amenity Analysis Table */}
        <div className="mb-6">
          <AmenityAnalysisTable
            amenities={amenityData?.amenities || []}
            selectedAmenities={selectedAmenities}
            onToggleAmenity={handleToggleAmenity}
          />
        </div>

        {/* AI Insights Panel */}
        <AIInsightsPanel
          insights={aiInsights}
          onApplyAll={handleApplyToDesign}
          onApplySelected={() => {
            // Apply only selected recommendations
            handleApplyToDesign();
          }}
        />
      </div>
    </div>
  );
};

export default MarketAnalysisPage;
