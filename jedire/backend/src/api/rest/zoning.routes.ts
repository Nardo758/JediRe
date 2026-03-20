/**
 * Zoning REST Routes
 * Zoning lookup and analysis endpoints
 */

import { Router, Response } from 'express';
import { query } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { validate, zoningSchemas } from '../../utils/validators';
import { AppError } from '../../middleware/errorHandler';
import { ZoningService } from '../../services/zoning.service';

const router = Router();
const zoningService = new ZoningService();

/**
 * POST /api/v1/zoning/lookup
 * Look up zoning for address or coordinates
 */
router.post('/lookup', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { error, value } = validate(zoningSchemas.lookup, req.body);
    if (error) {
      throw new AppError(400, error);
    }

    const result = await zoningService.lookupZoning(value);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/zoning/districts/:municipality/:state
 * Get all districts for a municipality
 */
router.get('/districts/:municipality/:state', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { municipality, state } = req.params;

    const result = await query(
      `SELECT id, district_code, district_name, district_description,
              municipality, state_code
       FROM zoning_district_boundaries
       WHERE municipality ILIKE $1 AND state_code = $2
       ORDER BY district_code`,
      [municipality, state.toUpperCase()]
    );

    res.json({
      municipality,
      state: state.toUpperCase(),
      districts: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/zoning/rules/:districtId
 * Get rules for a specific district
 */
router.get('/rules/:districtId', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { districtId } = req.params;

    const result = await query(
      `SELECT r.*, d.district_code, d.district_name, d.municipality
       FROM zoning_rules r
       JOIN zoning_district_boundaries d ON r.district_id = d.id
       WHERE r.district_id = $1`,
      [districtId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'No rules found for this district');
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/zoning/analyze
 * Analyze development potential for a property
 */
router.post('/analyze', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { propertyId, lotSizeSqft, question } = req.body;

    if (!propertyId && !lotSizeSqft) {
      throw new AppError(400, 'Either propertyId or lotSizeSqft required');
    }

    const analysis = await zoningService.analyzeProperty({
      propertyId,
      lotSizeSqft,
      question,
      userId: req.user!.userId,
    });

    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

export default router;
