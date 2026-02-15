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
      limit = 50,
      offset = 0,
    } = req.query;

    let queryText = 'SELECT * FROM properties WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

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

    const result = await query(
      'SELECT * FROM properties_with_zoning WHERE id = $1',
      [id]
    );

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

export default router;
