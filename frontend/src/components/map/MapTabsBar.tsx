import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapConfiguration, mapConfigsService } from '../../services/map-configs.service';
import { useAuthStore } from '../../stores/authStore';

interface MapTabsBarProps {
  activeConfigId?: string;
  onConfigSelect: (config: MapConfiguration) => void;
  onNewConfig: () => void;
}

export const MapTabsBar: React.FC<MapTabsBarProps> = ({
  activeConfigId,
  onConfigSelect,
  onNewConfig
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [configs, setConfigs] = useState<MapConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadConfigs = async () => {
    try {
      const data = await mapConfigsService.getConfigs();
      setConfigs(data);
    } catch (error) {
      console.error('Failed to load map configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (e: React.MouseEvent, configId: string) => {
    e.stopPropagation();
    try {
      await mapConfigsService.setDefault(configId);
      await loadConfigs();
    } catch (error) {
      console.error('Failed to set default:', error);
    }
  };

  const handleDelete = async (e: React.MouseEvent, configId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this map configuration?')) return;
    try {
      await mapConfigsService.deleteConfig(configId);
      setConfigs(configs.filter(c => c.id !== configId));
      if (configId === activeConfigId && configs.length > 1) {
        const remaining = configs.filter(c => c.id !== configId);
        const nextConfig = remaining.find(c => c.is_default) || remaining[0];
        onConfigSelect(nextConfig);
      }
    } catch (error) {
      console.error('Failed to delete config:', error);
    }
  };

  const handleClone = async (e: React.MouseEvent, config: MapConfiguration) => {
    e.stopPropagation();
    const newName = prompt('Name for cloned map:', `${config.name} (Copy)`);
    if (!newName) return;
    try {
      const cloned = await mapConfigsService.cloneConfig(config.id, newName);
      setConfigs([...configs, cloned]);
      onConfigSelect(cloned);
    } catch (error) {
      console.error('Failed to clone config:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/deals?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  if (loading) {
    return (
      <div className="bg-white border-b border-gray-200 px-4 h-12 flex items-center">
        <div className="animate-pulse flex gap-2 flex-1">
          <div className="h-7 w-48 bg-gray-200 rounded" />
          <div className="h-7 w-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center px-3 py-1.5 gap-3">
        <form onSubmit={handleSearch} className="relative flex-shrink-0">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search deals, properties, contacts..."
            className={`pl-8 pr-3 py-1.5 text-sm rounded-lg border transition-all ${
              searchFocused
                ? 'w-72 border-blue-400 ring-2 ring-blue-100'
                : 'w-56 border-gray-300 hover:border-gray-400'
            } focus:outline-none`}
          />
        </form>

        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
          {configs.map(config => {
            const isActive = config.id === activeConfigId;
            const isHovered = config.id === hoveredTab;

            return (
              <div
                key={config.id}
                className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all text-sm whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => onConfigSelect(config)}
                onMouseEnter={() => setHoveredTab(config.id)}
                onMouseLeave={() => setHoveredTab(null)}
              >
                {config.icon && <span>{config.icon}</span>}
                <span>{config.name}</span>
                {config.is_default && (
                  <svg className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                )}

                {isHovered && !isActive && (
                  <div className="flex items-center gap-0.5 ml-1">
                    {!config.is_default && (
                      <button
                        onClick={(e) => handleSetDefault(e, config.id)}
                        className="p-0.5 hover:bg-white rounded"
                        title="Set as default"
                      >
                        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={(e) => handleClone(e, config)}
                      className="p-0.5 hover:bg-white rounded"
                      title="Duplicate"
                    >
                      <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    {configs.length > 1 && (
                      <button
                        onClick={(e) => handleDelete(e, config.id)}
                        className="p-0.5 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}

                {config.view_count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                    {config.view_count}
                  </span>
                )}
              </div>
            );
          })}

        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Notifications">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>

          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                {userInitials}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium text-gray-900 leading-tight">{user?.name || 'User'}</div>
                <div className="text-xs text-gray-500 leading-tight">{user?.subscription_tier || 'basic'}</div>
              </div>
              <svg className="w-3.5 h-3.5 text-gray-400 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-900">{user?.name || 'User'}</div>
                  <div className="text-xs text-gray-500">{user?.email || ''}</div>
                </div>
                <button
                  onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </button>
                <button
                  onClick={() => { setProfileOpen(false); navigate('/settings/modules'); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Modules
                </button>
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapTabsBar;
