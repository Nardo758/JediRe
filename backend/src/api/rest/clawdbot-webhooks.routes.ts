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
            CONCAT_WS(', ', p.address_line1, p.address_line2) as address,
            p.city,
            p.state_code as state,
            p.zip_code as "zipCode"
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
        if (!params?.dealId && !params?.inputData) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId or inputData parameter is required' });
        }

        const analysisType = params.analysisType || 'full';
        const typeMap: Record<string, string> = {
          zoning: 'zoning_analysis',
          supply: 'supply_analysis',
          cashflow: 'cashflow_analysis',
        };

        let dealName = 'direct-analysis';
        let dealData: any = null;

        if (params.dealId) {
          const dealCheck = await pool.query(
            `SELECT id, name, COALESCE(property_address, address) as address,
                    city, state_code, lot_size_sqft,
                    project_type, budget, target_units, property_data
             FROM deals WHERE id = $1 AND archived_at IS NULL`,
            [params.dealId]
          );

          if (dealCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Deal not found' });
          }

          dealData = dealCheck.rows[0];
          dealName = dealData.name;

          if (!dealData.city || !dealData.state_code) {
            const addrParts = (dealData.address || '').split(',').map((p: string) => p.trim()).filter(Boolean);
            const stateNames: Record<string, string> = {
              'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
              'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
              'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
              'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
              'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
              'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
              'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
              'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
              'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
              'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
            };
            for (let i = addrParts.length - 1; i >= 1; i--) {
              const part = addrParts[i];
              const stateZipMatch = part.match(/^([A-Za-z\s]+?)\s*(\d{5})?$/);
              if (!stateZipMatch) continue;
              const rawState = stateZipMatch[1].trim();
              const code = rawState.length === 2 ? rawState.toUpperCase() : stateNames[rawState.toLowerCase()];
              if (code && code.length === 2) {
                dealData.state_code = dealData.state_code || code;
                dealData.city = dealData.city || addrParts[i - 1] || '';
                break;
              }
            }
          }

          if (!dealData.lot_size_sqft) {
            const propData = dealData.property_data || {};
            const lotAcres = parseFloat(propData.lot_size_acres);
            dealData.lot_size_sqft = !isNaN(lotAcres) ? Math.round(lotAcres * 43560) : (parseInt(propData.total_sqft) || 50000);
          }
        }

        const taskTypes = analysisType === 'full'
          ? ['zoning_analysis', 'supply_analysis', 'cashflow_analysis']
          : [typeMap[analysisType] || analysisType];

        const validTypes = ['zoning_analysis', 'supply_analysis', 'cashflow_analysis'];
        const invalidType = taskTypes.find(t => !validTypes.includes(t));
        if (invalidType) {
          return res.status(400).json({
            error: 'Bad Request',
            message: `Unknown analysis type: ${analysisType}. Valid types: zoning, supply, cashflow, full`,
          });
        }

        const submittedTasks: any[] = [];

        for (const taskType of taskTypes) {
          let inputData: any;

          if (params.inputData) {
            inputData = params.inputData;
          } else if (dealData) {
            switch (taskType) {
              case 'zoning_analysis':
                inputData = {
                  address: dealData.address,
                  city: dealData.city,
                  stateCode: dealData.state_code,
                  lotSizeSqft: dealData.lot_size_sqft,
                };
                break;
              case 'supply_analysis':
                inputData = {
                  city: dealData.city || 'Atlanta',
                  stateCode: dealData.state_code || 'GA',
                  propertyType: dealData.project_type || 'multifamily',
                };
                break;
              case 'cashflow_analysis':
                inputData = {
                  purchasePrice: parseFloat(dealData.budget) || 0,
                  monthlyRent: dealData.target_units ? (parseFloat(dealData.budget) * 0.005) : 2500,
                  downPaymentPercent: 25,
                  interestRate: 7.5,
                  targetUnits: dealData.target_units || 1,
                };
                break;
              default:
                inputData = {};
            }
          } else {
            inputData = {};
          }

          const taskResult = await pool.query(
            `INSERT INTO agent_tasks (task_type, input_data, user_id, priority, status)
             VALUES ($1, $2, 'clawdbot', 1, 'pending')
             RETURNING id, task_type, status, created_at`,
            [taskType, JSON.stringify(inputData)]
          );
          submittedTasks.push(taskResult.rows[0]);
        }

        logger.info('Analysis submitted via Clawdbot:', {
          dealId: params.dealId,
          dealName,
          analysisType,
          taskIds: submittedTasks.map((t: any) => t.id),
        });

        result = {
          message: `${submittedTasks.length} analysis task(s) submitted successfully`,
          dealId: params.dealId,
          dealName,
          analysisType,
          tasks: submittedTasks.map((t: any) => ({
            taskId: t.id,
            taskType: t.task_type,
            status: t.status,
          })),
          note: 'Use get_agent_task command with taskId to poll for results.',
        };
        break;
      }

      case 'get_agent_task': {
        if (!params?.taskId) {
          return res.status(400).json({ error: 'Bad Request', message: 'taskId parameter is required' });
        }

        const agentTaskResult = await pool.query(
          `SELECT id, task_type, status, input_data, output_data,
                  priority, retry_count, max_retries, error_message,
                  execution_time_ms, progress, created_at, started_at, completed_at
           FROM agent_tasks WHERE id = $1`,
          [params.taskId]
        );

        if (agentTaskResult.rows.length === 0) {
          return res.status(404).json({ error: 'Not Found', message: 'Agent task not found' });
        }

        const agentTask = agentTaskResult.rows[0];
        const taskData = {
          taskId: agentTask.id,
          taskType: agentTask.task_type,
          status: agentTask.status,
          inputData: agentTask.input_data,
          outputData: agentTask.output_data,
          priority: agentTask.priority,
          retryCount: agentTask.retry_count,
          maxRetries: agentTask.max_retries,
          errorMessage: agentTask.error_message,
          executionTimeMs: agentTask.execution_time_ms,
          progress: agentTask.progress,
          createdAt: agentTask.created_at,
          startedAt: agentTask.started_at,
          completedAt: agentTask.completed_at,
        };
        result = { task: taskData, ...taskData };
        break;
      }

      case 'get_agent_tasks': {
        const atLimit = Math.min(params?.limit || 20, 100);
        const atOffset = params?.offset || 0;
        const statusFilter = params?.status;
        const typeFilter = params?.taskType;

        let atQuery = `SELECT id, task_type, status, priority, retry_count,
                              execution_time_ms, progress, error_message,
                              created_at, started_at, completed_at
                       FROM agent_tasks WHERE 1=1`;
        const atParams: any[] = [];
        let paramIdx = 1;

        if (statusFilter) {
          atQuery += ` AND status = $${paramIdx++}`;
          atParams.push(statusFilter);
        }
        if (typeFilter) {
          atQuery += ` AND task_type = $${paramIdx++}`;
          atParams.push(typeFilter);
        }

        atQuery += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
        atParams.push(atLimit, atOffset);

        const agentTasksResult = await pool.query(atQuery, atParams);

        let countSql = 'SELECT COUNT(*) FROM agent_tasks WHERE 1=1';
        const countParams: any[] = [];
        let countIdx = 1;
        if (statusFilter) {
          countSql += ` AND status = $${countIdx++}`;
          countParams.push(statusFilter);
        }
        if (typeFilter) {
          countSql += ` AND task_type = $${countIdx++}`;
          countParams.push(typeFilter);
        }
        const countQuery = await pool.query(countSql, countParams);

        result = {
          tasks: agentTasksResult.rows.map((t: any) => ({
            taskId: t.id,
            taskType: t.task_type,
            status: t.status,
            priority: t.priority,
            retryCount: t.retry_count,
            executionTimeMs: t.execution_time_ms,
            progress: t.progress,
            errorMessage: t.error_message,
            createdAt: t.created_at,
            startedAt: t.started_at,
            completedAt: t.completed_at,
          })),
          total: parseInt(countQuery.rows[0].count),
          limit: atLimit,
          offset: atOffset,
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

        const agentTasksStats = await pool.query(`
          SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'processing') as processing,
            COUNT(*) FILTER (WHERE status = 'completed') as completed,
            COUNT(*) FILTER (WHERE status = 'failed') as failed
          FROM agent_tasks
        `);

        result = {
          deals: statsResult.rows[0],
          tasks: sysTasksResult.rows[0],
          agentTasks: agentTasksStats.rows[0],
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

      case 'agent_stats': {
        const byStatusResult = await pool.query(`
          SELECT status, COUNT(*)::int as count
          FROM agent_tasks GROUP BY status ORDER BY count DESC
        `).catch(() => ({ rows: [] }));

        const byTypeResult = await pool.query(`
          SELECT task_type,
                 COUNT(*)::int as total,
                 COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
                 COUNT(*) FILTER (WHERE status = 'failed')::int as failed,
                 ROUND(AVG(execution_time_ms) FILTER (WHERE status = 'completed'))::int as avg_execution_ms
          FROM agent_tasks GROUP BY task_type ORDER BY total DESC
        `).catch(() => ({ rows: [] }));

        const recentResult = await pool.query(`
          SELECT id, task_type, status, execution_time_ms, error_message, created_at, completed_at
          FROM agent_tasks ORDER BY created_at DESC LIMIT 10
        `).catch(() => ({ rows: [] }));

        result = {
          byStatus: byStatusResult.rows.reduce((acc: any, r: any) => { acc[r.status] = r.count; return acc; }, {}),
          byType: byTypeResult.rows.map((r: any) => ({
            taskType: r.task_type,
            total: r.total,
            completed: r.completed,
            failed: r.failed,
            avgExecutionMs: r.avg_execution_ms,
          })),
          recentTasks: recentResult.rows.map((t: any) => ({
            taskId: t.id,
            taskType: t.task_type,
            status: t.status,
            executionTimeMs: t.execution_time_ms,
            errorMessage: t.error_message,
            createdAt: t.created_at,
            completedAt: t.completed_at,
          })),
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
