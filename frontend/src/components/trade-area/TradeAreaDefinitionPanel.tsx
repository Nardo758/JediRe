import React, { useEffect, useRef } from 'react';
import { useTradeAreaStore } from '../../stores/tradeAreaStore';
import { DefinitionMethod } from '../../types/trade-area';

interface TradeAreaDefinitionPanelProps {
  propertyLat: number;
  propertyLng: number;
  onSave: (tradeAreaId: string) => void;
  onSkip: () => void;
  onCustomDraw?: () => void;
  onCustomDrawCancel?: () => void;
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
  onCustomDrawCancel,
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
    clearDraft,
  } = useTradeAreaStore();

  const [tradeAreaName, setTradeAreaName] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generatedMethod, setGeneratedMethod] = React.useState<DefinitionMethod | null>(null);
  const lastMethodRef = useRef<DefinitionMethod | null>(null);

  const availableMethods: DefinitionMethod[] = onCustomDraw
    ? ['radius', 'drive_time', 'traffic_informed', 'custom_draw']
    : ['radius', 'drive_time', 'traffic_informed'];

  useEffect(() => {
    if (!definitionMethod) {
      setDefinitionMethod('radius');
    }
  }, []);

  useEffect(() => {
    if (definitionMethod === 'radius' && lastMethodRef.current !== 'radius') {
      lastMethodRef.current = 'radius';
      handleGenerateRadius();
    } else {
      lastMethodRef.current = definitionMethod;
    }
  }, [definitionMethod]);

  useEffect(() => {
    if (definitionMethod === 'custom_draw' && onCustomDraw) {
      onCustomDraw();
    }
  }, [definitionMethod]);

  useEffect(() => {
    if (definitionMethod === 'custom_draw' && draftGeometry && generatedMethod !== 'custom_draw') {
      setGeneratedMethod('custom_draw');
    }
  }, [definitionMethod, draftGeometry, generatedMethod]);

  const handleMethodChange = (method: DefinitionMethod) => {
    if (method !== definitionMethod) {
      if (definitionMethod === 'custom_draw' && onCustomDrawCancel) {
        onCustomDrawCancel();
      }
      clearDraft();
      setGeneratedMethod(null);
      setDefinitionMethod(method);
    }
  };

  const handleGenerateRadius = async () => {
    setIsGenerating(true);
    try {
      console.log('[TradeArea] Generating radius:', { propertyLat, propertyLng, radiusMiles });
      await generateRadiusCircle(propertyLat, propertyLng, radiusMiles);
      setGeneratedMethod('radius');
    } catch (error: any) {
      console.error('[TradeArea] Radius generation failed:', error);
      alert(`Failed to generate radius boundary: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateDriveTime = async () => {
    setIsGenerating(true);
    try {
      console.log('[TradeArea] Generating drive-time:', { propertyLat, propertyLng, driveTimeMinutes });
      await generateDriveTimeIsochrone(propertyLat, propertyLng, driveTimeMinutes, 'driving');
      setGeneratedMethod('drive_time');
    } catch (error: any) {
      console.error('[TradeArea] Drive-time generation failed:', error);
      alert(`Failed to generate drive-time boundary: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      console.log('[TradeArea] Generating AI boundary:', { propertyLat, propertyLng });
      await generateTrafficInformedBoundary(propertyLat, propertyLng, 5);
      setGeneratedMethod('traffic_informed');
    } catch (error: any) {
      console.error('[TradeArea] AI generation failed:', error);
      alert(`Failed to generate AI boundary: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const getDefaultName = () => {
    const method = generatedMethod || definitionMethod;
    if (method === 'drive_time') return `${driveTimeMinutes}-Min Drive Time`;
    if (method === 'traffic_informed') return 'AI Trade Area';
    if (method === 'custom_draw') return 'Custom Trade Area';
    return `${radiusMiles}-Mile Trade Area`;
  };

  const handleSave = async () => {
    if (!draftGeometry) {
      alert('Please define a trade area boundary first');
      return;
    }

    const name = tradeAreaName.trim() || getDefaultName();

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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Define Trade Area
        </h2>
        <p className="text-gray-600">
          How would you like to define your competitive area?
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Definition Method
        </label>
        <div className="grid grid-cols-2 gap-3">
          {availableMethods.map((method) => (
            <button
              key={method}
              onClick={() => handleMethodChange(method)}
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
                {method === 'drive_time' && 'Road-network isochrone'}
                {method === 'traffic_informed' && 'Multi-scenario AI boundary'}
                {method === 'custom_draw' && 'Draw on map'}
              </p>
            </button>
          ))}
        </div>
      </div>

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
          {draftGeometry && generatedMethod === 'radius' && (
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
              Drive Time: {driveTimeMinutes} minutes
            </label>
            <input
              type="range"
              min="5"
              max="30"
              step="5"
              value={driveTimeMinutes}
              onChange={(e) => setDriveTimeMinutes(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5 min</span>
              <span>15 min</span>
              <span>30 min</span>
            </div>
          </div>
          <div className="flex justify-center">
            <button
              onClick={handleGenerateDriveTime}
              disabled={isGenerating}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 transition-colors font-semibold"
            >
              {isGenerating ? 'Generating isochrone...' : '🚗 Generate Drive-Time Boundary'}
            </button>
          </div>
          {draftGeometry && generatedMethod === 'drive_time' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✓ {driveTimeMinutes}-minute drive-time boundary generated. Shaped by real road networks.
              </p>
            </div>
          )}
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
                <p className="text-sm text-purple-700">
                  Generates 6 isochrones across driving and traffic-aware profiles
                  at off-peak, average, and peak times, then merges them into one
                  intelligent boundary.
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
              {isGenerating ? 'AI Generating... (10-15 seconds)' : '🤖 Generate AI Boundary'}
            </button>
          </div>
          {draftGeometry && generatedMethod === 'traffic_informed' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✓ AI-powered boundary generated from multiple traffic scenarios. Ready to save.
              </p>
            </div>
          )}
        </div>
      )}

      {definitionMethod === 'custom_draw' && (
        <div className="mb-6 space-y-4">
          <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✏️</span>
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">
                  Draw Your Trade Area
                </h3>
                <p className="text-sm text-blue-700">
                  Use the drawing tools on the map to trace your boundary.
                  Click to place points, then double-click to close the polygon.
                </p>
              </div>
            </div>
          </div>
          {draftGeometry && generatedMethod === 'custom_draw' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✓ Custom boundary drawn and ready to save.
              </p>
            </div>
          )}
        </div>
      )}

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
              <div className="text-xs text-gray-600 mb-1">Median Income</div>
              <div className="text-lg font-bold text-gray-900">
                ${(previewStats.median_income ?? 0).toLocaleString()}
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
            {previewStats.census_housing_units > 0 && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Housing Units</div>
                <div className="text-lg font-bold text-gray-900">
                  {(previewStats.census_housing_units ?? 0).toLocaleString()}
                </div>
              </div>
            )}
          </div>
          {previewStats.data_source === 'census_acs5' && (
            <div className="mt-2 text-xs text-gray-400 text-right">
              Source: U.S. Census ACS {previewStats.census_vintage}
            </div>
          )}
        </div>
      )}

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
            placeholder={getDefaultName()}
            aria-label="Trade area name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

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
