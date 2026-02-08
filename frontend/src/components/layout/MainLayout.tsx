/**
 * Main Layout with Enhanced Sidebar
 * Includes layer integration for all sidebar items
 * Global MapTabsBar for all pages
 */

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarItem } from './SidebarItem';
import { MapTabsBar } from '../map/MapTabsBar';
import { layersService } from '../../services/layers.service';
import { mapConfigsService, MapConfiguration } from '../../services/map-configs.service';
import { MapLayer } from '../../types/layers';

const DEFAULT_MAP_ID = 'default';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    dashboard: true,
    intelligence: true,
    news: false
  });
  
  // Global map state
  const [activeConfig, setActiveConfig] = useState<MapConfiguration | null>(null);
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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Global Horizontal Bar - Shows on ALL pages */}
      <MapTabsBar
        activeConfigId={activeConfig?.id}
        onConfigSelect={handleConfigSelect}
        onNewConfig={() => {/* Open War Maps Composer if needed */}}
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
                    icon="📊"
                    label="Pipeline"
                    count={12}
                    path="/deals"
                    isActive={isActive('/deals')}
                  />
                  
                  <SidebarItem
                    icon="🏢"
                    label="Assets Owned"
                    count={23}
                    path="/assets"
                    isActive={isActive('/assets')}
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
              
              <SidebarItem
                icon="📰"
                label="News Intel"
                count={3}
                hasSubItems
                isExpanded={expandedSections.news}
                onToggle={() => toggleSection('news')}
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
                    path="/dashboard/news"
                    isActive={isActive('/dashboard/news')}
                  />
                  <SidebarItem
                    icon="📊"
                    label="Market Dashboard"
                    path="/dashboard/news/dashboard"
                    isActive={isActive('/dashboard/news/dashboard')}
                  />
                  <SidebarItem
                    icon="🔗"
                    label="Network Intel"
                    path="/dashboard/news/network"
                    isActive={isActive('/dashboard/news/network')}
                  />
                  <SidebarItem
                    icon="🔔"
                    label="Alerts"
                    path="/dashboard/news/alerts"
                    isActive={isActive('/dashboard/news/alerts')}
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
      </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
