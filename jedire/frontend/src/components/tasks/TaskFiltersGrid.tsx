import React, { useState } from 'react';
import {
  TaskFilters,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  CATEGORY_LABELS,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
} from '../../types/task.types';
import { tasksService } from '../../services/tasks.service';
import { DateRangeFilter, DateRangeOption, getDateRangeFromOption } from '../ui/DateRangeFilter';

interface TaskFiltersGridProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
}

export const TaskFiltersGrid: React.FC<TaskFiltersGridProps> = ({ filters, onChange }) => {
  const [expanded, setExpanded] = useState(false);
  const [dueDateRange, setDueDateRange] = useState<DateRangeOption>('all');
  const [dueDateCustomStart, setDueDateCustomStart] = useState<string>('');
  const [dueDateCustomEnd, setDueDateCustomEnd] = useState<string>('');
  const [completedDateRange, setCompletedDateRange] = useState<DateRangeOption>('all');
  const [completedDateCustomStart, setCompletedDateCustomStart] = useState<string>('');
  const [completedDateCustomEnd, setCompletedDateCustomEnd] = useState<string>('');

  const deals = tasksService.getAvailableDeals();
  const users = tasksService.getAvailableUsers();

  const updateFilter = (key: keyof TaskFilters, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (
    key: 'status' | 'priority' | 'category',
    value: TaskStatus | TaskPriority | TaskCategory
  ) => {
    const currentArray = (filters[key] as any[]) || [];
    const newArray = currentArray.includes(value)
      ? currentArray.filter((v) => v !== value)
      : [...currentArray, value];
    updateFilter(key, newArray.length > 0 ? newArray : undefined);
  };

  const clearAllFilters = () => {
    onChange({});
    setDueDateRange('all');
    setDueDateCustomStart('');
    setDueDateCustomEnd('');
    setCompletedDateRange('all');
    setCompletedDateCustomStart('');
    setCompletedDateCustomEnd('');
  };

  const handleDueDateRangeChange = (range: DateRangeOption) => {
    setDueDateRange(range);
    const { start, end } = getDateRangeFromOption(range, dueDateCustomStart, dueDateCustomEnd);
    updateFilter('dueDateStart', start ? start.toISOString() : undefined);
    updateFilter('dueDateEnd', end.toISOString());
  };

  const handleDueDateCustomChange = (start: string, end: string) => {
    setDueDateCustomStart(start);
    setDueDateCustomEnd(end);
    if (start && end) {
      updateFilter('dueDateStart', new Date(start).toISOString());
      updateFilter('dueDateEnd', new Date(end).toISOString());
    }
  };

  const handleCompletedDateRangeChange = (range: DateRangeOption) => {
    setCompletedDateRange(range);
    const { start, end } = getDateRangeFromOption(range, completedDateCustomStart, completedDateCustomEnd);
    updateFilter('completedDateStart', start ? start.toISOString() : undefined);
    updateFilter('completedDateEnd', end.toISOString());
  };

  const handleCompletedDateCustomChange = (start: string, end: string) => {
    setCompletedDateCustomStart(start);
    setCompletedDateCustomEnd(end);
    if (start && end) {
      updateFilter('completedDateStart', new Date(start).toISOString());
      updateFilter('completedDateEnd', new Date(end).toISOString());
    }
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : true));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Search Bar and Toggle */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => updateFilter('search', e.target.value || undefined)}
            placeholder="Search tasks by name, description, or deal..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <span className="text-sm font-medium text-gray-700">
            {expanded ? 'Hide Filters' : 'Show Filters'}
          </span>
          {hasActiveFilters && (
            <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
              {Object.values(filters).filter((v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : true)).length}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 border border-red-300 rounded-lg transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Expanded Filters */}
      {expanded && (
        <div className="border-t border-gray-200 pt-4 space-y-4">
          {/* Status Filters */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => toggleArrayFilter('status', status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    filters.status?.includes(status)
                      ? STATUS_CONFIG[status].color
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {STATUS_CONFIG[status].label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Filters */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((priority) => (
                <button
                  key={priority}
                  onClick={() => toggleArrayFilter('priority', priority)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1 ${
                    filters.priority?.includes(priority)
                      ? PRIORITY_CONFIG[priority].color
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span>{PRIORITY_CONFIG[priority].icon}</span>
                  <span>{PRIORITY_CONFIG[priority].label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Category Filters */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((category) => (
                <button
                  key={category}
                  onClick={() => toggleArrayFilter('category', category)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    filters.category?.includes(category)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {CATEGORY_LABELS[category]}
                </button>
              ))}
            </div>
          </div>

          {/* Deal Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Linked Deal/Property</label>
            <select
              value={filters.linkedEntityId || ''}
              onChange={(e) => updateFilter('linkedEntityId', e.target.value || undefined)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Deals & Properties</option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.type === 'pipeline-deal' ? '📊' : '🏢'} {deal.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assigned User Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Assigned To</label>
            <select
              value={filters.assignedToId || ''}
              onChange={(e) => updateFilter('assignedToId', e.target.value || undefined)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Due Date</label>
            <DateRangeFilter
              selectedRange={dueDateRange}
              onRangeChange={handleDueDateRangeChange}
              showCustom={true}
              customStartDate={dueDateCustomStart}
              customEndDate={dueDateCustomEnd}
              onCustomDatesChange={handleDueDateCustomChange}
            />
          </div>

          {/* Completion Date Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Completion Date</label>
            <DateRangeFilter
              selectedRange={completedDateRange}
              onRangeChange={handleCompletedDateRangeChange}
              showCustom={true}
              customStartDate={completedDateCustomStart}
              customEndDate={completedDateCustomEnd}
              onCustomDatesChange={handleCompletedDateCustomChange}
            />
          </div>
        </div>
      )}
    </div>
  );
};
