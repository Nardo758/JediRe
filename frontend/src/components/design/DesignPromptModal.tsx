/**
 * DesignPromptModal — Qwen-style prompt modal for the F7 AI Generate button.
 *
 * Opens when user clicks AI Design, shows a textarea where they describe
 * their building vision. Uses keyword analysis to tune massing parameters
 * before calling the generate endpoint.
 *
 * Example prompts:
 *   "I want a 15-story luxury tower with 280 units, rooftop pool, ground floor retail"
 *   "Garden-style 4-story walkup, 120 units, courtyard with pool"
 *   "Mid-rise L-shaped building, 8 stories, 200 units, parking podium"
 *   "Mix of studio and one-bedroom units, modern design, 10 floors"
 */

import React, { useState, useCallback } from 'react';
import { X, Sparkles, Loader2, Lightbulb } from 'lucide-react';
import type { MassingResult } from '../../hooks/useDesignMassing';

// ─── Prompt Parser ─────────────────────────────────────────────────────────

interface ParsedPrompt {
  targetUnits?: number;
  targetStories?: number;
  targetHeight?: string;
  formFactor?: 'auto' | 'bar' | 'l_shape' | 'u_shape' | 'courtyard' | 'point_tower';
  designPriority?: 'density' | 'unit_mix' | 'open_space' | 'parking';
  prefersRetail: boolean;
  prefersPremium: boolean;
  keywords: string[];
}

function parseDesignPrompt(prompt: string): ParsedPrompt {
  const lower = prompt.toLowerCase();
  const result: ParsedPrompt = {
    prefersRetail: false,
    prefersPremium: false,
    keywords: [],
  };

  // Extract unit count
  const unitMatch = lower.match(/(\d+)\s*unit/);
  if (unitMatch) result.targetUnits = parseInt(unitMatch[1], 10);

  // Extract story/floor count
  const storyMatch = lower.match(/(\d+)\s*-?\s*(story|floor|level)/);
  if (storyMatch) result.targetStories = parseInt(storyMatch[1], 10);

  // Extract height descriptor
  const heightWords = ['high-rise', 'highrise', 'tower', 'skyscraper', 'tall'];
  const midWords = ['mid-rise', 'midrise', 'mid-rise ', 'medium'];
  const lowWords = ['low-rise', 'lowrise', 'garden', 'walkup', 'walk-up', 'townhouse'];
  for (const w of heightWords) { if (lower.includes(w)) result.targetHeight = 'high'; break; }
  for (const w of midWords) { if (lower.includes(w)) { result.targetHeight = 'mid'; break; } }
  for (const w of lowWords) { if (lower.includes(w)) { result.targetHeight = 'low'; break; } }

  // Form factor hints
  if (lower.includes('tower') || lower.includes('point')) {
    if (!result.targetHeight) result.targetHeight = 'high';
    result.formFactor = 'point_tower';
  } else if (lower.includes('l-shape') || lower.includes('l shape') || lower.includes('el-shape')) {
    result.formFactor = 'l_shape';
  } else if (lower.includes('u-shape') || lower.includes('u shape')) {
    result.formFactor = 'u_shape';
  } else if (lower.includes('courtyard')) {
    result.formFactor = 'courtyard';
  } else if (lower.includes('bar') || lower.includes('slab') || lower.includes('rectangle')) {
    result.formFactor = 'bar';
  }

  // Design priority
  if (lower.includes('luxury') || lower.includes('premium') || lower.includes('high-end') || lower.includes('upscale')) {
    result.designPriority = 'unit_mix';
    result.prefersPremium = true;
  }
  if (lower.includes('density') || lower.includes('dense') || lower.includes('maximize')) {
    result.designPriority = 'density';
  }
  if (lower.includes('open space') || lower.includes('courtyard') || lower.includes('green') || lower.includes('garden')) {
    if (!result.formFactor || result.formFactor === 'auto') {
      result.formFactor = 'courtyard';
    }
    result.designPriority = 'open_space';
  }

  // Retail
  if (lower.includes('retail') || lower.includes('commercial') || lower.includes('ground floor') || lower.includes('storefront')) {
    result.prefersRetail = true;
  }

  // Collect keywords for display
  const allKeywords = [
    ...(unitMatch ? [`${unitMatch[1]} units`] : []),
    ...(storyMatch ? [`${storyMatch[1]} stories`] : []),
    ...(result.targetHeight ? [result.targetHeight + '-rise'] : []),
    ...(result.formFactor && result.formFactor !== 'auto' ? [result.formFactor.replace('_', ' ')] : []),
    ...(result.prefersPremium ? ['luxury'] : []),
    ...(result.prefersRetail ? ['retail'] : []),
  ];
  result.keywords = allKeywords;

  return result;
}

// ─── Suggested prompts ──────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  'A 12-story luxury tower with 280 units, ground floor retail, and a rooftop amenity deck',
  'Garden-style 4-story walkup, 120 units, central courtyard with pool',
  'Mid-rise L-shaped building, 8 stories, 200 units, parking podium',
  'High-density point tower, 350 units, 20 floors, studio-heavy mix',
  'U-shaped courtyard building, 6 stories, 160 units, open space priority',
];

// ─── Props ──────────────────────────────────────────────────────────────────

interface DesignPromptModalProps {
  /** Called when user confirms generation with the tuned parameters */
  onGenerate: (params: {
    targetUnits?: number;
    targetStories?: number;
    formFactor?: string;
    designPriority?: string;
    prefersRetail: boolean;
    // Raw prompt for display/logging
    rawPrompt: string;
  }) => void;
  onClose: () => void;
  loading: boolean;
  /** Current defaults for pre-fill hints */
  defaultUnits?: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

const DesignPromptModal: React.FC<DesignPromptModalProps> = ({
  onGenerate,
  onClose,
  loading,
  defaultUnits,
}) => {
  const [prompt, setPrompt] = useState('');
  const [parsed, setParsed] = useState<ParsedPrompt | null>(null);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPrompt(text);
    if (text.trim().length > 5) {
      setParsed(parseDesignPrompt(text));
    } else {
      setParsed(null);
    }
  }, []);

  const handleGenerate = useCallback(() => {
    if (parsed) {
      onGenerate({
        targetUnits: parsed.targetUnits,
        targetStories: parsed.targetStories,
        formFactor: parsed.formFactor,
        designPriority: parsed.designPriority,
        prefersRetail: parsed.prefersRetail,
        rawPrompt: prompt,
      });
    } else {
      // No parsed data — use defaults
      onGenerate({
        rawPrompt: prompt,
        prefersRetail: false,
      });
    }
  }, [parsed, prompt, onGenerate]);

  const handleSuggestion = useCallback((suggestion: string) => {
    setPrompt(suggestion);
    setParsed(parseDesignPrompt(suggestion));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleGenerate();
      }
    },
    [handleGenerate],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">AI Design Prompt</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Describe your building vision
            </label>
            <textarea
              value={prompt}
              onChange={handlePromptChange}
              onKeyDown={handleKeyDown}
              placeholder="e.g., 'I want a 15-story luxury tower with 280 units, ground floor retail, and a rooftop pool'"
              className="w-full h-28 px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              disabled={loading}
            />
            <p className="text-xs text-gray-400 mt-1">
              {defaultUnits
                ? `Current targets: ~${defaultUnits} units. Describe form, height, mix.`
                : 'Try describing form, height, unit count, amenities, or design style.'}
              <span className="ml-2">⌘+Enter to generate</span>
            </p>
          </div>

          {/* Parsed interpretation */}
          {parsed && parsed.keywords.length > 0 && (
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-medium text-purple-700">Interpreted from your prompt:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {parsed.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full"
                  >
                    {kw}
                  </span>
                ))}
              </div>
              {parsed.prefersPremium && (
                <p className="text-xs text-purple-600 mt-1">
                  Luxury priority — unit mix will favor larger units
                </p>
              )}
            </div>
          )}

          {/* Suggested prompts */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium">Try one of these:</p>
            <div className="space-y-1.5">
              {SUGGESTED_PROMPTS.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(suggestion)}
                  className="w-full text-left text-xs text-gray-600 px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors border border-gray-100"
                  disabled={loading}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || loading}
            className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Design
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DesignPromptModal;
