import { TrendingUp, TrendingDown, Calendar, Home } from 'lucide-react';
import { SupplyInsight } from '@/types';
import { formatNumber, formatCurrency } from '@/utils';

interface SupplyPanelProps {
  supply: SupplyInsight;
}

export default function SupplyPanel({ supply }: SupplyPanelProps) {
  const getTrendIcon = () => {
    switch (supply.inventoryTrend) {
      case 'increasing':
        return <TrendingUp className="w-5 h-5 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="w-5 h-5 text-green-500" />;
      default:
        return <div className="w-5 h-5 bg-gray-300 rounded-full" />;
    }
  };

  const getTrendColor = () => {
    switch (supply.inventoryTrend) {
      case 'increasing':
        return 'text-red-600';
      case 'decreasing':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Home className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-bold text-gray-900">Supply Analysis</h3>
      </div>

      {/* Active Listings */}
      <div className="card bg-indigo-50 border-indigo-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600 mb-1">Active Listings</div>
            <div className="text-3xl font-bold text-indigo-600">
              {formatNumber(supply.activeListings)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getTrendIcon()}
            <span className={`text-sm font-medium ${getTrendColor()}`}>
              {supply.inventoryTrend}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
            <Calendar className="w-3 h-3" />
            <span>Days on Market</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {supply.daysOnMarket}
          </div>
        </div>

        <div className="card">
          <div className="text-xs text-gray-600 mb-1">Absorption Rate</div>
          <div className="text-2xl font-bold text-gray-900">
            {supply.absorptionRate.toFixed(1)}%
          </div>
        </div>

        <div className="card">
          <div className="text-xs text-gray-600 mb-1">Comparable Props</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatNumber(supply.comparableProperties)}
          </div>
        </div>

        <div className="card">
          <div className="text-xs text-gray-600 mb-1">Median Price</div>
          <div className="text-xl font-bold text-gray-900">
            {formatCurrency(supply.medianPrice)}
          </div>
        </div>
      </div>

      {/* AI Reasoning */}
      {supply.reasoning && (
        <div className="card bg-gray-50">
          <h4 className="font-semibold text-gray-900 mb-2 text-sm">Market Insights</h4>
          <p className="text-sm text-gray-700 leading-relaxed">
            {supply.reasoning}
          </p>
        </div>
      )}
    </div>
  );
}
