import { Pool } from 'pg';

export interface ZoningDistrictProfile {
  code: string;
  fullName: string;
  jurisdiction: string;
  state: string;
  codeSection?: string;
  lastAmended?: string;

  dimensional: {
    maxDensityUnitsPerAcre: number | null;
    maxHeightFt: number | null;
    maxFAR: number | null;
    maxLotCoveragePct: number | null;
    minOpenSpacePct: number | null;
    minLotSizeSf: number | null;
    minLotWidthFt: number | null;
    maxStories: number | null;
    setbacks: { front: number; side: number; rear: number };
    setbackConditions: Array<{ condition: string; [key: string]: any }>;
  };

  uses: {
    byRight: Array<{ use: string; conditions: string | null }>;
    conditional: Array<{ use: string; approval: string; conditions?: string; typicalTimelineMo?: number }>;
    prohibited: string[];
  };

  parking: {
    residential: { perUnit: number; guestPerUnit: number } | null;
    commercial: { per1000sf: number } | null;
    restaurant: { per1000sf: number } | null;
    hotel: { perRoom: number } | null;
    reductions: Array<{ trigger: string; reductionPct: number; codeRef?: string }>;
  };

  crossReferences: Array<{ ref: string; topic: string; note: string }>;

  incentives: Array<{ program: string; trigger: string; benefit: string; codeRef?: string }>;

  applicableOverlays: Array<{ overlay: string; name: string; overrides?: string[]; additionalRequirements?: string[] }>;
}

export interface LookupResult {
  found: boolean;
  source: 'structured' | 'flat' | 'none';
  profile: ZoningDistrictProfile | null;
  flatData: any | null;
  districtId: string | null;
  confidence: number;
  citations: string[];
}

export interface UsePermissionResult {
  use: string;
  status: 'by_right' | 'conditional' | 'prohibited' | 'unknown';
  conditions: string | null;
  approvalRequired: string | null;
  confidence: number;
  citation: string | null;
}

export interface ParkingCalculation {
  totalSpaces: number;
  breakdown: Array<{ useType: string; units: number; ratio: number; spaces: number }>;
  reductions: Array<{ trigger: string; reductionPct: number; spacesReduced: number }>;
  netSpaces: number;
  citation: string | null;
}

export class ZoningKnowledgeService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async lookupDistrict(districtCode: string, municipality: string): Promise<LookupResult> {
    const result = await this.pool.query(
      `SELECT * FROM zoning_districts 
       WHERE (UPPER(COALESCE(zoning_code, district_code)) = UPPER($1))
         AND UPPER(COALESCE(municipality, '')) = UPPER($2)
       LIMIT 1`,
      [districtCode, municipality]
    );

    if (result.rows.length === 0) {
      return { found: false, source: 'none', profile: null, flatData: null, districtId: null, confidence: 0, citations: [] };
    }

    const row = result.rows[0];

    if (row.district_profile) {
      const profile = row.district_profile as ZoningDistrictProfile;
      return {
        found: true,
        source: 'structured',
        profile,
        flatData: row,
        districtId: row.id,
        confidence: row.confidence_score || 85,
        citations: profile.crossReferences?.map((cr: any) => cr.ref) || [],
      };
    }

    const profile = this.buildProfileFromFlat(row);
    return {
      found: true,
      source: 'flat',
      profile,
      flatData: row,
      districtId: row.id,
      confidence: row.confidence_score || 70,
      citations: [],
    };
  }

  async checkUsePermission(districtCode: string, municipality: string, useType: string): Promise<UsePermissionResult> {
    const lookup = await this.lookupDistrict(districtCode, municipality);
    if (!lookup.found || !lookup.profile) {
      return { use: useType, status: 'unknown', conditions: null, approvalRequired: null, confidence: 0, citation: null };
    }

    const profile = lookup.profile;
    const normalizedUse = useType.toLowerCase().replace(/[\s-]/g, '_');

    const byRight = profile.uses.byRight.find(u => u.use.toLowerCase().includes(normalizedUse) || normalizedUse.includes(u.use.toLowerCase()));
    if (byRight) {
      return {
        use: useType,
        status: 'by_right',
        conditions: byRight.conditions,
        approvalRequired: null,
        confidence: lookup.confidence,
        citation: profile.codeSection || null,
      };
    }

    const conditional = profile.uses.conditional.find(u => u.use.toLowerCase().includes(normalizedUse) || normalizedUse.includes(u.use.toLowerCase()));
    if (conditional) {
      return {
        use: useType,
        status: 'conditional',
        conditions: conditional.conditions || null,
        approvalRequired: conditional.approval,
        confidence: lookup.confidence,
        citation: profile.codeSection || null,
      };
    }

    const prohibited = profile.uses.prohibited.find(u => u.toLowerCase().includes(normalizedUse) || normalizedUse.includes(u.toLowerCase()));
    if (prohibited) {
      return {
        use: useType,
        status: 'prohibited',
        conditions: null,
        approvalRequired: null,
        confidence: lookup.confidence,
        citation: profile.codeSection || null,
      };
    }

    return { use: useType, status: 'unknown', conditions: null, approvalRequired: null, confidence: Math.max(0, lookup.confidence - 20), citation: null };
  }

  calculateParking(profile: ZoningDistrictProfile, units: number, commercialSf: number = 0, transitProximity: boolean = false): ParkingCalculation {
    const breakdown: ParkingCalculation['breakdown'] = [];
    const reductions: ParkingCalculation['reductions'] = [];

    if (profile.parking.residential && units > 0) {
      const spaces = units * profile.parking.residential.perUnit;
      const guestSpaces = units * profile.parking.residential.guestPerUnit;
      breakdown.push({ useType: 'residential', units, ratio: profile.parking.residential.perUnit, spaces });
      if (guestSpaces > 0) {
        breakdown.push({ useType: 'guest', units, ratio: profile.parking.residential.guestPerUnit, spaces: guestSpaces });
      }
    }

    if (profile.parking.commercial && commercialSf > 0) {
      const spaces = (commercialSf / 1000) * profile.parking.commercial.per1000sf;
      breakdown.push({ useType: 'commercial', units: commercialSf, ratio: profile.parking.commercial.per1000sf, spaces });
    }

    let totalSpaces = breakdown.reduce((sum, b) => sum + b.spaces, 0);

    for (const reduction of profile.parking.reductions) {
      if (transitProximity && reduction.trigger.toLowerCase().includes('transit')) {
        const spacesReduced = Math.round(totalSpaces * (reduction.reductionPct / 100));
        reductions.push({ trigger: reduction.trigger, reductionPct: reduction.reductionPct, spacesReduced });
      }
    }

    const totalReduced = reductions.reduce((sum, r) => sum + r.spacesReduced, 0);
    const netSpaces = Math.ceil(totalSpaces - totalReduced);

    return {
      totalSpaces: Math.ceil(totalSpaces),
      breakdown,
      reductions,
      netSpaces,
      citation: profile.parking.reductions?.[0]?.codeRef || null,
    };
  }

  async getDimensionalStandards(districtCode: string, municipality: string): Promise<any> {
    const lookup = await this.lookupDistrict(districtCode, municipality);
    if (!lookup.found || !lookup.profile) return null;
    return {
      ...lookup.profile.dimensional,
      confidence: lookup.confidence,
      source: lookup.source,
      codeSection: lookup.profile.codeSection,
    };
  }

  async getIncentivePrograms(districtCode: string, municipality: string): Promise<any[]> {
    const lookup = await this.lookupDistrict(districtCode, municipality);
    if (!lookup.found || !lookup.profile) return [];
    return lookup.profile.incentives || [];
  }

  async getOverlayDistricts(districtCode: string, municipality: string): Promise<any[]> {
    const lookup = await this.lookupDistrict(districtCode, municipality);
    if (!lookup.found || !lookup.profile) return [];
    return lookup.profile.applicableOverlays || [];
  }

  async saveStructuredProfile(districtId: string, profile: ZoningDistrictProfile, confidenceScore: number): Promise<void> {
    await this.pool.query(
      `UPDATE zoning_districts SET 
        district_profile = $2,
        confidence_score = $3,
        last_extracted_at = NOW(),
        extraction_version = COALESCE(extraction_version, 0) + 1,
        code_section = $4,
        updated_at = NOW()
       WHERE id = $1`,
      [districtId, JSON.stringify(profile), confidenceScore, profile.codeSection || null]
    );
  }

  async getJurisdictionMaturity(municipality: string): Promise<{
    level: string;
    districtsTotal: number;
    districtsWithProfiles: number;
    precedentCount: number;
    correctionCount: number;
    confidenceCap: number;
  }> {
    const districtResult = await this.pool.query(
      `SELECT COUNT(*) as total, 
              COUNT(district_profile) as with_profiles
       FROM zoning_districts WHERE UPPER(municipality) = UPPER($1)`,
      [municipality]
    );
    const precedentResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM zoning_precedents WHERE UPPER(municipality) = UPPER($1)`,
      [municipality]
    );
    const correctionResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM zoning_corrections c 
       JOIN zoning_districts d ON c.district_id = d.id
       WHERE UPPER(d.municipality) = UPPER($1) AND c.applied = true`,
      [municipality]
    );

    const total = parseInt(districtResult.rows[0].total);
    const withProfiles = parseInt(districtResult.rows[0].with_profiles);
    const precedents = parseInt(precedentResult.rows[0].count);
    const corrections = parseInt(correctionResult.rows[0].count);

    let level = 'novice';
    let confidenceCap = 75;
    if (precedents >= 200 && corrections >= 20) {
      level = 'authority'; confidenceCap = 97;
    } else if (precedents >= 50 && corrections >= 10) {
      level = 'expert'; confidenceCap = 95;
    } else if (precedents >= 10 || corrections >= 5) {
      level = 'competent'; confidenceCap = 88;
    }

    return { level, districtsTotal: total, districtsWithProfiles: withProfiles, precedentCount: precedents, correctionCount: corrections, confidenceCap };
  }

  private buildProfileFromFlat(row: any): ZoningDistrictProfile {
    return {
      code: row.zoning_code || row.district_code,
      fullName: row.district_name || row.zoning_code || row.district_code,
      jurisdiction: row.municipality,
      state: row.state,
      codeSection: row.code_section || null,

      dimensional: {
        maxDensityUnitsPerAcre: row.max_density_per_acre ?? row.max_units_per_acre ?? null,
        maxHeightFt: row.max_building_height_ft ?? row.max_height_feet ?? null,
        maxFAR: row.max_far ? parseFloat(row.max_far) : null,
        maxLotCoveragePct: row.max_lot_coverage ? parseFloat(row.max_lot_coverage) * 100 : (row.max_lot_coverage_percent ? parseFloat(row.max_lot_coverage_percent) : null),
        minOpenSpacePct: null,
        minLotSizeSf: row.min_lot_size_sqft ?? null,
        minLotWidthFt: row.min_lot_width_ft ?? null,
        maxStories: row.max_stories ?? null,
        setbacks: {
          front: row.min_front_setback_ft ?? row.setback_front_ft ?? 0,
          side: row.min_side_setback_ft ?? row.setback_side_ft ?? 0,
          rear: row.min_rear_setback_ft ?? row.setback_rear_ft ?? 0,
        },
        setbackConditions: [],
      },

      uses: {
        byRight: (row.permitted_uses || []).map((u: string) => ({ use: u, conditions: null })),
        conditional: (row.conditional_uses || []).map((u: string) => ({ use: u, approval: 'CUP', conditions: null })),
        prohibited: row.prohibited_uses || [],
      },

      parking: {
        residential: row.parking_per_unit ? { perUnit: parseFloat(row.parking_per_unit), guestPerUnit: 0.25 } : null,
        commercial: row.parking_per_1000_sqft ? { per1000sf: parseFloat(row.parking_per_1000_sqft) } : null,
        restaurant: null,
        hotel: null,
        reductions: [],
      },

      crossReferences: [],
      incentives: [],
      applicableOverlays: (row.overlay_districts || []).map((o: string) => ({ overlay: o, name: o })),
    };
  }
}
