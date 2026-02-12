import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Deal, Property } from '../../types';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface DealMapViewProps {
  deal: Deal;
}

export const DealMapView: React.FC<DealMapViewProps> = ({ deal }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    let center: [number, number] = [-84.388, 33.749];
    if (deal.boundary && deal.boundary.type === 'Polygon' && deal.boundary.coordinates?.[0]?.[0]) {
      center = [deal.boundary.coordinates[0][0][0], deal.boundary.coordinates[0][0][1]];
    } else if (deal.boundary && deal.boundary.type === 'Point' && deal.boundary.coordinates) {
      center = [deal.boundary.coordinates[0], deal.boundary.coordinates[1]];
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom: 14
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      if (map.current && deal.boundary) {
        addBoundaryToMap(map.current, deal.boundary);
        fetchProperties();
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const addBoundaryToMap = (m: mapboxgl.Map, boundary: any) => {
    m.addSource('deal-boundary', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: boundary,
        properties: {}
      }
    });

    if (boundary.type === 'Polygon') {
      m.addLayer({
        id: 'deal-boundary-fill',
        type: 'fill',
        source: 'deal-boundary',
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.1
        }
      });

      m.addLayer({
        id: 'deal-boundary-line',
        type: 'line',
        source: 'deal-boundary',
        paint: {
          'line-color': '#2563eb',
          'line-width': 3
        }
      });
    } else if (boundary.type === 'Point') {
      m.addLayer({
        id: 'deal-boundary-point',
        type: 'circle',
        source: 'deal-boundary',
        paint: {
          'circle-radius': 10,
          'circle-color': '#3b82f6',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#2563eb'
        }
      });
    }

    if (boundary.type === 'Polygon' && boundary.coordinates?.[0]) {
      const bounds = new mapboxgl.LngLatBounds();
      boundary.coordinates[0].forEach((coord: number[]) => {
        if (Array.isArray(coord) && coord.length >= 2) {
          bounds.extend(coord as [number, number]);
        }
      });
      m.fitBounds(bounds, { padding: 50 });
    } else if (boundary.type === 'Point' && boundary.coordinates) {
      m.flyTo({ center: boundary.coordinates as [number, number], zoom: 16 });
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch(`/api/v1/deals/${deal.id}/properties`);
      const data = await response.json();
      setProperties(data);
      
      if (map.current && data.length > 0) {
        addPropertiesToMap(map.current, data);
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error);
    }
  };

  const addPropertiesToMap = (m: mapboxgl.Map, props: Property[]) => {
    // Create GeoJSON from properties
    const geojson = {
      type: 'FeatureCollection',
      features: props.map(p => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.lng, p.lat]
        },
        properties: {
          id: p.id,
          address: p.address,
          rent: p.rent,
          class: p.building_class
        }
      }))
    };

    // Add source
    m.addSource('properties', {
      type: 'geojson',
      data: geojson as any
    });

    // Add circle layer
    m.addLayer({
      id: 'property-circles',
      type: 'circle',
      source: 'properties',
      paint: {
        'circle-radius': 8,
        'circle-color': [
          'match',
          ['get', 'class'],
          'A', '#10b981',
          'A+', '#059669',
          'B', '#3b82f6',
          'B+', '#2563eb',
          'C', '#f59e0b',
          'C+', '#d97706',
          '#6b7280'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Add click handler
    m.on('click', 'property-circles', (e) => {
      if (e.features && e.features[0]) {
        const propId = e.features[0].properties.id;
        const property = props.find(p => p.id === propId);
        if (property) {
          setSelectedProperty(property);
        }
      }
    });

    // Change cursor on hover
    m.on('mouseenter', 'property-circles', () => {
      m.getCanvas().style.cursor = 'pointer';
    });
    m.on('mouseleave', 'property-circles', () => {
      m.getCanvas().style.cursor = '';
    });
  };

  return (
    <div className="relative h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Legend */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 z-10">
        <h3 className="font-semibold text-sm mb-2">Legend</h3>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white"></div>
            <span>Deal Boundary</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"></div>
            <span>Class A/A+ Property</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white"></div>
            <span>Class B/B+ Property</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500 border-2 border-white"></div>
            <span>Class C/C+ Property</span>
          </div>
        </div>
      </div>


      {/* Selected property popup */}
      {selectedProperty && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-xl p-4 z-10 max-w-md">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-lg">{selectedProperty.address}</h3>
              <p className="text-sm text-gray-600">
                {selectedProperty.beds && `${selectedProperty.beds} bed`}
                {selectedProperty.baths && ` • ${selectedProperty.baths} bath`}
                {selectedProperty.sqft && ` • ${selectedProperty.sqft} sqft`}
              </p>
            </div>
            <button
              onClick={() => setSelectedProperty(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-gray-900">
                ${selectedProperty.rent?.toLocaleString()}
              </span>
              <span className="text-sm text-gray-600">/mo</span>
            </div>
            {selectedProperty.building_class && (
              <span className="px-3 py-1 bg-gray-100 rounded-full text-sm font-medium">
                Class {selectedProperty.building_class}
              </span>
            )}
          </div>
          {selectedProperty.comparableScore && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-600">Comparable Score</div>
              <div className="text-sm font-semibold text-blue-600">
                {(selectedProperty.comparableScore * 100).toFixed(0)}%
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
