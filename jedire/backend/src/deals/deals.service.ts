import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateDealDto, UpdateDealDto, DealQueryDto } from './dto';
import { DealAnalysisService } from '../services/dealAnalysis';
import { DealTriageService } from '../services/DealTriageService';

@Injectable()
export class DealsService {
  constructor(private readonly db: Pool) {}

  /**
   * Create a new deal
   */
  async create(userId: string, dto: CreateDealDto) {
    // Check if user can create more deals (tier limit)
    const canCreate = await this.db.query(
      'SELECT can_create_deal($1) AS can_create',
      [userId]
    );

    if (!canCreate.rows[0].can_create) {
      const subscription = await this.db.query(
        'SELECT tier, max_deals FROM subscriptions WHERE user_id = $1',
        [userId]
      );
      
      const tier = subscription.rows[0]?.tier || 'basic';
      const maxDeals = subscription.rows[0]?.max_deals || 5;
      
      throw new ForbiddenException({
        error: 'DEAL_LIMIT_REACHED',
        message: `You've reached the maximum of ${maxDeals} deals for ${tier} tier.`,
        currentTier: tier,
        maxDeals,
        upgradeUrl: '/settings/billing'
      });
    }

    // Get user's subscription tier
    const tierResult = await this.db.query(
      'SELECT COALESCE(s.tier, \'basic\') AS tier FROM users u LEFT JOIN subscriptions s ON u.id = s.user_id WHERE u.id = $1',
      [userId]
    );
    const tier = tierResult.rows[0].tier;

    // Validate boundary geometry
    if (!dto.boundary || !dto.boundary.coordinates) {
      throw new BadRequestException('Invalid boundary geometry');
    }

    // Create deal
    const result = await this.db.query(
      `INSERT INTO deals (
        user_id, name, boundary, project_type, project_intent,
        target_units, budget, timeline_start, timeline_end, tier,
        deal_category, development_type, address, description
      ) VALUES ($1, $2, ST_GeomFromGeoJSON($3), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, name, project_type, tier, deal_category, development_type, address, created_at`,
      [
        userId,
        dto.name,
        JSON.stringify(dto.boundary),
        dto.projectType,
        dto.projectIntent,
        dto.targetUnits,
        dto.budget,
        dto.timelineStart,
        dto.timelineEnd,
        dto.tier || tier,
        dto.deal_category,
        dto.development_type,
        dto.address,
        dto.description || null
      ]
    );

    const deal = result.rows[0];

    // Initialize deal modules based on tier
    await this.initializeModules(deal.id, tier);

    // Initialize pipeline
    await this.initializePipeline(deal.id, dto.projectType);

    // Log activity
    await this.logActivity(deal.id, userId, 'created', `Deal created: ${dto.name}`);

    // Auto-triage the deal (async, don't block response)
    this.autoTriageDeal(deal.id).catch(error => {
      console.error(`[AutoTriage] Failed for deal ${deal.id}:`, error);
    });

    return {
      ...deal,
      boundary: dto.boundary
    };
  }

  /**
   * Initialize modules for a deal based on subscription tier
   */
  private async initializeModules(dealId: string, tier: string) {
    const modulesByTier: Record<string, string[]> = {
      basic: ['map', 'overview', 'context', 'notes', 'documents', 'due-diligence', 'timeline', 'files'],
      pro: ['map', 'overview', 'ai-agent', 'competition', 'supply', 'market', 'debt', 'financial', 'strategy', 'due-diligence', 'documents', 'timeline', 'notes', 'files', 'exit', 'context'],
      enterprise: ['map', 'overview', 'ai-agent', 'competition', 'supply', 'market', 'debt', 'financial', 'strategy', 'due-diligence', 'team', 'documents', 'timeline', 'notes', 'files', 'exit', 'context']
    };

    const modules = modulesByTier[tier] || modulesByTier.basic;

    for (const moduleName of modules) {
      await this.db.query(
        'INSERT INTO deal_modules (deal_id, module_name, is_enabled) VALUES ($1, $2, true)',
        [dealId, moduleName]
      );
    }
  }

  /**
   * Initialize pipeline stages based on project type
   */
  private async initializePipeline(dealId: string, projectType: string) {
    const defaultStage = 'lead';
    
    await this.db.query(
      `INSERT INTO deal_pipeline (deal_id, stage, stage_history)
       VALUES ($1, $2, $3)`,
      [
        dealId,
        defaultStage,
        JSON.stringify([{
          stage: defaultStage,
          timestamp: new Date().toISOString()
        }])
      ]
    );
  }

  /**
   * Get all deals for a user
   */
  async findAll(userId: string, query: DealQueryDto) {
    const { status = 'active', limit = 50, offset = 0 } = query;

    const result = await this.db.query(
      `SELECT 
        d.id,
        d.name,
        d.project_type,
        d.tier,
        d.status,
        d.budget,
        d.address,
        ST_AsGeoJSON(d.boundary)::json AS boundary,
        ST_Area(d.boundary::geography) / 4046.86 AS acres,
        d.created_at,
        d.updated_at,
        d.state,
        d.triage_status,
        d.triage_score,
        d.signal_confidence,
        d.triaged_at,
        d.state_data,
        COUNT(DISTINCT dp.property_id) AS property_count,
        COUNT(DISTINCT dt.id) FILTER (WHERE dt.status != 'completed') AS pending_tasks,
        COALESCE(
          EXTRACT(DAY FROM NOW() - COALESCE(
            (SELECT transitioned_at FROM state_transitions 
             WHERE deal_id = d.id AND to_state = d.state 
             ORDER BY transitioned_at DESC LIMIT 1),
            d.created_at
          ))::INTEGER,
          0
        ) AS days_in_station
      FROM deals d
      LEFT JOIN deal_properties dp ON d.id = dp.deal_id
      LEFT JOIN deal_tasks dt ON d.id = dt.deal_id
      WHERE d.user_id = $1
        AND ($2 = 'all' OR d.status = $2)
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT $3 OFFSET $4`,
      [userId, status, limit, offset]
    );

    const countResult = await this.db.query(
      'SELECT COUNT(*) FROM deals WHERE user_id = $1 AND ($2 = \'all\' OR status = $2)',
      [userId, status]
    );

    return {
      deals: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    };
  }

  /**
   * Get a single deal by ID
   */
  async findOne(dealId: string, userId: string) {
    const result = await this.db.query(
      `SELECT 
        d.*,
        ST_AsGeoJSON(d.boundary)::json AS boundary,
        ST_Area(d.boundary::geography) / 4046.86 AS acres,
        ST_AsGeoJSON(ST_Centroid(d.boundary))::json AS center,
        dp.stage AS pipeline_stage,
        dp.days_in_stage,
        COUNT(DISTINCT dpr.property_id) AS property_count,
        COUNT(DISTINCT de.email_id) AS email_count,
        COUNT(DISTINCT dt.id) AS task_count,
        COUNT(DISTINCT dt.id) FILTER (WHERE dt.status = 'completed') AS completed_tasks
      FROM deals d
      LEFT JOIN deal_pipeline dp ON d.id = dp.deal_id
      LEFT JOIN deal_properties dpr ON d.id = dpr.deal_id
      LEFT JOIN deal_emails de ON d.id = de.deal_id
      LEFT JOIN deal_tasks dt ON d.id = dt.deal_id
      WHERE d.id = $1 AND d.user_id = $2
      GROUP BY d.id, dp.stage, dp.days_in_stage`,
      [dealId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Deal not found');
    }

    return result.rows[0];
  }

  /**
   * Update a deal
   */
  async update(dealId: string, userId: string, dto: UpdateDealDto) {
    await this.verifyOwnership(dealId, userId);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(dto.name);
    }

    if (dto.boundary) {
      updates.push(`boundary = ST_GeomFromGeoJSON($${paramIndex++})`);
      values.push(JSON.stringify(dto.boundary));
    }

    if (dto.projectIntent) {
      updates.push(`project_intent = $${paramIndex++}`);
      values.push(dto.projectIntent);
    }

    if (dto.budget) {
      updates.push(`budget = $${paramIndex++}`);
      values.push(dto.budget);
    }

    if (dto.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(dto.status);
      
      if (dto.status === 'archived') {
        updates.push(`archived_at = NOW()`);
      }
    }

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    values.push(dealId);
    const result = await this.db.query(
      `UPDATE deals SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, status, updated_at`,
      values
    );

    await this.logActivity(dealId, userId, 'updated', `Deal updated: ${dto.name || 'properties changed'}`);

    return result.rows[0];
  }

  /**
   * Delete/Archive a deal
   */
  async remove(dealId: string, userId: string) {
    await this.verifyOwnership(dealId, userId);

    await this.db.query(
      'UPDATE deals SET status = \'archived\', archived_at = NOW() WHERE id = $1',
      [dealId]
    );

    await this.logActivity(dealId, userId, 'archived', 'Deal archived');

    return { success: true, message: 'Deal archived successfully' };
  }

  /**
   * Get deal modules (enabled features)
   */
  async getModules(dealId: string, userId: string) {
    await this.verifyOwnership(dealId, userId);

    const result = await this.db.query(
      `SELECT module_name, is_enabled, settings
       FROM deal_modules
       WHERE deal_id = $1
       ORDER BY 
         CASE module_name
           WHEN 'map' THEN 1
           WHEN 'overview' THEN 2
           WHEN 'ai-agent' THEN 3
           WHEN 'competition' THEN 4
           WHEN 'supply' THEN 5
           WHEN 'market' THEN 6
           WHEN 'debt' THEN 7
           WHEN 'financial' THEN 8
           WHEN 'strategy' THEN 9
           WHEN 'due-diligence' THEN 10
           WHEN 'team' THEN 11
           WHEN 'documents' THEN 12
           WHEN 'timeline' THEN 13
           WHEN 'notes' THEN 14
           WHEN 'files' THEN 15
           WHEN 'exit' THEN 16
           WHEN 'context' THEN 17
           ELSE 99
         END`,
      [dealId]
    );

    return result.rows;
  }

  /**
   * Get properties within deal boundary
   */
  async getProperties(dealId: string, userId: string, filters: any = {}) {
    await this.verifyOwnership(dealId, userId);

    const { limit = 20, offset = 0, class: propertyClass, minRent, maxRent } = filters;

    let whereClause = '';
    const queryParams = [dealId];
    let paramIndex = 2;

    if (propertyClass) {
      whereClause += ` AND p.class = $${paramIndex++}`;
      queryParams.push(propertyClass);
    }

    if (minRent) {
      whereClause += ` AND p.rent >= $${paramIndex++}`;
      queryParams.push(minRent);
    }

    if (maxRent) {
      whereClause += ` AND p.rent <= $${paramIndex++}`;
      queryParams.push(maxRent);
    }

    queryParams.push(limit, offset);

    const result = await this.db.query(
      `SELECT 
        p.*,
        dp.relationship,
        dp.confidence_score,
        dp.notes,
        ST_Distance(
          d.boundary::geography,
          ST_Point(p.lng, p.lat)::geography
        ) / 1609.34 AS distance_miles
      FROM deals d
      CROSS JOIN LATERAL (
        SELECT * FROM properties p
        WHERE ST_Contains(d.boundary, ST_Point(p.lng, p.lat))
        ${whereClause}
      ) p
      LEFT JOIN deal_properties dp ON dp.deal_id = d.id AND dp.property_id = p.id
      WHERE d.id = $1
      ORDER BY p.rent ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams
    );

    return result.rows;
  }

  /**
   * Link property to deal
   */
  async linkProperty(dealId: string, userId: string, propertyId: string, relationship: string = 'comparable') {
    await this.verifyOwnership(dealId, userId);

    const result = await this.db.query(
      `INSERT INTO deal_properties (deal_id, property_id, relationship, linked_by, confidence_score)
       VALUES ($1, $2, $3, 'manual', 1.0)
       ON CONFLICT (deal_id, property_id) DO UPDATE
       SET relationship = $3, linked_by = 'manual', confidence_score = 1.0
       RETURNING *`,
      [dealId, propertyId, relationship]
    );

    await this.logActivity(dealId, userId, 'property_linked', `Property linked as ${relationship}`);

    return result.rows[0];
  }

  /**
   * Get deal pipeline status
   */
  async getPipeline(dealId: string, userId: string) {
    await this.verifyOwnership(dealId, userId);

    const result = await this.db.query(
      `SELECT 
        stage,
        EXTRACT(DAY FROM NOW() - entered_stage_at)::INTEGER AS days_in_stage,
        stage_history,
        notes
      FROM deal_pipeline
      WHERE deal_id = $1`,
      [dealId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Pipeline not found');
    }

    return result.rows[0];
  }

  /**
   * Update pipeline stage
   */
  async updatePipelineStage(dealId: string, userId: string, stage: string) {
    await this.verifyOwnership(dealId, userId);

    // Get current stage history
    const current = await this.db.query(
      'SELECT stage_history FROM deal_pipeline WHERE deal_id = $1',
      [dealId]
    );

    const history = current.rows[0]?.stage_history || [];
    history.push({
      stage,
      timestamp: new Date().toISOString()
    });

    // Update stage
    await this.db.query(
      `UPDATE deal_pipeline 
       SET stage = $1, entered_stage_at = NOW(), stage_history = $2
       WHERE deal_id = $3`,
      [stage, JSON.stringify(history), dealId]
    );

    await this.logActivity(dealId, userId, 'pipeline_stage_changed', `Stage changed to ${stage}`);

    return { success: true, stage };
  }

  /**
   * Get latest analysis for a deal
   */
  async getLatestAnalysis(dealId: string, userId: string) {
    await this.verifyOwnership(dealId, userId);

    const result = await this.db.query(
      `SELECT * FROM analysis_results
       WHERE deal_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [dealId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('No analysis found');
    }

    return result.rows[0];
  }

  /**
   * Get deal activity feed
   */
  async getActivity(dealId: string, userId: string, limit: number = 50) {
    await this.verifyOwnership(dealId, userId);

    const result = await this.db.query(
      `SELECT 
        da.*,
        u.name AS user_name,
        u.email AS user_email
      FROM deal_activity da
      LEFT JOIN users u ON da.user_id = u.id
      WHERE da.deal_id = $1
      ORDER BY da.created_at DESC
      LIMIT $2`,
      [dealId, limit]
    );

    return result.rows;
  }

  /**
   * Get timeline events for a deal
   */
  async getTimeline(dealId: string, userId: string) {
    await this.verifyOwnership(dealId, userId);

    // Get activities grouped by date
    const result = await this.db.query(
      `SELECT 
        DATE(da.created_at) as event_date,
        json_agg(
          json_build_object(
            'id', da.id,
            'dealId', da.deal_id,
            'userId', da.user_id,
            'activityType', da.action_type,
            'description', da.description,
            'metadata', da.metadata,
            'createdAt', da.created_at,
            'user', json_build_object(
              'id', u.id,
              'name', u.name,
              'email', u.email
            )
          ) ORDER BY da.created_at DESC
        ) as activities
      FROM deal_activity da
      LEFT JOIN users u ON da.user_id = u.id
      WHERE da.deal_id = $1
      GROUP BY DATE(da.created_at)
      ORDER BY DATE(da.created_at) DESC
      LIMIT 30`,
      [dealId]
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const events = result.rows.map(row => {
      const eventDate = new Date(row.event_date);
      eventDate.setHours(0, 0, 0, 0);
      
      let type: 'past' | 'current' | 'future' = 'past';
      if (eventDate.getTime() === today.getTime()) {
        type = 'current';
      } else if (eventDate > today) {
        type = 'future';
      }

      return {
        date: row.event_date,
        title: `${row.activities.length} activities`,
        type,
        completed: type === 'past',
        activities: row.activities,
      };
    });

    return events;
  }

  /**
   * Get key moments for a deal
   */
  async getKeyMoments(dealId: string, userId: string) {
    await this.verifyOwnership(dealId, userId);

    // Get critical activities that are key moments
    const result = await this.db.query(
      `SELECT 
        da.*,
        u.name AS user_name,
        u.email AS user_email
      FROM deal_activity da
      LEFT JOIN users u ON da.user_id = u.id
      WHERE da.deal_id = $1
        AND da.action_type IN (
          'milestone_hit',
          'deal_created',
          'status_change',
          'risk_flagged',
          'analysis_triggered',
          'financial_update'
        )
      ORDER BY da.created_at DESC
      LIMIT 20`,
      [dealId]
    );

    const moments = result.rows.map(row => {
      let momentType: 'milestone' | 'decision' | 'risk' | 'achievement' = 'milestone';
      let importance: 'low' | 'medium' | 'high' | 'critical' = 'medium';

      if (row.action_type === 'risk_flagged') {
        momentType = 'risk';
        importance = 'high';
      } else if (row.action_type === 'milestone_hit') {
        momentType = 'milestone';
        importance = 'high';
      } else if (row.action_type === 'deal_created') {
        momentType = 'achievement';
        importance = 'critical';
      } else if (row.action_type === 'status_change') {
        momentType = 'decision';
        importance = 'medium';
      } else if (row.action_type === 'analysis_triggered') {
        momentType = 'achievement';
        importance = 'medium';
      }

      return {
        id: row.id,
        dealId: row.deal_id,
        title: row.action_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        description: row.description,
        momentType,
        importance,
        date: row.created_at,
        metadata: row.metadata,
      };
    });

    return moments;
  }

  /**
   * Helper: Verify user owns deal
   */
  private async verifyOwnership(dealId: string, userId: string) {
    const result = await this.db.query(
      'SELECT id FROM deals WHERE id = $1 AND user_id = $2',
      [dealId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Deal not found or access denied');
    }
  }

  /**
   * Trigger analysis for a deal
   */
  async triggerAnalysis(dealId: string, userId: string) {
    await this.verifyOwnership(dealId, userId);

    // Get deal details
    const dealResult = await this.db.query(
      `SELECT id, name, boundary, target_units, budget
       FROM deals WHERE id = $1`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      throw new NotFoundException('Deal not found');
    }

    const deal = dealResult.rows[0];

    // Convert PostGIS geometry to GeoJSON
    const boundaryResult = await this.db.query(
      `SELECT ST_AsGeoJSON(boundary) AS boundary_geojson
       FROM deals WHERE id = $1`,
      [dealId]
    );

    const boundaryGeoJSON = JSON.parse(boundaryResult.rows[0].boundary_geojson);

    // Run analysis
    const analysisService = new DealAnalysisService(this.db);
    const result = await analysisService.analyzeDeal({
      dealId: deal.id,
      dealName: deal.name,
      boundary: boundaryGeoJSON,
      targetUnits: deal.target_units,
      budget: deal.budget,
    });

    // Log activity
    await this.logActivity(
      dealId,
      userId,
      'analysis_triggered',
      `JEDI Score analysis completed: ${result.jediScore}/100 (${result.verdict})`,
      { jediScore: result.jediScore, verdict: result.verdict }
    );

    return result;
  }

  /**
   * Helper: Log activity
   */
  private async logActivity(dealId: string, userId: string, actionType: string, description: string, metadata: any = {}) {
    await this.db.query(
      `INSERT INTO deal_activity (deal_id, user_id, action_type, description, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [dealId, userId, actionType, description, JSON.stringify(metadata)]
    );
  }

  /**
   * Auto-triage deal (called after creation)
   */
  private async autoTriageDeal(dealId: string): Promise<void> {
    try {
      console.log(`[AutoTriage] Starting auto-triage for deal ${dealId}`);
      
      const triageService = new DealTriageService(this.db);
      const result = await triageService.triageDeal(dealId);
      
      console.log(`[AutoTriage] Completed: ${result.score}/50 (${result.status})`);
    } catch (error) {
      console.error(`[AutoTriage] Error:`, error);
      throw error;
    }
  }

  /**
   * Manually trigger triage for a deal
   */
  async triageDeal(dealId: string, userId: string) {
    await this.verifyOwnership(dealId, userId);

    const triageService = new DealTriageService(this.db);
    const result = await triageService.triageDeal(dealId);

    return result;
  }

  /**
   * Get triage result for a deal
   */
  async getTriageResult(dealId: string, userId: string) {
    await this.verifyOwnership(dealId, userId);

    const result = await this.db.query(
      `SELECT 
        triage_result,
        triage_status,
        triage_score,
        triaged_at
      FROM deals
      WHERE id = $1`,
      [dealId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Deal not found');
    }

    const row = result.rows[0];

    if (!row.triage_result) {
      throw new NotFoundException('Deal has not been triaged yet');
    }

    return {
      ...row.triage_result,
      status: row.triage_status,
      score: row.triage_score,
      triagedAt: row.triaged_at,
    };
  }

  /**
   * Get unified project management overview
   * Consolidates Timeline + Due Diligence data
   */
  async getProjectManagementOverview(dealId: string, userId: string) {
    await this.verifyOwnership(dealId, userId);

    // Get deal details
    const dealResult = await this.db.query(
      `SELECT 
        id,
        name,
        stage,
        created_at,
        actual_close_date,
        target_close_date
      FROM deals
      WHERE id = $1`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      throw new NotFoundException('Deal not found');
    }

    const deal = dealResult.rows[0];
    const isPipeline = deal.stage !== 'closed' && !deal.actual_close_date;

    // Calculate days metric
    let daysMetric;
    if (isPipeline && deal.target_close_date) {
      const today = new Date();
      const targetDate = new Date(deal.target_close_date);
      daysMetric = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    } else if (deal.actual_close_date) {
      const today = new Date();
      const closedDate = new Date(deal.actual_close_date);
      daysMetric = Math.ceil((today.getTime() - closedDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      daysMetric = null;
    }

    // In a production system, you would query actual task/checklist data from the database
    // For now, we return a structured response that matches the frontend expectations
    return {
      dealId: deal.id,
      dealName: deal.name,
      isPipeline,
      
      // Progress metrics
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      overdueTasks: 0,
      blockedTasks: 0,
      completionPercentage: 0,
      
      // Timeline metrics
      daysToClosing: isPipeline ? daysMetric : null,
      daysSinceAcquisition: !isPipeline ? daysMetric : null,
      targetDate: deal.target_close_date,
      
      // Lists (would be populated from database in production)
      tasks: [],
      criticalPathTasks: [],
      blockers: [],
      recentCompletions: [],
      upcomingDeadlines: [],
      
      // Category breakdown
      categoryProgress: [
        { category: 'legal', label: 'Legal', total: 0, completed: 0, percentage: 0, color: 'bg-blue-600' },
        { category: 'financial', label: 'Financial', total: 0, completed: 0, percentage: 0, color: 'bg-green-600' },
        { category: 'physical', label: 'Physical', total: 0, completed: 0, percentage: 0, color: 'bg-purple-600' },
        { category: 'environmental', label: 'Environmental', total: 0, completed: 0, percentage: 0, color: 'bg-orange-600' }
      ],
      
      // Metadata
      lastUpdated: new Date().toISOString()
    };
  }
}

  /**
   * Get investment strategy overview (unified strategy + exit)
   * Returns: strategy type, execution status, projected exit timeline
   */
  async getInvestmentStrategyOverview(dealId: string, userId: string) {
    await this.verifyOwnership(dealId, userId);

    // Get deal info
    const dealResult = await this.db.query(
      `SELECT 
        d.id,
        d.name,
        d.project_type,
        d.deal_category,
        d.development_type,
        d.budget,
        d.created_at,
        d.timeline_start,
        d.timeline_end,
        dp.stage,
        dp.entered_stage_at
      FROM deals d
      LEFT JOIN deal_pipeline dp ON d.id = dp.deal_id
      WHERE d.id = $1`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      throw new NotFoundException('Deal not found');
    }

    const deal = dealResult.rows[0];
    
    // Determine if pipeline or assets owned
    const isPipeline = deal.stage !== 'closed' && deal.stage !== 'assets_owned';
    const strategyType = deal.development_type === 'value-add' ? 'value-add' :
                         deal.development_type === 'core-plus' ? 'core-plus' :
                         deal.development_type === 'opportunistic' ? 'opportunistic' : 'core';
    
    // Calculate dates
    const acquisitionDate = deal.stage === 'closed' || deal.stage === 'assets_owned' ? 
                           deal.entered_stage_at : null;
    const holdPeriodYears = strategyType === 'value-add' ? 5 : 7;
    const targetExitDate = acquisitionDate ? 
      new Date(new Date(acquisitionDate).getTime() + holdPeriodYears * 365 * 24 * 60 * 60 * 1000).toISOString() :
      new Date(Date.now() + holdPeriodYears * 365 * 24 * 60 * 60 * 1000).toISOString();
    
    // Calculate current phase
    let currentPhase = 'entry';
    if (acquisitionDate) {
      const monthsOwned = Math.floor((Date.now() - new Date(acquisitionDate).getTime()) / (30 * 24 * 60 * 60 * 1000));
      currentPhase = monthsOwned < 6 ? 'entry' :
                     monthsOwned < 48 ? 'value-creation' :
                     monthsOwned < 60 ? 'exit-prep' : 'exit';
    }
    
    // Calculate projections
    const projectedROI = strategyType === 'value-add' ? 85 : 45;
    const projectedExitValue = deal.budget ? deal.budget * (1 + projectedROI / 100) : 43500000;

    return {
      strategyType,
      holdPeriod: holdPeriodYears,
      currentPhase,
      projectedROI,
      projectedExitValue,
      acquisitionDate,
      targetExitDate,
      isPipeline,
      deal: {
        id: deal.id,
        name: deal.name,
        projectType: deal.project_type,
        dealCategory: deal.deal_category,
        stage: deal.stage
      }
    };
  }
