import { apiClient } from '../services/api.client';

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

let cachedModules: Set<string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000;
let fetchPromise: Promise<Set<string>> | null = null;

async function fetchEnabledModules(): Promise<Set<string>> {
  if (cachedModules && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedModules;
  }

  if (fetchPromise) return fetchPromise;

  fetchPromise = apiClient
    .get<{ modules: string[] }>('/api/v1/modules/enabled')
    .then((res) => {
      const moduleSet = new Set(res.data.modules);
      cachedModules = moduleSet;
      cacheTimestamp = Date.now();
      fetchPromise = null;
      return moduleSet;
    })
    .catch((err) => {
      console.error('Failed to fetch enabled modules:', err);
      fetchPromise = null;
      return cachedModules || new Set<string>();
    });

  return fetchPromise;
}

export async function hasModule(moduleName: ModuleName): Promise<boolean> {
  const modules = await fetchEnabledModules();
  return modules.has(moduleName);
}

export function invalidateModuleCache(): void {
  cachedModules = null;
  cacheTimestamp = 0;
  fetchPromise = null;
}

export function checkModule(userId: string | undefined, moduleName: ModuleName): boolean {
  if (!userId) return false;
  if (!cachedModules) return false;
  return cachedModules.has(moduleName);
}

export function useModuleCheck(moduleName: ModuleName): {
  loading: boolean;
  enabled: boolean;
} {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hasModule(moduleName).then((result) => {
      if (!cancelled) {
        setEnabled(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [moduleName]);

  return { loading, enabled };
}

import { useState, useEffect } from 'react';

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

export function recommendBundle(desiredModules: ModuleName[]): BundleName | null {
  if (desiredModules.length < 3) return null;

  const individualCost = desiredModules.reduce((total, module) => {
    return total + getModulePricing(module).price;
  }, 0);

  const bundles: BundleName[] = ['flipper', 'developer', 'portfolio-manager'];
  
  for (const bundle of bundles) {
    const bundleModules = getBundleModules(bundle);
    const bundlePrice = getBundlePricing(bundle).price;
    
    const includesAll = desiredModules.every(m => bundleModules.includes(m));
    if (includesAll && bundlePrice < individualCost) {
      return bundle;
    }
  }

  return null;
}
