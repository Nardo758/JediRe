import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useDealStore } from '../stores/dealStore';
import { useMapDrawingStore } from '../stores/mapDrawingStore';
import { CreateDealModal } from '../components/deal/CreateDealModal';
import { DrawingControlPanel } from '../components/map/DrawingControlPanel';
import { Button } from '../components/shared/Button';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export const Dashboard: React.FC = () => {
  const location = useLocation();
  const { deals, fetchDeals, isLoading } = useDealStore();
  const { isDrawing, centerPoint, saveDrawing, stopDrawing } = useMapDrawingStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);

  useEffect(() => {
    fetchDeals();
    
    // Check if we should open create deal modal from navigation state
    if (location.state?.openCreateDeal) {
      setIsCreateModalOpen(true);
      // Clear the state to prevent reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-84.388, 33.749],
        zoom: 11
      });

      // Initialize MapboxDraw
      draw.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true,
        },
      });

      map.current.addControl(draw.current, 'top-left');
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Listen for drawing events
      map.current.on('draw.create', (e: any) => {
        const geometry = e.features[0].geometry;
        console.log('[Dashboard] Polygon created:', geometry);
        saveDrawing(geometry);
      });

      map.current.on('draw.update', (e: any) => {
        const geometry = e.features[0].geometry;
        console.log('[Dashboard] Polygon updated:', geometry);
        saveDrawing(geometry);
      });

      map.current.on('draw.delete', () => {
        console.log('[Dashboard] Polygon deleted');
        saveDrawing(null as any);
      });

    } catch (err: any) {
      setMapError(err.message || 'Failed to initialize map');
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Handle drawing mode activation
  useEffect(() => {
    if (!map.current || !draw.current) return;

    if (isDrawing) {
      console.log('[Dashboard] Activating drawing mode');
      
      // Clear any existing drawings
      draw.current.deleteAll();
      
      // Start polygon drawing mode
      draw.current.changeMode('draw_polygon');
      
      // Center map on property location if provided
      if (centerPoint) {
        map.current.flyTo({
          center: centerPoint,
          zoom: 16,
          duration: 1500,
        });
        
        // Add marker at property location
        new mapboxgl.Marker({ color: '#3B82F6' })
          .setLngLat(centerPoint)
          .addTo(map.current);
      }
    } else {
      console.log('[Dashboard] Deactivating drawing mode');
      
      // Exit drawing mode
      if (draw.current) {
        draw.current.changeMode('simple_select');
      }
    }
  }, [isDrawing, centerPoint]);

  // Update map when deals change
  useEffect(() => {
    if (!map.current || !Array.isArray(deals) || !deals.length) return;

    const m = map.current;

    // Wait for map to load
    if (!m.loaded()) {
      m.on('load', () => addDealsToMap(m, deals));
    } else {
      addDealsToMap(m, deals);
    }
  }, [deals]);

  const addDealsToMap = (m: mapboxgl.Map, deals: any[]) => {
    // Remove existing sources and layers
    if (m.getSource('deals')) {
      if (m.getLayer('deal-fills')) m.removeLayer('deal-fills');
      if (m.getLayer('deal-borders')) m.removeLayer('deal-borders');
      m.removeSource('deals');
    }

    // Create GeoJSON from deals (only include deals with valid GeoJSON boundaries)
    const geojson = {
      type: 'FeatureCollection',
      features: deals
        .filter(deal => deal.boundary && deal.boundary.type && deal.boundary.coordinates)
        .map(deal => ({
          type: 'Feature',
          geometry: deal.boundary,
          properties: {
            id: deal.id,
            name: deal.name,
            tier: deal.tier,
            projectType: deal.projectType
          }
        }))
    };

    // Add source
    m.addSource('deals', {
      type: 'geojson',
      data: geojson as any
    });

    // Add fill layer
    m.addLayer({
      id: 'deal-fills',
      type: 'fill',
      source: 'deals',
      paint: {
        'fill-color': [
          'match',
          ['get', 'tier'],
          'basic', '#fbbf24', // yellow
          'pro', '#3b82f6',   // blue
          'enterprise', '#10b981', // green
          '#6b7280' // default gray
        ],
        'fill-opacity': 0.3
      }
    });

    // Add border layer
    m.addLayer({
      id: 'deal-borders',
      type: 'line',
      source: 'deals',
      paint: {
        'line-color': [
          'match',
          ['get', 'tier'],
          'basic', '#f59e0b',
          'pro', '#2563eb',
          'enterprise', '#059669',
          '#4b5563'
        ],
        'line-width': 2
      }
    });

    // Add click handler
    m.on('click', 'deal-fills', (e) => {
      if (e.features && e.features[0]) {
        const dealId = e.features[0].properties.id;
        window.location.href = `/deals/${dealId}`;
      }
    });

    // Change cursor on hover
    m.on('mouseenter', 'deal-fills', () => {
      m.getCanvas().style.cursor = 'pointer';
    });
    m.on('mouseleave', 'deal-fills', () => {
      m.getCanvas().style.cursor = '';
    });

    // Fit map to show all deals
    if (deals.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      let hasValidBounds = false;
      deals.forEach(deal => {
        if (deal.boundary && deal.boundary.type === 'Polygon' && deal.boundary.coordinates) {
          deal.boundary.coordinates[0].forEach((coord: number[]) => {
            if (Array.isArray(coord) && coord.length >= 2) {
              bounds.extend(coord as [number, number]);
              hasValidBounds = true;
            }
          });
        } else if (deal.boundary && deal.boundary.type === 'Point' && deal.boundary.coordinates) {
          const coord = deal.boundary.coordinates;
          if (Array.isArray(coord) && coord.length >= 2) {
            bounds.extend(coord as [number, number]);
            hasValidBounds = true;
          }
        }
      });
      if (hasValidBounds) {
        m.fitBounds(bounds, { padding: 50 });
      }
    }
  };

  const handleDealCreated = (deal: any) => {
    fetchDeals();
  };

  return (
    <>
    <div className="h-full flex">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">MY DEALS</h2>
            
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : !Array.isArray(deals) || deals.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No deals yet</p>
                <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
                  Create Your First Deal
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {deals.map(deal => (
                  <a
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    className="block p-4 rounded-lg hover:bg-gray-50 transition border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: 
                            deal.tier === 'basic' ? '#fbbf24' :
                            deal.tier === 'pro' ? '#3b82f6' :
                            deal.tier === 'enterprise' ? '#10b981' : '#6b7280'
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {deal.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {deal.projectType} • {(deal.acres || 0).toFixed(1)} acres
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{deal.propertyCount} properties</span>
                          {deal.pendingTasks > 0 && (
                            <span>{deal.pendingTasks} tasks</span>
                          )}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="absolute inset-0" />
          
          {/* Drawing Control Panel */}
          {isDrawing && (
            <DrawingControlPanel
              onComplete={() => {
                console.log('[Dashboard] Drawing complete');
                stopDrawing();
              }}
              onCancel={() => {
                console.log('[Dashboard] Drawing cancelled');
                if (draw.current) {
                  draw.current.deleteAll();
                }
                stopDrawing();
              }}
            />
          )}
          
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center p-8">
                <div className="text-6xl mb-4">🗺️</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Map View</h3>
                <p className="text-sm text-gray-500">Map requires a Mapbox token to display.</p>
                <p className="text-xs text-gray-400 mt-1">Set VITE_MAPBOX_TOKEN in environment variables.</p>
              </div>
            </div>
          )}
          
          {/* Quick stats overlay */}
          {Array.isArray(deals) && deals.length > 0 && (
            <div className="absolute bottom-6 left-6 bg-white rounded-lg shadow-lg p-4 z-10">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Quick Stats</h3>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between gap-6">
                  <span className="text-gray-600">Active Deals:</span>
                  <span className="font-semibold">{deals.length}</span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="text-gray-600">Total Pipeline:</span>
                  <span className="font-semibold">
                    ${deals.reduce((sum, d) => sum + (d.budget || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Deal Modal */}
      <CreateDealModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onDealCreated={handleDealCreated}
      />
    </>
  );
};
