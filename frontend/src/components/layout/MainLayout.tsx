import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChatOverlay } from '../chat/ChatOverlay';
import { AgentStatusBar } from '../dashboard/AgentStatusBar';
import { HorizontalBar } from '../map/HorizontalBar';
import { useMapLayers } from '../../contexts/MapLayersContext';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dashboardExpanded, setDashboardExpanded] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { layers, toggleLayer } = useMapLayers();
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  const handleLayerToggle = (layerId: string, e: React.MouseEvent) => {
    // Only toggle layer if on dashboard views or map page
    if (location.pathname === '/dashboard' || location.pathname === '/dashboard/email' || location.pathname === '/map') {
      e.preventDefault();
      toggleLayer(layerId);
    }
  };

  const getLayerState = (layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    return layer?.active ?? false;
  };

  const navigationSections = [
    {
      title: null,
      items: [
        { 
          name: 'Dashboard', 
          path: '/dashboard', 
          icon: '📊', 
          badge: null, 
          layerId: null,
          expandable: true,
          subitems: [
            { name: 'Portfolio Overview', path: '/dashboard', icon: '📊', badge: null },
            { name: 'Email', path: '/dashboard/email', icon: '📧', badge: '5' },
          ]
        },
      ]
    },
    {
      title: 'INTELLIGENCE LAYERS',
      items: [
        { name: 'Market Data', path: '/market-data', icon: '📊', badge: null, layerId: null },
        { name: 'Assets Owned', path: '/assets-owned', icon: '🏢', badge: '23', layerId: 'assets-owned' },
      ]
    },
    {
      title: 'DEAL MANAGEMENT',
      items: [
        { name: 'Pipeline', path: '/deals', icon: '📁', badge: '8', layerId: 'pipeline' },
      ]
    },
    {
      title: 'TOOLS',
      items: [
        { name: 'Reports', path: '/reports', icon: '📈', badge: null },
        { name: 'Team', path: '/team', icon: '👥', badge: null },
      ]
    }
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center px-6 justify-between z-30">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            JEDI RE
          </h1>
          <div className="hidden md:block">
            <input
              type="text"
              placeholder="🔍 Search properties, deals, emails..."
              className="w-96 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <span className="text-xl">🔔</span>
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <div className="relative" ref={userMenuRef}>
            <button 
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg"
            >
              <span className="text-2xl">👤</span>
              <span className="hidden md:block text-sm font-medium">Leon D</span>
              <span className="text-gray-400 text-xs">{userMenuOpen ? '▲' : '▼'}</span>
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">Leon D</p>
                  <p className="text-xs text-gray-500">leon@example.com</p>
                </div>
                <Link
                  to="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span>⚙️</span>
                  <span>Settings</span>
                </Link>
                <Link
                  to="/settings/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span>👤</span>
                  <span>Profile</span>
                </Link>
                <Link
                  to="/settings/billing"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span>💳</span>
                  <span>Billing</span>
                </Link>
                <hr className="my-2 border-gray-100" />
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    // TODO: Add sign out logic
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <span>🚪</span>
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside
          className={`bg-white border-r border-gray-200 transition-all duration-300 ${
            sidebarCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          <nav className="p-2 space-y-4">
            {navigationSections.map((section, sectionIdx) => (
              <div key={sectionIdx}>
                {section.title && !sidebarCollapsed && (
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {section.title}
                  </div>
                )}
                <div className="space-y-1">
                  {section.items.map((item: any) => (
                    <div key={item.path}>
                      {item.expandable ? (
                        <>
                          <button
                            onClick={() => setDashboardExpanded(!dashboardExpanded)}
                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                              isActive(item.path)
                                ? 'bg-blue-50 text-blue-600 font-medium'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <span className="text-xl">{item.icon}</span>
                            {!sidebarCollapsed && (
                              <>
                                <span className="flex-1 text-left">{item.name}</span>
                                <span className="text-gray-400">
                                  {dashboardExpanded ? '▼' : '▶'}
                                </span>
                              </>
                            )}
                          </button>
                          {dashboardExpanded && !sidebarCollapsed && item.subitems && (
                            <div className="ml-8 space-y-1 mt-1">
                              {item.subitems.map((subitem: any) => (
                                <Link
                                  key={subitem.path}
                                  to={subitem.path}
                                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                                    location.pathname === subitem.path
                                      ? 'bg-blue-50 text-blue-600 font-medium'
                                      : 'text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  <span>{subitem.name}</span>
                                  {subitem.badge && (
                                    <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-600 rounded-full">
                                      {subitem.badge}
                                    </span>
                                  )}
                                </Link>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <Link
                          to={item.path}
                          onClick={(e) => item.layerId && handleLayerToggle(item.layerId, e)}
                          className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                            isActive(item.path)
                              ? 'bg-blue-50 text-blue-600 font-medium'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <span className="text-xl">{item.icon}</span>
                          {!sidebarCollapsed && (
                            <>
                              <span className="flex-1">{item.name}</span>
                              <div className="flex items-center gap-2">
                                {item.layerId && (location.pathname === '/dashboard' || location.pathname === '/dashboard/email' || location.pathname === '/map') && (
                                  <span
                                    className={`text-lg ${
                                      getLayerState(item.layerId) ? 'opacity-100' : 'opacity-30'
                                    }`}
                                    title={getLayerState(item.layerId) ? 'Layer visible on map' : 'Layer hidden'}
                                  >
                                    👁️
                                  </span>
                                )}
                                {item.badge && (
                                  <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-600 rounded-full">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute bottom-4 left-4 p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto relative flex flex-col">
          {/* Horizontal Bar (Map Layers) - Show on dashboard views and map pages */}
          {(location.pathname === '/dashboard' || location.pathname === '/dashboard/email' || location.pathname === '/map') && (
            <HorizontalBar />
          )}
          
          <div className="flex-1 overflow-auto">
            {children}
          </div>
          
          {/* Floating Chat Overlay */}
          <ChatOverlay />
        </main>
      </div>

      {/* Bottom Agent Status Bar */}
      <AgentStatusBar />
    </div>
  );
}
