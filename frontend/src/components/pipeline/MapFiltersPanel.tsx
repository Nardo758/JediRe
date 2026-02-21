/**
 * Map Filters Panel
 * Advanced filtering for pipeline map view
 */

import { useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { PipelineDeal } from '@/types/grid';
import type { MapFilters } from './PipelineMapView';

interface MapFiltersPanelProps {
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  deals: PipelineDeal[];
  filteredCount: number;
  onClose: () => void;
}

export default function MapFiltersPanel({
  filters,
  onFiltersChange,
  deals,
  filteredCount,
  onClose,
}: MapFiltersPanelProps) {
  // Extract unique values from deals
  const uniqueStages = useMemo(() => {
    const stages = new Set(deals.map(d => d.pipeline_stage).filter(Boolean));
    return Array.from(stages).sort();
  }, [deals]);

  const uniqueStrategies = useMemo(() => {
    const strategies = new Set(deals.map(d => d.best_strategy).filter(Boolean));
    return Array.from(strategies).sort();
  }, [deals]);

  const uniqueSources = useMemo(() => {
    const sources = new Set(deals.map(d => d.source).filter(Boolean));
    return Array.from(sources).sort();
  }, [deals]);

  const priceRange = useMemo(() => {
    const prices = deals.map(d => d.ask_price).filter(p => p > 0);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [deals]);

  const handleStageToggle = (stage: string) => {
    const newStages = filters.stages.includes(stage)
      ? filters.stages.filter(s => s !== stage)
      : [...filters.stages, stage];
    onFiltersChange({ ...filters, stages: newStages });
  };

  const handleStrategyToggle = (strategy: string) => {
    const newStrategies = filters.strategies.includes(strategy)
      ? filters.strategies.filter(s => s !== strategy)
      : [...filters.strategies, strategy];
    onFiltersChange({ ...filters, strategies: newStrategies });
  };

  const handleSourceToggle = (source: string) => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter(s => s !== source)
      : [...filters.sources, source];
    onFiltersChange({ ...filters, sources: newSources });
  };

  const handleClearAll = () => {
    onFiltersChange({
      stages: [],
      priceRange: [priceRange.min, priceRange.max],
      strategies: [],
      sources: [],
      minScore: undefined,
      showSupplyRisk: undefined,
    });
  };

  return (
    <div className="absolute top-4 left-4 bg-white rounded-xl shadow-2xl w-80 max-h-[calc(100vh-8rem)] overflow-hidden z-20 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg">Filters</h3>
          <p className="text-xs text-blue-100 mt-0.5">
            Showing {filteredCount} of {deals.length} deals
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Body - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Pipeline Stage */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Pipeline Stage
          </label>
          <div className="space-y-2">
            {uniqueStages.map(stage => (
              <label key={stage} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.stages.includes(stage)}
                  onChange={() => handleStageToggle(stage)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{stage}</span>
                <span className="text-xs text-gray-500 ml-auto">
                  ({deals.filter(d => d.pipeline_stage === stage).length})
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Price Range
          </label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={filters.priceRange[0]}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  priceRange: [Number(e.target.value), filters.priceRange[1]]
                })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Min"
              />
              <span className="text-gray-500">to</span>
              <input
                type="number"
                value={filters.priceRange[1]}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  priceRange: [filters.priceRange[0], Number(e.target.value)]
                })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Max"
              />
            </div>
            <div className="text-xs text-gray-500">
              Range: ${(priceRange.min / 1000000).toFixed(1)}M - ${(priceRange.max / 1000000).toFixed(1)}M
            </div>
          </div>
        </div>

        {/* AI Opportunity Score */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Min AI Score
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={filters.minScore || 0}
            onChange={(e) => onFiltersChange({
              ...filters,
              minScore: Number(e.target.value)
            })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>0</span>
            <span className="font-semibold text-gray-900">{filters.minScore || 0}</span>
            <span>100</span>
          </div>
        </div>

        {/* Strategy */}
        {uniqueStrategies.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Strategy
            </label>
            <div className="space-y-2">
              {uniqueStrategies.map(strategy => (
                <label key={strategy} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.strategies.includes(strategy)}
                    onChange={() => handleStrategyToggle(strategy)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{strategy.replace('_', ' ')}</span>
                  <span className="text-xs text-gray-500 ml-auto">
                    ({deals.filter(d => d.best_strategy === strategy).length})
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Source */}
        {uniqueSources.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Source
            </label>
            <div className="space-y-2">
              {uniqueSources.map(source => (
                <label key={source} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.sources.includes(source)}
                    onChange={() => handleSourceToggle(source)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{source}</span>
                  <span className="text-xs text-gray-500 ml-auto">
                    ({deals.filter(d => d.source === source).length})
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Supply Risk */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showSupplyRisk === true}
              onChange={(e) => onFiltersChange({
                ...filters,
                showSupplyRisk: e.target.checked ? true : undefined
              })}
              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <span className="text-sm font-semibold text-gray-900">
              Only show supply risk deals
            </span>
            <span className="text-xs text-gray-500 ml-auto">
              ({deals.filter(d => d.supply_risk_flag).length})
            </span>
          </label>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-between">
        <button
          onClick={handleClearAll}
          className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          Clear All
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
