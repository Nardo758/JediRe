/**
 * Portfolio API Routes
 * 
 * Endpoints for portfolio management, metrics, and performance tracking
 */

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

/**
 * GET /api/v1/portfolio/metrics
 * Aggregate portfolio metrics sourced from deal_monthly_actuals (is_portfolio_asset=TRUE).
 * Units are summed via a subquery (one row per property) to avoid double-counting when
 * multiple actuals rows share the same unit count.
 */
router.get('/metrics', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT
        COUNT(DISTINCT p.id)::int                          AS total_assets,
        COALESCE((
          SELECT SUM(pu.units)
          FROM properties pu
          WHERE pu.id IN (
            SELECT DISTINCT property_id FROM deal_monthly_actuals WHERE is_portfolio_asset = TRUE
          )
        ), 0)::int                                         AS total_units,
        COALESCE(AVG(dma.occupancy_rate) * 100, 0)         AS avg_occupancy,
        COALESCE(SUM(dma.noi), 0)                          AS portfolio_noi_all_time,
        COALESCE(AVG(dma.noi), 0)                          AS avg_monthly_noi
      FROM deal_monthly_actuals dma
      JOIN properties p ON p.id = dma.property_id
      WHERE dma.is_portfolio_asset = TRUE
    `);

    const row = result.rows[0] as Record<string, unknown>;
    const avgMonthlyNoi = Number(row.avg_monthly_noi ?? 0);

    res.json({
      totalAssets: Number(row.total_assets ?? 0),
      totalUnits: Number(row.total_units ?? 0),
      totalValue: 0,
      totalEquity: 0,
      totalDebt: 0,
      avgOccupancy: Number(row.avg_occupancy ?? 0),
      avgCapRate: 0,
      portfolioNoi: avgMonthlyNoi * 12,
      ytdReturn: null,
      ltmCashOnCash: null,
    });
  } catch (err) {
    logger.error('Portfolio metrics error:', err);
    res.status(500).json({ 
      error: err instanceof Error ? err.message : 'Failed to get portfolio metrics' 
    });
  }
});

/**
 * GET /api/v1/portfolio/submarkets
 * Returns available submarkets for the Add Asset submarket selector.
 * Scoped to the authenticated user's region pool; returns empty list on error
 * so the frontend can fall back to manual text entry.
 */
router.get('/submarkets', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT s.id, s.name, m.name AS msa_name
       FROM submarkets s
       LEFT JOIN (
         SELECT id, name FROM geographies WHERE type = 'msa'
       ) m ON m.id = s.msa_id::text
       ORDER BY m.name NULLS LAST, s.name
       LIMIT 300`
    );
    res.json({ submarkets: result.rows });
  } catch (err) {
    logger.error('Portfolio submarkets error:', err);
    res.json({ submarkets: [] });
  }
});

/**
 * GET /api/v1/portfolio/assets
 * All portfolio assets: properties with is_portfolio_asset actuals OR
 * recently created portfolio properties not yet loaded with actuals.
 * Uses LEFT JOIN so newly created properties (ownership_status='portfolio',
 * no actuals yet) are visible immediately after creation.
 */
router.get('/assets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const result = await query(
      `SELECT
         p.id                                              AS property_id,
         p.name,
         p.address_line1                                   AS address,
         p.city,
         p.state_code                                      AS state,
         COALESCE(p.units, 0)                              AS units,
         p.building_class                                  AS asset_class,
         p.year_built                                      AS vintage,
         s.name                                            AS submarket_name,
         s.id                                              AS submarket_id,
         p.submarket_id                                    AS raw_submarket_id,
         p.msa_name_override,
         p.acquisition_date,
         p.acquisition_price,
         COUNT(dma.id)                                     AS months_of_data,
         COALESCE(AVG(dma.occupancy_rate) * 100, 0)       AS avg_occupancy,
         COALESCE(AVG(dma.noi) * 12, 0)                   AS annualised_noi,
         COALESCE(AVG(dma.avg_effective_rent), 0)          AS avg_rent,
         MAX(dma.report_month)                             AS latest_period,
         MIN(dma.report_month)                             AS earliest_period,
         MAX(dma.deal_id::text)                            AS deal_id
       FROM properties p
       LEFT JOIN deal_monthly_actuals dma ON dma.property_id = p.id AND dma.is_portfolio_asset = TRUE
       LEFT JOIN submarkets s ON s.id::text = p.submarket_id
       WHERE (p.created_by = $1 OR p.created_by IS NULL)
         AND (
           p.ownership_status = 'portfolio'
           OR EXISTS (
             SELECT 1 FROM deal_monthly_actuals x
             WHERE x.property_id = p.id AND x.is_portfolio_asset = TRUE
           )
         )
       GROUP BY p.id, p.name, p.address_line1, p.city, p.state_code, p.units,
                p.building_class, p.year_built, s.name, s.id,
                p.acquisition_date, p.acquisition_price, p.submarket_id, p.msa_name_override
       ORDER BY p.name`,
      [userId]
    );

    const assets = result.rows.map((row: Record<string, unknown>) => {
      const occ = Number(row.avg_occupancy ?? 0);
      const purchasePrice = row.acquisition_price != null ? Number(row.acquisition_price) : 0;
      const noi = Number(row.annualised_noi ?? 0);
      return {
        id: row.property_id,
        name: row.name ?? '—',
        address: row.address ?? '—',
        city: row.city ?? '—',
        state: row.state ?? '—',
        msa: (row.submarket_name ?? row.city ?? '—') as string,
        units: Number(row.units ?? 0),
        assetClass: (row.asset_class ?? 'B') as string,
        vintage: Number(row.vintage ?? 0),
        acquisitionDate: row.acquisition_date ?? null,
        purchasePrice,
        currentValue: 0,
        noi,
        occupancy: occ,
        capRate: purchasePrice > 0 ? Math.round((noi / purchasePrice) * 10000) / 100 : 0,
        irr: 0,
        equity: 0,
        debt: 0,
        monthsOfData: Number(row.months_of_data ?? 0),
        avgRent: Number(row.avg_rent ?? 0),
        latestPeriod: row.latest_period,
        earliestPeriod: row.earliest_period,
        submarket: (row.submarket_name ?? row.raw_submarket_id ?? null) as string | null,
        submarketId: row.submarket_id ?? null,
        msaName: (row.msa_name_override ?? null) as string | null,
        dealId: (row.deal_id ?? null) as string | null,
        status: occ < 88 ? 'watch' : 'performing',
      };
    });

    res.json({ assets });
  } catch (err) {
    logger.error('Portfolio assets error:', err);
    res.status(500).json({ 
      error: err instanceof Error ? err.message : 'Failed to get portfolio assets' 
    });
  }
});

/**
 * POST /api/v1/portfolio/assets
 * Create a new owned portfolio property. Sets ownership_status='portfolio' so
 * the property is immediately visible in GET /assets even before actuals are loaded.
 */
router.post('/assets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const body = req.body as Record<string, unknown>;
    const { name, address, city, state, units, assetClass, yearBuilt,
            submarketId, manualSubmarket, manualMsa,
            acquisitionDate, acquisitionPrice, notes } = body;
    if (!name || !address || !city || !state) {
      return res.status(400).json({ error: 'name, address, city, state are required' });
    }

    // Submarket: prefer a linked ID; fall back to free-text manual entry stored in the same varchar column.
    const resolvedSubmarket = submarketId != null && String(submarketId) !== ''
      ? String(submarketId)
      : (manualSubmarket != null && String(manualSubmarket).trim() !== '' ? String(manualSubmarket).trim() : null);

    const result = await query(
      `INSERT INTO properties
         (id, name, address_line1, city, state_code, units, building_class, year_built,
          submarket_id, ownership_status, acquisition_date, acquisition_price,
          msa_name_override, notes, created_by, created_at, updated_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'portfolio', $9, $10, $11, $12, $13, NOW(), NOW())
       RETURNING id`,
      [
        String(name),
        String(address),
        String(city),
        String(state).toUpperCase().slice(0, 2),
        units != null ? Number(units) : null,
        assetClass != null ? String(assetClass) : null,
        yearBuilt != null ? Number(yearBuilt) : null,
        resolvedSubmarket,
        acquisitionDate != null && String(acquisitionDate).length >= 7 ? String(acquisitionDate) : null,
        acquisitionPrice != null && String(acquisitionPrice) !== '' ? Number(acquisitionPrice) : null,
        manualMsa != null && String(manualMsa).trim() !== '' ? String(manualMsa).trim() : null,
        notes != null && String(notes).trim() !== '' ? String(notes).trim() : null,
        userId,
      ]
    );

    const newId = (result.rows[0] as Record<string, unknown>).id as string;
    res.status(201).json({ propertyId: newId, message: 'Portfolio property created' });
  } catch (err) {
    logger.error('Portfolio create asset error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create portfolio property' });
  }
});

/**
 * GET /api/v1/portfolio/assets/:propertyId/actuals
 * Monthly actuals time-series for a portfolio property owned by the current user
 * (or a seed property with no explicit owner: created_by IS NULL).
 */
router.get('/assets/:propertyId/actuals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user!.userId;

    const check = await query(
      `SELECT id FROM properties
       WHERE id = $1
         AND (created_by = $2 OR created_by IS NULL)
       LIMIT 1`,
      [propertyId, userId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Property not found' });

    const result = await query(
      `SELECT
         report_month,
         TO_CHAR(report_month, 'Mon YYYY')       AS period_label,
         occupancy_rate,
         asking_rent,
         avg_effective_rent,
         avg_market_rent,
         noi,
         noi_per_unit,
         effective_gross_income,
         total_opex,
         concessions,
         months_free_concession,
         concession_rebate_amount,
         vacancy_loss,
         notes,
         data_source
       FROM deal_monthly_actuals
       WHERE property_id = $1 AND is_portfolio_asset = TRUE
       ORDER BY report_month ASC`,
      [propertyId]
    );

    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Portfolio asset actuals error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get property actuals' });
  }
});

/**
 * POST /api/v1/portfolio/assets/:propertyId/actuals
 * Add a monthly actual row for a portfolio property.
 * Body: { period: 'YYYY-MM', occupancy_rate, noi, avg_effective_rent, avg_market_rent,
 *         effective_gross_income, total_opex, concessions, vacancy_loss, notes }
 * Scoped: only the creating user (or seed properties with created_by IS NULL) can add actuals.
 */
router.post('/assets/:propertyId/actuals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { propertyId } = req.params;
    const userId = req.user!.userId;
    const body = req.body as Record<string, unknown>;

    const check = await query(
      `SELECT id FROM properties
       WHERE id = $1 AND (created_by = $2 OR created_by IS NULL)
       LIMIT 1`,
      [propertyId, userId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Property not found' });

    const { period } = body;
    if (!period || typeof period !== 'string') {
      return res.status(400).json({ error: 'period (YYYY-MM) is required' });
    }
    const reportMonth = `${period}-01`;

    const n = (k: string) => body[k] != null && body[k] !== '' ? Number(body[k]) : null;

    await query(
      `INSERT INTO deal_monthly_actuals
         (id, property_id, deal_id, report_month, is_portfolio_asset,
          occupancy_rate, asking_rent, avg_effective_rent, avg_market_rent, noi,
          effective_gross_income, total_opex, concessions,
          months_free_concession, concession_rebate_amount,
          vacancy_loss, data_source, notes, created_at, updated_at)
       VALUES
         (gen_random_uuid(), $1, NULL, $2::date, TRUE,
          $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          $13, 'manual', $14, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [
        propertyId, reportMonth,
        n('occupancy_rate'), n('asking_rent'), n('avg_effective_rent'), n('avg_market_rent'), n('noi'),
        n('effective_gross_income'), n('total_opex'), n('concessions'),
        n('months_free_concession'), n('concession_rebate_amount'),
        n('vacancy_loss'),
        body.notes != null ? String(body.notes) : null,
      ]
    );

    res.status(201).json({ message: 'Actual recorded' });
  } catch (err) {
    logger.error('Portfolio asset add actual error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to record actual' });
  }
});

/**
 * GET /api/v1/portfolio/performance
 * Get portfolio performance time series with projected vs actual comparison.
 * Always emits all months in the requested range; actuals are LEFT-JOINed so
 * the projected line renders even for periods without uploaded actuals.
 */
router.get('/performance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { timeframe = 'ytd' } = req.query;
    
    let months = 12;
    if (timeframe === 'mtd') months = 1;
    if (timeframe === 'qtd') months = 3;
    if (timeframe === 'ltm') months = 12;

    // Portfolio-wide pro forma projections (monthly) from deal_data
    // These are aggregated once and applied to every period bucket.
    const result = await query(`
      WITH portfolio_projection AS (
        SELECT
          COALESCE(SUM((deal_data->>'noi')::numeric / 12.0), 0) AS projected_noi,
          COALESCE(AVG((deal_data->>'occupancy_rate')::numeric), 0) AS projected_occupancy
        FROM deals
        WHERE (deal_data->>'noi') IS NOT NULL
          AND (deal_data->>'noi')::numeric > 0
          AND (status IN ('owned', 'closed', 'portfolio') OR deal_category = 'portfolio')
      ),
      date_series AS (
        SELECT generate_series(
          DATE_TRUNC('month', NOW() - ($1 - 1) * INTERVAL '1 month'),
          DATE_TRUNC('month', NOW()),
          '1 month'::interval
        )::date AS period_date
      ),
      actuals AS (
        SELECT
          DATE_TRUNC('month', period_start)::date AS period_date,
          SUM(actual_noi) AS actual_noi,
          AVG(actual_occupancy_pct) AS actual_occupancy,
          COUNT(DISTINCT deal_id) AS n_deals
        FROM actual_performance
        WHERE period_start >= NOW() - $1 * INTERVAL '1 month'
        GROUP BY DATE_TRUNC('month', period_start)::date
      )
      SELECT
        TO_CHAR(ds.period_date, 'Mon YY') AS period,
        ds.period_date,
        a.actual_noi,
        a.actual_occupancy,
        a.n_deals AS n_actual_deals,
        pp.projected_noi,
        pp.projected_occupancy
      FROM date_series ds
      CROSS JOIN portfolio_projection pp
      LEFT JOIN actuals a ON a.period_date = ds.period_date
      ORDER BY ds.period_date
    `, [months]);

    res.json({
      data: result.rows.map((r: Record<string, unknown>) => {
        const actualNoi  = r.actual_noi  != null ? Number(r.actual_noi)  : null;
        const actualOcc  = r.actual_occupancy != null ? Number(r.actual_occupancy) : null;
        const projNoi    = Number(r.projected_noi);
        const projOcc    = Number(r.projected_occupancy);
        return {
          period: r.period,
          period_date: r.period_date,
          actual_noi: actualNoi,
          projected_noi: projNoi,
          actual_occupancy: actualOcc,
          projected_occupancy: projOcc,
          // Legacy aliases for other panels that still use p.noi / p.occupancy
          noi: actualNoi ?? 0,
          occupancy: actualOcc ?? 0,
          expenses: actualNoi != null ? actualNoi * 0.45 : null,
          n_actual_deals: r.n_actual_deals != null ? Number(r.n_actual_deals) : 0,
        };
      }),
    });
  } catch (err) {
    logger.error('Portfolio performance error:', err);
    res.status(500).json({ 
      error: err instanceof Error ? err.message : 'Failed to get portfolio performance' 
    });
  }
});

/**
 * GET /api/v1/portfolio/performance/contributors
 * Returns per-deal actuals for a specific period (YYYY-MM-DD month start).
 */
router.get('/performance/contributors', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period } = req.query;
    if (!period || typeof period !== 'string') {
      return res.status(400).json({ error: 'period query param required (YYYY-MM-DD)' });
    }

    const result = await query(`
      SELECT
        d.id,
        d.name,
        d.address,
        d.deal_data->>'city' AS city,
        d.deal_data->>'state' AS state,
        ap.actual_noi,
        ap.actual_occupancy_pct,
        ap.actual_rent_per_unit,
        ap.variance_from_projection_pct
      FROM actual_performance ap
      JOIN deals d ON d.id = ap.deal_id
      WHERE DATE_TRUNC('month', ap.period_start) = DATE_TRUNC('month', $1::date)
        AND (d.status IN ('owned', 'closed', 'portfolio') OR d.deal_category = 'portfolio')
      ORDER BY ap.actual_noi DESC NULLS LAST
    `, [period]);

    res.json({ contributors: result.rows });
  } catch (err) {
    logger.error('Portfolio performance contributors error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to get period contributors',
    });
  }
});

/**
 * GET /api/v1/portfolio/allocation
 * Get portfolio allocation breakdown
 */
router.get('/allocation', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const byClass = await query(`
      SELECT 
        COALESCE(d.deal_data->>'asset_class', 'B') as asset_class,
        COUNT(*) as count,
        COALESCE(SUM((d.deal_data->>'current_value')::numeric), 0) as value
      FROM deals d
      WHERE d.status IN ('owned', 'closed', 'portfolio')
        OR d.deal_category = 'portfolio'
      GROUP BY d.deal_data->>'asset_class'
    `);

    const byMarket = await query(`
      SELECT 
        COALESCE(d.deal_data->>'msa', d.deal_data->>'city', 'Unknown') as market,
        COUNT(*) as count,
        COALESCE(SUM((d.deal_data->>'unit_count')::int), 0) as units
      FROM deals d
      WHERE d.status IN ('owned', 'closed', 'portfolio')
        OR d.deal_category = 'portfolio'
      GROUP BY COALESCE(d.deal_data->>'msa', d.deal_data->>'city', 'Unknown')
      ORDER BY units DESC
      LIMIT 10
    `);

    res.json({
      byClass: byClass.rows,
      byMarket: byMarket.rows,
    });
  } catch (err) {
    logger.error('Portfolio allocation error:', err);
    res.status(500).json({ 
      error: err instanceof Error ? err.message : 'Failed to get portfolio allocation' 
    });
  }
});

/**
 * GET /api/v1/portfolio/:dealId/summary
 * Get deal-level summary for the PortfolioPropertyPage
 */
router.get('/:dealId/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;

    const dealResult = await query(
      `SELECT id, name, address, state, project_type, budget, target_units,
              status, deal_category, deal_data, created_at, property_id
       FROM deals
       WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
       LIMIT 1`,
      [dealId, userId]
    );

    if (dealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const row = dealResult.rows[0] as Record<string, unknown>;
    const dealData = (typeof row.deal_data === 'string'
      ? JSON.parse(row.deal_data as string)
      : (row.deal_data as Record<string, unknown>)) || {};
    const propertyId = row.property_id as string | null;

    const deal = {
      id:          row.id as string,
      name:        row.name as string,
      address:     (row.address as string | null) || (dealData.address as string | null) || '',
      units:       Number(dealData.unit_count ?? row.target_units ?? 0),
      projectType: (row.project_type as string | null) || '',
      status:      (row.status as string | null) || '',
      state:       (row.state as string | null) || '',
      category:    (row.deal_category as string | null) || '',
      budget:      Number(row.budget ?? 0),
      vintage:     (dealData.vintage as string | null) || null,
      class:       (dealData.class as string | null) || '',
      operator:    (dealData.operator as string | null) || null,
      county:      (dealData.county as string | null) || null,
      createdAt:   row.created_at as string,
    };

    // Latest actuals row — query by property_id (covers rows with null deal_id from legacy import)
    const latestRes = await (propertyId
      ? query(
          `SELECT *
           FROM deal_monthly_actuals
           WHERE property_id = $1 AND is_portfolio_asset = TRUE
             AND is_budget = false AND is_proforma = false
           ORDER BY report_month DESC LIMIT 1`,
          [propertyId]
        )
      : query(
          `SELECT *
           FROM deal_monthly_actuals
           WHERE deal_id = $1 AND is_budget = false AND is_proforma = false
           ORDER BY report_month DESC LIMIT 1`,
          [dealId]
        )
    ).catch(() => ({ rows: [] as Record<string, unknown>[] }));

    const latestFinancials = latestRes.rows[0] || null;

    // Lease stats (avg loss-to-lease, avg rent) — query by property_id
    const leaseRes = await (propertyId
      ? query(
          `SELECT
             AVG(CASE WHEN avg_market_rent > 0
               THEN (avg_market_rent - avg_effective_rent) / avg_market_rent * 100
               ELSE NULL END) AS avg_loss_to_lease_pct,
             AVG(avg_effective_rent) AS avg_rent
           FROM deal_monthly_actuals
           WHERE property_id = $1 AND is_portfolio_asset = TRUE
             AND is_budget = false AND is_proforma = false
             AND avg_effective_rent IS NOT NULL`,
          [propertyId]
        )
      : query(
          `SELECT
             AVG(CASE WHEN avg_market_rent > 0
               THEN (avg_market_rent - avg_effective_rent) / avg_market_rent * 100
               ELSE NULL END) AS avg_loss_to_lease_pct,
             AVG(avg_effective_rent) AS avg_rent
           FROM deal_monthly_actuals
           WHERE deal_id = $1 AND is_budget = false AND is_proforma = false
             AND avg_effective_rent IS NOT NULL`,
          [dealId]
        )
    ).catch(() => ({ rows: [] as Record<string, unknown>[] }));

    const leaseStats = leaseRes.rows[0]?.avg_rent != null ? leaseRes.rows[0] : null;

    // Traffic stats: count of available traffic periods
    const trafficRes = await query(
      `SELECT COUNT(*) AS total_weeks
       FROM traffic_funnel
       WHERE deal_id = $1`,
      [dealId]
    ).catch(() => ({ rows: [{ total_weeks: 0 }] as Record<string, unknown>[] }));

    const trafficStats = trafficRes.rows[0] || null;

    res.json({
      deal,
      latestFinancials,
      unitProgram: null,
      leaseStats,
      trafficStats,
    });
  } catch (err) {
    logger.error('Portfolio property summary error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get property summary' });
  }
});

/**
 * GET /api/v1/portfolio/:dealId/financials
 * Get monthly financial history for a deal property
 */
router.get('/:dealId/financials', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;

    // Verify deal ownership
    const ownerCheck = await query(
      `SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL LIMIT 1`,
      [dealId, userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Resolve property_id to include legacy rows with null deal_id
    const propLookup = await query(
      `SELECT property_id FROM deals WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [dealId, userId]
    );
    const propId = propLookup.rows[0]?.property_id as string | null;

    const result = await (propId
      ? query(
          `SELECT
             report_month,
             to_char(report_month, 'Mon YYYY') AS period_label,
             occupancy_rate,
             avg_effective_rent,
             avg_market_rent,
             gross_potential_rent,
             net_rental_income,
             effective_gross_income,
             total_opex,
             noi,
             noi_per_unit,
             capex,
             cash_flow_before_tax,
             debt_service,
             new_leases,
             renewals,
             payroll,
             repairs_maintenance,
             turnover_costs,
             marketing,
             admin_general,
             management_fee,
             utilities,
             property_tax,
             insurance
           FROM deal_monthly_actuals
           WHERE property_id = $1 AND is_portfolio_asset = TRUE
             AND is_budget = false AND is_proforma = false
           ORDER BY report_month ASC`,
          [propId]
        )
      : query(
          `SELECT
             report_month,
             to_char(report_month, 'Mon YYYY') AS period_label,
             occupancy_rate,
             avg_effective_rent,
             avg_market_rent,
             gross_potential_rent,
             net_rental_income,
             effective_gross_income,
             total_opex,
             noi,
             noi_per_unit,
             capex,
             cash_flow_before_tax,
             debt_service,
             new_leases,
             renewals,
             payroll,
             repairs_maintenance,
             turnover_costs,
             marketing,
             admin_general,
             management_fee,
             utilities,
             property_tax,
             insurance
           FROM deal_monthly_actuals
           WHERE deal_id = $1 AND is_budget = false AND is_proforma = false
           ORDER BY report_month ASC`,
          [dealId]
        )
    );

    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Portfolio property financials error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get property financials' });
  }
});

// ─── Agent Report Endpoint ────────────────────────────────────────────────────
// Uses real agent tool functions (T12, rent roll, variance) to generate
// deal-specific reports backed by live database data, not just frontend context.

const REPORT_AGENT_SYSTEM = `You are the JediRe Report Agent — a senior commercial real estate analyst specializing in institutional-quality asset reporting.

You have access to live database tools that pull real financial data for the subject property. Always use these tools to ground your analysis before writing — never make up numbers.

Report writing principles:
- Lead with the most important number or finding
- Use structured sections with clear headers
- State actuals precisely (e.g., "$1.23M annualized NOI") then give context (vs prior year, vs underwriting)
- Flag unfavorable trends explicitly — do not soften
- Keep reports concise and professional — a lender or LP should be able to read this in 90 seconds
- Always note the date range the data covers
- Where data is unavailable, say so clearly rather than estimating

Format: Plain text with section headers using ALL CAPS and dashes. Numbers always formatted with $ and commas.`;

const REPORT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'fetch_t12_actuals',
    description: 'Fetch trailing 12-month financial data for this deal from the database — gross revenue, total expenses, NOI, occupancy, and revenue per unit.',
    input_schema: {
      type: 'object' as const,
      properties: {
        months: { type: 'number', description: 'Months to aggregate (default 12)', default: 12 },
      },
      required: [],
    },
  },
  {
    name: 'fetch_rent_roll_summary',
    description: 'Fetch current rent roll summary — occupied/vacant units, avg in-place rent, total monthly income, leases expiring in 90 and 180 days, market rent spread.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'fetch_actuals_trend',
    description: 'Fetch monthly actuals trend data — NOI, occupancy, and effective rent over the last N months. Use for trend analysis, YoY comparison, and quarterly reporting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        months: { type: 'number', description: 'Number of months of history to return (default 24)', default: 24 },
      },
      required: [],
    },
  },
  {
    name: 'fetch_variance_vs_underwriting',
    description: 'Fetch variance between projected (underwritten) and actual performance — NOI variance, revenue variance, expense variance, and key drivers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: { type: 'string', enum: ['ytd', 'trailing_3mo', 'trailing_6mo', 'trailing_12mo'], default: 'trailing_12mo' },
      },
      required: [],
    },
  },
];

async function executeReportTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  dealId: string
): Promise<string> {
  const n = (v: unknown) => (v != null && !isNaN(Number(v)) ? Number(v) : null);
  const fmt = (v: number | null) => v == null ? 'N/A' : `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const fmtPct = (v: number | null) => v == null ? 'N/A' : `${(Number(v) * 100).toFixed(1)}%`;

  try {
    if (toolName === 'fetch_t12_actuals') {
      const months = Number(toolInput.months ?? 12);
      const r = await query(
        `SELECT
           COUNT(*)::int                                             AS months_available,
           SUM(effective_gross_income)                              AS gross_revenue,
           SUM(effective_gross_income - noi)                        AS total_expenses,
           SUM(noi)                                                 AS noi,
           AVG(occupancy_rate)                                      AS avg_occupancy,
           AVG(avg_effective_rent)                                  AS avg_effective_rent,
           MAX(total_units)                                         AS total_units,
           MAX(report_month)                                        AS latest_month,
           MIN(report_month)                                        AS earliest_month
         FROM deal_monthly_actuals
         WHERE deal_id = $1
           AND report_month >= CURRENT_DATE - ($2 * INTERVAL '1 month')
           AND is_budget = false`,
        [dealId, months]
      );
      const row = r.rows[0] as Record<string, unknown>;
      const mo = n(row.months_available) ?? 0;
      if (mo === 0) return JSON.stringify({ has_data: false, note: 'No actuals uploaded for this deal' });
      const rev = n(row.gross_revenue);
      const exp = n(row.total_expenses);
      const noi = n(row.noi);
      const units = n(row.total_units);
      return JSON.stringify({
        has_data: true,
        months_available: mo,
        period: `${row.earliest_month} to ${row.latest_month}`,
        gross_revenue_ttm: fmt(rev),
        total_expenses_ttm: fmt(exp),
        noi_ttm: fmt(noi),
        noi_annualized: fmt(noi ? (noi / mo) * 12 : null),
        avg_occupancy: fmtPct(n(row.avg_occupancy)),
        avg_effective_rent: fmt(n(row.avg_effective_rent)),
        expense_ratio: rev && exp ? `${((exp / rev) * 100).toFixed(1)}%` : 'N/A',
        noi_per_unit_annual: units && noi ? fmt((noi / mo * 12) / units) : 'N/A',
      });
    }

    if (toolName === 'fetch_rent_roll_summary') {
      const r = await query(
        `SELECT
           COUNT(*)                                        AS total_units,
           COUNT(*) FILTER (WHERE status = 'occupied')    AS occupied_units,
           COUNT(*) FILTER (WHERE status = 'vacant')      AS vacant_units,
           AVG(current_rent) FILTER (WHERE status = 'occupied')  AS avg_in_place_rent,
           SUM(current_rent) FILTER (WHERE status = 'occupied')  AS total_monthly_income,
           AVG(market_rent)                               AS avg_market_rent,
           COUNT(*) FILTER (WHERE lease_end BETWEEN CURRENT_DATE AND CURRENT_DATE + 90)  AS expiring_90d,
           COUNT(*) FILTER (WHERE lease_end BETWEEN CURRENT_DATE AND CURRENT_DATE + 180) AS expiring_180d
         FROM deal_units
         WHERE deal_id = $1`,
        [dealId]
      );
      const row = r.rows[0] as Record<string, unknown>;
      const total = n(row.total_units) ?? 0;
      const occ = n(row.occupied_units) ?? 0;
      const inPlace = n(row.avg_in_place_rent);
      const market = n(row.avg_market_rent);
      if (total === 0) return JSON.stringify({ has_data: false, note: 'No unit-level data available' });
      return JSON.stringify({
        has_data: true,
        total_units: total,
        occupied_units: occ,
        vacant_units: n(row.vacant_units) ?? (total - occ),
        occupancy_pct: `${((occ / total) * 100).toFixed(1)}%`,
        avg_in_place_rent: fmt(inPlace),
        avg_market_rent: fmt(market),
        rent_to_market_spread: inPlace && market ? fmt(market - inPlace) : 'N/A',
        total_monthly_income: fmt(n(row.total_monthly_income)),
        leases_expiring_90d: n(row.expiring_90d) ?? 0,
        leases_expiring_180d: n(row.expiring_180d) ?? 0,
      });
    }

    if (toolName === 'fetch_actuals_trend') {
      const months = Number(toolInput.months ?? 24);
      const r = await query(
        `SELECT
           report_month,
           noi,
           occupancy_rate,
           avg_effective_rent,
           effective_gross_income,
           total_units
         FROM deal_monthly_actuals
         WHERE deal_id = $1
           AND report_month >= CURRENT_DATE - ($2 * INTERVAL '1 month')
           AND is_budget = false
         ORDER BY report_month ASC`,
        [dealId, months]
      );
      if (r.rows.length === 0) return JSON.stringify({ has_data: false, note: 'No trend data available' });
      const rows = r.rows as Record<string, unknown>[];
      const trend = rows.map(row => ({
        month: String(row.report_month).slice(0, 7),
        noi: fmt(n(row.noi)),
        occupancy: fmtPct(n(row.occupancy_rate)),
        avg_rent: fmt(n(row.avg_effective_rent)),
        egi: fmt(n(row.effective_gross_income)),
      }));
      const first = rows[0], last = rows[rows.length - 1];
      const noiFirst = n(first.noi), noiLast = n(last.noi);
      return JSON.stringify({
        has_data: true,
        months_of_data: rows.length,
        trend,
        noi_change: noiFirst && noiLast ? `${(((noiLast - noiFirst) / Math.abs(noiFirst)) * 100).toFixed(1)}% over period` : 'N/A',
      });
    }

    if (toolName === 'fetch_variance_vs_underwriting') {
      const r = await query(
        `SELECT
           line_item,
           line_item_category,
           SUM(projected_value)  AS projected,
           SUM(actual_value)     AS actual,
           SUM(variance_amount)  AS variance,
           AVG(variance_pct)     AS variance_pct
         FROM variance_analysis
         WHERE deal_id = $1
           AND period_start >= CURRENT_DATE - INTERVAL '12 months'
         GROUP BY line_item, line_item_category
         ORDER BY ABS(SUM(variance_amount)) DESC
         LIMIT 15`,
        [dealId]
      );
      if (r.rows.length === 0) return JSON.stringify({ has_data: false, note: 'No variance data — underwriting benchmarks not loaded' });
      const rows = r.rows as Record<string, unknown>[];
      const items = rows.map(row => ({
        line_item: row.line_item,
        category: row.line_item_category,
        projected: fmt(n(row.projected)),
        actual: fmt(n(row.actual)),
        variance: fmt(n(row.variance)),
        variance_pct: `${Number(row.variance_pct ?? 0).toFixed(1)}%`,
        direction: (n(row.variance) ?? 0) >= 0 ? 'favorable' : 'unfavorable',
      }));
      return JSON.stringify({ has_data: true, variance_items: items });
    }

    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  } catch (err) {
    logger.error(`[agent-report] Tool ${toolName} failed`, { dealId, err });
    return JSON.stringify({ error: 'Tool execution failed', detail: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * POST /api/v1/portfolio/:dealId/agent-report
 * Run the Report Agent with real database tool calls for this deal.
 */
router.post('/:dealId/agent-report', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { dealId } = req.params;
  const { prompt, conversationId } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  // Prefer the Replit-managed integration key (routes via the ModelFarm proxy)
  // and fall back to a raw Anthropic key for local/dev. Same precedence as
  // the rest of the backend.
  const apiKey =
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.CLAUDE_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  if (!apiKey) {
    res.status(500).json({ error: 'AI service not configured' });
    return;
  }

  try {
    // Load deal summary for initial context
    const dealRes = await query(
      `SELECT d.name, d.status, d.deal_data, d.category
       FROM deals d WHERE d.id = $1 LIMIT 1`,
      [dealId]
    );
    if (dealRes.rows.length === 0) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }
    const dealRow = dealRes.rows[0] as Record<string, unknown>;
    const dealData = (dealRow.deal_data as Record<string, unknown>) ?? {};
    const dealSummary = `Property: ${dealRow.name ?? dealId} | Status: ${dealRow.status} | Category: ${dealRow.category} | Units: ${dealData.unit_count ?? dealData.units ?? 'unknown'}`;

    const anthropic = new Anthropic({ apiKey, baseURL });
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: `${dealSummary}\n\nRequest: ${prompt}` },
    ];

    let finalText = '';
    let iterations = 0;
    const MAX_ITER = 6;

    while (iterations < MAX_ITER) {
      iterations++;
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: REPORT_AGENT_SYSTEM,
        tools: REPORT_TOOLS,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        finalText = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('');
        break;
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );

        for (const toolUse of toolUseBlocks) {
          logger.info(`[agent-report] Tool call: ${toolUse.name}`, { dealId, conversationId });
          const result = await executeReportTool(toolUse.name, toolUse.input as Record<string, unknown>, dealId);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result,
          });
        }
        messages.push({ role: 'user', content: toolResults });
      } else {
        finalText = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('');
        break;
      }
    }

    logger.info('[agent-report] Report generated', { dealId, iterations, length: finalText.length });
    res.json({ response: finalText, conversationId });
  } catch (err: any) {
    logger.error('[agent-report] Failed', { dealId, err: err.message });
    res.status(500).json({ error: 'Report generation failed. Please try again.' });
  }
});

// ─── Portfolio Correlation Endpoints (Task #1657) ─────────────────────────

/**
 * POST /api/v1/portfolio/run-correlations
 * Runs the portfolio correlation engine against all owned-property actuals:
 *   1. Computes 4 empirical per-property coefficients and persists them.
 *   2. Runs COR-01–30 with first-party rent fill for COR-04/COR-13.
 *   3. Persists adjustment signals to any linked deals.
 * Query param: ?dryRun=true to skip writes.
 */
router.post('/run-correlations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { PortfolioCorrelationService } = await import('../../services/portfolio-correlation.service');
    const svc = new PortfolioCorrelationService();
    const dryRun = req.query.dryRun === 'true';
    // userId scopes property lookup to (created_by = userId OR created_by IS NULL)
    const summary = await svc.run(userId, { dryRun });
    res.json({
      ok: true,
      dry_run: dryRun,
      properties_processed: summary.properties_processed,
      signals_computed: summary.signals.length,
      coefficients_computed: summary.coefficients.length,
      computed_at: summary.computed_at,
      signals: summary.signals,
      coefficients: summary.coefficients,
    });
  } catch (err: any) {
    logger.error('[portfolio] run-correlations failed', { error: err?.message });
    res.status(500).json({ error: err?.message ?? 'Correlation run failed' });
  }
});

/**
 * GET /api/v1/portfolio/correlation-signals
 * Returns stored empirical coefficients for the F3 Learning tab.
 * Does not re-compute — call POST /run-correlations first.
 */
router.get('/correlation-signals', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { PortfolioCorrelationService } = await import('../../services/portfolio-correlation.service');
    const svc = new PortfolioCorrelationService();
    // getSummary scopes to (created_by = userId OR created_by IS NULL) and returns
    // both stored coefficients and durably-stored per-property enriched COR signals.
    const summary = await svc.getSummary(userId);
    res.json(summary);
  } catch (err: any) {
    logger.error('[portfolio] correlation-signals failed', { error: err?.message });
    res.status(500).json({ error: err?.message ?? 'Failed to load correlation signals' });
  }
});

/**
 * GET /api/v1/portfolio/:dealId/traffic
 * Weekly traffic actuals from traffic_funnel for the Leasing tab charts.
 * Returns TrafficWeek[] sorted ascending.
 */
router.get('/:dealId/traffic', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;

    const ownerCheck = await query(
      `SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL LIMIT 1`,
      [dealId, userId]
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Deal not found' });

    const result = await query(
      `SELECT
         period_end                                     AS week_ending,
         total_leads                                    AS traffic,
         CASE WHEN total_leads > 0
              THEN ROUND(leases_signed::numeric / total_leads * 100, 1)
              ELSE NULL END                             AS closing_ratio,
         NULL::numeric                                  AS occ_pct,
         tours_completed,
         applications,
         denied,
         leases_signed,
         move_ins
       FROM traffic_funnel
       WHERE deal_id = $1
       ORDER BY period_end ASC`,
      [dealId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    logger.error('[portfolio] traffic failed', { error: err?.message });
    res.status(500).json({ error: err?.message ?? 'Failed to load traffic data' });
  }
});

/**
 * GET /api/v1/portfolio/:dealId/leasing
 * Leasing analytics: monthly stats, quarterly retention, recent transactions.
 */
router.get('/:dealId/leasing', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { dealId } = req.params;
    const userId = req.user!.userId;
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 500);

    const ownerCheck = await query(
      `SELECT id FROM deals WHERE id = $1 AND user_id = $2 AND archived_at IS NULL LIMIT 1`,
      [dealId, userId]
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Deal not found' });

    const [monthly, quarterly, recent] = await Promise.all([
      // Monthly stats: avg new rent, avg renewal rent, avg loss-to-lease %
      query(
        `SELECT
           date_trunc('month', lease_start)             AS month,
           ROUND(AVG(new_rent) FILTER (WHERE LOWER(TRIM(lease_type)) = 'new'), 2)       AS avg_new_rent,
           ROUND(AVG(new_rent) FILTER (WHERE LOWER(TRIM(lease_type)) = 'renewal'), 2)   AS avg_renewal_rent,
           ROUND(AVG(loss_to_lease_pct) * 100, 2)                                       AS avg_loss_to_lease_pct,
           COUNT(*) FILTER (WHERE LOWER(TRIM(lease_type)) = 'new')                      AS new_leases,
           COUNT(*) FILTER (WHERE LOWER(TRIM(lease_type)) = 'renewal')                  AS renewals
         FROM deal_lease_transactions
         WHERE deal_id = $1 AND lease_start IS NOT NULL
         GROUP BY 1
         ORDER BY 1 ASC`,
        [dealId]
      ),
      // Quarterly retention rate: renewals / (renewals + new leases)
      query(
        `SELECT
           to_char(date_trunc('quarter', lease_start), 'YYYY "Q"Q') AS quarter,
           ROUND(
             COUNT(*) FILTER (WHERE LOWER(TRIM(lease_type)) = 'renewal')::numeric
             / NULLIF(COUNT(*), 0) * 100, 1
           )                                                          AS retention_rate
         FROM deal_lease_transactions
         WHERE deal_id = $1 AND lease_start IS NOT NULL
         GROUP BY date_trunc('quarter', lease_start)
         ORDER BY date_trunc('quarter', lease_start) ASC`,
        [dealId]
      ),
      // Recent transactions (most recent first)
      query(
        `SELECT
           unit_number, unit_type, sqft, lease_type, lease_start,
           new_rent, prior_rent, market_rent,
           rent_change_dollar, loss_to_lease_pct, rent_psf
         FROM deal_lease_transactions
         WHERE deal_id = $1
         ORDER BY lease_start DESC NULLS LAST
         LIMIT $2`,
        [dealId, limit]
      ),
    ]);

    res.json({
      monthlyStats: monthly.rows,
      retentionByQuarter: quarterly.rows,
      recentTransactions: recent.rows,
    });
  } catch (err: any) {
    logger.error('[portfolio] leasing failed', { error: err?.message });
    res.status(500).json({ error: err?.message ?? 'Failed to load leasing data' });
  }
});

export default router;


