/**
 * PropertyResolverService
 * Phase 1 — Property Plumbing Refactor
 *
 * Handles property identity resolution: find-or-create by address or parcel,
 * deduplication, and merge/split operations. This is the single entry point
 * for any code that needs to resolve "which property entity does this data
 * belong to?" without hard-coding lookups scattered across services.
 *
 * No production writes yet — Phase 2 dual-write wires this in as the
 * standard resolution path for all incoming property data.
 */

import { query } from '../../database/connection';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface ResolvedProperty {
  id: string;
  parcelId: string | null;
  parcelIdCanonical: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  county: string | null;
  lat: number | null;
  lng: number | null;
  isSuperseded: boolean;
  predecessorPropertyId: string | null;
}

export interface ResolveByAddressInput {
  address: string;
  city?: string | null;
  state?: string | null;
  county?: string | null;
  lat?: number | null;
  lng?: number | null;
  createIfMissing?: boolean;
}

export interface ResolveByParcelInput {
  parcelIdRaw: string;
  county: string;
  state?: string;
  createIfMissing?: boolean;
}

export interface MergeResult {
  survivingPropertyId: string;
  mergedPropertyId: string;
  fieldsTransferred: string[];
}

// ----------------------------------------------------------------
// Canonical parcel ID helper
// ----------------------------------------------------------------

function buildCanonicalParcelId(
  state: string,
  county: string,
  rawParcelId: string
): string {
  // Strip known non-canonical prefixes already baked into some property_records rows
  // e.g. "FULTON-22 481411970839" → "481411970839"
  const stripped = rawParcelId
    .replace(/^[A-Z]+-\d+\s+/i, '')
    .trim()
    .toLowerCase();
  return `${state.toLowerCase()}-${county.toLowerCase().replace(/\s+/g, '_')}-${stripped}`;
}

function mapRow(row: Record<string, unknown>): ResolvedProperty {
  return {
    id: row.id as string,
    parcelId: (row.parcel_id as string) ?? null,
    parcelIdCanonical: (row.parcel_id_canonical as string) ?? null,
    address: (row.address as string) ?? null,
    city: (row.city as string) ?? null,
    state: (row.state as string) ?? null,
    county: (row.county as string) ?? null,
    lat: row.lat != null ? parseFloat(row.lat as string) : null,
    lng: row.lng != null ? parseFloat(row.lng as string) : null,
    isSuperseded: Boolean(row.is_superseded),
    predecessorPropertyId: (row.predecessor_property_id as string) ?? null,
  };
}

// ----------------------------------------------------------------
// Service
// ----------------------------------------------------------------

export class PropertyResolverService {
  /**
   * Find a property by its canonical parcel ID.
   * Returns the active (non-superseded) record.
   */
  async findByParcelCanonical(parcelIdCanonical: string): Promise<ResolvedProperty | null> {
    const result = await query(
      `SELECT id, parcel_id, parcel_id_canonical, address, city, state, county,
              lat, lng, is_superseded, predecessor_property_id
       FROM properties
       WHERE parcel_id_canonical = $1
         AND (is_superseded IS NULL OR is_superseded = FALSE)
       LIMIT 1`,
      [parcelIdCanonical]
    );
    return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
  }

  /**
   * Resolve a property by raw parcel ID + county.
   * Normalizes to canonical form and looks up. Creates if missing and
   * createIfMissing = true.
   *
   * This is the standard entry point for assessor data ingest.
   */
  async resolveByParcel(input: ResolveByParcelInput): Promise<ResolvedProperty | null> {
    const state = input.state ?? 'GA';
    const canonical = buildCanonicalParcelId(state, input.county, input.parcelIdRaw);

    const existing = await this.findByParcelCanonical(canonical);
    if (existing) return existing;

    if (!input.createIfMissing) return null;

    const result = await query(
      `INSERT INTO properties (parcel_id, parcel_id_canonical, county, state)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING
       RETURNING id, parcel_id, parcel_id_canonical, address, city, state, county,
                 lat, lng, is_superseded, predecessor_property_id`,
      [input.parcelIdRaw, canonical, input.county, state]
    );

    if (result.rows.length > 0) return mapRow(result.rows[0]);

    // Lost the race to a concurrent insert — fetch the winner
    return this.findByParcelCanonical(canonical);
  }

  /**
   * Resolve a property by address string.
   * Attempts exact address+city+state match first. If lat/lng provided,
   * also attempts geocode proximity match (within 50 m). Creates if
   * missing and createIfMissing = true.
   *
   * This is the standard entry point for deal address data.
   */
  async resolveByAddress(input: ResolveByAddressInput): Promise<ResolvedProperty | null> {
    const normalizedAddress = input.address.trim().toLowerCase();

    // 1. Exact address + city + state match
    const exactResult = await query(
      `SELECT id, parcel_id, parcel_id_canonical, address, city, state, county,
              lat, lng, is_superseded, predecessor_property_id
       FROM properties
       WHERE LOWER(TRIM(address)) = $1
         AND ($2::TEXT IS NULL OR LOWER(city) = LOWER($2))
         AND ($3::TEXT IS NULL OR LOWER(state) = LOWER($3))
         AND (is_superseded IS NULL OR is_superseded = FALSE)
       LIMIT 1`,
      [normalizedAddress, input.city ?? null, input.state ?? null]
    );
    if (exactResult.rows.length > 0) return mapRow(exactResult.rows[0]);

    // 2. Geocode proximity match (within ~50 m) when lat/lng provided
    if (input.lat != null && input.lng != null) {
      const geoResult = await query(
        `SELECT id, parcel_id, parcel_id_canonical, address, city, state, county,
                lat, lng, is_superseded, predecessor_property_id,
                ( 6371000 * acos(
                    cos(radians($1)) * cos(radians(lat::FLOAT)) *
                    cos(radians(lng::FLOAT) - radians($2)) +
                    sin(radians($1)) * sin(radians(lat::FLOAT))
                  )
                ) AS distance_m
         FROM properties
         WHERE lat IS NOT NULL AND lng IS NOT NULL
           AND lat BETWEEN $1 - 0.0005 AND $1 + 0.0005
           AND lng BETWEEN $2 - 0.0005 AND $2 + 0.0005
           AND (is_superseded IS NULL OR is_superseded = FALSE)
         ORDER BY distance_m
         LIMIT 1`,
        [input.lat, input.lng]
      );

      if (geoResult.rows.length > 0) {
        const distanceM = parseFloat(geoResult.rows[0].distance_m as string);
        if (distanceM <= 50) return mapRow(geoResult.rows[0]);
      }
    }

    if (!input.createIfMissing) return null;

    // 3. Create new property record
    const result = await query(
      `INSERT INTO properties (address, city, state, county, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, parcel_id, parcel_id_canonical, address, city, state, county,
                 lat, lng, is_superseded, predecessor_property_id`,
      [
        input.address,
        input.city ?? null,
        input.state ?? null,
        input.county ?? null,
        input.lat ?? null,
        input.lng ?? null,
      ]
    );
    return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
  }

  /**
   * Merge two property records: mark mergedId as superseded,
   * point its data at survivingId. Does NOT move related table rows —
   * that is a Phase 2 backfill concern. This method updates identity
   * only (the properties row itself).
   *
   * Returns a summary of what changed.
   */
  async mergeProperties(
    survivingPropertyId: string,
    mergedPropertyId: string
  ): Promise<MergeResult> {
    if (survivingPropertyId === mergedPropertyId) {
      throw new Error('Cannot merge a property into itself');
    }

    // Mark merged row as superseded
    await query(
      `UPDATE properties
       SET is_superseded = TRUE,
           predecessor_property_id = $2,
           superseded_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [mergedPropertyId, survivingPropertyId]
    );

    // Surviving row: copy any non-null fields from merged if surviving is missing them
    await query(
      `UPDATE properties p_surviving
       SET
         parcel_id          = COALESCE(p_surviving.parcel_id, p_merged.parcel_id),
         parcel_id_canonical= COALESCE(p_surviving.parcel_id_canonical, p_merged.parcel_id_canonical),
         address            = COALESCE(p_surviving.address, p_merged.address),
         city               = COALESCE(p_surviving.city, p_merged.city),
         state              = COALESCE(p_surviving.state, p_merged.state),
         county             = COALESCE(p_surviving.county, p_merged.county),
         lat                = COALESCE(p_surviving.lat, p_merged.lat),
         lng                = COALESCE(p_surviving.lng, p_merged.lng),
         updated_at         = NOW()
       FROM properties p_merged
       WHERE p_surviving.id = $1 AND p_merged.id = $2`,
      [survivingPropertyId, mergedPropertyId]
    );

    return {
      survivingPropertyId,
      mergedPropertyId,
      fieldsTransferred: ['parcel_id', 'parcel_id_canonical', 'address', 'city', 'state', 'county', 'lat', 'lng'],
    };
  }

  /**
   * Build the canonical parcel ID string from parts.
   * Exposed for use by backfill scripts and ingest pipelines.
   */
  buildCanonicalParcelId(state: string, county: string, rawParcelId: string): string {
    return buildCanonicalParcelId(state, county, rawParcelId);
  }
}

export const propertyResolverService = new PropertyResolverService();
