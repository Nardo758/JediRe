export type TaskCategory =
  | 'due_diligence'
  | 'financing'
  | 'legal'
  | 'construction'
  | 'leasing'
  | 'property_management'
  | 'operations'
  | 'investor_relations'
  | 'reporting'
  | 'communication'
  | 'analysis'
  | 'other';

export type TaskPriority = 'low' | 'medium' | 'high';

export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'complete';

export interface LinkedEntity {
  type: 'pipeline-deal' | 'assets-owned-property' | 'global';
  id: string;
  name: string;
}

export interface AssignedTo {
  userId: string;
  name: string;
  type: 'user' | 'team-member' | 'external-contact';
}

export interface TaskSource {
  type: 'email' | 'agent-alert' | 'manual';
  referenceId?: string;
  sourceUrl?: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  comment: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  filename: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  createdAt: string;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  
  // Routing
  linkedEntity: LinkedEntity;
  
  // Categorization
  category: TaskCategory;
  
  // Assignment
  assignedTo: AssignedTo;
  
  // Priority
  priority: TaskPriority;
  priorityScore: number;
  
  // Timing
  createdAt: string;
  dueDate?: string;
  completedAt?: string;
  
  // Source
  source: TaskSource;
  
  // Status
  status: TaskStatus;
  blockedReason?: string;
  
  // Dependencies
  dependencies: string[];
  blocksTaskIds: string[];
  
  // Activity
  comments: TaskComment[];
  attachments: TaskAttachment[];
  activities: TaskActivity[];
}

export interface TaskFilters {
  search?: string;
  status?: TaskStatus[];
  priority?: TaskPriority[];
  category?: TaskCategory[];
  linkedEntityId?: string;
  assignedToId?: string;
  dueDateStart?: string;
  dueDateEnd?: string;
  completedDateStart?: string;
  completedDateEnd?: string;
}

export interface TaskSortConfig {
  field: keyof Task | 'linkedEntity.name' | 'assignedTo.name';
  direction: 'asc' | 'desc';
}

export interface CreateTaskInput {
  name: string;
  description?: string;
  linkedEntity: LinkedEntity;
  category: TaskCategory;
  assignedTo: AssignedTo;
  priority: TaskPriority;
  dueDate?: string;
  source: TaskSource;
}

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  due_diligence: 'Due Diligence',
  financing: 'Financing',
  legal: 'Legal',
  construction: 'Construction',
  leasing: 'Leasing',
  property_management: 'Property Mgmt',
  operations: 'Operations',
  investor_relations: 'Investor Relations',
  reporting: 'Reporting',
  communication: 'Communication',
  analysis: 'Analysis',
  other: 'Other',
};

export const PRIORITY_CONFIG = {
  high: { icon: '🔴', label: 'High', color: 'text-red-600 bg-red-50 border-red-200' },
  medium: { icon: '🟡', label: 'Medium', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  low: { icon: '⚪', label: 'Low', color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

export const STATUS_CONFIG = {
  open: { label: 'Open', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  in_progress: { label: 'In Progress', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  blocked: { label: 'Blocked', color: 'text-red-600 bg-red-50 border-red-200' },
  complete: { label: 'Complete', color: 'text-green-600 bg-green-50 border-green-200' },
};
