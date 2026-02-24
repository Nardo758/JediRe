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
  const [zoningInfo, setZoningInfo] = useState<{ code: string; description: string; municipality: string; state: string } | null>(null);
  const [zoningLoading, setZoningLoading] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<{ city: string; state: string; county: string; hasZoningData: boolean; municipalityId?: string; address?: string } | null>(null);
  const [zoningDetail, setZoningDetail] = useState<any>(null);
  const [rezoneTargets, setRezoneTargets] = useState<any[]>([]);

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

  useEffect(() => {
    if (boundary.boundaryGeoJSON && !zoningInfo && !zoningLoading) {
      lookupZoning();
    }
  }, [boundary.boundaryGeoJSON]);

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

      const buildablePercentage = areaAcres > 0 ? buildableAreaAcres / areaAcres : 0;

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

      lookupZoning();

    } catch (err: any) {
      console.error('Error calculating metrics:', err);
      setError('Error calculating boundary metrics');
    }
  };

  const lookupZoning = async () => {
    try {
      setZoningLoading(true);

      let cityName = deal?.city || deal?.municipality || '';
      let stateName = deal?.state || '';
      let municipalityId = '';

      if (boundary.centroid) {
        try {
          const geoData = await apiClient.get(`/reverse-geocode`, {
            params: { lat: boundary.centroid[1], lng: boundary.centroid[0] }
          }) as any;

          if (geoData?.found) {
            cityName = geoData.city || cityName;
            stateName = geoData.state || stateName;
            municipalityId = geoData.municipality?.id || '';
            setDetectedLocation({
              city: geoData.city,
              state: geoData.state,
              county: geoData.county,
              hasZoningData: geoData.hasZoningData,
              municipalityId: geoData.municipality?.id,
              address: geoData.address || geoData.fullPlaceName || '',
            });
          }
        } catch (err) {
          console.error('Reverse geocode error:', err);
          if (cityName || deal?.address) {
            setDetectedLocation({
              city: cityName || deal?.city || '',
              state: stateName || deal?.state || '',
              county: '',
              hasZoningData: false,
            });
          }
        }
      }

      if (!cityName && !deal?.address) {
        setDetectedLocation(null);
        return;
      }

      const params: Record<string, string> = {};
      if (cityName) params.city = cityName;
      if (deal?.address) params.address = deal.address;

      const data = await apiClient.get(`/zoning/lookup`, { params }) as any;
      if (data && data.districts && data.districts.length > 0) {
        const district = data.districts[0];
        const code = district.zoning_code || district.district_code || district.code || '--';
        setZoningInfo({
          code,
          description: district.description || district.district_name || '--',
          municipality: data.municipality?.name || cityName,
          state: data.municipality?.state || stateName,
        });

        try {
          const detailParams: Record<string, string> = { code };
          if (municipalityId) detailParams.municipality_id = municipalityId;
          else if (cityName) detailParams.municipality = cityName;
          
          const detailData = await apiClient.get(`/zoning-districts/by-code`, { params: detailParams }) as any;
          if (detailData?.found) {
            setZoningDetail(detailData.district);
            setRezoneTargets(detailData.rezoneTargets || []);
            const d = detailData.district;
            const front = d.min_front_setback_ft ?? d.setback_front_ft;
            const side = d.min_side_setback_ft ?? d.setback_side_ft;
            const rear = d.min_rear_setback_ft ?? d.setback_rear_ft;
            if (front != null || side != null || rear != null) {
              setBoundary(prev => ({
                ...prev,
                setbacks: {
                  front: front ?? prev.setbacks.front,
                  side: side ?? prev.setbacks.side,
                  rear: rear ?? prev.setbacks.rear,
                }
              }));
            }
          }
        } catch (err) {
          console.error('Zoning detail lookup error:', err);
        }
      } else if (data && data.municipality) {
        setZoningInfo({
          code: '--',
          description: 'No zoning district found',
          municipality: data.municipality.name || cityName,
          state: data.municipality.state || stateName,
        });
      }
    } catch (err: any) {
      console.error('Zoning lookup error:', err);
    } finally {
      setZoningLoading(false);
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

          {/* Zoning Code Details */}
          {hasBoundary && (
            <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Zoning Code Details</h3>
              
              {zoningLoading ? (
                <p className="text-sm text-gray-400 italic">Loading zoning information...</p>
              ) : zoningDetail ? (
                <div className="space-y-4">
                  {/* Current Code Header */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-lg font-bold text-blue-900">
                        {zoningDetail.zoning_code || zoningDetail.district_code}
                      </span>
                      <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                        {zoningDetail.category || 'Zoning District'}
                      </span>
                    </div>
                    <p className="text-sm text-blue-800">{zoningDetail.description || zoningDetail.district_name}</p>
                    <p className="text-xs text-blue-600 mt-1">
                      {zoningDetail.municipality_name || zoningDetail.municipality}, {zoningDetail.municipality_state || zoningDetail.state}
                    </p>
                  </div>

                  {/* Development Standards */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Development Standards</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-xs text-gray-500">Max Density</p>
                        <p className="font-semibold text-gray-900">
                          {zoningDetail.max_density_per_acre || zoningDetail.max_units_per_acre || '--'} units/acre
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-xs text-gray-500">Max FAR</p>
                        <p className="font-semibold text-gray-900">{zoningDetail.max_far || '--'}</p>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-xs text-gray-500">Max Height</p>
                        <p className="font-semibold text-gray-900">
                          {zoningDetail.max_building_height_ft || zoningDetail.max_height_feet || '--'} ft
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-xs text-gray-500">Max Stories</p>
                        <p className="font-semibold text-gray-900">{zoningDetail.max_stories || '--'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Setback Requirements from Zoning */}
                  {(zoningDetail.min_front_setback_ft != null || zoningDetail.setback_front_ft != null) && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Required Setbacks</p>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="bg-gray-50 rounded p-2 text-center">
                          <p className="text-xs text-gray-500">Front</p>
                          <p className="font-semibold">{zoningDetail.min_front_setback_ft ?? zoningDetail.setback_front_ft ?? '--'} ft</p>
                        </div>
                        <div className="bg-gray-50 rounded p-2 text-center">
                          <p className="text-xs text-gray-500">Side</p>
                          <p className="font-semibold">{zoningDetail.min_side_setback_ft ?? zoningDetail.setback_side_ft ?? '--'} ft</p>
                        </div>
                        <div className="bg-gray-50 rounded p-2 text-center">
                          <p className="text-xs text-gray-500">Rear</p>
                          <p className="font-semibold">{zoningDetail.min_rear_setback_ft ?? zoningDetail.setback_rear_ft ?? '--'} ft</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Permitted Uses By Right */}
                  {zoningDetail.permitted_uses && zoningDetail.permitted_uses.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Permitted Uses (By Right)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {zoningDetail.permitted_uses.map((use: string, i: number) => (
                          <span key={i} className="inline-block px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">
                            {use.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conditional Uses */}
                  {zoningDetail.conditional_uses && zoningDetail.conditional_uses.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Conditional Uses</p>
                      <div className="flex flex-wrap gap-1.5">
                        {zoningDetail.conditional_uses.map((use: string, i: number) => (
                          <span key={i} className="inline-block px-2 py-0.5 bg-yellow-50 text-yellow-700 text-xs rounded-full border border-yellow-200">
                            {use.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rezone Targets */}
                  {rezoneTargets.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Common Rezone Targets</p>
                      <p className="text-xs text-gray-500 mb-2">Higher-density codes developers typically rezone to from {zoningDetail.zoning_code || zoningDetail.district_code}:</p>
                      <div className="space-y-2">
                        {rezoneTargets.map((target: any, i: number) => (
                          <div key={i} className="flex items-center justify-between bg-purple-50 rounded p-2 border border-purple-100">
                            <div>
                              <span className="text-sm font-semibold text-purple-900">{target.zoning_code}</span>
                              <p className="text-xs text-purple-700">{target.description || target.district_name}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-purple-600">{target.max_density || '--'} units/acre</p>
                              <p className="text-xs text-purple-500">FAR: {target.max_far || '--'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Source Info */}
                  {zoningDetail.source_url && (
                    <p className="text-xs text-gray-400 mt-2">
                      Source: <a href={zoningDetail.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Municipal Code</a>
                      {zoningDetail.last_verified_at && ` (Verified: ${new Date(zoningDetail.last_verified_at).toLocaleDateString()})`}
                    </p>
                  )}
                </div>
              ) : zoningInfo && zoningInfo.code !== '--' ? (
                <div className="text-sm text-gray-600">
                  <p><span className="font-medium">{zoningInfo.code}</span> - {zoningInfo.description}</p>
                  <p className="text-xs text-gray-400 mt-1">Detailed zoning data not available for this district</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  {detectedLocation?.hasZoningData === false 
                    ? `Zoning data not yet available for ${detectedLocation.city}` 
                    : 'Draw boundary to lookup zoning code'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Metrics Panel */}
        <div className="space-y-3">
          {/* Site Confirmation */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            {hasBoundary ? (
              <div className="flex items-center gap-2 text-green-700 mb-3">
                <CheckCircle size={16} />
                <h3 className="text-sm font-semibold">Site Confirmed</h3>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-700 mb-3">
                <AlertCircle size={16} />
                <h3 className="text-sm font-semibold">Draw Boundary to Confirm</h3>
              </div>
            )}

            {/* Property Info */}
            <div className="mb-3 pb-3 border-b border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Property Address</p>
              <p className="text-sm font-medium text-gray-900">
                {deal?.address || deal?.propertyAddress || deal?.property_address || detectedLocation?.address || 'Not specified'}
              </p>
              <p className="text-sm text-gray-600">
                {[detectedLocation?.city || deal?.city || deal?.municipality, detectedLocation?.state || deal?.state].filter(Boolean).join(', ') || '--'}
              </p>
            </div>

            {/* Municipality & Zoning */}
            <div className="mb-3 pb-3 border-b border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Municipality</p>
              {detectedLocation ? (
                <div className="mb-2">
                  <p className="text-sm font-medium text-gray-900">{detectedLocation.city}, {detectedLocation.state}</p>
                  {detectedLocation.county && (
                    <p className="text-xs text-gray-500">{detectedLocation.county}</p>
                  )}
                  {detectedLocation.hasZoningData ? (
                    <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle size={10} className="mr-1" /> Zoning Data Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <AlertCircle size={10} className="mr-1" /> No Zoning Data
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 mb-2">{hasBoundary ? 'Detecting...' : 'Draw boundary to detect'}</p>
              )}

              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 mt-2">Zoning Code</p>
              {zoningLoading ? (
                <p className="text-sm text-gray-400 italic">Looking up zoning...</p>
              ) : zoningInfo ? (
                <div>
                  <p className="text-sm font-medium text-gray-900">{zoningInfo.code}</p>
                  <p className="text-sm text-gray-600">{zoningInfo.description}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">{hasBoundary ? 'No zoning data available' : 'Draw boundary to lookup'}</p>
              )}
            </div>

            {/* Site Metrics */}
            <div className="mb-3 pb-3 border-b border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Site Metrics</p>
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
                {boundary.centroid && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Centroid:</span>
                    <span className="font-medium text-gray-900 text-xs">
                      {boundary.centroid[1]?.toFixed(5)}, {boundary.centroid[0]?.toFixed(5)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Buildable Summary */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Buildable Area</p>
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
                <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                  <AlertCircle size={14} className="inline mr-1" />
                  Low buildable area due to large setbacks
                </div>
              )}
            </div>
          </div>

          {/* Setbacks */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Applied Setbacks</h3>
            {zoningDetail && (zoningDetail.min_front_setback_ft != null || zoningDetail.setback_front_ft != null) && (
              <p className="text-xs text-gray-500 mb-2">From {zoningDetail.zoning_code || zoningDetail.district_code} zoning code</p>
            )}
            <div className="space-y-2">
              {Object.entries(boundary.setbacks).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600 capitalize">{key} Setback</span>
                  <span className="text-sm font-semibold text-gray-900">{value} ft</span>
                </div>
              ))}
            </div>
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
