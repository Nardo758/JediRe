import { Router } from 'express';
import { getPool } from '../../database/connection';

const router = Router();
const pool = getPool();

router.post('/geocode', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ success: false, error: 'Address is required' });
    }
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`,
      { headers: { 'User-Agent': 'JediRE/1.0 (contact@jedire.com)' } }
    );
    const data = await response.json() as any[];
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, error: 'Address not found' });
    }
    const result = data[0];
    const addressParts = result.address || {};
    res.json({
      success: true,
      data: {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
        municipality: addressParts.city || addressParts.town || addressParts.village || addressParts.county,
        state: addressParts.state,
        country: addressParts.country
      }
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ success: false, error: 'Geocoding failed' });
  }
});

router.post('/zoning/lookup', async (req, res) => {
  try {
    const { lat, lng, municipality } = req.body;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, error: 'Coordinates are required' });
    }
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
    const result = await pool.query(sql, params);
    for (const row of result.rows) {
      try {
        const geojson = JSON.parse(row.boundary_geojson);
        if (geojson.type === 'Polygon') {
          const ring = geojson.coordinates[0];
          let inside = false;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0], yi = ring[i][1];
            const xj = ring[j][0], yj = ring[j][1];
            if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
              inside = !inside;
            }
          }
          if (inside) {
            delete row.boundary_geojson;
            return res.json({ success: true, data: row });
          }
        }
      } catch (e) {
        console.error('Error parsing GeoJSON:', e);
      }
    }
    res.status(404).json({ success: false, error: 'No zoning district found for these coordinates' });
  } catch (error) {
    console.error('Zoning lookup error:', error);
    res.status(500).json({ success: false, error: 'Zoning lookup failed' });
  }
});

router.get('/zoning/districts/:municipality', async (req, res) => {
  try {
    const { municipality } = req.params;
    const state = req.query.state as string || 'TX';
    const result = await pool.query(
      `SELECT id, district_code, district_name, description, permitted_uses, 
              max_building_height_ft, max_units_per_acre, max_far
       FROM zoning_districts 
       WHERE LOWER(municipality) = LOWER($1) AND LOWER(state) = LOWER($2)
       ORDER BY district_code`,
      [municipality, state]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching districts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch districts' });
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const { address, lat, lng, municipality, state, lot_size_sqft } = req.body;
    if (!address || !lat || !lng || !lot_size_sqft) {
      return res.status(400).json({ 
        success: false, 
        error: 'Address, coordinates, and lot size are required' 
      });
    }
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
    const result = await pool.query(sql, params);
    let district = null;
    for (const row of result.rows) {
      try {
        const geojson = JSON.parse(row.boundary_geojson);
        if (geojson.type === 'Polygon') {
          const ring = geojson.coordinates[0];
          let inside = false;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0], yi = ring[i][1];
            const xj = ring[j][0], yj = ring[j][1];
            if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
              inside = !inside;
            }
          }
          if (inside) {
            district = row;
            break;
          }
        }
      } catch (e) {}
    }
    if (!district) {
      return res.status(404).json({ success: false, error: 'No zoning district found' });
    }
    const setbacks = {
      front: district.min_front_setback_ft || 25,
      side: district.min_side_setback_ft || 5,
      rear: district.min_rear_setback_ft || 10
    };
    const lotSideLength = Math.sqrt(lot_size_sqft);
    const buildableWidth = Math.max(0, lotSideLength - (setbacks.side * 2));
    const buildableDepth = Math.max(0, lotSideLength - setbacks.front - setbacks.rear);
    let maxFootprintSqft = Math.round(buildableWidth * buildableDepth);
    let maxUnits = 1;
    if (district.max_units_per_acre && district.max_units_per_acre > 0) {
      maxUnits = Math.floor((lot_size_sqft / 43560) * district.max_units_per_acre);
    } else if (district.min_lot_per_unit_sqft && district.min_lot_per_unit_sqft > 0) {
      maxUnits = Math.floor(lot_size_sqft / district.min_lot_per_unit_sqft);
    }
    maxUnits = Math.max(1, maxUnits);
    const maxCoverage = district.max_lot_coverage || 0.45;
    maxFootprintSqft = Math.min(maxFootprintSqft, Math.round(lot_size_sqft * maxCoverage));
    const maxStories = district.max_stories || 2;
    const maxGfaSqft = maxFootprintSqft * maxStories;
    let parkingRequired = 0;
    if (district.parking_per_unit) {
      parkingRequired = Math.ceil(maxUnits * district.parking_per_unit);
    } else if (district.parking_per_1000_sqft) {
      parkingRequired = Math.ceil((maxGfaSqft / 1000) * district.parking_per_1000_sqft);
    }
    let score = 50;
    if (maxUnits >= 4) score += 20;
    else if (maxUnits >= 2) score += 10;
    if (district.max_far && district.max_far >= 1.0) score += 15;
    else if (district.max_far && district.max_far >= 0.5) score += 5;
    if (district.max_building_height_ft && district.max_building_height_ft >= 40) score += 10;
    if (lot_size_sqft >= 10000) score += 10;
    else if (lot_size_sqft >= 7000) score += 5;
    score = Math.min(100, Math.max(0, score));
    const ftToDeg = 0.00000274;
    const halfSide = (lotSideLength / 2) * ftToDeg;
    const setbackDeg = {
      front: setbacks.front * ftToDeg,
      rear: setbacks.rear * ftToDeg,
      side: setbacks.side * ftToDeg
    };
    const buildableEnvelope = {
      type: 'Polygon',
      coordinates: [[
        [lng - halfSide + setbackDeg.side, lat + halfSide - setbackDeg.front],
        [lng + halfSide - setbackDeg.side, lat + halfSide - setbackDeg.front],
        [lng + halfSide - setbackDeg.side, lat - halfSide + setbackDeg.rear],
        [lng - halfSide + setbackDeg.side, lat - halfSide + setbackDeg.rear],
        [lng - halfSide + setbackDeg.side, lat + halfSide - setbackDeg.front]
      ]]
    };
    const districtName = district.district_name || district.district_code;
    let summary = `This ${lot_size_sqft.toLocaleString()} sq ft property is zoned ${districtName}. `;
    if (maxUnits > 1) {
      summary += `You can build up to ${maxUnits} dwelling units with a maximum of ${maxGfaSqft.toLocaleString()} sq ft gross floor area. `;
    } else {
      summary += `Single-family development is permitted with up to ${maxGfaSqft.toLocaleString()} sq ft of buildable area. `;
    }
    if (parkingRequired > 0) {
      summary += `${parkingRequired} parking spaces are required.`;
    }
    const analysis = {
      address,
      coordinates: { lat, lng },
      municipality: municipality || district.municipality,
      state: state || district.state,
      district_code: district.district_code,
      district_name: districtName,
      lot_size_sqft,
      max_units: maxUnits,
      max_height_ft: district.max_building_height_ft || 35,
      max_footprint_sqft: maxFootprintSqft,
      max_gfa_sqft: maxGfaSqft,
      parking_required: parkingRequired,
      setbacks,
      opportunity_score: score,
      buildable_envelope_geojson: buildableEnvelope,
      ai_summary: summary,
      permitted_uses: district.permitted_uses || [],
      conditional_uses: district.conditional_uses || []
    };
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ success: false, error: 'Property analysis failed' });
  }
});

export default router;
