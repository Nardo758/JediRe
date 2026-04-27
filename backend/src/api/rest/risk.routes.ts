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
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const {
      riskCategoryId,
      scoreThreshold = 70.0,
      changeThreshold = 5.0,
      alertOnEscalation = true,
      alertOnCriticalOnly = false,
      notificationEnabled = true,
      notificationChannel = 'email',
    } = req.body;

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

/**
 * GET /api/v1/risk/trade-area/:id/regulatory
 * Get regulatory risk details for a trade area
 */
router.get('/trade-area/:id/regulatory', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Calculate regulatory risk
    const regulatoryRisk = await riskScoringService.calculateRegulatoryRisk(id);

    // Get zoning changes
    const zoningResult = await query(
      `SELECT 
         id, address, current_zoning, proposed_zoning, zoning_change_type,
         impact_type, risk_score_impact, status, hearing_date, effective_date
       FROM zoning_changes
       WHERE trade_area_id = $1
       ORDER BY hearing_date DESC NULLS LAST`,
      [id]
    );

    // Get tax policy changes
    const taxResult = await query(
      `SELECT 
         id, tax_type, jurisdiction_name, previous_rate, new_rate, rate_change_pct,
         estimated_annual_cost_impact, effective_date, description
       FROM tax_policy_changes
       WHERE trade_area_id = $1
       ORDER BY effective_date DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        regulatoryRisk,
        zoningChanges: zoningResult.rows,
        taxPolicyChanges: taxResult.rows,
      },
    });
  } catch (error) {
    logger.error('Error fetching regulatory risk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch regulatory risk',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/risk/trade-area/:id/market
 * Get market risk details for a trade area
 */
router.get('/trade-area/:id/market', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Calculate market risk
    const marketRisk = await riskScoringService.calculateMarketRisk(id);

    // Get historical market indicators (last 12 months)
    const historyResult = await query(
      `SELECT 
         as_of_date,
         current_10yr_treasury,
         current_cap_rate,
         estimated_cap_rate_expansion,
         current_dscr,
         transaction_volume_index,
         recession_probability
       FROM market_risk_indicators
       WHERE trade_area_id = $1
       ORDER BY as_of_date DESC
       LIMIT 12`,
      [id]
    );

    res.json({
      success: true,
      data: {
        marketRisk,
        historicalIndicators: historyResult.rows,
      },
    });
  } catch (error) {
    logger.error('Error fetching market risk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market risk',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/risk/trade-area/:id/execution
 * Get execution risk details for a trade area
 */
router.get('/trade-area/:id/execution', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Calculate execution risk
    const executionRisk = await riskScoringService.calculateExecutionRisk(id);

    res.json({
      success: true,
      data: {
        executionRisk,
      },
    });
  } catch (error) {
    logger.error('Error fetching execution risk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch execution risk',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/risk/trade-area/:id/climate
 * Get climate risk details for a trade area
 */
router.get('/trade-area/:id/climate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Calculate climate risk
    const climateRisk = await riskScoringService.calculateClimateRisk(id);

    res.json({
      success: true,
      data: {
        climateRisk,
      },
    });
  } catch (error) {
    logger.error('Error fetching climate risk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch climate risk',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/risk/comprehensive/:dealId
 * Get comprehensive risk assessment for a deal (all 6 categories)
 */
router.get('/comprehensive/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    // Get trade areas for this deal
    const tradeAreasResult = await query(
      `SELECT ta.id, ta.name
       FROM trade_areas ta
       JOIN properties p ON p.id = ta.property_id
       WHERE p.deal_id = $1`,
      [dealId]
    );

    if (tradeAreasResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No trade areas found for this deal',
      });
    }

    // Calculate all 6 category risks for each trade area
    const tradeAreaRisks = await Promise.all(
      tradeAreasResult.rows.map(async (ta) => {
        const composite = await riskScoringService.calculateCompositeRisk(ta.id);
        const supply = await riskScoringService.calculateSupplyRisk(ta.id);
        const demand = await riskScoringService.calculateDemandRisk(ta.id);
        const regulatory = await riskScoringService.calculateRegulatoryRisk(ta.id);
        const market = await riskScoringService.calculateMarketRisk(ta.id);
        const execution = await riskScoringService.calculateExecutionRisk(ta.id);
        const climate = await riskScoringService.calculateClimateRisk(ta.id);

        return {
          tradeAreaId: ta.id,
          tradeAreaName: ta.name,
          composite,
          categories: {
            supply,
            demand,
            regulatory,
            market,
            execution,
            climate,
          },
        };
      })
    );

    // Calculate deal-level composite (average of trade areas)
    const avgComposite = tradeAreaRisks.reduce((sum, ta) => sum + ta.composite.compositeScore, 0) / tradeAreaRisks.length;

    res.json({
      success: true,
      data: {
        dealId,
        compositeRiskScore: parseFloat(avgComposite.toFixed(2)),
        tradeAreaRisks,
      },
    });
  } catch (error) {
    logger.error('Error fetching comprehensive risk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comprehensive risk',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/risk/narrative/:dealId
 * Generate AI-powered risk narrative assessment using Claude Opus
 * Synthesizes market data, user assumptions, and upstream model outputs
 */
router.post('/narrative/:dealId', async (req: Request, res: Response) => {
  const { dealId } = req.params;
  const { categories, compositeScore } = req.body;

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

    const dealResult = await query(
      `SELECT * FROM deals WHERE id = $1 OR id::text = $1 LIMIT 1`,
      [dealId]
    );
    const deal = dealResult.rows[0] || {};

    let rentCompsContext = '';
    try {
      const rc = await query(`SELECT property_name, total_units, occupancy_pct, rent_per_sf, one_bed_rent, two_bed_rent FROM rent_comps LIMIT 10`);
      if (rc.rows.length > 0) {
        rentCompsContext = '\n## Rent Comps\n' + rc.rows.map((r: any) => `- ${r.property_name}: ${r.total_units} units, ${r.occupancy_pct}% occ, $${r.rent_per_sf}/sf, 1BR $${r.one_bed_rent || '-'}, 2BR $${r.two_bed_rent || '-'}`).join('\n');
      }
    } catch (_e) {}

    let supplyContext = '';
    try {
      const sp = await query(`SELECT COUNT(*) as cnt, SUM(unit_count) as units FROM supply_projects WHERE status IN ('proposed','under_construction','approved')`);
      if (sp.rows[0]) {
        supplyContext = `\n## Supply Pipeline\n- Active projects: ${sp.rows[0].cnt}\n- Units in pipeline: ${sp.rows[0].units || 'N/A'}`;
      }
    } catch (_e) {}

    let proformaContext = '';
    try {
      const pf = await query(`SELECT proforma_data, assumptions FROM opus_proforma_versions WHERE deal_id = $1 ORDER BY version_number DESC LIMIT 1`, [dealId]);
      if (pf.rows[0]) {
        const pfData = typeof pf.rows[0].proforma_data === 'string' ? JSON.parse(pf.rows[0].proforma_data) : pf.rows[0].proforma_data;
        const assumptions = typeof pf.rows[0].assumptions === 'string' ? JSON.parse(pf.rows[0].assumptions) : pf.rows[0].assumptions;
        proformaContext = `\n## Pro Forma Model (Latest Version)\n${JSON.stringify(pfData, null, 2).substring(0, 2000)}\n### User Assumptions\n${JSON.stringify(assumptions, null, 2).substring(0, 500)}`;
      }
    } catch (_e) {}

    let strategyContext = '';
    try {
      const sa = await query(`SELECT strategy_type, recommendation, confidence_score, analysis_data FROM strategy_analyses WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1`, [dealId]);
      if (sa.rows[0]) {
        strategyContext = `\n## Strategy Analysis\n- Recommended: ${sa.rows[0].strategy_type}\n- Confidence: ${sa.rows[0].confidence_score}%\n- Recommendation: ${sa.rows[0].recommendation}`;
      }
    } catch (_e) {}

    const systemPrompt = `You are JEDI, JediRE's risk intelligence engine. You are an expert real estate risk analyst writing a Bloomberg Terminal-style risk assessment narrative for a deal.

Your assessment must:
1. Synthesize ALL available data — market conditions, supply pipeline, the user's financial model assumptions, strategy analysis, and rent comparables — into a cohesive risk narrative
2. Explain WHY each risk factor matters for THIS specific deal, not generic descriptions
3. Identify where the user's model assumptions may conflict with market reality
4. Call out specific data points that drive risk (e.g., "3,200 units in the construction pipeline within 3 miles will pressure absorption assumptions")
5. Provide actionable mitigation strategies tied to the deal's strategy
6. Write in clear, direct, analytical prose — like a senior analyst memo, not bullet points

Structure your response as a JSON object:
{
  "executiveSummary": "2-3 sentence overview of the risk posture",
  "categoryNarratives": [
    {
      "categoryId": "supply|demand|regulatory|market|execution|climate",
      "title": "CATEGORY NAME",
      "narrative": "3-5 sentences of analysis specific to this deal, referencing concrete data points",
      "keyDataPoints": ["specific data point 1", "specific data point 2"],
      "conflictsWithAssumptions": "description of any conflicts with user's model assumptions, or null",
      "mitigationStrategy": "specific actionable mitigation"
    }
  ],
  "crossCuttingRisks": "2-3 sentences on risks that span multiple categories",
  "recommendation": "2-3 sentences with clear go/no-go guidance and conditions"
}`;

    const userPrompt = `## Deal Information
- Name: ${deal.name || 'Unknown'}
- Address: ${deal.address || 'N/A'}
- City: ${deal.city || 'N/A'}, State: ${deal.state || 'N/A'}
- Property Type: ${deal.property_type || 'Multifamily'}
- Units: ${deal.units || 'TBD'}
- Strategy: ${deal.strategy || deal.strategy_type || 'value-add'}
- Stage: ${deal.stage || deal.pipeline_stage || 'underwriting'}
- Purchase Price: ${deal.purchase_price || deal.price || 'TBD'}

## Current Risk Scores (from quantitative model)
Composite: ${compositeScore?.toFixed?.(1) || 'N/A'}/100
${(categories || []).map((c: any) => `- ${c.name}: ${c.score}/100 (${c.severity}) — Driver: ${c.driver} — Trend: ${c.trendDirection} (${c.trend30d > 0 ? '+' : ''}${c.trend30d} 30d)`).join('\n')}
${rentCompsContext}
${supplyContext}
${proformaContext}
${strategyContext}

Write a comprehensive risk assessment narrative. Return valid JSON only.`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let clientDisconnected = false;
    req.on('close', () => { clientDisconnected = true; });

    let fullResponse = '';

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    for await (const event of stream) {
      if (clientDisconnected) {
        stream.abort();
        break;
      }
      if (event.type === 'content_block_delta' && (event.delta as any).type === 'text_delta') {
        const text = (event.delta as any).text;
        if (text) {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
        }
      }
    }

    let parsed = null;
    try {
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch (_e) {}

    res.write(`data: ${JSON.stringify({ type: 'done', narrative: parsed, raw: !parsed ? fullResponse : undefined })}\n\n`);
    res.end();
  } catch (error: any) {
    logger.error('Error generating risk narrative:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate risk narrative',
        message: error.message,
      });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
});

export default router;
