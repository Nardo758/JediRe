import { useEffect } from 'react';
import MapView from '@/components/map/MapView';
import Dashboard from '@/components/dashboard/Dashboard';
import PropertyDetail from '@/components/property/PropertyDetail';
import { useAppStore } from '@/store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { propertyAPI } from '@/services/api';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function MainPage() {
  const { sidebarOpen, selectedProperty, setProperties, setIsLoading } = useAppStore();
  const { user, logout } = useAuth();
  
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
    <div className="relative w-full h-screen overflow-hidden bg-gray-100">
      {/* Dashboard Sidebar */}
      <Dashboard />

      {/* Main Map Area */}
      <div
        className={`h-full transition-all duration-300 ${
          sidebarOpen ? 'ml-96' : 'ml-16'
        } ${selectedProperty ? 'mr-[480px]' : ''}`}
      >
        <MapView />
      </div>

      {/* Property Detail Panel */}
      {selectedProperty && <PropertyDetail />}

      {/* Top Bar */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
        {/* User Info */}
        {user && (
          <div className="bg-white shadow-lg rounded-lg px-4 py-2 flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-semibold text-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-sm">
              <div className="font-semibold text-gray-900">{user.name}</div>
              <div className="text-xs text-gray-500">{user.subscription.plan}</div>
            </div>
            <button
              onClick={logout}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {useAppStore.getState().isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-[100] pointer-events-none">
          <div className="bg-white rounded-xl shadow-2xl p-6 flex items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-900 font-medium">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}
