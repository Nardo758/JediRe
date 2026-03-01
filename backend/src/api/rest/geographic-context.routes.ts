import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { logger } from '../../utils/logger';
import { getPool } from '../../database/connection';

const router = Router();
const pool = getPool();

router.post('/:id/geographic-context', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: dealId } = req.params;
    const { trade_area_id, submarket_id, msa_id, active_scope } = req.body;

    if (!trade_area_id && !submarket_id && !msa_id && !active_scope) {
      return res.status(400).json({
        success: false,
        message: 'At least one of trade_area_id, submarket_id, msa_id, or active_scope is required',
      });
    }

    if (trade_area_id) {
      await pool.query(
        `UPDATE deals SET trade_area_id = $2 WHERE id = $1`,
        [dealId, trade_area_id]
      );
    }

    if (submarket_id || msa_id) {
      try {
        await pool.query(
          `INSERT INTO geographic_relationships (trade_area_id, submarket_id, msa_id, is_primary, created_at)
           VALUES ($1, $2, $3, true, NOW())
           ON CONFLICT DO NOTHING`,
          [trade_area_id || null, submarket_id || null, msa_id || null]
        );
      } catch { }
    }

    await pool.query(
      `UPDATE deals SET deal_data = COALESCE(deal_data, '{}'::jsonb) || $2::jsonb WHERE id = $1`,
      [dealId, JSON.stringify({
        geographic_context: {
          trade_area_id: trade_area_id || null,
          submarket_id: submarket_id || null,
          msa_id: msa_id || null,
          active_scope: active_scope || (trade_area_id ? 'trade_area' : 'submarket'),
        }
      })]
    );

    logger.info(`Geographic context set for deal ${dealId}`, { trade_area_id, submarket_id, msa_id });

    res.status(201).json({
      success: true,
      data: {
        deal_id: dealId,
        trade_area_id: trade_area_id || null,
        submarket_id: submarket_id || null,
        msa_id: msa_id || null,
        active_scope: active_scope || (trade_area_id ? 'trade_area' : 'submarket'),
      },
      message: 'Geographic context created successfully',
    });
  } catch (error) {
    logger.error('Error setting geographic context:', error);
    next(error);
  }
});

router.get('/:id/geographic-context', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: dealId } = req.params;

    const dealResult = await pool.query(
      `SELECT d.trade_area_id, d.deal_data
       FROM deals d WHERE d.id = $1`,
      [dealId]
    );

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    const deal = dealResult.rows[0];
    const geoCtx = deal.deal_data?.geographic_context || {};

    let tradeArea = null;
    if (deal.trade_area_id) {
      const taResult = await pool.query(
        `SELECT id, name, municipality, state, metadata,
                ST_AsGeoJSON(boundary)::json as geometry,
                created_at
         FROM trade_areas WHERE id = $1`,
        [deal.trade_area_id]
      );
      if (taResult.rows.length > 0) {
        const ta = taResult.rows[0];
        tradeArea = {
          id: ta.id,
          name: ta.name,
          municipality: ta.municipality,
          state: ta.state,
          geometry: ta.geometry,
          definition_method: ta.metadata?.definition_method || 'radius',
          method_params: ta.metadata?.method_params || {},
        };
      }
    }

    res.json({
      success: true,
      data: {
        deal_id: dealId,
        active_scope: geoCtx.active_scope || (tradeArea ? 'trade_area' : 'submarket'),
        trade_area: tradeArea,
        submarket_id: geoCtx.submarket_id || null,
        msa_id: geoCtx.msa_id || null,
      },
    });
  } catch (error) {
    logger.error('Error fetching geographic context:', error);
    next(error);
  }
});

router.put('/:id/geographic-context', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: dealId } = req.params;
    const { active_scope, trade_area_id } = req.body;

    if (trade_area_id !== undefined) {
      await pool.query(
        `UPDATE deals SET trade_area_id = $2 WHERE id = $1`,
        [dealId, trade_area_id || null]
      );
    }

    if (active_scope) {
      await pool.query(
        `UPDATE deals SET deal_data = COALESCE(deal_data, '{}'::jsonb) || jsonb_build_object('geographic_context',
          COALESCE((deal_data->'geographic_context'), '{}'::jsonb) || jsonb_build_object('active_scope', $2::text)
        ) WHERE id = $1`,
        [dealId, active_scope]
      );
    }

    logger.info(`Updated geographic context for deal ${dealId}`, { active_scope, trade_area_id });

    res.json({
      success: true,
      message: 'Geographic context updated successfully',
      data: { active_scope, trade_area_id },
    });
  } catch (error) {
    logger.error('Error updating geographic context:', error);
    next(error);
  }
});

router.get('/submarkets/lookup', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    const result = await pool.query(
      `SELECT s.id, s.name, s.msa_id,
              m.name as msa_name
       FROM submarkets s
       LEFT JOIN msas m ON m.id = s.msa_id
       WHERE ST_Contains(s.geometry, ST_SetSRID(ST_MakePoint($1::float, $2::float), 4326))
       LIMIT 1`,
      [lng, lat]
    );

    if (result.rows.length > 0) {
      return res.json({ success: true, data: result.rows[0] });
    }

    res.json({
      success: true,
      data: { id: null, name: null, msa_id: null, msa_name: null },
    });
  } catch (error: any) {
    if (error.code === '42P01') {
      return res.json({ success: true, data: { id: null, name: null, msa_id: null, msa_name: null } });
    }
    logger.error('Error looking up submarket:', error);
    next(error);
  }
});

router.get('/msas/lookup', authMiddleware.requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }

    const result = await pool.query(
      `SELECT id, name, cbsa_code FROM msas
       WHERE ST_Contains(geometry, ST_SetSRID(ST_MakePoint($1::float, $2::float), 4326))
       LIMIT 1`,
      [lng, lat]
    );

    if (result.rows.length > 0) {
      return res.json({ success: true, data: result.rows[0] });
    }

    res.json({
      success: true,
      data: { id: null, name: null },
    });
  } catch (error: any) {
    if (error.code === '42P01') {
      return res.json({ success: true, data: { id: null, name: null } });
    }
    logger.error('Error looking up MSA:', error);
    next(error);
  }
});

export default router;
