import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type { MapLayers, MapFilters } from '@/types/asset';
import { cn } from '@/utils/cn';

interface MapLayerToggleProps {
  layers: MapLayers;
  filters: MapFilters;
  onLayersChange: (layers: MapLayers) => void;
  onFiltersChange: (filters: MapFilters) => void;
  newsCount: number;
  notesCount: number;
}

export default function MapLayerToggle({
  layers,
  filters,
  onLayersChange,
  onFiltersChange,
  newsCount,
  notesCount,
}: MapLayerToggleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleLayer = (key: keyof MapLayers) => {
    onLayersChange({ ...layers, [key]: !layers[key] });
  };

  const toggleNewsType = (type: string) => {
    const types = filters.newsTypes.includes(type)
      ? filters.newsTypes.filter((t) => t !== type)
      : [...filters.newsTypes, type];
    onFiltersChange({ ...filters, newsTypes: types });
  };

  const toggleImpactLevel = (level: 'high' | 'medium' | 'low') => {
    const levels = filters.impactLevels.includes(level)
      ? filters.impactLevels.filter((l) => l !== level)
      : [...filters.impactLevels, level];
    onFiltersChange({ ...filters, impactLevels: levels });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden min-w-[280px]">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🗺️</span>
          <span className="font-semibold text-gray-900">Map Layers</span>
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Property Section */}
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Property</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={layers.propertyBoundary}
                onChange={() => toggleLayer('propertyBoundary')}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Boundary</span>
            </label>
          </div>

          {/* Intelligence Section */}
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Intelligence</h3>
            <div className="space-y-2">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={layers.newsEvents}
                    onChange={() => toggleLayer('newsEvents')}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">News Events</span>
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full group-hover:bg-gray-200">
                  {newsCount} 📰
                </span>
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={layers.myNotes}
                    onChange={() => toggleLayer('myNotes')}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">My Notes</span>
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full group-hover:bg-gray-200">
                  {notesCount} 📝
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.teamNotes}
                  onChange={() => toggleLayer('teamNotes')}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Team Notes</span>
                <span className="text-xs text-gray-500">💬</span>
              </label>
            </div>
          </div>

          {/* Market Data Section */}
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Market Data</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer opacity-50">
                <input
                  type="checkbox"
                  checked={layers.supplyPipeline}
                  onChange={() => toggleLayer('supplyPipeline')}
                  disabled
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Supply Pipeline</span>
                <span className="text-xs text-gray-500">🏗️</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer opacity-50">
                <input
                  type="checkbox"
                  checked={layers.comparables}
                  onChange={() => toggleLayer('comparables')}
                  disabled
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Comparables</span>
                <span className="text-xs text-gray-500">📊</span>
              </label>
            </div>
          </div>

          {/* News Filters */}
          {layers.newsEvents && (
            <>
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">News Type</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'employment', label: 'Employment', emoji: '💼' },
                    { key: 'development', label: 'Development', emoji: '🏗️' },
                    { key: 'infrastructure', label: 'Infrastructure', emoji: '🚇' },
                    { key: 'transaction', label: 'Transactions', emoji: '💰' },
                  ].map(({ key, label, emoji }) => (
                    <button
                      key={key}
                      onClick={() => toggleNewsType(key)}
                      className={cn(
                        'text-xs px-2 py-1 rounded-full transition-all',
                        filters.newsTypes.includes(key)
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      {emoji} {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Radius (miles)
                </h3>
                <div className="flex gap-1">
                  {([1, 3, 5, 10] as const).map((radius) => (
                    <button
                      key={radius}
                      onClick={() => onFiltersChange({ ...filters, radiusMiles: radius })}
                      className={cn(
                        'flex-1 text-xs py-1.5 rounded transition-all font-medium',
                        filters.radiusMiles === radius
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      {radius}mi
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-4 py-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Impact Level
                </h3>
                <div className="space-y-1">
                  {[
                    { key: 'high' as const, label: 'High (7-10)', color: 'text-red-600' },
                    { key: 'medium' as const, label: 'Medium (4-6)', color: 'text-yellow-600' },
                    { key: 'low' as const, label: 'Low (1-3)', color: 'text-gray-600' },
                  ].map(({ key, label, color }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.impactLevels.includes(key)}
                        onChange={() => toggleImpactLevel(key)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className={cn('text-sm font-medium', color)}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
