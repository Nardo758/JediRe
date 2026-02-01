import { useEffect, useState } from 'react';
import MapView from '@/components/map/MapView';
import PropertyDetail from '@/components/property/PropertyDetail';
import FiltersBar from '@/components/dashboard/FiltersBar';
import AgentStatusBar from '@/components/dashboard/AgentStatusBar';
import QuickInsights from '@/components/dashboard/QuickInsights';
import PropertyAnalyzer from '@/components/property/PropertyAnalyzer';
import SettingsPage from './SettingsPage';
import { useAppStore } from '@/store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { propertyAPI } from '@/services/api';
import { LogOut, Search, ChevronUp, ChevronDown, Building2, Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function MainPage() {
  const { selectedProperty, setProperties, setIsLoading } = useAppStore();
  const { user, logout } = useAuth();
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Initialize WebSocket connection
  useWebSocket();

  // Load initial properties
  useEffect(() => {
    const loadProperties = async () => {
      setIsLoading(true);
      try {
        const properties = await propertyAPI.list();
        setProperties(properties);
      } catch (error) {
        console.error('Failed to load properties:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProperties();
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-100 flex flex-col">
      {/* Top Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight">JEDI RE</h1>
        </div>

        <div className="flex-1 max-w-xl mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search location..."
              className="w-full pl-10 pr-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAnalyzer(!showAnalyzer)}
            className={`p-2 rounded-lg transition-colors ${showAnalyzer ? 'bg-white/30' : 'hover:bg-white/20'}`}
            title="Property Analyzer"
          >
            <Building2 className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          
          {user && (
            <div className="flex items-center gap-3 pl-3 border-l border-white/30">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-semibold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-sm hidden md:block">
                <div className="font-medium">{user.name}</div>
                <div className="text-xs text-white/70">{user.subscription.plan}</div>
              </div>
              <button
                onClick={logout}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Filters Bar */}
      <FiltersBar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Property Analyzer Sidebar */}
        {showAnalyzer && (
          <div className="w-96 bg-white border-r border-gray-200 overflow-hidden flex-shrink-0 z-20">
            <PropertyAnalyzer />
          </div>
        )}

        {/* Map Area */}
        <div className={`flex-1 relative ${selectedProperty ? 'mr-[480px]' : ''}`}>
          <MapView />

          {/* Map Legend */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 z-10">
            <div className="text-xs font-semibold text-gray-600 mb-2">Strategy Legend</div>
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Build-to-Sell</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Flip</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span>Rental</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span>Airbnb</span>
              </div>
            </div>
          </div>
        </div>

        {/* Property Detail Panel */}
        {selectedProperty && <PropertyDetail />}
      </div>

      {/* Bottom Panel Toggle */}
      <button
        onClick={() => setShowBottomPanel(!showBottomPanel)}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-white px-4 py-1 rounded-t-lg shadow-lg z-30 hover:bg-gray-50 transition-colors"
      >
        {showBottomPanel ? (
          <ChevronDown className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronUp className="w-5 h-5 text-gray-600" />
        )}
      </button>

      {/* Bottom Panels */}
      {showBottomPanel && (
        <div className="flex-shrink-0 z-20">
          <AgentStatusBar 
            alert="Interest rate decision tomorrow - Debt Agent confidence at 65%"
          />
          <QuickInsights />
        </div>
      )}

      {/* Loading Overlay */}
      {useAppStore.getState().isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[100] pointer-events-none">
          <div className="bg-white rounded-xl shadow-2xl p-6 flex items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-900 font-medium">Loading...</span>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}
    </div>
  );
}
