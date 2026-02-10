import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useDealStore } from '../stores/dealStore';
import { useMapDrawingStore } from '../stores/mapDrawingStore';
import { useMapLayers } from '../contexts/MapLayersContext';
// CreateDealModal is deprecated - now using CreateDealPage at /deals/create
// import { CreateDealModal } from '../components/deal/CreateDealModal';
import { DrawingControlPanel } from '../components/map/DrawingControlPanel';
import { ThreePanelLayout } from '../components/layout/ThreePanelLayout';
import { Button } from '../components/shared/Button';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export const Dashboard: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { deals, fetchDeals, isLoading} = useDealStore();
  const { isDrawing, centerPoint, saveDrawing, stopDrawing } = useMapDrawingStore();
  const { layers } = useMapLayers();
  const [mapError, setMapError] = useState<string | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const layerMarkers = useRef<Map<string, mapboxgl.Marker[]>>(new Map());

  useEffect(() => {
    fetchDeals();
    
    // Redirect to create page if requested
    if (location.state?.openCreateDeal) {
      navigate('/deals/create');
      window.history.replaceState({}, document.title);
    }
  }, [location, navigate]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-84.388, 33.749],
        zoom: 11
      });

      draw.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true,
        },
      });

      map.current.addControl(draw.current, 'top-left');
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      map.current.on('draw.create', (e: any) => {
        const geometry = e.features[0].geometry;
        saveDrawing(geometry);
      });

      map.current.on('draw.update', (e: any) => {
        const geometry = e.features[0].geometry;
        saveDrawing(geometry);
      });

      map.current.on('draw.delete', () => {
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

  useEffect(() => {
    if (!map.current || !draw.current) return;

    if (isDrawing) {
      draw.current.deleteAll();
      draw.current.changeMode('draw_polygon');
      
      if (centerPoint) {
        map.current.flyTo({
          center: centerPoint,
          zoom: 16,
          duration: 1500,
        });
        
        new mapboxgl.Marker({ color: '#3B82F6' })
          .setLngLat(centerPoint)
          .addTo(map.current);
      }
    } else {
      if (draw.current) {
        draw.current.changeMode('simple_select');
      }
    }
  }, [isDrawing, centerPoint]);

  useEffect(() => {
    if (!map.current) return;

    const activeLayerIds = layers.filter(l => l.active).map(l => l.id);
    const currentLayerIds = Array.from(layerMarkers.current.keys());

    activeLayerIds.forEach(layerId => {
      if (!currentLayerIds.includes(layerId)) {
        fetchAndRenderLayer(layerId);
      }
    });

    currentLayerIds.forEach(layerId => {
      if (!activeLayerIds.includes(layerId)) {
        removeLayer(layerId);
      }
    });
  }, [layers]);

  const fetchAndRenderLayer = async (layerId: string) => {
    if (!map.current) return;

    try {
      const response = await fetch(`/api/v1/layers/${layerId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}` || '',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch layer: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success || !data.locations) {
        return;
      }

      const markers: mapboxgl.Marker[] = data.locations.map((loc: any) => {
        const el = document.createElement('div');
        el.className = 'custom-map-marker';
        el.style.cursor = 'pointer';
        el.style.fontSize = '24px';
        
        const icon = getLayerIcon(layerId);
        el.innerHTML = icon;

        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: true,
          closeOnClick: false,
        }).setHTML(loc.popupHTML);

        const marker = new mapboxgl.Marker(el)
          .setLngLat([loc.lng, loc.lat])
          .setPopup(popup)
          .addTo(map.current!);

        return marker;
      });

      layerMarkers.current.set(layerId, markers);

    } catch (error) {
      console.error(`[Dashboard] Error rendering layer ${layerId}:`, error);
    }
  };

  const removeLayer = (layerId: string) => {
    const markers = layerMarkers.current.get(layerId);
    if (markers) {
      markers.forEach(marker => marker.remove());
      layerMarkers.current.delete(layerId);
    }
  };

  const getLayerIcon = (layerId: string): string => {
    switch (layerId) {
      case 'news-intelligence':
        return '📰';
      case 'assets-owned':
        return '🏢';
      case 'pipeline':
        return '📊';
      default:
        return '📍';
    }
  };

  useEffect(() => {
    if (!map.current || !Array.isArray(deals) || !deals.length) return;

    const m = map.current;

    if (!m.loaded()) {
      m.on('load', () => addDealsToMap(m, deals));
    } else {
      addDealsToMap(m, deals);
    }
  }, [deals]);

  const addDealsToMap = (m: mapboxgl.Map, deals: any[]) => {
    if (m.getSource('deals')) {
      if (m.getLayer('deal-fills')) m.removeLayer('deal-fills');
      if (m.getLayer('deal-borders')) m.removeLayer('deal-borders');
      m.removeSource('deals');
    }

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

    m.addSource('deals', {
      type: 'geojson',
      data: geojson as any
    });

    m.addLayer({
      id: 'deal-fills',
      type: 'fill',
      source: 'deals',
      paint: {
        'fill-color': [
          'match',
          ['get', 'tier'],
          'basic', '#fbbf24',
          'pro', '#3b82f6',
          'enterprise', '#10b981',
          '#6b7280'
        ],
        'fill-opacity': 0.3
      }
    });

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

    m.on('click', 'deal-fills', (e) => {
      if (e.features && e.features[0]) {
        const dealId = e.features[0].properties.id;
        window.location.href = `/deals/${dealId}`;
      }
    });

    m.on('mouseenter', 'deal-fills', () => {
      m.getCanvas().style.cursor = 'pointer';
    });
    m.on('mouseleave', 'deal-fills', () => {
      m.getCanvas().style.cursor = '';
    });

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

  const renderContent = () => (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-3">MY DEALS</h2>
      
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : !Array.isArray(deals) || deals.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No deals yet</p>
          <Button onClick={() => navigate('/deals/create')} size="sm">
            Create Your First Deal
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {deals.map(deal => (
            <a
              key={deal.id}
              href={`/deals/${deal.id}`}
              className="block p-4 rounded-lg hover:bg-gray-50 transition border border-gray-200 bg-white"
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

      {Array.isArray(deals) && deals.length > 0 && (
        <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
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
  );

  const renderMap = () => (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {isDrawing && (
        <DrawingControlPanel
          onComplete={() => {
            stopDrawing();
          }}
          onCancel={() => {
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
    </div>
  );

  return (
    <ThreePanelLayout
      storageKey="dashboard"
      showViewsPanel={false}
      renderContent={renderContent}
      renderMap={renderMap}
      defaultContentWidth={400}
      minContentWidth={300}
      maxContentWidth={600}
    />
  );
};
