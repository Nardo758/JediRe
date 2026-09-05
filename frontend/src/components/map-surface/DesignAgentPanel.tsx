/**
 * ═══════════════════════════════════════════════════════════════════
 * DESIGN AGENT PANEL — GPT-6 Astra AI Design Assistant
 * ═══════════════════════════════════════════════════════════════════
 *
 * Natural language prompt → AI-generated building parameters →
 * Real-time 3D preview on the map.
 */

import React, { useState } from 'react';
import { apiClient } from '../../services/api.client';
import type { BuildingParameters } from '../../lib/building-engine';

interface DesignAgentPanelProps {
  parcelContext: {
    lotSizeSqft: number;
    address: string;
    county: string;
    state: string;
    geometry: GeoJSON.Polygon;
  };
  onDesignGenerated: (params: BuildingParameters, reasoning: string) => void;
}

export const DesignAgentPanel: React.FC<DesignAgentPanelProps> = ({
  parcelContext,
  onDesignGenerated,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient.post('/api/v1/design-agent/generate', {
        prompt: prompt.trim(),
        parcelContext,
      });

      if (res.data?.success) {
        const result = res.data;
        onDesignGenerated(result.buildingParams, result.reasoning);
        setLastResult(result);
      } else {
        setError(res.data?.message || 'Generation failed');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Request failed';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const examplePrompts = [
    '5-story wrap-style apartment with 72 units and a pool courtyard',
    'Luxury high-rise, 12 floors, glass facade, rooftop amenities',
    '3-story garden-style, brick, 48 units, dog park',
    'Mixed-use: retail ground floor, 5 floors residential above',
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-3 text-white">
        <h3 className="text-sm font-bold">🤖 AI Design Agent</h3>
        <p className="text-xs text-blue-100 mt-0.5">
          GPT-6 Astra • {parcelContext.lotSizeSqft.toLocaleString()} sqft lot
        </p>
      </div>

      {/* Prompt Input */}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">
          Describe your design
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., 'Design a 5-story wrap-style apartment with 72 units and a pool courtyard'"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) handleGenerate();
          }}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">Cmd+Enter to generate</span>
          <span className="text-xs text-gray-400">{prompt.length} chars</span>
        </div>
      </div>

      {/* Example Prompts */}
      <div>
        <label className="text-xs font-medium text-gray-500 block mb-1.5">
          Try an example
        </label>
        <div className="flex flex-wrap gap-1.5">
          {examplePrompts.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition"
            >
              {ex.length > 40 ? ex.slice(0, 40) + '...' : ex}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isLoading || !prompt.trim()}
        className={`w-full py-2 rounded-lg text-sm font-medium transition ${
          isLoading || !prompt.trim()
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Designing...
          </span>
        ) : (
          '✨ Generate Design'
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {lastResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span className="text-sm font-medium text-green-800">Design generated</span>
            {lastResult.mock && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                Mock mode
              </span>
            )}
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">
            {lastResult.reasoning}
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <MetricPill label="Units" value={lastResult.totalUnits} />
            <MetricPill label="Cost" value={`$${(lastResult.estimatedConstructionCost / 1e6).toFixed(1)}M`} />
            <MetricPill label="NOI" value={`$${(lastResult.estimatedNOI / 1e6).toFixed(1)}M`} />
            <MetricPill label="Confidence" value={lastResult.confidence} />
          </div>

          {lastResult.unitMix && Object.keys(lastResult.unitMix).length > 0 && (
            <div className="pt-1">
              <span className="text-xs font-medium text-gray-500">Unit Mix:</span>
              <div className="flex gap-2 mt-1">
                {Object.entries(lastResult.unitMix).map(([type, count]) => (
                  <span key={type} className="text-xs bg-white px-2 py-0.5 rounded border">
                    {type}: {count as number}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MetricPill: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="bg-white rounded border px-2 py-1">
    <span className="text-gray-400">{label}</span>{' '}
    <span className="font-semibold text-gray-800">{value}</span>
  </div>
);

export default DesignAgentPanel;
