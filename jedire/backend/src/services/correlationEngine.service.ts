import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface CorrelationResult {
  id: string;
  name: string;
  tier: number;
  category: string;
  xValue: number | null;
  yValue: number | null;
  correlation: number | null;
  signal: string | null;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  leadTime: string;
  actionable: string | null;
  dataSources: string[];
  missingData: string[];
}

export interface CorrelationReport {
  market: string;
  state: string;
  computedAt: string;
  snapshotDate: string | null;
  metricsComputed: number;
  metricsSkipped: number;
  correlations: CorrelationResult[];
  summary: {
    bullishSignals: number;
    bearishSignals: number;
    neutralSignals: number;
    insufficientData: number;
    rentRunway: string | null;
    affordabilityCeiling: string | null;
    supplyPressure: string | null;
    topOpportunity: string | null;
  };
}

interface MarketSnapshot {
  total_properties: number | null;
  total_units: number | null;
  avg_occupancy: number | null;
  rent_growth_90d: number | null;
  rent_growth_180d: number | null;
  concession_rate: number | null;
  avg_concession_value: number | null;
  avg_days_to_lease: number | null;
  monthly_absorption_rate: number | null;
  supply_pressure: string | null;
  snapshot_date: string;
}

interface TrendObservation {
  date: string;
  avg_rent: number;
  total_supply: number;
  vacancy_rate: number;
  available_units: number;
  listings_active: number;
  seasonal_factor: number;
  application_volume: number;
  avg_days_on_market: number;
  avg_opportunity_score: number;
  search_activity_index: number;
  concessions_prevalence: number;
  negotiation_success_rate: number;
}

interface SubmarketData {
  name: string;
  avg_rent: number;
  total_units: number;
  vacancy_rate: number;
  market_pressure: string;
  rent_growth_30d: number;
  properties_count: number;
  avg_opportunity_score: number;
  negotiation_success_rate: number;
}

interface MSAData {
  population: number | null;
  median_household_income: number | null;
  avg_rent: number | null;
  avg_occupancy: number | null;
}

export class CorrelationEngineService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async computeCorrelations(city: string = 'Atlanta', state: string = 'GA'): Promise<CorrelationReport> {
    const snapshot = await this.getLatestSnapshot(city, state);
    const trends = await this.getTrendObservations(city);
    const submarkets = await this.getSubmarketData(city);
    const msa = await this.getMSAData(city);

    const correlations: CorrelationResult[] = [];

    correlations.push(this.computeCOR01(snapshot, trends));
    correlations.push(this.computeCOR02(trends));
    correlations.push(this.computeCOR03(trends));
    correlations.push(this.computeCOR04(msa, snapshot));
    correlations.push(this.computeCOR05(snapshot, trends));
    correlations.push(this.computeCOR06(snapshot));
    correlations.push(this.computeCOR07(snapshot));
    correlations.push(this.computeCOR08());
    correlations.push(this.computeCOR09(snapshot, trends));
    correlations.push(this.computeCOR10());
    correlations.push(this.computeCOR11());
    correlations.push(this.computeCOR12());
    correlations.push(this.computeCOR13(msa, snapshot, trends));
    correlations.push(this.computeCOR14(submarkets));
    correlations.push(this.computeCOR15(trends));
    correlations.push(this.computeCOR16(trends));
    correlations.push(this.computeCOR17());
    correlations.push(this.computeCOR18());
    correlations.push(this.computeCOR19());
    correlations.push(this.computeCOR20());

    const computed = correlations.filter(c => c.confidence !== 'insufficient');
    const skipped = correlations.filter(c => c.confidence === 'insufficient');

    const bullish = computed.filter(c => c.signal === 'bullish').length;
    const bearish = computed.filter(c => c.signal === 'bearish').length;
    const neutral = computed.filter(c => c.signal === 'neutral').length;

    const cor04 = correlations.find(c => c.id === 'COR-04');
    const cor13 = correlations.find(c => c.id === 'COR-13');
    const cor06 = correlations.find(c => c.id === 'COR-06');

    return {
      market: city,
      state,
      computedAt: new Date().toISOString(),
      snapshotDate: snapshot?.snapshot_date || null,
      metricsComputed: computed.length,
      metricsSkipped: skipped.length,
      correlations,
      summary: {
        bullishSignals: bullish,
        bearishSignals: bearish,
        neutralSignals: neutral,
        insufficientData: skipped.length,
        rentRunway: cor04?.actionable || null,
        affordabilityCeiling: cor13?.actionable || null,
        supplyPressure: cor06?.actionable || null,
        topOpportunity: this.identifyTopOpportunity(correlations),
      },
    };
  }

  async computeForProperty(propertyId: string, city: string = 'Atlanta', state: string = 'GA'): Promise<CorrelationReport> {
    return this.computeCorrelations(city, state);
  }

  private async getLatestSnapshot(city: string, state: string): Promise<MarketSnapshot | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM apartment_market_snapshots WHERE city = $1 AND state = $2 ORDER BY snapshot_date DESC LIMIT 1`,
        [city, state]
      );
      return result.rows[0] || null;
    } catch {
      return null;
    }
  }

  private async getTrendObservations(city: string): Promise<TrendObservation[]> {
    try {
      const result = await this.pool.query(
        `SELECT data FROM apartment_trends WHERE city = $1 ORDER BY snapshot_date DESC LIMIT 1`,
        [city]
      );
      if (result.rows.length === 0) return [];
      const data = typeof result.rows[0].data === 'string' ? JSON.parse(result.rows[0].data) : result.rows[0].data;
      return data.observations || [];
    } catch {
      return [];
    }
  }

  private async getSubmarketData(city: string): Promise<SubmarketData[]> {
    try {
      const result = await this.pool.query(
        `SELECT data FROM apartment_submarkets WHERE city = $1 ORDER BY snapshot_date DESC LIMIT 1`,
        [city]
      );
      if (result.rows.length === 0) return [];
      const data = typeof result.rows[0].data === 'string' ? JSON.parse(result.rows[0].data) : result.rows[0].data;
      return data.submarkets || [];
    } catch {
      return [];
    }
  }

  private async getMSAData(city: string): Promise<MSAData | null> {
    try {
      const result = await this.pool.query(
        `SELECT population, median_household_income, avg_rent, avg_occupancy FROM msas WHERE name ILIKE $1 LIMIT 1`,
        [`%${city}%`]
      );
      return result.rows[0] || null;
    } catch {
      return null;
    }
  }

  private computeCOR01(snapshot: MarketSnapshot | null, trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = [];
    if (!snapshot) missing.push('market snapshot');

    const rentGrowth = snapshot?.rent_growth_90d;
    let searchSurge: number | null = null;

    if (trends.length >= 8) {
      const recent = trends.slice(-4);
      const prior = trends.slice(-8, -4);
      const recentAvg = recent.reduce((s, t) => s + (t.search_activity_index || 0), 0) / recent.length;
      const priorAvg = prior.reduce((s, t) => s + (t.search_activity_index || 0), 0) / prior.length;
      if (priorAvg > 0) searchSurge = (recentAvg - priorAvg) / priorAvg;
    } else if (trends.length >= 2) {
      const midpoint = Math.floor(trends.length / 2);
      const recent = trends.slice(midpoint);
      const prior = trends.slice(0, midpoint);
      const recentAvg = recent.reduce((s, t) => s + (t.search_activity_index || 0), 0) / recent.length;
      const priorAvg = prior.reduce((s, t) => s + (t.search_activity_index || 0), 0) / prior.length;
      if (priorAvg > 0) searchSurge = (recentAvg - priorAvg) / priorAvg;
    } else {
      missing.push('sufficient trend observations (need 2+)');
    }

    if (searchSurge === null && trends.length >= 2) missing.push('valid search activity index values');
    missing.push('ADT baseline (adt_counts empty, using search index as proxy)');

    const hasData = searchSurge !== null && rentGrowth !== null;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      if (searchSurge! > 0.10 && (rentGrowth ?? 0) < 0.05) {
        signal = 'bullish';
        actionable = `Search surge +${(searchSurge! * 100).toFixed(1)}% but rent growth only ${((rentGrowth ?? 0) * 100).toFixed(1)}% — repricing opportunity`;
      } else if (searchSurge! < -0.10) {
        signal = 'bearish';
        actionable = `Search declining ${(searchSurge! * 100).toFixed(1)}% — demand weakening`;
      } else {
        signal = 'neutral';
        actionable = `Search and rent growth aligned`;
      }
    }

    return {
      id: 'COR-01',
      name: 'Traffic Surge Index vs Rent Growth',
      tier: 1,
      category: 'Money Correlations',
      xValue: searchSurge !== null ? parseFloat((searchSurge * 100).toFixed(1)) : null,
      yValue: rentGrowth !== null ? parseFloat(((rentGrowth ?? 0) * 100).toFixed(1)) : null,
      correlation: hasData ? this.estimateCorrelation(searchSurge!, rentGrowth!) : null,
      signal,
      confidence: hasData ? 'medium' : 'insufficient',
      leadTime: '3-6 months',
      actionable,
      dataSources: ['Apartment Locator AI (search index)', 'Market Snapshots (rent growth)'],
      missingData: missing,
    };
  }

  private computeCOR02(trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = ['FDOT AADT year-over-year (adt_counts empty)'];
    let searchMomentum: number | null = null;

    if (trends.length >= 8) {
      const recentQ = trends.slice(-4);
      const priorQ = trends.slice(-8, -4);
      const recentAvg = recentQ.reduce((s, t) => s + (t.search_activity_index || 0), 0) / recentQ.length;
      const priorAvg = priorQ.reduce((s, t) => s + (t.search_activity_index || 0), 0) / priorQ.length;
      if (priorAvg > 0) searchMomentum = (recentAvg - priorAvg) / priorAvg;
    } else {
      missing.push('sufficient trend observations (need 8+)');
    }

    return {
      id: 'COR-02',
      name: 'Search Momentum vs AADT Growth',
      tier: 1,
      category: 'Money Correlations',
      xValue: searchMomentum !== null ? parseFloat((searchMomentum * 100).toFixed(1)) : null,
      yValue: null,
      correlation: null,
      signal: searchMomentum !== null && searchMomentum > 0.05 ? 'bullish' : searchMomentum !== null && searchMomentum < -0.05 ? 'bearish' : searchMomentum !== null ? 'neutral' : null,
      confidence: 'insufficient',
      leadTime: '2-6 months',
      actionable: searchMomentum !== null ? `Search momentum: ${(searchMomentum * 100).toFixed(1)}% QoQ (AADT comparison pending)` : null,
      dataSources: ['Apartment Locator AI (search index)'],
      missingData: missing,
    };
  }

  private computeCOR03(trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = [];
    let searchMomentum: number | null = null;
    let rentGrowth: number | null = null;

    if (trends.length >= 8) {
      const recentQ = trends.slice(-4);
      const priorQ = trends.slice(-8, -4);
      const recentSearchAvg = recentQ.reduce((s, t) => s + (t.search_activity_index || 0), 0) / recentQ.length;
      const priorSearchAvg = priorQ.reduce((s, t) => s + (t.search_activity_index || 0), 0) / priorQ.length;
      if (priorSearchAvg > 0) searchMomentum = (recentSearchAvg - priorSearchAvg) / priorSearchAvg;

      const recentRentAvg = recentQ.reduce((s, t) => s + (t.avg_rent || 0), 0) / recentQ.length;
      const priorRentAvg = priorQ.reduce((s, t) => s + (t.avg_rent || 0), 0) / priorQ.length;
      if (priorRentAvg > 0) rentGrowth = (recentRentAvg - priorRentAvg) / priorRentAvg;
    } else {
      missing.push('sufficient trend observations (need 8+)');
    }

    const hasData = searchMomentum !== null && rentGrowth !== null;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      const gap = searchMomentum! - rentGrowth!;
      if (gap > 0.05) {
        signal = 'bullish';
        actionable = `Digital demand +${(searchMomentum! * 100).toFixed(1)}% outpacing rent growth ${(rentGrowth! * 100).toFixed(1)}% — repricing window open`;
      } else if (gap < -0.05) {
        signal = 'bearish';
        actionable = `Rent growth ${(rentGrowth! * 100).toFixed(1)}% outpacing demand ${(searchMomentum! * 100).toFixed(1)}% — correction risk`;
      } else {
        signal = 'neutral';
        actionable = 'Search momentum and rent growth aligned';
      }
    }

    return {
      id: 'COR-03',
      name: 'Search Momentum vs Rent Growth',
      tier: 1,
      category: 'Money Correlations',
      xValue: searchMomentum !== null ? parseFloat((searchMomentum * 100).toFixed(1)) : null,
      yValue: rentGrowth !== null ? parseFloat((rentGrowth * 100).toFixed(1)) : null,
      correlation: hasData ? this.estimateCorrelation(searchMomentum!, rentGrowth!) : null,
      signal,
      confidence: hasData ? 'medium' : 'insufficient',
      leadTime: '4-8 months',
      actionable,
      dataSources: ['Apartment Locator AI (search index + rents)'],
      missingData: missing,
    };
  }

  private computeCOR04(msa: MSAData | null, snapshot: MarketSnapshot | null): CorrelationResult {
    const missing: string[] = [];
    if (!msa?.median_household_income) missing.push('BLS QCEW wage data (using MSA median income as proxy)');

    const medianIncome = msa?.median_household_income ? parseFloat(String(msa.median_household_income)) : null;
    const msaAvgRent = msa?.avg_rent ? parseFloat(String(msa.avg_rent)) : null;
    const rentGrowth = snapshot?.rent_growth_90d;

    let rentToIncomeRatio: number | null = null;
    if (medianIncome && msaAvgRent) {
      rentToIncomeRatio = (msaAvgRent * 12) / medianIncome;
    }

    const hasData = rentToIncomeRatio !== null && rentGrowth !== null;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      const affordPct = (rentToIncomeRatio! * 100);
      if (affordPct < 28) {
        signal = 'bullish';
        actionable = `Affordability ratio ${affordPct.toFixed(1)}% (below 30% ceiling). Room to push rents.`;
      } else if (affordPct < 32) {
        signal = 'neutral';
        actionable = `Affordability ratio ${affordPct.toFixed(1)}% — approaching 30% threshold. Moderate runway.`;
      } else {
        signal = 'bearish';
        actionable = `Affordability ratio ${affordPct.toFixed(1)}% exceeds 30% ceiling. Rent growth constrained.`;
      }
    }

    return {
      id: 'COR-04',
      name: 'Wage Growth vs Rent Growth',
      tier: 1,
      category: 'Money Correlations',
      xValue: rentToIncomeRatio !== null ? parseFloat((rentToIncomeRatio * 100).toFixed(1)) : null,
      yValue: rentGrowth !== null ? parseFloat(((rentGrowth ?? 0) * 100).toFixed(1)) : null,
      correlation: null,
      signal,
      confidence: hasData ? 'medium' : 'insufficient',
      leadTime: 'Concurrent',
      actionable,
      dataSources: ['MSA median household income', 'MSA avg rent', 'Market Snapshots'],
      missingData: missing,
    };
  }

  private computeCOR05(snapshot: MarketSnapshot | null, trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = [];
    if (!snapshot) missing.push('market snapshot');

    let vacancyRate: number | null = null;
    let searchActivity: number | null = null;

    if (trends.length > 0) {
      const latest = trends[trends.length - 1];
      vacancyRate = latest.vacancy_rate;
      searchActivity = latest.search_activity_index;
    } else {
      missing.push('trend observations');
    }

    if (!vacancyRate && snapshot?.avg_occupancy) {
      vacancyRate = 1 - parseFloat(String(snapshot.avg_occupancy));
    }

    const hasData = vacancyRate !== null && searchActivity !== null;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      if (searchActivity! > 80 && vacancyRate! > 0.08) {
        signal = 'bullish';
        actionable = `High search activity (${searchActivity}) + elevated vacancy (${(vacancyRate! * 100).toFixed(1)}%) = Management/pricing problem, not demand. Value-add target.`;
      } else if (searchActivity! < 60 && vacancyRate! > 0.10) {
        signal = 'bearish';
        actionable = `Low search (${searchActivity}) + high vacancy (${(vacancyRate! * 100).toFixed(1)}%) = True demand problem.`;
      } else {
        signal = 'neutral';
        actionable = `Search ${searchActivity}, vacancy ${(vacancyRate! * 100).toFixed(1)}% — balanced.`;
      }
    }

    return {
      id: 'COR-05',
      name: 'Traffic Surge Index vs Vacancy Rate',
      tier: 1,
      category: 'Money Correlations',
      xValue: searchActivity,
      yValue: vacancyRate !== null ? parseFloat((vacancyRate * 100).toFixed(1)) : null,
      correlation: null,
      signal,
      confidence: hasData ? 'medium' : 'insufficient',
      leadTime: '2-4 months',
      actionable,
      dataSources: ['Apartment Locator AI (search + vacancy)'],
      missingData: missing,
    };
  }

  private computeCOR06(snapshot: MarketSnapshot | null): CorrelationResult {
    const missing: string[] = [];
    const supplyPressure = snapshot?.supply_pressure;
    const rentGrowth = snapshot?.rent_growth_90d;

    if (!supplyPressure) missing.push('supply pressure data');
    if (rentGrowth === null || rentGrowth === undefined) missing.push('rent growth data');

    const hasData = supplyPressure !== null && supplyPressure !== undefined;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      if (supplyPressure === 'low') {
        signal = 'bullish';
        actionable = 'Supply pressure is low — favorable for rent growth.';
      } else if (supplyPressure === 'moderate') {
        signal = 'neutral';
        actionable = 'Moderate supply pressure — monitor pipeline deliveries.';
      } else {
        signal = 'bearish';
        actionable = 'High supply pressure — pipeline >12% triggers rent growth deceleration.';
      }
    }

    return {
      id: 'COR-06',
      name: 'Pipeline % vs Rent Growth',
      tier: 2,
      category: 'Supply-Demand Equilibrium',
      xValue: null,
      yValue: rentGrowth !== null && rentGrowth !== undefined ? parseFloat(((rentGrowth) * 100).toFixed(1)) : null,
      correlation: null,
      signal,
      confidence: hasData ? 'low' : 'insufficient',
      leadTime: '6-18 months',
      actionable,
      dataSources: ['Market Snapshots (supply pressure)'],
      missingData: missing,
    };
  }

  private computeCOR07(snapshot: MarketSnapshot | null): CorrelationResult {
    const missing: string[] = [];
    const absorptionRate = snapshot?.monthly_absorption_rate;
    const supplyPressure = snapshot?.supply_pressure;

    if (!absorptionRate) missing.push('absorption rate');
    if (!supplyPressure) missing.push('pipeline data');

    const hasData = absorptionRate !== null && absorptionRate !== undefined;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      const rate = parseFloat(String(absorptionRate));
      if (rate > 0.02) {
        signal = 'bullish';
        actionable = `Monthly absorption rate ${(rate * 100).toFixed(1)}% — healthy demand absorbing supply.`;
      } else if (rate > 0) {
        signal = 'neutral';
        actionable = `Monthly absorption rate ${(rate * 100).toFixed(1)}% — adequate.`;
      } else {
        signal = 'bearish';
        actionable = 'Negative absorption — supply exceeding demand.';
      }
    }

    return {
      id: 'COR-07',
      name: 'Absorption Rate vs Pipeline %',
      tier: 2,
      category: 'Supply-Demand Equilibrium',
      xValue: absorptionRate !== null && absorptionRate !== undefined ? parseFloat((parseFloat(String(absorptionRate)) * 100).toFixed(1)) : null,
      yValue: null,
      correlation: null,
      signal,
      confidence: hasData ? 'low' : 'insufficient',
      leadTime: 'Concurrent',
      actionable,
      dataSources: ['Market Snapshots (absorption)'],
      missingData: missing,
    };
  }

  private computeCOR08(): CorrelationResult {
    return {
      id: 'COR-08',
      name: 'Permit Velocity vs Market Cap Rate',
      tier: 2,
      category: 'Supply-Demand Equilibrium',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '18-30 months',
      actionable: null,
      dataSources: [],
      missingData: ['Municipal permit data', 'Transaction cap rate records'],
    };
  }

  private computeCOR09(snapshot: MarketSnapshot | null, trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = [];
    let concessionRate: number | null = null;

    if (trends.length > 0) {
      const latest = trends[trends.length - 1];
      concessionRate = latest.concessions_prevalence;
    } else if (snapshot?.concession_rate) {
      concessionRate = parseFloat(String(snapshot.concession_rate));
    } else {
      missing.push('concession rate data');
    }

    missing.push('quarterly unit delivery counts');

    const hasData = concessionRate !== null;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      if (concessionRate! > 0.40) {
        signal = 'bearish';
        actionable = `Concession prevalence ${(concessionRate! * 100).toFixed(0)}% — heavy discounting indicates supply pressure. Factor into EGI.`;
      } else if (concessionRate! > 0.20) {
        signal = 'neutral';
        actionable = `Concession prevalence ${(concessionRate! * 100).toFixed(0)}% — moderate. Normal market conditions.`;
      } else {
        signal = 'bullish';
        actionable = `Low concession prevalence ${(concessionRate! * 100).toFixed(0)}% — landlord-favorable market.`;
      }
    }

    return {
      id: 'COR-09',
      name: 'Quarterly Deliveries vs Concession Rate',
      tier: 2,
      category: 'Supply-Demand Equilibrium',
      xValue: null,
      yValue: concessionRate !== null ? parseFloat((concessionRate * 100).toFixed(1)) : null,
      correlation: null,
      signal,
      confidence: hasData ? 'low' : 'insufficient',
      leadTime: '1-3 months',
      actionable,
      dataSources: ['Apartment Locator AI (concessions)'],
      missingData: missing,
    };
  }

  private computeCOR10(): CorrelationResult {
    return {
      id: 'COR-10',
      name: 'Business Formation Velocity vs Search Momentum',
      tier: 3,
      category: 'Predictive & Economic Fundamentals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '3-6 months',
      actionable: null,
      dataSources: [],
      missingData: ['Census Business Formation Statistics (BFS)'],
    };
  }

  private computeCOR11(): CorrelationResult {
    return {
      id: 'COR-11',
      name: 'Net Migration vs Out-of-State Search',
      tier: 3,
      category: 'Predictive & Economic Fundamentals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '6-12 months',
      actionable: null,
      dataSources: [],
      missingData: ['IRS SOI migration data', 'Google Trends by region'],
    };
  }

  private computeCOR12(): CorrelationResult {
    return {
      id: 'COR-12',
      name: 'Job Growth vs Net Absorption',
      tier: 3,
      category: 'Predictive & Economic Fundamentals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '3-6 months',
      actionable: null,
      dataSources: [],
      missingData: ['BLS job growth data', 'Net absorption records'],
    };
  }

  private computeCOR13(msa: MSAData | null, snapshot: MarketSnapshot | null, trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = [];
    const medianIncome = msa?.median_household_income ? parseFloat(String(msa.median_household_income)) : null;

    let avgRent: number | null = null;
    if (trends.length > 0) {
      avgRent = trends[trends.length - 1].avg_rent;
    } else if (msa?.avg_rent) {
      avgRent = parseFloat(String(msa.avg_rent));
    }

    if (!medianIncome) missing.push('Census ACS median household income');
    if (!avgRent) missing.push('current avg rent');

    let ratio: number | null = null;
    if (medianIncome && avgRent) {
      ratio = (avgRent * 12) / medianIncome;
    }

    const rentGrowth = snapshot?.rent_growth_90d;

    const hasData = ratio !== null;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      const pct = ratio! * 100;
      if (pct < 28) {
        signal = 'bullish';
        actionable = `Rent-to-income ${pct.toFixed(1)}% — well below 30% affordability ceiling. Runway for rent increases.`;
      } else if (pct <= 32) {
        signal = 'neutral';
        actionable = `Rent-to-income ${pct.toFixed(1)}% — near ceiling. Limited upside for aggressive rent growth.`;
      } else {
        signal = 'bearish';
        actionable = `Rent-to-income ${pct.toFixed(1)}% — exceeds 30% ceiling. Reduce rent growth assumptions by 100-200bps.`;
      }
    }

    return {
      id: 'COR-13',
      name: 'Rent-to-Income Ratio vs Rent Growth',
      tier: 3,
      category: 'Predictive & Economic Fundamentals',
      xValue: ratio !== null ? parseFloat((ratio * 100).toFixed(1)) : null,
      yValue: rentGrowth !== null && rentGrowth !== undefined ? parseFloat(((rentGrowth ?? 0) * 100).toFixed(1)) : null,
      correlation: null,
      signal,
      confidence: hasData ? 'medium' : 'insufficient',
      leadTime: 'Concurrent',
      actionable,
      dataSources: ['MSA median income (Census ACS)', 'Apartment Locator AI (avg rent)'],
      missingData: missing,
    };
  }

  private computeCOR14(submarkets: SubmarketData[]): CorrelationResult {
    const missing: string[] = ['Google Places API ratings'];

    if (submarkets.length === 0) {
      missing.push('submarket data');
      return {
        id: 'COR-14',
        name: 'Google Rating vs Rent Premium',
        tier: 4,
        category: 'Competitive & Quality Signals',
        xValue: null,
        yValue: null,
        correlation: null,
        signal: null,
        confidence: 'insufficient',
        leadTime: 'Concurrent',
        actionable: null,
        dataSources: [],
        missingData: missing,
      };
    }

    const avgRentOverall = submarkets.reduce((s, sm) => s + sm.avg_rent, 0) / submarkets.length;
    const premiums = submarkets.map(sm => ({
      name: sm.name,
      premium: ((sm.avg_rent - avgRentOverall) / avgRentOverall) * 100,
      opportunityScore: sm.avg_opportunity_score,
    }));

    const bestOpportunity = premiums.reduce((best, p) => p.opportunityScore > best.opportunityScore ? p : best, premiums[0]);

    return {
      id: 'COR-14',
      name: 'Google Rating vs Rent Premium',
      tier: 4,
      category: 'Competitive & Quality Signals',
      xValue: bestOpportunity.opportunityScore,
      yValue: parseFloat(bestOpportunity.premium.toFixed(1)),
      correlation: null,
      signal: bestOpportunity.premium < 0 && bestOpportunity.opportunityScore > 5 ? 'bullish' : 'neutral',
      confidence: 'low',
      leadTime: 'Concurrent',
      actionable: `${bestOpportunity.name}: opportunity score ${bestOpportunity.opportunityScore.toFixed(1)} with rent ${bestOpportunity.premium > 0 ? '+' : ''}${bestOpportunity.premium.toFixed(1)}% vs market avg`,
      dataSources: ['Apartment Locator AI (submarket opportunity scores + rents)'],
      missingData: missing,
    };
  }

  private computeCOR15(trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = ['Google review sentiment NLP'];
    let negotiationTrend: number | null = null;

    if (trends.length >= 4) {
      const recent = trends.slice(-2);
      const prior = trends.slice(-4, -2);
      const recentAvg = recent.reduce((s, t) => s + (t.negotiation_success_rate || 0), 0) / recent.length;
      const priorAvg = prior.reduce((s, t) => s + (t.negotiation_success_rate || 0), 0) / prior.length;
      if (priorAvg > 0) negotiationTrend = recentAvg - priorAvg;
    } else {
      missing.push('sufficient trend data');
    }

    let signal: string | null = null;
    let actionable: string | null = null;
    if (negotiationTrend !== null) {
      if (negotiationTrend > 0.05) {
        signal = 'bearish';
        actionable = `Negotiation success rising (+${(negotiationTrend * 100).toFixed(1)}pp) — tenants gaining leverage. Rent increase resistance likely.`;
      } else if (negotiationTrend < -0.05) {
        signal = 'bullish';
        actionable = `Negotiation success falling (${(negotiationTrend * 100).toFixed(1)}pp) — landlords gaining pricing power.`;
      } else {
        signal = 'neutral';
        actionable = 'Negotiation dynamics stable.';
      }
    }

    return {
      id: 'COR-15',
      name: 'Sentiment Trend vs Lease Velocity',
      tier: 4,
      category: 'Competitive & Quality Signals',
      xValue: negotiationTrend !== null ? parseFloat((negotiationTrend * 100).toFixed(1)) : null,
      yValue: null,
      correlation: null,
      signal,
      confidence: negotiationTrend !== null ? 'low' : 'insufficient',
      leadTime: '2-4 months',
      actionable,
      dataSources: ['Apartment Locator AI (negotiation rates)'],
      missingData: missing,
    };
  }

  private computeCOR16(trends: TrendObservation[]): CorrelationResult {
    const missing: string[] = [];
    let searchShare: number | null = null;
    let vacancyRate: number | null = null;

    if (trends.length > 0) {
      const latest = trends[trends.length - 1];
      searchShare = latest.search_activity_index;
      vacancyRate = latest.vacancy_rate;
    } else {
      missing.push('trend observations');
    }

    const hasData = searchShare !== null && vacancyRate !== null;
    let signal: string | null = null;
    let actionable: string | null = null;

    if (hasData) {
      if (searchShare! > 80 && vacancyRate! < 0.06) {
        signal = 'bullish';
        actionable = `High search activity (${searchShare}) + low vacancy (${(vacancyRate! * 100).toFixed(1)}%) — strong demand-supply balance.`;
      } else if (searchShare! < 60) {
        signal = 'bearish';
        actionable = `Falling search activity (${searchShare}) — top-of-funnel warning for occupancy.`;
      } else {
        signal = 'neutral';
        actionable = `Search activity ${searchShare}, vacancy ${(vacancyRate! * 100).toFixed(1)}% — stable.`;
      }
    }

    return {
      id: 'COR-16',
      name: 'Digital Traffic Share vs Physical Occupancy',
      tier: 4,
      category: 'Competitive & Quality Signals',
      xValue: searchShare,
      yValue: vacancyRate !== null ? parseFloat((vacancyRate * 100).toFixed(1)) : null,
      correlation: null,
      signal,
      confidence: hasData ? 'medium' : 'insufficient',
      leadTime: '1-3 months',
      actionable,
      dataSources: ['Apartment Locator AI (search + vacancy)'],
      missingData: missing,
    };
  }

  private computeCOR17(): CorrelationResult {
    return {
      id: 'COR-17',
      name: 'Traffic Velocity Score vs RevPAU',
      tier: 4,
      category: 'Competitive & Quality Signals',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '3-6 months',
      actionable: null,
      dataSources: [],
      missingData: ['M07 Fusion Engine TPI data', 'Property financial records'],
    };
  }

  private computeCOR18(): CorrelationResult {
    return {
      id: 'COR-18',
      name: 'Business Formations (NAICS) vs Rent Growth',
      tier: 5,
      category: 'Advanced / Emerging',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '6-12 months',
      actionable: null,
      dataSources: [],
      missingData: ['Census BFS sector data'],
    };
  }

  private computeCOR19(): CorrelationResult {
    return {
      id: 'COR-19',
      name: 'Maintenance Sentiment vs NOI Margin',
      tier: 5,
      category: 'Advanced / Emerging',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: 'Concurrent',
      actionable: null,
      dataSources: [],
      missingData: ['NLP review analysis', 'P&L statements'],
    };
  }

  private computeCOR20(): CorrelationResult {
    return {
      id: 'COR-20',
      name: 'Digital-Physical Gap vs Price per Unit',
      tier: 5,
      category: 'Advanced / Emerging',
      xValue: null,
      yValue: null,
      correlation: null,
      signal: null,
      confidence: 'insufficient',
      leadTime: '6-12 months',
      actionable: null,
      dataSources: [],
      missingData: ['SpyFu domain data', 'FDOT AADT', 'Transaction deed records'],
    };
  }

  private estimateCorrelation(x: number, y: number): number {
    if (x === 0 && y === 0) return 0;
    const sameDirection = (x > 0 && y > 0) || (x < 0 && y < 0);
    const magnitude = Math.min(Math.abs(x) + Math.abs(y), 1);
    return parseFloat(((sameDirection ? 0.5 : -0.5) + magnitude * (sameDirection ? 0.3 : -0.3)).toFixed(2));
  }

  private identifyTopOpportunity(correlations: CorrelationResult[]): string | null {
    const bullish = correlations.filter(c => c.signal === 'bullish' && c.confidence !== 'insufficient');
    if (bullish.length === 0) return null;
    const tier1Bullish = bullish.filter(c => c.tier === 1);
    if (tier1Bullish.length > 0) {
      return `${tier1Bullish.length} Tier-1 bullish signal(s): ${tier1Bullish.map(c => c.id).join(', ')}`;
    }
    return `${bullish.length} bullish signal(s) across tiers`;
  }
}
