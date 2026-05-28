/**
 * Comp Dedup Service — Task #1410 / D-COSTAR-3
 *
 * Identity matching for CoStar ↔ platform comp deduplication.
 * Called during CoStar ingest (after parsing, before DB write) to detect whether a
 * candidate CoStar comp already exists in market_sale_comps as a platform record.
 *
 * Priority order (stop at first match):
 *   1. Parcel ID  — source_id equality + ±30-day date window
 *   2. Address    — normalized addresses compared IN TypeScript (both sides normalized
 *                   identically) after fetching candidates by city+state+date
 *   3. Geocode    — lat/lng proximity < 0.01 miles (~52 ft) + ±30-day date window
 *
 * Merge strategy (when a platform record is matched):
 *   - Evaluate quality score (count of non-null key fields) for both records.
 *   - If CoStar has higher quality OR (same quality AND more-recent data_as_of):
 *       CoStar wins — overwrite financial/property fields on the existing platform row.
 *   - Otherwise platform wins — only patch NULL fields from CoStar.
 *   - Regardless of winner: source_labels[] is annotated with both origins,
 *     and dedup_match_method records which tier fired.
 *   - No new row is inserted — the matched platform row's ID is returned.
 *
 * Within-CoStar duplicates (same deal, both source='costar_upload'):
 *   Handled separately by the caller via checkSaleDup / checkRentDup.
 *   This service only checks against NON-costar_upload rows.
 */

import type { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DedupMatchMethod = 'parcel_id' | 'address' | 'geocode';

export interface DedupCandidate {
  address:     string;
  city:        string;
  state:       string;
  sale_date:   string;         // YYYY-MM-DD
  latitude?:   number | null;
  longitude?:  number | null;
  source_id?:  string | null;  // CoStar Property ID / parcel number when available
  data_as_of?: string | null;  // CoStar export date for recency comparison
  // Attributes to evaluate quality and patch onto the merged platform row
  submarket?:   string | null;
  asset_class?: string | null;
  cap_rate?:    number | null;
  units?:       number | null;
  sqft?:        number | null;
  year_built?:  number | null;
  msa?:         string | null;
  county?:      string | null;
  sale_price?:  number | null;
  price_per_unit?: number | null;
  price_per_sqft?: number | null;
  buyer?:       string | null;
  seller?:      string | null;
}

export interface DedupResult {
  matched:         boolean;
  existingId?:     string;
  method?:         DedupMatchMethod;
  /** source column value of the matched platform record (e.g. 'georgia_county') */
  existingSource?: string;
}

// ---------------------------------------------------------------------------
// Address normalization (applied in TypeScript on BOTH candidate and DB rows)
// ---------------------------------------------------------------------------

/**
 * Normalize an address string for comparison.
 * Strips unit/suite/apt designators (and trailing text), removes punctuation,
 * collapses whitespace. Applied identically to both the CoStar candidate and
 * DB rows so both sides use the same normalization.
 */
export function normalizeAddressForDedup(addr: string): string {
  return addr
    .toLowerCase()
    // Strip unit designators and everything after them
    .replace(/[,#]?\s*\b(apt|apartment|unit|ste|suite|fl|floor|bldg|building)\b.*/i, '')
    .replace(/[.,#\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Quality scoring
// ---------------------------------------------------------------------------

/**
 * Count of non-null "key quality" fields.  Higher = more complete record.
 */
function qualityScore(fields: {
  cap_rate?:    any;
  units?:       any;
  sqft?:        any;
  year_built?:  any;
  latitude?:    any;
  longitude?:   any;
  submarket?:   any;
  asset_class?: any;
}): number {
  let score = 0;
  if (fields.cap_rate    != null) score++;
  if (fields.units       != null) score++;
  if (fields.sqft        != null) score++;
  if (fields.year_built  != null) score++;
  if (fields.latitude    != null) score++;
  if (fields.longitude   != null) score++;
  if (fields.submarket   != null) score++;
  if (fields.asset_class != null) score++;
  return score;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** ±30 days — prevents false positives when the same property traded twice nearby. */
const DATE_WINDOW_DAYS = 30;

/** < 0.01 miles ≈ 52 ft using the earthdistance <@> operator. */
const GEO_THRESHOLD_MILES = 0.01;

// ---------------------------------------------------------------------------
// Core dedup check
// ---------------------------------------------------------------------------

/**
 * Check whether a CoStar candidate sale comp matches an existing PLATFORM record.
 * Returns a DedupResult — matched=true when a platform duplicate was found.
 *
 * Only checks rows where source != 'costar_upload'.
 */
export async function checkSaleCompDedup(
  pool:      Pool,
  candidate: DedupCandidate,
): Promise<DedupResult> {

  // ── Tier 1: Parcel ID match ──────────────────────────────────────────────
  // Fires when CoStar exports a Property ID that matches a recorded source_id.
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

  // ── Tier 2: Address match (both sides normalized in TypeScript) ──────────
  // Fetch all platform candidates in the same city+state+date window, then
  // compare normalized addresses in TypeScript — same normalizeAddressForDedup
  // function on both sides ensures identical handling.
  const normCandidateAddr = normalizeAddressForDedup(candidate.address);
  const normCity  = candidate.city.toLowerCase().trim();
  const normState = candidate.state.toUpperCase().trim();

  const addrCandidates = await pool.query<{ id: string; source: string; address: string }>(
    `SELECT id, source, address
       FROM market_sale_comps
      WHERE LOWER(TRIM(city))  = $1
        AND UPPER(TRIM(state)) = $2
        AND source != 'costar_upload'
        AND ABS(sale_date - $3::date) <= ${DATE_WINDOW_DAYS}
      LIMIT 50`,
    [normCity, normState, candidate.sale_date],
  );
  for (const row of addrCandidates.rows) {
    if (normalizeAddressForDedup(row.address) === normCandidateAddr) {
      return {
        matched:        true,
        existingId:     row.id,
        method:         'address',
        existingSource: row.source,
      };
    }
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
 * Winner selection:
 *   CoStar wins when its quality score > platform score, OR scores tie
 *   and CoStar has a more recent data_as_of date.
 *
 * If CoStar wins:
 *   Overwrite financial/property fields (sale_price, cap_rate, price_per_unit,
 *   price_per_sqft, submarket, asset_class, year_built, units, sqft, lat/lng)
 *   with CoStar values.
 *
 * If platform wins:
 *   Only patch NULL fields from CoStar (same behaviour as before).
 *
 * Always:
 *   Append 'costar_upload' to source_labels[] and record dedup_match_method.
 */
export async function mergeSaleCompWithPlatform(
  pool:           Pool,
  existingId:     string,
  existingSource: string,
  method:         DedupMatchMethod,
  candidate:      DedupCandidate,
): Promise<void> {
  const existing = await pool.query<{
    source_labels:  string[] | null;
    cap_rate:       string | null;
    units:          string | null;
    sqft:           string | null;
    year_built:     string | null;
    latitude:       string | null;
    longitude:      string | null;
    submarket:      string | null;
    asset_class:    string | null;
    msa:            string | null;
    county:         string | null;
    data_as_of:     string | null;
    sale_price:     string | null;
    price_per_unit: string | null;
    price_per_sqft: string | null;
    buyer:          string | null;
    seller:         string | null;
  }>(
    `SELECT source_labels, cap_rate, units, sqft, year_built, latitude, longitude,
            submarket, asset_class, msa, county, data_as_of,
            sale_price, price_per_unit, price_per_sqft, buyer, seller
       FROM market_sale_comps WHERE id = $1`,
    [existingId],
  );

  if (existing.rows.length === 0) return;

  const row = existing.rows[0];

  // ── Determine winner ────────────────────────────────────────────────────
  const platformScore = qualityScore(row);
  const costarScore = qualityScore(candidate);

  // CoStar wins if strictly higher quality, OR same quality with newer data_as_of
  const costarWins = costarScore > platformScore ||
    (costarScore === platformScore &&
      candidate.data_as_of != null &&
      row.data_as_of != null &&
      candidate.data_as_of > row.data_as_of);

  // ── Build new source_labels ─────────────────────────────────────────────
  const currentLabels: string[] = row.source_labels ?? [existingSource];
  const newLabels = Array.from(new Set([...currentLabels, 'costar_upload']));

  // ── Build SET clauses ───────────────────────────────────────────────────
  const setCols: string[] = ['source_labels = $2', 'dedup_match_method = $3'];
  const setVals: any[] = [existingId, newLabels, method];
  let pIdx = 4;

  const patch = (col: string, candidateVal: any, existingVal: any) => {
    if (candidateVal != null) {
      if (costarWins || existingVal == null) {
        // CoStar wins: always overwrite; platform wins: only fill NULL fields
        setCols.push(`${col} = $${pIdx}`);
        setVals.push(candidateVal);
        pIdx++;
      }
    }
  };

  patch('submarket',      candidate.submarket,      row.submarket);
  patch('asset_class',    candidate.asset_class,    row.asset_class);
  patch('cap_rate',       candidate.cap_rate,       row.cap_rate);
  patch('units',          candidate.units,          row.units);
  patch('sqft',           candidate.sqft,           row.sqft);
  patch('year_built',     candidate.year_built,     row.year_built);
  patch('msa',            candidate.msa,            row.msa);
  patch('county',         candidate.county,         row.county);
  patch('latitude',       candidate.latitude,       row.latitude);
  patch('longitude',      candidate.longitude,      row.longitude);

  // Financial fields — only overwrite when CoStar wins (these are transaction values)
  if (costarWins) {
    const fin = (col: string, val: any) => {
      if (val != null) {
        setCols.push(`${col} = $${pIdx}`);
        setVals.push(val);
        pIdx++;
      }
    };
    fin('sale_price',     candidate.sale_price);
    fin('price_per_unit', candidate.price_per_unit);
    fin('price_per_sqft', candidate.price_per_sqft);
    fin('buyer',          candidate.buyer);
    fin('seller',         candidate.seller);
    if (candidate.data_as_of != null) {
      setCols.push(`data_as_of = $${pIdx}`);
      setVals.push(candidate.data_as_of);
      pIdx++;
    }
  }

  await pool.query(
    `UPDATE market_sale_comps SET ${setCols.join(', ')} WHERE id = $1`,
    setVals,
  );
}
