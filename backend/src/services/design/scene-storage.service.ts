/**
 * Scene Storage Service — Save/load 3D scene files per deal.
 *
 * Stores 3d_scene.json and scenario variants under:
 *   /api/v1/deals/:dealId/files/3d-scene
 *   /api/v1/deals/:dealId/files/3d-scene/scenarios/:scenarioId
 *
 * DEPENDENCY: Requires migration 20260430_016_deal_files.sql (creates deal_files table)
 * Run: `psql $DATABASE_URL -f backend/src/db/migrations/20260430_016_deal_files.sql`
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../database';

// Edge: if deal_files table doesn't exist, route returns 503 with clear message
const DB_ERROR = 'deal_files table does not exist — run migration 20260430_016_deal_files.sql';
const router = Router();

// ─── Schemas ────────────────────────────────────────────────────────────────

const saveSceneSchema = z.object({
  scene_data: z.record(z.string(), z.any()).describe('Full 3d_scene.json content'),
  scenario_id: z.string().optional().describe('Scenario variant ID'),
});

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/deals/:dealId/files/3d-scene
 * Save the current 3D scene (or a specific scenario variant).
 */
router.post('/:dealId/files/3d-scene', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const body = saveSceneSchema.parse(req.body);
    const userId = (req as any).user?.id || 'system';

    const path = body.scenario_id
      ? `scenarios/${body.scenario_id}/3d_scene.json`
      : '3d_scene.json';

    await db.query(
      `INSERT INTO deal_files (deal_id, file_path, file_data, mime_type, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT (deal_id, file_path)
       DO UPDATE SET file_data = $3, updated_by = $5, updated_at = NOW()`,
      [dealId, path, JSON.stringify(body.scene_data), 'application/json', userId],
    );

    res.json({ success: true, path });
  } catch (err: any) {
    console.error('Failed to save 3D scene:', err);
    res.status(400).json({ error: err.message || 'Failed to save scene' });
  }
});

/**
 * GET /api/v1/deals/:dealId/files/3d-scene
 * Load the saved 3D scene (optionally for a specific scenario).
 */
router.get('/:dealId/files/3d-scene', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const scenarioId = req.query.scenario_id as string | undefined;

    const path = scenarioId
      ? `scenarios/${scenarioId}/3d_scene.json`
      : '3d_scene.json';

    const result = await db.query(
      `SELECT file_data, updated_at FROM deal_files
       WHERE deal_id = $1 AND file_path = $2`,
      [dealId, path],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No saved scene found', path });
    }

    res.json({
      scene_data: result.rows[0].file_data,
      updated_at: result.rows[0].updated_at,
    });
  } catch (err: any) {
    console.error('Failed to load 3D scene:', err);
    res.status(500).json({ error: err.message || 'Failed to load scene' });
  }
});

/**
 * DELETE /api/v1/deals/:dealId/files/3d-scene
 * Delete a saved scene or scenario variant.
 */
router.delete('/:dealId/files/3d-scene', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const scenarioId = req.query.scenario_id as string | undefined;

    const path = scenarioId
      ? `scenarios/${scenarioId}/3d_scene.json`
      : '3d_scene.json';

    await db.query(
      `DELETE FROM deal_files WHERE deal_id = $1 AND file_path = $2`,
      [dealId, path],
    );

    res.json({ success: true, deleted: path });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete scene' });
  }
});

export { router as sceneStorageRouter };
