/**
 * M07: Bayesian Coefficient Resolver
 *
 * Resolves traffic conversion coefficients via the three-layer hierarchy:
 *   DEAL (deal-specific rent roll) → PLATFORM (submarket/class/vintage bucket) → BASELINE (hard-coded)
 *
 * Returns a TrafficCoefficientFamily where each coefficient includes its
 * resolved value, match_tier, and confidence_band.
 *
 * This is the engine's integration point for the Bayesian calibration stack.
 */

import type { Pool } from 'pg';
import type {
  LayeredValue,
  TrafficCoefficientFamily,
  CalibrationMeta,
  MatchTier,
  CalibrationWindow,
} from '../types/traffic-calibration.types';
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
   * Lookup order:
   *   1. Deal-specific derived coefficients (from latest rent roll snapshot)
   *   2. Platform bucket: most specific (submarket + class + vintage) → MSA → platform
   *   3. Baseline hard-coded constants
   */
  async resolveForDeal(
    dealId: string | null,
    submarketId: string | null,
    propertyClass: string | null,
    yearBuilt: number | null,
    msaId: string | null = null,
  ): Promise<ResolvedCoefficients> {

    const vintageBand = this.getVintageBand(yearBuilt);

    // Try Deal-level first (from most recent derived snapshot)
    const dealCoefficients = await this.loadDealCoefficients(dealId);

    // Try Platform-level (buckets: submarket→msa→platform)
    const platformCoefficients = await this.loadPlatformCoefficients(
      submarketId, propertyClass, vintageBand, msaId
    );

    // Build the family
    const family = {} as TrafficCoefficientFamily;
    let overallMatchTier: MatchTier = 'BASELINE';
    let nPeerProperties = 0;
    let window: CalibrationWindow = 'TTM';
    let calibrationSource = 'baseline';

    for (const name of ALL_COEFFICIENTS) {
      const baseline = BASELINE_COEFFICIENTS[name];
      const dealVal = dealCoefficients?.[name] ?? null;
      const platformEntry = platformCoefficients?.[name] ?? null;

      let resolved: number;
      let matchTier: MatchTier;
      let resolvedWindow: CalibrationWindow = 'TTM';
      let resolvedN = 0;

      if (dealVal !== null) {
        resolved = dealVal;
        matchTier = 'DEAL';
        overallMatchTier = 'DEAL';
      } else if (platformEntry !== null) {
        resolved = platformEntry.value;
        matchTier = 'PLATFORM';
        resolvedWindow = platformEntry.window;
        resolvedN = platformEntry.n_peer_properties;
        if (overallMatchTier === 'BASELINE') overallMatchTier = 'PLATFORM';
        if (resolvedN > nPeerProperties) {
          nPeerProperties = resolvedN;
          window = resolvedWindow;
          calibrationSource = platformEntry.source;
        }
      } else {
        resolved = baseline;
        matchTier = 'BASELINE';
      }

      (family as any)[name] = {
        baseline,
        platform: platformEntry?.value ?? null,
        deal: dealVal,
        resolved,
        match_tier: matchTier,
        window: resolvedWindow,
        n_peer_properties: resolvedN,
      } as LayeredValue;
    }

    // Build confidence band from the platform entry (or baseline defaults)
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
    };

    return { family, meta };
  }

  /**
   * Extract deal-level coefficient overrides from the most recent derived rent roll snapshot.
   * Returns null if no rent roll has been uploaded for this deal.
   */
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

      // Derive proxies from derived metrics (same logic as calibration job)
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
      logger.debug('[CoefficientResolver] Could not load deal coefficients', { dealId, error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  /**
   * Load platform-level coefficients from traffic_calibration_factors,
   * falling back from most specific scope to most general.
   */
  private async loadPlatformCoefficients(
    submarketId: string | null,
    propertyClass: string | null,
    vintageBand: string | null,
    msaId: string | null = null,
  ): Promise<Record<CoefficientName, PlatformEntry> | null> {
    // Note: no early-return when both geo IDs are null.
    // The submarket/msa-scoped attempts will simply return 0 rows in that case,
    // and execution continues through to class / vintage / platform tiers —
    // which are geo-independent and must remain reachable for this fallback to work.
    try {
      // Degradation hierarchy per spec:
      //   submarket+class+vintage → submarket+class → submarket
      //   → MSA+class → class (first-class) → vintage (first-class) → platform
      const scopeAttempts: Array<{
        scope_level: string;
        submarket_id: string | null;
        property_class: string | null;
        vintage_band: string | null;
        msa_id: string | null;
      }> = [
        // Most specific: submarket + class + vintage
        { scope_level: 'submarket', submarket_id: submarketId, property_class: propertyClass, vintage_band: vintageBand, msa_id: null },
        // Submarket + class only
        { scope_level: 'submarket', submarket_id: submarketId, property_class: propertyClass, vintage_band: null, msa_id: null },
        // Submarket only (drop class)
        { scope_level: 'submarket', submarket_id: submarketId, property_class: null, vintage_band: null, msa_id: null },
        // MSA + class
        { scope_level: 'msa', submarket_id: null, property_class: propertyClass, vintage_band: null, msa_id: msaId },
        // Class scope — cross-MSA platform data sliced by property class
        { scope_level: 'class', submarket_id: null, property_class: propertyClass, vintage_band: null, msa_id: null },
        // Vintage scope — cross-MSA platform data sliced by vintage band
        { scope_level: 'vintage', submarket_id: null, property_class: null, vintage_band: vintageBand, msa_id: null },
        // Platform level (global fallback — all nulls)
        { scope_level: 'platform', submarket_id: null, property_class: null, vintage_band: null, msa_id: null },
      ];

      // Window priority: TTM (primary) → TTM_24 (sparse fallback) → PYTM (comparison)
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

          // Only use this scope+window if we have at least 2 coefficients
          if (Object.keys(entries).length >= 2) {
            return entries as Record<CoefficientName, PlatformEntry>;
          }
        }
      }

      return null;
    } catch (err: unknown) {
      logger.debug('[CoefficientResolver] Platform coefficient lookup failed', { error: err instanceof Error ? err.message : String(err) });
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
