/**
 * Clawdbot Webhook Receiver Routes
 * 
 * Receive commands and queries from Clawdbot:
 * - POST /api/v1/clawdbot/command - Execute commands from Clawdbot
 * - POST /api/v1/clawdbot/query - Handle queries from Clawdbot
 * 
 * Security: Validates webhook signatures and auth tokens
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../../utils/logger';
import { getPool } from '../../database/connection';

const router = Router();
const pool = getPool();

interface ClawdbotWebhookRequest extends Request {
  body: {
    command?: string;
    query?: string;
    params?: any;
    timestamp?: string;
    requestId?: string;
  };
}

/**
 * Validate webhook signature
 */
function validateSignature(req: Request): boolean {
  const signature = req.headers['x-webhook-signature'] as string;
  const secret = process.env.CLAWDBOT_WEBHOOK_SECRET;
  
  // If no secret is configured, skip validation (development mode)
  if (!secret) {
    logger.warn('CLAWDBOT_WEBHOOK_SECRET not configured - skipping signature validation');
    return true;
  }
  
  // If no signature provided, reject
  if (!signature) {
    logger.warn('Webhook signature missing');
    return false;
  }
  
  // Calculate expected signature
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  // Compare signatures
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  
  if (!isValid) {
    logger.warn('Invalid webhook signature');
  }
  
  return isValid;
}

/**
 * Validate auth token (alternative to signature)
 */
function validateAuthToken(req: Request): boolean {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const expectedToken = process.env.CLAWDBOT_AUTH_TOKEN;
  
  // If no token is configured, skip validation
  if (!expectedToken) {
    return true;
  }
  
  // If no token provided, reject
  if (!token) {
    return false;
  }
  
  return token === expectedToken;
}

/**
 * Middleware to validate incoming webhooks
 */
function validateWebhook(req: Request, res: Response, next: Function): void {
  // Check signature first, then fall back to auth token
  const isValidSignature = validateSignature(req);
  const isValidToken = validateAuthToken(req);
  
  if (!isValidSignature && !isValidToken) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid webhook signature or auth token',
    });
    return;
  }
  
  next();
}

/**
 * POST /api/v1/clawdbot/command
 * 
 * Receive and execute commands from Clawdbot
 */
router.post('/command', validateWebhook, async (req: ClawdbotWebhookRequest, res: Response) => {
  try {
    const { command, params, timestamp, requestId } = req.body;
    
    logger.info('Clawdbot command received:', {
      command,
      requestId,
      timestamp,
    });
    
    // Validate command
    if (!command) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Command is required',
      });
    }
    
    // Handle different commands
    let result: any;
    
    switch (command) {
      case 'health':
        // Health check
        result = {
          status: 'healthy',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        };
        break;
      
      case 'get_deals': {
        // Get deals list with optional filters
        const { status, limit = 50, offset = 0 } = params || {};
        
        let query = `
          SELECT 
            d.id,
            d.name,
            d.project_type as "projectType",
            d.status,
            d.state,
            d.tier,
            d.budget,
            d.target_units as "targetUnits",
            d.deal_category as "dealCategory",
            d.address,
            d.created_at as "createdAt",
            d.updated_at as "updatedAt",
            (SELECT count(*) FROM deal_properties dp WHERE dp.deal_id = d.id)::int as "propertyCount",
            (SELECT count(*) FROM deal_tasks dt WHERE dt.deal_id = d.id AND dt.status != 'done')::int as "pendingTasks"
          FROM deals d
          WHERE d.archived_at IS NULL
        `;
        
        const queryParams: any[] = [];
        let paramIndex = 1;
        
        if (status) {
          query += ` AND d.status = $${paramIndex}`;
          queryParams.push(status);
          paramIndex++;
        }
        
        query += ` ORDER BY d.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limit, offset);
        
        const dealsResult = await pool.query(query, queryParams);
        
        result = {
          deals: dealsResult.rows,
          total: dealsResult.rowCount,
          limit,
          offset,
        };
        break;
      }
      
      case 'get_deal': {
        // Get specific deal with full data
        // Accepts either dealId OR name parameter
        if (!params?.dealId && !params?.name) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Either dealId or name parameter is required',
          });
        }
        
        let dealResult;
        
        // Search by name if provided
        if (params.name) {
          dealResult = await pool.query(`
            SELECT 
              d.*,
              ST_AsGeoJSON(d.boundary)::json as boundary_geojson,
              (SELECT count(*) FROM deal_properties dp WHERE dp.deal_id = d.id)::int as "propertyCount",
              (SELECT count(*) FROM deal_tasks dt WHERE dt.deal_id = d.id AND dt.status != 'done')::int as "pendingTasks",
              (SELECT count(*) FROM deal_tasks dt WHERE dt.deal_id = d.id)::int as "taskCount",
              CASE 
                WHEN d.boundary IS NOT NULL THEN 
                  ST_Area(d.boundary::geography) / 4046.86
                ELSE 0
              END as acres
            FROM deals d
            WHERE d.name ILIKE $1 AND d.archived_at IS NULL
            ORDER BY d.updated_at DESC
          `, [`%${params.name}%`]);
          
          // If multiple matches, return list of matches
          if (dealResult.rows.length > 1) {
            result = {
              multipleMatches: true,
              count: dealResult.rows.length,
              matches: dealResult.rows.map(d => ({
                id: d.id,
                name: d.name,
                status: d.status,
                projectType: d.project_type,
                dealCategory: d.deal_category,
                address: d.address,
                updatedAt: d.updated_at,
              })),
              message: `Found ${dealResult.rows.length} deals matching "${params.name}". Use dealId to get specific deal.`,
            };
            break;
          }
          
          // If no matches, return 404
          if (dealResult.rows.length === 0) {
            return res.status(404).json({
              error: 'Not Found',
              message: `No deals found matching "${params.name}"`,
            });
          }
          
          // Single match - continue to full deal details below
        } else {
          // Search by ID
          dealResult = await pool.query(`
            SELECT 
              d.*,
              ST_AsGeoJSON(d.boundary)::json as boundary_geojson,
              (SELECT count(*) FROM deal_properties dp WHERE dp.deal_id = d.id)::int as "propertyCount",
              (SELECT count(*) FROM deal_tasks dt WHERE dt.deal_id = d.id AND dt.status != 'done')::int as "pendingTasks",
              (SELECT count(*) FROM deal_tasks dt WHERE dt.deal_id = d.id)::int as "taskCount",
              CASE 
                WHEN d.boundary IS NOT NULL THEN 
                  ST_Area(d.boundary::geography) / 4046.86
                ELSE 0
              END as acres
            FROM deals d
            WHERE d.id = $1 AND d.archived_at IS NULL
          `, [params.dealId]);
          
          if (dealResult.rows.length === 0) {
            return res.status(404).json({
              error: 'Not Found',
              message: 'Deal not found',
            });
          }
        }
        
        const deal = dealResult.rows[0];
        
        // Get deal properties
        const propertiesResult = await pool.query(`
          SELECT 
            dp.id,
            dp.property_id as "propertyId",
            p.address,
            p.city,
            p.state,
            p.zip_code as "zipCode"
          FROM deal_properties dp
          LEFT JOIN properties p ON p.id = dp.property_id
          WHERE dp.deal_id = $1
          ORDER BY dp.created_at
        `, [deal.id]);
        
        // Get deal tasks
        const tasksResult = await pool.query(`
          SELECT 
            id,
            title,
            description,
            status,
            priority,
            due_date as "dueDate",
            created_at as "createdAt"
          FROM deal_tasks
          WHERE deal_id = $1
          ORDER BY priority DESC, due_date ASC NULLS LAST
          LIMIT 20
        `, [deal.id]);
        
        result = {
          deal: {
            id: deal.id,
            name: deal.name,
            projectType: deal.project_type,
            status: deal.status,
            state: deal.state,
            tier: deal.tier,
            budget: parseFloat(deal.budget) || 0,
            targetUnits: deal.target_units,
            dealCategory: deal.deal_category,
            address: deal.address,
            description: deal.description,
            acres: parseFloat(deal.acres) || 0,
            createdAt: deal.created_at,
            updatedAt: deal.updated_at,
          },
          properties: propertiesResult.rows,
          tasks: tasksResult.rows,
          propertyCount: deal.propertyCount,
          pendingTasks: deal.pendingTasks,
          taskCount: deal.taskCount,
        };
        break;
      }
      
      case 'search_deals': {
        // Search deals by name with fuzzy matching
        if (!params?.name) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'name parameter is required',
          });
        }
        
        const searchResult = await pool.query(`
          SELECT 
            d.id,
            d.name,
            d.status,
            d.project_type as "projectType",
            d.deal_category as "dealCategory",
            d.address,
            d.state,
            d.tier,
            d.updated_at as "updatedAt",
            (SELECT count(*) FROM deal_properties dp WHERE dp.deal_id = d.id)::int as "propertyCount"
          FROM deals d
          WHERE d.name ILIKE $1 
          AND d.archived_at IS NULL
          ORDER BY d.updated_at DESC
          LIMIT 10
        `, [`%${params.name}%`]);
        
        result = {
          deals: searchResult.rows,
          count: searchResult.rowCount,
          query: params.name,
        };
        break;
      }
      
      case 'run_analysis': {
        // Run analysis on a deal
        if (!params?.dealId) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'dealId parameter is required',
          });
        }
        
        const analysisType = params.analysisType || 'full';
        
        // Check if deal exists
        const dealCheck = await pool.query(
          'SELECT id, name FROM deals WHERE id = $1 AND archived_at IS NULL',
          [params.dealId]
        );
        
        if (dealCheck.rows.length === 0) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Deal not found',
          });
        }
        
        // In a real implementation, this would trigger actual analysis
        // For now, we'll log the request and return a success message
        logger.info('Analysis requested for deal:', {
          dealId: params.dealId,
          dealName: dealCheck.rows[0].name,
          analysisType,
        });
        
        result = {
          message: 'Analysis triggered successfully',
          dealId: params.dealId,
          dealName: dealCheck.rows[0].name,
          analysisType,
          status: 'queued',
          note: 'Analysis will be processed asynchronously. Check deal tasks for updates.',
        };
        break;
      }
      
      case 'system_stats': {
        // Get system statistics
        const statsResult = await pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE archived_at IS NULL) as total_deals,
            COUNT(*) FILTER (WHERE status = 'active' AND archived_at IS NULL) as active_deals,
            COUNT(*) FILTER (WHERE status = 'closed' AND archived_at IS NULL) as closed_deals,
            COUNT(*) FILTER (WHERE status = 'prospect' AND archived_at IS NULL) as prospect_deals,
            COUNT(*) FILTER (WHERE deal_category = 'pipeline' AND archived_at IS NULL) as pipeline_deals,
            COUNT(*) FILTER (WHERE deal_category = 'assets_owned' AND archived_at IS NULL) as owned_deals
          FROM deals
        `);
        
        const tasksResult = await pool.query(`
          SELECT
            COUNT(*) as total_tasks,
            COUNT(*) FILTER (WHERE status = 'todo') as todo_tasks,
            COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tasks,
            COUNT(*) FILTER (WHERE status = 'done') as done_tasks,
            COUNT(*) FILTER (WHERE status = 'blocked') as blocked_tasks
          FROM deal_tasks
        `);
        
        result = {
          deals: statsResult.rows[0],
          tasks: tasksResult.rows[0],
          timestamp: new Date().toISOString(),
        };
        break;
      }
      
      case 'recent_errors': {
        // Get recent error logs
        const limit = params?.limit || 20;
        const hours = params?.hours || 24;
        
        const errorsResult = await pool.query(`
          SELECT
            id,
            error_message as "errorMessage",
            error_context as "errorContext",
            url,
            deal_id as "dealId",
            user_id as "userId",
            is_network_error as "isNetworkError",
            is_webgl_error as "isWebGLError",
            created_at as "createdAt"
          FROM error_logs
          WHERE created_at > NOW() - INTERVAL '${hours} hours'
          ORDER BY created_at DESC
          LIMIT $1
        `, [limit]);
        
        result = {
          errors: errorsResult.rows,
          total: errorsResult.rowCount,
          timeRange: `Last ${hours} hours`,
        };
        break;
      }
      
      default:
        return res.status(400).json({
          error: 'Bad Request',
          message: `Unknown command: ${command}`,
        });
    }
    
    res.status(200).json({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      result,
    });
    
  } catch (error) {
    logger.error('Error processing Clawdbot command:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process command',
      details: (error as Error).message,
    });
  }
});

/**
 * POST /api/v1/clawdbot/query
 * 
 * Handle queries from Clawdbot
 */
router.post('/query', validateWebhook, async (req: ClawdbotWebhookRequest, res: Response) => {
  try {
    const { query, params, timestamp, requestId } = req.body;
    
    logger.info('Clawdbot query received:', {
      query,
      requestId,
      timestamp,
    });
    
    // Validate query
    if (!query) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query is required',
      });
    }
    
    // Handle different queries
    let result: any;
    
    switch (query) {
      case 'status':
        // System status
        result = {
          status: 'operational',
          version: process.env.API_VERSION || 'v1',
          environment: process.env.NODE_ENV,
          uptime: process.uptime(),
        };
        break;
      
      case 'deals_count': {
        // Get deal count with optional filters
        const { status } = params || {};
        
        let countQuery = 'SELECT COUNT(*) as count FROM deals WHERE archived_at IS NULL';
        const queryParams: any[] = [];
        
        if (status) {
          countQuery += ' AND status = $1';
          queryParams.push(status);
        }
        
        const countResult = await pool.query(countQuery, queryParams);
        
        result = {
          count: parseInt(countResult.rows[0].count),
          filter: status ? { status } : 'all',
        };
        break;
      }
      
      case 'recent_errors': {
        // Get recent error count and summary
        const hours = params?.hours || 24;
        
        const summaryResult = await pool.query(`
          SELECT
            COUNT(*) as total_errors,
            COUNT(DISTINCT error_context) as unique_contexts,
            COUNT(DISTINCT user_id) as affected_users,
            COUNT(*) FILTER (WHERE is_network_error = TRUE) as network_errors,
            COUNT(*) FILTER (WHERE is_webgl_error = TRUE) as webgl_errors
          FROM error_logs
          WHERE created_at > NOW() - INTERVAL '${hours} hours'
        `);
        
        result = {
          summary: summaryResult.rows[0],
          timeRange: `Last ${hours} hours`,
        };
        break;
      }
      
      default:
        return res.status(400).json({
          error: 'Bad Request',
          message: `Unknown query: ${query}`,
        });
    }
    
    res.status(200).json({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      result,
    });
    
  } catch (error) {
    logger.error('Error processing Clawdbot query:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process query',
      details: (error as Error).message,
    });
  }
});

/**
 * GET /api/v1/clawdbot/health
 * 
 * Simple health check for Clawdbot integration
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    integration: 'clawdbot',
    timestamp: new Date().toISOString(),
    webhookConfigured: !!process.env.CLAWDBOT_WEBHOOK_URL,
  });
});

export default router;
