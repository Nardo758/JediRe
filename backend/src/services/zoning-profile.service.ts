import { Pool } from 'pg';

export interface ZoningProfile {
  id: string;
  deal_id: string;
  base_district_code: string | null;
  base_district_id: string | null;
  municipality: string | null;
  state: string | null;
  residential_far: number | null;
  nonresidential_far: number | null;
  combined_far: number | null;
  applied_far: number | null;
  density_method: string;
  max_density_per_acre: number | null;
  max_height_ft: number | null;
  max_stories: number | null;
  height_buffer_ft: number | null;
  height_beyond_buffer_ft: number | null;
  max_lot_coverage_pct: number | null;
  setback_front_ft: number | null;
  setback_side_ft: number | null;
  setback_rear_ft: number | null;
  min_parking_per_unit: number | null;
  open_space_pct: number | null;
  lot_area_sf: number | null;
  buildable_area_sf: number | null;
  centroid_lng: number | null;
  centroid_lat: number | null;
  overlays: any[];
  conditional_ordinance_text: string | null;
  conditional_overrides: Record<string, any>;
  user_overrides: Record<string, any>;
  constraint_source: string;
  resolution_errors: any[];
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeMunicipality(name: string | null): string | null {
  if (!name) return null;
  return name
    .replace(/^City of\s+/i, '')
    .replace(/^Town of\s+/i, '')
    .replace(/^Village of\s+/i, '')
    .replace(/^Borough of\s+/i, '')
    .trim();
}

function parseCentroid(raw: any): [number, number] | null {
  if (!raw) return null;

  if (Array.isArray(raw) && raw.length >= 2) {
    const lng = parseFloat(raw[0]);
    const lat = parseFloat(raw[1]);
    if (!isNaN(lng) && !isNaN(lat)) return [lng, lat];
  }

  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[(){}[\]]/g, '');
    const parts = cleaned.split(',').map((s: string) => parseFloat(s.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return [parts[0], parts[1]];
    }
  }

  if (typeof raw === 'object' && raw !== null) {
    const lng = parseFloat(raw.x ?? raw.lng ?? raw.longitude ?? raw[0]);
    const lat = parseFloat(raw.y ?? raw.lat ?? raw.latitude ?? raw[1]);
    if (!isNaN(lng) && !isNaN(lat)) return [lng, lat];
  }

  return null;
}

function mapProjectTypeToDealType(projectType: string): 'residential' | 'commercial' | 'mixed-use' {
  const pt = (projectType || '').toLowerCase();
  if (['multifamily', 'residential'].includes(pt)) return 'residential';
  if (['office', 'retail', 'industrial', 'hospitality', 'special_purpose'].includes(pt)) return 'commercial';
  if (pt === 'mixed_use' || pt === 'mixed-use') return 'mixed-use';
  return 'residential';
}

export class ZoningProfileService {
  constructor(private pool: Pool) {}

  async resolveProfile(dealId: string): Promise<ZoningProfile> {
    const errors: any[] = [];

    const dealResult = await this.pool.query(
      'SELECT project_type FROM deals WHERE id = $1',
      [dealId]
    );
    if (dealResult.rows.length === 0) {
      throw new Error(`Deal ${dealId} not found`);
    }
    const projectType = dealResult.rows[0].project_type || 'multifamily';

    let lotAreaSf: number | null = null;
    let buildableAreaSf: number | null = null;
    let centroidLng: number | null = null;
    let centroidLat: number | null = null;
    let setbackFront: number | null = null;
    let setbackSide: number | null = null;
    let setbackRear: number | null = null;

    try {
      const boundaryResult = await this.pool.query(
        `SELECT parcel_area_sf, buildable_area_sf, centroid, setbacks
         FROM property_boundaries WHERE deal_id = $1`,
        [dealId]
      );
      if (boundaryResult.rows.length > 0) {
        const b = boundaryResult.rows[0];
        lotAreaSf = b.parcel_area_sf ? parseFloat(b.parcel_area_sf) : null;
        buildableAreaSf = b.buildable_area_sf ? parseFloat(b.buildable_area_sf) : null;

        const centroid = parseCentroid(b.centroid);
        if (centroid) {
          [centroidLng, centroidLat] = centroid;
        } else if (b.centroid) {
          errors.push({ step: 'centroid_parse', message: `Could not parse centroid: ${JSON.stringify(b.centroid)}` });
        }

        if (b.setbacks) {
          const setbacks = typeof b.setbacks === 'string' ? JSON.parse(b.setbacks) : b.setbacks;
          setbackFront = setbacks.front ?? null;
          setbackSide = setbacks.side ?? null;
          setbackRear = setbacks.rear ?? null;
        }
      } else {
        errors.push({ step: 'boundary_lookup', message: 'No property boundary found for deal' });
      }
    } catch (err: any) {
      errors.push({ step: 'boundary_lookup', message: err.message });
    }

    let zoningCode: string | null = null;
    let municipality: string | null = null;
    let state: string | null = null;

    try {
      const confirmResult = await this.pool.query(
        'SELECT zoning_code, municipality, state FROM deal_zoning_confirmations WHERE deal_id = $1',
        [dealId]
      );
      if (confirmResult.rows.length > 0) {
        zoningCode = confirmResult.rows[0].zoning_code;
        municipality = normalizeMunicipality(confirmResult.rows[0].municipality);
        state = confirmResult.rows[0].state;
      } else {
        errors.push({ step: 'zoning_confirmation', message: 'No zoning confirmation found for deal' });
      }
    } catch (err: any) {
      errors.push({ step: 'zoning_confirmation', message: err.message });
    }

    let baseDistrictId: string | null = null;
    let residentialFar: number | null = null;
    let nonresidentialFar: number | null = null;
    let combinedFar: number | null = null;
    let densityMethod = 'units_per_acre';
    let maxDensityPerAcre: number | null = null;
    let maxHeightFt: number | null = null;
    let maxStories: number | null = null;
    let heightBufferFt: number | null = null;
    let heightBeyondBufferFt: number | null = null;
    let maxLotCoveragePct: number | null = null;
    let minParkingPerUnit: number | null = null;
    let openSpacePct: number | null = null;
    let districtSetbackFront: number | null = null;
    let districtSetbackSide: number | null = null;
    let districtSetbackRear: number | null = null;

    if (zoningCode) {
      try {
        let district = await this.lookupDistrict(zoningCode, municipality);

        if (district) {
          baseDistrictId = district.id;

          const devStandardFields = [
            'max_density_per_acre', 'max_units_per_acre', 'max_far',
            'residential_far', 'nonresidential_far', 'density_method',
            'max_height_feet', 'max_building_height_ft', 'max_stories',
            'height_buffer_ft', 'height_beyond_buffer_ft',
            'min_parking_per_unit', 'parking_per_unit',
            'setback_front_ft', 'setback_side_ft', 'setback_rear_ft',
            'min_front_setback_ft', 'min_side_setback_ft', 'min_rear_setback_ft',
            'max_lot_coverage', 'max_lot_coverage_percent',
          ];
          const hasNoStandards = devStandardFields.every(f => district[f] == null);

          if (hasNoStandards) {
            const baseMatch = zoningCode.toUpperCase().match(/^(.+)-[A-Z]{1,2}$/);
            if (baseMatch) {
              const baseDistrict = await this.lookupDistrict(baseMatch[1], municipality);
              if (baseDistrict) {
                const mergeFields = [
                  ...devStandardFields,
                  'district_name', 'description', 'permitted_uses', 'conditional_uses',
                  'prohibited_uses', 'full_code_text', 'code_section',
                ];
                for (const field of mergeFields) {
                  if (district[field] == null || district[field] === '') {
                    if (baseDistrict[field] != null && baseDistrict[field] !== '') {
                      district[field] = baseDistrict[field];
                    }
                  }
                }
              }
            }
          }

          residentialFar = parseFloat(district.residential_far) || null;
          nonresidentialFar = parseFloat(district.nonresidential_far) || null;
          combinedFar = parseFloat(district.max_far) || null;
          densityMethod = district.density_method || 'units_per_acre';
          maxDensityPerAcre = parseFloat(district.max_density_per_acre || district.max_units_per_acre) || null;
          maxHeightFt = parseInt(district.max_height_feet || district.max_building_height_ft) || null;
          maxStories = parseInt(district.max_stories) || null;
          heightBufferFt = parseInt(district.height_buffer_ft) || null;
          heightBeyondBufferFt = parseInt(district.height_beyond_buffer_ft) || null;
          maxLotCoveragePct = parseFloat(district.max_lot_coverage || district.max_lot_coverage_percent) || null;
          minParkingPerUnit = parseFloat(district.min_parking_per_unit || district.parking_per_unit) || null;
          openSpacePct = parseFloat(district.open_space_pct) || null;
          districtSetbackFront = parseInt(district.setback_front_ft || district.min_front_setback_ft) || null;
          districtSetbackSide = parseInt(district.setback_side_ft || district.min_side_setback_ft) || null;
          districtSetbackRear = parseInt(district.setback_rear_ft || district.min_rear_setback_ft) || null;
        } else {
          errors.push({ step: 'district_lookup', message: `No zoning district found for code "${zoningCode}"` });
        }
      } catch (err: any) {
        errors.push({ step: 'district_lookup', message: err.message });
      }
    }

    const finalSetbackFront = setbackFront ?? districtSetbackFront;
    const finalSetbackSide = setbackSide ?? districtSetbackSide;
    const finalSetbackRear = setbackRear ?? districtSetbackRear;

    const dealType = mapProjectTypeToDealType(projectType);
    let appliedFar: number | null = null;
    if (residentialFar != null || nonresidentialFar != null || combinedFar != null) {
      if (dealType === 'residential' && residentialFar != null) {
        appliedFar = residentialFar;
      } else if (dealType === 'commercial' && nonresidentialFar != null) {
        appliedFar = nonresidentialFar;
      } else if (dealType === 'mixed-use' && combinedFar != null) {
        appliedFar = combinedFar;
      } else {
        appliedFar = combinedFar ?? residentialFar ?? nonresidentialFar ?? null;
      }
    }

    const existingResult = await this.pool.query(
      'SELECT user_overrides, conditional_overrides, overlays, conditional_ordinance_text FROM deal_zoning_profiles WHERE deal_id = $1',
      [dealId]
    );

    let userOverrides: Record<string, any> = {};
    let conditionalOverrides: Record<string, any> = {};
    let overlays: any[] = [];
    let conditionalOrdinanceText: string | null = null;

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      userOverrides = existing.user_overrides || {};
      conditionalOverrides = existing.conditional_overrides || {};
      overlays = existing.overlays || [];
      conditionalOrdinanceText = existing.conditional_ordinance_text;
    }

    const profileData: any = {
      base_district_code: zoningCode,
      base_district_id: baseDistrictId,
      municipality,
      state,
      residential_far: residentialFar,
      nonresidential_far: nonresidentialFar,
      combined_far: combinedFar,
      applied_far: appliedFar,
      density_method: densityMethod,
      max_density_per_acre: maxDensityPerAcre,
      max_height_ft: maxHeightFt,
      max_stories: maxStories,
      height_buffer_ft: heightBufferFt,
      height_beyond_buffer_ft: heightBeyondBufferFt,
      max_lot_coverage_pct: maxLotCoveragePct,
      setback_front_ft: finalSetbackFront,
      setback_side_ft: finalSetbackSide,
      setback_rear_ft: finalSetbackRear,
      min_parking_per_unit: minParkingPerUnit,
      open_space_pct: openSpacePct,
      lot_area_sf: lotAreaSf,
      buildable_area_sf: buildableAreaSf,
      centroid_lng: centroidLng,
      centroid_lat: centroidLat,
      overlays: JSON.stringify(overlays),
      conditional_ordinance_text: conditionalOrdinanceText,
      conditional_overrides: JSON.stringify(conditionalOverrides),
      user_overrides: JSON.stringify(userOverrides),
      resolution_errors: JSON.stringify(errors),
    };

    const applyOverrides = { ...conditionalOverrides, ...userOverrides };
    const overridableFields = [
      'residential_far', 'nonresidential_far', 'combined_far', 'applied_far',
      'max_density_per_acre', 'max_height_ft', 'max_stories',
      'height_buffer_ft', 'height_beyond_buffer_ft',
      'max_lot_coverage_pct', 'setback_front_ft', 'setback_side_ft', 'setback_rear_ft',
      'min_parking_per_unit', 'open_space_pct',
    ];
    for (const [field, override] of Object.entries(applyOverrides)) {
      if (overridableFields.includes(field) && override != null) {
        const val = typeof override === 'object' ? override.value : override;
        if (val != null) profileData[field] = val;
      }
    }

    const constraintSource = Object.keys(userOverrides).length > 0 ? 'user_modified' :
      Object.keys(conditionalOverrides).length > 0 ? 'conditional' : 'auto';
    profileData.constraint_source = constraintSource;

    const result = await this.pool.query(
      `INSERT INTO deal_zoning_profiles (
        deal_id, base_district_code, base_district_id, municipality, state,
        residential_far, nonresidential_far, combined_far, applied_far,
        density_method, max_density_per_acre,
        max_height_ft, max_stories, height_buffer_ft, height_beyond_buffer_ft,
        max_lot_coverage_pct, setback_front_ft, setback_side_ft, setback_rear_ft,
        min_parking_per_unit, open_space_pct,
        lot_area_sf, buildable_area_sf, centroid_lng, centroid_lat,
        overlays, conditional_ordinance_text, conditional_overrides,
        user_overrides, constraint_source, resolution_errors, resolved_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, NOW()
      )
      ON CONFLICT (deal_id) DO UPDATE SET
        base_district_code = EXCLUDED.base_district_code,
        base_district_id = EXCLUDED.base_district_id,
        municipality = EXCLUDED.municipality,
        state = EXCLUDED.state,
        residential_far = EXCLUDED.residential_far,
        nonresidential_far = EXCLUDED.nonresidential_far,
        combined_far = EXCLUDED.combined_far,
        applied_far = EXCLUDED.applied_far,
        density_method = EXCLUDED.density_method,
        max_density_per_acre = EXCLUDED.max_density_per_acre,
        max_height_ft = EXCLUDED.max_height_ft,
        max_stories = EXCLUDED.max_stories,
        height_buffer_ft = EXCLUDED.height_buffer_ft,
        height_beyond_buffer_ft = EXCLUDED.height_beyond_buffer_ft,
        max_lot_coverage_pct = EXCLUDED.max_lot_coverage_pct,
        setback_front_ft = EXCLUDED.setback_front_ft,
        setback_side_ft = EXCLUDED.setback_side_ft,
        setback_rear_ft = EXCLUDED.setback_rear_ft,
        min_parking_per_unit = EXCLUDED.min_parking_per_unit,
        open_space_pct = EXCLUDED.open_space_pct,
        lot_area_sf = EXCLUDED.lot_area_sf,
        buildable_area_sf = EXCLUDED.buildable_area_sf,
        centroid_lng = EXCLUDED.centroid_lng,
        centroid_lat = EXCLUDED.centroid_lat,
        overlays = EXCLUDED.overlays,
        conditional_ordinance_text = EXCLUDED.conditional_ordinance_text,
        conditional_overrides = EXCLUDED.conditional_overrides,
        user_overrides = EXCLUDED.user_overrides,
        constraint_source = EXCLUDED.constraint_source,
        resolution_errors = EXCLUDED.resolution_errors,
        resolved_at = NOW(),
        updated_at = NOW()
      RETURNING *`,
      [
        dealId, profileData.base_district_code, profileData.base_district_id,
        profileData.municipality, profileData.state,
        profileData.residential_far, profileData.nonresidential_far,
        profileData.combined_far, profileData.applied_far,
        profileData.density_method, profileData.max_density_per_acre,
        profileData.max_height_ft, profileData.max_stories,
        profileData.height_buffer_ft, profileData.height_beyond_buffer_ft,
        profileData.max_lot_coverage_pct, profileData.setback_front_ft,
        profileData.setback_side_ft, profileData.setback_rear_ft,
        profileData.min_parking_per_unit, profileData.open_space_pct,
        profileData.lot_area_sf, profileData.buildable_area_sf,
        profileData.centroid_lng, profileData.centroid_lat,
        profileData.overlays, profileData.conditional_ordinance_text,
        profileData.conditional_overrides, profileData.user_overrides,
        profileData.constraint_source, profileData.resolution_errors,
      ]
    );

    return result.rows[0];
  }

  async getProfile(dealId: string): Promise<ZoningProfile | null> {
    const result = await this.pool.query(
      'SELECT * FROM deal_zoning_profiles WHERE deal_id = $1',
      [dealId]
    );
    return result.rows[0] || null;
  }

  async updateOverrides(dealId: string, overrides: Record<string, any>): Promise<ZoningProfile> {
    const existing = await this.getProfile(dealId);
    if (!existing) {
      throw new Error('No zoning profile exists for this deal. Confirm zoning first.');
    }

    const currentOverrides = existing.user_overrides || {};
    const merged = { ...currentOverrides };
    for (const [field, value] of Object.entries(overrides)) {
      merged[field] = {
        value,
        set_at: new Date().toISOString(),
        previous: (existing as any)[field],
      };
    }

    await this.pool.query(
      `UPDATE deal_zoning_profiles SET user_overrides = $1, updated_at = NOW() WHERE deal_id = $2`,
      [JSON.stringify(merged), dealId]
    );

    return this.resolveProfile(dealId);
  }

  async addOverlay(dealId: string, overlay: { name: string; modifications: Record<string, any>; source?: string }): Promise<ZoningProfile> {
    const existing = await this.getProfile(dealId);
    if (!existing) {
      throw new Error('No zoning profile exists for this deal. Confirm zoning first.');
    }

    const overlays = Array.isArray(existing.overlays) ? [...existing.overlays] : [];
    overlays.push({
      ...overlay,
      added_at: new Date().toISOString(),
    });

    await this.pool.query(
      `UPDATE deal_zoning_profiles SET overlays = $1, updated_at = NOW() WHERE deal_id = $2`,
      [JSON.stringify(overlays), dealId]
    );

    return this.resolveProfile(dealId);
  }

  private async lookupDistrict(code: string, municipality: string | null): Promise<any | null> {
    let result;
    if (municipality) {
      result = await this.pool.query(
        `SELECT zd.*, m.name as municipality_name, m.state as municipality_state
         FROM zoning_districts zd
         LEFT JOIN municipalities m ON m.id = zd.municipality_id
         WHERE (UPPER(COALESCE(zd.zoning_code, zd.district_code)) = UPPER($1))
           AND (UPPER(COALESCE(zd.municipality, m.name)) = UPPER($2))
         LIMIT 1`,
        [code, municipality]
      );
    } else {
      result = await this.pool.query(
        `SELECT zd.*, m.name as municipality_name, m.state as municipality_state
         FROM zoning_districts zd
         LEFT JOIN municipalities m ON m.id = zd.municipality_id
         WHERE UPPER(COALESCE(zd.zoning_code, zd.district_code)) = UPPER($1)
         LIMIT 1`,
        [code]
      );
    }
    return result.rows[0] || null;
  }
}
