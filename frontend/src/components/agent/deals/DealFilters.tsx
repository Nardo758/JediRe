import { useState } from 'react';
import { DealStage, DealType, DealPriority } from '@/types';
import { Filter, X, Calendar, User, DollarSign } from 'lucide-react';

export interface DealFiltersState {
  stages: DealStage[];
  dealTypes: DealType[];
  priorities: DealPriority[];
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy: 'value' | 'date' | 'priority';
  sortOrder: 'asc' | 'desc';
}

interface DealFiltersProps {
  filters: DealFiltersState;
  onChange: (filters: DealFiltersState) => void;
  clients: Array<{ id: string; name: string }>;
}

const stageOptions: { value: DealStage; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'under_contract', label: 'Under Contract' },
  { value: 'closed', label: 'Closed' },
  { value: 'lost', label: 'Lost' },
];

const dealTypeOptions: { value: DealType; label: string }[] = [
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
  { value: 'both', label: 'Both' },
];

const priorityOptions: { value: DealPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const sortOptions = [
  { value: 'value', label: 'Deal Value' },
  { value: 'date', label: 'Date' },
  { value: 'priority', label: 'Priority' },
];

export default function DealFilters({ filters, onChange, clients }: DealFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters = 
    filters.dealTypes.length > 0 ||
    filters.priorities.length > 0 ||
    filters.clientId ||
    filters.dateFrom ||
    filters.dateTo;

  const toggleArrayFilter = <T,>(
    array: T[],
    value: T,
    key: keyof DealFiltersState
  ) => {
    const newArray = array.includes(value)
      ? array.filter((v) => v !== value)
      : [...array, value];
    onChange({ ...filters, [key]: newArray });
  };

  const clearFilters = () => {
    onChange({
      stages: [],
      dealTypes: [],
      priorities: [],
      clientId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      sortBy: 'date',
      sortOrder: 'desc',
    });
  };

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <Filter className="w-4 h-4" />
          Filters {hasActiveFilters && `(${
            filters.dealTypes.length + 
            filters.priorities.length + 
            (filters.clientId ? 1 : 0) +
            (filters.dateFrom || filters.dateTo ? 1 : 0)
          })`}
        </button>
        
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear All
            </button>
          )}
          
          {/* Sort */}
          <div className="flex items-center gap-2">
            <select
              value={filters.sortBy}
              onChange={(e) => onChange({ ...filters, sortBy: e.target.value as any })}
              aria-label="Sort by"
              className="text-xs border border-gray-300 rounded px-2 py-1"
            >
              {sortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={() => onChange({ 
                ...filters, 
                sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' 
              })}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {filters.sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
          {/* Deal Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              <DollarSign className="w-3 h-3 inline mr-1" />
              Deal Type
            </label>
            <div className="flex flex-wrap gap-2">
              {dealTypeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => toggleArrayFilter(filters.dealTypes, opt.value, 'dealTypes')}
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium border transition-colors
                    ${filters.dealTypes.includes(opt.value)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Priority</label>
            <div className="flex flex-wrap gap-2">
              {priorityOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => toggleArrayFilter(filters.priorities, opt.value, 'priorities')}
                  className={`
                    px-3 py-1 rounded-full text-xs font-medium border transition-colors
                    ${filters.priorities.includes(opt.value)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Client Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              <User className="w-3 h-3 inline mr-1" />
              Client
            </label>
            <select
              value={filters.clientId || ''}
              onChange={(e) => onChange({ 
                ...filters, 
                clientId: e.target.value || undefined 
              })}
              aria-label="Filter by client"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All Clients</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              <Calendar className="w-3 h-3 inline mr-1" />
              Expected Close Date Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
                aria-label="Expected close date from"
                className="text-sm border border-gray-300 rounded-lg px-3 py-2"
                placeholder="From"
              />
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
                aria-label="Expected close date to"
                className="text-sm border border-gray-300 rounded-lg px-3 py-2"
                placeholder="To"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
