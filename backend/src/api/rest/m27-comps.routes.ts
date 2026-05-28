/**
 * M27: Sale Comp Intelligence Routes
 * API endpoints for comparable sales and transaction patterns
 */

import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { compSetService } from '../../services/saleComps/compSet.service';
import { getPool } from '../../database/connection';

const router = Router();

/**
 * POST /api/v1/deals/:dealId/comps/generate
 * Auto-generate comp set for a deal
 */
router.post('/deals/:dealId/comps/generate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const {
      radius_miles = 3.0,
      date_range_months = 24,
      min_units = 50,
      max_units = 500,
      property_classes = ['A', 'B', 'C'],
      vintage_range,
      exclude_distress = true,
      arms_length_only = true,
      strategy,
    } = req.body;

    const compSet = await compSetService.generateCompSet({
      deal_id: dealId,
      radius_miles,
      date_range_months,
      min_units,
      max_units,
      property_classes,
      vintage_range,
      exclude_distress,
      arms_length_only,
      strategy,
    });

    res.json({
      success: true,
      data: compSet
    });
  } catch (error: any) {
    console.error('Generate comp set error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/comps
 * Get existing comp set for a deal
 */
router.get('/deals/:dealId/comps', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    
    const compSet = await compSetService.getCompSetByDeal(dealId);
    
    if (!compSet) {
      return res.status(404).json({
        success: false,
        error: 'No comp set found for this deal'
      });
    }

    // Expose members (alias for comps) with camelCase relevanceScore for protocol compliance
    const members = (compSet.comps ?? []).map((c: any) => ({
      ...c,
      relevanceScore: c.relevance_score,
    }));

    res.json({
      success: true,
      data: {
        ...compSet,
        members,
      },
    });
  } catch (error: any) {
    console.error('Get comp set error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/comps/exit-cap-rate
 * Get transaction-derived exit cap rate for ProForma
 */
router.get('/deals/:dealId/comps/exit-cap-rate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    
    const compSet = await compSetService.getCompSetByDeal(dealId);
    
    if (!compSet || !compSet.median_implied_cap_rate) {
      // Fallback: use market default
      return res.json({
        success: true,
        data: {
          exit_cap_rate: 0.06, // 6% default
          source: 'market_default',
          confidence: 'low',
          message: 'No transaction-derived cap rate available. Using market default.'
        }
      });
    }

    res.json({
      success: true,
      data: {
        exit_cap_rate: compSet.median_implied_cap_rate,
        source: 'transaction_derived',
        confidence: compSet.comp_count >= 5 ? 'high' : 'medium',
        comp_count: compSet.comp_count,
        cap_rate_range: {
          median: compSet.median_implied_cap_rate,
          avg: compSet.avg_implied_cap_rate
        }
      }
    });
  } catch (error: any) {
    console.error('Get exit cap rate error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/v1/deals/:dealId/comps/summary
 * Get comp summary for dashboard
 */
router.get('/deals/:dealId/comps/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    
    const compSet = await compSetService.getCompSetByDeal(dealId);
    
    if (!compSet) {
      return res.json({
        success: true,
        data: {
          hasCompSet: false,
          message: 'No comp set available'
        }
      });
    }

    res.json({
      success: true,
      data: {
        hasCompSet: true,
        comp_count: compSet.comp_count,
        median_price_per_unit: compSet.median_price_per_unit,
        median_implied_cap_rate: compSet.median_implied_cap_rate,
        price_range: {
          min: compSet.min_price_per_unit,
          max: compSet.max_price_per_unit
        }
      }
    });
  } catch (error: any) {
    console.error('Get comp summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/deals/:dealId/comps/:compId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId, compId } = req.params;
    const result = await compSetService.deleteCompFromSet(dealId, compId);
    res.json({ success: true, data: result.updatedSet });
  } catch (error: any) {
    console.error('Delete comp error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// computeCompSummary — builds the same summary envelope as stored comp sets
// so the UI renders correctly regardless of whether data comes from a live
// cascade or a stored comp set.
// ---------------------------------------------------------------------------
function computeCompSummary(comps: Array<{ price_per_unit: number; implied_cap_rate?: number | null }>) {
  const prices = comps.map(c => c.price_per_unit).filter(p => p > 0).sort((a, b) => a - b);
  const caps   = comps.map(c => c.implied_cap_rate).filter((v): v is number => v != null && v > 0).sort((a, b) => a - b);

  const medianOf = (arr: number[]): number => {
    if (arr.length === 0) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
  };
  const avgOf = (arr: number[]): number =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    comp_count:             comps.length,
    median_price_per_unit:  medianOf(prices),
    avg_price_per_unit:     avgOf(prices),
    min_price_per_unit:     prices.length > 0 ? prices[0] : 0,
    max_price_per_unit:     prices.length > 0 ? prices[prices.length - 1] : 0,
    median_implied_cap_rate: caps.length > 0 ? medianOf(caps) : null,
    avg_implied_cap_rate:    caps.length > 0 ? avgOf(caps)    : null,
  };
}

/**
 * GET /api/v1/deals/:dealId/comps/ranked
 * Re-score and rank the existing comp set for a given strategy without
 * regenerating from DB. Lightweight — no DB writes.
 *
 * Query params:
 *   strategy — stabilized | value_add | ground_up | redevelopment (default: stabilized)
 */
router.get('/deals/:dealId/comps/ranked', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const {
      strategy,
      min_units: minUnitsParam,
      date_range_months: dateRangeParam,
    } = req.query as { strategy?: string; min_units?: string; date_range_months?: string };

    const {
      rankComps, resolveStrategy, TIER_LABELS, FACTOR_LABELS, GEO_TIER_LABELS,
    } = await import('../../services/valuation/comp-relevance-scoring.service');
    const { buildCompStory } = await import('../../services/valuation/comp-story.service');
    const { executeCascade } = await import('../../services/valuation/comp-cascade.service');
    const pool = getPool();

    const userId = req.user!.userId;

    // Ownership check — fail fast before any data access
    const ownerCheck = await pool.query(
      `SELECT id FROM deals WHERE id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
      [dealId, userId],
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    // 1. Fetch deal subject coordinates + metadata.
    //    Primary: boundary centroid. Fallback: properties.latitude/longitude.
    const dealRow = await pool.query(
      `SELECT COALESCE(d.asset_class, 'B') AS asset_class,
              p.units, p.year_built,
              COALESCE(
                ST_Y(ST_Centroid(d.boundary)),
                p.latitude::float
              ) AS deal_lat,
              COALESCE(
                ST_X(ST_Centroid(d.boundary)),
                p.longitude::float
              ) AS deal_lng
       FROM deals d LEFT JOIN properties p ON p.deal_id = d.id
       WHERE d.id = $1::uuid AND d.user_id = $2::uuid LIMIT 1`,
      [dealId, userId],
    );
    const dealInfo = dealRow.rows[0] ?? {};
    const dealLat = dealInfo.deal_lat != null ? parseFloat(String(dealInfo.deal_lat)) : null;
    const dealLng = dealInfo.deal_lng != null ? parseFloat(String(dealInfo.deal_lng)) : null;

    const subject = {
      units:       dealInfo.units      ? parseInt(String(dealInfo.units),      10) : null,
      year_built:  dealInfo.year_built ? parseInt(String(dealInfo.year_built), 10) : null,
      asset_class: dealInfo.asset_class ?? 'B',
    };

    const resolvedStrategy = resolveStrategy(strategy);

    // 2. Execute the geographic cascade.
    //    If the deal has no coordinates, fall back to the stored comp set.
    let scoredComps: any[];
    let top: any[];
    let weights: any;
    let comp_story: any;

    if (dealLat != null && dealLng != null) {
      // ── LIVE CASCADE PATH (D-COMP-3) ───────────────────────────────────────
      //
      // Staged expansion: trade_area (≤3mi) → submarket (≤9mi) → MSA (≤25mi).
      // Stops as soon as threshold comps are reached at a given tier.
      // cascade_metadata reflects which tier was the actual stopping point.
      const minUnits       = minUnitsParam  ? parseInt(minUnitsParam,  10) : 20;
      const dateRangeMonths = dateRangeParam ? parseInt(dateRangeParam, 10) : 36;

      const cascadeResult = await executeCascade(
        pool,
        { lat: dealLat, lng: dealLng, ...subject },
        { min_units: minUnits, date_range_months: dateRangeMonths, deal_id: dealId },
      );

      const { comps: cascadeComps, cascade_metadata } = cascadeResult;

      if (cascadeComps.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No qualifying comps found within 25 miles of this deal',
        });
      }

      // Score/rank the cascade pool
      const candidates = cascadeComps.map(c => ({
        id:             c.id,
        units:          c.units,
        year_built:     c.year_built,
        asset_class:    c.property_class,
        sale_date:      c.recording_date,
        distance_miles: c.distance_miles,
        source:         c.source,
      }));

      const ranked = rankComps(subject, candidates, resolvedStrategy, 8);
      top     = ranked.top;
      weights = ranked.weights;

      const scoreMap    = new Map(ranked.ranked.map((s: any) => [s.comp.id, s]));
      const cascadeMap  = new Map(cascadeComps.map(c => [c.id, c]));

      scoredComps = ranked.ranked.map(({ comp: candidate }: any) => {
        const base = cascadeMap.get(candidate.id)!;
        const s    = scoreMap.get(candidate.id)!;
        const tier = base.geographic_tier;
        return {
          id:                base.id,
          property_address:  base.property_address,
          units:             base.units,
          year_built:        base.year_built,
          property_class:    base.property_class,
          derived_sale_price: base.derived_sale_price,
          price_per_unit:    base.price_per_unit,
          price_per_sf:      null,
          implied_cap_rate:  base.implied_cap_rate,
          noi:               base.noi ?? null,
          noi_per_unit:      base.noi_per_unit ?? null,
          cap_rate_source:   base.cap_rate_source ?? null,
          recording_date:    base.recording_date,
          source:            base.source,
          buyer_type:        base.buyer_type,
          distance_miles:    base.distance_miles,
          geographic_tier:   tier,
          geographic_label:  GEO_TIER_LABELS[tier],
          relevance_score:   s.relevance_score,
          relevanceScore:    s.relevance_score,
          relevance_tier:    s.relevance_tier,
          relevance_factors: s.factors,
        };
      });

      // D-COMP-2: Build strategy comp story using real cascade metadata + subject vintage
      const storyComps = scoredComps.map(c => ({
        id:               c.id,
        year_built:       c.year_built,
        implied_cap_rate: c.implied_cap_rate,
        price_per_unit:   c.price_per_unit,
        recording_date:   c.recording_date,
        geographic_tier:  c.geographic_tier as 'trade_area' | 'submarket' | 'msa',
      }));
      comp_story = buildCompStory(storyComps, resolvedStrategy, {
        cascade_metadata,
        subject_year_built: subject.year_built,
      });

      // Summary stats — same envelope as stored comp sets so the UI renders correctly
      const cascadeSummary = computeCompSummary(scoredComps);

      return res.json({
        success: true,
        data: {
          ...cascadeSummary,
          comps:           scoredComps,
          members:         scoredComps,
          top_comp_ids:    top.map((s: any) => s.comp.id),
          strategy:        resolvedStrategy,
          weights,
          tier_labels:     TIER_LABELS,
          factor_labels:   FACTOR_LABELS,
          geo_tier_labels: GEO_TIER_LABELS,
          comp_story,
          cascade_source:  'live',
        },
      });
    }

    // ── STORED COMP SET FALLBACK (no coordinates on deal) ────────────────────
    //
    // The deal has no lat/lng, so we cannot run the cascade. Fall back to the
    // stored comp set generated by /comps/generate, scoring it in place but
    // omitting cascade metadata (since no staged expansion was possible).
    const compSet = await compSetService.getCompSetByDeal(dealId);
    if (!compSet) {
      return res.status(404).json({
        success: false,
        error: 'No comp set found and deal has no coordinates for live cascade',
      });
    }

    const candidates = compSet.comps.map(c => ({
      id:             c.id,
      units:          c.units,
      year_built:     c.year_built,
      asset_class:    c.property_class,
      sale_date:      c.recording_date,
      distance_miles: c.distance_miles,
      source:         c.source,
    }));

    const ranked = rankComps(subject, candidates, resolvedStrategy, 8);
    top     = ranked.top;
    weights = ranked.weights;

    const scoreMap = new Map(ranked.ranked.map((s: any) => [s.comp.id, s]));
    const compIndex = new Map(compSet.comps.map(c => [c.id, c]));

    // Derive geographic_tier from stored distance_miles using the same thresholds
    // as the live cascade (3/9 mile boundaries) rather than forcing everything to 'msa'.
    const { deriveGeographicTier } = await import('../../services/valuation/comp-relevance-scoring.service');

    scoredComps = ranked.ranked.map(({ comp: candidate }: any) => {
      const base = compIndex.get(candidate.id)!;
      const s    = scoreMap.get(candidate.id)!;
      const dist = typeof base.distance_miles === 'number' ? base.distance_miles : null;
      const tier = deriveGeographicTier(dist, 3);  // 3 = trade_area radius in miles
      return {
        ...base,
        geographic_tier:   tier,
        geographic_label:  GEO_TIER_LABELS[tier],
        relevance_score:   s.relevance_score,
        relevanceScore:    s.relevance_score,
        relevance_tier:    s.relevance_tier,
        relevance_factors: s.factors,
      };
    });

    const storyComps = scoredComps.map((c: any) => ({
      id:               c.id,
      year_built:       c.year_built,
      implied_cap_rate: c.implied_cap_rate,
      price_per_unit:   c.price_per_unit,
      recording_date:   c.recording_date,
      geographic_tier:  c.geographic_tier as 'trade_area' | 'submarket' | 'msa',
    }));
    // Do NOT pass cascade_metadata for stored fallback — UI will suppress the
    // expansion banner when cascade_source !== 'live'.
    comp_story = buildCompStory(storyComps, resolvedStrategy, {
      subject_year_built: subject.year_built,
    });

    return res.json({
      success: true,
      data: {
        ...compSet,
        comps:           scoredComps,
        members:         scoredComps,
        top_comp_ids:    top.map((s: any) => s.comp.id),
        strategy:        resolvedStrategy,
        weights,
        tier_labels:     TIER_LABELS,
        factor_labels:   FACTOR_LABELS,
        geo_tier_labels: GEO_TIER_LABELS,
        comp_story,
        cascade_source:  'stored_fallback',
      },
    });
  } catch (error: any) {
    console.error('Ranked comps error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/deals/:dealId/implied-cap-rate
 * Compute a platform-implied cap rate from submarket benchmark rents,
 * stabilized occupancy, and platform OpEx ratios (line_item_benchmarks P50).
 *
 * Formula:
 *   GPR  = market_rent_per_unit_annual × units
 *   EGI  = GPR × (1 - vacancy_p50)
 *   NOI  = EGI - (opex_per_unit_p50 × units)
 *   implied_cap = NOI / purchase_price
 *
 * Market rent source priority (Open Q1 resolution — see VALIDATION_GRID_AND_SALE_COMPS_INVESTIGATION.md):
 *   1. market_vitals.avg_rent_per_unit (monthly × 12) — primary: 998 rows, 13 markets, location-specific
 *   2. line_item_benchmarks (category='revenue') — fallback: global benchmarks, sparser
 *
 * Returns: implied_cap_rate, operator_going_in_cap, delta_bps, positioning label,
 *          rent_source, comp_reported_cap_rate (transaction-reported median from comp set).
 */

/**
 * Normalize a full MSA name (e.g. "Atlanta-Sandy Springs-Roswell, GA") to the
 * short market_id used in market_vitals (e.g. "atlanta").
 * Handles the 13 seeded market_ids by lowercasing the first city token.
 */
function msaToMarketId(msa: string | null): string | null {
  if (!msa) return null;
  const match = msa.match(/^([A-Za-z]+)/);
  return match ? match[1].toLowerCase() : null;
}

router.get('/deals/:dealId/implied-cap-rate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user?.userId;
    const pool = getPool();

    // 1 — Deal core info (ownership-scoped: user must own the deal)
    const dealRow = await pool.query(`
      SELECT
        d.id,
        COALESCE(d.asset_class, 'B')           AS asset_class,
        COALESCE(d.deal_type, 'existing')       AS deal_type,
        d.submarket_id,
        d.state,
        d.msa,
        p.year_built,
        p.units,
        da.purchase_price_lv->>'resolved'        AS purchase_price_resolved
      FROM deals d
      LEFT JOIN properties p ON p.deal_id = d.id
      LEFT JOIN deal_assumptions da ON da.deal_id = d.id
      WHERE d.id = $1::uuid AND d.user_id = $2::uuid
      LIMIT 1
    `, [dealId, userId]);

    if (dealRow.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    const deal = dealRow.rows[0] as Record<string, unknown>;
    const assetClass   = (deal.asset_class as string) ?? 'B';
    const dealType     = (deal.deal_type   as string) ?? 'existing';
    const state        = (deal.state       as string | null) ?? null;
    const msa          = (deal.msa         as string | null) ?? null;
    const units        = deal.units ? parseInt(String(deal.units), 10) : null;
    const yearBuilt    = deal.year_built ? parseInt(String(deal.year_built), 10) : null;
    const purchasePrice = deal.purchase_price_resolved ? parseFloat(String(deal.purchase_price_resolved)) : null;

    // 2 — Derive dimension buckets
    const vintageBand = yearBuilt == null ? null
      : yearBuilt < 1990 ? 'pre-1990'
      : yearBuilt < 2006 ? '1990-2005'
      : yearBuilt < 2016 ? '2006-2015'
      : '2016+';

    const unitCountBand = units == null ? null
      : units < 100  ? '<100'
      : units < 200  ? '100-200'
      : units < 350  ? '200-350'
      : '350+';

    // Helper: progressively loosen bucket matches, prioritising tighter matches
    async function queryBenchmark(sql: string, params: unknown[]): Promise<Record<string, unknown> | null> {
      const r = await pool.query(sql, params);
      return (r.rows[0] as Record<string, unknown> | undefined) ?? null;
    }

    // 3 — OpEx sum: sum of per_unit_p50 across all opex lines for the bucket
    let opexPerUnit: number | null = null;
    const opexBuckets = [
      { vintage: vintageBand, units: unitCountBand, state, msa },
      { vintage: vintageBand, units: unitCountBand, state, msa: null },
      { vintage: vintageBand, units: null,          state, msa: null },
      { vintage: null,        units: null,          state, msa: null },
      { vintage: null,        units: null,          state: null, msa: null },
    ];
    for (const b of opexBuckets) {
      const r = await queryBenchmark(`
        SELECT SUM(per_unit_p50) AS total_opex_per_unit
        FROM line_item_benchmarks
        WHERE category = 'opex'
          AND asset_class = $1
          AND deal_type   = $2
          AND n_samples  >= 3
          AND ($3::text IS NULL OR state      = $3)
          AND ($4::text IS NULL OR msa        = $4)
          AND ($5::text IS NULL OR vintage_band   = $5)
          AND ($6::text IS NULL OR unit_count_band = $6)
      `, [assetClass, dealType, b.state, b.msa, b.vintage, b.units]);
      const v = r?.total_opex_per_unit != null ? parseFloat(String(r.total_opex_per_unit)) : null;
      if (v != null && v > 0) { opexPerUnit = v; break; }
    }

    // 4 — Market rent: annual GPR per unit
    // Priority (Open Q1 resolution): market_vitals (primary) → line_item_benchmarks (fallback)
    // See docs/architecture/VALIDATION_GRID_AND_SALE_COMPS_INVESTIGATION.md for rationale.
    let marketRentPerUnitAnnual: number | null = null;
    let rentSource: string | null = null;

    // 4a — Primary: market_vitals.avg_rent_per_unit (monthly × 12), keyed by market_id
    const marketId = msaToMarketId(msa);
    if (marketId) {
      const mvRow = await queryBenchmark(`
        SELECT avg_rent_per_unit
        FROM market_vitals
        WHERE market_id = $1
          AND avg_rent_per_unit IS NOT NULL
        ORDER BY date DESC
        LIMIT 1
      `, [marketId]);
      const monthlyRent = mvRow?.avg_rent_per_unit != null ? parseFloat(String(mvRow.avg_rent_per_unit)) : null;
      if (monthlyRent != null && monthlyRent > 0) {
        marketRentPerUnitAnnual = monthlyRent * 12;
        rentSource = 'market_vitals';
      }
    }

    // 4b — Fallback: line_item_benchmarks (category='revenue'), progressive bucket relaxation
    if (marketRentPerUnitAnnual == null) {
      const rentBuckets = opexBuckets;
      for (const b of rentBuckets) {
        const r = await queryBenchmark(`
          SELECT per_unit_p50 AS market_rent
          FROM line_item_benchmarks
          WHERE category   = 'revenue'
            AND line_item  IN ('gpr', 'market_rent', 'gross_potential_rent', 'effective_gross_income')
            AND asset_class = $1
            AND deal_type   = $2
            AND n_samples  >= 3
            AND ($3::text IS NULL OR state           = $3)
            AND ($4::text IS NULL OR msa             = $4)
            AND ($5::text IS NULL OR vintage_band    = $5)
            AND ($6::text IS NULL OR unit_count_band = $6)
          ORDER BY as_of DESC
          LIMIT 1
        `, [assetClass, dealType, b.state, b.msa, b.vintage, b.units]);
        const v = r?.market_rent != null ? parseFloat(String(r.market_rent)) : null;
        if (v != null && v > 0) {
          marketRentPerUnitAnnual = v;
          rentSource = 'line_item_benchmarks';
          break;
        }
      }
    }

    // 5 — Vacancy: P50 from archive_assumption_benchmarks
    let vacancyP50: number | null = null;
    const vacBuckets = [
      { asset: assetClass, type: dealType, sub: deal.submarket_id as string | null },
      { asset: assetClass, type: dealType, sub: null },
      { asset: assetClass, type: null,     sub: null },
    ];
    for (const b of vacBuckets) {
      const r = await queryBenchmark(`
        SELECT p50 AS vacancy_p50
        FROM archive_assumption_benchmarks
        WHERE assumption_name = 'vacancy_pct'
          AND asset_class = $1
          AND ($2::text IS NULL OR deal_type   = $2)
          AND ($3::uuid IS NULL OR submarket_id = $3::uuid)
          AND n_samples >= 5
        ORDER BY as_of DESC
        LIMIT 1
      `, [b.asset, b.type, b.sub]);
      const v = r?.vacancy_p50 != null ? parseFloat(String(r.vacancy_p50)) : null;
      if (v != null) { vacancyP50 = v; break; }
    }
    if (vacancyP50 == null) vacancyP50 = 0.07; // platform default 7%

    // 6 — Compute implied cap rate (requires all inputs)
    let impliedCapRate: number | null = null;
    let computationMethod = 'insufficient_data';
    let opexBucketUsed: Record<string, unknown> | null = null;
    let noiComponents: Record<string, number> | null = null;

    if (units != null && marketRentPerUnitAnnual != null && opexPerUnit != null && purchasePrice != null && purchasePrice > 0) {
      const gpr = marketRentPerUnitAnnual * units;
      const egi = gpr * (1 - vacancyP50);
      const noi = egi - (opexPerUnit * units);
      impliedCapRate = noi / purchasePrice;
      computationMethod = rentSource === 'market_vitals'
        ? 'market_vitals_rent_benchmark'
        : 'line_item_benchmark';
      opexBucketUsed = { asset_class: assetClass, deal_type: dealType, vintage_band: vintageBand, unit_count_band: unitCountBand, state, msa };
      noiComponents = { gpr, egi, noi, opex_total: opexPerUnit * units };
    }

    // 7 — Operator going-in cap (from latest underwriting snapshot or financials composer)
    let operatorGoingInCap: number | null = null;
    const snapRow = await queryBenchmark(`
      SELECT proforma_json
      FROM deal_underwriting_snapshots
      WHERE deal_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `, [dealId]);
    if (snapRow?.proforma_json) {
      const pj = snapRow.proforma_json as Record<string, unknown>;
      const snap = pj.proforma_fields as Record<string, unknown> | null ?? pj;
      const capVal = snap?.going_in_cap_rate ?? snap?.goingInCap ?? snap?.going_in_cap;
      if (capVal != null) operatorGoingInCap = parseFloat(String(capVal));
    }

    // 7.5 — Comp-reported cap rate: median cap rate from transaction comp set
    // This is the median of broker/source-reported cap rates on comparable sales,
    // distinct from the platform-implied cap (which is computed from NOI/price).
    let compReportedCapRate: number | null = null;
    let compCount: number | null = null;
    const compSetRow = await queryBenchmark(`
      SELECT median_implied_cap_rate, comp_count
      FROM sale_comp_sets
      WHERE deal_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `, [dealId]);
    if (compSetRow?.median_implied_cap_rate != null) {
      compReportedCapRate = parseFloat(String(compSetRow.median_implied_cap_rate));
      compCount = compSetRow.comp_count != null ? parseInt(String(compSetRow.comp_count), 10) : null;
    }

    // 8 — Delta and positioning
    let deltaBps: number | null = null;
    let positioningLabel: string | null = null;
    if (impliedCapRate != null && operatorGoingInCap != null) {
      deltaBps = Math.round((operatorGoingInCap - impliedCapRate) * 10000);
      if (Math.abs(deltaBps) <= 25) positioningLabel = 'ALIGNED';
      else if (deltaBps > 25) positioningLabel = 'OPERATOR_ABOVE';
      else positioningLabel = 'OPERATOR_BELOW';
    }

    return res.json({
      success: true,
      data: {
        implied_cap_rate: impliedCapRate,
        operator_going_in_cap: operatorGoingInCap,
        delta_bps: deltaBps,
        positioning_label: positioningLabel,
        computation_method: computationMethod,
        rent_source: rentSource,
        comp_reported_cap_rate: compReportedCapRate,
        comp_count: compCount,
        noi_components: noiComponents,
        inputs: {
          units,
          purchase_price: purchasePrice,
          market_rent_per_unit_annual: marketRentPerUnitAnnual,
          market_rent_per_unit_monthly: marketRentPerUnitAnnual != null ? Math.round(marketRentPerUnitAnnual / 12) : null,
          market_id: marketId,
          opex_per_unit_annual: opexPerUnit,
          vacancy_p50: vacancyP50,
          vintage_band: vintageBand,
          unit_count_band: unitCountBand,
          asset_class: assetClass,
          deal_type: dealType,
        },
        opex_bucket_used: opexBucketUsed,
      }
    });
  } catch (error: any) {
    console.error('Implied cap rate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
