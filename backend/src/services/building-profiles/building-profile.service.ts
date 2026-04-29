/**
 * Building Profile Service
 *
 * Manages building_profiles — the physical specs of each deal's property.
 * Extracted from OMs, county parcel data, and used by agents to compare
 * actual OpEx against profile-matched benchmarks.
 *
 * A "building profile" answers: what TYPE of building is this?
 * - Garden vs midrise vs highrise vs wrap
 * - Wood-frame vs concrete vs steel
 * - Amenities: elevator, pool, fitness, concierge, etc.
 * - Vintage band: pre-1980, 1980-1999, etc.
 *
 * With enough profiles, we can compute: "what does a 2018 wrap with pool
 * and elevator in Atlanta typically spend on maintenance?"
 */

import { Pool } from 'pg';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BuildingProfile {
  id?: string;
  dealId: string;
  
  // Physical specs
  yearBuilt: number | null;
  totalStories: number | null;
  totalUnits: number | null;
  buildingType: string | null;   // garden | midrise | highrise | townhouse | wrap | mixed_use
  constructionType: string | null;
  siteAcres: number | null;
  buildingSqft: number | null;
  unitSqftAvg: number | null;
  
  // Parking
  parkingSpaces: number | null;
  parkingType: string | null;
  parkingRatio: number | null;
  
  // Computed fields
  vintageBand: string | null;
  sizeBand: string | null;
  
  // Amenities
  amenities: string[];          // raw amenities from OM
  amenityFlags: {               // structured booleans
    hasElevator: boolean;
    hasPool: boolean;
    hasClubhouse: boolean;
    hasFitness: boolean;
    hasConcierge: boolean;
    hasDogPark: boolean;
    hasRooftop: boolean;
    hasCoworking: boolean;
    hasPackageConcierge: boolean;
    hasValetTrash: boolean;
    hasDoorman: boolean;
    hasGarage: boolean;
    hasTennis: boolean;
    hasBasketball: boolean;
    hasBusinessCenter: boolean;
    hasPlayground: boolean;
    hasGrill: boolean;
  };
  
  // Provenance
  extractionSource: string;
  extractionConfidence: number;
  profileFingerprint?: string;
}

export interface OpExBenchmark {
  fingerprint: string;
  lineItem: string;
  region: string;
  p10PerUnit: number | null;
  p25PerUnit: number | null;
  p50PerUnit: number | null;
  p75PerUnit: number | null;
  p90PerUnit: number | null;
  p10PctEgi: number | null;
  p25PctEgi: number | null;
  p50PctEgi: number | null;
  p75PctEgi: number | null;
  p90PctEgi: number | null;
  sampleCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function determineBuildingType(stories: number | null, units: number | null): string {
  if (!stories && !units) return 'garden';
  if (!stories) return 'garden';
  if (stories <= 3) return 'garden';
  if (stories <= 6) return 'midrise';
  return 'highrise';
}

function getVintageBand(yearBuilt: number | null): string | null {
  if (!yearBuilt) return null;
  if (yearBuilt < 1980) return 'pre-1980';
  if (yearBuilt < 2000) return '1980-1999';
  if (yearBuilt < 2010) return '2000-2009';
  if (yearBuilt < 2020) return '2010-2019';
  return '2020+';
}

function getSizeBand(units: number | null): string | null {
  if (!units) return null;
  if (units < 50) return 'micro';
  if (units < 150) return 'small';
  if (units < 300) return 'medium';
  if (units < 500) return 'large';
  return 'mega';
}

// Amenity keyword classifier
const AMENITY_MAP: Record<string, keyof BuildingProfile['amenityFlags']> = {
  'elevator': 'hasElevator',
  'elevators': 'hasElevator',
  'pool': 'hasPool',
  'swimming pool': 'hasPool',
  'swimming': 'hasPool',
  'clubhouse': 'hasClubhouse',
  'club room': 'hasClubhouse',
  'club': 'hasClubhouse',
  'fitness': 'hasFitness',
  'gym': 'hasFitness',
  'fitness center': 'hasFitness',
  'concierge': 'hasConcierge',
  'dog park': 'hasDogPark',
  'pet park': 'hasDogPark',
  'rooftop': 'hasRooftop',
  'roof top': 'hasRooftop',
  'roof terrace': 'hasRooftop',
  'coworking': 'hasCoworking',
  'co-working': 'hasCoworking',
  'package concierge': 'hasPackageConcierge',
  'package locker': 'hasPackageConcierge',
  'valet trash': 'hasValetTrash',
  'trash valet': 'hasValetTrash',
  'doorman': 'hasDoorman',
  'door man': 'hasDoorman',
  'attended lobby': 'hasDoorman',
  'parking garage': 'hasGarage',
  'garage parking': 'hasGarage',
  'tennis': 'hasTennis',
  'basketball': 'hasBasketball',
  'business center': 'hasBusinessCenter',
  'business center': 'hasBusinessCenter',
  'playground': 'hasPlayground',
  'grill': 'hasGrill',
  'grilling': 'hasGrill',
  'bbq': 'hasGrill',
  'barbeque': 'hasGrill',
};

function classifyAmenities(rawAmenities: string[]): BuildingProfile['amenityFlags'] {
  const flags: BuildingProfile['amenityFlags'] = {
    hasElevator: false,
    hasPool: false,
    hasClubhouse: false,
    hasFitness: false,
    hasConcierge: false,
    hasDogPark: false,
    hasRooftop: false,
    hasCoworking: false,
    hasPackageConcierge: false,
    hasValetTrash: false,
    hasDoorman: false,
    hasGarage: false,
    hasTennis: false,
    hasBasketball: false,
    hasBusinessCenter: false,
    hasPlayground: false,
    hasGrill: false,
  };
  
  for (const a of rawAmenities) {
    const lower = a.toLowerCase().trim();
    for (const [keyword, field] of Object.entries(AMENITY_MAP)) {
      if (lower.includes(keyword)) {
        flags[field] = true;
      }
    }
  }
  
  return flags;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Upsert a building profile for a given deal.
 * Creates if not exists, updates if exists.
 */
export async function upsertBuildingProfile(
  profile: BuildingProfile,
  pool?: Pool
): Promise<string> {
  const db = pool ?? getPool();
  const flags = profile.amenityFlags;
  const vintage = profile.vintageBand ?? getVintageBand(profile.yearBuilt);
  const size = profile.sizeBand ?? getSizeBand(profile.totalUnits);
  const bldgType = profile.buildingType ?? determineBuildingType(profile.totalStories, profile.totalUnits);
  
  const { rows } = await db.query(`
    INSERT INTO building_profiles (
      deal_id, year_built, total_stories, total_units,
      building_type, construction_type,
      site_acres, building_sqft, unit_sqft_avg,
      parking_spaces, parking_type, parking_ratio,
      vintage_band, size_band,
      has_elevator, has_pool, has_clubhouse, has_fitness,
      has_concierge, has_dog_park, has_rooftop, has_coworking,
      has_package_concierge, has_valet_trash, has_doorman, has_garage,
      has_tennis, has_basketball, has_business_center, has_playground, has_grill,
      raw_amenities, extraction_source, extraction_confidence
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6,
      $7, $8, $9,
      $10, $11, $12,
      $13, $14,
      $15, $16, $17, $18,
      $19, $20, $21, $22,
      $23, $24, $25, $26,
      $27, $28, $29, $30, $31,
      $32, $33, $34
    )
    ON CONFLICT (deal_id) DO UPDATE SET
      year_built        = COALESCE(EXCLUDED.year_built,        building_profiles.year_built),
      total_stories     = COALESCE(EXCLUDED.total_stories,     building_profiles.total_stories),
      total_units       = COALESCE(EXCLUDED.total_units,       building_profiles.total_units),
      building_type     = COALESCE(EXCLUDED.building_type,     building_profiles.building_type),
      construction_type = COALESCE(EXCLUDED.construction_type, building_profiles.construction_type),
      site_acres        = COALESCE(EXCLUDED.site_acres,        building_profiles.site_acres),
      building_sqft     = COALESCE(EXCLUDED.building_sqft,     building_profiles.building_sqft),
      unit_sqft_avg     = COALESCE(EXCLUDED.unit_sqft_avg,     building_profiles.unit_sqft_avg),
      parking_spaces    = COALESCE(EXCLUDED.parking_spaces,    building_profiles.parking_spaces),
      parking_type      = COALESCE(EXCLUDED.parking_type,      building_profiles.parking_type),
      parking_ratio     = COALESCE(EXCLUDED.parking_ratio,     building_profiles.parking_ratio),
      has_elevator      = EXCLUDED.has_elevator OR building_profiles.has_elevator,
      has_pool          = EXCLUDED.has_pool OR building_profiles.has_pool,
      has_clubhouse     = EXCLUDED.has_clubhouse OR building_profiles.has_clubhouse,
      has_fitness       = EXCLUDED.has_fitness OR building_profiles.has_fitness,
      has_concierge     = EXCLUDED.has_concierge OR building_profiles.has_concierge,
      has_dog_park      = EXCLUDED.has_dog_park OR building_profiles.has_dog_park,
      has_rooftop       = EXCLUDED.has_rooftop OR building_profiles.has_rooftop,
      has_coworking     = EXCLUDED.has_coworking OR building_profiles.has_coworking,
      has_package_concierge = EXCLUDED.has_package_concierge OR building_profiles.has_package_concierge,
      has_valet_trash   = EXCLUDED.has_valet_trash OR building_profiles.has_valet_trash,
      has_doorman       = EXCLUDED.has_doorman OR building_profiles.has_doorman,
      has_garage        = EXCLUDED.has_garage OR building_profiles.has_garage,
      has_tennis        = EXCLUDED.has_tennis OR building_profiles.has_tennis,
      has_basketball    = EXCLUDED.has_basketball OR building_profiles.has_basketball,
      has_business_center = EXCLUDED.has_business_center OR building_profiles.has_business_center,
      has_playground    = EXCLUDED.has_playground OR building_profiles.has_playground,
      has_grill         = EXCLUDED.has_grill OR building_profiles.has_grill,
      raw_amenities     = (
        SELECT array_agg(DISTINCT a) FROM (
          SELECT unnest(EXCLUDED.raw_amenities) AS a
          UNION
          SELECT unnest(building_profiles.raw_amenities)
        ) sub
      ),
      extraction_confidence = GREATEST(EXCLUDED.extraction_confidence, building_profiles.extraction_confidence),
      extraction_source = CASE
        WHEN EXCLUDED.extraction_confidence > building_profiles.extraction_confidence
          THEN EXCLUDED.extraction_source
        ELSE building_profiles.extraction_source
      END
    RETURNING id
  `, [
    profile.dealId,
    profile.yearBuilt,
    profile.totalStories,
    profile.totalUnits,
    bldgType,
    profile.constructionType,
    profile.siteAcres,
    profile.buildingSqft,
    profile.unitSqftAvg,
    profile.parkingSpaces,
    profile.parkingType,
    profile.parkingRatio,
    vintage,
    size,
    flags.hasElevator, flags.hasPool, flags.hasClubhouse, flags.hasFitness,
    flags.hasConcierge, flags.hasDogPark, flags.hasRooftop, flags.hasCoworking,
    flags.hasPackageConcierge, flags.hasValetTrash, flags.hasDoorman, flags.hasGarage,
    flags.hasTennis, flags.hasBasketball, flags.hasBusinessCenter, flags.hasPlayground, flags.hasGrill,
    profile.amenities,
    profile.extractionSource,
    profile.extractionConfidence,
  ]);
  
  return rows[0].id;
}

/**
 * Get a building profile by deal ID.
 */
export async function getBuildingProfile(
  dealId: string,
  pool?: Pool
): Promise<BuildingProfile | null> {
  const db = pool ?? getPool();
  const { rows } = await db.query(
    `SELECT * FROM building_profiles WHERE deal_id = $1`,
    [dealId]
  );
  
  if (rows.length === 0) return null;
  return rowToProfile(rows[0]);
}

/**
 * Get profile-matched OpEx benchmarks for a given fingerprint + region.
 * Returns all available line items.
 */
export async function getProfileBenchmarks(
  fingerprint: string,
  region: string = 'national',
  lineItems?: string[],
  pool?: Pool
): Promise<OpExBenchmark[]> {
  const db = pool ?? getPool();
  
  let query = `
    SELECT * FROM building_profile_opex_benchmarks
    WHERE profile_fingerprint = $1 AND region = $2
  `;
  const params: any[] = [fingerprint, region];
  
  if (lineItems && lineItems.length > 0) {
    query += ` AND line_item = ANY($3)`;
    params.push(lineItems);
  }
  
  const { rows } = await db.query(query, params);
  
  return rows.map((r: any) => ({
    fingerprint: r.profile_fingerprint,
    lineItem: r.line_item,
    region: r.region,
    p10PerUnit: r.p10_per_unit,
    p25PerUnit: r.p25_per_unit,
    p50PerUnit: r.p50_per_unit,
    p75PerUnit: r.p75_per_unit,
    p90PerUnit: r.p90_per_unit,
    p10PctEgi: r.p10_pct_egi,
    p25PctEgi: r.p25_pct_egi,
    p50PctEgi: r.p50_pct_egi,
    p75PctEgi: r.p75_pct_egi,
    p90PctEgi: r.p90_pct_egi,
    sampleCount: r.sample_count,
  }));
}

/**
 * Compute and update building_profile_opex_benchmarks from all existing profiles.
 * Recalculates P10-P90 per-unit and %-of-EGI for every fingerprint × line item.
 */
export async function recomputeProfileBenchmarks(pool?: Pool): Promise<number> {
  const db = pool ?? getPool();
  
  // Aggregate deals with matching profiles
  const { rows: counts } = await db.query(`
    WITH profile_metrics AS (
      SELECT
        bp.profile_fingerprint,
        pli.line_item,
        pli.annual_amount,
        pli.pct_egi,
        bp.total_units
      FROM building_profiles bp
      JOIN deal_data dd ON dd.deal_id = bp.deal_id
      JOIN deal_line_items pli ON pli.deal_data_id = dd.id
        AND pli.source = 't12'
      WHERE bp.profile_fingerprint IS NOT NULL
        AND pli.annual_amount IS NOT NULL
        AND bp.total_units IS NOT NULL
        AND bp.total_units > 0
    )
    SELECT
      profile_fingerprint,
      line_item,
      COUNT(*) AS sample_count,
      percentile_cont(0.10) WITHIN GROUP (ORDER BY annual_amount / total_units) AS p10_per_unit,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY annual_amount / total_units) AS p25_per_unit,
      percentile_cont(0.50) WITHIN GROUP (ORDER BY annual_amount / total_units) AS p50_per_unit,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY annual_amount / total_units) AS p75_per_unit,
      percentile_cont(0.90) WITHIN GROUP (ORDER BY annual_amount / total_units) AS p90_per_unit,
      percentile_cont(0.10) WITHIN GROUP (ORDER BY pct_egi) AS p10_pct_egi,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY pct_egi) AS p25_pct_egi,
      percentile_cont(0.50) WITHIN GROUP (ORDER BY pct_egi) AS p50_pct_egi,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY pct_egi) AS p75_pct_egi,
      percentile_cont(0.90) WITHIN GROUP (ORDER BY pct_egi) AS p90_pct_egi
    FROM profile_metrics
    GROUP BY profile_fingerprint, line_item
    HAVING COUNT(*) >= 3
  `);
  
  // Upsert each benchmark
  let inserted = 0;
  for (const row of rows) {
    await db.query(`
      INSERT INTO building_profile_opex_benchmarks (
        profile_fingerprint, line_item, region,
        p10_per_unit, p25_per_unit, p50_per_unit, p75_per_unit, p90_per_unit,
        p10_pct_egi, p25_pct_egi, p50_pct_egi, p75_pct_egi, p90_pct_egi,
        sample_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (profile_fingerprint, line_item, region) DO UPDATE SET
        p10_per_unit = EXCLUDED.p10_per_unit,
        p25_per_unit = EXCLUDED.p25_per_unit,
        p50_per_unit = EXCLUDED.p50_per_unit,
        p75_per_unit = EXCLUDED.p75_per_unit,
        p90_per_unit = EXCLUDED.p90_per_unit,
        p10_pct_egi  = EXCLUDED.p10_pct_egi,
        p25_pct_egi  = EXCLUDED.p25_pct_egi,
        p50_pct_egi  = EXCLUDED.p50_pct_egi,
        p75_pct_egi  = EXCLUDED.p75_pct_egi,
        p90_pct_egi  = EXCLUDED.p90_pct_egi,
        sample_count  = EXCLUDED.sample_count,
        computed_at   = NOW()
    `, [
      row.profile_fingerprint, row.line_item, 'national',
      row.p10_per_unit, row.p25_per_unit, row.p50_per_unit,
      row.p75_per_unit, row.p90_per_unit,
      row.p10_pct_egi, row.p25_pct_egi, row.p50_pct_egi,
      row.p75_pct_egi, row.p90_pct_egi,
      row.sample_count,
    ]);
    inserted++;
  }
  
  logger.info(`[BuildingProfiles] recomputed ${inserted} benchmark rows from ${rows.length} groups`);
  return inserted;
}

/**
 * Extract building profile from OM extraction data + create/update profile.
 */
export async function createProfileFromOM(
  dealId: string,
  omData: {
    yearBuilt?: number | null;
    stories?: number | null;
    units?: number | null;
    squareFeet?: number | null;
    siteAcres?: number | null;
    parkingSpaces?: number | null;
    parkingRatio?: number | null;
    amenities?: string[];
    buildingType?: string;
    constructionType?: string;
  },
  pool?: Pool
): Promise<string> {
  const profile: BuildingProfile = {
    dealId,
    yearBuilt: omData.yearBuilt ?? null,
    totalStories: omData.stories ?? null,
    totalUnits: omData.units ?? null,
    buildingType: omData.buildingType ?? null,
    constructionType: omData.constructionType ?? null,
    siteAcres: omData.siteAcres ?? null,
    buildingSqft: omData.squareFeet ?? null,
    unitSqftAvg: null,
    parkingSpaces: omData.parkingSpaces ?? null,
    parkingType: omData.parkingSpaces ? 'surface' : null,
    parkingRatio: omData.parkingRatio ?? null,
    vintageBand: null, // computed in upsert
    sizeBand: null,
    amenities: omData.amenities ?? [],
    amenityFlags: classifyAmenities(omData.amenities ?? []),
    extractionSource: 'om_parsed',
    extractionConfidence: 0.8,
  };
  
  return upsertBuildingProfile(profile, pool);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function rowToProfile(row: any): BuildingProfile {
  return {
    id: row.id,
    dealId: row.deal_id,
    yearBuilt: row.year_built,
    totalStories: row.total_stories,
    totalUnits: row.total_units,
    buildingType: row.building_type,
    constructionType: row.construction_type,
    siteAcres: row.site_acres,
    buildingSqft: row.building_sqft,
    unitSqftAvg: row.unit_sqft_avg,
    parkingSpaces: row.parking_spaces,
    parkingType: row.parking_type,
    parkingRatio: row.parking_ratio,
    vintageBand: row.vintage_band,
    sizeBand: row.size_band,
    amenities: row.raw_amenities ?? [],
    amenityFlags: {
      hasElevator: row.has_elevator,
      hasPool: row.has_pool,
      hasClubhouse: row.has_clubhouse,
      hasFitness: row.has_fitness,
      hasConcierge: row.has_concierge,
      hasDogPark: row.has_dog_park,
      hasRooftop: row.has_rooftop,
      hasCoworking: row.has_coworking,
      hasPackageConcierge: row.has_package_concierge,
      hasValetTrash: row.has_valet_trash,
      hasDoorman: row.has_doorman,
      hasGarage: row.has_garage,
      hasTennis: row.has_tennis,
      hasBasketball: row.has_basketball,
      hasBusinessCenter: row.has_business_center,
      hasPlayground: row.has_playground,
      hasGrill: row.has_grill,
    },
    extractionSource: row.extraction_source,
    extractionConfidence: row.extraction_confidence,
    profileFingerprint: row.profile_fingerprint,
  };
}

export default {
  upsertBuildingProfile,
  getBuildingProfile,
  getProfileBenchmarks,
  recomputeProfileBenchmarks,
  createProfileFromOM,
};
