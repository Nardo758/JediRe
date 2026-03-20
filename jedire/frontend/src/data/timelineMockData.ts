/**
 * Mock Data for Timeline/Milestones Section
 * Provides realistic data for both acquisition and performance modes
 */

export interface TimelineStat {
  label: string;
  value: string | number;
  icon: string;
  format?: 'days' | 'percentage' | 'number' | 'text';
  subtext?: string;
  status?: 'success' | 'warning' | 'danger' | 'info';
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
  status: 'completed' | 'in-progress' | 'upcoming' | 'overdue' | 'at-risk';
  category: 'critical' | 'standard' | 'optional';
  description?: string;
  owner?: string;
  daysUntil?: number;
  completedDate?: string;
  notes?: string;
  dependencies?: string[];
}

export interface DeadlineItem {
  id: string;
  title: string;
  date: string;
  daysUntil: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  status: 'upcoming' | 'due-soon' | 'overdue';
  owner: string;
  completionPercent?: number;
}

export interface TimelineEvent {
  id: string;
  title: string;
  date: string;
  type: 'milestone' | 'deadline' | 'meeting' | 'document' | 'inspection' | 'lease' | 'capex';
  status: 'completed' | 'in-progress' | 'upcoming';
  isPast: boolean;
  description?: string;
}

// ==================== ACQUISITION MODE DATA ====================

export const acquisitionTimelineStats: TimelineStat[] = [
  {
    label: 'Days to Close',
    value: 42,
    icon: '📅',
    format: 'days',
    status: 'info',
    subtext: 'Target: Mar 25, 2024'
  },
  {
    label: 'Milestones Complete',
    value: 12,
    icon: '✅',
    format: 'number',
    subtext: '12 of 18 total',
    status: 'success'
  },
  {
    label: 'Upcoming Deadlines',
    value: 4,
    icon: '⏰',
    format: 'number',
    subtext: 'Next 30 days',
    status: 'warning'
  },
  {
    label: 'Critical Path Items',
    value: 2,
    icon: '🎯',
    format: 'number',
    subtext: 'Require attention',
    status: 'danger'
  },
  {
    label: 'Overall Progress',
    value: 67,
    icon: '📊',
    format: 'percentage',
    subtext: 'On track',
    status: 'success'
  }
];

export const acquisitionMilestones: Milestone[] = [
  // COMPLETED
  {
    id: 'acq-1',
    title: 'Initial Offer Submitted',
    date: '2024-01-05',
    status: 'completed',
    category: 'critical',
    description: 'Purchase offer of $45M submitted to seller',
    owner: 'John Smith',
    completedDate: '2024-01-05',
    notes: 'Offer accepted within 48 hours'
  },
  {
    id: 'acq-2',
    title: 'Letter of Intent Executed',
    date: '2024-01-10',
    status: 'completed',
    category: 'critical',
    description: 'LOI signed with 60-day due diligence period',
    owner: 'Sarah Johnson',
    completedDate: '2024-01-10'
  },
  {
    id: 'acq-3',
    title: 'Earnest Money Deposited',
    date: '2024-01-12',
    status: 'completed',
    category: 'critical',
    description: '$500K earnest money deposited into escrow',
    owner: 'Finance Team',
    completedDate: '2024-01-12'
  },
  {
    id: 'acq-4',
    title: 'Phase I Environmental Ordered',
    date: '2024-01-15',
    status: 'completed',
    category: 'standard',
    description: 'Environmental assessment initiated',
    owner: 'Operations',
    completedDate: '2024-01-15'
  },
  {
    id: 'acq-5',
    title: 'Property Inspection Complete',
    date: '2024-01-20',
    status: 'completed',
    category: 'standard',
    description: 'Full property inspection and condition report',
    owner: 'Property Manager',
    completedDate: '2024-01-22',
    notes: 'Minor repairs needed ($85K estimated)'
  },
  {
    id: 'acq-6',
    title: 'Rent Roll Analysis',
    date: '2024-01-22',
    status: 'completed',
    category: 'standard',
    description: 'Detailed rent roll and lease audit',
    owner: 'Asset Management',
    completedDate: '2024-01-23'
  },
  {
    id: 'acq-7',
    title: 'Title Report Received',
    date: '2024-01-25',
    status: 'completed',
    category: 'critical',
    description: 'Title commitment and exception review',
    owner: 'Legal',
    completedDate: '2024-01-26',
    notes: 'Two easements need clarification'
  },
  {
    id: 'acq-8',
    title: 'Initial Underwriting Model',
    date: '2024-01-28',
    status: 'completed',
    category: 'critical',
    description: 'Financial model and pro forma completed',
    owner: 'John Smith',
    completedDate: '2024-01-30'
  },
  {
    id: 'acq-9',
    title: 'Lender Term Sheet',
    date: '2024-02-01',
    status: 'completed',
    category: 'critical',
    description: 'Debt financing term sheet received',
    owner: 'Capital Markets',
    completedDate: '2024-02-02',
    notes: '70% LTV at 4.5% rate'
  },
  {
    id: 'acq-10',
    title: 'Survey Complete',
    date: '2024-02-05',
    status: 'completed',
    category: 'standard',
    description: 'Updated ALTA survey received',
    owner: 'Operations',
    completedDate: '2024-02-06'
  },
  {
    id: 'acq-11',
    title: 'Phase I Environmental Clear',
    date: '2024-02-08',
    status: 'completed',
    category: 'critical',
    description: 'Environmental report shows no issues',
    owner: 'Operations',
    completedDate: '2024-02-08'
  },
  {
    id: 'acq-12',
    title: 'Tenant Estoppels Received',
    date: '2024-02-10',
    status: 'completed',
    category: 'standard',
    description: 'Estoppel certificates from all major tenants',
    owner: 'Asset Management',
    completedDate: '2024-02-12',
    notes: '18 of 20 tenants responded'
  },

  // IN PROGRESS
  {
    id: 'acq-13',
    title: 'Loan Application Submitted',
    date: '2024-02-15',
    status: 'in-progress',
    category: 'critical',
    description: 'Full loan package submitted to lender',
    owner: 'Capital Markets',
    daysUntil: 3,
    dependencies: ['acq-9']
  },
  {
    id: 'acq-14',
    title: 'Property Appraisal',
    date: '2024-02-18',
    status: 'in-progress',
    category: 'critical',
    description: 'Third-party appraisal ordered by lender',
    owner: 'Lender',
    daysUntil: 6,
    dependencies: ['acq-13']
  },

  // UPCOMING - CRITICAL PATH
  {
    id: 'acq-15',
    title: 'Loan Approval',
    date: '2024-02-28',
    status: 'upcoming',
    category: 'critical',
    description: 'Final loan committee approval',
    owner: 'Capital Markets',
    daysUntil: 16,
    dependencies: ['acq-13', 'acq-14']
  },
  {
    id: 'acq-16',
    title: 'Purchase Agreement Executed',
    date: '2024-03-05',
    status: 'upcoming',
    category: 'critical',
    description: 'Final purchase and sale agreement',
    owner: 'Legal',
    daysUntil: 21,
    dependencies: ['acq-15']
  },
  {
    id: 'acq-17',
    title: 'Final Walk-Through',
    date: '2024-03-20',
    status: 'upcoming',
    category: 'standard',
    description: 'Pre-closing property inspection',
    owner: 'Property Manager',
    daysUntil: 36
  },
  {
    id: 'acq-18',
    title: 'Closing',
    date: '2024-03-25',
    status: 'upcoming',
    category: 'critical',
    description: 'Final closing and fund transfer',
    owner: 'John Smith',
    daysUntil: 42,
    dependencies: ['acq-16', 'acq-17']
  }
];

export const acquisitionDeadlines: DeadlineItem[] = [
  {
    id: 'dl-1',
    title: 'Loan Application Documents',
    date: '2024-02-16',
    daysUntil: 4,
    priority: 'critical',
    category: 'Financing',
    status: 'due-soon',
    owner: 'Capital Markets',
    completionPercent: 85
  },
  {
    id: 'dl-2',
    title: 'Tenant Estoppel Follow-ups',
    date: '2024-02-17',
    daysUntil: 5,
    priority: 'high',
    category: 'Due Diligence',
    status: 'due-soon',
    owner: 'Asset Management',
    completionPercent: 70
  },
  {
    id: 'dl-3',
    title: 'Title Exception Review',
    date: '2024-02-20',
    daysUntil: 8,
    priority: 'high',
    category: 'Legal',
    status: 'upcoming',
    owner: 'Legal',
    completionPercent: 45
  },
  {
    id: 'dl-4',
    title: 'Insurance Quotes',
    date: '2024-02-25',
    daysUntil: 13,
    priority: 'medium',
    category: 'Operations',
    status: 'upcoming',
    owner: 'Risk Management',
    completionPercent: 30
  }
];

// ==================== PERFORMANCE MODE DATA ====================

export const performanceTimelineStats: TimelineStat[] = [
  {
    label: 'Days Since Acquisition',
    value: 487,
    icon: '📆',
    format: 'days',
    status: 'info',
    subtext: 'Acquired: Jan 2023'
  },
  {
    label: 'Active Milestones',
    value: 8,
    icon: '🎯',
    format: 'number',
    subtext: '3 critical',
    status: 'warning'
  },
  {
    label: 'Leases Expiring',
    value: 5,
    icon: '📋',
    format: 'number',
    subtext: 'Next 90 days',
    status: 'warning'
  },
  {
    label: 'Capex Projects',
    value: 3,
    icon: '🔧',
    format: 'number',
    subtext: 'In progress',
    status: 'info'
  },
  {
    label: 'Performance Score',
    value: 92,
    icon: '⭐',
    format: 'number',
    subtext: 'vs target',
    status: 'success'
  }
];

export const performanceMilestones: Milestone[] = [
  // COMPLETED PAST EVENTS
  {
    id: 'perf-1',
    title: 'Property Acquisition Closed',
    date: '2023-01-15',
    status: 'completed',
    category: 'critical',
    description: 'Successfully acquired property',
    owner: 'Acquisitions Team',
    completedDate: '2023-01-15'
  },
  {
    id: 'perf-2',
    title: 'Property Management Transition',
    date: '2023-02-01',
    status: 'completed',
    category: 'critical',
    description: 'Onboarded new PM team',
    owner: 'Operations',
    completedDate: '2023-02-01'
  },
  {
    id: 'perf-3',
    title: 'Roof Replacement - Building A',
    date: '2023-06-15',
    status: 'completed',
    category: 'standard',
    description: 'Major capex project completed',
    owner: 'Property Manager',
    completedDate: '2023-06-20',
    notes: '$180K budget, completed on time'
  },
  {
    id: 'perf-4',
    title: 'Parking Lot Resurfacing',
    date: '2023-09-10',
    status: 'completed',
    category: 'standard',
    description: 'Parking lot renovation',
    owner: 'Property Manager',
    completedDate: '2023-09-12'
  },
  {
    id: 'perf-5',
    title: 'Q4 2023 Rent Increases',
    date: '2023-10-01',
    status: 'completed',
    category: 'standard',
    description: '3.5% rent increases implemented',
    owner: 'Asset Management',
    completedDate: '2023-10-01',
    notes: '85% tenant acceptance rate'
  },
  {
    id: 'perf-6',
    title: 'HVAC System Upgrade',
    date: '2023-11-30',
    status: 'completed',
    category: 'standard',
    description: 'Central HVAC modernization',
    owner: 'Property Manager',
    completedDate: '2023-12-05'
  },

  // IN PROGRESS
  {
    id: 'perf-7',
    title: 'Unit 205 Renovation',
    date: '2024-02-20',
    status: 'in-progress',
    category: 'standard',
    description: 'Full unit renovation for re-lease',
    owner: 'Property Manager',
    daysUntil: 8,
    notes: '80% complete, on schedule'
  },
  {
    id: 'perf-8',
    title: 'Fitness Center Expansion',
    date: '2024-03-15',
    status: 'in-progress',
    category: 'standard',
    description: 'Amenity upgrade project',
    owner: 'Asset Management',
    daysUntil: 31,
    notes: '$125K budget, 60% complete'
  },
  {
    id: 'perf-9',
    title: 'Annual Property Inspection',
    date: '2024-02-28',
    status: 'in-progress',
    category: 'critical',
    description: 'Comprehensive property inspection',
    owner: 'Operations',
    daysUntil: 16
  },

  // UPCOMING - LEASE EXPIRATIONS
  {
    id: 'perf-10',
    title: 'Lease Renewal - Unit 310 (TechCorp)',
    date: '2024-03-31',
    status: 'upcoming',
    category: 'critical',
    description: '5,200 SF office lease expiring',
    owner: 'Leasing Agent',
    daysUntil: 47,
    notes: 'Tenant indicated interest in renewal'
  },
  {
    id: 'perf-11',
    title: 'Lease Renewal - Unit 102 (RetailCo)',
    date: '2024-04-15',
    status: 'upcoming',
    category: 'critical',
    description: '2,800 SF retail lease expiring',
    owner: 'Leasing Agent',
    daysUntil: 62,
    notes: 'Negotiations in progress'
  },
  {
    id: 'perf-12',
    title: 'Lease Renewal - Unit 405 (StartupX)',
    date: '2024-04-30',
    status: 'upcoming',
    category: 'standard',
    description: '3,100 SF office lease expiring',
    owner: 'Leasing Agent',
    daysUntil: 77
  },

  // UPCOMING - CAPEX PROJECTS
  {
    id: 'perf-13',
    title: 'Elevator Modernization',
    date: '2024-05-01',
    status: 'upcoming',
    category: 'critical',
    description: 'Major elevator system upgrade',
    owner: 'Property Manager',
    daysUntil: 78,
    notes: '$280K budgeted, planning phase'
  },
  {
    id: 'perf-14',
    title: 'Building Exterior Painting',
    date: '2024-06-15',
    status: 'upcoming',
    category: 'standard',
    description: 'Exterior facade refresh',
    owner: 'Property Manager',
    daysUntil: 123
  },
  {
    id: 'perf-15',
    title: 'Landscaping Overhaul',
    date: '2024-07-01',
    status: 'upcoming',
    category: 'optional',
    description: 'Enhanced landscaping and curb appeal',
    owner: 'Property Manager',
    daysUntil: 139
  }
];

export const performanceDeadlines: DeadlineItem[] = [
  {
    id: 'pdl-1',
    title: 'Lease Renewal Decision - Unit 310',
    date: '2024-02-20',
    daysUntil: 8,
    priority: 'critical',
    category: 'Leasing',
    status: 'due-soon',
    owner: 'Leasing Agent',
    completionPercent: 60
  },
  {
    id: 'pdl-2',
    title: 'Q1 2024 Financial Review',
    date: '2024-02-25',
    daysUntil: 13,
    priority: 'high',
    category: 'Finance',
    status: 'upcoming',
    owner: 'Asset Management',
    completionPercent: 40
  },
  {
    id: 'pdl-3',
    title: 'Fire Safety Inspection',
    date: '2024-03-01',
    daysUntil: 17,
    priority: 'critical',
    category: 'Compliance',
    status: 'upcoming',
    owner: 'Property Manager',
    completionPercent: 20
  },
  {
    id: 'pdl-4',
    title: 'Annual Insurance Renewal',
    date: '2024-03-15',
    daysUntil: 31,
    priority: 'high',
    category: 'Operations',
    status: 'upcoming',
    owner: 'Risk Management',
    completionPercent: 55
  },
  {
    id: 'pdl-5',
    title: 'Elevator Permit Application',
    date: '2024-03-20',
    daysUntil: 36,
    priority: 'high',
    category: 'Capex',
    status: 'upcoming',
    owner: 'Property Manager',
    completionPercent: 30
  }
];

// ==================== TIMELINE EVENTS (FOR GANTT VIEW) ====================

export const acquisitionTimelineEvents: TimelineEvent[] = acquisitionMilestones.map(m => ({
  id: m.id,
  title: m.title,
  date: m.date,
  type: 'milestone',
  status: m.status,
  isPast: m.status === 'completed',
  description: m.description
}));

export const performanceTimelineEvents: TimelineEvent[] = performanceMilestones.map(m => ({
  id: m.id,
  title: m.title,
  date: m.date,
  type: m.title.includes('Lease') ? 'lease' : m.title.includes('Renovation') || m.title.includes('Upgrade') ? 'capex' : 'milestone',
  status: m.status,
  isPast: m.status === 'completed',
  description: m.description
}));
