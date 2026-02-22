import { Task, TaskFilters, TaskSortConfig, CreateTaskInput, TaskCategory, TaskPriority, TaskStatus } from '../types/task.types';

// Mock deals
const MOCK_DEALS = [
  { id: 'deal-1', name: 'Buckhead Tower Development', type: 'pipeline-deal' },
  { id: 'deal-2', name: 'Midtown Plaza Acquisition', type: 'pipeline-deal' },
  { id: 'deal-3', name: 'Sandy Springs Multifamily', type: 'pipeline-deal' },
  { id: 'deal-4', name: 'Decatur Office Building', type: 'assets-owned-property' },
];

const MOCK_USERS = [
  { id: 'user-1', name: 'Leon D', type: 'user' },
  { id: 'user-2', name: 'Sarah Johnson', type: 'team-member' },
  { id: 'user-3', name: 'Mike Chen', type: 'team-member' },
  { id: 'user-4', name: 'John Smith (Broker)', type: 'external-contact' },
];

// Generate realistic mock tasks
function generateMockTasks(): Task[] {
  const tasks: Task[] = [];
  let taskId = 1;

  // Buckhead Tower Development (Due Diligence Phase)
  tasks.push(
    {
      id: `task-${taskId++}`,
      name: 'Submit Phase I Environmental Report',
      description: 'Phase I environmental assessment required by lender. Report due by Friday to maintain closing timeline.',
      linkedEntity: { type: 'pipeline-deal', id: 'deal-1', name: 'Buckhead Tower Development' },
      category: 'due_diligence',
      assignedTo: { userId: 'user-1', name: 'Leon D', type: 'user' },
      priority: 'high',
      priorityScore: 85,
      createdAt: new Date('2026-02-01').toISOString(),
      dueDate: new Date('2026-02-15').toISOString(),
      source: { type: 'email', referenceId: 'email-101', sourceUrl: '/dashboard/email/101' },
      status: 'open',
      dependencies: [],
      blocksTaskIds: ['task-5'],
      comments: [
        { id: 'c1', taskId: `task-${taskId - 1}`, userId: 'user-2', userName: 'Sarah Johnson', comment: 'Contacted environmental consultant, they can deliver by Feb 14', createdAt: new Date('2026-02-03').toISOString() }
      ],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Schedule Property Inspection',
      description: 'Coordinate with structural engineer for full building inspection. Must complete before end of due diligence period.',
      linkedEntity: { type: 'pipeline-deal', id: 'deal-1', name: 'Buckhead Tower Development' },
      category: 'due_diligence',
      assignedTo: { userId: 'user-2', name: 'Sarah Johnson', type: 'team-member' },
      priority: 'medium',
      priorityScore: 55,
      createdAt: new Date('2026-02-02').toISOString(),
      dueDate: new Date('2026-02-12').toISOString(),
      source: { type: 'manual' },
      status: 'in_progress',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Request Updated Rent Roll',
      description: 'Obtain current rent roll from seller with all lease terms, renewal dates, and tenant payment history.',
      linkedEntity: { type: 'pipeline-deal', id: 'deal-1', name: 'Buckhead Tower Development' },
      category: 'due_diligence',
      assignedTo: { userId: 'user-1', name: 'Leon D', type: 'user' },
      priority: 'high',
      priorityScore: 70,
      createdAt: new Date('2026-01-25').toISOString(),
      dueDate: new Date('2026-02-08').toISOString(),
      source: { type: 'email', referenceId: 'email-95' },
      status: 'complete',
      completedAt: new Date('2026-02-05').toISOString(),
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [
        { id: 'a1', taskId: `task-${taskId - 1}`, filename: 'buckhead-rent-roll-feb-2026.xlsx', fileUrl: '#', uploadedAt: new Date('2026-02-05').toISOString() }
      ],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Submit Loan Application Package',
      description: 'Complete loan application with Regions Bank. Include full financial package, pro forma, and property analysis.',
      linkedEntity: { type: 'pipeline-deal', id: 'deal-1', name: 'Buckhead Tower Development' },
      category: 'financing',
      assignedTo: { userId: 'user-1', name: 'Leon D', type: 'user' },
      priority: 'high',
      priorityScore: 90,
      createdAt: new Date('2026-02-03').toISOString(),
      dueDate: new Date('2026-02-20').toISOString(),
      source: { type: 'manual' },
      status: 'open',
      dependencies: [],
      blocksTaskIds: ['task-6'],
      comments: [],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Order Property Appraisal',
      description: 'Lender requires independent appraisal. Contact approved appraiser list from Regions Bank.',
      linkedEntity: { type: 'pipeline-deal', id: 'deal-1', name: 'Buckhead Tower Development' },
      category: 'financing',
      assignedTo: { userId: 'user-3', name: 'Mike Chen', type: 'team-member' },
      priority: 'high',
      priorityScore: 75,
      createdAt: new Date('2026-02-04').toISOString(),
      dueDate: new Date('2026-02-12').toISOString(),
      source: { type: 'agent-alert', referenceId: 'alert-12' },
      status: 'blocked',
      blockedReason: 'Waiting for Phase I environmental clearance before appraisal can proceed',
      dependencies: ['task-1'],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Complete Rate Lock with Lender',
      description: 'Lock interest rate at 6.25% before market moves higher. Rate lock expires in 48 hours.',
      linkedEntity: { type: 'pipeline-deal', id: 'deal-1', name: 'Buckhead Tower Development' },
      category: 'financing',
      assignedTo: { userId: 'user-1', name: 'Leon D', type: 'user' },
      priority: 'high',
      priorityScore: 95,
      createdAt: new Date('2026-02-10').toISOString(),
      dueDate: new Date('2026-02-11').toISOString(),
      source: { type: 'email', referenceId: 'email-112' },
      status: 'open',
      dependencies: ['task-4'],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'PSA Review with Attorney',
      description: 'Schedule call with real estate attorney to review Purchase and Sale Agreement. Several terms need negotiation.',
      linkedEntity: { type: 'pipeline-deal', id: 'deal-1', name: 'Buckhead Tower Development' },
      category: 'legal',
      assignedTo: { userId: 'user-1', name: 'Leon D', type: 'user' },
      priority: 'high',
      priorityScore: 80,
      createdAt: new Date('2026-02-05').toISOString(),
      dueDate: new Date('2026-02-18').toISOString(),
      source: { type: 'manual' },
      status: 'in_progress',
      dependencies: [],
      blocksTaskIds: [],
      comments: [
        { id: 'c2', taskId: `task-${taskId - 1}`, userId: 'user-1', userName: 'Leon D', comment: 'Meeting scheduled for Feb 16 at 2pm', createdAt: new Date('2026-02-09').toISOString() }
      ],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Entity Formation for Acquisition',
      description: 'Form new LLC for property acquisition. File with Georgia Secretary of State and obtain EIN.',
      linkedEntity: { type: 'pipeline-deal', id: 'deal-1', name: 'Buckhead Tower Development' },
      category: 'legal',
      assignedTo: { userId: 'user-3', name: 'Mike Chen', type: 'team-member' },
      priority: 'medium',
      priorityScore: 60,
      createdAt: new Date('2026-02-06').toISOString(),
      dueDate: new Date('2026-02-25').toISOString(),
      source: { type: 'manual' },
      status: 'open',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    }
  );

  // Midtown Plaza Acquisition (Early Stage)
  tasks.push(
    {
      id: `task-${taskId++}`,
      name: 'Draft Initial LOI',
      description: 'Prepare Letter of Intent for Midtown Plaza. Offer $8.5M with 60-day due diligence period.',
      linkedEntity: { type: 'pipeline-deal', id: 'deal-2', name: 'Midtown Plaza Acquisition' },
      category: 'legal',
      assignedTo: { userId: 'user-1', name: 'Leon D', type: 'user' },
      priority: 'medium',
      priorityScore: 50,
      createdAt: new Date('2026-02-08').toISOString(),
      dueDate: new Date('2026-02-14').toISOString(),
      source: { type: 'manual' },
      status: 'in_progress',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Initial Market Analysis',
      description: 'Pull comps and analyze submarket rents, vacancy rates, and recent sales. Focus on West Midtown corridor.',
      linkedEntity: { type: 'pipeline-deal', id: 'deal-2', name: 'Midtown Plaza Acquisition' },
      category: 'analysis',
      assignedTo: { userId: 'user-2', name: 'Sarah Johnson', type: 'team-member' },
      priority: 'medium',
      priorityScore: 55,
      createdAt: new Date('2026-02-07').toISOString(),
      dueDate: new Date('2026-02-13').toISOString(),
      source: { type: 'manual' },
      status: 'open',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Contact Listing Broker',
      description: 'Follow up with John Smith (CBRE) on property tour and OM request. Last contact was 3 days ago.',
      linkedEntity: { type: 'pipeline-deal', id: 'deal-2', name: 'Midtown Plaza Acquisition' },
      category: 'communication',
      assignedTo: { userId: 'user-1', name: 'Leon D', type: 'user' },
      priority: 'medium',
      priorityScore: 45,
      createdAt: new Date('2026-02-09').toISOString(),
      dueDate: new Date('2026-02-12').toISOString(),
      source: { type: 'agent-alert', referenceId: 'followup-5' },
      status: 'open',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    }
  );

  // Sandy Springs Multifamily (Due Diligence)
  tasks.push(
    {
      id: `task-${taskId++}`,
      name: 'Review Title Commitment',
      description: 'Title commitment received from Chicago Title. Review for exceptions, easements, and encumbrances.',
      linkedEntity: { type: 'pipeline-deal', id: 'deal-3', name: 'Sandy Springs Multifamily' },
      category: 'legal',
      assignedTo: { userId: 'user-3', name: 'Mike Chen', type: 'team-member' },
      priority: 'high',
      priorityScore: 70,
      createdAt: new Date('2026-02-05').toISOString(),
      dueDate: new Date('2026-02-16').toISOString(),
      source: { type: 'email', referenceId: 'email-108' },
      status: 'open',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [
        { id: 'a2', taskId: `task-${taskId - 1}`, filename: 'sandy-springs-title-commitment.pdf', fileUrl: '#', uploadedAt: new Date('2026-02-05').toISOString() }
      ],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Property Survey Coordination',
      description: 'Coordinate with surveyor for ALTA survey. Seller to provide existing survey, but updated survey required for lender.',
      linkedEntity: { type: 'pipeline-deal', id: 'deal-3', name: 'Sandy Springs Multifamily' },
      category: 'due_diligence',
      assignedTo: { userId: 'user-2', name: 'Sarah Johnson', type: 'team-member' },
      priority: 'medium',
      priorityScore: 60,
      createdAt: new Date('2026-02-06').toISOString(),
      dueDate: new Date('2026-02-20').toISOString(),
      source: { type: 'manual' },
      status: 'in_progress',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Physical Inspection - HVAC Systems',
      description: 'Full HVAC inspection of all 48 units. Need report on remaining useful life and replacement costs.',
      linkedEntity: { type: 'pipeline-deal', id: 'deal-3', name: 'Sandy Springs Multifamily' },
      category: 'due_diligence',
      assignedTo: { userId: 'user-2', name: 'Sarah Johnson', type: 'team-member' },
      priority: 'high',
      priorityScore: 75,
      createdAt: new Date('2026-02-04').toISOString(),
      dueDate: new Date('2026-02-15').toISOString(),
      source: { type: 'manual' },
      status: 'open',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Obtain Estoppel Certificates',
      description: 'Request tenant estoppel certificates for all commercial tenants (3 total). Required for loan closing.',
      linkedEntity: { type: 'pipeline-deal', id: 'deal-3', name: 'Sandy Springs Multifamily' },
      category: 'legal',
      assignedTo: { userId: 'user-4', name: 'John Smith (Broker)', type: 'external-contact' },
      priority: 'high',
      priorityScore: 80,
      createdAt: new Date('2026-02-07').toISOString(),
      dueDate: new Date('2026-02-22').toISOString(),
      source: { type: 'email', referenceId: 'email-110' },
      status: 'open',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    }
  );

  // Decatur Office Building (Assets Owned - Operations)
  tasks.push(
    {
      id: `task-${taskId++}`,
      name: 'HVAC Unit 3B Repair',
      description: 'Unit 3B HVAC system failed. Tenant complaint received. Schedule emergency repair with HVAC contractor.',
      linkedEntity: { type: 'assets-owned-property', id: 'deal-4', name: 'Decatur Office Building' },
      category: 'operations',
      assignedTo: { userId: 'user-3', name: 'Mike Chen', type: 'team-member' },
      priority: 'high',
      priorityScore: 85,
      createdAt: new Date('2026-02-08').toISOString(),
      dueDate: new Date('2026-02-10').toISOString(),
      source: { type: 'email', referenceId: 'email-115' },
      status: 'in_progress',
      dependencies: [],
      blocksTaskIds: [],
      comments: [
        { id: 'c3', taskId: `task-${taskId - 1}`, userId: 'user-3', userName: 'Mike Chen', comment: 'Contractor scheduled for tomorrow 9am', createdAt: new Date('2026-02-09').toISOString() }
      ],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Schedule Annual Fire Inspection',
      description: 'Annual fire safety inspection due by end of month. Contact Atlanta Fire Marshal office to schedule.',
      linkedEntity: { type: 'assets-owned-property', id: 'deal-4', name: 'Decatur Office Building' },
      category: 'operations',
      assignedTo: { userId: 'user-2', name: 'Sarah Johnson', type: 'team-member' },
      priority: 'medium',
      priorityScore: 50,
      createdAt: new Date('2026-02-01').toISOString(),
      dueDate: new Date('2026-02-28').toISOString(),
      source: { type: 'manual' },
      status: 'open',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Process Tenant Move-Out Unit 412',
      description: 'Unit 412 tenant moving out Feb 28. Coordinate move-out inspection, damage assessment, and security deposit return.',
      linkedEntity: { type: 'assets-owned-property', id: 'deal-4', name: 'Decatur Office Building' },
      category: 'leasing',
      assignedTo: { userId: 'user-2', name: 'Sarah Johnson', type: 'team-member' },
      priority: 'medium',
      priorityScore: 40,
      createdAt: new Date('2026-01-30').toISOString(),
      dueDate: new Date('2026-02-28').toISOString(),
      source: { type: 'email', referenceId: 'email-92' },
      status: 'complete',
      completedAt: new Date('2026-02-05').toISOString(),
      dependencies: [],
      blocksTaskIds: ['task-19'],
      comments: [],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Post Unit 412 Vacancy Listing',
      description: 'Update property website, Apartments.com, and Zillow with Unit 412 listing. Schedule photographer for updated photos.',
      linkedEntity: { type: 'assets-owned-property', id: 'deal-4', name: 'Decatur Office Building' },
      category: 'leasing',
      assignedTo: { userId: 'user-2', name: 'Sarah Johnson', type: 'team-member' },
      priority: 'medium',
      priorityScore: 45,
      createdAt: new Date('2026-02-05').toISOString(),
      dueDate: new Date('2026-02-12').toISOString(),
      source: { type: 'manual' },
      status: 'complete',
      completedAt: new Date('2026-02-06').toISOString(),
      dependencies: ['task-17'],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Screen Applicant for Unit 412',
      description: 'Application received from prospective tenant. Run credit check, employment verification, and rental history.',
      linkedEntity: { type: 'assets-owned-property', id: 'deal-4', name: 'Decatur Office Building' },
      category: 'leasing',
      assignedTo: { userId: 'user-2', name: 'Sarah Johnson', type: 'team-member' },
      priority: 'medium',
      priorityScore: 55,
      createdAt: new Date('2026-02-09').toISOString(),
      dueDate: new Date('2026-02-15').toISOString(),
      source: { type: 'email', referenceId: 'email-118' },
      status: 'open',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Send Lease Renewal Notices',
      description: 'Send renewal notices to 5 tenants with leases expiring in March. Propose 3% rent increase.',
      linkedEntity: { type: 'assets-owned-property', id: 'deal-4', name: 'Decatur Office Building' },
      category: 'leasing',
      assignedTo: { userId: 'user-2', name: 'Sarah Johnson', type: 'team-member' },
      priority: 'medium',
      priorityScore: 50,
      createdAt: new Date('2026-02-01').toISOString(),
      dueDate: new Date('2026-03-01').toISOString(),
      source: { type: 'manual' },
      status: 'open',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Q1 2026 Investor Report',
      description: 'Prepare quarterly performance report for investors. Include financials, occupancy rates, and capital expenditures.',
      linkedEntity: { type: 'assets-owned-property', id: 'deal-4', name: 'Decatur Office Building' },
      category: 'investor_relations',
      assignedTo: { userId: 'user-1', name: 'Leon D', type: 'user' },
      priority: 'low',
      priorityScore: 30,
      createdAt: new Date('2026-02-01').toISOString(),
      dueDate: new Date('2026-04-01').toISOString(),
      source: { type: 'manual' },
      status: 'open',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Property Tax Appeal Preparation',
      description: 'County assessed value increased 15%. Prepare documentation for tax appeal - gather comps and engage tax consultant.',
      linkedEntity: { type: 'assets-owned-property', id: 'deal-4', name: 'Decatur Office Building' },
      category: 'operations',
      assignedTo: { userId: 'user-1', name: 'Leon D', type: 'user' },
      priority: 'medium',
      priorityScore: 60,
      createdAt: new Date('2026-02-06').toISOString(),
      dueDate: new Date('2026-03-15').toISOString(),
      source: { type: 'email', referenceId: 'email-105' },
      status: 'open',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    }
  );

  // Additional miscellaneous tasks
  tasks.push(
    {
      id: `task-${taskId++}`,
      name: 'Q4 2025 K-1 Preparation',
      description: 'Work with CPA to finalize K-1 tax forms for all investors across portfolio. Forms due by March 15.',
      linkedEntity: { type: 'global', id: 'global-1', name: 'All Properties' },
      category: 'reporting',
      assignedTo: { userId: 'user-1', name: 'Leon D', type: 'user' },
      priority: 'high',
      priorityScore: 70,
      createdAt: new Date('2026-02-01').toISOString(),
      dueDate: new Date('2026-03-15').toISOString(),
      source: { type: 'manual' },
      status: 'in_progress',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    },
    {
      id: `task-${taskId++}`,
      name: 'Annual Insurance Policy Review',
      description: 'Review all property insurance policies. Shop quotes from 3 carriers to ensure competitive rates.',
      linkedEntity: { type: 'global', id: 'global-1', name: 'All Properties' },
      category: 'operations',
      assignedTo: { userId: 'user-3', name: 'Mike Chen', type: 'team-member' },
      priority: 'medium',
      priorityScore: 45,
      createdAt: new Date('2026-02-03').toISOString(),
      dueDate: new Date('2026-03-30').toISOString(),
      source: { type: 'manual' },
      status: 'open',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: []
    }
  );

  return tasks;
}

class TasksService {
  private tasks: Task[];
  private readonly STORAGE_KEY = 'jedire_tasks';

  constructor() {
    this.tasks = this.loadFromStorage();
  }

  private loadFromStorage(): Task[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored tasks:', e);
      }
    }
    return generateMockTasks();
  }

  private saveToStorage(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tasks));
  }

  // Get all tasks with optional filters and sorting
  getTasks(filters?: TaskFilters, sort?: TaskSortConfig): Task[] {
    let filtered = [...this.tasks];

    // Apply filters
    if (filters) {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter(
          (task) =>
            task.name.toLowerCase().includes(search) ||
            task.description?.toLowerCase().includes(search) ||
            task.linkedEntity.name.toLowerCase().includes(search)
        );
      }

      if (filters.status && filters.status.length > 0) {
        filtered = filtered.filter((task) => filters.status!.includes(task.status));
      }

      if (filters.priority && filters.priority.length > 0) {
        filtered = filtered.filter((task) => filters.priority!.includes(task.priority));
      }

      if (filters.category && filters.category.length > 0) {
        filtered = filtered.filter((task) => filters.category!.includes(task.category));
      }

      if (filters.linkedEntityId) {
        filtered = filtered.filter((task) => task.linkedEntity.id === filters.linkedEntityId);
      }

      if (filters.assignedToId) {
        filtered = filtered.filter((task) => task.assignedTo.userId === filters.assignedToId);
      }

      // Due Date filtering
      if (filters.dueDateStart || filters.dueDateEnd) {
        filtered = filtered.filter((task) => {
          if (!task.dueDate) return false; // Exclude tasks without due dates
          const dueDate = new Date(task.dueDate);
          
          if (filters.dueDateStart && filters.dueDateEnd) {
            return dueDate >= new Date(filters.dueDateStart) && dueDate <= new Date(filters.dueDateEnd);
          } else if (filters.dueDateStart) {
            return dueDate >= new Date(filters.dueDateStart);
          } else if (filters.dueDateEnd) {
            return dueDate <= new Date(filters.dueDateEnd);
          }
          return true;
        });
      }

      // Completion Date filtering
      if (filters.completedDateStart || filters.completedDateEnd) {
        filtered = filtered.filter((task) => {
          if (!task.completedAt) return false; // Exclude tasks without completion dates
          const completedDate = new Date(task.completedAt);
          
          if (filters.completedDateStart && filters.completedDateEnd) {
            return completedDate >= new Date(filters.completedDateStart) && completedDate <= new Date(filters.completedDateEnd);
          } else if (filters.completedDateStart) {
            return completedDate >= new Date(filters.completedDateStart);
          } else if (filters.completedDateEnd) {
            return completedDate <= new Date(filters.completedDateEnd);
          }
          return true;
        });
      }
    }

    // Apply sorting
    if (sort) {
      filtered.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        if (sort.field === 'linkedEntity.name') {
          aVal = a.linkedEntity.name;
          bVal = b.linkedEntity.name;
        } else if (sort.field === 'assignedTo.name') {
          aVal = a.assignedTo.name;
          bVal = b.assignedTo.name;
        } else {
          aVal = a[sort.field as keyof Task];
          bVal = b[sort.field as keyof Task];
        }

        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }

  // Get single task
  getTask(id: string): Task | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  // Create task
  createTask(input: CreateTaskInput): Task {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      ...input,
      priorityScore: this.calculatePriorityScore(input.priority, input.dueDate),
      createdAt: new Date().toISOString(),
      status: 'open',
      dependencies: [],
      blocksTaskIds: [],
      comments: [],
      attachments: [],
      activities: [],
    };

    this.tasks.push(newTask);
    this.saveToStorage();
    return newTask;
  }

  // Update task
  updateTask(id: string, updates: Partial<Task>): Task | undefined {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) return undefined;

    this.tasks[index] = { ...this.tasks[index], ...updates };
    this.saveToStorage();
    return this.tasks[index];
  }

  // Delete task
  deleteTask(id: string): boolean {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) return false;

    this.tasks.splice(index, 1);
    this.saveToStorage();
    return true;
  }

  // Bulk operations
  bulkUpdateStatus(ids: string[], status: TaskStatus): void {
    ids.forEach((id) => {
      const task = this.tasks.find((t) => t.id === id);
      if (task) {
        task.status = status;
        if (status === 'complete') {
          task.completedAt = new Date().toISOString();
        }
      }
    });
    this.saveToStorage();
  }

  bulkUpdatePriority(ids: string[], priority: TaskPriority): void {
    ids.forEach((id) => {
      const task = this.tasks.find((t) => t.id === id);
      if (task) {
        task.priority = priority;
        task.priorityScore = this.calculatePriorityScore(priority, task.dueDate);
      }
    });
    this.saveToStorage();
  }

  bulkDelete(ids: string[]): void {
    this.tasks = this.tasks.filter((t) => !ids.includes(t.id));
    this.saveToStorage();
  }

  bulkAssign(ids: string[], assignedTo: { userId: string; name: string; type: string }): void {
    ids.forEach((id) => {
      const task = this.tasks.find((t) => t.id === id);
      if (task) {
        task.assignedTo = assignedTo as any;
      }
    });
    this.saveToStorage();
  }

  // Helper: Calculate priority score
  private calculatePriorityScore(priority: TaskPriority, dueDate?: string): number {
    let score = 0;

    // Priority base score
    if (priority === 'high') score += 50;
    else if (priority === 'medium') score += 30;
    else score += 10;

    // Due date proximity
    if (dueDate) {
      const daysUntil = Math.floor(
        (new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntil <= 1) score += 50;
      else if (daysUntil <= 3) score += 30;
      else if (daysUntil <= 7) score += 15;
    }

    return score;
  }

  // Get available deals for linking
  getAvailableDeals() {
    return MOCK_DEALS;
  }

  // Get available users for assignment
  getAvailableUsers() {
    return MOCK_USERS;
  }

  // Reset to mock data
  resetToMockData(): void {
    this.tasks = generateMockTasks();
    this.saveToStorage();
  }
}

export const tasksService = new TasksService();
