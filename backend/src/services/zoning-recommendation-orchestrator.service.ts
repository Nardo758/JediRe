/**
 * Zoning Recommendation Orchestrator
 *
 * 5-step analysis pipeline that runs when a user confirms their property's zoning code:
 *   Step 1: Fetch confirmed zoning code and full rule set
 *   Step 2: Scan nearby parcels to see what codes neighbors have
 *   Step 3: Identify candidate codes with higher density/FAR
 *   Step 4: Check rezone approval precedent for each candidate
 *   Step 5: Score and rank candidates (density uplift 40%, proximity evidence 30%, approval precedent 30%)
 *
 * Results are cached in the zoning_recommendations table with a 24-hour expiry.
 */

import { Pool } from 'pg';
import {
  BuildingEnvelopeService,
  PropertyType,
  PROPERTY_TYPE_CONFIGS,
} from './building-envelope.service';
import { RezoneAnalysisService, RezoneEvidence } from './rezone-analysis.service';

// ── Types ──────────────────────────────────────────────────────────────────

export interface NearbyParcelZoning {
  parcelId: string;
  address: string | null;
  zoningCode: string;
  distanceFeet: number;
}

export interface ZoningCodeDistribution {
  code: string;
  count: number;
  pct: number;
}

export interface NearbyAnalysisSummary {
  parcelsScanned: number;
  uniqueCodes: number;
  areaPattern: string;
  distribution: ZoningCodeDistribution[];
}

export interface CandidateRecommendation {
  targetCode: string;
  targetDistrictName: string | null;
  targetDistrictId: string | null;
  score: number;
  densityUpliftPct: number;
  farUpliftPct: number;
  nearbyEvidence: number;       // count of nearby parcels with this code
  approvalRate: number | null;  // percentage, null if no precedent data
  avgTimelineDays: number | null;
  precedentCount: number;
  insight: string;
}

export interface ZoningRecommendationResult {
  dealId: string;
  currentCode: string;
  municipality: string;
  state: string;
  nearbyAnalysis: NearbyAnalysisSummary;
  topRecommendation: CandidateRecommendation | null;
  additionalCandidates: CandidateRecommendation[];
  generatedAt: string;
  expiresAt: string;
}

// ── Service ────────────────────────────────────────────────────────────────

export class ZoningRecommendationOrchestrator {
  private envelopeService: BuildingEnvelopeService;
  private rezoneService: RezoneAnalysisService;

  constructor(private pool: Pool) {
    this.envelopeService = new BuildingEnvelopeService();
    this.rezoneService = new RezoneAnalysisService(pool);
  }

  /**
   * Main entry point — runs the full 5-step pipeline.
   * Returns cached result if one exists and is < 24 h old.
   */
  async analyze(dealId: string): Promise<ZoningRecommendationResult> {
    // Check cache first
    const cached = await this.getCachedResult(dealId);
    if (cached) return cached;

    // ── Step 1: Fetch confirmed zoning code & rule set ─────────────────
    const { zoningCode, municipality, state, municipalityId, districtRow, profile } =
      await this.step1_fetchConfirmedZoning(dealId);

    // ── Step 2: Scan nearby parcels (within 500 m) ─────────────────────
    const nearbyParcels = await this.step2_scanNearbyParcels(dealId, municipality);

    // Build distribution summary
    const nearbyAnalysis = this.buildNearbyAnalysis(nearbyParcels, zoningCode);

    // ── Step 3: Identify higher-density candidate codes ────────────────
    const candidates = await this.step3_identifyCandidates(
      districtRow,
      municipalityId,
      municipality,
      nearbyParcels,
    );

    // ── Step 4: Check rezone approval precedent ────────────────────────
    const candidatesWithPrecedent = await this.step4_checkPrecedent(
      candidates,
      municipalityId,
      zoningCode,
    );

    // ── Step 5: Score and rank ─────────────────────────────────────────
    const scored = this.step5_scoreAndRank(
      candidatesWithPrecedent,
      districtRow,
      profile,
      nearbyParcels,
    );

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const result: ZoningRecommendationResult = {
      dealId,
      currentCode: zoningCode,
      municipality,
      state,
      nearbyAnalysis,
      topRecommendation: scored.length > 0 ? scored[0] : null,
      additionalCandidates: scored.slice(1),
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // Persist to cache table
    await this.cacheResult(dealId, result);

    return result;
  }

  /**
   * Returns cached result if valid, null otherwise.
   */
  async getCachedResult(dealId: string): Promise<ZoningRecommendationResult | null> {
    try {
      const res = await this.pool.query(
        `SELECT result_json FROM zoning_recommendations
         WHERE deal_id = $1 AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [dealId],
      );
      if (res.rows.length > 0 && res.rows[0].result_json) {
        return res.rows[0].result_json as ZoningRecommendationResult;
      }
    } catch {
      // Table may not exist yet — graceful fallback
    }
    return null;
  }

  /**
   * Retrieve the latest result (cached or fresh).
   */
  async getResult(dealId: string): Promise<ZoningRecommendationResult | null> {
    // First try cache
    const cached = await this.getCachedResult(dealId);
    if (cached) return cached;

    // Also check if there's an expired result to return stale
    try {
      const res = await this.pool.query(
        `SELECT result_json FROM zoning_recommendations
         WHERE deal_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [dealId],
      );
      if (res.rows.length > 0 && res.rows[0].result_json) {
        return res.rows[0].result_json as ZoningRecommendationResult;
      }
    } catch {}
    return null;
  }

  // ── Step 1 ───────────────────────────────────────────────────────────

  private async step1_fetchConfirmedZoning(dealId: string) {
    // Get zoning confirmation
    const confRes = await this.pool.query(
      `SELECT zoning_code, municipality, state FROM deal_zoning_confirmations
       WHERE deal_id = $1 AND confirmed_at IS NOT NULL
       ORDER BY confirmed_at DESC LIMIT 1`,
      [dealId],
    );
    if (confRes.rows.length === 0) {
      throw new Error('No confirmed zoning found for this deal. Confirm zoning first.');
    }
    const { zoning_code: zoningCode, municipality, state } = confRes.rows[0];

    // Resolve municipality ID
    const munRes = await this.pool.query(
      `SELECT id FROM municipalities WHERE UPPER(name) = UPPER($1) AND UPPER(state) = UPPER($2) LIMIT 1`,
      [municipality, state],
    );
    const municipalityId = munRes.rows[0]?.id || null;

    // Fetch district rules
    let districtRow: any = null;
    if (municipalityId) {
      const dRes = await this.pool.query(
        `SELECT * FROM zoning_districts
         WHERE UPPER(COALESCE(zoning_code, district_code)) = UPPER($1)
           AND municipality_id = $2
         LIMIT 1`,
        [zoningCode, municipalityId],
      );
      districtRow = dRes.rows[0] || null;
    }
    if (!districtRow) {
      const dRes = await this.pool.query(
        `SELECT zd.*, m.id as municipality_id FROM zoning_districts zd
         LEFT JOIN municipalities m ON m.id = zd.municipality_id
         WHERE UPPER(COALESCE(zd.zoning_code, zd.district_code)) = UPPER($1)
           AND UPPER(COALESCE(zd.municipality, m.name)) = UPPER($2)
         LIMIT 1`,
        [zoningCode, municipality],
      );
      districtRow = dRes.rows[0] || null;
    }

    // Also get zoning profile for envelope calculations
    let profile: any = null;
    try {
      const profRes = await this.pool.query(
        `SELECT * FROM deal_zoning_profiles WHERE deal_id = $1 LIMIT 1`,
        [dealId],
      );
      profile = profRes.rows[0] || null;
    } catch {}

    return {
      zoningCode,
      municipality,
      state,
      municipalityId: municipalityId || districtRow?.municipality_id || null,
      districtRow,
      profile,
    };
  }

  // ── Step 2 ───────────────────────────────────────────────────────────

  private async step2_scanNearbyParcels(
    dealId: string,
    municipality: string,
  ): Promise<NearbyParcelZoning[]> {
    const parcels: NearbyParcelZoning[] = [];

    try {
      // Get deal centroid from boundary
      const boundaryRes = await this.pool.query(
        `SELECT centroid FROM property_boundaries WHERE deal_id = $1 LIMIT 1`,
        [dealId],
      );
      if (boundaryRes.rows.length === 0) return parcels;

      const centroid = boundaryRes.rows[0].centroid;
      if (!centroid) return parcels;

      // Parse centroid — can be point object or string
      let lng: number, lat: number;
      if (typeof centroid === 'object' && 'x' in centroid) {
        lng = parseFloat(centroid.x);
        lat = parseFloat(centroid.y);
      } else if (typeof centroid === 'string') {
        const match = centroid.match(/\(([^,]+),([^)]+)\)/);
        if (!match) return parcels;
        lng = parseFloat(match[1]);
        lat = parseFloat(match[2]);
      } else {
        return parcels;
      }

      if (isNaN(lng) || isNaN(lat)) return parcels;

      // Query zoning_district_boundaries within 500m of centroid
      const nearbyRes = await this.pool.query(
        `SELECT DISTINCT ON (zdb.zoning_code)
           zdb.id as parcel_id,
           '' as address,
           COALESCE(zdb.zoning_code, zd.zoning_code, zd.district_code) as zoning_code,
           ST_Distance(
             zdb.boundary::geography,
             ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
           ) as distance_m
         FROM zoning_district_boundaries zdb
         LEFT JOIN zoning_districts zd ON zd.id = zdb.district_id
         WHERE ST_DWithin(
           zdb.boundary::geography,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           500
         )
         ORDER BY zdb.zoning_code, distance_m
         LIMIT 50`,
        [lng, lat],
      );

      for (const row of nearbyRes.rows) {
        if (row.zoning_code) {
          parcels.push({
            parcelId: row.parcel_id || '',
            address: row.address || null,
            zoningCode: row.zoning_code,
            distanceFeet: Math.round((row.distance_m || 0) * 3.28084),
          });
        }
      }
    } catch {
      // PostGIS query may fail if tables don't exist — graceful fallback
    }

    // Also try to get nearby deals with confirmed zoning
    try {
      const nearbyDealsRes = await this.pool.query(
        `SELECT d.id, d.address,
                dzc.zoning_code,
                ST_Distance(
                  d.location::geography,
                  (SELECT location::geography FROM deals WHERE id = $1)
                ) as distance_m
         FROM deals d
         JOIN deal_zoning_confirmations dzc ON dzc.deal_id = d.id AND dzc.confirmed_at IS NOT NULL
         WHERE d.id != $1
           AND d.location IS NOT NULL
           AND (SELECT location FROM deals WHERE id = $1) IS NOT NULL
           AND ST_DWithin(
             d.location::geography,
             (SELECT location::geography FROM deals WHERE id = $1),
             500
           )
         ORDER BY distance_m
         LIMIT 20`,
        [dealId],
      );

      for (const row of nearbyDealsRes.rows) {
        if (row.zoning_code && !parcels.find(p => p.zoningCode === row.zoning_code && p.address === row.address)) {
          parcels.push({
            parcelId: row.id,
            address: row.address || null,
            zoningCode: row.zoning_code,
            distanceFeet: Math.round((row.distance_m || 0) * 3.28084),
          });
        }
      }
    } catch {}

    return parcels;
  }

  // ── Step 3 ───────────────────────────────────────────────────────────

  private async step3_identifyCandidates(
    currentDistrict: any,
    municipalityId: string | null,
    municipality: string,
    nearbyParcels: NearbyParcelZoning[],
  ): Promise<Array<{ district: any; nearbyCount: number }>> {
    if (!currentDistrict) return [];

    const currentDensity = parseFloat(
      currentDistrict.max_density_per_acre || currentDistrict.max_units_per_acre || '0',
    );
    const currentFar = parseFloat(currentDistrict.max_far || '0');

    // Find higher-density districts in the same municipality
    const result = await this.pool.query(
      `SELECT zd.*, m.name as municipality_name, m.state as municipality_state
       FROM zoning_districts zd
       LEFT JOIN municipalities m ON m.id = zd.municipality_id
       WHERE (zd.municipality_id = $1 OR UPPER(COALESCE(zd.municipality, m.name)) = UPPER($2))
         AND zd.id != $3
         AND (
           COALESCE(zd.max_density_per_acre, zd.max_units_per_acre, 0) > $4
           OR COALESCE(zd.max_far, 0) > $5
         )
       ORDER BY COALESCE(zd.max_density_per_acre, zd.max_units_per_acre, 0) DESC NULLS LAST
       LIMIT 10`,
      [municipalityId, municipality, currentDistrict.id, currentDensity, currentFar],
    );

    // Enrich each candidate with nearby evidence count
    const nearbyCodes = nearbyParcels.map(p => p.zoningCode.toUpperCase());

    return result.rows.map(district => {
      const code = (district.zoning_code || district.district_code || '').toUpperCase();
      const nearbyCount = nearbyCodes.filter(c => c === code).length;
      return { district, nearbyCount };
    });
  }

  // ── Step 4 ───────────────────────────────────────────────────────────

  private async step4_checkPrecedent(
    candidates: Array<{ district: any; nearbyCount: number }>,
    municipalityId: string | null,
    currentCode: string,
  ): Promise<Array<{ district: any; nearbyCount: number; evidence: RezoneEvidence | null }>> {
    const results: Array<{ district: any; nearbyCount: number; evidence: RezoneEvidence | null }> = [];

    for (const c of candidates) {
      const targetCode = c.district.zoning_code || c.district.district_code;
      let evidence: RezoneEvidence | null = null;
      try {
        evidence = await this.rezoneService.getRezoneEvidence(
          municipalityId,
          currentCode,
          targetCode,
        );
      } catch {}
      results.push({ ...c, evidence });
    }

    return results;
  }

  // ── Step 5 ───────────────────────────────────────────────────────────

  private step5_scoreAndRank(
    candidates: Array<{ district: any; nearbyCount: number; evidence: RezoneEvidence | null }>,
    currentDistrict: any,
    profile: any,
    nearbyParcels: NearbyParcelZoning[],
  ): CandidateRecommendation[] {
    if (!currentDistrict) return [];

    const currentDensity = parseFloat(
      currentDistrict.max_density_per_acre || currentDistrict.max_units_per_acre || '0',
    );
    const currentFar = parseFloat(currentDistrict.max_far || '0');
    const totalNearby = nearbyParcels.length || 1; // avoid div/0

    const scored: CandidateRecommendation[] = [];

    for (const { district, nearbyCount, evidence } of candidates) {
      const targetCode = district.zoning_code || district.district_code;
      const targetDensity = parseFloat(
        district.max_density_per_acre || district.max_units_per_acre || '0',
      );
      const targetFar = parseFloat(district.max_far || '0');

      // Density uplift %
      const densityUpliftPct = currentDensity > 0
        ? Math.round(((targetDensity - currentDensity) / currentDensity) * 100)
        : targetDensity > 0 ? 100 : 0;

      // FAR uplift %
      const farUpliftPct = currentFar > 0
        ? Math.round(((targetFar - currentFar) / currentFar) * 100)
        : targetFar > 0 ? 100 : 0;

      // Component scores (0–1 each)
      const maxUplift = Math.max(densityUpliftPct, farUpliftPct);
      const densityScore = Math.min(maxUplift / 200, 1); // 200% uplift = perfect score

      const proximityScore = Math.min(nearbyCount / Math.max(totalNearby * 0.3, 1), 1);

      let precedentScore = 0.5; // neutral when no data
      if (evidence && evidence.count > 0) {
        precedentScore = evidence.approvalRate / 100;
      }

      // Weighted composite: density 40%, proximity 30%, precedent 30%
      const compositeScore = Math.round(
        (densityScore * 0.4 + proximityScore * 0.3 + precedentScore * 0.3) * 100,
      );

      const approvalRate = evidence && evidence.count > 0 ? evidence.approvalRate : null;
      const avgTimelineDays = evidence && evidence.avgDays > 0 ? evidence.avgDays : null;

      const insight = this.buildInsight(
        targetCode,
        densityUpliftPct,
        farUpliftPct,
        nearbyCount,
        approvalRate,
      );

      scored.push({
        targetCode,
        targetDistrictName: district.district_name || null,
        targetDistrictId: district.id || null,
        score: compositeScore,
        densityUpliftPct,
        farUpliftPct,
        nearbyEvidence: nearbyCount,
        approvalRate,
        avgTimelineDays,
        precedentCount: evidence?.count || 0,
        insight,
      });
    }

    // Sort descending by composite score
    scored.sort((a, b) => b.score - a.score);

    return scored;
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private buildNearbyAnalysis(
    parcels: NearbyParcelZoning[],
    currentCode: string,
  ): NearbyAnalysisSummary {
    const codeCounts = new Map<string, number>();
    for (const p of parcels) {
      const code = p.zoningCode.toUpperCase();
      codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
    }

    const distribution: ZoningCodeDistribution[] = [];
    const total = parcels.length || 1;
    for (const [code, count] of codeCounts.entries()) {
      distribution.push({
        code,
        count,
        pct: Math.round((count / total) * 100),
      });
    }
    distribution.sort((a, b) => b.count - a.count);

    const uniqueCodes = codeCounts.size;
    let areaPattern = 'Insufficient data';
    if (parcels.length >= 3) {
      const topCode = distribution[0]?.code;
      const topPct = distribution[0]?.pct || 0;
      if (topPct >= 70) {
        areaPattern = `Predominantly ${topCode} (${topPct}%)`;
      } else if (uniqueCodes <= 3) {
        areaPattern = `Mixed-use corridor with ${uniqueCodes} zoning types`;
      } else {
        areaPattern = `Diverse zoning area with ${uniqueCodes} different codes`;
      }
    }

    return {
      parcelsScanned: parcels.length,
      uniqueCodes,
      areaPattern,
      distribution,
    };
  }

  private buildInsight(
    targetCode: string,
    densityUpliftPct: number,
    farUpliftPct: number,
    nearbyCount: number,
    approvalRate: number | null,
  ): string {
    const parts: string[] = [];

    if (densityUpliftPct > 0 || farUpliftPct > 0) {
      const bestUplift = Math.max(densityUpliftPct, farUpliftPct);
      parts.push(`${targetCode} offers up to ${bestUplift}% density/FAR uplift.`);
    }

    if (nearbyCount > 0) {
      parts.push(
        `${nearbyCount} nearby parcel${nearbyCount > 1 ? 's' : ''} already zoned ${targetCode}, supporting feasibility.`,
      );
    }

    if (approvalRate != null) {
      if (approvalRate >= 75) {
        parts.push(`Strong precedent: ${approvalRate}% historical approval rate.`);
      } else if (approvalRate >= 50) {
        parts.push(`Moderate precedent: ${approvalRate}% approval rate.`);
      } else {
        parts.push(`Caution: only ${approvalRate}% historical approval rate.`);
      }
    }

    return parts.join(' ') || `${targetCode} is a potential upzoning target in this area.`;
  }

  private async cacheResult(dealId: string, result: ZoningRecommendationResult): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO zoning_recommendations (deal_id, result_json, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (deal_id)
         DO UPDATE SET result_json = $2, expires_at = $3, updated_at = NOW()`,
        [dealId, JSON.stringify(result), result.expiresAt],
      );
    } catch {
      // Table may not exist yet — silently skip caching
    }
  }
}
