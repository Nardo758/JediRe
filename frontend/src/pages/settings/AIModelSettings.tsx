import React, { useState, useEffect } from 'react';
import { Zap, Scale, Sparkles, Bot, Check, Lock, ArrowRight } from 'lucide-react';
import { apiClient } from '../../services/api.client';

interface AIOption {
  value: string;
  label: string;
  description: string;
  model: string | null;
  locked: boolean;
  lockedReason: string | null;
}

interface AIPreferencesData {
  currentPreference: string;
  tier: string;
  options: AIOption[];
}

const CARD_META: Record<string, { icon: React.ElementType; speed: number; quality: number; creditNote: string; color: string; bgColor: string; borderColor: string }> = {
  auto: {
    icon: Bot,
    speed: 3,
    quality: 3,
    creditNote: '1x credits (tier default)',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
  },
  fast: {
    icon: Zap,
    speed: 5,
    quality: 2,
    creditNote: '0.5x credits',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
  },
  balanced: {
    icon: Scale,
    speed: 3,
    quality: 4,
    creditNote: '1x credits',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-500',
  },
  powerful: {
    icon: Sparkles,
    speed: 2,
    quality: 5,
    creditNote: '2x credits',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
  },
};

const CARD_DESCRIPTIONS: Record<string, string> = {
  auto: 'Let JEDI automatically select the best model based on your tier and the task at hand. Recommended for most users.',
  fast: 'Claude Haiku — optimized for speed. Great for quick lookups, simple questions, and high-volume tasks.',
  balanced: 'Claude Sonnet — the sweet spot between speed and depth. Ideal for analysis, research, and deal evaluation.',
  powerful: 'Claude Opus — maximum reasoning power. Best for complex financial modeling, deep research, and critical decisions.',
};

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-14">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-2 rounded-sm ${i < value ? 'bg-current opacity-80' : 'bg-gray-200'}`}
          />
        ))}
      </div>
    </div>
  );
}

export function AIModelSettings() {
  const [data, setData] = useState<AIPreferencesData | null>(null);
  const [selected, setSelected] = useState<string>('auto');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showUpgradeFor, setShowUpgradeFor] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/v1/settings/ai-preferences');
      const respData = response.data?.data || response.data;
      setData(respData);
      setSelected(respData.currentPreference || 'auto');
    } catch (error) {
      console.error('Error loading AI preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreference = async (preference: string) => {
    setSaving(true);
    setMessage(null);
    try {
      await apiClient.put('/api/v1/settings/ai-preferences', { preference });
      setSelected(preference);
      setMessage({ type: 'success', text: 'AI model preference saved' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      const errMsg = error.response?.data?.error || 'Failed to save preference';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setSaving(false);
    }
  };

  const handleCardClick = (option: AIOption) => {
    if (option.locked) {
      setShowUpgradeFor(option.value);
      return;
    }
    if (option.value !== selected) {
      savePreference(option.value);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const options = data?.options || [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">AI Model Preference</h2>
        <p className="text-gray-600 text-sm mb-6">
          Choose how JEDI selects AI models for your requests. This affects response speed, quality, and credit consumption.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {options.map((option) => {
            const meta = CARD_META[option.value] || CARD_META.auto;
            const Icon = meta.icon;
            const isSelected = selected === option.value;
            const isLocked = option.locked;

            return (
              <button
                key={option.value}
                onClick={() => handleCardClick(option)}
                disabled={saving}
                className={`relative text-left p-5 rounded-xl border-2 transition-all ${
                  isSelected
                    ? `${meta.borderColor} ${meta.bgColor} shadow-sm`
                    : isLocked
                    ? 'border-gray-200 bg-gray-50 opacity-75 cursor-not-allowed'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer'
                } disabled:cursor-wait`}
              >
                {isSelected && (
                  <div className={`absolute top-3 right-3 w-6 h-6 rounded-full ${meta.bgColor} flex items-center justify-center`}>
                    <Check className={`w-4 h-4 ${meta.color}`} />
                  </div>
                )}

                {isLocked && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                    <Lock className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                )}

                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg ${meta.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${meta.color}`} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{option.label}</div>
                    {option.value === 'auto' && (
                      <span className="text-xs text-blue-600 font-medium">Recommended</span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  {CARD_DESCRIPTIONS[option.value] || option.description}
                </p>

                <div className={`space-y-1.5 ${meta.color}`}>
                  <Meter value={meta.speed} max={5} label="Speed" />
                  <Meter value={meta.quality} max={5} label="Quality" />
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200">
                  <span className="text-xs text-gray-500">{meta.creditNote}</span>
                </div>
              </button>
            );
          })}
        </div>

        {message && (
          <div className={`mt-4 px-4 py-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}
      </div>

      {showUpgradeFor && (() => {
        const lockedOption = options.find(o => o.value === showUpgradeFor);
        const lockedLabel = lockedOption?.label || showUpgradeFor;
        const lockedReason = lockedOption?.lockedReason || 'Upgrade your subscription to unlock this model.';
        return (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Upgrade Required</h3>
              <p className="text-sm text-gray-600 mb-4">
                The {lockedLabel} model requires an upgrade. {lockedReason}
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                >
                  View Plans
                  <ArrowRight className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setShowUpgradeFor(null)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-3">How Model Selection Works</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start gap-3">
            <Bot className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <span><strong>Auto</strong> picks the best model for each task — quick lookups use Haiku, deep analysis uses Sonnet or Opus based on your tier.</span>
          </div>
          <div className="flex items-start gap-3">
            <Zap className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span><strong>Fast</strong> always uses Haiku. Great if you want maximum speed and need to conserve credits.</span>
          </div>
          <div className="flex items-start gap-3">
            <Scale className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
            <span><strong>Balanced</strong> always uses Sonnet. Recommended if you want consistently high-quality responses.</span>
          </div>
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
            <span><strong>Powerful</strong> always uses Opus. Consumes 2x credits per request but delivers the deepest reasoning.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
