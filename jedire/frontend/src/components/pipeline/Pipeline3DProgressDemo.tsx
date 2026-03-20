/**
 * Pipeline 3D Progress - Demo Component
 * 
 * Quick demo page to test the Pipeline 3D Progress system with mock data.
 * Use this to verify installation and test all features.
 * 
 * Usage:
 *   import { Pipeline3DProgressDemo } from '@/components/pipeline/Pipeline3DProgressDemo';
 *   <Pipeline3DProgressDemo />
 */

import React, { useState } from 'react';
import { Pipeline3DProgress } from './Pipeline3DProgress';
import { MOCK_DATA, generateMockConstructionProgress } from './mockConstructionData';
import { ConstructionProgress } from '../../types/construction';

export const Pipeline3DProgressDemo: React.FC = () => {
  const [progress, setProgress] = useState<ConstructionProgress>(
    generateMockConstructionProgress()
  );
  const [showInstructions, setShowInstructions] = useState(true);

  const handleProgressUpdate = (updatedProgress: ConstructionProgress) => {
    setProgress(updatedProgress);
    console.log('Progress updated:', updatedProgress);
  };

  return (
    <div className="relative h-screen bg-gray-100">
      {/* Demo Header */}
      <div className="absolute top-0 left-0 right-0 bg-purple-600 text-white px-6 py-3 z-50 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🏗️</div>
            <div>
              <h1 className="text-lg font-bold">Pipeline 3D Progress - Demo Mode</h1>
              <p className="text-sm opacity-90">Mock 12-floor multifamily development</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition text-sm font-medium"
            >
              {showInstructions ? '📖 Hide' : '📖 Show'} Instructions
            </button>
            <button
              onClick={() => setProgress(generateMockConstructionProgress())}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-400 transition text-sm font-medium"
            >
              🔄 Reset Data
            </button>
          </div>
        </div>
      </div>

      {/* Instructions Panel */}
      {showInstructions && (
        <div className="absolute top-20 left-4 w-80 bg-white rounded-lg shadow-xl z-40 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3">
            <h3 className="font-bold text-lg">🎮 Demo Instructions</h3>
          </div>
          <div className="p-4 space-y-3 text-sm max-h-[70vh] overflow-y-auto">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
              <h4 className="font-semibold text-blue-900 mb-2">✅ Things to Try:</h4>
              <ul className="space-y-1 text-blue-800">
                <li>• Click building sections in 3D view</li>
                <li>• Use mouse to orbit/pan/zoom</li>
                <li>• Click phases in right sidebar</li>
                <li>• Upload photos (mock upload)</li>
                <li>• View draw schedule</li>
                <li>• Check completion metrics</li>
              </ul>
            </div>

            <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
              <h4 className="font-semibold text-green-900 mb-2">🎨 Color Legend:</h4>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-green-800">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>Complete (100%)</span>
                </div>
                <div className="flex items-center gap-2 text-yellow-800">
                  <div className="w-4 h-4 bg-yellow-400 rounded"></div>
                  <span>In Progress (1-99%)</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <div className="w-4 h-4 bg-gray-400 rounded"></div>
                  <span>Not Started (0%)</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded">
              <h4 className="font-semibold text-amber-900 mb-2">📊 Mock Data:</h4>
              <ul className="space-y-1 text-amber-800">
                <li>• 12 floors (Floors 1-12)</li>
                <li>• Floors 1-4: Complete</li>
                <li>• Floor 5: 60% In Progress</li>
                <li>• Floors 6-12: Not Started</li>
                <li>• 6 construction phases</li>
                <li>• 4 construction draws</li>
              </ul>
            </div>

            <div className="bg-purple-50 border-l-4 border-purple-500 p-3 rounded">
              <h4 className="font-semibold text-purple-900 mb-2">🤖 AI Features (Coming Soon):</h4>
              <p className="text-purple-800 text-xs">
                Auto-photo tagging, progress estimation, quality control, 
                and predictive analytics will be powered by Qwen AI. 
                See AI_PROGRESS_TRACKING_HOOKS.md for details.
              </p>
            </div>

            <div className="bg-gray-50 border-l-4 border-gray-400 p-3 rounded">
              <h4 className="font-semibold text-gray-900 mb-2">📦 Next Steps:</h4>
              <ol className="space-y-1 text-gray-700 text-xs list-decimal list-inside">
                <li>Install Three.js dependencies</li>
                <li>Connect to backend API</li>
                <li>Load real building models</li>
                <li>Integrate with deal pipeline</li>
                <li>Configure AI services</li>
              </ol>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-600">
                📖 <strong>Documentation:</strong> See Pipeline3DProgress_README.md and INSTALLATION.md
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Component */}
      <div className="h-full pt-16">
        <Pipeline3DProgress
          dealId="demo-123-main-street"
          onProgressUpdate={handleProgressUpdate}
        />
      </div>

      {/* Demo Badge */}
      <div className="absolute bottom-4 right-4 bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg z-40">
        🧪 DEMO MODE
      </div>

      {/* Stats Panel */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-xl p-4 z-40 w-64">
        <h4 className="font-bold text-gray-900 mb-2">📊 Progress Stats</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Sections:</span>
            <span className="font-semibold">{progress.sections.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Complete:</span>
            <span className="font-semibold text-green-600">
              {progress.sections.filter(s => s.status === 'complete').length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">In Progress:</span>
            <span className="font-semibold text-yellow-600">
              {progress.sections.filter(s => s.status === 'inProgress').length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Not Started:</span>
            <span className="font-semibold text-gray-400">
              {progress.sections.filter(s => s.status === 'notStarted').length}
            </span>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <div className="flex justify-between">
              <span className="text-gray-900 font-semibold">Overall:</span>
              <span className="text-lg font-bold text-blue-600">
                {progress.metrics.overallPercent.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Help Tooltip */}
      <div className="absolute top-24 right-4 bg-yellow-50 border border-yellow-300 rounded-lg p-3 shadow-lg z-40 w-64">
        <div className="flex items-start gap-2">
          <div className="text-yellow-600 text-xl">💡</div>
          <div className="flex-1">
            <h4 className="font-semibold text-yellow-900 text-sm">Pro Tip</h4>
            <p className="text-xs text-yellow-800 mt-1">
              Use scroll wheel to zoom, left-click to rotate, right-click to pan. 
              Try clicking on different floors to see details!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export as default for easy routing
export default Pipeline3DProgressDemo;

/**
 * Add to your router:
 * 
 * import Pipeline3DProgressDemo from '@/components/pipeline/Pipeline3DProgressDemo';
 * 
 * <Route path="/demo/pipeline-3d" element={<Pipeline3DProgressDemo />} />
 */
