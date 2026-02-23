import React from 'react';

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

  // Determine module status
  const getModuleStatus = () => {
    if (module.isFree) {
      return {
        text: 'FREE',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        canToggle: true,
      };
    }

    if (isSubscribed && isEnabled) {
      return {
        text: 'Included ✓',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        canToggle: true,
      };
    }

    if (isSubscribed && !isEnabled) {
      return {
        text: 'Available',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        canToggle: true,
      };
    }

    // Not subscribed
    return {
      text: `$${module.priceMonthly}/mo`,
      color: 'text-gray-700',
      bgColor: 'bg-gray-100',
      canToggle: false,
    };
  };

  const status = getModuleStatus();

  const handleCheckboxClick = () => {
    if (isSubscribed) {
      // User has access, toggle enabled state
      onToggle(module.slug, isEnabled);
    } else {
      // User doesn't have access, show purchase modal
      onPurchase(module);
    }
  };

  const handleAddModuleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPurchase(module);
  };

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <div className="flex-shrink-0 pt-1">
          <button
            onClick={handleCheckboxClick}
            className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
              isEnabled
                ? 'bg-blue-600 border-blue-600'
                : isSubscribed
                ? 'border-gray-300 hover:border-blue-400'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            disabled={!isSubscribed && !module.isFree}
            aria-label={`${isEnabled ? 'Disable' : 'Enable'} ${module.name}`}
          >
            {isEnabled && (
              <svg
                className="w-3 h-3 text-white"
                fill="currentColor"
                viewBox="0 0 12 12"
              >
                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            )}
          </button>
        </div>

        {/* Icon */}
        <div className="flex-shrink-0">
          <span className="text-3xl">{module.icon}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1">
              <h3 className="text-base font-bold text-gray-900 mb-1">
                {module.name}
              </h3>
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                {module.description}
              </p>
              <div className="text-xs text-gray-500">
                <strong>Enhances:</strong> {module.enhances.join(', ')}
              </div>
            </div>

            {/* Status & Actions */}
            <div className="flex-shrink-0 text-right">
              <div
                className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-2 ${status.bgColor} ${status.color}`}
              >
                {status.text}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {!isSubscribed && !module.isFree && (
                  <>
                    <button
                      onClick={handleAddModuleClick}
                      className="block w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Add Module
                    </button>
                    
                    {!isInUserBundle && module.bundles.length > 0 && (
                      <div className="text-xs text-gray-500">
                        Not in {userBundle ? 'your bundle' : 'any bundle'}
                      </div>
                    )}
                  </>
                )}

                {isSubscribed && isEnabled && (
                  <div className="text-xs text-gray-500">
                    Active since{' '}
                    {userSettings?.activatedAt
                      ? new Date(userSettings.activatedAt).toLocaleDateString()
                      : 'now'}
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
