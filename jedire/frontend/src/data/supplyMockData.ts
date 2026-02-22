/**
 * Supply Mock Data - Pipeline Projects
 * Dual-mode data for Acquisition (future supply impact) and Performance (new competition)
 */

export type ProjectStatus = 'planned' | 'under-construction' | 'pre-leasing' | 'delivered';
export type ImpactLevel = 'low' | 'medium' | 'high';

export interface PipelineProject {
  id: string;
  name: string;
  developer: string;
  units: number;
  status: ProjectStatus;
  deliveryDate: string; // ISO date
  deliveryQuarter: string; // e.g., "Q2 2024"
  distance: number; // miles from subject property
  address: string;
  rentRange: {
    min: number;
    max: number;
  };
  amenities: string[];
  competitive: boolean; // true if directly competitive
  impactLevel: ImpactLevel;
  percentLeased?: number; // for pre-leasing/delivered
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface SupplyStats {
  totalPipelineUnits: number;
  unitsWithin3Miles: number;
  unitsDelivering12Months: number;
  directCompetitors: number;
  averageDistanceToCompetition: number;
}

// ==================== ACQUISITION MODE DATA ====================
// Focus: Future supply impact, absorption challenges, market saturation risk

export const acquisitionSupplyStats: SupplyStats = {
  totalPipelineUnits: 3420,
  unitsWithin3Miles: 1850,
  unitsDelivering12Months: 950,
  directCompetitors: 8,
  averageDistanceToCompetition: 1.8
};

export const acquisitionPipelineProjects: PipelineProject[] = [
  {
    id: 'proj-001',
    name: 'Piedmont Heights',
    developer: 'Cortland Partners',
    units: 380,
    status: 'under-construction',
    deliveryDate: '2024-09-01',
    deliveryQuarter: 'Q3 2024',
    distance: 0.4,
    address: '3450 Piedmont Road NE, Atlanta, GA 30305',
    rentRange: { min: 1750, max: 2850 },
    amenities: ['Pool', 'Fitness Center', 'Coworking Space', 'Pet Spa'],
    competitive: true,
    impactLevel: 'high',
    percentLeased: 35,
    coordinates: { lat: 33.8339, lng: -84.3677 }
  },
  {
    id: 'proj-002',
    name: 'Buckhead Station Phase II',
    developer: 'Gables Residential',
    units: 425,
    status: 'under-construction',
    deliveryDate: '2024-11-15',
    deliveryQuarter: 'Q4 2024',
    distance: 0.7,
    address: '3340 Peachtree Road NE, Atlanta, GA 30326',
    rentRange: { min: 2100, max: 4200 },
    amenities: ['Rooftop Pool', 'Concierge', 'Sky Lounge', 'Package Room'],
    competitive: true,
    impactLevel: 'high',
    percentLeased: 18,
    coordinates: { lat: 33.8405, lng: -84.3684 }
  },
  {
    id: 'proj-003',
    name: 'Midtown Village',
    developer: 'Wood Partners',
    units: 290,
    status: 'pre-leasing',
    deliveryDate: '2024-07-01',
    deliveryQuarter: 'Q3 2024',
    distance: 1.2,
    address: '950 W Peachtree Street NW, Atlanta, GA 30309',
    rentRange: { min: 1650, max: 2450 },
    amenities: ['Pool', 'Gym', 'Business Center', 'Pet Park'],
    competitive: true,
    impactLevel: 'medium',
    percentLeased: 62,
    coordinates: { lat: 33.7792, lng: -84.3861 }
  },
  {
    id: 'proj-004',
    name: 'The Brookwood',
    developer: 'Mill Creek Residential',
    units: 310,
    status: 'under-construction',
    deliveryDate: '2025-03-01',
    deliveryQuarter: 'Q1 2025',
    distance: 0.9,
    address: '1775 Peachtree Street NE, Atlanta, GA 30309',
    rentRange: { min: 1850, max: 3100 },
    amenities: ['Pool', 'Fitness Center', 'Game Room', 'Grilling Area'],
    competitive: true,
    impactLevel: 'medium',
    percentLeased: 0,
    coordinates: { lat: 33.7964, lng: -84.3845 }
  },
  {
    id: 'proj-005',
    name: 'Gateway Gardens',
    developer: 'Trammell Crow Residential',
    units: 195,
    status: 'delivered',
    deliveryDate: '2024-02-15',
    deliveryQuarter: 'Q1 2024',
    distance: 1.5,
    address: '2100 N Druid Hills Road NE, Atlanta, GA 30329',
    rentRange: { min: 1450, max: 2150 },
    amenities: ['Pool', 'Clubhouse', 'Dog Park'],
    competitive: false,
    impactLevel: 'low',
    percentLeased: 88,
    coordinates: { lat: 33.8125, lng: -84.3291 }
  },
  {
    id: 'proj-006',
    name: 'Lenox Park West',
    developer: 'Alliance Residential',
    units: 340,
    status: 'planned',
    deliveryDate: '2025-08-01',
    deliveryQuarter: 'Q3 2025',
    distance: 0.6,
    address: '3200 Lenox Road NE, Atlanta, GA 30326',
    rentRange: { min: 1950, max: 3400 },
    amenities: ['Resort Pool', 'Spa', 'Theater', 'Wine Room'],
    competitive: true,
    impactLevel: 'high',
    percentLeased: 0,
    coordinates: { lat: 33.8435, lng: -84.3585 }
  },
  {
    id: 'proj-007',
    name: 'Peachtree Crossing',
    developer: 'JPI',
    units: 275,
    status: 'under-construction',
    deliveryDate: '2024-12-01',
    deliveryQuarter: 'Q4 2024',
    distance: 2.1,
    address: '4500 Peachtree Road NE, Atlanta, GA 30338',
    rentRange: { min: 1550, max: 2350 },
    amenities: ['Pool', 'Fitness Center', 'Business Center'],
    competitive: false,
    impactLevel: 'low',
    percentLeased: 12,
    coordinates: { lat: 33.9175, lng: -84.3411 }
  },
  {
    id: 'proj-008',
    name: 'Colony Square Residences',
    developer: 'North American Properties',
    units: 465,
    status: 'delivered',
    deliveryDate: '2023-10-01',
    deliveryQuarter: 'Q4 2023',
    distance: 1.8,
    address: '1197 Peachtree Street NE, Atlanta, GA 30361',
    rentRange: { min: 2200, max: 5500 },
    amenities: ['Infinity Pool', 'Concierge', 'Private Dining', 'Yoga Studio'],
    competitive: false,
    impactLevel: 'low',
    percentLeased: 94,
    coordinates: { lat: 33.7889, lng: -84.3834 }
  },
  {
    id: 'proj-009',
    name: 'Lindbergh Plaza',
    developer: 'Selig Enterprises',
    units: 385,
    status: 'planned',
    deliveryDate: '2025-06-01',
    deliveryQuarter: 'Q2 2025',
    distance: 2.8,
    address: '2360 Piedmont Road NE, Atlanta, GA 30324',
    rentRange: { min: 1650, max: 2750 },
    amenities: ['Pool', 'Gym', 'Coworking', 'Bike Storage'],
    competitive: false,
    impactLevel: 'low',
    percentLeased: 0,
    coordinates: { lat: 33.8182, lng: -84.3688 }
  },
  {
    id: 'proj-010',
    name: 'Ansley Park Tower',
    developer: 'Hines',
    units: 355,
    status: 'under-construction',
    deliveryDate: '2024-10-15',
    deliveryQuarter: 'Q4 2024',
    distance: 1.1,
    address: '1575 Monroe Drive NE, Atlanta, GA 30324',
    rentRange: { min: 1900, max: 3300 },
    amenities: ['Rooftop Deck', 'Fitness Center', 'Pet Spa', 'Package Lockers'],
    competitive: true,
    impactLevel: 'medium',
    percentLeased: 28,
    coordinates: { lat: 33.7983, lng: -84.3711 }
  }
];

// ==================== PERFORMANCE MODE DATA ====================
// Focus: New competition tracking, market saturation alerts, tenant retention risk

export const performanceSupplyStats: SupplyStats = {
  totalPipelineUnits: 2890,
  unitsWithin3Miles: 1620,
  unitsDelivering12Months: 875,
  directCompetitors: 6,
  averageDistanceToCompetition: 1.5
};

export const performancePipelineProjects: PipelineProject[] = [
  {
    id: 'proj-p001',
    name: 'The Sterling',
    developer: 'AvalonBay',
    units: 420,
    status: 'pre-leasing',
    deliveryDate: '2024-08-01',
    deliveryQuarter: 'Q3 2024',
    distance: 0.3,
    address: '875 Peachtree Street NE, Atlanta, GA 30309',
    rentRange: { min: 1800, max: 2900 },
    amenities: ['Pool', 'Sky Lounge', 'Fitness Center', 'Coworking'],
    competitive: true,
    impactLevel: 'high',
    percentLeased: 45,
    coordinates: { lat: 33.7761, lng: -84.3845 }
  },
  {
    id: 'proj-p002',
    name: 'West Midtown Flats',
    developer: 'Pollack Shores',
    units: 315,
    status: 'under-construction',
    deliveryDate: '2024-09-15',
    deliveryQuarter: 'Q3 2024',
    distance: 0.8,
    address: '1050 Howell Mill Road NW, Atlanta, GA 30318',
    rentRange: { min: 1700, max: 2600 },
    amenities: ['Pool', 'Gym', 'Dog Park', 'Grilling Area'],
    competitive: true,
    impactLevel: 'high',
    percentLeased: 22,
    coordinates: { lat: 33.7869, lng: -84.4072 }
  },
  {
    id: 'proj-p003',
    name: 'Ponce City Market Phase III',
    developer: 'Jamestown',
    units: 280,
    status: 'delivered',
    deliveryDate: '2024-03-01',
    deliveryQuarter: 'Q1 2024',
    distance: 1.4,
    address: '675 Ponce de Leon Avenue NE, Atlanta, GA 30308',
    rentRange: { min: 2000, max: 4000 },
    amenities: ['Rooftop', 'Retail Access', 'Food Hall', 'Bike Storage'],
    competitive: false,
    impactLevel: 'low',
    percentLeased: 91,
    coordinates: { lat: 33.7726, lng: -84.3655 }
  },
  {
    id: 'proj-p004',
    name: 'Atlantic Station Tower C',
    developer: 'Hines',
    units: 365,
    status: 'under-construction',
    deliveryDate: '2024-11-01',
    deliveryQuarter: 'Q4 2024',
    distance: 1.7,
    address: '201 17th Street NW, Atlanta, GA 30363',
    rentRange: { min: 1850, max: 3200 },
    amenities: ['Pool', 'Fitness', 'Retail Below', 'Game Room'],
    competitive: false,
    impactLevel: 'medium',
    percentLeased: 15,
    coordinates: { lat: 33.7917, lng: -84.3981 }
  },
  {
    id: 'proj-p005',
    name: 'Tech Square Residences',
    developer: 'Columbia Residential',
    units: 390,
    status: 'planned',
    deliveryDate: '2025-02-01',
    deliveryQuarter: 'Q1 2025',
    distance: 2.2,
    address: '756 W Peachtree Street NW, Atlanta, GA 30308',
    rentRange: { min: 1750, max: 2850 },
    amenities: ['Pool', 'Study Rooms', 'Game Lounge', 'Coffee Bar'],
    competitive: false,
    impactLevel: 'low',
    percentLeased: 0,
    coordinates: { lat: 33.7738, lng: -84.3891 }
  },
  {
    id: 'proj-p006',
    name: 'Midtown Green',
    developer: 'Greystar',
    units: 445,
    status: 'under-construction',
    deliveryDate: '2024-10-01',
    deliveryQuarter: 'Q4 2024',
    distance: 0.5,
    address: '950 Peachtree Street NE, Atlanta, GA 30309',
    rentRange: { min: 1650, max: 2450 },
    amenities: ['Pool', 'Fitness Center', 'Pet Spa', 'Package Room'],
    competitive: true,
    impactLevel: 'high',
    percentLeased: 31,
    coordinates: { lat: 33.7785, lng: -84.3853 }
  },
  {
    id: 'proj-p007',
    name: 'The Interlock',
    developer: 'Regent Partners',
    units: 325,
    status: 'delivered',
    deliveryDate: '2023-12-15',
    deliveryQuarter: 'Q4 2023',
    distance: 2.5,
    address: '1115 Howell Mill Road NW, Atlanta, GA 30318',
    rentRange: { min: 1900, max: 3500 },
    amenities: ['Rooftop Pool', 'Sky Lounge', 'Retail Below', 'Coworking'],
    competitive: false,
    impactLevel: 'low',
    percentLeased: 96,
    coordinates: { lat: 33.7891, lng: -84.4105 }
  },
  {
    id: 'proj-p008',
    name: 'Old Fourth Ward Tower',
    developer: 'Carter',
    units: 350,
    status: 'pre-leasing',
    deliveryDate: '2024-07-15',
    deliveryQuarter: 'Q3 2024',
    distance: 1.9,
    address: '675 Boulevard NE, Atlanta, GA 30308',
    rentRange: { min: 1550, max: 2350 },
    amenities: ['Pool', 'Fitness', 'Beltline Access', 'Bike Storage'],
    competitive: false,
    impactLevel: 'low',
    percentLeased: 58,
    coordinates: { lat: 33.7665, lng: -84.3684 }
  }
];

// ==================== UTILITY FUNCTIONS ====================

export const getProjectsByStatus = (projects: PipelineProject[], status: ProjectStatus): PipelineProject[] => {
  return projects.filter(p => p.status === status);
};

export const getProjectsByDistance = (projects: PipelineProject[], maxDistance: number): PipelineProject[] => {
  return projects.filter(p => p.distance <= maxDistance);
};

export const getProjectsByImpact = (projects: PipelineProject[], impact: ImpactLevel): PipelineProject[] => {
  return projects.filter(p => p.impactLevel === impact);
};

export const getProjectsDeliveringInMonths = (projects: PipelineProject[], months: number): PipelineProject[] => {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() + months);
  
  return projects.filter(p => {
    const deliveryDate = new Date(p.deliveryDate);
    return deliveryDate <= cutoffDate && deliveryDate >= new Date();
  });
};

export const calculateSupplyImpact = (projects: PipelineProject[], distances: number[]): Record<string, number> => {
  const impact: Record<string, number> = {};
  
  distances.forEach(distance => {
    const projectsInRadius = getProjectsByDistance(projects, distance);
    impact[`${distance}mi`] = projectsInRadius.reduce((sum, p) => sum + p.units, 0);
  });
  
  return impact;
};

export const getStatusColor = (status: ProjectStatus): string => {
  const colors = {
    'planned': 'bg-gray-100 text-gray-700 border-gray-300',
    'under-construction': 'bg-yellow-100 text-yellow-700 border-yellow-300',
    'pre-leasing': 'bg-blue-100 text-blue-700 border-blue-300',
    'delivered': 'bg-green-100 text-green-700 border-green-300'
  };
  return colors[status];
};

export const getImpactColor = (impact: ImpactLevel): string => {
  const colors = {
    'low': 'bg-green-50 border-green-200 text-green-700',
    'medium': 'bg-yellow-50 border-yellow-200 text-yellow-700',
    'high': 'bg-red-50 border-red-200 text-red-700'
  };
  return colors[impact];
};

export const getImpactBadge = (impact: ImpactLevel): string => {
  const badges = {
    'low': '🟢 Low Impact',
    'medium': '🟡 Medium Impact',
    'high': '🔴 High Impact'
  };
  return badges[impact];
};
