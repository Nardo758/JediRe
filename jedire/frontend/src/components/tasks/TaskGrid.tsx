import React, { useState } from 'react';
import { Task, TaskSortConfig, PRIORITY_CONFIG, STATUS_CONFIG } from '../../types/task.types';
import { TaskRow } from './TaskRow';

interface TaskGridProps {
  tasks: Task[];
  selectedIds: Set<string>;
  onSelectTask: (id: string) => void;
  onSelectAll: () => void;
  onTaskClick: (task: Task) => void;
  onSort: (sort: TaskSortConfig) => void;
  currentSort?: TaskSortConfig;
}

export const TaskGrid: React.FC<TaskGridProps> = ({
  tasks,
  selectedIds,
  onSelectTask,
  onSelectAll,
  onTaskClick,
  onSort,
  currentSort,
}) => {
  const allSelected = tasks.length > 0 && tasks.every((t) => selectedIds.has(t.id));

  const handleSort = (field: TaskSortConfig['field']) => {
    const direction =
      currentSort?.field === field && currentSort.direction === 'asc' ? 'desc' : 'asc';
    onSort({ field, direction });
  };

  const SortIcon: React.FC<{ field: string }> = ({ field }) => {
    if (currentSort?.field !== field) return <span className="text-gray-300">⇅</span>;
    return currentSort.direction === 'asc' ? (
      <span className="text-blue-600">↑</span>
    ) : (
      <span className="text-blue-600">↓</span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Checkbox */}
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                />
              </th>

              {/* Task Name */}
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  <span>Task Name</span>
                  <SortIcon field="name" />
                </div>
              </th>

              {/* Category */}
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center gap-2">
                  <span>Category</span>
                  <SortIcon field="category" />
                </div>
              </th>

              {/* Linked To */}
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('linkedEntity.name')}
              >
                <div className="flex items-center gap-2">
                  <span>Linked To</span>
                  <SortIcon field="linkedEntity.name" />
                </div>
              </th>

              {/* Assigned */}
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('assignedTo.name')}
              >
                <div className="flex items-center gap-2">
                  <span>Assigned</span>
                  <SortIcon field="assignedTo.name" />
                </div>
              </th>

              {/* Priority */}
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('priority')}
              >
                <div className="flex items-center gap-2">
                  <span>Priority</span>
                  <SortIcon field="priority" />
                </div>
              </th>

              {/* Due Date */}
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('dueDate')}
              >
                <div className="flex items-center gap-2">
                  <span>Due Date</span>
                  <SortIcon field="dueDate" />
                </div>
              </th>

              {/* Status */}
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-2">
                  <span>Status</span>
                  <SortIcon field="status" />
                </div>
              </th>

              {/* Actions */}
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <svg
                      className="w-12 h-12 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <p className="text-lg font-medium">No tasks found</p>
                    <p className="text-sm">Try adjusting your filters or create a new task</p>
                  </div>
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  selected={selectedIds.has(task.id)}
                  onSelect={() => onSelectTask(task.id)}
                  onClick={() => onTaskClick(task)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
