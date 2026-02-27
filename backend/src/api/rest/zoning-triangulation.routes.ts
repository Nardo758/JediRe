import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { ParcelIngestionService } from '../../services/parcel-ingestion.service';
import { ZoningTriangulationService } from '../../services/zoning-triangulation.service';
import { ConfirmationChainService } from '../../services/confirmation-chain.service';

const router = Router();
const pool = getPool();
const parcelService = new ParcelIngestionService(pool);
const triangulationService = new ZoningTriangulationService(pool);
const chainService = new ConfirmationChainService(pool);

router.post('/parcels/ingest/geojson', async (req: Request, res: Response) => {
  try {
    const { geojson, county, state, mappingKey, sourceUrl } = req.body;

    if (!geojson || !county || !state) {
      return res.status(400).json({ error: 'geojson, county, and state are required' });
    }

    const result = await parcelService.ingestGeoJSON(
      geojson, county, state, mappingKey, sourceUrl
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Parcel ingestion error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/parcels/ingest/batch', async (req: Request, res: Response) => {
  try {
    const { records, batchId } = req.body;

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'records array is required' });
    }

    const result = await parcelService.ingestBatch(records, batchId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Batch ingestion error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/parcels/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await parcelService.getIngestionStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/parcels/nearby', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = parseFloat(req.query.radius as string) || 50;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng query params required' });
    }

    const parcels = await parcelService.findNearby(lat, lng, radius);
    res.json({ success: true, data: parcels });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/parcels/:parcelId', async (req: Request, res: Response) => {
  try {
    const { parcelId } = req.params;
    const county = req.query.county as string;
    const state = req.query.state as string;

    if (!county || !state) {
      return res.status(400).json({ error: 'county and state query params required' });
    }

    const parcel = await parcelService.getParcel(parcelId, county, state);
    if (!parcel) {
      return res.status(404).json({ error: 'Parcel not found' });
    }

    res.json({ success: true, data: parcel });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/zoning/triangulate', async (req: Request, res: Response) => {
  try {
    const { dealId, parcelId, lat, lng, municipality, state, userProvidedZoningCode } = req.body;

    if (!municipality || !state) {
      return res.status(400).json({ error: 'municipality and state are required' });
    }

    const result = await triangulationService.triangulate({
      dealId,
      parcelId,
      lat,
      lng,
      municipality,
      state,
      userProvidedZoningCode,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Triangulation error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/zoning/triangulation/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const result = await triangulationService.getForDeal(dealId);

    if (!result) {
      return res.status(404).json({ error: 'No triangulation found for this deal' });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/zoning/triangulation/:id/confirm', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { overrides } = req.body;

    await triangulationService.userConfirm(id, overrides);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/zoning/outcome', async (req: Request, res: Response) => {
  try {
    const {
      triangulationId, dealId,
      actualZoningCode, actualEntitlementPath, actualTimelineMonths,
      actualApprovedUnits, actualApprovedFar, actualOutcome,
      reportedBy, notes,
    } = req.body;

    if (!triangulationId || !actualOutcome || !reportedBy) {
      return res.status(400).json({
        error: 'triangulationId, actualOutcome, and reportedBy are required',
      });
    }

    const outcomeId = await triangulationService.recordOutcome({
      triangulationId,
      dealId,
      actualZoningCode,
      actualEntitlementPath,
      actualTimelineMonths,
      actualApprovedUnits,
      actualApprovedFar,
      actualOutcome,
      reportedBy,
      notes,
    });

    res.json({ success: true, data: { outcomeId } });
  } catch (error: any) {
    console.error('Outcome recording error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/zoning/calibrate/:municipality', async (req: Request, res: Response) => {
  try {
    const { municipality } = req.params;
    const { state } = req.body;

    if (!state) {
      return res.status(400).json({ error: 'state is required in body' });
    }

    await triangulationService.recalibrate(municipality, state);
    
    const result = await pool.query(
      'SELECT * FROM jurisdiction_calibration WHERE LOWER(municipality) = LOWER($1) AND state = $2',
      [municipality, state.toUpperCase()]
    );

    res.json({ success: true, data: result.rows[0] || null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/zoning/calibration', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM jurisdiction_calibration ORDER BY total_outcomes DESC, municipality`
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/zoning/chain/execute', async (req: Request, res: Response) => {
  try {
    const {
      dealId, parcelId, lat, lng, municipality, state,
      userProvidedZoningCode, propertyType, targetUses,
      marketData, demandScore, supplyPressureScore, momentumScore,
    } = req.body;

    if (!dealId || !municipality || !state) {
      return res.status(400).json({ error: 'dealId, municipality, and state are required' });
    }

    const result = await chainService.execute({
      dealId,
      parcelId,
      lat,
      lng,
      municipality,
      state,
      userProvidedZoningCode,
      propertyType,
      targetUses,
      marketData,
      demandScore,
      supplyPressureScore,
      momentumScore,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Chain execution error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/zoning/chain/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const result = await chainService.getForDeal(dealId);

    if (!result) {
      return res.status(404).json({ error: 'No chain result found for this deal' });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
