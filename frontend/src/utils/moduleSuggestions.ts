/**
 * Module Suggestion Logic
 * 
 * Maps deal types and strategies to recommended modules
 */

import { ModuleName } from './modules';

export interface ModuleSuggestion {
  moduleSlug: ModuleName;
  name: string;
  description: string;
  icon: string;
  isIncluded: boolean; // Whether it's included in user's current subscription
  price?: number; // Monthly price if not included
  bundleInfo?: string; // Which bundle includes this
}

// Deal type + strategy combinations mapped to module recommendations
export const MODULE_SUGGESTIONS: Record<string, ModuleName[]> = {
  // Multifamily strategies
  'multifamily-value-add': [
    'financial-modeling-pro',
    'strategy-arbitrage',
    'dd-checklist',
    'risk-analysis',
    'returns-calculator',
    'comp-analysis',
  ],
  'multifamily-core': [
    'financial-modeling-pro',
    'returns-calculator',
    'budget-vs-actual',
    'investor-reporting',
    'portfolio-dashboard',
  ],
  'multifamily-development': [
    'development-budget',
    'timeline',
    'entitlements',
    'zoning-analysis',
    'supply-pipeline',
    'financial-modeling-pro',
  ],
  'multifamily-ground-up': [
    'development-budget',
    'timeline',
    'entitlements',
    'zoning-analysis',
    'environmental',
    'supply-pipeline',
  ],
  
  // Office strategies
  'office-value-add': [
    'financial-modeling-pro',
    'strategy-arbitrage',
    'dd-checklist',
    'market-snapshot',
    'comp-analysis',
  ],
  'office-core': [
    'financial-modeling-pro',
    'returns-calculator',
    'budget-vs-actual',
    'investor-reporting',
  ],
  'office-development': [
    'development-budget',
    'timeline',
    'entitlements',
    'zoning-analysis',
    'supply-pipeline',
    'environmental',
  ],
  
  // Retail strategies
  'retail-value-add': [
    'financial-modeling-pro',
    'strategy-arbitrage',
    'traffic-analysis',
    'market-snapshot',
    'dd-checklist',
  ],
  'retail-ground-up': [
    'development-budget',
    'timeline',
    'zoning-analysis',
    'traffic-analysis',
    'supply-pipeline',
  ],
  
  // Industrial strategies
  'industrial-value-add': [
    'financial-modeling-pro',
    'strategy-arbitrage',
    'dd-checklist',
    'comp-analysis',
    'returns-calculator',
  ],
  'industrial-development': [
    'development-budget',
    'timeline',
    'zoning-analysis',
    'supply-pipeline',
    'environmental',
  ],
  
  // Mixed-use
  'mixed-use-development': [
    'development-budget',
    'timeline',
    'entitlements',
    'zoning-analysis',
    'financial-modeling-pro',
    'supply-pipeline',
  ],
  'mixed-use-redevelopment': [
    'financial-modeling-pro',
    'strategy-arbitrage',
    'zoning-analysis',
    'development-budget',
    'dd-checklist',
  ],
  
  // Land
  'land-hold': [
    'market-snapshot',
    'supply-pipeline',
    'zoning-analysis',
    'news-sentiment',
  ],
  'land-development': [
    'development-budget',
    'timeline',
    'entitlements',
    'zoning-analysis',
    'environmental',
    'supply-pipeline',
  ],
  
  // Default fallback
  'default': [
    'financial-modeling-pro',
    'strategy-arbitrage',
    'dd-checklist',
    'market-snapshot',
  ],
};

/**
 * Get recommended modules for a deal based on type and strategy
 * 
 * @param dealType - Property type (e.g., 'multifamily', 'office')
 * @param strategy - Investment strategy (e.g., 'value-add', 'core', 'development')
 * @returns Array of recommended module slugs
 */
export function getRecommendedModules(dealType: string, strategy: string): ModuleName[] {
  // Normalize inputs
  const normalizedType = dealType.toLowerCase().replace(/\s+/g, '-');
  const normalizedStrategy = strategy.toLowerCase().replace(/\s+/g, '-');
  
  // Try exact match first
  const key = `${normalizedType}-${normalizedStrategy}`;
  if (MODULE_SUGGESTIONS[key]) {
    return MODULE_SUGGESTIONS[key];
  }
  
  // Try type-specific fallback (e.g., just 'multifamily' if 'multifamily-opportunistic' not found)
  const typeKeys = Object.keys(MODULE_SUGGESTIONS).filter(k => k.startsWith(normalizedType));
  if (typeKeys.length > 0) {
    // Return suggestions from first matching type
    return MODULE_SUGGESTIONS[typeKeys[0]];
  }
  
  // Return default suggestions
  return MODULE_SUGGESTIONS['default'];
}

/**
 * Module metadata for display
 */
export const MODULE_METADATA: Record<ModuleName, { name: string; description: string; icon: string }> = {
  'financial-modeling-pro': {
    name: 'Financial Modeling Pro',
    icon: '💰',
    description: 'Component-based pro-forma builder with advanced scenarios',
  },
  'strategy-arbitrage': {
    name: 'Strategy Arbitrage',
    icon: '🎯',
    description: 'AI-powered investment strategy recommendations',
  },
  'returns-calculator': {
    name: 'Returns Calculator',
    icon: '📊',
    description: 'IRR, cash-on-cash, and equity multiple analysis',
  },
  'comp-analysis': {
    name: 'Comp Analysis',
    icon: '🏢',
    description: 'Automated comparable property analysis',
  },
  'debt-analyzer': {
    name: 'Debt Analyzer',
    icon: '🏦',
    description: 'Loan structuring and debt service coverage',
  },
  'valuation': {
    name: 'Valuation',
    icon: '💵',
    description: 'Cap rate and DCF valuation models',
  },
  'zoning-analysis': {
    name: 'Zoning Analysis',
    icon: '📋',
    description: 'Zoning code lookup and entitlement assessment',
  },
  'development-budget': {
    name: 'Development Budget',
    icon: '🏗️',
    description: 'Construction budget tracking and variance analysis',
  },
  'timeline': {
    name: 'Timeline',
    icon: '📅',
    description: 'Project timeline with critical path analysis',
  },
  'entitlements': {
    name: 'Entitlements',
    icon: '📜',
    description: 'Entitlement tracking and approval workflows',
  },
  'supply-pipeline': {
    name: 'Supply Pipeline',
    icon: '🏭',
    description: 'Track competitive supply and planned developments',
  },
  'dd-checklist': {
    name: 'Due Diligence Suite',
    icon: '✅',
    description: 'Smart checklist with risk scoring',
  },
  'risk-analysis': {
    name: 'Risk Analysis',
    icon: '⚠️',
    description: 'Monte Carlo simulation and sensitivity analysis',
  },
  'insurance': {
    name: 'Insurance',
    icon: '🛡️',
    description: 'Insurance requirement tracking and quotes',
  },
  'environmental': {
    name: 'Environmental',
    icon: '🌱',
    description: 'Phase I/II ESA tracking and environmental reports',
  },
  'market-snapshot': {
    name: 'Market Signals',
    icon: '📈',
    description: 'Supply pipeline & competitor tracking',
  },
  'traffic-analysis': {
    name: 'Traffic Analysis',
    icon: '🚗',
    description: 'Traffic counts and accessibility scoring',
  },
  'news-sentiment': {
    name: 'News Sentiment',
    icon: '📰',
    description: 'AI-powered market news and sentiment analysis',
  },
  'om-analyzer': {
    name: 'OM Analyzer',
    icon: '📄',
    description: 'Offering memorandum extraction and analysis',
  },
  'tasks': {
    name: 'Tasks',
    icon: '✓',
    description: 'Deal-specific task management',
  },
  'notes': {
    name: 'Notes',
    icon: '📝',
    description: 'Deal notes and observations',
  },
  'documents': {
    name: 'Documents',
    icon: '📁',
    description: 'Document management and version control',
  },
  'deal-deck': {
    name: 'Deal Deck',
    icon: '🎨',
    description: 'Automated investment deck generation',
  },
  'communication-log': {
    name: 'Communication Log',
    icon: '💬',
    description: 'Track emails and calls related to this deal',
  },
  'budget-vs-actual': {
    name: 'Budget vs Actual',
    icon: '📉',
    description: 'Track budget variance and burn rate',
  },
  'investor-reporting': {
    name: 'Investor Reporting',
    icon: '📊',
    description: 'Automated investor reports and dashboards',
  },
  'disposition-analysis': {
    name: 'Disposition Analysis',
    icon: '💸',
    description: 'Exit strategy and sale scenario modeling',
  },
  'deal-team': {
    name: 'Deal Team',
    icon: '👥',
    description: 'Team collaboration and permissions',
  },
  'portfolio-dashboard': {
    name: 'Portfolio Dashboard',
    icon: '📊',
    description: 'Portfolio-level analytics and reporting dashboard',
  },
};
