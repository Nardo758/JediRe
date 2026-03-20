import React from 'react';
import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import type { UnitMix } from '@/types/development';

interface UnitMixOptimizerProps {
  currentMix: UnitMix;
  marketMix?: UnitMix;
  onMixChange: (mix: UnitMix) => void;
  onOptimize: () => void;
}

export const UnitMixOptimizer: React.FC<UnitMixOptimizerProps> = ({
  currentMix,
  marketMix,
  onMixChange,
  onOptimize,
}) => {
  const unitTypes = [
    { key: 'studio' as keyof UnitMix, label: 'Studio', color: 'bg-purple-500' },
    { key: 'oneBR' as keyof UnitMix, label: '1BR', color: 'bg-blue-500' },
    { key: 'twoBR' as keyof UnitMix, label: '2BR', color: 'bg-green-500' },
    { key: 'threeBR' as keyof UnitMix, label: '3BR', color: 'bg-orange-500' },
  ];

  const handleSliderChange = (key: keyof UnitMix, value: number) => {
    const newValue = value / 100;
    const remaining = 1 - newValue;
    const otherKeys = unitTypes.filter(t => t.key !== key).map(t => t.key);
    
    // Distribute remaining percentage proportionally
    const otherTotal = otherKeys.reduce((sum, k) => sum + currentMix[k], 0);
    const newMix = { ...currentMix, [key]: newValue };
    
    if (otherTotal > 0) {
      otherKeys.forEach(k => {
        newMix[k] = (currentMix[k] / otherTotal) * remaining;
      });
    }
    
    onMixChange(newMix);
  };

  const getTrendIcon = (current: number, market?: number) => {
    if (!market) return <Minus className="w-4 h-4 text-gray-400" />;
    
    const diff = current - market;
    if (Math.abs(diff) < 0.03) {
      return <Minus className="w-4 h-4 text-gray-400" />;
    }
    
    return diff > 0 ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    );
  };

  const getGapWarning = (current: number, market?: number) => {
    if (!market) return null;
    
    const diff = Math.abs(current - market);
    if (diff > 0.1) {
      return (
        <div className="text-xs text-amber-600 mt-1">
          ⚠️ {(diff * 100).toFixed(0)}% gap from market
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Unit Mix Optimizer</h3>
          <Button
            size="sm"
            onClick={onOptimize}
            className="flex items-center gap-1"
          >
            <Sparkles className="w-4 h-4" />
            Optimize
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          Adjust unit distribution to match market demand
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Market Demand Summary */}
        {marketMix && (
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <div className="text-xs font-semibold text-blue-900 mb-2">
              Market Demand Distribution:
            </div>
            <div className="grid grid-cols-4 gap-2">
              {unitTypes.map(type => (
                <div key={type.key} className="text-center">
                  <div className="text-xs text-blue-700">{type.label}</div>
                  <div className="text-sm font-bold text-blue-900">
                    {(marketMix[type.key] * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unit Type Sliders */}
        {unitTypes.map(type => (
          <div key={type.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${type.color}`} />
                <span className="text-sm font-medium text-gray-700">
                  {type.label}
                </span>
                {getTrendIcon(currentMix[type.key], marketMix?.[type.key])}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">
                  {(currentMix[type.key] * 100).toFixed(0)}%
                </span>
                {marketMix && (
                  <span className="text-xs text-gray-500">
                    (Mkt: {(marketMix[type.key] * 100).toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
            
            {/* Slider */}
            <input
              type="range"
              min="0"
              max="100"
              value={currentMix[type.key] * 100}
              onChange={(e) => handleSliderChange(type.key, parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              style={{
                background: `linear-gradient(to right, ${type.color.replace('bg-', 'rgb(var(--color-')} 0%, ${type.color.replace('bg-', 'rgb(var(--color-')} ${currentMix[type.key] * 100}%, #E5E7EB ${currentMix[type.key] * 100}%, #E5E7EB 100%)`
              }}
            />
            
            {getGapWarning(currentMix[type.key], marketMix?.[type.key])}
          </div>
        ))}

        {/* Visual Distribution Bar */}
        <div className="mt-6">
          <div className="text-xs font-semibold text-gray-700 mb-2">
            Current Distribution:
          </div>
          <div className="flex h-8 rounded-lg overflow-hidden">
            {unitTypes.map(type => (
              <div
                key={type.key}
                className={`${type.color} flex items-center justify-center text-white text-xs font-semibold transition-all`}
                style={{ width: `${currentMix[type.key] * 100}%` }}
              >
                {currentMix[type.key] >= 0.08 && (
                  <span>{(currentMix[type.key] * 100).toFixed(0)}%</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Validation */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Total:</span>
            <span className={`font-bold ${
              Math.abs(Object.values(currentMix).reduce((a, b) => a + b, 0) - 1) < 0.01
                ? 'text-green-600'
                : 'text-red-600'
            }`}>
              {(Object.values(currentMix).reduce((a, b) => a + b, 0) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
