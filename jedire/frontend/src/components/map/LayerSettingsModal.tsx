/**
 * Layer Settings Modal
 * Advanced style editor for map layers
 */

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { Cog6ToothIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { MapLayer, PinStyle, BubbleStyle, HeatmapStyle, BoundaryStyle } from '../../types/layers';

interface LayerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  layer: MapLayer;
  onSaveSettings: (style: any) => void;
}

export const LayerSettingsModal: React.FC<LayerSettingsModalProps> = ({
  isOpen,
  onClose,
  layer,
  onSaveSettings
}) => {
  const [style, setStyle] = useState(layer.style || {});

  const handleSave = () => {
    onSaveSettings(style);
    onClose();
  };

  // Render settings based on layer type
  const renderSettings = () => {
    switch (layer.layer_type) {
      case 'pin':
        const pinStyle = style as PinStyle;
        return (
          <div className="space-y-4">
            {/* Icon Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Icon
              </label>
              <div className="grid grid-cols-6 gap-2">
                {['📍', '🏢', '📊', '📧', '📰', '🏠', '🏗️', '🏘️', '🌆', '💼', '🎯', '⭐'].map(icon => (
                  <button
                    key={icon}
                    onClick={() => setStyle({ ...pinStyle, icon })}
                    className={`text-2xl p-3 rounded-lg border-2 transition-all ${
                      pinStyle.icon === icon
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color
              </label>
              <div className="grid grid-cols-5 gap-2">
                {['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6b7280'].map(color => (
                  <button
                    key={color}
                    onClick={() => setStyle({ ...pinStyle, color })}
                    className={`h-10 rounded-lg border-2 transition-all ${
                      pinStyle.color === color
                        ? 'border-gray-800 scale-110'
                        : 'border-gray-200 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Size Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Size
              </label>
              <div className="flex gap-2">
                {['small', 'medium', 'large'].map(size => (
                  <button
                    key={size}
                    onClick={() => setStyle({ ...pinStyle, size: size as 'small' | 'medium' | 'large' })}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 capitalize transition-all ${
                      pinStyle.size === size
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'bubble':
        const bubbleStyle = style as BubbleStyle;
        return (
          <div className="space-y-4">
            {/* Metric Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Size By Metric
              </label>
              <select
                value={bubbleStyle.metric || 'value'}
                onChange={(e) => setStyle({ ...bubbleStyle, metric: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="value">Value</option>
                <option value="price">Price</option>
                <option value="units">Units</option>
                <option value="sqft">Square Feet</option>
              </select>
            </div>

            {/* Radius Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Radius Range
              </label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-600">Min</label>
                  <input
                    type="number"
                    value={bubbleStyle.minRadius || 10}
                    onChange={(e) => setStyle({ ...bubbleStyle, minRadius: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-600">Max</label>
                  <input
                    type="number"
                    value={bubbleStyle.maxRadius || 50}
                    onChange={(e) => setStyle({ ...bubbleStyle, maxRadius: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Color Scale */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color Gradient
              </label>
              <div className="space-y-2">
                {(bubbleStyle.colorScale || ['#dbeafe', '#3b82f6', '#1e40af']).map((color, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => {
                        const newScale = [...(bubbleStyle.colorScale || ['#dbeafe', '#3b82f6', '#1e40af'])];
                        newScale[index] = e.target.value;
                        setStyle({ ...bubbleStyle, colorScale: newScale });
                      }}
                      className="w-12 h-10 rounded border border-gray-300"
                    />
                    <span className="text-sm text-gray-600">
                      {index === 0 ? 'Low' : index === 1 ? 'Medium' : 'High'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'heatmap':
        const heatmapStyle = style as HeatmapStyle;
        return (
          <div className="space-y-4">
            {/* Intensity Slider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Intensity
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={heatmapStyle.intensity || 1}
                onChange={(e) => setStyle({ ...heatmapStyle, intensity: parseFloat(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>0.1</span>
                <span className="font-medium">{heatmapStyle.intensity || 1}</span>
                <span>3.0</span>
              </div>
            </div>

            {/* Radius Slider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Radius
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={heatmapStyle.radius || 20}
                onChange={(e) => setStyle({ ...heatmapStyle, radius: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>10px</span>
                <span className="font-medium">{heatmapStyle.radius || 20}px</span>
                <span>100px</span>
              </div>
            </div>

            {/* Blur Slider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Blur
              </label>
              <input
                type="range"
                min="0"
                max="50"
                value={heatmapStyle.blur || 15}
                onChange={(e) => setStyle({ ...heatmapStyle, blur: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>0</span>
                <span className="font-medium">{heatmapStyle.blur || 15}</span>
                <span>50</span>
              </div>
            </div>

            {/* Color Scale Preset */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color Preset
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'Hot', colors: ['#fef3c7', '#fbbf24', '#f59e0b', '#dc2626'] },
                  { name: 'Cool', colors: ['#dbeafe', '#60a5fa', '#3b82f6', '#1e40af'] },
                  { name: 'Green', colors: ['#dcfce7', '#86efac', '#22c55e', '#15803d'] },
                  { name: 'Purple', colors: ['#f3e8ff', '#c084fc', '#a855f7', '#7e22ce'] }
                ].map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => setStyle({ ...heatmapStyle, colorScale: preset.colors })}
                    className="px-4 py-2 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all"
                    style={{
                      background: `linear-gradient(to right, ${preset.colors.join(', ')})`
                    }}
                  >
                    <span className="text-xs font-medium text-white drop-shadow-md">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'boundary':
        const boundaryStyle = style as BoundaryStyle;
        return (
          <div className="space-y-4">
            {/* Fill Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fill Color
              </label>
              <input
                type="color"
                value={boundaryStyle.fillColor || '#3b82f6'}
                onChange={(e) => setStyle({ ...boundaryStyle, fillColor: e.target.value })}
                className="w-full h-12 rounded border border-gray-300"
              />
            </div>

            {/* Fill Opacity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fill Opacity
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={boundaryStyle.fillOpacity || 0.2}
                onChange={(e) => setStyle({ ...boundaryStyle, fillOpacity: parseFloat(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>0%</span>
                <span className="font-medium">{Math.round((boundaryStyle.fillOpacity || 0.2) * 100)}%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Stroke Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Border Color
              </label>
              <input
                type="color"
                value={boundaryStyle.strokeColor || '#2563eb'}
                onChange={(e) => setStyle({ ...boundaryStyle, strokeColor: e.target.value })}
                className="w-full h-12 rounded border border-gray-300"
              />
            </div>

            {/* Stroke Width */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Border Width
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={boundaryStyle.strokeWidth || 2}
                onChange={(e) => setStyle({ ...boundaryStyle, strokeWidth: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>0px</span>
                <span className="font-medium">{boundaryStyle.strokeWidth || 2}px</span>
                <span>10px</span>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center text-gray-500 py-8">
            No settings available for this layer type
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-xl shadow-2xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Cog6ToothIcon className="w-5 h-5 text-blue-600" />
              <Dialog.Title className="font-bold text-lg">
                {layer.name} Settings
              </Dialog.Title>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Settings */}
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {renderSettings()}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Save Changes
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default LayerSettingsModal;
