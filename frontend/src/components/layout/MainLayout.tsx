import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarItem } from './SidebarItem';
import { MapTabsBar } from '../map/MapTabsBar';
import { WarMapsComposer } from '../map/WarMapsComposer';
import { ChatOverlay } from '../chat/ChatOverlay';
import { layersService } from '../../services/layers.service';
import { mapConfigsService, MapConfiguration } from '../../services/map-configs.service';
import { MapLayer } from '../../types/layers';

const DEFAULT_MAP_ID = 'default';

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    dashboard: true,
    email: false,
    pipeline: false,
    assets: false,
    intelligence: true,
    market: false,
    news: false
  });
  
  const [activeConfig, setActiveConfig] = useState<MapConfiguration | null>(null);
  const [isWarMapsOpen, setIsWarMapsOpen] = useState(false);
  const [layers, setLayers] = useState<MapLayer[]>([]);

  const isActive = (path: string) => location.pathname === path;
  const isActivePrefix = (prefix: string) => location.pathname.startsWith(prefix);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleShowOnMap = async (config: any) => {
    try {
      const layer = await layersService.createLayer({
        map_id: DEFAULT_MAP_ID,
        name: config.name,
        layer_type: config.layer_type,
        source_type: config.source_type,
        visible: true,
        opacity: config.opacity || 1.0,
        z_index: 0,
        filters: {},
        style: config.style || {},
        source_config: {}
      });

      console.log('[MainLayout] Layer created:', layer);
      setLayers([...layers, layer]);
      
      if (location.pathname !== '/') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('[MainLayout] Failed to create layer:', error);
      alert('Failed to add layer to map. Please try again.');
    }
  };

  const handleConfigSelect = async (config: MapConfiguration) => {
    setActiveConfig(config);
    
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
      } catch (error) {
        console.error('Failed to load config layers:', error);
      }
    }
  };

  useEffect(() => {
    const handler = () => setIsWarMapsOpen(true);
    window.addEventListener('open-war-maps', handler);
    return () => window.removeEventListener('open-war-maps', handler);
  }, []);

  // Handle War Maps creation
  const handleWarMapsCreated = (newLayers: MapLayer[]) => {
    setLayers([...layers, ...newLayers]);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <MapTabsBar
        activeConfigId={activeConfig?.id}
        onConfigSelect={handleConfigSelect}
        onNewConfig={() => setIsWarMapsOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`bg-white border-r border-gray-200 overflow-y-auto transition-all duration-300 relative ${
            sidebarOpen ? 'w-64' : 'w-0'
          }`}
        >
          {sidebarOpen && (
            <div className="p-4 w-64">
              <div className="flex items-center justify-end mb-4">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-xs"
                  title="Collapse sidebar"
                >
                  ◀◀
                </button>
              </div>

              <nav className="space-y-1">
                {/* CONTROL PANEL */}
                <div className="mb-4">
                  <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Control Panel
                  </h3>
                  
                  <SidebarItem
                    icon="📊"
                    label="Dashboard"
                    path="/dashboard"
                    isActive={isActive('/dashboard')}
                  />

                  {/* EMAIL */}
                  <SidebarItem
                    icon="📧"
                    label="Email"
                    count={5}
                    path="/dashboard/email"
                    isActive={isActivePrefix('/dashboard/email')}
                    layerConfig={{
                      sourceType: 'email',
                      layerType: 'pin',
                      defaultStyle: {
                        icon: '📧',
                        color: '#f59e0b',
                        size: 'small'
                      }
                    }}
                    onShowOnMap={handleShowOnMap}
                  />

                  {/* PIPELINE */}
                  <SidebarItem
                    icon="📊"
                    label="Pipeline"
                    count={12}
                    path="/deals"
                    isActive={isActivePrefix('/deals')}
                  />
                  
                  {/* ASSETS OWNED */}
                  <SidebarItem
                    icon="🏢"
                    label="Assets Owned"
                    count={23}
                    path="/assets-owned"
                    isActive={isActivePrefix('/assets-owned')}
                    layerConfig={{
                      sourceType: 'assets',
                      layerType: 'pin',
                      defaultStyle: {
                        icon: '🏢',
                        color: '#10b981',
                        size: 'medium'
                      }
                    }}
                    onShowOnMap={handleShowOnMap}
                  />
                </div>

                {/* INTELLIGENCE */}
                <div className="mb-4">
                  <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Intelligence
                  </h3>
                  
                  {/* MARKET RESEARCH */}
                  <SidebarItem
                    icon="📈"
                    label="Market Research"
                    path="/market-data"
                    isActive={isActivePrefix('/market-data')}
                    layerConfig={{
                      sourceType: 'market',
                      layerType: 'overlay',
                      defaultStyle: {
                        colorScale: ['#dcfce7', '#86efac', '#22c55e', '#15803d'],
                        opacity: 0.5
                      }
                    }}
                    onShowOnMap={handleShowOnMap}
                  />
                  
                  {/* PROPERTY COVERAGE */}
                  <SidebarItem
                    icon="🗺️"
                    label="Property Coverage"
                    path="/property-coverage"
                    isActive={isActivePrefix('/property-coverage')}
                  />
                  
                  {/* NEWS INTEL */}
                  <SidebarItem
                    icon="📰"
                    label="News Intel"
                    count={3}
                    path="/news-intel"
                    isActive={isActivePrefix('/news-intel')}
                    layerConfig={{
                      sourceType: 'news',
                      layerType: 'heatmap',
                      defaultStyle: {
                        colorScale: ['#fef3c7', '#fbbf24', '#f59e0b', '#dc2626'],
                        radius: 25,
                        intensity: 1.0
                      }
                    }}
                    onShowOnMap={handleShowOnMap}
                  />
                </div>

                {/* TOOLS */}
                <div className="mb-4">
                  <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Tools
                  </h3>
                  
                  <SidebarItem
                    icon="🎯"
                    label="Tasks"
                    path="/tasks"
                    isActive={isActive('/tasks')}
                  />
                </div>

                {/* Other sections */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <SidebarItem
                    icon="📈"
                    label="Reports"
                    path="/reports"
                    isActive={isActive('/reports')}
                  />
                  
                  <SidebarItem
                    icon="👥"
                    label="Team"
                    path="/team"
                    isActive={isActive('/team')}
                  />
                  
                </div>
              </nav>
            </div>
          )}
        </aside>

        {/* Sidebar Toggle (when collapsed) */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-30 bg-white border border-gray-200 border-l-0 rounded-r-lg p-2 shadow-md hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors text-xs"
            title="Expand sidebar"
          >
            ▶▶
          </button>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <Outlet context={{ layers, setLayers }} />
        </main>
      </div>

      {/* War Maps Composer Modal - Global */}
      {isWarMapsOpen && (
        <WarMapsComposer
          isOpen={isWarMapsOpen}
          onClose={() => setIsWarMapsOpen(false)}
          mapId={DEFAULT_MAP_ID}
          existingLayers={layers}
          onLayersCreated={handleWarMapsCreated}
        />
      )}

      <ChatOverlay />
    </div>
  );
};

export default MainLayout;
