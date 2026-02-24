/**
 * Property Boundary Section - Development Deals
 * Interactive map to define site boundary - becomes source of truth
 */

import React, { useEffect, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';
import { apiClient } from '../../../api/client';
import { 
  Save, 
  Upload, 
  Download, 
  Trash2, 
  MapPin, 
  Ruler, 
  Edit3,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

interface PropertyBoundarySectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
  onBack?: () => void;
}

interface BoundaryData {
  dealId: string;
  boundaryGeoJSON: GeoJSON.Feature<GeoJSON.Polygon> | null;
  parcelArea: number | null;
  parcelAreaSF: number | null;
  perimeter: number | null;
  centroid: [number, number] | null;
  setbacks: {
    front: number;
    side: number;
    rear: number;
  };
  buildableArea: number | null;
  buildableAreaSF: number | null;
  buildablePercentage: number | null;
  surveyDocumentUrl?: string;
}

export const PropertyBoundarySection: React.FC<PropertyBoundarySectionProps> = ({ 
  deal, 
  dealId,
  onUpdate 
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const [boundary, setBoundary] = useState<BoundaryData>({
    dealId: dealId || deal?.id || '',
    boundaryGeoJSON: null,
    parcelArea: null,
    parcelAreaSF: null,
    perimeter: null,
    centroid: null,
    setbacks: {
      front: 25,
      side: 15,
      rear: 20,
    },
    buildableArea: null,
    buildableAreaSF: null,
    buildablePercentage: null,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDrawMode, setActiveDrawMode] = useState<string | null>(null);

  // Layer visibility toggles
  const [layers, setLayers] = useState({
    boundary: true,
    setbacks: true,
    buildableArea: true,
    neighbors: true,
    zoning: false,
    floodplain: false,
    utilities: false,
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // TODO: Get Mapbox token from environment
    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
    mapboxgl.accessToken = mapboxToken;

    // Get initial center from deal address or default to Atlanta
    const center: [number, number] = deal?.coordinates 
      ? [deal.coordinates.lng, deal.coordinates.lat]
      : [-84.3880, 33.7490]; // Atlanta default

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: center,
      zoom: 18,
      pitch: 0,
      bearing: 0,
    });

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.ScaleControl(), 'bottom-right');

    // Initialize drawing tools
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      styles: [
        // Boundary polygon style
        {
          id: 'gl-draw-polygon-fill',
          type: 'fill',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: {
            'fill-color': '#3b82f6',
            'fill-opacity': 0.2,
          },
        },
        {
          id: 'gl-draw-polygon-stroke',
          type: 'line',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: {
            'line-color': '#1e40af',
            'line-width': 3,
          },
        },
        // Active vertex style
        {
          id: 'gl-draw-polygon-and-line-vertex-active',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
          paint: {
            'circle-radius': 6,
            'circle-color': '#ef4444',
          },
        },
      ],
    });

    map.addControl(draw);

    // Listen for drawing events
    map.on('draw.create', handleDrawCreate);
    map.on('draw.update', handleDrawUpdate);
    map.on('draw.delete', handleDrawDelete);

    mapRef.current = map;
    drawRef.current = draw;

    // Load existing boundary if available
    loadExistingBoundary();

    return () => {
      map.remove();
    };
  }, []);

  // Load existing boundary from API
  const loadExistingBoundary = async () => {
    if (!dealId) return;

    try {
      setLoading(true);
      const raw = await apiClient.get(`/deals/${dealId}/boundary`) as any;
      if (raw) {
        const mapped: BoundaryData = {
          boundaryGeoJSON: raw.boundary_geojson || raw.boundaryGeoJSON || null,
          parcelArea: raw.parcel_area ?? raw.parcelArea ?? null,
          parcelAreaSF: raw.parcel_area_sf ?? raw.parcelAreaSF ?? null,
          perimeter: raw.perimeter ?? null,
          centroid: raw.centroid ?? null,
          setbacks: raw.setbacks || { front: 25, side: 10, rear: 20 },
          buildableArea: raw.buildable_area ?? raw.buildableArea ?? null,
          buildableAreaSF: raw.buildable_area_sf ?? raw.buildableAreaSF ?? null,
          buildablePercentage: raw.buildable_percentage ?? raw.buildablePercentage ?? null,
        };
        setBoundary(mapped);
        
        if (mapped.boundaryGeoJSON && drawRef.current) {
          drawRef.current.add(mapped.boundaryGeoJSON);
        }
      }
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.error('Error loading boundary:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle draw create
  const handleDrawCreate = (e: any) => {
    const feature = e.features[0];
    calculateBoundaryMetrics(feature);
  };

  // Handle draw update
  const handleDrawUpdate = (e: any) => {
    const feature = e.features[0];
    calculateBoundaryMetrics(feature);
  };

  // Handle draw delete
  const handleDrawDelete = () => {
    setBoundary(prev => ({
      ...prev,
      boundaryGeoJSON: null,
      parcelArea: null,
      parcelAreaSF: null,
      perimeter: null,
      centroid: null,
      buildableArea: null,
      buildableAreaSF: null,
      buildablePercentage: null,
    }));
  };

  // Calculate boundary metrics using turf.js
  const calculateBoundaryMetrics = (feature: GeoJSON.Feature<GeoJSON.Polygon>) => {
    try {
      // Calculate area
      const areaSquareMeters = turf.area(feature);
      const areaSquareFeet = areaSquareMeters * 10.7639;
      const areaAcres = areaSquareFeet / 43560;

      // Calculate perimeter
      const perimeterKm = turf.length(feature, { units: 'kilometers' });
      const perimeterFeet = perimeterKm * 3280.84;

      // Calculate centroid
      const centroidFeature = turf.centroid(feature);
      const centroid: [number, number] = centroidFeature.geometry.coordinates as [number, number];

      // Calculate buildable area (with setbacks)
      const setbackFeet = Math.max(boundary.setbacks.front, boundary.setbacks.side, boundary.setbacks.rear);
      const bufferedFeature = turf.buffer(feature, -setbackFeet, { units: 'feet' });
      
      let buildableAreaAcres = 0;
      let buildableAreaSF = 0;
      
      if (bufferedFeature) {
        const buildableAreaSqMeters = turf.area(bufferedFeature);
        buildableAreaSF = buildableAreaSqMeters * 10.7639;
        buildableAreaAcres = buildableAreaSF / 43560;
      }

      const buildablePercentage = buildableAreaAcres / areaAcres;

      setBoundary(prev => ({
        ...prev,
        boundaryGeoJSON: feature,
        parcelArea: areaAcres,
        parcelAreaSF: areaSquareFeet,
        perimeter: perimeterFeet,
        centroid: centroid,
        buildableArea: buildableAreaAcres,
        buildableAreaSF: buildableAreaSF,
        buildablePercentage: buildablePercentage,
      }));

    } catch (err: any) {
      console.error('Error calculating metrics:', err);
      setError('Error calculating boundary metrics');
    }
  };

  // Save boundary to API
  const handleSave = async () => {
    if (!boundary.boundaryGeoJSON) {
      setError('Please draw a boundary first');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await apiClient.post(`/deals/${dealId}/boundary`, boundary);

      onUpdate?.();
      
      alert('Boundary saved successfully!');

    } catch (err: any) {
      console.error('Error saving boundary:', err);
      setError(err.message || 'Failed to save boundary');
    } finally {
      setSaving(false);
    }
  };

  // Start drawing mode
  const startDrawing = () => {
    if (!drawRef.current) return;
    
    // Clear existing drawings
    drawRef.current.deleteAll();
    
    // Start polygon draw mode
    drawRef.current.changeMode('draw_polygon');
    setActiveDrawMode('draw_polygon');
  };

  // Clear boundary
  const handleClear = () => {
    if (!drawRef.current) return;
    if (confirm('Are you sure you want to clear the boundary?')) {
      drawRef.current.deleteAll();
      handleDrawDelete();
    }
  };

  // Export GeoJSON
  const handleExportGeoJSON = () => {
    if (!boundary.boundaryGeoJSON) return;

    const dataStr = JSON.stringify(boundary.boundaryGeoJSON, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `site-boundary-${dealId}.geojson`;
    link.click();
  };

  // Toggle layer visibility
  const toggleLayer = (layer: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
    // TODO: Implement actual layer toggling on map
  };

  const formatNumber = (num: number | null | undefined, decimals: number = 1): string => {
    if (num === null || num === undefined) return '--';
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  const hasBoundary = boundary.boundaryGeoJSON !== null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="text-blue-600" size={24} />
            Property Boundary & Site Plan
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Define site boundary - becomes source of truth for zoning and 3D design
          </p>
        </div>
        
        {hasBoundary && (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="text-green-600" size={16} />
            <span className="text-green-700 font-medium">Boundary Defined</span>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
          <div>
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Status banner */}
      {!hasBoundary && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-600 flex-shrink-0" size={20} />
            <div>
              <p className="text-yellow-800 font-medium">Boundary Not Defined</p>
              <p className="text-yellow-700 text-sm">
                Draw the property boundary to unlock site intelligence, zoning analysis, and 3D design.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map Container */}
        <div className="lg:col-span-2 space-y-3">
          {/* Drawing Tools */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={startDrawing}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Edit3 size={16} />
                Draw Boundary
              </button>

              <button
                onClick={handleSave}
                disabled={!hasBoundary || saving}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Boundary'}
              </button>

              <button
                onClick={handleClear}
                disabled={!hasBoundary}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                <Trash2 size={16} />
                Clear
              </button>

              <button
                onClick={handleExportGeoJSON}
                disabled={!hasBoundary}
                className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                <Download size={16} />
                Export GeoJSON
              </button>
            </div>
          </div>

          {/* Map */}
          <div 
            ref={mapContainerRef}
            className="w-full h-[500px] rounded-lg border border-gray-300 shadow-sm"
          />

          {/* Layer Toggles */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Map Layers</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(layers).map(([key, visible]) => (
                <button
                  key={key}
                  onClick={() => toggleLayer(key as keyof typeof layers)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    visible
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
                >
                  {visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Metrics Panel */}
        <div className="space-y-3">
          {/* Boundary Status */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Boundary Status</h3>
            
            {hasBoundary ? (
              <div className="flex items-center gap-2 text-green-700 mb-3">
                <CheckCircle size={20} />
                <span className="font-medium">Defined</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-700 mb-3">
                <AlertCircle size={20} />
                <span className="font-medium">Not Defined</span>
              </div>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Parcel Area:</span>
                <span className="font-medium text-gray-900">
                  {formatNumber(boundary.parcelArea)} acres
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Square Feet:</span>
                <span className="font-medium text-gray-900">
                  {formatNumber(boundary.parcelAreaSF, 0)} SF
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Perimeter:</span>
                <span className="font-medium text-gray-900">
                  {formatNumber(boundary.perimeter, 0)} feet
                </span>
              </div>
            </div>
          </div>

          {/* Setbacks */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Setbacks</h3>
            
            <div className="space-y-3">
              {Object.entries(boundary.setbacks).map(([key, value]) => (
                <div key={key}>
                  <label className="text-xs text-gray-600 uppercase tracking-wide">
                    {key} Setback
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => setBoundary(prev => ({
                        ...prev,
                        setbacks: { ...prev.setbacks, [key]: Number(e.target.value) }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="text-sm text-gray-600">feet</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Buildable Area */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Buildable Area</h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">After Setbacks:</span>
                <span className="font-medium text-gray-900">
                  {formatNumber(boundary.buildableArea)} acres
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Square Feet:</span>
                <span className="font-medium text-gray-900">
                  {formatNumber(boundary.buildableAreaSF, 0)} SF
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Utilization:</span>
                <span className="font-medium text-gray-900">
                  {formatNumber((boundary.buildablePercentage || 0) * 100, 0)}%
                </span>
              </div>
            </div>

            {hasBoundary && boundary.buildablePercentage && boundary.buildablePercentage < 0.7 && (
              <div className="mt-3 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                <AlertCircle size={14} className="inline mr-1" />
                Low buildable area due to large setbacks
              </div>
            )}
          </div>

          {/* Next Steps */}
          {hasBoundary && (
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Next Steps</h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>✓ Boundary defined</li>
                <li>→ View Site Intelligence</li>
                <li>→ Analyze Zoning Capacity</li>
                <li>→ Export to 3D Design</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
