/**
 * Deal Actuals Service
 * Handles actual performance logging and flywheel feed tracking
 */

import { getPool } from '../database/connection';
import {
  DealActual,
  DealActualsInput,
  TrafficLog,
  TrafficLogInput,
  FlywheelFeed,
  FlywheelFeedInput,
} from '../types/deal-actuals.types';

const pool = getPool();

export class DealActualsService {
  /**
   * Log monthly actuals for a deal
   */
  async logActuals(input: DealActualsInput, createdBy: string): Promise<DealActual> {
    const result = await pool.query(
      `INSERT INTO deal_actuals (
        deal_id, period_start, period_end,
        actual_noi, projected_noi,
        actual_occupancy, projected_occupancy,
        actual_avg_rent, projected_avg_rent,
        actual_opex, projected_opex,
        actual_revenue, projected_revenue,
        units_occupied, total_units,
        lease_renewals, new_leases, move_outs, avg_days_vacant,
        notes, data_source, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      ON CONFLICT (deal_id, period_start) DO UPDATE SET
        period_end = EXCLUDED.period_end,
        actual_noi = EXCLUDED.actual_noi,
        projected_noi = EXCLUDED.projected_noi,
        actual_occupancy = EXCLUDED.actual_occupancy,
        projected_occupancy = EXCLUDED.projected_occupancy,
        actual_avg_rent = EXCLUDED.actual_avg_rent,
        projected_avg_rent = EXCLUDED.projected_avg_rent,
        actual_opex = EXCLUDED.actual_opex,
        projected_opex = EXCLUDED.projected_opex,
        actual_revenue = EXCLUDED.actual_revenue,
        projected_revenue = EXCLUDED.projected_revenue,
        units_occupied = EXCLUDED.units_occupied,
        total_units = EXCLUDED.total_units,
        lease_renewals = EXCLUDED.lease_renewals,
        new_leases = EXCLUDED.new_leases,
        move_outs = EXCLUDED.move_outs,
        avg_days_vacant = EXCLUDED.avg_days_vacant,
        notes = EXCLUDED.notes,
        data_source = EXCLUDED.data_source,
        updated_at = NOW()
      RETURNING *`,
      [
        input.deal_id, input.period_start, input.period_end,
        input.actual_noi, input.projected_noi,
        input.actual_occupancy, input.projected_occupancy,
        input.actual_avg_rent, input.projected_avg_rent,
        input.actual_opex, input.projected_opex,
        input.actual_revenue, input.projected_revenue,
        input.units_occupied, input.total_units,
        input.lease_renewals, input.new_leases, input.move_outs, input.avg_days_vacant,
        input.notes, input.data_source || 'manual', createdBy,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get actuals for a deal
   */
  async getActuals(dealId: string, limit: number = 12): Promise<DealActual[]> {
    const result = await pool.query(
      `SELECT * FROM deal_actuals
       WHERE deal_id = $1
       ORDER BY period_start DESC
       LIMIT $2`,
      [dealId, limit]
    );

    return result.rows;
  }

  /**
   * Log traffic data
   */
  async logTraffic(input: TrafficLogInput, createdBy: string): Promise<TrafficLog> {
    const result = await pool.query(
      `INSERT INTO deal_traffic_logs (
        deal_id, period_start, period_end,
        actual_walkins, predicted_walkins,
        website_visitors, email_inquiries, phone_calls, digital_index,
        fdot_aadt, real_aadt,
        lease_conversions, tour_to_lease_rate,
        notes, data_source, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (deal_id, period_start) DO UPDATE SET
        period_end = EXCLUDED.period_end,
        actual_walkins = EXCLUDED.actual_walkins,
        predicted_walkins = EXCLUDED.predicted_walkins,
        website_visitors = EXCLUDED.website_visitors,
        email_inquiries = EXCLUDED.email_inquiries,
        phone_calls = EXCLUDED.phone_calls,
        digital_index = EXCLUDED.digital_index,
        fdot_aadt = EXCLUDED.fdot_aadt,
        real_aadt = EXCLUDED.real_aadt,
        lease_conversions = EXCLUDED.lease_conversions,
        tour_to_lease_rate = EXCLUDED.tour_to_lease_rate,
        notes = EXCLUDED.notes,
        data_source = EXCLUDED.data_source,
        updated_at = NOW()
      RETURNING *`,
      [
        input.deal_id, input.period_start, input.period_end,
        input.actual_walkins, input.predicted_walkins,
        input.website_visitors, input.email_inquiries, input.phone_calls, input.digital_index,
        input.fdot_aadt, input.real_aadt,
        input.lease_conversions, input.tour_to_lease_rate,
        input.notes, input.data_source || 'manual', createdBy,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get traffic logs for a deal
   */
  async getTrafficLogs(dealId: string, limit: number = 12): Promise<TrafficLog[]> {
    const result = await pool.query(
      `SELECT * FROM deal_traffic_logs
       WHERE deal_id = $1
       ORDER BY period_start DESC
       LIMIT $2`,
      [dealId, limit]
    );

    return result.rows;
  }

  /**
   * Create or update flywheel feed
   */
  async upsertFlywheelFeed(input: FlywheelFeedInput): Promise<FlywheelFeed> {
    const result = await pool.query(
      `INSERT INTO flywheel_feeds (
        deal_id, target_module,
        contribution_type, data_points, impact_level, status,
        calibration_description, calibration_applied,
        accuracy_before, accuracy_after, deals_affected,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (deal_id, target_module) DO UPDATE SET
        contribution_type = EXCLUDED.contribution_type,
        data_points = EXCLUDED.data_points,
        impact_level = EXCLUDED.impact_level,
        status = EXCLUDED.status,
        calibration_description = EXCLUDED.calibration_description,
        calibration_applied = EXCLUDED.calibration_applied,
        accuracy_before = EXCLUDED.accuracy_before,
        accuracy_after = EXCLUDED.accuracy_after,
        deals_affected = EXCLUDED.deals_affected,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *`,
      [
        input.deal_id, input.target_module,
        input.contribution_type, input.data_points, input.impact_level, input.status,
        input.calibration_description, input.calibration_applied || false,
        input.accuracy_before, input.accuracy_after, input.deals_affected,
        input.notes,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get flywheel feeds for a deal
   */
  async getFlywheelFeeds(dealId: string): Promise<FlywheelFeed[]> {
    const result = await pool.query(
      `SELECT * FROM flywheel_feeds
       WHERE deal_id = $1
       ORDER BY impact_level DESC, target_module`,
      [dealId]
    );

    return result.rows;
  }

  /**
   * Verify actuals (mark as verified by user)
   */
  async verifyActuals(id: number, verifiedBy: string): Promise<DealActual> {
    const result = await pool.query(
      `UPDATE deal_actuals
       SET verified = true, verified_by = $1, verified_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [verifiedBy, id]
    );

    return result.rows[0];
  }

  /**
   * Get actuals summary for dashboard
   */
  async getActualsSummary(dealId: string) {
    const actuals = await pool.query(
      `SELECT 
        COUNT(*) as months_logged,
        SUM(actual_noi) as total_actual_noi,
        SUM(projected_noi) as total_projected_noi,
        AVG(actual_occupancy) as avg_occupancy,
        AVG(actual_avg_rent) as avg_rent,
        MAX(period_end) as last_updated
       FROM deal_actuals
       WHERE deal_id = $1 AND actual_noi IS NOT NULL`,
      [dealId]
    );

    const traffic = await pool.query(
      `SELECT 
        COUNT(*) as months_logged,
        AVG(actual_walkins) as avg_walkins,
        AVG(lease_conversions) as avg_conversions,
        MAX(period_end) as last_updated
       FROM deal_traffic_logs
       WHERE deal_id = $1 AND actual_walkins IS NOT NULL`,
      [dealId]
    );

    const feeds = await pool.query(
      `SELECT COUNT(*) as feed_count
       FROM flywheel_feeds
       WHERE deal_id = $1`,
      [dealId]
    );

    return {
      actuals: actuals.rows[0],
      traffic: traffic.rows[0],
      flywheel_feeds: parseInt(feeds.rows[0].feed_count),
    };
  }
}

export const dealActualsService = new DealActualsService();
