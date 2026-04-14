/**
 * M35 Playbook Routes
 *
 * GET /api/v1/m35/playbooks              — list all subtypes with instance count + confidence
 * GET /api/v1/m35/playbooks/:subtype     — full playbook for a subtype (with optional stratum params)
 * POST /api/v1/m35/playbooks/seed        — trigger historical backfill seed (admin)
 * POST /api/v1/m35/playbooks/aggregate   — trigger full re-aggregation from event_impacts (admin)
 * POST /api/v1/m35/playbooks/:subtype/scale — apply magnitude scaling to a subtype's playbook
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  listPlaybooks,
  getPlaybook,
  scaleMagnitude,
  aggregateAllPlaybooks,
  seedHistoricalPlaybooks,
  aggregatePlaybook,
} from '../services/m35-playbook.service';

const router = Router();

// ─── List all playbooks ───────────────────────────────────────────────────────

router.get('/playbooks', async (req: Request, res: Response) => {
  try {
    const playbooks = await listPlaybooks();
    res.json({ playbooks, count: playbooks.length });
  } catch (err) {
    logger.error('[M35 Playbooks] Error listing playbooks:', err);
    res.status(500).json({ error: 'Failed to list playbooks' });
  }
});

// ─── Get single playbook ──────────────────────────────────────────────────────

router.get('/playbooks/:subtype', async (req: Request, res: Response) => {
  try {
    const { subtype } = req.params;
    const { msaTier, magnitude, regime } = req.query as Record<string, string>;

    const stratum = {
      msaTier: (['large', 'mid', 'small', 'all'].includes(msaTier) ? msaTier : 'all') as any,
      magnitude: (['small', 'medium', 'large', 'transformative', 'all'].includes(magnitude) ? magnitude : 'all') as any,
      regime: (['pre_covid', 'post_covid', 'all'].includes(regime) ? regime : 'all') as any,
    };

    const playbook = await getPlaybook(subtype, stratum);
    if (!playbook) {
      return res.status(404).json({ error: `No playbook found for subtype: ${subtype}`, subtype });
    }
    res.json({ playbook });
  } catch (err) {
    logger.error('[M35 Playbooks] Error fetching playbook:', err);
    res.status(500).json({ error: 'Failed to fetch playbook' });
  }
});

// ─── Scale a playbook for a specific event magnitude ─────────────────────────

router.post('/playbooks/:subtype/scale', async (req: Request, res: Response) => {
  try {
    const { subtype } = req.params;
    const { magnitudeValue, magnitudeUnit, magnitudeScore, msaId, wageLevel, areaMedWage } = req.body;

    const stratum = {
      msaTier: req.body.msaTier || 'all',
      magnitude: req.body.magnitude || 'all',
      regime: req.body.regime || 'all',
    };

    const playbook = await getPlaybook(subtype, stratum);
    if (!playbook) {
      return res.status(404).json({ error: `No playbook found for subtype: ${subtype}` });
    }

    const scaled = scaleMagnitude({
      magnitudeValue: magnitudeValue ?? null,
      magnitudeUnit: magnitudeUnit ?? null,
      magnitudeScore: magnitudeScore ?? null,
      msaId: msaId ?? null,
      wageLevel: wageLevel ?? null,
      areaMedWage: areaMedWage ?? null,
    }, playbook);

    res.json({
      subtype,
      stratum,
      inputMagnitude: { value: magnitudeValue, unit: magnitudeUnit, score: magnitudeScore },
      scaledResults: scaled,
    });
  } catch (err) {
    logger.error('[M35 Playbooks] Error scaling playbook:', err);
    res.status(500).json({ error: 'Failed to scale playbook' });
  }
});

// ─── Admin: Seed historical playbooks ────────────────────────────────────────

router.post('/playbooks/seed', async (req: Request, res: Response) => {
  try {
    const result = await seedHistoricalPlaybooks();
    res.json({ message: 'Seed complete', ...result });
  } catch (err) {
    logger.error('[M35 Playbooks] Error seeding playbooks:', err);
    res.status(500).json({ error: 'Failed to seed playbooks' });
  }
});

// ─── Admin: Aggregate all playbooks from event_impacts ───────────────────────

router.post('/playbooks/aggregate', async (req: Request, res: Response) => {
  try {
    const result = await aggregateAllPlaybooks();
    res.json({ message: 'Aggregation complete', ...result });
  } catch (err) {
    logger.error('[M35 Playbooks] Error aggregating playbooks:', err);
    res.status(500).json({ error: 'Failed to aggregate playbooks' });
  }
});

// ─── Admin: Aggregate single subtype ─────────────────────────────────────────

router.post('/playbooks/:subtype/aggregate', async (req: Request, res: Response) => {
  try {
    const { subtype } = req.params;
    const { msaTier = 'all', magnitude = 'all', regime = 'all' } = req.body;
    await aggregatePlaybook(subtype, { msaTier, magnitude, regime });
    res.json({ message: `Aggregated playbook for ${subtype}`, subtype });
  } catch (err) {
    logger.error('[M35 Playbooks] Error aggregating single playbook:', err);
    res.status(500).json({ error: 'Failed to aggregate playbook' });
  }
});

export default router;
