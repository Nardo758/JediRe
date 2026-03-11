import { getPool } from '../database/connection';
import { logger } from '../utils/logger';

interface DiscoveryOptions {
  radiusMiles?: number;
  maxComps?: number;
  useTradeArea?: boolean;
}

interface CompCandidate {
  address: string;
  city: string | null;
  units: number;
  year_built: number | null;
  stories: number | null;
  class_code: string | null;
  building_sqft: number | null;
  distance_miles: number | null;
}

function computeMatchScore(
  candidate: CompCandidate,
  dealContext: { units: number | null; year_built: number | null; stories: number | null; class_code: string | null },
  maxDistance: number
): { score: number; factors: Record<string, number> } {
  const factors: Record<string, number> = {};

  if (candidate.distance_miles != null && maxDistance > 0) {
    factors.proximity = Math.max(0, 100 * (1 - candidate.distance_miles / maxDistance));
  } else {
    factors.proximity = 50;
  }

  if (candidate.year_built && dealContext.year_built) {
    const diff = Math.abs(candidate.year_built - dealContext.year_built);
    factors.vintage = diff <= 5 ? 100 : diff <= 10 ? 80 : diff <= 20 ? 50 : 20;
  } else {
    factors.vintage = 40;
  }

  if (candidate.units && dealContext.units) {
    const ratio = candidate.units / dealContext.units;
    factors.size = ratio >= 0.7 && ratio <= 1.3 ? 100 : ratio >= 0.5 && ratio <= 1.5 ? 70 : 40;
  } else {
    factors.size = 40;
  }

  if (candidate.class_code && dealContext.class_code) {
    factors.class_match = candidate.class_code === dealContext.class_code ? 100 : 40;
  } else {
    factors.class_match = 40;
  }

  if (candidate.stories != null && dealContext.stories != null) {
    const diff = Math.abs(candidate.stories - dealContext.stories);
    factors.stories = diff === 0 ? 100 : diff === 1 ? 80 : diff <= 3 ? 50 : 20;
  } else {
    factors.stories = 40;
  }

  const weights = { proximity: 0.35, vintage: 0.20, size: 0.20, class_match: 0.15, stories: 0.10 };
  const score =
    factors.proximity * weights.proximity +
    factors.vintage * weights.vintage +
    factors.size * weights.size +
    factors.class_match * weights.class_match +
    factors.stories * weights.stories;

  return { score: Math.round(score * 100) / 100, factors };
}

export interface TieredComp {
  id?: string;
  address: string;
  name: string;
  units: number;
  year_built: number | null;
  stories: number | null;
  class_code: string | null;
  distance_miles: number | null;
  match_score: number;
  avg_rent: number | null;
  occupancy: number | null;
  lat: number | null;
  lng: number | null;
  in_comp_set: boolean;
  comp_set_id: string | null;
  geographic_tier: 'trade_area' | 'submarket' | 'msa';
}

export interface TieredDiscoveryResult {
  trade_area: TieredComp[];
  submarket: TieredComp[];
  msa: TieredComp[];
  deal: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    units: number | null;
  };
}

export async function discoverTieredComps(dealId: string, radiusMiles: number = 3): Promise<TieredDiscoveryResult> {
  const pool = getPool();

  const dealResult = await pool.query(`
    SELECT 
      d.id, d.name, d.address, d.trade_area_id, d.target_units,
      ST_Y(ST_Centroid(d.boundary)) as lat,
      ST_X(ST_Centroid(d.boundary)) as lng,
      d.deal_data
    FROM deals d
    WHERE d.id = $1
  `, [dealId]);

  if (dealResult.rows.length === 0) {
    throw new Error('Deal not found');
  }

  const deal = dealResult.rows[0];
  if (!deal.lat || !deal.lng) {
    throw new Error('Deal has no boundary for comp discovery');
  }

  const dealUnits = deal.target_units || null;
  const dealData = deal.deal_data || {};
  const dealContext = {
    units: dealUnits,
    year_built: dealData.year_built || null,
    stories: dealData.stories || null,
    class_code: dealData.class_code || null,
  };

  const existingComps = await pool.query(`
    SELECT id, comp_property_address, status FROM deal_comp_sets
    WHERE deal_id = $1
  `, [dealId]);
  const activeCompAddresses = new Map<string, string>();
  for (const row of existingComps.rows) {
    if (row.status === 'active') {
      activeCompAddresses.set(row.comp_property_address.toLowerCase(), row.id);
    }
  }

  const dealAddress = deal.address || '';
  const dealCity = dealAddress.match(/,\s*([^,]+),\s*\w/)?.[1]?.trim() || '';

  function mapToTieredComp(c: any, tier: 'trade_area' | 'submarket' | 'msa', maxDist: number): TieredComp {
    const { score } = computeMatchScore(c, dealContext, maxDist);
    const addrLower = (c.address || '').toLowerCase();
    return {
      address: c.address,
      name: c.city ? `${c.address}, ${c.city}` : c.address,
      units: c.units,
      year_built: c.year_built,
      stories: c.stories,
      class_code: c.class_code,
      distance_miles: c.distance_miles ? Math.round(c.distance_miles * 100) / 100 : null,
      match_score: score,
      avg_rent: null,
      occupancy: null,
      lat: c.lat || null,
      lng: c.lng || null,
      in_comp_set: activeCompAddresses.has(addrLower),
      comp_set_id: activeCompAddresses.get(addrLower) || null,
      geographic_tier: tier,
    };
  }

  const tradeAreaAddresses = new Set<string>();
  let tradeArea: TieredComp[] = [];

  const geoTradeArea = await pool.query(`
    SELECT pr.address, pr.city, pr.units, pr.year_built::int as year_built,
           pr.stories, pr.class_code, pr.building_sqft,
           COALESCE(p.lat, pr.lat::float) as lat,
           COALESCE(p.lng, pr.lng::float) as lng,
           CASE WHEN COALESCE(p.lat, pr.lat) IS NOT NULL THEN
             ST_Distance(
               ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
               ST_SetSRID(ST_MakePoint(
                 COALESCE(p.lng, pr.lng::float), COALESCE(p.lat, pr.lat::float)
               ), 4326)::geography
             ) / 1609.34
           ELSE NULL END as distance_miles
    FROM property_records pr
    LEFT JOIN properties p ON LOWER(p.address_line1) = LOWER(pr.address) AND p.lat IS NOT NULL
    WHERE pr.units >= 20
      AND pr.address != $3
      AND COALESCE(p.lat, pr.lat) IS NOT NULL
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        ST_SetSRID(ST_MakePoint(COALESCE(p.lng, pr.lng::float), COALESCE(p.lat, pr.lat::float)), 4326)::geography,
        $4 * 1609.34
      )
    ORDER BY distance_miles ASC NULLS LAST
    LIMIT 50
  `, [deal.lng, deal.lat, dealAddress, radiusMiles]);

  if (geoTradeArea.rows.length > 0) {
    tradeArea = geoTradeArea.rows.map((c: any) => {
      tradeAreaAddresses.add(c.address.toLowerCase());
      return mapToTieredComp(c, 'trade_area', radiusMiles);
    });
  }

  if (tradeArea.length < 5) {
    const stateAbbrevMap: Record<string, string> = {
      'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO',
      'Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID',
      'Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA',
      'Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS',
      'Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ',
      'New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK',
      'Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',
      'Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA',
      'West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
    };
    const stateAbbrMatch = dealAddress.match(/,\s*(\w{2})\s+\d{5}/)?.[1]?.toUpperCase();
    const stateFullMatch = dealAddress.match(/,\s*([A-Za-z\s]+?)\s+\d{5}/)?.[1]?.trim();
    const dealState = stateAbbrMatch && stateAbbrMatch.length === 2 ? stateAbbrMatch
      : stateFullMatch ? (stateAbbrevMap[stateFullMatch] || stateFullMatch.substring(0, 2).toUpperCase())
      : null;

    const dealCountyResult = await pool.query(`
      SELECT pr.county FROM property_records pr
      WHERE (pr.city ILIKE $1 OR pr.state = $2) AND pr.county IS NOT NULL AND pr.units >= 20
      ORDER BY CASE WHEN pr.city ILIKE $1 THEN 0 ELSE 1 END
      LIMIT 1
    `, [dealCity || '__NONE__', dealState || '__NONE__']);
    const dealCounty = dealCountyResult.rows[0]?.county || null;

    const countyResult = dealCounty ? await pool.query(`
      SELECT pr.address, pr.city, pr.units, pr.year_built::int as year_built,
             pr.stories, pr.class_code, pr.building_sqft,
             pr.lat::float as lat, pr.lng::float as lng,
             NULL::float as distance_miles
      FROM property_records pr
      WHERE pr.units >= 20
        AND pr.address != $1
        AND pr.county = $3
      ORDER BY ABS(pr.units - COALESCE($2, 200)) ASC
      LIMIT 25
    `, [dealAddress, dealUnits, dealCounty]) : { rows: [] };

    for (const c of countyResult.rows) {
      if (!tradeAreaAddresses.has(c.address.toLowerCase())) {
        tradeAreaAddresses.add(c.address.toLowerCase());
        tradeArea.push(mapToTieredComp(c, 'trade_area', radiusMiles));
      }
    }
  }

  let submarketComps: TieredComp[] = [];
  const submarketResult = await pool.query(`
    SELECT s.id as submarket_id, s.name as submarket_name
    FROM submarkets s
    WHERE ST_Contains(s.geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
    LIMIT 1
  `, [deal.lng, deal.lat]);

  if (submarketResult.rows.length > 0) {
    const subId = submarketResult.rows[0].submarket_id;
    const subComps = await pool.query(`
      SELECT COALESCE(pr.address, p.address_line1) as address,
             pr.city,
             COALESCE(pr.units, p.units, 0) as units,
             pr.year_built::int as year_built,
             pr.stories, pr.class_code, pr.building_sqft,
             p.lat, p.lng,
             ST_Distance(
               ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
               ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography
             ) / 1609.34 as distance_miles
      FROM properties p
      LEFT JOIN property_records pr ON LOWER(p.address_line1) = LOWER(pr.address)
      WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
        AND COALESCE(pr.units, p.units, 0) >= 20
        AND COALESCE(pr.address, p.address_line1, '') != $3
        AND ST_Contains(
          (SELECT geometry FROM submarkets WHERE id = $4),
          ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)
        )
      ORDER BY distance_miles ASC NULLS LAST
      LIMIT 30
    `, [deal.lng, deal.lat, dealAddress, subId]);

    submarketComps = subComps.rows
      .filter((c: any) => !tradeAreaAddresses.has((c.address || '').toLowerCase()))
      .map((c: any) => mapToTieredComp(c, 'submarket', radiusMiles * 3));
  }

  let msaComps: TieredComp[] = [];
  const msaResult = await pool.query(`
    SELECT m.id as msa_id, m.name as msa_name
    FROM msas m
    WHERE ST_Contains(m.geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
    LIMIT 1
  `, [deal.lng, deal.lat]);

  if (msaResult.rows.length > 0) {
    const msaId = msaResult.rows[0].msa_id;
    const allExcluded = new Set([...tradeAreaAddresses, ...submarketComps.map(c => c.address.toLowerCase())]);

    const remainingComps = await pool.query(`
      SELECT pr.address, pr.city, pr.units, pr.year_built::int as year_built,
             pr.stories, pr.class_code, pr.building_sqft,
             COALESCE(p.lat, pr.lat::float) as lat,
             COALESCE(p.lng, pr.lng::float) as lng,
             CASE WHEN COALESCE(p.lat, pr.lat) IS NOT NULL THEN
               ST_Distance(
                 ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                 ST_SetSRID(ST_MakePoint(
                   COALESCE(p.lng, pr.lng::float), COALESCE(p.lat, pr.lat::float)
                 ), 4326)::geography
               ) / 1609.34
             ELSE NULL END as distance_miles
      FROM property_records pr
      LEFT JOIN properties p ON LOWER(p.address_line1) = LOWER(pr.address) AND p.lat IS NOT NULL
      WHERE pr.units >= 20
        AND pr.address != $3
        AND (
          (COALESCE(p.lat, pr.lat) IS NOT NULL AND ST_Contains(
            (SELECT geometry FROM msas WHERE id = $4),
            ST_SetSRID(ST_MakePoint(COALESCE(p.lng, pr.lng::float), COALESCE(p.lat, pr.lat::float)), 4326)
          ))
          OR (COALESCE(p.lat, pr.lat) IS NULL AND pr.state = (
            SELECT SUBSTRING(m.name FROM ',\\s*(\\w+)$') FROM msas m WHERE m.id = $4
          ))
        )
      ORDER BY ABS(pr.units - COALESCE($5, 200)) ASC
      LIMIT 100
    `, [deal.lng, deal.lat, dealAddress, msaId, dealUnits]);

    msaComps = remainingComps.rows
      .filter((c: any) => !allExcluded.has(c.address.toLowerCase()))
      .slice(0, 30)
      .map((c: any) => mapToTieredComp(c, 'msa', radiusMiles * 10));
  }

  tradeArea.sort((a, b) => b.match_score - a.match_score);
  submarketComps.sort((a, b) => b.match_score - a.match_score);
  msaComps.sort((a, b) => b.match_score - a.match_score);

  return {
    trade_area: tradeArea,
    submarket: submarketComps,
    msa: msaComps,
    deal: {
      name: deal.name,
      address: deal.address,
      lat: deal.lat,
      lng: deal.lng,
      units: dealUnits,
    },
  };
}

export async function autoDiscoverComps(dealId: string, options: DiscoveryOptions = {}): Promise<number> {
  const { radiusMiles = 3, maxComps = 15, useTradeArea = true } = options;
  const pool = getPool();

  try {
    const dealResult = await pool.query(`
      SELECT 
        d.id, d.name, d.address, d.trade_area_id, d.target_units,
        ST_Y(ST_Centroid(d.boundary)) as lat,
        ST_X(ST_Centroid(d.boundary)) as lng,
        d.deal_data
      FROM deals d
      WHERE d.id = $1
    `, [dealId]);

    if (dealResult.rows.length === 0) {
      logger.warn('Deal not found for comp discovery', { dealId });
      return 0;
    }

    const deal = dealResult.rows[0];
    if (!deal.lat || !deal.lng) {
      logger.warn('Deal has no boundary for comp discovery', { dealId });
      return 0;
    }

    const dealUnits = deal.target_units || null;
    const dealData = deal.deal_data || {};
    const dealYearBuilt = dealData.year_built || null;
    const dealStories = dealData.stories || null;
    const dealClassCode = dealData.class_code || null;

    let candidates: CompCandidate[] = [];

    if (useTradeArea && deal.trade_area_id) {
      const taResult = await pool.query(`
        SELECT pr.address, pr.city, pr.units, pr.year_built::int as year_built, 
               pr.stories, pr.class_code, pr.building_sqft,
               ST_Distance(
                 ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
                 ST_SetSRID(ST_MakePoint(
                   COALESCE(p.lng, ST_X(ST_Centroid(ta.boundary))),
                   COALESCE(p.lat, ST_Y(ST_Centroid(ta.boundary)))
                 ), 4326)::geography
               ) / 1609.34 as distance_miles
        FROM property_records pr
        LEFT JOIN properties p ON LOWER(p.address_line1) = LOWER(pr.address) AND p.lat IS NOT NULL
        CROSS JOIN trade_areas ta
        WHERE ta.id = $1
          AND pr.units >= 20
          AND pr.address != $4
        ORDER BY distance_miles ASC NULLS LAST
        LIMIT 100
      `, [deal.trade_area_id, deal.lng, deal.lat, deal.address || '']);

      candidates = taResult.rows;
    }

    if (candidates.length < 5) {
      const radiusResult = await pool.query(`
        SELECT pr.address, pr.city, pr.units, pr.year_built::int as year_built,
               pr.stories, pr.class_code, pr.building_sqft,
               ST_Distance(
                 ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                 ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography
               ) / 1609.34 as distance_miles
        FROM property_records pr
        INNER JOIN properties p ON LOWER(p.address_line1) = LOWER(pr.address) AND p.lat IS NOT NULL
        WHERE pr.units >= 20
          AND pr.address != $3
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
            $4 * 1609.34
          )
        ORDER BY distance_miles ASC
        LIMIT 50
      `, [deal.lng, deal.lat, deal.address || '', radiusMiles]);

      const existingAddresses = new Set(candidates.map(c => c.address.toLowerCase()));
      for (const row of radiusResult.rows) {
        if (!existingAddresses.has(row.address.toLowerCase())) {
          candidates.push(row);
        }
      }
    }

    if (candidates.length === 0) {
      const fallbackResult = await pool.query(`
        SELECT pr.address, pr.city, pr.units, pr.year_built::int as year_built,
               pr.stories, pr.class_code, pr.building_sqft,
               NULL as distance_miles
        FROM property_records pr
        WHERE pr.units >= 20
          AND pr.address != $1
        ORDER BY pr.units DESC
        LIMIT 50
      `, [deal.address || '']);
      candidates = fallbackResult.rows;
    }

    const dealContext = {
      units: dealUnits,
      year_built: dealYearBuilt,
      stories: dealStories,
      class_code: dealClassCode,
    };

    const scored = candidates.map(c => {
      const { score, factors } = computeMatchScore(c, dealContext, radiusMiles);
      return { ...c, match_score: score, match_factors: factors };
    });

    scored.sort((a, b) => b.match_score - a.match_score);
    const topComps = scored.slice(0, maxComps);

    let inserted = 0;
    for (const comp of topComps) {
      try {
        await pool.query(`
          INSERT INTO deal_comp_sets (
            deal_id, comp_property_address, comp_name, source, status,
            distance_miles, match_score, match_factors,
            year_built, stories, units, class_code,
            lat, lng
          ) VALUES ($1, $2, $3, 'auto', 'active', $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (deal_id, comp_property_address) DO UPDATE SET
            match_score = EXCLUDED.match_score,
            match_factors = EXCLUDED.match_factors,
            distance_miles = EXCLUDED.distance_miles,
            updated_at = NOW()
        `, [
          dealId,
          comp.address,
          comp.city ? `${comp.address}, ${comp.city}` : comp.address,
          comp.distance_miles,
          comp.match_score,
          JSON.stringify(comp.match_factors),
          comp.year_built,
          comp.stories,
          comp.units,
          comp.class_code,
          null,
          null,
        ]);
        inserted++;
      } catch (err: any) {
        logger.warn('Failed to insert comp', { address: comp.address, error: err.message });
      }
    }

    logger.info('Comp discovery complete', { dealId, candidates: candidates.length, inserted });
    return inserted;
  } catch (error: any) {
    logger.error('Comp discovery failed', { dealId, error: error.message });
    throw error;
  }
}
