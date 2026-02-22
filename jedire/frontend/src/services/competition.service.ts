/**
 * Competition Analysis Service
 * 
 * Handles data fetching and analysis for competitive properties
 */

import api from './api';

// ============================================================================
// Types
// ============================================================================

export interface CompetitorProperty {
  id: string;
  name: string;
  address: string;
  distance: number; // miles
  units: number;
  yearBuilt: string;
  category: 'direct' | 'construction' | 'planned';
  avgRent?: number;
  occupancy?: number;
  class?: 'A' | 'B' | 'C';
  
  // Unit sizes
  unitSizes?: {
    studio?: number;
    oneBed?: number;
    twoBed?: number;
    threeBed?: number;
  };
  
  // Efficiency
  efficiencyScore?: number;
  
  // Aging properties
  needsRenovation?: boolean;
  datedAmenities?: boolean;
  lowOccupancy?: boolean;
  potentialPremium?: number;
  opportunityNote?: string;
  
  // Location
  latitude?: number;
  longitude?: number;
}

export interface AdvantageMatrix {
  overallScore: number;
  competitors: Array<{
    id: string;
    name: string;
  }>;
  features: Array<{
    name: string;
    you: boolean;
    competitors: Record<string, boolean>; // competitorId -> hasFeature
    advantagePoints: number;
  }>;
  keyDifferentiators: string[];
}

export interface WaitlistProperty {
  id: string;
  name: string;
  units: number;
  distance: number;
  occupancy: number;
  waitlistCount: number;
  avgRent: number;
  avgWaitTime: string;
  demandNote: string;
}

export interface CompetitionFilters {
  sameVintage?: boolean;
  similarSize?: boolean;
  sameClass?: boolean;
  distanceRadius?: number;
}

// ============================================================================
// Service
// ============================================================================

class CompetitionService {
  /**
   * Get competitors for a development deal
   */
  async getCompetitors(
    dealId: string,
    filters: CompetitionFilters
  ): Promise<CompetitorProperty[]> {
    try {
      const response = await api.get(`/api/v1/deals/${dealId}/competitors`, {
        params: filters,
      });
      return response.data.competitors || [];
    } catch (error) {
      console.error('Error fetching competitors:', error);
      // Return mock data for development
      return this.getMockCompetitors(filters);
    }
  }

  /**
   * Get competitive advantage matrix
   */
  async getAdvantageMatrix(dealId: string): Promise<AdvantageMatrix> {
    try {
      const response = await api.get(`/api/v1/deals/${dealId}/advantage-matrix`);
      return response.data.matrix;
    } catch (error) {
      console.error('Error fetching advantage matrix:', error);
      return this.getMockAdvantageMatrix();
    }
  }

  /**
   * Get properties with waitlists
   */
  async getWaitlistProperties(
    dealId: string,
    radius: number
  ): Promise<WaitlistProperty[]> {
    try {
      const response = await api.get(`/api/v1/deals/${dealId}/waitlist-properties`, {
        params: { radius },
      });
      return response.data.properties || [];
    } catch (error) {
      console.error('Error fetching waitlist properties:', error);
      return this.getMockWaitlistProperties();
    }
  }

  /**
   * Get aging competitors
   */
  async getAgingCompetitors(
    dealId: string,
    radius: number
  ): Promise<CompetitorProperty[]> {
    try {
      const response = await api.get(`/api/v1/deals/${dealId}/aging-competitors`, {
        params: { radius },
      });
      return response.data.competitors || [];
    } catch (error) {
      console.error('Error fetching aging competitors:', error);
      return this.getMockAgingCompetitors();
    }
  }

  /**
   * Get AI-generated competitive insights
   */
  async getAIInsights(dealId: string): Promise<string> {
    try {
      const response = await api.get(`/api/v1/deals/${dealId}/competition-insights`);
      return response.data.insights;
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      return this.getMockAIInsights();
    }
  }

  // ============================================================================
  // Mock Data (for development/testing)
  // ============================================================================

  private getMockCompetitors(filters: CompetitionFilters): CompetitorProperty[] {
    const baseCompetitors: CompetitorProperty[] = [
      {
        id: 'comp-1',
        name: 'Metro Towers',
        address: '123 Peachtree St NE',
        distance: 0.4,
        units: 287,
        yearBuilt: '2020',
        category: 'direct',
        avgRent: 1850,
        occupancy: 98,
        class: 'A',
        unitSizes: { studio: 550, oneBed: 750, twoBed: 1100, threeBed: 1400 },
        efficiencyScore: 82,
        latitude: 33.7710,
        longitude: -84.3880,
      },
      {
        id: 'comp-2',
        name: 'The Modern',
        address: '456 Spring St NW',
        distance: 0.6,
        units: 312,
        yearBuilt: '2021',
        category: 'direct',
        avgRent: 1725,
        occupancy: 97,
        class: 'A',
        unitSizes: { studio: 525, oneBed: 680, twoBed: 1050, threeBed: 1350 },
        efficiencyScore: 78,
        latitude: 33.7720,
        longitude: -84.3890,
      },
      {
        id: 'comp-3',
        name: 'Skyline Residences',
        address: '789 West Peachtree St',
        distance: 0.8,
        units: 425,
        yearBuilt: '2019',
        category: 'direct',
        avgRent: 1900,
        occupancy: 95,
        class: 'A',
        unitSizes: { oneBed: 720, twoBed: 1080, threeBed: 1420 },
        efficiencyScore: 80,
        latitude: 33.7730,
        longitude: -84.3870,
      },
      {
        id: 'comp-4',
        name: 'Midtown Heights',
        address: '321 10th Street NW',
        distance: 0.9,
        units: 198,
        yearBuilt: '2022',
        category: 'construction',
        avgRent: 1950,
        occupancy: 85,
        class: 'A',
        unitSizes: { studio: 575, oneBed: 780, twoBed: 1150 },
        efficiencyScore: 85,
        latitude: 33.7750,
        longitude: -84.3860,
      },
      {
        id: 'comp-5',
        name: 'Park Place',
        address: '654 14th Street NE',
        distance: 1.1,
        units: 356,
        yearBuilt: '2018',
        category: 'direct',
        avgRent: 1625,
        occupancy: 93,
        class: 'B',
        unitSizes: { oneBed: 650, twoBed: 1000, threeBed: 1300 },
        efficiencyScore: 75,
        latitude: 33.7760,
        longitude: -84.3850,
      },
      {
        id: 'comp-6',
        name: 'Renaissance Square',
        address: '987 Juniper St NE',
        distance: 1.3,
        units: 275,
        yearBuilt: '2024',
        category: 'planned',
        avgRent: 2100,
        class: 'A',
        unitSizes: { studio: 600, oneBed: 800, twoBed: 1200 },
        efficiencyScore: 88,
        latitude: 33.7770,
        longitude: -84.3840,
      },
    ];

    // Apply filters
    return baseCompetitors.filter(comp => {
      if (filters.distanceRadius && comp.distance > filters.distanceRadius) {
        return false;
      }
      if (filters.sameClass && comp.class !== 'A') {
        return false;
      }
      // Additional filtering logic can be added here
      return true;
    });
  }

  private getMockAdvantageMatrix(): AdvantageMatrix {
    return {
      overallScore: 9,
      competitors: [
        { id: 'comp-1', name: 'Metro Towers' },
        { id: 'comp-2', name: 'The Modern' },
        { id: 'comp-3', name: 'Skyline' },
      ],
      features: [
        {
          name: 'Coworking Space',
          you: true,
          competitors: { 'comp-1': false, 'comp-2': false, 'comp-3': true },
          advantagePoints: 2,
        },
        {
          name: 'EV Charging',
          you: true,
          competitors: { 'comp-1': false, 'comp-2': false, 'comp-3': false },
          advantagePoints: 3,
        },
        {
          name: 'Pet Amenities',
          you: true,
          competitors: { 'comp-1': true, 'comp-2': false, 'comp-3': true },
          advantagePoints: 0,
        },
        {
          name: 'All Units with Balconies',
          you: true,
          competitors: { 'comp-1': false, 'comp-2': true, 'comp-3': true },
          advantagePoints: 1,
        },
        {
          name: 'In-unit W/D',
          you: true,
          competitors: { 'comp-1': false, 'comp-2': true, 'comp-3': true },
          advantagePoints: 0,
        },
        {
          name: 'Smart Home Tech',
          you: true,
          competitors: { 'comp-1': false, 'comp-2': false, 'comp-3': false },
          advantagePoints: 3,
        },
        {
          name: 'Rooftop Pool',
          you: true,
          competitors: { 'comp-1': true, 'comp-2': true, 'comp-3': true },
          advantagePoints: 0,
        },
        {
          name: 'Fitness Center',
          you: true,
          competitors: { 'comp-1': true, 'comp-2': true, 'comp-3': true },
          advantagePoints: 0,
        },
        {
          name: 'Package Lockers',
          you: true,
          competitors: { 'comp-1': true, 'comp-2': false, 'comp-3': true },
          advantagePoints: 0,
        },
      ],
      keyDifferentiators: ['EV Charging', 'Smart Home Tech', 'Coworking Space'],
    };
  }

  private getMockWaitlistProperties(): WaitlistProperty[] {
    return [
      {
        id: 'wait-1',
        name: 'Metro Towers',
        units: 287,
        distance: 0.4,
        occupancy: 98,
        waitlistCount: 45,
        avgRent: 1850,
        avgWaitTime: '3-4 months',
        demandNote: 'Highest demand for 1BR units. Strong young professional demographic.',
      },
      {
        id: 'wait-2',
        name: 'The Modern',
        units: 312,
        distance: 0.6,
        occupancy: 97,
        waitlistCount: 32,
        avgRent: 1725,
        avgWaitTime: '2-3 months',
        demandNote: 'Pet-friendly units in highest demand. Near tech campus.',
      },
      {
        id: 'wait-3',
        name: 'Skyline Residences',
        units: 425,
        distance: 0.8,
        occupancy: 95,
        waitlistCount: 28,
        avgRent: 1900,
        avgWaitTime: '2 months',
        demandNote: 'Premium units with city views. High-income renters.',
      },
    ];
  }

  private getMockAgingCompetitors(): CompetitorProperty[] {
    return [
      {
        id: 'aging-1',
        name: 'Sunset Apartments',
        address: '456 Boulevard NE',
        distance: 0.7,
        units: 186,
        yearBuilt: '1998',
        category: 'direct',
        avgRent: 1250,
        occupancy: 82,
        class: 'B',
        needsRenovation: true,
        datedAmenities: true,
        lowOccupancy: true,
        potentialPremium: 400,
        opportunityNote: '26-year-old property needs $8M+ renovation. Capture displaced residents with modern amenities.',
      },
      {
        id: 'aging-2',
        name: 'Park Place',
        address: '789 Monroe Drive',
        distance: 1.2,
        units: 124,
        yearBuilt: '2005',
        category: 'direct',
        avgRent: 1350,
        occupancy: 78,
        class: 'C',
        needsRenovation: false,
        datedAmenities: true,
        lowOccupancy: true,
        potentialPremium: 350,
        opportunityNote: '19-year-old property with declining occupancy. Update amenities to capture $350/unit premium.',
      },
      {
        id: 'aging-3',
        name: 'Colonial Square',
        address: '321 Ponce de Leon',
        distance: 1.5,
        units: 98,
        yearBuilt: '1995',
        category: 'direct',
        avgRent: 1150,
        occupancy: 75,
        class: 'C',
        needsRenovation: true,
        datedAmenities: true,
        lowOccupancy: true,
        potentialPremium: 500,
        opportunityNote: '29-year-old property struggling to compete. Prime location with significant upside potential.',
      },
    ];
  }

  private getMockAIInsights(): string {
    return `💡 Based on competition analysis, consider:

• Increase 1BR allocation to 45% (+10%) to match high-demand Metro Towers
• Add coworking space (2,000 SF) for +$125/unit premium - only 2 of 6 competitors have this
• Target young professionals from nearby tech campus (5,000 employees within 0.8 mi)
• Position at $1,788/mo rent point to capture waitlist overflow from Metro Towers and The Modern
• Emphasize smart home technology as key differentiator (no competitors have this)
• Design for car-optional lifestyle - 45% of target demographic remote workers

Your development's 9-point advantage score indicates strong differentiation potential. Focus marketing on tech-forward amenities and flexible workspaces to capture underserved demand.`;
  }

  /**
   * Export competition analysis to CSV
   */
  async exportAnalysis(dealId: string): Promise<Blob> {
    try {
      const response = await api.get(`/api/v1/deals/${dealId}/competition-export`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting analysis:', error);
      throw error;
    }
  }
}

export const competitionService = new CompetitionService();
