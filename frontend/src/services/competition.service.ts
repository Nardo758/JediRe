import api from './api';

export type DataSource = 'api' | 'apartment' | 'mock';

export interface DataWithSource<T> {
  data: T;
  source: DataSource;
}

export interface CompetitorProperty {
  id: string;
  name: string;
  address: string;
  distance: number;
  units: number;
  yearBuilt: string;
  category: 'direct' | 'construction' | 'planned';
  avgRent?: number;
  occupancy?: number;
  class?: 'A' | 'B' | 'C';
  unitSizes?: {
    studio?: number;
    oneBed?: number;
    twoBed?: number;
    threeBed?: number;
  };
  efficiencyScore?: number;
  needsRenovation?: boolean;
  datedAmenities?: boolean;
  lowOccupancy?: boolean;
  potentialPremium?: number;
  opportunityNote?: string;
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
    competitors: Record<string, boolean>;
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

interface SubmarketData {
  submarket_name?: string;
  name?: string;
  properties_count?: number;
  total_units?: number;
  vacancy_rate?: number;
  avg_rent?: number;
  rent_growth_30d?: number;
  market_pressure?: string;
}

class CompetitionService {
  private async fetchSubmarkets(): Promise<SubmarketData[]> {
    const response = await api.get('/apartment-sync/submarkets', {
      params: { city: 'Atlanta' },
    });
    return response.data.submarkets || response.data || [];
  }

  private mapSubmarketsToCompetitors(submarkets: SubmarketData[], filters: CompetitionFilters): CompetitorProperty[] {
    return submarkets.map((sm, idx) => {
      const vacancyRate = sm.vacancy_rate ?? 5;
      const occupancy = Math.round((1 - vacancyRate / 100) * 100);
      return {
        id: `apt-${idx + 1}`,
        name: sm.submarket_name || sm.name || `Submarket ${idx + 1}`,
        address: `${sm.submarket_name || sm.name || 'Atlanta'} Area`,
        distance: parseFloat((0.5 + idx * 0.3).toFixed(1)),
        units: sm.total_units || sm.properties_count || 0,
        yearBuilt: '2020',
        category: 'direct' as const,
        avgRent: sm.avg_rent ? Math.round(sm.avg_rent) : undefined,
        occupancy,
        class: (occupancy >= 95 ? 'A' : occupancy >= 90 ? 'B' : 'C') as 'A' | 'B' | 'C',
        efficiencyScore: Math.min(100, Math.round(occupancy * 0.9)),
      };
    }).filter(comp => {
      if (filters.distanceRadius && comp.distance > filters.distanceRadius) return false;
      if (filters.sameClass && comp.class !== 'A') return false;
      return true;
    });
  }

  private mapSubmarketsToAdvantageMatrix(submarkets: SubmarketData[]): AdvantageMatrix {
    const top3 = submarkets.slice(0, 3);
    const competitors = top3.map((sm, idx) => ({
      id: `apt-${idx + 1}`,
      name: sm.submarket_name || sm.name || `Submarket ${idx + 1}`,
    }));

    const avgRent = submarkets.reduce((s, sm) => s + (sm.avg_rent || 0), 0) / (submarkets.length || 1);
    const avgVacancy = submarkets.reduce((s, sm) => s + (sm.vacancy_rate || 0), 0) / (submarkets.length || 1);

    const features = [
      {
        name: 'Below-Market Vacancy',
        you: true,
        competitors: Object.fromEntries(top3.map((sm, i) => [`apt-${i + 1}`, (sm.vacancy_rate || 10) < avgVacancy])),
        advantagePoints: 2,
      },
      {
        name: 'Above-Market Rent',
        you: true,
        competitors: Object.fromEntries(top3.map((sm, i) => [`apt-${i + 1}`, (sm.avg_rent || 0) > avgRent])),
        advantagePoints: 2,
      },
      {
        name: 'Positive Rent Growth',
        you: true,
        competitors: Object.fromEntries(top3.map((sm, i) => [`apt-${i + 1}`, (sm.rent_growth_30d || 0) > 0])),
        advantagePoints: 1,
      },
      {
        name: 'Strong Market Pressure',
        you: true,
        competitors: Object.fromEntries(top3.map((sm, i) => [`apt-${i + 1}`, sm.market_pressure === 'high' || sm.market_pressure === 'strong'])),
        advantagePoints: 2,
      },
    ];

    const totalPoints = features.reduce((s, f) => s + f.advantagePoints, 0);
    const differentiators = features.filter(f => f.advantagePoints > 1).map(f => f.name);

    return {
      overallScore: totalPoints,
      competitors,
      features,
      keyDifferentiators: differentiators.length > 0 ? differentiators : ['Market Positioning'],
    };
  }

  private mapSubmarketsToWaitlist(submarkets: SubmarketData[]): WaitlistProperty[] {
    return submarkets
      .filter(sm => (sm.vacancy_rate ?? 10) < 5)
      .slice(0, 3)
      .map((sm, idx) => {
        const vacancyRate = sm.vacancy_rate ?? 3;
        const occupancy = Math.round((1 - vacancyRate / 100) * 100);
        return {
          id: `apt-wait-${idx + 1}`,
          name: sm.submarket_name || sm.name || `Submarket ${idx + 1}`,
          units: sm.total_units || 0,
          distance: parseFloat((0.5 + idx * 0.4).toFixed(1)),
          occupancy,
          waitlistCount: Math.round((100 - vacancyRate) * 0.5),
          avgRent: sm.avg_rent ? Math.round(sm.avg_rent) : 0,
          avgWaitTime: vacancyRate < 2 ? '3-4 months' : '1-2 months',
          demandNote: `${sm.market_pressure || 'Moderate'} market pressure with ${sm.rent_growth_30d?.toFixed(1) || '0'}% rent growth.`,
        };
      });
  }

  private mapSubmarketsToAging(submarkets: SubmarketData[]): CompetitorProperty[] {
    return submarkets
      .filter(sm => (sm.vacancy_rate ?? 0) > 8)
      .slice(0, 3)
      .map((sm, idx) => {
        const vacancyRate = sm.vacancy_rate ?? 10;
        const occupancy = Math.round((1 - vacancyRate / 100) * 100);
        return {
          id: `apt-aging-${idx + 1}`,
          name: sm.submarket_name || sm.name || `Submarket ${idx + 1}`,
          address: `${sm.submarket_name || sm.name || 'Atlanta'} Area`,
          distance: parseFloat((0.7 + idx * 0.5).toFixed(1)),
          units: sm.total_units || 0,
          yearBuilt: '2005',
          category: 'direct' as const,
          avgRent: sm.avg_rent ? Math.round(sm.avg_rent) : 0,
          occupancy,
          class: 'C' as const,
          needsRenovation: vacancyRate > 12,
          datedAmenities: true,
          lowOccupancy: occupancy < 85,
          potentialPremium: Math.round((sm.avg_rent || 1500) * 0.25),
          opportunityNote: `High vacancy (${vacancyRate.toFixed(1)}%) indicates opportunity. Rent growth: ${sm.rent_growth_30d?.toFixed(1) || '0'}%.`,
        };
      });
  }

  async getCompetitors(
    dealId: string,
    filters: CompetitionFilters
  ): Promise<DataWithSource<CompetitorProperty[]>> {
    try {
      const response = await api.get(`/deals/${dealId}/competitors`, {
        params: filters,
      });
      return { data: response.data.competitors || [], source: 'api' };
    } catch {
      try {
        const submarkets = await this.fetchSubmarkets();
        if (submarkets.length > 0) {
          return { data: this.mapSubmarketsToCompetitors(submarkets, filters), source: 'apartment' };
        }
      } catch {}
      return { data: this.getMockCompetitors(filters), source: 'mock' };
    }
  }

  async getAdvantageMatrix(dealId: string): Promise<DataWithSource<AdvantageMatrix>> {
    try {
      const response = await api.get(`/deals/${dealId}/advantage-matrix`);
      return { data: response.data.matrix, source: 'api' };
    } catch {
      try {
        const submarkets = await this.fetchSubmarkets();
        if (submarkets.length > 0) {
          return { data: this.mapSubmarketsToAdvantageMatrix(submarkets), source: 'apartment' };
        }
      } catch {}
      return { data: this.getMockAdvantageMatrix(), source: 'mock' };
    }
  }

  async getWaitlistProperties(
    dealId: string,
    radius: number
  ): Promise<DataWithSource<WaitlistProperty[]>> {
    try {
      const response = await api.get(`/deals/${dealId}/waitlist-properties`, {
        params: { radius },
      });
      return { data: response.data.properties || [], source: 'api' };
    } catch {
      try {
        const submarkets = await this.fetchSubmarkets();
        const mapped = this.mapSubmarketsToWaitlist(submarkets);
        if (mapped.length > 0) {
          return { data: mapped, source: 'apartment' };
        }
      } catch {}
      return { data: this.getMockWaitlistProperties(), source: 'mock' };
    }
  }

  async getAgingCompetitors(
    dealId: string,
    radius: number
  ): Promise<DataWithSource<CompetitorProperty[]>> {
    try {
      const response = await api.get(`/deals/${dealId}/aging-competitors`, {
        params: { radius },
      });
      return { data: response.data.competitors || [], source: 'api' };
    } catch {
      try {
        const submarkets = await this.fetchSubmarkets();
        const mapped = this.mapSubmarketsToAging(submarkets);
        if (mapped.length > 0) {
          return { data: mapped, source: 'apartment' };
        }
      } catch {}
      return { data: this.getMockAgingCompetitors(), source: 'mock' };
    }
  }

  async getAIInsights(dealId: string): Promise<DataWithSource<string>> {
    try {
      const response = await api.get(`/deals/${dealId}/competition-insights`);
      return { data: response.data.insights, source: 'api' };
    } catch {
      try {
        const submarkets = await this.fetchSubmarkets();
        if (submarkets.length > 0) {
          const avgRent = submarkets.reduce((s, sm) => s + (sm.avg_rent || 0), 0) / submarkets.length;
          const avgVacancy = submarkets.reduce((s, sm) => s + (sm.vacancy_rate || 0), 0) / submarkets.length;
          const topSubmarket = submarkets.reduce((best, sm) => (sm.avg_rent || 0) > (best.avg_rent || 0) ? sm : best, submarkets[0]);
          const insights = `📊 Based on ${submarkets.length} Atlanta submarkets:\n\n• Average market rent: $${Math.round(avgRent).toLocaleString()}/mo across all submarkets\n• Average vacancy rate: ${avgVacancy.toFixed(1)}% — ${avgVacancy < 5 ? 'tight market conditions' : 'moderate availability'}\n• Top submarket: ${topSubmarket.submarket_name || topSubmarket.name || 'N/A'} at $${Math.round(topSubmarket.avg_rent || 0).toLocaleString()}/mo\n• Rent growth trend: ${(submarkets.reduce((s, sm) => s + (sm.rent_growth_30d || 0), 0) / submarkets.length).toFixed(1)}% (30-day)\n\nPosition your development to capture demand in high-pressure submarkets with below-average vacancy rates.`;
          return { data: insights, source: 'apartment' };
        }
      } catch {}
      return { data: this.getMockAIInsights(), source: 'mock' };
    }
  }

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

    return baseCompetitors.filter(comp => {
      if (filters.distanceRadius && comp.distance > filters.distanceRadius) {
        return false;
      }
      if (filters.sameClass && comp.class !== 'A') {
        return false;
      }
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
    return `Based on competition analysis, consider:

• Increase 1BR allocation to 45% (+10%) to match high-demand Metro Towers
• Add coworking space (2,000 SF) for +$125/unit premium - only 2 of 6 competitors have this
• Target young professionals from nearby tech campus (5,000 employees within 0.8 mi)
• Position at $1,788/mo rent point to capture waitlist overflow from Metro Towers and The Modern
• Emphasize smart home technology as key differentiator (no competitors have this)
• Design for car-optional lifestyle - 45% of target demographic remote workers

Your development's 9-point advantage score indicates strong differentiation potential. Focus marketing on tech-forward amenities and flexible workspaces to capture underserved demand.`;
  }

  async exportAnalysis(dealId: string): Promise<Blob> {
    try {
      const response = await api.get(`/deals/${dealId}/competition-export`, {
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
