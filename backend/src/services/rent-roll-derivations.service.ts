/**
 * M07: Single-Snapshot Derivations
 *
 * Fired on each rent roll ingest after leasing_events are stored.
 * Computes and stores derived metrics on the rent_roll_snapshots record.
 *
 * Derivations (per spec §5.x):
 *   §5.3  24-month signing velocity histogram (survivor-bias weighted)
 *   §5.8  Single-snapshot renewal rate proxy
 *   §5.11 Expiration waterfall (24 months forward)
 *   §5.9  Per-unit-type metrics
 */

import type { Pool } from 'pg';
import type { DerivedSnapshotMetrics, UnitTypeMetrics } from '../types/traffic-calibration.types';
import { logger } from '../utils/logger';

export class RentRollDerivationsService {

  constructor(private readonly pool: Pool) {}

  /**
   * Compute all derivations for a snapshot and persist to rent_roll_snapshots.derived_metrics
   */
  async deriveAndStore(snapshotId: number): Promise<DerivedSnapshotMetrics> {
    logger.info('[RentRollDerivations] Starting derivations', { snapshotId });

    // Load all lease events for this snapshot
    const result = await this.pool.query<any>(`
      SELECT
        unit_id, unit_type, unit_sf,
        contract_rent, market_rent, concession_value, concession_months,
        lease_start, lease_end, move_in_date, move_out_date, notice_date,
        unit_status, is_renewal, days_vacant, row_confidence
      FROM leasing_events
      WHERE snapshot_id = $1
    `, [snapshotId]);

    const rows = result.rows;
    if (rows.length === 0) {
      logger.warn('[RentRollDerivations] No lease events for snapshot', { snapshotId });
      return this.emptyDerived();
    }

    // Get the snapshot date to anchor relative month calculations
    const snapResult = await this.pool.query<{ snapshot_date: Date }>(`
      SELECT snapshot_date FROM rent_roll_snapshots WHERE id = $1
    `, [snapshotId]);
    const snapshotDate = snapResult.rows[0]?.snapshot_date
      ? new Date(snapResult.rows[0].snapshot_date)
      : new Date();

    // Compute each derivation
    const signingVelocity24m = this.computeSigningVelocity(rows, snapshotDate);
    const renewalRateProxy = this.computeRenewalRateProxy(rows, snapshotDate);
    const expirationWaterfall = this.computeExpirationWaterfall(rows, snapshotDate);
    const unitTypeBreakdown = this.computeUnitTypeBreakdown(rows, snapshotDate);

    const derived: DerivedSnapshotMetrics = {
      signing_velocity_24m: signingVelocity24m,
      renewal_rate_proxy: renewalRateProxy,
      expiration_waterfall: expirationWaterfall,
      unit_type_breakdown: unitTypeBreakdown,
    };

    // Persist to snapshot record
    await this.pool.query(`
      UPDATE rent_roll_snapshots
      SET derived_metrics = $1, status = 'derived', updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(derived), snapshotId]);

    logger.info('[RentRollDerivations] Derivations stored', {
      snapshotId,
      renewalRate: renewalRateProxy,
      unitTypes: unitTypeBreakdown.length,
      signingVelocityTotal: signingVelocity24m.reduce((a, b) => a + b, 0),
    });

    return derived;
  }

  // ============================================================================
  // §5.3: 24-Month Signing Velocity Histogram (survivor-bias weighted)
  //
  // For each lease in the last 24 months, count it in the month bucket it started.
  // Apply survivor-bias correction: earlier months have had more time to be
  // signed, so we weight older months down relative to newer months to avoid
  // overstating velocity in the middle of the observation window.
  //
  // Weight formula: w(m) = 1.0 for the most recent month, decreasing to 0.6
  // for 24 months ago (linear interpolation). This mirrors spec §1.3.
  // ============================================================================
  private computeSigningVelocity(rows: any[], snapshotDate: Date): number[] {
    const buckets = new Array(24).fill(0);  // bucket[0] = most recent month, bucket[23] = 24mo ago

    for (const row of rows) {
      if (!row.lease_start) continue;
      const leaseStart = new Date(row.lease_start);
      const monthsAgo = this.monthsBetween(leaseStart, snapshotDate);
      if (monthsAgo >= 0 && monthsAgo < 24) {
        buckets[monthsAgo] += 1;
      }
    }

    // Apply survivor-bias weighting: multiply each bucket by w(m)
    // w(0) = 1.0, w(23) = 0.6, linear interpolation
    const weighted = buckets.map((count, m) => {
      const w = 1.0 - (0.4 * m / 23);  // 1.0 → 0.6
      return Math.round(count * w * 10) / 10;
    });

    return weighted;
  }

  // ============================================================================
  // §5.8: Single-Snapshot Renewal Rate Proxy
  //
  // Proxy: (units marked is_renewal=true) / (units with lease_start in last 12 months)
  // Floors at 0, caps at 1.
  // ============================================================================
  // §5.8: snapshot-date-anchored renewal proxy.
  // Anchoring to snapshotDate (not now) prevents bias when processing historical snapshots —
  // leases that appear "recent" relative to upload time may be months old relative to snapshot.
  private computeRenewalRateProxy(rows: any[], snapshotDate: Date): number {
    const anchor = snapshotDate;
    const twelveMonthsAgo = new Date(anchor);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    let recentLeases = 0;
    let renewals = 0;

    for (const row of rows) {
      if (!row.lease_start) continue;
      const ls = new Date(row.lease_start);
      if (ls >= twelveMonthsAgo && ls <= anchor) {
        recentLeases++;
        if (row.is_renewal === true) renewals++;
      }
    }

    if (recentLeases === 0) return 0.5;  // No data — use 50% default
    return Math.min(1, Math.max(0, Math.round((renewals / recentLeases) * 100) / 100));
  }

  // ============================================================================
  // §5.11: Expiration Waterfall (24 months forward)
  //
  // For each of the next 24 months, count how many leases expire in that month.
  // ============================================================================
  private computeExpirationWaterfall(rows: any[], snapshotDate: Date): DerivedSnapshotMetrics['expiration_waterfall'] {
    const totalUnits = rows.filter(r => r.unit_status !== 'model' && r.unit_status !== 'down').length || 1;
    const buckets = new Array(24).fill(0);

    for (const row of rows) {
      if (!row.lease_end) continue;
      const leaseEnd = new Date(row.lease_end);
      const monthsOut = this.monthsBetween(snapshotDate, leaseEnd);
      if (monthsOut >= 1 && monthsOut <= 24) {
        buckets[monthsOut - 1] += 1;
      }
    }

    return buckets.map((count, i) => ({
      months_out: i + 1,
      expiring_units: count,
      expiring_pct: Math.round((count / totalUnits) * 10000) / 100,  // to 2 decimal places
    }));
  }

  // ============================================================================
  // §5.9: Per-Unit-Type Metrics
  // ============================================================================
  private computeUnitTypeBreakdown(rows: any[], snapshotDate: Date): UnitTypeMetrics[] {
    const byType: Record<string, any[]> = {};

    for (const row of rows) {
      const t = (row.unit_type || 'Unknown').trim();
      if (!byType[t]) byType[t] = [];
      byType[t].push(row);
    }

    const result: UnitTypeMetrics[] = [];
    // Anchor to snapshotDate so historical snapshots are not biased by current date
    const twelveMonthsAgo = new Date(snapshotDate);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    for (const [unit_type, typeRows] of Object.entries(byType)) {
      // Signing velocity = new leases in the 12 months up to snapshot date / 12
      const recentLeases = typeRows.filter(r =>
        r.lease_start && new Date(r.lease_start) >= twelveMonthsAgo
      );
      const signing_velocity = Math.round((recentLeases.length / 12) * 100) / 100;

      // Days vacant avg
      const vacantRows = typeRows.filter(r => r.days_vacant != null && r.days_vacant >= 0);
      const days_vacant_avg = vacantRows.length > 0
        ? Math.round(vacantRows.reduce((s, r) => s + r.days_vacant, 0) / vacantRows.length)
        : 0;

      // Concession intensity (avg free months)
      const concRows = typeRows.filter(r => r.concession_months != null);
      const concession_intensity = concRows.length > 0
        ? Math.round((concRows.reduce((s, r) => s + r.concession_months, 0) / concRows.length) * 10) / 10
        : 0;

      // Renewal rate
      const recentNonNull = recentLeases.filter(r => r.is_renewal != null);
      const renewal_rate = recentNonNull.length > 0
        ? Math.round((recentNonNull.filter(r => r.is_renewal).length / recentNonNull.length) * 100) / 100
        : 0.5;

      result.push({ unit_type, signing_velocity, days_vacant_avg, concession_intensity, renewal_rate });
    }

    return result;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private monthsBetween(earlier: Date, later: Date): number {
    const yearDiff = later.getFullYear() - earlier.getFullYear();
    const monthDiff = later.getMonth() - earlier.getMonth();
    return yearDiff * 12 + monthDiff;
  }

  private emptyDerived(): DerivedSnapshotMetrics {
    return {
      signing_velocity_24m: new Array(24).fill(0),
      renewal_rate_proxy: 0.5,
      expiration_waterfall: Array.from({ length: 24 }, (_, i) => ({
        months_out: i + 1,
        expiring_units: 0,
        expiring_pct: 0,
      })),
      unit_type_breakdown: [],
    };
  }
}
