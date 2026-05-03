/**
 * M07 Diff Extractor + S2 Aggregator
 *
 * RentRollDiffService processes two consecutive rent roll snapshots for a deal
 * and produces:
 *   1. A rent_roll_diffs row with per-unit event classification + aggregate
 *      leasing dynamics (renewal_rate, turnover_rate, trade-outs, signing
 *      velocity, days_vacant_median, concession_trend, loss_to_lease).
 *   2. A subject_traffic_history promotion from S1 → S2, adding
 *      observed_dynamics and updating confidence_weights for S2 coefficients.
 *
 * Called from m07-calibration.routes.ts after the second upload (and any
 * subsequent upload) for a deal when the period between snapshots is ≥ 60 days.
 */

import type { Pool } from 'pg';
import type {
  SubjectObservedDynamics,
  SubjectWeightEntry,
  SubjectPeerCollision,
} from '../../types/traffic-calibration.types';
import { SUBJECT_N_REQUIRED } from '../../types/traffic-calibration.types';
import { logger } from '../../utils/logger';

// ── Serialised unit shape stored in parsed_payload ──────────────────────────
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

// ── Internal per-unit event classification ───────────────────────────────────
type UnitEventType =
  | 'RENEWAL'
  | 'NEW_LEASE_AFTER_VACANCY'
  | 'TURNOVER'
  | 'VACANCY_PERSISTS'
  | 'STABLE_OCCUPANCY'
  | 'UNRESOLVED';

interface UnitEvent {
  unit_key: string;        // the identity key used to match across snapshots
  event_type: UnitEventType;
  prior_contract_rent: number | null;
  current_contract_rent: number | null;
  trade_out_pct: number | null;    // (current - prior) / prior; null when either is null
  days_vacant_observed: number | null;
  prior_concession: number | null;
  current_concession: number | null;
}

// ── Max per-unit events stored in DB (for drill-down) ───────────────────────
const MAX_PER_UNIT_EVENTS = 10_000;

// ── Minimum period to qualify for S2 ────────────────────────────────────────
export const S2_MIN_PERIOD_DAYS = 60;

export class RentRollDiffService {

  constructor(private readonly pool: Pool) {}

  /**
   * Run the diff extractor between the two most recent snapshots for a deal.
   * Idempotent: updates the existing rent_roll_diffs row on conflict.
   *
   * @param dealId         Deal to process
   * @param toSnapshotId   The newly uploaded snapshot ID
   * @returns              The inserted/updated rent_roll_diffs.id, or null if skipped
   */
  async extractAndStore(dealId: string, toSnapshotId: number): Promise<number | null> {
    logger.info('[RentRollDiff] Starting diff extraction', { dealId, toSnapshotId });

    try {
      // Find the immediately preceding snapshot for this deal
      const prevRow = await this.pool.query<{
        id: number;
        snapshot_date: string;
        parsed_payload: ParsedUnit[] | null;
      }>(`
        SELECT id, snapshot_date::text, parsed_payload
        FROM rent_roll_snapshots
        WHERE deal_id = $1
          AND id != $2
          AND status IN ('derived','calibrated','parsed')
        ORDER BY snapshot_date DESC, id DESC
        LIMIT 1
      `, [dealId, toSnapshotId]);

      if (prevRow.rows.length === 0) {
        logger.debug('[RentRollDiff] No prior snapshot found — skipping diff', { dealId });
        return null;
      }

      const prior = prevRow.rows[0];

      // Load the current snapshot
      const currRow = await this.pool.query<{
        snapshot_date: string;
        parsed_payload: ParsedUnit[] | null;
        derived_metrics: any;
      }>(`
        SELECT snapshot_date::text, parsed_payload, derived_metrics
        FROM rent_roll_snapshots
        WHERE id = $1
      `, [toSnapshotId]);

      if (currRow.rows.length === 0) return null;
      const curr = currRow.rows[0];

      const priorDate   = new Date(prior.snapshot_date);
      const currentDate = new Date(curr.snapshot_date);
      const periodDays  = Math.round(
        (currentDate.getTime() - priorDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (periodDays < S2_MIN_PERIOD_DAYS) {
        logger.info('[RentRollDiff] Period too short for S2 — skipping', {
          dealId, periodDays, required: S2_MIN_PERIOD_DAYS,
        });
        return null;
      }

      const priorUnits: ParsedUnit[]   = prior.parsed_payload ?? [];
      const currentUnits: ParsedUnit[] = curr.parsed_payload  ?? [];

      if (priorUnits.length === 0 || currentUnits.length === 0) {
        logger.warn('[RentRollDiff] parsed_payload missing on one or both snapshots', { dealId });
        return null;
      }

      // ── Unit identity resolution ─────────────────────────────────────────
      // Level 1: exact unit_id match
      // Level 2: (unit_type + unit_sf) fingerprint
      const makeKey1 = (u: ParsedUnit) => u.unit_id ?? '';
      const makeKey2 = (u: ParsedUnit) =>
        `${(u.unit_type ?? '').toLowerCase().trim()}::${u.unit_sf ?? 'NA'}`;

      const priorById   = new Map<string, ParsedUnit[]>();
      const priorByFp   = new Map<string, ParsedUnit[]>();
      for (const u of priorUnits) {
        const k1 = makeKey1(u);
        if (k1) {
          if (!priorById.has(k1)) priorById.set(k1, []);
          priorById.get(k1)!.push(u);
        }
        const k2 = makeKey2(u);
        if (!priorByFp.has(k2)) priorByFp.set(k2, []);
        priorByFp.get(k2)!.push(u);
      }

      const unitEvents: UnitEvent[] = [];

      for (const curr_unit of currentUnits) {
        const key1 = makeKey1(curr_unit);
        const key2 = makeKey2(curr_unit);

        let matched: ParsedUnit | null = null;
        let matchKey: string = '';

        // Level-1: exact unit_id
        if (key1 && priorById.has(key1) && priorById.get(key1)!.length === 1) {
          matched  = priorById.get(key1)![0];
          matchKey = `id:${key1}`;
        } else if (priorByFp.has(key2) && priorByFp.get(key2)!.length === 1) {
          // Level-2: unique fingerprint (one prior unit with same type+sf)
          matched  = priorByFp.get(key2)![0];
          matchKey = `fp:${key2}`;
        }

        if (!matched) {
          unitEvents.push({
            unit_key:            key1 || key2,
            event_type:          'UNRESOLVED',
            prior_contract_rent: null,
            current_contract_rent: curr_unit.contract_rent ?? null,
            trade_out_pct:       null,
            days_vacant_observed: null,
            prior_concession:    null,
            current_concession:  curr_unit.concession_value ?? null,
          });
          continue;
        }

        // ── Classify event ────────────────────────────────────────────────
        const wasOccupied = matched.unit_status === 'occupied';
        const isOccupied  = curr_unit.unit_status === 'occupied';
        const wasVacant   = matched.unit_status === 'vacant' || matched.unit_status === 'notice';
        const isVacant    = curr_unit.unit_status === 'vacant' || curr_unit.unit_status === 'notice';

        let eventType: UnitEventType;

        if (wasOccupied && isOccupied) {
          // Stable occupancy — check is_renewal flag
          eventType = curr_unit.is_renewal ? 'RENEWAL' : 'STABLE_OCCUPANCY';
        } else if (wasVacant && isOccupied) {
          eventType = 'NEW_LEASE_AFTER_VACANCY';
        } else if (wasOccupied && isVacant) {
          eventType = 'TURNOVER';
        } else {
          eventType = 'VACANCY_PERSISTS';
        }

        // Trade-out %
        const priorRent   = matched.contract_rent   ?? null;
        const currentRent = curr_unit.contract_rent ?? null;
        const tradeOutPct = (priorRent != null && currentRent != null && priorRent > 0)
          ? (currentRent - priorRent) / priorRent
          : null;

        unitEvents.push({
          unit_key:             matchKey || key1 || key2,
          event_type:           eventType,
          prior_contract_rent:  priorRent,
          current_contract_rent: currentRent,
          trade_out_pct:        tradeOutPct,
          days_vacant_observed: curr_unit.days_vacant ?? null,
          prior_concession:     matched.contract_rent    ?? null,
          current_concession:   curr_unit.concession_value ?? null,
        });
      }

      // ── Aggregate metrics ─────────────────────────────────────────────────
      const resolved   = unitEvents.filter(e => e.event_type !== 'UNRESOLVED');
      const renewals   = unitEvents.filter(e => e.event_type === 'RENEWAL');
      const turnovers  = unitEvents.filter(e => e.event_type === 'TURNOVER');
      const newLeases  = unitEvents.filter(e => e.event_type === 'NEW_LEASE_AFTER_VACANCY');

      const renewalN  = renewals.length;
      const turnoverN = turnovers.length;
      const totalResolved = resolved.length;

      const renewalRate  = totalResolved > 0 ? renewalN  / totalResolved : null;
      const turnoverRate = totalResolved > 0 ? turnoverN / totalResolved : null;

      // New-lease trade-out
      const newTos = newLeases.map(e => e.trade_out_pct).filter((v): v is number => v != null);
      const newLeaseTradeOutPct = newTos.length > 0
        ? newTos.reduce((a, b) => a + b, 0) / newTos.length
        : null;

      // Renewal trade-out
      const renewTos = renewals.map(e => e.trade_out_pct).filter((v): v is number => v != null);
      const renewalTradeOutPct = renewTos.length > 0
        ? renewTos.reduce((a, b) => a + b, 0) / renewTos.length
        : null;

      const tradeOutN = newTos.length + renewTos.length;

      // Signing velocity = (newLeases + renewals) / (periodDays / 30.44)
      const periodMonths  = periodDays / 30.44;
      const signingVelocity = periodMonths > 0
        ? (renewalN + newLeases.length) / periodMonths
        : null;

      // Days vacant median (from units that went TURNOVER or NEW_LEASE_AFTER_VACANCY)
      const daysVacantObs = [...turnovers, ...newLeases]
        .map(e => e.days_vacant_observed)
        .filter((v): v is number => v != null && v >= 0);
      daysVacantObs.sort((a, b) => a - b);
      const daysVacantMedian = daysVacantObs.length > 0
        ? daysVacantObs[Math.floor(daysVacantObs.length / 2)]
        : null;
      const daysVacantN = daysVacantObs.length;

      // Concession trend across all occupied units
      const priorConc   = unitEvents.filter(e => e.prior_concession   != null).map(e => e.prior_concession!);
      const currentConc = unitEvents.filter(e => e.current_concession != null).map(e => e.current_concession!);
      let concessionTrend: 'increasing' | 'stable' | 'decreasing' | null = null;
      if (priorConc.length > 0 && currentConc.length > 0) {
        const avgPrior   = priorConc.reduce((a, b)   => a + b, 0) / priorConc.length;
        const avgCurrent = currentConc.reduce((a, b) => a + b, 0) / currentConc.length;
        const delta = avgCurrent - avgPrior;
        concessionTrend = Math.abs(delta) < 50 ? 'stable' : delta > 0 ? 'increasing' : 'decreasing';
      }

      // Loss to lease from current snapshot aggregate
      const currMarkets   = currentUnits.map(u => u.market_rent).filter((v): v is number => v != null);
      const currContracts = currentUnits.filter(u => u.unit_status === 'occupied').map(u => u.contract_rent).filter((v): v is number => v != null);
      const avgMarket   = currMarkets.length   > 0 ? currMarkets.reduce((a, b) => a + b, 0)   / currMarkets.length   : null;
      const avgContract = currContracts.length > 0 ? currContracts.reduce((a, b) => a + b, 0) / currContracts.length : null;
      const lossToLease = (avgMarket != null && avgContract != null && avgMarket > 0)
        ? (avgMarket - avgContract) / avgMarket
        : null;

      // ── Insert rent_roll_diffs ────────────────────────────────────────────
      const cappedEvents = unitEvents.slice(0, MAX_PER_UNIT_EVENTS);
      const diffResult = await this.pool.query<{ id: number }>(`
        INSERT INTO rent_roll_diffs
          (deal_id, from_snapshot_id, to_snapshot_id, period_days,
           renewal_rate, turnover_rate, new_lease_trade_out_pct, renewal_trade_out_pct,
           signing_velocity, days_vacant_median, concession_trend, loss_to_lease,
           renewal_n, turnover_n, trade_out_n, days_vacant_n,
           per_unit_events, computed_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
        ON CONFLICT (from_snapshot_id, to_snapshot_id) DO UPDATE SET
          renewal_rate            = EXCLUDED.renewal_rate,
          turnover_rate           = EXCLUDED.turnover_rate,
          new_lease_trade_out_pct = EXCLUDED.new_lease_trade_out_pct,
          renewal_trade_out_pct   = EXCLUDED.renewal_trade_out_pct,
          signing_velocity        = EXCLUDED.signing_velocity,
          days_vacant_median      = EXCLUDED.days_vacant_median,
          concession_trend        = EXCLUDED.concession_trend,
          loss_to_lease           = EXCLUDED.loss_to_lease,
          renewal_n               = EXCLUDED.renewal_n,
          turnover_n              = EXCLUDED.turnover_n,
          trade_out_n             = EXCLUDED.trade_out_n,
          days_vacant_n           = EXCLUDED.days_vacant_n,
          per_unit_events         = EXCLUDED.per_unit_events,
          computed_at             = NOW()
        RETURNING id
      `, [
        dealId,
        prior.id,
        toSnapshotId,
        periodDays,
        renewalRate    != null ? renewalRate.toFixed(4)    : null,
        turnoverRate   != null ? turnoverRate.toFixed(4)   : null,
        newLeaseTradeOutPct != null ? newLeaseTradeOutPct.toFixed(4) : null,
        renewalTradeOutPct  != null ? renewalTradeOutPct.toFixed(4)  : null,
        signingVelocity != null ? signingVelocity.toFixed(4) : null,
        daysVacantMedian,
        concessionTrend,
        lossToLease    != null ? lossToLease.toFixed(4)    : null,
        renewalN, turnoverN, tradeOutN, daysVacantN,
        JSON.stringify(cappedEvents),
      ]);

      const diffId = diffResult.rows[0]?.id ?? null;

      // ── Promote to S2 in subject_traffic_history ──────────────────────────
      await this.promoteToS2(dealId, {
        renewal_rate:            renewalRate,
        turnover_rate:           turnoverRate,
        new_lease_trade_out_pct: newLeaseTradeOutPct,
        renewal_trade_out_pct:   renewalTradeOutPct,
        signing_velocity:        signingVelocity,
        days_vacant_median:      daysVacantMedian,
        concession_trend:        concessionTrend,
        loss_to_lease:           lossToLease,
        diff_period_count:       1,
      }, {
        renewal_n: renewalN,
        turnover_n: turnoverN,
        trade_out_n: tradeOutN,
        days_vacant_n: daysVacantN,
        signing_velocity_n: renewalN + newLeases.length,
      });

      logger.info('[RentRollDiff] Diff extraction complete', {
        dealId, diffId, periodDays, renewalRate, turnoverRate,
      });

      return diffId;

    } catch (err: unknown) {
      logger.error('[RentRollDiff] Diff extraction failed', {
        dealId, toSnapshotId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  // ── Private: promote subject_traffic_history to S2 ────────────────────────

  private async promoteToS2(
    dealId: string,
    dynamics: SubjectObservedDynamics,
    sampleSizes: Record<string, number>,
  ): Promise<void> {
    // Build confidence_weights for S2 coefficients
    const s2Weights: Record<string, SubjectWeightEntry> = {};

    const coeffMap: Array<{ key: string; sample_key: string }> = [
      { key: 'renewal_rate',           sample_key: 'renewal_n' },
      { key: 'turnover_rate',          sample_key: 'turnover_n' },
      { key: 'new_lease_trade_out_pct', sample_key: 'trade_out_n' },
      { key: 'renewal_trade_out_pct',   sample_key: 'trade_out_n' },
      { key: 'days_vacant_median',      sample_key: 'days_vacant_n' },
      { key: 'signing_velocity',        sample_key: 'signing_velocity_n' },
    ];

    for (const { key, sample_key } of coeffMap) {
      const nObs      = sampleSizes[sample_key] ?? 0;
      const nRequired = SUBJECT_N_REQUIRED[key] ?? 6;
      s2Weights[key]  = {
        n_obs:      nObs,
        n_required: nRequired,
        weight:     Math.min(1, nObs / nRequired),
      };
    }

    // Detect peer collisions — requires subject_traffic_history to already have
    // confidence_weights populated; peer_value comparison will be done by the
    // CoefficientResolverService at query time.  We store an empty array here
    // and let the resolver populate it on the next /coefficients call.
    const peerCollisions: SubjectPeerCollision[] = [];

    await this.pool.query(`
      INSERT INTO subject_traffic_history
        (deal_id, tier, snapshot_count, coverage_months,
         observed_dynamics, confidence_weights, peer_collisions, updated_at)
      VALUES ($1, 'S2', 1, NULL, $2, $3, '[]', NOW())
      ON CONFLICT (deal_id) DO UPDATE SET
        tier               = 'S2',
        observed_dynamics  = EXCLUDED.observed_dynamics,
        confidence_weights = subject_traffic_history.confidence_weights || EXCLUDED.confidence_weights,
        peer_collisions    = $4,
        updated_at         = NOW()
    `, [
      dealId,
      JSON.stringify(dynamics),
      JSON.stringify(s2Weights),
      JSON.stringify(peerCollisions),
    ]);

    logger.info('[RentRollDiff] S2 promotion complete', { dealId });
  }
}
