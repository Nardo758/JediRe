import { useState, useEffect } from 'react';
import { TrendingUp, Users, Clock, AlertCircle, Lock, ArrowRight } from 'lucide-react';
import { Deal } from '@/types';
import api from '@/lib/api';
import { useModuleCheck } from '@/utils/modules';
import { ModuleUpsellBanner } from './ModuleUpsellBanner';
import { trackPropertyEvent } from '@/hooks/useEventTracking';

interface TrafficPrediction {
  id: string;
  weekly_walk_ins: number;
  daily_average: number;
  peak_hour_estimate: number;
  weekday_avg: number;
  weekend_avg: number;
  peak_day: string;
  peak_hour: string;
  confidence_score: number;
  confidence_tier: string;
  prediction_details: any;
}

interface TrafficAnalysisSectionProps {
  deal: Deal;
  propertyId?: string;
}

export function TrafficAnalysisSection({ deal, propertyId }: TrafficAnalysisSectionProps) {
  const { loading: moduleLoading, enabled: hasTrafficModule } = useModuleCheck('traffic-analysis');
  const [prediction, setPrediction] = useState<TrafficPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasTrafficModule && propertyId) {
      loadTrafficPrediction();
    }
  }, [hasTrafficModule, propertyId]);

  const loadTrafficPrediction = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Track analysis run event
      if (propertyId) {
        trackPropertyEvent(propertyId, 'analysis_run', {
          module: 'traffic-analysis',
          timestamp: new Date().toISOString(),
        });
      }
      
      const response = await api.get(`/api/traffic/prediction/${propertyId}`);
      
      if (response.data.success) {
        setPrediction(response.data.prediction);
      }
    } catch (err: any) {
      console.error('Failed to load traffic prediction:', err);
      setError(err.message || 'Failed to load traffic data');
    } finally {
      setLoading(false);
    }
  };

  if (moduleLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-[#1e2a3d] rounded-lg"></div>
      </div>
    );
  }

  if (!hasTrafficModule) {
    return (
      <ModuleUpsellBanner
        moduleSlug="traffic-analysis"
        moduleName="Traffic Analysis"
        description="Get property-level foot traffic predictions with confidence scoring. Weekly walk-ins forecasts, peak hour analysis, and validation against actual measurements."
        price="$29/month"
        benefits={[
          'Weekly walk-ins predictions',
          'Peak hour & day analysis',
          'Confidence scoring',
          'Component breakdown',
          'Temporal patterns',
          'Market benchmarking'
        ]}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-sm text-[#9EA8B4]">Loading traffic prediction...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1c0a0a] border border-red-800/50 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-300">Failed to load traffic data</h3>
            <p className="text-sm text-red-400 mt-1">{error}</p>
            <button
              onClick={loadTrafficPrediction}
              className="mt-3 text-sm font-medium text-red-400 hover:text-red-400"
            >
              Try again →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="font-semibold text-[#E8E6E1] mb-2">No Traffic Data Available</h3>
        <p className="text-sm text-[#9EA8B4] mb-4">
          Traffic predictions require property location data.
        </p>
        <button
          onClick={loadTrafficPrediction}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Generate Prediction
        </button>
      </div>
    );
  }

  const confidenceColor = {
    High: 'text-green-600 bg-[#022c22]',
    Medium: 'text-yellow-600 bg-[#1a1200]',
    Low: 'text-orange-600 bg-[#1a0d00]'
  }[prediction.confidence_tier] || 'text-[#9EA8B4] bg-[#0F1319]';

  return (
    <div className="space-y-6">
      {/* Main Prediction Card */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-900/50">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-[#E8E6E1]">Weekly Walk-Ins Prediction</h3>
            <p className="text-sm text-[#9EA8B4] mt-1">Estimated foot traffic for this property</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${confidenceColor}`}>
            {prediction.confidence_tier} Confidence ({(prediction.confidence_score * 100).toFixed(0)}%)
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-[#9EA8B4] mb-1">Weekly Total</div>
            <div className="text-3xl font-bold text-blue-600">
              {prediction.weekly_walk_ins.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-[#9EA8B4] mb-1">Daily Average</div>
            <div className="text-2xl font-bold text-[#E8E6E1]">
              {prediction.daily_average.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-sm text-[#9EA8B4] mb-1">Peak Hour</div>
            <div className="text-2xl font-bold text-purple-600">
              {prediction.peak_hour_estimate.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Temporal Patterns */}
      <div className="bg-[#0F1319] rounded-lg border border-[#1e2a3d] p-6">
        <h4 className="font-semibold text-[#E8E6E1] mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#9EA8B4]" />
          Temporal Patterns
        </h4>

        <div className="grid grid-cols-2 gap-6">
          {/* Weekday vs Weekend */}
          <div>
            <h5 className="text-sm font-medium text-[#9EA8B4] mb-3">Day Type</h5>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#9EA8B4]">Weekday Avg</span>
                <span className="font-semibold text-[#E8E6E1]">{prediction.weekday_avg}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#9EA8B4]">Weekend Avg</span>
                <span className="font-semibold text-[#E8E6E1]">{prediction.weekend_avg}</span>
              </div>
            </div>
          </div>

          {/* Peak Times */}
          <div>
            <h5 className="text-sm font-medium text-[#9EA8B4] mb-3">Peak Times</h5>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#9EA8B4]">Peak Day</span>
                <span className="font-semibold text-[#E8E6E1]">{prediction.peak_day}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#9EA8B4]">Peak Hours</span>
                <span className="font-semibold text-[#E8E6E1]">{prediction.peak_hour}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Component Breakdown */}
      {prediction.prediction_details && (
        <div className="bg-[#0F1319] rounded-lg border border-[#1e2a3d] p-6">
          <h4 className="font-semibold text-[#E8E6E1] mb-4">Prediction Components</h4>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-[#1e2a3d]">
              <span className="text-[#9EA8B4]">Physical Traffic Component</span>
              <span className="font-medium text-[#E8E6E1]">
                {prediction.prediction_details.physical_component || 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#1e2a3d]">
              <span className="text-[#9EA8B4]">Demand Component</span>
              <span className="font-medium text-[#E8E6E1]">
                {prediction.prediction_details.demand_component || 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-[#9EA8B4]">Supply-Demand Multiplier</span>
              <span className="font-medium text-[#E8E6E1]">
                {prediction.prediction_details.multiplier || 'N/A'}×
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Link to Full Analysis */}
      <div className="bg-[#0F1319] rounded-lg p-4 border border-[#1e2a3d]">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-[#E8E6E1]">View Market-Wide Traffic Analysis</h4>
            <p className="text-sm text-[#9EA8B4] mt-1">
              See aggregate patterns across all properties in your markets
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/market-data?tab=traffic'}
            className="px-4 py-2 bg-[#0F1319] border border-[#253347] rounded-lg hover:bg-[#0F1319] flex items-center gap-2 text-sm font-medium"
          >
            View Analysis
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
