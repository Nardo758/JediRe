import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { computeFinancialModel, invalidateCache, getCacheStats } from '../../services/claude-compute.service';
import { inferModelType, setModelType as setModelTypeService, getModelTypeCompatibility } from '../../services/model-type-inference.service';
import { assembleAssumptions } from '../../services/assumption-assembly.service';
import { validateModelOutput } from '../../services/model-validator.service';
import { PROMPT_TEMPLATES, VALIDATION_RULES } from '../../types/financial-model.types';
import type { ModelType } from '../../types/financial-model.types';

const router = Router();

/**
 * POST /api/v1/deals/:dealId/financial-model/compute
 * 
 * Trigger financial model computation.
 * Auto-detects model type or accepts manual override.
 */
router.post('/:dealId/financial-model/compute', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { modelType: manualModelType, forceRecompute } = req.body;

    logger.info('[FinancialModel] Compute requested', { dealId, manualModelType });

    // Step 1: Determine model type
    const modelType: ModelType = manualModelType || await inferModelType(dealId);

    // Step 2: Assemble assumptions
    const assumptions = await assembleAssumptions(dealId, modelType);

    // Step 3: Build Claude request
    const systemPrompt = PROMPT_TEMPLATES[modelType];
    const outputSchema = {
      // Schema would be the full JSON Schema for the output type
      // For brevity, using a simplified version here
      type: 'object',
      required: ['modelType', 'computedAt'],
    };

    const request = {
      systemPrompt,
      assumptions,
      outputSchema,
      validationRules: VALIDATION_RULES[modelType],
      meta: {
        requestId: `${dealId}-${Date.now()}`,
        dealId,
        userId: (req as any).user?.id || 'system',
      },
    };

    // Step 4: Compute (with caching)
    const output = await computeFinancialModel(request);

    // Step 5: Validate
    const validation = validateModelOutput(output);

    // Step 6: Persist to database
    const pool = getPool();
    await pool.query(
      `INSERT INTO financial_models 
       (deal_id, model_type, model_version, assumptions, output, assumptions_hash, computed_at, computed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (deal_id, model_version) DO UPDATE SET
         assumptions = EXCLUDED.assumptions,
         output = EXCLUDED.output,
         assumptions_hash = EXCLUDED.assumptions_hash,
         computed_at = EXCLUDED.computed_at,
         updated_at = NOW()`,
      [
        dealId,
        modelType,
        '1.0',
        JSON.stringify(assumptions),
        JSON.stringify(output),
        require('crypto').createHash('sha256').update(JSON.stringify(assumptions)).digest('hex'),
        new Date().toISOString(),
        (req as any).user?.id || null,
      ]
    );

    res.json({
      success: true,
      modelType,
      output,
      validation,
    });
  } catch (error: any) {
    logger.error('[FinancialModel] Compute failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/deals/:dealId/financial-model
 * 
 * Get cached financial model output.
 */
router.get('/:dealId/financial-model', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `SELECT 
         model_type,
         model_version,
         output,
         computed_at,
         assumptions_hash
       FROM financial_models
       WHERE deal_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [dealId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No financial model found for this deal' });
    }

    const model = result.rows[0];
    res.json({
      success: true,
      modelType: model.model_type,
      modelVersion: model.model_version,
      output: model.output,
      computedAt: model.computed_at,
      assumptionsHash: model.assumptions_hash,
    });
  } catch (error: any) {
    logger.error('[FinancialModel] Fetch failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/deals/:dealId/financial-model/assumptions
 * 
 * Get assembled assumptions with source attribution.
 */
router.get('/:dealId/financial-model/assumptions', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { modelType: manualModelType } = req.query;

    const modelType: ModelType = (manualModelType as ModelType) || await inferModelType(dealId);
    const assumptions = await assembleAssumptions(dealId, modelType);

    res.json({
      success: true,
      modelType,
      assumptions,
    });
  } catch (error: any) {
    logger.error('[FinancialModel] Assumptions fetch failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/v1/deals/:dealId/financial-model/assumptions
 * 
 * Update specific assumptions (user overrides).
 */
router.patch('/:dealId/financial-model/assumptions', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { updates } = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'Updates object required' });
    }

    const pool = getPool();

    // Log the override in assumption_history
    for (const [path, newValue] of Object.entries(updates)) {
      // Get current model
      const modelResult = await pool.query(
        `SELECT id, assumptions FROM financial_models WHERE deal_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [dealId]
      );

      if (modelResult.rows.length > 0) {
        const model = modelResult.rows[0];
        const currentAssumptions = model.assumptions;

        // Navigate to the field using path
        const pathParts = path.split('.');
        let current = currentAssumptions;
        for (let i = 0; i < pathParts.length - 1; i++) {
          current = current[pathParts[i]];
        }
        const oldValue = current[pathParts[pathParts.length - 1]];

        // Insert history record
        await pool.query(
          `INSERT INTO assumption_history 
           (financial_model_id, deal_id, assumption_path, field_name, old_value, new_value, source_layer, changed_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            model.id,
            dealId,
            path,
            pathParts[pathParts.length - 1],
            JSON.stringify(oldValue),
            JSON.stringify(newValue),
            'user',
            (req as any).user?.id || null,
          ]
        );
      }
    }

    // Apply updates to deal_data
    await pool.query(
      `UPDATE deals
       SET deal_data = COALESCE(deal_data, '{}'::jsonb) || jsonb_build_object('financialOverrides', $1::jsonb)
       WHERE id = $2`,
      [JSON.stringify(updates), dealId]
    );

    // Invalidate cache
    await invalidateCache(dealId);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[FinancialModel] Update assumptions failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/deals/:dealId/financial-model/validate
 * 
 * Re-run validation without recomputing.
 */
router.post('/:dealId/financial-model/validate', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `SELECT output FROM financial_models WHERE deal_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [dealId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No model found to validate' });
    }

    const output = result.rows[0].output;
    const validation = validateModelOutput(output);

    res.json({
      success: true,
      validation,
    });
  } catch (error: any) {
    logger.error('[FinancialModel] Validation failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/deals/:dealId/financial-model/sensitivity
 * 
 * Run custom sensitivity analysis.
 */
router.post('/:dealId/financial-model/sensitivity', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { rowVariable, rowValues, colVariable, colValues } = req.body;

    if (!rowVariable || !rowValues || !colVariable || !colValues) {
      return res.status(400).json({ success: false, error: 'Missing sensitivity parameters' });
    }

    logger.info('[FinancialModel] Sensitivity analysis requested', { dealId, rowVariable, colVariable });

    // TODO: Implement actual sensitivity calculation
    // This would:
    // 1. Get base case assumptions
    // 2. For each combination of (rowValue, colValue):
    //    - Modify assumptions
    //    - Recompute model
    //    - Extract IRR & EM
    // 3. Return grid

    // For now, return placeholder
    const grid = [];
    for (const rowValue of rowValues) {
      for (const colValue of colValues) {
        grid.push({
          rowVariable,
          rowValue,
          colVariable,
          colValue,
          irr: 0.15, // Placeholder
          equityMultiple: 2.0, // Placeholder
          isBaseCase: false,
        });
      }
    }

    res.json({
      success: true,
      grid,
    });
  } catch (error: any) {
    logger.error('[FinancialModel] Sensitivity failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/deals/:dealId/financial-model/export/:format
 * 
 * Export financial model in various formats.
 */
router.get('/:dealId/financial-model/export/:format', async (req: Request, res: Response) => {
  try {
    const { dealId, format } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `SELECT model_type, assumptions, output FROM financial_models WHERE deal_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [dealId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No model found to export' });
    }

    const { model_type, assumptions, output } = result.rows[0];

    switch (format) {
      case 'json':
        res.json({
          modelType: model_type,
          assumptions,
          output,
        });
        break;

      case 'pdf':
        // TODO: Generate PDF with full report
        res.status(501).json({ success: false, error: 'PDF export not yet implemented' });
        break;

      case 'excel':
        // TODO: Generate Excel workbook
        res.status(501).json({ success: false, error: 'Excel export not yet implemented' });
        break;

      default:
        res.status(400).json({ success: false, error: `Unsupported format: ${format}` });
    }
  } catch (error: any) {
    logger.error('[FinancialModel] Export failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/financial-models/cache/stats
 * 
 * Get cache statistics for monitoring.
 */
router.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getCacheStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    logger.error('[FinancialModel] Cache stats failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
