import React from 'react';

export interface ModuleUpsellBannerProps {
  moduleName: string;
  benefits: string[];
  price: string;
  bundleInfo?: {
    name: string;
    price: string;
    savings: string;
  };
  onAddModule?: () => void;
  onUpgradeBundle?: () => void;
  onLearnMore?: () => void;
}

export const ModuleUpsellBanner: React.FC<ModuleUpsellBannerProps> = ({
  moduleName,
  benefits,
  price,
  bundleInfo,
  onAddModule,
  onUpgradeBundle,
  onLearnMore
}) => {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-6 mb-6">
      <div className="flex items-start justify-between gap-6">
        {/* Left side - Content */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xl">✨</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Unlock {moduleName}
              </h3>
              <p className="text-sm text-gray-600">
                Get access to professional-grade financial modeling tools
              </p>
            </div>
          </div>

          {/* Benefits */}
          <div className="ml-13 space-y-2 mb-4">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">✓</span>
                <span className="text-sm text-gray-700">{benefit}</span>
              </div>
            ))}
          </div>

          {/* Bundle offer */}
          {bundleInfo && (
            <div className="ml-13 bg-white/60 rounded-lg p-3 border border-blue-200">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-blue-900">
                  💎 Save {bundleInfo.savings} with {bundleInfo.name}
                </span>
                <span className="text-xs text-gray-600">
                  ({bundleInfo.price}/mo)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right side - Pricing & Actions */}
        <div className="flex-shrink-0 text-center">
          <div className="mb-4">
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {price}
            </div>
            <div className="text-sm text-gray-600">per month</div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            {onAddModule && (
              <button
                onClick={onAddModule}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-md hover:shadow-lg"
              >
                Add Module
              </button>
            )}
            
            {bundleInfo && onUpgradeBundle && (
              <button
                onClick={onUpgradeBundle}
                className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
              >
                Upgrade to Bundle
              </button>
            )}
            
            {onLearnMore && (
              <button
                onClick={onLearnMore}
                className="w-full px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition text-sm"
              >
                Learn More
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModuleUpsellBanner;
