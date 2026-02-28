import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { ZoningProfileService } from '../../services/zoning-profile.service';
import { BuildingEnvelopeService, PropertyType } from '../../services/building-envelope.service';
import { RezoneAnalysisService } from '../../services/rezone-analysis.service';
import { ZoningRecommendationOrchestrator } from '../../services/zoning-recommendation-orchestrator.service';
import { ZoningAgentService } from '../../services/zoning-agent.service';
import { EntitlementComparisonEngine } from '../../services/entitlement-comparison-engine.service';
import { ZoningInterpretationCache } from '../../services/zoning-interpretation-cache.service';

const router = Router();
const pool = getPool();
const profileService = new ZoningProfileService(pool);
const envelopeService = new BuildingEnvelopeService();
const rezoneService = new RezoneAnalysisService(pool);
const recommendationOrchestrator = new ZoningRecommendationOrchestrator(pool);
const agentService = new ZoningAgentService(pool);
const interpretationCache = new ZoningInterpretationCache(pool);
const comparisonEngine = new EntitlementComparisonEngine(pool, envelopeService, rezoneService, recommendationOrchestrator, agentService, interpretationCache);

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

async function calculateScenarioEnvelope(profile: any, scenario: any, projectType: string, targetDistrict?: any) {
  const useMix = scenario.use_mix || { residential_pct: 100 };
  const avgUnitSize = scenario.avg_unit_size_sf || 900;
  const efficiency = parseFloat(scenario.efficiency_factor) || 0.85;

  const residentialPct = useMix.residential_pct || 0;
  const retailPct = useMix.retail_pct || 0;
  const officePct = useMix.office_pct || 0;
  const commercialPct = retailPct + officePct;

  const src = targetDistrict || profile;

  const srcDensity = parseFloat(targetDistrict
    ? (src.max_density_per_acre || src.max_units_per_acre)
    : profile.max_density_per_acre) || null;
  const srcFar = parseFloat(targetDistrict
    ? src.max_far
    : profile.applied_far || profile.max_far) || null;
  const srcResFar = parseFloat(targetDistrict
    ? src.residential_far
    : profile.residential_far) || null;
  const srcNonresFar = parseFloat(targetDistrict
    ? src.nonresidential_far
    : profile.nonresidential_far) || null;
  const srcHeight = parseInt(targetDistrict
    ? (src.max_height_feet || src.max_building_height_ft)
    : profile.max_height_ft) || null;
  const srcStories = parseInt(src.max_stories) || null;
  const srcParking = parseFloat(targetDistrict
    ? (src.min_parking_per_unit || src.parking_per_unit)
    : profile.min_parking_per_unit) || null;
  const srcLotCoverage = parseFloat(targetDistrict
    ? (src.max_lot_coverage || src.max_lot_coverage_percent)
    : profile.max_lot_coverage_pct) || null;
  const srcDensityMethod = src.density_method || profile.density_method || 'units_per_acre';

  const srcSetbackFront = parseInt(targetDistrict
    ? (src.setback_front_ft || src.min_front_setback_ft)
    : profile.setback_front_ft) || 0;
  const srcSetbackSide = parseInt(targetDistrict
    ? (src.setback_side_ft || src.min_side_setback_ft)
    : profile.setback_side_ft) || 0;
  const srcSetbackRear = parseInt(targetDistrict
    ? (src.setback_rear_ft || src.min_rear_setback_ft)
    : profile.setback_rear_ft) || 0;

  let appliedFar = srcFar;
  if (commercialPct > 0 && residentialPct > 0 && srcResFar && srcNonresFar) {
    const weightedFar = (residentialPct * srcResFar + commercialPct * srcNonresFar) / 100;
    const combinedFarCap = targetDistrict
      ? parseFloat(targetDistrict.combined_far || targetDistrict.max_far) || null
      : parseFloat(profile.combined_far) || null;
    appliedFar = combinedFarCap ? Math.min(weightedFar, combinedFarCap) : weightedFar;
  } else {
    const dealType = mapProjectTypeToDealType(projectType);
    if (dealType === 'residential' && srcResFar != null) {
      appliedFar = srcResFar;
    } else if (dealType === 'commercial' && srcNonresFar != null) {
      appliedFar = srcNonresFar;
    }
  }

  const lotAreaSf = parseFloat(profile.lot_area_sf) || 0;

  const inputs = {
    landArea: lotAreaSf,
    setbacks: {
      front: srcSetbackFront,
      side: srcSetbackSide,
      rear: srcSetbackRear,
    },
    zoningConstraints: {
      maxDensity: srcDensityMethod === 'far_derived' ? null : srcDensity,
      maxFAR: appliedFar,
      residentialFAR: srcResFar,
      nonresidentialFAR: srcNonresFar,
      appliedFAR: appliedFar,
      maxHeight: srcHeight,
      maxStories: srcStories,
      minParkingPerUnit: srcParking,
      maxLotCoverage: srcLotCoverage,
      densityMethod: srcDensityMethod,
    },
    propertyType: mapProjectTypeToEnvelopeType(projectType),
    dealType: mapProjectTypeToDealType(projectType),
  };

  const envelope = envelopeService.calculateEnvelope(inputs);

  const netLeasable = Math.round(envelope.maxGFA * efficiency);
  const maxUnits = srcDensityMethod === 'far_derived'
    ? Math.floor(netLeasable / avgUnitSize)
    : envelope.maxCapacity;

  const flags: string[] = [];
  if (!targetDistrict) {
    if (profile.height_buffer_ft && profile.height_beyond_buffer_ft) {
      flags.push(`Height buffer applies: ${profile.max_height_ft} ft within ${profile.height_buffer_ft} ft of residential; ${profile.height_beyond_buffer_ft} ft beyond`);
    }
    const codeUpper = (profile.base_district_code || '').toUpperCase();
    if (codeUpper.match(/^(.+)-[A-Z]{1,2}$/)) {
      flags.push(`Conditional variant (${codeUpper}) — standards inherited from base district`);
    }
  } else {
    flags.push(`Calculated using ${targetDistrict.zoning_code || targetDistrict.district_code} district standards`);
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

router.get('/deals/:dealId/scenarios/hbu', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const profile = await profileService.getProfile(dealId);
    if (!profile) {
      return res.status(400).json({ error: 'No zoning profile exists. Confirm zoning first.' });
    }

    const dealResult = await pool.query('SELECT project_type FROM deals WHERE id = $1', [dealId]);
    const projectType = dealResult.rows[0]?.project_type || 'multifamily';

    const lotAreaSf = parseFloat(String(profile.lot_area_sf)) || 0;
    let appliedFar = profile.applied_far;
    const dealType = mapProjectTypeToDealType(projectType);

    const inputs = {
      landArea: lotAreaSf,
      setbacks: {
        front: parseInt(String(profile.setback_front_ft)) || 0,
        side: parseInt(String(profile.setback_side_ft)) || 0,
        rear: parseInt(String(profile.setback_rear_ft)) || 0,
      },
      zoningConstraints: {
        maxDensity: profile.density_method === 'far_derived' ? null : (parseFloat(String(profile.max_density_per_acre)) || null),
        maxFAR: appliedFar ? parseFloat(String(appliedFar)) : null,
        residentialFAR: parseFloat(String(profile.residential_far)) || null,
        nonresidentialFAR: parseFloat(String(profile.nonresidential_far)) || null,
        appliedFAR: appliedFar ? parseFloat(String(appliedFar)) : null,
        maxHeight: parseInt(String(profile.max_height_ft)) || null,
        maxStories: parseInt(String(profile.max_stories)) || null,
        minParkingPerUnit: parseFloat(String(profile.min_parking_per_unit)) || null,
        maxLotCoverage: parseFloat(String(profile.max_lot_coverage_pct)) || null,
        densityMethod: (profile.density_method as any) || 'units_per_acre',
      },
      dealType: dealType as 'residential' | 'commercial' | 'mixed-use',
    };

    const results = envelopeService.calculateHighestBestUse(inputs);

    res.json({ hbu: results, dealType, projectType });
  } catch (error: any) {
    console.error('Error calculating HBU:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate highest & best use' });
  }
});

router.get('/deals/:dealId/scenarios/recommendations', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const varianceDensityPct = parseFloat(req.query.variance_density_pct as string) || 20;
    const rezoneTargetCode = (req.query.rezone_target_code as string) || null;

    const result = await comparisonEngine.compare(dealId, { varianceDensityPct, rezoneTargetCode });

    const cellNum = (key: string, field: string) => {
      const v = result.cells[key]?.[field];
      if (!v || v === '--') return 0;
      return parseInt(String(v).replace(/,/g, '')) || 0;
    };
    const cellFloat = (key: string, field: string) => {
      const v = result.cells[key]?.[field];
      if (!v || v === '--') return null;
      return parseFloat(String(v).replace(/,/g, '')) || null;
    };

    const recommendations = result.columns.map(col => ({
      name: col.key === 'byRight' ? 'By-Right'
        : col.key === 'variance' ? 'Variance'
        : col.key === 'rezone' ? 'Rezone'
        : col.key.startsWith('overlay') ? (col.label || 'Overlay')
        : col.label || col.key,
      description: col.aiInsight || '',
      risk: col.risk,
      successRate: col.successRate,
      timeline: col.timeline,
      zoningCode: col.zoningCode,
      source: col.source,
      maxUnits: cellNum(col.key, 'maxUnits'),
      maxGba: cellNum(col.key, 'gba'),
      maxStories: cellNum(col.key, 'stories'),
      appliedFar: cellFloat(col.key, 'far'),
      parkingRequired: cellNum(col.key, 'parking'),
      maxHeight: cellFloat(col.key, 'maxHeight'),
      maxDensity: cellFloat(col.key, 'density'),
      bindingConstraint: result.cells[col.key]?.bindingConstraint || 'unknown',
      deltaUnits: cellNum(col.key, 'deltaUnits'),
      deltaGba: cellNum(col.key, 'deltaGba'),
      targetDistrictCode: col.zoningCode,
      varianceDensityPct: col.key === 'variance' ? varianceDensityPct : undefined,
    }));

    res.json({
      recommendations,
      baseDistrictCode: result.baseDistrictCode,
      comparison: result,
    });
  } catch (error: any) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch recommendations' });
  }
});

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

router.get('/deals/:dealId/scenarios/lookup-district', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'code query parameter is required' });
    }

    const profile = await profileService.getProfile(dealId);
    if (!profile) {
      return res.status(400).json({ error: 'No zoning profile exists.' });
    }

    const municipality = profile.municipality;
    if (!municipality) {
      return res.json({ found: false, message: 'No municipality on profile' });
    }

    const municipalityId = `${municipality.toLowerCase().replace(/\s+/g, '-')}-${(profile.state || 'ga').toLowerCase()}`;
    const distResult = await pool.query(
      `SELECT * FROM zoning_districts WHERE municipality_id = $1 AND UPPER(zoning_code) = UPPER($2) LIMIT 1`,
      [municipalityId, code]
    );

    if (distResult.rows.length === 0) {
      const fallback = await pool.query(
        `SELECT * FROM zoning_districts WHERE UPPER(municipality) = UPPER($1) AND UPPER(COALESCE(zoning_code, district_code)) = UPPER($2) LIMIT 1`,
        [municipality, code]
      );
      if (fallback.rows.length === 0) {
        return res.json({ found: false, message: 'Code not in database — enter constraints manually' });
      }
      return res.json({ found: true, district: fallback.rows[0] });
    }

    res.json({ found: true, district: distResult.rows[0] });
  } catch (error: any) {
    console.error('Error looking up district:', error);
    res.status(500).json({ error: error.message || 'Failed to look up district' });
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
      target_district_id = null,
      target_district_code = null,
    } = req.body;

    const profile = await profileService.getProfile(dealId);
    if (!profile) {
      return res.status(400).json({ error: 'No zoning profile exists. Confirm zoning first.' });
    }

    const dealResult = await pool.query('SELECT project_type FROM deals WHERE id = $1', [dealId]);
    const projectType = dealResult.rows[0]?.project_type || 'multifamily';

    let resolvedDistrictId = target_district_id;
    let resolvedDistrictCode = target_district_code;
    let targetDistrict = null;

    if (target_district_code && !target_district_id) {
      const municipality = profile.municipality;
      if (municipality) {
        const municipalityId = `${municipality.toLowerCase().replace(/\s+/g, '-')}-${(profile.state || 'ga').toLowerCase()}`;
        const distResult = await pool.query(
          `SELECT * FROM zoning_districts WHERE municipality_id = $1 AND UPPER(zoning_code) = UPPER($2) LIMIT 1`,
          [municipalityId, target_district_code]
        );
        if (distResult.rows.length > 0) {
          targetDistrict = distResult.rows[0];
          resolvedDistrictId = targetDistrict.id;
          resolvedDistrictCode = targetDistrict.zoning_code || targetDistrict.district_code;
        } else {
          const fallback = await pool.query(
            `SELECT * FROM zoning_districts WHERE UPPER(municipality) = UPPER($1) AND UPPER(COALESCE(zoning_code, district_code)) = UPPER($2) LIMIT 1`,
            [municipality, target_district_code]
          );
          if (fallback.rows.length > 0) {
            targetDistrict = fallback.rows[0];
            resolvedDistrictId = targetDistrict.id;
            resolvedDistrictCode = targetDistrict.zoning_code || targetDistrict.district_code;
          }
        }
      }
    } else if (target_district_id) {
      const distResult = await pool.query('SELECT * FROM zoning_districts WHERE id = $1', [target_district_id]);
      targetDistrict = distResult.rows[0] || null;
      if (targetDistrict) {
        resolvedDistrictCode = targetDistrict.zoning_code || targetDistrict.district_code;
      }
    }

    const scenarioData = { use_mix, avg_unit_size_sf, efficiency_factor };
    const calculated = await calculateScenarioEnvelope(profile, scenarioData, projectType, targetDistrict);

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
        max_stories, max_units, applied_far, binding_constraint, flags, target_district_id, target_district_code, calculated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
      RETURNING *`,
      [
        dealId, name, is_active, JSON.stringify(use_mix), avg_unit_size_sf, efficiency_factor,
        calculated.max_gba, calculated.max_footprint, calculated.net_leasable_sf,
        calculated.parking_required, calculated.open_space_sf,
        calculated.max_stories, calculated.max_units, calculated.applied_far,
        calculated.binding_constraint, JSON.stringify(calculated.flags),
        resolvedDistrictId, resolvedDistrictCode,
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
    const { name, use_mix, avg_unit_size_sf, efficiency_factor, target_district_code } = req.body;

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

    let resolvedDistrictId = scenario.target_district_id;
    let resolvedDistrictCode = scenario.target_district_code;
    let targetDistrict = null;

    if (target_district_code !== undefined) {
      resolvedDistrictCode = target_district_code;
      resolvedDistrictId = null;
      if (target_district_code) {
        const municipality = profile.municipality;
        if (municipality) {
          const municipalityId = `${municipality.toLowerCase().replace(/\s+/g, '-')}-${(profile.state || 'ga').toLowerCase()}`;
          const distResult = await pool.query(
            `SELECT * FROM zoning_districts WHERE municipality_id = $1 AND UPPER(zoning_code) = UPPER($2) LIMIT 1`,
            [municipalityId, target_district_code]
          );
          if (distResult.rows.length > 0) {
            targetDistrict = distResult.rows[0];
            resolvedDistrictId = targetDistrict.id;
            resolvedDistrictCode = targetDistrict.zoning_code || targetDistrict.district_code;
          } else {
            const fallback = await pool.query(
              `SELECT * FROM zoning_districts WHERE UPPER(municipality) = UPPER($1) AND UPPER(COALESCE(zoning_code, district_code)) = UPPER($2) LIMIT 1`,
              [municipality, target_district_code]
            );
            if (fallback.rows.length > 0) {
              targetDistrict = fallback.rows[0];
              resolvedDistrictId = targetDistrict.id;
              resolvedDistrictCode = targetDistrict.zoning_code || targetDistrict.district_code;
            }
          }
        }
      }
    } else if (resolvedDistrictId) {
      const distResult = await pool.query('SELECT * FROM zoning_districts WHERE id = $1', [resolvedDistrictId]);
      targetDistrict = distResult.rows[0] || null;
    }

    const scenarioData = { use_mix: updatedMix, avg_unit_size_sf: updatedUnitSize, efficiency_factor: updatedEfficiency };
    const calculated = await calculateScenarioEnvelope(profile, scenarioData, projectType, targetDistrict);

    const result = await pool.query(
      `UPDATE development_scenarios SET
        name = $1, use_mix = $2, avg_unit_size_sf = $3, efficiency_factor = $4,
        max_gba = $5, max_footprint = $6, net_leasable_sf = $7, parking_required = $8,
        open_space_sf = $9, max_stories = $10, max_units = $11, applied_far = $12,
        binding_constraint = $13, flags = $14, target_district_id = $15, target_district_code = $16,
        calculated_at = NOW(), updated_at = NOW()
      WHERE id = $17 AND deal_id = $18
      RETURNING *`,
      [
        updatedName, JSON.stringify(updatedMix), updatedUnitSize, updatedEfficiency,
        calculated.max_gba, calculated.max_footprint, calculated.net_leasable_sf,
        calculated.parking_required, calculated.open_space_sf,
        calculated.max_stories, calculated.max_units, calculated.applied_far,
        calculated.binding_constraint, JSON.stringify(calculated.flags),
        resolvedDistrictId, resolvedDistrictCode,
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

router.get('/deals/:dealId/rezone-analysis', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const profile = await profileService.getProfile(dealId);
    if (!profile) {
      return res.status(400).json({ error: 'No zoning profile exists. Confirm zoning first.' });
    }

    if (!profile.base_district_code || !profile.municipality) {
      return res.status(400).json({ error: 'Zoning district code and municipality required for rezone analysis.' });
    }

    const dealResult = await pool.query('SELECT project_type FROM deals WHERE id = $1', [dealId]);
    const projectType = dealResult.rows[0]?.project_type || 'multifamily';

    const result = await rezoneService.analyze({
      currentDistrictCode: profile.base_district_code,
      municipality: profile.municipality,
      municipalityId: undefined,
      lotAreaSf: parseFloat(String(profile.lot_area_sf)) || 0,
      propertyType: mapProjectTypeToEnvelopeType(projectType),
      dealType: mapProjectTypeToDealType(projectType),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error performing rezone analysis:', error);
    res.status(500).json({ error: error.message || 'Failed to perform rezone analysis' });
  }
});

router.get('/deals/:dealId/envelope-enrichment', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const profile = await profileService.getProfile(dealId);
    if (!profile) {
      return res.status(400).json({ error: 'No zoning profile exists.' });
    }

    const dealResult = await pool.query('SELECT project_type FROM deals WHERE id = $1', [dealId]);
    const projectType = dealResult.rows[0]?.project_type || 'multifamily';
    const propType = mapProjectTypeToEnvelopeType(projectType);
    const dealType = mapProjectTypeToDealType(projectType);

    const lotAreaSf = parseFloat(String(profile.lot_area_sf)) || 0;

    let sourceRules: any[] = [];
    if (profile.base_district_code && profile.municipality) {
      try {
        const { MunicodeUrlService } = await import('../../services/municode-url.service');
        const municodeService = new MunicodeUrlService();
        const municipalityId = `${(profile.municipality as string).toLowerCase().replace(/\s+/g, '-')}-${(profile.state || 'ga').toLowerCase()}`;
        const ruleUrls = await municodeService.getDistrictRuleUrls(municipalityId, profile.base_district_code);
        sourceRules = ruleUrls.rules || [];
      } catch {}
    }

    const envelope = envelopeService.calculateEnvelope({
      landArea: lotAreaSf,
      setbacks: {
        front: parseInt(String(profile.setback_front_ft)) || 0,
        side: parseInt(String(profile.setback_side_ft)) || 0,
        rear: parseInt(String(profile.setback_rear_ft)) || 0,
      },
      zoningConstraints: {
        maxDensity: profile.density_method === 'far_derived' ? null : (parseFloat(String(profile.max_density_per_acre)) || null),
        maxFAR: profile.applied_far ? parseFloat(String(profile.applied_far)) : null,
        residentialFAR: parseFloat(String(profile.residential_far)) || null,
        nonresidentialFAR: parseFloat(String(profile.nonresidential_far)) || null,
        appliedFAR: profile.applied_far ? parseFloat(String(profile.applied_far)) : null,
        maxHeight: parseInt(String(profile.max_height_ft)) || null,
        maxStories: parseInt(String(profile.max_stories)) || null,
        minParkingPerUnit: parseFloat(String(profile.min_parking_per_unit)) || null,
        maxLotCoverage: parseFloat(String(profile.max_lot_coverage_pct)) || null,
        densityMethod: (profile.density_method as any) || 'units_per_acre',
      },
      propertyType: propType,
      dealType,
      sourceRules,
    });

    res.json({
      sources: envelope.sources,
      calculations: envelope.calculations,
      insights: envelope.insights,
      limitingFactor: envelope.limitingFactor,
      capacityByConstraint: envelope.capacityByConstraint,
    });
  } catch (error: any) {
    console.error('Error fetching envelope enrichment:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch envelope enrichment' });
  }
});

export { calculateScenarioEnvelope };
export default router;
