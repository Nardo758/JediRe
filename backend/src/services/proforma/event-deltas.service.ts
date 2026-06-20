import { Pool } from 'pg';
import { ProvenancedValue, provenanced } from '../../types/provenanced-value';

/**
 * Convert market_events into rent-growth event deltas.
 *
 * Each qualifying event is mapped to a growth delta in decimal (e.g. 0.008 = +80bps)
 * based on its type, impact direction, and magnitude. Deltas are additive to the
 * five-component rent growth model (spec §6, component 4).
 *
 * Filtering rules:
 *   • Status IN ('confirmed', 'active', 'completed') — no rumored/cancelled
 *   • effective_date within ±24 months of NOW (future events decay, past events fade)
 *   • geography_id matches city or state (city-level preferred, state-level fallback)
 *
 * Magnitude → delta mapping (default baseline):
 *   minor        → ±30 bps
 *   moderate     → ±80 bps
 *   major        → ±150 bps
 *   transformative → ±250 bps
 *
 * Direction flips sign (positive = rent boost, negative = rent compression).
 * Event-type modifiers adjust the baseline:
 *   employer_move / employer_expansion → ×1.5 (jobs directly drive housing demand)
 *   employer_layoff / employer_closure → ×1.5 (negative)
 *   supply_delivery / supply_announced → ×1.0 (direct rent competition)
 *   grocery_opening / retail_opening   → ×0.4 (amenity uplift, indirect)
 *   transit_opening / transit_expansion  → ×0.6 (accessibility premium)
 *   economic_shock / natural_disaster    → ×2.0 (large but short-lived)
 *   all others                          → ×0.5
 */

const MAGNITUDE_BPS: Record<string, number> = {
  minor: 30,
  moderate: 80,
  major: 150,
  transformative: 250,
};

const TYPE_MULTIPLIER: Record<string, number> = {
  employer_move: 1.5,
  employer_expansion: 1.5,
  employer_layoff: 1.5,
  employer_closure: 1.5,
  supply_delivery: 1.0,
  supply_announced: 1.0,
  supply_groundbreaking: 0.5,
  grocery_opening: 0.4,
  retail_opening: 0.4,
  transit_opening: 0.6,
  transit_expansion: 0.6,
  economic_shock: 2.0,
  natural_disaster: 2.0,
  acquisition: 0.5,
  disposition: 0.5,
  rezoning: 0.5,
  policy_change: 0.5,
  infrastructure: 0.5,
  default: 0.5,
};

/** Time-decay factor: events >12 months away or in the past fade linearly. */
function timeDecayFactor(eventDate: Date): number {
  const now = new Date();
  const monthsDiff = Math.abs(
    (eventDate.getFullYear() - now.getFullYear()) * 12 +
    (eventDate.getMonth() - now.getMonth()),
  );
  if (monthsDiff <= 6) return 1.0;
  if (monthsDiff >= 24) return 0.0;
  return 1.0 - (monthsDiff - 6) / 18;
}

export async function computeEventDeltas(
  pool: Pool,
  city: string | null,
  state: string | null,
): Promise<ProvenancedValue<number>[]> {
  if (!city || !state) return [];

  try {
    const rows = await pool.query<{
      event_type: string;
      expected_impact_direction: string;
      expected_impact_magnitude: string;
      effective_date: string;
      event_name: string;
      jobs_affected: number | null;
      units_affected: number | null;
    }>(
      `SELECT event_type, expected_impact_direction, expected_impact_magnitude,
              effective_date, event_name, jobs_affected, units_affected
         FROM market_events
        WHERE geography_id IN (
                SELECT geography_id FROM market_events
                 WHERE geography_id = LOWER($1)
                UNION
                SELECT geography_id FROM market_events
                 WHERE geography_id = LOWER($2)
              )
          AND status IN ('confirmed', 'active', 'completed')
          AND effective_date BETWEEN NOW() - INTERVAL '24 months' AND NOW() + INTERVAL '24 months'
        ORDER BY effective_date DESC`,
      [city.toLowerCase(), state.toLowerCase()],
    );

    const deltas: ProvenancedValue<number>[] = [];

    for (const row of rows.rows) {
      const magBps = MAGNITUDE_BPS[row.expected_impact_magnitude] ?? 30;
      const multiplier = TYPE_MULTIPLIER[row.event_type] ?? TYPE_MULTIPLIER.default;
      const direction = row.expected_impact_direction === 'positive' ? 1 : -1;
      const baseDelta = (magBps / 10000) * multiplier * direction;
      const decay = timeDecayFactor(new Date(row.effective_date));
      const finalDelta = baseDelta * decay;

      if (Math.abs(finalDelta) < 0.0001) continue; // skip negligible deltas

      const rationale = (
        `${row.event_name} (${row.event_type}) ` +
        `| ${row.expected_impact_direction} ${row.expected_impact_magnitude} ` +
        `| ${(finalDelta * 10000).toFixed(0)}bps ` +
        `| decay=${decay.toFixed(2)} ` +
        `| date=${row.effective_date.slice(0, 10)}`
      );

      deltas.push(
        provenanced(finalDelta, 'platform', 0.60, 'derived', rationale),
      );
    }

    return deltas;
  } catch (_err) {
    return [];
  }
}
