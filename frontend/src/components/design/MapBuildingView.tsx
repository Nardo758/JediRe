/**
 * MapBuildingView — Renders the building massing on a satellite map at the
 * property's real location with optional county parcel overlay.
 *
 * Features:
 *   - Satellite/aerial imagery via Mapbox
 *   - Subject parcel boundary (green outline)
 *   - Building sections as 3D fill-extrusions at real lat/lng
 *   - Optional county GIS parcel layer (WMS raster overlay) showing all
 *     surrounding parcel boundaries from the county assessor's data
 *   - Parcel overlay configurable via props or county presets
 *
 * County GIS presets (sources for all-parcel overlay):
 *   - Fulton County, GA: ArcGIS WMS endpoint
 *   - Use the `parcelWmsUrl` prop to override with your county's endpoint
 */

import React, { useState, useMemo } from 'react';
import Map, { Source, Layer, NavigationControl, ScaleControl, Popup } from 'react-map-gl';
import type { LayerProps } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MapBuildingSection {
  id: string;
  name: string;
  /** Polygon vertices in [lng, lat] pairs (GeoJSON ring) */
  polygon: [number, number][];
  /** Height of section in feet */
  height: number;
  /** Base elevation */
  baseHeight: number;
  /** Unit count for this section */
  units: number;
  /** Color */
  color: string;
  /** Has ground floor retail */
  hasRetail?: boolean;
}

interface MapBuildingViewProps {
  /** Center latitude of the parcel */
  latitude: number;
  /** Center longitude of the parcel */
  longitude: number;
  /** Parcel boundary as [lng, lat][] polygon ring */
  parcelPolygon?: [number, number][];
  /** Building sections to render as 3D extrusions */
  buildingSections?: MapBuildingSection[];
  /** Optional Mapbox style (defaults to satellite-streets) */
  mapStyle?: string;
  /** Height of the map container */
  height?: string | number;
  /** Zoom level */
  zoom?: number;
  /** County GIS WMS URL for parcel overlay. If provided, shows "Parcels" toggle. */
  parcelWmsUrl?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const DEFAULT_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';
const ALT_STYLE = 'mapbox://styles/mapbox/light-v11';
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v11';

/**
 * Default county GIS WMS endpoints. These serve parcel boundary overlays
 * as raster tiles from county assessor data.
 *
 * Users can override via `parcelWmsUrl` prop for their specific county.
 */
const COUNTY_PARCEL_WMS: Record<string, string> = {
  'fulton-ga': 'https://gis.fultoncountyga.gov/arcgis/services/Parcels/MapServer/WmsServer?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=0&STYLES=&WIDTH=512&HEIGHT=512&CRS=EPSG:3857&BBOX={bbox-epsg-3857}',
  'dekalb-ga': 'https://gis.dekalbcountyga.gov/arcgis/services/Parcel/MapServer/WmsServer?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=0&STYLES=&WIDTH=512&HEIGHT=512&CRS=EPSG:3857&BBOX={bbox-epsg-3857}',
  'cobb-ga': 'https://maps.cobbcounty.org/arcgis/services/Parcel/Parcels/MapServer/WmsServer?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=0&STYLES=&WIDTH=512&HEIGHT=512&CRS=EPSG:3857&BBOX={bbox-epsg-3857}',
  'gwinnett-ga': 'https://gis.gwinnettcounty.com/arcgis/services/Parcel/Parcels/MapServer/WmsServer?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=0&STYLES=&WIDTH=512&HEIGHT=512&CRS=EPSG:3857&BBOX={bbox-epsg-3857}',
};

// ─── Component ──────────────────────────────────────────────────────────────

const MapBuildingView: React.FC<MapBuildingViewProps> = ({
  latitude,
  longitude,
  parcelPolygon,
  buildingSections = [],
  mapStyle,
  height = '100%',
  zoom = 18,
  parcelWmsUrl,
}) => {
  const [mapError, setMapError] = useState(false);
  const [currentStyle, setCurrentStyle] = useState(mapStyle || DEFAULT_STYLE);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [showParcels, setShowParcels] = useState(false);

  // Resolve county WMS URL (prop override or use default for Atlanta area)
  const resolvedWmsUrl = parcelWmsUrl || COUNTY_PARCEL_WMS['fulton-ga'];

  // ── GeoJSON sources ────────────────────────────────────────────────────

  const parcelGeoJSON = useMemo(() => {
    if (!parcelPolygon?.length) return null;
    return {
      type: 'Feature' as const,
      properties: { id: 'parcel-boundary' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [parcelPolygon],
      },
    };
  }, [parcelPolygon]);

  const buildingGeoJSON = useMemo(() => {
    if (!buildingSections.length) return null;
    return {
      type: 'FeatureCollection' as const,
      features: buildingSections.map((sec) => ({
        type: 'Feature' as const,
        properties: {
          id: sec.id,
          name: sec.name,
          units: sec.units,
          height: sec.height,
          color: sec.color,
          hasRetail: sec.hasRetail,
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [sec.polygon],
        },
      })),
    };
  }, [buildingSections]);

  // ── Layer styles ───────────────────────────────────────────────────────

  const parcelLayer: LayerProps = useMemo(() => ({
    id: 'parcel-boundary',
    type: 'line',
    source: 'parcel',
    paint: {
      'line-color': '#10b981',
      'line-width': 3,
      'line-opacity': 0.9,
    },
  }), []);

  const parcelFillLayer: LayerProps = useMemo(() => ({
    id: 'parcel-fill',
    type: 'fill',
    source: 'parcel',
    paint: {
      'fill-color': '#10b981',
      'fill-opacity': 0.08,
    },
  }), []);

  const buildingBaseLayer: LayerProps = useMemo(() => ({
    id: 'building-base',
    type: 'fill-extrusion',
    source: 'buildings',
    'source-layer': undefined,
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': [
        'case',
        ['==', ['get', 'id'], hoveredSection || ''],
        0.8,
        0.65,
      ],
    },
  }), [hoveredSection]);

  const retailHighlightLayer: LayerProps | null = buildingSections.some(s => s.hasRetail)
    ? {
        id: 'retail-highlight',
        type: 'fill-extrusion',
        source: 'buildings',
        paint: {
          'fill-extrusion-color': '#f59e0b',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['-', ['get', 'height'], 12],
          'fill-extrusion-opacity': 0.3,
        },
      }
    : null;

  // ── Error fallback ─────────────────────────────────────────────────────

  if (!MAPBOX_TOKEN) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a2e',
          color: '#94a3b8',
          borderRadius: 8,
          padding: 24,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗺️</div>
        <p style={{ fontFamily: 'monospace', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
          Map view requires a Mapbox token
        </p>
        <p style={{ fontSize: 11, color: '#64748b', marginTop: 8, textAlign: 'center' }}>
          Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> or <code>REACT_APP_MAPBOX_TOKEN</code>
          <br />in your environment variables.
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height, overflow: 'hidden', borderRadius: 8 }}>
      {/* Top-left controls */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 10,
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
        }}
      >
        {/* Style toggle */}
        <button
          onClick={() => setCurrentStyle(DEFAULT_STYLE)}
          style={{
            padding: '3px 8px',
            fontSize: 10,
            fontFamily: 'monospace',
            background: currentStyle === DEFAULT_STYLE ? '#1d4ed8' : '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: 4,
            cursor: 'pointer',
            opacity: currentStyle === DEFAULT_STYLE ? 1 : 0.6,
          }}
        >
          Satellite
        </button>
        <button
          onClick={() => setCurrentStyle(ALT_STYLE)}
          style={{
            padding: '3px 8px',
            fontSize: 10,
            fontFamily: 'monospace',
            background: currentStyle === ALT_STYLE ? '#1d4ed8' : '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: 4,
            cursor: 'pointer',
            opacity: currentStyle === ALT_STYLE ? 1 : 0.6,
          }}
        >
          Streets
        </button>

        {/* County Parcel Overlay Toggle */}
        <button
          onClick={() => setShowParcels(!showParcels)}
          style={{
            padding: '3px 8px',
            fontSize: 10,
            fontFamily: 'monospace',
            background: showParcels ? '#10b981' : '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: 4,
            cursor: 'pointer',
            opacity: 0.8,
          }}
          title={resolvedWmsUrl ? 'Toggle county parcel overlay' : 'No county WMS URL configured'}
        >
          {showParcels ? '📋 Hide parcels' : '📋 Parcels'}
        </button>
      </div>

      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          latitude,
          longitude,
          zoom,
          pitch: 60,
          bearing: 0,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={currentStyle}
        onError={() => setMapError(true)}
        interactiveLayerIds={['building-base']}
        onMouseEnter={(e) => {
          if (e.features?.length) {
            setHoveredSection(e.features[0].properties?.id || null);
          }
        }}
        onMouseLeave={() => setHoveredSection(null)}
      >
        {/* Navigation controls */}
        <NavigationControl position="bottom-right" />
        <ScaleControl position="bottom-left" unit="imperial" />

        {/* County parcel overlay (WMS raster tiles) */}
        {showParcels && resolvedWmsUrl && (
          <Source
            id="county-parcels"
            type="raster"
            tiles={[resolvedWmsUrl]}
            tileSize={512}
          >
            <Layer
              id="county-parcels-layer"
              type="raster"
              paint={{
                'raster-opacity': 0.35,
                'raster-resampling': 'linear',
              }}
            />
          </Source>
        )}

        {/* Subject parcel boundary */}
        {parcelGeoJSON && (
          <Source id="parcel" type="geojson" data={parcelGeoJSON}>
            <Layer {...parcelLayer} />
            <Layer {...parcelFillLayer} />
          </Source>
        )}

        {/* Building sections as 3D extrusions */}
        {buildingGeoJSON && (
          <Source id="buildings" type="geojson" data={buildingGeoJSON}>
            <Layer {...buildingBaseLayer} />
            {retailHighlightLayer && <Layer {...retailHighlightLayer} />}
          </Source>
        )}

        {/* Hover popup */}
        {hoveredSection && (
          <Popup
            latitude={latitude}
            longitude={longitude}
            closeButton={false}
            closeOnClick={false}
            offset={[0, -10]}
          >
            <div style={{ fontSize: 11, fontFamily: 'monospace', padding: 2 }}>
              {buildingSections.find(s => s.id === hoveredSection)?.name || hoveredSection}
            </div>
          </Popup>
        )}
      </Map>

      {mapError && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.85)',
            color: '#94a3b8',
            zIndex: 20,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, marginBottom: 4 }}>Failed to load map</p>
            <p style={{ fontSize: 11, color: '#64748b' }}>
              Check your Mapbox token or network connection
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapBuildingView;
