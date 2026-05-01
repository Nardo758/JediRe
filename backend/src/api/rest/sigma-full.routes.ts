/**
 * M36 Σ Engine — API Routes
 *
 * Phase A routes for heuristic Σ:
 *   POST /api/sigma/plausibility — score assumption set
 *   POST /api/sigma/goal-seek — solve for target IRR
 *   GET /api/sigma/bundles — list debt bundles
 *   GET /api/sigma/factors — factor definitions
 *   GET /api/sigma/regime/current — current regime
 *   POST /api/sigma/cache/invalidate — refresh Σ cache
 *
 * These run alongside the existing sigma.routes.ts (macro-anchored mean routes).
 */

import { Router } from 'express';
import { scorePlausibility, invalidateSigmaCache } from '../services/sigma/sigma-plausibility.service';
import { runGoalSeek } from '../services/sigma/sigma-goal-seeking.service';
import { FACTORS } from '../services/sigma/sigma-variable-registry';
import { DEBT_BUNDLES } from '../services/sigma/debt-bundle-registry';
import { buildHeuristicSigma } from '../services/sigma/heuristic-sigma-builder';
import { logger } from '../../utils/logger';

const router = Router();

// ─── Plausibility Scoring ────────────────────────────────────────────────────

router.post('/plausibility', async (req, res) => {
  try {
    const { assumptions, regime, bundleId, dealF1Sensitivity } = req.body;

    if (!assumptions || typeof assumptions !== 'object') {
      return res.status(400).json({ error: 'Missing required field: assumptions' });
    }

    const result = await scorePlausibility({
      assumptions,
      regime: regime ?? 'expansion',
      bundleId,
      dealF1Sensitivity,
    });

    return res.json(result);
  } catch (err: any) {
    logger.error(`[sigma] plausibility error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Goal-Seeking ────────────────────────────────────────────────────────────

router.post('/goal-seek', async (req, res) => {
  try {
    const {
      targetIRR,
      baseAssumptions,
      holdPeriodYears,
      lockedVariables,
      expenseLineItems,
      controllableExpenseKeys,
      bundleId,
      regime,
      aggressivenessBudgets,
      dealParams,
    } = req.body;

    if (targetIRR === undefined || !baseAssumptions || !bundleId) {
      return res.status(400).json({
        error: 'Missing required fields: targetIRR, baseAssumptions, bundleId',
      });
    }

    const result = await runGoalSeek({
      targetIRR,
      baseAssumptions,
      holdPeriodYears: holdPeriodYears ?? 5,
      lockedVariables,
      expenseLineItems,
      controllableExpenseKeys,
      bundleId: bundleId ?? 'all',
      regime: regime ?? 'expansion',
      aggressivenessBudgets,
      dealParams,
    });

    return res.json(result);
  } catch (err: any) {
    logger.error(`[sigma] goal-seek error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Debt Bundles ────────────────────────────────────────────────────────────

router.get('/bundles', async (req, res) => {
  try {
    const bundles = Object.entries(DEBT_BUNDLES).map(([id, b]) => ({
      id,
      name: b.name,
      description: b.description,
      rateLocked: b.rateLocked,
      f1Loading: b.f1Loading,
      ltvRange: b.ltvRange,
      typicalSpread: b.typicalSpread,
      closingTimelineMonths: b.closingTimelineMonths,
      doubleUpNote: b.doubleUpNote,
    }));

    return res.json({ bundles });
  } catch (err: any) {
    logger.error(`[sigma] bundles error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Factors ─────────────────────────────────────────────────────────────────

router.get('/factors', async (req, res) => {
  try {
    return res.json({ factors: FACTORS });
  } catch (err: any) {
    logger.error(`[sigma] factors error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Current Regime ──────────────────────────────────────────────────────────

router.get('/regime/current', async (req, res) => {
  try {
    // Phase A: return default regime.
    // Phase C: read from HMM classifier / regime_classifications table.
    const sigma = buildHeuristicSigma('expansion');
    return res.json({
      regime: 'expansion',
      probabilities: { expansion: 0.65, late_cycle: 0.30, contraction: 0.05 },
      lastChange: '2026-04-01',
      indicators: {
        yieldCurve: 0.20, // 10Y - 3M, positive
        employmentMomentum: 0.02, // 3m change in unemployment, slightly positive
        transactionVolumeYoY: 0.05, // +5%
        capRateDirection: -0.10, // still compressing
        creditSpread: 0.015, // IG spread, narrow
      },
      source: 'heuristic_default',
    });
  } catch (err: any) {
    logger.error(`[sigma] regime error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Cache Control ───────────────────────────────────────────────────────────

router.post('/cache/invalidate', async (req, res) => {
  try {
    invalidateSigmaCache();
    return res.json({ status: 'ok', message: 'Sigma cache invalidated' });
  } catch (err: any) {
    logger.error(`[sigma] cache invalidate error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

export default router;


