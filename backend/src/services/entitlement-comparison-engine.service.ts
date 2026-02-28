import { Pool } from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import { BuildingEnvelopeService, PropertyType, ZoningConstraints } from './building-envelope.service';
import { RezoneAnalysisService } from './rezone-analysis.service';
import { ZoningRecommendationOrchestrator } from './zoning-recommendation-orchestrator.service';
import { ZoningAgentService } from './zoning-agent.service';
import { ZoningProfile } from './zoning-profile.service';
import { municodeUrlService } from './municode-url.service';
import { ZoningInterpretationCache } from './zoning-interpretation-cache.service';

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export interface SubjectProperty {
  lotAreaSf: number;
  setbacks: { front: number; side: number; rear: number };
  propertyType: PropertyType;
  dealType: 'residential' | 'commercial' | 'mixed-use';
  baseDistrictCode: string | null;
  municipality: string | null;
  state: string | null;
  overlays: any[];
  densityMethod: string;
  profile: ZoningProfile;
}

export interface ComparisonColumn {
  key: string;
  label: string;
  zoningCode: string | null;
  risk: string;
  successRate: string;
  timeline: string;
  aiInsight: string;
  source: string;
}

export interface ComparisonRow {
  key: string;
  label: string;
}

export interface ComparisonResult {
  columns: ComparisonColumn[];
  rows: ComparisonRow[];
  cells: Record<string, Record<string, string>>;
  aiSummary: string;
  variancePct: number;
  baseDistrictCode: string | null;
}

interface ResolvedConstraints {
  maxDensity: number | null;
  maxFAR: number | null;
  appliedFAR: number | null;
  residentialFAR: number | null;
  nonresidentialFAR: number | null;
  maxHeight: number | null;
  maxStories: number | null;
  minParkingPerUnit: number | null;
  maxLotCoverage: number | null;
  densityMethod: string;
}

interface ComputedPath {
  key: string;
  label: string;
  zoningCode: string | null;
  risk: string;
  successRate: string;
  timeline: string;
  source: string;
  metrics: {
    maxUnits: number;
    maxGba: number;
    maxStories: number;
    appliedFar: number | null;
    maxDensity: number | null;
    maxHeight: number | null;
    parkingRequired: number;
    bindingConstraint: string;
  };
  description: string;
}

export class EntitlementComparisonEngine {
  constructor(
    private pool: Pool,
    private envelopeService: BuildingEnvelopeService,
    private rezoneService: RezoneAnalysisService,
    private orchestrator: ZoningRecommendationOrchestrator,
    private agentService: ZoningAgentService,
    private cache: ZoningInterpretationCache,
  ) {}

  async compare(dealId: string, options?: {
    varianceDensityPct?: number;
    rezoneTargetCode?: string | null;
    avgUnitSizeSf?: number | null;
  }): Promise<ComparisonResult> {
    const variancePct = options?.varianceDensityPct ?? 20;
    const rezoneTargetCode = options?.rezoneTargetCode || null;
    const avgUnitSizeOverride = options?.avgUnitSizeSf || null;

    const profileResult = await this.pool.query(
      'SELECT * FROM deal_zoning_profiles WHERE deal_id = $1', [dealId]
    );
    if (profileResult.rows.length === 0) {
      throw new Error('No zoning profile exists. Confirm zoning first.');
    }
    const profile = profileResult.rows[0] as ZoningProfile;

    const dealResult = await this.pool.query(
      'SELECT project_type FROM deals WHERE id = $1', [dealId]
    );
    const projectType = dealResult.rows[0]?.project_type || 'multifamily';

    const subject = this.buildSubject(profile, projectType);

    let baseConstraints = this.extractBaseConstraints(profile);

    const hasBaseData = baseConstraints.maxDensity != null || baseConstraints.maxFAR != null || baseConstraints.maxHeight != null;
    if (!hasBaseData && profile.base_district_code) {
      console.log(`[EntitlementEngine] Profile has no constraint data, resolving for ${profile.base_district_code}...`);
      const resolved = await this.resolveConstraints(profile.base_district_code, profile.municipality, profile.state);
      if (resolved) {
        baseConstraints = resolved;
        console.log(`[EntitlementEngine] Resolved constraints from fallback for ${profile.base_district_code}`);
      }
    }

    const computedPaths: ComputedPath[] = [];

    console.log('[EntitlementEngine] Starting comparison for deal:', dealId);

    const byRight = this.computeByRight(subject, baseConstraints, avgUnitSizeOverride);
    computedPaths.push(byRight);
    console.log('[EntitlementEngine] By-right computed');

    const variance = this.computeVariance(subject, baseConstraints, variancePct, avgUnitSizeOverride);
    computedPaths.push(variance);
    console.log('[EntitlementEngine] Variance computed');

    const overlayPaths = await this.computeOverlays(subject, baseConstraints, profile, avgUnitSizeOverride);
    computedPaths.push(...overlayPaths);
    console.log(`[EntitlementEngine] Overlays computed: ${overlayPaths.length} found`);

    const rezone = await this.computeRezone(subject, baseConstraints, rezoneTargetCode, dealId, profile, avgUnitSizeOverride);
    computedPaths.push(rezone);
    console.log('[EntitlementEngine] Rezone computed');

    let municodeUrls: Record<string, string> = {};
    try {
      if (profile.municipality) {
        const municipalityId = `${(profile.municipality as string).toLowerCase().replace(/\s+/g, '-')}-${(profile.state || 'ga').toLowerCase()}`;
        const codes = [...new Set(computedPaths.map(p => p.zoningCode).filter(Boolean))] as string[];
        for (const code of codes) {
          try {
            const url = await municodeUrlService.buildDistrictUrl(municipalityId, code);
            if (url) municodeUrls[code] = url;
          } catch {}
        }
      }
    } catch {}
    console.log('[EntitlementEngine] Municode URLs resolved');

    let aiAnalysis: { insights: Record<string, string>; summary: string; extraRows: ComparisonRow[] } = {
      insights: {},
      summary: '',
      extraRows: [],
    };
    try {
      console.log('[EntitlementEngine] Starting AI analysis...');
      aiAnalysis = await this.generateAIAnalysis(subject, computedPaths, municodeUrls);
      console.log('[EntitlementEngine] AI analysis complete');
    } catch (err: any) {
      console.error('[EntitlementEngine] AI analysis failed, continuing without insights:', err.message);
    }

    return this.assembleResult(computedPaths, byRight, aiAnalysis, variancePct, profile.base_district_code);
  }

  private buildSubject(profile: ZoningProfile, projectType: string): SubjectProperty {
    const propTypeMap: Record<string, PropertyType> = {
      multifamily: 'multifamily', residential: 'multifamily',
      office: 'office', retail: 'retail', industrial: 'industrial',
      hospitality: 'hospitality', mixed_use: 'mixed-use', 'mixed-use': 'mixed-use',
    };
    const dealTypeMap = (pt: string): 'residential' | 'commercial' | 'mixed-use' => {
      const p = (pt || '').toLowerCase();
      if (['multifamily', 'residential'].includes(p)) return 'residential';
      if (['office', 'retail', 'industrial', 'hospitality', 'special_purpose'].includes(p)) return 'commercial';
      if (p === 'mixed_use' || p === 'mixed-use') return 'mixed-use';
      return 'residential';
    };

    return {
      lotAreaSf: parseFloat(String(profile.lot_area_sf)) || 0,
      setbacks: {
        front: parseInt(String(profile.setback_front_ft)) || 0,
        side: parseInt(String(profile.setback_side_ft)) || 0,
        rear: parseInt(String(profile.setback_rear_ft)) || 0,
      },
      propertyType: propTypeMap[projectType] || 'multifamily',
      dealType: dealTypeMap(projectType),
      baseDistrictCode: profile.base_district_code,
      municipality: profile.municipality,
      state: profile.state,
      overlays: Array.isArray(profile.overlays) ? profile.overlays : [],
      densityMethod: profile.density_method || 'units_per_acre',
      profile,
    };
  }

  private extractBaseConstraints(profile: ZoningProfile): ResolvedConstraints {
    return {
      maxDensity: profile.density_method === 'far_derived' ? null : (parseFloat(String(profile.max_density_per_acre)) || null),
      maxFAR: profile.applied_far ? parseFloat(String(profile.applied_far)) : null,
      appliedFAR: profile.applied_far ? parseFloat(String(profile.applied_far)) : null,
      residentialFAR: parseFloat(String(profile.residential_far)) || null,
      nonresidentialFAR: parseFloat(String(profile.nonresidential_far)) || null,
      maxHeight: parseInt(String(profile.max_height_ft)) || null,
      maxStories: parseInt(String(profile.max_stories)) || null,
      minParkingPerUnit: parseFloat(String(profile.min_parking_per_unit)) || null,
      maxLotCoverage: parseFloat(String(profile.max_lot_coverage_pct)) || null,
      densityMethod: profile.density_method || 'units_per_acre',
    };
  }

  private computeEnvelope(subject: SubjectProperty, constraints: ResolvedConstraints, avgUnitSizeOverride?: number | null) {
    return this.envelopeService.calculateEnvelope({
      landArea: subject.lotAreaSf,
      setbacks: subject.setbacks,
      zoningConstraints: constraints as any,
      propertyType: subject.propertyType,
      dealType: subject.dealType,
      avgUnitSizeOverride: avgUnitSizeOverride || null,
    });
  }

  private computeByRight(subject: SubjectProperty, constraints: ResolvedConstraints, avgUnitSizeOverride?: number | null): ComputedPath {
    const envelope = this.computeEnvelope(subject, constraints, avgUnitSizeOverride);
    return {
      key: 'byRight',
      label: 'By-Right',
      zoningCode: subject.baseDistrictCode,
      risk: 'Low',
      successRate: '95%',
      timeline: '3-6 months',
      source: 'by-right',
      description: 'Development under existing zoning with no approvals beyond standard permits.',
      metrics: {
        maxUnits: envelope.maxCapacity,
        maxGba: Math.round(envelope.maxGFA),
        maxStories: envelope.maxFloors,
        appliedFar: constraints.appliedFAR,
        maxDensity: constraints.maxDensity,
        maxHeight: constraints.maxHeight,
        parkingRequired: envelope.parkingRequired,
        bindingConstraint: envelope.limitingFactor,
      },
    };
  }

  private computeVariance(subject: SubjectProperty, baseConstraints: ResolvedConstraints, pct: number, avgUnitSizeOverride?: number | null): ComputedPath {
    const densityMultiplier = 1 + (pct / 100);
    const farMultiplier = 1 + (pct * 0.75 / 100);
    const varianceConstraints: ResolvedConstraints = {
      ...baseConstraints,
      maxDensity: baseConstraints.maxDensity != null ? baseConstraints.maxDensity * densityMultiplier : null,
      maxFAR: baseConstraints.maxFAR != null ? baseConstraints.maxFAR * farMultiplier : null,
      appliedFAR: baseConstraints.appliedFAR != null ? baseConstraints.appliedFAR * farMultiplier : null,
      residentialFAR: baseConstraints.residentialFAR != null ? baseConstraints.residentialFAR * farMultiplier : null,
      nonresidentialFAR: baseConstraints.nonresidentialFAR != null ? baseConstraints.nonresidentialFAR * farMultiplier : null,
      maxHeight: baseConstraints.maxHeight != null ? baseConstraints.maxHeight + Math.round(pct * 0.5) : null,
      minParkingPerUnit: baseConstraints.minParkingPerUnit != null ? baseConstraints.minParkingPerUnit * 0.85 : null,
    };
    const envelope = this.computeEnvelope(subject, varianceConstraints, avgUnitSizeOverride);
    return {
      key: 'variance',
      label: `Variance (+${pct}%)`,
      zoningCode: subject.baseDistrictCode,
      risk: pct <= 15 ? 'Low' : pct <= 30 ? 'Medium' : 'High',
      successRate: pct <= 15 ? '75-85%' : pct <= 30 ? '60-75%' : '40-55%',
      timeline: '6-12 months',
      source: 'variance-multiplier',
      description: `Request +${pct}% density deviation through Board of Zoning Appeals.`,
      metrics: {
        maxUnits: envelope.maxCapacity,
        maxGba: Math.round(envelope.maxGFA),
        maxStories: envelope.maxFloors,
        appliedFar: varianceConstraints.appliedFAR,
        maxDensity: varianceConstraints.maxDensity,
        maxHeight: varianceConstraints.maxHeight,
        parkingRequired: envelope.parkingRequired,
        bindingConstraint: envelope.limitingFactor,
      },
    };
  }

  private async computeOverlays(
    subject: SubjectProperty,
    baseConstraints: ResolvedConstraints,
    profile: ZoningProfile,
    avgUnitSizeOverride?: number | null,
  ): Promise<ComputedPath[]> {
    const profileOverlays = Array.isArray(profile.overlays) ? profile.overlays : [];

    let overlayDistricts: string[] = [];
    try {
      if (subject.baseDistrictCode) {
        const distResult = await this.pool.query(
          `SELECT overlay_districts FROM zoning_districts
           WHERE UPPER(COALESCE(zoning_code, district_code)) = UPPER($1) LIMIT 1`,
          [subject.baseDistrictCode]
        );
        if (distResult.rows[0]?.overlay_districts) {
          overlayDistricts = distResult.rows[0].overlay_districts;
        }
      }
    } catch {}

    const overlayDbResult = await this.pool.query(
      `SELECT * FROM zoning_overlays
       WHERE municipality = $1 OR municipality IS NULL
       ORDER BY created_at DESC LIMIT 10`,
      [subject.municipality]
    );

    const candidateOverlays: Array<{ code: string; name: string; source: any }> = [];
    const seenCodes = new Set<string>();

    for (const ov of profileOverlays) {
      const code = (ov.code || ov.name || '').toUpperCase();
      if (code && !seenCodes.has(code)) {
        seenCodes.add(code);
        const dbMatch = overlayDbResult.rows.find((r: any) =>
          (r.overlay_code || '').toUpperCase() === code || (r.overlay_name || '').toUpperCase() === code
        );
        const displayName = (dbMatch as any)?.overlay_name || ov.name || code;
        candidateOverlays.push({ code, name: displayName, source: dbMatch || ov });
      }
    }

    for (const distCode of overlayDistricts) {
      const code = distCode.toUpperCase();
      if (code && !seenCodes.has(code)) {
        seenCodes.add(code);
        const dbMatch = overlayDbResult.rows.find((r: any) =>
          (r.overlay_code || '').toUpperCase() === code || (r.overlay_name || '').toUpperCase() === code
        );
        const displayName = (dbMatch as any)?.overlay_name || distCode;
        candidateOverlays.push({ code, name: displayName, source: dbMatch || { name: distCode, code: distCode } });
      }
    }

    if (candidateOverlays.length === 0) {
      for (const dbRow of overlayDbResult.rows) {
        const code = ((dbRow as any).overlay_code || (dbRow as any).overlay_name || '').toUpperCase();
        if (code && !seenCodes.has(code)) {
          seenCodes.add(code);
          candidateOverlays.push({ code, name: (dbRow as any).overlay_name || (dbRow as any).overlay_code || code, source: dbRow });
          if (candidateOverlays.length >= 3) break;
        }
      }
    }

    if (candidateOverlays.length === 0) return [];

    const paths: ComputedPath[] = [];

    for (let i = 0; i < candidateOverlays.length && i < 3; i++) {
      const candidate = candidateOverlays[i];
      const path = await this.computeSingleOverlay(subject, baseConstraints, candidate.source, candidate.code, candidate.name, i, avgUnitSizeOverride);
      if (path) paths.push(path);
    }

    return paths;
  }

  private async computeSingleOverlay(
    subject: SubjectProperty,
    baseConstraints: ResolvedConstraints,
    activeOverlay: any,
    overlayCode: string,
    overlayName: string,
    index: number,
    avgUnitSizeOverride?: number | null,
  ): Promise<ComputedPath | null> {
    let overlayConstraints: ResolvedConstraints = { ...baseConstraints };

    if (activeOverlay.modifications) {
      const mods = activeOverlay.modifications;
      if (mods.max_density_per_acre != null) overlayConstraints.maxDensity = mods.max_density_per_acre;
      if (mods.applied_far != null) overlayConstraints.appliedFAR = mods.applied_far;
      if (mods.max_far != null) overlayConstraints.maxFAR = mods.max_far;
      if (mods.max_height_ft != null) overlayConstraints.maxHeight = mods.max_height_ft;
      if (mods.max_stories != null) overlayConstraints.maxStories = mods.max_stories;
      if (mods.min_parking_per_unit != null) overlayConstraints.minParkingPerUnit = mods.min_parking_per_unit;
      if (mods.max_lot_coverage_pct != null) overlayConstraints.maxLotCoverage = mods.max_lot_coverage_pct;
    }

    if (activeOverlay.capacity_modifier && activeOverlay.capacity_modifier !== 1) {
      const mod = parseFloat(activeOverlay.capacity_modifier);
      if (!isNaN(mod) && mod > 0) {
        if (overlayConstraints.maxDensity) overlayConstraints.maxDensity *= mod;
        if (overlayConstraints.maxFAR) overlayConstraints.maxFAR *= mod;
        if (overlayConstraints.appliedFAR) overlayConstraints.appliedFAR *= mod;
      }
    }

    const overlayMun = subject.municipality || '';
    const overlaySt = subject.state || 'GA';
    const cachedOverlay = await this.cache.getConstraints(overlayCode, overlayMun, overlaySt);
    if (cachedOverlay) {
      console.log(`[Cache] HIT overlay constraint: ${overlayCode}`);
      const c = cachedOverlay.constraints;
      if ((c as any).maxDensity != null && !activeOverlay.modifications?.max_density_per_acre) {
        overlayConstraints.maxDensity = (c as any).maxDensity;
      }
      if ((c as any).maxFAR != null && !activeOverlay.modifications?.max_far) {
        overlayConstraints.maxFAR = (c as any).maxFAR;
        overlayConstraints.appliedFAR = (c as any).appliedFAR || (c as any).maxFAR;
      }
      if ((c as any).maxHeight != null && !activeOverlay.modifications?.max_height_ft) {
        overlayConstraints.maxHeight = (c as any).maxHeight;
      }
      if ((c as any).maxStories != null && !activeOverlay.modifications?.max_stories) {
        overlayConstraints.maxStories = (c as any).maxStories;
      }
      if ((c as any).minParkingPerUnit != null && !activeOverlay.modifications?.min_parking_per_unit) {
        overlayConstraints.minParkingPerUnit = (c as any).minParkingPerUnit;
      }
    } else {
      console.log(`[Cache] MISS overlay constraint: ${overlayCode}`);
      try {
        const agentData = await this.agentService.retrieveZoningData({
          districtCode: overlayCode,
          municipality: overlayMun,
          state: overlaySt,
        });
        if (agentData.success && agentData.district) {
          const d = agentData.district;
          if (d.max_density_per_acre != null && !activeOverlay.modifications?.max_density_per_acre) {
            overlayConstraints.maxDensity = d.max_density_per_acre;
          }
          if (d.max_far != null && !activeOverlay.modifications?.max_far) {
            overlayConstraints.maxFAR = d.max_far;
            overlayConstraints.appliedFAR = d.max_far;
          }
          if (d.max_building_height_ft != null && !activeOverlay.modifications?.max_height_ft) {
            overlayConstraints.maxHeight = d.max_building_height_ft;
          }
          if (d.max_stories != null && !activeOverlay.modifications?.max_stories) {
            overlayConstraints.maxStories = d.max_stories;
          }
          if (d.parking_per_unit != null && !activeOverlay.modifications?.min_parking_per_unit) {
            overlayConstraints.minParkingPerUnit = d.parking_per_unit;
          }
          await this.cache.setConstraints(overlayCode, overlayMun, overlaySt, overlayConstraints, {
            source: 'ai_retrieved',
            confidence: agentData.confidence || 'medium',
          });
        }
      } catch {}
    }

    const envelope = this.computeEnvelope(subject, overlayConstraints, avgUnitSizeOverride);

    const key = index === 0 ? 'overlay' : `overlay_${index}`;

    return {
      key,
      label: `Overlay: ${overlayName}`,
      zoningCode: overlayCode,
      risk: 'Low',
      successRate: '90%',
      timeline: '3-6 months',
      source: 'overlay',
      description: `Development standards modified by ${overlayName} overlay district.`,
      metrics: {
        maxUnits: envelope.maxCapacity,
        maxGba: Math.round(envelope.maxGFA),
        maxStories: envelope.maxFloors,
        appliedFar: overlayConstraints.appliedFAR,
        maxDensity: overlayConstraints.maxDensity,
        maxHeight: overlayConstraints.maxHeight,
        parkingRequired: envelope.parkingRequired,
        bindingConstraint: envelope.limitingFactor,
      },
    };
  }

  private async computeRezone(
    subject: SubjectProperty,
    baseConstraints: ResolvedConstraints,
    targetCode: string | null,
    dealId: string,
    profile: ZoningProfile,
    avgUnitSizeOverride?: number | null,
  ): Promise<ComputedPath> {
    if (targetCode) {
      return await this.computeRezoneFromCode(subject, baseConstraints, targetCode, avgUnitSizeOverride);
    }

    try {
      const orchestratorRec = await this.orchestrator.getOrAnalyze(dealId);
      if (orchestratorRec?.topRecommendation) {
        const top = orchestratorRec.topRecommendation;
        const riskLevel = top.approvalRate !== null
          ? (top.approvalRate >= 80 ? 'Low' : top.approvalRate >= 50 ? 'Medium' : 'High')
          : 'High';
        const timeline = top.avgTimelineDays
          ? `${Math.round(top.avgTimelineDays / 30)}-${Math.round(top.avgTimelineDays / 30) + 6} months`
          : '12-24 months';
        return {
          key: 'rezone',
          label: `Rezone to ${top.code}`,
          zoningCode: top.code,
          risk: riskLevel,
          successRate: top.approvalRate !== null ? `${top.approvalRate}%` : '35-50%',
          timeline,
          source: 'orchestrator',
          description: `Rezone to ${top.code} (${top.districtName || 'higher-density district'}). ${top.reasoning}`,
          metrics: {
            maxUnits: top.envelope?.maxUnits || 0,
            maxGba: top.envelope?.maxGFA || 0,
            maxStories: top.envelope?.maxFloors || 0,
            appliedFar: null,
            maxDensity: null,
            maxHeight: null,
            parkingRequired: 0,
            bindingConstraint: top.envelope?.limitingFactor || 'unknown',
          },
        };
      }
    } catch {}

    try {
      if (subject.baseDistrictCode && subject.municipality) {
        const rezoneData = await this.rezoneService.analyze({
          currentDistrictCode: subject.baseDistrictCode,
          municipality: subject.municipality,
          lotAreaSf: subject.lotAreaSf,
          propertyType: subject.propertyType,
          dealType: subject.dealType,
        });
        if (rezoneData.bestTarget) {
          const best = rezoneData.bestTarget;
          const ev = best.evidence;
          const hasEvidence = ev && ev.count > 0;
          return {
            key: 'rezone',
            label: `Rezone to ${best.targetDistrictCode}`,
            zoningCode: best.targetDistrictCode,
            risk: best.risk || 'High',
            successRate: hasEvidence ? `${ev.approvalRate}%` : '35-50%',
            timeline: best.estimatedTimeline || '12-24 months',
            source: 'rezone-analysis',
            description: `Rezone to ${best.targetDistrictCode} (${best.targetDistrictName || 'higher-density district'}). ${best.insight}`,
            metrics: {
              maxUnits: best.targetEnvelope.maxCapacity,
              maxGba: best.targetEnvelope.maxGFA,
              maxStories: best.targetEnvelope.maxFloors,
              appliedFar: null,
              maxDensity: null,
              maxHeight: null,
              parkingRequired: 0,
              bindingConstraint: best.targetEnvelope.limitingFactor,
            },
          };
        }
      }
    } catch {}

    return this.computeRezoneMultiplier(subject, baseConstraints, avgUnitSizeOverride);
  }

  private async computeRezoneFromCode(
    subject: SubjectProperty,
    baseConstraints: ResolvedConstraints,
    targetCode: string,
    avgUnitSizeOverride?: number | null,
  ): Promise<ComputedPath> {
    const constraints = await this.resolveConstraints(targetCode, subject.municipality, subject.state);
    if (constraints) {
      const envelope = this.computeEnvelope(subject, constraints, avgUnitSizeOverride);
      return {
        key: 'rezone',
        label: `Rezone to ${targetCode}`,
        zoningCode: targetCode,
        risk: 'Medium',
        successRate: '35-65%',
        timeline: '12-24 months',
        source: 'user-selected',
        description: `Rezone to ${targetCode} (user-selected target district).`,
        metrics: {
          maxUnits: envelope.maxCapacity,
          maxGba: Math.round(envelope.maxGFA),
          maxStories: envelope.maxFloors,
          appliedFar: constraints.appliedFAR,
          maxDensity: constraints.maxDensity,
          maxHeight: constraints.maxHeight,
          parkingRequired: envelope.parkingRequired,
          bindingConstraint: envelope.limitingFactor,
        },
      };
    }

    return {
      key: 'rezone',
      label: `Rezone to ${targetCode}`,
      zoningCode: targetCode,
      risk: 'High',
      successRate: '35-50%',
      timeline: '12-24 months',
      source: 'user-selected-missing',
      description: `Rezone to ${targetCode} (constraints not found — using estimates).`,
      metrics: {
        maxUnits: 0, maxGba: 0, maxStories: 0,
        appliedFar: null, maxDensity: null, maxHeight: null,
        parkingRequired: 0, bindingConstraint: 'unknown',
      },
    };
  }

  private computeRezoneMultiplier(subject: SubjectProperty, baseConstraints: ResolvedConstraints, avgUnitSizeOverride?: number | null): ComputedPath {
    const multipliers = { density: 1.6, far: 1.5, parking: 0.70 };
    const rezConstraints: ResolvedConstraints = {
      ...baseConstraints,
      maxDensity: baseConstraints.maxDensity != null ? baseConstraints.maxDensity * multipliers.density : null,
      maxFAR: baseConstraints.maxFAR != null ? baseConstraints.maxFAR * multipliers.far : null,
      appliedFAR: baseConstraints.appliedFAR != null ? baseConstraints.appliedFAR * multipliers.far : null,
      residentialFAR: baseConstraints.residentialFAR != null ? baseConstraints.residentialFAR * multipliers.far : null,
      nonresidentialFAR: baseConstraints.nonresidentialFAR != null ? baseConstraints.nonresidentialFAR * multipliers.far : null,
      maxHeight: baseConstraints.maxHeight != null ? Math.round(baseConstraints.maxHeight * 1.5) : null,
      minParkingPerUnit: baseConstraints.minParkingPerUnit != null ? baseConstraints.minParkingPerUnit * multipliers.parking : null,
    };
    const envelope = this.computeEnvelope(subject, rezConstraints, avgUnitSizeOverride);
    return {
      key: 'rezone',
      label: 'Rezone',
      zoningCode: null,
      risk: 'High',
      successRate: '35-50%',
      timeline: '12-24 months',
      source: 'rezone-multiplier',
      description: 'Full rezoning petition to City Council for higher-density district designation.',
      metrics: {
        maxUnits: envelope.maxCapacity,
        maxGba: Math.round(envelope.maxGFA),
        maxStories: envelope.maxFloors,
        appliedFar: rezConstraints.appliedFAR,
        maxDensity: rezConstraints.maxDensity,
        maxHeight: rezConstraints.maxHeight,
        parkingRequired: envelope.parkingRequired,
        bindingConstraint: envelope.limitingFactor,
      },
    };
  }

  async resolveConstraints(
    code: string,
    municipality: string | null,
    state: string | null,
  ): Promise<ResolvedConstraints | null> {
    const mun = municipality || '';
    const st = state || 'GA';

    const cached = await this.cache.getConstraints(code, mun, st);
    if (cached) {
      console.log(`[Cache] HIT constraint: ${code} (${mun}, ${st})`);
      return cached.constraints as ResolvedConstraints;
    }
    console.log(`[Cache] MISS constraint: ${code} (${mun}, ${st})`);

    try {
      let districtRow: any = null;

      if (municipality) {
        const municipalityId = `${municipality.toLowerCase().replace(/\s+/g, '-')}-${(state || 'ga').toLowerCase()}`;
        const byMunId = await this.pool.query(
          `SELECT * FROM zoning_districts WHERE municipality_id = $1 AND UPPER(COALESCE(zoning_code, district_code)) = UPPER($2) LIMIT 1`,
          [municipalityId, code]
        );
        if (byMunId.rows.length > 0) {
          districtRow = byMunId.rows[0];
        } else {
          const byMunName = await this.pool.query(
            `SELECT * FROM zoning_districts WHERE UPPER(municipality) = UPPER($1) AND UPPER(COALESCE(zoning_code, district_code)) = UPPER($2) LIMIT 1`,
            [municipality, code]
          );
          if (byMunName.rows.length > 0) districtRow = byMunName.rows[0];
        }
      }

      if (!districtRow) {
        const byCode = await this.pool.query(
          `SELECT * FROM zoning_districts WHERE UPPER(COALESCE(zoning_code, district_code)) = UPPER($1) LIMIT 1`,
          [code]
        );
        if (byCode.rows.length > 0) districtRow = byCode.rows[0];
      }

      if (districtRow) {
        const d = districtRow;
        const hasSomeData = d.max_density_per_acre != null || d.max_far != null ||
          d.max_building_height_ft != null || d.max_height_feet != null;
        if (hasSomeData) {
          const resolved: ResolvedConstraints = {
            maxDensity: parseFloat(d.max_density_per_acre || d.max_units_per_acre) || null,
            maxFAR: parseFloat(d.max_far) || null,
            appliedFAR: parseFloat(d.max_far) || null,
            residentialFAR: parseFloat(d.residential_far) || null,
            nonresidentialFAR: parseFloat(d.nonresidential_far) || null,
            maxHeight: parseInt(d.max_height_feet || d.max_building_height_ft) || null,
            maxStories: parseInt(d.max_stories) || null,
            minParkingPerUnit: parseFloat(d.min_parking_per_unit || d.parking_per_unit) || null,
            maxLotCoverage: parseFloat(d.max_lot_coverage || d.max_lot_coverage_percent) || null,
            densityMethod: d.density_method || 'units_per_acre',
          };
          await this.cache.setConstraints(code, mun, st, resolved, { source: 'database', confidence: 'high' });
          return resolved;
        }
      }

      const agentData = await this.agentService.retrieveZoningData({
        districtCode: code,
        municipality: municipality || '',
        state: state || 'GA',
      });
      if (agentData.success && agentData.district) {
        const d = agentData.district;
        const resolved: ResolvedConstraints = {
          maxDensity: d.max_density_per_acre,
          maxFAR: d.max_far,
          appliedFAR: d.max_far,
          residentialFAR: null,
          nonresidentialFAR: null,
          maxHeight: d.max_building_height_ft,
          maxStories: d.max_stories,
          minParkingPerUnit: d.parking_per_unit,
          maxLotCoverage: d.max_lot_coverage,
          densityMethod: 'units_per_acre',
        };
        await this.cache.setConstraints(code, mun, st, resolved, {
          source: 'ai_retrieved',
          confidence: agentData.confidence || 'medium',
        });
        return resolved;
      }
    } catch (err: any) {
      console.error(`Failed to resolve constraints for ${code}:`, err.message);
    }

    return null;
  }

  private async generateAIAnalysis(
    subject: SubjectProperty,
    paths: ComputedPath[],
    municodeUrls: Record<string, string>,
  ): Promise<{ insights: Record<string, string>; summary: string; extraRows: Array<ComparisonRow & { values?: Record<string, string> }> }> {
    const codes = paths.map(p => p.zoningCode).filter(Boolean) as string[];
    const mun = subject.municipality || '';
    const st = subject.state || 'GA';

    const cachedAnalysis = await this.cache.getAIAnalysis(codes, mun, st);
    if (cachedAnalysis) {
      console.log(`[Cache] HIT AI analysis: ${codes.join(',')}`);
      return cachedAnalysis;
    }
    console.log(`[Cache] MISS AI analysis: ${codes.join(',')}`);

    const pathSummaries = paths.map(p => ({
      key: p.key,
      label: p.label,
      zoningCode: p.zoningCode,
      risk: p.risk,
      description: p.description,
      metrics: p.metrics,
      municodeUrl: p.zoningCode ? municodeUrls[p.zoningCode] || null : null,
    }));

    const prompt = `You are a senior real estate zoning analyst. Analyze these entitlement paths for a development site and provide practical insights.

SUBJECT PROPERTY:
- Location: ${subject.municipality || 'Unknown'}, ${subject.state || 'Unknown'}
- Lot Area: ${subject.lotAreaSf.toLocaleString()} SF (${(subject.lotAreaSf / 43560).toFixed(2)} acres)
- Current Zoning: ${subject.baseDistrictCode || 'Unknown'}
- Property Type: ${subject.propertyType}
- Active Overlays: ${subject.overlays.length > 0 ? subject.overlays.map((o: any) => o.name || o.code || 'unnamed').join(', ') : 'None detected'}

ENTITLEMENT PATHS COMPUTED:
${JSON.stringify(pathSummaries, null, 2)}

INSTRUCTIONS:
1. For each path, provide a 1-2 sentence practical insight based on the zoning code and jurisdiction. Reference specific ordinance rules, conditional requirements, step-back rules, approval difficulty, or anything a developer needs to know.
2. Determine which rows/metrics are most relevant for comparing these specific codes. Standard rows include: zoningCode, density, far, maxUnits, gba, stories, parking, bindingConstraint. You may suggest additional rows if the codes have special rules (e.g., "stepBack", "openSpace", "bufferZone", "conditionalUses").
3. Provide an overall summary recommendation (2-3 sentences) about which path offers the best risk-adjusted development opportunity.

Respond in valid JSON:
{
  "insights": {
    "<pathKey>": "1-2 sentence insight for this path"
  },
  "extraRows": [
    { "key": "uniqueKey", "label": "Display Label", "values": { "<pathKey>": "value for this path" } }
  ],
  "summary": "2-3 sentence overall recommendation"
}

For extraRows, only add rows where you have specific information about the codes involved (e.g., "Step-back above 4 stories: 10ft required" or "Conditional uses: drive-through prohibited"). Include values for each path key. Keep insights concise and actionable. Focus on what a developer needs to know, not general zoning theory.`;

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 30000);
    let message;
    try {
      message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }, { signal: abortController.signal as any });
    } finally {
      clearTimeout(timeout);
    }

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { insights: {}, summary: '', extraRows: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const result = {
      insights: parsed.insights || {},
      summary: parsed.summary || '',
      extraRows: (parsed.extraRows || [])
        .filter((r: any) => r.key && r.label)
        .map((r: any) => ({ key: r.key, label: r.label, values: r.values || {} })),
    };

    if (codes.length > 0) {
      await this.cache.setAIAnalysis(codes, mun, st, result);
    }

    return result;
  }

  private assembleResult(
    paths: ComputedPath[],
    byRight: ComputedPath,
    aiAnalysis: { insights: Record<string, string>; summary: string; extraRows: Array<ComparisonRow & { values?: Record<string, string> }> },
    variancePct: number,
    baseDistrictCode: string | null,
  ): ComparisonResult {
    const columns: ComparisonColumn[] = paths.map(p => ({
      key: p.key,
      label: p.label,
      zoningCode: p.zoningCode,
      risk: p.risk,
      successRate: p.successRate,
      timeline: p.timeline,
      aiInsight: aiAnalysis.insights[p.key] || '',
      source: p.source,
    }));

    const standardRows: ComparisonRow[] = [
      { key: 'zoningCode', label: 'Zoning Code' },
      { key: 'density', label: 'Density (u/ac)' },
      { key: 'far', label: 'FAR' },
      { key: 'maxUnits', label: 'Max Units' },
      { key: 'gba', label: 'GBA (SF)' },
      { key: 'stories', label: 'Stories' },
      { key: 'parking', label: 'Parking' },
      { key: 'bindingConstraint', label: 'Binding Constraint' },
    ];

    const validExtraRows = aiAnalysis.extraRows.filter(r => r.key && r.label);
    const allRows = [...standardRows, ...validExtraRows.map(r => ({ key: r.key, label: r.label }))];

    const cells: Record<string, Record<string, string>> = {};
    for (const p of paths) {
      const m = p.metrics;
      const deltaUnits = byRight.metrics.maxUnits > 0 && p.key !== 'byRight'
        ? Math.round(((m.maxUnits - byRight.metrics.maxUnits) / byRight.metrics.maxUnits) * 100)
        : 0;
      const deltaGba = byRight.metrics.maxGba > 0 && p.key !== 'byRight'
        ? Math.round(((m.maxGba - byRight.metrics.maxGba) / byRight.metrics.maxGba) * 100)
        : 0;

      cells[p.key] = {
        zoningCode: p.zoningCode || '--',
        density: m.maxDensity != null ? Number(m.maxDensity).toFixed(1) : '--',
        far: m.appliedFar != null ? Number(m.appliedFar).toFixed(2) : '--',
        maxUnits: m.maxUnits > 0 ? m.maxUnits.toLocaleString() : '--',
        gba: m.maxGba > 0 ? m.maxGba.toLocaleString() : '--',
        stories: m.maxStories > 0 ? String(m.maxStories) : '--',
        parking: m.parkingRequired > 0 ? m.parkingRequired.toLocaleString() : '--',
        bindingConstraint: m.bindingConstraint || '--',
        maxHeight: m.maxHeight != null ? `${m.maxHeight} ft` : '--',
        deltaUnits: String(deltaUnits),
        deltaGba: String(deltaGba),
      };

      for (const extraRow of validExtraRows) {
        cells[p.key][extraRow.key] = extraRow.values?.[p.key] || '--';
      }
    }

    return {
      columns,
      rows: allRows,
      cells,
      aiSummary: aiAnalysis.summary,
      variancePct,
      baseDistrictCode,
    };
  }
}
