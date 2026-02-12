import { useState } from 'react';
import { X, RotateCcw } from 'lucide-react';

interface FiltersState {
  scoreRange: [number, number];
  priceRange: [number, number];
  strategies: string[];
  timeline: string;
  arbitrageOnly: boolean;
  withZoning: boolean;
  cashFlowOptimized: boolean;
}

interface MobileFiltersSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: FiltersState) => void;
}

export default function MobileFiltersSheet({ isOpen, onClose, onApply }: MobileFiltersSheetProps) {
  const [filters, setFilters] = useState<FiltersState>({
    scoreRange: [70, 100],
    priceRange: [100000, 500000],
    strategies: ['build-to-sell', 'flip', 'rental', 'airbnb'],
    timeline: '6mo',
    arbitrageOnly: false,
    withZoning: false,
    cashFlowOptimized: false,
  });

  const strategies = [
    { id: 'build-to-sell', label: 'Build-to-Sell' },
    { id: 'flip', label: 'Flip' },
    { id: 'rental', label: 'Rental' },
    { id: 'airbnb', label: 'Airbnb' },
  ];

  const timelines = [
    { id: '6mo', label: '< 6 months' },
    { id: '6-12mo', label: '6-12 months' },
    { id: '1-2yr', label: '1-2 years' },
    { id: '2+yr', label: '2+ years' },
  ];

  const toggleStrategy = (id: string) => {
    setFilters(prev => ({
      ...prev,
      strategies: prev.strategies.includes(id)
        ? prev.strategies.filter(s => s !== id)
        : [...prev.strategies, id]
    }));
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.scoreRange[0] !== 0 || filters.scoreRange[1] !== 100) count++;
    if (filters.priceRange[0] !== 0 || filters.priceRange[1] !== 1000000) count++;
    if (filters.strategies.length < 4) count++;
    if (filters.arbitrageOnly) count++;
    if (filters.withZoning) count++;
    if (filters.cashFlowOptimized) count++;
    return count;
  };

  const clearFilters = () => {
    setFilters({
      scoreRange: [0, 100],
      priceRange: [0, 1000000],
      strategies: ['build-to-sell', 'flip', 'rental', 'airbnb'],
      timeline: '6mo',
      arbitrageOnly: false,
      withZoning: false,
      cashFlowOptimized: false,
    });
  };

  const formatPrice = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    return `$${(value / 1000).toFixed(0)}K`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-hidden">
        <div className="flex justify-center py-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="px-4 pb-2 flex items-center justify-between border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Filters</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] p-4 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Opportunity Score</label>
            <div className="px-2">
              <input
                type="range"
                id="filters-score-min"
                name="scoreMin"
                min="0"
                max="100"
                value={filters.scoreRange[0]}
                onChange={(e) => setFilters(prev => ({ ...prev, scoreRange: [parseInt(e.target.value), prev.scoreRange[1]] }))}
                aria-label="Minimum opportunity score"
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>Min: {filters.scoreRange[0]}</span>
                <span>Max: {filters.scoreRange[1]}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Price Range</label>
            <div className="px-2">
              <input
                type="range"
                id="filters-price-max"
                name="priceMax"
                min="50000"
                max="1000000"
                step="10000"
                value={filters.priceRange[1]}
                onChange={(e) => setFilters(prev => ({ ...prev, priceRange: [prev.priceRange[0], parseInt(e.target.value)] }))}
                aria-label="Maximum price range"
                className="w-full accent-blue-600"
              />
              <div className="text-center text-sm text-gray-600 mt-1">
                {formatPrice(filters.priceRange[0])} - {formatPrice(filters.priceRange[1])}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Strategy</label>
            <div className="space-y-2">
              {strategies.map((strategy) => (
                <label key={strategy.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    id={`filters-strategy-${strategy.id}`}
                    name={`strategy${strategy.label.replace(/[^a-zA-Z]/g, '')}`}
                    checked={filters.strategies.includes(strategy.id)}
                    onChange={() => toggleStrategy(strategy.id)}
                    aria-label={`${strategy.label} strategy`}
                    className="w-5 h-5 rounded text-blue-600"
                  />
                  <span className="text-gray-700">{strategy.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Timeline</label>
            <div className="space-y-2">
              {timelines.map((tl) => (
                <label key={tl.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    id={`filters-timeline-${tl.id}`}
                    name="timeline"
                    checked={filters.timeline === tl.id}
                    onChange={() => setFilters(prev => ({ ...prev, timeline: tl.id }))}
                    aria-label={`${tl.label} timeline`}
                    className="w-5 h-5 text-blue-600"
                  />
                  <span className="text-gray-700">{tl.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Advanced</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="filters-arbitrage-only"
                  name="arbitrageOnly"
                  checked={filters.arbitrageOnly}
                  onChange={(e) => setFilters(prev => ({ ...prev, arbitrageOnly: e.target.checked }))}
                  aria-label="Arbitrage only greater than 15 percent"
                  className="w-5 h-5 rounded text-blue-600"
                />
                <span className="text-gray-700">Arbitrage only (&gt;15%)</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="filters-with-zoning"
                  name="withZoning"
                  checked={filters.withZoning}
                  onChange={(e) => setFilters(prev => ({ ...prev, withZoning: e.target.checked }))}
                  aria-label="With zoning analysis"
                  className="w-5 h-5 rounded text-blue-600"
                />
                <span className="text-gray-700">With zoning analysis</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="filters-cash-flow-optimized"
                  name="cashFlowOptimized"
                  checked={filters.cashFlowOptimized}
                  onChange={(e) => setFilters(prev => ({ ...prev, cashFlowOptimized: e.target.checked }))}
                  aria-label="Cash flow optimized"
                  className="w-5 h-5 rounded text-blue-600"
                />
                <span className="text-gray-700">Cash flow optimized</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 space-y-3">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">
              Active: <span className="font-medium">{getActiveFilterCount()} filters</span>
            </span>
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Clear
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() => { onApply(filters); onClose(); }}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium text-white"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
