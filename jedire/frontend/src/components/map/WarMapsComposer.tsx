/**
 * War Maps Composer Modal
 * Master layer selection and composition interface
 */

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import {
  MapIcon,
  XMarkIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { MapLayer, SourceType, LayerType, CreateLayerRequest } from '../../types/layers';
import { layersService } from '../../services/layers.service';

interface WarMapsComposerProps {
  isOpen: boolean;
  onClose: () => void;
  mapId: string;
  existingLayers: MapLayer[];
  onLayersCreated: (layers: MapLayer[]) => void;
}

interface LayerTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  source_type: SourceType;
  layer_type: LayerType;
  defaultStyle: any;
  enabled: boolean;
  opacity: number;
  estimatedCount?: number;
}

const AVAILABLE_LAYERS: LayerTemplate[] = [
  {
    id: 'assets-owned',
    name: 'Assets Owned',
    icon: '🏢',
    description: 'Your portfolio properties',
    source_type: 'assets',
    layer_type: 'pin',
    defaultStyle: {
      color: '#10b981',
      icon: '🏢',
      size: 'medium'
    },
    enabled: false,
    opacity: 1.0,
    estimatedCount: 23
  },
  {
    id: 'pipeline-deals',
    name: 'Pipeline Deals',
    icon: '📊',
    description: 'Deals in your pipeline',
    source_type: 'pipeline',
    layer_type: 'pin',
    defaultStyle: {
      color: '#3b82f6',
      icon: '📊',
      size: 'medium'
    },
    enabled: false,
    opacity: 1.0,
    estimatedCount: 8
  },
  {
    id: 'email-intel',
    name: 'Email Intelligence',
    icon: '📧',
    description: 'Properties mentioned in emails',
    source_type: 'email',
    layer_type: 'pin',
    defaultStyle: {
      color: '#f59e0b',
      icon: '📧',
      size: 'small'
    },
    enabled: false,
    opacity: 0.8,
    estimatedCount: 15
  },
  {
    id: 'news-signals',
    name: 'News Intelligence',
    icon: '📰',
    description: 'High-impact news events',
    source_type: 'news',
    layer_type: 'heatmap',
    defaultStyle: {
      colorScale: ['#fef3c7', '#fbbf24', '#f59e0b', '#dc2626'],
      radius: 25,
      intensity: 1.0,
      blur: 15
    },
    enabled: false,
    opacity: 0.6,
    estimatedCount: 45
  },
  {
    id: 'deal-boundaries',
    name: 'All Deal Boundaries',
    icon: '🗺️',
    description: 'Trade areas for all deals',
    source_type: 'custom',
    layer_type: 'boundary',
    defaultStyle: {
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      strokeColor: '#2563eb',
      strokeWidth: 2
    },
    enabled: false,
    opacity: 0.7
  },
  {
    id: 'rent-overlay',
    name: 'Rent Comparison',
    icon: '💰',
    description: 'Average rent by submarket',
    source_type: 'market',
    layer_type: 'overlay',
    defaultStyle: {
      colorScale: ['#dcfce7', '#86efac', '#22c55e', '#15803d'],
      opacity: 0.5
    },
    enabled: false,
    opacity: 0.5
  },
  {
    id: 'vacancy-overlay',
    name: 'Vacancy Rate',
    icon: '📊',
    description: 'Vacancy by submarket',
    source_type: 'market',
    layer_type: 'overlay',
    defaultStyle: {
      colorScale: ['#dcfce7', '#fef3c7', '#fed7aa', '#fca5a5'],
      opacity: 0.5
    },
    enabled: false,
    opacity: 0.5
  }
];

export const WarMapsComposer: React.FC<WarMapsComposerProps> = ({
  isOpen,
  onClose,
  mapId,
  existingLayers,
  onLayersCreated
}) => {
  const [layers, setLayers] = useState<LayerTemplate[]>(AVAILABLE_LAYERS);
  const [mapName, setMapName] = useState('Untitled War Map');
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Mark existing layers as enabled
  useEffect(() => {
    if (existingLayers.length > 0) {
      setLayers(prev => prev.map(template => {
        const existing = existingLayers.find(l => l.source_type === template.source_type);
        if (existing) {
          return {
            ...template,
            enabled: existing.visible,
            opacity: existing.opacity
          };
        }
        return template;
      }));
    }
  }, [existingLayers]);

  const handleToggleLayer = (layerId: string) => {
    setLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, enabled: !l.enabled } : l
    ));
  };

  const handleOpacityChange = (layerId: string, opacity: number) => {
    setLayers(prev => prev.map(l =>
      l.id === layerId ? { ...l, opacity } : l
    ));
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const enabledLayers = layers.filter(l => l.enabled);
      const createdLayers: MapLayer[] = [];

      // Create layers on backend
      for (let i = 0; i < enabledLayers.length; i++) {
        const template = enabledLayers[i];
        
        const request: CreateLayerRequest = {
          map_id: mapId,
          name: template.name,
          layer_type: template.layer_type,
          source_type: template.source_type,
          visible: true,
          opacity: template.opacity,
          z_index: i, // Order by position in array
          style: template.defaultStyle,
          filters: {},
          source_config: {}
        };

        const created = await layersService.createLayer(request);
        createdLayers.push(created);
      }

      console.log(`[WarMaps] Created ${createdLayers.length} layers`);
      onLayersCreated(createdLayers);
      onClose();

    } catch (error) {
      console.error('Failed to create layers:', error);
      alert('Failed to save War Map. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = layers.filter(l => l.enabled).length;
  const totalEstimatedMarkers = layers
    .filter(l => l.enabled && l.estimatedCount)
    .reduce((sum, l) => sum + (l.estimatedCount || 0), 0);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapIcon className="w-8 h-8" />
                <div>
                  <Dialog.Title className="text-2xl font-bold">
                    War Maps Composer
                  </Dialog.Title>
                  <p className="text-blue-100 text-sm mt-1">
                    Build a comprehensive market intelligence view
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Map Name Input */}
            <div className="mt-4">
              <input
                type="text"
                value={mapName}
                onChange={(e) => setMapName(e.target.value)}
                placeholder="Untitled War Map"
                className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
          </div>

          {/* Stats Bar */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-6">
                <div>
                  <span className="font-medium text-gray-700">Selected Layers:</span>
                  <span className="ml-2 text-blue-600 font-bold">{selectedCount}</span>
                </div>
                {totalEstimatedMarkers > 0 && (
                  <div>
                    <span className="font-medium text-gray-700">Est. Markers:</span>
                    <span className="ml-2 text-purple-600 font-bold">{totalEstimatedMarkers}</span>
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={previewMode}
                  onChange={(e) => setPreviewMode(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-gray-700">Preview Mode</span>
              </label>
            </div>
          </div>

          {/* Layer List */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {layers.map(layer => (
                <div
                  key={layer.id}
                  className={`border-2 rounded-xl p-4 transition-all cursor-pointer ${
                    layer.enabled
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  onClick={() => handleToggleLayer(layer.id)}
                >
                  {/* Layer Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{layer.icon}</span>
                      <div>
                        <h3 className="font-bold text-gray-800">{layer.name}</h3>
                        <p className="text-xs text-gray-600">{layer.description}</p>
                      </div>
                    </div>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        layer.enabled
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {layer.enabled ? (
                        <CheckIcon className="w-5 h-5" />
                      ) : (
                        <div className="w-5 h-5" />
                      )}
                    </div>
                  </div>

                  {/* Layer Details */}
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="bg-gray-100 px-2 py-1 rounded">
                      {layer.layer_type}
                    </span>
                    {layer.estimatedCount !== undefined && (
                      <span>~{layer.estimatedCount} items</span>
                    )}
                  </div>

                  {/* Opacity Slider (when enabled) */}
                  {layer.enabled && (
                    <div
                      className="mt-3 pt-3 border-t border-blue-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-700 font-medium w-16">
                          Opacity:
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={layer.opacity * 100}
                          onChange={(e) =>
                            handleOpacityChange(layer.id, parseFloat(e.target.value) / 100)
                          }
                          className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <span className="text-xs text-gray-700 w-8 text-right">
                          {Math.round(layer.opacity * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <div className="flex items-center gap-3">
                {previewMode && (
                  <span className="text-sm text-gray-600">
                    Preview on map →
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={selectedCount === 0 || isSaving}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-bold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    `Create War Map (${selectedCount})`
                  )}
                </button>
              </div>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default WarMapsComposer;
