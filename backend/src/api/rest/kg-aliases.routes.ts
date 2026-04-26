/**
 * Knowledge Graph route aliases for the contracted public paths:
 *   GET  /api/kg/semantic-search?q=&limit=&types=
 *   POST /api/admin/kg/embeddings/backfill
 *
 * The same handlers also exist under /api/v1/knowledge-graph/* — these
 * aliases exist so external callers can rely on the documented contract
 * without depending on the internal versioned mount path.
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { requireAuth } from '../../middleware/auth';
import { getEmbeddingsService } from '../../services/neural-network/embeddings.service';

export function createKgAliasRoutes(pool: Pool): Router {
  const router = Router();
  const embeddings = getEmbeddingsService(pool);

  router.get('/kg/semantic-search', requireAuth, async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string | undefined)?.trim();
      if (!q) {
        return res.status(400).json({ success: false, error: 'q query param required' });
      }

      const rawLimit = parseInt((req.query.limit as string) || '10', 10);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 10;

      const typesParam = req.query.types as string | undefined;
      const nodeTypes = typesParam
        ? typesParam.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;

      if (!embeddings.hasKey()) {
        return res.status(503).json({
          success: false,
          error: 'OPENAI_API_KEY not configured — semantic search unavailable',
        });
      }

      const results = await embeddings.similaritySearch(q, limit, nodeTypes);

      res.json({
        success: true,
        query: q,
        limit,
        nodeTypes: nodeTypes || null,
        model: embeddings.modelInfo(),
        count: results.length,
        results,
      });
    } catch (error: any) {
      console.error('[KG-Alias] Semantic search error:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Semantic search failed',
      });
    }
  });

  router.post('/admin/kg/embeddings/backfill', async (req: Request, res: Response) => {
    try {
      const adminToken = process.env.AUTH_TOKEN;
      if (!adminToken) {
        return res.status(503).json({
          success: false,
          error: 'Admin gating not configured (AUTH_TOKEN missing) — refusing to run backfill',
        });
      }
      const provided = (req.headers['x-admin-token'] as string | undefined) ||
                       (req.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '');
      if (!provided || provided !== adminToken) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      if (!embeddings.hasKey()) {
        return res.status(503).json({ success: false, error: 'OPENAI_API_KEY not configured' });
      }

      const body = (req.body || {}) as {
        batchSize?: number;
        max?: number;
        mode?: 'missing' | 'stale' | 'all';
      };

      const mode = body.mode ?? ((req.query.mode as string | undefined) as any) ?? 'missing';

      let payload: any;
      if (mode === 'stale') {
        const stats = await embeddings.reembedStale({
          batchSize: body.batchSize,
          max: body.max,
        });
        payload = { mode, stats };
      } else if (mode === 'all') {
        const result = await embeddings.refreshAll({
          batchSize: body.batchSize,
          max: body.max,
        });
        payload = { mode, ...result };
      } else {
        const stats = await embeddings.embedAllMissing({
          batchSize: body.batchSize,
          max: body.max,
        });
        payload = { mode: 'missing', stats };
      }

      res.json({ success: true, ...payload });
    } catch (error: any) {
      console.error('[KG-Alias] Backfill error:', error);
      res.status(500).json({ success: false, error: error?.message || 'Backfill failed' });
    }
  });

  return router;
}

export default createKgAliasRoutes;
