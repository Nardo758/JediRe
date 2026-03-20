/**
 * SectionEditorPanel - Edit properties of selected building section
 * Height slider, floor count, position, visibility
 */

import React from 'react';
import { BuildingSection } from '@/types/design/design3d.types';

interface SectionEditorPanelProps {
  section: BuildingSection | null;
  onUpdate: (id: string, updates: Partial<BuildingSection>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const SectionEditorPanel: React.FC<SectionEditorPanelProps> = ({
  section,
  onUpdate,
  onDelete,
  onClose,
}) => {
  if (!section) return null;

  const handleNameChange = (name: string) => {
    onUpdate(section.id, { name });
  };

  const handleHeightChange = (height: number) => {
    onUpdate(section.id, {
      geometry: {
        ...section.geometry,
        height,
      },
    });
  };

  const handleFloorsChange = (floors: number) => {
    const floorHeight = section.geometry.height / section.geometry.floors;
    onUpdate(section.id, {
      geometry: {
        ...section.geometry,
        floors,
        height: floors * floorHeight,
      },
    });
  };

  const handlePositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    onUpdate(section.id, {
      position: {
        ...section.position,
        [axis]: value,
      },
    });
  };

  const handleVisibilityToggle = () => {
    onUpdate(section.id, { visible: !section.visible });
  };

  const handleDelete = () => {
    if (confirm(`Delete "${section.name}"?`)) {
      onDelete(section.id);
      onClose();
    }
  };

  const floorHeight = section.geometry.floors > 0 
    ? section.geometry.height / section.geometry.floors 
    : 10;

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-xl p-4 w-80">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Edit Section</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl"
        >
          ×
        </button>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={section.name || 'Unnamed Section'}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {/* Height Slider */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Height: {Math.round(section.geometry.height)} ft
          </label>
          <input
            type="range"
            value={section.geometry.height}
            onChange={(e) => handleHeightChange(parseFloat(e.target.value))}
            className="w-full"
            min="10"
            max="200"
            step="5"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>10 ft</span>
            <span>200 ft</span>
          </div>
        </div>

        {/* Floor Count */}
        <div>
          <label className="block text-sm font-medium mb-1">Floors</label>
          <input
            type="number"
            value={section.geometry.floors}
            onChange={(e) => handleFloorsChange(parseInt(e.target.value) || 1)}
            className="w-full border rounded px-3 py-2"
            min="1"
            max="50"
          />
          <div className="text-xs text-gray-500 mt-1">
            ~{Math.round(floorHeight)} ft per floor
          </div>
        </div>

        {/* Position */}
        <div>
          <label className="block text-sm font-medium mb-2">Position</label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-600">X</label>
              <input
                type="number"
                value={Math.round(section.position?.x || 0)}
                onChange={(e) => handlePositionChange('x', parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-2 py-1 text-sm"
                step="5"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Y (Height)</label>
              <input
                type="number"
                value={Math.round(section.position?.y || 0)}
                onChange={(e) => handlePositionChange('y', parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-2 py-1 text-sm"
                step="5"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Z</label>
              <input
                type="number"
                value={Math.round(section.position?.z || 0)}
                onChange={(e) => handlePositionChange('z', parseFloat(e.target.value) || 0)}
                className="w-full border rounded px-2 py-1 text-sm"
                step="5"
              />
            </div>
          </div>
        </div>

        {/* Footprint Info */}
        <div className="bg-gray-50 rounded p-3">
          <div className="text-sm font-medium mb-2">Footprint</div>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Points: {section.geometry.footprint.points.length}</div>
            <div>
              Area: {Math.round(calculateFootprintArea(section.geometry.footprint.points)).toLocaleString()} SF
            </div>
            <div>
              GFA: {Math.round(
                calculateFootprintArea(section.geometry.footprint.points) * section.geometry.floors
              ).toLocaleString()} SF
            </div>
          </div>
        </div>

        {/* Visibility Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Visible</span>
          <button
            onClick={handleVisibilityToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              section.visible ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                section.visible ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded font-medium"
        >
          🗑️ Delete Section
        </button>
      </div>
    </div>
  );
};

/**
 * Calculate footprint area using Shoelace formula
 * Uses x and z coordinates (ignoring y)
 */
function calculateFootprintArea(points: Array<{ x: number; y: number; z: number }>): number {
  if (points.length < 3) return 0;

  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].z;
    area -= points[j].x * points[i].z;
  }

  return Math.abs(area / 2);
}
