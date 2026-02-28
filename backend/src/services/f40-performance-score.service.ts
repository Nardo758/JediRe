import { Pool } from 'pg';
import { getPool } from '../database/connection';

export interface F40DimensionScore {
  score: number;
  weight: number;
  weighted: number;
  factors: Array<{ name: string; value: number; benchmark: number; impact: string }>;
}

export interface F40Score {
  overallScore: number;
  dimensions: {
    rentPosition: F40DimensionScore;
    occupancyStrength: F40DimensionScore;
    pricingPower: F40DimensionScore;
    vintagePhysical: F40DimensionScore;
  };
  peerGroup: string;
  quartile: number;
  calculatedAt: string;
  dataSource: 'property' | 'submarket';
}

export interface SubmarketF40Score extends F40Score {
  submarketName: string;
  city: string;
  propertiesCount: number;
  totalUnits: number;
}

export interface MarketF40Summary {
  city: string;
  state: string;
  avgScore: number;
  submarketScores: SubmarketF40Score[];
  trendDirection: 'improving' | 'declining' | 'stable';
  marketGrade: string;
  calculatedAt: string;
}

const WEIGHTS = {
  rentPosition: 0.30,
  occupancyStrength: 0.30,
  pricingPower: 0.20,
  vintagePhysical: 0.20,
};

function clamp(val: number, min: number = 0, max: number = 100): number {
  return Math.max(min, Math.min(max, val));
}

function normalizeToScore(value: number, benchmarkLow: number, benchmarkHigh: number): number {
  if (benchmarkHigh === benchmarkLow) return 50;
  const pct = (value - benchmarkLow) / (benchmarkHigh - benchmarkLow);
  return clamp(Math.round(pct * 100));
}

export class F40PerformanceScoreService {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  async calculateMarketF40(city: string = 'Atlanta', state: string = 'GA'): Promise<MarketF40Summary> {
    const subResult = await this.pool.query(
      'SELECT data FROM apartment_submarkets WHERE city = $1 ORDER BY snapshot_date DESC LIMIT 1',
      [city]
    );

    const trendResult = await this.pool.query(
      'SELECT data FROM apartment_trends WHERE city = $1 ORDER BY snapshot_date DESC LIMIT 1',
      [city]
    );

    const snapshotResult = await this.pool.query(
      'SELECT * FROM apartment_market_snapshots WHERE city = $1 AND state = $2 ORDER BY snapshot_date DESC LIMIT 1',
      [city, state]
    );

    let submarkets: any[] = [];
    if (subResult.rows.length > 0) {
      const parsed = typeof subResult.rows[0].data === 'string'
        ? JSON.parse(subResult.rows[0].data)
        : subResult.rows[0].data;
      submarkets = parsed.submarkets || parsed || [];
    }

    let trends: any[] = [];
    if (trendResult.rows.length > 0) {
      const parsed = typeof trendResult.rows[0].data === 'string'
        ? JSON.parse(trendResult.rows[0].data)
        : trendResult.rows[0].data;
      trends = parsed.observations || parsed || [];
    }

    const snapshot = snapshotResult.rows[0] || null;

    if (submarkets.length === 0) {
      return {
        city,
        state,
        avgScore: 0,
        submarketScores: [],
        trendDirection: 'stable',
        marketGrade: 'N/A',
        calculatedAt: new Date().toISOString(),
      };
    }

    const allRents = submarkets.map((sm: any) => sm.avg_rent);
    const allVacancies = submarkets.map((sm: any) => sm.vacancy_rate);
    const allGrowths = submarkets.map((sm: any) => sm.rent_growth_30d);

    const benchmarks = {
      rentLow: Math.min(...allRents),
      rentHigh: Math.max(...allRents),
      vacancyLow: Math.min(...allVacancies),
      vacancyHigh: Math.max(...allVacancies),
      growthLow: Math.min(...allGrowths),
      growthHigh: Math.max(...allGrowths),
    };

    const submarketScores: SubmarketF40Score[] = submarkets.map((sm: any) => {
      return this.scoreSubmarket(sm, benchmarks, trends);
    });

    submarketScores.sort((a, b) => b.overallScore - a.overallScore);
    submarketScores.forEach((s, i) => {
      s.quartile = Math.ceil(((i + 1) / submarketScores.length) * 4);
    });

    const avgScore = Math.round(
      submarketScores.reduce((s, sc) => s + sc.overallScore, 0) / submarketScores.length
    );

    let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
    if (trends.length >= 4) {
      const sorted = [...trends].sort((a, b) => a.date.localeCompare(b.date));
      const recentRents = sorted.slice(-4).map((t: any) => t.avg_rent);
      const earlyRents = sorted.slice(0, 4).map((t: any) => t.avg_rent);
      const recentAvg = recentRents.reduce((s: number, v: number) => s + v, 0) / recentRents.length;
      const earlyAvg = earlyRents.reduce((s: number, v: number) => s + v, 0) / earlyRents.length;
      if (recentAvg > earlyAvg * 1.01) trendDirection = 'improving';
      else if (recentAvg < earlyAvg * 0.99) trendDirection = 'declining';
    }

    const marketGrade = avgScore >= 80 ? 'A' : avgScore >= 65 ? 'B+' : avgScore >= 50 ? 'B' : avgScore >= 35 ? 'C' : 'D';

    return {
      city,
      state,
      avgScore,
      submarketScores,
      trendDirection,
      marketGrade,
      calculatedAt: new Date().toISOString(),
    };
  }

  private scoreSubmarket(sm: any, benchmarks: any, trends: any[]): SubmarketF40Score {
    const rentPosition = this.scoreRentPosition(sm, benchmarks, trends);
    const occupancyStrength = this.scoreOccupancyStrength(sm, benchmarks, trends);
    const pricingPower = this.scorePricingPower(sm, benchmarks, trends);
    const vintagePhysical = this.scoreVintagePhysical(sm, benchmarks);

    const overallScore = Math.round(
      rentPosition.weighted +
      occupancyStrength.weighted +
      pricingPower.weighted +
      vintagePhysical.weighted
    );

    return {
      overallScore: clamp(overallScore),
      dimensions: { rentPosition, occupancyStrength, pricingPower, vintagePhysical },
      peerGroup: `${sm.city || 'Atlanta'} Metro`,
      quartile: 0,
      calculatedAt: new Date().toISOString(),
      dataSource: 'submarket',
      submarketName: sm.name,
      city: sm.city || 'Atlanta',
      propertiesCount: sm.properties_count || 0,
      totalUnits: sm.total_units || 0,
    };
  }

  private scoreRentPosition(sm: any, benchmarks: any, trends: any[]): F40DimensionScore {
    const rentScore = normalizeToScore(sm.avg_rent, benchmarks.rentLow, benchmarks.rentHigh);

    let growthScore = 50;
    if (sm.rent_growth_30d !== undefined) {
      growthScore = normalizeToScore(sm.rent_growth_30d, benchmarks.growthLow, benchmarks.growthHigh);
    }

    let trendScore = 50;
    if (trends.length >= 2) {
      const sorted = [...trends].sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0].avg_rent;
      const last = sorted[sorted.length - 1].avg_rent;
      const growth = first > 0 ? ((last - first) / first) * 100 : 0;
      trendScore = clamp(50 + growth * 10);
    }

    const score = Math.round(rentScore * 0.4 + growthScore * 0.35 + trendScore * 0.25);
    return {
      score: clamp(score),
      weight: WEIGHTS.rentPosition,
      weighted: Math.round(clamp(score) * WEIGHTS.rentPosition),
      factors: [
        { name: 'Effective Rent Level', value: sm.avg_rent, benchmark: (benchmarks.rentLow + benchmarks.rentHigh) / 2, impact: rentScore >= 60 ? 'positive' : 'neutral' },
        { name: 'Rent Growth (30d)', value: sm.rent_growth_30d * 100, benchmark: ((benchmarks.growthLow + benchmarks.growthHigh) / 2) * 100, impact: growthScore >= 60 ? 'positive' : 'neutral' },
        { name: 'Trend Trajectory', value: trendScore, benchmark: 50, impact: trendScore >= 60 ? 'positive' : 'neutral' },
      ],
    };
  }

  private scoreOccupancyStrength(sm: any, benchmarks: any, trends: any[]): F40DimensionScore {
    const occupancy = 1 - (sm.vacancy_rate || 0);
    const occScore = normalizeToScore(occupancy, 1 - benchmarks.vacancyHigh, 1 - benchmarks.vacancyLow);

    let velocityScore = 50;
    if (trends.length >= 2) {
      const sorted = [...trends].sort((a, b) => a.date.localeCompare(b.date));
      const firstVac = sorted[0].vacancy_rate;
      const lastVac = sorted[sorted.length - 1].vacancy_rate;
      if (lastVac < firstVac) velocityScore = 70 + (firstVac - lastVac) * 200;
      else if (lastVac > firstVac) velocityScore = 30 - (lastVac - firstVac) * 200;
    }

    const negotiationScore = sm.negotiation_success_rate
      ? clamp(sm.negotiation_success_rate * 100)
      : 50;

    const score = Math.round(occScore * 0.5 + clamp(velocityScore) * 0.3 + negotiationScore * 0.2);
    return {
      score: clamp(score),
      weight: WEIGHTS.occupancyStrength,
      weighted: Math.round(clamp(score) * WEIGHTS.occupancyStrength),
      factors: [
        { name: 'Occupancy Rate', value: Math.round(occupancy * 100), benchmark: 92, impact: occupancy >= 0.93 ? 'positive' : 'neutral' },
        { name: 'Vacancy Trend', value: Math.round(clamp(velocityScore)), benchmark: 50, impact: velocityScore >= 60 ? 'positive' : 'negative' },
        { name: 'Negotiation Rate', value: Math.round(negotiationScore), benchmark: 50, impact: negotiationScore >= 60 ? 'positive' : 'neutral' },
      ],
    };
  }

  private scorePricingPower(sm: any, benchmarks: any, trends: any[]): F40DimensionScore {
    const pressureScore = sm.market_pressure === 'seller_market' ? 80 :
      sm.market_pressure === 'balanced' ? 50 : 25;

    let concessionScore = 70;
    if (trends.length > 0) {
      const sorted = [...trends].sort((a, b) => a.date.localeCompare(b.date));
      const latest = sorted[sorted.length - 1];
      const prevalence = latest.concessions_prevalence || 0;
      concessionScore = clamp(100 - prevalence * 100);
    }

    const opportunityScore = sm.avg_opportunity_score
      ? clamp(sm.avg_opportunity_score * 10)
      : 50;

    const score = Math.round(pressureScore * 0.4 + concessionScore * 0.35 + opportunityScore * 0.25);
    return {
      score: clamp(score),
      weight: WEIGHTS.pricingPower,
      weighted: Math.round(clamp(score) * WEIGHTS.pricingPower),
      factors: [
        { name: 'Market Pressure', value: pressureScore, benchmark: 50, impact: pressureScore >= 60 ? 'positive' : 'negative' },
        { name: 'Concession Load', value: Math.round(concessionScore), benchmark: 70, impact: concessionScore >= 60 ? 'positive' : 'negative' },
        { name: 'Opportunity Score', value: Math.round(opportunityScore), benchmark: 50, impact: opportunityScore >= 50 ? 'positive' : 'neutral' },
      ],
    };
  }

  private scoreVintagePhysical(sm: any, benchmarks: any): F40DimensionScore {
    const unitDensity = sm.total_units || 0;
    const propCount = sm.properties_count || 1;
    const avgUnitsPerProp = unitDensity / propCount;

    const scaleScore = clamp(normalizeToScore(avgUnitsPerProp, 50, 500));
    const diversityScore = clamp(normalizeToScore(propCount, 5, 60));
    const maturityScore = propCount >= 20 ? 70 : propCount >= 10 ? 50 : 30;

    const score = Math.round(scaleScore * 0.4 + diversityScore * 0.35 + maturityScore * 0.25);
    return {
      score: clamp(score),
      weight: WEIGHTS.vintagePhysical,
      weighted: Math.round(clamp(score) * WEIGHTS.vintagePhysical),
      factors: [
        { name: 'Avg Units/Property', value: Math.round(avgUnitsPerProp), benchmark: 200, impact: avgUnitsPerProp >= 150 ? 'positive' : 'neutral' },
        { name: 'Property Diversity', value: propCount, benchmark: 30, impact: propCount >= 20 ? 'positive' : 'neutral' },
        { name: 'Market Maturity', value: maturityScore, benchmark: 50, impact: maturityScore >= 50 ? 'positive' : 'neutral' },
      ],
    };
  }
}

export const f40PerformanceScoreService = new F40PerformanceScoreService();
