/**
 * JEDI RE Ten-Year Projection Service (v2)
 *
 * Generates 10-year forward projections for key leasing metrics:
 *   - Years 1-2: Weekly granularity (104 weeks)
 *   - Years 3-5: Monthly granularity (36 months)
 *   - Years 6-10: Quarterly granularity (20 quarters)
 *
 * Feeds: ProForma (M09), Strategy Arbitrage (M08), Risk (M14)
 *
 * Projection formulas calibrated from Highlands at Berewick data:
 *   traffic(w) = baseline × seasonal(w) × market_demand(yr) × supply_adj(yr) × age_decay(yr)
 *   net_leases(w) = traffic(w) × closing_ratio(season, occ, market)
 *   occupancy(m) = stabilized - seasonal_swing(m) + demand_trend(yr) - supply_impact(yr)
 *   eff_rent(m) = current × (1 + growth)^(m/12) × concession_factor(occ)
 *   revenue(m) = units × occupancy(m) × eff_rent(m)
 */

import { pool } from '../database';
import type { LearnedRates } from './trafficLearningService';

// ============================================================================
// Interfaces
// ============================================================================

export interface ProjectionInput {
  property_id: string;
  deal_id?: string;
  total_units: number;

  // Current state
  current_weekly_traffic: number;
  current_occupancy_pct: number;
  current_effective_rent: number;
  current_net_leases_per_week: number;

  // Learned rates (from trafficLearningService)
  learned_rates: LearnedRates;

  // Market context (from M05/M06)
  annual_demand_growth_rate?: number;    // e.g., 0.02 = 2% annual demand growth
  annual_supply_growth_rate?: number;    // e.g., 0.01 = 1% new supply
  submarket_vacancy_rate?: number;       // Current submarket vacancy
  property_age_years?: number;

  // Optional overrides
  rent_growth_override?: number;         // Override learned rent growth
  stabilized_occupancy_override?: number;
}

export interface WeeklyProjectionPoint {
  week: number;
  date: string;
  traffic: number;
  tours: number;
  apps: number;
  net_leases: number;
  occupancy_pct: number;
  effective_rent: number;
  closing_ratio: number;
  confidence: number;
}

export interface MonthlyProjectionPoint {
  month: number;
  occupancy_pct: number;
  occupancy_high: number;
  occupancy_low: number;
  effective_rent: number;
  rent_high: number;
  rent_low: number;
  gross_revenue: number;
  net_leases_monthly: number;
  confidence: number;
}

export interface QuarterlyProjectionPoint {
  quarter: number;
  occupancy_pct: number;
  effective_rent: number;
  gross_revenue: number;
  confidence: number;
}

export interface ProjectionResult {
  property_id: string;
  projection_date: string;
  total_units: number;

  weekly: WeeklyProjectionPoint[];     // 104 entries (years 1-2)
  monthly: MonthlyProjectionPoint[];   // 36 entries (years 3-5)
  quarterly: QuarterlyProjectionPoint[]; // 20 entries (years 6-10)

  // Summary snapshots
  year1: ProjectionSummary;
  year3: ProjectionSummary;
  year5: ProjectionSummary;
  year10: ProjectionSummary;

  // Key outputs for cross-module consumption
  occupancy_trajectory: number[];       // 120 monthly values
  rent_trajectory: number[];            // 120 monthly values
  revenue_trajectory: number[];         // 120 monthly values

  // Lease-up timeline (dev deals)
  lease_up_weeks_to_90: number | null;
  lease_up_weeks_to_93: number | null;
  lease_up_weeks_to_95: number | null;

  // Seasonal risk windows
  seasonal_risk_windows: Array<{ week_start: number; week_end: number; expected_occ: number; risk: string }>;

  model_version: string;
}

export interface ProjectionSummary {
  avg_occupancy: number;
  avg_effective_rent: number;
  annual_revenue: number;
  annual_leases: number;
  confidence: number;
}

// ============================================================================
// Constants — Seasonal patterns from Highlands data
// ============================================================================

// 52-week traffic seasonal index (normalized, 1.0 = average)
const DEFAULT_SEASONAL_TRAFFIC: number[] = [
  0.20,0.25,0.30,0.35,0.40,0.45,0.50,0.55,0.60,0.65,0.70,0.75,  // Jan-Mar
  0.80,0.85,0.90,1.00,1.10,1.20,1.30,1.40,1.50,1.60,1.70,1.80,  // Apr-Jun
  1.80,1.70,1.60,1.50,1.40,1.20,1.00,0.85,0.75,0.65,0.55,0.50,  // Jul-Sep
  0.45,0.40,0.35,0.30,0.25,0.22,0.20,0.18,0.15,0.15,0.12,0.15,  // Oct-Dec
  0.18,0.20,0.25,0.30,                                             // Wrap to 52
];

// Monthly occupancy seasonal swing (deviation from stabilized)
const SEASONAL_OCC_SWING: number[] = [
  -0.8, -0.5, 0.2, 0.6, 1.0, 1.5, 1.8, 1.5, 0.8, 0.2, -0.3, -0.7,
];

// ============================================================================
// Service
// ============================================================================

export class TenYearProjectionService {

  /**
   * Generate full 10-year projection
   */
  async generateProjection(input: ProjectionInput): Promise<ProjectionResult> {
    const rates = input.learned_rates;
    const seasonal = rates.seasonal_index?.length === 52
      ? rates.seasonal_index
      : DEFAULT_SEASONAL_TRAFFIC;

    // Derived parameters
    const stabilizedOcc = input.stabilized_occupancy_override
      || rates.stabilized_occupancy
      || input.current_occupancy_pct;

    const rentGrowth = input.rent_growth_override
      || rates.effective_rent_growth_rate
      || 0.032; // 3.2% default (Highlands learned)

    const demandGrowth = input.annual_demand_growth_rate || 0.02;
    const supplyGrowth = input.annual_supply_growth_rate || 0.01;
    const propertyAge = input.property_age_years || 5;

    // ── Phase 1: Weekly projections (104 weeks) ──
    const weekly = this.projectWeekly(input, seasonal, rates, stabilizedOcc, rentGrowth, demandGrowth, supplyGrowth, propertyAge);

    // ── Phase 2: Monthly projections (months 25-60) ──
    const monthly = this.projectMonthly(input, stabilizedOcc, rentGrowth, demandGrowth, supplyGrowth, propertyAge);

    // ── Phase 3: Quarterly projections (months 61-120) ──
    const quarterly = this.projectQuarterly(input, stabilizedOcc, rentGrowth, demandGrowth, supplyGrowth, propertyAge);

    // ── Build trajectories (120 months) ──
    const occTrajectory: number[] = [];
    const rentTrajectory: number[] = [];
    const revTrajectory: number[] = [];

    // Months 1-24 from weekly data (aggregate)
    for (let m = 0; m < 24; m++) {
      const weekStart = m * (52 / 12);
      const weekEnd = Math.min((m + 1) * (52 / 12), 104);
      const weekSlice = weekly.filter((_, i) => i >= weekStart && i < weekEnd);
      if (weekSlice.length > 0) {
        occTrajectory.push(Math.round(weekSlice.reduce((s, w) => s + w.occupancy_pct, 0) / weekSlice.length * 10) / 10);
        rentTrajectory.push(Math.round(weekSlice.reduce((s, w) => s + w.effective_rent, 0) / weekSlice.length));
        revTrajectory.push(Math.round(input.total_units * (occTrajectory[m] / 100) * rentTrajectory[m]));
      }
    }
    // Months 25-60 from monthly
    for (const mp of monthly) {
      occTrajectory.push(mp.occupancy_pct);
      rentTrajectory.push(mp.effective_rent);
      revTrajectory.push(mp.gross_revenue);
    }
    // Months 61-120 from quarterly (expand to monthly)
    for (const qp of quarterly) {
      for (let i = 0; i < 3; i++) {
        occTrajectory.push(qp.occupancy_pct);
        rentTrajectory.push(qp.effective_rent);
        revTrajectory.push(qp.gross_revenue);
      }
    }

    // ── Lease-up timeline (if occupancy < 90%) ──
    const leaseUp = this.calculateLeaseUpTimeline(weekly, input.current_occupancy_pct);

    // ── Seasonal risk windows ──
    const riskWindows = this.findSeasonalRiskWindows(weekly, 93);

    // ── Summaries ──
    const year1 = this.summarizeYear(weekly.slice(0, 52), input.total_units);
    const y3Monthly = monthly.slice(0, 12);
    const y5Monthly = monthly.slice(24, 36);
    const year3 = this.summarizeMonthly(y3Monthly, input.total_units);
    const year5 = this.summarizeMonthly(y5Monthly, input.total_units);
    const y10Q = quarterly.slice(16, 20);
    const year10 = this.summarizeQuarterly(y10Q, input.total_units);

    const result: ProjectionResult = {
      property_id: input.property_id,
      projection_date: new Date().toISOString().split('T')[0],
      total_units: input.total_units,
      weekly, monthly, quarterly,
      year1, year3, year5, year10,
      occupancy_trajectory: occTrajectory,
      rent_trajectory: rentTrajectory,
      revenue_trajectory: revTrajectory,
      lease_up_weeks_to_90: leaseUp.to90,
      lease_up_weeks_to_93: leaseUp.to93,
      lease_up_weeks_to_95: leaseUp.to95,
      seasonal_risk_windows: riskWindows,
      model_version: '2.0.0',
    };

    // Persist
    await this.saveProjection(result, input);

    return result;
  }

  // ──────────────────────────────────────────────────────────────────
  // Weekly projection (104 weeks)
  // ──────────────────────────────────────────────────────────────────

  private projectWeekly(
    input: ProjectionInput,
    seasonal: number[],
    rates: LearnedRates,
    stabilizedOcc: number,
    rentGrowth: number,
    demandGrowth: number,
    supplyGrowth: number,
    propertyAge: number,
  ): WeeklyProjectionPoint[] {
    const points: WeeklyProjectionPoint[] = [];
    const now = new Date();
    let prevOcc = input.current_occupancy_pct;

    for (let w = 0; w < 104; w++) {
      const year = w / 52;
      const weekOfYear = w % 52;
      const seasonFactor = seasonal[weekOfYear] || 1.0;

      // Traffic projection
      const marketDemandTrend = Math.pow(1 + demandGrowth, year);
      const supplyAdjustment = Math.max(0.85, 1 - supplyGrowth * year * 0.5);
      const ageDecay = Math.max(0.80, 1 - (propertyAge + year) * 0.003);
      const traffic = Math.max(1, Math.round(
        input.current_weekly_traffic * seasonFactor * marketDemandTrend * supplyAdjustment * ageDecay
      ));

      // Conversion rates (seasonal-adjusted)
      const season = this.getSeason(weekOfYear);
      const tourRate = rates.tour_rate_seasonal?.[season] || rates.tour_rate;
      const appRate = rates.app_rate_seasonal?.[season] || rates.app_rate;
      const leaseRate = rates.lease_rate_seasonal?.[season] || rates.lease_rate;

      // Funnel
      const tours = Math.max(0, Math.round(traffic * tourRate));
      const apps = Math.max(0, Math.round(tours * appRate));

      // Occupancy-adjusted closing
      const occModifier = prevOcc < 90 ? 1.3 : prevOcc > 96 ? 0.7 : 1.0;
      const netLeases = Math.max(0, Math.round(apps * leaseRate * occModifier));

      // Occupancy evolution
      const moveIns = netLeases;
      const avgMoveOuts = input.total_units * 0.50 / 52; // 50% annual turnover
      const occChange = (moveIns - avgMoveOuts) / input.total_units * 100;
      const occ = Math.min(98, Math.max(85,
        prevOcc + occChange + SEASONAL_OCC_SWING[Math.floor(weekOfYear / (52 / 12))] * 0.1
      ));
      prevOcc = occ;

      // Rent projection
      const concessionFactor = occ > 95 ? 1.0 : occ > 90 ? 0.97 : 0.92;
      const effRent = Math.round(
        input.current_effective_rent * Math.pow(1 + rentGrowth, year) * concessionFactor
      );

      const closingRatio = traffic > 0 ? Math.round(netLeases / traffic * 1000) / 10 : 0;

      // Confidence decays over time
      const baseConf = rates.data_weeks >= 104 ? 95 :
                        rates.data_weeks >= 52 ? 90 :
                        rates.data_weeks >= 13 ? 80 : 65;
      const confidence = Math.max(40, Math.round(baseConf - w * 0.15));

      // Date
      const date = new Date(now);
      date.setDate(date.getDate() + w * 7);

      points.push({
        week: w + 1, date: date.toISOString().split('T')[0],
        traffic, tours, apps, net_leases: netLeases,
        occupancy_pct: Math.round(occ * 10) / 10,
        effective_rent: effRent, closing_ratio: closingRatio,
        confidence,
      });
    }

    return points;
  }

  // ──────────────────────────────────────────────────────────────────
  // Monthly projection (months 25-60)
  // ──────────────────────────────────────────────────────────────────

  private projectMonthly(
    input: ProjectionInput,
    stabilizedOcc: number,
    rentGrowth: number,
    demandGrowth: number,
    supplyGrowth: number,
    propertyAge: number,
  ): MonthlyProjectionPoint[] {
    const points: MonthlyProjectionPoint[] = [];

    for (let m = 24; m < 60; m++) {
      const year = m / 12;
      const monthOfYear = m % 12;

      // Occupancy
      const demandAdj = demandGrowth * (year - 2) * 0.3;
      const supplyImpact = supplyGrowth * Math.max(0, year - 3) * 0.5;
      const ageDecline = year > 5 ? (year - 5) * 0.2 : 0;
      const occ = Math.min(98, Math.max(85,
        stabilizedOcc + SEASONAL_OCC_SWING[monthOfYear] + demandAdj - supplyImpact - ageDecline
      ));

      // Rent
      const concessionFactor = occ > 95 ? 1.0 : occ > 90 ? 0.97 : 0.92;
      const effRent = Math.round(
        input.current_effective_rent * Math.pow(1 + rentGrowth, year) * concessionFactor
      );

      // Confidence bands widen
      const bandWidth = 0.5 + m * 0.04;
      const occHigh = Math.min(98, Math.round((occ + bandWidth) * 10) / 10);
      const occLow = Math.max(85, Math.round((occ - bandWidth) * 10) / 10);
      const rentHigh = Math.round(effRent * (1 + m * 0.0012));
      const rentLow = Math.round(effRent * (1 - m * 0.0012));

      const revenue = Math.round(input.total_units * (occ / 100) * effRent);
      const leasesMonthly = Math.round(input.total_units * 0.50 / 12 * (occ / stabilizedOcc));
      const confidence = Math.max(40, Math.round(80 - (m - 24) * 0.5));

      points.push({
        month: m + 1,
        occupancy_pct: Math.round(occ * 10) / 10,
        occupancy_high: occHigh, occupancy_low: occLow,
        effective_rent: effRent, rent_high: rentHigh, rent_low: rentLow,
        gross_revenue: revenue, net_leases_monthly: leasesMonthly,
        confidence,
      });
    }

    return points;
  }

  // ──────────────────────────────────────────────────────────────────
  // Quarterly projection (months 61-120)
  // ──────────────────────────────────────────────────────────────────

  private projectQuarterly(
    input: ProjectionInput,
    stabilizedOcc: number,
    rentGrowth: number,
    demandGrowth: number,
    supplyGrowth: number,
    propertyAge: number,
  ): QuarterlyProjectionPoint[] {
    const points: QuarterlyProjectionPoint[] = [];

    for (let q = 0; q < 20; q++) {
      const month = 60 + q * 3;
      const year = month / 12;

      const demandAdj = demandGrowth * (year - 2) * 0.3;
      const supplyImpact = supplyGrowth * Math.max(0, year - 3) * 0.5;
      const ageDecline = year > 5 ? (year - 5) * 0.2 : 0;
      const occ = Math.min(98, Math.max(85,
        stabilizedOcc + demandAdj - supplyImpact - ageDecline
      ));

      const concessionFactor = occ > 95 ? 1.0 : occ > 90 ? 0.97 : 0.92;
      const effRent = Math.round(
        input.current_effective_rent * Math.pow(1 + rentGrowth, year) * concessionFactor
      );

      const revenue = Math.round(input.total_units * (occ / 100) * effRent);
      const confidence = Math.max(35, Math.round(65 - q * 1.5));

      points.push({
        quarter: q + 1,
        occupancy_pct: Math.round(occ * 10) / 10,
        effective_rent: effRent,
        gross_revenue: revenue,
        confidence,
      });
    }

    return points;
  }

  // ──────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────

  private calculateLeaseUpTimeline(
    weekly: WeeklyProjectionPoint[],
    currentOcc: number,
  ): { to90: number | null; to93: number | null; to95: number | null } {
    if (currentOcc >= 95) return { to90: null, to93: null, to95: null };

    let to90: number | null = currentOcc >= 90 ? 0 : null;
    let to93: number | null = currentOcc >= 93 ? 0 : null;
    let to95: number | null = currentOcc >= 95 ? 0 : null;

    for (const w of weekly) {
      if (to90 === null && w.occupancy_pct >= 90) to90 = w.week;
      if (to93 === null && w.occupancy_pct >= 93) to93 = w.week;
      if (to95 === null && w.occupancy_pct >= 95) to95 = w.week;
    }

    return { to90, to93, to95 };
  }

  private findSeasonalRiskWindows(
    weekly: WeeklyProjectionPoint[],
    threshold: number,
  ): Array<{ week_start: number; week_end: number; expected_occ: number; risk: string }> {
    const windows: Array<{ week_start: number; week_end: number; expected_occ: number; risk: string }> = [];
    let currentWindow: { start: number; minOcc: number } | null = null;

    for (const w of weekly) {
      if (w.occupancy_pct < threshold) {
        if (!currentWindow) {
          currentWindow = { start: w.week, minOcc: w.occupancy_pct };
        } else {
          currentWindow.minOcc = Math.min(currentWindow.minOcc, w.occupancy_pct);
        }
      } else if (currentWindow) {
        windows.push({
          week_start: currentWindow.start,
          week_end: w.week - 1,
          expected_occ: currentWindow.minOcc,
          risk: currentWindow.minOcc < 90 ? 'high' : 'moderate',
        });
        currentWindow = null;
      }
    }

    if (currentWindow) {
      windows.push({
        week_start: currentWindow.start,
        week_end: weekly[weekly.length - 1].week,
        expected_occ: currentWindow.minOcc,
        risk: currentWindow.minOcc < 90 ? 'high' : 'moderate',
      });
    }

    return windows;
  }

  private summarizeYear(weekly: WeeklyProjectionPoint[], units: number): ProjectionSummary {
    if (weekly.length === 0) return { avg_occupancy: 0, avg_effective_rent: 0, annual_revenue: 0, annual_leases: 0, confidence: 0 };
    const avgOcc = weekly.reduce((s, w) => s + w.occupancy_pct, 0) / weekly.length;
    const avgRent = weekly.reduce((s, w) => s + w.effective_rent, 0) / weekly.length;
    const totalLeases = weekly.reduce((s, w) => s + w.net_leases, 0);
    const avgConf = weekly.reduce((s, w) => s + w.confidence, 0) / weekly.length;
    return {
      avg_occupancy: Math.round(avgOcc * 10) / 10,
      avg_effective_rent: Math.round(avgRent),
      annual_revenue: Math.round(units * (avgOcc / 100) * avgRent * 12),
      annual_leases: totalLeases,
      confidence: Math.round(avgConf),
    };
  }

  private summarizeMonthly(months: MonthlyProjectionPoint[], units: number): ProjectionSummary {
    if (months.length === 0) return { avg_occupancy: 0, avg_effective_rent: 0, annual_revenue: 0, annual_leases: 0, confidence: 0 };
    const avgOcc = months.reduce((s, m) => s + m.occupancy_pct, 0) / months.length;
    const avgRent = months.reduce((s, m) => s + m.effective_rent, 0) / months.length;
    const totalLeases = months.reduce((s, m) => s + m.net_leases_monthly, 0);
    const avgConf = months.reduce((s, m) => s + m.confidence, 0) / months.length;
    return {
      avg_occupancy: Math.round(avgOcc * 10) / 10,
      avg_effective_rent: Math.round(avgRent),
      annual_revenue: months.reduce((s, m) => s + m.gross_revenue, 0),
      annual_leases: totalLeases,
      confidence: Math.round(avgConf),
    };
  }

  private summarizeQuarterly(quarters: QuarterlyProjectionPoint[], units: number): ProjectionSummary {
    if (quarters.length === 0) return { avg_occupancy: 0, avg_effective_rent: 0, annual_revenue: 0, annual_leases: 0, confidence: 0 };
    const avgOcc = quarters.reduce((s, q) => s + q.occupancy_pct, 0) / quarters.length;
    const avgRent = quarters.reduce((s, q) => s + q.effective_rent, 0) / quarters.length;
    const avgConf = quarters.reduce((s, q) => s + q.confidence, 0) / quarters.length;
    return {
      avg_occupancy: Math.round(avgOcc * 10) / 10,
      avg_effective_rent: Math.round(avgRent),
      annual_revenue: quarters.reduce((s, q) => s + q.gross_revenue, 0),
      annual_leases: Math.round(units * 0.50), // Assume 50% turnover at stabilized
      confidence: Math.round(avgConf),
    };
  }

  private getSeason(weekOfYear: number): string {
    if (weekOfYear < 9) return 'winter';
    if (weekOfYear < 22) return 'spring';
    if (weekOfYear < 35) return 'summer';
    if (weekOfYear < 48) return 'fall';
    return 'winter';
  }

  private async saveProjection(result: ProjectionResult, input: ProjectionInput): Promise<void> {
    await pool.query(`
      INSERT INTO traffic_projections (
        property_id, deal_id, total_units, horizon_months,
        weekly_projections, monthly_projections, quarterly_projections,
        year1_summary, year3_summary, year5_summary, year10_summary,
        occupancy_trajectory, effective_rent_trajectory, revenue_trajectory,
        lease_up_weeks_to_90, lease_up_weeks_to_93, lease_up_weeks_to_95,
        seasonal_risk_windows, model_version
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT (property_id, projection_date) DO UPDATE SET
        weekly_projections = EXCLUDED.weekly_projections,
        monthly_projections = EXCLUDED.monthly_projections,
        quarterly_projections = EXCLUDED.quarterly_projections,
        year1_summary = EXCLUDED.year1_summary,
        year3_summary = EXCLUDED.year3_summary,
        year5_summary = EXCLUDED.year5_summary,
        year10_summary = EXCLUDED.year10_summary,
        occupancy_trajectory = EXCLUDED.occupancy_trajectory,
        effective_rent_trajectory = EXCLUDED.effective_rent_trajectory,
        revenue_trajectory = EXCLUDED.revenue_trajectory,
        lease_up_weeks_to_90 = EXCLUDED.lease_up_weeks_to_90,
        lease_up_weeks_to_93 = EXCLUDED.lease_up_weeks_to_93,
        lease_up_weeks_to_95 = EXCLUDED.lease_up_weeks_to_95,
        seasonal_risk_windows = EXCLUDED.seasonal_risk_windows,
        updated_at = NOW()
    `, [
      input.property_id, input.deal_id || null, input.total_units, 120,
      JSON.stringify(result.weekly), JSON.stringify(result.monthly), JSON.stringify(result.quarterly),
      JSON.stringify(result.year1), JSON.stringify(result.year3),
      JSON.stringify(result.year5), JSON.stringify(result.year10),
      JSON.stringify(result.occupancy_trajectory),
      JSON.stringify(result.rent_trajectory),
      JSON.stringify(result.revenue_trajectory),
      result.lease_up_weeks_to_90, result.lease_up_weeks_to_93, result.lease_up_weeks_to_95,
      JSON.stringify(result.seasonal_risk_windows), result.model_version,
    ]);
  }
}

export const tenYearProjection = new TenYearProjectionService();
