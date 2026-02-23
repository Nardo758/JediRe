import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

// Validation Schemas
const EnvironmentalDataSchema = z.object({
  soilType: z.string().nullable().optional(),
  soilBearingCapacity: z.number().nullable().optional(),
  contaminationHistory: z.array(z.string()).optional(),
  wetlandsPresent: z.boolean().optional(),
  wetlandsArea: z.number().nullable().optional(),
  treeCanopyCoverage: z.number().nullable().optional(),
  protectedSpecies: z.array(z.string()).optional(),
  score: z.number().min(0).max(100).nullable().optional(),
});

const InfrastructureDataSchema = z.object({
  waterCapacity: z.string().nullable().optional(),
  sewerCapacity: z.string().nullable().optional(),
  sewerType: z.enum(['municipal', 'septic', 'package-plant', 'unknown']).nullable().optional(),
  powerGridCapacity: z.string().nullable().optional(),
  gasAvailable: z.boolean().optional(),
  fiberAvailable: z.boolean().optional(),
  stormDrainage: z.string().nullable().optional(),
  nearestFireHydrant: z.number().nullable().optional(),
  score: z.number().min(0).max(100).nullable().optional(),
});

const AccessibilityDataSchema = z.object({
  roadAccess: z.enum(['direct', 'easement', 'limited', 'none']).nullable().optional(),
  roadType: z.string().nullable().optional(),
  publicTransit: z.array(z.string()).optional(),
  transitDistance: z.number().nullable().optional(),
  walkabilityScore: z.number().min(0).max(100).nullable().optional(),
  bikeScore: z.number().min(0).max(100).nullable().optional(),
  parkingAvailable: z.boolean().nullable().optional(),
  score: z.number().min(0).max(100).nullable().optional(),
});

const RegulatoryDataSchema = z.object({
  permitsRequired: z.array(z.string()).optional(),
  historicalVariances: z.array(z.string()).optional(),
  easements: z.array(z.string()).optional(),
  restrictions: z.array(z.string()).optional(),
  historicDistrict: z.boolean().optional(),
  overlayZones: z.array(z.string()).optional(),
  score: z.number().min(0).max(100).nullable().optional(),
});

const NaturalHazardsDataSchema = z.object({
  floodZone: z.string().nullable().optional(),
  floodRisk: z.enum(['minimal', 'moderate', 'high', 'very-high']).nullable().optional(),
  seismicRisk: z.enum(['minimal', 'moderate', 'high', 'very-high']).nullable().optional(),
  wildfireRisk: z.enum(['minimal', 'moderate', 'high', 'very-high']).nullable().optional(),
  windZone: z.string().nullable().optional(),
  hurricaneRisk: z.enum(['minimal', 'moderate', 'high', 'very-high']).nullable().optional(),
  tornadoRisk: z.enum(['minimal', 'moderate', 'high', 'very-high']).nullable().optional(),
  score: z.number().min(0).max(100).nullable().optional(),
});

const MarketContextDataSchema = z.object({
  medianIncome: z.number().nullable().optional(),
  population: z.number().nullable().optional(),
  populationGrowth: z.number().nullable().optional(),
  employmentRate: z.number().nullable().optional(),
  nearbyComps: z.array(z.object({
    address: z.string(),
    units: z.number(),
    yearBuilt: z.number().nullable().optional(),
    distance: z.number(),
  })).optional(),
  trafficCount: z.number().nullable().optional(),
  crimeRate: z.string().nullable().optional(),
  schoolRating: z.number().nullable().optional(),
  score: z.number().min(0).max(100).nullable().optional(),
});

const SiteIntelligenceSchema = z.object({
  environmental: EnvironmentalDataSchema.optional(),
  infrastructure: InfrastructureDataSchema.optional(),
  accessibility: AccessibilityDataSchema.optional(),
  regulatory: RegulatoryDataSchema.optional(),
  natural_hazards: NaturalHazardsDataSchema.optional(),
  market_context: MarketContextDataSchema.optional(),
});

// Calculate overall score from category scores
function calculateOverallScore(data: any): number {
  const scores = [
    data.environmental?.score,
    data.infrastructure?.score,
    data.accessibility?.score,
    data.regulatory?.score,
    data.natural_hazards?.score,
    data.market_context?.score,
  ].filter((s): s is number => s !== null && s !== undefined);

  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// Calculate data completeness percentage
function calculateDataCompleteness(data: any): number {
  let totalFields = 0;
  let filledFields = 0;

  const countFields = (obj: any) => {
    if (!obj) return;
    Object.entries(obj).forEach(([key, value]) => {
      if (key === 'score') return; // Don't count score fields
      totalFields++;
      if (value !== null && value !== undefined) {
        if (Array.isArray(value) && value.length > 0) {
          filledFields++;
        } else if (!Array.isArray(value)) {
          filledFields++;
        }
      }
    });
  };

  countFields(data.environmental);
  countFields(data.infrastructure);
  countFields(data.accessibility);
  countFields(data.regulatory);
  countFields(data.natural_hazards);
  countFields(data.market_context);

  return totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
}

// GET: Fetch site intelligence for a property
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const propertyId = params.id;

    const result = await db.query(
      `SELECT * FROM site_intelligence WHERE deal_id = $1`,
      [propertyId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Site intelligence not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching site intelligence:', error);
    return NextResponse.json(
      { error: 'Failed to fetch site intelligence' },
      { status: 500 }
    );
  }
}

// POST: Create or update site intelligence
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const propertyId = params.id;
    const body = await request.json();

    // Validate input
    const validatedData = SiteIntelligenceSchema.parse(body);

    // Calculate scores
    const overallScore = calculateOverallScore(validatedData);
    const dataCompleteness = calculateDataCompleteness(validatedData);

    // Upsert site intelligence
    const result = await db.query(
      `
      INSERT INTO site_intelligence (
        deal_id,
        environmental,
        infrastructure,
        accessibility,
        regulatory,
        natural_hazards,
        market_context,
        overall_score,
        data_completeness
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (deal_id)
      DO UPDATE SET
        environmental = COALESCE($2, site_intelligence.environmental),
        infrastructure = COALESCE($3, site_intelligence.infrastructure),
        accessibility = COALESCE($4, site_intelligence.accessibility),
        regulatory = COALESCE($5, site_intelligence.regulatory),
        natural_hazards = COALESCE($6, site_intelligence.natural_hazards),
        market_context = COALESCE($7, site_intelligence.market_context),
        overall_score = $8,
        data_completeness = $9,
        updated_at = NOW()
      RETURNING *
      `,
      [
        propertyId,
        validatedData.environmental ? JSON.stringify(validatedData.environmental) : null,
        validatedData.infrastructure ? JSON.stringify(validatedData.infrastructure) : null,
        validatedData.accessibility ? JSON.stringify(validatedData.accessibility) : null,
        validatedData.regulatory ? JSON.stringify(validatedData.regulatory) : null,
        validatedData.natural_hazards ? JSON.stringify(validatedData.natural_hazards) : null,
        validatedData.market_context ? JSON.stringify(validatedData.market_context) : null,
        overallScore,
        dataCompleteness,
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

    console.error('Error saving site intelligence:', error);
    return NextResponse.json(
      { error: 'Failed to save site intelligence' },
      { status: 500 }
    );
  }
}

// DELETE: Remove site intelligence
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const propertyId = params.id;

    await db.query(
      `DELETE FROM site_intelligence WHERE deal_id = $1`,
      [propertyId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting site intelligence:', error);
    return NextResponse.json(
      { error: 'Failed to delete site intelligence' },
      { status: 500 }
    );
  }
}
