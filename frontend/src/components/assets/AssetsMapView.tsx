import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Map, { Source, Layer, MapRef, Marker, Popup } from 'react-map-gl';
import { useNavigate } from 'react-router-dom';
import type { OwnedAsset } from '@/types/grid';
import AssetMapPopup from './AssetMapPopup';
import MapDrawingTools from './MapDrawingTools';
import { cn } from '@/utils/cn';
import {
  FunnelIcon,
  MapPinIcon,
  ArrowsPointingOutIcon,
  FireIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface AssetsMapViewProps {
  assets: OwnedAsset[];
  onAssetClick?: (assetId: string) => void;
  userId?: string; // For saving drawings
}

interface MapFilters {
  propertyTypes: string[];
  performance: ('good' | 'watch' | 'alert')[];
  radiusMiles: number | null;
  radiusCenter: [number, number] | null;
}

interface AssetMarker {
  id: string;
  asset: OwnedAsset;
  coordinates: [number, number];
  performance: 'good' | 'watch' | 'alert';
}

interface SavedMapPosition {
  center: [number, number];
  zoom: number;
  timestamp: number;
}

// Mock coordinates for demo - in production, these would come from the asset data
const getAssetCoordinates = (asset: OwnedAsset, index: number): [number, number] => {
  // Generate coordinates in Atlanta area
  const baseLat = 33.75;
  const baseLng = -84.39;
  const spread = 0.15;
  
  // Use deterministic positioning based on asset id
  const hash = asset.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const lat = baseLat + (hash % 100) / 100 * spread - spread / 2;
  const lng = baseLng + ((hash * 7) % 100) / 100 * spread - spread / 2;
  
  return [lng, lat];
};

const getPerformanceCategory = (asset: OwnedAsset): 'good' | 'watch' | 'alert' => {
  const noiVariance = asset.noi_variance || 0;
  const occVariance = asset.occupancy_variance || 0;
  
  // Alert: significant underperformance
  if (noiVariance < -10 || occVariance < -10 || asset.refi_risk_flag) {
    return 'alert';
  }
  
  // Watch: minor underperformance or near targets
  if (noiVariance < -5 || occVariance < -5 || (asset.months_to_maturity && asset.months_to_maturity < 12)) {
    return 'watch';
  }
  
  // Good: meeting or exceeding targets
  return 'good';
};

const getMarkerColor = (performance: 'good' | 'watch' | 'alert'): string => {
  switch (performance) {
    case 'good':
      return '#10B981'; // green-500
    case 'watch':
      return '#F59E0B'; // yellow-500
    case 'alert':
      return '#EF4444'; // red-500
  }
};

const getPerformanceIcon = (performance: 'good' | 'watch' | 'alert') => {
  switch (performance) {
    case 'good':
      return CheckCircleIcon;
    case 'watch':
      return ExclamationTriangleIcon;
    case 'alert':
      return FireIcon;
  }
};

export default function AssetsMapView({ assets, onAssetClick, userId = 'current-user' }: AssetsMapViewProps) {
  const navigate = useNavigate();
  const mapRef = useRef<MapRef>(null);
  
  // Load saved map position
  const savedPosition = useMemo(() => {
    try {
      const saved = localStorage.getItem('jedire-assets-map-position');
      if (saved) {
        const parsed: SavedMapPosition = JSON.parse(saved);
        // Only use if less than 24 hours old
        if (Date.now() - parsed.timestamp < 86400000) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load saved map position:', e);
    }
    return null;
  }, []);

  const [viewState, setViewState] = useState({
    longitude: savedPosition?.center[0] || -84.39,
    latitude: savedPosition?.center[1] || 33.75,
    zoom: savedPosition?.zoom || 11,
  });

  const [selectedAsset, setSelectedAsset] = useState<AssetMarker | null>(null);
  const [hoveredAsset, setHoveredAsset] = useState<AssetMarker | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<Set<string>>(new Set());
  const [drawingRadius, setDrawingRadius] = useState(false);
  const [showDrawingTools, setShowDrawingTools] = useState(false);
  
  const [filters, setFilters] = useState<MapFilters>({
    propertyTypes: [],
    performance: ['good', 'watch', 'alert'],
    radiusMiles: null,
    radiusCenter: null,
  });

  // Save map position when it changes
  const handleMoveEnd = useCallback((evt: any) => {
    const newState = evt.viewState;
    setViewState(newState);
    
    try {
      const position: SavedMapPosition = {
        center: [newState.longitude, newState.latitude],
        zoom: newState.zoom,
        timestamp: Date.now(),
      };
      localStorage.setItem('jedire-assets-map-position', JSON.stringify(position));
    } catch (e) {
      console.error('Failed to save map position:', e);
    }
  }, []);

  // Prepare asset markers
  const assetMarkers: AssetMarker[] = useMemo(() => {
    return assets.map((asset, index) => ({
      id: asset.id,
      asset,
      coordinates: getAssetCoordinates(asset, index),
      performance: getPerformanceCategory(asset),
    }));
  }, [assets]);

  // Filter markers based on filters
  const filteredMarkers = useMemo(() => {
    return assetMarkers.filter((marker) => {
      // Property type filter
      if (filters.propertyTypes.length > 0 && !filters.propertyTypes.includes(marker.asset.asset_type)) {
        return false;
      }
      
      // Performance filter
      if (!filters.performance.includes(marker.performance)) {
        return false;
      }
      
      // Radius filter
      if (filters.radiusMiles && filters.radiusCenter) {
        const [centerLng, centerLat] = filters.radiusCenter;
        const [lng, lat] = marker.coordinates;
        const distance = getDistance(centerLat, centerLng, lat, lng);
        if (distance > filters.radiusMiles) {
          return false;
        }
      }
      
      return true;
    });
  }, [assetMarkers, filters]);

  // Calculate distance in miles
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Get unique property types for filter
  const propertyTypes = useMemo(() => {
    return Array.from(new Set(assets.map((a) => a.asset_type).filter(Boolean)));
  }, [assets]);

  // Handle asset click
  const handleMarkerClick = useCallback((marker: AssetMarker) => {
    if (comparisonMode) {
      setSelectedForComparison((prev) => {
        const next = new Set(prev);
        if (next.has(marker.id)) {
          next.delete(marker.id);
        } else if (next.size < 4) { // Limit to 4 comparisons
          next.add(marker.id);
        }
        return next;
      });
    } else {
      setSelectedAsset(marker);
    }
  }, [comparisonMode]);

  // Handle map click for radius drawing
  const handleMapClick = useCallback((evt: any) => {
    if (drawingRadius) {
      const { lngLat } = evt;
      setFilters((prev) => ({
        ...prev,
        radiusCenter: [lngLat.lng, lngLat.lat],
        radiusMiles: prev.radiusMiles || 5,
      }));
      setDrawingRadius(false);
    } else {
      setSelectedAsset(null);
    }
  }, [drawingRadius]);

  // Create radius circle data
  const radiusCircleData = useMemo(() => {
    if (!filters.radiusCenter || !filters.radiusMiles) return null;
    
    const [lng, lat] = filters.radiusCenter;
    const points = 64;
    const distanceInMeters = filters.radiusMiles * 1609.34;
    const earthRadius = 6371000; // meters
    
    const coordinates = [];
    for (let i = 0; i <= points; i++) {
      const angle = (i * 360) / points;
      const radians = (angle * Math.PI) / 180;
      
      const latOffset = (distanceInMeters / earthRadius) * (180 / Math.PI);
      const lngOffset = (distanceInMeters / (earthRadius * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
      
      const newLat = lat + latOffset * Math.sin(radians);
      const newLng = lng + lngOffset * Math.cos(radians);
      
      coordinates.push([newLng, newLat]);
    }
    
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [coordinates],
          },
          properties: {},
        },
      ],
    };
  }, [filters.radiusCenter, filters.radiusMiles]);

  // Performance summary
  const performanceSummary = useMemo(() => {
    const summary = {
      good: 0,
      watch: 0,
      alert: 0,
    };
    filteredMarkers.forEach((marker) => {
      summary[marker.performance]++;
    });
    return summary;
  }, [filteredMarkers]);

  // Cluster markers when zoomed out
  const shouldCluster = viewState.zoom < 12;

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

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={handleMoveEnd}
        onClick={handleMapClick}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
        cursor={drawingRadius ? 'crosshair' : 'grab'}
      >
        {/* Radius Circle */}
        {radiusCircleData && (
          <Source id="radius-circle" type="geojson" data={radiusCircleData}>
            <Layer
              id="radius-fill"
              type="fill"
              paint={{
                'fill-color': '#3B82F6',
                'fill-opacity': 0.1,
              }}
            />
            <Layer
              id="radius-outline"
              type="line"
              paint={{
                'line-color': '#3B82F6',
                'line-width': 2,
                'line-dasharray': [2, 2],
              }}
            />
          </Source>
        )}

        {/* Radius Center Marker */}
        {filters.radiusCenter && (
          <Marker longitude={filters.radiusCenter[0]} latitude={filters.radiusCenter[1]} anchor="center">
            <div className="w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-lg"></div>
          </Marker>
        )}

        {/* Asset Markers */}
        {filteredMarkers.map((marker) => {
          const color = getMarkerColor(marker.performance);
          const isSelected = selectedAsset?.id === marker.id;
          const isInComparison = selectedForComparison.has(marker.id);
          const Icon = getPerformanceIcon(marker.performance);
          
          return (
            <Marker
              key={marker.id}
              longitude={marker.coordinates[0]}
              latitude={marker.coordinates[1]}
              anchor="bottom"
            >
              <div
                className={cn(
                  'relative cursor-pointer transition-all duration-200',
                  isSelected && 'scale-125 z-50',
                  isInComparison && 'ring-4 ring-blue-400 rounded-full'
                )}
                onMouseEnter={() => !selectedAsset && setHoveredAsset(marker)}
                onMouseLeave={() => setHoveredAsset(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkerClick(marker);
                }}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full shadow-lg flex items-center justify-center',
                    'border-3 border-white transition-transform duration-200',
                    'hover:scale-110'
                  )}
                  style={{ backgroundColor: color }}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                
                {/* Quick info on hover */}
                {hoveredAsset?.id === marker.id && !selectedAsset && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap">
                    <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl">
                      <div className="font-semibold">{marker.asset.property_name}</div>
                      <div className="text-gray-300 mt-1">
                        {marker.asset.actual_occupancy?.toFixed(1)}% occupied
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Marker>
          );
        })}
      </Map>

      {/* Top Controls Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center gap-2 z-10">
        {/* Performance Summary */}
        <div className="bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm font-medium text-gray-900">{performanceSummary.good}</span>
            <span className="text-xs text-gray-500">Good</span>
          </div>
          <div className="w-px h-6 bg-gray-200"></div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-sm font-medium text-gray-900">{performanceSummary.watch}</span>
            <span className="text-xs text-gray-500">Watch</span>
          </div>
          <div className="w-px h-6 bg-gray-200"></div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-sm font-medium text-gray-900">{performanceSummary.alert}</span>
            <span className="text-xs text-gray-500">Alert</span>
          </div>
        </div>

        {/* Filters Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-2',
            'hover:bg-gray-50 transition-colors',
            showFilters && 'bg-blue-50'
          )}
        >
          <FunnelIcon className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">Filters</span>
        </button>

        {/* Comparison Mode Toggle */}
        <button
          onClick={() => {
            setComparisonMode(!comparisonMode);
            if (comparisonMode) {
              setSelectedForComparison(new Set());
            }
          }}
          className={cn(
            'bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-2',
            'hover:bg-gray-50 transition-colors',
            comparisonMode && 'bg-blue-50 ring-2 ring-blue-400'
          )}
        >
          <ArrowsPointingOutIcon className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">
            Compare {selectedForComparison.size > 0 && `(${selectedForComparison.size})`}
          </span>
        </button>

        {/* Drawing Tools Toggle */}
        <button
          onClick={() => setShowDrawingTools(!showDrawingTools)}
          className={cn(
            'bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-2',
            'hover:bg-gray-50 transition-colors',
            showDrawingTools && 'bg-purple-50 ring-2 ring-purple-400'
          )}
        >
          <PencilSquareIcon className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">Draw</span>
        </button>

        {/* Show Total */}
        <div className="ml-auto bg-white rounded-lg shadow-lg px-4 py-2">
          <span className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredMarkers.length}</span> of {assets.length} assets
          </span>
        </div>
      </div>

      {/* Drawing Tools */}
      {showDrawingTools && (
        <MapDrawingTools
          mapRef={mapRef.current}
          userId={userId}
          onSave={(drawings) => {
            console.log('Drawings saved:', drawings);
          }}
          onLoad={() => {
            console.log('Drawings loaded');
          }}
        />
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="absolute top-20 left-4 bg-white rounded-lg shadow-xl p-4 z-20 w-80">
          <h3 className="font-semibold text-gray-900 mb-3">Map Filters</h3>
          
          {/* Property Type Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Property Type</label>
            <div className="space-y-1">
              {propertyTypes.map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.propertyTypes.includes(type)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFilters((prev) => ({
                          ...prev,
                          propertyTypes: [...prev.propertyTypes, type],
                        }));
                      } else {
                        setFilters((prev) => ({
                          ...prev,
                          propertyTypes: prev.propertyTypes.filter((t) => t !== type),
                        }));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Performance Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Performance</label>
            <div className="space-y-1">
              {(['good', 'watch', 'alert'] as const).map((perf) => (
                <label key={perf} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.performance.includes(perf)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFilters((prev) => ({
                          ...prev,
                          performance: [...prev.performance, perf],
                        }));
                      } else {
                        setFilters((prev) => ({
                          ...prev,
                          performance: prev.performance.filter((p) => p !== perf),
                        }));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getMarkerColor(perf) }}
                    ></div>
                    <span className="text-sm text-gray-700 capitalize">{perf}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Radius Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Radius Search</label>
            <div className="flex gap-2">
              <select
                value={filters.radiusMiles || ''}
                onChange={(e) => {
                  const miles = e.target.value ? Number(e.target.value) : null;
                  setFilters((prev) => ({ ...prev, radiusMiles: miles }));
                }}
                className="flex-1 rounded-lg border-gray-300 text-sm"
              >
                <option value="">No radius</option>
                <option value="1">1 mile</option>
                <option value="3">3 miles</option>
                <option value="5">5 miles</option>
                <option value="10">10 miles</option>
              </select>
              <button
                onClick={() => {
                  if (filters.radiusMiles) {
                    setDrawingRadius(true);
                    setShowFilters(false);
                  }
                }}
                disabled={!filters.radiusMiles}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium',
                  'bg-blue-600 text-white hover:bg-blue-700',
                  'disabled:bg-gray-300 disabled:cursor-not-allowed'
                )}
              >
                <MapPinIcon className="w-4 h-4" />
              </button>
            </div>
            {drawingRadius && (
              <p className="text-xs text-blue-600 mt-1">Click on map to set radius center</p>
            )}
          </div>

          {/* Clear Filters */}
          <button
            onClick={() => {
              setFilters({
                propertyTypes: [],
                performance: ['good', 'watch', 'alert'],
                radiusMiles: null,
                radiusCenter: null,
              });
            }}
            className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Asset Popup */}
      {selectedAsset && (
        <AssetMapPopup
          marker={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onViewDetails={() => {
            onAssetClick?.(selectedAsset.id);
            navigate(`/deals/${selectedAsset.id}`);
          }}
        />
      )}

      {/* Comparison Panel */}
      {comparisonMode && selectedForComparison.size > 0 && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-xl p-4 z-20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">
              Comparing {selectedForComparison.size} Assets
            </h3>
            <button
              onClick={() => {
                // Open comparison view - could navigate to a comparison page
                const assetIds = Array.from(selectedForComparison);
                console.log('Compare assets:', assetIds);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Compare Details
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {Array.from(selectedForComparison).map((id) => {
              const marker = assetMarkers.find((m) => m.id === id);
              if (!marker) return null;
              return (
                <div key={id} className="bg-gray-50 rounded-lg p-3">
                  <div className="font-medium text-sm text-gray-900 mb-1">
                    {marker.asset.property_name}
                  </div>
                  <div className="text-xs text-gray-600">
                    {marker.asset.actual_occupancy?.toFixed(1)}% occupied
                  </div>
                  <div className="text-xs text-gray-600">
                    NOI: ${(marker.asset.actual_noi / 1000).toFixed(0)}K
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-10">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Performance</h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-600">Good - Meeting targets</span>
          </div>
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-gray-600">Watch - Minor issues</span>
          </div>
          <div className="flex items-center gap-2">
            <FireIcon className="w-4 h-4 text-red-500" />
            <span className="text-xs text-gray-600">Alert - Needs attention</span>
          </div>
        </div>
      </div>
    </div>
  );
}
