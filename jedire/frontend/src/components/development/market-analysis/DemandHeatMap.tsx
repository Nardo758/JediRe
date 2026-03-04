import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Navigation } from 'lucide-react';
import type { DemandPoint, DemandDriver } from '@/types/development';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface DemandHeatMapProps {
  dealLocation: [number, number]; // [lat, lng]
  radius: number; // miles
  demandPoints: DemandPoint[];
  demandDrivers: DemandDriver[];
  onRadiusChange: (radius: number) => void;
}

export const DemandHeatMap: React.FC<DemandHeatMapProps> = ({
  dealLocation,
  radius,
  demandPoints,
  demandDrivers,
  onRadiusChange,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [dealLocation[1], dealLocation[0]],
      zoom: 13,
    });

    map.current.on('load', () => {
      setMapLoaded(true);
      
      // Add property marker
      new mapboxgl.Marker({ color: '#3B82F6' })
        .setLngLat([dealLocation[1], dealLocation[0]])
        .setPopup(new mapboxgl.Popup().setHTML('<div class="font-semibold">Subject Property</div>'))
        .addTo(map.current!);
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [dealLocation]);

  // Update demand heatmap
  useEffect(() => {
    if (!map.current || !mapLoaded || demandPoints.length === 0) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: demandPoints.map(point => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.lng, point.lat],
        },
        properties: {
          intensity: point.intensity,
          type: point.type,
        },
      })),
    };

    if (map.current.getSource('demand-heat')) {
      (map.current.getSource('demand-heat') as mapboxgl.GeoJSONSource).setData(geojson);
    } else {
      map.current.addSource('demand-heat', {
        type: 'geojson',
        data: geojson,
      });

      map.current.addLayer({
        id: 'demand-heatmap',
        type: 'heatmap',
        source: 'demand-heat',
        paint: {
          'heatmap-weight': ['get', 'intensity'],
          'heatmap-intensity': 1,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(33,102,172,0)',
            0.2, 'rgb(103,169,207)',
            0.4, 'rgb(209,229,240)',
            0.6, 'rgb(253,219,199)',
            0.8, 'rgb(239,138,98)',
            1, 'rgb(178,24,43)',
          ],
          'heatmap-radius': 30,
          'heatmap-opacity': 0.7,
        },
      });
    }
  }, [demandPoints, mapLoaded]);

  // Add demand driver markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.demand-driver-marker');
    existingMarkers.forEach(m => m.remove());

    // Add new markers
    demandDrivers.forEach(driver => {
      const el = document.createElement('div');
      el.className = 'demand-driver-marker';
      el.innerHTML = getDriverIcon(driver.type);
      el.style.cursor = 'pointer';

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="p-2">
          <div class="font-semibold text-sm mb-1">${driver.name}</div>
          <div class="text-xs text-gray-600">${driver.type}</div>
          <div class="text-xs text-gray-500 mt-1">${driver.distance.toFixed(1)} mi away</div>
          ${driver.details ? `<div class="text-xs text-gray-500 mt-1">${driver.details}</div>` : ''}
        </div>
      `);

      new mapboxgl.Marker(el)
        .setLngLat([driver.location[1], driver.location[0]])
        .setPopup(popup)
        .addTo(map.current!);
    });
  }, [demandDrivers, mapLoaded]);

  // Update radius circle
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const radiusInMeters = radius * 1609.34; // miles to meters
    const options = { steps: 64, units: 'meters' as const };
    
    // Create circle using turf (simple implementation)
    const circleGeoJSON: GeoJSON.Feature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [dealLocation[1], dealLocation[0]],
      },
      properties: {},
    };

    if (map.current.getSource('radius-circle')) {
      map.current.removeLayer('radius-circle-fill');
      map.current.removeLayer('radius-circle-stroke');
      map.current.removeSource('radius-circle');
    }

    map.current.addSource('radius-circle', {
      type: 'geojson',
      data: circleGeoJSON,
    });

    map.current.addLayer({
      id: 'radius-circle-stroke',
      type: 'circle',
      source: 'radius-circle',
      paint: {
        'circle-radius': radiusInMeters / 10, // Approximate for zoom level
        'circle-color': 'transparent',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#3B82F6',
        'circle-opacity': 0,
      },
    });
  }, [radius, dealLocation, mapLoaded]);

  const getDriverIcon = (type: string): string => {
    const icons: Record<string, string> = {
      employer: '💼',
      education: '🎓',
      transit: '🚇',
      entertainment: '🎭',
    };
    return `<div class="text-2xl">${icons[type] || '📍'}</div>`;
  };

  const radiusOptions = [0.5, 1, 2, 3];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Demand Heat Map</h3>
          <Navigation className="w-5 h-5 text-gray-400" />
        </div>
        
        {/* Radius Selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Radius:</label>
          <div className="flex gap-1">
            {radiusOptions.map(r => (
              <button
                key={r}
                onClick={() => onRadiusChange(r)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  radius === r
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {r} mi
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapContainer} className="h-64" />

      {/* Legend */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-xs font-semibold text-gray-700 mb-2">Demand Intensity:</div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-orange-400" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-300" />
            <span>Low</span>
          </div>
        </div>
        
        {demandDrivers.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-semibold text-gray-700 mb-1">Key Drivers:</div>
            {demandDrivers.slice(0, 3).map(driver => (
              <div key={driver.id} className="text-xs text-gray-600 flex items-center gap-2">
                <span>{getDriverIcon(driver.type)}</span>
                <span>{driver.name} ({driver.distance.toFixed(1)} mi)</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
