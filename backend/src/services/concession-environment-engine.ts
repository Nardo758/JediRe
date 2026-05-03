/**
 * Concession Environment Sub-Engine (Task #525)
 *
 * Produces forward-looking, per-year concession assumptions for every deal
 * via a four-step formula stack:
 *
 *   Step 1 — Class Default   : concession_class_defaults.json  (class × mode)
 *   Step 2 — M05 Submarket   : traffic_calibration_factors    (sample_size ≥ 30)
 *   Step 3 — M04 Supply Pressure: supply_risk_scores          (modifier ∈ [0.5, 2.5])
 *   Step 4 — Subject History : subject_traffic_history S2+   (Y1/Y2/Y3+ weight decay)
 *
 * Mode overlays:
 *   STABILIZED    — no overlay; four-step stack applied directly.
 *   LEASE_UP      — 24-month decay curve applied per year; bounded by stabilized floor.
 *   REDEVELOPMENT — bifurcated renovated / untouched cohorts; pre-renovation retention bump.
 *
 * Output: ConcessionEnvironmentOutput written to dealContext.traffic.concession_environment.
 *
 * Event triggers (external callers should invoke computeForDeal on):
 *   traffic.subject_history.updated | m04.supply_pressure.updated |
 *   m05.submarket_concession.updated | mode.changed | capex_schedule.updated
 */

import type { Pool } from 'pg';
import type {
  ConcessionEnvironmentOutput,
  ConcessionCollision,
  ConcessionSeverity,
  ConcessionSourceBlend,
  PerYearConcessionEnv,
  ConcessionConfidence,
} from '../types/traffic-calibration.types';
import { logger } from '../utils/logger';

const CLASS_DEFAULTS = require('../data/concession_class_defaults.json');

const SUPPLY_PRESSURE_COEFF     = CLASS_DEFAULTS._meta.supply_pressure_coefficient as number;
const SUPPLY_PRESSURE_BOUNDS    = CLASS_DEFAULTS._meta.supply_pressure_bounds as [number, number];
const SUBJECT_WEIGHT_SCHEDULE   = CLASS_DEFAULTS._meta.subject_weight_schedule as Record<string, number>;
const COLLISION_SIGMA_THRESHOLDS = CLASS_DEFAULTS._meta.collision_sigma_thresholds as { minor: number; material: number };
const THIN_SUBMARKET_THRESHOLD  = CLASS_DEFAULTS._meta.thin_submarket_threshold as number;

// ── Std-dev assumption for M05 when platform distribution not yet tracked ───
// Conservative 20% of the submarket value (will be replaced by true σ when
// distribution tracking ships).
const FALLBACK_STD_DEV_FRACTION = 0.20;

// ── Lease-up mode: curve values are absolute free-months for each year ───────
// The monthly_decay_curve stores the absolute free-months offered per annual
// year, indexed by month (12 values per year, 24 total):
//   Months 1-12  → Y1 (highest concessions, absorbing new units)
//   Months 13-24 → Y2 (tapering toward stabilized floor)
//   Year 3+      → STABILIZED floor (curve exhausted)
//
// Returns the average absolute free-months for the given year.
// stabFreeMonths is used as the minimum (floor) value.
function leaseUpCurveYearValue(
  monthlyCurve: number[],
  year: number,
  stabFreeMonths: number,
): number {
  if (year >= 3 || monthlyCurve.length < 24) return stabFreeMonths;
  const startIdx   = (year - 1) * 12;
  const slice      = monthlyCurve.slice(startIdx, startIdx + 12);
  if (slice.length === 0) return stabFreeMonths;
  const avgMonthly = slice.reduce((a, b) => a + b, 0) / slice.length;
  return Math.max(stabFreeMonths, avgMonthly);
}

// ── Supply pressure modifier ─────────────────────────────────────────────────
// score ∈ [0, 1]; modifier = 1 + COEFF × (score − 0.5), clamped [0.5, 2.5]
function supplyPressureModifier(normalizedScore: number): number {
  const raw = 1 + SUPPLY_PRESSURE_COEFF * (normalizedScore - 0.5);
  return Math.max(SUPPLY_PRESSURE_BOUNDS[0], Math.min(SUPPLY_PRESSURE_BOUNDS[1], raw));
}

// ── Subject S2 weight for a given year ──────────────────────────────────────
function subjectWeightForYear(year: number, baseWeight: number): number {
  if (year === 1) return baseWeight * (SUBJECT_WEIGHT_SCHEDULE['Y1'] ?? 1.0);
  if (year === 2) return baseWeight * (SUBJECT_WEIGHT_SCHEDULE['Y2'] ?? 0.5);
  return 0;
}

// ── Confidence classification ────────────────────────────────────────────────
function classifyConfidence(
  subjectWeight: number,
  submarketSample: number | null,
  supplyScore: number | null,
): ConcessionConfidence {
  if (subjectWeight >= 0.5 && (submarketSample ?? 0) >= THIN_SUBMARKET_THRESHOLD) return 'HIGH';
  if (subjectWeight > 0 || (submarketSample ?? 0) >= THIN_SUBMARKET_THRESHOLD || supplyScore !== null) return 'MED';
  return 'LOW';
}

// ── Collision narrative templates ────────────────────────────────────────────
function collisionNarrative(
  severity: ConcessionSeverity,
  year: number,
  subjectVal: number,
  submarketVal: number,
  deltaSigma: number,
): string {
  const dir = subjectVal > submarketVal ? 'above' : 'below';
  const sev = severity === 'SEVERE' ? 'severe' : 'material';
  return (
    `Y${year} subject-history concession (${subjectVal.toFixed(2)} months free) is ${sev} divergence ` +
    `${dir} M05 submarket baseline (${submarketVal.toFixed(2)} months free) ` +
    `at ${deltaSigma.toFixed(2)}σ. ` +
    (severity === 'SEVERE'
      ? 'Manual review recommended before projections are finalized.'
      : 'Blend applied; monitor for sustained trend before overriding submarket assumptions.')
  );
}

// ============================================================================
// Main Engine
// ============================================================================

export class ConcessionEnvironmentEngine {

  constructor(private readonly pool: Pool) {}

  /**
   * Compute the full ConcessionEnvironmentOutput for a deal.
   *
   * @param dealId     UUID of the deal.
   * @param holdYears  Number of hold-period years to project (default: 5).
   */
  async computeForDeal(
    dealId: string,
    holdYears = 5,
  ): Promise<ConcessionEnvironmentOutput> {

    logger.info('[ConcessionEnv] Computing environment', { dealId, holdYears });

    // ── Load deal metadata ────────────────────────────────────────────────────
    const dealRow = await this.loadDealMeta(dealId);
    if (!dealRow) {
      logger.warn('[ConcessionEnv] Deal not found — returning empty output', { dealId });
      return this.emptyOutput(dealId, holdYears);
    }

    const { propertyClass, mode, submarketId, msaId } = dealRow;

    // ── Step 1: Class default ─────────────────────────────────────────────────
    const classEntry = this.loadClassDefault(propertyClass, mode);

    // ── Step 2: M05 submarket concession ─────────────────────────────────────
    const m05 = await this.loadSubmarketConcession(submarketId, msaId, propertyClass);

    // ── Step 3: M04 supply pressure ──────────────────────────────────────────
    const m04 = await this.loadSupplyPressure(submarketId);
    const spModifier = m04 !== null ? supplyPressureModifier(m04) : 1.0;

    // ── Step 4: Subject history S2+ ──────────────────────────────────────────
    // Mode is passed so loadSubjectS2 can enforce the mismatch rule:
    // subject data tagged with a different operating mode is rejected rather than
    // silently blended (e.g. LEASE_UP-tagged coefficients must not shift STABILIZED years).
    const subject = await this.loadSubjectS2(dealId, mode);

    // ── Build per-year outputs ────────────────────────────────────────────────
    const perYear: PerYearConcessionEnv[] = [];
    const collisions: ConcessionCollision[] = [];

    for (let year = 1; year <= holdYears; year++) {
      const result = this.resolveYear({
        year,
        classEntry,
        m05,
        spModifier,
        subject,
        mode,
        submarketSample: m05?.sample_size ?? null,
        supplyScore: m04,
        collisions,
      });
      perYear.push(result);
    }

    const output: ConcessionEnvironmentOutput = {
      deal_id:               dealId,
      mode,
      property_class:        propertyClass,
      hold_years:            holdYears,
      per_year:              perYear,
      collisions,
      computed_at:           new Date().toISOString(),
      supply_pressure_score: m04,
      submarket_sample_size: m05?.sample_size ?? null,
      subject_s2_available:  subject !== null,
    };

    logger.info('[ConcessionEnv] Computed', {
      dealId,
      mode,
      propertyClass,
      holdYears,
      collisionCount: collisions.length,
      subjectS2: subject !== null,
    });

    // ── Persist to dealContext ────────────────────────────────────────────────
    // Non-fatal: write failure must never prevent the caller from receiving output.
    await this.persistToDealContext(dealId, output);

    return output;
  }

  // ============================================================================
  // Private: Per-year resolver
  // ============================================================================

  private resolveYear(ctx: {
    year: number;
    classEntry: ClassDefaultEntry;
    m05: M05Entry | null;
    spModifier: number;
    subject: SubjectS2Data | null;
    mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT';
    submarketSample: number | null;
    supplyScore: number | null;
    collisions: ConcessionCollision[];
  }): PerYearConcessionEnv {

    const { year, classEntry, m05, spModifier, subject, mode, submarketSample, supplyScore, collisions } = ctx;

    // ── REDEVELOPMENT: bifurcated cohort path ─────────────────────────────────
    if (mode === 'REDEVELOPMENT') {
      return this.resolveRedevelopmentYear(ctx);
    }

    // ── Base value from class default ─────────────────────────────────────────
    let baseMonths = classEntry.free_months;
    let basePct    = classEntry.concession_pct;
    let classWeight = 1.0;
    let submarketWeight = 0.0;
    let subjectWeight = 0.0;

    // ── Step 2: Apply M05 submarket adjustment ────────────────────────────────
    let submarketMonths: number | null = null;
    if (m05 !== null) {
      submarketMonths = m05.free_months;
      if (m05.sample_size >= THIN_SUBMARKET_THRESHOLD) {
        // Full submarket authority
        const blend = 0.6;
        baseMonths      = blend * m05.free_months + (1 - blend) * classEntry.free_months;
        basePct         = blend * m05.concession_pct + (1 - blend) * classEntry.concession_pct;
        submarketWeight = blend;
        classWeight     = 1 - blend;
      } else {
        // Thin sample: partial blend proportional to sample_size
        const thinBlend = Math.min(0.6, m05.sample_size / THIN_SUBMARKET_THRESHOLD * 0.6);
        baseMonths      = thinBlend * m05.free_months + (1 - thinBlend) * classEntry.free_months;
        basePct         = thinBlend * m05.concession_pct + (1 - thinBlend) * classEntry.concession_pct;
        submarketWeight = thinBlend;
        classWeight     = 1 - thinBlend;
      }
    }

    // ── Step 3: Apply M04 supply-pressure modifier ────────────────────────────
    baseMonths = baseMonths * spModifier;
    basePct    = basePct    * spModifier;

    // ── Step 4: Subject history S2+ Bayesian blend ────────────────────────────
    let finalMonths = baseMonths;
    let finalPct    = basePct;

    if (subject !== null) {
      const baseSubjectWeight = subject.concession_weight;
      const yearWeight        = subjectWeightForYear(year, baseSubjectWeight);

      if (yearWeight > 0) {
        const subjectMonths = subject.free_months;
        finalMonths         = yearWeight * subjectMonths + (1 - yearWeight) * baseMonths;
        finalPct            = yearWeight * subject.concession_pct + (1 - yearWeight) * basePct;
        subjectWeight       = yearWeight;
        classWeight         = classWeight * (1 - yearWeight);
        submarketWeight     = submarketWeight * (1 - yearWeight);

        // ── Collision detection (only when M05 available) ─────────────────────
        if (submarketMonths !== null && m05 !== null) {
          const stdDev     = Math.abs(m05.free_months) * (m05.std_dev_fraction ?? FALLBACK_STD_DEV_FRACTION);
          if (stdDev > 0) {
            const deltaSigma = Math.abs(subjectMonths - m05.free_months) / stdDev;

            if (deltaSigma >= COLLISION_SIGMA_THRESHOLDS.minor) {
              const severity: ConcessionSeverity =
                deltaSigma >= COLLISION_SIGMA_THRESHOLDS.material ? 'SEVERE' : 'MATERIAL';

              collisions.push({
                year,
                subject_value_months:   subjectMonths,
                submarket_value_months: m05.free_months,
                std_dev:               parseFloat(stdDev.toFixed(4)),
                delta_sigma:           parseFloat(deltaSigma.toFixed(2)),
                severity,
                narrative: collisionNarrative(severity, year, subjectMonths, m05.free_months, deltaSigma),
              });
            } else {
              logger.debug('[ConcessionEnv] Minor collision (logged only)', {
                year, deltaSigma: deltaSigma.toFixed(2),
              });
            }
          }
        }
      }
    }

    // ── LEASE_UP overlay ──────────────────────────────────────────────────────
    // The curve values are absolute annual free-months for each year.
    // Y3+ converges to the stabilized floor (no additional overlay needed).
    // The floor is the UNADJUSTED STABILIZED class default — even in a very
    // tight supply environment, lease-up properties must offer at least the
    // stabilized floor concession to attract tenants during the absorption phase.
    // The supply-pressure modifier adjusts the curve shape but cannot push
    // concessions below the STABILIZED floor.
    if (mode === 'LEASE_UP') {
      const stabFloor    = classEntry.stab_free_months;
      const stabPctFloor = classEntry.stab_concession_pct;

      const leaseUpDecayCurve: number[] = classEntry.monthly_decay_curve ?? [];
      if (leaseUpDecayCurve.length === 24) {
        // Curve gives absolute free-months per year; apply M04 modifier and clamp to stab floor
        const curveBase = leaseUpCurveYearValue(leaseUpDecayCurve, year, classEntry.stab_free_months);
        // Blend curve base with steps 2-4 result:
        //   - If subject or submarket data is available, finalMonths already reflects their influence.
        //   - We blend: curve provides the Y-specific "shape" while steps 2-4 adjust the level.
        //   - When no external data (subject/M05 == null), finalMonths == curve base × spModifier
        //     (from step 1 class default). Re-anchor to the curve.
        const curveAdjusted = curveBase * spModifier;
        // Weight curve shape at 0.7 vs steps-2-4 result at 0.3 (curve is the primary shape signal)
        finalMonths = 0.7 * curveAdjusted + 0.3 * finalMonths;
        finalPct    = finalMonths / 12;
      } else {
        // Fallback: apply simple multipliers (no decay curve in defaults)
        const mult  = year === 1 ? 1.5 : year === 2 ? 1.2 : 1.0;
        finalMonths = finalMonths * mult;
        finalPct    = finalPct    * mult;
      }

      // Clamp to stabilized floor
      finalMonths = Math.max(stabFloor,    finalMonths);
      finalPct    = Math.max(stabPctFloor, finalPct);
    }

    // ── Clamp negatives (NaN suppression) ────────────────────────────────────
    finalMonths = isFinite(finalMonths) ? Math.max(0, finalMonths) : classEntry.stab_free_months;
    finalPct    = isFinite(finalPct)    ? Math.max(0, finalPct)    : classEntry.stab_concession_pct;

    const sourceBlend: ConcessionSourceBlend = {
      class_default_weight: parseFloat(classWeight.toFixed(4)),
      submarket_weight:     parseFloat(submarketWeight.toFixed(4)),
      subject_weight:       parseFloat(subjectWeight.toFixed(4)),
    };

    return {
      year,
      free_months:               parseFloat(finalMonths.toFixed(4)),
      concession_pct:            parseFloat(finalPct.toFixed(4)),
      supply_pressure_modifier:  parseFloat(spModifier.toFixed(4)),
      confidence:                classifyConfidence(subjectWeight, submarketSample, supplyScore),
      source_blend:              sourceBlend,
    };
  }

  // ============================================================================
  // Private: REDEVELOPMENT bifurcated cohort resolver
  // ============================================================================

  private resolveRedevelopmentYear(ctx: {
    year: number;
    classEntry: ClassDefaultEntry;
    m05: M05Entry | null;
    spModifier: number;
    subject: SubjectS2Data | null;
    submarketSample: number | null;
    supplyScore: number | null;
    collisions: ConcessionCollision[];
  }): PerYearConcessionEnv {

    const { year, classEntry, m05, spModifier, subject, submarketSample, supplyScore, collisions } = ctx;

    const redevEntry = classEntry.redevelopment;
    const renovatedBase  = redevEntry?.renovated.free_months  ?? classEntry.free_months * 1.5;
    const untouchedBase  = (redevEntry?.untouched.free_months ?? classEntry.free_months)
                          + (redevEntry?.untouched.retention_bump_months ?? 0.25);
    const renovatedPct   = redevEntry?.renovated.concession_pct  ?? classEntry.concession_pct * 1.5;
    const untouchedPct   = redevEntry?.untouched.concession_pct  ?? classEntry.concession_pct;

    // Apply M05 submarket if available
    let submarketMultiplier = 1.0;
    let submarketWeight = 0.0;
    let subjectWeight = 0.0;
    let submarketMonths: number | null = null;

    if (m05 !== null) {
      submarketMonths = m05.free_months;
      const blend = m05.sample_size >= THIN_SUBMARKET_THRESHOLD
        ? 0.6
        : Math.min(0.6, m05.sample_size / THIN_SUBMARKET_THRESHOLD * 0.6);
      submarketMultiplier = blend * (m05.free_months / Math.max(0.01, renovatedBase)) + (1 - blend) * 1.0;
      submarketWeight = blend;
    }

    let renovatedFinal = renovatedBase * submarketMultiplier * spModifier;
    let untouchedFinal = untouchedBase * (1 + (submarketMultiplier - 1) * 0.5) * spModifier;
    let concPct = ((renovatedPct + untouchedPct) / 2) * spModifier;

    // Subject S2 blend (mode-mismatch guard: S2 lease-up data does NOT apply to stabilized years)
    if (subject !== null && subject.mode !== 'LEASE_UP') {
      const baseSubjectWeight = subject.concession_weight;
      const yearWeight        = subjectWeightForYear(year, baseSubjectWeight);

      if (yearWeight > 0) {
        renovatedFinal = yearWeight * subject.free_months * 1.2 + (1 - yearWeight) * renovatedFinal;
        untouchedFinal = yearWeight * subject.free_months       + (1 - yearWeight) * untouchedFinal;
        concPct        = yearWeight * subject.concession_pct    + (1 - yearWeight) * concPct;
        subjectWeight  = yearWeight;
        submarketWeight = submarketWeight * (1 - yearWeight);

        // Collision detection on renovated cohort vs M05
        if (submarketMonths !== null && m05 !== null) {
          const stdDev     = Math.abs(m05.free_months) * (m05.std_dev_fraction ?? FALLBACK_STD_DEV_FRACTION);
          if (stdDev > 0) {
            const deltaSigma = Math.abs(subject.free_months * 1.2 - m05.free_months) / stdDev;
            if (deltaSigma >= COLLISION_SIGMA_THRESHOLDS.minor) {
              const severity: ConcessionSeverity =
                deltaSigma >= COLLISION_SIGMA_THRESHOLDS.material ? 'SEVERE' : 'MATERIAL';
              collisions.push({
                year,
                subject_value_months:   parseFloat((subject.free_months * 1.2).toFixed(4)),
                submarket_value_months: m05.free_months,
                std_dev:               parseFloat(stdDev.toFixed(4)),
                delta_sigma:           parseFloat(deltaSigma.toFixed(2)),
                severity,
                narrative: collisionNarrative(severity, year, subject.free_months * 1.2, m05.free_months, deltaSigma),
              });
            }
          }
        }
      }
    }

    // Clamp
    renovatedFinal = isFinite(renovatedFinal) ? Math.max(0, renovatedFinal) : renovatedBase;
    untouchedFinal = isFinite(untouchedFinal) ? Math.max(0, untouchedFinal) : untouchedBase;
    concPct        = isFinite(concPct)         ? Math.max(0, concPct)        : renovatedPct;

    const avgMonths = (renovatedFinal + untouchedFinal) / 2;

    const classWeight = Math.max(0, 1 - submarketWeight - subjectWeight);
    const sourceBlend: ConcessionSourceBlend = {
      class_default_weight: parseFloat(classWeight.toFixed(4)),
      submarket_weight:     parseFloat(submarketWeight.toFixed(4)),
      subject_weight:       parseFloat(subjectWeight.toFixed(4)),
    };

    return {
      year,
      free_months:               parseFloat(avgMonths.toFixed(4)),
      concession_pct:            parseFloat(concPct.toFixed(4)),
      supply_pressure_modifier:  parseFloat(spModifier.toFixed(4)),
      confidence:                classifyConfidence(subjectWeight, submarketSample, supplyScore),
      source_blend:              sourceBlend,
      renovated_free_months:     parseFloat(renovatedFinal.toFixed(4)),
      untouched_free_months:     parseFloat(untouchedFinal.toFixed(4)),
    };
  }

  // ============================================================================
  // Private: Data loaders
  // ============================================================================

  private async loadDealMeta(dealId: string): Promise<DealMeta | null> {
    try {
      const result = await this.pool.query<{
        deal_mode: string | null;
        property_class: string | null;
        submarket_id: string | null;
        msa_id: string | null;
        deal_data: any;
      }>(`
        SELECT deal_mode, property_class, submarket_id, msa_id, deal_data
        FROM deals
        WHERE id = $1
      `, [dealId]);

      if (result.rows.length === 0) return null;
      const row = result.rows[0];

      const mode = (row.deal_mode as 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT' | null)
        ?? this.inferMode(row.deal_data);

      const submarketId: string | null =
        row.submarket_id
        ?? row.deal_data?.market_intelligence?.data?.demographics?.submarket?.id
        ?? null;

      return {
        propertyClass: this.normalizeClass(row.property_class),
        mode,
        submarketId,
        msaId: row.msa_id ?? null,
      };
    } catch (err) {
      logger.error('[ConcessionEnv] Failed to load deal meta', {
        dealId, error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /** Load submarket concession intensity from traffic_calibration_factors. */
  private async loadSubmarketConcession(
    submarketId: string | null,
    msaId: string | null,
    propertyClass: string,
  ): Promise<M05Entry | null> {
    if (!submarketId && !msaId) return null;
    try {
      // Try submarket first, then MSA-level
      const scopeAttempts = [
        { scope_level: 'submarket', submarket_id: submarketId, msa_id: null as string | null },
        { scope_level: 'msa',       submarket_id: null as string | null, msa_id: msaId },
        { scope_level: 'class',     submarket_id: null as string | null, msa_id: null as string | null },
      ];

      for (const attempt of scopeAttempts) {
        if (!attempt.submarket_id && !attempt.msa_id && attempt.scope_level !== 'class') continue;
        if (attempt.scope_level === 'class' && !propertyClass) continue;

        const result = await this.pool.query<{
          curve_data: any;
          n_peer_properties: number;
          n_evidence: number;
        }>(`
          SELECT curve_data, n_peer_properties, n_evidence
          FROM traffic_calibration_factors
          WHERE coefficient_name = 'absorption_curve'
            AND scope_level = $1
            AND (submarket_id = $2 OR ($2 IS NULL AND submarket_id IS NULL))
            AND (msa_id = $3 OR ($3 IS NULL AND msa_id IS NULL))
            AND (property_class = $4 OR $1 != 'class')
          ORDER BY n_peer_properties DESC
          LIMIT 1
        `, [
          attempt.scope_level,
          attempt.submarket_id ?? null,
          attempt.msa_id ?? null,
          propertyClass || null,
        ]);

        if (result.rows.length === 0) continue;
        const row = result.rows[0];
        const curveData = row.curve_data as any;
        if (!curveData) continue;

        // concession_intensity_curve is an array of monthly free-weeks values
        const curve: number[] | null = curveData.concession_intensity_curve ?? null;
        if (!curve || curve.length === 0) continue;

        // Convert free-weeks/month to free-months/year (annualize)
        // free_months = (sum of free_weeks over 12 months) / 4.333
        const annualFreeWeeks = curve.slice(0, 12).reduce((a: number, b: number) => a + b, 0);
        const freeMonths      = annualFreeWeeks / 4.333;

        // Approximate concession_pct from freeMonths (assuming 12-month contract)
        const concessionPct = freeMonths / 12;

        return {
          free_months:    parseFloat(freeMonths.toFixed(4)),
          concession_pct: parseFloat(concessionPct.toFixed(4)),
          sample_size:    row.n_peer_properties ?? row.n_evidence ?? 0,
          std_dev_fraction: FALLBACK_STD_DEV_FRACTION,
        };
      }

      return null;
    } catch (err) {
      logger.debug('[ConcessionEnv] M05 submarket load failed (non-fatal)', {
        submarketId, error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /** Load M04 supply pressure score (normalized to [0,1]). */
  private async loadSupplyPressure(submarketId: string | null): Promise<number | null> {
    if (!submarketId) return null;
    try {
      const result = await this.pool.query<{ supply_risk_score: string }>(`
        SELECT supply_risk_score
        FROM supply_risk_scores
        WHERE submarket_id = $1
        ORDER BY updated_at DESC
        LIMIT 1
      `, [submarketId]);

      if (result.rows.length === 0) return null;
      // supply_risk_score is 0-100+ (pipeline units / existing units × 100)
      // normalize to [0, 1], clamp to avoid extreme outliers
      const raw = parseFloat(result.rows[0].supply_risk_score);
      if (!isFinite(raw)) return null;
      return Math.max(0, Math.min(1, raw / 100));
    } catch (err) {
      logger.debug('[ConcessionEnv] M04 supply pressure load failed (non-fatal)', {
        submarketId, error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Load subject S2+ concession signal from subject_traffic_history.
   *
   * Mode-mismatch enforcement: if the subject history row was recorded when the
   * deal was in a DIFFERENT operating mode than currentMode, the signal is
   * rejected entirely (returns null).  Concretely, LEASE_UP-tagged subject
   * coefficients (higher concessions, absorption-phase dynamics) must never
   * shift projections for a deal that is now STABILIZED, and vice-versa.
   *
   * Pre-v2 rows where deal_mode IS NULL are assumed to match (no rejection).
   */
  private async loadSubjectS2(
    dealId: string,
    currentMode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT',
  ): Promise<SubjectS2Data | null> {
    try {
      const result = await this.pool.query<{
        tier: string;
        current_state: any;
        observed_dynamics: any;
        confidence_weights: any;
        deal_mode: string | null;
      }>(`
        SELECT sth.tier, sth.current_state, sth.observed_dynamics, sth.confidence_weights,
               sth.deal_mode
        FROM subject_traffic_history sth
        WHERE sth.deal_id = $1
      `, [dealId]);

      if (result.rows.length === 0) return null;
      const row = result.rows[0];

      // ── Mode-mismatch guard ───────────────────────────────────────────────────
      // Reject subject data tagged with a different operating mode.
      // NULL deal_mode means pre-v2 row; pass through without rejection.
      if (row.deal_mode !== null && row.deal_mode !== currentMode) {
        logger.info('[ConcessionEnv] Subject S2 rejected — mode mismatch', {
          dealId,
          subjectMode: row.deal_mode,
          currentMode,
        });
        return null;
      }

      // Subject concession signal requires at least S2 (observed_dynamics)
      if (!row.observed_dynamics) return null;
      if (!['S2', 'S3', 'S4'].includes(row.tier)) return null;

      const cs  = row.current_state   as any;
      const cw  = row.confidence_weights as Record<string, { weight: number }> ?? {};

      // Extract concession signal: prefer concession_trend (S2), fall back to loss_to_lease
      const concWeight = cw['concession_trend']?.weight ?? cw['loss_to_lease']?.weight ?? 0;
      if (concWeight <= 0) return null;

      // Derive free_months from subject data:
      // avg_concession_value / avg_contract_rent × 12 months
      let freeMonths = 0;
      if (cs?.avg_concession_value && cs?.avg_contract_rent && cs.avg_contract_rent > 0) {
        freeMonths = (cs.avg_concession_value / cs.avg_contract_rent) * 12;
      } else if (cs?.avg_concession_value && cs?.avg_market_rent && cs.avg_market_rent > 0) {
        freeMonths = (cs.avg_concession_value / cs.avg_market_rent) * 12;
      }

      const subjectMode = (row.deal_mode as 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT' | null) ?? null;

      return {
        free_months:       parseFloat(freeMonths.toFixed(4)),
        concession_pct:    parseFloat((freeMonths / 12).toFixed(4)),
        concession_weight: concWeight,
        mode:              subjectMode,
      };
    } catch (err) {
      logger.debug('[ConcessionEnv] Subject S2 load failed (non-fatal)', {
        dealId, error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Persist the computed output to dealContext.traffic.concession_environment.
   *
   * Non-fatal: a write failure must never prevent the caller from receiving the
   * output object.  Triggers that should re-invoke computeForDeal():
   *   traffic.subject_history.updated | m04.supply_pressure.updated |
   *   m05.submarket_concession.updated | mode.changed | capex_schedule.updated
   */
  private async persistToDealContext(
    dealId: string,
    output: ConcessionEnvironmentOutput,
  ): Promise<void> {
    try {
      await this.pool.query(`
        UPDATE deals
        SET deal_data = jsonb_set(
          jsonb_set(
            COALESCE(deal_data, '{}'::jsonb),
            '{module_outputs}',
            COALESCE(deal_data->'module_outputs', '{}'::jsonb)
          ),
          '{module_outputs,traffic,concession_environment}',
          $1::jsonb
        )
        WHERE id = $2
      `, [JSON.stringify(output), dealId]);

      logger.debug('[ConcessionEnv] Persisted to dealContext', { dealId });
    } catch (err) {
      logger.warn('[ConcessionEnv] dealContext persist failed (non-fatal)', {
        dealId, error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ============================================================================
  // Private: Helpers
  // ============================================================================

  private loadClassDefault(propertyClass: string, mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT'): ClassDefaultEntry {
    const classKey = propertyClass in CLASS_DEFAULTS ? propertyClass : '_defaults_fallback';
    const modeKey  = mode in CLASS_DEFAULTS[classKey] ? mode : 'STABILIZED';
    const entry    = CLASS_DEFAULTS[classKey][modeKey] as any;
    const stabEntry = CLASS_DEFAULTS[classKey]['STABILIZED'] as any;

    return {
      free_months:         entry.free_months         ?? stabEntry.free_months     ?? 0.75,
      concession_pct:      entry.concession_pct      ?? stabEntry.concession_pct ?? 0.06,
      stab_free_months:    stabEntry.free_months     ?? 0.75,
      stab_concession_pct: stabEntry.concession_pct ?? 0.06,
      monthly_decay_curve: entry.monthly_decay_curve ?? null,
      redevelopment: mode === 'REDEVELOPMENT' ? {
        renovated: {
          free_months:    entry.renovated?.free_months    ?? stabEntry.free_months * 1.5,
          concession_pct: entry.renovated?.concession_pct ?? stabEntry.concession_pct * 1.5,
        },
        untouched: {
          free_months:             entry.untouched?.free_months             ?? stabEntry.free_months,
          concession_pct:          entry.untouched?.concession_pct          ?? stabEntry.concession_pct,
          retention_bump_months:   entry.untouched?.retention_bump_months   ?? 0.25,
        },
      } : null,
    };
  }

  private normalizeClass(raw: string | null): string {
    if (!raw) return 'B';
    const upper = raw.trim().toUpperCase().replace(/[^A-C]/g, '');
    return ['A', 'B', 'C'].includes(upper) ? upper : 'B';
  }

  private inferMode(dealData: any): 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT' {
    const projectType = dealData?.project_type as string | undefined;
    if (projectType === 'development') return 'LEASE_UP';
    if (projectType === 'redevelopment') return 'REDEVELOPMENT';
    return 'STABILIZED';
  }

  private emptyOutput(dealId: string, holdYears: number): ConcessionEnvironmentOutput {
    return {
      deal_id:               dealId,
      mode:                  'STABILIZED',
      property_class:        'B',
      hold_years:            holdYears,
      per_year:              [],
      collisions:            [],
      computed_at:           new Date().toISOString(),
      supply_pressure_score: null,
      submarket_sample_size: null,
      subject_s2_available:  false,
    };
  }
}

// ============================================================================
// Internal types (private to this module)
// ============================================================================

interface DealMeta {
  propertyClass: string;
  mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT';
  submarketId: string | null;
  msaId: string | null;
}

interface ClassDefaultEntry {
  free_months: number;
  concession_pct: number;
  /** STABILIZED class default — used as the floor for LEASE_UP clamping */
  stab_free_months: number;
  stab_concession_pct: number;
  monthly_decay_curve: number[] | null;
  redevelopment: {
    renovated:  { free_months: number; concession_pct: number };
    untouched:  { free_months: number; concession_pct: number; retention_bump_months: number };
  } | null;
}

interface M05Entry {
  free_months: number;
  concession_pct: number;
  sample_size: number;
  std_dev_fraction: number;
}

interface SubjectS2Data {
  free_months: number;
  concession_pct: number;
  concession_weight: number;
  mode: 'STABILIZED' | 'LEASE_UP' | 'REDEVELOPMENT' | null;
}
