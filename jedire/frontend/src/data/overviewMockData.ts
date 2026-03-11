/**
 * Mock Data for Dual-Mode Overview Section
 * Provides realistic data for both acquisition and performance modes
 */

export interface QuickStat {
  label: string;
  value: string | number;
  icon: string;
  format?: 'currency' | 'percentage' | 'text' | 'number';
  subtext?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  color: 'blue' | 'purple' | 'green' | 'orange' | 'indigo';
  action?: () => void;
}

export interface PerformanceMetric {
  label: string;
  actual: number;
  target: number;
  unit: string;
  format?: 'currency' | 'percentage' | 'number';
}

export interface Activity {
  id: number;
  type: 'update' | 'document' | 'note' | 'event' | 'operational';
  text: string;
  time: string;
  user: string;
  icon?: string;
}

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  avatar: string;
  status: 'online' | 'offline' | 'away';
}

// ==================== ACQUISITION MODE DATA ====================

export const acquisitionStats: QuickStat[] = [
  {
    label: 'Target Price',
    value: 45000000,
    icon: '💰',
    format: 'currency'
  },
  {
    label: 'Expected IRR',
    value: 18.5,
    icon: '📈',
    format: 'percentage',
    trend: {
      direction: 'up',
      value: '+2.3%'
    }
  },
  {
    label: 'Pro Forma Cap Rate',
    value: 6.2,
    icon: '📊',
    format: 'percentage'
  },
  {
    label: 'Financing Terms',
    value: '70% LTV',
    icon: '🏦',
    format: 'text',
    subtext: '4.5% interest'
  },
  {
    label: 'Deal Stage',
    value: 'Due Diligence',
    icon: '🎯',
    format: 'text',
    subtext: 'Day 18 of 60'
  }
];

export const acquisitionActions: QuickAction[] = [
  {
    id: 'run-analysis',
    label: 'Run Analysis',
    icon: '📊',
    color: 'blue'
  },
  {
    id: 'generate-report',
    label: 'Generate Report',
    icon: '📄',
    color: 'purple'
  },
  {
    id: 'request-financing',
    label: 'Request Financing',
    icon: '🏦',
    color: 'green'
  }
];

export const acquisitionProgress = [
  {
    label: 'Due Diligence',
    percentage: 65,
    color: 'blue'
  },
  {
    label: 'Legal Review',
    percentage: 40,
    color: 'purple'
  },
  {
    label: 'Financing',
    percentage: 80,
    color: 'green'
  }
];

export const acquisitionActivities: Activity[] = [
  {
    id: 1,
    type: 'update',
    text: 'Deal stage updated to Due Diligence',
    time: '2 hours ago',
    user: 'Leon D'
  },
  {
    id: 2,
    type: 'document',
    text: 'Phase I Environmental Report uploaded',
    time: '5 hours ago',
    user: 'Sarah Johnson'
  },
  {
    id: 3,
    type: 'note',
    text: 'Meeting notes added from broker call',
    time: '1 day ago',
    user: 'Leon D'
  },
  {
    id: 4,
    type: 'event',
    text: 'Site inspection scheduled for next Tuesday',
    time: '2 days ago',
    user: 'John Smith'
  }
];

export const acquisitionTeam: TeamMember[] = [
  {
    id: 1,
    name: 'Leon D',
    role: 'Lead Analyst',
    avatar: 'LD',
    status: 'online'
  },
  {
    id: 2,
    name: 'Sarah Johnson',
    role: 'Financial Analyst',
    avatar: 'SJ',
    status: 'online'
  },
  {
    id: 3,
    name: 'John Smith',
    role: 'Broker',
    avatar: 'JS',
    status: 'offline'
  },
  {
    id: 4,
    name: 'Emily Chen',
    role: 'Legal Counsel',
    avatar: 'EC',
    status: 'away'
  }
];

// Mock deal for acquisition mode
export const mockAcquisitionDeal = {
  id: 'deal-001',
  name: 'Buckhead Tower Development',
  address: '3350 Peachtree Road NE, Atlanta, GA 30326',
  type: 'Multifamily',
  size: '250 units',
  targetPrice: 45000000,
  status: 'pipeline'
};

// ==================== PERFORMANCE MODE DATA ====================

export const performanceStats: QuickStat[] = [
  {
    label: 'Current Occupancy',
    value: 95,
    icon: '🏢',
    format: 'percentage',
    trend: {
      direction: 'up',
      value: '+2%'
    }
  },
  {
    label: 'Actual NOI',
    value: 3200000,
    icon: '💵',
    format: 'currency',
    subtext: 'Annual'
  },
  {
    label: 'Actual Cap Rate',
    value: 6.8,
    icon: '📈',
    format: 'percentage'
  },
  {
    label: 'Cash Flow',
    value: 2850000,
    icon: '💰',
    format: 'currency',
    subtext: 'vs $3M budget',
    trend: {
      direction: 'down',
      value: '-5%'
    }
  },
  {
    label: 'Days Owned',
    value: 547,
    icon: '📅',
    format: 'number',
    subtext: '1.5 years'
  }
];

export const performanceActions: QuickAction[] = [
  {
    id: 'performance-report',
    label: 'View Performance Report',
    icon: '📊',
    color: 'blue'
  },
  {
    id: 'refi-options',
    label: 'Check Refi Options',
    icon: '🏦',
    color: 'purple'
  },
  {
    id: 'market-analysis',
    label: 'Run Market Analysis',
    icon: '📈',
    color: 'green'
  }
];

export const performanceMetrics: PerformanceMetric[] = [
  {
    label: 'Occupancy',
    actual: 95,
    target: 93,
    unit: '%',
    format: 'percentage'
  },
  {
    label: 'NOI',
    actual: 3200000,
    target: 3400000,
    unit: '$',
    format: 'currency'
  },
  {
    label: 'Avg Rent',
    actual: 1825,
    target: 1850,
    unit: '$',
    format: 'currency'
  }
];

export const performanceActivities: Activity[] = [
  {
    id: 1,
    type: 'operational',
    text: 'Monthly occupancy report generated',
    time: '3 hours ago',
    user: 'System'
  },
  {
    id: 2,
    type: 'update',
    text: 'Rent increase approved for Unit 204',
    time: '1 day ago',
    user: 'Property Manager'
  },
  {
    id: 3,
    type: 'event',
    text: 'Maintenance completed on HVAC system',
    time: '2 days ago',
    user: 'Facilities Team'
  },
  {
    id: 4,
    type: 'document',
    text: 'Q1 2024 Financial Report published',
    time: '5 days ago',
    user: 'Finance Team'
  }
];

export const performanceTeam: TeamMember[] = [
  {
    id: 1,
    name: 'Marcus Williams',
    role: 'Property Manager',
    avatar: 'MW',
    status: 'online'
  },
  {
    id: 2,
    name: 'Jennifer Lee',
    role: 'Asset Manager',
    avatar: 'JL',
    status: 'online'
  },
  {
    id: 3,
    name: 'David Park',
    role: 'Leasing Director',
    avatar: 'DP',
    status: 'online'
  },
  {
    id: 4,
    name: 'Lisa Brown',
    role: 'Facilities Manager',
    avatar: 'LB',
    status: 'away'
  }
];

// Mock deal for performance mode
export const mockPerformanceDeal = {
  id: 'deal-002',
  name: 'Midtown Plaza',
  address: '1080 Peachtree Street NE, Atlanta, GA 30309',
  type: 'Multifamily',
  size: '180 units',
  acquisitionPrice: 38500000,
  acquisitionDate: '2022-08-15',
  status: 'owned'
};
