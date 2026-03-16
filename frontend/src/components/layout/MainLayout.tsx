import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SidebarItem } from './SidebarItem';
import { MapTabsBar } from '../map/MapTabsBar';
import { CommandPanel } from './CommandPanel';
import { WarMapsComposer } from '../map/WarMapsComposer';
import { ChatOverlay } from '../chat/ChatOverlay';
import QuickSetupModal from '../onboarding/QuickSetupModal';
import { layersService } from '../../services/layers.service';
import { mapConfigsService, MapConfiguration } from '../../services/map-configs.service';
import { MapLayer } from '../../types/layers';
import api from '../../lib/api';

const DEFAULT_MAP_ID = 'default';

const F_KEY_ROUTES = [
  '/dashboard',
  '/deals',
  '/assets-owned',
  '/market-intelligence',
  '/competitive-intelligence',
  '/news-intel',
  '/opportunities',
  '/reports',
  '/settings',
];

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeConfig, setActiveConfig] = useState<MapConfiguration | null>(null);
  const [isWarMapsOpen, setIsWarMapsOpen] = useState(false);
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [commandPanelOpen, setCommandPanelOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isActivePrefix = (prefix: string) => location.pathname.startsWith(prefix);
  const isInsideDeal = location.pathname.startsWith('/deals/');

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
      setLayers([...layers, layer]);
      if (location.pathname !== '/') window.location.href = '/';
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
          config.layer_config.map(async (layerDef: any) =>
            await layersService.createLayer({ map_id: DEFAULT_MAP_ID, ...layerDef })
          )
        );
        setLayers(configLayers);
      } catch (error) {
        console.error('Failed to load config layers:', error);
      }
    }
  };

  // ⌘K — command panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPanelOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // F1–F9 keyboard shortcuts (portfolio screens only — skip if inside deal)
  useEffect(() => {
    const handleFKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return;
      if (isInsideDeal) return;
      const idx = ['F1','F2','F3','F4','F5','F6','F7','F8','F9'].indexOf(e.key);
      if (idx === -1) return;
      e.preventDefault();
      navigate(F_KEY_ROUTES[idx]);
    };
    window.addEventListener('keydown', handleFKey);
    return () => window.removeEventListener('keydown', handleFKey);
  }, [isInsideDeal, navigate]);

  useEffect(() => {
    const handler = () => setIsWarMapsOpen(true);
    window.addEventListener('open-war-maps', handler);
    return () => window.removeEventListener('open-war-maps', handler);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) { setOnboardingChecked(true); return; }
    const checkOnboarding = async () => {
      try {
        const response = await api.get('/preferences/user');
        const prefs = response.data.data;
        if (!prefs || !prefs.onboarding_completed) setShowOnboarding(true);
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
      } finally {
        setOnboardingChecked(true);
      }
    };
    checkOnboarding();
  }, []);

  const handleWarMapsCreated = (newLayers: MapLayer[]) => {
    setLayers([...layers, ...newLayers]);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <MapTabsBar
        activeConfigId={activeConfig?.id}
        onConfigSelect={handleConfigSelect}
        onNewConfig={() => setIsWarMapsOpen(true)}
        onOpenCommandPanel={() => setCommandPanelOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`bg-white border-r border-gray-200 overflow-y-auto transition-all duration-300 relative ${
            sidebarOpen ? 'w-64' : 'w-0'
          }`}
        >
          {sidebarOpen && (
            <div className="p-3 w-64">
              <div className="flex items-center justify-end mb-3">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-xs"
                  title="Collapse sidebar"
                >
                  ◀◀
                </button>
              </div>

              <nav className="space-y-0.5">
                {/* F-KEY SCREENS */}
                <div className="mb-2">
                  <h3 className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest font-mono">
                    Portfolio · F1–F9
                  </h3>
                </div>

                <SidebarItem icon="📊" label="F1  Dashboard"     path="/dashboard"                isActive={isActive('/dashboard') || isActive('/terminal')} />
                <SidebarItem icon="📋" label="F2  Pipeline"      path="/deals"        count={12}  isActive={isActivePrefix('/deals')} />
                <SidebarItem
                  icon="🏢" label="F3  Portfolio"    path="/assets-owned" count={23}
                  isActive={isActivePrefix('/assets-owned')}
                  layerConfig={{ sourceType: 'assets', layerType: 'pin', defaultStyle: { icon: '🏢', color: '#10b981', size: 'medium' } }}
                  onShowOnMap={handleShowOnMap}
                />
                <SidebarItem icon="📈" label="F4  Markets"       path="/market-intelligence"      isActive={isActivePrefix('/market-intelligence')} />
                <SidebarItem icon="🎯" label="F5  Compete"       path="/competitive-intelligence" isActive={isActivePrefix('/competitive-intelligence')} />
                <SidebarItem
                  icon="📰" label="F6  News"          path="/news-intel"   count={3}
                  isActive={isActivePrefix('/news-intel')}
                  layerConfig={{ sourceType: 'news', layerType: 'heatmap', defaultStyle: { colorScale: ['#fef3c7','#fbbf24','#f59e0b','#dc2626'], radius: 25, intensity: 1.0 } }}
                  onShowOnMap={handleShowOnMap}
                />
                <SidebarItem icon="⚡" label="F7  Opportunities" path="/opportunities"            isActive={isActivePrefix('/opportunities')} />
                <SidebarItem icon="📄" label="F8  Reports"       path="/reports"                  isActive={isActive('/reports')} />
                <SidebarItem icon="⚙️" label="F9  Settings"      path="/settings"                 isActive={isActivePrefix('/settings')} />

                {/* ⌘K hint */}
                <div className="border-t border-gray-100 mt-4 pt-3">
                  <button
                    onClick={() => setCommandPanelOpen(true)}
                    className="w-full text-left px-4 py-2 text-[10px] text-gray-400 hover:text-gray-600 font-mono transition-colors rounded hover:bg-gray-50"
                  >
                    ⌘K &nbsp; Email · Tasks · Search
                  </button>
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
        <main className="flex-1 min-w-0 overflow-y-auto p-6 pr-10">
          <Outlet context={{ layers, setLayers }} />
        </main>
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

      {/* Quick Setup Onboarding Modal */}
      {onboardingChecked && (
        <QuickSetupModal
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      {/* Command Panel */}
      <CommandPanel
        isOpen={commandPanelOpen}
        onClose={() => setCommandPanelOpen(false)}
      />

      <ChatOverlay />
    </div>
  );
};

export default MainLayout;
