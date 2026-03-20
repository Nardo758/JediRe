/**
 * M22 Monthly Actuals Service
 * THE CRITICAL PATH - Everything else depends on this.
 * 
 * Living record of actual performance, appended monthly.
 * Links to frozen snapshot for variance analysis.
 * Triggers calibration push after each upload.
 */

import { getPool } from '../database/connection';
import { calibrationService } from './calibration.service';

const pool = getPool();

export interface MonthlyActualsInput {
  deal_id: string;
  period_start: string;      // YYYY-MM-DD
  period_end: string;

  // Performance
  actual_noi?: number;
  actual_revenue?: number;
  actual_opex?: number;
  actual_occupancy?: number;
  actual_avg_rent?: number;

  // Traffic (M07 validation)
  actual_walkins?: number;
  predicted_walkins?: number;
  actual_digital_index?: number;
  actual_fdot_aadt?: number;
  lease_conversions?: number;

  // Unit Activity
  units_occupied?: number;
  total_units?: number;
  new_leases?: number;
  lease_renewals?: number;
  move_outs?: number;
  avg_days_vacant?: number;

  // CapEx
  capex_spend?: number;
  units_renovated?: number;

  // Metadata
  data_source?: string;
}

export interface MonthlyActuals extends MonthlyActualsInput {
  id: number;
  snapshot_id: number | null;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  uploaded_by: string;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export class MonthlyActualsService {
  /**
   * Upload monthly actuals
   * CRITICAL: After successful upload, triggers calibration push
   */
  async uploadActuals(
    input: MonthlyActualsInput,
    uploadedBy: string
  ): Promise<MonthlyActuals> {
    // Get snapshot_id (link to frozen underwriting)
    const snapshotResult = await pool.query(
      `SELECT id FROM deal_snapshots
       WHERE deal_id = $1 AND trigger_event = 'closed'
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [input.deal_id]
    );

    const snapshot_id = snapshotResult.rows[0]?.id || null;

    // Insert or update actuals
    const result = await pool.query(
      `INSERT INTO deal_monthly_actuals (
        deal_id, snapshot_id,
        period_start, period_end,
        actual_noi, actual_revenue, actual_opex, actual_occupancy, actual_avg_rent,
        actual_walkins, predicted_walkins, actual_digital_index, actual_fdot_aadt, lease_conversions,
        units_occupied, total_units, new_leases, lease_renewals, move_outs, avg_days_vacant,
        capex_spend, units_renovated,
        data_source, uploaded_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      )
      ON CONFLICT (deal_id, period_start) DO UPDATE SET
        period_end = EXCLUDED.period_end,
        actual_noi = EXCLUDED.actual_noi,
        actual_revenue = EXCLUDED.actual_revenue,
        actual_opex = EXCLUDED.actual_opex,
        actual_occupancy = EXCLUDED.actual_occupancy,
        actual_avg_rent = EXCLUDED.actual_avg_rent,
        actual_walkins = EXCLUDED.actual_walkins,
        predicted_walkins = EXCLUDED.predicted_walkins,
        actual_digital_index = EXCLUDED.actual_digital_index,
        actual_fdot_aadt = EXCLUDED.actual_fdot_aadt,
        lease_conversions = EXCLUDED.lease_conversions,
        units_occupied = EXCLUDED.units_occupied,
        total_units = EXCLUDED.total_units,
        new_leases = EXCLUDED.new_leases,
        lease_renewals = EXCLUDED.lease_renewals,
        move_outs = EXCLUDED.move_outs,
        avg_days_vacant = EXCLUDED.avg_days_vacant,
        capex_spend = EXCLUDED.capex_spend,
        units_renovated = EXCLUDED.units_renovated,
        data_source = EXCLUDED.data_source,
        updated_at = NOW()
      RETURNING *`,
      [
        input.deal_id,
        snapshot_id,
        input.period_start,
        input.period_end,
        input.actual_noi,
        input.actual_revenue,
        input.actual_opex,
        input.actual_occupancy,
        input.actual_avg_rent,
        input.actual_walkins,
        input.predicted_walkins,
        input.actual_digital_index,
        input.actual_fdot_aadt,
        input.lease_conversions,
        input.units_occupied,
        input.total_units,
        input.new_leases,
        input.lease_renewals,
        input.move_outs,
        input.avg_days_vacant,
        input.capex_spend,
        input.units_renovated,
        input.data_source || 'manual',
        uploadedBy,
      ]
    );

    const uploaded = result.rows[0];

    // CRITICAL: Trigger calibration push (Pattern 2)
    setImmediate(async () => {
      try {
        await calibrationService.pushCalibrations(uploaded);
        console.log(`Calibration push triggered for deal ${input.deal_id} period ${input.period_start}`);
      } catch (error) {
        console.error('Calibration push failed:', error);
      }
    });

    return uploaded;
  }

  /**
   * Get actuals for a deal
   */
  async getActuals(dealId: string, limit?: number): Promise<MonthlyActuals[]> {
    let query = `
      SELECT * FROM deal_monthly_actuals
      WHERE deal_id = $1
      ORDER BY period_start DESC
    `;

    if (limit) {
      query += ` LIMIT $2`;
      const result = await pool.query(query, [dealId, limit]);
      return result.rows;
    }

    const result = await pool.query(query, [dealId]);
    return result.rows;
  }

  /**
   * Verify actuals (mark as reviewed and approved)
   */
  async verifyActuals(
    id: number,
    verifiedBy: string
  ): Promise<MonthlyActuals> {
    const result = await pool.query(
      `UPDATE deal_monthly_actuals
       SET verified = true, verified_by = $1, verified_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [verifiedBy, id]
    );

    return result.rows[0];
  }

  /**
   * Bulk upload from CSV/API
   * Returns summary of uploaded records
   */
  async bulkUpload(
    records: MonthlyActualsInput[],
    uploadedBy: string
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        await this.uploadActuals(record, uploadedBy);
        success++;
      } catch (error) {
        failed++;
        errors.push(`${record.deal_id} ${record.period_start}: ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  /**
   * Get actuals summary for dashboard
   */
  async getSummary(dealId: string) {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as months_logged,
        SUM(actual_noi) as total_noi,
        AVG(actual_occupancy) as avg_occupancy,
        AVG(actual_avg_rent) as avg_rent,
        MAX(period_end) as last_period,
        COUNT(CASE WHEN verified THEN 1 END) as months_verified
       FROM deal_monthly_actuals
       WHERE deal_id = $1`,
      [dealId]
    );

    return result.rows[0];
  }

  /**
   * Get variance analysis (actual vs projected from snapshot)
   */
  async getVarianceAnalysis(dealId: string) {
    const result = await pool.query(
      `SELECT 
        ma.period_start,
        ma.actual_noi,
        -- Projected NOI would come from snapshot proforma
        -- This requires unpacking capsule_data->proforma
        ma.actual_occupancy,
        ma.actual_avg_rent,
        ma.actual_walkins,
        ma.predicted_walkins,
        ma.verified
       FROM deal_monthly_actuals ma
       JOIN deal_snapshots ds ON ma.snapshot_id = ds.id
       WHERE ma.deal_id = $1
       ORDER BY ma.period_start DESC`,
      [dealId]
    );

    return result.rows.map((row) => ({
      ...row,
      noi_variance: null, // Calculate when proforma data available
      walkin_variance:
        row.actual_walkins && row.predicted_walkins
          ? ((row.actual_walkins - row.predicted_walkins) / row.predicted_walkins) * 100
          : null,
    }));
  }
}

export const monthlyActualsService = new MonthlyActualsService();
