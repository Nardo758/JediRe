import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { requireDealAccess } from '../../middleware/deal-access';
import { validateFormula, inferRollup, checkRollupAllowed } from '../../services/custom-metrics/formula-evaluator.service';
import { loadCustomMetricDefinitions, buildCustomMetricSeries } from '../../services/custom-metrics/derivation.service';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * POST /api/v1/custom-metrics
 * Create a new custom metric (user-level or deal-level).
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      scope,
      owner_id,
      name,
      metric_key,
      metric_type,
      formula_string,
      rollup,
      format,
      unit_basis_field,
    } = req.body;

    // Validation
    if (!scope || !['user', 'deal'].includes(scope)) {
      return res.status(400).json({ error: 'scope must be "user" or "deal"' });
    }
    if (!name || !metric_key || !metric_type) {
      return res.status(400).json({ error: 'name, metric_key, and metric_type are required' });
    }
    if (!['derived', 'input'].includes(metric_type)) {
      return res.status(400).json({ error: 'metric_type must be "derived" or "input"' });
    }

    // Validate formula for derived metrics
    let formula_ast: any = null;
    let isRatio = false;
    if (metric_type === 'derived' && formula_string) {
      const otherKeys = new Set<string>(); // Would load from DB in production
      const result = validateFormula(formula_string, metric_key, otherKeys);
      if (!result.valid) {
        return res.status(400).json({ error: `Invalid formula: ${result.error}` });
      }
      if (result.formula) {
        formula_ast = result.formula.ast;
        isRatio = result.formula.isRatio;
      }
    }

    // Infer rollup if not provided
    const finalRollup = rollup || (metric_type === 'derived' && formula_ast
      ? inferRollup({ ast: formula_ast, referencedFields: [], referencedMetrics: [], isRatio })
      : 'sum');

    // Check rollup allowed
    if (metric_type === 'derived' && formula_ast) {
      const check = checkRollupAllowed({ ast: formula_ast, referencedFields: [], referencedMetrics: [], isRatio }, finalRollup);
      if (!check.allowed) {
        return res.status(400).json({ error: check.error });
      }
    }

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO custom_metrics (
        scope, owner_id, name, metric_key, metric_type, formula_ast,
        rollup, format, unit_basis_field, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        scope,
        owner_id || req.user!.userId,
        name,
        metric_key,
        metric_type,
        formula_ast ? JSON.stringify(formula_ast) : null,
        finalRollup,
        format || 'currency',
        unit_basis_field || null,
        req.user!.userId,
      ]
    );

    return res.json({ success: true, metric_id: result.rows[0].id });
  } catch (error: any) {
    logger.error('Create custom metric error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/custom-metrics/:dealId
 * Get all custom metrics for a deal (user-level + deal-level).
 */
router.get('/:dealId', requireAuth, requireDealAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const pool = getPool();

    const definitions = await loadCustomMetricDefinitions(pool, dealId, req.user!.userId);

    return res.json({ success: true, metrics: definitions });
  } catch (error: any) {
    logger.error('Get custom metrics error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/custom-metrics/:dealId/values
 * Set input-type custom metric values (per-period data).
 */
router.post('/:dealId/values', requireAuth, requireDealAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { metric_id, values } = req.body; // values: Array<{ period_month, value, zone }>

    if (!metric_id || !Array.isArray(values)) {
      return res.status(400).json({ error: 'metric_id and values array are required' });
    }

    const pool = getPool();

    for (const v of values) {
      await pool.query(
        `INSERT INTO custom_metric_values (metric_id, deal_id, period_month, value, zone)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (metric_id, deal_id, period_month) DO UPDATE SET
           value = EXCLUDED.value,
           zone = EXCLUDED.zone,
           updated_at = NOW()`,
        [metric_id, dealId, v.period_month, v.value, v.zone || 'actual']
      );
    }

    return res.json({ success: true, inserted: values.length });
  } catch (error: any) {
    logger.error('Set custom metric values error:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
