/**
 * ModuleSuggestionModal - Suggests relevant modules after deal creation
 * 
 * Triggers:
 * - After successful deal creation
 * - Shows on deal detail page load (one-time, dismissible)
 * 
 * Features:
 * - Contextual module recommendations based on deal type + strategy
 * - Shows subscription status (included vs paid)
 * - Bulk module activation
 * - Persistent dismissal per deal
 * 
 * Visual Layout:
 * ┌────────────────────────────────────────────────────┐
 * │ 🎯 Recommended Modules for This Deal          [X] │
 * │ Based on your Multifamily Value-Add deal           │
 * ├────────────────────────────────────────────────────┤
 * │                                                    │
 * │ [✓] 💰 Financial Modeling Pro      [Included ✓]  │
 * │     Component-based pro-forma builder              │
 * │     Part of your Flipper bundle                    │
 * │                                                    │
 * │ [✓] 🎯 Strategy Arbitrage          [Included ✓]  │
 * │     AI-powered investment strategy                 │
 * │                                                    │
 * │ ─────────── Premium Add-Ons ─────────────         │
 * │                                                    │
 * │ 🏢 Comp Analysis                      $24/mo      │
 * │ Automated comparable analysis     [Add Module]    │
 * │                                                    │
 * ├────────────────────────────────────────────────────┤
 * │              [Skip]  [Activate Selected (2)]      │
 * └────────────────────────────────────────────────────┘
 */

import React, { useEffect, useState } from 'react';
import { getRecommendedModules, MODULE_METADATA, ModuleSuggestion } from '../../utils/moduleSuggestions';
import { ModuleName, getBundleModules, getModulePricing } from '../../utils/modules';
import { Button } from '../shared/Button';

interface ModuleSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: string;
  dealType: string; // e.g., 'multifamily'
  dealStrategy: string; // e.g., 'value-add'
  userBundle?: 'flipper' | 'developer' | 'portfolio-manager';
  userModules?: ModuleName[]; // Individual subscribed modules
}

export const ModuleSuggestionModal: React.FC<ModuleSuggestionModalProps> = ({
  isOpen,
  onClose,
  dealId,
  dealType,
  dealStrategy,
  userBundle,
  userModules = [],
}) => {
  const [suggestions, setSuggestions] = useState<ModuleSuggestion[]>([]);
  const [selectedModules, setSelectedModules] = useState<Set<ModuleName>>(new Set());
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSuggestions();
    }
  }, [isOpen, dealType, dealStrategy, userBundle, userModules]);

  const loadSuggestions = () => {
    // Get recommended modules for this deal type + strategy
    const recommendedModuleIds = getRecommendedModules(dealType, dealStrategy);
    
    // Get bundle modules if user has a bundle
    const bundleModules = userBundle ? getBundleModules(userBundle) : [];
    
    // Build suggestion objects
    const moduleSuggestions: ModuleSuggestion[] = recommendedModuleIds.map((moduleId) => {
      const metadata = MODULE_METADATA[moduleId];
      const pricing = getModulePricing(moduleId);
      
      // Check if user has access
      const isIncludedInBundle = bundleModules.includes(moduleId);
      const isIndividuallySub = userModules.includes(moduleId);
      const isIncluded = isIncludedInBundle || isIndividuallySub;
      
      let bundleInfo: string | undefined;
      if (isIncludedInBundle && userBundle) {
        bundleInfo = `Part of your ${userBundle.replace('-', ' ')} bundle`;
      }
      
      return {
        moduleSlug: moduleId,
        name: metadata.name,
        description: metadata.description,
        icon: metadata.icon,
        isIncluded,
        price: isIncluded ? undefined : pricing.price,
        bundleInfo,
      };
    });
    
    setSuggestions(moduleSuggestions);
    
    // Pre-select all included modules
    const preSelected = new Set<ModuleName>(
      moduleSuggestions
        .filter((s) => s.isIncluded)
        .map((s) => s.moduleSlug)
    );
    setSelectedModules(preSelected);
  };

  const toggleModule = (moduleSlug: ModuleName) => {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleSlug)) {
        next.delete(moduleSlug);
      } else {
        next.add(moduleSlug);
      }
      return next;
    });
  };

  const handleActivateSelected = async () => {
    if (selectedModules.size === 0) {
      setError('Please select at least one module to activate');
      return;
    }

    setIsActivating(true);
    setError(null);

    try {
      // Activate each selected module
      const activations = Array.from(selectedModules).map((moduleSlug) => {
        return fetch(`/api/v1/modules/${moduleSlug}/toggle`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deal_id: dealId,
            is_enabled: true,
          }),
        });
      });

      await Promise.all(activations);

      // Mark as dismissed
      localStorage.setItem(`deal-${dealId}-suggestions-dismissed`, 'true');
      
      // Close modal
      onClose();
    } catch (err: any) {
      console.error('Failed to activate modules:', err);
      setError(err.message || 'Failed to activate modules. Please try again.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleSkip = () => {
    // Mark as dismissed without activating anything
    localStorage.setItem(`deal-${dealId}-suggestions-dismissed`, 'true');
    onClose();
  };

  const handleAddModule = (moduleSlug: ModuleName) => {
    // TODO: Open module marketplace or subscription flow
    console.log('Add module:', moduleSlug);
    // For now, just alert
    alert(`Module marketplace coming soon! Module: ${moduleSlug}`);
  };

  if (!isOpen) return null;

  const selectedCount = selectedModules.size;
  const includedSuggestions = suggestions.filter((s) => s.isIncluded);
  const paidSuggestions = suggestions.filter((s) => !s.isIncluded);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🎯</div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Recommended Modules for This Deal
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Based on your {dealType} {dealStrategy} deal
              </p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 text-2xl font-light transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Included Modules */}
            {includedSuggestions.map((suggestion) => (
              <div
                key={suggestion.moduleSlug}
                className={`p-4 border-2 rounded-lg transition-all cursor-pointer ${
                  selectedModules.has(suggestion.moduleSlug)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
                onClick={() => toggleModule(suggestion.moduleSlug)}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedModules.has(suggestion.moduleSlug)
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {selectedModules.has(suggestion.moduleSlug) && (
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{suggestion.icon}</span>
                      <h3 className="font-semibold text-gray-900">{suggestion.name}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>
                    {suggestion.bundleInfo && (
                      <p className="text-xs text-blue-600 font-medium">{suggestion.bundleInfo}</p>
                    )}
                  </div>

                  {/* Badge */}
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Included
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Paid Modules (Not in Subscription) */}
            {paidSuggestions.length > 0 && (
              <>
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Premium Add-Ons
                  </h3>
                </div>

                {paidSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.moduleSlug}
                    className="p-4 border-2 border-gray-200 rounded-lg bg-gray-50"
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="flex-shrink-0">
                        <span className="text-2xl opacity-60">{suggestion.icon}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-700">{suggestion.name}</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>
                        <p className="text-xs text-gray-500">
                          Not in your plan. Add for ${suggestion.price}/mo?
                        </p>
                      </div>

                      {/* Price & CTA */}
                      <div className="flex-shrink-0 text-right">
                        <div className="text-lg font-bold text-gray-900 mb-2">
                          ${suggestion.price}
                          <span className="text-sm font-normal text-gray-500">/mo</span>
                        </div>
                        <button
                          onClick={() => handleAddModule(suggestion.moduleSlug)}
                          className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Add Module
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isActivating}
          >
            Skip
          </Button>
          <Button
            onClick={handleActivateSelected}
            disabled={isActivating || selectedCount === 0}
            loading={isActivating}
          >
            {isActivating
              ? 'Activating...'
              : `Activate Selected (${selectedCount})`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ModuleSuggestionModal;
