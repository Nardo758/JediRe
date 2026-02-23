import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

// Validation Schema
const UnitMixSchema = z.object({
  studio: z.object({
    percent: z.number().min(0).max(100),
    count: z.number().min(0),
  }).optional(),
  oneBR: z.object({
    percent: z.number().min(0).max(100),
    count: z.number().min(0),
  }).optional(),
  twoBR: z.object({
    percent: z.number().min(0).max(100),
    count: z.number().min(0),
  }).optional(),
  threeBR: z.object({
    percent: z.number().min(0).max(100),
    count: z.number().min(0),
  }).optional(),
});

const ZoningCapacitySchema = z.object({
  zoning_code: z.string().optional(),
  base_zoning: z.enum(['residential', 'mixed-use', 'commercial', 'industrial']).optional(),
  max_density: z.number().positive().optional(),
  max_far: z.number().positive().optional(),
  max_height_feet: z.number().positive().int().optional(),
  max_stories: z.number().positive().int().optional(),
  min_parking_per_unit: z.number().min(0).optional(),
  affordable_housing_bonus: z.boolean().optional(),
  affordable_bonus_percent: z.number().min(0).max(100).optional(),
  tdr_available: z.boolean().optional(),
  tdr_bonus_percent: z.number().min(0).max(100).optional(),
  overlay_zones: z.array(z.string()).optional(),
  special_restrictions: z.array(z.string()).optional(),
  zoning_notes: z.string().optional(),
  unit_mix: UnitMixSchema.optional(),
  avg_rent_per_unit: z.number().positive().optional(),
});

// Calculate maximum units and related metrics
async function calculateCapacity(dealId: string, data: any) {
  const result = await db.query(
    `
    SELECT * FROM calculate_max_units(
      $1::uuid,
      $2::decimal,
      $3::decimal,
      $4::integer,
      $5::decimal,
      850, -- avg unit size
      10,  -- story height
      NULL -- parking spaces (could be added later)
    )
    `,
    [
      dealId,
      data.max_density || null,
      data.max_far || null,
      data.max_height_feet || null,
      data.min_parking_per_unit || null,
    ]
  );

  const capacity = result.rows[0];
  let maxUnitsByRight = capacity.max_units || 0;
  let limitingFactor = capacity.limiting_factor || 'unknown';
  let buildableSqFt = capacity.buildable_sq_ft || 0;

  // Calculate with incentives
  let bonusPercent = 0;
  if (data.affordable_housing_bonus) {
    bonusPercent += data.affordable_bonus_percent || 25;
  }
  if (data.tdr_available) {
    bonusPercent += data.tdr_bonus_percent || 15;
  }

  const maxUnitsWithIncentives = Math.floor(maxUnitsByRight * (1 + bonusPercent / 100));

  // Calculate coverage ratio
  const boundaryResult = await db.query(
    `SELECT metrics FROM property_boundaries WHERE deal_id = $1`,
    [dealId]
  );

  let coverageRatio = 0;
  if (boundaryResult.rows.length > 0) {
    const metrics = boundaryResult.rows[0].metrics;
    const totalArea = metrics.area || 0;
    const buildableArea = metrics.buildableArea || totalArea;
    if (totalArea > 0) {
      coverageRatio = ((buildableArea / totalArea) * 100).toFixed(2);
    }
  }

  return {
    max_units_by_right: maxUnitsByRight,
    max_units_with_incentives: maxUnitsWithIncentives,
    limiting_factor: limitingFactor,
    buildable_sq_ft: buildableSqFt,
    coverage_ratio: parseFloat(coverageRatio),
  };
}

// Calculate unit mix counts based on percentages
function calculateUnitMix(unitMix: any, totalUnits: number) {
  const result = { ...unitMix };
  
  if (result.studio) {
    result.studio.count = Math.floor((result.studio.percent / 100) * totalUnits);
  }
  if (result.oneBR) {
    result.oneBR.count = Math.floor((result.oneBR.percent / 100) * totalUnits);
  }
  if (result.twoBR) {
    result.twoBR.count = Math.floor((result.twoBR.percent / 100) * totalUnits);
  }
  if (result.threeBR) {
    result.threeBR.count = Math.floor((result.threeBR.percent / 100) * totalUnits);
  }
  
  return result;
}

// Calculate revenue metrics
function calculateRevenue(avgRentPerUnit: number, totalUnits: number) {
  const annualRevenue = avgRentPerUnit * totalUnits * 12;
  const proFormaNoi = annualRevenue * 0.65; // Assume 65% NOI margin
  const estimatedValue = proFormaNoi / 0.05; // 5% cap rate
  
  return {
    annual_revenue: Math.round(annualRevenue),
    pro_forma_noi: Math.round(proFormaNoi),
    estimated_value: Math.round(estimatedValue),
  };
}

// GET: Fetch zoning capacity for a property
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const propertyId = params.id;

    const result = await db.query(
      `SELECT * FROM zoning_capacity WHERE deal_id = $1`,
      [propertyId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Zoning capacity not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching zoning capacity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch zoning capacity' },
      { status: 500 }
    );
  }
}

// POST: Create or update zoning capacity
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const propertyId = params.id;
    const body = await request.json();

    // Validate input
    const validatedData = ZoningCapacitySchema.parse(body);

    // Calculate capacity metrics
    const capacity = await calculateCapacity(propertyId, validatedData);

    // Calculate unit mix if provided
    let unitMix = validatedData.unit_mix;
    if (unitMix) {
      unitMix = calculateUnitMix(unitMix, capacity.max_units_with_incentives);
    }

    // Calculate revenue metrics if avg rent provided
    let revenueMetrics = {};
    if (validatedData.avg_rent_per_unit) {
      revenueMetrics = calculateRevenue(
        validatedData.avg_rent_per_unit,
        capacity.max_units_with_incentives
      );
    }

    // Upsert zoning capacity
    const result = await db.query(
      `
      INSERT INTO zoning_capacity (
        deal_id,
        zoning_code,
        base_zoning,
        max_density,
        max_far,
        max_height_feet,
        max_stories,
        min_parking_per_unit,
        affordable_housing_bonus,
        affordable_bonus_percent,
        tdr_available,
        tdr_bonus_percent,
        overlay_zones,
        special_restrictions,
        zoning_notes,
        max_units_by_right,
        max_units_with_incentives,
        limiting_factor,
        buildable_sq_ft,
        coverage_ratio,
        unit_mix,
        avg_rent_per_unit,
        annual_revenue,
        pro_forma_noi,
        estimated_value
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      ON CONFLICT (deal_id)
      DO UPDATE SET
        zoning_code = COALESCE($2, zoning_capacity.zoning_code),
        base_zoning = COALESCE($3, zoning_capacity.base_zoning),
        max_density = COALESCE($4, zoning_capacity.max_density),
        max_far = COALESCE($5, zoning_capacity.max_far),
        max_height_feet = COALESCE($6, zoning_capacity.max_height_feet),
        max_stories = COALESCE($7, zoning_capacity.max_stories),
        min_parking_per_unit = COALESCE($8, zoning_capacity.min_parking_per_unit),
        affordable_housing_bonus = COALESCE($9, zoning_capacity.affordable_housing_bonus),
        affordable_bonus_percent = COALESCE($10, zoning_capacity.affordable_bonus_percent),
        tdr_available = COALESCE($11, zoning_capacity.tdr_available),
        tdr_bonus_percent = COALESCE($12, zoning_capacity.tdr_bonus_percent),
        overlay_zones = COALESCE($13, zoning_capacity.overlay_zones),
        special_restrictions = COALESCE($14, zoning_capacity.special_restrictions),
        zoning_notes = COALESCE($15, zoning_capacity.zoning_notes),
        max_units_by_right = $16,
        max_units_with_incentives = $17,
        limiting_factor = $18,
        buildable_sq_ft = $19,
        coverage_ratio = $20,
        unit_mix = COALESCE($21, zoning_capacity.unit_mix),
        avg_rent_per_unit = COALESCE($22, zoning_capacity.avg_rent_per_unit),
        annual_revenue = $23,
        pro_forma_noi = $24,
        estimated_value = $25,
        updated_at = NOW()
      RETURNING *
      `,
      [
        propertyId,
        validatedData.zoning_code,
        validatedData.base_zoning,
        validatedData.max_density,
        validatedData.max_far,
        validatedData.max_height_feet,
        validatedData.max_stories,
        validatedData.min_parking_per_unit,
        validatedData.affordable_housing_bonus,
        validatedData.affordable_bonus_percent,
        validatedData.tdr_available,
        validatedData.tdr_bonus_percent,
        validatedData.overlay_zones || [],
        validatedData.special_restrictions || [],
        validatedData.zoning_notes,
        capacity.max_units_by_right,
        capacity.max_units_with_incentives,
        capacity.limiting_factor,
        capacity.buildable_sq_ft,
        capacity.coverage_ratio,
        unitMix ? JSON.stringify(unitMix) : null,
        validatedData.avg_rent_per_unit,
        revenueMetrics.annual_revenue || null,
        revenueMetrics.pro_forma_noi || null,
        revenueMetrics.estimated_value || null,
      ]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error saving zoning capacity:', error);
    return NextResponse.json(
      { error: 'Failed to save zoning capacity' },
      { status: 500 }
    );
  }
}

// DELETE: Remove zoning capacity
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const propertyId = params.id;

    await db.query(
      `DELETE FROM zoning_capacity WHERE deal_id = $1`,
      [propertyId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting zoning capacity:', error);
    return NextResponse.json(
      { error: 'Failed to delete zoning capacity' },
      { status: 500 }
    );
  }
}
