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

    const nearbyAnalysis = await this.scanNearbyProperties(
      lat, lng, currentCode, currentDensityFromDb,
    );

    const candidates = await this.buildCandidates(
      currentCode, municipality, state, nearbyAnalysis,
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
              COALESCE(pb.centroid->>'lat', pb.centroid->>'latitude') AS lat,
              COALESCE(pb.centroid->>'lng', pb.centroid->>'longitude') AS lng,
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
    if (!lat || !lng) {
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

      const densityScore = Math.min(Math.max(densityUplift, farUplift), 200) / 200;
      const proximityScore = nearbyPct / 100;
      const precedentScore = approvalRate !== null ? approvalRate / 100 : 0.3;

      const score = Math.round(
        (densityScore * SCORE_WEIGHTS.densityUplift +
         proximityScore * SCORE_WEIGHTS.proximityEvidence +
         precedentScore * SCORE_WEIGHTS.approvalPrecedent) * 100,
      );

      const reasoning = this.generateReasoning(
        code, currentCode, densityUplift, farUplift,
        nearbyCount, nearbyAnalysis.totalParcels,
        approvalRate, avgTimelineDays,
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
        envelope,
      });
    }

    return candidates;
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
  ): string {
    const parts: string[] = [];

    if (densityUplift > 0) {
      parts.push(`${targetCode} allows ${densityUplift}% higher density than ${currentCode}.`);
    }
    if (farUplift > 0) {
      parts.push(`FAR is ${farUplift}% higher.`);
    }

    if (nearbyCount > 0) {
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
          JSON.stringify({ ...rec.nearbyAnalysis, currentProfile: rec.currentProfile }),
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
