/**
 * Dashboard V2 - With Layer System
 * Updated to use LayerRenderer and LayersPanel components
 */

import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Map from 'react-map-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useDealStore } from '../stores/dealStore';
import { useMapDrawingStore } from '../stores/mapDrawingStore';
import { CreateDealModal } from '../components/deal/CreateDealModal';
import { DrawingControlPanel } from '../components/map/DrawingControlPanel';
import { LayerRenderer } from '../components/map/LayerRenderer';
import { LayersPanel } from '../components/map/LayersPanel';
import { layersService } from '../services/layers.service';
import { MapLayer } from '../types/layers';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
const DEFAULT_MAP_ID = 'default'; // TODO: Get from user's active map

export const DashboardV2: React.FC = () => {
  const location = useLocation();
  const { deals, fetchDeals, isLoading } = useDealStore();
  const { isDrawing, centerPoint, saveDrawing } = useMapDrawingStore();
  
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewState, setViewState] = useState({
    longitude: -84.388,
    latitude: 33.749,
    zoom: 11
  });

  const mapRef = useRef<any>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  // Fetch deals on mount
  useEffect(() => {
    fetchDeals();
    
    // Check if we should open create deal modal from navigation state
    if (location.state?.openCreateDeal) {
      setIsCreateModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Fetch layers for current map
  useEffect(() => {
    const fetchLayers = async () => {
      try {
        const mapLayers = await layersService.getMapLayers(DEFAULT_MAP_ID);
        setLayers(mapLayers);
      } catch (error) {
        console.error('Failed to fetch layers:', error);
      }
    };

    fetchLayers();
  }, []);

  // Initialize drawing tools when map loads
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current.getMap();

    // Initialize MapboxDraw if not already initialized
    if (!drawRef.current) {
      drawRef.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true
        }
      });

      map.addControl(drawRef.current, 'top-left');

      // Listen for drawing events
      map.on('draw.create', (e: any) => {
        const geometry = e.features[0].geometry;
        console.log('[Dashboard] Polygon created:', geometry);
        saveDrawing(geometry);
      });

      map.on('draw.update', (e: any) => {
        const geometry = e.features[0].geometry;
        console.log('[Dashboard] Polygon updated:', geometry);
        saveDrawing(geometry);
      });

      map.on('draw.delete', () => {
        console.log('[Dashboard] Polygon deleted');
        saveDrawing(null as any);
      });
    }
  }, [mapRef.current]);

  // Handle drawing mode activation
  useEffect(() => {
    if (!drawRef.current || !mapRef.current) return;

    const map = mapRef.current.getMap();

    if (isDrawing) {
      console.log('[Dashboard] Activating drawing mode');
      
      // Clear any existing drawings
      drawRef.current.deleteAll();
      
      // Start polygon drawing mode
      drawRef.current.changeMode('draw_polygon');
      
      // Center map on property location if provided
      if (centerPoint) {
        map.flyTo({
          center: centerPoint,
          zoom: 16,
          duration: 1500
        });
      }
    } else {
      console.log('[Dashboard] Deactivating drawing mode');
      
      // Exit drawing mode
      if (drawRef.current) {
        drawRef.current.changeMode('simple_select');
      }
    }
  }, [isDrawing, centerPoint]);

  // Add deal boundaries to map
  useEffect(() => {
    if (!mapRef.current || !deals.length) return;

    const map = mapRef.current.getMap();

    // Wait for map style to load
    if (!map.isStyleLoaded()) {
      map.once('style.load', () => addDealsToMap(map));
    } else {
      addDealsToMap(map);
    }
  }, [deals]);

  const addDealsToMap = (map: any) => {
    // Remove existing layers and sources
    if (map.getLayer('deal-fills')) map.removeLayer('deal-fills');
    if (map.getLayer('deal-borders')) map.removeLayer('deal-borders');
    if (map.getSource('deals')) map.removeSource('deals');

    // Filter deals with valid boundaries
    const validDeals = deals.filter(
      deal => deal.boundary && deal.boundary.type && deal.boundary.coordinates
    );

    if (validDeals.length === 0) return;

    // Create GeoJSON
    const geojson = {
      type: 'FeatureCollection',
      features: validDeals.map(deal => ({
        type: 'Feature',
        geometry: deal.boundary,
        properties: {
          id: deal.id,
          name: deal.name,
          tier: deal.tier || 'basic'
        }
      }))
    };

    // Add source
    map.addSource('deals', {
      type: 'geojson',
      data: geojson
    });

    // Add fill layer
    map.addLayer({
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

    // Add border layer
    map.addLayer({
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

    // Add click handlers
    map.on('click', 'deal-fills', (e: any) => {
      const feature = e.features[0];
      if (feature) {
        const { id, name } = feature.properties;
        // Navigate to deal view
        window.location.href = `/deals/${id}`;
      }
    });

    // Change cursor on hover
    map.on('mouseenter', 'deal-fills', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'deal-fills', () => {
      map.getCanvas().style.cursor = '';
    });
  };

  const handleAddLayer = () => {
    // TODO: Open layer picker modal
    console.log('Open layer picker modal');
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Map Configuration Required</h2>
          <p className="text-gray-600">Please add VITE_MAPBOX_TOKEN to your environment variables.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen">
      {/* Map Canvas */}
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Layer Renderer */}
        <LayerRenderer
          layers={layers}
          mapId={DEFAULT_MAP_ID}
          onMarkerClick={(dataPoint) => {
            console.log('Marker clicked:', dataPoint);
          }}
        />
      </Map>

      {/* Layers Control Panel */}
      <LayersPanel
        layers={layers}
        mapId={DEFAULT_MAP_ID}
        onLayersChange={setLayers}
        onAddLayer={handleAddLayer}
      />

      {/* Drawing Control Panel (shows when drawing) */}
      {isDrawing && <DrawingControlPanel />}

      {/* Create Deal Modal */}
      {isCreateModalOpen && (
        <CreateDealModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchDeals();
          }}
        />
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
          <div className="bg-white px-6 py-3 rounded-lg shadow-lg">
            <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading deals...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardV2;
