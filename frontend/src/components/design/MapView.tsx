import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useDesignDashboardStore } from '../../stores/DesignDashboardStore';

// You'll need to set your Mapbox token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface MapViewProps {
  onDrawComplete?: (coordinates: [number, number][]) => void;
}

export const MapView: React.FC<MapViewProps> = ({ onDrawComplete }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const {
    mapCenter,
    mapZoom,
    layerVisibility,
    subjectProperty,
    competingProperties,
    trafficGenerators,
    setMapView,
  } = useDesignDashboardStore();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: mapCenter,
      zoom: mapZoom,
      pitch: 0,
      bearing: 0,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Update store when map moves
    map.current.on('moveend', () => {
      if (!map.current) return;
      const center = map.current.getCenter();
      const zoom = map.current.getZoom();
      setMapView([center.lng, center.lat], zoom);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update subject property layer
  useEffect(() => {
    if (!map.current || !subjectProperty) return;

    const sourceId = 'subject-property';
    const layerId = 'subject-property-fill';

    // Remove existing layers
    if (map.current.getLayer(layerId)) {
      map.current.removeLayer(layerId);
      map.current.removeLayer(`${layerId}-outline`);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }

    if (!layerVisibility.subjectProperty) return;

    // Add source
    map.current.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [subjectProperty.boundary],
        },
      },
    });

    // Add fill layer
    map.current.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': '#3b82f6',
        'fill-opacity': 0.3,
      },
    });

    // Add outline layer
    map.current.addLayer({
      id: `${layerId}-outline`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': '#3b82f6',
        'line-width': 2,
      },
    });
  }, [subjectProperty, layerVisibility.subjectProperty]);

  // Update competition layer
  useEffect(() => {
    if (!map.current) return;

    const sourceId = 'competition';
    const layerId = 'competition-markers';

    // Remove existing
    if (map.current.getLayer(layerId)) {
      map.current.removeLayer(layerId);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }

    if (!layerVisibility.competition || competingProperties.length === 0) return;

    // Create GeoJSON features
    const features = competingProperties
      .filter(p => p.visible)
      .map(property => ({
        type: 'Feature' as const,
        properties: {
          id: property.id,
          name: property.name,
          units: property.units,
          rent: property.monthlyRent,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: property.location,
        },
      }));

    map.current.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features,
      },
    });

    map.current.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 8,
        'circle-color': '#ef4444',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });

    // Add popups
    map.current.on('click', layerId, (e) => {
      if (!e.features?.[0]) return;
      const coordinates = (e.features[0].geometry as any).coordinates.slice();
      const properties = e.features[0].properties;

      new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(`
          <div class="p-2">
            <h3 class="font-medium">${properties.name}</h3>
            <p class="text-sm text-gray-600">Units: ${properties.units}</p>
            <p class="text-sm text-gray-600">Rent: $${properties.rent}/mo</p>
          </div>
        `)
        .addTo(map.current!);
    });

    // Change cursor on hover
    map.current.on('mouseenter', layerId, () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', layerId, () => {
      if (map.current) map.current.getCanvas().style.cursor = '';
    });
  }, [competingProperties, layerVisibility.competition]);

  // Update traffic generators layer
  useEffect(() => {
    if (!map.current) return;

    const sourceId = 'traffic-generators';
    const layerId = 'traffic-markers';

    // Remove existing
    if (map.current.getLayer(layerId)) {
      map.current.removeLayer(layerId);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }

    if (!layerVisibility.trafficHeatMap || trafficGenerators.length === 0) return;

    // Create GeoJSON features
    const features = trafficGenerators.map(gen => ({
      type: 'Feature' as const,
      properties: {
        id: gen.id,
        name: gen.name,
        type: gen.type,
        score: gen.score,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: gen.location,
      },
    }));

    map.current.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features,
      },
    });

    map.current.addLayer({
      id: layerId,
      type: 'symbol',
      source: sourceId,
      layout: {
        'icon-image': [
          'case',
          ['==', ['get', 'type'], 'employer'], 'office-15',
          ['==', ['get', 'type'], 'retail'], 'shop-15',
          ['==', ['get', 'type'], 'transit'], 'rail-15',
          ['==', ['get', 'type'], 'school'], 'school-15',
          ['==', ['get', 'type'], 'entertainment'], 'music-15',
          'marker-15'
        ],
        'icon-size': 1.5,
      },
    });
  }, [trafficGenerators, layerVisibility.trafficHeatMap]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Drawing Mode Indicator */}
      {isDrawing && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
          Click points to draw property boundary. Double-click to finish.
        </div>
      )}
    </div>
  );
};