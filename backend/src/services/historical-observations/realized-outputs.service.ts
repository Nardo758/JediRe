/**
 * RealizedOutputsService — Backfill Realized Output Columns
 *
 * For each historical_observations row at a given parcel, finds the
 * later row(s) at T+3, T+12, T+24 and computes realized changes:
 *
 *   realized_rent_change_t12 = (later_rent - current_rent) / current_rent
 *   realized_occupancy_change_t12 = later_occupancy - current_occupancy
 *   realized_concession_change_t12 = (later - current) (pp change)
 *
 * Runs on every new property performance insertion (triggered by
 * PropertyPerformanceIngestor) and nightly via Inngest cron for
 * rows whose T+N window recently closed.
 *
 * @see HISTORICAL_OBSERVATIONS_SPEC.md Section 4.2, Section 7
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CorpusRow {
  id: string;
  observation_date: string;
  property_occupancy: number | null;
  property_avg_rent: number | null;
  property_concession_per_unit: number | null;
}

interface BackfillPlan {
  rowId: string;
  // T+3
  t3Row: CorpusRow | null;
  // T+12
  t12Row: CorpusRow | null;
  // T+24
  t24Row: CorpusRow | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute realized change between two rows.
 */
function rentChange(current: number | null, later: number | null): number | null {
  if (current == null || later == null || current === 0) return null;
  return (later - current) / current;
}

function occupancyChange(current: number | null, later: number | null): number | null {
  if (current == null || later == null) return null;
  return later - current; // pp change
}

function concessionChange(current: number | null, later: number | null): number | null {
  if (current == null || later == null) return null;
  // Positive value means concessions went up — a move that typically indicates worse conditions
  // We store as a simple numeric difference; sign interpretation is the consumer's job
  return later - current;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class RealizedOutputsService {
  /**
   * Backfill realized_* columns for all rows at the given parcel that
   * have a later observation at T+3, T+12, or T+24.
   *
   * Idempotent: skips rows where all three realized windows are already populated.
   *
   * @returns Number of rows updated
   */
  async backfillForParcel(parcelId: string): Promise<number> {
    const rows = await this.getOrderedRows(parcelId);
    if (rows.length < 2) {
      logger.debug('[RealizedOutputsService] Too few rows for backfill', {
        parcelId,
        count: rows.length,
      });
      return 0;
    }

    let updated = 0;

    for (let i = 0; i < rows.length; i++) {
      const current = rows[i];
      const currentDate = new Date(current.observation_date);

      // Find rows at T+N windows
      const t3Date = this.addMonths(currentDate, 3);
      const t12Date = this.addMonths(currentDate, 12);
      const t24Date = this.addMonths(currentDate, 24);

      const plan: BackfillPlan = {
        rowId: current.id,
        t3Row: this.findNearestRow(rows, i, t3Date),
        t12Row: this.findNearestRow(rows, i, t12Date),
        t24Row: this.findNearestRow(rows, i, t24Date),
      };

      // Build UPDATE SET assignments for non-null realized values
      const assignments: string[] = [];
      const params: unknown[] = [];
      let idx = 0;

      this.applyPlan(plan, current, assignments, params, 't3', idx);
      idx = params.length;
      this.applyPlan(plan, current, assignments, params, 't12', idx);
      idx = params.length;
      this.applyPlan(plan, current, assignments, params, 't24', idx);

      if (assignments.length === 0) continue; // nothing to update

      // Check if all windows are closed → set realization_complete = TRUE
      const allClosed = plan.t3Row != null && plan.t12Row != null && plan.t24Row != null;
      if (allClosed) {
        idx = params.length + 1;
        params.push(true);
        params.push(new Date());
        assignments.push(`realization_complete = $${idx}`);
        idx++;
        assignments.push(`realization_complete_date = $${idx}::DATE`);
      }

      // Only update if something changed
      params.push(current.id);
      const sql = `
        UPDATE historical_observations
        SET ${assignments.join(', ')}, updated_at = NOW()
        WHERE id = $${params.length}
        AND (
          ${['t3', 't12', 't24']
            .map((w) => `realized_rent_change_${w} IS NULL`)
            .join(' OR ')}
        )
      `;

      try {
        const result = await query(sql, params);
        if (result.rowCount && result.rowCount > 0) updated++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[RealizedOutputsService] Row update failed', {
          rowId: current.id,
          error: msg,
        });
      }
    }

    logger.info('[RealizedOutputsService] Backfill complete', {
      parcelId,
      rowsBackfilled: updated,
    });

    return updated;
  }

  /**
   * Backfill realized_* columns for ALL rows in the corpus where the
   * observation date is past the T+N window but realized columns are null.
   *
   * Runs nightly via Inngest cron.
   */
  async backfillAllOverdue(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      // Find all distinct parcel_ids with rows needing backfill
      const overdueSql = `
        SELECT DISTINCT parcel_id
        FROM historical_observations
        WHERE parcel_id IS NOT NULL
          AND is_subject_property = TRUE
          AND observation_date <= (NOW() - INTERVAL '3 months')
          AND (
            realized_rent_change_t3 IS NULL
            OR realized_rent_change_t12 IS NULL
            OR realized_rent_change_t24 IS NULL
          )
        ORDER BY parcel_id
      `;

      const result = await query(overdueSql);

      for (const row of result.rows) {
        try {
          const count = await this.backfillForParcel(row.parcel_id as string);
          processed += count;
        } catch {
          errors++;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[RealizedOutputsService] backfillAllOverdue failed', {
        error: msg,
      });
      errors = Math.max(errors, 1);
    }

    logger.info('[RealizedOutputsService] backfillAllOverdue complete', {
      processed,
      errors,
    });

    return { processed, errors };
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  private async getOrderedRows(parcelId: string): Promise<CorpusRow[]> {
    const sql = `
      SELECT id, observation_date::TEXT,
             property_occupancy, property_avg_rent, property_concession_per_unit
      FROM historical_observations
      WHERE parcel_id = $1
      ORDER BY observation_date ASC
    `;
    const result = await query(sql, [parcelId]);
    return result.rows as CorpusRow[];
  }

  private addMonths(date: Date, n: number): Date {
    const d = new Date(date);
    d.setUTCMonth(d.getUTCMonth() + n);
    return d;
  }

  /**
   * Find the nearest row at approximately the target date.
   * Uses ±15 days tolerance for monthly observations.
   */
  private findNearestRow(
    rows: CorpusRow[],
    currentIndex: number,
    targetDate: Date,
  ): CorpusRow | null {
    const targetMs = targetDate.getTime();
    const tolerance = 30 * 24 * 60 * 60 * 1000; // ±30 days for monthly data

    // Search forward from current index only (later observations)
    for (let j = currentIndex + 1; j < rows.length; j++) {
      const rowDate = new Date(rows[j].observation_date);
      const diffMs = Math.abs(rowDate.getTime() - targetMs);
      if (diffMs <= tolerance) {
        return rows[j];
      }
      if (rowDate.getTime() > targetMs + tolerance) {
        break; // passed the window
      }
    }

    return null;
  }

  private applyPlan(
    plan: BackfillPlan,
    current: CorpusRow,
    assignments: string[],
    params: unknown[],
    suffix: string,
    startIdx: number,
  ): void {
    const targetRow: CorpusRow | null =
      suffix === 't3' ? plan.t3Row
      : suffix === 't12' ? plan.t12Row
      : plan.t24Row;

    if (!targetRow) return;

    let idx = startIdx;

    const r3 = rentChange(current.property_avg_rent, targetRow.property_avg_rent);
    if (r3 != null) {
      idx++; params.push(r3); assignments.push(`realized_rent_change_${suffix} = $${idx}`);
    }

    const o3 = occupancyChange(current.property_occupancy, targetRow.property_occupancy);
    if (o3 != null) {
      idx++; params.push(o3); assignments.push(`realized_occupancy_change_${suffix} = $${idx}`);
    }

    if (suffix === 't12') {
      const c12 = concessionChange(current.property_concession_per_unit, targetRow.property_concession_per_unit);
      if (c12 != null) {
        idx++; params.push(c12); assignments.push(`realized_concession_change_t12 = $${idx}`);
      }
    }
  }
}

export const realizedOutputsService = new RealizedOutputsService();
