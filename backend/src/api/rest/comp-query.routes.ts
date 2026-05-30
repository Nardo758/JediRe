import { Router, Request, Response } from 'express';
import { compQueryService } from '../../services/comp-query.service';
import {
  searchComps as searchCompsV2,
  getRentComps,
  getSubmarketStats,
} from '../../services/compQueryEngine';
import { query } from '../../database/connection';

const router = Router();

router.post('/search', async (req: Request, res: Response) => {
  try {
    const results = await compQueryService.searchComps(req.body);
    res.json({ success: true, data: results, count: results.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/search/v2', async (req: Request, res: Response) => {
  try {
    const response = await searchCompsV2(req.body);
    res.json({ success: true, ...response });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/property/:propertyId', async (req: Request, res: Response) => {
  try {
    const results = await compQueryService.findCompsForProperty(req.params.propertyId);
    res.json({ success: true, data: results, count: results.length });
  } catch (err: any) {
    if (err.message && err.message.toLowerCase().includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/property/:propertyId/rent-comps', async (req: Request, res: Response) => {
  try {
    const radiusMiles = req.query.radius ? parseFloat(req.query.radius as string) : 3.0;
    const result = await getRentComps(req.params.propertyId, radiusMiles);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/submarket/:submarketId/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getSubmarketStats(req.params.submarketId);
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await compQueryService.getCompSummary();
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/comps/property/:propertyId/market-comps
 *
 * Returns deal-scoped CoStar comps + platform comps for a property's submarket.
 * Used by the F3 COMPS tab in PropertyCardPage to show real data alongside
 * platform fallback rows.
 *
 * Response shape:
 *   { propertyId, dealId, submarket, hasDealComps,
 *     rentComps: { deal[], platform[], total },
 *     saleComps: { deal[], platform[], total } }
 *
 * Comp rows include a `source` field ('costar_upload' | platform source string)
 * so the frontend can render source badges per row.
 */
router.get('/property/:propertyId/market-comps', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;

    const propResult = await query(
      `SELECT p.city, p.state_code, p.msa_id, s.name AS submarket
       FROM properties p
       LEFT JOIN submarkets s ON s.id::text = p.submarket_id::text
       WHERE p.id::text = $1 LIMIT 1`,
      [propertyId]
    );
    if (propResult.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }
    const prop = propResult.rows[0] as Record<string, unknown>;
    const submarket = (prop.submarket as string) || '';
    const city = (prop.city as string) || '';

    const dealResult = await query(
      'SELECT deal_id FROM deal_properties WHERE property_id = $1 ORDER BY created_at DESC LIMIT 1',
      [propertyId]
    );
    const dealId: string | null = (dealResult.rows[0]?.deal_id as string) ?? null;

    let dealRentComps: unknown[] = [];
    let dealSaleComps: unknown[] = [];

    if (dealId) {
      const drResult = await query(
        `SELECT property_name, address, units, avg_asking_rent, avg_effective_rent,
                occupancy_pct, asset_class, year_built, concession_pct, submarket,
                source, snapshot_date, data_as_of
         FROM market_rent_comps WHERE deal_id = $1
         ORDER BY avg_asking_rent DESC NULLS LAST`,
        [dealId]
      );
      dealRentComps = drResult.rows;

      const dsResult = await query(
        `SELECT property_name, address, units, sale_price, price_per_unit, cap_rate,
                sale_date, submarket, source, asset_class, year_built
         FROM market_sale_comps WHERE deal_id = $1 AND (units >= 4 OR units IS NULL)
         ORDER BY sale_date DESC`,
        [dealId]
      );
      dealSaleComps = dsResult.rows;
    }

    const subPct = submarket ? `%${submarket}%` : null;
    const cityPct = city ? `%${city}%` : null;

    let platformRentComps: unknown[] = [];
    let platformSaleComps: unknown[] = [];

    if (subPct || cityPct) {
      const prResult = await query(
        `SELECT property_name, address, units, avg_asking_rent, avg_effective_rent,
                occupancy_pct, asset_class, year_built, concession_pct, submarket,
                source, snapshot_date, data_as_of
         FROM market_rent_comps
         WHERE deal_id IS NULL
           AND (
             ($1::text IS NOT NULL AND submarket ILIKE $1::text)
             OR ($2::text IS NOT NULL AND city ILIKE $2::text)
           )
         ORDER BY snapshot_date DESC NULLS LAST, avg_asking_rent DESC NULLS LAST
         LIMIT 25`,
        [subPct, cityPct]
      );
      platformRentComps = prResult.rows;

      const psResult = await query(
        `SELECT property_name, address, units, sale_price, price_per_unit, cap_rate,
                sale_date, submarket, source, asset_class, year_built
         FROM market_sale_comps
         WHERE deal_id IS NULL
           AND units >= 4
           AND (
             ($1::text IS NOT NULL AND submarket ILIKE $1::text)
             OR ($2::text IS NOT NULL AND city ILIKE $2::text)
           )
         ORDER BY sale_date DESC
         LIMIT 20`,
        [subPct, cityPct]
      );
      platformSaleComps = psResult.rows;
    }

    return res.json({
      propertyId,
      dealId,
      submarket,
      hasDealComps: dealRentComps.length > 0 || dealSaleComps.length > 0,
      rentComps: {
        deal: dealRentComps,
        platform: platformRentComps,
        total: dealRentComps.length + platformRentComps.length,
      },
      saleComps: {
        deal: dealSaleComps,
        platform: platformSaleComps,
        total: dealSaleComps.length + platformSaleComps.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
