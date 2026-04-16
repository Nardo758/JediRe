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
 */

import React, { useEffect, useState } from 'react';
import { getRecommendedModules, MODULE_METADATA, ModuleSuggestion } from '../../utils/moduleSuggestions';
import { ModuleName, getBundleModules, getModulePricing } from '../../utils/modules';
import { Button } from '../shared/Button';
import { BT } from '@/components/deal/bloomberg-ui';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.medium}` }}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.header }}>
          <div className="flex items-center gap-3">
            <div style={{ fontSize: 24 }}>🎯</div>
            <div>
              <h2 style={{ fontSize: BT.fontSize.xl, fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>
                Recommended Modules for This Deal
              </h2>
              <p style={{ fontSize: BT.fontSize.base, color: BT.text.secondary, fontFamily: BT.font.label, marginTop: 2 }}>
                Based on your {dealType} {dealStrategy} deal
              </p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            style={{ color: BT.text.muted, fontSize: 20, fontWeight: 300, background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4 p-4" style={{ background: `${BT.text.red}08`, border: `1px solid ${BT.text.red}33`, borderRadius: 0 }}>
              <p style={{ fontSize: BT.fontSize.base, color: BT.text.red, fontFamily: BT.font.label }}>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Included Modules */}
            {includedSuggestions.map((suggestion) => (
              <div
                key={suggestion.moduleSlug}
                className="p-4 transition-all cursor-pointer"
                style={{
                  border: `2px solid ${selectedModules.has(suggestion.moduleSlug) ? BT.text.cyan : BT.border.subtle}`,
                  background: selectedModules.has(suggestion.moduleSlug) ? `${BT.text.cyan}08` : BT.bg.panel,
                  borderRadius: 0,
                }}
                onClick={() => toggleModule(suggestion.moduleSlug)}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className="w-5 h-5 flex items-center justify-center transition-colors"
                      style={{
                        border: `2px solid ${selectedModules.has(suggestion.moduleSlug) ? BT.text.cyan : BT.border.medium}`,
                        background: selectedModules.has(suggestion.moduleSlug) ? BT.text.cyan : 'transparent',
                        borderRadius: 0,
                      }}
                    >
                      {selectedModules.has(suggestion.moduleSlug) && (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke={BT.bg.terminal}
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
                      <span style={{ fontSize: 20 }}>{suggestion.icon}</span>
                      <h3 style={{ fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.mono, fontSize: BT.fontSize.base }}>{suggestion.name}</h3>
                    </div>
                    <p style={{ fontSize: BT.fontSize.base, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: 8 }}>{suggestion.description}</p>
                    {suggestion.bundleInfo && (
                      <p style={{ fontSize: BT.fontSize.xs, color: BT.text.cyan, fontWeight: 500, fontFamily: BT.font.label }}>{suggestion.bundleInfo}</p>
                    )}
                  </div>

                  {/* Badge */}
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center gap-1 px-3 py-1" style={{ background: `${BT.text.green}18`, color: BT.text.green, borderRadius: 0, fontSize: BT.fontSize.xs, fontWeight: 600, fontFamily: BT.font.mono }}>
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
                <div className="pt-4" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                  <h3 style={{ fontSize: BT.fontSize.xs, fontWeight: 600, color: BT.text.muted, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: BT.font.mono, marginBottom: 12 }}>
                    Premium Add-Ons
                  </h3>
                </div>

                {paidSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.moduleSlug}
                    className="p-4"
                    style={{ border: `2px solid ${BT.border.subtle}`, borderRadius: 0, background: BT.bg.panelAlt }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="flex-shrink-0">
                        <span style={{ fontSize: 20, opacity: 0.6 }}>{suggestion.icon}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 style={{ fontWeight: 600, color: BT.text.secondary, fontFamily: BT.font.mono, fontSize: BT.fontSize.base }}>{suggestion.name}</h3>
                        </div>
                        <p style={{ fontSize: BT.fontSize.base, color: BT.text.secondary, fontFamily: BT.font.label, marginBottom: 8 }}>{suggestion.description}</p>
                        <p style={{ fontSize: BT.fontSize.xs, color: BT.text.muted, fontFamily: BT.font.label }}>
                          Not in your plan. Add for ${suggestion.price}/mo?
                        </p>
                      </div>

                      {/* Price & CTA */}
                      <div className="flex-shrink-0 text-right">
                        <div style={{ fontSize: BT.fontSize.lg, fontWeight: 700, color: BT.text.amber, fontFamily: BT.font.mono, marginBottom: 8 }}>
                          ${suggestion.price}
                          <span style={{ fontSize: BT.fontSize.base, fontWeight: 400, color: BT.text.muted }}>/mo</span>
                        </div>
                        <button
                          onClick={() => handleAddModule(suggestion.moduleSlug)}
                          className="px-3 py-1 transition-colors"
                          style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0, border: 'none', fontSize: BT.fontSize.base, fontWeight: 500, fontFamily: BT.font.mono, cursor: 'pointer' }}
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
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: BT.bg.panelAlt, borderTop: `1px solid ${BT.border.subtle}` }}>
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
