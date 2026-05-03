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
  | 'HOLDOVER'            // occupied → occupied, no renewal flag, lease_end < snapshot_date
  | 'MOVE_OUT_NOTICE'     // occupied → notice (gave notice but not yet vacated)
  | 'EVICTION'            // occupied → vacant, move_out is set and forced (no days_vacant lag)
  | 'RENOVATION'          // unit status → 'down' (offline for renovation/capital work)
  | 'STRUCTURAL_VACANCY'  // unit absent from current snapshot entirely (never seen again)
  | 'SPLIT'               // one prior unit → multiple current units (e.g. unit subdivision)
  | 'MERGE'               // multiple prior units → one current unit (e.g. unit combination)
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
      // Level 2: (unit_type + unit_sf) fingerprint — unique match only
      // Level 3: (lease_start_month + unit_type) tenant identity — last-resort
      //
      // SPLIT detection: one prior unit_id appears as the L1 key for multiple
      // current units → each current unit classified as SPLIT event.
      // MERGE detection: multiple prior units matched to same current unit via
      // L2/L3 (rare) → first match wins, extras classified as STRUCTURAL_VACANCY
      // in the reverse pass.

      const makeKey1 = (u: ParsedUnit) => u.unit_id ?? '';
      const makeKey2 = (u: ParsedUnit) =>
        `${(u.unit_type ?? '').toLowerCase().trim()}::${u.unit_sf ?? 'NA'}`;
      // L3: lease start month (YYYY-MM) + unit_type — good for tenant continuity
      // when unit IDs are unstable and floor plan isn't unique
      const makeKey3 = (u: ParsedUnit) => {
        const lsMonth = (u.lease_start ?? '').slice(0, 7); // 'YYYY-MM' or ''
        return lsMonth ? `${lsMonth}::${(u.unit_type ?? '').toLowerCase().trim()}` : '';
      };

      const priorById   = new Map<string, ParsedUnit[]>();
      const priorByFp   = new Map<string, ParsedUnit[]>();
      const priorByL3   = new Map<string, ParsedUnit[]>();
      for (const u of priorUnits) {
        const k1 = makeKey1(u);
        if (k1) {
          if (!priorById.has(k1)) priorById.set(k1, []);
          priorById.get(k1)!.push(u);
        }
        const k2 = makeKey2(u);
        if (!priorByFp.has(k2)) priorByFp.set(k2, []);
        priorByFp.get(k2)!.push(u);

        const k3 = makeKey3(u);
        if (k3) {
          if (!priorByL3.has(k3)) priorByL3.set(k3, []);
          priorByL3.get(k3)!.push(u);
        }
      }

      // Pre-pass: detect split candidates — unit_ids that appear in multiple
      // current units (one prior unit physically split into N current units)
      const currById = new Map<string, ParsedUnit[]>();
      for (const u of currentUnits) {
        const k1 = makeKey1(u);
        if (k1) {
          if (!currById.has(k1)) currById.set(k1, []);
          currById.get(k1)!.push(u);
        }
      }
      const splitPriorIds = new Set<string>();
      for (const [id, currGroup] of currById) {
        const priorGroup = priorById.get(id) ?? [];
        if (priorGroup.length === 1 && currGroup.length > 1) {
          splitPriorIds.add(id); // one prior → many current
        }
      }

      // Also pre-detect MERGE: multiple prior units map to the same current
      // unit via L2. We track this below in the consumed set.
      const consumedPriorIds = new Set<string>();  // tracks prior unit_id values consumed
      const consumedPriorFps = new Map<string, number>();  // fingerprint → count consumed

      const unitEvents: UnitEvent[] = [];

      const currSnapshotDate = new Date(curr.snapshot_date);

      for (const curr_unit of currentUnits) {
        const key1 = makeKey1(curr_unit);
        const key2 = makeKey2(curr_unit);
        const key3 = makeKey3(curr_unit);

        let matched: ParsedUnit | null = null;
        let matchKey: string = '';
        let isSplit = false;

        // Level-1: exact unit_id match
        if (key1 && priorById.has(key1)) {
          const candidates = priorById.get(key1)!;
          if (splitPriorIds.has(key1)) {
            // SPLIT: one prior unit → multiple current units
            matched  = candidates[0];
            matchKey = `id:${key1}`;
            isSplit  = true;
          } else if (candidates.length === 1) {
            matched  = candidates[0];
            matchKey = `id:${key1}`;
          }
        }

        if (!matched) {
          // Level-2: unique (unit_type + unit_sf) fingerprint
          if (priorByFp.has(key2)) {
            const fpCandidates = priorByFp.get(key2)!;
            const alreadyConsumedCount = consumedPriorFps.get(key2) ?? 0;
            const remaining = fpCandidates.length - alreadyConsumedCount;
            if (remaining === 1) {
              // Last unused unit with this fingerprint — unambiguous
              matched  = fpCandidates[alreadyConsumedCount];
              matchKey = `fp:${key2}`;
            } else if (remaining > 1 && fpCandidates.length === currentUnits.filter(u => makeKey2(u) === key2).length) {
              // N prior ↔ N current with same fingerprint — positional match
              matched  = fpCandidates[alreadyConsumedCount];
              matchKey = `fp:${key2}`;
            }
          }
        }

        if (!matched && key3) {
          // Level-3: lease_start_month + unit_type tenant identity
          const l3Candidates = priorByL3.get(key3) ?? [];
          if (l3Candidates.length === 1) {
            matched  = l3Candidates[0];
            matchKey = `lt:${key3}`;
          }
        }

        if (!matched) {
          unitEvents.push({
            unit_key:             key1 || key2,
            event_type:           'UNRESOLVED',
            prior_contract_rent:  null,
            current_contract_rent: curr_unit.contract_rent ?? null,
            trade_out_pct:        null,
            days_vacant_observed: null,
            prior_concession:     null,
            current_concession:   curr_unit.concession_value ?? null,
          });
          continue;
        }

        // Mark this prior unit as consumed (for reverse pass)
        const priorId = makeKey1(matched);
        if (priorId) consumedPriorIds.add(priorId);
        const fp2 = makeKey2(matched);
        consumedPriorFps.set(fp2, (consumedPriorFps.get(fp2) ?? 0) + 1);

        // ── Classify event ────────────────────────────────────────────────
        const wasOccupied = matched.unit_status === 'occupied';
        const isOccupied  = curr_unit.unit_status === 'occupied';
        const isNotice    = curr_unit.unit_status === 'notice';
        const wasVacant   = matched.unit_status === 'vacant' || matched.unit_status === 'notice';
        const isVacant    = curr_unit.unit_status === 'vacant' || curr_unit.unit_status === 'notice';

        let eventType: UnitEventType;

        if (isSplit) {
          eventType = 'SPLIT';
        } else if (wasOccupied && isOccupied) {
          if (curr_unit.is_renewal) {
            eventType = 'RENEWAL';
          } else {
            // Holdover: lease expired but no renewal flagged — tenant staying over
            const leaseEnd = curr_unit.lease_end ? new Date(curr_unit.lease_end) : null;
            const isHoldover = leaseEnd != null && leaseEnd < currSnapshotDate;
            eventType = isHoldover ? 'HOLDOVER' : 'STABLE_OCCUPANCY';
          }
        } else if (wasOccupied && isNotice) {
          // Tenant gave move-out notice — still present but flagged
          eventType = 'MOVE_OUT_NOTICE';
        } else if (wasVacant && isOccupied) {
          eventType = 'NEW_LEASE_AFTER_VACANCY';
        } else if (wasOccupied && (curr_unit.unit_status === 'down' || curr_unit.unit_status === 'model')) {
          // Unit taken offline for renovation, capital work, or converted to model
          eventType = 'RENOVATION';
        } else if (wasOccupied && isVacant) {
          // Distinguish eviction from standard turnover:
          // EVICTION heuristic — move_out_date is set on the current snapshot AND
          // days_vacant is 0 or very small (tenant left abruptly, not a planned move-out)
          const hasAbruptMoveOut = curr_unit.move_out_date != null && (curr_unit.days_vacant ?? 99) <= 7;
          eventType = hasAbruptMoveOut ? 'EVICTION' : 'TURNOVER';
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
          prior_concession:     matched.concession_value ?? null,
          current_concession:   curr_unit.concession_value ?? null,
        });
      }

      // ── Reverse pass: prior units absent from current snapshot ────────────
      // Emits STRUCTURAL_VACANCY for units that appear in prior but were
      // never matched to any current unit.  This covers permanent removals
      // (unit demolition, conversion, down status) and move-outs not captured
      // in the forward pass.  MERGE candidates (N prior → 1 current) also
      // surface here as STRUCTURAL_VACANCY since only one prior consumed the
      // current counterpart.
      for (const prior_unit of priorUnits) {
        const pk1 = makeKey1(prior_unit);
        if (pk1 && consumedPriorIds.has(pk1)) continue; // already matched

        // Check via fingerprint count
        const pk2 = makeKey2(prior_unit);
        const fpConsumed = consumedPriorFps.get(pk2) ?? 0;
        const fpTotal = priorByFp.get(pk2)?.length ?? 0;
        const fpCurrentTotal = currentUnits.filter(u => makeKey2(u) === pk2).length;
        // If all fingerprint instances are accounted for, skip
        if (fpTotal > 0 && fpConsumed >= fpTotal && fpCurrentTotal >= fpTotal) continue;

        // Emit STRUCTURAL_VACANCY for this unmatched prior unit
        unitEvents.push({
          unit_key:             pk1 || pk2,
          event_type:           'STRUCTURAL_VACANCY',
          prior_contract_rent:  prior_unit.contract_rent ?? null,
          current_contract_rent: null,
          trade_out_pct:        null,
          days_vacant_observed: null,
          prior_concession:     prior_unit.concession_value ?? null,
          current_concession:   null,
        });
      }

      // ── Aggregate metrics ─────────────────────────────────────────────────
      // Exclude UNRESOLVED + structural events from rate denominators to avoid
      // biasing rates with units where identity couldn't be established.
      const resolved   = unitEvents.filter(e =>
        e.event_type !== 'UNRESOLVED' &&
        e.event_type !== 'STRUCTURAL_VACANCY' &&
        e.event_type !== 'SPLIT' &&
        e.event_type !== 'MERGE'
      );
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

      // ── Promote to S2: aggregate ALL qualifying diffs for the deal ────────
      await this.promoteToS2(dealId);

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
  //
  // Aggregates ALL qualifying diffs for the deal (period_days >= S2_MIN_PERIOD_DAYS)
  // using weighted averages (weight = renewal_n or relevant count).
  // This is the authoritative S2 rollup — runs after every new diff is written.

  private async promoteToS2(dealId: string): Promise<void> {
    // Load all qualifying diffs for this deal from DB
    const diffsResult = await this.pool.query<{
      renewal_rate:            string | null;
      turnover_rate:           string | null;
      new_lease_trade_out_pct: string | null;
      renewal_trade_out_pct:   string | null;
      signing_velocity:        string | null;
      days_vacant_median:      string | null;
      concession_trend:        string | null;
      loss_to_lease:           string | null;
      renewal_n:               number;
      turnover_n:              number;
      trade_out_n:             number;
      days_vacant_n:           number;
      period_days:             number;
      from_snapshot_id:        number;
      to_snapshot_id:          number;
    }>(`
      SELECT renewal_rate, turnover_rate, new_lease_trade_out_pct, renewal_trade_out_pct,
             signing_velocity, days_vacant_median, concession_trend, loss_to_lease,
             renewal_n, turnover_n, trade_out_n, days_vacant_n,
             period_days, from_snapshot_id, to_snapshot_id
      FROM rent_roll_diffs
      WHERE deal_id = $1 AND period_days >= $2
      ORDER BY to_snapshot_id ASC
    `, [dealId, S2_MIN_PERIOD_DAYS]);

    const diffs = diffsResult.rows;
    if (diffs.length === 0) {
      logger.debug('[RentRollDiff] No qualifying diffs found for S2 promotion', { dealId });
      return;
    }

    // ── Weighted-average aggregation across all diffs ───────────────────────
    // Weights are the sample sizes for each metric.
    const safeNum = (v: string | null) => (v != null ? parseFloat(v) : null);

    const wagg = (vals: Array<{ v: number | null; w: number }>) => {
      const valid = vals.filter(x => x.v != null && x.w > 0) as Array<{ v: number; w: number }>;
      if (valid.length === 0) return null;
      const totalW = valid.reduce((a, x) => a + x.w, 0);
      return totalW > 0 ? valid.reduce((a, x) => a + x.v * x.w, 0) / totalW : null;
    };

    // Aggregate sample counts (sum across diffs)
    const totalRenewalN  = diffs.reduce((a, d) => a + (d.renewal_n  ?? 0), 0);
    const totalTurnoverN = diffs.reduce((a, d) => a + (d.turnover_n ?? 0), 0);
    const totalTradeOutN = diffs.reduce((a, d) => a + (d.trade_out_n ?? 0), 0);
    const totalDaysVacN  = diffs.reduce((a, d) => a + (d.days_vacant_n ?? 0), 0);
    const totalSvN       = diffs.reduce((a, d) => a + ((d.renewal_n ?? 0) + (d.turnover_n ?? 0)), 0);
    const diffCount      = diffs.length;

    // Compute total snapshot span (first to last)
    const snapshotResult = await this.pool.query<{ snap_count: string; min_date: string; max_date: string }>(`
      SELECT COUNT(DISTINCT id)       AS snap_count,
             MIN(snapshot_date::text) AS min_date,
             MAX(snapshot_date::text) AS max_date
      FROM rent_roll_snapshots
      WHERE deal_id = $1 AND status IN ('derived','calibrated','parsed')
    `, [dealId]);
    const snapshotCount = parseInt(snapshotResult.rows[0]?.snap_count ?? '1', 10);
    const minDate = snapshotResult.rows[0]?.min_date ? new Date(snapshotResult.rows[0].min_date) : new Date();
    const maxDate = snapshotResult.rows[0]?.max_date ? new Date(snapshotResult.rows[0].max_date) : new Date();
    const coverageMonths = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

    // Weighted averages
    const renewalRate = wagg(diffs.map(d => ({ v: safeNum(d.renewal_rate),  w: d.renewal_n  ?? 0 })));
    const turnoverRate = wagg(diffs.map(d => ({ v: safeNum(d.turnover_rate), w: d.turnover_n ?? 0 })));
    const newLeaseTradeOutPct = wagg(diffs.map(d => ({ v: safeNum(d.new_lease_trade_out_pct), w: d.trade_out_n ?? 0 })));
    const renewalTradeOutPct  = wagg(diffs.map(d => ({ v: safeNum(d.renewal_trade_out_pct),   w: d.trade_out_n ?? 0 })));
    const signingVelocity     = wagg(diffs.map(d => ({ v: safeNum(d.signing_velocity),         w: (d.renewal_n ?? 0) + (d.turnover_n ?? 0) })));
    const daysVacantMedian    = wagg(diffs.map(d => ({ v: safeNum(d.days_vacant_median),        w: d.days_vacant_n ?? 0 })));

    // Loss-to-lease: simple average across diffs (each diff has its own snapshot)
    const ltlVals = diffs.map(d => safeNum(d.loss_to_lease)).filter((v): v is number => v != null);
    const lossToLease = ltlVals.length > 0 ? ltlVals.reduce((a, b) => a + b, 0) / ltlVals.length : null;

    // Concession trend: majority vote
    const trendCounts: Record<string, number> = { increasing: 0, stable: 0, decreasing: 0 };
    for (const d of diffs) {
      if (d.concession_trend && trendCounts[d.concession_trend] !== undefined) {
        trendCounts[d.concession_trend]++;
      }
    }
    const concessionTrend = (['increasing', 'stable', 'decreasing'] as const)
      .reduce<'increasing' | 'stable' | 'decreasing' | null>(
        (best, k) => trendCounts[k] > (trendCounts[best ?? 'stable'] ?? 0) ? k : best,
        diffs.some(d => d.concession_trend) ? 'stable' : null,
      );

    // ── Build confidence_weights + determine nulled metrics ──────────────────
    // Done BEFORE constructing dynamics so nulling is typed (no `any` escapes).
    const s2Weights: Record<string, SubjectWeightEntry> = {};
    const INSUFFICIENT_THRESHOLD = 0.5;  // null metric if n_obs < n_required × 0.5

    const coeffMap: Array<{ key: string; n_obs: number }> = [
      { key: 'renewal_rate',            n_obs: totalRenewalN  },
      { key: 'turnover_rate',           n_obs: totalTurnoverN },
      { key: 'new_lease_trade_out_pct', n_obs: totalTradeOutN },
      { key: 'renewal_trade_out_pct',   n_obs: totalTradeOutN },
      { key: 'days_vacant_median',      n_obs: totalDaysVacN  },
      { key: 'signing_velocity',        n_obs: totalSvN       },
      { key: 'loss_to_lease',           n_obs: ltlVals.length },
      { key: 'concession_trend',        n_obs: diffCount      },
    ];

    // Build nulled-key set before constructing dynamics — avoids `as any` cast.
    const nulledKeys = new Set<string>();
    for (const { key, n_obs } of coeffMap) {
      const nRequired = SUBJECT_N_REQUIRED[key] ?? 6;
      const insufficientSample = n_obs < nRequired * INSUFFICIENT_THRESHOLD;
      s2Weights[key] = {
        n_obs,
        n_required: nRequired,
        weight: insufficientSample ? 0 : Math.min(1, n_obs / nRequired),
      };
      if (insufficientSample) nulledKeys.add(key);
    }

    // Typed dynamics construction — nulled metrics replaced with null per
    // insufficient-sample rules without any `as any` escape.
    const dynamics: SubjectObservedDynamics = {
      renewal_rate:            nulledKeys.has('renewal_rate')            ? null : renewalRate,
      turnover_rate:           nulledKeys.has('turnover_rate')           ? null : turnoverRate,
      new_lease_trade_out_pct: nulledKeys.has('new_lease_trade_out_pct') ? null : newLeaseTradeOutPct,
      renewal_trade_out_pct:   nulledKeys.has('renewal_trade_out_pct')   ? null : renewalTradeOutPct,
      signing_velocity:        nulledKeys.has('signing_velocity')        ? null : signingVelocity,
      days_vacant_median:      nulledKeys.has('days_vacant_median')      ? null : daysVacantMedian,
      concession_trend:        nulledKeys.has('concession_trend')        ? null : concessionTrend,
      loss_to_lease:           nulledKeys.has('loss_to_lease')           ? null : lossToLease,
      diff_period_count:       diffCount,
    };

    // ── Peer-collision computation at S2 time ────────────────────────────────
    // Spec: collisions must be persisted as part of S2 aggregation semantics,
    // not deferred to /coefficients endpoint call time (which is non-deterministic).
    const peerCollisions: SubjectPeerCollision[] = await this.computePeerCollisions(dealId, dynamics);

    await this.pool.query(`
      INSERT INTO subject_traffic_history
        (deal_id, tier, snapshot_count, coverage_months,
         observed_dynamics, confidence_weights, peer_collisions, updated_at)
      VALUES ($1, 'S2', $2, $3, $4, $5, '[]', NOW())
      ON CONFLICT (deal_id) DO UPDATE SET
        tier               = 'S2',
        snapshot_count     = EXCLUDED.snapshot_count,
        coverage_months    = EXCLUDED.coverage_months,
        observed_dynamics  = EXCLUDED.observed_dynamics,
        confidence_weights = subject_traffic_history.confidence_weights || EXCLUDED.confidence_weights,
        peer_collisions    = $6,
        updated_at         = NOW()
    `, [
      dealId,
      snapshotCount,
      coverageMonths.toFixed(2),
      JSON.stringify(dynamics),
      JSON.stringify(s2Weights),
      JSON.stringify(peerCollisions),
    ]);

    logger.info('[RentRollDiff] S2 promotion complete (aggregated)', {
      dealId, diffCount, snapshotCount, coverageMonths: coverageMonths.toFixed(1),
      totalRenewalN, totalTurnoverN,
    });
  }

  // ============================================================================
  // Private: Compute peer collisions against deal-scoped platform posteriors
  // Must run at S2 aggregation time (deterministic lifecycle, not on /coefficients
  // call). Uses the same scope-degradation cascade as CoefficientResolverService.
  // ============================================================================

  private async computePeerCollisions(
    dealId: string,
    dynamics: SubjectObservedDynamics,
  ): Promise<SubjectPeerCollision[]> {
    try {
      // Load deal context for scope degradation
      const dealRes = await this.pool.query<{
        submarket_id: string | null;
        property_class: string | null;
        year_built: number | null;
        msa_id: string | null;
      }>(
        `SELECT submarket_id, property_class, year_built, msa_id FROM deals WHERE id = $1`,
        [dealId],
      );
      if (dealRes.rows.length === 0) return [];
      const d = dealRes.rows[0];

      // Derive vintage band identically to CoefficientResolverService.getVintageBand()
      const yb = d.year_built;
      const vintageBand = yb == null ? null
        : yb < 1980 ? 'pre_1980'
        : yb < 2000 ? '1980_2000'
        : yb < 2015 ? '2000_2015'
        : 'post_2015';

      // Scope-degradation cascade — same order as resolver
      const scopeAttempts = [
        { scope_level: 'submarket', submarket_id: d.submarket_id, property_class: d.property_class, vintage_band: vintageBand, msa_id: null },
        { scope_level: 'submarket', submarket_id: d.submarket_id, property_class: d.property_class, vintage_band: null,        msa_id: null },
        { scope_level: 'submarket', submarket_id: d.submarket_id, property_class: null,             vintage_band: null,        msa_id: null },
        { scope_level: 'msa',       submarket_id: null,           property_class: d.property_class, vintage_band: null,        msa_id: d.msa_id },
        { scope_level: 'class',     submarket_id: null,           property_class: d.property_class, vintage_band: null,        msa_id: null },
        { scope_level: 'vintage',   submarket_id: null,           property_class: null,             vintage_band: vintageBand, msa_id: null },
        { scope_level: 'platform',  submarket_id: null,           property_class: null,             vintage_band: null,        msa_id: null },
      ];

      let posteriors: Record<string, number> = {};
      for (const attempt of scopeAttempts) {
        const res = await this.pool.query<{ coefficient_name: string; posterior_value: string }>(
          `SELECT coefficient_name, posterior_value
           FROM traffic_calibration_factors
           WHERE scope_level = $1
             AND (submarket_id = $2 OR ($2 IS NULL AND submarket_id IS NULL))
             AND (property_class = $3 OR ($3 IS NULL AND property_class IS NULL))
             AND (vintage_band = $4 OR ($4 IS NULL AND vintage_band IS NULL))
             AND (msa_id = $5 OR ($5 IS NULL AND msa_id IS NULL))
             AND coefficient_name != 'absorption_curve'
             AND cal_window = 'TTM'
           ORDER BY n_peer_properties DESC`,
          [attempt.scope_level, attempt.submarket_id, attempt.property_class, attempt.vintage_band, attempt.msa_id],
        );
        if (res.rows.length > 0) {
          for (const row of res.rows) {
            posteriors[row.coefficient_name] = parseFloat(row.posterior_value);
          }
          break;
        }
      }
      if (Object.keys(posteriors).length === 0) return [];

      // Collision threshold: |subject - peer| > 1.5σ, where σ = |peer| × 0.15
      const collisions: SubjectPeerCollision[] = [];
      const dynamicsEntries: Array<[string, number | null]> = [
        ['renewal_rate',            dynamics.renewal_rate],
        ['turnover_rate',           dynamics.turnover_rate],
        ['new_lease_trade_out_pct', dynamics.new_lease_trade_out_pct],
        ['renewal_trade_out_pct',   dynamics.renewal_trade_out_pct],
        ['signing_velocity',        dynamics.signing_velocity],
        ['days_vacant_median',      dynamics.days_vacant_median],
        ['loss_to_lease',           dynamics.loss_to_lease],
      ];
      for (const [key, subjectValue] of dynamicsEntries) {
        if (subjectValue == null) continue;
        const peerValue = posteriors[key];
        if (peerValue == null) continue;
        const sigma = Math.abs(peerValue) * 0.15;
        if (sigma === 0) continue;
        const deviation = Math.abs(subjectValue - peerValue) / sigma;
        if (deviation > 1.5) {
          collisions.push({
            coefficient:     key,
            subject_value:   subjectValue,
            peer_value:      peerValue,
            sigma_deviation: deviation,
          });
        }
      }
      return collisions;
    } catch (err: unknown) {
      logger.warn('[RentRollDiff] computePeerCollisions failed — storing empty collisions', {
        dealId, error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }
}
