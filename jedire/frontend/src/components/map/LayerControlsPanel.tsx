import React, { useState } from 'react';

interface Layer {
  id: string;
  name: string;
  type: 'custom' | 'assets' | 'pipeline' | 'market';
  icon: string;
  active: boolean;
  opacity: number;
}

interface LayerControlsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  layers: Layer[];
  onToggleLayer: (layerId: string) => void;
  onUpdateOpacity: (layerId: string, opacity: number) => void;
  onReorderLayers: (layers: Layer[]) => void;
}

export function LayerControlsPanel({
  isOpen,
  onClose,
  layers,
  onToggleLayer,
  onUpdateOpacity,
  onReorderLayers
}: LayerControlsPanelProps) {
  const [draggedLayer, setDraggedLayer] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDragStart = (layerId: string) => {
    setDraggedLayer(layerId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetLayerId: string) => {
    if (!draggedLayer || draggedLayer === targetLayerId) return;

    const draggedIndex = layers.findIndex(l => l.id === draggedLayer);
    const targetIndex = layers.findIndex(l => l.id === targetLayerId);

    const newLayers = [...layers];
    const [removed] = newLayers.splice(draggedIndex, 1);
    newLayers.splice(targetIndex, 0, removed);

    onReorderLayers(newLayers);
    setDraggedLayer(null);
  };

  const handleShowAll = () => {
    layers.forEach(layer => {
      if (!layer.active) {
        onToggleLayer(layer.id);
      }
    });
  };

  const handleHideAll = () => {
    layers.forEach(layer => {
      if (layer.active) {
        onToggleLayer(layer.id);
      }
    });
  };

  return (
    <div className="fixed right-4 top-24 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-30">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xl">🗺️</span>
          <h3 className="font-semibold text-gray-900">War Maps Active</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Layers List */}
      <div className="max-h-96 overflow-y-auto">
        <div className="p-2 space-y-2">
          {layers.map((layer) => (
            <div
              key={layer.id}
              draggable
              onDragStart={() => handleDragStart(layer.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(layer.id)}
              className={`p-3 rounded-lg border transition-all cursor-move ${
                layer.active
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-gray-50 border-gray-200'
              } ${draggedLayer === layer.id ? 'opacity-50' : ''}`}
            >
              {/* Layer Header */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => onToggleLayer(layer.id)}
                  className="flex items-center gap-2 flex-1"
                >
                  <input
                    id={`layer-toggle-${layer.id}`}
                    name={`layerToggle${layer.id}`}
                    type="checkbox"
                    checked={layer.active}
                    onChange={() => onToggleLayer(layer.id)}
                    aria-label={`Toggle ${layer.name} layer`}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-lg">{layer.icon}</span>
                  <span className="font-medium text-gray-900">{layer.name}</span>
                  {layer.type === 'custom' && (
                    <span className="ml-auto text-xs text-gray-500">Custom</span>
                  )}
                </button>

                {/* Quick Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onToggleLayer(layer.id)}
                    className="p-1 text-gray-500 hover:text-gray-700 rounded transition-colors"
                    title={layer.active ? 'Hide layer' : 'Show layer'}
                  >
                    {layer.active ? '👁️' : '👁️‍🗨️'}
                  </button>
                  <button
                    className="p-1 text-gray-500 hover:text-gray-700 rounded transition-colors"
                    title="Layer settings"
                  >
                    ⚙️
                  </button>
                  <button
                    className="p-1 text-gray-400 cursor-grab active:cursor-grabbing"
                    title="Drag to reorder"
                  >
                    ↕️
                  </button>
                </div>
              </div>

              {/* Opacity Slider */}
              {layer.active && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>Opacity</span>
                    <span>{Math.round(layer.opacity * 100)}%</span>
                  </div>
                  <input
                    id={`layer-opacity-${layer.id}`}
                    name={`layerOpacity${layer.id}`}
                    type="range"
                    min="0"
                    max="100"
                    value={layer.opacity * 100}
                    aria-label={`${layer.name} layer opacity`}
                    onChange={(e) =>
                      onUpdateOpacity(layer.id, parseInt(e.target.value) / 100)
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-200 flex gap-2">
        <button
          onClick={handleShowAll}
          className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          Show All
        </button>
        <button
          onClick={handleHideAll}
          className="flex-1 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Hide All
        </button>
      </div>

      {/* Info */}
      <div className="px-4 pb-4">
        <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
          💡 <strong>Tip:</strong> Drag layers to change stacking order (top = shows on top)
        </div>
      </div>
    </div>
  );
}
