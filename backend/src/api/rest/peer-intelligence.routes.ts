import { Router, Request, Response } from 'express';
import { peerIntelligenceService, type SubmarketCharacter, type UseCase } from '../../services/sigma/peer-intelligence';
import { persistCharacter, persistCharacters } from '../../services/sigma/peer-characters-seed';
import { getPool } from '../../database/connection';

const router = Router();

/**
 * GET /api/v1/peers/:subjectSubmarketId
 * Default dual ranking view.
 */
router.get('/:subjectSubmarketId', (req: Request, res: Response) => {
  try {
    const { subjectSubmarketId } = req.params;
    const { asset_class, top_n } = req.query as Record<string, string>;

    // Check cache first
    const assetClass = asset_class ?? 'multifamily';
    const cached = peerIntelligenceService.getCachedRanking(subjectSubmarketId, assetClass);
    if (cached) {
      return res.json({
        success: true,
        data: {
          subjectSubmarketId,
          assetClass,
          ...cached,
          computedAt: new Date(),
          cached: true,
        },
      });
    }

    const topN = top_n ? parseInt(top_n, 10) : 5;
    const ranking = peerIntelligenceService.computeDualRanking(subjectSubmarketId, assetClass, topN);
    peerIntelligenceService.cacheRanking(subjectSubmarketId, assetClass, ranking);

    return res.json({ success: true, data: { ...ranking, cached: false } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Dual ranking error' });
  }
});

/**
 * GET /api/v1/peers/:subjectSubmarketId/competitors
 * Competitor ranking only.
 */
router.get('/:subjectSubmarketId/competitors', (req: Request, res: Response) => {
  try {
    const { subjectSubmarketId } = req.params;
    const { asset_class, top_n } = req.query as Record<string, string>;
    const ranking = peerIntelligenceService.computeDualRanking(
      subjectSubmarketId, asset_class ?? 'multifamily', top_n ? parseInt(top_n, 10) : 5,
    );
    return res.json({ success: true, data: ranking.competitors });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Competitors error' });
  }
});

/**
 * GET /api/v1/peers/:subjectSubmarketId/analogs
 * Analog ranking only.
 */
router.get('/:subjectSubmarketId/analogs', (req: Request, res: Response) => {
  try {
    const { subjectSubmarketId } = req.params;
    const { asset_class, top_n } = req.query as Record<string, string>;
    const ranking = peerIntelligenceService.computeDualRanking(
      subjectSubmarketId, asset_class ?? 'multifamily', top_n ? parseInt(top_n, 10) : 5,
    );
    return res.json({ success: true, data: ranking.analogs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Analogs error' });
  }
});

/**
 * GET /api/v1/peers/:subjectSubmarketId/combined
 * Combined ranking for use case.
 */
router.get('/:subjectSubmarketId/combined', (req: Request, res: Response) => {
  try {
    const { subjectSubmarketId } = req.params;
    const { use_case, asset_class, top_n } = req.query as Record<string, string>;
    const useCase: UseCase = (use_case as UseCase) ?? 'default';
    const ranking = peerIntelligenceService.computeCombinedRanking(
      subjectSubmarketId, asset_class ?? 'multifamily', useCase, top_n ? parseInt(top_n, 10) : 5,
    );
    return res.json({ success: true, data: ranking });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Combined error' });
  }
});

/**
 * POST /api/v1/peers/characters
 * Register submarket character vectors (in-memory + DB persist).
 */
router.post('/characters', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const pool = getPool();
    if (Array.isArray(body)) {
      peerIntelligenceService.bulkRegisterCharacters(body as SubmarketCharacter[]);
      // Persist to DB (non-fatal if table not yet created)
      persistCharacters(pool, body as SubmarketCharacter[]).catch(err => {
        console.warn('[M39] Failed to persist bulk characters to DB:', err?.message);
      });
      return res.json({ success: true, data: { count: body.length } });
    }
    peerIntelligenceService.registerCharacter(body as SubmarketCharacter);
    persistCharacter(pool, body as SubmarketCharacter).catch(err => {
      console.warn('[M39] Failed to persist character to DB:', err?.message);
    });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Character error' });
  }
});

/**
 * GET /api/v1/peers/characters/:submarketId
 * Get character vector.
 */
router.get('/characters/:submarketId', (req: Request, res: Response) => {
  try {
    const character = peerIntelligenceService.getCharacter(req.params.submarketId);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });
    return res.json({ success: true, data: character });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Character error' });
  }
});

/**
 * POST /api/v1/peers/cache/invalidate
 * Invalidate ranking cache.
 */
router.post('/cache/invalidate', (req: Request, res: Response) => {
  try {
    const { subjectSubmarketId } = req.body as { subjectSubmarketId?: string };
    peerIntelligenceService.invalidateCache(subjectSubmarketId);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Cache invalidation error' });
  }
});

/**
 * GET /api/v1/peers/stats
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = peerIntelligenceService.getStats();
    return res.json({ success: true, data: stats });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message ?? 'Stats error' });
  }
});

export default router;
