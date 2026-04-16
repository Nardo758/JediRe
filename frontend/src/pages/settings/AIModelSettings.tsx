import React, { useState, useEffect } from 'react';
import { Zap, Scale, Sparkles, Bot, Check, Lock, ArrowRight } from 'lucide-react';
import { apiClient } from '../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';

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

const CARD_META: Record<string, { icon: React.ElementType; speed: number; quality: number; creditNote: string; color: string; borderColor: string }> = {
  auto: {
    icon: Bot,
    speed: 3,
    quality: 3,
    creditNote: '1x credits (tier default)',
    color: BT.text.cyan,
    borderColor: BT.text.cyan,
  },
  fast: {
    icon: Zap,
    speed: 5,
    quality: 2,
    creditNote: '0.5x credits',
    color: BT.text.green,
    borderColor: BT.text.green,
  },
  balanced: {
    icon: Scale,
    speed: 3,
    quality: 4,
    creditNote: '1x credits',
    color: BT.text.amber,
    borderColor: BT.text.amber,
  },
  powerful: {
    icon: Sparkles,
    speed: 2,
    quality: 5,
    creditNote: '2x credits',
    color: BT.text.purple,
    borderColor: BT.text.purple,
  },
};

const CARD_DESCRIPTIONS: Record<string, string> = {
  auto: 'Let JEDI automatically select the best model based on your tier and the task at hand. Recommended for most users.',
  fast: 'Claude Haiku -- optimized for speed. Great for quick lookups, simple questions, and high-volume tasks.',
  balanced: 'Claude Sonnet -- the sweet spot between speed and depth. Ideal for analysis, research, and deal evaluation.',
  powerful: 'Claude Opus -- maximum reasoning power. Best for complex financial modeling, deep research, and critical decisions.',
};

function Meter({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-14" style={{ color: BT.text.muted }}>{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className="w-3 h-2"
            style={{ background: i < value ? color : BT.bg.input, borderRadius: 1, opacity: i < value ? 0.8 : 1 }}
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
        <div className="h-8 w-8" style={{ border: `2px solid ${BT.border.subtle}`, borderBottom: `2px solid ${BT.text.cyan}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  const options = data?.options || [];

  return (
    <div className="space-y-6" style={{ fontFamily: BT.font.label }}>
      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <h2 className="text-xl font-semibold mb-2" style={{ color: BT.text.primary }}>AI Model Preference</h2>
        <p className="text-sm mb-6" style={{ color: BT.text.secondary }}>
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
                className="relative text-left p-5 transition-all disabled:cursor-wait"
                style={{
                  borderRadius: 0,
                  border: `2px solid ${isSelected ? meta.borderColor : BT.border.subtle}`,
                  background: isSelected ? BT.bg.active : isLocked ? BT.bg.panelAlt : BT.bg.panel,
                  opacity: isLocked ? 0.75 : 1,
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                }}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center" style={{ background: BT.bg.panelAlt, borderRadius: 2 }}>
                    <Check className="w-4 h-4" style={{ color: meta.color }} />
                  </div>
                )}

                {isLocked && (
                  <div className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center" style={{ background: BT.bg.panelAlt, borderRadius: 2 }}>
                    <Lock className="w-3.5 h-3.5" style={{ color: BT.text.muted }} />
                  </div>
                )}

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 flex items-center justify-center" style={{ background: BT.bg.panelAlt, borderRadius: 2 }}>
                    <Icon className="w-5 h-5" style={{ color: meta.color }} />
                  </div>
                  <div>
                    <div className="font-semibold" style={{ color: BT.text.primary }}>{option.label}</div>
                    {option.value === 'auto' && (
                      <span className="text-xs font-medium" style={{ color: BT.text.cyan }}>Recommended</span>
                    )}
                  </div>
                </div>

                <p className="text-sm mb-4" style={{ color: BT.text.secondary }}>
                  {CARD_DESCRIPTIONS[option.value] || option.description}
                </p>

                <div className="space-y-1.5">
                  <Meter value={meta.speed} max={5} label="Speed" color={meta.color} />
                  <Meter value={meta.quality} max={5} label="Quality" color={meta.color} />
                </div>

                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                  <span className="text-xs" style={{ color: BT.text.muted }}>{meta.creditNote}</span>
                </div>
              </button>
            );
          })}
        </div>

        {message && (
          <div className="mt-4 px-4 py-3 text-sm" style={{
            background: BT.bg.panelAlt,
            color: message.type === 'success' ? BT.text.green : BT.text.red,
            border: `1px solid ${message.type === 'success' ? BT.text.green : BT.text.red}`,
            borderRadius: 0,
          }}>
            {message.text}
          </div>
        )}
      </div>

      {showUpgradeFor && (() => {
        const lockedOption = options.find(o => o.value === showUpgradeFor);
        const lockedLabel = lockedOption?.label || showUpgradeFor;
        const lockedReason = lockedOption?.lockedReason || 'Upgrade your subscription to unlock this model.';
        return (
        <div className="p-6" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.text.purple}`, borderRadius: 0 }}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: BT.bg.active, borderRadius: 2 }}>
              <Lock className="w-5 h-5" style={{ color: BT.text.purple }} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1" style={{ color: BT.text.primary }}>Upgrade Required</h3>
              <p className="text-sm mb-4" style={{ color: BT.text.secondary }}>
                The {lockedLabel} model requires an upgrade. {lockedReason}
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
                  style={{ background: BT.text.purple, color: BT.bg.terminal, borderRadius: 0 }}
                >
                  View Plans
                  <ArrowRight className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setShowUpgradeFor(null)}
                  className="text-sm"
                  style={{ color: BT.text.muted }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <h3 className="font-semibold mb-3" style={{ color: BT.text.primary }}>How Model Selection Works</h3>
        <div className="space-y-3 text-sm" style={{ color: BT.text.secondary }}>
          <div className="flex items-start gap-3">
            <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BT.text.cyan }} />
            <span><strong style={{ color: BT.text.primary }}>Auto</strong> picks the best model for each task -- quick lookups use Haiku, deep analysis uses Sonnet or Opus based on your tier.</span>
          </div>
          <div className="flex items-start gap-3">
            <Zap className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BT.text.green }} />
            <span><strong style={{ color: BT.text.primary }}>Fast</strong> always uses Haiku. Great if you want maximum speed and need to conserve credits.</span>
          </div>
          <div className="flex items-start gap-3">
            <Scale className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BT.text.amber }} />
            <span><strong style={{ color: BT.text.primary }}>Balanced</strong> always uses Sonnet. Recommended if you want consistently high-quality responses.</span>
          </div>
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BT.text.purple }} />
            <span><strong style={{ color: BT.text.primary }}>Powerful</strong> always uses Opus. Consumes 2x credits per request but delivers the deepest reasoning.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
