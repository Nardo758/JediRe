/**
 * Drawing Toolbar
 * Tools for drawing markers, polygons, lines, circles, and text on the map
 */

import { useState } from 'react';
import {
  MapPinIcon,
  PencilSquareIcon,
  MinusIcon,
  ArrowPathIcon,
  TrashIcon,
  Square3Stack3DIcon,
  DocumentArrowDownIcon,
  ShareIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';

export type DrawMode = 
  | 'point' 
  | 'line_string' 
  | 'polygon' 
  | 'circle' 
  | 'text'
  | 'simple_select'
  | null;

interface DrawingToolbarProps {
  activeMode: DrawMode;
  onModeChange: (mode: DrawMode) => void;
  onDelete: () => void;
  onSave: () => void;
  onExport: () => void;
  onShare: () => void;
  onToggleVisibility: () => void;
  drawingsVisible: boolean;
  hasSelection: boolean;
  hasDrawings: boolean;
  isSaving?: boolean;
}

export default function DrawingToolbar({
  activeMode,
  onModeChange,
  onDelete,
  onSave,
  onExport,
  onShare,
  onToggleVisibility,
  drawingsVisible,
  hasSelection,
  hasDrawings,
  isSaving = false,
}: DrawingToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fillOpacity, setFillOpacity] = useState(0.3);

  const tools = [
    {
      id: 'point' as DrawMode,
      icon: MapPinIcon,
      label: 'Add Marker',
      description: 'Place a marker on the map',
    },
    {
      id: 'polygon' as DrawMode,
      icon: PencilSquareIcon,
      label: 'Draw Polygon',
      description: 'Draw a custom area',
    },
    {
      id: 'line_string' as DrawMode,
      icon: MinusIcon,
      label: 'Draw Line',
      description: 'Measure distance or mark route',
    },
    {
      id: 'circle' as DrawMode,
      icon: ArrowPathIcon,
      label: 'Draw Circle',
      description: 'Draw circular area',
    },
  ];

  const colors = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Green', value: '#10B981' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Yellow', value: '#F59E0B' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Cyan', value: '#06B6D4' },
  ];

  return (
    <div className="absolute top-20 left-4 z-20">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PencilSquareIcon className="w-5 h-5" />
              <span className="font-semibold">Drawing Tools</span>
            </div>
            <button
              onClick={onToggleVisibility}
              className="hover:bg-white/20 p-1 rounded transition-colors"
              title={drawingsVisible ? 'Hide drawings' : 'Show drawings'}
            >
              {drawingsVisible ? (
                <EyeIcon className="w-4 h-4" />
              ) : (
                <EyeSlashIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Drawing Tools */}
        <div className="p-3 space-y-2">
          <div className="text-xs font-medium text-gray-600 mb-2">Draw Shapes</div>
          <div className="grid grid-cols-2 gap-2">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeMode === tool.id;
              
              return (
                <button
                  key={tool.id}
                  onClick={() => onModeChange(isActive ? null : tool.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all',
                    isActive
                      ? 'bg-purple-50 border-purple-500 text-purple-700'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
                  )}
                  title={tool.description}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{tool.label}</span>
                </button>
              );
            })}
          </div>

          {/* Selection Tool */}
          <button
            onClick={() => onModeChange('simple_select')}
            className={cn(
              'w-full flex items-center gap-2 p-2 rounded-lg border transition-all text-sm',
              activeMode === 'simple_select'
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
            )}
          >
            <Square3Stack3DIcon className="w-4 h-4" />
            <span>Select & Edit</span>
          </button>
        </div>

        {/* Style Controls */}
        <div className="border-t px-3 py-3 space-y-3">
          <div className="text-xs font-medium text-gray-600">Style</div>
          
          {/* Color Picker */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">Color</label>
            <div className="grid grid-cols-8 gap-1">
              {colors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setSelectedColor(color.value)}
                  className={cn(
                    'w-6 h-6 rounded border-2 transition-all',
                    selectedColor === color.value
                      ? 'border-gray-900 scale-110'
                      : 'border-gray-300 hover:scale-105'
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Stroke Width */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">
              Line Width: {strokeWidth}px
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Fill Opacity */}
          <div>
            <label className="text-xs text-gray-600 block mb-1">
              Fill Opacity: {Math.round(fillOpacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={fillOpacity}
              onChange={(e) => setFillOpacity(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="border-t px-3 py-3 space-y-2">
          <div className="text-xs font-medium text-gray-600 mb-2">Actions</div>
          
          {/* Delete */}
          <button
            onClick={onDelete}
            disabled={!hasSelection}
            className={cn(
              'w-full flex items-center gap-2 p-2 rounded-lg text-sm transition-colors',
              hasSelection
                ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
            )}
            title="Delete selected drawing"
          >
            <TrashIcon className="w-4 h-4" />
            <span>Delete Selected</span>
          </button>

          {/* Save */}
          <button
            onClick={onSave}
            disabled={!hasDrawings || isSaving}
            className={cn(
              'w-full flex items-center justify-center gap-2 p-2 rounded-lg text-sm font-medium transition-colors',
              hasDrawings && !isSaving
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <DocumentArrowDownIcon className="w-4 h-4" />
                <span>Save Drawings</span>
              </>
            )}
          </button>

          {/* Share */}
          <button
            onClick={onShare}
            disabled={!hasDrawings}
            className={cn(
              'w-full flex items-center gap-2 p-2 rounded-lg text-sm transition-colors',
              hasDrawings
                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
            )}
            title="Share with team"
          >
            <ShareIcon className="w-4 h-4" />
            <span>Share with Team</span>
          </button>

          {/* Export */}
          <button
            onClick={onExport}
            disabled={!hasDrawings}
            className={cn(
              'w-full flex items-center gap-2 p-2 rounded-lg text-sm transition-colors',
              hasDrawings
                ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
            )}
            title="Export as GeoJSON"
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            <span>Export GeoJSON</span>
          </button>
        </div>

        {/* Tips */}
        {activeMode && (
          <div className="bg-blue-50 border-t border-blue-100 px-3 py-2">
            <div className="text-xs text-blue-800">
              {activeMode === 'point' && '💡 Click map to place marker'}
              {activeMode === 'line_string' && '💡 Click to add points, double-click to finish'}
              {activeMode === 'polygon' && '💡 Click to draw, double-click to close shape'}
              {activeMode === 'circle' && '💡 Click center, then drag to set radius'}
              {activeMode === 'simple_select' && '💡 Click shapes to select and edit'}
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {hasDrawings && (
        <div className="mt-2 bg-white rounded-lg shadow-lg px-3 py-2">
          <div className="text-xs text-gray-600">
            <span className="font-medium">{/* Drawing count will be shown here */}</span>
          </div>
        </div>
      )}
    </div>
  );
}
