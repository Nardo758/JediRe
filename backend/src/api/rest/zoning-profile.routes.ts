import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { ZoningProfileService } from '../../services/zoning-profile.service';

const router = Router();
const pool = getPool();
const profileService = new ZoningProfileService(pool);

router.get('/deals/:dealId/zoning-profile', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const profile = await profileService.getProfile(dealId);
    if (!profile) {
      return res.json({ exists: false, profile: null });
    }

    const dealResult = await pool.query(
      `SELECT d.project_type FROM deals d WHERE d.id = $1`,
      [dealId]
    );
    const dealInfo = dealResult.rows[0] || {};

    const projectTypeLabels: Record<string, string> = {
      multifamily: 'Multifamily', residential: 'Residential', office: 'Commercial / Office',
      retail: 'Retail', industrial: 'Industrial', hospitality: 'Hospitality',
      mixed_use: 'Mixed-Use', land: 'Land', special_purpose: 'Special Purpose',
    };

    res.json({
      exists: true,
      profile,
      deal: {
        project_type: dealInfo.project_type,
        property_type_display: projectTypeLabels[dealInfo.project_type] || dealInfo.project_type,
      },
    });
  } catch (error: any) {
    console.error('Error fetching zoning profile:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch zoning profile' });
  }
});

router.post('/deals/:dealId/zoning-profile/resolve', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const profile = await profileService.resolveProfile(dealId);
    res.json({ success: true, profile });
  } catch (error: any) {
    console.error('Error resolving zoning profile:', error);
    res.status(500).json({ error: error.message || 'Failed to resolve zoning profile' });
  }
});

router.put('/deals/:dealId/zoning-profile/overrides', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { overrides } = req.body;

    if (!overrides || typeof overrides !== 'object') {
      return res.status(400).json({ error: 'Must provide overrides object' });
    }

    const profile = await profileService.updateOverrides(dealId, overrides);
    res.json({ success: true, profile });
  } catch (error: any) {
    console.error('Error updating overrides:', error);
    res.status(500).json({ error: error.message || 'Failed to update overrides' });
  }
});

router.post('/deals/:dealId/zoning-profile/overlays', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { name, modifications, source } = req.body;

    if (!name || !modifications) {
      return res.status(400).json({ error: 'Must provide overlay name and modifications' });
    }

    const profile = await profileService.addOverlay(dealId, { name, modifications, source });
    res.json({ success: true, profile });
  } catch (error: any) {
    console.error('Error adding overlay:', error);
    res.status(500).json({ error: error.message || 'Failed to add overlay' });
  }
});

export { profileService };
export default router;
