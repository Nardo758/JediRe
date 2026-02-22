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

import React, { useRef, useState, useCallback, Suspense } from 'react';
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

// ============================================================================
// Main Component
// ============================================================================

interface Building3DEditorProps {
  dealId?: string;
  onMetricsChange?: (metrics: any) => void;
  onSave?: () => void;
}

export const Building3DEditor: React.FC<Building3DEditorProps> = ({
  dealId,
  onMetricsChange,
  onSave,
}) => {
  const { state, actions } = useDesign3D();
  const { generateSimpleBuilding, generateFromUnitMix } = useBuildingGenerator();
  const { generateDesign: aiGenerateDesign, loading: aiLoading } = useAIDesignGeneration();
  const { generateTerrain: aiImageToTerrain, loading: imageLoading } = useAIImageToTerrain();
  
  // Enable keyboard shortcuts
  useDesign3DKeyboardShortcuts();
  
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
  
  /**
   * AI IMAGE-TO-3D HOOK (Placeholder for Phase 2 Qwen Integration)
   * This will eventually send images to Qwen API for terrain/site analysis
   */
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    console.log('📸 Image uploaded:', file.name);
    
    // TODO: Phase 2 - Send to Qwen API for image-to-3D terrain generation
    // For now: Display alert with instructions
    alert(`AI Image-to-3D (Phase 2)\n\nFile: ${file.name}\n\nThis will eventually:\n1. Send image to Qwen API\n2. Extract terrain/topography\n3. Generate 3D site model\n4. Identify existing structures\n\nFor now, use manual parcel drawing.`);
    
    // Call placeholder hook
    if (state.parcelBoundary) {
      await aiImageToTerrain({
        image: file,
        parcelId: state.parcelBoundary.id,
        options: {
          enhanceDetail: true,
          extractContours: true,
        },
      });
    }
  }, [state.parcelBoundary, aiImageToTerrain]);
  
  /**
   * AI DESIGN GENERATION HOOK (Placeholder for Phase 2 Qwen Integration)
   * This will eventually send prompts like "Design 280-unit building" to Qwen
   */
  const handleAIGenerate = useCallback(async () => {
    if (!state.parcelBoundary || !state.zoningEnvelope) {
      alert('Please set parcel boundary and zoning envelope first');
      return;
    }
    
    const prompt = window.prompt(
      'AI Design Generation (Phase 2)\n\nEnter your design prompt:',
      'Design a 280-unit multifamily building with modern amenities'
    );
    
    if (!prompt) return;
    
    console.log('🤖 AI Design Prompt:', prompt);
    
    // TODO: Phase 2 - Send to Qwen API for intelligent design generation
    // For now: Use algorithmic fallback
    alert(`AI Design Generation (Phase 2)\n\nPrompt: "${prompt}"\n\nThis will eventually:\n1. Send prompt to Qwen API\n2. Analyze site constraints\n3. Generate optimal building design\n4. Provide multiple alternatives\n\nFor now, using algorithmic generation...`);
    
    await aiGenerateDesign({
      prompt,
      constraints: {
        unitCount: 280,
        minEfficiency: 82,
      },
      parcelBoundary: state.parcelBoundary,
      zoningEnvelope: state.zoningEnvelope,
    });
  }, [state.parcelBoundary, state.zoningEnvelope, aiGenerateDesign]);
  
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
      
      {/* Metrics Panel */}
      <MetricsPanel metrics={state.metrics} />
      
      {/* Toolbar */}
      <Toolbar
        onAddBuilding={handleAddSimpleBuilding}
        onAIGenerate={handleAIGenerate}
        onImageUpload={() => imageInputRef.current?.click()}
        onToggleGrid={actions.toggleGrid}
        onToggleMeasurements={actions.toggleMeasurements}
        onUndo={actions.undo}
        onRedo={actions.redo}
        canUndo={actions.canUndo}
        canRedo={actions.canRedo}
        showGrid={state.showGrid}
        showMeasurements={state.showMeasurements}
        aiLoading={aiLoading || imageLoading}
      />
      
      {/* View Settings */}
      <ViewSettings
        settings={{
          showParcel: state.showParcel,
          showZoningEnvelope: state.showZoningEnvelope,
          showContextBuildings: state.showContextBuildings,
          showGrid: state.showGrid,
          showMeasurements: state.showMeasurements,
        }}
        onToggleParcel={actions.toggleParcel}
        onToggleZoning={actions.toggleZoningEnvelope}
        onToggleContext={actions.toggleContextBuildings}
        onToggleGrid={actions.toggleGrid}
        onToggleMeasurements={actions.toggleMeasurements}
      />
      
      {/* Edit Mode Indicator */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg">
        Mode: <span className="font-bold uppercase">{state.editMode}</span>
      </div>
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
    <mesh position={[0, -1, 0]} receiveShadow>
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
      position={[section.position.x, section.geometry.height / 2, section.position.z]}
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

/**
 * Metrics Display Panel
 */
interface MetricsPanelProps {
  metrics: any;
}

const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics }) => {
  return (
    <div className="absolute top-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg min-w-[200px]">
      <h3 className="font-bold text-lg mb-3 border-b border-gray-700 pb-2">
        Building Metrics
      </h3>
      
      <div className="space-y-2 text-sm">
        <MetricRow label="Units" value={metrics.unitCount} />
        <MetricRow
          label="Total SF"
          value={metrics.totalSF.toLocaleString()}
        />
        <MetricRow
          label="Parking"
          value={`${metrics.parkingSpaces} spaces`}
        />
        <MetricRow
          label="Height"
          value={`${metrics.height.feet}' (${metrics.height.stories} stories)`}
        />
        <MetricRow
          label="Coverage"
          value={`${metrics.coverage.percentage}%`}
        />
        <MetricRow label="FAR" value={metrics.far.toFixed(2)} />
        <MetricRow label="Efficiency" value={`${metrics.efficiency}%`} />
      </div>
    </div>
  );
};

const MetricRow: React.FC<{ label: string; value: string | number }> = ({
  label,
  value,
}) => (
  <div className="flex justify-between items-center">
    <span className="text-gray-400">{label}:</span>
    <span className="font-semibold">{value}</span>
  </div>
);

/**
 * Toolbar with actions
 */
interface ToolbarProps {
  onAddBuilding: () => void;
  onAIGenerate: () => void;
  onImageUpload: () => void;
  onToggleGrid: () => void;
  onToggleMeasurements: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  showGrid: boolean;
  showMeasurements: boolean;
  aiLoading: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onAddBuilding,
  onAIGenerate,
  onImageUpload,
  onToggleGrid,
  onToggleMeasurements,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  showGrid,
  showMeasurements,
  aiLoading,
}) => {
  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
      <ToolbarButton onClick={onAddBuilding} title="Add Simple Building">
        ➕ Add
      </ToolbarButton>
      
      <div className="w-px h-6 bg-gray-600" />
      
      <ToolbarButton
        onClick={onAIGenerate}
        title="AI Design Generation (Phase 2)"
        disabled={aiLoading}
      >
        🤖 AI Design
      </ToolbarButton>
      
      <ToolbarButton
        onClick={onImageUpload}
        title="Upload Site Image (Phase 2)"
        disabled={aiLoading}
      >
        📸 Upload Image
      </ToolbarButton>
      
      <div className="w-px h-6 bg-gray-600" />
      
      <ToolbarButton
        onClick={onToggleGrid}
        title="Toggle Grid (G)"
        active={showGrid}
      >
        ⊞ Grid
      </ToolbarButton>
      
      <ToolbarButton
        onClick={onToggleMeasurements}
        title="Toggle Measurements (M)"
        active={showMeasurements}
      >
        📏 Measure
      </ToolbarButton>
      
      <div className="w-px h-6 bg-gray-600" />
      
      <ToolbarButton
        onClick={onUndo}
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
      >
        ↶ Undo
      </ToolbarButton>
      
      <ToolbarButton
        onClick={onRedo}
        title="Redo (Ctrl+Shift+Z)"
        disabled={!canRedo}
      >
        ↷ Redo
      </ToolbarButton>
    </div>
  );
};

interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  title,
  children,
  disabled = false,
  active = false,
}) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
      disabled
        ? 'opacity-50 cursor-not-allowed'
        : active
        ? 'bg-indigo-600 hover:bg-indigo-700'
        : 'hover:bg-gray-700'
    }`}
  >
    {children}
  </button>
);

/**
 * View Settings Panel
 */
interface ViewSettingsProps {
  settings: {
    showParcel: boolean;
    showZoningEnvelope: boolean;
    showContextBuildings: boolean;
    showGrid: boolean;
    showMeasurements: boolean;
  };
  onToggleParcel: () => void;
  onToggleZoning: () => void;
  onToggleContext: () => void;
  onToggleGrid: () => void;
  onToggleMeasurements: () => void;
}

const ViewSettings: React.FC<ViewSettingsProps> = ({
  settings,
  onToggleParcel,
  onToggleZoning,
  onToggleContext,
  onToggleGrid,
  onToggleMeasurements,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="absolute top-4 left-4 bg-gray-800 text-white rounded-lg shadow-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 font-medium hover:bg-gray-700 transition-colors flex items-center justify-between"
      >
        <span>👁️ View Settings</span>
        <span>{isOpen ? '▼' : '▶'}</span>
      </button>
      
      {isOpen && (
        <div className="px-4 py-3 space-y-2 border-t border-gray-700">
          <SettingCheckbox
            label="Show Parcel"
            checked={settings.showParcel}
            onChange={onToggleParcel}
          />
          <SettingCheckbox
            label="Show Zoning Envelope"
            checked={settings.showZoningEnvelope}
            onChange={onToggleZoning}
          />
          <SettingCheckbox
            label="Show Context Buildings"
            checked={settings.showContextBuildings}
            onChange={onToggleContext}
          />
          <SettingCheckbox
            label="Show Grid"
            checked={settings.showGrid}
            onChange={onToggleGrid}
          />
          <SettingCheckbox
            label="Show Measurements"
            checked={settings.showMeasurements}
            onChange={onToggleMeasurements}
          />
        </div>
      )}
    </div>
  );
};

const SettingCheckbox: React.FC<{
  label: string;
  checked: boolean;
  onChange: () => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-gray-300 transition-colors">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="rounded"
    />
    <span>{label}</span>
  </label>
);

export default Building3DEditor;
