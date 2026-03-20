import React from 'react';
import { useDesignDashboardStore } from '../../stores/DesignDashboardStore';
import { Map, Box, Satellite, LayoutGrid } from 'lucide-react';

export const MapModeSelector: React.FC = () => {
  const { mapMode, setMapMode } = useDesignDashboardStore();

  const modes = [
    {
      value: '2d' as const,
      label: '2D Planning',
      icon: Map,
      description: 'Traditional map view for planning',
    },
    {
      value: '3d' as const,
      label: '3D Design',
      icon: Box,
      description: 'Three-dimensional building design',
    },
    {
      value: 'satellite' as const,
      label: 'Satellite',
      icon: Satellite,
      description: 'Aerial imagery view',
    },
    {
      value: 'split' as const,
      label: 'Split View',
      icon: LayoutGrid,
      description: '2D and 3D side-by-side',
    },
  ];

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-1 z-10">
      <div className="flex">
        {modes.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setMapMode(value)}
            className={`
              flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
              ${mapMode === value 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
            title={modes.find(m => m.value === value)?.description}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};