/**
 * Due Diligence Checklist Service
 * Frontend client for DD checklist and task persistence
 */

import { apiClient } from './api.client';

export interface DDTask {
  id: string;
  checklistId: string;
  title: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'complete' | 'blocked';
  dueDate?: Date | string;
  assignedTo?: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
}

export interface DDChecklist {
  id: string;
  dealId: string;
  checklistType: string;
  tasks: any[];
  completion_pct: number;
  risk_score: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistWithTasks {
  checklist: DDChecklist;
  tasks: DDTask[];
  stats: {
    total: number;
    completed: number;
    in_progress: number;
    pending: number;
    blocked: number;
    completion_pct: number;
  };
}

export interface CreateTaskData {
  checklistId: string;
  title: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'pending' | 'in_progress' | 'complete' | 'blocked';
  dueDate?: Date | string;
  assignedTo?: string;
  notes?: string;
}

export const ddChecklistService = {
  /**
   * Create a new DD checklist for a deal
   */
  async createChecklist(dealId: string, checklistType: string): Promise<{ success: boolean; data: DDChecklist }> {
    try {
      const response = await apiClient.post('/api/v1/dd-checklists', {
        dealId,
        checklistType
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to create DD checklist:', error);
      throw new Error(error.response?.data?.error || 'Failed to create DD checklist');
    }
  },

  /**
   * Get DD checklist with all tasks for a deal
   */
  async getChecklist(dealId: string): Promise<{ success: boolean; data: ChecklistWithTasks }> {
    try {
      const response = await apiClient.get(`/api/v1/dd-checklists/${dealId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch DD checklist:', error);
      throw new Error(error.response?.data?.error || 'Failed to fetch DD checklist');
    }
  },

  /**
   * Update task status
   */
  async updateTaskStatus(
    taskId: string,
    status: 'pending' | 'in-progress' | 'in_progress' | 'complete' | 'blocked'
  ): Promise<{ success: boolean; data: DDTask }> {
    try {
      const response = await apiClient.patch(`/api/v1/dd-checklists/tasks/${taskId}`, {
        status
      });
      return response.data;
    } catch (error: any) {
      console.error('Failed to update task status:', error);
      throw new Error(error.response?.data?.error || 'Failed to update task status');
    }
  },

  /**
   * Update a task with any fields
   */
  async updateTask(
    taskId: string,
    data: {
      title?: string;
      category?: string;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      status?: 'pending' | 'in_progress' | 'complete' | 'blocked';
      dueDate?: Date | string;
      assignedTo?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; data: DDTask }> {
    try {
      const response = await apiClient.patch(`/api/v1/dd-checklists/tasks/${taskId}`, data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to update task:', error);
      throw new Error(error.response?.data?.error || 'Failed to update task');
    }
  },

  /**
   * Add a new task to the checklist
   */
  async addTask(taskData: CreateTaskData): Promise<{ success: boolean; data: DDTask }> {
    try {
      const response = await apiClient.post('/api/v1/dd-checklists/tasks', taskData);
      return response.data;
    } catch (error: any) {
      console.error('Failed to add task:', error);
      throw new Error(error.response?.data?.error || 'Failed to add task');
    }
  },

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.delete(`/api/v1/dd-checklists/tasks/${taskId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to delete task:', error);
      throw new Error(error.response?.data?.error || 'Failed to delete task');
    }
  },

  /**
   * Toggle task completion (convenience method)
   */
  async toggleTaskCompletion(taskId: string, currentStatus: string): Promise<{ success: boolean; data: DDTask }> {
    const newStatus = currentStatus === 'complete' ? 'pending' : 'complete';
    return this.updateTaskStatus(taskId, newStatus);
  },

  /**
   * Get or create checklist for a deal
   * Useful for ensuring a checklist exists before adding tasks
   */
  async getOrCreateChecklist(dealId: string, checklistType: string = 'standard'): Promise<ChecklistWithTasks> {
    try {
      // Try to get existing checklist
      const response = await this.getChecklist(dealId);
      return response.data;
    } catch (error: any) {
      // If not found, create new one
      if (error.message.includes('not found')) {
        await this.createChecklist(dealId, checklistType);
        const response = await this.getChecklist(dealId);
        return response.data;
      }
      throw error;
    }
  },

  /**
   * Bulk update task statuses
   * Useful for marking multiple tasks as complete at once
   */
  async bulkUpdateStatus(
    taskIds: string[],
    status: 'pending' | 'in-progress' | 'in_progress' | 'complete' | 'blocked'
  ): Promise<void> {
    try {
      const promises = taskIds.map(id => this.updateTaskStatus(id, status));
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to bulk update tasks:', error);
      throw error;
    }
  }
};
