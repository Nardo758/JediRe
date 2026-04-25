/**
 * Capsule Intelligence Routes
 *
 * Endpoints to query and re-seed capsule intelligence.
 * Lets the frontend show what was auto-populated vs. what needs manual input.
 */

import { Router, Request, Response } from 'express';
import { getCapsuleIntelligence } from '../../services/capsule-intelligence.service';
import { getPool } from '../../database/connection';

const router = Router();

/**
 * GET /capsules/:id/intelligence
 * Get current intelligence snapshot for a capsule
 */
router.get('/:id/intelligence', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `SELECT platform_intel->>'intelligence' as intelligence
       FROM deal_capsules WHERE id = $1`,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Capsule not found' });
    }

    const intelligence = result.rows[0].intelligence
      ? JSON.parse(result.rows[0].intelligence)
      : null;

    res.json({ success: true, intelligence, hasIntelligence: !!intelligence });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /capsules/:id/intelligence/refresh
 * Re-seed intelligence for a capsule (e.g., after uploading new Data Library docs)
 */
router.post('/:id/intelligence/refresh', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    // Get capsule details
    const capsuleResult = await pool.query(
      `SELECT property_address, deal_data FROM deal_capsules WHERE id = $1`,
      [id]
    );

    if (!capsuleResult.rows[0]) {
      return res.status(404).json({ error: 'Capsule not found' });
    }

    const capsule = capsuleResult.rows[0];
    const dealData = capsule.deal_data || {};

    const intelligence = await getCapsuleIntelligence().seedCapsule({
      capsuleId: id,
      propertyAddress: capsule.property_address,
      city: dealData.city || req.body.city,
      state: dealData.state || req.body.state,
      propertyType: dealData.property_type || 'multifamily',
      units: dealData.units || req.body.units,
    });

    res.json({ success: true, intelligence });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /capsules/:id/intelligence/gaps
 * Get just the gaps and recommendations for a capsule
 */
router.get('/:id/intelligence/gaps', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `SELECT 
         platform_intel->'intelligence'->>'gaps' as gaps,
         platform_intel->'intelligence'->>'recommendations' as recommendations,
         platform_intel->'intelligence'->>'dataQualityScore' as quality_score
       FROM deal_capsules WHERE id = $1`,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Capsule not found' });
    }

    res.json({
      success: true,
      gaps: JSON.parse(result.rows[0].gaps || '[]'),
      recommendations: JSON.parse(result.rows[0].recommendations || '[]'),
      dataQualityScore: parseInt(result.rows[0].quality_score || '0'),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
