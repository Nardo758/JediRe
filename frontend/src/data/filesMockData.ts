/**
 * Mock Data for Dual-Mode Files Section
 * Provides realistic file repository data for both acquisition and performance modes
 */

export interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  fileType?: 'pdf' | 'doc' | 'xls' | 'jpg' | 'png' | 'zip' | 'txt' | 'dwg';
  size?: number; // in bytes
  modified: string;
  modifiedBy: string;
  path: string[];
  thumbnail?: string;
  tags?: string[];
  status?: 'draft' | 'final' | 'review' | 'approved';
  children?: FileItem[];
}

export interface FileStats {
  label: string;
  value: string | number;
  icon: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  format?: 'number' | 'size' | 'text';
}

export interface RecentFile {
  id: string;
  name: string;
  fileType: string;
  action: string;
  timestamp: string;
  user: string;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  color: 'blue' | 'purple' | 'green' | 'orange' | 'indigo';
}

// ==================== ACQUISITION MODE DATA ====================

export const acquisitionStats: FileStats[] = [
  {
    label: 'Total Files',
    value: 247,
    icon: '📄',
    format: 'number',
    trend: { direction: 'up', value: '+12 this week' }
  },
  {
    label: 'Storage Used',
    value: '4.2 GB',
    icon: '💾',
    format: 'size',
    trend: { direction: 'up', value: '+850 MB' }
  },
  {
    label: 'DD Documents',
    value: 89,
    icon: '🔍',
    format: 'number'
  },
  {
    label: 'Photos',
    value: 124,
    icon: '📸',
    format: 'number'
  },
  {
    label: 'Pending Review',
    value: 8,
    icon: '⏱️',
    format: 'number'
  }
];

export const acquisitionFolderStructure: FileItem[] = [
  {
    id: 'dd-root',
    name: 'Due Diligence',
    type: 'folder',
    modified: '2024-02-11',
    modifiedBy: 'Sarah Chen',
    path: ['Due Diligence'],
    children: [
      {
        id: 'dd-financial',
        name: 'Financial Records',
        type: 'folder',
        modified: '2024-02-11',
        modifiedBy: 'Sarah Chen',
        path: ['Due Diligence', 'Financial Records'],
        children: [
          {
            id: 'dd-f-1',
            name: 'Rent Roll - Jan 2024.xlsx',
            type: 'file',
            fileType: 'xls',
            size: 245000,
            modified: '2024-02-11',
            modifiedBy: 'Sarah Chen',
            path: ['Due Diligence', 'Financial Records'],
            status: 'approved',
            tags: ['critical', 'reviewed']
          },
          {
            id: 'dd-f-2',
            name: 'Operating Statements 2023.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 1200000,
            modified: '2024-02-10',
            modifiedBy: 'Mike Rodriguez',
            path: ['Due Diligence', 'Financial Records'],
            status: 'approved'
          },
          {
            id: 'dd-f-3',
            name: 'Tax Returns 2021-2023.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 3400000,
            modified: '2024-02-09',
            modifiedBy: 'Sarah Chen',
            path: ['Due Diligence', 'Financial Records'],
            status: 'final'
          }
        ]
      },
      {
        id: 'dd-legal',
        name: 'Legal Documents',
        type: 'folder',
        modified: '2024-02-10',
        modifiedBy: 'Jennifer Park',
        path: ['Due Diligence', 'Legal Documents'],
        children: [
          {
            id: 'dd-l-1',
            name: 'Title Report.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 5600000,
            modified: '2024-02-10',
            modifiedBy: 'Jennifer Park',
            path: ['Due Diligence', 'Legal Documents'],
            status: 'approved'
          },
          {
            id: 'dd-l-2',
            name: 'Survey - ALTA.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 12500000,
            modified: '2024-02-09',
            modifiedBy: 'Jennifer Park',
            path: ['Due Diligence', 'Legal Documents'],
            status: 'final'
          },
          {
            id: 'dd-l-3',
            name: 'Zoning Compliance Letter.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 450000,
            modified: '2024-02-08',
            modifiedBy: 'Mike Rodriguez',
            path: ['Due Diligence', 'Legal Documents'],
            status: 'review'
          }
        ]
      },
      {
        id: 'dd-physical',
        name: 'Physical Inspection',
        type: 'folder',
        modified: '2024-02-11',
        modifiedBy: 'David Kim',
        path: ['Due Diligence', 'Physical Inspection'],
        children: [
          {
            id: 'dd-p-1',
            name: 'Property Condition Assessment.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 8900000,
            modified: '2024-02-11',
            modifiedBy: 'David Kim',
            path: ['Due Diligence', 'Physical Inspection'],
            status: 'final'
          },
          {
            id: 'dd-p-2',
            name: 'Phase I Environmental.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 4200000,
            modified: '2024-02-10',
            modifiedBy: 'Sarah Chen',
            path: ['Due Diligence', 'Physical Inspection'],
            status: 'approved'
          }
        ]
      }
    ]
  },
  {
    id: 'contracts',
    name: 'Contracts',
    type: 'folder',
    modified: '2024-02-10',
    modifiedBy: 'Jennifer Park',
    path: ['Contracts'],
    children: [
      {
        id: 'c-1',
        name: 'Purchase Agreement - Executed.pdf',
        type: 'file',
        fileType: 'pdf',
        size: 1800000,
        modified: '2024-02-10',
        modifiedBy: 'Jennifer Park',
        path: ['Contracts'],
        status: 'final',
        tags: ['executed', 'critical']
      },
      {
        id: 'c-2',
        name: 'Financing Term Sheet.pdf',
        type: 'file',
        fileType: 'pdf',
        size: 650000,
        modified: '2024-02-09',
        modifiedBy: 'Mike Rodriguez',
        path: ['Contracts'],
        status: 'review'
      },
      {
        id: 'c-3',
        name: 'Broker Agreement.pdf',
        type: 'file',
        fileType: 'pdf',
        size: 420000,
        modified: '2024-02-08',
        modifiedBy: 'Sarah Chen',
        path: ['Contracts'],
        status: 'final'
      }
    ]
  },
  {
    id: 'photos',
    name: 'Property Photos',
    type: 'folder',
    modified: '2024-02-11',
    modifiedBy: 'David Kim',
    path: ['Property Photos'],
    children: [
      {
        id: 'p-ext',
        name: 'Exterior',
        type: 'folder',
        modified: '2024-02-11',
        modifiedBy: 'David Kim',
        path: ['Property Photos', 'Exterior'],
        children: [
          {
            id: 'p-ext-1',
            name: 'Front Facade.jpg',
            type: 'file',
            fileType: 'jpg',
            size: 4200000,
            modified: '2024-02-11',
            modifiedBy: 'David Kim',
            path: ['Property Photos', 'Exterior'],
            thumbnail: '🏢'
          },
          {
            id: 'p-ext-2',
            name: 'Parking Area.jpg',
            type: 'file',
            fileType: 'jpg',
            size: 3800000,
            modified: '2024-02-11',
            modifiedBy: 'David Kim',
            path: ['Property Photos', 'Exterior'],
            thumbnail: '🅿️'
          }
        ]
      },
      {
        id: 'p-int',
        name: 'Interior',
        type: 'folder',
        modified: '2024-02-11',
        modifiedBy: 'David Kim',
        path: ['Property Photos', 'Interior'],
        children: [
          {
            id: 'p-int-1',
            name: 'Unit 201 - Living.jpg',
            type: 'file',
            fileType: 'jpg',
            size: 2900000,
            modified: '2024-02-11',
            modifiedBy: 'David Kim',
            path: ['Property Photos', 'Interior'],
            thumbnail: '🛋️'
          }
        ]
      }
    ]
  },
  {
    id: 'financials',
    name: 'Financial Models',
    type: 'folder',
    modified: '2024-02-11',
    modifiedBy: 'Sarah Chen',
    path: ['Financial Models'],
    children: [
      {
        id: 'fm-1',
        name: 'Acquisition Model v3.xlsx',
        type: 'file',
        fileType: 'xls',
        size: 1200000,
        modified: '2024-02-11',
        modifiedBy: 'Sarah Chen',
        path: ['Financial Models'],
        status: 'final',
        tags: ['model', 'latest']
      },
      {
        id: 'fm-2',
        name: 'Sensitivity Analysis.xlsx',
        type: 'file',
        fileType: 'xls',
        size: 890000,
        modified: '2024-02-10',
        modifiedBy: 'Mike Rodriguez',
        path: ['Financial Models'],
        status: 'review'
      }
    ]
  }
];

export const acquisitionRecentFiles: RecentFile[] = [
  {
    id: 'rf-1',
    name: 'Rent Roll - Jan 2024.xlsx',
    fileType: 'xls',
    action: 'uploaded',
    timestamp: '2 hours ago',
    user: 'Sarah Chen'
  },
  {
    id: 'rf-2',
    name: 'Property Condition Assessment.pdf',
    fileType: 'pdf',
    action: 'reviewed',
    timestamp: '4 hours ago',
    user: 'David Kim'
  },
  {
    id: 'rf-3',
    name: 'Title Report.pdf',
    fileType: 'pdf',
    action: 'approved',
    timestamp: '1 day ago',
    user: 'Jennifer Park'
  },
  {
    id: 'rf-4',
    name: 'Acquisition Model v3.xlsx',
    fileType: 'xls',
    action: 'updated',
    timestamp: '1 day ago',
    user: 'Sarah Chen'
  },
  {
    id: 'rf-5',
    name: 'Front Facade.jpg',
    fileType: 'jpg',
    action: 'uploaded',
    timestamp: '2 days ago',
    user: 'David Kim'
  }
];

// ==================== PERFORMANCE MODE DATA ====================

export const performanceStats: FileStats[] = [
  {
    label: 'Total Files',
    value: 1842,
    icon: '📄',
    format: 'number',
    trend: { direction: 'up', value: '+45 this month' }
  },
  {
    label: 'Storage Used',
    value: '18.7 GB',
    icon: '💾',
    format: 'size',
    trend: { direction: 'up', value: '+2.3 GB' }
  },
  {
    label: 'Work Orders',
    value: 156,
    icon: '🔧',
    format: 'number'
  },
  {
    label: 'Lease Docs',
    value: 68,
    icon: '📋',
    format: 'number'
  },
  {
    label: 'Recent Uploads',
    value: 23,
    icon: '📤',
    format: 'number'
  }
];

export const performanceFolderStructure: FileItem[] = [
  {
    id: 'leases',
    name: 'Leases & Tenants',
    type: 'folder',
    modified: '2024-02-11',
    modifiedBy: 'Emily Watson',
    path: ['Leases & Tenants'],
    children: [
      {
        id: 'l-current',
        name: 'Current Leases',
        type: 'folder',
        modified: '2024-02-11',
        modifiedBy: 'Emily Watson',
        path: ['Leases & Tenants', 'Current Leases'],
        children: [
          {
            id: 'l-c-1',
            name: 'Unit 101 - Smith Lease.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 850000,
            modified: '2024-02-11',
            modifiedBy: 'Emily Watson',
            path: ['Leases & Tenants', 'Current Leases'],
            status: 'final',
            tags: ['active']
          },
          {
            id: 'l-c-2',
            name: 'Unit 203 - Johnson Lease.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 920000,
            modified: '2024-02-10',
            modifiedBy: 'Emily Watson',
            path: ['Leases & Tenants', 'Current Leases'],
            status: 'final',
            tags: ['active']
          },
          {
            id: 'l-c-3',
            name: 'Unit 305 - Davis Renewal.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 780000,
            modified: '2024-02-09',
            modifiedBy: 'Emily Watson',
            path: ['Leases & Tenants', 'Current Leases'],
            status: 'review',
            tags: ['renewal']
          }
        ]
      },
      {
        id: 'l-expired',
        name: 'Expired Leases',
        type: 'folder',
        modified: '2024-02-08',
        modifiedBy: 'Emily Watson',
        path: ['Leases & Tenants', 'Expired Leases'],
        children: [
          {
            id: 'l-e-1',
            name: 'Unit 402 - Brown Lease.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 650000,
            modified: '2024-01-31',
            modifiedBy: 'Emily Watson',
            path: ['Leases & Tenants', 'Expired Leases'],
            status: 'final'
          }
        ]
      },
      {
        id: 'l-apps',
        name: 'Lease Applications',
        type: 'folder',
        modified: '2024-02-11',
        modifiedBy: 'Emily Watson',
        path: ['Leases & Tenants', 'Lease Applications'],
        children: [
          {
            id: 'l-a-1',
            name: 'Unit 402 - Wilson Application.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 420000,
            modified: '2024-02-11',
            modifiedBy: 'Emily Watson',
            path: ['Leases & Tenants', 'Lease Applications'],
            status: 'review',
            tags: ['pending']
          }
        ]
      }
    ]
  },
  {
    id: 'maintenance',
    name: 'Maintenance & Work Orders',
    type: 'folder',
    modified: '2024-02-12',
    modifiedBy: 'Carlos Rivera',
    path: ['Maintenance & Work Orders'],
    children: [
      {
        id: 'm-open',
        name: 'Open Work Orders',
        type: 'folder',
        modified: '2024-02-12',
        modifiedBy: 'Carlos Rivera',
        path: ['Maintenance & Work Orders', 'Open Work Orders'],
        children: [
          {
            id: 'm-o-1',
            name: 'WO-2024-045 - HVAC Repair Unit 201.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 1200000,
            modified: '2024-02-12',
            modifiedBy: 'Carlos Rivera',
            path: ['Maintenance & Work Orders', 'Open Work Orders'],
            status: 'draft',
            tags: ['urgent']
          },
          {
            id: 'm-o-2',
            name: 'WO-2024-046 - Plumbing Leak Unit 104.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 980000,
            modified: '2024-02-11',
            modifiedBy: 'Carlos Rivera',
            path: ['Maintenance & Work Orders', 'Open Work Orders'],
            status: 'review'
          }
        ]
      },
      {
        id: 'm-completed',
        name: 'Completed',
        type: 'folder',
        modified: '2024-02-10',
        modifiedBy: 'Carlos Rivera',
        path: ['Maintenance & Work Orders', 'Completed'],
        children: [
          {
            id: 'm-c-1',
            name: 'WO-2024-042 - Paint Common Area.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 650000,
            modified: '2024-02-10',
            modifiedBy: 'Carlos Rivera',
            path: ['Maintenance & Work Orders', 'Completed'],
            status: 'final'
          }
        ]
      },
      {
        id: 'm-vendors',
        name: 'Vendor Invoices',
        type: 'folder',
        modified: '2024-02-11',
        modifiedBy: 'Carlos Rivera',
        path: ['Maintenance & Work Orders', 'Vendor Invoices'],
        children: [
          {
            id: 'm-v-1',
            name: 'HVAC Services - Jan 2024.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 340000,
            modified: '2024-02-11',
            modifiedBy: 'Carlos Rivera',
            path: ['Maintenance & Work Orders', 'Vendor Invoices'],
            status: 'approved'
          }
        ]
      }
    ]
  },
  {
    id: 'operations',
    name: 'Operations',
    type: 'folder',
    modified: '2024-02-11',
    modifiedBy: 'Lisa Martinez',
    path: ['Operations'],
    children: [
      {
        id: 'o-monthly',
        name: 'Monthly Reports',
        type: 'folder',
        modified: '2024-02-11',
        modifiedBy: 'Lisa Martinez',
        path: ['Operations', 'Monthly Reports'],
        children: [
          {
            id: 'o-m-1',
            name: 'January 2024 Operations Report.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 2100000,
            modified: '2024-02-11',
            modifiedBy: 'Lisa Martinez',
            path: ['Operations', 'Monthly Reports'],
            status: 'final'
          },
          {
            id: 'o-m-2',
            name: 'January 2024 Variance Analysis.xlsx',
            type: 'file',
            fileType: 'xls',
            size: 780000,
            modified: '2024-02-10',
            modifiedBy: 'Lisa Martinez',
            path: ['Operations', 'Monthly Reports'],
            status: 'final'
          }
        ]
      },
      {
        id: 'o-budget',
        name: 'Budget & Forecasting',
        type: 'folder',
        modified: '2024-02-09',
        modifiedBy: 'Lisa Martinez',
        path: ['Operations', 'Budget & Forecasting'],
        children: [
          {
            id: 'o-b-1',
            name: '2024 Operating Budget.xlsx',
            type: 'file',
            fileType: 'xls',
            size: 1400000,
            modified: '2024-01-15',
            modifiedBy: 'Lisa Martinez',
            path: ['Operations', 'Budget & Forecasting'],
            status: 'final',
            tags: ['approved']
          }
        ]
      },
      {
        id: 'o-inspections',
        name: 'Inspections',
        type: 'folder',
        modified: '2024-02-08',
        modifiedBy: 'Carlos Rivera',
        path: ['Operations', 'Inspections'],
        children: [
          {
            id: 'o-i-1',
            name: 'Fire Safety Inspection - Jan 2024.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 1800000,
            modified: '2024-02-08',
            modifiedBy: 'Carlos Rivera',
            path: ['Operations', 'Inspections'],
            status: 'final'
          }
        ]
      }
    ]
  },
  {
    id: 'financial',
    name: 'Financial Records',
    type: 'folder',
    modified: '2024-02-11',
    modifiedBy: 'Lisa Martinez',
    path: ['Financial Records'],
    children: [
      {
        id: 'f-statements',
        name: 'Financial Statements',
        type: 'folder',
        modified: '2024-02-11',
        modifiedBy: 'Lisa Martinez',
        path: ['Financial Records', 'Financial Statements'],
        children: [
          {
            id: 'f-s-1',
            name: 'Q4 2023 Financial Package.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 3200000,
            modified: '2024-02-11',
            modifiedBy: 'Lisa Martinez',
            path: ['Financial Records', 'Financial Statements'],
            status: 'final'
          }
        ]
      },
      {
        id: 'f-rent',
        name: 'Rent Rolls',
        type: 'folder',
        modified: '2024-02-11',
        modifiedBy: 'Emily Watson',
        path: ['Financial Records', 'Rent Rolls'],
        children: [
          {
            id: 'f-r-1',
            name: 'Rent Roll - Feb 2024.xlsx',
            type: 'file',
            fileType: 'xls',
            size: 280000,
            modified: '2024-02-11',
            modifiedBy: 'Emily Watson',
            path: ['Financial Records', 'Rent Rolls'],
            status: 'final'
          }
        ]
      }
    ]
  },
  {
    id: 'legal-perf',
    name: 'Legal & Compliance',
    type: 'folder',
    modified: '2024-02-10',
    modifiedBy: 'Jennifer Park',
    path: ['Legal & Compliance'],
    children: [
      {
        id: 'lp-insurance',
        name: 'Insurance',
        type: 'folder',
        modified: '2024-02-10',
        modifiedBy: 'Jennifer Park',
        path: ['Legal & Compliance', 'Insurance'],
        children: [
          {
            id: 'lp-i-1',
            name: 'Property Insurance Policy 2024.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 4500000,
            modified: '2024-02-10',
            modifiedBy: 'Jennifer Park',
            path: ['Legal & Compliance', 'Insurance'],
            status: 'final'
          }
        ]
      },
      {
        id: 'lp-permits',
        name: 'Permits & Licenses',
        type: 'folder',
        modified: '2024-02-08',
        modifiedBy: 'Carlos Rivera',
        path: ['Legal & Compliance', 'Permits & Licenses'],
        children: [
          {
            id: 'lp-p-1',
            name: 'Building Permit - Roof Repair.pdf',
            type: 'file',
            fileType: 'pdf',
            size: 680000,
            modified: '2024-02-08',
            modifiedBy: 'Carlos Rivera',
            path: ['Legal & Compliance', 'Permits & Licenses'],
            status: 'approved'
          }
        ]
      }
    ]
  }
];

export const performanceRecentFiles: RecentFile[] = [
  {
    id: 'prf-1',
    name: 'WO-2024-045 - HVAC Repair Unit 201.pdf',
    fileType: 'pdf',
    action: 'created',
    timestamp: '1 hour ago',
    user: 'Carlos Rivera'
  },
  {
    id: 'prf-2',
    name: 'Unit 101 - Smith Lease.pdf',
    fileType: 'pdf',
    action: 'updated',
    timestamp: '3 hours ago',
    user: 'Emily Watson'
  },
  {
    id: 'prf-3',
    name: 'January 2024 Operations Report.pdf',
    fileType: 'pdf',
    action: 'uploaded',
    timestamp: '1 day ago',
    user: 'Lisa Martinez'
  },
  {
    id: 'prf-4',
    name: 'Rent Roll - Feb 2024.xlsx',
    fileType: 'xls',
    action: 'updated',
    timestamp: '1 day ago',
    user: 'Emily Watson'
  },
  {
    id: 'prf-5',
    name: 'Unit 402 - Wilson Application.pdf',
    fileType: 'pdf',
    action: 'uploaded',
    timestamp: '2 days ago',
    user: 'Emily Watson'
  }
];

// ==================== SHARED DATA ====================

export const quickActions: QuickAction[] = [
  {
    id: 'upload',
    label: 'Upload Files',
    icon: '📤',
    color: 'blue'
  },
  {
    id: 'new-folder',
    label: 'New Folder',
    icon: '📁',
    color: 'purple'
  },
  {
    id: 'search',
    label: 'Search Files',
    icon: '🔍',
    color: 'green'
  },
  {
    id: 'share',
    label: 'Share',
    icon: '🔗',
    color: 'orange'
  },
  {
    id: 'organize',
    label: 'Organize',
    icon: '📊',
    color: 'indigo'
  }
];

// Helper functions
export const getFileIcon = (fileType: string): string => {
  const icons: Record<string, string> = {
    pdf: '📄',
    doc: '📝',
    xls: '📊',
    jpg: '🖼️',
    png: '🖼️',
    zip: '📦',
    txt: '📃',
    dwg: '📐',
    folder: '📁'
  };
  return icons[fileType] || '📄';
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export const getStatusBadgeColor = (status?: string): string => {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    review: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    final: 'bg-blue-100 text-blue-700'
  };
  return status ? colors[status] || 'bg-gray-100 text-gray-700' : '';
};
