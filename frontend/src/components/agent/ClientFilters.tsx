import { useState, useEffect } from 'react';
import { X, Calendar, Filter } from 'lucide-react';
import { ClientFilters as ClientFiltersType } from '@/types/agent';

interface ClientFiltersProps {
  filters: ClientFiltersType;
  onFiltersChange: (filters: ClientFiltersType) => void;
  onReset: () => void;
}

export default function ClientFilters({ filters, onFiltersChange, onReset }: ClientFiltersProps) {
  const [localFilters, setLocalFilters] = useState<ClientFiltersType>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleStatusChange = (status: 'active' | 'inactive' | 'archived') => {
    const currentStatuses = localFilters.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    
    const updatedFilters = { ...localFilters, status: newStatuses.length > 0 ? newStatuses : undefined };
    setLocalFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const handleTypeChange = (type: 'buyer' | 'seller' | 'both') => {
    const currentTypes = localFilters.type || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    
    const updatedFilters = { ...localFilters, type: newTypes.length > 0 ? newTypes : undefined };
    setLocalFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    const updatedFilters = {
      ...localFilters,
      dateRange: {
        start: field === 'start' ? value : (localFilters.dateRange?.start || ''),
        end: field === 'end' ? value : (localFilters.dateRange?.end || '')
      }
    };
    setLocalFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const clearDateRange = () => {
    const updatedFilters = { ...localFilters, dateRange: undefined };
    setLocalFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const hasActiveFilters = () => {
    return (
      (localFilters.status && localFilters.status.length > 0) ||
      (localFilters.type && localFilters.type.length > 0) ||
      localFilters.dateRange
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        {hasActiveFilters() && (
          <button
            onClick={onReset}
            className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Reset All
          </button>
        )}
      </div>

      {/* Status Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Client Status
        </label>
        <div className="flex flex-wrap gap-2">
          {(['active', 'inactive', 'archived'] as const).map((status) => {
            const isSelected = localFilters.status?.includes(status);
            return (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isSelected
                    ? status === 'active'
                      ? 'bg-green-600 text-white'
                      : status === 'inactive'
                      ? 'bg-gray-600 text-white'
                      : 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Client Type Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Client Type
        </label>
        <div className="flex flex-wrap gap-2">
          {(['buyer', 'seller', 'both'] as const).map((type) => {
            const isSelected = localFilters.type?.includes(type);
            const icons = { buyer: '🏠', seller: '💰', both: '🔄' };
            return (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{icons[type]}</span>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Range Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Date Added Range
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">From</label>
            <input
              type="date"
              value={localFilters.dateRange?.start || ''}
              onChange={(e) => handleDateRangeChange('start', e.target.value)}
              aria-label="Date added from"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">To</label>
            <input
              type="date"
              value={localFilters.dateRange?.end || ''}
              onChange={(e) => handleDateRangeChange('end', e.target.value)}
              aria-label="Date added to"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
        {localFilters.dateRange && (
          <button
            onClick={clearDateRange}
            className="mt-2 text-xs text-gray-600 hover:text-red-600 flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear date range
          </button>
        )}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters() && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="text-xs font-medium text-gray-700 mb-2">Active Filters:</div>
          <div className="flex flex-wrap gap-2">
            {localFilters.status?.map((status) => (
              <span
                key={status}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
              >
                {status}
                <button
                  onClick={() => handleStatusChange(status)}
                  className="hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {localFilters.type?.map((type) => (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full"
              >
                {type}
                <button
                  onClick={() => handleTypeChange(type)}
                  className="hover:bg-purple-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {localFilters.dateRange && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                {localFilters.dateRange.start} to {localFilters.dateRange.end}
                <button
                  onClick={clearDateRange}
                  className="hover:bg-green-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
