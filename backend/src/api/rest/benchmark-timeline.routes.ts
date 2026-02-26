/**
 * Benchmark Timeline API Routes
 *
 * Endpoints for Monte Carlo timeline simulations and county benchmark data.
 * Used by Time-to-Shovel tab (M02 Phase 3).
 */

import { Router, Request, Response } from 'express';
import { monteCarloTimelineService } from '../../services/monte-carlo-timeline.service';
import { dataFlowRouter } from '../../services/module-wiring/data-flow-router';
import { moduleEventBus, ModuleEventType } from '../../services/module-wiring/module-event-bus';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * POST /api/v1/benchmark-timeline/simulate
 * Run Monte Carlo simulation for a deal's development path.
 */
router.post('/simulate', async (req: Request, res: Response) => {
  try {
    const {
      dealId,
      county,
      state,
      developmentPath,
      unitCount,
      projectType,
      landBasis,
      loanRate,
      targetIrr,
    } = req.body;

    if (!dealId || !county || !state || !developmentPath || !unitCount) {
      return res.status(400).json({
        error: 'Required: dealId, county, state, developmentPath, unitCount',
      });
    }

    const result = await monteCarloTimelineService.simulate({
      dealId,
      county,
      state,
      developmentPath,
      unitCount,
      projectType,
      landBasis,
      loanRate,
      targetIrr,
    });

    // Publish timeline data to data flow router for downstream modules
    dataFlowRouter.publishModuleData('M02', dealId, {
      entitlement_timeline_months: result.percentiles.p50,
      timeline_p10: result.percentiles.p10,
      timeline_p90: result.percentiles.p90,
      construction_timeline_months: result.phases.construction,
      total_timeline_months: result.phases.total,
      carrying_cost_p50: result.financialImpact.p50.carryingCost,
    });

    // Emit event for downstream recalculation
    moduleEventBus.emitDebounced({
      type: ModuleEventType.DATA_UPDATED,
      sourceModule: 'M02',
      dealId,
      data: {
        source: 'monte_carlo_simulation',
        development_path: developmentPath,
        p50_months: result.percentiles.p50,
      },
      timestamp: new Date(),
    });

    res.json(result);
  } catch (error) {
    logger.error('Monte Carlo simulation failed', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/v1/benchmark-timeline/benchmarks
 * Get county benchmark summary data.
 */
router.get('/benchmarks', async (req: Request, res: Response) => {
  try {
    const { county, state, entitlementType, projectType } = req.query;

    if (!county || !state) {
      return res.status(400).json({ error: 'Required: county, state' });
    }

    // Return summary statistics from benchmark_projects table
    // For now, return synthetic summary
    const summaries = generateBenchmarkSummary(
      county as string,
      state as string,
      entitlementType as string,
    );

    res.json({ county, state, summaries });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/v1/benchmark-timeline/compare-paths
 * Compare Monte Carlo simulations across all 4 development paths.
 */
router.post('/compare-paths', async (req: Request, res: Response) => {
  try {
    const { dealId, county, state, unitCount, projectType, landBasis, loanRate, targetIrr } = req.body;

    if (!dealId || !county || !state || !unitCount) {
      return res.status(400).json({ error: 'Required: dealId, county, state, unitCount' });
    }

    const paths = ['by_right', 'overlay_bonus', 'variance', 'rezone'] as const;
    const results = await Promise.all(
      paths.map(path =>
        monteCarloTimelineService.simulate({
          dealId,
          county,
          state,
          developmentPath: path,
          unitCount,
          projectType,
          landBasis,
          loanRate,
          targetIrr,
        }),
      ),
    );

    const comparison = results.map(r => ({
      path: r.developmentPath,
      p10: r.percentiles.p10,
      p50: r.percentiles.p50,
      p90: r.percentiles.p90,
      constructionMonths: r.phases.construction,
      totalMonths: r.phases.total,
      carryingCostP50: r.financialImpact.p50.carryingCost,
      irrImpactP50: r.financialImpact.p50.irrImpact,
    }));

    res.json({ dealId, county, state, comparison });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/v1/benchmark-timeline/ingest/atlanta
 * Trigger Atlanta GIS benchmark data ingestion.
 */
router.post('/ingest/atlanta', async (req: Request, res: Response) => {
  try {
    const { atlantaBenchmarkIngestionService } = await import('../../services/atlanta-benchmark-ingestion.service');
    logger.info('[API] Starting Atlanta benchmark ingestion...');
    const stats = await atlantaBenchmarkIngestionService.ingest();
    logger.info(`[API] Atlanta ingestion complete: ${JSON.stringify(stats)}`);
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('[API] Atlanta ingestion failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Helper to generate benchmark summary from synthetic data
function generateBenchmarkSummary(county: string, state: string, entitlementType?: string) {
  const types = entitlementType ? [entitlementType] : ['by_right', 'variance', 'rezone'];

  return types.map(type => {
    const base: Record<string, { median: number; p25: number; p75: number; p90: number; n: number }> = {
      by_right: { median: 2.4, p25: 1.8, p75: 3.2, p90: 4.5, n: 47 },
      variance: { median: 7.2, p25: 5.5, p75: 9.8, p90: 14.0, n: 31 },
      rezone: { median: 14.0, p25: 10.5, p75: 18.0, p90: 24.0, n: 18 },
    };

    const stats = base[type] || base.by_right;

    return {
      entitlementType: type,
      county,
      state,
      sampleSize: stats.n,
      medianMonths: stats.median,
      p25Months: stats.p25,
      p75Months: stats.p75,
      p90Months: stats.p90,
      trend: type === 'rezone' ? 'worsening' : 'stable',
    };
  });
}

export default router;
