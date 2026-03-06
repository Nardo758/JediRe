/**
 * M22 Benchmark Query Service
 * PATTERN 3: Benchmark Query (Read Side)
 * 
 * Queries pre-computed benchmark_aggregations table.
 * New deals query this, NOT the raw archive.
 * Nightly job computes these from archived deals.
 */

import { getPool } from '../database/connection';

const pool = getPool();

export interface BenchmarkQuery {
  property_class: string;
  vintage_decade: number;
  submarket_id: string;
  strategy: string;
  hold_period_band?: string;
}

export interface BenchmarkEnvelope {
  // Filters used
  property_class: string;
  vintage_decade: number;
  submarket_id: string;
  strategy: string;
  hold_period_band: string;

  // Rent Growth
  rent_growth_p25: number | null;
  rent_growth_p50: number | null;
  rent_growth_p75: number | null;

  // Exit Cap
  exit_cap_p25: number | null;
  exit_cap_p50: number | null;
  exit_cap_p75: number | null;

  // Vacancy
  vacancy_p25: number | null;
  vacancy_p50: number | null;
  vacancy_p75: number | null;

  // Value-Add Premium ($/unit)
  value_add_premium_p25: number | null;
  value_add_premium_p50: number | null;
  value_add_premium_p75: number | null;

  // IRR / EM
  irr_p25: number | null;
  irr_p50: number | null;
  irr_p75: number | null;

  em_p25: number | null;
  em_p50: number | null;
  em_p75: number | null;

  // Sample Metadata
  sample_size: number;
  deals_in_sample: string[];
  computed_at: string;
}

export class BenchmarkQueryService {
  /**
   * Query benchmark envelope for new deal underwriting
   * This is what the ProForma queries to show "comparable assumptions" gray bands
   */
  async queryBenchmark(query: BenchmarkQuery): Promise<BenchmarkEnvelope | null> {
    const hold_period_band = query.hold_period_band || this.getHoldPeriodBand(5); // Default 5 years

    const result = await pool.query(
      `SELECT * FROM benchmark_aggregations
       WHERE property_class = $1
         AND vintage_decade = $2
         AND submarket_id = $3
         AND strategy = $4
         AND hold_period_band = $5
       ORDER BY computed_at DESC
       LIMIT 1`,
      [query.property_class, query.vintage_decade, query.submarket_id, query.strategy, hold_period_band]
    );

    return result.rows[0] || null;
  }

  /**
   * Query with fallback (expand search if no exact match)
   * E.g., if no Class B data, try B+/B- or nearby vintages
   */
  async queryBenchmarkWithFallback(query: BenchmarkQuery): Promise<BenchmarkEnvelope | null> {
    // Try exact match first
    let result = await this.queryBenchmark(query);
    if (result) return result;

    // Fallback 1: Try any hold period
    result = await pool.query(
      `SELECT * FROM benchmark_aggregations
       WHERE property_class = $1
         AND vintage_decade = $2
         AND submarket_id = $3
         AND strategy = $4
       ORDER BY computed_at DESC
       LIMIT 1`,
      [query.property_class, query.vintage_decade, query.submarket_id, query.strategy]
    ).then((r) => r.rows[0]);
    if (result) return result;

    // Fallback 2: Try broader submarket (e.g., metro instead of submarket)
    // Would need submarket hierarchy data

    // Fallback 3: Try any class in same submarket
    result = await pool.query(
      `SELECT * FROM benchmark_aggregations
       WHERE vintage_decade = $1
         AND submarket_id = $2
         AND strategy = $3
       ORDER BY computed_at DESC
       LIMIT 1`,
      [query.vintage_decade, query.submarket_id, query.strategy]
    ).then((r) => r.rows[0]);
    if (result) return result;

    return null;
  }

  /**
   * Get hold period band (3-5yr, 5-7yr, 7-10yr)
   */
  private getHoldPeriodBand(holdYears: number): string {
    if (holdYears <= 5) return '3-5yr';
    if (holdYears <= 7) return '5-7yr';
    return '7-10yr';
  }

  /**
   * Nightly job: Compute benchmark aggregations from archived deals
   * This is the job that writes to benchmark_aggregations table
   */
  async computeBenchmarks(): Promise<{ computed: number; skipped: number }> {
    console.log('[Benchmark] Starting nightly aggregation job');

    // Get all unique segments
    const segments = await pool.query(`
      SELECT DISTINCT
        capsule_data->>'property_class' as property_class,
        (CAST(capsule_data->>'vintage' AS INT) / 10 * 10) as vintage_decade,
        market_id as submarket_id,
        strategy,
        CASE
          WHEN hold_period_years <= 5 THEN '3-5yr'
          WHEN hold_period_years <= 7 THEN '5-7yr'
          ELSE '7-10yr'
        END as hold_period_band
      FROM deal_snapshots
      WHERE trigger_event = 'closed'
        AND capsule_data->>'property_class' IS NOT NULL
        AND capsule_data->>'vintage' IS NOT NULL
    `);

    let computed = 0;
    let skipped = 0;

    for (const seg of segments.rows) {
      try {
        await this.computeSegmentBenchmark(seg);
        computed++;
      } catch (error) {
        console.error(`[Benchmark] Failed to compute segment:`, seg, error);
        skipped++;
      }
    }

    console.log(`[Benchmark] Complete: ${computed} computed, ${skipped} skipped`);
    return { computed, skipped };
  }

  /**
   * Compute benchmark for a single segment
   */
  private async computeSegmentBenchmark(segment: any): Promise<void> {
    const { property_class, vintage_decade, submarket_id, strategy, hold_period_band } = segment;

    // Extract hold period min/max from band
    const [min, max] = this.parseHoldPeriodBand(hold_period_band);

    // Aggregate actuals from all deals in this segment
    const aggResult = await pool.query(
      `SELECT 
        -- Rent Growth (would need historical rent data to compute)
        -- Exit Cap (from exit snapshots)
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ds.exit_cap_assumed) as exit_cap_p25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ds.exit_cap_assumed) as exit_cap_p50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ds.exit_cap_assumed) as exit_cap_p75,
        
        -- Vacancy (from actuals)
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY 100 - ma.actual_occupancy) as vacancy_p25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY 100 - ma.actual_occupancy) as vacancy_p50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY 100 - ma.actual_occupancy) as vacancy_p75,
        
        -- IRR / EM (from exit snapshots)
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ds.underwritten_irr) as irr_p25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ds.underwritten_irr) as irr_p50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ds.underwritten_irr) as irr_p75,
        
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ds.underwritten_em) as em_p25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ds.underwritten_em) as em_p50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ds.underwritten_em) as em_p75,
        
        COUNT(DISTINCT ds.deal_id) as sample_size,
        ARRAY_AGG(DISTINCT ds.deal_id) as deals_in_sample
       FROM deal_snapshots ds
       LEFT JOIN deal_monthly_actuals ma ON ds.deal_id = ma.deal_id
       WHERE ds.trigger_event = 'closed'
         AND ds.capsule_data->>'property_class' = $1
         AND (CAST(ds.capsule_data->>'vintage' AS INT) / 10 * 10) = $2
         AND ds.market_id = $3
         AND ds.strategy = $4
         AND ds.hold_period_years BETWEEN $5 AND $6`,
      [property_class, vintage_decade, submarket_id, strategy, min, max]
    );

    const agg = aggResult.rows[0];

    if (agg.sample_size < 3) {
      console.log(`[Benchmark] Skipping segment (n=${agg.sample_size}): ${property_class} ${strategy} ${submarket_id}`);
      return;
    }

    // Write to benchmark_aggregations
    await pool.query(
      `INSERT INTO benchmark_aggregations (
        property_class, vintage_decade, submarket_id, strategy, hold_period_band,
        exit_cap_p25, exit_cap_p50, exit_cap_p75,
        vacancy_p25, vacancy_p50, vacancy_p75,
        irr_p25, irr_p50, irr_p75,
        em_p25, em_p50, em_p75,
        sample_size, deals_in_sample, computed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
      ON CONFLICT (property_class, vintage_decade, submarket_id, strategy, hold_period_band) DO UPDATE SET
        exit_cap_p25 = EXCLUDED.exit_cap_p25,
        exit_cap_p50 = EXCLUDED.exit_cap_p50,
        exit_cap_p75 = EXCLUDED.exit_cap_p75,
        vacancy_p25 = EXCLUDED.vacancy_p25,
        vacancy_p50 = EXCLUDED.vacancy_p50,
        vacancy_p75 = EXCLUDED.vacancy_p75,
        irr_p25 = EXCLUDED.irr_p25,
        irr_p50 = EXCLUDED.irr_p50,
        irr_p75 = EXCLUDED.irr_p75,
        em_p25 = EXCLUDED.em_p25,
        em_p50 = EXCLUDED.em_p50,
        em_p75 = EXCLUDED.em_p75,
        sample_size = EXCLUDED.sample_size,
        deals_in_sample = EXCLUDED.deals_in_sample,
        computed_at = NOW(),
        updated_at = NOW()`,
      [
        property_class,
        vintage_decade,
        submarket_id,
        strategy,
        hold_period_band,
        agg.exit_cap_p25,
        agg.exit_cap_p50,
        agg.exit_cap_p75,
        agg.vacancy_p25,
        agg.vacancy_p50,
        agg.vacancy_p75,
        agg.irr_p25,
        agg.irr_p50,
        agg.irr_p75,
        agg.em_p25,
        agg.em_p50,
        agg.em_p75,
        agg.sample_size,
        agg.deals_in_sample,
      ]
    );

    console.log(`[Benchmark] Computed: ${property_class} ${strategy} ${submarket_id} (n=${agg.sample_size})`);
  }

  /**
   * Parse hold period band to min/max years
   */
  private parseHoldPeriodBand(band: string): [number, number] {
    const map: Record<string, [number, number]> = {
      '3-5yr': [3, 5],
      '5-7yr': [5, 7],
      '7-10yr': [7, 10],
    };
    return map[band] || [3, 10];
  }
}

export const benchmarkQueryService = new BenchmarkQueryService();
