/**
 * Pipeline Map View with Drawing Tools
 * Extended version with comprehensive drawing/annotation capabilities
 */

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import Supercluster from 'supercluster';
import type { BBox } from 'geojson';
import { PipelineDeal } from '@/types/grid';
import DealMapPopup from './DealMapPopup';
import MapControls from './MapControls';
import MapFiltersPanel from './MapFiltersPanel';
import DrawingToolbar, { DrawMode } from './DrawingToolbar';
import SavedDrawingsPanel, { MapAnnotation } from './SavedDrawingsPanel';
import { cn } from '@/utils/cn';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

interface PipelineMapViewWithDrawingProps {
  deals: PipelineDeal[];
  onDealClick?: (deal: PipelineDeal) => void;
  loading?: boolean;
  userId?: string;
}

export interface MapFilters {
  stages: string[];
  priceRange: [number, number];
  minScore?: number;
  showSupplyRisk?: boolean;
  strategies: string[];
  sources: string[];
  radiusCenter?: { lat: number; lng: number };
  radiusMiles?: number;
}

interface DealFeature {
  type: 'Feature';
  properties: PipelineDeal & {
    cluster: false;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

const STAGE_COLORS: Record<string, string> = {
  sourcing: '#10B981',
  underwriting: '#3B82F6',
  'due diligence': '#F59E0B',
  'under contract': '#8B5CF6',
  closing: '#EC4899',
  passed: '#6B7280',
  default: '#6366F1',
};

const getStageColor = (stage: string): string => {
  const normalized = stage?.toLowerCase() || '';
  return STAGE_COLORS[normalized] || STAGE_COLORS.default;
};

const geocodeDeal = (deal: PipelineDeal): [number, number] | null => {
  // Use real coordinates if available
  if (deal.lat && deal.lng) {
    return [deal.lng, deal.lat];
  }
  
  // Mock geocoding for demo
  const baseLatLng: [number, number] = [-84.388, 33.749];
  const offset = 0.5;
  const seed = deal.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const lng = baseLatLng[0] + (Math.sin(seed) * offset);
  const lat = baseLatLng[1] + (Math.cos(seed) * offset);
  
  return [lng, lat];
};

export default function PipelineMapViewWithDrawing({ 
  deals, 
  onDealClick, 
  loading = false,
  userId = 'current-user' 
}: PipelineMapViewWithDrawingProps) {
  const mapRef = useRef<MapRef>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  
  const [selectedDeal, setSelectedDeal] = useState<PipelineDeal | null>(null);
  const [viewState, setViewState] = useState({
    longitude: -84.388,
    latitude: 33.749,
    zoom: 9,
  });

  const [filters, setFilters] = useState<MapFilters>({
    stages: [],
    priceRange: [0, 100000000],
    strategies: [],
    sources: [],
  });

  const [showFilters, setShowFilters] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [drawMode, setDrawMode] = useState<'radius' | null>(null);

  // Drawing state
  const [activeDrawMode, setActiveDrawMode] = useState<DrawMode>(null);
  const [savedDrawings, setSavedDrawings] = useState<MapAnnotation[]>([]);
  const [showSavedDrawings, setShowSavedDrawings] = useState(false);
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize Mapbox Draw
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current.getMap();
    
    if (!drawRef.current) {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        styles: [
          // Custom styles for drawn features
          {
            id: 'gl-draw-polygon-fill',
            type: 'fill',
            filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
            paint: {
              'fill-color': '#3B82F6',
              'fill-outline-color': '#3B82F6',
              'fill-opacity': 0.3,
            },
          },
          {
            id: 'gl-draw-polygon-stroke',
            type: 'line',
            filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
            paint: {
              'line-color': '#3B82F6',
              'line-width': 2,
            },
          },
          {
            id: 'gl-draw-line',
            type: 'line',
            filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
            paint: {
              'line-color': '#3B82F6',
              'line-width': 2,
            },
          },
          {
            id: 'gl-draw-point',
            type: 'circle',
            filter: ['all', ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
            paint: {
              'circle-radius': 6,
              'circle-color': '#3B82F6',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          },
        ],
      });

      map.addControl(draw as any);
      drawRef.current = draw;

      // Drawing event listeners
      map.on('draw.create', handleDrawCreate);
      map.on('draw.update', handleDrawUpdate);
      map.on('draw.delete', handleDrawDelete);
      map.on('draw.selectionchange', handleDrawSelectionChange);
    }

    return () => {
      if (drawRef.current) {
        map.off('draw.create', handleDrawCreate);
        map.off('draw.update', handleDrawUpdate);
        map.off('draw.delete', handleDrawDelete);
        map.off('draw.selectionchange', handleDrawSelectionChange);
      }
    };
  }, [mapRef.current]);

  // Handle drawing mode changes
  useEffect(() => {
    if (!drawRef.current) return;

    const draw = drawRef.current;

    switch (activeDrawMode) {
      case 'point':
        draw.changeMode('draw_point');
        break;
      case 'line_string':
        draw.changeMode('draw_line_string');
        break;
      case 'polygon':
        draw.changeMode('draw_polygon');
        break;
      case 'simple_select':
        draw.changeMode('simple_select');
        break;
      case null:
        draw.changeMode('simple_select');
        break;
    }
  }, [activeDrawMode]);

  // Drawing event handlers
  const handleDrawCreate = useCallback((e: any) => {
    console.log('Drawing created:', e.features);
  }, []);

  const handleDrawUpdate = useCallback((e: any) => {
    console.log('Drawing updated:', e.features);
  }, []);

  const handleDrawDelete = useCallback((e: any) => {
    console.log('Drawing deleted:', e.features);
  }, []);

  const handleDrawSelectionChange = useCallback((e: any) => {
    console.log('Selection changed:', e.features);
  }, []);

  // Save drawings to backend
  const handleSaveDrawings = async () => {
    if (!drawRef.current) return;

    setIsSaving(true);
    try {
      const allFeatures = drawRef.current.getAll();
      
      if (allFeatures.features.length === 0) {
        alert('No drawings to save');
        return;
      }

      const title = prompt('Enter a name for this drawing:', 'Pipeline Annotations');
      if (!title) return;

      const annotation: Omit<MapAnnotation, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        user_name: 'Current User', // TODO: Get from auth
        title,
        description: '',
        geojson: allFeatures,
        color: '#3B82F6',
        is_shared: false,
        shared_with_team: false,
      };

      // TODO: Replace with actual API call
      const response = await fetch(`${API_URL}/map-annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(annotation),
      });

      if (response.ok) {
        const saved = await response.json();
        setSavedDrawings([...savedDrawings, saved]);
        alert('Drawings saved successfully!');
      } else {
        throw new Error('Failed to save drawings');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save drawings. Check console for details.');
    } finally {
      setIsSaving(false);
    }
  };

  // Load saved drawing
  const handleLoadDrawing = useCallback((annotationId: string) => {
    const annotation = savedDrawings.find(d => d.id === annotationId);
    if (!annotation || !drawRef.current) return;

    // Clear existing drawings
    const currentFeatures = drawRef.current.getAll();
    const currentIds = currentFeatures.features.map((f: any) => f.id);
    drawRef.current.delete(currentIds);

    // Add saved features
    annotation.geojson.features.forEach((feature: any) => {
      drawRef.current!.add(feature);
    });
  }, [savedDrawings]);

  // Export drawings as GeoJSON
  const handleExportDrawings = useCallback(() => {
    if (!drawRef.current) return;

    const allFeatures = drawRef.current.getAll();
    
    if (allFeatures.features.length === 0) {
      alert('No drawings to export');
      return;
    }

    const dataStr = JSON.stringify(allFeatures, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `pipeline-drawings-${Date.now()}.geojson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // Delete selected drawings
  const handleDeleteSelected = useCallback(() => {
    if (!drawRef.current) return;

    const selected = drawRef.current.getSelected();
    if (selected.features.length === 0) {
      alert('No drawings selected');
      return;
    }

    if (confirm(`Delete ${selected.features.length} selected drawing(s)?`)) {
      const ids = selected.features.map((f: any) => f.id);
      drawRef.current.delete(ids);
    }
  }, []);

  // Share drawing with team
  const handleShareDrawing = async (annotationId: string) => {
    try {
      // TODO: Replace with actual API call
      const response = await fetch(`${API_URL}/map-annotations/${annotationId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared_with_team: true }),
      });

      if (response.ok) {
        setSavedDrawings(savedDrawings.map(d =>
          d.id === annotationId ? { ...d, shared_with_team: true } : d
        ));
        alert('Drawing shared with team!');
      }
    } catch (error) {
      console.error('Share error:', error);
      alert('Failed to share drawing');
    }
  };

  // Rest of the component logic (deals clustering, filtering, etc.)
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      if (filters.stages.length > 0 && !filters.stages.includes(deal.pipeline_stage)) {
        return false;
      }
      if (deal.ask_price < filters.priceRange[0] || deal.ask_price > filters.priceRange[1]) {
        return false;
      }
      if (filters.minScore && deal.ai_opportunity_score < filters.minScore) {
        return false;
      }
      if (filters.showSupplyRisk === true && !deal.supply_risk_flag) {
        return false;
      }
      if (filters.strategies.length > 0 && !filters.strategies.includes(deal.best_strategy)) {
        return false;
      }
      if (filters.sources.length > 0 && !filters.sources.includes(deal.source)) {
        return false;
      }
      return true;
    });
  }, [deals, filters]);

  const dealFeatures: DealFeature[] = useMemo(() => {
    return filteredDeals
      .map(deal => {
        const coords = geocodeDeal(deal);
        if (!coords) return null;

        return {
          type: 'Feature' as const,
          properties: {
            ...deal,
            cluster: false as const,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: coords,
          },
        };
      })
      .filter((f): f is DealFeature => f !== null);
  }, [filteredDeals]);

  const supercluster = useMemo(() => {
    const cluster = new Supercluster({
      radius: 75,
      maxZoom: 16,
      minZoom: 0,
    });

    cluster.load(dealFeatures as any);
    return cluster;
  }, [dealFeatures]);

  const { clusters } = useMemo(() => {
    if (!mapRef.current) {
      return { clusters: [] };
    }

    const map = mapRef.current.getMap();
    const bounds = map.getBounds();
    const bbox: BBox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];

    const zoom = Math.floor(viewState.zoom);
    const clusterResults = supercluster.getClusters(bbox, zoom);

    return { clusters: clusterResults };
  }, [supercluster, viewState]);

  const handleClusterClick = useCallback((clusterId: number, longitude: number, latitude: number) => {
    const expansionZoom = supercluster.getClusterExpansionZoom(clusterId);
    mapRef.current?.flyTo({
      center: [longitude, latitude],
      zoom: expansionZoom,
      duration: 500,
    });
  }, [supercluster]);

  const handleDealClick = useCallback((deal: PipelineDeal) => {
    setSelectedDeal(deal);
    if (onDealClick) {
      onDealClick(deal);
    }
  }, [onDealClick]);

  const hasDrawings = drawRef.current && drawRef.current.getAll().features.length > 0;
  const hasSelection = drawRef.current && drawRef.current.getSelected().features.length > 0;

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Map View</h2>
          <p className="text-gray-600 mb-4">
            To enable the interactive map, add a Mapbox token to your environment variables.
          </p>
          <p className="text-sm text-gray-500">
            Set <code className="bg-gray-100 px-2 py-1 rounded">VITE_MAPBOX_TOKEN</code> in your .env file
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pipeline deals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Deal markers and clusters (same as before) */}
        {clusters.map((cluster) => {
          const [lng, lat] = cluster.geometry.coordinates;
          const { cluster: isCluster, point_count } = cluster.properties as any;

          if (isCluster) {
            return (
              <Marker
                key={`cluster-${cluster.properties.cluster_id}`}
                longitude={lng}
                latitude={lat}
                anchor="center"
              >
                <div
                  onClick={() => handleClusterClick(cluster.properties.cluster_id as number, lng, lat)}
                  className="cursor-pointer"
                >
                  <div
                    className="flex items-center justify-center rounded-full shadow-lg border-4 border-white"
                    style={{
                      width: `${30 + Math.min(point_count / 10, 40)}px`,
                      height: `${30 + Math.min(point_count / 10, 40)}px`,
                      backgroundColor: '#3B82F6',
                    }}
                  >
                    <span className="text-white font-bold text-sm">
                      {point_count}
                    </span>
                  </div>
                </div>
              </Marker>
            );
          }

          const deal = cluster.properties as PipelineDeal;
          const stageColor = getStageColor(deal.pipeline_stage);

          return (
            <Marker
              key={`deal-${deal.id}`}
              longitude={lng}
              latitude={lat}
              anchor="bottom"
            >
              <div
                onClick={() => handleDealClick(deal)}
                className="cursor-pointer"
              >
                <div
                  className="w-8 h-8 rounded-full shadow-lg border-2 border-white flex items-center justify-center"
                  style={{ backgroundColor: stageColor }}
                >
                  <div className="w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
            </Marker>
          );
        })}
      </Map>

      {/* Drawing Toolbar */}
      <DrawingToolbar
        activeMode={activeDrawMode}
        onModeChange={setActiveDrawMode}
        onDelete={handleDeleteSelected}
        onSave={handleSaveDrawings}
        onExport={handleExportDrawings}
        onShare={() => setShowSavedDrawings(true)}
        onToggleVisibility={() => setDrawingsVisible(!drawingsVisible)}
        drawingsVisible={drawingsVisible}
        hasSelection={hasSelection || false}
        hasDrawings={hasDrawings || false}
        isSaving={isSaving}
      />

      {/* Saved Drawings Panel */}
      {showSavedDrawings && (
        <SavedDrawingsPanel
          drawings={savedDrawings}
          onToggleVisibility={(id, visible) => {
            // TODO: Implement visibility toggle
          }}
          onDelete={(id) => {
            // TODO: Implement delete
          }}
          onShare={handleShareDrawing}
          onRename={(id, newTitle) => {
            // TODO: Implement rename
          }}
          onLoadDrawing={handleLoadDrawing}
          onClose={() => setShowSavedDrawings(false)}
          currentUserId={userId}
        />
      )}

      {/* Regular Controls */}
      <MapControls
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onDrawRadius={() => setDrawMode(drawMode === 'radius' ? null : 'radius')}
        showHeatmap={showHeatmap}
        showFilters={showFilters}
        drawMode={drawMode}
      />

      {/* Filters Panel */}
      {showFilters && (
        <MapFiltersPanel
          filters={filters}
          onFiltersChange={setFilters}
          deals={deals}
          filteredCount={filteredDeals.length}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Deal Popup */}
      {selectedDeal && (
        <DealMapPopup
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
        />
      )}

      {/* Stats Bar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white px-6 py-3 rounded-lg shadow-lg z-10">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-600">Showing:</span>
            <span className="ml-2 font-bold text-gray-900">{filteredDeals.length}</span>
            <span className="text-gray-600 ml-1">/ {deals.length} deals</span>
          </div>
          {hasDrawings && (
            <>
              <div className="h-4 w-px bg-gray-300" />
              <div>
                <span className="text-gray-600">Drawings:</span>
                <span className="ml-2 font-bold text-purple-600">
                  {drawRef.current?.getAll().features.length || 0}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
