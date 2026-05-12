/**
 * Lifecycle Transition Service
 *
 * Triggered when a deal's status changes to 'owned', 'portfolio', or
 * 'closed'. On such transitions the service:
 *
 *   1. Marks the deal's Data Library files as belonging to a "Portfolio"
 *      context (via data_library_files.deal_id FK — already set from the
 *      Data Library Deal Folder Restructure ticket).
 *
 *   2. Bootstraps an initial historical_observations row at the transition
 *      date using whatever subject state exists in deal_monthly_actuals or
 *      parsed OM / T12 / rent-roll data for the deal.
 *
 * The service is fire-and-forget from the deal-status update route — a
 * failure here must NEVER surface to the operator and must NEVER block the
 * status update response.
 *
 * @see HISTORICAL_OBSERVATIONS_SPEC.md Section 7.8
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

// ─── Lifecycle Event Writer ───────────────────────────────────────────────────

/**
 * Append an entry to deal_lifecycle_events for every status transition.
 * This is the write side of Spec §7.9 Invariant 2 — the corpus reads this
 * table to distinguish pre-decision (broker-supplied) vs post-decision
 * (operator-supplied) corpus months.
 *
 * Fire-and-forget safe: never throws; logs and swallows errors.
 */
export async function recordDealLifecycleEvent(
  dealId: string,
  fromStatus: string | null,
  toStatus: string,
  transitionedBy: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await query(
      `INSERT INTO deal_lifecycle_events
         (deal_id, from_status, to_status, transitioned_by, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        dealId,
        fromStatus ?? null,
        toStatus,
        transitionedBy ?? null,
        metadata ? JSON.stringify(metadata) : null,
      ],
    );
    logger.debug('[LifecycleEvents] Event recorded', { dealId, fromStatus, toStatus });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[LifecycleEvents] Failed to record lifecycle event', {
      dealId,
      fromStatus,
      toStatus,
      error: msg,
    });
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type PortfolioTransitionStatus = 'owned' | 'portfolio' | 'closed' | 'closed_won';

export interface LifecycleTransitionResult {
  bootstrapped: boolean;
  rowId?: string;
  warnings: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface SubjectState {
  parcelId: string;
  propertyId: string;
  unitCount: number | null;
  occupancy: number | null;
  avgRent: number | null;
}

async function getSubjectState(dealId: string): Promise<SubjectState | null> {
  // Look up primary property for the deal
  const propResult = await query(
    `SELECT dp.property_id, COALESCE(p.parcel_id, dp.property_id::text) AS parcel_id
     FROM deal_properties dp
     LEFT JOIN properties p ON p.id = dp.property_id
     WHERE dp.deal_id = $1
     LIMIT 1`,
    [dealId],
  );

  if (!propResult.rows[0]) return null;

  const propertyId = propResult.rows[0].property_id as string;
  const parcelId = propResult.rows[0].parcel_id as string;

  // Try to pull the latest monthly actuals snapshot for this deal
  const actualsResult = await query(
    `SELECT
       COALESCE(total_units, target_units) AS unit_count,
       (occupied_units::numeric / NULLIF(total_units, 0))::numeric AS occupancy,
       avg_effective_rent                  AS avg_rent
     FROM deal_monthly_actuals dma
     LEFT JOIN deals d ON d.id = dma.deal_id
     WHERE dma.deal_id = $1
     ORDER BY dma.report_month DESC
     LIMIT 1`,
    [dealId],
  );

  if (actualsResult.rows[0]) {
    return {
      parcelId,
      propertyId,
      unitCount: actualsResult.rows[0].unit_count != null
        ? Number(actualsResult.rows[0].unit_count)
        : null,
      occupancy: actualsResult.rows[0].occupancy != null
        ? Number(actualsResult.rows[0].occupancy)
        : null,
      avgRent: actualsResult.rows[0].avg_rent != null
        ? Number(actualsResult.rows[0].avg_rent)
        : null,
    };
  }

  // Fall back: pull from the deal_data capsule or deal row itself
  const dealResult = await query(
    `SELECT target_units FROM deals WHERE id = $1`,
    [dealId],
  );

  return {
    parcelId,
    propertyId,
    unitCount: dealResult.rows[0]?.target_units != null
      ? Number(dealResult.rows[0].target_units)
      : null,
    occupancy: null,
    avgRent: null,
  };
}

// ─── Bootstrap corpus row ────────────────────────────────────────────────────

async function bootstrapCorpusRow(
  dealId: string,
  state: SubjectState,
  transitionDate: Date,
): Promise<string | null> {
  const observationDate = new Date(
    Date.UTC(transitionDate.getUTCFullYear(), transitionDate.getUTCMonth(), 1),
  );

  // Check if a row already exists for this parcel × month
  const existing = await query(
    `SELECT id FROM historical_observations
     WHERE parcel_id = $1 AND observation_date = $2::DATE AND geography_level = 'parcel'
     LIMIT 1`,
    [state.parcelId, observationDate],
  );

  if (existing.rows[0]) {
    logger.info('[LifecycleTransition] Corpus row already exists at transition date', {
      dealId,
      rowId: existing.rows[0].id,
      date: observationDate.toISOString().slice(0, 7),
    });
    return existing.rows[0].id as string;
  }

  // INSERT bootstrap row
  const insertResult = await query(
    `INSERT INTO historical_observations (
       parcel_id, observation_date, geography_level, observation_window,
       is_subject_property, source_signals, data_quality_tier,
       property_unit_count, property_occupancy, property_avg_rent,
       capital_event_type, capital_event_metadata
     ) VALUES (
       $1, $2::DATE, 'parcel', 'monthly',
       TRUE, ARRAY['lifecycle_transition'], 'S4',
       $3, $4, $5,
       'status_transition', $6::jsonb
     )
     RETURNING id`,
    [
      state.parcelId,
      observationDate,
      state.unitCount,
      state.occupancy,
      state.avgRent,
      JSON.stringify({ dealId, transitionDate: transitionDate.toISOString() }),
    ],
  );

  return insertResult.rows[0]?.id as string ?? null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Call this when a deal's status transitions to 'owned', 'portfolio',
 * 'closed', or 'closed_won'. Bootstraps the corpus substrate so the
 * deal starts accumulating realized output windows from day one of
 * portfolio hold.
 *
 * Always call fire-and-forget (via setImmediate) — never awaited inline.
 */
export async function onDealStatusTransitionToPortfolio(
  dealId: string,
  newStatus: string,
  userId: string,
): Promise<LifecycleTransitionResult> {
  const warnings: string[] = [];

  const portfolioStatuses: string[] = ['owned', 'portfolio', 'closed', 'closed_won'];
  if (!portfolioStatuses.includes(newStatus)) {
    return { bootstrapped: false, warnings };
  }

  logger.info('[LifecycleTransition] Status → portfolio detected', {
    dealId,
    newStatus,
    userId,
  });

  // Invariant 2 (Spec §7.9): record every status transition so the corpus can
  // distinguish pre-decision from post-decision months.
  await recordDealLifecycleEvent(dealId, null, newStatus, userId, {
    trigger: 'onDealStatusTransitionToPortfolio',
  });

  // Get subject property state
  let state: SubjectState | null = null;
  try {
    state = await getSubjectState(dealId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`getSubjectState failed: ${msg}`);
    logger.warn('[LifecycleTransition] Could not read subject state', { dealId, error: msg });
  }

  if (!state) {
    warnings.push('No property linked to deal — corpus row not bootstrapped');
    return { bootstrapped: false, warnings };
  }

  // Bootstrap corpus row at today's date
  let rowId: string | null = null;
  try {
    rowId = await bootstrapCorpusRow(dealId, state, new Date());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`bootstrapCorpusRow failed: ${msg}`);
    logger.error('[LifecycleTransition] Corpus bootstrap failed', { dealId, error: msg });
  }

  if (rowId) {
    logger.info('[LifecycleTransition] Bootstrap complete', {
      dealId,
      rowId,
      parcelId: state.parcelId,
      newStatus,
    });
    return { bootstrapped: true, rowId, warnings };
  }

  return { bootstrapped: false, warnings };
}
