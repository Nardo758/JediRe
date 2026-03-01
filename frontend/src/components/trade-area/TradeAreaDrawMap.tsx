import React, { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface TradeAreaDrawMapProps {
  lat: number;
  lng: number;
  onDrawComplete: (geometry: any) => void;
}

export const TradeAreaDrawMap: React.FC<TradeAreaDrawMapProps> = ({ lat, lng, onDrawComplete }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const handleDraw = useCallback((e: any) => {
    if (!drawRef.current) return;
    const data = drawRef.current.getAll();
    if (data.features.length > 0) {
      const lastFeature = data.features[data.features.length - 1];
      if (lastFeature.geometry.type === 'Polygon') {
        onDrawComplete(lastFeature.geometry);
      }
    }
  }, [onDrawComplete]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: 12,
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: 'draw_polygon',
    });

    map.addControl(draw, 'top-left');
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    new mapboxgl.Marker({ color: '#E91E63' })
      .setLngLat([lng, lat])
      .addTo(map);

    map.on('draw.create', handleDraw);
    map.on('draw.update', handleDraw);

    mapRef.current = map;
    drawRef.current = draw;

    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, [lat, lng, handleDraw]);

  return (
    <div className="relative">
      <div
        ref={mapContainer}
        className="w-full rounded-lg border border-gray-300 overflow-hidden"
        style={{ height: '320px' }}
      />
      <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-md shadow text-xs text-gray-600">
        Click to place points. Double-click to close polygon.
      </div>
    </div>
  );
};
