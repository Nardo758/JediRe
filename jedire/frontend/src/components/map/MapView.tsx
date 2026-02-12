import { useRef, useEffect, useState } from 'react';
import Map, { Source, Layer, MapRef } from 'react-map-gl';
import { useAppStore } from '@/store';
import { Property } from '@/types';
import PropertyBubble from './PropertyBubble';
import { useWebSocket } from '@/hooks/useWebSocket';
import CollaboratorCursor from './CollaboratorCursor';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapView() {
  const mapRef = useRef<MapRef>(null);
  const {
    properties,
    mapCenter,
    mapZoom,
    setMapCenter,
    setMapZoom,
    selectedProperty,
    setSelectedProperty,
    collaborators,
  } = useAppStore();

  const wsHook = useWebSocket();
  const updateCursor = (wsHook as any)?.updateCursor || (() => {});
  const selectPropertyWs = (wsHook as any)?.selectProperty || (() => {});

  const [viewState, setViewState] = useState({
    longitude: mapCenter[0],
    latitude: mapCenter[1],
    zoom: mapZoom,
  });

  useEffect(() => {
    setViewState({
      longitude: mapCenter[0],
      latitude: mapCenter[1],
      zoom: mapZoom,
    });
  }, [mapCenter, mapZoom]);

  const handleMove = (evt: any) => {
    setViewState(evt.viewState);
    setMapCenter([evt.viewState.longitude, evt.viewState.latitude]);
    setMapZoom(evt.viewState.zoom);
    updateCursor(evt.viewState.latitude, evt.viewState.longitude);
  };

  const handlePropertyClick = (property: Property) => {
    setSelectedProperty(property);
    selectPropertyWs(property.id);
    mapRef.current?.flyTo({
      center: [property.coordinates.lng, property.coordinates.lat],
      zoom: 16,
      duration: 1000,
    });
  };

  const buildableEnvelopeData = selectedProperty?.zoning?.buildableEnvelope
    ? {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            geometry: selectedProperty.zoning.buildableEnvelope,
            properties: {},
          },
        ],
      }
    : null;

  if (!MAPBOX_TOKEN) {
    return (
      <div className="relative w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
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
        onMove={handleMove}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: '100%', height: '100%' }}
      >
        {Array.isArray(properties) && properties.map((property) => (
          <PropertyBubble
            key={property.id}
            property={property}
            isSelected={selectedProperty?.id === property.id}
            onClick={() => handlePropertyClick(property)}
          />
        ))}

        {buildableEnvelopeData && (
          <Source id="buildable-envelope" type="geojson" data={buildableEnvelopeData}>
            <Layer
              id="buildable-envelope-fill"
              type="fill"
              paint={{
                'fill-color': '#10b981',
                'fill-opacity': 0.3,
              }}
            />
            <Layer
              id="buildable-envelope-outline"
              type="line"
              paint={{
                'line-color': '#10b981',
                'line-width': 2,
              }}
            />
          </Source>
        )}

        {Array.isArray(collaborators) && collaborators.map((collab) =>
          collab.cursor ? (
            <CollaboratorCursor
              key={collab.id}
              user={collab}
              lat={collab.cursor.lat}
              lng={collab.cursor.lng}
            />
          ) : null
        )}
      </Map>

      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <button
          onClick={() => {
            mapRef.current?.flyTo({
              center: mapCenter,
              zoom: mapZoom + 1,
              duration: 300,
            });
          }}
          className="bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
        >
          <span className="text-xl font-bold">+</span>
        </button>
        <button
          onClick={() => {
            mapRef.current?.flyTo({
              center: mapCenter,
              zoom: mapZoom - 1,
              duration: 300,
            });
          }}
          className="bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
        >
          <span className="text-xl font-bold">−</span>
        </button>
      </div>
    </div>
  );
}
