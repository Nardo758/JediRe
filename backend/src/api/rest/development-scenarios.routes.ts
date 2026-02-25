import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { ZoningProfileService } from '../../services/zoning-profile.service';
import { BuildingEnvelopeService, PropertyType } from '../../services/building-envelope.service';

const router = Router();
const pool = getPool();
const profileService = new ZoningProfileService(pool);
const envelopeService = new BuildingEnvelopeService();

function mapProjectTypeToEnvelopeType(projectType: string): PropertyType {
  const map: Record<string, PropertyType> = {
    multifamily: 'multifamily', residential: 'multifamily',
    office: 'office', retail: 'retail', industrial: 'industrial',
    hospitality: 'hospitality', mixed_use: 'mixed-use', 'mixed-use': 'mixed-use',
  };
  return map[projectType] || 'multifamily';
}

function mapProjectTypeToDealType(projectType: string): 'residential' | 'commercial' | 'mixed-use' {
  const pt = (projectType || '').toLowerCase();
  if (['multifamily', 'residential'].includes(pt)) return 'residential';
  if (['office', 'retail', 'industrial', 'hospitality', 'special_purpose'].includes(pt)) return 'commercial';
  if (pt === 'mixed_use' || pt === 'mixed-use') return 'mixed-use';
  return 'residential';
}

async function calculateScenarioEnvelope(profile: any, scenario: any, projectType: string) {
  const useMix = scenario.use_mix || { residential_pct: 100 };
  const avgUnitSize = scenario.avg_unit_size_sf || 900;
  const efficiency = parseFloat(scenario.efficiency_factor) || 0.85;

  const residentialPct = useMix.residential_pct || 0;
  const retailPct = useMix.retail_pct || 0;
  const officePct = useMix.office_pct || 0;
  const commercialPct = retailPct + officePct;

  let appliedFar = profile.applied_far;
  if (commercialPct > 0 && residentialPct > 0 && profile.residential_far && profile.nonresidential_far) {
    const weightedFar = (residentialPct * parseFloat(profile.residential_far) + commercialPct * parseFloat(profile.nonresidential_far)) / 100;
    appliedFar = profile.combined_far ? Math.min(weightedFar, parseFloat(profile.combined_far)) : weightedFar;
  }

  const lotAreaSf = parseFloat(profile.lot_area_sf) || 0;
  const buildableAreaSf = parseFloat(profile.buildable_area_sf) || lotAreaSf;

  const inputs = {
    landArea: lotAreaSf,
    setbacks: {
      front: parseInt(profile.setback_front_ft) || 0,
      side: parseInt(profile.setback_side_ft) || 0,
      rear: parseInt(profile.setback_rear_ft) || 0,
    },
    zoningConstraints: {
      maxDensity: profile.density_method === 'far_derived' ? null : (parseFloat(profile.max_density_per_acre) || null),
      maxFAR: appliedFar ? parseFloat(String(appliedFar)) : null,
      residentialFAR: parseFloat(profile.residential_far) || null,
      nonresidentialFAR: parseFloat(profile.nonresidential_far) || null,
      appliedFAR: appliedFar ? parseFloat(String(appliedFar)) : null,
      maxHeight: parseInt(profile.max_height_ft) || null,
      maxStories: parseInt(profile.max_stories) || null,
      minParkingPerUnit: parseFloat(profile.min_parking_per_unit) || null,
      maxLotCoverage: parseFloat(profile.max_lot_coverage_pct) || null,
      densityMethod: profile.density_method || 'units_per_acre',
    },
    propertyType: mapProjectTypeToEnvelopeType(projectType),
    dealType: mapProjectTypeToDealType(projectType),
  };

  const envelope = envelopeService.calculateEnvelope(inputs);

  const netLeasable = Math.round(envelope.maxGFA * efficiency);
  const maxUnits = profile.density_method === 'far_derived'
    ? Math.floor(netLeasable / avgUnitSize)
    : envelope.maxCapacity;

  const flags: string[] = [];
  if (profile.height_buffer_ft && profile.height_beyond_buffer_ft) {
    flags.push(`Height buffer applies: ${profile.max_height_ft} ft within ${profile.height_buffer_ft} ft of residential; ${profile.height_beyond_buffer_ft} ft beyond`);
  }
  const codeUpper = (profile.base_district_code || '').toUpperCase();
  if (codeUpper.match(/^(.+)-[A-Z]{1,2}$/)) {
    flags.push(`Conditional variant (${codeUpper}) — standards inherited from base district`);
  }

  return {
    max_gba: Math.round(envelope.maxGFA),
    max_footprint: Math.round(envelope.maxFootprint),
    net_leasable_sf: netLeasable,
    parking_required: envelope.parkingRequired,
    open_space_sf: profile.open_space_pct ? Math.round(lotAreaSf * parseFloat(profile.open_space_pct) / 100) : null,
    max_stories: envelope.maxFloors,
    max_units: maxUnits,
    applied_far: appliedFar,
    binding_constraint: envelope.limitingFactor,
    flags,
  };
}

router.get('/deals/:dealId/scenarios', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const result = await pool.query(
      'SELECT * FROM development_scenarios WHERE deal_id = $1 ORDER BY is_active DESC, created_at ASC',
      [dealId]
    );
    res.json({ scenarios: result.rows });
  } catch (error: any) {
    console.error('Error fetching scenarios:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch scenarios' });
  }
});

router.post('/deals/:dealId/scenarios', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const {
      name = 'New Scenario',
      use_mix = { residential_pct: 100 },
      avg_unit_size_sf = 900,
      efficiency_factor = 0.85,
      is_active = false,
    } = req.body;

    const profile = await profileService.getProfile(dealId);
    if (!profile) {
      return res.status(400).json({ error: 'No zoning profile exists. Confirm zoning first.' });
    }

    const dealResult = await pool.query('SELECT project_type FROM deals WHERE id = $1', [dealId]);
    const projectType = dealResult.rows[0]?.project_type || 'multifamily';

    const scenarioData = { use_mix, avg_unit_size_sf, efficiency_factor };
    const calculated = await calculateScenarioEnvelope(profile, scenarioData, projectType);

    if (is_active) {
      await pool.query(
        'UPDATE development_scenarios SET is_active = false WHERE deal_id = $1',
        [dealId]
      );
    }

    const result = await pool.query(
      `INSERT INTO development_scenarios (
        deal_id, name, is_active, use_mix, avg_unit_size_sf, efficiency_factor,
        max_gba, max_footprint, net_leasable_sf, parking_required, open_space_sf,
        max_stories, max_units, applied_far, binding_constraint, flags, calculated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      RETURNING *`,
      [
        dealId, name, is_active, JSON.stringify(use_mix), avg_unit_size_sf, efficiency_factor,
        calculated.max_gba, calculated.max_footprint, calculated.net_leasable_sf,
        calculated.parking_required, calculated.open_space_sf,
        calculated.max_stories, calculated.max_units, calculated.applied_far,
        calculated.binding_constraint, JSON.stringify(calculated.flags),
      ]
    );

    res.status(201).json({ scenario: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating scenario:', error);
    res.status(500).json({ error: error.message || 'Failed to create scenario' });
  }
});

router.put('/deals/:dealId/scenarios/:id', async (req: Request, res: Response) => {
  try {
    const { dealId, id } = req.params;
    const { name, use_mix, avg_unit_size_sf, efficiency_factor } = req.body;

    const existing = await pool.query(
      'SELECT * FROM development_scenarios WHERE id = $1 AND deal_id = $2',
      [id, dealId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const scenario = existing.rows[0];
    const updatedMix = use_mix || scenario.use_mix;
    const updatedUnitSize = avg_unit_size_sf ?? scenario.avg_unit_size_sf;
    const updatedEfficiency = efficiency_factor ?? scenario.efficiency_factor;
    const updatedName = name ?? scenario.name;

    const profile = await profileService.getProfile(dealId);
    if (!profile) {
      return res.status(400).json({ error: 'No zoning profile exists.' });
    }

    const dealResult = await pool.query('SELECT project_type FROM deals WHERE id = $1', [dealId]);
    const projectType = dealResult.rows[0]?.project_type || 'multifamily';

    const scenarioData = { use_mix: updatedMix, avg_unit_size_sf: updatedUnitSize, efficiency_factor: updatedEfficiency };
    const calculated = await calculateScenarioEnvelope(profile, scenarioData, projectType);

    const result = await pool.query(
      `UPDATE development_scenarios SET
        name = $1, use_mix = $2, avg_unit_size_sf = $3, efficiency_factor = $4,
        max_gba = $5, max_footprint = $6, net_leasable_sf = $7, parking_required = $8,
        open_space_sf = $9, max_stories = $10, max_units = $11, applied_far = $12,
        binding_constraint = $13, flags = $14, calculated_at = NOW(), updated_at = NOW()
      WHERE id = $15 AND deal_id = $16
      RETURNING *`,
      [
        updatedName, JSON.stringify(updatedMix), updatedUnitSize, updatedEfficiency,
        calculated.max_gba, calculated.max_footprint, calculated.net_leasable_sf,
        calculated.parking_required, calculated.open_space_sf,
        calculated.max_stories, calculated.max_units, calculated.applied_far,
        calculated.binding_constraint, JSON.stringify(calculated.flags),
        id, dealId,
      ]
    );

    res.json({ scenario: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating scenario:', error);
    res.status(500).json({ error: error.message || 'Failed to update scenario' });
  }
});

router.put('/deals/:dealId/scenarios/:id/activate', async (req: Request, res: Response) => {
  try {
    const { dealId, id } = req.params;

    await pool.query(
      'UPDATE development_scenarios SET is_active = false, updated_at = NOW() WHERE deal_id = $1',
      [dealId]
    );

    const result = await pool.query(
      'UPDATE development_scenarios SET is_active = true, updated_at = NOW() WHERE id = $1 AND deal_id = $2 RETURNING *',
      [id, dealId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    res.json({ scenario: result.rows[0] });
  } catch (error: any) {
    console.error('Error activating scenario:', error);
    res.status(500).json({ error: error.message || 'Failed to activate scenario' });
  }
});

router.delete('/deals/:dealId/scenarios/:id', async (req: Request, res: Response) => {
  try {
    const { dealId, id } = req.params;

    const result = await pool.query(
      'DELETE FROM development_scenarios WHERE id = $1 AND deal_id = $2 RETURNING id',
      [id, dealId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    res.json({ success: true, deleted: id });
  } catch (error: any) {
    console.error('Error deleting scenario:', error);
    res.status(500).json({ error: error.message || 'Failed to delete scenario' });
  }
});

export { calculateScenarioEnvelope };
export default router;
