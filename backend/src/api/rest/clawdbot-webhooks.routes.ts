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

function validateSignature(req: Request): boolean {
  const signature = req.headers['x-webhook-signature'] as string;
  const secret = process.env.CLAWDBOT_WEBHOOK_SECRET;

  if (!secret) return true;
  if (!signature) return false;

  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

function validateAuthToken(req: Request): boolean {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const expectedToken = process.env.CLAWDBOT_AUTH_TOKEN;
  if (!expectedToken) return true;
  if (!token) return false;
  return token === expectedToken;
}

function validateWebhook(req: Request, res: Response, next: Function): void {
  if (!validateSignature(req) && !validateAuthToken(req)) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid webhook signature or auth token' });
    return;
  }
  next();
}

router.post('/command', validateWebhook, async (req: ClawdbotWebhookRequest, res: Response) => {
  try {
    const { command, params, requestId } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Bad Request', message: 'Command is required' });
    }

    const pool = getPool();
    let result: any;

    switch (command) {
      case 'health': {
        result = {
          status: 'healthy',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'get_deals': {
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
        if (!params?.dealId && !params?.name) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Either dealId or name parameter is required',
          });
        }

        let dealResult;

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

          if (dealResult.rows.length > 1) {
            result = {
              multipleMatches: true,
              count: dealResult.rows.length,
              matches: dealResult.rows.map((d: any) => ({
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

          if (dealResult.rows.length === 0) {
            return res.status(404).json({
              error: 'Not Found',
              message: `No deals found matching "${params.name}"`,
            });
          }
        } else {
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

        const propertiesResult = await pool.query(`
          SELECT 
            dp.id,
            dp.property_id as "propertyId",
            p.address_line1 as address,
            p.city,
            p.state_code as state,
            p.zip as "zipCode",
            p.lat,
            p.lng
          FROM deal_properties dp
          LEFT JOIN properties p ON p.id = dp.property_id
          WHERE dp.deal_id = $1
          ORDER BY dp.created_at
        `, [deal.id]);

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

        const [strategyResult, modelResult] = await Promise.all([
          pool.query(
            `SELECT id, strategy_slug, risk_score, recommended, created_at FROM strategy_analyses WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [deal.id]
          ).catch(() => ({ rows: [] })),
          pool.query(
            `SELECT id, model_type, status, created_at FROM deal_financial_models WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [deal.id]
          ).catch(() => ({ rows: [] })),
        ]);

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
          strategy: strategyResult.rows[0] || null,
          financialModel: modelResult.rows[0] || null,
          propertyCount: deal.propertyCount,
          pendingTasks: deal.pendingTasks,
          taskCount: deal.taskCount,
        };
        break;
      }

      case 'search_deals': {
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
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        const analysisType = params.analysisType || 'full';

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

        const sysTasksResult = await pool.query(`
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
          tasks: sysTasksResult.rows[0],
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'recent_errors': {
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
        `, [limit]).catch(() => ({ rows: [], rowCount: 0 }));

        result = {
          errors: errorsResult.rows,
          total: errorsResult.rowCount,
          timeRange: `Last ${hours} hours`,
        };
        break;
      }

      case 'get_zoning_profile': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        const zoningResult = await pool.query(`
          SELECT 
            dzp.*,
            zd.district_name,
            zd.max_far as zd_max_far,
            zd.max_building_height_ft as zd_max_height_ft,
            zd.max_units_per_acre as zd_max_units_per_acre,
            zd.min_parking_per_unit as zd_min_parking_per_unit,
            zd.permitted_uses,
            zd.conditional_uses
          FROM deal_zoning_profiles dzp
          LEFT JOIN zoning_districts zd ON zd.zoning_code = dzp.base_district_code
          WHERE dzp.deal_id = $1
          ORDER BY dzp.created_at DESC
          LIMIT 1
        `, [params.dealId]).catch((err: any) => { logger.error('Zoning profile query error:', err.message); return { rows: [] }; });

        if (zoningResult.rows.length === 0) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'No zoning profile found for this deal. Create one first.',
          });
        }

        result = {
          zoningProfile: zoningResult.rows[0],
        };
        break;
      }

      case 'get_market_intelligence': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        const miResult = await pool.query(
          `SELECT module_outputs FROM deals WHERE id = $1`,
          [params.dealId]
        ).catch(() => ({ rows: [] }));

        const moduleOutputs = miResult.rows[0]?.module_outputs;
        if (!moduleOutputs || (!moduleOutputs.marketIntelligence && !moduleOutputs.market)) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'No market intelligence found for this deal. Run analysis first.',
          });
        }

        result = {
          marketIntelligence: moduleOutputs.marketIntelligence || moduleOutputs.market || null,
        };
        break;
      }

      case 'get_design': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        const designResult = await pool.query(
          `SELECT module_outputs FROM deals WHERE id = $1`,
          [params.dealId]
        ).catch(() => ({ rows: [] }));

        const designOutputs = designResult.rows[0]?.module_outputs;
        if (!designOutputs || !designOutputs.design3D) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'No 3D design found for this deal. Create one first.',
          });
        }

        result = {
          design: designOutputs.design3D,
        };
        break;
      }

      case 'get_proforma': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        const proformaResult = await pool.query(`
          SELECT id, deal_id, model_type, assumptions, results, status, created_at
          FROM deal_financial_models
          WHERE deal_id = $1 AND status = 'complete'
          ORDER BY created_at DESC
          LIMIT 1
        `, [params.dealId]).catch(() => ({ rows: [] }));

        if (proformaResult.rows.length === 0) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'No completed pro forma found for this deal. Build one first.',
          });
        }

        result = {
          proforma: proformaResult.rows[0],
        };
        break;
      }

      case 'get_capital_structure': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        const capResult = await pool.query(
          `SELECT module_outputs FROM deals WHERE id = $1`,
          [params.dealId]
        ).catch(() => ({ rows: [] }));

        const capOutputs = capResult.rows[0]?.module_outputs;
        if (!capOutputs || !capOutputs.capitalStructure) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'No capital structure found for this deal. Create one first.',
          });
        }

        result = {
          capitalStructure: capOutputs.capitalStructure,
        };
        break;
      }

      case 'update_deal': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        const allowedUpdates = ['budget', 'target_units', 'timeline_start', 'timeline_end', 'status', 'description'];
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        for (const field of allowedUpdates) {
          if (params[field] !== undefined) {
            updates.push(`${field} = $${paramIndex}`);
            values.push(params[field]);
            paramIndex++;
          }
        }

        if (updates.length === 0) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'No valid fields to update. Allowed: ' + allowedUpdates.join(', '),
          });
        }

        updates.push('updated_at = NOW()');
        values.push(params.dealId);

        const updateResult = await pool.query(`
          UPDATE deals
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `, values);

        if (updateResult.rows.length === 0) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Deal not found',
          });
        }

        result = {
          message: 'Deal updated successfully',
          deal: updateResult.rows[0],
        };
        break;
      }

      case 'update_property': {
        if (!params?.propertyId && !params?.dealId) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Either propertyId or dealId is required',
          });
        }

        let propertyId = params.propertyId;

        // If dealId provided, get the first property for that deal
        if (!propertyId && params.dealId) {
          const dealPropResult = await pool.query(`
            SELECT property_id FROM deal_properties WHERE deal_id = $1 LIMIT 1
          `, [params.dealId]);
          
          if (dealPropResult.rows.length === 0) {
            return res.status(404).json({
              error: 'Not Found',
              message: 'No property found for this deal',
            });
          }
          
          propertyId = dealPropResult.rows[0].property_id;
        }

        const allowedUpdates = [
          'parcel_id',
          'lot_size_acres',
          'land_cost',
          'year_built',
          'property_type',
          'lot_acres',
          'total_sf',
          'units',
          'stories',
        ];

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        for (const field of allowedUpdates) {
          if (params[field] !== undefined) {
            updates.push(`${field} = $${paramIndex}`);
            values.push(params[field]);
            paramIndex++;
          }
        }

        if (updates.length === 0) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'No valid fields to update. Allowed: ' + allowedUpdates.join(', '),
          });
        }

        updates.push('updated_at = NOW()');
        values.push(propertyId);

        const updateResult = await pool.query(`
          UPDATE properties
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `, values);

        if (updateResult.rows.length === 0) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Property not found',
          });
        }

        result = {
          message: 'Property updated successfully',
          property: updateResult.rows[0],
        };
        break;
      }

      default:
        return res.status(400).json({ error: 'Bad Request', message: `Unknown command: ${command}` });
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

router.post('/query', validateWebhook, async (req: ClawdbotWebhookRequest, res: Response) => {
  try {
    const { query, params, requestId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Bad Request', message: 'Query is required' });
    }

    const pool = getPool();
    let result: any;

    switch (query) {
      case 'status': {
        const dealCount = await pool.query(`SELECT count(*) as cnt FROM deals`).catch(() => ({ rows: [{ cnt: 0 }] }));
        const modelCount = await pool.query(`SELECT count(*) as cnt FROM deal_financial_models WHERE status = 'complete'`).catch(() => ({ rows: [{ cnt: 0 }] }));
        result = {
          status: 'operational',
          environment: process.env.NODE_ENV,
          uptime: process.uptime(),
          deals: parseInt(dealCount.rows[0].cnt),
          completedModels: parseInt(modelCount.rows[0].cnt),
        };
        break;
      }

      case 'deals_count': {
        const countResult = await pool.query(`SELECT status, count(*) as cnt FROM deals GROUP BY status`);
        const total = countResult.rows.reduce((sum: number, r: any) => sum + parseInt(r.cnt), 0);
        result = {
          total,
          byStatus: countResult.rows.reduce((acc: any, r: any) => { acc[r.status] = parseInt(r.cnt); return acc; }, {}),
        };
        break;
      }

      case 'recent_errors': {
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
        `).catch(() => ({ rows: [{ total_errors: 0, unique_contexts: 0, affected_users: 0, network_errors: 0, webgl_errors: 0 }] }));

        result = {
          summary: summaryResult.rows[0],
          timeRange: `Last ${hours} hours`,
        };
        break;
      }

      case 'deal_summary': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }
        const dealResult = await pool.query(
          `SELECT id, name, project_type, status, budget, target_units FROM deals WHERE id = $1`,
          [params.dealId]
        );
        if (dealResult.rows.length === 0) {
          return res.status(404).json({ error: 'Not Found', message: 'Deal not found' });
        }
        const summaryDeal = dealResult.rows[0];
        const model = await pool.query(
          `SELECT assumptions, results, status, created_at FROM deal_financial_models WHERE deal_id = $1 AND status = 'complete' ORDER BY created_at DESC LIMIT 1`,
          [params.dealId]
        ).catch(() => ({ rows: [] }));
        const modelRow = model.rows[0];
        const modelResults = modelRow ? (typeof modelRow.results === 'string' ? JSON.parse(modelRow.results) : modelRow.results) : null;
        const summary = modelResults?.summary || {};
        result = {
          deal: summaryDeal,
          hasModel: !!modelRow,
          metrics: modelRow ? {
            irr: summary.irr,
            equityMultiple: summary.equityMultiple,
            noiYear1: summary.noiYear1,
            exitValue: summary.exitValue,
            cashOnCash: summary.cashOnCash?.[0],
          } : null,
        };
        break;
      }

      default:
        return res.status(400).json({ error: 'Bad Request', message: `Unknown query: ${query}` });
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

router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    integration: 'clawdbot',
    timestamp: new Date().toISOString(),
    webhookConfigured: !!process.env.CLAWDBOT_WEBHOOK_URL,
    secretConfigured: !!process.env.CLAWDBOT_WEBHOOK_SECRET,
  });
});

export default router;
