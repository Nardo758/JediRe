import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { CompTrafficService } from '../../services/comp-traffic.service';
import { logger } from '../../utils/logger';

const router = Router();
const pool = getPool();
const compTrafficService = new CompTrafficService(pool);

router.get('/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const dealResult = await pool.query(
      `SELECT d.trade_area_id, d.target_units, d.address
       FROM deals d WHERE d.id = $1`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found', dealId });
    }

    const deal = dealResult.rows[0];
    if (!deal.trade_area_id) {
      return res.status(200).json({
        comps: [],
        warning: 'No trade area defined for this deal. Define a trade area to see comp traffic data.',
        dealId,
      });
    }

    let subjectPropertyId = '';
    try {
      const propResult = await pool.query(
        `SELECT id FROM properties WHERE deal_id = $1 LIMIT 1`,
        [dealId]
      );
      subjectPropertyId = propResult.rows[0]?.id || '';
    } catch (_) {}

    const filters = {
      propertyType: req.query.propertyType as string | undefined,
      maxDistanceMiles: req.query.maxDistance ? parseFloat(req.query.maxDistance as string) : undefined,
      minUnits: req.query.minUnits ? parseInt(req.query.minUnits as string) : undefined,
      maxUnits: req.query.maxUnits ? parseInt(req.query.maxUnits as string) : undefined,
      minOccupancy: req.query.minOccupancy ? parseFloat(req.query.minOccupancy as string) : undefined,
      maxOccupancy: req.query.maxOccupancy ? parseFloat(req.query.maxOccupancy as string) : undefined,
      sortBy: (req.query.sortBy as string) || 'distance_miles',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'asc',
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const comps = await compTrafficService.getTradeAreaComps(
      deal.trade_area_id,
      subjectPropertyId,
      filters
    );

    res.json({
      dealId,
      trade_area_id: deal.trade_area_id,
      comps,
      count: comps.length,
      filters,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('[TrafficComps] GET /:dealId failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch comp traffic data', message: error.message });
  }
});

router.get('/:dealId/averages', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const dealResult = await pool.query(
      `SELECT trade_area_id FROM deals WHERE id = $1`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found', dealId });
    }

    const tradeAreaId = dealResult.rows[0].trade_area_id;
    if (!tradeAreaId) {
      return res.status(200).json({
        averages: null,
        warning: 'No trade area defined for this deal.',
        dealId,
      });
    }

    const averages = await compTrafficService.getCompAverages(tradeAreaId);

    res.json({
      dealId,
      trade_area_id: tradeAreaId,
      averages,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('[TrafficComps] GET /:dealId/averages failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch comp averages', message: error.message });
  }
});

router.post('/:dealId/snapshot', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const dealResult = await pool.query(
      `SELECT trade_area_id FROM deals WHERE id = $1`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found', dealId });
    }

    const tradeAreaId = dealResult.rows[0].trade_area_id;
    if (!tradeAreaId) {
      return res.status(400).json({
        error: 'No trade area defined for this deal. Cannot create snapshot.',
        dealId,
      });
    }

    const result = await compTrafficService.snapshotCompTraffic(tradeAreaId);

    res.json({
      success: true,
      dealId,
      trade_area_id: tradeAreaId,
      properties_snapshotted: result.count,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('[TrafficComps] POST /:dealId/snapshot failed', { error: error.message });
    res.status(500).json({ error: 'Failed to create comp snapshot', message: error.message });
  }
});

router.get('/:dealId/proxy-candidates', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const dealResult = await pool.query(
      `SELECT trade_area_id FROM deals WHERE id = $1`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found', dealId });
    }

    const tradeAreaId = dealResult.rows[0].trade_area_id;
    if (!tradeAreaId) {
      return res.status(200).json({
        candidates: [],
        warning: 'No trade area defined for this deal.',
        dealId,
      });
    }

    const candidates = await compTrafficService.getCompProxyCandidates(tradeAreaId);

    res.json({
      dealId,
      trade_area_id: tradeAreaId,
      candidates,
      count: candidates.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('[TrafficComps] GET /:dealId/proxy-candidates failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch proxy candidates', message: error.message });
  }
});

router.get('/:dealId/deals-with-data', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const deals = await compTrafficService.getDealsWithTrafficHistory(dealId);
    res.json({ dealId, deals, count: deals.length });
  } catch (error: any) {
    logger.error('[TrafficComps] GET /:dealId/deals-with-data failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch deals with traffic history', message: error.message });
  }
});

router.get('/:dealId/selections', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const selections = await compTrafficService.getSelectedCompDeals(dealId);
    res.json({ dealId, selections, count: selections.length });
  } catch (error: any) {
    logger.error('[TrafficComps] GET /:dealId/selections failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch selections', message: error.message });
  }
});

router.put('/:dealId/selections', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { selections } = req.body as { selections: Array<{ comp_deal_id: string; comp_deal_name?: string }> };
    if (!Array.isArray(selections)) {
      return res.status(400).json({ error: 'selections must be an array' });
    }
    await compTrafficService.setSelectedCompDeals(dealId, selections);
    const updated = await compTrafficService.getSelectedCompDeals(dealId);
    res.json({ dealId, selections: updated, count: updated.length });
  } catch (error: any) {
    logger.error('[TrafficComps] PUT /:dealId/selections failed', { error: error.message });
    res.status(500).json({ error: 'Failed to save selections', message: error.message });
  }
});

export default router;
