import { Pool } from 'pg';
import { ParcelIngestionService } from './parcel-ingestion.service';
import { ZoningKnowledgeService, ZoningDistrictProfile } from './zoning-knowledge.service';
import { RezoneAnalysisService, RezoneEvidence } from './rezone-analysis.service';
import { BuildingEnvelopeService, PropertyType, PROPERTY_TYPE_CONFIGS } from './building-envelope.service';
import { logger } from '../utils/logger';

export interface NearbyCodeSummary {
  code: string;
  description: string | null;
  count: number;
  avgLotAreaSf: number | null;
  maxDensity: number | null;
  maxFar: number | null;
  maxHeight: number | null;
  isHigherDensity: boolean;
}

export interface NearbyAnalysis {
  totalParcels: number;
  radiusMeters: number;
  uniqueCodes: number;
  codeSummaries: NearbyCodeSummary[];
  densityPattern: string;
  dominantCode: string | null;
  dominantCodeCount: number;
}

export interface EntitlementTypeStats {
  count: number;
  approvedCount: number;
  approvalRate: number;
  avgDays: number | null;
  avgUnits: number | null;
  avgStories: number | null;
}

export interface RezoneTransition {
  fromCode: string;
  toCode: string;
  count: number;
  approvedCount: number;
  approvalRate: number;
  avgDays: number | null;
  avgUnits: number | null;
  docketNumbers: string[];
  ordinanceUrls: string[];
}

export interface RecentProject {
  address: string | null;
  projectName: string | null;
  entitlementType: string;
  zoningFrom: string | null;
  zoningTo: string | null;
  unitCount: number | null;
  stories: number | null;
  outcome: string | null;
  totalDays: number | null;
  docketNumber: string | null;
  ordinanceUrl: string | null;
  applicationDate: string | null;
  approvalDate: string | null;
}

export interface EntitlementPatterns {
  totalRecords: number;
  municipality: string;
  byType: {
    rezone: EntitlementTypeStats;
    cup: EntitlementTypeStats;
    variance: EntitlementTypeStats;
    by_right: EntitlementTypeStats;
    site_plan: EntitlementTypeStats;
  };
  commonTransitions: RezoneTransition[];
  recentProjects: RecentProject[];
  corridorInsight: string;
  recommendedPath: string;
  strategyInsight: string;
}

export interface RecommendationCandidate {
  code: string;
  districtName: string | null;
  profile: Partial<ZoningDistrictProfile> | null;
  densityUplift: number;
  farUplift: number;
  nearbyCount: number;
  nearbyPct: number;
  approvalRate: number | null;
  avgTimelineDays: number | null;
  evidence: RezoneEvidence | null;
  score: number;
  rank: number;
  reasoning: string;
  recommendedPath: string;
  envelope: {
    maxUnits: number;
    maxGFA: number;
    maxFloors: number;
    limitingFactor: string;
  } | null;
}

export interface ZoningRecommendation {
  dealId: string;
  currentCode: string;
  municipality: string;
  state: string;
  currentProfile: {
    maxDensity: number | null;
    maxFar: number | null;
    maxHeight: number | null;
    maxStories: number | null;
  };
  nearbyAnalysis: NearbyAnalysis;
  entitlementPatterns: EntitlementPatterns | null;
  candidates: RecommendationCandidate[];
  topRecommendation: RecommendationCandidate | null;
  generatedAt: string;
}

const SCORE_WEIGHTS = {
  densityUplift: 0.40,
  proximityEvidence: 0.30,
  approvalPrecedent: 0.30,
};

const DEFAULT_RADIUS_METERS = 500;
const MAX_NEARBY_PARCELS = 50;
const CACHE_HOURS = 24;

export class ZoningRecommendationOrchestrator {
  private parcelService: ParcelIngestionService;
  private knowledgeService: ZoningKnowledgeService;
  private rezoneService: RezoneAnalysisService;
  private envelopeService: BuildingEnvelopeService;

  constructor(private pool: Pool) {
    this.parcelService = new ParcelIngestionService(pool);
    this.knowledgeService = new ZoningKnowledgeService(pool);
    this.rezoneService = new RezoneAnalysisService(pool);
    this.envelopeService = new BuildingEnvelopeService();
  }

  async analyzeAndRecommend(dealId: string): Promise<ZoningRecommendation> {
    const dealInfo = await this.getDealInfo(dealId);
    if (!dealInfo) {
      throw new Error('Deal not found or no zoning confirmed');
    }

    const { currentCode, municipality, state, lat, lng, lotAreaSf, projectType } = dealInfo;

    const currentLookup = await this.knowledgeService.lookupDistrict(currentCode, municipality);
    const currentProfile = {
      maxDensity: currentLookup.profile?.dimensional?.maxDensityUnitsPerAcre ?? null,
      maxFar: currentLookup.profile?.dimensional?.maxFAR ?? null,
      maxHeight: currentLookup.profile?.dimensional?.maxHeightFt ?? null,
      maxStories: currentLookup.profile?.dimensional?.maxStories ?? null,
    };

    const currentDensityFromDb = await this.getCurrentDensityFromDb(currentCode, municipality);

    const [nearbyAnalysis, entitlementPatterns] = await Promise.all([
      this.scanNearbyProperties(lat, lng, currentCode, currentDensityFromDb),
      this.scanEntitlementActivity(municipality, state, currentCode),
    ]);

    const candidates = await this.buildCandidates(
      currentCode, municipality, state, nearbyAnalysis, entitlementPatterns,
      currentDensityFromDb, lotAreaSf, projectType, dealInfo.municipalityId,
    );

    const sortedCandidates = candidates.sort((a, b) => b.score - a.score);
    sortedCandidates.forEach((c, i) => c.rank = i + 1);

    const topRecommendation = sortedCandidates.length > 0 ? sortedCandidates[0] : null;

    const recommendation: ZoningRecommendation = {
      dealId,
      currentCode,
      municipality,
      state,
      currentProfile,
      nearbyAnalysis,
      entitlementPatterns,
      candidates: sortedCandidates,
      topRecommendation,
      generatedAt: new Date().toISOString(),
    };

    await this.persistRecommendation(recommendation);

    return recommendation;
  }

  async getCached(dealId: string): Promise<ZoningRecommendation | null> {
    const result = await this.pool.query(
      `SELECT * FROM zoning_recommendations
       WHERE deal_id = $1 AND expires_at > NOW()
       ORDER BY generated_at DESC LIMIT 1`,
      [dealId],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      dealId: row.deal_id,
      currentCode: row.current_code,
      municipality: row.municipality,
      state: row.state,
      currentProfile: row.nearby_analysis?.currentProfile || { maxDensity: null, maxFar: null, maxHeight: null, maxStories: null },
      nearbyAnalysis: row.nearby_analysis || { totalParcels: 0, radiusMeters: DEFAULT_RADIUS_METERS, uniqueCodes: 0, codeSummaries: [], densityPattern: 'unknown', dominantCode: null, dominantCodeCount: 0 },
      entitlementPatterns: row.nearby_analysis?.entitlementPatterns || null,
      candidates: row.candidates || [],
      topRecommendation: row.top_recommendation_code
        ? (row.candidates || []).find((c: any) => c.code === row.top_recommendation_code) || null
        : null,
      generatedAt: row.generated_at?.toISOString?.() || row.generated_at,
    };
  }

  async getOrAnalyze(dealId: string): Promise<ZoningRecommendation> {
    const cached = await this.getCached(dealId);
    if (cached) return cached;
    return this.analyzeAndRecommend(dealId);
  }

  private async getDealInfo(dealId: string): Promise<{
    currentCode: string;
    municipality: string;
    state: string;
    lat: number;
    lng: number;
    lotAreaSf: number;
    projectType: string;
    municipalityId: string | null;
  } | null> {
    const result = await this.pool.query(
      `SELECT d.id, d.project_type,
              dzc.zoning_code, dzc.municipality, dzc.state,
              pb.parcel_area_sf,
              pb.centroid[1] AS lat,
              pb.centroid[0] AS lng,
              m.id as municipality_id
       FROM deals d
       LEFT JOIN deal_zoning_confirmations dzc ON dzc.deal_id = d.id
       LEFT JOIN property_boundaries pb ON pb.deal_id = d.id
       LEFT JOIN municipalities m ON UPPER(m.name) = UPPER(dzc.municipality) AND UPPER(m.state) = UPPER(dzc.state)
       WHERE d.id = $1`,
      [dealId],
    );

    const row = result.rows[0];
    if (!row?.zoning_code || !row?.municipality) return null;

    return {
      currentCode: row.zoning_code,
      municipality: row.municipality,
      state: row.state || '',
      lat: parseFloat(row.lat) || 0,
      lng: parseFloat(row.lng) || 0,
      lotAreaSf: parseFloat(row.parcel_area_sf) || 10000,
      projectType: row.project_type || 'multifamily',
      municipalityId: row.municipality_id || null,
    };
  }

  private async getCurrentDensityFromDb(code: string, municipality: string): Promise<{
    density: number; far: number; height: number;
  }> {
    const result = await this.pool.query(
      `SELECT
        COALESCE(max_density_per_acre, max_units_per_acre, 0) as density,
        COALESCE(max_far, 0) as far,
        COALESCE(max_building_height_ft, max_height_feet, 0) as height
       FROM zoning_districts
       WHERE UPPER(COALESCE(zoning_code, district_code)) = UPPER($1)
         AND UPPER(COALESCE(municipality, '')) = UPPER($2)
       LIMIT 1`,
      [code, municipality],
    );

    if (result.rows.length === 0) {
      return { density: 0, far: 0, height: 0 };
    }

    return {
      density: parseFloat(result.rows[0].density) || 0,
      far: parseFloat(result.rows[0].far) || 0,
      height: parseFloat(result.rows[0].height) || 0,
    };
  }

  private async scanNearbyProperties(
    lat: number,
    lng: number,
    currentCode: string,
    currentDensity: { density: number; far: number; height: number },
  ): Promise<NearbyAnalysis> {
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      return {
        totalParcels: 0,
        radiusMeters: DEFAULT_RADIUS_METERS,
        uniqueCodes: 0,
        codeSummaries: [],
        densityPattern: 'no_coordinates',
        dominantCode: null,
        dominantCodeCount: 0,
      };
    }

    const degOffset = DEFAULT_RADIUS_METERS / 111320;
    const parcelsResult = await this.pool.query(
      `SELECT county_zoning_code, county_zoning_desc, lot_area_sf,
              SQRT(POW((centroid_lat - $1) * 111320, 2) + POW((centroid_lng - $2) * 111320 * COS(RADIANS($1)), 2)) AS distance_m
       FROM county_parcels
       WHERE centroid_lat BETWEEN $1 - $3 AND $1 + $3
         AND centroid_lng BETWEEN $2 - $3 AND $2 + $3
         AND county_zoning_code IS NOT NULL
       ORDER BY distance_m
       LIMIT $4`,
      [lat, lng, degOffset, MAX_NEARBY_PARCELS],
    );

    const parcels = parcelsResult.rows;

    if (parcels.length === 0) {
      return {
        totalParcels: 0,
        radiusMeters: DEFAULT_RADIUS_METERS,
        uniqueCodes: 0,
        codeSummaries: [],
        densityPattern: 'no_data',
        dominantCode: null,
        dominantCodeCount: 0,
      };
    }

    const codeMap = new Map<string, {
      code: string; description: string | null; count: number;
      lotAreas: number[];
    }>();

    for (const p of parcels) {
      const code = (p.county_zoning_code || '').toUpperCase().trim();
      if (!code) continue;

      if (!codeMap.has(code)) {
        codeMap.set(code, {
          code,
          description: p.county_zoning_desc || null,
          count: 0,
          lotAreas: [],
        });
      }

      const entry = codeMap.get(code)!;
      entry.count++;
      if (p.lot_area_sf) entry.lotAreas.push(parseFloat(p.lot_area_sf));
    }

    const districtDensities = await this.lookupDistrictDensities(
      Array.from(codeMap.keys()),
    );

    const codeSummaries: NearbyCodeSummary[] = [];
    for (const [code, data] of codeMap) {
      const dd = districtDensities.get(code);
      const avgLot = data.lotAreas.length > 0
        ? Math.round(data.lotAreas.reduce((a, b) => a + b, 0) / data.lotAreas.length)
        : null;

      const maxDensity = dd?.density ?? null;
      const maxFar = dd?.far ?? null;
      const maxHeight = dd?.height ?? null;

      const isHigherDensity =
        (maxDensity !== null && currentDensity.density > 0 && maxDensity > currentDensity.density) ||
        (maxFar !== null && currentDensity.far > 0 && maxFar > currentDensity.far);

      codeSummaries.push({
        code,
        description: data.description,
        count: data.count,
        avgLotAreaSf: avgLot,
        maxDensity,
        maxFar,
        maxHeight,
        isHigherDensity,
      });
    }

    codeSummaries.sort((a, b) => b.count - a.count);

    const higherDensityCount = codeSummaries.filter(c => c.isHigherDensity).length;
    const totalCodes = codeSummaries.length;
    let densityPattern: string;

    if (higherDensityCount === 0) {
      densityPattern = 'stable';
    } else if (higherDensityCount / totalCodes > 0.5) {
      densityPattern = 'upzoning_trend';
    } else {
      densityPattern = 'mixed';
    }

    return {
      totalParcels: parcels.length,
      radiusMeters: DEFAULT_RADIUS_METERS,
      uniqueCodes: codeMap.size,
      codeSummaries,
      densityPattern,
      dominantCode: codeSummaries[0]?.code || null,
      dominantCodeCount: codeSummaries[0]?.count || 0,
    };
  }

  async scanEntitlementActivity(
    municipality: string,
    state: string,
    currentCode: string,
  ): Promise<EntitlementPatterns | null> {
    try {
      const result = await this.pool.query(
        `SELECT
          bp.entitlement_type,
          bp.outcome,
          bp.unit_count,
          bp.stories,
          bp.total_entitlement_days,
          bp.zoning_from,
          bp.zoning_to,
          bp.address,
          bp.project_name,
          bp.docket_number,
          bp.ordinance_url,
          bp.application_date,
          bp.approval_date
        FROM benchmark_projects bp
        WHERE UPPER(bp.municipality) = UPPER($1)
          AND ($2 = '' OR UPPER(COALESCE(bp.state, '')) = UPPER($2))
        ORDER BY bp.application_date DESC NULLS LAST, bp.created_at DESC`,
        [municipality, state || ''],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const rows = result.rows;

      const typeStats = (type: string): EntitlementTypeStats => {
        const filtered = rows.filter(r => r.entitlement_type === type);
        if (filtered.length === 0) {
          return { count: 0, approvedCount: 0, approvalRate: 0, avgDays: null, avgUnits: null, avgStories: null };
        }
        const approved = filtered.filter(r => r.outcome === 'approved' || r.outcome === 'modified');
        const daysArr = filtered.filter(r => r.total_entitlement_days != null).map(r => parseInt(r.total_entitlement_days));
        const unitsArr = filtered.filter(r => r.unit_count != null).map(r => parseInt(r.unit_count));
        const storiesArr = filtered.filter(r => r.stories != null).map(r => parseInt(r.stories));

        return {
          count: filtered.length,
          approvedCount: approved.length,
          approvalRate: filtered.length > 0 ? Math.round((approved.length / filtered.length) * 100) : 0,
          avgDays: daysArr.length > 0 ? Math.round(daysArr.reduce((a, b) => a + b, 0) / daysArr.length) : null,
          avgUnits: unitsArr.length > 0 ? Math.round(unitsArr.reduce((a, b) => a + b, 0) / unitsArr.length) : null,
          avgStories: storiesArr.length > 0 ? Math.round(storiesArr.reduce((a, b) => a + b, 0) / storiesArr.length) : null,
        };
      };

      const byType = {
        rezone: typeStats('rezone'),
        cup: typeStats('cup'),
        variance: typeStats('variance'),
        by_right: typeStats('by_right'),
        site_plan: typeStats('site_plan'),
      };

      const rezoneRows = rows.filter(r => r.entitlement_type === 'rezone' && r.zoning_from && r.zoning_to);
      const transitionMap = new Map<string, {
        fromCode: string; toCode: string; count: number; approvedCount: number;
        days: number[]; units: number[]; dockets: string[]; urls: string[];
      }>();

      for (const r of rezoneRows) {
        const key = `${r.zoning_from}→${r.zoning_to}`;
        if (!transitionMap.has(key)) {
          transitionMap.set(key, {
            fromCode: r.zoning_from, toCode: r.zoning_to,
            count: 0, approvedCount: 0, days: [], units: [], dockets: [], urls: [],
          });
        }
        const t = transitionMap.get(key)!;
        t.count++;
        if (r.outcome === 'approved' || r.outcome === 'modified') t.approvedCount++;
        if (r.total_entitlement_days) t.days.push(parseInt(r.total_entitlement_days));
        if (r.unit_count) t.units.push(parseInt(r.unit_count));
        if (r.docket_number) t.dockets.push(r.docket_number);
        if (r.ordinance_url) t.urls.push(r.ordinance_url);
      }

      const commonTransitions: RezoneTransition[] = Array.from(transitionMap.values())
        .map(t => ({
          fromCode: t.fromCode,
          toCode: t.toCode,
          count: t.count,
          approvedCount: t.approvedCount,
          approvalRate: t.count > 0 ? Math.round((t.approvedCount / t.count) * 100) : 0,
          avgDays: t.days.length > 0 ? Math.round(t.days.reduce((a, b) => a + b, 0) / t.days.length) : null,
          avgUnits: t.units.length > 0 ? Math.round(t.units.reduce((a, b) => a + b, 0) / t.units.length) : null,
          docketNumbers: t.dockets,
          ordinanceUrls: t.urls,
        }))
        .sort((a, b) => b.count - a.count);

      const recentProjects: RecentProject[] = rows
        .filter(r => (r.outcome === 'approved' || r.outcome === 'modified') && (r.address || r.project_name))
        .slice(0, 8)
        .map(r => ({
          address: r.address || null,
          projectName: r.project_name || null,
          entitlementType: r.entitlement_type,
          zoningFrom: r.zoning_from || null,
          zoningTo: r.zoning_to || null,
          unitCount: r.unit_count ? parseInt(r.unit_count) : null,
          stories: r.stories ? parseInt(r.stories) : null,
          outcome: r.outcome,
          totalDays: r.total_entitlement_days ? parseInt(r.total_entitlement_days) : null,
          docketNumber: r.docket_number || null,
          ordinanceUrl: r.ordinance_url || null,
          applicationDate: r.application_date?.toISOString?.() || r.application_date || null,
          approvalDate: r.approval_date?.toISOString?.() || r.approval_date || null,
        }));

      const { recommendedPath, strategyInsight, corridorInsight } = this.generateEntitlementStrategy(
        byType, commonTransitions, currentCode, municipality,
      );

      return {
        totalRecords: rows.length,
        municipality,
        byType,
        commonTransitions,
        recentProjects,
        corridorInsight,
        recommendedPath,
        strategyInsight,
      };
    } catch (err: any) {
      logger.error('Failed to scan entitlement activity', { error: err.message, municipality });
      return null;
    }
  }

  private generateEntitlementStrategy(
    byType: EntitlementPatterns['byType'],
    transitions: RezoneTransition[],
    currentCode: string,
    municipality: string,
  ): { recommendedPath: string; strategyInsight: string; corridorInsight: string } {
    const paths: Array<{ type: string; approvalRate: number; avgDays: number | null; count: number }> = [];

    if (byType.cup.count > 0) {
      paths.push({ type: 'cup', approvalRate: byType.cup.approvalRate, avgDays: byType.cup.avgDays, count: byType.cup.count });
    }
    if (byType.variance.count > 0) {
      paths.push({ type: 'variance', approvalRate: byType.variance.approvalRate, avgDays: byType.variance.avgDays, count: byType.variance.count });
    }
    if (byType.rezone.count > 0) {
      paths.push({ type: 'rezone', approvalRate: byType.rezone.approvalRate, avgDays: byType.rezone.avgDays, count: byType.rezone.count });
    }
    if (byType.by_right.count > 0) {
      paths.push({ type: 'by_right', approvalRate: byType.by_right.approvalRate, avgDays: byType.by_right.avgDays, count: byType.by_right.count });
    }

    paths.sort((a, b) => {
      const scoreA = (a.approvalRate / 100) * 0.5 + (a.avgDays ? (1 - Math.min(a.avgDays, 730) / 730) : 0.3) * 0.3 + Math.min(a.count, 20) / 20 * 0.2;
      const scoreB = (b.approvalRate / 100) * 0.5 + (b.avgDays ? (1 - Math.min(b.avgDays, 730) / 730) : 0.3) * 0.3 + Math.min(b.count, 20) / 20 * 0.2;
      return scoreB - scoreA;
    });

    const recommendedPath = paths.length > 0 ? paths[0].type : 'rezone';

    const pathLabels: Record<string, string> = {
      cup: 'Conditional Use Permit (CUP)',
      variance: 'Variance',
      rezone: 'Rezoning',
      by_right: 'By-Right Development',
      site_plan: 'Site Plan Approval',
    };

    let strategyInsight = '';
    if (paths.length > 0) {
      const best = paths[0];
      const bestLabel = pathLabels[best.type] || best.type;
      const daysStr = best.avgDays ? `${Math.round(best.avgDays / 30)}-month avg timeline` : 'timeline data pending';
      strategyInsight = `${bestLabel} is the strongest entitlement path in ${municipality} — ${best.count} project${best.count !== 1 ? 's' : ''}, ${best.approvalRate}% approval rate, ${daysStr}.`;

      if (paths.length > 1) {
        const alt = paths[1];
        const altLabel = pathLabels[alt.type] || alt.type;
        const altDaysStr = alt.avgDays ? `${Math.round(alt.avgDays / 30)} months` : 'N/A';
        strategyInsight += ` Alternative: ${altLabel} (${alt.count} projects, ${alt.approvalRate}% approved, ${altDaysStr}).`;
      }
    }

    let corridorInsight = `${municipality} has ${byType.rezone.count + byType.cup.count + byType.variance.count + byType.by_right.count + byType.site_plan.count} entitlement records on file.`;
    if (byType.rezone.count > 0 && transitions.length > 0) {
      const topTrans = transitions[0];
      corridorInsight += ` Most common rezone: ${topTrans.fromCode} → ${topTrans.toCode} (${topTrans.count} projects).`;
    }
    if (byType.cup.count > 0) {
      corridorInsight += ` CUP activity: ${byType.cup.count} projects, ${byType.cup.approvalRate}% approved.`;
    }

    return { recommendedPath, strategyInsight, corridorInsight };
  }

  private async lookupDistrictDensities(
    codes: string[],
  ): Promise<Map<string, { density: number; far: number; height: number }>> {
    if (codes.length === 0) return new Map();

    const placeholders = codes.map((_, i) => `$${i + 1}`).join(',');
    const result = await this.pool.query(
      `SELECT
        UPPER(COALESCE(zoning_code, district_code)) as code,
        COALESCE(max_density_per_acre, max_units_per_acre, 0) as density,
        COALESCE(max_far, 0) as far,
        COALESCE(max_building_height_ft, max_height_feet, 0) as height
       FROM zoning_districts
       WHERE UPPER(COALESCE(zoning_code, district_code)) IN (${placeholders})`,
      codes.map(c => c.toUpperCase()),
    );

    const map = new Map<string, { density: number; far: number; height: number }>();
    for (const row of result.rows) {
      map.set(row.code, {
        density: parseFloat(row.density) || 0,
        far: parseFloat(row.far) || 0,
        height: parseFloat(row.height) || 0,
      });
    }
    return map;
  }

  private async buildCandidates(
    currentCode: string,
    municipality: string,
    state: string,
    nearbyAnalysis: NearbyAnalysis,
    entitlementPatterns: EntitlementPatterns | null,
    currentDensity: { density: number; far: number; height: number },
    lotAreaSf: number,
    projectType: string,
    municipalityId: string | null,
  ): Promise<RecommendationCandidate[]> {
    const candidateCodes = new Set<string>();

    for (const summary of nearbyAnalysis.codeSummaries) {
      if (summary.isHigherDensity && summary.code.toUpperCase() !== currentCode.toUpperCase()) {
        candidateCodes.add(summary.code);
      }
    }

    if (entitlementPatterns) {
      for (const trans of entitlementPatterns.commonTransitions) {
        if (trans.approvedCount > 0 && trans.toCode.toUpperCase() !== currentCode.toUpperCase()) {
          candidateCodes.add(trans.toCode.toUpperCase());
        }
      }
    }

    const rezoneTargets = await this.fetchAdditionalTargets(currentCode, municipality, municipalityId);
    for (const target of rezoneTargets) {
      candidateCodes.add(target.code.toUpperCase());
    }

    candidateCodes.delete(currentCode.toUpperCase());

    const candidates: RecommendationCandidate[] = [];
    const propType = this.mapProjectType(projectType);

    for (const code of candidateCodes) {
      const lookup = await this.knowledgeService.lookupDistrict(code, municipality);
      const dd = await this.getCurrentDensityFromDb(code, municipality);

      const densityUplift = currentDensity.density > 0 && dd.density > 0
        ? Math.round(((dd.density - currentDensity.density) / currentDensity.density) * 100)
        : 0;

      const farUplift = currentDensity.far > 0 && dd.far > 0
        ? Math.round(((dd.far - currentDensity.far) / currentDensity.far) * 100)
        : 0;

      const nearbySummary = nearbyAnalysis.codeSummaries.find(
        s => s.code.toUpperCase() === code.toUpperCase(),
      );
      const nearbyCount = nearbySummary?.count || 0;
      const nearbyPct = nearbyAnalysis.totalParcels > 0
        ? Math.round((nearbyCount / nearbyAnalysis.totalParcels) * 100)
        : 0;

      let evidence: RezoneEvidence | null = null;
      let approvalRate: number | null = null;
      let avgTimelineDays: number | null = null;
      try {
        evidence = await this.rezoneService.getRezoneEvidence(
          municipalityId, currentCode, code,
        );
        if (evidence) {
          approvalRate = evidence.approvalRate;
          avgTimelineDays = evidence.avgDays;
        }
      } catch {}

      if (approvalRate === null && entitlementPatterns) {
        const matchingTrans = entitlementPatterns.commonTransitions.find(
          t => t.toCode.toUpperCase() === code.toUpperCase(),
        );
        if (matchingTrans) {
          approvalRate = matchingTrans.approvalRate;
          avgTimelineDays = matchingTrans.avgDays;
        }
      }

      let envelope: RecommendationCandidate['envelope'] = null;
      try {
        if (dd.density > 0 || dd.far > 0) {
          const envelopeResult = this.envelopeService.calculateEnvelope({
            landArea: lotAreaSf,
            setbacks: lookup.profile?.dimensional?.setbacks || { front: 20, side: 10, rear: 20 },
            zoningConstraints: {
              maxDensity: dd.density || null,
              maxFAR: dd.far || null,
              maxHeight: dd.height || null,
              maxStories: lookup.profile?.dimensional?.maxStories || null,
              maxLotCoverage: lookup.profile?.dimensional?.maxLotCoveragePct || null,
              minParkingPerUnit: lookup.profile?.parking?.residential?.perUnit || null,
            } as any,
            propertyType: propType,
          });
          envelope = {
            maxUnits: envelopeResult.maxCapacity,
            maxGFA: Math.round(envelopeResult.maxGFA),
            maxFloors: envelopeResult.maxFloors,
            limitingFactor: envelopeResult.limitingFactor,
          };
        }
      } catch {}

      const proximityScore = nearbyAnalysis.totalParcels > 0
        ? nearbyPct / 100
        : (entitlementPatterns ? this.getEntitlementProximityScore(code, entitlementPatterns) : 0.3);

      const densityScore = Math.min(Math.max(densityUplift, farUplift), 200) / 200;
      const precedentScore = approvalRate !== null ? approvalRate / 100 : 0.3;

      const score = Math.round(
        (densityScore * SCORE_WEIGHTS.densityUplift +
         proximityScore * SCORE_WEIGHTS.proximityEvidence +
         precedentScore * SCORE_WEIGHTS.approvalPrecedent) * 100,
      );

      const recommendedPath = this.determineRecommendedPath(code, entitlementPatterns);

      const reasoning = this.generateReasoning(
        code, currentCode, densityUplift, farUplift,
        nearbyCount, nearbyAnalysis.totalParcels,
        approvalRate, avgTimelineDays,
        entitlementPatterns, recommendedPath,
      );

      candidates.push({
        code,
        districtName: lookup.profile?.fullName || null,
        profile: lookup.profile ? {
          code: lookup.profile.code,
          fullName: lookup.profile.fullName,
          dimensional: lookup.profile.dimensional,
        } : null,
        densityUplift,
        farUplift,
        nearbyCount,
        nearbyPct,
        approvalRate,
        avgTimelineDays,
        evidence,
        score,
        rank: 0,
        reasoning,
        recommendedPath,
        envelope,
      });
    }

    return candidates;
  }

  private getEntitlementProximityScore(code: string, patterns: EntitlementPatterns): number {
    const matchingTrans = patterns.commonTransitions.find(
      t => t.toCode.toUpperCase() === code.toUpperCase(),
    );
    if (matchingTrans && matchingTrans.approvedCount > 0) {
      return Math.min(matchingTrans.approvedCount / 5, 1.0) * 0.8;
    }
    return 0.1;
  }

  private determineRecommendedPath(code: string, patterns: EntitlementPatterns | null): string {
    if (!patterns) return 'rezone';

    const matchingTrans = patterns.commonTransitions.find(
      t => t.toCode.toUpperCase() === code.toUpperCase(),
    );

    const cupRate = patterns.byType.cup.approvalRate;
    const cupDays = patterns.byType.cup.avgDays;
    const rezoneRate = matchingTrans?.approvalRate ?? patterns.byType.rezone.approvalRate;
    const rezoneDays = matchingTrans?.avgDays ?? patterns.byType.rezone.avgDays;

    if (patterns.byType.cup.count >= 3 && cupRate >= 80) {
      if (!rezoneDays || !cupDays || cupDays <= rezoneDays) {
        return 'cup';
      }
    }

    if (patterns.byType.variance.count >= 3 && patterns.byType.variance.approvalRate >= 70) {
      const varDays = patterns.byType.variance.avgDays;
      if (!rezoneDays || (varDays && varDays < rezoneDays)) {
        return 'variance';
      }
    }

    return 'rezone';
  }

  private async fetchAdditionalTargets(
    currentCode: string,
    municipality: string,
    municipalityId: string | null,
  ): Promise<Array<{ code: string }>> {
    try {
      const result = await this.pool.query(
        `SELECT DISTINCT UPPER(COALESCE(zd.zoning_code, zd.district_code)) as code
         FROM zoning_districts zd
         LEFT JOIN municipalities m ON m.id = zd.municipality_id
         WHERE (zd.municipality_id = $1 OR UPPER(COALESCE(zd.municipality, m.name)) = UPPER($2))
           AND UPPER(COALESCE(zd.zoning_code, zd.district_code)) != UPPER($3)
           AND (
             COALESCE(zd.max_density_per_acre, zd.max_units_per_acre, 0) > (
               SELECT COALESCE(max_density_per_acre, max_units_per_acre, 0)
               FROM zoning_districts
               WHERE UPPER(COALESCE(zoning_code, district_code)) = UPPER($3)
                 AND (municipality_id = $1 OR UPPER(COALESCE(municipality, '')) = UPPER($2))
               LIMIT 1
             )
             OR COALESCE(zd.max_far, 0) > (
               SELECT COALESCE(max_far, 0)
               FROM zoning_districts
               WHERE UPPER(COALESCE(zoning_code, district_code)) = UPPER($3)
                 AND (municipality_id = $1 OR UPPER(COALESCE(municipality, '')) = UPPER($2))
               LIMIT 1
             )
           )
         ORDER BY COALESCE(zd.max_density_per_acre, zd.max_units_per_acre, 0) DESC
         LIMIT 8`,
        [municipalityId, municipality, currentCode],
      );
      return result.rows;
    } catch {
      return [];
    }
  }

  private generateReasoning(
    targetCode: string,
    currentCode: string,
    densityUplift: number,
    farUplift: number,
    nearbyCount: number,
    totalNearby: number,
    approvalRate: number | null,
    avgTimelineDays: number | null,
    entitlementPatterns: EntitlementPatterns | null,
    recommendedPath: string,
  ): string {
    const parts: string[] = [];

    if (densityUplift > 0) {
      parts.push(`${targetCode} allows ${densityUplift}% higher density than ${currentCode}.`);
    }
    if (farUplift > 0) {
      parts.push(`FAR is ${farUplift}% higher.`);
    }

    if (nearbyCount > 0 && totalNearby > 0) {
      parts.push(
        `${nearbyCount} of ${totalNearby} nearby parcels (${Math.round((nearbyCount / totalNearby) * 100)}%) already zoned ${targetCode}.`,
      );
    }

    if (approvalRate !== null) {
      parts.push(`Historical approval rate: ${approvalRate}%.`);
      if (avgTimelineDays && avgTimelineDays > 0) {
        const months = Math.round(avgTimelineDays / 30);
        parts.push(`Average timeline: ~${months} months.`);
      }
    } else {
      parts.push('No precedent data available for this transition.');
    }

    if (entitlementPatterns && recommendedPath !== 'rezone') {
      const pathLabels: Record<string, string> = { cup: 'CUP', variance: 'Variance', by_right: 'By-Right' };
      const pathLabel = pathLabels[recommendedPath] || recommendedPath;
      const pathStats = (entitlementPatterns.byType as any)[recommendedPath] as EntitlementTypeStats | undefined;
      if (pathStats && pathStats.count > 0) {
        const daysStr = pathStats.avgDays ? `~${Math.round(pathStats.avgDays / 30)} months` : '';
        parts.push(`Consider ${pathLabel} path: ${pathStats.count} precedents, ${pathStats.approvalRate}% approved${daysStr ? ', ' + daysStr : ''}.`);
      }
    }

    return parts.join(' ') || `${targetCode} offers higher development potential than ${currentCode}.`;
  }

  private async persistRecommendation(rec: ZoningRecommendation): Promise<void> {
    try {
      await this.pool.query(
        `DELETE FROM zoning_recommendations WHERE deal_id = $1`,
        [rec.dealId],
      );

      await this.pool.query(
        `INSERT INTO zoning_recommendations
          (deal_id, current_code, municipality, state, nearby_analysis, candidates,
           top_recommendation_code, top_recommendation_score, generated_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '${CACHE_HOURS} hours')`,
        [
          rec.dealId,
          rec.currentCode,
          rec.municipality,
          rec.state,
          JSON.stringify({
            ...rec.nearbyAnalysis,
            currentProfile: rec.currentProfile,
            entitlementPatterns: rec.entitlementPatterns,
          }),
          JSON.stringify(rec.candidates),
          rec.topRecommendation?.code || null,
          rec.topRecommendation?.score || null,
          rec.generatedAt,
        ],
      );
    } catch (err: any) {
      logger.error('Failed to persist zoning recommendation', { error: err.message, dealId: rec.dealId });
    }
  }

  private mapProjectType(projectType: string): PropertyType {
    const mapping: Record<string, PropertyType> = {
      multifamily: 'multifamily',
      office: 'office',
      retail: 'retail',
      industrial: 'industrial',
      hotel: 'hotel',
      'mixed-use': 'mixed_use',
      mixed_use: 'mixed_use',
    };
    return mapping[projectType.toLowerCase()] || 'multifamily';
  }
}
