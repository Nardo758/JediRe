import { NextRequest, NextResponse } from 'next/server';
import { lookupZoningByAddress, lookupZoningByLocation } from '@/backend/src/services/municipal-api-connectors';
import { db } from '@/lib/db';

/**
 * Zoning Lookup API
 * 
 * GET /api/zoning/lookup?address=123 Main St&city=atlanta-ga
 * GET /api/zoning/lookup?lat=33.7490&lng=-84.3880&city=atlanta-ga
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const city = searchParams.get('city');
    const address = searchParams.get('address');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!city) {
      return NextResponse.json(
        { error: 'Missing required parameter: city' },
        { status: 400 }
      );
    }

    let result = null;

    // Lookup by address
    if (address) {
      result = await lookupZoningByAddress(city, address);
      
      if (result) {
        return NextResponse.json({
          success: true,
          source: 'api',
          zoning: result,
        });
      }
    }

    // Lookup by coordinates
    if (lat && lng) {
      result = await lookupZoningByLocation(
        city, 
        parseFloat(lat), 
        parseFloat(lng)
      );
      
      if (result) {
        return NextResponse.json({
          success: true,
          source: 'api',
          zoning: result,
        });
      }
    }

    // Fallback: Search database cache
    if (address) {
      const cached = await db.query(
        `SELECT zc.*, zd.district_name, zd.max_density_per_acre, zd.max_far, zd.max_height_feet
         FROM property_zoning_cache zc
         LEFT JOIN zoning_districts zd ON zd.id = zc.zoning_district_id
         WHERE zc.address ILIKE $1 AND zc.municipality_id = $2
         LIMIT 1`,
        [`%${address}%`, city]
      );

      if (cached.rows.length > 0) {
        return NextResponse.json({
          success: true,
          source: 'cache',
          zoning: cached.rows[0],
        });
      }
    }

    // No result found
    return NextResponse.json({
      success: false,
      message: 'Zoning information not found. Try fetching API data first.',
      suggestion: `Run: npm run fetch:zoning -- --city=${city}`,
    }, { status: 404 });

  } catch (error) {
    console.error('Zoning lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup zoning information' },
      { status: 500 }
    );
  }
}

/**
 * Save manual zoning lookup to cache
 * 
 * POST /api/zoning/lookup
 * Body: { deal_id, address, zoning_code, municipality_id, lat, lng }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deal_id, address, zoning_code, municipality_id, lat, lng, notes } = body;

    if (!deal_id || !address || !zoning_code || !municipality_id) {
      return NextResponse.json(
        { error: 'Missing required fields: deal_id, address, zoning_code, municipality_id' },
        { status: 400 }
      );
    }

    // Find or create zoning district
    let districtResult = await db.query(
      `SELECT id FROM zoning_districts 
       WHERE municipality_id = $1 AND zoning_code = $2`,
      [municipality_id, zoning_code]
    );

    let districtId;
    if (districtResult.rows.length > 0) {
      districtId = districtResult.rows[0].id;
    } else {
      // Create new district (manual entry)
      const newDistrict = await db.query(
        `INSERT INTO zoning_districts (
          municipality_id, zoning_code, district_name, source
        ) VALUES ($1, $2, $3, 'manual')
        RETURNING id`,
        [municipality_id, zoning_code, zoning_code]
      );
      districtId = newDistrict.rows[0].id;
    }

    // Save to cache
    const result = await db.query(
      `INSERT INTO property_zoning_cache (
        deal_id, address, zoning_district_id, zoning_code, 
        municipality_id, lat, lng, notes, 
        verified_at, verification_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'manual')
      ON CONFLICT (deal_id)
      DO UPDATE SET
        address = EXCLUDED.address,
        zoning_district_id = EXCLUDED.zoning_district_id,
        zoning_code = EXCLUDED.zoning_code,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        notes = EXCLUDED.notes,
        verified_at = NOW()
      RETURNING *`,
      [deal_id, address, districtId, zoning_code, municipality_id, lat, lng, notes]
    );

    return NextResponse.json({
      success: true,
      message: 'Zoning information saved',
      cache: result.rows[0],
    });

  } catch (error) {
    console.error('Save zoning error:', error);
    return NextResponse.json(
      { error: 'Failed to save zoning information' },
      { status: 500 }
    );
  }
}
