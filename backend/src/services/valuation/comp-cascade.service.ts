/**
 * Comp Cascade Service — D-COMP-3
 *
 * Implements the geographic cascade: true staged expansion of the comp pool
 * from the subject's trade area outward, stopping when a qualifying threshold
 * is reached. Each comp is tagged with the geographic tier it was pulled from.
 *
 * Expansion order:
 *   1. Trade Area   ≤ TRADE_AREA_RADIUS miles (default 3)
 *   2. Submarket    ≤ SUBMARKET_RADIUS miles (default 9)   — added only if trade_area < threshold
 *   3. MSA          ≤ MSA_RADIUS miles       (default 25)  — added only if trade_area+submarket < threshold
 *
 * Result: CascadeResult with:
 *   - comps[]           — final selected pool with geographic_tier explicitly set
 *   - cascade_metadata  — real counts + widened_to from actual staged execution
 */

import { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CascadeSubject {
  lat: number;
  lng: number;
  units?:      number | null;
  year_built?: number | null;
  asset_class?: string | null;
}

export interface CascadeOptions {
  min_units?:          number;
  date_range_months?:  number;
  threshold?:          number;
  trade_area_radius?:  number;
  submarket_radius?:   number;
  msa_radius?:         number;
  deal_id?:            string;
  exclude_distress?:   boolean;
  arms_length_only?:   boolean;
}

export interface CascadeComp {
  id:               string;
  property_address: string;
  units:            number;
  year_built:       number | null;
  property_class:   string | null;
  derived_sale_price: number;
  price_per_unit:   number;
  implied_cap_rate: number | null;
  /** Raw NOI from market_sale_comps (CoStar/research). Null for county-recorded comps. */
  noi:              number | null;
  /** NOI per unit (noi / units). Null when noi is null or units is zero. */
  noi_per_unit:     number | null;
  /** How implied_cap_rate was derived */
  cap_rate_source:  'noi_derived' | 'broker_reported' | null;
  recording_date:   Date | null;
  source:           string | null;
  buyer_type:       string | null;
  distance_miles:   number;
  geographic_tier:  'trade_area' | 'submarket' | 'msa';
}

export interface CascadeMetadata {
  trade_area_count: number;
  submarket_count:  number;
  msa_count:        number;
  widened_to:       'trade_area' | 'submarket' | 'msa';
  threshold:        number;
  radii:            { trade_area: number; submarket: number; msa: number };
}

export interface CascadeResult {
  comps:             CascadeComp[];
  cascade_metadata:  CascadeMetadata;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_TRADE_AREA_RADIUS = 3;   // miles
const DEFAULT_SUBMARKET_RADIUS  = 9;   // miles
const DEFAULT_MSA_RADIUS        = 25;  // miles
const DEFAULT_THRESHOLD         = 5;
const DEFAULT_MIN_UNITS         = 20;
const DEFAULT_DATE_RANGE_MONTHS = 36;

// ---------------------------------------------------------------------------
// Core cascade query
//
// Uses PostgreSQL earthdistance (<@>) operator which returns miles.
// Pulls all comps within msa_radius in a SINGLE query, then stage-fills in TS.
// ---------------------------------------------------------------------------

export async function executeCascade(
  pool: Pool,
  subject: CascadeSubject,
  opts: CascadeOptions = {},
): Promise<CascadeResult> {
  const {
    min_units         = DEFAULT_MIN_UNITS,
    date_range_months = DEFAULT_DATE_RANGE_MONTHS,
    threshold         = DEFAULT_THRESHOLD,
    trade_area_radius = DEFAULT_TRADE_AREA_RADIUS,
    submarket_radius  = DEFAULT_SUBMARKET_RADIUS,
    msa_radius        = DEFAULT_MSA_RADIUS,
    deal_id,
    exclude_distress  = true,
    arms_length_only  = true,
  } = opts;

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - date_range_months);

  const filters: string[] = [
    `t.latitude IS NOT NULL`,
    `t.longitude IS NOT NULL`,
    `t.property_type = 'multifamily'`,
    `t.units >= $3`,
    `t.sale_price > 0`,
    `t.sale_date >= $4`,
    `(point(t.longitude::float, t.latitude::float) <@> point($2::float, $1::float)) <= $5`,
  ];

  if (arms_length_only) {
    filters.push(`(t.qualified IS NULL OR t.qualified = true)`);
  }
  if (exclude_distress) {
    filters.push(`(t.price_per_unit IS NULL OR t.price_per_unit > 20000)`);
  }

  // CoStar data isolation: scoped comps visible only to the deal that uploaded them
  if (deal_id) {
    filters.push(`(t.source != 'costar_upload' OR t.deal_id = $6::uuid OR t.deal_id IS NULL)`);
  } else {
    filters.push(`(t.source != 'costar_upload' OR t.deal_id IS NULL)`);
  }

  const params: any[] = [
    subject.lat,
    subject.lng,
    min_units,
    cutoffDate,
    msa_radius,
    ...(deal_id ? [deal_id] : []),
  ];

  const sql = `
    SELECT
      t.id,
      t.address                          AS property_address,
      t.units,
      t.year_built,
      COALESCE(t.asset_class, 'B')       AS property_class,
      t.sale_price                       AS derived_sale_price,
      COALESCE(t.price_per_unit, 0)      AS price_per_unit,
      COALESCE(CASE
        WHEN t.noi IS NOT NULL AND t.sale_price > 0
        THEN ROUND((t.noi / t.sale_price)::numeric, 6)
        ELSE NULL
      END, t.cap_rate)                   AS implied_cap_rate,
      t.noi,
      t.sale_date                        AS recording_date,
      t.source,
      t.buyer_type,
      ROUND(
        (point(t.longitude::float, t.latitude::float)
         <@> point($2::float, $1::float))::numeric,
        3
      ) AS distance_miles
    FROM market_sale_comps t
    WHERE ${filters.join(' AND ')}
    ORDER BY distance_miles ASC
    LIMIT 200
  `;

  const result = await pool.query(sql, params);

  // Stage-fill by geographic tier
  const tradeAreaRadii = trade_area_radius;
  const submarketRadii = submarket_radius;

  const rawTradeArea: CascadeComp[] = [];
  const rawSubmarket: CascadeComp[] = [];
  const rawMsa: CascadeComp[] = [];

  for (const row of result.rows) {
    const dist = parseFloat(row.distance_miles);
    const noi = row.noi != null ? parseFloat(String(row.noi)) : null;
    const unitCount = parseInt(String(row.units)) || 0;
    const rawCapRate = row.implied_cap_rate ? parseFloat(String(row.implied_cap_rate)) : null;
    const capRateSource: CascadeComp['cap_rate_source'] =
      noi != null ? 'noi_derived' : rawCapRate != null ? 'broker_reported' : null;
    const comp: CascadeComp = {
      id:                row.id,
      property_address:  row.property_address ?? '',
      units:             unitCount,
      year_built:        row.year_built ? parseInt(String(row.year_built)) : null,
      property_class:    row.property_class ?? null,
      derived_sale_price: parseFloat(row.derived_sale_price) || 0,
      price_per_unit:    parseFloat(row.price_per_unit) || 0,
      implied_cap_rate:  rawCapRate,
      noi,
      noi_per_unit:      noi != null && unitCount > 0 ? Math.round(noi / unitCount) : null,
      cap_rate_source:   capRateSource,
      recording_date:    row.recording_date ? new Date(row.recording_date) : null,
      source:            row.source ?? null,
      buyer_type:        row.buyer_type ?? null,
      distance_miles:    dist,
      geographic_tier:   'trade_area', // placeholder; set below
    };

    if (dist <= tradeAreaRadii) {
      comp.geographic_tier = 'trade_area';
      rawTradeArea.push(comp);
    } else if (dist <= submarketRadii) {
      comp.geographic_tier = 'submarket';
      rawSubmarket.push(comp);
    } else {
      comp.geographic_tier = 'msa';
      rawMsa.push(comp);
    }
  }

  // Staged expansion — stop when threshold is met
  let selectedComps: CascadeComp[];
  let widened_to: 'trade_area' | 'submarket' | 'msa';

  if (rawTradeArea.length >= threshold) {
    // Trade area has enough — no expansion needed
    selectedComps = rawTradeArea;
    widened_to    = 'trade_area';
  } else if (rawTradeArea.length + rawSubmarket.length >= threshold) {
    // Need submarket to reach threshold
    selectedComps = [...rawTradeArea, ...rawSubmarket];
    widened_to    = 'submarket';
  } else {
    // Need MSA to reach threshold
    selectedComps = [...rawTradeArea, ...rawSubmarket, ...rawMsa];
    widened_to    = 'msa';
  }

  const cascade_metadata: CascadeMetadata = {
    trade_area_count: rawTradeArea.length,
    submarket_count:  rawSubmarket.length,
    msa_count:        rawMsa.length,
    widened_to,
    threshold,
    radii: { trade_area: trade_area_radius, submarket: submarket_radius, msa: msa_radius },
  };

  return { comps: selectedComps, cascade_metadata };
}
