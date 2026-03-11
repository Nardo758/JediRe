import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { getPool } from '../../database/connection';
import { autoDiscoverComps, discoverTieredComps } from '../../services/comp-set-discovery.service';
import { logger } from '../../utils/logger';

const router = Router();

router.get('/:dealId/comp-set', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;

    const result = await pool.query(`
      SELECT 
        cs.*,
        d.name as deal_name
      FROM deal_comp_sets cs
      JOIN deals d ON d.id = cs.deal_id
      WHERE cs.deal_id = $1 AND cs.status = 'active'
      ORDER BY cs.match_score DESC NULLS LAST, cs.distance_miles ASC NULLS LAST
    `, [dealId]);

    res.json({
      success: true,
      comps: result.rows,
      total: result.rows.length,
    });
  } catch (error: any) {
    logger.error('Failed to fetch comp set', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch comp set' });
  }
});

router.post('/:dealId/comp-set/discover', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const { radiusMiles, maxComps } = req.body || {};

    const inserted = await autoDiscoverComps(dealId, {
      radiusMiles: radiusMiles || 3,
      maxComps: maxComps || 15,
    });

    const pool = getPool();
    const result = await pool.query(`
      SELECT * FROM deal_comp_sets 
      WHERE deal_id = $1 AND status = 'active'
      ORDER BY match_score DESC NULLS LAST
    `, [dealId]);

    res.json({
      success: true,
      discovered: inserted,
      comps: result.rows,
      total: result.rows.length,
    });
  } catch (error: any) {
    logger.error('Comp discovery failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Comp discovery failed' });
  }
});

router.post('/:dealId/comp-set', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const {
      address, name, units, year_built, stories, class_code,
      avg_rent, occupancy, google_rating, google_review_count, notes
    } = req.body;

    if (!address) {
      return res.status(400).json({ success: false, error: 'Address is required' });
    }

    const result = await pool.query(`
      INSERT INTO deal_comp_sets (
        deal_id, comp_property_address, comp_name, source, status,
        units, year_built, stories, class_code,
        avg_rent, occupancy, google_rating, google_review_count, notes
      ) VALUES ($1, $2, $3, 'manual', 'active', $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (deal_id, comp_property_address) DO UPDATE SET
        status = 'active',
        comp_name = COALESCE(EXCLUDED.comp_name, deal_comp_sets.comp_name),
        units = COALESCE(EXCLUDED.units, deal_comp_sets.units),
        year_built = COALESCE(EXCLUDED.year_built, deal_comp_sets.year_built),
        stories = COALESCE(EXCLUDED.stories, deal_comp_sets.stories),
        class_code = COALESCE(EXCLUDED.class_code, deal_comp_sets.class_code),
        avg_rent = COALESCE(EXCLUDED.avg_rent, deal_comp_sets.avg_rent),
        occupancy = COALESCE(EXCLUDED.occupancy, deal_comp_sets.occupancy),
        google_rating = COALESCE(EXCLUDED.google_rating, deal_comp_sets.google_rating),
        google_review_count = COALESCE(EXCLUDED.google_review_count, deal_comp_sets.google_review_count),
        notes = COALESCE(EXCLUDED.notes, deal_comp_sets.notes),
        source = 'manual',
        updated_at = NOW()
      RETURNING *
    `, [
      dealId, address, name || address,
      units || null, year_built || null, stories || null, class_code || null,
      avg_rent || null, occupancy || null,
      google_rating || null, google_review_count || null, notes || null
    ]);

    res.status(201).json({
      success: true,
      comp: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Failed to add comp', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to add comp' });
  }
});

router.get('/:dealId/comp-set/discover-tiered', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const radiusMiles = Math.min(Math.max(parseFloat(req.query.radiusMiles as string) || 3, 0.5), 50);

    const result = await discoverTieredComps(dealId, radiusMiles);

    res.json({
      success: true,
      ...result,
      totals: {
        trade_area: result.trade_area.length,
        submarket: result.submarket.length,
        msa: result.msa.length,
      },
    });
  } catch (error: any) {
    logger.error('Tiered comp discovery failed', { error: error.message });
    if (error.message === 'Deal not found') {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    if (error.message === 'Deal has no boundary for comp discovery') {
      return res.status(422).json({ success: false, error: 'Deal has no geocoded boundary — cannot discover comps' });
    }
    res.status(500).json({ success: false, error: 'Tiered comp discovery failed' });
  }
});

router.post('/:dealId/comp-set/add-to-set', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const { dealId } = req.params;
    const { address, name, units, year_built, stories, class_code, distance_miles, match_score, geographic_tier } = req.body;

    if (!address) {
      return res.status(400).json({ success: false, error: 'Address is required' });
    }

    const validTiers = ['trade_area', 'submarket', 'msa'];
    if (geographic_tier && !validTiers.includes(geographic_tier)) {
      return res.status(400).json({ success: false, error: 'Invalid geographic_tier. Must be trade_area, submarket, or msa' });
    }

    const result = await pool.query(`
      INSERT INTO deal_comp_sets (
        deal_id, comp_property_address, comp_name, source, status,
        units, year_built, stories, class_code,
        distance_miles, match_score, geographic_tier
      ) VALUES ($1, $2, $3, 'manual', 'active', $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (deal_id, comp_property_address) DO UPDATE SET
        status = 'active',
        comp_name = COALESCE(EXCLUDED.comp_name, deal_comp_sets.comp_name),
        units = COALESCE(EXCLUDED.units, deal_comp_sets.units),
        year_built = COALESCE(EXCLUDED.year_built, deal_comp_sets.year_built),
        stories = COALESCE(EXCLUDED.stories, deal_comp_sets.stories),
        class_code = COALESCE(EXCLUDED.class_code, deal_comp_sets.class_code),
        distance_miles = COALESCE(EXCLUDED.distance_miles, deal_comp_sets.distance_miles),
        match_score = COALESCE(EXCLUDED.match_score, deal_comp_sets.match_score),
        geographic_tier = COALESCE(EXCLUDED.geographic_tier, deal_comp_sets.geographic_tier),
        source = 'manual',
        updated_at = NOW()
      RETURNING *
    `, [
      dealId, address, name || address,
      units || null, year_built || null, stories || null, class_code || null,
      distance_miles || null, match_score || null, geographic_tier || 'trade_area'
    ]);

    res.status(201).json({
      success: true,
      comp: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Failed to add comp to set', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to add comp to set' });
  }
});

router.delete('/:dealId/comp-set/:compId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const { dealId, compId } = req.params;

    const result = await pool.query(`
      UPDATE deal_comp_sets 
      SET status = 'removed', updated_at = NOW()
      WHERE id = $1 AND deal_id = $2
    `, [compId, dealId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Comp not found in this deal' });
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to remove comp', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to remove comp' });
  }
});

router.patch('/:dealId/comp-set/:compId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool();
    const { dealId, compId } = req.params;
    const { notes, avg_rent, occupancy, google_rating, google_review_count, units, year_built, stories, class_code } = req.body;

    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let idx = 1;

    const fields: Record<string, any> = {
      notes, avg_rent, occupancy, google_rating, google_review_count,
      units, year_built, stories, class_code
    };

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        setClauses.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (values.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(compId, dealId);
    const result = await pool.query(`
      UPDATE deal_comp_sets 
      SET ${setClauses.join(', ')}
      WHERE id = $${idx} AND deal_id = $${idx + 1}
      RETURNING *
    `, values);

    res.json({
      success: true,
      comp: result.rows[0] || null,
    });
  } catch (error: any) {
    logger.error('Failed to update comp', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to update comp' });
  }
});

export default router;
