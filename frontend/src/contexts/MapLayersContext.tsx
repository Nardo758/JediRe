import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Layer {
  id: string;
  name: string;
  type: 'custom' | 'assets' | 'pipeline' | 'market';
  icon: string;
  active: boolean;
  opacity: number;
}

interface MapLayersContextType {
  layers: Layer[];
  toggleLayer: (layerId: string) => void;
  updateOpacity: (layerId: string, opacity: number) => void;
  reorderLayers: (layers: Layer[]) => void;
  getActiveLayerIds: () => string[];
  getLayerOpacity: (layerId: string) => number;
  createLayer: (id: string, name: string, icon: string, type?: Layer['type']) => void;
}

const MapLayersContext = createContext<MapLayersContextType | undefined>(undefined);

interface MapLayersProviderProps {
  children: ReactNode;
}

export function MapLayersProvider({ children }: MapLayersProviderProps) {
  const [layers, setLayers] = useState<Layer[]>([
    { id: 'custom-1', name: 'Midtown Research', type: 'custom', icon: '📍', active: false, opacity: 0.8 },
    { id: 'custom-2', name: 'Competitor Analysis', type: 'custom', icon: '📍', active: false, opacity: 0.8 },
    { id: 'custom-3', name: 'Broker Recommendations', type: 'custom', icon: '📍', active: false, opacity: 0.8 },
    { id: 'news-intelligence', name: 'News Intelligence', type: 'custom', icon: '📰', active: false, opacity: 1.0 },
    { id: 'assets-owned', name: 'Assets Owned', type: 'assets', icon: '🏢', active: false, opacity: 1.0 },
    { id: 'pipeline', name: 'Pipeline', type: 'pipeline', icon: '📁', active: false, opacity: 1.0 },
  ]);

  const toggleLayer = (layerId: string) => {
    setLayers(layers =>
      layers.map(l => (l.id === layerId ? { ...l, active: !l.active } : l))
    );
  };

  const updateOpacity = (layerId: string, opacity: number) => {
    setLayers(layers =>
      layers.map(l => (l.id === layerId ? { ...l, opacity } : l))
    );
  };

  const reorderLayers = (newLayers: Layer[]) => {
    setLayers(newLayers);
  };

  const getActiveLayerIds = () => {
    return layers.filter(l => l.active).map(l => l.id);
  };

  const getLayerOpacity = (layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    return layer?.opacity ?? 1.0;
  };

  const createLayer = (id: string, name: string, icon: string, type: Layer['type'] = 'custom') => {
    // Check if layer already exists
    const existingLayer = layers.find(l => l.id === id);
    
    if (existingLayer) {
      // Layer exists, just toggle it on
      console.log(`[MapLayers] Layer ${id} already exists, toggling on`);
      if (!existingLayer.active) {
        toggleLayer(id);
      }
    } else {
      // Create new layer
      console.log(`[MapLayers] Creating new layer: ${id}`);
      const newLayer: Layer = {
        id,
        name,
        type,
        icon,
        active: true, // Start active
        opacity: 1.0
      };
      setLayers([...layers, newLayer]);
    }
  };

  const value: MapLayersContextType = {
    layers,
    toggleLayer,
    updateOpacity,
    reorderLayers,
    getActiveLayerIds,
    getLayerOpacity,
    createLayer,
  };

  return (
    <MapLayersContext.Provider value={value}>
      {children}
    </MapLayersContext.Provider>
  );
}

export function useMapLayers() {
  const context = useContext(MapLayersContext);
  if (context === undefined) {
    throw new Error('useMapLayers must be used within a MapLayersProvider');
  }
  return context;
}
