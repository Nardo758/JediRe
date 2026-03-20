/**
 * BuildingDiagram3D Component
 * Interactive 3D building visualization with floor-by-floor unit details
 * Requires: npm install three @types/three @react-three/fiber @react-three/drei
 */

import React, { useState, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, PerspectiveCamera } from '@react-three/drei';

// Types
export interface Unit3D {
  unitNumber: string;
  floor: number;
  position: { x: number; y: number; z: number };
  size: { width: number; length: number; height: number };
  status: 'vacant' | 'occupied' | 'notice';
  rent: number;
  tenant?: string;
  leaseExpiry?: string;
}

export interface Building3DModel {
  floors: number;
  units: Unit3D[];
  amenities: Array<{
    name: string;
    position: { x: number; y: number; z: number };
  }>;
}

interface BuildingDiagram3DProps {
  buildingData: Building3DModel;
  onUnitClick?: (unit: Unit3D) => void;
}

// Color mapping for unit status
const STATUS_COLORS = {
  vacant: '#ef4444', // red
  occupied: '#22c55e', // green
  notice: '#eab308', // yellow
};

// Individual Unit Component
const Unit3DComponent: React.FC<{
  unit: Unit3D;
  onClick: () => void;
  isHovered: boolean;
  onHover: (hover: boolean) => void;
}> = ({ unit, onClick, isHovered, onHover }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current && isHovered) {
      meshRef.current.scale.setScalar(1.05);
    } else if (meshRef.current) {
      meshRef.current.scale.setScalar(1);
    }
  });

  const color = STATUS_COLORS[unit.status];

  return (
    <mesh
      ref={meshRef}
      position={[unit.position.x, unit.position.y, unit.position.z]}
      onClick={onClick}
      onPointerOver={() => onHover(true)}
      onPointerOut={() => onHover(false)}
    >
      <boxGeometry args={[unit.size.width, unit.size.height, unit.size.length]} />
      <meshStandardMaterial color={color} opacity={0.8} transparent />
      {isHovered && (
        <Html distanceFactor={10}>
          <div className="bg-white p-2 rounded shadow-lg text-xs whitespace-nowrap border border-gray-200">
            <div className="font-bold">{unit.unitNumber}</div>
            <div>Floor {unit.floor}</div>
            <div className="capitalize text-gray-600">{unit.status}</div>
            <div>${unit.rent}/mo</div>
          </div>
        </Html>
      )}
    </mesh>
  );
};

// Building Structure Component
const BuildingStructure: React.FC<{
  floors: number;
  units: Unit3D[];
  onUnitClick: (unit: Unit3D) => void;
}> = ({ floors, units, onUnitClick }) => {
  const [hoveredUnit, setHoveredUnit] = useState<string | null>(null);

  // Building frame
  const floorHeight = 3;
  const buildingHeight = floors * floorHeight;

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#e5e7eb" />
      </mesh>

      {/* Building floors (wireframe) */}
      {Array.from({ length: floors }).map((_, i) => (
        <mesh
          key={`floor-${i}`}
          position={[0, i * floorHeight, 0]}
        >
          <boxGeometry args={[20, 0.2, 15]} />
          <meshBasicMaterial color="#9ca3af" wireframe />
        </mesh>
      ))}

      {/* Units */}
      {units.map((unit) => (
        <Unit3DComponent
          key={unit.unitNumber}
          unit={unit}
          onClick={() => onUnitClick(unit)}
          isHovered={hoveredUnit === unit.unitNumber}
          onHover={(hover) => setHoveredUnit(hover ? unit.unitNumber : null)}
        />
      ))}
    </group>
  );
};

// Main Component
export const BuildingDiagram3D: React.FC<BuildingDiagram3DProps> = ({
  buildingData,
  onUnitClick,
}) => {
  const [selectedUnit, setSelectedUnit] = useState<Unit3D | null>(null);
  const [showFloor, setShowFloor] = useState<number | 'all'>('all');
  const [viewMode, setViewMode] = useState<'3d' | 'site'>('3d');

  const filteredUnits = useMemo(() => {
    if (showFloor === 'all') return buildingData.units;
    return buildingData.units.filter((unit) => unit.floor === showFloor);
  }, [buildingData.units, showFloor]);

  const handleUnitClick = (unit: Unit3D) => {
    setSelectedUnit(unit);
    onUnitClick?.(unit);
  };

  const handleExport = () => {
    // TODO: Implement canvas snapshot export
    alert('Export functionality coming soon!');
  };

  return (
    <div className="building-diagram-3d bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      {/* Controls Panel */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Floor:</label>
            <select
              value={showFloor}
              onChange={(e) =>
                setShowFloor(e.target.value === 'all' ? 'all' : parseInt(e.target.value))
              }
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="all">All Floors</option>
              {Array.from({ length: buildingData.floors }).map((_, i) => (
                <option key={i} value={i + 1}>
                  Floor {i + 1}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1 rounded text-sm font-medium ${
                viewMode === '3d'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              3D View
            </button>
            <button
              onClick={() => setViewMode('site')}
              className={`px-3 py-1 rounded text-sm font-medium ${
                viewMode === 'site'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Site Plan
            </button>
          </div>

          <button
            onClick={handleExport}
            className="px-4 py-1 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700"
          >
            Export Snapshot
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-200">
          <span className="text-xs font-medium text-gray-600">Status:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: STATUS_COLORS.occupied }}></div>
            <span className="text-xs text-gray-700">Occupied</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: STATUS_COLORS.vacant }}></div>
            <span className="text-xs text-gray-700">Vacant</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: STATUS_COLORS.notice }}></div>
            <span className="text-xs text-gray-700">Notice</span>
          </div>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="relative" style={{ height: '600px' }}>
        <Canvas>
          <PerspectiveCamera makeDefault position={[30, 20, 30]} />
          <OrbitControls />
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <BuildingStructure
            floors={buildingData.floors}
            units={filteredUnits}
            onUnitClick={handleUnitClick}
          />
        </Canvas>
      </div>

      {/* Unit Detail Panel */}
      {selectedUnit && (
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-gray-900">{selectedUnit.unitNumber}</h4>
              <div className="text-sm text-gray-600 mt-2 space-y-1">
                <div>Floor: {selectedUnit.floor}</div>
                <div className="capitalize">Status: {selectedUnit.status}</div>
                <div>Rent: ${selectedUnit.rent.toLocaleString()}/month</div>
                {selectedUnit.tenant && <div>Tenant: {selectedUnit.tenant}</div>}
                {selectedUnit.leaseExpiry && <div>Lease Expires: {selectedUnit.leaseExpiry}</div>}
              </div>
            </div>
            <button
              onClick={() => setSelectedUnit(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuildingDiagram3D;
