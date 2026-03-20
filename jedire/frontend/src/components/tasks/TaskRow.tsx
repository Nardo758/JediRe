import React, { useState } from 'react';
import { Task, PRIORITY_CONFIG, STATUS_CONFIG, CATEGORY_LABELS } from '../../types/task.types';
import { tasksService } from '../../services/tasks.service';

interface TaskRowProps {
  task: Task;
  selected: boolean;
  onSelect: () => void;
  onClick: () => void;
}

export const TaskRow: React.FC<TaskRowProps> = ({ task, selected, onSelect, onClick }) => {
  const [showActions, setShowActions] = useState(false);

  // Check if task is overdue or due today
  const now = new Date();
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && dueDate < now && task.status !== 'complete';
  const isDueToday =
    dueDate && dueDate.toDateString() === now.toDateString() && task.status !== 'complete';

  // Row styling based on status
  const getRowClass = () => {
    const baseClass = 'hover:bg-gray-50 transition-colors cursor-pointer';
    if (task.status === 'complete') return `${baseClass} bg-gray-50 opacity-60`;
    if (isOverdue) return `${baseClass} bg-red-50`;
    if (isDueToday) return `${baseClass} bg-yellow-50`;
    return baseClass;
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '—';
    const d = new Date(date);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    return `${month} ${day}`;
  };

  const handleQuickAction = (action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    switch (action) {
      case 'complete':
        tasksService.updateTask(task.id, {
          status: 'complete',
          completedAt: new Date().toISOString(),
        });
        window.location.reload(); // Refresh to show updated data
        break;
      case 'in_progress':
        tasksService.updateTask(task.id, { status: 'in_progress' });
        window.location.reload();
        break;
      case 'delete':
        if (confirm(`Delete task "${task.name}"?`)) {
          tasksService.deleteTask(task.id);
          window.location.reload();
        }
        break;
    }
    setShowActions(false);
  };

  return (
    <tr className={getRowClass()}>
      {/* Checkbox */}
      <td className="px-4 py-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
        />
      </td>

      {/* Task Name */}
      <td className="px-6 py-4" onClick={onClick}>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{task.name}</span>
            {task.source.type === 'email' && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">📧 Email</span>
            )}
            {task.source.type === 'agent-alert' && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">🤖 AI</span>
            )}
          </div>
          {task.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{task.description}</p>
          )}
          {task.status === 'blocked' && task.blockedReason && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <span>🚧</span>
              <span>{task.blockedReason}</span>
            </p>
          )}
        </div>
      </td>

      {/* Category */}
      <td className="px-6 py-4" onClick={onClick}>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {CATEGORY_LABELS[task.category]}
        </span>
      </td>

      {/* Linked To */}
      <td className="px-6 py-4" onClick={onClick}>
        <div className="flex flex-col">
          <span className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            {task.linkedEntity.name}
          </span>
          <span className="text-xs text-gray-500 capitalize">
            {task.linkedEntity.type === 'pipeline-deal' && '📊 Pipeline'}
            {task.linkedEntity.type === 'assets-owned-property' && '🏢 Assets'}
            {task.linkedEntity.type === 'global' && '🌐 Global'}
          </span>
        </div>
      </td>

      {/* Assigned */}
      <td className="px-6 py-4" onClick={onClick}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
            {task.assignedTo.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()}
          </div>
          <span className="text-sm text-gray-900">{task.assignedTo.name}</span>
        </div>
      </td>

      {/* Priority */}
      <td className="px-6 py-4" onClick={onClick}>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            PRIORITY_CONFIG[task.priority].color
          }`}
        >
          <span>{PRIORITY_CONFIG[task.priority].icon}</span>
          <span>{PRIORITY_CONFIG[task.priority].label}</span>
        </span>
      </td>

      {/* Due Date */}
      <td className="px-6 py-4" onClick={onClick}>
        {task.dueDate ? (
          <div className="flex flex-col">
            <span
              className={`text-sm ${
                isOverdue
                  ? 'text-red-600 font-semibold'
                  : isDueToday
                  ? 'text-yellow-600 font-semibold'
                  : 'text-gray-900'
              }`}
            >
              {isOverdue && '⚠️ '}
              {isDueToday && '📅 '}
              {formatDate(task.dueDate)}
            </span>
            {isOverdue && <span className="text-xs text-red-500">Overdue</span>}
            {isDueToday && <span className="text-xs text-yellow-600">Due today</span>}
          </div>
        ) : (
          <span className="text-sm text-gray-400">No due date</span>
        )}
      </td>

      {/* Status */}
      <td className="px-6 py-4" onClick={onClick}>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            STATUS_CONFIG[task.status].color
          }`}
        >
          {STATUS_CONFIG[task.status].label}
        </span>
      </td>

      {/* Actions */}
      <td className="px-6 py-4 text-center relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowActions(!showActions);
          }}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>

        {/* Actions Dropdown */}
        {showActions && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowActions(false)}
            />
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
              <div className="py-1">
                {task.status !== 'complete' && (
                  <>
                    <button
                      onClick={(e) => handleQuickAction('complete', e)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      ✅ Mark Complete
                    </button>
                    {task.status !== 'in_progress' && (
                      <button
                        onClick={(e) => handleQuickAction('in_progress', e)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        📝 Start Progress
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={onClick}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={(e) => handleQuickAction('delete', e)}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </>
        )}
      </td>
    </tr>
  );
};
