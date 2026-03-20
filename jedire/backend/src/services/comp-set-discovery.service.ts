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
