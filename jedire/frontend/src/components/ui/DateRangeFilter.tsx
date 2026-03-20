/**
 * Reusable Date Range Filter Component
 * Provides flexible time range options (24h, week, month, year, 2+ years, custom)
 */

import React from 'react';
import { Calendar } from 'lucide-react';

export type DateRangeOption = 
  | '24h'
  | '7d'
  | '30d'
  | '90d'
  | '6m'
  | '1y'
  | '2y'
  | 'all'
  | 'custom';

interface DateRangeFilterProps {
  selectedRange: DateRangeOption;
  onRangeChange: (range: DateRangeOption) => void;
  showCustom?: boolean;
  customStartDate?: string;
  customEndDate?: string;
  onCustomDatesChange?: (start: string, end: string) => void;
  className?: string;
}

const rangeOptions: { value: DateRangeOption; label: string }[] = [
  { value: '24h', label: 'Last 24h' },
  { value: '7d', label: 'Last week' },
  { value: '30d', label: 'Last month' },
  { value: '90d', label: 'Last 3 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: '1y', label: 'Last year' },
  { value: '2y', label: 'Last 2 years' },
  { value: 'all', label: 'All time' },
];

export function DateRangeFilter({
  selectedRange,
  onRangeChange,
  showCustom = false,
  customStartDate,
  customEndDate,
  onCustomDatesChange,
  className = '',
}: DateRangeFilterProps) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Quick Range Buttons */}
      <div className="flex flex-wrap gap-2">
        {rangeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onRangeChange(option.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedRange === option.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
        
        {showCustom && (
          <button
            onClick={() => onRangeChange('custom')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              selectedRange === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Custom
          </button>
        )}
      </div>

      {/* Custom Date Inputs */}
      {showCustom && selectedRange === 'custom' && onCustomDatesChange && (
        <div className="flex flex-col sm:flex-row gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={customStartDate || ''}
              onChange={(e) => onCustomDatesChange(e.target.value, customEndDate || '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={customEndDate || ''}
              onChange={(e) => onCustomDatesChange(customStartDate || '', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Utility function to convert DateRangeOption to actual date range
 */
export function getDateRangeFromOption(option: DateRangeOption, customStart?: string, customEnd?: string): { start: Date | null; end: Date } {
  const now = new Date();
  const end = new Date();
  
  if (option === 'custom') {
    return {
      start: customStart ? new Date(customStart) : null,
      end: customEnd ? new Date(customEnd) : now,
    };
  }
  
  if (option === 'all') {
    return { start: null, end };
  }
  
  const start = new Date();
  
  switch (option) {
    case '24h':
      start.setHours(start.getHours() - 24);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    case '6m':
      start.setMonth(start.getMonth() - 6);
      break;
    case '1y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case '2y':
      start.setFullYear(start.getFullYear() - 2);
      break;
  }
  
  return { start, end };
}
