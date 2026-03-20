import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

interface ActionItem {
  text: string;
  suggestedTask: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  dueDate?: string;
}

interface ActionItemDetectorProps {
  emailId: string;
  emailBody: string;
  dealId?: number;
  onTaskCreated?: () => void;
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const priorityIcons = {
  low: '⚪',
  medium: '🟡',
  high: '🟠',
  urgent: '🔴',
};

export const ActionItemDetector: React.FC<ActionItemDetectorProps> = ({
  emailId,
  emailBody,
  dealId,
  onTaskCreated,
}) => {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingTask, setCreatingTask] = useState<number | null>(null);

  useEffect(() => {
    detectActionItems();
  }, [emailBody]);

  const detectActionItems = async () => {
    if (!emailBody || emailBody.length < 20) return;

    setLoading(true);
    try {
      const response = await api.get(`/emails/${emailId}/action-items`, {
        params: { body: emailBody },
      });
      setActionItems(response.data.data || []);
    } catch (error) {
      console.error('Error detecting action items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (item: ActionItem, index: number) => {
    setCreatingTask(index);
    try {
      await api.post(`/emails/${emailId}/create-task`, {
        title: item.suggestedTask,
        description: `From email: ${item.text}`,
        category: item.category,
        priority: item.priority,
        dealId,
        dueDate: item.dueDate,
        tags: ['email', 'ai-detected'],
      });

      // Remove item from list
      setActionItems(actionItems.filter((_, i) => i !== index));
      
      if (onTaskCreated) {
        onTaskCreated();
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task');
    } finally {
      setCreatingTask(null);
    }
  };

  const handleDismiss = (index: number) => {
    setActionItems(actionItems.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-blue-700 font-medium">🤖 Analyzing email for action items...</span>
        </div>
      </div>
    );
  }

  if (actionItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg font-semibold text-gray-900">🤖 AI Detected Action Items</span>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
          {actionItems.length} detected
        </span>
      </div>

      {actionItems.map((item, index) => (
        <div
          key={index}
          className={`
            border-2 rounded-lg p-4 transition-all
            ${priorityColors[item.priority].replace('text-', 'border-')}
          `}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{priorityIcons[item.priority]}</span>
              <div>
                <div className="font-semibold text-gray-900">
                  {item.suggestedTask}
                </div>
                <div className="text-xs text-gray-500">
                  {item.category.replace(/_/g, ' ')}
                  {item.dueDate && ` • Due: ${item.dueDate}`}
                </div>
              </div>
            </div>
            <span
              className={`
                px-2 py-1 rounded text-xs font-medium
                ${priorityColors[item.priority]}
              `}
            >
              {item.priority}
            </span>
          </div>

          {/* Original Text */}
          <p className="text-sm text-gray-600 mb-3 italic">
            "{item.text}"
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => handleCreateTask(item, index)}
              disabled={creatingTask === index}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 text-sm font-medium transition-colors"
            >
              {creatingTask === index ? 'Creating...' : '✓ Create Task'}
            </button>
            <button
              onClick={() => handleDismiss(index)}
              disabled={creatingTask === index}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:bg-gray-50 text-sm font-medium transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
