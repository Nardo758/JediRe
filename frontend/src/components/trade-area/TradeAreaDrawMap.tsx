import React, { useRef, useEffect, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useTradeAreaStore } from '../../stores/tradeAreaStore';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface TradeAreaDrawMapProps {
  lat: number;
  lng: number;
}

export const TradeAreaDrawMap: React.FC<TradeAreaDrawMapProps> = ({ lat, lng }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const handlerRef = useRef<(() => void) | null>(null);

  const handleDrawCreate = useCallback(() => {
    if (!drawRef.current) return;
    const data = drawRef.current.getAll();
    if (data.features.length > 1) {
      const keep = data.features[data.features.length - 1];
      const toDelete = data.features.slice(0, -1).map(f => f.id as string);
      toDelete.forEach(id => drawRef.current!.delete(id));
      if (keep.geometry.type === 'Polygon') {
        useTradeAreaStore.getState().updateDraftGeometry(keep.geometry as any);
      }
    } else if (data.features.length === 1 && data.features[0].geometry.type === 'Polygon') {
      useTradeAreaStore.getState().updateDraftGeometry(data.features[0].geometry as any);
    }
  }, []);

  const handleDrawDelete = useCallback(() => {
    useTradeAreaStore.getState().clearDraft();
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: 13,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: 'draw_polygon',
      });

      map.addControl(draw as any, 'top-left');
      drawRef.current = draw;
      handlerRef.current = handleDrawCreate;

      map.on('draw.create', handleDrawCreate);
      map.on('draw.update', handleDrawCreate);
      map.on('draw.delete', handleDrawDelete);
    });

    new mapboxgl.Marker({ color: '#3B82F6' })
      .setLngLat([lng, lat])
      .addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        if (handlerRef.current) {
          mapRef.current.off('draw.create', handlerRef.current);
          mapRef.current.off('draw.update', handlerRef.current);
        }
        mapRef.current.off('draw.delete', handleDrawDelete);
        mapRef.current.remove();
        mapRef.current = null;
      }
      handlerRef.current = null;
      drawRef.current = null;
    };
  }, [lat, lng, handleDrawCreate, handleDrawDelete]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg border border-gray-300 overflow-hidden"
      style={{ height: '320px' }}
    />
  );
};
