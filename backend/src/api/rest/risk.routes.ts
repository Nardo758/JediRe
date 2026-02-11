/**
 * Risk Scoring API Routes
 * Phase 2, Component 3: Supply Risk + Demand Risk endpoints
 * 
 * Routes:
 * - GET /api/v1/risk/trade-area/:id - Composite risk profile
 * - GET /api/v1/risk/trade-area/:id/supply - Supply risk details
 * - GET /api/v1/risk/trade-area/:id/demand - Demand risk details
 * - GET /api/v1/risk/deal/:id - Risk assessment for specific deal
 * - GET /api/v1/risk/history/:tradeAreaId - Risk score history
 * - GET /api/v1/risk/events - Recent risk escalation events
 * - POST /api/v1/risk/threshold - Configure alert thresholds
 * - POST /api/v1/risk/calculate/:tradeAreaId - Force recalculation
 */

import { Router, Request, Response } from 'express';
import { riskScoringService } from '../../services/risk-scoring.service';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/v1/risk/trade-area/:id
 * Get composite risk profile for a trade area
 */
router.get('/trade-area/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Calculate composite risk
    const composite = await riskScoringService.calculateCompositeRisk(id);

    // Get recent events
    const events = await riskScoringService.getRecentRiskEvents(id, 10);

    res.json({
      success: true,
      data: {
        composite,
        recentEvents: events,
      },
    });
  } catch (error) {
    logger.error('Error fetching trade area risk profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch risk profile',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/risk/trade-area/:id/supply
 * Get supply risk details for a trade area
 */
router.get('/trade-area/:id/supply', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Calculate supply risk
    const supplyRisk = await riskScoringService.calculateSupplyRisk(id);

    // Get pipeline projects
    const pipelineResult = await query(
      `SELECT 
         id, project_name, developer, total_units, project_status,
         probability, expected_delivery_date, risk_contribution
       FROM supply_pipeline_projects
       WHERE trade_area_id = $1
         AND project_status IN ('permitted', 'announced', 'under_construction')
       ORDER BY expected_delivery_date ASC NULLS LAST, total_units DESC`,
      [id]
    );

    // Get absorption tracking
    const absorptionResult = await query(
      `SELECT *
       FROM supply_absorption_tracking
       WHERE trade_area_id = $1
       ORDER BY period_start DESC
       LIMIT 12`,
      [id]
    );

    res.json({
      success: true,
      data: {
        supplyRisk,
        pipelineProjects: pipelineResult.rows,
        absorptionHistory: absorptionResult.rows,
      },
    });
  } catch (error) {
    logger.error('Error fetching supply risk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supply risk',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/risk/trade-area/:id/demand
 * Get demand risk details for a trade area
 */
router.get('/trade-area/:id/demand', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Calculate demand risk
    const demandRisk = await riskScoringService.calculateDemandRisk(id);

    // Get employer concentration
    const employerResult = await query(
      `SELECT 
         id, employer_name, industry, employee_count, concentration_pct,
         employer_stability, relocation_history, remote_work_policy,
         risk_contribution, dependency_factor, as_of_date
       FROM employer_concentration
       WHERE trade_area_id = $1
         AND as_of_date = (
           SELECT MAX(as_of_date) 
           FROM employer_concentration 
           WHERE trade_area_id = $1
         )
       ORDER BY concentration_pct DESC`,
      [id]
    );

    // Get demand driver events
    const eventsResult = await query(
      `SELECT 
         id, event_type, event_date, headline, description,
         affected_employees, impact_pct, risk_score_change, escalation_severity
       FROM demand_driver_events
       WHERE trade_area_id = $1
       ORDER BY event_date DESC
       LIMIT 20`,
      [id]
    );

    res.json({
      success: true,
      data: {
        demandRisk,
        employers: employerResult.rows,
        demandDriverEvents: eventsResult.rows,
      },
    });
  } catch (error) {
    logger.error('Error fetching demand risk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch demand risk',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/risk/deal/:id
 * Get risk assessment for a specific deal
 */
router.get('/deal/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get trade areas for this deal
    const tradeAreasResult = await query(
      `SELECT ta.id, ta.name
       FROM trade_areas ta
       JOIN properties p ON p.id = ta.property_id
       WHERE p.deal_id = $1`,
      [id]
    );

    if (tradeAreasResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No trade areas found for this deal',
      });
    }

    // Calculate composite risk for each trade area
    const tradeAreaRisks = await Promise.all(
      tradeAreasResult.rows.map(async (ta) => {
        const composite = await riskScoringService.calculateCompositeRisk(ta.id);
        return {
          tradeAreaId: ta.id,
          tradeAreaName: ta.name,
          ...composite,
        };
      })
    );

    // Calculate deal-level composite (average of trade areas)
    const avgComposite = tradeAreaRisks.reduce((sum, ta) => sum + ta.compositeScore, 0) / tradeAreaRisks.length;

    res.json({
      success: true,
      data: {
        dealId: id,
        compositeRiskScore: parseFloat(avgComposite.toFixed(2)),
        tradeAreaRisks,
      },
    });
  } catch (error) {
    logger.error('Error fetching deal risk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deal risk',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/risk/history/:tradeAreaId
 * Get risk score history for a trade area
 */
router.get('/history/:tradeAreaId', async (req: Request, res: Response) => {
  try {
    const { tradeAreaId } = req.params;
    const { category, limit = 50 } = req.query;

    const history = await riskScoringService.getRiskScoreHistory(
      tradeAreaId,
      category as string,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error('Error fetching risk history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch risk history',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/risk/events
 * Get recent risk escalation events across all trade areas
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const { limit = 50, category, severity, active = 'true' } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (category) {
      params.push(category);
      whereClause += ` AND rc.category_name = $${params.length}`;
    }

    if (severity) {
      params.push(severity);
      whereClause += ` AND re.severity = $${params.length}`;
    }

    if (active === 'true') {
      whereClause += ` AND re.is_active = TRUE`;
    }

    params.push(parseInt(limit as string));

    const result = await query(
      `SELECT 
         re.*,
         ta.name as trade_area_name,
         rc.category_name,
         rc.display_name as category_display_name
       FROM risk_events re
       JOIN trade_areas ta ON ta.id = re.trade_area_id
       JOIN risk_categories rc ON rc.id = re.risk_category_id
       ${whereClause}
       ORDER BY re.event_date DESC, re.severity DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching risk events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch risk events',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/risk/threshold
 * Configure alert thresholds for a user
 */
router.post('/threshold', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      riskCategoryId,
      scoreThreshold = 70.0,
      changeThreshold = 5.0,
      alertOnEscalation = true,
      alertOnCriticalOnly = false,
      notificationEnabled = true,
      notificationChannel = 'email',
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    // Upsert threshold configuration
    const result = await query(
      `INSERT INTO risk_alert_thresholds (
         user_id, risk_category_id, score_threshold, change_threshold,
         alert_on_escalation, alert_on_critical_only, notification_enabled, notification_channel
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, risk_category_id)
       DO UPDATE SET
         score_threshold = EXCLUDED.score_threshold,
         change_threshold = EXCLUDED.change_threshold,
         alert_on_escalation = EXCLUDED.alert_on_escalation,
         alert_on_critical_only = EXCLUDED.alert_on_critical_only,
         notification_enabled = EXCLUDED.notification_enabled,
         notification_channel = EXCLUDED.notification_channel,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        riskCategoryId || null,
        scoreThreshold,
        changeThreshold,
        alertOnEscalation,
        alertOnCriticalOnly,
        notificationEnabled,
        notificationChannel,
      ]
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Error configuring risk threshold:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to configure threshold',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/risk/calculate/:tradeAreaId
 * Force recalculation of risk scores for a trade area
 */
router.post('/calculate/:tradeAreaId', async (req: Request, res: Response) => {
  try {
    const { tradeAreaId } = req.params;

    // Calculate supply risk
    const supplyRisk = await riskScoringService.calculateSupplyRisk(tradeAreaId);
    await riskScoringService.saveRiskScore(
      tradeAreaId,
      'supply',
      supplyRisk.baseScore,
      supplyRisk.escalations.reduce((sum, e) => sum + e.scoreImpact, 0),
      supplyRisk.deEscalations.reduce((sum, e) => sum + e.scoreImpact, 0),
      { supplyRisk }
    );

    // Calculate demand risk
    const demandRisk = await riskScoringService.calculateDemandRisk(tradeAreaId);
    await riskScoringService.saveRiskScore(
      tradeAreaId,
      'demand',
      demandRisk.baseScore,
      demandRisk.escalations.reduce((sum, e) => sum + e.scoreImpact, 0),
      demandRisk.deEscalations.reduce((sum, e) => sum + e.scoreImpact, 0),
      { demandRisk }
    );

    // Calculate composite
    const composite = await riskScoringService.calculateCompositeRisk(tradeAreaId);

    res.json({
      success: true,
      data: {
        supplyRisk,
        demandRisk,
        composite,
      },
    });
  } catch (error) {
    logger.error('Error calculating risk scores:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate risk scores',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/risk/escalation/supply
 * Manually trigger supply risk escalation
 */
router.post('/escalation/supply', async (req: Request, res: Response) => {
  try {
    const {
      tradeAreaId,
      projectId,
      units,
      probability,
      deliveryMonths,
    } = req.body;

    if (!tradeAreaId || !projectId || !units || probability === undefined || deliveryMonths === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tradeAreaId, projectId, units, probability, deliveryMonths',
      });
    }

    const eventId = await riskScoringService.applySupplyEscalation(
      tradeAreaId,
      projectId,
      units,
      probability,
      deliveryMonths
    );

    // Recalculate risk score
    const supplyRisk = await riskScoringService.calculateSupplyRisk(tradeAreaId);

    res.json({
      success: true,
      data: {
        eventId,
        supplyRisk,
      },
    });
  } catch (error) {
    logger.error('Error applying supply escalation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply supply escalation',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/risk/escalation/demand
 * Manually trigger demand risk escalation
 */
router.post('/escalation/demand', async (req: Request, res: Response) => {
  try {
    const {
      tradeAreaId,
      employerId,
      eventType,
      affectedEmployees,
      totalEmployees,
    } = req.body;

    if (!tradeAreaId || !employerId || !eventType || !affectedEmployees || !totalEmployees) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tradeAreaId, employerId, eventType, affectedEmployees, totalEmployees',
      });
    }

    const eventId = await riskScoringService.applyDemandEscalation(
      tradeAreaId,
      employerId,
      eventType,
      affectedEmployees,
      totalEmployees
    );

    // Recalculate risk score
    const demandRisk = await riskScoringService.calculateDemandRisk(tradeAreaId);

    res.json({
      success: true,
      data: {
        eventId,
        demandRisk,
      },
    });
  } catch (error) {
    logger.error('Error applying demand escalation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply demand escalation',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/risk/de-escalation/supply
 * Manually trigger supply risk de-escalation
 */
router.post('/de-escalation/supply', async (req: Request, res: Response) => {
  try {
    const {
      tradeAreaId,
      projectId,
      reason,
    } = req.body;

    if (!tradeAreaId || !projectId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tradeAreaId, projectId, reason (cancelled|delayed|converted)',
      });
    }

    const eventId = await riskScoringService.applySupplyDeEscalation(
      tradeAreaId,
      projectId,
      reason
    );

    // Recalculate risk score
    const supplyRisk = await riskScoringService.calculateSupplyRisk(tradeAreaId);

    res.json({
      success: true,
      data: {
        eventId,
        supplyRisk,
      },
    });
  } catch (error) {
    logger.error('Error applying supply de-escalation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply supply de-escalation',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/risk/de-escalation/demand
 * Manually trigger demand risk de-escalation
 */
router.post('/de-escalation/demand', async (req: Request, res: Response) => {
  try {
    const {
      tradeAreaId,
      employerId,
      reason,
      employeeCount,
    } = req.body;

    if (!tradeAreaId || !employerId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tradeAreaId, employerId, reason (commitment|new_employer|diversification)',
      });
    }

    const eventId = await riskScoringService.applyDemandDeEscalation(
      tradeAreaId,
      employerId,
      reason,
      employeeCount
    );

    // Recalculate risk score
    const demandRisk = await riskScoringService.calculateDemandRisk(tradeAreaId);

    res.json({
      success: true,
      data: {
        eventId,
        demandRisk,
      },
    });
  } catch (error) {
    logger.error('Error applying demand de-escalation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply demand de-escalation',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/risk/categories
 * Get all risk categories with implementation status
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM risk_categories ORDER BY implementation_phase, category_name`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching risk categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch risk categories',
      message: error.message,
    });
  }
});

export default router;
