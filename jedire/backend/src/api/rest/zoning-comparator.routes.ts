import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { ZoningComparatorService } from '../../services/zoning-comparator.service';

const router = Router();
const pool = getPool();
const comparatorService = new ZoningComparatorService(pool);

router.post('/districts', async (req: Request, res: Response) => {
  try {
    const { districtA, districtB } = req.body;
    if (!districtA || !districtB) {
      return res.status(400).json({ success: false, error: 'districtA and districtB are required' });
    }
    const result = await comparatorService.compareDistricts(districtA, districtB);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Compare districts error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/parcels', async (req: Request, res: Response) => {
  try {
    const { parcelA, parcelB } = req.body;
    if (!parcelA || !parcelB) {
      return res.status(400).json({ success: false, error: 'parcelA and parcelB are required' });
    }
    const result = await comparatorService.compareParcels(parcelA, parcelB);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Compare parcels error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/jurisdictions', async (req: Request, res: Response) => {
  try {
    const { jurisdictionA, jurisdictionB } = req.body;
    if (!jurisdictionA || !jurisdictionB) {
      return res.status(400).json({ success: false, error: 'jurisdictionA and jurisdictionB are required' });
    }
    const result = await comparatorService.compareJurisdictions(jurisdictionA, jurisdictionB);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Compare jurisdictions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
