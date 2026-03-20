/**
 * Scenario Generation API Routes
 * 
 * Endpoints for generating and managing Bull/Base/Bear/Stress scenarios
 * 
 * Phase 3, Component 2: Scenario Generation
 * 
 * @version 1.0.0
 * @date 2026-02-11
 */

import { Router, Request, Response } from 'express';
import { scenarioGenerationService } from '../../services/scenario-generation.service';
import { logger } from '../../utils/logger';

const router = Router();

// ============================================================================
// POST /api/v1/scenarios/generate/:dealId
// Generate all 4 scenarios for a deal
// ============================================================================

router.post('/generate/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { trigger = 'manual', userId } = req.body;

    logger.info(`Generating scenarios for deal ${dealId}`);

    const scenarios = await scenarioGenerationService.generateScenariosForDeal({
      dealId,
      trigger,
      generatedBy: userId || (req as any).user?.id,
    });

    res.json({
      success: true,
      data: {
        scenarios,
        count: scenarios.length,
      },
      message: `Generated ${scenarios.length} scenarios`,
    });
  } catch (error: any) {
    logger.error('Error generating scenarios:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate scenarios',
    });
  }
});

// ============================================================================
// GET /api/v1/scenarios/:dealId
// List all scenarios for a deal
// ============================================================================

router.get('/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { includeInactive = 'false' } = req.query;

    const query = includeInactive === 'true'
      ? `SELECT * FROM deal_scenarios WHERE deal_id = $1 ORDER BY scenario_type`
      : `SELECT * FROM deal_scenarios WHERE deal_id = $1 AND is_active = TRUE ORDER BY scenario_type`;

    const { query: dbQuery } = await import('../../database/connection');
    const result = await dbQuery(query, [dealId]);

    res.json({
      success: true,
      data: {
        scenarios: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching scenarios:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch scenarios',
    });
  }
});

// ============================================================================
// GET /api/v1/scenarios/:scenarioId/details
// Get full scenario details including events and results
// ============================================================================

router.get('/:scenarioId/details', async (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;

    const details = await scenarioGenerationService.getScenarioDetails(scenarioId);

    res.json({
      success: true,
      data: details,
    });
  } catch (error: any) {
    logger.error('Error fetching scenario details:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch scenario details',
    });
  }
});

// ============================================================================
// GET /api/v1/scenarios/:dealId/comparison
// Get side-by-side comparison of all scenarios
// ============================================================================

router.get('/:dealId/comparison', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const comparison = await scenarioGenerationService.getScenarioComparison(dealId);

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error: any) {
    logger.error('Error fetching scenario comparison:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch scenario comparison',
    });
  }
});

// ============================================================================
// PUT /api/v1/scenarios/:scenarioId/recalculate
// Recalculate scenario with updated events
// ============================================================================

router.put('/:scenarioId/recalculate', async (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;
    const { userId } = req.body;

    logger.info(`Recalculating scenario ${scenarioId}`);

    const scenario = await scenarioGenerationService.recalculateScenario(
      scenarioId,
      userId || (req as any).user?.id
    );

    res.json({
      success: true,
      data: { scenario },
      message: 'Scenario recalculated successfully',
    });
  } catch (error: any) {
    logger.error('Error recalculating scenario:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to recalculate scenario',
    });
  }
});

// ============================================================================
// POST /api/v1/scenarios/custom
// Create a custom user-defined scenario
// ============================================================================

router.post('/custom', async (req: Request, res: Response) => {
  try {
    const {
      dealId,
      scenarioName,
      description,
      selectedEventIds = [],
      excludedEventIds = [],
      assumptionOverrides = {},
      userId,
    } = req.body;

    if (!dealId || !scenarioName) {
      return res.status(400).json({
        success: false,
        error: 'dealId and scenarioName are required',
      });
    }

    const { query: dbQuery } = await import('../../database/connection');

    // Create custom scenario
    const scenarioResult = await dbQuery(
      `INSERT INTO deal_scenarios (
        deal_id, scenario_template_id, scenario_type, scenario_name, description,
        is_custom, generation_trigger, generated_by
      ) VALUES ($1, NULL, $2, $3, $4, TRUE, $5, $6)
      RETURNING *`,
      [dealId, 'custom', scenarioName, description, 'manual', userId]
    );

    const scenario = scenarioResult.rows[0];

    // Store custom configuration
    await dbQuery(
      `INSERT INTO custom_scenario_configs (
        scenario_id, selected_event_ids, excluded_event_ids, assumption_overrides
      ) VALUES ($1, $2, $3, $4)`,
      [
        scenario.id,
        JSON.stringify(selectedEventIds),
        JSON.stringify(excludedEventIds),
        JSON.stringify(assumptionOverrides),
      ]
    );

    res.json({
      success: true,
      data: { scenario },
      message: 'Custom scenario created successfully',
    });
  } catch (error: any) {
    logger.error('Error creating custom scenario:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create custom scenario',
    });
  }
});

// ============================================================================
// PUT /api/v1/scenarios/:scenarioId
// Update custom scenario
// ============================================================================

router.put('/:scenarioId', async (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;
    const {
      scenarioName,
      description,
      selectedEventIds,
      excludedEventIds,
      assumptionOverrides,
    } = req.body;

    const { query: dbQuery } = await import('../../database/connection');

    // Update scenario
    if (scenarioName || description) {
      await dbQuery(
        `UPDATE deal_scenarios 
         SET scenario_name = COALESCE($1, scenario_name),
             description = COALESCE($2, description),
             updated_at = NOW()
         WHERE id = $3 AND is_custom = TRUE`,
        [scenarioName, description, scenarioId]
      );
    }

    // Update custom configuration
    if (selectedEventIds || excludedEventIds || assumptionOverrides) {
      await dbQuery(
        `UPDATE custom_scenario_configs
         SET selected_event_ids = COALESCE($1, selected_event_ids),
             excluded_event_ids = COALESCE($2, excluded_event_ids),
             assumption_overrides = COALESCE($3, assumption_overrides),
             updated_at = NOW()
         WHERE scenario_id = $4`,
        [
          selectedEventIds ? JSON.stringify(selectedEventIds) : null,
          excludedEventIds ? JSON.stringify(excludedEventIds) : null,
          assumptionOverrides ? JSON.stringify(assumptionOverrides) : null,
          scenarioId,
        ]
      );
    }

    res.json({
      success: true,
      message: 'Scenario updated successfully',
    });
  } catch (error: any) {
    logger.error('Error updating scenario:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update scenario',
    });
  }
});

// ============================================================================
// DELETE /api/v1/scenarios/:scenarioId
// Delete custom scenario
// ============================================================================

router.delete('/:scenarioId', async (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;

    const { query: dbQuery } = await import('../../database/connection');

    // Only allow deletion of custom scenarios
    const result = await dbQuery(
      `DELETE FROM deal_scenarios 
       WHERE id = $1 AND is_custom = TRUE
       RETURNING *`,
      [scenarioId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Custom scenario not found',
      });
    }

    res.json({
      success: true,
      message: 'Scenario deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting scenario:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete scenario',
    });
  }
});

// ============================================================================
// GET /api/v1/scenarios/templates
// Get scenario template definitions
// ============================================================================

router.get('/templates', async (req: Request, res: Response) => {
  try {
    const { query: dbQuery } = await import('../../database/connection');

    const result = await dbQuery(
      `SELECT * FROM scenario_templates ORDER BY 
       CASE scenario_type 
         WHEN 'bull' THEN 1 
         WHEN 'base' THEN 2 
         WHEN 'bear' THEN 3 
         WHEN 'stress' THEN 4 
       END`
    );

    res.json({
      success: true,
      data: {
        templates: result.rows,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch templates',
    });
  }
});

// ============================================================================
// GET /api/v1/scenarios/:dealId/events
// Get available events for custom scenario builder
// ============================================================================

router.get('/:dealId/events', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const { query: dbQuery } = await import('../../database/connection');

    // Get trade area for deal
    const dealResult = await dbQuery(
      'SELECT trade_area_id FROM deals WHERE id = $1',
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found',
      });
    }

    const tradeAreaId = dealResult.rows[0].trade_area_id;

    if (!tradeAreaId) {
      return res.json({
        success: true,
        data: {
          demandEvents: [],
          supplyEvents: [],
          riskEvents: [],
        },
      });
    }

    // Get demand events
    const demandResult = await dbQuery(
      `SELECT 
        dp.id, dp.event_summary as summary, dp.employee_count as impact,
        dp.demand_direction as direction, det.category,
        dp.event_date, dp.projected_delivery_date as impact_date
       FROM demand_projections dp
       JOIN demand_event_types det ON det.id = dp.event_type_id
       WHERE dp.trade_area_id = $1
       ORDER BY dp.projected_delivery_date`,
      [tradeAreaId]
    );

    // Get supply events
    const supplyResult = await dbQuery(
      `SELECT 
        sp.id, sp.project_name as summary, sp.units as impact,
        sp.category, sp.announcement_date as event_date,
        sp.projected_delivery as impact_date
       FROM supply_pipeline sp
       WHERE sp.trade_area_id = $1
       ORDER BY sp.projected_delivery`,
      [tradeAreaId]
    );

    // Get risk events
    const riskResult = await dbQuery(
      `SELECT 
        re.id, re.description as summary, re.event_type as category,
        re.probability, re.identified_date as event_date
       FROM risk_escalations re
       WHERE re.trade_area_id = $1 AND re.is_active = TRUE
       ORDER BY re.probability DESC`,
      [tradeAreaId]
    );

    res.json({
      success: true,
      data: {
        demandEvents: demandResult.rows,
        supplyEvents: supplyResult.rows,
        riskEvents: riskResult.rows,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch events',
    });
  }
});

export default router;
