import React, { useEffect, useState } from 'react';
import { apiClient } from '../../services/api.client';
import { ModuleCard } from '../../components/settings/ModuleCard';
import { invalidateModuleCache } from '../../utils/modules';
import { BT } from '@/components/deal/bloomberg-ui';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

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
  const [purchaseModal, setPurchaseModal] = useState<PurchaseModalData>({ module: null as any, isVisible: false });

  useEffect(() => { loadModules(); }, []);

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
      if (next.has(categoryName)) next.delete(categoryName);
      else next.add(categoryName);
      return next;
    });
  };

  const handleToggleModule = async (moduleSlug: string, currentEnabled: boolean) => {
    try {
      setCategories((prevCategories) =>
        prevCategories.map((cat) => ({
          ...cat,
          modules: cat.modules.map((mod) =>
            mod.slug === moduleSlug
              ? { ...mod, userSettings: { ...mod.userSettings, moduleSlug: mod.slug, enabled: !currentEnabled, subscribed: mod.userSettings?.subscribed || false } }
              : mod
          ),
        }))
      );
      await apiClient.patch(`/api/v1/modules/${moduleSlug}/toggle`, { enabled: !currentEnabled });
      invalidateModuleCache();
    } catch (err) {
      console.error('Failed to toggle module:', err);
      loadModules();
    }
  };

  const handlePurchaseClick = (module: ModuleWithSettings) => { setPurchaseModal({ module, isVisible: true }); };
  const closePurchaseModal = () => { setPurchaseModal({ module: null as any, isVisible: false }); };

  const handlePurchase = async (moduleSlug: string) => {
    try {
      const response = await apiClient.post(`/api/v1/modules/${moduleSlug}/purchase`, {});
      if (response.data.success && response.data.checkoutUrl) window.location.href = response.data.checkoutUrl;
      closePurchaseModal();
    } catch (err) {
      console.error('Failed to initiate purchase:', err);
      alert('Purchase failed. Please try again.');
    }
  };

  const handleUpgradeBundle = () => { window.location.href = '/settings/billing'; };

  const bundleDisplay = userBundle ? BUNDLE_INFO[userBundle] : null;

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ height: 32, width: 32, border: `2px solid ${BT.border.subtle}`, borderBottom: `2px solid ${BT.text.cyan}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ padding: 16, background: BT.bg.panelAlt, border: `1px solid ${BT.text.red}` }}>
          <p style={{ color: BT.text.red, fontSize: 12 }}>{error}</p>
          <button onClick={loadModules} style={{ marginTop: 8, color: BT.text.cyan, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary, letterSpacing: '0.04em' }}>Module Marketplace</h1>
        <p style={{ fontSize: 12, color: BT.text.secondary, marginTop: 4 }}>
          Select the modules you want active across all your deals, assets, and projects.
        </p>
      </div>

      <div style={{ marginBottom: 24, padding: 20, background: BT.bg.panelAlt, border: `1px solid ${BT.text.cyan}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.08em', marginBottom: 4, ...mono }}>YOUR PLAN</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.primary }}>
              {bundleDisplay ? bundleDisplay.name : 'Free Plan'}
              {bundleDisplay && <span style={{ color: BT.text.cyan, marginLeft: 8 }}>(${bundleDisplay.price}/mo)</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => (window.location.href = '/pricing')}
              style={{ padding: '8px 16px', background: BT.text.cyan, color: BT.bg.terminal, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', ...mono }}
            >
              Change Plan
            </button>
            <button
              onClick={() => (window.location.href = '/settings/billing')}
              style={{ padding: '8px 16px', background: 'transparent', color: BT.text.secondary, border: `1px solid ${BT.border.subtle}`, fontSize: 11, fontWeight: 600, cursor: 'pointer', ...mono }}
            >
              Manage Billing
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {categories.map((category) => {
          const isExpanded = expandedCategories.has(category.name);
          const moduleCount = category.modules.length;

          return (
            <div key={category.name} style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, overflow: 'hidden' }}>
              <button
                onClick={() => toggleCategory(category.name)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left' as const,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: BT.text.muted }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: BT.text.primary }}>{category.name}</span>
                  <span style={{ fontSize: 11, color: BT.text.muted }}>({moduleCount} {moduleCount === 1 ? 'module' : 'modules'})</span>
                </div>
              </button>

              {isExpanded && (
                <div style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
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

      {purchaseModal.isVisible && purchaseModal.module && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, maxWidth: 440, width: '100%', margin: 16 }}>
            <div style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary, marginBottom: 16 }}>
                Add {purchaseModal.module.name}
              </h3>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 28 }}>{purchaseModal.module.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, color: BT.text.secondary, marginBottom: 6 }}>{purchaseModal.module.description}</p>
                    <div style={{ fontSize: 10, color: BT.text.muted }}>
                      <strong style={{ color: BT.text.secondary }}>Enhances:</strong> {purchaseModal.module.enhances.join(', ')}
                    </div>
                  </div>
                </div>

                <div style={{ padding: 14, background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}` }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: BT.text.primary, marginBottom: 4, ...mono }}>${purchaseModal.module.priceMonthly}/mo</div>
                  {purchaseModal.module.bundles.length > 0 && (
                    <div style={{ fontSize: 10, color: BT.text.muted }}>
                      Included in: {purchaseModal.module.bundles.map((b) => BUNDLE_INFO[b]?.name || b).join(', ')}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handlePurchase(purchaseModal.module.slug)}
                  style={{ flex: 1, padding: '8px 16px', background: BT.text.cyan, color: BT.bg.terminal, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', ...mono }}
                >
                  Add Module (${purchaseModal.module.priceMonthly}/mo)
                </button>
                {purchaseModal.module.bundles.length > 0 && (
                  <button
                    onClick={handleUpgradeBundle}
                    style={{ flex: 1, padding: '8px 16px', background: BT.text.purple, color: BT.bg.terminal, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', ...mono }}
                  >
                    Upgrade Bundle
                  </button>
                )}
              </div>
              <button
                onClick={closePurchaseModal}
                style={{ width: '100%', marginTop: 8, padding: '8px 16px', background: 'transparent', color: BT.text.secondary, border: `1px solid ${BT.border.subtle}`, fontSize: 11, cursor: 'pointer' }}
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
