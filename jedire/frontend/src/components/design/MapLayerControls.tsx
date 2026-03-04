import React from 'react';
import { useDesignDashboardStore } from '../../stores/DesignDashboardStore';
import { 
  Layers, 
  Home, 
  Building, 
  Users, 
  Car, 
  MapPin, 
  Train,
  BarChart3
} from 'lucide-react';

export const MapLayerControls: React.FC = () => {
  const { layerVisibility, toggleLayer } = useDesignDashboardStore();

  const layers = [
    {
      key: 'subjectProperty' as const,
      label: 'Subject Property',
      icon: Home,
      color: 'text-blue-600',
    },
    {
      key: 'zoningEnvelope' as const,
      label: 'Zoning Envelope',
      icon: Building,
      color: 'text-purple-600',
    },
    {
      key: 'competition' as const,
      label: 'Competition',
      icon: Users,
      color: 'text-red-600',
    },
    {
      key: 'trafficHeatMap' as const,
      label: 'Traffic Heat Map',
      icon: Car,
      color: 'text-orange-600',
    },
    {
      key: 'poi' as const,
      label: 'Points of Interest',
      icon: MapPin,
      color: 'text-green-600',
    },
    {
      key: 'transit' as const,
      label: 'Transit',
      icon: Train,
      color: 'text-indigo-600',
    },
    {
      key: 'demographics' as const,
      label: 'Demographics',
      icon: BarChart3,
      color: 'text-pink-600',
    },
  ];

  return (
    <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-10">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b">
        <Layers className="w-4 h-4 text-gray-600" />
        <h3 className="text-sm font-medium">Map Layers</h3>
      </div>
      
      <div className="space-y-2">
        {layers.map(({ key, label, icon: Icon, color }) => (
          <label
            key={key}
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
          >
            <input
              type="checkbox"
              checked={layerVisibility[key]}
              onChange={() => toggleLayer(key)}
              className="rounded text-blue-600"
            />
            <Icon className={`w-4 h-4 ${layerVisibility[key] ? color : 'text-gray-400'}`} />
            <span className={`text-sm ${layerVisibility[key] ? 'text-gray-900' : 'text-gray-500'}`}>
              {label}
            </span>
          </label>
        ))}
      </div>
      
      <div className="mt-3 pt-2 border-t">
        <button className="text-xs text-blue-600 hover:text-blue-700">
          Reset to defaults
        </button>
      </div>
    </div>
  );
};