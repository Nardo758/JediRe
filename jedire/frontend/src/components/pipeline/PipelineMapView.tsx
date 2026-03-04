/**
 * Pipeline Map View - Portfolio Level
 * Displays all pipeline deals on a map with clustering, filtering, and advanced features
 */

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl';
import Supercluster from 'supercluster';
import type { BBox, GeoJsonProperties } from 'geojson';
import { PipelineDeal } from '@/types/grid';
import DealMapPopup from './DealMapPopup';
import MapControls from './MapControls';
import MapFiltersPanel from './MapFiltersPanel';
import { cn } from '@/utils/cn';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface PipelineMapViewProps {
  deals: PipelineDeal[];
  onDealClick?: (deal: PipelineDeal) => void;
  loading?: boolean;
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

// Stage colors
const STAGE_COLORS: Record<string, string> = {
  sourcing: '#10B981', // green
  underwriting: '#3B82F6', // blue
  'due diligence': '#F59E0B', // amber
  'under contract': '#8B5CF6', // purple
  closing: '#EC4899', // pink
  passed: '#6B7280', // gray
  default: '#6366F1', // indigo
};

// Get color for stage
const getStageColor = (stage: string): string => {
  const normalized = stage?.toLowerCase() || '';
  return STAGE_COLORS[normalized] || STAGE_COLORS.default;
};

// Mock geocoding - in production, deals should come with lat/lng or be geocoded server-side
const geocodeDeal = (deal: PipelineDeal): [number, number] | null => {
  // For demo: generate random coordinates around Atlanta
  // In production, use real geocoding service
  const baseLatLng: [number, number] = [-84.388, 33.749]; // Atlanta
  const offset = 0.5; // ~30 mile radius
  
  // Use deal ID to generate consistent coordinates
  const seed = deal.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const lng = baseLatLng[0] + (Math.sin(seed) * offset);
  const lat = baseLatLng[1] + (Math.cos(seed) * offset);
  
  return [lng, lat];
};

export default function PipelineMapView({ 
  deals, 
  onDealClick, 
  loading = false 
}: PipelineMapViewProps) {
  const mapRef = useRef<MapRef>(null);
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

  // Load saved map position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pipeline-map-position');
    if (saved) {
      try {
        const position = JSON.parse(saved);
        setViewState(position);
      } catch (e) {
        console.error('Failed to load saved map position:', e);
      }
    }
  }, []);

  // Save map position to localStorage
  const handleMoveEnd = useCallback((evt: any) => {
    const newViewState = evt.viewState;
    setViewState(newViewState);
    localStorage.setItem('pipeline-map-position', JSON.stringify({
      longitude: newViewState.longitude,
      latitude: newViewState.latitude,
      zoom: newViewState.zoom,
    }));
  }, []);

  // Filter deals
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      // Stage filter
      if (filters.stages.length > 0 && !filters.stages.includes(deal.pipeline_stage)) {
        return false;
      }

      // Price range
      if (deal.ask_price < filters.priceRange[0] || deal.ask_price > filters.priceRange[1]) {
        return false;
      }

      // Min score
      if (filters.minScore && deal.ai_opportunity_score < filters.minScore) {
        return false;
      }

      // Supply risk
      if (filters.showSupplyRisk === true && !deal.supply_risk_flag) {
        return false;
      }

      // Strategy filter
      if (filters.strategies.length > 0 && !filters.strategies.includes(deal.best_strategy)) {
        return false;
      }

      // Source filter
      if (filters.sources.length > 0 && !filters.sources.includes(deal.source)) {
        return false;
      }

      return true;
    });
  }, [deals, filters]);

  // Create GeoJSON features from deals
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

  // Initialize supercluster
  const supercluster = useMemo(() => {
    const cluster = new Supercluster({
      radius: 75,
      maxZoom: 16,
      minZoom: 0,
    });

    cluster.load(dealFeatures as any);
    return cluster;
  }, [dealFeatures]);

  // Get clusters for current viewport
  const { clusters, dealsByCluster } = useMemo(() => {
    if (!mapRef.current) {
      return { clusters: [], dealsByCluster: new Map() };
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
    
    // Map cluster IDs to deals
    const dealsMap = new Map<number, DealFeature[]>();
    clusterResults.forEach(cluster => {
      if (cluster.properties.cluster) {
        const clusterId = cluster.properties.cluster_id;
        const leaves = supercluster.getLeaves(clusterId, Infinity) as DealFeature[];
        dealsMap.set(clusterId, leaves);
      }
    });

    return { clusters: clusterResults, dealsByCluster: dealsMap };
  }, [supercluster, viewState, dealFeatures]);

  // Handle cluster click - zoom in
  const handleClusterClick = useCallback((clusterId: number, longitude: number, latitude: number) => {
    const expansionZoom = supercluster.getClusterExpansionZoom(clusterId);
    mapRef.current?.flyTo({
      center: [longitude, latitude],
      zoom: expansionZoom,
      duration: 500,
    });
  }, [supercluster]);

  // Handle deal marker click
  const handleDealClick = useCallback((deal: PipelineDeal) => {
    setSelectedDeal(deal);
    if (onDealClick) {
      onDealClick(deal);
    }
  }, [onDealClick]);

  // Radius tool
  const handleRadiusSearch = useCallback((center: [number, number], radiusMiles: number) => {
    setFilters(prev => ({
      ...prev,
      radiusCenter: { lat: center[1], lng: center[0] },
      radiusMiles,
    }));
  }, []);

  // Heatmap data
  const heatmapData = useMemo(() => {
    if (!showHeatmap) return null;

    return {
      type: 'FeatureCollection' as const,
      features: dealFeatures,
    };
  }, [showHeatmap, dealFeatures]);

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
        onMoveEnd={handleMoveEnd}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Heatmap Layer */}
        {showHeatmap && heatmapData && (
          <Source id="deals-heat" type="geojson" data={heatmapData}>
            <Layer
              id="deals-heatmap"
              type="heatmap"
              paint={{
                'heatmap-weight': ['interpolate', ['linear'], ['get', 'ai_opportunity_score'], 0, 0, 100, 1],
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 16, 3],
                'heatmap-color': [
                  'interpolate',
                  ['linear'],
                  ['heatmap-density'],
                  0, 'rgba(33,102,172,0)',
                  0.2, 'rgb(103,169,207)',
                  0.4, 'rgb(209,229,240)',
                  0.6, 'rgb(253,219,199)',
                  0.8, 'rgb(239,138,98)',
                  1, 'rgb(178,24,43)',
                ],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 16, 20],
                'heatmap-opacity': 0.6,
              }}
            />
          </Source>
        )}

        {/* Render clusters and markers */}
        {clusters.map((cluster) => {
          const [lng, lat] = cluster.geometry.coordinates;
          const { cluster: isCluster, point_count } = cluster.properties as any;

          if (isCluster) {
            const clusterId = cluster.properties.cluster_id as number;
            const clusterDeals = dealsByCluster.get(clusterId) || [];
            
            // Calculate aggregate metrics for cluster
            const totalValue = clusterDeals.reduce((sum, f) => sum + (f.properties.ask_price || 0), 0);
            const avgScore = clusterDeals.reduce((sum, f) => sum + (f.properties.ai_opportunity_score || 0), 0) / clusterDeals.length;

            return (
              <Marker
                key={`cluster-${clusterId}`}
                longitude={lng}
                latitude={lat}
                anchor="center"
              >
                <div
                  onClick={() => handleClusterClick(clusterId, lng, lat)}
                  className="cursor-pointer group"
                >
                  <div
                    className="flex items-center justify-center rounded-full shadow-lg border-4 border-white transition-all duration-200 hover:scale-110"
                    style={{
                      width: `${30 + Math.min(point_count / 10, 40)}px`,
                      height: `${30 + Math.min(point_count / 10, 40)}px`,
                      backgroundColor: avgScore >= 80 ? '#10B981' : avgScore >= 60 ? '#3B82F6' : '#6B7280',
                    }}
                  >
                    <span className="text-white font-bold text-sm">
                      {point_count}
                    </span>
                  </div>
                  
                  {/* Cluster Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    <div className="font-semibold">{point_count} deals</div>
                    <div>Total: ${(totalValue / 1000000).toFixed(1)}M</div>
                    <div>Avg Score: {avgScore.toFixed(0)}</div>
                  </div>
                </div>
              </Marker>
            );
          }

          // Individual deal marker
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
                className="cursor-pointer group relative"
              >
                {/* Pin Icon */}
                <div
                  className="w-8 h-8 rounded-full shadow-lg border-2 border-white flex items-center justify-center transition-all duration-200 hover:scale-125"
                  style={{ backgroundColor: stageColor }}
                >
                  <div className="w-3 h-3 bg-white rounded-full" />
                </div>
                
                {/* AI Score Badge */}
                {deal.ai_opportunity_score >= 85 && (
                  <div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow border border-white">
                    ⭐
                  </div>
                )}
                
                {/* Supply Risk Badge */}
                {deal.supply_risk_flag && (
                  <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
                    ⚠️
                  </div>
                )}

                {/* Hover Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  <div className="font-semibold">{deal.property_name || deal.address}</div>
                  <div className="text-gray-300 mt-1">
                    ${(deal.ask_price / 1000000).toFixed(1)}M • {deal.unit_count} units
                  </div>
                  {deal.broker_projected_irr && (
                    <div className="text-gray-300">IRR: {deal.broker_projected_irr.toFixed(1)}%</div>
                  )}
                  <div className="text-gray-400 text-[10px] mt-1">
                    {deal.pipeline_stage} • {deal.days_in_stage}d
                  </div>
                </div>
              </div>
            </Marker>
          );
        })}

        {/* Radius Circle (if active) */}
        {filters.radiusCenter && filters.radiusMiles && (
          <Source
            id="radius-circle"
            type="geojson"
            data={{
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [filters.radiusCenter.lng, filters.radiusCenter.lat],
              },
              properties: {},
            }}
          >
            <Layer
              id="radius-circle-fill"
              type="circle"
              paint={{
                'circle-radius': {
                  stops: [
                    [0, 0],
                    [20, filters.radiusMiles * 1609.34], // miles to meters
                  ],
                  base: 2,
                },
                'circle-color': '#3B82F6',
                'circle-opacity': 0.1,
              }}
            />
            <Layer
              id="radius-circle-outline"
              type="circle"
              paint={{
                'circle-radius': {
                  stops: [
                    [0, 0],
                    [20, filters.radiusMiles * 1609.34],
                  ],
                  base: 2,
                },
                'circle-color': '#3B82F6',
                'circle-opacity': 0,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#3B82F6',
                'circle-stroke-opacity': 0.8,
              }}
            />
          </Source>
        )}
      </Map>

      {/* Controls */}
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
          <div className="h-4 w-px bg-gray-300" />
          <div>
            <span className="text-gray-600">Total Value:</span>
            <span className="ml-2 font-bold text-gray-900">
              ${(filteredDeals.reduce((sum, d) => sum + (d.ask_price || 0), 0) / 1000000).toFixed(1)}M
            </span>
          </div>
          <div className="h-4 w-px bg-gray-300" />
          <div>
            <span className="text-gray-600">Avg Score:</span>
            <span className="ml-2 font-bold text-gray-900">
              {(filteredDeals.reduce((sum, d) => sum + (d.ai_opportunity_score || 0), 0) / filteredDeals.length).toFixed(0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
