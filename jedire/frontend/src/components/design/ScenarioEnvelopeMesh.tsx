import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { DevelopmentScenario, ScenarioType } from '@/types/design/scenarios.types';
import { SCENARIO_COLORS, SCENARIO_OPACITY, SCENARIO_ACTIVE_OPACITY } from '@/types/design/scenarios.types';
import type { ParcelBoundary } from '@/types/design/design3d.types';

interface ScenarioEnvelopeMeshProps {
  scenario: DevelopmentScenario;
  parcel: ParcelBoundary;
  isActive: boolean;
}

export const ScenarioEnvelopeMesh: React.FC<ScenarioEnvelopeMeshProps> = ({
  scenario,
  parcel,
  isActive,
}) => {
  const color = SCENARIO_COLORS[scenario.type] || SCENARIO_COLORS['custom'];
  const opacity = isActive ? SCENARIO_ACTIVE_OPACITY : SCENARIO_OPACITY[scenario.type] || 0.15;

  const insetShape = useMemo(() => {
    if (parcel.coordinates.length < 3) return null;

    const localCoords = parcel.coordinates.map((coord) => ({
      x: (coord.lng - parcel.coordinates[0].lng) * 364000,
      z: (coord.lat - parcel.coordinates[0].lat) * 364000,
    }));

    const cx = localCoords.reduce((s, c) => s + c.x, 0) / localCoords.length;
    const cz = localCoords.reduce((s, c) => s + c.z, 0) / localCoords.length;

    const setbackFt = Math.max(scenario.setbacks.front, scenario.setbacks.side);
    
    const inset = localCoords.map((c) => {
      const dx = c.x - cx;
      const dz = c.z - cz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist === 0) return c;
      const scale = Math.max(0, (dist - setbackFt) / dist);
      return {
        x: cx + dx * scale,
        z: cz + dz * scale,
      };
    });

    const shape = new THREE.Shape();
    shape.moveTo(inset[0].x, inset[0].z);
    inset.slice(1).forEach((c) => shape.lineTo(c.x, c.z));
    shape.closePath();

    return shape;
  }, [parcel, scenario.setbacks]);

  if (!insetShape) return null;

  const extrudeSettings = {
    depth: scenario.maxHeight,
    bevelEnabled: false,
  };

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <extrudeGeometry args={[insetShape, extrudeSettings]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          wireframe={!isActive}
          side={THREE.DoubleSide}
        />
      </mesh>

      {isActive && (
        <Html position={[0, scenario.maxHeight + 5, 0]} center>
          <div
            className="px-3 py-1.5 rounded-lg text-white text-xs font-medium whitespace-nowrap pointer-events-none shadow-lg"
            style={{ backgroundColor: color }}
          >
            {scenario.name} - {scenario.maxStories} stories / {scenario.maxUnits} units
          </div>
        </Html>
      )}
    </group>
  );
};

export default ScenarioEnvelopeMesh;
