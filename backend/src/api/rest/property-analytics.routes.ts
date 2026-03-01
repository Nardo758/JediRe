import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { PropertyAnalyticsService } from '../../services/property-analytics.service';
import { logger } from '../../utils/logger';

const router = Router();
const pool = getPool();
const analyticsService = new PropertyAnalyticsService(pool);

router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { propertyId, domain } = req.body;
    if (!propertyId || !domain) {
      return res.status(400).json({ error: 'propertyId and domain are required' });
    }
    const connection = await analyticsService.connectPropertyDomain(propertyId, domain);
    res.json({ success: true, connection });
  } catch (error: any) {
    logger.error('[PropertyAnalytics] Connect failed', { error: error.message });
    res.status(500).json({ error: 'Failed to connect domain', message: error.message });
  }
});

router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const { propertyId, domain } = req.body;
    if (!propertyId || !domain) {
      return res.status(400).json({ error: 'propertyId and domain are required' });
    }
    await analyticsService.disconnectPropertyDomain(propertyId, domain);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('[PropertyAnalytics] Disconnect failed', { error: error.message });
    res.status(500).json({ error: 'Failed to disconnect domain', message: error.message });
  }
});

router.get('/connection/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const connection = await analyticsService.getDomainConnection(propertyId);
    res.json({
      connected: !!connection,
      domain: connection?.ga_property_id || null,
      connection,
    });
  } catch (error: any) {
    logger.error('[PropertyAnalytics] Connection check failed', { error: error.message });
    res.status(500).json({ error: 'Failed to check connection', message: error.message });
  }
});

router.get('/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const { start, end } = req.query;
    const dateRange = start && end ? { start: start as string, end: end as string } : undefined;

    let metrics = await analyticsService.fetchPropertyWebTraffic(propertyId, dateRange);

    if (!metrics) {
      const stored = await analyticsService.getStoredAnalytics(propertyId, 1);
      if (stored.length > 0) {
        const row = stored[0];
        const db = row.device_breakdown || {};
        metrics = {
          sessions: row.sessions,
          users: row.users,
          new_users: row.new_users,
          pageviews: row.pageviews,
          avg_session_duration: parseFloat(row.avg_session_duration) || 0,
          bounce_rate: 0,
          traffic_sources: {
            organic: row.organic_sessions || 0,
            paid: row.paid_sessions || 0,
            direct: row.direct_sessions || 0,
            referral: row.referral_sessions || 0,
            social: row.social_sessions || 0,
          },
          device_breakdown: row.device_breakdown || {},
          top_landing_pages: row.top_landing_pages || [],
          period_start: row.period_start,
          period_end: row.period_end,
          is_comp_proxy: row.is_comp_proxy,
          proxy_source_properties: row.proxy_source_properties,
          organic_value: db.organic_value || 0,
          organic_keywords: db.organic_keywords || 0,
          paid_keywords: db.paid_keywords || 0,
          domain_strength: db.domain_strength || 0,
        };
      }
    }

    const score = await analyticsService.getWebTrafficScore(propertyId);

    res.json({
      property_id: propertyId,
      metrics,
      score,
      has_data: !!metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('[PropertyAnalytics] Fetch analytics failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch analytics', message: error.message });
  }
});

router.get('/:propertyId/history', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const limit = parseInt(req.query.limit as string) || 12;
    const history = await analyticsService.getStoredAnalytics(propertyId, limit);
    res.json({ property_id: propertyId, count: history.length, history });
  } catch (error: any) {
    logger.error('[PropertyAnalytics] History fetch failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch history', message: error.message });
  }
});

router.get('/:propertyId/score', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const score = await analyticsService.getWebTrafficScore(propertyId);
    res.json({ property_id: propertyId, ...score });
  } catch (error: any) {
    logger.error('[PropertyAnalytics] Score fetch failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch score', message: error.message });
  }
});

router.post('/:propertyId/comp-proxy', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const { tradeAreaId } = req.body;
    if (!tradeAreaId) {
      return res.status(400).json({
        error: 'tradeAreaId is required',
        hint: 'Define a trade area to unlock comp proxy traffic data',
      });
    }
    const metrics = await analyticsService.getCompProxyTraffic(propertyId, tradeAreaId);
    if (!metrics) {
      return res.json({
        property_id: propertyId,
        metrics: null,
        message: 'No comparable properties with website data found in trade area',
      });
    }
    res.json({ property_id: propertyId, metrics, comp_count: metrics.proxy_source_properties?.length || 0 });
  } catch (error: any) {
    logger.error('[PropertyAnalytics] Comp proxy failed', { error: error.message });
    res.status(500).json({ error: 'Failed to generate comp proxy', message: error.message });
  }
});

router.post('/sync', async (req: Request, res: Response) => {
  try {
    const result = await analyticsService.syncAllPropertyAnalytics();
    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('[PropertyAnalytics] Sync failed', { error: error.message });
    res.status(500).json({ error: 'Failed to sync analytics', message: error.message });
  }
});

export default router;
