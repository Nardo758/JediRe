/**
 * Property REST Routes
 * CRUD operations for properties
 */

import { Router, Response } from 'express';
import { query } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { validate, propertySchemas } from '../../utils/validators';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/v1/properties
 * List properties with filters
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const {
      city,
      state,
      zipCode,
      propertyType,
      minLotSize,
      maxLotSize,
      address,
      limit = 50,
      offset = 0,
    } = req.query;

    let queryText = 'SELECT * FROM properties WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    // Address search — used by agent fetch_parcel tool for address-based lookup
    // Column is address_line1 (the canonical address field in the properties table)
    if (address) {
      queryText += ` AND address_line1 ILIKE $${paramIndex}`;
      params.push(`%${address}%`);
      paramIndex++;
    }

    // Apply filters
    if (city) {
      queryText += ` AND city ILIKE $${paramIndex}`;
      params.push(`%${city}%`);
      paramIndex++;
    }

    if (state) {
      queryText += ` AND state_code = $${paramIndex}`;
      params.push(state);
      paramIndex++;
    }

    if (zipCode) {
      queryText += ` AND zip_code = $${paramIndex}`;
      params.push(zipCode);
      paramIndex++;
    }

    if (propertyType) {
      queryText += ` AND property_type = $${paramIndex}`;
      params.push(propertyType);
      paramIndex++;
    }

    if (minLotSize) {
      queryText += ` AND lot_size_sqft >= $${paramIndex}`;
      params.push(minLotSize);
      paramIndex++;
    }

    if (maxLotSize) {
      queryText += ` AND lot_size_sqft <= $${paramIndex}`;
      params.push(maxLotSize);
      paramIndex++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({
      properties: result.rows,
      count: result.rows.length,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/properties/:id
 * Get single property by ID
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Prefer the enriched view (includes zoning) when available, but fall back
    // to the base properties table so callers don't 404 on properties that
    // simply lack zoning data — and so we don't 500 in environments where the
    // view hasn't been created yet.
    let result: { rows: any[] } = { rows: [] };
    try {
      result = await query(
        'SELECT * FROM properties_with_zoning WHERE id = $1',
        [id]
      );
    } catch (viewErr: any) {
      // Only swallow the "view does not exist" error (Postgres 42P01) —
      // permissions errors, syntax errors, connection failures, etc. should
      // still surface so we don't mask real problems behind a silent fallback.
      if (viewErr?.code !== '42P01') {
        throw viewErr;
      }
      logger.warn('properties_with_zoning view missing, falling back to base table', {
        propertyId: id,
        err: viewErr?.message,
      });
    }

    if (result.rows.length === 0) {
      result = await query('SELECT * FROM properties WHERE id = $1', [id]);
    }

    if (result.rows.length === 0) {
      throw new AppError(404, 'Property not found');
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/properties
 * Create new property
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { error, value } = validate(propertySchemas.create, req.body);
    if (error) {
      throw new AppError(400, error);
    }

    const {
      addressLine1,
      addressLine2,
      city,
      stateCode,
      zipCode,
      county,
      latitude,
      longitude,
      lotSizeSqft,
      buildingSqft,
      yearBuilt,
      bedrooms,
      bathrooms,
      currentUse,
      propertyType,
    } = value;

    const result = await query(
      `INSERT INTO properties (
        address_line1, address_line2, city, state_code, zip_code, county,
        latitude, longitude, lot_size_sqft, building_sqft, year_built,
        bedrooms, bathrooms, current_use, property_type, analyzed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        addressLine1,
        addressLine2,
        city,
        stateCode,
        zipCode,
        county,
        latitude,
        longitude,
        lotSizeSqft,
        buildingSqft,
        yearBuilt,
        bedrooms,
        bathrooms,
        currentUse,
        propertyType,
        req.user!.userId,
      ]
    );

    logger.info('Property created:', result.rows[0].id);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/properties/:id
 * Update property
 */
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Check if property exists
    const existing = await query('SELECT * FROM properties WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new AppError(404, 'Property not found');
    }

    const updates = req.body;
    const allowedFields = [
      'lot_size_sqft',
      'lot_size_acres',
      'parcel_id',
      'land_cost',
      'building_sqft',
      'year_built',
      'bedrooms',
      'bathrooms',
      'current_use',
      'property_type',
    ];

    // Build dynamic update query
    const setClause = [];
    const params = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClause.push(`${field} = $${paramIndex}`);
        params.push(updates[field]);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      throw new AppError(400, 'No valid fields to update');
    }

    params.push(id);

    const result = await query(
      `UPDATE properties SET ${setClause.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/properties/:id
 * Delete property
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM properties WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      throw new AppError(404, 'Property not found');
    }

    logger.info('Property deleted:', id);

    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/properties/nearby
 * Find properties within radius
 */
router.get('/nearby/:lat/:lng', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { lat, lng } = req.params;
    const { radius = 1000 } = req.query; // meters

    const result = await query(
      `SELECT *, 
              ST_Distance(location, ST_SetSRID(ST_Point($1, $2), 4326)::geography) as distance
       FROM properties
       WHERE ST_DWithin(location, ST_SetSRID(ST_Point($1, $2), 4326)::geography, $3)
       ORDER BY distance
       LIMIT 50`,
      [lng, lat, radius]
    );

    res.json({
      properties: result.rows,
      count: result.rows.length,
      center: { lat: parseFloat(lat), lng: parseFloat(lng) },
      radius: parseInt(radius as string),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/properties/scrape/fulton
 * Scrape property data from Fulton County API
 */
router.post('/scrape/fulton', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { address, parcelId } = req.body;

    if (!address && !parcelId) {
      throw new AppError(400, 'Either address or parcelId is required');
    }

    // Call the property API worker
    const apiUrl = 'https://property-api.m-dixon5030.workers.dev/scrape';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, parcelId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new AppError(response.status, error.error || 'Failed to scrape property');
    }

    const data = await response.json();

    if (!data.success || !data.property) {
      throw new AppError(404, 'Property not found');
    }

    const prop = data.property;

    // Insert or update property record
    const result = await query(
      `INSERT INTO property_records (
        parcel_id, county, state_code, address, city, zip_code,
        property_type, year_built, building_sqft, lot_size_sqft, lot_size_acres,
        land_assessed_value, improvement_assessed_value, total_assessed_value,
        owner_name, owner_type, owner_address, owner_city, owner_state, owner_zip,
        subdivision, data_source_url, scraped_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
      )
      ON CONFLICT (parcel_id) DO UPDATE SET
        address = EXCLUDED.address,
        property_type = EXCLUDED.property_type,
        total_assessed_value = EXCLUDED.total_assessed_value,
        owner_name = EXCLUDED.owner_name,
        scraped_at = EXCLUDED.scraped_at
      RETURNING *`,
      [
        prop.parcelId,
        prop.county,
        prop.state,
        prop.address,
        prop.city || null,
        prop.zip || null,
        prop.propertyType || null,
        prop.yearBuilt || null,
        prop.buildingSqft || null,
        prop.lotSizeSqft || null,
        prop.lotSizeAcres || null,
        prop.landAssessedValue || null,
        prop.improvementAssessedValue || null,
        prop.totalAssessedValue || null,
        prop.ownerName || null,
        prop.ownerType || null,
        prop.ownerAddress || null,
        prop.ownerCity || null,
        prop.ownerState || null,
        prop.ownerZip || null,
        prop.subdivision || null,
        prop.dataSourceUrl || null,
        prop.scrapedAt || new Date(),
      ]
    );

    logger.info('Property scraped and saved', {
      userId: req.user?.userId,
      parcelId: prop.parcelId,
      address: prop.address,
    });

    res.json({
      success: true,
      property: result.rows[0],
      scrapeDurationMs: data.durationMs,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/properties/by-parcel/:parcelId/summary
 *
 * Returns the merged property + property_descriptions record for a county
 * parcel ID. Includes regulatory_constraints (M02 output) when available.
 *
 * Used by:
 *   - M02 paired-read verification
 *   - Any consumer that needs the full enriched view for a known parcel
 */
router.get('/by-parcel/:parcelId/summary', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { parcelId } = req.params;
    if (!parcelId || !parcelId.trim()) {
      res.status(400).json({ error: 'parcelId is required' });
      return;
    }

    const result = await query(
      `SELECT
         p.id,
         p.parcel_id,
         p.address_line1,
         p.city,
         p.state_code,
         p.zip,
         p.property_type,
         p.year_built,
         p.lot_size_sqft,
         p.created_at,
         p.updated_at,
         pd.unit_count,
         pd.lot_size_acres,
         pd.assessed_value,
         pd.appraised_value,
         pd.owner,
         pd.county,
         pd.regulatory_constraints
       FROM properties p
       LEFT JOIN property_descriptions pd ON pd.parcel_id = p.parcel_id
       WHERE p.parcel_id = $1
       LIMIT 1`,
      [parcelId.trim()],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Property not found', parcelId });
      return;
    }

    const row = result.rows[0];
    res.json({
      parcel_id:              row.parcel_id,
      property_id:            row.id,
      address:                row.address_line1,
      city:                   row.city,
      state:                  row.state_code,
      zip:                    row.zip,
      property_type:          row.property_type,
      year_built:             row.year_built,
      lot_size_sqft:          row.lot_size_sqft,
      // LayeredValue fields from property_descriptions
      unit_count:             row.unit_count,
      lot_size_acres:         row.lot_size_acres,
      assessed_value:         row.assessed_value,
      appraised_value:        row.appraised_value,
      owner:                  row.owner,
      county:                 row.county,
      // M02 output
      regulatory_constraints: row.regulatory_constraints ?? null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/properties/vault-intel/:dealId
 *
 * Returns the enriched property profile (vault data) for the deal's subject
 * property — municipal attributes, web search narrative, Places amenity flags,
 * regulatory constraints, and enrichment step outcomes.
 *
 * Used by the Property Profile card in the Deal Intelligence Skills panel.
 */
router.get('/vault-intel/:dealId', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { dealId } = req.params;

    if (!dealId || !dealId.trim()) {
      res.status(400).json({ error: 'dealId is required' });
      return;
    }

    // Look up linked parcel from deal properties
    const parcelRes = await query(
      `SELECT p.parcel_id
       FROM properties p
       WHERE p.deal_id = $1
         AND p.parcel_id IS NOT NULL
       LIMIT 1`,
      [dealId.trim()],
    );

    if (parcelRes.rows.length === 0) {
      res.json({ found: false, parcel_id: null, message: 'No parcel linked to this deal' });
      return;
    }

    const parcelId: string = parcelRes.rows[0].parcel_id;

    const pdRes = await query(
      `SELECT pd.*,
              p.county, p.city, p.zip_code, p.parking_type,
              p.year_built AS prop_year_built,
              p.units      AS prop_units
       FROM property_descriptions pd
       LEFT JOIN properties p ON p.parcel_id = pd.parcel_id
       WHERE pd.parcel_id = $1
       LIMIT 1`,
      [parcelId],
    );

    if (pdRes.rows.length === 0) {
      res.json({ found: false, parcel_id: parcelId, message: 'No vault record for this parcel' });
      return;
    }

    const pd = pdRes.rows[0];

    const intakeRes = await query(
      `SELECT enrichment_log, updated_at
       FROM intake_jobs
       WHERE parcel_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [parcelId],
    );

    const resolvedLV = (lv: any): any => {
      if (lv == null) return null;
      if (typeof lv === 'object' && 'value' in lv) return lv.value ?? null;
      if (typeof lv === 'object' && 'resolved' in lv) return lv.resolved ?? null;
      return lv;
    };

    const resolvedSource = (lv: any): string => {
      if (lv == null) return 'municipal';
      if (typeof lv === 'object' && 'source' in lv) return String(lv.source);
      return 'municipal';
    };

    const resolveBoolean = (lv: any): boolean | null => {
      if (lv == null) return null;
      if (typeof lv === 'boolean') return lv;
      if (typeof lv === 'object' && 'value' in lv) return lv.value === true || lv.value === 'true';
      if (typeof lv === 'object' && 'resolved' in lv) return lv.resolved === true || lv.resolved === 'true';
      return null;
    };

    const reviews   = pd.reviews   ?? null;
    const photos    = pd.photos    ?? null;
    const sentiment = pd.sentiment_summary ?? null;
    const recentRaw = pd.recent_events ?? null;

    const placesRating = Array.isArray(reviews) && reviews.length > 0
      ? parseFloat(
          (reviews.map((r: any) => r.rating ?? r.stars).filter((r: any) => r != null && !isNaN(Number(r)))
            .reduce((a: number, b: any, _i: number, arr: any[]) => a + Number(b) / arr.length, 0)).toFixed(1),
        )
      : (typeof reviews === 'object' && reviews !== null && 'rating' in (reviews as object))
        ? parseFloat(String((reviews as any).rating)) ?? null
        : null;

    const rc = pd.regulatory_constraints ?? null;

    const rawLog: any[] = intakeRes.rows[0]?.enrichment_log ?? [];
    const enrichmentSteps = Array.isArray(rawLog)
      ? rawLog.map((s: any) => ({
          step:    String(s.step ?? s.name ?? 'unknown'),
          status:  s.status ?? 'pending',
          message: s.message ?? s.error ?? null,
          ran_at:  s.ran_at ?? s.runAt ?? null,
        }))
      : [];

    res.json({
      found: true,
      parcel_id: parcelId,
      vault_updated_at: pd.updated_at ? new Date(pd.updated_at).toISOString() : null,
      municipal: {
        owner:           resolvedLV(pd.owner),
        owner_source:    resolvedSource(pd.owner),
        year_built:      resolvedLV(pd.year_built) ?? pd.prop_year_built ?? null,
        total_units:     resolvedLV(pd.unit_count) ?? pd.prop_units ?? null,
        assessed_value:  resolvedLV(pd.assessed_value) != null ? parseFloat(resolvedLV(pd.assessed_value)) : null,
        appraised_value: resolvedLV(pd.appraised_value) != null ? parseFloat(resolvedLV(pd.appraised_value)) : null,
        land_area_acres: resolvedLV(pd.lot_size_acres) != null ? parseFloat(resolvedLV(pd.lot_size_acres)) : null,
        county:   pd.county   ?? null,
        city:     pd.city     ?? null,
        zip_code: pd.zip_code ?? null,
      },
      amenity_flags: {
        has_pool:              resolveBoolean(pd.has_pool),
        has_fitness:           resolveBoolean(pd.has_fitness),
        has_clubhouse:         resolveBoolean(pd.has_clubhouse),
        has_concierge:         resolveBoolean(pd.has_concierge),
        has_business_center:   resolveBoolean(pd.has_business_center),
        has_dog_park:          resolveBoolean(pd.has_dog_park),
        is_master_metered:     resolveBoolean(pd.is_master_metered),
        is_individual_metered: resolveBoolean(pd.is_individual_metered),
        parking_type:          pd.parking_type ?? null,
      },
      web_search: (pd.narrative || (Array.isArray(recentRaw) && recentRaw.length > 0)) ? {
        narrative:     pd.narrative ?? null,
        citations:     Array.isArray(pd.citations) ? pd.citations : [],
        recent_events: Array.isArray(recentRaw)
          ? recentRaw.slice(0, 10).map((e: any) => ({
              title:   String(e.title ?? e.headline ?? 'Untitled'),
              summary: e.summary ?? e.description ?? null,
              date:    e.date ?? e.published_at ?? null,
            }))
          : [],
      } : null,
      places: (placesRating != null || photos != null || sentiment != null) ? {
        rating:       placesRating,
        review_count: Array.isArray(reviews) ? reviews.length : null,
        photo_count:  Array.isArray(photos)  ? photos.length  : null,
        sentiment_summary: typeof sentiment === 'string' ? sentiment
          : (typeof sentiment === 'object' && sentiment !== null)
            ? String((sentiment as any).summary ?? '') : null,
      } : null,
      regulatory: rc ? {
        zone_code:    resolvedLV(rc.zone_code)    ?? null,
        jurisdiction: resolvedLV(rc.jurisdiction) ?? null,
        max_height:   resolvedLV(rc.max_height) != null ? parseFloat(String(resolvedLV(rc.max_height))) : null,
        max_fsr:      resolvedLV(rc.max_fsr ?? rc.far) != null ? parseFloat(String(resolvedLV(rc.max_fsr ?? rc.far))) : null,
        source:       rc.source_chain ? String(rc.source_chain[0] ?? 'municipal:m02') : 'municipal:m02',
      } : null,
      enrichment_steps: enrichmentSteps,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
