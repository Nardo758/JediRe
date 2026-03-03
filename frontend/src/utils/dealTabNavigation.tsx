export type DealTabId =
  | 'overview'
  | 'map'
  | 'ai-agent'
  | 'competition'
  | 'supply'
  | 'debt'
  | 'financial'
  | 'market'
  | 'strategy'
  | 'exit'
  | 'due-diligence'
  | 'documents'
  | 'team'
  | 'context'
  | 'notes'
  | 'timeline'
  | 'files';

export interface DealTabLink {
  id: DealTabId;
  label: string;
  icon: string;
  description?: string;
}

export const navigateToTab = (tabId: DealTabId, behavior: ScrollBehavior = 'smooth') => {
  const element = document.getElementById(`section-${tabId}`);
  if (element) {
    element.scrollIntoView({ behavior, block: 'start' });
    element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
    setTimeout(() => {
      element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
    }, 1500);
  }
};

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

export const tabSuggestions = {
  newsToMap: {
    id: 'map' as DealTabId,
    label: 'View on Map',
    icon: '🗺️',
    description: 'See location intelligence for this news'
  },
  toAIAgent: {
    id: 'ai-agent' as DealTabId,
    label: 'Ask AI Agent',
    icon: '🤖',
    description: 'Get AI insights and analysis'
  },
  financialToStrategy: {
    id: 'strategy' as DealTabId,
    label: 'View Strategy',
    icon: '🎯',
    description: 'See strategic recommendations'
  },
  marketToCompetition: {
    id: 'competition' as DealTabId,
    label: 'View Competition',
    icon: '🏆',
    description: 'Analyze competitive landscape'
  },
  propertiesToMap: {
    id: 'map' as DealTabId,
    label: 'View on Map',
    icon: '🗺️',
    description: 'See properties on interactive map'
  },
  notesToMap: {
    id: 'map' as DealTabId,
    label: 'View Location',
    icon: '🗺️',
    description: 'See on map'
  }
};

export const getRelatedTabs = (currentTabId: DealTabId): DealTabLink[] => {
  const relations: Record<DealTabId, DealTabId[]> = {
    'overview': ['map', 'ai-agent', 'financial'],
    'map': ['competition', 'market'],
    'ai-agent': ['overview', 'financial', 'strategy'],
    'financial': ['strategy', 'exit', 'debt'],
    'market': ['competition', 'supply', 'strategy'],
    'competition': ['market', 'strategy', 'map'],
    'supply': ['market', 'competition'],
    'debt': ['financial', 'strategy', 'exit'],
    'strategy': ['financial', 'exit', 'market'],
    'exit': ['financial', 'strategy', 'market'],
    'due-diligence': ['documents', 'financial'],
    'documents': ['due-diligence', 'notes', 'team'],
    'team': ['notes', 'context', 'documents'],
    'context': ['team', 'notes', 'timeline'],
    'notes': ['context', 'documents', 'map'],
    'timeline': ['overview', 'context', 'due-diligence'],
    'files': ['documents', 'notes']
  };

  const tabLabels: Record<DealTabId, { label: string; icon: string }> = {
    'overview': { label: 'Overview', icon: '📊' },
    'map': { label: 'Map View', icon: '🗺️' },
    'ai-agent': { label: 'AI Agent', icon: '🤖' },
    'competition': { label: 'Competition', icon: '🏆' },
    'supply': { label: 'Supply', icon: '📦' },
    'debt': { label: 'Debt', icon: '💳' },
    'financial': { label: 'Financial', icon: '💰' },
    'market': { label: 'Market', icon: '📈' },
    'strategy': { label: 'Strategy', icon: '🎯' },
    'exit': { label: 'Exit Analysis', icon: '🚪' },
    'due-diligence': { label: 'Due Diligence', icon: '✅' },
    'documents': { label: 'Documents', icon: '📄' },
    'team': { label: 'Team', icon: '👥' },
    'context': { label: 'Context', icon: '🧭' },
    'notes': { label: 'Notes', icon: '💬' },
    'timeline': { label: 'Timeline', icon: '📅' },
    'files': { label: 'Files', icon: '📁' }
  };

  const relatedIds = relations[currentTabId] || [];
  return relatedIds.map(id => ({
    id,
    ...tabLabels[id]
  }));
};

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
