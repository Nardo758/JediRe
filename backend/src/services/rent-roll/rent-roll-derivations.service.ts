/**
 * Rent Roll Derivations Service
 *
 * Reads per-unit snapshot data from rent_roll_units and returns monthly-aggregated
 * Loss-to-Lease % and concessions-per-unit $ series.
 *
 * NOTE: The task spec referenced a derived_metrics JSONB column on rent_roll_units,
 * but that column does not exist in the current schema. The underlying values are
 * instead stored in discrete columns (market_rent, current_rent, loss_to_lease_pct,
 * concession_amount), so this service derives the required metrics from those columns.
 * The returned field names match the specified API contract:
 *   { month, ltl_pct, concessions_per_unit }
 *
 * LTL %               = AVG((market_rent − current_rent) / market_rent × 100)
 *                       for occupied units in each snapshot (current_rent > 0)
 * concessions_per_unit = AVG(concession_amount) across all units — dollar amount
 *
 * Only snapshots with at least one computable metric value are returned.
 * Returns [] (never throws) when no matching rent roll data exists.
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export interface MonthlyDerivedMetrics {
  month: string;                       // YYYY-MM (snapshot as_of_date)
  ltl_pct: number | null;              // Loss-to-lease % (positive = below market)
  concessions_per_unit: number | null; // Average concession dollar amount per unit
  unit_count: number;                  // Units in the snapshot
}

/**
 * Returns an ASC-sorted monthly series of LTL% and concessions$/unit for the given deal.
 * Only snapshots where at least one metric is non-null/non-zero are included.
 * Returns an empty array when no rent roll snapshots exist for the deal.
 *
 * @param dealId - The deal UUID (rent_roll_units are stored by deal_id)
 * @param propertyId - Resolved from the deal record (bridge pattern); reserved for
 *   future use if rent_roll_units gains a property_id column. Currently unused since
 *   the table is deal-scoped only.
 */
export async function getRentRollDerivations(
  dealId: string,
  _propertyId: string | null = null,
): Promise<MonthlyDerivedMetrics[]> {
  try {
    const result = await query(
      `SELECT
         TO_CHAR(rru.as_of_date, 'YYYY-MM')                        AS month,
         -- LTL: % gap between market rent and in-place rent, occupied units only.
         -- Uses stored loss_to_lease_pct if non-null; otherwise derives from market/current rent.
         AVG(
           CASE
             WHEN rru.loss_to_lease_pct IS NOT NULL AND rru.loss_to_lease_pct != 0
               THEN rru.loss_to_lease_pct::numeric
             WHEN rru.market_rent > 0
              AND rru.current_rent IS NOT NULL
              AND rru.current_rent > 0
               THEN (rru.market_rent::numeric - rru.current_rent) / rru.market_rent * 100
             ELSE NULL
           END
         )                                                          AS ltl_pct,
         -- concessions_per_unit: average concession dollar amount per unit in the snapshot
         AVG(COALESCE(rru.concession_amount, 0)::numeric)          AS concessions_per_unit,
         COUNT(*)::int                                              AS unit_count
       FROM rent_roll_units rru
       WHERE rru.deal_id = $1
       GROUP BY rru.as_of_date
       -- Include snapshots where at least one metric (LTL or concessions) is non-trivial.
       -- A snapshot qualifies if it has any unit with an LTL measurement OR any non-zero concession.
       HAVING
         COUNT(*) FILTER (
           WHERE (rru.loss_to_lease_pct IS NOT NULL AND rru.loss_to_lease_pct != 0)
              OR (rru.market_rent > 0 AND rru.current_rent IS NOT NULL AND rru.current_rent > 0)
         ) > 0
         OR SUM(COALESCE(rru.concession_amount, 0)) > 0
       ORDER BY rru.as_of_date ASC`,
      [dealId],
    );

    return result.rows.map((r: any) => ({
      month: r.month as string,
      ltl_pct: r.ltl_pct != null ? Math.round(parseFloat(r.ltl_pct) * 10) / 10 : null,
      concessions_per_unit: r.concessions_per_unit != null
        ? Math.round(parseFloat(r.concessions_per_unit) * 100) / 100
        : null,
      unit_count: r.unit_count as number,
    }));
  } catch (err) {
    logger.error('getRentRollDerivations error:', err);
    return [];
  }
}
