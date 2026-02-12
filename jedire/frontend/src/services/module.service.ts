interface Module {
  id: string;
  name: string;
  icon: string;
  description: string;
  requiredTier: 'basic' | 'pro' | 'enterprise';
  category: 'core' | 'analysis' | 'communication' | 'advanced';
}

// Module registry
export const modules: Record<string, Module> = {
  map: {
    id: 'map',
    name: 'Map View',
    icon: '🗺️',
    description: 'Interactive map with boundaries and property markers',
    requiredTier: 'basic',
    category: 'core',
  },
  properties: {
    id: 'properties',
    name: 'Property Search',
    icon: '🏠',
    description: 'Search and filter properties within deal boundaries',
    requiredTier: 'basic',
    category: 'core',
  },
  pipeline: {
    id: 'pipeline',
    name: 'Deal Pipeline',
    icon: '📊',
    description: 'Track deal progress through stages',
    requiredTier: 'basic',
    category: 'core',
  },
  strategy: {
    id: 'strategy',
    name: 'Strategy Analysis',
    icon: '🎯',
    description: 'JEDI Score and strategic recommendations',
    requiredTier: 'pro',
    category: 'analysis',
  },
  market: {
    id: 'market',
    name: 'Market Intelligence',
    icon: '📈',
    description: 'Market trends and comparative analysis',
    requiredTier: 'pro',
    category: 'analysis',
  },
  email: {
    id: 'email',
    name: 'Email Integration',
    icon: '📧',
    description: 'Link emails to deals automatically',
    requiredTier: 'pro',
    category: 'communication',
  },
  reports: {
    id: 'reports',
    name: 'Custom Reports',
    icon: '📄',
    description: 'Generate and export detailed reports',
    requiredTier: 'enterprise',
    category: 'advanced',
  },
  team: {
    id: 'team',
    name: 'Team Collaboration',
    icon: '👥',
    description: 'Multi-user access and permissions',
    requiredTier: 'enterprise',
    category: 'advanced',
  },
  portfolio: {
    id: 'portfolio',
    name: 'Portfolio Manager',
    icon: '💼',
    description: 'Manage multiple deals and track performance',
    requiredTier: 'enterprise',
    category: 'advanced',
  },
};

export class ModuleService {
  // Check if user has access to a module
  static hasAccess(moduleId: string, userTier: 'basic' | 'pro' | 'enterprise'): boolean {
    const module = modules[moduleId];
    if (!module) return false;

    const tierHierarchy = ['basic', 'pro', 'enterprise'];
    const userTierIndex = tierHierarchy.indexOf(userTier);
    const requiredTierIndex = tierHierarchy.indexOf(module.requiredTier);

    return userTierIndex >= requiredTierIndex;
  }

  // Get all modules available for a tier
  static getAvailableModules(userTier: 'basic' | 'pro' | 'enterprise'): Module[] {
    return Object.values(modules).filter((module) =>
      this.hasAccess(module.id, userTier)
    );
  }

  // Get modules by category
  static getModulesByCategory(category: Module['category']): Module[] {
    return Object.values(modules).filter((module) => module.category === category);
  }

  // Get locked modules for a tier
  static getLockedModules(userTier: 'basic' | 'pro' | 'enterprise'): Module[] {
    return Object.values(modules).filter((module) =>
      !this.hasAccess(module.id, userTier)
    );
  }

  // Get module by ID
  static getModule(moduleId: string): Module | undefined {
    return modules[moduleId];
  }

  // Check if module is enabled for a deal
  static async isModuleEnabled(dealId: string, moduleId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/v1/deals/${dealId}/modules`);
      const data = await response.json();
      const module = data.find((m: any) => m.module_name === moduleId);
      return module?.is_enabled || false;
    } catch (error) {
      console.error('Failed to check module status:', error);
      return false;
    }
  }

  // Toggle module for a deal
  static async toggleModule(dealId: string, moduleId: string, enabled: boolean): Promise<void> {
    try {
      await fetch(`/api/v1/deals/${dealId}/modules/${moduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: enabled }),
      });
    } catch (error) {
      console.error('Failed to toggle module:', error);
      throw error;
    }
  }

  // Get upgrade path (what tier is needed for a module)
  static getUpgradePath(moduleId: string, currentTier: 'basic' | 'pro' | 'enterprise'): string | null {
    const module = modules[moduleId];
    if (!module) return null;

    if (this.hasAccess(moduleId, currentTier)) {
      return null; // Already have access
    }

    return module.requiredTier;
  }
}
