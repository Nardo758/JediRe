import { Router, Request, Response } from 'express';
import { getPool } from '../../database/connection';
import { ZoningProfileService } from '../../services/zoning-profile.service';
import { BuildingEnvelopeService, PropertyType } from '../../services/building-envelope.service';
import { RezoneAnalysisService } from '../../services/rezone-analysis.service';
import { ZoningRecommendationOrchestrator } from '../../services/zoning-recommendation-orchestrator.service';
import { ZoningAgentService } from '../../services/zoning-agent.service';
import { EntitlementComparisonEngine } from '../../services/entitlement-comparison-engine.service';
import { ZoningInterpretationCache } from '../../services/zoning-interpretation-cache.service';
import { DataLibraryContextService } from '../../services/data-library-context.service';

const router = Router();
const pool = getPool();
const profileService = new ZoningProfileService(pool);
const envelopeService = new BuildingEnvelopeService();
const rezoneService = new RezoneAnalysisService(pool);
const recommendationOrchestrator = new ZoningRecommendationOrchestrator(pool);
const agentService = new ZoningAgentService(pool);
const interpretationCache = new ZoningInterpretationCache(pool);
const dataLibraryContext = new DataLibraryContextService(pool);
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

const HBU_USE_MAP: Record<string, string[]> = {
  multifamily: ['multifamily_residential', 'multifamily', 'residential', 'apartment', 'townhouse'],
  office: ['office', 'professional_office', 'business_office', 'medical_office'],
  retail: ['retail', 'commercial', 'grocery_store', 'pharmacy', 'personal_services', 'restaurant'],
  industrial: ['industrial', 'light_industrial', 'manufacturing', 'warehousing', 'warehouse'],
  'mixed-use': ['mixed_use_development', 'mixed_use', 'live_work_units', 'mixed-use'],
  hospitality: ['hotel', 'motel', 'hospitality', 'lodging', 'bed_and_breakfast'],
};

function normalizeUse(s: string): string {
  return s.toLowerCase().replace(/[_\-\/]/g, ' ').replace(/\s+/g, ' ').trim();
}

function useMatches(alias: string, useEntry: string): boolean {
  const a = normalizeUse(alias);
  const u = normalizeUse(useEntry);
  if (a === u) return true;
  if (u.includes(a) || a.includes(u)) return true;
  return false;
}

function classifyUsePermission(
  propertyType: string,
  permitted: string[],
  conditional: string[],
  prohibited: string[],
): { status: 'by-right' | 'conditional' | 'not-permitted' | 'not-classified'; note: string } {
  const aliases = HBU_USE_MAP[propertyType] || [propertyType];

  for (const alias of aliases) {
    for (const p of permitted) {
      if (useMatches(alias, p)) return { status: 'by-right', note: `${p} is a permitted use` };
    }
  }
  for (const alias of aliases) {
    for (const c of conditional) {
      if (useMatches(alias, c)) return { status: 'conditional', note: `${c} requires conditional use permit` };
    }
  }
  for (const alias of aliases) {
    for (const x of prohibited) {
      if (useMatches(alias, x)) return { status: 'not-permitted', note: `${x} is a prohibited use` };
    }
  }
  if (permitted.length === 0 && conditional.length === 0) {
    return { status: 'by-right', note: 'No use restrictions on record' };
  }
  return { status: 'not-classified', note: 'Not explicitly listed in use tables — verify with municipality' };
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
    const dealType = mapProjectTypeToDealType(projectType);

    let maxDensity = profile.density_method === 'far_derived' ? null : (parseFloat(String(profile.max_density_per_acre)) || null);
    let appliedFar = profile.applied_far ? parseFloat(String(profile.applied_far)) : null;
    let residentialFAR = parseFloat(String(profile.residential_far)) || null;
    let nonresidentialFAR = parseFloat(String(profile.nonresidential_far)) || null;
    let maxHeight = parseInt(String(profile.max_height_ft)) || null;
    let maxStories = parseInt(String(profile.max_stories)) || null;
    let minParkingPerUnit = parseFloat(String(profile.min_parking_per_unit)) || null;
    let maxLotCoverage = parseFloat(String(profile.max_lot_coverage_pct)) || null;
    let densityMethod = (profile.density_method as string) || 'units_per_acre';
    let constraintSource: 'profile' | 'database' | 'ai_retrieved' = 'profile';

    const hasBaseData = maxDensity != null || appliedFar != null || maxHeight != null;
    if (!hasBaseData && profile.base_district_code) {
      console.log(`[HBU] Profile has no constraint data, resolving for ${profile.base_district_code}...`);
      const resolved = await comparisonEngine.resolveConstraints(
        profile.base_district_code, profile.municipality, profile.state
      );
      if (resolved) {
        maxDensity = resolved.maxDensity;
        appliedFar = resolved.appliedFAR;
        residentialFAR = resolved.residentialFAR;
        nonresidentialFAR = resolved.nonresidentialFAR;
        maxHeight = resolved.maxHeight;
        maxStories = resolved.maxStories;
        minParkingPerUnit = resolved.minParkingPerUnit;
        maxLotCoverage = resolved.maxLotCoverage;
        densityMethod = resolved.densityMethod || 'units_per_acre';
        constraintSource = 'ai_retrieved';
        console.log(`[HBU] Resolved constraints from fallback: FAR=${appliedFar}, density=${maxDensity}, height=${maxHeight}`);
      }
    }

    const inputs = {
      landArea: lotAreaSf,
      setbacks: {
        front: parseInt(String(profile.setback_front_ft)) || 0,
        side: parseInt(String(profile.setback_side_ft)) || 0,
        rear: parseInt(String(profile.setback_rear_ft)) || 0,
      },
      zoningConstraints: {
        maxDensity,
        maxFAR: appliedFar,
        residentialFAR,
        nonresidentialFAR,
        appliedFAR: appliedFar,
        maxHeight,
        maxStories,
        minParkingPerUnit,
        maxLotCoverage,
        densityMethod,
      },
      dealType: dealType as 'residential' | 'commercial' | 'mixed-use',
    };

    const results = envelopeService.calculateHighestBestUse(inputs);

    let permitted: string[] = [];
    let conditional: string[] = [];
    let prohibited: string[] = [];
    try {
      if (profile.base_district_code) {
        const districtResult = await pool.query(
          `SELECT permitted_uses, conditional_uses, prohibited_uses FROM zoning_districts 
           WHERE UPPER(COALESCE(zoning_code, district_code)) = UPPER($1) LIMIT 1`,
          [profile.base_district_code]
        );
        if (districtResult.rows.length > 0) {
          const d = districtResult.rows[0];
          permitted = d.permitted_uses || [];
          conditional = d.conditional_uses || [];
          prohibited = d.prohibited_uses || [];
        }
      }
    } catch (err: any) {
      console.error('[HBU] Failed to load use permissions:', err.message);
    }

    const enrichedResults = results.map((r: any) => {
      const perm = classifyUsePermission(r.propertyType, permitted, conditional, prohibited);
      return {
        ...r,
        permissionStatus: perm.status,
        permissionNote: perm.note,
      };
    });

    let benchmarkContext: any = null;
    try {
      if (profile.base_district_code) {
        const benchResult = await pool.query(
          `SELECT project_type, unit_count, total_sf, stories, land_acres, density_achieved, far_achieved, 
                  lot_coverage_achieved, entitlement_type, outcome, project_name
           FROM benchmark_projects 
           WHERE (UPPER(zoning_from) = UPPER($1) OR UPPER(zoning_to) = UPPER($1))
           AND outcome = 'approved'
           ORDER BY created_at DESC LIMIT 10`,
          [profile.base_district_code]
        );
        if (benchResult.rows.length > 0) {
          const projects = benchResult.rows;
          const avgDensity = projects.filter((p: any) => p.density_achieved).reduce((sum: number, p: any) => sum + parseFloat(p.density_achieved), 0) / (projects.filter((p: any) => p.density_achieved).length || 1);
          const avgFar = projects.filter((p: any) => p.far_achieved).reduce((sum: number, p: any) => sum + parseFloat(p.far_achieved), 0) / (projects.filter((p: any) => p.far_achieved).length || 1);
          benchmarkContext = {
            projectCount: projects.length,
            avgDensityAchieved: Math.round(avgDensity * 10) / 10 || null,
            avgFarAchieved: Math.round(avgFar * 100) / 100 || null,
            projects: projects.slice(0, 5).map((p: any) => ({
              name: p.project_name,
              type: p.project_type,
              units: p.unit_count,
              stories: p.stories,
              entitlementType: p.entitlement_type,
            })),
          };
        }
      }
    } catch (err: any) {
      console.error('[HBU] Failed to load benchmarks:', err.message);
    }

    let aiAnalysis: any = null;
    try {
      const hbuCacheKey = `hbu:${profile.base_district_code}`;
      const mun = profile.municipality || '';
      const st = profile.state || 'GA';
      const cached = await interpretationCache.getConstraints(hbuCacheKey, mun, st);
      if (cached && cached.constraints && (cached.constraints as any).hbuAnalysis) {
        aiAnalysis = (cached.constraints as any).hbuAnalysis;
        console.log(`[HBU] Cache HIT for AI analysis`);
      }

      if (!aiAnalysis && profile.base_district_code) {
        console.log(`[HBU] Generating AI analysis for ${profile.base_district_code}...`);
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const anthropic = new Anthropic({
          apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
          baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
        });
        const prompt = buildHBUPrompt(
          profile, enrichedResults, permitted, conditional, prohibited,
          benchmarkContext, lotAreaSf, constraintSource
        );

        const msg = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = null; }
          }
        }
        if (parsed && parsed.recommendation) {
          aiAnalysis = parsed;
          await interpretationCache.setConstraints(hbuCacheKey, mun, st, { hbuAnalysis: aiAnalysis } as any, {
            source: 'ai_hbu_analysis',
            confidence: aiAnalysis.confidence || 'medium',
          });
          console.log(`[HBU] AI analysis complete and cached`);
        }
      }
    } catch (err: any) {
      console.error('[HBU] AI analysis failed:', err.message);
    }

    res.json({
      hbu: enrichedResults,
      dealType,
      projectType,
      districtCode: profile.base_district_code,
      constraintSource,
      permissions: { permitted, conditional, prohibited },
      benchmarkContext,
      aiAnalysis,
    });
  } catch (error: any) {
    console.error('Error calculating HBU:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate highest & best use' });
  }
});

function buildHBUPrompt(
  profile: any,
  results: any[],
  permitted: string[],
  conditional: string[],
  prohibited: string[],
  benchmarks: any,
  lotAreaSf: number,
  constraintSource: string,
): string {
  const acres = (lotAreaSf / 43560).toFixed(2);
  const topResults = results.slice(0, 6).map(r =>
    `${r.propertyType}: ${r.maxCapacity} units/${Math.round(r.maxGFA)} SF, value $${Math.round(r.estimatedValue).toLocaleString()}, limiting=${r.limitingFactor}, permission=${r.permissionStatus}`
  ).join('\n');

  const benchSection = benchmarks
    ? `\nMarket Benchmarks (${benchmarks.projectCount} approved projects in this zone):\n- Avg density achieved: ${benchmarks.avgDensityAchieved || 'N/A'} units/acre\n- Avg FAR achieved: ${benchmarks.avgFarAchieved || 'N/A'}\n- Recent projects: ${benchmarks.projects?.map((p: any) => `${p.name} (${p.type}, ${p.units} units, ${p.entitlementType})`).join('; ') || 'none'}`
    : '\nNo market benchmarks available for this zone.';

  return `You are a real estate highest-and-best-use analyst. Analyze this property and recommend the optimal development strategy.

Property: ${acres} acres (${lotAreaSf.toLocaleString()} SF) in ${profile.municipality || 'unknown'}, ${profile.state || 'GA'}
Zoning: ${profile.base_district_code} (constraints from ${constraintSource})
Permitted uses: ${permitted.length > 0 ? permitted.join(', ') : 'not specified'}
Conditional uses: ${conditional.length > 0 ? conditional.join(', ') : 'none'}

Envelope Results:
${topResults}
${benchSection}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "recommendation": "1-2 sentence summary of the best development strategy",
  "recommendedUse": "the single best property type from the results",
  "confidence": "high|medium|low",
  "useScores": [
    {
      "propertyType": "type name",
      "profitabilityScore": 1-10,
      "approvalScore": 1-10,
      "timelineScore": 1-10,
      "compositeScore": 1-10,
      "rationale": "1 sentence why"
    }
  ],
  "mixedUseCombinations": [
    {
      "combination": "e.g. 75% multifamily / 25% retail",
      "rationale": "why this mix works",
      "estimatedUplift": "percentage or dollar estimate vs single-use"
    }
  ],
  "caveats": ["important risk or caveat 1", "caveat 2"],
  "marketInsight": "1-2 sentences about how benchmarks/market data should influence the decision"
}`;
}

router.get('/deals/:dealId/regulatory-risk-analysis', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const profileResult = await pool.query(
      'SELECT * FROM deal_zoning_profiles WHERE deal_id = $1', [dealId]
    );
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'No zoning profile. Confirm zoning first.' });
    }
    const profile = profileResult.rows[0];
    const mun = profile.municipality || '';
    const st = profile.state || 'GA';
    const districtCode = profile.base_district_code || '';

    const cacheKey = `regrisk:${districtCode}`;
    const cached = await interpretationCache.getConstraints(cacheKey, mun, st);
    if (cached && (cached.constraints as any)?.riskAnalysis) {
      console.log(`[RegRisk] Cache HIT for ${districtCode}`);
      return res.json((cached.constraints as any).riskAnalysis);
    }
    console.log(`[RegRisk] Cache MISS for ${districtCode}, generating...`);

    const dealResult = await pool.query('SELECT * FROM deals WHERE id = $1', [dealId]);
    const deal = dealResult.rows[0] || {};

    const [dlCtx, alertsResult, constraintsResult] = await Promise.all([
      dataLibraryContext.getContextForDeal({
        dealId, municipality: mun, state: st,
        propertyType: deal.project_type, zoningCode: districtCode,
        lotAreaSf: parseFloat(profile.lot_area_sf) || 0,
      }),
      pool.query(
        `SELECT title, category, severity, description, source_name, published_date
         FROM regulatory_alerts
         WHERE (municipality ILIKE $1 OR municipality IS NULL)
           AND (state = $2 OR state IS NULL)
           AND is_active = true
         ORDER BY severity DESC, published_date DESC NULLS LAST
         LIMIT 10`,
        [mun, st]
      ).catch(() => ({ rows: [] })),
      comparisonEngine.resolveConstraints(districtCode, mun, st),
    ]);

    const existingAlerts = alertsResult.rows;
    const lotAcres = ((parseFloat(profile.lot_area_sf) || 0) / 43560).toFixed(2);
    const overlays = Array.isArray(profile.overlays) ? profile.overlays : [];

    const prompt = buildRegulatoryRiskPrompt({
      municipality: mun, state: st, districtCode,
      lotAcres, propertyType: deal.project_type || 'multifamily',
      constraints: constraintsResult,
      overlays, existingAlerts,
      dataLibraryCosts: dlCtx.costSummary,
      recentProjects: dlCtx.recentProjects,
    });

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
    console.log(`[RegRisk] Claude response length: ${text.length}, stop_reason: ${msg.stop_reason}`);
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try { parsed = JSON.parse(jsonMatch[0]); } catch {
            console.log(`[RegRisk] Failed to parse response. First 500 chars:`, text.substring(0, 500));
            parsed = null;
          }
        }
      }
    }

    if (parsed && parsed.categories) {
      const result = {
        dealId,
        municipality: mun,
        state: st,
        districtCode,
        compositeScore: parsed.compositeScore || 0,
        compositeLevel: parsed.compositeLevel || 'moderate',
        categories: parsed.categories,
        strategyMatrix: parsed.strategyMatrix || [],
        alerts: parsed.alerts || [],
        mitigationStrategies: parsed.mitigationStrategies || [],
        dataLibraryContext: {
          hasImpactFees: dlCtx.impactFees.length > 0,
          hasConstructionCosts: dlCtx.constructionCosts.length > 0,
          hasRentComps: dlCtx.rentComps.length > 0,
          recentProjectCount: dlCtx.recentProjects.length,
          permitTimelineCount: dlCtx.permitTimelines.length,
        },
        generatedAt: new Date().toISOString(),
      };

      await interpretationCache.setConstraints(cacheKey, mun, st, { riskAnalysis: result } as any, {
        source: 'ai_regulatory_risk',
        confidence: 'medium',
      });
      console.log(`[RegRisk] Analysis complete and cached`);
      return res.json(result);
    }

    res.status(500).json({ error: 'AI analysis failed to produce valid results' });
  } catch (error: any) {
    console.error('Error generating regulatory risk analysis:', error);
    res.status(500).json({ error: error.message || 'Failed to generate regulatory risk analysis' });
  }
});

function buildRegulatoryRiskPrompt(params: {
  municipality: string;
  state: string;
  districtCode: string;
  lotAcres: string;
  propertyType: string;
  constraints: any;
  overlays: any[];
  existingAlerts: any[];
  dataLibraryCosts: string;
  recentProjects: any[];
}): string {
  const { municipality, state, districtCode, lotAcres, propertyType, constraints, overlays, existingAlerts, dataLibraryCosts, recentProjects } = params;

  const constraintSection = constraints
    ? `Zoning Constraints: FAR=${constraints.appliedFAR || 'N/A'}, Height=${constraints.maxHeight || 'N/A'}ft, Stories=${constraints.maxStories || 'N/A'}, Parking=${constraints.minParkingPerUnit ?? 'N/A'}/unit, Density Method=${constraints.densityMethod || 'N/A'}`
    : 'No resolved constraints available.';

  const overlaySection = overlays.length > 0
    ? `Active Overlays: ${overlays.map((o: any) => `${o.name || o.code} (parking: ${o.modifications?.min_parking_per_unit ?? 'standard'})`).join(', ')}`
    : 'No overlay districts.';

  const alertSection = existingAlerts.length > 0
    ? `Known Regulatory Alerts in DB:\n${existingAlerts.map(a => `  - [${a.severity}] ${a.title}: ${a.description || ''} (${a.source_name || 'unknown source'})`).join('\n')}`
    : 'No existing regulatory alerts in database.';

  const projectSection = recentProjects.length > 0
    ? `Recent Approved Projects (${recentProjects.length}):\n${recentProjects.slice(0, 8).map(p =>
        `  - ${p.name}: ${p.type}, ${p.units || '?'} units, ${p.entitlementType || '?'} path${p.timelineDays ? `, ${p.timelineDays}d` : ''}`
      ).join('\n')}`
    : 'No recent project data available.';

  return `You are a regulatory risk analyst specializing in real estate development entitlements. Analyze the regulatory environment for this specific development site and provide a quantitative risk assessment.

PROPERTY CONTEXT:
- Location: ${municipality}, ${state}
- Zoning: ${districtCode}
- Lot Size: ${lotAcres} acres
- Proposed Use: ${propertyType}
- ${constraintSection}
- ${overlaySection}

EXISTING DATA:
${alertSection}

${projectSection}

COST & MARKET DATA FROM DATA LIBRARY:
${dataLibraryCosts}

INSTRUCTIONS:
Assess regulatory risk across 8 categories. Use real cost figures from the Data Library when available. For ${municipality}, ${state} specifically:
- Research current impact fee schedules, permit timeline trends, inclusionary requirements
- Consider recent legislative activity, pending ordinances, political climate
- Factor in the specific zoning district (${districtCode}) and any overlay impacts
- Use the benchmark project data to inform realistic timeline and approval estimates

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "compositeScore": 0-100,
  "compositeLevel": "low|moderate|elevated|high",
  "categories": [
    {
      "category": "zoning_stability",
      "label": "Zoning Stability",
      "level": "low|moderate|elevated|high",
      "score": 0-100,
      "trend": "improving|stable|worsening",
      "impact": "1-2 sentence specific impact description with real numbers when available",
      "costImpact": "$X per unit or total dollar estimate if applicable, null if not",
      "source": "what data informed this assessment"
    },
    {
      "category": "permit_timeline",
      "label": "Permit Timeline",
      "level": "...", "score": 0-100, "trend": "...",
      "impact": "...", "costImpact": "...", "source": "..."
    },
    {
      "category": "impact_fees",
      "label": "Impact Fees",
      "level": "...", "score": 0-100, "trend": "...",
      "impact": "Include actual $/unit from Data Library if available",
      "costImpact": "...", "source": "..."
    },
    {
      "category": "inclusionary_housing",
      "label": "Inclusionary Housing",
      "level": "...", "score": 0-100, "trend": "...",
      "impact": "...", "costImpact": "...", "source": "..."
    },
    {
      "category": "rent_control",
      "label": "Rent Control Risk",
      "level": "...", "score": 0-100, "trend": "...",
      "impact": "...", "costImpact": "...", "source": "..."
    },
    {
      "category": "str_regulation",
      "label": "STR Regulation",
      "level": "...", "score": 0-100, "trend": "...",
      "impact": "...", "costImpact": "...", "source": "..."
    },
    {
      "category": "environmental",
      "label": "Environmental",
      "level": "...", "score": 0-100, "trend": "...",
      "impact": "...", "costImpact": "...", "source": "..."
    },
    {
      "category": "historic_preservation",
      "label": "Historic Preservation",
      "level": "...", "score": 0-100, "trend": "...",
      "impact": "...", "costImpact": "...", "source": "..."
    }
  ],
  "strategyMatrix": [
    {
      "strategy": "Build-to-Sell",
      "level": "favorable|moderate|elevated|unfavorable",
      "description": "1 sentence with specific cost/timeline impacts"
    },
    {
      "strategy": "Flip/Value-Add",
      "level": "...", "description": "..."
    },
    {
      "strategy": "Long-Term Rental",
      "level": "...", "description": "..."
    },
    {
      "strategy": "Short-Term Rental",
      "level": "...", "description": "..."
    }
  ],
  "alerts": [
    {
      "severity": "urgent|watch|opportunity",
      "title": "Specific alert title",
      "impact": "What it means for this deal",
      "probability": "X%",
      "source": "Where this info comes from",
      "timeframe": "When this takes effect"
    }
  ],
  "mitigationStrategies": [
    "Specific actionable mitigation strategy 1",
    "Strategy 2"
  ]
}`;
}

router.get('/deals/:dealId/timeline-intelligence', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const developmentPath = (req.query.path as string) || 'by_right';

    const profileResult = await pool.query(
      'SELECT * FROM deal_zoning_profiles WHERE deal_id = $1', [dealId]
    );
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'No zoning profile. Confirm zoning first.' });
    }
    const profile = profileResult.rows[0];
    const mun = profile.municipality || '';
    const st = profile.state || 'GA';
    const districtCode = profile.base_district_code || '';

    const cacheKey = `tts:${dealId}:${districtCode}:${developmentPath}`;
    const cached = await interpretationCache.getConstraints(cacheKey, mun, st);
    if (cached && (cached.constraints as any)?.timelineIntelligence) {
      console.log(`[TTS-AI] Cache HIT for ${dealId}:${districtCode}:${developmentPath}`);
      return res.json((cached.constraints as any).timelineIntelligence);
    }
    console.log(`[TTS-AI] Cache MISS for ${dealId}:${districtCode}:${developmentPath}, generating...`);

    const dealResult = await pool.query('SELECT * FROM deals WHERE id = $1', [dealId]);
    const deal = dealResult.rows[0] || {};

    const [dlCtx, benchmarkResult, constraintsResult] = await Promise.all([
      dataLibraryContext.getContextForDeal({
        dealId, municipality: mun, state: st,
        propertyType: deal.project_type, zoningCode: districtCode,
        lotAreaSf: parseFloat(profile.lot_area_sf) || 0,
      }),
      pool.query(
        `SELECT project_name, project_type, unit_count, entitlement_type,
                total_entitlement_days, pre_app_days, site_plan_review_days,
                zoning_hearing_days, approval_days, permit_issuance_days,
                outcome, application_date, approval_date, address
         FROM benchmark_projects
         WHERE (municipality ILIKE $1 OR county ILIKE $2) AND state = $3
           AND outcome IN ('approved', 'modified')
         ORDER BY approval_date DESC NULLS LAST
         LIMIT 20`,
        [mun, `%${mun}%`, st]
      ).catch(() => ({ rows: [] })),
      comparisonEngine.resolveConstraints(districtCode, mun, st),
    ]);

    const benchmarks = benchmarkResult.rows;
    const lotAcres = ((parseFloat(profile.lot_area_sf) || 0) / 43560).toFixed(2);
    const unitCount = deal.unit_count || Math.round(parseFloat(profile.lot_area_sf || '0') * (constraintsResult?.appliedFAR || 1) / 900);
    const overlays = Array.isArray(profile.overlays) ? profile.overlays : [];

    const pathBenchmarks = benchmarks.filter((b: any) => {
      if (developmentPath === 'rezone') return b.entitlement_type === 'rezone';
      if (developmentPath === 'variance') return b.entitlement_type === 'variance';
      return b.entitlement_type === 'by_right' || b.entitlement_type === 'site_plan';
    });

    const benchmarkSummary = benchmarks.length > 0
      ? `Benchmark Projects (${benchmarks.length} total, ${pathBenchmarks.length} matching ${developmentPath} path):\n` +
        benchmarks.slice(0, 12).map((b: any) => {
          const days = b.total_entitlement_days || 'unknown';
          return `  - ${b.project_name || b.address || 'Project'}: ${b.entitlement_type}, ${b.unit_count || '?'} units, ${days} days total, outcome=${b.outcome}`;
        }).join('\n')
      : 'No benchmark projects available for this jurisdiction.';

    const prompt = `You are a real estate development timeline strategist analyzing entitlement timelines for a specific deal. Provide actionable intelligence about the expected timeline.

PROPERTY CONTEXT:
- Location: ${mun}, ${st}
- Zoning: ${districtCode}
- Lot Size: ${lotAcres} acres
- Proposed Use: ${deal.project_type || 'multifamily'}
- Estimated Units: ${unitCount}
- Selected Path: ${developmentPath}
- Overlays: ${overlays.map((o: any) => o.name || o.code).join(', ') || 'None'}
- Constraints: FAR=${constraintsResult?.appliedFAR || 'N/A'}, Height=${constraintsResult?.maxHeight || 'N/A'}ft, Parking=${constraintsResult?.minParkingPerUnit ?? 'N/A'}/unit

${benchmarkSummary}

COST & MARKET DATA:
${dlCtx.costSummary}

INSTRUCTIONS:
Based on the benchmark project data, zoning constraints, and the selected ${developmentPath} entitlement path, provide a timeline intelligence assessment. Use REAL numbers from the benchmarks when available. Be specific to ${mun}, ${st}.

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "estimatedMonths": {
    "optimistic": <number>,
    "expected": <number>,
    "worstCase": <number>
  },
  "shovelDateRange": {
    "earliest": "<month year>",
    "likely": "<month year>",
    "latest": "<month year>"
  },
  "riskFactors": [
    {
      "factor": "<specific risk factor>",
      "severity": "low|moderate|high",
      "impact": "<1-2 sentences, specific to this deal>",
      "mitigation": "<specific action to mitigate>"
    }
  ],
  "pathInsights": {
    "summary": "<2-3 sentences about why ${developmentPath} was chosen and how it compares>",
    "advantages": ["<specific advantage 1>", "<advantage 2>"],
    "challenges": ["<specific challenge 1>", "<challenge 2>"],
    "alternativePath": "<which path might be faster and by how much, if any>"
  },
  "benchmarkComparison": {
    "summary": "<1-2 sentences comparing this deal to benchmark projects>",
    "fastestComparable": "<name of fastest comparable project and its timeline>",
    "slowestComparable": "<name of slowest comparable project and its timeline>",
    "avgDays": <average days from benchmarks or null>
  },
  "recommendations": [
    "<specific actionable recommendation 1>",
    "<recommendation 2>",
    "<recommendation 3>"
  ],
  "criticalMilestones": [
    {
      "milestone": "<milestone name>",
      "estimatedMonth": <month number from start>,
      "criticalPath": true|false,
      "note": "<brief note>"
    }
  ]
}`;

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
    console.log(`[TTS-AI] Claude response length: ${text.length}, stop_reason: ${msg.stop_reason}`);

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try { parsed = JSON.parse(jsonMatch[0]); } catch {
            console.log(`[TTS-AI] Failed to parse. First 500 chars:`, text.substring(0, 500));
          }
        }
      }
    }

    if (parsed && parsed.riskFactors) {
      const result = {
        dealId,
        municipality: mun,
        state: st,
        districtCode,
        developmentPath,
        estimatedMonths: parsed.estimatedMonths || { optimistic: 6, expected: 12, worstCase: 24 },
        shovelDateRange: parsed.shovelDateRange || {},
        riskFactors: parsed.riskFactors || [],
        pathInsights: parsed.pathInsights || {},
        benchmarkComparison: parsed.benchmarkComparison || {},
        recommendations: parsed.recommendations || [],
        criticalMilestones: parsed.criticalMilestones || [],
        dataLibraryContext: {
          benchmarkCount: benchmarks.length,
          pathBenchmarkCount: pathBenchmarks.length,
          hasPermitTimelines: dlCtx.permitTimelines.length > 0,
          hasCostData: dlCtx.impactFees.length > 0 || dlCtx.constructionCosts.length > 0,
        },
        generatedAt: new Date().toISOString(),
      };

      await interpretationCache.setConstraints(cacheKey, mun, st, { timelineIntelligence: result } as any, {
        source: 'ai_timeline_intelligence',
        confidence: 'medium',
      });
      console.log(`[TTS-AI] Analysis complete and cached`);
      return res.json(result);
    }

    res.status(500).json({ error: 'AI timeline analysis failed to produce valid results' });
  } catch (error: any) {
    console.error('Error generating timeline intelligence:', error);
    res.status(500).json({ error: error.message || 'Failed to generate timeline intelligence' });
  }
});

router.get('/deals/:dealId/scenarios/recommendations', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const varianceDensityPct = parseFloat(req.query.variance_density_pct as string) || 20;
    const rezoneTargetCode = (req.query.rezone_target_code as string) || null;
    const avgUnitSizeSf = req.query.avg_unit_size_sf ? parseFloat(req.query.avg_unit_size_sf as string) : null;

    const result = await comparisonEngine.compare(dealId, { varianceDensityPct, rezoneTargetCode, avgUnitSizeSf });

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

router.post('/deals/:dealId/scenarios/deactivate-all', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    await pool.query(
      'UPDATE development_scenarios SET is_active = false, updated_at = NOW() WHERE deal_id = $1',
      [dealId]
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deactivating scenarios:', error);
    res.status(500).json({ error: error.message || 'Failed to deactivate scenarios' });
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
