/**
 * ═══════════════════════════════════════════════════════════════════
 * ASSESSOR REST ROUTES — Parcel Lookup API
 * ═══════════════════════════════════════════════════════════════════
 *
 * Provides endpoints for the Property Surface (F7/M30) and other
 * consumers to query assessor parcel data by address or parcel ID.
 *
 * Routes:
 *   GET /api/assessor/lookup?address=...
 *   GET /api/assessor/lookup?parcelId=...
 *   GET /api/assessor/suggest?q=...
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { lookupParcel, suggestAddresses } from '../../services/assessor/assessor.service';
import { AppError } from '../../middleware/errorHandler';

const router = Router();

/**
 * GET /api/assessor/lookup
 *
 * Query parameters (at least one required):
 *   - address:  Street address to look up
 *   - parcelId: County parcel identifier
 *   - county:   County name (default: 'fulton')
 *   - state:    State code (default: 'GA')
 *
 * Returns: AssessorParcelRecord or 404 if not found.
 */
router.get('/lookup', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { address, parcelId, county, state } = req.query;

    if (!address && !parcelId) {
      throw new AppError(400, 'Either "address" or "parcelId" query parameter is required');
    }

    const record = await lookupParcel({
      address: address ? String(address) : undefined,
      parcelId: parcelId ? String(parcelId) : undefined,
      county: county ? String(county) : undefined,
      state: state ? String(state) : undefined,
    });

    if (!record) {
      res.status(404).json({
        error: 'Parcel not found',
        address: address || null,
        parcelId: parcelId || null,
      });
      return;
    }

    res.json({
      success: true,
      parcel: record,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/assessor/suggest
 *
 * Query parameters:
 *   - q: Partial address query string (min 3 chars)
 *
 * Returns: Array of suggested full addresses.
 */
router.get('/suggest', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { q } = req.query;

    if (!q || String(q).length < 3) {
      throw new AppError(400, 'Query parameter "q" must be at least 3 characters');
    }

    const suggestions = await suggestAddresses(String(q));

    res.json({
      success: true,
      query: q,
      suggestions,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
