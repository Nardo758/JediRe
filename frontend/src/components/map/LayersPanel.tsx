/**
 * LayersPanel Component
 * Floating control panel for managing map layers
 */

import { useState } from 'react';
import { MapLayer } from '../../types/layers';
import { layersService } from '../../services/layers.service';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EyeIcon, EyeSlashIcon, TrashIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { Bars3Icon, ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/solid';

interface LayersPanelProps {
  layers: MapLayer[];
  mapId: string;
  onLayersChange: (layers: MapLayer[]) => void;
  onAddLayer?: () => void;
}

interface SortableLayerItemProps {
  layer: MapLayer;
  onToggleVisibility: (layerId: string) => void;
  onUpdateOpacity: (layerId: string, opacity: number) => void;
  onDelete: (layerId: string) => void;
  onSettings: (layerId: string) => void;
}

const SortableLayerItem: React.FC<SortableLayerItemProps> = ({
  layer,
  onToggleVisibility,
  onUpdateOpacity,
  onDelete,
  onSettings
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: layer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const getLayerIcon = () => {
    switch (layer.source_type) {
      case 'assets': return '🏢';
      case 'pipeline': return '📊';
      case 'email': return '📧';
      case 'news': return '📰';
      case 'market': return '📈';
      default: return '📍';
    }
  };

  const getLayerTypeLabel = () => {
    switch (layer.layer_type) {
      case 'pin': return 'Pins';
      case 'bubble': return 'Bubbles';
      case 'heatmap': return 'Heatmap';
      case 'boundary': return 'Boundaries';
      case 'overlay': return 'Overlay';
      default: return '';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-lg p-3 mb-2 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Layer Header */}
      <div className="flex items-center gap-2 mb-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <Bars3Icon className="w-5 h-5" />
        </div>

        {/* Layer Icon & Name */}
        <span className="text-xl">{getLayerIcon()}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{layer.name}</div>
          <div className="text-xs text-gray-500">{getLayerTypeLabel()}</div>
        </div>

        {/* Visibility Toggle */}
        <button
          onClick={() => onToggleVisibility(layer.id)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title={layer.visible ? 'Hide layer' : 'Show layer'}
        >
          {layer.visible ? (
            <EyeIcon className="w-5 h-5 text-blue-600" />
          ) : (
            <EyeSlashIcon className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => onSettings(layer.id)}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Layer settings"
        >
          <Cog6ToothIcon className="w-5 h-5 text-gray-600" />
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(layer.id)}
          className="p-1 hover:bg-red-50 rounded transition-colors"
          title="Remove layer"
        >
          <TrashIcon className="w-5 h-5 text-red-600" />
        </button>
      </div>

      {/* Opacity Slider */}
      {layer.visible && (
        <div className="flex items-center gap-2 ml-7">
          <label className="text-xs text-gray-600 w-16">Opacity:</label>
          <input
            type="range"
            min="0"
            max="100"
            value={layer.opacity * 100}
            onChange={(e) => onUpdateOpacity(layer.id, parseFloat(e.target.value) / 100)}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <span className="text-xs text-gray-600 w-8 text-right">
            {Math.round(layer.opacity * 100)}%
          </span>
        </div>
      )}
    </div>
  );
};

export const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  mapId,
  onLayersChange,
  onAddLayer
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleToggleVisibility = async (layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    try {
      const updated = await layersService.toggleLayerVisibility(layerId, !layer.visible);
      onLayersChange(layers.map(l => l.id === layerId ? updated : l));
    } catch (error) {
      console.error('Failed to toggle layer visibility:', error);
    }
  };

  const handleUpdateOpacity = async (layerId: string, opacity: number) => {
    try {
      const updated = await layersService.updateLayerOpacity(layerId, opacity);
      onLayersChange(layers.map(l => l.id === layerId ? updated : l));
    } catch (error) {
      console.error('Failed to update layer opacity:', error);
    }
  };

  const handleDelete = async (layerId: string) => {
    if (!confirm('Remove this layer from the map?')) return;

    try {
      await layersService.deleteLayer(layerId);
      onLayersChange(layers.filter(l => l.id !== layerId));
    } catch (error) {
      console.error('Failed to delete layer:', error);
    }
  };

  const handleSettings = (layerId: string) => {
    // TODO: Open layer settings modal
    console.log('Open settings for layer:', layerId);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = layers.findIndex(l => l.id === active.id);
    const newIndex = layers.findIndex(l => l.id === over.id);

    const reordered = arrayMove(layers, oldIndex, newIndex).map((layer, index) => ({
      ...layer,
      z_index: index
    }));

    onLayersChange(reordered);

    // Save to backend
    setIsReordering(true);
    try {
      await layersService.reorderLayers({
        map_id: mapId,
        layer_order: reordered.map(l => ({ id: l.id, z_index: l.z_index }))
      });
    } catch (error) {
      console.error('Failed to save layer order:', error);
    } finally {
      setIsReordering(false);
    }
  };

  if (layers.length === 0) return null;

  return (
    <div
      className={`fixed top-20 right-4 bg-white rounded-lg shadow-xl border border-gray-200 transition-all duration-300 z-50 ${
        isCollapsed ? 'w-12' : 'w-80'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        {!isCollapsed && (
          <>
            <div>
              <h3 className="font-bold text-sm text-gray-800">Map Layers</h3>
              <p className="text-xs text-gray-600">{layers.length} layer{layers.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 hover:bg-white/50 rounded transition-colors"
              title="Collapse panel"
            >
              <ChevronRightIcon className="w-4 h-4 text-gray-600" />
            </button>
          </>
        )}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-full p-2 hover:bg-white/50 rounded transition-colors"
            title="Expand panel"
          >
            <ChevronLeftIcon className="w-4 h-4 text-gray-600 mx-auto" />
          </button>
        )}
      </div>

      {/* Layer List */}
      {!isCollapsed && (
        <div className="p-3 max-h-[calc(100vh-200px)] overflow-y-auto">
          {isReordering && (
            <div className="text-xs text-blue-600 mb-2 animate-pulse">
              Saving order...
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={layers.map(l => l.id)}
              strategy={verticalListSortingStrategy}
            >
              {layers.map(layer => (
                <SortableLayerItem
                  key={layer.id}
                  layer={layer}
                  onToggleVisibility={handleToggleVisibility}
                  onUpdateOpacity={handleUpdateOpacity}
                  onDelete={handleDelete}
                  onSettings={handleSettings}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Add Layer Button */}
          {onAddLayer && (
            <button
              onClick={onAddLayer}
              className="w-full mt-2 py-2 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-md text-sm font-medium"
            >
              + Add Layer
            </button>
          )}
        </div>
      )}

      {/* Collapsed State - Layer Count Badge */}
      {isCollapsed && (
        <div className="p-2 text-center">
          <div className="text-2xl mb-1">🗺️</div>
          <div className="w-6 h-6 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center mx-auto font-bold">
            {layers.filter(l => l.visible).length}
          </div>
        </div>
      )}
    </div>
  );
};

export default LayersPanel;
