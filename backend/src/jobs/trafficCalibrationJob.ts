/**
 * M07: Traffic Calibration Nightly Job
 *
 * Runs nightly (or on-demand) to:
 *   1. Pull lease events from recently-ingested rent roll snapshots
 *   2. Compute per-property coefficients from observed conversion rates
 *   3. Roll up to (msa, submarket, class, vintage_band) scope buckets
 *   4. Apply Bayesian update: posterior = (prior×n_prior + evidence×n_evidence) / (n_prior+n_evidence)
 *   5. Write versioned rows to traffic_calibration_factors
 *   6. Snapshot old rows to traffic_calibration_history
 *   7. Compute absorption benchmarks (§T006)
 *   8. Publish Kafka event traffic.calibration.updated
 *
 * Calibration window priority:
 *   TTM    → primary (last 12 months)
 *   PYTM   → comparison (prior 12 months, 13–24 months ago)
 *   TTM_24 → used for sparse buckets with < 5 properties
 */

import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { kafkaProducer } from '../services/kafka/kafka-producer.service';
import { KAFKA_TOPICS, type TrafficCalibrationUpdatedMessage } from '../services/kafka/event-schemas';

// ============================================================================
// Baseline coefficient defaults (hard-coded constants from original engine)
// ============================================================================
export const BASELINE_COEFFICIENTS = {
  visibility_capture_rate: 0.04,
  apartment_seeker_pct:    0.02,
  stop_probability:        0.15,
  walkin_to_tour:          0.40,
  tour_to_app:             0.60,
  app_to_signed:           0.70,
} as const;

type CoefficientName = keyof typeof BASELINE_COEFFICIENTS;
const ALL_COEFFICIENTS = Object.keys(BASELINE_COEFFICIENTS) as CoefficientName[];

// Minimum evidence required for a scope bucket to override baseline
const MIN_PROPERTIES_TTM = 5;
const MIN_PROPERTIES_SPARSE = 2;  // used with TTM_24

export interface CalibrationJobResult {
  buckets_updated: number;
  buckets_created: number;
  properties_processed: number;
  absorption_benchmarks_updated: number;
  job_version: string;
  run_at: Date;
}

export class TrafficCalibrationJob {

  private readonly JOB_VERSION = '1.0.0';

  constructor(private readonly pool: Pool) {}

  /**
   * Run the full nightly calibration job.
   * lookbackHours: how far back to look for new rent roll snapshots (default: 24h nightly)
   */
  async run(lookbackHours: number = 24): Promise<CalibrationJobResult> {
    const runAt = new Date();
    logger.info('[CalibrationJob] Starting nightly calibration', { lookbackHours, jobVersion: this.JOB_VERSION });

    // Gather only NEW snapshots (since lookbackHours ago) as this run's evidence.
    // Each run, the existing DB row serves as the Bayesian prior; we fold in only
    // new evidence so old evidence is never double-counted across runs.
    const newSnapshots = await this.getRecentSnapshots(lookbackHours);
    logger.info('[CalibrationJob] New snapshots in window', { count: newSnapshots.length, lookbackHours });

    // Absorption benchmarks still need all historical snapshots (they're point-in-time stats,
    // not cumulative Bayesian updates, so re-computing from all data is correct).
    const allSnapshots = await this.getAllDerivedSnapshots();

    if (newSnapshots.length === 0) {
      logger.info('[CalibrationJob] No new snapshots in window — skipping Bayesian update (absorption benchmarks still run)');
      const absorptionUpdated = await this.computeAbsorptionBenchmarks(allSnapshots);
      await this.publishCalibrationEvent({ bucketsUpdated: 0, bucketsCreated: 0, propertiesProcessed: 0, absorptionUpdated, runAt });
      return { buckets_updated: 0, buckets_created: 0, properties_processed: 0, absorption_benchmarks_updated: absorptionUpdated, job_version: this.JOB_VERSION, run_at: runAt };
    }

    // Compute evidence from NEW snapshots only
    const evidenceRows = await this.computeEvidenceFromSnapshots(newSnapshots);
    logger.info('[CalibrationJob] Evidence rows from new snapshots', { count: evidenceRows.length });

    // Roll up to scope buckets
    const buckets = this.rollUpToBuckets(evidenceRows);
    logger.info('[CalibrationJob] Scope buckets formed', { count: Object.keys(buckets).length });

    // Bayesian update and persist
    let bucketsUpdated = 0;
    let bucketsCreated = 0;

    for (const [bucketKey, bucketData] of Object.entries(buckets)) {
      const { updated, created } = await this.bayesianUpdateBucket(bucketData, runAt);
      bucketsUpdated += updated;
      bucketsCreated += created;
    }

    // Compute absorption benchmarks
    const absorptionUpdated = await this.computeAbsorptionBenchmarks(allSnapshots);

    logger.info('[CalibrationJob] Job complete', {
      bucketsUpdated, bucketsCreated, absorptionUpdated,
      propertiesProcessed: evidenceRows.length,
    });

    await this.publishCalibrationEvent({
      bucketsUpdated,
      bucketsCreated,
      propertiesProcessed: evidenceRows.length,
      absorptionUpdated,
      runAt,
    });

    return {
      buckets_updated: bucketsUpdated,
      buckets_created: bucketsCreated,
      properties_processed: evidenceRows.length,
      absorption_benchmarks_updated: absorptionUpdated,
      job_version: this.JOB_VERSION,
      run_at: runAt,
    };
  }

  // ============================================================================
  // Step 1: Load snapshots
  // ============================================================================

  private async getRecentSnapshots(lookbackHours: number): Promise<any[]> {
    const result = await this.pool.query<any>(`
      SELECT rrs.id, rrs.deal_id, rrs.snapshot_date, rrs.derived_metrics,
             (d.deal_data->'market_intelligence'->'data'->'demographics'->'submarket'->>'id') AS submarket_id,
             (d.deal_data->>'property_class') AS property_class,
             (d.deal_data->>'year_built') AS year_built,
             (d.deal_data->>'target_units')::integer AS units,
             -- MSA fallback chain (same as getAllDerivedSnapshots)
             COALESCE(
               d.deal_data->'market_intelligence'->'data'->'demographics'->>'msa_id',
               d.deal_data->>'msa_id',
               d.deal_data->'market_intelligence'->>'msa_id'
             ) AS msa_id
      FROM rent_roll_snapshots rrs
      JOIN deals d ON rrs.deal_id::uuid = d.id
      WHERE rrs.status = 'derived'
        AND rrs.updated_at >= NOW() - ($1 * INTERVAL '1 hour')
    `, [lookbackHours]);
    return result.rows;
  }

  private async getAllDerivedSnapshots(): Promise<any[]> {
    const result = await this.pool.query<any>(`
      SELECT rrs.id, rrs.deal_id, rrs.snapshot_date, rrs.derived_metrics,
             (d.deal_data->'market_intelligence'->'data'->'demographics'->'submarket'->>'id') AS submarket_id,
             d.deal_data,
             (d.deal_data->>'property_class') AS property_class,
             (d.deal_data->>'year_built') AS year_built,
             (d.deal_data->>'target_units')::integer AS units,
             -- Extract MSA from multiple JSONB paths (fallback chain)
             COALESCE(
               d.deal_data->'market_intelligence'->'data'->'demographics'->>'msa_id',
               d.deal_data->>'msa_id',
               d.deal_data->'market_intelligence'->>'msa_id'
             ) AS msa_id
      FROM rent_roll_snapshots rrs
      JOIN deals d ON rrs.deal_id::uuid = d.id
      WHERE rrs.status IN ('derived', 'calibrated')
        AND rrs.derived_metrics IS NOT NULL
        AND rrs.derived_metrics != '{}'
    `);
    return result.rows;
  }

  // ============================================================================
  // Step 2: Compute evidence from snapshots
  //
  // We derive proxy coefficients from the derived_metrics JSON:
  //   - signing_velocity → proxy for walkin_to_tour, tour_to_app, app_to_signed
  //   - renewal_rate_proxy → retention signal
  //   - days_vacant → proxy for visibility_capture_rate (lower vacancy = better capture)
  // ============================================================================

  private async computeEvidenceFromSnapshots(snapshots: any[]): Promise<EvidenceRow[]> {
    const rows: EvidenceRow[] = [];

    for (const snap of snapshots) {
      const derived = snap.derived_metrics as any;
      if (!derived || !derived.unit_type_breakdown?.length) continue;

      // Aggregate across unit types
      const allUnitTypes = derived.unit_type_breakdown;
      const avgSigningVelocity = this.mean(allUnitTypes.map((u: any) => u.signing_velocity));
      const avgDaysVacant = this.mean(allUnitTypes.map((u: any) => u.days_vacant_avg).filter((d: number) => d > 0));
      const avgConcession = this.mean(allUnitTypes.map((u: any) => u.concession_intensity));
      const renewalRate = derived.renewal_rate_proxy ?? 0.5;

      // Only include this snapshot if we have useful signal
      if (avgSigningVelocity <= 0) continue;

      // Derive proxy coefficients for all 6 calibrated coefficients.
      // These are heuristic proxies derived from rent-roll signals until
      // we have end-to-end funnel tracking data.
      const evidence: Partial<Record<CoefficientName, number>> = {
        // 1. visibility_capture_rate — lower vacancy time = higher capture (people find the property faster)
        visibility_capture_rate: avgDaysVacant > 0
          ? Math.min(0.10, Math.max(0.02, 0.08 * (30 / avgDaysVacant)))
          : BASELINE_COEFFICIENTS.visibility_capture_rate,

        // 2. apartment_seeker_pct — concession intensity inversely signals demand
        apartment_seeker_pct: avgConcession > 4
          ? 0.015  // high concessions = lower demand
          : avgConcession < 1
          ? 0.025  // low concessions = strong demand
          : BASELINE_COEFFICIENTS.apartment_seeker_pct,

        // 3. stop_probability — fast vacancy turn = high stop conversion
        stop_probability: avgDaysVacant > 0
          ? Math.min(0.5, Math.max(0.05, 0.15 * (30 / avgDaysVacant)))
          : BASELINE_COEFFICIENTS.stop_probability,

        // 4. walkin_to_tour — signing velocity (leases/month) drives conversion rate
        walkin_to_tour: Math.min(0.9, Math.max(0.1, avgSigningVelocity / 10)),

        // 5. tour_to_app — high velocity + low concessions → tours convert well to apps
        tour_to_app: Math.min(0.85, Math.max(0.3,
          0.55 + (avgSigningVelocity / 20) - (avgConcession / 20)
        )),

        // 6. app_to_signed — renewal rate (loyal residents) proxies lease-signing propensity
        app_to_signed: Math.min(0.95, Math.max(0.3, 0.5 + renewalRate * 0.3)),
      };

      rows.push({
        snapshot_id: snap.id,
        deal_id: snap.deal_id,
        submarket_id: snap.submarket_id || null,
        msa_id: snap.msa_id || null,
        property_class: snap.property_class || null,
        year_built: snap.year_built ? parseInt(snap.year_built) : null,
        vintage_band: this.getVintageBand(snap.year_built),
        snapshot_date: snap.snapshot_date,
        evidence,
      });
    }

    return rows;
  }

  // ============================================================================
  // Step 3: Roll up to scope buckets
  // ============================================================================

  private rollUpToBuckets(evidenceRows: EvidenceRow[]): Record<string, BucketData> {
    const buckets: Record<string, BucketData> = {};

    const now = new Date();
    const ttmStart = new Date(now); ttmStart.setMonth(ttmStart.getMonth() - 12);
    const pytmStart = new Date(now); pytmStart.setMonth(pytmStart.getMonth() - 24);

    for (const row of evidenceRows) {
      const snapDate = new Date(row.snapshot_date);
      const inTTM = snapDate >= ttmStart;
      const inPYTM = snapDate >= pytmStart && snapDate < ttmStart;
      const inTTM24 = snapDate >= pytmStart;

      // Create buckets at all scopes in the degradation hierarchy
      const scopeLevels = [
        // Most specific: submarket + class + vintage
        {
          scope_level: 'submarket' as const,
          key: `${row.submarket_id}||${row.property_class}||${row.vintage_band}`,
          msa_id: row.msa_id,
          submarket_id: row.submarket_id,
          property_class: row.property_class,
          vintage_band: row.vintage_band,
        },
        // MSA level
        {
          scope_level: 'msa' as const,
          key: `msa:${row.msa_id}||${row.property_class}`,
          msa_id: row.msa_id,
          submarket_id: null,
          property_class: row.property_class,
          vintage_band: null,
        },
        // Class scope — cross-MSA data sliced by property class (first-class tier)
        ...(row.property_class ? [{
          scope_level: 'class' as const,
          key: `class:${row.property_class}`,
          msa_id: null,
          submarket_id: null,
          property_class: row.property_class,
          vintage_band: null,
        }] : []),
        // Vintage scope — cross-MSA data sliced by vintage band (first-class tier)
        ...(row.vintage_band ? [{
          scope_level: 'vintage' as const,
          key: `vintage:${row.vintage_band}`,
          msa_id: null,
          submarket_id: null,
          property_class: null,
          vintage_band: row.vintage_band,
        }] : []),
        // Platform level (all)
        {
          scope_level: 'platform' as const,
          key: `platform`,
          msa_id: null,
          submarket_id: null,
          property_class: null,
          vintage_band: null,
        },
      ];

      for (const scope of scopeLevels) {
        for (const window of ['TTM', 'PYTM', 'TTM_24'] as const) {
          const inWindow = window === 'TTM' ? inTTM : window === 'PYTM' ? inPYTM : inTTM24;
          if (!inWindow) continue;

          const bucketKey = `${scope.key}||${window}`;
          if (!buckets[bucketKey]) {
            buckets[bucketKey] = {
              ...scope,
              window,
              rows: [],
            };
          }
          buckets[bucketKey].rows.push(row);
        }
      }
    }

    return buckets;
  }

  // ============================================================================
  // Step 4: Bayesian update per bucket
  // ============================================================================

  private async bayesianUpdateBucket(
    bucket: BucketData,
    runAt: Date,
  ): Promise<{ updated: number; created: number }> {
    let updated = 0;
    let created = 0;

    const n_evidence = bucket.rows.length;
    if (n_evidence === 0) return { updated, created };

    // Only update if we have enough evidence
    const minRequired = bucket.window === 'TTM_24' ? MIN_PROPERTIES_SPARSE : MIN_PROPERTIES_TTM;
    if (n_evidence < minRequired) return { updated, created };

    for (const coeffName of ALL_COEFFICIENTS) {
      // Gather evidence values
      const evidenceValues = bucket.rows
        .map(r => r.evidence[coeffName])
        .filter((v): v is number => v !== undefined);

      if (evidenceValues.length < minRequired) continue;

      const avgEvidence = this.mean(evidenceValues);
      const baseline = BASELINE_COEFFICIENTS[coeffName];

      // Load existing prior from DB — include msa_id in the WHERE to prevent
      // cross-scope collisions when the uniqueness index spans msa_id.
      const existingResult = await this.pool.query<any>(`
        SELECT id, posterior_value, n_prior, n_evidence
        FROM traffic_calibration_factors
        WHERE coefficient_name = $1
          AND scope_level = $2
          AND (msa_id = $3 OR (msa_id IS NULL AND $3 IS NULL))
          AND (submarket_id = $4 OR (submarket_id IS NULL AND $4 IS NULL))
          AND (property_class = $5 OR (property_class IS NULL AND $5 IS NULL))
          AND (vintage_band = $6 OR (vintage_band IS NULL AND $6 IS NULL))
          AND cal_window = $7
      `, [
        coeffName,
        bucket.scope_level,
        bucket.msa_id,
        bucket.submarket_id,
        bucket.property_class,
        bucket.vintage_band,
        bucket.window,
      ]);

      const existing = existingResult.rows[0];
      const priorValue = existing ? existing.posterior_value : baseline;
      const nPrior = existing ? existing.n_prior + existing.n_evidence : 0;

      // Bayesian update: posterior = (prior×n_prior + evidence×n_evidence) / (n_prior + n_evidence)
      const totalN = nPrior + n_evidence;
      const posterior = (priorValue * nPrior + avgEvidence * n_evidence) / totalN;

      // Confidence band (±1 std dev of evidence values)
      const stdDev = this.stdDev(evidenceValues);
      const confidenceLow = Math.max(0, posterior - stdDev);
      const confidenceHigh = posterior + stdDev;

      if (existing) {
        // Archive old row to history
        await this.pool.query(`
          INSERT INTO traffic_calibration_history (
            coefficient_id, coefficient_name, scope_level, submarket_id,
            property_class, vintage_band, prior_value, posterior_value,
            n_prior, n_evidence, job_run_at, job_version
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, [
          existing.id, coeffName, bucket.scope_level, bucket.submarket_id,
          bucket.property_class, bucket.vintage_band,
          priorValue, existing.posterior_value,
          nPrior, existing.n_evidence, runAt, this.JOB_VERSION,
        ]);

        // Update existing row
        await this.pool.query(`
          UPDATE traffic_calibration_factors
          SET posterior_value = $1, n_prior = $2, n_evidence = $3,
              n_peer_properties = $4, confidence_low = $5, confidence_mid = $6,
              confidence_high = $7, period_end = CURRENT_DATE,
              match_tier = $8, calibration_source = $9, updated_at = NOW()
          WHERE id = $10
        `, [
          posterior, nPrior, n_evidence, n_evidence,
          confidenceLow, posterior, confidenceHigh,
          this.getMatchTier(bucket.scope_level),
          this.buildCalibrationSource(bucket),
          existing.id,
        ]);
        updated++;
      } else {
        // Create new row
        await this.pool.query(`
          INSERT INTO traffic_calibration_factors (
            coefficient_name, scope_level, msa_id, submarket_id, property_class, vintage_band,
            prior_value, posterior_value, n_prior, n_evidence, n_peer_properties,
            cal_window, match_tier, calibration_source,
            confidence_low, confidence_mid, confidence_high,
            period_end
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, CURRENT_DATE)
        `, [
          coeffName, bucket.scope_level, bucket.msa_id, bucket.submarket_id,
          bucket.property_class, bucket.vintage_band,
          baseline, posterior, 0, n_evidence, n_evidence,
          bucket.window,
          this.getMatchTier(bucket.scope_level),
          this.buildCalibrationSource(bucket),
          confidenceLow, posterior, confidenceHigh,
        ]);
        created++;
      }
    }

    return { updated, created };
  }

  // ============================================================================
  // T006: Absorption Benchmarks (per submarket/class/size_band)
  // ============================================================================

  private getSizeBand(unitCount: number): string {
    if (unitCount <= 100) return 'small';
    if (unitCount <= 300) return 'medium';
    return 'large';
  }

  private async computeAbsorptionBenchmarks(snapshots: any[]): Promise<number> {
    // Group snapshots by (submarket_id, property_class, size_band)
    const groups: Record<string, any[]> = {};

    for (const snap of snapshots) {
      if (!snap.submarket_id || !snap.derived_metrics) continue;
      const unitCount = snap.units || snap.derived_metrics?.total_units || 0;
      const sizeBand = this.getSizeBand(unitCount);
      const key = `${snap.submarket_id}||${snap.property_class || 'unknown'}||${sizeBand}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(snap);
    }

    let updated = 0;

    for (const [key, groupSnaps] of Object.entries(groups)) {
      if (groupSnaps.length < 3) continue;  // Need at least 3 properties for a benchmark

      const [submarketId, propertyClass, sizeBand] = key.split('||');

      // Compute median signing velocity curves (proxy for absorption)
      const velocityCurves: number[][] = groupSnaps
        .map(s => s.derived_metrics?.signing_velocity_24m)
        .filter((v): v is number[] => Array.isArray(v) && v.length === 24);

      if (velocityCurves.length < 3) continue;

      // Median curve (element-wise)
      const medianCurve = Array.from({ length: 24 }, (_, m) => {
        const vals = velocityCurves.map(c => c[m]).sort((a, b) => a - b);
        return vals[Math.floor(vals.length / 2)];
      });

      // Cumulative absorption curve
      const cumulativeCurve: number[] = [];
      let cumulative = 0;
      for (const v of medianCurve) {
        cumulative += v;
        cumulativeCurve.push(cumulative);
      }

      // months_to_80, months_to_90, months_to_stabilization (93%)
      const totalUnitsMedian = this.mean(groupSnaps.map(s => s.units || s.derived_metrics?.total_units || 100));
      let monthsTo80 = 24, monthsTo90 = 24, monthsToStab = 24;
      for (let m = 0; m < 24; m++) {
        const absorbedPct = cumulativeCurve[m] / totalUnitsMedian;
        if (monthsTo80 === 24 && absorbedPct >= 0.80) monthsTo80 = m + 1;
        if (monthsTo90 === 24 && absorbedPct >= 0.90) monthsTo90 = m + 1;
        if (monthsToStab === 24 && absorbedPct >= 0.93) monthsToStab = m + 1;
      }

      const curveData = {
        monthly_absorption_curve: medianCurve,
        cumulative_absorption_curve: cumulativeCurve,
        months_to_80_pct: monthsTo80,
        months_to_90_pct: monthsTo90,
        months_to_stabilization_p50: monthsToStab,
        months_to_stabilization_p25: Math.max(1, Math.round(monthsToStab * 0.75)),
        months_to_stabilization_p75: Math.round(monthsToStab * 1.35),
        size_band: sizeBand,
        concession_intensity_curve: this.defaultConcessionCurve(),
        sample_size: groupSnaps.length,
        last_updated: new Date().toISOString(),
      };

      // Persist absorption benchmark — vintage_band stores size_band as "size:small|medium|large".
      // Uses explicit SELECT+UPDATE/INSERT rather than ON CONFLICT because the table's
      // uniqueness is enforced by a COALESCE functional index (uq_tcc_scope_coalesce)
      // which PostgreSQL cannot reference directly in an ON CONFLICT clause.
      const resolvedClass = propertyClass !== 'unknown' ? propertyClass : null;
      const vintageBandForAbsorption = `size:${sizeBand}`;
      const existingAbsorption = await this.pool.query<{ id: number }>(`
        SELECT id FROM traffic_calibration_factors
        WHERE coefficient_name = 'absorption_curve'
          AND scope_level = 'submarket'
          AND (submarket_id = $1 OR (submarket_id IS NULL AND $1 IS NULL))
          AND (property_class = $2 OR (property_class IS NULL AND $2 IS NULL))
          AND (vintage_band = $3 OR (vintage_band IS NULL AND $3 IS NULL))
          AND cal_window = 'TTM'
      `, [submarketId, resolvedClass, vintageBandForAbsorption]);

      if (existingAbsorption.rows.length > 0) {
        await this.pool.query(`
          UPDATE traffic_calibration_factors
          SET curve_data = $1, n_evidence = $2, n_peer_properties = $3, updated_at = NOW()
          WHERE id = $4
        `, [
          JSON.stringify(curveData), groupSnaps.length, groupSnaps.length,
          existingAbsorption.rows[0].id,
        ]);
      } else {
        await this.pool.query(`
          INSERT INTO traffic_calibration_factors (
            coefficient_name, scope_level, submarket_id, property_class, vintage_band,
            prior_value, posterior_value, n_prior, n_evidence, n_peer_properties,
            cal_window, match_tier, calibration_source, curve_data
          ) VALUES ('absorption_curve', 'submarket', $1, $2, $3, 0, 0, 0, $4, $4, 'TTM', 'PLATFORM', $5, $6)
        `, [
          submarketId, resolvedClass, vintageBandForAbsorption, groupSnaps.length,
          this.buildCalibrationSource({ scope_level: 'submarket', submarket_id: submarketId, property_class: propertyClass }),
          JSON.stringify(curveData),
        ]);
      }

      updated++;
    }

    return updated;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private getVintageBand(yearBuilt: number | string | null): string | null {
    if (!yearBuilt) return null;
    const yr = parseInt(String(yearBuilt));
    if (isNaN(yr)) return null;
    if (yr < 1980) return 'pre_1980';
    if (yr < 2000) return '1980_2000';
    if (yr < 2015) return '2000_2015';
    return 'post_2015';
  }

  private getMatchTier(scopeLevel: string): string {
    if (scopeLevel === 'platform') return 'PLATFORM';
    return 'PLATFORM';  // Deal-level is set separately when a deal has its own rent roll
  }

  private buildCalibrationSource(bucket: Partial<BucketData>): string {
    const parts = [];
    if (bucket.submarket_id) parts.push(`submarket:${bucket.submarket_id}`);
    if (bucket.msa_id) parts.push(`msa:${bucket.msa_id}`);
    if (bucket.property_class) parts.push(`class:${bucket.property_class}`);
    if (bucket.vintage_band) parts.push(`vintage:${bucket.vintage_band}`);
    if (parts.length === 0) parts.push('platform');
    return parts.join(' | ');
  }

  private defaultConcessionCurve(): number[] {
    return [6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  }

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = this.mean(values);
    const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  private async publishCalibrationEvent(payload: {
    bucketsUpdated: number;
    bucketsCreated: number;
    propertiesProcessed: number;
    absorptionUpdated: number;
    runAt: Date;
  }): Promise<void> {
    const event: TrafficCalibrationUpdatedMessage = {
      eventId: randomUUID(),
      timestamp: payload.runAt.toISOString(),
      eventType: 'traffic.calibration.updated',
      job_version: this.JOB_VERSION,
      run_at: payload.runAt.toISOString(),
      buckets_updated: payload.bucketsUpdated,
      buckets_created: payload.bucketsCreated,
      properties_processed: payload.propertiesProcessed,
      absorption_benchmarks_updated: payload.absorptionUpdated,
    };

    try {
      await kafkaProducer.publish(KAFKA_TOPICS.TRAFFIC_CALIBRATION, event, {
        key: `calibration-${payload.runAt.toISOString()}`,
        publishedBy: 'traffic-calibration-job',
      });
      logger.info('[CalibrationJob] Published traffic.calibration.updated event');
    } catch (publishErr: unknown) {
      // Non-blocking: log and continue — calibration results are already persisted to DB
      logger.warn(
        '[CalibrationJob] Kafka publish failed (non-blocking):',
        publishErr instanceof Error ? publishErr.message : String(publishErr)
      );
    }
  }
}

// ============================================================================
// Internal types
// ============================================================================

interface EvidenceRow {
  snapshot_id: number;
  deal_id: string;
  submarket_id: string | null;
  msa_id: string | null;
  property_class: string | null;
  year_built: number | null;
  vintage_band: string | null;
  snapshot_date: Date;
  evidence: Partial<Record<CoefficientName, number>>;
}

interface BucketData {
  scope_level: 'msa' | 'submarket' | 'class' | 'vintage' | 'platform';
  msa_id: string | null;
  submarket_id: string | null;
  property_class: string | null;
  vintage_band: string | null;
  window: 'TTM' | 'PYTM' | 'TTM_24';
  rows: EvidenceRow[];
}
