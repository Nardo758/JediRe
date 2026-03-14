import { Pool } from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import { BuildingEnvelopeService, PropertyType, ZoningConstraints } from './building-envelope.service';
import { RezoneAnalysisService } from './rezone-analysis.service';
import { ZoningRecommendationOrchestrator } from './zoning-recommendation-orchestrator.service';
import { ZoningAgentService } from './zoning-agent.service';
import { ZoningProfile } from './zoning-profile.service';
import { municodeUrlService } from './municode-url.service';
import { ZoningInterpretationCache } from './zoning-interpretation-cache.service';
import { ScrapingService } from './scraping.service';

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export interface SubjectProperty {
  lotAreaSf: number;
  setbacks: { front: number; side: number; rear: number };
  propertyType: PropertyType;
  dealType: 'residential' | 'commercial' | 'mixed-use';
  projectType: string;
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
  municodeUrl: string | null;
  isDesignOverlay?: boolean;
  densityMethod?: string;
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

export interface StructuredZoningExtraction {
  density: {
    max_units_per_acre: number;
    measurement_basis: string;
    unit_equivalency: string;
    bonuses: any[];
    source: string;
    confidence: string;
    notes: string;
  };
  far: {
    residential: number;
    commercial: number;
    combined: number;
    applied_type: string;
    measurement_basis: string;
    exclusions: Record<string, boolean>;
    common_area_note: string;
    source: string;
    confidence: string;
    ambiguity: string;
  };
  height: {
    max_ft: number;
    max_stories: number | null;
    measurement_from: string;
    step_back: any | null;
    roof_exclusion_ft: number;
    source: string;
    confidence: string;
  };
  setbacks: {
    front_ft: number;
    side_ft: number;
    rear_ft: number;
    corner_treatment: string;
    source: string;
    confidence: string;
  };
  parking: {
    min_per_unit: number;
    guest_per_unit: number;
    by_bedroom: boolean;
    transit_reduction: any | null;
    shared_parking: any | null;
    compact_pct: number;
    source: string;
    confidence: string;
  };
  coverage: {
    max_lot_coverage_pct: number;
    includes_carports: boolean;
    impervious_limit_pct: number | null;
    open_space_pct: number;
    open_space_at_grade: boolean;
    source: string;
    confidence: string;
    ambiguity: string;
  };
}

interface ComputedPath {
  key: string;
  label: string;
  zoningCode: string | null;
  risk: string;
  successRate: string;
  timeline: string;
  source: string;
  isDesignOverlay?: boolean;
  densityMethod?: string;
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

    // ── Supplement missing residential/nonresidential FAR from district ───────
    // Profiles resolved before district data was populated may have these null.
    // Fill them in without overriding other constraints so the building-envelope
    // service can select the correct FAR column for the deal's asset type.
    if ((baseConstraints.residentialFAR == null || baseConstraints.nonresidentialFAR == null) && profile.base_district_code) {
      try {
        const municipalityId = `${(profile.municipality || '').toLowerCase().replace(/\s+/g, '-')}-${(profile.state || 'ga').toLowerCase()}`;
        const distRow = await this.pool.query(
          `SELECT residential_far, nonresidential_far FROM zoning_districts
           WHERE municipality_id = $1 AND UPPER(COALESCE(zoning_code, district_code)) = UPPER($2) LIMIT 1`,
          [municipalityId, profile.base_district_code],
        );
        if (distRow.rows[0]) {
          const d = distRow.rows[0];
          if (baseConstraints.residentialFAR == null && d.residential_far) {
            baseConstraints.residentialFAR = parseFloat(d.residential_far) || null;
            console.log(`[EntitlementEngine] Supplemented residentialFAR=${baseConstraints.residentialFAR} from district`);
          }
          if (baseConstraints.nonresidentialFAR == null && d.nonresidential_far) {
            baseConstraints.nonresidentialFAR = parseFloat(d.nonresidential_far) || null;
            console.log(`[EntitlementEngine] Supplemented nonresidentialFAR=${baseConstraints.nonresidentialFAR} from district`);
          }
        }
      } catch (err: any) {
        console.warn('[EntitlementEngine] FAR supplement lookup failed:', err.message);
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

    return this.assembleResult(computedPaths, byRight, aiAnalysis, variancePct, profile.base_district_code, subject.lotAreaSf, municodeUrls);
  }

  private buildSubject(profile: ZoningProfile, projectType: string): SubjectProperty {
    const propTypeMap: Record<string, PropertyType> = {
      multifamily: 'multifamily', residential: 'multifamily',
      office: 'office', retail: 'retail', industrial: 'industrial',
      hospitality: 'hospitality', mixed_use: 'mixed-use', 'mixed-use': 'mixed-use',
      mixed_use_commercial: 'mixed-use',
    };
    const dealTypeMap = (pt: string): 'residential' | 'commercial' | 'mixed-use' => {
      const p = (pt || '').toLowerCase();
      if (['multifamily', 'residential'].includes(p)) return 'residential';
      if (['office', 'retail', 'industrial', 'hospitality', 'special_purpose'].includes(p)) return 'commercial';
      if (p === 'mixed_use' || p === 'mixed-use' || p === 'mixed_use_commercial') return 'mixed-use';
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
      projectType,
      baseDistrictCode: profile.base_district_code,
      municipality: profile.municipality,
      state: profile.state,
      overlays: Array.isArray(profile.overlays) ? profile.overlays : [],
      densityMethod: profile.density_method || 'units_per_acre',
      profile,
    };
  }

  private extractBaseConstraints(profile: ZoningProfile): ResolvedConstraints {
    const parsePositiveOrNull = (v: any): number | null => {
      if (v == null || v === '' || v === 'null' || v === 'undefined') return null;
      const n = parseFloat(String(v));
      return isNaN(n) || n <= 0 ? null : n;
    };
    const intPositiveOrNull = (v: any): number | null => {
      if (v == null || v === '' || v === 'null' || v === 'undefined') return null;
      const n = parseInt(String(v));
      return isNaN(n) || n <= 0 ? null : n;
    };
    const parseZeroableOrNull = (v: any): number | null => {
      if (v == null || v === '' || v === 'null' || v === 'undefined') return null;
      const n = parseFloat(String(v));
      return isNaN(n) ? null : n;
    };
    const constraints: ResolvedConstraints = {
      maxDensity: parsePositiveOrNull(profile.max_density_per_acre),
      maxFAR: parsePositiveOrNull(profile.applied_far),
      appliedFAR: parsePositiveOrNull(profile.applied_far),
      residentialFAR: parsePositiveOrNull(profile.residential_far),
      nonresidentialFAR: parsePositiveOrNull(profile.nonresidential_far),
      maxHeight: intPositiveOrNull(profile.max_height_ft),
      maxStories: intPositiveOrNull(profile.max_stories),
      minParkingPerUnit: parseZeroableOrNull(profile.min_parking_per_unit),
      maxLotCoverage: parsePositiveOrNull(profile.max_lot_coverage_pct),
      densityMethod: profile.density_method || 'units_per_acre',
    };

    if (Array.isArray(profile.overlays)) {
      const numericFieldMapping: Record<string, keyof ResolvedConstraints> = {
        min_parking_per_unit: 'minParkingPerUnit',
        max_density_per_acre: 'maxDensity',
        max_height_ft: 'maxHeight',
        max_stories: 'maxStories',
        max_lot_coverage_pct: 'maxLotCoverage',
        applied_far: 'appliedFAR',
        max_far: 'maxFAR',
      };
      const stringFieldMapping: Record<string, keyof ResolvedConstraints> = {
        density_method: 'densityMethod',
      };
      for (const overlay of profile.overlays) {
        if (overlay.modifications && typeof overlay.modifications === 'object') {
          for (const [dbField, value] of Object.entries(overlay.modifications)) {
            if (value == null) continue;
            const numericKey = numericFieldMapping[dbField];
            if (numericKey) {
              const parsed = typeof value === 'number' ? value : parseFloat(String(value));
              if (!isNaN(parsed)) {
                (constraints as any)[numericKey] = parsed;
              }
              continue;
            }
            const stringKey = stringFieldMapping[dbField];
            if (stringKey) {
              (constraints as any)[stringKey] = String(value);
            }
          }
        }
      }
    }

    return constraints;
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
      densityMethod: constraints.densityMethod || subject.densityMethod,
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
      label: `Variance (+${pct}% Density / +${Math.round(pct * 0.75)}% FAR)`,
      zoningCode: subject.baseDistrictCode,
      risk: pct <= 15 ? 'Low' : pct <= 30 ? 'Medium' : 'High',
      successRate: pct <= 15 ? '75-85%' : pct <= 30 ? '60-75%' : '40-55%',
      timeline: '6-12 months',
      source: 'variance-multiplier',
      densityMethod: varianceConstraints.densityMethod,
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

  private isDesignOnlyOverlay(activeOverlay: any): boolean {
    const isNeutralCapacity =
      activeOverlay.capacity_impact === 'neutral' &&
      (activeOverlay.capacity_modifier == null ||
        Math.abs(parseFloat(String(activeOverlay.capacity_modifier)) - 1.0) < 0.05);
    const isDesignReview = activeOverlay.overlay_type === 'design_review';
    return isNeutralCapacity || isDesignReview;
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
    const isDesignOverlay = this.isDesignOnlyOverlay(activeOverlay);

    if (isDesignOverlay) {
      // Design overlays (BeltLine, NPU design review, etc.) do NOT change underlying
      // FAR or density. They only modify design standards, ground-floor activation,
      // and parking requirements. Inherit base constraints entirely.
      console.log(`[EntitlementEngine] Overlay ${overlayCode} classified as DESIGN overlay — inheriting base constraints`);

      // Apply known parking exemptions. Atlanta's Feb 2024 ordinance eliminated
      // parking minimums within the BeltLine Overlay District.
      if (overlayCode === 'BELTLINE' || overlayName.toUpperCase().includes('BELTLINE')) {
        overlayConstraints.minParkingPerUnit = 0;
        console.log(`[EntitlementEngine] BeltLine parking exemption applied (Feb 2024 ordinance)`);
      }

      // Do NOT query the AI constraint cache for design overlays — it would return
      // fabricated FAR/density numbers that do not exist in the ordinance.
    } else {
      // Non-design overlay: apply explicit modifications from the DB row
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

      if (activeOverlay.capacity_modifier && parseFloat(String(activeOverlay.capacity_modifier)) !== 1) {
        const mod = parseFloat(String(activeOverlay.capacity_modifier));
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
    }

    const envelope = this.computeEnvelope(subject, overlayConstraints, avgUnitSizeOverride);

    const key = index === 0 ? 'overlay' : `overlay_${index}`;
    const designLabel = isDesignOverlay ? `${overlayName} (Design)` : overlayName;

    return {
      key,
      label: `Overlay: ${designLabel}`,
      zoningCode: overlayCode,
      risk: 'Low',
      successRate: isDesignOverlay ? '95%+' : '85-90%',
      timeline: isDesignOverlay ? '2-4 months' : '3-6 months',
      source: 'overlay',
      isDesignOverlay,
      description: isDesignOverlay
        ? `${overlayName} is a design overlay — it does not change FAR or density (both governed by base district). Modifies: parking requirements, ground-floor activation, build-to lines, and design standards.`
        : `Development standards modified by ${overlayName} overlay district.`,
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

    let bestCode: string | null = null;
    let bestMeta: { risk: string; successRate: string; timeline: string; source: string; description: string } | null = null;

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
        bestCode = top.code;
        bestMeta = {
          risk: riskLevel,
          successRate: top.approvalRate !== null ? `${top.approvalRate}%` : '35-50%',
          timeline,
          source: 'orchestrator',
          description: `Rezone to ${top.code} (${top.districtName || 'higher-density district'}). ${top.reasoning}`,
        };
      }
    } catch {}

    if (!bestCode) {
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
            bestCode = best.targetDistrictCode;
            bestMeta = {
              risk: best.risk || 'High',
              successRate: hasEvidence ? `${ev.approvalRate}%` : '35-50%',
              timeline: best.estimatedTimeline || '12-24 months',
              source: 'rezone-analysis',
              description: `Rezone to ${best.targetDistrictCode} (${best.targetDistrictName || 'higher-density district'}). ${best.insight}`,
            };
          }
        }
      } catch {}
    }

    if (bestCode) {
      const constraints = await this.resolveConstraints(bestCode, subject.municipality, subject.state);
      if (constraints) {
        if (baseConstraints.minParkingPerUnit != null && baseConstraints.minParkingPerUnit < (constraints.minParkingPerUnit ?? Infinity)) {
          constraints.minParkingPerUnit = baseConstraints.minParkingPerUnit;
        }
        const envelope = this.computeEnvelope(subject, constraints, avgUnitSizeOverride);
        return {
          key: 'rezone',
          label: `Rezone to ${bestCode}`,
          zoningCode: bestCode,
          risk: bestMeta!.risk,
          successRate: bestMeta!.successRate,
          timeline: bestMeta!.timeline,
          source: bestMeta!.source,
          description: bestMeta!.description,
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
    }

    return this.computeRezoneMultiplier(subject, baseConstraints, avgUnitSizeOverride);
  }

  private async computeRezoneFromCode(
    subject: SubjectProperty,
    baseConstraints: ResolvedConstraints,
    targetCode: string,
    avgUnitSizeOverride?: number | null,
  ): Promise<ComputedPath> {
    // Derive success rate and timeline from benchmark_projects for this municipality
    let successRate = '35-65%';
    let risk = 'Medium';
    let timeline = '12-24 months';
    try {
      const benchRes = await this.pool.query(
        `SELECT outcome, total_entitlement_days
         FROM benchmark_projects
         WHERE municipality = $1 AND state = $2 AND entitlement_type = 'rezone'
           AND total_entitlement_days IS NOT NULL`,
        [subject.municipality, subject.state]
      );
      if (benchRes.rows.length >= 3) {
        const approved = benchRes.rows.filter((r: any) => r.outcome === 'approved' || r.outcome == null).length;
        const total = benchRes.rows.length;
        const approvalPct = Math.round((approved / total) * 100);
        const days = benchRes.rows.map((r: any) => parseInt(r.total_entitlement_days)).sort((a: number, b: number) => a - b);
        const medianDays = days[Math.floor(days.length / 2)];
        const minDays = days[0];
        const maxDays = days[days.length - 1];
        successRate = `${approvalPct}% (${total} comps)`;
        risk = approvalPct >= 70 ? 'Low' : approvalPct >= 45 ? 'Medium' : 'High';
        const medMonths = Math.round(medianDays / 30);
        const minMonths = Math.round(minDays / 30);
        const maxMonths = Math.round(maxDays / 30);
        timeline = `~${medMonths} months (range ${minMonths}–${maxMonths})`;
      }
    } catch {}

    const constraints = await this.resolveConstraints(targetCode, subject.municipality, subject.state);
    if (constraints) {
      if (baseConstraints.minParkingPerUnit != null && baseConstraints.minParkingPerUnit < (constraints.minParkingPerUnit ?? Infinity)) {
        constraints.minParkingPerUnit = baseConstraints.minParkingPerUnit;
      }
      const envelope = this.computeEnvelope(subject, constraints, avgUnitSizeOverride);
      return {
        key: 'rezone',
        label: `Rezone to ${targetCode}`,
        zoningCode: targetCode,
        risk,
        successRate,
        timeline,
        source: 'user-selected',
        densityMethod: constraints.densityMethod,
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
      risk,
      successRate,
      timeline,
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
      densityMethod: rezConstraints.densityMethod,
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
            maxLotCoverage: (() => {
              const raw = parseFloat(d.max_lot_coverage || d.max_lot_coverage_percent);
              if (isNaN(raw) || raw === 0) return null;
              return raw <= 1 ? raw * 100 : raw;
            })(),
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

    // ── 1. Fetch benchmark comps + timeline data ──────────────────────────────
    let comps: any[] = [];
    let timelineStats: any[] = [];
    let compCount = 0;
    try {
      const compResult = await this.pool.query(
        `SELECT project_name, entitlement_type, unit_count, density_achieved,
                far_achieved, total_entitlement_days, outcome, zoning_from, zoning_to
         FROM benchmark_projects
         WHERE municipality ILIKE $1
         ORDER BY total_entitlement_days ASC NULLS LAST
         LIMIT 15`,
        [mun],
      );
      comps = compResult.rows;
      compCount = compResult.rowCount || 0;

      const tlResult = await this.pool.query(
        `SELECT entitlement_type,
                COUNT(*)::int AS n,
                AVG(total_entitlement_days)::int AS avg_days,
                MIN(total_entitlement_days) AS min_days,
                MAX(total_entitlement_days) AS max_days
         FROM benchmark_projects
         WHERE municipality ILIKE $1
           AND total_entitlement_days IS NOT NULL
         GROUP BY entitlement_type`,
        [mun],
      );
      timelineStats = tlResult.rows;
    } catch (err: any) {
      console.warn('[EntitlementEngine] Failed to fetch comps/timeline:', err.message);
    }

    // ── 2. Build cache fingerprint (includes comp count for invalidation) ─────
    const byRightPath = paths.find(p => p.key === 'byRight');
    const metricsBase = byRightPath
      ? `u${byRightPath.metrics.maxUnits}g${byRightPath.metrics.maxGba}f${byRightPath.metrics.appliedFar || 0}`
      : '';
    const metricsFingerprint = `${metricsBase}#v8#c${compCount}`;

    const cachedAnalysis = await this.cache.getAIAnalysis(codes, mun, st, metricsFingerprint);
    if (cachedAnalysis) {
      console.log(`[Cache] HIT AI analysis: ${codes.join(',')} fp=${metricsFingerprint}`);
      return cachedAnalysis;
    }
    console.log(`[Cache] MISS AI analysis: ${codes.join(',')} fp=${metricsFingerprint}`);

    // ── 3. Fetch ordinance text for every unique path district (parallel) ─────
    const ordinanceByCode: Record<string, string> = {};
    try {
      const munIdResult = await this.pool.query(
        `SELECT id FROM municipalities WHERE LOWER(name) = LOWER($1) AND LOWER(state) = LOWER($2) LIMIT 1`,
        [mun, st],
      );
      const municipalityId = munIdResult.rows[0]?.id;
      if (municipalityId) {
        const scraper = new ScrapingService(this.pool);
        const uniqueCodes = [...new Set(paths.map(p => p.zoningCode).filter(Boolean) as string[])];
        await Promise.all(
          uniqueCodes.map(async (code) => {
            try {
              const scraped = await scraper.scrapeZoningCode(municipalityId, code);
              if (scraped.text) ordinanceByCode[code] = scraped.text;
            } catch {
              /* skip — best-effort */
            }
          }),
        );
      }
    } catch (err: any) {
      console.warn('[EntitlementEngine] Ordinance fetch failed:', err.message);
    }

    // ── 4. Build enriched prompt ──────────────────────────────────────────────
    const compsSection = comps.length > 0
      ? `COMPARABLE PROJECTS IN ${mun.toUpperCase()} (${compCount} total, showing top ${comps.length}):\n` +
        comps.map(c =>
          `  • ${c.project_name}: ${c.entitlement_type?.toUpperCase() || 'UNKNOWN'}, ` +
          `${c.unit_count ?? '?'} units, ` +
          (c.far_achieved ? `FAR ${c.far_achieved}, ` : '') +
          (c.density_achieved ? `${parseFloat(c.density_achieved).toFixed(1)} u/acre, ` : '') +
          `${c.total_entitlement_days ?? '?'} days, outcome: ${c.outcome || 'unknown'}`
        ).join('\n')
      : `COMPARABLE PROJECTS: No comparable projects on record for ${mun}.`;

    const timelineSection = timelineStats.length > 0
      ? `ENTITLEMENT TIMELINE BENCHMARKS (${mun}, from actual project data):\n` +
        timelineStats.map(t =>
          `  • ${t.entitlement_type}: avg ${t.avg_days} days (${t.n} projects, range ${t.min_days}–${t.max_days} days)`
        ).join('\n')
      : '';

    // Build multi-district ordinance section from all fetched codes
    const ordinanceSection = Object.keys(ordinanceByCode).length > 0
      ? Object.entries(ordinanceByCode)
          .map(([code, text]) => {
            const trimmed = text.length > 2500 ? text.slice(0, 2500) + '\n[...truncated]' : text;
            return `ZONING ORDINANCE TEXT (${code}, ${mun}):\n${trimmed}`;
          })
          .join('\n\n')
      : '';

    // Asset type context — tells Claude which FAR column applies for this deal
    const assetTypeLabel: Record<string, string> = {
      multifamily: 'Multifamily Residential — applies residential FAR only',
      residential: 'Residential — applies residential FAR only',
      mixed_use: 'Mixed-Use (Residential-Led) — applies combined FAR, majority residential',
      mixed_use_commercial: 'Mixed-Use (Commercial-Led) — applies combined FAR, majority nonresidential',
      office: 'Commercial / Office — applies nonresidential FAR only',
      retail: 'Retail — applies nonresidential FAR only',
      hospitality: 'Hospitality — applies nonresidential FAR only',
      industrial: 'Industrial — applies nonresidential FAR only',
    };
    const assetTypeContext = assetTypeLabel[subject.projectType] || subject.projectType;

    // Strip raw metrics from what Claude sees for path context — prevents regurgitating engine outputs
    const pathContext = paths.map(p => ({
      key: p.key,
      label: p.label,
      zoningCode: p.zoningCode,
      risk: p.risk,
      description: p.description,
      municodeUrl: p.zoningCode ? municodeUrls[p.zoningCode] || null : null,
      isDesignOverlay: p.isDesignOverlay || false,
      densityMethod: p.densityMethod || 'units_per_acre',
    }));
    // Keep full metrics separately, only for discrepancy-flagging
    const metricsForFlagging = paths.map(p => ({
      key: p.key,
      engineComputedUnits: p.metrics.maxUnits,
      engineComputedFar: p.metrics.appliedFar,
      engineComputedDensity: p.metrics.maxDensity,
      engineComputedStories: p.metrics.maxStories,
    }));

    const prompt = `You are a senior real estate entitlement analyst. Provide Agent Insights grounded in the ACTUAL ORDINANCE TEXT and BENCHMARK DATA below — not in the automated engine's computed numbers.

${ordinanceSection}

${compsSection}

${timelineSection}

SUBJECT PROPERTY:
- Location: ${mun}, ${st}
- Lot Area: ${subject.lotAreaSf.toLocaleString()} SF (${(subject.lotAreaSf / 43560).toFixed(2)} acres)
- Current Zoning: ${subject.baseDistrictCode || 'Unknown'}
- Asset Type: ${assetTypeContext}
- Active Overlays: ${subject.overlays.length > 0 ? subject.overlays.map((o: any) => o.name || o.code || 'unnamed').join(', ') : 'None'}

ENTITLEMENT PATHS (label and risk only — do not use as metric source):
${JSON.stringify(pathContext, null, 2)}

ENGINE-COMPUTED NUMBERS (cross-check only — may contain errors from wrong FAR column or density method):
${JSON.stringify(metricsForFlagging, null, 2)}

INSTRUCTIONS:
The comparison table already shows FAR, units, stories, density, and binding constraint. Do NOT repeat those numbers.

Part A — For each path write a 3-bullet Agent Insight that adds what is NOT in the table. Use this exact format (with literal \n between bullets):
"• Decision context: [Is this path viable right now for this asset type? What is the strategic thesis — e.g. straightforward admin permit, politically risky, time-sensitive window, ordinance recently changed?]
• Risk / obstacle: [The single biggest thing that could kill or delay this path — a hardship finding requirement, council political risk, overlay design approval, affordability obligation, neighbour opposition pattern, etc. Cite the ordinance section if relevant.]
• Opportunity / next step: [A specific upside or action — density bonus program, comparable precedent that succeeded, which department to file with, timing advantage, or pre-application meeting recommendation.]"

Rules:
- Speak to a developer making a capital allocation decision. Be direct and specific.
- Cite ordinance sections only when they reveal something not already in the table (e.g., a conditional use trigger, a bonus program, an absolute ceiling that differs from the applied FAR).
- For overlay paths: clarify they are DESIGN overlays only — ground-floor activation, build-to lines, parking waivers. They do not create an independent density entitlement.
- For paths with densityMethod="far_derived": density is estimated from FAR ÷ avg unit size and is labeled "Est. Density†" in the table — note this estimation limitation if relevant to the insight.
- Use comparable project data (names, outcomes, timelines) when available from BENCHMARK DATA.
- Keep each bullet to 1–2 sentences. Total insight under 120 words.

Part B — Generate exactly these 4 extraRows. Values MUST come from ORDINANCE TEXT and BENCHMARK DATA only.

1. key="timelineEstimate", label="Est. Timeline"
   Precise benchmark-based estimate (e.g., "~302 days avg, range 126–420 (12 projects)"). Write "No benchmark data" if absent.

2. key="approvalBody", label="Approval Body"
   Specific body for this jurisdiction and path type (e.g., "Admin. permit — no hearing", "Board of Zoning Adjustment", "Atlanta City Council + ZRB").

3. key="ordinanceRef", label="Ordinance Ref."
   Exact section from the ORDINANCE TEXT above (e.g., "§16-19A MRC-2-C", "§16-20 MRC-3"). Use "--" if not in the text.

4. key="keyRestriction", label="Key Restriction"
   Most impactful single constraint from the ordinance (e.g., "Combined FAR cap 3.99 (res 1.49 + nonres 2.50)", "5-story / 52 ft height limit", "Density bonus: up to FAR 8.2 with affordability"). Use "--" if not addressed.

Respond in valid JSON only:
{
  "insights": {
    "<pathKey>": "• Decision context: ...\n• Risk / obstacle: ...\n• Opportunity / next step: ..."
  },
  "extraRows": [
    { "key": "timelineEstimate", "label": "Est. Timeline",   "values": { "<pathKey>": "value" } },
    { "key": "approvalBody",     "label": "Approval Body",   "values": { "<pathKey>": "value" } },
    { "key": "ordinanceRef",     "label": "Ordinance Ref.",  "values": { "<pathKey>": "value" } },
    { "key": "keyRestriction",   "label": "Key Restriction", "values": { "<pathKey>": "value" } }
  ],
  "summary": "2–3 sentence recommendation citing the best risk-adjusted path, its ordinance basis, and benchmark timeline"
}

Keep extraRow values under 70 characters. Do not add rows beyond these four.`;

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 90000);
    let message;
    try {
      message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
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
      await this.cache.setAIAnalysis(codes, mun, st, result, metricsFingerprint);
    }

    return result;
  }

  private assembleResult(
    paths: ComputedPath[],
    byRight: ComputedPath,
    aiAnalysis: { insights: Record<string, string>; summary: string; extraRows: Array<ComparisonRow & { values?: Record<string, string> }> },
    variancePct: number,
    baseDistrictCode: string | null,
    lotAreaSf?: number,
    municodeUrls: Record<string, string> = {},
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
      municodeUrl: p.zoningCode ? (municodeUrls[p.zoningCode] || null) : null,
      isDesignOverlay: p.isDesignOverlay,
      densityMethod: p.densityMethod ?? byRight.densityMethod,
    }));

    const isFarDerived = byRight.densityMethod === 'far_derived';
    const standardRows: ComparisonRow[] = [
      { key: 'zoningCode', label: 'Zoning Code' },
      { key: 'density', label: isFarDerived ? 'Est. Density† (u/ac)' : 'Density (u/ac)' },
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
        density: m.maxDensity != null
          ? Number(m.maxDensity).toFixed(1)
          : (m.maxUnits > 0 && lotAreaSf && lotAreaSf > 0
            ? (m.maxUnits / (lotAreaSf / 43560)).toFixed(1)
            : '--'),
        far: (() => {
          if (m.appliedFar == null) return '--';
          const allowedFar = Number(m.appliedFar);
          if (lotAreaSf && lotAreaSf > 0 && m.maxGba > 0) {
            const achievedFar = m.maxGba / lotAreaSf;
            if (achievedFar < allowedFar * 0.95) {
              return `${achievedFar.toFixed(2)} (of ${allowedFar.toFixed(2)})`;
            }
          }
          return allowedFar.toFixed(2);
        })(),
        maxUnits: m.maxUnits > 0 ? m.maxUnits.toLocaleString() : '--',
        gba: m.maxGba > 0 ? m.maxGba.toLocaleString() : '--',
        stories: m.maxStories > 0 ? String(m.maxStories) : '--',
        parking: m.parkingRequired != null ? (m.parkingRequired === 0 ? '0 (exempt)' : m.parkingRequired.toLocaleString()) : '--',
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

  async extractStructuredZoning(
    municodeText: string,
    districtCode: string,
    municipality: string
  ): Promise<StructuredZoningExtraction> {
    try {
      const systemPrompt = `You are a zoning code interpreter for a real estate development feasibility analysis.

I will give you the full text of a zoning district ordinance.

For each parameter, extract:
1. The numeric value
2. The EXACT section reference (e.g., "Sec. 16-18A.007(3)(b)")
3. Any conditions that modify the value (transit proximity, affordable set-aside, overlay)
4. The DEFINITION used
5. Any ambiguity you notice — where the code could be interpreted two ways

Specifically extract:

DENSITY:
- Maximum density (units per acre) — is this GROSS or NET acres?
- Any unit equivalency rules (do studios count as 0.5 units?)
- Any density bonuses available and their requirements
- Minimum lot area per unit (if density is expressed this way instead)

FAR:
- Residential FAR (if separate)
- Commercial/Non-residential FAR (if separate)
- Combined/Total FAR cap (if applicable)
- What is EXCLUDED from FAR calculation? List each exclusion:
  □ Open/surface parking
  □ Structured parking (all, first floor only, or none)
  □ Balconies (enclosed? unenclosed?)
  □ Mechanical rooms/equipment
  □ Common area/corridors
  □ Amenity spaces (pool deck, fitness, leasing office)
  □ Below-grade space
- Is FAR measured against GROSS lot area or NET (after setbacks)?

HEIGHT:
- Maximum height in feet
- Maximum stories (if specified separately)
- How is height measured? (from grade, from BFE, from mean finished grade)
- Any step-back requirements above a certain floor?
- Roof structure exclusions (how many feet above max?)
- Any height overlay map that supersedes?

SETBACKS:
- Front, side, rear in feet
- Are there different setbacks above certain heights?
- Corner lot treatment — which sides are "front"?
- Do step-backs count as setbacks at upper floors?

PARKING:
- Minimum spaces per unit (by bedroom count?)
- Guest parking requirement
- Any transit proximity reductions? (distance threshold + reduction %)
- Shared parking provisions for mixed-use?
- Compact/tandem allowances?
- Maximum parking caps?
- Bicycle parking substitution?

LOT COVERAGE:
- Maximum lot coverage %
- What counts as "covered"? Building footprint only or include carports/canopies?
- Separate impervious surface limit?
- Open space requirement (at grade? or any level?)
- Landscaping/buffer requirements eating into coverage?

OVERLAYS & BONUSES:
- Any overlay districts applicable?
- Each overlay's modifications to base parameters
- Can bonuses from multiple programs stack?
- Affordable housing incentive thresholds and benefits

For each parameter, rate your confidence:
- HIGH: Unambiguous numeric value with clear definition
- MEDIUM: Numeric value found but definition/measurement basis has some ambiguity
- LOW: Value inferred or calculated from related provisions; needs human verification

Format as JSON matching the structure below. Return ONLY the JSON, no markdown fences, no preamble.`;

      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Extract zoning parameters from the following ordinance text for district ${districtCode} in ${municipality}:\n\n${municodeText}`,
          },
        ],
      });

      let extractedText = response.content[0].type === 'text' ? response.content[0].text : '';

      // Strip markdown fences if present
      extractedText = extractedText.replace(/^```json\n?/, '').replace(/\n?```$/, '');

      const extraction = JSON.parse(extractedText) as StructuredZoningExtraction;

      // Validate numeric ranges
      const validationIssues: string[] = [];

      if (extraction.density.max_units_per_acre < 0 || extraction.density.max_units_per_acre > 500) {
        validationIssues.push('Density outside reasonable range (0-500 units/acre)');
      }
      if (extraction.far.residential < 0 || extraction.far.residential > 25) {
        validationIssues.push('Residential FAR outside reasonable range (0-25)');
      }
      if (extraction.far.commercial < 0 || extraction.far.commercial > 25) {
        validationIssues.push('Commercial FAR outside reasonable range (0-25)');
      }
      if (extraction.height.max_ft < 0 || extraction.height.max_ft > 1000) {
        validationIssues.push('Height outside reasonable range (0-1000 ft)');
      }
      if (extraction.parking.min_per_unit < 0 || extraction.parking.min_per_unit > 5) {
        validationIssues.push('Parking per unit outside reasonable range (0-5)');
      }
      if (extraction.coverage.max_lot_coverage_pct < 0 || extraction.coverage.max_lot_coverage_pct > 100) {
        validationIssues.push('Lot coverage outside reasonable range (0-100%)');
      }

      if (validationIssues.length > 0) {
        extraction.density.notes += ` [Validation warnings: ${validationIssues.join('; ')}]`;
      }

      return extraction;
    } catch (error) {
      console.error('Error extracting zoning structure:', error);
      throw error;
    }
  }
}
