/**
 * M22 Calibration Service
 * PATTERN 2: Calibration Push (Feedback Side)
 * 
 * After actuals upload, adjusts coefficients in platform analytical models.
 * Writes to 6 consumer tables, never touches archive.
 * Archive is read-only. Models are write targets.
 */

import { getPool } from '../database/connection';
import type { MonthlyActuals } from './monthly-actuals.service';

const pool = getPool();

export class CalibrationService {
  /**
   * Main calibration push
   * Called automatically after each actuals upload
   * Fans out to 6 consumers
   */
  async pushCalibrations(actuals: MonthlyActuals): Promise<void> {
    console.log(`[Calibration] Processing actuals for deal ${actuals.deal_id} period ${actuals.period_start}`);

    // Get deal context (snapshot + market info)
    const context = await this.getDealContext(actuals.deal_id);
    if (!context) {
      console.error(`[Calibration] No snapshot found for deal ${actuals.deal_id}`);
      return;
    }

    // Fan out to 6 consumers (run in parallel)
    await Promise.allSettled([
      this.calibrateTraffic(actuals, context),
      this.calibrateProForma(actuals, context),
      this.calibrateJEDI(actuals, context),
      this.logStrategyOutcome(actuals, context),
      this.indexInternalComp(actuals, context),
      this.calibrateTaxFormula(actuals, context),
    ]);

    console.log(`[Calibration] Complete for deal ${actuals.deal_id}`);
  }

  /**
   * Get deal context for calibration
   */
  private async getDealContext(dealId: string) {
    const result = await pool.query(
      `SELECT 
        ds.*,
        ds.capsule_data->>'submarket_id' as submarket_id,
        ds.capsule_data->>'property_class' as property_class,
        ds.capsule_data->>'vintage' as vintage,
        ds.capsule_data->>'address' as address,
        ds.capsule_data->>'lat' as lat,
        ds.capsule_data->>'lng' as lng
       FROM deal_snapshots ds
       WHERE ds.deal_id = $1 AND ds.trigger_event = 'closed'
       ORDER BY ds.snapshot_date DESC
       LIMIT 1`,
      [dealId]
    );

    return result.rows[0] || null;
  }

  /**
   * Consumer 1: M07 Traffic Calibration
   * Writes to traffic_calibration_factors
   */
  private async calibrateTraffic(actuals: MonthlyActuals, context: any): Promise<void> {
    if (!actuals.actual_walkins || !actuals.predicted_walkins) {
      return; // Skip if no traffic data
    }

    const error = ((actuals.actual_walkins - actuals.predicted_walkins) / actuals.predicted_walkins) * 100;
    const accuracy = 100 - Math.abs(error);

    // Determine seasonal factor adjustment needed
    const month = new Date(actuals.period_start).getMonth();
    const isSummer = month >= 3 && month <= 7; // Apr-Aug
    const isSnowbird = month >= 9 || month <= 1; // Oct-Feb

    const submarket_id = context.submarket_id || 'unknown';
    const property_class = context.property_class || 'B';
    const road_category = 'urban_arterial'; // Would come from deal data

    // Aggregate all actuals for this submarket to compute new factors
    const aggResult = await pool.query(
      `SELECT 
        COUNT(*) as sample_size,
        AVG(CASE WHEN actual_walkins IS NOT NULL AND predicted_walkins IS NOT NULL
            THEN (actual_walkins - predicted_walkins) / predicted_walkins * 100
            END) as avg_error
       FROM deal_monthly_actuals ma
       JOIN deal_snapshots ds ON ma.snapshot_id = ds.id
       WHERE ds.capsule_data->>'submarket_id' = $1
         AND ds.capsule_data->>'property_class' = $2
         AND ma.actual_walkins IS NOT NULL`,
      [submarket_id, property_class]
    );

    const { sample_size, avg_error } = aggResult.rows[0];
    const new_accuracy = 100 - Math.abs(avg_error || 0);

    // Update calibration factors
    await pool.query(
      `INSERT INTO traffic_calibration_factors (
        submarket_id, property_class, road_category,
        accuracy_after, sample_size, last_calibration, calibrated_by
      ) VALUES ($1, $2, $3, $4, $5, NOW(), 'auto-calibration')
      ON CONFLICT (submarket_id, property_class, road_category) DO UPDATE SET
        accuracy_after = EXCLUDED.accuracy_after,
        sample_size = EXCLUDED.sample_size,
        last_calibration = NOW(),
        updated_at = NOW()`,
      [submarket_id, property_class, road_category, new_accuracy, sample_size]
    );

    console.log(`  [M07 Traffic] Calibrated for ${submarket_id} ${property_class} - Accuracy: ${new_accuracy.toFixed(1)}%`);
  }

  /**
   * Consumer 2: M09 ProForma Benchmarks
   * Writes to proforma_benchmarks
   */
  private async calibrateProForma(actuals: MonthlyActuals, context: any): Promise<void> {
    if (!actuals.actual_noi || !actuals.actual_avg_rent) {
      return;
    }

    const submarket_id = context.submarket_id || 'unknown';
    const property_class = context.property_class || 'B';
    const vintage = parseInt(context.vintage) || 2000;
    const vintage_decade = Math.floor(vintage / 10) * 10;
    const strategy = context.strategy || 'UNKNOWN';

    // Aggregate all actuals for this segment
    const aggResult = await pool.query(
      `SELECT 
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY actual_avg_rent) as rent_p25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY actual_avg_rent) as rent_p50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY actual_avg_rent) as rent_p75,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY actual_noi / NULLIF(actual_revenue, 0)) as noi_margin_p25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY actual_noi / NULLIF(actual_revenue, 0)) as noi_margin_p50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY actual_noi / NULLIF(actual_revenue, 0)) as noi_margin_p75,
        COUNT(*) as sample_size,
        ARRAY_AGG(DISTINCT ma.deal_id) as deals
       FROM deal_monthly_actuals ma
       JOIN deal_snapshots ds ON ma.snapshot_id = ds.id
       WHERE ds.capsule_data->>'submarket_id' = $1
         AND ds.capsule_data->>'property_class' = $2
         AND (CAST(ds.capsule_data->>'vintage' AS INT) / 10 * 10) = $3
         AND ds.strategy = $4
         AND ma.actual_noi IS NOT NULL`,
      [submarket_id, property_class, vintage_decade, strategy]
    );

    const agg = aggResult.rows[0];

    if (agg.sample_size > 0) {
      await pool.query(
        `INSERT INTO proforma_benchmarks (
          submarket_id, property_class, vintage_decade, strategy,
          noi_margin_p25, noi_margin_p50, noi_margin_p75,
          sample_size, deals_contributing, last_updated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (submarket_id, property_class, vintage_decade, strategy) DO UPDATE SET
          noi_margin_p25 = EXCLUDED.noi_margin_p25,
          noi_margin_p50 = EXCLUDED.noi_margin_p50,
          noi_margin_p75 = EXCLUDED.noi_margin_p75,
          sample_size = EXCLUDED.sample_size,
          deals_contributing = EXCLUDED.deals_contributing,
          last_updated = NOW(),
          updated_at = NOW()`,
        [
          submarket_id,
          property_class,
          vintage_decade,
          strategy,
          agg.noi_margin_p25,
          agg.noi_margin_p50,
          agg.noi_margin_p75,
          agg.sample_size,
          agg.deals,
        ]
      );

      console.log(`  [M09 ProForma] Benchmarks updated for ${submarket_id} ${strategy} (n=${agg.sample_size})`);
    }
  }

  /**
   * Consumer 3: JEDI Score Weight Overrides
   * Writes to score_weight_overrides
   */
  private async calibrateJEDI(actuals: MonthlyActuals, context: any): Promise<void> {
    // JEDI calibration requires exit data (actual IRR vs predicted)
    // Skip for now unless deal is at exit stage
    console.log(`  [JEDI] Skipped (requires exit data)`);
  }

  /**
   * Consumer 4: M08 Strategy Arbitrage Outcome Log
   * Writes to strategy_outcome_log
   */
  private async logStrategyOutcome(actuals: MonthlyActuals, context: any): Promise<void> {
    // Strategy outcome logging happens at deal exit
    // Skip during monthly actuals
    console.log(`  [M08 Strategy] Skipped (logged at exit)`);
  }

  /**
   * Consumer 5: M27 Internal Comp Set
   * Writes to internal_comp_set
   */
  private async indexInternalComp(actuals: MonthlyActuals, context: any): Promise<void> {
    // Check if already indexed
    const existing = await pool.query(
      `SELECT id FROM internal_comp_set WHERE deal_id = $1`,
      [actuals.deal_id]
    );

    if (existing.rows.length > 0) {
      return; // Already indexed
    }

    // Index this deal as an internal comp
    await pool.query(
      `INSERT INTO internal_comp_set (
        deal_id, snapshot_id,
        address, lat, lng, units, vintage, property_class,
        purchase_price, price_per_unit, going_in_cap, sale_date,
        actual_rent_at_sale, actual_noi_at_sale,
        submarket_id, searchable
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, TRUE)
      ON CONFLICT (deal_id) DO NOTHING`,
      [
        actuals.deal_id,
        context.id,
        context.address,
        context.lat,
        context.lng,
        context.units,
        context.vintage,
        context.property_class,
        context.purchase_price,
        context.price_per_unit,
        context.going_in_cap,
        context.snapshot_date,
        actuals.actual_avg_rent,
        actuals.actual_noi,
        context.submarket_id,
      ]
    );

    console.log(`  [M27 Comps] Indexed deal ${actuals.deal_id} as internal comp`);
  }

  /**
   * Consumer 6: M26 Tax Formula Confidence
   * Writes to tax_formula_confidence
   */
  private async calibrateTaxFormula(actuals: MonthlyActuals, context: any): Promise<void> {
    // Tax calibration requires actual tax bill vs predicted
    // This data would come from a separate tax actuals table
    console.log(`  [M26 Tax] Skipped (requires tax bill data)`);
  }
}

export const calibrationService = new CalibrationService();
