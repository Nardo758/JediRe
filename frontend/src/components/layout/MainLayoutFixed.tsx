/**
 * Main Layout with Global Horizontal Bar
 * MapTabsBar appears on all pages (as designed)
 */

import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarItem } from './SidebarItem';
import { MapTabsBar } from '../map/MapTabsBar';
import { WarMapsComposer } from '../map/WarMapsComposer';
import { layersService } from '../../services/layers.service';
import { mapConfigsService, MapConfiguration } from '../../services/map-configs.service';
import { MapLayer } from '../../types/layers';

const DEFAULT_MAP_ID = 'default';

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    dashboard: true,
    intelligence: true
  });
  
  // Global map state
  const [activeConfig, setActiveConfig] = useState<MapConfiguration | null>(null);
  const [isWarMapsOpen, setIsWarMapsOpen] = useState(false);
  const [layers, setLayers] = useState<MapLayer[]>([]);

  const isActive = (path: string) => location.pathname === path;

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Handle "Show on Map" from sidebar items
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
      
      // Navigate to dashboard if not there
      if (location.pathname !== '/') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('[MainLayout] Failed to create layer:', error);
      alert('Failed to add layer to map. Please try again.');
    }
  };

  // Handle map config selection
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

  // Handle War Maps creation
  const handleWarMapsCreated = (newLayers: MapLayer[]) => {
    setLayers([...layers, ...newLayers]);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Global Horizontal Bar - Shows on ALL pages */}
      <MapTabsBar
        activeConfigId={activeConfig?.id}
        onConfigSelect={handleConfigSelect}
        onNewConfig={() => setIsWarMapsOpen(true)}
      />

      {/* Main Content Area with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-6">
              <div className="text-2xl">🚀</div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                JEDI RE
              </h1>
            </div>

            {/* Navigation */}
            <nav className="space-y-1">
              {/* MY DEALS */}
              <div className="mb-4">
                <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  My Deals
                </h3>
                <SidebarItem
                  icon="📊"
                  label="All Deals"
                  count={12}
                  path="/deals"
                  isActive={isActive('/deals')}
                />
              </div>

              {/* DASHBOARD */}
              <div className="mb-4">
                <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Dashboard
                </h3>
                
                <SidebarItem
                  icon="📊"
                  label="Dashboard"
                  hasSubItems
                  isExpanded={expandedSections.dashboard}
                  onToggle={() => toggleSection('dashboard')}
                />
                
                {expandedSections.dashboard && (
                  <div className="ml-4 space-y-1">
                    <SidebarItem
                      icon="🏢"
                      label="Portfolio Overview"
                      count={3}
                      path="/dashboard/portfolio"
                      isActive={isActive('/dashboard/portfolio')}
                    />
                    
                    <SidebarItem
                      icon="🏢"
                      label="Assets Owned"
                      count={23}
                      path="/dashboard/assets"
                      isActive={isActive('/dashboard/assets')}
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
                    
                    <SidebarItem
                      icon="📧"
                      label="Email"
                      count={5}
                      path="/dashboard/email"
                      isActive={isActive('/dashboard/email')}
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
                    
                    <SidebarItem
                      icon="📰"
                      label="News Intelligence"
                      count={3}
                      path="/dashboard/news"
                      isActive={isActive('/dashboard/news')}
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
                )}
              </div>

              {/* INTELLIGENCE */}
              <div className="mb-4">
                <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Intelligence
                </h3>
                
                <SidebarItem
                  icon="📈"
                  label="Market Data"
                  path="/market"
                  isActive={isActive('/market')}
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
              </div>

              {/* PIPELINE */}
              <div className="mb-4">
                <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Pipeline
                </h3>
                
                <SidebarItem
                  icon="📊"
                  label="All Pipeline"
                  count={8}
                  path="/pipeline"
                  isActive={isActive('/pipeline')}
                  layerConfig={{
                    sourceType: 'pipeline',
                    layerType: 'pin',
                    defaultStyle: {
                      icon: '📊',
                      color: '#3b82f6',
                      size: 'medium'
                    }
                  }}
                  onShowOnMap={handleShowOnMap}
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
                
                <SidebarItem
                  icon="⚙️"
                  label="Settings"
                  path="/settings"
                  isActive={isActive('/settings')}
                />
              </div>
            </nav>
          </div>
        </aside>

        {/* Main Content - Each page gets the map automatically */}
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
    </div>
  );
};

export default MainLayout;
