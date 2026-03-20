/**
 * Mock Data for Dual-Mode Documents Section
 * Provides realistic document library for both acquisition and performance modes
 */

export interface Document {
  id: string;
  name: string;
  type: string;
  category: string;
  size: string;
  uploadedBy: string;
  uploadedAt: string;
  status: 'pending review' | 'approved' | 'needs revision' | 'archived';
  version: number;
  tags: string[];
  icon: string;
  lastModified?: string;
  description?: string;
}

export interface DocumentCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
  color: string;
}

export interface DocumentStats {
  label: string;
  value: string | number;
  icon: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
}

export interface RecentActivity {
  id: string;
  action: string;
  document: string;
  user: string;
  time: string;
  icon: string;
}

// ==================== ACQUISITION MODE DATA ====================

export const acquisitionDocumentCategories: DocumentCategory[] = [
  { id: 'all', name: 'All Documents', icon: '📁', count: 48, color: 'gray' },
  { id: 'due-diligence', name: 'Due Diligence', icon: '🔍', count: 15, color: 'blue' },
  { id: 'contracts', name: 'Contracts & Legal', icon: '📜', count: 8, color: 'purple' },
  { id: 'financial', name: 'Financial Reports', icon: '💰', count: 12, color: 'green' },
  { id: 'presentations', name: 'Presentations', icon: '📊', count: 6, color: 'orange' },
  { id: 'reports', name: 'Market Reports', icon: '📈', count: 7, color: 'indigo' }
];

export const acquisitionDocuments: Document[] = [
  {
    id: 'doc-1',
    name: 'Purchase and Sale Agreement.pdf',
    type: 'PDF',
    category: 'contracts',
    size: '2.4 MB',
    uploadedBy: 'Leon D',
    uploadedAt: '2024-02-10',
    status: 'pending review',
    version: 3,
    tags: ['critical', 'legal'],
    icon: '📜',
    description: 'Primary acquisition contract with seller terms'
  },
  {
    id: 'doc-2',
    name: 'Phase I Environmental Report.pdf',
    type: 'PDF',
    category: 'due-diligence',
    size: '8.7 MB',
    uploadedBy: 'Sarah Johnson',
    uploadedAt: '2024-02-08',
    status: 'approved',
    version: 1,
    tags: ['environmental', 'phase-1'],
    icon: '🌿',
    description: 'Environmental assessment - no significant concerns'
  },
  {
    id: 'doc-3',
    name: 'Pro Forma Financial Model.xlsx',
    type: 'Excel',
    category: 'financial',
    size: '1.2 MB',
    uploadedBy: 'Sarah Johnson',
    uploadedAt: '2024-02-07',
    status: 'approved',
    version: 5,
    tags: ['financial', 'model'],
    icon: '💹',
    description: '10-year financial projections with sensitivity analysis'
  },
  {
    id: 'doc-4',
    name: 'Property Inspection Report.pdf',
    type: 'PDF',
    category: 'due-diligence',
    size: '5.3 MB',
    uploadedBy: 'John Smith',
    uploadedAt: '2024-02-06',
    status: 'approved',
    version: 1,
    tags: ['inspection', 'maintenance'],
    icon: '🔧',
    description: 'Comprehensive property condition assessment'
  },
  {
    id: 'doc-5',
    name: 'Title Commitment & Survey.pdf',
    type: 'PDF',
    category: 'due-diligence',
    size: '3.8 MB',
    uploadedBy: 'Emily Chen',
    uploadedAt: '2024-02-05',
    status: 'approved',
    version: 1,
    tags: ['title', 'legal'],
    icon: '🗺️',
    description: 'Title insurance commitment and property survey'
  },
  {
    id: 'doc-6',
    name: 'Market Comps Analysis.pdf',
    type: 'PDF',
    category: 'reports',
    size: '2.1 MB',
    uploadedBy: 'Sarah Johnson',
    uploadedAt: '2024-02-04',
    status: 'approved',
    version: 2,
    tags: ['market', 'analysis'],
    icon: '📊',
    description: 'Comparable properties analysis - 3 mile radius'
  },
  {
    id: 'doc-7',
    name: 'Investor Presentation.pptx',
    type: 'PowerPoint',
    category: 'presentations',
    size: '12.5 MB',
    uploadedBy: 'Leon D',
    uploadedAt: '2024-02-03',
    status: 'approved',
    version: 4,
    tags: ['presentation', 'investors'],
    icon: '🎯',
    description: 'Investment committee presentation deck'
  },
  {
    id: 'doc-8',
    name: 'Rent Roll - Current.xlsx',
    type: 'Excel',
    category: 'financial',
    size: '892 KB',
    uploadedBy: 'John Smith',
    uploadedAt: '2024-02-02',
    status: 'approved',
    version: 1,
    tags: ['rent-roll', 'financial'],
    icon: '📋',
    description: 'Current tenant rent roll and lease expirations'
  },
  {
    id: 'doc-9',
    name: 'Appraisal Report.pdf',
    type: 'PDF',
    category: 'financial',
    size: '4.6 MB',
    uploadedBy: 'Sarah Johnson',
    uploadedAt: '2024-02-01',
    status: 'approved',
    version: 1,
    tags: ['appraisal', 'valuation'],
    icon: '💵',
    description: 'Third-party appraisal - $47M valuation'
  },
  {
    id: 'doc-10',
    name: 'Financing Term Sheet.pdf',
    type: 'PDF',
    category: 'contracts',
    size: '856 KB',
    uploadedBy: 'Emily Chen',
    uploadedAt: '2024-01-30',
    status: 'needs revision',
    version: 2,
    tags: ['financing', 'debt'],
    icon: '🏦',
    description: 'Proposed loan terms from primary lender'
  },
  {
    id: 'doc-11',
    name: 'Operating Statements (3yr).pdf',
    type: 'PDF',
    category: 'financial',
    size: '1.8 MB',
    uploadedBy: 'Sarah Johnson',
    uploadedAt: '2024-01-28',
    status: 'approved',
    version: 1,
    tags: ['financials', 'historical'],
    icon: '📊',
    description: 'Historical operating performance 2021-2023'
  },
  {
    id: 'doc-12',
    name: 'Zoning & Use Permit.pdf',
    type: 'PDF',
    category: 'due-diligence',
    size: '2.3 MB',
    uploadedBy: 'John Smith',
    uploadedAt: '2024-01-25',
    status: 'approved',
    version: 1,
    tags: ['zoning', 'legal'],
    icon: '🏛️',
    description: 'Current zoning classification and permits'
  }
];

export const acquisitionStats: DocumentStats[] = [
  { label: 'Total Documents', value: 48, icon: '📁' },
  { label: 'Pending Review', value: 6, icon: '⏳', trend: { direction: 'down', value: '-2' } },
  { label: 'Recent Uploads', value: 12, icon: '📤', trend: { direction: 'up', value: '+5' } },
  { label: 'Storage Used', value: '2.8 GB', icon: '💾' },
  { label: 'Team Members', value: 8, icon: '👥' }
];

export const acquisitionRecentActivity: RecentActivity[] = [
  {
    id: 'act-1',
    action: 'uploaded',
    document: 'Purchase and Sale Agreement.pdf',
    user: 'Leon D',
    time: '2 hours ago',
    icon: '📤'
  },
  {
    id: 'act-2',
    action: 'approved',
    document: 'Phase I Environmental Report.pdf',
    user: 'Emily Chen',
    time: '5 hours ago',
    icon: '✅'
  },
  {
    id: 'act-3',
    action: 'commented on',
    document: 'Pro Forma Financial Model.xlsx',
    user: 'Sarah Johnson',
    time: '1 day ago',
    icon: '💬'
  },
  {
    id: 'act-4',
    action: 'requested revision for',
    document: 'Financing Term Sheet.pdf',
    user: 'Leon D',
    time: '2 days ago',
    icon: '🔄'
  }
];

// ==================== PERFORMANCE MODE DATA ====================

export const performanceDocumentCategories: DocumentCategory[] = [
  { id: 'all', name: 'All Documents', icon: '📁', count: 63, color: 'gray' },
  { id: 'operations', name: 'Operations', icon: '⚙️', count: 18, color: 'blue' },
  { id: 'leases', name: 'Leases & Tenants', icon: '📝', count: 22, color: 'purple' },
  { id: 'maintenance', name: 'Maintenance', icon: '🔧', count: 12, color: 'green' },
  { id: 'financial', name: 'Financial Reports', icon: '💰', count: 8, color: 'orange' },
  { id: 'compliance', name: 'Compliance', icon: '✅', count: 3, color: 'indigo' }
];

export const performanceDocuments: Document[] = [
  {
    id: 'pdoc-1',
    name: 'Monthly Operating Report - Feb 2024.pdf',
    type: 'PDF',
    category: 'operations',
    size: '1.8 MB',
    uploadedBy: 'Marcus Williams',
    uploadedAt: '2024-02-10',
    status: 'approved',
    version: 1,
    tags: ['monthly', 'operations'],
    icon: '📊',
    description: 'February 2024 property performance summary'
  },
  {
    id: 'pdoc-2',
    name: 'Lease Agreement - Unit 405.pdf',
    type: 'PDF',
    category: 'leases',
    size: '945 KB',
    uploadedBy: 'David Park',
    uploadedAt: '2024-02-09',
    status: 'approved',
    version: 1,
    tags: ['lease', 'new-tenant'],
    icon: '📝',
    description: '12-month lease starting March 1, 2024'
  },
  {
    id: 'pdoc-3',
    name: 'HVAC Maintenance Log Q1 2024.xlsx',
    type: 'Excel',
    category: 'maintenance',
    size: '678 KB',
    uploadedBy: 'Lisa Brown',
    uploadedAt: '2024-02-08',
    status: 'approved',
    version: 1,
    tags: ['maintenance', 'hvac'],
    icon: '🔧',
    description: 'Quarterly HVAC service records and inspections'
  },
  {
    id: 'pdoc-4',
    name: 'Rent Roll - February 2024.xlsx',
    type: 'Excel',
    category: 'operations',
    size: '892 KB',
    uploadedBy: 'Marcus Williams',
    uploadedAt: '2024-02-07',
    status: 'approved',
    version: 1,
    tags: ['rent-roll', 'current'],
    icon: '💰',
    description: 'Current tenant roster and rental income'
  },
  {
    id: 'pdoc-5',
    name: 'Fire Safety Inspection Certificate.pdf',
    type: 'PDF',
    category: 'compliance',
    size: '1.2 MB',
    uploadedBy: 'Lisa Brown',
    uploadedAt: '2024-02-05',
    status: 'approved',
    version: 1,
    tags: ['compliance', 'safety'],
    icon: '🔥',
    description: 'Annual fire safety inspection - passed'
  },
  {
    id: 'pdoc-6',
    name: 'Tenant Satisfaction Survey Results.pdf',
    type: 'PDF',
    category: 'operations',
    size: '2.3 MB',
    uploadedBy: 'Marcus Williams',
    uploadedAt: '2024-02-03',
    status: 'approved',
    version: 1,
    tags: ['survey', 'tenants'],
    icon: '📋',
    description: 'Q4 2023 tenant feedback and ratings'
  },
  {
    id: 'pdoc-7',
    name: 'Capital Improvement Plan 2024.pdf',
    type: 'PDF',
    category: 'operations',
    size: '3.4 MB',
    uploadedBy: 'Jennifer Lee',
    uploadedAt: '2024-02-01',
    status: 'pending review',
    version: 2,
    tags: ['capex', 'planning'],
    icon: '🏗️',
    description: 'Proposed capital improvements and budget'
  },
  {
    id: 'pdoc-8',
    name: 'Insurance Policy - Property.pdf',
    type: 'PDF',
    category: 'compliance',
    size: '1.6 MB',
    uploadedBy: 'Jennifer Lee',
    uploadedAt: '2024-01-30',
    status: 'approved',
    version: 1,
    tags: ['insurance', 'compliance'],
    icon: '🛡️',
    description: 'Property insurance coverage details'
  },
  {
    id: 'pdoc-9',
    name: 'Vendor Service Agreements.pdf',
    type: 'PDF',
    category: 'maintenance',
    size: '2.8 MB',
    uploadedBy: 'Lisa Brown',
    uploadedAt: '2024-01-28',
    status: 'approved',
    version: 1,
    tags: ['vendors', 'contracts'],
    icon: '🤝',
    description: 'Active service provider contracts'
  },
  {
    id: 'pdoc-10',
    name: 'Q4 2023 Financial Statements.pdf',
    type: 'PDF',
    category: 'financial',
    size: '2.1 MB',
    uploadedBy: 'Jennifer Lee',
    uploadedAt: '2024-01-25',
    status: 'approved',
    version: 1,
    tags: ['financial', 'quarterly'],
    icon: '💵',
    description: 'Fourth quarter 2023 financial performance'
  },
  {
    id: 'pdoc-11',
    name: 'Lease Renewal Notice - Unit 204.pdf',
    type: 'PDF',
    category: 'leases',
    size: '456 KB',
    uploadedBy: 'David Park',
    uploadedAt: '2024-01-22',
    status: 'approved',
    version: 1,
    tags: ['lease', 'renewal'],
    icon: '🔄',
    description: 'Renewal offer for expiring lease'
  },
  {
    id: 'pdoc-12',
    name: 'Utility Expense Report Jan 2024.xlsx',
    type: 'Excel',
    category: 'operations',
    size: '567 KB',
    uploadedBy: 'Marcus Williams',
    uploadedAt: '2024-01-20',
    status: 'approved',
    version: 1,
    tags: ['utilities', 'expenses'],
    icon: '⚡',
    description: 'Monthly utility consumption and costs'
  }
];

export const performanceStats: DocumentStats[] = [
  { label: 'Total Documents', value: 63, icon: '📁' },
  { label: 'Pending Review', value: 3, icon: '⏳' },
  { label: 'Recent Uploads', value: 8, icon: '📤', trend: { direction: 'neutral', value: '±0' } },
  { label: 'Storage Used', value: '3.6 GB', icon: '💾' },
  { label: 'Active Leases', value: 171, icon: '📝' }
];

export const performanceRecentActivity: RecentActivity[] = [
  {
    id: 'pact-1',
    action: 'uploaded',
    document: 'Monthly Operating Report - Feb 2024.pdf',
    user: 'Marcus Williams',
    time: '3 hours ago',
    icon: '📤'
  },
  {
    id: 'pact-2',
    action: 'signed',
    document: 'Lease Agreement - Unit 405.pdf',
    user: 'David Park',
    time: '1 day ago',
    icon: '✅'
  },
  {
    id: 'pact-3',
    action: 'updated',
    document: 'HVAC Maintenance Log Q1 2024.xlsx',
    user: 'Lisa Brown',
    time: '2 days ago',
    icon: '🔄'
  },
  {
    id: 'pact-4',
    action: 'reviewed',
    document: 'Capital Improvement Plan 2024.pdf',
    user: 'Jennifer Lee',
    time: '3 days ago',
    icon: '👁️'
  }
];
