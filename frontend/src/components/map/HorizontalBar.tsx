import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayerControlsPanel } from './LayerControlsPanel';
import { useMapLayers } from '../../contexts/MapLayersContext';
import { useDealStore } from '../../stores/dealStore';

interface CustomMap {
  id: string;
  name: string;
  icon: string;
  active: boolean;
}

export function HorizontalBar() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [warMapsActive, setWarMapsActive] = useState(false);
  const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);
  const { layers, toggleLayer, updateOpacity, reorderLayers } = useMapLayers();
  const { fetchDeals } = useDealStore();
  
  const [customMaps, setCustomMaps] = useState<CustomMap[]>([
    { id: '1', name: 'Midtown Research', icon: '📍', active: false },
    { id: '2', name: 'Competitor Analysis', icon: '📍', active: false },
    { id: '3', name: 'Broker Recommendations', icon: '📍', active: false },
  ]);

  const toggleWarMaps = () => {
    const newState = !warMapsActive;
    setWarMapsActive(newState);
    // When War Maps is activated, show all layers
    if (newState) {
      layers.forEach(layer => {
        if (!layer.active) {
          toggleLayer(layer.id);
        }
      });
      setCustomMaps(maps => maps.map(m => ({ ...m, active: true })));
    }
  };

  const toggleCustomMap = (id: string) => {
    setCustomMaps(maps =>
      maps.map(m => (m.id === id ? { ...m, active: !m.active } : m))
    );
    // Sync with layers state
    toggleLayer(`custom-${id}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    // Navigate to search results (implement search page later)
    console.log('Searching for:', searchQuery);
    // TODO: Implement search functionality
    // navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleCreateDeal = () => {
    // Navigate to dashboard with create modal open
    navigate('/dashboard', { state: { openCreateDeal: true } });
  };

  const handleCreateMap = () => {
    // TODO: Implement create map modal
    console.log('Create Map clicked');
  };

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 z-20">
      {/* Google Search Bar */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xl">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search for addresses, apartments, locations..."
            aria-label="Search for addresses, apartments, locations"
            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </form>

      {/* War Maps Button */}
      <button
        onClick={toggleWarMaps}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
          warMapsActive
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        <span className="text-lg">🗺️</span>
        <span className="hidden sm:inline">War Maps</span>
      </button>

      {/* Custom Map Buttons */}
      <div className="flex items-center gap-2">
        {customMaps.map((map) => (
          <button
            key={map.id}
            onClick={() => toggleCustomMap(map.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
              map.active
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>{map.icon}</span>
            <span className="hidden md:inline">{map.name}</span>
          </button>
        ))}
      </div>

      {/* Create Map Button */}
      <button 
        onClick={handleCreateMap}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span className="text-lg">➕</span>
        <span className="hidden lg:inline">Create Map</span>
      </button>

      {/* Create Deal Button */}
      <button 
        onClick={handleCreateDeal}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
      >
        <span className="text-lg">➕</span>
        <span className="hidden lg:inline">Create Deal</span>
      </button>
      </div>

      {/* Layer Controls Panel */}
      <LayerControlsPanel
        isOpen={warMapsActive}
        onClose={() => setWarMapsActive(false)}
        layers={layers}
        onToggleLayer={toggleLayer}
        onUpdateOpacity={updateOpacity}
        onReorderLayers={reorderLayers}
      />
    </>
  );
}
