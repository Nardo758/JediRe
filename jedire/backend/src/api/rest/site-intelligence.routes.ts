import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getPool } from '../../database/connection';

const router = Router();
const pool = getPool();

const numField = z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().nullable().optional());
const scoreField = z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().min(0).max(100).nullable().optional());

const EnvironmentalDataSchema = z.object({
  soilType: z.string().nullable().optional(),
  soilBearingCapacity: numField,
  contaminationHistory: z.array(z.string()).optional(),
  wetlandsPresent: z.boolean().optional(),
  wetlandsArea: numField,
  treeCanopyCoverage: numField,
  protectedSpecies: z.array(z.string()).optional(),
  score: scoreField,
});

const InfrastructureDataSchema = z.object({
  waterCapacity: z.string().nullable().optional(),
  sewerCapacity: z.string().nullable().optional(),
  sewerType: z.enum(['municipal', 'septic', 'package-plant', 'unknown']).nullable().optional(),
  powerGridCapacity: z.string().nullable().optional(),
  gasAvailable: z.boolean().optional(),
  fiberAvailable: z.boolean().optional(),
  stormDrainage: z.string().nullable().optional(),
  nearestFireHydrant: numField,
  score: scoreField,
});

const AccessibilityDataSchema = z.object({
  roadAccess: z.enum(['direct', 'easement', 'limited', 'none']).nullable().optional(),
  roadType: z.string().nullable().optional(),
  publicTransit: z.array(z.string()).optional(),
  transitDistance: numField,
  walkabilityScore: scoreField,
  bikeScore: scoreField,
  parkingAvailable: z.boolean().nullable().optional(),
  score: scoreField,
});

const RegulatoryDataSchema = z.object({
  permitsRequired: z.array(z.string()).optional(),
  historicalVariances: z.array(z.string()).optional(),
  easements: z.array(z.string()).optional(),
  restrictions: z.array(z.string()).optional(),
  historicDistrict: z.boolean().optional(),
  overlayZones: z.array(z.string()).optional(),
  score: scoreField,
});

const NaturalHazardsDataSchema = z.object({
  floodZone: z.string().nullable().optional(),
  floodRisk: z.enum(['minimal', 'moderate', 'high', 'very-high']).nullable().optional(),
  seismicRisk: z.enum(['minimal', 'moderate', 'high', 'very-high']).nullable().optional(),
  wildfireRisk: z.enum(['minimal', 'moderate', 'high', 'very-high']).nullable().optional(),
  windZone: z.string().nullable().optional(),
  hurricaneRisk: z.enum(['minimal', 'moderate', 'high', 'very-high']).nullable().optional(),
  tornadoRisk: z.enum(['minimal', 'moderate', 'high', 'very-high']).nullable().optional(),
  score: scoreField,
});

const MarketContextDataSchema = z.object({
  medianIncome: numField,
  population: numField,
  populationGrowth: numField,
  employmentRate: numField,
  nearbyComps: z.array(z.object({
    address: z.string(),
    units: z.number(),
    yearBuilt: z.number().nullable().optional(),
    distance: z.number(),
  })).optional(),
  trafficCount: numField,
  crimeRate: z.string().nullable().optional(),
  schoolRating: numField,
  score: scoreField,
});

const SiteIntelligenceSchema = z.object({
  environmental: EnvironmentalDataSchema.optional(),
  infrastructure: InfrastructureDataSchema.optional(),
  accessibility: AccessibilityDataSchema.optional(),
  regulatory: RegulatoryDataSchema.optional(),
  natural_hazards: NaturalHazardsDataSchema.optional(),
  market_context: MarketContextDataSchema.optional(),
});

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

function calculateDataCompleteness(data: any): number {
  let totalFields = 0;
  let filledFields = 0;

  const countFields = (obj: any) => {
    if (!obj) return;
    Object.entries(obj).forEach(([key, value]) => {
      if (key === 'score') return;
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

router.get('/deals/:dealId/site-intelligence', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const result = await pool.query(
      'SELECT * FROM site_intelligence WHERE deal_id = $1',
      [dealId]
    );

    if (result.rows.length === 0) {
      return res.json({});
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error fetching site intelligence:', error);
    res.status(500).json({ error: 'Failed to fetch site intelligence' });
  }
});

router.post('/deals/:dealId/site-intelligence', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const validatedData = SiteIntelligenceSchema.parse(req.body);

    const overallScore = calculateOverallScore(validatedData);
    const dataCompleteness = calculateDataCompleteness(validatedData);

    const result = await pool.query(
      `INSERT INTO site_intelligence (
        deal_id, environmental, infrastructure, accessibility,
        regulatory, natural_hazards, market_context,
        overall_score, data_completeness
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
      RETURNING *`,
      [
        dealId,
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

    res.json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error saving site intelligence:', error);
    res.status(500).json({ error: 'Failed to save site intelligence' });
  }
});

router.delete('/deals/:dealId/site-intelligence', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    await pool.query(
      'DELETE FROM site_intelligence WHERE deal_id = $1',
      [dealId]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting site intelligence:', error);
    res.status(500).json({ error: 'Failed to delete site intelligence' });
  }
});

export default router;
