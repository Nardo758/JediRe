/**
 * WS-3 Layers 1+2 — Forward Supply API
 *
 * GET /api/v1/deals/:dealId/forward-supply
 *
 * Returns the projected multifamily development capacity within fixed 3mi
 * and 5mi rings around the deal's coordinates, broken down by parcel class
 * (vacant / underbuilt / developed).
 *
 * Layer 1 (RadiusSweepService): PostGIS-free Haversine sweep of county_parcels
 * filtered to MF-eligible zoning codes within the 5mi bounding box.
 *
 * Layer 2 (BatchFeasibilityService): Applies BuildingEnvelopeService
 * dimensional constraints (setbacks, FAR, density, height) per parcel to
 * derive bindingUnitsPerAcre.  Classification as vacant/underbuilt/developed
 * uses improvement data from the raw_record JSONB column.
 */

import { Router } from 'express';
import { getPool } from '../../database/connection';
import { ForwardSupplyService } from '../../services/forward-supply.service';
import { logger } from '../../utils/logger';

const router = Router();

router.get('/:dealId/forward-supply', async (req, res) => {
  const { dealId } = req.params;
  try {
    const service = new ForwardSupplyService(getPool());
    const result = await service.compute(dealId);
    return res.json({ success: true, ...result });
  } catch (err) {
    logger.error('[forward-supply] error', { dealId, err });
    return res.status(500).json({ success: false, error: 'Failed to compute forward supply' });
  }
});

export default router;
