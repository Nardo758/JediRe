/**
 * Traffic Intelligence API Routes
 * Endpoints to test and access the fully-wired M05+M02+M07 integration
 */

import { Router } from 'express';
import { trafficIntelligenceWiringService } from '../../services/traffic-intelligence-wiring.service';
import { trafficCompAdjustmentService } from '../../services/traffic-comp-adjustment.service';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

/**
 * GET /api/v1/traffic-intelligence/:dealId/factors
 * Get dynamic traffic factors (Demand, Supply, Digital) with reasoning
 */
router.get('/:dealId/factors', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const targetUnits = parseInt(req.query.targetUnits as string) || 230;

    const factors = await trafficIntelligenceWiringService.getDynamicFactors(dealId, targetUnits);

    res.json({
      success: true,
      dealId,
      factors: {
        demand: {
          multiplier: factors.demandFactor,
          reasoning: factors.demandReasoning,
          source: 'M05_MARKET_INTELLIGENCE'
        },
        supply: {
          multiplier: factors.supplyFactor,
          reasoning: factors.supplyReasoning,
          source: 'M02_SUPPLY_INTELLIGENCE'
        },
        digital: {
          multiplier: factors.digitalFactor,
          reasoning: factors.digitalReasoning,
          source: 'M07_DIGITAL_LAYER'
        },
        combined: {
          multiplier: parseFloat((factors.demandFactor * factors.supplyFactor * factors.digitalFactor).toFixed(3)),
          confidence: factors.confidence
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/traffic-intelligence/:dealId/comp-baseline
 * Get baseline traffic from comparable properties (for new developments)
 */
router.get('/:dealId/comp-baseline', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;

    const baseline = await trafficIntelligenceWiringService.getBaselineTrafficForNewDevelopment(dealId);

    res.json({
      success: true,
      dealId,
      baseline: {
        weeklyTraffic: baseline.weeklyTraffic,
        monthlyLeases: Math.round(baseline.weeklyTraffic * 4.33 * 0.315), // 31.5% conversion
        confidence: baseline.confidence,
        compsUsed: baseline.compsCount,
        reasoning: baseline.reasoning
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/traffic-intelligence/:dealId/comps
 * Get comparable properties from Market Intelligence competitive set
 */
router.get('/:dealId/comps', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;

    const comps = await trafficCompAdjustmentService.getComparableProperties(dealId);

    res.json({
      success: true,
      dealId,
      source: 'M05_MARKET_INTELLIGENCE',
      compsFound: comps.length,
      comps: comps.map(c => ({
        id: c.id,
        name: c.name,
        address: c.address,
        units: c.units,
        distance_miles: parseFloat(c.distance_miles.toFixed(2)),
        weekly_traffic: c.weekly_traffic,
        visibility_score: c.visibility_score,
        avg_rent: c.avg_rent,
        occupancy: c.occupancy
      }))
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/traffic-intelligence/:dealId/visibility-assessment
 * Assess or update visibility factors for a property
 */
router.post('/:dealId/visibility-assessment', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const manualFactors = req.body.factors; // Optional: {positional, sightline, setback, signage, transparency, entrance, obstruction_penalty}

    const visibility = await trafficCompAdjustmentService.assessVisibility(dealId, manualFactors);

    res.json({
      success: true,
      dealId,
      visibility: {
        total_score: visibility.total_score,
        factors: {
          positional: { score: visibility.positional, weight: '25%', description: 'Corner lot, main road positioning' },
          sightline: { score: visibility.sightline, weight: '20%', description: 'Clear view from street' },
          setback: { score: visibility.setback, weight: '15%', description: 'Proximity to road' },
          signage: { score: visibility.signage, weight: '15%', description: 'Signage quality & placement' },
          transparency: { score: visibility.transparency, weight: '10%', description: 'Glass/openness' },
          entrance: { score: visibility.entrance, weight: '10%', description: 'Entrance prominence' },
          obstruction_penalty: { score: visibility.obstruction_penalty, weight: '5%', description: 'Trees/buildings blocking (-points)' }
        },
        interpretation: visibility.total_score >= 80 ? 'Excellent visibility' :
                        visibility.total_score >= 65 ? 'Good visibility' :
                        visibility.total_score >= 50 ? 'Average visibility' : 'Below-average visibility'
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/traffic-intelligence/:dealId/full-analysis
 * Complete traffic intelligence analysis (all components)
 */
router.get('/:dealId/full-analysis', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.params;
    const targetUnits = parseInt(req.query.targetUnits as string) || 230;

    // 1. Dynamic factors from M05/M02
    const factors = await trafficIntelligenceWiringService.getDynamicFactors(dealId, targetUnits);

    // 2. Comp-based baseline
    const baseline = await trafficIntelligenceWiringService.getBaselineTrafficForNewDevelopment(dealId);

    // 3. Monthly projections (first 24 months)
    const monthlyProjections = [];
    for (let month = 1; month <= 24; month++) {
      const adjustments = trafficIntelligenceWiringService.getMonthlyAdjustments(month);
      
      const demandFactor = factors.demandFactor * adjustments.demandAdj;
      const supplyFactor = factors.supplyFactor * adjustments.supplyAdj;
      const digitalFactor = factors.digitalFactor * adjustments.digitalAdj;
      
      // Seasonal factor (simplified)
      const seasonalFactors = [0.85, 0.90, 1.00, 1.15, 1.25, 1.15, 1.00, 0.95, 1.05, 1.10, 0.95, 0.80];
      const monthIndex = (month - 1) % 12;
      const seasonalFactor = seasonalFactors[monthIndex];
      
      const combinedFactor = demandFactor * supplyFactor * digitalFactor * seasonalFactor;
      const adjustedTraffic = Math.round(baseline.weeklyTraffic * combinedFactor);
      const monthlyLeases = Math.round(adjustedTraffic * 4.33 * 0.315); // 31.5% conversion
      
      monthlyProjections.push({
        month,
        weeklyTraffic: adjustedTraffic,
        monthlyLeases,
        factors: {
          demand: parseFloat(demandFactor.toFixed(3)),
          supply: parseFloat(supplyFactor.toFixed(3)),
          digital: parseFloat(digitalFactor.toFixed(3)),
          seasonal: seasonalFactor,
          combined: parseFloat(combinedFactor.toFixed(3))
        }
      });
    }

    res.json({
      success: true,
      dealId,
      baseline: {
        weeklyTraffic: baseline.weeklyTraffic,
        confidence: baseline.confidence,
        reasoning: baseline.reasoning
      },
      dynamicFactors: {
        demand: {
          base: factors.demandFactor,
          reasoning: factors.demandReasoning
        },
        supply: {
          base: factors.supplyFactor,
          reasoning: factors.supplyReasoning
        },
        digital: {
          base: factors.digitalFactor,
          reasoning: factors.digitalReasoning
        },
        confidence: factors.confidence
      },
      monthlyProjections: monthlyProjections.slice(0, 12), // First year
      summary: {
        avgMonthlyLeasesYear1: Math.round(monthlyProjections.slice(0, 12).reduce((sum, m) => sum + m.monthlyLeases, 0) / 12),
        totalLeasesYear1: monthlyProjections.slice(0, 12).reduce((sum, m) => sum + m.monthlyLeases, 0),
        stabilizationMonth: monthlyProjections.findIndex(m => m.monthlyLeases >= targetUnits * 0.05) + 1 || 12,
        peakMonth: monthlyProjections.reduce((max, m, i) => m.monthlyLeases > monthlyProjections[max].monthlyLeases ? i : max, 0) + 1
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
