/**
 * Pipeline 3D Progress - Module Exports
 * 
 * Central export file for the Pipeline 3D Progress visualization system.
 */

// Main Components
export { Pipeline3DProgress } from './Pipeline3DProgress';
export { ConstructionPhaseTracker } from './ConstructionPhaseTracker';
export { PhotoGeoTagger } from './PhotoGeoTagger';
export { DrawScheduleView } from './DrawScheduleView';

// Demo Component
export { Pipeline3DProgressDemo } from './Pipeline3DProgressDemo';
export { default as Pipeline3DProgressDemoDefault } from './Pipeline3DProgressDemo';

// Mock Data
export {
  MOCK_DATA,
  MOCK_PHASES,
  MOCK_PHOTOS,
  MOCK_DRAW_SCHEDULE,
  MOCK_QUALITY_REPORT,
  generateMockSections,
  generateMockConstructionProgress,
} from './mockConstructionData';

// Types (re-exported from types/construction.ts)
export type {
  BuildingSection,
  ConstructionPhase,
  PhotoTag,
  CompletionMetrics,
  ConstructionProgress,
  DrawSchedule,
  Milestone,
  ProgressEstimate,
  QualityReport,
  QualityIssue,
  Pipeline3DService,
  Vector3,
  ProgressStatus,
  PhaseType,
} from '../../types/construction';

// Utility exports
export { generateMockConstructionData } from '../../types/construction';
