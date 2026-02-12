import React, { useEffect } from 'react';
import { useTradeAreaStore } from '../../stores/tradeAreaStore';
import { DefinitionMethod } from '../../types/trade-area';

interface TradeAreaDefinitionPanelProps {
  propertyLat: number;
  propertyLng: number;
  onSave: (tradeAreaId: number) => void;
  onSkip: () => void;
  onCustomDraw?: () => void;
}

const methodIcons: Record<DefinitionMethod, string> = {
  radius: '📍',
  drive_time: '🚗',
  traffic_informed: '🤖',
  custom_draw: '✏️',
};

const methodLabels: Record<DefinitionMethod, string> = {
  radius: 'Quick Radius',
  drive_time: 'Drive-Time',
  traffic_informed: 'Traffic-Informed (AI)',
  custom_draw: 'Custom Draw',
};

export const TradeAreaDefinitionPanel: React.FC<TradeAreaDefinitionPanelProps> = ({
  propertyLat,
  propertyLng,
  onSave,
  onSkip,
  onCustomDraw,
}) => {
  const {
    definitionMethod,
    radiusMiles,
    driveTimeMinutes,
    driveTimeProfile,
    previewStats,
    draftGeometry,
    setDefinitionMethod,
    setRadiusMiles,
    setDriveTimeMinutes,
    setDriveTimeProfile,
    generateRadiusCircle,
    generateDriveTimeIsochrone,
    generateTrafficInformedBoundary,
    saveTradeArea,
  } = useTradeAreaStore();

  const [tradeAreaName, setTradeAreaName] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Generate radius on method change, but not on slider change (too many API calls)
  useEffect(() => {
    if (definitionMethod === 'radius') {
      handleGenerateRadius();
    }
  }, [definitionMethod]);
  
  // Auto-activate drawing mode when custom draw is selected
  useEffect(() => {
    if (definitionMethod === 'custom_draw' && onCustomDraw) {
      onCustomDraw();
    }
  }, [definitionMethod, onCustomDraw]);
  
  // Generate radius circle
  const handleGenerateRadius = async () => {
    setIsGenerating(true);
    try {
      console.log('[TradeArea] Generating radius:', { propertyLat, propertyLng, radiusMiles });
      await generateRadiusCircle(propertyLat, propertyLng, radiusMiles);
    } catch (error: any) {
      console.error('[TradeArea] Radius generation failed:', error);
      alert(`Failed to generate radius boundary: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Generate drive-time isochrone
  const handleGenerateDriveTime = async () => {
    setIsGenerating(true);
    try {
      // Always use 'driving' profile (walking removed per user feedback)
      await generateDriveTimeIsochrone(propertyLat, propertyLng, driveTimeMinutes, 'driving');
    } catch (error: any) {
      alert(`Failed to generate drive-time boundary: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Generate AI-powered boundary
  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      // Always use 5 miles as default (per user feedback - AI should just work automatically)
      await generateTrafficInformedBoundary(propertyLat, propertyLng, 5);
    } catch (error: any) {
      alert(`Failed to generate AI boundary: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!draftGeometry) {
      alert('Please define a trade area boundary first');
      return;
    }

    const name = tradeAreaName.trim() || `${radiusMiles}-Mile Trade Area`;
    
    setIsSaving(true);
    try {
      const tradeArea = await saveTradeArea(name);
      onSave(tradeArea.id);
    } catch (error) {
      console.error('Error saving trade area:', error);
      alert('Failed to save trade area');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Define Trade Area
        </h2>
        <p className="text-gray-600">
          How would you like to define your competitive area?
        </p>
      </div>

      {/* Method Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Definition Method
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(['radius', 'drive_time', 'traffic_informed', 'custom_draw'] as DefinitionMethod[]).map((method) => (
            <button
              key={method}
              onClick={() => setDefinitionMethod(method)}
              className={`
                p-4 rounded-lg border-2 transition-all text-left
                ${definitionMethod === method
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
                }
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{methodIcons[method]}</span>
                <span className="font-semibold text-gray-900">
                  {methodLabels[method]}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {method === 'radius' && '1-10 mile circle'}
                {method === 'drive_time' && '5-20 minute isochrone'}
                {method === 'traffic_informed' && 'AI-generated boundary'}
                {method === 'custom_draw' && 'Define precise boundaries for accurate property analysis, competitive intel, and market sizing'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Method-Specific Controls */}
      {definitionMethod === 'radius' && (
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Radius: {radiusMiles} miles
            </label>
            <input
              id="trade-area-radius"
              name="radiusMiles"
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={radiusMiles}
              onChange={(e) => setRadiusMiles(parseFloat(e.target.value))}
              aria-label="Trade area radius in miles"
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 mi</span>
              <span>5 mi</span>
              <span>10 mi</span>
            </div>
          </div>
          <div className="flex justify-center">
            <button
              onClick={handleGenerateRadius}
              disabled={isGenerating}
              className="px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-pink-300 transition-colors font-semibold"
            >
              {isGenerating ? 'Generating...' : '📍 Generate Radius Circle'}
            </button>
          </div>
          {draftGeometry && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✓ {radiusMiles}-mile circle generated and ready to save
              </p>
            </div>
          )}
        </div>
      )}

      {definitionMethod === 'drive_time' && (
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Drive Time (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={driveTimeMinutes}
              onChange={(e) => setDriveTimeMinutes(parseInt(e.target.value) || 10)}
              placeholder="e.g., 10"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter drive time in minutes (typically 5-20 minutes for trade areas)
            </p>
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => handleGenerateDriveTime()}
              disabled={isGenerating}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 transition-colors font-semibold"
            >
              {isGenerating ? 'Generating...' : '🚗 Generate Drive-Time Boundary'}
            </button>
          </div>
        </div>
      )}

      {definitionMethod === 'traffic_informed' && (
        <div className="mb-6 space-y-4">
          <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🤖</span>
              <div>
                <h3 className="font-semibold text-purple-900 mb-1">
                  AI-Powered Trade Area
                </h3>
                <p className="text-sm text-purple-700 mb-3">
                  Our AI analyzes multiple drive-time scenarios, traffic patterns, and
                  commute corridors to generate an intelligent competitive boundary.
                  Starting with a smart 5-mile search radius.
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-center">
            <button
              onClick={handleGenerateAI}
              disabled={isGenerating}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-300 transition-colors font-semibold"
            >
              {isGenerating ? 'AI Generating... (may take 10-15 seconds)' : '🤖 Generate AI Boundary'}
            </button>
          </div>
          {draftGeometry && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✓ AI-powered boundary generated (5-mile radius). You can refine this later in deal settings.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Preview Stats */}
      {previewStats && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Trade Area Preview
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Population</div>
              <div className="text-lg font-bold text-gray-900">
                {(previewStats.population ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Existing Units</div>
              <div className="text-lg font-bold text-gray-900">
                {(previewStats.existing_units ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Pipeline Units</div>
              <div className="text-lg font-bold text-gray-900">
                {(previewStats.pipeline_units ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Avg Rent</div>
              <div className="text-lg font-bold text-gray-900">
                ${(previewStats.avg_rent ?? 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trade Area Name */}
      {draftGeometry && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Trade Area Name (Optional)
          </label>
          <input
            id="trade-area-name"
            name="tradeAreaName"
            type="text"
            value={tradeAreaName}
            onChange={(e) => setTradeAreaName(e.target.value)}
            placeholder={`${radiusMiles}-Mile Trade Area`}
            aria-label="Trade area name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <button
          onClick={onSkip}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Skip - Use Submarket Default
        </button>
        <button
          onClick={handleSave}
          disabled={!draftGeometry || isSaving}
          className={`px-6 py-2 rounded-lg transition-colors font-semibold ${
            !draftGeometry || isSaving
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          title={!draftGeometry ? 'Please select a definition method and generate boundary' : ''}
        >
          {isSaving ? 'Saving...' : 'Save Trade Area'}
        </button>
      </div>
    </div>
  );
};
