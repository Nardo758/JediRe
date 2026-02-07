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
    { id: 'assets-owned', name: 'Assets Owned', type: 'assets', icon: '🏢', active: true, opacity: 1.0 },
    { id: 'pipeline', name: 'Pipeline', type: 'pipeline', icon: '📁', active: true, opacity: 1.0 },
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

  const value: MapLayersContextType = {
    layers,
    toggleLayer,
    updateOpacity,
    reorderLayers,
    getActiveLayerIds,
    getLayerOpacity,
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
