/**
 * M07 Subject History — S1 Aggregator
 *
 * Computes current-state metrics from a single rent roll snapshot's parsed_payload
 * and upserts a subject_traffic_history record at tier S1.
 *
 * Called immediately after parseAndStore() for every rent roll upload.
 * Promotes the tier to S2 once the Diff Extractor has run (done separately in
 * RentRollDiffService).
 */

import type { Pool } from 'pg';
import type {
  SubjectCurrentState,
  SubjectWeightEntry,
} from '../../types/traffic-calibration.types';
import { SUBJECT_N_REQUIRED } from '../../types/traffic-calibration.types';
import { logger } from '../../utils/logger';

interface ParsedUnit {
  unit_id: string | null;
  unit_type: string | null;
  unit_sf: number | null;
  contract_rent: number | null;
  market_rent: number | null;
  concession_value: number | null;
  concession_months: number | null;
  lease_start: string | null;
  lease_end: string | null;
  move_in_date: string | null;
  move_out_date: string | null;
  notice_date: string | null;
  unit_status: 'occupied' | 'vacant' | 'notice' | 'model' | 'down' | null;
  is_renewal: boolean | null;
  days_vacant: number | null;
  row_confidence: number;
}

export class SubjectHistoryS1Service {

  constructor(private readonly pool: Pool) {}

  /**
   * Compute S1 current-state metrics from parsed_payload and upsert
   * subject_traffic_history.  Safe to call multiple times — idempotent via
   * ON CONFLICT DO UPDATE.
   *
   * @param snapshotId  The newly inserted rent_roll_snapshots.id
   * @param dealId      The deal that owns the snapshot
   */
  async aggregateS1(snapshotId: number, dealId: string): Promise<void> {
    logger.info('[SubjectHistoryS1] Starting S1 aggregation', { snapshotId, dealId });

    try {
      // Load parsed_payload and derived_metrics from the snapshot
      const snapRow = await this.pool.query<{
        parsed_payload: ParsedUnit[] | null;
        derived_metrics: any;
        snapshot_date: string;
      }>(
        `SELECT parsed_payload, derived_metrics, snapshot_date
         FROM rent_roll_snapshots
         WHERE id = $1`,
        [snapshotId],
      );

      if (snapRow.rows.length === 0) {
        logger.warn('[SubjectHistoryS1] Snapshot not found', { snapshotId });
        return;
      }

      const snap = snapRow.rows[0];
      const units: ParsedUnit[] = snap.parsed_payload ?? [];

      if (units.length === 0) {
        logger.warn('[SubjectHistoryS1] parsed_payload is empty — skipping S1', { snapshotId });
        return;
      }

      // ── Compute S1 current_state ──────────────────────────────────────────

      const occupied = units.filter(u => u.unit_status === 'occupied');
      const vacant   = units.filter(u => u.unit_status === 'vacant');
      const notice   = units.filter(u => u.unit_status === 'notice');

      const unitCount     = units.length;
      const occupiedCount = occupied.length;
      const vacantCount   = vacant.length;
      const noticeCount   = notice.length;

      const occupancyRate = unitCount > 0 ? occupiedCount / unitCount : 0;

      // Weighted average contract_rent for occupied units
      const contractRents = occupied.map(u => u.contract_rent).filter((r): r is number => r != null);
      const avgContractRent = contractRents.length > 0
        ? contractRents.reduce((a, b) => a + b, 0) / contractRents.length
        : null;

      // Weighted average market_rent across all units
      const marketRents = units.map(u => u.market_rent).filter((r): r is number => r != null);
      const avgMarketRent = marketRents.length > 0
        ? marketRents.reduce((a, b) => a + b, 0) / marketRents.length
        : null;

      // Loss-to-lease: (avg_market - avg_contract) / avg_market
      const lossToLease = (avgMarketRent != null && avgContractRent != null && avgMarketRent > 0)
        ? (avgMarketRent - avgContractRent) / avgMarketRent
        : null;

      // Avg concession_value for occupied units
      const concValues = occupied.map(u => u.concession_value).filter((c): c is number => c != null);
      const avgConcessionValue = concValues.length > 0
        ? concValues.reduce((a, b) => a + b, 0) / concValues.length
        : null;

      // Signing velocity + expiration waterfall from derived_metrics (computed by derivations service)
      const derived = snap.derived_metrics as any;
      const signingVelocity: number | null = derived?.signing_velocity_24m
        ? (derived.signing_velocity_24m as number[]).reduce((a: number, b: number) => a + b, 0) / 24
        : null;

      const expirationWaterfall: SubjectCurrentState['expiration_waterfall'] =
        Array.isArray(derived?.expiration_waterfall) ? derived.expiration_waterfall : [];

      // ── Lease-term distribution for occupied units ───────────────────────
      // Buckets by total lease duration (months) derived from lease_start/lease_end.
      // month_to_month: ≤1 month; 3_month: ≤3; 6_month: ≤6; 12_month: ≤12;
      // 24_month: ≤24; other: >24 or cannot be derived.
      const leaseTermDist: Record<string, number> = {
        month_to_month: 0, '3_month': 0, '6_month': 0,
        '12_month': 0, '24_month': 0, other: 0,
      };
      const snapDate = new Date(snap.snapshot_date as string);
      for (const u of occupied) {
        if (u.lease_start != null && u.lease_end != null) {
          const start = new Date(u.lease_start);
          const end   = new Date(u.lease_end);
          const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
          if      (months <= 1)  leaseTermDist.month_to_month++;
          else if (months <= 3)  leaseTermDist['3_month']++;
          else if (months <= 6)  leaseTermDist['6_month']++;
          else if (months <= 12) leaseTermDist['12_month']++;
          else if (months <= 24) leaseTermDist['24_month']++;
          else                   leaseTermDist.other++;
        } else {
          leaseTermDist.other++;
        }
      }
      // Suppress snapDate unused-variable warning (used as a reference point for
      // future remaining-term calculations if needed).
      void snapDate;

      const currentState: SubjectCurrentState = {
        occupancy_rate:          occupancyRate,
        unit_count:              unitCount,
        occupied_count:          occupiedCount,
        vacant_count:            vacantCount,
        notice_count:            noticeCount,
        loss_to_lease:           lossToLease,
        avg_concession_value:    avgConcessionValue,
        avg_contract_rent:       avgContractRent,
        avg_market_rent:         avgMarketRent,
        expiration_waterfall:    expirationWaterfall,
        signing_velocity:        signingVelocity,
        lease_term_distribution: leaseTermDist,
      };

      // ── Compute confidence_weights for S1 coefficients ───────────────────
      // S1 can weight: loss_to_lease (needs ≥4 rent observations)
      const confidenceWeights: Record<string, SubjectWeightEntry> = {};

      const ltlN = marketRents.length;
      const ltlRequired = SUBJECT_N_REQUIRED['loss_to_lease'] ?? 4;
      confidenceWeights['loss_to_lease'] = {
        n_obs:      ltlN,
        n_required: ltlRequired,
        weight:     Math.min(1, ltlN / ltlRequired),
      };

      // Signing velocity weight (uses observed 24m histogram depth)
      const svN = derived?.signing_velocity_24m
        ? (derived.signing_velocity_24m as number[]).filter((v: number) => v > 0).length
        : 0;
      const svRequired = SUBJECT_N_REQUIRED['signing_velocity'] ?? 8;
      confidenceWeights['signing_velocity'] = {
        n_obs:      svN,
        n_required: svRequired,
        weight:     Math.min(1, svN / svRequired),
      };

      // ── Count existing snapshots for coverage_months ──────────────────────
      const countRow = await this.pool.query<{ cnt: string; min_date: string; max_date: string }>(
        `SELECT COUNT(*)                  AS cnt,
                MIN(snapshot_date::text)  AS min_date,
                MAX(snapshot_date::text)  AS max_date
         FROM rent_roll_snapshots
         WHERE deal_id = $1 AND status IN ('derived','calibrated','parsed')`,
        [dealId],
      );

      const snapshotCount = parseInt(countRow.rows[0]?.cnt ?? '1', 10);
      const minDate  = countRow.rows[0]?.min_date ? new Date(countRow.rows[0].min_date) : new Date();
      const maxDate  = countRow.rows[0]?.max_date ? new Date(countRow.rows[0].max_date) : new Date();
      const coverageMonths = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

      // ── Load current deal mode for provenance tagging ─────────────────────
      // deal_mode is recorded on the subject_traffic_history row so that
      // ConcessionEnvironmentEngine can enforce mode-mismatch rejection:
      // LEASE_UP-tagged subject coefficients must not influence STABILIZED projections.
      const dealModeRow = await this.pool.query<{ deal_mode: string | null }>(
        `SELECT deal_mode FROM deals WHERE id = $1`,
        [dealId],
      );
      const dealMode: string | null = dealModeRow.rows[0]?.deal_mode ?? null;

      // ── Upsert subject_traffic_history ────────────────────────────────────
      await this.pool.query(`
        INSERT INTO subject_traffic_history
          (deal_id, tier, snapshot_count, coverage_months, current_state,
           confidence_weights, peer_collisions, deal_mode, updated_at)
        VALUES ($1, 'S1', $2, $3, $4, $5, '[]', $6, NOW())
        ON CONFLICT (deal_id) DO UPDATE SET
          tier               = CASE
                                 WHEN subject_traffic_history.tier IN ('S2','S3','S4')
                                 THEN subject_traffic_history.tier   -- never demote
                                 ELSE 'S1'
                               END,
          snapshot_count     = EXCLUDED.snapshot_count,
          coverage_months    = EXCLUDED.coverage_months,
          current_state      = EXCLUDED.current_state,
          confidence_weights = subject_traffic_history.confidence_weights || EXCLUDED.confidence_weights,
          deal_mode          = EXCLUDED.deal_mode,
          updated_at         = NOW()
      `, [
        dealId,
        snapshotCount,
        coverageMonths.toFixed(2),
        JSON.stringify(currentState),
        JSON.stringify(confidenceWeights),
        dealMode,
      ]);

      logger.info('[SubjectHistoryS1] S1 aggregation complete', {
        dealId, snapshotCount, occupancyRate, lossToLease,
      });

    } catch (err: unknown) {
      // Non-fatal — log and continue.  S1 failure must never block the upload response.
      logger.error('[SubjectHistoryS1] S1 aggregation failed', {
        snapshotId, dealId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
