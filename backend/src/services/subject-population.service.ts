/**
 * Subject Population Service — D-DEAL-2 / D-DEAL-3
 * Task #1406 Wave B
 *
 * D-DEAL-2: Reads deal + extraction sources and writes subject fields
 *   (units, building_sf, year_built, building_class, lat/lng, submarket_id,
 *    city, state_code) to the linked `properties` row. Per-field provenance
 *    (source identifier + timestamp + value) is persisted to
 *    `deals.deal_data->'subject_population_meta'` so consumers can always
 *    inspect WHERE each value came from without a separate audit table.
 *
 * D-DEAL-3: Completeness gate — returns a structured missing-fields list
 *   before any valuation module runs so the UI can surface actionable prompts.
 *
 * Source priority per field
 * ─────────────────────────
 * All fields follow: county_records > OM/doc parse > deal intake > null
 *
 * county_records  — Highest trust. Reads from `data_library_files.year_built`
 *                   /`unit_count` where source_type indicates county-derived data
 *                   (e.g. tax rolls, assessor records). Full research-agent county
 *                   integration is tracked in Task #1429 — that path will write
 *                   county data directly into data_library_files or a dedicated
 *                   county_records table and then re-trigger this service.
 *
 * broker_claims_om — OM extraction: broker_claims.property.yearBuilt / units /
 *                    buildingSf / buildingClass. buildingSf is normalised by
 *                    stripping commas/non-numeric chars before parsing so that
 *                    values like "123,456" produce 123456, not 123.
 *
 * deal_intake     — deals.target_units, boundary centroid lat/lng, city, state.
 *
 * All writes use COALESCE so an existing value is never overwritten by a lower-
 * priority source. To force a re-population, clear the field first.
 *
 * Provenance schema (deals.deal_data->'subject_population_meta'):
 * {
 *   "units":      { "source": "extraction_rent_roll", "writtenAt": ISO8601, "value": 232 },
 *   "year_built": { "source": "broker_claims_om",     "writtenAt": ISO8601, "value": 2017 },
 *   ...
 * }
 *
 * LayeredValue note: `properties` uses scalar columns (integer, varchar, float8)
 * — not JSONB LayeredValue bags. The LayeredValue pattern (stanceModulated /
 * resolvedFrom) lives in `deal_assumptions` JSONB, which is owned by the
 * Cashflow Agent / F9 layer. Subject-field provenance is stored in
 * `deals.deal_data->'subject_population_meta'` instead.
 */

import { Pool } from 'pg';
import { getPool } from '../database/connection';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MissingField {
  field: string;
  label: string;
  suggestion: string;
  blocksModules: string[];
}

export interface SubjectCompletenessResult {
  complete: boolean;
  missingFields: MissingField[];
  availableFields: string[];
}

/** Persisted per-field provenance record in deals.deal_data->subject_population_meta */
export interface FieldProvenance {
  source: string;
  writtenAt: string;
  value: string | number | null;
}

export interface PopulationResult {
  dealId: string;
  propertyId: string | null;
  fieldsWritten: string[];
  fieldsAlreadySet: string[];
  fieldsMissing: string[];
  /** In-memory provenance map — also persisted to deals.deal_data->subject_population_meta */
  sources: Record<string, string>;
}

// ── Field metadata: human labels, suggestions, module impact ─────────────────

const FIELD_META: Record<string, {
  label: string;
  suggestion: string;
  blocksModules: string[];
  required: boolean;
}> = {
  units: {
    label: 'Unit count',
    suggestion: 'Upload an Offering Memorandum or enter the unit count in deal details.',
    blocksModules: ['per_unit_benchmark', 'sales_comp_ppu', 'sales_comp_psf'],
    required: true,
  },
  building_sf: {
    label: 'Building square footage',
    suggestion: 'Upload an Offering Memorandum or enter the rentable SF in deal details.',
    blocksModules: ['sales_comp_psf', 'replacement_cost'],
    required: false,
  },
  year_built: {
    label: 'Year built',
    suggestion: 'Upload an Offering Memorandum or look up the property in county records.',
    blocksModules: ['replacement_cost'],
    required: false,
  },
  building_class: {
    label: 'Building class (A / B / C)',
    suggestion: 'Upload an Offering Memorandum or enter the asset class in deal details.',
    blocksModules: ['per_unit_benchmark'],
    required: false,
  },
  latitude: {
    label: 'Property geocode (latitude / longitude)',
    suggestion: 'Ensure a valid street address is entered when creating the deal.',
    blocksModules: ['sales_comp_ppu', 'sales_comp_psf'],
    required: false,
  },
  submarket_id: {
    label: 'Submarket assignment',
    suggestion: 'Geocode the property first; submarket is auto-resolved from location.',
    blocksModules: [],
    required: false,
  },
};

// ── US state name → 2-letter code (subset) ───────────────────────────────────

const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR',
  california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS',
  kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM',
  'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};

function stateNameToCode(name: string): string | null {
  if (!name) return null;
  const trimmed = name.trim().toLowerCase();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return STATE_NAME_TO_CODE[trimmed] ?? null;
}

/**
 * Parse a full address string like
 * "464 Bishop Street NW, Atlanta, Georgia 30318, United States"
 * and extract city + state code.
 */
function parseAddressTokens(address: string): { city: string | null; stateCode: string | null } {
  if (!address) return { city: null, stateCode: null };
  const parts = address.split(',').map(p => p.trim());
  let city: string | null = null;
  let stateCode: string | null = null;

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (/united states|usa|us$/i.test(p)) continue;
    // "State 12345" pattern
    const stateZip = p.match(/^([A-Za-z\s]+?)\s+\d{5}(-\d{4})?$/);
    if (stateZip) {
      const candidate = stateZip[1].trim();
      const code = stateNameToCode(candidate);
      if (code) {
        stateCode = code;
        if (i > 0) city = parts[i - 1];
        continue;
      }
    }
    // 2-letter state code alone
    if (/^[A-Z]{2}$/.test(p)) {
      stateCode = p;
      if (i > 0) city = parts[i - 1];
    }
    // Full state name alone
    const code = stateNameToCode(p);
    if (code) {
      stateCode = code;
      if (i > 0) city = parts[i - 1];
    }
  }

  return { city, stateCode };
}

/**
 * Normalise a numeric string that may contain locale formatting (commas,
 * currency symbols, unit suffixes) into a plain decimal string before
 * calling parseFloat / parseInt. Examples:
 *   "123,456"  → "123456"   (comma-formatted SF)
 *   "132 units" → "132"
 *   "$60,000"  → "60000"
 *   "2017"     → "2017"
 */
function stripNonNumeric(raw: string | null | undefined, allowDecimal = true): string | null {
  if (raw == null) return null;
  // Keep digits, and optionally a single dot for decimals
  const cleaned = allowDecimal
    ? raw.replace(/[^0-9.]/g, '').replace(/\.(?=.*\.)/g, '') // strip all but last dot
    : raw.replace(/[^0-9]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class SubjectPopulationService {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool ?? getPool();
  }

  // ── D-DEAL-2: populate subject fields ──────────────────────────────────────

  async populateSubjectFields(dealId: string): Promise<PopulationResult> {
    // ── Step 1: Read all available sources in one query ──────────────────────
    const sourceQuery = await this.pool.query(
      `SELECT
         p.id                                          AS property_id,
         -- Current properties state
         p.units                                       AS cur_units,
         p.building_sf                                 AS cur_building_sf,
         p.year_built                                  AS cur_year_built,
         p.building_class                              AS cur_building_class,
         p.submarket_id                                AS cur_submarket_id,
         p.latitude                                    AS cur_latitude,
         p.longitude                                   AS cur_longitude,
         p.city                                        AS cur_city,
         p.state_code                                  AS cur_state_code,
         -- Deal intake
         COALESCE(d.target_units, d.unit_count)        AS deal_units,
         d.address                                     AS deal_address,
         d.city                                        AS deal_city,
         d.state_code                                  AS deal_state_code,
         d.latitude                                    AS deal_latitude,
         d.longitude                                   AS deal_longitude,
         CASE WHEN d.boundary IS NOT NULL
              THEN ST_Y(ST_Centroid(d.boundary)) END   AS boundary_lat,
         CASE WHEN d.boundary IS NOT NULL
              THEN ST_X(ST_Centroid(d.boundary)) END   AS boundary_lng,
         -- OM extraction (broker claims).
         -- Strip non-numeric chars before ::integer cast to handle strings like
         -- "232 units" or "232-unit" that the OM parser occasionally emits.
         NULLIF(REGEXP_REPLACE(
           COALESCE(d.deal_data->'broker_claims'->'property'->>'units',''),
           '[^0-9]', '', 'g'), '')::integer            AS om_units,
         d.deal_data->'broker_claims'->'property'->>'yearBuilt'
                                                       AS om_year_built,
         d.deal_data->'broker_claims'->'property'->>'buildingClass'
                                                       AS om_building_class,
         d.deal_data->'broker_claims'->'property'->>'assetClass'
                                                       AS om_asset_class,
         -- buildingSf: raw string preserved — comma normalisation done in TS
         d.deal_data->'broker_claims'->'property'->>'buildingSf'
                                                       AS om_building_sf,
         -- Rent roll extraction — same guard against non-numeric text.
         NULLIF(REGEXP_REPLACE(
           COALESCE(d.deal_data->'extraction_rent_roll'->>'total_units',''),
           '[^0-9]', '', 'g'), '')::integer            AS rr_units,
         -- Existing provenance meta (may already contain written fields)
         d.deal_data->'subject_population_meta'        AS existing_prov_meta
       FROM deals d
       LEFT JOIN properties p ON p.deal_id = d.id
       WHERE d.id = $1::uuid
       LIMIT 1`,
      [dealId]
    );

    if (sourceQuery.rows.length === 0) {
      return {
        dealId,
        propertyId: null,
        fieldsWritten: [],
        fieldsAlreadySet: [],
        fieldsMissing: ['no_property_row'],
        sources: {},
      };
    }

    const s = sourceQuery.rows[0];

    if (!s.property_id) {
      console.warn(`[SubjectPopulation] No linked properties row for deal ${dealId}. Skipping.`);
      return {
        dealId,
        propertyId: null,
        fieldsWritten: [],
        fieldsAlreadySet: [],
        fieldsMissing: ['no_property_row'],
        sources: {},
      };
    }

    // ── Step 2: Resolve best source per field ────────────────────────────────
    //
    // Priority chain: county_records > OM/doc extraction > deal intake
    //
    // COUNTY RECORDS (highest trust, Task #1429 stub)
    // ─────────────────────────────────────────────────
    // Full research-agent county integration is planned for Task #1429.
    // When that path is live, it will write county-sourced values into
    // data_library_files with source_type='county_records' (or a dedicated
    // county_records table) and re-trigger this service. For now, we read
    // from data_library_files with any source_type — the highest-quality
    // value available in the data library is used as a proxy for county
    // records until the dedicated integration exists.

    const sources: Record<string, string> = {};
    const now = new Date().toISOString();
    // Provenance records for persisted meta: field → { source, writtenAt, value }
    const provenanceMeta: Record<string, FieldProvenance> = {};

    // ── units: rent_roll > om_parse > deal_intake ────────────────────────────
    let resolvedUnits: number | null = null;
    if (s.rr_units != null && s.rr_units > 0) {
      resolvedUnits = Number(s.rr_units);
      sources.units = 'extraction_rent_roll';
    } else if (s.om_units != null && s.om_units > 0) {
      resolvedUnits = Number(s.om_units);
      sources.units = 'broker_claims_om';
    } else if (s.deal_units != null && s.deal_units > 0) {
      resolvedUnits = Number(s.deal_units);
      sources.units = 'deal_intake';
    }

    // ── building_sf: om_parse > null ─────────────────────────────────────────
    // Normalise comma-formatted values ("123,456" → 123456) before parseFloat
    // so that the standard US number formatting doesn't silently truncate SF.
    let resolvedBuildingSf: number | null = null;
    if (s.om_building_sf != null) {
      const sfStr = stripNonNumeric(s.om_building_sf, true);
      if (sfStr) {
        const sfVal = parseFloat(sfStr);
        if (!isNaN(sfVal) && sfVal > 0) {
          resolvedBuildingSf = sfVal;
          sources.building_sf = 'broker_claims_om';
        }
      }
    }

    // ── year_built: county_records stub > om_parse > data_library_assets ──────
    let resolvedYearBuilt: number | null = null;

    // County records stub (Task #1429): data_library_assets rows linked to this
    // deal with county/assessor source_types are the highest-trust year_built
    // source. Full research-agent county integration is tracked in Task #1429 —
    // that path will populate data_library_assets with source_type='county_records'
    // and re-trigger this service. For now, this query serves as the live hook
    // so the moment county data exists it flows through without code changes.
    const countyAsset = await this.pool.query(
      `SELECT year_built
       FROM data_library_assets
       WHERE deal_id = $1::uuid
         AND year_built IS NOT NULL
         AND source_type IN ('county_records', 'tax_bill', 'assessor')
       ORDER BY year_built DESC
       LIMIT 1`,
      [dealId]
    );
    if (countyAsset.rows.length > 0) {
      const parsed = parseInt(countyAsset.rows[0].year_built, 10);
      if (!isNaN(parsed) && parsed > 1800 && parsed <= new Date().getFullYear() + 5) {
        resolvedYearBuilt = parsed;
        sources.year_built = 'county_records';
      }
    }

    // OM extraction (broker claims)
    if (resolvedYearBuilt == null && s.om_year_built != null) {
      const ybStr = stripNonNumeric(s.om_year_built, false);
      if (ybStr) {
        const parsed = parseInt(ybStr, 10);
        if (!isNaN(parsed) && parsed > 1800 && parsed <= new Date().getFullYear() + 5) {
          resolvedYearBuilt = parsed;
          sources.year_built = 'broker_claims_om';
        }
      }
    }

    // Fallback: any data_library_assets row for this deal with year_built
    if (resolvedYearBuilt == null) {
      const libAsset = await this.pool.query(
        `SELECT year_built
         FROM data_library_assets
         WHERE deal_id = $1::uuid
           AND year_built IS NOT NULL
         ORDER BY year_built DESC
         LIMIT 1`,
        [dealId]
      );
      if (libAsset.rows.length > 0) {
        const ybStr = stripNonNumeric(libAsset.rows[0].year_built, false);
        if (ybStr) {
          const parsed = parseInt(ybStr, 10);
          if (!isNaN(parsed) && parsed > 1800) {
            resolvedYearBuilt = parsed;
            sources.year_built = 'data_library_assets';
          }
        }
      }
    }

    // ── building_class: om_parse (buildingClass || assetClass) > null ─────────
    let resolvedBuildingClass: string | null =
      s.om_building_class || s.om_asset_class || null;
    if (resolvedBuildingClass) {
      const match = resolvedBuildingClass.match(/^[ABC]/i);
      resolvedBuildingClass = match ? match[0].toUpperCase() : resolvedBuildingClass;
      sources.building_class = 'broker_claims_om';
    }

    // ── lat / lng: deals.latitude/longitude > boundary centroid > null ────────
    let resolvedLat: number | null = null;
    let resolvedLng: number | null = null;
    if (s.deal_latitude != null && s.deal_longitude != null) {
      resolvedLat = parseFloat(s.deal_latitude);
      resolvedLng = parseFloat(s.deal_longitude);
      if (!isNaN(resolvedLat) && !isNaN(resolvedLng)) {
        sources.latitude = 'deal_table';
        sources.longitude = 'deal_table';
      } else {
        resolvedLat = null;
        resolvedLng = null;
      }
    }
    if (resolvedLat == null && s.boundary_lat != null && s.boundary_lng != null) {
      resolvedLat = parseFloat(s.boundary_lat);
      resolvedLng = parseFloat(s.boundary_lng);
      if (!isNaN(resolvedLat) && !isNaN(resolvedLng)) {
        sources.latitude = 'boundary_centroid';
        sources.longitude = 'boundary_centroid';
      } else {
        resolvedLat = null;
        resolvedLng = null;
      }
    }

    // ── city / state_code: deals columns > address parse > null ───────────────
    let resolvedCity: string | null = s.deal_city || null;
    let resolvedStateCode: string | null = s.deal_state_code || null;
    if (!resolvedCity || !resolvedStateCode) {
      const parsed = parseAddressTokens(s.deal_address || '');
      if (!resolvedCity) resolvedCity = parsed.city;
      if (!resolvedStateCode) resolvedStateCode = parsed.stateCode;
    }
    if (resolvedCity) sources.city = 'deal_table';
    if (resolvedStateCode) sources.state_code = 'deal_table';

    // ── submarket_id: PostGIS nearest centroid > null ─────────────────────────
    let resolvedSubmarketId: string | null = null;
    const latForSubmarket = resolvedLat ?? (s.cur_latitude != null ? parseFloat(s.cur_latitude) : null);
    const lngForSubmarket = resolvedLng ?? (s.cur_longitude != null ? parseFloat(s.cur_longitude) : null);
    if (s.cur_submarket_id == null && latForSubmarket != null && lngForSubmarket != null) {
      try {
        const smResult = await this.pool.query(
          `SELECT id
           FROM submarkets
           WHERE geometry IS NOT NULL
           ORDER BY geometry <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
           LIMIT 1`,
          [lngForSubmarket, latForSubmarket]
        );
        if (smResult.rows.length > 0) {
          resolvedSubmarketId = smResult.rows[0].id;
          sources.submarket_id = 'postgis_nearest';
        }
      } catch {
        // PostGIS may not be available or no submarket rows — silently skip
      }
    }

    // ── Step 3: Classify fields and write ────────────────────────────────────

    const fieldsWritten: string[] = [];
    const fieldsAlreadySet: string[] = [];
    const fieldsMissing: string[] = [];

    const fieldMap: Array<{ field: string; cur: unknown; resolved: unknown }> = [
      { field: 'units',          cur: s.cur_units,          resolved: resolvedUnits },
      { field: 'building_sf',    cur: s.cur_building_sf,    resolved: resolvedBuildingSf },
      { field: 'year_built',     cur: s.cur_year_built,     resolved: resolvedYearBuilt },
      { field: 'building_class', cur: s.cur_building_class, resolved: resolvedBuildingClass },
      { field: 'latitude',       cur: s.cur_latitude,       resolved: resolvedLat },
      { field: 'longitude',      cur: s.cur_longitude,      resolved: resolvedLng },
      { field: 'city',           cur: s.cur_city,           resolved: resolvedCity },
      { field: 'state_code',     cur: s.cur_state_code,     resolved: resolvedStateCode },
      { field: 'submarket_id',   cur: s.cur_submarket_id,   resolved: resolvedSubmarketId },
    ];

    // Build provenance records for every field that has a resolved source
    const resolvedValues: Record<string, string | number | null> = {
      units: resolvedUnits,
      building_sf: resolvedBuildingSf,
      year_built: resolvedYearBuilt,
      building_class: resolvedBuildingClass,
      latitude: resolvedLat,
      longitude: resolvedLng,
      city: resolvedCity,
      state_code: resolvedStateCode,
      submarket_id: resolvedSubmarketId,
    };

    for (const f of fieldMap) {
      if (f.cur != null) {
        fieldsAlreadySet.push(f.field);
        // Keep existing provenance entry if present; don't overwrite
      } else if (f.resolved == null) {
        fieldsMissing.push(f.field);
      } else {
        fieldsWritten.push(f.field);
        const src = sources[f.field] ?? sources[f.field.replace(/_.*/, '')] ?? 'unknown';
        provenanceMeta[f.field] = {
          source: src,
          writtenAt: now,
          value: resolvedValues[f.field] as string | number | null,
        };
      }
    }

    if (fieldsWritten.length > 0) {
      // Write scalar fields to properties
      await this.pool.query(
        `UPDATE properties
         SET
           units          = COALESCE(units,          $2::integer),
           building_sf    = COALESCE(building_sf,    $3::numeric),
           year_built     = COALESCE(year_built,     $4::integer),
           building_class = COALESCE(building_class, $5::varchar),
           latitude       = COALESCE(latitude,       $6::float8),
           longitude      = COALESCE(longitude,      $7::float8),
           lat            = COALESCE(lat,             $6::float8),
           lng            = COALESCE(lng,             $7::float8),
           city           = COALESCE(city,            $8::varchar),
           state_code     = COALESCE(state_code,      $9::varchar),
           submarket_id   = COALESCE(submarket_id,   $10::varchar),
           updated_at     = NOW()
         WHERE id = $1::uuid`,
        [
          s.property_id,
          resolvedUnits,
          resolvedBuildingSf,
          resolvedYearBuilt,
          resolvedBuildingClass,
          resolvedLat,
          resolvedLng,
          resolvedCity,
          resolvedStateCode,
          resolvedSubmarketId,
        ]
      );

      // Persist provenance to deals.deal_data->subject_population_meta.
      // Merge with existing meta so previous field provenance is preserved
      // when only a subset of fields is written on subsequent calls.
      if (Object.keys(provenanceMeta).length > 0) {
        await this.pool.query(
          `UPDATE deals
           SET deal_data = COALESCE(deal_data, '{}'::jsonb)
             || jsonb_build_object('subject_population_meta',
                  COALESCE(deal_data->'subject_population_meta', '{}'::jsonb)
                  || $2::jsonb)
           WHERE id = $1::uuid`,
          [dealId, JSON.stringify(provenanceMeta)]
        );
      }

      console.log(
        `[SubjectPopulation] deal=${dealId} wrote=[${fieldsWritten.join(',')}]` +
        ` already=[${fieldsAlreadySet.join(',')}]` +
        ` missing=[${fieldsMissing.join(',')}]`
      );
    }

    return {
      dealId,
      propertyId: s.property_id,
      fieldsWritten,
      fieldsAlreadySet,
      fieldsMissing,
      sources,
    };
  }

  // ── D-DEAL-3: completeness gate ─────────────────────────────────────────────

  /**
   * Returns a structured missing-fields checklist for a deal's subject property.
   * Callers (valuation grid, comp search, etc.) include this in their response
   * so the UI can surface actionable prompts without throwing a generic error.
   *
   * @param dealId  UUID of the deal
   * @param purpose  Optional filter: 'valuation_grid' | 'comp_search' | 'all'
   */
  async checkSubjectCompleteness(
    dealId: string,
    purpose: 'valuation_grid' | 'comp_search' | 'all' = 'all'
  ): Promise<SubjectCompletenessResult> {
    const result = await this.pool.query(
      `SELECT
         p.units,
         p.building_sf,
         p.year_built,
         p.building_class,
         p.latitude,
         p.longitude,
         p.submarket_id
       FROM deals d
       LEFT JOIN properties p ON p.deal_id = d.id
       WHERE d.id = $1::uuid
       LIMIT 1`,
      [dealId]
    );

    if (result.rows.length === 0) {
      return {
        complete: false,
        missingFields: [{
          field: 'property_row',
          label: 'Subject property record',
          suggestion: 'No linked property record found. Re-create the deal to generate one.',
          blocksModules: ['cap_rate_noi', 'per_unit_benchmark', 'sales_comp_ppu', 'sales_comp_psf'],
        }],
        availableFields: [],
      };
    }

    const row = result.rows[0];

    const fieldsToCheck: string[] = (() => {
      if (purpose === 'valuation_grid') {
        return ['units', 'building_sf', 'year_built', 'building_class', 'latitude', 'submarket_id'];
      }
      if (purpose === 'comp_search') {
        return ['units', 'latitude', 'submarket_id'];
      }
      return Object.keys(FIELD_META);
    })();

    const missingFields: MissingField[] = [];
    const availableFields: string[] = [];

    for (const field of fieldsToCheck) {
      const meta = FIELD_META[field];
      if (!meta) continue;
      const val = row[field];
      if (val == null) {
        missingFields.push({
          field,
          label: meta.label,
          suggestion: meta.suggestion,
          blocksModules: meta.blocksModules,
        });
      } else {
        availableFields.push(field);
      }
    }

    const requiredMissing = missingFields.filter(f => FIELD_META[f.field]?.required);

    return {
      complete: requiredMissing.length === 0,
      missingFields,
      availableFields,
    };
  }
}

export const subjectPopulationService = new SubjectPopulationService();
