import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { requireDealAccess } from '../../middleware/deal-access';
import {
  validateFormula,
  inferRollup,
  checkRollupAllowed,
  detectCycles,
} from '../../services/custom-metrics/formula-evaluator.service';
import {
  loadCustomMetricDefinitions,
  buildCustomMetricSeries,
} from '../../services/custom-metrics/derivation.service';
import type { ASTNode } from '../../services/custom-metrics/formula-evaluator.service';
import { logger } from '../../utils/logger';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Collect field names from a stored formula_ast JSONB (already-validated AST). */
function collectMetricRefs(node: ASTNode, knownMetricKeys: Set<string>): string[] {
  const refs: string[] = [];
  function walk(n: ASTNode) {
    switch (n.type) {
      case 'field':
        if (knownMetricKeys.has(n.name)) refs.push(n.name);
        break;
      case 'function':
        n.args.forEach(walk);
        break;
      case 'binary':
        walk(n.left);
        walk(n.right);
        break;
      case 'unary':
        walk(n.operand);
        break;
    }
  }
  walk(node);
  return [...new Set(refs)];
}

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

    if (!scope || !['user', 'deal'].includes(scope)) {
      return res.status(400).json({ error: 'scope must be "user" or "deal"' });
    }
    if (!name || !metric_key || !metric_type) {
      return res.status(400).json({ error: 'name, metric_key, and metric_type are required' });
    }
    if (!['derived', 'input'].includes(metric_type)) {
      return res.status(400).json({ error: 'metric_type must be "derived" or "input"' });
    }

    const pool = getPool();

    // ── Load existing metrics for this owner BEFORE validation ─────────────────
    // Required for: (a) treating other custom metric keys as valid identifiers,
    //               (b) building the full dependency graph for cycle detection.
    //
    // Without this, the route used new Set<string>() — meaning:
    //   • Any formula referencing another custom metric key was rejected as
    //     "Unknown identifier" before cycle detection could ever run.
    //   • Cycles between existing and new metrics were invisible to detectCycles.
    const ownerId = owner_id || req.user!.userId;
    const existingRows = await pool.query<{ metric_key: string; formula_ast: ASTNode | null }>(
      `SELECT metric_key, formula_ast
         FROM custom_metrics
        WHERE (scope = 'user'  AND owner_id = $1)
           OR (scope = 'deal'  AND owner_id = $2)`,
      [req.user!.userId, ownerId]
    );

    const otherKeys = new Set(existingRows.rows.map(r => r.metric_key));

    // Build the dependency graph for existing metrics (needed for full cycle check).
    // existingGraph[key] = list of other custom metric keys the formula references.
    const existingGraph: Record<string, string[]> = {};
    for (const r of existingRows.rows) {
      existingGraph[r.metric_key] = r.formula_ast
        ? collectMetricRefs(r.formula_ast, otherKeys)
        : [];
    }

    // ── Validate formula ───────────────────────────────────────────────────────
    let formula_ast: ASTNode | null = null;
    let isRatio = false;
    let referencedMetrics: string[] = [];

    if (metric_type === 'derived' && formula_string) {
      const result = validateFormula(formula_string, metric_key, otherKeys);
      if (!result.valid) {
        return res.status(400).json({ error: `Invalid formula: ${result.error}` });
      }
      if (result.formula) {
        formula_ast = result.formula.ast;
        isRatio = result.formula.isRatio;
        referencedMetrics = result.formula.referencedMetrics;
      }

      // ── Full cycle detection with existing + new metric ──────────────────────
      // validateFormula only checks the local graph built from otherMetricKeys
      // with empty dependency arrays, missing the dependency chains already
      // stored in the DB. Re-run detectCycles with the complete graph here.
      if (referencedMetrics.length > 0) {
        const fullGraph: Record<string, string[]> = {
          ...existingGraph,
          [metric_key]: referencedMetrics,
        };
        const cycleResult = detectCycles(fullGraph);
        if (!cycleResult.valid) {
          return res.status(400).json({
            error: `Cycle detected: ${cycleResult.cycle?.join(' → ')}`,
          });
        }
      }
    }

    // ── Infer and validate rollup ──────────────────────────────────────────────
    const finalRollup = rollup || (metric_type === 'derived' && formula_ast
      ? inferRollup({ ast: formula_ast, referencedFields: [], referencedMetrics, isRatio })
      : 'sum');

    if (metric_type === 'derived' && formula_ast) {
      const check = checkRollupAllowed(
        { ast: formula_ast, referencedFields: [], referencedMetrics, isRatio },
        finalRollup
      );
      if (!check.allowed) {
        return res.status(400).json({ error: check.error });
      }
    }

    // ── Persist ────────────────────────────────────────────────────────────────
    const result = await pool.query(
      `INSERT INTO custom_metrics (
        scope, owner_id, name, metric_key, metric_type, formula_ast,
        rollup, format, unit_basis_field, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        scope,
        ownerId,
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
 * Get all custom metrics for a deal.
 * ?includeSeries=true  — also compute the monthly series for each metric.
 */
router.get('/:dealId', requireAuth, requireDealAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const includeSeries = req.query.includeSeries === 'true';
    const pool = getPool();

    const definitions = await loadCustomMetricDefinitions(pool, dealId, req.user!.userId);

    if (!includeSeries) {
      return res.json({ success: true, metrics: definitions });
    }

    // ── Load periodic seed ─────────────────────────────────────────────────────
    const seedRow = await pool.query(
      `SELECT periodic_seed FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
      [dealId]
    );
    if (!seedRow.rows[0]?.periodic_seed) {
      return res.json({ success: true, metrics: definitions, series: {} });
    }
    const periodicSeed = seedRow.rows[0].periodic_seed;

    // ── Load input-type custom metric values ───────────────────────────────────
    const valRows = await pool.query(
      `SELECT cmv.metric_id, cm.metric_key,
              to_char(cmv.period_month, 'YYYY-MM-DD') AS period_month,
              cmv.value::float AS value,
              cmv.zone
         FROM custom_metric_values cmv
         JOIN custom_metrics cm ON cm.id = cmv.metric_id
        WHERE cmv.deal_id = $1`,
      [dealId]
    );
    const inputValues: Record<string, Array<{ period_month: string; value: number | null; zone: string }>> = {};
    for (const r of valRows.rows) {
      inputValues[r.metric_key] = inputValues[r.metric_key] || [];
      inputValues[r.metric_key].push({ period_month: r.period_month, value: r.value, zone: r.zone });
    }

    // ── Compute series ─────────────────────────────────────────────────────────
    const seriesMap = buildCustomMetricSeries(definitions, periodicSeed, inputValues);

    // Convert Map to plain object for JSON serialisation
    const series: Record<string, any> = {};
    for (const [key, s] of Object.entries(seriesMap)) {
      series[key] = {
        metricKey: s.metricKey,
        name: s.name,
        metricType: s.metricType,
        periods: s.periods.map(p => ({
          month: p.month,
          resolved: p.resolved,
          resolution: p.resolution,
          zone: p.zone,
        })),
      };
    }

    return res.json({ success: true, metrics: definitions, series });
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
    const { metric_id, values } = req.body;

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
