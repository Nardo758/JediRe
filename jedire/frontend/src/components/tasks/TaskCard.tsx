import React from 'react';
import { Task, TaskPriority } from '../../types/task';
import { format } from 'date-fns';

interface TaskCardProps {
  task: Task;
  onClick?: (task: Task) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
}

const priorityColors: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-700 border-gray-300',
  medium: 'bg-blue-100 text-blue-700 border-blue-300',
  high: 'bg-orange-100 text-orange-700 border-orange-300',
  urgent: 'bg-red-100 text-red-700 border-red-300',
};

const priorityIcons: Record<TaskPriority, string> = {
  low: '⚪',
  medium: '🟡',
  high: '🟠',
  urgent: '🔴',
};

const categoryLabels: Record<string, string> = {
  due_diligence: 'Due Diligence',
  financing: 'Financing',
  legal: 'Legal',
  construction: 'Construction',
  leasing: 'Leasing',
  property_management: 'Property Mgmt',
  reporting: 'Reporting',
  communication: 'Communication',
  analysis: 'Analysis',
  other: 'Other',
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onClick,
  draggable = false,
  onDragStart,
}) => {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
  const isDueToday = task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString();

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, task)}
      onClick={() => onClick?.(task)}
      className={`
        bg-white rounded-lg border-2 p-4 mb-3
        ${priorityColors[task.priority]}
        ${draggable ? 'cursor-move hover:shadow-lg' : 'cursor-pointer hover:shadow-md'}
        transition-shadow duration-200
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{priorityIcons[task.priority]}</span>
          <span className="text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded">
            {categoryLabels[task.category]}
          </span>
        </div>
        {task.source === 'email_ai' && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
            🤖 AI
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
        {task.title}
      </h3>

      {/* Description */}
      {task.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        {/* Due Date */}
        {task.dueDate && (
          <span className={`
            ${isOverdue ? 'text-red-600 font-semibold' : ''}
            ${isDueToday ? 'text-orange-600 font-semibold' : ''}
          `}>
            {isOverdue && '⚠️ '}
            {isDueToday && '📅 '}
            {format(new Date(task.dueDate), 'MMM d')}
          </span>
        )}

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex gap-1">
            {task.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs"
              >
                {tag}
              </span>
            ))}
            {task.tags.length > 2 && (
              <span className="text-gray-500">+{task.tags.length - 2}</span>
            )}
          </div>
        )}
      </div>

      {/* Blocked Reason */}
      {task.status === 'blocked' && task.blockedReason && (
        <div className="mt-2 pt-2 border-t border-gray-300">
          <p className="text-xs text-red-600">
            🚧 {task.blockedReason}
          </p>
        </div>
      )}
    </div>
  );
};
