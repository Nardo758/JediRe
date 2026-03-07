/**
 * ValueForecastBand - Chart overlay showing bull/base/bear value forecasts
 * Usage: <ValueForecastBand marketId="tampa-msa" currentValue={50000000} />
 */

import React, { useEffect, useState } from 'react';
import { m28Client } from '../../../services/m28.client';
import type { ValueForecast } from '../../../types/m28.types';

interface ValueForecastBandProps {
  marketId: string;
  currentValue: number;
  showLegend?: boolean;
  compact?: boolean;
}

export const ValueForecastBand: React.FC<ValueForecastBandProps> = ({
  marketId,
  currentValue,
  showLegend = true,
  compact = false,
}) => {
  const [forecast, setForecast] = useState<ValueForecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const data = await m28Client.getValueForecast(marketId);
        setForecast(data);
      } catch (err) {
        console.error('Error fetching value forecast:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
  }, [marketId]);

  if (loading || !forecast) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 animate-pulse">
        <div className="h-24 bg-gray-300 rounded"></div>
      </div>
    );
  }

  // Calculate projected values
  const bearValue = currentValue * (1 + forecast.bear_change_pct / 100);
  const baseValue = currentValue * (1 + forecast.baseline_change_pct / 100);
  const bullValue = currentValue * (1 + forecast.bull_change_pct / 100);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-50 via-blue-50 to-green-50 border border-gray-200 rounded-lg text-xs">
        <span className="text-red-600 font-semibold">
          {forecast.bear_change_pct > 0 ? '+' : ''}{forecast.bear_change_pct.toFixed(1)}%
        </span>
        <span className="text-gray-400">|</span>
        <span className="text-blue-600 font-semibold">
          {forecast.baseline_change_pct > 0 ? '+' : ''}{forecast.baseline_change_pct.toFixed(1)}%
        </span>
        <span className="text-gray-400">|</span>
        <span className="text-green-600 font-semibold">
          {forecast.bull_change_pct > 0 ? '+' : ''}{forecast.bull_change_pct.toFixed(1)}%
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">📊</span>
        <h3 className="font-semibold text-sm text-gray-900">
          6-12 Month Value Forecast
        </h3>
        <span className="ml-auto text-xs text-gray-500">
          {Math.round(forecast.confidence * 100)}% confidence
        </span>
      </div>

      {/* Current value */}
      <div className="mb-4 pb-4 border-b border-gray-200">
        <div className="text-xs text-gray-500 mb-1">Current Value</div>
        <div className="text-2xl font-bold text-gray-900">
          {formatCurrency(currentValue)}
        </div>
      </div>

      {/* Forecast bands */}
      <div className="space-y-3">
        {/* Bear case */}
        <div className="flex items-center gap-3">
          <div className="w-16 text-xs text-gray-500">Bear</div>
          <div className="flex-1 bg-red-50 rounded-full h-8 relative overflow-hidden border border-red-200">
            <div
              className="absolute inset-y-0 left-0 bg-red-200"
              style={{ width: '100%' }}
            />
            <div className="relative h-full flex items-center justify-between px-3">
              <span className="text-xs font-semibold text-red-700">
                {forecast.bear_change_pct > 0 ? '+' : ''}{forecast.bear_change_pct.toFixed(1)}%
              </span>
              <span className="text-xs font-medium text-red-600">
                {formatCurrency(bearValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Base case */}
        <div className="flex items-center gap-3">
          <div className="w-16 text-xs text-gray-500">Base</div>
          <div className="flex-1 bg-blue-50 rounded-full h-8 relative overflow-hidden border border-blue-300">
            <div
              className="absolute inset-y-0 left-0 bg-blue-200"
              style={{ width: '100%' }}
            />
            <div className="relative h-full flex items-center justify-between px-3">
              <span className="text-xs font-semibold text-blue-700">
                {forecast.baseline_change_pct > 0 ? '+' : ''}{forecast.baseline_change_pct.toFixed(1)}%
              </span>
              <span className="text-xs font-medium text-blue-600">
                {formatCurrency(baseValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Bull case */}
        <div className="flex items-center gap-3">
          <div className="w-16 text-xs text-gray-500">Bull</div>
          <div className="flex-1 bg-green-50 rounded-full h-8 relative overflow-hidden border border-green-300">
            <div
              className="absolute inset-y-0 left-0 bg-green-200"
              style={{ width: '100%' }}
            />
            <div className="relative h-full flex items-center justify-between px-3">
              <span className="text-xs font-semibold text-green-700">
                {forecast.bull_change_pct > 0 ? '+' : ''}{forecast.bull_change_pct.toFixed(1)}%
              </span>
              <span className="text-xs font-medium text-green-600">
                {formatCurrency(bullValue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Drivers */}
      {showLegend && forecast.drivers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-2">Key Drivers:</div>
          <div className="flex flex-wrap gap-1">
            {forecast.drivers.map((driver, idx) => (
              <span
                key={idx}
                className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
              >
                {driver}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
