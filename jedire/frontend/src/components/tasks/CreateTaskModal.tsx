import React, { useState } from 'react';
import {
  CreateTaskInput,
  TaskCategory,
  TaskPriority,
  CATEGORY_LABELS,
  PRIORITY_CONFIG,
} from '../../types/task.types';
import { tasksService } from '../../services/tasks.service';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, onCreate }) => {
  const deals = tasksService.getAvailableDeals();
  const users = tasksService.getAvailableUsers();

  const [formData, setFormData] = useState<Partial<CreateTaskInput>>({
    name: '',
    description: '',
    priority: 'medium',
    category: 'other',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Task name is required';
    }

    if (!formData.linkedEntity?.id) {
      newErrors.linkedEntity = 'Please select a deal or property';
    }

    if (!formData.assignedTo?.userId) {
      newErrors.assignedTo = 'Please assign to someone';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const taskInput: CreateTaskInput = {
      name: formData.name!,
      description: formData.description,
      linkedEntity: formData.linkedEntity!,
      category: formData.category!,
      assignedTo: formData.assignedTo!,
      priority: formData.priority!,
      dueDate: formData.dueDate,
      source: { type: 'manual' },
    };

    tasksService.createTask(taskInput);
    onCreate();
    onClose();
    
    // Reset form
    setFormData({
      name: '',
      description: '',
      priority: 'medium',
      category: 'other',
    });
    setErrors({});
  };

  const handleDealChange = (dealId: string) => {
    const deal = deals.find((d) => d.id === dealId);
    if (deal) {
      setFormData({
        ...formData,
        linkedEntity: {
          type: deal.type as any,
          id: deal.id,
          name: deal.name,
        },
      });
    }
  };

  const handleUserChange = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      setFormData({
        ...formData,
        assignedTo: {
          userId: user.id,
          name: user.name,
          type: user.type as any,
        },
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
          <h2 className="text-xl font-bold text-gray-900">Create New Task</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Task Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Task Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter task name..."
              />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add details about this task..."
              />
            </div>

            {/* Link to Deal/Property */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Link to Deal/Property <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.linkedEntity?.id || ''}
                onChange={(e) => handleDealChange(e.target.value)}
                className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.linkedEntity ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select deal or property...</option>
                {deals.map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    {deal.type === 'pipeline-deal' ? '📊' : '🏢'} {deal.name}
                  </option>
                ))}
              </select>
              {errors.linkedEntity && (
                <p className="text-sm text-red-500 mt-1">{errors.linkedEntity}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as TaskCategory })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned To */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Assigned To <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.assignedTo?.userId || ''}
                onChange={(e) => handleUserChange(e.target.value)}
                className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.assignedTo ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              {errors.assignedTo && <p className="text-sm text-red-500 mt-1">{errors.assignedTo}</p>}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
              <div className="flex gap-3">
                {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority })}
                    className={`flex-1 px-4 py-3 rounded-lg border font-medium transition-colors ${
                      formData.priority === priority
                        ? PRIORITY_CONFIG[priority].color
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span>{PRIORITY_CONFIG[priority].icon}</span>
                      <span>{PRIORITY_CONFIG[priority].label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
              <input
                type="date"
                value={formData.dueDate || ''}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value || undefined })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
};
