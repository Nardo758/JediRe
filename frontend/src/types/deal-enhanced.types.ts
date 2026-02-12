/**
 * JEDI RE Enhanced Deal Page - Type Definitions
 * Skeleton structure only - types for enhanced deal page components
 */

export interface DealSection {
  id: string;
  title: string;
  icon: string;
  defaultExpanded?: boolean;
  isPremium?: boolean;
  status?: 'to-be-built' | 'in-progress' | 'complete';
  description?: string;
}

export interface PlaceholderContentProps {
  title: string;
  description: string;
  status?: 'to-be-built' | 'in-progress' | 'complete' | 'coming-soon';
  icon?: string;
  wireframe?: string; // ASCII art or description
  children?: React.ReactNode;
}

export interface ModuleToggleProps {
  mode: 'basic' | 'enhanced';
  onModeChange: (mode: 'basic' | 'enhanced') => void;
  isPremium?: boolean;
}

export interface DealSectionProps {
  id: string;
  icon: string;
  title: string;
  defaultExpanded?: boolean;
  isPremium?: boolean;
  comingSoon?: boolean;
  children: React.ReactNode;
}

export interface ContextTrackerTab {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const CONTEXT_TRACKER_TABS: ContextTrackerTab[] = [
  {
    id: 'activity-timeline',
    name: 'Activity Timeline',
    icon: '📋',
    description: 'Chronological view of all deal activities, updates, and milestones'
  },
  {
    id: 'contact-map',
    name: 'Contact Map',
    icon: '👥',
    description: 'Visual network of all stakeholders, contacts, and relationships'
  },
  {
    id: 'document-vault',
    name: 'Document Vault',
    icon: '📁',
    description: 'Organized repository of all deal documents, contracts, and files'
  },
  {
    id: 'financial-snapshot',
    name: 'Financial Snapshot',
    icon: '💰',
    description: 'Quick view of key financial metrics, budget, and forecasts'
  },
  {
    id: 'key-dates',
    name: 'Key Dates',
    icon: '📅',
    description: 'Important deadlines, milestones, and calendar events'
  },
  {
    id: 'decision-log',
    name: 'Decision Log',
    icon: '📝',
    description: 'Record of all major decisions, approvals, and rationale'
  },
  {
    id: 'risk-flags',
    name: 'Risk Flags',
    icon: '⚠️',
    description: 'Active risks, concerns, and mitigation strategies'
  }
];

export const DEAL_SECTIONS: DealSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    icon: '📊',
    defaultExpanded: true,
    description: 'Property-specific details, metrics, and performance summary'
  },
  {
    id: 'market-competition',
    title: 'Market Competition',
    icon: '🏆',
    isPremium: true,
    description: 'Competitive analysis, comparable properties, market positioning'
  },
  {
    id: 'supply-tracking',
    title: 'Supply Tracking',
    icon: '📦',
    isPremium: true,
    description: 'Pipeline monitoring, new construction, supply impact analysis'
  },
  {
    id: 'debt-market',
    title: 'Debt Market',
    icon: '💳',
    isPremium: true,
    description: 'Interest rates, lending conditions, financing options tracking'
  },
  {
    id: 'ai-agent',
    title: 'AI Agent (Opus)',
    icon: '🤖',
    isPremium: true,
    description: 'Claude Opus-powered deal analysis and recommendations'
  },
  {
    id: 'financial',
    title: 'Financial Analysis',
    icon: '💰',
    isPremium: true,
    description: 'Pro forma, cash flow models, ROI calculations, sensitivity analysis'
  },
  {
    id: 'strategy',
    title: 'Strategy & Arbitrage',
    icon: '🎯',
    isPremium: true,
    description: 'Deal strategies including custom strategies and debt strategy builder'
  },
  {
    id: 'exit',
    title: 'Exit Strategy',
    icon: '🚪',
    isPremium: true,
    description: 'Exit planning, scenarios, timing analysis, broker recommendations, and market readiness'
  },
  {
    id: 'due-diligence',
    title: 'Due Diligence',
    icon: '✅',
    description: 'Checklists, inspections, legal review, environmental reports'
  },
  {
    id: 'properties',
    title: 'Properties',
    icon: '🏢',
    description: 'Property details, comps, unit mix, amenities, conditions'
  },
  {
    id: 'market',
    title: 'Market Analysis',
    icon: '📈',
    isPremium: true,
    description: 'Market trends, demographics, supply/demand analysis'
  },
  {
    id: 'documents',
    title: 'Documents',
    icon: '📄',
    description: 'All deal-related documents, contracts, reports, and files'
  },
  {
    id: 'team',
    title: 'Team & Communications',
    icon: '👥',
    description: 'Team members, stakeholders, communication history'
  },
  {
    id: 'context-tracker',
    title: 'Deal Context Tracker',
    icon: '🧭',
    description: 'Multi-dimensional view of deal context, activity, and status'
  },
  {
    id: 'notes',
    title: 'Notes & Comments',
    icon: '💬',
    description: 'Deal notes, comments, thoughts, and collaborative discussions'
  }
];
