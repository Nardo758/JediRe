/**
 * Mock Construction Data for Pipeline 3D Progress Testing
 */

import {
  BuildingSection,
  ConstructionPhase,
  PhotoTag,
  DrawSchedule,
  Milestone,
  QualityReport,
  ConstructionProgress,
} from '../../types/construction';

/**
 * Generate mock building sections for a 12-floor multifamily development
 */
export const generateMockSections = (): BuildingSection[] => {
  const sections: BuildingSection[] = [];

  // Floors 1-4: Complete
  for (let floor = 1; floor <= 4; floor++) {
    sections.push({
      id: `floor-${floor}`,
      name: `Floor ${floor}`,
      floor,
      x: 0,
      z: 0,
      width: 20,
      depth: 20,
      height: 4,
      percentComplete: 100,
      status: 'complete',
      phase: 'structure',
      description: `Residential floor with ${floor === 1 ? 'lobby and amenities' : '24 units'}`,
      startDate: `2024-0${floor}-01`,
      targetDate: `2024-0${floor}-28`,
      actualDate: `2024-0${floor}-25`,
      photos: [],
    });
  }

  // Floor 5: In Progress (60%)
  sections.push({
    id: 'floor-5',
    name: 'Floor 5',
    floor: 5,
    x: 0,
    z: 0,
    width: 20,
    depth: 20,
    height: 4,
    percentComplete: 60,
    status: 'inProgress',
    phase: 'structure',
    description: 'Residential floor with 24 units - Framing in progress',
    startDate: '2024-05-01',
    targetDate: '2024-05-28',
    photos: [],
  });

  // Floors 6-12: Not Started
  for (let floor = 6; floor <= 12; floor++) {
    sections.push({
      id: `floor-${floor}`,
      name: `Floor ${floor}`,
      floor,
      x: 0,
      z: 0,
      width: 20,
      depth: 20,
      height: 4,
      percentComplete: 0,
      status: 'notStarted',
      phase: floor <= 8 ? 'structure' : 'mep',
      description: `Residential floor with 24 units`,
      startDate: `2024-${String(floor + 1).padStart(2, '0')}-01`,
      targetDate: `2024-${String(floor + 1).padStart(2, '0')}-28`,
      photos: [],
    });
  }

  return sections;
};

/**
 * Mock construction phases with milestones
 */
export const MOCK_PHASES: ConstructionPhase[] = [
  {
    id: 'foundation',
    name: 'Foundation & Site Work',
    description: 'Site clearing, excavation, foundation, and parking structure',
    order: 1,
    percentComplete: 100,
    status: 'complete',
    startDate: '2023-12-01',
    targetDate: '2024-02-15',
    actualDate: '2024-02-10',
    sections: [],
    milestones: [
      {
        id: 'ms-foundation-1',
        name: 'Site Clearing Complete',
        targetDate: '2023-12-15',
        actualDate: '2023-12-12',
        status: 'completed',
        phase: 'foundation',
      },
      {
        id: 'ms-foundation-2',
        name: 'Excavation Complete',
        targetDate: '2024-01-10',
        actualDate: '2024-01-08',
        status: 'completed',
        phase: 'foundation',
      },
      {
        id: 'ms-foundation-3',
        name: 'Foundation Pour',
        targetDate: '2024-02-01',
        actualDate: '2024-01-28',
        status: 'completed',
        phase: 'foundation',
      },
      {
        id: 'ms-foundation-4',
        name: 'Parking Structure Complete',
        targetDate: '2024-02-15',
        actualDate: '2024-02-10',
        status: 'completed',
        phase: 'foundation',
      },
    ],
  },
  {
    id: 'structure',
    name: 'Vertical Structure',
    description: 'Structural framing, floor decks, and core construction',
    order: 2,
    percentComplete: 45,
    status: 'inProgress',
    startDate: '2024-02-15',
    targetDate: '2024-08-30',
    sections: ['floor-1', 'floor-2', 'floor-3', 'floor-4', 'floor-5'],
    milestones: [
      {
        id: 'ms-structure-1',
        name: 'Floor 1-4 Decks Complete',
        targetDate: '2024-05-01',
        actualDate: '2024-04-28',
        status: 'completed',
        phase: 'structure',
      },
      {
        id: 'ms-structure-2',
        name: 'Floor 5-8 Framing',
        description: 'Structural steel and concrete deck installation',
        targetDate: '2024-07-15',
        status: 'onTrack',
        phase: 'structure',
      },
      {
        id: 'ms-structure-3',
        name: 'Top-Off Celebration',
        description: 'Final floor deck pour',
        targetDate: '2024-08-30',
        status: 'upcoming',
        phase: 'structure',
      },
    ],
  },
  {
    id: 'skin',
    name: 'Building Envelope',
    description: 'Exterior walls, windows, waterproofing, and facade',
    order: 3,
    percentComplete: 0,
    status: 'notStarted',
    startDate: '2024-07-01',
    targetDate: '2024-11-30',
    sections: [],
    milestones: [
      {
        id: 'ms-skin-1',
        name: 'Window Installation Start',
        targetDate: '2024-10-15',
        status: 'upcoming',
        phase: 'skin',
      },
      {
        id: 'ms-skin-2',
        name: 'Building Weather-Tight',
        targetDate: '2024-11-30',
        status: 'upcoming',
        phase: 'skin',
      },
    ],
  },
  {
    id: 'mep',
    name: 'MEP Systems',
    description: 'Mechanical, electrical, plumbing, and fire protection rough-in',
    order: 4,
    percentComplete: 0,
    status: 'notStarted',
    startDate: '2024-08-01',
    targetDate: '2025-01-15',
    sections: [],
    milestones: [
      {
        id: 'ms-mep-1',
        name: 'MEP Rough-In Complete',
        targetDate: '2025-01-15',
        status: 'upcoming',
        phase: 'mep',
      },
    ],
  },
  {
    id: 'interior',
    name: 'Interior Finishes',
    description: 'Drywall, flooring, cabinetry, fixtures, and painting',
    order: 5,
    percentComplete: 0,
    status: 'notStarted',
    startDate: '2024-12-01',
    targetDate: '2025-04-30',
    sections: [],
    milestones: [
      {
        id: 'ms-interior-1',
        name: 'Model Unit Complete',
        targetDate: '2025-03-01',
        status: 'upcoming',
        phase: 'interior',
      },
      {
        id: 'ms-interior-2',
        name: 'All Units Complete',
        targetDate: '2025-04-30',
        status: 'upcoming',
        phase: 'interior',
      },
    ],
  },
  {
    id: 'exterior',
    name: 'Exterior & Site Finishes',
    description: 'Landscaping, paving, site amenities, and final grading',
    order: 6,
    percentComplete: 0,
    status: 'notStarted',
    startDate: '2025-03-01',
    targetDate: '2025-05-30',
    sections: [],
    milestones: [
      {
        id: 'ms-exterior-1',
        name: 'Landscaping Complete',
        targetDate: '2025-05-15',
        status: 'upcoming',
        phase: 'exterior',
      },
      {
        id: 'ms-exterior-2',
        name: 'TCO Received',
        description: 'Temporary Certificate of Occupancy',
        targetDate: '2025-05-30',
        status: 'upcoming',
        phase: 'exterior',
      },
    ],
  },
];

/**
 * Mock photo tags
 */
export const MOCK_PHOTOS: PhotoTag[] = [
  {
    id: 'photo-1',
    filename: 'floor-4-deck-pour.jpg',
    url: 'https://via.placeholder.com/800x600/10B981/FFFFFF?text=Floor+4+Deck+Pour',
    thumbnailUrl: 'https://via.placeholder.com/200x150/10B981/FFFFFF?text=Floor+4',
    sectionId: 'floor-4',
    location: { x: 0, y: 12, z: 0 },
    uploadedAt: '2024-04-25T14:30:00Z',
    uploadedBy: 'John Smith',
    caption: 'Floor 4 concrete deck pour complete',
    tags: ['deck', 'concrete', 'floor-4', 'complete'],
  },
  {
    id: 'photo-2',
    filename: 'floor-5-framing.jpg',
    url: 'https://via.placeholder.com/800x600/FCD34D/000000?text=Floor+5+Framing',
    thumbnailUrl: 'https://via.placeholder.com/200x150/FCD34D/000000?text=Floor+5',
    sectionId: 'floor-5',
    location: { x: 0, y: 16, z: 0 },
    uploadedAt: '2024-05-18T10:15:00Z',
    uploadedBy: 'Sarah Johnson',
    caption: 'Floor 5 steel framing in progress - 60% complete',
    tags: ['framing', 'steel', 'floor-5', 'in-progress'],
  },
];

/**
 * Mock draw schedule
 */
export const MOCK_DRAW_SCHEDULE: DrawSchedule[] = [
  {
    id: 'draw-1',
    drawNumber: 1,
    requestedAmount: 2500000,
    approvedAmount: 2500000,
    paidAmount: 2500000,
    requestDate: '2024-01-15',
    approvalDate: '2024-01-20',
    paymentDate: '2024-01-25',
    status: 'paid',
    linkedSections: ['floor-1', 'floor-2'],
    workDescription: 'Foundation and site work complete. Parking structure foundation.',
    inspectionRequired: true,
    inspectionDate: '2024-01-18',
    notes: 'All foundation work passed inspection. No deficiencies.',
  },
  {
    id: 'draw-2',
    drawNumber: 2,
    requestedAmount: 3200000,
    approvedAmount: 3200000,
    paidAmount: 3200000,
    requestDate: '2024-03-01',
    approvalDate: '2024-03-05',
    paymentDate: '2024-03-10',
    status: 'paid',
    linkedSections: ['floor-3', 'floor-4'],
    workDescription: 'Structural framing floors 3-4. Deck pours complete.',
    inspectionRequired: true,
    inspectionDate: '2024-03-03',
  },
  {
    id: 'draw-3',
    drawNumber: 3,
    requestedAmount: 2800000,
    approvedAmount: 2600000,
    paidAmount: 0,
    requestDate: '2024-05-15',
    approvalDate: '2024-05-20',
    status: 'approved',
    linkedSections: ['floor-5'],
    workDescription: 'Floor 5 framing 60% complete. MEP rough-in started.',
    inspectionRequired: true,
    inspectionDate: '2024-05-18',
    notes: 'Approved with $200k holdback due to MEP coordination issues on floor 5. To be released upon resolution.',
  },
  {
    id: 'draw-4',
    drawNumber: 4,
    requestedAmount: 4500000,
    approvedAmount: 0,
    paidAmount: 0,
    requestDate: '2024-07-01',
    status: 'pending',
    linkedSections: ['floor-6', 'floor-7', 'floor-8'],
    workDescription: 'Floors 6-8 structural completion. Expected completion late June.',
    inspectionRequired: true,
    notes: 'Draw to be submitted upon completion of floors 6-8.',
  },
];

/**
 * Mock quality report
 */
export const MOCK_QUALITY_REPORT: QualityReport = {
  id: 'qr-1',
  sectionId: 'floor-5',
  inspectionDate: '2024-05-18',
  inspector: 'Mike Chen',
  status: 'conditional',
  issues: [
    {
      id: 'issue-1',
      description: 'Rebar spacing exceeds spec on north elevation by 2 inches',
      severity: 'minor',
      location: 'Floor 5, North side, Grid line C',
      status: 'open',
      photos: ['photo-issue-1.jpg'],
      assignedTo: 'Steel Contractor',
      dueDate: '2024-05-22',
    },
    {
      id: 'issue-2',
      description: 'MEP sleeve missing at column D4',
      severity: 'major',
      location: 'Floor 5, Column D4',
      status: 'inProgress',
      photos: ['photo-issue-2.jpg'],
      assignedTo: 'MEP Contractor',
      dueDate: '2024-05-20',
    },
  ],
  notes: 'Overall quality good. Two minor issues to resolve before proceeding to deck pour.',
};

/**
 * Generate complete mock construction progress
 */
export const generateMockConstructionProgress = (): ConstructionProgress => {
  const sections = generateMockSections();

  return {
    dealId: 'deal-123-main-street',
    sections,
    phases: MOCK_PHASES,
    metrics: {
      overallPercent: 35,
      sectionMetrics: sections.reduce((acc, s) => {
        acc[s.id] = s.percentComplete;
        return acc;
      }, {} as Record<string, number>),
      phaseMetrics: {
        foundation: 100,
        structure: 45,
        skin: 0,
        mep: 0,
        interior: 0,
        exterior: 0,
      },
      scheduleVariance: 3, // 3 days ahead
      budgetVariance: -2, // 2% under budget
      lastUpdated: new Date().toISOString(),
    },
    lastUpdated: new Date().toISOString(),
  };
};

/**
 * Export all mock data
 */
export const MOCK_DATA = {
  sections: generateMockSections(),
  phases: MOCK_PHASES,
  photos: MOCK_PHOTOS,
  draws: MOCK_DRAW_SCHEDULE,
  qualityReport: MOCK_QUALITY_REPORT,
  progress: generateMockConstructionProgress(),
};
