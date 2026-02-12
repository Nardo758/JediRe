export type TaskCategory =
  | 'due_diligence'
  | 'financing'
  | 'legal'
  | 'construction'
  | 'leasing'
  | 'property_management'
  | 'reporting'
  | 'communication'
  | 'analysis'
  | 'other';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';

export interface Task {
  id: number;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  dealId?: number;
  propertyId?: number;
  emailId?: string;
  assignedToId?: number;
  createdById?: number;
  dueDate?: string;
  completedAt?: string;
  source: string;
  blockedReason?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskStats {
  total: number;
  byStatus: {
    todo: number;
    in_progress: number;
    blocked: number;
    done: number;
    cancelled: number;
  };
  overdue: number;
  dueToday: number;
  dueSoon: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  category: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
  dealId?: number;
  propertyId?: number;
  emailId?: string;
  assignedToId?: number;
  dueDate?: string;
  source?: string;
  tags?: string[];
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  blockedReason?: string;
}
