/**
 * Map Tabs Bar Component
 * Displays saved map configurations as tabs
 */

import { useState, useEffect } from 'react';
import { PlusIcon, XMarkIcon, StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { MapConfiguration, mapConfigsService } from '../../services/map-configs.service';

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
  const [configs, setConfigs] = useState<MapConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  useEffect(() => {
    loadConfigs();
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
      
      // If we deleted the active config, load default
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

  if (loading) {
    return (
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className="animate-pulse flex gap-2">
          <div className="h-8 w-32 bg-gray-200 rounded" />
          <div className="h-8 w-32 bg-gray-200 rounded" />
          <div className="h-8 w-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center px-4 py-2 overflow-x-auto">
        {/* Map Tabs */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {configs.map(config => {
            const isActive = config.id === activeConfigId;
            const isHovered = config.id === hoveredTab;

            return (
              <div
                key={config.id}
                className={`group relative flex items-center gap-2 px-4 py-2 rounded-t-lg cursor-pointer transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-b-2 border-blue-600'
                    : 'bg-gray-50 hover:bg-gray-100 border-b border-transparent'
                }`}
                onClick={() => onConfigSelect(config)}
                onMouseEnter={() => setHoveredTab(config.id)}
                onMouseLeave={() => setHoveredTab(null)}
              >
                {/* Icon */}
                {config.icon && (
                  <span className="text-lg">{config.icon}</span>
                )}

                {/* Name */}
                <span className={`text-sm font-medium whitespace-nowrap ${
                  isActive ? 'text-blue-700' : 'text-gray-700'
                }`}>
                  {config.name}
                </span>

                {/* Default Star */}
                {config.is_default && (
                  <StarIconSolid className="w-4 h-4 text-yellow-500" />
                )}

                {/* Hover Actions */}
                {isHovered && !isActive && (
                  <div className="flex items-center gap-1 ml-2">
                    {/* Set as Default */}
                    {!config.is_default && (
                      <button
                        onClick={(e) => handleSetDefault(e, config.id)}
                        className="p-1 hover:bg-white rounded transition-colors"
                        title="Set as default"
                      >
                        <StarIcon className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    )}

                    {/* Clone */}
                    <button
                      onClick={(e) => handleClone(e, config)}
                      className="p-1 hover:bg-white rounded transition-colors"
                      title="Duplicate"
                    >
                      <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>

                    {/* Delete */}
                    {configs.length > 1 && (
                      <button
                        onClick={(e) => handleDelete(e, config.id)}
                        className="p-1 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <XMarkIcon className="w-3.5 h-3.5 text-red-600" />
                      </button>
                    )}
                  </div>
                )}

                {/* View Count Badge */}
                {config.view_count > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                    {config.view_count}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* New Config Button */}
        <button
          onClick={onNewConfig}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ml-2"
        >
          <PlusIcon className="w-4 h-4" />
          <span>New Map</span>
        </button>
      </div>
    </div>
  );
};

export default MapTabsBar;
