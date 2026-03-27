import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Deal, Property } from '../../types';
import { api } from '../../services/api.client';
import { BT } from '@/components/deal/bloomberg-ui';
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
    if (!mapContainer.current) return;

    if (map.current) {
      map.current.remove();
      map.current = null;
    }

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
  }, [deal.id]);

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
          'fill-color': BT.text.cyan,
          'fill-opacity': 0.1
        }
      });

      m.addLayer({
        id: 'deal-boundary-line',
        type: 'line',
        source: 'deal-boundary',
        paint: {
          'line-color': BT.text.cyan,
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
          'circle-color': BT.text.cyan,
          'circle-stroke-width': 3,
          'circle-stroke-color': BT.text.cyan
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
      const response = await api.deals.properties(deal.id);
      const data = response.data?.data || response.data || [];
      setProperties(Array.isArray(data) ? data : []);

      if (map.current && Array.isArray(data) && data.length > 0) {
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
          'A', BT.text.green,
          'A+', BT.text.green,
          'B', BT.text.cyan,
          'B+', BT.text.cyan,
          'C', BT.text.amber,
          'C+', BT.text.amber,
          BT.text.muted
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': BT.border.bright
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
      <div
        className="absolute top-4 left-4 p-4 z-10"
        style={{
          background: BT.bg.panel,
          border: `1px solid ${BT.border.medium}`,
          borderRadius: 0,
          fontFamily: BT.font.label,
        }}
      >
        <h3 style={{ color: BT.text.primary, fontFamily: BT.font.mono, fontSize: '11px', fontWeight: 600, marginBottom: '8px' }}>Legend</h3>
        <div className="space-y-1" style={{ fontSize: '10px' }}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3" style={{ borderRadius: '50%', background: BT.text.cyan, border: `2px solid ${BT.border.bright}` }}></div>
            <span style={{ color: BT.text.secondary }}>Deal Boundary</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3" style={{ borderRadius: '50%', background: BT.text.green, border: `2px solid ${BT.border.bright}` }}></div>
            <span style={{ color: BT.text.secondary }}>Class A/A+ Property</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3" style={{ borderRadius: '50%', background: BT.text.cyan, border: `2px solid ${BT.border.bright}` }}></div>
            <span style={{ color: BT.text.secondary }}>Class B/B+ Property</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3" style={{ borderRadius: '50%', background: BT.text.amber, border: `2px solid ${BT.border.bright}` }}></div>
            <span style={{ color: BT.text.secondary }}>Class C/C+ Property</span>
          </div>
        </div>
      </div>


      {/* Selected property popup */}
      {selectedProperty && (
        <div
          className="absolute bottom-4 left-4 right-4 p-4 z-10 max-w-md"
          style={{
            background: BT.bg.panel,
            border: `1px solid ${BT.border.medium}`,
            borderRadius: 0,
            fontFamily: BT.font.label,
          }}
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 style={{ fontWeight: 600, fontSize: '14px', color: BT.text.primary }}>{selectedProperty.address}</h3>
              <p style={{ fontSize: '11px', color: BT.text.secondary }}>
                {selectedProperty.beds && `${selectedProperty.beds} bed`}
                {selectedProperty.baths && ` \u2022 ${selectedProperty.baths} bath`}
                {selectedProperty.sqft && ` \u2022 ${selectedProperty.sqft} sqft`}
              </p>
            </div>
            <button
              onClick={() => setSelectedProperty(null)}
              style={{ color: BT.text.muted }}
            >
              \u2715
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span style={{ fontSize: '20px', fontWeight: 700, color: BT.text.primary, fontFamily: BT.font.mono }}>
                ${selectedProperty.rent?.toLocaleString()}
              </span>
              <span style={{ fontSize: '11px', color: BT.text.secondary }}>/mo</span>
            </div>
            {selectedProperty.building_class && (
              <span
                className="px-3 py-1"
                style={{
                  background: BT.bg.active,
                  color: BT.text.primary,
                  borderRadius: '2px',
                  fontSize: '11px',
                  fontWeight: 500,
                  fontFamily: BT.font.mono,
                }}
              >
                Class {selectedProperty.building_class}
              </span>
            )}
          </div>
          {selectedProperty.comparableScore && (
            <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
              <div style={{ fontSize: '10px', color: BT.text.secondary }}>Comparable Score</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: BT.text.cyan }}>
                {(selectedProperty.comparableScore * 100).toFixed(0)}%
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
