/**
 * Planner-Executor Routes
 * 
 * Exposes the planner/executor pattern for cost-efficient AI operations.
 */

import { Router, Request, Response } from 'express';
import { getPlannerExecutor } from '../../services/ai/planner-executor.service';

const router = Router();

/**
 * POST /plan
 * Create an execution plan without running it
 */
router.post('/plan', async (req: Request, res: Response) => {
  try {
    const { task, context, constraints, maxSteps } = req.body;
    
    if (!task) {
      return res.status(400).json({ error: 'task is required' });
    }

    const planner = getPlannerExecutor();
    const plan = await planner.plan({ task, context, constraints, maxSteps });
    
    res.json({ success: true, plan });
  } catch (error: any) {
    console.error('Plan error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /execute
 * Plan and execute a task
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { task, context, constraints, maxSteps } = req.body;
    
    if (!task) {
      return res.status(400).json({ error: 'task is required' });
    }

    const planner = getPlannerExecutor();
    const result = await planner.execute({ task, context, constraints, maxSteps });
    
    res.json({ 
      success: true, 
      ...result,
      // Add human-readable cost
      costSummary: `$${result.totalCost.usd.toFixed(4)} (${result.totalCost.tokens.input + result.totalCost.tokens.output} tokens)`
    });
  } catch (error: any) {
    console.error('Execute error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /extract
 * Quick extraction endpoint
 */
router.post('/extract', async (req: Request, res: Response) => {
  try {
    const { text, schema } = req.body;
    
    if (!text || !schema) {
      return res.status(400).json({ error: 'text and schema are required' });
    }

    const planner = getPlannerExecutor();
    const result = await planner.extract(text, schema);
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Extract error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /analyze
 * Quick analysis endpoint
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { data, question } = req.body;
    
    if (!data || !question) {
      return res.status(400).json({ error: 'data and question are required' });
    }

    const planner = getPlannerExecutor();
    const result = await planner.analyze(data, question);
    
    res.json({ success: true, analysis: result });
  } catch (error: any) {
    console.error('Analyze error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /batch
 * Batch process items with a single plan
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { items, task } = req.body;
    
    if (!items?.length || !task) {
      return res.status(400).json({ error: 'items array and task are required' });
    }

    if (items.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 items per batch' });
    }

    const planner = getPlannerExecutor();
    const results = await planner.batchProcess(items, task);
    
    res.json({ 
      success: true, 
      results,
      processed: results.length
    });
  } catch (error: any) {
    console.error('Batch error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /models
 * List available models and their costs
 */
router.get('/models', (_req: Request, res: Response) => {
  res.json({
    planner: {
      model: 'claude-haiku-4-5',
      role: 'Creates execution plans',
      cost: { input: 0.80, output: 4.00 }
    },
    executors: [
      {
        model: 'deepseek-v3',
        role: 'Default executor - fast & cheap',
        cost: { input: 0.27, output: 1.10 }
      },
      {
        model: 'deepseek-r1',
        role: 'Reasoning executor - for complex logic',
        cost: { input: 0.55, output: 2.19 }
      },
      {
        model: 'claude-haiku-4-5',
        role: 'Fallback for nuanced tasks',
        cost: { input: 0.80, output: 4.00 }
      }
    ],
    comparison: {
      'sonnet_vs_deepseek': '10x cheaper',
      'haiku_vs_deepseek': '3x cheaper',
      'typical_extraction': '$0.001 with DeepSeek vs $0.01 with Sonnet'
    }
  });
});

export default router;
