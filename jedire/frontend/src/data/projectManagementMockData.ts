/**
 * Mock Data for Unified Project Management Section
 * Consolidates Timeline + Due Diligence into integrated task/milestone tracking
 */

import { Milestone, TimelineStat, DeadlineItem } from './timelineMockData';
import { DDChecklistItem, DDStat } from './dueDiligenceMockData';

// ==================== UNIFIED TYPES ====================

export interface ProjectTask extends Omit<DDChecklistItem, 'id'>, Partial<Milestone> {
  id: string;
  type: 'checklist' | 'milestone' | 'deadline';
  
  // From DDChecklistItem (task properties)
  category: 'legal' | 'financial' | 'physical' | 'environmental';
  title: string;
  description: string;
  status: 'complete' | 'in-progress' | 'pending' | 'blocked' | 'completed' | 'upcoming' | 'overdue' | 'at-risk';
  assignee: string;
  dueDate: string;
  completedDate?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  
  // Timeline/Gantt properties
  startDate?: string;
  endDate?: string;
  progress?: number; // 0-100
  
  // Dependencies
  dependencies?: string[];
  blockedBy?: string[];
  blocking?: string[];
  
  // Metadata
  isCriticalPath: boolean;
  redFlag?: {
    severity: 'high' | 'medium' | 'low';
    description: string;
    status: 'open' | 'resolved' | 'monitoring';
  };
  documents: {
    name: string;
    url: string;
    uploadedAt: string;
  }[];
  notes?: string;
  
  // Contextual (pipeline vs portfolio)
  isPipelineTask?: boolean;
  isOperationalTask?: boolean;
}

export interface ProjectOverview {
  // Progress metrics
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  
  completionPercentage: number;
  
  // Timeline metrics
  daysToClosing?: number;
  daysSinceAcquisition?: number;
  targetDate?: string;
  
  // Critical path
  criticalPathTasks: ProjectTask[];
  blockers: ProjectTask[];
  
  // Recent activity
  recentCompletions: ProjectTask[];
  upcomingDeadlines: ProjectTask[];
  
  // Category breakdown
  categoryProgress: {
    category: string;
    label: string;
    total: number;
    completed: number;
    percentage: number;
    color: string;
  }[];
}

export interface ProjectDependency {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish';
  lag?: number; // days
}

// ==================== ACQUISITION MODE DATA ====================

export const acquisitionProjectTasks: ProjectTask[] = [
  // LEGAL TASKS
  {
    id: 'pm-legal-1',
    type: 'checklist',
    category: 'legal',
    title: 'Title Search & Insurance',
    description: 'Complete title search and secure title insurance commitment',
    status: 'complete',
    assignee: 'Emily Chen',
    dueDate: '2024-02-15',
    startDate: '2024-02-05',
    completedDate: '2024-02-14',
    priority: 'critical',
    progress: 100,
    isCriticalPath: true,
    isPipelineTask: true,
    documents: [
      { name: 'Title_Report_Final.pdf', url: '/docs/title', uploadedAt: '2024-02-14' }
    ]
  },
  {
    id: 'pm-legal-2',
    type: 'checklist',
    category: 'legal',
    title: 'Purchase Agreement Review',
    description: 'Legal review of purchase and sale agreement',
    status: 'complete',
    assignee: 'Emily Chen',
    dueDate: '2024-02-10',
    startDate: '2024-02-01',
    completedDate: '2024-02-09',
    priority: 'critical',
    progress: 100,
    isCriticalPath: true,
    isPipelineTask: true,
    documents: [
      { name: 'PSA_Executed.pdf', url: '/docs/legal', uploadedAt: '2024-02-09' }
    ]
  },
  {
    id: 'pm-legal-3',
    type: 'checklist',
    category: 'legal',
    title: 'Tenant Lease Review',
    description: 'Review all existing tenant leases and amendments',
    status: 'in-progress',
    assignee: 'Emily Chen',
    dueDate: '2024-02-25',
    startDate: '2024-02-10',
    priority: 'critical',
    progress: 65,
    isCriticalPath: true,
    isPipelineTask: true,
    dependencies: ['pm-financial-1'],
    redFlag: {
      severity: 'medium',
      description: 'Missing 3 tenant estoppels - tenants not responding',
      status: 'open'
    },
    documents: [
      { name: 'Rent_Roll_Current.xlsx', url: '/docs/leases', uploadedAt: '2024-02-10' }
    ]
  },
  {
    id: 'pm-legal-4',
    type: 'milestone',
    category: 'legal',
    title: 'Purchase Agreement Executed',
    description: 'Final purchase and sale agreement signed',
    status: 'upcoming',
    assignee: 'Emily Chen',
    dueDate: '2024-03-05',
    startDate: '2024-03-05',
    priority: 'critical',
    progress: 0,
    isCriticalPath: true,
    isPipelineTask: true,
    dependencies: ['pm-financial-4'],
    documents: []
  },

  // FINANCIAL TASKS
  {
    id: 'pm-financial-1',
    type: 'checklist',
    category: 'financial',
    title: 'Rent Roll Analysis',
    description: 'Analyze current rent roll and lease expirations',
    status: 'complete',
    assignee: 'Sarah Johnson',
    dueDate: '2024-02-12',
    startDate: '2024-02-05',
    completedDate: '2024-02-11',
    priority: 'critical',
    progress: 100,
    isCriticalPath: true,
    isPipelineTask: true,
    documents: [
      { name: 'Rent_Roll_Analysis.xlsx', url: '/docs/financial', uploadedAt: '2024-02-11' }
    ]
  },
  {
    id: 'pm-financial-2',
    type: 'checklist',
    category: 'financial',
    title: 'Historical Financials Review',
    description: 'Review 3 years of operating statements and tax returns',
    status: 'in-progress',
    assignee: 'Sarah Johnson',
    dueDate: '2024-02-22',
    startDate: '2024-02-08',
    priority: 'critical',
    progress: 75,
    isCriticalPath: true,
    isPipelineTask: true,
    documents: [
      { name: 'P&L_2021-2023.pdf', url: '/docs/financial', uploadedAt: '2024-02-08' }
    ],
    notes: 'Waiting on 2023 tax return from seller'
  },
  {
    id: 'pm-financial-3',
    type: 'checklist',
    category: 'financial',
    title: 'Loan Application Submitted',
    description: 'Full loan package submitted to lender',
    status: 'in-progress',
    assignee: 'Capital Markets',
    dueDate: '2024-02-15',
    startDate: '2024-02-10',
    priority: 'critical',
    progress: 85,
    isCriticalPath: true,
    isPipelineTask: true,
    dependencies: ['pm-financial-1', 'pm-financial-2'],
    documents: []
  },
  {
    id: 'pm-financial-4',
    type: 'milestone',
    category: 'financial',
    title: 'Loan Approval',
    description: 'Final loan committee approval received',
    status: 'upcoming',
    assignee: 'Capital Markets',
    dueDate: '2024-02-28',
    startDate: '2024-02-28',
    priority: 'critical',
    progress: 0,
    isCriticalPath: true,
    isPipelineTask: true,
    dependencies: ['pm-financial-3', 'pm-physical-1'],
    documents: []
  },

  // PHYSICAL TASKS
  {
    id: 'pm-physical-1',
    type: 'checklist',
    category: 'physical',
    title: 'Property Condition Assessment',
    description: 'Complete third-party PCA inspection',
    status: 'in-progress',
    assignee: 'Marcus Williams',
    dueDate: '2024-02-24',
    startDate: '2024-02-10',
    priority: 'critical',
    progress: 60,
    isCriticalPath: true,
    isPipelineTask: true,
    documents: [
      { name: 'PCA_Proposal.pdf', url: '/docs/inspection', uploadedAt: '2024-02-10' }
    ],
    notes: 'Inspection scheduled for Feb 18'
  },
  {
    id: 'pm-physical-2',
    type: 'checklist',
    category: 'physical',
    title: 'Survey Review',
    description: 'Obtain and review ALTA survey',
    status: 'complete',
    assignee: 'John Smith',
    dueDate: '2024-02-16',
    startDate: '2024-02-08',
    completedDate: '2024-02-15',
    priority: 'critical',
    progress: 100,
    isCriticalPath: true,
    isPipelineTask: true,
    documents: [
      { name: 'ALTA_Survey.pdf', url: '/docs/survey', uploadedAt: '2024-02-15' }
    ]
  },
  {
    id: 'pm-physical-3',
    type: 'milestone',
    category: 'physical',
    title: 'Final Walk-Through',
    description: 'Pre-closing property inspection',
    status: 'upcoming',
    assignee: 'Property Manager',
    dueDate: '2024-03-20',
    startDate: '2024-03-20',
    priority: 'high',
    progress: 0,
    isCriticalPath: false,
    isPipelineTask: true,
    dependencies: ['pm-physical-1'],
    documents: []
  },

  // ENVIRONMENTAL TASKS
  {
    id: 'pm-env-1',
    type: 'checklist',
    category: 'environmental',
    title: 'Phase I Environmental Assessment',
    description: 'Complete Phase I ESA per ASTM standards',
    status: 'complete',
    assignee: 'Environmental Consultant',
    dueDate: '2024-02-18',
    startDate: '2024-02-05',
    completedDate: '2024-02-17',
    priority: 'critical',
    progress: 100,
    isCriticalPath: true,
    isPipelineTask: true,
    redFlag: {
      severity: 'high',
      description: 'Phase I identified potential underground storage tank - Phase II recommended',
      status: 'open'
    },
    documents: [
      { name: 'Phase_I_ESA_Report.pdf', url: '/docs/environmental', uploadedAt: '2024-02-17' }
    ]
  },
  {
    id: 'pm-env-2',
    type: 'checklist',
    category: 'environmental',
    title: 'Phase II Environmental (if needed)',
    description: 'Conduct Phase II testing based on Phase I findings',
    status: 'blocked',
    assignee: 'Environmental Consultant',
    dueDate: '2024-03-05',
    startDate: '2024-02-20',
    priority: 'critical',
    progress: 0,
    isCriticalPath: true,
    isPipelineTask: true,
    blockedBy: ['pm-env-1'],
    documents: [],
    notes: 'Blocked pending Phase I review and seller response'
  },

  // CLOSING MILESTONE
  {
    id: 'pm-closing',
    type: 'milestone',
    category: 'legal',
    title: 'Closing',
    description: 'Final closing and fund transfer',
    status: 'upcoming',
    assignee: 'John Smith',
    dueDate: '2024-03-25',
    startDate: '2024-03-25',
    priority: 'critical',
    progress: 0,
    isCriticalPath: true,
    isPipelineTask: true,
    dependencies: ['pm-legal-4', 'pm-physical-3'],
    documents: []
  }
];

export const acquisitionOverview: ProjectOverview = {
  totalTasks: acquisitionProjectTasks.length,
  completedTasks: acquisitionProjectTasks.filter(t => t.status === 'complete' || t.status === 'completed').length,
  inProgressTasks: acquisitionProjectTasks.filter(t => t.status === 'in-progress').length,
  overdueTasks: 0,
  blockedTasks: acquisitionProjectTasks.filter(t => t.status === 'blocked').length,
  completionPercentage: Math.round((acquisitionProjectTasks.filter(t => t.status === 'complete' || t.status === 'completed').length / acquisitionProjectTasks.length) * 100),
  daysToClosing: 42,
  targetDate: '2024-03-25',
  criticalPathTasks: acquisitionProjectTasks.filter(t => t.isCriticalPath && t.status !== 'complete' && t.status !== 'completed').slice(0, 5),
  blockers: acquisitionProjectTasks.filter(t => t.status === 'blocked' || t.redFlag?.status === 'open'),
  recentCompletions: acquisitionProjectTasks.filter(t => t.status === 'complete' || t.status === 'completed').slice(-5),
  upcomingDeadlines: acquisitionProjectTasks.filter(t => t.status !== 'complete' && t.status !== 'completed').slice(0, 5),
  categoryProgress: [
    {
      category: 'legal',
      label: 'Legal',
      total: acquisitionProjectTasks.filter(t => t.category === 'legal').length,
      completed: acquisitionProjectTasks.filter(t => t.category === 'legal' && (t.status === 'complete' || t.status === 'completed')).length,
      percentage: Math.round((acquisitionProjectTasks.filter(t => t.category === 'legal' && (t.status === 'complete' || t.status === 'completed')).length / acquisitionProjectTasks.filter(t => t.category === 'legal').length) * 100),
      color: 'bg-blue-600'
    },
    {
      category: 'financial',
      label: 'Financial',
      total: acquisitionProjectTasks.filter(t => t.category === 'financial').length,
      completed: acquisitionProjectTasks.filter(t => t.category === 'financial' && (t.status === 'complete' || t.status === 'completed')).length,
      percentage: Math.round((acquisitionProjectTasks.filter(t => t.category === 'financial' && (t.status === 'complete' || t.status === 'completed')).length / acquisitionProjectTasks.filter(t => t.category === 'financial').length) * 100),
      color: 'bg-green-600'
    },
    {
      category: 'physical',
      label: 'Physical',
      total: acquisitionProjectTasks.filter(t => t.category === 'physical').length,
      completed: acquisitionProjectTasks.filter(t => t.category === 'physical' && (t.status === 'complete' || t.status === 'completed')).length,
      percentage: Math.round((acquisitionProjectTasks.filter(t => t.category === 'physical' && (t.status === 'complete' || t.status === 'completed')).length / acquisitionProjectTasks.filter(t => t.category === 'physical').length) * 100),
      color: 'bg-purple-600'
    },
    {
      category: 'environmental',
      label: 'Environmental',
      total: acquisitionProjectTasks.filter(t => t.category === 'environmental').length,
      completed: acquisitionProjectTasks.filter(t => t.category === 'environmental' && (t.status === 'complete' || t.status === 'completed')).length,
      percentage: Math.round((acquisitionProjectTasks.filter(t => t.category === 'environmental' && (t.status === 'complete' || t.status === 'completed')).length / acquisitionProjectTasks.filter(t => t.category === 'environmental').length) * 100),
      color: 'bg-orange-600'
    }
  ]
};

// ==================== PERFORMANCE MODE DATA ====================

export const performanceProjectTasks: ProjectTask[] = [
  // Operational tasks for owned assets
  {
    id: 'pm-ops-1',
    type: 'checklist',
    category: 'legal',
    title: 'Annual Insurance Review',
    description: 'Review and renew property insurance policies',
    status: 'complete',
    assignee: 'Jennifer Lee',
    dueDate: '2024-02-01',
    startDate: '2024-01-15',
    completedDate: '2024-01-28',
    priority: 'critical',
    progress: 100,
    isCriticalPath: false,
    isOperationalTask: true,
    documents: [
      { name: 'Insurance_Renewal_2024.pdf', url: '/docs/insurance', uploadedAt: '2024-01-28' }
    ]
  },
  {
    id: 'pm-ops-2',
    type: 'checklist',
    category: 'physical',
    title: 'Unit 205 Renovation',
    description: 'Full unit renovation for re-lease',
    status: 'in-progress',
    assignee: 'Property Manager',
    dueDate: '2024-02-20',
    startDate: '2024-02-05',
    priority: 'high',
    progress: 80,
    isCriticalPath: false,
    isOperationalTask: true,
    documents: [],
    notes: '80% complete, on schedule'
  },
  {
    id: 'pm-ops-3',
    type: 'milestone',
    category: 'legal',
    title: 'Lease Renewal - Unit 310 (TechCorp)',
    description: '5,200 SF office lease expiring',
    status: 'upcoming',
    assignee: 'Leasing Agent',
    dueDate: '2024-03-31',
    startDate: '2024-03-15',
    priority: 'critical',
    progress: 0,
    isCriticalPath: true,
    isOperationalTask: true,
    documents: [],
    notes: 'Tenant indicated interest in renewal'
  },
  {
    id: 'pm-ops-4',
    type: 'checklist',
    category: 'physical',
    title: 'Elevator Modernization',
    description: 'Major elevator system upgrade',
    status: 'upcoming',
    assignee: 'Property Manager',
    dueDate: '2024-05-01',
    startDate: '2024-04-15',
    priority: 'critical',
    progress: 0,
    isCriticalPath: true,
    isOperationalTask: true,
    documents: [],
    notes: '$280K budgeted, planning phase'
  },
  {
    id: 'pm-ops-5',
    type: 'checklist',
    category: 'financial',
    title: 'Monthly Financial Close',
    description: 'Complete monthly financial statements and variance analysis',
    status: 'complete',
    assignee: 'Finance Team',
    dueDate: '2024-02-10',
    startDate: '2024-02-05',
    completedDate: '2024-02-09',
    priority: 'critical',
    progress: 100,
    isCriticalPath: false,
    isOperationalTask: true,
    documents: [
      { name: 'January_2024_Financials.pdf', url: '/docs/financials', uploadedAt: '2024-02-09' }
    ]
  }
];

export const performanceOverview: ProjectOverview = {
  totalTasks: performanceProjectTasks.length,
  completedTasks: performanceProjectTasks.filter(t => t.status === 'complete' || t.status === 'completed').length,
  inProgressTasks: performanceProjectTasks.filter(t => t.status === 'in-progress').length,
  overdueTasks: 0,
  blockedTasks: 0,
  completionPercentage: Math.round((performanceProjectTasks.filter(t => t.status === 'complete' || t.status === 'completed').length / performanceProjectTasks.length) * 100),
  daysSinceAcquisition: 487,
  criticalPathTasks: performanceProjectTasks.filter(t => t.isCriticalPath && t.status !== 'complete' && t.status !== 'completed'),
  blockers: [],
  recentCompletions: performanceProjectTasks.filter(t => t.status === 'complete' || t.status === 'completed').slice(-5),
  upcomingDeadlines: performanceProjectTasks.filter(t => t.status !== 'complete' && t.status !== 'completed').slice(0, 5),
  categoryProgress: [
    {
      category: 'legal',
      label: 'Legal',
      total: performanceProjectTasks.filter(t => t.category === 'legal').length,
      completed: performanceProjectTasks.filter(t => t.category === 'legal' && (t.status === 'complete' || t.status === 'completed')).length,
      percentage: Math.round((performanceProjectTasks.filter(t => t.category === 'legal' && (t.status === 'complete' || t.status === 'completed')).length / performanceProjectTasks.filter(t => t.category === 'legal').length) * 100),
      color: 'bg-blue-600'
    },
    {
      category: 'financial',
      label: 'Financial',
      total: performanceProjectTasks.filter(t => t.category === 'financial').length,
      completed: performanceProjectTasks.filter(t => t.category === 'financial' && (t.status === 'complete' || t.status === 'completed')).length,
      percentage: Math.round((performanceProjectTasks.filter(t => t.category === 'financial' && (t.status === 'complete' || t.status === 'completed')).length / performanceProjectTasks.filter(t => t.category === 'financial').length) * 100),
      color: 'bg-green-600'
    },
    {
      category: 'physical',
      label: 'Physical',
      total: performanceProjectTasks.filter(t => t.category === 'physical').length,
      completed: performanceProjectTasks.filter(t => t.category === 'physical' && (t.status === 'complete' || t.status === 'completed')).length,
      percentage: Math.round((performanceProjectTasks.filter(t => t.category === 'physical' && (t.status === 'complete' || t.status === 'completed')).length / performanceProjectTasks.filter(t => t.category === 'physical').length) * 100),
      color: 'bg-purple-600'
    },
    {
      category: 'environmental',
      label: 'Environmental',
      total: performanceProjectTasks.filter(t => t.category === 'environmental').length,
      completed: performanceProjectTasks.filter(t => t.category === 'environmental' && (t.status === 'complete' || t.status === 'completed')).length,
      percentage: 100,
      color: 'bg-orange-600'
    }
  ]
};
