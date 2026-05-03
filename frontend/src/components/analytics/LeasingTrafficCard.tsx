/**
 * Leasing Traffic Card Component
 * Displays weekly leasing predictions for multifamily properties
 * Matches Excel format with weekly forecast summary
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface LeasingPrediction {
  property_id: string;
  week_ending: string;
  weekly_inquiries: number;
  weekly_tours: number;
  tours_conversion_rate: number;
  net_leases: number;
  closing_ratio: number;
  property_units: number;
  current_occupancy: number;
  baseline_type: string;
  confidence: number;
  confidence_tier: string;
}

interface ForecastSummary {
  total_leases: string;
  avg_per_week: number;
  annual_projection: number;
  turnover_rate: number;
}

interface LeasingTrafficCardProps {
  propertyId: string;
  showForecast?: boolean;
}

export const LeasingTrafficCard: React.FC<LeasingTrafficCardProps> = ({
  propertyId,
  showForecast = true
}) => {
  const navigate = useNavigate();
  const [prediction, setPrediction] = useState<LeasingPrediction | null>(null);
  const [forecastSummary, setForecastSummary] = useState<ForecastSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadLeasingData();
  }, [propertyId]);
  
  const loadLeasingData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load current week prediction
      const predResponse = await fetch(`/api/v1/leasing-traffic/predict/${propertyId}`);
      
      if (!predResponse.ok) {
        throw new Error('Failed to load leasing prediction');
      }
      
      const predData = await predResponse.json();
      setPrediction(predData.prediction);
      
      // Load 12-week forecast summary (if requested)
      if (showForecast) {
        const forecastResponse = await fetch(`/api/v1/leasing-traffic/forecast/${propertyId}?weeks=12`);
        
        if (forecastResponse.ok) {
          const forecastData = await forecastResponse.json();
          setForecastSummary(forecastData.forecast.summary);
        }
      }
      
    } catch (err: any) {
      console.error('Error loading leasing data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !prediction) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <span className="text-red-600 text-xl">⚠️</span>
          <div>
            <h3 className="font-semibold text-red-900 mb-1">
              Leasing Data Unavailable
            </h3>
            <p className="text-sm text-red-700">
              {error || 'Could not load leasing traffic prediction'}
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>📊</span>
          Leasing Traffic Prediction
        </h2>
      </div>
      
      {/* Content */}
      <div className="p-6">
        
        {/* This Week Section */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            This Week
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-600 mb-1">Traffic</div>
              <div className="text-2xl font-bold text-gray-900">
                {prediction.weekly_inquiries} <span className="text-sm font-normal text-gray-600">visitors</span>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-600 mb-1">Tours</div>
              <div className="text-2xl font-bold text-gray-900">
                {prediction.weekly_tours} <span className="text-sm font-normal text-gray-600">tours ({prediction.tours_conversion_rate}%)</span>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-600 mb-1">Net Leases</div>
              <div className="text-2xl font-bold text-green-600">
                {prediction.net_leases}-{prediction.net_leases + 1} <span className="text-sm font-normal text-gray-600">leases</span>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-600 mb-1">Closing Ratio</div>
              <div className="text-2xl font-bold text-gray-900">
                {prediction.closing_ratio}%
              </div>
            </div>
          </div>
        </div>
        
        {/* 12-Week Forecast (if available) */}
        {showForecast && forecastSummary && (
          <>
            <div className="border-t border-gray-200 pt-6 mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                12-Week Forecast
              </h3>
              
              {/* Mini chart placeholder */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-4 text-center">
                <div className="text-xs text-gray-600 mb-2">Weekly Leasing Trend</div>
                <div className="flex items-end justify-center gap-1 h-20">
                  {[2, 3, 2, 3, 2, 2, 3, 2, 3, 2, 3, 2].map((height, i) => (
                    <div
                      key={i}
                      className="bg-purple-500 w-6 rounded-t"
                      style={{ height: `${height * 25}%` }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-xs text-blue-700 mb-1">Total Leases</div>
                  <div className="text-xl font-bold text-blue-900">{forecastSummary.total_leases}</div>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-xs text-blue-700 mb-1">Avg/Week</div>
                  <div className="text-xl font-bold text-blue-900">{forecastSummary.avg_per_week} leases</div>
                </div>
              </div>
            </div>
            
            {/* Annual Projection */}
            <div className="border-t border-gray-200 pt-6 mb-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Annual Projection
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-green-700 mb-1">Expected Leases</div>
                  <div className="text-xl font-bold text-green-900">{forecastSummary.annual_projection}/year</div>
                </div>
                
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-green-700 mb-1">Turnover Rate</div>
                  <div className="text-xl font-bold text-green-900">{forecastSummary.turnover_rate}%</div>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Footer - View Detailed Forecast */}
        <button
          onClick={() => navigate(`/leasing-forecast/${propertyId}`)}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg py-3 px-4 font-semibold hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
        >
          <span>📊</span>
          View Detailed Forecast
          <span>→</span>
        </button>
        
        {/* Baseline Info */}
        <div className="mt-4 text-xs text-gray-500 text-center">
          {prediction.baseline_type} • {prediction.confidence_tier} Confidence ({Math.round(prediction.confidence * 100)}%)
        </div>
      </div>
    </div>
  );
};

export default LeasingTrafficCard;
