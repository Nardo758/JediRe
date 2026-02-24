import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getPool } from '../../database/connection';

const router = Router();
const pool = getPool();

const numField = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().nullable().optional()
);
const percentField = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().min(0).max(100).nullable().optional()
);
const posIntField = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().positive().int().nullable().optional()
);

const UnitMixItemSchema = z.object({
  percent: z.number().min(0).max(100).default(0),
  count: z.number().min(0).default(0),
});

const ZoningCapacitySchema = z.object({
  zoning_code: z.string().nullable().optional(),
  base_zoning: z.enum(['residential', 'mixed-use', 'commercial', 'industrial']).nullable().optional(),
  max_density: numField,
  max_far: numField,
  max_height_feet: posIntField,
  max_stories: posIntField,
  min_parking_per_unit: numField,
  affordable_housing_bonus: z.boolean().optional(),
  affordable_bonus_percent: percentField,
  tdr_available: z.boolean().optional(),
  tdr_bonus_percent: percentField,
  overlay_zones: z.array(z.string()).optional(),
  special_restrictions: z.array(z.string()).optional(),
  zoning_notes: z.string().nullable().optional(),
  unit_mix: z.object({
    studio: UnitMixItemSchema.optional(),
    oneBR: UnitMixItemSchema.optional(),
    twoBR: UnitMixItemSchema.optional(),
    threeBR: UnitMixItemSchema.optional(),
  }).nullable().optional(),
  avg_rent_per_unit: numField,
});

function calculateUnitMix(unitMix: any, totalUnits: number) {
  if (!unitMix) return null;
  const result = { ...unitMix };
  for (const key of ['studio', 'oneBR', 'twoBR', 'threeBR']) {
    if (result[key]) {
      result[key] = {
        percent: result[key].percent || 0,
        count: Math.floor(((result[key].percent || 0) / 100) * totalUnits),
      };
    }
  }
  return result;
}

function calculateRevenue(avgRent: number | null | undefined, totalUnits: number) {
  if (!avgRent || totalUnits <= 0) return { annual_revenue: null, pro_forma_noi: null, estimated_value: null };
  const annualRevenue = avgRent * totalUnits * 12;
  const noi = annualRevenue * 0.60;
  const estimatedValue = noi / 0.05;
  return {
    annual_revenue: Math.round(annualRevenue * 100) / 100,
    pro_forma_noi: Math.round(noi * 100) / 100,
    estimated_value: Math.round(estimatedValue * 100) / 100,
  };
}

router.get('/deals/:dealId/zoning-capacity', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const result = await pool.query(
      'SELECT * FROM zoning_capacity WHERE deal_id = $1',
      [dealId]
    );
    if (result.rows.length === 0) {
      return res.json(null);
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching zoning capacity:', error);
    res.status(500).json({ error: 'Failed to fetch zoning capacity' });
  }
});

router.post('/deals/:dealId/zoning-capacity', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const validatedData = ZoningCapacitySchema.parse(req.body);

    const capacityResult = await pool.query(
      `SELECT * FROM calculate_max_units($1::uuid, $2::decimal, $3::decimal, $4::integer, $5::decimal, 850, 10, NULL)`,
      [
        dealId,
        validatedData.max_density || null,
        validatedData.max_far || null,
        validatedData.max_height_feet || null,
        validatedData.min_parking_per_unit || null,
      ]
    );

    const capacity = capacityResult.rows[0] || { max_units: 0, limiting_factor: 'unknown', buildable_sq_ft: 0 };
    const maxUnitsByRight = capacity.max_units || 0;

    let bonusPercent = 0;
    if (validatedData.affordable_housing_bonus) {
      bonusPercent += validatedData.affordable_bonus_percent ?? 25;
    }
    if (validatedData.tdr_available) {
      bonusPercent += validatedData.tdr_bonus_percent ?? 15;
    }
    const maxUnitsWithIncentives = Math.floor(maxUnitsByRight * (1 + bonusPercent / 100));

    let coverageRatio = 0;
    try {
      const boundaryResult = await pool.query(
        'SELECT metrics FROM property_boundaries WHERE deal_id = $1',
        [dealId]
      );
      if (boundaryResult.rows.length > 0) {
        const metrics = boundaryResult.rows[0].metrics;
        const totalArea = metrics?.area || 0;
        const buildableArea = metrics?.buildableArea || totalArea;
        if (totalArea > 0) {
          coverageRatio = parseFloat(((buildableArea / totalArea) * 100).toFixed(2));
        }
      }
    } catch {}

    const unitMix = calculateUnitMix(validatedData.unit_mix, maxUnitsWithIncentives);
    const revenueMetrics = calculateRevenue(validatedData.avg_rent_per_unit, maxUnitsWithIncentives);

    const result = await pool.query(
      `INSERT INTO zoning_capacity (
        deal_id, zoning_code, base_zoning, max_density, max_far,
        max_height_feet, max_stories, min_parking_per_unit,
        affordable_housing_bonus, affordable_bonus_percent,
        tdr_available, tdr_bonus_percent,
        overlay_zones, special_restrictions, zoning_notes,
        max_units_by_right, max_units_with_incentives,
        limiting_factor, buildable_sq_ft, coverage_ratio,
        unit_mix, avg_rent_per_unit,
        annual_revenue, pro_forma_noi, estimated_value
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10,
        $11, $12,
        $13, $14, $15,
        $16, $17,
        $18, $19, $20,
        $21, $22,
        $23, $24, $25
      )
      ON CONFLICT (deal_id) DO UPDATE SET
        zoning_code = EXCLUDED.zoning_code,
        base_zoning = EXCLUDED.base_zoning,
        max_density = EXCLUDED.max_density,
        max_far = EXCLUDED.max_far,
        max_height_feet = EXCLUDED.max_height_feet,
        max_stories = EXCLUDED.max_stories,
        min_parking_per_unit = EXCLUDED.min_parking_per_unit,
        affordable_housing_bonus = EXCLUDED.affordable_housing_bonus,
        affordable_bonus_percent = EXCLUDED.affordable_bonus_percent,
        tdr_available = EXCLUDED.tdr_available,
        tdr_bonus_percent = EXCLUDED.tdr_bonus_percent,
        overlay_zones = EXCLUDED.overlay_zones,
        special_restrictions = EXCLUDED.special_restrictions,
        zoning_notes = EXCLUDED.zoning_notes,
        max_units_by_right = EXCLUDED.max_units_by_right,
        max_units_with_incentives = EXCLUDED.max_units_with_incentives,
        limiting_factor = EXCLUDED.limiting_factor,
        buildable_sq_ft = EXCLUDED.buildable_sq_ft,
        coverage_ratio = EXCLUDED.coverage_ratio,
        unit_mix = EXCLUDED.unit_mix,
        avg_rent_per_unit = EXCLUDED.avg_rent_per_unit,
        annual_revenue = EXCLUDED.annual_revenue,
        pro_forma_noi = EXCLUDED.pro_forma_noi,
        estimated_value = EXCLUDED.estimated_value,
        updated_at = NOW()
      RETURNING *`,
      [
        dealId,
        validatedData.zoning_code || null,
        validatedData.base_zoning || null,
        validatedData.max_density || null,
        validatedData.max_far || null,
        validatedData.max_height_feet || null,
        validatedData.max_stories || null,
        validatedData.min_parking_per_unit || null,
        validatedData.affordable_housing_bonus ?? false,
        validatedData.affordable_bonus_percent ?? 25,
        validatedData.tdr_available ?? false,
        validatedData.tdr_bonus_percent ?? 15,
        validatedData.overlay_zones || [],
        validatedData.special_restrictions || [],
        validatedData.zoning_notes || null,
        maxUnitsByRight,
        maxUnitsWithIncentives,
        capacity.limiting_factor || 'unknown',
        capacity.buildable_sq_ft || 0,
        coverageRatio,
        unitMix ? JSON.stringify(unitMix) : null,
        validatedData.avg_rent_per_unit || null,
        revenueMetrics.annual_revenue,
        revenueMetrics.pro_forma_noi,
        revenueMetrics.estimated_value,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: (error as any).issues });
    }
    console.error('Error saving zoning capacity:', error);
    res.status(500).json({ error: 'Failed to save zoning capacity' });
  }
});

router.get('/zoning-districts/lookup', async (req: Request, res: Response) => {
  try {
    const { code, municipality, city, state } = req.query;
    const cityName = (municipality || city || '') as string;

    if (code) {
      const result = await pool.query(
        `SELECT zd.*, m.name as municipality_name, m.state as municipality_state
         FROM zoning_districts zd
         LEFT JOIN municipalities m ON m.id = zd.municipality_id
         WHERE (UPPER(COALESCE(zd.zoning_code, zd.district_code)) = UPPER($1))
         ${cityName ? 'AND (UPPER(COALESCE(zd.municipality, m.name)) = UPPER($2) OR zd.municipality_id = LOWER($2))' : ''}
         LIMIT 1`,
        cityName ? [code, cityName] : [code]
      );
      if (result.rows.length > 0) {
        return res.json(result.rows[0]);
      }
      return res.json(null);
    }

    const params: string[] = [];
    let where = 'WHERE 1=1';
    if (cityName) {
      params.push(cityName);
      where += ` AND (UPPER(COALESCE(zd.municipality, m.name)) = UPPER($${params.length}) OR zd.municipality_id = LOWER($${params.length}))`;
    }
    if (state) {
      params.push(state as string);
      where += ` AND UPPER(COALESCE(zd.state, m.state)) = UPPER($${params.length})`;
    }

    const result = await pool.query(
      `SELECT zd.id, 
              COALESCE(zd.zoning_code, zd.district_code) as district_code,
              zd.district_name, 
              COALESCE(zd.municipality, m.name) as municipality,
              COALESCE(zd.state, m.state) as state, 
              COALESCE(zd.max_height_feet, zd.max_building_height_ft) as max_building_height_ft,
              zd.max_stories,
              zd.max_far,
              COALESCE(zd.max_density_per_acre, zd.max_units_per_acre) as max_units_per_acre,
              COALESCE(zd.min_parking_per_unit, zd.parking_per_unit) as parking_per_unit,
              zd.parking_per_1000_sqft,
              zd.description,
              COALESCE(zd.setback_front_ft, zd.min_front_setback_ft) as min_front_setback_ft,
              COALESCE(zd.setback_side_ft, zd.min_side_setback_ft) as min_side_setback_ft,
              COALESCE(zd.setback_rear_ft, zd.min_rear_setback_ft) as min_rear_setback_ft,
              COALESCE(zd.max_lot_coverage_percent, zd.max_lot_coverage) as max_lot_coverage,
              zd.metadata,
              zd.municipality_id
       FROM zoning_districts zd
       LEFT JOIN municipalities m ON m.id = zd.municipality_id
       ${where}
       ORDER BY COALESCE(zd.zoning_code, zd.district_code)`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error looking up zoning district:', error);
    res.status(500).json({ error: 'Failed to lookup zoning district' });
  }
});

router.get('/zoning-districts/by-code', async (req: Request, res: Response) => {
  try {
    const { code, municipality, municipality_id } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Must provide zoning code' });
    }

    let result;
    if (municipality_id) {
      result = await pool.query(
        `SELECT zd.*, m.name as municipality_name, m.state as municipality_state
         FROM zoning_districts zd
         LEFT JOIN municipalities m ON m.id = zd.municipality_id
         WHERE (UPPER(COALESCE(zd.zoning_code, zd.district_code)) = UPPER($1))
           AND (zd.municipality_id = $2)
         LIMIT 1`,
        [code, municipality_id]
      );
    } else if (municipality) {
      result = await pool.query(
        `SELECT zd.*, m.name as municipality_name, m.state as municipality_state
         FROM zoning_districts zd
         LEFT JOIN municipalities m ON m.id = zd.municipality_id
         WHERE (UPPER(COALESCE(zd.zoning_code, zd.district_code)) = UPPER($1))
           AND (UPPER(COALESCE(zd.municipality, m.name)) = UPPER($2))
         LIMIT 1`,
        [code, municipality]
      );
    } else {
      result = await pool.query(
        `SELECT zd.*, m.name as municipality_name, m.state as municipality_state
         FROM zoning_districts zd
         LEFT JOIN municipalities m ON m.id = zd.municipality_id
         WHERE UPPER(COALESCE(zd.zoning_code, zd.district_code)) = UPPER($1)
         LIMIT 1`,
        [code]
      );
    }

    if (result.rows.length === 0) {
      return res.json({ found: false });
    }

    const district = result.rows[0];

    const relatedResult = await pool.query(
      `SELECT id, COALESCE(zoning_code, district_code) as zoning_code, 
              district_name, description, category,
              COALESCE(max_density_per_acre, max_units_per_acre) as max_density,
              max_far,
              COALESCE(max_height_feet, max_building_height_ft) as max_height,
              max_stories
       FROM zoning_districts
       WHERE (municipality_id = $1 OR municipality = $2)
         AND id != $3
       ORDER BY COALESCE(max_density_per_acre, max_units_per_acre) DESC NULLS LAST`,
      [district.municipality_id, district.municipality, district.id]
    );

    res.json({
      found: true,
      district,
      relatedDistricts: relatedResult.rows,
      rezoneTargets: relatedResult.rows.filter((d: any) => {
        const currentDensity = district.max_density_per_acre || district.max_units_per_acre || 0;
        return (d.max_density || 0) > currentDensity;
      }).slice(0, 5),
    });
  } catch (error) {
    console.error('Error fetching zoning district by code:', error);
    res.status(500).json({ error: 'Failed to fetch district' });
  }
});

router.get('/zoning-districts/:districtId', async (req: Request, res: Response) => {
  try {
    const { districtId } = req.params;
    const result = await pool.query(
      'SELECT * FROM zoning_districts WHERE id = $1',
      [districtId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'District not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching zoning district:', error);
    res.status(500).json({ error: 'Failed to fetch zoning district' });
  }
});

router.post('/deals/:dealId/zoning-capacity/auto-fill', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const dealResult = await pool.query(
      `SELECT d.id, d.property_address, d.address, d.state,
              zc.zoning_code
       FROM deals d
       LEFT JOIN zoning_capacity zc ON zc.deal_id = d.id
       WHERE d.id = $1`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const deal = dealResult.rows[0];
    const zoningCode = deal.zoning_code || req.body.zoning_code;
    const fullAddress = deal.property_address || deal.address || '';
    const addressParts = fullAddress.split(',').map((s: string) => s.trim());
    const city = req.body.city || (addressParts.length >= 2 ? addressParts[addressParts.length - 2] : 'Atlanta');

    if (!zoningCode) {
      const districtsList = await pool.query(
        `SELECT zd.id, 
                COALESCE(zd.zoning_code, zd.district_code) as district_code,
                zd.district_name, zd.description,
                COALESCE(zd.max_height_feet, zd.max_building_height_ft) as max_building_height_ft,
                zd.max_stories, zd.max_far,
                COALESCE(zd.max_density_per_acre, zd.max_units_per_acre) as max_units_per_acre
         FROM zoning_districts zd
         LEFT JOIN municipalities m ON m.id = zd.municipality_id
         WHERE UPPER(COALESCE(zd.municipality, m.name)) = UPPER($1)
            OR zd.municipality_id = LOWER($1)
         ORDER BY COALESCE(zd.zoning_code, zd.district_code)`,
        [city]
      );
      return res.json({
        auto_filled: false,
        message: 'No zoning code specified. Select from available districts.',
        available_districts: districtsList.rows,
      });
    }

    const districtResult = await pool.query(
      `SELECT zd.* FROM zoning_districts zd
       LEFT JOIN municipalities m ON m.id = zd.municipality_id
       WHERE UPPER(COALESCE(zd.zoning_code, zd.district_code)) = UPPER($1)
       AND (UPPER(COALESCE(zd.municipality, m.name)) = UPPER($2) OR zd.municipality_id = LOWER($2))
       LIMIT 1`,
      [zoningCode, city]
    );

    if (districtResult.rows.length === 0) {
      return res.json({
        auto_filled: false,
        message: `No zoning district found for code "${zoningCode}" in ${city}`,
      });
    }

    const district = districtResult.rows[0];
    const metadata = district.metadata || {};
    const baseZoning = metadata.base_zoning || 'residential';

    const autoFilledData = {
      zoning_code: district.zoning_code || district.district_code,
      base_zoning: baseZoning,
      max_density: (district.max_density_per_acre || district.max_units_per_acre) ? parseFloat(district.max_density_per_acre || district.max_units_per_acre) : null,
      max_far: district.max_far ? parseFloat(district.max_far) : null,
      max_height_feet: district.max_height_feet || district.max_building_height_ft,
      max_stories: district.max_stories,
      min_parking_per_unit: (district.min_parking_per_unit || district.parking_per_unit) ? parseFloat(district.min_parking_per_unit || district.parking_per_unit) : null,
      setbacks: {
        front: district.setback_front_ft || district.min_front_setback_ft,
        side: district.setback_side_ft || district.min_side_setback_ft,
        rear: district.setback_rear_ft || district.min_rear_setback_ft,
      },
      district_name: district.district_name,
      description: district.description,
      permitted_uses: district.permitted_uses,
      conditional_uses: district.conditional_uses,
      source_url: district.source_url,
      max_lot_coverage: (district.max_lot_coverage_percent || district.max_lot_coverage) ? parseFloat(district.max_lot_coverage_percent || district.max_lot_coverage) : null,
      parking_per_1000_sqft: district.parking_per_1000_sqft ? parseFloat(district.parking_per_1000_sqft) : null,
      metadata: metadata,
      affordable_bonus_eligible: metadata.bonus_eligible || metadata.affordable_bonus_far > 0 || false,
      affordable_bonus_far: metadata.affordable_bonus_far || null,
      density_bonus_2024: metadata.density_bonus_2024 || false,
    };

    res.json({
      auto_filled: true,
      district_id: district.id,
      data: autoFilledData,
    });
  } catch (error) {
    console.error('Error auto-filling zoning capacity:', error);
    res.status(500).json({ error: 'Failed to auto-fill zoning capacity' });
  }
});

router.get('/municipalities', async (req: Request, res: Response) => {
  try {
    const { state, has_api, priority } = req.query;
    const params: string[] = [];
    let where = 'WHERE 1=1';

    if (state) {
      params.push(state as string);
      where += ` AND UPPER(m.state) = UPPER($${params.length})`;
    }
    if (has_api !== undefined) {
      params.push(has_api as string);
      where += ` AND m.has_api = $${params.length}::boolean`;
    }
    if (priority) {
      params.push(priority as string);
      where += ` AND UPPER(m.priority) = UPPER($${params.length})`;
    }

    const result = await pool.query(
      `SELECT m.id, m.name, m.state, m.county, m.population,
              m.has_api, m.api_type, m.data_quality, m.priority,
              m.total_zoning_districts, m.municode_url,
              COUNT(zd.id) as actual_districts
       FROM municipalities m
       LEFT JOIN zoning_districts zd ON zd.municipality_id = m.id
       ${where}
       GROUP BY m.id
       ORDER BY m.state, m.name`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching municipalities:', error);
    res.status(500).json({ error: 'Failed to fetch municipalities' });
  }
});

router.get('/municipalities/:municipalityId', async (req: Request, res: Response) => {
  try {
    const { municipalityId } = req.params;
    const muniResult = await pool.query('SELECT * FROM municipalities WHERE id = $1', [municipalityId]);
    if (muniResult.rows.length === 0) {
      return res.status(404).json({ error: 'Municipality not found' });
    }

    const districtsResult = await pool.query(
      `SELECT id, 
              COALESCE(zoning_code, district_code) as zoning_code,
              district_name, category,
              COALESCE(max_density_per_acre, max_units_per_acre) as max_density_per_acre,
              max_far,
              COALESCE(max_height_feet, max_building_height_ft) as max_height_feet,
              max_stories,
              COALESCE(min_parking_per_unit, parking_per_unit) as min_parking_per_unit,
              COALESCE(setback_front_ft, min_front_setback_ft) as setback_front_ft,
              COALESCE(setback_side_ft, min_side_setback_ft) as setback_side_ft,
              COALESCE(setback_rear_ft, min_rear_setback_ft) as setback_rear_ft,
              source
       FROM zoning_districts
       WHERE municipality_id = $1
       ORDER BY COALESCE(zoning_code, district_code)`,
      [municipalityId]
    );

    res.json({
      municipality: muniResult.rows[0],
      districts: districtsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching municipality:', error);
    res.status(500).json({ error: 'Failed to fetch municipality' });
  }
});

router.get('/zoning/lookup', async (req: Request, res: Response) => {
  try {
    const { address, city, lat, lng } = req.query;

    const cityName = city as string;
    if (!cityName && !address) {
      return res.status(400).json({ error: 'Must provide city or address' });
    }

    const searchCity = cityName || '';
    const muniResult = await pool.query(
      `SELECT id, name, state FROM municipalities 
       WHERE UPPER(name) = UPPER($1) OR id = LOWER($1)
       LIMIT 1`,
      [searchCity]
    );

    if (muniResult.rows.length === 0) {
      return res.json({ found: false, message: `No municipality found for "${searchCity}"` });
    }

    const muni = muniResult.rows[0];
    const districtsResult = await pool.query(
      `SELECT id, 
              COALESCE(zoning_code, district_code) as zoning_code,
              district_name, category,
              COALESCE(max_density_per_acre, max_units_per_acre) as max_density,
              max_far,
              COALESCE(max_height_feet, max_building_height_ft) as max_height,
              max_stories
       FROM zoning_districts
       WHERE municipality_id = $1
       ORDER BY COALESCE(zoning_code, district_code)`,
      [muni.id]
    );

    res.json({
      found: true,
      municipality: muni,
      districts: districtsResult.rows,
      total: districtsResult.rows.length,
    });
  } catch (error) {
    console.error('Error looking up zoning:', error);
    res.status(500).json({ error: 'Failed to lookup zoning' });
  }
});

router.get('/reverse-geocode', async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Must provide lat and lng' });
    }

    const mapboxToken = process.env.VITE_MAPBOX_TOKEN;
    if (!mapboxToken) {
      return res.status(500).json({ error: 'Mapbox token not configured' });
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,locality&access_token=${mapboxToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return res.json({ found: false, message: 'No location found for coordinates' });
    }

    const feature = data.features[0];
    const placeName = feature.text || '';
    const context = feature.context || [];
    const stateCtx = context.find((c: any) => c.id?.startsWith('region'));
    const countyCtx = context.find((c: any) => c.id?.startsWith('district'));
    const stateName = stateCtx?.short_code?.replace('US-', '') || stateCtx?.text || '';
    const county = countyCtx?.text || '';

    const muniResult = await pool.query(
      `SELECT id, name, state, county FROM municipalities 
       WHERE (UPPER(name) = UPPER($1) AND UPPER(state) = UPPER($2))
          OR (UPPER(name) = UPPER($1))
       LIMIT 1`,
      [placeName, stateName]
    );

    const municipality = muniResult.rows.length > 0 ? muniResult.rows[0] : null;
    const address = feature.place_name || '';

    res.json({
      found: true,
      city: placeName,
      state: stateName,
      county,
      address,
      fullPlaceName: feature.place_name,
      municipality,
      hasZoningData: !!municipality,
    });
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    res.status(500).json({ error: 'Failed to reverse geocode' });
  }
});

router.get('/zoning-districts/:id/detail', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT zd.*, m.name as municipality_name, m.state as municipality_state
       FROM zoning_districts zd
       LEFT JOIN municipalities m ON m.id = zd.municipality_id
       WHERE zd.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Zoning district not found' });
    }

    const district = result.rows[0];

    const relatedResult = await pool.query(
      `SELECT id, COALESCE(zoning_code, district_code) as zoning_code, 
              district_name, description, category,
              COALESCE(max_density_per_acre, max_units_per_acre) as max_density,
              max_far,
              COALESCE(max_height_feet, max_building_height_ft) as max_height,
              max_stories
       FROM zoning_districts
       WHERE (municipality_id = $1 OR municipality = $2)
         AND id != $3
       ORDER BY COALESCE(max_density_per_acre, max_units_per_acre) DESC NULLS LAST`,
      [district.municipality_id, district.municipality, id]
    );

    res.json({
      district,
      relatedDistricts: relatedResult.rows,
    });
  } catch (error) {
    console.error('Error fetching zoning district detail:', error);
    res.status(500).json({ error: 'Failed to fetch district detail' });
  }
});

router.delete('/deals/:dealId/zoning-capacity', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    await pool.query('DELETE FROM zoning_capacity WHERE deal_id = $1', [dealId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting zoning capacity:', error);
    res.status(500).json({ error: 'Failed to delete zoning capacity' });
  }
});

export default router;
