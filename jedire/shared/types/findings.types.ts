/**
 * Shared types for Key Findings system
 * Used by both frontend and backend
 */

export type FindingType = 'news' | 'property' | 'market' | 'deal';
export type FindingPriority = 'urgent' | 'important' | 'info';

export interface Finding {
  id: string;
  type: FindingType;
  priority: FindingPriority;
  title: string;
  description: string;
  timestamp: string;
  link: string;
  metadata?: FindingMetadata;
}

export interface FindingMetadata {
  // News-specific
  category?: string;
  affectedDeals?: number;
  location?: string;
  
  // Property-specific
  address?: string;
  city?: string;
  state?: string;
  propertyType?: string;
  
  // Market-specific
  dealId?: string;
  dealName?: string;
  metric?: string;
  change?: number;
  
  // Deal-specific
  status?: string;
  pendingTasks?: number;
}

export interface FindingsResponse {
  news: Finding[];
  properties: Finding[];
  market: Finding[];
  deals: Finding[];
}

export interface FindingsAPIResponse {
  success: boolean;
  data: FindingsResponse;
  timestamp: string;
}

// Query parameters for findings endpoint
export interface FindingsQueryParams {
  category?: 'news' | 'properties' | 'market' | 'deals' | 'all';
}

// News event severity mapping
export type NewsSeverity = 'minimal' | 'moderate' | 'significant' | 'high' | 'critical';

export const SEVERITY_TO_PRIORITY: Record<NewsSeverity, FindingPriority> = {
  minimal: 'info',
  moderate: 'info',
  significant: 'important',
  high: 'urgent',
  critical: 'urgent',
};

// Deal status mapping
export type DealStatus = 
  | 'PROSPECT'
  | 'UNDERWRITING'
  | 'LOI'
  | 'DUE_DILIGENCE'
  | 'PENDING_DECISION'
  | 'STALLED'
  | 'CLOSING'
  | 'CLOSED'
  | 'PASSED';

export const CRITICAL_DEAL_STATUSES: DealStatus[] = ['STALLED', 'PENDING_DECISION'];

// Category configuration
export interface CategoryConfig {
  label: string;
  icon: string;
  emptyMessage: string;
  detailPage: string;
}

export const CATEGORY_CONFIGS: Record<keyof FindingsResponse, CategoryConfig> = {
  news: {
    label: 'News Intelligence',
    icon: '📰',
    emptyMessage: 'No recent news in your deal areas',
    detailPage: '/news-intel',
  },
  properties: {
    label: 'Property Alerts',
    icon: '🏢',
    emptyMessage: 'No property alerts at the moment',
    detailPage: '/properties',
  },
  market: {
    label: 'Market Signals',
    icon: '📈',
    emptyMessage: 'No significant market changes detected',
    detailPage: '/market-data',
  },
  deals: {
    label: 'Deal Alerts',
    icon: '⚠️',
    emptyMessage: 'All deals are on track',
    detailPage: '/deals',
  },
};
