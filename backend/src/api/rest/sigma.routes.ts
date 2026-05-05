import { Router, Request, Response } from 'express';
import { 
  computePlausibility,
  goalSeek,
  DEBT_BUNDLES,
  VARIABLE_META,
} from '../../services/sigma/sigma-engine';
import { 
  computePlausibilityWithContext,
} from '../../services/sigma/sigma-mu-plausibility';
import {
  getMuBreakdown,
} from '../../services/sigma/mu-composer';
import {
  MACRO_SERIES,
  getMacroValue,
  storeObservation,
  seedDefaultObservations,
} from '../../services/sigma/macro/macro-fetcher';
import {
  getAnchorsByDealType,
  getStateRules,
  projectLineItem,
  projectAllLineItems,
  DEFAULT_ANCHORS,
  DEFAULT_STATE_RULES,
  type LineItemAnchor,
  type StateRule,
} from '../../services/sigma/proforma-anchors.service';

const router = Router();

/**
 * POST /api/v1/sigma/plausibility
 * Score an assumption set for plausibility via Mahalanobis distance.
 * If empiricalContext is provided, uses macro-anchored μ instead of static priors.
 */
router.post('/plausibility', async (req: Request, res: Response) => {
  try {
    const { assumptions, empiricalContext } = req.body;
    if (!assumptions || typeof assumptions !== 'object') {
      return res.status(400).json({ success: false, error: 'assumptions object required' });
    }

    if (empiricalContext && Object.keys(empiricalContext).length > 0) {
      // Macro-anchored plausibility with dynamic μ
      const result = await computePlausibilityWithContext(assumptions, empiricalContext);
      res.json({
        success: true,
        data: {
          mahalanobisD: result.mahalanobisD,
          band: result.band,
          contributions: result.contributions,
          topContributors: result.topContributors,
          nVariables: Object.keys(result.contributions).length,
          macroBreakdown: result.macroBreakdown,
        },
      });
    } else {
      // Static plausibility (backward compatible)
      const result = computePlausibility(assumptions);
      res.json({
        success: true,
        data: {
          mahalanobisD: parseFloat(result.dScore.toFixed(3)),
          band: result.band,
          contributions: result.contributions,
          nVariables: Object.keys(result.contributions).length,
          topContributors: result.topContributors,
        },
      });
    }
  } catch (error: any) {
    console.error('Plausibility error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to compute plausibility' });
  }
});

/**
 * POST /api/v1/sigma/goal-seek
 * Given a target IRR and current deal state, find the least-aggressive
 * assumption set (lowest d) that hits the target. Evaluates each debt bundle.
 */
router.post('/goal-seek', async (req: Request, res: Response) => {
  try {
    const {
      targetIrR,
      holdYears,
      currentAssumptions = {},
      lockVariables = [],
      bundleFilter = [],
    } = req.body;

    if (targetIrR == null || holdYears == null) {
      return res.status(400).json({ success: false, error: 'targetIrR and holdYears required' });
    }

    const result = goalSeek(targetIrR, holdYears, currentAssumptions, {
      lockedVariables: lockVariables,
      bundleFilter,
    });

    res.json({
      success: true,
      data: {
        targetIrR: result.targetIrR,
        holdYears: result.holdYears,
        currentIrRPerBundle: result.currentIrRMap,
        results: result.results.map(r => ({
          bundle: r.bundle.id,
          bundleName: r.bundle.name,
          baseIrR: r.baseIrR,
          achievedIrR: r.achievedIrR,
          dScore: r.dScore,
          band: r.band,
          changedVars: r.changedVars,
          narrative: r.narrative,
        })),
        recommendation: result.recommendation ? {
          bundle: result.recommendation.bundle.id,
          bundleName: result.recommendation.bundle.name,
          dScore: result.recommendation.dScore,
          band: result.recommendation.band,
          achievedIrR: result.recommendation.achievedIrR,
          narrative: result.recommendation.narrative,
        } : null,
        bundlesEvaluated: result.bundlesEvaluated,
      },
    });
  } catch (error: any) {
    console.error('Goal-seek error:', error);
    res.status(500).json({ success: false, error: error.message || 'Goal-seeking failed' });
  }
});

/**
 * GET /api/v1/sigma/bundles
 * List available debt bundles.
 */
router.get('/bundles', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: DEBT_BUNDLES.map(b => ({
      id: b.id,
      name: b.name,
      ltv: b.ltv,
      rate: b.rate,
      ioPeriod: b.ioPeriod,
      amortYears: b.amortYears,
      minDscr: b.minDscr,
      description: b.description,
    })),
  });
});

/**
 * GET /api/v1/sigma/variables
 * List variable metadata for the assumption schema.
 */
router.get('/variables', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: Object.entries(VARIABLE_META).map(([key, meta]) => ({
      key,
      unit: meta.unit,
      min: meta.min,
      max: meta.max,
      prior: meta.prior,
      std: meta.std,
    })),
  });
});

/**
 * POST /api/v1/sigma/plausibility/field
 * M36 — lightweight single-field plausibility check.
 * Maps a proforma field name to its sigma variable and scores it.
 * Returns a 3-tier badge: REALISTIC | AGGRESSIVE | HEROIC.
 */

// Operating-statement field → VARIABLE_META key
const FIELD_TO_SIGMA_VAR: Record<string, string> = {
  vacancy_loss:          'vacancyAtStabilization',
  loss_to_lease:         'lossToLeasePct',
  concessions:           'concessionsPct',
  management_fee:        'managementFeePct',
  managementFeePct:      'managementFeePct',
  insurance:             'insurancePerUnit',
  real_estate_taxes:     'propertyTaxPctOfRevenue',
  replacement_reserves:  'replacementReservesPerUnit',
  other_income:          'otherIncomePerUnit',
  exit_cap_rate:         'exitCapRate',
  rent_growth:           'rentGrowthStabilized',
};

function mapBandTo3Tier(band: string): 'REALISTIC' | 'AGGRESSIVE' | 'HEROIC' {
  if (band === 'Realistic' || band === 'Stretch') return 'REALISTIC';
  if (band === 'Aggressive') return 'AGGRESSIVE';
  return 'HEROIC';
}

router.post('/plausibility/field', (req: Request, res: Response) => {
  try {
    const { field, value } = req.body as { field: string; value: number };
    if (!field || value == null || typeof value !== 'number') {
      return res.status(400).json({ success: false, error: 'field and numeric value required' });
    }
    const sigmaVar = FIELD_TO_SIGMA_VAR[field];
    if (!sigmaVar) {
      return res.json({ success: true, data: { field, sigmaVar: null, band: null, dScore: null, tier: null } });
    }
    const result = computePlausibility({ [sigmaVar]: value });
    const tier = mapBandTo3Tier(result.band);
    return res.json({
      success: true,
      data: {
        field,
        sigmaVar,
        dScore: parseFloat(result.dScore.toFixed(3)),
        band: result.band,
        tier,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message ?? 'Field plausibility error' });
  }
});

/**
 * GET /api/v1/sigma/mu/breakdown
 * Show the macro-anchored μ breakdown for inspection.
 * Query params: metric, muEmpirical, metricStd
 */
router.get('/mu/breakdown', async (req: Request, res: Response) => {
  try {
    const { metric, muEmpirical, metricStd } = req.query;

    if (!metric || typeof metric !== 'string') {
      return res.status(400).json({ success: false, error: 'metric query param required' });
    }

    const emp = muEmpirical ? parseFloat(muEmpirical as string) : 0.065;
    const std = metricStd ? parseFloat(metricStd as string) : 0.012;

    const breakdown = await getMuBreakdown(metric, emp, std);
    res.json({ success: true, data: breakdown });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/sigma/macro/series
 * List all tracked macro series and their latest values.
 */
router.get('/macro/series', async (_req: Request, res: Response) => {
  try {
    const seriesInfo = await Promise.all(
      MACRO_SERIES.map(async (series) => {
        const latest = await getMacroValue(series.seriesId);
        return {
          seriesId: series.seriesId,
          name: series.name,
          unit: series.unit,
          refreshCadence: series.refreshCadence,
          currentValue: latest.value,
          source: latest.source,
          observationDate: latest.observationDate,
          defaultFallback: series.defaultFallback,
        };
      })
    );
    res.json({ success: true, data: seriesInfo });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/sigma/macro/seed
 * Seed default macro observations into DB.
 * Admin endpoint, called on first deploy.
 */
router.post('/macro/seed', async (_req: Request, res: Response) => {
  try {
    await seedDefaultObservations();
    res.json({ success: true, message: 'Default macro observations seeded' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/sigma/macro/observation
 * Store a manual macro observation (useful for REPL/importer).
 */
router.post('/macro/observation', async (req: Request, res: Response) => {
  try {
    const { seriesId, value, obsDate, source } = req.body;
    if (!seriesId || value == null || !obsDate) {
      return res.status(400).json({ success: false, error: 'seriesId, value, obsDate required' });
    }
    await storeObservation(seriesId, value, obsDate, source || 'manual');
    res.json({ success: true, message: 'Observation stored' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Proforma Line-Item Anchor Endpoints (Phase B1)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/anchors', (req: Request, res: Response) => {
  try {
    const dealType = req.query.dealType as string | undefined;
    const tags = dealType ? dealType.split(',') : [];
    const anchors = getAnchorsByDealType(tags);
    res.json({ success: true, count: anchors.length, data: anchors });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/anchors/state/:stateCode', (req: Request, res: Response) => {
  try {
    const stateCode = req.params.stateCode.toUpperCase();
    const lineItem = req.query.lineItem as string | undefined;
    const rules = getStateRules(stateCode, lineItem);
    res.json({ success: true, stateCode, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/anchors/project', (req: Request, res: Response) => {
  try {
    const { lineItemId, baseValue, macroGrowthRate, year, isSaleTrigger, stateCode } = req.body;
    if (!lineItemId || baseValue == null) {
      return res.status(400).json({ success: false, error: 'lineItemId and baseValue required' });
    }
    const anchor = getAnchorsByDealType().find(a => a.lineItemId === lineItemId);
    if (!anchor) {
      return res.status(404).json({ success: false, error: `No anchor found for: ${lineItemId}` });
    }
    const stateRules = stateCode ? getStateRules(stateCode.toUpperCase()) : [];
    const projected = projectLineItem({
      anchor, baseValue,
      macroGrowthRate: macroGrowthRate ?? 0.02,
      year: year ?? 0,
      isSaleTrigger: isSaleTrigger === true && (year === 1),
      egiValue: req.body.egiValue,
      stateRules,
    });
    res.json({ success: true, data: projected });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/anchors/project-all', (req: Request, res: Response) => {
  try {
    const { dealType, baseValues, macroGrowthRates, horizonYears, stateCode, isSaleTrigger, egiValue } = req.body;
    const tags = dealType ? (dealType as string).split(',') : [];
    const anchors = getAnchorsByDealType(tags);
    const baseValMap: Map<string, number> = new Map(Object.entries(baseValues || {}).map(([k, v]) => [k, Number(v)]));
    const macroMap: Map<string, number> = new Map(Object.entries(macroGrowthRates || {}).map(([k, v]) => [k, Number(v)]));
    const results = projectAllLineItems(anchors, baseValMap, macroMap,
      horizonYears ?? 5, (stateCode || 'GA').toUpperCase(), isSaleTrigger === true, egiValue ?? 0);
    res.json({ success: true, count: results.length, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
