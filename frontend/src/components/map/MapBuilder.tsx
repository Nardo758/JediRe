import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import * as turf from '@turf/turf';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface MapBuilderProps {
  onBoundaryDrawn: (boundary: any, area: number) => void;
  initialBoundary?: any;
  mode?: 'create' | 'edit';
}

export const MapBuilder: React.FC<MapBuilderProps> = ({
  onBoundaryDrawn,
  initialBoundary,
  mode = 'create'
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  
  const [area, setArea] = useState<number>(0);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-84.388, 33.749], // Atlanta default
      zoom: 12
    });

    // Initialize drawing tools
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      },
      defaultMode: 'draw_polygon'
    });

    map.current.addControl(draw.current);

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Load initial boundary if provided
    if (initialBoundary && draw.current) {
      draw.current.add({
        type: 'Feature',
        geometry: initialBoundary
      });
    }

    // Handle drawing events
    map.current.on('draw.create', updateArea);
    map.current.on('draw.update', updateArea);
    map.current.on('draw.delete', () => {
      setArea(0);
      setIsDrawing(false);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const updateArea = () => {
    if (!draw.current) return;

    const data = draw.current.getAll();
    if (data.features.length > 0) {
      const polygon = data.features[0];
      
      // Calculate area in acres
      const areaInSquareMeters = turf.area(polygon);
      const areaInAcres = areaInSquareMeters / 4046.86;
      
      setArea(areaInAcres);
      setIsDrawing(true);
      
      // Notify parent
      onBoundaryDrawn(polygon.geometry, areaInAcres);
    }
  };

  const clearDrawing = () => {
    if (draw.current) {
      draw.current.deleteAll();
      setArea(0);
      setIsDrawing(false);
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Drawing status overlay */}
      {isDrawing && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 z-10">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm text-gray-600">Boundary Area</p>
              <p className="text-2xl font-bold text-gray-900">
                {area.toFixed(1)} <span className="text-lg font-normal">acres</span>
              </p>
            </div>
            <button
              onClick={clearDrawing}
              className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}
      
      {/* Instructions */}
      {!isDrawing && mode === 'create' && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 z-10 max-w-sm">
          <h3 className="font-semibold text-gray-900 mb-2">Draw Your Deal Boundary</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Click points to create a polygon</li>
            <li>• Close the shape to finish</li>
            <li>• This defines where your project will be</li>
          </ul>
        </div>
      )}
    </div>
  );
};
