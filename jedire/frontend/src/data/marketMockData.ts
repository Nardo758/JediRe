/**
 * Mock Data for Dual-Mode Market Section
 * Provides comprehensive market analysis data for acquisition and performance modes
 */

export interface DemographicStat {
  label: string;
  value: string | number;
  icon: string;
  format?: 'currency' | 'percentage' | 'number' | 'text';
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
}

export interface MarketTrend {
  label: string;
  current: number;
  historical: number[];
  unit: string;
  format: 'currency' | 'percentage' | 'number';
}

export interface SwotItem {
  id: string;
  category: 'strength' | 'weakness' | 'opportunity' | 'threat';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface SubmarketComparison {
  name: string;
  rentGrowth: number;
  vacancy: number;
  avgRent: number;
  population: number;
  isTarget: boolean;
}

export interface MarketSentiment {
  overall: 'hot' | 'warm' | 'neutral' | 'cool' | 'cold';
  score: number; // 0-100
  factors: {
    demandSupply: number;
    priceGrowth: number;
    economicHealth: number;
    investorInterest: number;
  };
}

// ==================== ACQUISITION MODE DATA ====================

export const acquisitionDemographics: DemographicStat[] = [
  {
    label: 'Population',
    value: 487000,
    icon: '👥',
    format: 'number',
    trend: {
      direction: 'up',
      value: '+2.8%/yr'
    }
  },
  {
    label: 'Median Income',
    value: 68500,
    icon: '💵',
    format: 'currency',
    trend: {
      direction: 'up',
      value: '+3.1%/yr'
    }
  },
  {
    label: 'Median Age',
    value: 34.2,
    icon: '📅',
    format: 'number'
  },
  {
    label: 'Employment Rate',
    value: 96.2,
    icon: '💼',
    format: 'percentage',
    trend: {
      direction: 'up',
      value: '+0.5%'
    }
  },
  {
    label: 'College Educated',
    value: 58,
    icon: '🎓',
    format: 'percentage'
  }
];

export const acquisitionMarketTrends: MarketTrend[] = [
  {
    label: 'Rent Growth',
    current: 5.2,
    historical: [2.1, 2.8, 3.5, 4.2, 4.8, 5.2],
    unit: '%',
    format: 'percentage'
  },
  {
    label: 'Property Value Appreciation',
    current: 8.5,
    historical: [3.2, 4.1, 5.5, 6.8, 7.5, 8.5],
    unit: '%',
    format: 'percentage'
  },
  {
    label: 'New Construction (Units)',
    current: 1245,
    historical: [890, 950, 1050, 1180, 1220, 1245],
    unit: 'units',
    format: 'number'
  }
];

export const acquisitionSwot: SwotItem[] = [
  // Strengths
  {
    id: 's1',
    category: 'strength',
    title: 'Strong Population Growth',
    description: 'Metro area adding 13,500+ residents annually, driven by corporate relocations',
    impact: 'high'
  },
  {
    id: 's2',
    category: 'strength',
    title: 'High-Income Demographics',
    description: 'Median household income 25% above national average with upward trajectory',
    impact: 'high'
  },
  {
    id: 's3',
    category: 'strength',
    title: 'Limited New Supply',
    description: 'Only 1,245 units delivered vs 1,580 absorbed in past 12 months',
    impact: 'medium'
  },
  
  // Weaknesses
  {
    id: 'w1',
    category: 'weakness',
    title: 'Rising Construction Costs',
    description: 'Development costs up 12% YoY, may impact future competition',
    impact: 'medium'
  },
  {
    id: 'w2',
    category: 'weakness',
    title: 'Traffic Congestion',
    description: 'Increasing commute times may affect tenant appeal in outer submarkets',
    impact: 'low'
  },
  
  // Opportunities
  {
    id: 'o1',
    category: 'opportunity',
    title: 'Tech Hub Expansion',
    description: 'Major tech companies announcing 5,000+ new jobs in metro area',
    impact: 'high'
  },
  {
    id: 'o2',
    category: 'opportunity',
    title: 'Infrastructure Investment',
    description: 'New transit line opening Q3 2025 will enhance submarket connectivity',
    impact: 'high'
  },
  {
    id: 'o3',
    category: 'opportunity',
    title: 'Remote Work Evolution',
    description: 'Shift to hybrid work increasing demand for premium amenities',
    impact: 'medium'
  },
  
  // Threats
  {
    id: 't1',
    category: 'threat',
    title: 'Interest Rate Sensitivity',
    description: 'Rising rates may pressure cap rates and property valuations',
    impact: 'high'
  },
  {
    id: 't2',
    category: 'threat',
    title: 'Pipeline Risk',
    description: '890 units in development pipeline may increase competition',
    impact: 'medium'
  }
];

export const acquisitionSubmarkets: SubmarketComparison[] = [
  {
    name: 'Buckhead',
    rentGrowth: 5.2,
    vacancy: 4.2,
    avgRent: 1850,
    population: 85000,
    isTarget: true
  },
  {
    name: 'Midtown',
    rentGrowth: 4.8,
    vacancy: 5.1,
    avgRent: 1720,
    population: 62000,
    isTarget: false
  },
  {
    name: 'Virginia Highland',
    rentGrowth: 6.1,
    vacancy: 3.5,
    avgRent: 1920,
    population: 28000,
    isTarget: false
  },
  {
    name: 'Decatur',
    rentGrowth: 4.2,
    vacancy: 4.8,
    avgRent: 1650,
    population: 54000,
    isTarget: false
  }
];

export const acquisitionSentiment: MarketSentiment = {
  overall: 'warm',
  score: 72,
  factors: {
    demandSupply: 78,
    priceGrowth: 82,
    economicHealth: 68,
    investorInterest: 65
  }
};

// ==================== PERFORMANCE MODE DATA ====================

export const performanceDemographics: DemographicStat[] = [
  {
    label: 'Trade Area Pop',
    value: 124000,
    icon: '📍',
    format: 'number',
    trend: {
      direction: 'up',
      value: '+1.9%/yr'
    }
  },
  {
    label: 'Household Income',
    value: 72300,
    icon: '💵',
    format: 'currency',
    trend: {
      direction: 'up',
      value: '+2.8%/yr'
    }
  },
  {
    label: 'Renter Households',
    value: 62,
    icon: '🏠',
    format: 'percentage'
  },
  {
    label: 'Job Growth',
    value: 3.5,
    icon: '💼',
    format: 'percentage',
    trend: {
      direction: 'up',
      value: '+0.8%'
    }
  },
  {
    label: 'Walk Score',
    value: 78,
    icon: '🚶',
    format: 'number'
  }
];

export const performanceMarketTrends: MarketTrend[] = [
  {
    label: 'Market Rent Growth',
    current: 4.8,
    historical: [2.5, 3.1, 3.8, 4.2, 4.5, 4.8],
    unit: '%',
    format: 'percentage'
  },
  {
    label: 'Submarket Vacancy',
    current: 4.5,
    historical: [6.2, 5.8, 5.2, 4.9, 4.7, 4.5],
    unit: '%',
    format: 'percentage'
  },
  {
    label: 'Competitive Set Avg Rent',
    current: 1875,
    historical: [1620, 1680, 1725, 1780, 1825, 1875],
    unit: '$',
    format: 'currency'
  }
];

export const performanceSwot: SwotItem[] = [
  // Strengths
  {
    id: 'ps1',
    category: 'strength',
    title: 'Strong Competitive Position',
    description: 'Property outperforming submarket avg rent by 8% with higher occupancy',
    impact: 'high'
  },
  {
    id: 'ps2',
    category: 'strength',
    title: 'Premium Location',
    description: 'Walk score of 78, excellent transit access, high demand trade area',
    impact: 'high'
  },
  {
    id: 'ps3',
    category: 'strength',
    title: 'Recent Renovations',
    description: 'Common areas and 40% of units upgraded, commanding premium rents',
    impact: 'medium'
  },
  
  // Weaknesses
  {
    id: 'pw1',
    category: 'weakness',
    title: 'Aging Building Systems',
    description: 'HVAC and elevator systems approaching end of useful life',
    impact: 'medium'
  },
  {
    id: 'pw2',
    category: 'weakness',
    title: 'Below-Market Parking Ratio',
    description: 'Only 0.8 spaces per unit vs submarket avg of 1.2',
    impact: 'low'
  },
  
  // Opportunities
  {
    id: 'po1',
    category: 'opportunity',
    title: 'Value-Add Potential',
    description: '60% of units still at classic spec, $150-200/mo rent premium potential',
    impact: 'high'
  },
  {
    id: 'po2',
    category: 'opportunity',
    title: 'Refinancing Window',
    description: 'NOI growth supports refi at improved terms, extract equity',
    impact: 'high'
  },
  {
    id: 'po3',
    category: 'opportunity',
    title: 'Strong Exit Market',
    description: 'Cap rates compressed 50bps in submarket over past 18 months',
    impact: 'medium'
  },
  
  // Threats
  {
    id: 'pt1',
    category: 'threat',
    title: 'New Competition',
    description: '220-unit Class A property delivering 0.3 miles away Q2 2024',
    impact: 'high'
  },
  {
    id: 'pt2',
    category: 'threat',
    title: 'Economic Headwinds',
    description: 'Potential recession could impact rent growth and retention',
    impact: 'medium'
  }
];

export const performanceSubmarkets: SubmarketComparison[] = [
  {
    name: 'Midtown (Current)',
    rentGrowth: 4.8,
    vacancy: 4.5,
    avgRent: 1825,
    population: 62000,
    isTarget: true
  },
  {
    name: 'Buckhead',
    rentGrowth: 5.2,
    vacancy: 4.2,
    avgRent: 1850,
    population: 85000,
    isTarget: false
  },
  {
    name: 'Ansley Park',
    rentGrowth: 5.5,
    vacancy: 3.8,
    avgRent: 1950,
    population: 18000,
    isTarget: false
  },
  {
    name: 'Old Fourth Ward',
    rentGrowth: 6.2,
    vacancy: 4.1,
    avgRent: 1780,
    population: 35000,
    isTarget: false
  }
];

export const performanceSentiment: MarketSentiment = {
  overall: 'warm',
  score: 75,
  factors: {
    demandSupply: 80,
    priceGrowth: 75,
    economicHealth: 72,
    investorInterest: 73
  }
};
