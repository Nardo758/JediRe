/**
 * AIRenderingPanel - Generate photorealistic renderings from 3D massing
 * Uses ControlNet + SDXL via Replicate API
 */

import React, { useState, useCallback } from 'react';
import { apiClient } from '@/api/client';

interface AIRenderingPanelProps {
  onClose: () => void;
  captureScreenshot: () => string; // Returns base64 image
}

type RenderingStyle = 'modern-glass' | 'brick-traditional' | 'mixed-use-urban' | 'industrial-loft' | 'luxury-highrise';
type TimeOfDay = 'golden-hour' | 'midday' | 'dusk' | 'night';
type Weather = 'sunny' | 'overcast' | 'rainy';

const STYLES: Array<{ id: RenderingStyle; name: string; emoji: string }> = [
  { id: 'modern-glass', name: 'Modern Glass', emoji: '🏢' },
  { id: 'brick-traditional', name: 'Brick Traditional', emoji: '🧱' },
  { id: 'mixed-use-urban', name: 'Mixed-Use Urban', emoji: '🏙️' },
  { id: 'industrial-loft', name: 'Industrial Loft', emoji: '🏭' },
  { id: 'luxury-highrise', name: 'Luxury High-Rise', emoji: '🌆' },
];

const TIME_OF_DAY: Array<{ id: TimeOfDay; name: string; emoji: string }> = [
  { id: 'golden-hour', name: 'Golden Hour', emoji: '🌅' },
  { id: 'midday', name: 'Midday', emoji: '☀️' },
  { id: 'dusk', name: 'Dusk', emoji: '🌇' },
  { id: 'night', name: 'Night', emoji: '🌃' },
];

const WEATHER: Array<{ id: Weather; name: string; emoji: string }> = [
  { id: 'sunny', name: 'Sunny', emoji: '☀️' },
  { id: 'overcast', name: 'Overcast', emoji: '☁️' },
  { id: 'rainy', name: 'Rainy', emoji: '🌧️' },
];

export const AIRenderingPanel: React.FC<AIRenderingPanelProps> = ({
  onClose,
  captureScreenshot,
}) => {
  const [style, setStyle] = useState<RenderingStyle>('modern-glass');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('golden-hour');
  const [weather, setWeather] = useState<Weather>('sunny');
  const [context, setContext] = useState('Atlanta urban context');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imageUrl: string;
    processingTime: number;
  } | null>(null);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Capture screenshot from Three.js canvas
      const screenshotBase64 = captureScreenshot();

      if (!screenshotBase64) {
        throw new Error('Failed to capture screenshot');
      }

      console.log('[AI Rendering] Sending request...');

      // Call backend API
      const response = await apiClient.post('/ai/render', {
        imageBase64: screenshotBase64,
        style,
        timeOfDay,
        weather,
        context: context.trim() || undefined,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Rendering failed');
      }

      setResult({
        imageUrl: response.data.imageUrl,
        processingTime: response.data.processingTime,
      });

      console.log(`[AI Rendering] Complete in ${response.data.processingTime}ms`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[AI Rendering] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [captureScreenshot, style, timeOfDay, weather, context]);

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">🎨 AI Rendering</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {!result ? (
          <div className="space-y-6">
            {/* Style Selector */}
            <div>
              <label className="block text-sm font-medium mb-2">Architectural Style</label>
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    className={`p-3 border-2 rounded-lg text-center transition-all ${
                      style === s.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{s.emoji}</div>
                    <div className="text-sm font-medium">{s.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Time of Day */}
            <div>
              <label className="block text-sm font-medium mb-2">Time of Day</label>
              <div className="grid grid-cols-4 gap-2">
                {TIME_OF_DAY.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTimeOfDay(t.id)}
                    className={`p-2 border-2 rounded-lg text-center transition-all ${
                      timeOfDay === t.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-xl mb-1">{t.emoji}</div>
                    <div className="text-xs font-medium">{t.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Weather */}
            <div>
              <label className="block text-sm font-medium mb-2">Weather</label>
              <div className="grid grid-cols-3 gap-2">
                {WEATHER.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setWeather(w.id)}
                    className={`p-2 border-2 rounded-lg text-center transition-all ${
                      weather === w.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-xl mb-1">{w.emoji}</div>
                    <div className="text-xs font-medium">{w.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Context */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Geographic Context (Optional)
              </label>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g., Atlanta urban, Miami beachfront, Austin downtown"
                className="w-full border rounded px-3 py-2"
              />
              <div className="text-xs text-gray-500 mt-1">
                Adds local architectural context to the rendering
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700">
                ⚠️ {error}
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-medium text-lg transition-colors"
            >
              {loading ? '⏳ Generating... (15-30 seconds)' : '🎨 Generate Rendering'}
            </button>

            <div className="text-xs text-gray-500 text-center">
              Powered by ControlNet + Stable Diffusion XL via Replicate API
            </div>
          </div>
        ) : (
          /* Result Display */
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded p-3 text-green-700">
              ✅ Rendering complete in {(result.processingTime / 1000).toFixed(1)}s
            </div>

            <img
              src={result.imageUrl}
              alt="AI Generated Rendering"
              className="w-full rounded-lg shadow-lg"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setResult(null);
                  setError(null);
                }}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded font-medium"
              >
                ← Generate Another
              </button>
              <a
                href={result.imageUrl}
                download="rendering.png"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium text-center"
              >
                💾 Download
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
