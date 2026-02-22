import React from 'react';
import { Users, TrendingUp, Home, Briefcase } from 'lucide-react';
import type { DemographicData } from '@/types/development';

interface DemographicInsightsProps {
  demographics?: DemographicData;
}

export const DemographicInsights: React.FC<DemographicInsightsProps> = ({
  demographics,
}) => {
  if (!demographics) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No demographic data available</p>
        </div>
      </div>
    );
  }

  const { primaryProfile, ageDistribution, growthTrends, lifestyleIndicators } = demographics;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Demographic Insights
          </h3>
        </div>
        <p className="text-xs text-gray-600">
          Primary renter profile and market trends
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Primary Renter Profile */}
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-3">
            Primary Renter Profile:
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Age Range</div>
              <div className="text-sm font-bold text-gray-900">
                {primaryProfile.ageRange}
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Income</div>
              <div className="text-sm font-bold text-gray-900">
                {primaryProfile.incomeRange}
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Remote Work</div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold text-gray-900">
                  {primaryProfile.remoteWorkPercentage}%
                </div>
                <Briefcase className="w-3 h-3 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Pet Owners</div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold text-gray-900">
                  {primaryProfile.petOwnershipPercentage}%
                </div>
                <span className="text-sm">🐕</span>
              </div>
            </div>
          </div>

          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-amber-600" />
              <div className="text-xs text-amber-800">
                <span className="font-semibold">
                  {primaryProfile.vehicleOwnership.toFixed(1)} cars/household
                </span>
                {' '}• Consider parking ratios carefully
              </div>
            </div>
          </div>
        </div>

        {/* Growth Trends */}
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-2">
            Growth Trends (YoY):
          </div>
          
          <div className="space-y-2">
            {Object.entries(growthTrends).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-gray-600 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </div>
                <div className={`text-sm font-bold ${
                  value > 10 ? 'text-green-600' : 
                  value > 5 ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  +{value}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lifestyle Indicators */}
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-2">
            Lifestyle Indicators:
          </div>
          
          <div className="space-y-2">
            {Object.entries(lifestyleIndicators).map(([key, value]) => {
              const percentage = typeof value === 'number' ? value : 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="text-xs font-semibold text-gray-900">
                      {percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        percentage > 70 ? 'bg-green-500' :
                        percentage > 50 ? 'bg-blue-500' : 'bg-gray-400'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Target Demographic Summary */}
        <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
          <div className="text-xs font-semibold text-blue-900 mb-1">
            Target Demographic:
          </div>
          <div className="text-xs text-blue-800">
            Young professionals ({primaryProfile.ageRange}) with {primaryProfile.incomeRange} income.
            {primaryProfile.remoteWorkPercentage > 40 && ' High remote work adoption suggests demand for flex spaces.'}
            {primaryProfile.petOwnershipPercentage > 60 && ' Pet-friendly amenities essential.'}
          </div>
        </div>
      </div>
    </div>
  );
};
