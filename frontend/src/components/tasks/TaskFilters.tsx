import React from 'react';
import { TaskCategory, TaskPriority } from '../../types/task';

interface TaskFiltersProps {
  filters: {
    category?: TaskCategory;
    priority?: TaskPriority;
    dealId?: number;
  };
  onChange: (filters: any) => void;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({ filters, onChange }) => {
  return (
    <div className="flex gap-4 items-center">
      <select
        value={filters.category || ''}
        onChange={(e) => onChange({ ...filters, category: e.target.value || undefined })}
        className="border border-gray-300 rounded-lg px-3 py-2"
      >
        <option value="">All Categories</option>
        <option value="due_diligence">Due Diligence</option>
        <option value="financing">Financing</option>
        <option value="legal">Legal</option>
        <option value="construction">Construction</option>
        <option value="leasing">Leasing</option>
        <option value="property_management">Property Mgmt</option>
        <option value="reporting">Reporting</option>
        <option value="communication">Communication</option>
        <option value="analysis">Analysis</option>
        <option value="other">Other</option>
      </select>

      <select
        value={filters.priority || ''}
        onChange={(e) => onChange({ ...filters, priority: e.target.value || undefined })}
        className="border border-gray-300 rounded-lg px-3 py-2"
      >
        <option value="">All Priorities</option>
        <option value="urgent">🔴 Urgent</option>
        <option value="high">🟠 High</option>
        <option value="medium">🟡 Medium</option>
        <option value="low">⚪ Low</option>
      </select>
    </div>
  );
};
