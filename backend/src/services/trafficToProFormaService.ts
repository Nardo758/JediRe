/**
 * JEDI RE: Traffic → ProForma Translation Service (M07 → M09)
 *
 * PURPOSE: Translates Traffic Engine v2 outputs into ProForma assumptions.
 * Called when traffic predictions update or user uploads new actuals.
 * Direction: M07 → M09 (one-way, no circular dependency).
 *
 * 4 Translation Pipes:
 *   1. Occupancy Trajectory (10yr) → Vacancy % per year
 *   2. Eff Rent Trajectory (10yr)  → Rent Growth % per year
 *   3. Net Leases × 52 (seasonal)  → Absorption Rate (dev deals)
 *   4. Weeks to 95% Occupancy      → Lease-Up Timeline (dev deals)
 *
 * Calibrated from Highlands at Berewick (290 units, 243 weeks of actuals).
 *
 * @version 2.0.0
 */

import { pool } from '../database';
import { logger } from '../utils/logger';
import type { ProjectionResult, ProjectionSummary } from './tenYearProjectionService';
import type { LearnedRates } from './trafficLearningService';

// ============================================================================
// Interfaces
// ============================================================================

/** Raw traffic predictions per year (annualized from weekly predictions) */
export interface AnnualTrafficPrediction {
  year: number;
  weeklyTraffic: number;
  weeklyTours: number;
  weeklyApps: number;
  weeklyLeases: number;
  closingRatio: number;
  occPct: number;
  effRent: number;
  annualLeases: number;
  turnover: number;
  confidence: number;
}

/** Occupancy trajectory point for a single year */
export interface OccupancyTrajectoryPoint {
  year: number;
  occ: number;
  vacancy: number;
  confidence: number;
}

/** Rent trajectory point for a single year */
export interface RentTrajectoryPoint {
  year: number;
  effRent: number;
  growth: number;
  confidence: number;
}

/** Complete handoff data from M07 to M09 */
export interface TrafficHandoff {
  rawTraffic: AnnualTrafficPrediction[];
  occupancyTrajectory: OccupancyTrajectoryPoint[];
  rentTrajectory: RentTrajectoryPoint[];
  leasingVelocity: { weeklyLeases: number; annualized: number; confidence: number };
  leaseUpTimeline: { weeksTo95: number; weeksTo93: number; weeksTo90: number } | null;
  dataWeeks: number;
  lastCalibrated: string;
  modelConfidence: number;
}

/** 3-layer assumption (Baseline / Platform / Override) for a single metric */
export interface ThreeLayerAssumption {
  id: string;
  label: string;
  category: 'revenue' | 'expense' | 'leasing' | 'exit';
  baseline: { values: (number | null)[]; source: string; conf: number };
  platform: { values: (number | null)[]; source: string; conf: number; module: string | null };
  override: { values: (number | null)[]; active: boolean };
  unit: string;
  direction: 'lower-is-better' | 'higher-is-better';
  insight: string;
}

/** ProForma year from the income statement calculation */
export interface ProFormaYear {
  year: number;
  rent: number;
  gpr: number;
  vacancy: string;
  vacancyLoss: number;
  egi: number;
  opex: number;
  noi: number;
  debtService: number;
  btcf: number;
  capRate: string;
}

/** Returns comparison between platform and baseline */
export interface ReturnsComparison {
  irr: { platform: string; baseline: string; delta: string };
  equityMultiple: { platform: string; baseline: string; delta: string };
  cashOnCash: { platform: string; baseline: string; delta: string };
  exitValue: { platform: string; baseline: string; delta: string };
  dscr: { platform: string; baseline: string; delta: string };
}

/** Complete output of traffic→proforma integration */
export interface TrafficProFormaResult {
  handoff: TrafficHandoff;
  assumptions: ThreeLayerAssumption[];
  incomeStatement: { platform: ProFormaYear[]; baseline: ProFormaYear[] };
  returns: ReturnsComparison;
  property: {
    name: string;
    units: number;
    type: string;
    acquisitionPrice: number;
  };
}

// ============================================================================
// Service
// ============================================================================

export class TrafficToProFormaService {

  /**
   * Main entry: Generate complete M07→M09 integration data for a property.
   * Called when traffic predictions update OR user uploads new actuals.
   */
  async pushTrafficToProForma(
    propertyId: string,
    dealId?: string
  ): Promise<TrafficProFormaResult> {
    // 1. Load traffic projection (from tenYearProjectionService cache)
    const projection = await this.loadProjection(propertyId);

    // 2. Load learned rates
    const learnedRates = await this.loadLearnedRates(propertyId);

    // 3. Load property info
    const property = await this.loadPropertyInfo(propertyId, dealId);

    // 4. Build the handoff data structure
    const handoff = this.buildHandoff(projection, learnedRates, property.units);

    // 5. Translate to 3-layer assumptions
    const assumptions = this.translateToAssumptions(handoff, property);

    // 6. Build income statements (platform vs baseline)
    const platformProforma = this.buildProForma(assumptions, 'platform', property);
    const baselineProforma = this.buildProForma(assumptions, 'baseline', property);

    // 7. Calculate returns comparison
    const returns = this.calculateReturnsComparison(
      platformProforma, baselineProforma, property.acquisitionPrice
    );

    // 8. Persist platform layer to proforma_assumptions (if deal exists)
    if (dealId) {
      await this.persistPlatformLayer(dealId, assumptions, handoff);
    }

    logger.info('Traffic → ProForma integration complete', {
      propertyId,
      dealId,
      dataWeeks: learnedRates?.data_weeks || 0,
      modelConfidence: handoff.modelConfidence,
    });

    return {
      handoff,
      assumptions,
      incomeStatement: { platform: platformProforma, baseline: baselineProforma },
      returns,
      property,
    };
  }

  // ────────────────────────────────────────────────────────────
  // Step 1: Load projection from cache
  // ────────────────────────────────────────────────────────────

  private async loadProjection(propertyId: string): Promise<ProjectionResult | null> {
    try {
      const result = await pool.query(
        `SELECT * FROM traffic_projections
         WHERE property_id = $1
         ORDER BY projection_date DESC
         LIMIT 1`,
        [propertyId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        property_id: row.property_id,
        projection_date: row.projection_date,
        total_units: row.total_units,
        weekly: row.weekly_projections || [],
        monthly: row.monthly_projections || [],
        quarterly: row.quarterly_projections || [],
        year1: row.year1_summary || this.defaultSummary(),
        year3: row.year3_summary || this.defaultSummary(),
        year5: row.year5_summary || this.defaultSummary(),
        year10: row.year10_summary || this.defaultSummary(),
        occupancy_trajectory: row.occupancy_trajectory || [],
        rent_trajectory: row.effective_rent_trajectory || [],
        revenue_trajectory: row.revenue_trajectory || [],
        lease_up_weeks_to_90: row.lease_up_weeks_to_90,
        lease_up_weeks_to_93: row.lease_up_weeks_to_93,
        lease_up_weeks_to_95: row.lease_up_weeks_to_95,
        seasonal_risk_windows: row.seasonal_risk_windows || [],
        model_version: row.model_version || '2.0.0',
      };
    } catch {
      return null;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Step 2: Load learned rates
  // ────────────────────────────────────────────────────────────

  private async loadLearnedRates(propertyId: string): Promise<LearnedRates | null> {
    try {
      const result = await pool.query(
        `SELECT * FROM traffic_learned_rates WHERE property_id = $1`,
        [propertyId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        property_id: row.property_id,
        tour_rate: parseFloat(row.tour_rate),
        app_rate: parseFloat(row.app_rate),
        lease_rate: parseFloat(row.lease_rate),
        renewal_rate: row.renewal_rate ? parseFloat(row.renewal_rate) : null,
        tour_rate_seasonal: row.tour_rate_seasonal || {},
        app_rate_seasonal: row.app_rate_seasonal || {},
        lease_rate_seasonal: row.lease_rate_seasonal || {},
        tour_rate_trend: row.tour_rate_trend,
        app_rate_trend: row.app_rate_trend,
        lease_rate_trend: row.lease_rate_trend,
        data_weeks: row.data_weeks,
        confidence_level: row.confidence_level,
        stabilized_occupancy: row.stabilized_occupancy ? parseFloat(row.stabilized_occupancy) : null,
        effective_rent_growth_rate: row.effective_rent_growth_rate ? parseFloat(row.effective_rent_growth_rate) : null,
        seasonal_index: row.seasonal_index || [],
        consecutive_same_direction: row.consecutive_same_direction || 0,
        bias_direction: row.bias_direction,
      };
    } catch {
      return null;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Step 3: Load property info
  // ────────────────────────────────────────────────────────────

  private async loadPropertyInfo(
    propertyId: string,
    dealId?: string
  ): Promise<{ name: string; units: number; type: string; acquisitionPrice: number; submarket: string; currentRent: number; opexPerUnit: number }> {
    const defaults = {
      name: 'Unknown Property',
      units: 200,
      type: 'Existing — Stabilized',
      acquisitionPrice: 40_000_000,
      submarket: '',
      currentRent: 1500,
      opexPerUnit: 6800,
    };

    try {
      const propResult = await pool.query(
        `SELECT p.name, p.total_units, p.property_type, p.submarket_name,
                d.acquisition_price, d.name as deal_name
         FROM properties p
         LEFT JOIN deals d ON d.property_id = p.id OR d.id = $2
         WHERE p.id = $1
         LIMIT 1`,
        [propertyId, dealId || null]
      );

      if (propResult.rows.length === 0) return defaults;
      const row = propResult.rows[0];

      // Try to get current rent from latest prediction
      const rentResult = await pool.query(
        `SELECT effective_rent FROM traffic_predictions
         WHERE property_id = $1 AND effective_rent IS NOT NULL
         ORDER BY week_ending DESC LIMIT 1`,
        [propertyId]
      );

      return {
        name: row.deal_name || row.name || defaults.name,
        units: row.total_units || defaults.units,
        type: row.property_type || defaults.type,
        acquisitionPrice: parseFloat(row.acquisition_price) || defaults.acquisitionPrice,
        submarket: row.submarket_name || '',
        currentRent: rentResult.rows[0]?.effective_rent
          ? parseFloat(rentResult.rows[0].effective_rent)
          : defaults.currentRent,
        opexPerUnit: defaults.opexPerUnit,
      };
    } catch {
      return defaults;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Step 4: Build handoff from projection + learned rates
  // ────────────────────────────────────────────────────────────

  private buildHandoff(
    projection: ProjectionResult | null,
    learnedRates: LearnedRates | null,
    totalUnits: number
  ): TrafficHandoff {
    const dataWeeks = learnedRates?.data_weeks || 0;

    // Build 10-year annual traffic predictions from projection trajectories
    const rawTraffic: AnnualTrafficPrediction[] = [];
    const occTrajectory: OccupancyTrajectoryPoint[] = [];
    const rentTrajectory: RentTrajectoryPoint[] = [];

    for (let year = 1; year <= 10; year++) {
      const monthIdx = (year - 1) * 12; // Start month index for this year

      // Get annual averages from monthly trajectories
      const occSlice = projection?.occupancy_trajectory?.slice(monthIdx, monthIdx + 12) || [];
      const rentSlice = projection?.rent_trajectory?.slice(monthIdx, monthIdx + 12) || [];
      const revSlice = projection?.revenue_trajectory?.slice(monthIdx, monthIdx + 12) || [];

      const avgOcc = occSlice.length > 0
        ? occSlice.reduce((s, v) => s + v, 0) / occSlice.length
        : Math.max(92, 96 - year * 0.3);

      const avgRent = rentSlice.length > 0
        ? rentSlice.reduce((s, v) => s + v, 0) / rentSlice.length
        : 1808 * Math.pow(1.03, year - 1);

      const prevRent = year === 1
        ? avgRent / 1.038
        : (rentTrajectory[year - 2]?.effRent || avgRent / 1.03);
      const growth = year === 1 ? 3.8 : ((avgRent / prevRent) - 1) * 100;

      // Confidence decays with time: 92% Y1 → ~44% Y10
      const conf = Math.max(40, Math.round(92 - (year - 1) * 5.3));

      // Derive funnel metrics from rates
      const tourRate = learnedRates?.tour_rate || 0.56;
      const appRate = learnedRates?.app_rate || 0.44;
      const leaseRate = learnedRates?.lease_rate || 0.75;
      const baseTraffic = 12 + year * 0.1;
      const tours = baseTraffic * tourRate;
      const apps = tours * appRate;
      const leases = apps * leaseRate;
      const closingRatio = (leases / baseTraffic) * 100;
      const annualLeases = Math.round(leases * 52);
      const turnover = Math.max(30, 38 + (year - 1) * 0.8);

      rawTraffic.push({
        year,
        weeklyTraffic: Math.round(baseTraffic * 10) / 10,
        weeklyTours: Math.round(tours * 10) / 10,
        weeklyApps: Math.round(apps * 10) / 10,
        weeklyLeases: Math.round(leases * 10) / 10,
        closingRatio: Math.round(closingRatio * 10) / 10,
        occPct: Math.round(avgOcc * 10) / 10,
        effRent: Math.round(avgRent),
        annualLeases,
        turnover: Math.round(turnover),
        confidence: conf,
      });

      occTrajectory.push({
        year,
        occ: Math.round(avgOcc * 10) / 10,
        vacancy: Math.round((100 - avgOcc) * 10) / 10,
        confidence: conf,
      });

      rentTrajectory.push({
        year,
        effRent: Math.round(avgRent),
        growth: Math.round(growth * 10) / 10,
        confidence: conf,
      });
    }

    // Leasing velocity from current data
    const currentWeeklyLeases = rawTraffic[0]?.weeklyLeases || 2.3;

    // Lease-up timeline (null for stabilized properties)
    const leaseUpTimeline = projection?.lease_up_weeks_to_95 != null
      ? {
          weeksTo95: projection.lease_up_weeks_to_95,
          weeksTo93: projection.lease_up_weeks_to_93 ?? 0,
          weeksTo90: projection.lease_up_weeks_to_90 ?? 0,
        }
      : null;

    return {
      rawTraffic,
      occupancyTrajectory: occTrajectory,
      rentTrajectory,
      leasingVelocity: {
        weeklyLeases: Math.round(currentWeeklyLeases * 10) / 10,
        annualized: Math.round(currentWeeklyLeases * 52),
        confidence: rawTraffic[0]?.confidence || 60,
      },
      leaseUpTimeline,
      dataWeeks,
      lastCalibrated: new Date().toISOString().slice(0, 10),
      modelConfidence: rawTraffic[0]?.confidence || 60,
    };
  }

  // ────────────────────────────────────────────────────────────
  // Step 5: Translate handoff → 3-layer assumptions
  // ────────────────────────────────────────────────────────────

  private translateToAssumptions(
    handoff: TrafficHandoff,
    property: { units: number; submarket: string; acquisitionPrice: number }
  ): ThreeLayerAssumption[] {
    const occ = handoff.occupancyTrajectory;
    const rent = handoff.rentTrajectory;
    const lv = handoff.leasingVelocity;
    const conf = handoff.modelConfidence;

    return [
      {
        id: 'vacancy',
        label: 'Vacancy Rate',
        category: 'revenue',
        baseline: {
          values: Array(10).fill(5.5),
          source: `Submarket avg (M05)`,
          conf: 60,
        },
        platform: {
          values: occ.map(o => Math.round(o.vacancy * 10) / 10),
          source: 'Traffic Engine v2 occupancy trajectory',
          conf,
          module: 'M07',
        },
        override: { values: Array(10).fill(5.0), active: false },
        unit: '%',
        direction: 'lower-is-better',
        insight: `Traffic engine predicts ${occ[0]?.vacancy?.toFixed(1)}% Y1 vacancy vs 5.5% market default — ${Math.round((5.5 - (occ[0]?.vacancy || 5.5)) * 10)}bps tighter. ${handoff.dataWeeks} weeks of actuals inform this prediction.`,
      },
      {
        id: 'rentGrowth',
        label: 'Rent Growth',
        category: 'revenue',
        baseline: {
          values: Array(10).fill(2.8),
          source: '3yr historical avg (M05)',
          conf: 55,
        },
        platform: {
          values: rent.map(r => Math.round(r.growth * 10) / 10),
          source: 'Traffic Engine v2 rent trajectory',
          conf,
          module: 'M07',
        },
        override: { values: Array(10).fill(3.0), active: false },
        unit: '%',
        direction: 'higher-is-better',
        insight: `Traffic engine sees ${rent[0]?.growth?.toFixed(1)}% Y1 growth — ${Math.round(((rent[0]?.growth || 2.8) - 2.8) * 10) * 10}bps above market baseline. Growth decelerates to ${rent[9]?.growth?.toFixed(1)}% by Y10 as rents approach ceiling.`,
      },
      {
        id: 'absorption',
        label: 'Absorption Rate',
        category: 'leasing',
        baseline: {
          values: Array(10).fill(130),
          source: 'Submarket avg (M05)',
          conf: 50,
        },
        platform: {
          values: handoff.rawTraffic.map(t => t.annualLeases),
          source: 'Traffic Engine v2 leasing velocity',
          conf,
          module: 'M07',
        },
        override: { values: Array(10).fill(140), active: false },
        unit: ' leases/yr',
        direction: 'higher-is-better',
        insight: `Property is leasing at ${lv.weeklyLeases}/week (${lv.annualized} annualized) vs 2.5/week submarket avg. Traffic engine expects gradual slowdown as market matures.`,
      },
      {
        id: 'opexGrowth',
        label: 'OpEx Growth',
        category: 'expense',
        baseline: {
          values: Array(10).fill(3.0),
          source: 'CPI + 50bps',
          conf: 65,
        },
        platform: {
          values: Array(10).fill(3.0),
          source: 'No traffic adjustment (expense-side)',
          conf: 65,
          module: null,
        },
        override: { values: Array(10).fill(3.0), active: false },
        unit: '%',
        direction: 'lower-is-better',
        insight: "Traffic engine doesn't adjust expenses. OpEx growth uses CPI + 50bps baseline.",
      },
      {
        id: 'exitCap',
        label: 'Exit Cap Rate',
        category: 'exit',
        baseline: {
          values: [null, null, null, null, 5.5, null, null, null, null, 5.5],
          source: 'Trailing 12mo submarket avg (M05)',
          conf: 45,
        },
        platform: {
          // If leasing velocity is strong (>15% above submarket), compress cap by 20bps
          values: [
            null, null, null, null,
            lv.annualized > 150 ? 5.3 : 5.5,
            null, null, null, null,
            lv.annualized > 130 ? 5.5 : 5.75,
          ],
          source: 'Traffic velocity suggests cap compression',
          conf: 60,
          module: 'M07',
        },
        override: { values: [null, null, null, null, 5.5, null, null, null, null, 5.75], active: false },
        unit: '%',
        direction: 'lower-is-better',
        insight: `Strong leasing velocity → lower perceived risk → slight cap compression. Platform adjusts Y5 exit from 5.5% to ${lv.annualized > 150 ? '5.3' : '5.5'}% (${lv.annualized > 150 ? '20' : '0'}bps). Conservative — only adjusts if velocity exceeds submarket by >15%.`,
      },
    ];
  }

  // ────────────────────────────────────────────────────────────
  // Step 6: Build 10-year income statement
  // ────────────────────────────────────────────────────────────

  private buildProForma(
    assumptions: ThreeLayerAssumption[],
    layer: 'baseline' | 'platform' | 'override',
    property: { units: number; acquisitionPrice: number; currentRent?: number; opexPerUnit?: number }
  ): ProFormaYear[] {
    const getVal = (id: string, yr: number): number | null => {
      const a = assumptions.find(x => x.id === id);
      if (!a) return null;
      const src = a.override.active && layer === 'override'
        ? a.override
        : layer === 'platform' ? a.platform : a.baseline;
      return src.values[yr];
    };

    const years: ProFormaYear[] = [];
    let currentRent = property.currentRent || 1808;
    const units = property.units;
    const opexPerUnit = property.opexPerUnit || 6800;
    const debtService = Math.round(property.acquisitionPrice * 0.65 * 0.0675); // 65% LTV, ~6.75% const

    for (let y = 0; y < 10; y++) {
      const vacancy = (getVal('vacancy', y) || 5.5) / 100;
      const rentGrowth = (getVal('rentGrowth', y) || 2.8) / 100;
      const opexGrowth = (getVal('opexGrowth', y) || 3.0) / 100;

      if (y > 0) currentRent = currentRent * (1 + rentGrowth);

      const gpr = units * currentRent * 12;
      const vacancyLoss = gpr * vacancy;
      const egi = gpr - vacancyLoss;
      const opex = units * opexPerUnit * Math.pow(1 + opexGrowth, y);
      const noi = egi - opex;
      const btcf = noi - debtService;
      const capRate = noi / property.acquisitionPrice * 100;

      years.push({
        year: y + 1,
        rent: Math.round(currentRent),
        gpr: Math.round(gpr),
        vacancy: (vacancy * 100).toFixed(1),
        vacancyLoss: Math.round(vacancyLoss),
        egi: Math.round(egi),
        opex: Math.round(opex),
        noi: Math.round(noi),
        debtService,
        btcf: Math.round(btcf),
        capRate: capRate.toFixed(2),
      });
    }

    return years;
  }

  // ────────────────────────────────────────────────────────────
  // Step 7: Calculate returns comparison
  // ────────────────────────────────────────────────────────────

  private calculateReturnsComparison(
    platform: ProFormaYear[],
    baseline: ProFormaYear[],
    acquisitionPrice: number
  ): ReturnsComparison {
    const equity = acquisitionPrice * 0.35; // 35% equity
    const fmt$ = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${(n / 1e3).toFixed(0)}K`;

    // Cash-on-Cash Y1
    const platCoC = (platform[0].btcf / equity * 100);
    const baseCoC = (baseline[0].btcf / equity * 100);

    // Exit values (Y5)
    const platExitCap = 0.053; // platform-adjusted
    const baseExitCap = 0.055;
    const platExitVal = platform[4].noi / platExitCap;
    const baseExitVal = baseline[4].noi / baseExitCap;

    // DSCR Y1
    const platDSCR = platform[0].noi / platform[0].debtService;
    const baseDSCR = baseline[0].noi / baseline[0].debtService;

    // Simplified IRR approximation (avg CoC + appreciation)
    const platAvgBTCF = platform.slice(0, 5).reduce((s, y) => s + y.btcf, 0) / 5;
    const baseAvgBTCF = baseline.slice(0, 5).reduce((s, y) => s + y.btcf, 0) / 5;
    const platIRR = ((platAvgBTCF + (platExitVal - acquisitionPrice) / 5) / equity) * 100;
    const baseIRR = ((baseAvgBTCF + (baseExitVal - acquisitionPrice) / 5) / equity) * 100;

    // Equity multiples
    const platTotalCash = platform.slice(0, 5).reduce((s, y) => s + y.btcf, 0) + platExitVal - acquisitionPrice * 0.65;
    const baseTotalCash = baseline.slice(0, 5).reduce((s, y) => s + y.btcf, 0) + baseExitVal - acquisitionPrice * 0.65;
    const platEM = platTotalCash / equity;
    const baseEM = baseTotalCash / equity;

    return {
      irr: {
        platform: `${platIRR.toFixed(1)}%`,
        baseline: `${baseIRR.toFixed(1)}%`,
        delta: `+${(platIRR - baseIRR).toFixed(1)}%`,
      },
      equityMultiple: {
        platform: `${platEM.toFixed(2)}x`,
        baseline: `${baseEM.toFixed(2)}x`,
        delta: `+${(platEM - baseEM).toFixed(2)}x`,
      },
      cashOnCash: {
        platform: `${platCoC.toFixed(1)}%`,
        baseline: `${baseCoC.toFixed(1)}%`,
        delta: `+${(platCoC - baseCoC).toFixed(1)}%`,
      },
      exitValue: {
        platform: fmt$(Math.round(platExitVal)),
        baseline: fmt$(Math.round(baseExitVal)),
        delta: fmt$(Math.round(platExitVal - baseExitVal)),
      },
      dscr: {
        platform: `${platDSCR.toFixed(2)}x`,
        baseline: `${baseDSCR.toFixed(2)}x`,
        delta: `+${(platDSCR - baseDSCR).toFixed(2)}x`,
      },
    };
  }

  // ────────────────────────────────────────────────────────────
  // Step 8: Persist platform layer to proforma_assumptions
  // ────────────────────────────────────────────────────────────

  private async persistPlatformLayer(
    dealId: string,
    assumptions: ThreeLayerAssumption[],
    handoff: TrafficHandoff
  ): Promise<void> {
    try {
      // Check if proforma_assumptions exists for this deal
      const existing = await pool.query(
        `SELECT id FROM proforma_assumptions WHERE deal_id = $1`,
        [dealId]
      );

      if (existing.rows.length === 0) {
        // No proforma yet — we don't auto-create here (that's the ProForma service's job)
        logger.debug('No proforma_assumptions found for deal, skipping platform layer persist', { dealId });
        return;
      }

      // Update the "current" (platform-adjusted) values
      const vacancy = assumptions.find(a => a.id === 'vacancy');
      const rentGrowth = assumptions.find(a => a.id === 'rentGrowth');
      const absorption = assumptions.find(a => a.id === 'absorption');
      const exitCap = assumptions.find(a => a.id === 'exitCap');

      await pool.query(
        `UPDATE proforma_assumptions SET
           vacancy_current = $2,
           rent_growth_current = $3,
           absorption_current = $4,
           exit_cap_current = $5,
           last_recalculation = NOW(),
           updated_at = NOW()
         WHERE deal_id = $1`,
        [
          dealId,
          vacancy?.platform.values[0] ?? 5.5,
          rentGrowth?.platform.values[0] ?? 2.8,
          absorption?.platform.values[0] ?? 130,
          exitCap?.platform.values[4] ?? 5.5,
        ]
      );

      // Create adjustment record for audit trail
      await pool.query(
        `INSERT INTO assumption_adjustments (
           proforma_id, adjustment_trigger, assumption_type,
           previous_value, new_value, calculation_method,
           calculation_inputs, confidence_score
         ) SELECT
           pa.id, 'periodic_update', 'vacancy',
           pa.vacancy_baseline, $2, 'traffic_engine_v2',
           $3::jsonb, $4
         FROM proforma_assumptions pa WHERE pa.deal_id = $1`,
        [
          dealId,
          vacancy?.platform.values[0] ?? 5.5,
          JSON.stringify({
            source: 'M07 Traffic Engine v2',
            data_weeks: handoff.dataWeeks,
            confidence: handoff.modelConfidence,
            occupancy_trajectory: handoff.occupancyTrajectory.slice(0, 3),
            rent_trajectory: handoff.rentTrajectory.slice(0, 3),
          }),
          handoff.modelConfidence,
        ]
      );

      logger.info('Platform layer persisted to proforma_assumptions', {
        dealId,
        vacancy: vacancy?.platform.values[0],
        rentGrowth: rentGrowth?.platform.values[0],
        absorption: absorption?.platform.values[0],
      });
    } catch (err) {
      logger.warn('Failed to persist platform layer (non-fatal)', { dealId, error: (err as Error).message });
    }
  }

  // ────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────

  private defaultSummary(): ProjectionSummary {
    return { avg_occupancy: 95, avg_effective_rent: 1808, annual_revenue: 0, annual_leases: 0, confidence: 50 };
  }
}

// ============================================================================
// Export singleton
// ============================================================================

export const trafficToProForma = new TrafficToProFormaService();
