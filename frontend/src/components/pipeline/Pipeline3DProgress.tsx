import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { ConstructionPhaseTracker } from './ConstructionPhaseTracker';
import { PhotoGeoTagger } from './PhotoGeoTagger';
import { DrawScheduleView } from './DrawScheduleView';
import { 
  ConstructionPhase, 
  BuildingSection, 
  PhotoTag, 
  CompletionMetrics,
  ConstructionProgress 
} from '../../types/construction';

interface Pipeline3DProgressProps {
  dealId: string;
  buildingModel?: string; // URL to 3D model (future)
  onProgressUpdate?: (progress: ConstructionProgress) => void;
}

// Color mapping for progress states
const PROGRESS_COLORS = {
  notStarted: '#9CA3AF',    // gray-400
  inProgress: '#FCD34D',     // yellow-300
  complete: '#34D399',       // green-400
  paid: '#10B981',          // green-500
  unpaid: '#F59E0B',        // amber-500
} as const;

// Building model component (simplified for now - will load actual 3D models later)
const BuildingModel: React.FC<{
  sections: BuildingSection[];
  selectedSection: string | null;
  onSectionClick: (sectionId: string) => void;
}> = ({ sections, selectedSection, onSectionClick }) => {
  
  const getSectionColor = (section: BuildingSection) => {
    if (section.percentComplete === 100) return PROGRESS_COLORS.complete;
    if (section.percentComplete > 0) return PROGRESS_COLORS.inProgress;
    return PROGRESS_COLORS.notStarted;
  };

  const getSectionOpacity = (section: BuildingSection) => {
    if (selectedSection === section.id) return 1.0;
    if (selectedSection && selectedSection !== section.id) return 0.3;
    return 0.8;
  };

  return (
    <group>
      {sections.map((section, index) => {
        const color = getSectionColor(section);
        const opacity = getSectionOpacity(section);
        const height = section.height || 4;
        const yOffset = (section.floor - 1) * 4; // 4 units per floor

        return (
          <mesh
            key={section.id}
            position={[section.x || 0, yOffset + height / 2, section.z || 0]}
            onClick={(e) => {
              e.stopPropagation();
              onSectionClick(section.id);
            }}
          >
            <boxGeometry args={[section.width || 20, height, section.depth || 20]} />
            <meshStandardMaterial 
              color={color} 
              transparent 
              opacity={opacity}
              roughness={0.4}
              metalness={0.1}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// Grid helper for better spatial reference
const GridHelper: React.FC = () => {
  return (
    <group>
      <gridHelper args={[100, 20, '#888888', '#444444']} />
      <axesHelper args={[50]} />
    </group>
  );
};

export const Pipeline3DProgress: React.FC<Pipeline3DProgressProps> = ({ 
  dealId, 
  buildingModel,
  onProgressUpdate 
}) => {
  const [selectedPhase, setSelectedPhase] = useState<ConstructionPhase | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [buildingSections, setBuildingSections] = useState<BuildingSection[]>([]);
  const [photos, setPhotos] = useState<PhotoTag[]>([]);
  const [showPhotoTagger, setShowPhotoTagger] = useState(false);
  const [showDrawSchedule, setShowDrawSchedule] = useState(false);
  const [metrics, setMetrics] = useState<CompletionMetrics>({
    overallPercent: 0,
    sectionMetrics: {},
    phaseMetrics: {},
    scheduleVariance: 0,
    budgetVariance: 0,
  });

  // Load mock data on mount
  useEffect(() => {
    loadMockConstructionData();
  }, [dealId]);

  const loadMockConstructionData = () => {
    // Mock building sections (12-floor building)
    const mockSections: BuildingSection[] = [];
    for (let floor = 1; floor <= 12; floor++) {
      mockSections.push({
        id: `floor-${floor}`,
        name: `Floor ${floor}`,
        floor: floor,
        x: 0,
        z: 0,
        width: 20,
        depth: 20,
        height: 4,
        percentComplete: floor <= 4 ? 100 : floor === 5 ? 60 : 0,
        status: floor <= 4 ? 'complete' : floor === 5 ? 'inProgress' : 'notStarted',
        phase: floor <= 4 ? 'structure' : floor <= 6 ? 'structure' : 'mep',
        photos: [],
      });
    }
    setBuildingSections(mockSections);

    // Calculate initial metrics
    calculateMetrics(mockSections);
  };

  const calculateMetrics = (sections: BuildingSection[]) => {
    const totalSections = sections.length;
    const completedPercent = sections.reduce((sum, s) => sum + s.percentComplete, 0) / totalSections;
    
    const phaseMetrics = {
      foundation: 100,
      structure: 45,
      skin: 0,
      mep: 0,
      interior: 0,
      exterior: 0,
    };

    const sectionMetrics: Record<string, number> = {};
    sections.forEach(s => {
      sectionMetrics[s.id] = s.percentComplete;
    });

    setMetrics({
      overallPercent: completedPercent,
      sectionMetrics,
      phaseMetrics,
      scheduleVariance: 3, // 3 days ahead
      budgetVariance: -2, // 2% under budget
    });

    if (onProgressUpdate) {
      onProgressUpdate({
        dealId,
        sections,
        metrics: {
          overallPercent: completedPercent,
          sectionMetrics,
          phaseMetrics,
          scheduleVariance: 3,
          budgetVariance: -2,
        },
        lastUpdated: new Date().toISOString(),
      });
    }
  };

  const handleSectionClick = (sectionId: string) => {
    setSelectedSection(sectionId === selectedSection ? null : sectionId);
  };

  const handlePhaseSelect = (phase: ConstructionPhase) => {
    setSelectedPhase(phase);
    // Highlight all sections related to this phase
    const phaseSections = buildingSections.filter(s => s.phase === phase.id);
    if (phaseSections.length > 0) {
      setSelectedSection(phaseSections[0].id);
    }
  };

  const handlePhotoTag = (photo: PhotoTag) => {
    setPhotos([...photos, photo]);
    // Update section with new photo
    setBuildingSections(sections =>
      sections.map(s =>
        s.id === photo.sectionId
          ? { ...s, photos: [...(s.photos || []), photo] }
          : s
      )
    );
  };

  const handleProgressUpdate = (sectionId: string, percent: number) => {
    setBuildingSections(sections =>
      sections.map(s =>
        s.id === sectionId
          ? { 
              ...s, 
              percentComplete: percent,
              status: percent === 100 ? 'complete' : percent > 0 ? 'inProgress' : 'notStarted'
            }
          : s
      )
    );
    // Recalculate metrics
    const updatedSections = buildingSections.map(s =>
      s.id === sectionId ? { ...s, percentComplete: percent } : s
    );
    calculateMetrics(updatedSections);
  };

  /**
   * AI Integration: Auto-tag uploaded photos using Qwen
   */
  const autoTagPhotos = async (photoFiles: File[]): Promise<PhotoTag[]> => {
    try {
      const formData = new FormData();
      photoFiles.forEach(photo => formData.append('photos', photo));

      const response = await fetch('/api/v1/ai/auto-tag-photos', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to auto-tag photos');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'AI photo tagging failed');
      }

      return result.data;
    } catch (error) {
      console.error('[Pipeline3DProgress] Auto-tag photos error:', error);
      // Return basic tags as fallback
      return photoFiles.map((file, index) => ({
        photoId: `photo-${Date.now()}-${index}`,
        tags: ['construction'],
        confidence: 0.3,
      }));
    }
  };

  /**
   * AI Integration: Estimate construction progress from photos
   */
  const estimateProgressFromPhotos = async (
    photoFiles: File[],
    section: string
  ): Promise<{
    percentComplete: number;
    confidence: number;
    itemsCompleted: string[];
    itemsRemaining: string[];
  }> => {
    try {
      const formData = new FormData();
      photoFiles.forEach(photo => formData.append('photos', photo));
      formData.append('section', section);

      const response = await fetch('/api/v1/ai/estimate-progress', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to estimate progress');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'AI progress estimation failed');
      }

      return {
        percentComplete: result.data.percentComplete,
        confidence: result.data.confidence,
        itemsCompleted: result.data.itemsCompleted,
        itemsRemaining: result.data.itemsRemaining,
      };
    } catch (error) {
      console.error('[Pipeline3DProgress] Estimate progress error:', error);
      // Return default estimate as fallback
      return {
        percentComplete: 0,
        confidence: 0,
        itemsCompleted: [],
        itemsRemaining: [],
      };
    }
  };

  const selectedSectionData = buildingSections.find(s => s.id === selectedSection);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Construction Progress Tracker</h1>
            <p className="text-sm text-gray-600 mt-1">3D Building Visualization</p>
          </div>
          
          {/* Key Metrics */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{metrics.overallPercent.toFixed(0)}%</div>
              <div className="text-xs text-gray-600">Overall Complete</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${metrics.scheduleVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.scheduleVariance > 0 ? '+' : ''}{metrics.scheduleVariance}d
              </div>
              <div className="text-xs text-gray-600">Schedule</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${metrics.budgetVariance <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.budgetVariance}%
              </div>
              <div className="text-xs text-gray-600">Budget</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPhotoTagger(!showPhotoTagger)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              📸 Tag Photos
            </button>
            <button
              onClick={() => setShowDrawSchedule(!showDrawSchedule)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
            >
              💰 Draw Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* 3D Viewport */}
        <div className="flex-1 relative">
          <Canvas shadows>
            <PerspectiveCamera makeDefault position={[40, 40, 40]} fov={50} />
            <OrbitControls 
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              maxPolarAngle={Math.PI / 2}
            />
            
            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight 
              position={[10, 20, 10]} 
              intensity={1} 
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
            />
            <pointLight position={[-10, 10, -10]} intensity={0.5} />
            
            {/* Building Model */}
            <BuildingModel 
              sections={buildingSections}
              selectedSection={selectedSection}
              onSectionClick={handleSectionClick}
            />
            
            {/* Grid Helper */}
            <GridHelper />
            
            {/* Environment */}
            <Environment preset="city" />
          </Canvas>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4">
            <h3 className="font-semibold text-sm text-gray-900 mb-2">Progress Status</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: PROGRESS_COLORS.complete }} />
                <span>Complete (100%)</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: PROGRESS_COLORS.inProgress }} />
                <span>In Progress</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: PROGRESS_COLORS.notStarted }} />
                <span>Not Started</span>
              </div>
            </div>
          </div>

          {/* Section Info Panel */}
          {selectedSectionData && (
            <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 w-80">
              <h3 className="font-semibold text-lg text-gray-900 mb-2">{selectedSectionData.name}</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Progress:</span>
                  <span className="text-sm font-semibold text-gray-900">{selectedSectionData.percentComplete}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${selectedSectionData.percentComplete}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Phase:</span>
                  <span className="font-medium text-gray-900 capitalize">{selectedSectionData.phase}</span>
                </div>
                {selectedSectionData.photos && selectedSectionData.photos.length > 0 && (
                  <div className="mt-3">
                    <span className="text-sm text-gray-600">📸 {selectedSectionData.photos.length} photos</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Phase Tracker */}
        <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto">
          <ConstructionPhaseTracker
            dealId={dealId}
            onPhaseSelect={handlePhaseSelect}
            selectedPhase={selectedPhase}
            metrics={metrics}
            onProgressUpdate={handleProgressUpdate}
          />
        </div>
      </div>

      {/* Photo Tagger Modal */}
      {showPhotoTagger && (
        <PhotoGeoTagger
          sections={buildingSections}
          onPhotoTag={handlePhotoTag}
          onClose={() => setShowPhotoTagger(false)}
        />
      )}

      {/* Draw Schedule Modal */}
      {showDrawSchedule && (
        <DrawScheduleView
          sections={buildingSections}
          metrics={metrics}
          onClose={() => setShowDrawSchedule(false)}
        />
      )}
    </div>
  );
};
