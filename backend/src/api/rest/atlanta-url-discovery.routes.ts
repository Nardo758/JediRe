import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { query } from '../../database/connection';
import { AtlantaUrlDiscoveryService } from '../../services/atlanta-url-discovery.service';

const router = Router();

const requireAdminAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string
    || req.query.api_key as string
    || (req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.slice(7));

  const configuredKey = process.env.API_KEY_ADMIN;
  if (configuredKey && apiKey === configuredKey) {
    req.user = { userId: 'admin-api-key', email: 'admin@api', role: 'admin' };
    return next();
  }

  requireAuth(req, res, (err?: any) => {
    if (err) return next(err);
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};

router.get('/', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const service = new AtlantaUrlDiscoveryService();

    const dryRun = req.query.dry_run === 'true';

    if (dryRun) {
      const summary = await service.getSummary();
      return res.json({
        status: 'dry_run',
        message: 'Summary of Atlanta property assessor URL coverage (no changes made)',
        summary,
      });
    }

    logger.info('[AtlantaUrlDiscovery] Pipeline triggered via admin endpoint');
    const stats = await service.discoverUrls();

    let status = 'completed';
    if (stats.errors.length > 0 && stats.urlsDiscovered === 0) {
      status = 'failed';
    } else if (stats.errors.length > 0) {
      status = 'partial_failure';
    }

    const httpStatus = status === 'failed' ? 500 : 200;

    return res.status(httpStatus).json({
      status,
      message: `Discovered ${stats.urlsDiscovered} assessor URLs for Atlanta properties` +
        (stats.urlsFailed > 0 ? ` (${stats.urlsFailed} failed)` : ''),
      stats,
    });
  } catch (err) {
    logger.error(`[AtlantaUrlDiscovery] Pipeline error: ${(err as Error).message}`);
    return res.status(500).json({
      status: 'error',
      message: (err as Error).message,
    });
  }
});

router.get('/summary', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const service = new AtlantaUrlDiscoveryService();
    const summary = await service.getSummary();

    return res.json({
      status: 'ok',
      summary,
    });
  } catch (err) {
    logger.error(`[AtlantaUrlDiscovery] Summary error: ${(err as Error).message}`);
    return res.status(500).json({
      status: 'error',
      message: (err as Error).message,
    });
  }
});

router.get('/properties', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;
    const hasUrl = req.query.has_url as string;

    let urlFilter = '';
    if (hasUrl === 'true') urlFilter = 'AND assessor_url IS NOT NULL';
    else if (hasUrl === 'false') urlFilter = 'AND assessor_url IS NULL';

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM (
        SELECT id FROM properties
        WHERE (UPPER(city) IN ('ATLANTA') OR UPPER(county) IN ('FULTON', 'DEKALB', 'FULTON COUNTY', 'DEKALB COUNTY'))
          AND state_code = 'GA' ${urlFilter}
        UNION ALL
        SELECT id FROM property_records
        WHERE (UPPER(city) IN ('ATLANTA') OR UPPER(county) IN ('FULTON', 'DEKALB', 'FULTON COUNTY', 'DEKALB COUNTY'))
          AND UPPER(state) = 'GA' ${urlFilter}
      ) combined`
    );

    const result = await query(
      `SELECT id, name, address_line1 AS address, city, county, state_code AS state, assessor_url, 'properties' AS source
       FROM properties
       WHERE (UPPER(city) IN ('ATLANTA') OR UPPER(county) IN ('FULTON', 'DEKALB', 'FULTON COUNTY', 'DEKALB COUNTY'))
         AND state_code = 'GA' ${urlFilter}
       UNION ALL
       SELECT id::text, NULL AS name, address, city, county, state, assessor_url, 'property_records' AS source
       FROM property_records
       WHERE (UPPER(city) IN ('ATLANTA') OR UPPER(county) IN ('FULTON', 'DEKALB', 'FULTON COUNTY', 'DEKALB COUNTY'))
         AND UPPER(state) = 'GA' ${urlFilter}
       ORDER BY address
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return res.json({
      properties: result.rows,
      total: parseInt(countResult.rows[0]?.total || '0'),
      page,
      limit,
    });
  } catch (err) {
    logger.error(`[AtlantaUrlDiscovery] Properties list error: ${(err as Error).message}`);
    return res.status(500).json({ status: 'error', message: (err as Error).message });
  }
});

export default router;
