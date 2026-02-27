/**
 * Mock Data for Due Diligence Section
 * Provides realistic DD checklist and tracking data for both modes
 */

export interface DDChecklistItem {
  id: string;
  category: 'legal' | 'financial' | 'physical' | 'environmental';
  title: string;
  description: string;
  status: 'complete' | 'in-progress' | 'pending' | 'blocked';
  assignee: string;
  dueDate: string;
  completedDate?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  documents: {
    name: string;
    url: string;
    uploadedAt: string;
  }[];
  notes?: string;
  isCriticalPath: boolean;
  redFlag?: {
    severity: 'high' | 'medium' | 'low';
    description: string;
    status: 'open' | 'resolved' | 'monitoring';
  };
}

export interface DDInspection {
  id: string;
  type: string;
  scheduledDate: string;
  completedDate?: string;
  inspector: string;
  status: 'scheduled' | 'completed' | 'in-progress';
  findings: string[];
  reportUrl?: string;
  cost: number;
}

export interface DDStat {
  label: string;
  value: string | number;
  icon: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  color?: string;
}

// ==================== ACQUISITION MODE DATA ====================

export const acquisitionDDStats: DDStat[] = [
  {
    label: 'DD Completion',
    value: '68%',
    icon: '✅',
    trend: { direction: 'up', value: '+12%' }
  },
  {
    label: 'Red Flags',
    value: 3,
    icon: '🚩',
    color: 'red'
  },
  {
    label: 'Inspections',
    value: '4/6',
    icon: '🔍',
    trend: { direction: 'up', value: '2 done' }
  },
  {
    label: 'Days Remaining',
    value: 42,
    icon: '⏱️',
    trend: { direction: 'down', value: 'of 60' }
  },
  {
    label: 'Critical Items',
    value: 8,
    icon: '⚡',
    color: 'orange'
  }
];

export const acquisitionChecklist: DDChecklistItem[] = [
  // LEGAL
  {
    id: 'legal-1',
    category: 'legal',
    title: 'Title Search & Insurance',
    description: 'Complete title search and secure title insurance commitment',
    status: 'complete',
    assignee: 'Emily Chen',
    dueDate: '2024-02-15',
    completedDate: '2024-02-14',
    priority: 'critical',
    documents: [
      { name: 'Title_Report_Final.pdf', url: '/docs/title', uploadedAt: '2024-02-14' },
      { name: 'Title_Insurance_Commitment.pdf', url: '/docs/title', uploadedAt: '2024-02-14' }
    ],
    isCriticalPath: true
  },
  {
    id: 'legal-2',
    category: 'legal',
    title: 'Purchase Agreement Review',
    description: 'Legal review of purchase and sale agreement',
    status: 'complete',
    assignee: 'Emily Chen',
    dueDate: '2024-02-10',
    completedDate: '2024-02-09',
    priority: 'critical',
    documents: [
      { name: 'PSA_Executed.pdf', url: '/docs/legal', uploadedAt: '2024-02-09' }
    ],
    isCriticalPath: true
  },
  {
    id: 'legal-3',
    category: 'legal',
    title: 'Zoning Verification',
    description: 'Verify current zoning and allowable uses',
    status: 'in-progress',
    assignee: 'John Smith',
    dueDate: '2024-02-20',
    priority: 'high',
    documents: [
      { name: 'Zoning_Letter_Request.pdf', url: '/docs/zoning', uploadedAt: '2024-02-12' }
    ],
    isCriticalPath: false
  },
  {
    id: 'legal-4',
    category: 'legal',
    title: 'Tenant Lease Review',
    description: 'Review all existing tenant leases and amendments',
    status: 'in-progress',
    assignee: 'Emily Chen',
    dueDate: '2024-02-25',
    priority: 'critical',
    documents: [
      { name: 'Rent_Roll_Current.xlsx', url: '/docs/leases', uploadedAt: '2024-02-10' }
    ],
    isCriticalPath: true,
    redFlag: {
      severity: 'medium',
      description: 'Missing 3 tenant estoppels - tenants not responding',
      status: 'open'
    }
  },
  {
    id: 'legal-5',
    category: 'legal',
    title: 'Entity Formation',
    description: 'Form acquisition entity and operating agreement',
    status: 'pending',
    assignee: 'Emily Chen',
    dueDate: '2024-03-01',
    priority: 'high',
    documents: [],
    isCriticalPath: true
  },

  // FINANCIAL
  {
    id: 'financial-1',
    category: 'financial',
    title: 'Rent Roll Analysis',
    description: 'Analyze current rent roll and lease expirations',
    status: 'complete',
    assignee: 'Sarah Johnson',
    dueDate: '2024-02-12',
    completedDate: '2024-02-11',
    priority: 'critical',
    documents: [
      { name: 'Rent_Roll_Analysis.xlsx', url: '/docs/financial', uploadedAt: '2024-02-11' }
    ],
    isCriticalPath: true
  },
  {
    id: 'financial-2',
    category: 'financial',
    title: 'Historical Financials Review',
    description: 'Review 3 years of operating statements and tax returns',
    status: 'in-progress',
    assignee: 'Sarah Johnson',
    dueDate: '2024-02-22',
    priority: 'critical',
    documents: [
      { name: 'P&L_2021-2023.pdf', url: '/docs/financial', uploadedAt: '2024-02-08' },
      { name: 'Tax_Returns_2021-2022.pdf', url: '/docs/financial', uploadedAt: '2024-02-08' }
    ],
    isCriticalPath: true,
    notes: 'Waiting on 2023 tax return from seller'
  },
  {
    id: 'financial-3',
    category: 'financial',
    title: 'Operating Expense Verification',
    description: 'Verify all operating expenses and compare to market',
    status: 'in-progress',
    assignee: 'Sarah Johnson',
    dueDate: '2024-02-23',
    priority: 'high',
    documents: [],
    isCriticalPath: false
  },
  {
    id: 'financial-4',
    category: 'financial',
    title: 'Capital Needs Assessment',
    description: 'Identify deferred maintenance and capital improvement needs',
    status: 'pending',
    assignee: 'David Park',
    dueDate: '2024-02-28',
    priority: 'critical',
    documents: [],
    isCriticalPath: true
  },
  {
    id: 'financial-5',
    category: 'financial',
    title: 'Insurance Analysis',
    description: 'Obtain insurance quotes and verify coverage requirements',
    status: 'pending',
    assignee: 'Sarah Johnson',
    dueDate: '2024-02-26',
    priority: 'medium',
    documents: [],
    isCriticalPath: false
  },

  // PHYSICAL
  {
    id: 'physical-1',
    category: 'physical',
    title: 'Property Condition Assessment',
    description: 'Complete third-party PCA inspection',
    status: 'in-progress',
    assignee: 'Marcus Williams',
    dueDate: '2024-02-24',
    priority: 'critical',
    documents: [
      { name: 'PCA_Proposal.pdf', url: '/docs/inspection', uploadedAt: '2024-02-10' }
    ],
    isCriticalPath: true,
    notes: 'Inspection scheduled for Feb 18'
  },
  {
    id: 'physical-2',
    category: 'physical',
    title: 'Survey Review',
    description: 'Obtain and review ALTA survey',
    status: 'complete',
    assignee: 'John Smith',
    dueDate: '2024-02-16',
    completedDate: '2024-02-15',
    priority: 'critical',
    documents: [
      { name: 'ALTA_Survey.pdf', url: '/docs/survey', uploadedAt: '2024-02-15' }
    ],
    isCriticalPath: true
  },
  {
    id: 'physical-3',
    category: 'physical',
    title: 'Mechanical Systems Inspection',
    description: 'Inspect HVAC, plumbing, and electrical systems',
    status: 'pending',
    assignee: 'Lisa Brown',
    dueDate: '2024-02-26',
    priority: 'high',
    documents: [],
    isCriticalPath: false
  },
  {
    id: 'physical-4',
    category: 'physical',
    title: 'Roof Inspection',
    description: 'Inspect roof condition and estimate remaining useful life',
    status: 'pending',
    assignee: 'Lisa Brown',
    dueDate: '2024-02-27',
    priority: 'high',
    documents: [],
    isCriticalPath: false
  },
  {
    id: 'physical-5',
    category: 'physical',
    title: 'Unit Walks',
    description: 'Walk 25% sample of units across all floor plans',
    status: 'pending',
    assignee: 'Marcus Williams',
    dueDate: '2024-02-25',
    priority: 'medium',
    documents: [],
    isCriticalPath: false
  },

  // ENVIRONMENTAL
  {
    id: 'env-1',
    category: 'environmental',
    title: 'Phase I Environmental Assessment',
    description: 'Complete Phase I ESA per ASTM standards',
    status: 'complete',
    assignee: 'Environmental Consultant',
    dueDate: '2024-02-18',
    completedDate: '2024-02-17',
    priority: 'critical',
    documents: [
      { name: 'Phase_I_ESA_Report.pdf', url: '/docs/environmental', uploadedAt: '2024-02-17' }
    ],
    isCriticalPath: true,
    redFlag: {
      severity: 'high',
      description: 'Phase I identified potential underground storage tank - Phase II recommended',
      status: 'open'
    }
  },
  {
    id: 'env-2',
    category: 'environmental',
    title: 'Phase II Environmental (if needed)',
    description: 'Conduct Phase II testing based on Phase I findings',
    status: 'blocked',
    assignee: 'Environmental Consultant',
    dueDate: '2024-03-05',
    priority: 'critical',
    documents: [],
    isCriticalPath: true,
    notes: 'Blocked pending Phase I review and seller response'
  },
  {
    id: 'env-3',
    category: 'environmental',
    title: 'Wetlands Delineation',
    description: 'Verify wetlands boundaries and jurisdictional determination',
    status: 'pending',
    assignee: 'Environmental Consultant',
    dueDate: '2024-02-28',
    priority: 'medium',
    documents: [],
    isCriticalPath: false
  },
  {
    id: 'env-4',
    category: 'environmental',
    title: 'Asbestos & Lead Paint Inspection',
    description: 'Inspect for asbestos-containing materials and lead paint',
    status: 'pending',
    assignee: 'Environmental Consultant',
    dueDate: '2024-02-29',
    priority: 'high',
    documents: [],
    isCriticalPath: false
  }
];

export const acquisitionInspections: DDInspection[] = [
  {
    id: 'insp-1',
    type: 'Property Condition Assessment',
    scheduledDate: '2024-02-18',
    status: 'scheduled',
    inspector: 'Allied Engineering Partners',
    findings: [],
    cost: 8500
  },
  {
    id: 'insp-2',
    type: 'Phase I Environmental',
    scheduledDate: '2024-02-12',
    completedDate: '2024-02-17',
    status: 'completed',
    inspector: 'EnviroTech Solutions',
    findings: [
      'Potential underground storage tank identified',
      'Historical dry cleaner on adjacent parcel',
      'Phase II recommended for subsurface investigation'
    ],
    reportUrl: '/docs/Phase_I_ESA_Report.pdf',
    cost: 5500
  },
  {
    id: 'insp-3',
    type: 'ALTA Survey',
    scheduledDate: '2024-02-10',
    completedDate: '2024-02-15',
    status: 'completed',
    inspector: 'Precision Land Surveying',
    findings: [
      'Property boundaries confirmed',
      'No encroachments identified',
      'Easements match title report'
    ],
    reportUrl: '/docs/ALTA_Survey.pdf',
    cost: 4200
  },
  {
    id: 'insp-4',
    type: 'Mechanical Systems',
    scheduledDate: '2024-02-26',
    status: 'scheduled',
    inspector: 'HVAC Experts Inc',
    findings: [],
    cost: 3500
  },
  {
    id: 'insp-5',
    type: 'Roof Inspection',
    scheduledDate: '2024-02-27',
    status: 'scheduled',
    inspector: 'Superior Roofing Consultants',
    findings: [],
    cost: 2200
  },
  {
    id: 'insp-6',
    type: 'Asbestos & Lead Paint',
    scheduledDate: '2024-02-29',
    status: 'scheduled',
    inspector: 'SafetyFirst Environmental',
    findings: [],
    cost: 3800
  }
];

// ==================== PERFORMANCE MODE DATA ====================

export const performanceDDStats: DDStat[] = [
  {
    label: 'Compliance Rate',
    value: '96%',
    icon: '✅',
    trend: { direction: 'up', value: '+2%' }
  },
  {
    label: 'Open Issues',
    value: 2,
    icon: '⚠️',
    color: 'yellow'
  },
  {
    label: 'Annual Audits',
    value: '3/4',
    icon: '📋',
    trend: { direction: 'up', value: '1 pending' }
  },
  {
    label: 'Last Inspection',
    value: '15d ago',
    icon: '🔍'
  },
  {
    label: 'Remediation Items',
    value: 5,
    icon: '🔧',
    color: 'blue'
  }
];

export const performanceChecklist: DDChecklistItem[] = [
  // LEGAL - Ongoing Compliance
  {
    id: 'perf-legal-1',
    category: 'legal',
    title: 'Annual Insurance Review',
    description: 'Review and renew property insurance policies',
    status: 'complete',
    assignee: 'Jennifer Lee',
    dueDate: '2024-02-01',
    completedDate: '2024-01-28',
    priority: 'critical',
    documents: [
      { name: 'Insurance_Renewal_2024.pdf', url: '/docs/insurance', uploadedAt: '2024-01-28' }
    ],
    isCriticalPath: false
  },
  {
    id: 'perf-legal-2',
    category: 'legal',
    title: 'Lease Compliance Audit',
    description: 'Quarterly review of lease compliance and violations',
    status: 'in-progress',
    assignee: 'Marcus Williams',
    dueDate: '2024-02-28',
    priority: 'high',
    documents: [],
    isCriticalPath: false
  },
  {
    id: 'perf-legal-3',
    category: 'legal',
    title: 'Fair Housing Training',
    description: 'Annual fair housing training for all staff',
    status: 'pending',
    assignee: 'HR Department',
    dueDate: '2024-03-15',
    priority: 'medium',
    documents: [],
    isCriticalPath: false
  },

  // FINANCIAL - Ongoing Monitoring
  {
    id: 'perf-financial-1',
    category: 'financial',
    title: 'Monthly Financial Close',
    description: 'Complete monthly financial statements and variance analysis',
    status: 'complete',
    assignee: 'Finance Team',
    dueDate: '2024-02-10',
    completedDate: '2024-02-09',
    priority: 'critical',
    documents: [
      { name: 'January_2024_Financials.pdf', url: '/docs/financials', uploadedAt: '2024-02-09' }
    ],
    isCriticalPath: false
  },
  {
    id: 'perf-financial-2',
    category: 'financial',
    title: 'Budget vs Actual Review',
    description: 'Quarterly budget performance review',
    status: 'in-progress',
    assignee: 'Jennifer Lee',
    dueDate: '2024-02-25',
    priority: 'high',
    documents: [],
    isCriticalPath: false,
    redFlag: {
      severity: 'medium',
      description: 'Maintenance expenses 8% over budget YTD',
      status: 'monitoring'
    }
  },
  {
    id: 'perf-financial-3',
    category: 'financial',
    title: 'Rent Collection Report',
    description: 'Monthly rent collection and delinquency tracking',
    status: 'complete',
    assignee: 'Property Manager',
    dueDate: '2024-02-05',
    completedDate: '2024-02-05',
    priority: 'critical',
    documents: [
      { name: 'Collection_Report_Feb2024.pdf', url: '/docs/collections', uploadedAt: '2024-02-05' }
    ],
    isCriticalPath: false
  },

  // PHYSICAL - Ongoing Maintenance
  {
    id: 'perf-physical-1',
    category: 'physical',
    title: 'Annual Fire Safety Inspection',
    description: 'Complete annual fire safety and suppression system inspection',
    status: 'complete',
    assignee: 'Fire Marshal',
    dueDate: '2024-01-31',
    completedDate: '2024-01-29',
    priority: 'critical',
    documents: [
      { name: 'Fire_Safety_Inspection_2024.pdf', url: '/docs/safety', uploadedAt: '2024-01-29' }
    ],
    isCriticalPath: false
  },
  {
    id: 'perf-physical-2',
    category: 'physical',
    title: 'HVAC Preventive Maintenance',
    description: 'Quarterly HVAC system maintenance and filter replacement',
    status: 'in-progress',
    assignee: 'Lisa Brown',
    dueDate: '2024-02-20',
    priority: 'high',
    documents: [],
    isCriticalPath: false
  },
  {
    id: 'perf-physical-3',
    category: 'physical',
    title: 'Elevator Annual Inspection',
    description: 'State-required annual elevator safety inspection',
    status: 'pending',
    assignee: 'Otis Elevator Service',
    dueDate: '2024-03-01',
    priority: 'critical',
    documents: [],
    isCriticalPath: false
  },
  {
    id: 'perf-physical-4',
    category: 'physical',
    title: 'Parking Lot Repairs',
    description: 'Repair potholes and restripe parking areas',
    status: 'pending',
    assignee: 'Facilities Team',
    dueDate: '2024-03-10',
    priority: 'medium',
    documents: [],
    isCriticalPath: false,
    notes: 'Deferred from winter - schedule for spring'
  },

  // ENVIRONMENTAL - Ongoing Compliance
  {
    id: 'perf-env-1',
    category: 'environmental',
    title: 'Stormwater Compliance',
    description: 'Quarterly stormwater management and reporting',
    status: 'complete',
    assignee: 'Environmental Consultant',
    dueDate: '2024-02-15',
    completedDate: '2024-02-14',
    priority: 'high',
    documents: [
      { name: 'Stormwater_Report_Q1_2024.pdf', url: '/docs/environmental', uploadedAt: '2024-02-14' }
    ],
    isCriticalPath: false
  },
  {
    id: 'perf-env-2',
    category: 'environmental',
    title: 'Underground Tank Monitoring',
    description: 'Monthly monitoring of remediated UST site',
    status: 'in-progress',
    assignee: 'EnviroTech Solutions',
    dueDate: '2024-02-28',
    priority: 'critical',
    documents: [],
    isCriticalPath: false,
    redFlag: {
      severity: 'low',
      description: 'Groundwater levels slightly elevated - within acceptable range',
      status: 'monitoring'
    }
  },
  {
    id: 'perf-env-3',
    category: 'environmental',
    title: 'Waste Management Audit',
    description: 'Annual waste disposal and recycling compliance audit',
    status: 'pending',
    assignee: 'Facilities Team',
    dueDate: '2024-03-20',
    priority: 'medium',
    documents: [],
    isCriticalPath: false
  }
];

export const performanceInspections: DDInspection[] = [
  {
    id: 'perf-insp-1',
    type: 'Annual Fire Safety',
    scheduledDate: '2024-01-25',
    completedDate: '2024-01-29',
    status: 'completed',
    inspector: 'County Fire Marshal',
    findings: [
      'All fire extinguishers current',
      'Emergency exits properly marked',
      'Fire alarm system operational'
    ],
    reportUrl: '/docs/Fire_Safety_Inspection_2024.pdf',
    cost: 0
  },
  {
    id: 'perf-insp-2',
    type: 'Property Condition Assessment',
    scheduledDate: '2024-02-10',
    completedDate: '2024-02-12',
    status: 'completed',
    inspector: 'Allied Engineering Partners',
    findings: [
      'Roof estimated 8-10 years remaining life',
      'HVAC systems in good condition',
      'Minor parking lot repairs recommended'
    ],
    reportUrl: '/docs/PCA_Annual_2024.pdf',
    cost: 7500
  },
  {
    id: 'perf-insp-3',
    type: 'Elevator Safety',
    scheduledDate: '2024-03-01',
    status: 'scheduled',
    inspector: 'Otis Elevator Service',
    findings: [],
    cost: 1200
  },
  {
    id: 'perf-insp-4',
    type: 'Pool & Spa Inspection',
    scheduledDate: '2024-03-15',
    status: 'scheduled',
    inspector: 'Health Department',
    findings: [],
    cost: 0
  }
];
