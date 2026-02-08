/**
 * Dashboard V3 - Complete Integration
 * War Maps + Layer Controls + Sidebar Integration + Drag-and-Drop
 */

import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Map from 'react-map-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useDealStore } from '../stores/dealStore';
import { useMapDrawingStore } from '../stores/mapDrawingStore';
import { CreateDealModal } from '../components/deal/CreateDealModal';
import { DrawingControlPanel } from '../components/map/DrawingControlPanel';
import { LayerRendererFull } from '../components/map/LayerRendererFull';
import { LayersPanel } from '../components/map/LayersPanel';
import { MapTabsBar } from '../components/map/MapTabsBar';
import { WarMapsComposer } from '../components/map/WarMapsComposer';
import { layersService } from '../services/layers.service';
import { mapConfigsService, MapConfiguration } from '../services/map-configs.service';
import { MapLayer } from '../types/layers';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
const DEFAULT_MAP_ID = 'default';

export const DashboardV3: React.FC = () => {
  const location = useLocation();
  const { deals, fetchDeals, isLoading } = useDealStore();
  const { isDrawing, centerPoint, saveDrawing } = useMapDrawingStore();
  
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [activeConfig, setActiveConfig] = useState<MapConfiguration | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isWarMapsOpen, setIsWarMapsOpen] = useState(false);
  const [viewState, setViewState] = useState({
    longitude: -84.388,
    latitude: 33.749,
    zoom: 11
  });
  const [isDragOver, setIsDragOver] = useState(false);

  const mapRef = useRef<any>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  // Fetch deals on mount
  useEffect(() => {
    fetchDeals();
    
    if (location.state?.openCreateDeal) {
      setIsCreateModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Load default map configuration
  useEffect(() => {
    const loadDefaultConfig = async () => {
      try {
        const config = await mapConfigsService.getDefaultConfig();
        if (config) {
          setActiveConfig(config);
          // Load layers from config
          if (config.layer_config && Array.isArray(config.layer_config)) {
            const configLayers = await Promise.all(
              config.layer_config.map(async (layerDef: any) => {
                return await layersService.createLayer({
                  map_id: DEFAULT_MAP_ID,
                  ...layerDef
                });
              })
            );
            setLayers(configLayers);
          }
        }
      } catch (error) {
        console.error('Failed to load default config:', error);
      }
    };

    loadDefaultConfig();
  }, []);

  // Initialize drawing tools
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current.getMap();

    if (!drawRef.current) {
      drawRef.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true
        }
      });

      map.addControl(drawRef.current, 'top-left');

      map.on('draw.create', (e: any) => {
        const geometry = e.features[0].geometry;
        saveDrawing(geometry);
      });

      map.on('draw.update', (e: any) => {
        const geometry = e.features[0].geometry;
        saveDrawing(geometry);
      });

      map.on('draw.delete', () => {
        saveDrawing(null as any);
      });
    }
  }, [mapRef.current]);

  // Handle drawing mode
  useEffect(() => {
    if (!drawRef.current || !mapRef.current) return;

    const map = mapRef.current.getMap();

    if (isDrawing) {
      drawRef.current.deleteAll();
      drawRef.current.changeMode('draw_polygon');
      
      if (centerPoint) {
        map.flyTo({
          center: centerPoint,
          zoom: 16,
          duration: 1500
        });
      }
    } else {
      if (drawRef.current) {
        drawRef.current.changeMode('simple_select');
      }
    }
  }, [isDrawing, centerPoint]);

  // Handle drag-and-drop from sidebar
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      
      // Create layer from dropped data
      const layer = await layersService.createLayer({
        map_id: DEFAULT_MAP_ID,
        name: data.name,
        layer_type: data.layer_type,
        source_type: data.source_type,
        visible: true,
        opacity: 1.0,
        z_index: 0,
        filters: {},
        style: data.style || {},
        source_config: {}
      });

      setLayers([...layers, layer]);
      console.log('[Dashboard] Layer created from drop:', layer);
    } catch (error) {
      console.error('Failed to create layer from drop:', error);
    }
  };

  // Handle War Maps creation
  const handleWarMapsCreated = (newLayers: MapLayer[]) => {
    setLayers([...layers, ...newLayers]);
  };

  // Handle config selection
  const handleConfigSelect = async (config: MapConfiguration) => {
    setActiveConfig(config);
    
    // Load layers from config
    if (config.layer_config && Array.isArray(config.layer_config)) {
      try {
        const configLayers = await Promise.all(
          config.layer_config.map(async (layerDef: any) => {
            return await layersService.createLayer({
              map_id: DEFAULT_MAP_ID,
              ...layerDef
            });
          })
        );
        setLayers(configLayers);

        // Update map center/zoom if specified
        if (config.map_center) {
          setViewState({
            longitude: config.map_center.lng,
            latitude: config.map_center.lat,
            zoom: config.map_zoom || 11
          });
        }
      } catch (error) {
        console.error('Failed to load config layers:', error);
      }
    }
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
    <div className="relative w-full h-screen flex flex-col">
      {/* Map Tabs Bar */}
      <MapTabsBar
        activeConfigId={activeConfig?.id}
        onConfigSelect={handleConfigSelect}
        onNewConfig={() => setIsWarMapsOpen(true)}
      />

      {/* Map Canvas with Drop Zone */}
      <div
        className="flex-1 relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag-over indicator */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-blue-500/20 border-4 border-dashed border-blue-500 flex items-center justify-center pointer-events-none">
            <div className="bg-white px-8 py-4 rounded-lg shadow-2xl">
              <p className="text-2xl font-bold text-blue-600">Drop to add layer to map</p>
            </div>
          </div>
        )}

        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Layer Renderer */}
          <LayerRendererFull
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
          onAddLayer={() => setIsWarMapsOpen(true)}
        />

        {/* Drawing Control Panel */}
        {isDrawing && <DrawingControlPanel />}
      </div>

      {/* War Maps Composer Modal */}
      {isWarMapsOpen && (
        <WarMapsComposer
          isOpen={isWarMapsOpen}
          onClose={() => setIsWarMapsOpen(false)}
          mapId={DEFAULT_MAP_ID}
          existingLayers={layers}
          onLayersCreated={handleWarMapsCreated}
        />
      )}

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
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none z-40">
          <div className="bg-white px-6 py-3 rounded-lg shadow-lg">
            <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardV3;
