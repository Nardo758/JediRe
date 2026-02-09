/**
 * Module Management Utilities
 * 
 * Functions for checking and managing user module subscriptions
 */

export type ModuleName = 
  | 'financial-modeling-pro'
  | 'strategy-arbitrage'
  | 'returns-calculator'
  | 'comp-analysis'
  | 'debt-analyzer'
  | 'valuation'
  | 'zoning-analysis'
  | 'development-budget'
  | 'timeline'
  | 'entitlements'
  | 'supply-pipeline'
  | 'dd-checklist'
  | 'risk-analysis'
  | 'insurance'
  | 'environmental'
  | 'market-snapshot'
  | 'traffic-analysis'
  | 'news-sentiment'
  | 'om-analyzer'
  | 'tasks'
  | 'notes'
  | 'documents'
  | 'deal-deck'
  | 'communication-log'
  | 'budget-vs-actual'
  | 'investor-reporting'
  | 'disposition-analysis'
  | 'deal-team';

export type BundleName = 
  | 'flipper'
  | 'developer'
  | 'portfolio-manager';

export interface UserSubscription {
  userId: string;
  modules: ModuleName[];
  bundle?: BundleName;
  expiresAt?: string;
}

/**
 * Check if a user has access to a specific module
 * 
 * @param userId - User ID to check
 * @param moduleName - Name of the module to check
 * @returns true if user has access, false otherwise
 * 
 * @example
 * const hasAccess = checkModule(userId, 'financial-modeling-pro');
 * if (hasAccess) {
 *   // Show enhanced features
 * }
 */
export function checkModule(userId: string | undefined, moduleName: ModuleName): boolean {
  if (!userId) return false;

  // TODO: Implement actual module checking logic
  // This should:
  // 1. Fetch user subscription from API or context
  // 2. Check if module is in user's active modules
  // 3. Check if user's bundle includes this module
  // 4. Verify subscription is not expired
  
  // For now, return false (all modules locked)
  // Replace this with actual implementation:
  
  // Example implementation:
  // const subscription = getUserSubscription(userId);
  // if (!subscription) return false;
  // 
  // // Check direct module access
  // if (subscription.modules.includes(moduleName)) return true;
  // 
  // // Check bundle access
  // if (subscription.bundle) {
  //   const bundleModules = getBundleModules(subscription.bundle);
  //   if (bundleModules.includes(moduleName)) return true;
  // }
  // 
  // return false;

  return false;
}

/**
 * Get all modules included in a bundle
 * 
 * @param bundleName - Name of the bundle
 * @returns Array of module names included in the bundle
 */
export function getBundleModules(bundleName: BundleName): ModuleName[] {
  const bundles: Record<BundleName, ModuleName[]> = {
    'flipper': [
      'strategy-arbitrage',
      'financial-modeling-pro',
      'returns-calculator',
      'comp-analysis',
      'dd-checklist',
      'risk-analysis'
    ],
    'developer': [
      // All Flipper modules plus:
      'strategy-arbitrage',
      'financial-modeling-pro',
      'returns-calculator',
      'comp-analysis',
      'dd-checklist',
      'risk-analysis',
      'zoning-analysis',
      'development-budget',
      'timeline',
      'entitlements',
      'supply-pipeline',
      'environmental'
    ],
    'portfolio-manager': [
      // All 27 premium modules
      'strategy-arbitrage',
      'financial-modeling-pro',
      'returns-calculator',
      'comp-analysis',
      'debt-analyzer',
      'valuation',
      'zoning-analysis',
      'development-budget',
      'timeline',
      'entitlements',
      'supply-pipeline',
      'dd-checklist',
      'risk-analysis',
      'insurance',
      'environmental',
      'market-snapshot',
      'traffic-analysis',
      'news-sentiment',
      'om-analyzer',
      'tasks',
      'notes',
      'documents',
      'deal-deck',
      'communication-log',
      'budget-vs-actual',
      'investor-reporting',
      'disposition-analysis'
    ]
  };

  return bundles[bundleName] || [];
}

/**
 * Get bundle pricing information
 * 
 * @param bundleName - Name of the bundle
 * @returns Pricing information for the bundle
 */
export function getBundlePricing(bundleName: BundleName) {
  const pricing = {
    'flipper': {
      name: 'Flipper Bundle',
      price: 79,
      savings: '25%',
      description: 'Perfect for fix-and-flip investors'
    },
    'developer': {
      name: 'Developer Bundle',
      price: 149,
      savings: '30%',
      description: 'Complete toolkit for ground-up development'
    },
    'portfolio-manager': {
      name: 'Portfolio Manager Bundle',
      price: 199,
      savings: '40%',
      description: 'All premium modules for portfolio operators'
    }
  };

  return pricing[bundleName];
}

/**
 * Get module pricing information
 * 
 * @param moduleName - Name of the module
 * @returns Pricing information for the module
 */
export function getModulePricing(moduleName: ModuleName) {
  const pricing: Record<ModuleName, { price: number; tier: string }> = {
    'strategy-arbitrage': { price: 0, tier: 'core' },
    'financial-modeling-pro': { price: 29, tier: 'financial' },
    'returns-calculator': { price: 19, tier: 'financial' },
    'comp-analysis': { price: 24, tier: 'financial' },
    'debt-analyzer': { price: 19, tier: 'financial' },
    'valuation': { price: 24, tier: 'financial' },
    'zoning-analysis': { price: 34, tier: 'development' },
    'development-budget': { price: 49, tier: 'development' },
    'timeline': { price: 29, tier: 'development' },
    'entitlements': { price: 39, tier: 'development' },
    'supply-pipeline': { price: 24, tier: 'development' },
    'dd-checklist': { price: 19, tier: 'due-diligence' },
    'risk-analysis': { price: 34, tier: 'due-diligence' },
    'insurance': { price: 19, tier: 'due-diligence' },
    'environmental': { price: 24, tier: 'due-diligence' },
    'market-snapshot': { price: 29, tier: 'market' },
    'traffic-analysis': { price: 34, tier: 'market' },
    'news-sentiment': { price: 24, tier: 'market' },
    'om-analyzer': { price: 39, tier: 'market' },
    'tasks': { price: 14, tier: 'collaboration' },
    'notes': { price: 9, tier: 'collaboration' },
    'documents': { price: 19, tier: 'collaboration' },
    'deal-deck': { price: 29, tier: 'collaboration' },
    'communication-log': { price: 14, tier: 'collaboration' },
    'budget-vs-actual': { price: 34, tier: 'portfolio' },
    'investor-reporting': { price: 49, tier: 'portfolio' },
    'disposition-analysis': { price: 34, tier: 'portfolio' },
    'deal-team': { price: 0, tier: 'core' }
  };

  return pricing[moduleName] || { price: 0, tier: 'unknown' };
}

/**
 * Calculate recommended bundle for a set of desired modules
 * 
 * @param desiredModules - Array of module names user wants
 * @returns Recommended bundle or null if individual modules are better
 */
export function recommendBundle(desiredModules: ModuleName[]): BundleName | null {
  if (desiredModules.length < 3) return null;

  // Calculate cost of individual modules
  const individualCost = desiredModules.reduce((total, module) => {
    return total + getModulePricing(module).price;
  }, 0);

  // Check each bundle
  const bundles: BundleName[] = ['flipper', 'developer', 'portfolio-manager'];
  
  for (const bundle of bundles) {
    const bundleModules = getBundleModules(bundle);
    const bundlePrice = getBundlePricing(bundle).price;
    
    // If bundle includes all desired modules and is cheaper, recommend it
    const includesAll = desiredModules.every(m => bundleModules.includes(m));
    if (includesAll && bundlePrice < individualCost) {
      return bundle;
    }
  }

  return null;
}
