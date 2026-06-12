/**
 * Underwriting Scenarios Routes — M40 Phase 1
 *
 * Mounted at: /api/v1/deals  (paths below include /:dealId prefix)
 *
 * Endpoints:
 *   GET    /:dealId/underwriting-scenarios              list scenarios
 *   POST   /:dealId/underwriting-scenarios              create (fork)
 *   GET    /:dealId/underwriting-scenarios/active       get active scenario
 *   GET    /:dealId/underwriting-scenarios/diff         compute field diff
 *   GET    /:dealId/underwriting-scenarios/:scenarioId  get one scenario
 *   PATCH  /:dealId/underwriting-scenarios/:scenarioId/activate
 *   PATCH  /:dealId/underwriting-scenarios/:scenarioId/meta
 *   PATCH  /:dealId/underwriting-scenarios/:scenarioId/archive
 *   PATCH  /:dealId/underwriting-scenarios/:scenarioId/restore
 *   DELETE /:dealId/underwriting-scenarios/:scenarioId
 */

import { Router, Request, Response, NextFunction } from 'express';
import { uwScenarioService } from '../../services/underwriting-scenarios.service';
import { logger } from '../../utils/logger';

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function userId(req: Request): string {
  return (req as any).user?.userId ?? (req as any).user?.id ?? '';
}

function handleError(res: Response, err: unknown, context: string): void {
  const e = err as any;
  logger.error(`[UWScenarios] ${context}`, { err: e?.message ?? String(err) });
  const status = typeof e?.statusCode === 'number' ? e.statusCode : 500;
  res.status(status).json({ success: false, error: e?.message ?? 'Internal server error' });
}

// ── List scenarios ────────────────────────────────────────────────────────────
// GET /api/v1/deals/:dealId/underwriting-scenarios
// Query params: status=active|archived, created_by=agent|user

router.get('/:dealId/underwriting-scenarios', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const status   = req.query.status   as 'active' | 'archived' | undefined;
    const createdBy = req.query.created_by as 'agent' | 'user' | undefined;

    const scenarios = await uwScenarioService.listScenarios(dealId, { status, created_by: createdBy });
    res.json({ success: true, data: { scenarios, count: scenarios.length } });
  } catch (err) {
    handleError(res, err, 'listScenarios');
  }
});

// ── Get active scenario ───────────────────────────────────────────────────────
// GET /api/v1/deals/:dealId/underwriting-scenarios/active
// MUST be registered before /:scenarioId to avoid "active" matching as a UUID

router.get('/:dealId/underwriting-scenarios/active', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const scenario = await uwScenarioService.getActiveScenario(dealId);
    if (!scenario) {
      return res.status(404).json({ success: false, error: 'No active scenario found for this deal' });
    }
    res.json({ success: true, data: { scenario } });
  } catch (err) {
    handleError(res, err, 'getActiveScenario');
  }
});

// ── Diff two scenarios ────────────────────────────────────────────────────────
// GET /api/v1/deals/:dealId/underwriting-scenarios/diff?a=<uuid>&b=<uuid>

router.get('/:dealId/underwriting-scenarios/diff', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const a = req.query.a as string | undefined;
    const b = req.query.b as string | undefined;

    if (!a || !b) {
      return res.status(400).json({ success: false, error: 'Query params a and b (scenario IDs) are required' });
    }

    const diff = await uwScenarioService.computeDiff(dealId, a, b);
    res.json({ success: true, data: { diff } });
  } catch (err) {
    handleError(res, err, 'computeDiff');
  }
});

// ── Create scenario (fork) ────────────────────────────────────────────────────
// POST /api/v1/deals/:dealId/underwriting-scenarios
// Body: { name, description?, tags?, source_scenario_id? }

router.post('/:dealId/underwriting-scenarios', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const uid = userId(req);
    const { name, description, tags, source_scenario_id } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }

    const scenario = await uwScenarioService.createScenario(dealId, uid, {
      name: name.trim(),
      description: description ?? null,
      tags: tags ?? null,
      source_scenario_id: source_scenario_id ?? null,
    });

    res.status(201).json({ success: true, data: { scenario } });
  } catch (err) {
    handleError(res, err, 'createScenario');
  }
});

// ── Get one scenario ──────────────────────────────────────────────────────────
// GET /api/v1/deals/:dealId/underwriting-scenarios/:scenarioId

router.get('/:dealId/underwriting-scenarios/:scenarioId', async (req: Request, res: Response) => {
  try {
    const { dealId, scenarioId } = req.params;
    const scenario = await uwScenarioService.getScenario(dealId, scenarioId);
    if (!scenario) {
      return res.status(404).json({ success: false, error: 'Scenario not found' });
    }
    res.json({ success: true, data: { scenario } });
  } catch (err) {
    handleError(res, err, 'getScenario');
  }
});

// ── Activate a scenario ───────────────────────────────────────────────────────
// PATCH /api/v1/deals/:dealId/underwriting-scenarios/:scenarioId/activate

router.patch('/:dealId/underwriting-scenarios/:scenarioId/activate', async (req: Request, res: Response) => {
  try {
    const { dealId, scenarioId } = req.params;
    const uid = userId(req);
    const scenario = await uwScenarioService.activateScenario(dealId, scenarioId, uid);
    res.json({ success: true, data: { scenario } });
  } catch (err) {
    handleError(res, err, 'activateScenario');
  }
});

// ── Update scenario metadata ──────────────────────────────────────────────────
// PATCH /api/v1/deals/:dealId/underwriting-scenarios/:scenarioId/meta
// Body: { name?, description?, tags?, notes? }

router.patch('/:dealId/underwriting-scenarios/:scenarioId/meta', async (req: Request, res: Response) => {
  try {
    const { dealId, scenarioId } = req.params;
    const { name, description, tags, notes } = req.body;
    const scenario = await uwScenarioService.updateMeta(dealId, scenarioId, {
      name, description, tags, notes,
    });
    res.json({ success: true, data: { scenario } });
  } catch (err) {
    handleError(res, err, 'updateMeta');
  }
});

// ── Archive a scenario ────────────────────────────────────────────────────────
// PATCH /api/v1/deals/:dealId/underwriting-scenarios/:scenarioId/archive

router.patch('/:dealId/underwriting-scenarios/:scenarioId/archive', async (req: Request, res: Response) => {
  try {
    const { dealId, scenarioId } = req.params;
    const scenario = await uwScenarioService.archiveScenario(dealId, scenarioId);
    res.json({ success: true, data: { scenario } });
  } catch (err) {
    handleError(res, err, 'archiveScenario');
  }
});

// ── Restore an archived scenario ──────────────────────────────────────────────
// PATCH /api/v1/deals/:dealId/underwriting-scenarios/:scenarioId/restore

router.patch('/:dealId/underwriting-scenarios/:scenarioId/restore', async (req: Request, res: Response) => {
  try {
    const { dealId, scenarioId } = req.params;
    const scenario = await uwScenarioService.restoreScenario(dealId, scenarioId);
    res.json({ success: true, data: { scenario } });
  } catch (err) {
    handleError(res, err, 'restoreScenario');
  }
});

// ── Soft-delete a scenario ────────────────────────────────────────────────────
// DELETE /api/v1/deals/:dealId/underwriting-scenarios/:scenarioId

router.delete('/:dealId/underwriting-scenarios/:scenarioId', async (req: Request, res: Response) => {
  try {
    const { dealId, scenarioId } = req.params;
    await uwScenarioService.deleteScenario(dealId, scenarioId);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    handleError(res, err, 'deleteScenario');
  }
});

// ── M40 Phase 4 — Update CIE findings ──────────────────────────────────────────
// PATCH /api/v1/deals/:dealId/underwriting-scenarios/:scenarioId/cie-findings
// Body: { findings: CompetitiveIntelligenceFinding[] }

router.patch('/:dealId/underwriting-scenarios/:scenarioId/cie-findings', async (req: Request, res: Response) => {
  try {
    const { dealId, scenarioId } = req.params;
    const { findings } = req.body;
    if (!Array.isArray(findings)) {
      return res.status(400).json({ success: false, error: 'findings must be an array' });
    }
    const scenario = await uwScenarioService.updateCieFindings(dealId, scenarioId, findings);
    res.json({ success: true, data: { scenario } });
  } catch (err) {
    handleError(res, err, 'updateCieFindings');
  }
});

export default router;
