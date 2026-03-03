import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getPool } from '../../database/connection';

const router = Router();

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
        const limit = params?.limit || 10;
        const status = params?.status || null;
        let query = `SELECT id, name, project_type, status, state, budget, target_units, created_at, updated_at FROM deals`;
        const queryParams: any[] = [];
        if (status) {
          query += ` WHERE status = $1`;
          queryParams.push(status);
        }
        query += ` ORDER BY updated_at DESC LIMIT $${queryParams.length + 1}`;
        queryParams.push(limit);
        const dealsResult = await pool.query(query, queryParams);
        result = {
          deals: dealsResult.rows,
          count: dealsResult.rows.length,
        };
        break;
      }

      case 'get_deal': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }
        const dealResult = await pool.query(
          `SELECT id, name, project_type, status, state, budget, target_units, address, description, created_at, updated_at
           FROM deals WHERE id = $1`,
          [params.dealId]
        );
        if (dealResult.rows.length === 0) {
          return res.status(404).json({ error: 'Not Found', message: 'Deal not found' });
        }
        const deal = dealResult.rows[0];

        const [strategyResult, modelResult] = await Promise.all([
          pool.query(
            `SELECT id, strategy_slug, risk_score, recommended, created_at FROM strategy_analyses WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [params.dealId]
          ).catch(() => ({ rows: [] })),
          pool.query(
            `SELECT id, model_type, status, created_at FROM deal_financial_models WHERE deal_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [params.dealId]
          ).catch(() => ({ rows: [] })),
        ]);

        result = {
          deal,
          strategy: strategyResult.rows[0] || null,
          financialModel: modelResult.rows[0] || null,
        };
        break;
      }

      case 'run_analysis': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }
        const dealCheck = await pool.query(`SELECT id, name FROM deals WHERE id = $1`, [params.dealId]);
        if (dealCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Not Found', message: 'Deal not found' });
        }
        result = {
          status: 'queued',
          dealId: params.dealId,
          dealName: dealCheck.rows[0].name,
          message: `Analysis queued for ${dealCheck.rows[0].name}`,
        };
        break;
      }

      default:
        return res.status(400).json({ error: 'Bad Request', message: `Unknown command: ${command}` });
    }

    res.status(200).json({ success: true, requestId, timestamp: new Date().toISOString(), result });
  } catch (error: any) {
    console.error('Error processing Clawdbot command:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process command' });
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
        const limit = params?.limit || 20;
        const errorsResult = await pool.query(
          `SELECT id, analysis_result, analyzed_at FROM deal_financial_model_analyses ORDER BY analyzed_at DESC LIMIT $1`,
          [limit]
        ).catch(() => ({ rows: [] }));
        result = {
          recentAnalyses: errorsResult.rows.length,
          note: 'Server error logs are forwarded via webhook notifications when CLAWDBOT_WEBHOOK_URL is set',
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
        const deal = dealResult.rows[0];
        const model = await pool.query(
          `SELECT assumptions, results, status, created_at FROM deal_financial_models WHERE deal_id = $1 AND status = 'complete' ORDER BY created_at DESC LIMIT 1`,
          [params.dealId]
        ).catch(() => ({ rows: [] }));
        const modelRow = model.rows[0];
        const modelResults = modelRow ? (typeof modelRow.results === 'string' ? JSON.parse(modelRow.results) : modelRow.results) : null;
        const summary = modelResults?.summary || {};
        result = {
          deal,
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

    res.status(200).json({ success: true, requestId, timestamp: new Date().toISOString(), result });
  } catch (error: any) {
    console.error('Error processing Clawdbot query:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process query' });
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
