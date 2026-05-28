/**
 * Subject Population Service — D-DEAL-2 / D-DEAL-3
 * Task #1406 Wave B
 *
 * D-DEAL-2: Reads deal + extraction sources and writes subject fields
 *   (units, building_sf, year_built, building_class, lat/lng, submarket_id,
 *    city, state_code) to the linked `properties` row with provenance tags.
 *
 * D-DEAL-3: Completeness gate — returns a structured missing-fields list
 *   before any valuation module runs so the UI can surface actionable prompts.
 *
 * Source priority per field
 * ─────────────────────────
 * units        : extraction_rent_roll.total_units > broker_claims.property.units > deals.target_units
 * building_sf  : broker_claims.property.buildingSf > null
 * year_built   : broker_claims.property.yearBuilt  > data_library_files.year_built > null
 * building_class: broker_claims.property.assetClass / buildingClass > null
 * lat / lng    : deals.latitude/longitude > ST_Centroid(deals.boundary) > null
 * city         : deals.city > address token > null
 * state_code   : deals.state_code > address token > null
 * submarket_id : PostGIS nearest centroid in `submarkets` (only if lat/lng resolved) > null
 *
 * All writes use COALESCE so an existing value is never overwritten by a lower-
 * priority source. To force a re-population, clear the field first.
 *
 * LayeredValue provenance note: `properties` uses scalar columns (integer,
 * varchar, float8) — not JSONB LayeredValue bags. Provenance is tracked in
 * the `PopulationResult.sources` map returned by the call site and logged to
 * the console; it is NOT persisted to the DB. LayeredValue provenance (the
 * stanceModulated / resolvedFrom pattern) lives in `deal_assumptions` JSONB,
 * which is a separate schema contract owned by the Cashflow Agent / F9 layer.
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

export interface PopulationResult {
  dealId: string;
  propertyId: string | null;
  fieldsWritten: string[];
  fieldsAlreadySet: string[];
  fieldsMissing: string[];
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
    // Skip country tokens
    if (/united states|usa|us$/i.test(p)) continue;
    // Look for "State 12345" pattern (state + zip)
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
         d.deal_data->'broker_claims'->'property'->>'buildingSf'
                                                       AS om_building_sf,
         -- Rent roll extraction — same guard against non-numeric text.
         NULLIF(REGEXP_REPLACE(
           COALESCE(d.deal_data->'extraction_rent_roll'->>'total_units',''),
           '[^0-9]', '', 'g'), '')::integer            AS rr_units
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

    const sources: Record<string, string> = {};

    // units: rent_roll > om_parse > deal_intake
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

    // building_sf: om_parse > null
    let resolvedBuildingSf: number | null = null;
    if (s.om_building_sf != null) {
      resolvedBuildingSf = parseFloat(s.om_building_sf);
      if (!isNaN(resolvedBuildingSf) && resolvedBuildingSf > 0) {
        sources.building_sf = 'broker_claims_om';
      } else {
        resolvedBuildingSf = null;
      }
    }

    // year_built: om_parse > data_library_files (checked below) > null
    let resolvedYearBuilt: number | null = null;
    if (s.om_year_built != null) {
      const parsed = parseInt(s.om_year_built, 10);
      if (!isNaN(parsed) && parsed > 1800 && parsed <= new Date().getFullYear() + 5) {
        resolvedYearBuilt = parsed;
        sources.year_built = 'broker_claims_om';
      }
    }

    // Fallback year_built from data_library_files linked to this deal
    if (resolvedYearBuilt == null) {
      const libFile = await this.pool.query(
        `SELECT dlf.year_built
         FROM deal_document_files ddf
         JOIN data_library_files dlf
           ON dlf.file_path = ddf.s3_key
         WHERE ddf.deal_id = $1::uuid
           AND dlf.year_built IS NOT NULL
         ORDER BY dlf.created_at DESC
         LIMIT 1`,
        [dealId]
      );
      if (libFile.rows.length > 0) {
        const parsed = parseInt(libFile.rows[0].year_built, 10);
        if (!isNaN(parsed) && parsed > 1800) {
          resolvedYearBuilt = parsed;
          sources.year_built = 'data_library_files';
        }
      }
    }

    // building_class: om_parse (buildingClass || assetClass) > null
    let resolvedBuildingClass: string | null =
      s.om_building_class || s.om_asset_class || null;
    if (resolvedBuildingClass) {
      // Normalise to single letter A/B/C if possible
      const match = resolvedBuildingClass.match(/^[ABC]/i);
      resolvedBuildingClass = match ? match[0].toUpperCase() : resolvedBuildingClass;
      sources.building_class = 'broker_claims_om';
    }

    // lat / lng: deals.latitude/longitude > boundary centroid > null
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

    // city / state_code: deals columns > address parse > null
    let resolvedCity: string | null = s.deal_city || null;
    let resolvedStateCode: string | null = s.deal_state_code || null;
    if (!resolvedCity || !resolvedStateCode) {
      const parsed = parseAddressTokens(s.deal_address || '');
      if (!resolvedCity) resolvedCity = parsed.city;
      if (!resolvedStateCode) resolvedStateCode = parsed.stateCode;
    }
    if (resolvedCity) sources.city = 'deal_table';
    if (resolvedStateCode) sources.state_code = 'deal_table';

    // submarket_id: PostGIS nearest centroid if we have lat/lng > null
    // Only attempt if we resolved geocode and the current submarket_id is null
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

    // ── Step 3: Write resolved values via COALESCE ───────────────────────────

    const fieldsWritten: string[] = [];
    const fieldsAlreadySet: string[] = [];
    const fieldsMissing: string[] = [];

    // Classify each field
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

    for (const f of fieldMap) {
      if (f.cur != null) {
        fieldsAlreadySet.push(f.field);
      } else if (f.resolved == null) {
        fieldsMissing.push(f.field);
      } else {
        fieldsWritten.push(f.field);
      }
    }

    if (fieldsWritten.length > 0) {
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

    // Determine which fields to check based on purpose
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

    // "complete" = all required fields are present (units at minimum)
    const requiredMissing = missingFields.filter(f => FIELD_META[f.field]?.required);

    return {
      complete: requiredMissing.length === 0,
      missingFields,
      availableFields,
    };
  }
}

export const subjectPopulationService = new SubjectPopulationService();
