import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../../utils/logger';
import { getPool } from '../../database/connection';
import { RentScraperService } from '../../services/rent-scraper.service';
import { RentScraperDiscoveryService } from '../../services/rent-scraper-discovery.service';
import { RentScraperAggregationService } from '../../services/rent-scraper-aggregation.service';

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
          'zoning_code',
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

      case 'search_comps': {
        let city = params?.city;
        let state = params?.state;
        let lat: number | null = params?.lat != null ? parseFloat(params.lat) : null;
        let lng: number | null = params?.lng != null ? parseFloat(params.lng) : null;

        if (params?.dealId) {
          const dealCtx = await pool.query(
            `SELECT d.city, d.state_code, d.project_type,
                    p.lat, p.lng
             FROM deals d
             LEFT JOIN deal_properties dp ON dp.deal_id = d.id
             LEFT JOIN properties p ON p.id = dp.property_id
             WHERE d.id = $1`,
            [params.dealId]
          );
          if (dealCtx.rows.length > 0) {
            const ctx = dealCtx.rows[0];
            city = city || ctx.city;
            state = state || ctx.state_code;
            if (lat == null && ctx.lat != null) lat = parseFloat(ctx.lat);
            if (lng == null && ctx.lng != null) lng = parseFloat(ctx.lng);
          }
        }

        const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

        if (!city && !hasCoords) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Provide city/state, lat/lng, or dealId to search comps',
          });
        }

        if (city && !state) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'state is required when searching by city',
          });
        }

        const radiusMiles = parseFloat(params?.radiusMiles) || 10;
        const minUnits = parseInt(params?.minUnits) || 0;
        const maxUnits = parseInt(params?.maxUnits) || 999999;
        const minYearBuilt = parseInt(params?.minYearBuilt) || 1900;
        const maxYearBuilt = parseInt(params?.maxYearBuilt) || 2100;
        const compLimit = Math.min(parseInt(params?.limit) || 10, 25);

        let compQuery: string;
        const compValues: any[] = [];
        let paramIdx = 1;

        if (hasCoords) {
          compQuery = `
            SELECT * FROM (
              SELECT property_id, name, city, state, property_type, total_units,
                     year_built, t12_avg_rent, t12_avg_occupancy,
                     ROUND((3959 * acos(LEAST(1.0, GREATEST(-1.0,
                       cos(radians($${paramIdx})) * cos(radians(latitude))
                       * cos(radians(longitude) - radians($${paramIdx + 1}))
                       + sin(radians($${paramIdx})) * sin(radians(latitude))
                     ))))::numeric, 2) AS distance_miles
              FROM v_comp_search
              WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                AND total_units BETWEEN $${paramIdx + 2} AND $${paramIdx + 3}
                AND (year_built IS NULL OR year_built BETWEEN $${paramIdx + 4} AND $${paramIdx + 5})
            ) sub
            WHERE distance_miles <= $${paramIdx + 6}
            ORDER BY distance_miles ASC
            LIMIT $${paramIdx + 7}`;
          compValues.push(lat, lng, minUnits, maxUnits, minYearBuilt, maxYearBuilt, radiusMiles, compLimit);
        } else {
          compQuery = `
            SELECT property_id, name, city, state, property_type, total_units,
                   year_built, t12_avg_rent, t12_avg_occupancy
            FROM v_comp_search
            WHERE LOWER(city) = LOWER($${paramIdx})
              AND LOWER(state) = LOWER($${paramIdx + 1})
              AND total_units BETWEEN $${paramIdx + 2} AND $${paramIdx + 3}
              AND (year_built IS NULL OR year_built BETWEEN $${paramIdx + 4} AND $${paramIdx + 5})
            ORDER BY total_units DESC
            LIMIT $${paramIdx + 6}`;
          compValues.push(city, state || '', minUnits, maxUnits, minYearBuilt, maxYearBuilt, compLimit);
        }

        const compResults = await pool.query(compQuery, compValues);

        result = {
          message: `Found ${compResults.rows.length} comparable properties`,
          searchCriteria: { city, state, lat, lng, radiusMiles, minUnits, maxUnits, minYearBuilt, maxYearBuilt },
          comps: compResults.rows.map((r: any) => ({
            propertyId: r.property_id,
            name: r.name,
            city: r.city,
            state: r.state,
            propertyType: r.property_type,
            units: r.total_units,
            yearBuilt: r.year_built,
            avgRent: r.t12_avg_rent ? parseFloat(r.t12_avg_rent) : null,
            occupancy: r.t12_avg_occupancy ? parseFloat(r.t12_avg_occupancy) : null,
            distanceMiles: r.distance_miles ? parseFloat(r.distance_miles) : null,
          })),
        };
        break;
      }

      case 'get_sale_comps': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        const saleComps = await pool.query(
          `SELECT id, comp_name, comp_property_address, source, status,
                  distance_miles, match_score, year_built, stories, units,
                  class_code, avg_rent, occupancy, google_rating,
                  google_review_count, notes, created_at
           FROM deal_comp_sets
           WHERE deal_id = $1 AND status = 'active'
           ORDER BY match_score DESC NULLS LAST, distance_miles ASC NULLS LAST`,
          [params.dealId]
        );

        result = {
          message: `Found ${saleComps.rows.length} comps for deal`,
          dealId: params.dealId,
          comps: saleComps.rows.map((r: any) => ({
            id: r.id,
            name: r.comp_name,
            address: r.comp_property_address,
            source: r.source,
            distanceMiles: r.distance_miles ? parseFloat(r.distance_miles) : null,
            matchScore: r.match_score ? parseFloat(r.match_score) : null,
            yearBuilt: r.year_built,
            stories: r.stories,
            units: r.units,
            classCode: r.class_code,
            avgRent: r.avg_rent ? parseFloat(r.avg_rent) : null,
            occupancy: r.occupancy ? parseFloat(r.occupancy) : null,
            googleRating: r.google_rating ? parseFloat(r.google_rating) : null,
            reviewCount: r.google_review_count,
            notes: r.notes,
          })),
        };
        break;
      }

      case 'list_documents': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        let docQuery = `
          SELECT id, file_name, file_type, file_url, file_size,
                 uploaded_at, metadata
          FROM deal_documents
          WHERE deal_id = $1`;
        const docValues: any[] = [params.dealId];

        if (params.category) {
          docQuery += ` AND metadata->>'category' = $2`;
          docValues.push(params.category);
        }

        docQuery += ` ORDER BY uploaded_at DESC`;
        const docLimit = Math.min(parseInt(params?.limit) || 50, 100);
        docValues.push(docLimit);
        docQuery += ` LIMIT $${docValues.length}`;

        const docs = await pool.query(docQuery, docValues);

        result = {
          message: `Found ${docs.rows.length} document(s)`,
          dealId: params.dealId,
          documents: docs.rows.map((r: any) => ({
            id: r.id,
            fileName: r.file_name,
            fileType: r.file_type,
            fileSize: r.file_size,
            uploadedAt: r.uploaded_at,
            category: r.metadata?.category || null,
            tags: r.metadata?.tags || [],
          })),
        };
        break;
      }

      case 'get_document_stats': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        const statsResult = await pool.query(`
          SELECT
            COUNT(*) as total_documents,
            COALESCE(SUM(file_size), 0) as total_bytes,
            COUNT(DISTINCT file_type) as file_type_count
          FROM deal_documents
          WHERE deal_id = $1
        `, [params.dealId]);

        const byCategoryResult = await pool.query(`
          SELECT
            COALESCE(metadata->>'category', 'uncategorized') as category,
            COUNT(*) as doc_count,
            COALESCE(SUM(file_size), 0) as total_bytes
          FROM deal_documents
          WHERE deal_id = $1
          GROUP BY metadata->>'category'
          ORDER BY doc_count DESC
        `, [params.dealId]);

        const dealStage = await pool.query(
          `SELECT status, project_type FROM deals WHERE id = $1`,
          [params.dealId]
        );

        const stage = dealStage.rows[0]?.status || 'unknown';
        const existingCategories = byCategoryResult.rows.map((r: any) => r.category);

        const suggestedDocs: string[] = [];
        const commonDocs = ['Offering Memorandum', 'T-12 Financials', 'Rent Roll', 'Site Plan'];
        const advancedDocs = ['Appraisal Report', 'Phase I Environmental', 'Title Report', 'Survey'];

        for (const doc of commonDocs) {
          if (!existingCategories.includes(doc.toLowerCase().replace(/\s+/g, '-'))) {
            suggestedDocs.push(doc);
          }
        }
        if (['underwriting', 'due_diligence', 'closing'].includes(stage)) {
          for (const doc of advancedDocs) {
            if (!existingCategories.includes(doc.toLowerCase().replace(/\s+/g, '-'))) {
              suggestedDocs.push(doc);
            }
          }
        }

        const stats = statsResult.rows[0];
        result = {
          message: 'Document statistics',
          dealId: params.dealId,
          dealStage: stage,
          totals: {
            documents: parseInt(stats.total_documents),
            totalSizeMB: Math.round(parseInt(stats.total_bytes) / 1048576 * 100) / 100,
            fileTypes: parseInt(stats.file_type_count),
          },
          byCategory: byCategoryResult.rows.map((r: any) => ({
            category: r.category,
            count: parseInt(r.doc_count),
            sizeMB: Math.round(parseInt(r.total_bytes) / 1048576 * 100) / 100,
          })),
          suggestedMissing: suggestedDocs,
        };
        break;
      }

      case 'get_notes': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        let notesQuery = `
          SELECT id, title, content, author_name, category, tags,
                 pinned, created_at, updated_at
          FROM deal_notes
          WHERE deal_id = $1 AND deleted_at IS NULL`;
        const notesValues: any[] = [params.dealId];

        if (params.category) {
          notesQuery += ` AND category = $2`;
          notesValues.push(params.category);
        }

        notesQuery += ` ORDER BY pinned DESC, created_at DESC`;
        const notesLimit = Math.min(parseInt(params?.limit) || 20, 50);
        notesValues.push(notesLimit);
        notesQuery += ` LIMIT $${notesValues.length}`;

        const notes = await pool.query(notesQuery, notesValues);

        result = {
          message: `Found ${notes.rows.length} note(s)`,
          dealId: params.dealId,
          notes: notes.rows.map((r: any) => ({
            id: r.id,
            title: r.title,
            content: r.content && r.content.length > 500 ? r.content.substring(0, 500) + '...' : r.content,
            author: r.author_name,
            category: r.category,
            tags: r.tags,
            pinned: r.pinned,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })),
        };
        break;
      }

      case 'add_note': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }
        if (!params?.content) {
          return res.status(400).json({ error: 'Bad Request', message: 'content parameter is required' });
        }

        const CLAWDBOT_UUID = '00000000-0000-0000-0000-000000000001';

        const newNote = await pool.query(
          `INSERT INTO deal_notes (deal_id, author_id, author_name, title, content, category, tags)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, title, content, author_name, category, tags, pinned, created_at`,
          [
            params.dealId,
            CLAWDBOT_UUID,
            'Clawdbot',
            params.title || null,
            params.content,
            params.category || 'general',
            params.tags || null,
          ]
        );

        const note = newNote.rows[0];
        result = {
          message: 'Note created successfully',
          dealId: params.dealId,
          note: {
            id: note.id,
            title: note.title,
            content: note.content,
            author: note.author_name,
            category: note.category,
            tags: note.tags,
            pinned: note.pinned,
            createdAt: note.created_at,
          },
        };
        break;
      }

      case 'scrape_property': {
        if (!params?.targetId) {
          return res.status(400).json({ error: 'Bad Request', message: 'targetId parameter is required' });
        }
        const rentScraper = new RentScraperService(pool);
        const scrapeResult = await rentScraper.scrapeProperty(params.targetId);

        let compBackflow: any = null;
        if (scrapeResult.status === 'success' && scrapeResult.units.length > 0) {
          const aggregation = new RentScraperAggregationService(pool);
          compBackflow = await aggregation.pushToCompUnitTypes(params.targetId, scrapeResult.jobId);
        }

        result = {
          message: scrapeResult.status === 'success'
            ? `Scraped ${scrapeResult.units.length} floor plans from ${scrapeResult.propertyName}${scrapeResult.floorPlanUrl ? ` (${scrapeResult.floorPlanUrl})` : ''}`
            : scrapeResult.status === 'no_website'
            ? `${scrapeResult.propertyName}: no website_url — run discover_property_urls first`
            : `Scrape failed for ${scrapeResult.propertyName}: ${scrapeResult.error}`,
          ...scrapeResult,
          compBackflow,
        };
        break;
      }

      case 'run_scrape_job': {
        const market = params?.market || 'Atlanta';
        const limit = Math.min(params?.limit || 10, 50);

        if (params?.discoverFirst) {
          const discovery = new RentScraperDiscoveryService(pool);
          await discovery.discoverAllPendingUrls({ limit: Math.min(limit * 2, 50) });
        }

        const rentScraper = new RentScraperService(pool);
        const jobResult = await rentScraper.runScrapeJob({ market, limit, onlyWithWebsite: true });

        const succeeded = jobResult.results.filter(r => r.status === 'success').length;
        const failed = jobResult.results.filter(r => r.status === 'error').length;
        const noWebsite = jobResult.results.filter(r => r.status === 'no_website').length;

        let marketSnapshot: any = null;
        if (succeeded > 0) {
          const aggregation = new RentScraperAggregationService(pool);
          for (const r of jobResult.results) {
            if (r.status === 'success') {
              try { await aggregation.pushToCompUnitTypes(r.targetId); } catch (e: any) {
                logger.warn(`[run_scrape_job] comp backflow failed for target ${r.targetId}: ${e.message}`);
              }
            }
          }
          marketSnapshot = await aggregation.pushToApartmentMarketSnapshots(market);
        }

        result = {
          message: `Scrape job complete: ${succeeded} succeeded, ${failed} failed, ${noWebsite} skipped (no website) out of ${jobResult.jobCount} targets`,
          jobCount: jobResult.jobCount,
          succeeded,
          failed,
          noWebsite,
          marketSnapshot,
          results: jobResult.results.map(r => ({
            targetId: r.targetId,
            propertyName: r.propertyName,
            status: r.status,
            unitCount: r.units.length,
            floorPlanUrl: r.floorPlanUrl,
            error: r.error || null,
          })),
        };
        break;
      }

      case 'get_rent_changes': {
        const rentScraper = new RentScraperService(pool);
        const changes = await rentScraper.getRentChanges({
          targetId: params?.targetId,
          market: params?.market || 'Atlanta',
          daysBack: params?.daysBack || 30,
          minChangePercent: params?.minChangePercent || 0,
        });
        result = {
          message: `Found ${changes.length} rent changes`,
          changes,
        };
        break;
      }

      case 'get_scrape_summary': {
        const aggregation = new RentScraperAggregationService(pool);
        const summary = await aggregation.getScrapeSummary(params?.market || 'Atlanta');
        result = {
          message: `Scrape summary for ${params?.market || 'Atlanta'}`,
          summary,
        };
        break;
      }

      case 'add_scrape_target': {
        if (!params?.propertyName) {
          return res.status(400).json({ error: 'Bad Request', message: 'propertyName parameter is required' });
        }
        const rentScraper = new RentScraperService(pool);
        const newTarget = await rentScraper.addScrapeTarget({
          propertyName: params.propertyName,
          address: params.address,
          city: params.city,
          state: params.state,
          zip: params.zip,
          url: params.url,
          websiteUrl: params.websiteUrl,
          unitCount: params.unitCount,
          yearBuilt: params.yearBuilt,
          market: params.market,
          submarket: params.submarket,
          latitude: params.latitude,
          longitude: params.longitude,
        });
        result = {
          message: `Added scrape target: ${params.propertyName}`,
          target: newTarget,
        };
        break;
      }

      case 'list_scrape_targets': {
        const rentScraper = new RentScraperService(pool);
        const targets = await rentScraper.listScrapeTargets({
          market: params?.market,
          active: params?.active !== undefined ? params.active : true,
          limit: params?.limit || 50,
          offset: params?.offset || 0,
        });
        result = {
          message: `Found ${targets.total} scrape targets`,
          ...targets,
        };
        break;
      }

      case 'discover_property_urls': {
        const limit = Math.min(params?.limit || 50, 200);
        const market = params?.market || 'Atlanta';
        const source = params?.source || undefined;

        const pendingConditions = ['places_search_done = FALSE', 'website_url IS NULL', 'active = TRUE'];
        const pendingParams: any[] = [];
        let pIdx = 1;
        if (source) { pendingConditions.push(`source = $${pIdx}`); pendingParams.push(source); pIdx++; }
        if (market) { pendingConditions.push(`(city ILIKE $${pIdx} OR market ILIKE $${pIdx})`); pendingParams.push(market); pIdx++; }
        const pendingCount = await pool.query(
          `SELECT COUNT(*) as cnt FROM rent_scrape_targets WHERE ${pendingConditions.join(' AND ')}`,
          pendingParams
        );

        const discoveryService = new RentScraperDiscoveryService(pool);
        const discoveryResult = await discoveryService.discoverAllPendingUrls({
          limit,
          source,
          market,
        });

        const sampleUrls = discoveryResult.results
          .filter(r => r.websiteUrl)
          .slice(0, 5)
          .map(r => ({ name: r.propertyName, url: r.websiteUrl }));

        result = {
          message: `URL discovery complete: ${discoveryResult.discovered} found, ${discoveryResult.failed} failed`,
          market,
          source: source || 'all',
          limit,
          totalPending: parseInt(pendingCount.rows[0].cnt),
          discovered: discoveryResult.discovered,
          failed: discoveryResult.failed,
          skipped: discoveryResult.skipped,
          processed: discoveryResult.results.length,
          sampleUrls,
        };
        break;
      }

      case 'sync_property_records_to_targets': {
        const market = params?.market || 'Atlanta';
        const syncResult = await pool.query(
          `SELECT * FROM sync_property_records_to_targets($1)`,
          [market]
        );
        const row = syncResult.rows[0] || { inserted_count: 0, skipped_count: 0, total_records: 0 };
        result = {
          message: `Synced property_records to rent_scrape_targets for ${market}: ${row.inserted_count} inserted, ${row.skipped_count} skipped`,
          market,
          inserted: parseInt(row.inserted_count),
          skipped: parseInt(row.skipped_count),
          totalRecords: parseInt(row.total_records),
        };
        break;
      }

      case 'sync_comp_to_targets': {
        const market = params?.market || 'Atlanta';
        const validSources = ['comp_properties', 'properties', 'both'];
        const source = validSources.includes(params?.source) ? params.source : 'both';

        interface SyncRow { inserted_count: string; skipped_count: string; total_comps?: string; total_props?: string }
        const synced: Record<string, SyncRow> = {};

        if (source === 'comp_properties' || source === 'both') {
          const compResult = await pool.query<SyncRow>(
            `SELECT * FROM sync_comp_to_targets($1)`,
            [market]
          );
          synced.comp_properties = compResult.rows[0];
        }

        if (source === 'properties' || source === 'both') {
          const propResult = await pool.query<SyncRow>(
            `SELECT * FROM sync_properties_to_targets($1)`,
            [market]
          );
          synced.properties = propResult.rows[0];
        }

        const totalInserted = Object.values(synced).reduce(
          (sum: number, r: SyncRow) => sum + (parseInt(r.inserted_count) || 0), 0
        );

        result = {
          message: `Sync complete for ${market}: ${totalInserted} new targets added`,
          market,
          source,
          synced,
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
