/**
 * Mock Data for Competition Analysis Section
 * Provides realistic comparable properties and competitive analysis data
 * for both acquisition and performance modes
 */

export interface ComparableProperty {
  id: string;
  name: string;
  address: string;
  distance: number; // miles
  units: number;
  yearBuilt: number;
  avgRent: number;
  pricePerUnit?: number; // Acquisition mode
  capRate?: number; // Acquisition mode
  occupancy?: number; // Performance mode
  similarityScore: number; // 0-100
  photoUrl?: string;
  amenities: string[];
  class: 'A' | 'B' | 'C';
}

export interface QuickStat {
  label: string;
  value: string | number;
  icon: string;
  format?: 'currency' | 'percentage' | 'text' | 'number';
  subtext?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
}

export interface MarketPositioning {
  label: string;
  value: number;
  percentile: number;
  color: 'green' | 'yellow' | 'red';
}

export interface CompetitiveThreat {
  id: string;
  property: string;
  threatLevel: 'high' | 'medium' | 'low';
  reason: string;
  impact: string;
  distance: number;
}

// ==================== ACQUISITION MODE DATA ====================

export const acquisitionComparables: ComparableProperty[] = [
  {
    id: 'comp-1',
    name: 'Piedmont Heights',
    address: '1150 Peachtree St NE, Atlanta, GA',
    distance: 0.5,
    units: 240,
    yearBuilt: 2019,
    avgRent: 1850,
    pricePerUnit: 185000,
    capRate: 6.4,
    similarityScore: 92,
    photoUrl: '/assets/comp1.jpg',
    amenities: ['Pool', 'Gym', 'Parking', 'Pet Friendly'],
    class: 'A'
  },
  {
    id: 'comp-2',
    name: 'Atlantic Station Lofts',
    address: '250 17th St NW, Atlanta, GA',
    distance: 0.8,
    units: 180,
    yearBuilt: 2018,
    avgRent: 1750,
    pricePerUnit: 172000,
    capRate: 6.8,
    similarityScore: 88,
    photoUrl: '/assets/comp2.jpg',
    amenities: ['Pool', 'Gym', 'Concierge'],
    class: 'A'
  },
  {
    id: 'comp-3',
    name: 'Buckhead Exchange',
    address: '3330 Piedmont Rd NE, Atlanta, GA',
    distance: 1.2,
    units: 300,
    yearBuilt: 2020,
    avgRent: 1950,
    pricePerUnit: 195000,
    capRate: 6.2,
    similarityScore: 85,
    photoUrl: '/assets/comp3.jpg',
    amenities: ['Pool', 'Gym', 'Rooftop Deck', 'Parking'],
    class: 'A'
  },
  {
    id: 'comp-4',
    name: 'Midtown Green',
    address: '800 Peachtree St NE, Atlanta, GA',
    distance: 0.6,
    units: 195,
    yearBuilt: 2017,
    avgRent: 1675,
    pricePerUnit: 168000,
    capRate: 7.0,
    similarityScore: 80,
    photoUrl: '/assets/comp4.jpg',
    amenities: ['Gym', 'Parking', 'Business Center'],
    class: 'B'
  },
  {
    id: 'comp-5',
    name: 'Colony Square',
    address: '1197 Peachtree St NE, Atlanta, GA',
    distance: 0.9,
    units: 210,
    yearBuilt: 2021,
    avgRent: 2050,
    pricePerUnit: 205000,
    capRate: 5.9,
    similarityScore: 78,
    photoUrl: '/assets/comp5.jpg',
    amenities: ['Pool', 'Gym', 'Co-working', 'Rooftop'],
    class: 'A'
  }
];

export const acquisitionStats: QuickStat[] = [
  {
    label: 'Avg Price/Unit',
    value: 185000,
    icon: '💰',
    format: 'currency',
    subtext: 'Market average'
  },
  {
    label: 'Market Cap Rate',
    value: 6.5,
    icon: '📊',
    format: 'percentage',
    subtext: 'Weighted avg'
  },
  {
    label: 'Avg Rent/Unit',
    value: 1855,
    icon: '🏠',
    format: 'currency',
    subtext: 'Class A comps'
  },
  {
    label: 'Market Velocity',
    value: 42,
    icon: '⚡',
    format: 'number',
    subtext: 'days on market',
    trend: {
      direction: 'down',
      value: '-12%'
    }
  },
  {
    label: 'Comps in Range',
    value: 5,
    icon: '🎯',
    format: 'number',
    subtext: 'Within 1.5 mi'
  }
];

export const acquisitionPositioning: MarketPositioning[] = [
  {
    label: 'Price Competitiveness',
    value: 78,
    percentile: 65,
    color: 'green'
  },
  {
    label: 'Rent Premium',
    value: 12,
    percentile: 58,
    color: 'yellow'
  },
  {
    label: 'Value Score',
    value: 85,
    percentile: 72,
    color: 'green'
  }
];

// ==================== PERFORMANCE MODE DATA ====================

export const performanceComparables: ComparableProperty[] = [
  {
    id: 'comp-1',
    name: 'Piedmont Heights',
    address: '1150 Peachtree St NE, Atlanta, GA',
    distance: 0.5,
    units: 240,
    yearBuilt: 2019,
    avgRent: 1875,
    occupancy: 96,
    similarityScore: 92,
    photoUrl: '/assets/comp1.jpg',
    amenities: ['Pool', 'Gym', 'Parking', 'Pet Friendly'],
    class: 'A'
  },
  {
    id: 'comp-2',
    name: 'Atlantic Station Lofts',
    address: '250 17th St NW, Atlanta, GA',
    distance: 0.8,
    units: 180,
    yearBuilt: 2018,
    avgRent: 1795,
    occupancy: 93,
    similarityScore: 88,
    photoUrl: '/assets/comp2.jpg',
    amenities: ['Pool', 'Gym', 'Concierge'],
    class: 'A'
  },
  {
    id: 'comp-3',
    name: 'Buckhead Exchange',
    address: '3330 Piedmont Rd NE, Atlanta, GA',
    distance: 1.2,
    units: 300,
    yearBuilt: 2020,
    avgRent: 1980,
    occupancy: 97,
    similarityScore: 85,
    photoUrl: '/assets/comp3.jpg',
    amenities: ['Pool', 'Gym', 'Rooftop Deck', 'Parking'],
    class: 'A'
  },
  {
    id: 'comp-4',
    name: 'Midtown Green',
    address: '800 Peachtree St NE, Atlanta, GA',
    distance: 0.6,
    units: 195,
    yearBuilt: 2017,
    avgRent: 1725,
    occupancy: 91,
    similarityScore: 80,
    photoUrl: '/assets/comp4.jpg',
    amenities: ['Gym', 'Parking', 'Business Center'],
    class: 'B'
  },
  {
    id: 'comp-5',
    name: 'Colony Square',
    address: '1197 Peachtree St NE, Atlanta, GA',
    distance: 0.9,
    units: 210,
    yearBuilt: 2021,
    avgRent: 2100,
    occupancy: 98,
    similarityScore: 78,
    photoUrl: '/assets/comp5.jpg',
    amenities: ['Pool', 'Gym', 'Co-working', 'Rooftop'],
    class: 'A'
  }
];

export const performanceStats: QuickStat[] = [
  {
    label: 'Market Avg Rent',
    value: 1895,
    icon: '💵',
    format: 'currency',
    trend: {
      direction: 'up',
      value: '+3.2%'
    }
  },
  {
    label: 'Market Occupancy',
    value: 95,
    icon: '📈',
    format: 'percentage',
    subtext: 'Class A avg'
  },
  {
    label: 'Our Position',
    value: 96.7,
    icon: '🏆',
    format: 'percentage',
    subtext: 'Top 15%',
    trend: {
      direction: 'up',
      value: '+1.5%'
    }
  },
  {
    label: 'Rent Premium',
    value: 2.8,
    icon: '⬆️',
    format: 'percentage',
    subtext: 'vs market avg'
  },
  {
    label: 'Market Share',
    value: 8.2,
    icon: '📊',
    format: 'percentage',
    subtext: 'Within 1 mi'
  }
];

export const performancePositioning: MarketPositioning[] = [
  {
    label: 'Occupancy Rank',
    value: 96,
    percentile: 85,
    color: 'green'
  },
  {
    label: 'Rent Position',
    value: 103,
    percentile: 62,
    color: 'yellow'
  },
  {
    label: 'Competitive Score',
    value: 88,
    percentile: 78,
    color: 'green'
  }
];

export const competitiveThreats: CompetitiveThreat[] = [
  {
    id: 'threat-1',
    property: 'Buckhead Exchange',
    threatLevel: 'high',
    reason: 'Recent renovation and aggressive pricing',
    impact: 'Potential 2-3% occupancy impact',
    distance: 1.2
  },
  {
    id: 'threat-2',
    property: 'Colony Square',
    threatLevel: 'medium',
    reason: 'New luxury amenities launched',
    impact: 'Premium positioning challenged',
    distance: 0.9
  },
  {
    id: 'threat-3',
    property: 'New Development (Planned)',
    threatLevel: 'medium',
    reason: '350-unit project breaking ground Q3 2024',
    impact: 'Future supply increase',
    distance: 0.7
  }
];

export const marketShareData = [
  { property: 'Our Property', units: 250, share: 8.2, occupancy: 96 },
  { property: 'Piedmont Heights', units: 240, share: 7.9, occupancy: 96 },
  { property: 'Buckhead Exchange', units: 300, share: 9.9, occupancy: 97 },
  { property: 'Colony Square', units: 210, share: 6.9, occupancy: 98 },
  { property: 'Others', units: 2050, share: 67.1, occupancy: 93 }
];
