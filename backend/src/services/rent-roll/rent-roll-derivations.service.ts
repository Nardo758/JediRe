/**
 * Rent Roll Derivations Service
 *
 * Reads per-unit snapshot data from rent_roll_units and returns monthly
 * aggregated Loss-to-Lease % and concession rate % series.
 *
 * LTL %         = AVG((market_rent − current_rent) / market_rent × 100)
 *                 for occupied units in each snapshot
 * Concession %  = AVG(concession_amount / market_rent × 100)
 *                 across all units in each snapshot (0 when no concession)
 *
 * Both values are returned as whole-number percentages (e.g. 6.4, not 0.064)
 * so they render directly alongside the occ/ltl/conc chart metrics.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export interface MonthlyDerivedMetrics {
  month: string;                    // YYYY-MM (snapshot date)
  ltl_pct: number | null;           // Loss-to-lease % (positive = below market)
  concessions_pct: number | null;   // Concession rate as % of market rent
  unit_count: number;               // Number of units in the snapshot
}

/**
 * Returns an ASC-sorted monthly series of LTL% and concession% for the given deal.
 * Snapshots are keyed by as_of_date in rent_roll_units.
 * Returns an empty array when no matching rent roll data is found.
 */
export async function getRentRollDerivations(
  dealId: string,
): Promise<MonthlyDerivedMetrics[]> {
  try {
    const result = await query(
      `SELECT
         TO_CHAR(rru.as_of_date, 'YYYY-MM')                        AS month,
         -- LTL: avg % gap between market rent and in-place rent, occupied units only
         AVG(
           CASE
             WHEN rru.market_rent > 0
              AND rru.current_rent IS NOT NULL
              AND rru.current_rent > 0
             THEN (rru.market_rent::numeric - rru.current_rent) / rru.market_rent * 100
             ELSE NULL
           END
         )                                                          AS ltl_pct,
         -- Concession rate: avg concession dollar as % of market rent
         AVG(
           CASE
             WHEN rru.market_rent > 0
             THEN COALESCE(rru.concession_amount, 0)::numeric / rru.market_rent * 100
             ELSE NULL
           END
         )                                                          AS concessions_pct,
         COUNT(*)::int                                              AS unit_count
       FROM rent_roll_units rru
       WHERE rru.deal_id = $1
       GROUP BY rru.as_of_date
       ORDER BY rru.as_of_date ASC`,
      [dealId],
    );

    return result.rows.map((r: any) => ({
      month: r.month as string,
      ltl_pct: r.ltl_pct != null ? Math.round(parseFloat(r.ltl_pct) * 10) / 10 : null,
      concessions_pct: r.concessions_pct != null ? Math.round(parseFloat(r.concessions_pct) * 10) / 10 : null,
      unit_count: r.unit_count as number,
    }));
  } catch (err) {
    logger.error('getRentRollDerivations error:', err);
    return [];
  }
}
