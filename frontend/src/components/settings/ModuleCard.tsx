import React from 'react';
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

interface ModuleCardProps {
  module: ModuleWithSettings;
  userBundle?: string;
  onToggle: (moduleSlug: string, currentEnabled: boolean) => void;
  onPurchase: (module: ModuleWithSettings) => void;
}

export function ModuleCard({ module, userBundle, onToggle, onPurchase }: ModuleCardProps) {
  const { userSettings } = module;

  const isSubscribed = userSettings?.subscribed || module.isFree;
  const isEnabled = userSettings?.enabled || false;
  const isInUserBundle = userBundle && module.bundles.includes(userBundle);

  const getModuleStatus = () => {
    if (module.isFree) return { text: 'FREE', color: BT.text.green, canToggle: true };
    if (isSubscribed && isEnabled) return { text: 'Included', color: BT.text.green, canToggle: true };
    if (isSubscribed && !isEnabled) return { text: 'Available', color: BT.text.cyan, canToggle: true };
    return { text: `$${module.priceMonthly}/mo`, color: BT.text.secondary, canToggle: false };
  };

  const status = getModuleStatus();

  const handleCheckboxClick = () => {
    if (isSubscribed) onToggle(module.slug, isEnabled);
    else onPurchase(module);
  };

  const handleAddModuleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPurchase(module);
  };

  return (
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BT.border.subtle}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ flexShrink: 0, paddingTop: 2 }}>
          <button
            onClick={handleCheckboxClick}
            disabled={!isSubscribed && !module.isFree}
            style={{
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px solid ${isEnabled ? BT.text.cyan : BT.border.medium}`,
              background: isEnabled ? BT.text.cyan : 'transparent',
              cursor: isSubscribed || module.isFree ? 'pointer' : 'not-allowed',
            }}
          >
            {isEnabled && (
              <svg style={{ width: 10, height: 10, color: BT.bg.terminal }} fill="currentColor" viewBox="0 0 12 12">
                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            )}
          </button>
        </div>

        <div style={{ flexShrink: 0, fontSize: 24 }}>{module.icon}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: BT.text.primary, marginBottom: 4 }}>{module.name}</h3>
              <p style={{ fontSize: 11, color: BT.text.secondary, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{module.description}</p>
              <div style={{ fontSize: 10, color: BT.text.muted }}>
                <strong style={{ color: BT.text.secondary }}>Enhances:</strong> {module.enhances.join(', ')}
              </div>
            </div>

            <div style={{ flexShrink: 0, textAlign: 'right' as const }}>
              <div style={{ display: 'inline-block', padding: '2px 10px', fontSize: 10, fontWeight: 600, color: status.color, background: BT.bg.panelAlt, marginBottom: 6, ...mono }}>
                {status.text}
              </div>

              <div>
                {!isSubscribed && !module.isFree && (
                  <>
                    <button
                      onClick={handleAddModuleClick}
                      style={{ display: 'block', width: '100%', padding: '4px 12px', background: BT.text.cyan, color: BT.bg.terminal, border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', ...mono }}
                    >
                      Add Module
                    </button>
                    {!isInUserBundle && module.bundles.length > 0 && (
                      <div style={{ fontSize: 9, color: BT.text.muted, marginTop: 4 }}>
                        Not in {userBundle ? 'your bundle' : 'any bundle'}
                      </div>
                    )}
                  </>
                )}

                {isSubscribed && isEnabled && (
                  <div style={{ fontSize: 9, color: BT.text.muted }}>
                    Active since {userSettings?.activatedAt ? new Date(userSettings.activatedAt).toLocaleDateString() : 'now'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
