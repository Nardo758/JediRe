import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChatOverlay } from '../chat/ChatOverlay';
import { AgentStatusBar } from '../dashboard/AgentStatusBar';
import { HorizontalBar } from '../map/HorizontalBar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navigationSections = [
    {
      title: null,
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: '📊', badge: null },
      ]
    },
    {
      title: 'INTELLIGENCE LAYERS',
      items: [
        { name: 'Market Data', path: '/market-data', icon: '📊', badge: null },
        { name: 'Assets Owned', path: '/assets-owned', icon: '🏢', badge: '23' },
      ]
    },
    {
      title: 'DEAL MANAGEMENT',
      items: [
        { name: 'Pipeline', path: '/deals', icon: '📁', badge: '8' },
      ]
    },
    {
      title: 'TOOLS',
      items: [
        { name: 'Email', path: '/email', icon: '📧', badge: '5' },
        { name: 'Reports', path: '/reports', icon: '📈', badge: null },
        { name: 'Team', path: '/team', icon: '👥', badge: null },
        { name: 'Architecture', path: '/architecture', icon: '🏗️', badge: null },
      ]
    },
    {
      title: null,
      items: [
        { name: 'Settings', path: '/settings', icon: '⚙️', badge: null },
      ],
      subitems: [
        { name: 'Module Marketplace', path: '/settings/modules', icon: '🛒', badge: 'NEW' },
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
          <button className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg">
            <span className="text-2xl">👤</span>
            <span className="hidden md:block text-sm font-medium">Leon D</span>
          </button>
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
                  {section.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
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
                          {item.badge && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-600 rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
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
          {/* Horizontal Bar (Map Layers) - Show on dashboard and map pages */}
          {(location.pathname === '/dashboard' || location.pathname === '/map') && (
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
