/**
 * Mock Data for Dual-Mode Team Section
 * Provides realistic data for both acquisition and performance modes
 */

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  email: string;
  phone: string;
  avatar: string;
  status: 'online' | 'offline' | 'away';
  department: string;
  responsibilities?: string[];
  contactPreference?: 'email' | 'phone' | 'slack';
}

export interface Communication {
  id: number;
  type: 'email' | 'call' | 'meeting' | 'message' | 'document';
  subject: string;
  participants: string[];
  timestamp: string;
  summary: string;
  priority?: 'high' | 'medium' | 'low';
  hasAttachment?: boolean;
}

export interface Decision {
  id: number;
  title: string;
  decision: string;
  madeBy: string;
  date: string;
  context: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
}

export interface ActionItem {
  id: number;
  title: string;
  assignedTo: string;
  assignedBy: string;
  dueDate: string;
  status: 'open' | 'in-progress' | 'completed' | 'overdue';
  priority: 'high' | 'medium' | 'low';
  category: string;
  description?: string;
}

export interface TeamStats {
  label: string;
  value: string | number;
  icon: string;
  format?: 'text' | 'number';
  subtext?: string;
}

export interface Vendor {
  id: number;
  name: string;
  category: string;
  contact: string;
  phone: string;
  email: string;
  status: 'active' | 'inactive' | 'pending';
  lastContact?: string;
  rating?: number;
  contract?: {
    start: string;
    end: string;
    value: number;
  };
}

export interface Escalation {
  id: number;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  reportedBy: string;
  reportedDate: string;
  status: 'open' | 'in-progress' | 'resolved';
  assignedTo: string;
  description: string;
  resolution?: string;
}

// ==================== ACQUISITION MODE DATA ====================

export const acquisitionTeamMembers: TeamMember[] = [
  {
    id: 1,
    name: 'Leon D',
    role: 'Lead Acquisitions Analyst',
    email: 'leon.d@jedire.com',
    phone: '(404) 555-0101',
    avatar: 'LD',
    status: 'online',
    department: 'Acquisitions',
    responsibilities: ['Deal sourcing', 'Financial modeling', 'Due diligence coordination'],
    contactPreference: 'email'
  },
  {
    id: 2,
    name: 'Sarah Johnson',
    role: 'Senior Financial Analyst',
    email: 'sarah.j@jedire.com',
    phone: '(404) 555-0102',
    avatar: 'SJ',
    status: 'online',
    department: 'Finance',
    responsibilities: ['Underwriting', 'Market analysis', 'Investment memos'],
    contactPreference: 'email'
  },
  {
    id: 3,
    name: 'John Smith',
    role: 'Acquisitions Broker',
    email: 'john.smith@cbre.com',
    phone: '(404) 555-0103',
    avatar: 'JS',
    status: 'offline',
    department: 'External - CBRE',
    responsibilities: ['Deal sourcing', 'Seller negotiations', 'Market intelligence'],
    contactPreference: 'phone'
  },
  {
    id: 4,
    name: 'Emily Chen',
    role: 'Legal Counsel',
    email: 'emily.chen@lawfirm.com',
    phone: '(404) 555-0104',
    avatar: 'EC',
    status: 'away',
    department: 'External - Legal',
    responsibilities: ['Contract review', 'Due diligence legal', 'Closing documents'],
    contactPreference: 'email'
  },
  {
    id: 5,
    name: 'Michael Torres',
    role: 'Due Diligence Manager',
    email: 'michael.t@jedire.com',
    phone: '(404) 555-0105',
    avatar: 'MT',
    status: 'online',
    department: 'Operations',
    responsibilities: ['Inspections coordination', 'Environmental reports', 'Title review'],
    contactPreference: 'phone'
  },
  {
    id: 6,
    name: 'Rebecca Williams',
    role: 'Debt & Equity Analyst',
    email: 'rebecca.w@jedire.com',
    phone: '(404) 555-0106',
    avatar: 'RW',
    status: 'online',
    department: 'Finance',
    responsibilities: ['Debt placement', 'Lender relations', 'Equity structuring'],
    contactPreference: 'email'
  }
];

export const acquisitionCommunications: Communication[] = [
  {
    id: 1,
    type: 'email',
    subject: 'Phase I Environmental Report - Review Needed',
    participants: ['Leon D', 'Michael Torres', 'Sarah Johnson'],
    timestamp: '2 hours ago',
    summary: 'Environmental consultant delivered Phase I report. No material issues found but need review by end of day.',
    priority: 'high',
    hasAttachment: true
  },
  {
    id: 2,
    type: 'meeting',
    subject: 'Investment Committee Pre-Meeting',
    participants: ['Leon D', 'Sarah Johnson', 'Rebecca Williams'],
    timestamp: '5 hours ago',
    summary: 'Reviewed investment memo draft. Need to adjust return assumptions based on latest rent comps.',
    priority: 'medium'
  },
  {
    id: 3,
    type: 'call',
    subject: 'Seller Call - Price Negotiation',
    participants: ['John Smith', 'Leon D'],
    timestamp: '1 day ago',
    summary: 'Broker communicated seller is firm at $45M but will credit $200K for deferred maintenance.',
    priority: 'high'
  },
  {
    id: 4,
    type: 'document',
    subject: 'Purchase Agreement - Redline v3',
    participants: ['Emily Chen', 'Leon D'],
    timestamp: '1 day ago',
    summary: 'Legal reviewed seller comments. Two open items on earnest money release and inspection period.',
    priority: 'medium',
    hasAttachment: true
  },
  {
    id: 5,
    type: 'message',
    subject: 'Lender LOI Received',
    participants: ['Rebecca Williams', 'Leon D', 'Sarah Johnson'],
    timestamp: '2 days ago',
    summary: 'Wells Fargo sent LOI: 70% LTV, 4.5%, 10yr IO. Terms look good, need to respond by Friday.',
    priority: 'high'
  },
  {
    id: 6,
    type: 'meeting',
    subject: 'Site Tour & Property Walk',
    participants: ['Leon D', 'Michael Torres', 'John Smith'],
    timestamp: '3 days ago',
    summary: 'Completed property inspection. Noted roof repairs needed (~$150K). Overall condition better than expected.',
    priority: 'medium'
  }
];

export const acquisitionDecisions: Decision[] = [
  {
    id: 1,
    title: 'Purchase Price Approved',
    decision: 'Move forward at $45M with $200K maintenance credit',
    madeBy: 'Investment Committee',
    date: '2 days ago',
    context: 'After negotiations, seller agreed to credit for deferred maintenance. Price represents 6.2% pro forma cap rate.',
    impact: 'high',
    category: 'Pricing'
  },
  {
    id: 2,
    title: 'Debt Structure Selection',
    decision: 'Accept Wells Fargo LOI - 70% LTV at 4.5%',
    madeBy: 'Leon D & Rebecca Williams',
    date: '3 days ago',
    context: 'Wells offered best terms vs other lenders. 10-year IO provides flexibility for value-add execution.',
    impact: 'high',
    category: 'Financing'
  },
  {
    id: 3,
    title: 'Due Diligence Period Extension',
    decision: 'Request 15-day extension (total 75 days)',
    madeBy: 'Leon D',
    date: '5 days ago',
    context: 'Environmental Phase II needed due to minor soil findings. Seller agreed to extension at no cost.',
    impact: 'medium',
    category: 'Timeline'
  },
  {
    id: 4,
    title: 'Property Management Selection',
    decision: 'Engage Greystar for takeover at closing',
    madeBy: 'Michael Torres',
    date: '1 week ago',
    context: 'Greystar proposed 3% management fee with performance incentives. Strong track record in submarket.',
    impact: 'medium',
    category: 'Operations'
  }
];

export const acquisitionActionItems: ActionItem[] = [
  {
    id: 1,
    title: 'Review Phase I Environmental Report',
    assignedTo: 'Michael Torres',
    assignedBy: 'Leon D',
    dueDate: 'Today, 5:00 PM',
    status: 'in-progress',
    priority: 'high',
    category: 'Due Diligence',
    description: 'Review environmental report and flag any concerns for legal review'
  },
  {
    id: 2,
    title: 'Finalize Investment Memo',
    assignedTo: 'Sarah Johnson',
    assignedBy: 'Leon D',
    dueDate: 'Tomorrow, 12:00 PM',
    status: 'in-progress',
    priority: 'high',
    category: 'Investment Committee',
    description: 'Update return metrics based on latest assumptions and price negotiations'
  },
  {
    id: 3,
    title: 'Respond to Wells Fargo LOI',
    assignedTo: 'Rebecca Williams',
    assignedBy: 'Leon D',
    dueDate: 'Jan 24, 2025',
    status: 'open',
    priority: 'high',
    category: 'Financing',
    description: 'Accept LOI terms and initiate formal application process'
  },
  {
    id: 4,
    title: 'Schedule Property Condition Assessment',
    assignedTo: 'Michael Torres',
    assignedBy: 'Leon D',
    dueDate: 'Jan 26, 2025',
    status: 'open',
    priority: 'medium',
    category: 'Due Diligence',
    description: 'Engage engineering firm for full PCA including capital needs assessment'
  },
  {
    id: 5,
    title: 'Negotiate Purchase Agreement Redlines',
    assignedTo: 'Emily Chen',
    assignedBy: 'Leon D',
    dueDate: 'Jan 27, 2025',
    status: 'open',
    priority: 'medium',
    category: 'Legal',
    description: 'Finalize two open items on earnest money and inspection period'
  },
  {
    id: 6,
    title: 'Prepare Market Rent Analysis',
    assignedTo: 'Sarah Johnson',
    assignedBy: 'Leon D',
    dueDate: 'Jan 28, 2025',
    status: 'completed',
    priority: 'low',
    category: 'Underwriting',
    description: 'Update rent comps for investment memo'
  }
];

export const acquisitionStats: TeamStats[] = [
  {
    label: 'Team Size',
    value: 6,
    icon: '👥',
    format: 'number',
    subtext: '3 internal, 3 external'
  },
  {
    label: 'Open Action Items',
    value: 5,
    icon: '📋',
    format: 'number',
    subtext: '3 high priority'
  },
  {
    label: 'Key Decisions',
    value: 4,
    icon: '✅',
    format: 'number',
    subtext: 'Last 2 weeks'
  },
  {
    label: 'Communications',
    value: 24,
    icon: '💬',
    format: 'number',
    subtext: 'Last 7 days'
  },
  {
    label: 'Next Milestone',
    value: 'IC Meeting',
    icon: '🎯',
    format: 'text',
    subtext: 'Jan 29, 2025'
  }
];

// ==================== PERFORMANCE MODE DATA ====================

export const performanceTeamMembers: TeamMember[] = [
  {
    id: 1,
    name: 'Marcus Williams',
    role: 'Property Manager',
    email: 'marcus.w@greystar.com',
    phone: '(404) 555-0201',
    avatar: 'MW',
    status: 'online',
    department: 'Property Management',
    responsibilities: ['Day-to-day operations', 'Tenant relations', 'Maintenance coordination'],
    contactPreference: 'phone'
  },
  {
    id: 2,
    name: 'Jennifer Lee',
    role: 'Asset Manager',
    email: 'jennifer.l@jedire.com',
    phone: '(404) 555-0202',
    avatar: 'JL',
    status: 'online',
    department: 'Asset Management',
    responsibilities: ['Performance monitoring', 'Budget oversight', 'Value-add execution'],
    contactPreference: 'email'
  },
  {
    id: 3,
    name: 'David Park',
    role: 'Leasing Director',
    email: 'david.p@greystar.com',
    phone: '(404) 555-0203',
    avatar: 'DP',
    status: 'online',
    department: 'Leasing',
    responsibilities: ['Leasing strategy', 'Rent optimization', 'Occupancy targets'],
    contactPreference: 'phone'
  },
  {
    id: 4,
    name: 'Lisa Brown',
    role: 'Facilities Manager',
    email: 'lisa.b@greystar.com',
    phone: '(404) 555-0204',
    avatar: 'LB',
    status: 'away',
    department: 'Facilities',
    responsibilities: ['Maintenance', 'Capital projects', 'Vendor management'],
    contactPreference: 'phone'
  },
  {
    id: 5,
    name: 'Ahmed Hassan',
    role: 'Regional Maintenance Super',
    email: 'ahmed.h@greystar.com',
    phone: '(404) 555-0205',
    avatar: 'AH',
    status: 'online',
    department: 'Maintenance',
    responsibilities: ['Repairs', 'Unit turns', 'Emergency response'],
    contactPreference: 'phone'
  },
  {
    id: 6,
    name: 'Rachel Kim',
    role: 'Financial Analyst',
    email: 'rachel.k@jedire.com',
    phone: '(404) 555-0206',
    avatar: 'RK',
    status: 'online',
    department: 'Finance',
    responsibilities: ['Financial reporting', 'Budget variance', 'Cash flow forecasting'],
    contactPreference: 'email'
  }
];

export const performanceCommunications: Communication[] = [
  {
    id: 1,
    type: 'email',
    subject: 'Monthly Performance Report - December 2024',
    participants: ['Jennifer Lee', 'Rachel Kim', 'Marcus Williams'],
    timestamp: '3 hours ago',
    summary: 'Occupancy at 95%, NOI tracking 5% below budget due to higher maintenance costs. Leasing velocity strong.',
    priority: 'high',
    hasAttachment: true
  },
  {
    id: 2,
    type: 'call',
    subject: 'Vendor Escalation - HVAC Issues',
    participants: ['Lisa Brown', 'Marcus Williams'],
    timestamp: '6 hours ago',
    summary: 'Called HVAC vendor about repeated service failures. Demanding better response times or will terminate contract.',
    priority: 'high'
  },
  {
    id: 3,
    type: 'meeting',
    subject: 'Quarterly Business Review',
    participants: ['Jennifer Lee', 'Marcus Williams', 'David Park', 'Rachel Kim'],
    timestamp: '1 day ago',
    summary: 'Reviewed Q4 performance. Agreed to increase marketing spend by $15K to drive winter leasing.',
    priority: 'medium'
  },
  {
    id: 4,
    type: 'message',
    subject: 'Roof Replacement - Bids Received',
    participants: ['Lisa Brown', 'Jennifer Lee'],
    timestamp: '2 days ago',
    summary: 'Three bids received for roof replacement. Lowest qualified bid at $285K. Need approval to proceed.',
    priority: 'high'
  },
  {
    id: 5,
    type: 'document',
    subject: 'Tenant Satisfaction Survey Results',
    participants: ['Marcus Williams', 'Jennifer Lee', 'David Park'],
    timestamp: '3 days ago',
    summary: 'Survey results show 4.2/5 overall satisfaction. Maintenance response time flagged as area for improvement.',
    priority: 'medium',
    hasAttachment: true
  }
];

export const performanceDecisions: Decision[] = [
  {
    id: 1,
    title: 'Approve Capital Improvement - Roof',
    decision: 'Approve $285K roof replacement with ABC Roofing',
    madeBy: 'Jennifer Lee',
    date: '1 day ago',
    context: 'Roof showing significant wear with multiple leaks. Replacement needed before winter storms. Lowest qualified bid selected.',
    impact: 'high',
    category: 'Capital Projects'
  },
  {
    id: 2,
    title: 'Rent Increase Strategy',
    decision: 'Implement 4% increase on renewals, 6% on new leases',
    madeBy: 'David Park & Jennifer Lee',
    date: '3 days ago',
    context: 'Market rents support increases. Renewal rate target 75%. New lease premium justified by strong demand.',
    impact: 'high',
    category: 'Revenue Management'
  },
  {
    id: 3,
    title: 'Vendor Contract Termination',
    decision: 'Terminate HVAC maintenance contract with XYZ Services',
    madeBy: 'Lisa Brown',
    date: '5 days ago',
    context: 'Repeated service failures and slow response times. Engaging new vendor with better SLAs and pricing.',
    impact: 'medium',
    category: 'Vendor Management'
  },
  {
    id: 4,
    title: 'Marketing Budget Increase',
    decision: 'Add $15K to Q1 marketing budget',
    madeBy: 'Jennifer Lee',
    date: '1 week ago',
    context: 'Winter leasing historically slower. Additional digital marketing spend to maintain occupancy momentum.',
    impact: 'medium',
    category: 'Operations'
  }
];

export const performanceActionItems: ActionItem[] = [
  {
    id: 1,
    title: 'Execute Roof Replacement Contract',
    assignedTo: 'Lisa Brown',
    assignedBy: 'Jennifer Lee',
    dueDate: 'Today, 3:00 PM',
    status: 'in-progress',
    priority: 'high',
    category: 'Capital Projects',
    description: 'Sign contract with ABC Roofing and coordinate start date'
  },
  {
    id: 2,
    title: 'Onboard New HVAC Vendor',
    assignedTo: 'Lisa Brown',
    assignedBy: 'Marcus Williams',
    dueDate: 'Tomorrow',
    status: 'open',
    priority: 'high',
    category: 'Vendor Management',
    description: 'Complete vendor onboarding and establish emergency response protocols'
  },
  {
    id: 3,
    title: 'Implement Rent Increase Program',
    assignedTo: 'David Park',
    assignedBy: 'Jennifer Lee',
    dueDate: 'Jan 25, 2025',
    status: 'in-progress',
    priority: 'high',
    category: 'Leasing',
    description: 'Update pricing strategy in system and train leasing team on positioning'
  },
  {
    id: 4,
    title: 'Launch Q1 Marketing Campaign',
    assignedTo: 'David Park',
    assignedBy: 'Jennifer Lee',
    dueDate: 'Jan 27, 2025',
    status: 'open',
    priority: 'medium',
    category: 'Marketing',
    description: 'Deploy increased digital ad spend across Google and social platforms'
  },
  {
    id: 5,
    title: 'Complete Monthly Financial Close',
    assignedTo: 'Rachel Kim',
    assignedBy: 'Jennifer Lee',
    dueDate: 'Jan 28, 2025',
    status: 'in-progress',
    priority: 'medium',
    category: 'Finance',
    description: 'Finalize December financials and variance analysis'
  },
  {
    id: 6,
    title: 'Address Maintenance Response Time Issue',
    assignedTo: 'Ahmed Hassan',
    assignedBy: 'Marcus Williams',
    dueDate: 'Jan 30, 2025',
    status: 'open',
    priority: 'medium',
    category: 'Operations',
    description: 'Review maintenance workflow and implement improvements based on tenant feedback'
  }
];

export const performanceStats: TeamStats[] = [
  {
    label: 'Team Size',
    value: 6,
    icon: '👥',
    format: 'number',
    subtext: '2 internal, 4 PM staff'
  },
  {
    label: 'Open Action Items',
    value: 5,
    icon: '📋',
    format: 'number',
    subtext: '3 high priority'
  },
  {
    label: 'Recent Decisions',
    value: 4,
    icon: '✅',
    format: 'number',
    subtext: 'Last 2 weeks'
  },
  {
    label: 'Communications',
    value: 18,
    icon: '💬',
    format: 'number',
    subtext: 'Last 7 days'
  },
  {
    label: 'Active Vendors',
    value: 12,
    icon: '🏢',
    format: 'number',
    subtext: '2 pending review'
  }
];

export const performanceVendors: Vendor[] = [
  {
    id: 1,
    name: 'ABC Roofing Solutions',
    category: 'Construction',
    contact: 'Tom Anderson',
    phone: '(404) 555-0301',
    email: 'tom@abcroofing.com',
    status: 'active',
    lastContact: '1 day ago',
    rating: 4.5,
    contract: {
      start: '2025-01-15',
      end: '2025-03-15',
      value: 285000
    }
  },
  {
    id: 2,
    name: 'CleanPro Janitorial',
    category: 'Janitorial',
    contact: 'Maria Rodriguez',
    phone: '(404) 555-0302',
    email: 'maria@cleanpro.com',
    status: 'active',
    lastContact: '3 days ago',
    rating: 4.8,
    contract: {
      start: '2024-01-01',
      end: '2025-12-31',
      value: 48000
    }
  },
  {
    id: 3,
    name: 'Superior Landscaping',
    category: 'Landscaping',
    contact: 'James Wilson',
    phone: '(404) 555-0303',
    email: 'james@superiorland.com',
    status: 'active',
    lastContact: '1 week ago',
    rating: 4.2,
    contract: {
      start: '2024-04-01',
      end: '2026-03-31',
      value: 36000
    }
  },
  {
    id: 4,
    name: 'TechCool HVAC Services',
    category: 'HVAC',
    contact: 'Robert Chen',
    phone: '(404) 555-0304',
    email: 'robert@techcool.com',
    status: 'pending',
    lastContact: '2 days ago',
    rating: 4.7
  },
  {
    id: 5,
    name: 'SafeGuard Security Systems',
    category: 'Security',
    contact: 'Patricia Davis',
    phone: '(404) 555-0305',
    email: 'patricia@safeguard.com',
    status: 'active',
    lastContact: '2 weeks ago',
    rating: 4.6,
    contract: {
      start: '2023-06-01',
      end: '2026-05-31',
      value: 24000
    }
  },
  {
    id: 6,
    name: 'GreenThumb Pest Control',
    category: 'Pest Control',
    contact: 'Michael Johnson',
    phone: '(404) 555-0306',
    email: 'michael@greenthumb.com',
    status: 'active',
    lastContact: '10 days ago',
    rating: 4.3,
    contract: {
      start: '2024-01-01',
      end: '2025-12-31',
      value: 12000
    }
  }
];

export const performanceEscalations: Escalation[] = [
  {
    id: 1,
    title: 'HVAC System Failure - Building B',
    severity: 'critical',
    reportedBy: 'Marcus Williams',
    reportedDate: '6 hours ago',
    status: 'in-progress',
    assignedTo: 'Lisa Brown',
    description: 'Complete HVAC failure in Building B affecting 40 units. Temporary heating units deployed. New vendor mobilizing for emergency repair.'
  },
  {
    id: 2,
    title: 'Vendor Contract Dispute - XYZ Services',
    severity: 'high',
    reportedBy: 'Lisa Brown',
    reportedDate: '2 days ago',
    status: 'in-progress',
    assignedTo: 'Jennifer Lee',
    description: 'XYZ Services disputing final payment after contract termination. Legal review needed. Amount in question: $8,500.'
  },
  {
    id: 3,
    title: 'Occupancy Drop - 2% in Last 30 Days',
    severity: 'high',
    reportedBy: 'David Park',
    reportedDate: '1 week ago',
    status: 'resolved',
    assignedTo: 'Jennifer Lee',
    description: 'Occupancy declined from 97% to 95% due to seasonal factors. Increased marketing spend approved to address.',
    resolution: 'Marketing budget increased by $15K. New digital campaigns launched. Early signs showing improved leasing velocity.'
  },
  {
    id: 4,
    title: 'Maintenance Response Time Below SLA',
    severity: 'medium',
    reportedBy: 'Marcus Williams',
    reportedDate: '1 week ago',
    status: 'open',
    assignedTo: 'Ahmed Hassan',
    description: 'Average maintenance response time at 36 hours vs 24-hour SLA. Tenant satisfaction impacted. Process review needed.'
  }
];
