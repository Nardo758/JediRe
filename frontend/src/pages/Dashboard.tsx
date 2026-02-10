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
import { AssetsSection } from '../components/dashboard/AssetsSection';
import { KeyFindingsSection } from '../components/dashboard/KeyFindingsSection';
import { DealCard } from '../components/deal/DealCard';
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
    <div className="space-y-6">
      {/* Key Findings Section */}
      <KeyFindingsSection />

      {/* Assets Section */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">MY PORTFOLIO</h2>
        <AssetsSection />
      </div>

      {/* Deals Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">MY DEALS</h2>
          {Array.isArray(deals) && deals.length > 0 && (
            <Button onClick={() => navigate('/deals/create')} size="sm" variant="secondary">
              + New
            </Button>
          )}
        </div>
        
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p>Loading deals...</p>
          </div>
        ) : !Array.isArray(deals) || deals.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No deals yet</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              Create your first deal to get started with JEDI RE. Track properties, run analysis, and close deals faster.
            </p>
            <Button onClick={() => navigate('/deals/create')} size="md">
              Create Deal
            </Button>
          </div>
        ) : (
          <>
            {/* Hot Deals Alert */}
            {(() => {
              const hotDeals = deals.filter(d => d.triageStatus === 'Hot' || (d.daysInStation || 0) > 14);
              return hotDeals.length > 0 ? (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-orange-800">
                    <span className="text-lg">🔥</span>
                    <span className="font-semibold">
                      {hotDeals.length} deal{hotDeals.length > 1 ? 's' : ''} need{hotDeals.length === 1 ? 's' : ''} attention
                    </span>
                  </div>
                </div>
              ) : null;
            })()}

            {/* Deals List */}
            <div className="space-y-2 mb-4">
              {deals.map(deal => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-600 mb-1">Active Deals</div>
                  <div className="text-2xl font-bold text-gray-900">{deals.length}</div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Total Pipeline</div>
                  <div className="text-2xl font-bold text-gray-900">
                    ${(deals.reduce((sum, d) => sum + (d.budget || 0), 0) / 1000000).toFixed(1)}M
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Hot Deals</div>
                  <div className="text-2xl font-bold text-red-600">
                    {deals.filter(d => d.triageStatus === 'Hot').length}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">Avg Days/Deal</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {Math.round(deals.reduce((sum, d) => sum + (d.daysInStation || 0), 0) / deals.length)}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
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
