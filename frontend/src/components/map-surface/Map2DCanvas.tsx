import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import Map, { Source, Layer, MapRef, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { ParcelRecord } from '../../types/map-surface.types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const DEFAULT_CENTER: [number, number] = [-84.388, 33.749]; // Atlanta

interface Map2DCanvasProps {
  dealId?: string;
  dealType: string;
  parcelBoundary?: GeoJSON.Polygon;
  onParcelSelect: (parcel: ParcelRecord | null) => void;
  children?: React.ReactNode;
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * MAP 2D CANVAS — Real Mapbox GL Integration
 * ═══════════════════════════════════════════════════════════════════
 *
 * Declarative react-map-gl component following the MapView.tsx pattern.
 * Renders parcel boundaries as GeoJSON overlays with fill + outline.
 * Centers on the deal boundary when available, falls back to Atlanta.
 */
export const Map2DCanvas: React.FC<Map2DCanvasProps> = ({
  dealId,
  dealType,
  parcelBoundary,
  onParcelSelect,
  children,
}) => {
  const mapRef = useRef<MapRef>(null);

  // Compute initial view state from parcel boundary centroid, or Atlanta default
  const initialViewState = useMemo(() => {
    if (parcelBoundary && parcelBoundary.coordinates?.[0]?.length > 0) {
      const coords = parcelBoundary.coordinates[0];
      const lngSum = coords.reduce((s, c) => s + c[0], 0);
      const latSum = coords.reduce((s, c) => s + c[1], 0);
      const centerLng = lngSum / coords.length;
      const centerLat = latSum / coords.length;
      return {
        longitude: centerLng,
        latitude: centerLat,
        zoom: 16,
      };
    }
    return {
      longitude: DEFAULT_CENTER[0],
      latitude: DEFAULT_CENTER[1],
      zoom: 13,
    };
  }, [parcelBoundary]);

  const [viewState, setViewState] = useState(initialViewState);

  // Sync viewState when parcelBoundary changes (e.g., new deal loaded)
  useEffect(() => {
    setViewState(initialViewState);
  }, [initialViewState]);

  // Build GeoJSON FeatureCollection from parcel boundary
  const parcelGeoJSON = useMemo(() => {
    if (!parcelBoundary) return null;
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: parcelBoundary,
          properties: { dealId, dealType },
        },
      ],
    };
  }, [parcelBoundary, dealId, dealType]);

  // Stub: handle map click for parcel selection
  const handleMapClick = useCallback(
    (event: any) => {
      const { lngLat } = event;
      console.log('[Map2DCanvas] Clicked at:', lngLat);
      // TODO: reverse geocode or query assessor API to find parcel at lngLat
      // For now, deselect if clicking on empty map
      onParcelSelect(null);
    },
    [onParcelSelect]
  );

  // Fit bounds to parcel when it loads
  useEffect(() => {
    if (!mapRef.current || !parcelBoundary) return;
    const coords = parcelBoundary.coordinates[0];
    if (!coords || coords.length < 3) return;

    const bounds = coords.reduce(
      (b, coord) => {
        return {
          minLng: Math.min(b.minLng, coord[0]),
          maxLng: Math.max(b.maxLng, coord[0]),
          minLat: Math.min(b.minLat, coord[1]),
          maxLat: Math.max(b.maxLat, coord[1]),
        };
      },
      { minLng: coords[0][0], maxLng: coords[0][0], minLat: coords[0][1], maxLat: coords[0][1] }
    );

    mapRef.current.fitBounds(
      [
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ],
      { padding: 80, duration: 800 }
    );
  }, [parcelBoundary]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Mapbox Token Required</h2>
          <p className="text-gray-600 mb-4">
            To enable the interactive property surface map, add a Mapbox token to your environment variables.
          </p>
          <code className="bg-gray-100 px-3 py-1.5 rounded text-sm">
            VITE_MAPBOX_TOKEN=pk.ey...
          </code>
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
        onClick={handleMapClick}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" />

        {/* Parcel Boundary Overlay */}
        {parcelGeoJSON && (
          <Source id="parcel-boundary" type="geojson" data={parcelGeoJSON}>
            <Layer
              id="parcel-fill"
              type="fill"
              paint={{
                'fill-color': '#3b82f6',
                'fill-opacity': 0.25,
              }}
            />
            <Layer
              id="parcel-outline"
              type="line"
              paint={{
                'line-color': '#2563eb',
                'line-width': 3,
                'line-dasharray': [2, 1],
              }}
            />
          </Source>
        )}

        {/* Injected child layers (deal pins, traffic, etc.) */}
        {children}
      </Map>

      {/* Bottom-left info badge */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-gray-200 text-xs text-gray-600">
        <span className="font-semibold text-gray-800">Mode:</span> 2D Satellite
        {dealId && (
          <>
            <span className="mx-2 text-gray-300">|</span>
            <span className="font-semibold text-gray-800">Deal:</span> {dealId.slice(0, 8)}...
          </>
        )}
        {parcelBoundary && (
          <>
            <span className="mx-2 text-gray-300">|</span>
            <span className="text-green-600 font-medium">Parcel loaded ✓</span>
          </>
        )}
      </div>
    </div>
  );
};

export default Map2DCanvas;
