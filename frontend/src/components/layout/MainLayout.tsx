import React, { useState } from 'react';
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
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="text-2xl">🚀</div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    JEDI RE
                  </h1>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-xs"
                  title="Collapse sidebar"
                >
                  ◀◀
                </button>
              </div>

              <nav className="space-y-1">
                {/* DASHBOARD */}
                <div className="mb-4">
                  <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Dashboard
                  </h3>
                  
                  <SidebarItem
                    icon="📊"
                    label="Dashboard"
                    path="/dashboard"
                    isActive={isActive('/dashboard')}
                  />

                  {/* EMAIL - Expandable */}
                  <SidebarItem
                    icon="📧"
                    label="Email"
                    count={5}
                    hasSubItems
                    isExpanded={expandedSections.email}
                    onToggle={() => toggleSection('email')}
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
                  
                  {expandedSections.email && (
                    <div className="ml-4 space-y-1">
                      <SidebarItem
                        icon="📥"
                        label="Inbox"
                        path="/dashboard/email"
                        isActive={isActive('/dashboard/email')}
                      />
                      <SidebarItem
                        icon="📤"
                        label="Sent"
                        path="/dashboard/email/sent"
                        isActive={isActive('/dashboard/email/sent')}
                      />
                      <SidebarItem
                        icon="📝"
                        label="Drafts"
                        path="/dashboard/email/drafts"
                        isActive={isActive('/dashboard/email/drafts')}
                      />
                      <SidebarItem
                        icon="🚩"
                        label="Flagged"
                        path="/dashboard/email/flagged"
                        isActive={isActive('/dashboard/email/flagged')}
                      />
                    </div>
                  )}

                  {/* PIPELINE - Expandable */}
                  <SidebarItem
                    icon="📊"
                    label="Pipeline"
                    count={12}
                    hasSubItems
                    isExpanded={expandedSections.pipeline}
                    onToggle={() => toggleSection('pipeline')}
                    path="/deals"
                    isActive={isActivePrefix('/deals')}
                  />
                  
                  {expandedSections.pipeline && (
                    <div className="ml-4 space-y-1">
                      <SidebarItem
                        icon="🔄"
                        label="Active"
                        path="/deals/active"
                        isActive={isActive('/deals/active')}
                      />
                      <SidebarItem
                        icon="✅"
                        label="Closed"
                        path="/deals/closed"
                        isActive={isActive('/deals/closed')}
                      />
                    </div>
                  )}
                  
                  {/* ASSETS OWNED - Expandable */}
                  <SidebarItem
                    icon="🏢"
                    label="Assets Owned"
                    count={23}
                    hasSubItems
                    isExpanded={expandedSections.assets}
                    onToggle={() => toggleSection('assets')}
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
                  
                  {expandedSections.assets && (
                    <div className="ml-4 space-y-1">
                      <SidebarItem
                        icon="📊"
                        label="Performance"
                        path="/assets-owned/performance"
                        isActive={isActive('/assets-owned/performance')}
                      />
                      <SidebarItem
                        icon="📄"
                        label="Documents"
                        path="/assets-owned/documents"
                        isActive={isActive('/assets-owned/documents')}
                      />
                      <SidebarItem
                        icon="📈"
                        label="Grid View"
                        path="/assets-owned/grid"
                        isActive={isActive('/assets-owned/grid')}
                      />
                    </div>
                  )}
                </div>

                {/* INTELLIGENCE */}
                <div className="mb-4">
                  <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Intelligence
                  </h3>
                  
                  {/* MARKET DATA - Expandable */}
                  <SidebarItem
                    icon="📈"
                    label="Market Data"
                    hasSubItems
                    isExpanded={expandedSections.market}
                    onToggle={() => toggleSection('market')}
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
                  
                  {expandedSections.market && (
                    <div className="ml-4 space-y-1">
                      <SidebarItem
                        icon="📊"
                        label="Trends"
                        path="/market-data"
                        isActive={isActive('/market-data')}
                      />
                      <SidebarItem
                        icon="🔄"
                        label="Comparables"
                        path="/market-data/comparables"
                        isActive={isActive('/market-data/comparables')}
                      />
                      <SidebarItem
                        icon="👥"
                        label="Demographics"
                        path="/market-data/demographics"
                        isActive={isActive('/market-data/demographics')}
                      />
                      <SidebarItem
                        icon="📦"
                        label="Supply & Demand"
                        path="/market-data/supply-demand"
                        isActive={isActive('/market-data/supply-demand')}
                      />
                    </div>
                  )}
                  
                  {/* NEWS INTEL - Expandable */}
                  <SidebarItem
                    icon="📰"
                    label="News Intel"
                    count={3}
                    hasSubItems
                    isExpanded={expandedSections.news}
                    onToggle={() => toggleSection('news')}
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
                  
                  {expandedSections.news && (
                    <div className="ml-4 space-y-1">
                      <SidebarItem
                        icon="📋"
                        label="Event Feed"
                        path="/news-intel"
                        isActive={isActive('/news-intel')}
                      />
                      <SidebarItem
                        icon="📊"
                        label="Market Dashboard"
                        path="/news-intel/dashboard"
                        isActive={isActive('/news-intel/dashboard')}
                      />
                      <SidebarItem
                        icon="🔗"
                        label="Network Intel"
                        path="/news-intel/network"
                        isActive={isActive('/news-intel/network')}
                      />
                      <SidebarItem
                        icon="🔔"
                        label="Alerts"
                        path="/news-intel/alerts"
                        isActive={isActive('/news-intel/alerts')}
                      />
                    </div>
                  )}
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
    </div>
  );
};

export default MainLayout;
