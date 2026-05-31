/**
 * Stabilization Re-check Service
 *
 * Lightweight, LLM-free recomputation of stabilization_year whenever a
 * material input (stabilization_target_pct, hold_period_years, vacancyPct
 * override, or marketRentPerUnit override) changes.
 *
 * Algorithm (sustainment rule):
 *   For each candidate year N = 1..hold_period_years:
 *     - Derive per-year occupancy from (in priority order):
 *         Year 1:   deal_assumptions.year1.vacancy_pct LayeredValue
 *                   (.override → .resolved → .detected)
 *         Year 2+:  per_year_overrides['vacancy_pct:yr{n}'].value  (snake_case key)
 *         Fallback: agent projections from
 *                   deal_data.agent_intelligence.proforma_fields.projections[n].occupancy
 *     - Year N qualifies only if ALL years N..hold_period_years also have
 *       occupancy >= stabilization_target_pct (sustainment rule).
 *   First qualifying year is the new stabilization_year. If none → null.
 *
 * Non-blocking: callers fire-and-forget via the debounced trigger below;
 * this function emits WebSocket events on `deal:{dealId}` when complete.
 */

import { getPool } from '../database/connection';
import { getSocketIo } from './socket-registry';
import { logger } from '../utils/logger';

export interface RecheckResult {
  dealId: string;
  previousStabilizationYear: number | null;
  newStabilizationYear: number | null;
  changed: boolean;
}

/** Per-deal debounce timers (trailing-edge, 400 ms). */
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 400;

/** Shape of a per_year_overrides entry for Section 1/3 fields. */
interface PyoEntry {
  value: number | null;
  [key: string]: unknown;
}

/** Minimal LayeredValue shape for vacancy_pct in the year1 seed. */
interface VacancyLv {
  override?: number | null;
  resolved?: number | null;
  detected?: number | null;
}

/**
 * Recompute stabilization_year for a deal using the existing projections and
 * per-year vacancy overrides — no LLM involved.
 *
 * Emits:
 *   `stabilization_year_recalculating`  — immediately before computation starts
 *   `stabilization_year_updated`        — after write (or on error), with result
 *
 * Returns the result (useful for tests or synchronous callers).
 */
export async function recomputeStabilizationYear(dealId: string): Promise<RecheckResult | null> {
  const pool = getPool();
  const io = getSocketIo();
  const dealRoom = `deal:${dealId}`;

  io?.to(dealRoom).emit('stabilization_year_recalculating', { dealId });

  try {
    const row = await pool.query<{
      stabilization_target_pct: string | null;
      hold_period_years: string | null;
      stabilization_year: string | null;
      per_year_overrides: Record<string, PyoEntry | null> | null;
      year1: Record<string, unknown> | null;
    }>(
      `SELECT stabilization_target_pct, hold_period_years,
              stabilization_year, per_year_overrides, year1
         FROM deal_assumptions
        WHERE deal_id = $1
        LIMIT 1`,
      [dealId],
    );

    if (row.rows.length === 0) {
      io?.to(dealRoom).emit('stabilization_year_updated', {
        dealId,
        stabilizationYear: null,
        changed: false,
      });
      return null;
    }

    const da = row.rows[0];
    const targetPct: number | null = da.stabilization_target_pct != null
      ? parseFloat(da.stabilization_target_pct) : null;
    const holdYears: number = da.hold_period_years != null
      ? parseInt(da.hold_period_years, 10) : 10;
    const prevStabYear: number | null = da.stabilization_year != null
      ? parseInt(da.stabilization_year, 10) : null;
    const pyOvs = (da.per_year_overrides ?? {}) as Record<string, PyoEntry | null>;
    const year1Seed = (da.year1 ?? {}) as Record<string, unknown>;

    if (targetPct == null) {
      io?.to(dealRoom).emit('stabilization_year_updated', {
        dealId,
        stabilizationYear: prevStabYear,
        changed: false,
      });
      return { dealId, previousStabilizationYear: prevStabYear, newStabilizationYear: prevStabYear, changed: false };
    }

    const dealRow = await pool.query<{
      agent_projections: Array<{ year: number; occupancy: number | null }> | null;
    }>(
      `SELECT (deal_data->'agent_intelligence'->'proforma_fields'->'projections') AS agent_projections
         FROM deals
        WHERE id = $1
        LIMIT 1`,
      [dealId],
    );

    const agentProjections: Array<{ year: number; occupancy: number | null }> =
      (dealRow.rows[0]?.agent_projections as any) ?? [];

    const agentOccByYear: Record<number, number | null> = {};
    for (const proj of agentProjections) {
      if (proj && typeof proj.year === 'number') {
        agentOccByYear[proj.year] = proj.occupancy ?? null;
      }
    }

    /**
     * Resolve occupancy for a single year (1-based).
     *
     * Priority:
     *   Year 1 : year1 LayeredValue override → resolved → detected → agent fallback
     *   Year 2+: per_year_overrides['vacancy_pct:yr{n}'] (snake_case key) → agent fallback
     *
     * Returns null when no data is available for that year.
     */
    function occupancyForYear(yr: number): number | null {
      if (yr === 1) {
        // Year-1 vacancy lives in the year1 LayeredValue seed (not per_year_overrides)
        const vacLv = year1Seed['vacancy_pct'] as VacancyLv | null | undefined;
        if (vacLv != null) {
          const vacPct = vacLv.override ?? vacLv.resolved ?? vacLv.detected;
          if (vacPct != null && typeof vacPct === 'number') {
            return 1 - vacPct;
          }
        }
      } else {
        // Per-year overrides use snake_case keys: "vacancy_pct:yr{n}"
        const pyKey = `vacancy_pct:yr${yr}`;
        const entry = pyOvs[pyKey];
        if (entry != null && typeof entry.value === 'number') {
          return 1 - entry.value;
        }
      }

      // Fallback: agent projection occupancy (already expressed as occupancy fraction 0-1)
      const agentOcc = agentOccByYear[yr];
      if (agentOcc != null) return agentOcc;

      return null;
    }

    /**
     * Sustainment rule: year N is the stabilization year only if occupancy
     * for every year in [N, holdYears] is >= targetPct.  A year with null
     * occupancy data is treated as NOT meeting threshold.
     */
    let newStabYear: number | null = null;

    outer: for (let yr = 1; yr <= holdYears; yr++) {
      for (let checkYr = yr; checkYr <= holdYears; checkYr++) {
        const occ = occupancyForYear(checkYr);
        if (occ == null || occ < targetPct) {
          continue outer;
        }
      }
      newStabYear = yr;
      break;
    }

    const changed = newStabYear !== prevStabYear;

    if (changed) {
      await pool.query(
        `INSERT INTO deal_assumptions (deal_id, stabilization_year, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (deal_id) DO UPDATE
           SET stabilization_year = $2,
               updated_at         = NOW()`,
        [dealId, newStabYear],
      );
      logger.info(
        `[StabRecheck] deal=${dealId} stabilization_year ${prevStabYear ?? 'null'} → ${newStabYear ?? 'null'}`,
      );
    }

    io?.to(dealRoom).emit('stabilization_year_updated', {
      dealId,
      stabilizationYear: newStabYear,
      previousStabilizationYear: prevStabYear,
      changed,
    });

    return { dealId, previousStabilizationYear: prevStabYear, newStabilizationYear: newStabYear, changed };

  } catch (err: any) {
    logger.warn(`[StabRecheck] non-fatal error for deal=${dealId}: ${err.message}`);
    // Always emit the terminal event so the frontend clears the recalculating state
    io?.to(dealRoom).emit('stabilization_year_updated', {
      dealId,
      stabilizationYear: null,
      changed: false,
      error: true,
    });
    return null;
  }
}

/**
 * Debounced fire-and-forget trigger.  Multiple calls within DEBOUNCE_MS for
 * the same dealId collapse into one trailing-edge execution — rapid edits
 * (e.g. typing in a field) will not launch redundant recomputes.
 */
export function triggerStabilizationRecheck(dealId: string): void {
  const existing = pendingTimers.get(dealId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingTimers.delete(dealId);
    recomputeStabilizationYear(dealId).catch(() => {});
  }, DEBOUNCE_MS);

  pendingTimers.set(dealId, timer);
}
