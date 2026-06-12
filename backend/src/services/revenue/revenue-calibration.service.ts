/**
 * revenue-calibration.service.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Learns CONFIG overrides for the revenue beat-plan engine from:
 *   • deal_monthly_actuals  — owned-asset performance archive (Highlands)
 *   • archive_assumption_benchmarks — cross-portfolio percentile benchmarks
 *
 * Computed params are persisted in revenue_engine_calibration and loaded by
 * the beat-plan route at request time.  Hardcoded CONFIG constants remain
 * as fallback for properties with < MIN_MONTHS_REQUIRED of actuals.
 *
 * Calibration logic (deterministic, no ML):
 *
 *  vacancyElasticity
 *    Default 0.9 penalises pushing above market linearly.  If the property's
 *    actual vacancy rate is materially better than the archive peer median
 *    (Class B, existing), the demand/supply balance supports a softer penalty.
 *    Calibrated = clamp(default × (actualVacancy / benchmarkVacancy), 0.4, 0.9)
 *
 *  controllableFractionDefault
 *    Default 0.60 assumes a manager can claw back 60 % of a controllable line
 *    overrun.  Using Highlands monthly bud-vs-actuals for repairs + payroll
 *    (the only lines with both columns populated), we measure what fraction of
 *    the overrun actually narrowed the following month.  Persistently sticky
 *    overruns → lower fraction.
 *    Calibrated = clamp(mean monthly recovery fraction, 0.30, 0.65)
 *
 *  renewalCapFraction
 *    Default 0.55 caps renewal captures at 55 % of the market gap.  Archive
 *    concession_pct benchmarks (Class B, existing) tell us the typical
 *    concession a new lease receives vs a renewal.  A lower concession median
 *    means renewals are being pushed harder → higher cap.
 *    Calibrated = clamp(1 − concession_p50_new, 0.45, 0.70)
 *
 *  rentRunwayFullBps
 *    Default 250 bps.  Archive annual_rent_growth_pct p50 gives the typical
 *    rent-growth environment for Class B existing deals, expressed in bps.
 *    Using this as the "full tailwind" reference makes the signal score
 *    consistent with what the local market historically supports.
 *    Calibrated = clamp(archive_p50_bps, 150, 400)
 *
 *  pushAboveMarketCeiling
 *    Default 0.06.  Kept at default when no strong actuals signal exists;
 *    tightened when actual vacancy rate exceeds the benchmark (risk guard).
 */

import { query } from '../../database/connection';
import { clamp } from './revenue-engine.service';
import { logger } from '../../utils/logger';

export const MIN_MONTHS_REQUIRED = 6;

export interface CalibratedConfig {
  vacancyElasticity:        number;
  controllableFractionDefault: number;
  renewalCapFraction:       number;
  rentRunwayFullBps:        number;
  pushAboveMarketCeiling:   number;
  monthsOfActuals:          number;
  calibratedAt:             string;
  notes:                    string[];
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function fetchActualsStats(
  propertyId: string,
): Promise<{ months: number; avgVacancyRate: number; hasBudgetComparison: boolean } | null> {
  const statsRes = await query(
    `SELECT
       COUNT(*)                                                               AS months,
       AVG(
         CASE WHEN gross_potential_rent > 0
              THEN ABS(vacancy_loss) / gross_potential_rent END
       )                                                                      AS avg_vacancy_rate
     FROM deal_monthly_actuals
     WHERE property_id = $1
       AND is_portfolio_asset = TRUE
       AND is_budget         = FALSE
       AND is_proforma       = FALSE`,
    [propertyId],
  );

  const row = statsRes.rows[0] as any;
  if (!row || parseInt(row.months, 10) === 0) return null;

  const months        = parseInt(row.months, 10);
  const avgVacancyRate = parseFloat(row.avg_vacancy_rate ?? '0') || 0;

  // Check whether any budget rows exist for the monthly bud-vs-actuals path
  const budRes = await query(
    `SELECT COUNT(*) AS cnt FROM deal_monthly_actuals
     WHERE property_id = $1 AND is_portfolio_asset = TRUE AND is_budget = TRUE`,
    [propertyId],
  );
  const hasBudgetComparison = parseInt((budRes.rows[0] as any)?.cnt ?? '0', 10) > 0;

  return { months, avgVacancyRate, hasBudgetComparison };
}

/**
 * Compute the mean fraction of a controllable overrun that actually narrowed
 * month-over-month, using repairs_maintenance + payroll (the two lines that
 * have both actuals and budget data in Highlands).
 *
 * For each month pair (t, t+1) where month t has act > bud:
 *   recovery fraction = clamp( (act_t − act_{t+1}) / (act_t − bud_t), 0, 1 )
 * Average across all qualified pairs.  Falls back to CONFIG default when
 * insufficient pairs.
 */
async function computeControllableFraction(propertyId: string): Promise<number | null> {
  const res = await query(
    `SELECT
       a.report_month,
       COALESCE(a.repairs_maintenance, 0) AS act_repair,
       COALESCE(b.repairs_maintenance, 0) AS bud_repair,
       COALESCE(a.payroll,             0) AS act_payroll,
       COALESCE(b.payroll,             0) AS bud_payroll
     FROM deal_monthly_actuals a
     JOIN deal_monthly_actuals b
          ON b.report_month    = a.report_month
         AND b.property_id     = a.property_id
         AND b.is_portfolio_asset = TRUE
         AND b.is_budget       = TRUE
     WHERE a.property_id       = $1
       AND a.is_portfolio_asset = TRUE
       AND a.is_budget         = FALSE
       AND a.is_proforma       = FALSE
     ORDER BY a.report_month ASC`,
    [propertyId],
  );

  const rows = res.rows as any[];
  if (rows.length < 4) return null;

  // Build month-over-month recovery fractions
  const fractions: number[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const curr = rows[i];
    const next = rows[i + 1];

    // Repairs
    const repairOver = parseFloat(curr.act_repair) - parseFloat(curr.bud_repair);
    if (repairOver > 50 && parseFloat(curr.bud_repair) > 0) {
      const delta = parseFloat(curr.act_repair) - parseFloat(next.act_repair);
      fractions.push(clamp(delta / repairOver, 0, 1));
    }

    // Payroll
    const payrollOver = parseFloat(curr.act_payroll) - parseFloat(curr.bud_payroll);
    if (payrollOver > 100 && parseFloat(curr.bud_payroll) > 0) {
      const delta = parseFloat(curr.act_payroll) - parseFloat(next.act_payroll);
      fractions.push(clamp(delta / payrollOver, 0, 1));
    }
  }

  if (fractions.length < 3) return null;
  const mean = fractions.reduce((a, b) => a + b, 0) / fractions.length;
  return clamp(mean, 0.30, 0.65);
}

/**
 * Pull the benchmarks we need from archive_assumption_benchmarks.
 * Uses Class B / existing as the reference cohort for Highlands (Class B,
 * existing multifamily in Atlanta).  Falls back to combined B rows when
 * the deal_type filter reduces sample count below usable levels.
 */
async function fetchArchiveBenchmarks(): Promise<{
  vacancyBenchmark:   number | null;
  rentGrowthBps:      number | null;
  concessionP50:      number | null;
}> {
  const res = await query(
    `SELECT assumption_name,
            p50,
            n_samples
     FROM archive_assumption_benchmarks
     WHERE asset_class = 'B'
       AND assumption_name IN (
         'assumptions_growth_vacancy_stabilized',
         'annual_rent_growth_pct',
         'concessions_pct'
       )
     ORDER BY assumption_name, n_samples DESC`,
  );

  const rows = res.rows as any[];

  // Pick the row with highest n_samples for each assumption_name
  const byName: Record<string, number> = {};
  for (const r of rows) {
    const name = r.assumption_name as string;
    if (!(name in byName)) {
      byName[name] = parseFloat(r.p50 ?? '0') || 0;
    }
  }

  const rawVacancy    = byName['assumptions_growth_vacancy_stabilized'] ?? null;
  const rawRentGrowth = byName['annual_rent_growth_pct']                ?? null;
  const rawConcession = byName['concessions_pct']                       ?? null;

  // assumptions_growth_vacancy_stabilized p50 = 0.05 (stored as decimal fraction)
  const vacancyBenchmark = rawVacancy != null ? rawVacancy : null;

  // annual_rent_growth_pct p50 = 3 (stored as whole percent, e.g. 3 = 3%).
  // Convert to bps: 3 × 100 = 300.  But if stored as 0.03, multiply by 10000.
  let rentGrowthBps: number | null = null;
  if (rawRentGrowth != null) {
    rentGrowthBps = rawRentGrowth > 1
      ? rawRentGrowth * 100          // stored as whole %, e.g. 3 → 300 bps
      : rawRentGrowth * 10_000;      // stored as decimal, e.g. 0.03 → 300 bps
  }

  const concessionP50 = rawConcession != null ? rawConcession : null;

  return { vacancyBenchmark, rentGrowthBps, concessionP50 };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run calibration for a given property and persist the result.
 * Idempotent — call as often as needed (nightly Inngest cron or manual trigger).
 * Returns null when fewer than MIN_MONTHS_REQUIRED months of actuals exist.
 */
export async function calibrateProperty(
  propertyId: string,
): Promise<CalibratedConfig | null> {
  const actualsStats = await fetchActualsStats(propertyId);
  if (!actualsStats || actualsStats.months < MIN_MONTHS_REQUIRED) {
    logger.info(`[revenue-calibration] ${propertyId}: only ${actualsStats?.months ?? 0} months — skipping (need ${MIN_MONTHS_REQUIRED})`);
    return null;
  }

  const [archiveBenchmarks, controllableFrac] = await Promise.all([
    fetchArchiveBenchmarks(),
    actualsStats.hasBudgetComparison ? computeControllableFraction(propertyId) : Promise.resolve(null),
  ]);

  const { vacancyBenchmark, rentGrowthBps, concessionP50 } = archiveBenchmarks;

  const notes: string[] = [];

  // ── vacancyElasticity ────────────────────────────────────────────────────
  const DEFAULT_ELASTICITY = 0.9;
  let vacancyElasticity = DEFAULT_ELASTICITY;
  if (vacancyBenchmark != null && vacancyBenchmark > 0) {
    vacancyElasticity = clamp(
      DEFAULT_ELASTICITY * (actualsStats.avgVacancyRate / vacancyBenchmark),
      0.40,
      0.90,
    );
    notes.push(
      `vacancyElasticity: ${vacancyElasticity.toFixed(3)} ` +
      `(actual ${(actualsStats.avgVacancyRate * 100).toFixed(1)}% vs ` +
      `benchmark ${(vacancyBenchmark * 100).toFixed(1)}%)`,
    );
  } else {
    notes.push('vacancyElasticity: held at default (no benchmark)');
  }

  // ── controllableFractionDefault ──────────────────────────────────────────
  const DEFAULT_CTRL = 0.60;
  const controllableFractionDefault = controllableFrac ?? DEFAULT_CTRL;
  notes.push(
    controllableFrac != null
      ? `controllableFractionDefault: ${controllableFractionDefault.toFixed(3)} (learned from ${actualsStats.months} months bud-vs-actuals)`
      : `controllableFractionDefault: ${DEFAULT_CTRL} (no budget comparison — default retained)`,
  );

  // ── renewalCapFraction ───────────────────────────────────────────────────
  // renewalCapFraction = fraction of gap a renewal can capture vs a new lease.
  // If new-lease concessions are low (e.g. 4% of rent), renewals can push almost
  // as hard → higher cap.  Formula: clamp(1 − concession_p50, 0.45, 0.70).
  const DEFAULT_RENEWAL_CAP = 0.55;
  let renewalCapFraction = DEFAULT_RENEWAL_CAP;
  if (concessionP50 != null) {
    const concessFrac = concessionP50 > 1 ? concessionP50 / 100 : concessionP50;
    renewalCapFraction = clamp(1 - concessFrac, 0.45, 0.70);
    notes.push(
      `renewalCapFraction: ${renewalCapFraction.toFixed(3)} ` +
      `(archive concessions_p50 = ${(concessFrac * 100).toFixed(1)}%)`,
    );
  } else {
    notes.push('renewalCapFraction: held at default (no concession benchmark)');
  }

  // ── rentRunwayFullBps ────────────────────────────────────────────────────
  const DEFAULT_RUNWAY_BPS = 250;
  let rentRunwayFullBps = DEFAULT_RUNWAY_BPS;
  if (rentGrowthBps != null) {
    rentRunwayFullBps = clamp(Math.round(rentGrowthBps), 150, 400);
    notes.push(`rentRunwayFullBps: ${rentRunwayFullBps} (archive annual rent growth p50)`);
  } else {
    notes.push('rentRunwayFullBps: held at default (no archive rent-growth benchmark)');
  }

  // ── pushAboveMarketCeiling ───────────────────────────────────────────────
  // Tighten the ceiling when the property's vacancy is worse than benchmark
  // (demand is weaker, pushing above market is riskier).
  const DEFAULT_ABOVE_MARKET = 0.06;
  let pushAboveMarketCeiling = DEFAULT_ABOVE_MARKET;
  if (vacancyBenchmark != null && actualsStats.avgVacancyRate > vacancyBenchmark * 1.2) {
    pushAboveMarketCeiling = clamp(DEFAULT_ABOVE_MARKET * 0.5, 0.02, 0.06);
    notes.push(`pushAboveMarketCeiling: tightened to ${pushAboveMarketCeiling.toFixed(3)} (vacancy above benchmark)`);
  } else {
    notes.push(`pushAboveMarketCeiling: ${DEFAULT_ABOVE_MARKET} (vacancy within benchmark)`);
  }

  // ── Persist ──────────────────────────────────────────────────────────────
  await query(
    `INSERT INTO revenue_engine_calibration (
       property_id, months_of_actuals,
       vacancy_elasticity, controllable_fraction, renewal_cap_fraction,
       rent_runway_full_bps, push_above_market_ceiling,
       actuals_vacancy_rate, archive_vacancy_benchmark,
       archive_rent_growth_bps, archive_concession_p50,
       calibration_notes, calibrated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())`,
    [
      propertyId,
      actualsStats.months,
      vacancyElasticity,
      controllableFractionDefault,
      renewalCapFraction,
      rentRunwayFullBps,
      pushAboveMarketCeiling,
      actualsStats.avgVacancyRate,
      vacancyBenchmark,
      rentGrowthBps,
      concessionP50,
      notes.join('\n'),
    ],
  );

  const result: CalibratedConfig = {
    vacancyElasticity,
    controllableFractionDefault,
    renewalCapFraction,
    rentRunwayFullBps,
    pushAboveMarketCeiling,
    monthsOfActuals: actualsStats.months,
    calibratedAt: new Date().toISOString(),
    notes,
  };

  logger.info(
    `[revenue-calibration] ${propertyId}: calibrated from ${actualsStats.months} months — ` +
    `vacElast=${vacancyElasticity.toFixed(3)}, ctrlFrac=${controllableFractionDefault.toFixed(3)}, ` +
    `renewalCap=${renewalCapFraction.toFixed(3)}, runwayBps=${rentRunwayFullBps}`,
  );

  return result;
}

/**
 * Load the most recent calibration for a property from the DB.
 * Returns null when no calibration row exists or months < MIN_MONTHS_REQUIRED.
 */
export async function loadCalibration(
  propertyId: string,
): Promise<CalibratedConfig | null> {
  const res = await query(
    `SELECT
       months_of_actuals,
       vacancy_elasticity,
       controllable_fraction,
       renewal_cap_fraction,
       rent_runway_full_bps,
       push_above_market_ceiling,
       calibration_notes,
       calibrated_at
     FROM revenue_engine_calibration
     WHERE property_id = $1
     ORDER BY calibrated_at DESC
     LIMIT 1`,
    [propertyId],
  );

  if (!res.rows.length) return null;

  const r = res.rows[0] as any;
  const months = parseInt(r.months_of_actuals, 10) || 0;
  if (months < MIN_MONTHS_REQUIRED) return null;

  return {
    vacancyElasticity:          parseFloat(r.vacancy_elasticity        ?? '0') || 0.9,
    controllableFractionDefault: parseFloat(r.controllable_fraction     ?? '0') || 0.6,
    renewalCapFraction:         parseFloat(r.renewal_cap_fraction       ?? '0') || 0.55,
    rentRunwayFullBps:          parseFloat(r.rent_runway_full_bps       ?? '0') || 250,
    pushAboveMarketCeiling:     parseFloat(r.push_above_market_ceiling  ?? '0') || 0.06,
    monthsOfActuals:            months,
    calibratedAt:               r.calibrated_at
      ? new Date(r.calibrated_at).toISOString()
      : new Date().toISOString(),
    notes: r.calibration_notes
      ? String(r.calibration_notes).split('\n').filter(Boolean)
      : [],
  };
}
