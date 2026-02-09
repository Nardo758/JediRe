import React, { useEffect, useState } from 'react';
import { apiClient } from '../../services/api.client';
import { ModuleCard } from '../../components/settings/ModuleCard';

interface ModuleDefinition {
  slug: string;
  name: string;
  category: string;
  description: string;
  priceMonthly: number;
  isFree: boolean;
  bundles: string[];
  icon: string;
  enhances: string[];
  sortOrder: number;
}

interface UserModuleSetting {
  moduleSlug: string;
  enabled: boolean;
  subscribed: boolean;
  bundleId?: string;
  activatedAt?: Date;
}

interface ModuleWithSettings extends ModuleDefinition {
  userSettings?: UserModuleSetting;
}

interface ModuleCategory {
  name: string;
  modules: ModuleWithSettings[];
}

interface ModulesResponse {
  categories: ModuleCategory[];
  userBundle?: string;
}

interface PurchaseModalData {
  module: ModuleWithSettings;
  isVisible: boolean;
}

const BUNDLE_INFO: Record<string, { name: string; price: number }> = {
  flipper: { name: 'Flipper Bundle', price: 89 },
  developer: { name: 'Developer Bundle', price: 149 },
  portfolio: { name: 'Portfolio Manager Bundle', price: 199 },
};

export function ModulesPage() {
  const [categories, setCategories] = useState<ModuleCategory[]>([]);
  const [userBundle, setUserBundle] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Free', 'Strategy & Arbitrage', 'Financial & Analysis'])
  );
  const [purchaseModal, setPurchaseModal] = useState<PurchaseModalData>({
    module: null as any,
    isVisible: false,
  });

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<ModulesResponse>('/api/v1/modules');
      setCategories(response.data.categories);
      setUserBundle(response.data.userBundle);
    } catch (err) {
      console.error('Failed to load modules:', err);
      setError('Failed to load modules. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  const handleToggleModule = async (moduleSlug: string, currentEnabled: boolean) => {
    try {
      // Optimistic update
      setCategories((prevCategories) =>
        prevCategories.map((cat) => ({
          ...cat,
          modules: cat.modules.map((mod) =>
            mod.slug === moduleSlug
              ? {
                  ...mod,
                  userSettings: {
                    ...mod.userSettings,
                    moduleSlug: mod.slug,
                    enabled: !currentEnabled,
                    subscribed: mod.userSettings?.subscribed || false,
                  },
                }
              : mod
          ),
        }))
      );

      // Make API call
      await apiClient.patch(`/api/v1/modules/${moduleSlug}/toggle`, {
        enabled: !currentEnabled,
      });
    } catch (err) {
      console.error('Failed to toggle module:', err);
      // Revert optimistic update
      loadModules();
    }
  };

  const handlePurchaseClick = (module: ModuleWithSettings) => {
    setPurchaseModal({ module, isVisible: true });
  };

  const closePurchaseModal = () => {
    setPurchaseModal({ module: null as any, isVisible: false });
  };

  const handlePurchase = async (moduleSlug: string) => {
    try {
      const response = await apiClient.post(`/api/v1/modules/${moduleSlug}/purchase`, {});
      
      if (response.data.success && response.data.checkoutUrl) {
        window.location.href = response.data.checkoutUrl;
      }
      
      closePurchaseModal();
    } catch (err) {
      console.error('Failed to initiate purchase:', err);
      alert('Purchase failed. Please try again.');
    }
  };

  const handleUpgradeBundle = () => {
    // Navigate to pricing/billing page
    window.location.href = '/settings/billing';
  };

  const bundleDisplay = userBundle ? BUNDLE_INFO[userBundle] : null;

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={loadModules}
            className="mt-2 text-red-600 hover:text-red-800 font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Module Marketplace</h1>
        <p className="text-gray-600">
          Select the modules you want active across all your deals, assets, and projects.
        </p>
      </div>

      {/* User's Current Plan Banner */}
      <div className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-600 mb-1">YOUR PLAN</div>
            <div className="text-2xl font-bold text-gray-900">
              {bundleDisplay ? bundleDisplay.name : 'Free Plan'}{' '}
              {bundleDisplay && (
                <span className="text-blue-600">(${bundleDisplay.price}/mo)</span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => (window.location.href = '/pricing')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Change Plan
            </button>
            <button
              onClick={() => (window.location.href = '/settings/billing')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Manage Billing
            </button>
          </div>
        </div>
      </div>

      {/* Module Categories */}
      <div className="space-y-4">
        {categories.map((category) => {
          const isExpanded = expandedCategories.has(category.name);
          const moduleCount = category.modules.length;

          return (
            <div
              key={category.name}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.name)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                  <h2 className="text-lg font-bold text-gray-900">
                    {category.name}
                  </h2>
                  <span className="text-sm text-gray-500">
                    ({moduleCount} {moduleCount === 1 ? 'module' : 'modules'})
                  </span>
                </div>
              </button>

              {/* Category Content */}
              {isExpanded && (
                <div className="border-t border-gray-200">
                  {category.modules.map((module) => (
                    <ModuleCard
                      key={module.slug}
                      module={module}
                      userBundle={userBundle}
                      onToggle={handleToggleModule}
                      onPurchase={handlePurchaseClick}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Purchase Modal */}
      {purchaseModal.isVisible && purchaseModal.module && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Add {purchaseModal.module.name}
              </h3>
              
              <div className="mb-6">
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-3xl">{purchaseModal.module.icon}</span>
                  <div className="flex-1">
                    <p className="text-gray-700 mb-2">
                      {purchaseModal.module.description}
                    </p>
                    <div className="text-sm text-gray-600">
                      <strong>Enhances:</strong> {purchaseModal.module.enhances.join(', ')}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    ${purchaseModal.module.priceMonthly}/mo
                  </div>
                  {purchaseModal.module.bundles.length > 0 && (
                    <div className="text-sm text-gray-600">
                      Included in:{' '}
                      {purchaseModal.module.bundles
                        .map((b) => BUNDLE_INFO[b]?.name || b)
                        .join(', ')}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handlePurchase(purchaseModal.module.slug)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Add Module (${purchaseModal.module.priceMonthly}/mo)
                </button>
                {purchaseModal.module.bundles.length > 0 && (
                  <button
                    onClick={handleUpgradeBundle}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                  >
                    Upgrade Bundle
                  </button>
                )}
              </div>

              <button
                onClick={closePurchaseModal}
                className="w-full mt-3 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
