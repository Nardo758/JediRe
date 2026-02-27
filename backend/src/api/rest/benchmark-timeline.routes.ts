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
import { query as dbQuery } from '../../database/connection';

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

    const countyStr = county as string;
    const stateStr = state as string;

    let realSummaries: any[] = [];
    try {
      const sql = `
        SELECT entitlement_type,
               COUNT(*)::int as sample_size,
               ROUND((PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_entitlement_days) / 30.0)::numeric, 1) as p25_months,
               ROUND((PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_entitlement_days) / 30.0)::numeric, 1) as p50_months,
               ROUND((PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_entitlement_days) / 30.0)::numeric, 1) as p75_months,
               ROUND((PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_entitlement_days) / 30.0)::numeric, 1) as p90_months
        FROM benchmark_projects
        WHERE county ILIKE $1 AND state = $2
          AND outcome IN ('approved', 'modified')
        GROUP BY entitlement_type
      `;
      const result = await dbQuery(sql, [countyStr, stateStr]);
      if (result.rows.length > 0) {
        realSummaries = result.rows
          .filter(row => row.sample_size >= 3)
          .map(row => ({
            entitlementType: row.entitlement_type,
            county: countyStr,
            state: stateStr,
            sampleSize: row.sample_size,
            medianMonths: parseFloat(row.p50_months),
            p25Months: parseFloat(row.p25_months),
            p75Months: parseFloat(row.p75_months),
            p90Months: parseFloat(row.p90_months),
            trend: 'stable',
            dataSource: 'real' as const,
          }));
      }
    } catch (dbError) {
      logger.warn('Failed to query benchmark_projects, falling back to synthetic', { error: dbError });
    }

    if (realSummaries.length > 0) {
      const filtered = entitlementType
        ? realSummaries.filter(s => s.entitlementType === entitlementType)
        : realSummaries;
      res.json({ county: countyStr, state: stateStr, summaries: filtered.length > 0 ? filtered : realSummaries });
    } else {
      const summaries = generateBenchmarkSummary(countyStr, stateStr, entitlementType as string).map(s => ({
        ...s,
        dataSource: 'synthetic' as const,
      }));
      res.json({ county: countyStr, state: stateStr, summaries });
    }
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
 * GET /api/v1/benchmark-timeline/detailed-steps
 * Get per-phase percentile statistics from real benchmark data.
 */
router.get('/detailed-steps', async (req: Request, res: Response) => {
  try {
    const { county, state, entitlementType } = req.query;

    if (!county || !state) {
      return res.status(400).json({ error: 'Required: county, state' });
    }

    const phases = [
      { column: 'pre_app_days', step: 'Pre-Application Mtg' },
      { column: 'site_plan_review_days', step: 'Site Plan Review' },
      { column: 'zoning_hearing_days', step: 'Zoning Hearing' },
      { column: 'approval_days', step: 'Approval' },
      { column: 'permit_issuance_days', step: 'Permit Issuance' },
    ];

    const entitlementFilter = entitlementType
      ? `AND entitlement_type = $3`
      : '';
    const params: any[] = [county as string, state as string];
    if (entitlementType) params.push(entitlementType as string);

    const results = await Promise.all(
      phases.map(async (phase) => {
        const sql = `
          SELECT
            COUNT(${phase.column})::int as n,
            ROUND((PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${phase.column}))::numeric) as p25_days,
            ROUND((PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ${phase.column}))::numeric) as p50_days,
            ROUND((PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${phase.column}))::numeric) as p75_days,
            ROUND((PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY ${phase.column}))::numeric) as p90_days
          FROM benchmark_projects
          WHERE county ILIKE $1 AND state = $2
            AND outcome IN ('approved', 'modified')
            AND ${phase.column} IS NOT NULL
            ${entitlementFilter}
        `;
        const result = await dbQuery(sql, params);
        return { phase, row: result.rows[0] };
      }),
    );

    const hasRealData = results.some((r) => r.row && r.row.n > 0);

    if (!hasRealData) {
      const fallbackSteps = [
        { step: 'Pre-Application Mtg', p25: '2 wks', median: '4 wks', p75: '6 wks', p90: '8 wks', n: '124', isSubRow: false },
        { step: 'Rezone Application', p25: '4.5 mo', median: '6.2 mo', p75: '8.1 mo', p90: '11 mo', n: '89', isSubRow: false },
        { step: 'SAP / Variance', p25: '3.8 mo', median: '5.4 mo', p75: '7.2 mo', p90: '9.5 mo', n: '67', isSubRow: false },
        { step: 'CUP Application', p25: '2.1 mo', median: '3.5 mo', p75: '4.8 mo', p90: '6.2 mo', n: '142', isSubRow: false },
        { step: 'Site Plan Review', p25: '2.8 mo', median: '4.1 mo', p75: '5.6 mo', p90: '7.8 mo', n: '203', isSubRow: false },
        { step: 'Building Permit', p25: '3.2 mo', median: '4.8 mo', p75: '6.5 mo', p90: '9.1 mo', n: '178', isSubRow: false },
        { step: 'Foundation Inspect.', p25: '1 wk', median: '2 wks', p75: '3 wks', p90: '4 wks', n: '312', isSubRow: false },
        { step: 'Certificate of Occ.', p25: '2 wks', median: '4 wks', p75: '6 wks', p90: '10 wks', n: '156', isSubRow: false },
      ];
      return res.json({ county, state, dataSource: 'synthetic', steps: fallbackSteps });
    }

    const formatDuration = (days: number | null): string => {
      if (days === null || days === undefined) return 'N/A';
      if (days < 60) return `${Math.round(days / 7)} wks`;
      return `${(days / 30).toFixed(1)} mo`;
    };

    const steps = results
      .filter((r) => r.row && r.row.n > 0)
      .map((r) => ({
        step: r.phase.step,
        p25: formatDuration(r.row.p25_days),
        median: formatDuration(r.row.p50_days),
        p75: formatDuration(r.row.p75_days),
        p90: formatDuration(r.row.p90_days),
        n: String(r.row.n),
        isSubRow: false,
      }));

    res.json({ county, state, dataSource: 'real', steps });
  } catch (error) {
    logger.error('Detailed steps query failed', { error });
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

/**
 * GET /api/v1/benchmark-timeline/jurisdiction-comparison
 * Compare entitlement timelines across municipalities within a state.
 */
router.get('/jurisdiction-comparison', async (req: Request, res: Response) => {
  try {
    const { state, subjectMunicipality, landBasis, loanRate, entitlementType } = req.query;

    if (!state) {
      return res.status(400).json({ error: 'Required: state' });
    }

    const stateStr = state as string;
    const subjectMuni = (subjectMunicipality as string) || '';
    const basis = parseFloat((landBasis as string) || '5000000');
    const rate = parseFloat((loanRate as string) || '0.06');

    let queryText = `
      SELECT municipality,
             COUNT(*)::int as sample_size,
             PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_entitlement_days) as median_days
      FROM benchmark_projects
      WHERE state = $1
        AND outcome IN ('approved', 'modified')
        AND municipality IS NOT NULL
    `;
    const params: any[] = [stateStr];

    if (entitlementType) {
      params.push(entitlementType as string);
      queryText += ` AND entitlement_type = $${params.length}`;
    }

    queryText += ` GROUP BY municipality HAVING COUNT(*) >= 1 ORDER BY median_days ASC`;

    const result = await dbQuery(queryText, params);

    if (result.rows.length < 2) {
      const mockJurisdictions = generateMockJurisdictions(subjectMuni, basis, rate);
      return res.json({
        state: stateStr,
        subjectMunicipality: subjectMuni,
        jurisdictions: mockJurisdictions,
        dataSource: 'synthetic',
      });
    }

    const subjectRow = result.rows.find(
      (r: any) => r.municipality.toLowerCase() === subjectMuni.toLowerCase()
    );
    const subjectMedianDays = subjectRow ? parseFloat(subjectRow.median_days) : parseFloat(result.rows[0].median_days);
    const subjectMedianMonths = subjectMedianDays / 30.0;
    const monthlyCarryCost = basis * rate / 12;

    const jurisdictions = result.rows.map((row: any, index: number) => {
      const medianDays = parseFloat(row.median_days);
      const medianMonths = medianDays / 30.0;
      const deltaMonths = medianMonths - subjectMedianMonths;
      const carryCostDelta = deltaMonths * monthlyCarryCost;

      return {
        rank: index + 1,
        municipality: row.municipality,
        medianMonths: Math.round(medianMonths * 10) / 10,
        medianDays: Math.round(medianDays),
        sampleSize: row.sample_size,
        deltaMonths: Math.round(deltaMonths * 10) / 10,
        carryCostDelta: Math.round(carryCostDelta),
        isSubject: row.municipality.toLowerCase() === subjectMuni.toLowerCase(),
      };
    });

    res.json({
      state: stateStr,
      subjectMunicipality: subjectMuni,
      landBasis: basis,
      loanRate: rate,
      jurisdictions,
      dataSource: 'real',
    });
  } catch (error) {
    logger.error('Jurisdiction comparison failed', { error });
    res.status(500).json({ error: (error as Error).message });
  }
});

function generateMockJurisdictions(subjectMunicipality: string, landBasis: number, loanRate: number) {
  const monthlyCarryCost = landBasis * loanRate / 12;
  const mockData = [
    { municipality: 'Sandy Springs', medianMonths: 8.2 },
    { municipality: 'Roswell', medianMonths: 9.5 },
    { municipality: 'Brookhaven', medianMonths: 10.1 },
    { municipality: subjectMunicipality || 'Atlanta', medianMonths: 11.8 },
    { municipality: 'Decatur', medianMonths: 13.4 },
    { municipality: 'East Point', medianMonths: 15.2 },
  ];

  const subjectMonths = mockData.find(
    m => m.municipality.toLowerCase() === (subjectMunicipality || 'atlanta').toLowerCase()
  )?.medianMonths || 11.8;

  return mockData.map((m, i) => ({
    rank: i + 1,
    municipality: m.municipality,
    medianMonths: m.medianMonths,
    medianDays: Math.round(m.medianMonths * 30),
    sampleSize: Math.floor(Math.random() * 20) + 5,
    deltaMonths: Math.round((m.medianMonths - subjectMonths) * 10) / 10,
    carryCostDelta: Math.round((m.medianMonths - subjectMonths) * monthlyCarryCost),
    isSubject: m.municipality.toLowerCase() === (subjectMunicipality || 'atlanta').toLowerCase(),
  }));
}

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
