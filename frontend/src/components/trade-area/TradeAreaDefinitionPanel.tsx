import React, { useEffect } from 'react';
import { useTradeAreaStore } from '../../stores/tradeAreaStore';
import { DefinitionMethod } from '../../types/trade-area';

interface TradeAreaDefinitionPanelProps {
  propertyLat: number;
  propertyLng: number;
  onSave: (tradeAreaId: number) => void;
  onSkip: () => void;
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
    saveTradeArea,
  } = useTradeAreaStore();

  const [tradeAreaName, setTradeAreaName] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  // Auto-generate radius circle when radius changes
  useEffect(() => {
    if (definitionMethod === 'radius') {
      generateRadiusCircle(propertyLat, propertyLng, radiusMiles);
    }
  }, [definitionMethod, radiusMiles, propertyLat, propertyLng]);

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
                {method === 'custom_draw' && 'Draw your own'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Method-Specific Controls */}
      {definitionMethod === 'radius' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Radius: {radiusMiles} miles
          </label>
          <input
            type="range"
            min="1"
            max="10"
            step="0.5"
            value={radiusMiles}
            onChange={(e) => setRadiusMiles(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1 mi</span>
            <span>5 mi</span>
            <span>10 mi</span>
          </div>
        </div>
      )}

      {definitionMethod === 'drive_time' && (
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Drive Time
            </label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => setDriveTimeMinutes(minutes)}
                  className={`
                    flex-1 px-4 py-2 rounded-lg border-2 transition-all
                    ${driveTimeMinutes === minutes
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }
                  `}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Travel Mode
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setDriveTimeProfile('driving')}
                className={`
                  flex-1 px-4 py-2 rounded-lg border-2 transition-all
                  ${driveTimeProfile === 'driving'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }
                `}
              >
                🚗 Driving
              </button>
              <button
                onClick={() => setDriveTimeProfile('walking')}
                className={`
                  flex-1 px-4 py-2 rounded-lg border-2 transition-all
                  ${driveTimeProfile === 'walking'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }
                `}
              >
                🚶 Walking
              </button>
            </div>
          </div>
        </div>
      )}

      {definitionMethod === 'traffic_informed' && (
        <div className="mb-6 p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h3 className="font-semibold text-purple-900 mb-1">
                AI-Powered Trade Area
              </h3>
              <p className="text-sm text-purple-700">
                Our AI will analyze traffic patterns, commute corridors, and natural barriers
                to suggest an optimal competitive boundary.
              </p>
              <button className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                Generate AI Boundary
              </button>
            </div>
          </div>
        </div>
      )}

      {definitionMethod === 'custom_draw' && (
        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✏️</span>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">
                Draw Custom Boundary
              </h3>
              <p className="text-sm text-blue-700">
                Click points on the map to draw a polygon boundary. 
                Double-click to finish.
              </p>
            </div>
          </div>
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
                {previewStats.population.toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Existing Units</div>
              <div className="text-lg font-bold text-gray-900">
                {previewStats.existing_units.toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Pipeline Units</div>
              <div className="text-lg font-bold text-gray-900">
                {previewStats.pipeline_units.toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Avg Rent</div>
              <div className="text-lg font-bold text-gray-900">
                ${previewStats.avg_rent.toLocaleString()}
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
            type="text"
            value={tradeAreaName}
            onChange={(e) => setTradeAreaName(e.target.value)}
            placeholder={`${radiusMiles}-Mile Trade Area`}
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
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors font-semibold"
        >
          {isSaving ? 'Saving...' : 'Save Trade Area'}
        </button>
      </div>
    </div>
  );
};
