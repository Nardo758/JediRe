/**
 * BuildingGeneratorPanel - Quick building generation UI
 * Templates: Podium+Tower, Courtyard, L-Shape, Linear Bar
 */

import React, { useState } from 'react';
import { BuildingSection, ParcelBoundary } from '@/types/design/design3d.types';

interface BuildingGeneratorPanelProps {
  parcelBoundary: ParcelBoundary | null;
  onGenerate: (sections: BuildingSection[]) => void;
  onClose: () => void;
}

type BuildingTemplate = 'podium-tower' | 'courtyard' | 'l-shape' | 'linear' | 'custom';

interface GeneratorParams {
  targetUnits: number;
  template: BuildingTemplate;
  parkingRatio: number; // spaces per unit
  efficiency: number; // percentage
}

export const BuildingGeneratorPanel: React.FC<BuildingGeneratorPanelProps> = ({
  parcelBoundary,
  onGenerate,
  onClose,
}) => {
  const [params, setParams] = useState<GeneratorParams>({
    targetUnits: 300,
    template: 'podium-tower',
    parkingRatio: 1.5,
    efficiency: 85,
  });

  const [preview, setPreview] = useState<{
    residentialFloors: number;
    parkingFloors: number;
    footprintSF: number;
    totalGFA: number;
    height: number;
  } | null>(null);

  // Calculate building dimensions
  React.useEffect(() => {
    if (!parcelBoundary) return;

    const avgUnitSize = 850; // SF
    const totalResidentialSF = (params.targetUnits * avgUnitSize) / (params.efficiency / 100);
    const buildableArea = parcelBoundary.areaSF * 0.4; // 40% coverage
    
    // Parking calculation
    const parkingSpaces = Math.ceil(params.targetUnits * params.parkingRatio);
    const parkingSFPerSpace = 350; // includes circulation
    const parkingPerFloor = Math.floor(buildableArea / parkingSFPerSpace);
    const parkingFloors = Math.ceil(parkingSpaces / parkingPerFloor);
    
    // Residential floors
    const residentialFloors = Math.ceil(totalResidentialSF / buildableArea);
    
    // Total height (parking @ 10ft/floor, residential @ 10ft/floor)
    const totalHeight = (parkingFloors * 10) + (residentialFloors * 10);
    
    setPreview({
      residentialFloors,
      parkingFloors,
      footprintSF: Math.round(buildableArea),
      totalGFA: Math.round(totalResidentialSF + (parkingSpaces * parkingSFPerSpace)),
      height: totalHeight,
    });
  }, [params, parcelBoundary]);

  const handleGenerate = () => {
    if (!parcelBoundary || !preview) return;

    const sections: BuildingSection[] = [];
    const buildableArea = parcelBoundary.areaSF * 0.4;
    const side = Math.sqrt(buildableArea);
    const halfSide = side / 2;

    switch (params.template) {
      case 'podium-tower':
        // Parking podium (full footprint)
        sections.push({
          id: `parking-podium-${Date.now()}`,
          name: 'Parking Podium',
          geometry: {
            footprint: {
              points: [
                { x: -halfSide, y: 0, z: -halfSide },
                { x: halfSide, y: 0, z: -halfSide },
                { x: halfSide, y: 0, z: halfSide },
                { x: -halfSide, y: 0, z: halfSide },
              ],
            },
            height: preview.parkingFloors * 10,
            floors: preview.parkingFloors,
          },
          position: { x: 0, y: 0, z: 0 },
          visible: true,
        });

        // Residential tower (70% footprint, centered)
        const towerSide = side * 0.7;
        const towerHalfSide = towerSide / 2;
        sections.push({
          id: `residential-tower-${Date.now()}`,
          name: 'Residential Tower',
          geometry: {
            footprint: {
              points: [
                { x: -towerHalfSide, y: 0, z: -towerHalfSide },
                { x: towerHalfSide, y: 0, z: -towerHalfSide },
                { x: towerHalfSide, y: 0, z: towerHalfSide },
                { x: -towerHalfSide, y: 0, z: towerHalfSide },
              ],
            },
            height: preview.residentialFloors * 10,
            floors: preview.residentialFloors,
          },
          position: { x: 0, y: preview.parkingFloors * 10, z: 0 },
          visible: true,
        });
        break;

      case 'courtyard':
        // Single building with courtyard cutout
        const courtyardSize = side * 0.3;
        const courtyardHalf = courtyardSize / 2;
        
        sections.push({
          id: `courtyard-building-${Date.now()}`,
          name: 'Courtyard Building',
          geometry: {
            footprint: {
              points: [
                // Outer perimeter
                { x: -halfSide, y: 0, z: -halfSide },
                { x: halfSide, y: 0, z: -halfSide },
                { x: halfSide, y: 0, z: halfSide },
                { x: -halfSide, y: 0, z: halfSide },
                { x: -halfSide, y: 0, z: -halfSide }, // Close outer
                // Courtyard cutout (hole)
                { x: -courtyardHalf, y: 0, z: -courtyardHalf },
                { x: courtyardHalf, y: 0, z: -courtyardHalf },
                { x: courtyardHalf, y: 0, z: courtyardHalf },
                { x: -courtyardHalf, y: 0, z: courtyardHalf },
              ],
            },
            height: (preview.parkingFloors + preview.residentialFloors) * 10,
            floors: preview.parkingFloors + preview.residentialFloors,
          },
          position: { x: 0, y: 0, z: 0 },
          visible: true,
        });
        break;

      case 'l-shape':
        // L-shaped building (two wings)
        const wingWidth = side * 0.4;
        const wingLength = side * 0.8;
        
        // Horizontal wing
        sections.push({
          id: `l-wing-horizontal-${Date.now()}`,
          name: 'L-Wing Horizontal',
          geometry: {
            footprint: {
              points: [
                { x: -wingLength / 2, y: 0, z: -wingWidth / 2 },
                { x: wingLength / 2, y: 0, z: -wingWidth / 2 },
                { x: wingLength / 2, y: 0, z: wingWidth / 2 },
                { x: -wingLength / 2, y: 0, z: wingWidth / 2 },
              ],
            },
            height: (preview.parkingFloors + preview.residentialFloors) * 10,
            floors: preview.parkingFloors + preview.residentialFloors,
          },
          position: { x: 0, y: 0, z: 0 },
          visible: true,
        });

        // Vertical wing
        sections.push({
          id: `l-wing-vertical-${Date.now()}`,
          name: 'L-Wing Vertical',
          geometry: {
            footprint: {
              points: [
                { x: -wingWidth / 2, y: 0, z: -wingLength / 2 },
                { x: wingWidth / 2, y: 0, z: -wingLength / 2 },
                { x: wingWidth / 2, y: 0, z: wingLength / 2 },
                { x: -wingWidth / 2, y: 0, z: wingLength / 2 },
              ],
            },
            height: (preview.parkingFloors + preview.residentialFloors) * 10,
            floors: preview.parkingFloors + preview.residentialFloors,
          },
          position: { x: (wingLength - wingWidth) / 2, y: 0, z: 0 },
          visible: true,
        });
        break;

      case 'linear':
        // Simple linear bar building
        const linearWidth = side * 0.5;
        const linearLength = side * 1.6;
        
        sections.push({
          id: `linear-building-${Date.now()}`,
          name: 'Linear Building',
          geometry: {
            footprint: {
              points: [
                { x: -linearLength / 2, y: 0, z: -linearWidth / 2 },
                { x: linearLength / 2, y: 0, z: -linearWidth / 2 },
                { x: linearLength / 2, y: 0, z: linearWidth / 2 },
                { x: -linearLength / 2, y: 0, z: linearWidth / 2 },
              ],
            },
            height: (preview.parkingFloors + preview.residentialFloors) * 10,
            floors: preview.parkingFloors + preview.residentialFloors,
          },
          position: { x: 0, y: 0, z: 0 },
          visible: true,
        });
        break;
    }

    onGenerate(sections);
    onClose();
  };

  if (!parcelBoundary) {
    return (
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 max-w-md">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold mb-2">No Parcel Defined</h3>
          <p className="text-gray-600 mb-4">
            Please load a property boundary before generating buildings.
          </p>
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full">
      <h2 className="text-2xl font-bold mb-4">🏗️ Generate Building</h2>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Parameters */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Target Units</label>
            <input
              type="number"
              value={params.targetUnits}
              onChange={(e) => setParams({ ...params, targetUnits: parseInt(e.target.value) || 0 })}
              className="w-full border rounded px-3 py-2"
              min="10"
              step="10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Building Template</label>
            <select
              value={params.template}
              onChange={(e) => setParams({ ...params, template: e.target.value as BuildingTemplate })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="podium-tower">🏢 Podium + Tower</option>
              <option value="courtyard">🟦 Courtyard</option>
              <option value="l-shape">📐 L-Shape</option>
              <option value="linear">📏 Linear Bar</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Parking Ratio</label>
            <input
              type="number"
              value={params.parkingRatio}
              onChange={(e) => setParams({ ...params, parkingRatio: parseFloat(e.target.value) || 0 })}
              className="w-full border rounded px-3 py-2"
              min="0"
              max="3"
              step="0.1"
            />
            <div className="text-xs text-gray-500 mt-1">Spaces per unit</div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Efficiency: {params.efficiency}%</label>
            <input
              type="range"
              value={params.efficiency}
              onChange={(e) => setParams({ ...params, efficiency: parseInt(e.target.value) })}
              className="w-full"
              min="75"
              max="95"
              step="1"
            />
            <div className="text-xs text-gray-500">Net Rentable / Gross Building Area</div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Preview Metrics</h3>
          {preview && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Height:</span>
                <span className="font-medium">{preview.height} ft</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Parking Floors:</span>
                <span className="font-medium">{preview.parkingFloors}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Residential Floors:</span>
                <span className="font-medium">{preview.residentialFloors}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Stories:</span>
                <span className="font-medium">{preview.parkingFloors + preview.residentialFloors}</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between">
                <span className="text-gray-600">Footprint:</span>
                <span className="font-medium">{preview.footprintSF.toLocaleString()} SF</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total GFA:</span>
                <span className="font-medium">{preview.totalGFA.toLocaleString()} SF</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Target Units:</span>
                <span className="font-medium">{params.targetUnits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Parking Spaces:</span>
                <span className="font-medium">{Math.ceil(params.targetUnits * params.parkingRatio)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleGenerate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium"
        >
          Generate Building
        </button>
      </div>
    </div>
  );
};
