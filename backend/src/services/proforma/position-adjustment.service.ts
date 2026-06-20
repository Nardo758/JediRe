import { Pool } from 'pg';
import { ProvenancedValue, provenanced } from '../../types/provenanced-value';

/**
 * Compute the M15-driven position adjustment for rent growth.
 *
 * The position reflects how the subject property's average in-place rent
 * compares to the comp-set P50 (or EC3 P50) rent. If the property sits
 * above the median, it can grow rents faster (positive delta); if below,
 * it must grow slower to converge (negative delta).
 *
 * Formula:
 *   vsP50Pct = (avgInPlaceRent - compP50) / compP50
 *   position = clamp(vsP50Pct × 0.3, -0.015, +0.015)
 *
 * Sources:
 *   • deal_assumptions.unit_mix → in_place_rent (subject)
 *   • apartment_market_snapshots → avg_rent (comp P50 proxy)
 *   • deal_market_data → comp_rent_p50 (if available)
 */
export async function computePositionAdjustment(
  pool: Pool,
  dealId: string,
  city: string | null,
  state: string | null,
): Promise<ProvenancedValue<number> | null> {
  try {
    // 1. Subject average in-place rent from unit_mix or extraction rent roll
    let subjectAvgRent: number | null = null;
    const unitMixRes = await pool.query<{ unit_mix: unknown }>(
      `SELECT unit_mix FROM deal_assumptions WHERE deal_id = $1`,
      [dealId],
    );
    const unitMix = unitMixRes.rows[0]?.unit_mix;
    if (Array.isArray(unitMix) && unitMix.length > 0) {
      const weighted = unitMix.reduce(
        (acc: { sum: number; count: number }, u: any) => {
          const rent = u?.in_place_rent ?? u?.avg_rent ?? u?.rent ?? 0;
          const count = u?.count ?? u?.units ?? 0;
          return { sum: acc.sum + rent * count, count: acc.count + count };
        },
        { sum: 0, count: 0 },
      );
      if (weighted.count > 0) {
        subjectAvgRent = +(weighted.sum / weighted.count).toFixed(2);
      }
    }

    // Fallback: extraction_rent_roll from deal_data
    if (subjectAvgRent == null) {
      const dealRes = await pool.query<{ deal_data: Record<string, unknown> }>(
        `SELECT deal_data FROM deals WHERE id = $1`,
        [dealId],
      );
      const rr = dealRes.rows[0]?.deal_data?.extraction_rent_roll as Record<string, unknown> | undefined;
      if (rr && typeof rr === 'object') {
        const floorPlans = rr.floor_plan_mix as Record<string, unknown> | undefined;
        if (floorPlans && typeof floorPlans === 'object') {
          const weighted = Object.values(floorPlans).reduce(
            (acc: { sum: number; count: number }, p: any) => {
              const rent = p?.avg_effective_rent ?? p?.avg_rent ?? 0;
              const count = p?.count ?? p?.units ?? 0;
              return { sum: acc.sum + rent * count, count: acc.count + count };
            },
            { sum: 0, count: 0 },
          );
          if (weighted.count > 0) {
            subjectAvgRent = +(weighted.sum / weighted.count).toFixed(2);
          }
        }
      }
    }

    // 2. Comp P50 rent from deal_market_data or apartment_market_snapshots
    let compP50: number | null = null;
    const dmdRes = await pool.query<{ comp_rent_p50: number | null }>(
      `SELECT comp_rent_p50 FROM deal_market_data WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [dealId],
    );
    compP50 = dmdRes.rows[0]?.comp_rent_p50 ?? null;

    if (compP50 == null && city && state) {
      const snapRes = await pool.query<{ avg_rent: number | null }>(
        `SELECT avg_rent FROM apartment_market_snapshots
          WHERE LOWER(city) = LOWER($1) AND UPPER(state) = $2
            AND avg_rent IS NOT NULL
          ORDER BY snapshot_date DESC LIMIT 1`,
        [city, state],
      );
      compP50 = snapRes.rows[0]?.avg_rent ?? null;
    }

    if (subjectAvgRent == null || compP50 == null || compP50 <= 0) {
      return null;
    }

    const vsP50Pct = (subjectAvgRent - compP50) / compP50;
    const position = Math.max(-0.015, Math.min(0.015, vsP50Pct * 0.3));

    const rationale = (
      `position = clamp(${vsP50Pct.toFixed(3)} × 0.3, ±150bps) = ${(position * 10000).toFixed(0)}bps ` +
      `| subject=$${Math.round(subjectAvgRent)} compP50=$${Math.round(compP50)}`
    );

    return provenanced(position, 'platform', 0.65, 'derived', rationale);
  } catch (_err) {
    return null;
  }
}
