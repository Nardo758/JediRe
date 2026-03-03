/**
 * Building3DEditor - Main 3D Viewport Component
 * JEDI RE - Interactive 3D Building Design Tool
 * 
 * Tech Stack:
 * - Three.js + React Three Fiber
 * - @react-three/drei (helpers)
 * - Zustand (state management)
 * 
 * Features:
 * - WebGL-based 3D viewport
 * - Orbital camera controls
 * - Interactive building editing
 * - Real-time metrics display
 * - AI integration hooks (Phase 2)
 */

import React, { useRef, useState, useCallback, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Environment,
  Text,
  Html,
} from '@react-three/drei';
import * as THREE from 'three';
import { useDesign3D, useDesign3DKeyboardShortcuts, useBuildingGenerator, useAIDesignGeneration, useAIImageToTerrain } from '@/hooks/design/useDesign3D';
import {
  BuildingSection,
  ParcelBoundary,
  ZoningEnvelope,
  ContextBuilding,
} from '@/types/design/design3d.types';
import { geoJsonToParcelBoundary } from '@/utils/geoJsonToParcel';
import { useDesign3DStore } from '@/stores/design/design3d.store';
import { ScenarioEnvelopeMesh } from './ScenarioEnvelopeMesh';
import { ScenarioSelectorPanel } from './ScenarioSelectorPanel';
import { DesignReferencePanel } from './DesignReferencePanel';
import { ViewportOverlay } from './ViewportOverlay';

// ============================================================================
// Main Component
// ============================================================================

interface ZoningConstraintsInput {
  maxGba?: number;
  maxUnits?: number;
  maxStories?: number;
  parkingRequired?: number;
  appliedFar?: number;
}

interface Building3DEditorProps {
  dealId?: string;
  parcelGeometry?: any;
  fullScreen?: boolean;
  showMetricsPanel?: boolean;
  onMetricsChange?: (metrics: any) => void;
  onSave?: () => void;
  zoningConstraints?: ZoningConstraintsInput;
  onToggleAIChat?: () => void;
  onToggleReferencePanel?: () => void;
}

export const Building3DEditor: React.FC<Building3DEditorProps> = ({
  dealId,
  parcelGeometry,
  fullScreen = false,
  showMetricsPanel = true,
  onMetricsChange,
  onSave,
  zoningConstraints,
  onToggleAIChat,
  onToggleReferencePanel,
}) => {
  const { state, actions } = useDesign3D();
  const { generateSimpleBuilding, generateFromUnitMix } = useBuildingGenerator();
  const { generateDesign: aiGenerateDesign, loading: aiLoading } = useAIDesignGeneration();
  const { generateTerrain: aiImageToTerrain, loading: imageLoading } = useAIImageToTerrain();
  
  // Enable keyboard shortcuts
  useDesign3DKeyboardShortcuts();
  
  useEffect(() => {
    if (parcelGeometry) {
      const expectedId = dealId ? `parcel-${dealId}` : undefined;
      if (!state.parcelBoundary || state.parcelBoundary.id !== expectedId) {
        const parcel = geoJsonToParcelBoundary(parcelGeometry, expectedId);
        if (parcel) {
          actions.setParcelBoundary(parcel);
        }
      }
    }
  }, [parcelGeometry, dealId]);

  useEffect(() => {
    if (zoningConstraints && state.parcelBoundary) {
      const maxHeight = zoningConstraints.maxStories ? zoningConstraints.maxStories * 10 : 200;
      const envelope: ZoningEnvelope = {
        id: `zoning-${dealId || 'default'}`,
        maxHeight,
        floorAreaRatio: zoningConstraints.appliedFar ?? 0,
        buildableArea: zoningConstraints.maxGba ?? state.parcelBoundary.area ?? 0,
        setbacks: { front: 10, rear: 10, side: 5 },
        color: '#3b82f6',
        wireframe: true,
      };
      actions.setZoningEnvelope(envelope);
    }
  }, [zoningConstraints, state.parcelBoundary]);
  
  const scenarios = useDesign3DStore((s) => s.scenarios);
  const activeScenarioId = useDesign3DStore((s) => s.activeScenarioId);
  const showScenarioOverlay = useDesign3DStore((s) => s.showScenarioOverlay);

  const [showReferencePanel, setShowReferencePanel] = useState(false);
  const [pinnedOverlay, setPinnedOverlay] = useState<{ url: string; name: string } | null>(null);
  
  // File input ref for image upload
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  // ============================================================================
  // Event Handlers
  // ============================================================================
  
  const handleAddSimpleBuilding = useCallback(() => {
    if (!state.parcelBoundary) {
      alert('Please set a parcel boundary first');
      return;
    }
    generateSimpleBuilding(state.parcelBoundary, 100);
  }, [state.parcelBoundary, generateSimpleBuilding]);
  
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (state.parcelBoundary) {
      await aiImageToTerrain({
        image: file,
        parcelId: state.parcelBoundary.id,
        options: { enhanceDetail: true, extractContours: true },
      });
    }
  }, [state.parcelBoundary, aiImageToTerrain]);
  
  const handleAIGenerate = useCallback(() => {
    if (onToggleAIChat) {
      onToggleAIChat();
    }
  }, [onToggleAIChat]);
  
  // ============================================================================
  // Render
  // ============================================================================
  
  return (
    <div className="building-3d-editor relative w-full h-screen bg-gray-900">
      {/* Hidden file input for image upload */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
      
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [50, 50, 50], fov: 50 }}
        shadows
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={<LoadingFallback />}>
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[50, 50, 25]}
            intensity={0.8}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <directionalLight position={[-50, 30, -25]} intensity={0.3} />
          
          {/* Environment */}
          <Environment preset="city" />
          
          {/* Grid Floor */}
          {state.showGrid && (
            <Grid
              args={[200, 200]}
              cellSize={5}
              cellThickness={0.5}
              cellColor="#6b7280"
              sectionSize={20}
              sectionThickness={1}
              sectionColor="#9ca3af"
              fadeDistance={400}
              fadeStrength={1}
              followCamera={false}
            />
          )}
          
          {/* Parcel Boundary */}
          {state.showParcel && state.parcelBoundary && (
            <ParcelMesh parcel={state.parcelBoundary} />
          )}
          
          {/* Zoning Envelope */}
          {state.showZoningEnvelope && state.zoningEnvelope && (
            <ZoningEnvelopeMesh envelope={state.zoningEnvelope} />
          )}
          
          {/* Building Sections */}
          {state.buildingSections.map((section) => (
            <BuildingSectionMesh
              key={section.id}
              section={section}
              isSelected={section.id === state.selectedSectionId}
              isHovered={section.id === state.hoveredSectionId}
              onSelect={() => actions.selectSection(section.id)}
              onHover={(hovering) =>
                actions.hoverSection(hovering ? section.id : null)
              }
            />
          ))}
          
          {/* Context Buildings */}
          {state.showContextBuildings &&
            state.contextBuildings.map((building) => (
              <ContextBuildingMesh key={building.id} building={building} />
            ))}
          
          {/* Scenario Envelopes */}
          {showScenarioOverlay && state.parcelBoundary && scenarios.map((scenario) => (
            <ScenarioEnvelopeMesh
              key={scenario.id}
              scenario={scenario}
              parcel={state.parcelBoundary!}
              isActive={scenario.id === activeScenarioId}
            />
          ))}
          
          {/* Viewport Overlay (pinned reference image) */}
          {pinnedOverlay && (
            <ViewportOverlay
              imageUrl={pinnedOverlay.url}
              fileName={pinnedOverlay.name}
              onRemove={() => setPinnedOverlay(null)}
            />
          )}
          
          {/* Camera Controls */}
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.05}
            minDistance={10}
            maxDistance={500}
            maxPolarAngle={Math.PI / 2}
          />
          
          {/* Helper Gizmo */}
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport
              axisColors={['#ef4444', '#22c55e', '#3b82f6']}
              labelColor="white"
            />
          </GizmoHelper>
        </Suspense>
      </Canvas>
      
      <VerticalToolbar
        onAddBuilding={handleAddSimpleBuilding}
        onAIGenerate={onToggleAIChat || handleAIGenerate}
        onImageUpload={() => imageInputRef.current?.click()}
        onToggleGrid={actions.toggleGrid}
        onToggleMeasurements={actions.toggleMeasurements}
        onToggleParcel={actions.toggleParcel}
        onToggleZoning={actions.toggleZoningEnvelope}
        onToggleContext={actions.toggleContextBuildings}
        onToggleReferencePanel={onToggleReferencePanel || (() => setShowReferencePanel(!showReferencePanel))}
        onUndo={actions.undo}
        onRedo={actions.redo}
        canUndo={actions.canUndo}
        canRedo={actions.canRedo}
        showGrid={state.showGrid}
        showMeasurements={state.showMeasurements}
        showParcel={state.showParcel}
        showZoningEnvelope={state.showZoningEnvelope}
        showContextBuildings={state.showContextBuildings}
        aiLoading={aiLoading || imageLoading}
        editMode={state.editMode}
      />

      {/* Scenario Selector Panel */}
      <ScenarioSelectorPanel />

      {/* Design Reference Panel */}
      {dealId && (
        <DesignReferencePanel
          dealId={dealId}
          isOpen={showReferencePanel}
          onToggle={onToggleReferencePanel || (() => setShowReferencePanel(!showReferencePanel))}
          onPinToViewport={(ref) => {
            setPinnedOverlay({
              url: `/api/v1/design-references/file/${ref.file_path}`,
              name: ref.file_name,
            });
          }}
        />
      )}
    </div>
  );
};

// ============================================================================
// 3D Mesh Components
// ============================================================================

/**
 * Parcel Boundary Mesh - Extruded polygon showing site boundaries
 */
const ParcelMesh: React.FC<{ parcel: ParcelBoundary }> = ({ parcel }) => {
  const shape = new THREE.Shape();
  
  if (parcel.coordinates.length > 0) {
    // Convert lat/lng to local x/z coordinates (simplified)
    const localCoords = parcel.coordinates.map((coord, i) => ({
      x: (coord.lng - parcel.coordinates[0].lng) * 364000, // ~111km per degree * 1000m * 3.28ft
      z: (coord.lat - parcel.coordinates[0].lat) * 364000,
    }));
    
    shape.moveTo(localCoords[0].x, localCoords[0].z);
    localCoords.slice(1).forEach((coord) => shape.lineTo(coord.x, coord.z));
    shape.closePath();
  }
  
  const extrudeSettings = {
    depth: parcel.extrusionHeight || 2,
    bevelEnabled: false,
  };
  
  return (
    <mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial
        color={parcel.color || '#10b981'}
        opacity={parcel.opacity || 0.3}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

/**
 * Zoning Envelope Mesh - Wireframe box showing buildable volume
 */
const ZoningEnvelopeMesh: React.FC<{ envelope: ZoningEnvelope }> = ({
  envelope,
}) => {
  return (
    <mesh position={[0, envelope.maxHeight / 2, 0]}>
      <boxGeometry args={[100, envelope.maxHeight, 100]} />
      <meshBasicMaterial
        color={envelope.color || '#3b82f6'}
        wireframe={envelope.wireframe !== false}
        transparent
        opacity={0.2}
      />
    </mesh>
  );
};

/**
 * Building Section Mesh - Interactive 3D building mass
 */
interface BuildingSectionMeshProps {
  section: BuildingSection;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
}

const BuildingSectionMesh: React.FC<BuildingSectionMeshProps> = ({
  section,
  isSelected,
  isHovered,
  onSelect,
  onHover,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Create shape from footprint
  const shape = new THREE.Shape();
  const points = section.geometry.footprint.points;
  
  if (points.length > 0) {
    shape.moveTo(points[0].x, points[0].z);
    points.slice(1).forEach((p) => shape.lineTo(p.x, p.z));
    shape.closePath();
  }
  
  const extrudeSettings = {
    depth: section.geometry.height,
    bevelEnabled: true,
    bevelThickness: 0.5,
    bevelSize: 0.5,
    bevelSegments: 1,
  };
  
  // Color based on state
  let color = '#6366f1'; // Default: indigo
  if (isSelected) color = '#ef4444'; // Selected: red
  else if (isHovered) color = '#f59e0b'; // Hovered: amber
  
  return (
    <mesh
      ref={meshRef}
      position={[section.position.x, 0, section.position.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHover(false);
      }}
    >
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial
        color={color}
        metalness={0.1}
        roughness={0.8}
        transparent={isHovered}
        opacity={isHovered ? 0.8 : 1}
      />
      
      {/* Label */}
      {section.visible && (
        <Html position={[0, section.geometry.height / 2 + 5, 0]} center>
          <div className="bg-gray-900 text-white px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none">
            {section.name} ({section.geometry.floors} floors)
          </div>
        </Html>
      )}
    </mesh>
  );
};

/**
 * Context Building Mesh - Placeholder boxes for nearby buildings
 */
const ContextBuildingMesh: React.FC<{ building: ContextBuilding }> = ({
  building,
}) => {
  return (
    <mesh
      position={[
        building.position.x,
        building.dimensions.height / 2,
        building.position.z,
      ]}
      receiveShadow
    >
      <boxGeometry
        args={[
          building.dimensions.width,
          building.dimensions.height,
          building.dimensions.depth,
        ]}
      />
      <meshStandardMaterial
        color={building.color}
        opacity={building.opacity}
        transparent
      />
    </mesh>
  );
};

/**
 * Loading Fallback
 */
const LoadingFallback: React.FC = () => {
  return (
    <Html center>
      <div className="text-white text-lg">Loading 3D Scene...</div>
    </Html>
  );
};

// ============================================================================
// UI Components
// ============================================================================

interface VerticalToolbarProps {
  onAddBuilding: () => void;
  onAIGenerate: () => void;
  onImageUpload: () => void;
  onToggleGrid: () => void;
  onToggleMeasurements: () => void;
  onToggleParcel: () => void;
  onToggleZoning: () => void;
  onToggleContext: () => void;
  onToggleReferencePanel: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  showGrid: boolean;
  showMeasurements: boolean;
  showParcel: boolean;
  showZoningEnvelope: boolean;
  showContextBuildings: boolean;
  aiLoading: boolean;
  editMode: string;
}

const VerticalToolbar: React.FC<VerticalToolbarProps> = ({
  onAddBuilding,
  onAIGenerate,
  onImageUpload,
  onToggleGrid,
  onToggleMeasurements,
  onToggleParcel,
  onToggleZoning,
  onToggleContext,
  onToggleReferencePanel,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  showGrid,
  showMeasurements,
  showParcel,
  showZoningEnvelope,
  showContextBuildings,
  aiLoading,
  editMode,
}) => {
  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col bg-gray-800/95 backdrop-blur rounded-xl shadow-xl py-2 px-1 gap-0.5">
      <div className="px-1 pb-1 mb-1 border-b border-gray-700 text-[10px] text-gray-400 uppercase tracking-wider text-center">
        {editMode}
      </div>

      <VerticalToolbarButton onClick={onAddBuilding} title="Add Building" icon="+" />
      <VerticalToolbarButton onClick={onAIGenerate} title="AI Design Chat" icon="AI" disabled={aiLoading} />
      <VerticalToolbarButton onClick={onImageUpload} title="Upload Site Image" icon="IMG" disabled={aiLoading} />

      <div className="h-px bg-gray-700 my-1 mx-1" />

      <VerticalToolbarButton onClick={onToggleGrid} title="Toggle Grid (G)" icon="GR" active={showGrid} />
      <VerticalToolbarButton onClick={onToggleMeasurements} title="Toggle Measurements (M)" icon="ME" active={showMeasurements} />
      <VerticalToolbarButton onClick={onToggleParcel} title="Toggle Parcel" icon="PA" active={showParcel} />
      <VerticalToolbarButton onClick={onToggleZoning} title="Toggle Zoning Envelope" icon="ZE" active={showZoningEnvelope} />
      <VerticalToolbarButton onClick={onToggleContext} title="Toggle Context Buildings" icon="CB" active={showContextBuildings} />

      <div className="h-px bg-gray-700 my-1 mx-1" />

      <VerticalToolbarButton onClick={onToggleReferencePanel} title="Design References" icon="RF" />

      <div className="h-px bg-gray-700 my-1 mx-1" />

      <VerticalToolbarButton onClick={onUndo} title="Undo (Ctrl+Z)" icon="&#8630;" disabled={!canUndo} />
      <VerticalToolbarButton onClick={onRedo} title="Redo (Ctrl+Shift+Z)" icon="&#8631;" disabled={!canRedo} />
    </div>
  );
};

interface VerticalToolbarButtonProps {
  onClick: () => void;
  title: string;
  icon: string;
  disabled?: boolean;
  active?: boolean;
}

const VerticalToolbarButton: React.FC<VerticalToolbarButtonProps> = ({
  onClick,
  title,
  icon,
  disabled = false,
  active = false,
}) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`w-9 h-9 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
      disabled
        ? 'opacity-40 cursor-not-allowed text-gray-500'
        : active
        ? 'bg-indigo-600 text-white hover:bg-indigo-500'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`}
    dangerouslySetInnerHTML={{ __html: icon }}
  />
);

export default Building3DEditor;
