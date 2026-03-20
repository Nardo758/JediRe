import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { BuildingEnvelopeService, PropertyType, PROPERTY_TYPE_CONFIGS } from '../../services/building-envelope.service';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const pool = getPool();
const envelopeService = new BuildingEnvelopeService();

router.post('/deals/:dealId/building-envelope', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { propertyType = 'multifamily', revenueAssumptions, includeHBU = false, includeAI = false } = req.body;

    const boundaryResult = await pool.query(
      'SELECT coordinates, metrics FROM property_boundaries WHERE deal_id = $1',
      [dealId]
    );

    let landArea = req.body.landArea || 0;
    let setbacks = req.body.setbacks || { front: 0, side: 0, rear: 0 };
    let lotDimensions = req.body.lotDimensions;

    if (boundaryResult.rows.length > 0) {
      const metrics = boundaryResult.rows[0].metrics || {};
      landArea = landArea || metrics.area || 0;
      if (metrics.frontage && metrics.depth) {
        lotDimensions = lotDimensions || { frontage: metrics.frontage, depth: metrics.depth };
      }
    }

    const zoningResult = await pool.query(
      'SELECT * FROM zoning_capacity WHERE deal_id = $1',
      [dealId]
    );

    let zoningConstraints = {
      maxDensity: req.body.maxDensity || null,
      maxFAR: req.body.maxFAR || null,
      maxHeight: req.body.maxHeight || null,
      maxStories: req.body.maxStories || null,
      minParkingPerUnit: req.body.minParkingPerUnit || null,
      maxLotCoverage: req.body.maxLotCoverage || null,
    };

    if (zoningResult.rows.length > 0) {
      const zc = zoningResult.rows[0];
      zoningConstraints = {
        maxDensity: zoningConstraints.maxDensity || zc.max_density || null,
        maxFAR: zoningConstraints.maxFAR || zc.max_far || null,
        maxHeight: zoningConstraints.maxHeight || zc.max_height_feet || null,
        maxStories: zoningConstraints.maxStories || zc.max_stories || null,
        minParkingPerUnit: zoningConstraints.minParkingPerUnit || zc.min_parking_per_unit || null,
        maxLotCoverage: zoningConstraints.maxLotCoverage || null,
      };
      if (!setbacks.front && !setbacks.side && !setbacks.rear) {
        try {
          const districtCode = zc.zoning_code;
          if (districtCode) {
            const districtResult = await pool.query(
              `SELECT COALESCE(setback_front_ft, min_front_setback_ft) as front,
                      COALESCE(setback_side_ft, min_side_setback_ft) as side,
                      COALESCE(setback_rear_ft, min_rear_setback_ft) as rear,
                      COALESCE(max_lot_coverage_percent, max_lot_coverage) as lot_coverage
               FROM zoning_districts
               WHERE UPPER(COALESCE(zoning_code, district_code)) = UPPER($1)
               LIMIT 1`,
              [districtCode]
            );
            if (districtResult.rows.length > 0) {
              const d = districtResult.rows[0];
              setbacks = {
                front: parseFloat(d.front) || 0,
                side: parseFloat(d.side) || 0,
                rear: parseFloat(d.rear) || 0,
              };
              if (d.lot_coverage) {
                zoningConstraints.maxLotCoverage = zoningConstraints.maxLotCoverage || parseFloat(d.lot_coverage);
              }
            }
          }
        } catch {}
      }
    }

    let densityBonuses = { affordablePercent: 0, tdrPercent: 0 };
    if (zoningResult.rows.length > 0) {
      const zc = zoningResult.rows[0];
      if (zc.affordable_housing_bonus) {
        densityBonuses.affordablePercent = zc.affordable_bonus_percent || 25;
      }
      if (zc.tdr_available) {
        densityBonuses.tdrPercent = zc.tdr_bonus_percent || 15;
      }
    }

    if (!landArea || landArea <= 0) {
      return res.status(400).json({
        error: 'No land area available. Please draw a property boundary first.',
      });
    }

    const envelopeInputs = {
      landArea,
      setbacks,
      lotDimensions,
      zoningConstraints,
      propertyType: propertyType as PropertyType,
      densityBonuses,
    };

    const envelope = envelopeService.calculateEnvelope(envelopeInputs);

    let hbuResults = null;
    if (includeHBU) {
      hbuResults = envelopeService.calculateHighestBestUse(envelopeInputs, revenueAssumptions);
    }

    let aiRecommendations = null;
    if (includeAI) {
      try {
        const anthropic = new Anthropic();
        const constraintSummary = Object.entries(envelope.capacityByConstraint)
          .map(([k, v]) => `${k}: ${v} ${propertyType === 'multifamily' ? 'units' : 'capacity'}`)
          .join(', ');

        const hbuSummary = hbuResults
          ? hbuResults.map((r: any) => `${r.propertyType}: ${r.maxCapacity} capacity, $${(r.estimatedValue / 1000000).toFixed(1)}M value`).join('\n')
          : '';

        const prompt = `You are a real estate development advisor. Analyze this building envelope for a ${propertyType} development:

Land Area: ${(landArea / 43560).toFixed(2)} acres (${landArea.toLocaleString()} sq ft)
Buildable Area (after setbacks): ${envelope.buildableArea.toLocaleString()} sq ft
Max Footprint: ${envelope.maxFootprint.toLocaleString()} sq ft
Max GFA: ${envelope.maxGFA.toLocaleString()} sq ft
Max Floors: ${envelope.maxFloors}
Max Capacity: ${envelope.maxCapacity} ${PROPERTY_TYPE_CONFIGS[propertyType as PropertyType]?.densityMetric || 'units'}
Limiting Factor: ${envelope.limitingFactor}
Capacity by Constraint: ${constraintSummary}
Parking Required: ${envelope.parkingRequired} spaces (${envelope.parkingArea.toLocaleString()} sq ft)
Setbacks: Front ${setbacks.front}ft, Side ${setbacks.side}ft, Rear ${setbacks.rear}ft
Zoning: Density ${zoningConstraints.maxDensity || 'N/A'}, FAR ${zoningConstraints.maxFAR || 'N/A'}, Height ${zoningConstraints.maxHeight || 'N/A'}ft, ${zoningConstraints.maxStories || 'N/A'} stories

${hbuSummary ? `Highest & Best Use Analysis:\n${hbuSummary}` : ''}

Provide 3-5 specific, actionable optimization recommendations. Consider:
1. Structured vs surface parking tradeoffs
2. Density bonus opportunities
3. Whether a rezone would unlock significantly more value
4. Unit mix or tenant mix optimization
5. Phasing strategies

Keep each recommendation to 2-3 sentences. Be specific with numbers.`;

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        });

        const textBlock = response.content.find((b: any) => b.type === 'text');
        aiRecommendations = textBlock ? (textBlock as any).text : null;
      } catch (err) {
        console.error('AI recommendation error:', err);
        aiRecommendations = null;
      }
    }

    res.json({
      envelope,
      highestBestUse: hbuResults,
      aiRecommendations,
      inputs: {
        landArea,
        setbacks,
        zoningConstraints,
        propertyType,
        densityBonuses,
      },
    });
  } catch (error) {
    console.error('Building envelope error:', error);
    res.status(500).json({ error: 'Failed to calculate building envelope' });
  }
});

router.get('/property-type-configs', async (_req: Request, res: Response) => {
  res.json(PROPERTY_TYPE_CONFIGS);
});

export default router;
