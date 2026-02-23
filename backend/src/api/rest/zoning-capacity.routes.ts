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
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error saving zoning capacity:', error);
    res.status(500).json({ error: 'Failed to save zoning capacity' });
  }
});

router.get('/zoning-districts/lookup', async (req: Request, res: Response) => {
  try {
    const { code, municipality, state } = req.query;

    if (code) {
      const result = await pool.query(
        `SELECT * FROM zoning_districts 
         WHERE UPPER(district_code) = UPPER($1)
         ${municipality ? 'AND UPPER(municipality) = UPPER($2)' : ''}
         LIMIT 1`,
        municipality ? [code, municipality] : [code]
      );
      if (result.rows.length > 0) {
        return res.json(result.rows[0]);
      }
      return res.json(null);
    }

    const params: string[] = [];
    let where = 'WHERE 1=1';
    if (municipality) {
      params.push(municipality as string);
      where += ` AND UPPER(municipality) = UPPER($${params.length})`;
    }
    if (state) {
      params.push(state as string);
      where += ` AND UPPER(state) = UPPER($${params.length})`;
    }

    const result = await pool.query(
      `SELECT id, district_code, district_name, municipality, state, 
              max_building_height_ft, max_stories, max_far, max_units_per_acre,
              parking_per_unit, parking_per_1000_sqft, description,
              min_front_setback_ft, min_side_setback_ft, min_rear_setback_ft,
              max_lot_coverage, metadata
       FROM zoning_districts ${where}
       ORDER BY district_code`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error looking up zoning district:', error);
    res.status(500).json({ error: 'Failed to lookup zoning district' });
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
      `SELECT d.id, d.property_address, d.address, d.state, d.asset_type,
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
        `SELECT id, district_code, district_name, description, max_building_height_ft, max_stories, max_far, max_units_per_acre
         FROM zoning_districts WHERE UPPER(municipality) = UPPER($1)
         ORDER BY district_code`,
        [city]
      );
      return res.json({
        auto_filled: false,
        message: 'No zoning code specified. Select from available districts.',
        available_districts: districtsList.rows,
      });
    }

    const districtResult = await pool.query(
      `SELECT * FROM zoning_districts 
       WHERE UPPER(district_code) = UPPER($1)
       AND UPPER(municipality) = UPPER($2)
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
      zoning_code: district.district_code,
      base_zoning: baseZoning,
      max_density: district.max_units_per_acre ? parseFloat(district.max_units_per_acre) : null,
      max_far: district.max_far ? parseFloat(district.max_far) : null,
      max_height_feet: district.max_building_height_ft,
      max_stories: district.max_stories,
      min_parking_per_unit: district.parking_per_unit ? parseFloat(district.parking_per_unit) : null,
      setbacks: {
        front: district.min_front_setback_ft,
        side: district.min_side_setback_ft,
        rear: district.min_rear_setback_ft,
      },
      district_name: district.district_name,
      description: district.description,
      permitted_uses: district.permitted_uses,
      conditional_uses: district.conditional_uses,
      source_url: district.source_url,
      max_lot_coverage: district.max_lot_coverage ? parseFloat(district.max_lot_coverage) : null,
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
