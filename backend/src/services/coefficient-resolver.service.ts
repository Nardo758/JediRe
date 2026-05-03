/**
 * M07: Bayesian Coefficient Resolver
 *
 * Resolves traffic conversion coefficients via the four-layer hierarchy:
 *   SUBJECT (subject_traffic_history ≥S1) → DEAL (deal rent roll) → PLATFORM → BASELINE
 *
 * Subject layer uses a Bayesian blend:
 *   w_subject = min(1, n_observations / n_required)
 *   effective = w_subject × subject_value + (1 − w_subject) × peer_value
 *
 * Returns a TrafficCoefficientFamily where each coefficient includes its
 * resolved value, match_tier, subject_weight, and confidence metadata.
 */

import type { Pool } from 'pg';
import type {
  LayeredValue,
  TrafficCoefficientFamily,
  CalibrationMeta,
  MatchTier,
  CalibrationWindow,
  SubjectTrafficHistory,
} from '../types/traffic-calibration.types';
import { SUBJECT_N_REQUIRED } from '../types/traffic-calibration.types';
import { BASELINE_COEFFICIENTS } from '../jobs/trafficCalibrationJob';
import { logger } from '../utils/logger';

type CoefficientName = keyof typeof BASELINE_COEFFICIENTS;
const ALL_COEFFICIENTS = Object.keys(BASELINE_COEFFICIENTS) as CoefficientName[];

export interface ResolvedCoefficients {
  family: TrafficCoefficientFamily;
  meta: CalibrationMeta;
}

export class CoefficientResolverService {

  constructor(private readonly pool: Pool) {}

  /**
   * Resolve all coefficients for a deal + submarket context.
   *
   * Lookup order (highest to lowest authority):
   *   1. Subject history (S1/S2) — Bayesian blend with peer value
   *   2. Deal-specific derived coefficients (from latest rent roll snapshot)
   *   3. Platform bucket: most specific → MSA → platform
   *   4. Baseline hard-coded constants
   */
  async resolveForDeal(
    dealId: string | null,
    submarketId: string | null,
    propertyClass: string | null,
    yearBuilt: number | null,
    msaId: string | null = null,
  ): Promise<ResolvedCoefficients> {

    const vintageBand = this.getVintageBand(yearBuilt);

    // Layer 1: Subject history (highest priority — subject's own property data)
    const subjectHistory = await this.loadSubjectHistory(dealId);

    // Layer 2: Deal-level derived coefficients from most recent snapshot
    const dealCoefficients = await this.loadDealCoefficients(dealId);

    // Layer 3: Platform-level coefficients
    const platformCoefficients = await this.loadPlatformCoefficients(
      submarketId, propertyClass, vintageBand, msaId
    );

    // Derive coefficient proxies from subject history (same formula as deal coefficients)
    const subjectCoefficients = this.deriveSubjectCoefficients(subjectHistory);

    // Build the family
    const family = {} as TrafficCoefficientFamily;
    let overallMatchTier: MatchTier = 'BASELINE';
    let nPeerProperties = 0;
    let window: CalibrationWindow = 'TTM';
    let calibrationSource = 'baseline';

    // Accumulate peer collisions for this resolution pass
    const peerCollisions: Array<{ coefficient: string; subject_value: number; peer_value: number; sigma_deviation: number }> = [];

    for (const name of ALL_COEFFICIENTS) {
      const baseline    = BASELINE_COEFFICIENTS[name];
      const dealVal     = dealCoefficients?.[name]    ?? null;
      const platformEntry = platformCoefficients?.[name] ?? null;
      const subjectVal  = subjectCoefficients?.[name] ?? null;

      // Determine peer value (deal > platform > baseline)
      let peerValue: number;
      let peerTier: MatchTier;
      let resolvedWindow: CalibrationWindow = 'TTM';
      let resolvedN = 0;

      if (dealVal !== null) {
        peerValue = dealVal;
        peerTier  = 'DEAL';
      } else if (platformEntry !== null) {
        peerValue = platformEntry.value;
        peerTier  = 'PLATFORM';
        resolvedWindow = platformEntry.window;
        resolvedN = platformEntry.n_peer_properties;
      } else {
        peerValue = baseline;
        peerTier  = 'BASELINE';
      }

      // Apply Bayesian blend if subject history available
      let resolved: number;
      let matchTier: MatchTier;
      let subjectWeight: number | null = null;

      if (subjectVal !== null && subjectHistory !== null) {
        const weightEntry = subjectHistory.confidence_weights[name];
        const w = weightEntry
          ? weightEntry.weight
          : Math.min(1, (subjectHistory.snapshot_count) / (SUBJECT_N_REQUIRED[name] ?? 6));

        if (w > 0) {
          resolved     = w * subjectVal + (1 - w) * peerValue;
          matchTier    = 'SUBJECT';
          subjectWeight = w;
          overallMatchTier = 'SUBJECT';

          // Detect peer collision (|subject − peer| > 1.5σ heuristic — peer σ ≈ 15% of peerValue)
          const peerSigma = Math.abs(peerValue) * 0.15;
          if (peerSigma > 0) {
            const sigmaDeviation = Math.abs(subjectVal - peerValue) / peerSigma;
            if (sigmaDeviation > 1.5) {
              peerCollisions.push({
                coefficient:     name,
                subject_value:   subjectVal,
                peer_value:      peerValue,
                sigma_deviation: parseFloat(sigmaDeviation.toFixed(2)),
              });
            }
          }
        } else {
          resolved  = peerValue;
          matchTier = peerTier;
        }
      } else {
        resolved  = peerValue;
        matchTier = peerTier;
      }

      // Track overall tier and meta (prefer most specific peer context for display)
      if (overallMatchTier !== 'SUBJECT') {
        if (matchTier === 'DEAL')     overallMatchTier = 'DEAL';
        else if (matchTier === 'PLATFORM' && overallMatchTier === 'BASELINE') overallMatchTier = 'PLATFORM';
      }
      if (resolvedN > nPeerProperties) {
        nPeerProperties = resolvedN;
        window = resolvedWindow;
        calibrationSource = platformEntry?.source ?? calibrationSource;
      }

      (family as any)[name] = {
        baseline,
        platform:       platformEntry?.value ?? null,
        deal:           dealVal,
        subject:        subjectVal,
        resolved,
        match_tier:     matchTier,
        window:         resolvedWindow,
        n_peer_properties: resolvedN,
        subject_weight: subjectWeight,
      } as LayeredValue;
    }

    // Persist updated peer collisions back to subject_traffic_history (fire-and-forget)
    if (dealId && subjectHistory && peerCollisions.length > 0) {
      this.pool.query(
        `UPDATE subject_traffic_history
            SET peer_collisions = $1, updated_at = NOW()
          WHERE deal_id = $2`,
        [JSON.stringify(peerCollisions), dealId],
      ).catch(err => logger.debug('[CoefficientResolver] Peer collision persist failed', { err }));
    }

    // Build confidence band
    const sampleCoeff = platformCoefficients?.['walkin_to_tour'];
    const mid = (family.walkin_to_tour as LayeredValue).resolved;
    const confidenceBand = sampleCoeff
      ? { low: sampleCoeff.confidence_low, mid, high: sampleCoeff.confidence_high }
      : { low: mid * 0.85, mid, high: mid * 1.15 };

    const meta: CalibrationMeta = {
      match_tier: overallMatchTier,
      window,
      calibration_source: calibrationSource,
      n_peer_properties: nPeerProperties,
      confidence_band: confidenceBand,
      coefficients: family,
      subject_history_tier: subjectHistory?.tier ?? undefined,
    };

    return { family, meta };
  }

  // ============================================================================
  // Private: Subject History loader
  // ============================================================================

  /**
   * Load subject_traffic_history for a deal.  Returns null if no history exists
   * or if the tier is below S1 (which should not happen, but is defensive).
   */
  private async loadSubjectHistory(
    dealId: string | null,
  ): Promise<SubjectTrafficHistory | null> {
    if (!dealId) return null;
    try {
      const result = await this.pool.query<{
        id: number;
        deal_id: string;
        tier: string;
        snapshot_count: number;
        coverage_months: string | null;
        current_state: any;
        observed_dynamics: any;
        confidence_weights: any;
        peer_collisions: any;
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT id, deal_id, tier, snapshot_count, coverage_months,
                current_state, observed_dynamics, confidence_weights, peer_collisions,
                created_at, updated_at
           FROM subject_traffic_history
          WHERE deal_id = $1`,
        [dealId],
      );

      if (result.rows.length === 0) return null;
      const row = result.rows[0];

      return {
        id:                row.id,
        deal_id:           row.deal_id,
        tier:              row.tier as 'S1' | 'S2' | 'S3' | 'S4',
        snapshot_count:    row.snapshot_count,
        coverage_months:   row.coverage_months ? parseFloat(row.coverage_months) : null,
        current_state:     row.current_state    ?? null,
        observed_dynamics: row.observed_dynamics ?? null,
        confidence_weights: row.confidence_weights ?? {},
        peer_collisions:   row.peer_collisions   ?? [],
        created_at:        row.created_at,
        updated_at:        row.updated_at,
      };
    } catch (err: unknown) {
      logger.debug('[CoefficientResolver] Could not load subject history', {
        dealId, error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Derive coefficient proxies from subject_traffic_history using the same
   * formula as loadDealCoefficients(), but sourcing data from subject history
   * current_state (S1+) and observed_dynamics (S2+).
   */
  private deriveSubjectCoefficients(
    history: SubjectTrafficHistory | null,
  ): Partial<Record<CoefficientName, number>> | null {
    if (!history) return null;

    const cs  = history.current_state;
    const dyn = history.observed_dynamics;

    if (!cs) return null;

    const proxies: Partial<Record<CoefficientName, number>> = {};

    // walkin_to_tour ← signing_velocity (S1+ or S2)
    const sv = dyn?.signing_velocity ?? cs.signing_velocity;
    if (sv != null && sv > 0) {
      proxies.walkin_to_tour = Math.min(0.9, Math.max(0.1, sv / 10));
    }

    // stop_probability ← days_vacant_median (S2) or inferred from occupancy (S1)
    if (dyn?.days_vacant_median != null && dyn.days_vacant_median > 0) {
      proxies.stop_probability = Math.min(0.5, Math.max(0.05,
        0.15 * (30 / dyn.days_vacant_median)));
    }

    // app_to_signed ← renewal_rate (S2)
    if (dyn?.renewal_rate != null) {
      proxies.app_to_signed = Math.min(0.95, Math.max(0.3,
        0.5 + dyn.renewal_rate * 0.3));
    }

    // apartment_seeker_pct ← concession signal (S1 avg_concession_value or S2 concession_trend)
    if (cs.avg_concession_value != null) {
      const concFreeWeeks = cs.avg_concession_value / Math.max(1, cs.avg_contract_rent ?? 1) * 52;
      proxies.apartment_seeker_pct = concFreeWeeks > 4
        ? 0.015
        : concFreeWeeks < 1
          ? 0.025
          : BASELINE_COEFFICIENTS.apartment_seeker_pct;
    }

    return Object.keys(proxies).length > 0 ? proxies : null;
  }

  // ============================================================================
  // Private: Deal coefficients (from most recent derived snapshot)
  // ============================================================================

  private async loadDealCoefficients(
    dealId: string | null,
  ): Promise<Partial<Record<CoefficientName, number>> | null> {
    if (!dealId) return null;
    try {
      const result = await this.pool.query<any>(`
        SELECT derived_metrics
        FROM rent_roll_snapshots
        WHERE deal_id = $1 AND status IN ('derived', 'calibrated')
        ORDER BY snapshot_date DESC
        LIMIT 1
      `, [dealId]);

      if (result.rows.length === 0) return null;

      const derived = result.rows[0].derived_metrics;
      if (!derived || !derived.unit_type_breakdown?.length) return null;

      const allUnitTypes = derived.unit_type_breakdown;
      const avgSigningVelocity = this.mean(allUnitTypes.map((u: any) => u.signing_velocity));
      const avgDaysVacant = this.mean(allUnitTypes.map((u: any) => u.days_vacant_avg).filter((d: number) => d > 0));
      const avgConcession = this.mean(allUnitTypes.map((u: any) => u.concession_intensity));
      const renewalRate = derived.renewal_rate_proxy ?? 0.5;

      if (avgSigningVelocity <= 0) return null;

      return {
        walkin_to_tour: Math.min(0.9, Math.max(0.1, avgSigningVelocity / 10)),
        stop_probability: avgDaysVacant > 0
          ? Math.min(0.5, Math.max(0.05, 0.15 * (30 / avgDaysVacant)))
          : BASELINE_COEFFICIENTS.stop_probability,
        app_to_signed: Math.min(0.95, Math.max(0.3, 0.5 + renewalRate * 0.3)),
        apartment_seeker_pct: avgConcession > 4 ? 0.015 : avgConcession < 1 ? 0.025 : BASELINE_COEFFICIENTS.apartment_seeker_pct,
      };
    } catch (err: unknown) {
      logger.debug('[CoefficientResolver] Could not load deal coefficients', {
        dealId, error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  // ============================================================================
  // Private: Platform coefficients
  // ============================================================================

  private async loadPlatformCoefficients(
    submarketId: string | null,
    propertyClass: string | null,
    vintageBand: string | null,
    msaId: string | null = null,
  ): Promise<Record<CoefficientName, PlatformEntry> | null> {
    try {
      const scopeAttempts: Array<{
        scope_level: string;
        submarket_id: string | null;
        property_class: string | null;
        vintage_band: string | null;
        msa_id: string | null;
      }> = [
        { scope_level: 'submarket', submarket_id: submarketId, property_class: propertyClass, vintage_band: vintageBand, msa_id: null },
        { scope_level: 'submarket', submarket_id: submarketId, property_class: propertyClass, vintage_band: null, msa_id: null },
        { scope_level: 'submarket', submarket_id: submarketId, property_class: null, vintage_band: null, msa_id: null },
        { scope_level: 'msa', submarket_id: null, property_class: propertyClass, vintage_band: null, msa_id: msaId },
        { scope_level: 'class', submarket_id: null, property_class: propertyClass, vintage_band: null, msa_id: null },
        { scope_level: 'vintage', submarket_id: null, property_class: null, vintage_band: vintageBand, msa_id: null },
        { scope_level: 'platform', submarket_id: null, property_class: null, vintage_band: null, msa_id: null },
      ];

      const WINDOW_PRIORITY: CalibrationWindow[] = ['TTM', 'TTM_24', 'PYTM'];

      for (const attempt of scopeAttempts) {
        for (const window of WINDOW_PRIORITY) {
          const result = await this.pool.query<{
            coefficient_name: string;
            posterior_value: string;
            n_peer_properties: number;
            cal_window: string;
            confidence_low: string;
            confidence_mid: string;
            confidence_high: string;
            calibration_source: string;
          }>(`
            SELECT coefficient_name, posterior_value, n_peer_properties, cal_window,
                   confidence_low, confidence_mid, confidence_high,
                   calibration_source, scope_level, submarket_id, property_class, vintage_band
            FROM traffic_calibration_factors
            WHERE scope_level = $1
              AND (submarket_id = $2 OR ($2 IS NULL AND submarket_id IS NULL))
              AND (property_class = $3 OR ($3 IS NULL AND property_class IS NULL))
              AND (vintage_band = $4 OR ($4 IS NULL AND vintage_band IS NULL))
              AND (msa_id = $5 OR ($5 IS NULL AND msa_id IS NULL))
              AND coefficient_name != 'absorption_curve'
              AND cal_window = $6
            ORDER BY n_peer_properties DESC
          `, [attempt.scope_level, attempt.submarket_id, attempt.property_class, attempt.vintage_band, attempt.msa_id, window]);

          if (result.rows.length === 0) continue;

          const entries: Record<string, PlatformEntry> = {};
          for (const row of result.rows) {
            entries[row.coefficient_name] = {
              value: parseFloat(row.posterior_value),
              n_peer_properties: row.n_peer_properties,
              window: row.cal_window as CalibrationWindow,
              source: row.calibration_source || '',
              confidence_low: parseFloat(row.confidence_low) || 0,
              confidence_high: parseFloat(row.confidence_high) || 0,
            };
          }

          if (Object.keys(entries).length >= 2) {
            return entries as Record<CoefficientName, PlatformEntry>;
          }
        }
      }

      return null;
    } catch (err: unknown) {
      logger.debug('[CoefficientResolver] Platform coefficient lookup failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  private getVintageBand(yearBuilt: number | null): string | null {
    if (!yearBuilt) return null;
    if (yearBuilt < 1980) return 'pre_1980';
    if (yearBuilt < 2000) return '1980_2000';
    if (yearBuilt < 2015) return '2000_2015';
    return 'post_2015';
  }

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

interface PlatformEntry {
  value: number;
  n_peer_properties: number;
  window: CalibrationWindow;
  source: string;
  confidence_low: number;
  confidence_high: number;
}
