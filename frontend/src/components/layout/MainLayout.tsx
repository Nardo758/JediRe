/**
 * Main Layout with Enhanced Sidebar
 * Includes layer integration for all sidebar items
 */

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarItem } from './SidebarItem';
import { layersService } from '../../services/layers.service';
import { MapLayer } from '../../types/layers';

const DEFAULT_MAP_ID = 'default';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    dashboard: true,
    intelligence: true
  });

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
      // Create layer
      const layer = await layersService.createLayer({
        map_id: DEFAULT_MAP_ID,
        name: config.name,
        layer_type: config.layer_type,
        source_type: config.source_type,
        visible: true,
        opacity: config.opacity || 1.0,
        z_index: 0, // Will auto-calculate
        filters: {},
        style: config.style || {},
        source_config: {}
      });

      console.log('[MainLayout] Layer created:', layer);
      
      // Navigate to dashboard to show the layer
      if (location.pathname !== '/') {
        window.location.href = '/';
      } else {
        // Refresh layers if already on dashboard
        window.location.reload();
      }
    } catch (error) {
      console.error('[MainLayout] Failed to create layer:', error);
      alert('Failed to add layer to map. Please try again.');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
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

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
