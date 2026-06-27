import { Pool } from 'pg';
import { ProvenancedValue, provenanced } from '../../types/provenanced-value';

/**
 * Compute the cycle pressure index for a given submarket.
 *
 * The index combines M04 supply-pipeline data with M05/M06 market snapshot
 * signals (vacancy, absorption) into a single [-1, +1] score:
 *   -1.0 = deep oversupply (high pipeline + high vacancy + low absorption)
 *    0.0 = balanced market
 *   +1.0 = tight undersupply (low pipeline + low vacancy + high absorption)
 *
 * Sources:
 *   • apartment_supply_pipeline — units delivering in next 180 days
 *   • apartment_market_snapshots — vacancy, occupancy, absorption_rate
 */
export async function computeCyclePressureIndex(
  pool: Pool,
  city: string | null,
  state: string | null,
  totalUnits: number,
): Promise<ProvenancedValue<number> | null> {
  if (!city || !state) return null;

  try {
    // ── M04 supply pipeline ───────────────────────────────────────────────────
    const pipeRes = await pool.query<{ total_delivering: number }>(
      `SELECT COALESCE(SUM(units_delivering), 0) AS total_delivering
         FROM apartment_supply_pipeline
        WHERE LOWER(city) = LOWER($1) AND UPPER(state) = $2
          AND available_date BETWEEN NOW() AND NOW() + INTERVAL '180 days'`,
      [city, state],
    );
    const pipeSupply = parseInt(String(pipeRes.rows[0]?.total_delivering ?? '0'), 10) || 0;

    // ── M05 market snapshot (latest) ────────────────────────────────────────
    const snapRes = await pool.query<{
      avg_occupancy: number | null;
      absorption_rate: number | null;
      total_units: number | null;
    }>(
      `SELECT avg_occupancy, absorption_rate, total_units
         FROM apartment_market_snapshots
        WHERE LOWER(city) = LOWER($1) AND UPPER(state) = $2
          AND avg_occupancy IS NOT NULL
        ORDER BY snapshot_date DESC
        LIMIT 1`,
      [city, state],
    );
    const snap = snapRes.rows[0];
    if (!snap) return null;

    const occupancy = snap.avg_occupancy != null ? +snap.avg_occupancy / 100 : null;
    const vacancy = occupancy != null ? 1 - occupancy : null;
    const absorption = snap.absorption_rate != null ? +snap.absorption_rate : null;
    const marketBase = snap.total_units && snap.total_units > 0
      ? snap.total_units
      : totalUnits * 10;

    // ── Normalise supply pressure ────────────────────────────────────────────
    // 10% of stock delivering in 6 months = max pressure (1.0)
    const supplyPressure = pipeSupply > 0 && marketBase > 0
      ? Math.min(1, pipeSupply / marketBase / 0.10)
      : 0;

    // ── Normalise demand signal ───────────────────────────────────────────────
    // vacancy < 5% → strong demand (+0.5), vacancy > 10% → weak demand (-0.5)
    let demandSignal = 0;
    if (vacancy != null) {
      demandSignal = 0.5 - Math.min(1, Math.max(0, (vacancy - 0.05) / 0.05)) * 0.5;
      // Flip: low vacancy = high demand
      demandSignal = -demandSignal;
    }
    // Wait, let me redo this more clearly:
    // vacancy = 0.05 → demandSignal = 0
    // vacancy = 0.00 → demandSignal = +0.5
    // vacancy = 0.10 → demandSignal = -0.5
    if (vacancy != null) {
      const clampedVacancy = Math.min(0.15, Math.max(0.00, vacancy));
      demandSignal = (0.05 - clampedVacancy) / 0.05 * 0.5; // [-0.5, +0.5]
    }

    // ── Absorption boost ──────────────────────────────────────────────────────
    // absorption_rate > 0.95 → +0.25 demand boost
    // absorption_rate < 0.85 → -0.25 demand penalty
    let absorptionBoost = 0;
    if (absorption != null) {
      absorptionBoost = Math.min(0.25, Math.max(-0.25, (absorption - 0.90) / 0.10 * 0.25));
    }

    // ── Composite index ─────────────────────────────────────────────────────────
    // supplyPressure pushes negative (more supply = lower index)
    // demandSignal + absorptionBoost push positive (strong demand = higher index)
    const rawIndex = -supplyPressure + demandSignal + absorptionBoost;
    const idx = Math.max(-1, Math.min(1, rawIndex));

    const rationale = (
      `cyclePressure = -supply(${supplyPressure.toFixed(2)}) ` +
      `+ demand(${demandSignal.toFixed(2)}) ` +
      `+ absorption(${absorptionBoost.toFixed(2)}) ` +
      `= ${idx.toFixed(2)} ` +
      `| pipeline=${pipeSupply} units, vacancy=${((vacancy ?? 0) * 100).toFixed(1)}%, ` +
      `absorption=${((absorption ?? 0) * 100).toFixed(1)}%`
    );

    return provenanced(idx, 'platform', 0.65, 'derived', rationale);
  } catch (err: any) {
    return null;
  }
}
