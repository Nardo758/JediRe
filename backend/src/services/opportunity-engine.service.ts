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
      return this.scoreSubmarketOpportunity(sm, marketData.avgScore, trendData, demandData);
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
    demand: any
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

  private demandSignalScore(demand: any): number {
    if (!demand) return 50;
    const activeScore = demand.activeRenters ? clamp(demand.activeRenters / 50) : 50;
    return Math.round(activeScore);
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

  private async getDemandData(city: string): Promise<any> {
    try {
      const result = await this.pool.query(
        `SELECT analytics_type, data FROM apartment_user_analytics WHERE analytics_type IN ('user-stats', 'demand-signals') AND (city = $1 OR city IS NULL) ORDER BY synced_at DESC LIMIT 5`,
        [city]
      );
      if (result.rows.length === 0) return null;

      let activeRenters = 0;
      let topAmenities: string[] = [];

      for (const row of result.rows) {
        const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        if (row.analytics_type === 'user-stats') {
          activeRenters = d?.activeUsers30d || d?.totalUsers || 0;
        }
        if (row.analytics_type === 'demand-signals') {
          topAmenities = (d?.topAmenities || []).map((a: any) => a.name || a);
        }
      }

      return { activeRenters, topAmenities };
    } catch {
      return null;
    }
  }
}

export const opportunityEngineService = new OpportunityEngineService();
