/**
 * M39 Peer Intelligence — DB-backed character vector seed
 *
 * On server boot this module:
 *   1. Creates the `submarket_characters` table if it does not exist.
 *   2. Inserts the built-in seed rows when the table is empty.
 *   3. Loads every row from the table and registers them in both:
 *        • peerIntelligenceService  (character vectors)
 *        • multiTierFactorDecomposition (submarket factor loadings)
 *      so that computeDualRanking() returns real results.
 *
 * The POST /api/v1/peers/characters route calls `persistCharacter()` /
 * `persistCharacters()` so that dynamically registered vectors survive
 * server restarts.
 */

import type { Pool } from 'pg';
import { peerIntelligenceService, type SubmarketCharacter } from './peer-intelligence';
import { multiTierFactorDecomposition, type SubmarketFactors } from './multi-tier-factor';
import { createLogger } from '../../utils/logger';

const log = createLogger('peer-characters-seed');

// ─── DDL ─────────────────────────────────────────────────────────────────────

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS submarket_characters (
  submarket_id              TEXT PRIMARY KEY,
  msa_id                    TEXT NOT NULL,
  asset_class               TEXT NOT NULL DEFAULT 'multifamily',
  vintage_decade            TEXT,
  density_tier              TEXT,
  demographic_income_tier   TEXT,
  demographic_age_tier      TEXT,
  unit_count_estimate       INTEGER,
  avg_rent_psf              NUMERIC(8,2),
  renewal_rate              NUMERIC(6,4),
  turnover_rate             NUMERIC(6,4),
  days_vacant_median        NUMERIC(6,2),
  rent_growth               NUMERIC(6,4),
  occupancy                 NUMERIC(6,4),
  -- Simplified pre-computed factor loadings stored as JSONB so we avoid a
  -- second join table while keeping OLS outputs portable.
  national_loadings         JSONB NOT NULL DEFAULT '{}',
  msa_loadings              JSONB NOT NULL DEFAULT '{}',
  alpha                     NUMERIC(10,4) NOT NULL DEFAULT 0,
  residual_variance         NUMERIC(10,4) NOT NULL DEFAULT 0.01,
  estimation_date           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

// ─── Seed rows ────────────────────────────────────────────────────────────────
//
// Realistic Class-B/C multifamily submarkets across three MSAs.
// National loadings represent β on 4 aggregate factors:
//   [gdp_growth, employment_growth, rent_index, vacancy_index]
//
// These are illustrative but plausible coefficients consistent with
// published CoStar / CBRE market reports (2022-2024).

interface SeedRow extends SubmarketCharacter {
  msaId: string;
  nationalLoadings: Record<string, number>;
  msaLoadings: Record<string, number>;
  alpha: number;
  residualVariance: number;
}

const SEED_ROWS: SeedRow[] = [
  // ── Atlanta MSA ────────────────────────────────────────────────────────────
  {
    submarketId: 'atl-midtown',
    msaId: 'atlanta',
    assetClass: 'multifamily_class_b',
    vintageDecade: '2010s',
    densityTier: 'urban',
    demographicIncomeTier: 'upper_middle',
    demographicAgeTier: 'millennial',
    unitCountEstimate: 4200,
    avgRentPsf: 2.10,
    renewalRate: 0.58,
    turnoverRate: 0.42,
    daysVacantMedian: 22,
    rentGrowth: 0.048,
    occupancy: 0.94,
    estimationDate: new Date('2024-01-01'),
    nationalLoadings: { gdp_growth: 0.72, employment_growth: 0.88, rent_index: 1.12, vacancy_index: -0.65 },
    msaLoadings: { atl_f1: 0.91 },
    alpha: 0.032,
    residualVariance: 0.008,
  },
  {
    submarketId: 'atl-buckhead',
    msaId: 'atlanta',
    assetClass: 'multifamily_class_b',
    vintageDecade: '2010s',
    densityTier: 'urban',
    demographicIncomeTier: 'high',
    demographicAgeTier: 'millennial',
    unitCountEstimate: 3800,
    avgRentPsf: 2.35,
    renewalRate: 0.55,
    turnoverRate: 0.45,
    daysVacantMedian: 25,
    rentGrowth: 0.042,
    occupancy: 0.93,
    estimationDate: new Date('2024-01-01'),
    nationalLoadings: { gdp_growth: 0.70, employment_growth: 0.82, rent_index: 1.25, vacancy_index: -0.58 },
    msaLoadings: { atl_f1: 0.87 },
    alpha: 0.028,
    residualVariance: 0.009,
  },
  {
    submarketId: 'atl-decatur',
    msaId: 'atlanta',
    assetClass: 'multifamily_class_b',
    vintageDecade: '2000s',
    densityTier: 'suburban',
    demographicIncomeTier: 'middle',
    demographicAgeTier: 'gen_x',
    unitCountEstimate: 2900,
    avgRentPsf: 1.75,
    renewalRate: 0.62,
    turnoverRate: 0.38,
    daysVacantMedian: 18,
    rentGrowth: 0.038,
    occupancy: 0.95,
    estimationDate: new Date('2024-01-01'),
    nationalLoadings: { gdp_growth: 0.65, employment_growth: 0.78, rent_index: 0.95, vacancy_index: -0.72 },
    msaLoadings: { atl_f1: 0.76 },
    alpha: 0.025,
    residualVariance: 0.007,
  },
  {
    submarketId: 'atl-westside',
    msaId: 'atlanta',
    assetClass: 'multifamily_class_c',
    vintageDecade: '1990s',
    densityTier: 'suburban',
    demographicIncomeTier: 'lower_middle',
    demographicAgeTier: 'gen_x',
    unitCountEstimate: 2100,
    avgRentPsf: 1.25,
    renewalRate: 0.68,
    turnoverRate: 0.32,
    daysVacantMedian: 15,
    rentGrowth: 0.052,
    occupancy: 0.96,
    estimationDate: new Date('2024-01-01'),
    nationalLoadings: { gdp_growth: 0.55, employment_growth: 0.70, rent_index: 0.78, vacancy_index: -0.80 },
    msaLoadings: { atl_f1: 0.62 },
    alpha: 0.035,
    residualVariance: 0.010,
  },
  // ── Dallas MSA (cross-MSA analogs) ────────────────────────────────────────
  {
    submarketId: 'dal-uptown',
    msaId: 'dallas',
    assetClass: 'multifamily_class_b',
    vintageDecade: '2010s',
    densityTier: 'urban',
    demographicIncomeTier: 'upper_middle',
    demographicAgeTier: 'millennial',
    unitCountEstimate: 5100,
    avgRentPsf: 2.05,
    renewalRate: 0.56,
    turnoverRate: 0.44,
    daysVacantMedian: 24,
    rentGrowth: 0.045,
    occupancy: 0.93,
    estimationDate: new Date('2024-01-01'),
    nationalLoadings: { gdp_growth: 0.68, employment_growth: 0.92, rent_index: 1.08, vacancy_index: -0.62 },
    msaLoadings: { dal_f1: 0.88 },
    alpha: 0.030,
    residualVariance: 0.009,
  },
  {
    submarketId: 'dal-knox-henderson',
    msaId: 'dallas',
    assetClass: 'multifamily_class_b',
    vintageDecade: '2010s',
    densityTier: 'urban',
    demographicIncomeTier: 'upper_middle',
    demographicAgeTier: 'millennial',
    unitCountEstimate: 3200,
    avgRentPsf: 2.15,
    renewalRate: 0.54,
    turnoverRate: 0.46,
    daysVacantMedian: 27,
    rentGrowth: 0.040,
    occupancy: 0.92,
    estimationDate: new Date('2024-01-01'),
    nationalLoadings: { gdp_growth: 0.66, employment_growth: 0.90, rent_index: 1.15, vacancy_index: -0.60 },
    msaLoadings: { dal_f1: 0.82 },
    alpha: 0.027,
    residualVariance: 0.010,
  },
  // ── Austin MSA (cross-MSA analogs) ────────────────────────────────────────
  {
    submarketId: 'aus-domain',
    msaId: 'austin',
    assetClass: 'multifamily_class_b',
    vintageDecade: '2010s',
    densityTier: 'suburban',
    demographicIncomeTier: 'high',
    demographicAgeTier: 'millennial',
    unitCountEstimate: 4600,
    avgRentPsf: 2.30,
    renewalRate: 0.52,
    turnoverRate: 0.48,
    daysVacantMedian: 30,
    rentGrowth: 0.035,
    occupancy: 0.91,
    estimationDate: new Date('2024-01-01'),
    nationalLoadings: { gdp_growth: 0.80, employment_growth: 0.95, rent_index: 1.20, vacancy_index: -0.55 },
    msaLoadings: { aus_f1: 0.94 },
    alpha: 0.025,
    residualVariance: 0.012,
  },
  {
    submarketId: 'aus-south-congress',
    msaId: 'austin',
    assetClass: 'multifamily_class_b',
    vintageDecade: '2000s',
    densityTier: 'urban',
    demographicIncomeTier: 'upper_middle',
    demographicAgeTier: 'millennial',
    unitCountEstimate: 2800,
    avgRentPsf: 2.20,
    renewalRate: 0.57,
    turnoverRate: 0.43,
    daysVacantMedian: 21,
    rentGrowth: 0.038,
    occupancy: 0.93,
    estimationDate: new Date('2024-01-01'),
    nationalLoadings: { gdp_growth: 0.78, employment_growth: 0.90, rent_index: 1.15, vacancy_index: -0.58 },
    msaLoadings: { aus_f1: 0.88 },
    alpha: 0.028,
    residualVariance: 0.009,
  },
  // ── Charlotte MSA ─────────────────────────────────────────────────────────
  {
    submarketId: 'clt-south-end',
    msaId: 'charlotte',
    assetClass: 'multifamily_class_b',
    vintageDecade: '2010s',
    densityTier: 'urban',
    demographicIncomeTier: 'upper_middle',
    demographicAgeTier: 'millennial',
    unitCountEstimate: 3100,
    avgRentPsf: 1.95,
    renewalRate: 0.59,
    turnoverRate: 0.41,
    daysVacantMedian: 20,
    rentGrowth: 0.050,
    occupancy: 0.95,
    estimationDate: new Date('2024-01-01'),
    nationalLoadings: { gdp_growth: 0.62, employment_growth: 0.85, rent_index: 1.00, vacancy_index: -0.70 },
    msaLoadings: { clt_f1: 0.80 },
    alpha: 0.033,
    residualVariance: 0.008,
  },
  {
    submarketId: 'clt-noda',
    msaId: 'charlotte',
    assetClass: 'multifamily_class_c',
    vintageDecade: '2000s',
    densityTier: 'suburban',
    demographicIncomeTier: 'middle',
    demographicAgeTier: 'gen_x',
    unitCountEstimate: 1900,
    avgRentPsf: 1.45,
    renewalRate: 0.65,
    turnoverRate: 0.35,
    daysVacantMedian: 16,
    rentGrowth: 0.055,
    occupancy: 0.96,
    estimationDate: new Date('2024-01-01'),
    nationalLoadings: { gdp_growth: 0.58, employment_growth: 0.80, rent_index: 0.85, vacancy_index: -0.75 },
    msaLoadings: { clt_f1: 0.70 },
    alpha: 0.038,
    residualVariance: 0.011,
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Persist a single character vector to the DB.
 * Called by POST /api/v1/peers/characters so vectors survive restarts.
 */
export async function persistCharacter(
  pool: Pool,
  char: SubmarketCharacter,
  factors?: Pick<SubmarketFactors, 'nationalLoadings' | 'msaLoadings' | 'alpha' | 'residualVariance'>,
): Promise<void> {
  await pool.query(
    `INSERT INTO submarket_characters (
       submarket_id, msa_id, asset_class, vintage_decade, density_tier,
       demographic_income_tier, demographic_age_tier, unit_count_estimate,
       avg_rent_psf, renewal_rate, turnover_rate, days_vacant_median,
       rent_growth, occupancy, national_loadings, msa_loadings, alpha,
       residual_variance, estimation_date, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW())
     ON CONFLICT (submarket_id) DO UPDATE SET
       msa_id                  = EXCLUDED.msa_id,
       asset_class             = EXCLUDED.asset_class,
       vintage_decade          = EXCLUDED.vintage_decade,
       density_tier            = EXCLUDED.density_tier,
       demographic_income_tier = EXCLUDED.demographic_income_tier,
       demographic_age_tier    = EXCLUDED.demographic_age_tier,
       unit_count_estimate     = EXCLUDED.unit_count_estimate,
       avg_rent_psf            = EXCLUDED.avg_rent_psf,
       renewal_rate            = EXCLUDED.renewal_rate,
       turnover_rate           = EXCLUDED.turnover_rate,
       days_vacant_median      = EXCLUDED.days_vacant_median,
       rent_growth             = EXCLUDED.rent_growth,
       occupancy               = EXCLUDED.occupancy,
       national_loadings       = EXCLUDED.national_loadings,
       msa_loadings            = EXCLUDED.msa_loadings,
       alpha                   = EXCLUDED.alpha,
       residual_variance       = EXCLUDED.residual_variance,
       estimation_date         = EXCLUDED.estimation_date,
       updated_at              = NOW()`,
    [
      char.submarketId,
      (char as any).msaId ?? 'unknown',
      char.assetClass,
      char.vintageDecade ?? null,
      char.densityTier ?? null,
      char.demographicIncomeTier ?? null,
      char.demographicAgeTier ?? null,
      char.unitCountEstimate ?? null,
      char.avgRentPsf ?? null,
      char.renewalRate ?? null,
      char.turnoverRate ?? null,
      char.daysVacantMedian ?? null,
      char.rentGrowth ?? null,
      char.occupancy ?? null,
      JSON.stringify(factors?.nationalLoadings ?? {}),
      JSON.stringify(factors?.msaLoadings ?? {}),
      factors?.alpha ?? 0,
      factors?.residualVariance ?? 0.01,
      char.estimationDate,
    ],
  );
}

/**
 * Persist multiple character vectors (bulk upsert).
 */
export async function persistCharacters(pool: Pool, chars: SubmarketCharacter[]): Promise<void> {
  for (const c of chars) {
    await persistCharacter(pool, c);
  }
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToCharacter(row: Record<string, any>): SubmarketCharacter & { msaId: string } {
  return {
    submarketId: row.submarket_id,
    msaId: row.msa_id,
    assetClass: row.asset_class,
    vintageDecade: row.vintage_decade ?? undefined,
    densityTier: row.density_tier ?? undefined,
    demographicIncomeTier: row.demographic_income_tier ?? undefined,
    demographicAgeTier: row.demographic_age_tier ?? undefined,
    unitCountEstimate: row.unit_count_estimate != null ? Number(row.unit_count_estimate) : undefined,
    avgRentPsf: row.avg_rent_psf != null ? parseFloat(row.avg_rent_psf) : undefined,
    renewalRate: row.renewal_rate != null ? parseFloat(row.renewal_rate) : undefined,
    turnoverRate: row.turnover_rate != null ? parseFloat(row.turnover_rate) : undefined,
    daysVacantMedian: row.days_vacant_median != null ? parseFloat(row.days_vacant_median) : undefined,
    rentGrowth: row.rent_growth != null ? parseFloat(row.rent_growth) : undefined,
    occupancy: row.occupancy != null ? parseFloat(row.occupancy) : undefined,
    estimationDate: new Date(row.estimation_date),
  };
}

function rowToFactors(row: Record<string, any>): SubmarketFactors {
  return {
    submarketId: row.submarket_id,
    msaId: row.msa_id,
    assetClass: row.asset_class,
    nationalLoadings: (typeof row.national_loadings === 'object' ? row.national_loadings : JSON.parse(row.national_loadings ?? '{}')) as Record<string, number>,
    msaLoadings: (typeof row.msa_loadings === 'object' ? row.msa_loadings : JSON.parse(row.msa_loadings ?? '{}')) as Record<string, number>,
    alpha: parseFloat(row.alpha ?? '0'),
    residualVariance: parseFloat(row.residual_variance ?? '0.01'),
    shrinkageWeight: 0,
    tStats: {},
    standardErrors: {},
    estimationDate: new Date(row.estimation_date),
  };
}

// ─── Boot seed ────────────────────────────────────────────────────────────────

/**
 * Called once at server startup.
 *
 * Steps:
 *  1. Create the `submarket_characters` table if absent.
 *  2. Seed the built-in rows when the table is empty.
 *  3. Load all rows → register in peerIntelligenceService + multiTierFactorDecomposition.
 */
export async function seedPeerCharacters(pool: Pool): Promise<{ loaded: number; seeded: number }> {
  // 1. Ensure table exists
  await pool.query(CREATE_TABLE_SQL);

  // 2. Check row count; seed built-in rows if empty
  const countRes = await pool.query<{ cnt: string }>('SELECT COUNT(*) AS cnt FROM submarket_characters');
  const existingCount = parseInt(countRes.rows[0].cnt, 10);
  let seeded = 0;

  if (existingCount === 0) {
    for (const row of SEED_ROWS) {
      // SeedRow carries msaId; cast so persistCharacter can read it via (char as any).msaId
      await persistCharacter(pool, row as unknown as SubmarketCharacter, {
        nationalLoadings: row.nationalLoadings,
        msaLoadings:      row.msaLoadings,
        alpha:            row.alpha,
        residualVariance: row.residualVariance,
      });
      seeded++;
    }
    log.info({ seeded }, 'Built-in submarket character vectors seeded');
  }

  // 3. Load all rows and register in memory
  const allRes = await pool.query('SELECT * FROM submarket_characters ORDER BY submarket_id');
  const characters: SubmarketCharacter[] = allRes.rows.map(rowToCharacter);
  peerIntelligenceService.bulkRegisterCharacters(characters);

  for (const row of allRes.rows) {
    multiTierFactorDecomposition.registerSubmarketFactors(rowToFactors(row));
  }

  log.info({ loaded: characters.length, seeded }, 'M39 peer characters loaded into memory');
  return { loaded: characters.length, seeded };
}
