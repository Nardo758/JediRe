/**
 * Layer Filters Modal
 * Advanced filtering controls for map layers
 */

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { MapLayer } from '../../types/layers';

interface LayerFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  layer: MapLayer;
  onApplyFilters: (filters: Record<string, any>) => void;
}

export const LayerFiltersModal: React.FC<LayerFiltersModalProps> = ({
  isOpen,
  onClose,
  layer,
  onApplyFilters
}) => {
  const [filters, setFilters] = useState(layer.filters || {});

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters({});
  };

  // Render filter controls based on source type
  const renderFilters = () => {
    switch (layer.source_type) {
      case 'assets':
      case 'pipeline':
        return (
          <div className="space-y-4">
            {/* Property Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Property Type
              </label>
              <div className="space-y-2">
                {['multifamily', 'single-family', 'commercial', 'land'].map(type => (
                  <label key={type} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.propertyType?.includes(type) || false}
                      onChange={(e) => {
                        const current = filters.propertyType || [];
                        setFilters({
                          ...filters,
                          propertyType: e.target.checked
                            ? [...current, type]
                            : current.filter((t: string) => t !== type)
                        });
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.priceRange?.[0] || ''}
                  onChange={(e) => setFilters({
                    ...filters,
                    priceRange: [parseInt(e.target.value) || 0, filters.priceRange?.[1] || 0]
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.priceRange?.[1] || ''}
                  onChange={(e) => setFilters({
                    ...filters,
                    priceRange: [filters.priceRange?.[0] || 0, parseInt(e.target.value) || 0]
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {/* Status Filter (Pipeline only) */}
            {layer.source_type === 'pipeline' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <div className="space-y-2">
                  {['Lead', 'Qualified', 'Analyzing', 'Offer Made', 'Under Contract', 'Closed'].map(status => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.status?.includes(status) || false}
                        onChange={(e) => {
                          const current = filters.status || [];
                          setFilters({
                            ...filters,
                            status: e.target.checked
                              ? [...current, status]
                              : current.filter((s: string) => s !== status)
                          });
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{status}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'news':
        return (
          <div className="space-y-4">
            {/* Event Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Type
              </label>
              <div className="space-y-2">
                {['employment', 'development', 'transaction', 'government', 'amenity'].map(type => (
                  <label key={type} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.eventType?.includes(type) || false}
                      onChange={(e) => {
                        const current = filters.eventType || [];
                        setFilters({
                          ...filters,
                          eventType: e.target.checked
                            ? [...current, type]
                            : current.filter((t: string) => t !== type)
                        });
                      }}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Impact Score Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Impact Score
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={filters.minImpactScore || 0}
                onChange={(e) => setFilters({
                  ...filters,
                  minImpactScore: parseInt(e.target.value)
                })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>0</span>
                <span className="font-medium">{filters.minImpactScore || 0}</span>
                <span>100</span>
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filters.dateRange?.[0] || ''}
                  onChange={(e) => setFilters({
                    ...filters,
                    dateRange: [e.target.value, filters.dateRange?.[1] || '']
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={filters.dateRange?.[1] || ''}
                  onChange={(e) => setFilters({
                    ...filters,
                    dateRange: [filters.dateRange?.[0] || '', e.target.value]
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        );

      case 'email':
        return (
          <div className="space-y-4">
            {/* From Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Email/Name
              </label>
              <input
                type="text"
                placeholder="Filter by sender..."
                value={filters.from || ''}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* Has Deal Filter */}
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.hasDeal || false}
                onChange={(e) => setFilters({ ...filters, hasDeal: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Linked to deals only</span>
            </label>
          </div>
        );

      default:
        return (
          <div className="text-center text-gray-500 py-8">
            No filters available for this layer type
          </div>
        );
    }
  };

  const activeFilterCount = Object.keys(filters).filter(key => {
    const value = filters[key];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.length > 0;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    return false;
  }).length;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-xl shadow-2xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-blue-600" />
              <Dialog.Title className="font-bold text-lg">
                Filter {layer.name}
              </Dialog.Title>
              {activeFilterCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  {activeFilterCount} active
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Filters */}
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {renderFilters()}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleApply}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Apply Filters
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default LayerFiltersModal;
