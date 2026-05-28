/**
 * Comp Dedup Service — Task #1410 / D-COSTAR-3
 *
 * Identity matching for CoStar ↔ platform comp deduplication.
 * Called during CoStar ingest (after parsing, before DB write) to detect whether a
 * candidate CoStar comp already exists in market_sale_comps as a platform record.
 *
 * Priority order (stop at first match):
 *   1. Parcel ID  — source_id equality between candidate and existing row
 *   2. Address    — normalized address + city + state + sale_date within ±30 days
 *   3. Geocode    — lat/lng proximity < 0.01 miles (~52 ft) + sale_date within ±30 days
 *
 * Merge strategy (when a platform record is matched):
 *   - Keep the platform record as the primary row (authoritative recorded transaction).
 *   - Append 'costar_upload' to the platform record's source_labels[] and record match_method.
 *   - Patch NULL attributes (submarket, asset_class, cap_rate, etc.) from the CoStar
 *     candidate onto the existing platform row.  Never overwrites populated fields.
 *   - No new row is inserted — the matched row's ID is returned to the caller.
 *
 * Within-CoStar duplicates (same deal, both source='costar_upload'):
 *   - Handled separately by the caller via checkSaleDup / checkRentDup.
 *   - This service only checks against NON-costar_upload rows.
 */

import type { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DedupMatchMethod = 'parcel_id' | 'address' | 'geocode';

export interface DedupCandidate {
  address:    string;
  city:       string;
  state:      string;
  sale_date:  string;          // YYYY-MM-DD
  latitude?:  number | null;
  longitude?: number | null;
  source_id?: string | null;   // parcel ID if present in CoStar export
  // Optional attributes to patch onto the merged row when missing from platform record
  submarket?:   string | null;
  asset_class?: string | null;
  cap_rate?:    number | null;
  units?:       number | null;
  sqft?:        number | null;
  year_built?:  number | null;
  msa?:         string | null;
  county?:      string | null;
}

export interface DedupResult {
  matched:         boolean;
  existingId?:     string;
  method?:         DedupMatchMethod;
  /** source column value of the matched platform record (e.g. 'georgia_county') */
  existingSource?: string;
}

// ---------------------------------------------------------------------------
// Address normalization (TS-side)
// ---------------------------------------------------------------------------

/**
 * Normalize an address string for fuzzy matching.
 * - Lowercases
 * - Strips unit/suite/apt designators and everything after
 * - Removes punctuation, collapses whitespace
 */
export function normalizeAddressForDedup(addr: string): string {
  return addr
    .toLowerCase()
    // Strip unit designators and trailing text (e.g. "123 Main St, Apt 4B" → "123 main st")
    .replace(/[,#]?\s*\b(apt|apartment|unit|ste|suite|fl|floor|bldg|building)\b.*/i, '')
    .replace(/[.,#\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Sale date proximity window: ±30 days
const DATE_WINDOW_DAYS = 30;

// Geocode proximity threshold in miles (≈52 ft)
const GEO_THRESHOLD_MILES = 0.01;

// ---------------------------------------------------------------------------
// Core dedup check
// ---------------------------------------------------------------------------

/**
 * Check whether a CoStar candidate sale comp matches an existing PLATFORM record.
 * Returns a DedupResult — matched=true when a platform duplicate was found.
 *
 * Only checks rows where source != 'costar_upload' (within-CoStar dups handled
 * separately by the caller).
 */
export async function checkSaleCompDedup(
  pool: Pool,
  candidate: DedupCandidate,
): Promise<DedupResult> {

  // ── Tier 1: Parcel ID match ──────────────────────────────────────────────
  // Applies when both the candidate and an existing record share a source_id
  // (parcel number).  CoStar rarely includes parcel IDs; this fires when it does.
  if (candidate.source_id && candidate.source_id.trim().length > 0) {
    const r = await pool.query<{ id: string; source: string }>(
      `SELECT id, source
         FROM market_sale_comps
        WHERE source_id = $1
          AND source != 'costar_upload'
          AND ABS(sale_date - $2::date) <= ${DATE_WINDOW_DAYS}
        LIMIT 1`,
      [candidate.source_id.trim(), candidate.sale_date],
    );
    if (r.rows.length > 0) {
      return {
        matched:        true,
        existingId:     r.rows[0].id,
        method:         'parcel_id',
        existingSource: r.rows[0].source,
      };
    }
  }

  // ── Tier 2: Normalized address + city + state + date window ─────────────
  // Normalize in TypeScript; use exact LOWER() match in SQL to keep the query
  // simple and index-friendly.
  const normAddr  = normalizeAddressForDedup(candidate.address);
  const normCity  = candidate.city.toLowerCase().trim();
  const normState = candidate.state.toUpperCase().trim();

  const addrResult = await pool.query<{ id: string; source: string }>(
    `SELECT id, source
       FROM market_sale_comps
      WHERE LOWER(TRIM(address)) = $1
        AND LOWER(TRIM(city))    = $2
        AND UPPER(TRIM(state))   = $3
        AND source != 'costar_upload'
        AND ABS(sale_date - $4::date) <= ${DATE_WINDOW_DAYS}
      LIMIT 1`,
    [normAddr, normCity, normState, candidate.sale_date],
  );
  if (addrResult.rows.length > 0) {
    return {
      matched:        true,
      existingId:     addrResult.rows[0].id,
      method:         'address',
      existingSource: addrResult.rows[0].source,
    };
  }

  // ── Tier 3: Geocode proximity (< 0.01 miles ≈ 52 ft) + date window ─────
  if (candidate.latitude != null && candidate.longitude != null) {
    const geoResult = await pool.query<{ id: string; source: string }>(
      `SELECT id, source
         FROM market_sale_comps
        WHERE latitude  IS NOT NULL
          AND longitude IS NOT NULL
          AND source != 'costar_upload'
          AND ABS(sale_date - $3::date) <= ${DATE_WINDOW_DAYS}
          AND (point(longitude::float, latitude::float)
               <@> point($2::float, $1::float)) < $4
        LIMIT 1`,
      [candidate.latitude, candidate.longitude, candidate.sale_date, GEO_THRESHOLD_MILES],
    );
    if (geoResult.rows.length > 0) {
      return {
        matched:        true,
        existingId:     geoResult.rows[0].id,
        method:         'geocode',
        existingSource: geoResult.rows[0].source,
      };
    }
  }

  return { matched: false };
}

// ---------------------------------------------------------------------------
// Merge strategy
// ---------------------------------------------------------------------------

/**
 * Merge a CoStar candidate into an existing platform record.
 *
 * 1. Appends 'costar_upload' to source_labels[] of the platform record.
 * 2. Records dedup_match_method.
 * 3. Patches NULL fields (submarket, asset_class, cap_rate, etc.) from the CoStar
 *    candidate — never overwrites already-populated values on the platform row.
 */
export async function mergeSaleCompWithPlatform(
  pool:           Pool,
  existingId:     string,
  existingSource: string,
  method:         DedupMatchMethod,
  candidate:      DedupCandidate,
): Promise<void> {
  // Fetch the existing row's current label and patchable fields
  const existing = await pool.query<{
    source_labels:     string[] | null;
    submarket:         string | null;
    asset_class:       string | null;
    cap_rate:          string | null;
    units:             string | null;
    sqft:              string | null;
    year_built:        string | null;
    msa:               string | null;
    county:            string | null;
    latitude:          string | null;
    longitude:         string | null;
  }>(
    `SELECT source_labels, submarket, asset_class, cap_rate, units, sqft,
            year_built, msa, county, latitude, longitude
       FROM market_sale_comps WHERE id = $1`,
    [existingId],
  );

  if (existing.rows.length === 0) return;

  const row = existing.rows[0];

  // New source_labels: union of current labels + 'costar_upload'
  const currentLabels: string[] = row.source_labels ?? [existingSource];
  const newLabels = Array.from(new Set([...currentLabels, 'costar_upload']));

  // Patch fields that are NULL in the existing platform record from CoStar
  const patchCols: string[]  = ['source_labels = $2', 'dedup_match_method = $3'];
  const patchVals: any[]     = [existingId, newLabels, method];
  let pIdx = 4;

  const patchIfMissing = (col: string, candidateVal: any, existingVal: any) => {
    if (candidateVal != null && existingVal == null) {
      patchCols.push(`${col} = $${pIdx}`);
      patchVals.push(candidateVal);
      pIdx++;
    }
  };

  patchIfMissing('submarket',   candidate.submarket,   row.submarket);
  patchIfMissing('asset_class', candidate.asset_class, row.asset_class);
  patchIfMissing('cap_rate',    candidate.cap_rate,    row.cap_rate);
  patchIfMissing('units',       candidate.units,       row.units);
  patchIfMissing('sqft',        candidate.sqft,        row.sqft);
  patchIfMissing('year_built',  candidate.year_built,  row.year_built);
  patchIfMissing('msa',         candidate.msa,         row.msa);
  patchIfMissing('county',      candidate.county,      row.county);
  patchIfMissing('latitude',    candidate.latitude,    row.latitude);
  patchIfMissing('longitude',   candidate.longitude,   row.longitude);

  await pool.query(
    `UPDATE market_sale_comps SET ${patchCols.join(', ')} WHERE id = $1`,
    patchVals,
  );
}
