/**
 * M07: Starting State Resolver
 *
 * Resolves the starting state (STABILIZED / LEASE_UP / REDEVELOPMENT) for a deal.
 * The starting state determines which prediction branch the engine uses.
 *
 * Resolution logic (spec §4.4):
 *   1. If deal.deal_mode is explicitly set → use that
 *   2. Else: infer from deal data and rent roll presence
 *      - Has rent roll + occupancy >= 80% → STABILIZED
 *      - Has rent roll + occupancy < 80% OR no rent roll → LEASE_UP
 *      - Deal has phased construction data → REDEVELOPMENT
 */

import type { Pool } from 'pg';
import type {
  StartingState,
  StabilizedState,
  LeaseUpState,
  RedevelopmentState,
  DerivedSnapshotMetrics,
  AbsorptionBenchmark,
} from '../types/traffic-calibration.types';
import { logger } from '../utils/logger';

export class StartingStateService {

  constructor(private readonly pool: Pool) {}

  /**
   * Main entry: resolve the starting state for a deal.
   */
  async resolveStartingState(dealId: string | null): Promise<StartingState> {
    if (!dealId) {
      // No deal context — fall back to STABILIZED (neutral baseline).
      // LEASE_UP applies mode-dispatch multipliers that would distort non-deal predictions.
      return this.defaultStabilizedState();
    }
    // Load deal metadata
    const dealResult = await this.pool.query<any>(`
      SELECT d.id, d.deal_mode, d.target_units, d.deal_data, d.property_data,
             d.project_type, d.development_type,
             (d.deal_data->'market_intelligence'->'data'->'demographics'->'submarket'->>'id') AS submarket_id,
             (d.deal_data->'market_intelligence'->'data'->'demographics'->'submarket'->>'avg_occupancy')::NUMERIC / 100.0 AS current_occupancy
      FROM deals d
      WHERE d.id = $1
    `, [dealId]);

    if (dealResult.rows.length === 0) {
      logger.warn('[StartingState] Deal not found, defaulting to LEASE_UP', { dealId });
      return this.defaultLeaseUpState();
    }

    const deal = dealResult.rows[0];

    // Load latest rent roll snapshot + derived metrics
    const snapshotResult = await this.pool.query<any>(`
      SELECT id, derived_metrics, snapshot_date
      FROM rent_roll_snapshots
      WHERE deal_id = $1 AND status IN ('derived', 'calibrated')
      ORDER BY snapshot_date DESC
      LIMIT 1
    `, [dealId]);

    const snapshot = snapshotResult.rows[0] || null;
    const derived: DerivedSnapshotMetrics | null = snapshot?.derived_metrics || null;

    // Determine mode
    const explicitMode = deal.deal_mode;

    if (explicitMode === 'REDEVELOPMENT' || this.isRedevelopment(deal)) {
      return this.buildRedevelopmentState(deal, derived);
    }

    const hasRentRoll = snapshot !== null;
    const occupancy = this.getOccupancy(deal, derived);

    if (explicitMode === 'STABILIZED' || (hasRentRoll && occupancy >= 0.80)) {
      return this.buildStabilizedState(deal, derived, occupancy);
    }

    // Default: LEASE_UP
    return await this.buildLeaseUpState(deal, derived);
  }

  // ============================================================================
  // STABILIZED: anchored by rent roll data
  // ============================================================================
  private buildStabilizedState(
    deal: any,
    derived: DerivedSnapshotMetrics | null,
    occupancy: number,
  ): StabilizedState {
    const renewalRate = derived?.renewal_rate_proxy ?? 0.55;
    const expirationWaterfall = derived?.expiration_waterfall ?? this.emptyWaterfall();

    // Churn replacement rate: proportion of units that need to be re-leased each month
    // = (1 - renewal_rate) / avg_tenancy_months
    // avg_tenancy_months derived from expiration_waterfall weighted average
    const avgTenancyMonths = this.computeAvgTenancyMonths(expirationWaterfall);
    const churnReplacementRate = Math.round(((1 - renewalRate) / avgTenancyMonths) * 10000) / 10000;

    // Days vacant avg from unit type breakdown
    const allDaysVacant = (derived?.unit_type_breakdown || []).map(ut => ut.days_vacant_avg).filter(d => d > 0);
    const avgDaysVacant = allDaysVacant.length > 0
      ? Math.round(allDaysVacant.reduce((a, b) => a + b, 0) / allDaysVacant.length)
      : 30;

    return {
      mode: 'STABILIZED',
      current_occupancy: occupancy,
      renewal_rate: renewalRate,
      expiration_waterfall: expirationWaterfall,
      avg_days_vacant: avgDaysVacant,
      churn_replacement_rate: churnReplacementRate,
    };
  }

  // ============================================================================
  // LEASE_UP: uses absorption curve from peer benchmark
  // ============================================================================
  private async buildLeaseUpState(deal: any, derived: DerivedSnapshotMetrics | null): Promise<LeaseUpState> {
    const submarketId = deal.submarket_id;
    const targetUnits = deal.target_units || 100;

    // Lookup absorption benchmark from platform calibration
    const benchmark = await this.getAbsorptionBenchmark(submarketId, deal.deal_data?.property_class);

    // Seasonality overlay: 12-month normalized multipliers (default flat)
    const seasonalityOverlay = benchmark?.monthly_absorption_curve
      ? this.normalizeToSeasonality(benchmark.monthly_absorption_curve)
      : this.defaultSeasonality();

    return {
      mode: 'LEASE_UP',
      start_occupancy: 0,
      target_occupancy: 0.93,
      absorption_curve: benchmark?.monthly_absorption_curve || this.defaultAbsorptionCurve(),
      months_to_stabilization_p50: benchmark?.months_to_stabilization_p50 ?? 18,
      months_to_stabilization_p25: benchmark?.months_to_stabilization_p25 ?? 14,
      months_to_stabilization_p75: benchmark?.months_to_stabilization_p75 ?? 24,
      seasonality_overlay: seasonalityOverlay,
      concession_intensity_curve: benchmark?.concession_intensity_curve || this.defaultConcessionCurve(),
    };
  }

  // ============================================================================
  // REDEVELOPMENT: phased units
  // ============================================================================
  private buildRedevelopmentState(deal: any, derived: DerivedSnapshotMetrics | null): RedevelopmentState {
    const dealData = deal.deal_data || {};
    const phases: RedevelopmentState['phases'] = (dealData.phases || []).map((p: any, i: number) => ({
      phase_number: i + 1,
      units_count: p.units || Math.floor((deal.target_units || 100) / 2),
      co_date_months_out: p.co_months_out || (i + 1) * 12,
      start_occupancy: 0,
      target_occupancy: 0.93,
      mini_lease_up_months: p.lease_up_months || 18,
    }));

    // If no phase data, create a single phase
    if (phases.length === 0) {
      phases.push({
        phase_number: 1,
        units_count: deal.target_units || 100,
        co_date_months_out: 12,
        start_occupancy: 0,
        target_occupancy: 0.93,
        mini_lease_up_months: 18,
      });
    }

    const occupiedUnits = derived
      ? Math.round((this.getOccupancy(deal, derived)) * (deal.target_units || 100))
      : 0;

    const totalUnits = deal.target_units || 100;
    const offlineUnits = Math.max(0, totalUnits - occupiedUnits);

    return {
      mode: 'REDEVELOPMENT',
      total_units: totalUnits,
      occupied_units: occupiedUnits,
      offline_units: offlineUnits,
      phases,
      overall_occupancy: occupiedUnits / Math.max(totalUnits, 1),
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private getOccupancy(deal: any, derived: DerivedSnapshotMetrics | null): number {
    // Try from deal property data first
    if (deal.current_occupancy != null) {
      const occ = parseFloat(deal.current_occupancy);
      if (!isNaN(occ) && occ >= 0 && occ <= 1) return occ;
      if (!isNaN(occ) && occ > 1 && occ <= 100) return occ / 100;
    }
    // Try from deal_data
    const dealData = deal.deal_data || {};
    if (dealData.occupancy != null) {
      const occ = parseFloat(dealData.occupancy);
      if (!isNaN(occ) && occ >= 0 && occ <= 1) return occ;
      if (!isNaN(occ) && occ > 1 && occ <= 100) return occ / 100;
    }
    // Default
    return 0.90;
  }

  private isRedevelopment(deal: any): boolean {
    const pt = (deal.project_type || '').toLowerCase();
    return pt.includes('redevelop') || pt.includes('renovation') || pt.includes('reposition');
  }

  private computeAvgTenancyMonths(waterfall: DerivedSnapshotMetrics['expiration_waterfall']): number {
    let totalUnits = 0;
    let weightedMonths = 0;

    for (const bucket of waterfall) {
      totalUnits += bucket.expiring_units;
      weightedMonths += bucket.expiring_units * bucket.months_out;
    }

    if (totalUnits === 0) return 12;  // default 1-year tenancy
    return Math.max(1, Math.round(weightedMonths / totalUnits));
  }

  private async getAbsorptionBenchmark(
    submarketId: string | null,
    propertyClass: string | null,
  ): Promise<any | null> {
    if (!submarketId) return null;

    try {
      const result = await this.pool.query<any>(`
        SELECT curve_data
        FROM traffic_calibration_coefficients
        WHERE coefficient_name = 'absorption_curve'
          AND submarket_id = $1
          AND (property_class = $2 OR $2 IS NULL)
        ORDER BY updated_at DESC
        LIMIT 1
      `, [submarketId, propertyClass || null]);

      if (result.rows.length === 0) return null;
      return result.rows[0].curve_data;
    } catch {
      return null;
    }
  }

  private defaultStabilizedState(): StabilizedState {
    // Conservative baseline for predictions with no deal context.
    // Uses 95% occupancy (typical stabilized asset) and 60% renewal rate.
    return {
      mode: 'STABILIZED',
      current_occupancy: 0.95,
      renewal_rate: 0.60,
      expiration_waterfall: Array.from({ length: 24 }, (_, i) => ({
        months_out: i,
        expiring_units: 0,
        expiring_pct: 0,
      })),
      avg_days_vacant: 30,
      churn_replacement_rate: (1 - 0.60) / 12,  // (1 - renewal_rate) / avg_tenancy_months
    };
  }

  private defaultLeaseUpState(): LeaseUpState {
    return {
      mode: 'LEASE_UP',
      start_occupancy: 0,
      target_occupancy: 0.93,
      absorption_curve: this.defaultAbsorptionCurve(),
      months_to_stabilization_p50: 18,
      months_to_stabilization_p25: 14,
      months_to_stabilization_p75: 24,
      seasonality_overlay: this.defaultSeasonality(),
      concession_intensity_curve: this.defaultConcessionCurve(),
    };
  }

  private defaultAbsorptionCurve(): number[] {
    // Front-loaded: more leases in early months, tapering off as occupancy fills
    return [8, 7, 7, 6, 6, 5, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1];
  }

  private defaultConcessionCurve(): number[] {
    // Free weeks: front-loaded concessions, fading as property fills
    return [6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }

  private defaultSeasonality(): number[] {
    // 12-month seasonal multipliers (typical multifamily: spring peak, winter trough)
    return [0.85, 0.88, 0.95, 1.05, 1.12, 1.10, 1.05, 1.02, 0.98, 0.95, 0.90, 0.82];
  }

  private normalizeToSeasonality(curve: number[]): number[] {
    // Extract first 12 values and normalize to mean = 1.0
    const slice = curve.slice(0, 12);
    if (slice.length < 12) return this.defaultSeasonality();
    const mean = slice.reduce((a, b) => a + b, 0) / 12;
    if (mean === 0) return this.defaultSeasonality();
    return slice.map(v => Math.round((v / mean) * 100) / 100);
  }

  private emptyWaterfall(): DerivedSnapshotMetrics['expiration_waterfall'] {
    return Array.from({ length: 24 }, (_, i) => ({
      months_out: i + 1,
      expiring_units: 0,
      expiring_pct: 0,
    }));
  }
}
