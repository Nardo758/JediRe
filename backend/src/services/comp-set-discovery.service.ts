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
  // Optional apt_locator enrichment fields — present when _from_apt_locator is true
  _from_apt_locator?: boolean;
  alp_id?: string;
  property_name?: string;
  state?: string;
  zip?: string;
  avg_asking_rent?: string | null;
  avg_effective_rent?: string | null;
  occupancy_pct?: string | null;
  alp_lat?: number | null;
  alp_lng?: number | null;
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
    SELECT id, comp_property_address, status FROM deal_rent_comp_sets
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

  // Prefer trade_area_id boundary membership; fall back to radius when boundary unavailable
  if (deal.trade_area_id) {
    const taGeoResult = await pool.query(`
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
      JOIN trade_areas ta ON ta.id = $3
      WHERE pr.units >= 20
        AND pr.address != $4
        AND COALESCE(p.lat, pr.lat) IS NOT NULL
        AND ST_Within(
          ST_SetSRID(ST_MakePoint(COALESCE(p.lng, pr.lng::float), COALESCE(p.lat, pr.lat::float)), 4326),
          ta.boundary
        )
      ORDER BY distance_miles ASC NULLS LAST
      LIMIT 50
    `, [deal.lng, deal.lat, deal.trade_area_id, dealAddress]);

    if (taGeoResult.rows.length > 0) {
      tradeArea = taGeoResult.rows.map((c: any) => {
        tradeAreaAddresses.add(c.address.toLowerCase());
        return mapToTieredComp(c, 'trade_area', radiusMiles);
      });
    }
  }

  // Radius fallback when trade_area_id missing or boundary returned < 5 comps
  if (tradeArea.length < 5) {
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

    for (const c of geoTradeArea.rows) {
      if (!tradeAreaAddresses.has(c.address.toLowerCase())) {
        tradeAreaAddresses.add(c.address.toLowerCase());
        tradeArea.push(mapToTieredComp(c, 'trade_area', radiusMiles));
      }
    }
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

  // ── Enrich: pull real avg_rent + occupancy from comp_properties/comp_unit_types ──
  const allTierComps = [...tradeArea, ...submarketComps, ...msaComps];
  if (allTierComps.length > 0) {
    const addrKeys = allTierComps.map(c => c.address.toLowerCase());

    // Weighted avg_rent and occupancy (100 - vacancy_pct) per address via comp_unit_types
    const [enrichRows, storedRows] = await Promise.all([
      pool.query<{ addr_key: string; avg_rent: string; occupancy: string }>(`
        SELECT
          LOWER(cp.address) AS addr_key,
          SUM(cut.avg_rent * cut.mix_pct) / NULLIF(SUM(cut.mix_pct), 0) AS avg_rent,
          100 - AVG(cut.vacancy_pct) AS occupancy
        FROM comp_properties cp
        JOIN comp_unit_types cut ON cut.comp_id = cp.id
        WHERE LOWER(cp.address) = ANY($1)
          AND cut.avg_rent IS NOT NULL
        GROUP BY LOWER(cp.address)
      `, [addrKeys]),
      pool.query<{ addr_key: string; avg_rent: string; occupancy: string }>(`
        SELECT
          LOWER(comp_property_address) AS addr_key,
          avg_rent,
          occupancy
        FROM deal_rent_comp_sets
        WHERE deal_id = $1
          AND (avg_rent IS NOT NULL OR occupancy IS NOT NULL)
      `, [dealId]),
    ]);

    const enrichMap = new Map<string, { avg_rent: number | null; occupancy: number | null }>();
    for (const r of enrichRows.rows) {
      enrichMap.set(r.addr_key, {
        avg_rent: r.avg_rent != null ? Math.round(Number(r.avg_rent)) : null,
        occupancy: r.occupancy != null ? Math.round(Number(r.occupancy) * 10) / 10 : null,
      });
    }
    for (const r of storedRows.rows) {
      if (!enrichMap.has(r.addr_key)) {
        enrichMap.set(r.addr_key, {
          avg_rent: r.avg_rent != null ? Number(r.avg_rent) : null,
          occupancy: r.occupancy != null ? Number(r.occupancy) : null,
        });
      }
    }

    for (const comp of allTierComps) {
      const key = comp.address.toLowerCase();
      const enrich = enrichMap.get(key);
      if (enrich) {
        comp.avg_rent = enrich.avg_rent;
        comp.occupancy = enrich.occupancy;
      }
    }
  }

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
        JOIN trade_areas ta ON ta.id = $1
        WHERE pr.units >= 20
          AND pr.address != $4
          AND COALESCE(p.lat, pr.lat) IS NOT NULL
          AND COALESCE(p.lng, pr.lng) IS NOT NULL
          AND ST_Within(
            ST_SetSRID(ST_MakePoint(
              COALESCE(p.lng, pr.lng::float),
              COALESCE(p.lat, pr.lat::float)
            ), 4326),
            ta.boundary
          )
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

    // Gap 3: Always supplement from apartment_locator_properties regardless of property_records count.
    // apt_locator rows are tagged with _from_apt_locator so we can later write them to competitive_sets.
    // Uses radius proximity when lat/lng available, falls back to city/state text match.
    let aptLocatorRows: any[] = [];
    if (deal.lat && deal.lng) {
      const dealCity = (deal.address || '').match(/,\s*([^,]+),\s*\w/)?.[1]?.trim() || '';
      const dealState = (deal.address || '').match(/,\s*(\w{2})\s+\d{5}/)?.[1]?.toUpperCase() || 'GA';

      const alpResult = await pool.query(`
        SELECT
          alp.id::text           AS alp_id,
          alp.property_name,
          alp.address,
          alp.city,
          alp.state,
          alp.zip,
          alp.total_units        AS units,
          alp.year_built,
          alp.avg_asking_rent,
          alp.avg_effective_rent,
          alp.occupancy_pct,
          alp.latitude::float    AS alp_lat,
          alp.longitude::float   AS alp_lng,
          NULL::int              AS stories,
          NULL::text             AS class_code,
          NULL::int              AS building_sqft,
          CASE
            WHEN alp.latitude IS NOT NULL AND alp.longitude IS NOT NULL THEN
              ROUND((
                point(alp.longitude::float, alp.latitude::float)
                <@> point($2::float, $1::float)
              )::numeric, 3)
            ELSE NULL
          END                    AS distance_miles
        FROM apartment_locator_properties alp
        WHERE alp.total_units >= 10
          AND alp.address != $3
          AND (
            (alp.latitude IS NOT NULL AND alp.longitude IS NOT NULL
             AND (point(alp.longitude::float, alp.latitude::float) <@> point($2::float, $1::float)) <= $4)
            OR
            (alp.latitude IS NULL AND alp.city ILIKE $5 AND alp.state = $6)
          )
        ORDER BY distance_miles ASC NULLS LAST
        LIMIT 50
      `, [deal.lat, deal.lng, deal.address || '', radiusMiles, dealCity || '%', dealState]);

      const existingAddresses = new Set(candidates.map((c: any) => c.address.toLowerCase()));
      for (const row of alpResult.rows) {
        const rowWithTag = { ...row, _from_apt_locator: true };
        aptLocatorRows.push(rowWithTag);
        if (!existingAddresses.has(row.address.toLowerCase())) {
          existingAddresses.add(row.address.toLowerCase());
          candidates.push(rowWithTag);
        }
      }
      if (alpResult.rows.length > 0) {
        logger.info('autoDiscoverComps: supplemented from apartment_locator_properties', {
          dealId, added: alpResult.rows.length, total: candidates.length,
        });
      }
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

    // True reset: deactivate all existing active comps before inserting new defaults
    await pool.query(
      `UPDATE deal_rent_comp_sets SET status = 'removed', updated_at = NOW() WHERE deal_id = $1 AND status = 'active'`,
      [dealId]
    );
    logger.info('Reset active comp set for deal', { dealId });

    let inserted = 0;
    let insertedCS = 0;
    for (const comp of topComps) {
      const isAptLocator = comp._from_apt_locator === true;
      const compLat = isAptLocator ? comp.alp_lat ?? null : null;
      const compLng = isAptLocator ? comp.alp_lng ?? null : null;
      const compAvgRent = isAptLocator && comp.avg_asking_rent ? parseFloat(comp.avg_asking_rent) : null;
      const compOccupancy = isAptLocator && comp.occupancy_pct ? parseFloat(comp.occupancy_pct) / 100 : null;

      // 1. Write to deal_rent_comp_sets (UI workspace)
      try {
        await pool.query(`
          INSERT INTO deal_rent_comp_sets (
            deal_id, comp_property_address, comp_name, source, status,
            distance_miles, match_score, match_factors,
            year_built, stories, units, asset_class,
            avg_rent, occupancy,
            lat, lng
          ) VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (deal_id, comp_property_address) DO UPDATE SET
            status = 'active',
            match_score = EXCLUDED.match_score,
            match_factors = EXCLUDED.match_factors,
            distance_miles = EXCLUDED.distance_miles,
            avg_rent = COALESCE(EXCLUDED.avg_rent, deal_rent_comp_sets.avg_rent),
            occupancy = COALESCE(EXCLUDED.occupancy, deal_rent_comp_sets.occupancy),
            updated_at = NOW()
        `, [
          dealId,
          comp.address,
          comp.property_name || (comp.city ? `${comp.address}, ${comp.city}` : comp.address),
          isAptLocator ? 'apartment_locator' : 'auto',
          comp.distance_miles,
          comp.match_score,
          JSON.stringify(comp.match_factors),
          comp.year_built,
          comp.stories,
          comp.units,
          comp.class_code,
          compAvgRent,
          compOccupancy,
          compLat,
          compLng,
        ]);
        inserted++;
      } catch (err: any) {
        logger.warn('Failed to insert comp into deal_rent_comp_sets', { address: comp.address, error: err.message });
      }

      // 2. Gap 3: Write apt_locator comps to competitive_sets (M27 rental comp agent)
      if (isAptLocator && comp.alp_id) {
        try {
          const assetClass = comp.year_built >= 2010 ? 'A' : comp.year_built >= 1995 ? 'B' : 'C';
          await pool.query(`
            INSERT INTO competitive_sets (
              deal_id, created_at_stage,
              comp_property_id, comp_name, comp_address, comp_city, comp_state, comp_zip,
              comp_units, comp_year_built, asset_class,
              comp_distance_miles, relevance_score, relevance_factors,
              source, source_id, is_active
            ) VALUES (
              $1, 'discovery',
              $2, $3, $4, $5, $6, $7,
              $8, $9, $10,
              $11, $12, $13,
              'apartment_locator', $14, true
            )
            ON CONFLICT (deal_id, source, source_id) WHERE source_id IS NOT NULL
            DO UPDATE SET
              relevance_score     = EXCLUDED.relevance_score,
              relevance_factors   = EXCLUDED.relevance_factors,
              comp_distance_miles = EXCLUDED.comp_distance_miles,
              is_active           = true
          `, [
            dealId,
            comp.alp_id,
            comp.property_name || comp.address,
            comp.address, comp.city, comp.state || null, comp.zip || null,
            comp.units, comp.year_built, assetClass,
            comp.distance_miles, comp.match_score, JSON.stringify(comp.match_factors),
            comp.alp_id,
          ]);
          insertedCS++;
        } catch (err: any) {
          logger.warn('Failed to insert apt_locator comp into competitive_sets', { address: comp.address, error: err.message });
        }
      }
    }

    // 3. Gap 4: Compute median asking rent from apt_locator comps in top set;
    //    upsert into deal_assumptions.avg_rent_per_unit (only when not already set by user).
    const rents = topComps
      .filter((c: any) => c._from_apt_locator && c.avg_asking_rent)
      .map((c: any) => parseFloat(c.avg_asking_rent))
      .filter((r: number) => r > 0)
      .sort((a: number, b: number) => a - b);

    if (rents.length > 0) {
      const mid = Math.floor(rents.length / 2);
      const medianRent = rents.length % 2 === 0
        ? (rents[mid - 1] + rents[mid]) / 2
        : rents[mid];
      const compCountRef = `apt_locator:${rents.length} comps`;
      try {
        await pool.query(`
          INSERT INTO deal_assumptions (deal_id, avg_rent_per_unit, source_type, source_ref)
          VALUES ($1, $2, 'apt_locator', $3)
          ON CONFLICT (deal_id) DO UPDATE SET
            avg_rent_per_unit = CASE
              WHEN deal_assumptions.avg_rent_per_unit IS NULL THEN EXCLUDED.avg_rent_per_unit
              ELSE deal_assumptions.avg_rent_per_unit
            END,
            source_type = CASE
              WHEN deal_assumptions.avg_rent_per_unit IS NULL THEN 'apt_locator'
              ELSE deal_assumptions.source_type
            END,
            source_ref = EXCLUDED.source_ref,
            updated_at = NOW()
        `, [dealId, Math.round(medianRent), compCountRef]);
        logger.info('autoDiscoverComps: calibrated market rent', { dealId, medianRent, compCount: rents.length });
      } catch (err: any) {
        logger.warn('autoDiscoverComps: rent upsert failed (non-fatal)', { dealId, error: err.message });
      }
    }

    logger.info('Comp discovery complete', { dealId, candidates: candidates.length, inserted, insertedCS });
    return inserted;
  } catch (error: any) {
    logger.error('Comp discovery failed', { dealId, error: error.message });
    throw error;
  }
}

// ============================================================================
// Gap 3: Apt Locator Matches → Competitive Set (M27 rental comp pool)
// Promotes apartment_locator_properties within radius into:
//   competitive_sets (M27 cash flow agent)
//   deal_rent_comp_sets   (deal workspace UI)
//   deal_assumptions.avg_rent_per_unit (calibrates rent projection)
// ============================================================================

export interface AptLocatorDiscoveryResultComp {
  alp_id: string | null;
  name: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  avg_asking_rent: number | null;
  avg_effective_rent: number | null;
  occupancy_pct: number | null;
  concessions: string | null;
  concession_pct: number | null;
  unit_mix: any | null;
  management_company: string | null;
  source: string | null;
  data_as_of: string | null;
  distance_miles: number | null;
  match_score: number | null;
  year_built: number | null;
  total_units: number | null;
  lat: number | null;
  lng: number | null;
}

export interface AptLocatorDiscoveryResult {
  inserted_competitive_sets: number;
  inserted_deal_rent_comp_sets: number;
  median_rent: number | null;
  rent_updated: boolean;
  comp_count: number;
  comps: AptLocatorDiscoveryResultComp[];
}

export async function discoverFromAptLocator(
  dealId: string,
  options: { radiusMiles?: number; maxComps?: number } = {}
): Promise<AptLocatorDiscoveryResult> {
  const { radiusMiles = 3, maxComps = 20 } = options;
  const pool = getPool();

  const dealResult = await pool.query(`
    SELECT
      d.id,
      d.name,
      d.address,
      d.city,
      d.state_code,
      d.target_units,
      d.deal_data,
      ST_Y(ST_Centroid(d.boundary)) AS lat,
      ST_X(ST_Centroid(d.boundary)) AS lng
    FROM deals d
    WHERE d.id = $1
  `, [dealId]);

  if (dealResult.rows.length === 0) {
    throw new Error(`Deal not found: ${dealId}`);
  }

  const deal = dealResult.rows[0];
  if (!deal.lat || !deal.lng) {
    throw new Error(`Deal ${dealId} has no boundary/coordinates for rental comp discovery`);
  }

  const dealData = deal.deal_data || {};
  const dealUnits = deal.target_units || null;
  const dealYearBuilt: number | null = dealData.year_built || null;
  const dealStories: number | null = dealData.stories || null;
  const dealClassCode: string | null = dealData.class_code || null;

  // 1. Fetch Apt Locator properties within radius using earth distance operator
  const compRows = await pool.query(`
    SELECT
      alp.id,
      alp.property_name,
      alp.address,
      alp.city,
      alp.state,
      alp.zip,
      alp.latitude,
      alp.longitude,
      alp.total_units,
      alp.year_built,
      alp.avg_asking_rent,
      alp.avg_effective_rent,
      alp.occupancy_pct,
      alp.concessions,
      alp.concession_pct,
      alp.unit_mix,
      alp.management_company,
      alp.source,
      alp.data_as_of,
      ROUND((
        point(alp.longitude::float, alp.latitude::float)
        <@> point($2::float, $1::float)
      )::numeric, 3) AS distance_miles
    FROM apartment_locator_properties alp
    WHERE alp.latitude IS NOT NULL
      AND alp.longitude IS NOT NULL
      AND alp.avg_asking_rent > 0
      AND (
        point(alp.longitude::float, alp.latitude::float)
        <@> point($2::float, $1::float)
      ) <= $3
    ORDER BY distance_miles ASC
    LIMIT $4
  `, [deal.lat, deal.lng, radiusMiles, maxComps * 3]);

  // City-level fallback: if radius returns nothing, fall back to properties in the
  // same city as the deal (matched by city + state_code). If city is unknown, widen
  // to state-level. This keeps comps market-relevant rather than pulling state-wide.
  let rows = compRows.rows;
  if (rows.length === 0) {
    const dealCity = (deal.city || '').trim();
    const dealStateCode = (deal.state_code || '').trim();
    logger.info('[discoverFromAptLocator] Radius empty — trying city-level fallback', { dealId, radiusMiles, dealCity, dealStateCode });

    const fallbackParams: any[] = [maxComps * 3];
    let whereClause = 'alp.avg_asking_rent > 0';
    if (dealCity && dealStateCode) {
      whereClause += ` AND LOWER(alp.city) = LOWER($2) AND LOWER(alp.state) = LOWER($3)`;
      fallbackParams.push(dealCity, dealStateCode);
    } else if (dealStateCode) {
      whereClause += ` AND LOWER(alp.state) = LOWER($2)`;
      fallbackParams.push(dealStateCode);
    }

    const cityFallback = await pool.query(`
      SELECT
        alp.id,
        alp.property_name,
        alp.address,
        alp.city,
        alp.state,
        alp.zip,
        alp.latitude,
        alp.longitude,
        alp.total_units,
        alp.year_built,
        alp.avg_asking_rent,
        alp.avg_effective_rent,
        alp.occupancy_pct,
        alp.concessions,
        alp.concession_pct,
        alp.unit_mix,
        alp.management_company,
        alp.source,
        alp.data_as_of,
        5.0 AS distance_miles
      FROM apartment_locator_properties alp
      WHERE ${whereClause}
      ORDER BY alp.avg_asking_rent ASC
      LIMIT $1
    `, fallbackParams);
    rows = cityFallback.rows;
    if (rows.length === 0) {
      logger.info('[discoverFromAptLocator] No apt locator properties found at all', { dealId });
      return { inserted_competitive_sets: 0, inserted_deal_rent_comp_sets: 0, median_rent: null, rent_updated: false, comp_count: 0, comps: [] };
    }
    logger.info('[discoverFromAptLocator] City-level fallback found properties', { dealId, count: rows.length, dealCity, dealStateCode });
  }

  // 2. Score comps
  const scored = rows.map((row: any) => {
    const candidate: CompCandidate = {
      address: row.address,
      city: row.city,
      units: row.total_units || 0,
      year_built: row.year_built,
      stories: null,
      class_code: null,
      building_sqft: null,
      distance_miles: parseFloat(row.distance_miles),
    };
    const { score, factors } = computeMatchScore(
      candidate,
      { units: dealUnits, year_built: dealYearBuilt, stories: dealStories, class_code: dealClassCode },
      radiusMiles
    );
    return { ...row, match_score: score, match_factors: factors, distance_miles: parseFloat(row.distance_miles) };
  });

  scored.sort((a: any, b: any) => b.match_score - a.match_score);
  const topComps = scored.slice(0, maxComps);

  // 3. Insert into competitive_sets (M27 agent)
  let insertedCS = 0;
  for (const comp of topComps) {
    try {
      const assetClass = comp.year_built >= 2010 ? 'A' : comp.year_built >= 1995 ? 'B' : 'C';
      await pool.query(`
        INSERT INTO competitive_sets (
          deal_id, created_at_stage,
          comp_property_id, comp_name, comp_address, comp_city, comp_state, comp_zip,
          comp_units, comp_year_built, asset_class,
          comp_distance_miles, relevance_score, relevance_factors,
          source, source_id, is_active
        ) VALUES (
          $1, 'discovery',
          $2, $3, $4, $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13,
          'apartment_locator', $14, true
        )
        ON CONFLICT (deal_id, source, source_id) WHERE source_id IS NOT NULL
        DO UPDATE SET
          relevance_score  = EXCLUDED.relevance_score,
          relevance_factors= EXCLUDED.relevance_factors,
          comp_distance_miles = EXCLUDED.comp_distance_miles,
          is_active        = true
      `, [
        dealId,
        comp.id,
        comp.property_name || comp.address,
        comp.address, comp.city, comp.state, comp.zip,
        comp.total_units, comp.year_built, assetClass,
        comp.distance_miles, comp.match_score, JSON.stringify(comp.match_factors),
        comp.id,
      ]);

      // Insert latest pricing snapshot for this comp
      if (comp.avg_asking_rent) {
        await pool.query(`
          INSERT INTO comp_pricing_snapshots (
            deal_id, comp_set_id,
            snapshot_date, avg_asking_rent, avg_effective_rent,
            estimated_occupancy, concessions_offered
          )
          SELECT $1, cs.id, $3, $4, $5, $6, $7
          FROM competitive_sets cs
          WHERE cs.deal_id = $1 AND cs.source_id = $2
          LIMIT 1
          ON CONFLICT DO NOTHING
        `, [
          dealId, comp.id,
          comp.data_as_of || new Date().toISOString().slice(0, 10),
          comp.avg_asking_rent,
          comp.avg_effective_rent || comp.avg_asking_rent,
          comp.occupancy_pct ? parseFloat(comp.occupancy_pct) / 100 : null,
          comp.concessions || null,
        ]);
      }

      insertedCS++;
    } catch (err: any) {
      logger.warn('[discoverFromAptLocator] competitive_sets insert failed', { address: comp.address, err: err.message });
    }
  }

  // 4. Insert into deal_rent_comp_sets (UI workspace)
  let insertedDCS = 0;
  for (const comp of topComps) {
    try {
      await pool.query(`
        INSERT INTO deal_rent_comp_sets (
          deal_id, comp_property_address, comp_name, source, status,
          distance_miles, match_score, match_factors,
          year_built, units,
          avg_rent, occupancy,
          lat, lng
        ) VALUES ($1, $2, $3, 'apartment_locator', 'active', $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (deal_id, comp_property_address) DO UPDATE SET
          status       = 'active',
          match_score  = EXCLUDED.match_score,
          avg_rent     = EXCLUDED.avg_rent,
          occupancy    = EXCLUDED.occupancy,
          updated_at   = NOW()
      `, [
        dealId,
        comp.address,
        comp.property_name || comp.address,
        comp.distance_miles,
        comp.match_score,
        JSON.stringify(comp.match_factors),
        comp.year_built,
        comp.total_units,
        comp.avg_asking_rent ? parseFloat(comp.avg_asking_rent) : null,
        comp.occupancy_pct ? parseFloat(comp.occupancy_pct) / 100 : null,
        comp.latitude ? parseFloat(comp.latitude) : null,
        comp.longitude ? parseFloat(comp.longitude) : null,
      ]);
      insertedDCS++;
    } catch (err: any) {
      logger.warn('[discoverFromAptLocator] deal_rent_comp_sets insert failed', { address: comp.address, err: err.message });
    }
  }

  // 5. Gap 4: Market Rent → Projections
  //    Compute median asking rent from discovered comps → update deal_assumptions
  const rents = topComps
    .map((c: any) => c.avg_asking_rent ? parseFloat(c.avg_asking_rent) : null)
    .filter((r: number | null): r is number => r !== null && r > 0)
    .sort((a: number, b: number) => a - b);

  let medianRent: number | null = null;
  let rentUpdated = false;

  if (rents.length > 0) {
    const mid = Math.floor(rents.length / 2);
    medianRent = rents.length % 2 === 0
      ? (rents[mid - 1] + rents[mid]) / 2
      : rents[mid];

    // Check whether avg_rent_per_unit is currently NULL (so we know if the upsert
    // will actually write a new value vs preserve an existing user-set value).
    const existing = await pool.query(
      `SELECT avg_rent_per_unit FROM deal_assumptions WHERE deal_id = $1`,
      [dealId]
    );
    const currentRent = existing.rows[0]?.avg_rent_per_unit ?? null;
    const willUpdate = currentRent === null;

    // Upsert deal_assumptions.avg_rent_per_unit with market-calibrated rent.
    // Only sets the value if currently NULL (never overrides user-entered values).
    // Also marks source_type = 'apt_locator' and persists comp count in source_ref
    // so the UI can show a "Market-calibrated from N comps" note across page loads.
    const compCountRef = `apt_locator:${rents.length} comps`;
    await pool.query(`
      INSERT INTO deal_assumptions (deal_id, avg_rent_per_unit, source_type, source_ref)
      VALUES ($1, $2, 'apt_locator', $3)
      ON CONFLICT (deal_id) DO UPDATE SET
        avg_rent_per_unit = CASE
          WHEN deal_assumptions.avg_rent_per_unit IS NULL THEN EXCLUDED.avg_rent_per_unit
          ELSE deal_assumptions.avg_rent_per_unit
        END,
        source_type = CASE
          WHEN deal_assumptions.avg_rent_per_unit IS NULL THEN 'apt_locator'
          ELSE deal_assumptions.source_type
        END,
        source_ref = CASE
          WHEN deal_assumptions.avg_rent_per_unit IS NULL THEN EXCLUDED.source_ref
          ELSE EXCLUDED.source_ref
        END,
        updated_at = NOW()
    `, [dealId, Math.round(medianRent), compCountRef]);

    rentUpdated = willUpdate;
    logger.info('[discoverFromAptLocator] calibrated market rent', { dealId, medianRent, compCount: rents.length, rentUpdated });
  }

  // Build the inline comps list returned to the UI so analysts can see *which*
  // apartments drove the calibrated market rent.
  const compsList: AptLocatorDiscoveryResultComp[] = topComps.map((c: any) => ({
    alp_id: c.id != null ? String(c.id) : null,
    name: c.property_name || c.address,
    address: c.address,
    city: c.city ?? null,
    state: c.state ?? null,
    zip: c.zip ?? null,
    avg_asking_rent: c.avg_asking_rent != null ? parseFloat(c.avg_asking_rent) : null,
    avg_effective_rent: c.avg_effective_rent != null ? parseFloat(c.avg_effective_rent) : null,
    occupancy_pct: c.occupancy_pct != null ? parseFloat(c.occupancy_pct) : null,
    concessions: c.concessions ?? null,
    concession_pct: c.concession_pct != null ? parseFloat(c.concession_pct) : null,
    unit_mix: c.unit_mix ?? null,
    management_company: c.management_company ?? null,
    source: c.source ?? null,
    data_as_of: c.data_as_of ?? null,
    distance_miles: c.distance_miles != null ? Number(c.distance_miles) : null,
    match_score: c.match_score != null ? Number(c.match_score) : null,
    year_built: c.year_built ?? null,
    total_units: c.total_units ?? null,
    lat: c.latitude != null ? parseFloat(c.latitude) : null,
    lng: c.longitude != null ? parseFloat(c.longitude) : null,
  }));

  logger.info('[discoverFromAptLocator] complete', { dealId, insertedCS, insertedDCS, medianRent });
  return {
    inserted_competitive_sets: insertedCS,
    inserted_deal_rent_comp_sets: insertedDCS,
    median_rent: medianRent,
    rent_updated: rentUpdated,
    comp_count: topComps.length,
    comps: compsList,
  };
}
