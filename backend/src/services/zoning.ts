import { query } from '../database/connection';

interface ZoningDistrict {
  id: string;
  municipality: string;
  state: string;
  district_code: string;
  district_name: string;
  description: string;
  permitted_uses: string[];
  conditional_uses: string[];
  min_lot_size_sqft: number | null;
  max_lot_coverage: number | null;
  max_building_height_ft: number | null;
  max_stories: number | null;
  min_front_setback_ft: number | null;
  min_side_setback_ft: number | null;
  min_rear_setback_ft: number | null;
  max_units_per_acre: number | null;
  min_lot_per_unit_sqft: number | null;
  max_far: number | null;
  parking_per_unit: number | null;
  parking_per_1000_sqft: number | null;
  full_code_text: string | null;
}

interface PropertyAnalysis {
  address: string;
  coordinates: { lat: number; lng: number };
  municipality: string;
  state: string;
  district_code: string;
  district_name: string;
  lot_size_sqft: number;
  max_units: number;
  max_height_ft: number;
  max_footprint_sqft: number;
  max_gfa_sqft: number;
  parking_required: number;
  setbacks: {
    front: number;
    side: number;
    rear: number;
  };
  opportunity_score: number;
  buildable_envelope_geojson: object | null;
  ai_summary: string;
}

function pointInPolygon(lat: number, lng: number, polygon: number[][][]): boolean {
  const ring = polygon[0];
  let inside = false;
  
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

export class ZoningService {
  async lookupZoningDistrict(lat: number, lng: number, municipality?: string): Promise<ZoningDistrict | null> {
    try {
      let sql = `
        SELECT zd.*, zdb.boundary_geojson
        FROM zoning_districts zd
        JOIN zoning_district_boundaries zdb ON zd.id = zdb.district_id
        WHERE $1 >= zdb.min_lat AND $1 <= zdb.max_lat
          AND $2 >= zdb.min_lng AND $2 <= zdb.max_lng
      `;
      const params: (number | string)[] = [lat, lng];
      
      if (municipality) {
        sql += ` AND LOWER(zd.municipality) = LOWER($3)`;
        params.push(municipality);
      }

      const result = await query(sql, params);
      
      for (const row of result.rows) {
        try {
          const geojson = JSON.parse(row.boundary_geojson);
          if (geojson.type === 'Polygon' && pointInPolygon(lat, lng, geojson.coordinates)) {
            delete row.boundary_geojson;
            return row as ZoningDistrict;
          }
        } catch (e) {
          console.error('Error parsing GeoJSON:', e);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Zoning lookup error:', error);
      return null;
    }
  }

  async getDistrictByCode(municipality: string, state: string, districtCode: string): Promise<ZoningDistrict | null> {
    try {
      const result = await query(
        `SELECT * FROM zoning_districts 
         WHERE LOWER(municipality) = LOWER($1) 
           AND LOWER(state) = LOWER($2) 
           AND LOWER(district_code) = LOWER($3)`,
        [municipality, state, districtCode]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error('Get district error:', error);
      return null;
    }
  }

  async analyzeProperty(
    address: string,
    lat: number,
    lng: number,
    municipality: string,
    state: string,
    lotSizeSqft: number
  ): Promise<PropertyAnalysis | null> {
    const district = await this.lookupZoningDistrict(lat, lng, municipality);
    
    if (!district) {
      return null;
    }

    const setbacks = {
      front: district.min_front_setback_ft || 25,
      side: district.min_side_setback_ft || 5,
      rear: district.min_rear_setback_ft || 10,
    };

    const lotSideLength = Math.sqrt(lotSizeSqft);
    const buildableWidth = Math.max(0, lotSideLength - (setbacks.side * 2));
    const buildableDepth = Math.max(0, lotSideLength - setbacks.front - setbacks.rear);
    const maxFootprintSqft = Math.round(buildableWidth * buildableDepth);

    let maxUnits = 1;
    if (district.max_units_per_acre && district.max_units_per_acre > 0) {
      maxUnits = Math.floor((lotSizeSqft / 43560) * district.max_units_per_acre);
    } else if (district.min_lot_per_unit_sqft && district.min_lot_per_unit_sqft > 0) {
      maxUnits = Math.floor(lotSizeSqft / district.min_lot_per_unit_sqft);
    }
    maxUnits = Math.max(1, maxUnits);

    const maxCoverage = district.max_lot_coverage || 0.45;
    const actualMaxFootprint = Math.min(maxFootprintSqft, Math.round(lotSizeSqft * maxCoverage));

    const maxStories = district.max_stories || 2;
    const maxGfaSqft = actualMaxFootprint * maxStories;

    let parkingRequired = 0;
    if (district.parking_per_unit) {
      parkingRequired = Math.ceil(maxUnits * district.parking_per_unit);
    } else if (district.parking_per_1000_sqft) {
      parkingRequired = Math.ceil((maxGfaSqft / 1000) * district.parking_per_1000_sqft);
    }

    const opportunityScore = this.calculateOpportunityScore(district, lotSizeSqft, maxUnits);

    const buildableEnvelope = this.calculateBuildableEnvelope(lat, lng, lotSizeSqft, setbacks);

    const aiSummary = this.generateSummary(district, lotSizeSqft, maxUnits, maxGfaSqft, parkingRequired);

    return {
      address,
      coordinates: { lat, lng },
      municipality,
      state,
      district_code: district.district_code,
      district_name: district.district_name || district.district_code,
      lot_size_sqft: lotSizeSqft,
      max_units: maxUnits,
      max_height_ft: district.max_building_height_ft || 35,
      max_footprint_sqft: actualMaxFootprint,
      max_gfa_sqft: maxGfaSqft,
      parking_required: parkingRequired,
      setbacks,
      opportunity_score: opportunityScore,
      buildable_envelope_geojson: buildableEnvelope,
      ai_summary: aiSummary,
    };
  }

  private calculateOpportunityScore(district: ZoningDistrict, lotSizeSqft: number, maxUnits: number): number {
    let score = 50;

    if (maxUnits >= 4) score += 20;
    else if (maxUnits >= 2) score += 10;

    if (district.max_far && district.max_far >= 1.0) score += 15;
    else if (district.max_far && district.max_far >= 0.5) score += 5;

    if (district.max_building_height_ft && district.max_building_height_ft >= 40) score += 10;

    if (lotSizeSqft >= 10000) score += 10;
    else if (lotSizeSqft >= 7000) score += 5;

    const permittedCount = district.permitted_uses?.length || 0;
    if (permittedCount >= 5) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  private calculateBuildableEnvelope(
    centerLat: number,
    centerLng: number,
    lotSizeSqft: number,
    setbacks: { front: number; side: number; rear: number }
  ): object {
    const lotSideLength = Math.sqrt(lotSizeSqft);
    const ftToDeg = 0.00000274;
    const halfSide = (lotSideLength / 2) * ftToDeg;

    const setbackDeg = {
      front: setbacks.front * ftToDeg,
      rear: setbacks.rear * ftToDeg,
      side: setbacks.side * ftToDeg,
    };

    const envelope = {
      type: 'Polygon',
      coordinates: [[
        [centerLng - halfSide + setbackDeg.side, centerLat + halfSide - setbackDeg.front],
        [centerLng + halfSide - setbackDeg.side, centerLat + halfSide - setbackDeg.front],
        [centerLng + halfSide - setbackDeg.side, centerLat - halfSide + setbackDeg.rear],
        [centerLng - halfSide + setbackDeg.side, centerLat - halfSide + setbackDeg.rear],
        [centerLng - halfSide + setbackDeg.side, centerLat + halfSide - setbackDeg.front],
      ]],
    };

    return envelope;
  }

  private generateSummary(
    district: ZoningDistrict,
    lotSizeSqft: number,
    maxUnits: number,
    maxGfaSqft: number,
    parkingRequired: number
  ): string {
    const districtType = district.district_name || district.district_code;
    
    let summary = `This ${lotSizeSqft.toLocaleString()} sq ft property is zoned ${districtType}. `;
    
    if (maxUnits > 1) {
      summary += `You can build up to ${maxUnits} dwelling units with a maximum of ${maxGfaSqft.toLocaleString()} sq ft gross floor area. `;
    } else {
      summary += `Single-family development is permitted with up to ${maxGfaSqft.toLocaleString()} sq ft of buildable area. `;
    }
    
    if (parkingRequired > 0) {
      summary += `${parkingRequired} parking spaces are required. `;
    }
    
    const uses = district.permitted_uses?.slice(0, 3).join(', ') || 'residential';
    summary += `Permitted uses include: ${uses}.`;
    
    return summary;
  }

  async saveAnalysis(analysis: PropertyAnalysis, userId?: string): Promise<string> {
    const result = await query(
      `INSERT INTO property_analyses (
        user_id, address, latitude, longitude, municipality, state,
        lot_size_sqft, district_code, district_name,
        max_units, max_building_height_ft, max_footprint_sqft, max_gfa_sqft,
        parking_required, setbacks, buildable_envelope_geojson,
        opportunity_score, ai_summary, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'completed')
      RETURNING id`,
      [
        userId || null,
        analysis.address,
        analysis.coordinates.lat,
        analysis.coordinates.lng,
        analysis.municipality,
        analysis.state,
        analysis.lot_size_sqft,
        analysis.district_code,
        analysis.district_name,
        analysis.max_units,
        analysis.max_height_ft,
        analysis.max_footprint_sqft,
        analysis.max_gfa_sqft,
        analysis.parking_required,
        JSON.stringify(analysis.setbacks),
        JSON.stringify(analysis.buildable_envelope_geojson),
        analysis.opportunity_score,
        analysis.ai_summary,
      ]
    );
    
    return result.rows[0].id;
  }
}

export const zoningService = new ZoningService();
