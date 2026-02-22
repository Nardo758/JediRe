/**
 * Construction Progress Tracking Types
 * For Pipeline 3D Progress Visualization
 */

export type ProgressStatus = 'notStarted' | 'inProgress' | 'complete';
export type PhaseType = 'foundation' | 'structure' | 'skin' | 'mep' | 'interior' | 'exterior';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface BuildingSection {
  id: string;
  name: string;
  floor: number;
  x?: number;
  y?: number;
  z?: number;
  width?: number;
  height?: number;
  depth?: number;
  percentComplete: number;
  status: ProgressStatus;
  phase: PhaseType;
  photos?: PhotoTag[];
  description?: string;
  startDate?: string;
  targetDate?: string;
  actualDate?: string;
}

export interface ConstructionPhase {
  id: PhaseType;
  name: string;
  description: string;
  order: number;
  percentComplete: number;
  status: ProgressStatus;
  startDate?: string;
  targetDate?: string;
  actualDate?: string;
  sections: string[]; // Section IDs
  dependencies?: PhaseType[];
  milestones?: Milestone[];
}

export interface Milestone {
  id: string;
  name: string;
  description?: string;
  targetDate: string;
  actualDate?: string;
  status: 'upcoming' | 'onTrack' | 'atRisk' | 'completed' | 'delayed';
  phase: PhaseType;
  dependencies?: string[];
}

export interface PhotoTag {
  id: string;
  filename: string;
  url: string;
  thumbnailUrl?: string;
  sectionId: string;
  location: Vector3;
  uploadedAt: string;
  uploadedBy: string;
  caption?: string;
  tags?: string[];
}

export interface CompletionMetrics {
  overallPercent: number;
  sectionMetrics: Record<string, number>; // sectionId -> percent
  phaseMetrics: Record<PhaseType, number>; // phase -> percent
  scheduleVariance: number; // days (positive = ahead, negative = behind)
  budgetVariance: number; // percentage (negative = under, positive = over)
  lastUpdated?: string;
}

export interface ConstructionProgress {
  dealId: string;
  sections: BuildingSection[];
  phases?: ConstructionPhase[];
  metrics: CompletionMetrics;
  lastUpdated: string;
}

export interface DrawSchedule {
  id: string;
  drawNumber: number;
  requestedAmount: number;
  approvedAmount?: number;
  paidAmount?: number;
  requestDate: string;
  approvalDate?: string;
  paymentDate?: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  linkedSections: string[]; // Section IDs
  workDescription: string;
  inspectionRequired: boolean;
  inspectionDate?: string;
  notes?: string;
}

export interface ProgressEstimate {
  sectionId: string;
  estimatedPercent: number;
  confidence: number; // 0-1
  method: 'manual' | 'ai' | 'photo-analysis';
  timestamp: string;
  notes?: string;
}

export interface QualityReport {
  id: string;
  sectionId: string;
  inspectionDate: string;
  inspector: string;
  status: 'pass' | 'fail' | 'conditional';
  issues?: QualityIssue[];
  photos?: PhotoTag[];
  notes?: string;
}

export interface QualityIssue {
  id: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  location: string;
  status: 'open' | 'inProgress' | 'resolved';
  photos?: string[];
  assignedTo?: string;
  dueDate?: string;
}

// AI Service Interface (for future Qwen integration)
export interface Pipeline3DService {
  // Current: Manual operations
  tagPhoto(photo: File, location: Vector3): Promise<PhotoTag>;
  updateProgress(sectionId: string, percent: number): Promise<void>;
  
  // Future: AI-powered features
  autoTagPhotos?(photos: File[], model?: 'qwen'): Promise<PhotoTag[]>;
  estimateProgress?(photos: File[], section: string, model?: 'qwen'): Promise<ProgressEstimate>;
  analyzeConstructionQuality?(photos: File[], model?: 'qwen'): Promise<QualityReport>;
  predictCompletion?(progress: ConstructionProgress, model?: 'qwen'): Promise<{
    estimatedDate: string;
    confidence: number;
    risks: string[];
  }>;
}

// Mock data generator for testing
export const generateMockConstructionData = (floors: number = 12): ConstructionProgress => {
  const sections: BuildingSection[] = [];
  
  for (let floor = 1; floor <= floors; floor++) {
    sections.push({
      id: `floor-${floor}`,
      name: `Floor ${floor}`,
      floor,
      x: 0,
      z: 0,
      width: 20,
      depth: 20,
      height: 4,
      percentComplete: floor <= 4 ? 100 : floor === 5 ? 60 : 0,
      status: floor <= 4 ? 'complete' : floor === 5 ? 'inProgress' : 'notStarted',
      phase: floor <= 4 ? 'structure' : floor <= 6 ? 'structure' : 'mep',
    });
  }

  const phases: ConstructionPhase[] = [
    {
      id: 'foundation',
      name: 'Foundation',
      description: 'Site prep, excavation, and foundation work',
      order: 1,
      percentComplete: 100,
      status: 'complete',
      sections: [],
    },
    {
      id: 'structure',
      name: 'Vertical Structure',
      description: 'Structural framing and floor systems',
      order: 2,
      percentComplete: 45,
      status: 'inProgress',
      sections: sections.filter(s => s.phase === 'structure').map(s => s.id),
    },
    {
      id: 'skin',
      name: 'Building Envelope',
      description: 'Exterior walls, windows, and waterproofing',
      order: 3,
      percentComplete: 0,
      status: 'notStarted',
      sections: [],
    },
    {
      id: 'mep',
      name: 'MEP Systems',
      description: 'Mechanical, electrical, and plumbing rough-in',
      order: 4,
      percentComplete: 0,
      status: 'notStarted',
      sections: [],
    },
    {
      id: 'interior',
      name: 'Interior Finishes',
      description: 'Drywall, flooring, and interior fixtures',
      order: 5,
      percentComplete: 0,
      status: 'notStarted',
      sections: [],
    },
    {
      id: 'exterior',
      name: 'Exterior Finishes',
      description: 'Landscaping, paving, and exterior amenities',
      order: 6,
      percentComplete: 0,
      status: 'notStarted',
      sections: [],
    },
  ];

  return {
    dealId: 'mock-deal-123',
    sections,
    phases,
    metrics: {
      overallPercent: 35,
      sectionMetrics: sections.reduce((acc, s) => ({ ...acc, [s.id]: s.percentComplete }), {}),
      phaseMetrics: {
        foundation: 100,
        structure: 45,
        skin: 0,
        mep: 0,
        interior: 0,
        exterior: 0,
      },
      scheduleVariance: 3,
      budgetVariance: -2,
    },
    lastUpdated: new Date().toISOString(),
  };
};
