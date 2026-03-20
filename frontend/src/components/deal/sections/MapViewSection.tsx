/**
 * Map View Section - Asset Intelligence Map
 * Full interactive map with asset locations, boundaries, and market intelligence
 */

import React, { useState } from 'react';
import { Deal } from '../../../types/deal';
import { DealMapView } from '../DealMapView';

interface MapViewSectionProps {
  deal: Deal;
  mode?: 'acquisition' | 'performance';
}

export const MapViewSection: React.FC<MapViewSectionProps> = ({ deal, mode = 'acquisition' }) => {
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [activeLayer, setActiveLayer] = useState<'properties' | 'competition' | 'demographics' | 'all'>('all');

  const quickStats = mode === 'acquisition' ? [
    { label: 'Properties in Boundary', value: deal.propertyCount || 0, icon: '🏢' },
    { label: 'Total Acres', value: deal.acres || 0, icon: '📏' },
    { label: 'Avg Distance to CBD', value: deal.avgDistanceCBD ? `${deal.avgDistanceCBD} mi` : 'N/A', icon: '📍' },
    { label: 'Submarket Tier', value: (deal as any).marketTier || 'B+', icon: '⭐' },
    { label: 'POIs Nearby', value: (deal as any).nearbyPOIs || 12, icon: '🎯' }
  ] : [
    { label: 'Asset Units', value: (deal as any).units || 0, icon: '🏢' },
    { label: 'Occupancy Rate', value: `${(deal as any).occupancy || 95}%`, icon: '📊' },
    { label: 'Avg Rent/Unit', value: `$${((deal as any).avgRent || 1500).toLocaleString()}`, icon: '💵' },
    { label: 'Trade Area Pop', value: '48.5K', icon: '👥' },
    { label: 'Competitors Nearby', value: 8, icon: '🏆' }
  ];

  return (
    <div className="space-y-6">
      
      {/* Mode Badge */}
      <div className="flex items-center justify-between">
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          mode === 'acquisition' 
            ? 'bg-[#0d1e3d] text-blue-400' 
            : 'bg-[#022c22] text-green-400'
        }`}>
          {mode === 'acquisition' ? '🎯 Acquisition Map' : '🏢 Performance Map'}
        </div>
        <button
          onClick={() => setShowFullScreen(!showFullScreen)}
          className="px-3 py-1 text-xs font-medium text-blue-600 hover:bg-[#0d1e3d] rounded transition-colors"
        >
          {showFullScreen ? 'Exit Full Screen' : '⛶ Full Screen'}
        </button>
      </div>

      {/* Quick Map Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {quickStats.map((stat, i) => (
          <div key={i} className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-3 text-center">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="text-xs text-[#6B7585] mb-1">{stat.label}</div>
            <div className="text-lg font-bold text-[#E8E6E1]">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Layer Controls */}
      <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#9EA8B4] mb-3">Map Layers</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All Layers', icon: '🗺️' },
            { id: 'properties', label: 'Properties', icon: '🏢' },
            { id: 'competition', label: 'Competition', icon: '🏆' },
            { id: 'demographics', label: 'Demographics', icon: '👥' }
          ].map(layer => (
            <button
              key={layer.id}
              onClick={() => setActiveLayer(layer.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeLayer === layer.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-[#131920] text-[#9EA8B4] hover:bg-[#1e2a3d]'
              }`}
            >
              {layer.icon} {layer.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Map */}
      <div className={`bg-[#0F1319] border border-[#1e2a3d] rounded-lg overflow-hidden ${
        showFullScreen ? 'fixed inset-4 z-50' : ''
      }`}>
        <div className="px-4 py-3 bg-[#0F1319] border-b border-[#1e2a3d] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#9EA8B4] flex items-center gap-2">
            <span>🗺️</span> Interactive Map
            {activeLayer !== 'all' && (
              <span className="text-xs font-normal text-[#6B7585]">
                (Showing: {activeLayer})
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-xs font-medium text-[#9EA8B4] hover:text-[#E8E6E1] hover:bg-[#131920] rounded transition-colors">
              📥 Export
            </button>
            <button className="px-3 py-1 text-xs font-medium text-[#9EA8B4] hover:text-[#E8E6E1] hover:bg-[#131920] rounded transition-colors">
              ⚙️ Settings
            </button>
          </div>
        </div>
        
        <div className={showFullScreen ? 'h-[calc(100%-60px)]' : 'h-[600px]'}>
          <DealMapView deal={deal} />
        </div>
      </div>

      {/* Map Legend */}
      <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#9EA8B4] mb-3">Map Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 border-2 border-blue-700 rounded"></div>
            <span className="text-[#9EA8B4]">Deal Boundary</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="text-[#9EA8B4]">Properties</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span className="text-[#9EA8B4]">Competition</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 rounded"></div>
            <span className="text-[#9EA8B4]">POIs</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded-full border-2 border-yellow-700"></div>
            <span className="text-[#9EA8B4]">Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-r from-blue-200 to-blue-500 rounded"></div>
            <span className="text-[#9EA8B4]">Heat Zones</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-dashed border-orange-500"></div>
            <span className="text-[#9EA8B4]">Search Area</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-indigo-500 opacity-30 rounded"></div>
            <span className="text-[#9EA8B4]">Demographics</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-[#0F1319] border border-[#1e2a3d] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#9EA8B4] mb-3">Map Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-blue-600 bg-[#0d1e3d] hover:bg-[#0d1e3d] rounded-lg transition-colors">
            <span>🔍</span> Search Properties
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-purple-600 bg-[#1a0d3d] hover:bg-[#1a0d3d] rounded-lg transition-colors">
            <span>📊</span> View Heatmap
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-green-600 bg-[#022c22] hover:bg-[#022c22] rounded-lg transition-colors">
            <span>📍</span> Add POI
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-orange-600 bg-[#1a0d00] hover:bg-[#1a0d00] rounded-lg transition-colors">
            <span>📐</span> Measure Distance
          </button>
        </div>
      </div>

    </div>
  );
};
