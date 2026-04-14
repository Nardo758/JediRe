/**
 * M07: Catalog Metrics Wiring
 *
 * Wires Layer A (leading) and Layer C (supply-side damper) catalog metrics
 * into the T-07 trajectory calculation.
 *
 * Weights are loaded from the `traffic_weight_config` table (not hard-coded)
 * so the future admin panel can retrain them.
 *
 * Formula (spec §3.3):
 *   adjusted_prediction = base_prediction
 *     × Π(supply_dampers)         ← Layer C, multiplicative post-base
 *     + Σ(leading_boosts × base)  ← Layer A, additive as % of base
 */

import type { Pool } from 'pg';
import type { CatalogMetricWeight, CatalogMetricValues } from '../types/traffic-calibration.types';
import { logger } from '../utils/logger';

export interface CatalogAdjustmentResult {
  original_prediction: number;
  adjusted_prediction: number;
  layer_a_boost_pct: number;
  layer_c_damper_multiplier: number;
  applied_metrics: string[];
  weights_used: CatalogMetricWeight[];
}

export class CatalogMetricsWiringService {

  private weightsCache: CatalogMetricWeight[] | null = null;
  private weightsCacheAt: Date | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;  // 5 minutes

  constructor(private readonly pool: Pool) {}

  /**
   * Apply catalog metric adjustments to a base traffic prediction.
   *
   * @param basePrediction - The base weekly walk-ins before catalog adjustment
   * @param metrics - Current values of catalog metrics for this deal/submarket
   */
  async applyAdjustments(
    basePrediction: number,
    metrics: CatalogMetricValues,
  ): Promise<CatalogAdjustmentResult> {
    const weights = await this.getWeights();
    const applied: string[] = [];

    let layerABoostPct = 0;
    let layerCDamper = 1.0;

    for (const w of weights) {
      if (!w.is_active) continue;

      const metricValue = (metrics as any)[w.metric_name];
      if (metricValue === undefined || metricValue === null) continue;

      if (w.metric_layer === 'A') {
        // Leading indicators: additive boost as % of base
        // metric_value is normalized: 0 = no effect, positive = boost, negative = drag
        const boost = metricValue * w.weight;
        layerABoostPct += boost;
        applied.push(`${w.metric_name}(A: ${boost > 0 ? '+' : ''}${(boost * 100).toFixed(1)}%)`);
      } else if (w.metric_layer === 'C') {
        // Supply-side dampers: multiplicative post-base
        // metric_value > 0 means more supply = damper < 1
        // weight is negative for dampers (e.g., -0.12 for pipeline_pct)
        const damper = 1.0 + (metricValue * w.weight);
        layerCDamper *= Math.max(0.5, Math.min(1.2, damper));  // clamp between 0.5x–1.2x
        applied.push(`${w.metric_name}(C: ×${damper.toFixed(3)})`);
      }
    }

    // Apply Layer A boost (additive, as % of base)
    const afterLayerA = basePrediction * (1 + layerABoostPct);

    // Apply Layer C dampers (multiplicative)
    const adjusted = Math.max(0, Math.round(afterLayerA * layerCDamper));

    logger.debug('[CatalogMetrics] Adjustment applied', {
      basePrediction,
      layerABoostPct: (layerABoostPct * 100).toFixed(2) + '%',
      layerCDamper: layerCDamper.toFixed(3),
      adjusted,
    });

    return {
      original_prediction: basePrediction,
      adjusted_prediction: adjusted,
      layer_a_boost_pct: Math.round(layerABoostPct * 10000) / 100,
      layer_c_damper_multiplier: Math.round(layerCDamper * 1000) / 1000,
      applied_metrics: applied,
      weights_used: weights.filter(w => w.is_active),
    };
  }

  /**
   * Load catalog metric weights from the DB (with 5-minute cache).
   */
  async getWeights(): Promise<CatalogMetricWeight[]> {
    if (this.weightsCache && this.weightsCacheAt) {
      const age = Date.now() - this.weightsCacheAt.getTime();
      if (age < this.CACHE_TTL_MS) return this.weightsCache;
    }

    try {
      const result = await this.pool.query<any>(`
        SELECT metric_name, metric_layer, weight, is_active
        FROM traffic_weight_config
        ORDER BY metric_layer, metric_name
      `);

      this.weightsCache = result.rows.map(r => ({
        metric_name: r.metric_name,
        metric_layer: r.metric_layer as 'A' | 'B' | 'C',
        weight: parseFloat(r.weight),
        is_active: r.is_active,
      }));
      this.weightsCacheAt = new Date();

      return this.weightsCache;
    } catch (err: unknown) {
      logger.warn('[CatalogMetrics] Failed to load weights from DB, using defaults', { error: err instanceof Error ? err.message : String(err) });
      return this.defaultWeights();
    }
  }

  /**
   * Invalidate the weights cache (called after admin panel updates weights).
   */
  invalidateCache(): void {
    this.weightsCache = null;
    this.weightsCacheAt = null;
  }

  /**
   * Load submarket-level catalog metrics from the DB demand signals tables.
   * Returns a CatalogMetricValues object for use in applyAdjustments().
   */
  async loadSubmarketMetrics(submarketId: string): Promise<CatalogMetricValues> {
    const metrics: CatalogMetricValues = {};

    try {
      // Load demand signals (Layer A: Search Momentum, Business Formation)
      const demandResult = await this.pool.query<any>(`
        SELECT signal_type, signal_value, signal_date
        FROM demand_signals
        WHERE submarket_id = $1
          AND signal_date >= CURRENT_DATE - INTERVAL '90 days'
        ORDER BY signal_date DESC
      `, [submarketId]);

      for (const row of demandResult.rows) {
        switch (row.signal_type) {
          case 'search_momentum':
          case 'search_momentum_qoq':
            if (metrics.search_momentum_qoq === undefined)
              metrics.search_momentum_qoq = parseFloat(row.signal_value) / 100;  // normalize to decimal
            break;
          case 'business_formation':
          case 'business_formation_velocity':
            if (metrics.business_formation_velocity === undefined)
              metrics.business_formation_velocity = parseFloat(row.signal_value) / 100;
            break;
          case 'wage_growth':
          case 'wage_growth_yoy':
            if (metrics.wage_growth_yoy === undefined)
              metrics.wage_growth_yoy = parseFloat(row.signal_value) / 100;
            break;
        }
      }

      // Load supply signals (Layer C)
      const supplyResult = await this.pool.query<any>(`
        SELECT signal_type, signal_value
        FROM supply_signals
        WHERE submarket_id = $1
          AND signal_date >= CURRENT_DATE - INTERVAL '90 days'
        ORDER BY signal_date DESC
      `, [submarketId]);

      for (const row of supplyResult.rows) {
        switch (row.signal_type) {
          case 'pipeline_pct':
            if (metrics.pipeline_pct === undefined)
              metrics.pipeline_pct = parseFloat(row.signal_value) / 100;
            break;
          case 'concession_intensity':
            if (metrics.concession_intensity === undefined)
              metrics.concession_intensity = parseFloat(row.signal_value);
            break;
          case 'months_of_supply':
            if (metrics.months_of_supply === undefined)
              metrics.months_of_supply = parseFloat(row.signal_value);
            break;
        }
      }
    } catch (err: unknown) {
      logger.debug('[CatalogMetrics] Could not load submarket metrics', { submarketId, error: err instanceof Error ? err.message : String(err) });
    }

    return metrics;
  }

  // ============================================================================
  // Fallback defaults
  // ============================================================================

  private defaultWeights(): CatalogMetricWeight[] {
    return [
      { metric_name: 'search_momentum_qoq',        metric_layer: 'A', weight: 0.15,  is_active: true },
      { metric_name: 'business_formation_velocity', metric_layer: 'A', weight: 0.10,  is_active: true },
      { metric_name: 'wage_growth_yoy',             metric_layer: 'A', weight: 0.10,  is_active: true },
      { metric_name: 'pipeline_pct',                metric_layer: 'C', weight: -0.12, is_active: true },
      { metric_name: 'concession_intensity',        metric_layer: 'C', weight: -0.08, is_active: true },
      { metric_name: 'months_of_supply',            metric_layer: 'C', weight: -0.10, is_active: true },
    ];
  }
}
