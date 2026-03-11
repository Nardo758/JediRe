import { getPool } from '../database/connection';
import { f40PerformanceScoreService, F40Score, SubmarketF40Score } from './f40-performance-score.service';
import { Pool } from 'pg';

export interface OpportunityScore {
  submarketName: string;
  city: string;
  marketScore: number;
  propertyScore: number;
  opportunityScore: number;
  estimatedUpsidePercent: number;
  estimatedUpsideDollar: number;
  strategy: 'renovate' | 'rebrand' | 'reposition' | 'acquire';
  strategyRationale: string;
  signals: OpportunitySignal[];
  rank: number;
  quartile: number;
}

export interface OpportunitySignal {
  type: 'supply' | 'demand' | 'pricing' | 'vintage' | 'occupancy';
  label: string;
  value: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  weight: number;
}

export interface DemandBudget {
  avg: number;
  median: number;
  min: number;
  max: number;
}

export interface BedroomDemand {
  studio: number;
  oneBed: number;
  twoBed: number;
  threePlusBed: number;
}

export interface CommutePreferences {
  maxCommuteMinutes: number;
  preferredModes: string[];
  topEmploymentCenters: string[];
}

export interface LocationDemand {
  topCities: Array<{ city: string; state?: string; count: number }>;
  topNeighborhoods: string[];
  topZipCodes: string[];
}

export interface MoveInTimeline {
  immediate: number;
  within30Days: number;
  within60Days: number;
  within90Days: number;
  moreThan90Days: number;
}

export interface EnrichedDemandData {
  activeRenters: number;
  topAmenities: string[];
  dealBreakers: string[];
  apartmentFeatures: Array<{ name: string; count: number }>;
  budget: DemandBudget;
  bedroomDemand: BedroomDemand;
  commutePreferences: CommutePreferences;
  locationDemand: LocationDemand;
  moveInTimeline: MoveInTimeline;
  lifestylePriorities: string[];
  setupStats: { totalProfiles: number; avgCompleteness: number };
  preferredCities: Array<{ city: string; count: number }>;
}

export interface OpportunityEngineResult {
  opportunities: OpportunityScore[];
  marketSummary: {
    city: string;
    avgMarketScore: number;
    totalSubmarkets: number;
    topOpportunitySubmarket: string;
    avgUpsidePercent: number;
  };
  calculatedAt: string;
}

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

export class OpportunityEngineService {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  async detectOpportunities(city: string = 'Atlanta'): Promise<OpportunityEngineResult> {
    const marketData = await f40PerformanceScoreService.calculateMarketF40(city);
    if (!marketData || marketData.submarketScores.length === 0) {
      return {
        opportunities: [],
        marketSummary: { city, avgMarketScore: 0, totalSubmarkets: 0, topOpportunitySubmarket: '', avgUpsidePercent: 0 },
        calculatedAt: new Date().toISOString(),
      };
    }

    const trendData = await this.getTrendData(city);
    const demandData = await this.getDemandData(city);

    const opportunities = marketData.submarketScores.map((sm, idx) => {
      return this.scoreSubmarketOpportunity(sm, marketData.avgScore, trendData, demandData, city);
    });

    opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);
    opportunities.forEach((opp, idx) => {
      opp.rank = idx + 1;
      opp.quartile = Math.ceil((idx + 1) / Math.max(1, opportunities.length / 4));
    });

    const avgUpside = opportunities.length > 0
      ? opportunities.reduce((s, o) => s + o.estimatedUpsidePercent, 0) / opportunities.length
      : 0;

    return {
      opportunities,
      marketSummary: {
        city,
        avgMarketScore: marketData.avgScore,
        totalSubmarkets: opportunities.length,
        topOpportunitySubmarket: opportunities[0]?.submarketName || '',
        avgUpsidePercent: Math.round(avgUpside * 10) / 10,
      },
      calculatedAt: new Date().toISOString(),
    };
  }

  private scoreSubmarketOpportunity(
    sm: SubmarketF40Score,
    marketAvg: number,
    trends: any,
    demand: any,
    city: string = 'Atlanta'
  ): OpportunityScore {
    const dims = sm.dimensions;
    const signals: OpportunitySignal[] = [];

    const occupancyRate = 1 - (this.getSubmarketVacancy(sm) || 0.1);
    const rentGrowth = this.getSubmarketRentGrowth(sm);
    const avgRent = this.getSubmarketAvgRent(sm);

    const marketStrength = clamp(
      (dims.occupancyStrength.score * 0.35) +
      (dims.rentPosition.score * 0.30) +
      (dims.pricingPower.score * 0.20) +
      (this.demandSignalScore(demand) * 0.15)
    );

    const propertyWeakness = clamp(100 - sm.overallScore);

    const rawOpp = (marketStrength * 0.6) + (propertyWeakness * 0.4);
    const opportunityScore = clamp(Math.round(rawOpp));

    if (occupancyRate > 0.92) {
      signals.push({ type: 'occupancy', label: 'High occupancy', value: `${(occupancyRate * 100).toFixed(1)}%`, direction: 'bullish', weight: 25 });
    } else if (occupancyRate < 0.85) {
      signals.push({ type: 'occupancy', label: 'Low occupancy', value: `${(occupancyRate * 100).toFixed(1)}%`, direction: 'bearish', weight: 25 });
    } else {
      signals.push({ type: 'occupancy', label: 'Moderate occupancy', value: `${(occupancyRate * 100).toFixed(1)}%`, direction: 'neutral', weight: 15 });
    }

    if (rentGrowth > 0.02) {
      signals.push({ type: 'pricing', label: 'Rent growth positive', value: `+${(rentGrowth * 100).toFixed(1)}%`, direction: 'bullish', weight: 20 });
    } else if (rentGrowth < -0.01) {
      signals.push({ type: 'pricing', label: 'Rent declining', value: `${(rentGrowth * 100).toFixed(1)}%`, direction: 'bearish', weight: 20 });
    }

    if (dims.pricingPower.score < 40) {
      signals.push({ type: 'pricing', label: 'High concession load', value: `Score: ${dims.pricingPower.score}`, direction: 'bearish', weight: 15 });
    }

    if (dims.vintagePhysical.score < 45) {
      signals.push({ type: 'vintage', label: 'Aging stock opportunity', value: `Score: ${dims.vintagePhysical.score}`, direction: 'bullish', weight: 20 });
    }

    const supplyPressure = trends?.supplyPressure || 0.5;
    if (supplyPressure < 0.8) {
      signals.push({ type: 'supply', label: 'Low supply pressure', value: `${(supplyPressure).toFixed(2)}x`, direction: 'bullish', weight: 15 });
    } else if (supplyPressure > 1.2) {
      signals.push({ type: 'supply', label: 'High supply pressure', value: `${(supplyPressure).toFixed(2)}x`, direction: 'bearish', weight: 15 });
    }

    if (demand?.activeRenters && demand.activeRenters > 1000) {
      signals.push({ type: 'demand', label: 'Strong renter demand', value: `${demand.activeRenters.toLocaleString()} active`, direction: 'bullish', weight: 20 });
    }

    const { strategy, rationale, upsidePercent } = this.determineStrategy(dims, occupancyRate, rentGrowth, avgRent, marketAvg, sm.overallScore);

    const upsideDollar = Math.round(avgRent * sm.totalUnits * 12 * (upsidePercent / 100));

    return {
      submarketName: sm.submarketName || sm.peerGroup || 'Unknown',
      city: sm.city || city,
      marketScore: Math.round(marketStrength),
      propertyScore: sm.overallScore,
      opportunityScore,
      estimatedUpsidePercent: upsidePercent,
      estimatedUpsideDollar: upsideDollar,
      strategy,
      strategyRationale: rationale,
      signals,
      rank: 0,
      quartile: 0,
    };
  }

  private determineStrategy(
    dims: any,
    occupancy: number,
    rentGrowth: number,
    avgRent: number,
    marketAvg: number,
    overallScore: number
  ): { strategy: 'renovate' | 'rebrand' | 'reposition' | 'acquire'; rationale: string; upsidePercent: number } {
    if (dims.vintagePhysical.score < 40 && occupancy > 0.85) {
      return {
        strategy: 'renovate',
        rationale: 'Aging physical plant in occupied market — interior renovation can push rents without vacancy risk.',
        upsidePercent: Math.round(8 + (40 - dims.vintagePhysical.score) * 0.3),
      };
    }

    if (dims.rentPosition.score < 40 && dims.occupancyStrength.score > 60) {
      return {
        strategy: 'rebrand',
        rationale: 'Below-market rents with strong occupancy — rebrand and reprice to capture market rate.',
        upsidePercent: Math.round(5 + (60 - dims.rentPosition.score) * 0.2),
      };
    }

    if (overallScore < 50 && rentGrowth > 0.02) {
      return {
        strategy: 'reposition',
        rationale: 'Underperforming asset in growing market — full repositioning can capture outsized returns.',
        upsidePercent: Math.round(12 + (50 - overallScore) * 0.2),
      };
    }

    return {
      strategy: 'acquire',
      rationale: 'Market fundamentals strong — acquire at current cap rate and benefit from organic rent growth.',
      upsidePercent: Math.round(3 + rentGrowth * 100),
    };
  }

  private getSubmarketVacancy(sm: SubmarketF40Score): number {
    const factors = sm.dimensions.occupancyStrength.factors;
    const occ = factors.find(f => f.name === 'Occupancy Rate');
    return occ ? 1 - (occ.value / 100) : 0.1;
  }

  private getSubmarketRentGrowth(sm: SubmarketF40Score): number {
    const factors = sm.dimensions.rentPosition.factors;
    const growth = factors.find(f => f.name === 'Rent Growth (30d)');
    return growth ? growth.value / 100 : 0.02;
  }

  private getSubmarketAvgRent(sm: SubmarketF40Score): number {
    const factors = sm.dimensions.rentPosition.factors;
    const rent = factors.find(f => f.name === 'Avg Rent vs Market');
    return rent ? rent.value : 1800;
  }

  private demandSignalScore(demand: EnrichedDemandData | null): number {
    if (!demand) return 50;
    let score = 50;

    if (demand.activeRenters) {
      score = clamp(demand.activeRenters / 50);
    }

    if (demand.moveInTimeline) {
      const urgentDemand = (demand.moveInTimeline.immediate || 0) + (demand.moveInTimeline.within30Days || 0);
      if (urgentDemand > 50) score = Math.min(100, score + 10);
    }

    if (demand.bedroomDemand) {
      const totalBedDemand = (demand.bedroomDemand.studio || 0) + (demand.bedroomDemand.oneBed || 0) +
        (demand.bedroomDemand.twoBed || 0) + (demand.bedroomDemand.threePlusBed || 0);
      if (totalBedDemand > 100) score = Math.min(100, score + 5);
    }

    if (demand.budget && demand.budget.avg > 0) {
      score = Math.min(100, score + 5);
    }

    return Math.round(score);
  }

  private async getTrendData(city: string): Promise<any> {
    try {
      const result = await this.pool.query(
        `SELECT data FROM apartment_trends WHERE city = $1 ORDER BY synced_at DESC LIMIT 1`,
        [city]
      );
      if (result.rows.length === 0) return null;
      const raw = result.rows[0].data;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const obs = parsed?.observations || [];
      if (obs.length < 2) return null;

      const sorted = [...obs].sort((a: any, b: any) => a.date.localeCompare(b.date));
      const latest = sorted[sorted.length - 1];
      const earliest = sorted[0];
      const totalUnits = latest.total_supply || 1;
      const availableChange = earliest.available_units - latest.available_units;
      const weeklyAbsorption = Math.max(0.1, availableChange / sorted.length);
      const supplyPressure = totalUnits > 0 ? latest.available_units / (weeklyAbsorption * 52) : 1;
      const clampedPressure = Math.max(0, Math.min(5, supplyPressure));

      return { supplyPressure: clampedPressure, weeklyAbsorption, latestObs: latest };
    } catch {
      return null;
    }
  }

  async getDemandData(city: string): Promise<EnrichedDemandData | null> {
    try {
      const result = await this.pool.query(
        `SELECT analytics_type, data FROM apartment_user_analytics WHERE analytics_type IN ('user-stats', 'demand-signals', 'user-preferences') AND (city = $1 OR city IS NULL) ORDER BY synced_at DESC LIMIT 10`,
        [city]
      );
      if (result.rows.length === 0) return null;

      let activeRenters = 0;
      let topAmenities: string[] = [];
      let demandDealBreakers: string[] = [];
      let prefDealBreakers: string[] = [];
      let demandApartmentFeatures: Array<{ name: string; count: number }> = [];
      let prefApartmentFeatures: Array<{ name: string; count: number }> = [];
      let budget: DemandBudget = { avg: 0, median: 0, min: 0, max: 0 };
      let bedroomDemand: BedroomDemand = { studio: 0, oneBed: 0, twoBed: 0, threePlusBed: 0 };
      let commutePreferences: CommutePreferences = { maxCommuteMinutes: 0, preferredModes: [], topEmploymentCenters: [] };
      let locationDemand: LocationDemand = { topCities: [], topNeighborhoods: [], topZipCodes: [] };
      let moveInTimeline: MoveInTimeline = { immediate: 0, within30Days: 0, within60Days: 0, within90Days: 0, moreThan90Days: 0 };
      let lifestylePriorities: string[] = [];
      let setupStats: { totalProfiles: number; avgCompleteness: number } = { totalProfiles: 0, avgCompleteness: 0 };
      let preferredCities: Array<{ city: string; count: number }> = [];

      for (const row of result.rows) {
        const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;

        if (row.analytics_type === 'user-stats') {
          activeRenters = d?.activeUsers30d || d?.totalUsers || 0;
        }

        if (row.analytics_type === 'demand-signals') {
          topAmenities = (d?.topAmenities || d?.top_amenities || []).map((a: any) => a.name || a);
          demandDealBreakers = (d?.dealBreakers || d?.deal_breakers || []).map((a: any) => a.name || a);
          demandApartmentFeatures = (d?.apartmentFeatures || d?.apartment_features || []).map((a: any) =>
            typeof a === 'string' ? { name: a, count: 0 } : { name: a.name || a.feature, count: a.count || 0 }
          );

          if (d?.budget) {
            budget = {
              avg: d.budget.avg || d.budget.average || d.budget.avg_budget || 0,
              median: d.budget.median || d.budget.median_budget || 0,
              min: d.budget.min || d.budget.min_budget || 0,
              max: d.budget.max || d.budget.max_budget || 0,
            };
          }

          if (d?.bedroomDemand || d?.bedroom_demand) {
            const bd = d.bedroomDemand || d.bedroom_demand;
            bedroomDemand = {
              studio: bd.studio || bd['0br'] || 0,
              oneBed: bd.oneBed || bd['1br'] || bd.one_bed || 0,
              twoBed: bd.twoBed || bd['2br'] || bd.two_bed || 0,
              threePlusBed: bd.threePlusBed || bd['3br+'] || bd.three_plus_bed || 0,
            };
          }

          if (d?.commutePreferences || d?.commute_preferences) {
            const cp = d.commutePreferences || d.commute_preferences;
            commutePreferences = {
              maxCommuteMinutes: cp.maxCommuteMinutes || cp.max_commute_minutes || cp.max_commute_minutes_avg || 0,
              preferredModes: cp.preferredModes || cp.preferred_modes || (cp.preferred_transport_modes || []).map((m: any) => m.mode || m) || [],
              topEmploymentCenters: cp.topEmploymentCenters || cp.top_employment_centers || (cp.top_commute_destinations || []).map((d: any) => d.destination || d) || [],
            };
          }

          if (d?.locationDemand || d?.location_demand) {
            const ld = d.locationDemand || d.location_demand;
            locationDemand = {
              topCities: (ld.topCities || ld.top_cities || []).map((c: any) =>
                typeof c === 'string' ? { city: c, count: 0 } : { city: c.city || c.name, state: c.state, count: c.count || 0 }
              ),
              topNeighborhoods: (ld.topNeighborhoods || ld.top_neighborhoods || []).map((n: any) => n.name || n),
              topZipCodes: (ld.topZipCodes || ld.top_zip_codes || []).map((z: any) => z.zip || z),
            };
          }

          if (d?.moveInTimeline || d?.move_in_timeline) {
            const mt = d.moveInTimeline || d.move_in_timeline;
            moveInTimeline = {
              immediate: mt.immediate || 0,
              within30Days: mt.within30Days || mt.within_30_days || 0,
              within60Days: mt.within60Days || mt.within_60_days || 0,
              within90Days: mt.within90Days || mt.within_90_days || 0,
              moreThan90Days: mt.moreThan90Days || mt.more_than_90_days || mt.flexible || 0,
            };
          }
        }

        if (row.analytics_type === 'user-preferences') {
          prefDealBreakers = (d?.dealBreakers || d?.deal_breakers || []).map((a: any) => a.name || a);
          lifestylePriorities = (d?.lifestylePriorities || d?.lifestyle_priorities || []).map((a: any) => a.name || a);
          prefApartmentFeatures = (d?.apartmentFeatures || d?.apartment_features || []).map((a: any) =>
            typeof a === 'string' ? { name: a, count: 0 } : { name: a.name || a.feature, count: a.count || 0 }
          );

          if (d?.setupStats || d?.setup_stats) {
            const ss = d.setupStats || d.setup_stats;
            setupStats = {
              totalProfiles: ss.totalProfiles || ss.total_profiles || 0,
              avgCompleteness: ss.avgCompleteness || ss.avg_completeness || 0,
            };
          }

          preferredCities = (d?.preferredCities || d?.preferred_cities || []).map((a: any) =>
            typeof a === 'string' ? { city: a, count: 0 } : { city: a.city || a.name, count: a.count || 0 }
          );

          if (!topAmenities.length) {
            topAmenities = (d?.topAmenities || d?.top_amenities || []).map((a: any) => a.name || a);
          }
        }
      }

      const mergedDealBreakers = [...new Set([...demandDealBreakers, ...prefDealBreakers])];

      const featureMap = new Map<string, number>();
      for (const f of [...demandApartmentFeatures, ...prefApartmentFeatures]) {
        featureMap.set(f.name, (featureMap.get(f.name) || 0) + f.count);
      }
      const mergedFeatures = Array.from(featureMap.entries()).map(([name, count]) => ({ name, count }));

      return {
        activeRenters,
        topAmenities,
        dealBreakers: mergedDealBreakers,
        apartmentFeatures: mergedFeatures,
        budget,
        bedroomDemand,
        commutePreferences,
        locationDemand,
        moveInTimeline,
        lifestylePriorities,
        setupStats,
        preferredCities,
      };
    } catch {
      return null;
    }
  }
}

export const opportunityEngineService = new OpportunityEngineService();
