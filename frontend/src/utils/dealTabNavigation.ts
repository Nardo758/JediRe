/**
 * Deal Tab Navigation Utilities
 * Helper functions for cross-tab linking within deal pages
 */

export type DealTabId =
  | 'overview'
  | 'map-view'
  | 'ai-agent'
  | 'properties'
  | 'financial'
  | 'market'
  | 'competition'
  | 'supply-tracking'
  | 'debt-market'
  | 'strategy'
  | 'exit'
  | 'due-diligence'
  | 'documents'
  | 'team'
  | 'context-tracker'
  | 'notes'
  | 'timeline';

export interface DealTabLink {
  id: DealTabId;
  label: string;
  icon: string;
  description?: string;
}

/**
 * Navigate to a specific tab section
 */
export const navigateToTab = (tabId: DealTabId, behavior: ScrollBehavior = 'smooth') => {
  const element = document.getElementById(`section-${tabId}`);
  if (element) {
    element.scrollIntoView({ behavior, block: 'start' });
    
    // Briefly highlight the section
    element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
    setTimeout(() => {
      element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
    }, 1500);
  }
};

/**
 * Create a tab link button component props
 */
export const createTabLink = (
  tabId: DealTabId,
  label?: string,
  variant: 'primary' | 'secondary' | 'text' = 'secondary'
): {
  onClick: () => void;
  className: string;
  children: string;
} => {
  const variantClasses = {
    primary: 'px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors',
    secondary: 'px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors',
    text: 'text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors'
  };

  return {
    onClick: () => navigateToTab(tabId),
    className: variantClasses[variant],
    children: label || `View ${tabId.replace('-', ' ')}`
  };
};

/**
 * Common tab suggestions by context
 */
export const tabSuggestions = {
  // From News Intelligence → Map View
  newsToMap: {
    id: 'map-view' as DealTabId,
    label: 'View on Map',
    icon: '🗺️',
    description: 'See location intelligence for this news'
  },
  
  // From any section → AI Agent
  toAIAgent: {
    id: 'ai-agent' as DealTabId,
    label: 'Ask AI Agent',
    icon: '🤖',
    description: 'Get AI insights and analysis'
  },
  
  // From Financial → Strategy
  financialToStrategy: {
    id: 'strategy' as DealTabId,
    label: 'View Strategy',
    icon: '🎯',
    description: 'See strategic recommendations'
  },
  
  // From Market → Competition
  marketToCompetition: {
    id: 'competition' as DealTabId,
    label: 'View Competition',
    icon: '🏆',
    description: 'Analyze competitive landscape'
  },
  
  // From Properties → Map View
  propertiesToMap: {
    id: 'map-view' as DealTabId,
    label: 'View on Map',
    icon: '🗺️',
    description: 'See properties on interactive map'
  },
  
  // From Notes → Map View
  notesToMap: {
    id: 'map-view' as DealTabId,
    label: 'View Location',
    icon: '🗺️',
    description: 'See on map'
  }
};

/**
 * Get related tabs for a given tab
 */
export const getRelatedTabs = (currentTabId: DealTabId): DealTabLink[] => {
  const relations: Record<DealTabId, DealTabId[]> = {
    'overview': ['map-view', 'ai-agent', 'properties', 'financial'],
    'map-view': ['properties', 'competition', 'market'],
    'ai-agent': ['overview', 'financial', 'strategy'],
    'properties': ['map-view', 'financial', 'market'],
    'financial': ['strategy', 'exit', 'debt-market'],
    'market': ['competition', 'supply-tracking', 'strategy'],
    'competition': ['market', 'strategy', 'map-view'],
    'supply-tracking': ['market', 'properties', 'competition'],
    'debt-market': ['financial', 'strategy', 'exit'],
    'strategy': ['financial', 'exit', 'market'],
    'exit': ['financial', 'strategy', 'market'],
    'due-diligence': ['properties', 'documents', 'financial'],
    'documents': ['due-diligence', 'notes', 'team'],
    'team': ['notes', 'context-tracker', 'documents'],
    'context-tracker': ['team', 'notes', 'timeline'],
    'notes': ['context-tracker', 'documents', 'map-view'],
    'timeline': ['overview', 'context-tracker', 'due-diligence']
  };

  const tabLabels: Record<DealTabId, { label: string; icon: string }> = {
    'overview': { label: 'Overview', icon: '📊' },
    'map-view': { label: 'Map View', icon: '🗺️' },
    'ai-agent': { label: 'AI Agent', icon: '🤖' },
    'properties': { label: 'Properties', icon: '🏢' },
    'financial': { label: 'Financial', icon: '💰' },
    'market': { label: 'Market Analysis', icon: '📈' },
    'competition': { label: 'Competition', icon: '🏆' },
    'supply-tracking': { label: 'Supply Tracking', icon: '📦' },
    'debt-market': { label: 'Debt & Financing', icon: '💳' },
    'strategy': { label: 'Strategy', icon: '🎯' },
    'exit': { label: 'Exit Strategy', icon: '🚪' },
    'due-diligence': { label: 'Due Diligence', icon: '✅' },
    'documents': { label: 'Documents', icon: '📄' },
    'team': { label: 'Team', icon: '👥' },
    'context-tracker': { label: 'Context Tracker', icon: '🧭' },
    'notes': { label: 'Notes', icon: '💬' },
    'timeline': { label: 'Timeline', icon: '📅' }
  };

  const relatedIds = relations[currentTabId] || [];
  return relatedIds.map(id => ({
    id,
    ...tabLabels[id]
  }));
};

/**
 * React component helper for tab link button
 */
export const TabLinkButton: React.FC<{
  tabId: DealTabId;
  label?: string;
  variant?: 'primary' | 'secondary' | 'text';
  icon?: string;
  className?: string;
}> = ({ tabId, label, variant = 'secondary', icon, className }) => {
  const baseClasses = {
    primary: 'px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors',
    secondary: 'px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors',
    text: 'text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors inline-flex items-center gap-1'
  };

  return (
    <button
      onClick={() => navigateToTab(tabId)}
      className={className || baseClasses[variant]}
    >
      {icon && <span>{icon}</span>}
      {label || `View ${tabId.replace('-', ' ')}`}
    </button>
  );
};
