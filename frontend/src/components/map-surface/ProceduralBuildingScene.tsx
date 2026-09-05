/**
 * ═══════════════════════════════════════════════════════════════════
 * PROCEDURAL BUILDING SCENE — React Three Fiber Canvas
 * ═══════════════════════════════════════════════════════════════════
 *
 * Renders a building procedurally generated from a parcel polygon.
 * OrbitControls let the user rotate/zoom around the building.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { BuildingParameters, LocalPolygon } from '../../lib/building-engine';
import { geojsonToLocal, buildBuildingMesh } from '../../lib/building-engine';

interface ProceduralBuildingSceneProps {
  parcelBoundary: GeoJSON.Polygon;
  params: BuildingParameters;
}

/**
 * Inner scene component — has access to R3F context.
 */
function Scene({ localParcel, params }: { localParcel: LocalPolygon; params: BuildingParameters }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useThree();

  // Build / rebuild the building mesh whenever params change
  useEffect(() => {
    if (!groupRef.current) return;

    // Clear previous building
    while (groupRef.current.children.length > 0) {
      const child = groupRef.current.children[0];
      groupRef.current.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    const building = buildBuildingMesh(localParcel, params);
    groupRef.current.add(building);
  }, [localParcel, params]);

  // Compute camera target at building center, half height
  const targetY = (params.levels * params.floorHeight * 0.3048) / 2;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[20, 30, 15]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <directionalLight position={[-10, 10, -5]} intensity={0.3} color="#b0c4de" />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#555555" roughness={0.95} />
      </mesh>

      {/* Grid helper */}
      <Grid
        position={[0, 0, 0]}
        args={[200, 200]}
        cellSize={5}
        cellThickness={0.5}
        cellColor="#666666"
        sectionSize={25}
        sectionThickness={1}
        sectionColor="#888888"
        fadeDistance={150}
        fadeStrength={1.5}
        followCamera={false}
        infiniteGrid
      />

      {/* Building group */}
      <group ref={groupRef} position={[0, 0, 0]} />

      {/* Camera controls */}
      <OrbitControls
        target={[0, targetY, 0]}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={10}
        maxDistance={150}
        enableDamping
        dampingFactor={0.05}
      />

      {/* Environment for reflections on glass */}
      <Environment preset="city" />
    </>
  );
}

/**
 * Exported canvas wrapper.
 */
export const ProceduralBuildingScene: React.FC<ProceduralBuildingSceneProps> = ({
  parcelBoundary,
  params,
}) => {
  const localParcel = useMemo(() => geojsonToLocal(parcelBoundary), [parcelBoundary]);

  return (
    <div className="w-full h-full bg-gray-900">
      <Canvas
        shadows
        camera={{
          position: [30, 25, 30],
          fov: 50,
          near: 0.1,
          far: 500,
        }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor('#1a1a1a');
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <Scene localParcel={localParcel} params={params} />
      </Canvas>
    </div>
  );
};

export default ProceduralBuildingScene;
