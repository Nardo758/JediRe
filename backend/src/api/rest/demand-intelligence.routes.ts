import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { opportunityEngineService } from '../../services/opportunity-engine.service';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  try {
    const city = (req.query.city as string) || 'Atlanta';
    const demandData = await opportunityEngineService.getDemandData(city);

    if (!demandData) {
      return res.json({
        success: true,
        data: null,
        message: 'No demand intelligence data available yet. Run apartment data sync first.',
      });
    }

    res.json({
      success: true,
      data: {
        activeRenters: demandData.activeRenters,
        topAmenities: demandData.topAmenities,
        dealBreakers: demandData.dealBreakers,
        apartmentFeatures: demandData.apartmentFeatures,
        budget: demandData.budget,
        bedroomDemand: demandData.bedroomDemand,
        commutePreferences: demandData.commutePreferences,
        locationDemand: demandData.locationDemand,
        moveInTimeline: demandData.moveInTimeline,
        lifestylePriorities: demandData.lifestylePriorities,
        setupStats: demandData.setupStats,
        preferredCities: demandData.preferredCities,
      },
      city,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Demand intelligence fetch failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch demand intelligence' });
  }
});

export default router;
